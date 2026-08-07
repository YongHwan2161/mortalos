import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import { build } from "esbuild";
import {
  RESOURCE_CONTRACT_LIMITS,
  ResourceContractError,
  createResourceConsumptionAnnouncement,
  evaluateResourceContract,
  finalizeResourceConsumptionWitness,
  finalizeResourceLease,
  finalizeResourceOffer,
  finalizeResourceRevocation,
  finalizeResourceUsageReceipt,
  prepareResourceConsumptionWitness,
  prepareResourceLease,
  prepareResourceOffer,
  prepareResourceRevocation,
  prepareResourceUsageReceipt,
  verifyResourceConsumptionAnnouncement,
  verifyResourceConsumptionWitness,
  verifyResourceLease,
  verifyResourceOffer,
  verifyResourceRevocation,
  verifyResourceUsageReceipt
} from "../src/resource-contract.mjs";
import { canonicalBytes, parseJsonBytes } from "../src/codec.mjs";
import { derivePeerId } from "../src/crypto.mjs";
import { encodeBase64Url } from "../src/bytes.mjs";
import { createContinuityAuthority } from "../src/continuity.mjs";
import {
  createRelayControlMessage,
  decodeRelayMessageBytes
} from "../src/transport/protocol.mjs";

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function identity(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

const DEFAULT_WITNESSES = [actor(), actor(), actor(), actor()];

function witnessPolicy(witnesses = DEFAULT_WITNESSES, overrides = {}) {
  return {
    max_faulty: overrides.max_faulty ?? 1,
    threshold: overrides.threshold ?? 3,
    witnesses: witnesses
      .map(identity)
      .sort((left, right) => left.key_id < right.key_id ? -1 : 1)
  };
}

function signature(value, message) {
  return `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}`;
}

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed));
}

function capacity(overrides = {}) {
  return {
    bandwidth: {
      burst_bytes: "1000",
      egress_bytes_total: "3000000",
      ingress_bytes_total: "2000000",
      rate_bytes_per_second: "100000",
      ...overrides.bandwidth
    },
    compute: {
      concurrency: "4",
      cpu_millis_total: "500000",
      memory_bytes: "1073741824",
      task_millis_max: "60000",
      ...overrides.compute
    },
    storage: {
      capacity_bytes: "10485760",
      max_object_bytes: "1048576",
      ...overrides.storage
    }
  };
}

function offerBody(provider, overrides = {}) {
  return {
    capacity: overrides.capacity ?? capacity(),
    expires_at_ms: overrides.expires_at_ms ?? "2000",
    offer_nonce: overrides.offer_nonce ?? nonce(1),
    provider: identity(provider),
    valid_from_ms: overrides.valid_from_ms ?? "1000",
    witness_policy: overrides.witness_policy ?? witnessPolicy()
  };
}

function leaseBody(offerId, consumer, overrides = {}) {
  return {
    allocation: overrides.allocation ?? capacity({
      bandwidth: {
        burst_bytes: "500",
        egress_bytes_total: "1500000",
        ingress_bytes_total: "1000000",
        rate_bytes_per_second: "50000"
      },
      compute: {
        concurrency: "2",
        cpu_millis_total: "250000",
        memory_bytes: "536870912",
        task_millis_max: "30000"
      },
      storage: { capacity_bytes: "5242880", max_object_bytes: "524288" }
    }),
    consumer: identity(consumer),
    ends_at_ms: overrides.ends_at_ms ?? "1900",
    lease_nonce: overrides.lease_nonce ?? nonce(2),
    offer_id: offerId,
    starts_at_ms: overrides.starts_at_ms ?? "1100"
  };
}

