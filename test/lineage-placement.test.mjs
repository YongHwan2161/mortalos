import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import {
  createPlacementFailureCertificateFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { derivePeerId } from "../src/crypto.mjs";
import {
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  handoffContinuity
} from "../src/continuity.mjs";
import { createConfidentialPlacementShardSet } from "../src/placement/confidential.mjs";
import {
  createPlacementFailureCertificate,
  finalizePlacementLivenessChallenge,
  finalizePlacementLivenessObservation,
  preparePlacementLivenessChallenge,
  preparePlacementLivenessObservation,
  verifyPlacementLivenessChallenge
} from "../src/placement/liveness.mjs";
import {
  commitLineagePlacementGeneration,
  convergeLineagePlacementCommits,
  createLineagePlacementGeneration,
  deriveCommittedPlacementActionPlan,
  restoreLineagePlacementGeneration,
  verifyLineagePlacementCommit
} from "../src/placement/lineage-controller.mjs";
import {
  finalizeResourceRevocation,
  prepareResourceRevocation
} from "../src/resource-contract.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

function record(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function generationOptions(fixture, capsuleBytes, placements, evidence = {}, prior = null) {
  return {
    capsule_bytes: capsuleBytes,
    evaluated_at_ms: "1800",
    failure_certificates: evidence.failure_certificates ?? [],
    liveness_responses: evidence.liveness_responses ?? [],
    manifest_bytes: fixture.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    placements,
    prior_commit_bytes: prior?.commit_bytes ?? null,
    prior_generation_bytes: prior?.generation_bytes ?? null,
    quorum: 2,
    target_shards: 3
  };
}

function candidate(committed, generation, capsuleBytes = committed.capsule_bytes) {
  return Object.freeze({
    capsule_bytes: capsuleBytes,
    commit_bytes: committed.commit_bytes,
    generation_bytes: generation.bytes
  });
}

function forgeGenerationNumber(generation, number) {
  const { generation_id: ignored, ...basis } = generation.value;
  const forgedBasis = { ...basis, generation: number };
  return canonicalBytes({
    ...forgedBasis,
    generation_id: domainHash(
      "MortalOS lineage placement generation v1",
      canonicalBytes(forgedBasis)
    )
  });
}

function actionPlanCandidate(committed, generation, {
  observed_at_ms = null,
  observed_liveness_responses = [],
  observed_placements = []
} = {}) {
  return Object.freeze({
    ...candidate(committed, generation),
    observed_at_ms,
    observed_liveness_responses,
    observed_placements
  });
}

async function revokeLease({ consumer, placement, effectiveAtMs, nonceByte }) {
  const lease = JSON.parse(new TextDecoder().decode(placement.lease));
  const body = {
    actor_key_id: consumer.identity.key_id,
    effective_at_ms: effectiveAtMs,
    reason: "consumer-request",
    revocation_nonce: encodeBase64Url(new Uint8Array(16).fill(nonceByte)),
    target_id: lease.lease_id,
    target_kind: "lease"
  };
  const draft = prepareResourceRevocation({
    body,
    lease: placement.lease,
    offer: placement.offer
  });
  return finalizeResourceRevocation({
    body: draft.body,
    lease: placement.lease,
    offer: placement.offer,
    signature: await consumer.sign(draft.signing_message)
  });
}

function unsafeAuthority() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  const custodian = Object.freeze({ key_id: derivePeerId(public_key), public_key });
  return Object.freeze({
    custodian,
    async sign({ message }) {
      return Object.freeze({
        key_id: custodian.key_id,
        signature: `ed25519:${encodeBase64Url(sign(null, message, privateKey))}`
      });
    }
  });
}

async function fixture() {
  const actual = new TextEncoder().encode("MortalOS lineage-bound placement runtime bytes".repeat(60));
  const confidential = await createConfidentialFixture({ custodianCount: 1, resourceBytes: actual });
  const shardSet = createConfidentialPlacementShardSet({
    confidential_package_bytes: confidential.confidentialPackage.packageBytes
  });
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const initial = [];
  for (let index = 0; index < 3; index += 1) {
    initial.push(await createStoragePlacementFixture({
      consumer,
      provider: providers[index],
      resourceBytes: shardSet.shards[index].bytes,
      seed: 20 + index * 4,
      witnesses
    }));
  }
  const repaired = await createStoragePlacementFixture({
    consumer,
    provider: providers[3],
    resourceBytes: shardSet.shards[0].bytes,
    seed: 80,
    witnesses
  });
  return Object.freeze({ actual, consumer, initial, providers, repaired, shardSet, witnesses });
}

const fixturePromise = fixture();

test("lineage generation rejects completed or effectively revoked placement evidence", async () => {
  const storage = await fixturePromise;
  const authority = await createContinuityAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: storage.actual,
    transitionId: "placement-generation-time-create"
  });
  const records = storage.initial.map(record);

  assert.ok(records.every(({ observed_at_ms: observedAt }) => observedAt === "1500"));
  assert.ok(records.every(({ lease }) =>
    JSON.parse(new TextDecoder().decode(lease)).body.ends_at_ms === "8900"));
  assert.throws(() => createLineagePlacementGeneration({
    ...generationOptions(storage, created.capsule_bytes, records),
    evaluated_at_ms: "9000",
    max_proof_age_ms: "8000"
  }), /E_LINEAGE_PLACEMENT_LIVENESS: uncertified-repair-intent/u);

  const revocation = await revokeLease({
    consumer: storage.consumer,
    effectiveAtMs: "1700",
    nonceByte: 118,
    placement: records[0]
  });
  const revokedRecords = [{
    ...records[0],
    revocations: Object.freeze([revocation])
  }, records[1], records[2]];
  assert.throws(() => createLineagePlacementGeneration(
    generationOptions(storage, created.capsule_bytes, revokedRecords)
  ), /E_LINEAGE_PLACEMENT_LIVENESS: uncertified-repair-intent/u);
});

