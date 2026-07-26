import { sha256 } from "@noble/hashes/sha2.js";
import { decodeBase64Url, encodeBase64Url } from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import {
  createSet,
  freeze,
  isArray,
  numberIsSafeInteger,
  objectHasOwn,
  objectKeys,
  setAdd,
  setHas,
  stringSlice,
  stringStartsWith
} from "../primordials.mjs";

export const STATE_PACKAGE_MANIFEST_FORMAT = "mortalos-state-package-manifest/1";
export const STATE_PACKAGE_RECEIPT_FORMAT = "mortalos-state-package-receipt/1";
export const STATE_PACKAGE_TRANSITION_FORMAT = "mortalos-state-package-transition/1";
export const STATE_PACKAGE_INPUT_FORMAT = "mortalos-state-package-input/1";
export const STATE_PACKAGE_POLICY = "mortalos-state-recovery-policy/1";
export const STATE_PACKAGE_LIMITS = freeze({
  chunk_bytes: 65_536,
  input_bytes: 4_096,
  manifest_bytes: 32_768,
  max_chunks: 64,
  receipt_bytes: 4_096,
  reference_resource_bytes: 1_048_576,
  resource_bytes: 4_194_304
});

const CHUNK_DOMAIN = new TextEncoder().encode("MORTALOS/STATE-PACKAGE/1/CHUNK\0");
const INPUT_DOMAIN = new TextEncoder().encode("MORTALOS/STATE-PACKAGE/1/INPUT\0");
const RECEIPT_DOMAIN = new TextEncoder().encode("MORTALOS/STATE-PACKAGE/1/RECEIPT\0");
const RESOURCE_DOMAIN = new TextEncoder().encode("MORTALOS/STATE-PACKAGE/1/RESOURCE\0");
const STATE_DOMAIN = new TextEncoder().encode("MORTALOS/STATE-PACKAGE/1/STATE\0");

const MANIFEST_KEYS = [
  "chunk_size",
  "chunks",
  "format",
  "genome_hash",
  "max_resource_bytes",
  "next_state_root",
  "prior_state_root",
  "receipt_digest",
  "resource_format",
  "resource_root",
  "resource_size",
  "schema_version",
  "storage_policy",
  "transition_input_digest"
];
const RECEIPT_KEYS = [
  "chunk_count",
  "format",
  "genome_hash",
  "next_state_root",
  "prior_state_root",
  "resource_root",
  "resource_size",
  "storage_policy",
  "transition_input_digest"
];

export class StatePackageError extends Error {
  constructor(code, fieldPath, detail) {
    super(`${code}: ${detail}`);
    this.name = "StatePackageError";
    this.code = code;
    this.fieldPath = fieldPath;
    this.detail = detail;
  }
}

function fail(code, fieldPath, detail) {
  throw new StatePackageError(code, fieldPath, detail);
}

function ownBytes(source, maximum, path) {
  let bytes;
  try {
    bytes = source instanceof Uint8Array ? new Uint8Array(source) : new Uint8Array(source);
  } catch {
    fail("E_STATE_PACKAGE_INVALID", path, "bytes-required");
  }
  if (bytes.byteLength > maximum) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", path, String(maximum));
  }
  return bytes;
}

function exactKeys(value, expected, path) {
  if (!value || typeof value !== "object" || isArray(value)) {
    fail("E_STATE_PACKAGE_INVALID", path, "object-required");
  }
  if (
    objectHasOwn(value, "compression") ||
    objectHasOwn(value, "content_encoding") ||
    objectHasOwn(value, "encoding")
  ) {
    fail("E_STATE_PACKAGE_DECODING_UNSUPPORTED", path, "raw-only");
  }
  const actual = objectKeys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_STATE_PACKAGE_INVALID", path, "keys");
  }
}

