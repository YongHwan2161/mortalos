import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMortality, validateLatentSuccessor, validatePulse } from "../src/index.mjs";
import { acceptedLineage, canonical, clone, vector } from "./helpers.mjs";

const lineage = acceptedLineage();
const descriptor = lineage.head.next_custody_descriptor;
const all = descriptor.custodians.map((entry) => entry.key_id);

test("mortality states separate authority, state, uncertainty, latency, and death", () => {
  const latentHead = lineage.parents[2];
  const step = vector.steps[2];
  const latent = validatePulse({
    genesis: lineage.genesis,
    parent: latentHead,
    envelopeBytes: canonical(step.envelope),
    eventPayloadBytes: canonical(step.payload)
  });
  assert.equal(latent.status, "accept");
  const partialStep = clone(step);
  partialStep.envelope.acceptances = [];
  const partialLatent = validateLatentSuccessor({
    genesis: lineage.genesis,
    parent: latentHead,
    envelopeBytes: canonical(partialStep.envelope),
    eventPayloadBytes: canonical(partialStep.payload)
  });
  assert.equal(partialLatent.status, "latent");
  assert.equal(partialLatent.missing_acceptance_key_ids.length, 1);
  assert.equal(evaluateMortality({ head: lineage.head, usableKeyIds: all, stateAvailable: true }).status, "operationally_alive");
  assert.equal(evaluateMortality({ head: lineage.head, usableKeyIds: all, stateAvailable: false }).status, "state_stalled");
  assert.equal(evaluateMortality({ head: latentHead, usableKeyIds: [], stateAvailable: true, latentSuccessors: [latent], authorityLossIrreversible: true }).status, "latent_successor_not_dead");
  assert.equal(evaluateMortality({ head: latentHead, usableKeyIds: [], stateAvailable: true, latentSuccessors: [partialLatent], authorityLossIrreversible: true }).status, "latent_successor_not_dead");
  assert.equal(evaluateMortality({ head: lineage.head, usableKeyIds: [vector.actors.F.key_id], stateAvailable: true }).status, "authority_unavailable_not_proven_dead");
  assert.equal(evaluateMortality({ head: lineage.head, usableKeyIds: [vector.actors.F.key_id, "peer:not-declared"], stateAvailable: false, authorityLossIrreversible: true }).status, "dead_under_v0_assumptions");
  assert.throws(
    () => evaluateMortality({ head: structuredClone(lineage.head), usableKeyIds: all, stateAvailable: true }),
    /validated acceptance/
  );
  assert.throws(
    () => evaluateMortality({ head: latentHead, usableKeyIds: [], stateAvailable: true, latentSuccessors: [structuredClone(latent)] }),
    /validated direct children/
  );
  assert.throws(
    () => evaluateMortality({ head: latentHead, usableKeyIds: [], stateAvailable: true, latentSuccessors: [structuredClone(partialLatent)] }),
    /validated direct children/
  );
});
