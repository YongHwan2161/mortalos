#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { link, open, readFile, realpath, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import {
  createPlacementAdmissionRoleExecutionReceipt,
  PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS
} from "../lab/placement/admission-role-execution-receipt.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const COMMIT = /^[0-9a-f]{40}$/u;

function usage() {
  return "usage: node scripts/attest-placement-admission-role-execution.mjs " +
    "--authority <role-authority.json> --artifact <public-artifact.json> " +
    "--artifact-id <sha256:...> --artifact-kind <kind> --role <role> " +
    "--source-commit <40-lowercase-hex> --repo-root <clean-checkout> " +
    "--output <execution-receipt.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = [
    "artifact",
    "artifact-id",
    "artifact-kind",
    "authority",
    "output",
    "repo-root",
    "role",
    "source-commit"
  ];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.includes(name) || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_USAGE", usage());
    }
    values[name] = value;
  }
  for (const required of allowed) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_USAGE", usage());
    }
  }
  if (!COMMIT.test(values["source-commit"])) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_FORMAT", "source-commit");
  }
  return values;
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_LIMIT", label);
  }
  return bytes;
}

async function ensureAbsent(path) {
  try {
    await stat(path);
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_OUTPUT_EXISTS", "output");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function runGit(repoRoot, args) {
  const child = spawn("git", ["-C", repoRoot, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveCode, reject) => {
    child.once("error", reject);
    child.once("exit", resolveCode);
  });
  if (code !== 0) {
    fail(
      "E_PLACEMENT_ADMISSION_EXECUTION_CLI_GIT",
      stderr.trim().slice(0, 512) || `exit-${code}`
    );
  }
  return stdout.trim();
}

async function verifyCleanCheckout(repoRoot, expectedCommit) {
  const metadata = await stat(repoRoot);
  if (!metadata.isDirectory()) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_GIT", "repo-root-not-directory");
  }
  const actualRoot = await realpath(repoRoot);
  const discoveredRoot = await realpath(await runGit(actualRoot, [
    "rev-parse",
    "--show-toplevel"
  ]));
  if (actualRoot !== discoveredRoot) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_GIT", "repo-root-mismatch");
  }
  const head = await runGit(actualRoot, ["rev-parse", "HEAD"]);
  if (head !== expectedCommit) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_SOURCE", "source-commit-head-mismatch");
  }
  const status = await runGit(actualRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--ignore-submodules=none"
  ]);
  if (status !== "") {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_SOURCE", "checkout-not-clean");
  }
  return actualRoot;
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-role-execution-receipt-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await link(pending, path);
    const readback = await readFile(path);
    if (!readback.equals(bytes)) {
      fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_COLLISION", "output");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const authorityPath = resolve(root, values.authority);
  const artifactPath = resolve(root, values.artifact);
  const outputPath = resolve(root, values.output);
  const repoRoot = resolve(root, values["repo-root"]);
  if (new Set([authorityPath, artifactPath, outputPath]).size !== 3) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const cleanRoot = await verifyCleanCheckout(repoRoot, values["source-commit"]);
  const artifactBytes = await readBounded(
    artifactPath,
    PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.artifact_bytes,
    "artifact"
  );
  const authority = await loadNodeAuthority(authorityPath, { create: false });
  const receipt = await createPlacementAdmissionRoleExecutionReceipt({
    artifact_bytes: artifactBytes,
    artifact_id: values["artifact-id"],
    artifact_kind: values["artifact-kind"],
    role: values.role,
    signer: authority,
    source_commit: values["source-commit"]
  });
  await publishNoReplace(outputPath, receipt.bytes);
  process.stdout.write(`${JSON.stringify({
    artifact_digest: receipt.artifact_digest,
    artifact_id: receipt.artifact_id,
    artifact_kind: receipt.artifact_kind,
    checkout_state: receipt.checkout_state,
    non_authority: true,
    output: outputPath,
    receipt_id: receipt.receipt_id,
    repo_root: cleanRoot,
    role: receipt.role,
    signer_key_id: receipt.signer.key_id,
    source_commit: receipt.source_commit,
    status: receipt.status
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_EXECUTION_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