function parseCanonical(source, maximum, path) {
  const bytes = ownBytes(source, maximum, path);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail("E_STATE_PACKAGE_INVALID", path, "json");
  }
  if (!isCanonical(bytes, value)) fail("E_STATE_PACKAGE_INVALID", path, "canonical");
  return { bytes, value };
}

function digest(domain, bytes) {
  const combined = new Uint8Array(domain.byteLength + bytes.byteLength);
  combined.set(domain);
  combined.set(bytes, domain.byteLength);
  return `sha256:${encodeBase64Url(sha256(combined))}`;
}

function validDigest(value) {
  if (typeof value !== "string" || !stringStartsWith(value, "sha256:")) return false;
  const decoded = decodeBase64Url(stringSlice(value, 7));
  return Boolean(decoded && decoded.byteLength === 32);
}

function assertDigest(value, path) {
  if (!validDigest(value)) fail("E_STATE_PACKAGE_INVALID", path, "sha256");
}

function stateBasis(manifest) {
  return {
    chunk_size: manifest.chunk_size,
    chunks: manifest.chunks,
    format: "mortalos-state-package-state/1",
    genome_hash: manifest.genome_hash,
    max_resource_bytes: manifest.max_resource_bytes,
    prior_state_root: manifest.prior_state_root,
    resource_format: manifest.resource_format,
    resource_root: manifest.resource_root,
    resource_size: manifest.resource_size,
    schema_version: manifest.schema_version,
    storage_policy: manifest.storage_policy,
    transition_input_digest: manifest.transition_input_digest
  };
}

function receiptFor(manifest) {
  return {
    chunk_count: manifest.chunks.length,
    format: STATE_PACKAGE_RECEIPT_FORMAT,
    genome_hash: manifest.genome_hash,
    next_state_root: manifest.next_state_root,
    prior_state_root: manifest.prior_state_root,
    resource_root: manifest.resource_root,
    resource_size: manifest.resource_size,
    storage_policy: manifest.storage_policy,
    transition_input_digest: manifest.transition_input_digest
  };
}

export function statePackageChunkDigest(bytes) {
  return digest(
    CHUNK_DOMAIN,
    ownBytes(bytes, STATE_PACKAGE_LIMITS.chunk_bytes, "/chunk")
  );
}

export function statePackageResourceRoot(bytes) {
  return digest(
    RESOURCE_DOMAIN,
    ownBytes(bytes, STATE_PACKAGE_LIMITS.resource_bytes, "/resource")
  );
}

export function statePackageInputDigest(bytes) {
  return digest(
    INPUT_DOMAIN,
    ownBytes(bytes, STATE_PACKAGE_LIMITS.input_bytes, "/input")
  );
}

export function statePackageReceiptDigest(bytes) {
  return digest(
    RECEIPT_DOMAIN,
    ownBytes(bytes, STATE_PACKAGE_LIMITS.receipt_bytes, "/receipt")
  );
}

export function statePackageStateRoot(manifest) {
  return digest(STATE_DOMAIN, canonicalBytes(stateBasis(manifest)));
}

export function createStatePackageInput({
  operation = "replace-resource",
  transitionId = "reference-1mib"
} = {}) {
  if (operation !== "replace-resource" || typeof transitionId !== "string") {
    fail("E_STATE_PACKAGE_INVALID", "/input", "replace-resource");
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/u.test(transitionId)) {
    fail("E_STATE_PACKAGE_INVALID", "/input/transition_id", "token");
  }
  return canonicalBytes({
    format: STATE_PACKAGE_INPUT_FORMAT,
    operation,
    transition_id: transitionId
  });
}

