import {
  canonicalBytes,
  custodyAcceptanceMessage,
  decodeBase64Url,
  derivePeerId,
  encodeBase64Url,
  genesisApprovalMessage,
  parseJsonBytes,
  pulseApprovalMessage
} from "../../src/index.mjs";
import {
  createInitialState,
  createNurtureInput,
  createStateTransitionPayload,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../../src/state/engine.mjs";
import {
  createGenesisBody,
  createMembershipChangeBody,
  createStateTransitionBody,
  genesisEnvelope,
  pulseEnvelope
} from "../live-incubator.mjs";
import {
  r1AppendCandidates,
  r1EvaluateMortality,
  r1ReplayLineage,
  r1ValidateGenesis,
  r1VerifyCandidate
} from "../r1-client.mjs";

const textDecoder = new TextDecoder();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByKeyId(entries) {
  return [...entries].sort((left, right) => left.key_id.localeCompare(right.key_id));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is invalid`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unknown or missing fields`);
  }
}

function randomNonce(prefix) {
  return `${prefix}${encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`;
}

async function newKey() {
  const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  if (generated.privateKey.extractable) throw new Error("quorum endpoint key is extractable");
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  let privateExportRejected = false;
  try {
    await crypto.subtle.exportKey("pkcs8", generated.privateKey);
  } catch {
    privateExportRejected = true;
  }
  if (!privateExportRejected) throw new Error("quorum endpoint private export succeeded");
  return {
    custodian: { key_id: derivePeerId(public_key), public_key },
    privateExportRejected,
    privateKey: generated.privateKey
  };
}

async function signature(key, message) {
  return {
    key_id: key.custodian.key_id,
    signature: `ed25519:${encodeBase64Url(new Uint8Array(await crypto.subtle.sign("Ed25519", key.privateKey, message)))}`
  };
}

function currentStateBytes(genesis, records) {
  let bytes = decodeBase64Url(genesis.body.initial_state_base64url);
  if (!bytes) throw new Error("Genesis state bytes unavailable");
  for (const record of records) {
    if (record.envelope?.body?.event?.kind !== "state-transition") continue;
    const next = decodeBase64Url(record.payload?.next_state_base64url);
    if (!next) throw new Error("transition state bytes unavailable");
    bytes = next;
  }
  return bytes;
}

function recordKey(record) {
  return textDecoder.decode(canonicalBytes(record));
}

function proposalRecord(proposal, approvals, acceptances = []) {
  return {
    envelope: pulseEnvelope(proposal.body, approvals, acceptances),
    payload: clone(proposal.payload)
  };
}

export class QuorumProtocolError extends Error {
  constructor(code, detail = "quorum protocol rejected") {
    super(`${code}: ${detail}`);
    this.name = "QuorumProtocolError";
    this.code = code;
  }
}

export function classifyEndpointStatus({ keyAvailable, stateAvailable, transportAvailable, usableKeys, threshold }) {
  if (!keyAvailable) return "key_lost";
  if (!stateAvailable) return "state_unavailable";
  if (!transportAvailable) return "transport_unavailable";
  if (!Number.isSafeInteger(usableKeys) || !Number.isSafeInteger(threshold) || usableKeys < threshold) {
    return "authority_below_quorum";
  }
  return "operational";
}

export function createThreeEndpointGenesisBody(custodians) {
  if (!Array.isArray(custodians) || custodians.length !== 3) {
    throw new TypeError("exactly three public custodians required");
  }
  const initialStateBytes = createInitialState(crypto.getRandomValues(new Uint8Array(16)));
  return createGenesisBody({
    custodians: clone(custodians),
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
    initialQuorum: { type: "threshold", threshold: 2 },
    initialStateBytes,
    nonce: randomNonce("nonce:"),
    protocolVersion: "mortalos/1",
    stateRoot: stateRoot(initialStateBytes)
  });
}

export function assembleThreeEndpointGenesis(body, approvals) {
  const expected = body.initial_custodians.map((entry) => entry.key_id).sort();
  const actual = approvals.map((entry) => entry.key_id).sort();
  if (actual.length !== 3 || actual.some((keyId, index) => keyId !== expected[index])) {
    throw new QuorumProtocolError("E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED", "3-of-3 origin approval");
  }
  const envelope = genesisEnvelope(clone(body), sortByKeyId(approvals));
  const opened = r1ValidateGenesis(envelope).outcome;
  if (opened.status !== "accept") throw new QuorumProtocolError(opened.code, "Genesis validation");
  return { envelope, payload: {} };
}

