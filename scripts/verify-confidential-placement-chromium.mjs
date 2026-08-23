import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { decodeBase64Url, encodeBase64Url } from "../src/bytes.mjs";
import {
  createConfidentialPlacementJournal,
  createConfidentialPlacementReproofContext,
  deriveConfidentialPlacementReproofNonce,
  evaluateConfidentialPlacementJournal,
  evaluateConfidentialPlacementReproof,
  evaluateConfidentialStoragePlacements,
  planConfidentialStorageRepair,
  restoreConfidentialPlacementJournal
} from "../src/placement/confidential.mjs";
import {
  executePreparedStoragePlacementFixture,
  prepareStoragePlacementFixture,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import {
  completeLineagePlacementRepairEffect,
  executeLineagePlacementRepairEffect
} from "../lab/placement/repair-executor.mjs";
import {
  createPlacementFailureCertificateFromChallengeFixture,
  createPlacementLivenessChallengeFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import { createPlacementMembershipFixture } from "../lab/placement/admission-contract.mjs";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "mortalos-confidential-placement-"));
const labDirectory = resolve(temporaryRoot, "lab");
const resourcePath = resolve(temporaryRoot, "runtime-confidential-resource.bin");
const resource = randomBytes(98_317);
const marker = Buffer.from("MORTALOS-CONFIDENTIAL-P2P-MARKER:");
marker.copy(resource, 0);
await writeFile(resourcePath, resource);
await buildLab({ outdir: labDirectory });
const server = await startLabServer({ directory: labDirectory });
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const endpoints = [];
let connectionSequence = 0;

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
  await page.evaluate(() => Promise.all([
    import("/p2p-placement.js"),
    import("/confidential-placement.js")
  ]));
  const initialized = await page.evaluate((endpointRole) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.initialize(endpointRole), role);
  const endpoint = {
    browser,
    context,
    async cut() {
      cut = true;
      await context.route("**/*", (route) => route.abort("internetdisconnected"));
    },
    errors,
    identity: initialized.identity,
    label,
    page,
    requestsAfterCut,
    role
  };
  endpoints.push(endpoint);
  return endpoint;
}

async function closeConnection(left, right) {
  await Promise.all([
    left.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport()),
    right.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.closeTransport())
  ]);
}

async function connect(left, right, purpose) {
  connectionSequence += 1;
  const slot = `${purpose}-${connectionSequence}`;
  const offer = await left.page.evaluate((id) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.startOffer(id), `left-${slot}`);
  const answer = await right.page.evaluate(({ id, signal }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.acceptOffer(id, signal), {
    id: `right-${slot}`,
    signal: offer
  });
  await Promise.all([
    left.page.evaluate((signal) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.completeAnswer(signal), answer),
    right.page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.ready())
  ]);
}

