import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as publicApi from "../src/index.mjs";
import {
  canonicalBytes,
  createLineage,
  custodyCommitment,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  pulseApprovalMessage,
  validateLatentSuccessor
} from "../src/index.mjs";
import { canonical, clone, vector } from "./helpers.mjs";

const forkVector = JSON.parse(
  readFileSync(new URL("./vectors/fork.json", import.meta.url), "utf8")
);

function openThrough(stepCount) {
  const opened = createLineage(canonical(vector.birth));
  assert.equal(opened.status, "accept");
  for (const step of vector.steps.slice(0, stepCount)) {
    const accepted = opened.lineage.append({
      envelopeBytes: canonical(step.envelope),
      eventPayloadBytes: canonical(step.payload)
    });
    assert.equal(accepted.status, "accept");
  }
  return opened.lineage;
}

function rawStep(step) {
  return {
    envelopeBytes: canonical(step.envelope),
    eventPayloadBytes: canonical(step.payload)
  };
}

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

function completionScenario() {
  const actors = Array.from({ length: 3 }, makeActor).sort((left, right) =>
    left.key_id < right.key_id ? -1 : 1
  );
  const custodians = actors.map(publicActor);
  const quorum = { type: "threshold", threshold: 2 };
  const genesisBody = {
    protocol_version: "mortalos/0",
    hash_algorithm: "sha-256",
    signature_algorithm: "ed25519",
    genome_hash: tagged("sha256:", 32, 81),
    initial_state_root: tagged("sha256:", 32, 82),
    initial_custodians: custodians,
    initial_quorum: quorum,
    nonce: tagged("nonce:", 16, 83)
  };
  const birth = {
    kind: "mortalos.genesis",
    body: genesisBody,
    approvals: actors.map((actor) => ({
      key_id: actor.key_id,
      signature: signature(actor, genesisApprovalMessage(genesisBody))
    }))
  };
  const opened = createLineage(canonicalBytes(birth));
  assert.equal(opened.status, "accept");

  const makeBody = (nextThreshold, event) => ({
    protocol_version: "mortalos/0",
    organism_id: opened.lineage.genesis.organism_id,
    sequence: "1",
    parent_hash: opened.lineage.genesis.object_hash,
    genome_hash: opened.lineage.genesis.genome_hash,
    current_custody_hash: custodyCommitment(opened.lineage.genesis.next_custody_descriptor),
    state_root: opened.lineage.genesis.next_state_root,
    event: { kind: event.kind, payload_hash: eventPayloadHash(event.payload) },
    next_custodians: custodians,
    next_quorum: { type: "threshold", threshold: nextThreshold }
  });
  const envelope = (body, signers) => ({
    kind: "mortalos.pulse",
    body,
    approvals: signers.map((actor) => ({
      key_id: actor.key_id,
      signature: signature(actor, pulseApprovalMessage(body))
    })).sort((left, right) => left.key_id < right.key_id ? -1 : 1),
    acceptances: []
  });
  return { actors, envelope, lineage: opened.lineage, makeBody };
}

test("public API does not expose a caller-selected-head mortality evaluator", () => {
  assert.equal("evaluateMortality" in publicApi, false);
  assert.equal("evaluateMortalityState" in publicApi, false);
  assert.equal("validateCompletionFragment" in publicApi, false);
  assert.equal("isValidatedCompletionFragment" in publicApi, false);
  assert.equal("validateOpaqueCompletionFragment" in publicApi, false);
  assert.equal("validateMortalitySuccessor" in publicApi, false);
  assert.equal("isValidatedMortalitySuccessor" in publicApi, false);
  assert.equal("validateOpaqueMortalitySuccessor" in publicApi, false);

  const { lineage } = completionScenario();
  const leakedConstructor = lineage.constructor;
  assert.throws(() => new leakedConstructor(lineage.genesis), TypeError);
  assert.throws(() => new leakedConstructor(Symbol("forged"), lineage.genesis), TypeError);
});

