import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes } from "../src/index.mjs";
import {
  createRelayControlMessage,
  decodeRelayMessageBytes
} from "../src/transport/protocol.mjs";
import { LiveEndpointParticipant } from "../lab/participant/live-endpoint.mjs";
import {
  assembleThreeEndpointGenesis,
  classifyEndpointStatus,
  createThreeEndpointGenesisBody,
  QuorumEndpointParticipant,
  QuorumProtocolError
} from "../lab/participant/quorum-endpoint.mjs";
import { pulseEnvelope } from "../lab/live-incubator.mjs";
import { r1AppendCandidates, r1VerifyCandidate } from "../lab/r1-client.mjs";

async function createPair(suffix = "") {
  const a = new LiveEndpointParticipant(`A${suffix}`);
  const genesis = await a.create();
  const b = new LiveEndpointParticipant(`B${suffix}`);
  const joinRequest = await b.join(genesis);
  return { a, b, genesis, joinRequest };
}

test("twenty independent A to B custody successions preserve identity and advance only with B", async () => {
  for (let index = 0; index < 20; index += 1) {
    const { a, b, joinRequest } = await createPair(String(index));
    const born = a.publicState;
    const proposal = await a.proposeHandoff(joinRequest);
    const handoff = await b.acceptHandoff(proposal);
    const movedAtB = b.publicState;
    const movedAtA = a.appendEvidence(handoff);
    assert.equal(movedAtA.organism_id, born.organism_id);
    assert.equal(movedAtB.organism_id, born.organism_id);
    assert.equal(movedAtA.head_hash, movedAtB.head_hash);
    assert.equal(movedAtA.sequence, "1");
    assert.equal(movedAtA.signing_authority, false);
    assert.equal(movedAtB.signing_authority, true);

    a.removeAuthority();
    await assert.rejects(() => a.nurture(), /lacks current signing authority/);
    const transition = await b.nurture();
    const continued = b.publicState;
    const observedByA = a.appendEvidence(transition);
    assert.equal(continued.organism_id, born.organism_id);
    assert.equal(continued.sequence, "2");
    assert.equal(continued.pulse_count, 1);
    assert.equal(observedByA.head_hash, continued.head_hash);
    assert.equal(observedByA.signing_authority, false);
    assert.doesNotMatch(JSON.stringify({
      a: a.publicState,
      b: b.publicState,
      evidence: b.records
    }), /"private_key"|private[_-]?bytes|pkcs8|CryptoKey/i);
  }
});

test("handoff controls are bounded public proposals and never relay verdicts", async () => {
  const { a, joinRequest } = await createPair("control");
  const joinBytes = canonicalBytes(createRelayControlMessage("join-request", joinRequest));
  const openedJoin = decodeRelayMessageBytes(joinBytes);
  assert.equal(openedJoin.control.kind, "join-request");
  assert.equal(openedJoin.record, null);
  assert.equal("accepted" in openedJoin.control.content, false);
  const proposal = await a.proposeHandoff(joinRequest);
  const proposalBytes = canonicalBytes(createRelayControlMessage("handoff-proposal", proposal));
  const openedProposal = decodeRelayMessageBytes(proposalBytes);
  assert.equal(openedProposal.control.kind, "handoff-proposal");
  assert.equal("verdict" in openedProposal.control.content, false);
  assert.equal("head_hash" in openedProposal.control.content, false);
});

test("premature A loss, missing acceptance, stale identity, and changed body fail closed", async () => {
  const premature = await createPair("premature");
  premature.a.removeAuthority();
  await assert.rejects(() => premature.a.proposeHandoff(premature.joinRequest), /cannot authorize/);
  assert.equal(premature.b.publicState.signing_authority, false);

  const missing = await createPair("missing");
  const proposal = await missing.a.proposeHandoff(missing.joinRequest);
  const incomplete = {
    envelope: pulseEnvelope(proposal.body, proposal.approvals),
    payload: proposal.payload
  };
  const missingResult = r1VerifyCandidate(
    missing.genesis.envelope,
    missing.b.records,
    incomplete
  ).outcome.result;
  assert.equal(missingResult.status, "reject");
  assert.equal(missingResult.code, "E_ACCEPTANCE_MISSING");

  const changed = structuredClone(proposal);
  changed.body.state_root = `sha256:${"A".repeat(43)}`;
  await assert.rejects(() => missing.b.acceptHandoff(changed), /handoff rejected locally/);
  assert.equal(missing.b.publicState.sequence, "0");

  const other = await createPair("other");
  await assert.rejects(() => other.a.proposeHandoff(missing.joinRequest), /cannot authorize/);
  assert.equal(other.a.publicState.sequence, "0");
});