export function createStatePackage({
  genomeHash,
  inputBytes,
  priorStateRoot,
  resourceBytes,
  resourceFormat = "application/octet-stream",
  schemaVersion = "1"
}) {
  assertDigest(genomeHash, "/genome_hash");
  assertDigest(priorStateRoot, "/prior_state_root");
  if (resourceFormat !== "application/octet-stream") {
    fail("E_STATE_PACKAGE_DECODING_UNSUPPORTED", "/resource_format", "raw-only");
  }
  if (schemaVersion !== "1") fail("E_STATE_PACKAGE_INVALID", "/schema_version", "1");
  const resource = ownBytes(resourceBytes, STATE_PACKAGE_LIMITS.resource_bytes, "/resource");
  if (resource.byteLength === 0) fail("E_STATE_PACKAGE_INVALID", "/resource", "nonempty");
  const input = parseCanonical(inputBytes, STATE_PACKAGE_LIMITS.input_bytes, "/input");
  exactKeys(input.value, ["format", "operation", "transition_id"], "/input");
  if (
    input.value.format !== STATE_PACKAGE_INPUT_FORMAT ||
    input.value.operation !== "replace-resource" ||
    typeof input.value.transition_id !== "string"
  ) {
    fail("E_STATE_PACKAGE_INVALID", "/input", "format");
  }
  const chunks = [];
  const chunkBytes = [];
  for (let offset = 0, index = 0; offset < resource.byteLength; offset += STATE_PACKAGE_LIMITS.chunk_bytes, index += 1) {
    const bytes = resource.slice(offset, offset + STATE_PACKAGE_LIMITS.chunk_bytes);
    chunks.push({
      digest: statePackageChunkDigest(bytes),
      index,
      size: bytes.byteLength
    });
    chunkBytes.push(bytes);
  }
  if (chunks.length > STATE_PACKAGE_LIMITS.max_chunks) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/chunks", String(STATE_PACKAGE_LIMITS.max_chunks));
  }
  const manifest = {
    chunk_size: STATE_PACKAGE_LIMITS.chunk_bytes,
    chunks,
    format: STATE_PACKAGE_MANIFEST_FORMAT,
    genome_hash: genomeHash,
    max_resource_bytes: STATE_PACKAGE_LIMITS.resource_bytes,
    next_state_root: "",
    prior_state_root: priorStateRoot,
    receipt_digest: "",
    resource_format: resourceFormat,
    resource_root: statePackageResourceRoot(resource),
    resource_size: resource.byteLength,
    schema_version: schemaVersion,
    storage_policy: STATE_PACKAGE_POLICY,
    transition_input_digest: statePackageInputDigest(input.bytes)
  };
  manifest.next_state_root = statePackageStateRoot(manifest);
  const receiptBytes = canonicalBytes(receiptFor(manifest));
  manifest.receipt_digest = statePackageReceiptDigest(receiptBytes);
  const manifestBytes = canonicalBytes(manifest);
  if (manifestBytes.byteLength > STATE_PACKAGE_LIMITS.manifest_bytes) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/manifest", String(STATE_PACKAGE_LIMITS.manifest_bytes));
  }
  return freeze({
    chunkBytes: freeze(chunkBytes),
    inputBytes: input.bytes,
    manifest: freeze(manifest),
    manifestBytes,
    nextStateRoot: manifest.next_state_root,
    receiptBytes,
    resourceBytes: resource
  });
}

