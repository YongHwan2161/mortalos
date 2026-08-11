import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalBytes } from "../src/index.mjs";
import {
  createStatePackage,
  createStatePackageInput,
  deterministicReferenceResource,
  statePackageChunkDigest
} from "../src/state/package.mjs";
import {
  MemoryContentAddressedStore,
  recoverStatePackage
} from "../src/state/recovery.mjs";
import {
  publishStateChunk,
  publishStatePackageChunks,
  RelayChunkRecoveryAdapter
} from "../src/transport/chunk-data-plane.mjs";
import {
  createResourcePlacementArtifactMessage,
  createRelayFrame,
  createRelayControlMessage,
  createRelayMessage,
  decodeRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../src/transport/protocol.mjs";
import { runTransportScheduleCorpus } from "../src/transport/corpus.mjs";
import { TransportReplica } from "../lab/transport/replica.mjs";
import { VirtualTransportNetwork } from "../lab/transport/virtual-transport.mjs";

const ROOM = "AAAAAAAAAAAAAAAAAAAAAA";
const lifecycle = JSON.parse(await readFile(new URL("./vectors/lifecycle.json", import.meta.url), "utf8"));
const fork = JSON.parse(await readFile(new URL("./vectors/fork.json", import.meta.url), "utf8"));

function message(record) {
  return canonicalBytes(createRelayMessage(record));
}

const exactPaddingLengths = new Map();

function placementArtifactBytes(requestId) {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ requestId }),
    requestId
  }));
}

