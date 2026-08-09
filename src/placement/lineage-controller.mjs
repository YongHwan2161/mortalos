import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url
} from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import { verifyContinuityCapsule } from "../capsule.mjs";
import { continueContinuity, inspectContinuity } from "../continuity.mjs";
import { derivePulseHash } from "../crypto.mjs";
import { domainHash } from "../confidential/format.mjs";
import { verifyResourceLease, verifyResourceOffer } from "../resource-contract.mjs";
import {
  copyOwnDataArray,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord
} from "../primordials.mjs";
import { evaluateConfidentialStoragePlacements } from "./confidential.mjs";
import { evaluatePlacementLivenessEvidence } from "./liveness.mjs";

export const LINEAGE_PLACEMENT_FORMATS = Object.freeze({
  action_plan: "mortalos-lineage-placement-action-plan/1",
  commit: "mortalos-lineage-placement-commit/1",
  convergence: "mortalos-lineage-placement-convergence/1",
  generation: "mortalos-lineage-placement-generation/1"
});

const DOMAINS = Object.freeze({
  commit: "MortalOS lineage placement commit v1",
  convergence: "MortalOS lineage placement convergence v1",
  generation: "MortalOS lineage placement generation v1"
});
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const RECORD_KEYS = Object.freeze([
  "consumption_announcements_base64url",
  "execution_receipts_base64url",
  "lease_base64url",
  "observed_at_ms",
  "offer_base64url",
  "revocations_base64url",
  "shard_index",
  "usage_receipts_base64url"
]);
const SOURCE_RECORD_KEYS = Object.freeze([
  "consumption_announcements",
  "execution_receipts",
  "lease",
  "observed_at_ms",
  "offer",
  "revocations",
  "shard_index",
  "usage_receipts"
]);
const GENERATION_KEYS = Object.freeze([
  "evaluated_at_ms",
  "failure_certificates_base64url",
  "format",
  "generation",
  "generation_id",
  "lineage_parent_hash",
  "liveness_cases",
  "liveness_responses_base64url",
  "manifest_base64url",
  "manifest_id",
  "max_proof_age_ms",
  "organism_id",
  "placements",
  "prior_commit_head_hash",
  "prior_generation_id",
  "proofs",
  "quorum",
  "repair_intents",
  "status",
  "target_shards"
]);

export class LineagePlacementError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "LineagePlacementError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new LineagePlacementError(code, detail);
}

function assertLineagePlacementRealm() {
  if (!realmIntrinsicsIntact()) fail("E_LINEAGE_PLACEMENT_RUNTIME", "realm-integrity");
}

function exactKeys(value, expected, label) {
  assertLineagePlacementRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    assertLineagePlacementRealm();
    fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-ordinary-own-data`);
  }
  assertLineagePlacementRealm();
  const actual = ownKeys(descriptors);
  if (actual.some((key) => typeof key !== "string")) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-keys`);
  }
  actual.sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-keys`);
  }
  const snapshot = {};
  for (const key of expected) {
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-keys`);
    snapshot[key] = entry.value;
  }
  return Object.freeze(snapshot);
}

function copiedArray(value, label, maximum) {
  let result;
  try {
    result = copyOwnDataArray(value, label);
  } catch {
    assertLineagePlacementRealm();
    fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-ordinary-own-data-array`);
  }
  assertLineagePlacementRealm();
  if (result.length > maximum) fail("E_LINEAGE_PLACEMENT_LIMIT", label);
  return result;
}

function ownedBytes(value, label, maximum = MAX_DOCUMENT_BYTES) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > maximum) {
    fail("E_LINEAGE_PLACEMENT_LIMIT", label);
  }
  return new Uint8Array(value);
}

function parseCanonical(bytes, label, maximum = MAX_DOCUMENT_BYTES) {
  const owned = ownedBytes(bytes, label, maximum);
  let value;
  try {
    value = parseJsonBytes(owned, { maxBytes: maximum, maxDepth: 64 });
  } catch {
    fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-json`);
  }
  if (!isCanonical(owned, value)) fail("E_LINEAGE_PLACEMENT_FORMAT", `${label}-canonical`);
  return Object.freeze({ bytes: owned, value });
}

function decimal(value, label, minimum = 0) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", label);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) fail("E_LINEAGE_PLACEMENT_LIMIT", label);
  return parsed;
}

function tagged(value, label) {
  if (typeof value !== "string" || value.length < 8 || value.length > 160) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", label);
  }
  return value;
}

function encodeBytes(value, label) {
  return encodeBase64Url(ownedBytes(value, label, 2 * 1024 * 1024));
}

function decodeBytes(value, label) {
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.byteLength < 1 || bytes.byteLength > 2 * 1024 * 1024) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", label);
  }
  return bytes;
}

