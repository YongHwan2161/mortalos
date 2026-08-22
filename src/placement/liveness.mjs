import {
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  isSharedByteView,
  utf8Bytes
} from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import { domainHash } from "../confidential/format.mjs";
import { derivePeerId, deriveResourceExecutionWorkloadId, verifyEd25519 } from "../crypto.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import { verifyResourceLease, verifyResourceOffer } from "../resource-contract.mjs";
import { verifyResourceStoragePossessionProof } from "../resource-execution.mjs";
import {
  derivePlacementObserverRoster,
  derivePlacementObserverRosterFromEpoch,
  restorePlacementMembershipEpoch,
  verifyPlacementMembershipEpoch
} from "./admission.mjs";
import {
  copyOwnDataArray,
  createMap,
  createSet,
  mapGet,
  mapKeys,
  mapSet,
  mapValues,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  setAdd,
  setHas,
  setSize,
  setValues,
  snapshotOwnDataRecord
} from "../primordials.mjs";

export const PLACEMENT_LIVENESS_FORMATS = Object.freeze({
  certificate: "mortalos-placement-failure-certificate/1",
  certificate_policy: "mortalos-placement-failure-certificate/2",
  challenge: "mortalos-placement-liveness-challenge/1",
  challenge_policy: "mortalos-placement-liveness-challenge/2",
  observation: "mortalos-placement-liveness-observation/1",
  policy: "mortalos-placement-liveness-policy/1",
  policy_admitted: "mortalos-placement-liveness-policy/2",
  response: "mortalos-placement-liveness-response/1",
  response_possession: "mortalos-placement-liveness-response/2"
});

export const PLACEMENT_LIVENESS_RESPONSE_PROFILES = Object.freeze({
  execution_receipt_pointer: "execution-receipt-pointer/1",
  storage_merkle_sample: "storage-merkle-sample/1"
});

export const PLACEMENT_LIVENESS_LIMITS = PROTOCOL_PROFILE.placement_liveness;

const DOMAINS = Object.freeze({
  certificate: "MortalOS placement failure certificate v1",
  certificatePolicy: "MortalOS placement failure certificate v2",
  challenge: "MortalOS placement liveness challenge v1",
  challengeSignature: "MortalOS placement liveness challenge signature v1\0",
  challengePolicy: "MortalOS placement liveness challenge v2",
  challengePolicySignature: "MortalOS placement liveness challenge signature v2\0",
  observation: "MortalOS placement liveness observation v1",
  observationSignature: "MortalOS placement liveness observation signature v1\0",
  observerPolicy: "MortalOS placement liveness observer policy v1",
  policy: "MortalOS placement liveness policy v1",
  policyAdmitted: "MortalOS placement liveness policy v2",
  policyAdmittedSignature: "MortalOS placement liveness policy signature v2\0",
  policySignature: "MortalOS placement liveness policy signature v1\0",
  response: "MortalOS placement liveness response v1",
  responsePossession: "MortalOS placement liveness response v2",
  responsePossessionSignature: "MortalOS placement liveness response signature v2\0",
  responseSignature: "MortalOS placement liveness response signature v1\0"
});
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const LEASE_ID = /^resource-lease:[A-Za-z0-9_-]{43}$/u;
const PEER_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const PUBLIC_KEY = /^ed25519:[A-Za-z0-9_-]{43}$/u;
const RECEIPT_ID = /^resource-execution:[A-Za-z0-9_-]{43}$/u;
const WORKLOAD_ID = /^resource-workload:[A-Za-z0-9_-]{43}$/u;

export class PlacementLivenessError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementLivenessError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementLivenessError(code, detail);
}

function assertPlacementLivenessRealm() {
  if (!realmIntrinsicsIntact()) fail("E_PLACEMENT_LIVENESS_RUNTIME", "realm-integrity");
  if (
    !Number.isSafeInteger(PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy) ||
    PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy < 1 ||
    PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy !==
      PROTOCOL_PROFILE.resource_contract.witnesses_per_offer_max ||
    !Number.isSafeInteger(PLACEMENT_LIVENESS_LIMITS.observations_per_certificate) ||
    PLACEMENT_LIVENESS_LIMITS.observations_per_certificate <
      PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy
  ) fail("E_PLACEMENT_LIVENESS_PROFILE", "witness-ceiling-drift");
}

function exactKeys(value, expected, label) {
  assertPlacementLivenessRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-ordinary-own-data`);
  }
  assertPlacementLivenessRealm();
  const actual = ownKeys(descriptors);
  if (actual.some((key) => typeof key !== "string")) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-keys`);
  }
  actual.sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-keys`);
  }
  const snapshot = {};
  for (const key of expected) {
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-keys`);
    snapshot[key] = entry.value;
  }
  return Object.freeze(snapshot);
}

function ownedBytes(value, label) {
  if (isSharedByteView(value)) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > PLACEMENT_LIVENESS_LIMITS.document_bytes) {
    fail("E_PLACEMENT_LIVENESS_LIMIT", label);
  }
  return new Uint8Array(value);
}

function parseCanonical(value, label) {
  const bytes = ownedBytes(value, label);
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, {
      maxBytes: PLACEMENT_LIVENESS_LIMITS.document_bytes,
      maxDepth: 32
    });
  } catch {
    fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, parsed)) fail("E_PLACEMENT_LIVENESS_FORMAT", `${label}-canonical`);
  return Object.freeze({ bytes, value: parsed });
}

function decimal(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", label);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail("E_PLACEMENT_LIVENESS_LIMIT", label);
  }
  return parsed;
}

function identity(value, label) {
  const source = exactKeys(value, ["key_id", "public_key"], label);
  if (
    !PEER_ID.test(source.key_id) ||
    !PUBLIC_KEY.test(source.public_key) ||
    derivePeerId(source.public_key) !== source.key_id
  ) fail("E_PLACEMENT_LIVENESS_IDENTITY", label);
  return Object.freeze({ key_id: source.key_id, public_key: source.public_key });
}

function nonce(value) {
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.byteLength !== PLACEMENT_LIVENESS_LIMITS.nonce_bytes) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "nonce");
  }
  return value;
}

function idMessage(domain, identifier) {
  if (!DIGEST.test(identifier)) fail("E_PLACEMENT_LIVENESS_BINDING", "identifier");
  return concatBytes(utf8Bytes(domain), decodeBase64Url(identifier.slice("sha256:".length)));
}

function challengeTuple(body) {
  return [
    body.lineage_parent_hash,
    body.manifest_id,
    body.shard_index,
    body.lease_id,
    body.workload_id,
    body.previous_execution_receipt_id,
    body.failure_sequence
  ].join("|");
}

function observerPolicy(value, provider, consumer) {
  const source = exactKeys(
    value,
    ["max_faulty", "observers", "threshold"],
    "observer-policy"
  );
  let observerSources;
  try {
    observerSources = copyOwnDataArray(source.observers, "observer-policy-observers");
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "observer-policy-observers");
  }
  assertPlacementLivenessRealm();
  if (
    !Number.isSafeInteger(source.max_faulty) || source.max_faulty < 0 ||
    !Number.isSafeInteger(source.threshold) || source.threshold < 1 ||
    observerSources.length < 1 ||
    observerSources.length > PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy
  ) fail("E_PLACEMENT_LIVENESS_POLICY", "observer-policy-bounds");
  const observers = observerSources.map((entry, index) => identity(entry, `observer-${index}`));
  const ids = observers.map(({ key_id: id }) => id);
  const distinctIds = createSet();
  for (const id of ids) setAdd(distinctIds, id);
  if (
    setSize(distinctIds) !== ids.length ||
    ids.includes(provider.key_id) || ids.includes(consumer.key_id) ||
    observers.length < 3 * source.max_faulty + 1 ||
    source.threshold > observers.length - source.max_faulty ||
    2 * source.threshold <= observers.length + source.max_faulty
  ) fail("E_PLACEMENT_LIVENESS_POLICY", "observer-policy-byzantine-bound");
  observers.sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  return Object.freeze({
    max_faulty: source.max_faulty,
    observers: Object.freeze(observers),
    threshold: source.threshold
  });
}

