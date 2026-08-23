import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { derivePeerId, verifyEd25519 } from "../../src/crypto.mjs";
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
  setSize,
  snapshotDataMethod,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord,
  typedArraySet
} from "../../src/primordials.mjs";
import {
  PlacementAdmissionDeploymentObservationError,
  PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS,
  observePlacementAdmissionDeployment,
  restorePlacementAdmissionDeploymentObservation
} from "./admission-deployment-observer.mjs";
import {
  restorePlacementAdmissionDeploymentPlan,
  verifyPlacementAdmissionDeploymentPlanObservation
} from "./admission-deployment-plan.mjs";
import {
  selectPlacementAdmissionDeploymentPlanActivationAssignment
} from "./admission-deployment-plan-activation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS,
  restorePlacementAdmissionDeploymentPlanMembership,
  verifyPlacementAdmissionDeploymentPlanMembership
} from "./admission-deployment-plan-membership.mjs";

const FORMAT = "mortalos-placement-admission-deployment-attestation/5";
const ID_DOMAIN = "MortalOS placement admission deployment attestation v5";
const SIGNING_DOMAIN = "MortalOS placement admission deployment attestation signature v5";
const VIEW_FORMAT = "mortalos-placement-admission-deployment-attestation-view/1";
const VIEW_ID_DOMAIN = "MortalOS placement admission deployment attestation view v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const SIGNATURE = /^ed25519:[A-Za-z0-9_-]{86}$/u;
const ARRAY_CONSTRUCTOR = Array;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_FORMATS = freeze({
  attestation: FORMAT,
  view: VIEW_FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS = freeze({
  attestation_bytes: 12 * 1024 * 1024,
  attestations_per_view_max: 8,
  attestations_per_view_min: 2,
  view_bytes: PROTOCOL_PROFILE.placement_admission.document_bytes
});

function fail(code, detail) {
  throw new PlacementAdmissionDeploymentObservationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_RUNTIME", "attestation-realm-integrity");
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

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return value;
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

function ownedMembershipCandidates(source, label) {
  let candidates;
  try {
    candidates = copyOwnDataArray(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  if (
    candidates.length < 1 ||
    candidates.length > PROTOCOL_PROFILE.placement_admission.members_per_epoch_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", label);
  const owned = new ARRAY_CONSTRUCTOR(candidates.length);
  for (let index = 0; index < candidates.length; index += 1) {
    owned[index] = ownedBytes(
      candidates[index],
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
      `${label}-${index}`
    );
  }
  return freeze(owned);
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

function normalizedAttestedAt(value, observedAt) {
  if (!numberIsSafeInteger(value) || value < observedAt) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "attested-at-ms");
  }
  return value;
}

function normalizedObservedAt(value) {
  if (!numberIsSafeInteger(value) || value < 0) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "observed-at-ms");
  }
  return value;
}

function normalizedObserverIdentity(source) {
  const value = exactRecord(source, ["key_id", "public_key"], "deployment-observer-identity");
  if (
    typeof value.key_id !== "string" ||
    !regexpTest(KEY_ID, value.key_id) ||
    derivePeerId(value.public_key) !== value.key_id
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-observer-identity");
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function snapshotObserver(source) {
  let custodianSource;
  let sign;
  try {
    [custodianSource] = snapshotNamedOwnDataValues(
      source,
      ["custodian"],
      "deployment-observer-capability"
    );
    sign = snapshotDataMethod(source, "sign", "deployment-observer-capability");
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-observer-capability");
  }
  return freeze({
    identity: normalizedObserverIdentity(custodianSource),
    sign
  });
}

function attestationContent({
  attestedAt,
  declaredAdministrationId,
  declaredFailureDomainId,
  declaredVantageId,
  membership,
  observation,
  observerIdentity
}) {
  return freeze({
    attested_at_ms: attestedAt,
    declared_administration_id: declaredAdministrationId,
    declared_failure_domain_id: declaredFailureDomainId,
    declared_vantage_id: declaredVantageId,
    deployment_plan_activation_id: membership.activation_id,
    deployment_plan_id: membership.plan_id,
    deployment_plan_membership_base64url: encodeBase64Url(membership.bytes),
    deployment_plan_membership_id: membership.membership_id,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    membership_admitted: true,
    membership_candidate_view_id: membership.membership_candidate_view_id,
    membership_epoch_id: membership.membership_epoch_id,
    non_authority: true,
    observation_base64url: encodeBase64Url(observation.bytes),
    observation_id: observation.observation_id,
    observer: observerIdentity,
    requires_fresh_live_observation: true
  });
}

function signatureMessage(attestationId) {
  return canonicalBytes({
    attestation_id: attestationId,
    format: FORMAT,
    signature_domain: SIGNING_DOMAIN
  });
}

function createAttestationBytes(content, signature) {
  const attestationId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({
    attestation_id: attestationId,
    ...content,
    signature
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-attestation-bytes");
  }
  return freeze({ attestationId, bytes });
}

export function restorePlacementAdmissionDeploymentAttestation(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes,
    "deployment-attestation"
  );
  const value = exactRecord(parsed.value, [
    "attestation_id",
    "attested_at_ms",
    "declared_administration_id",
    "declared_failure_domain_id",
    "declared_vantage_id",
    "deployment_plan_activation_id",
    "deployment_plan_id",
    "deployment_plan_membership_base64url",
    "deployment_plan_membership_id",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "membership_admitted",
    "membership_candidate_view_id",
    "membership_epoch_id",
    "non_authority",
    "observation_base64url",
    "observation_id",
    "observer",
    "requires_fresh_live_observation",
    "signature"
  ], "deployment-attestation");
  if (
    value.format !== FORMAT ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.membership_admitted !== true ||
    value.non_authority !== true ||
    value.requires_fresh_live_observation !== true ||
    typeof value.attestation_id !== "string" ||
    !regexpTest(DIGEST, value.attestation_id) ||
    typeof value.signature !== "string" ||
    !regexpTest(SIGNATURE, value.signature)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-attestation-envelope");
  const observationBytes = decodeBase64Url(value.observation_base64url);
  if (observationBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-attestation-observation");
  }
  const observation = restorePlacementAdmissionDeploymentObservation(observationBytes);
  if (observation.observation_id !== value.observation_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-attestation-observation-id");
  }
  const membershipBytes = decodeBase64Url(value.deployment_plan_membership_base64url);
  if (membershipBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-attestation-plan-membership");
  }
  const membership = restorePlacementAdmissionDeploymentPlanMembership(membershipBytes);
  if (
    membership.activation_id !== value.deployment_plan_activation_id ||
    membership.plan_id !== value.deployment_plan_id ||
    membership.membership_id !== value.deployment_plan_membership_id ||
    membership.membership_candidate_view_id !== value.membership_candidate_view_id ||
    membership.membership_epoch_id !== value.membership_epoch_id
  ) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-attestation-plan-membership-id");
  }
  const observer = normalizedObserverIdentity(value.observer);
  const planned = verifyPlacementAdmissionDeploymentPlanObservation({
    attested_at_ms: value.attested_at_ms,
    observation_bytes: observation.bytes,
    observer,
    plan_bytes: membership.plan_bytes
  });
  const content = attestationContent({
    attestedAt: planned.attested_at_ms,
    declaredAdministrationId: planned.assignment.declared_administration_id,
    declaredFailureDomainId: planned.assignment.declared_failure_domain_id,
    declaredVantageId: planned.assignment.declared_vantage_id,
    membership,
    observation,
    observerIdentity: observer
  });
  const attestationId = domainHash(ID_DOMAIN, canonicalBytes(content));
  if (attestationId !== value.attestation_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-attestation-id");
  }
  if (!verifyEd25519(observer.public_key, signatureMessage(attestationId), value.signature)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-attestation-signature");
  }
  return freeze({
    attestation_id: attestationId,
    attested_at_ms: content.attested_at_ms,
    bytes: new UINT8_ARRAY(parsed.bytes),
    ceremony_bundle_id: observation.ceremony_bundle_id,
    declared_administration_id: content.declared_administration_id,
    declared_failure_domain_id: content.declared_failure_domain_id,
    declared_vantage_id: content.declared_vantage_id,
    deployment_plan_activation_bytes: new UINT8_ARRAY(membership.activation_bytes),
    deployment_plan_activation_id: membership.activation_id,
    deployment_plan_bytes: new UINT8_ARRAY(membership.plan_bytes),
    deployment_plan_id: membership.plan_id,
    deployment_plan_membership_bytes: new UINT8_ARRAY(membership.bytes),
    deployment_plan_membership_id: membership.membership_id,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    membership_admitted: true,
    membership_candidate_view_id: membership.membership_candidate_view_id,
    membership_epoch_id: membership.membership_epoch_id,
    non_authority: true,
    observation_id: observation.observation_id,
    observer,
    requires_fresh_live_observation: true,
    status: "attestation-verified"
  });
}

export async function attestPlacementAdmissionDeploymentObservation(options) {
  requireRealm();
  const source = exactRecord(options, [
    "attested_at_ms",
    "capsule_bytes",
    "deployment_plan_membership_bytes",
    "membership_epoch_candidate_bytes",
    "observation_bytes",
    "observer"
  ], "deployment-attestation-options");
  const capsuleBytes = ownedBytes(
    source.capsule_bytes,
    PROTOCOL_PROFILE.provider.object_bytes,
    "deployment-attestation-capsule"
  );
  const membershipEpochCandidateBytes = ownedMembershipCandidates(
    source.membership_epoch_candidate_bytes,
    "deployment-attestation-membership-candidates"
  );
  const observation = restorePlacementAdmissionDeploymentObservation(ownedBytes(
    source.observation_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observation_bytes,
    "deployment-attestation-observation"
  ));
  const membership = verifyPlacementAdmissionDeploymentPlanMembership({
    capsule_bytes: capsuleBytes,
    membership_epoch_candidate_bytes: membershipEpochCandidateBytes,
    membership_bytes: ownedBytes(
      source.deployment_plan_membership_bytes,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
      "deployment-attestation-plan-membership"
    )
  });
  const observer = snapshotObserver(source.observer);
  selectPlacementAdmissionDeploymentPlanActivationAssignment({
    activation_bytes: membership.activation_bytes,
    observer: observer.identity
  });
  const planned = verifyPlacementAdmissionDeploymentPlanObservation({
    attested_at_ms: source.attested_at_ms,
    observation_bytes: observation.bytes,
    observer: observer.identity,
    plan_bytes: membership.plan_bytes
  });
  const content = attestationContent({
    attestedAt: planned.attested_at_ms,
    declaredAdministrationId: planned.assignment.declared_administration_id,
    declaredFailureDomainId: planned.assignment.declared_failure_domain_id,
    declaredVantageId: planned.assignment.declared_vantage_id,
    membership,
    observation,
    observerIdentity: observer.identity
  });
  const attestationId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const message = signatureMessage(attestationId);
  const tuple = `placement.admission.deployment.attestation.${planned.plan.plan_id.slice("sha256:".length)}`;
  const signingPromise = observer.sign(freeze({
    message: new UINT8_ARRAY(message),
    tuple
  }));
  const result = await signingPromise;
  requireRealm();
  const signatureResult = exactRecord(
    result,
    ["key_id", "signature"],
    "deployment-attestation-signature-result"
  );
  if (
    signatureResult.key_id !== observer.identity.key_id ||
    typeof signatureResult.signature !== "string" ||
    !regexpTest(SIGNATURE, signatureResult.signature) ||
    !verifyEd25519(observer.identity.public_key, message, signatureResult.signature)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-attestation-signature-result");
  const created = createAttestationBytes(content, signatureResult.signature);
  const restored = restorePlacementAdmissionDeploymentAttestation(created.bytes);
  return freeze({
    attestation_id: restored.attestation_id,
    bytes: new UINT8_ARRAY(restored.bytes),
    deployment_plan_activation_id: restored.deployment_plan_activation_id,
    deployment_plan_id: restored.deployment_plan_id,
    deployment_plan_membership_id: restored.deployment_plan_membership_id,
    membership_admitted: true,
    membership_candidate_view_id: restored.membership_candidate_view_id,
    membership_epoch_id: restored.membership_epoch_id,
    non_authority: true,
    observation_id: restored.observation_id,
    observer: restored.observer,
    status: "attested"
  });
}

export async function observeAndAttestPlacementAdmissionDeployment(options) {
  requireRealm();
  const source = exactRecord(options, [
    "attested_at_ms",
    "capsule_bytes",
    "deployment_plan_membership_bytes",
    "membership_epoch_candidate_bytes",
    "observed_at_ms",
    "observation_journal",
    "observer",
    "possession_authorizations"
  ], "deployment-observe-and-attest-options");
  const capsuleBytes = ownedBytes(
    source.capsule_bytes,
    PROTOCOL_PROFILE.provider.object_bytes,
    "deployment-observe-and-attest-capsule"
  );
  const membershipEpochCandidateBytes = ownedMembershipCandidates(
    source.membership_epoch_candidate_bytes,
    "deployment-observe-and-attest-membership-candidates"
  );
  const membership = verifyPlacementAdmissionDeploymentPlanMembership({
    capsule_bytes: capsuleBytes,
    membership_epoch_candidate_bytes: membershipEpochCandidateBytes,
    membership_bytes: ownedBytes(
      source.deployment_plan_membership_bytes,
      PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
      "deployment-plan-membership"
    )
  });
  const plan = restorePlacementAdmissionDeploymentPlan(membership.plan_bytes);
  const observedAt = normalizedObservedAt(source.observed_at_ms);
  const attestedAt = normalizedAttestedAt(source.attested_at_ms, observedAt);
  const observer = snapshotObserver(source.observer);
  let publishObservation;
  try {
    publishObservation = snapshotDataMethod(
      source.observation_journal,
      "publish",
      "deployment-observation-journal-capability"
    );
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-observation-journal-capability");
  }
  const selection = selectPlacementAdmissionDeploymentPlanActivationAssignment({
    activation_bytes: membership.activation_bytes,
    observer: observer.identity
  });
  const assignment = selection.assignment;
  if (
    observedAt < plan.not_before_ms ||
    observedAt > plan.expires_at_ms - plan.timeout_ms ||
    attestedAt > plan.expires_at_ms
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-window");
  const observerFacade = freeze({
    custodian: observer.identity,
    sign: observer.sign
  });
  const observationPromise = observePlacementAdmissionDeployment({
    ceremony_bundle_bytes: membership.ceremony_bundle_bytes,
    observed_at_ms: observedAt,
    observer_nonce: assignment.observer_nonce,
    possession_authorizations: source.possession_authorizations,
    timeout_ms: plan.timeout_ms
  });
  const observation = await observationPromise;
  requireRealm();
  const publicationPromise = publishObservation(new UINT8_ARRAY(observation.bytes));
  await publicationPromise;
  requireRealm();
  return await attestPlacementAdmissionDeploymentObservation({
    attested_at_ms: attestedAt,
    capsule_bytes: capsuleBytes,
    deployment_plan_membership_bytes: membership.bytes,
    membership_epoch_candidate_bytes: membershipEpochCandidateBytes,
    observation_bytes: observation.bytes,
    observer: observerFacade
  });
}

export function evaluatePlacementAdmissionDeploymentAttestations(options) {
  requireRealm();
  const source = exactRecord(options, ["attestation_bytes"], "deployment-attestation-view-options");
  let inputs;
  try {
    inputs = copyOwnDataArray(source.attestation_bytes, "deployment-attestation-view-inputs");
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-attestation-view-inputs");
  }
  if (
    inputs.length <
      PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_min ||
    inputs.length > PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-attestation-view-inputs");
  const restored = new ARRAY_CONSTRUCTOR(inputs.length);
  const observerIds = createSet();
  const observationIds = createSet();
  const vantageIds = createSet();
  const administrationIds = createSet();
  const failureDomainIds = createSet();
  let ceremonyBundleId = null;
  let membership = null;
  for (let index = 0; index < inputs.length; index += 1) {
    const current = restorePlacementAdmissionDeploymentAttestation(inputs[index]);
    if (ceremonyBundleId === null) ceremonyBundleId = current.ceremony_bundle_id;
    if (current.ceremony_bundle_id !== ceremonyBundleId) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "mixed-ceremony-bundles");
    }
    if (membership === null) {
      membership = restorePlacementAdmissionDeploymentPlanMembership(
        current.deployment_plan_membership_bytes
      );
    }
    if (
      current.deployment_plan_activation_id !== membership.activation_id ||
      current.deployment_plan_id !== membership.plan_id ||
      current.deployment_plan_membership_id !== membership.membership_id ||
      current.membership_candidate_view_id !== membership.membership_candidate_view_id ||
      current.membership_epoch_id !== membership.membership_epoch_id
    ) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "mixed-deployment-plan-memberships");
    }
    if (setHas(observerIds, current.observer.key_id)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-deployment-observer");
    }
    if (setHas(observationIds, current.observation_id)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-deployment-observation");
    }
    if (setHas(vantageIds, current.declared_vantage_id)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-declared-vantage");
    }
    setAdd(observerIds, current.observer.key_id);
    setAdd(observationIds, current.observation_id);
    setAdd(vantageIds, current.declared_vantage_id);
    setAdd(administrationIds, current.declared_administration_id);
    setAdd(failureDomainIds, current.declared_failure_domain_id);
    restored[index] = current;
  }
  if (membership === null || restored.length !== membership.observer_key_ids.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "incomplete-deployment-plan-roster");
  }
  arraySort(restored, (left, right) => left.observer.key_id < right.observer.key_id
    ? -1
    : left.observer.key_id > right.observer.key_id ? 1 : 0);
  const attestationIds = new ARRAY_CONSTRUCTOR(restored.length);
  const declaredVantageIds = new ARRAY_CONSTRUCTOR(restored.length);
  const observationIdList = new ARRAY_CONSTRUCTOR(restored.length);
  const observerKeyIds = new ARRAY_CONSTRUCTOR(restored.length);
  for (let index = 0; index < restored.length; index += 1) {
    attestationIds[index] = restored[index].attestation_id;
    declaredVantageIds[index] = restored[index].declared_vantage_id;
    observationIdList[index] = restored[index].observation_id;
    observerKeyIds[index] = restored[index].observer.key_id;
  }
  return freeze({
    attestation_count: restored.length,
    attestation_ids: freeze(attestationIds),
    ceremony_bundle_id: ceremonyBundleId,
    declared_administration_ids_distinct: setSize(administrationIds) === restored.length,
    declared_failure_domain_ids_distinct: setSize(failureDomainIds) === restored.length,
    declared_vantage_ids: freeze(declaredVantageIds),
    deployment_plan_activation_id: membership.activation_id,
    deployment_plan_id: membership.plan_id,
    deployment_plan_membership_id: membership.membership_id,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    membership_admitted: true,
    membership_candidate_view_id: membership.membership_candidate_view_id,
    membership_epoch_id: membership.membership_epoch_id,
    non_authority: true,
    observation_ids: freeze(observationIdList),
    observer_key_ids: freeze(observerKeyIds),
    status: "consistent-attested-observations"
  });
}

function normalizedViewArray(source, count, pattern, label, sorted = false) {
  let values;
  try {
    values = copyOwnDataArray(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  if (values.length !== count) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  const seen = createSet();
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (
      typeof current !== "string" ||
      !regexpTest(pattern, current) ||
      setHas(seen, current) ||
      (sorted && index > 0 && values[index - 1] >= current)
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
    setAdd(seen, current);
  }
  return freeze(values);
}

function attestationViewContent(view) {
  return freeze({
    attestation_count: view.attestation_count,
    attestation_ids: view.attestation_ids,
    ceremony_bundle_id: view.ceremony_bundle_id,
    declared_administration_ids_distinct: view.declared_administration_ids_distinct,
    declared_failure_domain_ids_distinct: view.declared_failure_domain_ids_distinct,
    declared_vantage_ids: view.declared_vantage_ids,
    deployment_plan_activation_id: view.deployment_plan_activation_id,
    deployment_plan_id: view.deployment_plan_id,
    deployment_plan_membership_id: view.deployment_plan_membership_id,
    format: VIEW_FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    membership_admitted: true,
    membership_candidate_view_id: view.membership_candidate_view_id,
    membership_epoch_id: view.membership_epoch_id,
    non_authority: true,
    observation_ids: view.observation_ids,
    observer_key_ids: view.observer_key_ids
  });
}

function projectAttestationView(bytes, content, viewId, attestationsVerified) {
  return freeze({
    attestation_count: content.attestation_count,
    attestation_ids: content.attestation_ids,
    attestations_verified: attestationsVerified,
    bytes: new UINT8_ARRAY(bytes),
    ceremony_bundle_id: content.ceremony_bundle_id,
    declared_administration_ids_distinct: content.declared_administration_ids_distinct,
    declared_failure_domain_ids_distinct: content.declared_failure_domain_ids_distinct,
    declared_vantage_ids: content.declared_vantage_ids,
    deployment_plan_activation_id: content.deployment_plan_activation_id,
    deployment_plan_id: content.deployment_plan_id,
    deployment_plan_membership_id: content.deployment_plan_membership_id,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    membership_admitted: true,
    membership_candidate_view_id: content.membership_candidate_view_id,
    membership_epoch_id: content.membership_epoch_id,
    non_authority: true,
    observation_ids: content.observation_ids,
    observer_key_ids: content.observer_key_ids,
    status: attestationsVerified
      ? "deployment-attestation-view-verified"
      : "deployment-attestation-view-restored",
    view_id: viewId
  });
}

export function createPlacementAdmissionDeploymentAttestationView(options) {
  requireRealm();
  const view = evaluatePlacementAdmissionDeploymentAttestations(options);
  const content = attestationViewContent(view);
  const viewId = domainHash(VIEW_ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ view_id: viewId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.view_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-attestation-view-bytes");
  }
  return projectAttestationView(bytes, content, viewId, true);
}

export function restorePlacementAdmissionDeploymentAttestationView(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.view_bytes,
    "deployment-attestation-view"
  );
  const value = exactRecord(parsed.value, [
    "attestation_count",
    "attestation_ids",
    "ceremony_bundle_id",
    "declared_administration_ids_distinct",
    "declared_failure_domain_ids_distinct",
    "declared_vantage_ids",
    "deployment_plan_activation_id",
    "deployment_plan_id",
    "deployment_plan_membership_id",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "membership_admitted",
    "membership_candidate_view_id",
    "membership_epoch_id",
    "non_authority",
    "observation_ids",
    "observer_key_ids",
    "view_id"
  ], "deployment-attestation-view");
  if (
    value.format !== VIEW_FORMAT ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.membership_admitted !== true ||
    value.non_authority !== true ||
    typeof value.declared_administration_ids_distinct !== "boolean" ||
    typeof value.declared_failure_domain_ids_distinct !== "boolean" ||
    !numberIsSafeInteger(value.attestation_count) ||
    value.attestation_count < PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS
      .attestations_per_view_min ||
    value.attestation_count > PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS
      .attestations_per_view_max ||
    typeof value.view_id !== "string" ||
    !regexpTest(DIGEST, value.view_id)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-attestation-view-envelope");
  const count = value.attestation_count;
  const content = attestationViewContent({
    attestation_count: count,
    attestation_ids: normalizedViewArray(
      value.attestation_ids,
      count,
      DIGEST,
      "deployment-attestation-view-attestation-ids"
    ),
    ceremony_bundle_id: normalizedDigest(
      value.ceremony_bundle_id,
      "deployment-attestation-view-ceremony-id"
    ),
    declared_administration_ids_distinct: value.declared_administration_ids_distinct,
    declared_failure_domain_ids_distinct: value.declared_failure_domain_ids_distinct,
    declared_vantage_ids: normalizedViewArray(
      value.declared_vantage_ids,
      count,
      DIGEST,
      "deployment-attestation-view-vantage-ids"
    ),
    deployment_plan_activation_id: normalizedDigest(
      value.deployment_plan_activation_id,
      "deployment-attestation-view-activation-id"
    ),
    deployment_plan_id: normalizedDigest(
      value.deployment_plan_id,
      "deployment-attestation-view-plan-id"
    ),
    deployment_plan_membership_id: normalizedDigest(
      value.deployment_plan_membership_id,
      "deployment-attestation-view-membership-id"
    ),
    membership_candidate_view_id: normalizedDigest(
      value.membership_candidate_view_id,
      "deployment-attestation-view-candidate-view-id"
    ),
    membership_epoch_id: normalizedDigest(
      value.membership_epoch_id,
      "deployment-attestation-view-membership-epoch-id"
    ),
    observation_ids: normalizedViewArray(
      value.observation_ids,
      count,
      DIGEST,
      "deployment-attestation-view-observation-ids"
    ),
    observer_key_ids: normalizedViewArray(
      value.observer_key_ids,
      count,
      KEY_ID,
      "deployment-attestation-view-observer-key-ids",
      true
    )
  });
  const viewId = domainHash(VIEW_ID_DOMAIN, canonicalBytes(content));
  if (viewId !== value.view_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-attestation-view-id");
  }
  return projectAttestationView(parsed.bytes, content, viewId, false);
}

export function verifyPlacementAdmissionDeploymentAttestationView(options) {
  requireRealm();
  const source = exactRecord(options, [
    "attestation_bytes",
    "view_bytes"
  ], "deployment-attestation-view-verification-options");
  const restored = restorePlacementAdmissionDeploymentAttestationView(source.view_bytes);
  const created = createPlacementAdmissionDeploymentAttestationView({
    attestation_bytes: source.attestation_bytes
  });
  if (!equalBytes(restored.bytes, created.bytes)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-attestation-view-sidecars");
  }
  return created;
}
