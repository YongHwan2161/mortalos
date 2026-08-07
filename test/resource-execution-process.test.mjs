import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { encodeBase64Url } from "../src/bytes.mjs";
import { derivePeerId, resourceExecutionPayloadDigest } from "../src/crypto.mjs";
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
  createResourceContentCommitment,
  finalizeResourceExecutionChallenge,
  finalizeResourceExecutionReceipt,
  prepareResourceExecutionChallenge,
  prepareResourceExecutionReceipt,
  verifyResourceExecutionReceipt
} from "../src/resource-execution.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function localActor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function identity(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

function localSignature(value, message) {
  return `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}`;
}

function encoded(value) {
  return encodeBase64Url(value);
}

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed));
}

function parsed(bytes) {
  return JSON.parse(decoder.decode(bytes));
}

async function startProvider() {
  const child = fork(new URL("./resource-execution-node-endpoint.mjs", import.meta.url), [], {
    serialization: "json",
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  let nextId = 1;
  const pending = new Map();
  let stopped = false;
  const ready = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.on("message", (message) => {
      if (message.ready) {
        resolve(message.identity);
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.ok) waiter.resolve(message.value);
      else waiter.reject(Object.assign(new Error(message.error.message), message.error));
    });
  });
  const actor = {
    child,
    identity: await ready,
    async call(type, payload = {}) {
      if (stopped || !child.connected) throw new Error("provider endpoint unavailable");
      const id = nextId++;
      const response = new Promise((resolve, reject) => pending.set(id, { reject, resolve }));
      child.send({ id, type, ...payload });
      return response;
    },
    async sign(message) {
      return actor.call("sign", { message: encoded(message) });
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
      for (const waiter of pending.values()) waiter.reject(new Error("provider endpoint exited"));
      pending.clear();
    }
  };
  return actor;
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

async function contract(provider, consumer, witnesses, seed) {
  const offerDraft = prepareResourceOffer({
    capacity: allocation(),
    expires_at_ms: "5000",
    offer_nonce: nonce(seed),
    provider: provider.identity,
    valid_from_ms: "1000",
    witness_policy: {
      max_faulty: 1,
      threshold: 3,
      witnesses: witnesses.map(identity).sort((left, right) => left.key_id < right.key_id ? -1 : 1)
    }
  });
  const offer = finalizeResourceOffer({
    body: offerDraft.body,
    provider_signature: await provider.sign(offerDraft.provider_signing_message)
  });
  const leaseDraft = prepareResourceLease({
    offer,
    body: {
      allocation: allocation(),
      consumer: identity(consumer),
      ends_at_ms: "4900",
      lease_nonce: nonce(seed + 1),
      offer_id: offerDraft.offer_id,
      starts_at_ms: "1100"
    }
  });
  const lease = finalizeResourceLease({
    offer,
    body: leaseDraft.body,
    consumer_signature: localSignature(consumer, leaseDraft.consumer_signing_message),
    provider_signature: await provider.sign(leaseDraft.provider_signing_message)
  });
  const announcements = [];
  for (const witness of witnesses.slice(0, 3)) {
    const draft = prepareResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.key_id
    });
    const evidence = finalizeResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.key_id,
      witness_signature: localSignature(witness, draft.signing_message)
    });
    announcements.push(createResourceConsumptionAnnouncement({ offer, lease, witness: evidence }));
  }
  return {
    announcements,
    consumer,
    executions: [],
    lease,
    leaseId: parsed(lease).lease_id,
    offer,
    offerId: parsed(offer).offer_id,
    provider,
    usages: []
  };
}

