import { sha256 } from "@noble/hashes/sha2.js";
import {
  byteLengthOfBytes,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import { PROTOCOL_PROFILE } from "../../src/generated/protocol-profile.mjs";
import {
  arraySort,
  copyOwnDataArray,
  createSet,
  freeze,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  setAdd,
  setSize,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  restorePlacementAdmissionCeremonyRoleResponse
} from "./admission-ceremony-client.mjs";
import {
  restorePlacementAdmissionDeploymentAttestation
} from "./admission-deployment-attestation.mjs";
import {
  restorePlacementAdmissionDeploymentPlanAcceptance
} from "./admission-deployment-plan-activation.mjs";
import {
  restorePlacementMembershipEpochApproval,
  restorePlacementMembershipEpochRequest
} from "./admission-membership-epoch-ceremony.mjs";
import {
  verifyPlacementAdmissionPilotEvidence
} from "./admission-pilot-evidence.mjs";
import {
  PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS,
  restorePlacementAdmissionRoleExecutionReceipt
} from "./admission-role-execution-receipt.mjs";

const FORMAT = "mortalos-placement-admission-pilot-source-attestation/1";
const ID_DOMAIN = "MortalOS placement admission pilot source attestation v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const ARTIFACT_KINDS = freeze([
  "ceremony-role-response",
  "deployment-observation-attestation",
  "deployment-plan-acceptance",
  "membership-epoch-approval"
]);
const ROLES = freeze(["custodian", "issuer", "observer", "subject"]);
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS = freeze({
  evidence_bytes: 128 * 1024,
  receipts_max:
    (PROTOCOL_PROFILE.placement_admission.members_per_epoch_max ** 2 * 2) +
    (PROTOCOL_PROFILE.placement_admission.members_per_epoch_max ** 2) +
    (PROTOCOL_PROFILE.placement_admission.members_per_epoch_max * 2)
});

export class PlacementAdmissionPilotSourceAttestationError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionPilotSourceAttestationError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionPilotSourceAttestationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function copiedArray(source, minimum, maximum, label) {
  let values;
  try {
    values = copyOwnDataArray(source, label);
  } catch {
    requireRealm();
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
  }
  requireRealm();
  if (values.length < minimum || values.length > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_LIMIT", label);
  }
  return values;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 32 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
  }
  return value;
}

