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
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import {
  createPlacementFailureCertificateFromChallengeFixture,
  createPlacementLivenessChallengeFixture
} from "../lab/placement/liveness-contract.mjs";
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

function providerAdapter(controller, provider, { reuseStored = false } = {}) {
  return Object.freeze({
    identity: provider.identity,
    sign: (bytes) => pageSign(provider, "primary", bytes),
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
  const livenessChallenge = await createPlacementLivenessChallengeFixture({
    consumer: signer(consumerA),
    lineage_parent_hash: controllerCreated.head_hash,
    manifest_id: shardSet.manifest_id,
    observers: livenessObservers,
    placement: initial[0],
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
  for (let index = 0; index < 3; index += 1) {
    successor.push(await createStoragePlacementFixture({
      challengeNonceFactory: reproofNonce(context2, index),
      consumer: signer(consumerB),
      provider: providerAdapter(consumerB, successorProviders[index]),
      resourceBytes: Buffer.from(successorSet.shards[index].bytes_base64url, "base64url"),
      seed: 80 + index * 4,
      witnesses: bWitnesses
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

  const generation2 = await consumerB.page.evaluate((options) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.createPlacementGeneration(options), {
    capsule_base64url: controllerHanded.capsule_base64url,
    evaluated_at_ms: "1800",
    failure_certificates_base64url: [],
    liveness_responses_base64url: [],
    manifest_base64url: successorSet.manifest_base64url,
    max_proof_age_ms: "500",
    placements: successor.map((fixture, index) => browserRecord(fixture, index)),
    prior_commit_base64url: committed1.commit_base64url,
    prior_generation_base64url: generation1.generation_base64url,
    quorum: 2,
    target_shards: 3
  });
  assert.equal(generation2.generation, "2");
  assert.equal(generation2.status, "proved");
  const committed2 = await consumerB.page.evaluate(({ capsule, generation }) =>
    globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__.commitPlacementGeneration(capsule, generation), {
    capsule: controllerHanded.capsule_base64url,
    generation: generation2.generation_base64url
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
    JSON.stringify({ actionPlan2, committed1, committed2, continued, publicSnapshots }),
    /private[_-]?key|CryptoKey/u
  );

  console.log("MortalOS confidential receipt-gated P2P placement controller: PASS");
  console.log("- browser A encrypted an actual 98,317-byte File for browser B and split only the S4 package into 2-of-3 shards");
  console.log("- three browser providers stored distinct shards over direct WebRTC DataChannels and signed exact workload receipts");
  console.log("- exact freshness boundary passed; one millisecond beyond the bound failed closed");
  console.log("- journal v2 bound every storage challenge to its exact prior head; cumulative A/B/C and D/E/F high-waters survived provider replacement");
  console.log("- exact old A/B/C replay produced zero proved shards against the D/E/F head and could not create or advance a successor journal");
  console.log("- local provider-process termination plus a quorum certificate qualified a deterministic repair scheduling plan; browser B renewed all leases under its own non-transferred key");
  console.log("- one failed provider and four separate browser observers received the same challenge over WebRTC; 3-of-4 signed the bounded local no-response window without a global clock");
  console.log("- A committed the degraded generation before the Lab performed replacement placement; this Lab does not yet execute repair through an effect-time, current-evidence-gated action-plan executor");
  console.log("- independently ordered generation evidence converged byte-identically without private-key transfer");
  console.log("- after browser A exited, B reconstructed and decrypted exact bytes from 2-of-3; one corrupted shard was rejected");
  console.log("- origin/HTTP/relay requests stayed at zero after the network cut; physical/admin independence remains HOLD");
} finally {
  await Promise.all(endpoints.map(({ browser }) => browser.close().catch(() => {})));
  await server.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}
