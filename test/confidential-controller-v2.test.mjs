import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  access,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serialize } from "node:v8";
import {
  beginConfidentialPlacementReproof,
  commitConfidentialPlacementJournal,
  loadConfidentialPlacementJournal
} from "../lab/placement/confidential-controller.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { decodeBase64Url, encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS,
  createConfidentialPlacementJournal,
  createConfidentialPlacementReproofContext,
  createConfidentialPlacementShardSet,
  deriveConfidentialPlacementReproofNonce,
  evaluateConfidentialPlacementReproof,
  evaluateConfidentialStoragePlacements,
  restoreConfidentialPlacementJournal,
  restoreConfidentialPlacementReproofContext
} from "../src/placement/confidential.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

const CHILD = fileURLToPath(new URL("./confidential-controller-child.mjs", import.meta.url));
const JOURNAL_DOMAIN = "MortalOS confidential placement journal v2";
const LEGACY_JOURNAL_DOMAIN = "MortalOS confidential placement journal v1";
const TRANSITION_DOMAIN = "MortalOS confidential placement transition v1";
const TRANSITION_FORMAT = "mortalos-confidential-placement-transition/1";
let documentSequence = 0;

function withIndex(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function records(fixtures) {
  return fixtures.map((fixture, index) => withIndex(fixture, index));
}

function reproofNonce(contextBytes, shardIndex) {
  return (identity) => deriveConfidentialPlacementReproofNonce({
    ...identity,
    reproof_context_bytes: contextBytes,
    shard_index: shardIndex
  });
}

async function createBoundSet({ consumer, contextBytes, providers, seed, shardSet, witnesses }) {
  return Promise.all(Array.from({ length: 3 }, (_, index) =>
    createStoragePlacementFixture({
      challengeNonceFactory: reproofNonce(contextBytes, index),
      consumer,
      provider: providers[index],
      resourceBytes: shardSet.shards[index].bytes,
      seed: seed + index * 4,
      witnesses
    })));
}

async function createUnboundSet({ consumer, providers, seed, shardSet, witnesses }) {
  return Promise.all(Array.from({ length: 3 }, (_, index) =>
    createStoragePlacementFixture({
      consumer,
      provider: providers[index],
      resourceBytes: shardSet.shards[index].bytes,
      seed: seed + index * 4,
      witnesses
    })));
}

function beginOptions(materials, expectedPriorJournalId, rotateEpoch) {
  return {
    expected_prior_journal_id: expectedPriorJournalId,
    manifest_bytes: materials.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    quorum: 2,
    rotate_epoch: rotateEpoch,
    target_shards: 3
  };
}

function commitInput(fixtures, reproofContextId) {
  return {
    evaluated_at_ms: "1500",
    placements: records(fixtures),
    reproof_context_id: reproofContextId,
    unavailable_provider_ids: []
  };
}

function deriveCandidate({ contextBytes, fixtures, priorJournalBytes }) {
  const evaluation = evaluateConfidentialPlacementReproof({
    evaluated_at_ms: "1500",
    placements: records(fixtures),
    prior_journal_bytes: priorJournalBytes,
    reproof_context_bytes: contextBytes,
    unavailable_provider_ids: []
  });
  assert.equal(evaluation.status, "proved");
  return createConfidentialPlacementJournal({
    evaluation,
    prior_journal_bytes: priorJournalBytes,
    reproof_context_bytes: contextBytes
  });
}

async function writeInput(ioDirectory, label, input) {
  documentSequence += 1;
  const path = join(ioDirectory, `${String(documentSequence).padStart(3, "0")}-${label}.v8`);
  await writeFile(path, serialize(input));
  return path;
}

function runChild(action, directory, documentPath, ...extraArguments) {
  return spawnSync(
    process.execPath,
    [CHILD, action, directory, documentPath, ...extraArguments],
    { encoding: "utf8", timeout: 180_000 }
  );
}

async function commitThroughChild({ controller, fixtures, io, label, reproofContextId }) {
  const input = await writeInput(io, label, commitInput(fixtures, reproofContextId));
  const child = runChild("commit", controller, input);
  assert.equal(child.status, 0, child.stderr);
  return { input, result: JSON.parse(child.stdout) };
}

async function loadThroughChild({ controller, io, label }) {
  const output = join(io, `${label}.json`);
  const child = runChild("load", controller, output);
  assert.equal(child.status, 0, child.stderr);
  return {
    bytes: new Uint8Array(await readFile(output)),
    result: JSON.parse(child.stdout)
  };
}

async function directoryFiles(directory) {
  return (await readdir(directory)).sort();
}

async function waitForFile(path, processes, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      if (processes.some((child) => child.exitCode !== null)) {
        throw new Error("contended child exited before reaching the release barrier");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`timed out waiting for ${path}`);
}

function startContendedCommit({ controller, input, ready, release }) {
  const child = spawn(
    process.execPath,
    [CHILD, "commit-contended", controller, input, ready, release],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const completed = new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({
      code,
      result: stdout.length === 0 ? null : JSON.parse(stdout),
      signal,
      stderr
    }));
  });
  return { child, completed, pid: child.pid };
}

