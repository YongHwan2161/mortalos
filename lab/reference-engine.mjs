import {
  canonicalBytes,
  createLineage,
  encodeBase64Url
} from "../src/index.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function input(entry) {
  return {
    envelopeBytes: canonicalBytes(entry.envelope),
    eventPayloadBytes: canonicalBytes(entry.payload)
  };
}

function open(birth) {
  const result = createLineage(canonicalBytes(birth));
  if (result.status !== "accept") throw new Error(`reference Genesis rejected: ${result.code}`);
  return result.lineage;
}

function mutationResult(lifecycle, mutate) {
  const lineage = open(lifecycle.birth);
  const candidate = clone(lifecycle.steps[0]);
  mutate(candidate);
  return lineage.verifyCandidate(input(candidate));
}

export function runReferenceProof({ lifecycle, fork }) {
  const lineage = open(lifecycle.birth);
  const steps = lifecycle.steps.map((step) => {
    const result = lineage.append(input(step));
    return {
      id: step.id,
      status: result.status,
      code: result.code ?? null,
      sequence: result.sequence ?? null,
      object_hash: result.object_hash ?? null,
      custodians: result.next_custody_descriptor?.custodians.map((entry) => entry.key_id) ?? []
    };
  });
  const headBeforeReplay = lineage.head?.object_hash ?? null;
  const replay = lineage.append(input(lifecycle.steps.at(-1)));
  const headAfterReplay = lineage.head?.object_hash ?? null;
  const resurrection = lineage.verifyCandidate(input(lifecycle.resurrection_attempt));
  const mortality = lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });

  const cloneLineage = open(lifecycle.clone);
  const initialIds = new Set(lifecycle.birth.body.initial_custodians.map((entry) => entry.key_id));
  const finalIds = new Set(lineage.head.next_custody_descriptor.custodians.map((entry) => entry.key_id));

  const forkLineage = open(fork.genesis);
  const forkFirst = forkLineage.append(input(fork.first));
  const forkReplay = forkLineage.append(input(fork.first));
  const forkSibling = forkLineage.append(input(fork.sibling));
  const forkPost = forkLineage.append(input(fork.post_fork));

  const signatureMutation = mutationResult(lifecycle, (candidate) => {
    candidate.envelope.approvals[0].signature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;
  });

  return {
    format: "mortalos-reference-proof/1",
    organism_id: lineage.genesis.organism_id,
    head_hash: lineage.head.object_hash,
    steps,
    complete_initial_turnover: [...initialIds].every((keyId) => !finalIds.has(keyId)),
    replay: {
      status: replay.status,
      code: replay.code ?? null,
      head_unchanged: headBeforeReplay === headAfterReplay
    },
    mutations: {
      identity: mutationResult(lifecycle, (candidate) => {
        candidate.envelope.body.organism_id = cloneLineage.genesis.organism_id;
      }),
      payload: mutationResult(lifecycle, (candidate) => {
        candidate.payload = { substituted: true };
      }),
      signature: signatureMutation,
      one_approval: mutationResult(lifecycle, (candidate) => {
        candidate.envelope.approvals = candidate.envelope.approvals.slice(0, 1);
      })
    },
    fork: {
      first: forkFirst.status,
      replay: forkReplay.code ?? null,
      sibling: forkSibling.code ?? null,
      equivocators: forkSibling.equivocating_key_ids?.length ?? 0,
      post_fork: forkPost.code ?? null,
      head_after_fork: forkLineage.head
    },
    resurrection: { status: resurrection.status, code: resurrection.code ?? null },
    mortality: {
      ...mortality,
      qualification: "closed fixture only: irreversible key loss and a complete local evidence inventory"
    },
    clone: {
      organism_id: cloneLineage.genesis.organism_id,
      same_genome: cloneLineage.genesis.genome_hash === lineage.genesis.genome_hash,
      identity_separate: cloneLineage.genesis.organism_id !== lineage.genesis.organism_id
    }
  };
}
