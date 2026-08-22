import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { encodeBase64Url } from "../src/bytes.mjs";
import {
  derivePeerId,
  resourceExecutionPayloadDigest
} from "../src/crypto.mjs";
import {
  createResourceConsumptionAnnouncement,
  finalizeResourceConsumptionWitness,
  finalizeResourceLease,
  finalizeResourceOffer,
  finalizeResourceUsageReceipt,
  prepareResourceConsumptionWitness,
  prepareResourceLease,
  prepareResourceOffer,
  prepareResourceUsageReceipt
} from "../src/resource-contract.mjs";
import {
  RESOURCE_EXECUTION_LIMITS,
  createResourceBandwidthExecutionResult,
  createResourceComputeExecutionResult,
  createResourceContentCommitment,
  createResourceStoragePossessionProof,
  createResourceStorageExecutionResult,
  evaluateResourceExecutionContract,
  finalizeResourceExecutionChallenge,
  finalizeResourceExecutionReceipt,
  prepareResourceExecutionChallenge,
  prepareResourceExecutionReceipt,
  verifyResourceExecutionChallenge,
  verifyResourceExecutionReceipt,
  verifyResourceStoragePossessionProof
} from "../src/resource-execution.mjs";

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function identity(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

function signature(value, message) {
  return `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}`;
}

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed));
}

function allocation() {
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
    storage: { capacity_bytes: "4194304", max_object_bytes: "4194304" }
  };
}

function usage(leaseId, sequence, observedAt, previous, values) {
  return {
    lease_id: leaseId,
    observed_at_ms: String(observedAt),
    previous_receipt_id: previous?.receipt_id ?? null,
    receipt_sequence: String(sequence),
    usage: {
      bandwidth: {
        egress_bytes_cumulative: String(values.egress),
        ingress_bytes_cumulative: String(values.ingress)
      },
      compute: {
        concurrency_peak: values.cpu === 0 ? "0" : "1",
        cpu_millis_cumulative: String(values.cpu),
        memory_bytes_peak: values.cpu === 0 ? "0" : "4096",
        task_millis_peak: values.cpu === 0 ? "0" : "10"
      },
      storage: {
        bytes_current: String(values.storage),
        bytes_peak: String(values.storage)
      }
    }
  };
}

function signedFixture() {
  const provider = actor();
  const consumer = actor();
  const witnessActors = [actor(), actor(), actor(), actor()]
    .sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  const offerDraft = prepareResourceOffer({
    capacity: allocation(),
    expires_at_ms: "5000",
    offer_nonce: nonce(1),
    provider: identity(provider),
    valid_from_ms: "1000",
    witness_policy: {
      max_faulty: 1,
      threshold: 3,
      witnesses: witnessActors.map(identity)
    }
  });
  const offer = finalizeResourceOffer({
    body: offerDraft.body,
    provider_signature: signature(provider, offerDraft.provider_signing_message)
  });
  const leaseDraft = prepareResourceLease({
    offer,
    body: {
      allocation: allocation(),
      consumer: identity(consumer),
      ends_at_ms: "4900",
      lease_nonce: nonce(2),
      offer_id: offerDraft.offer_id,
      starts_at_ms: "1100"
    }
  });
  const lease = finalizeResourceLease({
    offer,
    body: leaseDraft.body,
    consumer_signature: signature(consumer, leaseDraft.consumer_signing_message),
    provider_signature: signature(provider, leaseDraft.provider_signing_message)
  });
  const announcements = witnessActors.slice(0, 3).map((witness) => {
    const draft = prepareResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.key_id
    });
    const witnessBytes = finalizeResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.key_id,
      witness_signature: signature(witness, draft.signing_message)
    });
    return createResourceConsumptionAnnouncement({ offer, lease, witness: witnessBytes });
  });
  return { announcements, consumer, lease, offer, provider };
}

function signedUsage(fixture, priorBytes, body) {
  const draft = prepareResourceUsageReceipt({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_receipts: priorBytes,
    body
  });
  return finalizeResourceUsageReceipt({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_receipts: priorBytes,
    body: draft.body,
    consumer_signature: signature(fixture.consumer, draft.consumer_signing_message),
    provider_signature: signature(fixture.provider, draft.provider_signing_message)
  });
}

