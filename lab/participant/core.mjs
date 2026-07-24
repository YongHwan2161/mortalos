import {
  canonicalBytes,
  custodyAcceptanceMessage,
  decodeBase64Url,
  derivePeerId,
  genesisApprovalMessage,
  parseJsonBytes,
  pulseApprovalMessage
} from "../../src/index.mjs";
import {
  createNurtureInput,
  createStateTransitionPayload,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../../src/state/engine.mjs";
import {
  createGenesisBody,
  createHeartbeatBody,
  createMembershipChangeBody,
  createStateTransitionBody,
  genesisEnvelope,
  pulseEnvelope
} from "./protocol-objects.mjs";
import {
  r1AppendCandidates,
  r1EvaluateMortality,
  r1ReplayLineage,
  r1ValidateGenesis
} from "../r1-client.mjs";
import {
  PARTICIPANT_OPERATION_FORMAT,
  PARTICIPANT_SNAPSHOT_FORMAT
} from "./contracts.mjs";

export {
  createSeededParticipantSchedule,
  participantModelStep,
  runParticipantModelSchedule,
  runSeededParticipantCorpus
} from "./model.mjs";

const textDecoder = new TextDecoder();
const FORK_COMPATIBLE_CATCH_UP_CODES = new Set([
  "E_FORK_DETECTED",
  "E_LINEAGE_ALREADY_FORKED",
  "E_REPLAY_STALE"
]);

function clone(value) {
  return structuredClone(value);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", `${label} is invalid`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", `${label} has unknown or missing fields`);
  }
}

function sortByKeyId(entries) {
  return [...entries].sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
}

function recordKey(record) {
  return textDecoder.decode(canonicalBytes(record));
}

function currentStateBytes(genesis, records) {
  let bytes = decodeBase64Url(genesis.body.initial_state_base64url);
  if (!bytes) throw new ParticipantCoreError("E_STATE_MISSING", "Genesis state bytes unavailable");
  for (const record of records) {
    if (record.envelope?.body?.event?.kind !== "state-transition") continue;
    const next = decodeBase64Url(record.payload?.next_state_base64url);
    if (!next) throw new ParticipantCoreError("E_STATE_CORRUPT", "transition state bytes unavailable");
    bytes = next;
  }
  return bytes;
}

function proposalRecord(proposal, approvals, acceptances = []) {
  return {
    envelope: pulseEnvelope(proposal.body, approvals, acceptances),
    payload: clone(proposal.payload)
  };
}

function assertEndpointId(endpointId) {
  if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(endpointId)) {
    throw new TypeError("bounded endpoint ID required");
  }
}

function assertAccepted(result, detail) {
  if (result.status !== "accept") {
    throw new ParticipantCoreError(result.code ?? "E_PARTICIPANT_REJECTED", detail);
  }
  return result;
}

export class ParticipantCoreError extends Error {
  constructor(code, detail = "participant core rejected") {
    super(`${code}: ${detail}`);
    this.name = "ParticipantCoreError";
    this.code = code;
  }
}

export function classifyParticipantAvailability({
  keyAvailable,
  stateAvailable,
  transportAvailable,
  usableKeys,
  threshold
}) {
  if (!keyAvailable) return "key_lost";
  if (!stateAvailable) return "state_unavailable";
  if (!transportAvailable) return "transport_unavailable";
  if (!Number.isSafeInteger(usableKeys) || !Number.isSafeInteger(threshold) || usableKeys < threshold) {
    return "authority_below_quorum";
  }
  return "operational";
}

export function createParticipantGenesisBody({
  custodians,
  initialStateBytes,
  initialQuorum,
  nonce
}) {
  if (!(initialStateBytes instanceof Uint8Array)) {
    throw new ParticipantCoreError("E_STATE_MISSING", "initial state bytes required");
  }
  if (typeof nonce !== "string" || !nonce.startsWith("nonce:")) {
    throw new ParticipantCoreError("E_PARTICIPANT_NONCE", "tagged Genesis nonce required");
  }
  return createGenesisBody({
    custodians: clone(custodians),
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
    initialQuorum: clone(initialQuorum),
    initialStateBytes,
    nonce,
    protocolVersion: "mortalos/1",
    stateRoot: stateRoot(initialStateBytes)
  });
}

export {
  createGenesisBody,
  createHeartbeatBody,
  createMembershipChangeBody,
  createStateTransitionBody,
  genesisEnvelope,
  pulseEnvelope
};