function encodeByteArray(values, label) {
  return copiedArray(values, label, 64)
    .map((value, index) => encodeBytes(value, `${label}-${index}`));
}

function decodeByteArray(values, label) {
  return copiedArray(values, label, 64)
    .map((value, index) => decodeBytes(value, `${label}-${index}`));
}

function encodeLivenessEvidence(values, label) {
  const encoded = copiedArray(values, label, 16).map((value, index) =>
    encodeBytes(value, `${label}-${index}`));
  if (new Set(encoded).size !== encoded.length) {
    fail("E_LINEAGE_PLACEMENT_LIVENESS", `${label}-duplicate`);
  }
  return Object.freeze(encoded.sort());
}

function decodeLivenessEvidence(values, label) {
  values = copiedArray(values, label, 16);
  if (values.some((value) => typeof value !== "string")) {
    fail("E_LINEAGE_PLACEMENT_LIMIT", label);
  }
  const sorted = [...values].sort();
  if (new Set(values).size !== values.length || values.some((value, index) => value !== sorted[index])) {
    fail("E_LINEAGE_PLACEMENT_LIVENESS", `${label}-canonical-order`);
  }
  return Object.freeze(values.map((value, index) => decodeBytes(value, `${label}-${index}`)));
}

function encodePlacement(value, index) {
  value = exactKeys(value, SOURCE_RECORD_KEYS, `placement-${index}`);
  if (!Number.isSafeInteger(value.shard_index) || value.shard_index < 0 || value.shard_index > 2) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", `placement-${index}-shard`);
  }
  decimal(value.observed_at_ms, `placement-${index}-observed`);
  return Object.freeze({
    consumption_announcements_base64url: encodeByteArray(
      value.consumption_announcements,
      `placement-${index}-announcements`
    ),
    execution_receipts_base64url: encodeByteArray(
      value.execution_receipts,
      `placement-${index}-execution-receipts`
    ),
    lease_base64url: encodeBytes(value.lease, `placement-${index}-lease`),
    observed_at_ms: value.observed_at_ms,
    offer_base64url: encodeBytes(value.offer, `placement-${index}-offer`),
    revocations_base64url: encodeByteArray(value.revocations, `placement-${index}-revocations`),
    shard_index: value.shard_index,
    usage_receipts_base64url: encodeByteArray(value.usage_receipts, `placement-${index}-usage-receipts`)
  });
}

function decodePlacement(value, index) {
  exactKeys(value, RECORD_KEYS, `placement-${index}`);
  if (!Number.isSafeInteger(value.shard_index) || value.shard_index < 0 || value.shard_index > 2) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", `placement-${index}-shard`);
  }
  decimal(value.observed_at_ms, `placement-${index}-observed`);
  return Object.freeze({
    consumption_announcements: decodeByteArray(
      value.consumption_announcements_base64url,
      `placement-${index}-announcements`
    ),
    execution_receipts: decodeByteArray(
      value.execution_receipts_base64url,
      `placement-${index}-execution-receipts`
    ),
    lease: decodeBytes(value.lease_base64url, `placement-${index}-lease`),
    observed_at_ms: value.observed_at_ms,
    offer: decodeBytes(value.offer_base64url, `placement-${index}-offer`),
    revocations: decodeByteArray(value.revocations_base64url, `placement-${index}-revocations`),
    shard_index: value.shard_index,
    usage_receipts: decodeByteArray(value.usage_receipts_base64url, `placement-${index}-usage-receipts`)
  });
}

function proofSummary(evaluation) {
  return evaluation.placements
    .filter(({ status }) => status === "proved")
    .map((placement) => Object.freeze({
      challenge_sequence: placement.challenge_sequence,
      issued_at_ms: placement.issued_at_ms,
      lease_id: placement.lease_id,
      provider_id: placement.provider_id,
      receipt_id: placement.receipt_id,
      shard_index: placement.shard_index,
      workload_id: placement.workload_id
    }))
    .sort((left, right) => left.shard_index - right.shard_index);
}

function repairSummary(evaluation, manifest, liveness) {
  const failedByShard = new Map(liveness.cases
    .filter(({ status }) => status === "failed")
    .map((entry) => [entry.shard_index, entry]));
  const intents = evaluation.repair_shard_indexes.map((shardIndex) => Object.freeze({
    action: "place-shard",
    failure_certificate_ids: Object.freeze(
      failedByShard.get(shardIndex)?.certificate_ids ?? []
    ),
    failure_challenge_id: failedByShard.get(shardIndex)?.challenge_id ?? null,
    failed_provider_id: failedByShard.get(shardIndex)?.provider_id ?? null,
    requires_committed_successor_generation: true,
    requires_liveness_reconciliation_at_execution: true,
    requires_new_provider: true,
    requires_signed_execution_receipt: true,
    shard_index: shardIndex,
    workload_id: manifest.descriptors[shardIndex].workload_id
  }));
  if (intents.some(({ failure_certificate_ids: ids }) => ids.length === 0)) {
    fail("E_LINEAGE_PLACEMENT_LIVENESS", "uncertified-repair-intent");
  }
  return intents;
}

