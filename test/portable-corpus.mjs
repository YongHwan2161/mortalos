import {
  canonicalBytes,
  createLineage,
  derivePeerId,
  encodeBase64Url,
  hexToBytes,
  snapshotBytes,
  validateGenesis,
  validateLatentSuccessor,
  validatePulse,
  verifyEd25519Raw
} from "../src/index.mjs";
import { validateMortalitySuccessor } from "../src/validator.mjs";
import { runPortableScenario } from "./portable-scenario.mjs";

export const PORTABLE_CORPUS_VERSION = "mortalos-portable-corpus/3";
export const ADVERSARIAL_CASES = 10_000;
export const ADVERSARIAL_SEED = 0x4d4f5254;

const zeroDigest = `sha256:${encodeBase64Url(new Uint8Array(32))}`;
const zeroSignature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function acceptedLifecycle(lifecycle) {
  const genesis = validateGenesis(canonicalBytes(lifecycle.birth));
  if (genesis.status !== "accept") throw new Error(`portable Genesis rejected: ${genesis.code}`);
  const parents = [genesis];
  let parent = genesis;
  for (const step of lifecycle.steps) {
    parent = validatePulse({
      genesis,
      parent,
      envelopeBytes: canonicalBytes(step.envelope),
      eventPayloadBytes: canonicalBytes(step.payload)
    });
    if (parent.status !== "accept") throw new Error(`portable Pulse rejected: ${parent.code}`);
    parents.push(parent);
  }
  return { genesis, parents, head: parent };
}

function pulseResult(lifecycle, accepted, stepIndex, mutate) {
  const step = clone(lifecycle.steps[stepIndex]);
  mutate(step);
  return validatePulse({
    genesis: accepted.genesis,
    parent: accepted.parents[stepIndex],
    envelopeBytes: canonicalBytes(step.envelope),
    eventPayloadBytes: canonicalBytes(step.payload)
  });
}

function runNegativeCases(lifecycle, accepted) {
  const cases = [
    ["identity", "E_ORGANISM_ID_MISMATCH", (step) => { step.envelope.body.organism_id = `mortalos:${encodeBase64Url(new Uint8Array(32))}`; }],
    ["sequence", "E_SEQUENCE_NOT_NEXT", (step) => { step.envelope.body.sequence = "2"; }],
    ["parent", "E_PARENT_HASH_MISMATCH", (step) => { step.envelope.body.parent_hash = zeroDigest; }],
    ["genome", "E_GENOME_HASH_MISMATCH", (step) => { step.envelope.body.genome_hash = zeroDigest; }],
    ["custody", "E_CURRENT_CUSTODY_HASH_MISMATCH", (step) => { step.envelope.body.current_custody_hash = zeroDigest; }],
    ["state", "E_MEMBERSHIP_STATE_CHANGED", (step) => { step.envelope.body.state_root = zeroDigest; }],
    ["payload", "E_EVENT_PAYLOAD_MISMATCH", (step) => { step.payload = { substituted: true }; }],
    ["signature", "E_APPROVAL_SIGNATURE_INVALID", (step) => { step.envelope.approvals[0].signature = zeroSignature; }],
    ["quorum", "E_APPROVAL_INSUFFICIENT_QUORUM", (step) => { step.envelope.approvals = step.envelope.approvals.slice(0, 1); }],
    ["acceptance", "E_ACCEPTANCE_MISSING", (step) => { step.envelope.acceptances = []; }],
    ["custodian-empty", "E_CUSTODIAN_COUNT_RANGE", (step) => { step.envelope.body.next_custodians = []; }],
    ["threshold-zero", "E_QUORUM_THRESHOLD_RANGE", (step) => { step.envelope.body.next_quorum.threshold = 0; }],
    ["event-kind", "E_EVENT_KIND_UNSUPPORTED", (step) => { step.envelope.body.event.kind = "state-transition"; }],
    ["sequence-format", "E_SEQUENCE_INVALID_FORMAT", (step) => { step.envelope.body.sequence = "01"; }],
    ["no-op-membership", "E_MEMBERSHIP_CUSTODY_UNCHANGED", (step) => {
      step.envelope.body.next_custodians = clone(lifecycle.birth.body.initial_custodians);
      step.envelope.body.next_quorum = clone(lifecycle.birth.body.initial_quorum);
      step.envelope.acceptances = [];
    }]
  ];
  return cases.map(([id, expected, mutate]) => {
    const result = pulseResult(lifecycle, accepted, 0, mutate);
    return { id, expected, actual: result.code, pass: result.code === expected };
  });
}

