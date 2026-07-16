import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SHA256_IV, SHA512_IV } from "@noble/hashes/_md.js";
import { JsonInputError } from "../src/codec.mjs";
import { checkPulseSchema } from "../src/schema-validation.mjs";
import * as publicApi from "../src/index.mjs";
import {
  canonicalBytes,
  createLineage,
  custodyCommitment,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  MORTALITY_LIMITS,
  pulseApprovalMessage,
  validateGenesis,
  validateLatentSuccessor,
  validatePulse
} from "../src/index.mjs";
import {
  isValidatedAcceptance,
  isValidatedLatentSuccessor
} from "../src/validator.mjs";
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
    latent_successors: 1,
    latent_evidence_complete: false
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [raw],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
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
  }), /pendingSuccessors\[0\]\.envelopeBytes must be an own data property/);
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
  }), /mortality options\.pendingSuccessors must be an own data property/);
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
  assert.throws(
    () => lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [{
        envelopeBytes: completeHeartbeat,
        eventPayloadBytes: Uint8Array.of(0xff)
      }],
      authorityLossIrreversible: true
    }),
    /mortality event-payload bytes could not be parsed/
  );
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{
      envelopeBytes: completeHeartbeat,
      eventPayloadBytes: canonicalBytes({ poison: true })
    }],
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [first, differentBody],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[2].key_id, actors[2].key_id, tagged("peer:", 32, 0)],
    stateAvailable: true,
    pendingSuccessors: [differentBody],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
});

test("mortality discovers exact bodies and signatures throughout declared JSON trees", () => {
  const step = clone(vector.steps[2]);
  const signatures = [
    ...step.envelope.approvals,
    ...step.envelope.acceptances
  ].map((entry) => entry.signature);
  const hiddenEnvelope = {
    artifacts: {
      candidate_body: step.envelope.body,
      nested_signature: signatures[1]
    },
    [signatures[0]]: "observed-signature-key"
  };
  const hiddenPayload = { orphan_signature: signatures[2] };
  const pending = [
    { envelopeBytes: canonicalBytes(hiddenEnvelope) },
    { eventPayloadBytes: canonicalBytes(hiddenPayload) },
    { eventPayloadBytes: canonicalBytes(step.payload) }
  ];

  const envelopeBodyLineage = openThrough(2);
  assert.equal(envelopeBodyLineage.verifyCandidate(rawStep(step)).status, "accept");
  assert.equal(envelopeBodyLineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: pending,
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");

  const payloadBodyLineage = openThrough(2);
  assert.equal(payloadBodyLineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [
      {
        eventPayloadBytes: canonicalBytes({
          candidate_body: step.envelope.body,
          signature_values: signatures
        })
      },
      { eventPayloadBytes: canonicalBytes(step.payload) }
    ],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [actors[0].key_id, actors[1].key_id],
    stateAvailable: true,
    pendingSuccessors: [invalidCommitment],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
});

test("payload opacity blocks death only after irreversible loss without a non-death proof", () => {
  const opened = createLineage(canonical(vector.birth));
  assert.equal(opened.status, "accept");
  const step = vector.steps[0];
  const envelopeBytes = canonical(step.envelope);

  for (const eventPayloadBytes of [undefined, canonicalBytes({ wrong: true })]) {
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
  assert.throws(
    () => opened.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [{ envelopeBytes, eventPayloadBytes: Uint8Array.of(0xff) }],
      authorityLossIrreversible: true
    }),
    /mortality event-payload bytes could not be parsed/
  );
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
  for (const eventPayloadBytes of [undefined, canonicalBytes({ wrong: true })]) {
    const pending = { envelopeBytes: emptyPayloadEnvelope };
    if (eventPayloadBytes !== undefined) pending.eventPayloadBytes = eventPayloadBytes;
    assert.equal(emptyPayloadScenario.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [pending],
      authorityLossIrreversible: true
    }).status, "evidence_payload_unavailable");
  }
  assert.throws(
    () => emptyPayloadScenario.lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [{
        envelopeBytes: emptyPayloadEnvelope,
        eventPayloadBytes: Uint8Array.of(0xff)
      }],
      authorityLossIrreversible: true
    }),
    /mortality event-payload bytes could not be parsed/
  );
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
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
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
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "dead_under_v0_assumptions");
});

