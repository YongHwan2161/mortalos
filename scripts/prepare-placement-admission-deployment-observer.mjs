#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { canonicalBytes } from "../src/codec.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/prepare-placement-admission-deployment-observer.mjs " +
    "--authority <observer-authority.json> --output <observer-public-identity.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = ["authority", "output"];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.includes(name) || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    values[name] = value;
  }
  for (const required of allowed) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
  }
  return values;
}

async function ensureAbsent(path) {
  try {
    await stat(path);
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS", "output");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-deployment-observer-${process.pid}-${randomBytes(16).toString("hex")}`
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
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_COLLISION", "output");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const authorityPath = resolve(root, values.authority);
  const outputPath = resolve(root, values.output);
  if (authorityPath === outputPath) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const bytes = canonicalBytes(authority.custodian);
  await publishNoReplace(outputPath, bytes);
  process.stdout.write(`${JSON.stringify({
    non_authority: true,
    observer_key_id: authority.custodian.key_id,
    output: outputPath,
    status: "deployment-observer-public-identity-prepared"
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
