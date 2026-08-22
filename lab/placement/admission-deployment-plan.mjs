import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { derivePeerId } from "../../src/crypto.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
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
  snapshotOwnDataRecord,
  typedArraySet
} from "../../src/primordials.mjs";
import { restorePlacementAdmissionCeremonyBundle } from "./admission-ceremony-client.mjs";
import {
  PlacementAdmissionDeploymentObservationError,
  PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS,
  restorePlacementAdmissionDeploymentObservation
} from "./admission-deployment-observer.mjs";

const FORMAT = "mortalos-placement-admission-deployment-plan/1";
const ID_DOMAIN = "MortalOS placement admission deployment plan v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const ARRAY_CONSTRUCTOR = Array;
const NUMBER_MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_FORMATS = freeze({
  plan: FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS = freeze({
  observers_max: 8,
  observers_min: 2,
  plan_bytes: 256 * 1024,
  window_ms_max: 24 * 60 * 60 * 1000
});

function fail(code, detail) {
  throw new PlacementAdmissionDeploymentObservationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_RUNTIME", "deployment-plan-realm-integrity");
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

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
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
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", label);
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function normalizedInteger(value, label) {
  if (!numberIsSafeInteger(value) || value < 0) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return value;
}

function normalizedTimeout(value) {
  if (
    !numberIsSafeInteger(value) ||
    value < PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.timeout_ms_min ||
    value > PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.timeout_ms_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-timeout-ms");
  return value;
}

function normalizedNonce(source, label) {
  const nonce = ownedBytes(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes,
    label
  );
  if (nonce.byteLength !==
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return nonce;
}

function assignmentContent({
  declaredAdministrationId,
  declaredFailureDomainId,
  declaredVantageId,
  observer,
  observerNonce
}) {
  return freeze({
    declared_administration_id: declaredAdministrationId,
    declared_failure_domain_id: declaredFailureDomainId,
    declared_vantage_id: declaredVantageId,
    observer,
    observer_nonce_base64url: encodeBase64Url(observerNonce)
  });
}

function normalizedAssignment(source, label) {
  const value = exactRecord(source, [
    "declared_administration_id",
    "declared_failure_domain_id",
    "declared_vantage_id",
    "observer",
    "observer_nonce_base64url"
  ], label);
  const nonce = typeof value.observer_nonce_base64url === "string"
    ? decodeBase64Url(value.observer_nonce_base64url)
    : null;
  if (nonce === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-observer-nonce`);
  }
  return freeze({
    content: assignmentContent({
      declaredAdministrationId: normalizedDigest(
        value.declared_administration_id,
        `${label}-declared-administration-id`
      ),
      declaredFailureDomainId: normalizedDigest(
        value.declared_failure_domain_id,
        `${label}-declared-failure-domain-id`
      ),
      declaredVantageId: normalizedDigest(
        value.declared_vantage_id,
        `${label}-declared-vantage-id`
      ),
      observer: normalizedIdentity(value.observer, `${label}-observer`),
      observerNonce: normalizedNonce(nonce, `${label}-observer-nonce`)
    }),
    observer_nonce: new UINT8_ARRAY(nonce)
  });
}

function snapshotAssignment(source, label) {
  const value = exactRecord(source, [
    "declared_administration_id",
    "declared_failure_domain_id",
    "declared_vantage_id",
    "observer",
    "observer_nonce"
  ], label);
  const nonce = normalizedNonce(value.observer_nonce, `${label}-observer-nonce`);
  return freeze({
    content: assignmentContent({
      declaredAdministrationId: normalizedDigest(
        value.declared_administration_id,
        `${label}-declared-administration-id`
      ),
      declaredFailureDomainId: normalizedDigest(
        value.declared_failure_domain_id,
        `${label}-declared-failure-domain-id`
      ),
      declaredVantageId: normalizedDigest(
        value.declared_vantage_id,
        `${label}-declared-vantage-id`
      ),
      observer: normalizedIdentity(value.observer, `${label}-observer`),
      observerNonce: nonce
    }),
    observer_nonce: new UINT8_ARRAY(nonce)
  });
}

function normalizedAssignments(source, mode) {
  let inputs;
  try {
    inputs = copyOwnDataArray(source, "deployment-plan-observers");
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-observers");
  }
  if (
    inputs.length < PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min ||
    inputs.length > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-observers");
  const assignments = new ARRAY_CONSTRUCTOR(inputs.length);
  for (let index = 0; index < inputs.length; index += 1) {
    assignments[index] = mode === "create"
      ? snapshotAssignment(inputs[index], `deployment-plan-observer-${index}`)
      : normalizedAssignment(inputs[index], `deployment-plan-observer-${index}`);
  }
  if (mode === "create") {
    arraySort(assignments, (left, right) =>
      left.content.observer.key_id < right.content.observer.key_id
        ? -1
        : left.content.observer.key_id > right.content.observer.key_id ? 1 : 0);
  }
  const observerIds = createSet();
  const nonces = createSet();
  const vantageIds = createSet();
  const contents = new ARRAY_CONSTRUCTOR(assignments.length);
  for (let index = 0; index < assignments.length; index += 1) {
    const current = assignments[index];
    const keyId = current.content.observer.key_id;
    const nonce = current.content.observer_nonce_base64url;
    const vantage = current.content.declared_vantage_id;
    if (setHas(observerIds, keyId)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-deployment-plan-observer");
    }
    if (setHas(nonces, nonce)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-deployment-plan-nonce");
    }
    if (setHas(vantageIds, vantage)) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "duplicate-deployment-plan-vantage");
    }
    if (
      mode === "restore" && index > 0 &&
      assignments[index - 1].content.observer.key_id >= keyId
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-observer-order");
    setAdd(observerIds, keyId);
    setAdd(nonces, nonce);
    setAdd(vantageIds, vantage);
    contents[index] = current.content;
  }
  return freeze({ assignments: freeze(assignments), contents: freeze(contents) });
}

function normalizedWindow({ expiresAt, issuedAt, notBefore, timeout }) {
  if (
    issuedAt > notBefore ||
    notBefore > expiresAt ||
    expiresAt - issuedAt > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.window_ms_max ||
    notBefore > NUMBER_MAX_SAFE_INTEGER - timeout ||
    notBefore + timeout > expiresAt
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-window");
  return freeze({ expiresAt, issuedAt, notBefore, timeout });
}

function planContent({ ceremonyBundleId, observers, window }) {
  return freeze({
    ceremony_bundle_id: ceremonyBundleId,
    expires_at_ms: window.expiresAt,
    format: FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    issued_at_ms: window.issuedAt,
    non_authority: true,
    not_before_ms: window.notBefore,
    observers,
    timeout_ms: window.timeout
  });
}

function projectPlan(bytes, content, observerContents, planId) {
  return freeze({
    bytes: new UINT8_ARRAY(bytes),
    ceremony_bundle_id: content.ceremony_bundle_id,
    expires_at_ms: content.expires_at_ms,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    issued_at_ms: content.issued_at_ms,
    non_authority: true,
    not_before_ms: content.not_before_ms,
    observers: observerContents,
    plan_id: planId,
    status: "deployment-plan-verified",
    timeout_ms: content.timeout_ms
  });
}

export function createPlacementAdmissionDeploymentPlan(options) {
  requireRealm();
  const value = exactRecord(options, [
    "ceremony_bundle_bytes",
    "expires_at_ms",
    "issued_at_ms",
    "not_before_ms",
    "observers",
    "timeout_ms"
  ], "deployment-plan-options");
  const bundle = restorePlacementAdmissionCeremonyBundle(ownedBytes(
    value.ceremony_bundle_bytes,
    2 * 1024 * 1024,
    "deployment-plan-ceremony-bundle"
  ));
  const assignments = normalizedAssignments(value.observers, "create");
  const window = normalizedWindow({
    expiresAt: normalizedInteger(value.expires_at_ms, "deployment-plan-expires-at-ms"),
    issuedAt: normalizedInteger(value.issued_at_ms, "deployment-plan-issued-at-ms"),
    notBefore: normalizedInteger(value.not_before_ms, "deployment-plan-not-before-ms"),
    timeout: normalizedTimeout(value.timeout_ms)
  });
  const content = planContent({
    ceremonyBundleId: bundle.bundle_id,
    observers: assignments.contents,
    window
  });
  const planId = domainHash(ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ plan_id: planId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-bytes");
  }
  return projectPlan(bytes, content, assignments.contents, planId);
}

export function restorePlacementAdmissionDeploymentPlan(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "deployment-plan"
  );
  const value = exactRecord(parsed.value, [
    "ceremony_bundle_id",
    "expires_at_ms",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "issued_at_ms",
    "non_authority",
    "not_before_ms",
    "observers",
    "plan_id",
    "timeout_ms"
  ], "deployment-plan");
  if (
    value.format !== FORMAT ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.non_authority !== true ||
    typeof value.plan_id !== "string" ||
    !regexpTest(DIGEST, value.plan_id)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-envelope");
  const assignments = normalizedAssignments(value.observers, "restore");
  const window = normalizedWindow({
    expiresAt: normalizedInteger(value.expires_at_ms, "deployment-plan-expires-at-ms"),
    issuedAt: normalizedInteger(value.issued_at_ms, "deployment-plan-issued-at-ms"),
    notBefore: normalizedInteger(value.not_before_ms, "deployment-plan-not-before-ms"),
    timeout: normalizedTimeout(value.timeout_ms)
  });
  const content = planContent({
    ceremonyBundleId: normalizedDigest(value.ceremony_bundle_id, "deployment-plan-ceremony-id"),
    observers: assignments.contents,
    window
  });
  const planId = domainHash(ID_DOMAIN, canonicalBytes(content));
  if (planId !== value.plan_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-id");
  }
  return projectPlan(parsed.bytes, content, assignments.contents, planId);
}

export function selectPlacementAdmissionDeploymentPlanAssignment(options) {
  requireRealm();
  const value = exactRecord(
    options,
    ["observer", "plan_bytes"],
    "deployment-plan-selection"
  );
  const observer = normalizedIdentity(value.observer, "deployment-plan-selection-observer");
  const plan = restorePlacementAdmissionDeploymentPlan(value.plan_bytes);
  for (let index = 0; index < plan.observers.length; index += 1) {
    const current = plan.observers[index];
    if (current.observer.key_id === observer.key_id) {
      if (current.observer.public_key !== observer.public_key) {
        fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-plan-observer-key");
      }
      const nonce = decodeBase64Url(current.observer_nonce_base64url);
      if (nonce === null) {
        fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-observer-nonce");
      }
      return freeze({
        declared_administration_id: current.declared_administration_id,
        declared_failure_domain_id: current.declared_failure_domain_id,
        declared_vantage_id: current.declared_vantage_id,
        observer: current.observer,
        observer_nonce: new UINT8_ARRAY(nonce)
      });
    }
  }
  fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-plan-observer-roster");
}

export function verifyPlacementAdmissionDeploymentPlanObservation(options) {
  requireRealm();
  const value = exactRecord(options, [
    "attested_at_ms",
    "observation_bytes",
    "observer",
    "plan_bytes"
  ], "deployment-plan-observation-verification");
  const plan = restorePlacementAdmissionDeploymentPlan(value.plan_bytes);
  const observation = restorePlacementAdmissionDeploymentObservation(value.observation_bytes);
  const assignment = selectPlacementAdmissionDeploymentPlanAssignment({
    observer: value.observer,
    plan_bytes: plan.bytes
  });
  const attestedAt = normalizedInteger(value.attested_at_ms, "deployment-plan-attested-at-ms");
  if (
    observation.ceremony_bundle_id !== plan.ceremony_bundle_id ||
    observation.observed_at_ms < plan.not_before_ms ||
    observation.observed_at_ms > plan.expires_at_ms - plan.timeout_ms ||
    attestedAt < observation.observed_at_ms ||
    attestedAt > plan.expires_at_ms ||
    !equalBytes(observation.observer_nonce, assignment.observer_nonce)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-observation");
  return freeze({ assignment, attested_at_ms: attestedAt, plan });
}
