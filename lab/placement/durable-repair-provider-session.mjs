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
  copyBoundedOwnDataArray,
  freeze,
  ownDataArrayLength,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";

const REQUEST_FORMAT = "mortalos-durable-repair-provider-request/1";
const REQUEST_DOMAIN = "MortalOS durable repair provider request v1";
const CLAIM_FORMAT = "mortalos-durable-repair-provider-claim/1";
const CLAIM_DOMAIN = "MortalOS durable repair provider claim v1";
const RESULT_FORMAT = "mortalos-durable-repair-provider-result/1";
const RESULT_DOMAIN = "MortalOS durable repair provider result v1";
const RECOVERY_FORMAT = "mortalos-durable-repair-provider-recovery/1";
const RECOVERY_DOMAIN = "MortalOS durable repair provider recovery v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const inFlight = new Map();
const mapDeleteIntrinsic = Map.prototype.delete;
const mapGetIntrinsic = Map.prototype.get;
const mapSetIntrinsic = Map.prototype.set;
const reflectApply = Reflect.apply;

export class DurableRepairProviderSessionError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "DurableRepairProviderSessionError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new DurableRepairProviderSessionError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_PROVIDER_SESSION_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", `${label}-keys`);
  }
  const result = Object.create(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", `${label}-keys`);
    result[key] = entry.value;
  }
  return result;
}

function ownedBytes(value, label, maximum = 2 * 1024 * 1024) {
  const length = byteLengthOfBytes(value);
  if (
    length === null ||
    length < 1 ||
    length > maximum ||
    isSharedByteView(value)
  ) fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", label);
  return new Uint8Array(value);
}

function denseBytes(sources, label) {
  let length;
  try {
    length = ownDataArrayLength(sources, label);
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", `${label}-dense-array`);
  }
  if (length > 64) fail("E_PLACEMENT_PROVIDER_SESSION_LIMIT", `${label}-length`);
  let values;
  try {
    values = copyBoundedOwnDataArray(sources, length, label);
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", `${label}-dense-array`);
  }
  const encoded = [];
  for (let index = 0; index < values.length; index += 1) {
    encoded.push(encodeBase64Url(ownedBytes(values[index], label)));
  }
  return freeze(encoded);
}

function encodePlacement(source) {
  const value = exactRecord(source, [
    "consumption_announcements",
    "execution_receipts",
    "lease",
    "observed_at_ms",
    "offer",
    "revocations",
    "usage_receipts"
  ], "durable-provider-placement");
  return freeze({
    consumption_announcements_base64url: denseBytes(
      value.consumption_announcements,
      "durable-provider-announcements"
    ),
    execution_receipts_base64url: denseBytes(
      value.execution_receipts,
      "durable-provider-execution-receipts"
    ),
    lease_base64url: encodeBase64Url(ownedBytes(value.lease, "durable-provider-lease")),
    observed_at_ms: value.observed_at_ms,
    offer_base64url: encodeBase64Url(ownedBytes(value.offer, "durable-provider-offer")),
    revocations_base64url: denseBytes(value.revocations, "durable-provider-revocations"),
    usage_receipts_base64url: denseBytes(
      value.usage_receipts,
      "durable-provider-usage-receipts"
    )
  });
}

function decodeMany(sources, label) {
  if (!Array.isArray(sources) || sources.length > 64) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", label);
  }
  const result = [];
  for (let index = 0; index < sources.length; index += 1) {
    const bytes = decodeBase64Url(sources[index]);
    if (!bytes) fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", label);
    result.push(bytes);
  }
  return freeze(result);
}

function decodePlacement(value) {
  const placement = exactRecord(value, [
    "consumption_announcements_base64url",
    "execution_receipts_base64url",
    "lease_base64url",
    "observed_at_ms",
    "offer_base64url",
    "revocations_base64url",
    "usage_receipts_base64url"
  ], "durable-provider-stored-placement");
  return freeze({
    consumption_announcements: decodeMany(
      placement.consumption_announcements_base64url,
      "durable-provider-announcements"
    ),
    execution_receipts: decodeMany(
      placement.execution_receipts_base64url,
      "durable-provider-execution-receipts"
    ),
    lease: decodeBase64Url(placement.lease_base64url),
    observed_at_ms: placement.observed_at_ms,
    offer: decodeBase64Url(placement.offer_base64url),
    revocations: decodeMany(
      placement.revocations_base64url,
      "durable-provider-revocations"
    ),
    usage_receipts: decodeMany(
      placement.usage_receipts_base64url,
      "durable-provider-usage-receipts"
    )
  });
}

