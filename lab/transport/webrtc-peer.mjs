import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import {
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../../src/transport/protocol.mjs";
import {
  arrayPush,
  arraySlice,
  arraySort,
  createMap,
  createSet,
  createTextDecoder,
  createTextEncoder,
  isArray,
  mapGet,
  mapHas,
  mapSet,
  mapSize,
  mapValues,
  numberIsSafeInteger,
  objectKeys,
  regexpTest,
  setAdd,
  setHas,
  setValues,
  snapshotDataMethod,
  stringStartsWith,
  textDecoderDecode,
  textEncoderEncode
} from "../../src/primordials.mjs";

export const WEBRTC_SIGNAL_FORMAT = "mortalos-webrtc-signal/1";
export const WEBRTC_LIMITS = Object.freeze({
  buffered_bytes: RELAY_LIMITS.frame_bytes * 4,
  endpoint_chars: 64,
  signal_bytes: 32_768,
  sdp_chars: 24_576
});

const ENDPOINT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const OPEN_TIMEOUT_MS = 15_000;
const ICE_TIMEOUT_MS = 10_000;
const PromiseIntrinsic = Promise;
const clearTimeoutIntrinsic = globalThis.clearTimeout;
const queueMicrotaskIntrinsic = globalThis.queueMicrotask;
const setTimeoutIntrinsic = globalThis.setTimeout;
const promiseResolveIntrinsic = Promise.resolve;
const promiseThenIntrinsic = Promise.prototype.then;
const setDeleteIntrinsic = Set.prototype.delete;
const setClearIntrinsic = Set.prototype.clear;
const eventTargetPrototype = globalThis.EventTarget?.prototype ?? null;
const eventTargetAddIntrinsic = eventTargetPrototype?.addEventListener ?? null;
const eventTargetRemoveIntrinsic = eventTargetPrototype?.removeEventListener ?? null;
const rtcPeerConnectionIntrinsic = globalThis.RTCPeerConnection ?? null;
const rtcPeerConnectionPrototype = rtcPeerConnectionIntrinsic?.prototype ?? null;
const rtcPeerConnectionCloseIntrinsic = rtcPeerConnectionPrototype?.close ?? null;
const rtcPeerConnectionCreateAnswerIntrinsic = rtcPeerConnectionPrototype?.createAnswer ?? null;
const rtcPeerConnectionCreateDataChannelIntrinsic = rtcPeerConnectionPrototype?.createDataChannel ?? null;
const rtcPeerConnectionCreateOfferIntrinsic = rtcPeerConnectionPrototype?.createOffer ?? null;
const rtcPeerConnectionSetLocalDescriptionIntrinsic =
  rtcPeerConnectionPrototype?.setLocalDescription ?? null;
const rtcPeerConnectionSetRemoteDescriptionIntrinsic =
  rtcPeerConnectionPrototype?.setRemoteDescription ?? null;
const rtcPeerConnectionConnectionStateGetter = rtcPeerConnectionPrototype
  ? Object.getOwnPropertyDescriptor(rtcPeerConnectionPrototype, "connectionState")?.get ?? null
  : null;
const rtcPeerConnectionIceGatheringStateGetter = rtcPeerConnectionPrototype
  ? Object.getOwnPropertyDescriptor(rtcPeerConnectionPrototype, "iceGatheringState")?.get ?? null
  : null;
const rtcPeerConnectionLocalDescriptionGetter = rtcPeerConnectionPrototype
  ? Object.getOwnPropertyDescriptor(rtcPeerConnectionPrototype, "localDescription")?.get ?? null
  : null;
const rtcPeerConnectionRemoteDescriptionGetter = rtcPeerConnectionPrototype
  ? Object.getOwnPropertyDescriptor(rtcPeerConnectionPrototype, "remoteDescription")?.get ?? null
  : null;
const rtcDataChannelPrototype = globalThis.RTCDataChannel?.prototype ?? null;
const rtcDataChannelSendIntrinsic = rtcDataChannelPrototype?.send ?? null;
const rtcDataChannelCloseIntrinsic = rtcDataChannelPrototype?.close ?? null;
const rtcDataChannelBufferedAmountGetter = rtcDataChannelPrototype
  ? Object.getOwnPropertyDescriptor(rtcDataChannelPrototype, "bufferedAmount")?.get ?? null
  : null;
const rtcDataChannelLabelGetter = rtcDataChannelPrototype
  ? Object.getOwnPropertyDescriptor(rtcDataChannelPrototype, "label")?.get ?? null
  : null;
const rtcDataChannelOrderedGetter = rtcDataChannelPrototype
  ? Object.getOwnPropertyDescriptor(rtcDataChannelPrototype, "ordered")?.get ?? null
  : null;
const rtcDataChannelReadyStateGetter = rtcDataChannelPrototype
  ? Object.getOwnPropertyDescriptor(rtcDataChannelPrototype, "readyState")?.get ?? null
  : null;
const rtcDataChannelBinaryTypeSetter = rtcDataChannelPrototype
  ? Object.getOwnPropertyDescriptor(rtcDataChannelPrototype, "binaryType")?.set ?? null
  : null;
const messageEventDataGetter = globalThis.MessageEvent?.prototype
  ? Object.getOwnPropertyDescriptor(globalThis.MessageEvent.prototype, "data")?.get ?? null
  : null;
const rtcDataChannelEventChannelGetter = globalThis.RTCDataChannelEvent?.prototype
  ? Object.getOwnPropertyDescriptor(globalThis.RTCDataChannelEvent.prototype, "channel")?.get ?? null
  : null;
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength"
).get;
const arrayBufferIsView = ArrayBuffer.isView;
const dataViewByteLength = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  "byteLength"
).get;
const dataViewByteOffset = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  "byteOffset"
).get;
const dataViewBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer").get;
const freeze = Object.freeze;
const reflectApply = Reflect.apply;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength"
).get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset"
).get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;
const typedArraySet = typedArrayPrototype.set;
const Uint8ArrayIntrinsic = Uint8Array;

