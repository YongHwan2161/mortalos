import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalBytes,
  createInitialState,
  createStatePackageTransitionPayload,
  custodyCommitment,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  PULSE_SEED_V1_GENOME_BYTES,
  pulseApprovalMessage,
  stateGenomeHash,
  stateRoot
} from "../src/index.mjs";
import { createContinuityCapsule } from "../src/capsule.mjs";
import { recoverContinuityCapsuleQuorum } from "../src/custody.mjs";

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function approval(identity, message) {
  return {
    key_id: identity.key_id,
    signature: `ed25519:${encodeBase64Url(sign(null, message, identity.privateKey))}`
  };
}

async function capsule(seed = 1) {
  const identity = actor();
  const initial = createInitialState(new Uint8Array(16).fill(seed));
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    inputBytes: canonicalBytes({
      format: "mortalos-state-package-input/1",
      operation: "replace-resource",
      transition_id: `custody-${seed}`
    }),
    priorStateRoot: stateRoot(initial),
    resourceBytes: new Uint8Array(65_537).map((_, index) => (index * 31 + seed) & 0xff)
  });
  const custodian = { key_id: identity.key_id, public_key: identity.public_key };
  const genesisBody = {
    genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
    genome_hash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    hash_algorithm: "sha-256",
    initial_custodians: [custodian],
    initial_quorum: { threshold: 1, type: "threshold" },
    initial_state_base64url: encodeBase64Url(initial),
    initial_state_root: stateRoot(initial),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(seed + 1))}`,
    protocol_version: "mortalos/1",
    signature_algorithm: "ed25519"
  };
  const birth = {
    approvals: [approval(identity, genesisApprovalMessage(genesisBody))],
    body: genesisBody,
    kind: "mortalos.genesis"
  };
  const { createLineage } = await import("../src/lineage.mjs");
  const genesis = createLineage(canonicalBytes(birth));
  const current = genesis.lineage.head;
  const pulseBody = {
    current_custody_hash: custodyCommitment(current.next_custody_descriptor),
    event: { kind: "state-transition", payload_hash: eventPayloadHash(statePackage.payload) },
    genome_hash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    next_custodians: current.next_custody_descriptor.custodians,
    next_quorum: current.next_custody_descriptor.quorum,
    organism_id: genesis.lineage.genesis.organism_id,
    parent_hash: current.object_hash,
    protocol_version: "mortalos/1",
    sequence: "1",
    state_root: statePackage.nextStateRoot
  };
  const pulse = {
    acceptances: [],
    approvals: [approval(identity, pulseApprovalMessage(pulseBody))],
    body: pulseBody,
    kind: "mortalos.pulse"
  };
  return createContinuityCapsule({
    records: [
      { envelope: birth, payload: {} },
      { envelope: pulse, payload: statePackage.payload }
    ],
    statePackage
  }).bytes;
}

test("S8 2-of-3 custody recovers one lost or corrupt provider and rejects a valid fork", async () => {
  const current = await capsule(9);
  for (let trial = 0; trial < 48; trial += 1) {
    const corrupt = new Uint8Array(current);
    corrupt[trial % corrupt.length] ^= 1;
    const lost = trial % 3;
    const copies = [current, current, current];
    copies[lost] = corrupt;
    const recovered = recoverContinuityCapsuleQuorum({ copies, quorum: 2 });
    assert.equal(recovered.status, "available");
    assert.equal(recovered.valid_copies, 2);
    assert.deepEqual(recovered.capsule_bytes, current);
  }
  const fork = await capsule(10);
  assert.throws(
    () => recoverContinuityCapsuleQuorum({ copies: [current, current, fork], quorum: 2 }),
    (error) => error.code === "E_CUSTODY_EQUIVOCATION"
  );
  assert.throws(
    () => recoverContinuityCapsuleQuorum({ copies: [current, new Uint8Array([1]), new Uint8Array([2])], quorum: 2 }),
    (error) => error.code === "E_CUSTODY_QUORUM_UNAVAILABLE"
  );
  assert.doesNotMatch(new TextDecoder().decode(current), /private_key|CryptoKey|pkcs8/u);
  assert.deepEqual(canonicalBytes(JSON.parse(new TextDecoder().decode(current))), current);
});
