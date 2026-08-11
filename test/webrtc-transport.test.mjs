import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  createRelayControlMessage,
  decodeRelayFrame,
  decodeRelayMessageBytes,
  openResourcePlacementArtifact,
  RELAY_LIMITS
} from "../src/transport/protocol.mjs";
import {
  decodeWebRtcSignal,
  encodeWebRtcSignal,
  ManualWebRtcParticipantTransport,
  WEBRTC_SIGNAL_FORMAT
} from "../lab/transport/webrtc-peer.mjs";

const sdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";

async function openFakeTransport(endpointId = "A-direct", { sendImpl = null } = {}) {
  let channel;
  let connection;
  class FakeChannel extends EventTarget {
    constructor() {
      super();
      this.bufferedAmount = 0;
      this.closeCalls = 0;
      this.label = "mortalos-participant-v1";
      this.ordered = true;
      this.readyState = "open";
      this.sendCalls = 0;
    }
    close() {
      this.closeCalls += 1;
      this.readyState = "closed";
      this.dispatchEvent(new Event("close"));
    }
    send(value) {
      this.sendCalls += 1;
      if (sendImpl) return sendImpl.call(this, value);
      this.sent = new Uint8Array(value);
    }
  }
  class FakePeer extends EventTarget {
    constructor() {
      super();
      connection = this;
      this.closeCalls = 0;
      this.connectionState = "connected";
      this.iceGatheringState = "complete";
      this.localDescription = null;
      this.remoteDescription = null;
    }
    createDataChannel() { channel = new FakeChannel(); return channel; }
    async createOffer() { return { sdp, type: "offer" }; }
    async setLocalDescription(value) { this.localDescription = value; }
    close() {
      this.closeCalls += 1;
      this.connectionState = "closed";
      this.dispatchEvent(new Event("connectionstatechange"));
    }
  }
  const prior = globalThis.RTCPeerConnection;
  globalThis.RTCPeerConnection = FakePeer;
  try {
    const { transport } = await ManualWebRtcParticipantTransport.createOffer({ endpointId });
    return {
      channel,
      connection,
      restore() {
        if (prior === undefined) delete globalThis.RTCPeerConnection;
        else globalThis.RTCPeerConnection = prior;
      },
      transport
    };
  } catch (error) {
    if (prior === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = prior;
    throw error;
  }
}

async function openFakeAcceptedTransport(endpointId = "B-direct") {
  let connection;
  class FakePeer extends EventTarget {
    constructor() {
      super();
      connection = this;
      this.closeCalls = 0;
      this.connectionState = "connected";
      this.iceGatheringState = "complete";
      this.localDescription = null;
      this.remoteDescription = null;
    }
    async createAnswer() { return { sdp, type: "answer" }; }
    async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription(value) { this.remoteDescription = value; }
    close() {
      this.closeCalls += 1;
      this.connectionState = "closed";
      this.dispatchEvent(new Event("connectionstatechange"));
    }
  }
  const prior = globalThis.RTCPeerConnection;
  globalThis.RTCPeerConnection = FakePeer;
  try {
    const accepted = await ManualWebRtcParticipantTransport.acceptOffer({
      endpointId,
      offer: encodeWebRtcSignal({ endpoint_id: "A-direct", sdp, type: "offer" })
    });
    return {
      connection,
      restore() {
        if (prior === undefined) delete globalThis.RTCPeerConnection;
        else globalThis.RTCPeerConnection = prior;
      },
      transport: accepted.transport
    };
  } catch (error) {
    if (prior === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = prior;
    throw error;
  }
}

function placementArtifactBytes(requestId = "ownership-1") {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ value: "owned" }),
    requestId
  }));
}

const exactPaddingLengths = new Map();

function paddedPlacementArtifactBytes(marker, paddingLength) {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ marker, padding: "x".repeat(paddingLength) }),
    requestId: "room-byte-boundary"
  }));
}

