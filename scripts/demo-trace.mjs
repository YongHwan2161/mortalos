import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  canonicalBytes,
  canonicalize,
  createLineage,
  evaluateMortality,
  validateGenesis,
  validateLatentSuccessor
} from "../src/index.mjs";

const vector = JSON.parse(
  await readFile(new URL("../test/vectors/lifecycle.json", import.meta.url), "utf8")
);
const verifyOnly = process.argv.includes("--verify");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function labelsFor(descriptor) {
  const byId = new Map(Object.entries(vector.actors).map(([label, actor]) => [actor.key_id, label]));
  return descriptor.custodians.map((entry) => byId.get(entry.key_id)).sort();
}

const events = [];
const opened = createLineage(canonicalBytes(vector.birth));
invariant(opened.status === "accept", `birth rejected: ${opened.code}`);
const lineage = opened.lineage;
const genesis = lineage.genesis;
events.push({
  phase: "birth",
  result: "accepted",
  sequence: genesis.sequence,
  organism_id: genesis.organism_id,
  custodians: labelsFor(genesis.next_custody_descriptor),
  quorum: genesis.next_custody_descriptor.quorum.threshold
});

let parent = genesis;
for (const step of vector.steps) {
  const input = {
    envelopeBytes: canonicalBytes(step.envelope),
    eventPayloadBytes: canonicalBytes(step.payload)
  };
  const candidate = lineage.validateCandidate(input);
  if (step.id === "latent-handoff-3") {
    invariant(candidate.status === "accept", "pending latent candidate lacks complete valid authorization");
    const partialEnvelope = structuredClone(step.envelope);
    partialEnvelope.acceptances = [];
    const partialLatent = validateLatentSuccessor({
      genesis,
      parent,
      envelopeBytes: canonicalBytes(partialEnvelope),
      eventPayloadBytes: canonicalBytes(step.payload)
    });
    invariant(partialLatent.status === "latent", "current-quorum-approved partial successor was not recognized");
    const latent = evaluateMortality({
      head: parent,
      usableKeyIds: [],
      stateAvailable: true,
      latentSuccessors: [partialLatent],
      authorityLossIrreversible: true
    });
    invariant(latent.status === "latent_successor_not_dead", "latent successor was misclassified as death");
    events.push({
      phase: "authority-loss-with-latent-successor",
      result: latent.status,
      sequence: parent.sequence,
      organism_id: genesis.organism_id,
      usable_keys: latent.usable_keys,
      quorum: latent.threshold,
      pending_authorized_successors: latent.latent_successors,
      missing_new_custodian_acceptances: partialLatent.missing_acceptance_key_ids.length
    });
  }

  const accepted = lineage.append(input);
  invariant(accepted.status === "accept", `${step.id} rejected: ${accepted.code}`);
  invariant(accepted.object_hash === candidate.object_hash, `${step.id} validation/append mismatch`);
  invariant(accepted.organism_id === genesis.organism_id, `${step.id} changed identity`);
  invariant(accepted.next_state_root === genesis.next_state_root, `${step.id} changed v0 state root`);
  parent = accepted;
  events.push({
    phase: step.id,
    result: "accepted",
    sequence: accepted.sequence,
    organism_id: accepted.organism_id,
    object_hash: accepted.object_hash,
    custodians: labelsFor(accepted.next_custody_descriptor),
    quorum: accepted.next_custody_descriptor.quorum.threshold
  });
}

const replay = lineage.append({
  envelopeBytes: canonicalBytes(vector.steps.at(-1).envelope),
  eventPayloadBytes: canonicalBytes(vector.steps.at(-1).payload)
});
invariant(replay.status === "reject" && replay.code === "E_REPLAY_STALE", "accepted object replay was not rejected");
events.push({
  phase: "accepted-object-replay",
  result: "rejected",
  sequence: parent.sequence,
  organism_id: genesis.organism_id,
  rejection_code: replay.code
});

const finalLabels = labelsFor(parent.next_custody_descriptor);
invariant(finalLabels.every((label) => !["A", "B", "C"].includes(label)), "original custodian survived turnover");

const stateStalled = evaluateMortality({
  head: parent,
  usableKeyIds: parent.next_custody_descriptor.custodians.map((entry) => entry.key_id),
  stateAvailable: false
});
invariant(stateStalled.status === "state_stalled", "state loss was not separated from authority death");
events.push({
  phase: "state-loss-with-live-authority",
  result: stateStalled.status,
  sequence: parent.sequence,
  organism_id: genesis.organism_id,
  authority_viable: stateStalled.authority_viable,
  state_viable: stateStalled.state_viable
});

const dead = evaluateMortality({
  head: parent,
  usableKeyIds: [vector.actors.F.key_id],
  stateAvailable: true,
  latentSuccessors: [],
  authorityLossIrreversible: true
});
invariant(dead.status === "dead_under_v0_assumptions", "irreversible below-quorum authority loss was not death");
events.push({
  phase: "irreversible-authority-loss",
  result: dead.status,
  sequence: parent.sequence,
  organism_id: genesis.organism_id,
  usable_keys: dead.usable_keys,
  quorum: dead.threshold,
  pending_authorized_successors: dead.latent_successors
});

const resurrection = lineage.append({
  envelopeBytes: canonicalBytes(vector.resurrection_attempt.envelope),
  eventPayloadBytes: canonicalBytes(vector.resurrection_attempt.payload)
});
invariant(resurrection.status === "reject", "snapshot resurrection unexpectedly advanced the lineage");
invariant(resurrection.code === vector.resurrection_attempt.expected_rejection, "unexpected resurrection rejection code");
events.push({
  phase: "public-snapshot-resurrection-attempt",
  result: "rejected",
  sequence: vector.resurrection_attempt.envelope.body.sequence,
  organism_id: genesis.organism_id,
  rejection_code: resurrection.code,
  detail: resurrection.deterministic_detail
});

const clone = validateGenesis(canonicalBytes(vector.clone));
invariant(clone.status === "accept", `clone birth rejected: ${clone.code}`);
invariant(clone.organism_id !== genesis.organism_id, "clone reused original identity");
invariant(clone.genome_hash === genesis.genome_hash, "clone did not reuse the genome commitment");
events.push({
  phase: "clone-birth",
  result: "accepted-as-new-identity",
  sequence: clone.sequence,
  organism_id: clone.organism_id,
  original_organism_id: genesis.organism_id,
  same_genome: true,
  custodians: labelsFor(clone.next_custody_descriptor)
});

const trace = {
  format: "mortalos-lifecycle-trace/2",
  protocol: "mortalos/0",
  scenario: "birth-succession-death-resurrection-rejection-clone",
  events,
  assertions: {
    original_custodians_fully_replaced: true,
    organism_id_preserved_through_succession: true,
    accepted_object_replay_rejected: true,
    latent_successor_survived_key_loss: true,
    state_loss_reported_as_stalled_not_dead: true,
    authority_death_reported_only_after_pending_set_drained: true,
    public_snapshot_cannot_resurrect_lineage: true,
    clone_has_distinct_identity: true
  }
};
trace.trace_sha256 = createHash("sha256").update(canonicalize(trace)).digest("hex");

if (verifyOnly) {
  console.log(`MortalOS H2 trace verification: PASS (${trace.trace_sha256})`);
} else {
  console.log(JSON.stringify(trace, null, 2));
}
