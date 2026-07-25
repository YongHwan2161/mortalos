import {
  DurableQuorumEndpoint
} from "./durable-quorum-endpoint.mjs";
import {
  IndexedDbDurableStore
} from "../storage/durable-store.mjs";

export class DurableParticipant {
  #endpoint;
  #store;

  constructor() {
    this.#store = new IndexedDbDurableStore({ endpointId: "durable" });
    this.#endpoint = new DurableQuorumEndpoint({
      endpointId: "durable",
      store: this.#store
    });
  }

  static supported() {
    return Boolean(globalThis.indexedDB && globalThis.crypto?.subtle && globalThis.CryptoKey);
  }

  get publicState() {
    const state = this.#endpoint.publicState;
    const document = this.#endpoint.document;
    return {
      available: DurableParticipant.supported(),
      authority_removed: document?.policy.status === "removed",
      configured: document?.phase === "commissioned",
      digest: state.head_hash,
      expires_at: state.expires_at ?? null,
      head_hash: state.head_hash,
      organism_id: state.organism_id,
      private_export_rejected: document?.key ? true : null,
      pulse_count: state.pulse_count,
      sequence: state.sequence,
      signing_authority: state.signing_authority,
      state_root: state.state_root,
      storage: document
        ? ["IndexedDB non-extractable CryptoKey", "canonical evidence", "sign-once journal", "state references"]
        : []
    };
  }

  async restore() {
    await this.#endpoint.restore();
    return this.#endpoint.document ? this.publicState : null;
  }

  async create(ttlDays = 7) {
    if (!Number.isInteger(ttlDays) || ttlDays < 1) {
      throw new Error("Durable Participant expiry must be an explicit positive number of days");
    }
    await this.#endpoint.initializeKey({
      expiresAt: Date.now() + ttlDays * 86_400_000
    });
    const custodian = this.#endpoint.custodian;
    const body = this.#endpoint.createGenesisBody({
      custodians: [custodian],
      initialStateSeed: crypto.getRandomValues(new Uint8Array(16)),
      nonceSeed: crypto.getRandomValues(new Uint8Array(16)),
      threshold: 1
    });
    const approval = await this.#endpoint.approveGenesis(body);
    await this.#endpoint.commissionGenesis(body, [approval]);
    return this.publicState;
  }

  async nurture(steps = 1) {
    if (!this.#endpoint.document) await this.#endpoint.restore();
    const proposal = this.#endpoint.createStateProposal(steps);
    const approval = await this.#endpoint.approveProposal(proposal);
    await this.#endpoint.commitProposal(proposal, [approval]);
    return this.publicState;
  }

  async removeAuthority() {
    if (!this.#endpoint.document) await this.#endpoint.restore();
    await this.#endpoint.removeAuthority();
    return this.publicState;
  }

  close() {
    this.#store.close();
  }
}