function livenessSummary(liveness) {
  return liveness.cases.map((entry) => Object.freeze({ ...entry }));
}

function evaluateBoundLiveness({
  baseline,
  certificates,
  lineageParentHash,
  manifestId,
  placements,
  responses
}) {
  let liveness;
  try {
    liveness = evaluatePlacementLivenessEvidence({ certificates, responses });
  } catch (error) {
    fail("E_LINEAGE_PLACEMENT_LIVENESS", error?.code ?? "invalid-evidence");
  }
  if (liveness.status === "halted") {
    fail("E_LINEAGE_PLACEMENT_LIVENESS", "contested-or-forked-evidence");
  }
  for (const item of liveness.cases) {
    if (
      item.lineage_parent_hash !== lineageParentHash ||
      item.manifest_id !== manifestId
    ) fail("E_LINEAGE_PLACEMENT_LIVENESS", "lineage-or-manifest-binding");
    const placementIndex = baseline.placements.findIndex((candidate) =>
      candidate.shard_index === item.shard_index &&
      candidate.provider_id === item.provider_id);
    const placement = baseline.placements[placementIndex];
    if (
      !placement || !placement.receipt_id || !placement.challenge_sequence ||
      placement.lease_id !== item.lease_id ||
      placement.workload_id !== item.workload_id
    ) fail("E_LINEAGE_PLACEMENT_LIVENESS", "placement-binding");
    const offer = verifyResourceOffer(placements[placementIndex].offer);
    const lease = verifyResourceLease({
      lease: placements[placementIndex].lease,
      offer: placements[placementIndex].offer
    });
    if (!sameBytes(item.consumer, lease.body.consumer)) {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "lease-consumer-binding");
    }
    const agreedObserverPolicy = {
      max_faulty: offer.body.witness_policy.max_faulty,
      observers: offer.body.witness_policy.witnesses,
      threshold: offer.body.witness_policy.threshold
    };
    if (!sameBytes(item.observer_policy, agreedObserverPolicy)) {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "offer-witness-roster-binding");
    }
    if (item.status === "failed") {
      if (
        item.execution_receipt_ids.length !== 0 ||
        item.previous_execution_receipt_id !== placement.receipt_id ||
        Number(item.failure_sequence) !== Number(placement.challenge_sequence) + 1
      ) fail("E_LINEAGE_PLACEMENT_LIVENESS", "failure-predecessor-binding");
    } else if (item.status === "alive") {
      if (
        item.execution_receipt_ids.length !== 1 ||
        item.execution_receipt_ids[0] !== placement.receipt_id ||
        item.previous_execution_receipt_id !== placement.previous_execution_receipt_id ||
        item.failure_sequence !== placement.challenge_sequence
      ) fail("E_LINEAGE_PLACEMENT_LIVENESS", "response-receipt-binding");
    } else {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "unsupported-case-status");
    }
  }
  return liveness;
}

function sameBytes(left, right) {
  return encodeBase64Url(canonicalBytes(left)) === encodeBase64Url(canonicalBytes(right));
}

function generationBasis(value) {
  const { generation_id: ignored, ...basis } = value;
  return basis;
}

function parseManifest(bytes) {
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: MAX_DOCUMENT_BYTES, maxDepth: 32 });
  } catch {
    fail("E_LINEAGE_PLACEMENT_FORMAT", "manifest-json");
  }
  if (!isCanonical(bytes, value) || !Array.isArray(value.descriptors) || value.descriptors.length !== 3) {
    fail("E_LINEAGE_PLACEMENT_FORMAT", "manifest-canonical");
  }
  return value;
}

function transitionId(generationId) {
  if (!DIGEST.test(generationId)) fail("E_LINEAGE_PLACEMENT_GENERATION", "generation-id");
  return `placement-${generationId.slice("sha256:".length)}`;
}

function capsuleRecords(capsuleBytes) {
  const capsule = parseCanonical(capsuleBytes, "continuity-capsule").value;
  if (!Array.isArray(capsule.records)) fail("E_LINEAGE_PLACEMENT_COMMIT", "capsule-records");
  return capsule.records.map((record, index) => {
    if (!record || typeof record !== "object") fail("E_LINEAGE_PLACEMENT_COMMIT", `record-${index}`);
    const envelopeBytes = decodeBase64Url(record.envelope_base64url);
    const payloadBytes = decodeBase64Url(record.event_payload_base64url);
    if (!envelopeBytes || !payloadBytes) fail("E_LINEAGE_PLACEMENT_COMMIT", `record-${index}-encoding`);
    return Object.freeze({
      envelope: parseJsonBytes(envelopeBytes, { maxBytes: 1_048_576, maxDepth: 64 }),
      payload: parseJsonBytes(payloadBytes, { maxBytes: 1_048_576, maxDepth: 64 })
    });
  });
}

