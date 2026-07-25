import {
  canonicalBytes,
  derivePeerId,
  encodeBase64Url
} from "../src/index.mjs";
import {
  createInitialState
} from "../src/state/engine.mjs";
import { deriveSigningRequest } from "./signing-policy.mjs";
import {
  assembleParticipantGenesis,
  createGenesisBody,
  createHeartbeatBody,
  createMembershipChangeBody,
  createParticipantGenesisBody,
  createStateTransitionBody,
  genesisEnvelope,
  ParticipantCore,
  pulseEnvelope
} from "./participant/core.mjs";

export {
  createGenesisBody,
  createHeartbeatBody,
  createMembershipChangeBody,
  createStateTransitionBody,
  genesisEnvelope,
  pulseEnvelope
};

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

function evidence(keyId, signatureRaw) {
  return { key_id: keyId, signature: `ed25519:${encodeBase64Url(signatureRaw)}` };
}

function publicRecords(records) {
  return records.map((record, index) => index === 0
    ? { kind: "genesis", envelope: clone(record.envelope) }
    : { kind: "pulse", envelope: clone(record.envelope), payload: clone(record.payload) });
}

function acceptedResult(snapshot) {
  return {
    next_state_root: snapshot.state_root,
    object_hash: snapshot.head_hash,
    organism_id: snapshot.organism_id,
    sequence: snapshot.sequence,
    status: "accept"
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
  #core = new ParticipantCore("browser");
  #pendingHeartbeat = null;
  #retired = false;

  get publicState() {
    const snapshot = this.#core.snapshot();
    return {
      custodians: this.#clients.map((client) => ({ ...client.custodian, ...client.security })),
      organism_id: snapshot.organism_id,
      head_hash: snapshot.head_hash,
      sequence: snapshot.sequence,
      protocol_version: this.#core.genesisRecord?.envelope.body.protocol_version ?? null,
      state: snapshot.state,
      state_root: snapshot.state_root,
      retired: this.#retired,
      records: publicRecords(this.#core.records)
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
        left.custodian.key_id.localeCompare(right.custodian.key_id)
      );
      if (new Set(this.#clients.map((client) => client.custodian.key_id)).size !== 3) {
        throw new Error("custodian key IDs must be distinct");
      }
      const body = createParticipantGenesisBody({
        custodians: this.#clients.map((client) => client.custodian),
        initialQuorum: { type: "threshold", threshold: 2 },
        initialStateBytes: createInitialState(globalThis.crypto.getRandomValues(new Uint8Array(16))),
        nonce: randomTagged("nonce:", 16)
      });
      const approvals = await Promise.all(this.#clients.map((client) => client.sign("genesis", body)));
      this.#core.openGenesis(assembleParticipantGenesis(body, approvals));
      const result = acceptedResult(this.#core.snapshot());
      return { result, state: this.publicState };
    } catch (error) {
      for (const client of created) client.terminate();
      this.#clients = [];
      this.#core = new ParticipantCore("browser");
      throw error;
    }
  }

  async tryOneSigner(signerIndex = 0) {
    if (!this.#core.initialized || this.#retired) throw new Error("a live lineage is required");
    if (this.#pendingHeartbeat) throw new Error("a heartbeat is already pending");
    if (!Number.isInteger(signerIndex) || !this.#clients[signerIndex]) {
      throw new Error("one-signer index is invalid");
    }
    const proposal = this.#core.createHeartbeatProposal();
    this.#core.approvalRequest(proposal, this.#clients[signerIndex].custodian.key_id);
    const approval = await this.#clients[signerIndex].sign("pulse", proposal.body);
    const result = this.#core.evaluateProposal(proposal, [approval]);
    this.#pendingHeartbeat = {
      approval,
      bodyBytes: canonicalBytes(proposal.body),
      parentHash: this.#core.snapshot().head_hash,
      proposal,
      signerIndex
    };
    return result;
  }

  async completeHeartbeat(signerIndex = 1) {
    if (!this.#pendingHeartbeat || !this.#core.initialized || this.#retired) {
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
      pending.parentHash !== this.#core.snapshot().head_hash ||
      encodeBase64Url(canonicalBytes(pending.proposal.body)) !== encodeBase64Url(pending.bodyBytes)
    ) {
      throw new Error("pending heartbeat body changed before quorum completion");
    }
    this.#core.approvalRequest(pending.proposal, this.#clients[signerIndex].custodian.key_id);
    const second = await this.#clients[signerIndex].sign("pulse", pending.proposal.body);
    this.#core.commitProposal(pending.proposal, [pending.approval, second]);
    this.#pendingHeartbeat = null;
    return acceptedResult(this.#core.snapshot());
  }

  replayLast() {
    const last = this.#core.records.at(-1);
    if (!last || last.envelope?.kind !== "mortalos.pulse") throw new Error("an accepted heartbeat is required");
    return this.#core.evaluateEvidence(last);
  }

  async nurture(signerIndexes = [0, 1], steps = 1) {
    if (!this.#core.initialized || this.#retired) throw new Error("a live v1 lineage is required");
    if (this.#pendingHeartbeat) throw new Error("complete or reload the pending candidate before nurturing");
    if (
      !Array.isArray(signerIndexes) ||
      signerIndexes.length !== 2 ||
      signerIndexes[0] === signerIndexes[1] ||
      signerIndexes.some((index) => !Number.isInteger(index) || !this.#clients[index])
    ) {
      throw new Error("nurture requires two distinct current custodians");
    }
    const proposal = this.#core.createStateProposal(steps);
    const approvals = await Promise.all(signerIndexes.map(async (index) => {
      const client = this.#clients[index];
      this.#core.approvalRequest(proposal, client.custodian.key_id);
      return client.sign("pulse", proposal.body);
    }));
    this.#core.commitProposal(proposal, approvals);
    return { result: acceptedResult(this.#core.snapshot()), state: this.publicState };
  }

  async retire() {
    if (!this.#core.initialized || this.#retired) throw new Error("live custodians are required");
    if (this.#pendingHeartbeat) throw new Error("complete or reload the pending candidate before retirement");
    await Promise.allSettled(this.#clients.map((client) => client.destroy()));
    this.#retired = true;
    const proposal = this.#core.createHeartbeatProposal();
    return {
      continuation: this.#core.evaluateProposal(proposal, []),
      mortality: this.#core.evaluateAvailability({ usableKeyIds: [] })
    };
  }

  shutdown() {
    for (const client of this.#clients) client.terminate();
    this.#clients = [];
  }
}
