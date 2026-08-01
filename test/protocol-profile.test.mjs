import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  createRelayChunkFragmentMessages,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../src/transport/protocol.mjs";
import {
  STATE_PACKAGE_LIMITS,
  statePackageChunkDigest
} from "../src/state/package.mjs";
import { canonicalBytes } from "../src/codec.mjs";

test("canonical protocol profile is the exact generated cross-layer source", async () => {
  const source = JSON.parse(await readFile(
    new URL("../protocol/profile.v1.json", import.meta.url),
    "utf8"
  ));
  assert.deepEqual(PROTOCOL_PROFILE, source);
  assert.deepEqual(STATE_PACKAGE_LIMITS, source.state);
  assert.deepEqual(RELAY_LIMITS, source.transport);
  assert.ok(source.transport.room_bytes <= source.provider.object_bytes);
  assert.equal(
    Math.ceil(source.state.chunk_bytes / source.transport.data_fragment_bytes),
    2
  );
});

test("exact chunk envelope limits pass and every plus-one boundary fails closed", () => {
  const chunk = new Uint8Array(PROTOCOL_PROFILE.state.chunk_bytes);
  for (let index = 0; index < chunk.length; index += 1) chunk[index] = index & 0xff;
  const messages = createRelayChunkFragmentMessages(chunk);
  assert.equal(messages.length, 2);
  for (const message of messages) {
    const bytes = canonicalBytes(message);
    assert.ok(bytes.byteLength <= PROTOCOL_PROFILE.transport.message_bytes);
    const opened = decodeRelayMessageBytes(bytes);
    assert.equal(opened.chunk.chunk_digest, statePackageChunkDigest(chunk));
  }
  assert.throws(
    () => createRelayChunkFragmentMessages(
      new Uint8Array(PROTOCOL_PROFILE.state.chunk_bytes + 1)
    ),
    (error) => error.code === "RELAY_LIMIT"
  );
  assert.throws(
    () => decodeRelayMessageBytes(
      new Uint8Array(PROTOCOL_PROFILE.transport.message_bytes + 1)
    ),
    (error) => error.code === "RELAY_LIMIT"
  );
  assert.throws(
    () => statePackageChunkDigest(
      new Uint8Array(PROTOCOL_PROFILE.state.chunk_bytes + 1)
    ),
    (error) => error.code === "E_STATE_PACKAGE_LIMIT_EXCEEDED"
  );
});
