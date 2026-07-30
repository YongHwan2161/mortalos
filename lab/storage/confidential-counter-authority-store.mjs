import {
  LinearizableCounterAuthority,
  createCounterAuthorityFacade,
  generateCounterAuthorityKeyMaterial,
  registerCounterAuthorityStore
} from "../../src/confidential/counter.mjs";
import { confidentialFail } from "../../src/confidential/format.mjs";

const DATABASE = "mortalos-confidential-counter-authority";
const VERSION = 1;
const STORE = "authority";
const MATERIAL_ID = "material";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true
    });
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
      () =>
        reject(
          transaction.error ?? new Error("IndexedDB transaction aborted")
        ),
      { once: true }
    );
    transaction.addEventListener(
      "error",
      () =>
        reject(
          transaction.error ?? new Error("IndexedDB transaction failed")
        ),
      { once: true }
    );
  });
}

function openDatabase(databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, VERSION);
    request.addEventListener(
      "upgradeneeded",
      (event) => {
        if (event.oldVersion !== 0) {
          request.transaction.abort();
          return;
        }
        request.result.createObjectStore(STORE, { keyPath: "id" });
      },
      { once: true }
    );
    request.addEventListener("success", () => resolve(request.result), {
      once: true
    });
    request.addEventListener(
      "error",
      () =>
        reject(
          request.error ??
            new Error("Confidential counter authority database unavailable")
        ),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () =>
        reject(
          new Error("Confidential counter authority database migration blocked")
        ),
      { once: true }
    );
  });
}

function assertBrowserAuthorityRuntime() {
  if (
    !globalThis.indexedDB ||
    !globalThis.navigator?.locks?.request ||
    !globalThis.CryptoKey
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority",
      "indexeddb-web-locks-required"
    );
  }
}

function epochRecordId(epochId) {
  return `epoch:${epochId}`;
}

export class IndexedDbCounterAuthorityStore {
  #database = null;
  #databaseName;
  #lockName;

  constructor({ databaseName = DATABASE } = {}) {
    assertBrowserAuthorityRuntime();
    if (
      typeof databaseName !== "string" ||
      !/^[A-Za-z0-9._-]{1,128}$/u.test(databaseName)
    ) {
      throw new TypeError("bounded counter authority database name is required");
    }
    this.#databaseName = databaseName;
    this.#lockName = `mortalos-s4-counter-authority:${databaseName}`;
    const inspect = (epochId) => this.#inspect(epochId);
    const transact = (epochId, operation) =>
      this.#transact(epochId, operation);
    registerCounterAuthorityStore(this, { inspect, transact });
    Object.defineProperties(this, {
      close: {
        configurable: false,
        value: () => this.#close(),
        writable: false
      },
      inspect: {
        configurable: false,
        value: inspect,
        writable: false
      },
      loadOrCreateKeyMaterial: {
        configurable: false,
        value: () => this.#loadOrCreateKeyMaterial(),
        writable: false
      },
      lose: {
        configurable: false,
        value: (epochId) => this.#lose(epochId),
        writable: false
      },
      transact: {
        configurable: false,
        value: transact,
        writable: false
      }
    });
    Object.freeze(this);
  }