function runAdversarialCorpus(lifecycle, accepted) {
  const random = generator(ADVERSARIAL_SEED);
  const histogram = {};
  let rejected = 0;
  for (let index = 0; index < ADVERSARIAL_CASES; index += 1) {
    const stepIndex = random() % lifecycle.steps.length;
    const mutation = random() % 8;
    const step = clone(lifecycle.steps[stepIndex]);
    switch (mutation) {
      case 0:
        step.envelope.body.organism_id = `mortalos:${encodeBase64Url(new Uint8Array(32))}`;
        break;
      case 1:
        step.envelope.body.sequence = String(Number(step.envelope.body.sequence) + 1);
        break;
      case 2:
        step.envelope.body.parent_hash = zeroDigest;
        break;
      case 3:
        step.envelope.body.genome_hash = zeroDigest;
        break;
      case 4:
        step.envelope.body.state_root = zeroDigest;
        break;
      case 5:
        step.payload = { mutated_case: index };
        break;
      case 6:
        step.envelope.approvals[0].signature = zeroSignature;
        break;
      default:
        step.envelope.approvals = step.envelope.approvals.slice(0, 1);
    }
    const result = validatePulse({
      genesis: accepted.genesis,
      parent: accepted.parents[stepIndex],
      envelopeBytes: canonicalBytes(step.envelope),
      eventPayloadBytes: canonicalBytes(step.payload)
    });
    if (result.status === "reject") rejected += 1;
    const key = result.code ?? result.status;
    histogram[key] = (histogram[key] ?? 0) + 1;
  }
  return {
    seed_decimal: ADVERSARIAL_SEED,
    cases: ADVERSARIAL_CASES,
    rejected,
    histogram: Object.fromEntries(Object.entries(histogram).sort(([a], [b]) => a < b ? -1 : 1))
  };
}

function runTrustCases(lifecycle, accepted) {
  const step = lifecycle.steps[0];
  const clonedGenesis = validatePulse({
    genesis: clone(accepted.genesis),
    parent: accepted.parents[0],
    envelopeBytes: canonicalBytes(step.envelope),
    eventPayloadBytes: canonicalBytes(step.payload)
  });
  const clonedParent = validatePulse({
    genesis: accepted.genesis,
    parent: clone(accepted.parents[0]),
    envelopeBytes: canonicalBytes(step.envelope),
    eventPayloadBytes: canonicalBytes(step.payload)
  });
  const partial = clone(lifecycle.steps[2]);
  partial.envelope.acceptances = [];
  const latent = validateLatentSuccessor({
    genesis: accepted.genesis,
    parent: accepted.parents[2],
    envelopeBytes: canonicalBytes(partial.envelope),
    eventPayloadBytes: canonicalBytes(partial.payload)
  });
  const completion = clone(lifecycle.steps[0]);
  const potentialApprovalKeyId = completion.envelope.approvals.at(-1).key_id;
  completion.envelope.approvals = completion.envelope.approvals.slice(0, 1);
  const strictCompletion = validatePulse({
    genesis: accepted.genesis,
    parent: accepted.parents[0],
    envelopeBytes: canonicalBytes(completion.envelope),
    eventPayloadBytes: canonicalBytes(completion.payload)
  });
  const conditionalCompletion = validateMortalitySuccessor(
    {
      genesis: accepted.genesis,
      parent: accepted.parents[0],
      envelopeBytes: canonicalBytes(completion.envelope),
      eventPayloadBytes: canonicalBytes(completion.payload)
    },
    [potentialApprovalKeyId]
  );
  return {
    cloned_genesis: clonedGenesis.code,
    cloned_parent: clonedParent.code,
    latent_status: latent.status,
    latent_missing: latent.missing_acceptance_key_ids.length,
    conditional_completion_status: conditionalCompletion.status,
    conditional_missing_current_approvals:
      conditionalCompletion.missing_current_approval_key_ids.length,
    strict_completion_code: strictCompletion.code
  };
}

