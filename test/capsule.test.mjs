import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
import {
  ContinuityCapsuleError,
  createContinuityCapsule,
  verifyContinuityCapsule
} from "../src/capsule.mjs";

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

function fixture() {
  const identity = actor();
  const initial = createInitialState(new Uint8Array(16).fill(12));
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    inputBytes: canonicalBytes({
      format: "mortalos-state-package-input/1",
      operation: "replace-resource",
      transition_id: "continuity-capsule"
    }),
    priorStateRoot: stateRoot(initial),
    resourceBytes: new Uint8Array(131_073).map(
      (_, index) => (index * 29 + (index >>> 16) * 17 + 7) & 0xff
    )
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
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(13))}`,
    protocol_version: "mortalos/1",
    signature_algorithm: "ed25519"
  };
  const birth = {
    approvals: [approval(identity, genesisApprovalMessage(genesisBody))],
    body: genesisBody,
    kind: "mortalos.genesis"
  };
  return { birth, custodian, identity, initial, statePackage };
}

async function capsuleFixture() {
  const { birth, identity, initial, statePackage } = fixture();
  const { createLineage } = await import("../src/lineage.mjs");
  const genesis = createLineage(canonicalBytes(birth));
  assert.equal(genesis.status, "accept");
  const current = genesis.lineage.head;
  const pulseBody = {
    current_custody_hash: custodyCommitment(current.next_custody_descriptor),
    event: {
      kind: "state-transition",
      payload_hash: eventPayloadHash(statePackage.payload)
    },
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
  return {
    records: [
      { envelope: birth, payload: {} },
      { envelope: pulse, payload: statePackage.payload }
    ],
    resourceBytes: statePackage.resourceBytes,
    statePackage
  };
}

test("Continuity Capsule survives process boundaries without carrying private authority", async () => {
  const source = await capsuleFixture();
  const created = createContinuityCapsule(source);
  const verified = verifyContinuityCapsule(created.bytes);
  assert.equal(verified.status, "verified");
  assert.deepEqual(verified.resource_bytes, source.resourceBytes);
  assert.doesNotMatch(
    new TextDecoder().decode(created.bytes),
    /private_key|CryptoKey|pkcs8/u
  );

  const directory = await mkdtemp(join(tmpdir(), "mortalos-capsule-"));
  const file = join(directory, "continuity.mosc");
  try {
    await writeFile(file, created.bytes);
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../cli/mortalos.mjs", import.meta.url)), "capsule", "verify", file],
      { encoding: "utf8" }
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(JSON.parse(child.stdout).capsule_id, created.capsule_id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Capsule mutations fail before resource activation", async () => {
  const created = createContinuityCapsule(await capsuleFixture());
  const changed = new Uint8Array(created.bytes);
  changed[changed.length - 8] ^= 1;
  assert.throws(
    () => verifyContinuityCapsule(changed),
    (error) => error instanceof ContinuityCapsuleError
  );
});
