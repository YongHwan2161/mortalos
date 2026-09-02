import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage,
  RELAY_CONTROL_FORMAT,
  RELAY_LIMITS,
  RESOURCE_PLACEMENT_ARTIFACT_FORMAT
} from "../src/transport/protocol.mjs";
import {
  decodeWebRtcSignal,
  encodeWebRtcSignal,
  ManualWebRtcParticipantTransport
} from "../lab/transport/webrtc-peer.mjs";

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

const exactPaddingLengths = new Map();

function paddedArtifactBytes(marker, paddingLength, requestId = "browser-byte-boundary") {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ marker, padding: "x".repeat(paddingLength) }),
    requestId
  }));
}

function exactSizedArtifactBytes(marker, targetBytes, requestId = "browser-byte-boundary") {
  const cacheKey = `${requestId}:${marker.length}:${targetBytes}`;
  let paddingLength = exactPaddingLengths.get(cacheKey);
  if (paddingLength === undefined) {
    let low = 0;
    let high = targetBytes;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (paddedArtifactBytes(marker, middle, requestId).byteLength < targetBytes) low = middle + 1;
      else high = middle - 1;
    }
    paddingLength = -1;
    for (let candidate = Math.max(0, low - 4); candidate <= low + 4; candidate += 1) {
      if (paddedArtifactBytes(marker, candidate, requestId).byteLength === targetBytes) {
        paddingLength = candidate;
        break;
      }
    }
    if (paddingLength === -1) throw new Error(`no canonical relay message has ${targetBytes} bytes`);
    exactPaddingLengths.set(cacheKey, paddingLength);
  }
  const bytes = paddedArtifactBytes(marker, paddingLength, requestId);
  assert.equal(bytes.byteLength, targetBytes);
  return bytes;
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

function waitForState(readState, expected, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      if (readState() === expected) {
        resolve();
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        reject(new Error(`timed out waiting for ${expected}; received ${readState()}`));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

function assertSelectedRoutes(selectedRoutes) {
  assert.deepEqual(selectedRoutes.map((entry) => entry.path_class), ["host", "host"]);
  assert.equal(
    /address|candidateId|iceServers|port|protocol|sdp|url|username/iu.test(
      JSON.stringify(selectedRoutes)
    ),
    false
  );
}

export async function runWebRtcSelectedRouteBrowserProbe() {
  const { left, right } = await connectedPair();
  try {
    const selectedRoutes = await Promise.all([left.selectedRoute(), right.selectedRoute()]);
    assertSelectedRoutes(selectedRoutes);
    return Object.freeze({
      non_authority: selectedRoutes.every((entry) => entry.non_authority === true),
      selected_route_classes: selectedRoutes.map((entry) => entry.path_class)
    });
  } finally {
    left.close();
    right.close();
  }
}

function waitForIce(connection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RAW_WEBRTC_ICE_TIMEOUT")), 10_000);
    const changed = () => {
      if (connection.iceGatheringState !== "complete") return;
      clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", changed);
      resolve();
    };
    connection.addEventListener("icegatheringstatechange", changed);
  });
}