function validateManifest(manifest) {
  exactKeys(manifest, MANIFEST_KEYS, "/manifest");
  if (manifest.format !== STATE_PACKAGE_MANIFEST_FORMAT) {
    fail("E_STATE_PACKAGE_INVALID", "/manifest/format", String(manifest.format));
  }
  if (manifest.schema_version !== "1") {
    fail("E_STATE_PACKAGE_INVALID", "/manifest/schema_version", String(manifest.schema_version));
  }
  if (
    manifest.resource_format !== "application/octet-stream" ||
    manifest.storage_policy !== STATE_PACKAGE_POLICY
  ) {
    fail("E_STATE_PACKAGE_DECODING_UNSUPPORTED", "/manifest/resource_format", "raw-only");
  }
  if (
    manifest.chunk_size !== STATE_PACKAGE_LIMITS.chunk_bytes ||
    manifest.max_resource_bytes !== STATE_PACKAGE_LIMITS.resource_bytes
  ) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/manifest", "fixed-ceilings");
  }
  if (
    !numberIsSafeInteger(manifest.resource_size) ||
    manifest.resource_size < 1 ||
    manifest.resource_size > STATE_PACKAGE_LIMITS.resource_bytes
  ) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/manifest/resource_size", String(STATE_PACKAGE_LIMITS.resource_bytes));
  }
  if (!isArray(manifest.chunks) || manifest.chunks.length < 1) {
    fail("E_STATE_PACKAGE_INVALID", "/manifest/chunks", "nonempty-array");
  }
  if (manifest.chunks.length > STATE_PACKAGE_LIMITS.max_chunks) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/manifest/chunks", String(STATE_PACKAGE_LIMITS.max_chunks));
  }
  const seen = createSet();
  let total = 0;
  for (let index = 0; index < manifest.chunks.length; index += 1) {
    const entry = manifest.chunks[index];
    exactKeys(entry, ["digest", "index", "size"], `/manifest/chunks/${index}`);
    if (entry.index !== index) {
      fail("E_STATE_PACKAGE_CHUNK_ORDER", `/manifest/chunks/${index}/index`, String(entry.index));
    }
    assertDigest(entry.digest, `/manifest/chunks/${index}/digest`);
    if (setHas(seen, entry.digest)) {
      fail("E_STATE_PACKAGE_CHUNK_DUPLICATE", `/manifest/chunks/${index}/digest`, entry.digest);
    }
    setAdd(seen, entry.digest);
    const final = index === manifest.chunks.length - 1;
    if (
      !numberIsSafeInteger(entry.size) ||
      entry.size < 1 ||
      entry.size > STATE_PACKAGE_LIMITS.chunk_bytes ||
      (!final && entry.size !== STATE_PACKAGE_LIMITS.chunk_bytes)
    ) {
      fail("E_STATE_PACKAGE_CHUNK_SIZE", `/manifest/chunks/${index}/size`, String(entry.size));
    }
    total += entry.size;
  }
  if (total !== manifest.resource_size) {
    fail("E_STATE_PACKAGE_CHUNK_SIZE", "/manifest/resource_size", `${total}/${manifest.resource_size}`);
  }
  for (const field of [
    "genome_hash",
    "next_state_root",
    "prior_state_root",
    "receipt_digest",
    "resource_root",
    "transition_input_digest"
  ]) assertDigest(manifest[field], `/manifest/${field}`);
}

export function verifyStatePackage({
  expectedGenomeHash,
  expectedNextStateRoot,
  expectedPriorStateRoot,
  inputBytes,
  manifestBytes,
  receiptBytes
}) {
  const manifestDocument = parseCanonical(
    manifestBytes,
    STATE_PACKAGE_LIMITS.manifest_bytes,
    "/manifest"
  );
  const receiptDocument = parseCanonical(
    receiptBytes,
    STATE_PACKAGE_LIMITS.receipt_bytes,
    "/receipt"
  );
  const inputDocument = parseCanonical(
    inputBytes,
    STATE_PACKAGE_LIMITS.input_bytes,
    "/input"
  );
  validateManifest(manifestDocument.value);
  exactKeys(receiptDocument.value, RECEIPT_KEYS, "/receipt");
  exactKeys(inputDocument.value, ["format", "operation", "transition_id"], "/input");
  const manifest = manifestDocument.value;
  if (manifest.genome_hash !== expectedGenomeHash) {
    fail("E_STATE_GENOME_MISMATCH", "/manifest/genome_hash", expectedGenomeHash);
  }
  if (manifest.prior_state_root !== expectedPriorStateRoot) {
    fail("E_STATE_PACKAGE_STALE_ROOT", "/manifest/prior_state_root", expectedPriorStateRoot);
  }
  if (manifest.transition_input_digest !== statePackageInputDigest(inputDocument.bytes)) {
    fail("E_STATE_PACKAGE_INPUT_MISMATCH", "/manifest/transition_input_digest", "digest");
  }
  const computedNext = statePackageStateRoot(manifest);
  if (manifest.next_state_root !== computedNext || computedNext !== expectedNextStateRoot) {
    fail("E_STATE_NEXT_ROOT_MISMATCH", "/manifest/next_state_root", expectedNextStateRoot);
  }
  const expectedReceipt = canonicalBytes(receiptFor(manifest));
  if (encodeBase64Url(expectedReceipt) !== encodeBase64Url(receiptDocument.bytes)) {
    fail("E_STATE_PACKAGE_RECEIPT_MISMATCH", "/receipt", "bytes");
  }
  if (manifest.receipt_digest !== statePackageReceiptDigest(receiptDocument.bytes)) {
    fail("E_STATE_PACKAGE_RECEIPT_MISMATCH", "/manifest/receipt_digest", "digest");
  }
  return freeze({
    inputBytes: inputDocument.bytes,
    manifest: freeze(manifest),
    manifestBytes: manifestDocument.bytes,
    nextStateRoot: computedNext,
    receiptBytes: receiptDocument.bytes
  });
}