function resolvePromise(value) {
  return reflectApply(promiseResolveIntrinsic, PromiseIntrinsic, [value]);
}

function observePromise(promise, onFulfilled, onRejected) {
  return reflectApply(promiseThenIntrinsic, promise, [onFulfilled, onRejected]);
}

function addEventListener(target, type, listener, options) {
  if (eventTargetAddIntrinsic) {
    return reflectApply(eventTargetAddIntrinsic, target, [type, listener, options]);
  }
  return target.addEventListener(type, listener, options);
}

function removeEventListener(target, type, listener) {
  if (eventTargetRemoveIntrinsic) {
    return reflectApply(eventTargetRemoveIntrinsic, target, [type, listener]);
  }
  return target.removeEventListener(type, listener);
}

function channelSlot(channel, getter, property) {
  return getter ? reflectApply(getter, channel, []) : channel[property];
}

function peerSlot(connection, getter, property) {
  return getter ? reflectApply(getter, connection, []) : connection[property];
}

function eventSlot(event, getter, property) {
  return getter ? reflectApply(getter, event, []) : event[property];
}

function snapshotBoundMethod(
  target,
  intrinsic,
  property,
  label,
  errorCode = "WEBRTC_CONNECTION"
) {
  if (typeof intrinsic === "function") {
    return (...argumentsList) => reflectApply(intrinsic, target, argumentsList);
  }
  try {
    return snapshotDataMethod(target, property, label);
  } catch {
    fail(errorCode, `${label}.${property} capability is unavailable`);
  }
}

function closeDetachedChannel(channel) {
  if (!channel) return;
  try {
    snapshotBoundMethod(
      channel,
      rtcDataChannelCloseIntrinsic,
      "close",
      "RTCDataChannel",
      "WEBRTC_CHANNEL_CONTRACT"
    )();
  } catch {
    // Rejecting an unattached hostile channel is already fail-closed.
  }
}

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
  if (!value || typeof value !== "object" || isArray(value)) {
    fail("WEBRTC_SIGNAL_SCHEMA", `${label} must be an object`);
  }
  const actual = objectKeys(value);
  const wanted = arraySlice(expected, 0, expected.length);
  arraySort(actual);
  arraySort(wanted);
  if (actual.length !== wanted.length) {
    fail("WEBRTC_SIGNAL_SCHEMA", `${label} has unknown or missing fields`);
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== wanted[index]) {
      fail("WEBRTC_SIGNAL_SCHEMA", `${label} has unknown or missing fields`);
    }
  }
}