test("lineage mortality states use its private recognized head", () => {
  const lineage = openThrough(vector.steps.length);
  const all = lineage.head.next_custody_descriptor.custodians.map((entry) => entry.key_id);

  const alive = lineage.evaluateMortality({
    usableKeyIds: all,
    stateAvailable: true,
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
      usableKeyIds: [vector.actors.F.key_id, tagged("peer:", 32, 0xff)],
      stateAvailable: false,
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
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
  assert.throws(
    () => lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [capability],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
    }),
    /mortality carrier must contain an envelope or event-payload source/
  );

  const advanced = openThrough(vector.steps.length);
  const staleRaw = advanced.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [rawStep(step)],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
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
  let ownKeysCalls = 0;

  const reentrantInput = new Proxy(rawStep(partial), {
    ownKeys(target) {
      ownKeysCalls += 1;
      return Reflect.ownKeys(target);
    }
  });
  const assessment = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [reentrantInput],
    authorityLossIrreversible: true
  });

  assert.equal(ownKeysCalls, 0);
  assert.equal(assessment.status, "latent_successor_not_dead");
  assert.equal(lineage.head.object_hash, headBefore);

  const iteratorTrap = [rawStep(step)];
  let iteratorCalls = 0;
  Object.defineProperty(iteratorTrap, Symbol.iterator, {
    value() {
      iteratorCalls += 1;
      throw new Error("custom iterator must not execute");
    }
  });
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: iteratorTrap,
    authorityLossIrreversible: true
  }).status, "latent_successor_not_dead");
  assert.equal(iteratorCalls, 0);

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
  }), /pendingSuccessors\[0\]\.envelopeBytes must be an own data property/);
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
    /usableKeyIds must be a dense ordinary data array/
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
    /pendingSuccessors must be a dense ordinary data array/
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

  const ambiguousOptions = {
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true,
    orphanSignature: vector.steps[0].envelope.approvals[0].signature
  };
  ambiguousOptions.usableKeyIds = all;
  ambiguousOptions.stateAvailable = true;
  assert.equal(
    lineage.evaluateMortality(ambiguousOptions).status,
    "operationally_alive"
  );
  Object.defineProperty(ambiguousOptions, Symbol("hidden-evidence"), {
    enumerable: true,
    value: vector.steps[0].envelope.body
  });
  delete ambiguousOptions.orphanSignature;
  assert.equal(
    lineage.evaluateMortality(ambiguousOptions).status,
    "operationally_alive"
  );

  const partial = clone(vector.steps[0]);
  const orphanApproval = partial.envelope.approvals.pop();
  assert.throws(
    () => lineage.evaluateMortality({
      usableKeyIds: [orphanApproval.signature],
      stateAvailable: false,
      pendingSuccessors: [rawStep(partial)],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
    }),
    /usableKeyIds entries must be canonical peer IDs/
  );

  assert.equal(lineage.evaluateMortality({
    usableKeyIds: all,
    stateAvailable: true
  }).status, "operationally_alive");

  for (const name of [
    "usableKeyIds",
    "stateAvailable",
    "pendingSuccessors",
    "authorityLossIrreversible",
    "latentEvidenceComplete"
  ]) {
    let getterCalls = 0;
    const options = {
      usableKeyIds: [],
      stateAvailable: true,
      pendingSuccessors: [rawStep(vector.steps[0])],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
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
      new RegExp(`mortality options\\.${name} must be an own data property`)
    );
    assert.equal(getterCalls, 0);
  }
});

