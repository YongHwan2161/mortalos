import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serialize } from "node:v8";
import {
  commitConfidentialPlacementJournal,
  loadConfidentialPlacementJournal
} from "../lab/placement/confidential-controller.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  createConfidentialPlacementJournal,
  createConfidentialPlacementShardSet,
  evaluateConfidentialPlacementJournal,
  evaluateConfidentialStoragePlacements,
  planConfidentialStorageRepair,
  reconstructConfidentialPackage,
  restoreConfidentialPlacementJournal
} from "../src/placement/confidential.mjs";
import {
  finalizeResourceRevocation,
  prepareResourceRevocation
} from "../src/resource-contract.mjs";
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

function rawCommitOptions(created, records, overrides = {}) {
  return {
    evaluated_at_ms: overrides.evaluated_at_ms ?? "1500",
    generation: overrides.generation ?? "7",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: overrides.max_proof_age_ms ?? "500",
    placements: records,
    quorum: 2,
    target_shards: 3,
    unavailable_provider_ids: overrides.unavailable_provider_ids ?? []
  };
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

test("one generation instant governs lease completion, revocation, and proof freshness", async () => {
  const created = await createdPromise;
  const records = created.initial.map((fixture, index) => withIndex(fixture, index));

  assert.ok(records.every(({ observed_at_ms: observedAt }) => observedAt === "1500"));
  assert.ok(records.every(({ lease }) =>
    JSON.parse(new TextDecoder().decode(lease)).body.ends_at_ms === "8900"));
  const afterLeaseEnd = evaluate(created, records, {
    evaluated_at_ms: "9000",
    max_proof_age_ms: "8000"
  });
  assert.equal(afterLeaseEnd.status, "unavailable");
  assert.equal(afterLeaseEnd.available_shards, 0);
  assert.equal(afterLeaseEnd.placements.filter(({ status }) => status === "proved").length, 0);
  assert.ok(afterLeaseEnd.placements.every(({ reason }) => reason === "resource-completed"));
  assert.ok(afterLeaseEnd.placements.every(({ receipt_id: receiptId }) => receiptId === null));

  const revocation = await revokeLease({
    consumer: created.consumer,
    effectiveAtMs: "1700",
    nonceByte: 117,
    placement: records[0]
  });
  const afterRevocation = evaluate(created, [{
    ...records[0],
    revocations: Object.freeze([revocation])
  }, records[1], records[2]], {
    evaluated_at_ms: "1800"
  });
  assert.equal(afterRevocation.status, "repairing");
  assert.equal(afterRevocation.available_shards, 2);
  assert.equal(afterRevocation.placements[0].status, "rejected");
  assert.equal(afterRevocation.placements[0].reason, "resource-revoked");
  assert.equal(afterRevocation.placements[0].receipt_id, null);
});

test("crash journals require an owned evaluation and retain every observed receipt barrier", async () => {
  const created = await createdPromise;
  const records = created.initial.map((fixture, index) => withIndex(fixture, index));
  const evaluation = evaluate(created, records, { evaluated_at_ms: "1500" });
  const options = {
    evaluation,
    generation: "7",
    manifest_bytes: created.shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    quorum: 2,
    target_shards: 3
  };
  const journal = createConfidentialPlacementJournal(options);
  assert.equal(restoreConfidentialPlacementJournal(journal.bytes).proofs.length, 3);

  const forged = {
    available_shards: 0,
    manifest_id: evaluation.manifest_id,
    placements: [],
    quorum: 2,
    repair_shard_indexes: [0, 1, 2],
    status: "unavailable",
    target_shards: 3
  };
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: forged
  }), /verified evaluation/u);
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: { ...evaluation }
  }), /verified evaluation/u);

  let proxyGets = 0;
  const proxied = new Proxy(evaluation, {
    get(target, property, receiver) {
      proxyGets += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: proxied
  }), /verified evaluation/u);
  assert.equal(proxyGets, 0);

  let accessorGets = 0;
  const accessor = {};
  for (const property of ["manifest_id", "placements", "quorum", "target_shards"]) {
    Object.defineProperty(accessor, property, {
      enumerable: true,
      get() {
        accessorGets += 1;
        return evaluation[property];
      }
    });
  }
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: accessor
  }), /verified evaluation/u);
  assert.equal(accessorGets, 0);
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    max_proof_age_ms: "501"
  }), /exact journal policy/u);
  const emptyEvaluation = evaluate(created, [], { evaluated_at_ms: "1500" });
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: emptyEvaluation
  }), /verified evaluation/u);
  const partialEvaluation = evaluate(created, records.slice(0, 2), {
    evaluated_at_ms: "1500"
  });
  assert.throws(() => createConfidentialPlacementJournal({
    ...options,
    evaluation: partialEvaluation
  }), /verified evaluation/u);

  const originalGet = Object.getOwnPropertyDescriptor(WeakMap.prototype, "get");
  let weakMapDriftError;
  try {
    try {
      Object.defineProperty(WeakMap.prototype, "get", {
        ...originalGet,
        value() {
          throw new Error("poisoned WeakMap.get");
        }
      });
      createConfidentialPlacementJournal(options);
    } catch (error) {
      weakMapDriftError = error;
    }
  } finally {
    Object.defineProperty(WeakMap.prototype, "get", originalGet);
  }
  assert.match(weakMapDriftError?.message ?? "", /realm intrinsic drift/u);
  assert.equal(createConfidentialPlacementJournal(options).journal_id, journal.journal_id);

  const stale = evaluate(created, records, { evaluated_at_ms: "1801" });
  const staleJournal = createConfidentialPlacementJournal({
    ...options,
    evaluation: stale,
    generation: "8"
  });
  assert.equal(restoreConfidentialPlacementJournal(staleJournal.bytes).proofs.length, 3);
  const staleReplay = evaluateConfidentialPlacementJournal({
    evaluated_at_ms: "1500",
    journal_bytes: staleJournal.bytes,
    placements: records,
    unavailable_provider_ids: []
  });
  assert.equal(staleReplay.available_shards, 0);
  assert.ok(staleReplay.placements.every(({ reason }) => reason === "restart-reproof-required"));

  assert.throws(() => commitConfidentialPlacementJournal({
    directory: "unused",
    journal_bytes: journal.bytes
  }), /exact raw placement commit options/u);

  const omissionRoot = await mkdtemp(join(tmpdir(), "mortalos-placement-omission-"));
  try {
    const { journal_id: ignoredJournalId, ...journalBasis } = journal.journal;
    assert.equal(typeof ignoredJournalId, "string");
    const zeroProofBasis = { ...journalBasis, proofs: [] };
    const zeroProofId = domainHash(
      "MortalOS confidential placement journal v1",
      canonicalBytes(zeroProofBasis)
    );
    const zeroProofBytes = canonicalBytes({
      ...zeroProofBasis,
      journal_id: zeroProofId
    });
    assert.throws(
      () => restoreConfidentialPlacementJournal(zeroProofBytes),
      /journal manifest or proofs are invalid/u
    );
    assert.throws(() => evaluateConfidentialPlacementJournal({
      evaluated_at_ms: "1500",
      journal_bytes: zeroProofBytes,
      placements: records,
      unavailable_provider_ids: []
    }), /journal manifest or proofs are invalid/u);

    const zeroProofDirectory = join(omissionRoot, "self-hashed-zero-proof");
    await mkdir(zeroProofDirectory);
    const zeroProofFile = `journal-7-${zeroProofId.slice(7)}.json`;
    await writeFile(join(zeroProofDirectory, zeroProofFile), zeroProofBytes);
    await writeFile(
      join(zeroProofDirectory, `pointer-${"7".padStart(20, "0")}-${zeroProofId.slice(7)}.json`),
      canonicalBytes({
        file: zeroProofFile,
        format: "mortalos-confidential-placement-pointer/1",
        generation: "7",
        journal_id: zeroProofId
      })
    );
    assert.throws(
      () => loadConfidentialPlacementJournal(zeroProofDirectory),
      /journal manifest or proofs are invalid/u
    );

    const emptyDirectory = join(omissionRoot, "empty");
    assert.throws(() => commitConfidentialPlacementJournal({
      directory: emptyDirectory,
      ...rawCommitOptions(created, [])
    }), /verified evaluation/u);
    await assert.rejects(readdir(emptyDirectory), /ENOENT/u);

    const partialDirectory = join(omissionRoot, "partial");
    assert.throws(() => commitConfidentialPlacementJournal({
      directory: partialDirectory,
      ...rawCommitOptions(created, records.slice(0, 2))
    }), /verified evaluation/u);
    await assert.rejects(readdir(partialDirectory), /ENOENT/u);
  } finally {
    await rm(omissionRoot, { force: true, recursive: true });
  }
});

