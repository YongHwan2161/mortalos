import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  createLineage,
  decodeBase64Url,
  encodeBase64Url
} from "../src/index.mjs";

const FORMAT = "mortalos-lab-evidence/0-experimental";

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
  const genesisBytes = decodeBase64Url(first.envelope_base64url);
  if (!genesisBytes) throw new TypeError("invalid Genesis byte encoding");
  const opened = createLineage(genesisBytes);
  if (opened.status !== "accept") return opened;

  for (const record of bundle.records.slice(1)) {
    if (
      !exactKeys(record, ["kind", "envelope_base64url", "event_payload_base64url"]) ||
      record.kind !== "pulse"
    ) {
      throw new TypeError("invalid Pulse evidence record");
    }
    const envelopeBytes = decodeBase64Url(record.envelope_base64url);
    const eventPayloadBytes = decodeBase64Url(record.event_payload_base64url);
    if (!envelopeBytes || !eventPayloadBytes) throw new TypeError("invalid Pulse byte encoding");
    const result = opened.lineage.append({ envelopeBytes, eventPayloadBytes });
    if (result.status !== "accept") return result;
  }
  const snapshot = opened.lineage.snapshot();
  return {
    status: "accept",
    organism_id: snapshot.organism_id,
    head_hash: snapshot.head_hash,
    accepted_objects: snapshot.accepted_objects,
    digest: bundle.digest
  };
}

export const LAB_EVIDENCE_FORMAT = FORMAT;