async function assertPidsExited(pids) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  for (const pid of pids) {
    assert.throws(
      () => process.kill(pid, 0),
      (error) => error?.code === "ESRCH",
      `child PID ${pid} must be gone`
    );
  }
}

async function materials() {
  const confidential = await createConfidentialFixture({
    custodianCount: 1,
    resourceBytes: new TextEncoder().encode("durable-controller-v2".repeat(96))
  });
  const shardSet = createConfidentialPlacementShardSet({
    confidential_package_bytes: confidential.confidentialPackage.packageBytes
  });
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providerSets = await Promise.all(Array.from({ length: 8 }, async () =>
    Promise.all(Array.from({ length: 3 }, () => createPlacementSigner()))));
  return { consumer, providerSets, shardSet, witnesses };
}

const materialsPromise = materials();

test("durable v2 head is reproof-gated, cumulative, crash-safe, and single-winner", {
  timeout: 600_000
}, async () => {
  const created = await materialsPromise;
  const root = await mkdtemp(join(tmpdir(), "mortalos-controller-v2-"));
  const controller = join(root, "controller");
  const io = join(root, "io");
  await mkdir(io);
  try {
    const begun1 = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, null, true)
    });
    assert.equal(begun1.status, "begun");
    const context1 = restoreConfidentialPlacementReproofContext(begun1.reproof_context_bytes);
    assert.equal(context1.generation, "1");
    assert.equal(context1.rotate_epoch, true);

    const abc = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context1.bytes,
      providers: created.providerSets[0],
      seed: 20,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const committed1 = await commitThroughChild({
      controller,
      fixtures: abc,
      io,
      label: "generation-1",
      reproofContextId: context1.reproof_context_id
    });
    assert.equal(committed1.result.status, "committed");
    const loaded1 = await loadThroughChild({ controller, io, label: "loaded-generation-1" });
    assert.equal(loaded1.result.generation, "1");
    assert.equal(loaded1.result.journal_id, committed1.result.journal_id);
    assert.equal(
      equalBytes(loaded1.bytes, loadConfidentialPlacementJournal(controller).journal_bytes),
      true
    );

    const begun2 = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, committed1.result.journal_id, false)
    });
    const context2 = restoreConfidentialPlacementReproofContext(begun2.reproof_context_bytes);
    const def = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context2.bytes,
      providers: created.providerSets[1],
      seed: 60,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const committed2 = await commitThroughChild({
      controller,
      fixtures: def,
      io,
      label: "generation-2",
      reproofContextId: context2.reproof_context_id
    });
    const journal2 = loadConfidentialPlacementJournal(controller);
    assert.equal(journal2.journal_id, committed2.result.journal_id);
    assert.equal(journal2.receipt_high_waters.length, 6);

    const begun3 = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, journal2.journal_id, false)
    });
    const context3 = restoreConfidentialPlacementReproofContext(begun3.reproof_context_bytes);

    const beforeReplay = await directoryFiles(controller);
    const replayInput = await writeInput(
      io,
      "old-abc-replay",
      commitInput(abc, context3.reproof_context_id)
    );
    const replay = runChild("commit", controller, replayInput);
    assert.notEqual(replay.status, 0);
    assert.match(replay.stderr, /three-shard reproof evaluation required/u);
    assert.deepEqual(await directoryFiles(controller), beforeReplay);
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, journal2.journal_id);

    const candidateA = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context3.bytes,
      providers: created.providerSets[2],
      seed: 100,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const poisonInput = await writeInput(io, "v2-poison-corpus", {
      evaluated_at_ms: "1500",
      placements: records(candidateA),
      prior_journal_bytes: journal2.journal_bytes,
      reproof_context_bytes: context3.bytes,
      unavailable_provider_ids: []
    });
    const poisoned = runChild("poison", controller, poisonInput);
    assert.equal(poisoned.status, 0, poisoned.stderr);
    const poisonCorpus = JSON.parse(poisoned.stdout);
    for (const result of Object.values(poisonCorpus)) {
      assert.equal(result.journal, null);
      assert.equal(typeof result.error, "string");
    }
    assert.match(poisonCorpus.selective_array_map.error, /realm intrinsic drift/u);
    assert.equal(poisonCorpus.selective_array_map.calls, 0);
    assert.match(poisonCorpus.map_get.error, /realm intrinsic drift/u);
    assert.equal(poisonCorpus.map_get.calls, 0);
    assert.match(poisonCorpus.set_has.error, /realm intrinsic drift/u);
    assert.equal(poisonCorpus.set_has.calls, 0);
    assert.match(poisonCorpus.proxy_array_method.error, /three-shard reproof evaluation required/u);
    assert.equal(poisonCorpus.proxy_array_method.gets, 0);
    assert.match(poisonCorpus.option_accessor.error, /own data properties/u);
    assert.equal(poisonCorpus.option_accessor.gets, 0);
    assert.match(poisonCorpus.option_proxy.error, /three-shard reproof evaluation required/u);
    assert.equal(poisonCorpus.option_proxy.gets, 0);
    assert.match(poisonCorpus.placement_accessor.error, /three-shard reproof evaluation required/u);
    assert.equal(poisonCorpus.placement_accessor.gets, 0);
    assert.match(poisonCorpus.placement_proxy.error, /three-shard reproof evaluation required/u);
    assert.equal(poisonCorpus.placement_proxy.gets, 0);
    assert.match(poisonCorpus.sparse_placements.error, /dense own-data array/u);
    const beforePartial = await directoryFiles(controller);
    const partialInput = await writeInput(
      io,
      "two-of-three-fresh",
      commitInput([candidateA[0], candidateA[1], abc[2]], context3.reproof_context_id)
    );
    const partial = runChild("commit", controller, partialInput);
    assert.notEqual(partial.status, 0);
    assert.match(partial.stderr, /three-shard reproof evaluation required/u);
    assert.deepEqual(await directoryFiles(controller), beforePartial);
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, journal2.journal_id);

    const candidateB = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context3.bytes,
      providers: created.providerSets[3],
      seed: 140,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const derivedA = deriveCandidate({
      contextBytes: context3.bytes,
      fixtures: candidateA,
      priorJournalBytes: journal2.journal_bytes
    });
    const derivedB = deriveCandidate({
      contextBytes: context3.bytes,
      fixtures: candidateB,
      priorJournalBytes: journal2.journal_bytes
    });
    assert.notEqual(derivedA.journal_id, derivedB.journal_id);
    const inputA = await writeInput(
      io,
      "contended-a",
      commitInput(candidateA, context3.reproof_context_id)
    );
    const inputB = await writeInput(
      io,
      "contended-b",
      commitInput(candidateB, context3.reproof_context_id)
    );
    const readyA = join(io, "contended-a.ready");
    const readyB = join(io, "contended-b.ready");
    const release = join(io, "contended.release");
    const contenderA = startContendedCommit({
      controller,
      input: inputA,
      ready: readyA,
      release
    });
    const contenderB = startContendedCommit({
      controller,
      input: inputB,
      ready: readyB,
      release
    });
    const contenders = [contenderA, contenderB];
    await Promise.all([
      waitForFile(readyA, contenders.map(({ child }) => child)),
      waitForFile(readyB, contenders.map(({ child }) => child))
    ]);
    await writeFile(release, "release", { flag: "wx" });
    const outcomes = await Promise.all(contenders.map(({ completed }) => completed));
    assert.ok(outcomes.every(({ code, signal }) => code === 0 && signal === null), outcomes);
    const successes = outcomes.filter(({ result }) => result?.outcome === "success");
    const stale = outcomes.filter(({ result }) =>
      result?.outcome === "error" && /E_CONFIDENTIAL_PLACEMENT_HEAD_STALE/u.test(result.message));
    assert.equal(successes.length, 1, JSON.stringify(outcomes));
    assert.equal(successes[0].result.result.status, "committed");
    assert.equal(stale.length, 1, JSON.stringify(outcomes));
    await assertPidsExited(contenders.map(({ pid }) => pid));

    const winnerJournalId = successes[0].result.result.journal_id;
    const candidates = [
      { derived: derivedA, fixtures: candidateA, input: inputA },
      { derived: derivedB, fixtures: candidateB, input: inputB }
    ];
    const winner = candidates.find(({ derived }) => derived.journal_id === winnerJournalId);
    const loser = candidates.find(({ derived }) => derived.journal_id !== winnerJournalId);
    assert.ok(winner);
    assert.ok(loser);
    const loaded3 = loadConfidentialPlacementJournal(controller);
    assert.equal(loaded3.journal_id, winnerJournalId);
    assert.equal(loaded3.receipt_high_waters.length, 9);

    const idempotent = runChild("commit", controller, winner.input);
    assert.equal(idempotent.status, 0, idempotent.stderr);
    assert.deepEqual(JSON.parse(idempotent.stdout), {
      file: `journal-v2-3-${winnerJournalId.slice(7)}.json`,
      journal_id: winnerJournalId,
      status: "already-committed"
    });
    const staleWriter = runChild("commit", controller, loser.input);
    assert.notEqual(staleWriter.status, 0);
    assert.match(staleWriter.stderr, /E_CONFIDENTIAL_PLACEMENT_HEAD_STALE/u);
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, winnerJournalId);

    const partialPendingNames = [
      `.mortalos-pending-${"A".repeat(22)}`,
      `.mortalos-pending-${"B".repeat(22)}`,
      `.mortalos-pending-${"C".repeat(22)}`
    ];
    for (const [index, name] of partialPendingNames.entries()) {
      await writeFile(join(controller, name), new Uint8Array([123, 34, 120, 34, 58, index]));
    }
    const completePendingName = `.mortalos-pending-${"D".repeat(22)}`;
    const completePendingLinkName = `.mortalos-pending-${"E".repeat(22)}`;
    await writeFile(join(controller, completePendingName), loaded3.journal_bytes, { flag: "wx" });
    await link(
      join(controller, completePendingName),
      join(controller, completePendingLinkName)
    );
    const injectedPendingNames = [
      ...partialPendingNames,
      completePendingName,
      completePendingLinkName
    ].sort();
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, winnerJournalId);

    const begun4 = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, winnerJournalId, false)
    });
    const context4 = restoreConfidentialPlacementReproofContext(begun4.reproof_context_bytes);
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, winnerJournalId);
    assert.deepEqual(
      (await directoryFiles(controller)).filter((file) => file.startsWith(".mortalos-pending-")),
      injectedPendingNames
    );
    const orphanFixtures = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context4.bytes,
      providers: created.providerSets[4],
      seed: 180,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const orphan = deriveCandidate({
      contextBytes: context4.bytes,
      fixtures: orphanFixtures,
      priorJournalBytes: loaded3.journal_bytes
    });
    const orphanPath = join(
      controller,
      `journal-v2-${orphan.journal.generation}-${orphan.journal_id.slice(7)}.json`
    );
    await writeFile(orphanPath, orphan.bytes, { flag: "wx" });
    const loadedAfterOrphan = await loadThroughChild({
      controller,
      io,
      label: "loaded-after-orphan"
    });
    assert.equal(loadedAfterOrphan.result.journal_id, winnerJournalId);
    assert.equal(restoreConfidentialPlacementJournal(loadedAfterOrphan.bytes).generation, "3");

    const sameInput = await writeInput(
      io,
      "same-candidate",
      commitInput(orphanFixtures, context4.reproof_context_id)
    );
    const sameReadyA = join(io, "same-candidate-a.ready");
    const sameReadyB = join(io, "same-candidate-b.ready");
    const sameRelease = join(io, "same-candidate.release");
    const sameA = startContendedCommit({
      controller,
      input: sameInput,
      ready: sameReadyA,
      release: sameRelease
    });
    const sameB = startContendedCommit({
      controller,
      input: sameInput,
      ready: sameReadyB,
      release: sameRelease
    });
    const sameContenders = [sameA, sameB];
    await Promise.all([
      waitForFile(sameReadyA, sameContenders.map(({ child }) => child)),
      waitForFile(sameReadyB, sameContenders.map(({ child }) => child))
    ]);
    await writeFile(sameRelease, "release", { flag: "wx" });
    const sameOutcomes = await Promise.all(
      sameContenders.map(({ completed }) => completed)
    );
    assert.ok(sameOutcomes.every(({ code, signal, result }) =>
      code === 0 && signal === null && result?.outcome === "success"), sameOutcomes);
    assert.deepEqual(
      sameOutcomes.map(({ result }) => result.result.status).sort(),
      ["already-committed", "committed"]
    );
    assert.ok(sameOutcomes.every(({ result }) => result.result.journal_id === orphan.journal_id));
    await assertPidsExited(sameContenders.map(({ pid }) => pid));
    const loaded4 = loadConfidentialPlacementJournal(controller);
    assert.equal(loaded4.generation, "4");
    assert.equal(loaded4.journal_id, orphan.journal_id);
    assert.deepEqual(
      (await directoryFiles(controller)).filter((file) => file.startsWith(".mortalos-pending-")),
      injectedPendingNames
    );
    assert.equal(
      restoreConfidentialPlacementReproofContext(
        new Uint8Array(await readFile(join(
          controller,
          `reproof-${context4.reproof_context_id.slice(7)}.json`
        )))
      ).reproof_context_id,
      context4.reproof_context_id
    );
    assert.equal(
      restoreConfidentialPlacementJournal(new Uint8Array(await readFile(orphanPath))).journal_id,
      orphan.journal_id
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function legacyJournal(materialsValue, fixtures, generation = "7") {
  const placementRecords = records(fixtures);
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: "1500",
    manifest_bytes: materialsValue.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    placements: placementRecords,
    quorum: 2,
    target_shards: 3,
    unavailable_provider_ids: []
  });
  const basis = {
    format: "mortalos-confidential-placement-journal/1",
    generation,
    manifest_base64url: encodeBase64Url(materialsValue.shardSet.manifest_bytes),
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
  const journalId = domainHash(LEGACY_JOURNAL_DOMAIN, canonicalBytes(basis));
  return {
    bytes: canonicalBytes({ ...basis, journal_id: journalId }),
    generation,
    journal_id: journalId
  };
}

