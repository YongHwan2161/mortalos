import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  decodeBase64Url,
  encodeBase64Url,
  isCanonical,
  parseJsonDocument,
  parseJsonBytes
} from "../src/index.mjs";
import { r1ReplayLineage } from "./r1-client.mjs";

const FORMAT = "mortalos-lab-evidence/0-experimental";
export const LAB_EVIDENCE_MAX_BYTES = 2 * 1024 * 1024;

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function recordFromPublic(record) {
  if (record.kind === "genesis") {
    return {
      kind: "genesis",
      envelope_base64url: encodeBase64Url(canonicalBytes(record.envelope))
    };
  }
  if (record.kind === "pulse") {
    return {
      kind: "pulse",
      envelope_base64url: encodeBase64Url(canonicalBytes(record.envelope)),
      event_payload_base64url: encodeBase64Url(canonicalBytes(record.payload))
    };
  }
  throw new TypeError("unsupported evidence record");
}

function manifest(bundle) {
  return { format: bundle.format, protocol: bundle.protocol, records: bundle.records };
}

export function evidenceDigest(value) {
  return `sha256:${encodeBase64Url(sha256(canonicalBytes(manifest(value))))}`;
}

export function createEvidenceBundle(publicRecords) {
  const bundle = {
    format: FORMAT,
    protocol: "mortalos/0",
    records: publicRecords.map(recordFromPublic)
  };
  return { ...bundle, digest: evidenceDigest(bundle) };
}

function decodeCanonicalArtifact(encoded, label) {
  const bytes = decodeBase64Url(encoded);
  if (!bytes) throw new TypeError(`invalid ${label} byte encoding`);
  let value;
  try {
    value = parseJsonBytes(bytes);
  } catch {
    throw new TypeError(`invalid ${label} JSON bytes`);
  }
  if (!isCanonical(bytes, value)) throw new TypeError(`${label} bytes are not canonical`);
  return value;
}

export function replayEvidenceBundle(bundle) {
  if (!exactKeys(bundle, ["digest", "format", "protocol", "records"])) {
    throw new TypeError("evidence bundle fields are not allowlisted");
  }
  if (bundle.format !== FORMAT || bundle.protocol !== "mortalos/0") {
    throw new TypeError("unsupported evidence bundle format");
  }
  if (!Array.isArray(bundle.records) || bundle.records.length < 1) {
    throw new TypeError("evidence bundle requires records");
  }
  if (bundle.digest !== evidenceDigest(bundle)) throw new TypeError("evidence digest mismatch");

  const first = bundle.records[0];
  if (!exactKeys(first, ["kind", "envelope_base64url"]) || first.kind !== "genesis") {
    throw new TypeError("first evidence record must be Genesis");
  }
  const genesis = decodeCanonicalArtifact(first.envelope_base64url, "Genesis");
  const history = [];
  let stateBytes = genesis.body.protocol_version === "mortalos/1"
    ? decodeBase64Url(genesis.body.initial_state_base64url)
    : null;

  for (const record of bundle.records.slice(1)) {
    if (
      !exactKeys(record, ["kind", "envelope_base64url", "event_payload_base64url"]) ||
      record.kind !== "pulse"
    ) {
      throw new TypeError("invalid Pulse evidence record");
    }
    const envelope = decodeCanonicalArtifact(record.envelope_base64url, "Pulse envelope");
    const payload = decodeCanonicalArtifact(record.event_payload_base64url, "Pulse payload");
    history.push({ envelope, payload });
    if (envelope.body.event.kind === "state-transition") {
      stateBytes = decodeBase64Url(payload.next_state_base64url);
    }
  }
  const replayed = r1ReplayLineage(genesis, history).outcome;
  if (replayed.status === "genesis_rejected") return replayed.genesis;
  if (replayed.status === "terminated") return replayed.terminal;
  const snapshot = replayed.snapshot;
  return {
    status: "accept",
    organism_id: snapshot.organism_id,
    head_hash: snapshot.head_hash,
    sequence: replayed.steps.at(-1)?.sequence ?? "0",
    state: stateBytes ? parseJsonBytes(stateBytes) : null,
    state_base64url: stateBytes ? encodeBase64Url(stateBytes) : null,
    state_root: replayed.steps.at(-1)?.next_state_root ?? genesis.body.initial_state_root,
    accepted_objects: snapshot.accepted_objects,
    digest: bundle.digest
  };
}

export function publicRecordsFromEvidenceBundle(bundle) {
  const replay = replayEvidenceBundle(bundle);
  if (replay.status !== "accept") {
    throw new TypeError(`evidence replay rejected: ${replay.code ?? replay.status}`);
  }
  return bundle.records.map((record) => {
    if (record.kind === "genesis") {
      return { kind: "genesis", envelope: decodeCanonicalArtifact(record.envelope_base64url, "Genesis") };
    }
    return {
      kind: "pulse",
      envelope: decodeCanonicalArtifact(record.envelope_base64url, "Pulse envelope"),
      payload: decodeCanonicalArtifact(record.event_payload_base64url, "Pulse payload")
    };
  });
}

export function importEvidenceBundleBytes(source) {
  let bytes;
  try {
    bytes = source instanceof Uint8Array ? new Uint8Array(source) : new Uint8Array(source);
  } catch {
    throw new TypeError("evidence import requires bytes");
  }
  if (bytes.byteLength > LAB_EVIDENCE_MAX_BYTES) {
    throw new TypeError("evidence import exceeds the 2 MiB limit");
  }
  let document;
  try {
    document = parseJsonDocument(bytes, { maxBytes: LAB_EVIDENCE_MAX_BYTES, maxDepth: 64 });
  } catch {
    throw new TypeError("evidence import is not strict JSON");
  }
  if (!isCanonical(document.bytes, document.value)) {
    throw new TypeError("evidence import is not canonical JSON");
  }
  const replay = replayEvidenceBundle(document.value);
  if (replay.status !== "accept") {
    throw new TypeError(`evidence replay rejected: ${replay.code ?? replay.status}`);
  }
  return { bundle: document.value, replay };
}

export const LAB_EVIDENCE_FORMAT = FORMAT;
