import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  createLineagePlacementGeneration,
  deriveCommittedPlacementRepairEffect,
  deriveCommittedPlacementActionPlan,
  verifyLineagePlacementCommit,
  restoreLineagePlacementGeneration
} from "../../src/placement/lineage-controller.mjs";
import { evaluateConfidentialStoragePlacements } from "../../src/placement/confidential.mjs";
import {
  copyBoundedOwnDataArray,
  ownDataArrayLength,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";

const RESULT_FORMAT = "mortalos-lineage-placement-repair-effect-result/1";
const RESULT_DOMAIN = "MortalOS lineage placement repair effect result v1";
const COMPLETION_FORMAT = "mortalos-lineage-placement-repair-completion/1";
const COMPLETION_DOMAIN = "MortalOS lineage placement repair completion v1";
const COMPLETION_RESULT_FORMAT = "mortalos-lineage-placement-repair-completion-result/1";
const COMPLETION_RESULT_DOMAIN = "MortalOS lineage placement repair completion result v1";
const BATCH_COMPLETION_FORMAT = "mortalos-lineage-placement-repair-batch-completion/1";
const BATCH_COMPLETION_DOMAIN = "MortalOS lineage placement repair batch completion v1";
const BATCH_COMPLETION_RESULT_FORMAT =
  "mortalos-lineage-placement-repair-batch-completion-result/1";
const BATCH_COMPLETION_RESULT_DOMAIN =
  "MortalOS lineage placement repair batch completion result v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const inFlight = new Map();
const reflectApply = Reflect.apply;
const arraySortIntrinsic = Array.prototype.sort;
const mapDeleteIntrinsic = Map.prototype.delete;
const mapGetIntrinsic = Map.prototype.get;
const mapSetIntrinsic = Map.prototype.set;

export class PlacementRepairExecutorError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementRepairExecutorError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementRepairExecutorError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) fail("E_PLACEMENT_REPAIR_RUNTIME", "realm-integrity");
}

function exactOptions(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-ordinary-own-data`);
  }
  requireRealm();
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length || expected.some((key) =>
    !ownDataRecordEntry(descriptors, key).present)) {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-keys`);
  }
  const result = Object.create(null);
  for (const key of expected) result[key] = ownDataRecordEntry(descriptors, key).value;
  return result;
}

function ownedBytes(value, label, maximum = 8 * 1024 * 1024) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > maximum || isSharedByteView(value)) {
    fail("E_PLACEMENT_REPAIR_FORMAT", label);
  }
  return new Uint8Array(value);
}

function digestTail(value, label) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    fail("E_PLACEMENT_REPAIR_FORMAT", label);
  }
  return value.slice(7);
}