test("mortality combines durable approvals with a surviving signer before declaring death", () => {
  const { actors, envelope, lineage, makeBody } = completionScenario();
  const payload = { mode: "raise-threshold" };
  const body = makeBody(3, { kind: "membership-change", payload });
  const durable = envelope(body, actors.slice(0, 2));
  const raw = { envelopeBytes: canonicalBytes(durable), eventPayloadBytes: canonicalBytes(payload) };

  assert.equal(lineage.verifyCandidate(raw).code, "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT");
  assert.equal(
    validateLatentSuccessor({ genesis: lineage.genesis, parent: lineage.head, ...raw }).code,
    "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT"
  );
  assert.deepEqual(lineage.evaluateMortality({
    usableKeyIds: [actors[2].key_id],
    stateAvailable: true,
    pendingSuccessors: [raw, raw],
    authorityLossIrreversible: true
  }), {
    status: "latent_successor_not_dead",
    authority_viable: false,
    state_viable: true,
    usable_keys: 1,
    threshold: 2,
    latent_successors: 1
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [raw],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");

  const mutableUsableKeyIds = [];
  let envelopeGetterCalled = false;
  const accessorEvidence = { eventPayloadBytes: raw.eventPayloadBytes };
  Object.defineProperty(accessorEvidence, "envelopeBytes", {
    enumerable: true,
    get() {
      envelopeGetterCalled = true;
      mutableUsableKeyIds.push(actors[2].key_id);
      return raw.envelopeBytes;
    }
  });
  assert.throws(() => lineage.evaluateMortality({
    usableKeyIds: mutableUsableKeyIds,
    stateAvailable: true,
    pendingSuccessors: [accessorEvidence],
    authorityLossIrreversible: true
  }), /envelopeBytes must be an own data property/);
  assert.equal(envelopeGetterCalled, false);
  assert.deepEqual(mutableUsableKeyIds, []);

  const usableBeforePendingGetter = [actors[2].key_id];
  let pendingGetterCalled = false;
  assert.throws(() => lineage.evaluateMortality({
    usableKeyIds: usableBeforePendingGetter,
    stateAvailable: true,
    get pendingSuccessors() {
      pendingGetterCalled = true;
      usableBeforePendingGetter.length = 0;
      return [raw];
    },
    authorityLossIrreversible: true
  }), /options\.pendingSuccessors must be an own data property/);
  assert.equal(pendingGetterCalled, false);
  assert.deepEqual(usableBeforePendingGetter, [actors[2].key_id]);

  const completed = envelope(body, actors);
  const accepted = lineage.append({
    envelopeBytes: canonicalBytes(completed),
    eventPayloadBytes: canonicalBytes(payload)
  });
  assert.equal(accepted.status, "accept");
  assert.equal(accepted.object_hash, lineage.head.object_hash);
});

test("mortality unions verified fragments only for the same body", () => {
  const { actors, envelope, lineage, makeBody } = completionScenario();
  const heartbeat = makeBody(2, { kind: "heartbeat", payload: {} });
  const first = {
    envelopeBytes: canonicalBytes(envelope(heartbeat, [actors[0]])),
    eventPayloadBytes: canonicalBytes({})
  };
  const second = {
    envelopeBytes: canonicalBytes(envelope(heartbeat, [actors[1]])),
    eventPayloadBytes: canonicalBytes({})
  };
  assert.equal(lineage.verifyCandidate(first).code, "E_APPROVAL_INSUFFICIENT_QUORUM");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [first, second],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const poisonedAcceptance = structuredClone(envelope(heartbeat, [actors[0]]));
  poisonedAcceptance.acceptances.push({
    key_id: actors[0].key_id,
    signature: tagged("ed25519:", 64, 0)
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(poisonedAcceptance),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const poisonedApproval = structuredClone(envelope(heartbeat, [actors[0]]));
  poisonedApproval.approvals.push({
    key_id: actors[1].key_id,
    signature: tagged("ed25519:", 64, 0)
  });
  poisonedApproval.approvals.sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(poisonedApproval),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  for (const poisonedKind of ["poison", undefined]) {
    const outerPoison = structuredClone(envelope(heartbeat, [actors[0]]));
    if (poisonedKind === undefined) delete outerPoison.kind;
    else outerPoison.kind = poisonedKind;
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [actors[1].key_id],
      stateAvailable: true,
      pendingSuccessors: [{
        envelopeBytes: canonicalBytes(outerPoison),
        eventPayloadBytes: canonicalBytes({})
      }],
      authorityLossIrreversible: true
    }).status, "latent_successor_not_dead");
  }

  for (const poisonedKeyId of [actors[2].key_id, undefined]) {
    const keyHintPoison = structuredClone(envelope(heartbeat, [actors[0]]));
    if (poisonedKeyId === undefined) delete keyHintPoison.approvals[0].key_id;
    else keyHintPoison.approvals[0].key_id = poisonedKeyId;
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [actors[1].key_id],
      stateAvailable: true,
      pendingSuccessors: [{
        envelopeBytes: canonicalBytes(keyHintPoison),
        eventPayloadBytes: canonicalBytes({})
      }],
      authorityLossIrreversible: true
    }).status, "latent_successor_not_dead");
  }

  const wrongEvidenceArray = structuredClone(envelope(heartbeat, [actors[0]]));
  wrongEvidenceArray.acceptances = wrongEvidenceArray.approvals;
  wrongEvidenceArray.approvals = [];
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(wrongEvidenceArray),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const duplicateApproval = structuredClone(envelope(heartbeat, [actors[0]]));
  duplicateApproval.approvals.push(structuredClone(duplicateApproval.approvals[0]));
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(duplicateApproval),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
  const completeHeartbeat = canonicalBytes(envelope(heartbeat, actors.slice(0, 2)));
  for (const unusablePayload of [
    Uint8Array.of(0xff),
    canonicalBytes({ poison: true })
  ]) {
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [{
        envelopeBytes: completeHeartbeat,
        eventPayloadBytes: unusablePayload
      }],
      authorityLossIrreversible: true
    }).status, "latent_successor_not_dead");
  }
  assert.equal(lineage.verifyCandidate({
    envelopeBytes: completeHeartbeat,
    eventPayloadBytes: canonicalBytes({ poison: true })
  }).code, "E_EVENT_PAYLOAD_MISMATCH");

  const unsortedApprovals = structuredClone(envelope(heartbeat, actors.slice(0, 2)));
  unsortedApprovals.approvals.reverse();
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(unsortedApprovals),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const reparableEncoding = envelope(heartbeat, [actors[0]]);
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: new TextEncoder().encode(JSON.stringify(reparableEncoding, null, 2)),
      eventPayloadBytes: new TextEncoder().encode("{ }")
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(envelope(heartbeat, actors.slice(0, 2)))
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [first],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const thresholdRaisePayload = { mode: "raise-threshold" };
  const thresholdRaise = makeBody(3, {
    kind: "membership-change",
    payload: thresholdRaisePayload
  });
  const differentBody = {
    envelopeBytes: canonicalBytes(envelope(thresholdRaise, [actors[1]])),
    eventPayloadBytes: canonicalBytes(thresholdRaisePayload)
  };
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[0].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(envelope(thresholdRaise, [actors[1]]))
    }],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [first, differentBody],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[2].key_id, actors[2].key_id, "peer:unknown"],
    stateAvailable: true,
    pendingSuccessors: [differentBody],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");

  const corrupt = structuredClone(envelope(heartbeat, [actors[0]]));
  corrupt.approvals[0].signature = tagged("ed25519:", 64, 0);
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(corrupt),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
});

