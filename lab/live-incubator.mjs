import {
  canonicalBytes,
  custodyCommitment,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash
} from "../src/index.mjs";
import {
  createInitialState,
  createNurtureInput,
  createStateTransitionPayload,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../src/state/engine.mjs";
import {
  r1AppendCandidates,
  r1EvaluateMortality,
  r1ValidateGenesis,
  r1VerifyCandidate
} from "./r1-client.mjs";
import { deriveSigningRequest } from "./signing-policy.mjs";

const THRESHOLD = Object.freeze({ type: "threshold", threshold: 2 });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomTagged(prefix, length) {
  const value = new Uint8Array(length);
  globalThis.crypto.getRandomValues(value);
  return `${prefix}${encodeBase64Url(value)}`;
}

function publicCustodian(raw) {
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return { key_id: derivePeerId(public_key), public_key };
}

function sortByKeyId(entries) {
  return [...entries].sort((left, right) => left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
}

function evidence(keyId, signatureRaw) {
  return { key_id: keyId, signature: `ed25519:${encodeBase64Url(signatureRaw)}` };
}

function assertResult(result, expectedStatus, operation) {
  if (result.status !== expectedStatus) {
    throw new Error(`${operation} returned ${result.code ?? result.status}`);
  }
  return result;
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

class CustodianClient {
  #counter = 0;
  #pending = new Map();
  #worker;

  constructor(workerUrl) {
    this.#worker = new Worker(workerUrl, { type: "module", name: "mortalos-custodian" });
    this.#worker.addEventListener("message", ({ data }) => this.#receive(data));
    this.#worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "custodian Worker failed");
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.#pending.clear();
    });
  }

  #receive(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.id !== "string") return;
    const pending = this.#pending.get(data.id);
    if (!pending) return;
    this.#pending.delete(data.id);
    clearTimeout(pending.timer);
    if (data.type === "error") {
      const allowed = ["id", "message", "name", "type"];
      if (Object.keys(data).some((key) => !allowed.includes(key))) {
        pending.reject(new Error("custodian returned a non-allowlisted error"));
      } else {
        pending.reject(new Error(`${data.name}: ${data.message}`));
      }
      return;
    }
    pending.resolve(data);
  }

  #request(type, fields = {}) {
    const id = `request-${this.#counter += 1}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`custodian ${type} request timed out`));
      }, 10_000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#worker.postMessage({ id, type, ...fields });
    });
  }

  async initialize() {
    const response = await this.#request("init");
    const allowed = ["id", "privateExportRejected", "privateExtractable", "publicKeyRaw", "type"];
    if (
      response.type !== "ready" ||
      Object.keys(response).some((key) => !allowed.includes(key)) ||
      !(response.publicKeyRaw instanceof Uint8Array) ||
      response.publicKeyRaw.byteLength !== 32 ||
      response.privateExtractable !== false ||
      response.privateExportRejected !== true
    ) {
      throw new Error("custodian failed its non-extractability contract");
    }
    this.custodian = publicCustodian(response.publicKeyRaw);
    this.security = {
      private_extractable: response.privateExtractable,
      private_export_rejected: response.privateExportRejected
    };
    return this;
  }

  async sign(operation, body) {
    const expected = deriveSigningRequest(operation, body);
    const response = await this.#request("sign", { operation, body });
    const allowed = ["context", "id", "signatureRaw", "type"];
    if (
      response.type !== "signature" ||
      response.context !== expected.context ||
      Object.keys(response).some((key) => !allowed.includes(key)) ||
      !(response.signatureRaw instanceof Uint8Array) ||
      response.signatureRaw.byteLength !== 64
    ) {
      throw new Error("custodian returned a non-allowlisted signature response");
    }
    return evidence(this.custodian.key_id, response.signatureRaw);
  }

  async destroy() {
    try {
      const response = await this.#request("destroy");
      if (response.type !== "destroyed") throw new Error("custodian did not acknowledge destruction");
    } finally {
      this.#worker.terminate();
    }
  }

  terminate() {
    this.#worker.terminate();
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("custodian Worker terminated"));
    }
    this.#pending.clear();
  }
}

export class BrowserIncubator {
  #clients = [];
  #genesisEnvelope = null;
  #genesisResult = null;
  #head = null;
  #genomeBytes = null;
  #stateBytes = null;
  #pendingHeartbeat = null;
  #records = [];
  #retired = false;

  get publicState() {
    return {
      custodians: this.#clients.map((client) => ({ ...client.custodian, ...client.security })),
      organism_id: this.#genesisResult?.organism_id ?? null,
      head_hash: this.#head?.object_hash ?? null,
      sequence: this.#head?.sequence ?? null,
      protocol_version: this.#genesisResult?.protocol_version ?? null,
      state: this.#stateBytes ? JSON.parse(new TextDecoder().decode(this.#stateBytes)) : null,
      state_root: this.#head?.next_state_root ?? null,
      retired: this.#retired,
      records: clone(this.#records)
    };
  }

  async birth(workerUrl = "./custodian-worker.js") {
    if (this.#clients.length) throw new Error("this incubator has already created an organism");
    if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
      throw new Error("MortalOS Lab requires localhost or HTTPS WebCrypto");
    }
    const created = Array.from({ length: 3 }, () => new CustodianClient(workerUrl));
    try {
      const clients = await Promise.all(created.map((client) => client.initialize()));
      this.#clients = clients.sort((left, right) =>
        left.custodian.key_id < right.custodian.key_id ? -1 : 1
      );
      if (new Set(this.#clients.map((client) => client.custodian.key_id)).size !== 3) {
        throw new Error("custodian key IDs must be distinct");
      }

      const initialStateBytes = createInitialState(globalThis.crypto.getRandomValues(new Uint8Array(16)));
      const body = createGenesisBody({
        custodians: this.#clients.map((client) => client.custodian),
        genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
        genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
        initialStateBytes,
        protocolVersion: "mortalos/1",
        stateRoot: stateRoot(initialStateBytes),
        nonce: randomTagged("nonce:", 16)
      });
      const approvals = await Promise.all(
        this.#clients.map((client) => client.sign("genesis", body))
      );
      const envelope = genesisEnvelope(body, approvals);
      const opened = assertResult(r1ValidateGenesis(envelope).outcome, "accept", "Genesis");
      this.#genesisEnvelope = envelope;
      this.#genesisResult = opened;
      this.#head = opened;
      this.#genomeBytes = new Uint8Array(PULSE_SEED_V1_GENOME_BYTES);
      this.#stateBytes = initialStateBytes;
      this.#records = [{ kind: "genesis", envelope }];
      return { result: opened, state: this.publicState };
    } catch (error) {
      for (const client of created) client.terminate();
      this.#clients = [];
      this.#genesisEnvelope = null;
      this.#genesisResult = null;
      this.#head = null;
      this.#genomeBytes = null;
      this.#stateBytes = null;
      this.#records = [];
      throw error;
    }
  }

  async tryOneSigner(signerIndex = 0) {
    if (!this.#head || this.#retired) throw new Error("a live lineage is required");
    if (this.#pendingHeartbeat) throw new Error("a heartbeat is already pending");
    const body = createHeartbeatBody({ genesis: this.#genesisResult, parent: this.#head });
    const bodyBytes = canonicalBytes(body);
    const parentHash = this.#head.object_hash;
    if (!Number.isInteger(signerIndex) || !this.#clients[signerIndex]) {
      throw new Error("one-signer index is invalid");
    }
    const approval = await this.#clients[signerIndex].sign("pulse", body);
    const envelope = pulseEnvelope(body, [approval]);
    const result = r1VerifyCandidate(
      this.#genesisEnvelope,
      this.#records,
      { envelope, payload: {} }
    ).outcome.result;
    this.#pendingHeartbeat = { body, bodyBytes, approvals: [approval], parentHash, signerIndex };
    return result;
  }

  async completeHeartbeat(signerIndex = 1) {
    if (!this.#pendingHeartbeat || !this.#head || this.#retired) {
      throw new Error("run the one-signer check first");
    }
    const pending = this.#pendingHeartbeat;
    if (
      !Number.isInteger(signerIndex) ||
      !this.#clients[signerIndex] ||
      signerIndex === pending.signerIndex
    ) {
      throw new Error("the second signer must be a different current custodian");
    }
    if (
      pending.parentHash !== this.#head.object_hash ||
      encodeBase64Url(canonicalBytes(pending.body)) !== encodeBase64Url(pending.bodyBytes)
    ) {
      throw new Error("pending heartbeat body changed before quorum completion");
    }
    const second = await this.#clients[signerIndex].sign("pulse", pending.body);
    const envelope = pulseEnvelope(pending.body, [...pending.approvals, second]);
    const result = r1AppendCandidates(
      this.#genesisEnvelope,
      this.#records,
      [{ envelope, payload: {} }]
    ).outcome.results[0];
    assertResult(result, "accept", "heartbeat");
    this.#records.push({ kind: "pulse", envelope, payload: {} });
    this.#head = result;
    this.#pendingHeartbeat = null;
    return result;
  }

  replayLast() {
    const last = this.#records.at(-1);
    if (!last || last.kind !== "pulse") throw new Error("an accepted heartbeat is required");
    return r1AppendCandidates(
      this.#genesisEnvelope,
      this.#records,
      [{ envelope: last.envelope, payload: last.payload }]
    ).outcome.results[0];
  }

  async nurture(signerIndexes = [0, 1], steps = 1) {
    if (!this.#head || !this.#stateBytes || this.#retired) throw new Error("a live v1 lineage is required");
    if (this.#pendingHeartbeat) throw new Error("complete or reload the pending candidate before nurturing");
    if (
      !Array.isArray(signerIndexes) ||
      signerIndexes.length !== 2 ||
      signerIndexes[0] === signerIndexes[1] ||
      signerIndexes.some((index) => !Number.isInteger(index) || !this.#clients[index])
    ) {
      throw new Error("nurture requires two distinct current custodians");
    }
    const transition = createStateTransitionPayload({
      genomeBytes: this.#genomeBytes,
      inputBytes: createNurtureInput(steps),
      stateBytes: this.#stateBytes
    });
    const body = createStateTransitionBody({
      genesis: this.#genesisResult,
      parent: this.#head,
      nextStateRoot: stateRoot(transition.nextStateBytes),
      payload: transition.payload
    });
    const approvals = await Promise.all(
      signerIndexes.map((index) => this.#clients[index].sign("pulse", body))
    );
    const envelope = pulseEnvelope(body, approvals);
    const result = r1AppendCandidates(
      this.#genesisEnvelope,
      this.#records,
      [{ envelope, payload: transition.payload }]
    ).outcome.results[0];
    assertResult(result, "accept", "state transition");
    this.#records.push({ kind: "pulse", envelope, payload: transition.payload });
    this.#head = result;
    this.#stateBytes = transition.nextStateBytes;
    return { result, state: this.publicState };
  }

  async retire() {
    if (!this.#head || this.#retired) throw new Error("live custodians are required");
    if (this.#pendingHeartbeat) throw new Error("complete or reload the pending candidate before retirement");
    await Promise.allSettled(this.#clients.map((client) => client.destroy()));
    this.#retired = true;
    const body = createHeartbeatBody({ genesis: this.#genesisResult, parent: this.#head });
    const result = r1VerifyCandidate(
      this.#genesisEnvelope,
      this.#records,
      { envelope: pulseEnvelope(body, []), payload: {} }
    ).outcome.result;
    return {
      continuation: result,
      mortality: r1EvaluateMortality(this.#genesisEnvelope, this.#records, {
        usableKeyIds: [],
        stateAvailable: true,
        pendingSuccessors: [],
        authorityLossIrreversible: false,
        latentEvidenceComplete: false
      }).outcome.mortality
    };
  }

  shutdown() {
    for (const client of this.#clients) client.terminate();
    this.#clients = [];
  }
}
