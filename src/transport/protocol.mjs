import { sha256 } from "@noble/hashes/sha2.js";
import {
  decodeBase64Url,
  encodeBase64Url,
  equalBytes
} from "../bytes.mjs";
import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes
} from "../codec.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import { statePackageChunkDigest } from "../state/package.mjs";

export const RELAY_MESSAGE_FORMAT = "mortalos-relay-message/1";
export const RELAY_CONTROL_FORMAT = "mortalos-relay-control/1";
export const RELAY_FRAME_FORMAT = "mortalos-relay-frame/1";
export const RELAY_CHUNK_FRAGMENT_FORMAT = "mortalos-chunk-fragment/1";
export const RESOURCE_PLACEMENT_ARTIFACT_FORMAT =
  "mortalos-resource-placement-artifact/1";
export const RELAY_LIMITS = Object.freeze({
  ...PROTOCOL_PROFILE.transport
});

const TAGGED_DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const RESOURCE_PLACEMENT_ARTIFACT_KINDS = new Set([
  "announcement",
  "challenge",
  "execution-proposal",
  "execution-receipt",
  "failure-certificate",
  "lease",
  "lease-proposal",
  "liveness-challenge",
  "liveness-observation",
  "liveness-response",
  "offer",
  "resource-descriptors",
  "usage",
  "usage-proposal"
]);
const CHUNK_FRAGMENT_DOMAIN = new TextEncoder().encode("MORTALOS/RELAY/1/CHUNK-FRAGMENT\0");

export class RelayProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RelayProtocolError("RELAY_SCHEMA", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RelayProtocolError("RELAY_SCHEMA", `${label} has unknown or missing fields`);
  }
}

function artifact(value, label, maximum) {
  if (typeof value !== "string" || !BASE64URL.test(value)) {
    throw new RelayProtocolError("RELAY_SCHEMA", `${label} must be unpadded base64url`);
  }
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.byteLength > maximum) {
    throw new RelayProtocolError("RELAY_LIMIT", `${label} exceeds its byte ceiling`);
  }
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 64 });
  } catch {
    throw new RelayProtocolError("RELAY_PARSE", `${label} is not strict JSON`);
  }
  if (!isCanonical(bytes, parsed)) {
    throw new RelayProtocolError("RELAY_NONCANONICAL", `${label} is not canonical JSON`);
  }
  return { bytes, value: parsed };
}

export function relayMessageId(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new RelayProtocolError("RELAY_SCHEMA", "message bytes required");
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

export function relayChunkFragmentDigest(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new RelayProtocolError("RELAY_SCHEMA", "fragment bytes required");
  }
  const basis = new Uint8Array(CHUNK_FRAGMENT_DOMAIN.byteLength + bytes.byteLength);
  basis.set(CHUNK_FRAGMENT_DOMAIN);
  basis.set(bytes, CHUNK_FRAGMENT_DOMAIN.byteLength);
  return `sha256:${encodeBase64Url(sha256(basis))}`;
}

export function createRelayChunkFragmentMessages(chunkBytes) {
  if (!(chunkBytes instanceof Uint8Array) || chunkBytes.byteLength < 1 || chunkBytes.byteLength > PROTOCOL_PROFILE.state.chunk_bytes) {
    throw new RelayProtocolError("RELAY_LIMIT", "state chunk exceeds profile ceiling");
  }
  const owned = new Uint8Array(chunkBytes);
  const chunkDigest = statePackageChunkDigest(owned);
  const fragmentCount = Math.ceil(owned.byteLength / RELAY_LIMITS.data_fragment_bytes);
  const messages = [];
  for (let fragmentIndex = 0; fragmentIndex < fragmentCount; fragmentIndex += 1) {
    const fragment = owned.slice(
      fragmentIndex * RELAY_LIMITS.data_fragment_bytes,
      (fragmentIndex + 1) * RELAY_LIMITS.data_fragment_bytes
    );
    const message = {
      chunk_digest: chunkDigest,
      chunk_size: owned.byteLength,
      format: RELAY_CHUNK_FRAGMENT_FORMAT,
      fragment_count: fragmentCount,
      fragment_digest: relayChunkFragmentDigest(fragment),
      fragment_index: fragmentIndex,
      fragment_size: fragment.byteLength,
      payload_base64url: encodeBase64Url(fragment)
    };
    if (canonicalBytes(message).byteLength > RELAY_LIMITS.message_bytes) {
      throw new RelayProtocolError("RELAY_LIMIT", "chunk fragment envelope exceeds message ceiling");
    }
    messages.push(Object.freeze(message));
  }
  return Object.freeze(messages);
}

