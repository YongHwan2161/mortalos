import { sha256 } from "@noble/hashes/sha2.js";
import {
  byteLengthOfBytes,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { verifyContinuityCapsule } from "../../src/capsule.mjs";
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
  setHas,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  finalizePlacementAdmissionCeremonyBundle,
  PLACEMENT_ADMISSION_CEREMONY_LIMITS,
  restorePlacementAdmissionCeremonyBundle,
  restorePlacementAdmissionCeremonyRoleResponse
} from "./admission-ceremony-client.mjs";
import {
  createPlacementAdmissionDeploymentPlanActivation,
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS,
  restorePlacementAdmissionDeploymentPlanActivation,
  restorePlacementAdmissionDeploymentPlanAcceptance
} from "./admission-deployment-plan-activation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS,
  restorePlacementAdmissionDeploymentAttestation,
  verifyPlacementAdmissionDeploymentAttestationView
} from "./admission-deployment-attestation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS,
  restorePlacementAdmissionDeploymentPlan
} from "./admission-deployment-plan.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS,
  verifyPlacementAdmissionDeploymentPlanMembership
} from "./admission-deployment-plan-membership.mjs";
import {
  createPlacementMembershipEpochRequest,
  finalizePlacementMembershipEpochRequest,
  PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS,
  restorePlacementMembershipEpochApproval,
  restorePlacementMembershipEpochRequest
} from "./admission-membership-epoch-ceremony.mjs";

const FORMAT = "mortalos-placement-admission-pilot-evidence/1";
const ID_DOMAIN = "MortalOS placement admission pilot evidence v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const ORGANISM_ID = /^mortalos:[A-Za-z0-9_-]{43}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/u;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS = freeze({
  ceremonies_max: PROTOCOL_PROFILE.placement_admission.members_per_epoch_max ** 2,
  evidence_bytes: 256 * 1024,
  epochs_max: PROTOCOL_PROFILE.placement_admission.members_per_epoch_max
});

