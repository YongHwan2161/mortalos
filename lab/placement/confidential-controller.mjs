import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { encodeBase64Url, equalBytes } from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import { PROTOCOL_PROFILE } from "../../src/generated/protocol-profile.mjs";
import {
  arrayJoin,
  arraySort,
  arrayValueAt,
  bigInt,
  bigIntToString,
  copyOwnDataArray,
  createUint8Array,
  freeze,
  objectHasOwn,
  objectCreate,
  objectKeys,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord,
  stringSlice
} from "../../src/primordials.mjs";
import {
  createConfidentialPlacementJournal,
  createConfidentialPlacementReproofContext,
  evaluateConfidentialPlacementReproof,
  restoreConfidentialPlacementJournal,
  restoreConfidentialPlacementReproofContext,
  restoreLegacyConfidentialPlacementJournal
} from "../../src/placement/confidential.mjs";

const LEGACY_POINTER_FORMAT = "mortalos-confidential-placement-pointer/1";
const TRANSITION_FORMAT = "mortalos-confidential-placement-transition/1";
const TRANSITION_DOMAIN = "MortalOS confidential placement transition v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const LEGACY_COMMIT_KEYS = freeze([
  "directory",
  "evaluated_at_ms",
  "generation",
  "manifest_bytes",
  "max_proof_age_ms",
  "placements",
  "quorum",
  "target_shards",
  "unavailable_provider_ids"
]);
const BEGIN_KEYS = freeze([
  "directory",
  "expected_prior_journal_id",
  "manifest_bytes",
  "max_proof_age_ms",
  "quorum",
  "rotate_epoch",
  "target_shards"
]);
const COMMIT_KEYS = freeze([
  "directory",
  "evaluated_at_ms",
  "placements",
  "reproof_context_id",
  "unavailable_provider_ids"
]);

function requireIntactRealm() {
  if (!realmIntrinsicsIntact()) throw new TypeError("intact realm required");
}

function exactOptions(options, keys, label) {
  requireIntactRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(options, label);
  } catch {
    throw new TypeError(`exact ${label} required`);
  }
  requireIntactRealm();
  const actual = ownKeys(descriptors);
  if (actual.length !== keys.length) throw new TypeError(`exact ${label} required`);
  const values = objectCreate(null);
  for (let index = 0; index < keys.length; index += 1) {
    const key = arrayValueAt(keys, index);
    if (!objectHasOwn(descriptors, key)) throw new TypeError(`exact ${label} required`);
    values[key] = ownDataRecordEntry(descriptors, key).value;
  }
  return values;
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

