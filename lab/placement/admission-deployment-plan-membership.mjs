import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import { PROTOCOL_PROFILE } from "../../src/generated/protocol-profile.mjs";
import {
  arrayIncludes,
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
  snapshotOwnDataRecord,
  typedArraySet
} from "../../src/primordials.mjs";
import {
  convergePlacementMembershipEpochs,
  restorePlacementMembershipEpoch,
} from "../../src/placement/admission.mjs";
import { restorePlacementAdmissionCeremonyBundle } from "./admission-ceremony-client.mjs";
import {
  PlacementAdmissionDeploymentObservationError
} from "./admission-deployment-observer.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS,
  restorePlacementAdmissionDeploymentPlanActivation
} from "./admission-deployment-plan-activation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS,
  restorePlacementAdmissionDeploymentPlan
} from "./admission-deployment-plan.mjs";

const FORMAT = "mortalos-placement-admission-deployment-plan-membership/2";
const ID_DOMAIN = "MortalOS placement admission deployment plan membership v2";
const CANDIDATE_VIEW_DOMAIN =
  "MortalOS placement admission deployment membership candidate view v1";
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const ARRAY_CONSTRUCTOR = Array;
const NUMBER_CONSTRUCTOR = Number;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_FORMATS = freeze({
  membership: FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS = freeze({
  artifact_bytes: 6 * 1024 * 1024,
  ceremony_bundle_bytes: 2 * 1024 * 1024,
  membership_epoch_bytes: PROTOCOL_PROFILE.placement_admission.document_bytes
});

function fail(code, detail) {
  throw new PlacementAdmissionDeploymentObservationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_RUNTIME", "deployment-plan-membership-realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-shared-memory`);
  }
  let length;
  try {
    length = byteLengthOfBytes(source);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  if (length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", label);
  }
  const bytes = new UINT8_ARRAY(length);
  try {
    typedArraySet(bytes, new UINT8_ARRAY(source.buffer, source.byteOffset, length), 0);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return bytes;
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function digest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return value;
}

function encodedBytes(value, maximum, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  const decoded = decodeBase64Url(value);
  if (decoded === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return ownedBytes(decoded, maximum, label);
}

function integer(value, label) {
  if (typeof value !== "string" || !regexpTest(DECIMAL, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  const number = NUMBER_CONSTRUCTOR(value);
  if (!numberIsSafeInteger(number) || number < 0) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", label);
  }
  return number;
}

function sameIdentity(left, right) {
  return left.key_id === right.key_id && left.public_key === right.public_key;
}

function candidateView({ capsuleSource, candidateSources }) {
  requireRealm();
  const capsuleBytes = ownedBytes(
    capsuleSource,
    PROTOCOL_PROFILE.provider.object_bytes,
    "deployment-membership-capsule"
  );
  let sources;
  try {
    sources = copyOwnDataArray(candidateSources, "deployment-membership-candidates");
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-membership-candidates");
  }
  if (
    sources.length < 1 ||
    sources.length > PROTOCOL_PROFILE.placement_admission.members_per_epoch_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-membership-candidates");
  const entries = [];
  for (let index = 0; index < sources.length; index += 1) {
    const bytes = ownedBytes(
      sources[index],
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
      `deployment-membership-candidate-${index}`
    );
    const restored = restorePlacementMembershipEpoch(bytes);
    let duplicate = false;
    for (let existingIndex = 0; existingIndex < entries.length; existingIndex += 1) {
      if (entries[existingIndex].epoch_id !== restored.epoch_id) continue;
      if (!equalBytes(entries[existingIndex].bytes, restored.bytes)) {
        fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-membership-candidate-id");
      }
      duplicate = true;
      break;
    }
    if (!duplicate) arrayPush(entries, freeze({
      bytes: new UINT8_ARRAY(restored.bytes),
      epoch_id: restored.epoch_id
    }));
  }
  arraySort(entries, (left, right) => left.epoch_id < right.epoch_id ? -1 : 1);
  const convergenceCandidates = new ARRAY_CONSTRUCTOR(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    convergenceCandidates[index] = entries[index].bytes;
  }
  const convergence = convergePlacementMembershipEpochs({
    candidates: convergenceCandidates,
    capsule_bytes: capsuleBytes
  });
  if (convergence.status !== "converged" || convergence.epoch_bytes === null) {
    fail(
      "E_PLACEMENT_ADMISSION_DEPLOYMENT_CONVERGENCE",
      `deployment-membership-${convergence.reason ?? "halted"}`
    );
  }
  const candidateEpochIds = new ARRAY_CONSTRUCTOR(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    candidateEpochIds[index] = entries[index].epoch_id;
  }
  const viewBasis = freeze({
    candidate_epoch_ids: freeze(candidateEpochIds),
    selected_epoch_id: convergence.epoch_id
  });
  return freeze({
    candidate_epoch_ids: viewBasis.candidate_epoch_ids,
    candidate_view_id: domainHash(CANDIDATE_VIEW_DOMAIN, canonicalBytes(viewBasis)),
    capsule_bytes: capsuleBytes,
    epoch: restorePlacementMembershipEpoch(convergence.epoch_bytes)
  });
}

function restoredCandidateView(value, selectedEpochId) {
  let candidateEpochIds;
  try {
    candidateEpochIds = copyOwnDataArray(
      value.membership_candidate_epoch_ids,
      "deployment-membership-candidate-epoch-ids"
    );
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-membership-candidate-epoch-ids");
  }
  if (
    candidateEpochIds.length < 1 ||
    candidateEpochIds.length > PROTOCOL_PROFILE.placement_admission.members_per_epoch_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-membership-candidate-epoch-ids");
  let selected = false;
  for (let index = 0; index < candidateEpochIds.length; index += 1) {
    digest(candidateEpochIds[index], `deployment-membership-candidate-epoch-id-${index}`);
    if (index > 0 && candidateEpochIds[index - 1] >= candidateEpochIds[index]) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-membership-candidate-order");
    }
    if (candidateEpochIds[index] === selectedEpochId) selected = true;
  }
  if (!selected) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-membership-selected-candidate");
  }
  const viewBasis = freeze({
    candidate_epoch_ids: freeze(candidateEpochIds),
    selected_epoch_id: selectedEpochId
  });
  const candidateViewId = domainHash(CANDIDATE_VIEW_DOMAIN, canonicalBytes(viewBasis));
  if (
    digest(value.membership_candidate_view_id, "deployment-membership-candidate-view-id") !==
    candidateViewId
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-membership-candidate-view-id");
  return freeze({
    candidate_epoch_ids: viewBasis.candidate_epoch_ids,
    candidate_view_id: candidateViewId
  });
}

function bindMembership({ activation, bundle, epoch }) {
  const plan = restorePlacementAdmissionDeploymentPlan(activation.plan_bytes);
  if (
    plan.plan_id !== activation.plan_id ||
    plan.ceremony_bundle_id !== activation.ceremony_bundle_id ||
    bundle.bundle_id !== plan.ceremony_bundle_id
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-membership-ceremony-plan");

  const epochEvaluatedAt = integer(epoch.body.evaluated_at_ms, "deployment-membership-epoch-evaluated-at");
  const epochExpiresAt = integer(epoch.body.expires_at_ms, "deployment-membership-epoch-expires-at");
  if (plan.issued_at_ms < epochEvaluatedAt || plan.expires_at_ms > epochExpiresAt) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_TIME", "deployment-plan-outside-membership-epoch");
  }

  let subjectMember = null;
  const observerMembers = [];
  for (let index = 0; index < epoch.members.length; index += 1) {
    const member = epoch.members[index];
    if (member.evidence_id === bundle.evidence_id) subjectMember = member;
    if (arrayIncludes(member.roles, "observer")) arrayPush(observerMembers, member);
  }
  if (subjectMember === null || !sameIdentity(subjectMember.identity, bundle.subject.identity)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "ceremony-subject-not-admitted");
  }
  if (
    observerMembers.length < PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min ||
    observerMembers.length > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max ||
    observerMembers.length !== plan.observers.length
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-roster");

  arraySort(observerMembers, (left, right) => left.identity.key_id < right.identity.key_id
    ? -1
    : left.identity.key_id > right.identity.key_id ? 1 : 0);
  const operatorIds = createSet();
  const failureDomainIds = createSet();
  const observerKeyIds = new ARRAY_CONSTRUCTOR(observerMembers.length);
  for (let index = 0; index < observerMembers.length; index += 1) {
    const member = observerMembers[index];
    const assignment = plan.observers[index];
    if (
      !sameIdentity(member.identity, assignment.observer) ||
      member.operator_root_id !== assignment.declared_administration_id ||
      member.failure_domain_id !== assignment.declared_failure_domain_id
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-assignment");
    if (
      sameIdentity(member.identity, subjectMember.identity) ||
      member.operator_root_id === subjectMember.operator_root_id ||
      member.failure_domain_id === subjectMember.failure_domain_id ||
      setHas(operatorIds, member.operator_root_id) ||
      setHas(failureDomainIds, member.failure_domain_id)
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_POLICY", "deployment-plan-membership-independence");
    setAdd(operatorIds, member.operator_root_id);
    setAdd(failureDomainIds, member.failure_domain_id);
    observerKeyIds[index] = member.identity.key_id;
  }
  return freeze({
    observer_key_ids: freeze(observerKeyIds),
    plan,
    subject_evidence_id: bundle.evidence_id,
    subject_key_id: subjectMember.identity.key_id
  });
}

function content({ activation, bundle, candidate, epoch, binding }) {
  return freeze({
    activation_base64url: encodeBase64Url(activation.bytes),
    activation_id: activation.activation_id,
    ceremony_bundle_base64url: encodeBase64Url(bundle.bytes),
    ceremony_bundle_id: bundle.bundle_id,
    ceremony_evidence_id: binding.subject_evidence_id,
    format: FORMAT,
    lineage_capsule_id: epoch.body.lineage_capsule_id,
    lineage_head_hash: epoch.body.lineage_head_hash,
    membership_epoch_base64url: encodeBase64Url(epoch.bytes),
    membership_candidate_epoch_ids: candidate.candidate_epoch_ids,
    membership_candidate_view_id: candidate.candidate_view_id,
    membership_epoch_id: epoch.epoch_id,
    observer_key_ids: binding.observer_key_ids,
    plan_id: activation.plan_id
  });
}

function project(bytes, artifactContent, activation, bundle, candidate, epoch, binding, membershipId, status) {
  return freeze({
    activation_bytes: new UINT8_ARRAY(activation.bytes),
    activation_id: activation.activation_id,
    bytes: new UINT8_ARRAY(bytes),
    ceremony_bundle_bytes: new UINT8_ARRAY(bundle.bytes),
    ceremony_bundle_id: bundle.bundle_id,
    ceremony_evidence_id: binding.subject_evidence_id,
    lineage_capsule_id: artifactContent.lineage_capsule_id,
    lineage_head_hash: artifactContent.lineage_head_hash,
    membership_admitted: true,
    membership_bytes: new UINT8_ARRAY(epoch.bytes),
    membership_candidate_epoch_ids: candidate.candidate_epoch_ids,
    membership_candidate_view_id: candidate.candidate_view_id,
    membership_candidate_view_verified: status === "deployment-plan-membership-current",
    membership_current: status === "deployment-plan-membership-current",
    membership_epoch_id: epoch.epoch_id,
    membership_id: membershipId,
    observer_key_ids: binding.observer_key_ids,
    plan_bytes: new UINT8_ARRAY(activation.plan_bytes),
    plan_id: activation.plan_id,
    policy_scoped_administration: true,
    policy_scoped_failure_domains: true,
    physical_independence: "unproven",
    status,
    subject_key_id: binding.subject_key_id,
    sybil_resistance: "unproven"
  });
}

function restoreArtifact(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
    "deployment-plan-membership"
  );
  const value = exactRecord(parsed.value, [
    "activation_base64url",
    "activation_id",
    "ceremony_bundle_base64url",
    "ceremony_bundle_id",
    "ceremony_evidence_id",
    "format",
    "lineage_capsule_id",
    "lineage_head_hash",
    "membership_epoch_base64url",
    "membership_candidate_epoch_ids",
    "membership_candidate_view_id",
    "membership_epoch_id",
    "membership_id",
    "observer_key_ids",
    "plan_id"
  ], "deployment-plan-membership");
  if (value.format !== FORMAT) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-membership-format");
  }
  const activation = restorePlacementAdmissionDeploymentPlanActivation(encodedBytes(
    value.activation_base64url,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes,
    "deployment-plan-membership-activation"
  ));
  const bundle = restorePlacementAdmissionCeremonyBundle(encodedBytes(
    value.ceremony_bundle_base64url,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.ceremony_bundle_bytes,
    "deployment-plan-membership-ceremony"
  ));
  const epoch = restorePlacementMembershipEpoch(encodedBytes(
    value.membership_epoch_base64url,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
    "deployment-plan-membership-epoch"
  ));
  const candidate = restoredCandidateView(value, epoch.epoch_id);
  const binding = bindMembership({ activation, bundle, epoch });
  const expectedContent = content({ activation, bundle, candidate, epoch, binding });
  if (
    value.activation_id !== activation.activation_id ||
    value.ceremony_bundle_id !== bundle.bundle_id ||
    value.ceremony_evidence_id !== binding.subject_evidence_id ||
    value.lineage_capsule_id !== epoch.body.lineage_capsule_id ||
    value.lineage_head_hash !== epoch.body.lineage_head_hash ||
    value.membership_epoch_id !== epoch.epoch_id ||
    value.plan_id !== activation.plan_id
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-fields");
  let observerKeyIds;
  try {
    observerKeyIds = copyOwnDataArray(
      value.observer_key_ids,
      "deployment-plan-membership-observer-keys"
    );
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-membership-observer-keys");
  }
  if (observerKeyIds.length !== binding.observer_key_ids.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-fields");
  }
  for (let index = 0; index < observerKeyIds.length; index += 1) {
    if (observerKeyIds[index] !== binding.observer_key_ids[index]) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-fields");
    }
  }
  const membershipId = domainHash(ID_DOMAIN, canonicalBytes(expectedContent));
  if (digest(value.membership_id, "deployment-plan-membership-id") !== membershipId) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-id");
  }
  return {
    activation,
    binding,
    bundle,
    candidate,
    content: expectedContent,
    epoch,
    membershipId,
    parsed
  };
}

export function createPlacementAdmissionDeploymentPlanMembership(options) {
  requireRealm();
  const source = exactRecord(options, [
    "activation_bytes",
    "capsule_bytes",
    "ceremony_bundle_bytes",
    "membership_epoch_candidate_bytes"
  ], "deployment-plan-membership-options");
  const activation = restorePlacementAdmissionDeploymentPlanActivation(source.activation_bytes);
  const bundle = restorePlacementAdmissionCeremonyBundle(source.ceremony_bundle_bytes);
  const candidate = candidateView({
    capsuleSource: source.capsule_bytes,
    candidateSources: source.membership_epoch_candidate_bytes
  });
  const epoch = candidate.epoch;
  const binding = bindMembership({ activation, bundle, epoch });
  const artifactContent = content({ activation, bundle, candidate, epoch, binding });
  const membershipId = domainHash(ID_DOMAIN, canonicalBytes(artifactContent));
  const bytes = canonicalBytes({ membership_id: membershipId, ...artifactContent });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-membership-bytes");
  }
  const restored = restoreArtifact(bytes);
  return project(
    restored.parsed.bytes,
    restored.content,
    restored.activation,
    restored.bundle,
    candidate,
    restored.epoch,
    restored.binding,
    restored.membershipId,
    "deployment-plan-membership-current"
  );
}

export function restorePlacementAdmissionDeploymentPlanMembership(source) {
  const restored = restoreArtifact(source);
  return project(
    restored.parsed.bytes,
    restored.content,
    restored.activation,
    restored.bundle,
    restored.candidate,
    restored.epoch,
    restored.binding,
    restored.membershipId,
    "deployment-plan-membership-restored"
  );
}

export function verifyPlacementAdmissionDeploymentPlanMembership(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "membership_epoch_candidate_bytes",
    "membership_bytes"
  ], "deployment-plan-membership-verification-options");
  const restored = restoreArtifact(source.membership_bytes);
  const candidate = candidateView({
    capsuleSource: source.capsule_bytes,
    candidateSources: source.membership_epoch_candidate_bytes
  });
  if (
    !equalBytes(candidate.epoch.bytes, restored.epoch.bytes) ||
    candidate.candidate_view_id !== restored.candidate.candidate_view_id ||
    candidate.candidate_epoch_ids.length !== restored.candidate.candidate_epoch_ids.length
  ) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-epoch");
  }
  for (let index = 0; index < candidate.candidate_epoch_ids.length; index += 1) {
    if (candidate.candidate_epoch_ids[index] !== restored.candidate.candidate_epoch_ids[index]) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-membership-candidates");
    }
  }
  return project(
    restored.parsed.bytes,
    restored.content,
    restored.activation,
    restored.bundle,
    candidate,
    candidate.epoch,
    restored.binding,
    restored.membershipId,
    "deployment-plan-membership-current"
  );
}
