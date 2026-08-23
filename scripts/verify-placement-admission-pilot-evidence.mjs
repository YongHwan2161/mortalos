#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS,
  verifyPlacementAdmissionPilotEvidence
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  loadPlacementAdmissionPilotEvidenceIndex
} from "./placement-admission-pilot-evidence-index.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const COMMIT = /^[0-9a-f]{40}$/u;

function usage() {
  return "usage: node scripts/verify-placement-admission-pilot-evidence.mjs " +
    "--evidence <pilot-evidence.json> --expected-source-commit <40-lowercase-hex> " +
    "--index <public-index.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set(["evidence", "expected-source-commit", "index"]);
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

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_LIMIT", label);
  }
  return bytes;
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const evidencePath = resolve(root, values.evidence);
  const indexPath = resolve(root, values.index);
  if (evidencePath === indexPath) {
    fail("E_PLACEMENT_ADMISSION_PILOT_CLI_FORMAT", "path-alias");
  }
  const evidenceBytes = await readBounded(
    evidencePath,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes,
    "evidence"
  );
  const loaded = loadPlacementAdmissionPilotEvidenceIndex(indexPath);
  const evidence = verifyPlacementAdmissionPilotEvidence({
    capsule_bytes: loaded.capsule_bytes,
    ceremony_records: loaded.ceremony_records,
    deployment: loaded.deployment,
    epoch_records: loaded.epoch_records,
    evidence_bytes: evidenceBytes,
    expected_source_commit: values["expected-source-commit"],
    source_commit: loaded.source_commit
  });
  process.stdout.write(`${JSON.stringify({
    epoch_count: evidence.epoch_count,
    evidence_id: evidence.evidence_id,
    non_authority: true,
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
