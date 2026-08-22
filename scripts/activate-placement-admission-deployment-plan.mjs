#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPlacementAdmissionDeploymentPlanActivation,
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS
} from "../lab/placement/admission-deployment-plan-activation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS
} from "../lab/placement/admission-deployment-plan.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/activate-placement-admission-deployment-plan.mjs " +
    "--deployment-plan <deployment-plan.json> --acceptance <acceptance.json> " +
    "--acceptance <acceptance.json> --output <plan-activation.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  values.acceptance = [];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (name === "acceptance") {
      values.acceptance.push(value);
      continue;
    }
    if (
      (name !== "deployment-plan" && name !== "output") ||
      Object.hasOwn(values, name)
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    values[name] = value;
  }
  if (
    !Object.hasOwn(values, "deployment-plan") ||
    !Object.hasOwn(values, "output") ||
    values.acceptance.length < PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min ||
    values.acceptance.length > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max
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
    `.mortalos-pending-deployment-plan-activation-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const planPath = resolve(root, values["deployment-plan"]);
  const outputPath = resolve(root, values.output);
  const acceptancePaths = values.acceptance.map((value) => resolve(root, value));
  if (new Set([planPath, outputPath, ...acceptancePaths]).size !== acceptancePaths.length + 2) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const planBytes = await readBounded(
    planPath,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "deployment-plan"
  );
  const acceptanceBytes = await Promise.all(acceptancePaths.map((path, index) =>
    readBounded(
      path,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes,
      `plan-acceptance-${index}`
    )));
  const activation = createPlacementAdmissionDeploymentPlanActivation({
    acceptance_bytes: acceptanceBytes,
    plan_bytes: planBytes
  });
  await publishNoReplace(outputPath, activation.bytes);
  process.stdout.write(`${JSON.stringify({
    acceptance_count: activation.acceptance_ids.length,
    activation_id: activation.activation_id,
    non_authority: true,
    output: outputPath,
    plan_id: activation.plan_id,
    status: activation.status
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