function normalizedKeyId(value, label) {
  if (typeof value !== "string" || !regexpTest(KEY_ID, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
  }
  return value;
}

function normalizedCommit(value, label) {
  if (typeof value !== "string" || !regexpTest(COMMIT, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
  }
  return value;
}

function normalizedEnum(value, allowed, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
  }
  for (let index = 0; index < allowed.length; index += 1) {
    if (allowed[index] === value) return value;
  }
  fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", label);
}

function artifactDigest(bytes) {
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

function expectedArtifact(bytes, artifactId, artifactKind, role, signer) {
  return freeze({
    artifact_digest: artifactDigest(bytes),
    artifact_id: artifactId,
    artifact_kind: artifactKind,
    role,
    signer
  });
}

function expectedKey(value) {
  return `${value.artifact_kind}:${value.artifact_id}`;
}

function expectedArtifacts(ceremonyRecords, epochRecords, deployment, capsuleBytes) {
  const result = [];
  const ceremonies = copiedArray(
    ceremonyRecords,
    1,
    PROTOCOL_PROFILE.placement_admission.members_per_epoch_max ** 2,
    "pilot-source-ceremony-records"
  );
  for (let index = 0; index < ceremonies.length; index += 1) {
    const record = exactRecord(ceremonies[index], [
      "bundle_bytes",
      "issuer_response_bytes",
      "request_bytes",
      "subject_identity_bytes",
      "subject_response_bytes",
      "trust_root_bytes"
    ], `pilot-source-ceremony-record-${index}`);
    const issuer = restorePlacementAdmissionCeremonyRoleResponse(record.issuer_response_bytes);
    const subject = restorePlacementAdmissionCeremonyRoleResponse(record.subject_response_bytes);
    result.push(expectedArtifact(
      issuer.bytes,
      issuer.role_response_id,
      "ceremony-role-response",
      "issuer",
      issuer.identity
    ));
    result.push(expectedArtifact(
      subject.bytes,
      subject.role_response_id,
      "ceremony-role-response",
      "subject",
      subject.identity
    ));
  }

  const epochs = copiedArray(
    epochRecords,
    1,
    PROTOCOL_PROFILE.placement_admission.members_per_epoch_max,
    "pilot-source-epoch-records"
  );
  let priorEpochBytes = null;
  for (let epochIndex = 0; epochIndex < epochs.length; epochIndex += 1) {
    const record = exactRecord(epochs[epochIndex], [
      "approval_bytes",
      "ceremony_bundle_bytes",
      "epoch_bytes",
      "request_bytes"
    ], `pilot-source-epoch-record-${epochIndex}`);
    const request = restorePlacementMembershipEpochRequest({
      capsule_bytes: capsuleBytes,
      prior_epoch_bytes: priorEpochBytes,
      request_bytes: record.request_bytes
    });
    const approvals = copiedArray(
      record.approval_bytes,
      1,
      request.custodian_key_ids.length,
      `pilot-source-epoch-${epochIndex}-approvals`
    );
    for (let approvalIndex = 0; approvalIndex < approvals.length; approvalIndex += 1) {
      const approval = restorePlacementMembershipEpochApproval({
        approval_bytes: approvals[approvalIndex],
        capsule_bytes: capsuleBytes,
        prior_epoch_bytes: priorEpochBytes,
        request_bytes: request.bytes
      });
      let signer = null;
      for (
        let custodianIndex = 0;
        custodianIndex < request.body.lineage_authority.custodians.length;
        custodianIndex += 1
      ) {
        const candidate = request.body.lineage_authority.custodians[custodianIndex];
        if (candidate.key_id === approval.approval.key_id) signer = candidate;
      }
      if (signer === null) {
        fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "approval-signer");
      }
      result.push(expectedArtifact(
        approval.bytes,
        approval.approval_id,
        "membership-epoch-approval",
        "custodian",
        signer
      ));
    }
    priorEpochBytes = record.epoch_bytes;
  }

  const deploymentRecord = exactRecord(deployment, [
    "acceptance_bytes",
    "activation_bytes",
    "attestation_bytes",
    "membership_bytes",
    "plan_bytes",
    "primary_ceremony_bundle_bytes",
    "view_bytes"
  ], "pilot-source-deployment");
  const acceptances = copiedArray(
    deploymentRecord.acceptance_bytes,
    1,
    PROTOCOL_PROFILE.placement_admission.members_per_epoch_max,
    "pilot-source-deployment-acceptances"
  );
  for (let index = 0; index < acceptances.length; index += 1) {
    const acceptance = restorePlacementAdmissionDeploymentPlanAcceptance({
      acceptance_bytes: acceptances[index],
      plan_bytes: deploymentRecord.plan_bytes
    });
    result.push(expectedArtifact(
      acceptance.bytes,
      acceptance.acceptance_id,
      "deployment-plan-acceptance",
      "observer",
      acceptance.observer
    ));
  }
  const attestations = copiedArray(
    deploymentRecord.attestation_bytes,
    1,
    PROTOCOL_PROFILE.placement_admission.members_per_epoch_max,
    "pilot-source-deployment-attestations"
  );
  for (let index = 0; index < attestations.length; index += 1) {
    const attestation = restorePlacementAdmissionDeploymentAttestation(attestations[index]);
    result.push(expectedArtifact(
      attestation.bytes,
      attestation.attestation_id,
      "deployment-observation-attestation",
      "observer",
      attestation.observer
    ));
  }
  arraySort(result, (left, right) => expectedKey(left) < expectedKey(right)
    ? -1
    : expectedKey(left) > expectedKey(right) ? 1 : 0);
  for (let index = 1; index < result.length; index += 1) {
    if (expectedKey(result[index - 1]) === expectedKey(result[index])) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "duplicate-expected-artifact");
    }
  }
  return freeze(result);
}

function receiptSummary(receipt) {
  return freeze({
    artifact_digest: receipt.artifact_digest,
    artifact_id: receipt.artifact_id,
    artifact_kind: receipt.artifact_kind,
    receipt_id: receipt.receipt_id,
    role: receipt.role,
    signer_key_id: receipt.signer.key_id
  });
}

