import {
  committedDocument,
  createAuthorityPolicy,
  createKeyReadyDocument,
  assertDurableDocumentStructure,
  DURABLE_DOCUMENT_SCHEMA_VERSION,
  durableError,
  expiredAuthorityDocument,
  migrateLegacyDurableSnapshot,
  observedDocument,
  publicDurableDocument,
  recordDurableSignature,
  removedAuthorityDocument,
  renewedDocument,
  replayDurableDocument,
  reserveSigningIntent
} from "./durable-document.mjs";
import { encodeBase64Url } from "../../src/index.mjs";
import { createInitialState } from "../../src/state/engine.mjs";
import { snapshotNamedOwnDataValues } from "../../src/primordials.mjs";
import {
  assembleParticipantGenesis,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore
} from "../participant/core.mjs";
import {
  createStoredWebCryptoKey,
  signBytes
} from "../participant/webcrypto-key-store.mjs";

const DATABASE = "mortalos-participant";
const VERSION = DURABLE_DOCUMENT_SCHEMA_VERSION;
const DOCUMENT_STORE = "participant";
const LEGACY_STORES = Object.freeze(["evidence", "keys", "meta"]);
const DURABLE_STORE_CAPABILITIES = new WeakMap();
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;
const reflectApply = Reflect.apply;
const structuredCloneIntrinsic = globalThis.structuredClone;

function clone(value) {
  return reflectApply(structuredCloneIntrinsic, globalThis, [value]);
}

function registerDurableStore(store, capability) {
  reflectApply(weakMapSet, DURABLE_STORE_CAPABILITIES, [
    store,
    Object.freeze(capability)
  ]);
}

function durableStoreCapability(store) {
  const capability = reflectApply(weakMapGet, DURABLE_STORE_CAPABILITIES, [store]);
  if (!capability) {
    throw new TypeError("registered MortalOS durable store required");
  }
  return capability;
}

export function isDurableStore(store) {
  return Boolean(reflectApply(weakMapGet, DURABLE_STORE_CAPABILITIES, [store]));
}

function readPrivateDurableDocument(store) {
  return durableStoreCapability(store).read();
}

function commitPrivateDurableDocument(store, operation, document, options) {
  return durableStoreCapability(store).write(operation, document, options);
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed")),
      { once: true }
    );
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      { once: true }
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      { once: true }
    );
  });
}

function scheduleLegacyMigration(request, completedAt, endpointId) {
  const transaction = request.transaction;
  const target = transaction.objectStore(DOCUMENT_STORE);
  const legacy = {};
  let remaining = LEGACY_STORES.length;
  for (const name of LEGACY_STORES) {
    const read = transaction.objectStore(name).get("active");
    read.addEventListener("success", () => {
      legacy[name] = read.result ?? null;
      remaining -= 1;
      if (remaining !== 0) return;
      try {
        const migrated = migrateLegacyDurableSnapshot(legacy, { completedAt, endpointId });
        if (migrated) target.put(migrated);
        for (const name of LEGACY_STORES) {
          request.result.deleteObjectStore(name);
        }
      } catch {
        transaction.abort();
      }
    }, { once: true });
    read.addEventListener("error", () => transaction.abort(), { once: true });
  }
}

function openDatabase({
  databaseName = DATABASE,
  endpointId = "durable",
  migrationClock = () => Date.now()
} = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, VERSION);
    request.addEventListener("upgradeneeded", (event) => {
      const database = request.result;
      if (event.oldVersion === 0) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
        return;
      }
      if (event.oldVersion === 1 && LEGACY_STORES.every((name) => database.objectStoreNames.contains(name))) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
        scheduleLegacyMigration(request, migrationClock(), endpointId);
        return;
      }
      request.transaction.abort();
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Durable Participant database unavailable")),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => reject(new Error("Durable Participant migration blocked")),
      { once: true }
    );
  });
}

export class IndexedDbDurableStore {
  #database = null;
  #databaseName;
  #endpointId;
  #fault;
  #migrationClock;

  constructor({
    databaseName = DATABASE,
    endpointId = "durable",
    fault = null,
    migrationClock = () => Date.now()
  } = {}) {
    this.#databaseName = databaseName;
    this.#endpointId = endpointId;
    this.#fault = fault;
    this.#migrationClock = migrationClock;
    registerDurableStore(this, {
      read: () => this.#read(),
      write: (operation, document, options) =>
        this.#write(operation, document, options)
    });
  }

  setFault(fault) {
    this.#fault = fault;
  }

  clearFault() {
    this.#fault = null;
  }

