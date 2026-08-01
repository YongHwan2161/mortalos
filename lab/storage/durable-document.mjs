import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  encodeBase64Url
} from "../../src/index.mjs";
import {
  ParticipantCore,
  ParticipantCoreError
} from "../participant/core.mjs";
import {
  importEvidenceBundleBytes,
  publicRecordsFromEvidenceBundle
} from "../evidence-export.mjs";
import {
  assertNonExtractableSigningKey,
  custodianFromPublicKeyBytes
} from "../participant/webcrypto-key-store.mjs";

export const DURABLE_DOCUMENT_FORMAT = "mortalos-durable-participant/2";
export const DURABLE_DOCUMENT_SCHEMA_VERSION = 2;
export const DURABLE_POLICY_FORMAT = "mortalos-authority-policy/1";
export const DURABLE_JOURNAL_FORMAT = "mortalos-sign-once-journal-entry/1";
export const DURABLE_PENDING_FORMAT = "mortalos-durable-pending/1";

const DOCUMENT_KEYS = Object.freeze([
  "committed_head_cache",
  "endpoint_id",
  "evidence",
  "format",
  "id",
  "journal",
  "key",
  "migration",
  "pending",
  "phase",
  "policy",
  "revision",
  "schema_version",
  "state_references"
]);
const KEY_KEYS = Object.freeze([
  "key_id",
  "private_key",
  "public_key",
  "public_key_raw"
]);
const POLICY_KEYS = Object.freeze([
  "expired_at",
  "expires_at",
  "format",
  "removed_at",
  "renewal_counter",
  "status"
]);
const MIGRATION_KEYS = Object.freeze(["completed_at", "from_schema"]);
const STATE_REFERENCE_KEYS = Object.freeze(["sequence", "state_root"]);
const HEAD_CACHE_KEYS = Object.freeze(["head_hash", "sequence", "state_root"]);
const JOURNAL_KEYS = Object.freeze([
  "body_digest",
  "format",
  "key_id",
  "message_digest",
  "purpose",
  "signature",
  "status",
  "tuple"
]);
const PENDING_KEYS = Object.freeze([
  "acceptances",
  "approvals",
  "format",
  "kind",
  "proposal",
  "tuple"
]);

const structuredCloneIntrinsic = globalThis.structuredClone;
const reflectApply = Reflect.apply;

function clone(value) {
  return reflectApply(structuredCloneIntrinsic, globalThis, [value]);
}

function durableError(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.name = "DurableParticipantError";
  error.code = code;
  return error;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw durableError("E_DURABLE_SCHEMA", `${label} is invalid`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((entry, index) => entry !== wanted[index])) {
    throw durableError("E_DURABLE_SCHEMA", `${label} has unknown or missing fields`);
  }
}

function taggedDigest(value) {
  return `sha256:${encodeBase64Url(sha256(canonicalBytes(value)))}`;
}

function bytesDigest(value) {
  if (!(value instanceof Uint8Array)) throw durableError("E_DURABLE_SCHEMA", "signing message must be bytes");
  return `sha256:${encodeBase64Url(sha256(value))}`;
}

function assertEndpointId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(value)) {
    throw durableError("E_DURABLE_SCHEMA", "bounded endpoint ID required");
  }
}

function assertTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw durableError("E_DURABLE_SCHEMA", `${label} must be a non-negative timestamp`);
  }
}

