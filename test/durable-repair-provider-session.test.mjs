import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createDurableRepairProviderResultRecovery,
  createDurableRepairProviderSession
} from "../lab/placement/durable-repair-provider-session.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";

const childPath = fileURLToPath(new URL("./durable-repair-provider-session-child.mjs", import.meta.url));

function placement() {
  return Object.freeze({
    consumption_announcements: Object.freeze([new Uint8Array([1])]),
    execution_receipts: Object.freeze([new Uint8Array([2])]),
    lease: new Uint8Array([3]),
    observed_at_ms: "1500",
    offer: new Uint8Array([4]),
    revocations: Object.freeze([new Uint8Array([5])]),
    usage_receipts: Object.freeze([new Uint8Array([6])])
  });
}

function serialPlacement(value) {
  return {
    consumption_announcements: value.consumption_announcements.map(encodeBase64Url),
    execution_receipts: value.execution_receipts.map(encodeBase64Url),
    lease: encodeBase64Url(value.lease),
    observed_at_ms: value.observed_at_ms,
    offer: encodeBase64Url(value.offer),
    revocations: value.revocations.map(encodeBase64Url),
    usage_receipts: value.usage_receipts.map(encodeBase64Url)
  };
}

function fixture(directory, sideEffectPath) {
  const effectId = domainHash(
    "MortalOS provider-session test effect",
    canonicalBytes({ shard_index: 0 })
  );
  const effectBytes = canonicalBytes({ effect_id: effectId, shard_index: 0 });
  const value = placement();
  return {
    child: {
      directory,
      effect_bytes: encodeBase64Url(effectBytes),
      idempotency_key: effectId,
      placement: serialPlacement(value),
      replacement_lease_bytes: encodeBase64Url(new Uint8Array([7])),
      replacement_offer_bytes: encodeBase64Url(new Uint8Array([8])),
      resource_bytes: encodeBase64Url(new Uint8Array([9])),
      side_effect_path: sideEffectPath
    },
    placement: value,
    request: Object.freeze({
      effect: Object.freeze({ ignored: true }),
      effect_bytes: effectBytes,
      idempotency_key: effectId,
      replacement_lease_bytes: new Uint8Array([7]),
      replacement_offer_bytes: new Uint8Array([8]),
      resource_bytes: new Uint8Array([9])
    })
  };
}

function runChild(payloadPath) {
  const child = spawn(process.execPath, [childPath, payloadPath], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const completion = new Promise(resolve => {
    child.once("close", (code, signal) => resolve({ code, signal, stderr, stdout }));
  });
  return { child, completion };
}

async function waitForFiles(paths) {
  const deadline = Date.now() + 10_000;
  while (!paths.every(existsSync)) {
    if (Date.now() >= deadline) throw new Error("provider-session-ready-timeout");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test("durable provider session gives one process the first execution claim", { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-provider-session-race-"));
  try {
    const directory = join(root, "session");
    const releasePath = join(root, "release");
    const sideEffectPath = join(root, "side-effect");
    const value = fixture(directory, sideEffectPath);
    const payloadPaths = [];
    const readyPaths = [];
    for (let index = 0; index < 2; index += 1) {
      const readyPath = join(root, `ready-${index}`);
      const payloadPath = join(root, `child-${index}.json`);
      readyPaths.push(readyPath);
      payloadPaths.push(payloadPath);
      await writeFile(payloadPath, JSON.stringify({
        ...value.child,
        mode: "return",
        ready_path: readyPath,
        release_path: releasePath
      }));
    }
    const children = payloadPaths.map(runChild);
    await waitForFiles(readyPaths);
    await writeFile(releasePath, "release", { flag: "wx" });
    const completed = await Promise.all(children.map(entry => entry.completion));
    for (const result of completed) {
      assert.equal(result.code, 0, result.stderr);
    }
    const verdicts = completed.map(result => JSON.parse(result.stdout));
    assert.equal(verdicts.some(result => result.status === "returned"), true);
    assert.equal(verdicts.every(result =>
      result.status === "returned" ||
      (result.status === "rejected" && result.code === "E_PLACEMENT_PROVIDER_SESSION_CLAIMED")
    ), true);
    assert.match(await readFile(sideEffectPath, "utf8"), /^\d+\n$/u);

    let providerCalls = 0;
    const restarted = createDurableRepairProviderSession({
      directory,
      provider: Object.freeze({
        async executeRepairEffect() {
          providerCalls += 1;
          throw new Error("completed-provider-result-was-not-restored");
        }
      })
    });
    const restored = await restarted.executeRepairEffect(value.request);
    assert.equal(providerCalls, 0);
    assert.equal(equalBytes(restored.placement.lease, value.placement.lease), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unresolved winner imports a completed proof without a duplicate provider call", { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-provider-session-crash-"));
  try {
    const directory = join(root, "session");
    const payloadPath = join(root, "child.json");
    const sideEffectPath = join(root, "side-effect");
    const value = fixture(directory, sideEffectPath);
    await writeFile(payloadPath, JSON.stringify({
      ...value.child,
      mode: "crash-before-result",
      ready_path: null,
      release_path: null
    }));
    const crashed = spawnSync(process.execPath, [childPath, payloadPath], {
      encoding: "utf8",
      timeout: 20_000
    });
    assert.equal(crashed.status, 87, crashed.stderr);
    assert.match(await readFile(sideEffectPath, "utf8"), /^\d+\n$/u);

    let providerCalls = 0;
    const restarted = createDurableRepairProviderSession({
      directory,
      provider: Object.freeze({
        async executeRepairEffect() {
          providerCalls += 1;
          return { placement: value.placement };
        }
      })
    });
    await assert.rejects(
      restarted.executeRepairEffect(value.request),
      error => error?.code === "E_PLACEMENT_PROVIDER_SESSION_CLAIMED"
    );
    assert.equal(providerCalls, 0);

    const recovery = createDurableRepairProviderResultRecovery({ directory });
    const recovered = recovery.recoverCompletedRepairEffect(Object.freeze({
      ...value.request,
      placement: value.placement
    }));
    assert.equal(equalBytes(recovered.placement.lease, value.placement.lease), true);
    const restored = await restarted.executeRepairEffect(value.request);
    assert.equal(equalBytes(restored.placement.offer, value.placement.offer), true);
    assert.equal(providerCalls, 0);

    assert.throws(() => recovery.recoverCompletedRepairEffect(Object.freeze({
      ...value.request,
      placement: Object.freeze({ ...value.placement, observed_at_ms: "1501" })
    })), error => error?.code === "E_PLACEMENT_PROVIDER_SESSION_IMMUTABLE_COLLISION");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
