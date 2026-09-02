import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes
} from "../../src/codec.mjs";
import { encodeBase64Url } from "../../src/bytes.mjs";
import {
  arrayIncludes,
  arrayMap,
  arraySlice,
  arraySort,
  callFunction,
  freeze,
  isArray,
  numberIsFinite,
  numberIsSafeInteger,
  objectKeys,
  regexpTest
} from "../../src/primordials.mjs";

export const WEBRTC_REACHABILITY_OBSERVATION_FORMAT =
  "mortalos-webrtc-reachability-observation/1";
export const WEBRTC_REACHABILITY_PLAN_FORMAT =
  "mortalos-webrtc-reachability-plan/1";
export const WEBRTC_REACHABILITY_CLAIM_SCOPE = "single-operator-reachability";
export const WEBRTC_REACHABILITY_LIMITS = freeze({
  attempts_per_profile: 20,
  observation_bytes: 16_384,
  resource_bytes: 131_072
});
export const WEBRTC_REACHABILITY_PROFILES = freeze([
  "lan-direct",
  "nat-stun",
  "forced-turn",
  "reconnect-fallback"
]);
export const WEBRTC_REACHABILITY_FAILURE_CODES = freeze([
  "WEBRTC_CONNECTION_CLOSED",
  "WEBRTC_ICE_TIMEOUT",
  "WEBRTC_OPEN_TIMEOUT",
  "WEBRTC_ROUTE_AMBIGUOUS",
  "WEBRTC_ROUTE_LIMIT",
  "WEBRTC_ROUTE_UNAVAILABLE",
  "R2_BELOW_QUORUM_ACCEPTED",
  "R2_CORRUPT_COPY_ACCEPTED",
  "R2_DUPLICATE_EFFECT",
  "R2_INTERNAL_ERROR",
  "R2_LINEAGE_MISMATCH",
  "R2_RESOURCE_MISMATCH",
  "R2_UNEXPECTED_PATH_CLASS"
]);

