import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  canonicalBytes,
  createPlacementFailureCertificate,
  domainHash,
  encodeBase64Url
} from "../src/index.mjs";
import {
  evaluatePlacementLivenessEvidence,
  finalizePlacementLivenessObservation,
  finalizePlacementLivenessPossessionResponse,
  finalizePlacementLivenessPolicy,
  finalizePlacementLivenessPolicyChallenge,
  PLACEMENT_LIVENESS_FORMATS,
  PLACEMENT_LIVENESS_RESPONSE_PROFILES,
  preparePlacementLivenessObservation,
  preparePlacementLivenessPolicy,
  preparePlacementLivenessPolicyChallenge,
  preparePlacementLivenessPossessionResponse,
  verifyPlacementFailureCertificate,
  verifyPlacementLivenessChallenge,
  verifyPlacementLivenessPolicy,
  verifyPlacementLivenessResponse
} from "../src/placement/liveness.mjs";
import {
  deriveResourceExecutionWorkloadId
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
  createResourceContentCommitment,
  evaluateResourceExecutionContract,
  finalizeResourceExecutionChallenge,
  finalizeResourceExecutionReceipt,
  prepareResourceExecutionChallenge,
  prepareResourceExecutionReceipt,
  verifyResourceExecutionReceipt
} from "../src/resource-execution.mjs";
import { evaluateStoragePlacements } from "../src/placement/storage.mjs";
import {
  executeAndCompleteLineagePlacementRepairBatch
} from "../lab/placement/repair-executor.mjs";
import {
  createPlacementNetworkEvidenceSession
} from "../lab/placement/network-evidence-session.mjs";
import {
  placementRepairBatchOptions,
  placementRepairContinuitySession,
  placementRepairProviderSessions,
  setupPlacementRepairBatchFixture,
  stablePlacementRepairBatchEvidence
} from "../test/placement-repair-batch-fixture.mjs";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "mortalos-p2p-placement-"));
const labDirectory = resolve(temporaryRoot, "lab");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcePath = resolve(temporaryRoot, "runtime-selected-resource.bin");
const resource = randomBytes(98_317);
await writeFile(resourcePath, resource);
await buildLab({ outdir: labDirectory });
await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: ["test/webrtc-transport-browser-entry.mjs"],
  format: "esm",
  legalComments: "none",
  logLevel: "silent",
  minify: true,
  outfile: resolve(labDirectory, "webrtc-primordials.js"),
  platform: "browser",
  sourcemap: false,
  target: ["chrome120"]
});
await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: ["test/placement-admission-browser-entry.mjs"],
  format: "esm",
  legalComments: "none",
  logLevel: "silent",
  minify: true,
  outfile: resolve(labDirectory, "placement-admission.js"),
  platform: "browser",
  sourcemap: false,
  target: ["chrome120"]
});
const server = await startLabServer({ directory: labDirectory });
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const endpoints = [];

async function verifyWebRtcPrimordials() {
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        errors.push(`${message.type()}: ${message.text()}`);
      }
    });
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const prototype = globalThis.RTCPeerConnection.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "close");
      const nativeClose = descriptor.value;
      Object.defineProperty(globalThis, "__MORTALOS_RTC_CLOSE_STATES__", {
        configurable: true,
        value: []
      });
      globalThis.__MORTALOS_RTC_CLOSE_TOTAL__ = 0;
      Object.defineProperty(prototype, "close", {
        ...descriptor,
        value(...argumentsList) {
          globalThis.__MORTALOS_RTC_CLOSE_TOTAL__ += 1;
          const result = Reflect.apply(nativeClose, this, argumentsList);
          globalThis.__MORTALOS_RTC_CLOSE_STATES__.push(this.connectionState);
          return result;
        }
      });
    });
    const result = await page.evaluate(async () => {
      const probe = await import("/webrtc-primordials.js");
      return probe.runWebRtcPrimordialBrowserProbe();
    });
    assert.deepEqual(result, {
      artifact_kind_poison_calls: 0,
      array_frames: 3,
      bounded_ice_configuration: true,
      channel_poison_calls: 0,
      constructor_poison_calls: 0,
      forbidden_local_frames: 0,
      forbidden_remote_frames: 0,
      generated_boundaries: {
        inbound_rejected_bytes: 8_388_609,
        inbound_retained_bytes: 8_388_209,
        inbound_messages: 512,
        outbound_rejected_bytes: 8_388_609,
        outbound_retained_bytes: 8_388_608,
        outbound_messages: 512,
        remote_peer_close_calls: 1,
        remote_peer_connection_state: "closed"
      },
      map_poison_calls: 0,
      peer_poison_calls: 0,
      remote_frames: 3,
      scheduler_poison_calls: 0,
      set_poison_calls: 0
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

async function verifyPlacementAdmission() {
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      const probe = await import("/placement-admission.js");
      return probe.runPlacementAdmissionBrowserProbe();
    });
    assert.equal(result.admitted, true);
    assert.equal(result.reference, true);
    assert.equal(result.evaluated_status, "failed");
    assert.match(result.epoch_id, /^sha256:[A-Za-z0-9_-]{43}$/u);
    assert.match(result.policy_id, /^sha256:[A-Za-z0-9_-]{43}$/u);
    assert.equal(result.private_material_exposed, false);
    assert.equal(result.maximum_message_bytes <= result.transport_message_ceiling, true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed & 0xff));
}

