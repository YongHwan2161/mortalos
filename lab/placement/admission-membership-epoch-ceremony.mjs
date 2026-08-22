import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { verifyEd25519 } from "../../src/crypto.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  finalizePlacementMembershipEpoch,
  PLACEMENT_ADMISSION_LIMITS,
  preparePlacementMembershipEpoch,
  verifyPlacementMembershipEpoch
} from "../../src/placement/admission.mjs";
import {
  arraySort,
  copyOwnDataArray,
  createMap,
  freeze,
  mapGet,
  mapHas,
  mapSet,
  mapValues,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import { restorePlacementAdmissionCeremonyBundle } from "./admission-ceremony-client.mjs";

const REQUEST_FORMAT = "mortalos-placement-membership-epoch-request/1";
const APPROVAL_FORMAT = "mortalos-placement-membership-epoch-approval/1";
const REQUEST_ID_DOMAIN = "MortalOS placement membership epoch request v1";
const APPROVAL_ID_DOMAIN = "MortalOS placement membership epoch approval v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMATS = freeze({
  approval: APPROVAL_FORMAT,
  request: REQUEST_FORMAT
});

export const PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS = freeze({
  approval_bytes: 16 * 1024,
  ceremony_bundle_bytes: PLACEMENT_ADMISSION_LIMITS.document_bytes,
  ceremony_bundles_max: PLACEMENT_ADMISSION_LIMITS.admission_evidence_per_epoch_max,
  request_bytes: PLACEMENT_ADMISSION_LIMITS.document_bytes
});

export class PlacementMembershipEpochCeremonyError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementMembershipEpochCeremonyError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementMembershipEpochCeremonyError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function sameCanonical(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

function copiedArray(source, maximum, label) {
  let copied;
  try {
    copied = copyOwnDataArray(source, label);
  } catch {
    requireRealm();
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", label);
  }
  requireRealm();
  if (copied.length < 1 || copied.length > maximum) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMIT", label);
  }
  return copied;
}

function requestParameters(body) {
  const value = exactRecord(body, [
    "admission_evidence_base64url",
    "epoch",
    "evaluated_at_ms",
    "expires_at_ms",
    "lineage_authority",
    "lineage_capsule_id",
    "lineage_custody_hash",
    "lineage_head_hash",
    "lineage_organism_id",
    "observer_policy",
    "prior_epoch_id",
    "retired_trust_root_authority_ids",
    "revoked_trust_root_ids",
    "trust_root_history",
    "trust_roots"
  ], "membership-request-body");
  return freeze({
    admission_evidence: value.admission_evidence_base64url,
    evaluated_at_ms: value.evaluated_at_ms,
    expires_at_ms: value.expires_at_ms,
    observer_policy: value.observer_policy,
    revoked_trust_root_ids: value.revoked_trust_root_ids,
    trust_roots: value.trust_roots
  });
}

function requestContent(prepared) {
  return freeze({
    body: prepared.body,
    custody_approval_message_base64url: encodeBase64Url(
      prepared.custody_approval_message
    ),
    custody_approval_tuple: prepared.custody_approval_tuple,
    epoch_id: prepared.epoch_id,
    format: REQUEST_FORMAT
  });
}

function requestProjection(bytes, content, requestId) {
  const authority = content.body.lineage_authority;
  return freeze({
    body: content.body,
    bytes: new UINT8_ARRAY(bytes),
    custody_approval_message: decodeBase64Url(
      content.custody_approval_message_base64url
    ),
    custody_approval_tuple: content.custody_approval_tuple,
    custody_threshold: authority.quorum.threshold,
    custodian_key_ids: freeze(authority.custodians.map((entry) => entry.key_id)),
    epoch_id: content.epoch_id,
    request_id: requestId,
    status: "membership-epoch-request-verified"
  });
}

function createRequestFromPrepared(prepared) {
  const content = requestContent(prepared);
  const requestId = domainHash(REQUEST_ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ request_id: requestId, ...content });
  if (bytes.byteLength > PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMIT", "membership-request-bytes");
  }
  return requestProjection(bytes, content, requestId);
}