function placementTransitions(capsuleBytes, beforeIndex = Number.MAX_SAFE_INTEGER) {
  return capsuleRecords(capsuleBytes)
    .map((record, index) => Object.freeze({
      index,
      record,
      transition_id: recordTransitionId(record)
    }))
    .filter(({ index, transition_id: id }) =>
      index < beforeIndex && /^placement-[A-Za-z0-9_-]{43}$/u.test(id ?? ""))
    .map(({ index, record, transition_id }) => Object.freeze({
      head_hash: derivePulseHash(record.envelope.body),
      index,
      transition_id
    }));
}

function assertLatestPlacementPredecessor({
  capsuleBytes,
  generation,
  priorCommitHeadHash,
  priorGenerationId,
  beforeIndex = Number.MAX_SAFE_INTEGER
}) {
  const priorTransitions = placementTransitions(capsuleBytes, beforeIndex);
  if (generation === "1") {
    if (priorTransitions.length !== 0) {
      fail("E_LINEAGE_PLACEMENT_GENERATION", "generation-history-reset");
    }
    return;
  }
  const latest = priorTransitions[priorTransitions.length - 1];
  if (
    !latest ||
    latest.transition_id !== transitionId(priorGenerationId) ||
    latest.head_hash !== priorCommitHeadHash
  ) fail("E_LINEAGE_PLACEMENT_STALE", "stale-prior-generation");
}

function assertCurrentPlacementCommit(capsuleBytes, generation, commit) {
  const transitions = placementTransitions(capsuleBytes);
  const latest = transitions[transitions.length - 1];
  if (
    !latest ||
    latest.transition_id !== transitionId(generation.generation_id) ||
    latest.head_hash !== commit.lineage_head_hash
  ) fail("E_LINEAGE_PLACEMENT_STALE", "superseded-generation-plan");
}

function recordTransitionId({ envelope, payload }) {
  if (
    envelope?.kind !== "mortalos.pulse" ||
    envelope.body?.event?.kind !== "state-transition" ||
    payload?.format !== "mortalos-state-package-transition/1"
  ) return null;
  const inputBytes = decodeBase64Url(payload.input_base64url);
  if (!inputBytes) return null;
  try {
    return parseJsonBytes(inputBytes, { maxBytes: 4096, maxDepth: 8 })?.transition_id ?? null;
  } catch {
    return null;
  }
}

export function restoreLineagePlacementGeneration(generationBytes) {
  assertLineagePlacementRealm();
  const parsed = parseCanonical(generationBytes, "placement-generation");
  exactKeys(parsed.value, GENERATION_KEYS, "placement-generation");
  const value = parsed.value;
  if (value.format !== LINEAGE_PLACEMENT_FORMATS.generation || !DIGEST.test(value.generation_id)) {
    fail("E_LINEAGE_PLACEMENT_GENERATION", "format-or-id");
  }
  decimal(value.generation, "generation", 1);
  tagged(value.organism_id, "organism-id");
  tagged(value.lineage_parent_hash, "lineage-parent-hash");
  if (
    (value.prior_generation_id !== null && !DIGEST.test(value.prior_generation_id)) ||
    (value.prior_commit_head_hash !== null && !DIGEST.test(value.prior_commit_head_hash))
  ) fail("E_LINEAGE_PLACEMENT_GENERATION", "prior-binding");
  if (
    (value.generation === "1" && (value.prior_generation_id !== null || value.prior_commit_head_hash !== null)) ||
    (value.generation !== "1" && (value.prior_generation_id === null || value.prior_commit_head_hash === null))
  ) fail("E_LINEAGE_PLACEMENT_GENERATION", "prior-generation-shape");
  if (domainHash(DOMAINS.generation, canonicalBytes(generationBasis(value))) !== value.generation_id) {
    fail("E_LINEAGE_PLACEMENT_GENERATION", "id-mismatch");
  }
  const manifestBytes = decodeBytes(value.manifest_base64url, "manifest");
  const placements = value.placements.map(decodePlacement);
  const baseline = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: value.evaluated_at_ms,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: value.max_proof_age_ms,
    placements,
    quorum: value.quorum,
    target_shards: value.target_shards,
    unavailable_provider_ids: []
  });
  const certificates = decodeLivenessEvidence(
    value.failure_certificates_base64url,
    "failure-certificates"
  );
  const responses = decodeLivenessEvidence(
    value.liveness_responses_base64url,
    "liveness-responses"
  );
  const liveness = evaluateBoundLiveness({
    baseline,
    certificates,
    lineageParentHash: value.lineage_parent_hash,
    manifestId: baseline.manifest_id,
    placements,
    responses
  });
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: value.evaluated_at_ms,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: value.max_proof_age_ms,
    placements,
    quorum: value.quorum,
    target_shards: value.target_shards,
    unavailable_provider_ids: liveness.failed_provider_ids
  });
  const manifest = parseManifest(manifestBytes);
  if (
    evaluation.manifest_id !== value.manifest_id ||
    evaluation.status !== value.status ||
    !sameBytes(livenessSummary(liveness), value.liveness_cases) ||
    !sameBytes(proofSummary(evaluation), value.proofs) ||
    !sameBytes(repairSummary(evaluation, manifest, liveness), value.repair_intents)
  ) fail("E_LINEAGE_PLACEMENT_GENERATION", "evidence-summary-mismatch");
  return Object.freeze({
    bytes: parsed.bytes,
    evaluation,
    generation: value.generation,
    generation_id: value.generation_id,
    lineage_parent_hash: value.lineage_parent_hash,
    liveness,
    manifest_bytes: manifestBytes,
    organism_id: value.organism_id,
    placements: Object.freeze(placements),
    prior_commit_head_hash: value.prior_commit_head_hash,
    prior_generation_id: value.prior_generation_id,
    proofs: Object.freeze(value.proofs),
    repair_intents: Object.freeze(value.repair_intents),
    value: Object.freeze(value)
  });
}