function assertPolicy(policy) {
  exactKeys(policy, POLICY_KEYS, "authority policy");
  if (policy.format !== DURABLE_POLICY_FORMAT) {
    throw durableError("E_DURABLE_SCHEMA", "unsupported authority policy");
  }
  if (!["active", "expired", "removed"].includes(policy.status)) {
    throw durableError("E_DURABLE_SCHEMA", "invalid authority policy status");
  }
  assertTimestamp(policy.expired_at, "authority expiry observation", { nullable: true });
  assertTimestamp(policy.expires_at, "authority expiry", { nullable: true });
  assertTimestamp(policy.removed_at, "authority removal", { nullable: true });
  if (!Number.isSafeInteger(policy.renewal_counter) || policy.renewal_counter < 0) {
    throw durableError("E_DURABLE_SCHEMA", "authority renewal counter is invalid");
  }
  if (
    (policy.status === "active" &&
      (policy.expired_at !== null || policy.removed_at !== null)) ||
    (policy.status === "expired" &&
      (
        policy.expires_at === null ||
        policy.expired_at === null ||
        policy.expired_at < policy.expires_at ||
        policy.removed_at !== null
      )) ||
    (policy.status === "removed" && policy.removed_at === null)
  ) {
    throw durableError("E_DURABLE_SCHEMA", "authority policy metadata is inconsistent");
  }
}

function assertMigration(migration) {
  exactKeys(migration, MIGRATION_KEYS, "migration metadata");
  if (migration.from_schema !== null && migration.from_schema !== 1) {
    throw durableError("E_DURABLE_MIGRATION", "unsupported migration source");
  }
  assertTimestamp(migration.completed_at, "migration completion", { nullable: true });
  if ((migration.from_schema === null) !== (migration.completed_at === null)) {
    throw durableError("E_DURABLE_MIGRATION", "migration metadata is incomplete");
  }
}

function assertKeyRecord(key) {
  if (key === null) return;
  exactKeys(key, KEY_KEYS, "durable key");
  if (
    typeof key.key_id !== "string" ||
    typeof key.public_key !== "string" ||
    !(key.public_key_raw instanceof ArrayBuffer)
  ) {
    throw durableError("E_DURABLE_KEY", "durable key metadata is corrupt");
  }
}

function assertStateReference(reference) {
  exactKeys(reference, STATE_REFERENCE_KEYS, "state reference");
  if (
    typeof reference.sequence !== "string" ||
    typeof reference.state_root !== "string"
  ) {
    throw durableError("E_DURABLE_STATE", "state reference is corrupt");
  }
}

function assertHeadCache(cache) {
  if (cache === null) return;
  exactKeys(cache, HEAD_CACHE_KEYS, "committed head cache");
  if (
    typeof cache.head_hash !== "string" ||
    typeof cache.sequence !== "string" ||
    typeof cache.state_root !== "string"
  ) {
    throw durableError("E_DURABLE_SCHEMA", "committed head cache is corrupt");
  }
}

function assertJournalEntry(entry) {
  exactKeys(entry, JOURNAL_KEYS, "sign-once journal entry");
  if (
    entry.format !== DURABLE_JOURNAL_FORMAT ||
    typeof entry.tuple !== "string" ||
    typeof entry.key_id !== "string" ||
    typeof entry.purpose !== "string" ||
    typeof entry.body_digest !== "string" ||
    typeof entry.message_digest !== "string" ||
    !["reserved", "signed", "committed", "abandoned"].includes(entry.status)
  ) {
    throw durableError("E_DURABLE_JOURNAL", "sign-once journal entry is corrupt");
  }
  const signatureValid = entry.signature !== null &&
    entry.signature.key_id === entry.key_id &&
    typeof entry.signature.signature === "string";
  if (
    (entry.status === "reserved" && entry.signature !== null) ||
    (["signed", "committed"].includes(entry.status) && !signatureValid) ||
    (entry.status === "abandoned" && entry.signature !== null && !signatureValid)
  ) {
    throw durableError("E_DURABLE_JOURNAL", "sign-once journal signature state is corrupt");
  }
}

function assertPending(pending) {
  if (pending === null) return;
  exactKeys(pending, PENDING_KEYS, "pending operation");
  if (
    pending.format !== DURABLE_PENDING_FORMAT ||
    !["genesis", "pulse-approval", "custody-acceptance"].includes(pending.kind) ||
    typeof pending.tuple !== "string" ||
    !pending.proposal ||
    typeof pending.proposal !== "object" ||
    !Array.isArray(pending.approvals) ||
    !Array.isArray(pending.acceptances)
  ) {
    throw durableError("E_DURABLE_JOURNAL", "pending operation is corrupt");
  }
}

