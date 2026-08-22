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
  freeze,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";

const REQUEST_FORMAT = "mortalos-durable-repair-continuity-request/1";
const REQUEST_DOMAIN = "MortalOS durable repair Continuity request v1";
const CLAIM_FORMAT = "mortalos-durable-repair-continuity-claim/1";
const CLAIM_DOMAIN = "MortalOS durable repair Continuity claim v1";
const RESULT_FORMAT = "mortalos-durable-repair-continuity-result/1";
const RESULT_DOMAIN = "MortalOS durable repair Continuity result v1";
const RECOVERY_FORMAT = "mortalos-durable-repair-continuity-recovery/1";
const RECOVERY_DOMAIN = "MortalOS durable repair Continuity recovery v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const inFlight = new Map();
const mapDeleteIntrinsic = Map.prototype.delete;
const mapGetIntrinsic = Map.prototype.get;
const mapSetIntrinsic = Map.prototype.set;
const reflectApply = Reflect.apply;

export class DurableRepairContinuitySessionError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "DurableRepairContinuitySessionError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new DurableRepairContinuitySessionError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", `${label}-ordinary-own-data`);
  }
  if (ownKeys(descriptors).length !== expected.length) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", `${label}-keys`);
  }
  const result = Object.create(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", `${label}-keys`);
    result[key] = entry.value;
  }
  return result;
}

function ownedBytes(value, label, maximum) {
  const length = byteLengthOfBytes(value);
  if (
    length === null ||
    length < 1 ||
    length > maximum ||
    isSharedByteView(value)
  ) fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", label);
  return new Uint8Array(value);
}

function digestTail(value, label) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", label);
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
    `.mortalos-pending-continuity-session-${encodeBase64Url(randomBytes(16))}`
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
    if (!equalBytes(new Uint8Array(readFileSync(path)), bytes)) {
      fail("E_PLACEMENT_CONTINUITY_SESSION_IMMUTABLE_COLLISION", path);
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

function ownRequest(source) {
  const value = exactRecord(source, [
    "capsule_bytes",
    "generation_bytes",
    "idempotency_key"
  ], "durable-continuity-request");
  digestTail(value.idempotency_key, "idempotency-key");
  const capsuleBytes = ownedBytes(value.capsule_bytes, "durable-continuity-capsule", 16 * 1024 * 1024);
  const generationBytes = ownedBytes(
    value.generation_bytes,
    "durable-continuity-generation",
    16 * 1024 * 1024
  );
  const basis = freeze({
    capsule_base64url: encodeBase64Url(capsuleBytes),
    format: REQUEST_FORMAT,
    generation_base64url: encodeBase64Url(generationBytes),
    idempotency_key: value.idempotency_key
  });
  const request = freeze({
    ...basis,
    request_id: domainHash(REQUEST_DOMAIN, canonicalBytes(basis))
  });
  return freeze({
    bytes: canonicalBytes(request),
    continuity_request: freeze({
      capsule_bytes: capsuleBytes,
      generation_bytes: generationBytes,
      idempotency_key: value.idempotency_key
    }),
    value: request
  });
}

function restoreClaim(source, request) {
  const bytes = ownedBytes(source, "durable-continuity-claim", 4 * 1024);
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: 4 * 1024, maxDepth: 8 });
  } catch {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "durable-continuity-claim-json");
  }
  if (!isCanonical(bytes, parsed) || parsed?.format !== CLAIM_FORMAT) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "durable-continuity-claim-canonical");
  }
  const value = exactRecord(parsed, [
    "claim_id",
    "format",
    "owner_nonce",
    "request_id"
  ], "durable-continuity-stored-claim");
  const { claim_id: ignored, ...basis } = value;
  const nonce = decodeBase64Url(value.owner_nonce);
  if (
    byteLengthOfBytes(nonce) !== 32 ||
    value.request_id !== request.value.request_id ||
    domainHash(CLAIM_DOMAIN, canonicalBytes(basis)) !== value.claim_id
  ) fail("E_PLACEMENT_CONTINUITY_SESSION_BINDING", "durable-continuity-claim-id");
  return value;
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
    `.mortalos-pending-continuity-claim-${encodeBase64Url(randomBytes(16))}`
  );
  const path = join(directory, `continuity-claim-${tail}.json`);
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

function resultPath(directory, idempotencyKey) {
  return join(directory, `continuity-result-${digestTail(idempotencyKey, "idempotency-key")}.json`);
}

function requestPath(directory, idempotencyKey) {
  return join(directory, `continuity-request-${digestTail(idempotencyKey, "idempotency-key")}.json`);
}

function claimPath(directory, idempotencyKey) {
  return join(directory, `continuity-claim-${digestTail(idempotencyKey, "idempotency-key")}.json`);
}

function recoveryPath(directory, idempotencyKey) {
  return join(directory, `continuity-recovery-${digestTail(idempotencyKey, "idempotency-key")}.json`);
}