export function assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals = false } = {}) {
  if (requireAllOriginApprovals) {
    const expected = body.initial_custodians.map((entry) => entry.key_id).sort();
    const actual = approvals.map((entry) => entry.key_id).sort();
    if (actual.length !== expected.length || actual.some((keyId, index) => keyId !== expected[index])) {
      throw new ParticipantCoreError("E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED", "all origin approvals required");
    }
  }
  const record = { envelope: genesisEnvelope(clone(body), sortByKeyId(approvals)), payload: {} };
  assertAccepted(r1ValidateGenesis(record.envelope).outcome, "Genesis validation");
  return record;
}

export function genesisSigningRequest(body, keyId) {
  return Object.freeze({
    format: PARTICIPANT_OPERATION_FORMAT,
    key_id: keyId,
    message: genesisApprovalMessage(body),
    operation: "sign",
    purpose: "genesis"
  });
}

export class ParticipantCore {
  #endpointId;
  #genesis = null;
  #records = [];
  #signOnce = new Map();

  constructor(endpointId) {
    assertEndpointId(endpointId);
    this.#endpointId = endpointId;
  }

  get endpointId() {
    return this.#endpointId;
  }

  get initialized() {
    return Boolean(this.#genesis);
  }

  get genesisRecord() {
    return this.#genesis ? clone(this.#records[0]) : null;
  }

  get records() {
    return clone(this.#records);
  }

  openGenesis(genesisRecord, history = [], { requireAllOriginApprovals = false } = {}) {
    if (this.#genesis) throw new ParticipantCoreError("E_LINEAGE_ALREADY_INITIALIZED");
    if (requireAllOriginApprovals) {
      const expected = genesisRecord.envelope.body.initial_custodians.map((entry) => entry.key_id).sort();
      const actual = genesisRecord.envelope.approvals.map((entry) => entry.key_id).sort();
      if (actual.length !== expected.length || actual.some((keyId, index) => keyId !== expected[index])) {
        throw new ParticipantCoreError("E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED", "all origin approvals required");
      }
    }
    assertAccepted(r1ValidateGenesis(genesisRecord.envelope).outcome, "Genesis validation");
    const candidateRecords = [clone(genesisRecord), ...clone(history)];
    const replay = r1ReplayLineage(genesisRecord.envelope, candidateRecords).outcome;
    if (replay.status !== "complete") {
      throw new ParticipantCoreError(
        replay.terminal?.code ?? replay.genesis?.code ?? "E_HISTORY_INCOMPLETE",
        "lineage history is incomplete"
      );
    }
    this.#genesis = clone(genesisRecord.envelope);
    this.#records = candidateRecords;
    return this.snapshot();
  }

  snapshot({ keyCount = 0, keyId = null } = {}) {
    if (!this.#genesis) {
      return Object.freeze({
        current_custodian: false,
        endpoint_id: this.#endpointId,
        format: PARTICIPANT_SNAPSHOT_FORMAT,
        fork_points: [],
        head_hash: null,
        key_count: keyCount,
        organism_id: null,
        pulse_count: null,
        sequence: null,
        state: null,
        state_root: null,
        status: "empty",
        threshold: null
      });
    }
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") {
      const forked = replay.snapshot?.status === "forked" || replay.terminal?.status === "forked";
      return Object.freeze({
        current_custodian: false,
        endpoint_id: this.#endpointId,
        format: PARTICIPANT_SNAPSHOT_FORMAT,
        fork_points: clone(replay.snapshot?.fork_points ?? []),
        head_hash: null,
        key_count: keyCount,
        organism_id: genesis.organism_id,
        pulse_count: null,
        sequence: null,
        state: null,
        state_root: null,
        status: forked ? "forked" : "stalled",
        threshold: null
      });
    }
    const head = replay.steps.at(-1) ?? genesis;
    const currentIds = head.next_custody_descriptor.custodians.map((entry) => entry.key_id);
    const state = parseJsonBytes(currentStateBytes(this.#genesis, this.#records));
    return Object.freeze({
      current_custodian: Boolean(keyId && currentIds.includes(keyId)),
      endpoint_id: this.#endpointId,
      format: PARTICIPANT_SNAPSHOT_FORMAT,
      fork_points: [],
      head_hash: head.object_hash,
      key_count: keyCount,
      organism_id: genesis.organism_id,
      pulse_count: state.pulse_count,
      sequence: head.sequence,
      state: clone(state),
      state_root: head.next_state_root,
      status: "accepted",
      threshold: head.next_custody_descriptor.quorum.threshold
    });
  }

  createJoinRequest(custodian, nonce) {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    if (typeof nonce !== "string" || !nonce.startsWith("join:")) {
      throw new ParticipantCoreError("E_PARTICIPANT_NONCE", "tagged join nonce required");
    }
    return {
      custodian: clone(custodian),
      format: "mortalos-join-request/1",
      nonce,
      organism_id: this.snapshot().organism_id
    };
  }

  createStateProposal(steps = 1) {
    const { genesis, parent } = this.#linearHead();
    const transition = createStateTransitionPayload({
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      inputBytes: createNurtureInput(steps),
      stateBytes: currentStateBytes(this.#genesis, this.#records)
    });
    return {
      body: createStateTransitionBody({
        genesis,
        nextStateRoot: stateRoot(transition.nextStateBytes),
        parent,
        payload: transition.payload
      }),
      format: "mortalos-quorum-proposal/1",
      payload: transition.payload
    };
  }

  createHeartbeatProposal() {
    const { genesis, parent } = this.#linearHead();
    return {
      body: createHeartbeatBody({ genesis, parent }),
      format: "mortalos-quorum-proposal/1",
      payload: {}
    };
  }

  createMembershipProposal({
    nextCustodians,
    nextQuorum,
    payload,
    format = "mortalos-quorum-proposal/1"
  }) {
    const { genesis, parent } = this.#linearHead();
    return {
      body: createMembershipChangeBody({
        genesis,
        nextCustodians: clone(nextCustodians),
        nextQuorum: clone(nextQuorum),
        parent,
        payload
      }),
      format,
      payload: clone(payload)
    };
  }

  createHandoffProposal(joinRequest, currentKeyId) {
    exactKeys(joinRequest, ["custodian", "format", "nonce", "organism_id"], "join request");
    exactKeys(joinRequest.custodian, ["key_id", "public_key"], "join custodian");
    if (joinRequest.format !== "mortalos-join-request/1") {
      throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", "unsupported join request");
    }
    if (derivePeerId(joinRequest.custodian.public_key) !== joinRequest.custodian.key_id) {
      throw new ParticipantCoreError("E_JOIN_KEY_IDENTITY", "join key identity mismatch");
    }
    const state = this.snapshot({ keyCount: currentKeyId ? 1 : 0, keyId: currentKeyId });
    if (!state.current_custodian || state.organism_id !== joinRequest.organism_id) {
      throw new ParticipantCoreError("E_AUTHORITY_UNAVAILABLE", "current endpoint cannot authorize this join");
    }
    const payload = {
      format: "mortalos-custody-handoff/1",
      from_key_id: currentKeyId,
      request_nonce: joinRequest.nonce,
      to_key_id: joinRequest.custodian.key_id
    };
    return this.createMembershipProposal({
      format: "mortalos-handoff-proposal/1",
      nextCustodians: [joinRequest.custodian],
      nextQuorum: { type: "threshold", threshold: 1 },
      payload
    });
  }

  approvalRequest(proposal, keyId, { signOnce = true } = {}) {
    this.#assertProposal(proposal);
    const state = this.snapshot({ keyCount: keyId ? 1 : 0, keyId });
    if (!state.current_custodian) {
      throw new ParticipantCoreError("E_AUTHORITY_UNAVAILABLE", "endpoint lacks current signing authority");
    }
    if (signOnce) {
      const tuple = `${keyId}/${proposal.body.organism_id}/${proposal.body.sequence}/${proposal.body.parent_hash}`;
      const exactBody = textDecoder.decode(canonicalBytes(proposal.body));
      const prior = this.#signOnce.get(tuple);
      if (prior && prior !== exactBody) {
        throw new ParticipantCoreError("E_LOCAL_EQUIVOCATION_REFUSED", tuple);
      }
      this.#signOnce.set(tuple, exactBody);
    }
    return Object.freeze({
      format: PARTICIPANT_OPERATION_FORMAT,
      key_id: keyId,
      message: pulseApprovalMessage(proposal.body),
      operation: "sign",
      purpose: "pulse-approval"
    });
  }

  acceptanceRequest(proposal, keyId, { handoff = false } = {}) {
    if (!this.#genesis || !keyId) throw new ParticipantCoreError("E_AUTHORITY_UNAVAILABLE");
    if (handoff) {
      exactKeys(proposal, ["approvals", "body", "format", "payload"], "handoff proposal");
      if (proposal.format !== "mortalos-handoff-proposal/1") {
        throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", "unsupported handoff proposal");
      }
      if (
        proposal.body.organism_id !== this.snapshot().organism_id ||
        proposal.body.next_custodians.length !== 1 ||
        proposal.body.next_custodians[0].key_id !== keyId ||
        proposal.payload.to_key_id !== keyId
      ) {
        throw new ParticipantCoreError("E_HANDOFF_IDENTITY", "handoff does not transfer custody to this endpoint");
      }
    } else {
      exactKeys(proposal, ["body", "format", "payload"], "quorum proposal");
      if (proposal.body.event.kind !== "membership-change") {
        throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", "membership proposal required");
      }
      const current = this.#linearHead().parent;
      const currentIds = new Set(current.next_custody_descriptor.custodians.map((entry) => entry.key_id));
      const isNew = proposal.body.next_custodians.some((entry) => entry.key_id === keyId) && !currentIds.has(keyId);
      if (!isNew) throw new ParticipantCoreError("E_ACCEPTANCE_NOT_NEW_CUSTODIAN");
    }
    return Object.freeze({
      format: PARTICIPANT_OPERATION_FORMAT,
      key_id: keyId,
      message: custodyAcceptanceMessage(proposal.body),
      operation: "sign",
      purpose: "custody-acceptance"
    });
  }

  evaluateProposal(proposal, approvals, acceptances = []) {
    const record = proposalRecord(proposal, sortByKeyId(approvals), sortByKeyId(acceptances));
    return clone(r1AppendCandidates(this.#genesis, this.#records, [record]).outcome.results[0]);
  }

  evaluateEvidence(record) {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    return clone(r1AppendCandidates(this.#genesis, this.#records, [record]).outcome.results[0]);
  }

  commitProposal(proposal, approvals, acceptances = []) {
    const record = proposalRecord(proposal, sortByKeyId(approvals), sortByKeyId(acceptances));
    assertAccepted(r1AppendCandidates(this.#genesis, this.#records, [record]).outcome.results[0], "candidate validation");
    this.#records.push(clone(record));
    return clone(record);
  }

  appendEvidence(record) {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    assertAccepted(r1AppendCandidates(this.#genesis, this.#records, [record]).outcome.results[0], "received evidence");
    this.#records.push(clone(record));
    return this.snapshot();
  }

  sync(records) {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    const unique = [...new Map(
      [...this.#records.slice(1), ...records]
        .filter((record) => record.envelope?.kind === "mortalos.pulse")
        .map((record) => [recordKey(record), clone(record)])
    ).values()].sort((left, right) => {
      const sequence = BigInt(left.envelope.body.sequence) - BigInt(right.envelope.body.sequence);
      if (sequence !== 0n) return sequence < 0n ? -1 : 1;
      return recordKey(left).localeCompare(recordKey(right));
    });
    const outcome = r1AppendCandidates(this.#genesis, [], unique).outcome;
    const failed = outcome.results.find((result) =>
      result.status !== "accept" &&
      !(
        outcome.snapshot?.status === "forked" &&
        FORK_COMPATIBLE_CATCH_UP_CODES.has(result.code)
      ));
    if (failed) throw new ParticipantCoreError(failed.code, "catch-up validation");
    this.#records = [clone(this.#records[0]), ...unique];
    return this.snapshot();
  }

  evaluateAvailability({
    authorityLossIrreversible = false,
    latentEvidenceComplete = false,
    pendingSuccessors = [],
    stateAvailable = true,
    usableKeyIds = []
  }) {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    return clone(r1EvaluateMortality(this.#genesis, this.#records, {
      authorityLossIrreversible,
      latentEvidenceComplete,
      pendingSuccessors,
      stateAvailable,
      usableKeyIds
    }).outcome.mortality);
  }

  #linearHead() {
    if (!this.#genesis) throw new ParticipantCoreError("E_LINEAGE_MISSING");
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") throw new ParticipantCoreError("E_LINEAGE_NOT_LINEAR");
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    return { genesis, parent: replay.steps.at(-1) ?? genesis };
  }

  #assertProposal(proposal) {
    exactKeys(proposal, ["body", "format", "payload"], "participant proposal");
    if (!["mortalos-quorum-proposal/1", "mortalos-handoff-proposal/1"].includes(proposal.format)) {
      throw new ParticipantCoreError("E_PARTICIPANT_SCHEMA", "unsupported participant proposal");
    }
    const preview = r1AppendCandidates(
      this.#genesis,
      this.#records,
      [proposalRecord(proposal, [])]
    ).outcome.results[0];
    if (preview.code !== "E_APPROVAL_INSUFFICIENT_QUORUM") {
      throw new ParticipantCoreError(preview.code ?? preview.status, "proposal body or payload invalid");
    }
  }
}