function encoded(value) {
  return encodeBase64Url(canonicalBytes(value));
}

function document(value) {
  return encodeBase64Url(value);
}

function capacity() {
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

async function openEndpoint(label, role) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const requestsAfterCut = [];
  let cut = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => { if (cut) requestsAfterCut.push(request.url()); });
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => import("/p2p-placement.js"));
  await page.waitForFunction(() => Boolean(globalThis.__MORTALOS_P2P_PLACEMENT__));
  const initialized = await page.evaluate((endpointRole) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.initialize(endpointRole), role);
  const endpoint = {
    browser,
    context,
    cut: async () => {
      cut = true;
      await context.route("**/*", (route) => route.abort("internetdisconnected"));
    },
    errors,
    identity: initialized.identity,
    label,
    page,
    requestsAfterCut
  };
  endpoints.push(endpoint);
  return endpoint;
}

async function pageSign(endpoint, name, message) {
  return endpoint.page.evaluate(
    ({ signer, value }) => globalThis.__MORTALOS_P2P_PLACEMENT__.sign(signer, value),
    { signer: name, value: encodeBase64Url(message) }
  );
}

async function connect(consumer, provider, slot) {
  const offer = await consumer.page.evaluate((id) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.startOffer(id), `consumer-${slot}`);
  const answer = await provider.page.evaluate(({ id, signal }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.acceptOffer(id, signal), {
    id: `provider-${slot}`,
    signal: offer
  });
  await Promise.all([
    consumer.page.evaluate((signal) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.completeAnswer(signal), answer),
    provider.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.ready())
  ]);
}

