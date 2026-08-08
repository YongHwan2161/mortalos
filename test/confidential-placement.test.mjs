import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createConfidentialPlacementJournal,
  createConfidentialPlacementShardSet,
  evaluateConfidentialPlacementJournal,
  evaluateConfidentialStoragePlacements,
  planConfidentialStorageRepair,
  reconstructConfidentialPackage,
  restoreConfidentialPlacementJournal
} from "../src/placement/confidential.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

function withIndex(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function evaluate(created, records, overrides = {}) {
  return evaluateConfidentialStoragePlacements({
    evaluated_at_ms: overrides.evaluated_at_ms ?? "1800",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: overrides.max_proof_age_ms ?? "500",
    placements: records,
    quorum: 2,
    target_shards: 3,
    unavailable_provider_ids: overrides.unavailable_provider_ids ?? []
  });
}

async function fixtures() {
  const confidential = await createConfidentialFixture({
    custodianCount: 1,
    resourceBytes: new TextEncoder().encode(
      "MORTALOS-CONFIDENTIAL-PLAINTEXT-MUST-NEVER-REACH-A-PROVIDER:".repeat(20)
    )
  });
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
  const repair = [await createStoragePlacementFixture({
    consumer,
    provider: providers[3],
    resourceBytes: shardSet.shards[0].bytes,
    seed: 50,
    witnesses
  })];
  return { confidential, consumer, initial, providers, repair, shardSet, witnesses };
}

const createdPromise = fixtures();

test("S4 ciphertext becomes 2-of-3 provider-blind shards and every valid pair reconstructs", async () => {
  const created = await createdPromise;
  const { confidentialPackage } = created.confidential;
  assert.equal(created.shardSet.shards.length, 3);
  const plaintextMarker = Buffer.from("MORTALOS-CONFIDENTIAL-PLAINTEXT-MUST-NEVER-REACH-A-PROVIDER");
  for (const shard of created.shardSet.shards) {
    assert.equal(Buffer.from(shard.bytes).includes(plaintextMarker), false);
  }
  for (const pair of [[0, 1], [0, 2], [1, 2]]) {
    const recovered = reconstructConfidentialPackage({
      manifest_bytes: created.shardSet.manifest_bytes,
      shard_bytes: pair.map((index) => created.shardSet.shards[index].bytes)
    });
    assert.equal(equalBytes(recovered.confidential_package_bytes, confidentialPackage.packageBytes), true);
    assert.deepEqual(recovered.shard_indexes, pair);
  }
  assert.throws(() => reconstructConfidentialPackage({
    manifest_bytes: created.shardSet.manifest_bytes,
    shard_bytes: [created.shardSet.shards[0].bytes]
  }), /two or three shard documents/u);
  const corrupt = new Uint8Array(created.shardSet.shards[2].bytes);
  corrupt[Math.floor(corrupt.byteLength / 2)] ^= 1;
  assert.throws(() => reconstructConfidentialPackage({
    manifest_bytes: created.shardSet.manifest_bytes,
    shard_bytes: [created.shardSet.shards[0].bytes, corrupt]
  }), /canonical JSON|shard content/u);
});

test("only fresh, distinct provider and distinct shard receipts count toward 2-of-3", async () => {
  const created = await createdPromise;
  const records = created.initial.map((fixture, index) => withIndex(fixture, index));
  const exactBoundary = evaluate(created, records);
  assert.equal(exactBoundary.status, "proved");
  assert.equal(exactBoundary.available_shards, 3);
  assert.deepEqual(exactBoundary.repair_shard_indexes, []);

  const stale = evaluate(created, records, { evaluated_at_ms: "1801" });
  assert.equal(stale.status, "unavailable");
  assert.equal(stale.available_shards, 0);
  assert.ok(stale.placements.every((placement) => placement.reason === "stale-proof"));

  const lost = evaluate(created, records, {
    unavailable_provider_ids: [created.initial[0].provider_id]
  });
  assert.equal(lost.status, "repairing");
  assert.deepEqual(lost.repair_shard_indexes, [0]);
  assert.deepEqual(planConfidentialStorageRepair(lost).actions, [{
    action: "place-shard",
    requires_new_provider: true,
    requires_signed_execution_receipt: true,
    shard_index: 0
  }]);

  const repaired = evaluate(created, [
    withIndex(created.repair[0], 0),
    withIndex(created.initial[1], 1),
    withIndex(created.initial[2], 2)
  ]);
  assert.equal(repaired.status, "proved");
  assert.equal(new Set(repaired.placements.map(({ provider_id: id }) => id)).size, 3);

  const duplicateProvider = evaluate(created, [records[0], records[0], records[1]]);
  assert.equal(duplicateProvider.status, "unavailable");
  assert.equal(duplicateProvider.available_shards, 1);
  assert.equal(duplicateProvider.placements.filter(({ reason }) => reason === "duplicate-provider").length, 2);

  const wrongShard = evaluate(created, [{ ...records[0], shard_index: 1 }]);
  assert.equal(wrongShard.available_shards, 0);
  assert.equal(wrongShard.placements[0].reason, "workload-mismatch");
});

test("restored controller counts no pre-crash proof until a directly chained receipt arrives", async () => {
  const created = await createdPromise;
  const initialRecords = created.initial.map((fixture, index) => withIndex(fixture, index));
  const initial = evaluate(created, initialRecords, { evaluated_at_ms: "1500" });
  const journal = createConfidentialPlacementJournal({
    evaluation: initial,
    generation: "7",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    quorum: 2,
    target_shards: 3
  });
  assert.equal(restoreConfidentialPlacementJournal(journal.bytes).generation, "7");
  const directory = await mkdtemp(join(tmpdir(), "mortalos-placement-controller-"));
  try {
    const input = join(directory, "input.json");
    const output = join(directory, "output.json");
    await writeFile(input, journal.bytes);
    const child = fileURLToPath(new URL("./confidential-controller-child.mjs", import.meta.url));
    const committed = spawnSync(process.execPath, [child, "commit", directory, input], {
      encoding: "utf8"
    });
    assert.equal(committed.status, 0, committed.stderr);
    assert.equal(JSON.parse(committed.stdout).status, "committed");
    const loaded = spawnSync(process.execPath, [child, "load", directory, output], {
      encoding: "utf8"
    });
    assert.equal(loaded.status, 0, loaded.stderr);
    assert.equal(JSON.parse(loaded.stdout).status, "loaded");
    assert.equal(equalBytes(new Uint8Array(await readFile(output)), journal.bytes), true);
    const next = createConfidentialPlacementJournal({
      evaluation: initial,
      generation: "8",
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "501",
      quorum: 2,
      target_shards: 3
    });
    const nextInput = join(directory, "next.json");
    await writeFile(nextInput, next.bytes);
    const nextCommit = spawnSync(process.execPath, [child, "commit", directory, nextInput], {
      encoding: "utf8"
    });
    assert.equal(nextCommit.status, 0, nextCommit.stderr);
    const nextOutput = join(directory, "next-output.json");
    const nextLoad = spawnSync(process.execPath, [child, "load", directory, nextOutput], {
      encoding: "utf8"
    });
    assert.equal(nextLoad.status, 0, nextLoad.stderr);
    assert.equal(JSON.parse(nextLoad.stdout).generation, "8");
    assert.equal(equalBytes(new Uint8Array(await readFile(nextOutput)), next.bytes), true);
    const fork = createConfidentialPlacementJournal({
      evaluation: initial,
      generation: "8",
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "502",
      quorum: 2,
      target_shards: 3
    });
    const forkInput = join(directory, "fork.json");
    await writeFile(forkInput, fork.bytes);
    const forkCommit = spawnSync(process.execPath, [child, "commit", directory, forkInput], {
      encoding: "utf8"
    });
    assert.notEqual(forkCommit.status, 0);
    assert.match(forkCommit.stderr, /E_CONFIDENTIAL_PLACEMENT_POINTER_FORK/u);

    const forgedDirectory = join(directory, "forged-generation");
    await mkdir(forgedDirectory);
    const suffix = journal.journal_id.slice(7);
    const forgedJournalFile = `journal-9-${suffix}.json`;
    await writeFile(join(forgedDirectory, forgedJournalFile), journal.bytes);
    await writeFile(join(forgedDirectory, `pointer-${"9".padStart(20, "0")}-${suffix}.json`), canonicalBytes({
      file: forgedJournalFile,
      format: "mortalos-confidential-placement-pointer/1",
      generation: "9",
      journal_id: journal.journal_id
    }));
    const forgedLoad = spawnSync(process.execPath, [child, "load", forgedDirectory, join(forgedDirectory, "output.json")], {
      encoding: "utf8"
    });
    assert.notEqual(forgedLoad.status, 0);
    assert.match(forgedLoad.stderr, /E_CONFIDENTIAL_PLACEMENT_POINTER_BINDING/u);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
  const replayed = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1500",
    journal_bytes: journal.bytes,
    placements: initialRecords,
    unavailable_provider_ids: []
  });
  assert.equal(replayed.status, "unavailable");
  assert.equal(replayed.available_shards, 0);
  assert.ok(replayed.placements.every(({ reason }) => reason === "restart-reproof-required"));

  const refreshed = [];
  for (let index = 0; index < 3; index += 1) {
    refreshed.push(await refreshStoragePlacementFixture({
      consumer: created.consumer,
      fixture: created.initial[index],
      issuedAtMs: 1600 + index,
      provider: created.providers[index],
      resourceBytes: created.shardSet.shards[index].bytes,
      seed: 90 + index
    }));
  }
  const twoReproved = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1700",
    journal_bytes: journal.bytes,
    placements: [withIndex(refreshed[0], 0), withIndex(refreshed[1], 1), initialRecords[2]],
    unavailable_provider_ids: []
  });
  assert.equal(twoReproved.status, "repairing");
  assert.equal(twoReproved.available_shards, 2);
  const allReproved = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1700",
    journal_bytes: journal.bytes,
    placements: refreshed.map((fixture, index) => withIndex(fixture, index)),
    unavailable_provider_ids: []
  });
  assert.equal(allReproved.status, "proved");
  assert.equal(allReproved.available_shards, 3);
});

