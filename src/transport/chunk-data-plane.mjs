import { canonicalBytes } from "../codec.mjs";
import { asBytes, byteLengthOfBytes } from "../bytes.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import {
  copyBoundedOwnDataArray,
  createArray,
  createUint8Array,
  defineArrayIndex,
  freeze,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotNamedOwnDataValues,
  typedArraySet
} from "../primordials.mjs";
import { statePackageChunkDigest } from "../state/package.mjs";
import {
  createRelayChunkFragmentMessages,
  decodeRelayFrame,
  RELAY_LIMITS,
  RelayProtocolError
} from "./protocol.mjs";

export const CHUNK_TRANSPORT_DESCRIPTOR_FORMAT =
  "mortalos-chunk-transport-descriptor/1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;

function ownChunkBytes(value, index) {
  const view = asBytes(value);
  const length = view === null ? null : byteLengthOfBytes(view);
  if (length === null || length < 1 || length > PROTOCOL_PROFILE.state.chunk_bytes) {
    throw new RelayProtocolError(
      "RELAY_SCHEMA",
      `state package chunk ${index} must be a bounded Uint8Array`
    );
  }
  const owned = createUint8Array(length);
  typedArraySet(owned, view, 0);
  return owned;
}

function snapshotDescriptor(value) {
  const [chunkDigest, chunkSize, format, messageIds] = snapshotNamedOwnDataValues(
    value,
    ["chunk_digest", "chunk_size", "format", "message_ids"],
    "chunk transport descriptor"
  );
  const count = ownDataArrayLength(messageIds, "chunk transport message IDs");
  const ownedIds = copyBoundedOwnDataArray(
    messageIds,
    count,
    "chunk transport message IDs"
  );
  if (
    format !== CHUNK_TRANSPORT_DESCRIPTOR_FORMAT ||
    !DIGEST.test(chunkDigest) ||
    !Number.isSafeInteger(chunkSize) ||
    chunkSize < 1 ||
    count !== Math.ceil(chunkSize / RELAY_LIMITS.data_fragment_bytes) ||
    ownedIds.some((entry) => !DIGEST.test(entry)) ||
    new Set(ownedIds).size !== ownedIds.length
  ) {
    throw new RelayProtocolError("RELAY_SCHEMA", "invalid chunk transport descriptor");
  }
  return Object.freeze({
    chunk_digest: chunkDigest,
    chunk_size: chunkSize,
    format,
    message_ids: Object.freeze(ownedIds)
  });
}

export async function publishStateChunk({ chunkBytes, transport }) {
  const publish = snapshotDataMethod(transport, "publish", "chunk transport");
  const ownedChunkBytes = ownChunkBytes(chunkBytes, "single");
  const chunkSize = ownedChunkBytes.byteLength;
  const messages = createRelayChunkFragmentMessages(ownedChunkBytes);
  const messageIds = [];
  for (const message of messages) {
    const response = await publish(canonicalBytes(message));
    const opened = decodeRelayFrame(response.frame);
    if (
      !opened.chunk ||
      opened.chunk.chunk_digest !== message.chunk_digest ||
      opened.chunk.fragment_index !== message.fragment_index
    ) {
      throw new RelayProtocolError("RELAY_DIGEST", "relay changed a chunk fragment");
    }
    messageIds.push(opened.message_id);
  }
  return Object.freeze({
    chunk_digest: messages[0].chunk_digest,
    chunk_size: chunkSize,
    format: CHUNK_TRANSPORT_DESCRIPTOR_FORMAT,
    message_ids: Object.freeze(messageIds)
  });
}

export async function publishStatePackageChunks({ chunkBytes, transport }) {
  const publish = snapshotDataMethod(transport, "publish", "chunk transport");
  const ownedTransport = freeze({ publish });
  const count = ownDataArrayLength(chunkBytes, "state package chunks");
  const borrowed = copyBoundedOwnDataArray(chunkBytes, count, "state package chunks");
  const ownedChunks = createArray(count);
  for (let index = 0; index < count; index += 1) {
    defineArrayIndex(ownedChunks, index, ownChunkBytes(borrowed[index], index));
  }
  freeze(ownedChunks);
  if (!realmIntrinsicsIntact()) {
    throw new RelayProtocolError("RELAY_SCHEMA", "realm integrity required");
  }
  const descriptors = [];
  for (const bytes of ownedChunks) {
    descriptors.push(await publishStateChunk({ chunkBytes: bytes, transport: ownedTransport }));
  }
  return Object.freeze(descriptors);
}

export class RelayChunkRecoveryAdapter {
  #descriptors;
  #readRange;
  #frames = null;

  constructor({ descriptors, transport }) {
    const count = ownDataArrayLength(descriptors, "chunk transport descriptors");
    const owned = copyBoundedOwnDataArray(
      descriptors,
      count,
      "chunk transport descriptors"
    );
    this.#descriptors = new Map();
    for (const descriptor of owned) {
      const snapshot = snapshotDescriptor(descriptor);
      if (this.#descriptors.has(snapshot.chunk_digest)) {
        throw new RelayProtocolError("RELAY_SCHEMA", "duplicate chunk descriptor");
      }
      this.#descriptors.set(snapshot.chunk_digest, snapshot);
    }
    this.#readRange = snapshotDataMethod(transport, "readRange", "chunk transport");
  }

  async inventory() {
    return [...this.#descriptors.keys()].sort();
  }

  async #loadFrames() {
    if (this.#frames) return this.#frames;
    const observed = new Map();
    let cursor = 0;
    for (let page = 0; page < Math.ceil(RELAY_LIMITS.room_messages / RELAY_LIMITS.range_limit); page += 1) {
      const frames = await this.#readRange(cursor, RELAY_LIMITS.range_limit);
      if (!Array.isArray(frames) || frames.length > RELAY_LIMITS.range_limit) {
        throw new RelayProtocolError("RELAY_SCHEMA", "invalid relay range");
      }
      for (const frame of frames) {
        const opened = decodeRelayFrame(frame);
        observed.set(opened.message_id, opened);
        cursor = Math.max(cursor, opened.sequence);
      }
      if (frames.length < RELAY_LIMITS.range_limit) break;
    }
    this.#frames = observed;
    return observed;
  }

  async readChunk(digest) {
    const descriptor = this.#descriptors.get(digest);
    if (!descriptor) return null;
    const frames = await this.#loadFrames();
    const fragments = new Array(descriptor.message_ids.length);
    for (let index = 0; index < descriptor.message_ids.length; index += 1) {
      const opened = frames.get(descriptor.message_ids[index]);
      if (
        !opened?.chunk ||
        opened.chunk.chunk_digest !== descriptor.chunk_digest ||
        opened.chunk.chunk_size !== descriptor.chunk_size ||
        opened.chunk.fragment_count !== descriptor.message_ids.length ||
        opened.chunk.fragment_index !== index
      ) {
        return null;
      }
      fragments[index] = opened.chunk.fragment_bytes;
    }
    const chunk = new Uint8Array(descriptor.chunk_size);
    let offset = 0;
    for (const fragment of fragments) {
      chunk.set(fragment, offset);
      offset += fragment.byteLength;
    }
    if (offset !== descriptor.chunk_size || statePackageChunkDigest(chunk) !== digest) {
      return null;
    }
    return chunk;
  }
}
