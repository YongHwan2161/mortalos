import {
  encodeBase64Url
} from "../../src/index.mjs";
import {
  createInitialState
} from "../../src/state/engine.mjs";
import {
  assembleParticipantGenesis,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore
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

export class LiveEndpointParticipant {
  #core;
  #keys = new WebCryptoKeyStore();

  constructor(endpointId) {
    this.#core = new ParticipantCore(endpointId);
  }

  get endpointId() {
    return this.#core.endpointId;
  }

  get genesisRecord() {
    return this.#core.genesisRecord;
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
      endpoint_id: snapshot.endpoint_id,
      head_hash: snapshot.head_hash,
      organism_id: snapshot.organism_id,
      pulse_count: snapshot.pulse_count,
      sequence: snapshot.sequence,
      signing_authority: snapshot.current_custodian,
      state_root: snapshot.state_root,
      status: snapshot.status
    };
  }

  async create() {
    if (this.#core.initialized || this.#keys.available) throw new Error("endpoint already initialized");
    const custodian = assertPortResult(await this.#keys.create(), "KeyStore.create");
    const initialStateBytes = createInitialState(crypto.getRandomValues(new Uint8Array(16)));
    const body = createParticipantGenesisBody({
      custodians: [custodian],
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes,
      nonce: randomNonce("nonce:")
    });
    const approval = assertPortResult(
      await this.#keys.sign(genesisSigningRequest(body, custodian.key_id)),
      "KeyStore.sign"
    );
    const record = assembleParticipantGenesis(body, [approval]);
    this.#core.openGenesis(record);
    return this.genesisRecord;
  }

  async join(genesisRecord, history = []) {
    if (this.#core.initialized || this.#keys.available) throw new Error("endpoint already initialized");
    this.#core.openGenesis(genesisRecord, history);
    const custodian = assertPortResult(await this.#keys.create(), "KeyStore.create");
    return this.#core.createJoinRequest(custodian, randomNonce("join:"));
  }

  joinRequest() {
    if (!this.#core.initialized || !this.#keys.available) throw new Error("joining endpoint is not initialized");
    return this.#core.createJoinRequest(this.#keys.custodian, randomNonce("join:"));
  }

  async proposeHandoff(joinRequest) {
    const proposal = this.#core.createHandoffProposal(joinRequest, this.#keys.keyId);
    const approval = assertPortResult(
      await this.#keys.sign(this.#core.approvalRequest(proposal, this.#keys.keyId)),
      "KeyStore.sign"
    );
    return { ...clone(proposal), approvals: [approval] };
  }

  async acceptHandoff(proposal) {
    const ownedProposal = clone(proposal);
    const acceptance = assertPortResult(
      await this.#keys.sign(
        this.#core.acceptanceRequest(ownedProposal, this.#keys.keyId, { handoff: true })
      ),
      "KeyStore.sign"
    );
    try {
      return this.#core.commitProposal(
        ownedProposal,
        ownedProposal.approvals,
        [acceptance]
      );
    } catch (error) {
      throw new Error(`handoff rejected locally: ${error.code ?? error.message}`);
    }
  }

  appendEvidence(record) {
    this.#core.appendEvidence(record);
    return this.publicState;
  }

  async nurture(steps = 1) {
    const proposal = this.#core.createStateProposal(steps);
    const approval = assertPortResult(
      await this.#keys.sign(this.#core.approvalRequest(proposal, this.#keys.keyId)),
      "KeyStore.sign"
    );
    return this.#core.commitProposal(proposal, [approval]);
  }

  removeAuthority() {
    void this.#keys.destroy();
    return this.publicState;
  }
}