const POLICY_PARAMETER_KEYS = Object.freeze([
  "failure_sequence",
  "lineage_parent_hash",
  "manifest_id",
  "response_proof_profile",
  "response_window_ms",
  "shard_index",
  "workload_id"
]);

const POLICY_BODY_KEYS = Object.freeze([
  "consumer",
  "failure_sequence",
  "lease_id",
  "lineage_parent_hash",
  "manifest_id",
  "observer_policy",
  "observer_policy_id",
  "offer_id",
  "provider",
  "response_proof_profile",
  "response_window_ms",
  "shard_index",
  "workload_id"
]);

const ADMITTED_POLICY_PARAMETER_KEYS = Object.freeze([
  ...POLICY_PARAMETER_KEYS,
  "membership_evaluated_at_ms"
]);

const ADMITTED_POLICY_BODY_KEYS = Object.freeze([
  ...POLICY_BODY_KEYS,
  "membership_epoch_id",
  "membership_evaluated_at_ms",
  "membership_selection_digest",
  "prior_membership_epoch_id"
]);

function sameCanonicalValue(left, right) {
  return encodeBase64Url(canonicalBytes(left)) === encodeBase64Url(canonicalBytes(right));
}

function policyParameters(value) {
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, "policy-parameters");
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "policy-parameters-ordinary-own-data");
  }
  assertPlacementLivenessRealm();
  if (ownDataRecordEntry(descriptors, "offer_id").present) {
    const expanded = exactKeys(value, POLICY_BODY_KEYS, "policy-body");
    value = {
      failure_sequence: expanded.failure_sequence,
      lineage_parent_hash: expanded.lineage_parent_hash,
      manifest_id: expanded.manifest_id,
      response_proof_profile: expanded.response_proof_profile,
      response_window_ms: expanded.response_window_ms,
      shard_index: expanded.shard_index,
      workload_id: expanded.workload_id
    };
  }
  const source = exactKeys(value, POLICY_PARAMETER_KEYS, "policy-parameters");
  decimal(source.failure_sequence, "failure-sequence", 1);
  if (!DIGEST.test(source.lineage_parent_hash) || !DIGEST.test(source.manifest_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "lineage-or-manifest");
  }
  if (!Number.isSafeInteger(source.shard_index) || source.shard_index < 0 || source.shard_index > 2) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "shard-index");
  }
  if (!WORKLOAD_ID.test(source.workload_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "workload");
  }
  decimal(
    source.response_window_ms,
    "response-window-ms",
    1,
    Number(PLACEMENT_LIVENESS_LIMITS.response_window_ms_max)
  );
  if (![
    PLACEMENT_LIVENESS_RESPONSE_PROFILES.execution_receipt_pointer,
    PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample
  ].includes(source.response_proof_profile)) {
    fail("E_PLACEMENT_LIVENESS_POLICY", "response-proof-profile");
  }
  return Object.freeze({ ...source });
}

function admittedPolicyParameters(value) {
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, "admitted-policy-parameters");
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "admitted-policy-parameters-ordinary-own-data");
  }
  assertPlacementLivenessRealm();
  if (ownDataRecordEntry(descriptors, "offer_id").present) {
    const expanded = exactKeys(value, ADMITTED_POLICY_BODY_KEYS, "admitted-policy-body");
    value = {
      failure_sequence: expanded.failure_sequence,
      lineage_parent_hash: expanded.lineage_parent_hash,
      manifest_id: expanded.manifest_id,
      membership_evaluated_at_ms: expanded.membership_evaluated_at_ms,
      response_proof_profile: expanded.response_proof_profile,
      response_window_ms: expanded.response_window_ms,
      shard_index: expanded.shard_index,
      workload_id: expanded.workload_id
    };
  }
  const source = exactKeys(value, ADMITTED_POLICY_PARAMETER_KEYS, "admitted-policy-parameters");
  const base = policyParameters({
    failure_sequence: source.failure_sequence,
    lineage_parent_hash: source.lineage_parent_hash,
    manifest_id: source.manifest_id,
    response_proof_profile: source.response_proof_profile,
    response_window_ms: source.response_window_ms,
    shard_index: source.shard_index,
    workload_id: source.workload_id
  });
  decimal(source.membership_evaluated_at_ms, "membership-evaluated-at-ms");
  return Object.freeze({ ...base, membership_evaluated_at_ms: source.membership_evaluated_at_ms });
}

function resourcePolicyContext(offerSource, leaseSource) {
  let offer;
  let lease;
  try {
    offer = verifyResourceOffer(offerSource);
    lease = verifyResourceLease({ offer: offer.bytes, lease: leaseSource });
  } catch {
    fail("E_PLACEMENT_LIVENESS_BINDING", "policy-resource-contract");
  }
  const provider = identity(offer.body.provider, "provider");
  const consumer = identity(lease.body.consumer, "consumer");
  if (provider.key_id === consumer.key_id) {
    fail("E_PLACEMENT_LIVENESS_IDENTITY", "provider-consumer-overlap");
  }
  const policy = observerPolicy({
    max_faulty: offer.body.witness_policy.max_faulty,
    observers: offer.body.witness_policy.witnesses,
    threshold: offer.body.witness_policy.threshold
  }, provider, consumer);
  return Object.freeze({
    consumer,
    lease,
    observerPolicy: policy,
    observerPolicyId: domainHash(DOMAINS.observerPolicy, canonicalBytes(policy)),
    offer,
    provider
  });
}

function expandedPolicyBody(context, parameters) {
  return Object.freeze({
    consumer: context.consumer,
    failure_sequence: parameters.failure_sequence,
    lease_id: context.lease.lease_id,
    lineage_parent_hash: parameters.lineage_parent_hash,
    manifest_id: parameters.manifest_id,
    observer_policy: context.observerPolicy,
    observer_policy_id: context.observerPolicyId,
    offer_id: context.offer.offer_id,
    provider: context.provider,
    response_proof_profile: parameters.response_proof_profile,
    response_window_ms: parameters.response_window_ms,
    shard_index: parameters.shard_index,
    workload_id: parameters.workload_id
  });
}

function policyTuple(body) {
  return [
    body.offer_id,
    body.lease_id,
    body.workload_id,
    body.shard_index,
    body.failure_sequence
  ].join("|");
}

function livenessPolicyDraft(offerSource, leaseSource, parameterSource) {
  const context = resourcePolicyContext(offerSource, leaseSource);
  const parameters = policyParameters(parameterSource);
  const body = expandedPolicyBody(context, parameters);
  const basis = Object.freeze({
    body,
    lease_base64url: encodeBase64Url(context.lease.bytes),
    offer_base64url: encodeBase64Url(context.offer.bytes)
  });
  const policyId = domainHash(DOMAINS.policy, canonicalBytes(basis));
  return Object.freeze({
    basis,
    body,
    context,
    policyId,
    signingMessage: idMessage(DOMAINS.policySignature, policyId),
    tuple: policyTuple(body)
  });
}

