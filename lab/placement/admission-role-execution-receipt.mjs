import { sha256 } from "@noble/hashes/sha2.js";
import {
  byteLengthOfBytes,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { derivePeerId, verifyEd25519 } from "../../src/crypto.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  freeze,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotDataMethod,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";

const FORMAT = "mortalos-placement-admission-role-execution-receipt/1";
const ID_DOMAIN = "MortalOS placement admission role execution receipt v1";
const SIGNING_DOMAIN =
  "MortalOS placement admission role execution receipt signature v1";
const ARTIFACT_KINDS = freeze([
  "ceremony-role-response",
  "deployment-observation-attestation",
  "deployment-plan-acceptance",
  "membership-epoch-approval"
]);
const ROLES = freeze(["custodian", "issuer", "observer", "subject"]);
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const SIGNATURE = /^ed25519:[A-Za-z0-9_-]{86}$/u;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS = freeze({
  artifact_bytes: 16 * 1024 * 1024,
  receipt_bytes: 4 * 1024
});

export class PlacementAdmissionRoleExecutionReceiptError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionRoleExecutionReceiptError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionRoleExecutionReceiptError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedEnum(value, allowed, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", label);
  }
  for (let index = 0; index < allowed.length; index += 1) {
    if (allowed[index] === value) return value;
  }
  fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", label);
}

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", label);
  }
  return value;
}

function normalizedCommit(value, label) {
  if (typeof value !== "string" || !regexpTest(COMMIT, value)) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", label);
  }
  return value;
}

