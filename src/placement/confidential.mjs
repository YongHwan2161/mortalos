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

function fail(code, message) {
  throw new StoragePlacementError(code, message);
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
  return new Uint8Array(value);
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
  exactKeys(value, RECORD_KEYS, `placement ${index}`);
  if (!Number.isSafeInteger(value.shard_index) || value.shard_index < 0 || value.shard_index > 2) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", `placement ${index} shard index is invalid`);
  }
  return Object.freeze({
    shard_index: value.shard_index,
    record: Object.freeze(Object.fromEntries(RECORD_KEYS
      .filter((key) => key !== "shard_index")
      .map((key) => [key, value[key]])))
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

function evaluatePlacement(snapshot, descriptor, unavailable, evaluatedAt, maximumAge) {
  const { record, shard_index: shardIndex } = snapshot;
  if (shardIndex !== descriptor.shard_index) return rejected(shardIndex, "shard-descriptor-mismatch");
  const basic = evaluateStoragePlacements({
    expected_workload_id: descriptor.workload_id,
    placements: [record],
    quorum: 1,
    target_copies: 1,
    unavailable_provider_ids: []
  }).placements[0];
  if (basic.status !== "proved") {
    return rejected(shardIndex, basic.reason, {
      lease_id: basic.lease_id,
      provider_id: basic.provider_id,
      workload_id: basic.workload_id
    });
  }
  const offer = verifyResourceOffer(record.offer);
  const last = verifyResourceExecutionReceipt({
    offer: record.offer,
    lease: record.lease,
    previous_execution_receipts: record.execution_receipts.slice(0, -1),
    usage_receipts: record.usage_receipts,
    receipt: record.execution_receipts.at(-1)
  });
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
  if (age > maximumAge) return Object.freeze({ ...common, reason: "stale-proof", status: "stale" });
  if (unavailable.has(common.provider_id)) {
    return Object.freeze({ ...common, reason: "transport-unavailable", status: "unavailable" });
  }
  return Object.freeze({ ...common, reason: null, status: "proved" });
}

function summarizePlacements({ manifest, placements, quorum, targetShards }) {
  const available = placements.filter(({ status }) => status === "proved");
  const availableIndexes = new Set(available.map(({ shard_index: index }) => index));
  const status = available.length >= targetShards
    ? STORAGE_PLACEMENT_STATUS.proved
    : available.length >= quorum
      ? STORAGE_PLACEMENT_STATUS.repairing
      : STORAGE_PLACEMENT_STATUS.unavailable;
  return Object.freeze({
    available_shards: available.length,
    manifest_id: manifest.manifest_id,
    placements: Object.freeze(placements),
    quorum,
    repair_shard_indexes: Object.freeze(manifest.descriptors
      .map(({ shard_index: index }) => index)
      .filter((index) => !availableIndexes.has(index))),
    status,
    target_shards: targetShards
  });
}

export function evaluateConfidentialStoragePlacements(options) {
  exactKeys(
    options,
    ["evaluated_at_ms", "manifest_bytes", "max_proof_age_ms", "placements", "quorum", "target_shards", "unavailable_provider_ids"],
    "confidential placement evaluation options"
  );
  const manifest = verifyManifest(options.manifest_bytes);
  const evaluatedAt = decimal(options.evaluated_at_ms, "evaluated_at_ms");
  const maximumAge = decimal(options.max_proof_age_ms, "max_proof_age_ms", { minimum: 1 });
  if (
    !Number.isSafeInteger(options.quorum) || options.quorum < 2 ||
    !Number.isSafeInteger(options.target_shards) || options.target_shards < options.quorum || options.target_shards > 3
  ) fail("E_CONFIDENTIAL_PLACEMENT_POLICY", "2-of-3 compatible quorum and target required");
  if (!Array.isArray(options.placements) || options.placements.length > 16) {
    fail("E_CONFIDENTIAL_PLACEMENT_LIMIT", "at most sixteen placements are allowed");
  }
  if (!Array.isArray(options.unavailable_provider_ids) || options.unavailable_provider_ids.some((id) => typeof id !== "string")) {
    fail("E_CONFIDENTIAL_PLACEMENT_FORMAT", "unavailable provider IDs must be strings");
  }
  const unavailable = new Set(options.unavailable_provider_ids);
  let placements = options.placements.map((value, index) => {
    try {
      const snapshot = placementRecord(value, index);
      return evaluatePlacement(snapshot, manifest.descriptors[snapshot.shard_index], unavailable, evaluatedAt, maximumAge);
    } catch (error) {
      return rejected(Number.isSafeInteger(value?.shard_index) ? value.shard_index : null, error?.code ?? "invalid-evidence");
    }
  });
  const providerCounts = new Map();
  const shardCounts = new Map();
  for (const placement of placements) {
    if (["proved", "unavailable", "stale"].includes(placement.status)) {
      providerCounts.set(placement.provider_id, (providerCounts.get(placement.provider_id) ?? 0) + 1);
      shardCounts.set(placement.shard_index, (shardCounts.get(placement.shard_index) ?? 0) + 1);
    }
  }
  placements = placements.map((placement) => {
    if (placement.provider_id && (providerCounts.get(placement.provider_id) ?? 0) > 1) {
      return Object.freeze({ ...placement, reason: "duplicate-provider", status: "rejected" });
    }
    if (placement.shard_index !== null && (shardCounts.get(placement.shard_index) ?? 0) > 1) {
      return Object.freeze({ ...placement, reason: "duplicate-shard", status: "rejected" });
    }
    return placement;
  });
  return summarizePlacements({ manifest, placements, quorum: options.quorum, targetShards: options.target_shards });
}

export function createConfidentialPlacementJournal({
  evaluation,
  generation,
  manifest_bytes: manifestBytes,
  max_proof_age_ms: maximumAge,
  quorum,
  target_shards: targetShards
}) {
  const manifest = verifyManifest(manifestBytes);
  const parsedGeneration = decimal(generation, "generation");
  decimal(maximumAge, "max_proof_age_ms", { minimum: 1 });
  if (
    !evaluation || evaluation.manifest_id !== manifest.manifest_id ||
    evaluation.quorum !== quorum || evaluation.target_shards !== targetShards
  ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "evaluation is not bound to journal policy");
  const proofs = evaluation.placements
    .filter(({ status }) => status === "proved")
    .map(({ challenge_sequence, provider_id, receipt_id, shard_index }) => ({
      challenge_sequence,
      provider_id,
      receipt_id,
      shard_index
    }))
    .sort((left, right) => left.shard_index - right.shard_index);
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
  const journal = Object.freeze({
    ...basis,
    journal_id: domainHash(DOMAINS.journal, canonicalBytes(basis))
  });
  return Object.freeze({ bytes: canonicalBytes(journal), journal, journal_id: journal.journal_id });
}

export function restoreConfidentialPlacementJournal(journalBytes) {
  const parsed = parseCanonical(journalBytes, "placement journal", 2 * 1024 * 1024);
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
  if (!Number.isSafeInteger(value.quorum) || !Number.isSafeInteger(value.target_shards)) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal policy is invalid");
  }
  const manifestBytes = decodeBase64Url(value.manifest_base64url);
  if (!manifestBytes) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal manifest is invalid");
  const manifest = verifyManifest(manifestBytes);
  if (manifest.manifest_id !== value.manifest_id || !Array.isArray(value.proofs) || value.proofs.length > 3) {
    fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", "journal manifest or proofs are invalid");
  }
  const proofs = value.proofs.map((proof, index) => {
    exactKeys(proof, ["challenge_sequence", "provider_id", "receipt_id", "shard_index"], `journal proof ${index}`);
    if (
      typeof proof.provider_id !== "string" || typeof proof.receipt_id !== "string" ||
      typeof proof.challenge_sequence !== "string" ||
      !Number.isSafeInteger(proof.shard_index) || proof.shard_index < 0 || proof.shard_index > 2
    ) fail("E_CONFIDENTIAL_PLACEMENT_JOURNAL", `journal proof ${index} is invalid`);
    decimal(proof.challenge_sequence, `journal proof ${index} sequence`);
    return Object.freeze({ ...proof });
  });
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
  const previous = new Map(journal.proofs.map((proof) => [`${proof.shard_index}:${proof.provider_id}`, proof]));
  const checked = evaluated.placements.map((placement) => {
    if (placement.status !== "proved") return placement;
    const prior = previous.get(`${placement.shard_index}:${placement.provider_id}`);
    if (!prior) return placement;
    const expectedSequence = String(Number(prior.challenge_sequence) + 1);
    if (
      placement.previous_execution_receipt_id !== prior.receipt_id ||
      placement.challenge_sequence !== expectedSequence
    ) {
      return Object.freeze({ ...placement, reason: "restart-reproof-required", status: "rejected" });
    }
    return placement;
  });
  return Object.freeze({
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
