#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  attestPlacementAdmissionDeploymentObservation,
  observeAndAttestPlacementAdmissionDeployment,
  PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS
} from "../lab/placement/admission-deployment-attestation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS,
  restorePlacementAdmissionDeploymentObservation
} from "../lab/placement/admission-deployment-observer.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS
} from "../lab/placement/admission-deployment-plan-membership.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/observe-and-attest-placement-admission-deployment.mjs " +
    "--attested-at-ms <integer> --authority <observer-authority.json> " +
    "--capsule <capsule.json> " +
    "--deployment-plan-membership <deployment-plan-membership.json> " +
    "--membership-epoch <epoch.json> [--membership-epoch <epoch.json> ...] " +
    "--observed-at-ms <integer> --observation-journal <observation.json> " +
    "--output <attestation.json> " +
    "[--key-possession-mode <tls-exporter|legacy-identity-only>]";
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
    "attested-at-ms",
    "authority",
    "capsule",
    "deployment-plan-membership",
    "key-possession-mode",
    "membership-epoch",
    "observed-at-ms",
    "observation-journal",
    "output"
  ];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.includes(name) || (name !== "membership-epoch" && Object.hasOwn(values, name))) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
    if (name === "membership-epoch") {
      if (!Object.hasOwn(values, name)) values[name] = [];
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  for (const required of allowed.filter((name) => name !== "key-possession-mode")) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_USAGE", usage());
    }
  }
  return values;
}

function possessionMode(values) {
  const mode = values["key-possession-mode"] ?? "tls-exporter";
  if (mode === "legacy-identity-only") {
    if (
      process.env.MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN !== undefined ||
      process.env.MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN !== undefined
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "legacy-possession-token-environment");
    return mode;
  }
  if (mode !== "tls-exporter") {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "key-possession-mode");
  }
  return mode;
}

function possessionAuthorizations(mode) {
  if (mode === "legacy-identity-only") return null;
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

async function readOptionalBounded(path, maximum, label) {
  try {
    return await readBounded(path, maximum, label);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
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
    `.mortalos-pending-deployment-attestation-${process.pid}-${randomBytes(16).toString("hex")}`
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

async function publishObservationJournalNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-deployment-observation-journal-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    try {
      await link(pending, path);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const readback = await readBounded(
      path,
      PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observation_bytes,
      "observation-journal"
    );
    if (!readback.equals(bytes)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_COLLISION", "observation-journal");
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const mode = possessionMode(values);
  const authorityPath = resolve(root, values.authority);
  const capsulePath = resolve(root, values.capsule);
  const membershipPath = resolve(root, values["deployment-plan-membership"]);
  const membershipEpochPaths = values["membership-epoch"].map((value) => resolve(root, value));
  const observationJournalPath = resolve(root, values["observation-journal"]);
  const outputPath = resolve(root, values.output);
  const paths = [
    authorityPath,
    capsulePath,
    membershipPath,
    observationJournalPath,
    outputPath,
    ...membershipEpochPaths
  ];
  if (new Set(paths).size !== paths.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const observedAt = integer(values["observed-at-ms"], "observed-at-ms");
  const attestedAt = integer(values["attested-at-ms"], "attested-at-ms");
  const journalBytes = await readOptionalBounded(
    observationJournalPath,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observation_bytes,
    "observation-journal"
  );
  let journalObservation = null;
  let authorizations = null;
  if (journalBytes === null) {
    authorizations = possessionAuthorizations(mode);
  } else {
    journalObservation = restorePlacementAdmissionDeploymentObservation(journalBytes);
    if (journalObservation.observed_at_ms !== observedAt) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_COLLISION", "observation-journal-time");
    }
    const expectedPossession = mode === "tls-exporter"
      ? "tls-exporter-role-key-signed"
      : "identity-only-legacy";
    if (journalObservation.key_possession !== expectedPossession) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_COLLISION", "observation-journal-mode");
    }
  }
  const capsuleBytes = await readBounded(
    capsulePath,
    PROTOCOL_PROFILE.provider.object_bytes,
    "capsule"
  );
  const membershipBytes = await readBounded(
    membershipPath,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
    "deployment-plan-membership"
  );
  const membershipEpochCandidateBytes = await Promise.all(
    membershipEpochPaths.map((path, index) => readBounded(
      path,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
      `membership-epoch-${index}`
    ))
  );
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const attestation = journalObservation === null
    ? await observeAndAttestPlacementAdmissionDeployment({
      attested_at_ms: attestedAt,
      capsule_bytes: capsuleBytes,
      deployment_plan_membership_bytes: membershipBytes,
      membership_epoch_candidate_bytes: membershipEpochCandidateBytes,
      observed_at_ms: observedAt,
      observation_journal: Object.freeze({
        publish: (bytes) => publishObservationJournalNoReplace(observationJournalPath, bytes)
      }),
      observer: authority,
      possession_authorizations: authorizations
    })
    : await attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: attestedAt,
      capsule_bytes: capsuleBytes,
      deployment_plan_membership_bytes: membershipBytes,
      membership_epoch_candidate_bytes: membershipEpochCandidateBytes,
      observation_bytes: journalObservation.bytes,
      observer: authority
    });
  if (attestation.bytes.byteLength >
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_LIMIT", "attestation");
  }
  await publishNoReplace(outputPath, attestation.bytes);
  process.stdout.write(`${JSON.stringify({
    attestation_id: attestation.attestation_id,
    deployment_plan_activation_id: attestation.deployment_plan_activation_id,
    deployment_plan_id: attestation.deployment_plan_id,
    deployment_plan_membership_id: attestation.deployment_plan_membership_id,
    membership_candidate_view_id: attestation.membership_candidate_view_id,
    membership_epoch_id: attestation.membership_epoch_id,
    non_authority: true,
    observation_id: attestation.observation_id,
    observation_journal: observationJournalPath,
    observation_source: journalObservation === null ? "live" : "journal",
    observer_key_id: attestation.observer.key_id,
    output: outputPath,
    status: attestation.status
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
