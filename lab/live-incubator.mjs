import {
  canonicalBytes,
  createLineage,
  custodyCommitment,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash
} from "../src/index.mjs";
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

export function createGenesisBody({ custodians, genomeHash, stateRoot, nonce }) {
  return {
    protocol_version: "mortalos/0",
    hash_algorithm: "sha-256",
    signature_algorithm: "ed25519",
    genome_hash: genomeHash,
    initial_state_root: stateRoot,
    initial_custodians: sortByKeyId(custodians),
    initial_quorum: clone(THRESHOLD),
    nonce
  };
}

export function createHeartbeatBody({ genesis, parent }) {
  return {
    protocol_version: "mortalos/0",
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

export function genesisEnvelope(body, approvals) {
  return { kind: "mortalos.genesis", body, approvals: sortByKeyId(approvals) };
}

export function pulseEnvelope(body, approvals) {
  return {
    kind: "mortalos.pulse",
    body,
    approvals: sortByKeyId(approvals),
    acceptances: []
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
  #lineage = null;
  #pendingHeartbeat = null;
  #records = [];
  #retired = false;

  get publicState() {
    return {
      custodians: this.#clients.map((client) => ({ ...client.custodian, ...client.security })),
      organism_id: this.#lineage?.genesis.organism_id ?? null,
      head_hash: this.#lineage?.head?.object_hash ?? null,
      sequence: this.#lineage?.head?.sequence ?? null,
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

      const body = createGenesisBody({
        custodians: this.#clients.map((client) => client.custodian),
        genomeHash: randomTagged("sha256:", 32),
        stateRoot: randomTagged("sha256:", 32),
        nonce: randomTagged("nonce:", 16)
      });
      const approvals = await Promise.all(
        this.#clients.map((client) => client.sign("genesis", body))
      );
      const envelope = genesisEnvelope(body, approvals);
      const opened = assertResult(createLineage(canonicalBytes(envelope)), "accept", "Genesis");
      this.#lineage = opened.lineage;
      this.#records = [{ kind: "genesis", envelope }];
      return { result: this.#lineage.genesis, state: this.publicState };
    } catch (error) {
      for (const client of created) client.terminate();
      this.#clients = [];
      this.#lineage = null;
      this.#records = [];
      throw error;
    }
  }

  async tryOneSigner(signerIndex = 0) {
    if (!this.#lineage?.head || this.#retired) throw new Error("a live lineage is required");
    if (this.#pendingHeartbeat) throw new Error("a heartbeat is already pending");
    const body = createHeartbeatBody({ genesis: this.#lineage.genesis, parent: this.#lineage.head });
    const bodyBytes = canonicalBytes(body);
    const parentHash = this.#lineage.head.object_hash;
    if (!Number.isInteger(signerIndex) || !this.#clients[signerIndex]) {
      throw new Error("one-signer index is invalid");
    }
    const approval = await this.#clients[signerIndex].sign("pulse", body);
    const envelope = pulseEnvelope(body, [approval]);
    const result = this.#lineage.verifyCandidate({
      envelopeBytes: canonicalBytes(envelope),
      eventPayloadBytes: canonicalBytes({})
    });
    this.#pendingHeartbeat = { body, bodyBytes, approvals: [approval], parentHash, signerIndex };
    return result;
  }

  async completeHeartbeat(signerIndex = 1) {
    if (!this.#pendingHeartbeat || !this.#lineage?.head || this.#retired) {
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
      pending.parentHash !== this.#lineage.head.object_hash ||
      encodeBase64Url(canonicalBytes(pending.body)) !== encodeBase64Url(pending.bodyBytes)
    ) {
      throw new Error("pending heartbeat body changed before quorum completion");
    }
    const second = await this.#clients[signerIndex].sign("pulse", pending.body);
    const envelope = pulseEnvelope(pending.body, [...pending.approvals, second]);
    const result = this.#lineage.append({
      envelopeBytes: canonicalBytes(envelope),
      eventPayloadBytes: canonicalBytes({})
    });
    assertResult(result, "accept", "heartbeat");
    this.#records.push({ kind: "pulse", envelope, payload: {} });
    this.#pendingHeartbeat = null;
    return result;
  }

  replayLast() {
    const last = this.#records.at(-1);
    if (!last || last.kind !== "pulse") throw new Error("an accepted heartbeat is required");
    return this.#lineage.append({
      envelopeBytes: canonicalBytes(last.envelope),
      eventPayloadBytes: canonicalBytes(last.payload)
    });
  }

  async retire() {
    if (!this.#lineage?.head || this.#retired) throw new Error("live custodians are required");
    if (this.#pendingHeartbeat) throw new Error("complete or reload the pending candidate before retirement");
    await Promise.allSettled(this.#clients.map((client) => client.destroy()));
    this.#retired = true;
    const body = createHeartbeatBody({ genesis: this.#lineage.genesis, parent: this.#lineage.head });
    const result = this.#lineage.verifyCandidate({
      envelopeBytes: canonicalBytes(pulseEnvelope(body, [])),
      eventPayloadBytes: canonicalBytes({})
    });
    return {
      continuation: result,
      mortality: this.#lineage.evaluateMortality({
        usableKeyIds: [],
        stateAvailable: true,
        pendingSuccessors: [],
        authorityLossIrreversible: false,
        latentEvidenceComplete: false
      })
    };
  }

  shutdown() {
    for (const client of this.#clients) client.terminate();
    this.#clients = [];
  }
}
