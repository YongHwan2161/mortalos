#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  createPlacementMembershipEpochRequest,
  PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS
} from "../lab/placement/admission-membership-epoch-ceremony.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/create-placement-membership-epoch-request.mjs " +
    "--capsule <capsule.json> --ceremony-bundle <bundle.json> " +
    "[--ceremony-bundle <bundle.json> ...] --evaluated-at-ms <decimal> " +
    "--expires-at-ms <decimal> --observer-max-faulty <integer> " +
    "--observer-roster-size <integer> --observer-threshold <integer> " +
    "[--revoked-trust-root-id <sha256:...> ...] " +
    "[--prior-epoch <epoch.json>] --output <request.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const repeated = new Set(["ceremony-bundle", "revoked-trust-root-id"]);
  const allowed = new Set([
    "capsule",
    "ceremony-bundle",
    "evaluated-at-ms",
    "expires-at-ms",
    "observer-max-faulty",
    "observer-roster-size",
    "observer-threshold",
    "output",
    "prior-epoch",
    "revoked-trust-root-id"
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.has(name) || (!repeated.has(name) && Object.hasOwn(values, name))) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
    if (repeated.has(name)) {
      if (!Object.hasOwn(values, name)) values[name] = [];
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  for (const required of [
    "capsule",
    "ceremony-bundle",
    "evaluated-at-ms",
    "expires-at-ms",
    "observer-max-faulty",
    "observer-roster-size",
    "observer-threshold",
    "output"
  ]) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
  }
  values["revoked-trust-root-id"] ??= [];
  return values;
}

function integer(value, label) {
  if (!/^(0|[1-9][0-9]*)$/u.test(value)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_FORMAT", label);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_LIMIT", label);
  }
  return parsed;
}

function decimal(value, label) {
  if (!/^(0|[1-9][0-9]*)$/u.test(value)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_FORMAT", label);
  }
  return value;
}

async function readBounded(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_LIMIT", label);
  }
  const bytes = await readFile(path);
  if (bytes.byteLength !== metadata.size) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_COLLISION", `${label}-changed-while-reading`);
  }
  return bytes;
}

async function ensureAbsent(path) {
  try {
    await stat(path);
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_OUTPUT_EXISTS", "output");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-membership-request-${process.pid}-${randomBytes(16).toString("hex")}`
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
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_COLLISION", "output");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const capsulePath = resolve(root, values.capsule);
  const outputPath = resolve(root, values.output);
  const priorEpochPath = values["prior-epoch"] === undefined
    ? null
    : resolve(root, values["prior-epoch"]);
  const bundlePaths = values["ceremony-bundle"].map((value) => resolve(root, value));
  const allPaths = [capsulePath, outputPath, ...bundlePaths];
  if (priorEpochPath !== null) allPaths.push(priorEpochPath);
  if (new Set(allPaths).size !== allPaths.length) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const [capsuleBytes, priorEpochBytes, ceremonyBundleBytes] = await Promise.all([
    readBounded(capsulePath, PROTOCOL_PROFILE.provider.object_bytes, "capsule"),
    priorEpochPath === null
      ? Promise.resolve(null)
      : readBounded(
        priorEpochPath,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
        "prior-epoch"
      ),
    Promise.all(bundlePaths.map((path, index) => readBounded(
      path,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `ceremony-bundle-${index}`
    )))
  ]);
  const request = createPlacementMembershipEpochRequest({
    capsule_bytes: capsuleBytes,
    ceremony_bundle_bytes: ceremonyBundleBytes,
    evaluated_at_ms: decimal(values["evaluated-at-ms"], "evaluated-at-ms"),
    expires_at_ms: decimal(values["expires-at-ms"], "expires-at-ms"),
    observer_policy: {
      max_faulty: integer(values["observer-max-faulty"], "observer-max-faulty"),
      roster_size: integer(values["observer-roster-size"], "observer-roster-size"),
      threshold: integer(values["observer-threshold"], "observer-threshold")
    },
    prior_epoch_bytes: priorEpochBytes,
    revoked_trust_root_ids: values["revoked-trust-root-id"]
  });
  await publishNoReplace(outputPath, request.bytes);
  process.stdout.write(`${JSON.stringify({
    custody_threshold: request.custody_threshold,
    epoch_id: request.epoch_id,
    member_count: request.body.admission_evidence_base64url.length,
    output: outputPath,
    private_material_exposed: false,
    request_id: request.request_id,
    status: request.status
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_FAILURE",
    detail: error?.detail ?? null,
    message: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