function endpointId(value, label = "endpoint ID") {
  if (
    typeof value !== "string" ||
    value.length > WEBRTC_LIMITS.endpoint_chars ||
    !regexpTest(ENDPOINT_ID, value)
  ) {
    fail("WEBRTC_ENDPOINT", `${label} is invalid`);
  }
  return value;
}

export function encodeWebRtcSignal({ endpoint_id, sdp, type }) {
  const ownedEndpoint = endpointId(endpoint_id);
  if (type !== "answer" && type !== "offer") {
    fail("WEBRTC_SIGNAL_TYPE", "offer or answer signal required");
  }
  if (
    typeof sdp !== "string" ||
    sdp.length < 1 ||
    sdp.length > WEBRTC_LIMITS.sdp_chars ||
    !stringStartsWith(sdp, "v=0\r\n")
  ) fail("WEBRTC_SIGNAL_SDP", "bounded SDP description required");
  const bytes = canonicalBytes({
    endpoint_id: ownedEndpoint,
    format: WEBRTC_SIGNAL_FORMAT,
    sdp,
    type
  });
  if (bytes.byteLength > WEBRTC_LIMITS.signal_bytes) {
    fail("WEBRTC_SIGNAL_LIMIT", "manual signal exceeds byte ceiling");
  }
  return textDecoderDecode(createTextDecoder(), bytes);
}

export function decodeWebRtcSignal(source, expectedType = null) {
  if (typeof source !== "string") fail("WEBRTC_SIGNAL_SCHEMA", "manual signal must be text");
  const bytes = textEncoderEncode(createTextEncoder(), source);
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
  return freeze({
    endpoint_id: value.endpoint_id,
    format: WEBRTC_SIGNAL_FORMAT,
    sdp: value.sdp,
    type: value.type
  });
}

function peerConnectionConstructor() {
  const PeerConnection = rtcPeerConnectionIntrinsic ?? globalThis.RTCPeerConnection;
  if (typeof PeerConnection !== "function") {
    fail("WEBRTC_UNAVAILABLE", "RTCPeerConnection is unavailable in this runtime");
  }
  return PeerConnection;
}

function waitForIceGathering(connection) {
  if (
    peerSlot(connection, rtcPeerConnectionIceGatheringStateGetter, "iceGatheringState") ===
      "complete"
  ) return resolvePromise();
  return new PromiseIntrinsic((resolve, reject) => {
    const timer = reflectApply(setTimeoutIntrinsic, globalThis, [() => {
      cleanup();
      reject(new WebRtcTransportError("WEBRTC_ICE_TIMEOUT", "ICE gathering timed out"));
    }, ICE_TIMEOUT_MS]);
    const changed = () => {
      if (
        peerSlot(connection, rtcPeerConnectionIceGatheringStateGetter, "iceGatheringState") !==
          "complete"
      ) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      reflectApply(clearTimeoutIntrinsic, globalThis, [timer]);
      removeEventListener(connection, "icegatheringstatechange", changed);
    };
    addEventListener(connection, "icegatheringstatechange", changed);
  });
}

function localSignal(connection, endpoint, type) {
  const description = peerSlot(
    connection,
    rtcPeerConnectionLocalDescriptionGetter,
    "localDescription"
  );
  if (!description || description.type !== type || typeof description.sdp !== "string") {
    fail("WEBRTC_LOCAL_DESCRIPTION", `local ${type} description is unavailable`);
  }
  return encodeWebRtcSignal({ endpoint_id: endpoint, sdp: description.sdp, type });
}