function canonicalStateReferences(core) {
  const snapshot = core.snapshot();
  return [{
    sequence: snapshot.sequence,
    state_root: snapshot.state_root
  }];
}

export function createAuthorityPolicy({ expiresAt = null } = {}) {
  assertTimestamp(expiresAt, "authority expiry", { nullable: true });
  return {
    expired_at: null,
    expires_at: expiresAt,
    format: DURABLE_POLICY_FORMAT,
    removed_at: null,
    renewal_counter: 0,
    status: "active"
  };
}

export function createKeyReadyDocument({
  endpointId,
  key,
  policy,
  migration = { completed_at: null, from_schema: null }
}) {
  assertEndpointId(endpointId);
  assertKeyRecord(key);
  assertPolicy(policy);
  if (policy.status === "active" && !key) {
    throw durableError("E_DURABLE_KEY", "active durable key is required");
  }
  if (policy.status === "removed" && key) {
    throw durableError("E_DURABLE_KEY", "removed authority cannot retain a key");
  }
  assertMigration(migration);
  return {
    committed_head_cache: null,
    endpoint_id: endpointId,
    evidence: [],
    format: DURABLE_DOCUMENT_FORMAT,
    id: "active",
    journal: [],
    key: clone(key),
    migration: clone(migration),
    pending: null,
    phase: "key_ready",
    policy: clone(policy),
    revision: 0,
    schema_version: DURABLE_DOCUMENT_SCHEMA_VERSION,
    state_references: []
  };
}

export function signingTuple({ body, keyId, purpose }) {
  if (!body || typeof body !== "object" || typeof keyId !== "string" || typeof purpose !== "string") {
    throw durableError("E_DURABLE_SCHEMA", "signing tuple inputs are invalid");
  }
  const organism = body.organism_id ?? taggedDigest(body);
  const sequence = body.sequence ?? "genesis";
  const parent = body.parent_hash ?? "genesis";
  return `${purpose}/${keyId}/${organism}/${sequence}/${parent}`;
}

export function reserveSigningIntent(document, {
  body,
  kind,
  keyId,
  message,
  proposal,
  purpose
}) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  if (next.policy.status !== "active" || !next.key || next.key.key_id !== keyId) {
    throw durableError("E_DURABLE_AUTHORITY", "local durable signing authority is unavailable");
  }
  const tuple = signingTuple({ body, keyId, purpose });
  const bodyDigest = taggedDigest(body);
  const messageDigest = bytesDigest(message);
  const prior = next.journal.find((entry) => entry.tuple === tuple);
  if (prior) {
    if (prior.body_digest !== bodyDigest || prior.message_digest !== messageDigest || prior.purpose !== purpose) {
      throw durableError("E_DURABLE_EQUIVOCATION", "sign-once tuple is already bound to another body");
    }
    if (!next.pending || next.pending.tuple !== tuple) {
      throw durableError("E_DURABLE_JOURNAL", "journal entry is missing its recoverable pending operation");
    }
    return { document: next, entry: clone(prior), existing: true };
  }
  if (next.pending !== null) {
    throw durableError("E_DURABLE_PENDING", "another operation is already pending");
  }
  const entry = {
    body_digest: bodyDigest,
    format: DURABLE_JOURNAL_FORMAT,
    key_id: keyId,
    message_digest: messageDigest,
    purpose,
    signature: null,
    status: "reserved",
    tuple
  };
  next.journal.push(entry);
  next.pending = {
    acceptances: [],
    approvals: [],
    format: DURABLE_PENDING_FORMAT,
    kind,
    proposal: clone(proposal),
    tuple
  };
  next.revision += 1;
  return { document: next, entry: clone(entry), existing: false };
}