function signedChallenge(fixture, executions, usages, body) {
  const draft = prepareResourceExecutionChallenge({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    body
  });
  return finalizeResourceExecutionChallenge({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    body: draft.body,
    consumer_signature: signature(fixture.consumer, draft.consumer_signing_message)
  });
}

function signedExecution(fixture, executions, usages, challenge, result) {
  const draft = prepareResourceExecutionReceipt({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    challenge,
    result
  });
  return finalizeResourceExecutionReceipt({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: usages,
    challenge,
    result,
    consumer_signature: signature(fixture.consumer, draft.consumer_signing_message),
    provider_signature: signature(fixture.provider, draft.provider_signing_message)
  });
}

function baseChallenge(fixture, executions, sequence, kind, issuedAt, workload) {
  return {
    challenge_nonce: nonce(10 + sequence),
    challenge_sequence: String(sequence),
    consumption_id: executions.length === 0
      ? evaluateResourceExecutionContract({
          consumption_announcements: fixture.announcements,
          offer: fixture.offer,
          leases: [fixture.lease],
          observed_at_ms: "1150",
          usage_receipts: [],
          revocations: [],
          execution_receipts: []
        }).consumption_id
      : verifyResourceExecutionReceipt({
          offer: fixture.offer,
          lease: fixture.lease,
          previous_execution_receipts: executions.slice(0, -1),
          usage_receipts: fixture.usages.slice(0, executions.length),
          receipt: executions.at(-1)
        }).body.consumption_id,
    issued_at_ms: String(issuedAt),
    kind,
    lease_id: fixture.leaseId,
    offer_id: fixture.offerId,
    previous_execution_receipt_id: executions.length === 0
      ? null
      : fixture.executionIds.at(-1),
    workload
  };
}

async function completeVertical() {
  const fixture = signedFixture();
  const openedOffer = JSON.parse(new TextDecoder().decode(fixture.offer));
  const openedLease = JSON.parse(new TextDecoder().decode(fixture.lease));
  fixture.offerId = openedOffer.offer_id;
  fixture.leaseId = openedLease.lease_id;
  fixture.usages = [];
  fixture.executionIds = [];
  const executions = [];
  const resource = new Uint8Array(8_193);
  for (let index = 0; index < resource.length; index += 1) resource[index] = index & 0xff;

  const storageWorkload = createResourceContentCommitment(resource);
  const storageChallenge = signedChallenge(
    fixture,
    executions,
    fixture.usages,
    baseChallenge(fixture, executions, 0, "storage", 1200, storageWorkload)
  );
  const storageResult = createResourceStorageExecutionResult({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: fixture.usages,
    challenge: storageChallenge,
    resource_bytes: resource
  });
  const usage0 = signedUsage(
    fixture,
    fixture.usages,
    usage(fixture.leaseId, 0, 1201, null, {
      cpu: 0, egress: 0, ingress: 0, storage: resource.length
    })
  );
  fixture.usages.push(usage0);
  const execution0 = signedExecution(
    fixture,
    executions,
    fixture.usages,
    storageChallenge,
    storageResult
  );
  executions.push(execution0);
  fixture.executionIds.push(JSON.parse(new TextDecoder().decode(execution0)).receipt_id);

  const payload = new Uint8Array(257).fill(7);
  const bandwidthWorkload = {
    payload_base64url: encodeBase64Url(payload),
    payload_digest: resourceExecutionPayloadDigest(payload),
    payload_size: String(payload.length)
  };
  const bandwidthChallenge = signedChallenge(
    fixture,
    executions,
    fixture.usages,
    baseChallenge(fixture, executions, 1, "bandwidth", 1300, bandwidthWorkload)
  );
  const bandwidthResult = createResourceBandwidthExecutionResult({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: fixture.usages,
    challenge: bandwidthChallenge,
    echoed_payload: payload
  });
  const usage1 = signedUsage(
    fixture,
    fixture.usages,
    usage(
      fixture.leaseId,
      1,
      1301,
      { receipt_id: JSON.parse(new TextDecoder().decode(usage0)).receipt_id },
      { cpu: 0, egress: payload.length, ingress: payload.length, storage: resource.length }
    )
  );
  fixture.usages.push(usage1);
  const execution1 = signedExecution(
    fixture,
    executions,
    fixture.usages,
    bandwidthChallenge,
    bandwidthResult
  );
  executions.push(execution1);
  fixture.executionIds.push(JSON.parse(new TextDecoder().decode(execution1)).receipt_id);

  const input = new Uint8Array([1, 2, 3, 4]);
  const computeWorkload = {
    algorithm: "sha256-chain/1",
    input_base64url: encodeBase64Url(input),
    iterations: "32"
  };
  const computeChallenge = signedChallenge(
    fixture,
    executions,
    fixture.usages,
    baseChallenge(fixture, executions, 2, "compute", 1400, computeWorkload)
  );
  const computeResult = createResourceComputeExecutionResult({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: executions,
    usage_receipts: fixture.usages,
    challenge: computeChallenge
  });
  const usage2 = signedUsage(
    fixture,
    fixture.usages,
    usage(
      fixture.leaseId,
      2,
      1401,
      { receipt_id: JSON.parse(new TextDecoder().decode(usage1)).receipt_id },
      { cpu: 10, egress: payload.length, ingress: payload.length, storage: resource.length }
    )
  );
  fixture.usages.push(usage2);
  const execution2 = signedExecution(
    fixture,
    executions,
    fixture.usages,
    computeChallenge,
    computeResult
  );
  executions.push(execution2);
  fixture.executionIds.push(JSON.parse(new TextDecoder().decode(execution2)).receipt_id);
  return {
    bandwidthChallenge,
    computeChallenge,
    executions,
    fixture,
    resource,
    storageChallenge,
    usage2
  };
}