function ownedBinaryBytes(value) {
  let buffer;
  let byteLength;
  let byteOffset = 0;
  try {
    byteLength = reflectApply(arrayBufferByteLength, value, []);
    buffer = value;
  } catch {
    if (!arrayBufferIsView(value)) {
      fail("WEBRTC_FRAME_TYPE", "DataChannel accepts binary canonical frames only");
    }
    try {
      buffer = reflectApply(typedArrayBuffer, value, []);
      byteLength = reflectApply(typedArrayByteLength, value, []);
      byteOffset = reflectApply(typedArrayByteOffset, value, []);
    } catch {
      try {
        buffer = reflectApply(dataViewBuffer, value, []);
        byteLength = reflectApply(dataViewByteLength, value, []);
        byteOffset = reflectApply(dataViewByteOffset, value, []);
      } catch {
        fail("WEBRTC_FRAME_TYPE", "DataChannel accepts binary canonical frames only");
      }
    }
    try {
      reflectApply(arrayBufferByteLength, buffer, []);
    } catch {
      fail("WEBRTC_FRAME_TYPE", "shared or invalid binary storage is not accepted");
    }
  }
  const owned = new Uint8ArrayIntrinsic(byteLength);
  const source = new Uint8ArrayIntrinsic(buffer, byteOffset, byteLength);
  reflectApply(typedArraySet, owned, [source, 0]);
  return owned;
}

function immutableRelayFrame(sequence, messageBytes) {
  const frame = createRelayFrame(sequence, messageBytes);
  return freeze({
    format: frame.format,
    message_base64url: frame.message_base64url,
    message_id: frame.message_id,
    sequence: frame.sequence
  });
}

function detachedRelayFrame(frame) {
  return freeze({
    format: frame.format,
    message_base64url: frame.message_base64url,
    message_id: frame.message_id,
    sequence: frame.sequence
  });
}

function assertTranscriptCapacity(messageCount, retainedBytes, nextMessageBytes) {
  if (messageCount >= RELAY_LIMITS.room_messages) {
    fail("RELAY_LIMIT", "WebRTC room message ceiling reached");
  }
  if (retainedBytes + nextMessageBytes > RELAY_LIMITS.room_bytes) {
    fail("RELAY_LIMIT", "WebRTC room byte ceiling reached");
  }
}

export class ManualWebRtcParticipantTransport {
  #channel = null;
  #channelClose = null;
  #channelCloseStarted = false;
  #channelSend = null;
  #closed = false;
  #connection;
  #connectionClose;
  #connectionCloseStarted = false;
  #connectionSetRemoteDescription;
  #endpointId;
  #error = null;
  #frames = createMap();
  #handlers = createSet();
  #openPromise;
  #openReject;
  #openResolve;
  #remoteEndpointId = null;
  #retainedBytes = 0;

