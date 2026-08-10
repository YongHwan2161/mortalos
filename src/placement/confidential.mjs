import {
  asBytes,
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  isSharedByteView
} from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import { deriveResourceExecutionWorkloadId } from "../crypto.mjs";
import { domainHash } from "../confidential/format.mjs";
import { verifyConfidentialPackage } from "../confidential/package.mjs";
import {
  createResourceContentCommitment,
  verifyResourceExecutionReceipt
} from "../resource-execution.mjs";
import { verifyResourceOffer } from "../resource-contract.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import {
  arraySlice,
  arraySort,
  arrayValueAt,
  bigInt,
  bigIntToString,
  copyOwnDataArray,
  createArray,
  createMap,
  createSet,
  createUint8Array,
  createWeakMap,
  defineArrayIndex,
  freeze,
  mapGet,
  mapSet,
  mapValues,
  objectHasOwn,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  setAdd,
  setHas,
  snapshotOwnDataRecord,
  stringSlice,
  typedArraySubarray,
  weakMapGet,
  weakMapSet
} from "../primordials.mjs";
import {
  STORAGE_PLACEMENT_STATUS,
  StoragePlacementError,
  evaluateStoragePlacements
} from "./storage.mjs";

export const CONFIDENTIAL_PLACEMENT_FORMATS = Object.freeze({
  journal: "mortalos-confidential-placement-journal/2",
  legacy_journal: "mortalos-confidential-placement-journal/1",
  manifest: "mortalos-confidential-placement-manifest/1",
  reproof_context: "mortalos-confidential-placement-reproof-context/1",
  shard: "mortalos-confidential-placement-shard/1"
});

const DOMAINS = Object.freeze({
  chain: "MortalOS confidential placement receipt chain v1",
  epoch: "MortalOS confidential placement journal epoch v1",
  journal: "MortalOS confidential placement journal v2",
  legacyJournal: "MortalOS confidential placement journal v1",
  manifest: "MortalOS confidential placement manifest v1",
  package: "MortalOS confidential placement package v1",
  reproofContext: "MortalOS confidential placement reproof context v1",
  reproofNonce: "MortalOS confidential placement reproof challenge nonce v1",
  shard: "MortalOS confidential placement shard v1"
});
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const PEER_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const RESOURCE_LEASE_ID = /^resource-lease:[A-Za-z0-9_-]{43}$/u;
const RESOURCE_EXECUTION_RECEIPT_ID = /^resource-execution:[A-Za-z0-9_-]{43}$/u;
const WORKLOAD_ID = /^resource-workload:[A-Za-z0-9_-]{43}$/u;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
export const CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS = freeze({
  document_bytes: PROTOCOL_PROFILE.placement_journal.document_bytes,
  epoch_nonce_bytes: PROTOCOL_PROFILE.placement_journal.epoch_nonce_bytes,
  head_transitions_max: PROTOCOL_PROFILE.placement_journal.head_transitions_max,
  high_waters_per_shard_max:
    PROTOCOL_PROFILE.placement_journal.high_waters_per_shard_max,
  high_waters_total_max: PROTOCOL_PROFILE.placement_journal.high_waters_total_max,
  reproof_nonce_bytes: PROTOCOL_PROFILE.placement_journal.reproof_nonce_bytes
});
const RECORD_KEYS = Object.freeze([
  "consumption_announcements",
  "execution_receipts",
  "lease",
  "observed_at_ms",
  "offer",
  "revocations",
  "shard_index",
  "usage_receipts"
]);
const EVALUATION_KEYS = Object.freeze([
  "evaluated_at_ms",
  "manifest_bytes",
  "max_proof_age_ms",
  "placements",
  "quorum",
  "target_shards",
  "unavailable_provider_ids"
]);
const JOURNAL_CREATE_KEYS = Object.freeze([
  "evaluation",
  "prior_journal_bytes",
  "reproof_context_bytes"
]);
const REPROOF_CONTEXT_CREATE_KEYS = Object.freeze([
  "epoch_nonce",
  "generation",
  "manifest_bytes",
  "max_proof_age_ms",
  "prior_journal_bytes",
  "quorum",
  "rotate_epoch",
  "target_shards"
]);
const REPROOF_EVALUATION_KEYS = Object.freeze([
  "evaluated_at_ms",
  "placements",
  "prior_journal_bytes",
  "reproof_context_bytes",
  "unavailable_provider_ids"
]);
const REPROOF_NONCE_KEYS = Object.freeze([
  "challenge_sequence",
  "lease_id",
  "previous_execution_receipt_id",
  "provider_id",
  "reproof_context_bytes",
  "shard_index",
  "workload_id"
]);
const JOURNAL_EVALUATION_KEYS = Object.freeze([
  "evaluated_at_ms",
  "journal_bytes",
  "placements",
  "reproof_context_bytes",
  "unavailable_provider_ids"
]);
const evaluationRecords = createWeakMap();
const reproofEvaluationRecords = createWeakMap();

function registerEvaluation(result, { manifestId, maximumAge, quorum, targetShards }) {
  const receiptBarriers = createArray();
  let barrierCount = 0;
  for (let index = 0; index < result.placements.length; index += 1) {
    const placement = result.placements[index];
    if (
      placement.status !== "proved" &&
      placement.status !== "stale" &&
      placement.status !== "unavailable"
    ) continue;
    defineArrayIndex(receiptBarriers, barrierCount, freeze({
      challenge_nonce: placement.challenge_nonce,
      challenge_sequence: placement.challenge_sequence,
      lease_id: placement.lease_id,
      previous_execution_receipt_id: placement.previous_execution_receipt_id,
      provider_id: placement.provider_id,
      receipt_id: placement.receipt_id,
      shard_index: placement.shard_index,
      workload_id: placement.workload_id
    }));
    barrierCount += 1;
  }
  if (barrierCount > 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "evaluation contains ambiguous receipt barriers");
  }
  if (quorum !== 2 || targetShards !== 3 || barrierCount !== 3) return result;
  arraySort(receiptBarriers, (left, right) => left.shard_index - right.shard_index);
  for (let index = 0; index < receiptBarriers.length; index += 1) {
    if (receiptBarriers[index].shard_index !== index) {
      fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "evaluation receipt barriers are incomplete");
    }
    for (let prior = 0; prior < index; prior += 1) {
      if (receiptBarriers[prior].provider_id === receiptBarriers[index].provider_id) {
        fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "evaluation receipt providers are ambiguous");
      }
    }
  }
  weakMapSet(evaluationRecords, result, freeze({
    manifest_id: manifestId,
    max_proof_age_ms: maximumAge,
    proofs: freeze(receiptBarriers),
    quorum,
    target_shards: targetShards
  }));
  return result;
}

function fail(code, message) {
  throw new StoragePlacementError(code, message);
}

function requireIntactRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", "realm intrinsic drift is not allowed");
  }
}

function snapshotExactDataRecord(value, expectedKeys, label) {
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must contain only own data properties`);
  }
  requireIntactRealm();
  const keys = ownKeys(descriptors);
  if (keys.length !== expectedKeys.length) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} has unknown or missing fields`);
  }
  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (!objectHasOwn(descriptors, expectedKeys[index])) {
      fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} has unknown or missing fields`);
    }
  }
  return descriptors;
}

function dataValue(descriptors, property) {
  return ownDataRecordEntry(descriptors, property).value;
}

function ownedDataArray(value, label, maximum) {
  let owned;
  try {
    owned = copyOwnDataArray(value, label);
  } catch {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be a dense own-data array`);
  }
  requireIntactRealm();
  if (owned.length > maximum) {
    fail("E_CONFIDENTIAL_PLACEMENT_LIMIT", `${label} exceeds its bounded length`);
  }
  return owned;
}

