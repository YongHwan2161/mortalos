import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createDurableRepairContinuityResultRecovery,
  createDurableRepairContinuitySession
} from "../lab/placement/durable-repair-continuity-session.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";

const childPath = fileURLToPath(new URL(
  "./durable-repair-continuity-session-child.mjs",
  import.meta.url
));

function fixture(directory, sideEffectPath) {
  const idempotencyKey = domainHash(
    "MortalOS continuity-session test completion",
    canonicalBytes({ generation: "2" })
  );
  const request = Object.freeze({
    capsule_bytes: new Uint8Array([1, 2, 3]),
    generation_bytes: new Uint8Array([4, 5, 6]),
    idempotency_key: idempotencyKey
  });
  const result = Object.freeze({
    capsule_bytes: new Uint8Array([7, 8, 9]),
    commit_bytes: new Uint8Array([10, 11, 12])
  });
  return {
    child: {
      capsule_bytes: encodeBase64Url(request.capsule_bytes),
      directory,
      generation_bytes: encodeBase64Url(request.generation_bytes),
      idempotency_key: idempotencyKey,
      result_capsule_bytes: encodeBase64Url(result.capsule_bytes),
      result_commit_bytes: encodeBase64Url(result.commit_bytes),
      side_effect_path: sideEffectPath
    },
    request,
    result
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
  return new Promise(resolve => {
    child.once("close", (code, signal) => resolve({ code, signal, stderr, stdout }));
  });
}

async function waitForFiles(paths) {
  const deadline = Date.now() + 10_000;
  while (!paths.every(existsSync)) {
    if (Date.now() >= deadline) throw new Error("continuity-session-ready-timeout");
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test("durable Continuity session gives one process the first commit claim", { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-continuity-session-race-"));
  try {
    const directory = join(root, "session");
    const releasePath = join(root, "release");
    const sideEffectPath = join(root, "side-effect");
    const value = fixture(directory, sideEffectPath);
    const readyPaths = [join(root, "ready-0"), join(root, "ready-1")];
    const payloadPaths = [join(root, "child-0.json"), join(root, "child-1.json")];
    for (let index = 0; index < 2; index += 1) {
      await writeFile(payloadPaths[index], JSON.stringify({
        ...value.child,
        mode: "return",
        ready_path: readyPaths[index],
        release_path: releasePath
      }));
    }
    const completions = payloadPaths.map(runChild);
    await waitForFiles(readyPaths);
    await writeFile(releasePath, "release", { flag: "wx" });
    const completed = await Promise.all(completions);
    for (const result of completed) assert.equal(result.code, 0, result.stderr);
    const verdicts = completed.map(result => JSON.parse(result.stdout));
    assert.equal(verdicts.some(result => result.status === "returned"), true);
    assert.equal(verdicts.every(result =>
      result.status === "returned" ||
      (result.status === "rejected" && result.code === "E_PLACEMENT_CONTINUITY_SESSION_CLAIMED")
    ), true);
    assert.match(await readFile(sideEffectPath, "utf8"), /^\d+\n$/u);

    let commitCalls = 0;
    const restarted = createDurableRepairContinuitySession({
      continuity: Object.freeze({
        async commitPlacementGeneration() {
          commitCalls += 1;
          throw new Error("completed-continuity-result-was-not-restored");
        }
      }),
      directory
    });
    const restored = await restarted.commitPlacementGeneration(value.request);
    assert.equal(commitCalls, 0);
    assert.equal(equalBytes(restored.capsule_bytes, value.result.capsule_bytes), true);
    assert.equal(equalBytes(restored.commit_bytes, value.result.commit_bytes), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unresolved Continuity winner imports a completed proof without another commit", { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-continuity-session-crash-"));
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
    assert.equal(crashed.status, 88, crashed.stderr);
    assert.match(await readFile(sideEffectPath, "utf8"), /^\d+\n$/u);

    let commitCalls = 0;
    const restarted = createDurableRepairContinuitySession({
      continuity: Object.freeze({
        async commitPlacementGeneration() {
          commitCalls += 1;
          return value.result;
        }
      }),
      directory
    });
    await assert.rejects(
      restarted.commitPlacementGeneration(value.request),
      error => error?.code === "E_PLACEMENT_CONTINUITY_SESSION_CLAIMED"
    );
    assert.equal(commitCalls, 0);

    const recovery = createDurableRepairContinuityResultRecovery({ directory });
    const recovered = recovery.recoverCompletedPlacementGeneration(Object.freeze({
      ...value.request,
      result_capsule_bytes: value.result.capsule_bytes,
      result_commit_bytes: value.result.commit_bytes
    }));
    assert.equal(equalBytes(recovered.capsule_bytes, value.result.capsule_bytes), true);
    const restored = await restarted.commitPlacementGeneration(value.request);
    assert.equal(equalBytes(restored.commit_bytes, value.result.commit_bytes), true);
    assert.equal(commitCalls, 0);

    const conflictingCommit = new Uint8Array(value.result.commit_bytes);
    conflictingCommit[0] ^= 1;
    assert.throws(() => recovery.recoverCompletedPlacementGeneration(Object.freeze({
      ...value.request,
      result_capsule_bytes: value.result.capsule_bytes,
      result_commit_bytes: conflictingCommit
    })), error => error?.code === "E_PLACEMENT_CONTINUITY_SESSION_IMMUTABLE_COLLISION");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
