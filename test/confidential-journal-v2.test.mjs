import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS,
  createConfidentialPlacementJournal,
  createConfidentialPlacementReproofContext,
  createConfidentialPlacementShardSet,
  deriveConfidentialPlacementReproofNonce,
  evaluateConfidentialPlacementJournal,
  evaluateConfidentialPlacementReproof,
  evaluateConfidentialStoragePlacements,
  restoreConfidentialPlacementJournal,
  restoreConfidentialPlacementReproofContext,
  restoreLegacyConfidentialPlacementJournal
} from "../src/placement/confidential.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

const JOURNAL_DOMAIN = "MortalOS confidential placement journal v2";
const LEGACY_JOURNAL_DOMAIN = "MortalOS confidential placement journal v1";
const CHAIN_DOMAIN = "MortalOS confidential placement receipt chain v1";
const REPROOF_CONTEXT_DOMAIN = "MortalOS confidential placement reproof context v1";

function withIndex(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function reproofNonce(contextBytes, shardIndex) {
  return (identity) => deriveConfidentialPlacementReproofNonce({
    ...identity,
    reproof_context_bytes: contextBytes,
    shard_index: shardIndex
  });
}

async function createBoundSet({
  consumer,
  context,
  providers,
  seed,
  shardSet,
  witnesses
}) {
  const fixtures = [];
  for (let index = 0; index < 3; index += 1) {
    fixtures.push(await createStoragePlacementFixture({
      challengeNonceFactory: reproofNonce(context.bytes, index),
      consumer,
      provider: providers[index],
      resourceBytes: shardSet.shards[index].bytes,
      seed: seed + index * 4,
      witnesses
    }));
  }
  return fixtures;
}

function evaluateContext({ context, fixtures, priorJournal = null, evaluatedAt = "1500" }) {
  return evaluateConfidentialPlacementReproof({
    evaluated_at_ms: evaluatedAt,
    placements: fixtures.map((fixture, index) => withIndex(fixture, index)),
    prior_journal_bytes: priorJournal?.bytes ?? null,
    reproof_context_bytes: context.bytes,
    unavailable_provider_ids: []
  });
}

function commitContext({ context, evaluation, priorJournal = null }) {
  return createConfidentialPlacementJournal({
    evaluation,
    prior_journal_bytes: priorJournal?.bytes ?? null,
    reproof_context_bytes: context.bytes
  });
}

async function scenario() {
  const confidential = await createConfidentialFixture({
    custodianCount: 1,
    resourceBytes: new TextEncoder().encode("journal-v2-replay-barrier".repeat(64))
  });
  const shardSet = createConfidentialPlacementShardSet({
    confidential_package_bytes: confidential.confidentialPackage.packageBytes
  });
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providerSets = await Promise.all(Array.from({ length: 4 }, async () =>
    Promise.all(Array.from({ length: 3 }, () => createPlacementSigner()))));
  const context1 = createConfidentialPlacementReproofContext({
    epoch_nonce: new Uint8Array(32).fill(17),
    generation: "1",
    manifest_bytes: shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: null,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  });
  const abc = await createBoundSet({
    consumer,
    context: context1,
    providers: providerSets[0],
    seed: 10,
    shardSet,
    witnesses
  });
  const evaluation1 = evaluateContext({ context: context1, fixtures: abc });
  const journal1 = commitContext({ context: context1, evaluation: evaluation1 });
  const context2 = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "2",
    manifest_bytes: shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: journal1.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  const def = await createBoundSet({
    consumer,
    context: context2,
    providers: providerSets[1],
    seed: 40,
    shardSet,
    witnesses
  });
  const evaluation2 = evaluateContext({
    context: context2,
    fixtures: def,
    priorJournal: journal1
  });
  const journal2 = commitContext({
    context: context2,
    evaluation: evaluation2,
    priorJournal: journal1
  });
  const context3 = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "3",
    manifest_bytes: shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: journal2.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  return {
    abc,
    consumer,
    context1,
    context2,
    context3,
    def,
    journal1,
    journal2,
    providerSets,
    shardSet,
    witnesses
  };
}

const scenarioPromise = scenario();

test("journal v2 keeps A/B/C barriers after D/E/F replacement and rejects old or unseen receipts", async () => {
  const created = await scenarioPromise;
  assert.equal(Object.isFrozen(created.journal2.journal.active_proofs), true);
  assert.ok(created.journal2.journal.active_proofs.every((proof) => Object.isFrozen(proof)));
  const restored = restoreConfidentialPlacementJournal(created.journal2.bytes);
  assert.equal(restored.active_proofs.length, 3);
  assert.equal(restored.receipt_high_waters.length, 6);
  assert.equal(restored.prior_journal_id, created.journal1.journal_id);

  const replayed = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1500",
    journal_bytes: created.journal2.bytes,
    placements: created.abc.map((fixture, index) => withIndex(fixture, index)),
    reproof_context_bytes: created.context3.bytes,
    unavailable_provider_ids: []
  });
  assert.equal(replayed.available_shards, 0);
  assert.ok(replayed.placements.every(({ reason }) =>
    reason === "reproof-context-mismatch" || reason === "restart-reproof-required"));

  const unseen = [];
  for (let index = 0; index < 3; index += 1) {
    unseen.push(await createStoragePlacementFixture({
      consumer: created.consumer,
      provider: created.providerSets[2][index],
      resourceBytes: created.shardSet.shards[index].bytes,
      seed: 70 + index * 4,
      witnesses: created.witnesses
    }));
  }
  const unseenReplay = evaluateContext({
    context: created.context3,
    fixtures: unseen,
    priorJournal: created.journal2
  });
  assert.equal(unseenReplay.available_shards, 0);
  assert.ok(unseenReplay.placements.every(({ reason }) => reason === "reproof-context-mismatch"));

  const newLeases = await createBoundSet({
    consumer: created.consumer,
    context: created.context3,
    providers: created.providerSets[0],
    seed: 100,
    shardSet: created.shardSet,
    witnesses: created.witnesses
  });
  const newLeaseEvaluation = evaluateContext({
    context: created.context3,
    fixtures: newLeases,
    priorJournal: created.journal2
  });
  assert.equal(newLeaseEvaluation.status, "proved");
  const journal3 = commitContext({
    context: created.context3,
    evaluation: newLeaseEvaluation,
    priorJournal: created.journal2
  });
  assert.equal(restoreConfidentialPlacementJournal(journal3.bytes).receipt_high_waters.length, 9);
});