export function createPlacementMembershipEpochRequest(options) {
  requireRealm();
  const value = exactRecord(options, [
    "capsule_bytes",
    "ceremony_bundle_bytes",
    "evaluated_at_ms",
    "expires_at_ms",
    "observer_policy",
    "prior_epoch_bytes",
    "revoked_trust_root_ids"
  ], "membership-request-options");
  const bundleSources = copiedArray(
    value.ceremony_bundle_bytes,
    PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundles_max,
    "membership-request-ceremony-bundles"
  );
  const evidence = [];
  const rootsById = createMap();
  for (let index = 0; index < bundleSources.length; index += 1) {
    const bundle = restorePlacementAdmissionCeremonyBundle(ownedBytes(
      bundleSources[index],
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `membership-request-ceremony-bundle-${index}`
    ));
    evidence.push(bundle.evidence_bytes);
    const prior = mapGet(rootsById, bundle.trust_root.trust_root_id);
    if (prior && !sameCanonical(prior, bundle.trust_root)) {
      fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_BINDING", "trust-root-id-collision");
    }
    if (!mapHas(rootsById, bundle.trust_root.trust_root_id)) {
      mapSet(rootsById, bundle.trust_root.trust_root_id, bundle.trust_root);
    }
  }
  const trustRoots = [...mapValues(rootsById)];
  arraySort(trustRoots, (left, right) =>
    left.trust_root_id < right.trust_root_id ? -1 : left.trust_root_id > right.trust_root_id ? 1 : 0);
  const prepared = preparePlacementMembershipEpoch({
    capsule_bytes: value.capsule_bytes,
    parameters: {
      admission_evidence: evidence,
      evaluated_at_ms: value.evaluated_at_ms,
      expires_at_ms: value.expires_at_ms,
      observer_policy: value.observer_policy,
      revoked_trust_root_ids: value.revoked_trust_root_ids,
      trust_roots: trustRoots
    },
    prior_epoch_bytes: value.prior_epoch_bytes
  });
  return createRequestFromPrepared(prepared);
}

export function restorePlacementMembershipEpochRequest(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "prior_epoch_bytes",
    "request_bytes"
  ], "membership-request-restore-options");
  const parsed = parseCanonical(
    source.request_bytes,
    PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
    "membership-request"
  );
  const value = exactRecord(parsed.value, [
    "body",
    "custody_approval_message_base64url",
    "custody_approval_tuple",
    "epoch_id",
    "format",
    "request_id"
  ], "membership-request");
  if (
    value.format !== REQUEST_FORMAT ||
    typeof value.epoch_id !== "string" || !regexpTest(DIGEST, value.epoch_id) ||
    typeof value.request_id !== "string" || !regexpTest(DIGEST, value.request_id) ||
    typeof value.custody_approval_tuple !== "string"
  ) fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", "membership-request-envelope");
  const message = typeof value.custody_approval_message_base64url === "string"
    ? decodeBase64Url(value.custody_approval_message_base64url)
    : null;
  if (message === null) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", "membership-request-message");
  }
  const prepared = preparePlacementMembershipEpoch({
    capsule_bytes: source.capsule_bytes,
    parameters: requestParameters(value.body),
    prior_epoch_bytes: source.prior_epoch_bytes
  });
  const content = requestContent(prepared);
  const requestId = domainHash(REQUEST_ID_DOMAIN, canonicalBytes(content));
  if (
    requestId !== value.request_id ||
    !sameCanonical(content, {
      body: value.body,
      custody_approval_message_base64url: value.custody_approval_message_base64url,
      custody_approval_tuple: value.custody_approval_tuple,
      epoch_id: value.epoch_id,
      format: value.format
    }) ||
    !equalBytes(message, prepared.custody_approval_message)
  ) fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_BINDING", "membership-request");
  return requestProjection(parsed.bytes, content, requestId);
}

function normalizedApproval(source, request, label) {
  const value = exactRecord(source, ["key_id", "signature"], label);
  if (
    typeof value.key_id !== "string" || !regexpTest(KEY_ID, value.key_id) ||
    typeof value.signature !== "string"
  ) fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_FORMAT", label);
  let custodian = null;
  for (const candidate of request.body.lineage_authority.custodians) {
    if (candidate.key_id === value.key_id) custodian = candidate;
  }
  if (!custodian) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_AUTHORITY", "approval-not-current-custodian");
  }
  if (!verifyEd25519(custodian.public_key, request.custody_approval_message, value.signature)) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_SIGNATURE", label);
  }
  return freeze({ key_id: value.key_id, signature: value.signature });
}

