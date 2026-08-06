import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes
} from "../../src/codec.mjs";
import {
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../../src/transport/protocol.mjs";

export const WEBRTC_SIGNAL_FORMAT = "mortalos-webrtc-signal/1";
export const WEBRTC_LIMITS = Object.freeze({
  buffered_bytes: RELAY_LIMITS.frame_bytes * 4,
  endpoint_chars: 64,
  signal_bytes: 32_768,
  sdp_chars: 24_576
});

const ENDPOINT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const SIGNAL_TYPES = new Set(["answer", "offer"]);
const OPEN_TIMEOUT_MS = 15_000;
const ICE_TIMEOUT_MS = 10_000;

export class WebRtcTransportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new WebRtcTransportError(code, message);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("WEBRTC_SIGNAL_SCHEMA", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("WEBRTC_SIGNAL_SCHEMA", `${label} has unknown or missing fields`);
  }
}

function endpointId(value, label = "endpoint ID") {
  if (typeof value !== "string" || value.length > WEBRTC_LIMITS.endpoint_chars || !ENDPOINT_ID.test(value)) {
    fail("WEBRTC_ENDPOINT", `${label} is invalid`);
  }
  return value;
}

export function encodeWebRtcSignal({ endpoint_id, sdp, type }) {
  const ownedEndpoint = endpointId(endpoint_id);
  if (!SIGNAL_TYPES.has(type)) fail("WEBRTC_SIGNAL_TYPE", "offer or answer signal required");
  if (
    typeof sdp !== "string" ||
    sdp.length < 1 ||
    sdp.length > WEBRTC_LIMITS.sdp_chars ||
    !sdp.startsWith("v=0\r\n")
  ) {
    fail("WEBRTC_SIGNAL_SDP", "bounded SDP description required");
  }
  const bytes = canonicalBytes({
    endpoint_id: ownedEndpoint,
    format: WEBRTC_SIGNAL_FORMAT,
    sdp,
    type
  });
  if (bytes.byteLength > WEBRTC_LIMITS.signal_bytes) {
    fail("WEBRTC_SIGNAL_LIMIT", "manual signal exceeds byte ceiling");
  }
  return new TextDecoder().decode(bytes);
}

export function decodeWebRtcSignal(source, expectedType = null) {
  if (typeof source !== "string") fail("WEBRTC_SIGNAL_SCHEMA", "manual signal must be text");
  const bytes = new TextEncoder().encode(source);
  if (bytes.byteLength < 1 || bytes.byteLength > WEBRTC_LIMITS.signal_bytes) {
    fail("WEBRTC_SIGNAL_LIMIT", "manual signal exceeds byte ceiling");
  }
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: WEBRTC_LIMITS.signal_bytes, maxDepth: 4 });
  } catch {
    fail("WEBRTC_SIGNAL_PARSE", "manual signal is not strict JSON");
  }
  if (!isCanonical(bytes, value)) fail("WEBRTC_SIGNAL_NONCANONICAL", "manual signal must be canonical JSON");
  exactKeys(value, ["endpoint_id", "format", "sdp", "type"], "manual signal");
  if (value.format !== WEBRTC_SIGNAL_FORMAT) fail("WEBRTC_SIGNAL_VERSION", "unsupported manual signal format");
  const canonical = encodeWebRtcSignal(value);
  if (canonical !== source) fail("WEBRTC_SIGNAL_NONCANONICAL", "manual signal changed during validation");
  if (expectedType !== null && value.type !== expectedType) {
    fail("WEBRTC_SIGNAL_TYPE", `expected ${expectedType} signal`);
  }
  return Object.freeze({
    endpoint_id: value.endpoint_id,
    format: WEBRTC_SIGNAL_FORMAT,
    sdp: value.sdp,
    type: value.type
  });
}

function peerConnectionConstructor() {
  if (typeof globalThis.RTCPeerConnection !== "function") {
    fail("WEBRTC_UNAVAILABLE", "RTCPeerConnection is unavailable in this runtime");
  }
  return globalThis.RTCPeerConnection;
}

function waitForIceGathering(connection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new WebRtcTransportError("WEBRTC_ICE_TIMEOUT", "ICE gathering timed out"));
    }, ICE_TIMEOUT_MS);
    const changed = () => {
      if (connection.iceGatheringState !== "complete") return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", changed);
    };
    connection.addEventListener("icegatheringstatechange", changed);
  });
}

