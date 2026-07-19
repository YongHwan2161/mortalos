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
  r1ReplayLineage,
  r1ValidateGenesis,
  r1VerifyCandidate
} from "../r1-client.mjs";

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

async function newKey() {
  const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  if (generated.privateKey.extractable) throw new Error("endpoint key is extractable");
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  const custodian = { key_id: derivePeerId(public_key), public_key };
  try {
    await crypto.subtle.exportKey("pkcs8", generated.privateKey);
    throw new Error("endpoint private export succeeded");
  } catch (error) {
    if (error?.message === "endpoint private export succeeded") throw error;
  }
  return { custodian, privateKey: generated.privateKey };
}

async function signature(keyId, privateKey, message) {
  return {
    key_id: keyId,
    signature: `ed25519:${encodeBase64Url(new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, message)))}`
  };
}

function randomNonce(prefix) {
  return `${prefix}${encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`;
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

export class LiveEndpointParticipant {
  #endpointId;
  #genesis = null;
  #key = null;
  #records = [];

  constructor(endpointId) {
    if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(endpointId)) {
      throw new TypeError("bounded endpoint ID required");
    }
    this.#endpointId = endpointId;
  }

  get endpointId() {
    return this.#endpointId;
  }

  get genesisRecord() {
    return this.#genesis ? clone(this.#records[0]) : null;
  }

  get records() {
    return clone(this.#records);
  }

  get publicState() {
    if (!this.#genesis) {
      return {
        endpoint_id: this.#endpointId,
        head_hash: null,
        organism_id: null,
        pulse_count: null,
        sequence: null,
        signing_authority: Boolean(this.#key),
        state_root: null,
        status: "empty"
      };
    }
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    const genesis = r1ValidateGenesis(this.#genesis).outcome;
    const head = replay.steps.at(-1) ?? genesis;
    const currentIds = head.next_custody_descriptor.custodians.map((entry) => entry.key_id);
    const state = parseJsonBytes(currentStateBytes(this.#genesis, this.#records));
    return {
      endpoint_id: this.#endpointId,
      head_hash: head.object_hash,
      organism_id: genesis.organism_id,
      pulse_count: state.pulse_count,
      sequence: head.sequence,
      signing_authority: Boolean(this.#key && currentIds.includes(this.#key.custodian.key_id)),
      state_root: head.next_state_root,
      status: replay.status === "complete" ? "accepted" : "stalled"
    };
  }

  async create() {
    if (this.#genesis || this.#key) throw new Error("endpoint already initialized");
    this.#key = await newKey();
    const initialStateBytes = createInitialState(crypto.getRandomValues(new Uint8Array(16)));
    const body = createGenesisBody({
      custodians: [this.#key.custodian],
      genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes,
      protocolVersion: "mortalos/1",
      stateRoot: stateRoot(initialStateBytes),
      nonce: randomNonce("nonce:")
    });
    this.#genesis = genesisEnvelope(body, [
      await signature(this.#key.custodian.key_id, this.#key.privateKey, genesisApprovalMessage(body))
    ]);
    const opened = r1ValidateGenesis(this.#genesis).outcome;
    if (opened.status !== "accept") throw new Error(`endpoint Genesis rejected: ${opened.code}`);
    this.#records = [{ envelope: this.#genesis, payload: {} }];
    return this.genesisRecord;
  }

  async join(genesisRecord, history = []) {
    if (this.#genesis || this.#key) throw new Error("endpoint already initialized");
    const opened = r1ValidateGenesis(genesisRecord.envelope).outcome;
    if (opened.status !== "accept") throw new Error(`join Genesis rejected: ${opened.code}`);
    this.#genesis = clone(genesisRecord.envelope);
    this.#records = [clone(genesisRecord), ...clone(history)];
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    if (replay.status !== "complete") throw new Error("join history is incomplete");
    this.#key = await newKey();
    return this.joinRequest();
  }

  joinRequest() {
    if (!this.#genesis || !this.#key) throw new Error("joining endpoint is not initialized");
    return {
      custodian: clone(this.#key.custodian),
      format: "mortalos-join-request/1",
      nonce: randomNonce("join:"),
      organism_id: r1ValidateGenesis(this.#genesis).outcome.organism_id
    };
  }

  async proposeHandoff(joinRequest) {
    exactKeys(joinRequest, ["custodian", "format", "nonce", "organism_id"], "join request");
    exactKeys(joinRequest.custodian, ["key_id", "public_key"], "join custodian");
    if (joinRequest.format !== "mortalos-join-request/1") throw new Error("unsupported join request");
    if (derivePeerId(joinRequest.custodian.public_key) !== joinRequest.custodian.key_id) {
      throw new Error("join key identity mismatch");
    }
    const current = this.publicState;
    if (!current.signing_authority || current.organism_id !== joinRequest.organism_id) {
      throw new Error("current endpoint cannot authorize this join");
    }
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    const parent = replay.steps.at(-1) ?? r1ValidateGenesis(this.#genesis).outcome;
    const payload = {
      format: "mortalos-custody-handoff/1",
      from_key_id: this.#key.custodian.key_id,
      request_nonce: joinRequest.nonce,
      to_key_id: joinRequest.custodian.key_id
    };
    const body = createMembershipChangeBody({
      genesis: r1ValidateGenesis(this.#genesis).outcome,
      nextCustodians: [clone(joinRequest.custodian)],
      nextQuorum: { type: "threshold", threshold: 1 },
      parent,
      payload
    });
    return {
      approvals: [await signature(this.#key.custodian.key_id, this.#key.privateKey, pulseApprovalMessage(body))],
      body,
      format: "mortalos-handoff-proposal/1",
      payload
    };
  }

  async acceptHandoff(proposal) {
    exactKeys(proposal, ["approvals", "body", "format", "payload"], "handoff proposal");
    if (proposal.format !== "mortalos-handoff-proposal/1") throw new Error("unsupported handoff proposal");
    if (!this.#key || proposal.body.organism_id !== this.publicState.organism_id) {
      throw new Error("handoff identity mismatch");
    }
    if (
      proposal.body.next_custodians.length !== 1 ||
      proposal.body.next_custodians[0].key_id !== this.#key.custodian.key_id ||
      proposal.payload.to_key_id !== this.#key.custodian.key_id
    ) {
      throw new Error("handoff does not transfer custody to this endpoint");
    }
    const acceptance = await signature(
      this.#key.custodian.key_id,
      this.#key.privateKey,
      custodyAcceptanceMessage(proposal.body)
    );
    const record = {
      envelope: pulseEnvelope(proposal.body, sortByKeyId(proposal.approvals), [acceptance]),
      payload: clone(proposal.payload)
    };
    const result = r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result;
    if (result.status !== "accept") throw new Error(`handoff rejected locally: ${result.code}`);
    this.appendEvidence(record);
    return clone(record);
  }

  appendEvidence(record) {
    if (!this.#genesis) throw new Error("endpoint has no Genesis");
    const result = r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result;
    if (result.status !== "accept") throw new Error(`received evidence rejected: ${result.code}`);
    this.#records.push(clone(record));
    return this.publicState;
  }

  async nurture(steps = 1) {
    const current = this.publicState;
    if (!current.signing_authority) throw new Error("endpoint lacks current signing authority");
    const replay = r1ReplayLineage(this.#genesis, this.#records).outcome;
    const parent = replay.steps.at(-1) ?? r1ValidateGenesis(this.#genesis).outcome;
    const stateBytes = currentStateBytes(this.#genesis, this.#records);
    const transition = createStateTransitionPayload({
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      inputBytes: createNurtureInput(steps),
      stateBytes
    });
    const body = createStateTransitionBody({
      genesis: r1ValidateGenesis(this.#genesis).outcome,
      nextStateRoot: stateRoot(transition.nextStateBytes),
      parent,
      payload: transition.payload
    });
    const record = {
      envelope: pulseEnvelope(body, [
        await signature(this.#key.custodian.key_id, this.#key.privateKey, pulseApprovalMessage(body))
      ]),
      payload: transition.payload
    };
    const result = r1VerifyCandidate(this.#genesis, this.#records, record).outcome.result;
    if (result.status !== "accept") throw new Error(`state transition rejected: ${result.code}`);
    this.#records.push(clone(record));
    return clone(record);
  }

  removeAuthority() {
    this.#key = null;
    return this.publicState;
  }
}