function livenessPolicyDraftFromEnvelope(value) {
  const body = exactKeys(value.body, POLICY_BODY_KEYS, "policy-body");
  const offerBytes = decodeBase64Url(value.offer_base64url);
  const leaseBytes = decodeBase64Url(value.lease_base64url);
  if (!offerBytes || !leaseBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "policy-resource-contract");
  const draft = livenessPolicyDraft(offerBytes, leaseBytes, {
    failure_sequence: body.failure_sequence,
    lineage_parent_hash: body.lineage_parent_hash,
    manifest_id: body.manifest_id,
    response_proof_profile: body.response_proof_profile,
    response_window_ms: body.response_window_ms,
    shard_index: body.shard_index,
    workload_id: body.workload_id
  });
  if (!sameCanonicalValue(body, draft.body)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "policy-resource-binding");
  }
  return draft;
}

function admittedSelection(context, parameters) {
  return Object.freeze({
    consumer_key_id: context.consumer.key_id,
    failure_sequence: parameters.failure_sequence,
    lineage_parent_hash: parameters.lineage_parent_hash,
    manifest_id: parameters.manifest_id,
    provider_key_id: context.provider.key_id,
    shard_index: parameters.shard_index,
    workload_id: parameters.workload_id
  });
}

function admittedPolicyDraft(
  offerSource,
  leaseSource,
  membershipEpochSource,
  priorMembershipEpochSource,
  parameterSource,
  capsuleSource = null
) {
  const context = resourcePolicyContext(offerSource, leaseSource);
  const parameters = admittedPolicyParameters(parameterSource);
  const epoch = restorePlacementMembershipEpoch(membershipEpochSource);
  let prior = null;
  if (epoch.body.prior_epoch_id === null) {
    if (priorMembershipEpochSource !== null) {
      fail("E_PLACEMENT_LIVENESS_BINDING", "membership-prior-unexpected");
    }
  } else {
    if (priorMembershipEpochSource === null) {
      fail("E_PLACEMENT_LIVENESS_BINDING", "membership-prior-required");
    }
    prior = restorePlacementMembershipEpoch(priorMembershipEpochSource);
    if (prior.epoch_id !== epoch.body.prior_epoch_id) {
      fail("E_PLACEMENT_LIVENESS_BINDING", "membership-prior-id");
    }
  }
  const selection = admittedSelection(context, parameters);
  let roster;
  try {
    roster = capsuleSource === null
      ? derivePlacementObserverRosterFromEpoch({
          epoch_bytes: epoch.bytes,
          evaluated_at_ms: parameters.membership_evaluated_at_ms,
          selection
        })
      : derivePlacementObserverRoster({
          capsule_bytes: capsuleSource,
          epoch_bytes: epoch.bytes,
          evaluated_at_ms: parameters.membership_evaluated_at_ms,
          prior_epoch_bytes: priorMembershipEpochSource,
          selection
        });
  } catch (error) {
    fail("E_PLACEMENT_LIVENESS_ADMISSION", error?.code ?? "membership-invalid");
  }
  if (!sameCanonicalValue(roster.observer_policy, context.observerPolicy)) {
    fail("E_PLACEMENT_LIVENESS_ADMISSION", "offer-roster-not-admitted");
  }
  const body = Object.freeze({
    ...expandedPolicyBody(context, parameters),
    membership_epoch_id: epoch.epoch_id,
    membership_evaluated_at_ms: parameters.membership_evaluated_at_ms,
    membership_selection_digest: roster.selection_digest,
    prior_membership_epoch_id: prior?.epoch_id ?? null
  });
  const basis = Object.freeze({
    body,
    lease_base64url: encodeBase64Url(context.lease.bytes),
    offer_base64url: encodeBase64Url(context.offer.bytes)
  });
  const policyId = domainHash(DOMAINS.policyAdmitted, canonicalBytes(basis));
  return Object.freeze({
    basis,
    body,
    context,
    membershipEpoch: epoch,
    policyId,
    roster,
    signingMessage: idMessage(DOMAINS.policyAdmittedSignature, policyId),
    tuple: policyTuple(body)
  });
}

function admittedPolicyDraftFromEnvelope(value, capsuleSource = null) {
  const body = exactKeys(value.body, ADMITTED_POLICY_BODY_KEYS, "admitted-policy-body");
  const offerBytes = decodeBase64Url(value.offer_base64url);
  const leaseBytes = decodeBase64Url(value.lease_base64url);
  if (!offerBytes || !leaseBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "admitted-policy-artifacts");
  const context = resourcePolicyContext(offerBytes, leaseBytes);
  const parameters = admittedPolicyParameters(body);
  if (!DIGEST.test(body.membership_epoch_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "membership-epoch-id");
  }
  if (!DIGEST.test(body.membership_selection_digest)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "membership-selection-digest");
  }
  if (body.prior_membership_epoch_id !== null) {
    if (!DIGEST.test(body.prior_membership_epoch_id)) {
      fail("E_PLACEMENT_LIVENESS_BINDING", "prior-membership-epoch-id");
    }
  }
  const normalized = Object.freeze({
    ...expandedPolicyBody(context, parameters),
    membership_epoch_id: body.membership_epoch_id,
    membership_evaluated_at_ms: body.membership_evaluated_at_ms,
    membership_selection_digest: body.membership_selection_digest,
    prior_membership_epoch_id: body.prior_membership_epoch_id
  });
  if (!sameCanonicalValue(body, normalized)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "admitted-policy-resource-binding");
  }
  const basis = Object.freeze({
    body: normalized,
    lease_base64url: encodeBase64Url(context.lease.bytes),
    offer_base64url: encodeBase64Url(context.offer.bytes)
  });
  const policyId = domainHash(DOMAINS.policyAdmitted, canonicalBytes(basis));
  return Object.freeze({
    basis,
    body: normalized,
    context,
    membershipEpoch: null,
    policyId,
    roster: null,
    signingMessage: idMessage(DOMAINS.policyAdmittedSignature, policyId),
    tuple: policyTuple(normalized)
  });
}

export function prepareAdmittedPlacementLivenessPolicy(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, [
    "body",
    "capsule",
    "lease",
    "membership_epoch",
    "offer",
    "prior_membership_epoch"
  ], "admitted-policy-options");
  const draft = admittedPolicyDraft(
    options.offer,
    options.lease,
    options.membership_epoch,
    options.prior_membership_epoch,
    options.body,
    options.capsule
  );
  return Object.freeze({
    body: draft.body,
    policy_id: draft.policyId,
    provider_signing_message: new Uint8Array(draft.signingMessage)
  });
}

export function finalizeAdmittedPlacementLivenessPolicy(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, [
    "body",
    "capsule",
    "lease",
    "membership_epoch",
    "offer",
    "prior_membership_epoch",
    "provider_signature"
  ], "admitted-policy-finalize-options");
  const draft = admittedPolicyDraft(
    options.offer,
    options.lease,
    options.membership_epoch,
    options.prior_membership_epoch,
    options.body,
    options.capsule
  );
  const bytes = canonicalBytes({
    ...draft.basis,
    format: PLACEMENT_LIVENESS_FORMATS.policy_admitted,
    policy_id: draft.policyId,
    provider_signature: options.provider_signature
  });
  return verifyPlacementAdmittedLivenessPolicy({
    capsule: options.capsule,
    membership_epoch: options.membership_epoch,
    policy: bytes,
    prior_membership_epoch: options.prior_membership_epoch
  }).bytes;
}

