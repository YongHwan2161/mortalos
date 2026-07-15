import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as publicApi from "../src/index.mjs";
import {
  createLineage,
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

test("public API does not expose a caller-selected-head mortality evaluator", () => {
  assert.equal("evaluateMortality" in publicApi, false);
  assert.equal("evaluateMortalityState" in publicApi, false);
  assert.equal("validateMortalitySuccessor" in publicApi, false);
  assert.equal("isValidatedMortalitySuccessor" in publicApi, false);
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

test("mortality evaluation blocks lineage mutation from pending-input getters", () => {
  const lineage = openThrough(2);
  const step = vector.steps[2];
  const partial = clone(step);
  partial.envelope.acceptances = [];
  const headBefore = lineage.head.object_hash;
  let reentrantAppend;

  const assessment = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [
      {
        get envelopeBytes() {
          reentrantAppend = lineage.append(rawStep(step));
          return canonical(partial.envelope);
        },
        eventPayloadBytes: canonical(partial.payload)
      }
    ],
    authorityLossIrreversible: true
  });

  assert.equal(reentrantAppend.code, "E_VALIDATOR_INTERNAL");
  assert.equal(reentrantAppend.deterministic_detail, "mortality-evaluation-active");
  assert.equal(assessment.status, "latent_successor_not_dead");
  assert.equal(lineage.head.object_hash, headBefore);
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
});

test("mortality input contracts reject ambiguous observer assumptions", () => {
  const lineage = openThrough(0);
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
});
