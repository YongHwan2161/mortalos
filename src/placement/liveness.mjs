import {
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  utf8Bytes
} from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import { domainHash } from "../confidential/format.mjs";
import { derivePeerId, verifyEd25519 } from "../crypto.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import {
  copyOwnDataArray,
  createMap,
  createSet,
  mapGet,
  mapSet,
  mapValues,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  setAdd,
  setSize,
  setValues,
  snapshotOwnDataRecord
} from "../primordials.mjs";

export const PLACEMENT_LIVENESS_FORMATS = Object.freeze({
  certificate: "mortalos-placement-failure-certificate/1",
  challenge: "mortalos-placement-liveness-challenge/1",
  observation: "mortalos-placement-liveness-observation/1",
  response: "mortalos-placement-liveness-response/1"
});

export const PLACEMENT_LIVENESS_LIMITS = PROTOCOL_PROFILE.placement_liveness;

const DOMAINS = Object.freeze({
  certificate: "MortalOS placement failure certificate v1",
  challenge: "MortalOS placement liveness challenge v1",
  challengeSignature: "MortalOS placement liveness challenge signature v1\0",
  observation: "MortalOS placement liveness observation v1",
  observationSignature: "MortalOS placement liveness observation signature v1\0",
  response: "MortalOS placement liveness response v1",
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
    signingMessage: idMessage(DOMAINS.challengeSignature, challengeId)
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

export function verifyPlacementLivenessChallenge(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "liveness-challenge");
  exactKeys(parsed.value, ["body", "challenge_id", "consumer_signature", "format"], "challenge");
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.challenge) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "challenge-format");
  }
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
    body: draft.body,
    bytes: parsed.bytes,
    challenge_id: draft.challengeId,
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
  const basis = {
    challenge_base64url: encodeBase64Url(challenge.bytes),
    format: PLACEMENT_LIVENESS_FORMATS.certificate,
    observations_base64url: unique.map(({ bytes }) => encodeBase64Url(bytes))
  };
  const value = Object.freeze({
    ...basis,
    certificate_id: domainHash(DOMAINS.certificate, canonicalBytes(basis))
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
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.certificate) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-format");
  }
  const challengeBytes = decodeBase64Url(parsed.value.challenge_base64url);
  if (!challengeBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "certificate-challenge");
  const challenge = verifyPlacementLivenessChallenge(challengeBytes);
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
  const certificateId = domainHash(DOMAINS.certificate, canonicalBytes(basis));
  if (parsed.value.certificate_id !== certificateId) {
    fail("E_PLACEMENT_LIVENESS_BINDING", "certificate-id");
  }
  return Object.freeze({
    body: challenge.body,
    bytes: parsed.bytes,
    certificate_id: certificateId,
    challenge_body: challenge.body,
    challenge_bytes: challenge.bytes,
    challenge_id: challenge.challenge_id,
    observer_ids: Object.freeze(ids),
    provider_id: challenge.body.provider.key_id,
    status: "verified",
    tuple: challenge.tuple
  });
}

function responseDraft(challengeSource, executionReceiptId, providerSource) {
  const challenge = verifyPlacementLivenessChallenge(challengeSource);
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

export function verifyPlacementLivenessResponse(source) {
  assertPlacementLivenessRealm();
  const parsed = parseCanonical(source, "liveness-response");
  exactKeys(
    parsed.value,
    ["body", "challenge_base64url", "format", "provider_signature", "response_id"],
    "liveness-response"
  );
  if (parsed.value.format !== PLACEMENT_LIVENESS_FORMATS.response) {
    fail("E_PLACEMENT_LIVENESS_FORMAT", "response-format");
  }
  const challengeBytes = decodeBase64Url(parsed.value.challenge_base64url);
  if (!challengeBytes) fail("E_PLACEMENT_LIVENESS_FORMAT", "response-challenge");
  exactKeys(parsed.value.body, ["challenge_id", "execution_receipt_id", "provider"], "response-body");
  const draft = responseDraft(
    challengeBytes,
    parsed.value.body.execution_receipt_id,
    parsed.value.body.provider
  );
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
    challenge_id: draft.challenge.challenge_id,
    challenge_body: draft.challenge.body,
    execution_receipt_id: draft.body.execution_receipt_id,
    provider_id: draft.body.provider.key_id,
    response_id: draft.responseId,
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
    for (const { execution_receipt_id: id } of bucket.responses) setAdd(responseReceiptIds, id);
    if (setSize(challengeIds) > 1) status = "challenge-fork";
    else if (setSize(responseReceiptIds) > 1) status = "response-fork";
    else if (bucket.certificates.length > 0 && bucket.responses.length > 0) status = "contested";
    else if (bucket.certificates.length > 0) status = "failed";
    else status = "alive";
    const exemplar = bucket.certificates[0] ?? bucket.responses[0];
    const challenge = exemplar.challenge_body;
    cases.push(Object.freeze({
      certificate_ids: Object.freeze((() => {
        const ids = createSet();
        for (const { certificate_id: id } of bucket.certificates) setAdd(ids, id);
        return setValues(ids).sort();
      })()),
      challenge_id: setValues(challengeIds).sort()[0],
      consumer: challenge.consumer,
      execution_receipt_ids: Object.freeze(setValues(responseReceiptIds).sort()),
      failure_sequence: challenge.failure_sequence,
      lease_id: challenge.lease_id,
      lineage_parent_hash: challenge.lineage_parent_hash,
      manifest_id: challenge.manifest_id,
      observer_policy: challenge.observer_policy,
      previous_execution_receipt_id: challenge.previous_execution_receipt_id,
      provider_id: exemplar.provider_id,
      response_window_ms: challenge.response_window_ms,
      shard_index: challenge.shard_index,
      status,
      tuple,
      workload_id: challenge.workload_id
    }));
  }
  cases.sort((left, right) => left.tuple < right.tuple ? -1 : 1);
  const halted = cases.some(({ status }) =>
    ["challenge-fork", "contested", "response-fork"].includes(status));
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
        : cases.length === 0
          ? "clear"
          : "alive"
  });
}
