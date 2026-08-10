import {
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url
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
import {
  arraySlice,
  arraySort,
  arrayValueAt,
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
  objectHasOwn,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  setAdd,
  setHas,
  snapshotOwnDataRecord,
  weakMapGet,
  weakMapSet
} from "../primordials.mjs";
import {
  STORAGE_PLACEMENT_STATUS,
  StoragePlacementError,
  evaluateStoragePlacements
} from "./storage.mjs";

export const CONFIDENTIAL_PLACEMENT_FORMATS = Object.freeze({
  journal: "mortalos-confidential-placement-journal/1",
  manifest: "mortalos-confidential-placement-manifest/1",
  shard: "mortalos-confidential-placement-shard/1"
});

const DOMAINS = Object.freeze({
  journal: "MortalOS confidential placement journal v1",
  manifest: "MortalOS confidential placement manifest v1",
  package: "MortalOS confidential placement package v1",
  shard: "MortalOS confidential placement shard v1"
});
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const PEER_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const RESOURCE_EXECUTION_RECEIPT_ID = /^resource-execution:[A-Za-z0-9_-]{43}$/u;
const WORKLOAD_ID = /^resource-workload:[A-Za-z0-9_-]{43}$/u;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
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
  "generation",
  "manifest_bytes",
  "max_proof_age_ms",
  "quorum",
  "target_shards"
]);
const evaluationRecords = createWeakMap();

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
      challenge_sequence: placement.challenge_sequence,
      provider_id: placement.provider_id,
      receipt_id: placement.receipt_id,
      shard_index: placement.shard_index
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
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > maximum) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `${label} must be bounded bytes`);
  }
  return createUint8Array(value);
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

export function createConfidentialPlacementJournal(options) {
  requireIntactRealm();
  const optionDescriptors = snapshotExactDataRecord(
    options,
    JOURNAL_CREATE_KEYS,
    "confidential placement journal options"
  );
  const evaluation = dataValue(optionDescriptors, "evaluation");
  const generation = dataValue(optionDescriptors, "generation");
  const manifestBytes = dataValue(optionDescriptors, "manifest_bytes");
  const maximumAge = dataValue(optionDescriptors, "max_proof_age_ms");
  const quorum = dataValue(optionDescriptors, "quorum");
  const targetShards = dataValue(optionDescriptors, "target_shards");
  requireIntactRealm();
  const manifest = verifyManifest(manifestBytes);
  requireIntactRealm();
  const parsedGeneration = decimal(generation, "generation");
  decimal(maximumAge, "max_proof_age_ms", { minimum: 1 });
  const record = weakMapGet(evaluationRecords, evaluation);
  if (
    !record || record.manifest_id !== manifest.manifest_id ||
    record.max_proof_age_ms !== maximumAge ||
    record.quorum !== quorum || record.target_shards !== targetShards
  ) fail(
    "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
    "verified evaluation and exact journal policy binding required"
  );
  if (
    record.quorum !== 2 || record.target_shards !== 3 || record.proofs.length !== 3
  ) fail(
    "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
    "journal v1 requires a complete three-shard receipt barrier"
  );
  for (let index = 0; index < record.proofs.length; index += 1) {
    const proof = record.proofs[index];
    if (proof.shard_index !== index) {
      fail(
        "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
        "journal v1 requires one receipt barrier for each shard"
      );
    }
    for (let prior = 0; prior < index; prior += 1) {
      if (record.proofs[prior].provider_id === proof.provider_id) {
        fail(
          "E_CONFIDENTIAL_PLACEMENT_JOURNAL",
          "journal v1 requires distinct receipt-barrier providers"
        );
      }
    }
  }
  const proofs = createArray(record.proofs.length);
  for (let index = 0; index < record.proofs.length; index += 1) {
    const proof = record.proofs[index];
    defineArrayIndex(proofs, index, {
      challenge_sequence: proof.challenge_sequence,
      provider_id: proof.provider_id,
      receipt_id: proof.receipt_id,
      shard_index: proof.shard_index
    });
  }
  const basis = {
    format: CONFIDENTIAL_PLACEMENT_FORMATS.journal,
    generation: String(parsedGeneration),
    manifest_base64url: encodeBase64Url(manifest.bytes),
    manifest_id: manifest.manifest_id,
    max_proof_age_ms: maximumAge,
    proofs,
    quorum,
    target_shards: targetShards
  };
  const journal = freeze({
    ...basis,
    journal_id: domainHash(DOMAINS.journal, canonicalBytes(basis))
  });
  requireIntactRealm();
  return freeze({ bytes: canonicalBytes(journal), journal, journal_id: journal.journal_id });
}