test("existing receipt chains require exact direct successors and the current derived nonce", async () => {
  const created = await scenarioPromise;
  const context3Bound = await createBoundSet({
    consumer: created.consumer,
    context: created.context3,
    providers: created.providerSets[2],
    seed: 130,
    shardSet: created.shardSet,
    witnesses: created.witnesses
  });
  const evaluation3 = evaluateContext({
    context: created.context3,
    fixtures: context3Bound,
    priorJournal: created.journal2
  });
  const journal3 = commitContext({
    context: created.context3,
    evaluation: evaluation3,
    priorJournal: created.journal2
  });
  const context4 = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "4",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: journal3.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  const refreshed = [];
  for (let index = 0; index < 3; index += 1) {
    refreshed.push(await refreshStoragePlacementFixture({
      challengeNonceFactory: reproofNonce(context4.bytes, index),
      consumer: created.consumer,
      fixture: context3Bound[index],
      issuedAtMs: 1600 + index,
      provider: created.providerSets[2][index],
      resourceBytes: created.shardSet.shards[index].bytes,
      seed: 160 + index
    }));
  }
  const direct = evaluateContext({
    context: context4,
    evaluatedAt: "1700",
    fixtures: refreshed,
    priorJournal: journal3
  });
  assert.equal(direct.status, "proved");

  const arbitraryNonce = [];
  for (let index = 0; index < 3; index += 1) {
    arbitraryNonce.push(await refreshStoragePlacementFixture({
      consumer: created.consumer,
      fixture: context3Bound[index],
      issuedAtMs: 1600 + index,
      provider: created.providerSets[2][index],
      resourceBytes: created.shardSet.shards[index].bytes,
      seed: 190 + index
    }));
  }
  const wrongContext = evaluateContext({
    context: context4,
    evaluatedAt: "1700",
    fixtures: arbitraryNonce,
    priorJournal: journal3
  });
  assert.equal(wrongContext.available_shards, 0);
  assert.ok(wrongContext.placements.every(({ reason }) => reason === "reproof-context-mismatch"));
});