function usageBody(leaseId, overrides = {}) {
  return {
    lease_id: leaseId,
    observed_at_ms: overrides.observed_at_ms ?? "1200",
    previous_receipt_id: overrides.previous_receipt_id ?? null,
    receipt_sequence: overrides.receipt_sequence ?? "0",
    usage: overrides.usage ?? {
      bandwidth: {
        egress_bytes_cumulative: "2000",
        ingress_bytes_cumulative: "1000"
      },
      compute: {
        concurrency_peak: "1",
        cpu_millis_cumulative: "10000",
        memory_bytes_peak: "268435456",
        task_millis_peak: "1000"
      },
      storage: { bytes_current: "100000", bytes_peak: "200000" }
    }
  };
}

function signedOffer(provider, body = offerBody(provider)) {
  const draft = prepareResourceOffer(body);
  return finalizeResourceOffer({
    body: draft.body,
    provider_signature: signature(provider, draft.provider_signing_message)
  });
}

function signedLease(provider, consumer, offer, body) {
  const draft = prepareResourceLease({ offer, body });
  return finalizeResourceLease({
    offer,
    body: draft.body,
    provider_signature: signature(provider, draft.provider_signing_message),
    consumer_signature: signature(consumer, draft.consumer_signing_message)
  });
}

function signedUsage(provider, consumer, offer, lease, previousReceipts, body) {
  const draft = prepareResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: previousReceipts,
    body
  });
  return finalizeResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: previousReceipts,
    body: draft.body,
    provider_signature: signature(provider, draft.provider_signing_message),
    consumer_signature: signature(consumer, draft.consumer_signing_message)
  });
}

function signedRevocation(signer, offer, lease, body) {
  const draft = prepareResourceRevocation({ offer, lease, body });
  assert.equal(draft.signer_key_id, signer.key_id);
  return finalizeResourceRevocation({
    offer,
    lease,
    body: draft.body,
    signature: signature(signer, draft.signing_message)
  });
}

function signedConsumptionWitness(signer, offer, lease) {
  const draft = prepareResourceConsumptionWitness({
    offer,
    lease,
    witness_key_id: signer.key_id
  });
  return finalizeResourceConsumptionWitness({
    offer,
    lease,
    witness_key_id: signer.key_id,
    witness_signature: signature(signer, draft.signing_message)
  });
}

function consumptionAnnouncement(signer, offer, lease) {
  return createResourceConsumptionAnnouncement({
    offer,
    lease,
    witness: signedConsumptionWitness(signer, offer, lease)
  });
}

function witnessQuorum(offer, lease, witnesses = DEFAULT_WITNESSES.slice(0, 3)) {
  return witnesses.map((witness) => consumptionAnnouncement(witness, offer, lease));
}

function code(expected) {
  return (error) => error instanceof ResourceContractError && error.code === expected;
}

