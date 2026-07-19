import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isCanonical,
  parseJsonBytes
} from "../index.mjs";

export const RELAY_MESSAGE_FORMAT = "mortalos-relay-message/1";
export const RELAY_CONTROL_FORMAT = "mortalos-relay-control/1";
export const RELAY_FRAME_FORMAT = "mortalos-relay-frame/1";
export const RELAY_LIMITS = Object.freeze({
  frame_bytes: 96 * 1024,
  message_bytes: 64 * 1024,
  range_limit: 128,
  room_bytes: 2 * 1024 * 1024,
  room_messages: 512
});

const TAGGED_DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

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
