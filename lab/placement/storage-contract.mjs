import {
  decodeBase64Url,
  encodeBase64Url
} from "../../src/bytes.mjs";
import {
  derivePeerId,
  deriveResourceExecutionWorkloadId
} from "../../src/crypto.mjs";
import {
  createResourceConsumptionAnnouncement,
  finalizeResourceConsumptionWitness,
  finalizeResourceLease,
  finalizeResourceOffer,
  finalizeResourceUsageReceipt,
  prepareResourceConsumptionWitness,
  prepareResourceLease,
  prepareResourceOffer,
  prepareResourceUsageReceipt,
  verifyResourceUsageReceipt
} from "../../src/resource-contract.mjs";
import {
  createResourceContentCommitment,
  createResourceStorageExecutionResult,
  evaluateResourceExecutionContract,
  finalizeResourceExecutionChallenge,
  finalizeResourceExecutionReceipt,
  prepareResourceExecutionChallenge,
  prepareResourceExecutionReceipt,
  verifyResourceExecutionReceipt
} from "../../src/resource-execution.mjs";

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed & 0xff));
}

function allocation(resourceSize) {
  const capacity = String(Math.max(4_194_304, resourceSize));
  return {
    bandwidth: {
      burst_bytes: "4096",
      egress_bytes_total: "100000",
      ingress_bytes_total: "100000",
      rate_bytes_per_second: "100000"
    },
    compute: {
      concurrency: "1",
      cpu_millis_total: "100000",
      memory_bytes: "1048576",
      task_millis_max: "10000"
    },
    storage: { capacity_bytes: capacity, max_object_bytes: capacity }
  };
}

export async function createPlacementSigner() {
  const pair = await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const publicKey = `ed25519:${encodeBase64Url(publicKeyBytes)}`;
  const identity = Object.freeze({ key_id: derivePeerId(publicKey), public_key: publicKey });
  let privateKey = pair.privateKey;
  return Object.freeze({
    identity,
    async sign(message) {
      if (!privateKey) throw new Error("E_PLACEMENT_AUTHORITY: destroyed");
      const signature = await crypto.subtle.sign("Ed25519", privateKey, new Uint8Array(message));
      return `ed25519:${encodeBase64Url(new Uint8Array(signature))}`;
    },
    destroy() { privateKey = null; }
  });
}