function digestTail(value, label) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", label);
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

function immutableFile(path, bytes) {
  const temporary = join(
    dirname(path),
    `.mortalos-pending-provider-session-${encodeBase64Url(randomBytes(16))}`
  );
  let created = false;
  try {
    syncFile(temporary, bytes);
    created = true;
    try {
      linkSync(temporary, path);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const existing = new Uint8Array(readFileSync(path));
    if (!equalBytes(existing, bytes)) {
      fail("E_PLACEMENT_PROVIDER_SESSION_IMMUTABLE_COLLISION", path);
    }
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

function restoreClaim(source, request) {
  const bytes = ownedBytes(source, "durable-provider-claim", 4 * 1024);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: 4 * 1024, maxDepth: 8 });
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "durable-provider-claim-json");
  }
  if (!isCanonical(bytes, value) || value?.format !== CLAIM_FORMAT) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "durable-provider-claim-canonical");
  }
  const parsed = exactRecord(value, [
    "claim_id",
    "format",
    "owner_nonce",
    "request_id"
  ], "durable-provider-stored-claim");
  const { claim_id: ignored, ...basis } = parsed;
  const ownerNonce = decodeBase64Url(parsed.owner_nonce);
  if (
    byteLengthOfBytes(ownerNonce) !== 32 ||
    parsed.request_id !== request.value.request_id ||
    domainHash(CLAIM_DOMAIN, canonicalBytes(basis)) !== parsed.claim_id
  ) fail("E_PLACEMENT_PROVIDER_SESSION_BINDING", "durable-provider-claim-id");
  return parsed;
}

