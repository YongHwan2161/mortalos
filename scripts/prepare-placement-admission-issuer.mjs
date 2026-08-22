#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { equalBytes } from "../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../src/codec.mjs";
import { createPlacementAdmissionTrustRoot } from "../src/placement/admission.mjs";
import { derivePlacementAdmissionSignerPolicyDigest } from
  "../lab/placement/admission-signer-session.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/prepare-placement-admission-issuer.mjs " +
    "--authority <issuer-authority.json> --policy <policy.json> " +
    "--root-config <root-config.json> --output <trust-root.json>";
}

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_SIGNER_CLI";
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set(["--authority", "--output", "--policy", "--root-config"]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name) || value === undefined || values[name] !== undefined) {
      fail(usage());
    }
    values[name] = value;
  }
  for (const required of allowed) {
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
    await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  fail("output path already exists");
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-issuer-${process.pid}-${randomBytes(16).toString("hex")}`
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
    if (!equalBytes(readback, bytes)) {
      fail("published trust root readback mismatch");
    }
  } finally {
    if (handle !== null && handle !== undefined) await handle.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const authorityPath = resolve(root, values["--authority"]);
  const outputPath = resolve(root, values["--output"]);
  const policyPath = resolve(root, values["--policy"]);
  const rootConfigPath = resolve(root, values["--root-config"]);
  if (new Set([authorityPath, outputPath, policyPath, rootConfigPath]).size !== 4) {
    fail("input and output paths must be distinct");
  }
  await ensureAbsent(outputPath);
  const [policy, rootConfig] = await Promise.all([
    readCanonicalFile(policyPath, 4096, "policy"),
    readCanonicalFile(rootConfigPath, 65_536, "root-config")
  ]);
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const trustRoot = createPlacementAdmissionTrustRoot({
    ...rootConfig,
    issuer: authority.custodian,
    policy_digest: derivePlacementAdmissionSignerPolicyDigest(policy)
  });
  const bytes = canonicalBytes(trustRoot);
  await publishNoReplace(outputPath, bytes);
  process.stdout.write(`${JSON.stringify({
    issuer_key_id: authority.custodian.key_id,
    output: outputPath,
    policy_digest: trustRoot.policy_digest,
    private_material_exposed: false,
    status: "placement-admission-issuer-trust-root-prepared",
    trust_root_id: trustRoot.trust_root_id
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_SIGNER_CLI",
    detail: error?.message ?? String(error)
  })}\n`);
  process.exitCode = 1;
});