export async function createStoragePlacementFixture({
  challengeNonce = null,
  challengeNonceFactory = null,
  consumer,
  provider,
  resourceBytes,
  seed,
  witnesses
}) {
  if (!consumer?.identity || !provider?.identity || !Array.isArray(witnesses) || witnesses.length !== 4) {
    throw new TypeError("consumer, provider, and four witness signers required");
  }
  if (challengeNonce !== null && challengeNonceFactory !== null) {
    throw new TypeError("provide either challengeNonce or challengeNonceFactory");
  }
  const resource = new Uint8Array(resourceBytes);
  if (typeof provider.store === "function") await provider.store(resource);
  const capacity = allocation(resource.byteLength);
  const sortedWitnesses = [...witnesses].sort((left, right) =>
    left.identity.key_id < right.identity.key_id ? -1 : 1);
  const offerDraft = prepareResourceOffer({
    capacity,
    expires_at_ms: "9000",
    offer_nonce: nonce(seed),
    provider: provider.identity,
    valid_from_ms: "1000",
    witness_policy: {
      max_faulty: 1,
      threshold: 3,
      witnesses: sortedWitnesses.map((witness) => witness.identity)
    }
  });
  const offer = finalizeResourceOffer({
    body: offerDraft.body,
    provider_signature: await provider.sign(offerDraft.provider_signing_message)
  });
  const leaseDraft = prepareResourceLease({
    offer,
    body: {
      allocation: capacity,
      consumer: consumer.identity,
      ends_at_ms: "8900",
      lease_nonce: nonce(seed + 1),
      offer_id: offerDraft.offer_id,
      starts_at_ms: "1100"
    }
  });
  const lease = finalizeResourceLease({
    offer,
    body: leaseDraft.body,
    consumer_signature: await consumer.sign(leaseDraft.consumer_signing_message),
    provider_signature: await provider.sign(leaseDraft.provider_signing_message)
  });
  const announcements = [];
  for (const witness of sortedWitnesses.slice(0, 3)) {
    const draft = prepareResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.identity.key_id
    });
    const witnessBytes = finalizeResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.identity.key_id,
      witness_signature: await witness.sign(draft.signing_message)
    });
    announcements.push(createResourceConsumptionAnnouncement({ offer, lease, witness: witnessBytes }));
  }
  const activation = evaluateResourceExecutionContract({
    consumption_announcements: announcements,
    offer,
    leases: [lease],
    observed_at_ms: "1200",
    usage_receipts: [],
    revocations: [],
    execution_receipts: []
  });
  const workload = createResourceContentCommitment(resource);
  const openedOffer = JSON.parse(new TextDecoder().decode(offer));
  const openedLease = JSON.parse(new TextDecoder().decode(lease));
  const challengeIdentity = Object.freeze({
    challenge_sequence: "0",
    lease_id: openedLease.lease_id,
    previous_execution_receipt_id: null,
    provider_id: provider.identity.key_id,
    workload_id: deriveResourceExecutionWorkloadId({ kind: "storage", workload })
  });
  const resolvedChallengeNonce = challengeNonceFactory === null
    ? (challengeNonce ?? nonce(seed + 2))
    : await challengeNonceFactory(challengeIdentity);
  const challengeDraft = prepareResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    body: {
      challenge_nonce: resolvedChallengeNonce,
      challenge_sequence: "0",
      consumption_id: activation.consumption_id,
      issued_at_ms: "1300",
      kind: "storage",
      lease_id: openedLease.lease_id,
      offer_id: openedOffer.offer_id,
      previous_execution_receipt_id: null,
      workload
    }
  });
  const challenge = finalizeResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    body: challengeDraft.body,
    consumer_signature: await consumer.sign(challengeDraft.consumer_signing_message)
  });
  const executionOptions = {
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    challenge
  };
  const result = typeof provider.createStorageResult === "function"
    ? await provider.createStorageResult(executionOptions)
    : createResourceStorageExecutionResult({ ...executionOptions, resource_bytes: resource });
  const usageDraft = prepareResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: [],
    body: {
      lease_id: openedLease.lease_id,
      observed_at_ms: "1301",
      previous_receipt_id: null,
      receipt_sequence: "0",
      usage: {
        bandwidth: { egress_bytes_cumulative: "0", ingress_bytes_cumulative: "0" },
        compute: {
          concurrency_peak: "0",
          cpu_millis_cumulative: "0",
          memory_bytes_peak: "0",
          task_millis_peak: "0"
        },
        storage: {
          bytes_current: String(resource.byteLength),
          bytes_peak: String(resource.byteLength)
        }
      }
    }
  });
  const usageReceipt = finalizeResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: [],
    body: usageDraft.body,
    consumer_signature: await consumer.sign(usageDraft.consumer_signing_message),
    provider_signature: await provider.sign(usageDraft.provider_signing_message)
  });
  const receiptDraft = prepareResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [usageReceipt],
    challenge,
    result
  });
  const executionReceipt = finalizeResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [usageReceipt],
    challenge,
    result,
    consumer_signature: await consumer.sign(receiptDraft.consumer_signing_message),
    provider_signature: await provider.sign(receiptDraft.provider_signing_message)
  });
  return Object.freeze({
    expected_workload_id: deriveResourceExecutionWorkloadId({ kind: "storage", workload }),
    placement: Object.freeze({
      consumption_announcements: Object.freeze(announcements),
      execution_receipts: Object.freeze([executionReceipt]),
      lease,
      observed_at_ms: "1500",
      offer,
      revocations: Object.freeze([]),
      usage_receipts: Object.freeze([usageReceipt])
    }),
    provider_id: provider.identity.key_id,
    resource: encodeBase64Url(resource),
    resource_bytes: resource
  });
}

