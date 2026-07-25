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
  committedDocument,
  createAuthorityPolicy,
  createKeyReadyDocument,
  durableError,
  observedDocument,
  recordDurableSignature,
  removedAuthorityDocument,
  renewedDocument,
  replayDurableDocument,
  reserveSigningIntent
} from "../storage/durable-document.mjs";
import {
  createStoredWebCryptoKey,
  signBytes
} from "./webcrypto-key-store.mjs";

function clone(value) {
  return structuredClone(value);
}

function nonceFromSeed(seed, prefix = "nonce:") {
  if (!(seed instanceof Uint8Array) || seed.byteLength !== 16) {
    throw new TypeError("exactly 16 nonce bytes required");
  }
  return `${prefix}${encodeBase64Url(seed)}`;
}

function keyCustodian(document) {
  return document.key
    ? { key_id: document.key.key_id, public_key: document.key.public_key }
    : null;
}

function pendingSignature(document, tuple) {
  return document.journal.find((entry) => entry.tuple === tuple)?.signature ?? null;
}

export class DurableQuorumEndpoint {
  #clock;
  #core = null;
  #document = null;
  #endpointId;
  #signer;
  #store;

  constructor({ endpointId, store, clock = () => Date.now(), signer = signBytes }) {
    if (!store || typeof store.read !== "function" || typeof store.write !== "function") {
      throw new TypeError("durable store with read/write is required");
    }
    this.#endpointId = endpointId;
    this.#store = store;
    this.#clock = clock;
    this.#signer = signer;
  }

  get custodian() {
    return this.#document ? keyCustodian(this.#document) : null;
  }

  get document() {
    return this.#document ? clone(this.#document) : null;
  }

  get records() {
    return this.#core?.records ?? [];
  }

