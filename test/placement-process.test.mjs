import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { encodeBase64Url } from "../src/bytes.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { evaluateStoragePlacements } from "../src/placement/storage.mjs";

async function providerProcess() {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./placement-node-provider.mjs", import.meta.url))], {
    stdio: ["pipe", "pipe", "inherit"]
  });
  const pending = new Map();
  let nextId = 1;
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    const message = JSON.parse(line);
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(message.error));
    else waiting.resolve(message.result);
  });
  function call(action, body = {}) {
    if (child.exitCode !== null || child.killed) return Promise.reject(new Error("provider process exited"));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { reject, resolve });
      child.stdin.write(`${JSON.stringify({ action, id, ...body })}\n`);
    });
  }
  const identity = await call("identity");
  return Object.freeze({
    child,
    identity,
    sign: (message) => call("sign", { message: encodeBase64Url(message) }),
    store: (resource) => call("store", { resource: encodeBase64Url(resource) }),
    createStorageResult: (options) => call("create-storage-result", {
      challenge: encodeBase64Url(options.challenge),
      lease: encodeBase64Url(options.lease),
      offer: encodeBase64Url(options.offer),
      previous_execution_receipts: options.previous_execution_receipts.map(encodeBase64Url),
      usage_receipts: options.usage_receipts.map(encodeBase64Url)
    }),
    async destroy() {
      const result = await call("destroy");
      if (child.exitCode === null) await once(child, "exit");
      return result;
    }
  });
}

test("actual Node provider exit degrades placement and a new process/new lease repairs it", async () => {
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providers = await Promise.all(Array.from({ length: 4 }, () => providerProcess()));
  const resource = new Uint8Array(65_777).fill(73);
  const fixtures = [];
  try {
    for (let index = 0; index < 3; index += 1) {
      fixtures.push(await createStoragePlacementFixture({
        consumer,
        provider: providers[index],
        resourceBytes: resource,
        seed: 80 + index * 4,
        witnesses
      }));
    }
    const options = (records, unavailable) => ({
      expected_workload_id: fixtures[0].expected_workload_id,
      placements: records.map((entry) => entry.placement),
      quorum: 2,
      target_copies: 3,
      unavailable_provider_ids: unavailable
    });
    assert.equal(evaluateStoragePlacements(options(fixtures, [])).status, "proved");
    const oldPid = providers[0].child.pid;
    assert.ok(oldPid > 0);
    await providers[0].destroy();
    assert.notEqual(providers[0].child.exitCode, null);
    await assert.rejects(() => providers[0].sign(new Uint8Array([1])), /exited/u);
    const degraded = evaluateStoragePlacements(options(fixtures, [providers[0].identity.key_id]));
    assert.equal(degraded.status, "repairing");
    assert.equal(degraded.available_copies, 2);

    fixtures.push(await createStoragePlacementFixture({
      consumer,
      provider: providers[3],
      resourceBytes: resource,
      seed: 92,
      witnesses
    }));
    const repaired = evaluateStoragePlacements(options(fixtures, [providers[0].identity.key_id]));
    assert.equal(repaired.status, "proved");
    assert.equal(repaired.available_copies, 3);
    assert.equal(new Set(repaired.placements.map((entry) => entry.lease_id)).size, 4);
    assert.equal(providers[3].child.pid === oldPid, false);
  } finally {
    await Promise.all(providers.slice(1).map((provider) => provider.destroy().catch(() => {})));
  }
});
