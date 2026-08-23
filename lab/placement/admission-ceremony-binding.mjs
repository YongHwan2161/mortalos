import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import { PLACEMENT_ADMISSION_LIMITS } from "../../src/placement/admission.mjs";
import {
  freeze,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";

const CHALLENGE_FORMAT = "mortalos-placement-admission-external-ceremony-challenge/2";
const ENDPOINT_BINDING_DOMAIN = "MortalOS placement admission ceremony endpoints v2";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const ROLES = freeze(["issuer", "subject"]);
const UINT8_ARRAY = Uint8Array;
const URL_CONSTRUCTOR = URL;
const urlHashGetter = Object.getOwnPropertyDescriptor(URL.prototype, "hash").get;
const urlHostnameGetter = Object.getOwnPropertyDescriptor(URL.prototype, "hostname").get;
const urlOriginGetter = Object.getOwnPropertyDescriptor(URL.prototype, "origin").get;
const urlPasswordGetter = Object.getOwnPropertyDescriptor(URL.prototype, "password").get;
const urlPathnameGetter = Object.getOwnPropertyDescriptor(URL.prototype, "pathname").get;
const urlProtocolGetter = Object.getOwnPropertyDescriptor(URL.prototype, "protocol").get;
const urlSearchGetter = Object.getOwnPropertyDescriptor(URL.prototype, "search").get;
const urlUsernameGetter = Object.getOwnPropertyDescriptor(URL.prototype, "username").get;
const reflectApply = Reflect.apply;

export const PLACEMENT_ADMISSION_CEREMONY_BINDING_FORMATS = freeze({
  challenge: CHALLENGE_FORMAT
});

export const PLACEMENT_ADMISSION_CEREMONY_BINDING_LIMITS = freeze({
  endpoint_url_bytes: 2048
});

export class PlacementAdmissionCeremonyError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionCeremonyError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionCeremonyError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(value, maximum, label) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > maximum || isSharedByteView(value)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", label);
  }
  return new UINT8_ARRAY(value);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedIdentity(source, label) {
  const value = exactRecord(source, ["key_id", "public_key"], label);
  if (!regexpTest(KEY_ID, value.key_id) || typeof value.public_key !== "string") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", label);
  }
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function normalizedRole(value, label) {
  if (value !== ROLES[0] && value !== ROLES[1]) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ROLE", label);
  }
  return value;
}

