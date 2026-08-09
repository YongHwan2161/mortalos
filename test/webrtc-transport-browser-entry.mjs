import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  RELAY_CONTROL_FORMAT,
  RESOURCE_PLACEMENT_ARTIFACT_FORMAT
} from "../src/transport/protocol.mjs";
import { ManualWebRtcParticipantTransport } from "../lab/transport/webrtc-peer.mjs";

const assert = Object.freeze({
  deepEqual(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  },
  equal(actual, expected) {
    if (actual !== expected) throw new Error(`expected ${expected}, received ${actual}`);
  }
});

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

function nextFrame(transport, startAfter) {
  let unsubscribe;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WEBRTC_PRIMORDIAL_TIMEOUT")), 5_000);
    unsubscribe = transport.subscribe((frame) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(frame);
    }, { startAfter });
  });
}

async function connectedPair() {
  const offered = await ManualWebRtcParticipantTransport.createOffer({ endpointId: "primordial-a" });
  const accepted = await ManualWebRtcParticipantTransport.acceptOffer({
    endpointId: "primordial-b",
    offer: offered.signal
  });
  await offered.transport.complete(accepted.signal);
  await Promise.all([offered.transport.ready(), accepted.transport.ready()]);
  return { left: offered.transport, right: accepted.transport };
}

