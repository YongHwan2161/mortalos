import {
  encodeBase64Url
} from "../../src/index.mjs";
import {
  createInitialState
} from "../../src/state/engine.mjs";
import {
  assembleParticipantGenesis,
  classifyParticipantAvailability,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore,
  ParticipantCoreError
} from "./core.mjs";
import {
  assertPortResult
} from "./contracts.mjs";
import {
  WebCryptoKeyStore
} from "./webcrypto-key-store.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomNonce(prefix) {
  return `${prefix}${encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`;
}

export class QuorumProtocolError extends Error {
  constructor(code, detail = "quorum protocol rejected") {
    super(`${code}: ${detail}`);
    this.name = "QuorumProtocolError";
    this.code = code;
  }
}

function translate(error) {
  if (error instanceof QuorumProtocolError) return error;
  if (error instanceof ParticipantCoreError) return new QuorumProtocolError(error.code, error.message);
  return error;
}

export const classifyEndpointStatus = classifyParticipantAvailability;

export function createThreeEndpointGenesisBody(custodians) {
  if (!Array.isArray(custodians) || custodians.length !== 3) {
    throw new TypeError("exactly three public custodians required");
  }
  return createParticipantGenesisBody({
    custodians,
    initialQuorum: { type: "threshold", threshold: 2 },
    initialStateBytes: createInitialState(crypto.getRandomValues(new Uint8Array(16))),
    nonce: randomNonce("nonce:")
  });
}

export function assembleThreeEndpointGenesis(body, approvals) {
  try {
    return assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals: true });
  } catch (error) {
    throw translate(error);
  }
}

export class QuorumEndpointParticipant {
  #core;
  #keys = new WebCryptoKeyStore();

  constructor(endpointId) {
    this.#core = new ParticipantCore(endpointId);
  }

  get custodian() {
    return this.#keys.custodian;
  }

  get genesisRecord() {
    return this.#core.genesisRecord;
  }

  get keyInventory() {
    const key = this.#keys.description;
    return {
      endpoint_id: this.#core.endpointId,
      key_count: key.available ? 1 : 0,
      key_id: key.custodian?.key_id ?? null,
      non_extractable: key.non_extractable,
      private_export_rejected: key.private_export_rejected
    };
  }

  get records() {
    return this.#core.records;
  }

  get publicState() {
    const snapshot = this.#core.snapshot({
      keyCount: this.#keys.available ? 1 : 0,
      keyId: this.#keys.keyId
    });
    return {
      current_custodian: snapshot.current_custodian,
      endpoint_id: snapshot.endpoint_id,
      ...(snapshot.status === "forked" ? { fork_points: snapshot.fork_points } : {}),
      head_hash: snapshot.head_hash,
      key_count: snapshot.key_count,
      organism_id: snapshot.organism_id,
      pulse_count: snapshot.pulse_count,
      sequence: snapshot.sequence,
      state_root: snapshot.state_root,
      status: snapshot.status,
      threshold: snapshot.threshold
    };
  }

  async initializeKey() {
    if (this.#keys.available) throw new Error("endpoint key already initialized");
    return assertPortResult(await this.#keys.create(), "KeyStore.create");
  }

  async approveGenesis(body) {
    if (!this.#keys.available) throw new Error("endpoint key is unavailable");
    if (!body.initial_custodians.some((entry) => entry.key_id === this.#keys.keyId)) {
      throw new Error("endpoint is not an origin custodian");
    }
    return assertPortResult(
      await this.#keys.sign(genesisSigningRequest(body, this.#keys.keyId)),
      "KeyStore.sign"
    );
  }

  openGenesis(genesisRecord, history = [], options = {}) {
    try {
      this.#core.openGenesis(genesisRecord, history, options);
      return this.publicState;
    } catch (error) {
      throw translate(error);
    }
  }

  createStateProposal(steps = 1) {
    try {
      return this.#core.createStateProposal(steps);
    } catch (error) {
      throw translate(error);
    }
  }

  createMembershipProposal({ nextCustodians, nextQuorum = { type: "threshold", threshold: 2 }, payload }) {
    try {
      return this.#core.createMembershipProposal({ nextCustodians, nextQuorum, payload });
    } catch (error) {
      throw translate(error);
    }
  }

  async approveProposal(proposal) {
    if (!this.#keys.available) throw new Error("endpoint lacks current signing authority");
    try {
      return assertPortResult(
        await this.#keys.sign(this.#core.approvalRequest(proposal, this.#keys.keyId)),
        "KeyStore.sign"
      );
    } catch (error) {
      throw translate(error);
    }
  }

  async acceptMembership(proposal) {
    if (!this.#keys.available) throw new Error("endpoint key is unavailable");
    try {
      return assertPortResult(
        await this.#keys.sign(this.#core.acceptanceRequest(proposal, this.#keys.keyId)),
        "KeyStore.sign"
      );
    } catch (error) {
      throw translate(error);
    }
  }

  evaluateProposal(proposal, approvals, acceptances = []) {
    return this.#core.evaluateProposal(proposal, approvals, acceptances);
  }

  commitProposal(proposal, approvals, acceptances = []) {
    try {
      return this.#core.commitProposal(proposal, approvals, acceptances);
    } catch (error) {
      throw translate(error);
    }
  }

  appendEvidence(record) {
    try {
      this.#core.appendEvidence(record);
      return this.publicState;
    } catch (error) {
      throw translate(error);
    }
  }

  sync(records) {
    try {
      this.#core.sync(records);
      return this.publicState;
    } catch (error) {
      throw translate(error);
    }
  }

  evaluateAvailability({ usableKeyIds, stateAvailable = true }) {
    return this.#core.evaluateAvailability({ stateAvailable, usableKeyIds });
  }

  removeAuthority() {
    void this.#keys.destroy();
    return this.publicState;
  }
}
