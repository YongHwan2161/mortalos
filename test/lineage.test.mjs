import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalBytes,
  createLineage,
  custodyAcceptanceMessage,
  custodyCommitment,
  deriveOrganismId,
  derivePeerId,
  eventPayloadHash,
  genesisApprovalMessage,
  genesisParentHash,
  JSON_LIMITS,
  pulseApprovalMessage,
  validatePulse,
  validateLatentSuccessor
} from "../src/index.mjs";

function tagged(prefix, length, byte) {
  return `${prefix}${Buffer.alloc(length, byte).toString("base64url")}`;
}

function makeActor() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const public_key = `ed25519:${der.subarray(-32).toString("base64url")}`;
  return {
    key_id: derivePeerId(public_key),
    public_key,
    privateKey
  };
}

function publicActor(actor) {
  return { key_id: actor.key_id, public_key: actor.public_key };
}

function signature(privateKey, message) {
  return `ed25519:${sign(null, message, privateKey).toString("base64url")}`;
}

function buildForkFixture() {
  const actors = Array.from({ length: 6 }, makeActor).sort((left, right) =>
    left.key_id < right.key_id ? -1 : 1
  );
  const byId = new Map(actors.map((actor) => [actor.key_id, actor]));
  const current = actors.slice(0, 3);
  const quorum = { threshold: 2, type: "threshold" };
  const genome_hash = tagged("sha256:", 32, 1);
  const initial_state_root = tagged("sha256:", 32, 2);
  const body = {
    genome_hash,
    hash_algorithm: "sha-256",
    initial_custodians: current.map(publicActor),
    initial_quorum: quorum,
    initial_state_root,
    nonce: tagged("nonce:", 16, 3),
    protocol_version: "mortalos/0",
    signature_algorithm: "ed25519"
  };
  const birth = {
    approvals: current.map((actor) => ({
      key_id: actor.key_id,
      signature: signature(actor.privateKey, genesisApprovalMessage(body))
    })),
    body,
    kind: "mortalos.genesis"
  };
  const organismId = deriveOrganismId(body);
  const currentDescriptor = { custodians: current.map(publicActor), quorum };

  function branch(nextActors, label) {
    const nextCustodians = nextActors.map(publicActor).sort((left, right) =>
      left.key_id < right.key_id ? -1 : 1
    );
    const payload = { branch: label };
    const pulseBody = {
      current_custody_hash: custodyCommitment(currentDescriptor),
      event: { kind: "membership-change", payload_hash: eventPayloadHash(payload) },
      genome_hash,
      next_custodians: nextCustodians,
      next_quorum: quorum,
      organism_id: organismId,
      parent_hash: genesisParentHash(organismId),
      protocol_version: "mortalos/0",
      sequence: "1",
      state_root: initial_state_root
    };
    const approvalSigners = current.slice(0, 2);
    const newActors = nextCustodians
      .filter((entry) => !current.some((actor) => actor.key_id === entry.key_id))
      .map((entry) => byId.get(entry.key_id));
    return {
      envelope: {
        acceptances: newActors.map((actor) => ({
          key_id: actor.key_id,
          signature: signature(actor.privateKey, custodyAcceptanceMessage(pulseBody))
        })),
        approvals: approvalSigners.map((actor) => ({
          key_id: actor.key_id,
          signature: signature(actor.privateKey, pulseApprovalMessage(pulseBody))
        })),
        body: pulseBody,
        kind: "mortalos.pulse"
      },
      payload
    };
  }

  const partial = branch([current[0], actors[3], actors[4]], "partial");
  partial.envelope.acceptances.pop();

  function thresholdRaise(approvalCount) {
    const nextQuorum = { threshold: 3, type: "threshold" };
    const payload = { policy: "raise-threshold" };
    const pulseBody = {
      current_custody_hash: custodyCommitment(currentDescriptor),
      event: { kind: "membership-change", payload_hash: eventPayloadHash(payload) },
      genome_hash,
      next_custodians: current.map(publicActor),
      next_quorum: nextQuorum,
      organism_id: organismId,
      parent_hash: genesisParentHash(organismId),
      protocol_version: "mortalos/0",
      sequence: "1",
      state_root: initial_state_root
    };
    return {
      envelope: {
        acceptances: [],
        approvals: current.slice(0, approvalCount).map((actor) => ({
          key_id: actor.key_id,
          signature: signature(actor.privateKey, pulseApprovalMessage(pulseBody))
        })),
        body: pulseBody,
        kind: "mortalos.pulse"
      },
      payload
    };
  }

  return {
    birth,
    branches: [
      branch([current[0], current[1], actors[3]], "left"),
      branch([current[0], current[2], actors[4]], "right"),
      branch([current[1], current[2], actors[5]], "third")
    ],
    partial,
    thresholdRaise,
    equivocators: current.slice(0, 2).map((actor) => actor.key_id).sort()
  };
}

function input(branch) {
  return {
    envelopeBytes: canonicalBytes(branch.envelope),
    eventPayloadBytes: canonicalBytes(branch.payload)
  };
}