async function send(sender, receiver, kind, requestId, payload) {
  const payloadBase64Url = encoded(payload);
  await sender.page.evaluate(({ artifactKind, request, value }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.publishArtifact(artifactKind, request, value), {
    artifactKind: kind,
    request: requestId,
    value: payloadBase64Url
  });
  const received = await receiver.page.evaluate(({ artifactKind, request }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.waitArtifact(artifactKind, request), {
    artifactKind: kind,
    request: requestId
  });
  assert.equal(received.payload_base64url, payloadBase64Url);
  return received.payload;
}

function browserRangeTransport(endpoint) {
  return Object.freeze({
    async readRange(after, limit) {
      return endpoint.page.evaluate(
        ({ cursor, pageLimit }) =>
          globalThis.__MORTALOS_P2P_PLACEMENT__.readTransportRange(cursor, pageLimit),
        { cursor: after, pageLimit: limit }
      );
    }
  });
}

function auditedNetworkEvidence(session, counts) {
  return Object.freeze({
    async readCurrentEvidence() {
      const evidence = await session.readCurrentEvidence();
      counts.push(evidence.observed_liveness_responses.length);
      return evidence;
    }
  });
}

async function publishBatchLateEvidence(publisher, reader, responseBytes) {
  const payload = encodeBase64Url(responseBytes);
  const messageIds = await publisher.page.evaluate(async (value) => {
    const api = globalThis.__MORTALOS_P2P_PLACEMENT__;
    return [
      await api.publishArtifact("liveness-response", "batch-late-response-1", value),
      await api.publishArtifact("liveness-response", "batch-late-response-1", value),
      await api.publishArtifact("liveness-response", "batch-late-response-2", value),
      await api.publishArtifact("challenge", "batch-ignored-challenge", value)
    ];
  }, payload);
  assert.equal(messageIds[0], messageIds[1]);
  assert.notEqual(messageIds[0], messageIds[2]);
  await Promise.all([
    reader.page.evaluate(() =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.waitArtifact(
        "liveness-response",
        "batch-late-response-1"
      )),
    reader.page.evaluate(() =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.waitArtifact(
        "liveness-response",
        "batch-late-response-2"
      )),
    reader.page.evaluate(() =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.waitArtifact(
        "challenge",
        "batch-ignored-challenge"
      ))
  ]);
  const frames = await reader.page.evaluate(() =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.readTransportRange(0, 16));
  assert.deepEqual(frames.map(({ sequence }) => sequence), [1, 2, 3]);
  assert.equal(new Set(frames.map(({ message_id: id }) => id)).size, 3);
}

async function verifyConnectedRepairBatchEvidence({
  publisher,
  reader
}) {
  await connect(publisher, reader, "repair-batch-late");
  const fixture = await setupPlacementRepairBatchFixture();

  const lateDirectory = resolve(temporaryRoot, "repair-batch-webrtc-late");
  const lateCalls = [0, 0];
  const lateContinuityState = { calls: 0, committed: null };
  const lateCounts = [];
  const lateSession = createPlacementNetworkEvidenceSession({
    evidence: Object.freeze({
      async readCurrentEvidence() {
        return stablePlacementRepairBatchEvidence(fixture);
      }
    }),
    transport: browserRangeTransport(reader)
  });
  const lateProviders = placementRepairProviderSessions(
    fixture,
    lateCalls,
    null,
    async (shardIndex) => {
      if (shardIndex === 0) {
        await publishBatchLateEvidence(publisher, reader, fixture.lateResponses[1]);
      }
    }
  );
  const lateContinuity = placementRepairContinuitySession(fixture, lateContinuityState);
  await assert.rejects(() => executeAndCompleteLineagePlacementRepairBatch(
    placementRepairBatchOptions(
      fixture,
      lateDirectory,
      lateProviders,
      lateContinuity,
      auditedNetworkEvidence(lateSession, lateCounts)
    )
  ), /contested-or-forked-evidence|late-proof-conflict/u);
  assert.deepEqual(lateCalls, [1, 0]);
  assert.equal(lateContinuityState.calls, 0);
  assert.deepEqual(lateCounts, [0, 0, 1]);

  await connect(publisher, reader, "repair-batch-disconnect");
  const disconnectDirectory = resolve(temporaryRoot, "repair-batch-webrtc-disconnect");
  const disconnectCalls = [0, 0];
  const disconnectContinuityState = { calls: 0, committed: null };
  const disconnectCounts = [];
  const disconnectSession = createPlacementNetworkEvidenceSession({
    evidence: Object.freeze({
      async readCurrentEvidence() {
        return stablePlacementRepairBatchEvidence(fixture);
      }
    }),
    transport: browserRangeTransport(reader)
  });
  const disconnectProviders = placementRepairProviderSessions(
    fixture,
    disconnectCalls,
    null,
    async (shardIndex) => {
      if (shardIndex === 0) {
        await reader.page.evaluate(() =>
          globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport());
      }
    }
  );
  const disconnectContinuity = placementRepairContinuitySession(
    fixture,
    disconnectContinuityState
  );
  await assert.rejects(() => executeAndCompleteLineagePlacementRepairBatch(
    placementRepairBatchOptions(
      fixture,
      disconnectDirectory,
      disconnectProviders,
      disconnectContinuity,
      auditedNetworkEvidence(disconnectSession, disconnectCounts)
    )
  ), /P2P_TRANSPORT: no connected transport/u);
  assert.deepEqual(disconnectCalls, [1, 0]);
  assert.equal(disconnectContinuityState.calls, 0);
  assert.deepEqual(disconnectCounts, [0, 0]);
  await publisher.page.evaluate(() =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport());
}

let consumerA;
let consumerB;
const providers = [];
const records = [];
let workloadId;
let policyBoundLiveness = null;

async function proveProvider(provider, index) {
  const requestId = `placement-${index}`;
  await connect(consumerA, provider, index);
  const allocation = capacity();
  const offerDraft = prepareResourceOffer({
    capacity: allocation,
    expires_at_ms: "9000",
    offer_nonce: nonce(20 + index * 4),
    provider: provider.identity,
    valid_from_ms: "1000",
    witness_policy: {
      max_faulty: 1,
      threshold: 3,
      witnesses: consumerA.witnesses.map((entry) => entry.identity)
    }
  });
  const offer = finalizeResourceOffer({
    body: offerDraft.body,
    provider_signature: await pageSign(provider, "primary", offerDraft.provider_signing_message)
  });
  const transportedOffer = await send(provider, consumerA, "offer", requestId, {
    document_base64url: document(offer)
  });
  assert.equal(transportedOffer.document_base64url, document(offer));

  const leaseDraft = prepareResourceLease({
    offer,
    body: {
      allocation,
      consumer: consumerA.identity,
      ends_at_ms: "8900",
      lease_nonce: nonce(21 + index * 4),
      offer_id: offerDraft.offer_id,
      starts_at_ms: "1100"
    }
  });
  const consumerLeaseSignature = await pageSign(
    consumerA,
    "primary",
    leaseDraft.consumer_signing_message
  );
  await send(consumerA, provider, "lease-proposal", requestId, {
    body: leaseDraft.body,
    consumer_signature: consumerLeaseSignature,
    offer_base64url: document(offer)
  });
  const lease = finalizeResourceLease({
    offer,
    body: leaseDraft.body,
    consumer_signature: consumerLeaseSignature,
    provider_signature: await pageSign(provider, "primary", leaseDraft.provider_signing_message)
  });
  await send(provider, consumerA, "lease", requestId, { document_base64url: document(lease) });

  const announcements = [];
  for (const witness of consumerA.witnesses.slice(0, 3)) {
    const witnessDraft = prepareResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.identity.key_id
    });
    const witnessBytes = finalizeResourceConsumptionWitness({
      offer,
      lease,
      witness_key_id: witness.identity.key_id,
      witness_signature: await pageSign(consumerA, witness.name, witnessDraft.signing_message)
    });
    const announcement = createResourceConsumptionAnnouncement({ offer, lease, witness: witnessBytes });
    announcements.push(announcement);
    await send(consumerA, provider, "announcement", `${requestId}-${witness.name}`, {
      document_base64url: document(announcement)
    });
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
  assert.equal(activation.status, "active");
  const openedOffer = JSON.parse(new TextDecoder().decode(offer));
  const openedLease = JSON.parse(new TextDecoder().decode(lease));
  const workload = createResourceContentCommitment(resource);
  workloadId ??= deriveResourceExecutionWorkloadId({ kind: "storage", workload });
  assert.equal(workloadId, deriveResourceExecutionWorkloadId({ kind: "storage", workload }));

  if (index === 0) {
    await consumerA.page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "mortalos-p2p-file";
      input.type = "file";
      document.body.append(input);
    });
    await consumerA.page.locator("#mortalos-p2p-file").setInputFiles(resourcePath);
    await consumerA.page.evaluate(async (request) => {
      const file = document.querySelector("#mortalos-p2p-file").files[0];
      return globalThis.__MORTALOS_P2P_PLACEMENT__.publishFile(file, request);
    }, requestId);
  } else {
    await consumerA.page.evaluate(({ request, value }) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.publishResource(value, request), {
      request: requestId,
      value: resource.toString("base64url")
    });
  }
  const recovered = await provider.page.evaluate((request) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.recoverResource(request), requestId);
  assert.deepEqual(Buffer.from(recovered.resource_base64url, "base64url"), resource);

  const challengeDraft = prepareResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [],
    body: {
      challenge_nonce: nonce(22 + index * 4),
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
    consumer_signature: await pageSign(consumerA, "primary", challengeDraft.consumer_signing_message)
  });
  await send(consumerA, provider, "challenge", requestId, { document_base64url: document(challenge) });

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
  const consumerUsageSignature = await pageSign(
    consumerA,
    "primary",
    usageDraft.consumer_signing_message
  );
  await send(consumerA, provider, "usage-proposal", requestId, {
    body: usageDraft.body,
    consumer_signature: consumerUsageSignature
  });
  const usageReceipt = finalizeResourceUsageReceipt({
    offer,
    lease,
    previous_receipts: [],
    body: usageDraft.body,
    consumer_signature: consumerUsageSignature,
    provider_signature: await pageSign(provider, "primary", usageDraft.provider_signing_message)
  });
  await send(provider, consumerA, "usage", requestId, { document_base64url: document(usageReceipt) });

  const result = await provider.page.evaluate((value) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.createStorageResult(value), {
    challenge: document(challenge),
    lease: document(lease),
    offer: document(offer)
  });
  const receiptDraft = prepareResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [usageReceipt],
    challenge,
    result
  });
  const providerExecutionSignature = await pageSign(
    provider,
    "primary",
    receiptDraft.provider_signing_message
  );
  await send(provider, consumerA, "execution-proposal", requestId, {
    provider_signature: providerExecutionSignature,
    result
  });
  const executionReceipt = finalizeResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [usageReceipt],
    challenge,
    result,
    consumer_signature: await pageSign(
      consumerA,
      "primary",
      receiptDraft.consumer_signing_message
    ),
    provider_signature: providerExecutionSignature
  });
  await send(consumerA, provider, "execution-receipt", requestId, {
    document_base64url: document(executionReceipt)
  });
  const verified = verifyResourceExecutionReceipt({
    offer,
    lease,
    previous_execution_receipts: [],
    usage_receipts: [usageReceipt],
    receipt: executionReceipt
  });
  assert.equal(verified.body.workload_id, workloadId);
  if (index === 0) {
    const policyDraft = preparePlacementLivenessPolicy({
      offer,
      lease,
      body: {
        failure_sequence: "1",
        lineage_parent_hash: domainHash("MortalOS P2P liveness lineage", resource),
        manifest_id: domainHash("MortalOS P2P liveness manifest", resource),
        response_proof_profile:
          PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample,
        response_window_ms: "5000",
        shard_index: 0,
        workload_id: verified.body.workload_id
      }
    });
    const policy = finalizePlacementLivenessPolicy({
      body: policyDraft.body,
      lease,
      offer,
      provider_signature: await pageSign(
        provider,
        "primary",
        policyDraft.provider_signing_message
      )
    });
    const challengeDraft = preparePlacementLivenessPolicyChallenge({
      nonce: nonce(117),
      policy,
      previous_execution_receipt_id: verified.receipt_id
    });
    const livenessChallenge = finalizePlacementLivenessPolicyChallenge({
      consumer_signature: await pageSign(
        consumerA,
        "primary",
        challengeDraft.consumer_signing_message
      ),
      nonce: nonce(117),
      policy,
      previous_execution_receipt_id: verified.receipt_id
    });
    await send(consumerA, provider, "liveness-challenge", "policy-bound-liveness", {
      document_base64url: document(livenessChallenge)
    });
    const possessionProof = await provider.page.evaluate(({ challenge_nonce, lease_id, workload }) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.createStoragePossessionProof({
        challenge_nonce,
        lease_id,
        workload
      }), {
      challenge_nonce: nonce(117),
      lease_id: openedLease.lease_id,
      workload
    });
    const responseDraft = preparePlacementLivenessPossessionResponse({
      challenge: livenessChallenge,
      proof: possessionProof,
      provider: provider.identity,
      workload
    });
    const possessionResponse = finalizePlacementLivenessPossessionResponse({
      challenge: livenessChallenge,
      proof: possessionProof,
      provider: provider.identity,
      provider_signature: await pageSign(
        provider,
        "primary",
        responseDraft.provider_signing_message
      ),
      workload
    });
    await send(provider, consumerA, "liveness-response", "policy-bound-liveness", {
      document_base64url: document(possessionResponse)
    });
    const openedResponse = verifyPlacementLivenessResponse(possessionResponse);
    const alive = evaluatePlacementLivenessEvidence({
      certificates: [],
      responses: [openedResponse.bytes]
    });
    assert.equal(openedResponse.independent_possession, true);
    assert.equal(alive.status, "alive");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
    const observations = [];
    for (const witness of consumerA.witnesses.slice(0, 3)) {
      const observationDraft = preparePlacementLivenessObservation({
        challenge: livenessChallenge,
        observer: witness.identity,
        waited_window_ms: "5000"
      });
      observations.push(finalizePlacementLivenessObservation({
        challenge: livenessChallenge,
        observer: witness.identity,
        observer_signature: await pageSign(
          consumerA,
          witness.name,
          observationDraft.observer_signing_message
        ),
        waited_window_ms: "5000"
      }));
    }
    const certificate = createPlacementFailureCertificate({
      challenge: livenessChallenge,
      observations
    });
    const openedPolicy = verifyPlacementLivenessPolicy(policy);
    const openedChallenge = verifyPlacementLivenessChallenge(livenessChallenge);
    const openedCertificate = verifyPlacementFailureCertificate(certificate.bytes);
    const evaluated = evaluatePlacementLivenessEvidence({
      certificates: [openedCertificate.bytes],
      responses: []
    });
    const contested = evaluatePlacementLivenessEvidence({
      certificates: [openedCertificate.bytes],
      responses: [openedResponse.bytes]
    });
    assert.equal(contested.status, "halted");
    policyBoundLiveness = Object.freeze({
      authority: openedChallenge.authority,
      certificate_format: openedCertificate.certificate_format,
      policy_id: openedPolicy.policy_id,
      possession_response: openedResponse.response_format,
      response_window_ms: openedPolicy.body.response_window_ms,
      status: evaluated.status
    });
  }
  await Promise.all([
    consumerA.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport()),
    provider.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport())
  ]);
  return Object.freeze({
    consumption_announcements: Object.freeze(announcements),
    execution_receipts: Object.freeze([executionReceipt]),
    lease,
    observed_at_ms: "1500",
    offer,
    revocations: Object.freeze([]),
    usage_receipts: Object.freeze([usageReceipt])
  });
}