export function createLineagePlacementGeneration(options) {
  options = exactKeys(options, [
    "capsule_bytes",
    "evaluated_at_ms",
    "manifest_bytes",
    "max_proof_age_ms",
    "placements",
    "prior_commit_bytes",
    "prior_generation_bytes",
    "quorum",
    "target_shards",
    "failure_certificates",
    "liveness_responses"
  ], "generation-options");
  const capsuleBytes = ownedBytes(options.capsule_bytes, "continuity-capsule");
  const continuity = inspectContinuity({ capsuleBytes });
  const manifestBytes = ownedBytes(options.manifest_bytes, "manifest");
  const encodedPlacements = copiedArray(options.placements, "placements", 64)
    .map(encodePlacement);
  const encodedCertificates = encodeLivenessEvidence(
    options.failure_certificates,
    "failure-certificates"
  );
  const encodedResponses = encodeLivenessEvidence(
    options.liveness_responses,
    "liveness-responses"
  );
  const certificates = decodeLivenessEvidence(encodedCertificates, "failure-certificates");
  const responses = decodeLivenessEvidence(encodedResponses, "liveness-responses");
  const baseline = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: options.evaluated_at_ms,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: options.max_proof_age_ms,
    placements: encodedPlacements.map(decodePlacement),
    quorum: options.quorum,
    target_shards: options.target_shards,
    unavailable_provider_ids: []
  });
  const manifest = parseManifest(manifestBytes);
  const liveness = evaluateBoundLiveness({
    baseline,
    certificates,
    lineageParentHash: continuity.head_hash,
    manifestId: baseline.manifest_id,
    placements: encodedPlacements.map(decodePlacement),
    responses
  });
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: options.evaluated_at_ms,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: options.max_proof_age_ms,
    placements: encodedPlacements.map(decodePlacement),
    quorum: options.quorum,
    target_shards: options.target_shards,
    unavailable_provider_ids: liveness.failed_provider_ids
  });
  let generation = 1;
  let priorCommitHeadHash = null;
  let priorGenerationId = null;
  const hasPriorGeneration = options.prior_generation_bytes !== null;
  const hasPriorCommit = options.prior_commit_bytes !== null;
  if (hasPriorGeneration !== hasPriorCommit) fail("E_LINEAGE_PLACEMENT_GENERATION", "prior-pair-required");
  if (hasPriorGeneration) {
    const prior = restoreLineagePlacementGeneration(options.prior_generation_bytes);
    const priorCommit = verifyLineagePlacementCommit({
      capsule_bytes: capsuleBytes,
      commit_bytes: options.prior_commit_bytes,
      generation_bytes: prior.bytes
    });
    if (prior.organism_id !== continuity.organism_id || prior.value.manifest_id !== evaluation.manifest_id) {
      fail("E_LINEAGE_PLACEMENT_GENERATION", "prior-lineage-or-manifest");
    }
    generation = decimal(prior.generation, "prior-generation", 1) + 1;
    priorCommitHeadHash = priorCommit.lineage_head_hash;
    priorGenerationId = prior.generation_id;
    assertLatestPlacementPredecessor({
      capsuleBytes,
      generation: String(generation),
      priorCommitHeadHash,
      priorGenerationId
    });
  } else if (capsuleRecords(capsuleBytes).some((record) =>
    /^placement-[A-Za-z0-9_-]{43}$/u.test(recordTransitionId(record) ?? ""))) {
    fail("E_LINEAGE_PLACEMENT_GENERATION", "generation-history-reset");
  }
  const basis = {
    evaluated_at_ms: options.evaluated_at_ms,
    failure_certificates_base64url: encodedCertificates,
    format: LINEAGE_PLACEMENT_FORMATS.generation,
    generation: String(generation),
    lineage_parent_hash: continuity.head_hash,
    liveness_cases: livenessSummary(liveness),
    liveness_responses_base64url: encodedResponses,
    manifest_base64url: encodeBase64Url(manifestBytes),
    manifest_id: evaluation.manifest_id,
    max_proof_age_ms: options.max_proof_age_ms,
    organism_id: continuity.organism_id,
    placements: encodedPlacements,
    prior_commit_head_hash: priorCommitHeadHash,
    prior_generation_id: priorGenerationId,
    proofs: proofSummary(evaluation),
    quorum: options.quorum,
    repair_intents: repairSummary(evaluation, manifest, liveness),
    status: evaluation.status,
    target_shards: options.target_shards
  };
  const value = Object.freeze({
    ...basis,
    generation_id: domainHash(DOMAINS.generation, canonicalBytes(basis))
  });
  return restoreLineagePlacementGeneration(canonicalBytes(value));
}