function bindReceipts(receiptSources, expected, sourceCommit) {
  const inputs = copiedArray(
    receiptSources,
    1,
    PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max,
    "pilot-source-receipts"
  );
  if (inputs.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "incomplete-role-execution-receipts");
  }
  const receipts = new Array(inputs.length);
  for (let index = 0; index < inputs.length; index += 1) {
    const bytes = ownedBytes(
      inputs[index],
      PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes,
      `pilot-source-receipt-${index}`
    );
    receipts[index] = restorePlacementAdmissionRoleExecutionReceipt(bytes);
  }
  arraySort(receipts, (left, right) => expectedKey(left) < expectedKey(right)
    ? -1
    : expectedKey(left) > expectedKey(right) ? 1 : 0);
  const summaries = new Array(receipts.length);
  const signerKeyIds = createSet();
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index];
    const wanted = expected[index];
    if (
      expectedKey(receipt) !== expectedKey(wanted) ||
      receipt.artifact_digest !== wanted.artifact_digest ||
      receipt.role !== wanted.role ||
      receipt.signer.key_id !== wanted.signer.key_id ||
      receipt.signer.public_key !== wanted.signer.public_key ||
      receipt.source_commit !== sourceCommit
    ) fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", `role-execution-receipt-${index}`);
    if (index > 0 && expectedKey(receipts[index - 1]) === expectedKey(receipt)) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "duplicate-role-execution-receipt");
    }
    setAdd(signerKeyIds, receipt.signer.key_id);
    summaries[index] = receiptSummary(receipt);
  }
  return freeze({
    receipts: freeze(summaries),
    signer_count: setSize(signerKeyIds)
  });
}

function evidenceContent(pilot, bound) {
  return freeze({
    attested_artifact_count: bound.receipts.length,
    execution_receipts: bound.receipts,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    pilot_evidence_id: pilot.evidence_id,
    role_key_count: bound.signer_count,
    source_commit: pilot.source_commit,
    source_commit_execution_binding: "role-key-attested-artifacts",
    topology_authority: "unproven",
    unsigned_coordinator_execution_binding: "unproven"
  });
}

function project(bytes, content, attestationId, verified) {
  return freeze({
    attestation_id: attestationId,
    attested_artifact_count: content.attested_artifact_count,
    bytes: new UINT8_ARRAY(bytes),
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    pilot_evidence_id: content.pilot_evidence_id,
    receipts_verified: verified,
    role_key_count: content.role_key_count,
    source_commit: content.source_commit,
    source_commit_execution_binding: "role-key-attested-artifacts",
    status: verified
      ? "placement-admission-pilot-source-attestation-verified"
      : "placement-admission-pilot-source-attestation-restored",
    topology_authority: "unproven",
    unsigned_coordinator_execution_binding: "unproven"
  });
}

export function createPlacementAdmissionPilotSourceAttestation(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "execution_receipt_bytes",
    "pilot_evidence_bytes",
    "source_commit"
  ], "pilot-source-attestation-options");
  const sourceCommit = normalizedCommit(source.source_commit, "pilot-source-commit");
  const pilot = verifyPlacementAdmissionPilotEvidence({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    evidence_bytes: source.pilot_evidence_bytes,
    expected_source_commit: sourceCommit,
    source_commit: sourceCommit
  });
  const expected = expectedArtifacts(
    source.ceremony_records,
    source.epoch_records,
    source.deployment,
    source.capsule_bytes
  );
  const bound = bindReceipts(source.execution_receipt_bytes, expected, sourceCommit);
  const content = evidenceContent(pilot, bound);
  const attestationId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ attestation_id: attestationId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.evidence_bytes) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_LIMIT", "pilot-source-attestation-bytes");
  }
  return project(bytes, content, attestationId, true);
}