export class QuorumEndpointParticipant {
  #endpointId;
  #genesis = null;
  #key = null;
  #records = [];
  #signedPulseTuples = new Map();

  constructor(endpointId) {
    if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(endpointId)) {
      throw new TypeError("bounded endpoint ID required");
    }
    this.#endpointId = endpointId;
  }

  get custodian() {
    return this.#key ? clone(this.#key.custodian) : null;
  }

  get genesisRecord() {
    return this.#genesis ? clone(this.#records[0]) : null;
  }

  get keyInventory() {
    return {
      endpoint_id: this.#endpointId,
      key_count: this.#key ? 1 : 0,
      key_id: this.#key?.custodian.key_id ?? null,
      non_extractable: this.#key ? this.#key.privateKey.extractable === false : null,
      private_export_rejected: this.#key?.privateExportRejected ?? null
    };
  }

  get records() {
    return clone(this.#records);
  }

  get publicState() {
    if (!this.#genesis) {
      return {
        current_custodian: false,
        endpoint_id: this.#endpointId,
        head_hash: null,
        key_count: this.#key ? 1 : 0,
        organism_id: null,
        pulse_count: null,
        sequence: null,
        state_root: null,
        status: "empty",
        threshold: null
      };
    }
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") {
      const forked = replay.snapshot?.status === "forked" || replay.terminal?.status === "forked";
      return {
        current_custodian: false,
        endpoint_id: this.#endpointId,
        fork_points: replay.snapshot?.fork_points ?? [],
        head_hash: null,
        key_count: this.#key ? 1 : 0,
        organism_id: genesis.organism_id,
        pulse_count: null,
        sequence: null,
        state_root: null,
        status: forked ? "forked" : "stalled",
        threshold: null
      };
    }
    const head = replay.steps.at(-1) ?? genesis;
    const currentIds = head.next_custody_descriptor.custodians.map((entry) => entry.key_id);
    const state = parseJsonBytes(currentStateBytes(this.#genesis, this.#records));
    return {
      current_custodian: Boolean(this.#key && currentIds.includes(this.#key.custodian.key_id)),
      endpoint_id: this.#endpointId,
      head_hash: head.object_hash,
      key_count: this.#key ? 1 : 0,
      organism_id: genesis.organism_id,
      pulse_count: state.pulse_count,
      sequence: head.sequence,
      state_root: head.next_state_root,
      status: "accepted",
      threshold: head.next_custody_descriptor.quorum.threshold
    };
  }

  async initializeKey() {
    if (this.#key) throw new Error("endpoint key already initialized");
    this.#key = await newKey();
    return this.custodian;
  }

  async approveGenesis(body) {
    if (!this.#key) throw new Error("endpoint key is unavailable");
    if (!body.initial_custodians.some((entry) => entry.key_id === this.#key.custodian.key_id)) {
      throw new Error("endpoint is not an origin custodian");
    }
    return signature(this.#key, genesisApprovalMessage(body));
  }

  openGenesis(genesisRecord, history = [], { requireAllOriginApprovals = true } = {}) {
    if (this.#genesis) throw new Error("endpoint lineage already initialized");
    const opened = r1ValidateGenesis(genesisRecord.envelope).outcome;
    if (opened.status !== "accept") throw new QuorumProtocolError(opened.code, "Genesis validation");
    if (requireAllOriginApprovals) {
      const expected = genesisRecord.envelope.body.initial_custodians.map((entry) => entry.key_id).sort();
      const actual = genesisRecord.envelope.approvals.map((entry) => entry.key_id).sort();
      if (actual.length !== expected.length || actual.some((keyId, index) => keyId !== expected[index])) {
        throw new QuorumProtocolError("E_GENESIS_ALL_ORIGIN_APPROVALS_REQUIRED", "3-of-3 origin approval");
      }
    }
    this.#genesis = clone(genesisRecord.envelope);
    this.#records = [clone(genesisRecord)];
    if (history.length > 0) this.sync(history);
    return this.publicState;
  }

  createStateProposal(steps = 1) {
    if (!this.#genesis) throw new Error("endpoint has no lineage");
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") throw new Error("endpoint lineage is not linear");
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    const parent = replay.steps.at(-1) ?? genesis;
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

  createMembershipProposal({ nextCustodians, nextQuorum = { type: "threshold", threshold: 2 }, payload }) {
    if (!this.#genesis) throw new Error("endpoint has no lineage");
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") throw new Error("endpoint lineage is not linear");
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    const parent = replay.steps.at(-1) ?? genesis;
    return {
      body: createMembershipChangeBody({ genesis, parent, nextCustodians, nextQuorum, payload }),
      format: "mortalos-quorum-proposal/1",
      payload: clone(payload)
    };
  }

  #assertProposal(proposal) {
    exactKeys(proposal, ["body", "format", "payload"], "quorum proposal");
    if (proposal.format !== "mortalos-quorum-proposal/1") throw new Error("unsupported quorum proposal");
    const preview = r1VerifyCandidate(this.#genesis, this.#records, proposalRecord(proposal, [])).outcome.result;
    if (preview.code !== "E_APPROVAL_INSUFFICIENT_QUORUM") {
      throw new QuorumProtocolError(preview.code ?? preview.status, "proposal body or payload invalid");
    }
  }

  async approveProposal(proposal) {
    if (!this.#key || !this.publicState.current_custodian) throw new Error("endpoint lacks current signing authority");
    this.#assertProposal(proposal);
    const tuple = `${proposal.body.organism_id}/${proposal.body.sequence}/${proposal.body.parent_hash}`;
    const exactBody = textDecoder.decode(canonicalBytes(proposal.body));
    const prior = this.#signedPulseTuples.get(tuple);
    if (prior && prior !== exactBody) throw new QuorumProtocolError("E_LOCAL_EQUIVOCATION_REFUSED", tuple);
    this.#signedPulseTuples.set(tuple, exactBody);
    return signature(this.#key, pulseApprovalMessage(proposal.body));
  }

  async acceptMembership(proposal) {
    if (!this.#key) throw new Error("endpoint key is unavailable");
    exactKeys(proposal, ["body", "format", "payload"], "quorum proposal");
    if (proposal.body.event.kind !== "membership-change") throw new Error("membership proposal required");
    const current = r1ReplayLineage(this.#genesis, this.#records).outcome.steps.at(-1)
      ?? r1ValidateGenesis(this.#genesis).outcome;
    const currentIds = new Set(current.next_custody_descriptor.custodians.map((entry) => entry.key_id));
    const isNew = proposal.body.next_custodians.some((entry) => entry.key_id === this.#key.custodian.key_id)
      && !currentIds.has(this.#key.custodian.key_id);
    if (!isNew) throw new Error("endpoint is not a new custodian in this proposal");
    return signature(this.#key, custodyAcceptanceMessage(proposal.body));
  }

  evaluateProposal(proposal, approvals, acceptances = []) {
    const record = proposalRecord(proposal, sortByKeyId(approvals), sortByKeyId(acceptances));
    return clone(r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result);
  }

  commitProposal(proposal, approvals, acceptances = []) {
    const record = proposalRecord(proposal, sortByKeyId(approvals), sortByKeyId(acceptances));
    const result = r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result;
    if (result.status !== "accept") throw new QuorumProtocolError(result.code, "candidate validation");
    this.#records.push(clone(record));
    return clone(record);
  }

  appendEvidence(record) {
    const result = r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result;
    if (result.status !== "accept") throw new QuorumProtocolError(result.code, "received evidence");
    this.#records.push(clone(record));
    return this.publicState;
  }

  sync(records) {
    if (!this.#genesis) throw new Error("endpoint has no lineage");
    const unique = [...new Map(
      records
        .filter((record) => record.envelope?.kind === "mortalos.pulse")
        .map((record) => [recordKey(record), clone(record)])
    ).values()].sort((left, right) => {
      const sequence = BigInt(left.envelope.body.sequence) - BigInt(right.envelope.body.sequence);
      if (sequence !== 0n) return sequence < 0n ? -1 : 1;
      return recordKey(left).localeCompare(recordKey(right));
    });
    const outcome = r1AppendCandidates(this.#genesis, [], unique).outcome;
    const forked = outcome.snapshot?.status === "forked";
    if (!forked && outcome.results.some((result) => result.status !== "accept")) {
      const failed = outcome.results.find((result) => result.status !== "accept");
      throw new QuorumProtocolError(failed.code, "catch-up validation");
    }
    this.#records = [clone(this.#records[0]), ...unique];
    return this.publicState;
  }

  evaluateAvailability({ usableKeyIds, stateAvailable = true }) {
    return r1EvaluateMortality(this.#genesis, this.#records, {
      authorityLossIrreversible: false,
      latentEvidenceComplete: false,
      pendingSuccessors: [],
      stateAvailable,
      usableKeyIds
    }).outcome.mortality;
  }

  removeAuthority() {
    this.#key = null;
    return this.publicState;
  }
}
