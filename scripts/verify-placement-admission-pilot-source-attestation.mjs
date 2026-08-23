#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS,
  verifyPlacementAdmissionPilotSourceAttestation
} from "../lab/placement/admission-pilot-source-attestation.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS
} from "../lab/placement/admission-role-execution-receipt.mjs";
import {
  loadPlacementAdmissionPilotEvidenceIndex
} from "./placement-admission-pilot-evidence-index.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const COMMIT = /^[0-9a-f]{40}$/u;

function usage() {
  return "usage: node scripts/verify-placement-admission-pilot-source-attestation.mjs " +
    "--attestation <pilot-source-attestation.json> --index <pilot-index.json> " +
    "--pilot-evidence <pilot-evidence.json> " +
    "--expected-source-commit <40-lowercase-hex> " +
    "--execution-receipt <role-receipt.json> [--execution-receipt <...>]";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  values["execution-receipt"] = [];
  const singular = ["attestation", "expected-source-commit", "index", "pilot-evidence"];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (name === "execution-receipt") {
      values[name].push(value);
    } else if (!singular.includes(name) || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_USAGE", usage());
    } else {
      values[name] = value;
    }
  }
  for (const required of singular) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_USAGE", usage());
    }
  }
  if (
    values["execution-receipt"].length < 1 ||
    values["execution-receipt"].length >
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max ||
    !COMMIT.test(values["expected-source-commit"])
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_USAGE", usage());
  return values;
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_LIMIT", label);
  }
  return bytes;
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const attestationPath = resolve(root, values.attestation);
  const indexPath = resolve(root, values.index);
  const pilotEvidencePath = resolve(root, values["pilot-evidence"]);
  const receiptPaths = values["execution-receipt"].map((entry) => resolve(root, entry));
  const paths = [attestationPath, indexPath, pilotEvidencePath, ...receiptPaths];
  if (new Set(paths).size !== paths.length) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_FORMAT", "path-alias");
  }
  const loaded = loadPlacementAdmissionPilotEvidenceIndex(indexPath);
  if (loaded.source_commit !== values["expected-source-commit"]) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_CLI_BINDING", "source-commit");
  }
  const [attestationBytes, pilotEvidenceBytes, executionReceiptBytes] = await Promise.all([
    readBounded(
      attestationPath,
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.evidence_bytes,
      "pilot-source-attestation"
    ),
    readBounded(
      pilotEvidencePath,
      PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes,
      "pilot-evidence"
    ),
    Promise.all(receiptPaths.map((path, index) => readBounded(
      path,
      PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes,
      `execution-receipt-${index}`
    )))
  ]);
  const attestation = verifyPlacementAdmissionPilotSourceAttestation({
    capsule_bytes: loaded.capsule_bytes,
    ceremony_records: loaded.ceremony_records,
    deployment: loaded.deployment,
    epoch_records: loaded.epoch_records,
    execution_receipt_bytes: executionReceiptBytes,
    pilot_evidence_bytes: pilotEvidenceBytes,
    source_attestation_bytes: attestationBytes,
    source_commit: loaded.source_commit
  });
  process.stdout.write(`${JSON.stringify({
    attestation_id: attestation.attestation_id,
    attested_artifact_count: attestation.attested_artifact_count,
    non_authority: true,
    pilot_evidence_id: attestation.pilot_evidence_id,
    receipts_verified: attestation.receipts_verified,
    role_key_count: attestation.role_key_count,
    source_commit: attestation.source_commit,
    source_commit_execution_binding: attestation.source_commit_execution_binding,
    status: attestation.status,
    topology_authority: attestation.topology_authority,
    unsigned_coordinator_execution_binding:
      attestation.unsigned_coordinator_execution_binding
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_SOURCE_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