export function preparePlacementLivenessPolicy(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, ["body", "lease", "offer"], "policy-options");
  const draft = livenessPolicyDraft(options.offer, options.lease, options.body);
  return Object.freeze({
    body: draft.body,
    policy_id: draft.policyId,
    provider_signing_message: new Uint8Array(draft.signingMessage)
  });
}

export function finalizePlacementLivenessPolicy(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["body", "lease", "offer", "provider_signature"],
    "policy-finalize-options"
  );
  const draft = livenessPolicyDraft(options.offer, options.lease, options.body);
  const bytes = canonicalBytes({
    ...draft.basis,
    format: PLACEMENT_LIVENESS_FORMATS.policy,
    policy_id: draft.policyId,
    provider_signature: options.provider_signature
  });
  return verifyPlacementLivenessPolicy(bytes).bytes;
}

export function verifyPlacementLivenessPolicy(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "liveness-policy");
  let value;
  let draft;
  let membershipReference = false;
  if (parsed.value.format === PLACEMENT_LIVENESS_FORMATS.policy) {
    value = exactKeys(parsed.value, [
      "body",
      "format",
      "lease_base64url",
      "offer_base64url",
      "policy_id",
      "provider_signature"
    ], "liveness-policy");
    draft = livenessPolicyDraftFromEnvelope(value);
  } else if (parsed.value.format === PLACEMENT_LIVENESS_FORMATS.policy_admitted) {
    value = exactKeys(parsed.value, [
      "body",
      "format",
      "lease_base64url",
      "offer_base64url",
      "policy_id",
      "provider_signature"
    ], "liveness-policy");
    draft = admittedPolicyDraftFromEnvelope(value);
    membershipReference = true;
  } else {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "policy-format");
  }
  if (value.policy_id !== draft.policyId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "policy-id");
  }
  if (!verifyEd25519(
    draft.body.provider.public_key,
    draft.signingMessage,
    value.provider_signature
  )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "policy-provider");
  return Object.freeze({
    body: draft.body,
    bytes: parsed.bytes,
    format: value.format,
    lease_bytes: new Uint8Array(draft.context.lease.bytes),
    membership_admitted: false,
    membership_epoch_bytes: null,
    membership_epoch_id: membershipReference ? draft.body.membership_epoch_id : null,
    membership_evaluated_at_ms: membershipReference
      ? draft.body.membership_evaluated_at_ms
      : null,
    membership_reference: membershipReference,
    membership_selection_digest: membershipReference
      ? draft.body.membership_selection_digest
      : null,
    offer_bytes: new Uint8Array(draft.context.offer.bytes),
    policy_id: draft.policyId,
    prior_membership_epoch_bytes: null,
    prior_membership_epoch_id: membershipReference
      ? draft.body.prior_membership_epoch_id
      : null,
    status: "verified",
    tuple: draft.tuple
  });
}

export function verifyPlacementAdmittedLivenessPolicy(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["capsule", "membership_epoch", "policy", "prior_membership_epoch"],
    "admitted-policy-verify-options"
  );
  const parsed = parseCanonical(options.policy, "admitted-liveness-policy");
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.policy_admitted) {
    fail("E_PLACEMENT_LIVENESS_ADMISSION", "admitted-policy-required");
  }
  const value = exactKeys(parsed.value, [
    "body",
    "format",
    "lease_base64url",
    "offer_base64url",
    "policy_id",
    "provider_signature"
  ], "liveness-policy");
  const reference = admittedPolicyDraftFromEnvelope(value);
  const draft = admittedPolicyDraft(
    reference.context.offer.bytes,
    reference.context.lease.bytes,
    options.membership_epoch,
    options.prior_membership_epoch,
    {
      failure_sequence: reference.body.failure_sequence,
      lineage_parent_hash: reference.body.lineage_parent_hash,
      manifest_id: reference.body.manifest_id,
      membership_evaluated_at_ms: reference.body.membership_evaluated_at_ms,
      response_proof_profile: reference.body.response_proof_profile,
      response_window_ms: reference.body.response_window_ms,
      shard_index: reference.body.shard_index,
      workload_id: reference.body.workload_id
    },
    options.capsule
  );
  if (!sameCanonicalValue(reference.body, draft.body)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "admitted-policy-membership-reference");
  }
  if (value.policy_id !== draft.policyId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "policy-id");
  }
  if (!verifyEd25519(
    draft.body.provider.public_key,
    draft.signingMessage,
    value.provider_signature
  )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "policy-provider");
  return Object.freeze({
    body: draft.body,
    bytes: parsed.bytes,
    format: value.format,
    lease_bytes: new Uint8Array(draft.context.lease.bytes),
    membership_admitted: true,
    membership_epoch_bytes: new Uint8Array(draft.membershipEpoch.bytes),
    membership_epoch_id: draft.membershipEpoch.epoch_id,
    membership_evaluated_at_ms: draft.body.membership_evaluated_at_ms,
    membership_reference: true,
    membership_selection_digest: draft.roster.selection_digest,
    offer_bytes: new Uint8Array(draft.context.offer.bytes),
    policy_id: draft.policyId,
    prior_membership_epoch_bytes: options.prior_membership_epoch === null
      ? null
      : new Uint8Array(restorePlacementMembershipEpoch(options.prior_membership_epoch).bytes),
    prior_membership_epoch_id: draft.body.prior_membership_epoch_id,
    status: "verified",
    tuple: draft.tuple
  });
}

function challengeBody(source) {
  source = exactKeys(source, [
    "consumer",
    "failure_sequence",
    "lease_id",
    "lineage_parent_hash",
    "manifest_id",
    "nonce",
    "observer_policy",
    "previous_execution_receipt_id",
    "provider",
    "response_window_ms",
    "shard_index",
    "workload_id"
  ], "challenge-body");
  const provider = identity(source.provider, "provider");
  const consumer = identity(source.consumer, "consumer");
  if (provider.key_id === consumer.key_id) fail("E_PLACEMENT_LIVENESS_IDENTITY", "provider-consumer-overlap");
  if (!LEASE_ID.test(source.lease_id) || !WORKLOAD_ID.test(source.workload_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "lease-or-workload");
  }
  if (!DIGEST.test(source.lineage_parent_hash) || !DIGEST.test(source.manifest_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "lineage-or-manifest");
  }
  if (!RECEIPT_ID.test(source.previous_execution_receipt_id)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "previous-receipt");
  }
  if (!Number.isSafeInteger(source.shard_index) || source.shard_index < 0 || source.shard_index > 2) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "shard-index");
  }
  decimal(source.failure_sequence, "failure-sequence", 1);
  decimal(
    source.response_window_ms,
    "response-window-ms",
    1,
    Number(PLACEMENT_LIVENESS_LIMITS.response_window_ms_max)
  );
  nonce(source.nonce);
  return Object.freeze({
    consumer,
    failure_sequence: source.failure_sequence,
    lease_id: source.lease_id,
    lineage_parent_hash: source.lineage_parent_hash,
    manifest_id: source.manifest_id,
    nonce: source.nonce,
    observer_policy: observerPolicy(source.observer_policy, provider, consumer),
    previous_execution_receipt_id: source.previous_execution_receipt_id,
    provider,
    response_window_ms: source.response_window_ms,
    shard_index: source.shard_index,
    workload_id: source.workload_id
  });
}

function challengeDraft(source) {
  const body = challengeBody(source);
  const challengeId = domainHash(DOMAINS.challenge, canonicalBytes(body));
  return Object.freeze({
    body,
    challengeId,
    format: PLACEMENT_LIVENESS_FORMATS.challenge,
    policy: null,
    signingMessage: idMessage(DOMAINS.challengeSignature, challengeId)
  });
}

