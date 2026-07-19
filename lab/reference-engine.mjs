import { encodeBase64Url } from "../src/index.mjs";
import {
  r1AppendCandidates,
  r1EvaluateMortality,
  r1ValidateGenesis,
  r1VerifyCandidate
} from "./r1-client.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function candidate(entry) {
  return { envelope: entry.envelope, payload: entry.payload };
}

function genesisResult(birth) {
  const result = r1ValidateGenesis(birth).outcome;
  if (result.status !== "accept") throw new Error(`reference Genesis rejected: ${result.code}`);
  return result;
}

function mutationResult(lifecycle, mutate) {
  const value = clone(lifecycle.steps[0]);
  mutate(value);
  return r1VerifyCandidate(lifecycle.birth, [], candidate(value)).outcome.result;
}

function normalized(result) {
  return { status: result.status, code: result.code ?? null };
}

const closedDeath = Object.freeze({
  usableKeyIds: [],
  stateAvailable: true,
  pendingSuccessors: [],
  authorityLossIrreversible: true,
  latentEvidenceComplete: true
});

export function runReferenceScenario({ mutation, lifecycle, fork }) {
  if (mutation === "signed_fork_sibling") {
    const outcome = r1AppendCandidates(
      fork.genesis,
      [],
      [candidate(fork.first), candidate(fork.sibling)]
    ).outcome;
    return normalized(outcome.results[1]);
  }

  if (mutation === "exact_replay") {
    const outcome = r1AppendCandidates(
      lifecycle.birth,
      [],
      [candidate(lifecycle.steps[0]), candidate(lifecycle.steps[0])]
    ).outcome;
    return normalized(outcome.results[1]);
  }
  if (mutation === "resurrection_after_qualified_death") {
    const mortality = r1EvaluateMortality(lifecycle.birth, lifecycle.steps, closedDeath)
      .outcome.mortality;
    if (mortality.status !== "dead_under_v0_assumptions") {
      throw new Error("closed death fixture did not qualify");
    }
    return normalized(r1VerifyCandidate(
      lifecycle.birth,
      lifecycle.steps,
      candidate(lifecycle.resurrection_attempt)
    ).outcome.result);
  }
  if (mutation === "incomplete_evidence_claiming_death") {
    return normalized(r1EvaluateMortality(lifecycle.birth, lifecycle.steps, {
      ...closedDeath,
      latentEvidenceComplete: false
    }).outcome.mortality);
  }

  const value = clone(lifecycle.steps[0]);
  if (mutation === "signature_byte_mutation") {
    value.envelope.approvals[0].signature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;
  } else if (mutation === "parent_hash_mutation") {
    value.envelope.body.parent_hash = `sha256:${encodeBase64Url(new Uint8Array(32))}`;
  } else if (mutation === "organism_id_mutation") {
    value.envelope.body.organism_id = genesisResult(lifecycle.clone).organism_id;
  } else if (mutation === "insufficient_quorum") {
    value.envelope.approvals = value.envelope.approvals.slice(0, 1);
  } else if (mutation === "no_op_membership_change") {
    value.envelope.body.next_custodians = clone(lifecycle.birth.body.initial_custodians);
    value.envelope.body.next_quorum = clone(lifecycle.birth.body.initial_quorum);
    value.envelope.acceptances = [];
  } else if (mutation === "unsigned_forged_acceptance") {
    value.envelope.acceptances[0].signature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;
  } else {
    throw new Error("unknown reference scenario mutation");
  }
  return normalized(r1VerifyCandidate(lifecycle.birth, [], candidate(value)).outcome.result);
}

export function runReferenceProof({ lifecycle, fork }) {
  const genesis = genesisResult(lifecycle.birth);
  const replayedReceipt = r1AppendCandidates(
    lifecycle.birth,
    [],
    lifecycle.steps.map(candidate)
  );
  const replayed = replayedReceipt.outcome;
  const steps = replayed.results.map((result, index) => ({
    id: lifecycle.steps[index].id,
    status: result.status,
    code: result.code ?? null,
    sequence: result.sequence ?? null,
    object_hash: result.object_hash ?? null,
    custodians: result.next_custody_descriptor?.custodians
      .map((entry) => entry.key_id) ?? []
  }));
  const finalResult = replayed.results.at(-1);
  const headBeforeReplay = replayed.snapshot.head_hash;
  const replay = r1AppendCandidates(
    lifecycle.birth,
    lifecycle.steps,
    [candidate(lifecycle.steps.at(-1))]
  ).outcome;
  const resurrection = r1VerifyCandidate(
    lifecycle.birth,
    lifecycle.steps,
    candidate(lifecycle.resurrection_attempt)
  ).outcome.result;
  const mortality = r1EvaluateMortality(
    lifecycle.birth,
    lifecycle.steps,
    closedDeath
  ).outcome.mortality;

  const cloneGenesis = genesisResult(lifecycle.clone);
  const initialIds = new Set(lifecycle.birth.body.initial_custodians.map((entry) => entry.key_id));
  const finalIds = new Set(finalResult.next_custody_descriptor.custodians.map((entry) => entry.key_id));
  const forkRun = r1AppendCandidates(fork.genesis, [], [
    candidate(fork.first),
    candidate(fork.first),
    candidate(fork.sibling),
    candidate(fork.post_fork)
  ]).outcome;
  const [forkFirst, forkReplay, forkSibling, forkPost] = forkRun.results;

  const signatureMutation = mutationResult(lifecycle, (value) => {
    value.envelope.approvals[0].signature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;
  });

  return {
    format: "mortalos-reference-proof/1",
    r1_receipt: {
      operation_base64url: encodeBase64Url(replayedReceipt.operation_bytes),
      result_base64url: encodeBase64Url(replayedReceipt.result_bytes)
    },
    organism_id: genesis.organism_id,
    head_hash: replayed.snapshot.head_hash,
    steps,
    complete_initial_turnover: [...initialIds].every((keyId) => !finalIds.has(keyId)),
    replay: {
      status: replay.results[0].status,
      code: replay.results[0].code ?? null,
      head_unchanged: headBeforeReplay === replay.snapshot.head_hash
    },
    mutations: {
      identity: mutationResult(lifecycle, (value) => {
        value.envelope.body.organism_id = cloneGenesis.organism_id;
      }),
      payload: mutationResult(lifecycle, (value) => {
        value.payload = { substituted: true };
      }),
      signature: signatureMutation,
      one_approval: mutationResult(lifecycle, (value) => {
        value.envelope.approvals = value.envelope.approvals.slice(0, 1);
      })
    },
    fork: {
      first: forkFirst.status,
      replay: forkReplay.code ?? null,
      sibling: forkSibling.code ?? null,
      equivocators: forkSibling.equivocating_key_ids?.length ?? 0,
      post_fork: forkPost.code ?? null,
      head_after_fork: forkRun.snapshot.head_hash
    },
    resurrection: { status: resurrection.status, code: resurrection.code ?? null },
    mortality: {
      ...mortality,
      qualification: "closed fixture only: irreversible key loss and a complete local evidence inventory"
    },
    clone: {
      organism_id: cloneGenesis.organism_id,
      same_genome: cloneGenesis.genome_hash === genesis.genome_hash,
      identity_separate: cloneGenesis.organism_id !== genesis.organism_id
    }
  };
}
