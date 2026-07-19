const DATABASE = "mortalos-participant";
const VERSION = 1;
const STORES = Object.freeze(["evidence", "keys", "meta"]);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
  });
}

export function openDurableStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.addEventListener("upgradeneeded", (event) => {
      const database = request.result;
      if (event.oldVersion !== 0) {
        request.transaction.abort();
        return;
      }
      for (const name of STORES) database.createObjectStore(name, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Durable Participant database unavailable")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Durable Participant migration blocked")), { once: true });
  });
}

export async function durableStoreExists() {
  if (typeof indexedDB.databases !== "function") return false;
  return (await indexedDB.databases()).some((entry) => entry.name === DATABASE && entry.version === VERSION);
}

export async function readDurableSnapshot(database) {
  const transaction = database.transaction(STORES, "readonly");
  const done = transactionDone(transaction);
  const reads = STORES.map((name) => requestResult(transaction.objectStore(name).get("active")));
  const values = await Promise.all(reads);
  await done;
  return Object.fromEntries(STORES.map((name, index) => [name, values[index] ?? null]));
}

export async function writeDurableSnapshot(database, snapshot) {
  const transaction = database.transaction(STORES, "readwrite", { durability: "strict" });
  for (const name of STORES) transaction.objectStore(name).put(snapshot[name]);
  await transactionDone(transaction);
}

export async function updateDurableEvidence(database, evidence, meta) {
  const transaction = database.transaction(["evidence", "meta"], "readwrite", { durability: "strict" });
  transaction.objectStore("evidence").put(evidence);
  transaction.objectStore("meta").put(meta);
  await transactionDone(transaction);
}

export async function removeDurableAuthority(database, meta) {
  const transaction = database.transaction(["keys", "meta"], "readwrite", { durability: "strict" });
  transaction.objectStore("keys").delete("active");
  transaction.objectStore("meta").put(meta);
  await transactionDone(transaction);
}

export async function deleteDurableStore() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.addEventListener("success", resolve, { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Durable Participant wipe failed")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Durable Participant wipe blocked")), { once: true });
  });
}

export const DURABLE_STORE_VERSION = VERSION;