function syncFile(path, bytes) {
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function linkNoReplace(source, target) {
  try {
    linkSync(source, target);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

function immutableFile(path, bytes) {
  const temporary = join(
    dirname(path),
    `.mortalos-pending-repair-${encodeBase64Url(randomBytes(16))}`
  );
  let created = false;
  try {
    syncFile(temporary, bytes);
    created = true;
    const linked = linkNoReplace(temporary, path);
    const existing = new Uint8Array(readFileSync(path));
    if (!equalBytes(existing, bytes)) {
      fail("E_PLACEMENT_REPAIR_IMMUTABLE_COLLISION", path);
    }
    return linked;
  } finally {
    if (created) {
      try {
        unlinkSync(temporary);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
}

function encodePlacement(placement) {
  const value = exactOptions(placement, [
    "consumption_announcements",
    "execution_receipts",
    "lease",
    "observed_at_ms",
    "offer",
    "revocations",
    "usage_receipts"
  ], "provider-placement");
  const encodeMany = (sources, label) => {
    if (!Array.isArray(sources) || sources.length > 64) {
      fail("E_PLACEMENT_REPAIR_FORMAT", label);
    }
    return sources.map((bytes) => encodeBase64Url(ownedBytes(bytes, label, 2 * 1024 * 1024)));
  };
  return Object.freeze({
    consumption_announcements_base64url: encodeMany(
      value.consumption_announcements, "provider-announcements"
    ),
    execution_receipts_base64url: encodeMany(value.execution_receipts, "provider-receipts"),
    lease_base64url: encodeBase64Url(ownedBytes(value.lease, "provider-lease")),
    observed_at_ms: value.observed_at_ms,
    offer_base64url: encodeBase64Url(ownedBytes(value.offer, "provider-offer")),
    revocations_base64url: encodeMany(value.revocations, "provider-revocations"),
    usage_receipts_base64url: encodeMany(value.usage_receipts, "provider-usage")
  });
}

function decodePlacement(value) {
  const decodeMany = (sources) => Object.freeze(sources.map(decodeBase64Url));
  return Object.freeze({
    consumption_announcements: decodeMany(value.consumption_announcements_base64url),
    execution_receipts: decodeMany(value.execution_receipts_base64url),
    lease: decodeBase64Url(value.lease_base64url),
    observed_at_ms: value.observed_at_ms,
    offer: decodeBase64Url(value.offer_base64url),
    revocations: decodeMany(value.revocations_base64url),
    usage_receipts: decodeMany(value.usage_receipts_base64url)
  });
}

function snapshotPlacementRecords(sources, label) {
  let length;
  try {
    length = ownDataArrayLength(sources, label);
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-dense-array`);
  }
  if (length < 1 || length > 64) fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-length`);
  let records;
  try {
    records = copyBoundedOwnDataArray(sources, length, label);
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-dense-array`);
  }
  return Object.freeze(records.map((source) => {
    const value = exactOptions(source, [
      "consumption_announcements",
      "execution_receipts",
      "lease",
      "observed_at_ms",
      "offer",
      "revocations",
      "shard_index",
      "usage_receipts"
    ], label);
    if (!Number.isSafeInteger(value.shard_index) || value.shard_index < 0) {
      fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-shard-index`);
    }
    const encoded = encodePlacement({
      consumption_announcements: value.consumption_announcements,
      execution_receipts: value.execution_receipts,
      lease: value.lease,
      observed_at_ms: value.observed_at_ms,
      offer: value.offer,
      revocations: value.revocations,
      usage_receipts: value.usage_receipts
    });
    return Object.freeze({ ...decodePlacement(encoded), shard_index: value.shard_index });
  }));
}

function snapshotByteRecords(sources, label) {
  let length;
  try {
    length = ownDataArrayLength(sources, label);
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-dense-array`);
  }
  if (length > 64) fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-length`);
  let records;
  try {
    records = copyBoundedOwnDataArray(sources, length, label);
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", `${label}-dense-array`);
  }
  return Object.freeze(records.map((source) =>
    ownedBytes(source, label, 2 * 1024 * 1024)));
}

function snapshotBatchActions(sources) {
  let length;
  try {
    length = ownDataArrayLength(sources, "repair-batch-actions");
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-actions-dense-array");
  }
  if (length < 2 || length > 64) {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-actions-length");
  }
  let records;
  try {
    records = copyBoundedOwnDataArray(sources, length, "repair-batch-actions");
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-actions-dense-array");
  }
  const actions = records.map((source, index) => {
    const value = exactOptions(source, [
      "provider",
      "replacement_lease_bytes",
      "replacement_offer_bytes",
      "resource_bytes",
      "shard_index"
    ], `repair-batch-action-${index}`);
    if (!Number.isSafeInteger(value.shard_index) || value.shard_index < 0) {
      fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-action-shard-index");
    }
    const provider = exactOptions(
      value.provider,
      ["executeRepairEffect"],
      `repair-batch-provider-${index}`
    );
    if (typeof provider.executeRepairEffect !== "function") {
      fail("E_PLACEMENT_REPAIR_CAPABILITY", "executeRepairEffect");
    }
    const providerMethod = provider.executeRepairEffect;
    const providerThis = value.provider;
    return Object.freeze({
      provider: Object.freeze({
        executeRepairEffect(input) {
          return reflectApply(providerMethod, providerThis, [input]);
        }
      }),
      replacement_lease_bytes: ownedBytes(
        value.replacement_lease_bytes,
        "repair-batch-replacement-lease"
      ),
      replacement_offer_bytes: ownedBytes(
        value.replacement_offer_bytes,
        "repair-batch-replacement-offer"
      ),
      resource_bytes: ownedBytes(
        value.resource_bytes,
        "repair-batch-resource",
        2 * 1024 * 1024
      ),
      shard_index: value.shard_index
    });
  });
  reflectApply(arraySortIntrinsic, actions, [
    (left, right) => left.shard_index - right.shard_index
  ]);
  for (let index = 1; index < actions.length; index += 1) {
    if (actions[index - 1].shard_index === actions[index].shard_index) {
      fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-action-duplicate-shard");
    }
  }
  return Object.freeze(actions);
}

async function readCurrentEvidence(method, receiver) {
  const returned = await reflectApply(method, receiver, []);
  requireRealm();
  const value = exactOptions(returned, [
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements"
  ], "repair-batch-evidence");
  return Object.freeze({
    observed_at_ms: value.observed_at_ms,
    observed_liveness_responses: snapshotByteRecords(
      value.observed_liveness_responses,
      "repair-batch-liveness-responses"
    ),
    observed_placements: snapshotPlacementRecords(
      value.observed_placements,
      "repair-batch-observed-placements"
    )
  });
}

function restoreResult(source, effect) {
  const bytes = ownedBytes(source, "repair-result");
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: 8 * 1024 * 1024, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-result-json");
  }
  if (!isCanonical(bytes, value) || value?.format !== RESULT_FORMAT) {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-result-canonical");
  }
  const { result_id: ignored, ...basis } = value;
  if (
    domainHash(RESULT_DOMAIN, canonicalBytes(basis)) !== value.result_id ||
    value.effect_id !== effect.value.effect_id ||
    value.repair_slot_id !== effect.value.repair_slot_id
  ) fail("E_PLACEMENT_REPAIR_BINDING", "repair-result-id");
  return Object.freeze({ bytes, placement: decodePlacement(value.placement), value });
}

function verifiedRepairResult({ effect, generation, observedAtMs, source }) {
  const result = restoreResult(source, effect);
  const proved = validateProviderPlacement({
    effect,
    generation,
    observedAtMs,
    placement: result.placement
  });
  if (
    result.value.lease_id !== proved.lease_id ||
    result.value.provider_id !== proved.provider_id ||
    result.value.receipt_id !== proved.receipt_id ||
    result.value.shard_index !== effect.value.shard_index ||
    result.value.workload_id !== proved.workload_id
  ) fail("E_PLACEMENT_REPAIR_BINDING", "repair-result-placement");
  return result;
}

function validateProviderPlacement({ effect, generation, observedAtMs, placement }) {
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: observedAtMs,
    manifest_bytes: generation.manifest_bytes,
    max_proof_age_ms: generation.value.max_proof_age_ms,
    placements: [{ ...placement, shard_index: effect.value.shard_index }],
    quorum: generation.value.quorum,
    target_shards: generation.value.target_shards,
    unavailable_provider_ids: []
  });
  const proved = evaluation.placements.find(({ shard_index: index }) =>
    index === effect.value.shard_index);
  if (
    !proved || proved.status !== "proved" ||
    proved.provider_id !== effect.value.provider_id ||
    proved.lease_id !== effect.value.lease_id ||
    proved.workload_id !== effect.value.workload_id ||
    !proved.receipt_id
  ) fail("E_PLACEMENT_REPAIR_BINDING", "provider-result");
  return proved;
}

function committedResult(directory, effect) {
  const resultPath = join(directory, `result-${digestTail(effect.value.effect_id, "effect-id")}.json`);
  return existsSync(resultPath)
    ? restoreResult(new Uint8Array(readFileSync(resultPath)), effect)
    : null;
}

function claimRepairEffect(directory, effect) {
  mkdirSync(directory, { recursive: true });
  const effectPath = join(directory, `effect-${digestTail(effect.value.effect_id, "effect-id")}.json`);
  immutableFile(effectPath, effect.bytes);
  const claimPath = join(
    directory,
    `claim-${digestTail(effect.value.repair_slot_id, "repair-slot-id")}.json`
  );
  linkNoReplace(effectPath, claimPath);
  const claimed = new Uint8Array(readFileSync(claimPath));
  if (!equalBytes(claimed, effect.bytes)) {
    fail("E_PLACEMENT_REPAIR_SLOT_CLAIMED", effect.value.repair_slot_id);
  }
}