test("death requires irreversible loss and an explicitly complete evidence inventory", () => {
  const lineage = openThrough(2);
  const incomplete = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [],
    authorityLossIrreversible: true
  });
  assert.equal(incomplete.status, "authority_unavailable_not_proven_dead");
  assert.equal(incomplete.latent_evidence_complete, false);

  const explicitIncomplete = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [],
    authorityLossIrreversible: true,
    latentEvidenceComplete: false
  });
  assert.equal(explicitIncomplete.status, "authority_unavailable_not_proven_dead");

  const lateChild = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  assert.equal(lateChild.status, "latent_successor_not_dead");
  assert.equal(lateChild.latent_successors, 1);

  const complete = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  assert.equal(complete.status, "dead_under_v0_assumptions");
  assert.equal(complete.latent_evidence_complete, true);
});

test("pre-call realm and dependency drift aborts before mortality classification", { concurrency: false }, () => {
  const pending = rawStep(vector.steps[2]);

  function assertDriftAborts(mutate, restore) {
    const lineage = openThrough(2);
    let result;
    let error;
    try {
      mutate();
      try {
        result = lineage.evaluateMortality({
          usableKeyIds: [],
          stateAvailable: false,
          pendingSuccessors: [pending],
          authorityLossIrreversible: true,
          latentEvidenceComplete: true
        });
      } catch (caught) {
        error = caught;
      }
    } finally {
      restore();
    }
    assert.notEqual(result?.status, "dead_under_v0_assumptions");
    assert.match(
      error?.message ?? "",
      /mortality observation changed (realm intrinsics|trusted crypto state)/
    );
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: false,
      pendingSuccessors: [pending],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
    }).status, "latent_successor_not_dead");
  }

  const dataViewGetUint32 = DataView.prototype.getUint32;
  assertDriftAborts(
    () => { DataView.prototype.getUint32 = () => 0; },
    () => { DataView.prototype.getUint32 = dataViewGetUint32; }
  );

  const weakSetHas = WeakSet.prototype.has;
  assertDriftAborts(
    () => { WeakSet.prototype.has = () => true; },
    () => { WeakSet.prototype.has = weakSetHas; }
  );

  const freeze = Object.freeze;
  assertDriftAborts(
    () => { Object.freeze = (value) => value; },
    () => { Object.freeze = freeze; }
  );

  const sha256 = SHA256_IV[0];
  assertDriftAborts(
    () => { SHA256_IV[0] ^= 1; },
    () => { SHA256_IV[0] = sha256; }
  );

  const sha512 = SHA512_IV[0];
  assertDriftAborts(
    () => { SHA512_IV[0] ^= 1; },
    () => { SHA512_IV[0] = sha512; }
  );

  const arrayZero = Object.getOwnPropertyDescriptor(Array.prototype, "0");
  const arrayLength = Object.getOwnPropertyDescriptor(Array.prototype, "length");
  assertDriftAborts(
    () => {
      Object.defineProperty(Array.prototype, "0", {
        configurable: true,
        get() { return undefined; },
        set() {}
      });
    },
    () => {
      if (arrayZero) Object.defineProperty(Array.prototype, "0", arrayZero);
      else delete Array.prototype[0];
      Object.defineProperty(Array.prototype, "length", arrayLength);
    }
  );
});