function normalizedIdentity(source, label) {
  const value = exactRecord(source, ["key_id", "public_key"], label);
  if (
    typeof value.key_id !== "string" ||
    !regexpTest(KEY_ID, value.key_id) ||
    typeof value.public_key !== "string" ||
    derivePeerId(value.public_key) !== value.key_id
  ) fail("E_PLACEMENT_ADMISSION_EXECUTION_IDENTITY", label);
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function snapshotSigner(source) {
  let identitySource;
  let sign;
  try {
    [identitySource] = snapshotNamedOwnDataValues(
      source,
      ["custodian"],
      "role-execution-signer"
    );
    sign = snapshotDataMethod(source, "sign", "role-execution-signer");
  } catch {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_IDENTITY", "role-execution-signer");
  }
  return freeze({
    identity: normalizedIdentity(identitySource, "role-execution-signer-identity"),
    sign
  });
}

function artifactDigest(bytes) {
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

function content({ artifactDigestValue, artifactId, artifactKind, role, signer, sourceCommit }) {
  return freeze({
    artifact_digest: artifactDigestValue,
    artifact_id: artifactId,
    artifact_kind: artifactKind,
    checkout_state: "clean",
    format: FORMAT,
    non_authority: true,
    role,
    signer,
    source_commit: sourceCommit
  });
}

function signatureMessage(receiptId) {
  return canonicalBytes({
    format: FORMAT,
    receipt_id: receiptId,
    signature_domain: SIGNING_DOMAIN
  });
}

function project(bytes, value, receiptId, signature, verified) {
  return freeze({
    artifact_digest: value.artifact_digest,
    artifact_id: value.artifact_id,
    artifact_kind: value.artifact_kind,
    bytes: new UINT8_ARRAY(bytes),
    checkout_state: "clean",
    non_authority: true,
    receipt_id: receiptId,
    role: value.role,
    signature,
    signature_verified: verified,
    signer: value.signer,
    source_commit: value.source_commit,
    status: verified
      ? "role-execution-receipt-verified"
      : "role-execution-receipt-restored"
  });
}

export async function createPlacementAdmissionRoleExecutionReceipt(options) {
  requireRealm();
  const source = exactRecord(options, [
    "artifact_bytes",
    "artifact_id",
    "artifact_kind",
    "role",
    "signer",
    "source_commit"
  ], "role-execution-receipt-options");
  const artifactBytes = ownedBytes(
    source.artifact_bytes,
    PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.artifact_bytes,
    "role-execution-artifact"
  );
  const signer = snapshotSigner(source.signer);
  const receiptContent = content({
    artifactDigestValue: artifactDigest(artifactBytes),
    artifactId: normalizedDigest(source.artifact_id, "role-execution-artifact-id"),
    artifactKind: normalizedEnum(
      source.artifact_kind,
      ARTIFACT_KINDS,
      "role-execution-artifact-kind"
    ),
    role: normalizedEnum(source.role, ROLES, "role-execution-role"),
    signer: signer.identity,
    sourceCommit: normalizedCommit(source.source_commit, "role-execution-source-commit")
  });
  const receiptId = domainHash(ID_DOMAIN, canonicalBytes(receiptContent));
  const message = signatureMessage(receiptId);
  const result = await signer.sign(freeze({
    message: new UINT8_ARRAY(message),
    tuple: `placement.admission.execution.${receiptContent.artifact_kind}.` +
      receiptContent.artifact_id.slice("sha256:".length)
  }));
  requireRealm();
  const signed = exactRecord(
    result,
    ["key_id", "signature"],
    "role-execution-signature-result"
  );
  if (
    signed.key_id !== signer.identity.key_id ||
    typeof signed.signature !== "string" ||
    !regexpTest(SIGNATURE, signed.signature) ||
    !verifyEd25519(signer.identity.public_key, message, signed.signature)
  ) fail("E_PLACEMENT_ADMISSION_EXECUTION_IDENTITY", "role-execution-signature-result");
  const bytes = canonicalBytes({
    receipt_id: receiptId,
    ...receiptContent,
    signature: signed.signature
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes) {
    fail("E_PLACEMENT_ADMISSION_EXECUTION_LIMIT", "role-execution-receipt");
  }
  return project(bytes, receiptContent, receiptId, signed.signature, true);
}

export function restorePlacementAdmissionRoleExecutionReceipt(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes,
    "role-execution-receipt"
  );
  const value = exactRecord(parsed.value, [
    "artifact_digest",
    "artifact_id",
    "artifact_kind",
    "checkout_state",
    "format",
    "non_authority",
    "receipt_id",
    "role",
    "signature",
    "signer",
    "source_commit"
  ], "role-execution-receipt");
  if (
    value.format !== FORMAT ||
    value.checkout_state !== "clean" ||
    value.non_authority !== true ||
    typeof value.signature !== "string" ||
    !regexpTest(SIGNATURE, value.signature)
  ) fail("E_PLACEMENT_ADMISSION_EXECUTION_FORMAT", "role-execution-receipt-envelope");
  const receiptContent = content({
    artifactDigestValue: normalizedDigest(
      value.artifact_digest,
      "role-execution-artifact-digest"
    ),
    artifactId: normalizedDigest(value.artifact_id, "role-execution-artifact-id"),
    artifactKind: normalizedEnum(
      value.artifact_kind,
      ARTIFACT_KINDS,
      "role-execution-artifact-kind"
    ),
    role: normalizedEnum(value.role, ROLES, "role-execution-role"),
    signer: normalizedIdentity(value.signer, "role-execution-signer"),
    sourceCommit: normalizedCommit(value.source_commit, "role-execution-source-commit")
  });
  const receiptId = domainHash(ID_DOMAIN, canonicalBytes(receiptContent));
  const message = signatureMessage(receiptId);
  if (
    value.receipt_id !== receiptId ||
    !verifyEd25519(receiptContent.signer.public_key, message, value.signature) ||
    !equalBytes(
      parsed.bytes,
      canonicalBytes({ receipt_id: receiptId, ...receiptContent, signature: value.signature })
    )
  ) fail("E_PLACEMENT_ADMISSION_EXECUTION_BINDING", "role-execution-receipt");
  return project(parsed.bytes, receiptContent, receiptId, value.signature, true);
}
