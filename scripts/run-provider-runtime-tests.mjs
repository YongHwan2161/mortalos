import { spawn } from "node:child_process";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeBase64Url } from "../src/bytes.mjs";
import {
  createContinuity,
  createContinuityAuthority,
  handoffContinuity
} from "../sdk/continuity.mjs";
import { resolveWindowsWorkerdBinary } from "./resolve-workerd-binary.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = resolve(root, "node_modules", "vitest", "vitest.mjs");
const temporaryRoot = await mkdtemp(join(tmpdir(), "mortalos-provider-runtime-"));
const fixturePath = join(temporaryRoot, "continuity-fixture.json");
let temporaryWorkerd = null;
const env = { ...process.env };

async function buildContinuityFixture() {
  const authorityA = await createContinuityAuthority();
  const authorityB = await createContinuityAuthority();
  const resourceBytes = new TextEncoder().encode("workerd provider possession runtime");
  try {
    const created = await createContinuity({
      authority: authorityA,
      resourceBytes,
      transitionId: "workerd-provider-create"
    });
    const request = await handoffContinuity({
      authority: authorityB,
      capsuleBytes: created.capsule_bytes,
      phase: "request"
    });
    const proposal = await handoffContinuity({
      authority: authorityA,
      capsuleBytes: created.capsule_bytes,
      phase: "propose",
      request
    });
    const handed = await handoffContinuity({
      authority: authorityB,
      capsuleBytes: created.capsule_bytes,
      phase: "accept",
      proposal
    });
    return {
      copies: handed.copies.map((copy) => encodeBase64Url(copy)),
      head_hash: handed.head_hash,
      organism_id: handed.organism_id,
      resource_bytes: encodeBase64Url(resourceBytes)
    };
  } finally {
    authorityA.destroy();
    authorityB.destroy();
  }
}

await writeFile(fixturePath, JSON.stringify(await buildContinuityFixture()), {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600
});
env.MORTALOS_PROVIDER_RUNTIME_FIXTURE = fixturePath;

if (process.platform === "win32") {
  const source = await resolveWindowsWorkerdBinary(root);
  temporaryWorkerd = join(temporaryRoot, "workerd.exe");
  const sourceStat = await stat(source);
  await copyFile(source, temporaryWorkerd);
  const copiedStat = await stat(temporaryWorkerd);
  if (copiedStat.size !== sourceStat.size) throw new Error("temporary workerd binary copy is incomplete");
  env.MINIFLARE_WORKERD_PATH = temporaryWorkerd;
}

try {
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(
      process.execPath,
      [vitest, "run", "--config", resolve(root, "provider", "vitest.config.mjs")],
      { cwd: root, env, stdio: "inherit", windowsHide: true }
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`provider runtime tests terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