function restoreResult(source, request) {
  const bytes = ownedBytes(source, "durable-continuity-result", 18 * 1024 * 1024);
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: 18 * 1024 * 1024, maxDepth: 16 });
  } catch {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "durable-continuity-result-json");
  }
  if (!isCanonical(bytes, parsed) || parsed?.format !== RESULT_FORMAT) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "durable-continuity-result-canonical");
  }
  const value = exactRecord(parsed, [
    "capsule_base64url",
    "commit_base64url",
    "format",
    "idempotency_key",
    "request_id",
    "result_id"
  ], "durable-continuity-stored-result");
  const { result_id: ignored, ...basis } = value;
  if (
    value.idempotency_key !== request.value.idempotency_key ||
    value.request_id !== request.value.request_id ||
    domainHash(RESULT_DOMAIN, canonicalBytes(basis)) !== value.result_id
  ) fail("E_PLACEMENT_CONTINUITY_SESSION_BINDING", "durable-continuity-result-id");
  const capsuleBytes = decodeBase64Url(value.capsule_base64url);
  const commitBytes = decodeBase64Url(value.commit_base64url);
  if (!capsuleBytes || !commitBytes) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "durable-continuity-result-bytes");
  }
  return freeze({ capsule_bytes: capsuleBytes, commit_bytes: commitBytes });
}

function continuityResult(request, capsuleSource, commitSource) {
  const basis = freeze({
    capsule_base64url: encodeBase64Url(ownedBytes(
      capsuleSource,
      "durable-continuity-returned-capsule",
      16 * 1024 * 1024
    )),
    commit_base64url: encodeBase64Url(ownedBytes(
      commitSource,
      "durable-continuity-returned-commit",
      1024 * 1024
    )),
    format: RESULT_FORMAT,
    idempotency_key: request.value.idempotency_key,
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
    fail("E_PLACEMENT_CONTINUITY_SESSION_RECOVERY", "request-missing");
  }
  if (!equalBytes(new Uint8Array(readFileSync(storedRequestPath)), request.bytes)) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_BINDING", "recovery-request");
  }
  const storedClaimPath = claimPath(directory, request.value.idempotency_key);
  if (!existsSync(storedClaimPath)) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_RECOVERY", "claim-missing");
  }
  return restoreClaim(new Uint8Array(readFileSync(storedClaimPath)), request);
}

function recoverCompletedResult(directory, source) {
  const value = exactRecord(source, [
    "capsule_bytes",
    "generation_bytes",
    "idempotency_key",
    "result_capsule_bytes",
    "result_commit_bytes"
  ], "durable-continuity-recovery");
  const request = ownRequest(freeze({
    capsule_bytes: value.capsule_bytes,
    generation_bytes: value.generation_bytes,
    idempotency_key: value.idempotency_key
  }));
  const resolvedDirectory = resolve(directory);
  const claim = requireClaimedRequest(resolvedDirectory, request);
  const result = continuityResult(
    request,
    value.result_capsule_bytes,
    value.result_commit_bytes
  );
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

async function executeOwned(directory, commit, request) {
  mkdirSync(directory, { recursive: true });
  const tail = digestTail(request.value.idempotency_key, "idempotency-key");
  immutableFile(requestPath(directory, request.value.idempotency_key), request.bytes);
  const path = resultPath(directory, request.value.idempotency_key);
  if (existsSync(path)) return restoreResult(new Uint8Array(readFileSync(path)), request);
  if (!claimExecution(directory, tail, request)) {
    if (existsSync(path)) return restoreResult(new Uint8Array(readFileSync(path)), request);
    fail("E_PLACEMENT_CONTINUITY_SESSION_CLAIMED", request.value.idempotency_key);
  }
  const returned = await commit(request.continuity_request);
  requireRealm();
  const result = exactRecord(returned, ["capsule_bytes", "commit_bytes"], "durable-continuity-returned-result");
  const completed = continuityResult(request, result.capsule_bytes, result.commit_bytes);
  immutableFile(path, completed.bytes);
  return restoreResult(new Uint8Array(readFileSync(path)), request);
}

async function executeOperation(key, directory, commit, request) {
  try {
    return await executeOwned(directory, commit, request);
  } finally {
    reflectApply(mapDeleteIntrinsic, inFlight, [key]);
  }
}

export class DurableRepairContinuitySession {
  #commit;
  #directory;

  constructor(options) {
    const values = exactRecord(options, ["continuity", "directory"], "continuity-session-options");
    if (typeof values.directory !== "string" || values.directory.length < 1) {
      fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "continuity-session-directory");
    }
    try {
      this.#commit = snapshotDataMethod(
        values.continuity,
        "commitPlacementGeneration",
        "continuity-session-capability"
      );
    } catch {
      fail("E_PLACEMENT_CONTINUITY_SESSION_CAPABILITY", "commitPlacementGeneration");
    }
    this.#directory = resolve(values.directory);
    freeze(this);
  }

  async commitPlacementGeneration(source) {
    const request = ownRequest(source);
    const key = `${this.#directory}:${request.value.idempotency_key}`;
    const pending = reflectApply(mapGetIntrinsic, inFlight, [key]);
    if (pending) return pending;
    const operation = executeOperation(key, this.#directory, this.#commit, request);
    reflectApply(mapSetIntrinsic, inFlight, [key, operation]);
    return operation;
  }
}

export function createDurableRepairContinuitySession(options) {
  const session = new DurableRepairContinuitySession(options);
  const commitPlacementGeneration = snapshotDataMethod(
    session,
    "commitPlacementGeneration",
    "durable-continuity-session"
  );
  return freeze({
    commitPlacementGeneration(source) {
      return commitPlacementGeneration(source);
    }
  });
}

export function createDurableRepairContinuityResultRecovery(options) {
  const values = exactRecord(options, ["directory"], "continuity-recovery-options");
  if (typeof values.directory !== "string" || values.directory.length < 1) {
    fail("E_PLACEMENT_CONTINUITY_SESSION_FORMAT", "continuity-recovery-directory");
  }
  const directory = resolve(values.directory);
  return freeze({
    recoverCompletedPlacementGeneration(source) {
      return recoverCompletedResult(directory, source);
    }
  });
}
