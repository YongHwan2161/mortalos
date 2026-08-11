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

test("128 signed provider-replacement cycles reach the generated 384-chain ceiling and fail closed at plus one", {
  timeout: 3_600_000
}, async () => {
  const created = await scenarioPromise;
  const replacementProviders = await Promise.all(Array.from(
    { length: 381 },
    () => createPlacementSigner()
  ));
  const epochId = created.journal1.journal.epoch_id;
  const contextIds = new Set([created.context1.context_id]);
  const journalIds = new Set([created.journal1.journal_id]);
  const providerIds = new Set();
  const leaseIds = new Set();
  const executionReceiptIds = new Set();
  let currentFixtures = [...created.abc];
  let currentProviders = [...created.providerSets[0]];
  let currentJournal = created.journal1;
  let displacedFixture = null;
  let oldestReplay = null;
  let replacementCursor = 0;
  const replacementCounts = [0, 0, 0];

  const recordActiveReceipts = (journal) => {
    for (const proof of journal.active_proofs) {
      assert.equal(executionReceiptIds.has(proof.receipt_id), false);
      executionReceiptIds.add(proof.receipt_id);
    }
  };

  const genesis = currentJournal.journal;
  assert.equal(genesis.receipt_high_waters.length, 3);
  assert.deepEqual(
    genesis.receipt_high_waters.map(({ shard_index: shardIndex }) => shardIndex),
    [0, 1, 2]
  );
  recordActiveReceipts(genesis);
  for (const proof of genesis.active_proofs) {
    assert.equal(providerIds.has(proof.provider_id), false);
    assert.equal(leaseIds.has(proof.lease_id), false);
    providerIds.add(proof.provider_id);
    leaseIds.add(proof.lease_id);
  }

  for (let cycle = 1; cycle <= 128; cycle += 1) {
    const prior = currentJournal.journal;
    const issuedAtMs = 1498;
    const evaluatedAt = String(issuedAtMs + 2);
    const context = createConfidentialPlacementReproofContext({
      epoch_nonce: null,
      generation: String(cycle + 1),
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "500",
      prior_journal_bytes: currentJournal.bytes,
      quorum: 2,
      rotate_epoch: false,
      target_shards: 3
    });
    assert.equal(context.generation, String(cycle + 1));
    assert.equal(context.context.prior_journal_id, prior.journal_id);
    assert.equal(context.epoch_id, epochId);
    assert.equal(contextIds.has(context.context_id), false);
    contextIds.add(context.context_id);

    const currentReplay = evaluateContext({
      context,
      evaluatedAt,
      fixtures: currentFixtures,
      priorJournal: currentJournal
    });
    assert.equal(currentReplay.available_shards, 0);
    assert.ok(currentReplay.placements.every(({ reason }) => reason === "reproof-context-mismatch"));
    if (cycle === 128) {
      oldestReplay = evaluateContext({
        context,
        evaluatedAt,
        fixtures: created.abc,
        priorJournal: currentJournal
      });
      assert.equal(oldestReplay.available_shards, 0);
      assert.ok(oldestReplay.placements.every(({ status }) => status === "rejected"));
    }

    const replaceShard = cycle === 1
      ? [true, false, false]
      : cycle === 128
        ? [false, true, true]
        : [true, true, true];
    const nextShards = await Promise.all(Array.from({ length: 3 }, async (_, shardIndex) => {
      if (replaceShard[shardIndex]) {
        if (cycle === 2 && shardIndex === 0) displacedFixture = currentFixtures[shardIndex];
        const provider = replacementProviders[replacementCursor];
        replacementCursor += 1;
        replacementCounts[shardIndex] += 1;
        const fixture = await createStoragePlacementFixture({
          challengeNonceFactory: reproofNonce(context.bytes, shardIndex),
          consumer: created.consumer,
          provider,
          resourceBytes: created.shardSet.shards[shardIndex].bytes,
          seed: 10_000 + replacementCursor * 8 + shardIndex,
          witnesses: created.witnesses
        });
        return { fixture, provider };
      }
      const provider = currentProviders[shardIndex];
      const fixture = await refreshStoragePlacementFixture({
        challengeNonceFactory: reproofNonce(context.bytes, shardIndex),
        consumer: created.consumer,
        fixture: currentFixtures[shardIndex],
        issuedAtMs,
        provider,
        resourceBytes: created.shardSet.shards[shardIndex].bytes,
        seed: 20_000 + cycle * 8 + shardIndex
      });
      return { fixture, provider };
    }));
    const nextFixtures = nextShards.map(({ fixture }) => fixture);
    const nextProviders = nextShards.map(({ provider }) => provider);

    const evaluation = evaluateContext({
      context,
      evaluatedAt,
      fixtures: nextFixtures,
      priorJournal: currentJournal
    });
    assert.equal(evaluation.status, "proved");
    assert.equal(evaluation.available_shards, 3);
    for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
      const previous = prior.active_proofs[shardIndex];
      const next = evaluation.placements[shardIndex];
      if (replaceShard[shardIndex]) {
        assert.equal(next.challenge_sequence, "0");
        assert.equal(next.previous_execution_receipt_id, null);
        assert.notEqual(next.provider_id, previous.provider_id);
        assert.notEqual(next.lease_id, previous.lease_id);
        assert.equal(providerIds.has(next.provider_id), false);
        assert.equal(leaseIds.has(next.lease_id), false);
        providerIds.add(next.provider_id);
        leaseIds.add(next.lease_id);
      } else {
        assert.equal(next.challenge_sequence, String(BigInt(previous.challenge_sequence) + 1n));
        assert.equal(next.previous_execution_receipt_id, previous.receipt_id);
        assert.equal(next.provider_id, previous.provider_id);
        assert.equal(next.lease_id, previous.lease_id);
      }
    }

    const nextJournal = commitContext({
      context,
      evaluation,
      priorJournal: currentJournal
    });
    const restored = nextJournal.journal;
    assert.equal(restored.generation, String(cycle + 1));
    assert.equal(restored.prior_journal_id, prior.journal_id);
    assert.equal(restored.epoch_id, epochId);
    assert.equal(
      restored.receipt_high_waters.length,
      prior.receipt_high_waters.length + replaceShard.filter(Boolean).length
    );
    assert.equal(journalIds.has(restored.journal_id), false);
    journalIds.add(restored.journal_id);
    recordActiveReceipts(restored);

    currentFixtures = nextFixtures;
    currentProviders = nextProviders;
    currentJournal = nextJournal;
  }

  assert.equal(replacementCursor, 381);
  assert.deepEqual(replacementCounts, [127, 127, 127]);
  assert.ok(displacedFixture);

  const finalJournal = restoreConfidentialPlacementJournal(currentJournal.bytes);
  const shardHistoryCounts = [0, 0, 0];
  const chainIds = new Set();
  const highWaterReceiptIds = new Set();
  for (const highWater of finalJournal.receipt_high_waters) {
    shardHistoryCounts[highWater.shard_index] += 1;
    chainIds.add(highWater.chain_id);
    highWaterReceiptIds.add(highWater.receipt_id);
  }
  assert.equal(finalJournal.generation, "129");
  assert.equal(finalJournal.epoch_id, epochId);
  assert.equal(finalJournal.receipt_high_waters.length, 384);
  assert.equal(contextIds.size, 129);
  assert.equal(journalIds.size, 129);
  assert.equal(providerIds.size, 384);
  assert.equal(leaseIds.size, 384);
  assert.equal(chainIds.size, 384);
  assert.equal(highWaterReceiptIds.size, 384);
  assert.equal(executionReceiptIds.size, 387);
  assert.deepEqual(shardHistoryCounts, [128, 128, 128]);
  assert.equal(
    finalJournal.receipt_high_waters.length,
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_total_max
  );
  assert.ok(shardHistoryCounts.every((count) =>
    count === CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_per_shard_max));
  assert.ok(finalJournal.receipt_high_waters.every(({ receipt_id: receiptId }) =>
    executionReceiptIds.has(receiptId)));
  assert.equal(oldestReplay.status, "unavailable");
  assert.equal(oldestReplay.available_shards, 0);

  const overflowContext = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation: "130",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    prior_journal_bytes: currentJournal.bytes,
    quorum: 2,
    rotate_epoch: false,
    target_shards: 3
  });
  assert.equal(overflowContext.context.prior_journal_id, currentJournal.journal_id);
  assert.equal(overflowContext.epoch_id, epochId);
  assert.equal(contextIds.has(overflowContext.context_id), false);

  const currentReplay = evaluateContext({
    context: overflowContext,
    evaluatedAt: "1500",
    fixtures: currentFixtures,
    priorJournal: currentJournal
  });
  assert.equal(currentReplay.available_shards, 0);
  assert.ok(currentReplay.placements.every(({ reason }) => reason === "reproof-context-mismatch"));

  const overflowProvider = await createPlacementSigner();
  const overflowShards = await Promise.all(Array.from({ length: 3 }, async (_, shardIndex) => {
    if (shardIndex === 0) {
      return {
        fixture: await createStoragePlacementFixture({
          challengeNonceFactory: reproofNonce(overflowContext.bytes, shardIndex),
          consumer: created.consumer,
          provider: overflowProvider,
          resourceBytes: created.shardSet.shards[shardIndex].bytes,
          seed: 50_000,
          witnesses: created.witnesses
        }),
        provider: overflowProvider
      };
    }
    const provider = currentProviders[shardIndex];
    return {
      fixture: await refreshStoragePlacementFixture({
        challengeNonceFactory: reproofNonce(overflowContext.bytes, shardIndex),
        consumer: created.consumer,
        fixture: currentFixtures[shardIndex],
        issuedAtMs: 1498,
        provider,
        resourceBytes: created.shardSet.shards[shardIndex].bytes,
        seed: 60_000 + shardIndex
      }),
      provider
    };
  }));
  const overflowFixtures = overflowShards.map(({ fixture }) => fixture);
  const overflowEvaluation = evaluateContext({
    context: overflowContext,
    evaluatedAt: "1500",
    fixtures: overflowFixtures,
    priorJournal: currentJournal
  });
  assert.equal(overflowEvaluation.status, "proved");
  assert.equal(overflowEvaluation.available_shards, 3);
  assert.equal(
    finalJournal.receipt_high_waters.length + 1,
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_total_max + 1
  );
  assert.equal(
    shardHistoryCounts[0] + 1,
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_per_shard_max + 1
  );
  for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
    const prior = finalJournal.active_proofs[shardIndex];
    const next = overflowEvaluation.placements[shardIndex];
    assert.equal(executionReceiptIds.has(next.receipt_id), false);
    if (shardIndex === 0) {
      assert.equal(next.challenge_sequence, "0");
      assert.equal(next.previous_execution_receipt_id, null);
      assert.equal(providerIds.has(next.provider_id), false);
      assert.equal(leaseIds.has(next.lease_id), false);
    } else {
      assert.equal(next.challenge_sequence, String(BigInt(prior.challenge_sequence) + 1n));
      assert.equal(next.previous_execution_receipt_id, prior.receipt_id);
      assert.equal(next.provider_id, prior.provider_id);
      assert.equal(next.lease_id, prior.lease_id);
    }
  }

  const displacedReplayFixtures = [...overflowFixtures];
  displacedReplayFixtures[0] = displacedFixture;
  const displacedReplay = evaluateContext({
    context: overflowContext,
    evaluatedAt: "1500",
    fixtures: displacedReplayFixtures,
    priorJournal: currentJournal
  });
  assert.equal(displacedReplay.available_shards, 2);
  assert.equal(displacedReplay.placements[0].status, "rejected");
  assert.equal(displacedReplay.placements[0].reason, "reproof-context-mismatch");

  const journalBytesBeforeOverflow = new Uint8Array(currentJournal.bytes);
  assert.throws(
    () => commitContext({
      context: overflowContext,
      evaluation: overflowEvaluation,
      priorJournal: currentJournal
    }),
    (error) => error.code === "E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT" &&
      error.message === "journal epoch history is full"
  );
  assert.deepEqual(currentJournal.bytes, journalBytesBeforeOverflow);
  const restoredAfterOverflow = restoreConfidentialPlacementJournal(currentJournal.bytes);
  assert.equal(restoredAfterOverflow.journal_id, finalJournal.journal_id);
  assert.equal(restoredAfterOverflow.generation, "129");
  assert.equal(restoredAfterOverflow.receipt_high_waters.length, 384);
  assert.deepEqual(
    restoredAfterOverflow.receipt_high_waters.map(({ shard_index: shardIndex }) => shardIndex),
    finalJournal.receipt_high_waters.map(({ shard_index: shardIndex }) => shardIndex)
  );
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

test("synthetic parser corpus enforces profile-generated history and document limits without pruning", async () => {
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
