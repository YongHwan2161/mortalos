#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS,
  verifyPlacementAdmissionPilotInventoryClosure
} from "../lab/placement/admission-pilot-inventory-closure.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS
} from "../lab/placement/admission-pilot-source-attestation.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS
} from "../lab/placement/admission-pilot-source-verdict.mjs";
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
  return "usage: node scripts/verify-placement-admission-pilot-inventory-closure.mjs " +
    "--closure <pilot-inventory-closure.json> --index <pilot-index.json> " +
    "--pilot-evidence <pilot-evidence.json> " +
    "--pilot-source-attestation <pilot-source-attestation.json> " +
    "--pilot-source-verdict <pilot-source-verdict.json> " +
    "--expected-source-commit <40-lowercase-hex> " +
    "--execution-receipt <role-receipt.json> [--execution-receipt <...>] " +
    "--ratification <participant-ratification.json> [--ratification <...>]";
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
  values.ratification = [];
  const singular = [
    "closure",
    "expected-source-commit",
    "index",
    "pilot-evidence",
    "pilot-source-attestation",
    "pilot-source-verdict"
  ];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (name === "execution-receipt" || name === "ratification") {
      values[name].push(value);
    } else if (!singular.includes(name) || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
    } else {
      values[name] = value;
    }
  }
  for (const required of singular) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
    }
  }
  if (
    values["execution-receipt"].length < 1 ||
    values["execution-receipt"].length >
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max ||
    values.ratification.length < 1 ||
    values.ratification.length >
      PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.participants_max ||
    !COMMIT.test(values["expected-source-commit"])
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
  return values;
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_LIMIT", label);
  }
  return bytes;
}

function status(closure) {
  return {
    closure_id: closure.closure_id,
    competing_verdict_policy: closure.competing_verdict_policy,
    coordinator_protocol_authority: closure.coordinator_protocol_authority,
    deployment_plan_id: closure.deployment_plan_id,
    evidence_artifact_count: closure.evidence_artifact_count,
    inventory_closure: closure.inventory_closure,
    non_authority: true,
    participant_count: closure.participant_count,
    pilot_evidence_id: closure.pilot_evidence_id,
    ratifications_verified: closure.ratifications_verified,
    source_commit: closure.source_commit,
    source_verdict_id: closure.source_verdict_id,
    source_verdict_verified: closure.source_verdict_verified,
    status: closure.status,
    topology_authority: closure.topology_authority
  };
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const closurePath = resolve(root, values.closure);
  const indexPath = resolve(root, values.index);
  const pilotEvidencePath = resolve(root, values["pilot-evidence"]);
  const sourceAttestationPath = resolve(root, values["pilot-source-attestation"]);
  const sourceVerdictPath = resolve(root, values["pilot-source-verdict"]);
  const receiptPaths = values["execution-receipt"].map((entry) => resolve(root, entry));
  const ratificationPaths = values.ratification.map((entry) => resolve(root, entry));
  const paths = [
    closurePath,
    indexPath,
    pilotEvidencePath,
    sourceAttestationPath,
    sourceVerdictPath,
    ...receiptPaths,
    ...ratificationPaths
  ];
  if (new Set(paths).size !== paths.length) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_FORMAT", "path-alias");
  }
  const loaded = loadPlacementAdmissionPilotEvidenceIndex(indexPath);
  if (loaded.source_commit !== values["expected-source-commit"]) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_BINDING", "source-commit");
  }
  const [
    closureBytes,
    pilotEvidenceBytes,
    sourceAttestationBytes,
    sourceVerdictBytes,
    executionReceiptBytes,
    ratificationBytes
  ] = await Promise.all([
    readBounded(
      closurePath,
      PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.closure_bytes,
      "pilot-inventory-closure"
    ),
    readBounded(
      pilotEvidencePath,
      PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes,
      "pilot-evidence"
    ),
    readBounded(
      sourceAttestationPath,
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.evidence_bytes,
      "pilot-source-attestation"
    ),
    readBounded(
      sourceVerdictPath,
      PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.verdict_bytes,
      "pilot-source-verdict"
    ),
    Promise.all(receiptPaths.map((path, index) => readBounded(
      path,
      PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes,
      `execution-receipt-${index}`
    ))),
    Promise.all(ratificationPaths.map((path, index) => readBounded(
      path,
      PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.ratification_bytes,
      `ratification-${index}`
    )))
  ]);
  const closure = verifyPlacementAdmissionPilotInventoryClosure({
    capsule_bytes: loaded.capsule_bytes,
    ceremony_records: loaded.ceremony_records,
    closure_bytes: closureBytes,
    deployment: loaded.deployment,
    epoch_records: loaded.epoch_records,
    execution_receipt_bytes: executionReceiptBytes,
    pilot_evidence_bytes: pilotEvidenceBytes,
    ratification_bytes: ratificationBytes,
    source_attestation_bytes: sourceAttestationBytes,
    source_commit: loaded.source_commit,
    source_verdict_bytes: sourceVerdictBytes
  });
  process.stdout.write(`${JSON.stringify(status(closure))}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_INVENTORY_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