function commitProviderPlacement(directory, effect, generation, observedAtMs, source, status) {
  const placementValue = encodePlacement(source);
  const placement = decodePlacement(placementValue);
  const proved = validateProviderPlacement({
    effect,
    generation,
    observedAtMs,
    placement
  });
  const basis = Object.freeze({
    effect_id: effect.value.effect_id,
    format: RESULT_FORMAT,
    lease_id: proved.lease_id,
    placement: placementValue,
    provider_id: proved.provider_id,
    receipt_id: proved.receipt_id,
    repair_slot_id: effect.value.repair_slot_id,
    shard_index: effect.value.shard_index,
    workload_id: proved.workload_id
  });
  const value = Object.freeze({
    ...basis,
    result_id: domainHash(RESULT_DOMAIN, canonicalBytes(basis))
  });
  const bytes = canonicalBytes(value);
  const resultPath = join(directory, `result-${digestTail(effect.value.effect_id, "effect-id")}.json`);
  immutableFile(resultPath, bytes);
  const restored = restoreResult(new Uint8Array(readFileSync(resultPath)), effect);
  return Object.freeze({ ...restored, status });
}

async function executeOwned(values, providerMethod, providerThis, effect) {
  const directory = resolve(values.directory);
  claimRepairEffect(directory, effect);
  const existing = committedResult(directory, effect);
  if (existing) return Object.freeze({ ...existing, status: "already-committed" });

  const providerResult = await reflectApply(providerMethod, providerThis, [Object.freeze({
    effect: effect.value,
    effect_bytes: new Uint8Array(effect.bytes),
    idempotency_key: effect.value.effect_id,
    replacement_lease_bytes: new Uint8Array(values.replacement_lease_bytes),
    replacement_offer_bytes: new Uint8Array(values.replacement_offer_bytes),
    resource_bytes: new Uint8Array(values.resource_bytes)
  })]);
  requireRealm();
  const returned = exactOptions(providerResult, ["placement"], "provider-result");
  const generation = restoreLineagePlacementGeneration(values.generation_bytes);
  return commitProviderPlacement(
    directory,
    effect,
    generation,
    values.observed_at_ms,
    returned.placement,
    "committed"
  );
}

export async function executeLineagePlacementRepairEffect(options) {
  const values = exactOptions(options, [
    "capsule_bytes",
    "commit_bytes",
    "directory",
    "generation_bytes",
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements",
    "provider",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes",
    "shard_index"
  ], "repair-executor-options");
  const providerRecord = exactOptions(values.provider, ["executeRepairEffect"], "provider-capability");
  if (typeof providerRecord.executeRepairEffect !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "executeRepairEffect");
  }
  const effectInputs = {
    capsule_bytes: ownedBytes(values.capsule_bytes, "capsule-bytes"),
    commit_bytes: ownedBytes(values.commit_bytes, "commit-bytes"),
    generation_bytes: ownedBytes(values.generation_bytes, "generation-bytes"),
    observed_at_ms: values.observed_at_ms,
    observed_liveness_responses: values.observed_liveness_responses,
    observed_placements: values.observed_placements,
    replacement_lease_bytes: ownedBytes(values.replacement_lease_bytes, "replacement-lease"),
    replacement_offer_bytes: ownedBytes(values.replacement_offer_bytes, "replacement-offer"),
    resource_bytes: ownedBytes(values.resource_bytes, "resource-bytes", 2 * 1024 * 1024),
    shard_index: values.shard_index
  };
  const effect = deriveCommittedPlacementRepairEffect(effectInputs);
  const owned = Object.freeze({
    ...effectInputs,
    directory: values.directory
  });
  const key = `${resolve(values.directory)}:${effect.value.effect_id}`;
  const pending = reflectApply(mapGetIntrinsic, inFlight, [key]);
  if (pending) return pending;
  const operation = executeOwned(
    owned,
    providerRecord.executeRepairEffect,
    values.provider,
    effect
  ).finally(() => reflectApply(mapDeleteIntrinsic, inFlight, [key]));
  reflectApply(mapSetIntrinsic, inFlight, [key, operation]);
  return operation;
}

export function recoverLineagePlacementRepairEffect(options) {
  const values = exactOptions(options, [
    "capsule_bytes",
    "commit_bytes",
    "directory",
    "generation_bytes",
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements",
    "provider_recovery",
    "recovered_placement",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes",
    "shard_index"
  ], "repair-effect-recovery-options");
  const recovery = exactOptions(
    values.provider_recovery,
    ["recoverCompletedRepairEffect"],
    "provider-recovery-capability"
  );
  if (typeof recovery.recoverCompletedRepairEffect !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "recoverCompletedRepairEffect");
  }
  const effectInputs = Object.freeze({
    capsule_bytes: ownedBytes(values.capsule_bytes, "capsule-bytes"),
    commit_bytes: ownedBytes(values.commit_bytes, "commit-bytes"),
    generation_bytes: ownedBytes(values.generation_bytes, "generation-bytes"),
    observed_at_ms: values.observed_at_ms,
    observed_liveness_responses: values.observed_liveness_responses,
    observed_placements: values.observed_placements,
    replacement_lease_bytes: ownedBytes(values.replacement_lease_bytes, "replacement-lease"),
    replacement_offer_bytes: ownedBytes(values.replacement_offer_bytes, "replacement-offer"),
    resource_bytes: ownedBytes(values.resource_bytes, "resource-bytes", 2 * 1024 * 1024),
    shard_index: values.shard_index
  });
  const effect = deriveCommittedPlacementRepairEffect(effectInputs);
  const generation = restoreLineagePlacementGeneration(effectInputs.generation_bytes);
  const recoveredPlacementValue = encodePlacement(values.recovered_placement);
  const recoveredPlacement = decodePlacement(recoveredPlacementValue);
  validateProviderPlacement({
    effect,
    generation,
    observedAtMs: effectInputs.observed_at_ms,
    placement: recoveredPlacement
  });
  const directory = resolve(values.directory);
  claimRepairEffect(directory, effect);
  const existing = committedResult(directory, effect);
  if (existing) return Object.freeze({ ...existing, status: "already-committed" });
  const returned = reflectApply(
    recovery.recoverCompletedRepairEffect,
    values.provider_recovery,
    [Object.freeze({
      effect: effect.value,
      effect_bytes: new Uint8Array(effect.bytes),
      idempotency_key: effect.value.effect_id,
      placement: recoveredPlacement,
      replacement_lease_bytes: new Uint8Array(effectInputs.replacement_lease_bytes),
      replacement_offer_bytes: new Uint8Array(effectInputs.replacement_offer_bytes),
      resource_bytes: new Uint8Array(effectInputs.resource_bytes)
    })]
  );
  requireRealm();
  const recovered = exactOptions(returned, ["placement"], "provider-recovery-result");
  const returnedValue = encodePlacement(recovered.placement);
  if (!equalBytes(canonicalBytes(returnedValue), canonicalBytes(recoveredPlacementValue))) {
    fail("E_PLACEMENT_REPAIR_BINDING", "provider-recovery-result");
  }
  return commitProviderPlacement(
    directory,
    effect,
    generation,
    effectInputs.observed_at_ms,
    recovered.placement,
    "recovered"
  );
}