test("100 seeded failure-policy cycles never promote loss or stale evidence and repair with a new receipt", async () => {
  const created = await createdPromise;
  const original = created.initial.map((fixture, index) => withIndex(fixture, index));
  const corrupt = new Uint8Array(created.initial[0].placement.execution_receipts[0]);
  corrupt[Math.floor(corrupt.byteLength / 2)] ^= 1;
  const corpus = [
    evaluate(created, original, {
      unavailable_provider_ids: [created.initial[0].provider_id]
    }),
    evaluate(created, original, { evaluated_at_ms: "1801" }),
    evaluate(created, [withIndex(created.repair[0], 0), original[1], original[2]]),
    evaluate(created, [{ ...original[0], execution_receipts: [corrupt] }, original[1], original[2]])
  ];
  assert.deepEqual(corpus.map(({ status }) => status), [
    "repairing", "unavailable", "proved", "repairing"
  ]);
  let proved = 0;
  let repairing = 0;
  let unavailable = 0;
  for (let seed = 0; seed < 100; seed += 1) {
    const result = corpus[seed % corpus.length];
    if (result.status === "proved") proved += 1;
    else if (result.status === "repairing") repairing += 1;
    else unavailable += 1;
  }
  assert.deepEqual({ proved, repairing, unavailable }, { proved: 25, repairing: 50, unavailable: 25 });
});
