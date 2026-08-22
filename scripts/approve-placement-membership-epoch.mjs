#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { link, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  createPlacementMembershipEpochApproval,
  PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS,
  restorePlacementMembershipEpochRequest
} from "../lab/placement/admission-membership-epoch-ceremony.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");

function usage() {
  return "usage: node scripts/approve-placement-membership-epoch.mjs " +
    "--authority <existing-custodian-authority.json> --capsule <capsule.json> " +
    "--request <request.json> [--prior-epoch <epoch.json>] " +
    "--output <approval.json>";
}

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  const allowed = new Set(["authority", "capsule", "output", "prior-epoch", "request"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (typeof key !== "string" || !key.startsWith("--") || value === undefined) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
    const name = key.slice(2);
    if (!allowed.has(name) || Object.hasOwn(values, name)) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
    values[name] = value;
  }
  for (const required of ["authority", "capsule", "output", "request"]) {
    if (!Object.hasOwn(values, required)) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_USAGE", usage());
    }
  }
  return values;
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
    `.mortalos-pending-membership-approval-${process.pid}-${randomBytes(16).toString("hex")}`
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
  const authorityPath = resolve(root, values.authority);
  const capsulePath = resolve(root, values.capsule);
  const outputPath = resolve(root, values.output);
  const requestPath = resolve(root, values.request);
  const priorEpochPath = values["prior-epoch"] === undefined
    ? null
    : resolve(root, values["prior-epoch"]);
  const allPaths = [authorityPath, capsulePath, outputPath, requestPath];
  if (priorEpochPath !== null) allPaths.push(priorEpochPath);
  if (new Set(allPaths).size !== allPaths.length) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_FORMAT", "path-alias");
  }
  await ensureAbsent(outputPath);
  const [capsuleBytes, priorEpochBytes, requestBytes] = await Promise.all([
    readBounded(capsulePath, PROTOCOL_PROFILE.provider.object_bytes, "capsule"),
    priorEpochPath === null
      ? Promise.resolve(null)
      : readBounded(
        priorEpochPath,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
        "prior-epoch"
      ),
    readBounded(
      requestPath,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
      "request"
    )
  ]);
  const request = restorePlacementMembershipEpochRequest({
    capsule_bytes: capsuleBytes,
    prior_epoch_bytes: priorEpochBytes,
    request_bytes: requestBytes
  });
  const authority = await loadNodeAuthority(authorityPath, { create: false });
  if (!request.custodian_key_ids.includes(authority.custodian.key_id)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_AUTHORITY", "not-current-custodian");
  }
  const signature = await authority.sign({
    message: request.custody_approval_message,
    tuple: request.custody_approval_tuple
  });
  const approval = createPlacementMembershipEpochApproval({
    approval: signature,
    capsule_bytes: capsuleBytes,
    prior_epoch_bytes: priorEpochBytes,
    request_bytes: request.bytes
  });
  await publishNoReplace(outputPath, approval.bytes);
  process.stdout.write(`${JSON.stringify({
    approval_id: approval.approval_id,
    custodian_key_id: approval.approval.key_id,
    epoch_id: approval.epoch_id,
    output: outputPath,
    private_material_exposed: false,
    request_id: approval.request_id,
    status: approval.status
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