function usageBody(state, sequence, time, counters) {
  return {
    lease_id: state.leaseId,
    observed_at_ms: String(time),
    previous_receipt_id: sequence === 0 ? null : parsed(state.usages.at(-1)).receipt_id,
    receipt_sequence: String(sequence),
    usage: {
      bandwidth: {
        egress_bytes_cumulative: String(counters.bandwidth),
        ingress_bytes_cumulative: String(counters.bandwidth)
      },
      compute: {
        concurrency_peak: counters.cpu === 0 ? "0" : "1",
        cpu_millis_cumulative: String(counters.cpu),
        memory_bytes_peak: counters.cpu === 0 ? "0" : "4096",
        task_millis_peak: counters.cpu === 0 ? "0" : "10"
      },
      storage: { bytes_current: String(counters.storage), bytes_peak: String(counters.storage) }
    }
  };
}

async function challenge(state, sequence, time, kind, workload) {
  const body = {
    challenge_nonce: nonce(30 + sequence),
    challenge_sequence: String(sequence),
    consumption_id: state.announcements.length > 0
      ? parsed(state.announcements[0]).witness.body.consumption_id
      : null,
    issued_at_ms: String(time),
    kind,
    lease_id: state.leaseId,
    offer_id: state.offerId,
    previous_execution_receipt_id: sequence === 0
      ? null
      : parsed(state.executions.at(-1)).receipt_id,
    workload
  };
  const draft = prepareResourceExecutionChallenge({
    offer: state.offer,
    lease: state.lease,
    previous_execution_receipts: state.executions,
    usage_receipts: state.usages,
    body
  });
  return finalizeResourceExecutionChallenge({
    offer: state.offer,
    lease: state.lease,
    previous_execution_receipts: state.executions,
    usage_receipts: state.usages,
    body: draft.body,
    consumer_signature: localSignature(state.consumer, draft.consumer_signing_message)
  });
}

async function execute(state, kind, signedChallenge, endpointPayload, counters, time) {
  const wire = {
    offer: encoded(state.offer),
    lease: encoded(state.lease),
    previous_execution_receipts: state.executions.map(encoded),
    usage_receipts: state.usages.map(encoded),
    challenge: encoded(signedChallenge),
    ...endpointPayload
  };
  const result = await state.provider.call(kind, wire);
  const sequence = state.executions.length;
  const usageDraft = prepareResourceUsageReceipt({
    offer: state.offer,
    lease: state.lease,
    previous_receipts: state.usages,
    body: usageBody(state, sequence, time, counters)
  });
  const usageReceipt = finalizeResourceUsageReceipt({
    offer: state.offer,
    lease: state.lease,
    previous_receipts: state.usages,
    body: usageDraft.body,
    consumer_signature: localSignature(state.consumer, usageDraft.consumer_signing_message),
    provider_signature: await state.provider.sign(usageDraft.provider_signing_message)
  });
  state.usages.push(usageReceipt);
  const draft = prepareResourceExecutionReceipt({
    offer: state.offer,
    lease: state.lease,
    previous_execution_receipts: state.executions,
    usage_receipts: state.usages,
    challenge: signedChallenge,
    result
  });
  const receipt = finalizeResourceExecutionReceipt({
    offer: state.offer,
    lease: state.lease,
    previous_execution_receipts: state.executions,
    usage_receipts: state.usages,
    challenge: signedChallenge,
    result,
    consumer_signature: localSignature(state.consumer, draft.consumer_signing_message),
    provider_signature: await state.provider.sign(draft.provider_signing_message)
  });
  state.executions.push(receipt);
  return receipt;
}