function ownedDocumentArray(value, label, maximum) {
  const sources = ownedDataArray(value, label, maximum);
  const documents = createArray(sources.length);
  for (let index = 0; index < sources.length; index += 1) {
    defineArrayIndex(documents, index, ownedBytes(sources[index], `${label}/${index}`));
  }
  return freeze(documents);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} has unknown or missing fields`);
  }
}

function ownedBytes(value, label, maximum = MAX_DOCUMENT_BYTES) {
  if (isSharedByteView(value)) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must not use shared memory`);
  }
  const source = asBytes(value);
  const length = source === null ? null : byteLengthOfBytes(source);
  if (source === null || length === null || length < 1 || length > maximum) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be bounded bytes`);
  }
  return createUint8Array(source);
}

function parseCanonical(bytes, label, maximum = MAX_DOCUMENT_BYTES) {
  const owned = ownedBytes(bytes, label, maximum);
  let value;
  try {
    value = parseJsonBytes(owned, { maxBytes: maximum, maxDepth: 24 });
  } catch {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be canonical JSON`);
  }
  if (!isCanonical(owned, value)) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be canonical JSON`);
  }
  return Object.freeze({ bytes: owned, value });
}

function decimal(value, label, { maximum = Number.MAX_SAFE_INTEGER, minimum = 0 } = {}) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be a canonical decimal string`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail("E_CONFIDENTIAL_PLACEMENT_LIMIT", `${label} is outside its bounded range`);
  }
  return parsed;
}

function workloadId(bytes) {
  return deriveResourceExecutionWorkloadId({
    kind: "storage",
    workload: createResourceContentCommitment(bytes)
  });
}

function shardEnvelope({ index, packageDigest, packageLength, payload }) {
  const value = {
    format: CONFIDENTIAL_PLACEMENT_FORMATS.shard,
    package_bytes: String(packageLength),
    package_digest: packageDigest,
    payload_base64url: encodeBase64Url(payload),
    payload_digest: domainHash(DOMAINS.shard, payload),
    shard_index: index
  };
  return Object.freeze({ bytes: canonicalBytes(value), value: Object.freeze(value) });
}

function verifyManifest(manifestBytes) {
  const parsed = parseCanonical(manifestBytes, "placement manifest");
  exactKeys(
    parsed.value,
    ["data_shards", "descriptors", "format", "manifest_id", "package_bytes", "package_digest", "shard_bytes", "total_shards"],
    "placement manifest"
  );
  const value = parsed.value;
  if (
    value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.manifest ||
    value.data_shards !== 2 || value.total_shards !== 3 ||
    !DIGEST.test(value.package_digest) || !DIGEST.test(value.manifest_id)
  ) fail("E_CONFIDENTIAL_PLACEMENT_MANIFEST", "unsupported or invalid placement manifest");
  const packageLength = decimal(value.package_bytes, "package_bytes", { minimum: 1, maximum: MAX_DOCUMENT_BYTES });
  const shardLength = decimal(value.shard_bytes, "shard_bytes", { minimum: 1, maximum: MAX_DOCUMENT_BYTES });
  if (shardLength !== Math.ceil(packageLength / 2)) {
    fail("E_CONFIDENTIAL_PLACEMENT_MANIFEST", "shard size is not bound to package size");
  }
  if (!Array.isArray(value.descriptors) || value.descriptors.length !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_MANIFEST", "exactly three shard descriptors are required");
  }
  const descriptors = value.descriptors.map((descriptor, index) => {
    exactKeys(descriptor, ["shard_digest", "shard_index", "shard_bytes", "workload_id"], `descriptor ${index}`);
    if (
      descriptor.shard_index !== index ||
      descriptor.shard_bytes !== value.shard_bytes ||
      !DIGEST.test(descriptor.shard_digest) ||
      !WORKLOAD_ID.test(descriptor.workload_id)
    ) fail("E_CONFIDENTIAL_PLACEMENT_MANIFEST", `descriptor ${index} is invalid`);
    return Object.freeze({ ...descriptor });
  });
  const basis = {
    data_shards: value.data_shards,
    descriptors: value.descriptors,
    format: value.format,
    package_bytes: value.package_bytes,
    package_digest: value.package_digest,
    shard_bytes: value.shard_bytes,
    total_shards: value.total_shards
  };
  if (domainHash(DOMAINS.manifest, canonicalBytes(basis)) !== value.manifest_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_MANIFEST", "manifest ID mismatch");
  }
  return Object.freeze({
    bytes: parsed.bytes,
    descriptors: Object.freeze(descriptors),
    manifest_id: value.manifest_id,
    package_bytes: packageLength,
    package_digest: value.package_digest,
    shard_bytes: shardLength,
    value: Object.freeze(value)
  });
}

function verifyShard(bytes, manifest) {
  const parsed = parseCanonical(bytes, "placement shard");
  exactKeys(
    parsed.value,
    ["format", "package_bytes", "package_digest", "payload_base64url", "payload_digest", "shard_index"],
    "placement shard"
  );
  const value = parsed.value;
  if (
    value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.shard ||
    value.package_bytes !== String(manifest.package_bytes) ||
    value.package_digest !== manifest.package_digest ||
    !Number.isSafeInteger(value.shard_index) || value.shard_index < 0 || value.shard_index > 2
  ) fail("E_CONFIDENTIAL_PLACEMENT_SHARD", "shard basis mismatch");
  const payload = decodeBase64Url(value.payload_base64url);
  const descriptor = manifest.descriptors[value.shard_index];
  if (
    !payload || payload.byteLength !== manifest.shard_bytes ||
    value.payload_digest !== domainHash(DOMAINS.shard, payload) ||
    descriptor.shard_digest !== value.payload_digest ||
    descriptor.workload_id !== workloadId(parsed.bytes)
  ) fail("E_CONFIDENTIAL_PLACEMENT_SHARD", "shard content or workload mismatch");
  return Object.freeze({
    bytes: parsed.bytes,
    index: value.shard_index,
    payload,
    workload_id: descriptor.workload_id
  });
}

export function createConfidentialPlacementShardSet({ confidential_package_bytes: packageBytes }) {
  const ownedPackage = ownedBytes(packageBytes, "confidential package");
  verifyConfidentialPackage({ packageBytes: ownedPackage });
  const packageDigest = domainHash(DOMAINS.package, ownedPackage);
  const shardLength = Math.ceil(ownedPackage.byteLength / 2);
  const left = new Uint8Array(shardLength);
  const right = new Uint8Array(shardLength);
  left.set(ownedPackage.slice(0, shardLength));
  right.set(ownedPackage.slice(shardLength));
  const parity = new Uint8Array(shardLength);
  for (let index = 0; index < shardLength; index += 1) parity[index] = left[index] ^ right[index];
  const envelopes = [left, right, parity].map((payload, index) =>
    shardEnvelope({ index, packageDigest, packageLength: ownedPackage.byteLength, payload }));
  const descriptors = envelopes.map(({ bytes, value }, index) => Object.freeze({
    shard_bytes: String(shardLength),
    shard_digest: value.payload_digest,
    shard_index: index,
    workload_id: workloadId(bytes)
  }));
  const basis = {
    data_shards: 2,
    descriptors,
    format: CONFIDENTIAL_PLACEMENT_FORMATS.manifest,
    package_bytes: String(ownedPackage.byteLength),
    package_digest: packageDigest,
    shard_bytes: String(shardLength),
    total_shards: 3
  };
  const manifest = Object.freeze({
    ...basis,
    manifest_id: domainHash(DOMAINS.manifest, canonicalBytes(basis))
  });
  const manifestBytes = canonicalBytes(manifest);
  return Object.freeze({
    manifest,
    manifest_bytes: manifestBytes,
    shards: Object.freeze(envelopes.map(({ bytes }, index) => Object.freeze({
      bytes,
      descriptor: descriptors[index],
      shard_index: index,
      workload_id: descriptors[index].workload_id
    })))
  });
}

