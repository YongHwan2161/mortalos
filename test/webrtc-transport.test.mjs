import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  createRelayControlMessage,
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
    const { transport } = await ManualWebRtcParticipantTransport.createOffer({ endpointId: "A-direct" });
    const bytes = canonicalBytes(createResourcePlacementArtifactMessage({
      artifactKind: "challenge",
      payloadBytes: canonicalBytes({ value: "owned" }),
      requestId: "ownership-1"
    }));
    const expected = new Uint8Array(bytes);
    const publishing = transport.publish(bytes);
    bytes.fill(0);
    await publishing;
    assert.deepEqual(channel.sent, expected);
    transport.close();
  } finally {
    if (prior === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = prior;
  }
});