test("current custodian commits a repair plan, successor repairs, and stale origin cannot continue", async () => {
  const storage = await fixturePromise;
  const authorityA = await createContinuityAuthority();
  const authorityB = await createContinuityAuthority();
  const created = await createContinuity({
    authority: authorityA,
    resourceBytes: storage.actual,
    transitionId: "placement-organism-create"
  });
  const initialRecords = storage.initial.map(record);
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    initialRecords.slice(1)
  )), /uncertified-repair-intent/u);
  const failure = await createPlacementFailureCertificateFixture({
    consumer: storage.consumer,
    lineage_parent_hash: created.head_hash,
    manifest_id: storage.shardSet.manifest.manifest_id,
    observers: storage.witnesses,
    placement: storage.initial[0],
    response_window_ms: "5000",
    shard_index: 0
  });
  const rogueObservers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const originalChallenge = verifyPlacementLivenessChallenge(failure.challenge_bytes);
  const rogueDraft = preparePlacementLivenessChallenge({
    ...originalChallenge.body,
    nonce: encodeBase64Url(new Uint8Array(16).fill(111)),
    observer_policy: {
      max_faulty: 1,
      observers: rogueObservers.map(({ identity }) => identity),
      threshold: 3
    }
  });
  const rogueChallenge = finalizePlacementLivenessChallenge({
    body: rogueDraft.body,
    consumer_signature: await storage.consumer.sign(rogueDraft.consumer_signing_message)
  });
  const rogueObservations = [];
  for (const observer of [...rogueObservers]
    .sort((left, right) => left.identity.key_id < right.identity.key_id ? -1 : 1)
    .slice(0, 3)) {
    const observationDraft = preparePlacementLivenessObservation({
      challenge: rogueChallenge,
      observer: observer.identity,
      waited_window_ms: "5000"
    });
    rogueObservations.push(finalizePlacementLivenessObservation({
      challenge: rogueChallenge,
      observer: observer.identity,
      observer_signature: await observer.sign(observationDraft.observer_signing_message),
      waited_window_ms: "5000"
    }));
  }
  const rogueCertificate = createPlacementFailureCertificate({
    challenge: rogueChallenge,
    observations: rogueObservations
  });
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    initialRecords,
    { failure_certificates: [rogueCertificate.bytes] }
  )), /offer-witness-roster-binding/u);
  const rogueConsumer = await createPlacementSigner();
  const rogueConsumerDraft = preparePlacementLivenessChallenge({
    ...originalChallenge.body,
    consumer: rogueConsumer.identity,
    nonce: encodeBase64Url(new Uint8Array(16).fill(112))
  });
  const rogueConsumerChallenge = finalizePlacementLivenessChallenge({
    body: rogueConsumerDraft.body,
    consumer_signature: await rogueConsumer.sign(rogueConsumerDraft.consumer_signing_message)
  });
  const rogueConsumerObservations = [];
  for (const observer of [...storage.witnesses]
    .sort((left, right) => left.identity.key_id < right.identity.key_id ? -1 : 1)
    .slice(0, 3)) {
    const observationDraft = preparePlacementLivenessObservation({
      challenge: rogueConsumerChallenge,
      observer: observer.identity,
      waited_window_ms: "5000"
    });
    rogueConsumerObservations.push(finalizePlacementLivenessObservation({
      challenge: rogueConsumerChallenge,
      observer: observer.identity,
      observer_signature: await observer.sign(observationDraft.observer_signing_message),
      waited_window_ms: "5000"
    }));
  }
  const rogueConsumerCertificate = createPlacementFailureCertificate({
    challenge: rogueConsumerChallenge,
    observations: rogueConsumerObservations
  });
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    initialRecords,
    { failure_certificates: [rogueConsumerCertificate.bytes] }
  )), /lease-consumer-binding/u);
  const latePlacement = await refreshStoragePlacementFixture({
    consumer: storage.consumer,
    fixture: storage.initial[0],
    issuedAtMs: 1400,
    provider: storage.providers[0],
    resourceBytes: storage.shardSet.shards[0].bytes,
    seed: 95
  });
  const lateResponse = await createPlacementLivenessResponseFixture({
    challenge_bytes: failure.challenge_bytes,
    placement: latePlacement,
    provider: storage.providers[0]
  });
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    [record(latePlacement, 0), initialRecords[1], initialRecords[2]],
    {
      failure_certificates: [failure.certificate_bytes],
      liveness_responses: [lateResponse]
    }
  )), /E_LINEAGE_PLACEMENT_LIVENESS/u);
  const generation1 = createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    initialRecords,
    { failure_certificates: [failure.certificate_bytes] }
  ));
  assert.equal(generation1.generation, "1");
  assert.equal(generation1.value.status, "repairing");
  assert.deepEqual(generation1.repair_intents.map(({ shard_index: index }) => index), [0]);
  // commit owns lineage invocation before the first await
  const mutableCapsuleBytes = new Uint8Array(created.capsule_bytes);
  const mutableGenerationBytes = new Uint8Array(generation1.bytes);
  const committed1Promise = commitLineagePlacementGeneration({
    authority: authorityA,
    capsule_bytes: mutableCapsuleBytes,
    generation_bytes: mutableGenerationBytes
  });
  mutableCapsuleBytes.fill(0);
  mutableGenerationBytes.fill(0);
  const committed1 = await committed1Promise;
  assert.equal(verifyLineagePlacementCommit(candidate(committed1, generation1)).status, "verified");
  const actionPlan1 = deriveCommittedPlacementActionPlan(
    actionPlanCandidate(committed1, generation1)
  );
  assert.equal(actionPlan1.non_capability, true);
  assert.equal(actionPlan1.requires_executor_reverification, true);
  assert.equal(actionPlan1.planned_repair_actions.length, 1);
  assert.equal(actionPlan1.verified_placement_receipt_ids.length, 2);
  assert.ok(actionPlan1.planned_repair_actions[0].commit_id === committed1.commit_id);
  assert.deepEqual(
    actionPlan1.planned_repair_actions[0].failure_certificate_ids,
    [failure.certificate_id]
  );
  assert.throws(() => deriveCommittedPlacementActionPlan(actionPlanCandidate(
    committed1,
    generation1,
    {
      observed_at_ms: "1800",
      observed_liveness_responses: [lateResponse],
      observed_placements: [record(latePlacement, 0), initialRecords[1], initialRecords[2]]
    }
  )), /late-proof-conflict/u);

  const request = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: committed1.capsule_bytes,
    phase: "request"
  });
  const proposal = await handoffContinuity({
    authority: authorityA,
    capsuleBytes: committed1.capsule_bytes,
    phase: "propose",
    request
  });
  const handed = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: committed1.capsule_bytes,
    phase: "accept",
    proposal
  });
  authorityA.destroy();

  const repairedRecords = [
    record(storage.repaired, 0),
    record(storage.initial[1], 1),
    record(storage.initial[2], 2)
  ];
  const generation2 = createLineagePlacementGeneration(generationOptions(
    storage,
    handed.capsule_bytes,
    repairedRecords,
    {},
    { commit_bytes: committed1.commit_bytes, generation_bytes: generation1.bytes }
  ));
  assert.equal(generation2.generation, "2");
  assert.equal(generation2.prior_generation_id, generation1.generation_id);
  assert.equal(generation2.prior_commit_head_hash, committed1.head_hash);
  const committed2 = await commitLineagePlacementGeneration({
    authority: authorityB,
    capsule_bytes: handed.capsule_bytes,
    generation_bytes: generation2.bytes
  });
  const generation3 = createLineagePlacementGeneration(generationOptions(
    storage,
    committed2.capsule_bytes,
    repairedRecords,
    {},
    { commit_bytes: committed2.commit_bytes, generation_bytes: generation2.bytes }
  ));
  assert.equal(generation3.generation, "3");
  const repeatedGenerationBytes = forgeGenerationNumber(generation3, "2");
  const repeatedGeneration = restoreLineagePlacementGeneration(repeatedGenerationBytes);
  assert.equal(repeatedGeneration.prior_generation_id, generation2.generation_id);
  await assert.rejects(() => commitLineagePlacementGeneration({
    authority: authorityB,
    capsule_bytes: committed2.capsule_bytes,
    generation_bytes: repeatedGenerationBytes
  }), /E_LINEAGE_PLACEMENT_GENERATION: generation-sequence/u);
  await assert.rejects(() => commitLineagePlacementGeneration({
    authority: authorityB,
    capsule_bytes: committed2.capsule_bytes,
    generation_bytes: forgeGenerationNumber(generation3, "4")
  }), /E_LINEAGE_PLACEMENT_GENERATION: generation-sequence/u);
  assert.throws(
    () => restoreLineagePlacementGeneration(forgeGenerationNumber(generation3, "01")),
    /E_LINEAGE_PLACEMENT_FORMAT: generation/u
  );
  assert.throws(
    () => restoreLineagePlacementGeneration(forgeGenerationNumber(generation3, "9007199254740992")),
    /E_LINEAGE_PLACEMENT_LIMIT: generation/u
  );
  const repeatedTransitionId = `placement-${repeatedGeneration.generation_id.slice("sha256:".length)}`;
  const forgedContinuation = await continueContinuity({
    authority: authorityB,
    capsuleBytes: committed2.capsule_bytes,
    expectedHeadHash: repeatedGeneration.lineage_parent_hash,
    transitionId: repeatedTransitionId
  });
  const forgedCommitBasis = {
    format: "mortalos-lineage-placement-commit/1",
    generation: repeatedGeneration.generation,
    generation_id: repeatedGeneration.generation_id,
    lineage_head_hash: forgedContinuation.head_hash,
    organism_id: repeatedGeneration.organism_id,
    parent_head_hash: repeatedGeneration.lineage_parent_hash,
    transition_id: repeatedTransitionId
  };
  const forgedCommitBytes = canonicalBytes({
    ...forgedCommitBasis,
    commit_id: domainHash(
      "MortalOS lineage placement commit v1",
      canonicalBytes(forgedCommitBasis)
    )
  });
  assert.throws(() => verifyLineagePlacementCommit({
    capsule_bytes: forgedContinuation.capsule_bytes,
    commit_bytes: forgedCommitBytes,
    generation_bytes: repeatedGenerationBytes
  }), /E_LINEAGE_PLACEMENT_COMMIT: generation-sequence/u);
  const actionPlan2 = deriveCommittedPlacementActionPlan(
    actionPlanCandidate(committed2, generation2)
  );
  assert.equal(actionPlan2.status, "proved");
  assert.equal(actionPlan2.planned_repair_actions.length, 0);
  assert.equal(actionPlan2.verified_placement_receipt_ids.length, 3);
  assert.throws(() => deriveCommittedPlacementActionPlan({
    ...actionPlanCandidate(committed1, generation1),
    capsule_bytes: committed2.capsule_bytes
  }), /superseded-generation-plan/u);
  let accessorInvoked = false;
  const accessorPlan = {
    ...actionPlanCandidate(committed2, generation2)
  };
  Object.defineProperty(accessorPlan, "generation_bytes", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return generation2.bytes;
    }
  });
  assert.throws(
    () => deriveCommittedPlacementActionPlan(accessorPlan),
    /E_LINEAGE_PLACEMENT_FORMAT/u
  );
  assert.equal(accessorInvoked, false, "lineage entrypoints must not invoke accessors");

  const sparseCandidates = [];
  sparseCandidates.length = 1;
  assert.throws(
    () => convergeLineagePlacementCommits({ candidates: sparseCandidates }),
    /E_LINEAGE_PLACEMENT_FORMAT/u
  );

  const originalMap = globalThis.Map;
  const proxyPlan = new Proxy(actionPlanCandidate(committed2, generation2), {
    ownKeys(target) {
      globalThis.Map = class PoisonedMap extends originalMap {};
      return Reflect.ownKeys(target);
    }
  });
  let proxyError;
  try {
    try {
      deriveCommittedPlacementActionPlan(proxyPlan);
    } catch (error) {
      proxyError = error;
    }
  } finally {
    globalThis.Map = originalMap;
  }
  assert.match(String(proxyError), /E_LINEAGE_PLACEMENT_RUNTIME: realm-integrity/u);
  assert.equal(new Set(generation2.proofs.map(({ provider_id: id }) => id)).size, 3);
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    committed2.capsule_bytes,
    repairedRecords,
    {},
    { commit_bytes: committed1.commit_bytes, generation_bytes: generation1.bytes }
  )), /stale-prior-generation/u);
  assert.doesNotMatch(JSON.stringify({ actionPlan1, actionPlan2, generation1, generation2 }), /private[_-]?key|CryptoKey/u);

  await assert.rejects(
    continueContinuity({
      authority: authorityA,
      capsuleBytes: handed.capsule_bytes,
      transitionId: "destroyed-origin-repair"
    }),
    /E_CONTINUITY_AUTHORITY/u
  );

  const forward = convergeLineagePlacementCommits({
    candidates: [candidate(committed1, generation1), candidate(committed2, generation2)]
  });
  const reverse = convergeLineagePlacementCommits({
    candidates: [candidate(committed2, generation2), candidate(committed1, generation1), candidate(committed2, generation2)]
  });
  assert.equal(forward.value.status, "converged");
  assert.equal(forward.value.selected_commit_id, committed2.commit_id);
  assert.equal(equalBytes(forward.bytes, reverse.bytes), true);
  const incomplete = convergeLineagePlacementCommits({
    candidates: [candidate(committed2, generation2)]
  });
  assert.equal(incomplete.value.status, "halted");
  assert.equal(incomplete.value.reason, "incomplete-chain");
  assert.throws(() => createLineagePlacementGeneration(generationOptions(
    storage,
    handed.capsule_bytes,
    repairedRecords
  )), /generation-history-reset/u);

  const directory = await mkdtemp(join(tmpdir(), "mortalos-lineage-placement-"));
  try {
    const input = join(directory, "input.json");
    const outputA = join(directory, "a.json");
    const outputB = join(directory, "b.json");
    const encoded = {
      candidates: [candidate(committed1, generation1), candidate(committed2, generation2)].map((entry) => ({
        capsule_base64url: encodeBase64Url(entry.capsule_bytes),
        commit_base64url: encodeBase64Url(entry.commit_bytes),
        generation_base64url: encodeBase64Url(entry.generation_bytes)
      }))
    };
    await writeFile(input, JSON.stringify(encoded));
    const child = fileURLToPath(new URL("./lineage-placement-child.mjs", import.meta.url));
    const first = spawnSync(process.execPath, [child, input, outputA], { encoding: "utf8" });
    const second = spawnSync(process.execPath, [child, input, outputB], { encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(equalBytes(new Uint8Array(await readFile(outputA)), new Uint8Array(await readFile(outputB))), true);
    assert.equal(equalBytes(new Uint8Array(await readFile(outputA)), forward.bytes), true);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }

  let observedEvents = 0;
  for (let batch = 0; batch < 4; batch += 1) {
    const partitionHealEvents = Array.from({ length: 250 }, (_, seed) =>
      (seed + batch) % 2 === 0
        ? candidate(committed1, generation1)
        : candidate(committed2, generation2));
    const stress = convergeLineagePlacementCommits({ candidates: partitionHealEvents });
    assert.equal(stress.value.status, "converged");
    assert.equal(stress.value.selected_commit_id, committed2.commit_id);
    observedEvents += partitionHealEvents.length;
  }
  assert.equal(observedEvents, 1000);
  assert.equal(
    new Set(actionPlan2.verified_placement_receipt_ids).size,
    actionPlan2.verified_placement_receipt_ids.length
  );
  assert.equal(actionPlan2.planned_repair_actions.length, 0);
});