test("mortality projections obey sign-once and equivocation remains unclassified", () => {
  const { actors, envelope, lineage, makeBody } = completionScenario();
  const heartbeat = makeBody(2, { kind: "heartbeat", payload: {} });
  const membershipPayload = { mode: "conflict" };
  const membership = makeBody(3, {
    kind: "membership-change",
    payload: membershipPayload
  });
  const first = {
    envelopeBytes: canonicalBytes(envelope(heartbeat, [actors[0]])),
    eventPayloadBytes: canonicalBytes({})
  };
  const conflicting = {
    envelopeBytes: canonicalBytes(envelope(membership, [actors[2]])),
    eventPayloadBytes: canonicalBytes(membershipPayload)
  };

  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[2].key_id],
    stateAvailable: true,
    pendingSuccessors: [first, conflicting],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");

  const equivocation = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      first,
      {
        envelopeBytes: canonicalBytes(envelope(heartbeat, [actors[2]])),
        eventPayloadBytes: canonicalBytes({})
      },
      conflicting
    ],
    authorityLossIrreversible: true
  });
  assert.deepEqual(equivocation, {
    status: "evidence_equivocation",
    mortality_classified: false,
    equivocating_key_ids: [actors[2].key_id]
  });

  const invalidBody = {
    ...heartbeat,
    state_root: tagged("sha256:", 32, 99)
  };
  const invalidCommitment = {
    envelopeBytes: canonicalBytes(envelope(invalidBody, [actors[1]])),
    eventPayloadBytes: canonicalBytes({})
  };
  assert.equal(lineage.verifyCandidate(invalidCommitment).code, "E_HEARTBEAT_STATE_CHANGED");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [first, invalidCommitment],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[0].key_id, actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [invalidCommitment],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");

  const wrongTupleBody = {
    ...invalidBody,
    parent_hash: tagged("sha256:", 32, 98)
  };
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [first, {
      envelopeBytes: canonicalBytes(envelope(wrongTupleBody, [actors[1]])),
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const signerEquivocation = {
    envelopeBytes: canonicalBytes(envelope(invalidBody, [actors[0]])),
    eventPayloadBytes: canonicalBytes({})
  };
  assert.deepEqual(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [first, signerEquivocation],
    authorityLossIrreversible: true
  }), {
    status: "evidence_equivocation",
    mortality_classified: false,
    equivocating_key_ids: [actors[0].key_id]
  });

  const splitBodyPayload = { mode: "split-lock" };
  const splitBody = makeBody(3, {
    kind: "membership-change",
    payload: splitBodyPayload
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[0].key_id, actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [first, {
      envelopeBytes: canonicalBytes(envelope(splitBody, [actors[1]])),
      eventPayloadBytes: canonicalBytes(splitBodyPayload)
    }],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
});