function policyChallengeDraft(policySource, previousExecutionReceiptId, nonceValue) {
  const policy = verifyPlacementLivenessPolicy(policySource);
  if (!RECEIPT_ID.test(previousExecutionReceiptId)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "previous-receipt");
  }
  nonce(nonceValue);
  const documentBody = Object.freeze({
    nonce: nonceValue,
    policy_base64url: encodeBase64Url(policy.bytes),
    policy_id: policy.policy_id,
    previous_execution_receipt_id: previousExecutionReceiptId
  });
  const challengeId = domainHash(DOMAINS.challengePolicy, canonicalBytes(documentBody));
  const body = Object.freeze({
    ...policy.body,
    nonce: nonceValue,
    policy_id: policy.policy_id,
    previous_execution_receipt_id: previousExecutionReceiptId
  });
  return Object.freeze({
    body,
    challengeId,
    documentBody,
    format: PLACEMENT_LIVENESS_FORMATS.challenge_policy,
    policy,
    signingMessage: idMessage(DOMAINS.challengePolicySignature, challengeId)
  });
}

export function preparePlacementLivenessChallenge(body) {
  assertPlacementLivenessRealm();
  const draft = challengeDraft(body);
  return Object.freeze({
    body: draft.body,
    challenge_id: draft.challengeId,
    consumer_signing_message: new Uint8Array(draft.signingMessage)
  });
}

export function finalizePlacementLivenessChallenge(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, ["body", "consumer_signature"], "challenge-options");
  const draft = challengeDraft(options.body);
  const bytes = canonicalBytes({
    body: draft.body,
    challenge_id: draft.challengeId,
    consumer_signature: options.consumer_signature,
    format: PLACEMENT_LIVENESS_FORMATS.challenge
  });
  return verifyPlacementLivenessChallenge(bytes).bytes;
}

export function preparePlacementLivenessPolicyChallenge(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["nonce", "policy", "previous_execution_receipt_id"],
    "policy-challenge-options"
  );
  const draft = policyChallengeDraft(
    options.policy,
    options.previous_execution_receipt_id,
    options.nonce
  );
  return Object.freeze({
    body: draft.documentBody,
    challenge_id: draft.challengeId,
    consumer_signing_message: new Uint8Array(draft.signingMessage),
    policy_id: draft.policy.policy_id
  });
}

export function finalizePlacementLivenessPolicyChallenge(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["consumer_signature", "nonce", "policy", "previous_execution_receipt_id"],
    "policy-challenge-finalize-options"
  );
  const draft = policyChallengeDraft(
    options.policy,
    options.previous_execution_receipt_id,
    options.nonce
  );
  const bytes = canonicalBytes({
    body: draft.documentBody,
    challenge_id: draft.challengeId,
    consumer_signature: options.consumer_signature,
    format: PLACEMENT_LIVENESS_FORMATS.challenge_policy
  });
  return verifyPlacementLivenessChallenge(bytes).bytes;
}

export function verifyPlacementLivenessChallenge(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "liveness-challenge");
  if (parsed.value.format === PLACEMENT_LIVENESS_FORMATS.challenge) {
    exactKeys(parsed.value, ["body", "challenge_id", "consumer_signature", "format"], "challenge");
    const draft = challengeDraft(parsed.value.body);
    if (parsed.value.challenge_id !== draft.challengeId) {
      fail("E_PLACEMENT_LIVENESS_BINDING", "challenge-id");
    }
    if (!verifyEd25519(
      draft.body.consumer.public_key,
      draft.signingMessage,
      parsed.value.consumer_signature
    )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "challenge-consumer");
    return Object.freeze({
      authority: "legacy-compatibility-only",
      body: draft.body,
      bytes: parsed.bytes,
      challenge_id: draft.challengeId,
      format: draft.format,
      membership_admitted: false,
      membership_evaluated_at_ms: null,
      membership_epoch_bytes: null,
      membership_epoch_id: null,
      membership_reference: false,
      membership_selection_digest: null,
      policy: null,
      policy_id: null,
      policy_tuple: null,
      prior_membership_epoch_bytes: null,
      prior_membership_epoch_id: null,
      status: "verified",
      tuple: challengeTuple(draft.body)
    });
  }
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.challenge_policy) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "challenge-format");
  }
  const value = exactKeys(parsed.value, [
    "body",
    "challenge_id",
    "consumer_signature",
    "format"
  ], "challenge");
  const documentBody = exactKeys(
    value.body,
    ["nonce", "policy_base64url", "policy_id", "previous_execution_receipt_id"],
    "policy-challenge-body"
  );
  const policyBytes = decodeBase64Url(documentBody.policy_base64url);
  if (!policyBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "challenge-policy");
  const draft = policyChallengeDraft(
    policyBytes,
    documentBody.previous_execution_receipt_id,
    documentBody.nonce
  );
  if (documentBody.policy_id !== draft.policy.policy_id) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "challenge-policy-id");
  }
  if (parsed.value.challenge_id !== draft.challengeId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "challenge-id");
  }
  if (!verifyEd25519(
    draft.body.consumer.public_key,
    draft.signingMessage,
    parsed.value.consumer_signature
  )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "challenge-consumer");
  return Object.freeze({
    authority: "policy-bound",
    body: draft.body,
    bytes: parsed.bytes,
    challenge_id: draft.challengeId,
    format: draft.format,
    membership_admitted: draft.policy.membership_admitted,
    membership_evaluated_at_ms: draft.policy.membership_evaluated_at_ms,
    membership_epoch_bytes: draft.policy.membership_epoch_bytes,
    membership_epoch_id: draft.policy.membership_epoch_id,
    membership_reference: draft.policy.membership_reference,
    membership_selection_digest: draft.policy.membership_selection_digest,
    policy: draft.policy,
    policy_id: draft.policy.policy_id,
    policy_tuple: draft.policy.tuple,
    prior_membership_epoch_bytes: draft.policy.prior_membership_epoch_bytes,
    prior_membership_epoch_id: draft.policy.prior_membership_epoch_id,
    status: "verified",
    tuple: challengeTuple(draft.body)
  });
}

function observationDraft(challengeSource, observerSource, waitedWindow) {
  const challenge = verifyPlacementLivenessChallenge(challengeSource);
  const observer = identity(observerSource, "observer");
  const permitted = challenge.body.observer_policy.observers
    .some(({ key_id: id }) => id === observer.key_id);
  if (!permitted) fail("E_PLACEMENT_LIVENESS_POLICY", "observer-not-rostered");
  if (waitedWindow !== challenge.body.response_window_ms) {
    fail("E_PLACEMENT_LIVENESS_WINDOW", "waited-window-mismatch");
  }
  const body = Object.freeze({
    challenge_id: challenge.challenge_id,
    observer,
    outcome: "no-response",
    waited_window_ms: waitedWindow
  });
  const observationId = domainHash(DOMAINS.observation, canonicalBytes(body));
  return Object.freeze({
    body,
    challenge,
    observationId,
    signingMessage: idMessage(DOMAINS.observationSignature, observationId)
  });
}

export function preparePlacementLivenessObservation(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "observer", "waited_window_ms"],
    "observation-options"
  );
  const draft = observationDraft(options.challenge, options.observer, options.waited_window_ms);
  return Object.freeze({
    body: draft.body,
    observation_id: draft.observationId,
    observer_signing_message: new Uint8Array(draft.signingMessage)
  });
}