test("provider offer, mutual lease, chained usage, and unilateral revocation form one contract", () => {
  const provider = actor();
  const consumer = actor();
  const offer = signedOffer(provider);
  const verifiedOffer = verifyResourceOffer(offer);
  const lease = signedLease(
    provider,
    consumer,
    offer,
    leaseBody(verifiedOffer.offer_id, consumer)
  );
  const verifiedLease = verifyResourceLease({ offer, lease });
  const announcements = witnessQuorum(offer, lease);
  const consumptionId = verifyResourceConsumptionAnnouncement(
    announcements[0]
  ).consumption_id;
  const receipt0 = signedUsage(
    provider,
    consumer,
    offer,
    lease,
    [],
    usageBody(verifiedLease.lease_id)
  );
  const verified0 = verifyResourceUsageReceipt({
    offer, lease, previous_receipts: [], receipt: receipt0
  });
  const nextUsage = usageBody(verifiedLease.lease_id, {
    observed_at_ms: "1300",
    previous_receipt_id: verified0.receipt_id,
    receipt_sequence: "1",
    usage: {
      bandwidth: {
        egress_bytes_cumulative: "4000",
        ingress_bytes_cumulative: "3000"
      },
      compute: {
        concurrency_peak: "2",
        cpu_millis_cumulative: "20000",
        memory_bytes_peak: "300000000",
        task_millis_peak: "2000"
      },
      storage: { bytes_current: "50000", bytes_peak: "250000" }
    }
  });
  const receipt1 = signedUsage(
    provider, consumer, offer, lease, [receipt0], nextUsage
  );
  assert.equal(
    verifyResourceUsageReceipt({
      offer, lease, previous_receipts: [receipt0], receipt: receipt1
    }).receipt_id.length > 50,
    true
  );

  assert.deepEqual(
    evaluateResourceContract({
      consumption_announcements: announcements,
      offer,
      leases: [lease],
      usage_receipts: [receipt0, receipt1],
      revocations: [],
      observed_at_ms: "1350"
    }),
    {
      announcements_verified: 3,
      consumption_id: consumptionId,
      effective_revocation_id: null,
      lease_id: verifiedLease.lease_id,
      offer_id: verifiedOffer.offer_id,
      observed_at_ms: "1350",
      receipts_verified: 2,
      status: "active",
      witness_threshold: 3,
      witnesses_verified: 3
    }
  );

  const revocation = signedRevocation(consumer, offer, lease, {
    actor_key_id: consumer.key_id,
    effective_at_ms: "1400",
    reason: "consumer-request",
    revocation_nonce: nonce(3),
    target_id: verifiedLease.lease_id,
    target_kind: "lease"
  });
  assert.equal(verifyResourceRevocation({ offer, lease, revocation }).status, "verified");
  const revoked = evaluateResourceContract({
    consumption_announcements: announcements,
    offer,
    leases: [lease],
    usage_receipts: [receipt0, receipt1],
    revocations: [revocation],
    observed_at_ms: "1500"
  });
  assert.equal(revoked.status, "revoked");
  assert.notEqual(revoked.effective_revocation_id, null);
});

test("finite decimal, duration, allocation, usage, and envelope ceilings fail closed", () => {
  const provider = actor();
  const consumer = actor();
  assert.doesNotThrow(() => prepareResourceOffer(offerBody(provider, {
    expires_at_ms: (RESOURCE_CONTRACT_LIMITS.lease_duration_ms_max + 1000n).toString()
  })));
  assert.throws(
    () => prepareResourceOffer(offerBody(provider, {
      expires_at_ms: (RESOURCE_CONTRACT_LIMITS.lease_duration_ms_max + 1001n).toString()
    })),
    code("E_RESOURCE_TIME")
  );
  assert.throws(
    () => prepareResourceOffer(offerBody(provider, {
      capacity: capacity({
        storage: {
          capacity_bytes: (RESOURCE_CONTRACT_LIMITS.decimal_max + 1n).toString()
        }
      })
    })),
    code("E_RESOURCE_DECIMAL")
  );
  assert.throws(
    () => prepareResourceOffer(offerBody(provider, {
      witness_policy: witnessPolicy(
        new Array(RESOURCE_CONTRACT_LIMITS.witnesses_per_offer_max + 1)
          .fill(null)
          .map(() => actor()),
        { max_faulty: 0, threshold: 9 }
      )
    })),
    code("E_RESOURCE_LIMIT")
  );
  assert.throws(
    () => prepareResourceOffer(offerBody(provider, {
      witness_policy: witnessPolicy(DEFAULT_WITNESSES, {
        max_faulty: 1,
        threshold: 2
      })
    })),
    code("E_RESOURCE_WITNESS")
  );
  const offer = signedOffer(provider);
  const offerId = verifyResourceOffer(offer).offer_id;
  assert.throws(
    () => prepareResourceLease({
      offer,
      body: leaseBody(offerId, DEFAULT_WITNESSES[0])
    }),
    code("E_RESOURCE_WITNESS")
  );
  assert.throws(
    () => prepareResourceLease({
      offer,
      body: leaseBody(offerId, consumer, {
        allocation: capacity({ storage: { capacity_bytes: "10485761" } })
      })
    }),
    code("E_RESOURCE_CAPACITY")
  );
  const lease = signedLease(provider, consumer, offer, leaseBody(offerId, consumer));
  const announcement = consumptionAnnouncement(DEFAULT_WITNESSES[0], offer, lease);
  const leaseId = verifyResourceLease({ offer, lease }).lease_id;
  assert.throws(
    () => prepareResourceUsageReceipt({
      offer,
      lease,
      previous_receipts: [],
      body: usageBody(leaseId, {
        usage: {
          ...usageBody(leaseId).usage,
          storage: { bytes_current: "5242881", bytes_peak: "5242881" }
        }
      })
    }),
    code("E_RESOURCE_USAGE")
  );
  assert.throws(
    () => verifyResourceOffer(new Uint8Array(RESOURCE_CONTRACT_LIMITS.document_bytes + 1)),
    code("E_RESOURCE_LIMIT")
  );
  assert.throws(
    () => verifyResourceOffer(new Uint8Array(RESOURCE_CONTRACT_LIMITS.document_bytes)),
    code("E_RESOURCE_FORMAT")
  );
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: [],
      offer,
      leases: new Array(RESOURCE_CONTRACT_LIMITS.leases_per_offer_observation_max + 1).fill(lease),
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_LIMIT")
  );
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: new Array(
        RESOURCE_CONTRACT_LIMITS.announcements_per_evaluation_max + 1
      ).fill(announcement),
      offer,
      leases: [],
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_LIMIT")
  );
});