function parseCommit(commitBytes) {
  const parsed = parseCanonical(commitBytes, "placement-commit", 64 * 1024);
  exactKeys(parsed.value, [
    "commit_id",
    "format",
    "generation",
    "generation_id",
    "lineage_head_hash",
    "organism_id",
    "parent_head_hash",
    "transition_id"
  ], "placement-commit");
  const value = parsed.value;
  if (value.format !== LINEAGE_PLACEMENT_FORMATS.commit || !DIGEST.test(value.commit_id)) {
    fail("E_LINEAGE_PLACEMENT_COMMIT", "format-or-id");
  }
  const { commit_id: ignored, ...basis } = value;
  if (domainHash(DOMAINS.commit, canonicalBytes(basis)) !== value.commit_id) {
    fail("E_LINEAGE_PLACEMENT_COMMIT", "id-mismatch");
  }
  return Object.freeze({ bytes: parsed.bytes, value: Object.freeze(value) });
}

function snapshotLineagePlacementCommitInvocation(options) {
  exactKeys(options, ["authority", "capsule_bytes", "generation_bytes"], "commit-options");
  const [authority, capsuleSource, generationSource] = snapshotNamedOwnDataValues(
    options,
    ["authority", "capsule_bytes", "generation_bytes"],
    "lineage placement commit options"
  );
  const capsuleBytes = ownedBytes(capsuleSource, "continuity-capsule");
  const generation = restoreLineagePlacementGeneration(generationSource);
  const continuity = inspectContinuity({ capsuleBytes });
  return Object.freeze({ authority, capsuleBytes, continuity, generation });
}

export async function commitLineagePlacementGeneration(options) {
  const { authority, capsuleBytes, continuity, generation } =
    snapshotLineagePlacementCommitInvocation(options);
  if (
    generation.organism_id !== continuity.organism_id ||
    generation.lineage_parent_hash !== continuity.head_hash
  ) fail("E_LINEAGE_PLACEMENT_STALE", "generation-parent");
  assertLatestPlacementPredecessor({
    capsuleBytes,
    generation: generation.generation,
    priorCommitHeadHash: generation.prior_commit_head_hash,
    priorGenerationId: generation.prior_generation_id
  });
  const transition = transitionId(generation.generation_id);
  const continued = await continueContinuity({
    authority,
    capsuleBytes,
    expectedHeadHash: generation.lineage_parent_hash,
    transitionId: transition
  });
  const basis = {
    format: LINEAGE_PLACEMENT_FORMATS.commit,
    generation: generation.generation,
    generation_id: generation.generation_id,
    lineage_head_hash: continued.head_hash,
    organism_id: generation.organism_id,
    parent_head_hash: generation.lineage_parent_hash,
    transition_id: transition
  };
  const commit = Object.freeze({
    ...basis,
    commit_id: domainHash(DOMAINS.commit, canonicalBytes(basis))
  });
  const commitBytes = canonicalBytes(commit);
  verifyLineagePlacementCommit({
    capsule_bytes: continued.capsule_bytes,
    commit_bytes: commitBytes,
    generation_bytes: generation.bytes
  });
  return Object.freeze({
    ...continued,
    commit,
    commit_bytes: commitBytes,
    commit_id: commit.commit_id,
    generation_id: generation.generation_id
  });
}