test("epoch rotation resets bounded history only after three receipts bind the new epoch", async () => {
  const created = await scenarioPromise;
  const rotation = createConfidentialPlacementReproofContext({
    epoch_nonce: new Uint8Array(32).fill(199),
    generation: "3",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: created.journal2.bytes,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  });
  assert.notEqual(rotation.epoch_id, created.context3.epoch_id);
  assert.equal(
    restoreConfidentialPlacementReproofContext(rotation.bytes).epoch_parent_journal_id,
    created.journal2.journal_id
  );
  const oldEpoch = evaluateContext({
    context: rotation,
    fixtures: created.def,
    priorJournal: created.journal2
  });
  assert.equal(oldEpoch.available_shards, 0);
  const freshEpoch = await createBoundSet({
    consumer: created.consumer,
    context: rotation,
    providers: created.providerSets[3],
    seed: 235,
    shardSet: created.shardSet,
    witnesses: created.witnesses
  });
  const freshEvaluation = evaluateContext({
    context: rotation,
    fixtures: freshEpoch,
    priorJournal: created.journal2
  });
  assert.equal(freshEvaluation.status, "proved");
  const rotatedJournal = commitContext({
    context: rotation,
    evaluation: freshEvaluation,
    priorJournal: created.journal2
  });
  const restored = restoreConfidentialPlacementJournal(rotatedJournal.bytes);
  assert.equal(restored.receipt_high_waters.length, 3);
  assert.equal(restored.epoch_id, rotation.epoch_id);
});

test("v1 is metadata-only migration input and cannot seed a v2 high-water", async () => {
  const created = await scenarioPromise;
  const records = created.abc.map((fixture, index) => withIndex(fixture, index));
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: "1500",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    placements: records,
    quorum: 2,
    target_shards: 3,
    unavailable_provider_ids: []
  });
  const legacyBasis = {
    format: "mortalos-confidential-placement-journal/1",
    generation: "7",
    manifest_base64url: encodeBase64Url(created.shardSet.manifest_bytes),
    manifest_id: evaluation.manifest_id,
    max_proof_age_ms: "500",
    proofs: evaluation.placements.map((placement) => ({
      challenge_sequence: placement.challenge_sequence,
      provider_id: placement.provider_id,
      receipt_id: placement.receipt_id,
      shard_index: placement.shard_index
    })),
    quorum: 2,
    target_shards: 3
  };
  const legacyId = domainHash(LEGACY_JOURNAL_DOMAIN, canonicalBytes(legacyBasis));
  const legacyBytes = canonicalBytes({ ...legacyBasis, journal_id: legacyId });
  const legacy = restoreLegacyConfidentialPlacementJournal(legacyBytes);
  assert.equal(legacy.migration_required, true);
  assert.throws(
    () => restoreConfidentialPlacementJournal(legacyBytes),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_MIGRATION"
  );
  assert.throws(() => createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "8",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: legacyBytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  }), /explicit 256-bit rotation nonce/u);
  const migrationContext = createConfidentialPlacementReproofContext({
    epoch_nonce: new Uint8Array(32).fill(201),
    generation: "8",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: legacyBytes,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  });
  const replay = evaluateConfidentialPlacementReproof({
    evaluated_at_ms: "1500",
    placements: records,
    prior_journal_bytes: legacyBytes,
    reproof_context_bytes: migrationContext.bytes,
    unavailable_provider_ids: []
  });
  assert.equal(replay.available_shards, 0);
  assert.ok(replay.placements.every(({ reason }) => reason === "reproof-context-mismatch"));
  const migrated = await createBoundSet({
    consumer: created.consumer,
    context: migrationContext,
    providers: created.providerSets[3],
    seed: 260,
    shardSet: created.shardSet,
    witnesses: created.witnesses
  });
  const migrationEvaluation = evaluateContext({
    context: migrationContext,
    fixtures: migrated,
    priorJournal: { bytes: legacyBytes }
  });
  assert.equal(migrationEvaluation.status, "proved");
  const migratedJournal = commitContext({
    context: migrationContext,
    evaluation: migrationEvaluation,
    priorJournal: { bytes: legacyBytes }
  });
  const restoredMigration = restoreConfidentialPlacementJournal(migratedJournal.bytes);
  assert.equal(restoredMigration.prior_journal_id, legacyId);
  assert.equal(restoredMigration.receipt_high_waters.length, 3);
});

function tagged(prefix, seed) {
  return `${prefix}${domainHash(`test-${seed}`, new Uint8Array([seed & 0xff])).slice(7)}`;
}

function syntheticHighWater(shardIndex, seed, manifestId) {
  const value = {
    challenge_sequence: "0",
    lease_id: tagged("resource-lease:", seed * 7 + 1),
    previous_execution_receipt_id: null,
    provider_id: tagged("peer:", seed * 7 + 2),
    receipt_id: tagged("resource-execution:", seed * 7 + 3),
    shard_index: shardIndex,
    workload_id: tagged("resource-workload:", seed * 7 + 4)
  };
  return {
    chain_id: domainHash(CHAIN_DOMAIN, canonicalBytes({
      lease_id: value.lease_id,
      manifest_id: manifestId,
      provider_id: value.provider_id,
      shard_index: shardIndex,
      workload_id: value.workload_id
    })),
    ...value
  };
}

