import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { equalBytes } from "../../src/bytes.mjs";
import {
  arrayJoin,
  arraySort,
  arrayValueAt,
  copyOwnDataArray,
  createUint8Array,
  freeze,
  objectHasOwn,
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
  evaluateConfidentialStoragePlacements,
  restoreConfidentialPlacementJournal
} from "../../src/placement/confidential.mjs";

const POINTER_FORMAT = "mortalos-confidential-placement-pointer/1";
const JOURNAL_ID = /^sha256:[A-Za-z0-9_-]{43}$/u;
const COMMIT_KEYS = Object.freeze([
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

function commitOptionDescriptors(options) {
  if (!realmIntrinsicsIntact()) throw new TypeError("intact realm required");
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(options, "confidential placement commit options");
  } catch {
    throw new TypeError("exact raw placement commit options required");
  }
  if (!realmIntrinsicsIntact()) throw new TypeError("intact realm required");
  const keys = ownKeys(descriptors);
  if (keys.length !== COMMIT_KEYS.length) {
    throw new TypeError("exact raw placement commit options required");
  }
  for (let index = 0; index < COMMIT_KEYS.length; index += 1) {
    if (!objectHasOwn(descriptors, COMMIT_KEYS[index])) {
      throw new TypeError("exact raw placement commit options required");
    }
  }
  return descriptors;
}

function commitOption(descriptors, property) {
  return ownDataRecordEntry(descriptors, property).value;
}

function requireIntactRealm() {
  if (!realmIntrinsicsIntact()) throw new TypeError("intact realm required");
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
  } catch {
    // Windows may reject directory fsync. Each immutable file is still fsynced.
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function pointerName(generation, journalId) {
  const paddedGeneration = generation.length < 20
    ? `${stringSlice("00000000000000000000", generation.length)}${generation}`
    : generation;
  return `pointer-${paddedGeneration}-${stringSlice(journalId, 7)}.json`;
}

function parsePointer(root, pointerFile) {
  requireIntactRealm();
  if (
    typeof pointerFile !== "string" ||
    !regexpTest(/^pointer-[0-9]{20}-[A-Za-z0-9_-]{43}\.json$/u, pointerFile)
  ) return null;
  const pointerFileBytes = readFileSync(join(root, pointerFile));
  requireIntactRealm();
  const pointerBytes = createUint8Array(pointerFileBytes);
  const pointer = parseJsonBytes(pointerBytes, { maxBytes: 4096, maxDepth: 4 });
  requireIntactRealm();
  const pointerKeys = objectKeys(pointer);
  arraySort(pointerKeys);
  if (
    !isCanonical(pointerBytes, pointer) ||
    arrayJoin(pointerKeys, ",") !== "file,format,generation,journal_id" ||
    pointer.format !== POINTER_FORMAT ||
    typeof pointer.file !== "string" ||
    basename(pointer.file) !== pointer.file ||
    typeof pointer.generation !== "string" ||
    !regexpTest(/^(?:0|[1-9][0-9]*)$/u, pointer.generation) ||
    typeof pointer.journal_id !== "string" ||
    !regexpTest(JOURNAL_ID, pointer.journal_id) ||
    pointer.file !== `journal-${pointer.generation}-${stringSlice(pointer.journal_id, 7)}.json` ||
    pointerFile !== pointerName(pointer.generation, pointer.journal_id)
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  return freeze({ bytes: pointerBytes, file: pointerFile, value: pointer });
}

function compareCanonicalGenerations(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function latestPointer(root) {
  requireIntactRealm();
  const directoryEntries = readdirSync(root);
  requireIntactRealm();
  const files = copyOwnDataArray(directoryEntries, "controller directory entries");
  requireIntactRealm();
  let latest = null;
  let latestFork = false;
  for (let index = 0; index < files.length; index += 1) {
    const candidate = parsePointer(root, arrayValueAt(files, index));
    if (candidate === null) continue;
    if (latest === null) {
      latest = candidate;
      continue;
    }
    const order = compareCanonicalGenerations(
      candidate.value.generation,
      latest.value.generation
    );
    if (order > 0) {
      latest = candidate;
      latestFork = false;
    } else if (
      order === 0 &&
      candidate.value.journal_id !== latest.value.journal_id
    ) {
      latestFork = true;
    }
  }
  if (latestFork) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
  return latest;
}

export function commitConfidentialPlacementJournal(options) {
  const descriptors = commitOptionDescriptors(options);
  const directory = commitOption(descriptors, "directory");
  const evaluatedAt = commitOption(descriptors, "evaluated_at_ms");
  const generation = commitOption(descriptors, "generation");
  const manifestBytes = commitOption(descriptors, "manifest_bytes");
  const maximumAge = commitOption(descriptors, "max_proof_age_ms");
  const placements = commitOption(descriptors, "placements");
  const quorum = commitOption(descriptors, "quorum");
  const targetShards = commitOption(descriptors, "target_shards");
  const unavailableProviderIds = commitOption(descriptors, "unavailable_provider_ids");
  if (typeof directory !== "string" || directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  const evaluation = evaluateConfidentialStoragePlacements({
    evaluated_at_ms: evaluatedAt,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: maximumAge,
    placements,
    quorum,
    target_shards: targetShards,
    unavailable_provider_ids: unavailableProviderIds
  });
  const journal = createConfidentialPlacementJournal({
    evaluation,
    generation,
    manifest_bytes: manifestBytes,
    max_proof_age_ms: maximumAge,
    quorum,
    target_shards: targetShards
  });
  const restored = restoreConfidentialPlacementJournal(journal.bytes);
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  requireIntactRealm();
  const current = latestPointer(root);
  if (current !== null) {
    const generationOrder = compareCanonicalGenerations(
      current.value.generation,
      restored.generation
    );
    if (generationOrder > 0) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_GENERATION_STALE");
    }
    if (generationOrder === 0) {
      if (current.value.journal_id !== restored.journal_id) {
        throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
      }
      return freeze({
        file: current.value.file,
        journal_id: restored.journal_id,
        status: "already-committed"
      });
    }
  }
  const file = `journal-${restored.generation}-${stringSlice(restored.journal_id, 7)}.json`;
  const journalPath = join(root, file);
  if (existsSync(journalPath)) {
    const existingFileBytes = readFileSync(journalPath);
    requireIntactRealm();
    const existing = createUint8Array(existingFileBytes);
    if (!equalBytes(existing, restored.bytes)) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_JOURNAL_COLLISION");
    }
  } else {
    syncFile(journalPath, restored.bytes);
  }
  const pointerBytes = canonicalBytes({
    file,
    format: POINTER_FORMAT,
    generation: restored.generation,
    journal_id: restored.journal_id
  });
  syncFile(join(root, pointerName(restored.generation, restored.journal_id)), pointerBytes);
  syncDirectory(root);
  return freeze({ file, journal_id: restored.journal_id, status: "committed" });
}

export function loadConfidentialPlacementJournal(directory) {
  requireIntactRealm();
  if (typeof directory !== "string" || directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  const root = resolve(directory);
  requireIntactRealm();
  const latest = latestPointer(root);
  if (latest === null) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  const pointer = latest.value;
  const journalFileBytes = readFileSync(join(root, pointer.file));
  requireIntactRealm();
  const journalBytes = createUint8Array(journalFileBytes);
  const restored = restoreConfidentialPlacementJournal(journalBytes);
  requireIntactRealm();
  if (restored.journal_id !== pointer.journal_id || restored.generation !== pointer.generation) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_BINDING");
  }
  return freeze({ ...restored, journal_bytes: journalBytes });
}
