import { sha256 } from "@noble/hashes/sha2.js";
import { encodeBase64Url, equalBytes } from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes, snapshotBytes } from "../codec.mjs";
import { isStrictEd25519PublicKey, verifyEd25519 } from "../crypto.mjs";
import { CUSTODY_LIMITS, recoverContinuityCopyQuorum, verifyContinuityCopy } from "../custody.mjs";
import {
  arrayLength,
  arrayPush,
  arraySort,
  arrayValueAt,
  copyArrayByIndex,
  copyBoundedOwnDataArray,
  createArray,
  createSet,
  freeze,
  isArray,
  numberIsSafeInteger,
  objectKeys,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  setAdd,
  setHas,
  snapshotNamedOwnDataValues,
  typeError
} from "../primordials.mjs";

export const PROVIDER_POSSESSION_FORMAT = "mortalos-provider-possession-receipt/1";
export const PROVIDER_TOPOLOGY_FORMAT = "mortalos-provider-topology/1";
export const PROVIDER_POSSESSION_LIMITS = freeze({
  providers: CUSTODY_LIMITS.signed_copies,
  quorum: CUSTODY_LIMITS.signed_quorum,
  receipt_bytes: 32_768
});

const PROVIDER_RECORDS = new WeakMap();
const IDENTITY_FIELDS = freeze([
  "account_domain",
  "admin_domain",
  "credential_domain",
  "failure_domain",
  "provider_id",
  "provider_kind",
  "public_key",
  "region"
]);
const COPY_FIELDS = freeze(["capsule_id", "copy_id", "head_hash", "organism_id", "provider_id"]);
const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function fail(code, detail) {
  const error = typeError(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function assertRealmIntegrity() {
  if (!realmIntrinsicsIntact()) fail("E_PROVIDER_RUNTIME", "realm-integrity");
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || isArray(value)) {
    throw typeError(`${label} must be an object`);
  }
  const actual = objectKeys(value);
  const wanted = copyArrayByIndex(expected);
  arraySort(actual);
  arraySort(wanted);
  if (arrayLength(actual) !== arrayLength(wanted)) throw typeError(`${label} has unexpected keys`);
  for (let index = 0; index < arrayLength(actual); index += 1) {
    if (arrayValueAt(actual, index) !== arrayValueAt(wanted, index)) {
      throw typeError(`${label} has unexpected keys`);
    }
  }
}

function ownedBytes(value, maximum, label) {
  try {
    return snapshotBytes(value, maximum);
  } catch {
    throw typeError(`${label} must be a bounded Uint8Array`);
  }
}

function ownedIdentity(source, label = "provider identity") {
  exactKeys(source, IDENTITY_FIELDS, label);
  const values = snapshotNamedOwnDataValues(source, IDENTITY_FIELDS, label);
  assertRealmIntegrity();
  for (let index = 0; index < arrayLength(values); index += 1) {
    if (index === 6) continue;
    const value = arrayValueAt(values, index);
    if (typeof value !== "string" || !BOUNDED_ID.test(value)) {
      throw typeError(`${label}.${arrayValueAt(IDENTITY_FIELDS, index)} is invalid`);
    }
  }
  if (!isStrictEd25519PublicKey(arrayValueAt(values, 6))) {
    throw typeError(`${label}.public_key is invalid`);
  }
  return freeze({
    account_domain: arrayValueAt(values, 0),
    admin_domain: arrayValueAt(values, 1),
    credential_domain: arrayValueAt(values, 2),
    failure_domain: arrayValueAt(values, 3),
    provider_id: arrayValueAt(values, 4),
    provider_kind: arrayValueAt(values, 5),
    public_key: arrayValueAt(values, 6),
    region: arrayValueAt(values, 7)
  });
}

function sameCanonical(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

export function providerObjectDigest(bytesSource) {
  const bytes = ownedBytes(bytesSource, CUSTODY_LIMITS.copy_bytes, "provider object");
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

export function assertIndependentProviderTopology(topologySource) {
  exactKeys(topologySource, ["format", "providers"], "provider topology");
  const [format, providersSource] = snapshotNamedOwnDataValues(
    topologySource,
    ["format", "providers"],
    "provider topology"
  );
  const count = ownDataArrayLength(providersSource, "provider topology providers");
  if (format !== PROVIDER_TOPOLOGY_FORMAT || count !== PROVIDER_POSSESSION_LIMITS.providers) {
    throw typeError("provider topology requires exactly three providers");
  }
  const providers = copyBoundedOwnDataArray(
    providersSource,
    count,
    "provider topology providers"
  ).map((identity, index) => ownedIdentity(identity, `provider topology provider ${index}`));
  assertRealmIntegrity();
  for (const field of [
    "account_domain",
    "admin_domain",
    "credential_domain",
    "failure_domain",
    "provider_id",
    "provider_kind",
    "public_key",
    "region"
  ]) {
    const observed = createSet();
    for (let index = 0; index < arrayLength(providers); index += 1) {
      const value = arrayValueAt(providers, index)[field];
      if (setHas(observed, value)) {
        throw typeError(`provider topology ${field} values must be independent`);
      }
      setAdd(observed, value);
    }
  }
  return freeze({ format, providers: freeze(providers) });
}

export function registerCustodyProviderCapability(provider, capabilitySource) {
  if ((typeof provider !== "object" && typeof provider !== "function") || provider === null) {
    throw typeError("custody provider object required");
  }
  if (PROVIDER_RECORDS.has(provider)) throw typeError("custody provider is already registered");
  exactKeys(capabilitySource, ["identity", "read", "store"], "custody provider capability");
  const [identitySource, readObject, storeObject] = snapshotNamedOwnDataValues(
    capabilitySource,
    ["identity", "read", "store"],
    "custody provider capability"
  );
  const identity = ownedIdentity(identitySource);
  if (typeof readObject !== "function" || typeof storeObject !== "function") {
    throw typeError("custody provider read and store capabilities are required");
  }
  assertRealmIntegrity();
  PROVIDER_RECORDS.set(provider, freeze({
    identity,
    read: (digest) => readObject(digest),
    store: (copyBytes) => storeObject(copyBytes)
  }));
  return provider;
}

function providerRecord(provider) {
  const record = PROVIDER_RECORDS.get(provider);
  if (!record) fail("E_PROVIDER_CAPABILITY", "unregistered-provider");
  return record;
}

export function describeCustodyProvider(provider) {
  return providerRecord(provider).identity;
}

function copyDescriptor(source, label) {
  exactKeys(source, COPY_FIELDS, label);
  const values = snapshotNamedOwnDataValues(source, COPY_FIELDS, label);
  for (let index = 0; index < arrayLength(values); index += 1) {
    const value = arrayValueAt(values, index);
    if (typeof value !== "string" || value.length < 1 || value.length > 128) {
      throw typeError(`${label}.${arrayValueAt(COPY_FIELDS, index)} is invalid`);
    }
  }
  return freeze({
    capsule_id: arrayValueAt(values, 0),
    copy_id: arrayValueAt(values, 1),
    head_hash: arrayValueAt(values, 2),
    organism_id: arrayValueAt(values, 3),
    provider_id: arrayValueAt(values, 4)
  });
}

export function verifyProviderPossessionReceipt(receiptSource) {
  assertRealmIntegrity();
  const bytes = ownedBytes(
    receiptSource,
    PROVIDER_POSSESSION_LIMITS.receipt_bytes,
    "provider possession receipt"
  );
  const receipt = parseJsonBytes(bytes, {
    maxBytes: PROVIDER_POSSESSION_LIMITS.receipt_bytes,
    maxDepth: 16
  });
  if (!isCanonical(bytes, receipt)) {
    throw typeError("provider possession receipt must use canonical JSON bytes");
  }
  exactKeys(receipt, ["body", "signature"], "provider possession receipt");
  exactKeys(
    receipt.body,
    ["copy", "format", "object", "provider", "stored_at"],
    "provider possession receipt body"
  );
  if (receipt.body.format !== PROVIDER_POSSESSION_FORMAT) {
    throw typeError("provider possession receipt format is invalid");
  }
  const provider = ownedIdentity(receipt.body.provider, "provider possession identity");
  const copy = copyDescriptor(receipt.body.copy, "provider possession copy");
  exactKeys(receipt.body.object, ["digest", "size"], "provider possession object");
  const [digest, size] = snapshotNamedOwnDataValues(
    receipt.body.object,
    ["digest", "size"],
    "provider possession object"
  );
  if (
    typeof digest !== "string" ||
    !/^sha256:[A-Za-z0-9_-]{43}$/u.test(digest) ||
    !numberIsSafeInteger(size) ||
    size < 1 ||
    size > CUSTODY_LIMITS.copy_bytes ||
    typeof receipt.body.stored_at !== "string" ||
    !UTC_INSTANT.test(receipt.body.stored_at)
  ) {
    throw typeError("provider possession object metadata is invalid");
  }
  if (
    copy.provider_id !== provider.provider_id ||
    typeof receipt.signature !== "string" ||
    !verifyEd25519(provider.public_key, canonicalBytes(receipt.body), receipt.signature)
  ) {
    throw typeError("provider possession signature is invalid");
  }
  return freeze({
    body: freeze({
      copy,
      format: PROVIDER_POSSESSION_FORMAT,
      object: freeze({ digest, size }),
      provider,
      stored_at: receipt.body.stored_at
    }),
    bytes: new Uint8Array(bytes),
    signature: receipt.signature,
    status: "verified"
  });
}

function snapshotProviderSet(providersSource, topologySource) {
  const topology = assertIndependentProviderTopology(topologySource);
  const count = ownDataArrayLength(providersSource, "custody providers");
  if (count !== PROVIDER_POSSESSION_LIMITS.providers) {
    throw typeError("exactly three custody providers are required");
  }
  const providers = copyBoundedOwnDataArray(providersSource, count, "custody providers");
  const records = createArray();
  for (let index = 0; index < count; index += 1) {
    const record = providerRecord(arrayValueAt(providers, index));
    if (!sameCanonical(record.identity, arrayValueAt(topology.providers, index))) {
      fail("E_PROVIDER_TOPOLOGY", `provider-${index}-identity-mismatch`);
    }
    arrayPush(records, record);
  }
  assertRealmIntegrity();
  return { records, topology };
}

async function storeOwnedCopy(record, copyBytes) {
  const verifiedCopy = verifyContinuityCopy(copyBytes);
  if (verifiedCopy.provider_id !== record.identity.provider_id) {
    fail("E_PROVIDER_BINDING", "copy-provider-mismatch");
  }
  const returned = await record.store(new Uint8Array(copyBytes));
  assertRealmIntegrity();
  const receipt = verifyProviderPossessionReceipt(returned);
  if (
    !sameCanonical(receipt.body.provider, record.identity) ||
    !sameCanonical(receipt.body.copy, verifiedCopy.descriptor) ||
    receipt.body.object.digest !== providerObjectDigest(copyBytes) ||
    receipt.body.object.size !== copyBytes.byteLength
  ) {
    fail("E_PROVIDER_RECEIPT", "write-readback-binding-mismatch");
  }
  return receipt;
}

function snapshotProviderStoreInvocation(options) {
  exactKeys(options, ["copies", "providers", "topology"], "provider store options");
  const [copiesSource, providersSource, topologySource] = snapshotNamedOwnDataValues(
    options,
    ["copies", "providers", "topology"],
    "provider store options"
  );
  const copyCount = ownDataArrayLength(copiesSource, "provider custody copies");
  if (copyCount !== PROVIDER_POSSESSION_LIMITS.providers) {
    throw typeError("exactly three provider custody copies are required");
  }
  const copySources = copyBoundedOwnDataArray(
    copiesSource,
    copyCount,
    "provider custody copies"
  );
  const copies = createArray();
  for (let index = 0; index < copyCount; index += 1) {
    arrayPush(copies, ownedBytes(
      arrayValueAt(copySources, index),
      CUSTODY_LIMITS.copy_bytes,
      `provider copy ${index}`
    ));
  }
  const { records, topology } = snapshotProviderSet(providersSource, topologySource);
  return freeze({ copies: freeze(copies), records: freeze(records), topology });
}

export async function storeContinuityCopiesWithProviders(options) {
  const invocation = snapshotProviderStoreInvocation(options);
  const receipts = createArray();
  for (let index = 0; index < arrayLength(invocation.copies); index += 1) {
    arrayPush(receipts, await storeOwnedCopy(
      arrayValueAt(invocation.records, index),
      arrayValueAt(invocation.copies, index)
    ));
  }
  const receiptBytes = createArray();
  for (let index = 0; index < arrayLength(receipts); index += 1) {
    arrayPush(receiptBytes, new Uint8Array(arrayValueAt(receipts, index).bytes));
  }
  return freeze({
    format: "mortalos-provider-store-result/1",
    receipts: freeze(receiptBytes),
    status: "stored",
    topology: invocation.topology
  });
}

function snapshotProviderRecoveryInvocation(options) {
  exactKeys(
    options,
    ["providers", "quorum", "receipts", "topology"],
    "provider recovery options"
  );
  const [providersSource, quorumSource, receiptsSource, topologySource] =
    snapshotNamedOwnDataValues(
      options,
      ["providers", "quorum", "receipts", "topology"],
      "provider recovery options"
    );
  const receiptCount = ownDataArrayLength(receiptsSource, "provider receipts");
  const quorum = quorumSource === undefined ? PROVIDER_POSSESSION_LIMITS.quorum : quorumSource;
  if (
    receiptCount !== PROVIDER_POSSESSION_LIMITS.providers ||
    !numberIsSafeInteger(quorum) ||
    quorum < PROVIDER_POSSESSION_LIMITS.quorum ||
    quorum > receiptCount
  ) {
    throw typeError("bounded provider quorum required");
  }
  const receiptSources = copyBoundedOwnDataArray(
    receiptsSource,
    receiptCount,
    "provider receipts"
  );
  const receipts = createArray();
  for (let index = 0; index < receiptCount; index += 1) {
    const receiptBytes = ownedBytes(
      arrayValueAt(receiptSources, index),
      PROVIDER_POSSESSION_LIMITS.receipt_bytes,
      `provider receipt ${index}`
    );
    arrayPush(receipts, verifyProviderPossessionReceipt(receiptBytes));
  }
  const { records, topology } = snapshotProviderSet(providersSource, topologySource);
  for (let index = 0; index < receiptCount; index += 1) {
    if (!sameCanonical(arrayValueAt(receipts, index).body.provider, arrayValueAt(records, index).identity)) {
      fail("E_PROVIDER_TOPOLOGY", `receipt-${index}-identity-mismatch`);
    }
  }
  assertRealmIntegrity();
  return freeze({ quorum, receipts: freeze(receipts), records: freeze(records), topology });
}

export async function recoverContinuityProviderQuorum(options) {
  const invocation = snapshotProviderRecoveryInvocation(options);
  const copies = createArray();
  const acceptedReceipts = createArray();
  const rejectedProviders = createArray();
  for (let index = 0; index < arrayLength(invocation.receipts); index += 1) {
    const receipt = arrayValueAt(invocation.receipts, index);
    const record = arrayValueAt(invocation.records, index);
    try {
      const loaded = await record.read(receipt.body.object.digest);
      assertRealmIntegrity();
      const copyBytes = ownedBytes(loaded, CUSTODY_LIMITS.copy_bytes, `loaded provider copy ${index}`);
      const verifiedCopy = verifyContinuityCopy(copyBytes);
      if (
        copyBytes.byteLength !== receipt.body.object.size ||
        providerObjectDigest(copyBytes) !== receipt.body.object.digest ||
        !sameCanonical(verifiedCopy.descriptor, receipt.body.copy)
      ) {
        fail("E_PROVIDER_READBACK", `provider-${index}-binding-mismatch`);
      }
      arrayPush(copies, copyBytes);
      arrayPush(acceptedReceipts, receipt.bytes);
    } catch (error) {
      arrayPush(rejectedProviders, freeze({
        code: error?.code ?? "E_PROVIDER_UNAVAILABLE",
        provider_id: record.identity.provider_id,
        reason: String(error?.message ?? error)
      }));
    }
  }
  if (arrayLength(copies) < invocation.quorum) {
    fail("E_PROVIDER_QUORUM_UNAVAILABLE", "provider copies below quorum");
  }
  const recovered = recoverContinuityCopyQuorum({ copies, quorum: invocation.quorum });
  const acceptedReceiptBytes = createArray();
  for (let index = 0; index < arrayLength(acceptedReceipts); index += 1) {
    arrayPush(acceptedReceiptBytes, new Uint8Array(arrayValueAt(acceptedReceipts, index)));
  }
  const providerCopies = createArray();
  for (let index = 0; index < arrayLength(copies); index += 1) {
    arrayPush(providerCopies, new Uint8Array(arrayValueAt(copies, index)));
  }
  return freeze({
    ...recovered,
    accepted_provider_receipts: freeze(acceptedReceiptBytes),
    provider_copies: freeze(providerCopies),
    format: "mortalos-provider-recovery-result/1",
    rejected_providers: freeze(rejectedProviders),
    topology: invocation.topology
  });
}