test("isolated caller poison corpus cannot fabricate a branded placement journal", async () => {
  const created = await createdPromise;
  const records = created.initial.map((fixture, index) => withIndex(fixture, index));
  const directory = await mkdtemp(join(tmpdir(), "mortalos-placement-poison-"));
  try {
    const input = join(directory, "input.v8");
    await writeFile(input, serialize(rawCommitOptions(created, records)));
    const child = fileURLToPath(new URL("./confidential-controller-child.mjs", import.meta.url));
    const poisoned = spawnSync(process.execPath, [child, "poison", "unused", input], {
      encoding: "utf8"
    });
    assert.equal(poisoned.status, 0, poisoned.stderr);
    const corpus = JSON.parse(poisoned.stdout);
    for (const result of Object.values(corpus)) {
      assert.equal(result.journal, null);
      assert.equal(typeof result.error, "string");
    }
    assert.match(corpus.selective_array_map.error, /realm intrinsic drift/u);
    assert.equal(corpus.selective_array_map.calls, 0);
    assert.match(corpus.map_get.error, /realm intrinsic drift/u);
    assert.equal(corpus.map_get.calls, 0);
    assert.match(corpus.set_has.error, /realm intrinsic drift/u);
    assert.equal(corpus.set_has.calls, 0);
    assert.match(corpus.proxy_array_method.error, /verified evaluation/u);
    assert.equal(corpus.proxy_array_method.gets, 0);
    assert.match(corpus.option_accessor.error, /own data properties/u);
    assert.equal(corpus.option_accessor.gets, 0);
    assert.match(corpus.option_proxy.error, /verified evaluation/u);
    assert.equal(corpus.option_proxy.gets, 0);
    assert.match(corpus.placement_accessor.error, /verified evaluation/u);
    assert.equal(corpus.placement_accessor.gets, 0);
    assert.match(corpus.placement_proxy.error, /verified evaluation/u);
    assert.equal(corpus.placement_proxy.gets, 0);
    assert.match(corpus.sparse_placements.error, /dense own-data array/u);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
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
    const input = join(directory, "input.v8");
    const output = join(directory, "output.json");
    await writeFile(input, serialize(rawCommitOptions(created, initialRecords)));
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
    const nextEvaluation = evaluate(created, initialRecords, {
      evaluated_at_ms: "1500",
      max_proof_age_ms: "501"
    });
    const next = createConfidentialPlacementJournal({
      evaluation: nextEvaluation,
      generation: "8",
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "501",
      quorum: 2,
      target_shards: 3
    });
    const nextInput = join(directory, "next.v8");
    await writeFile(nextInput, serialize(rawCommitOptions(created, initialRecords, {
      generation: "8",
      max_proof_age_ms: "501"
    })));
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

    const filesBeforePoison = (await readdir(directory)).sort();
    const poisonedLoad = spawnSync(
      process.execPath,
      [child, "load-map-poison", directory, "unused"],
      { encoding: "utf8" }
    );
    assert.equal(poisonedLoad.status, 0, poisonedLoad.stderr);
    const poisonedLoadResult = JSON.parse(poisonedLoad.stdout);
    assert.equal(poisonedLoadResult.generation, null);
    assert.match(poisonedLoadResult.error, /intact realm required/u);
    assert.equal(poisonedLoadResult.calls, 0);
    assert.deepEqual((await readdir(directory)).sort(), filesBeforePoison);

    const forkEvaluation = evaluate(created, initialRecords, {
      evaluated_at_ms: "1500",
      max_proof_age_ms: "502"
    });
    const fork = createConfidentialPlacementJournal({
      evaluation: forkEvaluation,
      generation: "8",
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "502",
      quorum: 2,
      target_shards: 3
    });
    const forkInput = join(directory, "fork.v8");
    await writeFile(forkInput, serialize(rawCommitOptions(created, initialRecords, {
      generation: "8",
      max_proof_age_ms: "502"
    })));
    const forkCommit = spawnSync(process.execPath, [child, "commit", directory, forkInput], {
      encoding: "utf8"
    });
    assert.notEqual(forkCommit.status, 0);
    assert.match(forkCommit.stderr, /E_CONFIDENTIAL_PLACEMENT_POINTER_FORK/u);

    const writeJournalAndPointer = async (targetDirectory, candidate) => {
      const candidateSuffix = candidate.journal_id.slice(7);
      const candidateFile = `journal-${candidate.journal.generation}-${candidateSuffix}.json`;
      await writeFile(join(targetDirectory, candidateFile), candidate.bytes);
      await writeFile(
        join(
          targetDirectory,
          `pointer-${candidate.journal.generation.padStart(20, "0")}-${candidateSuffix}.json`
        ),
        canonicalBytes({
          file: candidateFile,
          format: "mortalos-confidential-placement-pointer/1",
          generation: candidate.journal.generation,
          journal_id: candidate.journal_id
        })
      );
    };

    const forkedDirectory = join(directory, "forked-pointers");
    await mkdir(forkedDirectory);
    for (const candidate of [next, fork]) {
      await writeJournalAndPointer(forkedDirectory, candidate);
    }
    const forkedLoad = spawnSync(
      process.execPath,
      [child, "load", forkedDirectory, join(forkedDirectory, "output.json")],
      { encoding: "utf8" }
    );
    assert.notEqual(forkedLoad.status, 0);
    assert.match(forkedLoad.stderr, /E_CONFIDENTIAL_PLACEMENT_POINTER_FORK/u);

    const successorEvaluation = evaluate(created, initialRecords, {
      evaluated_at_ms: "1500",
      max_proof_age_ms: "503"
    });
    const successor = createConfidentialPlacementJournal({
      evaluation: successorEvaluation,
      generation: "9",
      manifest_bytes: created.shardSet.manifest_bytes,
      max_proof_age_ms: "503",
      quorum: 2,
      target_shards: 3
    });
    for (const [name, candidates] of [
      ["historical-fork-first", [next, fork, successor]],
      ["successor-first", [successor, next, fork]]
    ]) {
      const permutationDirectory = join(directory, name);
      await mkdir(permutationDirectory);
      for (const candidate of candidates) {
        await writeJournalAndPointer(permutationDirectory, candidate);
      }
      const permutationOutput = join(permutationDirectory, "output.json");
      const permutationLoad = spawnSync(
        process.execPath,
        [child, "load", permutationDirectory, permutationOutput],
        { encoding: "utf8" }
      );
      assert.equal(permutationLoad.status, 0, permutationLoad.stderr);
      assert.equal(JSON.parse(permutationLoad.stdout).generation, "9");
      assert.equal(
        equalBytes(new Uint8Array(await readFile(permutationOutput)), successor.bytes),
        true
      );
    }

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