function runForkCases(fork) {
  const opened = createLineage(canonicalBytes(fork.genesis));
  if (opened.status !== "accept") throw new Error(`fork Genesis rejected: ${opened.code}`);
  const input = (entry) => ({
    envelopeBytes: canonicalBytes(entry.envelope),
    eventPayloadBytes: canonicalBytes(entry.payload)
  });
  const first = opened.lineage.append(input(fork.first));
  const replay = opened.lineage.append(input(fork.first));
  const sibling = opened.lineage.append(input(fork.sibling));
  const postFork = opened.lineage.append(input(fork.post_fork));
  return {
    first: first.status,
    replay: replay.code,
    sibling: sibling.code,
    equivocation_count: sibling.equivocating_key_ids?.length ?? 0,
    post_fork: postFork.code,
    head_after_fork: opened.lineage.head
  };
}

function runBoundaryCases(lifecycle, rfc8032) {
  const identity = hexToBytes(`01${"00".repeat(31)}`);
  const universalSignature = new Uint8Array(64);
  universalSignature.set(identity);
  const invalidRSignature = new Uint8Array(64);
  invalidRSignature.set(identity);

  class HostileBytes extends Uint8Array {
    get byteLength() {
      return 0;
    }

    get buffer() {
      throw new Error("hostile buffer getter");
    }

    get [Symbol.toStringTag]() {
      return "attacker-controlled";
    }
  }

  let sharedBytesRejected = true;
  if (typeof SharedArrayBuffer !== "undefined") {
    try {
      snapshotBytes(new Uint8Array(new SharedArrayBuffer(1)));
      sharedBytesRejected = false;
    } catch {
      sharedBytesRejected = true;
    }
  }

  return {
    low_order_peer_id_rejected:
      derivePeerId(`ed25519:${encodeBase64Url(identity)}`) === null,
    universal_signature_rejected: !verifyEd25519Raw(
      identity,
      new Uint8Array(),
      universalSignature
    ),
    low_order_signature_r_rejected: !verifyEd25519Raw(
      hexToBytes(rfc8032.public_key_hex),
      hexToBytes(rfc8032.message_hex),
      invalidRSignature
    ),
    hostile_byte_metadata_ignored:
      validateGenesis(new HostileBytes(canonicalBytes(lifecycle.birth))).status === "accept",
    shared_bytes_rejected: sharedBytesRejected,
    falsey_root_code: validateGenesis(canonicalBytes(0)).code
  };
}

export function runPortableCorpus({ lifecycle, singleton, fork, rfc8032 }) {
  const accepted = acceptedLifecycle(lifecycle);
  const negativeCases = runNegativeCases(lifecycle, accepted);
  const rfcSignatureMutation = hexToBytes(rfc8032.signature_hex);
  rfcSignatureMutation[0] ^= 1;
  const primitiveExample = {
    numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
    string: "€$\u000f\nAB\"\\\"/",
    literals: [null, true, false]
  };
  const orderingExample = {
    "€": "Euro Sign",
    "\r": "Carriage Return",
    "דּ": "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "😀": "Emoji: Grinning Face",
    "\u0080": "Control",
    "ö": "Latin Small Letter O With Diaeresis"
  };
  return {
    format: PORTABLE_CORPUS_VERSION,
    standards: {
      rfc8032_vector_1: verifyEd25519Raw(
        hexToBytes(rfc8032.public_key_hex),
        hexToBytes(rfc8032.message_hex),
        hexToBytes(rfc8032.signature_hex)
      ),
      rfc8032_mutation_rejected: !verifyEd25519Raw(
        hexToBytes(rfc8032.public_key_hex),
        hexToBytes(rfc8032.message_hex),
        rfcSignatureMutation
      ),
      rfc8032_short_key_rejected: !verifyEd25519Raw(
        new Uint8Array(31),
        hexToBytes(rfc8032.message_hex),
        hexToBytes(rfc8032.signature_hex)
      ),
      rfc8785_primitive: new TextDecoder().decode(canonicalBytes(primitiveExample)),
      rfc8785_utf16_ordering: new TextDecoder().decode(canonicalBytes(orderingExample))
    },
    singleton: runPortableScenario(singleton),
    lifecycle: {
      organism_id: accepted.genesis.organism_id,
      accepted_pulses: lifecycle.steps.length,
      head_hash: accepted.head.object_hash,
      clone_is_distinct: validateGenesis(canonicalBytes(lifecycle.clone)).organism_id !== accepted.genesis.organism_id
    },
    negative_cases: negativeCases,
    all_negative_cases_pass: negativeCases.every((entry) => entry.pass),
    boundary_cases: runBoundaryCases(lifecycle, rfc8032),
    trust_cases: runTrustCases(lifecycle, accepted),
    fork_cases: runForkCases(fork),
    adversarial: runAdversarialCorpus(lifecycle, accepted)
  };
}