export function finalizePlacementLivenessObservation(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "observer", "observer_signature", "waited_window_ms"],
    "observation-finalize-options"
  );
  const draft = observationDraft(options.challenge, options.observer, options.waited_window_ms);
  const bytes = canonicalBytes({
    body: draft.body,
    format: PLACEMENT_LIVENESS_FORMATS.observation,
    observation_id: draft.observationId,
    observer_signature: options.observer_signature
  });
  return verifyPlacementLivenessObservation({
    challenge: options.challenge,
    observation: bytes
  }).bytes;
}

export function verifyPlacementLivenessObservation(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, ["challenge", "observation"], "observation-verify-options");
  const challenge = verifyPlacementLivenessChallenge(options.challenge);
  const parsed = parseCanonical(options.observation, "liveness-observation");
  exactKeys(parsed.value, ["body", "format", "observation_id", "observer_signature"], "observation");
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.observation) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "observation-format");
  }
  exactKeys(parsed.value.body, ["challenge_id", "observer", "outcome", "waited_window_ms"], "observation-body");
  if (
    parsed.value.body.challenge_id !== challenge.challenge_id ||
    parsed.value.body.outcome !== "no-response" ||
    parsed.value.body.waited_window_ms !== challenge.body.response_window_ms
  ) fail("E_PLACEMENT_LIVENESS_BINDING", "observation-challenge");
  const observer = identity(parsed.value.body.observer, "observer");
  if (!challenge.body.observer_policy.observers.some(({ key_id: id }) => id === observer.key_id)) {
    fail("E_PLACEMENT_LIVENESS_POLICY", "observer-not-rostered");
  }
  const body = Object.freeze({ ...parsed.value.body, observer });
  const observationId = domainHash(DOMAINS.observation, canonicalBytes(body));
  if (parsed.value.observation_id !== observationId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "observation-id");
  }
  if (!verifyEd25519(
    observer.public_key,
    idMessage(DOMAINS.observationSignature, observationId),
    parsed.value.observer_signature
  )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "observation-observer");
  return Object.freeze({
    body,
    bytes: parsed.bytes,
    challenge_id: challenge.challenge_id,
    observation_id: observationId,
    observer_id: observer.key_id,
    status: "verified"
  });
}

export function createPlacementFailureCertificate(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, ["challenge", "observations"], "certificate-options");
  let observationSources;
  try {
    observationSources = copyOwnDataArray(options.observations, "certificate-observations");
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-observations");
  }
  assertPlacementLivenessRealm();
  const challenge = verifyPlacementLivenessChallenge(options.challenge);
  if (
    observationSources.length < 1 ||
    observationSources.length > PLACEMENT_LIVENESS_LIMITS.observations_per_certificate
  ) fail("E_PLACEMENT_LIVENESS_LIMIT", "certificate-observations");
  const observations = observationSources.map((observation) =>
    verifyPlacementLivenessObservation({ challenge: challenge.bytes, observation }));
  const byObserver = createMap();
  for (const observation of observations) {
    const prior = mapGet(byObserver, observation.observer_id);
    if (prior && prior.observation_id !== observation.observation_id) {
      fail("E_PLACEMENT_LIVENESS_EQUIVOCATION", "observer-double-sign");
    }
    mapSet(byObserver, observation.observer_id, observation);
  }
  const unique = mapValues(byObserver).sort((left, right) =>
    left.observer_id < right.observer_id ? -1 : 1);
  if (unique.length < challenge.body.observer_policy.threshold) {
    fail("E_PLACEMENT_LIVENESS_QUORUM", "observer-threshold");
  }
  const certificateFormat = challenge.format === PLACEMENT_LIVENESS_FORMATS.challenge_policy
    ? PLACEMENT_LIVENESS_FORMATS.certificate_policy
    : PLACEMENT_LIVENESS_FORMATS.certificate;
  const certificateDomain = certificateFormat === PLACEMENT_LIVENESS_FORMATS.certificate_policy
    ? DOMAINS.certificatePolicy
    : DOMAINS.certificate;
  const basis = {
    challenge_base64url: encodeBase64Url(challenge.bytes),
    format: certificateFormat,
    observations_base64url: unique.map(({ bytes }) => encodeBase64Url(bytes))
  };
  const value = Object.freeze({
    ...basis,
    certificate_id: domainHash(certificateDomain, canonicalBytes(basis))
  });
  return verifyPlacementFailureCertificate(canonicalBytes(value));
}

export function verifyPlacementFailureCertificate(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "failure-certificate");
  exactKeys(
    parsed.value,
    ["certificate_id", "challenge_base64url", "format", "observations_base64url"],
    "failure-certificate"
  );
  if (
    parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.certificate &&
    parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.certificate_policy
  ) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-format");
  }
  const challengeBytes = decodeBase64Url(parsed.value.challenge_base64url);
  if (!challengeBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-challenge");
  const challenge = verifyPlacementLivenessChallenge(challengeBytes);
  const expectedCertificateFormat = challenge.format === PLACEMENT_LIVENESS_FORMATS.challenge_policy
    ? PLACEMENT_LIVENESS_FORMATS.certificate_policy
    : PLACEMENT_LIVENESS_FORMATS.certificate;
  if (parsed.value.format !== expectedCertificateFormat) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "certificate-challenge-format");
  }
  if (
    !Array.isArray(parsed.value.observations_base64url) ||
    parsed.value.observations_base64url.length < challenge.body.observer_policy.threshold ||
    parsed.value.observations_base64url.length > PLACEMENT_LIVENESS_LIMITS.observations_per_certificate
  ) fail("E_PLACEMENT_LIVENESS_QUORUM", "certificate-observations");
  const observations = parsed.value.observations_base64url.map((encoded) => {
    const bytes = decodeBase64Url(encoded);
    if (!bytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-observation");
    return verifyPlacementLivenessObservation({ challenge: challenge.bytes, observation: bytes });
  });
  const ids = observations.map(({ observer_id: id }) => id);
  const observerIds = createSet();
  for (const id of ids) setAdd(observerIds, id);
  if (setSize(observerIds) !== ids.length) fail("E_PLACEMENT_LIVENESS_QUORUM", "duplicate-observer");
  const sorted = [...observations].sort((left, right) => left.observer_id < right.observer_id ? -1 : 1);
  if (sorted.some((entry, index) =>
    encodeBase64Url(entry.bytes) !== parsed.value.observations_base64url[index])) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-observation-order");
  }
  const basis = {
    challenge_base64url: parsed.value.challenge_base64url,
    format: parsed.value.format,
    observations_base64url: parsed.value.observations_base64url
  };
  const certificateDomain = parsed.value.format === PLACEMENT_LIVENESS_FORMATS.certificate_policy
    ? DOMAINS.certificatePolicy
    : DOMAINS.certificate;
  const certificateId = domainHash(certificateDomain, canonicalBytes(basis));
  if (parsed.value.certificate_id !== certificateId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "certificate-id");
  }
  return Object.freeze({
    body: challenge.body,
    bytes: parsed.bytes,
    certificate_format: parsed.value.format,
    certificate_id: certificateId,
    challenge_authority: challenge.authority,
    challenge_body: challenge.body,
    challenge_bytes: challenge.bytes,
    challenge_format: challenge.format,
    challenge_id: challenge.challenge_id,
    observer_ids: Object.freeze(ids),
    membership_admitted: challenge.membership_admitted,
    membership_evaluated_at_ms: challenge.membership_evaluated_at_ms,
    membership_epoch_bytes: challenge.membership_epoch_bytes,
    membership_epoch_id: challenge.membership_epoch_id,
    membership_reference: challenge.membership_reference,
    membership_selection_digest: challenge.membership_selection_digest,
    policy_id: challenge.policy_id,
    policy_tuple: challenge.policy_tuple,
    prior_membership_epoch_bytes: challenge.prior_membership_epoch_bytes ?? null,
    prior_membership_epoch_id: challenge.prior_membership_epoch_id ?? null,
    provider_id: challenge.body.provider.key_id,
    repair_authority: challenge.authority === "policy-bound",
    status: "verified",
    tuple: challenge.tuple
  });
}