async function pageSign(endpoint, signer, bytes) {
  return endpoint.page.evaluate(({ name, value }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.sign(name, value), {
    name: signer,
    value: encodeBase64Url(bytes)
  });
}

function signer(endpoint, name = "primary", identity = endpoint.identity) {
  return Object.freeze({
    identity,
    sign: (bytes) => pageSign(endpoint, name, bytes)
  });
}

async function witnesses(endpoint) {
  const created = [];
  for (let index = 0; index < 4; index += 1) {
    const name = `witness-${index}`;
    const identity = await endpoint.page.evaluate((value) =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.createSigner(value), name);
    created.push(signer(endpoint, name, identity));
  }
  return created;
}

function providerAdapter(controller, provider, {
  identity = provider.identity,
  reuseStored = false,
  signerName = "primary"
} = {}) {
  assert.match(signerName, /^[a-z][a-z0-9-]{0,31}$/u);
  assert.match(identity?.key_id ?? "", /^peer:[A-Za-z0-9_-]{43}$/u);
  assert.match(identity?.public_key ?? "", /^ed25519:[A-Za-z0-9_-]{43}$/u);
  return Object.freeze({
    identity: Object.freeze({ ...identity }),
    sign: (bytes) => pageSign(provider, signerName, bytes),
    async store(bytes) {
      if (reuseStored) {
        const snapshot = await provider.page.evaluate(() =>
          globalThis.__MORTALOS_P2P_PLACEMENT__.snapshot());
        assert.equal(snapshot.resource_size, bytes.byteLength);
        return { resource_size: snapshot.resource_size, status: "already-stored" };
      }
      await connect(controller, provider, `store-${provider.label}`);
      const request = `store-${provider.label}-${connectionSequence}`;
      await controller.page.evaluate(({ requestId, value }) =>
        globalThis.__MORTALOS_P2P_PLACEMENT__.publishResource(value, requestId), {
        requestId: request,
        value: encodeBase64Url(bytes)
      });
      const recovered = await provider.page.evaluate((requestId) =>
        globalThis.__MORTALOS_P2P_PLACEMENT__.recoverResource(requestId), request);
      assert.deepEqual(Buffer.from(recovered.resource_base64url, "base64url"), Buffer.from(bytes));
      await closeConnection(controller, provider);
      return { resource_size: recovered.resource_size, status: "stored-over-webrtc" };
    },
    createStorageResult(options) {
      return provider.page.evaluate((value) =>
        globalThis.__MORTALOS_P2P_PLACEMENT__.createStorageResult(value), {
        challenge: encodeBase64Url(options.challenge),
        lease: encodeBase64Url(options.lease),
        offer: encodeBase64Url(options.offer),
        previous_execution_receipts: options.previous_execution_receipts.map(encodeBase64Url),
        usage_receipts: options.usage_receipts.map(encodeBase64Url)
      });
    }
  });
}

async function retrieve(controller, provider, purpose) {
  await connect(controller, provider, purpose);
  const request = `${purpose}-${connectionSequence}`;
  await provider.page.evaluate((requestId) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.publishStoredResource(requestId), request);
  const recovered = await controller.page.evaluate((requestId) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.recoverResource(requestId), request);
  await closeConnection(controller, provider);
  return recovered.resource_base64url;
}

async function deliverArtifact(sender, receiver, kind, bytes, purpose) {
  await connect(sender, receiver, purpose);
  const request = `${purpose}-${connectionSequence}`;
  const received = receiver.page.evaluate(({ artifactKind, requestId }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.waitArtifact(artifactKind, requestId), {
    artifactKind: kind,
    requestId: request
  });
  await sender.page.evaluate(({ artifactKind, requestId, value }) =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.publishArtifact(artifactKind, requestId, value), {
    artifactKind: kind,
    requestId: request,
    value: encodeBase64Url(bytes)
  });
  const opened = await received;
  await closeConnection(sender, receiver);
  assert.equal(opened.payload_base64url, encodeBase64Url(bytes));
}

function record(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function reproofNonce(context, shardIndex) {
  return (identity) => deriveConfidentialPlacementReproofNonce({
    ...identity,
    reproof_context_bytes: context.bytes,
    shard_index: shardIndex
  });
}

function browserRecord(fixture, shardIndex) {
  const value = record(fixture, shardIndex);
  return Object.freeze({
    consumption_announcements_base64url: value.consumption_announcements.map(encodeBase64Url),
    execution_receipts_base64url: value.execution_receipts.map(encodeBase64Url),
    lease_base64url: encodeBase64Url(value.lease),
    observed_at_ms: value.observed_at_ms,
    offer_base64url: encodeBase64Url(value.offer),
    revocations_base64url: value.revocations.map(encodeBase64Url),
    shard_index: value.shard_index,
    usage_receipts_base64url: value.usage_receipts.map(encodeBase64Url)
  });
}

function controllerCandidate(committed, generation) {
  return Object.freeze({
    capsule_base64url: committed.capsule_base64url,
    commit_base64url: committed.commit_base64url,
    generation_base64url: generation.generation_base64url
  });
}

function evaluate(manifestBase64Url, records, unavailable = [], evaluatedAt = "1800") {
  return evaluateConfidentialStoragePlacements({
    evaluated_at_ms: evaluatedAt,
    manifest_bytes: decodeBase64Url(manifestBase64Url),
    max_proof_age_ms: "500",
    placements: records,
    quorum: 2,
    target_shards: 3,
    unavailable_provider_ids: unavailable
  });
}

function evaluateReproof(context, records, priorJournal = null, evaluatedAt = "1800") {
  return evaluateConfidentialPlacementReproof({
    evaluated_at_ms: evaluatedAt,
    placements: records,
    prior_journal_bytes: priorJournal?.bytes ?? null,
    reproof_context_bytes: context.bytes,
    unavailable_provider_ids: []
  });
}

function addDistinctReceiptIds(evaluation, receiptIds) {
  for (const placement of evaluation.placements) {
    assert.equal(placement.status, "proved");
    assert.match(placement.receipt_id, /^resource-execution:[A-Za-z0-9_-]{43}$/u);
    assert.equal(receiptIds.has(placement.receipt_id), false);
    receiptIds.add(placement.receipt_id);
  }
}

async function withinDeadline(label, milliseconds, operation) {
  let timeout;
  try {
    return await Promise.race([
      operation(),
      new Promise((resolvePromise, rejectPromise) => {
        timeout = setTimeout(() => rejectPromise(
          new Error(`${label} exceeded its ${milliseconds}ms deadline`)
        ), milliseconds);
        timeout.unref?.();
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

let consumerA;
let consumerB;
const providers = [];

try {
  consumerA = await openEndpoint("consumer-a", "consumer");
  consumerB = await openEndpoint("consumer-b", "consumer");
  for (let index = 0; index < 6; index += 1) {
    providers.push(await openEndpoint(`provider-${index}`, "provider"));
  }
  const bCustodian = await consumerB.page.evaluate(() =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createCustodian());
  assert.equal(bCustodian.private_material_exposed, false);
  await consumerA.page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "confidential-file";
    input.type = "file";
    document.body.append(input);
  });
  await consumerA.page.locator("#confidential-file").setInputFiles(resourcePath);
  const confidential = await consumerA.page.evaluate(async (descriptor) => {
    const file = document.querySelector("#confidential-file").files[0];
    return globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createPackageFromFile(file, [descriptor]);
  }, bCustodian.descriptor);
  const controllerCreated = await consumerA.page.evaluate(() => {
    const file = document.querySelector("#confidential-file").files[0];
    return globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createControllerFromFile(file);
  });
  assert.equal(controllerCreated.private_material_exposed, false);
  const shardSet = await consumerA.page.evaluate((packageValue) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createShardSet(packageValue),
  confidential.package_base64url);
  assert.equal(shardSet.shards.length, 3);
  assert.ok(shardSet.shards.every(({ bytes_base64url: value }) =>
    !Buffer.from(value, "base64url").includes(marker)));

  const providerWitnesses = (providerIndex) => [
    signer(consumerB),
    ...providers
      .filter((ignored, index) => index !== providerIndex)
      .slice(0, 3)
      .map((endpoint) => signer(endpoint))
  ];
  const context1 = createConfidentialPlacementReproofContext({
    epoch_nonce: randomBytes(32),
    generation: "1",
    manifest_bytes: decodeBase64Url(shardSet.manifest_base64url),
    max_proof_age_ms: "500",
    prior_journal_bytes: null,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  });
  const initial = [];
  for (let index = 0; index < 3; index += 1) {
    const bytes = Buffer.from(shardSet.shards[index].bytes_base64url, "base64url");
    const fixture = await createStoragePlacementFixture({
      challengeNonceFactory: reproofNonce(context1, index),
      consumer: signer(consumerA),
      provider: providerAdapter(consumerA, providers[index]),
      resourceBytes: bytes,
      seed: 20 + index * 4,
      witnesses: providerWitnesses(index)
    });
    assert.equal(fixture.expected_workload_id, shardSet.shards[index].workload_id);
    initial.push(fixture);
  }
  const requestCountAtCut = server.requests.length;
  await Promise.all(endpoints.map((endpoint) => endpoint.cut()));
  const initialRecords = initial.map((fixture, index) => record(fixture, index));
  const initialEvaluation = evaluateReproof(context1, initialRecords);
  assert.equal(initialEvaluation.status, "proved");
  const journal1 = createConfidentialPlacementJournal({
    evaluation: initialEvaluation,
    prior_journal_bytes: null,
    reproof_context_bytes: context1.bytes
  });
  const context2 = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "2",
    manifest_bytes: decodeBase64Url(shardSet.manifest_base64url),
    max_proof_age_ms: "500",
    prior_journal_bytes: journal1.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  const replayed = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1800",
    journal_bytes: journal1.bytes,
    placements: initialRecords,
    reproof_context_bytes: context2.bytes,
    unavailable_provider_ids: []
  });
  assert.equal(replayed.status, "unavailable");
  assert.equal(replayed.available_shards, 0);
  assert.ok(replayed.placements.every(({ reason }) => reason === "reproof-context-mismatch"));

  const lostProviderId = providers[0].identity.key_id;
  const livenessObservers = providerWitnesses(0);
  const membershipAuthority = Object.freeze({
    custodian: Object.freeze({ ...controllerCreated.custodian }),
    async createMembershipEpoch({ capsule_bytes, parameters, prior_epoch_bytes }) {
      const created = await consumerA.page.evaluate((values) =>
        globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createPlacementMembershipEpoch(values), {
        capsule_base64url: encodeBase64Url(capsule_bytes),
        parameters: {
          ...parameters,
          admission_evidence_base64url: parameters.admission_evidence.map(encodeBase64Url),
          admission_evidence: undefined
        },
        prior_epoch_base64url: prior_epoch_bytes === null
          ? null
          : encodeBase64Url(prior_epoch_bytes)
      });
      assert.equal(created.private_material_exposed, false);
      return decodeBase64Url(created.epoch_base64url);
    }
  });
  const livenessMembership = await createPlacementMembershipFixture({
    authority: membershipAuthority,
    capsule_bytes: decodeBase64Url(controllerCreated.capsule_base64url),
    observers: livenessObservers,
    providers: [signer(providers[0])]
  });
  const livenessChallenge = await createPlacementLivenessChallengeFixture({
    consumer: signer(consumerA),
    lineage_parent_hash: controllerCreated.head_hash,
    manifest_id: shardSet.manifest_id,
    membership: livenessMembership,
    observers: livenessObservers,
    placement: initial[0],
    provider: signer(providers[0]),
    response_window_ms: "5000",
    shard_index: 0
  });
  await deliverArtifact(
    consumerA,
    providers[0],
    "liveness-challenge",
    livenessChallenge.bytes,
    "failed-provider-liveness-challenge"
  );
  const delayedPossessionResponse = await createPlacementLivenessResponseFixture({
    challenge_bytes: livenessChallenge.bytes,
    placement: initial[0],
    provider: signer(providers[0]),
    resource_bytes: decodeBase64Url(shardSet.shards[0].bytes_base64url)
  });
  for (const endpoint of [consumerB, providers[1], providers[2], providers[3]]) {
    await deliverArtifact(
      consumerA,
      endpoint,
      "liveness-challenge",
      livenessChallenge.bytes,
      `observer-liveness-challenge-${endpoint.label}`
    );
  }
  await providers[0].browser.close();
  await Promise.all([consumerB, providers[1], providers[2], providers[3]].map(({ page }) =>
    page.evaluate((milliseconds) => new Promise((resolveDelay) =>
      setTimeout(resolveDelay, milliseconds)), 5000)));
  const failure = await createPlacementFailureCertificateFromChallengeFixture({
    challenge_bytes: livenessChallenge.bytes,
    observers: livenessObservers,
    waited_window_ms: "5000"
  });
  const degraded = evaluate(
    shardSet.manifest_base64url,
    initial.map((fixture, index) => record(fixture, index)),
    [lostProviderId]
  );
  assert.equal(degraded.status, "repairing");
  assert.deepEqual(planConfidentialStorageRepair(degraded).actions.map(({ shard_index: index }) => index), [0]);

  const generation1 = await consumerA.page.evaluate((options) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createPlacementGeneration(options), {
    capsule_base64url: controllerCreated.capsule_base64url,
    evaluated_at_ms: "1800",
    failure_certificates_base64url: [encodeBase64Url(failure.certificate_bytes)],
    liveness_responses_base64url: [],
    manifest_base64url: shardSet.manifest_base64url,
    max_proof_age_ms: "500",
    membership_epochs_base64url: [encodeBase64Url(livenessMembership.epoch_bytes)],
    placements: initial.map((fixture, index) => browserRecord(fixture, index)),
    prior_commit_base64url: null,
    prior_generation_base64url: null,
    quorum: 2,
    target_shards: 3
  });
  assert.equal(generation1.status, "repairing");
  assert.deepEqual(generation1.repair_shard_indexes, [0]);
  const committed1 = await consumerA.page.evaluate(({ capsule, generation }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.commitPlacementGeneration(capsule, generation), {
    capsule: controllerCreated.capsule_base64url,
    generation: generation1.generation_base64url
  });
  await consumerB.page.evaluate(() =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createController());
  const controllerRequest = await consumerB.page.evaluate((capsule) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.requestControllerHandoff(capsule),
  committed1.capsule_base64url);
  const controllerProposal = await consumerA.page.evaluate(({ capsule, request }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.proposeControllerHandoff(capsule, request), {
    capsule: committed1.capsule_base64url,
    request: controllerRequest
  });
  const controllerHanded = await consumerB.page.evaluate(({ capsule, proposal }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.acceptControllerHandoff(capsule, proposal), {
    capsule: committed1.capsule_base64url,
    proposal: controllerProposal
  });

  const recoveredOne = await retrieve(consumerB, providers[1], "successor-read-1");
  const recoveredTwo = await retrieve(consumerB, providers[2], "successor-read-2");
  await consumerA.page.evaluate(() => {
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.destroy();
    globalThis.__MORTALOS_P2P_PLACEMENT__.destroy();
  });
  await consumerA.browser.close();
  assert.equal(consumerA.page.isClosed(), true);

  const reconstructed = await consumerB.page.evaluate(({ manifest, shards }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.reconstructPackage(manifest, shards), {
    manifest: shardSet.manifest_base64url,
    shards: [recoveredOne, recoveredTwo]
  });
  const decrypted = await consumerB.page.evaluate(({ context, packageValue }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.decryptPackage(context, packageValue), {
    context: confidential,
    packageValue: reconstructed.package_base64url
  });
  assert.deepEqual(Buffer.from(decrypted.resource_base64url, "base64url"), resource);
  assert.equal(decrypted.private_material_exposed, false);

  const successorSet = await consumerB.page.evaluate((packageValue) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createShardSet(packageValue),
  reconstructed.package_base64url);
  assert.deepEqual(successorSet, shardSet);
  const bWitnesses = await witnesses(consumerB);
  const successorProviders = [providers[3], providers[4], providers[5]];
  const successor = [];
  let completedRepair = null;
  for (let index = 0; index < 3; index += 1) {
    const fixtureOptions = {
      challengeNonceFactory: reproofNonce(context2, index),
      consumer: signer(consumerB),
      provider: providerAdapter(consumerB, successorProviders[index]),
      resourceBytes: Buffer.from(successorSet.shards[index].bytes_base64url, "base64url"),
      seed: 80 + index * 4,
      witnesses: bWitnesses
    };
    if (index !== 0) {
      successor.push(await createStoragePlacementFixture(fixtureOptions));
      continue;
    }
    const prepared = await prepareStoragePlacementFixture(fixtureOptions);
    let providerEffects = 0;
    const privateProviderSession = Object.freeze({
      async executeRepairEffect({ idempotency_key: idempotencyKey }) {
        assert.match(idempotencyKey, /^sha256:[A-Za-z0-9_-]{43}$/u);
        providerEffects += 1;
        const executed = await executePreparedStoragePlacementFixture({
          challengeNonceFactory: fixtureOptions.challengeNonceFactory,
          prepared
        });
        return { placement: executed.placement };
      }
    });
    const effectOptions = {
      capsule_bytes: decodeBase64Url(committed1.capsule_base64url),
      commit_bytes: decodeBase64Url(committed1.commit_base64url),
      directory: resolve(temporaryRoot, "repair-effects"),
      generation_bytes: decodeBase64Url(generation1.generation_base64url),
      observed_at_ms: "1800",
      observed_liveness_responses: [],
      observed_placements: initialRecords,
      provider: privateProviderSession,
      replacement_lease_bytes: prepared.lease,
      replacement_offer_bytes: prepared.offer,
      resource_bytes: fixtureOptions.resourceBytes,
      shard_index: 0
    };
    let contestedProviderCalls = 0;
    await assert.rejects(() => executeLineagePlacementRepairEffect({
      ...effectOptions,
      directory: resolve(temporaryRoot, "repair-effects-contested"),
      observed_liveness_responses: [delayedPossessionResponse],
      provider: Object.freeze({
        async executeRepairEffect() {
          contestedProviderCalls += 1;
          throw new Error("contested evidence reached provider");
        }
      })
    }), /contested-or-forked-evidence/u);
    assert.equal(contestedProviderCalls, 0);
    const executed = await executeLineagePlacementRepairEffect(effectOptions);
    assert.equal(executed.status, "committed");
    assert.equal(executed.value.shard_index, 0);
    assert.equal(executed.value.provider_id, successorProviders[0].identity.key_id);
    assert.equal(providerEffects, 1);
    const retried = await executeLineagePlacementRepairEffect(effectOptions);
    assert.equal(retried.status, "already-committed");
    assert.equal(retried.value.result_id, executed.value.result_id);
    assert.equal(providerEffects, 1);
    let continuityCommits = 0;
    let cachedCompletion = null;
    const privateContinuitySession = Object.freeze({
      async commitPlacementGeneration({
        capsule_bytes: capsuleBytes,
        generation_bytes: generationBytes,
        idempotency_key: idempotencyKey
      }) {
        assert.match(idempotencyKey, /^sha256:[A-Za-z0-9_-]{43}$/u);
        if (!cachedCompletion) {
          continuityCommits += 1;
          cachedCompletion = await consumerB.page.evaluate(({ capsule, generation }) =>
            globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.commitPlacementGeneration(
              capsule,
              generation
            ), {
            capsule: encodeBase64Url(capsuleBytes),
            generation: encodeBase64Url(generationBytes)
          });
        }
        return {
          capsule_bytes: decodeBase64Url(cachedCompletion.capsule_base64url),
          commit_bytes: decodeBase64Url(cachedCompletion.commit_base64url)
        };
      }
    });
    const completionOptions = {
      capsule_bytes: decodeBase64Url(controllerHanded.capsule_base64url),
      commit_bytes: decodeBase64Url(committed1.commit_base64url),
      continuity: privateContinuitySession,
      directory: resolve(temporaryRoot, "repair-completions"),
      effect_result_bytes: executed.bytes,
      generation_bytes: decodeBase64Url(generation1.generation_base64url),
      observed_at_ms: "1800",
      observed_liveness_responses: [],
      observed_placements: initialRecords,
      replacement_lease_bytes: prepared.lease,
      replacement_offer_bytes: prepared.offer,
      resource_bytes: fixtureOptions.resourceBytes,
      shard_index: 0
    };
    completedRepair = await completeLineagePlacementRepairEffect(completionOptions);
    assert.equal(completedRepair.status, "committed");
    assert.equal(completedRepair.generation.generation, "2");
    assert.equal(completedRepair.generation.value.status, "proved");
    assert.equal(completedRepair.generation.repair_intents.length, 0);
    assert.equal(continuityCommits, 1);
    const completionRetry = await completeLineagePlacementRepairEffect(completionOptions);
    assert.equal(completionRetry.status, "already-committed");
    assert.equal(completionRetry.value.completion_result_id,
      completedRepair.value.completion_result_id);
    assert.equal(continuityCommits, 1);
    successor.push(Object.freeze({
      expected_workload_id: successorSet.shards[index].workload_id,
      placement: executed.placement,
      provider_id: executed.value.provider_id,
      resource: successorSet.shards[index].bytes_base64url,
      resource_bytes: fixtureOptions.resourceBytes
    }));
  }
  const successorRecords = successor.map((fixture, index) => record(fixture, index));
  const continued = evaluateReproof(context2, successorRecords, journal1);
  assert.equal(continued.status, "proved");
  assert.equal(continued.available_shards, 3);
  assert.equal(new Set(continued.placements.map(({ provider_id: id }) => id)).size, 3);
  assert.equal(evaluate(
    successorSet.manifest_base64url,
    successor.map((fixture, index) => record(fixture, index)),
    [],
    "1801"
  ).status, "unavailable");
  const journal2 = createConfidentialPlacementJournal({
    evaluation: continued,
    prior_journal_bytes: journal1.bytes,
    reproof_context_bytes: context2.bytes
  });
  const restoredJournal2 = restoreConfidentialPlacementJournal(journal2.bytes);
  assert.equal(restoredJournal2.prior_journal_id, journal1.journal_id);
  assert.equal(restoredJournal2.receipt_high_waters.length, 6);
  const context3 = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "3",
    manifest_bytes: decodeBase64Url(successorSet.manifest_base64url),
    max_proof_age_ms: "500",
    prior_journal_bytes: journal2.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  const oldAbcReplay = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1800",
    journal_bytes: journal2.bytes,
    placements: initialRecords,
    reproof_context_bytes: context3.bytes,
    unavailable_provider_ids: []
  });
  assert.equal(oldAbcReplay.status, "unavailable");
  assert.equal(oldAbcReplay.available_shards, 0);
  assert.ok(oldAbcReplay.placements.every(({ reason }) =>
    reason === "reproof-context-mismatch" || reason === "restart-reproof-required"));
  assert.throws(() => createConfidentialPlacementJournal({
    evaluation: oldAbcReplay,
    prior_journal_bytes: journal2.bytes,
    reproof_context_bytes: context3.bytes
  }), /three-shard reproof evaluation required/u);
  assert.equal(
    restoreConfidentialPlacementJournal(journal2.bytes).journal_id,
    restoredJournal2.journal_id
  );

  const dynamicReplacementDeadlineMs = 3_300_000;
  const dynamicReplacementStartedAt = Date.now();
  const dynamicReplacement = await withinDeadline(
    "127-cycle signed provider-history ceiling",
    dynamicReplacementDeadlineMs,
    async () => {
      let activeFixtures = successor;
      let activeProviderStates = successorProviders.map((endpoint) => Object.freeze({
        endpoint,
        identity: endpoint.identity,
        signerName: "primary"
      }));
      let priorJournal = journal2;
      let prior = restoredJournal2;
      const contextIds = new Set([context1.context_id, context2.context_id]);
      const journalIds = new Set([journal1.journal_id, journal2.journal_id]);
      const providerIds = new Set([
        ...initial.map(({ provider_id: id }) => id),
        ...successor.map(({ provider_id: id }) => id)
      ]);
      const leaseIds = new Set();
      const chainIds = new Set();
      const receiptIds = new Set();
      for (const evaluation of [initialEvaluation, continued]) {
        addDistinctReceiptIds(evaluation, receiptIds);
      }
      for (const highWater of restoredJournal2.receipt_high_waters) {
        assert.equal(leaseIds.has(highWater.lease_id), false);
        assert.equal(chainIds.has(highWater.chain_id), false);
        leaseIds.add(highWater.lease_id);
        chainIds.add(highWater.chain_id);
      }
      assert.equal(providerIds.size, 6);
      assert.deepEqual(
        new Set(restoredJournal2.receipt_high_waters.map(({ provider_id: id }) => id)),
        providerIds
      );
      assert.equal(leaseIds.size, 6);
      assert.equal(chainIds.size, 6);
      assert.equal(receiptIds.size, 6);
      const shardBytes = successorSet.shards.map(({ bytes_base64url: value }) =>
        Buffer.from(value, "base64url"));
      const manifestBytes = decodeBase64Url(successorSet.manifest_base64url);

      for (let cycle = 0; cycle < 127; cycle += 1) {
        assert.ok(successorProviders.every(({ page }) => !page.isClosed()));
        const cycleNumber = cycle + 1;
        const generation = String(Number(prior.generation) + 1);
        const context = cycle === 0
          ? context3
          : createConfidentialPlacementReproofContext({
            epoch_nonce: null,
            generation,
            manifest_bytes: manifestBytes,
            max_proof_age_ms: "500",
            prior_journal_bytes: priorJournal.bytes,
            quorum: 2,
            rotate_epoch: false,
            target_shards: 3
          });
        assert.equal(context.generation, generation);
        assert.equal(context.context.prior_journal_id, prior.journal_id);
        assert.equal(context.epoch_id, restoredJournal2.epoch_id);
        assert.equal(contextIds.has(context.context_id), false);
        contextIds.add(context.context_id);

        const rejectedCurrent = evaluateConfidentialPlacementJournal({
          evaluated_at_ms: "1800",
          journal_bytes: priorJournal.bytes,
          placements: activeFixtures.map((fixture, index) => record(fixture, index)),
          reproof_context_bytes: context.bytes,
          unavailable_provider_ids: []
        });
        assert.equal(rejectedCurrent.generation, generation);
        assert.equal(rejectedCurrent.available_shards, 0);
        assert.ok(rejectedCurrent.placements.every(({ reason, status }) =>
          status === "rejected" && (
            reason === "reproof-context-mismatch" || reason === "restart-reproof-required"
          )));
        assert.equal(rejectedCurrent.journal_id, prior.journal_id);

        const replacementShards = cycleNumber === 1
          ? [0]
          : (cycleNumber === 127 ? [1, 2] : [0, 1, 2]);
        const replacementIdentities = new Map();
        const nextProviderStates = [...activeProviderStates];
        for (const replacementShard of replacementShards) {
          const replacementEndpoint = successorProviders[replacementShard];
          const signerName = `cycle-${String(cycleNumber).padStart(3, "0")}-shard-${replacementShard}`;
          const replacementIdentity = await replacementEndpoint.page.evaluate((name) =>
            globalThis.__MORTALOS_P2P_PLACEMENT__.createSigner(name), signerName);
          assert.equal(providerIds.has(replacementIdentity.key_id), false);
          providerIds.add(replacementIdentity.key_id);
          replacementIdentities.set(replacementShard, replacementIdentity);
          nextProviderStates[replacementShard] = Object.freeze({
            endpoint: replacementEndpoint,
            identity: replacementIdentity,
            signerName
          });
        }

        const nextFixtures = await Promise.all([0, 1, 2].map(async (shardIndex) => {
          const state = nextProviderStates[shardIndex];
          const adaptedProvider = providerAdapter(consumerB, state.endpoint, {
            identity: state.identity,
            reuseStored: true,
            signerName: state.signerName
          });
          if (replacementIdentities.has(shardIndex)) {
            return createStoragePlacementFixture({
              challengeNonceFactory: reproofNonce(context, shardIndex),
              consumer: signer(consumerB),
              provider: adaptedProvider,
              resourceBytes: shardBytes[shardIndex],
              seed: 30_000 + cycle * 16 + shardIndex * 4,
              witnesses: bWitnesses
            });
          }
          return refreshStoragePlacementFixture({
            challengeNonceFactory: reproofNonce(context, shardIndex),
            consumer: signer(consumerB),
            fixture: activeFixtures[shardIndex],
            issuedAtMs: 1600 + activeFixtures[shardIndex].placement.execution_receipts.length * 10 +
              shardIndex,
            provider: adaptedProvider,
            resourceBytes: shardBytes[shardIndex],
            seed: 60_000 + cycle * 16 + shardIndex * 4
          });
        }));
        const nextRecords = nextFixtures.map((fixture, index) => record(fixture, index));
        const nextEvaluation = evaluateReproof(context, nextRecords, priorJournal);
        assert.equal(nextEvaluation.status, "proved");
        assert.equal(nextEvaluation.available_shards, 3);
        assert.equal(nextEvaluation.context_id, context.context_id);
        assert.equal(nextEvaluation.generation, generation);
        assert.equal(nextEvaluation.prior_journal_id, prior.journal_id);
        assert.equal(nextEvaluation.epoch_id, restoredJournal2.epoch_id);
        assert.equal(new Set(nextEvaluation.placements.map(({ provider_id: id }) => id)).size, 3);
        addDistinctReceiptIds(nextEvaluation, receiptIds);

        for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
          const proof = nextEvaluation.placements[shardIndex];
          const previousProof = prior.active_proofs[shardIndex];
          if (replacementIdentities.has(shardIndex)) {
            assert.equal(proof.provider_id, replacementIdentities.get(shardIndex).key_id);
            assert.equal(proof.challenge_sequence, "0");
            assert.equal(proof.previous_execution_receipt_id, null);
            assert.equal(leaseIds.has(proof.lease_id), false);
          } else {
            assert.equal(proof.provider_id, previousProof.provider_id);
            assert.equal(proof.lease_id, previousProof.lease_id);
            assert.equal(proof.challenge_sequence, String(Number(previousProof.challenge_sequence) + 1));
            assert.equal(proof.previous_execution_receipt_id, previousProof.receipt_id);
          }
        }

        const nextJournal = createConfidentialPlacementJournal({
          evaluation: nextEvaluation,
          prior_journal_bytes: priorJournal.bytes,
          reproof_context_bytes: context.bytes
        });
        const committed = nextJournal.journal;
        assert.equal(committed.generation, generation);
        assert.equal(committed.prior_journal_id, prior.journal_id);
        assert.equal(committed.epoch_id, restoredJournal2.epoch_id);
        assert.equal(committed.reproof_context_id, context.context_id);
        for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
          const committedProof = committed.active_proofs[shardIndex];
          const evaluatedProof = nextEvaluation.placements[shardIndex];
          const previousProof = prior.active_proofs[shardIndex];
          assert.equal(committedProof.receipt_id, evaluatedProof.receipt_id);
          assert.equal(committedProof.lease_id, evaluatedProof.lease_id);
          if (replacementIdentities.has(shardIndex)) {
            assert.equal(committedProof.provider_id, replacementIdentities.get(shardIndex).key_id);
            assert.equal(chainIds.has(committedProof.chain_id), false);
            assert.equal(leaseIds.has(committedProof.lease_id), false);
            chainIds.add(committedProof.chain_id);
            leaseIds.add(committedProof.lease_id);
          } else {
            assert.equal(committedProof.provider_id, previousProof.provider_id);
            assert.equal(committedProof.chain_id, previousProof.chain_id);
            assert.equal(committedProof.lease_id, previousProof.lease_id);
          }
        }
        assert.equal(
          committed.receipt_high_waters.length,
          prior.receipt_high_waters.length + replacementShards.length
        );
        assert.equal(new Set(committed.receipt_high_waters.map(({ chain_id: id }) => id)).size,
          committed.receipt_high_waters.length);
        assert.equal(new Set(committed.receipt_high_waters.map(({ receipt_id: id }) => id)).size,
          committed.receipt_high_waters.length);
        assert.ok(nextJournal.bytes.byteLength < 2 * 1024 * 1024);
        assert.equal(journalIds.has(nextJournal.journal_id), false);
        journalIds.add(nextJournal.journal_id);

        activeFixtures = nextFixtures;
        activeProviderStates = nextProviderStates;
        priorJournal = nextJournal;
        prior = committed;
        if (cycleNumber === 1 || cycleNumber % 25 === 0 || cycleNumber === 127) {
          console.log(`- signed provider-history progress: ${cycleNumber}/127 cycles`);
        }
      }

      const finalJournal = restoreConfidentialPlacementJournal(priorJournal.bytes);
      assert.equal(finalJournal.generation, "129");
      assert.equal(finalJournal.receipt_high_waters.length, 384);
      const highWatersByShard = [0, 1, 2].map((shardIndex) =>
        finalJournal.receipt_high_waters.filter((entry) => entry.shard_index === shardIndex).length);
      assert.deepEqual(highWatersByShard, [128, 128, 128]);
      assert.equal(new Set(finalJournal.receipt_high_waters.map(({ chain_id: id }) => id)).size, 384);
      assert.equal(new Set(finalJournal.receipt_high_waters.map(({ lease_id: id }) => id)).size, 384);
      assert.equal(new Set(finalJournal.receipt_high_waters.map(({ provider_id: id }) => id)).size, 384);
      assert.equal(new Set(finalJournal.receipt_high_waters.map(({ receipt_id: id }) => id)).size, 384);
      assert.ok(finalJournal.receipt_high_waters.every(({ receipt_id: id }) => receiptIds.has(id)));
      assert.deepEqual(
        new Set(finalJournal.receipt_high_waters.map(({ chain_id: id }) => id)),
        chainIds
      );
      assert.deepEqual(
        new Set(finalJournal.receipt_high_waters.map(({ lease_id: id }) => id)),
        leaseIds
      );
      assert.deepEqual(
        new Set(finalJournal.receipt_high_waters.map(({ provider_id: id }) => id)),
        providerIds
      );
      assert.equal(contextIds.size, 129);
      assert.equal(journalIds.size, 129);
      assert.equal(providerIds.size, 384);
      assert.equal(leaseIds.size, 384);
      assert.equal(chainIds.size, 384);
      assert.equal(receiptIds.size, 387);
      assert.ok(priorJournal.bytes.byteLength < 2 * 1024 * 1024);

      const context130 = createConfidentialPlacementReproofContext({
        epoch_nonce: null,
        generation: "130",
        manifest_bytes: manifestBytes,
        max_proof_age_ms: "500",
        prior_journal_bytes: priorJournal.bytes,
        quorum: 2,
        rotate_epoch: false,
        target_shards: 3
      });
      assert.equal(context130.context.prior_journal_id, finalJournal.journal_id);
      assert.equal(context130.epoch_id, restoredJournal2.epoch_id);
      assert.equal(contextIds.has(context130.context_id), false);

      const rejectedCurrentAtCeiling = evaluateConfidentialPlacementJournal({
        evaluated_at_ms: "1800",
        journal_bytes: priorJournal.bytes,
        placements: activeFixtures.map((fixture, index) => record(fixture, index)),
        reproof_context_bytes: context130.bytes,
        unavailable_provider_ids: []
      });
      assert.equal(rejectedCurrentAtCeiling.available_shards, 0);
      assert.ok(rejectedCurrentAtCeiling.placements.every(({ reason, status }) =>
        status === "rejected" && (
          reason === "reproof-context-mismatch" || reason === "restart-reproof-required"
        )));

      const exactCeilingBytes = new Uint8Array(priorJournal.bytes);
      const exactCeilingJournalId = finalJournal.journal_id;
      const limitSignerName = "ceiling-plus-one-shard-0";
      const limitIdentity = await successorProviders[0].page.evaluate((name) =>
        globalThis.__MORTALOS_P2P_PLACEMENT__.createSigner(name), limitSignerName);
      assert.equal(providerIds.has(limitIdentity.key_id), false);
      const limitProviderStates = [...activeProviderStates];
      limitProviderStates[0] = Object.freeze({
        endpoint: successorProviders[0],
        identity: limitIdentity,
        signerName: limitSignerName
      });
      const limitFixtures = await Promise.all([0, 1, 2].map(async (shardIndex) => {
        const state = limitProviderStates[shardIndex];
        const adaptedProvider = providerAdapter(consumerB, state.endpoint, {
          identity: state.identity,
          reuseStored: true,
          signerName: state.signerName
        });
        if (shardIndex === 0) {
          return createStoragePlacementFixture({
            challengeNonceFactory: reproofNonce(context130, shardIndex),
            consumer: signer(consumerB),
            provider: adaptedProvider,
            resourceBytes: shardBytes[shardIndex],
            seed: 90_000,
            witnesses: bWitnesses
          });
        }
        return refreshStoragePlacementFixture({
          challengeNonceFactory: reproofNonce(context130, shardIndex),
          consumer: signer(consumerB),
          fixture: activeFixtures[shardIndex],
          issuedAtMs: 1600 + activeFixtures[shardIndex].placement.execution_receipts.length * 10 +
            shardIndex,
          provider: adaptedProvider,
          resourceBytes: shardBytes[shardIndex],
          seed: 90_000 + shardIndex * 4
        });
      }));
      const limitEvaluation = evaluateReproof(
        context130,
        limitFixtures.map((fixture, index) => record(fixture, index)),
        priorJournal
      );
      assert.equal(limitEvaluation.status, "proved");
      assert.equal(limitEvaluation.available_shards, 3);
      assert.equal(limitEvaluation.context_id, context130.context_id);
      assert.equal(limitEvaluation.generation, "130");
      assert.equal(limitEvaluation.prior_journal_id, exactCeilingJournalId);
      assert.equal(limitEvaluation.epoch_id, restoredJournal2.epoch_id);
      const limitReceiptIds = new Set(limitEvaluation.placements.map(({ receipt_id: id }) => id));
      assert.equal(limitReceiptIds.size, 3);
      assert.ok([...limitReceiptIds].every((id) => !receiptIds.has(id)));
      const limitReplacement = limitEvaluation.placements[0];
      assert.equal(limitReplacement.provider_id, limitIdentity.key_id);
      assert.equal(limitReplacement.challenge_sequence, "0");
      assert.equal(limitReplacement.previous_execution_receipt_id, null);
      assert.equal(leaseIds.has(limitReplacement.lease_id), false);
      for (const shardIndex of [1, 2]) {
        const proof = limitEvaluation.placements[shardIndex];
        const previousProof = finalJournal.active_proofs[shardIndex];
        assert.equal(proof.provider_id, previousProof.provider_id);
        assert.equal(proof.lease_id, previousProof.lease_id);
        assert.equal(proof.challenge_sequence, String(Number(previousProof.challenge_sequence) + 1));
        assert.equal(proof.previous_execution_receipt_id, previousProof.receipt_id);
      }
      assert.equal(finalJournal.receipt_high_waters.length + 1, 385);
      assert.equal(highWatersByShard[0] + 1, 129);
      assert.throws(() => createConfidentialPlacementJournal({
        evaluation: limitEvaluation,
        prior_journal_bytes: priorJournal.bytes,
        reproof_context_bytes: context130.bytes
      }), (error) => {
        assert.equal(error.code, "E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT");
        assert.match(error.message, /history is full/u);
        return true;
      });
      assert.equal(priorJournal.journal_id, exactCeilingJournalId);
      assert.deepEqual(new Uint8Array(priorJournal.bytes), exactCeilingBytes);

      const reloadedCeiling = restoreConfidentialPlacementJournal(exactCeilingBytes);
      assert.equal(reloadedCeiling.journal_id, exactCeilingJournalId);
      assert.equal(reloadedCeiling.generation, "129");
      assert.equal(reloadedCeiling.receipt_high_waters.length, 384);
      const oldestAbcReplayAfterReload = evaluateConfidentialPlacementJournal({
        evaluated_at_ms: "1800",
        journal_bytes: exactCeilingBytes,
        placements: initialRecords,
        reproof_context_bytes: context130.bytes,
        unavailable_provider_ids: []
      });
      assert.equal(oldestAbcReplayAfterReload.available_shards, 0);
      assert.ok(oldestAbcReplayAfterReload.placements.every(({ reason, status }) =>
        status === "rejected" && (
          reason === "reproof-context-mismatch" || reason === "restart-reproof-required"
        )));

      const providerSnapshots = await Promise.all(successorProviders.map(({ page }) =>
        page.evaluate(() => globalThis.__MORTALOS_P2P_PLACEMENT__.snapshot())));
      assert.deepEqual(providerSnapshots.map(({ signer_count: count }) => count), [128, 127, 127]);
      assert.ok(providerSnapshots.every(({ private_material_exposed: exposed }) => exposed === false));
      return Object.freeze({
        cycles: 127,
        candidate_available_shards: limitEvaluation.available_shards,
        candidate_high_waters_by_shard_if_committed: [129, 128, 128],
        candidate_high_waters_if_committed: 385,
        distinct_context_ids: contextIds.size,
        distinct_chain_ids: chainIds.size,
        distinct_journal_ids: journalIds.size,
        distinct_lease_ids: leaseIds.size,
        distinct_provider_ids: providerIds.size,
        distinct_receipt_ids: receiptIds.size,
        final_generation: finalJournal.generation,
        final_journal_bytes: exactCeilingBytes.byteLength,
        high_waters: finalJournal.receipt_high_waters.length,
        high_waters_by_shard: highWatersByShard,
        journal_unchanged_after_limit: priorJournal.journal_id === exactCeilingJournalId,
        oldest_abc_available_shards: oldestAbcReplayAfterReload.available_shards,
        private_material_exposed: false
      });
    }
  );
  const dynamicReplacementElapsedMs = Date.now() - dynamicReplacementStartedAt;
  assert.ok(dynamicReplacementElapsedMs <= dynamicReplacementDeadlineMs);

  assert.ok(completedRepair);
  const generation2 = Object.freeze({
    generation: completedRepair.generation.generation,
    generation_base64url: encodeBase64Url(completedRepair.generation.bytes),
    generation_id: completedRepair.generation.generation_id,
    repair_shard_indexes: completedRepair.generation.repair_intents.map(
      ({ shard_index: shardIndex }) => shardIndex
    ),
    status: completedRepair.generation.value.status
  });
  assert.equal(generation2.generation, "2");
  assert.equal(generation2.status, "proved");
  const committed2 = Object.freeze({
    capsule_base64url: encodeBase64Url(completedRepair.capsule_bytes),
    commit_base64url: encodeBase64Url(completedRepair.commit_bytes),
    commit_id: completedRepair.commit.commit_id,
    generation_id: completedRepair.commit.generation_id,
    head_hash: completedRepair.commit.lineage_head_hash,
    private_material_exposed: false
  });
  const actionPlan2 = await consumerB.page.evaluate((value) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.derivePlacementActionPlan(value),
  controllerCandidate(committed2, generation2));
  assert.equal(actionPlan2.non_capability, true);
  assert.equal(actionPlan2.requires_executor_reverification, true);
  assert.equal(actionPlan2.planned_repair_actions.length, 0);
  assert.equal(actionPlan2.verified_placement_receipt_ids.length, 3);
  const convergenceForward = await consumerB.page.evaluate((values) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.convergePlacement(values), [
    controllerCandidate(committed1, generation1),
    controllerCandidate(committed2, generation2)
  ]);
  const convergenceReverse = await consumerB.page.evaluate((values) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.convergePlacement(values), [
    controllerCandidate(committed2, generation2),
    controllerCandidate(committed1, generation1),
    controllerCandidate(committed2, generation2)
  ]);
  assert.equal(convergenceForward.value.status, "converged");
  assert.equal(convergenceForward.value.selected_commit_id, committed2.commit_id);
  assert.equal(convergenceForward.bytes_base64url, convergenceReverse.bytes_base64url);

  await providers[4].page.evaluate(() =>
    globalThis.__MORTALOS_P2P_PLACEMENT__.corruptStoredResource(100));
  const corruptOne = await retrieve(consumerB, providers[4], "corrupt-read-1");
  const goodZero = await retrieve(consumerB, providers[3], "valid-read-0");
  const goodTwo = await retrieve(consumerB, providers[5], "valid-read-2");
  await assert.rejects(
    consumerB.page.evaluate(({ manifest, shards }) =>
      globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.reconstructPackage(manifest, shards), {
      manifest: successorSet.manifest_base64url,
      shards: [corruptOne, goodTwo]
    }),
    /shard|canonical|placement/u
  );
  const recoveredAgain = await consumerB.page.evaluate(({ manifest, shards }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.reconstructPackage(manifest, shards), {
    manifest: successorSet.manifest_base64url,
    shards: [goodZero, goodTwo]
  });
  const decryptedAgain = await consumerB.page.evaluate(({ context, packageValue }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.decryptPackage(context, packageValue), {
    context: confidential,
    packageValue: recoveredAgain.package_base64url
  });
  assert.deepEqual(Buffer.from(decryptedAgain.resource_base64url, "base64url"), resource);

  assert.equal(server.requests.length, requestCountAtCut);
  assert.ok(endpoints.every(({ requestsAfterCut }) => requestsAfterCut.length === 0));
  assert.ok(endpoints.filter(({ page }) => !page.isClosed()).every(({ errors }) => errors.length === 0));
  const publicSnapshots = await Promise.all([
    consumerB.page.evaluate(() => globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.snapshot()),
    ...providers.slice(1).map(({ page }) => page.evaluate(() =>
      globalThis.__MORTALOS_P2P_PLACEMENT__.snapshot()))
  ]);
  assert.doesNotMatch(
    JSON.stringify({
      actionPlan2,
      committed1,
      committed2,
      continued,
      dynamicReplacement,
      publicSnapshots
    }),
    /private[_-]?key|CryptoKey/u
  );

  console.log("MortalOS confidential receipt-gated P2P placement controller: PASS");
  console.log("- browser A encrypted an actual 98,317-byte File for browser B and split only the S4 package into 2-of-3 shards");
  console.log("- three browser providers stored distinct shards over direct WebRTC DataChannels and signed exact workload receipts");
  console.log("- exact freshness boundary passed; one millisecond beyond the bound failed closed");
  console.log("- journal v2 bound every storage challenge to its exact prior head; cumulative A/B/C and D/E/F high-waters survived provider replacement");
  console.log(`- 127 sequential live-browser cycles reached generation ${dynamicReplacement.final_generation} at the exact 384-chain history ceiling (${dynamicReplacement.high_waters_by_shard.join("/")} by shard) with ${dynamicReplacement.distinct_receipt_ids} distinct committed receipts in ${dynamicReplacementElapsedMs}ms`);
  console.log("- cycle 1 replaced shard 0, cycles 2-126 replaced all three shards, and cycle 127 replaced shards 1 and 2; every non-replaced chain advanced by its exact direct successor");
  console.log("- a browser-signed 3-of-3 generation-130 candidate proved, but its 385th total/129th shard-0 chain failed closed without changing the exact ceiling journal");
  console.log("- every next-context current/displaced view and the exact old A/B/C replay after serialized-state reload produced zero proved shards");
  console.log("- local provider-process termination plus a quorum certificate qualified a deterministic repair scheduling plan; browser B renewed all leases under its own non-transferred key");
  console.log("- one failed provider and four separate browser observers received the same challenge over WebRTC; 3-of-4 signed the bounded local no-response window without a global clock");
  console.log("- A committed the degraded generation before B re-verified current evidence and executed shard 0 once through the durable effect-time executor; multi-action automation remains HOLD");
  console.log("- independently ordered generation evidence converged byte-identically without private-key transfer");
  console.log("- after browser A exited, B reconstructed and decrypted exact bytes from 2-of-3; one corrupted shard was rejected");
  console.log("- origin/HTTP/relay requests stayed at zero after the network cut; physical/admin independence remains HOLD");
} finally {
  await Promise.all(endpoints.map(({ browser }) => browser.close().catch(() => {})));
  await server.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}