test("signature substitution, noncanonical bytes, unknown fields, and hostile objects reject", () => {
  const provider = actor();
  const attacker = actor();
  const draft = prepareResourceOffer(offerBody(provider));
  assert.throws(
    () => finalizeResourceOffer({
      body: draft.body,
      provider_signature: signature(attacker, draft.provider_signing_message)
    }),
    code("E_RESOURCE_SIGNATURE")
  );
  const offer = signedOffer(provider);
  const consumer = actor();
  const lease = signedLease(
    provider,
    consumer,
    offer,
    leaseBody(verifyResourceOffer(offer).offer_id, consumer)
  );
  const witnessDraft = prepareResourceConsumptionWitness({
    offer,
    lease,
    witness_key_id: DEFAULT_WITNESSES[0].key_id
  });
  assert.throws(
    () => finalizeResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: DEFAULT_WITNESSES[0].key_id,
      witness_signature: signature(attacker, witnessDraft.signing_message)
    }),
    code("E_RESOURCE_SIGNATURE")
  );
  const noncanonical = new TextEncoder().encode(` ${new TextDecoder().decode(offer)}`);
  assert.throws(() => verifyResourceOffer(noncanonical), code("E_RESOURCE_FORMAT"));
  const extra = { ...offerBody(provider), surprise: true };
  assert.throws(() => prepareResourceOffer(extra), code("E_RESOURCE_FORMAT"));
  const accessor = offerBody(provider);
  Object.defineProperty(accessor, "expires_at_ms", { enumerable: true, get() { return "2000"; } });
  assert.throws(() => prepareResourceOffer(accessor), code("E_RESOURCE_FORMAT"));
  assert.throws(
    () => prepareResourceOffer(new Proxy(offerBody(provider), {
      ownKeys() { throw new Error("hostile inspection"); }
    })),
    code("E_RESOURCE_FORMAT")
  );
  const custom = Object.assign(Object.create({ inherited: true }), offerBody(provider));
  assert.throws(() => prepareResourceOffer(custom), code("E_RESOURCE_FORMAT"));

  const mutable = offerBody(provider);
  const owned = prepareResourceOffer(mutable);
  mutable.capacity.storage.capacity_bytes = "1";
  assert.equal(owned.body.capacity.storage.capacity_bytes, "10485760");
  assert.doesNotThrow(() => finalizeResourceOffer({
    body: owned.body,
    provider_signature: signature(provider, owned.provider_signing_message)
  }));
});