test("lease-bound receipts prove actual storage, bandwidth, and deterministic compute", async () => {
  const completed = await completeVertical();
  const evaluated = evaluateResourceExecutionContract({
    consumption_announcements: completed.fixture.announcements,
    offer: completed.fixture.offer,
    leases: [completed.fixture.lease],
    observed_at_ms: "1500",
    usage_receipts: completed.fixture.usages,
    revocations: [],
    execution_receipts: completed.executions
  });
  assert.equal(evaluated.status, "active");
  assert.equal(evaluated.execution_status, "proved");
  assert.equal(evaluated.executions_verified, 3);
  assert.equal(evaluated.last_execution_receipt_id, completed.fixture.executionIds.at(-1));

  const announcementOnly = evaluateResourceExecutionContract({
    consumption_announcements: completed.fixture.announcements,
    offer: completed.fixture.offer,
    leases: [],
    observed_at_ms: "1500",
    usage_receipts: completed.fixture.usages,
    revocations: [],
    execution_receipts: completed.executions
  });
  assert.equal(announcementOnly.status, "active");
  assert.equal(announcementOnly.execution_status, "proved");
  assert.equal(announcementOnly.executions_verified, 3);
  assert.equal(
    announcementOnly.last_execution_receipt_id,
    completed.fixture.executionIds.at(-1)
  );
});