function responseDraft(challengeSource, executionReceiptId, providerSource) {
  const challenge = verifyPlacementLivenessChallenge(challengeSource);
  if (
    challenge.body.response_proof_profile !== undefined &&
    challenge.body.response_proof_profile !==
      PLACEMENT_LIVENESS_RESPONSE_PROFILES.execution_receipt_pointer
  ) fail("E_PLACEMENT_LIVENESS_POLICY", "receipt-pointer-response-profile");
  const provider = identity(providerSource, "provider");
  if (provider.key_id !== challenge.body.provider.key_id || !RECEIPT_ID.test(executionReceiptId)) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "response-provider-or-receipt");
  }
  const body = Object.freeze({
    challenge_id: challenge.challenge_id,
    execution_receipt_id: executionReceiptId,
    provider
  });
  const responseId = domainHash(DOMAINS.response, canonicalBytes(body));
  return Object.freeze({
    body,
    challenge,
    responseId,
    signingMessage: idMessage(DOMAINS.responseSignature, responseId)
  });
}

export function preparePlacementLivenessResponse(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "execution_receipt_id", "provider"],
    "response-options"
  );
  const draft = responseDraft(options.challenge, options.execution_receipt_id, options.provider);
  return Object.freeze({
    body: draft.body,
    provider_signing_message: new Uint8Array(draft.signingMessage),
    response_id: draft.responseId
  });
}

export function finalizePlacementLivenessResponse(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "execution_receipt_id", "provider", "provider_signature"],
    "response-finalize-options"
  );
  const draft = responseDraft(options.challenge, options.execution_receipt_id, options.provider);
  const bytes = canonicalBytes({
    body: draft.body,
    challenge_base64url: encodeBase64Url(draft.challenge.bytes),
    format: PLACEMENT_LIVENESS_FORMATS.response,
    provider_signature: options.provider_signature,
    response_id: draft.responseId
  });
  return verifyPlacementLivenessResponse(bytes).bytes;
}

function possessionResponseDraft(challengeSource, proofSource, providerSource, workloadSource) {
  const challenge = verifyPlacementLivenessChallenge(challengeSource);
  if (
    challenge.authority !== "policy-bound" ||
    challenge.body.response_proof_profile !==
      PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample
  ) fail("E_PLACEMENT_LIVENESS_POLICY", "possession-response-profile");
  const provider = identity(providerSource, "provider");
  if (provider.key_id !== challenge.body.provider.key_id) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "response-provider");
  }
  let workload;
  try {
    const bytes = canonicalBytes(workloadSource);
    if (byteLengthOfBytes(bytes) > PLACEMENT_LIVENESS_LIMITS.document_bytes) {
      fail("E_PLACEMENT_LIVENESS_LIMIT", "response-workload");
    }
    workload = parseJsonBytes(bytes, {
      maxBytes: PLACEMENT_LIVENESS_LIMITS.document_bytes,
      maxDepth: 16
    });
  } catch (error) {
    if (error instanceof PlacementLivenessError) throw error;
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "response-workload");
  }
  assertPlacementLivenessRealm();
  if (
    deriveResourceExecutionWorkloadId({ kind: "storage", workload }) !==
    challenge.body.workload_id
  ) fail("E_PLACEMENT_LIVENESS_BINDING", "response-workload");
  let proof;
  try {
    proof = verifyResourceStoragePossessionProof({
      challenge_nonce: challenge.body.nonce,
      lease_id: challenge.body.lease_id,
      proof: proofSource,
      workload
    });
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_BINDING", "response-storage-merkle-sample");
  }
  const body = Object.freeze({
    challenge_id: challenge.challenge_id,
    proof,
    provider,
    response_proof_profile: PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample,
    workload: Object.freeze(workload)
  });
  const challengeBase64url = encodeBase64Url(challenge.bytes);
  const responseId = domainHash(DOMAINS.responsePossession, canonicalBytes({
    body,
    challenge_base64url: challengeBase64url
  }));
  return Object.freeze({
    body,
    challenge,
    challengeBase64url,
    responseId,
    signingMessage: idMessage(DOMAINS.responsePossessionSignature, responseId)
  });
}

export function preparePlacementLivenessPossessionResponse(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "proof", "provider", "workload"],
    "possession-response-options"
  );
  const draft = possessionResponseDraft(
    options.challenge,
    options.proof,
    options.provider,
    options.workload
  );
  return Object.freeze({
    body: draft.body,
    provider_signing_message: new Uint8Array(draft.signingMessage),
    response_id: draft.responseId
  });
}

export function finalizePlacementLivenessPossessionResponse(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(
    options,
    ["challenge", "proof", "provider", "provider_signature", "workload"],
    "possession-response-finalize-options"
  );
  const draft = possessionResponseDraft(
    options.challenge,
    options.proof,
    options.provider,
    options.workload
  );
  const bytes = canonicalBytes({
    body: draft.body,
    challenge_base64url: draft.challengeBase64url,
    format: PLACEMENT_LIVENESS_FORMATS.response_possession,
    provider_signature: options.provider_signature,
    response_id: draft.responseId
  });
  return verifyPlacementLivenessResponse(bytes).bytes;
}

export function verifyPlacementLivenessResponse(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "liveness-response");
  exactKeys(
    parsed.value,
    ["body", "challenge_base64url", "format", "provider_signature", "response_id"],
    "liveness-response"
  );
  const challengeBytes = decodeBase64Url(parsed.value.challenge_base64url);
  if (!challengeBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "response-challenge");
  let draft;
  let independentPossession = false;
  let executionReceiptId = null;
  let responseProofProfile;
  if (parsed.value.format === PLACEMENT_LIVENESS_FORMATS.response) {
    exactKeys(parsed.value.body, ["challenge_id", "execution_receipt_id", "provider"], "response-body");
    draft = responseDraft(
      challengeBytes,
      parsed.value.body.execution_receipt_id,
      parsed.value.body.provider
    );
    executionReceiptId = draft.body.execution_receipt_id;
    responseProofProfile = PLACEMENT_LIVENESS_RESPONSE_PROFILES.execution_receipt_pointer;
  } else if (parsed.value.format === PLACEMENT_LIVENESS_FORMATS.response_possession) {
    exactKeys(
      parsed.value.body,
      ["challenge_id", "proof", "provider", "response_proof_profile", "workload"],
      "response-body"
    );
    if (
      parsed.value.body.response_proof_profile !==
      PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample
    ) fail("E_PLACEMENT_LIVENESS_POLICY", "possession-response-profile");
    draft = possessionResponseDraft(
      challengeBytes,
      parsed.value.body.proof,
      parsed.value.body.provider,
      parsed.value.body.workload
    );
    independentPossession = true;
    responseProofProfile = PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample;
  } else {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "response-format");
  }
  if (
    parsed.value.body.challenge_id !== draft.challenge.challenge_id ||
    parsed.value.response_id !== draft.responseId
  ) fail("E_PLACEMENT_LIVENESS_BINDING", "response-id");
  if (!verifyEd25519(
    draft.body.provider.public_key,
    draft.signingMessage,
    parsed.value.provider_signature
  )) fail("E_PLACEMENT_LIVENESS_SIGNATURE", "response-provider");
  return Object.freeze({
    body: draft.body,
    bytes: parsed.bytes,
    challenge_authority: draft.challenge.authority,
    challenge_format: draft.challenge.format,
    challenge_id: draft.challenge.challenge_id,
    challenge_body: draft.challenge.body,
    execution_receipt_id: executionReceiptId,
    independent_possession: independentPossession,
    membership_admitted: draft.challenge.membership_admitted,
    membership_evaluated_at_ms: draft.challenge.membership_evaluated_at_ms,
    membership_epoch_bytes: draft.challenge.membership_epoch_bytes,
    membership_epoch_id: draft.challenge.membership_epoch_id,
    membership_reference: draft.challenge.membership_reference,
    membership_selection_digest: draft.challenge.membership_selection_digest,
    policy_id: draft.challenge.policy_id,
    policy_tuple: draft.challenge.policy_tuple,
    prior_membership_epoch_bytes: draft.challenge.prior_membership_epoch_bytes ?? null,
    prior_membership_epoch_id: draft.challenge.prior_membership_epoch_id ?? null,
    possession_response_id: independentPossession ? draft.responseId : null,
    provider_id: draft.body.provider.key_id,
    repair_authority: draft.challenge.authority === "policy-bound",
    response_format: parsed.value.format,
    response_id: draft.responseId,
    response_proof_profile: responseProofProfile,
    status: "verified",
    tuple: draft.challenge.tuple
  });
}