test("evaluator owns dense arrays and rejects accessor or future receipt observations", () => {
  const provider = actor();
  const consumer = actor();
  const offer = signedOffer(provider);
  const offerId = verifyResourceOffer(offer).offer_id;
  const lease = signedLease(provider, consumer, offer, leaseBody(offerId, consumer));
  const leaseId = verifyResourceLease({ offer, lease }).lease_id;
  const receipt = signedUsage(provider, consumer, offer, lease, [], usageBody(leaseId));
  const hostileLeases = [lease];
  Object.defineProperty(hostileLeases, "0", {
    enumerable: true,
    get() { return lease; }
  });
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: [],
      offer,
      leases: hostileLeases,
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_FORMAT")
  );
  const hostileAnnouncements = witnessQuorum(offer, lease);
  Object.defineProperty(hostileAnnouncements, "0", {
    enumerable: true,
    get() { return consumptionAnnouncement(DEFAULT_WITNESSES[0], offer, lease); }
  });
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: hostileAnnouncements,
      offer,
      leases: [lease],
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_FORMAT")
  );
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: witnessQuorum(offer, lease),
      offer,
      leases: [lease],
      usage_receipts: [receipt],
      revocations: [],
      observed_at_ms: "1150"
    }),
    code("E_RESOURCE_TIME")
  );
});

test("receipt regression and stale/forked chain bindings reject", () => {
  const provider = actor();
  const consumer = actor();
  const offer = signedOffer(provider);
  const offerId = verifyResourceOffer(offer).offer_id;
  const lease = signedLease(provider, consumer, offer, leaseBody(offerId, consumer));
  const leaseId = verifyResourceLease({ offer, lease }).lease_id;
  const first = signedUsage(provider, consumer, offer, lease, [], usageBody(leaseId));
  const firstId = verifyResourceUsageReceipt({
    offer, lease, previous_receipts: [], receipt: first
  }).receipt_id;
  assert.throws(
    () => prepareResourceUsageReceipt({
      offer,
      lease,
      previous_receipts: [first],
      body: usageBody(leaseId, {
        observed_at_ms: "1300",
        previous_receipt_id: firstId,
        receipt_sequence: "1",
        usage: {
          ...usageBody(leaseId).usage,
          bandwidth: {
            egress_bytes_cumulative: "1000",
            ingress_bytes_cumulative: "999"
          }
        }
      })
    }),
    code("E_RESOURCE_REPLAY")
  );
  assert.throws(
    () => prepareResourceUsageReceipt({
      offer,
      lease,
      previous_receipts: [first],
      body: usageBody(leaseId, {
        observed_at_ms: "1300",
        previous_receipt_id: "resource-usage:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        receipt_sequence: "1"
      })
    }),
    code("E_RESOURCE_REPLAY")
  );
});

test("one signed offer is single-use and conflicting mutual leases are equivocation", () => {
  const provider = actor();
  const firstConsumer = actor();
  const secondConsumer = actor();
  const offer = signedOffer(provider);
  const offerId = verifyResourceOffer(offer).offer_id;
  const first = signedLease(provider, firstConsumer, offer, leaseBody(offerId, firstConsumer));
  const second = signedLease(
    provider,
    secondConsumer,
    offer,
    leaseBody(offerId, secondConsumer, { lease_nonce: nonce(9) })
  );
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: [],
      offer,
      leases: [first, second],
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_EQUIVOCATION")
  );
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: [],
      offer,
      leases: [first, first],
      usage_receipts: [],
      revocations: [],
      observed_at_ms: "1200"
    }),
    code("E_RESOURCE_REPLAY")
  );
});

