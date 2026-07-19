import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalBytes,
  createInitialState,
  createLineage,
  createNurtureInput,
  createStateTransitionPayload,
  custodyCommitment,
  decodeBase64Url,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  PULSE_SEED_V1_GENOME_BYTES,
  pulseApprovalMessage,
  stateGenomeHash,
  stateRoot,
  transitionState
} from "../src/index.mjs";

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function evidence(value, message) {
  return {
    key_id: value.key_id,
    signature: `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}`
  };
}

function fixture() {
  const actors = Array.from({ length: 3 }, actor).sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  const custodians = actors.map(({ key_id, public_key }) => ({ key_id, public_key }));
  const initialStateBytes = createInitialState(new Uint8Array(16).fill(7));
  const body = {
    protocol_version: "mortalos/1",
    hash_algorithm: "sha-256",
    signature_algorithm: "ed25519",
    genome_hash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
    initial_state_root: stateRoot(initialStateBytes),
    initial_state_base64url: encodeBase64Url(initialStateBytes),
    initial_custodians: custodians,
    initial_quorum: { type: "threshold", threshold: 2 },
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(8))}`
  };
  const birth = {
    kind: "mortalos.genesis",
    body,
    approvals: actors.map((entry) => evidence(entry, genesisApprovalMessage(body)))
  };
  return { actors, birth, initialStateBytes };
}

function transitionCandidate(opened, actors, stateBytes, steps = 1, mutate = () => {}) {
  const inputBytes = createNurtureInput(steps);
  const transition = createStateTransitionPayload({
    genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
    inputBytes,
    stateBytes
  });
  const payload = structuredClone(transition.payload);
  mutate(payload);
  const parent = opened.lineage.head;
  const body = {
    protocol_version: "mortalos/1",
    organism_id: opened.lineage.genesis.organism_id,
    sequence: (BigInt(parent.sequence) + 1n).toString(),
    parent_hash: parent.object_hash,
    genome_hash: opened.lineage.genesis.genome_hash,
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    state_root: stateRoot(transition.nextStateBytes),
    event: { kind: "state-transition", payload_hash: eventPayloadHash(payload) },
    next_custodians: parent.next_custody_descriptor.custodians,
    next_quorum: parent.next_custody_descriptor.quorum
  };
  const approvals = actors.slice(0, 2).map((entry) => evidence(entry, pulseApprovalMessage(body)));
  return {
    input: { envelopeBytes: canonicalBytes({ kind: "mortalos.pulse", body, approvals, acceptances: [] }), eventPayloadBytes: canonicalBytes(payload) },
    transition
  };
}

test("mortalos-state/1 is deterministic, bounded, and exact", () => {
  const stateBytes = createInitialState(new Uint8Array(16).fill(1));
  const inputBytes = createNurtureInput(3);
  const first = transitionState({ genomeBytes: PULSE_SEED_V1_GENOME_BYTES, stateBytes, inputBytes });
  const second = transitionState({ genomeBytes: PULSE_SEED_V1_GENOME_BYTES, stateBytes, inputBytes });
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(first.nextStateBytes)), {
    avatar_seed: "AQEBAQEBAQEBAQEBAQEBAQ",
    format: "mortalos-state/1",
    pulse_count: 3
  });
  assert.throws(() => transitionState({
    genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
    stateBytes,
    inputBytes: createNurtureInput(101)
  }), /E_STATE_LIMIT_EXCEEDED/);
  assert.throws(() => transitionState({
    genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
    stateBytes: new TextEncoder().encode('{"pulse_count":0}'),
    inputBytes
  }), /E_STATE_INPUT_INVALID/);
});

test("mortalos/1 Genesis and state transition bind genome, state, input, and receipt", () => {
  const { actors, birth, initialStateBytes } = fixture();
  const opened = createLineage(canonicalBytes(birth));
  assert.equal(opened.status, "accept");
  assert.equal(opened.lineage.genesis.protocol_version, "mortalos/1");
  const candidate = transitionCandidate(opened, actors, initialStateBytes, 1);
  const accepted = opened.lineage.append(candidate.input);
  assert.equal(accepted.status, "accept");
  assert.equal(accepted.sequence, "1");
  assert.equal(accepted.next_state_root, stateRoot(candidate.transition.nextStateBytes));
  const crashBeforeCommit = createLineage(canonicalBytes(birth));
  assert.equal(crashBeforeCommit.lineage.head.sequence, "0");
  assert.equal(crashBeforeCommit.lineage.head.next_state_root, stateRoot(initialStateBytes));
  const crashAfterCommit = createLineage(canonicalBytes(birth));
  const replayedCommit = crashAfterCommit.lineage.append(candidate.input);
  assert.equal(replayedCommit.object_hash, accepted.object_hash);
  assert.equal(replayedCommit.next_state_root, stateRoot(candidate.transition.nextStateBytes));

  const before = opened.lineage.head.object_hash;
  const invalid = transitionCandidate(opened, actors, candidate.transition.nextStateBytes, 1, (payload) => {
    const receipt = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload.receipt_base64url)));
    receipt.step_count += 1;
    payload.receipt_base64url = encodeBase64Url(canonicalBytes(receipt));
  });
  const rejected = opened.lineage.append(invalid.input);
  assert.equal(rejected.code, "E_STATE_RECEIPT_MISMATCH");
  assert.equal(opened.lineage.head.object_hash, before, "rejected transition mutated the accepted head");
  const recovered = transitionCandidate(opened, actors, candidate.transition.nextStateBytes, 1);
  assert.equal(opened.lineage.append(recovered.input).status, "accept");
});

test("v0 rejects v1-only sidecars and keeps the original event vocabulary", () => {
  const { actors, birth } = fixture();
  const v0 = structuredClone(birth);
  v0.body.protocol_version = "mortalos/0";
  v0.approvals = actors.map((entry) => evidence(entry, genesisApprovalMessage(v0.body)));
  assert.equal(createLineage(canonicalBytes(v0)).code, "E_SCHEMA_UNKNOWN_FIELD");
});

test("10,000 deterministic state transitions produce exact repeatable bytes", () => {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = new Uint8Array(16);
    seed[0] = index & 0xff;
    seed[1] = (index >>> 8) & 0xff;
    const initial = createInitialState(seed);
    const input = createNurtureInput((index % 100) + 1);
    const left = transitionState({ genomeBytes: PULSE_SEED_V1_GENOME_BYTES, stateBytes: initial, inputBytes: input });
    const right = transitionState({ genomeBytes: PULSE_SEED_V1_GENOME_BYTES, stateBytes: initial, inputBytes: input });
    assert.deepEqual(left.nextStateBytes, right.nextStateBytes, `state case ${index}`);
    assert.deepEqual(left.receiptBytes, right.receiptBytes, `receipt case ${index}`);
  }
});