function syncDirectory(path) {
  let descriptor;
  try {
    descriptor = openSync(path, "r");
    fsyncSync(descriptor);
  } catch (error) {
    // Some platforms/filesystems reject directory fsync even though file fsync and
    // no-replace hard links are available. Never hide an unrelated I/O failure.
    const code = error?.code;
    if (code !== "EINVAL" && code !== "EISDIR" && code !== "EPERM") throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function immutableFile(path, bytes) {
  const temporaryPath = join(
    dirname(path),
    `.mortalos-pending-${encodeBase64Url(createUint8Array(randomBytes(16)))}`
  );
  let temporaryExists = false;
  try {
    syncFile(temporaryPath, bytes);
    temporaryExists = true;
    const linked = linkNoReplace(temporaryPath, path);
    const existing = createUint8Array(readFileSync(path));
    requireIntactRealm();
    if (!equalBytes(existing, bytes)) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_IMMUTABLE_COLLISION");
    }
    return linked ? "written" : "existing";
  } finally {
    if (temporaryExists) {
      try {
        unlinkSync(temporaryPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }
}

function digestTail(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    throw new Error(`E_CONFIDENTIAL_PLACEMENT_${label}`);
  }
  return stringSlice(value, 7);
}

function predecessorKey(journalId) {
  return journalId === null ? "genesis" : digestTail(journalId, "JOURNAL_ID");
}

function contextFileName(contextId) {
  return `reproof-${digestTail(contextId, "REPROOF_CONTEXT")}.json`;
}

function intentClaimName(priorJournalId) {
  return `intent-${predecessorKey(priorJournalId)}.json`;
}

function successorClaimName(priorJournalId) {
  return `successor-${predecessorKey(priorJournalId)}.json`;
}

function journalFileName(generation, journalId) {
  return `journal-v2-${generation}-${digestTail(journalId, "JOURNAL_ID")}.json`;
}

function transitionFileName(transitionId) {
  return `transition-${digestTail(transitionId, "TRANSITION")}.json`;
}

function optionalFile(path) {
  try {
    const bytes = createUint8Array(readFileSync(path));
    requireIntactRealm();
    return bytes;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
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

function legacyPointerName(generation, journalId) {
  const paddedGeneration = generation.length < 20
    ? `${stringSlice("00000000000000000000", generation.length)}${generation}`
    : generation;
  return `pointer-${paddedGeneration}-${stringSlice(journalId, 7)}.json`;
}

function parseLegacyPointer(root, pointerFile) {
  requireIntactRealm();
  if (
    typeof pointerFile !== "string" ||
    !regexpTest(/^pointer-[0-9]{20}-[A-Za-z0-9_-]{43}\.json$/u, pointerFile)
  ) return null;
  const pointerBytes = createUint8Array(readFileSync(join(root, pointerFile)));
  requireIntactRealm();
  const pointer = parseJsonBytes(pointerBytes, { maxBytes: 4096, maxDepth: 4 });
  requireIntactRealm();
  const keys = objectKeys(pointer);
  arraySort(keys);
  if (
    !isCanonical(pointerBytes, pointer) ||
    arrayJoin(keys, ",") !== "file,format,generation,journal_id" ||
    pointer.format !== LEGACY_POINTER_FORMAT ||
    typeof pointer.file !== "string" || basename(pointer.file) !== pointer.file ||
    typeof pointer.generation !== "string" ||
    !regexpTest(/^(?:0|[1-9][0-9]*)$/u, pointer.generation) ||
    typeof pointer.journal_id !== "string" || !regexpTest(DIGEST, pointer.journal_id) ||
    pointer.file !== `journal-${pointer.generation}-${stringSlice(pointer.journal_id, 7)}.json` ||
    pointerFile !== legacyPointerName(pointer.generation, pointer.journal_id)
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  return freeze({ file: pointerFile, value: pointer });
}

function compareGenerations(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function legacyHead(root) {
  requireIntactRealm();
  const entries = copyOwnDataArray(readdirSync(root), "controller directory entries");
  requireIntactRealm();
  const visibleJournalIds = objectCreate(null);
  let latest = null;
  let latestFork = false;
  for (let index = 0; index < entries.length; index += 1) {
    const candidate = parseLegacyPointer(root, arrayValueAt(entries, index));
    if (candidate === null) continue;
    visibleJournalIds[candidate.value.journal_id] = true;
    if (latest === null) {
      latest = candidate;
      continue;
    }
    const order = compareGenerations(candidate.value.generation, latest.value.generation);
    if (order > 0) {
      latest = candidate;
      latestFork = false;
    } else if (order === 0 && candidate.value.journal_id !== latest.value.journal_id) {
      latestFork = true;
    }
  }
  if (latestFork) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
  if (latest === null) return null;
  const visibleIds = ownKeys(visibleJournalIds);
  let migratedAnchorId = null;
  for (let index = 0; index < visibleIds.length; index += 1) {
    const journalId = arrayValueAt(visibleIds, index);
    if (readSuccessor(root, journalId) === null) continue;
    if (migratedAnchorId !== null && migratedAnchorId !== journalId) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_ROOT_FORK");
    }
    migratedAnchorId = journalId;
  }
  if (migratedAnchorId !== null && migratedAnchorId !== latest.value.journal_id) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_ROOT_FORK");
  }
  const journalBytes = createUint8Array(readFileSync(join(root, latest.value.file)));
  requireIntactRealm();
  const journal = restoreLegacyConfidentialPlacementJournal(journalBytes);
  if (
    journal.journal_id !== latest.value.journal_id ||
    journal.generation !== latest.value.generation
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_BINDING");
  return freeze({
    journal,
    journal_bytes: journalBytes,
    journal_id: journal.journal_id,
    generation: journal.generation,
    version: 1
  });
}

function transitionBasis(value) {
  return {
    format: value.format,
    generation: value.generation,
    journal_file: value.journal_file,
    journal_id: value.journal_id,
    prior_journal_id: value.prior_journal_id,
    reproof_context_id: value.reproof_context_id
  };
}

function parseTransition(bytes) {
  requireIntactRealm();
  const value = parseJsonBytes(bytes, { maxBytes: 16 * 1024, maxDepth: 4 });
  requireIntactRealm();
  const keys = objectKeys(value);
  arraySort(keys);
  if (
    !isCanonical(bytes, value) ||
    arrayJoin(keys, ",") !== "format,generation,journal_file,journal_id,prior_journal_id,reproof_context_id,transition_id" ||
    value.format !== TRANSITION_FORMAT ||
    typeof value.generation !== "string" ||
    !regexpTest(/^(?:0|[1-9][0-9]*)$/u, value.generation) ||
    (value.prior_journal_id !== null && !regexpTest(DIGEST, value.prior_journal_id)) ||
    !regexpTest(DIGEST, value.journal_id) ||
    !regexpTest(DIGEST, value.reproof_context_id) ||
    typeof value.journal_file !== "string" ||
    basename(value.journal_file) !== value.journal_file ||
    value.journal_file !== journalFileName(value.generation, value.journal_id) ||
    !regexpTest(DIGEST, value.transition_id) ||
    domainHash(TRANSITION_DOMAIN, canonicalBytes(transitionBasis(value))) !== value.transition_id
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_TRANSITION");
  return freeze(value);
}

function readSuccessor(root, priorJournalId) {
  const bytes = optionalFile(join(root, successorClaimName(priorJournalId)));
  if (bytes === null) return null;
  const transition = parseTransition(bytes);
  if (transition.prior_journal_id !== priorJournalId) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
  }
  const journalBytes = createUint8Array(readFileSync(join(root, transition.journal_file)));
  requireIntactRealm();
  const journal = restoreConfidentialPlacementJournal(journalBytes);
  if (
    journal.journal_id !== transition.journal_id ||
    journal.generation !== transition.generation ||
    journal.prior_journal_id !== transition.prior_journal_id ||
    journal.reproof_context_id !== transition.reproof_context_id
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_TRANSITION_BINDING");
  if (priorJournalId === null && journal.generation !== "1") {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_GENERATION_SEQUENCE");
  }
  return freeze({
    file: transition.journal_file,
    journal,
    journal_bytes: journalBytes,
    journal_id: journal.journal_id,
    generation: journal.generation,
    transition,
    version: 2
  });
}

function readHead(root) {
  const legacy = legacyHead(root);
  const genesis = readSuccessor(root, null);
  if (legacy !== null && genesis !== null) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_ROOT_FORK");
  }
  let current = legacy ?? genesis;
  if (current === null) return null;
  let transitions = genesis === null ? 0 : 1;
  while (true) {
    const successor = readSuccessor(root, current.journal_id);
    if (successor === null) return current;
    if (transitions >= PROTOCOL_PROFILE.placement_journal.head_transitions_max) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT");
    }
    if (bigInt(successor.generation) !== bigInt(current.generation) + 1n) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_GENERATION_SEQUENCE");
    }
    current = successor;
    transitions += 1;
  }
}

function readJournalById(root, journalId) {
  if (journalId === null) return null;
  const legacy = legacyHead(root);
  const genesis = readSuccessor(root, null);
  if (legacy !== null && genesis !== null) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_ROOT_FORK");
  }
  let current = legacy ?? genesis;
  let transitions = genesis === null ? 0 : 1;
  while (current !== null) {
    if (current.journal_id === journalId) return current;
    const successor = readSuccessor(root, current.journal_id);
    if (successor === null) return null;
    if (transitions >= PROTOCOL_PROFILE.placement_journal.head_transitions_max) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT");
    }
    if (bigInt(successor.generation) !== bigInt(current.generation) + 1n) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_GENERATION_SEQUENCE");
    }
    current = successor;
    transitions += 1;
  }
  return null;
}

function readIntent(root, priorJournalId) {
  const bytes = optionalFile(join(root, intentClaimName(priorJournalId)));
  if (bytes === null) return null;
  const context = restoreConfidentialPlacementReproofContext(bytes);
  if (context.prior_journal_id !== priorJournalId) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT");
  }
  return freeze({ bytes, context });
}