  constructor(endpoint, connection) {
    this.#endpointId = endpointId(endpoint);
    this.#connection = connection;
    this.#connectionClose = snapshotBoundMethod(
      connection,
      rtcPeerConnectionCloseIntrinsic,
      "close",
      "RTCPeerConnection"
    );
    try {
      this.#connectionSetRemoteDescription = snapshotBoundMethod(
        connection,
        rtcPeerConnectionSetRemoteDescriptionIntrinsic,
        "setRemoteDescription",
        "RTCPeerConnection"
      );
    } catch (error) {
      if (rtcPeerConnectionSetRemoteDescriptionIntrinsic) throw error;
      this.#connectionSetRemoteDescription = null;
    }
    this.#openPromise = new PromiseIntrinsic((resolve, reject) => {
      this.#openResolve = resolve;
      this.#openReject = reject;
    });
    void observePromise(this.#openPromise, undefined, () => {});
    addEventListener(connection, "connectionstatechange", () => {
      const connectionState = peerSlot(
        connection,
        rtcPeerConnectionConnectionStateGetter,
        "connectionState"
      );
      if (connectionState === "failed") {
        this.#markClosed(new WebRtcTransportError("WEBRTC_CONNECTION_CLOSED", connectionState));
      } else if (connectionState === "closed") {
        this.#shutdown(null, { connectionClosed: true });
      }
    });
  }

  static async createOffer({ endpointId: endpoint }) {
    const PeerConnection = peerConnectionConstructor();
    const connection = new PeerConnection({ iceServers: [] });
    const createDataChannel = snapshotBoundMethod(
      connection,
      rtcPeerConnectionCreateDataChannelIntrinsic,
      "createDataChannel",
      "RTCPeerConnection"
    );
    const createOffer = snapshotBoundMethod(
      connection,
      rtcPeerConnectionCreateOfferIntrinsic,
      "createOffer",
      "RTCPeerConnection"
    );
    const setLocalDescription = snapshotBoundMethod(
      connection,
      rtcPeerConnectionSetLocalDescriptionIntrinsic,
      "setLocalDescription",
      "RTCPeerConnection"
    );
    const transport = new ManualWebRtcParticipantTransport(endpoint, connection);
    const channel = createDataChannel("mortalos-participant-v1", {
      negotiated: false,
      ordered: true
    });
    transport.#attachChannel(channel);
    await setLocalDescription(await createOffer());
    await waitForIceGathering(connection);
    return freeze({ signal: localSignal(connection, transport.#endpointId, "offer"), transport });
  }

  static async acceptOffer({ endpointId: endpoint, offer }) {
    const opened = decodeWebRtcSignal(offer, "offer");
    const ownedEndpoint = endpointId(endpoint);
    if (opened.endpoint_id === ownedEndpoint) fail("WEBRTC_ENDPOINT", "remote endpoint must be distinct");
    const PeerConnection = peerConnectionConstructor();
    const connection = new PeerConnection({ iceServers: [] });
    const createAnswer = snapshotBoundMethod(
      connection,
      rtcPeerConnectionCreateAnswerIntrinsic,
      "createAnswer",
      "RTCPeerConnection"
    );
    const setLocalDescription = snapshotBoundMethod(
      connection,
      rtcPeerConnectionSetLocalDescriptionIntrinsic,
      "setLocalDescription",
      "RTCPeerConnection"
    );
    const setRemoteDescription = snapshotBoundMethod(
      connection,
      rtcPeerConnectionSetRemoteDescriptionIntrinsic,
      "setRemoteDescription",
      "RTCPeerConnection"
    );
    const transport = new ManualWebRtcParticipantTransport(ownedEndpoint, connection);
    transport.#remoteEndpointId = opened.endpoint_id;
    addEventListener(
      connection,
      "datachannel",
      (event) => transport.#attachChannel(
        eventSlot(event, rtcDataChannelEventChannelGetter, "channel")
      ),
      { once: true }
    );
    await setRemoteDescription({ sdp: opened.sdp, type: "offer" });
    await setLocalDescription(await createAnswer());
    await waitForIceGathering(connection);
    return freeze({ signal: localSignal(connection, transport.#endpointId, "answer"), transport });
  }

  get endpointId() { return this.#endpointId; }
  get remoteEndpointId() { return this.#remoteEndpointId; }
  get state() {
    if (this.#error) return "failed";
    if (this.#closed) return "closed";
    return this.#channel
      ? channelSlot(this.#channel, rtcDataChannelReadyStateGetter, "readyState")
      : "connecting";
  }

  async complete(answer) {
    if (
      peerSlot(
        this.#connection,
        rtcPeerConnectionRemoteDescriptionGetter,
        "remoteDescription"
      )
    ) fail("WEBRTC_SIGNAL_STATE", "remote description already set");
    const opened = decodeWebRtcSignal(answer, "answer");
    if (opened.endpoint_id === this.#endpointId) fail("WEBRTC_ENDPOINT", "remote endpoint must be distinct");
    this.#remoteEndpointId = opened.endpoint_id;
    if (!this.#connectionSetRemoteDescription) {
      fail("WEBRTC_CONNECTION", "RTCPeerConnection.setRemoteDescription capability is unavailable");
    }
    await this.#connectionSetRemoteDescription({ sdp: opened.sdp, type: "answer" });
  }

  async ready({ timeoutMs = OPEN_TIMEOUT_MS } = {}) {
    if (!numberIsSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      fail("WEBRTC_TIMEOUT", "ready timeout is invalid");
    }
    if (this.#error) throw this.#error;
    if (this.#closed) {
      fail("WEBRTC_CONNECTION_CLOSED", "transport closed before DataChannel opened");
    }
    if (
      this.#channel &&
      channelSlot(this.#channel, rtcDataChannelReadyStateGetter, "readyState") === "open"
    ) return this;
    let timer;
    try {
      await new PromiseIntrinsic((resolve, reject) => {
        timer = reflectApply(setTimeoutIntrinsic, globalThis, [
          () => reject(new WebRtcTransportError("WEBRTC_OPEN_TIMEOUT", "DataChannel open timed out")),
          timeoutMs
        ]);
        observePromise(this.#openPromise, resolve, reject);
      });
      return this;
    } finally {
      reflectApply(clearTimeoutIntrinsic, globalThis, [timer]);
    }
  }

  async publish(messageSource) {
    if (
      this.#closed ||
      !this.#channel ||
      channelSlot(this.#channel, rtcDataChannelReadyStateGetter, "readyState") !== "open"
    ) {
      fail("WEBRTC_NOT_OPEN", "DataChannel is not open");
    }
    const messageBytes = ownedBinaryBytes(messageSource);
    const opened = decodeRelayMessageBytes(messageBytes);
    const duplicate = mapGet(this.#frames, opened.message_id);
    if (duplicate) return freeze({ duplicate: true, frame: detachedRelayFrame(duplicate) });
    const messageByteLength = reflectApply(typedArrayByteLength, messageBytes, []);
    assertTranscriptCapacity(mapSize(this.#frames), this.#retainedBytes, messageByteLength);
    const bufferedAmount = channelSlot(
      this.#channel,
      rtcDataChannelBufferedAmountGetter,
      "bufferedAmount"
    );
    if (bufferedAmount + messageByteLength > WEBRTC_LIMITS.buffered_bytes) {
      fail("WEBRTC_BACKPRESSURE", "DataChannel buffered byte ceiling exceeded");
    }
    const frame = immutableRelayFrame(mapSize(this.#frames) + 1, messageBytes);
    this.#channelSend(messageBytes);
    mapSet(this.#frames, opened.message_id, frame);
    this.#retainedBytes += messageByteLength;
    return freeze({ duplicate: false, frame: detachedRelayFrame(frame) });
  }

  async fetchRange(after = 0, limit = RELAY_LIMITS.range_limit) {
    if (!numberIsSafeInteger(after) || after < 0) fail("WEBRTC_RANGE", "range cursor is invalid");
    if (!numberIsSafeInteger(limit) || limit < 1 || limit > RELAY_LIMITS.range_limit) {
      fail("WEBRTC_RANGE", "range limit is invalid");
    }
    const frames = mapValues(this.#frames);
    const selected = [];
    for (let index = 0; index < frames.length && selected.length < limit; index += 1) {
      const frame = frames[index];
      if (frame.sequence > after) arrayPush(selected, detachedRelayFrame(frame));
    }
    return selected;
  }

  subscribe(handler, { startAfter = 0 } = {}) {
    if (this.#closed) fail("WEBRTC_CONNECTION_CLOSED", "transport closed");
    if (typeof handler !== "function") fail("WEBRTC_SUBSCRIBER", "subscriber function required");
    if (!numberIsSafeInteger(startAfter) || startAfter < 0) fail("WEBRTC_RANGE", "start cursor is invalid");
    const subscription = freeze({ handler, startAfter });
    setAdd(this.#handlers, subscription);
    const frames = mapValues(this.#frames);
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      if (frame.sequence > startAfter) this.#deliver(subscription, frame);
    }
    return () => reflectApply(setDeleteIntrinsic, this.#handlers, [subscription]);
  }

  async touchPresence() {
    return freeze({ endpoint_id: this.#endpointId, transport: "webrtc-direct" });
  }

  async presence() {
    const endpoints = [this.#endpointId];
    if (
      this.#remoteEndpointId &&
      this.#channel &&
      channelSlot(this.#channel, rtcDataChannelReadyStateGetter, "readyState") === "open"
    ) arrayPush(endpoints, this.#remoteEndpointId);
    return arraySort(endpoints);
  }

  close() {
    this.#shutdown(null);
  }

  #attachChannel(channel) {
    if (this.#closed) {
      closeDetachedChannel(channel);
      return;
    }
    if (this.#channel) {
      closeDetachedChannel(channel);
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_DUPLICATE", "duplicate DataChannel rejected"));
      return;
    }
    if (
      channelSlot(channel, rtcDataChannelLabelGetter, "label") !== "mortalos-participant-v1" ||
      channelSlot(channel, rtcDataChannelOrderedGetter, "ordered") !== true
    ) {
      closeDetachedChannel(channel);
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_CONTRACT", "unexpected DataChannel contract"));
      return;
    }
    const channelSend = snapshotBoundMethod(
      channel,
      rtcDataChannelSendIntrinsic,
      "send",
      "RTCDataChannel",
      "WEBRTC_CHANNEL_CONTRACT"
    );
    const channelClose = snapshotBoundMethod(
      channel,
      rtcDataChannelCloseIntrinsic,
      "close",
      "RTCDataChannel",
      "WEBRTC_CHANNEL_CONTRACT"
    );
    this.#channel = channel;
    this.#channelClose = channelClose;
    this.#channelSend = channelSend;
    if (rtcDataChannelBinaryTypeSetter) {
      reflectApply(rtcDataChannelBinaryTypeSetter, channel, ["arraybuffer"]);
    } else {
      channel.binaryType = "arraybuffer";
    }
    addEventListener(channel, "open", () => this.#resolveOpen());
    addEventListener(channel, "close", () => {
      this.#shutdown(null, { channelClosed: true });
    });
    addEventListener(channel, "error", () => {
      this.#markClosed(new WebRtcTransportError("WEBRTC_CHANNEL_ERROR", "DataChannel failed"));
    });
    addEventListener(channel, "message", (event) => {
      if (this.#closed) return;
      try {
        const messageBytes = ownedBinaryBytes(eventSlot(event, messageEventDataGetter, "data"));
        const opened = decodeRelayMessageBytes(messageBytes);
        if (mapHas(this.#frames, opened.message_id)) return;
        const messageByteLength = reflectApply(typedArrayByteLength, messageBytes, []);
        assertTranscriptCapacity(mapSize(this.#frames), this.#retainedBytes, messageByteLength);
        const frame = immutableRelayFrame(mapSize(this.#frames) + 1, messageBytes);
        mapSet(this.#frames, opened.message_id, frame);
        this.#retainedBytes += messageByteLength;
        const subscriptions = setValues(this.#handlers);
        for (let index = 0; index < subscriptions.length; index += 1) {
          const subscription = subscriptions[index];
          if (frame.sequence > subscription.startAfter) this.#deliver(subscription, frame);
        }
      } catch (error) {
        this.#markClosed(
          error ||
            new WebRtcTransportError("WEBRTC_CHANNEL_ERROR", "untrusted inbound frame failed")
        );
      }
    });
  }

  #deliver(subscription, frame) {
    const detachedFrame = detachedRelayFrame(frame);
    reflectApply(queueMicrotaskIntrinsic, globalThis, [() => {
      if (this.#closed || !setHas(this.#handlers, subscription)) return;
      let result;
      try {
        result = subscription.handler(detachedFrame);
      } catch (error) {
        this.#markClosed(error);
        return;
      }
      observePromise(resolvePromise(result), undefined, (error) => this.#markClosed(error));
    }]);
  }

  #markClosed(error) {
    this.#shutdown(error);
  }

  #resolveOpen() {
    const resolve = this.#openResolve;
    if (!resolve) return;
    this.#openResolve = null;
    this.#openReject = null;
    resolve(this);
  }

  #rejectOpen(error) {
    const reject = this.#openReject;
    if (!reject) return;
    this.#openResolve = null;
    this.#openReject = null;
    reject(error);
  }

  #shutdown(error, { channelClosed = false, connectionClosed = false } = {}) {
    if (channelClosed) this.#channelCloseStarted = true;
    if (connectionClosed) this.#connectionCloseStarted = true;
    if (this.#closed) return;
    this.#closed = true;
    if (error && !this.#error) this.#error = error;
    reflectApply(setClearIntrinsic, this.#handlers, []);

    let cleanupError = null;
    if (!this.#channelCloseStarted && this.#channel && this.#channelClose) {
      this.#channelCloseStarted = true;
      try {
        this.#channelClose();
      } catch (closeError) {
        cleanupError = closeError;
      }
    }
    if (!this.#connectionCloseStarted) {
      this.#connectionCloseStarted = true;
      try {
        this.#connectionClose();
      } catch (closeError) {
        cleanupError ??= closeError;
      }
    }
    if (cleanupError && !this.#error) this.#error = cleanupError;
    this.#rejectOpen(
      error ||
        cleanupError ||
        new WebRtcTransportError("WEBRTC_CONNECTION_CLOSED", "transport closed")
    );
  }
}