function paddedPlacementArtifactBytes(marker, paddingLength) {
  return canonicalBytes(createResourcePlacementArtifactMessage({
    artifactKind: "challenge",
    payloadBytes: canonicalBytes({ marker, padding: "x".repeat(paddingLength) }),
    requestId: "virtual-byte-boundary"
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

async function publishRecords(network, records) {
  const source = network.endpoint(ROOM, "source");
  const frames = [];
  for (const record of records) frames.push((await source.publish(message(record))).frame);
  return { frames, source };
}

test("relay message and frame contracts reject authority hints, noncanonical bytes, and digest mutation", () => {
  const bytes = message({ envelope: lifecycle.birth, payload: {} });
  const opened = decodeRelayMessageBytes(bytes);
  assert.equal(opened.record.envelope.kind, "mortalos.genesis");
  assert.match(opened.message_id, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.throws(
    () => decodeRelayMessageBytes(canonicalBytes({ ...opened.message, accepted: true })),
    (error) => error.code === "RELAY_SCHEMA"
  );
  assert.throws(() => decodeRelayMessageBytes(new TextEncoder().encode(` ${new TextDecoder().decode(bytes)}`)));
  const frame = createRelayFrame(1, bytes);
  assert.equal(decodeRelayFrame(frame).message_id, opened.message_id);
  assert.throws(
    () => decodeRelayFrame({ ...frame, message_id: `sha256:${"A".repeat(43)}` }),
    (error) => error.code === "RELAY_DIGEST"
  );
  assert.throws(() => decodeRelayMessageBytes(new Uint8Array(RELAY_LIMITS.message_bytes + 1)));
});

test("relay control carries resource consumption announcements without deciding validity", () => {
  const announcement = {
    format: "mortalos-resource-consumption-announcement/1",
    lease: { transported: true },
    offer: { transported: true },
    witness: { transported: true }
  };
  const messageBytes = canonicalBytes(createRelayControlMessage(
    "resource-consumption-announcement",
    announcement
  ));
  const opened = decodeRelayMessageBytes(messageBytes);
  assert.equal(opened.control.kind, "resource-consumption-announcement");
  assert.deepEqual(
    canonicalBytes(opened.control.content),
    canonicalBytes(announcement)
  );
  assert.throws(
    () => createRelayControlMessage("resource-consumption-announcement", {
      ...announcement,
      witness: null
    }),
    (error) => error.code === "RELAY_SCHEMA"
  );
});

test("virtual transport converges after duplicate, drop, reorder, disconnect, and range catch-up", async () => {
  const network = new VirtualTransportNetwork();
  const records = [
    { envelope: lifecycle.birth, payload: {} },
    ...lifecycle.steps.slice(0, 2).map((step) => ({ envelope: step.envelope, payload: step.payload }))
  ];
  const endpoints = ["A", "B", "C"].map((id) => network.endpoint(ROOM, id));
  const replicas = endpoints.map(() => new TransportReplica());
  endpoints.forEach((endpoint, index) => endpoint.subscribe((frame) => replicas[index].receive(frame)));
  for (const record of records) await endpoints[0].publish(message(record));
  await network.flush({ dropEvery: 2, duplicateEvery: 3, reverse: true, rotate: 4 });
  endpoints[1].close();
  for (const [index, endpoint] of endpoints.entries()) {
    if (index === 1) continue;
    for (const frame of await endpoint.fetchRange(0)) replicas[index].receive(frame);
  }
  assert.deepEqual(replicas[0].publicState, replicas[2].publicState);
  assert.equal(replicas[0].publicState.status, "accepted");
  assert.equal(replicas[0].publicState.accepted_records, 3);
  assert.equal(replicas[0].publicState.sequence, "2");
  await assert.rejects(() => endpoints[1].fetchRange(0), /closed/);
});

test("virtual transport enforces generated room message and decoded raw-byte ceilings", async () => {
  const countNetwork = new VirtualTransportNetwork();
  const countEndpoint = countNetwork.endpoint(ROOM, "count-boundary");
  let firstBytes;
  for (let index = 0; index < RELAY_LIMITS.room_messages; index += 1) {
    const bytes = placementArtifactBytes(`virtual-count-${index}`);
    firstBytes ??= bytes;
    await countEndpoint.publish(bytes);
  }
  assert.equal((await countEndpoint.publish(firstBytes)).duplicate, true);
  await assert.rejects(
    countEndpoint.publish(placementArtifactBytes("virtual-count-overflow")),
    (error) => error.code === "RELAY_LIMIT"
  );
  assert.equal((await countEndpoint.fetchRange(RELAY_LIMITS.room_messages - 1)).length, 1);
  countEndpoint.close();

  const exactNetwork = new VirtualTransportNetwork();
  const exactEndpoint = exactNetwork.endpoint(ROOM, "byte-boundary-exact");
  const exactMessages = RELAY_LIMITS.room_bytes / RELAY_LIMITS.message_bytes;
  for (let index = 0; index < exactMessages; index += 1) {
    await exactEndpoint.publish(exactSizedPlacementArtifactBytes(
      `virtual-${String(index).padStart(3, "0")}`,
      RELAY_LIMITS.message_bytes
    ));
  }
  await assert.rejects(
    exactEndpoint.publish(placementArtifactBytes("virtual-byte-overflow")),
    (error) => error.code === "RELAY_LIMIT"
  );
  assert.equal((await exactEndpoint.fetchRange(exactMessages - 1)).length, 1);
  exactEndpoint.close();

  const plusOneNetwork = new VirtualTransportNetwork();
  const plusOneEndpoint = plusOneNetwork.endpoint(ROOM, "byte-boundary-plus-one");
  const fullMessages = exactMessages - 1;
  for (let index = 0; index < fullMessages; index += 1) {
    await plusOneEndpoint.publish(exactSizedPlacementArtifactBytes(
      `virt-p1-${String(index).padStart(3, "0")}`,
      RELAY_LIMITS.message_bytes
    ));
  }
  await plusOneEndpoint.publish(exactSizedPlacementArtifactBytes(
    "virt-p1-remainder",
    RELAY_LIMITS.message_bytes - 359
  ));
  const exactPlusOne = exactSizedPlacementArtifactBytes("virt-p1-overflow", 360);
  await assert.rejects(
    plusOneEndpoint.publish(exactPlusOne),
    (error) => error.code === "RELAY_LIMIT"
  );
  await assert.rejects(
    plusOneEndpoint.publish(exactPlusOne),
    (error) => error.code === "RELAY_LIMIT"
  );
  assert.equal((await plusOneEndpoint.fetchRange(fullMessages)).length, 1);
  plusOneEndpoint.close();
});

test("two signed siblings converge to visible FORKED instead of last-write-wins", async () => {
  const network = new VirtualTransportNetwork();
  const records = [
    { envelope: fork.genesis, payload: {} },
    { envelope: fork.first.envelope, payload: fork.first.payload },
    { envelope: fork.sibling.envelope, payload: fork.sibling.payload }
  ];
  const { frames, source } = await publishRecords(network, records);
  const left = new TransportReplica();
  const right = new TransportReplica();
  for (const frame of frames) left.receive(frame);
  for (const frame of [...frames].reverse()) right.receive(frame);
  assert.deepEqual(right.publicState, left.publicState);
  assert.equal(left.publicState.status, "FORKED");
  assert.equal(left.publicState.head_hash, null);
  assert.ok(left.publicState.rejected_codes.includes("E_FORK_DETECTED"));
  source.close();
});

test("10,000 seeded virtual schedules recover all endpoints deterministically", async () => {
  const result = await runTransportScheduleCorpus();
  assert.equal(result.cases, 10_000);
  assert.equal(result.endpoints_recovered, 30_000);
  assert.ok(result.dropped > 0);
  assert.ok(result.duplicated > 0);
  assert.ok(result.reordered > 0);
  assert.match(result.digest, /^sha256:[A-Za-z0-9_-]{43}$/);
});

test("real relay messages carry S3 chunks end to end without trusting metadata", async () => {
  const resourceBytes = deterministicReferenceResource();
  const inputBytes = createStatePackageInput({ transitionId: "relay-chunk-data-plane" });
  const tagged = `sha256:${"A".repeat(43)}`;
  const statePackage = createStatePackage({
    genomeHash: tagged,
    inputBytes,
    priorStateRoot: tagged,
    resourceBytes
  });
  const network = new VirtualTransportNetwork();
  const publisher = network.endpoint(ROOM, "chunk-publisher");
  const reader = network.endpoint(ROOM, "chunk-reader");
  const descriptors = await publishStatePackageChunks({
    chunkBytes: statePackage.chunkBytes,
    transport: publisher
  });
  assert.equal(descriptors.length, statePackage.manifest.chunks.length);
  const source = new RelayChunkRecoveryAdapter({
    descriptors,
    transport: { readRange: (after, limit) => reader.fetchRange(after, limit) }
  });
  const destination = new MemoryContentAddressedStore();
  const recovered = await recoverStatePackage({
    destination,
    expectedGenomeHash: tagged,
    expectedNextStateRoot: statePackage.nextStateRoot,
    expectedPriorStateRoot: tagged,
    inputBytes,
    manifestBytes: statePackage.manifestBytes,
    receiptBytes: statePackage.receiptBytes,
    sources: [source]
  });
  assert.equal(recovered.status, "available");
  assert.deepEqual(recovered.resource_bytes, resourceBytes);
  publisher.close();
  reader.close();
});

test("package publisher owns every chunk before the first transport await", async () => {
  const first = new Uint8Array(65_536).fill(11);
  const second = new Uint8Array(65_536).fill(22);
  const chunks = [first, second];
  const expectedSecondDigest = statePackageChunkDigest(second);
  const network = new VirtualTransportNetwork();
  const endpoint = network.endpoint(ROOM, "ownership-publisher");
  let releaseFirst;
  let observedFirst;
  let calls = 0;
  const entered = new Promise((resolve) => { observedFirst = resolve; });
  const release = new Promise((resolve) => { releaseFirst = resolve; });
  const transport = {
    async publish(bytes) {
      calls += 1;
      if (calls === 1) {
        observedFirst();
        await release;
      }
      return endpoint.publish(bytes);
    }
  };
  const publishing = publishStatePackageChunks({ chunkBytes: chunks, transport });
  await entered;
  second.fill(99);
  chunks.splice(0, chunks.length);
  transport.publish = async () => {
    throw new Error("borrowed transport facade reached after await");
  };
  releaseFirst();
  const descriptors = await publishing;
  assert.equal(descriptors[1].chunk_digest, expectedSecondDigest);
  assert.notEqual(descriptors[1].chunk_digest, statePackageChunkDigest(second));
  endpoint.close();
});

test("single chunk publisher never re-reads borrowed bytes after await", async () => {
  const chunk = new Uint8Array(1024).fill(37);
  const expectedDigest = statePackageChunkDigest(chunk);
  const expectedSize = chunk.byteLength;
  const network = new VirtualTransportNetwork();
  const endpoint = network.endpoint(ROOM, "single-ownership-publisher");
  const descriptor = await publishStateChunk({
    chunkBytes: chunk,
    transport: {
      async publish(bytes) {
        structuredClone(chunk.buffer, { transfer: [chunk.buffer] });
        return endpoint.publish(bytes);
      }
    }
  });
  assert.equal(chunk.byteLength, 0);
  assert.equal(descriptor.chunk_digest, expectedDigest);
  assert.equal(descriptor.chunk_size, expectedSize);
  endpoint.close();
});