test("payload opacity blocks death only after irreversible loss without a non-death proof", () => {
  const opened = createLineage(canonical(vector.birth));
  assert.equal(opened.status, "accept");
  const step = vector.steps[0];
  const envelopeBytes = canonical(step.envelope);

  for (const eventPayloadBytes of [
    undefined,
    Uint8Array.of(0xff),
    canonicalBytes({ wrong: true })
  ]) {
    const pending = { envelopeBytes };
    if (eventPayloadBytes !== undefined) pending.eventPayloadBytes = eventPayloadBytes;
    const assessment = opened.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [pending],
      authorityLossIrreversible: true
    });
    assert.equal(assessment.status, "evidence_payload_unavailable");
    assert.equal(assessment.mortality_classified, false);
    assert.equal(assessment.pending_body_hashes.length, 1);
  }
  assert.equal(opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{ envelopeBytes }],
    authorityLossIrreversible: false
  }).status, "authority_unavailable_not_proven_dead");
  assert.equal(opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [rawStep(step)],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const firstHalf = clone(step);
  const secondHalf = clone(step);
  firstHalf.envelope.approvals = [step.envelope.approvals[0]];
  secondHalf.envelope.approvals = [step.envelope.approvals[1]];
  assert.equal(opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      { envelopeBytes: canonical(firstHalf.envelope) },
      {
        envelopeBytes: canonical(secondHalf.envelope),
        eventPayloadBytes: canonical(secondHalf.payload)
      }
    ],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  assert.equal(opened.lineage.verifyCandidate({ envelopeBytes }).code, "E_EVENT_PAYLOAD_REQUIRED");

  const emptyPayloadScenario = completionScenario();
  const emptyPayloadBody = emptyPayloadScenario.makeBody(3, {
    kind: "membership-change",
    payload: {}
  });
  const emptyPayloadEnvelope = canonicalBytes(
    emptyPayloadScenario.envelope(emptyPayloadBody, emptyPayloadScenario.actors)
  );
  for (const eventPayloadBytes of [
    undefined,
    Uint8Array.of(0xff),
    canonicalBytes({ wrong: true })
  ]) {
    const pending = { envelopeBytes: emptyPayloadEnvelope };
    if (eventPayloadBytes !== undefined) pending.eventPayloadBytes = eventPayloadBytes;
    assert.equal(emptyPayloadScenario.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [pending],
      authorityLossIrreversible: true
    }).status, "evidence_payload_unavailable");
  }
  assert.equal(emptyPayloadScenario.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: emptyPayloadEnvelope,
      eventPayloadBytes: canonicalBytes({})
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const oneSignatureOpaque = {
    envelopeBytes: canonicalBytes(
      emptyPayloadScenario.envelope(
        emptyPayloadBody,
        [emptyPayloadScenario.actors[0]]
      )
    )
  };
  const uncommittedQuorum = emptyPayloadScenario.actors
    .slice(1)
    .map((actor) => actor.key_id);
  const aliveDespiteOpaque = emptyPayloadScenario.lineage.evaluateMortality({
    usableKeyIds: uncommittedQuorum,
    stateAvailable: true,
    pendingSuccessors: [oneSignatureOpaque],
    authorityLossIrreversible: true
  });
  assert.equal(aliveDespiteOpaque.status, "operationally_alive");
  assert.equal(aliveDespiteOpaque.usable_keys, 2);
  assert.equal(emptyPayloadScenario.lineage.evaluateMortality({
    usableKeyIds: uncommittedQuorum,
    stateAvailable: false,
    pendingSuccessors: [oneSignatureOpaque],
    authorityLossIrreversible: true
  }).status, "state_stalled");

  for (const invalidRoot of [[], "not-an-object"]) {
    const invalidRootBody = emptyPayloadScenario.makeBody(3, {
      kind: "membership-change",
      payload: invalidRoot
    });
    const invalidRootCandidate = {
      envelopeBytes: canonicalBytes(
        emptyPayloadScenario.envelope(
          invalidRootBody,
          emptyPayloadScenario.actors
        )
      ),
      eventPayloadBytes: canonicalBytes(invalidRoot)
    };
    assert.equal(
      emptyPayloadScenario.lineage.verifyCandidate(invalidRootCandidate).code,
      "E_EVENT_PAYLOAD_INVALID"
    );
    assert.equal(emptyPayloadScenario.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [invalidRootCandidate],
      authorityLossIrreversible: true
    }).status, "dead_under_v0_assumptions");
  }

  const generated = completionScenario();
  const invalidPayload = { mode: "unchanged" };
  const invalidBody = generated.makeBody(2, {
    kind: "membership-change",
    payload: invalidPayload
  });
  assert.equal(generated.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(generated.envelope(invalidBody, generated.actors.slice(0, 2)))
    }],
    authorityLossIrreversible: true
  }).status, "dead_under_v0_assumptions");
});

