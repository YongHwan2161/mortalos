import { spawn } from "node:child_process";
import { copyFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWindowsWorkerdBinary } from "./resolve-workerd-binary.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = resolve(root, "node_modules", "vitest", "vitest.mjs");
let temporaryWorkerd = null;
const env = { ...process.env };

if (process.platform === "win32") {
  const source = await resolveWindowsWorkerdBinary(root);
  temporaryWorkerd = resolve(tmpdir(), `mortalos-workerd-${process.pid}.exe`);
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
      [vitest, "run", "--config", resolve(root, "relay", "vitest.config.mjs")],
      { cwd: root, env, stdio: "inherit", windowsHide: true }
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`relay runtime tests terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  if (temporaryWorkerd) await rm(temporaryWorkerd, { force: true });
}
