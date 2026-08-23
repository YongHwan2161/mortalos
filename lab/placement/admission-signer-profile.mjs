import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { byteLengthOfBytes, equalBytes, isSharedByteView } from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  freeze,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import { normalizePlacementAdmissionCeremonyEndpointOrigin } from "./admission-ceremony-binding.mjs";

const FORMAT = "mortalos-placement-admission-signer-profile/1";
const PROFILE_DOMAIN = "MortalOS placement admission signer profile v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const ROLES = freeze(["issuer", "subject"]);
const UINT8_ARRAY = Uint8Array;
const PROFILE_BYTES_MAX = 16_384;

export const PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT = FORMAT;
export const PLACEMENT_ADMISSION_SIGNER_PROFILE_LIMITS = freeze({
  profile_bytes: PROFILE_BYTES_MAX
});

export class PlacementAdmissionSignerProfileError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionSignerProfileError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionSignerProfileError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function normalizedRole(value) {
  if (value !== ROLES[0] && value !== ROLES[1]) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-role");
  }
  return value;
}

function ownedBytes(value, label) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > PROFILE_BYTES_MAX || isSharedByteView(value)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_LIMIT", label);
  }
  return new UINT8_ARRAY(value);
}

function profileContent(source) {
  const value = exactRecord(source, [
    "endpoint_origin",
    "identity_key_id",
    "policy_digest",
    "role",
    "trust_root_id"
  ], "signer-profile-content");
  if (
    !regexpTest(KEY_ID, value.identity_key_id) ||
    !regexpTest(DIGEST, value.policy_digest) ||
    !regexpTest(DIGEST, value.trust_root_id)
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-identity");
  return freeze({
    endpoint_origin: normalizePlacementAdmissionCeremonyEndpointOrigin(
      value.endpoint_origin,
      "profile-endpoint"
    ),
    identity_key_id: value.identity_key_id,
    policy_digest: value.policy_digest,
    role: normalizedRole(value.role),
    trust_root_id: value.trust_root_id
  });
}

export function createPlacementAdmissionSignerProfile(options) {
  requireRealm();
  const content = profileContent(options);
  const profileId = domainHash(PROFILE_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({
    ...content,
    format: FORMAT,
    profile_id: profileId
  });
  if (bytes.byteLength > PROFILE_BYTES_MAX) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_LIMIT", "profile-bytes");
  }
  return freeze({ bytes, profile_id: profileId, profile: freeze({
    ...content,
    format: FORMAT,
    profile_id: profileId
  }) });
}

export function restorePlacementAdmissionSignerProfile(source) {
  requireRealm();
  const bytes = ownedBytes(source, "profile-bytes");
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: PROFILE_BYTES_MAX, maxDepth: 8 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-json");
  }
  if (!isCanonical(bytes, parsed)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-canonical");
  }
  const value = exactRecord(parsed, [
    "endpoint_origin",
    "format",
    "identity_key_id",
    "policy_digest",
    "profile_id",
    "role",
    "trust_root_id"
  ], "signer-profile");
  if (value.format !== FORMAT || !regexpTest(DIGEST, value.profile_id)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-envelope");
  }
  const content = profileContent({
    endpoint_origin: value.endpoint_origin,
    identity_key_id: value.identity_key_id,
    policy_digest: value.policy_digest,
    role: value.role,
    trust_root_id: value.trust_root_id
  });
  const expectedId = domainHash(PROFILE_DOMAIN, canonicalBytes(content));
  if (value.profile_id !== expectedId) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-id");
  }
  return freeze({
    bytes,
    profile: freeze({ ...content, format: FORMAT, profile_id: expectedId }),
    profile_id: expectedId
  });
}

async function readExisting(path) {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > PROFILE_BYTES_MAX) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-state-file");
  }
  const bytes = new UINT8_ARRAY(await readFile(path));
  if (bytes.byteLength !== metadata.size) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-state-race");
  }
  return restorePlacementAdmissionSignerProfile(bytes);
}

export async function lockPlacementAdmissionSignerProfile(options) {
  requireRealm();
  const value = exactRecord(options, ["path", "profile_bytes"], "signer-profile-lock-options");
  if (typeof value.path !== "string" || value.path.length < 1) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_FORMAT", "profile-state-path");
  }
  const path = resolve(value.path);
  const expected = restorePlacementAdmissionSignerProfile(value.profile_bytes);
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-profile-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  const existing = await readExisting(path);
  requireRealm();
  if (existing !== null) {
    if (!equalBytes(existing.bytes, expected.bytes)) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CONFLICT", "profile-state-conflict");
    }
    return freeze({ bytes: existing.bytes, path, profile_id: existing.profile_id, status: "restored" });
  }
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(expected.bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    try {
      await link(pending, path);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const installed = await readExisting(path);
    requireRealm();
    if (installed === null || !equalBytes(installed.bytes, expected.bytes)) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CONFLICT", "profile-state-conflict");
    }
    return freeze({
      bytes: installed.bytes,
      path,
      profile_id: installed.profile_id,
      status: "locked"
    });
  } finally {
    if (handle !== null && handle !== undefined) await handle.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}