export function reconstructConfidentialPackage({ manifest_bytes: manifestBytes, shard_bytes: shardBytes }) {
  const manifest = verifyManifest(manifestBytes);
  if (!Array.isArray(shardBytes) || shardBytes.length < 2 || shardBytes.length > 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_QUORUM", "two or three shard documents are required");
  }
  const verified = shardBytes.map((bytes) => verifyShard(bytes, manifest));
  if (new Set(verified.map(({ index }) => index)).size !== verified.length) {
    fail("E_CONFIDENTIAL_PLACEMENT_QUORUM", "shard indexes must be distinct");
  }
  const byIndex = new Map(verified.map((shard) => [shard.index, shard.payload]));
  let left;
  let right;
  if (byIndex.has(0) && byIndex.has(1)) {
    left = byIndex.get(0);
    right = byIndex.get(1);
  } else if (byIndex.has(0) && byIndex.has(2)) {
    left = byIndex.get(0);
    right = new Uint8Array(manifest.shard_bytes);
    for (let index = 0; index < right.byteLength; index += 1) right[index] = left[index] ^ byIndex.get(2)[index];
  } else if (byIndex.has(1) && byIndex.has(2)) {
    right = byIndex.get(1);
    left = new Uint8Array(manifest.shard_bytes);
    for (let index = 0; index < left.byteLength; index += 1) left[index] = right[index] ^ byIndex.get(2)[index];
  } else {
    fail("E_CONFIDENTIAL_PLACEMENT_QUORUM", "two independent shard indexes are required");
  }
  const packageBytes = concatBytes(left, right).slice(0, manifest.package_bytes);
  if (domainHash(DOMAINS.package, packageBytes) !== manifest.package_digest) {
    fail("E_CONFIDENTIAL_PLACEMENT_PACKAGE", "reconstructed package digest mismatch");
  }
  verifyConfidentialPackage({ packageBytes });
  return Object.freeze({
    confidential_package_bytes: packageBytes,
    manifest_id: manifest.manifest_id,
    shard_indexes: Object.freeze([...byIndex.keys()].sort())
  });
}

function placementRecord(value, index) {
  const descriptors = snapshotExactDataRecord(value, RECORD_KEYS, `placement ${index}`);
  const shardIndex = dataValue(descriptors, "shard_index");
  const observedAt = dataValue(descriptors, "observed_at_ms");
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex > 2) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `placement ${index} shard index is invalid`);
  }
  if (typeof observedAt !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(observedAt)) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `placement ${index} observed_at_ms is invalid`);
  }
  return freeze({
    shard_index: shardIndex,
    record: freeze({
      consumption_announcements: ownedDocumentArray(
        dataValue(descriptors, "consumption_announcements"),
        `placement ${index} consumption announcements`,
        64
      ),
      execution_receipts: ownedDocumentArray(
        dataValue(descriptors, "execution_receipts"),
        `placement ${index} execution receipts`,
        4_096
      ),
      lease: ownedBytes(dataValue(descriptors, "lease"), `placement ${index} lease`),
      observed_at_ms: observedAt,
      offer: ownedBytes(dataValue(descriptors, "offer"), `placement ${index} offer`),
      revocations: ownedDocumentArray(
        dataValue(descriptors, "revocations"),
        `placement ${index} revocations`,
        32
      ),
      usage_receipts: ownedDocumentArray(
        dataValue(descriptors, "usage_receipts"),
        `placement ${index} usage receipts`,
        4_096
      )
    })
  });
}

function rejected(shardIndex, reason, extra = {}) {
  return Object.freeze({
    challenge_nonce: null,
    challenge_sequence: null,
    issued_at_ms: null,
    lease_id: null,
    previous_execution_receipt_id: null,
    provider_id: null,
    reason,
    receipt_id: null,
    shard_index: shardIndex,
    status: "rejected",
    workload_id: null,
    ...extra
  });
}

function evaluatePlacement(
  snapshot,
  descriptor,
  unavailable,
  evaluatedAt,
  evaluatedAtMs,
  maximumAge
) {
  const { record, shard_index: shardIndex } = snapshot;
  if (shardIndex !== descriptor.shard_index) return rejected(shardIndex, "shard-descriptor-mismatch");
  // The outer record timestamp is historical carrier metadata, not authority for
  // a current generation. Contract status and proof age must share one instant.
  const generationBoundRecord = freeze({
    ...record,
    observed_at_ms: evaluatedAtMs
  });
  const basicEvaluation = evaluateStoragePlacements({
    expected_workload_id: descriptor.workload_id,
    placements: [generationBoundRecord],
    quorum: 1,
    target_copies: 1,
    unavailable_provider_ids: []
  });
  requireIntactRealm();
  const basic = basicEvaluation.placements[0];
  if (basic.status !== "proved") {
    return rejected(shardIndex, basic.reason, {
      lease_id: basic.lease_id,
      provider_id: basic.provider_id,
      workload_id: basic.workload_id
    });
  }
  const offer = verifyResourceOffer(record.offer);
  requireIntactRealm();
  const receiptCount = record.execution_receipts.length;
  const last = verifyResourceExecutionReceipt({
    offer: record.offer,
    lease: record.lease,
    previous_execution_receipts: arraySlice(record.execution_receipts, 0, receiptCount - 1),
    usage_receipts: record.usage_receipts,
    receipt: receiptCount < 1
      ? undefined
      : arrayValueAt(record.execution_receipts, receiptCount - 1)
  });
  requireIntactRealm();
  const issuedAt = decimal(last.challenge.body.issued_at_ms, "challenge issued_at_ms");
  const age = evaluatedAt - issuedAt;
  const common = {
    challenge_nonce: last.challenge.body.challenge_nonce,
    challenge_sequence: last.challenge.body.challenge_sequence,
    issued_at_ms: last.challenge.body.issued_at_ms,
    lease_id: basic.lease_id,
    previous_execution_receipt_id: last.challenge.body.previous_execution_receipt_id,
    provider_id: offer.body.provider.key_id,
    receipt_id: last.receipt_id,
    shard_index: shardIndex,
    workload_id: last.body.workload_id
  };
  if (age < 0) return rejected(shardIndex, "future-proof", common);
  if (age > maximumAge) return freeze({ ...common, reason: "stale-proof", status: "stale" });
  if (setHas(unavailable, common.provider_id)) {
    return freeze({ ...common, reason: "transport-unavailable", status: "unavailable" });
  }
  return freeze({ ...common, reason: null, status: "proved" });
}

function summarizePlacements({ manifest, placements, quorum, targetShards }) {
  let availableCount = 0;
  const availableIndexes = createSet();
  for (let index = 0; index < placements.length; index += 1) {
    if (placements[index].status !== "proved") continue;
    availableCount += 1;
    setAdd(availableIndexes, placements[index].shard_index);
  }
  const repairShardIndexes = createArray();
  let repairCount = 0;
  for (let index = 0; index < manifest.descriptors.length; index += 1) {
    const shardIndex = manifest.descriptors[index].shard_index;
    if (setHas(availableIndexes, shardIndex)) continue;
    defineArrayIndex(repairShardIndexes, repairCount, shardIndex);
    repairCount += 1;
  }
  const status = availableCount >= targetShards
    ? STORAGE_PLACEMENT_STATUS.proved
    : availableCount >= quorum
      ? STORAGE_PLACEMENT_STATUS.repairing
      : STORAGE_PLACEMENT_STATUS.unavailable;
  return freeze({
    available_shards: availableCount,
    manifest_id: manifest.manifest_id,
    placements: freeze(placements),
    quorum,
    repair_shard_indexes: freeze(repairShardIndexes),
    status,
    target_shards: targetShards
  });
}