function completionCandidate(effect, result, successor) {
  const slotBasis = Object.freeze({
    effect_result_id: result.value.result_id,
    manifest_id: successor.value.manifest_id,
    prior_commit_id: effect.value.commit_id,
    successor_generation: successor.generation
  });
  const completionSlotId = domainHash(
    "MortalOS lineage placement repair completion slot v1",
    canonicalBytes(slotBasis)
  );
  const basis = Object.freeze({
    ...slotBasis,
    completion_slot_id: completionSlotId,
    effect_id: effect.value.effect_id,
    format: COMPLETION_FORMAT,
    successor_generation_id: successor.generation_id
  });
  const value = Object.freeze({
    ...basis,
    completion_id: domainHash(COMPLETION_DOMAIN, canonicalBytes(basis))
  });
  return Object.freeze({ bytes: canonicalBytes(value), value });
}

function completionResultPath(directory, completionId) {
  return join(
    directory,
    `completion-result-${digestTail(completionId, "completion-id")}.json`
  );
}

function restoreCompletionResult(source, candidate, successor) {
  const bytes = ownedBytes(source, "completion-result");
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: 16 * 1024 * 1024, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", "completion-result-json");
  }
  if (!isCanonical(bytes, parsed)) {
    fail("E_PLACEMENT_REPAIR_FORMAT", "completion-result-canonical");
  }
  const value = exactOptions(parsed, [
    "capsule_base64url",
    "commit_base64url",
    "completion_id",
    "completion_result_id",
    "completion_slot_id",
    "effect_result_id",
    "format",
    "generation_base64url",
    "successor_commit_id",
    "successor_generation_id"
  ], "completion-result");
  const { completion_result_id: ignored, ...basis } = value;
  if (
    value.format !== COMPLETION_RESULT_FORMAT ||
    value.completion_id !== candidate.value.completion_id ||
    value.completion_slot_id !== candidate.value.completion_slot_id ||
    value.effect_result_id !== candidate.value.effect_result_id ||
    value.successor_generation_id !== successor.generation_id ||
    domainHash(COMPLETION_RESULT_DOMAIN, canonicalBytes(basis)) !== value.completion_result_id
  ) fail("E_PLACEMENT_REPAIR_BINDING", "completion-result-id");
  const capsuleBytes = decodeBase64Url(value.capsule_base64url);
  const commitBytes = decodeBase64Url(value.commit_base64url);
  const generationBytes = decodeBase64Url(value.generation_base64url);
  if (
    !capsuleBytes || !commitBytes || !generationBytes ||
    !equalBytes(generationBytes, successor.bytes)
  ) fail("E_PLACEMENT_REPAIR_BINDING", "completion-result-bytes");
  const commit = verifyLineagePlacementCommit({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: generationBytes
  });
  const plan = deriveCommittedPlacementActionPlan({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: generationBytes,
    observed_at_ms: null,
    observed_liveness_responses: [],
    observed_placements: []
  });
  if (
    commit.commit_id !== value.successor_commit_id ||
    commit.generation_id !== successor.generation_id ||
    plan.status !== "proved" ||
    plan.planned_repair_actions.length !== 0
  ) fail("E_PLACEMENT_REPAIR_BINDING", "completion-result-successor");
  return Object.freeze({
    bytes,
    capsule_bytes: capsuleBytes,
    commit,
    commit_bytes: commitBytes,
    generation: successor,
    value: Object.freeze(value)
  });
}

function existingCompletion(directory, candidate, successor) {
  const path = completionResultPath(directory, candidate.value.completion_id);
  return existsSync(path)
    ? restoreCompletionResult(new Uint8Array(readFileSync(path)), candidate, successor)
    : null;
}

function claimCompletionCandidate(directory, candidate) {
  mkdirSync(directory, { recursive: true });
  const candidatePath = join(
    directory,
    `completion-${digestTail(candidate.value.completion_id, "completion-id")}.json`
  );
  immutableFile(candidatePath, candidate.bytes);
  const claimPath = join(
    directory,
    `completion-claim-${digestTail(candidate.value.completion_slot_id, "completion-slot-id")}.json`
  );
  linkNoReplace(candidatePath, claimPath);
  const claimed = new Uint8Array(readFileSync(claimPath));
  if (!equalBytes(claimed, candidate.bytes)) {
    fail("E_PLACEMENT_REPAIR_COMPLETION_CLAIMED", candidate.value.completion_slot_id);
  }
}

function verifyCommittedSuccessor(capsuleSource, commitSource, successor) {
  const capsuleBytes = ownedBytes(capsuleSource, "successor-capsule", 16 * 1024 * 1024);
  const commitBytes = ownedBytes(commitSource, "successor-commit", 1024 * 1024);
  const verified = verifyLineagePlacementCommit({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: successor.bytes
  });
  const plan = deriveCommittedPlacementActionPlan({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: successor.bytes,
    observed_at_ms: null,
    observed_liveness_responses: [],
    observed_placements: []
  });
  if (
    verified.generation_id !== successor.generation_id ||
    plan.status !== "proved" ||
    plan.planned_repair_actions.length !== 0
  ) fail("E_PLACEMENT_REPAIR_BINDING", "completion-result-successor");
  return Object.freeze({ capsuleBytes, commitBytes, verified });
}