function selfHashJournal(value) {
  const { journal_id: ignored, ...basis } = value;
  return canonicalBytes({
    ...basis,
    journal_id: domainHash(JOURNAL_DOMAIN, canonicalBytes(basis))
  });
}

function selfHashReproofContext(value) {
  const { context_id: ignored, ...basis } = value;
  return canonicalBytes({
    ...basis,
    context_id: domainHash(REPROOF_CONTEXT_DOMAIN, canonicalBytes(basis))
  });
}

function sharedCopy(bytes) {
  const shared = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
  shared.set(bytes);
  return shared;
}

test("profile-generated history and document limits fail closed without pruning", async () => {
  const created = await scenarioPromise;
  assert.deepEqual(CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS, {
    document_bytes: 2 * 1024 * 1024,
    epoch_nonce_bytes: 32,
    head_transitions_max: 4096,
    high_waters_per_shard_max: 128,
    high_waters_total_max: 384,
    reproof_nonce_bytes: 16
  });
  const restored = restoreConfidentialPlacementJournal(created.journal1.bytes);
  const exact = [...created.journal1.journal.receipt_high_waters];
  for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
    for (let index = 0; index < 127; index += 1) {
      exact.push(syntheticHighWater(
        shardIndex,
        1000 + shardIndex * 1000 + index,
        restored.manifest.manifest_id
      ));
    }
  }
  exact.sort((left, right) => left.shard_index - right.shard_index ||
    (left.chain_id < right.chain_id ? -1 : 1));
  const exactBytes = selfHashJournal({
    ...created.journal1.journal,
    receipt_high_waters: exact
  });
  assert.equal(restoreConfidentialPlacementJournal(exactBytes).receipt_high_waters.length, 384);

  const plusOne = [...exact, syntheticHighWater(0, 5000, restored.manifest.manifest_id)];
  plusOne.sort((left, right) => left.shard_index - right.shard_index ||
    (left.chain_id < right.chain_id ? -1 : 1));
  assert.throws(
    () => restoreConfidentialPlacementJournal(selfHashJournal({
      ...created.journal1.journal,
      receipt_high_waters: plusOne
    })),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_LIMIT"
  );
  const shardPlusOne = [...created.journal1.journal.receipt_high_waters];
  for (let index = 0; index < 128; index += 1) {
    shardPlusOne.push(syntheticHighWater(0, 6000 + index, restored.manifest.manifest_id));
  }
  shardPlusOne.sort((left, right) => left.shard_index - right.shard_index ||
    (left.chain_id < right.chain_id ? -1 : 1));
  assert.throws(
    () => restoreConfidentialPlacementJournal(selfHashJournal({
      ...created.journal1.journal,
      receipt_high_waters: shardPlusOne
    })),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT"
  );
  assert.throws(
    () => restoreConfidentialPlacementJournal(
      new Uint8Array(CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes + 1)
    ),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_FORMAT"
  );
  assert.throws(() => createConfidentialPlacementReproofContext({
    epoch_nonce: new Uint8Array(32).fill(1),
    generation: "2",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: null,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  }), /must start at generation 1/u);
});

test("context and journal tampering, accessors, and stale 3-of-3 evidence cannot advance", async () => {
  const created = await scenarioPromise;
  const openedContext = JSON.parse(new TextDecoder().decode(created.context3.bytes));
  assert.throws(
    () => restoreConfidentialPlacementReproofContext(canonicalBytes({
      ...openedContext,
      generation: "4"
    })),
    /context ID mismatch/u
  );
  const openedJournal = JSON.parse(new TextDecoder().decode(created.journal2.bytes));
  assert.throws(
    () => restoreConfidentialPlacementJournal(canonicalBytes({
      ...openedJournal,
      receipt_high_waters: openedJournal.receipt_high_waters.slice(1)
    })),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_JOURNAL"
  );
  let gets = 0;
  const nonceOptions = {
    challenge_sequence: "0",
    lease_id: tagged("resource-lease:", 8001),
    previous_execution_receipt_id: null,
    provider_id: tagged("peer:", 8002),
    reproof_context_bytes: created.context3.bytes,
    shard_index: 0,
    workload_id: tagged("resource-workload:", 8003)
  };
  Object.defineProperty(nonceOptions, "provider_id", {
    enumerable: true,
    get() {
      gets += 1;
      return tagged("peer:", 8002);
    }
  });
  assert.throws(
    () => deriveConfidentialPlacementReproofNonce(nonceOptions),
    /own data properties/u
  );
  assert.equal(gets, 0);

  const fresh = await createBoundSet({
    consumer: created.consumer,
    context: created.context3,
    providers: created.providerSets[3],
    seed: 220,
    shardSet: created.shardSet,
    witnesses: created.witnesses
  });
  const stale = evaluateContext({
    context: created.context3,
    evaluatedAt: "1801",
    fixtures: fresh,
    priorJournal: created.journal2
  });
  assert.equal(stale.status, "unavailable");
  assert.throws(() => commitContext({
    context: created.context3,
    evaluation: stale,
    priorJournal: created.journal2
  }), /three-shard reproof evaluation required/u);
});

