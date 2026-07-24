import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign
} from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  custodyAcceptanceMessage,
  derivePeerId,
  encodeBase64Url,
  pulseApprovalMessage
} from "../src/index.mjs";
import {
  createInitialState
} from "../src/state/engine.mjs";
import {
  assembleParticipantGenesis,
  classifyParticipantAvailability,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore,
  ParticipantCoreError,
  pulseEnvelope
} from "../lab/participant/core.mjs";
import {
  assertPortResult,
  assertPortShape,
  PARTICIPANT_OPERATION_FORMAT,
  PARTICIPANT_PORTS,
  PARTICIPANT_SNAPSHOT_FORMAT,
  portFailure,
  portSuccess
} from "../lab/participant/contracts.mjs";
import {
  createSeededParticipantSchedule,
  participantModelStep,
  runParticipantModelSchedule,
  runSeededParticipantCorpus
} from "../lab/participant/model.mjs";

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function publicActor(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

function signature(value, message) {
  return {
    key_id: value.key_id,
    signature: `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}`
  };
}

function operationSignature(value, request) {
  assert.equal(request.format, PARTICIPANT_OPERATION_FORMAT);
  assert.equal(request.key_id, value.key_id);
  assert.equal(request.operation, "sign");
  return signature(value, request.message);
}

function createCluster(size = 3, threshold = 2, seed = 7) {
  const actors = Array.from({ length: size }, actor).sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const body = createParticipantGenesisBody({
    custodians: actors.map(publicActor),
    initialQuorum: { type: "threshold", threshold },
    initialStateBytes: createInitialState(new Uint8Array(16).fill(seed)),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(seed + 1))}`
  });
  const approvals = actors.map((entry) => operationSignature(entry, genesisSigningRequest(body, entry.key_id)));
  const genesis = assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals: true });
  const cores = actors.map((_, index) => {
    const core = new ParticipantCore(`core${seed}_${index}`);
    core.openGenesis(genesis, [], { requireAllOriginApprovals: true });
    return core;
  });
  return { actors, body, cores, genesis };
}

function approve(core, proposal, actorValue) {
  return operationSignature(actorValue, core.approvalRequest(proposal, actorValue.key_id));
}

test("versioned participant contracts are exact, bounded, and fail closed", () => {
  const empty = new ParticipantCore("empty").snapshot();
  assert.equal(empty.format, PARTICIPANT_SNAPSHOT_FORMAT);
  assert.deepEqual(empty, new ParticipantCore("empty").snapshot());
  const unopened = new ParticipantCore("unopened");
  assert.equal(unopened.genesisRecord, null);
  assert.throws(() => unopened.createJoinRequest({}, "join:test"), (error) => error.code === "E_LINEAGE_MISSING");
  assert.throws(() => unopened.createStateProposal(), (error) => error.code === "E_LINEAGE_MISSING");
  assert.throws(() => unopened.evaluateEvidence({}), (error) => error.code === "E_LINEAGE_MISSING");
  assert.throws(() => unopened.sync([]), (error) => error.code === "E_LINEAGE_MISSING");
  assert.throws(() => unopened.evaluateAvailability({}), (error) => error.code === "E_LINEAGE_MISSING");
  assert.throws(() => new ParticipantCore("invalid endpoint"), /bounded endpoint ID/);
  assert.deepEqual(assertPortResult(portSuccess({ value: 1 })), { value: 1 });
  assert.throws(
    () => assertPortResult(portFailure("E_PORT_TIMEOUT", "clock expired")),
    (error) => error.code === "E_PORT_TIMEOUT"
  );
  assert.throws(() => portFailure("E_UNKNOWN"), /unsupported participant port failure/);
  assert.throws(() => portFailure("E_PORT_IO_FAILURE", 4), /detail must be text/);
  assert.throws(() => assertPortResult({ ok: true }), /unversioned/);
  assert.throws(() => assertPortResult({ format: "mortalos-participant-port/1", ok: true }), /corrupt/);
  for (const [name, methods] of Object.entries(PARTICIPANT_PORTS)) {
    const port = Object.fromEntries(methods.map((method) => [method, () => portSuccess()]));
    assert.equal(assertPortShape(port, name), port);
  }
  assert.throws(() => assertPortShape({}, "KeyStore"), /KeyStore\.create/);
  assert.throws(() => assertPortShape({}, "Unknown"), /unknown participant port/);
});

test("one core owns Genesis, proposal, signing request, append, replay, and deterministic snapshot", () => {
  const { actors, cores: [core], genesis } = createCluster();
  assert.equal(core.genesisRecord.envelope.kind, "mortalos.genesis");
  assert.equal(core.records.length, 1);
  assert.equal(core.snapshot({ keyCount: 1, keyId: actors[0].key_id }).current_custodian, true);
  const proposal = core.createStateProposal(2);
  const first = approve(core, proposal, actors[0]);
  const below = core.evaluateProposal(proposal, [first]);
  assert.equal(below.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
  const second = approve(core, proposal, actors[1]);
  const record = core.commitProposal(proposal, [second, first]);
  const snapshot = core.snapshot({ keyCount: 1, keyId: actors[0].key_id });
  assert.equal(snapshot.sequence, "1");
  assert.equal(snapshot.pulse_count, 2);
  assert.equal(core.evaluateEvidence(record).code, "E_REPLAY_STALE");
  assert.throws(() => core.appendEvidence(record), (error) =>
    error instanceof ParticipantCoreError && error.code === "E_REPLAY_STALE");
  assert.throws(() => core.openGenesis(genesis), (error) =>
    error instanceof ParticipantCoreError && error.code === "E_LINEAGE_ALREADY_INITIALIZED");
});

test("sign-once refuses a conflicting tuple but permits distinct custodians on the exact body", () => {
  const { actors, cores: [core] } = createCluster(3, 2, 12);
  const left = core.createStateProposal(1);
  const right = core.createStateProposal(2);
  approve(core, left, actors[0]);
  approve(core, left, actors[1]);
  assert.throws(() => core.approvalRequest(right, actors[0].key_id), (error) =>
    error instanceof ParticipantCoreError && error.code === "E_LOCAL_EQUIVOCATION_REFUSED");
  assert.equal(core.approvalRequest(right, actors[2].key_id).purpose, "pulse-approval");
  assert.throws(() => core.approvalRequest(left, "peer:missing"), (error) =>
    error instanceof ParticipantCoreError && error.code === "E_AUTHORITY_UNAVAILABLE");
  assert.throws(() => core.approvalRequest(left, null), (error) =>
    error instanceof ParticipantCoreError && error.code === "E_AUTHORITY_UNAVAILABLE");
});

test("single-custodian join and handoff use the same core and require new-custodian acceptance", () => {
  const { actors: [origin], cores: [source], genesis } = createCluster(1, 1, 21);
  const successor = actor();
  const target = new ParticipantCore("target");
  target.openGenesis(genesis);
  const join = target.createJoinRequest(
    publicActor(successor),
    `join:${encodeBase64Url(new Uint8Array(16).fill(9))}`
  );
  const proposal = source.createHandoffProposal(join, origin.key_id);
  const approval = approve(source, proposal, origin);
  const wireProposal = { ...proposal, approvals: [approval] };
  const acceptanceRequest = target.acceptanceRequest(wireProposal, successor.key_id, { handoff: true });
  const acceptance = operationSignature(successor, acceptanceRequest);
  const record = target.commitProposal(wireProposal, [approval], [acceptance]);
  source.appendEvidence(record);
  assert.equal(source.snapshot({ keyCount: 1, keyId: origin.key_id }).current_custodian, false);
  assert.equal(target.snapshot({ keyCount: 1, keyId: successor.key_id }).current_custodian, true);
  assert.throws(() => target.createJoinRequest(publicActor(successor), "bad"), /tagged join nonce/);
  assert.throws(() => source.createHandoffProposal({ ...join, format: "bad" }, origin.key_id), /unsupported join/);
  assert.throws(
    () => target.acceptanceRequest({ ...wireProposal, payload: { ...wireProposal.payload, to_key_id: origin.key_id } },
      successor.key_id, { handoff: true }),
    (error) => error.code === "E_HANDOFF_IDENTITY"
  );
});

test("membership repair acceptance, catch-up ordering, and fork projection are core decisions", () => {
  const { actors, cores: [writer], genesis } = createCluster(3, 2, 31);
  const firstProposal = writer.createStateProposal(1);
  const first = writer.commitProposal(firstProposal, [
    approve(writer, firstProposal, actors[0]),
    approve(writer, firstProposal, actors[1])
  ]);
  const secondProposal = writer.createStateProposal(1);
  const second = writer.commitProposal(secondProposal, [
    approve(writer, secondProposal, actors[0]),
    approve(writer, secondProposal, actors[1])
  ]);
  const observer = new ParticipantCore("observer");
  observer.openGenesis(genesis);
  const converged = observer.sync([second, first, second]);
  assert.equal(converged.sequence, "2");
  const convergedHead = converged.head_hash;
  const convergedRecords = observer.records;
  assert.deepEqual(
    [observer.sync([]), observer.sync([first]), observer.sync([first, first]), observer.sync([second, first])]
      .map((snapshot) => ({
        head_hash: snapshot.head_hash,
        pulse_count: snapshot.pulse_count,
        sequence: snapshot.sequence,
        status: snapshot.status
      })),
    Array.from({ length: 4 }, () => ({
      head_hash: convergedHead,
      pulse_count: 2,
      sequence: "2",
      status: "accepted"
    }))
  );
  const stalePeer = new ParticipantCore("stale-peer");
  stalePeer.openGenesis(genesis);
  stalePeer.sync([first]);
  const afterStalePeer = observer.sync(stalePeer.records);
  assert.equal(afterStalePeer.head_hash, convergedHead);
  assert.equal(afterStalePeer.sequence, "2");
  assert.deepEqual(observer.records, convergedRecords);

  const replacement = actor();
  const repair = writer.createMembershipProposal({
    nextCustodians: [publicActor(actors[0]), publicActor(actors[1]), publicActor(replacement)],
    nextQuorum: { type: "threshold", threshold: 2 },
    payload: { format: "repair/1", removed: actors[2].key_id }
  });
  const request = writer.acceptanceRequest(repair, replacement.key_id);
  assert.equal(request.purpose, "custody-acceptance");
  assert.throws(() => writer.acceptanceRequest(repair, actors[0].key_id), (error) =>
    error.code === "E_ACCEPTANCE_NOT_NEW_CUSTODIAN");

  const forkBase = createCluster(3, 2, 32);
  const leftProposal = forkBase.cores[0].createStateProposal(1);
  const rightProposal = forkBase.cores[0].createStateProposal(2);
  const rawApprovals = (proposal) => forkBase.actors.slice(0, 2)
    .map((entry) => signature(entry, pulseApprovalMessage(proposal.body)));
  const left = {
    envelope: pulseEnvelope(leftProposal.body, rawApprovals(leftProposal)),
    payload: leftProposal.payload
  };
  const right = {
    envelope: pulseEnvelope(rightProposal.body, rawApprovals(rightProposal)),
    payload: rightProposal.payload
  };
  const forkObserver = new ParticipantCore("fork");
  forkObserver.openGenesis(forkBase.genesis);
  const forkSnapshot = forkObserver.sync([right, left]);
  assert.equal(forkSnapshot.status, "forked");
  assert.equal(forkSnapshot.head_hash, null);
  assert.equal(forkSnapshot.fork_points.length > 0, true);
  assert.equal(forkObserver.sync([]).status, "forked");
  assert.equal(forkObserver.sync([left]).status, "forked");

  const beforeInvalidRecords = forkObserver.records;
  const beforeInvalidSnapshot = forkObserver.snapshot();
  const corruptAfterFork = structuredClone(left);
  corruptAfterFork.payload.next_state_base64url = "corrupt";
  const malformedAfterFork = structuredClone(left);
  malformedAfterFork.envelope.extra = true;
  const belowQuorumAfterFork = structuredClone(left);
  belowQuorumAfterFork.envelope.approvals = belowQuorumAfterFork.envelope.approvals.slice(0, 1);
  for (const [record, code] of [
    [corruptAfterFork, "E_EVENT_PAYLOAD_MISMATCH"],
    [malformedAfterFork, "E_SCHEMA_UNKNOWN_FIELD"],
    [belowQuorumAfterFork, "E_APPROVAL_INSUFFICIENT_QUORUM"]
  ]) {
    assert.throws(() => forkObserver.sync([record]), (error) => error.code === code);
    assert.deepEqual(forkObserver.records, beforeInvalidRecords);
    assert.deepEqual(forkObserver.snapshot(), beforeInvalidSnapshot);
  }
});

test("named failures remain distinct for malformed state, stale parent, corrupt evidence, and availability", () => {
  assert.throws(
    () => createParticipantGenesisBody({
      custodians: [],
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes: null,
      nonce: "nonce:x"
    }),
    (error) => error.code === "E_STATE_MISSING"
  );
  assert.throws(
    () => createParticipantGenesisBody({
      custodians: [],
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes: new Uint8Array(),
      nonce: "bad"
    }),
    (error) => error.code === "E_PARTICIPANT_NONCE"
  );
  const { actors, cores: [core] } = createCluster(3, 2, 41);
  const stale = core.createStateProposal(1);
  const accepted = core.createStateProposal(2);
  core.commitProposal(accepted, [approve(core, accepted, actors[0]), approve(core, accepted, actors[1])]);
  assert.throws(
    () => core.commitProposal(stale, [
      signature(actors[0], pulseApprovalMessage(stale.body)),
      signature(actors[1], pulseApprovalMessage(stale.body))
    ]),
    (error) => error.code === "E_FORK_DETECTED"
  );
  const corrupt = structuredClone(core.records.at(-1));
  corrupt.payload.steps = 999;
  assert.throws(() => new ParticipantCore("unopened").appendEvidence(corrupt), (error) =>
    error.code === "E_LINEAGE_MISSING");
  assert.deepEqual([
    classifyParticipantAvailability({ keyAvailable: false, stateAvailable: true, transportAvailable: true, usableKeys: 2, threshold: 2 }),
    classifyParticipantAvailability({ keyAvailable: true, stateAvailable: false, transportAvailable: true, usableKeys: 2, threshold: 2 }),
    classifyParticipantAvailability({ keyAvailable: true, stateAvailable: true, transportAvailable: false, usableKeys: 2, threshold: 2 }),
    classifyParticipantAvailability({ keyAvailable: true, stateAvailable: true, transportAvailable: true, usableKeys: 1, threshold: 2 }),
    classifyParticipantAvailability({ keyAvailable: true, stateAvailable: true, transportAvailable: true, usableKeys: 2, threshold: 2 })
  ], [
    "key_lost",
    "state_unavailable",
    "transport_unavailable",
    "authority_below_quorum",
    "operational"
  ]);
  assert.equal(core.evaluateAvailability({ usableKeyIds: [actors[0].key_id] }).status,
    "authority_unavailable_not_proven_dead");
});

test("core rejection branches cover malformed contracts, incomplete origin consent, and non-linear history", () => {
  const cluster = createCluster(3, 2, 51);
  const [core] = cluster.cores;
  assert.equal(core.endpointId, "core51_0");
  assert.equal(core.initialized, true);
  assert.throws(
    () => assembleParticipantGenesis(cluster.body, cluster.body.initial_custodians.slice(0, 1), {
      requireAllOriginApprovals: true
    }),
    (error) => error.code === "E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED"
  );
  const thresholdGenesis = {
    envelope: {
      ...cluster.genesis.envelope,
      approvals: cluster.genesis.envelope.approvals.slice(0, 2)
    },
    payload: {}
  };
  assert.throws(
    () => new ParticipantCore("strict").openGenesis(thresholdGenesis, [], { requireAllOriginApprovals: true }),
    (error) => error.code === "E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED"
  );
  assert.throws(() => core.createHandoffProposal(null, cluster.actors[0].key_id), (error) =>
    error.code === "E_PARTICIPANT_SCHEMA");
  assert.throws(() => core.createHandoffProposal([], cluster.actors[0].key_id), (error) =>
    error.code === "E_PARTICIPANT_SCHEMA");
  const successor = actor();
  const validJoin = {
    custodian: publicActor(successor),
    format: "mortalos-join-request/1",
    nonce: "join:test",
    organism_id: core.snapshot().organism_id
  };
  assert.throws(
    () => core.createHandoffProposal({ ...validJoin, extra: true }, cluster.actors[0].key_id),
    (error) => error.code === "E_PARTICIPANT_SCHEMA"
  );
  assert.throws(
    () => core.createHandoffProposal({
      ...validJoin,
      custodian: { ...validJoin.custodian, key_id: cluster.actors[0].key_id }
    }, cluster.actors[0].key_id),
    (error) => error.code === "E_JOIN_KEY_IDENTITY"
  );
  assert.throws(
    () => core.createHandoffProposal({ ...validJoin, organism_id: "mortalos:wrong" }, cluster.actors[0].key_id),
    (error) => error.code === "E_AUTHORITY_UNAVAILABLE"
  );
  assert.throws(() => new ParticipantCore("none").acceptanceRequest({}, null), (error) =>
    error.code === "E_AUTHORITY_UNAVAILABLE");
  assert.throws(() => core.acceptanceRequest({}, null), (error) =>
    error.code === "E_AUTHORITY_UNAVAILABLE");

  const handoff = core.createHandoffProposal(validJoin, cluster.actors[0].key_id);
  const approval = approve(core, handoff, cluster.actors[0]);
  const wire = { ...handoff, approvals: [approval] };
  assert.throws(
    () => core.acceptanceRequest({ ...wire, format: "wrong" }, successor.key_id, { handoff: true }),
    (error) => error.code === "E_PARTICIPANT_SCHEMA"
  );
  const stateProposal = core.createStateProposal(1);
  assert.throws(() => core.acceptanceRequest(stateProposal, successor.key_id), (error) =>
    error.code === "E_PARTICIPANT_SCHEMA");
  assert.throws(
    () => core.approvalRequest({ ...stateProposal, format: "wrong" }, cluster.actors[0].key_id),
    (error) => error.code === "E_PARTICIPANT_SCHEMA"
  );
  assert.throws(
    () => core.approvalRequest({ ...stateProposal, extra: true }, cluster.actors[0].key_id),
    (error) => error.code === "E_PARTICIPANT_SCHEMA"
  );
  const malformed = structuredClone(stateProposal);
  malformed.body.state_root = `sha256:${"A".repeat(43)}`;
  assert.throws(
    () => core.approvalRequest(malformed, cluster.actors[0].key_id),
    (error) => error.code !== "E_APPROVAL_INSUFFICIENT_QUORUM"
  );
  assert.equal(core.createHeartbeatProposal().body.event.kind, "heartbeat");

  const forkCluster = createCluster(3, 2, 52);
  const leftProposal = forkCluster.cores[0].createStateProposal(1);
  const rightProposal = forkCluster.cores[0].createStateProposal(2);
  const signedRecord = (proposal) => ({
    envelope: pulseEnvelope(
      proposal.body,
      forkCluster.actors.slice(0, 2).map((entry) => signature(entry, pulseApprovalMessage(proposal.body)))
    ),
    payload: proposal.payload
  });
  const forked = new ParticipantCore("nonlinear");
  forked.openGenesis(forkCluster.genesis);
  forked.sync([signedRecord(leftProposal), signedRecord(rightProposal)]);
  assert.throws(() => forked.createHeartbeatProposal(), (error) => error.code === "E_LINEAGE_NOT_LINEAR");
  const invalidHistory = structuredClone(signedRecord(leftProposal));
  invalidHistory.payload.next_state_base64url = "corrupt";
  assert.throws(() => new ParticipantCore("history").openGenesis(forkCluster.genesis, [invalidHistory]),
    (error) => error instanceof ParticipantCoreError);
});

test("core short-circuit branches stay fail-closed under type, identity, and transport substitutions", () => {
  assert.throws(() => new ParticipantCore(null), /bounded endpoint ID/);
  assert.equal(classifyParticipantAvailability({
    keyAvailable: true,
    stateAvailable: true,
    transportAvailable: true,
    usableKeys: 1.5,
    threshold: 2
  }), "authority_below_quorum");
  assert.equal(classifyParticipantAvailability({
    keyAvailable: true,
    stateAvailable: true,
    transportAvailable: true,
    usableKeys: 2,
    threshold: 2.5
  }), "authority_below_quorum");
  assert.throws(
    () => createParticipantGenesisBody({
      custodians: [],
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes: new Uint8Array(),
      nonce: null
    }),
    (error) => error.code === "E_PARTICIPANT_NONCE"
  );

  const cluster = createCluster(3, 2, 61);
  const core = cluster.cores[0];
  assert.equal(
    assembleParticipantGenesis(cluster.body, [...cluster.genesis.envelope.approvals].reverse())
      .envelope.approvals.length,
    3
  );
  const wrongApprovals = structuredClone(cluster.genesis.envelope.approvals);
  wrongApprovals[0].key_id = wrongApprovals[1].key_id;
  assert.throws(
    () => assembleParticipantGenesis(cluster.body, wrongApprovals, { requireAllOriginApprovals: true }),
    (error) => error.code === "E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED"
  );
  assert.equal(core.snapshot({ keyCount: 1, keyId: "peer:not-current" }).current_custodian, false);
  assert.throws(() => core.createJoinRequest(publicActor(actor()), null), /tagged join nonce/);

  const successor = actor();
  const join = core.createJoinRequest(publicActor(successor), "join:branch");
  assert.throws(() => core.createHandoffProposal(join, null), (error) =>
    error.code === "E_AUTHORITY_UNAVAILABLE");
  const handoff = core.createHandoffProposal(join, cluster.actors[0].key_id);
  const wire = { ...handoff, approvals: [approve(core, handoff, cluster.actors[0])] };
  for (const changed of [
    { ...wire, body: { ...wire.body, organism_id: "mortalos:wrong" } },
    { ...wire, body: { ...wire.body, next_custodians: [] } },
    {
      ...wire,
      body: {
        ...wire.body,
        next_custodians: [{ ...wire.body.next_custodians[0], key_id: cluster.actors[0].key_id }]
      }
    }
  ]) {
    assert.throws(() => core.acceptanceRequest(changed, successor.key_id, { handoff: true }), (error) =>
      error.code === "E_HANDOFF_IDENTITY");
  }

  const proposal = core.createStateProposal(1);
  const one = signature(cluster.actors[0], pulseApprovalMessage(proposal.body));
  assert.notEqual(core.evaluateProposal(proposal, [one, one]).status, "accept");
  const observer = new ParticipantCore("transport");
  observer.openGenesis(cluster.genesis);
  const invalid = {
    envelope: pulseEnvelope(proposal.body, [one]),
    payload: proposal.payload
  };
  assert.throws(() => observer.sync([
    { envelope: { kind: "ignored" }, payload: {} },
    invalid
  ]), (error) => error instanceof ParticipantCoreError);
  assert.equal(core.evaluateAvailability({
    authorityLossIrreversible: true,
    latentEvidenceComplete: true,
    pendingSuccessors: [],
    stateAvailable: false,
    usableKeyIds: cluster.actors.map((entry) => entry.key_id)
  }).status, "state_stalled");
});

test("model corpus exposes every required rejection and is byte-deterministic across 10,000 seeds", () => {
  let state = runParticipantModelSchedule([]).final_state;
  const events = [
    { available: false, name: "state_available", type: "capability" },
    { candidate: "missing", parent: 0, type: "propose" },
    { available: true, name: "state_available", type: "capability" },
    { candidate: "left", parent: 0, type: "propose" },
    { key_id: "A", type: "approve" },
    { key_id: "A", type: "approve" },
    { available: false, name: "transport_available", type: "capability" },
    { key_id: "B", type: "approve" },
    { available: true, name: "transport_available", type: "capability" },
    { key_id: "B", type: "approve" },
    { evidence_valid: false, parent: 0, type: "append" },
    { evidence_valid: true, parent: 1, type: "append" },
    { evidence_valid: true, parent: 0, type: "append" }
  ];
  const trace = runParticipantModelSchedule(events);
  const codes = new Set(trace.outcomes.map((entry) => entry.code));
  for (const code of [
    "E_STATE_MISSING",
    "E_APPROVAL_INSUFFICIENT_QUORUM",
    "E_SIGNATURE_DUPLICATE",
    "E_TRANSPORT_UNAVAILABLE",
    "E_EVIDENCE_CORRUPT",
    "E_PARENT_STALE",
    "APPENDED"
  ]) {
    assert.equal(codes.has(code), true, code);
  }
  const proposed = participantModelStep(state, { candidate: "left", parent: 0, type: "propose" });
  state = participantModelStep(proposed.state, { key_id: "A", type: "approve" }).state;
  state.candidate = "right";
  assert.equal(participantModelStep(state, { key_id: "A", type: "approve" }).code,
    "E_LOCAL_EQUIVOCATION_REFUSED");
  assert.equal(participantModelStep(state, null).code, "E_MODEL_EVENT_INVALID");
  assert.equal(participantModelStep(state, { type: "unknown" }).code, "E_MODEL_EVENT_INVALID");
  assert.throws(() => createSeededParticipantSchedule(-1), /bounded participant/);
  assert.throws(() => runSeededParticipantCorpus(10_001), /1 through 10000/);
  const left = JSON.stringify(runSeededParticipantCorpus(10_000, 12));
  const right = JSON.stringify(runSeededParticipantCorpus(10_000, 12));
  assert.equal(left, right);
});

test("presentation and participant adapters cannot import low-level authority constructors", async () => {
  const adapters = [
    "../lab/app.mjs",
    "../lab/live-incubator.mjs",
    "../lab/participant/live-endpoint.mjs",
    "../lab/participant/quorum-endpoint.mjs",
    "../lab/participant/durable-participant.mjs"
  ];
  for (const path of adapters) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:r1-client|protocol-objects|validator|lineage)\.mjs["']/);
    assert.doesNotMatch(source, /\br1(?:ValidateGenesis|VerifyCandidate|AppendCandidates|ReplayLineage|EvaluateMortality)\b/);
    assert.doesNotMatch(source, /\b(?:genesisApprovalMessage|pulseApprovalMessage|custodyAcceptanceMessage)\b/);
  }
  const coreSource = await readFile(new URL("../lab/participant/core.mjs", import.meta.url), "utf8");
  assert.match(coreSource, /from "\.\/protocol-objects\.mjs"/);
  assert.match(coreSource, /r1AppendCandidates/);
});