function approvalContent(approval, request) {
  return freeze({
    approval,
    epoch_id: request.epoch_id,
    format: APPROVAL_FORMAT,
    request_id: request.request_id
  });
}

function approvalProjection(bytes, content, approvalId) {
  return freeze({
    approval: content.approval,
    approval_id: approvalId,
    bytes: new UINT8_ARRAY(bytes),
    epoch_id: content.epoch_id,
    request_id: content.request_id,
    status: "membership-epoch-approval-verified"
  });
}

export function createPlacementMembershipEpochApproval(options) {
  requireRealm();
  const source = exactRecord(options, [
    "approval",
    "capsule_bytes",
    "prior_epoch_bytes",
    "request_bytes"
  ], "membership-approval-options");
  const request = restorePlacementMembershipEpochRequest({
    capsule_bytes: source.capsule_bytes,
    prior_epoch_bytes: source.prior_epoch_bytes,
    request_bytes: source.request_bytes
  });
  const approval = normalizedApproval(source.approval, request, "membership-approval");
  const content = approvalContent(approval, request);
  const approvalId = domainHash(APPROVAL_ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ approval_id: approvalId, ...content });
  if (bytes.byteLength > PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.approval_bytes) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMIT", "membership-approval-bytes");
  }
  return approvalProjection(bytes, content, approvalId);
}

export function restorePlacementMembershipEpochApproval(options) {
  requireRealm();
  const source = exactRecord(options, [
    "approval_bytes",
    "capsule_bytes",
    "prior_epoch_bytes",
    "request_bytes"
  ], "membership-approval-restore-options");
  const request = restorePlacementMembershipEpochRequest({
    capsule_bytes: source.capsule_bytes,
    prior_epoch_bytes: source.prior_epoch_bytes,
    request_bytes: source.request_bytes
  });
  const parsed = parseCanonical(
    source.approval_bytes,
    PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.approval_bytes,
    "membership-approval"
  );
  const value = exactRecord(parsed.value, [
    "approval",
    "approval_id",
    "epoch_id",
    "format",
    "request_id"
  ], "membership-approval");
  if (
    value.format !== APPROVAL_FORMAT ||
    value.epoch_id !== request.epoch_id ||
    value.request_id !== request.request_id ||
    typeof value.approval_id !== "string" || !regexpTest(DIGEST, value.approval_id)
  ) fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_BINDING", "membership-approval-envelope");
  const approval = normalizedApproval(value.approval, request, "membership-approval");
  const content = approvalContent(approval, request);
  const approvalId = domainHash(APPROVAL_ID_DOMAIN, canonicalBytes(content));
  if (approvalId !== value.approval_id) {
    fail("E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_BINDING", "membership-approval-id");
  }
  return approvalProjection(parsed.bytes, content, approvalId);
}

export function finalizePlacementMembershipEpochRequest(options) {
  requireRealm();
  const source = exactRecord(options, [
    "approval_bytes",
    "capsule_bytes",
    "prior_epoch_bytes",
    "request_bytes"
  ], "membership-request-finalize-options");
  const request = restorePlacementMembershipEpochRequest({
    capsule_bytes: source.capsule_bytes,
    prior_epoch_bytes: source.prior_epoch_bytes,
    request_bytes: source.request_bytes
  });
  const approvalSources = copiedArray(
    source.approval_bytes,
    request.custodian_key_ids.length,
    "membership-request-approvals"
  );
  const approvals = approvalSources.map((approvalBytes) =>
    restorePlacementMembershipEpochApproval({
      approval_bytes: approvalBytes,
      capsule_bytes: source.capsule_bytes,
      prior_epoch_bytes: source.prior_epoch_bytes,
      request_bytes: request.bytes
    }).approval);
  arraySort(approvals, (left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const bytes = finalizePlacementMembershipEpoch({
    approvals,
    body: request.body,
    capsule_bytes: source.capsule_bytes,
    prior_epoch_bytes: source.prior_epoch_bytes
  });
  const verified = verifyPlacementMembershipEpoch({
    capsule_bytes: source.capsule_bytes,
    epoch_bytes: bytes,
    prior_epoch_bytes: source.prior_epoch_bytes
  });
  return freeze({
    approval_count: approvals.length,
    bytes: new UINT8_ARRAY(bytes),
    epoch_id: verified.epoch_id,
    member_count: verified.members.length,
    request_id: request.request_id,
    status: "membership-epoch-finalized"
  });
}