test("mortality option accessors cannot poison String.prototype.startsWith", { concurrency: false }, () => {
  const lineage = openThrough(2);
  const pending = rawStep(vector.steps[2]);
  const originalStartsWith = String.prototype.startsWith;
  let accessorCalls = 0;
  let result;
  try {
    assert.throws(
      () => {
        result = lineage.evaluateMortality({
          get usableKeyIds() {
            accessorCalls += 1;
            String.prototype.startsWith = () => false;
            return [];
          },
          stateAvailable: false,
          pendingSuccessors: [pending],
          authorityLossIrreversible: true,
          latentEvidenceComplete: true
        });
      },
      /mortality options\.usableKeyIds must be an own data property/
    );
  } finally {
    String.prototype.startsWith = originalStartsWith;
  }
  assert.equal(accessorCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [pending],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");
});

test("bounded named-field acquisition never invokes self-restoring array iterators", { concurrency: false }, () => {
  const lineage = openThrough(2);
  const partial = clone(vector.steps[2]);
  const orphanApproval = partial.envelope.approvals.pop();
  const options = {
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [{
      ...rawStep(partial),
      orphanSignature: orphanApproval.signature
    }],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true,
    orphanSignature: orphanApproval.signature
  };
  const originalIterator = Array.prototype[Symbol.iterator];
  let iteratorCalls = 0;
  let result;
  let error;
  try {
    Array.prototype[Symbol.iterator] = function hostileIterator() {
      iteratorCalls += 1;
      if (iteratorCalls === 2) Array.prototype[Symbol.iterator] = originalIterator;
      return originalIterator.call([]);
    };
    try {
      result = lineage.evaluateMortality(options);
    } catch (caught) {
      error = caught;
    }
  } finally {
    Array.prototype[Symbol.iterator] = originalIterator;
  }
  assert.equal(iteratorCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /mortality observation changed realm intrinsics/);
});

test("byte acquisition resists self-restoring numeric intrinsics", { concurrency: false }, () => {
  const lineage = openThrough(2);
  const fullStep = clone(vector.steps[2]);
  const strippedStep = clone(fullStep);
  strippedStep.envelope.approvals = [];
  const laterCarrier = rawStep(fullStep);
  const strippedEnvelopeBytes = canonical(strippedStep.envelope);
  const options = {
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [
      { eventPayloadBytes: canonical({ acquisition_probe: true }) },
      laterCarrier
    ],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  };
  const originalIsSafeInteger = Number.isSafeInteger;
  let intrinsicCalls = 0;
  let result;
  let error;
  try {
    Number.isSafeInteger = (value) => {
      intrinsicCalls += 1;
      laterCarrier.envelopeBytes = strippedEnvelopeBytes;
      Number.isSafeInteger = originalIsSafeInteger;
      return originalIsSafeInteger(value);
    };
    try {
      result = lineage.evaluateMortality(options);
    } catch (caught) {
      error = caught;
    }
  } finally {
    Number.isSafeInteger = originalIsSafeInteger;
  }
  assert.equal(intrinsicCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /mortality observation changed realm intrinsics/);
  assert.equal(lineage.evaluateMortality(options).status, "latent_successor_not_dead");
});

test("usable key decoding resists self-restoring RegExp execution", { concurrency: false }, () => {
  const lineage = openThrough(2);
  const fullStep = clone(vector.steps[2]);
  const strippedStep = clone(fullStep);
  strippedStep.envelope.approvals = [];
  const laterCarrier = rawStep(fullStep);
  const strippedEnvelopeBytes = canonical(strippedStep.envelope);
  const unknownPeerBytes = Uint8Array.from(
    { length: 32 },
    (_, index) => (index * 29 + 7) & 0xff
  );
  const unknownPeerId = `peer:${encodeBase64Url(unknownPeerBytes)}`;
  const encodedPeerId = unknownPeerId.slice("peer:".length);
  const options = {
    usableKeyIds: [unknownPeerId],
    stateAvailable: false,
    pendingSuccessors: [laterCarrier],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  };
  const originalExec = RegExp.prototype.exec;
  const sourceGetter = Object.getOwnPropertyDescriptor(RegExp.prototype, "source").get;
  const reflectApply = Reflect.apply;
  let execCalls = 0;
  let result;
  let error;
  try {
    RegExp.prototype.exec = function hostileExec(value) {
      if (
        reflectApply(sourceGetter, this, []) === "^[A-Za-z0-9_-]*$" &&
        value === encodedPeerId
      ) {
        execCalls += 1;
        laterCarrier.envelopeBytes = strippedEnvelopeBytes;
        RegExp.prototype.exec = originalExec;
      }
      return reflectApply(originalExec, this, [value]);
    };
    try {
      result = lineage.evaluateMortality(options);
    } catch (caught) {
      error = caught;
    }
  } finally {
    RegExp.prototype.exec = originalExec;
  }
  assert.equal(execCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /mortality observation changed realm intrinsics/);
  assert.equal(lineage.evaluateMortality(options).status, "latent_successor_not_dead");
});

test("usable key decoding never consults typed-array length metadata", { concurrency: false }, () => {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "length");
  const typedArrayLength = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype),
    "length"
  ).get;
  const reflectApply = Reflect.apply;
  const matchesBytes = (value, expected, expectedLength) => {
    let actualLength;
    try {
      actualLength = reflectApply(typedArrayLength, value, []);
    } catch {
      return false;
    }
    if (actualLength !== expectedLength) return false;
    for (let index = 0; index < expectedLength; index += 1) {
      if (value[index] !== expected[index]) return false;
    }
    return true;
  };
  const restoreLength = () => {
    if (lengthDescriptor) {
      Object.defineProperty(Uint8Array.prototype, "length", lengthDescriptor);
    } else {
      delete Uint8Array.prototype.length;
    }
  };

  const fullStep = clone(vector.steps[2]);
  const strippedStep = clone(fullStep);
  strippedStep.envelope.approvals = [];
  const mutableCarrier = rawStep(fullStep);
  const strippedEnvelopeBytes = canonical(strippedStep.envelope);
  const mutationLineage = openThrough(2);
  const unknownPeerBytes = Uint8Array.from(
    { length: 32 },
    (_, index) => (index * 17 + 3) & 0xff
  );
  const mutationOptions = {
    usableKeyIds: [`peer:${encodeBase64Url(unknownPeerBytes)}`],
    stateAvailable: false,
    pendingSuccessors: [mutableCarrier],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  };
  let lengthCalls = 0;
  let result;
  let error;
  try {
    Object.defineProperty(Uint8Array.prototype, "length", {
      configurable: true,
      get() {
        const actualLength = reflectApply(typedArrayLength, this, []);
        if (!matchesBytes(this, unknownPeerBytes, 32)) return actualLength;
        lengthCalls += 1;
        mutableCarrier.envelopeBytes = strippedEnvelopeBytes;
        if (lengthCalls === 13) delete Uint8Array.prototype.length;
        return 32;
      }
    });
    try {
      result = mutationLineage.evaluateMortality(mutationOptions);
    } catch (caught) {
      error = caught;
    }
  } finally {
    restoreLength();
  }
  assert.equal(lengthCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /mortality observation changed realm intrinsics/);
  assert.equal(
    mutationLineage.evaluateMortality(mutationOptions).status,
    "latent_successor_not_dead"
  );
  assert.equal(openThrough(2).verifyCandidate(rawStep(fullStep)).status, "accept");

  const partial = clone(fullStep);
  const orphanApproval = partial.envelope.approvals.pop();
  const disguisedSignature = `peer:${orphanApproval.signature.slice("ed25519:".length)}`;
  const disguisedBytes = Buffer.from(
    orphanApproval.signature.slice("ed25519:".length),
    "base64url"
  );
  const disguisedByteLength = disguisedBytes.byteLength;
  const spoofLineage = openThrough(2);
  const spoofOptions = {
    usableKeyIds: [disguisedSignature],
    stateAvailable: false,
    pendingSuccessors: [rawStep(partial)],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  };
  lengthCalls = 0;
  result = undefined;
  error = undefined;
  try {
    Object.defineProperty(Uint8Array.prototype, "length", {
      configurable: true,
      get() {
        const actualLength = reflectApply(typedArrayLength, this, []);
        if (!matchesBytes(this, disguisedBytes, disguisedByteLength)) return actualLength;
        lengthCalls += 1;
        if (lengthCalls === 24) {
          delete Uint8Array.prototype.length;
          return 32;
        }
        return actualLength;
      }
    });
    try {
      result = spoofLineage.evaluateMortality(spoofOptions);
    } catch (caught) {
      error = caught;
    }
  } finally {
    restoreLength();
  }
  assert.equal(lengthCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /usableKeyIds entries must be canonical peer IDs/);
});

