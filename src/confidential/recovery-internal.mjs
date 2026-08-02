const CONFIDENTIAL_EPOCH_STORE_CAPABILITIES = new WeakMap();
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;
const reflectApply = Reflect.apply;

export function registerConfidentialEpochStoreInternal(store, capability) {
  if (
    !store ||
    !capability ||
    typeof capability.commitActive !== "function" ||
    typeof capability.readActive !== "function"
  ) {
    throw new TypeError("complete MortalOS confidential epoch-store capability required");
  }
  reflectApply(weakMapSet, CONFIDENTIAL_EPOCH_STORE_CAPABILITIES, [
    store,
    Object.freeze({
      commitActive: capability.commitActive,
      readActive: capability.readActive
    })
  ]);
}

export function confidentialEpochStoreCapabilityInternal(store) {
  const capability = reflectApply(
    weakMapGet,
    CONFIDENTIAL_EPOCH_STORE_CAPABILITIES,
    [store]
  );
  if (!capability) {
    throw new TypeError("registered MortalOS confidential epoch store required");
  }
  return capability;
}