export function evaluateConfidentialStoragePlacements(options) {
  requireIntactRealm();
  const optionDescriptors = snapshotExactDataRecord(
    options,
    EVALUATION_KEYS,
    "confidential placement evaluation options"
  );
  const manifestBytes = dataValue(optionDescriptors, "manifest_bytes");
  const evaluatedAtText = dataValue(optionDescriptors, "evaluated_at_ms");
  const maximumAgeText = dataValue(optionDescriptors, "max_proof_age_ms");
  const placementSources = ownedDataArray(
    dataValue(optionDescriptors, "placements"),
    "confidential placement records",
    16
  );
  const quorum = dataValue(optionDescriptors, "quorum");
  const targetShards = dataValue(optionDescriptors, "target_shards");
  const unavailableProviderIds = ownedDataArray(
    dataValue(optionDescriptors, "unavailable_provider_ids"),
    "unavailable provider IDs",
    64
  );
  requireIntactRealm();
  const manifest = verifyManifest(manifestBytes);
  requireIntactRealm();
  const evaluatedAt = decimal(evaluatedAtText, "evaluated_at_ms");
  const maximumAge = decimal(maximumAgeText, "max_proof_age_ms", { minimum: 1 });
  if (
    !Number.isSafeInteger(quorum) || quorum < 2 ||
    !Number.isSafeInteger(targetShards) || targetShards < quorum || targetShards > 3
  ) fail("E_CONFIDENTIAL_PLACEMENT_POLICY", "2-of-3 compatible quorum and target required");
  for (let index = 0; index < unavailableProviderIds.length; index += 1) {
    if (typeof unavailableProviderIds[index] !== "string") {
      fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", "unavailable provider IDs must be strings");
    }
  }
  const unavailable = createSet();
  for (let index = 0; index < unavailableProviderIds.length; index += 1) {
    setAdd(unavailable, unavailableProviderIds[index]);
  }
  let placements = createArray(placementSources.length);
  for (let index = 0; index < placementSources.length; index += 1) {
    let evaluated;
    try {
      const snapshot = placementRecord(placementSources[index], index);
      evaluated = evaluatePlacement(
        snapshot,
        manifest.descriptors[snapshot.shard_index],
        unavailable,
        evaluatedAt,
        evaluatedAtText,
        maximumAge
      );
    } catch {
      requireIntactRealm();
      evaluated = rejected(null, "invalid-evidence");
    }
    defineArrayIndex(placements, index, evaluated);
  }
  const providerCounts = createMap();
  const shardCounts = createMap();
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (
      placement.status === "proved" ||
      placement.status === "unavailable" ||
      placement.status === "stale"
    ) {
      mapSet(
        providerCounts,
        placement.provider_id,
        (mapGet(providerCounts, placement.provider_id) ?? 0) + 1
      );
      mapSet(
        shardCounts,
        placement.shard_index,
        (mapGet(shardCounts, placement.shard_index) ?? 0) + 1
      );
    }
  }
  const deduplicated = createArray(placements.length);
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (placement.provider_id && (mapGet(providerCounts, placement.provider_id) ?? 0) > 1) {
      defineArrayIndex(
        deduplicated,
        index,
        freeze({ ...placement, reason: "duplicate-provider", status: "rejected" })
      );
      continue;
    }
    if (
      placement.shard_index !== null &&
      (mapGet(shardCounts, placement.shard_index) ?? 0) > 1
    ) {
      defineArrayIndex(
        deduplicated,
        index,
        freeze({ ...placement, reason: "duplicate-shard", status: "rejected" })
      );
      continue;
    }
    defineArrayIndex(deduplicated, index, placement);
  }
  placements = deduplicated;
  requireIntactRealm();
  const result = summarizePlacements({
    manifest,
    placements,
    quorum,
    targetShards
  });
  requireIntactRealm();
  return registerEvaluation(
    result,
    {
      manifestId: manifest.manifest_id,
      maximumAge: maximumAgeText,
      quorum,
      targetShards
    }
  );
}

function nextDecimal(value, label) {
  decimal(value, label, {
    maximum: CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max
  });
  const next = bigInt(value) + 1n;
  if (next > bigInt(CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max)) {
    fail("E_CONFIDENTIAL_PLACEMENT_LIMIT", `${label} cannot advance`);
  }
  return bigIntToString(next);
}

function restoreLegacyJournalParsed(parsed) {
  exactKeys(
    parsed.value,
    [
      "format",
      "generation",
      "journal_id",
      "manifest_base64url",
      "manifest_id",
      "max_proof_age_ms",
      "proofs",
      "quorum",
      "target_shards"
    ],
    "legacy placement journal"
  );
  const value = parsed.value;
  if (
    value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.legacy_journal ||
    !DIGEST.test(value.journal_id)
  ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "legacy journal format is invalid");
  decimal(value.generation, "legacy journal generation", {
    maximum: CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max
  });
  decimal(value.max_proof_age_ms, "legacy journal max_proof_age_ms", { minimum: 1 });
  if (value.quorum !== 2 || value.target_shards !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "legacy journal policy is invalid");
  }
  const manifestBytes = decodeBase64Url(value.manifest_base64url);
  if (!manifestBytes) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "legacy journal manifest is invalid");
  const manifest = verifyManifest(manifestBytes);
  const proofs = ownedDataArray(value.proofs, "legacy journal proofs", 3);
  if (manifest.manifest_id !== value.manifest_id || proofs.length !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "legacy journal manifest or proofs are invalid");
  }
  const restoredProofs = createArray(3);
  for (let index = 0; index < proofs.length; index += 1) {
    const proof = proofs[index];
    exactKeys(
      proof,
      ["challenge_sequence", "provider_id", "receipt_id", "shard_index"],
      `legacy journal proof ${index}`
    );
    if (
      !PEER_ID.test(proof.provider_id) ||
      !RESOURCE_EXECUTION_RECEIPT_ID.test(proof.receipt_id) ||
      proof.shard_index !== index
    ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", `legacy journal proof ${index} is invalid`);
    decimal(proof.challenge_sequence, `legacy journal proof ${index} sequence`);
    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      if (
        restoredProofs[priorIndex].provider_id === proof.provider_id ||
        restoredProofs[priorIndex].receipt_id === proof.receipt_id
      ) fail(
        "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
        "legacy journal receipt barriers must be distinct"
      );
    }
    defineArrayIndex(restoredProofs, index, freeze({ ...proof }));
  }
  const basis = {
    format: value.format,
    generation: value.generation,
    manifest_base64url: value.manifest_base64url,
    manifest_id: value.manifest_id,
    max_proof_age_ms: value.max_proof_age_ms,
    proofs: value.proofs,
    quorum: value.quorum,
    target_shards: value.target_shards
  };
  if (domainHash(DOMAINS.legacyJournal, canonicalBytes(basis)) !== value.journal_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "legacy journal ID mismatch");
  }
  return freeze({
    bytes: parsed.bytes,
    format: value.format,
    generation: value.generation,
    journal_id: value.journal_id,
    manifest,
    max_proof_age_ms: value.max_proof_age_ms,
    migration_required: true,
    proofs: freeze(restoredProofs),
    quorum: value.quorum,
    target_shards: value.target_shards
  });
}