test("same-parent divergent valid generation commits halt instead of being auto-selected", async () => {
  const storage = await fixturePromise;
  const authority = unsafeAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: storage.actual,
    transitionId: "fork-fixture-create"
  });
  const records = storage.initial.map(record);
  const leftFailure = await createPlacementFailureCertificateFixture({
    consumer: storage.consumer,
    lineage_parent_hash: created.head_hash,
    manifest_id: storage.shardSet.manifest.manifest_id,
    nonce_seed: 101,
    observers: storage.witnesses,
    placement: storage.initial[0],
    shard_index: 0
  });
  const rightFailure = await createPlacementFailureCertificateFixture({
    consumer: storage.consumer,
    lineage_parent_hash: created.head_hash,
    manifest_id: storage.shardSet.manifest.manifest_id,
    nonce_seed: 102,
    observers: storage.witnesses,
    placement: storage.initial[1],
    shard_index: 1
  });
  const left = createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    records,
    { failure_certificates: [leftFailure.certificate_bytes] }
  ));
  const right = createLineagePlacementGeneration(generationOptions(
    storage,
    created.capsule_bytes,
    records,
    { failure_certificates: [rightFailure.certificate_bytes] }
  ));
  const leftCommit = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: created.capsule_bytes,
    generation_bytes: left.bytes
  });
  const rightCommit = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: created.capsule_bytes,
    generation_bytes: right.bytes
  });
  assert.notEqual(left.generation_id, right.generation_id);
  assert.equal(verifyLineagePlacementCommit(candidate(leftCommit, left)).status, "verified");
  assert.equal(verifyLineagePlacementCommit(candidate(rightCommit, right)).status, "verified");
  const forked = convergeLineagePlacementCommits({
    candidates: Array.from({ length: 100 }, (_, seed) => seed % 2 === 0
      ? candidate(leftCommit, left)
      : candidate(rightCommit, right))
  });
  assert.equal(forked.value.status, "halted");
  assert.equal(forked.value.reason, "generation-fork");
  assert.equal(forked.value.selected_commit_id, null);
  assert.equal(forked.value.selected_generation_id, null);
  assert.throws(() => restoreLineagePlacementGeneration(new Uint8Array(left.bytes).fill(0)), /FORMAT/u);
  assert.throws(() => convergeLineagePlacementCommits({
    candidates: [candidate(leftCommit, left, rightCommit.capsule_bytes)]
  }), /E_LINEAGE_PLACEMENT_COMMIT/u);

  const generation2 = createLineagePlacementGeneration(generationOptions(
    storage,
    leftCommit.capsule_bytes,
    records,
    {},
    { commit_bytes: leftCommit.commit_bytes, generation_bytes: left.bytes }
  ));
  const committed2 = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: leftCommit.capsule_bytes,
    generation_bytes: generation2.bytes
  });
  const generation3 = createLineagePlacementGeneration(generationOptions(
    storage,
    committed2.capsule_bytes,
    records,
    {},
    { commit_bytes: committed2.commit_bytes, generation_bytes: generation2.bytes }
  ));
  const committed3 = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: committed2.capsule_bytes,
    generation_bytes: generation3.bytes
  });
  const generation3Sibling = createLineagePlacementGeneration({
    ...generationOptions(
      storage,
      committed2.capsule_bytes,
      records,
      {},
      { commit_bytes: committed2.commit_bytes, generation_bytes: generation2.bytes }
    ),
    evaluated_at_ms: "1799"
  });
  const committed3Sibling = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: committed2.capsule_bytes,
    generation_bytes: generation3Sibling.bytes
  });
  const prefixAt2 = convergeLineagePlacementCommits({
    candidates: [
      candidate(leftCommit, left, committed2.capsule_bytes),
      candidate(committed2, generation2)
    ]
  });
  assert.equal(prefixAt2.value.status, "converged");
  assert.equal(prefixAt2.value.selected_generation_id, generation2.generation_id);

  const missingLatest = convergeLineagePlacementCommits({
    candidates: [
      candidate(leftCommit, left, committed3.capsule_bytes),
      candidate(committed2, generation2, committed3.capsule_bytes)
    ]
  });
  const missingLatestReordered = convergeLineagePlacementCommits({
    candidates: [
      candidate(committed2, generation2, committed3.capsule_bytes),
      candidate(leftCommit, left, committed3.capsule_bytes),
      candidate(leftCommit, left, committed3.capsule_bytes)
    ]
  });
  assert.equal(missingLatest.value.status, "halted");
  assert.equal(missingLatest.value.reason, "incomplete-chain");
  assert.equal(missingLatest.value.selected_commit_id, null);
  assert.equal(equalBytes(missingLatest.bytes, missingLatestReordered.bytes), true);

  const complete = convergeLineagePlacementCommits({
    candidates: [
      candidate(committed2, generation2, committed3.capsule_bytes),
      candidate(committed3, generation3),
      candidate(leftCommit, left, committed3.capsule_bytes)
    ]
  });
  const completeReordered = convergeLineagePlacementCommits({
    candidates: [
      candidate(committed3, generation3),
      candidate(leftCommit, left, committed3.capsule_bytes),
      candidate(committed2, generation2, committed3.capsule_bytes),
      candidate(committed3, generation3)
    ]
  });
  assert.equal(complete.value.status, "converged");
  assert.equal(complete.value.selected_generation_id, generation3.generation_id);
  assert.equal(equalBytes(complete.bytes, completeReordered.bytes), true);

  const missingMiddle = convergeLineagePlacementCommits({
    candidates: [
      candidate(leftCommit, left, committed3.capsule_bytes),
      candidate(committed3, generation3)
    ]
  });
  assert.equal(missingMiddle.value.status, "halted");
  assert.equal(missingMiddle.value.reason, "incomplete-chain");

  const unrepresentedSiblingTip = convergeLineagePlacementCommits({
    candidates: [
      candidate(leftCommit, left, committed3Sibling.capsule_bytes),
      candidate(committed2, generation2, committed3.capsule_bytes),
      candidate(committed3, generation3)
    ]
  });
  assert.equal(unrepresentedSiblingTip.value.status, "halted");
  assert.equal(unrepresentedSiblingTip.value.reason, "incomplete-chain");
  const representedSiblingFork = convergeLineagePlacementCommits({
    candidates: [
      candidate(leftCommit, left),
      candidate(committed2, generation2),
      candidate(committed3, generation3),
      candidate(committed3Sibling, generation3Sibling)
    ]
  });
  assert.equal(representedSiblingFork.value.status, "halted");
  assert.equal(representedSiblingFork.value.reason, "generation-fork");

  const nonPlacementTail = await continueContinuity({
    authority,
    capsuleBytes: leftCommit.capsule_bytes,
    transitionId: "lineage-non-placement-tail"
  });
  const historicalWithNonPlacementTail = convergeLineagePlacementCommits({
    candidates: [candidate(leftCommit, left, nonPlacementTail.capsule_bytes)]
  });
  assert.equal(historicalWithNonPlacementTail.value.status, "converged");
  assert.equal(historicalWithNonPlacementTail.value.selected_generation_id, left.generation_id);
});
