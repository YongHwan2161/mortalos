import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalBytes,
  createLineage,
  custodyAcceptanceMessage,
  custodyCommitment,
  deriveOrganismId,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  genesisParentHash,
  pulseApprovalMessage
} from "../src/index.mjs";
import { runPortableScenario } from "./portable-scenario.mjs";

function makeActor() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), public_key, privateKey };
}

function publicActor(actor) {
  return { key_id: actor.key_id, public_key: actor.public_key };
}

function signature(actor, message) {
  return `ed25519:${encodeBase64Url(sign(null, message, actor.privateKey))}`;
}

function tagged(prefix, length, byte) {
  return `${prefix}${encodeBase64Url(new Uint8Array(length).fill(byte))}`;
}

test("public-key-only 1-of-1 vector is born, advances, and becomes dead only under explicit loss assumptions", async () => {
  const singleton = JSON.parse(
    await readFile(new URL("./vectors/singleton.json", import.meta.url), "utf8")
  );
  const result = runPortableScenario(singleton);
  assert.equal(result.organism_id, singleton.expected.organism_id);
  assert.equal(result.genesis_hash, singleton.expected.genesis_hash);
  assert.equal(result.pulse_hash, singleton.expected.pulse_hash);
  assert.equal(result.unsigned_code, "E_APPROVAL_INSUFFICIENT_QUORUM");
  assert.equal(result.alive_status, "operationally_alive");
  assert.equal(result.dead_status, "dead_under_v0_assumptions");
});

test("a 1-of-1 lineage can grow into 2-of-3 and cease unilateral continuation", () => {
  const actors = Array.from({ length: 3 }, makeActor).sort((left, right) =>
    left.key_id < right.key_id ? -1 : 1
  );
  const initial = actors[0];
  const singletonQuorum = { type: "threshold", threshold: 1 };
  const distributedQuorum = { type: "threshold", threshold: 2 };
  const body = {
    protocol_version: "mortalos/0",
    hash_algorithm: "sha-256",
    signature_algorithm: "ed25519",
    genome_hash: tagged("sha256:", 32, 65),
    initial_state_root: tagged("sha256:", 32, 66),
    initial_custodians: [publicActor(initial)],
    initial_quorum: singletonQuorum,
    nonce: tagged("nonce:", 16, 67)
  };
  const birth = {
    kind: "mortalos.genesis",
    body,
    approvals: [{ key_id: initial.key_id, signature: signature(initial, genesisApprovalMessage(body)) }]
  };
  const opened = createLineage(canonicalBytes(birth));
  assert.equal(opened.status, "accept");

  const nextCustodians = actors.map(publicActor);
  const payload = { mode: "grow-to-2-of-3" };
  const pulseBody = {
    protocol_version: "mortalos/0",
    organism_id: deriveOrganismId(body),
    sequence: "1",
    parent_hash: genesisParentHash(deriveOrganismId(body)),
    genome_hash: body.genome_hash,
    current_custody_hash: custodyCommitment({
      custodians: [publicActor(initial)],
      quorum: singletonQuorum
    }),
    state_root: body.initial_state_root,
    event: { kind: "membership-change", payload_hash: eventPayloadHash(payload) },
    next_custodians: nextCustodians,
    next_quorum: distributedQuorum
  };
  const handoff = {
    kind: "mortalos.pulse",
    body: pulseBody,
    approvals: [{ key_id: initial.key_id, signature: signature(initial, pulseApprovalMessage(pulseBody)) }],
    acceptances: actors.slice(1).map((actor) => ({
      key_id: actor.key_id,
      signature: signature(actor, custodyAcceptanceMessage(pulseBody))
    }))
  };
  const distributed = opened.lineage.append({
    envelopeBytes: canonicalBytes(handoff),
    eventPayloadBytes: canonicalBytes(payload)
  });
  assert.equal(distributed.status, "accept");
  assert.equal(distributed.next_custody_descriptor.quorum.threshold, 2);

  const heartbeatBody = {
    protocol_version: "mortalos/0",
    organism_id: distributed.organism_id,
    sequence: "2",
    parent_hash: distributed.object_hash,
    genome_hash: distributed.genome_hash,
    current_custody_hash: custodyCommitment(distributed.next_custody_descriptor),
    state_root: distributed.next_state_root,
    event: { kind: "heartbeat", payload_hash: eventPayloadHash({}) },
    next_custodians: nextCustodians,
    next_quorum: distributedQuorum
  };
  const oneSigner = {
    kind: "mortalos.pulse",
    body: heartbeatBody,
    approvals: [{ key_id: initial.key_id, signature: signature(initial, pulseApprovalMessage(heartbeatBody)) }],
    acceptances: []
  };
  const rejected = opened.lineage.validateCandidate({
    envelopeBytes: canonicalBytes(oneSigner),
    eventPayloadBytes: canonicalBytes({})
  });
  assert.equal(rejected.code, "E_APPROVAL_INSUFFICIENT_QUORUM");

  const twoSigners = structuredClone(oneSigner);
  twoSigners.approvals = actors.slice(1).map((actor) => ({
    key_id: actor.key_id,
    signature: signature(actor, pulseApprovalMessage(heartbeatBody))
  }));
  const advanced = opened.lineage.append({
    envelopeBytes: canonicalBytes(twoSigners),
    eventPayloadBytes: canonicalBytes({})
  });
  assert.equal(advanced.status, "accept");
  assert.equal(advanced.sequence, "2");
});