function decodeChunkFragment(message, bytes) {
  exactKeys(
    message,
    [
      "chunk_digest",
      "chunk_size",
      "format",
      "fragment_count",
      "fragment_digest",
      "fragment_index",
      "fragment_size",
      "payload_base64url"
    ],
    "relay chunk fragment"
  );
  if (
    !TAGGED_DIGEST.test(message.chunk_digest) ||
    !TAGGED_DIGEST.test(message.fragment_digest) ||
    !Number.isSafeInteger(message.chunk_size) ||
    message.chunk_size < 1 ||
    message.chunk_size > PROTOCOL_PROFILE.state.chunk_bytes ||
    !Number.isSafeInteger(message.fragment_count) ||
    message.fragment_count !== Math.ceil(message.chunk_size / RELAY_LIMITS.data_fragment_bytes) ||
    !Number.isSafeInteger(message.fragment_index) ||
    message.fragment_index < 0 ||
    message.fragment_index >= message.fragment_count ||
    !Number.isSafeInteger(message.fragment_size) ||
    message.fragment_size < 1 ||
    message.fragment_size > RELAY_LIMITS.data_fragment_bytes ||
    typeof message.payload_base64url !== "string" ||
    !BASE64URL.test(message.payload_base64url)
  ) {
    throw new RelayProtocolError("RELAY_SCHEMA", "invalid chunk fragment metadata");
  }
  const fragment = decodeBase64Url(message.payload_base64url);
  const expectedSize = message.fragment_index === message.fragment_count - 1
    ? message.chunk_size - RELAY_LIMITS.data_fragment_bytes * (message.fragment_count - 1)
    : RELAY_LIMITS.data_fragment_bytes;
  if (
    !fragment ||
    fragment.byteLength !== message.fragment_size ||
    message.fragment_size !== expectedSize ||
    relayChunkFragmentDigest(fragment) !== message.fragment_digest
  ) {
    throw new RelayProtocolError("RELAY_DIGEST", "chunk fragment digest or size mismatch");
  }
  return Object.freeze({
    bytes: new Uint8Array(bytes),
    chunk: Object.freeze({ ...message, fragment_bytes: fragment }),
    control: null,
    message,
    message_id: relayMessageId(bytes),
    record: null
  });
}

export function createRelayMessage(record) {
  if (!record || !record.envelope || !record.payload) {
    throw new RelayProtocolError("RELAY_SCHEMA", "public evidence record required");
  }
  const kind = record.envelope.kind === "mortalos.genesis"
    ? "genesis"
    : record.envelope.kind === "mortalos.pulse"
      ? "pulse"
      : null;
  if (!kind) throw new RelayProtocolError("RELAY_SCHEMA", "unsupported evidence kind");
  return {
    format: RELAY_MESSAGE_FORMAT,
    record: {
      envelope_base64url: encodeBase64Url(canonicalBytes(record.envelope)),
      event_payload_base64url: encodeBase64Url(canonicalBytes(record.payload)),
      kind
    }
  };
}

