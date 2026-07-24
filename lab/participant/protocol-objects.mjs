import {
  custodyCommitment,
  encodeBase64Url,
  eventPayloadHash
} from "../../src/index.mjs";

const THRESHOLD = Object.freeze({ type: "threshold", threshold: 2 });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByKeyId(entries) {
  return [...entries].sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
}

export function createGenesisBody({
  custodians,
  genomeHash,
  genomeBytes = null,
  initialQuorum = THRESHOLD,
  initialStateBytes = null,
  protocolVersion = "mortalos/0",
  stateRoot: initialStateRoot,
  nonce
}) {
  const body = {
    protocol_version: protocolVersion,
    hash_algorithm: "sha-256",
    signature_algorithm: "ed25519",
    genome_hash: genomeHash,
    initial_state_root: initialStateRoot,
    initial_custodians: sortByKeyId(custodians),
    initial_quorum: clone(initialQuorum),
    nonce
  };
  if (protocolVersion === "mortalos/1") {
    body.genome_base64url = encodeBase64Url(genomeBytes);
    body.initial_state_base64url = encodeBase64Url(initialStateBytes);
  }
  return body;
}

export function createHeartbeatBody({ genesis, parent }) {
  return {
    protocol_version: genesis.protocol_version ?? "mortalos/0",
    organism_id: genesis.organism_id,
    sequence: (BigInt(parent.sequence) + 1n).toString(),
    parent_hash: parent.object_hash,
    genome_hash: genesis.genome_hash,
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    state_root: parent.next_state_root,
    event: { kind: "heartbeat", payload_hash: eventPayloadHash({}) },
    next_custodians: clone(parent.next_custody_descriptor.custodians),
    next_quorum: clone(parent.next_custody_descriptor.quorum)
  };
}

export function createStateTransitionBody({ genesis, parent, nextStateRoot, payload }) {
  return {
    protocol_version: "mortalos/1",
    organism_id: genesis.organism_id,
    sequence: (BigInt(parent.sequence) + 1n).toString(),
    parent_hash: parent.object_hash,
    genome_hash: genesis.genome_hash,
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    state_root: nextStateRoot,
    event: { kind: "state-transition", payload_hash: eventPayloadHash(payload) },
    next_custodians: clone(parent.next_custody_descriptor.custodians),
    next_quorum: clone(parent.next_custody_descriptor.quorum)
  };
}

export function createMembershipChangeBody({ genesis, parent, nextCustodians, nextQuorum, payload }) {
  return {
    protocol_version: genesis.protocol_version ?? "mortalos/0",
    organism_id: genesis.organism_id,
    sequence: (BigInt(parent.sequence) + 1n).toString(),
    parent_hash: parent.object_hash,
    genome_hash: genesis.genome_hash,
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    state_root: parent.next_state_root,
    event: { kind: "membership-change", payload_hash: eventPayloadHash(payload) },
    next_custodians: sortByKeyId(nextCustodians),
    next_quorum: clone(nextQuorum)
  };
}

export function genesisEnvelope(body, approvals) {
  return { kind: "mortalos.genesis", body, approvals: sortByKeyId(approvals) };
}

export function pulseEnvelope(body, approvals, acceptances = []) {
  return {
    kind: "mortalos.pulse",
    body,
    approvals: sortByKeyId(approvals),
    acceptances: sortByKeyId(acceptances)
  };
}
