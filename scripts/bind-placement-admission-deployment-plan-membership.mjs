#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  createPlacementAdmissionDeploymentPlanMembership,
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS
} from "../lab/placement/admission-deployment-plan-membership.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS
} from "../lab/placement/admission-deployment-plan-activation.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/bind-placement-admission-deployment-plan-membership.mjs " +
    "--activation <activation.json> --bundle <ceremony-bundle.json> " +
    "--capsule <capsule.json> --membership-epoch <epoch.json> " +
    "[--membership-epoch <epoch.json> ...] --output <membership.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set([
    "activation",
    "bundle",
    "capsule",
    "membership-epoch",
    "output"
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.has(name) || (name !== "membership-epoch" && Object.hasOwn(values, name))) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    if (name === "membership-epoch") {
      if (!Object.hasOwn(values, name)) values[name] = [];
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  for (const required of ["activation", "bundle", "capsule", "membership-epoch", "output"]) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
  }
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
    `.mortalos-pending-deployment-plan-membership-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const paths = Object.create(null);
  paths.activation = resolve(root, values.activation);
  paths.bundle = resolve(root, values.bundle);
  paths.capsule = resolve(root, values.capsule);
  paths.output = resolve(root, values.output);
  const membershipEpochPaths = values["membership-epoch"].map((value) => resolve(root, value));
  const allPaths = [
    paths.activation,
    paths.bundle,
    paths.capsule,
    paths.output,
    ...membershipEpochPaths
  ];
  if (new Set(allPaths).size !== allPaths.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(paths.output);
  const [activationBytes, bundleBytes, capsuleBytes, membershipEpochCandidateBytes] =
    await Promise.all([
      readBounded(
        paths.activation,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes,
        "activation"
      ),
      readBounded(
        paths.bundle,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.ceremony_bundle_bytes,
        "bundle"
      ),
      readBounded(paths.capsule, PROTOCOL_PROFILE.provider.object_bytes, "capsule"),
      Promise.all(membershipEpochPaths.map((path, index) => readBounded(
        path,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
        `membership-epoch-${index}`
      )))
    ]);
  const membership = createPlacementAdmissionDeploymentPlanMembership({
    activation_bytes: activationBytes,
    capsule_bytes: capsuleBytes,
    ceremony_bundle_bytes: bundleBytes,
    membership_epoch_candidate_bytes: membershipEpochCandidateBytes
  });
  await publishNoReplace(paths.output, membership.bytes);
  process.stdout.write(`${JSON.stringify({
    activation_id: membership.activation_id,
    membership_candidate_view_id: membership.membership_candidate_view_id,
    membership_epoch_id: membership.membership_epoch_id,
    membership_id: membership.membership_id,
    observer_count: membership.observer_key_ids.length,
    output: paths.output,
    plan_id: membership.plan_id,
    status: membership.status
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