function commitCompletionResult(directory, candidate, result, successor, committed, status) {
  const checked = verifyCommittedSuccessor(
    committed.capsule_bytes,
    committed.commit_bytes,
    successor
  );
  const basis = Object.freeze({
    capsule_base64url: encodeBase64Url(checked.capsuleBytes),
    commit_base64url: encodeBase64Url(checked.commitBytes),
    completion_id: candidate.value.completion_id,
    completion_slot_id: candidate.value.completion_slot_id,
    effect_result_id: result.value.result_id,
    format: COMPLETION_RESULT_FORMAT,
    generation_base64url: encodeBase64Url(successor.bytes),
    successor_commit_id: checked.verified.commit_id,
    successor_generation_id: successor.generation_id
  });
  const value = Object.freeze({
    ...basis,
    completion_result_id: domainHash(COMPLETION_RESULT_DOMAIN, canonicalBytes(basis))
  });
  const bytes = canonicalBytes(value);
  const path = completionResultPath(directory, candidate.value.completion_id);
  immutableFile(path, bytes);
  const restored = restoreCompletionResult(new Uint8Array(readFileSync(path)), candidate, successor);
  return Object.freeze({ ...restored, status });
}

async function completeOwned(values, commitMethod, commitThis, effect, result, successor) {
  const directory = resolve(values.directory);
  const candidate = completionCandidate(effect, result, successor);
  claimCompletionCandidate(directory, candidate);
  const existing = existingCompletion(directory, candidate, successor);
  if (existing) return Object.freeze({ ...existing, status: "already-committed" });

  const returned = await reflectApply(commitMethod, commitThis, [Object.freeze({
    capsule_bytes: new Uint8Array(values.capsule_bytes),
    generation_bytes: new Uint8Array(successor.bytes),
    idempotency_key: candidate.value.completion_id
  })]);
  requireRealm();
  const committed = exactOptions(returned, ["capsule_bytes", "commit_bytes"], "continuity-result");
  return commitCompletionResult(directory, candidate, result, successor, committed, "committed");
}

export async function completeLineagePlacementRepairEffect(options) {
  const values = exactOptions(options, [
    "capsule_bytes",
    "commit_bytes",
    "continuity",
    "directory",
    "effect_result_bytes",
    "generation_bytes",
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes",
    "shard_index"
  ], "repair-completion-options");
  const continuity = exactOptions(
    values.continuity,
    ["commitPlacementGeneration"],
    "continuity-capability"
  );
  if (typeof continuity.commitPlacementGeneration !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "commitPlacementGeneration");
  }
  const effectInputs = Object.freeze({
    capsule_bytes: ownedBytes(values.capsule_bytes, "capsule-bytes", 16 * 1024 * 1024),
    commit_bytes: ownedBytes(values.commit_bytes, "commit-bytes", 1024 * 1024),
    generation_bytes: ownedBytes(values.generation_bytes, "generation-bytes", 16 * 1024 * 1024),
    observed_at_ms: values.observed_at_ms,
    observed_liveness_responses: values.observed_liveness_responses,
    observed_placements: values.observed_placements,
    replacement_lease_bytes: ownedBytes(values.replacement_lease_bytes, "replacement-lease"),
    replacement_offer_bytes: ownedBytes(values.replacement_offer_bytes, "replacement-offer"),
    resource_bytes: ownedBytes(values.resource_bytes, "resource-bytes", 2 * 1024 * 1024),
    shard_index: values.shard_index
  });
  const effect = deriveCommittedPlacementRepairEffect(effectInputs);
  const prior = restoreLineagePlacementGeneration(effectInputs.generation_bytes);
  const result = verifiedRepairResult({
    effect,
    generation: prior,
    observedAtMs: effectInputs.observed_at_ms,
    source: values.effect_result_bytes
  });
  const currentPlacements = snapshotPlacementRecords(
    effectInputs.observed_placements,
    "completion-observed-placements"
  );
  const successorPlacements = Object.freeze([
    ...currentPlacements.filter(({ shard_index: index }) => index !== effect.value.shard_index),
    Object.freeze({ ...result.placement, shard_index: effect.value.shard_index })
  ]);
  const successor = createLineagePlacementGeneration({
    capsule_bytes: effectInputs.capsule_bytes,
    evaluated_at_ms: effectInputs.observed_at_ms,
    failure_certificates: [],
    liveness_responses: [],
    manifest_bytes: prior.manifest_bytes,
    max_proof_age_ms: prior.value.max_proof_age_ms,
    membership_epochs: [],
    placements: successorPlacements,
    prior_commit_bytes: effectInputs.commit_bytes,
    prior_generation_bytes: prior.bytes,
    quorum: prior.value.quorum,
    target_shards: prior.value.target_shards
  });
  if (successor.value.status !== "proved" || successor.repair_intents.length !== 0) {
    fail("E_PLACEMENT_REPAIR_BINDING", "successor-not-proved");
  }
  const candidate = completionCandidate(effect, result, successor);
  const key = `${resolve(values.directory)}:${candidate.value.completion_slot_id}`;
  const pending = reflectApply(mapGetIntrinsic, inFlight, [key]);
  if (pending) return pending;
  const owned = Object.freeze({
    capsule_bytes: effectInputs.capsule_bytes,
    directory: values.directory
  });
  const operation = completeOwned(
    owned,
    continuity.commitPlacementGeneration,
    values.continuity,
    effect,
    result,
    successor
  ).finally(() => reflectApply(mapDeleteIntrinsic, inFlight, [key]));
  reflectApply(mapSetIntrinsic, inFlight, [key, operation]);
  return operation;
}