test("network-visible witness quorum gates activation and gossip is idempotent", () => {
  const provider = actor();
  const consumer = actor();
  const witnesses = [actor(), actor(), actor(), actor()];
  const offer = signedOffer(provider, offerBody(provider, {
    witness_policy: witnessPolicy(witnesses)
  }));
  const offerId = verifyResourceOffer(offer).offer_id;
  const lease = signedLease(provider, consumer, offer, leaseBody(offerId, consumer));
  const announcements = witnesses.map((witness) =>
    consumptionAnnouncement(witness, offer, lease));

  const none = evaluateResourceContract({
    consumption_announcements: [],
    offer,
    leases: [lease],
    observed_at_ms: "1200",
    revocations: [],
    usage_receipts: []
  });
  assert.equal(none.status, "unwitnessed");
  assert.equal(none.witnesses_verified, 0);

  const minority = evaluateResourceContract({
    consumption_announcements: announcements.slice(0, 2),
    offer,
    leases: [lease],
    observed_at_ms: "1200",
    revocations: [],
    usage_receipts: []
  });
  assert.equal(minority.status, "unwitnessed");
  assert.equal(minority.witnesses_verified, 2);

  const quorum = evaluateResourceContract({
    consumption_announcements: [
      announcements[0],
      announcements[0],
      announcements[1],
      announcements[2]
    ],
    offer,
    leases: [],
    observed_at_ms: "1200",
    revocations: [],
    usage_receipts: []
  });
  assert.equal(quorum.status, "active");
  assert.equal(quorum.announcements_verified, 4);
  assert.equal(quorum.witnesses_verified, 3);
  assert.equal(quorum.witness_threshold, 3);

  const opened = verifyResourceConsumptionAnnouncement(announcements[0]);
  assert.equal(opened.offer.offer_id, offerId);
  assert.equal(opened.lease.lease_id, verifyResourceLease({ offer, lease }).lease_id);
  assert.equal(opened.witness.status, "verified");

  const control = createRelayControlMessage(
    "resource-consumption-announcement",
    parseJsonBytes(announcements[0])
  );
  const relayed = decodeRelayMessageBytes(canonicalBytes(control));
  assert.equal(relayed.control.kind, "resource-consumption-announcement");
  assert.equal(
    verifyResourceConsumptionAnnouncement(
      canonicalBytes(relayed.control.content)
    ).consumption_id,
    opened.consumption_id
  );
});

test("partitioned claims halt on provider conflict and expose witness double-sign", () => {
  const provider = actor();
  const firstConsumer = actor();
  const secondConsumer = actor();
  const witnesses = [actor(), actor(), actor(), actor()];
  const offer = signedOffer(provider, offerBody(provider, {
    witness_policy: witnessPolicy(witnesses)
  }));
  const offerId = verifyResourceOffer(offer).offer_id;
  const first = signedLease(
    provider,
    firstConsumer,
    offer,
    leaseBody(offerId, firstConsumer)
  );
  const second = signedLease(
    provider,
    secondConsumer,
    offer,
    leaseBody(offerId, secondConsumer, { lease_nonce: nonce(12) })
  );
  const firstPartition = witnesses.slice(0, 2).map((witness) =>
    consumptionAnnouncement(witness, offer, first));
  const secondPartition = witnesses.slice(2).map((witness) =>
    consumptionAnnouncement(witness, offer, second));

  for (const [lease, announcements] of [
    [first, firstPartition],
    [second, secondPartition]
  ]) {
    assert.equal(evaluateResourceContract({
      consumption_announcements: announcements,
      offer,
      leases: [lease],
      observed_at_ms: "1200",
      revocations: [],
      usage_receipts: []
    }).status, "unwitnessed");
  }

  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: [...firstPartition, ...secondPartition],
      offer,
      leases: [],
      observed_at_ms: "1200",
      revocations: [],
      usage_receipts: []
    }),
    code("E_RESOURCE_EQUIVOCATION")
  );

  const doubleSigned = [
    consumptionAnnouncement(witnesses[0], offer, first),
    consumptionAnnouncement(witnesses[0], offer, second)
  ];
  assert.throws(
    () => evaluateResourceContract({
      consumption_announcements: doubleSigned,
      offer,
      leases: [],
      observed_at_ms: "1200",
      revocations: [],
      usage_receipts: []
    }),
    (error) => code("E_RESOURCE_EQUIVOCATION")(error) &&
      error.detail === "witness-double-sign"
  );
});