function exactSizedPlacementArtifactBytes(marker, targetBytes) {
  const cacheKey = `${marker.length}:${targetBytes}`;
  let paddingLength = exactPaddingLengths.get(cacheKey);
  if (paddingLength === undefined) {
    let low = 0;
    let high = targetBytes;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (paddedPlacementArtifactBytes(marker, middle).byteLength < targetBytes) low = middle + 1;
      else high = middle - 1;
    }
    paddingLength = -1;
    for (let candidate = Math.max(0, low - 4); candidate <= low + 4; candidate += 1) {
      if (paddedPlacementArtifactBytes(marker, candidate).byteLength === targetBytes) {
        paddingLength = candidate;
        break;
      }
    }
    assert.notEqual(paddingLength, -1, `no canonical relay message has ${targetBytes} bytes`);
    exactPaddingLengths.set(cacheKey, paddingLength);
  }
  const bytes = paddedPlacementArtifactBytes(marker, paddingLength);
  assert.equal(bytes.byteLength, targetBytes);
  return bytes;
}

function dispatchInbound(channel, bytes) {
  channel.dispatchEvent(new MessageEvent("message", { data: bytes }));
}

test("manual WebRTC signaling is canonical, bounded, exact, and endpoint-bound", () => {
  const signal = encodeWebRtcSignal({ endpoint_id: "A-direct", sdp, type: "offer" });
  assert.equal(signal, JSON.stringify({
    endpoint_id: "A-direct",
    format: WEBRTC_SIGNAL_FORMAT,
    sdp,
    type: "offer"
  }));
  assert.deepEqual(decodeWebRtcSignal(signal, "offer"), {
    endpoint_id: "A-direct",
    format: WEBRTC_SIGNAL_FORMAT,
    sdp,
    type: "offer"
  });
  assert.throws(
    () => decodeWebRtcSignal(JSON.stringify({ type: "offer", sdp, format: WEBRTC_SIGNAL_FORMAT, endpoint_id: "A-direct" })),
    (error) => error.code === "WEBRTC_SIGNAL_NONCANONICAL"
  );
  assert.throws(() => decodeWebRtcSignal(signal, "answer"), (error) => error.code === "WEBRTC_SIGNAL_TYPE");
  assert.throws(
    () => encodeWebRtcSignal({ endpoint_id: "bad endpoint", sdp, type: "offer" }),
    (error) => error.code === "WEBRTC_ENDPOINT"
  );
});

test("resource placement artifacts are bounded untrusted carriers, not verdicts", () => {
  const payloadBytes = canonicalBytes({ evidence: "transported", proved: false });
  const message = createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes,
    requestId: "placement-1"
  });
  const opened = decodeRelayMessageBytes(canonicalBytes(message));
  const artifact = openResourcePlacementArtifact(opened.control);
  assert.equal(artifact.artifact_kind, "challenge");
  assert.equal(artifact.request_id, "placement-1");
  assert.equal(JSON.stringify(artifact.payload), JSON.stringify({ evidence: "transported", proved: false }));
  for (const artifactKind of [
    "failure-certificate",
    "liveness-challenge",
    "liveness-observation",
    "liveness-response"
  ]) {
    const liveness = createResourcePlacementArtifactMessage({
      artifactKind,
      payloadBytes,
      requestId: `placement-${artifactKind}`
    });
    const openedLiveness = openResourcePlacementArtifact(
      decodeRelayMessageBytes(canonicalBytes(liveness)).control
    );
    assert.equal(openedLiveness.artifact_kind, artifactKind);
  }
  assert.throws(
    () => createRelayControlMessage("resource-placement-artifact", {
      artifact_kind: "verdict",
      format: "mortalos-resource-placement-artifact/1",
      payload_base64url: "e30",
      request_id: "placement-1"
    }),
    (error) => error.code === "RELAY_SCHEMA"
  );
});

test("direct transport has no implicit network fallback outside a browser", async () => {
  await assert.rejects(
    ManualWebRtcParticipantTransport.createOffer({ endpointId: "A-direct" }),
    (error) => error.code === "WEBRTC_UNAVAILABLE"
  );
});

