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
  arrayPush,
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
  setHas,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS
} from "./admission-pilot-evidence.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS,
  verifyPlacementAdmissionPilotSourceAttestation
} from "./admission-pilot-source-attestation.mjs";

const FORMAT = "mortalos-placement-admission-pilot-source-verdict/1";
const ID_DOMAIN = "MortalOS placement admission pilot source verdict v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const BINDINGS = freeze(["deterministically-replayed", "participant-endorsed"]);
const ARTIFACT_KINDS = freeze([
  "admission-ceremony-bundle",
  "admission-ceremony-request",
  "admission-subject-identity",
  "admission-trust-root",
  "deployment-attestation-view",
  "deployment-plan",
  "deployment-plan-activation",
  "deployment-plan-membership",
  "membership-epoch",
  "membership-epoch-request",
  "pilot-evidence"
]);
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS = freeze({
  verdict_bytes: 128 * 1024,
  unsigned_protocol_artifacts_max:
    (PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.ceremonies_max * 4) +
    (PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max * 2) +
    5
});

export class PlacementAdmissionPilotSourceVerdictError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionPilotSourceVerdictError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionPilotSourceVerdictError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-keys`);
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
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", label);
  }
  requireRealm();
  if (values.length < minimum || values.length > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_LIMIT", label);
  }
  return values;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 32 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", label);
  }
  return value;
}

function normalizedCommit(value, label) {
  if (typeof value !== "string" || !regexpTest(COMMIT, value)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", label);
  }
  return value;
}

function normalizedEnum(value, allowed, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", label);
  }
  for (let index = 0; index < allowed.length; index += 1) {
    if (allowed[index] === value) return value;
  }
  fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", label);
}

function artifactDigest(bytes) {
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

function artifactKey(value) {
  return `${value.artifact_kind}:${value.artifact_digest}`;
}

function addUnsignedArtifact(result, seen, artifactKind, digest, binding) {
  const entry = freeze({
    artifact_digest: normalizedDigest(digest, `${artifactKind}-artifact-digest`),
    artifact_kind: normalizedEnum(artifactKind, ARTIFACT_KINDS, "artifact-kind"),
    binding: normalizedEnum(binding, BINDINGS, `${artifactKind}-binding`)
  });
  const key = artifactKey(entry);
  if (setHas(seen, key)) return;
  setAdd(seen, key);
  arrayPush(result, entry);
}

function protocolArtifactInventory(pilotEvidenceBytes) {
  const parsed = parseCanonical(
    pilotEvidenceBytes,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes,
    "pilot-evidence"
  );
  const value = exactRecord(parsed.value, [
    "capsule_artifact_digest",
    "capsule_id",
    "ceremonies",
    "deployment",
    "epochs",
    "evidence_id",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "lineage_head_hash",
    "lineage_organism_id",
    "non_authority",
    "source_commit",
    "source_commit_execution_binding",
    "topology_authority"
  ], "pilot-evidence");
  const artifacts = [];
  const seen = createSet();
  const ceremonies = copiedArray(
    value.ceremonies,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.ceremonies_max,
    "pilot-evidence-ceremonies"
  );
  for (let index = 0; index < ceremonies.length; index += 1) {
    const ceremony = exactRecord(ceremonies[index], [
      "bundle_artifact_digest",
      "bundle_id",
      "issuer_role_response_artifact_digest",
      "issuer_role_response_id",
      "request_artifact_digest",
      "subject_identity_artifact_digest",
      "subject_key_id",
      "subject_role_response_artifact_digest",
      "subject_role_response_id",
      "trust_root_artifact_digest",
      "trust_root_id"
    ], `pilot-evidence-ceremony-${index}`);
    addUnsignedArtifact(
      artifacts,
      seen,
      "admission-trust-root",
      ceremony.trust_root_artifact_digest,
      "participant-endorsed"
    );
    addUnsignedArtifact(
      artifacts,
      seen,
      "admission-subject-identity",
      ceremony.subject_identity_artifact_digest,
      "participant-endorsed"
    );
    addUnsignedArtifact(
      artifacts,
      seen,
      "admission-ceremony-request",
      ceremony.request_artifact_digest,
      "participant-endorsed"
    );
    addUnsignedArtifact(
      artifacts,
      seen,
      "admission-ceremony-bundle",
      ceremony.bundle_artifact_digest,
      "deterministically-replayed"
    );
  }
  const epochs = copiedArray(
    value.epochs,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max,
    "pilot-evidence-epochs"
  );
  for (let index = 0; index < epochs.length; index += 1) {
    const epoch = exactRecord(epochs[index], [
      "approval_count",
      "approvals",
      "ceremony_bundles",
      "custody_threshold",
      "epoch",
      "epoch_artifact_digest",
      "epoch_id",
      "member_count",
      "prior_epoch_id",
      "request_artifact_digest",
      "request_id"
    ], `pilot-evidence-epoch-${index}`);
    addUnsignedArtifact(
      artifacts,
      seen,
      "membership-epoch-request",
      epoch.request_artifact_digest,
      "participant-endorsed"
    );
    addUnsignedArtifact(
      artifacts,
      seen,
      "membership-epoch",
      epoch.epoch_artifact_digest,
      "deterministically-replayed"
    );
  }
  const deployment = exactRecord(value.deployment, [
    "acceptances",
    "activation_artifact_digest",
    "activation_id",
    "attestations",
    "membership_artifact_digest",
    "membership_candidate_view_id",
    "membership_id",
    "observation_ids",
    "observer_key_ids",
    "plan_artifact_digest",
    "plan_id",
    "primary_ceremony_bundle_artifact_digest",
    "primary_ceremony_bundle_id",
    "view_artifact_digest",
    "view_id"
  ], "pilot-evidence-deployment");
  addUnsignedArtifact(
    artifacts,
    seen,
    "deployment-plan",
    deployment.plan_artifact_digest,
    "participant-endorsed"
  );
  addUnsignedArtifact(
    artifacts,
    seen,
    "deployment-plan-activation",
    deployment.activation_artifact_digest,
    "deterministically-replayed"
  );
  addUnsignedArtifact(
    artifacts,
    seen,
    "deployment-plan-membership",
    deployment.membership_artifact_digest,
    "deterministically-replayed"
  );
  addUnsignedArtifact(
    artifacts,
    seen,
    "deployment-attestation-view",
    deployment.view_artifact_digest,
    "deterministically-replayed"
  );
  addUnsignedArtifact(
    artifacts,
    seen,
    "pilot-evidence",
    artifactDigest(parsed.bytes),
    "deterministically-replayed"
  );
  arraySort(artifacts, (left, right) => artifactKey(left) < artifactKey(right)
    ? -1
    : artifactKey(left) > artifactKey(right) ? 1 : 0);
  let deterministicCount = 0;
  let participantEndorsedCount = 0;
  for (let index = 0; index < artifacts.length; index += 1) {
    if (artifacts[index].binding === "deterministically-replayed") {
      deterministicCount += 1;
    } else {
      participantEndorsedCount += 1;
    }
  }
  return freeze({
    authenticated_input_artifacts: freeze([freeze({
      artifact_digest: normalizedDigest(
        value.capsule_artifact_digest,
        "capsule-artifact-digest"
      ),
      artifact_kind: "continuity-capsule",
      binding: "authority-signature-verified"
    })]),
    deterministic_count: deterministicCount,
    evidence_id: normalizedDigest(value.evidence_id, "pilot-evidence-id"),
    participant_endorsed_count: participantEndorsedCount,
    source_commit: normalizedCommit(value.source_commit, "pilot-evidence-source-commit"),
    unsigned_protocol_artifacts: freeze(artifacts)
  });
}

function verdictContent(sourceAttestation, inventory) {
  const authenticatedInputCount = inventory.authenticated_input_artifacts.length;
  const unsignedCount = inventory.unsigned_protocol_artifacts.length;
  return freeze({
    authenticated_input_artifact_count: authenticatedInputCount,
    authenticated_input_artifacts: inventory.authenticated_input_artifacts,
    coordinator_execution_binding: "unproven",
    coordinator_protocol_authority: "not-required-for-verification",
    deterministically_replayed_artifact_count: inventory.deterministic_count,
    evidence_artifact_count:
      authenticatedInputCount + sourceAttestation.attested_artifact_count + unsignedCount,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    participant_endorsed_artifact_count: inventory.participant_endorsed_count,
    participant_source_artifact_count: sourceAttestation.attested_artifact_count,
    participant_source_attestation_id: sourceAttestation.attestation_id,
    pilot_evidence_id: sourceAttestation.pilot_evidence_id,
    role_key_count: sourceAttestation.role_key_count,
    source_commit: sourceAttestation.source_commit,
    source_commit_execution_binding: "role-key-attested-artifacts",
    topology_authority: "unproven",
    unsigned_protocol_artifact_count: unsignedCount,
    unsigned_protocol_artifacts: inventory.unsigned_protocol_artifacts,
    verdict_basis: "complete-public-chain-plus-role-source-receipts"
  });
}

function project(bytes, content, verdictId, verified) {
  return freeze({
    authenticated_input_artifact_count: content.authenticated_input_artifact_count,
    bytes: new UINT8_ARRAY(bytes),
    coordinator_execution_binding: "unproven",
    coordinator_protocol_authority: "not-required-for-verification",
    deterministically_replayed_artifact_count:
      content.deterministically_replayed_artifact_count,
    evidence_artifact_count: content.evidence_artifact_count,
    non_authority: true,
    participant_endorsed_artifact_count: content.participant_endorsed_artifact_count,
    participant_receipts_verified: verified,
    participant_source_artifact_count: content.participant_source_artifact_count,
    participant_source_attestation_id: content.participant_source_attestation_id,
    pilot_evidence_id: content.pilot_evidence_id,
    public_chain_verified: verified,
    role_key_count: content.role_key_count,
    source_commit: content.source_commit,
    source_commit_execution_binding: "role-key-attested-artifacts",
    status: verified
      ? "placement-admission-pilot-source-verdict-verified"
      : "placement-admission-pilot-source-verdict-restored",
    topology_authority: "unproven",
    unsigned_protocol_artifact_count: content.unsigned_protocol_artifact_count,
    unsigned_protocol_artifacts_verified: verified,
    verdict_id: verdictId
  });
}

export function createPlacementAdmissionPilotSourceVerdict(options) {
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
  ], "pilot-source-verdict-options");
  const sourceAttestation = verifyPlacementAdmissionPilotSourceAttestation({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    execution_receipt_bytes: source.execution_receipt_bytes,
    pilot_evidence_bytes: source.pilot_evidence_bytes,
    source_attestation_bytes: source.source_attestation_bytes,
    source_commit: source.source_commit
  });
  const inventory = protocolArtifactInventory(source.pilot_evidence_bytes);
  if (
    inventory.evidence_id !== sourceAttestation.pilot_evidence_id ||
    inventory.source_commit !== sourceAttestation.source_commit
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_BINDING", "pilot-evidence");
  const content = verdictContent(sourceAttestation, inventory);
  const verdictId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ verdict_id: verdictId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.verdict_bytes) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_LIMIT", "pilot-source-verdict-bytes");
  }
  return project(bytes, content, verdictId, true);
}

function restoredAuthenticatedInputs(source, count) {
  const values = copiedArray(source, count, count, "source-verdict-authenticated-inputs");
  if (values.length !== 1) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", "authenticated-input-count");
  }
  const value = exactRecord(values[0], [
    "artifact_digest",
    "artifact_kind",
    "binding"
  ], "source-verdict-authenticated-input-0");
  if (
    value.artifact_kind !== "continuity-capsule" ||
    value.binding !== "authority-signature-verified"
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", "authenticated-input");
  return freeze([freeze({
    artifact_digest: normalizedDigest(value.artifact_digest, "authenticated-input-digest"),
    artifact_kind: "continuity-capsule",
    binding: "authority-signature-verified"
  })]);
}

function restoredUnsignedArtifacts(source, count) {
  const values = copiedArray(
    source,
    count,
    count,
    "source-verdict-unsigned-protocol-artifacts"
  );
  const result = new Array(values.length);
  let prior = null;
  let deterministicCount = 0;
  let participantEndorsedCount = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = exactRecord(values[index], [
      "artifact_digest",
      "artifact_kind",
      "binding"
    ], `source-verdict-unsigned-artifact-${index}`);
    const artifactKind = normalizedEnum(
      value.artifact_kind,
      ARTIFACT_KINDS,
      `source-verdict-artifact-${index}-kind`
    );
    const binding = normalizedEnum(
      value.binding,
      BINDINGS,
      `source-verdict-artifact-${index}-binding`
    );
    const entry = freeze({
      artifact_digest: normalizedDigest(
        value.artifact_digest,
        `source-verdict-artifact-${index}-digest`
      ),
      artifact_kind: artifactKind,
      binding
    });
    const current = artifactKey(entry);
    if (prior !== null && prior >= current) {
      fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", "unsigned-artifact-order");
    }
    prior = current;
    if (binding === "deterministically-replayed") deterministicCount += 1;
    else participantEndorsedCount += 1;
    result[index] = entry;
  }
  return freeze({
    artifacts: freeze(result),
    deterministic_count: deterministicCount,
    participant_endorsed_count: participantEndorsedCount
  });
}

export function restorePlacementAdmissionPilotSourceVerdict(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.verdict_bytes,
    "pilot-source-verdict"
  );
  const value = exactRecord(parsed.value, [
    "authenticated_input_artifact_count",
    "authenticated_input_artifacts",
    "coordinator_execution_binding",
    "coordinator_protocol_authority",
    "deterministically_replayed_artifact_count",
    "evidence_artifact_count",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "non_authority",
    "participant_endorsed_artifact_count",
    "participant_source_artifact_count",
    "participant_source_attestation_id",
    "pilot_evidence_id",
    "role_key_count",
    "source_commit",
    "source_commit_execution_binding",
    "topology_authority",
    "unsigned_protocol_artifact_count",
    "unsigned_protocol_artifacts",
    "verdict_basis",
    "verdict_id"
  ], "pilot-source-verdict");
  if (
    value.format !== FORMAT ||
    value.coordinator_execution_binding !== "unproven" ||
    value.coordinator_protocol_authority !== "not-required-for-verification" ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.non_authority !== true ||
    value.source_commit_execution_binding !== "role-key-attested-artifacts" ||
    value.topology_authority !== "unproven" ||
    value.verdict_basis !== "complete-public-chain-plus-role-source-receipts" ||
    !numberIsSafeInteger(value.authenticated_input_artifact_count) ||
    value.authenticated_input_artifact_count !== 1 ||
    !numberIsSafeInteger(value.deterministically_replayed_artifact_count) ||
    value.deterministically_replayed_artifact_count < 1 ||
    !numberIsSafeInteger(value.evidence_artifact_count) ||
    value.evidence_artifact_count < 1 ||
    !numberIsSafeInteger(value.participant_endorsed_artifact_count) ||
    value.participant_endorsed_artifact_count < 1 ||
    !numberIsSafeInteger(value.participant_source_artifact_count) ||
    value.participant_source_artifact_count < 1 ||
    value.participant_source_artifact_count >
      PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max ||
    !numberIsSafeInteger(value.role_key_count) ||
    value.role_key_count < 1 ||
    value.role_key_count > value.participant_source_artifact_count ||
    !numberIsSafeInteger(value.unsigned_protocol_artifact_count) ||
    value.unsigned_protocol_artifact_count < 1 ||
    value.unsigned_protocol_artifact_count >
      PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.unsigned_protocol_artifacts_max
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_FORMAT", "source-verdict-envelope");
  const authenticatedInputs = restoredAuthenticatedInputs(
    value.authenticated_input_artifacts,
    value.authenticated_input_artifact_count
  );
  const unsigned = restoredUnsignedArtifacts(
    value.unsigned_protocol_artifacts,
    value.unsigned_protocol_artifact_count
  );
  if (
    value.deterministically_replayed_artifact_count !== unsigned.deterministic_count ||
    value.participant_endorsed_artifact_count !== unsigned.participant_endorsed_count ||
    value.deterministically_replayed_artifact_count +
      value.participant_endorsed_artifact_count !== value.unsigned_protocol_artifact_count ||
    value.authenticated_input_artifact_count + value.participant_source_artifact_count +
      value.unsigned_protocol_artifact_count !== value.evidence_artifact_count
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_BINDING", "source-verdict-counts");
  const content = freeze({
    authenticated_input_artifact_count: value.authenticated_input_artifact_count,
    authenticated_input_artifacts: authenticatedInputs,
    coordinator_execution_binding: "unproven",
    coordinator_protocol_authority: "not-required-for-verification",
    deterministically_replayed_artifact_count: value.deterministically_replayed_artifact_count,
    evidence_artifact_count: value.evidence_artifact_count,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    participant_endorsed_artifact_count: value.participant_endorsed_artifact_count,
    participant_source_artifact_count: value.participant_source_artifact_count,
    participant_source_attestation_id: normalizedDigest(
      value.participant_source_attestation_id,
      "source-verdict-source-attestation-id"
    ),
    pilot_evidence_id: normalizedDigest(value.pilot_evidence_id, "source-verdict-pilot-id"),
    role_key_count: value.role_key_count,
    source_commit: normalizedCommit(value.source_commit, "source-verdict-source-commit"),
    source_commit_execution_binding: "role-key-attested-artifacts",
    topology_authority: "unproven",
    unsigned_protocol_artifact_count: value.unsigned_protocol_artifact_count,
    unsigned_protocol_artifacts: unsigned.artifacts,
    verdict_basis: "complete-public-chain-plus-role-source-receipts"
  });
  const verdictId = domainHash(ID_DOMAIN, canonicalBytes(content));
  if (
    value.verdict_id !== verdictId ||
    !equalBytes(parsed.bytes, canonicalBytes({ verdict_id: verdictId, ...content }))
  ) fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_BINDING", "source-verdict-id");
  return project(parsed.bytes, content, verdictId, false);
}

export function verifyPlacementAdmissionPilotSourceVerdict(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "execution_receipt_bytes",
    "pilot_evidence_bytes",
    "source_attestation_bytes",
    "source_commit",
    "verdict_bytes"
  ], "pilot-source-verdict-verification-options");
  const restored = restorePlacementAdmissionPilotSourceVerdict(source.verdict_bytes);
  const created = createPlacementAdmissionPilotSourceVerdict({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    execution_receipt_bytes: source.execution_receipt_bytes,
    pilot_evidence_bytes: source.pilot_evidence_bytes,
    source_attestation_bytes: source.source_attestation_bytes,
    source_commit: source.source_commit
  });
  if (!equalBytes(restored.bytes, created.bytes)) {
    fail("E_PLACEMENT_ADMISSION_SOURCE_VERDICT_BINDING", "source-verdict-sidecars");
  }
  return created;
}
