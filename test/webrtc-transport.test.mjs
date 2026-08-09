import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  createRelayControlMessage,
  decodeRelayFrame,
  decodeRelayMessageBytes,
  openResourcePlacementArtifact
} from "../src/transport/protocol.mjs";
import {
  decodeWebRtcSignal,
  encodeWebRtcSignal,
  ManualWebRtcParticipantTransport,
  WEBRTC_SIGNAL_FORMAT
} from "../lab/transport/webrtc-peer.mjs";

const sdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";

async function openFakeTransport(endpointId = "A-direct") {
  let channel;
  class FakeChannel extends EventTarget {
    constructor() {
      super();
      this.bufferedAmount = 0;
      this.label = "mortalos-participant-v1";
      this.ordered = true;
      this.readyState = "open";
    }
    close() { this.readyState = "closed"; }
    send(value) { this.sent = new Uint8Array(value); }
  }
  class FakePeer extends EventTarget {
    constructor() {
      super();
      this.connectionState = "connected";
      this.iceGatheringState = "complete";
      this.localDescription = null;
      this.remoteDescription = null;
    }
    createDataChannel() { channel = new FakeChannel(); return channel; }
    async createOffer() { return { sdp, type: "offer" }; }
    async setLocalDescription(value) { this.localDescription = value; }
    close() { this.connectionState = "closed"; }
  }
  const prior = globalThis.RTCPeerConnection;
  globalThis.RTCPeerConnection = FakePeer;
  try {
    const { transport } = await ManualWebRtcParticipantTransport.createOffer({ endpointId });
    return {
      channel,
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

function placementArtifactBytes(requestId = "ownership-1") {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ value: "owned" }),
    requestId
  }));
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