export function verifyLineagePlacementCommit(options) {
  options = exactKeys(
    options,
    ["capsule_bytes", "commit_bytes", "generation_bytes"],
    "verify-commit-options"
  );
  const capsuleBytes = ownedBytes(options.capsule_bytes, "continuity-capsule");
  const verifiedCapsule = verifyContinuityCapsule(capsuleBytes);
  const generation = restoreLineagePlacementGeneration(options.generation_bytes);
  const commit = parseCommit(options.commit_bytes);
  const value = commit.value;
  if (
    value.generation !== generation.generation ||
    value.generation_id !== generation.generation_id ||
    value.organism_id !== generation.organism_id ||
    value.parent_head_hash !== generation.lineage_parent_hash ||
    value.transition_id !== transitionId(generation.generation_id) ||
    verifiedCapsule.organism_id !== generation.organism_id
  ) fail("E_LINEAGE_PLACEMENT_COMMIT", "generation-binding");
  const records = capsuleRecords(capsuleBytes);
  const matchesTransition = ({ envelope, payload }, parentHash, headHash, expectedTransition) => {
    if (
      envelope?.kind !== "mortalos.pulse" ||
      envelope.body?.event?.kind !== "state-transition" ||
      envelope.body?.parent_hash !== parentHash ||
      derivePulseHash(envelope.body) !== headHash ||
      payload?.format !== "mortalos-state-package-transition/1"
    ) return false;
    return recordTransitionId({ envelope, payload }) === expectedTransition;
  };
  const matchingIndexes = records
    .map((record, index) => matchesTransition(
      record,
      generation.lineage_parent_hash,
      value.lineage_head_hash,
      value.transition_id
    ) ? index : -1)
    .filter((index) => index >= 0);
  if (matchingIndexes.length !== 1) {
    fail("E_LINEAGE_PLACEMENT_COMMIT", "lineage-transition-missing-or-ambiguous");
  }
  const matchingIndex = matchingIndexes[0];
  try {
    assertLatestPlacementPredecessor({
      beforeIndex: matchingIndex,
      capsuleBytes,
      generation: generation.generation,
      priorCommitHeadHash: generation.prior_commit_head_hash,
      priorGenerationId: generation.prior_generation_id
    });
  } catch (error) {
    fail("E_LINEAGE_PLACEMENT_COMMIT", error?.detail ?? "stale-prior-generation");
  }
  return Object.freeze({
    bytes: commit.bytes,
    commit_id: value.commit_id,
    generation: value.generation,
    generation_id: value.generation_id,
    lineage_head_hash: value.lineage_head_hash,
    organism_id: value.organism_id,
    parent_head_hash: value.parent_head_hash,
    status: "verified"
  });
}

export function deriveCommittedPlacementActionPlan(options) {
  options = exactKeys(options, [
    "capsule_bytes",
    "commit_bytes",
    "generation_bytes",
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements"
  ], "action-plan-options");
  const generation = restoreLineagePlacementGeneration(options.generation_bytes);
  const commit = verifyLineagePlacementCommit({
    capsule_bytes: options.capsule_bytes,
    commit_bytes: options.commit_bytes,
    generation_bytes: options.generation_bytes
  });
  assertCurrentPlacementCommit(options.capsule_bytes, generation, commit);
  const encodedResponses = encodeLivenessEvidence(
    options.observed_liveness_responses,
    "observed-liveness-responses"
  );
  const responses = decodeLivenessEvidence(encodedResponses, "observed-liveness-responses");
  let reconciled = generation.liveness;
  if (responses.length === 0) {
    const observedPlacements = copiedArray(options.observed_placements, "observed-placements", 64);
    if (options.observed_at_ms !== null || observedPlacements.length !== 0) {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "empty-reconciliation-shape");
    }
  } else {
    if (options.observed_at_ms === null) {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "current-placement-evidence-required");
    }
    const currentPlacements = copiedArray(options.observed_placements, "observed-placements", 64)
      .map(encodePlacement)
      .map(decodePlacement);
    const currentBaseline = evaluateConfidentialStoragePlacements({
      evaluated_at_ms: options.observed_at_ms,
      manifest_bytes: generation.manifest_bytes,
      max_proof_age_ms: generation.value.max_proof_age_ms,
      placements: currentPlacements,
      quorum: generation.value.quorum,
      target_shards: generation.value.target_shards,
      unavailable_provider_ids: []
    });
    evaluateBoundLiveness({
      baseline: currentBaseline,
      certificates: [],
      lineageParentHash: generation.lineage_parent_hash,
      manifestId: generation.value.manifest_id,
      placements: currentPlacements,
      responses
    });
    const certificates = decodeLivenessEvidence(
      generation.value.failure_certificates_base64url,
      "failure-certificates"
    );
    try {
      reconciled = evaluatePlacementLivenessEvidence({ certificates, responses });
    } catch (error) {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", error?.code ?? "reconciliation-invalid");
    }
    if (reconciled.status === "halted") {
      fail("E_LINEAGE_PLACEMENT_LIVENESS", "late-proof-conflict");
    }
  }
  return Object.freeze({
    format: LINEAGE_PLACEMENT_FORMATS.action_plan,
    generation: generation.generation,
    generation_id: generation.generation_id,
    liveness_status: reconciled.status,
    non_capability: true,
    organism_id: generation.organism_id,
    planned_repair_actions: Object.freeze(generation.repair_intents.map((intent) => Object.freeze({
      ...intent,
      commit_id: commit.commit_id,
      generation_id: generation.generation_id,
      manifest_id: generation.value.manifest_id
    }))),
    requires_executor_reverification: true,
    commit_id: commit.commit_id,
    status: generation.value.status,
    verified_placement_receipt_ids: Object.freeze(
      generation.proofs.map(({ receipt_id: id }) => id).sort()
    )
  });
}