function restoredReceiptSummaries(source, count) {
  const values = copiedArray(
    source,
    count,
    count,
    "pilot-source-attestation-execution-receipts"
  );
  const result = new Array(values.length);
  let prior = null;
  const signerIds = createSet();
  for (let index = 0; index < values.length; index += 1) {
    const value = exactRecord(values[index], [
      "artifact_digest",
      "artifact_id",
      "artifact_kind",
      "receipt_id",
      "role",
      "signer_key_id"
    ], `pilot-source-attestation-receipt-${index}`);
    normalizedDigest(value.artifact_digest, `pilot-source-receipt-${index}-artifact-digest`);
    normalizedDigest(value.artifact_id, `pilot-source-receipt-${index}-artifact-id`);
    normalizedDigest(value.receipt_id, `pilot-source-receipt-${index}-receipt-id`);
    normalizedKeyId(value.signer_key_id, `pilot-source-receipt-${index}-signer-key-id`);
    const artifactKind = normalizedEnum(
      value.artifact_kind,
      ARTIFACT_KINDS,
      `pilot-source-receipt-${index}-artifact-kind`
    );
    const role = normalizedEnum(
      value.role,
      ROLES,
      `pilot-source-receipt-${index}-role`
    );
    const current = `${artifactKind}:${value.artifact_id}`;
    if (prior !== null && prior >= current) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", "pilot-source-receipt-order");
    }
    prior = current;
    setAdd(signerIds, value.signer_key_id);
    result[index] = freeze({
      artifact_digest: value.artifact_digest,
      artifact_id: value.artifact_id,
      artifact_kind: artifactKind,
      receipt_id: value.receipt_id,
      role,
      signer_key_id: value.signer_key_id
    });
  }
  return freeze({ receipts: freeze(result), signer_count: setSize(signerIds) });
}

export function restorePlacementAdmissionPilotSourceAttestation(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.evidence_bytes,
    "pilot-source-attestation"
  );
  const value = exactRecord(parsed.value, [
    "attestation_id",
    "attested_artifact_count",
    "execution_receipts",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "non_authority",
    "pilot_evidence_id",
    "role_key_count",
    "source_commit",
    "source_commit_execution_binding",
    "topology_authority",
    "unsigned_coordinator_execution_binding"
  ], "pilot-source-attestation");
  if (
    value.format !== FORMAT ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.non_authority !== true ||
    value.source_commit_execution_binding !== "role-key-attested-artifacts" ||
    value.topology_authority !== "unproven" ||
    value.unsigned_coordinator_execution_binding !== "unproven" ||
    !numberIsSafeInteger(value.attested_artifact_count) ||
    value.attested_artifact_count < 1 ||
    value.attested_artifact_count >
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max ||
    !numberIsSafeInteger(value.role_key_count) ||
    value.role_key_count < 1 ||
    value.role_key_count > value.attested_artifact_count
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_FORMAT", "pilot-source-attestation-envelope");
  const restored = restoredReceiptSummaries(
    value.execution_receipts,
    value.attested_artifact_count
  );
  if (value.role_key_count !== restored.signer_count) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "pilot-source-role-key-count");
  }
  const content = freeze({
    attested_artifact_count: value.attested_artifact_count,
    execution_receipts: restored.receipts,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    pilot_evidence_id: normalizedDigest(
      value.pilot_evidence_id,
      "pilot-source-pilot-evidence-id"
    ),
    role_key_count: value.role_key_count,
    source_commit: normalizedCommit(value.source_commit, "pilot-source-source-commit"),
    source_commit_execution_binding: "role-key-attested-artifacts",
    topology_authority: "unproven",
    unsigned_coordinator_execution_binding: "unproven"
  });
  const attestationId = domainHash(ID_DOMAIN, canonicalBytes(content));
  if (
    value.attestation_id !== attestationId ||
    !equalBytes(parsed.bytes, canonicalBytes({ attestation_id: attestationId, ...content }))
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "pilot-source-attestation-id");
  return project(parsed.bytes, content, attestationId, false);
}

export function verifyPlacementAdmissionPilotSourceAttestation(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "execution_receipt_bytes",
    "pilot_evidence_bytes",
    "source_attestation_bytes",
    "source_commit"
  ], "pilot-source-attestation-verification-options");
  const restored = restorePlacementAdmissionPilotSourceAttestation(
    source.source_attestation_bytes
  );
  const created = createPlacementAdmissionPilotSourceAttestation({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    execution_receipt_bytes: source.execution_receipt_bytes,
    pilot_evidence_bytes: source.pilot_evidence_bytes,
    source_commit: source.source_commit
  });
  if (!equalBytes(restored.bytes, created.bytes)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_BINDING", "pilot-source-attestation-sidecars");
  }
  return created;
}
