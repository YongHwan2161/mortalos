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
import { restoreConfidentialPlacementJournal } from "../../src/placement/confidential.mjs";

const POINTER_FORMAT = "mortalos-confidential-placement-pointer/1";
const JOURNAL_ID = /^sha256:[A-Za-z0-9_-]{43}$/u;

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
  return `pointer-${generation.padStart(20, "0")}-${journalId.slice(7)}.json`;
}

function parsePointer(root, pointerFile) {
  if (!/^pointer-[0-9]{20}-[A-Za-z0-9_-]{43}\.json$/u.test(pointerFile)) return null;
  const pointerBytes = new Uint8Array(readFileSync(join(root, pointerFile)));
  const pointer = parseJsonBytes(pointerBytes, { maxBytes: 4096, maxDepth: 4 });
  if (
    !isCanonical(pointerBytes, pointer) ||
    Object.keys(pointer).sort().join(",") !== "file,format,generation,journal_id" ||
    pointer.format !== POINTER_FORMAT ||
    basename(pointer.file) !== pointer.file ||
    !/^(?:0|[1-9][0-9]*)$/u.test(pointer.generation) ||
    !JOURNAL_ID.test(pointer.journal_id) ||
    pointer.file !== `journal-${pointer.generation}-${pointer.journal_id.slice(7)}.json` ||
    pointerFile !== pointerName(pointer.generation, pointer.journal_id)
  ) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  return Object.freeze({ bytes: pointerBytes, file: pointerFile, value: pointer });
}

function pointers(root) {
  return readdirSync(root)
    .map((file) => parsePointer(root, file))
    .filter(Boolean);
}

export function commitConfidentialPlacementJournal({ directory, journal_bytes: journalBytes }) {
  if (typeof directory !== "string" || directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  const restored = restoreConfidentialPlacementJournal(journalBytes);
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const current = pointers(root);
  if (current.length > 0) {
    const maximum = Math.max(...current.map(({ value }) => Number(value.generation)));
    const latest = current.filter(({ value }) => Number(value.generation) === maximum);
    if (new Set(latest.map(({ value }) => value.journal_id)).size !== 1) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
    }
    if (maximum > Number(restored.generation)) {
      throw new Error("E_CONFIDENTIAL_PLACEMENT_GENERATION_STALE");
    }
    if (maximum === Number(restored.generation)) {
      if (latest[0].value.journal_id !== restored.journal_id) {
        throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
      }
      return Object.freeze({
        file: latest[0].value.file,
        journal_id: restored.journal_id,
        status: "already-committed"
      });
    }
  }
  const file = `journal-${restored.generation}-${restored.journal_id.slice(7)}.json`;
  const journalPath = join(root, file);
  if (existsSync(journalPath)) {
    const existing = new Uint8Array(readFileSync(journalPath));
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
  return Object.freeze({ file, journal_id: restored.journal_id, status: "committed" });
}

export function loadConfidentialPlacementJournal(directory) {
  if (typeof directory !== "string" || directory.length < 1) {
    throw new TypeError("controller directory required");
  }
  const root = resolve(directory);
  const available = pointers(root);
  if (available.length < 1) throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER");
  const maximum = Math.max(...available.map(({ value }) => Number(value.generation)));
  const latest = available.filter(({ value }) => Number(value.generation) === maximum);
  if (new Set(latest.map(({ value }) => value.journal_id)).size !== 1) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_FORK");
  }
  const pointer = latest[0].value;
  const journalBytes = new Uint8Array(readFileSync(join(root, pointer.file)));
  const restored = restoreConfidentialPlacementJournal(journalBytes);
  if (restored.journal_id !== pointer.journal_id || restored.generation !== pointer.generation) {
    throw new Error("E_CONFIDENTIAL_PLACEMENT_POINTER_BINDING");
  }
  return Object.freeze({ ...restored, journal_bytes: journalBytes });
}