export function convergeLineagePlacementCommits(options) {
  options = exactKeys(options, ["candidates"], "convergence-options");
  const candidateSources = copiedArray(options.candidates, "convergence-candidates", 256);
  if (candidateSources.length < 1) {
    fail("E_LINEAGE_PLACEMENT_LIMIT", "convergence-candidates");
  }
  const snapshots = candidateSources.map((candidate, index) => {
    candidate = exactKeys(
      candidate,
      ["capsule_bytes", "commit_bytes", "generation_bytes"],
      `candidate-${index}`
    );
    return Object.freeze({
      capsule_bytes: ownedBytes(candidate.capsule_bytes, `candidate-${index}-capsule`),
      commit_bytes: ownedBytes(candidate.commit_bytes, `candidate-${index}-commit`, 64 * 1024),
      generation_bytes: ownedBytes(candidate.generation_bytes, `candidate-${index}-generation`)
    });
  });
  const uniqueInputs = new Map();
  for (const snapshot of snapshots) {
    const key = [snapshot.capsule_bytes, snapshot.commit_bytes, snapshot.generation_bytes]
      .map(encodeBase64Url)
      .join(".");
    uniqueInputs.set(key, snapshot);
  }
  const verified = [...uniqueInputs.values()].map((candidate) => {
    const generation = restoreLineagePlacementGeneration(candidate.generation_bytes);
    const commit = verifyLineagePlacementCommit(candidate);
    return Object.freeze({ commit, generation });
  });
  const organisms = new Set(verified.map(({ generation }) => generation.organism_id));
  let reason = null;
  if (organisms.size !== 1) reason = "organism-fork";
  const byGeneration = new Map();
  for (const candidate of verified) {
    const entries = byGeneration.get(candidate.generation.generation) ?? [];
    if (!entries.some(({ commit, generation }) =>
      commit.commit_id === candidate.commit.commit_id && generation.generation_id === candidate.generation.generation_id)) {
      entries.push(candidate);
    }
    byGeneration.set(candidate.generation.generation, entries);
  }
  if ([...byGeneration.values()].some((entries) => entries.length > 1)) reason ??= "generation-fork";
  const unique = [...byGeneration.values()]
    .flatMap((entries) => entries.slice(0, 1))
    .sort((left, right) => Number(left.generation.generation) - Number(right.generation.generation));
  if (reason === null && unique[0].generation.generation !== "1") reason = "incomplete-chain";
  for (let index = 1; index < unique.length && reason === null; index += 1) {
    const previous = unique[index - 1];
    const current = unique[index];
    if (
      Number(current.generation.generation) !== Number(previous.generation.generation) + 1 ||
      current.generation.prior_generation_id !== previous.generation.generation_id ||
      current.generation.prior_commit_head_hash !== previous.commit.lineage_head_hash
    ) reason = "lineage-fork";
  }
  const selected = reason === null ? unique.at(-1) : null;
  const basis = {
    candidate_commit_ids: [...new Set(verified.map(({ commit }) => commit.commit_id))].sort(),
    format: LINEAGE_PLACEMENT_FORMATS.convergence,
    organism_id: organisms.size === 1 ? unique[0].generation.organism_id : null,
    reason,
    selected_commit_id: selected?.commit.commit_id ?? null,
    selected_generation_id: selected?.generation.generation_id ?? null,
    status: reason === null ? "converged" : "halted"
  };
  const value = Object.freeze({
    ...basis,
    convergence_id: domainHash(DOMAINS.convergence, canonicalBytes(basis))
  });
  return Object.freeze({ bytes: canonicalBytes(value), value });
}