test("actual provider process executes three lease-bound workloads and fails over only by new lease", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-execution-"));
  const providerA = await startProvider();
  let providerB;
  try {
    const consumer = localActor();
    const witnesses = [localActor(), localActor(), localActor(), localActor()];
    const resource = new Uint8Array(12_777);
    for (let index = 0; index < resource.length; index += 1) resource[index] = (index * 17) & 0xff;
    const resourcePath = join(directory, "actual-provider-resource.bin");
    await writeFile(resourcePath, resource);
    const storageWorkload = createResourceContentCommitment(resource);
    const stateA = await contract(providerA, consumer, witnesses, 3);

    const storageChallenge = await challenge(stateA, 0, 1200, "storage", storageWorkload);
    const storageReceipt = await execute(
      stateA,
      "storage",
      storageChallenge,
      { resource_path: resourcePath },
      { bandwidth: 0, cpu: 0, storage: resource.length },
      1201
    );
    const payload = new Uint8Array(511).fill(91);
    const bandwidthChallenge = await challenge(stateA, 1, 1300, "bandwidth", {
      payload_base64url: encoded(payload),
      payload_digest: resourceExecutionPayloadDigest(payload),
      payload_size: String(payload.length)
    });
    await execute(
      stateA,
      "bandwidth",
      bandwidthChallenge,
      { payload: encoded(payload) },
      { bandwidth: payload.length, cpu: 0, storage: resource.length },
      1301
    );
    const computeChallenge = await challenge(stateA, 2, 1400, "compute", {
      algorithm: "sha256-chain/1",
      input_base64url: encoded(encoder.encode("actual child process input")),
      iterations: "64"
    });
    await execute(
      stateA,
      "compute",
      computeChallenge,
      {},
      { bandwidth: payload.length, cpu: 25, storage: resource.length },
      1401
    );
    assert.equal(stateA.executions.length, 3);
    assert.equal(verifyResourceExecutionReceipt({
      offer: stateA.offer,
      lease: stateA.lease,
      previous_execution_receipts: stateA.executions.slice(0, 2),
      usage_receipts: stateA.usages,
      receipt: stateA.executions[2]
    }).status, "verified");

    const providerAPid = providerA.child.pid;
    await providerA.stop();
    assert.equal(providerA.child.exitCode !== null || providerA.child.signalCode !== null, true);
    assert.throws(() => process.kill(providerAPid, 0));
    await assert.rejects(() => providerA.sign(new Uint8Array(32)), /unavailable/u);

    providerB = await startProvider();
    assert.notEqual(providerB.identity.key_id, providerA.identity.key_id);
    const stateB = await contract(providerB, consumer, witnesses, 7);
    const recoveryChallenge = await challenge(stateB, 0, 1600, "storage", storageWorkload);
    assert.throws(
      () => verifyResourceExecutionReceipt({
        offer: stateB.offer,
        lease: stateB.lease,
        previous_execution_receipts: [],
        usage_receipts: [stateA.usages[0]],
        receipt: storageReceipt
      }),
      { code: "E_RESOURCE_BINDING" }
    );
    const recoveryReceipt = await execute(
      stateB,
      "storage",
      recoveryChallenge,
      { resource_path: resourcePath },
      { bandwidth: 0, cpu: 0, storage: resource.length },
      1601
    );
    const openedA = verifyResourceExecutionReceipt({
      offer: stateA.offer,
      lease: stateA.lease,
      previous_execution_receipts: [],
      usage_receipts: [stateA.usages[0]],
      receipt: storageReceipt
    });
    const openedB = verifyResourceExecutionReceipt({
      offer: stateB.offer,
      lease: stateB.lease,
      previous_execution_receipts: [],
      usage_receipts: [stateB.usages[0]],
      receipt: recoveryReceipt
    });
    assert.equal(openedB.workload_id, openedA.workload_id);
    assert.notEqual(openedB.body.lease_id, openedA.body.lease_id);
    const exchanged = JSON.stringify({
      offerA: parsed(stateA.offer),
      leaseA: parsed(stateA.lease),
      receiptsA: stateA.executions.map(parsed),
      offerB: parsed(stateB.offer),
      leaseB: parsed(stateB.lease),
      receiptsB: stateB.executions.map(parsed)
    });
    assert.doesNotMatch(exchanged, /private|pkcs8|BEGIN PRIVATE KEY|CryptoKey/iu);
  } finally {
    await providerA.stop();
    if (providerB) await providerB.stop();
    await rm(directory, { force: true, recursive: true });
  }
});
