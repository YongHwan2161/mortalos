#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import {
  link,
  open,
  readFile,
  stat,
  unlink
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeBase64Url } from "../src/bytes.mjs";
import {
  observePlacementAdmissionDeployment,
  PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS
} from "../lab/placement/admission-deployment-observer.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/observe-placement-admission-deployment.mjs " +
    "--bundle <ceremony-bundle.json> --observed-at-ms <integer> " +
    "--output <observation.json> [--observer-nonce-base64url <32-byte-base64url>] " +
    "[--key-possession-mode <tls-exporter|legacy-identity-only>] " +
    "[--timeout-ms <1000..60000>]";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (
      ![
        "bundle",
        "key-possession-mode",
        "observed-at-ms",
        "observer-nonce-base64url",
        "output",
        "timeout-ms"
      ].includes(name) ||
      Object.hasOwn(values, name)
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    values[name] = value;
  }
  for (const required of ["bundle", "observed-at-ms", "output"]) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
  }
  return values;
}

function possessionAuthorizations(values) {
  const mode = values["key-possession-mode"] ?? "tls-exporter";
  if (mode === "legacy-identity-only") {
    if (
      process.env.MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN !== undefined ||
      process.env.MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN !== undefined
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "legacy-possession-token-environment");
    return null;
  }
  if (mode !== "tls-exporter") {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "key-possession-mode");
  }
  const issuer = process.env.MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN;
  const subject = process.env.MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN;
  const token = /^[\x21-\x7e]{32,4096}$/u;
  if (
    typeof issuer !== "string" || !token.test(issuer) ||
    typeof subject !== "string" || !token.test(subject) || issuer === subject
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "possession-token-environment");
  return Object.freeze({ issuer, subject });
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
    `.mortalos-pending-deployment-observation-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const bundlePath = resolve(root, values.bundle);
  const outputPath = resolve(root, values.output);
  if (bundlePath === outputPath) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  const observedAt = integer(values["observed-at-ms"], "observed-at-ms");
  const authorizations = possessionAuthorizations(values);
  const timeout = values["timeout-ms"] === undefined
    ? 15_000
    : integer(values["timeout-ms"], "timeout-ms");
  const nonce = values["observer-nonce-base64url"] === undefined
    ? randomBytes(PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes)
    : decodeBase64Url(values["observer-nonce-base64url"]);
  if (
    nonce === null ||
    nonce.byteLength !== PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "observer-nonce");
  await ensureAbsent(outputPath);
  const bundleBytes = await readBounded(bundlePath, 2 * 1024 * 1024, "bundle");
  const observation = await observePlacementAdmissionDeployment({
    ceremony_bundle_bytes: bundleBytes,
    observed_at_ms: observedAt,
    observer_nonce: nonce,
    possession_authorizations: authorizations,
    timeout_ms: timeout
  });
  await publishNoReplace(outputPath, observation.bytes);
  process.stdout.write(`${JSON.stringify({
    facts: observation.facts,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    key_possession: observation.key_possession,
    non_authority: true,
    observation_id: observation.observation_id,
    output: outputPath,
    status: observation.status
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
