import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import {
  createConfidentialPlacementShardSet,
  evaluateConfidentialStoragePlacements,
  planConfidentialStorageRepair,
  reconstructConfidentialPackage
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