test("byte snapshots never consult self-restoring typed-array metadata", { concurrency: false }, () => {
  const byteLengthDescriptor = Object.getOwnPropertyDescriptor(
    Uint8Array.prototype,
    "byteLength"
  );
  const lineage = openThrough(2);
  const pending = rawStep(vector.steps[2]);
  let accessorCalls = 0;
  let error;
  let result;
  try {
    Object.defineProperty(Uint8Array.prototype, "byteLength", {
      configurable: true,
      get() {
        accessorCalls += 1;
        if (accessorCalls === 2) delete Uint8Array.prototype.byteLength;
        return 0;
      }
    });
    try {
      result = lineage.evaluateMortality({
        usableKeyIds: [],
        stateAvailable: false,
        pendingSuccessors: [pending],
        authorityLossIrreversible: true,
        latentEvidenceComplete: true
      });
    } catch (caught) {
      error = caught;
    }
  } finally {
    if (byteLengthDescriptor) {
      Object.defineProperty(Uint8Array.prototype, "byteLength", byteLengthDescriptor);
    } else {
      delete Uint8Array.prototype.byteLength;
    }
  }
  assert.equal(accessorCalls, 0);
  assert.notEqual(result?.status, "dead_under_v0_assumptions");
  assert.match(error?.message ?? "", /mortality observation changed realm intrinsics/);
  assert.equal(lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [pending],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");
});

test("error brands, schema surfaces, and validation capabilities resist exported hooks", { concurrency: false }, () => {
  assert.equal(Object.isFrozen(JsonInputError), true);
  assert.equal(Object.isFrozen(JsonInputError.prototype), true);
  assert.equal(Object.isFrozen(checkPulseSchema), true);
  assert.throws(() => Object.defineProperty(JsonInputError, Symbol.hasInstance, {
    configurable: true,
    value() { DataView.prototype.getUint32 = () => 0; return true; }
  }), TypeError);
  assert.throws(() => Object.setPrototypeOf(JsonInputError, function EvilJsonInputError() {
    DataView.prototype.getUint32 = () => 0;
    return {};
  }), TypeError);
  assert.throws(() => Object.defineProperty(JsonInputError.prototype, "code", {
    configurable: true,
    set() { DataView.prototype.getUint32 = () => 0; }
  }), TypeError);
  assert.throws(() => Object.defineProperty(checkPulseSchema, "errors", {
    configurable: true,
    get() { DataView.prototype.getUint32 = () => 0; return []; }
  }), TypeError);

  const lineage = openThrough(2);
  const forgedGenesis = structuredClone(lineage.genesis);
  const forgedParent = structuredClone(lineage.head);
  const partial = clone(vector.steps[2]);
  partial.envelope.acceptances = [];
  const completeStep = rawStep(vector.steps[2]);
  const partialStep = rawStep(partial);
  const birthBytes = canonical(vector.birth);
  const originalFreeze = Object.freeze;
  const originalWeakSetHas = WeakSet.prototype.has;
  let accepted;
  let latent;
  try {
    WeakSet.prototype.has = () => true;
    assert.equal(isValidatedAcceptance(forgedGenesis), false);
    assert.equal(isValidatedLatentSuccessor(forgedParent), false);
    const forgedContext = validatePulse({
      genesis: forgedGenesis,
      parent: forgedParent,
      ...completeStep
    });
    assert.notEqual(forgedContext.status, "accept");
  } finally {
    WeakSet.prototype.has = originalWeakSetHas;
  }
  try {
    Object.freeze = (value) => value;
    accepted = validateGenesis(birthBytes);
    latent = validateLatentSuccessor({
      genesis: lineage.genesis,
      parent: lineage.head,
      ...partialStep
    });
  } finally {
    Object.freeze = originalFreeze;
  }
  assert.equal(accepted.status, "accept");
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(latent.status, "latent");
  assert.equal(Object.isFrozen(latent), true);
  assert.equal(isValidatedAcceptance(accepted), true);
  assert.equal(isValidatedLatentSuccessor(latent), true);
});

test("mortality carriers fail closed on access, shape, snapshot, and parse uncertainty", () => {
  const cases = [
    {
      carrier: { envelopeBytes: "not-bytes" },
      message: /mortality envelope source could not be snapshotted/
    },
    {
      carrier: { envelopeBytes: new Uint8Array(64 * 1024 + 1) },
      message: /mortality envelope source could not be snapshotted/
    },
    {
      carrier: { envelopeBytes: new Uint8Array([0x7b]) },
      message: /mortality envelope bytes could not be parsed/
    },
    {
      carrier: {
        envelopeBytes: canonical(vector.steps[2].envelope),
        eventPayloadBytes: new Uint8Array([0x7b])
      },
      message: /mortality event-payload bytes could not be parsed/
    }
  ];
  for (const entry of cases) {
    const lineage = openThrough(2);
    assert.throws(() => lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: false,
      pendingSuccessors: [entry.carrier, rawStep(vector.steps[2])],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
    }), entry.message);
    assert.equal(lineage.evaluateMortality({
      usableKeyIds: [],
      stateAvailable: false,
      pendingSuccessors: [rawStep(vector.steps[2])],
      authorityLossIrreversible: true,
      latentEvidenceComplete: true
    }).status, "latent_successor_not_dead");
  }

  const partial = clone(vector.steps[2]);
  const orphanApproval = partial.envelope.approvals.pop();
  const ambiguousCarrier = {
    ...rawStep(partial),
    orphanSignature: orphanApproval.signature
  };
  assert.equal(openThrough(2).evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [ambiguousCarrier, rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");

  const symbolCarrier = rawStep(partial);
  Object.defineProperty(symbolCarrier, Symbol("hidden-body"), {
    enumerable: true,
    value: partial.envelope.body
  });
  assert.equal(openThrough(2).evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [symbolCarrier, rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");

  let unknownGetterCalls = 0;
  const accessorCarrier = rawStep(partial);
  Object.defineProperty(accessorCarrier, "orphanSignature", {
    enumerable: true,
    get() {
      unknownGetterCalls += 1;
      return orphanApproval.signature;
    }
  });
  assert.equal(openThrough(2).evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [accessorCarrier, rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");
  assert.equal(unknownGetterCalls, 0);

  const extraFieldArray = Object.assign([], { extra: true });
  assert.equal(openThrough(2).evaluateMortality({
    usableKeyIds: extraFieldArray,
    stateAvailable: false,
    pendingSuccessors: [rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }).status, "latent_successor_not_dead");
  assert.throws(() => openThrough(2).evaluateMortality({
    usableKeyIds: new Array(1),
    stateAvailable: false,
    pendingSuccessors: [rawStep(vector.steps[2])],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }), /usableKeyIds must be a dense ordinary data array/);

  const pending = rawStep(vector.steps[2]);
  const envelopeLength = pending.envelopeBytes.byteLength;
  let getterCalls = 0;
  assert.throws(() => openThrough(2).evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [pending, {
      get envelopeBytes() {
        getterCalls += 1;
        structuredClone(pending.envelopeBytes.buffer, {
          transfer: [pending.envelopeBytes.buffer]
        });
        return undefined;
      }
    }],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  }), /pendingSuccessors\[1\]\.envelopeBytes must be an own data property/);
  assert.equal(getterCalls, 0);
  assert.equal(pending.envelopeBytes.byteLength, envelopeLength);
});

test("mortality resource limits abort without truncating evidence into death", () => {
  const lineage = openThrough(0);
  const assumptions = {
    usableKeyIds: [],
    stateAvailable: false,
    pendingSuccessors: [],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  };
  const expectedLimit = (resource, maximum) => ({
    status: "indeterminate",
    reason: "limit_exceeded",
    mortality_classified: false,
    resource,
    observed: maximum + 1,
    maximum
  });

  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    usableKeyIds: Array(MORTALITY_LIMITS.usable_key_ids + 7).fill("invalid")
  }), expectedLimit("usable_key_ids", MORTALITY_LIMITS.usable_key_ids));

  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    usableKeyIds: ["x".repeat(MORTALITY_LIMITS.usable_key_id_chars + 100)]
  }), expectedLimit(
    "usable_key_id_chars",
    MORTALITY_LIMITS.usable_key_id_chars
  ));
  assert.throws(() => lineage.evaluateMortality({
    ...assumptions,
    usableKeyIds: ["x".repeat(MORTALITY_LIMITS.usable_key_id_chars)]
  }), /usableKeyIds entries must be canonical peer IDs/);
  const canonicalKeyId = vector.birth.body.initial_custodians[0].key_id;
  assert.equal(lineage.evaluateMortality({
    ...assumptions,
    usableKeyIds: Array(MORTALITY_LIMITS.usable_key_ids).fill(canonicalKeyId)
  }).status, "dead_under_v0_assumptions");

  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    pendingSuccessors: Array.from(
      { length: MORTALITY_LIMITS.pending_records + 1 },
      () => ({})
    )
  }), expectedLimit("pending_records", MORTALITY_LIMITS.pending_records));

  const fullEnvelopeBytes = new Uint8Array(64 * 1024);
  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    pendingSuccessors: Array.from({ length: 65 }, () => ({
      envelopeBytes: fullEnvelopeBytes
    }))
  }), expectedLimit("pending_bytes", MORTALITY_LIMITS.pending_bytes));

  const oversizedReservation = clone(vector.steps[0].envelope);
  oversizedReservation.approvals = Array.from({ length: 5_000 }, () => ({}));
  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    pendingSuccessors: [{
      envelopeBytes: canonicalBytes(oversizedReservation),
      eventPayloadBytes: canonicalBytes(vector.steps[0].payload)
    }]
  }), expectedLimit(
    "signature_verifications",
    MORTALITY_LIMITS.signature_verifications
  ));

  const canonicalSignature = (value) => {
    const bytes = new Uint8Array(64);
    bytes[0] = (value >>> 8) & 0xff;
    bytes[1] = value & 0xff;
    return `ed25519:${encodeBase64Url(bytes)}`;
  };
  const pendingSuccessors = Array.from({ length: 16 }, (_, bodyIndex) => {
    const body = clone(vector.steps[0].envelope.body);
    body.event.payload_hash = tagged("sha256:", 32, bodyIndex);
    return {
      envelopeBytes: canonicalBytes({
        kind: "mortalos.pulse",
        body,
        approvals: Array.from({ length: 64 }, (_, signatureIndex) => ({
          key_id: `untrusted-${bodyIndex}-${signatureIndex}`,
          signature: canonicalSignature(bodyIndex * 64 + signatureIndex)
        })),
        acceptances: []
      })
    };
  });
  assert.deepEqual(lineage.evaluateMortality({
    ...assumptions,
    pendingSuccessors
  }), expectedLimit(
    "signature_verifications",
    MORTALITY_LIMITS.signature_verifications
  ));

  assert.equal(lineage.evaluateMortality(assumptions).status, "dead_under_v0_assumptions");
  assert.equal(lineage.snapshot().accepted_objects, 1);
});