test("lineage mortality states use its private recognized head", () => {
  const lineage = openThrough(vector.steps.length);
  const all = lineage.head.next_custody_descriptor.custodians.map((entry) => entry.key_id);

  const alive = lineage.evaluateMortality({
    usableKeyIds: all,
    stateAvailable: true,
    // This legacy-style field is deliberately ignored; callers cannot inject a head.
    head: lineage.genesis
  });
  assert.equal(alive.status, "operationally_alive");
  assert.equal(Object.isFrozen(alive), true);
  assert.equal(
    lineage.evaluateMortality({ usableKeyIds: all, stateAvailable: false }).status,
    "state_stalled"
  );
  assert.equal(
    lineage.evaluateMortality({
      usableKeyIds: [vector.actors.F.key_id],
      stateAvailable: true
    }).status,
    "authority_unavailable_not_proven_dead"
  );
  assert.equal(
    lineage.evaluateMortality({
      usableKeyIds: [vector.actors.F.key_id, "peer:not-declared"],
      stateAvailable: false,
      authorityLossIrreversible: true
    }).status,
    "dead_under_v0_assumptions"
  );
});

test("raw pending successors are revalidated as direct children of the current head", () => {
  const lineage = openThrough(2);
  const step = vector.steps[2];
  const partialStep = clone(step);
  partialStep.envelope.acceptances = [];
  const rawPartial = rawStep(partialStep);

  const latent = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [rawPartial, rawPartial],
    authorityLossIrreversible: true
  });
  assert.equal(latent.status, "latent_successor_not_dead");
  assert.equal(latent.latent_successors, 1);

  const complete = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [rawStep(step)],
    authorityLossIrreversible: true
  });
  assert.equal(complete.status, "latent_successor_not_dead");
  assert.equal(complete.latent_successors, 1);

  const capability = validateLatentSuccessor({
    genesis: lineage.genesis,
    parent: lineage.head,
    ...rawPartial
  });
  assert.equal(capability.status, "latent");
  const injectedCapability = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [capability],
    authorityLossIrreversible: true
  });
  assert.equal(injectedCapability.status, "dead_under_v0_assumptions");

  const advanced = openThrough(vector.steps.length);
  const staleRaw = advanced.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [rawStep(step)],
    authorityLossIrreversible: true
  });
  assert.equal(staleRaw.status, "dead_under_v0_assumptions");
  assert.equal(staleRaw.latent_successors, 0);
});

