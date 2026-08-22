#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import {
  createPlacementAdmissionPilotInventoryRatification
} from "../lab/placement/admission-pilot-inventory-closure.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS,
  restorePlacementAdmissionDeploymentPlan
} from "../lab/placement/admission-deployment-plan.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS
} from "../lab/placement/admission-pilot-source-verdict.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/ratify-placement-admission-pilot-source-verdict.mjs " +
    "--authority <role-authority.json> --deployment-plan <deployment-plan.json> " +
    "--source-verdict <pilot-source-verdict.json> --output <ratification.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const names = ["authority", "deployment-plan", "output", "source-verdict"];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      typeof key !== "string" || !key.startsWith("--") || value === undefined ||
      !names.includes(key.slice(2)) || Object.hasOwn(values, key.slice(2))
    ) fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
    values[key.slice(2)] = value;
  }
  for (const name of names) {
    if (!Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_USAGE", usage());
    }
  }
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

async function ensureAbsent(path) {
  try {
    await stat(path);
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_OUTPUT_EXISTS", "output");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-pilot-inventory-ratification-${process.pid}-${randomBytes(16).toString("hex")}`
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
      fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_COLLISION", "output");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const authorityPath = resolve(root, values.authority);
  const deploymentPlanPath = resolve(root, values["deployment-plan"]);
  const verdictPath = resolve(root, values["source-verdict"]);
  const outputPath = resolve(root, values.output);
  if (new Set([authorityPath, deploymentPlanPath, verdictPath, outputPath]).size !== 4) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const [deploymentPlanBytes, verdictBytes] = await Promise.all([
    readBounded(
      deploymentPlanPath,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
      "deployment-plan"
    ),
    readBounded(
      verdictPath,
      PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.verdict_bytes,
      "source-verdict"
    )
  ]);
  const plan = restorePlacementAdmissionDeploymentPlan(deploymentPlanBytes);
  const signer = await loadNodeAuthority(authorityPath, { create: false });
  const ratification = await createPlacementAdmissionPilotInventoryRatification({
    deployment_plan_id: plan.plan_id,
    signer,
    source_verdict_bytes: verdictBytes
  });
  await publishNoReplace(outputPath, ratification.bytes);
  process.stdout.write(`${JSON.stringify({
    deployment_plan_id: ratification.deployment_plan_id,
    inventory_statement: ratification.inventory_statement,
    non_authority: true,
    output: outputPath,
    pilot_evidence_id: ratification.pilot_evidence_id,
    ratification_id: ratification.ratification_id,
    signature_verified: ratification.signature_verified,
    signer_key_id: ratification.signer.key_id,
    source_commit: ratification.source_commit,
    source_verdict_id: ratification.source_verdict_id,
    status: ratification.status
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_INVENTORY_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