test("WebRTC publisher owns borrowed bytes before its first suspension", async () => {
  const { channel, restore, transport } = await openFakeTransport();
  try {
    const bytes = placementArtifactBytes();
    const expected = new Uint8Array(bytes);
    const publishing = transport.publish(bytes);
    bytes.fill(0);
    await publishing;
    assert.deepEqual(channel.sent, expected);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC publish and fetch never expose the mutable internal relay-frame cursor", async () => {
  const { channel, restore, transport } = await openFakeTransport();
  try {
    const bytes = placementArtifactBytes("frame-alias-1");
    const expectedBytes = new Uint8Array(bytes);
    const published = await transport.publish(bytes);
    bytes.fill(255);

    const before = published.frame.sequence;
    const mutationAccepted = Reflect.set(published.frame, "sequence", 777);
    const firstFetch = await transport.fetchRange(0);
    const secondFetch = await transport.fetchRange(0);
    const duplicate = await transport.publish(expectedBytes);

    assert.equal(before, 1);
    assert.equal(mutationAccepted, false);
    assert.equal(published.frame.sequence, 1);
    assert.equal(Object.isFrozen(published.frame), true);
    assert.equal(firstFetch[0].sequence, 1);
    assert.notEqual(firstFetch[0], published.frame);
    assert.notEqual(secondFetch[0], firstFetch[0]);
    assert.equal(Object.isFrozen(firstFetch[0]), true);
    assert.equal(duplicate.duplicate, true);
    assert.notEqual(duplicate.frame, published.frame);
    assert.equal(duplicate.frame.sequence, 1);
    assert.equal(Object.isFrozen(duplicate.frame), true);
    assert.deepEqual(channel.sent, expectedBytes);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC publication commits only after send succeeds and retries remain deliverable", async () => {
  let sendCalls = 0;
  const { channel, restore, transport } = await openFakeTransport("A-direct", {
    sendImpl(value) {
      sendCalls += 1;
      if (sendCalls === 1) {
        throw new DOMException("transient buffer failure", "OperationError");
      }
      this.sent = new Uint8Array(value);
    }
  });
  try {
    const bytes = placementArtifactBytes("send-atomicity-1");

    await assert.rejects(
      transport.publish(bytes),
      (error) => error.name === "OperationError" && error.message === "transient buffer failure"
    );
    assert.equal(sendCalls, 1);
    assert.deepEqual(await transport.fetchRange(0), []);

    let ghostDeliveries = 0;
    const unsubscribe = transport.subscribe(() => {
      ghostDeliveries += 1;
    });
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.equal(ghostDeliveries, 0);
    unsubscribe();

    const retried = await transport.publish(bytes);
    assert.equal(retried.duplicate, false);
    assert.equal(sendCalls, 2);
    assert.equal((await transport.fetchRange(0)).length, 1);

    const duplicate = await transport.publish(bytes);
    assert.equal(duplicate.duplicate, true);
    assert.equal(sendCalls, 2);
    assert.equal((await transport.fetchRange(0)).length, 1);

    channel.bufferedAmount = Number.MAX_SAFE_INTEGER;
    await assert.rejects(
      transport.publish(placementArtifactBytes("send-backpressure-1")),
      (error) => error.code === "WEBRTC_BACKPRESSURE"
    );
    assert.equal(sendCalls, 2);
    assert.equal((await transport.fetchRange(0)).length, 1);

    channel.bufferedAmount = 0;
    channel.readyState = "closed";
    await assert.rejects(
      transport.publish(placementArtifactBytes("send-closed-1")),
      (error) => error.code === "WEBRTC_NOT_OPEN"
    );
    assert.equal(sendCalls, 2);
    assert.equal((await transport.fetchRange(0)).length, 1);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC subscribers receive distinct immutable frames that cannot cross-contaminate", async () => {
  const { restore, transport } = await openFakeTransport();
  try {
    await transport.publish(placementArtifactBytes("subscriber-alias-1"));
    let leftMutationAccepted;
    const left = new Promise((resolve) => {
      transport.subscribe((frame) => {
        leftMutationAccepted = Reflect.set(frame, "sequence", 900);
        resolve(frame);
      });
    });
    const right = new Promise((resolve) => transport.subscribe(resolve));
    const [leftFrame, rightFrame] = await Promise.all([left, right]);

    assert.equal(leftMutationAccepted, false);
    assert.equal(leftFrame.sequence, 1);
    assert.equal(rightFrame.sequence, 1);
    assert.notEqual(leftFrame, rightFrame);
    assert.equal(Object.isFrozen(leftFrame), true);
    assert.equal(Object.isFrozen(rightFrame), true);
    assert.equal((await transport.fetchRange(0))[0].sequence, 1);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC binary ownership rejects accessor and Proxy impostors without invoking them", async () => {
  const { restore, transport } = await openFakeTransport();
  try {
    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "buffer", {
      get() {
        getterCalls += 1;
        return placementArtifactBytes("accessor-impostor").buffer;
      }
    });
    await assert.rejects(
      transport.publish(accessor),
      (error) => error.code === "WEBRTC_FRAME_TYPE"
    );
    assert.equal(getterCalls, 0);

    let trapCalls = 0;
    const proxied = new Proxy(placementArtifactBytes("proxy-impostor"), {
      get(target, property, receiver) {
        trapCalls += 1;
        return Reflect.get(target, property, receiver);
      }
    });
    await assert.rejects(
      transport.publish(proxied),
      (error) => error.code === "WEBRTC_FRAME_TYPE"
    );
    assert.equal(trapCalls, 0);

    if (typeof SharedArrayBuffer === "function") {
      const shared = new SharedArrayBuffer(placementArtifactBytes("shared-impostor").byteLength);
      new Uint8Array(shared).set(placementArtifactBytes("shared-impostor"));
      await assert.rejects(
        transport.publish(shared),
        (error) => error.code === "WEBRTC_FRAME_TYPE"
      );
      await assert.rejects(
        transport.publish(new Uint8Array(shared)),
        (error) => error.code === "WEBRTC_FRAME_TYPE"
      );
    }
    assert.deepEqual(await transport.fetchRange(0), []);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC preserves ordinary ArrayBuffer and DataView publishing while owning their bytes", async () => {
  const { restore, transport } = await openFakeTransport();
  try {
    const firstBytes = placementArtifactBytes("array-buffer-1");
    const firstExpectedId = decodeRelayMessageBytes(firstBytes).message_id;
    const firstBuffer = new Uint8Array(firstBytes).buffer;
    const firstPublishing = transport.publish(firstBuffer);
    new Uint8Array(firstBuffer).fill(0);
    await firstPublishing;

    const secondBytes = placementArtifactBytes("data-view-1");
    const secondExpectedId = decodeRelayMessageBytes(secondBytes).message_id;
    const secondBacking = new Uint8Array(secondBytes);
    const secondPublishing = transport.publish(new DataView(secondBacking.buffer));
    secondBacking.fill(0);
    await secondPublishing;

    const frames = await transport.fetchRange(0);
    assert.equal(frames.length, 2);
    assert.equal(decodeRelayFrame(frames[0]).message_id, firstExpectedId);
    assert.equal(decodeRelayFrame(frames[1]).message_id, secondExpectedId);
    transport.close();
  } finally {
    restore();
  }
});

test("WebRTC outbound transcript enforces exact generated message and raw-byte ceilings atomically", async () => {
  const countCase = await openFakeTransport("count-outbound");
  try {
    let firstBytes;
    for (let index = 0; index < RELAY_LIMITS.room_messages; index += 1) {
      const bytes = placementArtifactBytes(`count-${index}`);
      firstBytes ??= bytes;
      await countCase.transport.publish(bytes);
    }
    const duplicate = await countCase.transport.publish(firstBytes);
    assert.equal(duplicate.duplicate, true);
    const overflow = placementArtifactBytes("count-overflow");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(
        countCase.transport.publish(overflow),
        (error) => error.code === "RELAY_LIMIT"
      );
    }
    assert.equal(countCase.channel.sendCalls, RELAY_LIMITS.room_messages);
    assert.equal((await countCase.transport.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
  } finally {
    countCase.transport.close();
    countCase.restore();
  }

  const exactCase = await openFakeTransport("bytes-outbound-exact");
  try {
    let firstBytes;
    for (let index = 0; index < RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes; index += 1) {
      const bytes = exactSizedPlacementArtifactBytes(
        `exact-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      );
      firstBytes ??= bytes;
      await exactCase.transport.publish(bytes);
    }
    assert.equal((await exactCase.transport.publish(firstBytes)).duplicate, true);
    await assert.rejects(
      exactCase.transport.publish(placementArtifactBytes("bytes-overflow")),
      (error) => error.code === "RELAY_LIMIT"
    );
    assert.equal(exactCase.channel.sendCalls, RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes);
  } finally {
    exactCase.transport.close();
    exactCase.restore();
  }

  let boundarySendCalls = 0;
  const boundaryRetryCase = await openFakeTransport("bytes-outbound-boundary-retry", {
    sendImpl(value) {
      boundarySendCalls += 1;
      if (boundarySendCalls === RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes) {
        throw new DOMException("transient boundary send failure", "OperationError");
      }
      this.sent = new Uint8Array(value);
    }
  });
  try {
    const exactMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes;
    for (let index = 0; index < exactMessages - 1; index += 1) {
      await boundaryRetryCase.transport.publish(exactSizedPlacementArtifactBytes(
        `retry-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      ));
    }
    const finalBytes = exactSizedPlacementArtifactBytes("retry-final", RELAY_LIMITS.message_bytes);
    await assert.rejects(
      boundaryRetryCase.transport.publish(finalBytes),
      (error) => error.name === "OperationError"
    );
    assert.equal((await boundaryRetryCase.transport.fetchRange(exactMessages - 1)).length, 0);
    const retried = await boundaryRetryCase.transport.publish(finalBytes);
    assert.equal(retried.duplicate, false);
    assert.equal(retried.frame.sequence, exactMessages);
    assert.equal(boundarySendCalls, exactMessages + 1);
    await assert.rejects(
      boundaryRetryCase.transport.publish(placementArtifactBytes("retry-overflow")),
      (error) => error.code === "RELAY_LIMIT"
    );
  } finally {
    boundaryRetryCase.transport.close();
    boundaryRetryCase.restore();
  }

  const plusOneCase = await openFakeTransport("bytes-outbound-plus-one");
  try {
    const fullMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes - 1;
    for (let index = 0; index < fullMessages; index += 1) {
      await plusOneCase.transport.publish(exactSizedPlacementArtifactBytes(
        `plus1-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      ));
    }
    await plusOneCase.transport.publish(exactSizedPlacementArtifactBytes(
      "plus1-remainder",
      RELAY_LIMITS.message_bytes - 399
    ));
    const exactPlusOne = exactSizedPlacementArtifactBytes("plus1-overflow", 400);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(
        plusOneCase.transport.publish(exactPlusOne),
        (error) => error.code === "RELAY_LIMIT"
      );
    }
    assert.equal(plusOneCase.channel.sendCalls, fullMessages + 1);
    assert.equal((await plusOneCase.transport.fetchRange(fullMessages)).length, 1);
  } finally {
    plusOneCase.transport.close();
    plusOneCase.restore();
  }
});

test("WebRTC inbound transcript treats duplicates as free and fail-closes before overflow mutation", async () => {
  const countCase = await openFakeTransport("count-inbound");
  try {
    let firstBytes;
    for (let index = 0; index < RELAY_LIMITS.room_messages; index += 1) {
      const bytes = placementArtifactBytes(`inbound-count-${index}`);
      firstBytes ??= bytes;
      dispatchInbound(countCase.channel, bytes);
    }
    dispatchInbound(countCase.channel, firstBytes);
    assert.equal(countCase.transport.state, "open");
    let ghostDeliveries = 0;
    countCase.transport.subscribe(() => { ghostDeliveries += 1; }, {
      startAfter: RELAY_LIMITS.room_messages
    });
    dispatchInbound(countCase.channel, placementArtifactBytes("inbound-count-overflow"));
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.equal(ghostDeliveries, 0);
    assert.equal(countCase.transport.state, "failed");
    assert.equal((await countCase.transport.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
    assert.equal(countCase.channel.closeCalls, 1);
    assert.equal(countCase.connection.closeCalls, 1);
  } finally {
    countCase.transport.close();
    countCase.restore();
  }

  const exactCase = await openFakeTransport("bytes-inbound-exact");
  try {
    let firstBytes;
    const fullMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes;
    for (let index = 0; index < fullMessages; index += 1) {
      const bytes = exactSizedPlacementArtifactBytes(
        `input-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      );
      firstBytes ??= bytes;
      dispatchInbound(exactCase.channel, bytes);
    }
    dispatchInbound(exactCase.channel, firstBytes);
    assert.equal(exactCase.transport.state, "open");
    dispatchInbound(exactCase.channel, placementArtifactBytes("inbound-bytes-overflow"));
    assert.equal(exactCase.transport.state, "failed");
    assert.equal(exactCase.channel.closeCalls, 1);
    assert.equal(exactCase.connection.closeCalls, 1);
  } finally {
    exactCase.transport.close();
    exactCase.restore();
  }

  const plusOneCase = await openFakeTransport("bytes-inbound-plus-one");
  try {
    const fullMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes - 1;
    for (let index = 0; index < fullMessages; index += 1) {
      dispatchInbound(plusOneCase.channel, exactSizedPlacementArtifactBytes(
        `in-p1-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      ));
    }
    dispatchInbound(plusOneCase.channel, exactSizedPlacementArtifactBytes(
      "in-p1-remainder",
      RELAY_LIMITS.message_bytes - 399
    ));
    let ghostDeliveries = 0;
    plusOneCase.transport.subscribe(() => { ghostDeliveries += 1; }, {
      startAfter: fullMessages + 1
    });
    dispatchInbound(plusOneCase.channel, exactSizedPlacementArtifactBytes("in-p1-overflow", 400));
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.equal(ghostDeliveries, 0);
    assert.equal(plusOneCase.transport.state, "failed");
    assert.equal((await plusOneCase.transport.fetchRange(fullMessages)).length, 1);
  } finally {
    plusOneCase.transport.close();
    plusOneCase.restore();
  }
});

test("WebRTC inbound and outbound entries consume one combined generated transcript budget", async () => {
  const countCase = await openFakeTransport("mixed-count");
  try {
    const half = RELAY_LIMITS.room_messages / 2;
    for (let index = 0; index < half; index += 1) {
      await countCase.transport.publish(placementArtifactBytes(`mixed-out-${index}`));
      dispatchInbound(countCase.channel, placementArtifactBytes(`mixed-in-${index}`));
    }
    await assert.rejects(
      countCase.transport.publish(placementArtifactBytes("mixed-count-overflow")),
      (error) => error.code === "RELAY_LIMIT"
    );
    assert.equal(countCase.channel.sendCalls, half);
    assert.equal((await countCase.transport.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
  } finally {
    countCase.transport.close();
    countCase.restore();
  }

  const byteCase = await openFakeTransport("mixed-bytes");
  try {
    const half = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes / 2;
    for (let index = 0; index < half; index += 1) {
      await byteCase.transport.publish(exactSizedPlacementArtifactBytes(
        `mixout-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      ));
      dispatchInbound(byteCase.channel, exactSizedPlacementArtifactBytes(
        `mixin-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      ));
    }
    await assert.rejects(
      byteCase.transport.publish(placementArtifactBytes("mixed-byte-overflow")),
      (error) => error.code === "RELAY_LIMIT"
    );
    assert.equal(byteCase.channel.sendCalls, half);
    assert.equal((await byteCase.transport.fetchRange(
      RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes - 1
    )).length, 1);
  } finally {
    byteCase.transport.close();
    byteCase.restore();
  }
});

test("WebRTC terminal cleanup closes captured channel and peer capabilities at most once", async () => {
  const remoteChannel = await openFakeTransport("cleanup-remote-channel");
  try {
    remoteChannel.channel.readyState = "closed";
    remoteChannel.channel.dispatchEvent(new Event("close"));
    assert.equal(remoteChannel.transport.state, "closed");
    assert.equal(remoteChannel.channel.closeCalls, 0);
    assert.equal(remoteChannel.connection.closeCalls, 1);
    remoteChannel.transport.close();
    remoteChannel.channel.dispatchEvent(new Event("error"));
    remoteChannel.connection.dispatchEvent(new Event("connectionstatechange"));
    assert.equal(remoteChannel.channel.closeCalls, 0);
    assert.equal(remoteChannel.connection.closeCalls, 1);
  } finally {
    remoteChannel.restore();
  }

  const explicit = await openFakeTransport("cleanup-explicit");
  try {
    explicit.transport.close();
    explicit.transport.close();
    explicit.channel.dispatchEvent(new Event("error"));
    assert.equal(explicit.transport.state, "closed");
    assert.equal(explicit.channel.closeCalls, 1);
    assert.equal(explicit.connection.closeCalls, 1);
  } finally {
    explicit.restore();
  }

  const remoteConnection = await openFakeTransport("cleanup-remote-connection");
  try {
    remoteConnection.connection.connectionState = "closed";
    remoteConnection.connection.dispatchEvent(new Event("connectionstatechange"));
    remoteConnection.transport.close();
    assert.equal(remoteConnection.transport.state, "closed");
    assert.equal(remoteConnection.channel.closeCalls, 1);
    assert.equal(remoteConnection.connection.closeCalls, 0);
  } finally {
    remoteConnection.restore();
  }

  const failed = await openFakeTransport("cleanup-error");
  try {
    failed.channel.dispatchEvent(new Event("error"));
    failed.channel.dispatchEvent(new Event("error"));
    failed.transport.close();
    assert.equal(failed.transport.state, "failed");
    assert.equal(failed.channel.closeCalls, 1);
    assert.equal(failed.connection.closeCalls, 1);
  } finally {
    failed.restore();
  }

  const late = await openFakeAcceptedTransport("cleanup-late-channel");
  try {
    late.connection.connectionState = "closed";
    late.connection.dispatchEvent(new Event("connectionstatechange"));
    let closeCalls = 0;
    const lateChannel = new (class extends EventTarget {
      constructor() {
        super();
        this.label = "mortalos-participant-v1";
        this.ordered = true;
        this.readyState = "open";
      }
      close() {
        closeCalls += 1;
        this.readyState = "closed";
      }
      send() {}
    })();
    const dataChannelEvent = new Event("datachannel");
    Object.defineProperty(dataChannelEvent, "channel", { value: lateChannel });
    late.connection.dispatchEvent(dataChannelEvent);
    late.transport.close();
    await assert.rejects(
      late.transport.ready(),
      (error) => error.code === "WEBRTC_CONNECTION_CLOSED"
    );
    assert.equal(late.transport.state, "closed");
    assert.equal(lateChannel.readyState, "closed");
    assert.equal(closeCalls, 1);
    assert.equal(late.connection.closeCalls, 0);
  } finally {
    late.restore();
  }
});

test("WebRTC shutdown and unsubscribe cancel already-scheduled subscriber delivery", async () => {
  const closing = await openFakeTransport("pending-delivery-close");
  try {
    let deliveries = 0;
    closing.transport.subscribe(() => { deliveries += 1; });
    dispatchInbound(closing.channel, placementArtifactBytes("pending-before-close"));
    closing.channel.readyState = "closed";
    closing.channel.dispatchEvent(new Event("close"));
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.equal(deliveries, 0);
    assert.equal(closing.connection.closeCalls, 1);
    assert.throws(
      () => closing.transport.subscribe(() => {}),
      (error) => error.code === "WEBRTC_CONNECTION_CLOSED"
    );
  } finally {
    closing.restore();
  }

  const unsubscribed = await openFakeTransport("pending-delivery-unsubscribe");
  try {
    let deliveries = 0;
    const unsubscribe = unsubscribed.transport.subscribe(() => { deliveries += 1; });
    dispatchInbound(unsubscribed.channel, placementArtifactBytes("pending-before-unsubscribe"));
    unsubscribe();
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.equal(deliveries, 0);
    unsubscribed.transport.close();
  } finally {
    unsubscribed.restore();
  }
});

test("WebRTC transcript uses captured collection, scheduler, and channel capabilities", () => {
  const childPath = fileURLToPath(new URL("./webrtc-transport-primordials-child.mjs", import.meta.url));
  for (const poisonCase of [
    "artifact-kind-membership",
    "constructors",
    "error-constructor-null",
    "error-has-instance",
    "signal-type",
    "map-get",
    "map-set",
    "map-size",
    "map-values",
    "set-add",
    "set-values",
    "array-push",
    "array-filter",
    "array-iterator",
    "scheduler",
    "channel-send"
  ]) {
    const result = spawnSync(process.execPath, [childPath, poisonCase], {
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true
    });
    assert.equal(result.status, 0, `${poisonCase}: ${result.stderr}\n${result.stdout}`);
    assert.deepEqual(JSON.parse(result.stdout), { case: poisonCase, pass: true });
  }
});