function evaluate(unavailableProviderIds) {
  return evaluateStoragePlacements({
    expected_workload_id: workloadId,
    placements: records,
    quorum: 2,
    target_copies: 3,
    unavailable_provider_ids: unavailableProviderIds
  });
}

async function retrieve(provider, index) {
  await connect(consumerB, provider, `recovery-${index}`);
  const request = `recovery-${index}`;
  await provider.page.evaluate((requestId) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.publishStoredResource(requestId), request);
  const recovered = await consumerB.page.evaluate((requestId) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.recoverResource(requestId), request);
  await Promise.all([
    consumerB.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport()),
    provider.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport())
  ]);
  return Buffer.from(recovered.resource_base64url, "base64url");
}

try {
  await verifyWebRtcPrimordials();
  await verifyPlacementAdmission();
  consumerA = await openEndpoint("consumer-a", "consumer");
  consumerB = await openEndpoint("consumer-b", "consumer");
  consumerA.witnesses = [];
  for (let index = 0; index < 4; index += 1) {
    const name = `witness-${index}`;
    const identity = await consumerA.page.evaluate((signer) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.createSigner(signer), name);
    consumerA.witnesses.push({ identity, name });
  }
  consumerA.witnesses.sort((left, right) =>
    left.identity.key_id < right.identity.key_id ? -1 : 1);
  for (let index = 0; index < 4; index += 1) {
    providers.push(await openEndpoint(`provider-${index}`, "provider"));
  }
  const batchLatePublisher = await openEndpoint("batch-late-publisher", "provider");
  const batchLateReader = await openEndpoint("batch-late-reader", "consumer");
  const requestCountAtCut = server.requests.length;
  await Promise.all(endpoints.map((endpoint) => endpoint.cut()));

  await verifyConnectedRepairBatchEvidence({
    publisher: batchLatePublisher,
    reader: batchLateReader
  });

  for (let index = 0; index < 3; index += 1) records.push(await proveProvider(providers[index], index));
  assert.equal(policyBoundLiveness?.authority, "policy-bound");
  assert.equal(
    policyBoundLiveness?.certificate_format,
    PLACEMENT_LIVENESS_FORMATS.certificate_policy
  );
  assert.match(policyBoundLiveness?.policy_id ?? "", /^sha256:[A-Za-z0-9_-]{43}$/u);
  assert.equal(
    policyBoundLiveness?.possession_response,
    PLACEMENT_LIVENESS_FORMATS.response_possession
  );
  assert.equal(policyBoundLiveness?.response_window_ms, "5000");
  assert.equal(policyBoundLiveness?.status, "failed");
  const initial = evaluate([]);
  assert.equal(initial.status, "proved");
  assert.equal(initial.available_copies, 3);

  const lostProviderId = providers[0].identity.key_id;
  await providers[0].browser.close();
  assert.equal(providers[0].page.isClosed(), true);
  const degraded = evaluate([lostProviderId]);
  assert.equal(degraded.status, "repairing");
  assert.equal(degraded.available_copies, 2);

  records.push(await proveProvider(providers[3], 3));
  const repaired = evaluate([lostProviderId]);
  assert.equal(repaired.status, "proved");
  assert.equal(repaired.available_copies, 3);
  assert.equal(new Set(repaired.placements.map((entry) => entry.lease_id)).size, 4);

  await consumerA.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.destroy());
  await consumerA.browser.close();
  assert.equal(consumerA.page.isClosed(), true);
  await providers[1].page.evaluate(() =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.corruptStoredResource(49_000));
  const recoveredCopies = [];
  for (const index of [1, 2, 3]) recoveredCopies.push(await retrieve(providers[index], index));
  const validCopies = recoveredCopies.filter((copy) =>
    deriveResourceExecutionWorkloadId({
      kind: "storage",
      workload: createResourceContentCommitment(copy)
    }) === workloadId);
  assert.equal(validCopies.length, 2);
  assert.deepEqual(validCopies[0], resource);
  assert.deepEqual(validCopies[1], resource);
  assert.notDeepEqual(recoveredCopies[0], resource);

  const corruptedProviderId = providers[1].identity.key_id;
  const afterReadback = evaluate([lostProviderId, corruptedProviderId]);
  assert.equal(afterReadback.status, "repairing");
  assert.equal(afterReadback.available_copies, 2);
  assert.equal(server.requests.length, requestCountAtCut);
  assert.ok(endpoints.every((endpoint) => endpoint.requestsAfterCut.length === 0));
  assert.ok(endpoints.every((endpoint) => endpoint.errors.length === 0));
  const snapshots = await Promise.all(
    [consumerB, ...providers.slice(1)].map((endpoint) => endpoint.page.evaluate(() =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.snapshot()))
  );
  assert.doesNotMatch(JSON.stringify({ repaired, snapshots }), /private[_-]?key|CryptoKey/u);

  console.log("MortalOS P2P receipt-gated placement/repair: PASS");
  console.log("- one actual runtime-selected file crossed direct DataChannels to three providers");
  console.log("- offer, lease, witness, challenge, usage, and execution evidence crossed the same peer path");
  console.log("- a browser-held provider key signed an exact lease-bound 5,000ms liveness policy before the policy-bound challenge/certificate");
  console.log("- that provider answered directly from stored bytes with a nonce-selected Merkle sample and no fresh consumer receipt");
  console.log("- only exact active storage execution receipts counted as placement");
  console.log("- provider process loss degraded 3 to 2; a new provider/new lease repaired to 3");
  console.log("- after consumer A exited, consumer B recovered exact bytes from 2 valid of 3 peer copies");
  console.log("- one corrupt readback was rejected and marked locally unavailable");
  console.log("- origin/HTTP/relay were denied after bundle load; no request occurred after the cut");
  console.log("- actual Chromium DataChannels retained captured transcript, scheduler, and peer capabilities under prototype poison");
  console.log("- actual Chromium enforced generated 512-message/8-MiB outbound and inbound transcript ceilings and closed the peer on remote channel close");
  console.log("- selective artifact-kind Set.has poison could not send or commit a verdict; a challenge still crossed both peers");
  console.log("- an actual connected WebRTC transcript stopped batch provider 1 and Continuity after provider 0; duplicate/rewrapped evidence deduplicated and disconnect also stopped all later calls");
  console.log("- all browsers shared one host/admin domain; physical independence remains HOLD");
} finally {
  await Promise.all(endpoints.map(({ browser }) => browser.close().catch(() => {})));
  await server.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}
