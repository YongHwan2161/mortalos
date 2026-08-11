import assert from "node:assert/strict";
import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  RELAY_CONTROL_FORMAT,
  RELAY_LIMITS,
  RESOURCE_PLACEMENT_ARTIFACT_FORMAT
} from "../src/transport/protocol.mjs";
import {
  encodeWebRtcSignal,
  ManualWebRtcParticipantTransport
} from "../lab/transport/webrtc-peer.mjs";

const poisonCase = process.argv[2];
if (typeof poisonCase !== "string" || poisonCase.length === 0) {
  process.stderr.write("poison case argument required\n");
  process.exit(64);
}
const sdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
const ErrorIntrinsic = Error;
const PromiseIntrinsic = Promise;

function artifactBytes(requestId) {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ requestId }),
    requestId
  }));
}

function rawArtifactBytes(artifactKind, requestId) {
  const content = canonicalBytes({
    artifact_kind: artifactKind,
    format: RESOURCE_PLACEMENT_ARTIFACT_FORMAT,
    payload_base64url: encodeBase64Url(canonicalBytes({ artifactKind, requestId })),
    request_id: requestId
  });
  return canonicalBytes({
    content_base64url: encodeBase64Url(content),
    format: RELAY_CONTROL_FORMAT,
    kind: "resource-placement-artifact"
  });
}