function localSignal(connection, endpoint, type) {
  const description = connection.localDescription;
  if (!description || description.type !== type || typeof description.sdp !== "string") {
    fail("WEBRTC_LOCAL_DESCRIPTION", `local ${type} description is unavailable`);
  }
  return encodeWebRtcSignal({ endpoint_id: endpoint, sdp: description.sdp, type });
}

function binaryBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  fail("WEBRTC_FRAME_TYPE", "DataChannel accepts binary canonical frames only");
}

export class ManualWebRtcParticipantTransport {
  #channel = null;
  #closed = false;
  #connection;
  #endpointId;
  #error = null;
  #frames = [];
  #handlers = new Set();
  #messageFrames = new Map();
  #openPromise;
  #openReject;
  #openResolve;
  #remoteEndpointId = null;

  constructor(endpoint, connection) {
    this.#endpointId = endpointId(endpoint);
    this.#connection = connection;
    this.#openPromise = new Promise((resolve, reject) => {
      this.#openResolve = resolve;
      this.#openReject = reject;
    });
    void this.#openPromise.catch(() => {});
    connection.addEventListener("connectionstatechange", () => {
      if (["failed", "closed"].includes(connection.connectionState)) {
        this.#markClosed(new WebRtcTransportError("WEBRTC_CONNECTION_CLOSED", connection.connectionState));
      }
    });
  }

  static async createOffer({ endpointId: endpoint }) {
    const PeerConnection = peerConnectionConstructor();
    const connection = new PeerConnection({ iceServers: [] });
    const transport = new ManualWebRtcParticipantTransport(endpoint, connection);
    const channel = connection.createDataChannel("mortalos-participant-v1", {
      negotiated: false,
      ordered: true
    });
    transport.#attachChannel(channel);
    await connection.setLocalDescription(await connection.createOffer());
    await waitForIceGathering(connection);
    return Object.freeze({ signal: localSignal(connection, transport.#endpointId, "offer"), transport });
  }

  static async acceptOffer({ endpointId: endpoint, offer }) {
    const opened = decodeWebRtcSignal(offer, "offer");
    const ownedEndpoint = endpointId(endpoint);
    if (opened.endpoint_id === ownedEndpoint) fail("WEBRTC_ENDPOINT", "remote endpoint must be distinct");
    const PeerConnection = peerConnectionConstructor();
    const connection = new PeerConnection({ iceServers: [] });
    const transport = new ManualWebRtcParticipantTransport(ownedEndpoint, connection);
    transport.#remoteEndpointId = opened.endpoint_id;
    connection.addEventListener("datachannel", (event) => transport.#attachChannel(event.channel), { once: true });
    await connection.setRemoteDescription({ sdp: opened.sdp, type: "offer" });
    await connection.setLocalDescription(await connection.createAnswer());
    await waitForIceGathering(connection);
    return Object.freeze({ signal: localSignal(connection, transport.#endpointId, "answer"), transport });
  }

  get endpointId() {
    return this.#endpointId;
  }

  get remoteEndpointId() {
    return this.#remoteEndpointId;
  }

  get state() {
    if (this.#error) return "failed";
    if (this.#closed) return "closed";
    return this.#channel?.readyState ?? "connecting";
  }

  async complete(answer) {
    if (this.#connection.remoteDescription) fail("WEBRTC_SIGNAL_STATE", "remote description already set");
    const opened = decodeWebRtcSignal(answer, "answer");
    if (opened.endpoint_id === this.#endpointId) fail("WEBRTC_ENDPOINT", "remote endpoint must be distinct");
    this.#remoteEndpointId = opened.endpoint_id;
    await this.#connection.setRemoteDescription({ sdp: opened.sdp, type: "answer" });
  }

  async ready({ timeoutMs = OPEN_TIMEOUT_MS } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      fail("WEBRTC_TIMEOUT", "ready timeout is invalid");
    }
    if (this.#channel?.readyState === "open") return this;
    let timer;
    try {
      await Promise.race([
        this.#openPromise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new WebRtcTransportError("WEBRTC_OPEN_TIMEOUT", "DataChannel open timed out")),
            timeoutMs
          );
        })
      ]);
      return this;
    } finally {
      clearTimeout(timer);
    }
  }

  async publish(messageSource) {
    if (this.#closed || this.#channel?.readyState !== "open") {
      fail("WEBRTC_NOT_OPEN", "DataChannel is not open");
    }
    const messageBytes = binaryBytes(messageSource);
    const opened = decodeRelayMessageBytes(messageBytes);
    const duplicate = this.#messageFrames.get(opened.message_id);
    if (duplicate) return Object.freeze({ duplicate: true, frame: duplicate });
    if (this.#channel.bufferedAmount + messageBytes.byteLength > WEBRTC_LIMITS.buffered_bytes) {
      fail("WEBRTC_BACKPRESSURE", "DataChannel buffered byte ceiling exceeded");
    }
    const owned = new Uint8Array(messageBytes);
    const frame = createRelayFrame(this.#frames.length + 1, owned);
    this.#messageFrames.set(opened.message_id, frame);
    this.#channel.send(owned);
    return Object.freeze({ duplicate: false, frame });
  }

  async fetchRange(after = 0, limit = RELAY_LIMITS.range_limit) {
    if (!Number.isSafeInteger(after) || after < 0) fail("WEBRTC_RANGE", "range cursor is invalid");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > RELAY_LIMITS.range_limit) {
      fail("WEBRTC_RANGE", "range limit is invalid");
    }
    return this.#frames.filter((frame) => frame.sequence > after).slice(0, limit);
  }

  subscribe(handler, { startAfter = 0 } = {}) {
    if (typeof handler !== "function") fail("WEBRTC_SUBSCRIBER", "subscriber function required");
    if (!Number.isSafeInteger(startAfter) || startAfter < 0) fail("WEBRTC_RANGE", "start cursor is invalid");
    const subscription = Object.freeze({ handler, startAfter });
    this.#handlers.add(subscription);
    for (const frame of this.#frames) if (frame.sequence > startAfter) this.#deliver(subscription, frame);
    return () => this.#handlers.delete(subscription);
  }

  async touchPresence() {
    return Object.freeze({ endpoint_id: this.#endpointId, transport: "webrtc-direct" });
  }

  async presence() {
    const endpoints = [this.#endpointId];
    if (this.#remoteEndpointId && this.#channel?.readyState === "open") endpoints.push(this.#remoteEndpointId);
    return endpoints.sort();
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#channel?.close();
    this.#connection.close();
    this.#openReject?.(new WebRtcTransportError("WEBRTC_CONNECTION_CLOSED", "transport closed"));
  }

  #attachChannel(channel) {
    if (this.#channel) {
      channel.close();
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_DUPLICATE", "duplicate DataChannel rejected"));
      return;
    }
    if (channel.label !== "mortalos-participant-v1" || channel.ordered !== true) {
      channel.close();
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_CONTRACT", "unexpected DataChannel contract"));
      return;
    }
    this.#channel = channel;
    channel.binaryType = "arraybuffer";
    channel.addEventListener("open", () => this.#openResolve?.(this));
    channel.addEventListener("close", () => {
      this.#closed = true;
    });
    channel.addEventListener("error", () => {
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_ERROR", "DataChannel failed"));
    });
    channel.addEventListener("message", (event) => {
      try {
        const messageBytes = binaryBytes(event.data);
        const opened = decodeRelayMessageBytes(messageBytes);
        if (this.#messageFrames.has(opened.message_id)) return;
        const frame = createRelayFrame(this.#frames.length + 1, new Uint8Array(messageBytes));
        this.#frames.push(frame);
        this.#messageFrames.set(opened.message_id, frame);
        for (const subscription of this.#handlers) {
          if (frame.sequence > subscription.startAfter) this.#deliver(subscription, frame);
        }
      } catch (error) {
        this.#markClosed(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #deliver(subscription, frame) {
    queueMicrotask(() => {
      Promise.resolve(subscription.handler(frame)).catch((error) => this.#markClosed(error));
    });
  }

  #markClosed(error) {
    if (!this.#error) this.#error = error;
    this.#closed = true;
    this.#channel?.close();
    if (this.#connection.connectionState !== "closed") this.#connection.close();
    this.#openReject?.(error);
  }
}