  async #handle() {
    this.#database ??= await openDatabase(this.#databaseName);
    return this.#database;
  }

  async #read(id) {
    const database = await this.#handle();
    const transaction = database.transaction([STORE], "readonly");
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(STORE).get(id));
    await done;
    return value ?? null;
  }

  async #locked(operation) {
    return navigator.locks.request(this.#lockName, { mode: "exclusive" }, operation);
  }

  async #loadOrCreateKeyMaterial() {
    return this.#locked(async () => {
      const current = await this.#read(MATERIAL_ID);
      if (current) {
        if (
          current.id !== MATERIAL_ID ||
          current.kind !== "material" ||
          current.schema_version !== VERSION ||
          typeof current.authority_id !== "string" ||
          typeof current.authority_public_key !== "string" ||
          !(current.private_key instanceof CryptoKey) ||
          current.private_key.type !== "private" ||
          current.private_key.extractable ||
          !current.private_key.usages.includes("sign")
        ) {
          confidentialFail(
            "E_CONFIDENTIAL_COUNTER_AUTHORITY",
            "/counter_authority/material",
            "corrupt"
          );
        }
        return Object.freeze({
          authorityId: current.authority_id,
          authorityPublicKey: current.authority_public_key,
          privateKey: current.private_key
        });
      }
      const generated = await generateCounterAuthorityKeyMaterial();
      const database = await this.#handle();
      const transaction = database.transaction([STORE], "readwrite", {
        durability: "strict"
      });
      transaction.objectStore(STORE).put({
        authority_id: generated.authorityId,
        authority_public_key: generated.authorityPublicKey,
        id: MATERIAL_ID,
        kind: "material",
        private_key: generated.privateKey,
        schema_version: VERSION
      });
      await transactionDone(transaction);
      return generated;
    });
  }

  async #transact(epochId, operation) {
    return this.#locked(async () => {
      const id = epochRecordId(epochId);
      const observed = await this.#read(id);
      if (observed?.kind === "lost") {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "lost"
        );
      }
      if (observed && observed.kind !== "active") {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "corrupt"
        );
      }
      const revision = observed?.revision ?? null;
      const current = observed ? structuredClone(observed.data) : null;
      const outcome = await operation(current);
      if (!outcome || !Object.hasOwn(outcome, "next")) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "transaction-result"
        );
      }

      const database = await this.#handle();
      const transaction = database.transaction([STORE], "readwrite", {
        durability: "strict"
      });
      const objectStore = transaction.objectStore(STORE);
      const latest = await requestResult(objectStore.get(id));
      if (
        (latest?.kind ?? null) !== (observed?.kind ?? null) ||
        (latest?.revision ?? null) !== revision
      ) {
        transaction.abort();
        try {
          await transactionDone(transaction);
        } catch {
          // Normalize the storage race to the public stale-authority result below.
        }
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_STALE",
          "/counter_authority",
          "compare-and-swap"
        );
      }
      if (outcome.next === null) {
        objectStore.delete(id);
      } else {
        objectStore.put({
          data: structuredClone(outcome.next),
          id,
          kind: "active",
          revision: (revision ?? -1) + 1
        });
      }
      await transactionDone(transaction);
      return outcome.value;
    });
  }

  async #inspect(epochId) {
    const record = await this.#read(epochRecordId(epochId));
    if (record?.kind === "lost") {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "lost"
      );
    }
    if (record && record.kind !== "active") {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "corrupt"
      );
    }
    return record ? structuredClone(record.data) : null;
  }

  async #lose(epochId) {
    return this.#locked(async () => {
      const database = await this.#handle();
      const transaction = database.transaction([STORE], "readwrite", {
        durability: "strict"
      });
      transaction.objectStore(STORE).put({
        id: epochRecordId(epochId),
        kind: "lost"
      });
      await transactionDone(transaction);
    });
  }

  #close() {
    this.#database?.close();
    this.#database = null;
  }

  async loadOrCreateKeyMaterial() {
    return this.#loadOrCreateKeyMaterial();
  }

  async transact(epochId, operation) {
    return this.#transact(epochId, operation);
  }

  async inspect(epochId) {
    return this.#inspect(epochId);
  }

  async lose(epochId) {
    return this.#lose(epochId);
  }

  close() {
    return this.#close();
  }
}

export class IndexedDbCounterAuthority {
  static async open({ databaseName = DATABASE } = {}) {
    const store = new IndexedDbCounterAuthorityStore({ databaseName });
    const material = await store.loadOrCreateKeyMaterial();
    const authority = new LinearizableCounterAuthority({
      authorityId: material.authorityId,
      authorityPublicKey: material.authorityPublicKey,
      privateKey: material.privateKey,
      store
    });
    return createCounterAuthorityFacade({
      authority,
      close: () => store.close(),
      keyPolicy: Object.freeze({
        extractable: material.privateKey.extractable,
        type: material.privateKey.type,
        usages: Object.freeze([...material.privateKey.usages])
      })
    });
  }
}

export async function deleteIndexedDbCounterAuthorityStore(
  databaseName = DATABASE
) {
  assertBrowserAuthorityRuntime();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.addEventListener("success", resolve, { once: true });
    request.addEventListener(
      "error",
      () =>
        reject(
          request.error ??
            new Error("Confidential counter authority wipe failed")
        ),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () =>
        reject(new Error("Confidential counter authority wipe blocked")),
      { once: true }
    );
  });
}