export class PlacementAdmissionPilotEvidenceError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionPilotEvidenceError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionPilotEvidenceError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_PILOT_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-keys`);
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
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", label);
  }
  requireRealm();
  if (values.length < minimum || values.length > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_LIMIT", label);
  }
  return values;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedCommit(value, label) {
  if (typeof value !== "string" || !regexpTest(COMMIT, value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", label);
  }
  return value;
}

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", label);
  }
  return value;
}

function normalizedKeyId(value, label) {
  if (typeof value !== "string" || !regexpTest(KEY_ID, value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", label);
  }
  return value;
}

function artifactDigest(bytes) {
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

function reference(bytes, idName, idValue) {
  return freeze({
    artifact_digest: artifactDigest(bytes),
    [idName]: idValue
  });
}

function sortedReferences(values, idName) {
  arraySort(values, (left, right) => left[idName] < right[idName]
    ? -1
    : left[idName] > right[idName] ? 1 : 0);
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1][idName] === values[index][idName]) {
      fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", `duplicate-${idName}`);
    }
  }
  return freeze(values);
}

function sameBytes(left, right, detail) {
  if (!equalBytes(left, right)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", detail);
  }
}

function verifyCeremonyRecords(source) {
  const records = copiedArray(
    source,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.ceremonies_max,
    "pilot-ceremony-records"
  );
  const contents = new Array(records.length);
  for (let index = 0; index < records.length; index += 1) {
    const record = exactRecord(records[index], [
      "bundle_bytes",
      "issuer_response_bytes",
      "request_bytes",
      "subject_identity_bytes",
      "subject_response_bytes",
      "trust_root_bytes"
    ], `pilot-ceremony-record-${index}`);
    const bundleBytes = ownedBytes(
      record.bundle_bytes,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `pilot-ceremony-${index}-bundle`
    );
    const bundle = restorePlacementAdmissionCeremonyBundle(bundleBytes);
    const requestBytes = ownedBytes(
      record.request_bytes,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `pilot-ceremony-${index}-request`
    );
    const issuerResponseBytes = ownedBytes(
      record.issuer_response_bytes,
      PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
      `pilot-ceremony-${index}-issuer-response`
    );
    const subjectResponseBytes = ownedBytes(
      record.subject_response_bytes,
      PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
      `pilot-ceremony-${index}-subject-response`
    );
    const issuerResponse = restorePlacementAdmissionCeremonyRoleResponse(issuerResponseBytes);
    const subjectResponse = restorePlacementAdmissionCeremonyRoleResponse(subjectResponseBytes);
    const trustRootBytes = ownedBytes(
      record.trust_root_bytes,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `pilot-ceremony-${index}-trust-root`
    );
    const subjectIdentityBytes = ownedBytes(
      record.subject_identity_bytes,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
      `pilot-ceremony-${index}-subject-identity`
    );
    sameBytes(requestBytes, bundle.request_bytes, `ceremony-${index}-request`);
    sameBytes(
      trustRootBytes,
      canonicalBytes(bundle.trust_root),
      `ceremony-${index}-trust-root`
    );
    sameBytes(
      subjectIdentityBytes,
      canonicalBytes(bundle.subject.identity),
      `ceremony-${index}-subject-identity`
    );
    const replayedBundle = finalizePlacementAdmissionCeremonyBundle({
      evaluated_at_ms: bundle.evaluated_at_ms,
      issuer_response_bytes: issuerResponseBytes,
      request_bytes: requestBytes,
      subject_response_bytes: subjectResponseBytes
    });
    sameBytes(replayedBundle.bytes, bundleBytes, `ceremony-${index}-role-responses`);
    contents[index] = freeze({
      bundle_artifact_digest: artifactDigest(bundleBytes),
      bundle_id: bundle.bundle_id,
      issuer_role_response_artifact_digest: artifactDigest(issuerResponseBytes),
      issuer_role_response_id: issuerResponse.role_response_id,
      request_artifact_digest: artifactDigest(requestBytes),
      subject_identity_artifact_digest: artifactDigest(subjectIdentityBytes),
      subject_key_id: bundle.subject.identity.key_id,
      subject_role_response_artifact_digest: artifactDigest(subjectResponseBytes),
      subject_role_response_id: subjectResponse.role_response_id,
      trust_root_artifact_digest: artifactDigest(trustRootBytes),
      trust_root_id: bundle.trust_root.trust_root_id
    });
  }
  arraySort(contents, (left, right) => left.bundle_id < right.bundle_id
    ? -1
    : left.bundle_id > right.bundle_id ? 1 : 0);
  for (let index = 1; index < contents.length; index += 1) {
    if (contents[index - 1].bundle_id === contents[index].bundle_id) {
      fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "duplicate-ceremony-bundle");
    }
  }
  return freeze(contents);
}

function verifyEpochRecords(source, capsuleBytes, ceremonies) {
  const records = copiedArray(
    source,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max,
    "pilot-epoch-records"
  );
  const contents = new Array(records.length);
  const epochBytes = new Array(records.length);
  const seenEpochs = createSet();
  const usedCeremonies = createSet();
  let priorEpochBytes = null;
  for (let index = 0; index < records.length; index += 1) {
    const record = exactRecord(records[index], [
      "approval_bytes",
      "ceremony_bundle_bytes",
      "epoch_bytes",
      "request_bytes"
    ], `pilot-epoch-record-${index}`);
    const bundleSources = copiedArray(
      record.ceremony_bundle_bytes,
      1,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundles_max,
      `pilot-epoch-${index}-bundles`
    );
    const bundleBytes = new Array(bundleSources.length);
    const bundleReferences = new Array(bundleSources.length);
    for (let bundleIndex = 0; bundleIndex < bundleSources.length; bundleIndex += 1) {
      const bytes = ownedBytes(
        bundleSources[bundleIndex],
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `pilot-epoch-${index}-bundle-${bundleIndex}`
      );
      const bundle = restorePlacementAdmissionCeremonyBundle(bytes);
      const digest = artifactDigest(bytes);
      let recorded = false;
      for (let ceremonyIndex = 0; ceremonyIndex < ceremonies.length; ceremonyIndex += 1) {
        if (
          ceremonies[ceremonyIndex].bundle_id === bundle.bundle_id &&
          ceremonies[ceremonyIndex].bundle_artifact_digest === digest
        ) recorded = true;
      }
      if (!recorded) {
        fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", `epoch-${index}-unrecorded-bundle`);
      }
      setAdd(usedCeremonies, bundle.bundle_id);
      bundleBytes[bundleIndex] = bytes;
      bundleReferences[bundleIndex] = reference(bytes, "bundle_id", bundle.bundle_id);
    }
    const requestBytes = ownedBytes(
      record.request_bytes,
      PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
      `pilot-epoch-${index}-request`
    );
    const request = restorePlacementMembershipEpochRequest({
      capsule_bytes: capsuleBytes,
      prior_epoch_bytes: priorEpochBytes,
      request_bytes: requestBytes
    });
    const recreatedRequest = createPlacementMembershipEpochRequest({
      capsule_bytes: capsuleBytes,
      ceremony_bundle_bytes: bundleBytes,
      evaluated_at_ms: request.body.evaluated_at_ms,
      expires_at_ms: request.body.expires_at_ms,
      observer_policy: request.body.observer_policy,
      prior_epoch_bytes: priorEpochBytes,
      revoked_trust_root_ids: request.body.revoked_trust_root_ids
    });
    sameBytes(requestBytes, recreatedRequest.bytes, `epoch-${index}-request-bundles`);

    const approvalSources = copiedArray(
      record.approval_bytes,
      1,
      request.custodian_key_ids.length,
      `pilot-epoch-${index}-approvals`
    );
    const approvalBytes = new Array(approvalSources.length);
    const approvalReferences = new Array(approvalSources.length);
    for (let approvalIndex = 0; approvalIndex < approvalSources.length; approvalIndex += 1) {
      const bytes = ownedBytes(
        approvalSources[approvalIndex],
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.approval_bytes,
        `pilot-epoch-${index}-approval-${approvalIndex}`
      );
      const approval = restorePlacementMembershipEpochApproval({
        approval_bytes: bytes,
        capsule_bytes: capsuleBytes,
        prior_epoch_bytes: priorEpochBytes,
        request_bytes: requestBytes
      });
      approvalBytes[approvalIndex] = bytes;
      approvalReferences[approvalIndex] = reference(
        bytes,
        "approval_id",
        approval.approval_id
      );
    }
    const finalized = finalizePlacementMembershipEpochRequest({
      approval_bytes: approvalBytes,
      capsule_bytes: capsuleBytes,
      prior_epoch_bytes: priorEpochBytes,
      request_bytes: requestBytes
    });
    const candidateBytes = ownedBytes(
      record.epoch_bytes,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
      `pilot-epoch-${index}`
    );
    sameBytes(candidateBytes, finalized.bytes, `epoch-${index}-finalized-bytes`);
    if (setHas(seenEpochs, finalized.epoch_id)) {
      fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "duplicate-epoch-id");
    }
    setAdd(seenEpochs, finalized.epoch_id);
    contents[index] = freeze({
      approval_count: approvalBytes.length,
      approvals: sortedReferences(approvalReferences, "approval_id"),
      ceremony_bundles: sortedReferences(bundleReferences, "bundle_id"),
      custody_threshold: request.custody_threshold,
      epoch: request.body.epoch,
      epoch_artifact_digest: artifactDigest(candidateBytes),
      epoch_id: finalized.epoch_id,
      member_count: finalized.member_count,
      prior_epoch_id: request.body.prior_epoch_id,
      request_artifact_digest: artifactDigest(requestBytes),
      request_id: request.request_id
    });
    epochBytes[index] = candidateBytes;
    priorEpochBytes = candidateBytes;
  }
  for (let index = 0; index < ceremonies.length; index += 1) {
    if (!setHas(usedCeremonies, ceremonies[index].bundle_id)) {
      fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "unused-ceremony-bundle");
    }
  }
  return freeze({ contents: freeze(contents), epoch_bytes: freeze(epochBytes) });
}

function verifyDeployment(source, capsuleBytes, verifiedEpochs) {
  const value = exactRecord(source, [
    "acceptance_bytes",
    "activation_bytes",
    "attestation_bytes",
    "membership_bytes",
    "plan_bytes",
    "primary_ceremony_bundle_bytes",
    "view_bytes"
  ], "pilot-deployment");
  const planBytes = ownedBytes(
    value.plan_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "pilot-deployment-plan"
  );
  const plan = restorePlacementAdmissionDeploymentPlan(planBytes);
  const acceptanceSources = copiedArray(
    value.acceptance_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max,
    "pilot-deployment-acceptances"
  );
  const acceptanceBytes = new Array(acceptanceSources.length);
  const acceptanceReferences = new Array(acceptanceSources.length);
  for (let index = 0; index < acceptanceSources.length; index += 1) {
    const bytes = ownedBytes(
      acceptanceSources[index],
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes,
      `pilot-deployment-acceptance-${index}`
    );
    const acceptance = restorePlacementAdmissionDeploymentPlanAcceptance({
      acceptance_bytes: bytes,
      plan_bytes: planBytes
    });
    acceptanceBytes[index] = bytes;
    acceptanceReferences[index] = reference(bytes, "acceptance_id", acceptance.acceptance_id);
  }
  const activationBytes = ownedBytes(
    value.activation_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes,
    "pilot-deployment-activation"
  );
  const recreatedActivation = createPlacementAdmissionDeploymentPlanActivation({
    acceptance_bytes: acceptanceBytes,
    plan_bytes: planBytes
  });
  sameBytes(activationBytes, recreatedActivation.bytes, "deployment-activation-sidecars");
  const activation = restorePlacementAdmissionDeploymentPlanActivation(activationBytes);
  sameBytes(planBytes, activation.plan_bytes, "deployment-plan-activation");

  const primaryBundleBytes = ownedBytes(
    value.primary_ceremony_bundle_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.ceremony_bundle_bytes,
    "pilot-deployment-primary-bundle"
  );
  const primaryBundle = restorePlacementAdmissionCeremonyBundle(primaryBundleBytes);
  const latestBundles = verifiedEpochs.contents[verifiedEpochs.contents.length - 1]
    .ceremony_bundles;
  let primaryBundlePresent = false;
  for (let index = 0; index < latestBundles.length; index += 1) {
    if (
      latestBundles[index].bundle_id === primaryBundle.bundle_id &&
      latestBundles[index].artifact_digest === artifactDigest(primaryBundleBytes)
    ) primaryBundlePresent = true;
  }
  if (!primaryBundlePresent) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "deployment-primary-bundle-not-in-epoch");
  }

  const membershipBytes = ownedBytes(
    value.membership_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
    "pilot-deployment-membership"
  );
  const membership = verifyPlacementAdmissionDeploymentPlanMembership({
    capsule_bytes: capsuleBytes,
    membership_epoch_candidate_bytes: verifiedEpochs.epoch_bytes,
    membership_bytes: membershipBytes
  });
  sameBytes(activationBytes, membership.activation_bytes, "deployment-membership-activation");
  sameBytes(
    primaryBundleBytes,
    membership.ceremony_bundle_bytes,
    "deployment-membership-primary-bundle"
  );
  const latestEpoch = verifiedEpochs.contents[verifiedEpochs.contents.length - 1];
  if (membership.membership_epoch_id !== latestEpoch.epoch_id) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "deployment-membership-current-epoch");
  }

  const attestationSources = copiedArray(
    value.attestation_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_min,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_max,
    "pilot-deployment-attestations"
  );
  const attestationBytes = new Array(attestationSources.length);
  const attestationReferences = new Array(attestationSources.length);
  for (let index = 0; index < attestationSources.length; index += 1) {
    const bytes = ownedBytes(
      attestationSources[index],
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes,
      `pilot-deployment-attestation-${index}`
    );
    const attestation = restorePlacementAdmissionDeploymentAttestation(bytes);
    sameBytes(
      membershipBytes,
      attestation.deployment_plan_membership_bytes,
      `deployment-attestation-${index}-membership`
    );
    attestationBytes[index] = bytes;
    attestationReferences[index] = reference(
      bytes,
      "attestation_id",
      attestation.attestation_id
    );
  }
  const viewBytes = ownedBytes(
    value.view_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.view_bytes,
    "pilot-deployment-view"
  );
  const view = verifyPlacementAdmissionDeploymentAttestationView({
    attestation_bytes: attestationBytes,
    view_bytes: viewBytes
  });
  if (
    view.deployment_plan_activation_id !== membership.activation_id ||
    view.deployment_plan_id !== membership.plan_id ||
    view.deployment_plan_membership_id !== membership.membership_id ||
    view.membership_candidate_view_id !== membership.membership_candidate_view_id ||
    view.membership_epoch_id !== membership.membership_epoch_id
  ) fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "deployment-view-membership");
  return freeze({
    acceptances: sortedReferences(acceptanceReferences, "acceptance_id"),
    activation_artifact_digest: artifactDigest(activationBytes),
    activation_id: activation.activation_id,
    attestations: sortedReferences(attestationReferences, "attestation_id"),
    membership_artifact_digest: artifactDigest(membershipBytes),
    membership_candidate_view_id: membership.membership_candidate_view_id,
    membership_id: membership.membership_id,
    observation_ids: view.observation_ids,
    observer_key_ids: view.observer_key_ids,
    plan_artifact_digest: artifactDigest(planBytes),
    plan_id: plan.plan_id,
    primary_ceremony_bundle_artifact_digest: artifactDigest(primaryBundleBytes),
    primary_ceremony_bundle_id: primaryBundle.bundle_id,
    view_artifact_digest: artifactDigest(viewBytes),
    view_id: view.view_id
  });
}

function evidenceContent(sourceCommit, capsule, capsuleBytes, ceremonies, epochs, deployment) {
  return freeze({
    capsule_artifact_digest: artifactDigest(capsuleBytes),
    capsule_id: capsule.capsule_id,
    ceremonies,
    deployment,
    epochs: epochs.contents,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    lineage_head_hash: capsule.head_hash,
    lineage_organism_id: capsule.organism_id,
    non_authority: true,
    source_commit: sourceCommit,
    source_commit_execution_binding: "recorded-only",
    topology_authority: "unproven"
  });
}

function project(bytes, content, evidenceId, verified) {
  return freeze({
    bytes: new UINT8_ARRAY(bytes),
    capsule_id: content.capsule_id,
    epoch_count: content.epochs.length,
    evidence_id: evidenceId,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    public_chain_verified: verified,
    source_commit: content.source_commit,
    source_commit_execution_binding: "recorded-only",
    status: verified
      ? "placement-admission-pilot-public-chain-verified"
      : "placement-admission-pilot-evidence-restored",
    topology_authority: "unproven",
    view_id: content.deployment.view_id
  });
}

export function createPlacementAdmissionPilotEvidence(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "source_commit"
  ], "pilot-evidence-options");
  const sourceCommit = normalizedCommit(source.source_commit, "pilot-source-commit");
  const capsuleBytes = ownedBytes(
    source.capsule_bytes,
    PROTOCOL_PROFILE.provider.object_bytes,
    "pilot-capsule"
  );
  const capsule = verifyContinuityCapsule(capsuleBytes);
  const ceremonies = verifyCeremonyRecords(source.ceremony_records);
  const epochs = verifyEpochRecords(source.epoch_records, capsuleBytes, ceremonies);
  const deployment = verifyDeployment(source.deployment, capsuleBytes, epochs);
  const content = evidenceContent(
    sourceCommit,
    capsule,
    capsuleBytes,
    ceremonies,
    epochs,
    deployment
  );
  const evidenceId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ evidence_id: evidenceId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes) {
    fail("E_PLACEMENT_ADMISSION_PILOT_LIMIT", "pilot-evidence-bytes");
  }
  return project(bytes, content, evidenceId, true);
}

function normalizedReference(source, idName, idPattern, label) {
  const value = exactRecord(source, ["artifact_digest", idName], label);
  normalizedDigest(value.artifact_digest, `${label}-artifact-digest`);
  if (typeof value[idName] !== "string" || !regexpTest(idPattern, value[idName])) {
    fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-${idName}`);
  }
  return freeze({ artifact_digest: value.artifact_digest, [idName]: value[idName] });
}