export function evaluatePlacementLivenessEvidence(options) {
  assertPlacementLivenessRealm();
  options = exactKeys(options, ["certificates", "responses"], "liveness-evaluation-options");
  let certificateSources;
  let responseSources;
  try {
    certificateSources = copyOwnDataArray(options.certificates, "liveness-certificates");
    responseSources = copyOwnDataArray(options.responses, "liveness-responses");
  } catch {
    assertPlacementLivenessRealm();
    fail("E_PLACEMENT_LIVENESS_FORMAT", "liveness-evidence-arrays");
  }
  assertPlacementLivenessRealm();
  if (
    certificateSources.length > PLACEMENT_LIVENESS_LIMITS.certificates_per_evaluation ||
    responseSources.length > PLACEMENT_LIVENESS_LIMITS.responses_per_evaluation
  ) fail("E_PLACEMENT_LIVENESS_LIMIT", "liveness-evaluation");
  const certificates = certificateSources.map(verifyPlacementFailureCertificate);
  const responses = responseSources.map(verifyPlacementLivenessResponse);
  const policyIdsByTuple = createMap();
  for (const entry of [...certificates, ...responses]) {
    if (entry.policy_tuple === null) continue;
    const ids = mapGet(policyIdsByTuple, entry.policy_tuple) ?? createSet();
    setAdd(ids, entry.policy_id);
    mapSet(policyIdsByTuple, entry.policy_tuple, ids);
  }
  const forkedPolicyTuples = createSet();
  for (const tuple of mapKeys(policyIdsByTuple)) {
    const ids = mapGet(policyIdsByTuple, tuple);
    if (setSize(ids) > 1) setAdd(forkedPolicyTuples, tuple);
  }
  const byTuple = createMap();
  for (const entry of [...certificates, ...responses]) {
    const bucket = mapGet(byTuple, entry.tuple) ?? { certificates: [], responses: [] };
    if (entry.certificate_id) bucket.certificates.push(entry);
    else bucket.responses.push(entry);
    mapSet(byTuple, entry.tuple, bucket);
  }
  const cases = [];
  for (const bucket of mapValues(byTuple)) {
    const tuple = (bucket.certificates[0] ?? bucket.responses[0]).tuple;
    const challengeIds = createSet();
    for (const id of [
      ...bucket.certificates.map(({ challenge_id: id }) => id),
      ...bucket.responses.map(({ challenge_id: id }) => id)
    ]) setAdd(challengeIds, id);
    let status;
    const responseReceiptIds = createSet();
    const possessionResponseIds = createSet();
    for (const response of bucket.responses) {
      if (response.execution_receipt_id !== null) {
        setAdd(responseReceiptIds, response.execution_receipt_id);
      }
      if (response.independent_possession) {
        setAdd(possessionResponseIds, response.response_id);
      }
    }
    const exemplar = bucket.certificates[0] ?? bucket.responses[0];
    if (
      exemplar.policy_tuple !== null &&
      setHas(forkedPolicyTuples, exemplar.policy_tuple)
    ) status = "policy-fork";
    else if (setSize(challengeIds) > 1) status = "challenge-fork";
    else if (setSize(possessionResponseIds) > 1) status = "response-fork";
    else if (bucket.certificates.length > 0 && setSize(possessionResponseIds) > 0) status = "contested";
    else if (bucket.certificates.length > 0) status = "failed";
    else if (setSize(possessionResponseIds) > 0) status = "alive";
    else status = "pointer-only";
    const challenge = exemplar.challenge_body;
    cases.push(Object.freeze({
      certificate_ids: Object.freeze((() => {
        const ids = createSet();
        for (const { certificate_id: id } of bucket.certificates) setAdd(ids, id);
        return setValues(ids).sort();
      })()),
      challenge_format: exemplar.challenge_format,
      challenge_id: setValues(challengeIds).sort()[0],
      consumer: challenge.consumer,
      execution_receipt_ids: Object.freeze(setValues(responseReceiptIds).sort()),
      failure_sequence: challenge.failure_sequence,
      lease_id: challenge.lease_id,
      lineage_parent_hash: challenge.lineage_parent_hash,
      manifest_id: challenge.manifest_id,
      membership_admitted: exemplar.membership_admitted,
      membership_evaluated_at_ms: exemplar.membership_evaluated_at_ms,
      membership_epoch_bytes: exemplar.membership_epoch_bytes,
      membership_epoch_id: exemplar.membership_epoch_id,
      membership_reference: exemplar.membership_reference,
      membership_selection_digest: exemplar.membership_selection_digest,
      observer_policy: challenge.observer_policy,
      observer_policy_id: challenge.observer_policy_id ?? null,
      offer_id: challenge.offer_id ?? null,
      policy_id: exemplar.policy_id,
      policy_tuple: exemplar.policy_tuple,
      prior_membership_epoch_bytes: exemplar.prior_membership_epoch_bytes,
      prior_membership_epoch_id: exemplar.prior_membership_epoch_id,
      possession_response_ids: Object.freeze(setValues(possessionResponseIds).sort()),
      previous_execution_receipt_id: challenge.previous_execution_receipt_id,
      provider_id: exemplar.provider_id,
      repair_authority: exemplar.repair_authority,
      sampled_possession: setSize(possessionResponseIds) === 1,
      response_proof_profile: challenge.response_proof_profile ?? null,
      response_window_ms: challenge.response_window_ms,
      shard_index: challenge.shard_index,
      status,
      tuple,
      workload_id: challenge.workload_id
    }));
  }
  cases.sort((left, right) => left.tuple < right.tuple ? -1 : 1);
  const halted = cases.some(({ status }) =>
    ["challenge-fork", "contested", "policy-fork", "response-fork"].includes(status));
  return Object.freeze({
    cases: Object.freeze(cases),
    failed_provider_ids: Object.freeze((() => {
      const ids = createSet();
      for (const { provider_id: id, status } of cases) {
        if (status === "failed") setAdd(ids, id);
      }
      return setValues(ids).sort();
    })()),
    status: halted
      ? "halted"
      : cases.some(({ status }) => status === "failed")
        ? "failed"
        : cases.some(({ status }) => status === "alive")
          ? "alive"
          : "clear"
  });
}