export function restoreLegacyConfidentialPlacementJournal(journalBytes) {
  requireIntactRealm();
  const parsed = parseCanonical(
    journalBytes,
    "legacy placement journal",
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes
  );
  requireIntactRealm();
  return restoreLegacyJournalParsed(parsed);
}

function restoreAnyPriorJournal(journalBytes) {
  if (journalBytes === null) return null;
  const parsed = parseCanonical(
    journalBytes,
    "prior placement journal",
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes
  );
  requireIntactRealm();
  if (parsed.value?.format === CONFIDENTIAL_PLACEMENT_FORMATS.legacy_journal) {
    return restoreLegacyJournalParsed(parsed);
  }
  return restoreConfidentialPlacementJournal(parsed.bytes);
}

function epochId({ epochNonceBase64Url, epochParentJournalId, manifestId }) {
  return domainHash(DOMAINS.epoch, canonicalBytes({
    epoch_nonce_base64url: epochNonceBase64Url,
    epoch_parent_journal_id: epochParentJournalId,
    manifest_id: manifestId
  }));
}

export function createConfidentialPlacementReproofContext(options) {
  requireIntactRealm();
  const descriptors = snapshotExactDataRecord(
    options,
    REPROOF_CONTEXT_CREATE_KEYS,
    "confidential placement reproof context options"
  );
  const epochNonceSource = dataValue(descriptors, "epoch_nonce");
  const generation = dataValue(descriptors, "generation");
  const manifestBytes = dataValue(descriptors, "manifest_bytes");
  const maximumAge = dataValue(descriptors, "max_proof_age_ms");
  const priorJournalBytes = dataValue(descriptors, "prior_journal_bytes");
  const quorum = dataValue(descriptors, "quorum");
  const rotateEpoch = dataValue(descriptors, "rotate_epoch");
  const targetShards = dataValue(descriptors, "target_shards");
  requireIntactRealm();
  const manifest = verifyManifest(manifestBytes);
  decimal(generation, "reproof generation", {
    minimum: 1,
    maximum: CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max
  });
  decimal(maximumAge, "reproof max_proof_age_ms", { minimum: 1 });
  if (quorum !== 2 || targetShards !== 3 || typeof rotateEpoch !== "boolean") {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "exact 2-of-3 reproof policy required");
  }
  const prior = restoreAnyPriorJournal(priorJournalBytes);
  if (prior === null && generation !== "1") {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "a new journal epoch must start at generation 1");
  }
  if (prior !== null) {
    if (
      generation !== nextDecimal(prior.generation, "prior journal generation") ||
      prior.manifest.manifest_id !== manifest.manifest_id ||
      prior.max_proof_age_ms !== maximumAge ||
      prior.quorum !== quorum || prior.target_shards !== targetShards
    ) fail(
      "E_CONFIDENTIAL_PLACEMENT_REPROOF",
      "reproof context must bind the exact prior head, next generation, manifest, and policy"
    );
  }
  let epochNonceBase64Url;
  let epochParentJournalId;
  let resolvedEpochId;
  if (rotateEpoch) {
    const epochNonce = ownedBytes(
      epochNonceSource,
      "placement journal epoch nonce",
      CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.epoch_nonce_bytes
    );
    if (epochNonce.byteLength !== CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.epoch_nonce_bytes) {
      fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "a 256-bit epoch nonce is required");
    }
    epochNonceBase64Url = encodeBase64Url(epochNonce);
    epochParentJournalId = prior?.journal_id ?? null;
    resolvedEpochId = epochId({
      epochNonceBase64Url,
      epochParentJournalId,
      manifestId: manifest.manifest_id
    });
  } else {
    if (epochNonceSource !== null || prior?.format !== CONFIDENTIAL_PLACEMENT_FORMATS.journal) {
      fail(
        "E_CONFIDENTIAL_PLACEMENT_REPROOF",
        "an existing v2 epoch or an explicit 256-bit rotation nonce is required"
      );
    }
    epochNonceBase64Url = prior.context.epoch_nonce_base64url;
    epochParentJournalId = prior.context.epoch_parent_journal_id;
    resolvedEpochId = prior.epoch_id;
  }
  const basis = {
    epoch_id: resolvedEpochId,
    epoch_nonce_base64url: epochNonceBase64Url,
    epoch_parent_journal_id: epochParentJournalId,
    format: CONFIDENTIAL_PLACEMENT_FORMATS.reproof_context,
    generation,
    manifest_base64url: encodeBase64Url(manifest.bytes),
    manifest_id: manifest.manifest_id,
    max_proof_age_ms: maximumAge,
    prior_journal_id: prior?.journal_id ?? null,
    quorum,
    rotate_epoch: rotateEpoch,
    target_shards: targetShards
  };
  const context = freeze({
    ...basis,
    context_id: domainHash(DOMAINS.reproofContext, canonicalBytes(basis))
  });
  requireIntactRealm();
  return freeze({
    bytes: canonicalBytes(context),
    context,
    context_id: context.context_id,
    epoch_id: context.epoch_id,
    generation: context.generation,
    manifest,
    reproof_context_id: context.context_id
  });
}

export function restoreConfidentialPlacementReproofContext(contextBytes) {
  requireIntactRealm();
  const parsed = parseCanonical(
    contextBytes,
    "placement reproof context",
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes
  );
  requireIntactRealm();
  exactKeys(
    parsed.value,
    [
      "context_id",
      "epoch_id",
      "epoch_nonce_base64url",
      "epoch_parent_journal_id",
      "format",
      "generation",
      "manifest_base64url",
      "manifest_id",
      "max_proof_age_ms",
      "prior_journal_id",
      "quorum",
      "rotate_epoch",
      "target_shards"
    ],
    "placement reproof context"
  );
  const value = parsed.value;
  const nonce = decodeBase64Url(value.epoch_nonce_base64url);
  if (
    value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.reproof_context ||
    !DIGEST.test(value.context_id) || !DIGEST.test(value.epoch_id) ||
    (value.prior_journal_id !== null && !DIGEST.test(value.prior_journal_id)) ||
    (value.epoch_parent_journal_id !== null && !DIGEST.test(value.epoch_parent_journal_id)) ||
    !nonce || nonce.byteLength !== CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.epoch_nonce_bytes ||
    typeof value.rotate_epoch !== "boolean"
  ) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof context format is invalid");
  decimal(value.generation, "reproof context generation", {
    minimum: 1,
    maximum: CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max
  });
  decimal(value.max_proof_age_ms, "reproof context max_proof_age_ms", { minimum: 1 });
  if (value.quorum !== 2 || value.target_shards !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof context policy is invalid");
  }
  if (value.prior_journal_id === null && value.generation !== "1") {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "a genesis reproof context must be generation 1");
  }
  if (
    (value.rotate_epoch && value.epoch_parent_journal_id !== value.prior_journal_id) ||
    (!value.rotate_epoch && value.prior_journal_id === null)
  ) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof epoch transition is invalid");
  const manifestBytes = decodeBase64Url(value.manifest_base64url);
  if (!manifestBytes) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof manifest is invalid");
  const manifest = verifyManifest(manifestBytes);
  if (manifest.manifest_id !== value.manifest_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof manifest binding is invalid");
  }
  if (epochId({
    epochNonceBase64Url: value.epoch_nonce_base64url,
    epochParentJournalId: value.epoch_parent_journal_id,
    manifestId: value.manifest_id
  }) !== value.epoch_id) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof epoch ID mismatch");
  const { context_id: ignoredContextId, ...basis } = value;
  if (domainHash(DOMAINS.reproofContext, canonicalBytes(basis)) !== value.context_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof context ID mismatch");
  }
  return freeze({
    bytes: parsed.bytes,
    context: freeze(value),
    context_id: value.context_id,
    epoch_id: value.epoch_id,
    epoch_nonce_base64url: value.epoch_nonce_base64url,
    epoch_parent_journal_id: value.epoch_parent_journal_id,
    format: value.format,
    generation: value.generation,
    manifest,
    max_proof_age_ms: value.max_proof_age_ms,
    prior_journal_id: value.prior_journal_id,
    quorum: value.quorum,
    reproof_context_id: value.context_id,
    rotate_epoch: value.rotate_epoch,
    target_shards: value.target_shards
  });
}