  get publicState() {
    if (!this.#document) {
      return {
        endpoint_id: this.#endpointId,
        expires_at: null,
        head_hash: null,
        organism_id: null,
        pending: null,
        phase: "empty",
        pulse_count: null,
        sequence: null,
        signing_authority: false,
        state_root: null,
        status: "empty"
      };
    }
    const snapshot = this.#core?.snapshot({
      keyCount: this.#document.key ? 1 : 0,
      keyId: this.#document.key?.key_id ?? null
    }) ?? null;
    return {
      endpoint_id: this.#endpointId,
      expires_at: this.#document.policy.expires_at,
      head_hash: snapshot?.head_hash ?? null,
      organism_id: snapshot?.organism_id ?? null,
      pending: this.#document.pending?.kind ?? null,
      phase: this.#document.phase,
      pulse_count: snapshot?.pulse_count ?? null,
      sequence: snapshot?.sequence ?? null,
      signing_authority: Boolean(
        this.#document.key &&
        this.#document.policy.status === "active" &&
        (
          this.#document.policy.expires_at === null ||
          this.#document.policy.expires_at > this.#clock()
        ) &&
        (snapshot === null || snapshot.current_custodian)
      ),
      state_root: snapshot?.state_root ?? null,
      status: snapshot?.status ?? "key_ready"
    };
  }

  async initializeKey({ expiresAt = null } = {}) {
    if (await this.#store.read()) throw durableError("E_DURABLE_EXISTS", "durable endpoint already exists");
    const key = await createStoredWebCryptoKey();
    const document = createKeyReadyDocument({
      endpointId: this.#endpointId,
      key,
      policy: createAuthorityPolicy({ expiresAt })
    });
    await this.#store.write("initialize", document);
    this.#document = document;
    this.#core = null;
    return this.custodian;
  }

  async restore() {
    const stored = await this.#store.read();
    if (!stored) {
      this.#document = null;
      this.#core = null;
      return null;
    }
    const recovered = await replayDurableDocument(stored, { now: this.#clock() });
    this.#document = recovered.document;
    this.#core = recovered.core;
    return this.publicState;
  }

  createGenesisBody({ custodians, initialStateSeed, nonceSeed, threshold = 2 }) {
    if (!this.#document) throw durableError("E_DURABLE_EMPTY", "restore or initialize the endpoint first");
    return createParticipantGenesisBody({
      custodians,
      initialQuorum: { type: "threshold", threshold },
      initialStateBytes: createInitialState(initialStateSeed),
      nonce: nonceFromSeed(nonceSeed)
    });
  }

  async approveGenesis(body) {
    if (!this.#document?.key) throw durableError("E_DURABLE_AUTHORITY", "durable key unavailable");
    const request = genesisSigningRequest(body, this.#document.key.key_id);
    return this.#signDurably({
      body,
      kind: "genesis",
      proposal: { body, format: "mortalos-durable-genesis-proposal/1", payload: {} },
      request
    });
  }

  async commissionGenesis(body, approvals) {
    const record = assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals: true });
    const core = new ParticipantCore(this.#endpointId);
    core.openGenesis(record, [], { requireAllOriginApprovals: true });
    const own = this.#document?.pending;
    const next = committedDocument(this.#document, [record], {
      committedTuple: own?.kind === "genesis" ? own.tuple : null,
      validatedCore: core
    });
    await this.#store.write("commit", next);
    this.#document = next;
    this.#core = core;
    return clone(record);
  }

  createStateProposal(steps = 1) {
    if (!this.#core) throw durableError("E_DURABLE_EVIDENCE", "commissioned evidence unavailable");
    return this.#core.createStateProposal(steps);
  }

  createMembershipProposal(options) {
    if (!this.#core) throw durableError("E_DURABLE_EVIDENCE", "commissioned evidence unavailable");
    return this.#core.createMembershipProposal(options);
  }

  async approveProposal(proposal) {
    if (!this.#core || !this.#document?.key) {
      throw durableError("E_DURABLE_AUTHORITY", "durable signing authority unavailable");
    }
    const request = this.#core.approvalRequest(
      proposal,
      this.#document.key.key_id,
      { signOnce: false }
    );
    return this.#signDurably({
      body: proposal.body,
      kind: "pulse-approval",
      proposal,
      request
    });
  }

  async acceptMembership(proposal) {
    if (!this.#core || !this.#document?.key) {
      throw durableError("E_DURABLE_AUTHORITY", "durable signing authority unavailable");
    }
    const request = this.#core.acceptanceRequest(proposal, this.#document.key.key_id);
    return this.#signDurably({
      body: proposal.body,
      kind: "custody-acceptance",
      proposal,
      request
    });
  }

  async commitProposal(proposal, approvals, acceptances = []) {
    if (!this.#core || !this.#document) {
      throw durableError("E_DURABLE_EVIDENCE", "commissioned evidence unavailable");
    }
    const replay = new ParticipantCore(this.#endpointId);
    replay.openGenesis(this.#core.records[0], this.#core.records.slice(1));
    replay.commitProposal(proposal, approvals, acceptances);
    const own = this.#document.pending;
    const next = committedDocument(this.#document, replay.records, {
      committedTuple: own ? own.tuple : null,
      validatedCore: replay
    });
    await this.#store.write("commit", next);
    this.#document = next;
    this.#core = replay;
    return clone(replay.records.at(-1));
  }

  async syncEvidence(records) {
    if (!this.#core || !this.#document) {
      throw durableError("E_DURABLE_EVIDENCE", "commissioned evidence unavailable");
    }
    if (this.#document.pending) {
      throw durableError("E_DURABLE_PENDING", "cannot replace evidence while a signature is pending");
    }
    const replay = new ParticipantCore(this.#endpointId);
    replay.openGenesis(this.#core.records[0], this.#core.records.slice(1));
    replay.sync(records);
    const next = committedDocument(this.#document, replay.records, { validatedCore: replay });
    await this.#store.write("sync", next);
    this.#document = next;
    this.#core = replay;
    return this.publicState;
  }

  async observeEvidence(records) {
    if (!this.#document || this.#document.phase !== "key_ready") {
      throw durableError("E_DURABLE_PHASE", "only a key-ready endpoint can observe commissioning evidence");
    }
    const replay = new ParticipantCore(this.#endpointId);
    replay.openGenesis(records[0], records.slice(1));
    const next = observedDocument(this.#document, records, { validatedCore: replay });
    await this.#store.write("observe", next);
    this.#document = next;
    this.#core = replay;
    return this.publicState;
  }

  async renewAuthority(expiresAt = null) {
    const next = renewedDocument(this.#document, expiresAt);
    await this.#store.write("renew", next);
    this.#document = next;
    return this.publicState;
  }

  async removeAuthority() {
    const next = removedAuthorityDocument(this.#document, this.#clock());
    await this.#store.write("remove", next);
    this.#document = next;
    return this.publicState;
  }

  async expireAuthority() {
    if (
      !this.#document ||
      this.#document.policy.expires_at === null ||
      this.#document.policy.expires_at > this.#clock()
    ) {
      throw durableError("E_DURABLE_POLICY", "authority expiry has not been reached");
    }
    return this.removeAuthority();
  }

  async #signDurably({ body, kind, proposal, request }) {
    if (
      this.#document.policy.expires_at !== null &&
      this.#document.policy.expires_at <= this.#clock()
    ) {
      throw durableError("E_DURABLE_EXPIRED", "expired authority requires explicit expiry removal");
    }
    const reserved = reserveSigningIntent(this.#document, {
      body,
      keyId: request.key_id,
      kind,
      message: request.message,
      proposal,
      purpose: request.purpose
    });
    if (!reserved.existing) {
      await this.#store.write("reserve", reserved.document);
      this.#document = reserved.document;
    } else {
      this.#document = reserved.document;
    }
    const existing = pendingSignature(this.#document, reserved.entry.tuple);
    if (existing) return clone(existing);
    const signature = await this.#signer(
      this.#document.key.key_id,
      this.#document.key.private_key,
      request.message
    );
    const signed = recordDurableSignature(this.#document, reserved.entry.tuple, signature);
    await this.#store.write("signature", signed);
    this.#document = signed;
    return clone(signature);
  }
}

export function assembleDurableGenesis(body, approvals) {
  return assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals: true });
}