export function recordDurableSignature(document, tuple, signature) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  const entry = next.journal.find((candidate) => candidate.tuple === tuple);
  if (!entry || !next.pending || next.pending.tuple !== tuple) {
    throw durableError("E_DURABLE_JOURNAL", "reserved signing intent is missing");
  }
  if (!signature || signature.key_id !== entry.key_id || typeof signature.signature !== "string") {
    throw durableError("E_DURABLE_JOURNAL", "signature does not match the reserved key");
  }
  if (entry.signature && entry.signature.signature !== signature.signature) {
    throw durableError("E_DURABLE_EQUIVOCATION", "recovered signature differs from the durable signature");
  }
  entry.signature = clone(signature);
  entry.status = "signed";
  if (entry.purpose === "custody-acceptance") next.pending.acceptances = [clone(signature)];
  else next.pending.approvals = [clone(signature)];
  next.revision += 1;
  return next;
}

export function committedDocument(document, records, { committedTuple = null, validatedCore = null } = {}) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  if (!Array.isArray(records) || records.length === 0) {
    throw durableError("E_DURABLE_EVIDENCE", "committed evidence is required");
  }
  const core = validatedCore ?? new ParticipantCore(next.endpoint_id);
  if (validatedCore) {
    if (JSON.stringify(validatedCore.records) !== JSON.stringify(records)) {
      throw durableError("E_DURABLE_EVIDENCE", "validated core does not match committed evidence");
    }
  } else {
    core.openGenesis(records[0], records.slice(1), {
      requireAllOriginApprovals: records.length === 1 &&
        records[0].envelope.body.initial_custodians.length === 3
    });
  }
  const snapshot = core.snapshot({
    keyCount: next.key ? 1 : 0,
    keyId: next.key?.key_id ?? null
  });
  next.evidence = clone(records);
  next.state_references = canonicalStateReferences(core);
  next.committed_head_cache = {
    head_hash: snapshot.head_hash,
    sequence: snapshot.sequence,
    state_root: snapshot.state_root
  };
  next.phase = "commissioned";
  if (committedTuple !== null) {
    const entry = next.journal.find((candidate) => candidate.tuple === committedTuple);
    if (!entry || entry.status !== "signed") {
      throw durableError("E_DURABLE_JOURNAL", "signed journal entry required before commit");
    }
    entry.status = "committed";
  }
  next.pending = null;
  next.revision += 1;
  return next;
}

export function expiredAuthorityDocument(document, expiredAt) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  assertTimestamp(expiredAt, "authority expiry observation");
  if (next.policy.status === "removed" || !next.key) {
    throw durableError("E_DURABLE_AUTHORITY", "removed authority cannot expire");
  }
  if (next.policy.expires_at === null || expiredAt < next.policy.expires_at) {
    throw durableError("E_DURABLE_POLICY", "authority expiry has not been reached");
  }
  if (next.policy.status === "expired") return next;
  next.policy.expired_at = expiredAt;
  next.policy.status = "expired";
  next.revision += 1;
  return next;
}

export function renewedDocument(document, expiresAt, observedAt) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  if (next.policy.status === "removed" || !next.key) {
    throw durableError("E_DURABLE_AUTHORITY", "removed authority cannot be renewed");
  }
  assertTimestamp(expiresAt, "authority expiry", { nullable: true });
  assertTimestamp(observedAt, "authority renewal observation");
  const highWatermark = Math.max(observedAt, next.policy.expired_at ?? 0);
  if (
    next.policy.status === "expired" &&
    (expiresAt === null || expiresAt <= highWatermark)
  ) {
    throw durableError(
      "E_DURABLE_POLICY",
      "expired authority renewal requires an expiry beyond the persisted high-water mark"
    );
  }
  next.policy.expires_at = expiresAt;
  next.policy.expired_at = expiresAt !== null && expiresAt <= highWatermark
    ? highWatermark
    : null;
  next.policy.renewal_counter += 1;
  next.policy.status = next.policy.expired_at === null ? "active" : "expired";
  next.revision += 1;
  return next;
}