function receiptChainId({ leaseId, manifestId, providerId, shardIndex, workloadId }) {
  return domainHash(DOMAINS.chain, canonicalBytes({
    lease_id: leaseId,
    manifest_id: manifestId,
    provider_id: providerId,
    shard_index: shardIndex,
    workload_id: workloadId
  }));
}

function validateChainIdentity({
  challengeSequence,
  leaseId,
  previousReceiptId,
  providerId,
  shardIndex,
  workloadId
}) {
  if (
    !PEER_ID.test(providerId) || !RESOURCE_LEASE_ID.test(leaseId) ||
    !WORKLOAD_ID.test(workloadId) ||
    !Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex > 2 ||
    (previousReceiptId !== null && !RESOURCE_EXECUTION_RECEIPT_ID.test(previousReceiptId))
  ) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "receipt chain identity is invalid");
  decimal(challengeSequence, "receipt chain challenge sequence");
}

export function deriveConfidentialPlacementReproofNonce(options) {
  requireIntactRealm();
  const descriptors = snapshotExactDataRecord(
    options,
    REPROOF_NONCE_KEYS,
    "confidential placement reproof nonce options"
  );
  const challengeSequence = dataValue(descriptors, "challenge_sequence");
  const leaseId = dataValue(descriptors, "lease_id");
  const previousReceiptId = dataValue(descriptors, "previous_execution_receipt_id");
  const providerId = dataValue(descriptors, "provider_id");
  const reproofContextBytes = dataValue(descriptors, "reproof_context_bytes");
  const shardIndex = dataValue(descriptors, "shard_index");
  const workloadId = dataValue(descriptors, "workload_id");
  requireIntactRealm();
  const context = restoreConfidentialPlacementReproofContext(reproofContextBytes);
  validateChainIdentity({
    challengeSequence,
    leaseId,
    previousReceiptId,
    providerId,
    shardIndex,
    workloadId
  });
  const chainId = receiptChainId({
    leaseId,
    manifestId: context.manifest.manifest_id,
    providerId,
    shardIndex,
    workloadId
  });
  const digest = domainHash(DOMAINS.reproofNonce, canonicalBytes({
    challenge_sequence: challengeSequence,
    chain_id: chainId,
    context_id: context.context_id,
    previous_execution_receipt_id: previousReceiptId
  }));
  const raw = decodeBase64Url(stringSlice(digest, 7));
  if (!raw || raw.byteLength !== 32) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof nonce derivation failed");
  }
  return encodeBase64Url(typedArraySubarray(
    raw,
    0,
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.reproof_nonce_bytes
  ));
}

function bindPriorJournal(context, priorJournalBytes) {
  const prior = restoreAnyPriorJournal(priorJournalBytes);
  if (context.prior_journal_id === null) {
    if (prior !== null || context.generation !== "1") {
      fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "invalid genesis reproof context");
    }
    return freeze({ high_waters: freeze(createArray()), prior: null });
  }
  if (
    prior === null || prior.journal_id !== context.prior_journal_id ||
    context.generation !== nextDecimal(prior.generation, "prior journal generation") ||
    prior.manifest.manifest_id !== context.manifest.manifest_id ||
    prior.max_proof_age_ms !== context.max_proof_age_ms ||
    prior.quorum !== context.quorum || prior.target_shards !== context.target_shards
  ) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "reproof context does not match prior journal");
  if (context.rotate_epoch) {
    if (context.epoch_parent_journal_id !== prior.journal_id) {
      fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "rotated epoch parent mismatch");
    }
    return freeze({ high_waters: freeze(createArray()), prior });
  }
  if (
    prior.format !== CONFIDENTIAL_PLACEMENT_FORMATS.journal ||
    prior.epoch_id !== context.epoch_id ||
    prior.context.epoch_nonce_base64url !== context.epoch_nonce_base64url ||
    prior.context.epoch_parent_journal_id !== context.epoch_parent_journal_id
  ) fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "continued epoch binding mismatch");
  return freeze({ high_waters: prior.receipt_high_waters, prior });
}

function highWaterFromPlacement(placement, manifestId) {
  validateChainIdentity({
    challengeSequence: placement.challenge_sequence,
    leaseId: placement.lease_id,
    previousReceiptId: placement.previous_execution_receipt_id,
    providerId: placement.provider_id,
    shardIndex: placement.shard_index,
    workloadId: placement.workload_id
  });
  if (!RESOURCE_EXECUTION_RECEIPT_ID.test(placement.receipt_id)) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPROOF", "receipt ID is invalid");
  }
  return freeze({
    chain_id: receiptChainId({
      leaseId: placement.lease_id,
      manifestId,
      providerId: placement.provider_id,
      shardIndex: placement.shard_index,
      workloadId: placement.workload_id
    }),
    challenge_sequence: placement.challenge_sequence,
    lease_id: placement.lease_id,
    previous_execution_receipt_id: placement.previous_execution_receipt_id,
    provider_id: placement.provider_id,
    receipt_id: placement.receipt_id,
    shard_index: placement.shard_index,
    workload_id: placement.workload_id
  });
}

function rejectReproof(placement, reason) {
  return freeze({ ...placement, reason, status: "rejected" });
}

export function evaluateConfidentialPlacementReproof(options) {
  requireIntactRealm();
  const descriptors = snapshotExactDataRecord(
    options,
    REPROOF_EVALUATION_KEYS,
    "confidential placement reproof options"
  );
  const evaluatedAt = dataValue(descriptors, "evaluated_at_ms");
  const placements = dataValue(descriptors, "placements");
  const priorJournalBytes = dataValue(descriptors, "prior_journal_bytes");
  const reproofContextBytes = dataValue(descriptors, "reproof_context_bytes");
  const unavailableProviderIds = dataValue(descriptors, "unavailable_provider_ids");
  const context = restoreConfidentialPlacementReproofContext(reproofContextBytes);
  const boundPrior = bindPriorJournal(context, priorJournalBytes);
  const evaluated = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: evaluatedAt,
    manifest_bytes: context.manifest.bytes,
    max_proof_age_ms: context.max_proof_age_ms,
    placements,
    quorum: context.quorum,
    target_shards: context.target_shards,
    unavailable_provider_ids: unavailableProviderIds
  });
  requireIntactRealm();
  const previous = createMap();
  for (let index = 0; index < boundPrior.high_waters.length; index += 1) {
    const highWater = boundPrior.high_waters[index];
    mapSet(previous, highWater.chain_id, highWater);
  }
  const checked = createArray(evaluated.placements.length);
  const activeProofs = createArray();
  let activeCount = 0;
  for (let index = 0; index < evaluated.placements.length; index += 1) {
    let placement = evaluated.placements[index];
    if (placement.status === "proved") {
      const current = highWaterFromPlacement(placement, context.manifest.manifest_id);
      const expectedNonce = deriveConfidentialPlacementReproofNonce({
        challenge_sequence: placement.challenge_sequence,
        lease_id: placement.lease_id,
        previous_execution_receipt_id: placement.previous_execution_receipt_id,
        provider_id: placement.provider_id,
        reproof_context_bytes: context.bytes,
        shard_index: placement.shard_index,
        workload_id: placement.workload_id
      });
      const prior = mapGet(previous, current.chain_id);
      if (placement.challenge_nonce !== expectedNonce) {
        placement = rejectReproof(placement, "reproof-context-mismatch");
      } else if (prior === undefined) {
        if (
          placement.challenge_sequence !== "0" ||
          placement.previous_execution_receipt_id !== null
        ) placement = rejectReproof(placement, "restart-reproof-required");
      } else if (
        placement.challenge_sequence !== nextDecimal(
          prior.challenge_sequence,
          "prior receipt challenge sequence"
        ) ||
        placement.previous_execution_receipt_id !== prior.receipt_id
      ) {
        placement = rejectReproof(placement, "restart-reproof-required");
      }
      if (placement.status === "proved") {
        defineArrayIndex(activeProofs, activeCount, freeze({
          challenge_nonce: placement.challenge_nonce,
          ...current
        }));
        activeCount += 1;
      }
    }
    defineArrayIndex(checked, index, placement);
  }
  arraySort(activeProofs, (left, right) => left.shard_index - right.shard_index);
  const summary = summarizePlacements({
    manifest: context.manifest,
    placements: checked,
    quorum: context.quorum,
    targetShards: context.target_shards
  });
  const result = freeze({
    ...summary,
    context_id: context.context_id,
    epoch_id: context.epoch_id,
    generation: context.generation,
    prior_journal_id: context.prior_journal_id
  });
  if (
    activeProofs.length === 3 && result.status === STORAGE_PLACEMENT_STATUS.proved &&
    activeProofs[0].shard_index === 0 && activeProofs[1].shard_index === 1 &&
    activeProofs[2].shard_index === 2
  ) {
    weakMapSet(reproofEvaluationRecords, result, freeze({
      active_proofs: freeze(activeProofs),
      context_id: context.context_id,
      prior_journal_id: context.prior_journal_id
    }));
  }
  requireIntactRealm();
  return result;
}