function claimExecution(directory, tail, request) {
  const basis = freeze({
    format: CLAIM_FORMAT,
    owner_nonce: encodeBase64Url(randomBytes(32)),
    request_id: request.value.request_id
  });
  const claim = freeze({
    claim_id: domainHash(CLAIM_DOMAIN, canonicalBytes(basis)),
    ...basis
  });
  const bytes = canonicalBytes(claim);
  const temporary = join(
    directory,
    `.mortalos-pending-provider-claim-${encodeBase64Url(randomBytes(16))}`
  );
  const path = join(directory, `provider-claim-${tail}.json`);
  let created = false;
  let won = false;
  try {
    syncFile(temporary, bytes);
    created = true;
    try {
      linkSync(temporary, path);
      won = true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    restoreClaim(new Uint8Array(readFileSync(path)), request);
    return won;
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

function ownRequest(source) {
  const value = exactRecord(source, [
    "effect",
    "effect_bytes",
    "idempotency_key",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes"
  ], "durable-provider-request");
  const effectBytes = ownedBytes(
    value.effect_bytes,
    "durable-provider-effect",
    8 * 1024 * 1024
  );
  let effect;
  try {
    effect = parseJsonBytes(effectBytes, { maxBytes: 8 * 1024 * 1024, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "durable-provider-effect-json");
  }
  if (!isCanonical(effectBytes, effect) || effect?.effect_id !== value.idempotency_key) {
    fail("E_PLACEMENT_PROVIDER_SESSION_BINDING", "effect-idempotency-key");
  }
  digestTail(value.idempotency_key, "idempotency-key");
  const basis = freeze({
    effect_base64url: encodeBase64Url(effectBytes),
    format: REQUEST_FORMAT,
    idempotency_key: value.idempotency_key,
    replacement_lease_base64url: encodeBase64Url(ownedBytes(
      value.replacement_lease_bytes,
      "durable-provider-replacement-lease"
    )),
    replacement_offer_base64url: encodeBase64Url(ownedBytes(
      value.replacement_offer_bytes,
      "durable-provider-replacement-offer"
    )),
    resource_base64url: encodeBase64Url(ownedBytes(
      value.resource_bytes,
      "durable-provider-resource"
    ))
  });
  const request = freeze({
    ...basis,
    request_id: domainHash(REQUEST_DOMAIN, canonicalBytes(basis))
  });
  return freeze({
    bytes: canonicalBytes(request),
    provider_request: freeze({
      effect: freeze(effect),
      effect_bytes: effectBytes,
      idempotency_key: value.idempotency_key,
      replacement_lease_bytes: decodeBase64Url(basis.replacement_lease_base64url),
      replacement_offer_bytes: decodeBase64Url(basis.replacement_offer_base64url),
      resource_bytes: decodeBase64Url(basis.resource_base64url)
    }),
    value: request
  });
}

function resultPath(directory, idempotencyKey) {
  return join(
    directory,
    `provider-result-${digestTail(idempotencyKey, "idempotency-key")}.json`
  );
}

function requestPath(directory, idempotencyKey) {
  return join(
    directory,
    `provider-request-${digestTail(idempotencyKey, "idempotency-key")}.json`
  );
}

function claimPath(directory, idempotencyKey) {
  return join(
    directory,
    `provider-claim-${digestTail(idempotencyKey, "idempotency-key")}.json`
  );
}

function recoveryPath(directory, idempotencyKey) {
  return join(
    directory,
    `provider-recovery-${digestTail(idempotencyKey, "idempotency-key")}.json`
  );
}

function restoreResult(source, request) {
  const bytes = ownedBytes(source, "durable-provider-result", 16 * 1024 * 1024);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: 16 * 1024 * 1024, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "durable-provider-result-json");
  }
  if (!isCanonical(bytes, value) || value?.format !== RESULT_FORMAT) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "durable-provider-result-canonical");
  }
  const parsed = exactRecord(value, [
    "format",
    "idempotency_key",
    "placement",
    "request_id",
    "result_id"
  ], "durable-provider-stored-result");
  const { result_id: ignored, ...basis } = parsed;
  if (
    parsed.idempotency_key !== request.value.idempotency_key ||
    parsed.request_id !== request.value.request_id ||
    domainHash(RESULT_DOMAIN, canonicalBytes(basis)) !== parsed.result_id
  ) fail("E_PLACEMENT_PROVIDER_SESSION_BINDING", "durable-provider-result-id");
  return freeze({ placement: decodePlacement(parsed.placement) });
}

function providerResult(request, placementSource) {
  const placement = encodePlacement(placementSource);
  const basis = freeze({
    format: RESULT_FORMAT,
    idempotency_key: request.value.idempotency_key,
    placement,
    request_id: request.value.request_id
  });
  const value = freeze({
    ...basis,
    result_id: domainHash(RESULT_DOMAIN, canonicalBytes(basis))
  });
  return freeze({ bytes: canonicalBytes(value), value });
}

function requireClaimedRequest(directory, request) {
  const storedRequestPath = requestPath(directory, request.value.idempotency_key);
  if (!existsSync(storedRequestPath)) {
    fail("E_PLACEMENT_PROVIDER_SESSION_RECOVERY", "request-missing");
  }
  if (!equalBytes(new Uint8Array(readFileSync(storedRequestPath)), request.bytes)) {
    fail("E_PLACEMENT_PROVIDER_SESSION_BINDING", "recovery-request");
  }
  const storedClaimPath = claimPath(directory, request.value.idempotency_key);
  if (!existsSync(storedClaimPath)) {
    fail("E_PLACEMENT_PROVIDER_SESSION_RECOVERY", "claim-missing");
  }
  const claim = restoreClaim(new Uint8Array(readFileSync(storedClaimPath)), request);
  return claim;
}

