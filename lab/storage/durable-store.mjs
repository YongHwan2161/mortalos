import {
  assertDurableDocumentStructure,
  DURABLE_DOCUMENT_SCHEMA_VERSION,
  durableError,
  migrateLegacyDurableSnapshot
} from "./durable-document.mjs";

const DATABASE = "mortalos-participant";
const VERSION = DURABLE_DOCUMENT_SCHEMA_VERSION;
const DOCUMENT_STORE = "participant";
const LEGACY_STORES = Object.freeze(["evidence", "keys", "meta"]);

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
    const database = await this.#handle();
    const transaction = database.transaction([DOCUMENT_STORE], "readonly");
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(DOCUMENT_STORE).get("active"));
    await done;
    return value ? structuredClone(value) : null;
  }

  async write(operation, document, { expectedRevision } = {}) {
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