function compareHighWaters(left, right) {
  if (left.shard_index !== right.shard_index) {
    return left.shard_index < right.shard_index ? -1 : 1;
  }
  if (left.chain_id === right.chain_id) return 0;
  return left.chain_id < right.chain_id ? -1 : 1;
}

function mergeHighWaters(previous, activeProofs) {
  const merged = createMap();
  for (let index = 0; index < previous.length; index += 1) {
    mapSet(merged, previous[index].chain_id, previous[index]);
  }
  for (let index = 0; index < activeProofs.length; index += 1) {
    const { challenge_nonce: ignoredNonce, ...highWater } = activeProofs[index];
    mapSet(merged, highWater.chain_id, freeze(highWater));
  }
  const entries = mapValues(merged);
  const values = createArray(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    defineArrayIndex(values, index, entries[index]);
  }
  if (values.length > CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_total_max) {
    fail("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT", "journal epoch history is full");
  }
  const shardCounts = [0, 0, 0];
  for (let index = 0; index < values.length; index += 1) {
    shardCounts[values[index].shard_index] += 1;
    if (
      shardCounts[values[index].shard_index] >
      CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_per_shard_max
    ) fail("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT", "journal shard history is full");
  }
  arraySort(values, compareHighWaters);
  return freeze(values);
}

export function createConfidentialPlacementJournal(options) {
  requireIntactRealm();
  const descriptors = snapshotExactDataRecord(
    options,
    JOURNAL_CREATE_KEYS,
    "confidential placement journal options"
  );
  const evaluation = dataValue(descriptors, "evaluation");
  const priorJournalBytes = dataValue(descriptors, "prior_journal_bytes");
  const reproofContextBytes = dataValue(descriptors, "reproof_context_bytes");
  const context = restoreConfidentialPlacementReproofContext(reproofContextBytes);
  const boundPrior = bindPriorJournal(context, priorJournalBytes);
  const record = weakMapGet(reproofEvaluationRecords, evaluation);
  if (
    !record || record.context_id !== context.context_id ||
    record.prior_journal_id !== context.prior_journal_id ||
    record.active_proofs.length !== 3
  ) fail(
    "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
    "verified context-bound three-shard reproof evaluation required"
  );
  const activeProofs = createArray(3);
  for (let index = 0; index < record.active_proofs.length; index += 1) {
    const proof = record.active_proofs[index];
    defineArrayIndex(activeProofs, index, freeze({
      challenge_nonce: proof.challenge_nonce,
      chain_id: proof.chain_id,
      challenge_sequence: proof.challenge_sequence,
      lease_id: proof.lease_id,
      previous_execution_receipt_id: proof.previous_execution_receipt_id,
      provider_id: proof.provider_id,
      receipt_id: proof.receipt_id,
      shard_index: proof.shard_index,
      workload_id: proof.workload_id
    }));
  }
  const highWaters = mergeHighWaters(boundPrior.high_waters, record.active_proofs);
  const basis = {
    active_proofs: freeze(activeProofs),
    epoch_id: context.epoch_id,
    format: CONFIDENTIAL_PLACEMENT_FORMATS.journal,
    generation: context.generation,
    manifest_base64url: encodeBase64Url(context.manifest.bytes),
    manifest_id: context.manifest.manifest_id,
    max_proof_age_ms: context.max_proof_age_ms,
    prior_journal_id: context.prior_journal_id,
    quorum: context.quorum,
    receipt_high_waters: highWaters,
    reproof_context_base64url: encodeBase64Url(context.bytes),
    reproof_context_id: context.context_id,
    target_shards: context.target_shards
  };
  const journal = freeze({
    ...basis,
    journal_id: domainHash(DOMAINS.journal, canonicalBytes(basis))
  });
  const bytes = canonicalBytes(journal);
  if (bytes.byteLength > CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes) {
    fail("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT", "journal document limit exceeded");
  }
  requireIntactRealm();
  return freeze({ bytes, journal, journal_id: journal.journal_id });
}

