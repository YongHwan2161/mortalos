import { sha256 } from "@noble/hashes/sha2.js";
import {
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  utf8Bytes
} from "./bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "./codec.mjs";
import { PROTOCOL_PROFILE } from "./generated/protocol-profile.mjs";
import { createLineage } from "./lineage.mjs";
import {
  copyBoundedOwnDataArray,
  ownDataArrayLength,
  snapshotNamedOwnDataValues
} from "./primordials.mjs";
import {
  statePackageChunkDigest,
  statePackageResourceRoot,
  verifyStatePackage
} from "./state/package.mjs";

export const CONTINUITY_CAPSULE_FORMAT = "mortalos-continuity-capsule/1";
const CAPSULE_DOMAIN = utf8Bytes("MORTALOS/CONTINUITY-CAPSULE/1\0");
const MAX_RECORDS = 256;

export class ContinuityCapsuleError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "ContinuityCapsuleError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new ContinuityCapsuleError(code, detail);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_CAPSULE_SCHEMA", `${label}-object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_CAPSULE_SCHEMA", `${label}-keys`);
  }
}

function capsuleDigest(bytes) {
  const basis = new Uint8Array(CAPSULE_DOMAIN.byteLength + bytes.byteLength);
  basis.set(CAPSULE_DOMAIN);
  basis.set(bytes, CAPSULE_DOMAIN.byteLength);
  return `sha256:${encodeBase64Url(sha256(basis))}`;
}

function decodeArtifact(value, label, maximum = PROTOCOL_PROFILE.provider.object_bytes) {
  if (typeof value !== "string") fail("E_CAPSULE_SCHEMA", `${label}-base64url`);
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.byteLength > maximum) fail("E_CAPSULE_LIMIT", label);
  return bytes;
}

function verifyRecords(records) {
  if (!Array.isArray(records) || records.length < 2 || records.length > MAX_RECORDS) {
    fail("E_CAPSULE_LIMIT", "records");
  }
  const opened = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    exactKeys(record, ["envelope_base64url", "event_payload_base64url"], `record-${index}`);
    const envelopeBytes = decodeArtifact(record.envelope_base64url, `record-${index}-envelope`);
    const payloadBytes = decodeArtifact(record.event_payload_base64url, `record-${index}-payload`);
    let envelope;
    let payload;
    try {
      envelope = parseJsonBytes(envelopeBytes, { maxBytes: 1_048_576, maxDepth: 64 });
      payload = parseJsonBytes(payloadBytes, { maxBytes: 1_048_576, maxDepth: 64 });
    } catch {
      fail("E_CAPSULE_SCHEMA", `record-${index}-json`);
    }
    if (!isCanonical(envelopeBytes, envelope) || !isCanonical(payloadBytes, payload)) {
      fail("E_CAPSULE_SCHEMA", `record-${index}-canonical`);
    }
    opened.push({ envelope, envelopeBytes, payload, payloadBytes });
  }
  let lineage;
  try {
    lineage = createLineage(opened[0].envelopeBytes).lineage;
    for (let index = 1; index < opened.length; index += 1) {
      const outcome = lineage.append({
        envelopeBytes: opened[index].envelopeBytes,
        eventPayloadBytes: opened[index].payloadBytes
      });
      if (outcome.status !== "accept") fail("E_CAPSULE_LINEAGE", outcome.code);
    }
  } catch (error) {
    if (error instanceof ContinuityCapsuleError) throw error;
    fail("E_CAPSULE_LINEAGE", error?.code ?? "invalid");
  }
  return { lineage, opened };
}

export function verifyContinuityCapsule(capsuleBytes) {
  let bytes;
  let capsule;
  try {
    bytes = new Uint8Array(capsuleBytes);
    if (bytes.byteLength > PROTOCOL_PROFILE.provider.object_bytes) fail("E_CAPSULE_LIMIT", "bytes");
    capsule = parseJsonBytes(bytes, {
      maxBytes: PROTOCOL_PROFILE.provider.object_bytes,
      maxDepth: 64
    });
  } catch (error) {
    if (error instanceof ContinuityCapsuleError) throw error;
    fail("E_CAPSULE_SCHEMA", "json");
  }
  if (!isCanonical(bytes, capsule)) fail("E_CAPSULE_SCHEMA", "canonical");
  exactKeys(
    capsule,
    ["format", "organism_id", "profile", "records", "state"],
    "capsule"
  );
  if (
    capsule.format !== CONTINUITY_CAPSULE_FORMAT ||
    capsule.profile !== PROTOCOL_PROFILE.format
  ) {
    fail("E_CAPSULE_SCHEMA", "format");
  }
  const { lineage, opened } = verifyRecords(capsule.records);
  const latest = opened.at(-1).envelope;
  let stateTransitionIndex = -1;
  for (let index = opened.length - 1; index >= 1; index -= 1) {
    if (opened[index].envelope.body.event.kind === "state-transition") {
      stateTransitionIndex = index;
      break;
    }
  }
  if (
    latest.kind !== "mortalos.pulse" ||
    stateTransitionIndex < 1 ||
    capsule.organism_id !== latest.body.organism_id
  ) {
    fail("E_CAPSULE_LINEAGE", "state-transition-required");
  }
  const stateTransition = opened[stateTransitionIndex].envelope;
  const previous = opened[stateTransitionIndex - 1].envelope;
  exactKeys(
    capsule.state,
    ["chunks", "input_base64url", "manifest_base64url", "receipt_base64url"],
    "state"
  );
  const inputBytes = decodeArtifact(capsule.state.input_base64url, "state-input");
  const manifestBytes = decodeArtifact(capsule.state.manifest_base64url, "state-manifest");
  const receiptBytes = decodeArtifact(capsule.state.receipt_base64url, "state-receipt");
  const priorStateRoot = previous.kind === "mortalos.genesis"
    ? previous.body.initial_state_root
    : previous.body.state_root;
  let verified;
  try {
    verified = verifyStatePackage({
      expectedGenomeHash: stateTransition.body.genome_hash,
      expectedNextStateRoot: stateTransition.body.state_root,
      expectedPriorStateRoot: priorStateRoot,
      inputBytes,
      manifestBytes,
      receiptBytes
    });
  } catch (error) {
    fail("E_CAPSULE_STATE", error?.code ?? "invalid");
  }
  if (
    latest.body.state_root !== verified.nextStateRoot ||
    !Array.isArray(capsule.state.chunks) ||
    capsule.state.chunks.length !== verified.manifest.chunks.length
  ) {
    fail("E_CAPSULE_LIMIT", "chunks");
  }
  const resourceBytes = new Uint8Array(verified.manifest.resource_size);
  let offset = 0;
  for (let index = 0; index < verified.manifest.chunks.length; index += 1) {
    const entry = capsule.state.chunks[index];
    const descriptor = verified.manifest.chunks[index];
    exactKeys(entry, ["bytes_base64url", "digest"], `chunk-${index}`);
    const chunk = decodeArtifact(
      entry.bytes_base64url,
      `chunk-${index}`,
      PROTOCOL_PROFILE.state.chunk_bytes
    );
    if (
      entry.digest !== descriptor.digest ||
      chunk.byteLength !== descriptor.size ||
      statePackageChunkDigest(chunk) !== descriptor.digest
    ) {
      fail("E_CAPSULE_CHUNK", String(index));
    }
    resourceBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (
    offset !== verified.manifest.resource_size ||
    statePackageResourceRoot(resourceBytes) !== verified.manifest.resource_root
  ) {
    fail("E_CAPSULE_RESOURCE", "root");
  }
  return Object.freeze({
    capsule_id: capsuleDigest(bytes),
    head_hash: lineage.snapshot().head_hash,
    organism_id: capsule.organism_id,
    resource_bytes: resourceBytes,
    state_root: verified.nextStateRoot,
    status: "verified"
  });
}

export function createContinuityCapsule({ records, statePackage }) {
  const recordCount = ownDataArrayLength(records, "capsule records");
  const ownedRecords = copyBoundedOwnDataArray(records, recordCount, "capsule records");
  const encodedRecords = ownedRecords.map((record, index) => {
    const [envelope, payload] = snapshotNamedOwnDataValues(
      record,
      ["envelope", "payload"],
      `capsule record ${index}`
    );
    return {
      envelope_base64url: encodeBase64Url(canonicalBytes(envelope)),
      event_payload_base64url: encodeBase64Url(canonicalBytes(payload))
    };
  });
  const [chunkBytes, inputBytes, manifestBytes, receiptBytes] = snapshotNamedOwnDataValues(
    statePackage,
    ["chunkBytes", "inputBytes", "manifestBytes", "receiptBytes"],
    "capsule state package"
  );
  const chunkCount = ownDataArrayLength(chunkBytes, "capsule chunks");
  const ownedChunks = copyBoundedOwnDataArray(chunkBytes, chunkCount, "capsule chunks");
  const latest = ownedRecords.at(-1)?.envelope;
  const capsule = {
    format: CONTINUITY_CAPSULE_FORMAT,
    organism_id: latest?.body?.organism_id ?? null,
    profile: PROTOCOL_PROFILE.format,
    records: encodedRecords,
    state: {
      chunks: ownedChunks.map((chunk) => {
        const owned = new Uint8Array(chunk);
        return {
          bytes_base64url: encodeBase64Url(owned),
          digest: statePackageChunkDigest(owned)
        };
      }),
      input_base64url: encodeBase64Url(new Uint8Array(inputBytes)),
      manifest_base64url: encodeBase64Url(new Uint8Array(manifestBytes)),
      receipt_base64url: encodeBase64Url(new Uint8Array(receiptBytes))
    }
  };
  const bytes = canonicalBytes(capsule);
  const verified = verifyContinuityCapsule(bytes);
  return Object.freeze({ bytes, capsule: Object.freeze(capsule), ...verified });
}