export async function runWebRtcPrimordialBrowserProbe() {
  const { left, right } = await connectedPair();
  const forbiddenBytes = rawArtifactBytes("verdict", "browser-forbidden-verdict");
  const firstBytes = artifactBytes("browser-channel-send");
  const secondBytes = artifactBytes("browser-map-transcript");
  const thirdBytes = artifactBytes("browser-set-delivery");
  let bareTransport;
  let extraTransport;
  try {
    let forbiddenDeliveries = 0;
    const unsubscribeForbiddenAudit = right.subscribe(() => {
      forbiddenDeliveries += 1;
    });
    let ordinaryVerdictCode;
    try {
      await left.publish(forbiddenBytes);
    } catch (error) {
      ordinaryVerdictCode = error.code;
    }
    assert.equal(ordinaryVerdictCode, "RELAY_SCHEMA");
    assert.equal((await left.fetchRange(0)).length, 0);
    assert.equal((await right.fetchRange(0)).length, 0);
    assert.equal(forbiddenDeliveries, 0);

    const artifactKindSetPrototype = Set.prototype;
    const originalSetHas = artifactKindSetPrototype.has;
    let artifactKindPoisonCalls = 0;
    const restoreArtifactKindHas = replaceValue(
      artifactKindSetPrototype,
      "has",
      function selectiveArtifactKindPoison(value) {
        const isArtifactKindSet = Reflect.apply(originalSetHas, this, ["announcement"]) &&
          Reflect.apply(originalSetHas, this, ["liveness-response"]);
        if (isArtifactKindSet && value === "verdict") {
          artifactKindPoisonCalls += 1;
          return true;
        }
        return Reflect.apply(originalSetHas, this, [value]);
      }
    );
    let poisonedVerdictCode;
    let forbiddenLocalFrames;
    let forbiddenRemoteFrames;
    let firstPublished;
    let firstRemote;
    let channelPoisonCalls = 0;
    try {
      try {
        await left.publish(forbiddenBytes);
      } catch (error) {
        poisonedVerdictCode = error.code;
      }
      forbiddenLocalFrames = (await left.fetchRange(0)).length;
      forbiddenRemoteFrames = (await right.fetchRange(0)).length;
      assert.equal(forbiddenDeliveries, 0);

      const dataChannelPrototype = RTCDataChannel.prototype;
      const firstRemotePromise = nextFrame(right, 0);
      const restoreSend = replaceValue(dataChannelPrototype, "send", () => {
        channelPoisonCalls += 1;
      });
      try {
        firstPublished = await left.publish(firstBytes);
      } finally {
        restoreSend();
      }
      firstRemote = await firstRemotePromise;
    } finally {
      restoreArtifactKindHas();
    }
    assert.equal(poisonedVerdictCode, "RELAY_SCHEMA");
    assert.equal(forbiddenLocalFrames, 0);
    assert.equal(forbiddenRemoteFrames, 0);
    assert.equal(forbiddenDeliveries, 1);
    assert.equal(artifactKindPoisonCalls, 0);
    unsubscribeForbiddenAudit();

    assert.equal(channelPoisonCalls, 0);
    assert.equal(firstPublished.frame.message_id, firstRemote.message_id);
    assert.equal(firstRemote.sequence, 1);

    const mapPrototype = Map.prototype;
    const mapIteratorPrototype = Object.getPrototypeOf(new Map().values());
    const priorMap = globalThis.Map;
    let mapPoisonCalls = 0;
    const restoreMapGet = replaceValue(mapPrototype, "get", () => {
      mapPoisonCalls += 1;
      return Object.freeze({ sequence: 99 });
    });
    const restoreMapHas = replaceValue(mapPrototype, "has", () => {
      mapPoisonCalls += 1;
      return true;
    });
    const restoreMapSet = replaceValue(mapPrototype, "set", function poisonedSet() {
      mapPoisonCalls += 1;
      return this;
    });
    const restoreMapValues = replaceValue(mapPrototype, "values", () => {
      mapPoisonCalls += 1;
      return { next: () => ({ done: true }) };
    });
    const restoreMapSize = replaceDescriptor(mapPrototype, "size", {
      configurable: true,
      get() {
        mapPoisonCalls += 1;
        return 777;
      }
    });
    const restoreMapNext = replaceValue(mapIteratorPrototype, "next", () => {
      mapPoisonCalls += 1;
      throw new Error("ambient Map iterator used");
    });
    const secondRemotePromise = nextFrame(right, 1);
    let secondPublished;
    let secondDuplicate;
    let mapFrames;
    globalThis.Map = class PoisonedMap {
      constructor() {
        mapPoisonCalls += 1;
        throw new Error("ambient Map constructor used");
      }
    };
    try {
      secondPublished = await left.publish(secondBytes);
      secondDuplicate = await left.publish(secondBytes);
      mapFrames = await left.fetchRange(0);
      await secondRemotePromise;
    } finally {
      globalThis.Map = priorMap;
      restoreMapNext();
      restoreMapSize();
      restoreMapValues();
      restoreMapSet();
      restoreMapHas();
      restoreMapGet();
    }
    assert.equal(mapPoisonCalls, 0);
    assert.equal(secondPublished.duplicate, false);
    assert.equal(secondDuplicate.duplicate, true);
    assert.equal(mapFrames.length, 2);

    const setPrototype = Set.prototype;
    const setIteratorPrototype = Object.getPrototypeOf(new Set().values());
    let setIteratorPoisonCalls = 0;
    const restoreSetKeys = replaceValue(setPrototype, "keys", () => {
      setIteratorPoisonCalls += 1;
      return { next: () => ({ done: true }) };
    });
    const restoreSetIterator = replaceValue(setPrototype, Symbol.iterator, () => {
      setIteratorPoisonCalls += 1;
      return { next: () => ({ done: true }) };
    });
    const restoreSetNext = replaceValue(setIteratorPrototype, "next", () => {
      setIteratorPoisonCalls += 1;
      throw new Error("ambient Set iterator used");
    });
    const thirdRemotePromise = nextFrame(right, 2);
    let thirdPublished;
    try {
      thirdPublished = await left.publish(thirdBytes);
      await thirdRemotePromise;
    } finally {
      restoreSetNext();
      restoreSetIterator();
      restoreSetKeys();
    }
    assert.equal(setIteratorPoisonCalls, 0);
    assert.equal(thirdPublished.frame.sequence, 3);

    let setMutationPoisonCalls = 0;
    const restoreSetAdd = replaceValue(setPrototype, "add", function poisonedAdd() {
      setMutationPoisonCalls += 1;
      return this;
    });
    const restoreSetDelete = replaceValue(setPrototype, "delete", () => {
      setMutationPoisonCalls += 1;
      return false;
    });
    let replayFrame;
    let replayUnsubscribe;
    try {
      replayUnsubscribe = left.subscribe((frame) => { replayFrame = frame; }, { startAfter: 2 });
      await new Promise((resolve) => queueMicrotask(resolve));
      replayUnsubscribe();
    } finally {
      restoreSetDelete();
      restoreSetAdd();
    }
    assert.equal(setMutationPoisonCalls, 0);
    assert.equal(replayFrame.sequence, 3);

    let arrayPoisonCalls = 0;
    const restoreArrayPush = replaceValue(Array.prototype, "push", function poisonedPush() {
      arrayPoisonCalls += 1;
      return this.length;
    });
    const restoreArrayFilter = replaceValue(Array.prototype, "filter", () => {
      arrayPoisonCalls += 1;
      return [Object.freeze({ sequence: 777 })];
    });
    const restoreArrayMap = replaceValue(Array.prototype, "map", () => {
      arrayPoisonCalls += 1;
      return [];
    });
    const restoreArraySlice = replaceValue(Array.prototype, "slice", () => {
      arrayPoisonCalls += 1;
      return [];
    });
    const restoreArraySort = replaceValue(Array.prototype, "sort", () => {
      arrayPoisonCalls += 1;
      return [];
    });
    const restoreArrayIterator = replaceValue(Array.prototype, Symbol.iterator, () => {
      arrayPoisonCalls += 1;
      throw new Error("ambient Array iterator used");
    });
    let arrayFramesPromise;
    let presencePromise;
    try {
      arrayFramesPromise = left.fetchRange(0);
      presencePromise = left.presence();
    } finally {
      restoreArrayIterator();
      restoreArraySort();
      restoreArraySlice();
      restoreArrayMap();
      restoreArrayFilter();
      restoreArrayPush();
    }
    const arrayFrames = await arrayFramesPromise;
    const presence = await presencePromise;
    assert.equal(arrayPoisonCalls, 0);
    assert.equal(arrayFrames.length, 3);
    assert.deepEqual(presence, ["primordial-a", "primordial-b"]);

    let scheduledReplay;
    let scheduledReplayResolve;
    const scheduledReplayPromise = new Promise((resolve) => { scheduledReplayResolve = resolve; });
    const priorQueueMicrotask = globalThis.queueMicrotask;
    const priorPromiseResolve = Promise.resolve;
    const priorPromiseThen = Promise.prototype.then;
    const priorPromiseCatch = Promise.prototype.catch;
    let schedulerPoisonCalls = 0;
    globalThis.queueMicrotask = () => { schedulerPoisonCalls += 1; };
    Promise.resolve = () => { schedulerPoisonCalls += 1; return new Promise(() => {}); };
    Promise.prototype.then = () => { schedulerPoisonCalls += 1; return new Promise(() => {}); };
    Promise.prototype.catch = () => { schedulerPoisonCalls += 1; return new Promise(() => {}); };
    let schedulerUnsubscribe;
    try {
      schedulerUnsubscribe = left.subscribe((frame) => {
        scheduledReplay = frame;
        scheduledReplayResolve(frame);
      }, { startAfter: 2 });
    } finally {
      globalThis.queueMicrotask = priorQueueMicrotask;
      Promise.resolve = priorPromiseResolve;
      Promise.prototype.then = priorPromiseThen;
      Promise.prototype.catch = priorPromiseCatch;
    }
    await scheduledReplayPromise;
    schedulerUnsubscribe();
    assert.equal(schedulerPoisonCalls, 0);
    assert.equal(scheduledReplay.sequence, 3);

    const bareConnection = new RTCPeerConnection({ iceServers: [] });
    const priorMapConstructor = globalThis.Map;
    const priorSetConstructor = globalThis.Set;
    let constructorPoisonCalls = 0;
    const restoreEventAdd = replaceValue(EventTarget.prototype, "addEventListener", () => {
      constructorPoisonCalls += 1;
    });
    const restorePeerClose = replaceValue(RTCPeerConnection.prototype, "close", () => {
      constructorPoisonCalls += 1;
    });
    globalThis.Map = class PoisonedMap {
      constructor() { constructorPoisonCalls += 1; throw new Error("ambient Map used"); }
    };
    globalThis.Set = class PoisonedSet {
      constructor() { constructorPoisonCalls += 1; throw new Error("ambient Set used"); }
    };
    try {
      bareTransport = new ManualWebRtcParticipantTransport("browser-bare", bareConnection);
      bareTransport.close();
    } finally {
      globalThis.Map = priorMapConstructor;
      globalThis.Set = priorSetConstructor;
      restorePeerClose();
      restoreEventAdd();
    }
    assert.equal(constructorPoisonCalls, 0);
    assert.equal(bareTransport.state, "closed");

    const peerPrototype = RTCPeerConnection.prototype;
    const priorPeerConstructor = globalThis.RTCPeerConnection;
    let peerPoisonCalls = 0;
    const restoreCreateChannel = replaceValue(peerPrototype, "createDataChannel", () => {
      peerPoisonCalls += 1;
      throw new Error("ambient createDataChannel used");
    });
    const restoreCreateOffer = replaceValue(peerPrototype, "createOffer", () => {
      peerPoisonCalls += 1;
      throw new Error("ambient createOffer used");
    });
    const restoreSetLocal = replaceValue(peerPrototype, "setLocalDescription", () => {
      peerPoisonCalls += 1;
      throw new Error("ambient setLocalDescription used");
    });
    globalThis.RTCPeerConnection = class PoisonedPeerConnection {
      constructor() { peerPoisonCalls += 1; throw new Error("ambient peer constructor used"); }
    };
    try {
      const extra = await ManualWebRtcParticipantTransport.createOffer({ endpointId: "captured-peer" });
      extraTransport = extra.transport;
      extraTransport.close();
    } finally {
      globalThis.RTCPeerConnection = priorPeerConstructor;
      restoreSetLocal();
      restoreCreateOffer();
      restoreCreateChannel();
    }
    assert.equal(peerPoisonCalls, 0);

    return Object.freeze({
      artifact_kind_poison_calls: artifactKindPoisonCalls,
      array_frames: arrayFrames.length,
      channel_poison_calls: channelPoisonCalls,
      constructor_poison_calls: constructorPoisonCalls,
      forbidden_local_frames: forbiddenLocalFrames,
      forbidden_remote_frames: forbiddenRemoteFrames,
      map_poison_calls: mapPoisonCalls,
      peer_poison_calls: peerPoisonCalls,
      remote_frames: (await right.fetchRange(0)).length,
      scheduler_poison_calls: schedulerPoisonCalls,
      set_poison_calls: setIteratorPoisonCalls + setMutationPoisonCalls
    });
  } finally {
    extraTransport?.close();
    bareTransport?.close();
    left.close();
    right.close();
  }
}