async function createQuorumCluster(suffix = "") {
  const endpoints = ["A", "B", "C"].map((label) => new QuorumEndpointParticipant(`${label}${suffix}`));
  const custodians = await Promise.all(endpoints.map((endpoint) => endpoint.initializeKey()));
  const body = createThreeEndpointGenesisBody(custodians);
  const approvals = await Promise.all(endpoints.map((endpoint) => endpoint.approveGenesis(body)));
  const genesis = assembleThreeEndpointGenesis(body, approvals);
  for (const endpoint of endpoints) endpoint.openGenesis(genesis);
  return { approvals, body, endpoints, genesis };
}

test("all three 2-of-3 pairs survive the complementary endpoint loss without concentrating keys", async () => {
  for (let lostIndex = 0; lostIndex < 3; lostIndex += 1) {
    const { endpoints, genesis } = await createQuorumCluster(`pair${lostIndex}`);
    const born = endpoints[0].publicState;
    const lost = endpoints[lostIndex];
    const pair = endpoints.filter((_, index) => index !== lostIndex);
    lost.removeAuthority();
    const proposal = pair[0].createStateProposal(1);
    const firstApproval = await pair[0].approveProposal(proposal);
    const stalled = pair[0].evaluateProposal(proposal, [firstApproval]);
    assert.equal(stalled.status, "reject");
    assert.equal(stalled.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
    assert.equal(pair[0].evaluateAvailability({ usableKeyIds: [pair[0].custodian.key_id] }).status,
      "authority_unavailable_not_proven_dead");
    const approvals = [firstApproval, await pair[1].approveProposal(proposal)];
    const transition = pair[0].commitProposal(proposal, approvals);
    pair[1].appendEvidence(transition);
    lost.appendEvidence(transition);
    for (const endpoint of endpoints) {
      assert.equal(endpoint.publicState.organism_id, born.organism_id);
      assert.equal(endpoint.publicState.sequence, "1");
      assert.equal(endpoint.publicState.pulse_count, 1);
    }
    assert.equal(lost.publicState.current_custodian, false);
    for (const endpoint of pair) {
      assert.deepEqual(endpoint.keyInventory, {
        endpoint_id: endpoint.keyInventory.endpoint_id,
        key_count: 1,
        key_id: endpoint.keyInventory.key_id,
        non_extractable: true,
        private_export_rejected: true
      });
    }
    assert.equal(genesis.envelope.approvals.length, 3);
    assert.equal(genesis.envelope.body.initial_quorum.threshold, 2);
  }
});

test("B and C repair A with a new D acceptance, then B and D continue after C loss", async () => {
  const { endpoints: [a, b, c], genesis } = await createQuorumCluster("repair");
  const organismId = b.publicState.organism_id;
  const aKeyId = a.custodian.key_id;
  a.removeAuthority();
  const transitionProposal = b.createStateProposal(1);
  const transitionApprovals = await Promise.all([b, c].map((endpoint) => endpoint.approveProposal(transitionProposal)));
  const transition = b.commitProposal(transitionProposal, transitionApprovals);
  c.appendEvidence(transition);

  const d = new QuorumEndpointParticipant("Drepair");
  await d.initializeKey();
  d.openGenesis(genesis, [transition]);
  assert.equal(d.publicState.current_custodian, false);
  const repairPayload = {
    added_key_id: d.custodian.key_id,
    format: "mortalos-quorum-repair/1",
    removed_key_id: aKeyId
  };
  const repairProposal = b.createMembershipProposal({
    nextCustodians: [b.custodian, c.custodian, d.custodian],
    payload: repairPayload
  });
  const repairApprovals = await Promise.all([b, c].map((endpoint) => endpoint.approveProposal(repairProposal)));
  const dAcceptance = await d.acceptMembership(repairProposal);
  const repair = b.commitProposal(repairProposal, repairApprovals, [dAcceptance]);
  c.appendEvidence(repair);
  d.appendEvidence(repair);
  for (const endpoint of [b, c, d]) {
    assert.equal(endpoint.publicState.organism_id, organismId);
    assert.equal(endpoint.publicState.sequence, "2");
    assert.equal(endpoint.publicState.current_custodian, true);
    assert.equal(endpoint.keyInventory.key_count, 1);
  }

  c.removeAuthority();
  const continuedProposal = d.createStateProposal(1);
  const continuedApprovals = await Promise.all([b, d].map((endpoint) => endpoint.approveProposal(continuedProposal)));
  const continued = d.commitProposal(continuedProposal, continuedApprovals);
  b.appendEvidence(continued);
  assert.equal(d.publicState.organism_id, organismId);
  assert.equal(d.publicState.sequence, "3");
  assert.equal(d.publicState.pulse_count, 2);
  assert.equal(b.publicState.head_hash, d.publicState.head_hash);
  assert.doesNotMatch(JSON.stringify({ evidence: d.records, inventories: [b, c, d].map((entry) => entry.keyInventory) }),
    /private[_-]?key|privateKey|pkcs8|CryptoKey/i);
});

test("endpoint statuses remain distinct and a local signer refuses partition equivocation", async () => {
  assert.equal(classifyEndpointStatus({ keyAvailable: false, stateAvailable: true, transportAvailable: true, usableKeys: 2, threshold: 2 }), "key_lost");
  assert.equal(classifyEndpointStatus({ keyAvailable: true, stateAvailable: false, transportAvailable: true, usableKeys: 2, threshold: 2 }), "state_unavailable");
  assert.equal(classifyEndpointStatus({ keyAvailable: true, stateAvailable: true, transportAvailable: false, usableKeys: 2, threshold: 2 }), "transport_unavailable");
  assert.equal(classifyEndpointStatus({ keyAvailable: true, stateAvailable: true, transportAvailable: true, usableKeys: 1, threshold: 2 }), "authority_below_quorum");
  assert.equal(classifyEndpointStatus({ keyAvailable: true, stateAvailable: true, transportAvailable: true, usableKeys: 2, threshold: 2 }), "operational");

  const { endpoints: [a] } = await createQuorumCluster("equivocation");
  const left = a.createStateProposal(1);
  const right = a.createStateProposal(2);
  await a.approveProposal(left);
  await assert.rejects(() => a.approveProposal(right), (error) =>
    error instanceof QuorumProtocolError && error.code === "E_LOCAL_EQUIVOCATION_REFUSED");
});

test("out-of-order catch-up converges linearly and completed siblings become a visible fork", async () => {
  const { endpoints: [a, b, c], genesis } = await createQuorumCluster("catchup");
  const firstProposal = a.createStateProposal(1);
  const firstApprovals = await Promise.all([a, b].map((endpoint) => endpoint.approveProposal(firstProposal)));
  const first = a.commitProposal(firstProposal, firstApprovals);
  b.appendEvidence(first);
  c.appendEvidence(first);
  const secondProposal = b.createStateProposal(1);
  const secondApprovals = await Promise.all([b, c].map((endpoint) => endpoint.approveProposal(secondProposal)));
  const second = b.commitProposal(secondProposal, secondApprovals);

  const restartedObserver = new QuorumEndpointParticipant("observer");
  restartedObserver.openGenesis(genesis);
  const converged = restartedObserver.sync([second, first, second]);
  assert.equal(converged.status, "accepted");
  assert.equal(converged.sequence, "2");
  assert.equal(converged.head_hash, b.publicState.head_hash);

  const fork = JSON.parse(await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("./vectors/fork.json", import.meta.url), "utf8")));
  const forked = r1AppendCandidates(fork.genesis, [], [fork.first, fork.sibling]).outcome;
  assert.equal(forked.snapshot.status, "forked");
  assert.equal(forked.snapshot.head_hash, null);
  assert.equal(forked.results[1].code, "E_FORK_DETECTED");
  assert.equal(forked.results[1].equivocating_key_ids.length > 0, true);
});