export async function refreshStoragePlacementFixture({
  challengeNonce = null,
  challengeNonceFactory = null,
  consumer,
  fixture,
  issuedAtMs,
  provider,
  resourceBytes,
  seed
}) {
  if (!consumer?.identity || !provider?.identity || !fixture?.placement) {
    throw new TypeError("consumer, provider, and prior placement fixture required");
  }
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 1302 || issuedAtMs >= 8900) {
    throw new TypeError("issuedAtMs must remain inside the active lease");
  }
  if (challengeNonce !== null && challengeNonceFactory !== null) {
    throw new TypeError("provide either challengeNonce or challengeNonceFactory");
  }
  const resource = new Uint8Array(resourceBytes);
  const prior = fixture.placement;
  const executions = [...prior.execution_receipts];
  const usages = [...prior.usage_receipts];
  const offer = prior.offer;
  const lease = prior.lease;
  const lastExecution = verifyResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: executions.slice(0, -1),
    usage_receipts: usages,
    receipt: executions.at(-1)
  });
  const lastUsage = verifyResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: usages.slice(0, -1),
    receipt: usages.at(-1)
  });
  const openedOffer = JSON.parse(new TextDecoder().decode(offer));
  const openedLease = JSON.parse(new TextDecoder().decode(lease));
  const sequence = executions.length;
  const workload = createResourceContentCommitment(resource);
  const challengeIdentity = Object.freeze({
    challenge_sequence: String(sequence),
    lease_id: openedLease.lease_id,
    previous_execution_receipt_id: lastExecution.receipt_id,
    provider_id: provider.identity.key_id,
    workload_id: deriveResourceExecutionWorkloadId({ kind: "storage", workload })
  });
  const resolvedChallengeNonce = challengeNonceFactory === null
    ? (challengeNonce ?? nonce(seed))
    : await challengeNonceFactory(challengeIdentity);
  const challengeDraft = prepareResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    body: {
      challenge_nonce: resolvedChallengeNonce,
      challenge_sequence: String(sequence),
      consumption_id: lastExecution.body.consumption_id,
      issued_at_ms: String(issuedAtMs),
      kind: "storage",
      lease_id: openedLease.lease_id,
      offer_id: openedOffer.offer_id,
      previous_execution_receipt_id: lastExecution.receipt_id,
      workload
    }
  });
  const challenge = finalizeResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    body: challengeDraft.body,
    consumer_signature: await consumer.sign(challengeDraft.consumer_signing_message)
  });
  const executionOptions = {
    offer,
    lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    challenge
  };
  const result = typeof provider.createStorageResult === "function"
    ? await provider.createStorageResult(executionOptions)
    : createResourceStorageExecutionResult({ ...executionOptions, resource_bytes: resource });
  const usageDraft = prepareResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: usages,
    body: {
      lease_id: openedLease.lease_id,
      observed_at_ms: String(issuedAtMs + 1),
      previous_receipt_id: lastUsage.receipt_id,
      receipt_sequence: String(usages.length),
      usage: {
        bandwidth: { egress_bytes_cumulative: "0", ingress_bytes_cumulative: "0" },
        compute: {
          concurrency_peak: "0",
          cpu_millis_cumulative: "0",
          memory_bytes_peak: "0",
          task_millis_peak: "0"
        },
        storage: {
          bytes_current: String(resource.byteLength),
          bytes_peak: String(resource.byteLength)
        }
      }
    }
  });
  const usageReceipt = finalizeResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: usages,
    body: usageDraft.body,
    consumer_signature: await consumer.sign(usageDraft.consumer_signing_message),
    provider_signature: await provider.sign(usageDraft.provider_signing_message)
  });
  const nextUsages = [...usages, usageReceipt];
  const receiptDraft = prepareResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: executions,
    usage_receipts: nextUsages,
    challenge,
    result
  });
  const executionReceipt = finalizeResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: executions,
    usage_receipts: nextUsages,
    challenge,
    result,
    consumer_signature: await consumer.sign(receiptDraft.consumer_signing_message),
    provider_signature: await provider.sign(receiptDraft.provider_signing_message)
  });
  const nextExecutions = [...executions, executionReceipt];
  return Object.freeze({
    ...fixture,
    placement: Object.freeze({
      ...prior,
      execution_receipts: Object.freeze(nextExecutions),
      observed_at_ms: String(issuedAtMs + 2),
      usage_receipts: Object.freeze(nextUsages)
    })
  });
}

export function decodePlacementResource(value) {
  return decodeBase64Url(value);
}
