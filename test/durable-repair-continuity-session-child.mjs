import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createDurableRepairContinuitySession } from "../lab/placement/durable-repair-continuity-session.mjs";
import { decodeBase64Url } from "../src/bytes.mjs";

const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));

if (payload.ready_path) {
  writeFileSync(payload.ready_path, "ready", { flag: "wx" });
  const deadline = Date.now() + 10_000;
  while (!existsSync(payload.release_path)) {
    if (Date.now() >= deadline) throw new Error("continuity-session-release-timeout");
    await delay(5);
  }
}

const session = createDurableRepairContinuitySession({
  continuity: Object.freeze({
    async commitPlacementGeneration() {
      writeFileSync(payload.side_effect_path, `${process.pid}\n`, { flag: "wx" });
      if (payload.mode === "crash-before-result") process.exit(88);
      return Object.freeze({
        capsule_bytes: decodeBase64Url(payload.result_capsule_bytes),
        commit_bytes: decodeBase64Url(payload.result_commit_bytes)
      });
    }
  }),
  directory: payload.directory
});

try {
  await session.commitPlacementGeneration({
    capsule_bytes: decodeBase64Url(payload.capsule_bytes),
    generation_bytes: decodeBase64Url(payload.generation_bytes),
    idempotency_key: payload.idempotency_key
  });
  process.stdout.write(JSON.stringify({ status: "returned" }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    code: error?.code ?? null,
    status: "rejected"
  }));
}