function normalizedReferenceArray(source, idName, idPattern, minimum, maximum, label) {
  const values = copiedArray(source, minimum, maximum, label);
  const normalized = new Array(values.length);
  let prior = null;
  for (let index = 0; index < values.length; index += 1) {
    normalized[index] = normalizedReference(
      values[index],
      idName,
      idPattern,
      `${label}-${index}`
    );
    if (prior !== null && prior >= normalized[index][idName]) {
      fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `${label}-order`);
    }
    prior = normalized[index][idName];
  }
  return freeze(normalized);
}

function normalizedStringArray(source, pattern, minimum, maximum, label) {
  const values = copiedArray(source, minimum, maximum, label);
  const seen = createSet();
  for (let index = 0; index < values.length; index += 1) {
    if (
      typeof values[index] !== "string" ||
      !regexpTest(pattern, values[index]) ||
      setHas(seen, values[index])
    ) fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", label);
    setAdd(seen, values[index]);
  }
  return freeze(values);
}

function restoredCeremonies(source) {
  const values = copiedArray(
    source,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.ceremonies_max,
    "pilot-evidence-ceremonies"
  );
  const result = new Array(values.length);
  let prior = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = exactRecord(values[index], [
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
    for (const [name, candidate] of [
      ["bundle-artifact-digest", value.bundle_artifact_digest],
      ["bundle-id", value.bundle_id],
      ["issuer-role-response-artifact-digest", value.issuer_role_response_artifact_digest],
      ["issuer-role-response-id", value.issuer_role_response_id],
      ["request-artifact-digest", value.request_artifact_digest],
      ["subject-identity-artifact-digest", value.subject_identity_artifact_digest],
      ["subject-role-response-artifact-digest", value.subject_role_response_artifact_digest],
      ["subject-role-response-id", value.subject_role_response_id],
      ["trust-root-artifact-digest", value.trust_root_artifact_digest],
      ["trust-root-id", value.trust_root_id]
    ]) normalizedDigest(candidate, `pilot-evidence-ceremony-${index}-${name}`);
    normalizedKeyId(value.subject_key_id, `pilot-evidence-ceremony-${index}-subject-key-id`);
    if (prior !== null && prior >= value.bundle_id) {
      fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", "pilot-evidence-ceremony-order");
    }
    prior = value.bundle_id;
    result[index] = freeze({
      bundle_artifact_digest: value.bundle_artifact_digest,
      bundle_id: value.bundle_id,
      issuer_role_response_artifact_digest: value.issuer_role_response_artifact_digest,
      issuer_role_response_id: value.issuer_role_response_id,
      request_artifact_digest: value.request_artifact_digest,
      subject_identity_artifact_digest: value.subject_identity_artifact_digest,
      subject_key_id: value.subject_key_id,
      subject_role_response_artifact_digest: value.subject_role_response_artifact_digest,
      subject_role_response_id: value.subject_role_response_id,
      trust_root_artifact_digest: value.trust_root_artifact_digest,
      trust_root_id: value.trust_root_id
    });
  }
  return freeze(result);
}

function restoredEpochs(source) {
  const values = copiedArray(
    source,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max,
    "pilot-evidence-epochs"
  );
  const result = new Array(values.length);
  let priorId = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = exactRecord(values[index], [
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
    if (
      !numberIsSafeInteger(value.approval_count) || value.approval_count < 1 ||
      !numberIsSafeInteger(value.custody_threshold) || value.custody_threshold < 1 ||
      !numberIsSafeInteger(value.member_count) || value.member_count < 1 ||
      value.approval_count < value.custody_threshold ||
      typeof value.epoch !== "string" || !regexpTest(POSITIVE_DECIMAL, value.epoch) ||
      value.prior_epoch_id !== priorId
    ) fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `pilot-evidence-epoch-${index}-fields`);
    normalizedDigest(value.epoch_artifact_digest, `pilot-evidence-epoch-${index}-digest`);
    normalizedDigest(value.epoch_id, `pilot-evidence-epoch-${index}-id`);
    normalizedDigest(value.request_artifact_digest, `pilot-evidence-epoch-${index}-request-digest`);
    normalizedDigest(value.request_id, `pilot-evidence-epoch-${index}-request-id`);
    const approvals = normalizedReferenceArray(
      value.approvals,
      "approval_id",
      DIGEST,
      1,
      value.approval_count,
      `pilot-evidence-epoch-${index}-approvals`
    );
    if (approvals.length !== value.approval_count) {
      fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", `pilot-evidence-epoch-${index}-approval-count`);
    }
    result[index] = freeze({
      approval_count: value.approval_count,
      approvals,
      ceremony_bundles: normalizedReferenceArray(
        value.ceremony_bundles,
        "bundle_id",
        DIGEST,
        1,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundles_max,
        `pilot-evidence-epoch-${index}-bundles`
      ),
      custody_threshold: value.custody_threshold,
      epoch: value.epoch,
      epoch_artifact_digest: value.epoch_artifact_digest,
      epoch_id: value.epoch_id,
      member_count: value.member_count,
      prior_epoch_id: value.prior_epoch_id,
      request_artifact_digest: value.request_artifact_digest,
      request_id: value.request_id
    });
    priorId = value.epoch_id;
  }
  return freeze(result);
}

function restoredDeployment(source) {
  const value = exactRecord(source, [
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
  for (const [name, candidate] of [
    ["activation-artifact-digest", value.activation_artifact_digest],
    ["activation-id", value.activation_id],
    ["membership-artifact-digest", value.membership_artifact_digest],
    ["membership-candidate-view-id", value.membership_candidate_view_id],
    ["membership-id", value.membership_id],
    ["plan-artifact-digest", value.plan_artifact_digest],
    ["plan-id", value.plan_id],
    ["primary-bundle-artifact-digest", value.primary_ceremony_bundle_artifact_digest],
    ["primary-bundle-id", value.primary_ceremony_bundle_id],
    ["view-artifact-digest", value.view_artifact_digest],
    ["view-id", value.view_id]
  ]) normalizedDigest(candidate, `pilot-evidence-deployment-${name}`);
  const acceptances = normalizedReferenceArray(
    value.acceptances,
    "acceptance_id",
    DIGEST,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max,
    "pilot-evidence-deployment-acceptances"
  );
  const attestations = normalizedReferenceArray(
    value.attestations,
    "attestation_id",
    DIGEST,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_min,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_max,
    "pilot-evidence-deployment-attestations"
  );
  const observationIds = normalizedStringArray(
    value.observation_ids,
    DIGEST,
    attestations.length,
    attestations.length,
    "pilot-evidence-deployment-observation-ids"
  );
  const observerKeyIds = normalizedStringArray(
    value.observer_key_ids,
    KEY_ID,
    attestations.length,
    attestations.length,
    "pilot-evidence-deployment-observer-key-ids"
  );
  return freeze({
    acceptances,
    activation_artifact_digest: value.activation_artifact_digest,
    activation_id: value.activation_id,
    attestations,
    membership_artifact_digest: value.membership_artifact_digest,
    membership_candidate_view_id: value.membership_candidate_view_id,
    membership_id: value.membership_id,
    observation_ids: observationIds,
    observer_key_ids: observerKeyIds,
    plan_artifact_digest: value.plan_artifact_digest,
    plan_id: value.plan_id,
    primary_ceremony_bundle_artifact_digest: value.primary_ceremony_bundle_artifact_digest,
    primary_ceremony_bundle_id: value.primary_ceremony_bundle_id,
    view_artifact_digest: value.view_artifact_digest,
    view_id: value.view_id
  });
}

export function restorePlacementAdmissionPilotEvidence(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
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
  if (
    value.format !== FORMAT ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.non_authority !== true ||
    value.source_commit_execution_binding !== "recorded-only" ||
    value.topology_authority !== "unproven"
  ) fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", "pilot-evidence-envelope");
  if (
    typeof value.lineage_organism_id !== "string" ||
    !regexpTest(ORGANISM_ID, value.lineage_organism_id)
  ) fail("E_PLACEMENT_ADMISSION_PILOT_FORMAT", "pilot-evidence-organism-id");
  const content = freeze({
    capsule_artifact_digest: normalizedDigest(
      value.capsule_artifact_digest,
      "pilot-evidence-capsule-digest"
    ),
    capsule_id: normalizedDigest(value.capsule_id, "pilot-evidence-capsule-id"),
    ceremonies: restoredCeremonies(value.ceremonies),
    deployment: restoredDeployment(value.deployment),
    epochs: restoredEpochs(value.epochs),
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    lineage_head_hash: normalizedDigest(
      value.lineage_head_hash,
      "pilot-evidence-lineage-head"
    ),
    lineage_organism_id: value.lineage_organism_id,
    non_authority: true,
    source_commit: normalizedCommit(value.source_commit, "pilot-evidence-source-commit"),
    source_commit_execution_binding: "recorded-only",
    topology_authority: "unproven"
  });
  const evidenceId = domainHash(ID_DOMAIN, canonicalBytes(content));
  if (value.evidence_id !== evidenceId || !equalBytes(
    parsed.bytes,
    canonicalBytes({ evidence_id: evidenceId, ...content })
  )) fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "pilot-evidence-id");
  return project(parsed.bytes, content, evidenceId, false);
}

export function verifyPlacementAdmissionPilotEvidence(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "evidence_bytes",
    "expected_source_commit",
    "source_commit"
  ], "pilot-evidence-verification-options");
  const expected = normalizedCommit(
    source.expected_source_commit,
    "pilot-expected-source-commit"
  );
  const recorded = normalizedCommit(source.source_commit, "pilot-source-commit");
  if (expected !== recorded) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "source-commit");
  }
  const restored = restorePlacementAdmissionPilotEvidence(source.evidence_bytes);
  if (restored.source_commit !== expected) {
    fail("E_PLACEMENT_ADMISSION_PILOT_BINDING", "evidence-source-commit");
  }
  const recreated = createPlacementAdmissionPilotEvidence({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    source_commit: recorded
  });
  sameBytes(restored.bytes, recreated.bytes, "pilot-evidence-sidecars");
  return recreated;
}
