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
import { CONFIDENTIAL_LIMITS } from "../src/confidential/format.mjs";
import { CUSTODY_LIMITS, verifyContinuityCopy } from "../src/custody.mjs";
import { RESOURCE_CONTRACT_LIMITS } from "../src/resource-contract.mjs";

test("canonical protocol profile is the exact generated cross-layer source", async () => {
  const source = JSON.parse(await readFile(
    new URL("../protocol/profile.v1.json", import.meta.url),
    "utf8"
  ));
  assert.deepEqual(PROTOCOL_PROFILE, source);
  assert.deepEqual(STATE_PACKAGE_LIMITS, source.state);
  assert.deepEqual(RELAY_LIMITS, source.transport);
  assert.ok(source.transport.room_bytes <= source.provider.object_bytes);
  assert.equal(source.continuity.signed_copy_count, 3);
  assert.equal(source.continuity.signed_copy_quorum, 2);
  assert.equal(
    source.continuity.copy_envelope_bytes,
    4 * Math.ceil(source.provider.object_bytes / 3) + 4_096,
    "the signed-copy envelope must cover a maximum Capsule plus bounded metadata"
  );
  assert.equal(
    Math.ceil(source.state.chunk_bytes / source.transport.data_fragment_bytes),
    2
  );
  assert.deepEqual(
    {
      decimal_max: String(RESOURCE_CONTRACT_LIMITS.decimal_max),
      document_bytes: RESOURCE_CONTRACT_LIMITS.document_bytes,
      lease_duration_ms_max: String(RESOURCE_CONTRACT_LIMITS.lease_duration_ms_max),
      leases_per_offer_observation_max:
        RESOURCE_CONTRACT_LIMITS.leases_per_offer_observation_max,
      receipts_per_lease_max: RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
      revocations_per_evaluation_max:
        RESOURCE_CONTRACT_LIMITS.revocations_per_evaluation_max
    },
    source.resource_contract,
    "resource offer, lease, usage, and revocation ceilings must share one profile"
  );
  assert.deepEqual(
    {
      aad_bytes: CONFIDENTIAL_LIMITS.aad_bytes,
      chunk_plaintext_bytes: CONFIDENTIAL_LIMITS.chunk_plaintext_bytes,
      counter_max_exclusive: String(CONFIDENTIAL_LIMITS.counter_max_exclusive),
      epoch_max: String(CONFIDENTIAL_LIMITS.epoch_max),
      manifest_bytes: CONFIDENTIAL_LIMITS.manifest_bytes,
      max_chunks: CONFIDENTIAL_LIMITS.max_chunks,
      max_custodians: CONFIDENTIAL_LIMITS.max_custodians,
      package_bytes: CONFIDENTIAL_LIMITS.package_bytes,
      reservation_count_max: String(CONFIDENTIAL_LIMITS.reservation_count_max),
      resource_bytes: CONFIDENTIAL_LIMITS.resource_bytes,
      rsa_wrapped_bytes: CONFIDENTIAL_LIMITS.rsa_wrapped_bytes
    },
    source.confidential,
    "every S4 envelope and numeric ceiling must be generated from the profile"
  );
});

test("S4 runtime and receipt consumers bind every envelope ceiling to profile constants", async () => {
  const recovery = await readFile(
    new URL("../src/confidential/recovery.mjs", import.meta.url),
    "utf8"
  );
  const receiptVerifier = await readFile(
    new URL("../scripts/verify-s4-receipt.mjs", import.meta.url),
    "utf8"
  );
  assert.match(
    recovery,
    /next_custodian_key_digests\.length > CONFIDENTIAL_LIMITS\.max_custodians/u
  );
  for (const expression of [
    "CONFIDENTIAL_LIMITS.aad_bytes",
    "CONFIDENTIAL_LIMITS.chunk_plaintext_bytes",
    "CONFIDENTIAL_LIMITS.max_chunks",
    "CONFIDENTIAL_LIMITS.max_custodians",
    "CONFIDENTIAL_LIMITS.package_bytes",
    "CONFIDENTIAL_LIMITS.resource_bytes",
    "CONFIDENTIAL_LIMITS.rsa_wrapped_bytes",
    "PROTOCOL_PROFILE.state.reference_resource_bytes"
  ]) {
    assert.ok(receiptVerifier.includes(expression), `S4 receipt verifier must use ${expression}`);
  }
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

test("signed continuity-copy envelope ceiling is profile-generated and fails at plus one", () => {
  assert.equal(
    CUSTODY_LIMITS.copy_bytes,
    PROTOCOL_PROFILE.continuity.copy_envelope_bytes
  );
  assert.throws(
    () => verifyContinuityCopy(new Uint8Array(CUSTODY_LIMITS.copy_bytes)),
    (error) => !/bounded Uint8Array/u.test(error.message),
    "the exact ceiling reaches format validation rather than failing the byte bound"
  );
  assert.throws(
    () => verifyContinuityCopy(new Uint8Array(CUSTODY_LIMITS.copy_bytes + 1)),
    /bounded Uint8Array/u
  );
});