function urlValue(value, getter, label) {
  try {
    return reflectApply(getter, value, []);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-url-slot`);
  }
}

export function normalizePlacementAdmissionCeremonyEndpointOrigin(value, label = "endpoint") {
  requireRealm();
  if (
    typeof value !== "string" || value.length < 1 ||
    value.length > PLACEMENT_ADMISSION_CEREMONY_BINDING_LIMITS.endpoint_url_bytes
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", `${label}-url`);
  let parsed;
  try {
    parsed = new URL_CONSTRUCTOR(value);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-url`);
  }
  const protocol = urlValue(parsed, urlProtocolGetter, label);
  const hostname = urlValue(parsed, urlHostnameGetter, label);
  const pathname = urlValue(parsed, urlPathnameGetter, label);
  const search = urlValue(parsed, urlSearchGetter, label);
  const hash = urlValue(parsed, urlHashGetter, label);
  const username = urlValue(parsed, urlUsernameGetter, label);
  const password = urlValue(parsed, urlPasswordGetter, label);
  const origin = urlValue(parsed, urlOriginGetter, label);
  const loopback = hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "localhost";
  if (
    (protocol !== "https:" && !(protocol === "http:" && loopback)) ||
    pathname !== "/" || search !== "" || hash !== "" ||
    username !== "" || password !== "" || origin === "null" || origin !== value
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-origin-policy`);
  return origin;
}

function normalizedBinding(source, label) {
  const value = exactRecord(source, [
    "issuer_key_id",
    "issuer_origin",
    "subject_key_id",
    "subject_origin"
  ], label);
  if (!regexpTest(KEY_ID, value.issuer_key_id) || !regexpTest(KEY_ID, value.subject_key_id)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", `${label}-key-id`);
  }
  return freeze({
    issuer_key_id: value.issuer_key_id,
    issuer_origin: normalizePlacementAdmissionCeremonyEndpointOrigin(
      value.issuer_origin,
      `${label}-issuer`
    ),
    subject_key_id: value.subject_key_id,
    subject_origin: normalizePlacementAdmissionCeremonyEndpointOrigin(
      value.subject_origin,
      `${label}-subject`
    )
  });
}

function endpointBindingDigest(binding) {
  return domainHash(ENDPOINT_BINDING_DOMAIN, canonicalBytes(binding));
}

export function createPlacementAdmissionCeremonyChallenge(options) {
  requireRealm();
  const value = exactRecord(options, [
    "issuer_identity",
    "issuer_origin",
    "nonce",
    "subject_identity",
    "subject_origin"
  ], "ceremony-challenge-options");
  const issuerIdentity = normalizedIdentity(value.issuer_identity, "challenge-issuer-identity");
  const subjectIdentity = normalizedIdentity(value.subject_identity, "challenge-subject-identity");
  const binding = normalizedBinding({
    issuer_key_id: issuerIdentity.key_id,
    issuer_origin: value.issuer_origin,
    subject_key_id: subjectIdentity.key_id,
    subject_origin: value.subject_origin
  }, "challenge-binding");
  const nonce = ownedBytes(value.nonce, 32, "challenge-nonce");
  if (nonce.byteLength !== 32) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", "challenge-nonce");
  }
  const bytes = canonicalBytes({
    endpoint_binding: binding,
    endpoint_binding_digest: endpointBindingDigest(binding),
    format: CHALLENGE_FORMAT,
    nonce_base64url: encodeBase64Url(nonce)
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_LIMITS.attestation_challenge_bytes_max) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", "challenge-bytes");
  }
  return bytes;
}

export function restorePlacementAdmissionCeremonyChallenge(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_LIMITS.attestation_challenge_bytes_max,
    "ceremony-challenge"
  );
  const value = exactRecord(parsed.value, [
    "endpoint_binding",
    "endpoint_binding_digest",
    "format",
    "nonce_base64url"
  ], "ceremony-challenge");
  const binding = normalizedBinding(value.endpoint_binding, "ceremony-challenge-binding");
  const nonce = decodeBase64Url(value.nonce_base64url);
  if (
    value.format !== CHALLENGE_FORMAT ||
    !regexpTest(DIGEST, value.endpoint_binding_digest) ||
    nonce === null || nonce.byteLength !== 32 ||
    value.endpoint_binding_digest !== endpointBindingDigest(binding)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "ceremony-challenge");
  return freeze({
    binding,
    bytes: parsed.bytes,
    endpoint_binding_digest: value.endpoint_binding_digest
  });
}

function challengeBytes(value, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-encoding`);
  }
  const decoded = decodeBase64Url(value);
  if (decoded === null) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-encoding`);
  }
  return decoded;
}

function verifyIdentityBinding(challenge, issuerIdentity, subjectIdentity, label) {
  if (
    challenge.binding.issuer_key_id !== issuerIdentity.key_id ||
    challenge.binding.subject_key_id !== subjectIdentity.key_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", `${label}-identity`);
}

export function verifyPlacementAdmissionCeremonyChallenge(options) {
  requireRealm();
  const value = exactRecord(options, [
    "attestation_challenge_base64url",
    "issuer_identity",
    "issuer_origin",
    "subject_identity",
    "subject_origin"
  ], "ceremony-challenge-verification");
  const issuerIdentity = normalizedIdentity(value.issuer_identity, "verification-issuer-identity");
  const subjectIdentity = normalizedIdentity(value.subject_identity, "verification-subject-identity");
  const challenge = restorePlacementAdmissionCeremonyChallenge(challengeBytes(
    value.attestation_challenge_base64url,
    "request-challenge"
  ));
  verifyIdentityBinding(challenge, issuerIdentity, subjectIdentity, "request-endpoint-binding");
  const issuerOrigin = normalizePlacementAdmissionCeremonyEndpointOrigin(
    value.issuer_origin,
    "verification-issuer-origin"
  );
  const subjectOrigin = normalizePlacementAdmissionCeremonyEndpointOrigin(
    value.subject_origin,
    "verification-subject-origin"
  );
  if (
    challenge.binding.issuer_origin !== issuerOrigin ||
    challenge.binding.subject_origin !== subjectOrigin
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "request-endpoint-binding-origin");
  return challenge;
}

export function verifyPlacementAdmissionCeremonySignerBinding(options) {
  requireRealm();
  const value = exactRecord(options, [
    "attestation_challenge_base64url",
    "endpoint_origin",
    "issuer_identity",
    "role",
    "subject_identity"
  ], "ceremony-signer-binding-verification");
  const issuerIdentity = normalizedIdentity(value.issuer_identity, "signer-binding-issuer");
  const subjectIdentity = normalizedIdentity(value.subject_identity, "signer-binding-subject");
  const signerRole = normalizedRole(value.role, "signer-binding-role");
  const endpointOrigin = normalizePlacementAdmissionCeremonyEndpointOrigin(
    value.endpoint_origin,
    "signer-endpoint-origin"
  );
  const challenge = restorePlacementAdmissionCeremonyChallenge(challengeBytes(
    value.attestation_challenge_base64url,
    "signer-request-challenge"
  ));
  verifyIdentityBinding(challenge, issuerIdentity, subjectIdentity, "signer-endpoint-binding");
  const signedOrigin = signerRole === "issuer"
    ? challenge.binding.issuer_origin
    : challenge.binding.subject_origin;
  if (signedOrigin !== endpointOrigin) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", `${signerRole}-configured-origin`);
  }
  return challenge;
}