test("replay, fork, cross-lease, tampering, and usage without execution fail closed", async () => {
  const completed = await completeVertical();
  assert.throws(
    () => evaluateResourceExecutionContract({
      consumption_announcements: completed.fixture.announcements,
      offer: completed.fixture.offer,
      leases: [completed.fixture.lease],
      observed_at_ms: "1500",
      usage_receipts: completed.fixture.usages,
      revocations: [],
      execution_receipts: completed.executions.slice(0, 2)
    }),
    { code: "E_RESOURCE_EXECUTION" }
  );
  assert.throws(
    () => evaluateResourceExecutionContract({
      consumption_announcements: completed.fixture.announcements,
      offer: completed.fixture.offer,
      leases: [completed.fixture.lease],
      observed_at_ms: "1500",
      usage_receipts: [...completed.fixture.usages, completed.usage2],
      revocations: [],
      execution_receipts: [...completed.executions, completed.executions.at(-1)]
    }),
    { code: "E_RESOURCE_REPLAY" }
  );
  const tampered = JSON.parse(new TextDecoder().decode(completed.executions[0]));
  tampered.body.result.leaf_bytes_base64url = encodeBase64Url(new Uint8Array(4096));
  assert.throws(
    () => verifyResourceExecutionReceipt({
      offer: completed.fixture.offer,
      lease: completed.fixture.lease,
      previous_execution_receipts: [],
      usage_receipts: [completed.fixture.usages[0]],
      receipt: new TextEncoder().encode(JSON.stringify(tampered))
    }),
    { code: "E_RESOURCE_EXECUTION" }
  );
  assert.throws(
    () => verifyResourceExecutionChallenge({
      offer: completed.fixture.offer,
      lease: completed.fixture.lease,
      previous_execution_receipts: [],
      usage_receipts: [],
      challenge: completed.bandwidthChallenge
    }),
    { code: "E_RESOURCE_REPLAY" }
  );
});

test("execution ceilings accept exact maxima and reject every relevant maximum plus one", () => {
  assert.equal(RESOURCE_EXECUTION_LIMITS.resource_bytes, 4_194_304);
  assert.equal(RESOURCE_EXECUTION_LIMITS.leaf_bytes, 4_096);
  assert.equal(RESOURCE_EXECUTION_LIMITS.input_bytes, 4_096);
  assert.equal(RESOURCE_EXECUTION_LIMITS.compute_iterations_max, 4_096);
  assert.throws(
    () => createResourceContentCommitment(
      new Uint8Array(RESOURCE_EXECUTION_LIMITS.resource_bytes + 1)
    ),
    { code: "E_RESOURCE_LIMIT" }
  );
  const exact = createResourceContentCommitment(
    new Uint8Array(RESOURCE_EXECUTION_LIMITS.resource_bytes)
  );
  assert.equal(exact.resource_size, String(RESOURCE_EXECUTION_LIMITS.resource_bytes));
  assert.equal(
    exact.leaf_count,
    String(RESOURCE_EXECUTION_LIMITS.resource_bytes / RESOURCE_EXECUTION_LIMITS.leaf_bytes)
  );
});

test("challenge input, leaf, and compute ceilings are exact and fail at plus one", () => {
  const fixture = signedFixture();
  const announcement = JSON.parse(new TextDecoder().decode(fixture.announcements[0]));
  const offer = JSON.parse(new TextDecoder().decode(fixture.offer));
  const lease = JSON.parse(new TextDecoder().decode(fixture.lease));
  const body = (kind, workload) => ({
    challenge_nonce: nonce(77),
    challenge_sequence: "0",
    consumption_id: announcement.witness.body.consumption_id,
    issued_at_ms: "1200",
    kind,
    lease_id: lease.lease_id,
    offer_id: offer.offer_id,
    previous_execution_receipt_id: null,
    workload
  });
  const draft = (kind, workload) => prepareResourceExecutionChallenge({
    offer: fixture.offer,
    lease: fixture.lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    body: body(kind, workload)
  });
  const exactPayload = new Uint8Array(RESOURCE_EXECUTION_LIMITS.input_bytes);
  assert.match(draft("bandwidth", {
    payload_base64url: encodeBase64Url(exactPayload),
    payload_digest: resourceExecutionPayloadDigest(exactPayload),
    payload_size: String(exactPayload.length)
  }).challenge_id, /^resource-challenge:/u);
  assert.throws(() => {
    const plusOne = new Uint8Array(RESOURCE_EXECUTION_LIMITS.input_bytes + 1);
    draft("bandwidth", {
      payload_base64url: encodeBase64Url(plusOne),
      payload_digest: resourceExecutionPayloadDigest(plusOne),
      payload_size: String(plusOne.length)
    });
  }, { code: "E_RESOURCE_LIMIT" });
  assert.match(draft("compute", {
    algorithm: "sha256-chain/1",
    input_base64url: "",
    iterations: String(RESOURCE_EXECUTION_LIMITS.compute_iterations_max)
  }).challenge_id, /^resource-challenge:/u);
  assert.throws(() => draft("compute", {
    algorithm: "sha256-chain/1",
    input_base64url: "",
    iterations: String(RESOURCE_EXECUTION_LIMITS.compute_iterations_max + 1)
  }), { code: "E_RESOURCE_DECIMAL" });
  const commitment = createResourceContentCommitment(new Uint8Array([1]));
  assert.throws(() => draft("storage", {
    ...commitment,
    leaf_bytes: String(RESOURCE_EXECUTION_LIMITS.leaf_bytes + 1)
  }), { code: "E_RESOURCE_DECIMAL" });
});