function contextMatchesRequest(context, head, values) {
  let requestedManifest;
  try {
    requestedManifest = createUint8Array(values.manifest_bytes);
  } catch {
    return false;
  }
  return (
    context.prior_journal_id === (head?.journal_id ?? null) &&
    context.generation === bigIntToString(bigInt(head?.generation ?? "0") + 1n) &&
    context.rotate_epoch === values.rotate_epoch &&
    equalBytes(context.manifest.bytes, requestedManifest) &&
    context.max_proof_age_ms === values.max_proof_age_ms &&
    context.quorum === values.quorum &&
    context.target_shards === values.target_shards
  );
}

export function beginConfidentialPlacementReproof(options) {
  const values = exactOptions(options, BEGIN_KEYS, "confidential placement reproof begin options");
  if (typeof values.directory !== "string" || values.directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  if (
    values.expected_prior_journal_id !== null &&
    (typeof values.expected_prior_journal_id !== "string" ||
      !regexpTest(DIGEST, values.expected_prior_journal_id))
  ) throw new TypeError("expected prior journal ID required");
  if (typeof values.rotate_epoch !== "boolean") throw new TypeError("rotate_epoch boolean required");
  const root = resolve(values.directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  requireIntactRealm();
  const head = readHead(root);
  const priorJournalId = head?.journal_id ?? null;
  if (values.expected_prior_journal_id !== priorJournalId) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
  }
  if ((head === null || head.version === 1) && values.rotate_epoch !== true) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED");
  }
  if (
    head !== null &&
    bigInt(head.generation) >= bigInt(PROTOCOL_PROFILE.placement_journal.head_transitions_max)
  ) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT");
  }
  const existingIntent = readIntent(root, priorJournalId);
  if (existingIntent !== null) {
    if (!contextMatchesRequest(existingIntent.context, head, values)) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT_FORK");
    }
    return freeze({
      reproof_context_bytes: existingIntent.bytes,
      reproof_context_id: existingIntent.context.reproof_context_id,
      status: "already-begun"
    });
  }
  const generation = bigIntToString(bigInt(head?.generation ?? "0") + 1n);
  const epochNonce = values.rotate_epoch
    ? createUint8Array(randomBytes(32))
    : null;
  const created = createConfidentialPlacementReproofContext({
    epoch_nonce: epochNonce,
    generation,
    manifest_bytes: values.manifest_bytes,
    max_proof_age_ms: values.max_proof_age_ms,
    prior_journal_bytes: head?.journal_bytes ?? null,
    quorum: values.quorum,
    rotate_epoch: values.rotate_epoch,
    target_shards: values.target_shards
  });
  const contextPath = join(root, contextFileName(created.reproof_context_id));
  immutableFile(contextPath, created.bytes);
  const claimPath = join(root, intentClaimName(priorJournalId));
  const linked = linkNoReplace(contextPath, claimPath);
  syncDirectory(root);
  const winner = readIntent(root, priorJournalId);
  if (winner === null) throw new Error("E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT");
  if (!contextMatchesRequest(winner.context, head, values)) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT_FORK");
  }
  return freeze({
    reproof_context_bytes: winner.bytes,
    reproof_context_id: winner.context.reproof_context_id,
    status: linked ? "begun" : "already-begun"
  });
}