test("mortality snapshots pending records before analysis and blocks reentrant mutation", () => {
  const lineage = openThrough(2);
  const step = vector.steps[2];
  const partial = clone(step);
  partial.envelope.acceptances = [];
  const headBefore = lineage.head.object_hash;
  let reentrantAppend;

  const reentrantInput = new Proxy(rawStep(partial), {
    ownKeys(target) {
      reentrantAppend = lineage.append(rawStep(step));
      return Reflect.ownKeys(target);
    }
  });
  const assessment = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [reentrantInput],
    authorityLossIrreversible: true
  });

  assert.equal(reentrantAppend.code, "E_VALIDATOR_INTERNAL");
  assert.equal(reentrantAppend.deterministic_detail, "mortality-evaluation-active");
  assert.equal(assessment.status, "latent_successor_not_dead");
  assert.equal(lineage.head.object_hash, headBefore);

  for (const mutate of [
    (pending) => pending.pop(),
    (pending) => pending.splice(1, 1),
    (pending) => pending.push({ envelopeBytes: Uint8Array.of(0) })
  ]) {
    const pending = [];
    const mutationTrigger = new Proxy({ envelopeBytes: Uint8Array.of(0) }, {
      ownKeys(target) {
        mutate(pending);
        return Reflect.ownKeys(target);
      }
    });
    pending.push(mutationTrigger, rawStep(step));
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: pending,
      authorityLossIrreversible: true
    }).status, "latent_successor_not_dead");
  }

  const iteratorTrap = [rawStep(step)];
  Object.defineProperty(iteratorTrap, Symbol.iterator, {
    value() {
      throw new Error("custom iterator must not execute");
    }
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: iteratorTrap,
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");

  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    configurable: true,
    enumerable: true,
    get() {
      return rawStep(step);
    }
  });
  accessorArray.length = 1;
  assert.throws(() => lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: accessorArray,
    authorityLossIrreversible: true
  }), /pendingSuccessors must contain only own data entries/);

  const laterValid = rawStep(step);
  const laterEnvelopeBefore = laterValid.envelopeBytes.slice();
  let poisoningGetterCalled = false;
  const poisoningEntry = {};
  Object.defineProperty(poisoningEntry, "envelopeBytes", {
    enumerable: true,
    get() {
      poisoningGetterCalled = true;
      laterValid.envelopeBytes.fill(0);
      return Uint8Array.of(0);
    }
  });
  assert.throws(() => lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [poisoningEntry, laterValid],
    authorityLossIrreversible: true
  }), /envelopeBytes must be an own data property/);
  assert.equal(poisoningGetterCalled, false);
  assert.deepEqual(laterValid.envelopeBytes, laterEnvelopeBefore);
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [laterValid],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
});