export function restoreConfidentialPlacementJournal(journalBytes) {
  requireIntactRealm();
  const parsed = parseCanonical(journalBytes, "placement journal", 2 * 1024 * 1024);
  requireIntactRealm();
  exactKeys(
    parsed.value,
    ["format", "generation", "journal_id", "manifest_base64url", "manifest_id", "max_proof_age_ms", "proofs", "quorum", "target_shards"],
    "placement journal"
  );
  const value = parsed.value;
  if (value.format !== CONFIDENTIAL_PLACEMENT_FORMATS.journal || !DIGEST.test(value.journal_id)) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal format is invalid");
  }
  decimal(value.generation, "generation");
  decimal(value.max_proof_age_ms, "max_proof_age_ms", { minimum: 1 });
  if (value.quorum !== 2 || value.target_shards !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal policy is invalid");
  }
  const manifestBytes = decodeBase64Url(value.manifest_base64url);
  if (!manifestBytes) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal manifest is invalid");
  const manifest = verifyManifest(manifestBytes);
  if (manifest.manifest_id !== value.manifest_id || !Array.isArray(value.proofs) || value.proofs.length !== 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal manifest or proofs are invalid");
  }
  const proofs = value.proofs.map((proof, index) => {
    exactKeys(proof, ["challenge_sequence", "provider_id", "receipt_id", "shard_index"], `journal proof ${index}`);
    if (
      !PEER_ID.test(proof.provider_id) ||
      !RESOURCE_EXECUTION_RECEIPT_ID.test(proof.receipt_id) ||
      typeof proof.challenge_sequence !== "string" ||
      proof.shard_index !== index
    ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", `journal proof ${index} is invalid`);
    decimal(proof.challenge_sequence, `journal proof ${index} sequence`);
    return Object.freeze({ ...proof });
  });
  for (let index = 0; index < proofs.length; index += 1) {
    for (let prior = 0; prior < index; prior += 1) {
      if (
        proofs[prior].provider_id === proofs[index].provider_id ||
        proofs[prior].receipt_id === proofs[index].receipt_id
      ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal receipt barriers must be distinct");
    }
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
  if (domainHash(DOMAINS.journal, canonicalBytes(basis)) !== value.journal_id) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal ID mismatch");
  }
  return Object.freeze({
    bytes: parsed.bytes,
    generation: value.generation,
    journal_id: value.journal_id,
    manifest,
    max_proof_age_ms: value.max_proof_age_ms,
    proofs: Object.freeze(proofs),
    quorum: value.quorum,
    target_shards: value.target_shards
  });
}

export function evaluateConfidentialPlacementJournal({
  evaluated_at_ms: evaluatedAt,
  journal_bytes: journalBytes,
  placements,
  unavailable_provider_ids: unavailableProviderIds
}) {
  requireIntactRealm();
  const journal = restoreConfidentialPlacementJournal(journalBytes);
  const evaluated = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: evaluatedAt,
    manifest_bytes: journal.manifest.bytes,
    max_proof_age_ms: journal.max_proof_age_ms,
    placements,
    quorum: journal.quorum,
    target_shards: journal.target_shards,
    unavailable_provider_ids: unavailableProviderIds
  });
  requireIntactRealm();
  const previous = createMap();
  for (let index = 0; index < journal.proofs.length; index += 1) {
    const proof = journal.proofs[index];
    mapSet(previous, `${proof.shard_index}:${proof.provider_id}`, proof);
  }
  const checked = createArray(evaluated.placements.length);
  for (let index = 0; index < evaluated.placements.length; index += 1) {
    let placement = evaluated.placements[index];
    if (placement.status === "proved") {
      const prior = mapGet(previous, `${placement.shard_index}:${placement.provider_id}`);
      if (prior) {
        const expectedSequence = String(Number(prior.challenge_sequence) + 1);
        if (
          placement.previous_execution_receipt_id !== prior.receipt_id ||
          placement.challenge_sequence !== expectedSequence
        ) {
          placement = freeze({
            ...placement,
            reason: "restart-reproof-required",
            status: "rejected"
          });
        }
      }
    }
    defineArrayIndex(checked, index, placement);
  }
  return freeze({
    ...summarizePlacements({
      manifest: journal.manifest,
      placements: checked,
      quorum: journal.quorum,
      targetShards: journal.target_shards
    }),
    generation: journal.generation,
    journal_id: journal.journal_id
  });
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
