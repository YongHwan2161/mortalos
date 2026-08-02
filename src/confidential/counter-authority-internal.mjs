// Package-internal capability registry. This module is intentionally absent
// from package.json exports and the public SDK surface.
const STORE_RECORDS = new WeakMap();

export function counterAuthorityStoreRecord(store) {
  return STORE_RECORDS.get(store) ?? null;
}

export function registerCounterAuthorityStoreInternal(store, record) {
  if (
    !store ||
    (typeof store !== "object" && typeof store !== "function") ||
    !record ||
    typeof record.inspect !== "function" ||
    (
      record.loadAuthorityCapability !== null &&
      typeof record.loadAuthorityCapability !== "function"
    ) ||
    typeof record.transact !== "function" ||
    STORE_RECORDS.has(store)
  ) {
    throw new TypeError("unique internal counter-authority store capability required");
  }
  STORE_RECORDS.set(store, Object.freeze({ ...record }));
  return store;
}