function transitionFor(journal) {
  const basis = {
    format: TRANSITION_FORMAT,
    generation: journal.generation,
    journal_file: journalFileName(journal.generation, journal.journal_id),
    journal_id: journal.journal_id,
    prior_journal_id: journal.prior_journal_id,
    reproof_context_id: journal.reproof_context_id
  };
  return freeze({
    ...basis,
    transition_id: domainHash(TRANSITION_DOMAIN, canonicalBytes(basis))
  });
}

export function commitConfidentialPlacementJournal(options) {
  // A narrow backwards-compatible rejection keeps old callers from smuggling a
  // caller-chosen generation/history through the v2 durable boundary.
  let values;
  try {
    values = exactOptions(options, COMMIT_KEYS, "confidential placement commit options");
  } catch (error) {
    try {
      exactOptions(options, LEGACY_COMMIT_KEYS, "legacy confidential placement commit options");
    } catch {
      throw error;
    }
    throw new Error("E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED");
  }
  if (typeof values.directory !== "string" || values.directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  if (typeof values.reproof_context_id !== "string" || !regexpTest(DIGEST, values.reproof_context_id)) {
    throw new TypeError("reproof context ID required");
  }
  const root = resolve(values.directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  requireIntactRealm();
  const head = readHead(root);
  if (
    head?.version === 2 &&
    head.journal.reproof_context_id === values.reproof_context_id
  ) {
    const prior = readJournalById(root, head.journal.prior_journal_id);
    if (
      head.journal.prior_journal_id !== null &&
      prior?.journal_id !== head.journal.prior_journal_id
    ) throw new Error("E_CONFIDENTIAL_PLACEMENT_TRANSITION_BINDING");
    const evaluation = evaluateConfidentialPlacementReproof({
      evaluated_at_ms: values.evaluated_at_ms,
      placements: values.placements,
      prior_journal_bytes: prior?.journal_bytes ?? null,
      reproof_context_bytes: head.journal.context.bytes,
      unavailable_provider_ids: values.unavailable_provider_ids
    });
    const candidate = createConfidentialPlacementJournal({
      evaluation,
      prior_journal_bytes: prior?.journal_bytes ?? null,
      reproof_context_bytes: head.journal.context.bytes
    });
    if (
      candidate.journal_id !== head.journal_id ||
      !equalBytes(candidate.bytes, head.journal_bytes)
    ) throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
    return freeze({
      file: head.file,
      journal_id: head.journal_id,
      status: "already-committed"
    });
  }
  const priorJournalId = head?.journal_id ?? null;
  const intent = readIntent(root, priorJournalId);
  if (
    intent === null ||
    intent.context.reproof_context_id !== values.reproof_context_id
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
  const evaluation = evaluateConfidentialPlacementReproof({
    evaluated_at_ms: values.evaluated_at_ms,
    placements: values.placements,
    prior_journal_bytes: head?.journal_bytes ?? null,
    reproof_context_bytes: intent.bytes,
    unavailable_provider_ids: values.unavailable_provider_ids
  });
  const created = createConfidentialPlacementJournal({
    evaluation,
    prior_journal_bytes: head?.journal_bytes ?? null,
    reproof_context_bytes: intent.bytes
  });
  const journal = restoreConfidentialPlacementJournal(created.bytes);
  if (journal.prior_journal_id !== priorJournalId) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
  }
  const journalFile = journalFileName(journal.generation, journal.journal_id);
  immutableFile(join(root, journalFile), journal.bytes);
  const transition = transitionFor(journal);
  const transitionBytes = canonicalBytes(transition);
  const transitionPath = join(root, transitionFileName(transition.transition_id));
  immutableFile(transitionPath, transitionBytes);
  const claimPath = join(root, successorClaimName(priorJournalId));
  const linked = linkNoReplace(transitionPath, claimPath);
  syncDirectory(root);
  const winner = readSuccessor(root, priorJournalId);
  if (winner === null) throw new Error("E_CONFIDENTIAL_PLACEMENT_TRANSITION");
  if (winner.journal_id !== journal.journal_id) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_HEAD_STALE");
  }
  return freeze({
    file: winner.file,
    journal_id: winner.journal_id,
    status: linked ? "committed" : "already-committed"
  });
}

export function loadConfidentialPlacementJournal(directory) {
  requireIntactRealm();
  if (typeof directory !== "string" || directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  const root = resolve(directory);
  requireIntactRealm();
  if (!existsSync(root)) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  const head = readHead(root);
  if (head === null) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  if (head.version === 1) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED");
  }
  return freeze({ ...head.journal, journal_bytes: head.journal_bytes });
}