test("lineage registry rejects replay, exposes quorum equivocation, and fails closed after a fork", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  assert.equal(opened.status, "accept");
  assert.equal(opened.lineage.snapshot().status, "linear");

  const left = opened.lineage.append(input(fixture.branches[0]));
  assert.equal(left.status, "accept");
  assert.equal(opened.lineage.head.object_hash, left.object_hash);

  const replay = opened.lineage.append(input(fixture.branches[0]));
  assert.equal(replay.status, "reject");
  assert.equal(replay.code, "E_REPLAY_STALE");

  const fork = opened.lineage.append(input(fixture.branches[1]));
  assert.equal(fork.status, "forked");
  assert.equal(fork.code, "E_FORK_DETECTED");
  assert.deepEqual(fork.equivocating_key_ids, fixture.equivocators);
  assert.equal(opened.lineage.head, null);
  assert.equal(opened.lineage.isForked, true);

  const snapshot = opened.lineage.snapshot();
  assert.equal(snapshot.status, "forked");
  assert.equal(snapshot.accepted_objects, 3);
  assert.equal(snapshot.fork_points.length, 1);
  assert.equal(snapshot.fork_points[0].child_hashes.length, 2);

  const third = opened.lineage.append(input(fixture.branches[2]));
  assert.equal(third.status, "reject");
  assert.equal(third.code, "E_LINEAGE_ALREADY_FORKED");
});

test("lineage registry resolves parent context from accepted raw ancestry", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  const candidate = opened.lineage.verifyCandidate(input(fixture.branches[0]));
  assert.equal(candidate.status, "accept");

  const unknown = structuredClone(fixture.branches[0]);
  unknown.envelope.body.parent_hash = tagged("sha256:", 32, 9);
  const result = opened.lineage.verifyCandidate(input(unknown));
  assert.equal(result.status, "reject");
  assert.equal(result.code, "E_PARENT_UNKNOWN");

  const invalidBirth = structuredClone(fixture.birth);
  invalidBirth.approvals = [];
  assert.equal(createLineage(canonicalBytes(invalidBirth)).code, "E_GENESIS_APPROVAL_SET");
});

test("lineage candidate boundaries fail closed before graph context is consulted", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  const branchInput = input(fixture.branches[0]);

  assert.equal(
    opened.lineage.verifyCandidate({
      get envelopeBytes() {
        throw new Error("hostile envelope getter");
      }
    }).code,
    "E_VALIDATOR_INTERNAL"
  );
  assert.equal(
    opened.lineage.verifyCandidate({ envelopeBytes: branchInput.envelopeBytes }).code,
    "E_EVENT_PAYLOAD_REQUIRED"
  );
  assert.equal(
    opened.lineage.verifyCandidate({
      envelopeBytes: branchInput.envelopeBytes,
      get eventPayloadBytes() {
        throw new Error("hostile payload getter");
      }
    }).code,
    "E_VALIDATOR_INTERNAL"
  );
  assert.equal(
    opened.lineage.verifyCandidate({
      envelopeBytes: Buffer.from("{"),
      eventPayloadBytes: branchInput.eventPayloadBytes
    }).code,
    "E_PARSE_INVALID_JSON"
  );
  assert.equal(
    opened.lineage.verifyCandidate({
      envelopeBytes: Buffer.from([0xff]),
      eventPayloadBytes: Buffer.alloc(JSON_LIMITS.event_payload_bytes + 1)
    }).code,
    "E_PARSE_INVALID_UTF8"
  );
});

test("lineage preserves falsey JSON roots and matches direct validation precedence", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  const eventPayloadBytes = canonicalBytes({});

  for (const source of ["0", "false", "null", '""']) {
    const envelopeBytes = Buffer.from(source);
    const direct = validatePulse({
      genesis: opened.lineage.genesis,
      parent: opened.lineage.genesis,
      envelopeBytes,
      eventPayloadBytes
    });
    const throughLineage = opened.lineage.verifyCandidate({ envelopeBytes, eventPayloadBytes });

    assert.equal(direct.code, "E_SCHEMA_WRONG_KIND", source);
    assert.deepEqual(throughLineage, direct, source);
  }
});

test("a handoff cannot activate a stronger next quorum with unproven continuing keys", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  const unsafeInput = input(fixture.thresholdRaise(2));
  const unsafe = opened.lineage.verifyCandidate(unsafeInput);
  assert.equal(unsafe.status, "reject");
  assert.equal(unsafe.code, "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT");
  assert.equal(unsafe.deterministic_detail, "2/3");
  const unsafeLatent = validateLatentSuccessor({
    genesis: opened.lineage.genesis,
    parent: opened.lineage.head,
    ...unsafeInput
  });
  assert.equal(unsafeLatent.code, "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT");

  const activated = opened.lineage.verifyCandidate(input(fixture.thresholdRaise(3)));
  assert.equal(activated.status, "accept");
});

test("forked lineage refuses to classify mortality", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  assert.equal(opened.lineage.append(input(fixture.branches[0])).status, "accept");
  assert.equal(opened.lineage.append(input(fixture.branches[1])).status, "forked");

  const assessment = opened.lineage.evaluateMortality();
  assert.deepEqual(assessment, {
    status: "forked",
    mortality_classified: false,
    fork_points: [opened.lineage.genesis.object_hash]
  });
  assert.equal(Object.isFrozen(assessment), true);
  assert.equal(Object.isFrozen(assessment.fork_points), true);
});

test("latent verifier authenticates current quorum and every supplied new-custodian acceptance", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  const latent = validateLatentSuccessor({
    genesis: opened.lineage.genesis,
    parent: opened.lineage.genesis,
    ...input(fixture.partial)
  });
  assert.equal(latent.status, "latent");
  assert.equal(latent.missing_acceptance_key_ids.length, 1);

  const corrupt = structuredClone(fixture.partial);
  corrupt.envelope.acceptances[0].signature = tagged("ed25519:", 64, 0);
  const rejected = validateLatentSuccessor({
    genesis: opened.lineage.genesis,
    parent: opened.lineage.genesis,
    ...input(corrupt)
  });
  assert.equal(rejected.status, "reject");
  assert.equal(rejected.code, "E_ACCEPTANCE_SIGNATURE_INVALID");
});