export function recoverLineagePlacementRepairCompletion(options) {
  const values = exactOptions(options, [
    "capsule_bytes",
    "commit_bytes",
    "continuity_recovery",
    "directory",
    "effect_result_bytes",
    "generation_bytes",
    "observed_at_ms",
    "observed_liveness_responses",
    "observed_placements",
    "recovered_capsule_bytes",
    "recovered_commit_bytes",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes",
    "shard_index"
  ], "repair-completion-recovery-options");
  const recovery = exactOptions(
    values.continuity_recovery,
    ["recoverCompletedPlacementGeneration"],
    "continuity-recovery-capability"
  );
  if (typeof recovery.recoverCompletedPlacementGeneration !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "recoverCompletedPlacementGeneration");
  }
  const effectInputs = Object.freeze({
    capsule_bytes: ownedBytes(values.capsule_bytes, "capsule-bytes", 16 * 1024 * 1024),
    commit_bytes: ownedBytes(values.commit_bytes, "commit-bytes", 1024 * 1024),
    generation_bytes: ownedBytes(values.generation_bytes, "generation-bytes", 16 * 1024 * 1024),
    observed_at_ms: values.observed_at_ms,
    observed_liveness_responses: values.observed_liveness_responses,
    observed_placements: values.observed_placements,
    replacement_lease_bytes: ownedBytes(values.replacement_lease_bytes, "replacement-lease"),
    replacement_offer_bytes: ownedBytes(values.replacement_offer_bytes, "replacement-offer"),
    resource_bytes: ownedBytes(values.resource_bytes, "resource-bytes", 2 * 1024 * 1024),
    shard_index: values.shard_index
  });
  const effect = deriveCommittedPlacementRepairEffect(effectInputs);
  const prior = restoreLineagePlacementGeneration(effectInputs.generation_bytes);
  const result = verifiedRepairResult({
    effect,
    generation: prior,
    observedAtMs: effectInputs.observed_at_ms,
    source: values.effect_result_bytes
  });
  const currentPlacements = snapshotPlacementRecords(
    effectInputs.observed_placements,
    "completion-recovery-observed-placements"
  );
  const successorPlacements = Object.freeze([
    ...currentPlacements.filter(({ shard_index: index }) => index !== effect.value.shard_index),
    Object.freeze({ ...result.placement, shard_index: effect.value.shard_index })
  ]);
  const successor = createLineagePlacementGeneration({
    capsule_bytes: effectInputs.capsule_bytes,
    evaluated_at_ms: effectInputs.observed_at_ms,
    failure_certificates: [],
    liveness_responses: [],
    manifest_bytes: prior.manifest_bytes,
    max_proof_age_ms: prior.value.max_proof_age_ms,
    membership_epochs: [],
    placements: successorPlacements,
    prior_commit_bytes: effectInputs.commit_bytes,
    prior_generation_bytes: prior.bytes,
    quorum: prior.value.quorum,
    target_shards: prior.value.target_shards
  });
  if (successor.value.status !== "proved" || successor.repair_intents.length !== 0) {
    fail("E_PLACEMENT_REPAIR_BINDING", "successor-not-proved");
  }
  const candidate = completionCandidate(effect, result, successor);
  const checked = verifyCommittedSuccessor(
    values.recovered_capsule_bytes,
    values.recovered_commit_bytes,
    successor
  );
  const directory = resolve(values.directory);
  claimCompletionCandidate(directory, candidate);
  const existing = existingCompletion(directory, candidate, successor);
  if (existing) return Object.freeze({ ...existing, status: "already-committed" });
  const returned = reflectApply(
    recovery.recoverCompletedPlacementGeneration,
    values.continuity_recovery,
    [Object.freeze({
      capsule_bytes: new Uint8Array(effectInputs.capsule_bytes),
      generation_bytes: new Uint8Array(successor.bytes),
      idempotency_key: candidate.value.completion_id,
      result_capsule_bytes: new Uint8Array(checked.capsuleBytes),
      result_commit_bytes: new Uint8Array(checked.commitBytes)
    })]
  );
  requireRealm();
  const recovered = exactOptions(
    returned,
    ["capsule_bytes", "commit_bytes"],
    "continuity-recovery-result"
  );
  if (
    !equalBytes(ownedBytes(
      recovered.capsule_bytes,
      "continuity-recovery-capsule",
      16 * 1024 * 1024
    ), checked.capsuleBytes) ||
    !equalBytes(ownedBytes(
      recovered.commit_bytes,
      "continuity-recovery-commit",
      1024 * 1024
    ), checked.commitBytes)
  ) fail("E_PLACEMENT_REPAIR_BINDING", "continuity-recovery-result");
  return commitCompletionResult(
    directory,
    candidate,
    result,
    successor,
    recovered,
    "recovered"
  );
}

function repairEffectInputs(values, evidence, action) {
  return Object.freeze({
    capsule_bytes: values.capsule_bytes,
    commit_bytes: values.commit_bytes,
    generation_bytes: values.generation_bytes,
    observed_at_ms: evidence.observed_at_ms,
    observed_liveness_responses: evidence.observed_liveness_responses,
    observed_placements: evidence.observed_placements,
    replacement_lease_bytes: action.replacement_lease_bytes,
    replacement_offer_bytes: action.replacement_offer_bytes,
    resource_bytes: action.resource_bytes,
    shard_index: action.shard_index
  });
}

function assertExactBatchIntentSet(generation, actions) {
  if (generation.repair_intents.length !== actions.length) {
    fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-intent-count");
  }
  const intentIndexes = generation.repair_intents.map(({ shard_index: index }) => index);
  reflectApply(arraySortIntrinsic, intentIndexes, [(left, right) => left - right]);
  for (let index = 0; index < actions.length; index += 1) {
    if (intentIndexes[index] !== actions[index].shard_index) {
      fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-intent-set");
    }
  }
}

function deriveBatchEffects(values, evidence, actions) {
  const effects = [];
  for (const action of actions) {
    effects.push(deriveCommittedPlacementRepairEffect(
      repairEffectInputs(values, evidence, action)
    ));
  }
  return Object.freeze(effects);
}