export function createStatePackageTransitionPayload(options) {
  const statePackage = createStatePackage(options);
  return freeze({
    ...statePackage,
    payload: {
      format: STATE_PACKAGE_TRANSITION_FORMAT,
      input_base64url: encodeBase64Url(statePackage.inputBytes),
      manifest_base64url: encodeBase64Url(statePackage.manifestBytes),
      receipt_base64url: encodeBase64Url(statePackage.receiptBytes)
    }
  });
}

export function verifyStatePackageTransitionPayload({
  expectedGenomeHash,
  expectedNextStateRoot,
  expectedPriorStateRoot,
  payload
}) {
  exactKeys(
    payload,
    ["format", "input_base64url", "manifest_base64url", "receipt_base64url"],
    "/event_payload"
  );
  if (payload.format !== STATE_PACKAGE_TRANSITION_FORMAT) {
    fail("E_STATE_PACKAGE_INVALID", "/event_payload/format", String(payload.format));
  }
  for (const [field, maximum] of [
    ["input_base64url", STATE_PACKAGE_LIMITS.input_bytes],
    ["manifest_base64url", STATE_PACKAGE_LIMITS.manifest_bytes],
    ["receipt_base64url", STATE_PACKAGE_LIMITS.receipt_bytes]
  ]) {
    if (typeof payload[field] !== "string") {
      fail("E_STATE_PACKAGE_INVALID", `/event_payload/${field}`, "base64url");
    }
    const decoded = decodeBase64Url(payload[field]);
    if (!decoded) fail("E_STATE_PACKAGE_INVALID", `/event_payload/${field}`, "base64url");
    if (decoded.byteLength > maximum) {
      fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", `/event_payload/${field}`, String(maximum));
    }
  }
  return verifyStatePackage({
    expectedGenomeHash,
    expectedNextStateRoot,
    expectedPriorStateRoot,
    inputBytes: decodeBase64Url(payload.input_base64url),
    manifestBytes: decodeBase64Url(payload.manifest_base64url),
    receiptBytes: decodeBase64Url(payload.receipt_base64url)
  });
}

export function deterministicReferenceResource(size = STATE_PACKAGE_LIMITS.reference_resource_bytes) {
  if (!numberIsSafeInteger(size) || size < 1 || size > STATE_PACKAGE_LIMITS.resource_bytes) {
    fail("E_STATE_PACKAGE_LIMIT_EXCEEDED", "/reference_resource", String(size));
  }
  const bytes = new Uint8Array(size);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] =
      (index * 73 + (index >>> 8) * 19 + (index >>> 16) * 37 + 41) & 0xff;
  }
  return bytes;
}
