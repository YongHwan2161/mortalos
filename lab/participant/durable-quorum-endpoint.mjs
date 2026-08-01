import {
  encodeBase64Url
} from "../../src/index.mjs";
import {
  createInitialState
} from "../../src/state/engine.mjs";
import { snapshotNamedOwnDataValues } from "../../src/primordials.mjs";
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
  expiredAuthorityDocument,
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
import {
  isDurableStore,
  readDurableStore,
  writeDurableStore
} from "../storage/durable-store.mjs";

const structuredCloneIntrinsic = globalThis.structuredClone;
const reflectApply = Reflect.apply;

function clone(value) {
  return reflectApply(structuredCloneIntrinsic, globalThis, [value]);
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

function publicDocument(document) {
  const { key, ...publicFields } = document;
  return clone({
    ...publicFields,
    key: key
      ? {
          key_id: key.key_id,
          public_key: key.public_key,
          public_key_raw: key.public_key_raw
        }
      : null
  });
}

export class DurableQuorumEndpoint {
  #clock;
  #core = null;
  #document = null;
  #endpointId;
  #maxObservedNow = 0;
  #signingBoundary;
  #store;

  constructor({ endpointId, store, clock = () => Date.now(), signingBoundary = null }) {
    if (!isDurableStore(store)) {
      throw new TypeError("registered MortalOS durable store is required");
    }
    if (signingBoundary !== null && typeof signingBoundary !== "function") {
      throw new TypeError("signing boundary observer must be callable");
    }
    this.#endpointId = endpointId;
    this.#store = store;
    this.#clock = clock;
    this.#signingBoundary = signingBoundary;
  }

  get custodian() {
    return this.#document ? keyCustodian(this.#document) : null;
  }

  get document() {
    return this.#document ? publicDocument(this.#document) : null;
  }

  get records() {
    return this.#core?.records ?? [];
  }

  get publicState() {
    const now = this.#observeNow();
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
          this.#document.policy.expires_at > now
        ) &&
        (snapshot === null || snapshot.current_custodian)
      ),
      state_root: snapshot?.state_root ?? null,
      status: snapshot?.status ?? "key_ready"
    };
  }

  async initializeKey({ expiresAt = null } = {}) {
    if (await readDurableStore(this.#store)) {
      throw durableError("E_DURABLE_EXISTS", "durable endpoint already exists");
    }
    const now = this.#observeNow();
    if (expiresAt !== null && expiresAt <= now) {
      throw durableError("E_DURABLE_POLICY", "new authority expiry must be in the future");
    }
    const key = await createStoredWebCryptoKey();
    const document = createKeyReadyDocument({
      endpointId: this.#endpointId,
      key,
      policy: createAuthorityPolicy({ expiresAt })
    });
    await this.#commitDocument("initialize", document);
    this.#core = null;
    return this.custodian;
  }

  async restore() {
    const stored = await readDurableStore(this.#store);
    if (!stored) {
      this.#document = null;
      this.#core = null;
      return null;
    }
    const now = this.#observeNow();
    const recovered = await replayDurableDocument(stored, { now });
    this.#document = stored;
    if (
      recovered.document.policy.status === "active" &&
      recovered.document.policy.expires_at !== null &&
      recovered.document.policy.expires_at <= now
    ) {
      const expired = expiredAuthorityDocument(recovered.document, now);
      await this.#commitDocument("expire", expired);
    } else {
      this.#document = recovered.document;
    }
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
    await this.#commitDocument("commit", next);
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
    await this.#commitDocument("commit", next);
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
    await this.#commitDocument("sync", next);
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
    await this.#commitDocument("observe", next);
    this.#core = replay;
    return this.publicState;
  }

  async renewAuthority(expiresAt = null) {
    const next = renewedDocument(this.#document, expiresAt, this.#observeNow());
    await this.#commitDocument("renew", next);
    return this.publicState;
  }

  async removeAuthority() {
    const next = removedAuthorityDocument(this.#document, this.#observeNow());
    await this.#commitDocument("remove", next);
    return this.publicState;
  }

  async expireAuthority() {
    const now = this.#observeNow();
    if (
      !this.#document ||
      (
        this.#document.policy.status !== "expired" &&
        (
          this.#document.policy.expires_at === null ||
          this.#document.policy.expires_at > now
        )
      )
    ) {
      throw durableError("E_DURABLE_POLICY", "authority expiry has not been reached");
    }
    return this.removeAuthority();
  }

  async #signDurably({ body, kind, proposal, request }) {
    let requestValues;
    try {
      requestValues = snapshotNamedOwnDataValues(
        request,
        ["key_id", "message", "purpose"],
        "durable signing request"
      );
    } catch {
      throw durableError("E_DURABLE_SCHEMA", "durable signing request must be owned data");
    }
    const invocation = Object.freeze({
      body: clone(body),
      kind,
      proposal: clone(proposal),
      request: Object.freeze({
        key_id: requestValues[0],
        message: new Uint8Array(requestValues[1]),
        purpose: requestValues[2]
      })
    });
    await this.#enforceSigningPolicy();
    const reserved = reserveSigningIntent(this.#document, {
      body: invocation.body,
      keyId: invocation.request.key_id,
      kind: invocation.kind,
      message: invocation.request.message,
      proposal: invocation.proposal,
      purpose: invocation.request.purpose
    });
    if (!reserved.existing) {
      await this.#commitDocument("reserve", reserved.document);
    } else {
      this.#document = reserved.document;
    }
    const existing = pendingSignature(this.#document, reserved.entry.tuple);
    if (existing) return clone(existing);
    await this.#signingBoundary?.("before");
    const signature = await signBytes(
      this.#document.key.key_id,
      this.#document.key.private_key,
      invocation.request.message
    );
    const signed = recordDurableSignature(this.#document, reserved.entry.tuple, signature);
    await this.#commitDocument("signature", signed);
    return clone(signature);
  }

  async #commitDocument(operation, document) {
    const expectedRevision = this.#document?.revision ?? null;
    await writeDurableStore(this.#store, operation, document, { expectedRevision });
    this.#document = document;
  }

  async #enforceSigningPolicy() {
    if (!this.#document?.key || this.#document.policy.status === "removed") {
      throw durableError("E_DURABLE_AUTHORITY", "durable signing authority unavailable");
    }
    const now = this.#observeNow();
    if (
      this.#document.policy.status === "active" &&
      this.#document.policy.expires_at !== null &&
      this.#document.policy.expires_at <= now
    ) {
      const expired = expiredAuthorityDocument(this.#document, now);
      await this.#commitDocument("expire", expired);
    }
    if (this.#document.policy.status === "expired") {
      throw durableError("E_DURABLE_EXPIRED", "expired authority requires explicit renewal or removal");
    }
  }

  #observeNow() {
    const observed = this.#clock();
    if (!Number.isSafeInteger(observed) || observed < 0) {
      throw durableError("E_DURABLE_POLICY", "authority clock must be a non-negative safe integer");
    }
    this.#maxObservedNow = Math.max(this.#maxObservedNow, observed);
    return this.#maxObservedNow;
  }
}

export function assembleDurableGenesis(body, approvals) {
  return assembleParticipantGenesis(body, approvals, { requireAllOriginApprovals: true });
}