function batchCompletionCandidate(effects, results, successor) {
  const repairSlotIds = Object.freeze(effects.map(({ value }) => value.repair_slot_id));
  const effectIds = Object.freeze(effects.map(({ value }) => value.effect_id));
  const effectResultIds = Object.freeze(results.map(({ value }) => value.result_id));
  const slotBasis = Object.freeze({
    manifest_id: successor.value.manifest_id,
    prior_commit_id: effects[0].value.commit_id,
    repair_slot_ids: repairSlotIds,
    successor_generation: successor.generation
  });
  const completionSlotId = domainHash(
    "MortalOS lineage placement repair batch completion slot v1",
    canonicalBytes(slotBasis)
  );
  const basis = Object.freeze({
    ...slotBasis,
    completion_slot_id: completionSlotId,
    effect_ids: effectIds,
    effect_result_ids: effectResultIds,
    format: BATCH_COMPLETION_FORMAT,
    successor_generation_id: successor.generation_id
  });
  const value = Object.freeze({
    ...basis,
    completion_id: domainHash(BATCH_COMPLETION_DOMAIN, canonicalBytes(basis))
  });
  return Object.freeze({ bytes: canonicalBytes(value), value });
}

function batchCompletionResultPath(directory, completionId) {
  return join(
    directory,
    `batch-completion-result-${digestTail(completionId, "batch-completion-id")}.json`
  );
}

function restoreBatchCompletionResult(source, candidate, successor) {
  const bytes = ownedBytes(source, "repair-batch-completion-result", 16 * 1024 * 1024);
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: 16 * 1024 * 1024, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-completion-result-json");
  }
  if (!isCanonical(bytes, parsed)) {
    fail("E_PLACEMENT_REPAIR_FORMAT", "repair-batch-completion-result-canonical");
  }
  const value = exactOptions(parsed, [
    "capsule_base64url",
    "commit_base64url",
    "completion_id",
    "completion_result_id",
    "completion_slot_id",
    "effect_result_ids",
    "format",
    "generation_base64url",
    "successor_commit_id",
    "successor_generation_id"
  ], "repair-batch-completion-result");
  const { completion_result_id: ignored, ...basis } = value;
  if (
    value.format !== BATCH_COMPLETION_RESULT_FORMAT ||
    value.completion_id !== candidate.value.completion_id ||
    value.completion_slot_id !== candidate.value.completion_slot_id ||
    value.successor_generation_id !== successor.generation_id ||
    !equalBytes(
      canonicalBytes(value.effect_result_ids),
      canonicalBytes(candidate.value.effect_result_ids)
    ) ||
    domainHash(BATCH_COMPLETION_RESULT_DOMAIN, canonicalBytes(basis)) !==
      value.completion_result_id
  ) fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-completion-result-id");
  const capsuleBytes = decodeBase64Url(value.capsule_base64url);
  const commitBytes = decodeBase64Url(value.commit_base64url);
  const generationBytes = decodeBase64Url(value.generation_base64url);
  if (
    !capsuleBytes || !commitBytes || !generationBytes ||
    !equalBytes(generationBytes, successor.bytes)
  ) fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-completion-result-bytes");
  const commit = verifyLineagePlacementCommit({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: generationBytes
  });
  const plan = deriveCommittedPlacementActionPlan({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: generationBytes,
    observed_at_ms: null,
    observed_liveness_responses: [],
    observed_placements: []
  });
  if (
    commit.commit_id !== value.successor_commit_id ||
    commit.generation_id !== successor.generation_id ||
    plan.status !== "proved" ||
    plan.planned_repair_actions.length !== 0
  ) fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-completion-result-successor");
  return Object.freeze({
    bytes,
    capsule_bytes: capsuleBytes,
    commit,
    commit_bytes: commitBytes,
    generation: successor,
    value: Object.freeze(value)
  });
}

function existingBatchCompletion(directory, candidate, successor) {
  const path = batchCompletionResultPath(directory, candidate.value.completion_id);
  return existsSync(path)
    ? restoreBatchCompletionResult(
      new Uint8Array(readFileSync(path)),
      candidate,
      successor
    )
    : null;
}

async function completeBatchOwned(
  values,
  commitMethod,
  commitThis,
  candidate,
  successor
) {
  const directory = resolve(values.directory);
  mkdirSync(directory, { recursive: true });
  const candidatePath = join(
    directory,
    `batch-completion-${digestTail(candidate.value.completion_id, "batch-completion-id")}.json`
  );
  immutableFile(candidatePath, candidate.bytes);
  const claimPath = join(
    directory,
    `batch-completion-claim-${digestTail(
      candidate.value.completion_slot_id,
      "batch-completion-slot-id"
    )}.json`
  );
  linkNoReplace(candidatePath, claimPath);
  const claimed = new Uint8Array(readFileSync(claimPath));
  if (!equalBytes(claimed, candidate.bytes)) {
    fail("E_PLACEMENT_REPAIR_COMPLETION_CLAIMED", candidate.value.completion_slot_id);
  }
  const existing = existingBatchCompletion(directory, candidate, successor);
  if (existing) return Object.freeze({ ...existing, status: "already-committed" });

  const returned = await reflectApply(commitMethod, commitThis, [Object.freeze({
    capsule_bytes: new Uint8Array(values.capsule_bytes),
    generation_bytes: new Uint8Array(successor.bytes),
    idempotency_key: candidate.value.completion_id
  })]);
  requireRealm();
  const committed = exactOptions(returned, [
    "capsule_bytes",
    "commit_bytes"
  ], "repair-batch-continuity-result");
  const capsuleBytes = ownedBytes(
    committed.capsule_bytes,
    "repair-batch-completed-capsule",
    16 * 1024 * 1024
  );
  const commitBytes = ownedBytes(
    committed.commit_bytes,
    "repair-batch-completed-commit",
    1024 * 1024
  );
  const verified = verifyLineagePlacementCommit({
    capsule_bytes: capsuleBytes,
    commit_bytes: commitBytes,
    generation_bytes: successor.bytes
  });
  const basis = Object.freeze({
    capsule_base64url: encodeBase64Url(capsuleBytes),
    commit_base64url: encodeBase64Url(commitBytes),
    completion_id: candidate.value.completion_id,
    completion_slot_id: candidate.value.completion_slot_id,
    effect_result_ids: candidate.value.effect_result_ids,
    format: BATCH_COMPLETION_RESULT_FORMAT,
    generation_base64url: encodeBase64Url(successor.bytes),
    successor_commit_id: verified.commit_id,
    successor_generation_id: successor.generation_id
  });
  const value = Object.freeze({
    ...basis,
    completion_result_id: domainHash(
      BATCH_COMPLETION_RESULT_DOMAIN,
      canonicalBytes(basis)
    )
  });
  const bytes = canonicalBytes(value);
  const path = batchCompletionResultPath(directory, candidate.value.completion_id);
  immutableFile(path, bytes);
  return Object.freeze({
    ...restoreBatchCompletionResult(
      new Uint8Array(readFileSync(path)),
      candidate,
      successor
    ),
    status: "committed"
  });
}

