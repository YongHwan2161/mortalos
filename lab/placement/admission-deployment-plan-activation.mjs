import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { derivePeerId, verifyEd25519 } from "../../src/crypto.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  arraySort,
  copyOwnDataArray,
  createSet,
  freeze,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  setAdd,
  setHas,
  snapshotDataMethod,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord,
  typedArraySet
} from "../../src/primordials.mjs";
import {
  PlacementAdmissionDeploymentObservationError
} from "./admission-deployment-observer.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS,
  restorePlacementAdmissionDeploymentPlan,
  selectPlacementAdmissionDeploymentPlanAssignment
} from "./admission-deployment-plan.mjs";

const ACCEPTANCE_FORMAT = "mortalos-placement-admission-deployment-plan-acceptance/1";
const ACCEPTANCE_ID_DOMAIN = "MortalOS placement admission deployment plan acceptance v1";
const ACCEPTANCE_SIGNING_DOMAIN =
  "MortalOS placement admission deployment plan acceptance signature v1";
const ACTIVATION_FORMAT = "mortalos-placement-admission-deployment-plan-activation/1";
const ACTIVATION_ID_DOMAIN = "MortalOS placement admission deployment plan activation v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const SIGNATURE = /^ed25519:[A-Za-z0-9_-]{86}$/u;
const ARRAY_CONSTRUCTOR = Array;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_FORMATS = freeze({
  acceptance: ACCEPTANCE_FORMAT,
  activation: ACTIVATION_FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS = freeze({
  acceptance_bytes: 16 * 1024,
  activation_bytes: 512 * 1024
});

function fail(code, detail) {
  throw new PlacementAdmissionDeploymentObservationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_RUNTIME", "deployment-plan-activation-realm");
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

function snapshotObserver(source) {
  let identitySource;
  let sign;
  try {
    [identitySource] = snapshotNamedOwnDataValues(
      source,
      ["custodian"],
      "deployment-plan-acceptance-observer"
    );
    sign = snapshotDataMethod(
      source,
      "sign",
      "deployment-plan-acceptance-observer"
    );
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-plan-acceptance-observer");
  }
  return freeze({ identity: normalizedIdentity(identitySource, "deployment-plan-acceptance-observer"), sign });
}

function acceptanceContent(plan, observer) {
  return freeze({
    ceremony_bundle_id: plan.ceremony_bundle_id,
    format: ACCEPTANCE_FORMAT,
    non_authority: true,
    observer,
    plan_id: plan.plan_id
  });
}

function acceptanceMessage(acceptanceId) {
  return canonicalBytes({
    acceptance_id: acceptanceId,
    format: ACCEPTANCE_FORMAT,
    signature_domain: ACCEPTANCE_SIGNING_DOMAIN
  });
}

function projectAcceptance(bytes, content, acceptanceId, signature) {
  return freeze({
    acceptance_id: acceptanceId,
    bytes: new UINT8_ARRAY(bytes),
    ceremony_bundle_id: content.ceremony_bundle_id,
    non_authority: true,
    observer: content.observer,
    plan_id: content.plan_id,
    signature,
    status: "deployment-plan-acceptance-verified"
  });
}

export function restorePlacementAdmissionDeploymentPlanAcceptance(options) {
  requireRealm();
  const source = exactRecord(
    options,
    ["acceptance_bytes", "plan_bytes"],
    "deployment-plan-acceptance-restore-options"
  );
  const plan = restorePlacementAdmissionDeploymentPlan(ownedBytes(
    source.plan_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "deployment-plan-acceptance-plan"
  ));
  const parsed = parseCanonical(
    source.acceptance_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes,
    "deployment-plan-acceptance"
  );
  const value = exactRecord(parsed.value, [
    "acceptance_id",
    "ceremony_bundle_id",
    "format",
    "non_authority",
    "observer",
    "plan_id",
    "signature"
  ], "deployment-plan-acceptance");
  if (
    value.format !== ACCEPTANCE_FORMAT ||
    value.non_authority !== true ||
    typeof value.acceptance_id !== "string" ||
    !regexpTest(DIGEST, value.acceptance_id) ||
    typeof value.signature !== "string" ||
    !regexpTest(SIGNATURE, value.signature)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-acceptance-envelope");
  const observer = normalizedIdentity(value.observer, "deployment-plan-acceptance-observer");
  selectPlacementAdmissionDeploymentPlanAssignment({ observer, plan_bytes: plan.bytes });
  if (
    value.plan_id !== plan.plan_id ||
    value.ceremony_bundle_id !== plan.ceremony_bundle_id
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-acceptance-plan");
  const content = acceptanceContent(plan, observer);
  const acceptanceId = domainHash(ACCEPTANCE_ID_DOMAIN, canonicalBytes(content));
  if (acceptanceId !== value.acceptance_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-acceptance-id");
  }
  if (!verifyEd25519(observer.public_key, acceptanceMessage(acceptanceId), value.signature)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-plan-acceptance-signature");
  }
  return projectAcceptance(parsed.bytes, content, acceptanceId, value.signature);
}

export async function acceptPlacementAdmissionDeploymentPlan(options) {
  requireRealm();
  const source = exactRecord(
    options,
    ["observer", "plan_bytes"],
    "deployment-plan-acceptance-options"
  );
  const plan = restorePlacementAdmissionDeploymentPlan(ownedBytes(
    source.plan_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "deployment-plan-acceptance-plan"
  ));
  const observer = snapshotObserver(source.observer);
  selectPlacementAdmissionDeploymentPlanAssignment({
    observer: observer.identity,
    plan_bytes: plan.bytes
  });
  const content = acceptanceContent(plan, observer.identity);
  const acceptanceId = domainHash(ACCEPTANCE_ID_DOMAIN, canonicalBytes(content));
  const message = acceptanceMessage(acceptanceId);
  const tuple = `placement.admission.deployment.plan.${plan.ceremony_bundle_id.slice("sha256:".length)}`;
  const result = await observer.sign(freeze({ message: new UINT8_ARRAY(message), tuple }));
  requireRealm();
  const signatureResult = exactRecord(
    result,
    ["key_id", "signature"],
    "deployment-plan-acceptance-signature-result"
  );
  if (
    signatureResult.key_id !== observer.identity.key_id ||
    typeof signatureResult.signature !== "string" ||
    !regexpTest(SIGNATURE, signatureResult.signature) ||
    !verifyEd25519(observer.identity.public_key, message, signatureResult.signature)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", "deployment-plan-acceptance-signature-result");
  const bytes = canonicalBytes({
    acceptance_id: acceptanceId,
    ...content,
    signature: signatureResult.signature
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-acceptance-bytes");
  }
  return projectAcceptance(bytes, content, acceptanceId, signatureResult.signature);
}

function normalizedAcceptances(source, plan, mode) {
  let inputs;
  try {
    inputs = copyOwnDataArray(source, "deployment-plan-activation-acceptances");
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-activation-acceptances");
  }
  if (inputs.length !== plan.observers.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "incomplete-deployment-plan-acceptances");
  }
  const acceptances = new ARRAY_CONSTRUCTOR(inputs.length);
  for (let index = 0; index < inputs.length; index += 1) {
    const acceptanceBytes = mode === "restore"
      ? (typeof inputs[index] === "string" ? decodeBase64Url(inputs[index]) : null)
      : ownedBytes(
        inputs[index],
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes,
        `deployment-plan-activation-acceptance-${index}`
      );
    if (acceptanceBytes === null) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `deployment-plan-activation-acceptance-${index}`);
    }
    acceptances[index] = restorePlacementAdmissionDeploymentPlanAcceptance({
      acceptance_bytes: acceptanceBytes,
      plan_bytes: plan.bytes
    });
  }
  if (mode === "create") {
    arraySort(acceptances, (left, right) => left.observer.key_id < right.observer.key_id
      ? -1
      : left.observer.key_id > right.observer.key_id ? 1 : 0);
  }
  const observerIds = createSet();
  const encoded = new ARRAY_CONSTRUCTOR(acceptances.length);
  const acceptanceIds = new ARRAY_CONSTRUCTOR(acceptances.length);
  const observerKeyIds = new ARRAY_CONSTRUCTOR(acceptances.length);
  for (let index = 0; index < acceptances.length; index += 1) {
    const current = acceptances[index];
    const planned = plan.observers[index];
    if (
      current.observer.key_id !== planned.observer.key_id ||
      current.observer.public_key !== planned.observer.public_key ||
      setHas(observerIds, current.observer.key_id)
    ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-activation-roster");
    setAdd(observerIds, current.observer.key_id);
    encoded[index] = encodeBase64Url(current.bytes);
    acceptanceIds[index] = current.acceptance_id;
    observerKeyIds[index] = current.observer.key_id;
  }
  return freeze({
    acceptance_ids: freeze(acceptanceIds),
    acceptances: freeze(acceptances),
    encoded: freeze(encoded),
    observer_key_ids: freeze(observerKeyIds)
  });
}

function activationContent(plan, encodedAcceptances) {
  return freeze({
    acceptances_base64url: encodedAcceptances,
    format: ACTIVATION_FORMAT,
    non_authority: true,
    plan_base64url: encodeBase64Url(plan.bytes),
    plan_id: plan.plan_id
  });
}

function projectActivation(bytes, content, plan, accepted, activationId) {
  return freeze({
    acceptance_ids: accepted.acceptance_ids,
    activation_id: activationId,
    bytes: new UINT8_ARRAY(bytes),
    ceremony_bundle_id: plan.ceremony_bundle_id,
    non_authority: true,
    observer_key_ids: accepted.observer_key_ids,
    plan_bytes: new UINT8_ARRAY(plan.bytes),
    plan_id: plan.plan_id,
    status: "deployment-plan-activation-verified"
  });
}

export function createPlacementAdmissionDeploymentPlanActivation(options) {
  requireRealm();
  const source = exactRecord(
    options,
    ["acceptance_bytes", "plan_bytes"],
    "deployment-plan-activation-options"
  );
  const plan = restorePlacementAdmissionDeploymentPlan(ownedBytes(
    source.plan_bytes,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
    "deployment-plan-activation-plan"
  ));
  const accepted = normalizedAcceptances(source.acceptance_bytes, plan, "create");
  const content = activationContent(plan, accepted.encoded);
  const activationId = domainHash(ACTIVATION_ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ activation_id: activationId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "deployment-plan-activation-bytes");
  }
  return projectActivation(bytes, content, plan, accepted, activationId);
}

export function restorePlacementAdmissionDeploymentPlanActivation(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes,
    "deployment-plan-activation"
  );
  const value = exactRecord(parsed.value, [
    "acceptances_base64url",
    "activation_id",
    "format",
    "non_authority",
    "plan_base64url",
    "plan_id"
  ], "deployment-plan-activation");
  if (
    value.format !== ACTIVATION_FORMAT ||
    value.non_authority !== true ||
    typeof value.activation_id !== "string" ||
    !regexpTest(DIGEST, value.activation_id)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-activation-envelope");
  const planBytes = typeof value.plan_base64url === "string"
    ? decodeBase64Url(value.plan_base64url)
    : null;
  if (planBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-plan-activation-plan");
  }
  const plan = restorePlacementAdmissionDeploymentPlan(planBytes);
  if (value.plan_id !== plan.plan_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-activation-plan-id");
  }
  const accepted = normalizedAcceptances(value.acceptances_base64url, plan, "restore");
  const content = activationContent(plan, accepted.encoded);
  const activationId = domainHash(ACTIVATION_ID_DOMAIN, canonicalBytes(content));
  if (activationId !== value.activation_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "deployment-plan-activation-id");
  }
  return projectActivation(parsed.bytes, content, plan, accepted, activationId);
}

export function selectPlacementAdmissionDeploymentPlanActivationAssignment(options) {
  requireRealm();
  const source = exactRecord(
    options,
    ["activation_bytes", "observer"],
    "deployment-plan-activation-selection"
  );
  const observer = normalizedIdentity(source.observer, "deployment-plan-activation-observer");
  const activation = restorePlacementAdmissionDeploymentPlanActivation(source.activation_bytes);
  const assignment = selectPlacementAdmissionDeploymentPlanAssignment({
    observer,
    plan_bytes: activation.plan_bytes
  });
  return freeze({ activation, assignment });
}
