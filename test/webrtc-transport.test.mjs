import assert from "node:assert/strict";
import test from "node:test";
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
  assert.throws(
    () => decodeWebRtcSignal(`${signal.slice(0, -1)},"unknown":true}`),
    (error) => ["WEBRTC_SIGNAL_NONCANONICAL", "WEBRTC_SIGNAL_SCHEMA"].includes(error.code)
  );
  assert.throws(
    () => decodeWebRtcSignal(signal, "answer"),
    (error) => error.code === "WEBRTC_SIGNAL_TYPE"
  );
  assert.throws(
    () => encodeWebRtcSignal({ endpoint_id: "bad endpoint", sdp, type: "offer" }),
    (error) => error.code === "WEBRTC_ENDPOINT"
  );
  assert.throws(
    () => encodeWebRtcSignal({ endpoint_id: "A", sdp: `v=0\r\n${"x".repeat(25_000)}`, type: "offer" }),
    (error) => error.code === "WEBRTC_SIGNAL_SDP"
  );
});

test("direct transport has no implicit network fallback outside a browser", async () => {
  await assert.rejects(
    ManualWebRtcParticipantTransport.createOffer({ endpointId: "A-direct" }),
    (error) => error.code === "WEBRTC_UNAVAILABLE"
  );
});