async function installLegacyHead(directory, journal) {
  await mkdir(directory, { recursive: true });
  const suffix = journal.journal_id.slice(7);
  const file = `journal-${journal.generation}-${suffix}.json`;
  await writeFile(join(directory, file), journal.bytes, { flag: "wx" });
  await writeFile(
    join(directory, `pointer-${journal.generation.padStart(20, "0")}-${suffix}.json`),
    canonicalBytes({
      file,
      format: "mortalos-confidential-placement-pointer/1",
      generation: journal.generation,
      journal_id: journal.journal_id
    }),
    { flag: "wx" }
  );
}

test("a durable v1 head remains unavailable until a fresh rotated v2 reproof commits", {
  timeout: 600_000
}, async () => {
  const created = await materialsPromise;
  const root = await mkdtemp(join(tmpdir(), "mortalos-controller-v1-migration-"));
  const controller = join(root, "controller");
  const io = join(root, "io");
  await mkdir(io);
  try {
    const legacyFixtures = await createUnboundSet({
      consumer: created.consumer,
      providers: created.providerSets[5],
      seed: 240,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const legacy = legacyJournal(created, legacyFixtures);
    await installLegacyHead(controller, legacy);
    assert.throws(
      () => loadConfidentialPlacementJournal(controller),
      /E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED/u
    );
    assert.throws(() => beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, legacy.journal_id, false)
    }), /E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED/u);

    const begun = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, legacy.journal_id, true)
    });
    const context = restoreConfidentialPlacementReproofContext(begun.reproof_context_bytes);
    assert.equal(context.generation, "8");
    assert.equal(context.prior_journal_id, legacy.journal_id);
    assert.equal(context.rotate_epoch, true);

    const beforeLegacyReplay = await directoryFiles(controller);
    const replayInput = await writeInput(
      io,
      "legacy-receipt-replay",
      commitInput(legacyFixtures, context.reproof_context_id)
    );
    const replay = runChild("commit", controller, replayInput);
    assert.notEqual(replay.status, 0);
    assert.match(replay.stderr, /three-shard reproof evaluation required/u);
    assert.deepEqual(await directoryFiles(controller), beforeLegacyReplay);
    assert.equal(
      (await directoryFiles(controller)).some((file) =>
        file === `successor-${legacy.journal_id.slice(7)}.json`),
      false
    );

    const fresh = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context.bytes,
      providers: created.providerSets[6],
      seed: 280,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const migrated = await commitThroughChild({
      controller,
      fixtures: fresh,
      io,
      label: "migrated-generation-8",
      reproofContextId: context.reproof_context_id
    });
    assert.equal(migrated.result.status, "committed");
    const loaded = await loadThroughChild({
      controller,
      io,
      label: "loaded-migrated-generation-8"
    });
    const restored = restoreConfidentialPlacementJournal(loaded.bytes);
    assert.equal(restored.generation, "8");
    assert.equal(restored.prior_journal_id, legacy.journal_id);
    assert.equal(restored.receipt_high_waters.length, 3);
    assert.equal(loaded.result.journal_id, migrated.result.journal_id);

    const successorPath = join(
      controller,
      `successor-${legacy.journal_id.slice(7)}.json`
    );
    const migratedJournalPath = join(
      controller,
      `journal-v2-8-${migrated.result.journal_id.slice(7)}.json`
    );
    const successorBeforeLateLegacy = new Uint8Array(await readFile(successorPath));
    const migratedBytesBeforeLateLegacy = new Uint8Array(await readFile(migratedJournalPath));
    const lateLegacy = legacyJournal(created, legacyFixtures, "8");
    await installLegacyHead(controller, lateLegacy);
    assert.throws(
      () => loadConfidentialPlacementJournal(controller),
      /E_CONFIDENTIAL_PLACEMENT_ROOT_FORK/u
    );
    assert.throws(() => beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, migrated.result.journal_id, false)
    }), /E_CONFIDENTIAL_PLACEMENT_ROOT_FORK/u);
    assert.throws(() => commitConfidentialPlacementJournal({
      directory: controller,
      ...commitInput(fresh, context.reproof_context_id)
    }), /E_CONFIDENTIAL_PLACEMENT_ROOT_FORK/u);
    assert.equal(
      equalBytes(new Uint8Array(await readFile(successorPath)), successorBeforeLateLegacy),
      true
    );
    assert.equal(
      equalBytes(new Uint8Array(await readFile(migratedJournalPath)), migratedBytesBeforeLateLegacy),
      true
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function syntheticReproofNonce(contextId, proof) {
  const digest = domainHash(
    "MortalOS confidential placement reproof challenge nonce v1",
    canonicalBytes({
      challenge_sequence: proof.challenge_sequence,
      chain_id: proof.chain_id,
      context_id: contextId,
      previous_execution_receipt_id: proof.previous_execution_receipt_id
    })
  );
  const raw = decodeBase64Url(digest.slice(7));
  assert.equal(raw?.byteLength, 32);
  return encodeBase64Url(raw.subarray(0, 16));
}

function installSyntheticSuccessor(controller, prior, generation) {
  const context = createConfidentialPlacementReproofContext({
    epoch_nonce: null,
    generation,
    manifest_bytes: prior.manifest.bytes,
    max_proof_age_ms: prior.max_proof_age_ms,
    prior_journal_bytes: prior.bytes,
    quorum: prior.quorum,
    rotate_epoch: false,
    target_shards: prior.target_shards
  });
  const activeProofs = prior.active_proofs.map((proof) => ({
    ...proof,
    challenge_nonce: syntheticReproofNonce(context.reproof_context_id, proof)
  }));
  const basis = {
    active_proofs: activeProofs,
    epoch_id: context.epoch_id,
    format: "mortalos-confidential-placement-journal/2",
    generation,
    manifest_base64url: encodeBase64Url(prior.manifest.bytes),
    manifest_id: prior.manifest.manifest_id,
    max_proof_age_ms: prior.max_proof_age_ms,
    prior_journal_id: prior.journal_id,
    quorum: prior.quorum,
    receipt_high_waters: prior.receipt_high_waters,
    reproof_context_base64url: encodeBase64Url(context.bytes),
    reproof_context_id: context.reproof_context_id,
    target_shards: prior.target_shards
  };
  const journalId = domainHash(JOURNAL_DOMAIN, canonicalBytes(basis));
  const journal = { ...basis, journal_id: journalId };
  const bytes = canonicalBytes(journal);
  const journalFile = `journal-v2-${generation}-${journalId.slice(7)}.json`;
  writeFileSync(join(controller, journalFile), bytes, { flag: "wx" });
  const transitionBasis = {
    format: TRANSITION_FORMAT,
    generation,
    journal_file: journalFile,
    journal_id: journalId,
    prior_journal_id: prior.journal_id,
    reproof_context_id: context.reproof_context_id
  };
  const transition = {
    ...transitionBasis,
    transition_id: domainHash(TRANSITION_DOMAIN, canonicalBytes(transitionBasis))
  };
  writeFileSync(
    join(controller, `successor-${prior.journal_id.slice(7)}.json`),
    canonicalBytes(transition),
    { flag: "wx" }
  );
  return {
    active_proofs: activeProofs,
    bytes,
    context,
    epoch_id: context.epoch_id,
    generation,
    journal_id: journalId,
    manifest: prior.manifest,
    max_proof_age_ms: prior.max_proof_age_ms,
    prior_journal_id: prior.journal_id,
    quorum: prior.quorum,
    receipt_high_waters: prior.receipt_high_waters,
    reproof_context_id: context.reproof_context_id,
    target_shards: prior.target_shards
  };
}

test("the exact 4096-transition durable head loads and generation 4097 fails closed", {
  timeout: 900_000
}, async () => {
  const created = await materialsPromise;
  const root = await mkdtemp(join(tmpdir(), "mortalos-controller-v2-limit-"));
  const controller = join(root, "controller");
  try {
    const begun = beginConfidentialPlacementReproof({
      directory: controller,
      ...beginOptions(created, null, true)
    });
    const context = restoreConfidentialPlacementReproofContext(begun.reproof_context_bytes);
    const fixtures = await createBoundSet({
      consumer: created.consumer,
      contextBytes: context.bytes,
      providers: created.providerSets[7],
      seed: 340,
      shardSet: created.shardSet,
      witnesses: created.witnesses
    });
    const committed = commitConfidentialPlacementJournal({
      directory: controller,
      ...commitInput(fixtures, context.reproof_context_id)
    });
    assert.equal(committed.status, "committed");
    let prior = loadConfidentialPlacementJournal(controller);
    assert.equal(prior.generation, "1");
    for (
      let generation = 2;
      generation <= CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max;
      generation += 1
    ) {
      prior = installSyntheticSuccessor(controller, prior, String(generation));
    }
    const exactHead = loadConfidentialPlacementJournal(controller);
    assert.equal(
      exactHead.generation,
      String(CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max)
    );
    assert.equal(exactHead.journal_id, prior.journal_id);
    assert.equal(
      restoreConfidentialPlacementJournal(exactHead.journal_bytes).journal_id,
      prior.journal_id
    );
    const successorClaim = join(controller, `successor-${prior.journal_id.slice(7)}.json`);
    await assert.rejects(access(successorClaim), /ENOENT/u);
    assert.throws(
      () => beginConfidentialPlacementReproof({
        directory: controller,
        ...beginOptions(created, prior.journal_id, false)
      }),
      (error) => error?.message === "E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT"
    );
    await assert.rejects(access(successorClaim), /ENOENT/u);
    assert.equal(loadConfidentialPlacementJournal(controller).journal_id, prior.journal_id);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