function restoreHighWater(value, manifestId, label, { challengeNonce = false } = {}) {
  const keys = challengeNonce
    ? [
      "challenge_nonce",
      "chain_id",
      "challenge_sequence",
      "lease_id",
      "previous_execution_receipt_id",
      "provider_id",
      "receipt_id",
      "shard_index",
      "workload_id"
    ]
    : [
      "chain_id",
      "challenge_sequence",
      "lease_id",
      "previous_execution_receipt_id",
      "provider_id",
      "receipt_id",
      "shard_index",
      "workload_id"
    ];
  exactKeys(value, keys, label);
  validateChainIdentity({
    challengeSequence: value.challenge_sequence,
    leaseId: value.lease_id,
    previousReceiptId: value.previous_execution_receipt_id,
    providerId: value.provider_id,
    shardIndex: value.shard_index,
    workloadId: value.workload_id
  });
  if (
    !DIGEST.test(value.chain_id) ||
    !RESOURCE_EXECUTION_RECEIPT_ID.test(value.receipt_id) ||
    (challengeNonce && (
      !decodeBase64Url(value.challenge_nonce) ||
      decodeBase64Url(value.challenge_nonce).byteLength !==
        CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.reproof_nonce_bytes
    )) ||
    value.chain_id !== receiptChainId({
      leaseId: value.lease_id,
      manifestId,
      providerId: value.provider_id,
      shardIndex: value.shard_index,
      workloadId: value.workload_id
    })
  ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", `${label} is invalid`);
  return freeze({ ...value });
}

export function restoreConfidentialPlacementJournal(journalBytes) {
  requireIntactRealm();
  const parsed = parseCanonical(
    journalBytes,
    "placement journal",
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.document_bytes
  );
  requireIntactRealm();
  if (parsed.value?.format === CONFIDENTIAL_PLACEMENT_FORMATS.legacy_journal) {
    restoreLegacyJournalParsed(parsed);
    fail("E_CONFIDENTIAL_PLACEMENT_MIGRATION", "v1 journal requires a fresh v2 epoch reproof");
  }
  exactKeys(
    parsed.value,
    [
      "active_proofs",
      "epoch_id",
      "format",
      "generation",
      "journal_id",
      "manifest_base64url",
      "manifest_id",
      "max_proof_age_ms",
      "prior_journal_id",
      "quorum",
      "receipt_high_waters",
      "reproof_context_base64url",
      "reproof_context_id",
      "target_shards"
    ],
    "placement journal"
  );
  const value = parsed.value;
  if (
    value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.journal ||
    !DIGEST.test(value.journal_id) || !DIGEST.test(value.epoch_id) ||
    !DIGEST.test(value.reproof_context_id) ||
    (value.prior_journal_id !== null && !DIGEST.test(value.prior_journal_id))
  ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal format is invalid");
  decimal(value.generation, "journal generation", {
    minimum: 1,
    maximum: CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.head_transitions_max
  });
  decimal(value.max_proof_age_ms, "journal max_proof_age_ms", { minimum: 1 });
  if (value.quorum !== 2 || value.target_shards !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal policy is invalid");
  }
  const manifestBytes = decodeBase64Url(value.manifest_base64url);
  const contextBytes = decodeBase64Url(value.reproof_context_base64url);
  if (!manifestBytes || !contextBytes) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal embedded documents are invalid");
  }
  const manifest = verifyManifest(manifestBytes);
  const context = restoreConfidentialPlacementReproofContext(contextBytes);
  if (
    manifest.manifest_id !== value.manifest_id ||
    context.context_id !== value.reproof_context_id ||
    context.epoch_id !== value.epoch_id || context.generation !== value.generation ||
    context.manifest.manifest_id !== value.manifest_id ||
    context.max_proof_age_ms !== value.max_proof_age_ms ||
    context.prior_journal_id !== value.prior_journal_id ||
    context.quorum !== value.quorum || context.target_shards !== value.target_shards
  ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal reproof binding is invalid");
  const activeSources = ownedDataArray(value.active_proofs, "journal active proofs", 3);
  const highWaterSources = ownedDataArray(
    value.receipt_high_waters,
    "journal receipt high waters",
    CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_total_max
  );
  if (activeSources.length !== 3 || highWaterSources.length < 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal active proofs or history are incomplete");
  }
  const activeProofs = createArray(3);
  const highWaters = createArray(highWaterSources.length);
  const activeProviders = createSet();
  const highWaterChains = createSet();
  const highWaterReceipts = createSet();
  const shardCounts = [0, 0, 0];
  for (let index = 0; index < activeSources.length; index += 1) {
    const proof = restoreHighWater(
      activeSources[index],
      manifest.manifest_id,
      `journal active proof ${index}`,
      { challengeNonce: true }
    );
    if (proof.shard_index !== index || setHas(activeProviders, proof.provider_id)) {
      fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal active proofs must be exact 3-of-3");
    }
    setAdd(activeProviders, proof.provider_id);
    const expectedNonce = deriveConfidentialPlacementReproofNonce({
      challenge_sequence: proof.challenge_sequence,
      lease_id: proof.lease_id,
      previous_execution_receipt_id: proof.previous_execution_receipt_id,
      provider_id: proof.provider_id,
      reproof_context_bytes: context.bytes,
      shard_index: proof.shard_index,
      workload_id: proof.workload_id
    });
    if (proof.challenge_nonce !== expectedNonce) {
      fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal active proof context mismatch");
    }
    defineArrayIndex(activeProofs, index, proof);
  }
  for (let index = 0; index < highWaterSources.length; index += 1) {
    const highWater = restoreHighWater(
      highWaterSources[index],
      manifest.manifest_id,
      `journal receipt high water ${index}`
    );
    if (
      (index > 0 && compareHighWaters(highWaters[index - 1], highWater) >= 0) ||
      setHas(highWaterChains, highWater.chain_id) ||
      setHas(highWaterReceipts, highWater.receipt_id)
    ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal receipt history is ambiguous");
    setAdd(highWaterChains, highWater.chain_id);
    setAdd(highWaterReceipts, highWater.receipt_id);
    shardCounts[highWater.shard_index] += 1;
    if (
      shardCounts[highWater.shard_index] >
      CONFIDENTIAL_PLACEMENT_JOURNAL_LIMITS.high_waters_per_shard_max
    ) fail("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT", "journal shard history is full");
    defineArrayIndex(highWaters, index, highWater);
  }
  for (let index = 0; index < activeProofs.length; index += 1) {
    const active = activeProofs[index];
    let matched = false;
    for (let historyIndex = 0; historyIndex < highWaters.length; historyIndex += 1) {
      const highWater = highWaters[historyIndex];
      if (highWater.chain_id !== active.chain_id) continue;
      if (
        highWater.challenge_sequence !== active.challenge_sequence ||
        highWater.receipt_id !== active.receipt_id
      ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "active proof is not the receipt high water");
      matched = true;
      break;
    }
    if (!matched) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "active proof is absent from history");
  }
  const { journal_id: ignoredJournalId, ...basis } = value;
  if (domainHash(DOMAINS.journal, canonicalBytes(basis)) !== value.journal_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal ID mismatch");
  }
  requireIntactRealm();
  return freeze({
    active_proofs: freeze(activeProofs),
    bytes: parsed.bytes,
    context,
    epoch_id: value.epoch_id,
    format: value.format,
    generation: value.generation,
    journal_id: value.journal_id,
    manifest,
    max_proof_age_ms: value.max_proof_age_ms,
    prior_journal_id: value.prior_journal_id,
    proofs: freeze(activeProofs),
    quorum: value.quorum,
    receipt_high_waters: freeze(highWaters),
    reproof_context_id: value.reproof_context_id,
    target_shards: value.target_shards
  });
}

export function evaluateConfidentialPlacementJournal(options) {
  requireIntactRealm();
  const descriptors = snapshotExactDataRecord(
    options,
    JOURNAL_EVALUATION_KEYS,
    "confidential placement journal evaluation options"
  );
  const evaluatedAt = dataValue(descriptors, "evaluated_at_ms");
  const journalBytes = dataValue(descriptors, "journal_bytes");
  const placements = dataValue(descriptors, "placements");
  const reproofContextBytes = dataValue(descriptors, "reproof_context_bytes");
  const unavailableProviderIds = dataValue(descriptors, "unavailable_provider_ids");
  requireIntactRealm();
  const journal = restoreConfidentialPlacementJournal(journalBytes);
  const evaluated = evaluateConfidentialPlacementReproof({
    evaluated_at_ms: evaluatedAt,
    placements,
    prior_journal_bytes: journal.bytes,
    reproof_context_bytes: reproofContextBytes,
    unavailable_provider_ids: unavailableProviderIds
  });
  return freeze({ ...evaluated, journal_id: journal.journal_id });
}

export function planConfidentialStorageRepair(evaluation) {
  if (!evaluation || !Array.isArray(evaluation.repair_shard_indexes)) {
    fail("E_CONFIDENTIAL_PLACEMENT_REPAIR", "verified evaluation required");
  }
  return Object.freeze({
    actions: Object.freeze(evaluation.repair_shard_indexes.map((shardIndex) => Object.freeze({
      action: "place-shard",
      requires_new_provider: true,
      requires_signed_execution_receipt: true,
      shard_index: shardIndex
    }))),
    status: evaluation.repair_shard_indexes.length === 0 ? "satisfied" : "repair-required"
  });
}
