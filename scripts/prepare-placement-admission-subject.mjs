#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/prepare-placement-admission-subject.mjs " +
    "--authority <subject-authority.json> --output <subject-public-identity.json>";
}

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_SIGNER_CLI";
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set(["--authority", "--output"]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name) || value === undefined || values[name] !== undefined) {
      fail(usage());
    }
    values[name] = value;
  }
  for (const required of allowed) {
    if (values[required] === undefined) fail(usage());
  }
  return values;
}

async function ensureAbsent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  fail("output path already exists");
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-subject-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await link(pending, path);
    const readback = new Uint8Array(await readFile(path));
    if (!equalBytes(readback, bytes)) fail("published subject identity readback mismatch");
  } finally {
    if (handle !== null && handle !== undefined) await handle.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const authorityPath = resolve(root, values["--authority"]);
  const outputPath = resolve(root, values["--output"]);
  if (authorityPath === outputPath) fail("authority and output paths must differ");
  await ensureAbsent(outputPath);
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const bytes = canonicalBytes(authority.custodian);
  await publishNoReplace(outputPath, bytes);
  process.stdout.write(`${JSON.stringify({
    output: outputPath,
    private_material_exposed: false,
    status: "placement-admission-subject-public-identity-prepared",
    subject_key_id: authority.custodian.key_id
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_SIGNER_CLI",
    detail: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
