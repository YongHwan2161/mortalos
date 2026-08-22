#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { isCanonical, parseJsonBytes } from "../src/codec.mjs";
import {
  createPlacementAdmissionCeremonyChallenge,
  restorePlacementAdmissionCeremonyChallenge
} from "../lab/placement/admission-ceremony-binding.mjs";
import {
  createPlacementAdmissionSigningRequest,
  derivePlacementAdmissionSignerPolicyDigest,
  restorePlacementAdmissionSigningRequest
} from "../lab/placement/admission-signer-session.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

const ARGUMENTS = new Set([
  "--issued-at-ms",
  "--issuer-origin",
  "--output",
  "--policy",
  "--subject-identity",
  "--subject-origin",
  "--trust-root",
  "--valid-from-ms",
  "--valid-until-ms"
]);

function usage() {
  return "usage: node scripts/create-placement-admission-ceremony-request.mjs " +
    "--trust-root <trust-root.json> --subject-identity <subject-public-identity.json> " +
    "--policy <policy.json> --issuer-origin <origin> --subject-origin <origin> " +
    "--issued-at-ms <decimal> --valid-from-ms <decimal> --valid-until-ms <decimal> " +
    "--output <admission-request.json>";
}

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_CEREMONY_CLI";
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!ARGUMENTS.has(name) || value === undefined || values[name] !== undefined) {
      fail(usage());
    }
    values[name] = value;
  }
  for (const required of ARGUMENTS) {
    if (values[required] === undefined) fail(usage());
  }
  return values;
}

async function readCanonicalFile(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail(`${label} file is outside its bounded size`);
  }
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== metadata.size) fail(`${label} file changed while reading`);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail(`${label} file is not valid bounded JSON`);
  }
  if (!isCanonical(bytes, value)) fail(`${label} file must be canonical JSON`);
  return value;
}

async function ensureAbsent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  fail("output path already exists");
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-request-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await link(pending, path);
    const readback = new Uint8Array(await readFile(path));
    if (!equalBytes(readback, bytes)) fail("published request readback mismatch");
  } finally {
    if (handle !== null && handle !== undefined) await handle.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const outputPath = resolve(root, values["--output"]);
  const policyPath = resolve(root, values["--policy"]);
  const subjectIdentityPath = resolve(root, values["--subject-identity"]);
  const trustRootPath = resolve(root, values["--trust-root"]);
  if (new Set([outputPath, policyPath, subjectIdentityPath, trustRootPath]).size !== 4) {
    fail("input and output paths must be distinct");
  }
  await ensureAbsent(outputPath);
  const [policy, subjectIdentity, trustRoot] = await Promise.all([
    readCanonicalFile(policyPath, 4096, "policy"),
    readCanonicalFile(subjectIdentityPath, 4096, "subject-identity"),
    readCanonicalFile(trustRootPath, 65_536, "trust-root")
  ]);
  const policyDigest = derivePlacementAdmissionSignerPolicyDigest(policy);
  if (trustRoot.policy_digest !== policyDigest) fail("trust root does not bind the supplied policy");
  const challengeBytes = createPlacementAdmissionCeremonyChallenge({
    issuer_identity: trustRoot.issuer,
    issuer_origin: values["--issuer-origin"],
    nonce: new Uint8Array(randomBytes(32)),
    subject_identity: subjectIdentity,
    subject_origin: values["--subject-origin"]
  });
  const requestBytes = createPlacementAdmissionSigningRequest({
    body: {
      attestation_challenge_base64url: encodeBase64Url(challengeBytes),
      attestation_kind: policy.attestation_kind,
      failure_domain_id: policy.failure_domain_id,
      issued_at_ms: values["--issued-at-ms"],
      operator_root_id: policy.operator_root_id,
      roles: policy.roles,
      subject: subjectIdentity,
      valid_from_ms: values["--valid-from-ms"],
      valid_until_ms: values["--valid-until-ms"]
    },
    trust_root: trustRoot
  });
  const request = restorePlacementAdmissionSigningRequest(requestBytes);
  const challenge = restorePlacementAdmissionCeremonyChallenge(challengeBytes);
  await publishNoReplace(outputPath, requestBytes);
  process.stdout.write(`${JSON.stringify({
    endpoint_binding_digest: challenge.endpoint_binding_digest,
    evidence_id: request.evidence_id,
    issuer_key_id: trustRoot.issuer.key_id,
    nonce_generated_locally: true,
    output: outputPath,
    private_material_required: false,
    status: "placement-admission-ceremony-request-created",
    subject_key_id: subjectIdentity.key_id,
    trust_root_id: trustRoot.trust_root_id
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_CEREMONY_CLI",
    detail: error?.detail ?? error?.message ?? "request creation failed"
  })}\n`);
  process.exitCode = 1;
});
