import { sha256 } from "@noble/hashes/sha2.js";
import {
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  utf8Bytes
} from "../bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";

export const CONFIDENTIAL_SUITE = "mortalos-confidential-state-suite/1";
export const CONFIDENTIAL_FORMATS = Object.freeze({
  aad: "mortalos-confidential-chunk-aad/1",
  active: "mortalos-confidential-active-epoch/1",
  counter_basis: "mortalos-counter-reservation-basis/1",
  counter_receipt: "mortalos-counter-reservation-receipt/1",
  encrypted_resource: "mortalos-confidential-resource-envelope/1",
  epoch_id: "mortalos-confidential-epoch-id/1",
  manifest: "mortalos-confidential-package-manifest/1",
  package: "mortalos-confidential-package/1",
  receipt: "mortalos-confidential-transition-receipt/1",
  rotation: "mortalos-confidential-rotation/1",
  rotation_authorization: "mortalos-confidential-rotation-authorization/1",
  wrap: "mortalos-epoch-key-wrap/1",
  wrap_label: "mortalos-epoch-wrap-label/1"
});

export const CONFIDENTIAL_LIMITS = Object.freeze({
  aad_bytes: 4_096,
  chunk_plaintext_bytes: 65_536,
  counter_max_exclusive: 4_294_967_296n,
  epoch_max: 18_446_744_073_709_551_615n,
  manifest_bytes: 131_072,
  max_chunks: 64,
  package_bytes: 5_000_000,
  reservation_count_max: 64n,
  rsa_wrapped_bytes: 384
});

export const CONFIDENTIAL_DOMAINS = Object.freeze({
  aad: "MortalOS S4 chunk aad v1",
  authority: "MortalOS S4 counter authority v1",
  ciphertext: "MortalOS S4 ciphertext chunk v1",
  encryption_key: "MortalOS S4 encryption public key v1",
  epoch: "MortalOS S4 epoch id v1",
  package: "MortalOS S4 confidential package v1",
  plaintext: "MortalOS S4 encrypted plaintext commitment v1",
  receipt: "MortalOS S4 confidential receipt v1",
  reservation: "MortalOS S4 counter reservation v1",
  reservation_receipt: "MortalOS S4 counter receipt v1",
  rotation: "MortalOS S4 rotation authorization v1",
  wrap: "MortalOS S4 wrapped epoch key v1",
  wrap_label: "MortalOS S4 wrap label v1"
});

export class ConfidentialStateError extends Error {
  constructor(code, fieldPath = "", detail = "") {
    super(code);
    this.name = "ConfidentialStateError";
    this.code = code;
    this.fieldPath = fieldPath;
    this.detail = detail;
  }
}

export function confidentialFail(code, fieldPath = "", detail = "") {
  throw new ConfidentialStateError(code, fieldPath, detail);
}

export function exactObjectKeys(value, expected, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, "object-required");
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, "exact-keys");
  }
}

export function parseCanonicalDocument(bytes, maximum, path) {
  let owned;
  try {
    owned = new Uint8Array(bytes);
  } catch {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, "bytes-required");
  }
  if (owned.byteLength > maximum) {
    confidentialFail("E_CONFIDENTIAL_LIMIT", path, String(maximum));
  }
  let value;
  try {
    value = parseJsonBytes(owned, { maxBytes: maximum, maxDepth: 24 });
  } catch {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, "canonical-json");
  }
  if (!isCanonical(owned, value)) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, "canonical-json");
  }
  return Object.freeze({ bytes: owned, value });
}

export function taggedBytes(value, prefix, length, path) {
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, prefix);
  }
  const bytes = decodeBase64Url(value.slice(prefix.length));
  if (!bytes || bytes.byteLength !== length) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", path, prefix);
  }
  return bytes;
}

export function assertDigest(value, path) {
  taggedBytes(value, "sha256:", 32, path);
  return value;
}

export function assertOrganismId(value, path = "/organism_id") {
  taggedBytes(value, "mortalos:", 32, path);
  return value;
}

export function assertResourceId(value, path = "/resource_id") {
  taggedBytes(value, "mortalos-resource:", 32, path);
  return value;
}

export function assertCustodianId(value, path = "/custodian_id") {
  taggedBytes(value, "mortalos-key:", 32, path);
  return value;
}

export function parseDecimalString(value, maximum, path, { minimum = 0n } = {}) {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9][0-9]*)$/u.test(value)
  ) {
    confidentialFail("E_CONFIDENTIAL_DECIMAL", path, "canonical-string");
  }
  let parsed;
  try {
    parsed = BigInt(value);
  } catch {
    confidentialFail("E_CONFIDENTIAL_DECIMAL", path, "integer");
  }
  if (parsed < minimum || parsed > maximum) {
    confidentialFail("E_CONFIDENTIAL_DECIMAL", path, "range");
  }
  return parsed;
}

export function parseEpoch(value, path = "/epoch") {
  return parseDecimalString(value, CONFIDENTIAL_LIMITS.epoch_max, path);
}

export function parseCounter(
  value,
  path,
  { exclusive = false, minimum = 0n } = {}
) {
  return parseDecimalString(
    value,
    exclusive
      ? CONFIDENTIAL_LIMITS.counter_max_exclusive
      : CONFIDENTIAL_LIMITS.counter_max_exclusive - 1n,
    path,
    { minimum }
  );
}

export function domainHash(domain, bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return `sha256:${encodeBase64Url(
    sha256(concatBytes(utf8Bytes(domain), new Uint8Array([0]), payload))
  )}`;
}

export function canonicalDomainHash(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

export function counterToIv(counter) {
  const value =
    typeof counter === "bigint"
      ? counter
      : parseCounter(counter, "/invocation_counter");
  if (value < 0n || value >= CONFIDENTIAL_LIMITS.counter_max_exclusive) {
    confidentialFail("E_CONFIDENTIAL_COUNTER_EXHAUSTED", "/invocation_counter", "range");
  }
  const iv = new Uint8Array(12);
  iv.set([0x4d, 0x4f, 0x53, 0x34]);
  let remainder = value;
  for (let index = 11; index >= 4; index -= 1) {
    iv[index] = Number(remainder & 0xffn);
    remainder >>= 8n;
  }
  return iv;
}

export function assertExactIv(value, counter, path = "/iv_base64url") {
  const decoded = decodeBase64Url(value);
  const expected = counterToIv(counter);
  if (
    !decoded ||
    decoded.byteLength !== expected.byteLength ||
    decoded.some((byte, index) => byte !== expected[index])
  ) {
    confidentialFail("E_CONFIDENTIAL_IV", path, "counter-binding");
  }
  return decoded;
}

export function randomTagged(prefix, byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `${prefix}${encodeBase64Url(bytes)}`;
}

export function plaintextCommitment(bytes) {
  return domainHash(CONFIDENTIAL_DOMAINS.plaintext, bytes);
}