async function openFakeTransport(endpointId = "poison-a") {
  let channel;
  let connection;
  let sendCalls = 0;
  class FakeChannel extends EventTarget {
    constructor() {
      super();
      this.bufferedAmount = 0;
      this.closeCalls = 0;
      this.label = "mortalos-participant-v1";
      this.ordered = true;
      this.readyState = "open";
    }
    close() {
      this.closeCalls += 1;
      this.readyState = "closed";
      this.dispatchEvent(new Event("close"));
    }
    send(value) {
      sendCalls += 1;
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
  const previous = globalThis.RTCPeerConnection;
  globalThis.RTCPeerConnection = FakePeer;
  try {
    const { transport } = await ManualWebRtcParticipantTransport.createOffer({ endpointId });
    return {
      channel,
      connection,
      get sendCalls() { return sendCalls; },
      restore() {
        if (previous === undefined) delete globalThis.RTCPeerConnection;
        else globalThis.RTCPeerConnection = previous;
      },
      transport
    };
  } catch (error) {
    if (previous === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = previous;
    throw error;
  }
}

class BarePeer extends EventTarget {
  constructor() {
    super();
    this.connectionState = "connected";
  }
  close() { this.connectionState = "closed"; }
}

function replaceValue(target, property, value) {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, {
    configurable: true,
    value,
    writable: true
  });
  return () => Object.defineProperty(target, property, descriptor);
}

function replaceDescriptor(target, property, descriptor) {
  const original = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, descriptor);
  return () => Object.defineProperty(target, property, original);
}

async function tick() {
  await new PromiseIntrinsic((resolve) => setTimeout(resolve, 0));
}

async function runConstructorCase() {
  const priorMap = globalThis.Map;
  const priorSet = globalThis.Set;
  const restoreAdd = replaceValue(EventTarget.prototype, "addEventListener", () => {});
  globalThis.Map = class PoisonedMap {
    constructor() { throw new Error("ambient Map constructor used"); }
  };
  globalThis.Set = class PoisonedSet {
    constructor() { throw new Error("ambient Set constructor used"); }
  };
  let transport;
  try {
    transport = new ManualWebRtcParticipantTransport("constructor-case", new BarePeer());
  } finally {
    globalThis.Map = priorMap;
    globalThis.Set = priorSet;
    restoreAdd();
  }
  assert.equal(transport.state, "connecting");
  transport.close();
}

async function runSignalCase() {
  const restore = replaceValue(Set.prototype, "has", () => true);
  let errorCode;
  try {
    encodeWebRtcSignal({ endpoint_id: "signal-a", sdp, type: "bogus" });
  } catch (error) {
    errorCode = error.code;
  } finally {
    restore();
  }
  assert.equal(errorCode, "WEBRTC_SIGNAL_TYPE");
}

async function runArtifactKindMembershipCase() {
  const opened = await openFakeTransport("artifact-kind-a");
  const forbidden = rawArtifactBytes("verdict", "forbidden-verdict");
  const allowed = artifactBytes("allowed-challenge");
  const originalHas = Set.prototype.has;
  let targetedCalls = 0;
  const restore = replaceValue(Set.prototype, "has", function selectiveArtifactKindPoison(value) {
    const isArtifactKindSet = Reflect.apply(originalHas, this, ["announcement"]) &&
      Reflect.apply(originalHas, this, ["liveness-response"]);
    if (isArtifactKindSet && value === "verdict") {
      targetedCalls += 1;
      return true;
    }
    return Reflect.apply(originalHas, this, [value]);
  });
  try {
    await assert.rejects(
      opened.transport.publish(forbidden),
      (error) => error.code === "RELAY_SCHEMA"
    );
    assert.equal(opened.sendCalls, 0);
    assert.deepEqual(await opened.transport.fetchRange(0), []);

    const published = await opened.transport.publish(allowed);
    assert.equal(published.duplicate, false);
    assert.equal(published.frame.sequence, 1);
    assert.equal(opened.sendCalls, 1);
    assert.equal((await opened.transport.fetchRange(0)).length, 1);
    assert.equal(targetedCalls, 0);
  } finally {
    restore();
    opened.transport.close();
    opened.restore();
  }
}

async function runErrorClassificationCase() {
  const opened = await openFakeTransport(`material-${poisonCase}`);
  const explicit = await openFakeTransport(`explicit-${poisonCase}`);
  const retained = [];
  for (let index = 0; index < RELAY_LIMITS.room_messages; index += 1) {
    retained.push(artifactBytes(`material-${index}`));
  }
  const overflow = artifactBytes("material-overflow");
  let deliveries = 0;
  let restorePoison;
  const uncaught = [];
  const onUncaught = (reason) => { uncaught.push(reason); };
  process.on("uncaughtException", onUncaught);
  if (poisonCase === "error-constructor-null") {
    const previous = globalThis.Error;
    globalThis.Error = null;
    restorePoison = () => { globalThis.Error = previous; };
  } else {
    const original = Object.getOwnPropertyDescriptor(ErrorIntrinsic, Symbol.hasInstance);
    Object.defineProperty(ErrorIntrinsic, Symbol.hasInstance, {
      configurable: true,
      value() { throw "poisoned Error.hasInstance"; }
    });
    restorePoison = () => {
      if (original) Object.defineProperty(ErrorIntrinsic, Symbol.hasInstance, original);
      else delete ErrorIntrinsic[Symbol.hasInstance];
    };
  }
  let stateBeforeOverflow;
  let explicitCloseThrew = false;
  try {
    for (let index = 0; index < retained.length; index += 1) {
      opened.channel.dispatchEvent(new MessageEvent("message", { data: retained[index] }));
    }
    opened.channel.dispatchEvent(new MessageEvent("message", { data: retained[0] }));
    stateBeforeOverflow = opened.transport.state;
    opened.transport.subscribe(() => { deliveries += 1; }, {
      startAfter: RELAY_LIMITS.room_messages
    });
    opened.channel.dispatchEvent(new MessageEvent("message", { data: overflow }));
    try {
      explicit.transport.close();
    } catch {
      explicitCloseThrew = true;
    }
    await tick();
    await tick();
  } finally {
    restorePoison();
    process.removeListener("uncaughtException", onUncaught);
  }
  try {
    assert.equal(stateBeforeOverflow, "open");
    assert.equal(opened.transport.state, "failed");
    assert.equal(deliveries, 0);
    assert.equal(uncaught.length, 0);
    assert.equal(explicitCloseThrew, false);
    const last = await opened.transport.fetchRange(RELAY_LIMITS.room_messages - 1);
    assert.equal(last.length, 1);
    assert.equal(last[0].sequence, RELAY_LIMITS.room_messages);
    assert.deepEqual(await opened.transport.fetchRange(RELAY_LIMITS.room_messages), []);
    assert.equal(opened.channel.closeCalls, 1);
    assert.equal(opened.connection.closeCalls, 1);
    assert.equal(explicit.transport.state, "closed");
    assert.equal(explicit.channel.closeCalls, 1);
    assert.equal(explicit.connection.closeCalls, 1);
    opened.transport.close();
    opened.channel.dispatchEvent(new Event("error"));
    explicit.transport.close();
    explicit.channel.dispatchEvent(new Event("error"));
    assert.equal(opened.channel.closeCalls, 1);
    assert.equal(opened.connection.closeCalls, 1);
    assert.equal(explicit.channel.closeCalls, 1);
    assert.equal(explicit.connection.closeCalls, 1);
  } finally {
    opened.transport.close();
    opened.restore();
    explicit.transport.close();
    explicit.restore();
  }
}

async function runTransportCase() {
  const opened = await openFakeTransport();
  const bytes1 = artifactBytes(`poison-${poisonCase}-1`);
  const bytes2 = artifactBytes(`poison-${poisonCase}-2`);
  try {
    if (poisonCase === "map-get" || poisonCase === "map-set" || poisonCase === "map-size") {
      let restore;
      if (poisonCase === "map-get") {
        restore = replaceValue(Map.prototype, "get", () => Object.freeze({ sequence: 99 }));
      } else if (poisonCase === "map-set") {
        restore = replaceValue(Map.prototype, "set", function noOpSet() { return this; });
      } else {
        restore = replaceDescriptor(Map.prototype, "size", {
          configurable: true,
          get: () => 777
        });
      }
      let publishing;
      try {
        publishing = opened.transport.publish(bytes1);
      } finally {
        restore();
      }
      const published = await publishing;
      assert.equal(published.duplicate, false);
      assert.equal(published.frame.sequence, 1);
      assert.equal(opened.sendCalls, 1);
      assert.equal((await opened.transport.fetchRange(0)).length, 1);
      return;
    }

    if (poisonCase === "map-values" || poisonCase === "array-push" || poisonCase === "array-filter") {
      await opened.transport.publish(bytes1);
      const restorers = [];
      if (poisonCase === "map-values") {
        const iteratorPrototype = Object.getPrototypeOf(new Map().values());
        restorers.push(replaceValue(Map.prototype, "values", () => ({ next: () => ({ done: true }) })));
        restorers.push(replaceValue(iteratorPrototype, "next", () => { throw new Error("iterator poison"); }));
      } else if (poisonCase === "array-push") {
        restorers.push(replaceValue(Array.prototype, "push", function noOpPush() { return this.length; }));
      } else {
        restorers.push(replaceValue(Array.prototype, "filter", () => [Object.freeze({ sequence: 777 })]));
      }
      let fetching;
      try {
        fetching = opened.transport.fetchRange(0);
      } finally {
        for (let index = restorers.length - 1; index >= 0; index -= 1) restorers[index]();
      }
      const frames = await fetching;
      assert.equal(frames.length, 1);
      assert.equal(frames[0].sequence, 1);
      return;
    }

    if (poisonCase === "array-iterator") {
      await opened.transport.publish(bytes1);
      const restoreArray = replaceValue(
        Array.prototype,
        Symbol.iterator,
        () => { throw new Error("ambient Array iterator used"); }
      );
      const mapIteratorPrototype = Object.getPrototypeOf(new Map().values());
      const restoreMap = replaceValue(
        mapIteratorPrototype,
        "next",
        () => { throw new Error("ambient Map iterator used"); }
      );
      let fetching;
      try {
        fetching = opened.transport.fetchRange(0);
      } finally {
        restoreMap();
        restoreArray();
      }
      assert.equal((await fetching)[0].sequence, 1);
      return;
    }

    if (poisonCase === "set-add") {
      await opened.transport.publish(bytes1);
      const restore = replaceValue(Set.prototype, "add", function noOpAdd() { return this; });
      let replay;
      try {
        opened.transport.subscribe((frame) => { replay = frame; });
      } finally {
        restore();
      }
      await tick();
      assert.equal(replay.sequence, 1);
      return;
    }

    if (poisonCase === "set-values") {
      let delivered;
      opened.transport.subscribe((frame) => { delivered = frame; }, { startAfter: 0 });
      const iteratorPrototype = Object.getPrototypeOf(new Set().values());
      const restoreKeys = replaceValue(Set.prototype, "keys", () => ({ next: () => ({ done: true }) }));
      const restoreNext = replaceValue(
        iteratorPrototype,
        "next",
        () => { throw new Error("ambient Set iterator used"); }
      );
      const event = new MessageEvent("message", { data: bytes2 });
      try {
        opened.channel.dispatchEvent(event);
      } finally {
        restoreNext();
        restoreKeys();
      }
      await tick();
      assert.equal(delivered.sequence, 1);
      return;
    }

    if (poisonCase === "scheduler") {
      await opened.transport.publish(bytes1);
      const priorQueue = globalThis.queueMicrotask;
      const priorResolve = PromiseIntrinsic.resolve;
      const priorCatch = PromiseIntrinsic.prototype.catch;
      let replay;
      globalThis.queueMicrotask = () => {};
      PromiseIntrinsic.resolve = () => new PromiseIntrinsic(() => {});
      PromiseIntrinsic.prototype.catch = () => new PromiseIntrinsic(() => {});
      try {
        opened.transport.subscribe((frame) => { replay = frame; });
      } finally {
        globalThis.queueMicrotask = priorQueue;
        PromiseIntrinsic.resolve = priorResolve;
        PromiseIntrinsic.prototype.catch = priorCatch;
      }
      await tick();
      assert.equal(replay.sequence, 1);
      return;
    }

    if (poisonCase === "channel-send") {
      let replacementCalls = 0;
      opened.channel.send = () => { replacementCalls += 1; };
      const published = await opened.transport.publish(bytes1);
      assert.equal(published.duplicate, false);
      assert.equal(opened.sendCalls, 1);
      assert.equal(replacementCalls, 0);
      assert.equal((await opened.transport.fetchRange(0)).length, 1);
      return;
    }

    assert.fail(`unknown poison case: ${poisonCase}`);
  } finally {
    opened.transport.close();
    opened.restore();
  }
}

if (poisonCase === "constructors") await runConstructorCase();
else if (poisonCase === "artifact-kind-membership") await runArtifactKindMembershipCase();
else if (poisonCase === "signal-type") await runSignalCase();
else if (poisonCase === "error-constructor-null" || poisonCase === "error-has-instance") {
  await runErrorClassificationCase();
}
else await runTransportCase();

process.stdout.write(JSON.stringify({ case: poisonCase, pass: true }));
