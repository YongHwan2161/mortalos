import {
  assertDurableDocumentStructure,
  DURABLE_DOCUMENT_SCHEMA_VERSION,
  durableError,
  migrateLegacyDurableSnapshot,
  publicDurableDocument
} from "./durable-document.mjs";

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

export function readDurableStore(store) {
  return durableStoreCapability(store).read();
}

export function writeDurableStore(store, operation, document, options) {
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