test("consumption signing request reuses the existing private sign-once authority", async () => {
  const provider = actor();
  const firstConsumer = actor();
  const secondConsumer = actor();
  const authority = await createContinuityAuthority();
  const otherWitnesses = [actor(), actor(), actor()];
  const witnesses = [
    { ...authority.custodian },
    ...otherWitnesses.map(identity)
  ];
  const offer = signedOffer(provider, offerBody(provider, {
    witness_policy: witnessPolicy(witnesses)
  }));
  const offerId = verifyResourceOffer(offer).offer_id;
  const first = signedLease(
    provider,
    firstConsumer,
    offer,
    leaseBody(offerId, firstConsumer)
  );
  const second = signedLease(
    provider,
    secondConsumer,
    offer,
    leaseBody(offerId, secondConsumer, { lease_nonce: nonce(13) })
  );
  const firstDraft = prepareResourceConsumptionWitness({
    offer,
    lease: first,
    witness_key_id: authority.custodian.key_id
  });
  const signed = await authority.sign(firstDraft.signing_request);
  const evidence = finalizeResourceConsumptionWitness({
    offer,
    lease: first,
    witness_key_id: authority.custodian.key_id,
    witness_signature: signed.signature
  });
  assert.equal(
    verifyResourceConsumptionWitness({ offer, lease: first, witness: evidence }).status,
    "verified"
  );

  const conflict = prepareResourceConsumptionWitness({
    offer,
    lease: second,
    witness_key_id: authority.custodian.key_id
  });
  assert.equal(firstDraft.signing_request.tuple, conflict.signing_request.tuple);
  assert.notDeepEqual(firstDraft.signing_message, conflict.signing_message);
  await assert.rejects(
    authority.sign(conflict.signing_request),
    (error) => error?.code === "E_CONTINUITY_EQUIVOCATION"
  );
});

test("provider offer revocation has deterministic earliest-effect semantics", () => {
  const provider = actor();
  const offer = signedOffer(provider);
  const offerId = verifyResourceOffer(offer).offer_id;
  const later = signedRevocation(provider, offer, null, {
    actor_key_id: provider.key_id,
    effective_at_ms: "1600",
    reason: "resource-withdrawn",
    revocation_nonce: nonce(4),
    target_id: offerId,
    target_kind: "offer"
  });
  const earlier = signedRevocation(provider, offer, null, {
    actor_key_id: provider.key_id,
    effective_at_ms: "1500",
    reason: "capacity-loss",
    revocation_nonce: nonce(5),
    target_id: offerId,
    target_kind: "offer"
  });
  assert.equal(evaluateResourceContract({
    consumption_announcements: [],
    offer,
    leases: [],
    usage_receipts: [],
    revocations: [later, earlier],
    observed_at_ms: "1550"
  }).status, "revoked");
});

test("resource contract bundles for a browser target without ambient authority", async () => {
  const bundled = await build({
    entryPoints: ["sdk/resource-contract.mjs"],
    bundle: true,
    format: "iife",
    globalName: "MortalOSResourceContract",
    platform: "browser",
    target: ["es2022"],
    write: false
  });
  const sandbox = { ArrayBuffer, BigInt, DataView, SharedArrayBuffer, TextDecoder, TextEncoder, Uint8Array };
  vm.runInNewContext(bundled.outputFiles[0].text, sandbox, { timeout: 30_000 });
  assert.equal(
    typeof sandbox.MortalOSResourceContract.evaluateResourceContract,
    "function"
  );
  assert.doesNotMatch(
    bundled.outputFiles[0].text,
    /(?:node:|process\.|require\(|WebSocket|Date\.now)/u
  );
});
