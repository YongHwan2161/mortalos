#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPlacementAdmissionDeploymentAttestationView,
  PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS
} from "../lab/placement/admission-deployment-attestation.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/create-placement-admission-deployment-attestation-view.mjs " +
    "--attestation <attestation.json> --attestation <attestation.json> " +
    "--output <attestation-view.json>";
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
    if (name !== "output" || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    values.output = value;
  }
  if (
    !Object.hasOwn(values, "output") ||
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
    `.mortalos-pending-deployment-attestation-view-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const outputPath = resolve(root, values.output);
  const attestationPaths = values.attestation.map((value) => resolve(root, value));
  if (new Set([outputPath, ...attestationPaths]).size !== attestationPaths.length + 1) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const attestationBytes = await Promise.all(attestationPaths.map((path, index) =>
    readBounded(
      path,
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes,
      `attestation-${index}`
    )));
  const view = createPlacementAdmissionDeploymentAttestationView({
    attestation_bytes: attestationBytes
  });
  await publishNoReplace(outputPath, view.bytes);
  process.stdout.write(`${JSON.stringify({
    attestation_count: view.attestation_count,
    membership_candidate_view_id: view.membership_candidate_view_id,
    non_authority: true,
    output: outputPath,
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
