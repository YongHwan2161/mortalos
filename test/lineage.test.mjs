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
  derivePulseHash,
  eventPayloadHash,
  genesisApprovalMessage,
  genesisParentHash,
  isValidatedLatentSuccessor,
  JSON_LIMITS,
  pulseApprovalMessage,
  validatePulse,
  validateLatentSuccessor
} from "../src/index.mjs";
import {
  isValidatedMortalitySuccessor,
  validateMortalitySuccessor
} from "../src/validator.mjs";

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

  const twoNewCustodians = branch([current[0], actors[3], actors[4]], "two-new");
  const partial = structuredClone(twoNewCustodians);
  partial.envelope.acceptances.pop();

  function heartbeat(approvalCount) {
    const payload = {};
    const pulseBody = {
      current_custody_hash: custodyCommitment(currentDescriptor),
      event: { kind: "heartbeat", payload_hash: eventPayloadHash(payload) },
      genome_hash,
      next_custodians: current.map(publicActor),
      next_quorum: quorum,
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
    current,
    branches: [
      branch([current[0], current[1], actors[3]], "left"),
      branch([current[0], current[2], actors[4]], "right"),
      branch([current[1], current[2], actors[5]], "third")
    ],
    heartbeat,
    partial,
    thresholdRaise,
    twoNewCustodians,
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
  assert.equal(Object.isFrozen(opened.lineage), true);
  assert.equal(Object.isFrozen(opened.lineage.constructor), true);
  assert.equal(Object.isFrozen(opened.lineage.constructor.prototype), true);
  assert.throws(() => Object.defineProperty(opened.lineage, "evaluateMortality", {
    value: () => ({ status: "dead_under_v0_assumptions" })
  }), TypeError);
  assert.throws(() => {
    opened.lineage.evaluateMortality = () => ({ status: "dead_under_v0_assumptions" });
  }, TypeError);
  assert.throws(() => Object.setPrototypeOf(opened.lineage, null), TypeError);
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

test("mortality completion combines durable approvals with explicitly usable current keys", () => {
  const fixture = buildForkFixture();
  const opened = createLineage(canonicalBytes(fixture.birth));
  assert.equal(opened.status, "accept");

  const thresholdRaise = fixture.thresholdRaise(2);
  const survivingKeyId = fixture.current[2].key_id;
  const mortalityInput = {
    genesis: opened.lineage.genesis,
    parent: opened.lineage.head,
    ...input(thresholdRaise)
  };
  const publicAttempt = validateLatentSuccessor(mortalityInput, [survivingKeyId]);
  assert.equal(publicAttempt.code, "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT");
  const raisePotential = validateMortalitySuccessor(
    mortalityInput,
    [survivingKeyId]
  );
  assert.equal(raisePotential.status, "latent");
  assert.equal(isValidatedLatentSuccessor(raisePotential), false);
  assert.equal(isValidatedMortalitySuccessor(raisePotential), true);
  assert.deepEqual(raisePotential.missing_current_approval_key_ids, [survivingKeyId]);
  assert.deepEqual(raisePotential.missing_acceptance_key_ids, []);

  const impossibleRaise = opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [input(thresholdRaise)],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  assert.equal(impossibleRaise.status, "dead_under_v0_assumptions");

  const completableRaise = opened.lineage.evaluateMortality({
    usableKeyIds: [survivingKeyId],
    stateAvailable: true,
    pendingSuccessors: [input(thresholdRaise)],
    authorityLossIrreversible: true
  });
  assert.equal(completableRaise.status, "latent_successor_not_dead");
  assert.equal(completableRaise.latent_successors, 1);

  const completedRaise = opened.lineage.verifyCandidate(input(fixture.thresholdRaise(3)));
  assert.equal(completedRaise.status, "accept");
  assert.equal(completedRaise.object_hash, derivePulseHash(thresholdRaise.envelope.body));
  assert.equal(completedRaise.object_hash, raisePotential.object_hash);

  const belowCurrentQuorum = structuredClone(fixture.branches[0]);
  belowCurrentQuorum.envelope.approvals = belowCurrentQuorum.envelope.approvals.slice(0, 1);
  const completingKeyId = fixture.branches[0].envelope.approvals[1].key_id;
  assert.equal(
    opened.lineage.verifyCandidate(input(belowCurrentQuorum)).code,
    "E_APPROVAL_INSUFFICIENT_QUORUM"
  );
  assert.equal(
    validateLatentSuccessor(
      {
        genesis: opened.lineage.genesis,
        parent: opened.lineage.head,
        ...input(belowCurrentQuorum)
      },
      [completingKeyId]
    ).code,
    "E_APPROVAL_INSUFFICIENT_QUORUM"
  );

  const quorumPotential = validateMortalitySuccessor(
    {
      genesis: opened.lineage.genesis,
      parent: opened.lineage.head,
      ...input(belowCurrentQuorum)
    },
    [completingKeyId]
  );
  assert.equal(quorumPotential.status, "latent");
  assert.deepEqual(quorumPotential.missing_current_approval_key_ids, [completingKeyId]);

  const impossibleQuorum = opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [input(belowCurrentQuorum)],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  assert.equal(impossibleQuorum.status, "dead_under_v0_assumptions");

  const completableQuorum = opened.lineage.evaluateMortality({
    usableKeyIds: [completingKeyId],
    stateAvailable: true,
    pendingSuccessors: [input(belowCurrentQuorum)],
    authorityLossIrreversible: true
  });
  assert.equal(completableQuorum.status, "latent_successor_not_dead");

  const completedQuorum = opened.lineage.verifyCandidate(input(fixture.branches[0]));
  assert.equal(completedQuorum.status, "accept");
  assert.equal(completedQuorum.object_hash, quorumPotential.object_hash);

  const partialHeartbeat = fixture.heartbeat(1);
  const heartbeatCompletingKeyId = fixture.heartbeat(2).envelope.approvals[1].key_id;
  assert.equal(
    opened.lineage.verifyCandidate(input(partialHeartbeat)).code,
    "E_APPROVAL_INSUFFICIENT_QUORUM"
  );
  const heartbeatPotential = validateMortalitySuccessor(
    {
      genesis: opened.lineage.genesis,
      parent: opened.lineage.head,
      ...input(partialHeartbeat)
    },
    [heartbeatCompletingKeyId]
  );
  assert.equal(heartbeatPotential.status, "latent");
  assert.deepEqual(
    heartbeatPotential.missing_current_approval_key_ids,
    [heartbeatCompletingKeyId]
  );
  assert.equal(
    opened.lineage.evaluateMortality({
      usableKeyIds: [heartbeatCompletingKeyId],
      stateAvailable: true,
      pendingSuccessors: [input(partialHeartbeat)],
      authorityLossIrreversible: true
    }).status,
    "latent_successor_not_dead"
  );
  assert.equal(
    opened.lineage.verifyCandidate(input(fixture.heartbeat(2))).object_hash,
    heartbeatPotential.object_hash
  );

  const missingBoth = structuredClone(fixture.twoNewCustodians);
  missingBoth.envelope.approvals = missingBoth.envelope.approvals.slice(0, 1);
  missingBoth.envelope.acceptances = missingBoth.envelope.acceptances.slice(0, 1);
  const missingApprovalKeyId = fixture.twoNewCustodians.envelope.approvals[1].key_id;
  const missingAcceptanceKeyId = fixture.twoNewCustodians.envelope.acceptances[1].key_id;
  const combinedPotential = validateMortalitySuccessor(
    {
      genesis: opened.lineage.genesis,
      parent: opened.lineage.head,
      ...input(missingBoth)
    },
    [missingApprovalKeyId]
  );
  assert.equal(combinedPotential.status, "latent");
  assert.deepEqual(
    combinedPotential.missing_current_approval_key_ids,
    [missingApprovalKeyId]
  );
  assert.deepEqual(combinedPotential.missing_acceptance_key_ids, [missingAcceptanceKeyId]);
});

test("mortality coalesces verified evidence only within the same candidate body", () => {
  const fixture = buildForkFixture();

  const splitA = structuredClone(fixture.branches[0]);
  const splitB = structuredClone(fixture.branches[0]);
  splitA.envelope.approvals = splitA.envelope.approvals.slice(0, 1);
  splitB.envelope.approvals = splitB.envelope.approvals.slice(1);
  const invalidConflict = structuredClone(splitA);
  invalidConflict.envelope.approvals[0].signature = tagged("ed25519:", 64, 0);
  const wrongKindEnvelope = structuredClone(splitB.envelope);
  wrongKindEnvelope.kind = "not-a-pulse";
  const wrongBodyEnvelope = {
    acceptances: [],
    approvals: splitB.envelope.approvals,
    body: {},
    kind: "not-a-pulse"
  };
  const mislabeledEnvelope = {
    acceptances: [
      {
        key_id: splitA.envelope.approvals[0].key_id,
        signature: splitB.envelope.approvals[0].signature
      }
    ],
    approvals: [],
    body: {},
    kind: "not-a-pulse"
  };
  const splitBCarriers = [
    {
      envelopeBytes: canonicalBytes(splitB.envelope),
      eventPayloadBytes: canonicalBytes({ wrong_sidecar: true })
    },
    {
      envelopeBytes: canonicalBytes(wrongKindEnvelope),
      eventPayloadBytes: canonicalBytes(splitB.payload)
    },
    {
      envelopeBytes: canonicalBytes(splitB.envelope)
    },
    {
      envelopeBytes: canonicalBytes(wrongBodyEnvelope)
    },
    {
      envelopeBytes: canonicalBytes(mislabeledEnvelope)
    }
  ];
  for (const splitBCarrier of splitBCarriers) {
    const splitApprovalLineage = createLineage(canonicalBytes(fixture.birth)).lineage;
    const splitApprovalFork = splitApprovalLineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [
        input(splitA),
        input(splitA),
        splitBCarrier,
        input(invalidConflict),
        input(fixture.branches[1])
      ],
      authorityLossIrreversible: true
    });
    assert.equal(splitApprovalFork.status, "forked");
  }

  const splitAcceptanceLineage = createLineage(canonicalBytes(fixture.birth)).lineage;
  const acceptanceA = structuredClone(fixture.twoNewCustodians);
  const acceptanceB = structuredClone(fixture.twoNewCustodians);
  acceptanceA.envelope.acceptances = acceptanceA.envelope.acceptances.slice(0, 1);
  acceptanceB.envelope.acceptances = acceptanceB.envelope.acceptances.slice(1);
  const misplacedAcceptance = {
    acceptances: [],
    approvals: [
      {
        key_id: acceptanceA.envelope.acceptances[0].key_id,
        signature: acceptanceB.envelope.acceptances[0].signature
      }
    ],
    body: {},
    kind: "not-a-pulse"
  };
  const splitAcceptanceFork = splitAcceptanceLineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      input(acceptanceA),
      { envelopeBytes: canonicalBytes(misplacedAcceptance) },
      input(fixture.branches[2])
    ],
    authorityLossIrreversible: true
  });
  assert.equal(splitAcceptanceFork.status, "forked");

  const detachedSidecarLineage = createLineage(canonicalBytes(fixture.birth)).lineage;
  const detachedSidecarFork = detachedSidecarLineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      { envelopeBytes: canonicalBytes(fixture.branches[0].envelope) },
      {
        envelopeBytes: canonicalBytes({}),
        eventPayloadBytes: canonicalBytes(fixture.branches[0].payload)
      },
      input(fixture.branches[1])
    ],
    authorityLossIrreversible: true
  });
  assert.equal(detachedSidecarFork.status, "forked");

  const distinctBodyLineage = createLineage(canonicalBytes(fixture.birth)).lineage;
  const distinctA = structuredClone(fixture.branches[0]);
  const distinctB = structuredClone(fixture.branches[1]);
  distinctA.envelope.approvals = distinctA.envelope.approvals.slice(0, 1);
  distinctB.envelope.approvals = distinctB.envelope.approvals.slice(1);
  const distinctBodies = distinctBodyLineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [input(distinctA), input(distinctB)],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  assert.equal(distinctBodies.status, "dead_under_v0_assumptions");
  assert.equal(distinctBodyLineage.isForked, false);
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