  async #handle() {
    this.#database ??= await openDatabase({
      databaseName: this.#databaseName,
      endpointId: this.#endpointId,
      migrationClock: this.#migrationClock
    });
    return this.#database;
  }

  async read() {
    return publicDurableDocument(await this.#read());
  }

  async #read() {
    const database = await this.#handle();
    const transaction = database.transaction([DOCUMENT_STORE], "readonly");
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(DOCUMENT_STORE).get("active"));
    await done;
    return value ? clone(value) : null;
  }

  async write() {
    throw new TypeError("raw durable store writes are internal");
  }

  async #write(operation, document, { expectedRevision } = {}) {
    assertDurableDocumentStructure(document);
    if (
      expectedRevision !== null &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    ) {
      throw new TypeError("expected durable revision is required");
    }
    const wantedRevision = expectedRevision === null ? 0 : expectedRevision + 1;
    if (document.revision !== wantedRevision) {
      throw durableError("E_DURABLE_CONFLICT", "next durable revision is not consecutive");
    }
    await this.#boundary(`${operation}:before`);
    const database = await this.#handle();
    const transaction = database.transaction([DOCUMENT_STORE], "readwrite", { durability: "strict" });
    const store = transaction.objectStore(DOCUMENT_STORE);
    let conflict = false;
    const current = await requestResult(store.get("active"));
    if ((current?.revision ?? null) !== expectedRevision) {
      conflict = true;
      transaction.abort();
    } else {
      store.put(document);
    }
    try {
      await transactionDone(transaction);
    } catch (error) {
      if (conflict) {
        throw durableError("E_DURABLE_CONFLICT", "durable revision changed before commit");
      }
      throw error;
    }
    await this.#boundary(`${operation}:after`);
  }

  close() {
    this.#database?.close();
    this.#database = null;
  }

  async #boundary(name) {
    if (this.#fault) await this.#fault(name);
  }
}

function cloneDocument(value) {
  return value === null ? null : clone(value);
}

export class MemoryDurableStore {
  #document = null;
  #fault = null;
  #writes = [];

  constructor({ document = null, fault = null, unsafeSkipValidation = false } = {}) {
    if (document !== null && !unsafeSkipValidation) {
      assertDurableDocumentStructure(document);
    }
    this.#document = cloneDocument(document);
    this.#fault = fault;
    registerDurableStore(this, {
      read: () => this.#read(),
      write: (operation, nextDocument, options) =>
        this.#write(operation, nextDocument, options)
    });
  }

  get writeTrace() {
    return [...this.#writes];
  }

  setFault(fault) {
    this.#fault = fault;
  }

  clearFault() {
    this.#fault = null;
  }

  async read() {
    return publicDurableDocument(await this.#read());
  }

  async #read() {
    return cloneDocument(this.#document);
  }

  async write() {
    throw new TypeError("raw durable store writes are internal");
  }

  async #write(operation, document, { expectedRevision } = {}) {
    assertDurableDocumentStructure(document);
    if (
      expectedRevision !== null &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    ) {
      throw new TypeError("expected durable revision is required");
    }
    const wantedRevision = expectedRevision === null ? 0 : expectedRevision + 1;
    if (document.revision !== wantedRevision) {
      throw durableError("E_DURABLE_CONFLICT", "next durable revision is not consecutive");
    }
    await this.#boundary(`${operation}:before`);
    const currentRevision = this.#document?.revision ?? null;
    if (currentRevision !== expectedRevision) {
      throw durableError("E_DURABLE_CONFLICT", "durable revision changed before commit");
    }
    this.#document = cloneDocument(document);
    this.#writes.push(operation);
    await this.#boundary(`${operation}:after`);
  }

  async #boundary(name) {
    if (this.#fault) await this.#fault(name);
  }
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
  #maxObservedNow = 0;
  #signingBoundary;
  #signingTail = null;
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
    return publicDurableDocument(this.#document);
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
    if (await readPrivateDurableDocument(this.#store)) {
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
    const stored = await readPrivateDurableDocument(this.#store);
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
    const previous = this.#signingTail;
    const queued = (async () => {
      if (previous !== null) {
        try {
          await previous;
        } catch {
          // A durable reservation can survive a failed predecessor. The next
          // owned invocation must replay that state instead of poisoning the
          // endpoint's signing lane forever.
        }
      }
      await this.#enforceSigningPolicy();
      const operationRevision = this.#document.revision;
      const reserved = reserveSigningIntent(this.#document, {
        body: invocation.body,
        keyId: invocation.request.key_id,
        kind: invocation.kind,
        message: invocation.request.message,
        proposal: invocation.proposal,
        purpose: invocation.request.purpose
      });
      if (!reserved.existing) {
        await this.#commitDocument("reserve", reserved.document, operationRevision);
      } else {
        this.#document = reserved.document;
      }
      const existing = pendingSignature(this.#document, reserved.entry.tuple);
      if (existing) return clone(existing);
      await this.#signingBoundary?.("before");
      const signingRevision = this.#document.revision;
      const signature = await signBytes(
        this.#document.key.key_id,
        this.#document.key.private_key,
        invocation.request.message
      );
      const signed = recordDurableSignature(this.#document, reserved.entry.tuple, signature);
      await this.#commitDocument("signature", signed, signingRevision);
      return clone(signature);
    })();
    this.#signingTail = queued;
    return await queued;
  }

  async #commitDocument(
    operation,
    document,
    expectedRevision = this.#document?.revision ?? null
  ) {
    await commitPrivateDurableDocument(this.#store, operation, document, { expectedRevision });
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

export async function durableStoreExists(databaseName = DATABASE) {
  if (typeof indexedDB.databases !== "function") return false;
  return (await indexedDB.databases()).some((entry) =>
    entry.name === databaseName && entry.version === VERSION);
}

export async function deleteDurableStore(databaseName = DATABASE) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.addEventListener("success", resolve, { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Durable Participant wipe failed")),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => reject(new Error("Durable Participant wipe blocked")),
      { once: true }
    );
  });
}

export const DURABLE_STORE_VERSION = VERSION;