test("a self-rehashed non-genesis context cannot manufacture a generation-4096 genesis", async () => {
  const created = await scenarioPromise;
  const opened = JSON.parse(new TextDecoder().decode(created.context1.bytes));
  const forgedContextBytes = selfHashReproofContext({
    ...opened,
    generation: "4096"
  });
  const validEvaluation = evaluateContext({
    context: created.context1,
    fixtures: created.abc
  });
  const rejectsForgedGenesis = (error) =>
    error.code === "E_CONFIDENTIAL_PLACEMENT_REPROOF" &&
    /genesis reproof context must be generation 1/u.test(error.message);

  assert.throws(
    () => restoreConfidentialPlacementReproofContext(forgedContextBytes),
    rejectsForgedGenesis
  );
  assert.throws(() => evaluateConfidentialPlacementReproof({
    evaluated_at_ms: "1500",
    placements: created.abc.map((fixture, index) => withIndex(fixture, index)),
    prior_journal_bytes: null,
    reproof_context_bytes: forgedContextBytes,
    unavailable_provider_ids: []
  }), rejectsForgedGenesis);
  assert.throws(() => createConfidentialPlacementJournal({
    evaluation: validEvaluation,
    prior_journal_bytes: null,
    reproof_context_bytes: forgedContextBytes
  }), rejectsForgedGenesis);
});

test("shared-memory documents and nested placement evidence fail closed", async () => {
  const created = await scenarioPromise;
  const rejectsSharedMemory = (error) =>
    error.code === "E_CONFIDENTIAL_PLACEMENT_FORMAT" &&
    /must not use shared memory/u.test(error.message);

  assert.throws(() => createConfidentialPlacementReproofContext({
    epoch_nonce: new Uint8Array(32).fill(31),
    generation: "1",
    manifest_bytes: sharedCopy(created.shardSet.manifest_bytes),
    max_proof_age_ms: "500",
    prior_journal_bytes: null,
    quorum: 2,
    rotate_epoch: true,
    target_shards: 3
  }), rejectsSharedMemory);
  assert.throws(
    () => restoreConfidentialPlacementReproofContext(sharedCopy(created.context1.bytes)),
    rejectsSharedMemory
  );
  assert.throws(() => evaluateConfidentialPlacementReproof({
    evaluated_at_ms: "1500",
    placements: created.def.map((fixture, index) => withIndex(fixture, index)),
    prior_journal_bytes: sharedCopy(created.journal1.bytes),
    reproof_context_bytes: created.context2.bytes,
    unavailable_provider_ids: []
  }), rejectsSharedMemory);
  assert.throws(
    () => restoreConfidentialPlacementJournal(sharedCopy(created.journal2.bytes)),
    rejectsSharedMemory
  );
  assert.throws(() => evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1500",
    journal_bytes: sharedCopy(created.journal2.bytes),
    placements: created.def.map((fixture, index) => withIndex(fixture, index)),
    reproof_context_bytes: created.context3.bytes,
    unavailable_provider_ids: []
  }), rejectsSharedMemory);

  const placements = created.def.map((fixture, index) => withIndex(fixture, index));
  placements[0] = {
    ...placements[0],
    execution_receipts: placements[0].execution_receipts.map(sharedCopy)
  };
  const nested = evaluateConfidentialPlacementReproof({
    evaluated_at_ms: "1500",
    placements,
    prior_journal_bytes: created.journal1.bytes,
    reproof_context_bytes: created.context2.bytes,
    unavailable_provider_ids: []
  });
  assert.equal(nested.status, "repairing");
  assert.equal(nested.available_shards, 2);
  assert.equal(nested.placements[0].reason, "invalid-evidence");
  assert.throws(() => createConfidentialPlacementJournal({
    evaluation: nested,
    prior_journal_bytes: created.journal1.bytes,
    reproof_context_bytes: created.context2.bytes
  }), /three-shard reproof evaluation required/u);
});
