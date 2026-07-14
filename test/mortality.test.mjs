import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMortality } from "../src/index.mjs";
import { acceptedLineage, vector } from "./helpers.mjs";

const descriptor = acceptedLineage().head.next_custody_descriptor;
const all = descriptor.custodians.map((entry) => entry.key_id);

test("mortality states separate authority, state, uncertainty, latency, and death", () => {
  assert.equal(evaluateMortality({ custodyDescriptor: descriptor, usableKeyIds: all, stateAvailable: true }).status, "operationally_alive");
  assert.equal(evaluateMortality({ custodyDescriptor: descriptor, usableKeyIds: all, stateAvailable: false }).status, "state_stalled");
  assert.equal(evaluateMortality({ custodyDescriptor: descriptor, usableKeyIds: [], stateAvailable: true, latentSuccessorCount: 1, authorityLossIrreversible: true }).status, "latent_successor_not_dead");
  assert.equal(evaluateMortality({ custodyDescriptor: descriptor, usableKeyIds: [vector.actors.F.key_id], stateAvailable: true }).status, "authority_unavailable_not_proven_dead");
  assert.equal(evaluateMortality({ custodyDescriptor: descriptor, usableKeyIds: [vector.actors.F.key_id, "peer:not-declared"], stateAvailable: false, authorityLossIrreversible: true }).status, "dead_under_v0_assumptions");
});