const COMMIT = /^[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const NONCE = /^[A-Za-z0-9_-]{43}$/u;
const PATH_CLASSES = freeze(["host", "srflx", "relay"]);
const SELECTED_ROUTE_FORMAT = "mortalos-webrtc-selected-route/1";
const dateConstructor = Date;
const dateParseIntrinsic = Date.parse;
const dateToISOStringIntrinsic = Date.prototype.toISOString;

function fail(message) {
  throw new TypeError(`WEBRTC_REACHABILITY_OBSERVATION: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = objectKeys(value);
  const wanted = arraySlice(expected, 0);
  arraySort(actual);
  arraySort(wanted);
  if (actual.length !== wanted.length) fail(`${label} has unknown or missing fields`);
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== wanted[index]) fail(`${label} has unknown or missing fields`);
  }
}

function openedJson(value, label) {
  let bytes;
  try {
    bytes = canonicalBytes(value);
  } catch {
    fail(`${label} must be owned canonical JSON data`);
  }
  if (bytes.byteLength > WEBRTC_REACHABILITY_LIMITS.observation_bytes) {
    fail(`${label} exceeds the byte limit`);
  }
  return parseJsonBytes(bytes, {
    maxBytes: WEBRTC_REACHABILITY_LIMITS.observation_bytes,
    maxDepth: 8
  });
}

function boundedString(value, pattern, label) {
  if (typeof value !== "string" || !regexpTest(pattern, value)) fail(`${label} is invalid`);
  return value;
}

function pathClass(value, label) {
  if (!arrayIncludes(PATH_CLASSES, value)) fail(`${label} is invalid`);
  return value;
}

function normalizeExpectedPathClasses(source, profile, label) {
  if (!isArray(source)) fail(`${label} must be an array`);
  const expectedCount = profile === "reconnect-fallback" ? 2 : 1;
  if (source.length !== expectedCount) fail(`${label} count does not match profile`);
  const classes = freeze(arrayMap(source, (value, index) =>
    pathClass(value, `${label}[${index}]`)));
  if (profile === "lan-direct" && classes[0] !== "host") {
    fail(`${label} must pre-register host for lan-direct`);
  }
  if (profile === "nat-stun" && classes[0] !== "srflx") {
    fail(`${label} must pre-register srflx for nat-stun`);
  }
  if (profile === "forced-turn" && classes[0] !== "relay") {
    fail(`${label} must pre-register relay for forced-turn`);
  }
  if (
    profile === "reconnect-fallback" &&
    (classes[0] === "relay" || classes[1] !== "relay")
  ) fail(`${label} must pre-register a direct-or-STUN to relay fallback`);
  return classes;
}

function boundResource(source, label) {
  exactKeys(source, [
    "capsule_id",
    "lineage_head",
    "organism_id",
    "resource_bytes",
    "resource_digest",
    "source_commit",
    "source_tree"
  ], label);
  if (
    !numberIsSafeInteger(source.resource_bytes) ||
    source.resource_bytes < 1 ||
    source.resource_bytes > WEBRTC_REACHABILITY_LIMITS.resource_bytes
  ) fail(`${label}.resource_bytes is invalid`);
  return freeze({
    capsule_id: boundedString(source.capsule_id, DIGEST, `${label}.capsule_id`),
    lineage_head: boundedString(source.lineage_head, DIGEST, `${label}.lineage_head`),
    organism_id: boundedString(source.organism_id, DIGEST, `${label}.organism_id`),
    resource_bytes: source.resource_bytes,
    resource_digest: boundedString(source.resource_digest, DIGEST, `${label}.resource_digest`),
    source_commit: boundedString(source.source_commit, COMMIT, `${label}.source_commit`),
    source_tree: boundedString(source.source_tree, COMMIT, `${label}.source_tree`)
  });
}

function planProfile(source, expectedProfile, index) {
  const label = `profiles[${index}]`;
  exactKeys(source, ["attempts", "expected_path_classes", "profile"], label);
  if (source.profile !== expectedProfile) fail(`${label}.profile is not in canonical order`);
  if (source.attempts !== WEBRTC_REACHABILITY_LIMITS.attempts_per_profile) {
    fail(`${label}.attempts must cover the complete pilot`);
  }
  return freeze({
    attempts: WEBRTC_REACHABILITY_LIMITS.attempts_per_profile,
    expected_path_classes: normalizeExpectedPathClasses(
      source.expected_path_classes,
      source.profile,
      `${label}.expected_path_classes`
    ),
    profile: source.profile
  });
}

function planBody(source) {
  exactKeys(source, [
    "campaign_nonce",
    "claim_scope",
    "format",
    "non_authority",
    "profiles",
    "resource"
  ], "plan body");
  if (
    source.format !== WEBRTC_REACHABILITY_PLAN_FORMAT ||
    source.claim_scope !== WEBRTC_REACHABILITY_CLAIM_SCOPE ||
    source.non_authority !== true
  ) fail("plan authority boundary is invalid");
  if (
    !isArray(source.profiles) ||
    source.profiles.length !== WEBRTC_REACHABILITY_PROFILES.length
  ) fail("plan must contain every reachability profile exactly once");
  const profiles = freeze(arrayMap(source.profiles, (value, index) =>
    planProfile(value, WEBRTC_REACHABILITY_PROFILES[index], index)));
  return freeze({
    campaign_nonce: boundedString(source.campaign_nonce, NONCE, "campaign_nonce"),
    claim_scope: WEBRTC_REACHABILITY_CLAIM_SCOPE,
    format: WEBRTC_REACHABILITY_PLAN_FORMAT,
    non_authority: true,
    profiles,
    resource: boundResource(source.resource, "resource")
  });
}

function contentId(body) {
  return `sha256:${encodeBase64Url(sha256(canonicalBytes(body)))}`;
}

export function createWebRtcReachabilityPlan(source) {
  const body = planBody(openedJson(source, "plan body"));
  const plan_id = contentId(body);
  const plan = freeze({ plan_id, ...body });
  const bytes = canonicalBytes(plan);
  if (bytes.byteLength > WEBRTC_REACHABILITY_LIMITS.observation_bytes) {
    fail("plan exceeds the byte limit");
  }
  return freeze({ bytes, plan, plan_id });
}

export function verifyWebRtcReachabilityPlanBytes(sourceBytes) {
  let value;
  try {
    value = parseJsonBytes(sourceBytes, {
      maxBytes: WEBRTC_REACHABILITY_LIMITS.observation_bytes,
      maxDepth: 8
    });
  } catch {
    fail("plan bytes are invalid");
  }
  if (!isCanonical(sourceBytes, value)) fail("plan bytes are not canonical");
  exactKeys(value, [
    "campaign_nonce",
    "claim_scope",
    "format",
    "non_authority",
    "plan_id",
    "profiles",
    "resource"
  ], "plan");
  const body = planBody({
    campaign_nonce: value.campaign_nonce,
    claim_scope: value.claim_scope,
    format: value.format,
    non_authority: value.non_authority,
    profiles: value.profiles,
    resource: value.resource
  });
  const expectedId = contentId(body);
  if (value.plan_id !== expectedId) fail("plan_id mismatch");
  const canonical = canonicalBytes(freeze({ plan_id: expectedId, ...body }));
  if (!isCanonical(canonical, value)) fail("plan reconstruction mismatch");
  return freeze({
    plan: freeze({ plan_id: expectedId, ...body }),
    plan_id: expectedId
  });
}

function route(source, label) {
  exactKeys(
    source,
    ["format", "local_route_class", "non_authority", "path_class", "remote_route_class"],
    label
  );
  if (source.format !== SELECTED_ROUTE_FORMAT || source.non_authority !== true) {
    fail(`${label} is not bounded non-authoritative route evidence`);
  }
  const localRouteClass = pathClass(source.local_route_class, `${label}.local_route_class`);
  const remoteRouteClass = pathClass(source.remote_route_class, `${label}.remote_route_class`);
  const expectedPathClass = localRouteClass === "relay" || remoteRouteClass === "relay"
    ? "relay"
    : localRouteClass === "srflx" || remoteRouteClass === "srflx"
      ? "srflx"
      : "host";
  if (source.path_class !== expectedPathClass) fail(`${label}.path_class is inconsistent`);
  return freeze({
    format: SELECTED_ROUTE_FORMAT,
    local_route_class: localRouteClass,
    non_authority: true,
    path_class: expectedPathClass,
    remote_route_class: remoteRouteClass
  });
}

function connection(source, expectedSequence) {
  const label = `connections[${expectedSequence - 1}]`;
  exactKeys(source, ["answerer_route", "offerer_route", "sequence"], label);
  if (source.sequence !== expectedSequence) fail(`${label}.sequence is not consecutive`);
  return freeze({
    answerer_route: route(source.answerer_route, `${label}.answerer_route`),
    offerer_route: route(source.offerer_route, `${label}.offerer_route`),
    sequence: expectedSequence
  });
}

function instant(value, label) {
  boundedString(value, ISO_INSTANT, label);
  const parsed = callFunction(dateParseIntrinsic, dateConstructor, [value]);
  if (
    !numberIsFinite(parsed) ||
    callFunction(dateToISOStringIntrinsic, new dateConstructor(parsed), []) !== value
  ) fail(`${label} is invalid`);
  return value;
}

function productResult(source, observation) {
  exactKeys(source, [
    "below_quorum_failed_closed",
    "continuity_duplicate_effects",
    "corrupt_copy_rejected",
    "provider_duplicate_effects",
    "recovered_capsule_id",
    "recovered_organism_id",
    "recovered_resource_bytes",
    "recovered_resource_digest",
    "source_retired_before_recovery",
    "successor_lineage_head"
  ], "product_result");
  if (
    source.below_quorum_failed_closed !== true ||
    source.continuity_duplicate_effects !== 0 ||
    source.corrupt_copy_rejected !== true ||
    source.provider_duplicate_effects !== 0 ||
    source.source_retired_before_recovery !== true
  ) fail("product_result does not prove the required fail-closed vertical");
  const successorLineageHead = boundedString(
    source.successor_lineage_head,
    DIGEST,
    "product_result.successor_lineage_head"
  );
  if (
    source.recovered_capsule_id !== observation.capsule_id ||
    source.recovered_organism_id !== observation.organism_id ||
    source.recovered_resource_bytes !== observation.resource_bytes ||
    source.recovered_resource_digest !== observation.resource_digest
  ) fail("product_result recovered identity does not match the observation");
  if (successorLineageHead === observation.lineage_head) {
    fail("product_result must bind a distinct successor lineage head");
  }
  return freeze({
    below_quorum_failed_closed: true,
    continuity_duplicate_effects: 0,
    corrupt_copy_rejected: true,
    provider_duplicate_effects: 0,
    recovered_capsule_id: observation.capsule_id,
    recovered_organism_id: observation.organism_id,
    recovered_resource_bytes: observation.resource_bytes,
    recovered_resource_digest: observation.resource_digest,
    source_retired_before_recovery: true,
    successor_lineage_head: successorLineageHead
  });
}

function observationBody(source) {
  exactKeys(source, [
    "attempt",
    "capsule_id",
    "claim_scope",
    "completed_at",
    "connections",
    "expected_path_classes",
    "failure_code",
    "format",
    "lineage_head",
    "non_authority",
    "organism_id",
    "outcome",
    "plan_id",
    "product_result",
    "profile",
    "resource_bytes",
    "resource_digest",
    "source_commit",
    "source_tree",
    "started_at"
  ], "observation body");
  if (
    source.format !== WEBRTC_REACHABILITY_OBSERVATION_FORMAT ||
    source.claim_scope !== WEBRTC_REACHABILITY_CLAIM_SCOPE ||
    source.non_authority !== true
  ) fail("observation authority boundary is invalid");
  if (!arrayIncludes(WEBRTC_REACHABILITY_PROFILES, source.profile)) fail("profile is invalid");
  if (
    !numberIsSafeInteger(source.attempt) ||
    source.attempt < 1 ||
    source.attempt > WEBRTC_REACHABILITY_LIMITS.attempts_per_profile
  ) fail("attempt is invalid");
  if (
    !numberIsSafeInteger(source.resource_bytes) ||
    source.resource_bytes < 1 ||
    source.resource_bytes > WEBRTC_REACHABILITY_LIMITS.resource_bytes
  ) fail("resource_bytes is invalid");
  const expectedPathClasses = normalizeExpectedPathClasses(
    source.expected_path_classes,
    source.profile,
    "expected_path_classes"
  );
  const expectedCount = expectedPathClasses.length;
  if (!isArray(source.connections) || source.connections.length > expectedCount) {
    fail("connections count exceeds the profile contract");
  }
  const connections = freeze(arrayMap(source.connections, (value, index) =>
    connection(value, index + 1)));
  if (source.outcome !== "pass" && source.outcome !== "fail") fail("outcome is invalid");
  if (source.outcome === "pass") {
    if (source.failure_code !== null) fail("passing observation cannot contain failure_code");
    if (connections.length !== expectedCount) fail("passing observation is missing a connection");
    for (let index = 0; index < connections.length; index += 1) {
      if (
        connections[index].offerer_route.path_class !== expectedPathClasses[index] ||
        connections[index].answerer_route.path_class !== expectedPathClasses[index]
      ) fail("passing observation does not match the pre-registered path class");
    }
    if (source.product_result === null) fail("passing observation requires product_result");
  } else if (!arrayIncludes(WEBRTC_REACHABILITY_FAILURE_CODES, source.failure_code)) {
    fail("failed observation requires an allowlisted failure_code");
  } else if (source.product_result !== null) {
    fail("failed observation cannot claim a complete product_result");
  }
  const startedAt = instant(source.started_at, "started_at");
  const completedAt = instant(source.completed_at, "completed_at");
  if (
    callFunction(dateParseIntrinsic, dateConstructor, [completedAt]) <
    callFunction(dateParseIntrinsic, dateConstructor, [startedAt])
  ) fail("observation interval is inverted");
  return freeze({
    attempt: source.attempt,
    capsule_id: boundedString(source.capsule_id, DIGEST, "capsule_id"),
    claim_scope: WEBRTC_REACHABILITY_CLAIM_SCOPE,
    completed_at: completedAt,
    connections,
    expected_path_classes: expectedPathClasses,
    failure_code: source.failure_code,
    format: WEBRTC_REACHABILITY_OBSERVATION_FORMAT,
    lineage_head: boundedString(source.lineage_head, DIGEST, "lineage_head"),
    non_authority: true,
    organism_id: boundedString(source.organism_id, DIGEST, "organism_id"),
    outcome: source.outcome,
    plan_id: boundedString(source.plan_id, DIGEST, "plan_id"),
    product_result: source.outcome === "pass" ? productResult(source.product_result, source) : null,
    profile: source.profile,
    resource_bytes: source.resource_bytes,
    resource_digest: boundedString(source.resource_digest, DIGEST, "resource_digest"),
    source_commit: boundedString(source.source_commit, COMMIT, "source_commit"),
    source_tree: boundedString(source.source_tree, COMMIT, "source_tree"),
    started_at: startedAt
  });
}

export function createWebRtcReachabilityObservation(source) {
  const body = observationBody(openedJson(source, "observation body"));
  const observation_id = contentId(body);
  const observation = freeze({ observation_id, ...body });
  const bytes = canonicalBytes(observation);
  if (bytes.byteLength > WEBRTC_REACHABILITY_LIMITS.observation_bytes) {
    fail("observation exceeds the byte limit");
  }
  return freeze({ bytes, observation, observation_id });
}

export function verifyWebRtcReachabilityObservationBytes(sourceBytes) {
  let value;
  try {
    value = parseJsonBytes(sourceBytes, {
      maxBytes: WEBRTC_REACHABILITY_LIMITS.observation_bytes,
      maxDepth: 8
    });
  } catch {
    fail("observation bytes are invalid");
  }
  if (!isCanonical(sourceBytes, value)) fail("observation bytes are not canonical");
  exactKeys(value, [
    "attempt",
    "capsule_id",
    "claim_scope",
    "completed_at",
    "connections",
    "expected_path_classes",
    "failure_code",
    "format",
    "lineage_head",
    "non_authority",
    "observation_id",
    "organism_id",
    "outcome",
    "plan_id",
    "product_result",
    "profile",
    "resource_bytes",
    "resource_digest",
    "source_commit",
    "source_tree",
    "started_at"
  ], "observation");
  const body = observationBody({
    attempt: value.attempt,
    capsule_id: value.capsule_id,
    claim_scope: value.claim_scope,
    completed_at: value.completed_at,
    connections: value.connections,
    expected_path_classes: value.expected_path_classes,
    failure_code: value.failure_code,
    format: value.format,
    lineage_head: value.lineage_head,
    non_authority: value.non_authority,
    organism_id: value.organism_id,
    outcome: value.outcome,
    plan_id: value.plan_id,
    product_result: value.product_result,
    profile: value.profile,
    resource_bytes: value.resource_bytes,
    resource_digest: value.resource_digest,
    source_commit: value.source_commit,
    source_tree: value.source_tree,
    started_at: value.started_at
  });
  const expectedId = contentId(body);
  if (value.observation_id !== expectedId) fail("observation_id mismatch");
  const canonical = canonicalBytes(freeze({ observation_id: expectedId, ...body }));
  if (!isCanonical(canonical, value)) fail("observation reconstruction mismatch");
  return freeze({
    observation: freeze({ observation_id: expectedId, ...body }),
    observation_id: expectedId
  });
}

function equalStrings(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function verifyWebRtcReachabilityObservationAgainstPlan(planBytes, observationBytes) {
  const { plan, plan_id } = verifyWebRtcReachabilityPlanBytes(planBytes);
  const { observation, observation_id } = verifyWebRtcReachabilityObservationBytes(observationBytes);
  if (observation.plan_id !== plan_id) fail("observation is not bound to this plan");
  for (const field of [
    "capsule_id",
    "lineage_head",
    "organism_id",
    "resource_bytes",
    "resource_digest",
    "source_commit",
    "source_tree"
  ]) {
    if (observation[field] !== plan.resource[field]) {
      fail(`observation ${field} does not match plan`);
    }
  }
  let profile = null;
  for (let index = 0; index < plan.profiles.length; index += 1) {
    if (plan.profiles[index].profile === observation.profile) profile = plan.profiles[index];
  }
  if (!profile || observation.attempt > profile.attempts) fail("observation profile is not planned");
  if (!equalStrings(observation.expected_path_classes, profile.expected_path_classes)) {
    fail("observation path classes do not match plan");
  }
  return freeze({ observation, observation_id, plan, plan_id });
}