test("distinct fully valid pending siblings record a fork and leave mortality unclassified", () => {
  const opened = createLineage(canonical(forkVector.genesis));
  assert.equal(opened.status, "accept");
  const parentHash = opened.lineage.head.object_hash;

  const assessment = opened.lineage.evaluateMortality({
    usableKeyIds: forkVector.genesis.body.initial_custodians.map((entry) => entry.key_id),
    stateAvailable: true,
    pendingSuccessors: [rawStep(forkVector.first), rawStep(forkVector.sibling)]
  });

  assert.deepEqual(assessment, {
    status: "forked",
    mortality_classified: false,
    fork_points: [parentHash]
  });
  assert.equal(opened.lineage.isForked, true);
  assert.equal(opened.lineage.head, null);
  assert.equal(opened.lineage.snapshot().accepted_objects, 3);
  assert.equal(opened.lineage.snapshot().fork_points[0].child_hashes.length, 2);
  assert.deepEqual(opened.lineage.evaluateMortality(), assessment);
  assert.equal(opened.lineage.append(rawStep(forkVector.post_fork)).code, "E_LINEAGE_ALREADY_FORKED");

  const reparable = createLineage(canonical(forkVector.genesis));
  const pretty = (step) => ({
    envelopeBytes: new TextEncoder().encode(JSON.stringify(step.envelope, null, 2)),
    eventPayloadBytes: new TextEncoder().encode(JSON.stringify(step.payload, null, 2))
  });
  assert.deepEqual(reparable.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [pretty(forkVector.first), pretty(forkVector.sibling)],
    authorityLossIrreversible: true
  }), {
    status: "evidence_equivocation",
    mortality_classified: false,
    equivocating_key_ids: [forkVector.genesis.body.initial_custodians[0].key_id]
  });

  const reconstructed = completionScenario();
  const misplaced = ({ body, payload }, pretty = false) => {
    const carrier = reconstructed.envelope(body, reconstructed.actors);
    carrier.acceptances = carrier.approvals;
    carrier.approvals = [];
    return {
      envelopeBytes: pretty
        ? new TextEncoder().encode(JSON.stringify(carrier, null, 2))
        : canonicalBytes(carrier),
      eventPayloadBytes: canonicalBytes(payload)
    };
  };
  const reconstructedBodies = ["A", "B", "C"].map((branch) => {
    const payload = { branch };
    const body = reconstructed.makeBody(3, { kind: "membership-change", payload });
    return { body, payload };
  });
  const reconstructedFork = reconstructed.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      misplaced(reconstructedBodies[0]),
      misplaced(reconstructedBodies[1]),
      misplaced(reconstructedBodies[2], true)
    ],
    authorityLossIrreversible: true
  });
  assert.equal(reconstructedFork.status, "forked");
  assert.equal(reconstructedFork.mortality_classified, false);
  assert.equal(reconstructed.lineage.isForked, true);
  assert.equal(reconstructed.lineage.snapshot().accepted_objects, 3);
});

test("mortality input contracts reject ambiguous observer assumptions", () => {
  const lineage = openThrough(0);
  const all = lineage.head.next_custody_descriptor.custodians.map((entry) => entry.key_id);
  assert.throws(
    () => lineage.evaluateMortality({ usableKeyIds: "not-an-array", stateAvailable: true }),
    /usableKeyIds must be an array/
  );
  assert.throws(
    () => lineage.evaluateMortality({ usableKeyIds: [], stateAvailable: "yes" }),
    /stateAvailable must be boolean/
  );
  assert.throws(
    () =>
      lineage.evaluateMortality({
        usableKeyIds: [],
        stateAvailable: true,
        pendingSuccessors: "not-an-array"
      }),
    /pendingSuccessors must be an array/
  );
  assert.throws(
    () =>
      lineage.evaluateMortality({
        usableKeyIds: [],
        stateAvailable: true,
        authorityLossIrreversible: "yes"
      }),
    /authorityLossIrreversible must be boolean/
  );

  assert.equal(lineage.evaluateMortality({
    usableKeyIds: all,
    stateAvailable: true
  }).status, "operationally_alive");

  for (const name of [
    "usableKeyIds",
    "stateAvailable",
    "pendingSuccessors",
    "authorityLossIrreversible"
  ]) {
    let getterCalls = 0;
    const options = {
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [rawStep(vector.steps[0])],
      authorityLossIrreversible: true
    };
    const value = options[name];
    Object.defineProperty(options, name, {
      enumerable: true,
      get() {
        getterCalls += 1;
        return value;
      }
    });
    assert.throws(
      () => lineage.evaluateMortality(options),
      new RegExp(`options\\.${name} must be an own data property`)
    );
    assert.equal(getterCalls, 0);
  }
});