function waitForRawChannel(channel) {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RAW_WEBRTC_OPEN_TIMEOUT")), 15_000);
    channel.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function rawSenderPair() {
  const connection = new RTCPeerConnection({ iceServers: [] });
  const channel = connection.createDataChannel("mortalos-participant-v1", {
    negotiated: false,
    ordered: true
  });
  await connection.setLocalDescription(await connection.createOffer());
  await waitForIce(connection);
  const accepted = await ManualWebRtcParticipantTransport.acceptOffer({
    endpointId: "raw-receiver",
    offer: encodeWebRtcSignal({
      endpoint_id: "raw-sender",
      sdp: connection.localDescription.sdp,
      type: "offer"
    })
  });
  const answer = decodeWebRtcSignal(accepted.signal, "answer");
  await connection.setRemoteDescription({ sdp: answer.sdp, type: "answer" });
  await Promise.all([accepted.transport.ready(), waitForRawChannel(channel)]);
  return { channel, connection, receiver: accepted.transport };
}

async function sendAndObserve(sender, receiver, bytes, startAfter) {
  const received = nextFrame(receiver, startAfter);
  const published = await sender.publish(bytes);
  const remoteFrame = await received;
  assert.equal(remoteFrame.sequence, startAfter + 1);
  assert.equal(remoteFrame.message_id, published.frame.message_id);
}

async function rawSendAndObserve(channel, receiver, bytes, startAfter) {
  const received = nextFrame(receiver, startAfter);
  channel.send(bytes);
  const remoteFrame = await received;
  assert.equal(remoteFrame.sequence, startAfter + 1);
}

async function runGeneratedBoundaryProbe() {
  const closeStart = globalThis.__MORTALOS_RTC_CLOSE_TOTAL__;
  const closeStateStart = globalThis.__MORTALOS_RTC_CLOSE_STATES__.length;
  let remotePeerCloseCalls;
  let remotePeerConnectionState;
  const countPair = await connectedPair();
  try {
    let firstBytes;
    for (let index = 0; index < RELAY_LIMITS.room_messages; index += 1) {
      const bytes = artifactBytes(`browser-count-${index}`);
      firstBytes ??= bytes;
      await sendAndObserve(countPair.left, countPair.right, bytes, index);
    }
    assert.equal((await countPair.left.publish(firstBytes)).duplicate, true);
    let overflowCode;
    try {
      await countPair.left.publish(artifactBytes("browser-count-overflow"));
    } catch (error) {
      overflowCode = error.code;
    }
    assert.equal(overflowCode, "RELAY_LIMIT");
    assert.equal((await countPair.right.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
    countPair.left.close();
    await waitForState(() => globalThis.__MORTALOS_RTC_CLOSE_TOTAL__, closeStart + 2);
    assert.equal(countPair.left.state, "closed");
    assert.deepEqual(
      globalThis.__MORTALOS_RTC_CLOSE_STATES__.slice(closeStateStart),
      ["closed", "closed"]
    );
    countPair.left.close();
    countPair.right.close();
    countPair.right.close();
    assert.equal(globalThis.__MORTALOS_RTC_CLOSE_TOTAL__, closeStart + 2);
    remotePeerCloseCalls = globalThis.__MORTALOS_RTC_CLOSE_TOTAL__ - closeStart - 1;
    remotePeerConnectionState = globalThis.__MORTALOS_RTC_CLOSE_STATES__[closeStateStart + 1];
  } finally {
    countPair.left.close();
    countPair.right.close();
  }

  const bytePair = await connectedPair();
  try {
    const fullMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes - 1;
    let firstBytes;
    for (let index = 0; index < fullMessages; index += 1) {
      const bytes = exactSizedArtifactBytes(
        `browser-byte-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      );
      firstBytes ??= bytes;
      await sendAndObserve(bytePair.left, bytePair.right, bytes, index);
    }
    const remainder = exactSizedArtifactBytes(
      "r",
      RELAY_LIMITS.message_bytes - 399,
      "bb"
    );
    await sendAndObserve(bytePair.left, bytePair.right, remainder, fullMessages);
    assert.equal((await bytePair.left.publish(firstBytes)).duplicate, true);
    let overflowCode;
    try {
      await bytePair.left.publish(exactSizedArtifactBytes("o", 400, "bb"));
    } catch (error) {
      overflowCode = error.code;
    }
    assert.equal(overflowCode, "RELAY_LIMIT");
    assert.equal((await bytePair.right.fetchRange(fullMessages)).length, 1);
    await sendAndObserve(
      bytePair.left,
      bytePair.right,
      exactSizedArtifactBytes("f", 399, "c"),
      fullMessages + 1
    );
    assert.equal((await bytePair.right.fetchRange(fullMessages + 1)).length, 1);
  } finally {
    bytePair.left.close();
    bytePair.right.close();
  }

  const rawCount = await rawSenderPair();
  try {
    const firstBytes = artifactBytes("raw-count-0");
    await rawSendAndObserve(rawCount.channel, rawCount.receiver, firstBytes, 0);
    rawCount.channel.send(firstBytes);
    for (let index = 1; index < RELAY_LIMITS.room_messages; index += 1) {
      const bytes = artifactBytes(`raw-count-${index}`);
      await rawSendAndObserve(rawCount.channel, rawCount.receiver, bytes, index);
    }
    assert.equal(rawCount.receiver.state, "open");
    rawCount.channel.send(artifactBytes("raw-count-overflow"));
    await waitForState(() => rawCount.receiver.state, "failed");
    assert.equal((await rawCount.receiver.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
  } finally {
    rawCount.receiver.close();
    rawCount.channel.close();
    rawCount.connection.close();
  }

  const rawBytes = await rawSenderPair();
  try {
    const fullMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes - 1;
    const firstBytes = exactSizedArtifactBytes("raw-byte-000", RELAY_LIMITS.message_bytes);
    await rawSendAndObserve(rawBytes.channel, rawBytes.receiver, firstBytes, 0);
    rawBytes.channel.send(firstBytes);
    for (let index = 1; index < fullMessages; index += 1) {
      const bytes = exactSizedArtifactBytes(
        `raw-byte-${String(index).padStart(3, "0")}`,
        RELAY_LIMITS.message_bytes
      );
      await rawSendAndObserve(rawBytes.channel, rawBytes.receiver, bytes, index);
    }
    await rawSendAndObserve(
      rawBytes.channel,
      rawBytes.receiver,
      exactSizedArtifactBytes("r", RELAY_LIMITS.message_bytes - 399, "bb"),
      fullMessages
    );
    assert.equal(rawBytes.receiver.state, "open");
    rawBytes.channel.send(exactSizedArtifactBytes("o", 400, "bb"));
    await waitForState(() => rawBytes.receiver.state, "failed");
    assert.equal((await rawBytes.receiver.fetchRange(fullMessages)).length, 1);
  } finally {
    rawBytes.receiver.close();
    rawBytes.channel.close();
    rawBytes.connection.close();
  }

  return Object.freeze({
    inbound_rejected_bytes: RELAY_LIMITS.room_bytes + 1,
    inbound_retained_bytes: RELAY_LIMITS.room_bytes - 399,
    inbound_messages: RELAY_LIMITS.room_messages,
    outbound_rejected_bytes: RELAY_LIMITS.room_bytes + 1,
    outbound_retained_bytes: RELAY_LIMITS.room_bytes,
    outbound_messages: RELAY_LIMITS.room_messages,
    remote_peer_close_calls: remotePeerCloseCalls,
    remote_peer_connection_state: remotePeerConnectionState
  });
}

export async function runWebRtcPrimordialBrowserProbe() {
  const { left, right } = await connectedPair();
  const selectedRoutes = await Promise.all([left.selectedRoute(), right.selectedRoute()]);
  assertSelectedRoutes(selectedRoutes);
  const forbiddenBytes = rawArtifactBytes("verdict", "browser-forbidden-verdict");
  const firstBytes = artifactBytes("browser-channel-send");
  const secondBytes = artifactBytes("browser-map-transcript");
  const thirdBytes = artifactBytes("browser-set-delivery");
  let bareTransport;
  let configuredTransport;
  let extraTransport;
  try {
    const configured = await ManualWebRtcParticipantTransport.createOffer({
      endpointId: "browser-relay-config",
      iceConfiguration: {
        iceServers: [],
        iceTransportPolicy: "relay"
      }
    });
    configuredTransport = configured.transport;
    assert.equal(configured.signal.includes("iceServers"), false);
    assert.equal(configured.signal.includes("iceTransportPolicy"), false);

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

    const generatedBoundaries = await runGeneratedBoundaryProbe();

    return Object.freeze({
      artifact_kind_poison_calls: artifactKindPoisonCalls,
      array_frames: arrayFrames.length,
      bounded_ice_configuration: true,
      channel_poison_calls: channelPoisonCalls,
      constructor_poison_calls: constructorPoisonCalls,
      generated_boundaries: generatedBoundaries,
      selected_route_classes: selectedRoutes.map((entry) => entry.path_class),
      forbidden_local_frames: forbiddenLocalFrames,
      forbidden_remote_frames: forbiddenRemoteFrames,
      map_poison_calls: mapPoisonCalls,
      peer_poison_calls: peerPoisonCalls,
      remote_frames: (await right.fetchRange(0)).length,
      scheduler_poison_calls: schedulerPoisonCalls,
      set_poison_calls: setIteratorPoisonCalls + setMutationPoisonCalls
    });
  } finally {
    configuredTransport?.close();
    extraTransport?.close();
    bareTransport?.close();
    left.close();
    right.close();
  }
}