test("accessors and Proxies cannot smuggle execution options", async () => {
  const completed = await completeVertical();
  const options = {
    offer: completed.fixture.offer,
    lease: completed.fixture.lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    challenge: completed.storageChallenge
  };
  Object.defineProperty(options, "challenge", {
    enumerable: true,
    get() { return completed.storageChallenge; }
  });
  assert.throws(() => verifyResourceExecutionChallenge(options), { code: "E_RESOURCE_FORMAT" });
  assert.throws(
    () => verifyResourceExecutionChallenge(new Proxy({}, {
      ownKeys() { throw new Error("trap"); }
    })),
    { code: "E_RESOURCE_FORMAT" }
  );
});

test("storage possession helpers bind the challenge-selected leaf, lease, workload, and owned resource bytes", async () => {
  const completed = await completeVertical();
  const resource = new Uint8Array(150_000);
  for (let index = 0; index < resource.length; index += 1) resource[index] = index & 0xff;
  const workload = createResourceContentCommitment(resource);
  const options = {
    challenge_nonce: nonce(231),
    lease_id: completed.fixture.leaseId,
    resource_bytes: resource,
    workload
  };
  const proof = createResourceStoragePossessionProof(options);
  assert.doesNotThrow(() => verifyResourceStoragePossessionProof({
    challenge_nonce: options.challenge_nonce,
    lease_id: options.lease_id,
    proof,
    workload
  }));
  let differentLeafNonce = null;
  for (let seed = 0; seed < 256; seed += 1) {
    const candidateNonce = nonce(seed);
    if (candidateNonce === options.challenge_nonce) continue;
    const candidateProof = createResourceStoragePossessionProof({
      ...options,
      challenge_nonce: candidateNonce
    });
    if (candidateProof.leaf_index !== proof.leaf_index) {
      differentLeafNonce = candidateNonce;
      break;
    }
  }
  assert.notEqual(differentLeafNonce, null, "expected another nonce to select a different leaf");
  assert.throws(() => verifyResourceStoragePossessionProof({
    challenge_nonce: differentLeafNonce,
    lease_id: options.lease_id,
    proof,
    workload
  }), { code: "E_RESOURCE_EXECUTION" });
  assert.throws(() => createResourceStoragePossessionProof(new Proxy(options, {
    ownKeys() { throw new Error("trap"); }
  })), { code: "E_RESOURCE_FORMAT" });
  const shared = new Uint8Array(new SharedArrayBuffer(resource.byteLength));
  shared.set(resource);
  assert.throws(() => createResourceStoragePossessionProof({
    ...options,
    resource_bytes: shared
  }), { code: "E_RESOURCE_FORMAT" });
});

test("lease-bound execution core bundles for a browser target without ambient authority", async () => {
  const result = await build({
    bundle: true,
    entryPoints: ["src/resource-execution.mjs"],
    format: "iife",
    globalName: "MortalOSExecution",
    platform: "browser",
    write: false
  });
  const code = result.outputFiles[0].text;
  assert.doesNotMatch(code, /node:crypto|node:fs|process\.env|fetch\(|WebSocket/u);
  const sandbox = {
    ArrayBuffer, BigInt, DataView, SharedArrayBuffer,
    TextDecoder, TextEncoder, Uint8Array
  };
  vm.runInNewContext(code, sandbox);
  assert.equal(typeof sandbox.MortalOSExecution.verifyResourceExecutionReceipt, "function");
  assert.equal(typeof sandbox.MortalOSExecution.createResourceComputeExecutionResult, "function");
});