function assertControl(kind, content) {
  if (kind === "join-request") {
    exactKeys(content, ["custodian", "format", "nonce", "organism_id"], "join request");
    exactKeys(content.custodian, ["key_id", "public_key"], "join custodian");
    if (
      content.format !== "mortalos-join-request/1" ||
      typeof content.organism_id !== "string" ||
      typeof content.nonce !== "string" ||
      typeof content.custodian.key_id !== "string" ||
      typeof content.custodian.public_key !== "string"
    ) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid join request");
    }
    return;
  }
  if (kind === "handoff-proposal") {
    exactKeys(content, ["approvals", "body", "format", "payload"], "handoff proposal");
    if (
      content.format !== "mortalos-handoff-proposal/1" ||
      !content.body || typeof content.body !== "object" || Array.isArray(content.body) ||
      !content.payload || typeof content.payload !== "object" || Array.isArray(content.payload) ||
      !Array.isArray(content.approvals) || content.approvals.length < 1 || content.approvals.length > 16
    ) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid handoff proposal");
    }
    return;
  }
  if (kind === "resource-consumption-announcement") {
    exactKeys(
      content,
      ["format", "lease", "offer", "witness"],
      "resource consumption announcement"
    );
    if (
      content.format !== "mortalos-resource-consumption-announcement/1" ||
      !content.offer || typeof content.offer !== "object" || Array.isArray(content.offer) ||
      !content.lease || typeof content.lease !== "object" || Array.isArray(content.lease) ||
      !content.witness || typeof content.witness !== "object" || Array.isArray(content.witness)
    ) {
      throw new RelayProtocolError(
        "RELAY_SCHEMA",
        "invalid resource consumption announcement"
      );
    }
    return;
  }
  if (kind === "resource-placement-artifact") {
    exactKeys(
      content,
      ["artifact_kind", "format", "payload_base64url", "request_id"],
      "resource placement artifact"
    );
    if (
      content.format !== RESOURCE_PLACEMENT_ARTIFACT_FORMAT ||
      !RESOURCE_PLACEMENT_ARTIFACT_KINDS.has(content.artifact_kind) ||
      typeof content.request_id !== "string" ||
      !REQUEST_ID.test(content.request_id)
    ) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid resource placement artifact");
    }
    artifact(content.payload_base64url, "resource placement payload", RELAY_LIMITS.message_bytes);
    return;
  }
  throw new RelayProtocolError("RELAY_SCHEMA", "unsupported relay control kind");
}

export function createRelayControlMessage(kind, content) {
  assertControl(kind, content);
  return {
    content_base64url: encodeBase64Url(canonicalBytes(content)),
    format: RELAY_CONTROL_FORMAT,
    kind
  };
}

export function createResourcePlacementArtifactMessage({ artifactKind, payloadBytes, requestId }) {
  if (!(payloadBytes instanceof Uint8Array)) {
    throw new RelayProtocolError("RELAY_SCHEMA", "resource placement payload bytes required");
  }
  const payload = artifact(
    encodeBase64Url(payloadBytes),
    "resource placement payload",
    RELAY_LIMITS.message_bytes
  );
  return createRelayControlMessage("resource-placement-artifact", {
    artifact_kind: artifactKind,
    format: RESOURCE_PLACEMENT_ARTIFACT_FORMAT,
    payload_base64url: encodeBase64Url(payload.bytes),
    request_id: requestId
  });
}

export function openResourcePlacementArtifact(control) {
  if (!control || control.kind !== "resource-placement-artifact") {
    throw new RelayProtocolError("RELAY_SCHEMA", "resource placement control required");
  }
  assertControl(control.kind, control.content);
  const opened = artifact(
    control.content.payload_base64url,
    "resource placement payload",
    RELAY_LIMITS.message_bytes
  );
  return Object.freeze({
    artifact_kind: control.content.artifact_kind,
    payload: opened.value,
    payload_bytes: new Uint8Array(opened.bytes),
    request_id: control.content.request_id
  });
}