async function completeBatchOperation(
  key,
  values,
  commitMethod,
  commitThis,
  candidate,
  successor,
  effectResults
) {
  try {
    const completion = await completeBatchOwned(
      values,
      commitMethod,
      commitThis,
      candidate,
      successor
    );
    requireRealm();
    return Object.freeze({
      ...completion,
      effect_results: effectResults
    });
  } finally {
    reflectApply(mapDeleteIntrinsic, inFlight, [key]);
  }
}

function prepareBatchSuccessor(values, evidence, actions, results) {
  const prior = restoreLineagePlacementGeneration(values.generation_bytes);
  const effects = deriveBatchEffects(values, evidence, actions);
  const verifiedResults = [];
  for (let index = 0; index < actions.length; index += 1) {
    verifiedResults.push(verifiedRepairResult({
      effect: effects[index],
      generation: prior,
      observedAtMs: evidence.observed_at_ms,
      source: results[index].bytes
    }));
  }
  const replacements = new Map();
  for (let index = 0; index < actions.length; index += 1) {
    reflectApply(mapSetIntrinsic, replacements, [
      actions[index].shard_index,
      Object.freeze({
        ...verifiedResults[index].placement,
        shard_index: actions[index].shard_index
      })
    ]);
  }
  const successorPlacements = [];
  for (const placement of evidence.observed_placements) {
    if (!reflectApply(mapGetIntrinsic, replacements, [placement.shard_index])) {
      successorPlacements.push(placement);
    }
  }
  for (const action of actions) {
    successorPlacements.push(reflectApply(mapGetIntrinsic, replacements, [action.shard_index]));
  }
  const successor = createLineagePlacementGeneration({
    capsule_bytes: values.capsule_bytes,
    evaluated_at_ms: evidence.observed_at_ms,
    failure_certificates: [],
    liveness_responses: [],
    manifest_bytes: prior.manifest_bytes,
    max_proof_age_ms: prior.value.max_proof_age_ms,
    membership_epochs: [],
    placements: successorPlacements,
    prior_commit_bytes: values.commit_bytes,
    prior_generation_bytes: prior.bytes,
    quorum: prior.value.quorum,
    target_shards: prior.value.target_shards
  });
  if (successor.value.status !== "proved" || successor.repair_intents.length !== 0) {
    fail("E_PLACEMENT_REPAIR_BINDING", "repair-batch-successor-not-proved");
  }
  return Object.freeze({
    candidate: batchCompletionCandidate(effects, verifiedResults, successor),
    effects,
    results: Object.freeze(verifiedResults),
    successor
  });
}

export async function executeAndCompleteLineagePlacementRepairBatch(options) {
  const values = exactOptions(options, [
    "actions",
    "capsule_bytes",
    "commit_bytes",
    "continuity",
    "directory",
    "evidence",
    "generation_bytes"
  ], "repair-batch-options");
  const evidence = exactOptions(
    values.evidence,
    ["readCurrentEvidence"],
    "repair-batch-evidence-capability"
  );
  const continuity = exactOptions(
    values.continuity,
    ["commitPlacementGeneration"],
    "repair-batch-continuity-capability"
  );
  if (typeof evidence.readCurrentEvidence !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "readCurrentEvidence");
  }
  if (typeof continuity.commitPlacementGeneration !== "function") {
    fail("E_PLACEMENT_REPAIR_CAPABILITY", "commitPlacementGeneration");
  }
  const owned = Object.freeze({
    capsule_bytes: ownedBytes(values.capsule_bytes, "repair-batch-capsule", 16 * 1024 * 1024),
    commit_bytes: ownedBytes(values.commit_bytes, "repair-batch-commit", 1024 * 1024),
    directory: values.directory,
    generation_bytes: ownedBytes(
      values.generation_bytes,
      "repair-batch-generation",
      16 * 1024 * 1024
    )
  });
  const actions = snapshotBatchActions(values.actions);
  const prior = restoreLineagePlacementGeneration(owned.generation_bytes);
  assertExactBatchIntentSet(prior, actions);
  const evidenceMethod = evidence.readCurrentEvidence;
  const evidenceThis = values.evidence;
  const commitMethod = continuity.commitPlacementGeneration;
  const commitThis = values.continuity;

  const initialEvidence = await readCurrentEvidence(evidenceMethod, evidenceThis);
  deriveBatchEffects(owned, initialEvidence, actions);

  const effectResults = [];
  for (const action of actions) {
    const currentEvidence = await readCurrentEvidence(evidenceMethod, evidenceThis);
    const result = await executeLineagePlacementRepairEffect({
      ...repairEffectInputs(owned, currentEvidence, action),
      directory: owned.directory,
      provider: action.provider
    });
    effectResults.push(result);
  }

  const completionEvidence = await readCurrentEvidence(evidenceMethod, evidenceThis);
  const prepared = prepareBatchSuccessor(
    owned,
    completionEvidence,
    actions,
    effectResults
  );
  const key = `${resolve(owned.directory)}:${prepared.candidate.value.completion_slot_id}`;
  const pending = reflectApply(mapGetIntrinsic, inFlight, [key]);
  if (pending) return pending;
  Object.freeze(effectResults);
  const operation = completeBatchOperation(
    key,
    owned,
    commitMethod,
    commitThis,
    prepared.candidate,
    prepared.successor,
    effectResults
  );
  reflectApply(mapSetIntrinsic, inFlight, [key, operation]);
  return operation;
}