export function removedAuthorityDocument(document, removedAt) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  assertTimestamp(removedAt, "authority removal");
  next.key = null;
  next.pending = null;
  for (const entry of next.journal) {
    if (entry.status === "reserved") entry.status = "abandoned";
    if (entry.status === "signed") entry.status = "abandoned";
  }
  next.policy = {
    ...next.policy,
    removed_at: removedAt,
    status: "removed"
  };
  next.revision += 1;
  return next;
}

export function assertDurableDocumentStructure(document) {
  exactKeys(document, DOCUMENT_KEYS, "durable document");
  if (
    document.id !== "active" ||
    document.format !== DURABLE_DOCUMENT_FORMAT ||
    document.schema_version !== DURABLE_DOCUMENT_SCHEMA_VERSION ||
    !Number.isSafeInteger(document.revision) ||
    document.revision < 0 ||
    !["key_ready", "joining", "commissioned"].includes(document.phase)
  ) {
    throw durableError("E_DURABLE_SCHEMA", "unsupported durable document");
  }
  assertEndpointId(document.endpoint_id);
  assertKeyRecord(document.key);
  assertPolicy(document.policy);
  assertMigration(document.migration);
  if (!Array.isArray(document.evidence) || !Array.isArray(document.journal) ||
      !Array.isArray(document.state_references)) {
    throw durableError("E_DURABLE_SCHEMA", "durable collections are corrupt");
  }
  for (const reference of document.state_references) assertStateReference(reference);
  for (const entry of document.journal) assertJournalEntry(entry);
  if (new Set(document.journal.map((entry) => entry.tuple)).size !== document.journal.length) {
    throw durableError("E_DURABLE_JOURNAL", "duplicate sign-once tuple");
  }
  assertPending(document.pending);
  assertHeadCache(document.committed_head_cache);
  if (document.phase === "key_ready") {
    if (document.evidence.length !== 0 || document.state_references.length !== 0 ||
        document.committed_head_cache !== null) {
      throw durableError("E_DURABLE_EVIDENCE", "key-ready document contains committed evidence");
    }
  } else if (document.evidence.length === 0) {
    throw durableError("E_DURABLE_EVIDENCE", "commissioned document is missing evidence");
  }
  if (["active", "expired"].includes(document.policy.status) && document.key === null) {
    throw durableError("E_DURABLE_KEY", "retained authority is missing its key");
  }
  if (document.policy.status === "removed" && document.key !== null) {
    throw durableError("E_DURABLE_KEY", "removed authority retained a key");
  }
  if (document.pending) {
    const entry = document.journal.find((candidate) => candidate.tuple === document.pending.tuple);
    if (!entry || entry.status === "committed") {
      throw durableError("E_DURABLE_JOURNAL", "pending operation is not recoverable");
    }
  }
  return document;
}

export async function replayDurableDocument(document, { now = Date.now() } = {}) {
  const next = clone(document);
  assertDurableDocumentStructure(next);
  assertTimestamp(now, "replay clock");
  if (next.key) {
    await assertNonExtractableSigningKey(next.key.private_key);
    const raw = new Uint8Array(next.key.public_key_raw);
    const custodian = custodianFromPublicKeyBytes(raw);
    if (custodian.key_id !== next.key.key_id || custodian.public_key !== next.key.public_key) {
      throw durableError("E_DURABLE_KEY", "key handle and public identity mismatch");
    }
  }
  if (next.phase === "key_ready") return { core: null, document: next, snapshot: null };
  const core = new ParticipantCore(next.endpoint_id);
  try {
    core.openGenesis(next.evidence[0], next.evidence.slice(1), {
      requireAllOriginApprovals: next.evidence[0].envelope.body.initial_custodians.length === 3
    });
  } catch (error) {
    if (error instanceof ParticipantCoreError) {
      throw durableError("E_DURABLE_EVIDENCE", error.message);
    }
    throw error;
  }
  const expectedReferences = canonicalStateReferences(core);
  if (JSON.stringify(next.state_references) !== JSON.stringify(expectedReferences)) {
    throw durableError("E_DURABLE_STATE", "state references do not match canonical evidence replay");
  }
  const snapshot = core.snapshot({
    keyCount: next.key ? 1 : 0,
    keyId: next.key?.key_id ?? null
  });
  if (
    next.key &&
    snapshot.current_custodian === false &&
    next.phase === "commissioned" &&
    ["active", "expired"].includes(next.policy.status) &&
    next.pending === null
  ) {
    throw durableError("E_DURABLE_CUSTODY", "stored key is not current custody");
  }
  const recoveredCache = {
    head_hash: snapshot.head_hash,
    sequence: snapshot.sequence,
    state_root: snapshot.state_root
  };
  next.committed_head_cache = recoveredCache;
  if (next.pending) {
    const entry = next.journal.find((candidate) => candidate.tuple === next.pending.tuple);
    const body = next.pending.kind === "genesis"
      ? next.pending.proposal.body
      : next.pending.proposal.body;
    if (entry.body_digest !== taggedDigest(body)) {
      throw durableError("E_DURABLE_JOURNAL", "pending proposal differs from its sign-once reservation");
    }
  }
  return { core, document: next, snapshot };
}

