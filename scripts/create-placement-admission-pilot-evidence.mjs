#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPlacementAdmissionPilotEvidence
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  loadPlacementAdmissionPilotEvidenceIndex
} from "./placement-admission-pilot-evidence-index.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const COMMIT = /^[0-9a-f]{40}$/u;

function usage() {
  return "usage: node scripts/create-placement-admission-pilot-evidence.mjs " +
    "--expected-source-commit <40-lowercase-hex> --index <public-index.json> " +
    "--output <pilot-evidence.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set(["expected-source-commit", "index", "output"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      typeof key !== "string" || !key.startsWith("--") || value === undefined ||
      !allowed.has(key.slice(2)) || Object.hasOwn(values, key.slice(2))
    ) fail("E_PLACEMENT_ADMISSION_PILOT_CLI_USAGE", usage());
    values[key.slice(2)] = value;
  }
  for (const required of allowed) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_PILOT_CLI_USAGE", usage());
    }
  }
  if (!COMMIT.test(values["expected-source-commit"])) {
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_USAGE", usage());
  }
  return values;
}

async function ensureAbsent(path) {
  try {
    await stat(path);
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_OUTPUT_EXISTS", "output");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-pilot-evidence-${process.pid}-${randomBytes(16).toString("hex")}`
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
      fail("E_PLACEMENT_ADMISSION_PILOT_CLI_COLLISION", "output");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const indexPath = resolve(root, values.index);
  const outputPath = resolve(root, values.output);
  if (indexPath === outputPath) {
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const loaded = loadPlacementAdmissionPilotEvidenceIndex(indexPath);
  if (loaded.source_commit !== values["expected-source-commit"]) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "source-commit");
  }
  const evidence = createPlacementAdmissionPilotEvidence({
    capsule_bytes: loaded.capsule_bytes,
    ceremony_records: loaded.ceremony_records,
    deployment: loaded.deployment,
    epoch_records: loaded.epoch_records,
    source_commit: loaded.source_commit
  });
  await publishNoReplace(outputPath, evidence.bytes);
  process.stdout.write(`${JSON.stringify({
    epoch_count: evidence.epoch_count,
    evidence_id: evidence.evidence_id,
    non_authority: true,
    output: outputPath,
    public_chain_verified: true,
    source_commit: evidence.source_commit,
    source_commit_execution_binding: evidence.source_commit_execution_binding,
    status: evidence.status,
    topology_authority: evidence.topology_authority,
    view_id: evidence.view_id
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_PILOT_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
