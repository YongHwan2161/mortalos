import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { evaluateStoragePlacements } from "../src/placement/storage.mjs";

async function fixtures() {
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const resource = new Uint8Array(98_317);
  crypto.getRandomValues(resource.subarray(0, 65_536));
  crypto.getRandomValues(resource.subarray(65_536));
  const records = [];
  for (let index = 0; index < providers.length; index += 1) {
    records.push(await createStoragePlacementFixture({
      consumer,
      provider: providers[index],
      resourceBytes: resource,
      seed: 20 + index * 4,
      witnesses
    }));
  }
  return { consumer, providers, records, resource, witnesses };
}

function evaluate(records, unavailable = []) {
  return evaluateStoragePlacements({
    expected_workload_id: records[0].expected_workload_id,
    placements: records.map((entry) => entry.placement),
    quorum: 2,
    target_copies: 3,
    unavailable_provider_ids: unavailable
  });
}

const createdPromise = fixtures();

test("three receipt-proved providers become usable; one loss requires a new-lease repair", async () => {
  const created = await createdPromise;
  const initial = evaluate(created.records.slice(0, 3));
  assert.equal(initial.status, "proved");
  assert.equal(initial.available_copies, 3);
  assert.equal(initial.repair_needed, 0);

  const lostProvider = created.records[0].provider_id;
  const degraded = evaluate(created.records.slice(0, 3), [lostProvider]);
  assert.equal(degraded.status, "repairing");
  assert.equal(degraded.available_copies, 2);
  assert.equal(degraded.unavailable_copies, 1);
  assert.equal(degraded.repair_needed, 1);

  const repaired = evaluate(created.records, [lostProvider]);
  assert.equal(repaired.status, "proved");
  assert.equal(repaired.available_copies, 3);
  assert.equal(repaired.unavailable_copies, 1);
  assert.equal(repaired.repair_needed, 0);
  assert.equal(new Set(repaired.placements.map((entry) => entry.lease_id)).size, 4);
  assert.ok(repaired.placements.every((entry) => entry.workload_id === created.records[0].expected_workload_id));
});

test("single, duplicate, corrupt, cross-lease, stale, and unproved evidence never counts", async () => {
  const created = await createdPromise;
  assert.equal(evaluate(created.records.slice(0, 1)).status, "unavailable");

  const duplicate = evaluate([created.records[0], created.records[0], created.records[1]]);
  assert.equal(duplicate.available_copies, 1);
  assert.equal(duplicate.status, "unavailable");
  assert.equal(duplicate.placements.filter((entry) => entry.reason === "duplicate-provider").length, 2);

  const corruptReceipt = new Uint8Array(created.records[0].placement.execution_receipts[0]);
  corruptReceipt[Math.floor(corruptReceipt.length / 2)] ^= 1;
  const corruptRecord = {
    ...created.records[0],
    placement: {
      ...created.records[0].placement,
      execution_receipts: [corruptReceipt]
    }
  };
  assert.equal(evaluate([corruptRecord, created.records[1], created.records[2]]).available_copies, 2);

  const crossLease = {
    ...created.records[0],
    placement: { ...created.records[0].placement, lease: created.records[1].placement.lease }
  };
  assert.equal(evaluate([crossLease]).available_copies, 0);

  const stale = {
    ...created.records[0],
    placement: { ...created.records[0].placement, observed_at_ms: "9001" }
  };
  assert.equal(evaluate([stale]).placements[0].reason, "resource-completed");

  const unproved = {
    ...created.records[0],
    placement: {
      ...created.records[0].placement,
      execution_receipts: [],
      usage_receipts: []
    }
  };
  assert.equal(evaluate([unproved]).placements[0].reason, "execution-unproved");
});

test("a receipt for another exact workload is rejected without changing valid peers", async () => {
  const created = await createdPromise;
  const wrong = evaluateStoragePlacements({
    expected_workload_id: `resource-workload:${"A".repeat(43)}`,
    placements: created.records.slice(0, 3).map((entry) => entry.placement),
    quorum: 2,
    target_copies: 3,
    unavailable_provider_ids: []
  });
  assert.equal(wrong.available_copies, 0);
  assert.ok(wrong.placements.every((entry) => entry.reason === "workload-mismatch"));
});