export function durableDigest(value) {
  return taggedDigest(value);
}

export function migrateLegacyDurableSnapshot({
  evidence,
  keys,
  meta
}, {
  completedAt,
  endpointId = "durable"
}) {
  assertTimestamp(completedAt, "migration completion");
  if (!evidence && !keys && !meta) return null;
  if (
    !evidence ||
    !meta ||
    evidence.id !== "active" ||
    meta.id !== "active" ||
    meta.schema_version !== 1 ||
    meta.pending !== null ||
    typeof meta.authority_removed !== "boolean" ||
    !Number.isSafeInteger(meta.expires_at)
  ) {
    throw durableError("E_DURABLE_MIGRATION", "legacy durable snapshot is incomplete or corrupt");
  }
  if (meta.authority_removed && keys) {
    throw durableError(
      "E_DURABLE_MIGRATION",
      "legacy removed authority inconsistently retains a key"
    );
  }
  if (!meta.authority_removed && !keys) {
    throw durableError("E_DURABLE_MIGRATION", "legacy active authority is missing its key");
  }
  const imported = importEvidenceBundleBytes(canonicalBytes(evidence.bundle));
  const records = publicRecordsFromEvidenceBundle(imported.bundle);
  let key = null;
  if (keys) {
    if (
      keys.id !== "active" ||
      typeof keys.key_id !== "string" ||
      !(keys.private_key instanceof CryptoKey) ||
      !(keys.public_key_raw instanceof ArrayBuffer)
    ) {
      throw durableError("E_DURABLE_MIGRATION", "legacy durable key is corrupt");
    }
    const raw = new Uint8Array(keys.public_key_raw);
    const custodian = custodianFromPublicKeyBytes(raw);
    if (custodian.key_id !== keys.key_id) {
      throw durableError("E_DURABLE_MIGRATION", "legacy key identity mismatch");
    }
    key = {
      key_id: keys.key_id,
      private_key: keys.private_key,
      public_key: custodian.public_key,
      public_key_raw: keys.public_key_raw
    };
  }
  const policy = createAuthorityPolicy({ expiresAt: meta.expires_at });
  if (meta.authority_removed) {
    policy.removed_at = completedAt;
    policy.status = "removed";
  } else if (meta.expires_at <= completedAt) {
    policy.expired_at = completedAt;
    policy.status = "expired";
  }
  const base = createKeyReadyDocument({
    endpointId,
    key,
    migration: { completed_at: completedAt, from_schema: 1 },
    policy
  });
  const committed = committedDocument(base, records);
  committed.migration = { completed_at: completedAt, from_schema: 1 };
  return committed;
}

export function observedDocument(document, records, { validatedCore = null } = {}) {
  const next = committedDocument(document, records, { validatedCore });
  next.phase = "joining";
  return next;
}

export { durableError };