function recoverCompletedResult(directory, source) {
  const value = exactRecord(source, [
    "effect",
    "effect_bytes",
    "idempotency_key",
    "placement",
    "replacement_lease_bytes",
    "replacement_offer_bytes",
    "resource_bytes"
  ], "durable-provider-recovery");
  const request = ownRequest(freeze({
    effect: value.effect,
    effect_bytes: value.effect_bytes,
    idempotency_key: value.idempotency_key,
    replacement_lease_bytes: value.replacement_lease_bytes,
    replacement_offer_bytes: value.replacement_offer_bytes,
    resource_bytes: value.resource_bytes
  }));
  const resolvedDirectory = resolve(directory);
  const claim = requireClaimedRequest(resolvedDirectory, request);
  const result = providerResult(request, value.placement);
  const existingResultPath = resultPath(resolvedDirectory, request.value.idempotency_key);
  immutableFile(existingResultPath, result.bytes);
  const recoveryBasis = freeze({
    claim_id: claim.claim_id,
    format: RECOVERY_FORMAT,
    request_id: request.value.request_id,
    result_id: result.value.result_id
  });
  const recovery = freeze({
    ...recoveryBasis,
    recovery_id: domainHash(RECOVERY_DOMAIN, canonicalBytes(recoveryBasis))
  });
  immutableFile(
    recoveryPath(resolvedDirectory, request.value.idempotency_key),
    canonicalBytes(recovery)
  );
  return restoreResult(new Uint8Array(readFileSync(existingResultPath)), request);
}

async function executeOwned(directory, execute, request) {
  mkdirSync(directory, { recursive: true });
  const tail = digestTail(request.value.idempotency_key, "idempotency-key");
  immutableFile(requestPath(directory, request.value.idempotency_key), request.bytes);
  const path = resultPath(directory, request.value.idempotency_key);
  if (existsSync(path)) return restoreResult(new Uint8Array(readFileSync(path)), request);
  if (!claimExecution(directory, tail, request)) {
    if (existsSync(path)) return restoreResult(new Uint8Array(readFileSync(path)), request);
    fail("E_PLACEMENT_PROVIDER_SESSION_CLAIMED", request.value.idempotency_key);
  }

  const returned = await execute(request.provider_request);
  requireRealm();
  const result = exactRecord(returned, ["placement"], "durable-provider-returned-result");
  const completed = providerResult(request, result.placement);
  immutableFile(path, completed.bytes);
  return restoreResult(new Uint8Array(readFileSync(path)), request);
}

async function executeOperation(key, directory, execute, request) {
  try {
    return await executeOwned(directory, execute, request);
  } finally {
    reflectApply(mapDeleteIntrinsic, inFlight, [key]);
  }
}

export class DurableRepairProviderSession {
  #directory;
  #execute;

  constructor(options) {
    const values = exactRecord(options, ["directory", "provider"], "provider-session-options");
    if (typeof values.directory !== "string" || values.directory.length < 1) {
      fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "provider-session-directory");
    }
    try {
      this.#execute = snapshotDataMethod(
        values.provider,
        "executeRepairEffect",
        "provider-session-provider"
      );
    } catch {
      fail("E_PLACEMENT_PROVIDER_SESSION_CAPABILITY", "executeRepairEffect");
    }
    this.#directory = resolve(values.directory);
    freeze(this);
  }

  async executeRepairEffect(source) {
    const request = ownRequest(source);
    const key = `${this.#directory}:${request.value.idempotency_key}`;
    const pending = reflectApply(mapGetIntrinsic, inFlight, [key]);
    if (pending) return pending;
    const operation = executeOperation(key, this.#directory, this.#execute, request);
    reflectApply(mapSetIntrinsic, inFlight, [key, operation]);
    return operation;
  }
}

export function createDurableRepairProviderSession(options) {
  const session = new DurableRepairProviderSession(options);
  const executeRepairEffect = snapshotDataMethod(
    session,
    "executeRepairEffect",
    "durable-provider-session"
  );
  return freeze({
    executeRepairEffect(source) {
      return executeRepairEffect(source);
    }
  });
}

export function createDurableRepairProviderResultRecovery(options) {
  const values = exactRecord(options, ["directory"], "provider-recovery-options");
  if (typeof values.directory !== "string" || values.directory.length < 1) {
    fail("E_PLACEMENT_PROVIDER_SESSION_FORMAT", "provider-recovery-directory");
  }
  const directory = resolve(values.directory);
  return freeze({
    recoverCompletedRepairEffect(source) {
      return recoverCompletedResult(directory, source);
    }
  });
}
