#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isCanonical, parseJsonBytes } from "../src/codec.mjs";
import {
  createPlacementAdmissionDeploymentPlan,
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS
} from "../lab/placement/admission-deployment-plan.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS
} from "../lab/placement/admission-deployment-observer.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const INPUT_FORMAT = "mortalos-placement-admission-deployment-plan-input/1";

function usage() {
  return "usage: node scripts/create-placement-admission-deployment-plan.mjs " +
    "--assignments <public-assignments.json> --bundle <ceremony-bundle.json> " +
    "--expires-at-ms <integer> --issued-at-ms <integer> --not-before-ms <integer> " +
    "--output <deployment-plan.json> [--timeout-ms <1000..60000>]";
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
    "assignments",
    "bundle",
    "expires-at-ms",
    "issued-at-ms",
    "not-before-ms",
    "output",
    "timeout-ms"
  ];
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
    if (required !== "timeout-ms" && !Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
  }
  return values;
}

function integer(value, label) {
  if (!/^\d+$/u.test(value)) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", label);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", label);
  }
  return result;
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

function assignmentsFrom(bytes) {
  let value;
  try {
    value = parseJsonBytes(bytes);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "assignments-json");
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "assignments-canonical");
  }
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    value.format !== INPUT_FORMAT ||
    !Array.isArray(value.observers)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "assignments-envelope");
  const assignments = new Array(value.observers.length);
  for (let index = 0; index < value.observers.length; index += 1) {
    const current = value.observers[index];
    if (
      current === null || typeof current !== "object" || Array.isArray(current) ||
      Object.keys(current).length !== 4
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "assignment");
    assignments[index] = {
      declared_administration_id: current.declared_administration_id,
      declared_failure_domain_id: current.declared_failure_domain_id,
      declared_vantage_id: current.declared_vantage_id,
      observer: current.observer,
      observer_nonce: randomBytes(
        PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes
      )
    };
  }
  return assignments;
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
    `.mortalos-pending-deployment-plan-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const assignmentsPath = resolve(root, values.assignments);
  const bundlePath = resolve(root, values.bundle);
  const outputPath = resolve(root, values.output);
  if (new Set([assignmentsPath, bundlePath, outputPath]).size !== 3) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const assignmentBytes = await readBounded(
    assignmentsPath,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "assignments"
  );
  const bundleBytes = await readBounded(bundlePath, 2 * 1024 * 1024, "bundle");
  const plan = createPlacementAdmissionDeploymentPlan({
    ceremony_bundle_bytes: bundleBytes,
    expires_at_ms: integer(values["expires-at-ms"], "expires-at-ms"),
    issued_at_ms: integer(values["issued-at-ms"], "issued-at-ms"),
    not_before_ms: integer(values["not-before-ms"], "not-before-ms"),
    observers: assignmentsFrom(assignmentBytes),
    timeout_ms: values["timeout-ms"] === undefined
      ? 15_000
      : integer(values["timeout-ms"], "timeout-ms")
  });
  await publishNoReplace(outputPath, plan.bytes);
  process.stdout.write(`${JSON.stringify({
    ceremony_bundle_id: plan.ceremony_bundle_id,
    non_authority: true,
    observer_count: plan.observers.length,
    output: outputPath,
    plan_id: plan.plan_id,
    status: plan.status
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