export function decodeRelayMessageBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > RELAY_LIMITS.message_bytes) {
    throw new RelayProtocolError("RELAY_LIMIT", "relay message exceeds byte ceiling");
  }
  let message;
  try {
    message = parseJsonBytes(bytes, { maxBytes: RELAY_LIMITS.message_bytes, maxDepth: 64 });
  } catch {
    throw new RelayProtocolError("RELAY_PARSE", "relay message is not strict JSON");
  }
  if (!isCanonical(bytes, message)) {
    throw new RelayProtocolError("RELAY_NONCANONICAL", "relay message is not canonical JSON");
  }
  if (message.format === RELAY_CHUNK_FRAGMENT_FORMAT) {
    return decodeChunkFragment(message, bytes);
  }
  if (message.format === RELAY_CONTROL_FORMAT) {
    exactKeys(message, ["content_base64url", "format", "kind"], "relay control message");
    const content = artifact(message.content_base64url, "control content", RELAY_LIMITS.message_bytes);
    assertControl(message.kind, content.value);
    return Object.freeze({
      bytes: new Uint8Array(bytes),
      control: { content: content.value, kind: message.kind },
      message,
      message_id: relayMessageId(bytes),
      record: null
    });
  }
  exactKeys(message, ["format", "record"], "relay message");
  if (message.format !== RELAY_MESSAGE_FORMAT) {
    throw new RelayProtocolError("RELAY_VERSION", "unsupported relay message format");
  }
  exactKeys(
    message.record,
    ["envelope_base64url", "event_payload_base64url", "kind"],
    "relay record"
  );
  if (message.record.kind !== "genesis" && message.record.kind !== "pulse") {
    throw new RelayProtocolError("RELAY_SCHEMA", "unsupported relay record kind");
  }
  const envelope = artifact(message.record.envelope_base64url, "envelope", RELAY_LIMITS.message_bytes);
  const payload = artifact(message.record.event_payload_base64url, "event payload", RELAY_LIMITS.message_bytes);
  const expectedEnvelopeKind = message.record.kind === "genesis" ? "mortalos.genesis" : "mortalos.pulse";
  if (envelope.value?.kind !== expectedEnvelopeKind) {
    throw new RelayProtocolError("RELAY_SCHEMA", "record kind does not match envelope kind");
  }
  return Object.freeze({
    bytes: new Uint8Array(bytes),
    control: null,
    message,
    message_id: relayMessageId(bytes),
    record: { envelope: envelope.value, payload: payload.value }
  });
}

export function createRelayFrame(sequence, messageBytes) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RelayProtocolError("RELAY_SCHEMA", "positive relay sequence required");
  }
  const opened = decodeRelayMessageBytes(messageBytes);
  return {
    format: RELAY_FRAME_FORMAT,
    message_base64url: encodeBase64Url(opened.bytes),
    message_id: opened.message_id,
    sequence
  };
}

export function decodeRelayFrame(frame) {
  exactKeys(frame, ["format", "message_base64url", "message_id", "sequence"], "relay frame");
  if (
    frame.format !== RELAY_FRAME_FORMAT ||
    !Number.isSafeInteger(frame.sequence) ||
    frame.sequence < 1 ||
    typeof frame.message_id !== "string" ||
    !TAGGED_DIGEST.test(frame.message_id)
  ) {
    throw new RelayProtocolError("RELAY_SCHEMA", "invalid relay frame metadata");
  }
  if (typeof frame.message_base64url !== "string" || !BASE64URL.test(frame.message_base64url)) {
    throw new RelayProtocolError("RELAY_SCHEMA", "invalid relay frame bytes");
  }
  const bytes = decodeBase64Url(frame.message_base64url);
  if (!bytes || bytes.byteLength > RELAY_LIMITS.message_bytes) {
    throw new RelayProtocolError("RELAY_LIMIT", "relay frame message exceeds byte ceiling");
  }
  const opened = decodeRelayMessageBytes(bytes);
  if (opened.message_id !== frame.message_id) {
    throw new RelayProtocolError("RELAY_DIGEST", "relay frame digest mismatch");
  }
  if (!equalBytes(canonicalBytes(frame), canonicalBytes(createRelayFrame(frame.sequence, bytes)))) {
    throw new RelayProtocolError("RELAY_NONCANONICAL", "relay frame is not canonical");
  }
  return Object.freeze({ ...opened, sequence: frame.sequence });
}

export function assertRoomId(roomId) {
  if (typeof roomId !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(roomId)) {
    throw new RelayProtocolError("RELAY_ROOM", "room ID must encode 128 random bits");
  }
  return roomId;
}
