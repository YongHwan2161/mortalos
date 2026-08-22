#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS,
  verifyPlacementAdmissionDeploymentAttestationView
} from "../lab/placement/admission-deployment-attestation.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/verify-placement-admission-deployment-attestation-view.mjs " +
    "--view <attestation-view.json> --attestation <attestation.json> " +
    "--attestation <attestation.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  values.attestation = [];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (name === "attestation") {
      values.attestation.push(value);
      continue;
    }
    if (name !== "view" || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    values.view = value;
  }
  if (
    !Object.hasOwn(values, "view") ||
    values.attestation.length <
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_min ||
    values.attestation.length >
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
  return values;
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_LIMIT", label);
  }
  return bytes;
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const viewPath = resolve(root, values.view);
  const attestationPaths = values.attestation.map((value) => resolve(root, value));
  if (new Set([viewPath, ...attestationPaths]).size !== attestationPaths.length + 1) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  const [viewBytes, attestationBytes] = await Promise.all([
    readBounded(
      viewPath,
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.view_bytes,
      "attestation-view"
    ),
    Promise.all(attestationPaths.map((path, index) => readBounded(
      path,
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes,
      `attestation-${index}`
    )))
  ]);
  const view = verifyPlacementAdmissionDeploymentAttestationView({
    attestation_bytes: attestationBytes,
    view_bytes: viewBytes
  });
  process.stdout.write(`${JSON.stringify({
    attestation_count: view.attestation_count,
    attestations_verified: view.attestations_verified,
    membership_candidate_view_id: view.membership_candidate_view_id,
    non_authority: true,
    status: view.status,
    view_id: view.view_id
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
