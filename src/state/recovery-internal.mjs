const CONTENT_STORE_CAPABILITIES = new WeakMap();
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;
const reflectApply = Reflect.apply;

export function registerContentStoreInternal(store, capability) {
  if (
    !store ||
    !capability ||
    typeof capability.commitActive !== "function" ||
    typeof capability.get !== "function" ||
    typeof capability.inventory !== "function" ||
    typeof capability.put !== "function" ||
    typeof capability.readActive !== "function"
  ) {
    throw new TypeError("complete MortalOS content-store capability required");
  }
  reflectApply(weakMapSet, CONTENT_STORE_CAPABILITIES, [
    store,
    Object.freeze({
      commitActive: capability.commitActive,
      get: capability.get,
      inventory: capability.inventory,
      put: capability.put,
      readActive: capability.readActive
    })
  ]);
}

export function contentStoreCapabilityInternal(store) {
  const capability = reflectApply(weakMapGet, CONTENT_STORE_CAPABILITIES, [store]);
  if (!capability) {
    const error = new TypeError("registered MortalOS content-addressed destination required");
    error.code = "E_STATE_RECOVERY_UNTRUSTED_DESTINATION";
    throw error;
  }
  return capability;
}
