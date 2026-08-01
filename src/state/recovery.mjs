import {
  StatePackageError,
  statePackageChunkDigest,
  statePackageResourceRoot,
  verifyStatePackage
} from "./package.mjs";
import {
  asBytes,
  byteLengthOfBytes,
  encodeBase64Url,
  equalBytes
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import {
  copyBoundedOwnDataArray,
  createArray,
  createUint8Array,
  defineArrayIndex,
  freeze,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  typedArraySet
} from "../primordials.mjs";
import {
  contentStoreCapabilityInternal,
  registerContentStoreInternal
} from "./recovery-internal.mjs";

const reflectApply = Reflect.apply;
const structuredCloneIntrinsic = globalThis.structuredClone;

function clone(value) {
  return reflectApply(structuredCloneIntrinsic, globalThis, [value]);
}

export const STATE_RECOVERY_LIMITS = Object.freeze({
  inventory_entries_per_source: 64,
  sources: 8
});

function cloneBytes(bytes) {
  const view = asBytes(bytes);
  if (view === null) return null;
  const length = byteLengthOfBytes(view);
  if (length === null) return null;
  const owned = createUint8Array(length);
  typedArraySet(owned, view, 0);
  return owned;
}

export class MemoryContentAddressedStore {
  #active = null;
  #destroyed = false;
  #entries = new Map();
  #fault = null;

  constructor({ fault = null } = {}) {
    this.#fault = fault;
    registerContentStoreInternal(this, {
      commitActive: (record, options) => this.#commitActive(record, options),
      get: (digest) => this.#get(digest),
      inventory: () => this.#inventory(),
      put: (digest, bytes, size) => this.#put(digest, bytes, size),
      readActive: () => this.#readActive()
    });
  }

  setFault(fault) {
    this.#fault = fault;
  }

  clearFault() {
    this.#fault = null;
  }

  destroy() {
    this.#entries.clear();
    this.#active = null;
    this.#destroyed = true;
  }

  get active() {
    return this.#activeSnapshot();
  }

  async inventory() {
    return this.#inventory();
  }

  async #inventory() {
    if (this.#destroyed) return [];
    return [...this.#entries.keys()].sort();
  }

  async get(digest) {
    return this.#get(digest);
  }

  async #get(digest) {
    if (this.#destroyed) return null;
    return cloneBytes(this.#entries.get(digest));
  }

  async put(digest, bytes, size) {
    return this.#put(digest, bytes, size);
  }

  async #put(digest, bytes, size) {
    if (this.#destroyed) throw new Error("store-destroyed");
    const owned = cloneBytes(bytes);
    if (owned.byteLength !== size) throw new Error("chunk-size");
    if (statePackageChunkDigest(owned) !== digest) throw new Error("chunk-digest");
    await this.#fault?.("chunk:before", digest);
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    this.#entries.set(digest, owned);
    await this.#fault?.("chunk:after", digest);
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
  }

  async readActive() {
    return this.#readActive();
  }

  async #readActive() {
    return this.#activeSnapshot();
  }

  #activeSnapshot() {
    return this.#active ? clone(this.#active) : null;
  }

  async #commitActive(record, { expectedPriorStateRoot = null } = {}) {
    if (this.#destroyed) throw new Error("store-destroyed");
    const staged = clone(record);
    if (
      this.#active &&
      equalBytes(canonicalBytes(this.#active), canonicalBytes(staged))
    ) {
      return this.#activeSnapshot();
    }
    const activeRoot = this.#active?.next_state_root ?? expectedPriorStateRoot;
    if (activeRoot !== expectedPriorStateRoot) throw new Error("active-state-conflict");
    await this.#fault?.("active:before", record.next_state_root);
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    await this.#fault?.("active:after", record.next_state_root);
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    this.#active = staged;
    return this.#activeSnapshot();
  }
}

export class ReplicaRecoveryAdapter {
  #inventory;
  #readChunk;

  constructor(store) {
    const capability = contentStoreCapabilityInternal(store);
    this.#inventory = capability.inventory;
    this.#readChunk = capability.get;
  }

  async inventory() {
    return this.#inventory();
  }

  async readChunk(digest) {
    return this.#readChunk(digest);
  }
}

function snapshotRecoveryInvocation(destination, sources) {
  if (!realmIntrinsicsIntact()) throw new TypeError("realm integrity required");
  const count = ownDataArrayLength(sources, "recovery sources");
  if (count > STATE_RECOVERY_LIMITS.sources) {
    throw new StatePackageError(
      "E_STATE_PACKAGE_LIMIT_EXCEEDED",
      "/recovery/sources",
      String(STATE_RECOVERY_LIMITS.sources)
    );
  }
  const ownedSources = copyBoundedOwnDataArray(sources, count, "recovery sources");
  const sourceCapabilities = createArray(count);
  for (let index = 0; index < count; index += 1) {
    const source = ownedSources[index];
    defineArrayIndex(sourceCapabilities, index, freeze({
      inventory: snapshotDataMethod(source, "inventory", `recovery source ${index}`),
      readChunk: snapshotDataMethod(source, "readChunk", `recovery source ${index}`)
    }));
  }
  const destinationCapability = contentStoreCapabilityInternal(destination);
  if (!realmIntrinsicsIntact()) throw new TypeError("realm integrity required");
  return freeze({
    destination: destinationCapability,
    sources: freeze(sourceCapabilities)
  });
}

export function planStateRecovery({ manifest, destinationInventory = [], sourceInventories = [] }) {
  if (
    !Array.isArray(destinationInventory) ||
    destinationInventory.length > STATE_RECOVERY_LIMITS.inventory_entries_per_source ||
    !Array.isArray(sourceInventories) ||
    sourceInventories.length > STATE_RECOVERY_LIMITS.sources ||
    sourceInventories.some(
      (inventory) =>
        !Array.isArray(inventory) ||
        inventory.length > STATE_RECOVERY_LIMITS.inventory_entries_per_source
    )
  ) {
    throw new StatePackageError(
      "E_STATE_PACKAGE_LIMIT_EXCEEDED",
      "/recovery/inventory",
      "bounded-inventory"
    );
  }
  const destination = new Set(destinationInventory);
  const sources = sourceInventories.map((inventory) => new Set(inventory));
  const requests = [];
  const unavailable = [];
  for (const chunk of manifest.chunks) {
    if (destination.has(chunk.digest)) continue;
    const sourceIndexes = [];
    for (let index = 0; index < sources.length; index += 1) {
      if (sources[index].has(chunk.digest)) sourceIndexes.push(index);
    }
    if (sourceIndexes.length === 0) unavailable.push(chunk.digest);
    else requests.push({ digest: chunk.digest, source_indexes: sourceIndexes });
  }
  return Object.freeze({
    requests: Object.freeze(requests),
    status: unavailable.length === 0 ? "recovery_required" : "state_unavailable",
    unavailable: Object.freeze(unavailable)
  });
}

function result(status, code, extra = {}) {
  return Object.freeze({ code, status, ...extra });
}

export async function recoverStatePackage({
  destination,
  expectedGenomeHash,
  expectedNextStateRoot,
  expectedPriorStateRoot,
  inputBytes,
  manifestBytes,
  receiptBytes,
  sources
}) {
  let invocation;
  try {
    invocation = snapshotRecoveryInvocation(destination, sources);
  } catch (error) {
    if (error?.code === "E_STATE_RECOVERY_UNTRUSTED_DESTINATION") {
      return result("interrupted", "E_STATE_RECOVERY_INTERRUPTED", {
        detail: String(error.message)
      });
    }
    return result("rejected", "E_STATE_PACKAGE_LIMIT_EXCEEDED", {
      detail: String(error?.message ?? error),
      field_path: error instanceof StatePackageError
        ? error.fieldPath
        : "/recovery/capability"
    });
  }
  let verified;
  try {
    verified = verifyStatePackage({
      expectedGenomeHash,
      expectedNextStateRoot,
      expectedPriorStateRoot,
      inputBytes,
      manifestBytes,
      receiptBytes
    });
  } catch (error) {
    if (error instanceof StatePackageError) {
      return result("rejected", error.code, { detail: error.detail, field_path: error.fieldPath });
    }
    return result("rejected", "E_STATE_PACKAGE_INTERNAL");
  }
  let plan;
  try {
    const sourceInventories = [];
    for (const source of invocation.sources) {
      sourceInventories.push(await source.inventory());
      if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    }
    plan = await planStateRecovery({
      manifest: verified.manifest,
      destinationInventory: await invocation.destination.inventory(),
      sourceInventories
    });
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
  } catch (error) {
    if (error instanceof StatePackageError) {
      return result("rejected", error.code, {
        detail: error.detail,
        field_path: error.fieldPath
      });
    }
    return result("rejected", "E_STATE_PACKAGE_INTERNAL");
  }
  const corrupt = [];
  for (const request of plan.requests) {
    let accepted = false;
    for (const sourceIndex of request.source_indexes) {
      let bytes;
      try {
        bytes = await invocation.sources[sourceIndex].readChunk(request.digest);
        if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
      } catch (error) {
        return result("interrupted", "E_STATE_RECOVERY_INTERRUPTED", {
          detail: String(error?.message ?? error)
        });
      }
      if (!bytes) continue;
      const expected = verified.manifest.chunks.find((entry) => entry.digest === request.digest);
      let valid = false;
      try {
        valid =
          bytes.byteLength === expected.size &&
          statePackageChunkDigest(bytes) === request.digest;
      } catch {
        valid = false;
      }
      if (!valid) {
        corrupt.push(request.digest);
        continue;
      }
      try {
        await invocation.destination.put(request.digest, bytes, expected.size);
        if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
      } catch (error) {
        return result("interrupted", "E_STATE_RECOVERY_INTERRUPTED", {
          detail: String(error?.message ?? error)
        });
      }
      accepted = true;
      break;
    }
    if (!accepted && !corrupt.includes(request.digest)) {
      return result("state_unavailable", "E_STATE_UNAVAILABLE", {
        missing_chunks: [request.digest]
      });
    }
  }
  if (corrupt.length > 0) {
    return result("rejected", "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH", {
      chunks: [...new Set(corrupt)].sort()
    });
  }
  if (plan.unavailable.length > 0) {
    return result("state_unavailable", "E_STATE_UNAVAILABLE", {
      missing_chunks: [...plan.unavailable]
    });
  }
  const chunks = [];
  for (const descriptor of verified.manifest.chunks) {
    let bytes;
    try {
      bytes = await invocation.destination.get(descriptor.digest);
      if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    } catch (error) {
      return result("interrupted", "E_STATE_RECOVERY_INTERRUPTED", {
        detail: String(error?.message ?? error)
      });
    }
    if (!bytes) {
      return result("state_unavailable", "E_STATE_UNAVAILABLE", {
        missing_chunks: [descriptor.digest]
      });
    }
    if (
      bytes.byteLength !== descriptor.size ||
      statePackageChunkDigest(bytes) !== descriptor.digest
    ) {
      return result("rejected", "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH", {
        chunk: descriptor.digest
      });
    }
    chunks.push(bytes);
  }
  const resource = createUint8Array(verified.manifest.resource_size);
  let offset = 0;
  for (const bytes of chunks) {
    typedArraySet(resource, bytes, offset);
    offset += bytes.byteLength;
  }
  if (statePackageResourceRoot(resource) !== verified.manifest.resource_root) {
    return result("rejected", "E_STATE_PACKAGE_RESOURCE_ROOT_MISMATCH");
  }
  const activeCandidate = Object.freeze({
      manifest_base64url: encodeBase64Url(verified.manifestBytes),
      next_state_root: verified.nextStateRoot,
      receipt_base64url: encodeBase64Url(verified.receiptBytes),
      resource_root: verified.manifest.resource_root,
      resource_size: verified.manifest.resource_size,
      status: "verified"
  });
  try {
    await invocation.destination.commitActive(activeCandidate, {
      expectedPriorStateRoot
    });
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    const readback = await invocation.destination.readActive();
    if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
    if (
      !readback ||
      !equalBytes(canonicalBytes(readback), canonicalBytes(activeCandidate))
    ) {
      throw new Error("active-state-readback");
    }
  } catch (error) {
    return result("interrupted", "E_STATE_RECOVERY_INTERRUPTED", {
      detail: String(error?.message ?? error)
    });
  }
  return result("available", null, {
    next_state_root: verified.nextStateRoot,
    resource_bytes: resource,
    resource_root: verified.manifest.resource_root
  });
}
