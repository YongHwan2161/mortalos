import { X509Certificate } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { TLSSocket } from "node:tls";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import { verifyEd25519 } from "../../src/crypto.mjs";
import {
  createWeakSet,
  freeze,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord,
  typedArraySet,
  weakSetAdd,
  weakSetHas
} from "../../src/primordials.mjs";
import { restorePlacementAdmissionCeremonyBundle } from "./admission-ceremony-client.mjs";
import { normalizePlacementAdmissionCeremonyEndpointOrigin } from "./admission-ceremony-binding.mjs";
import {
  createPlacementAdmissionDeploymentPossessionChallenge,
  derivePlacementAdmissionDeploymentTlsExporterDigest,
  PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER,
  PLACEMENT_ADMISSION_SIGNER_LIMITS,
  restorePlacementAdmissionDeploymentPossessionProof
} from "./admission-signer-session.mjs";

const LEGACY_FORMAT = "mortalos-placement-admission-deployment-observation/1";
const FORMAT = "mortalos-placement-admission-deployment-observation/2";
const LEGACY_DOMAIN = "MortalOS placement admission deployment observation v1";
const DOMAIN = "MortalOS placement admission deployment observation v2";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const TOKEN = /^[\x21-\x7e]{32,4096}$/u;
const TLS_PROTOCOL = /^TLSv1\.[23]$/u;
const UINT8_ARRAY = Uint8Array;
const URL_CONSTRUCTOR = URL;
const PROMISE_CONSTRUCTOR = Promise;
const arrayIsArrayIntrinsic = Array.isArray;
const arrayPushIntrinsic = Array.prototype.push;
const bufferConcatIntrinsic = Buffer.concat;
const bufferFromIntrinsic = Buffer.from;
const bufferIsBufferIntrinsic = Buffer.isBuffer;
const httpsRequestIntrinsic = httpsRequest;
const promiseAllIntrinsic = Promise.all;
const reflectApply = Reflect.apply;
const tlsExportKeyingMaterialIntrinsic = TLSSocket.prototype.exportKeyingMaterial;
const x509PublicKeyGetter = Object.getOwnPropertyDescriptor(
  X509Certificate.prototype,
  "publicKey"
).get;
const urlHashGetter = Object.getOwnPropertyDescriptor(URL.prototype, "hash").get;
const urlHostnameGetter = Object.getOwnPropertyDescriptor(URL.prototype, "hostname").get;
const urlPathnameGetter = Object.getOwnPropertyDescriptor(URL.prototype, "pathname").get;
const urlPortGetter = Object.getOwnPropertyDescriptor(URL.prototype, "port").get;
const urlProtocolGetter = Object.getOwnPropertyDescriptor(URL.prototype, "protocol").get;
const urlSearchGetter = Object.getOwnPropertyDescriptor(URL.prototype, "search").get;
const deploymentErrors = createWeakSet();

export const PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_FORMATS = freeze({
  legacy_observation: LEGACY_FORMAT,
  observation: FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS = freeze({
  identity_response_bytes: 4096,
  observation_bytes: 3 * 1024 * 1024,
  observer_nonce_bytes: 32,
  possession_response_bytes:
    PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_proof_bytes,
  timeout_ms_max: 60_000,
  timeout_ms_min: 1_000
});

export class PlacementAdmissionDeploymentObservationError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionDeploymentObservationError";
    this.code = code;
    this.detail = detail;
    weakSetAdd(deploymentErrors, this);
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionDeploymentObservationError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-shared-memory`);
  }
  let length;
  try {
    length = byteLengthOfBytes(source);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  if (length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", label);
  }
  const bytes = new UINT8_ARRAY(length);
  try {
    typedArraySet(bytes, new UINT8_ARRAY(source.buffer, source.byteOffset, length), 0);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return bytes;
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedNonce(source) {
  const bytes = ownedBytes(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes,
    "observer-nonce"
  );
  if (bytes.byteLength !== PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observer_nonce_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "observer-nonce");
  }
  return bytes;
}

function normalizedObservedAt(value) {
  if (!numberIsSafeInteger(value) || value < 0) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "observed-at-ms");
  }
  return value;
}

function normalizedTimeout(value) {
  if (
    !numberIsSafeInteger(value) ||
    value < PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.timeout_ms_min ||
    value > PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.timeout_ms_max
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "timeout-ms");
  return value;
}

function normalizedPossessionAuthorizations(source) {
  if (source === null) return null;
  const value = exactRecord(
    source,
    ["issuer", "subject"],
    "deployment-possession-authorizations"
  );
  if (
    typeof value.issuer !== "string" || !regexpTest(TOKEN, value.issuer) ||
    typeof value.subject !== "string" || !regexpTest(TOKEN, value.subject) ||
    value.issuer === value.subject
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-possession-authorization");
  return freeze({ issuer: value.issuer, subject: value.subject });
}

function sha256Digest(source) {
  return `sha256:${encodeBase64Url(sha256(source))}`;
}

function normalizedIdentity(source, label) {
  const value = exactRecord(source, ["key_id", "public_key"], label);
  if (!regexpTest(KEY_ID, value.key_id) || typeof value.public_key !== "string") {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", label);
  }
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function identityResponse(source, expected, role, label) {
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.identity_response_bytes,
    label
  );
  const value = exactRecord(parsed.value, ["identity", "role"], label);
  const identity = normalizedIdentity(value.identity, `${label}-identity`);
  if (
    value.role !== role ||
    identity.key_id !== expected.key_id ||
    !equalBytes(canonicalBytes(identity), canonicalBytes(expected))
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", role);
  return freeze({ bytes: parsed.bytes, identity });
}

function normalizedLegacyEndpoint(source, expected, role, label) {
  const value = exactRecord(source, [
    "alpn_protocol",
    "endpoint_origin",
    "identity_response_base64url",
    "key_id",
    "remote_address",
    "remote_family",
    "role",
    "tls_certificate_sha256",
    "tls_protocol",
    "tls_public_key_sha256"
  ], label);
  if (value.role !== role || value.key_id !== expected.identity.key_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", role);
  }
  const origin = normalizePlacementAdmissionCeremonyEndpointOrigin(value.endpoint_origin, label);
  if (origin !== expected.endpoint_origin || !origin.startsWith("https://")) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", `${role}-origin`);
  }
  const identityBytes = decodeBase64Url(value.identity_response_base64url);
  if (identityBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-identity-response`);
  }
  identityResponse(identityBytes, expected.identity, role, `${role}-identity-response`);
  if (
    (value.alpn_protocol !== null && (
      typeof value.alpn_protocol !== "string" || value.alpn_protocol.length > 32
    )) ||
    typeof value.remote_address !== "string" || isIP(value.remote_address) === 0 ||
    (value.remote_family !== "IPv4" && value.remote_family !== "IPv6") ||
    !regexpTest(DIGEST, value.tls_certificate_sha256) ||
    !regexpTest(DIGEST, value.tls_public_key_sha256) ||
    !regexpTest(TLS_PROTOCOL, value.tls_protocol)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-tls-observation`);
  return freeze({
    alpn_protocol: value.alpn_protocol,
    endpoint_origin: origin,
    identity_response_base64url: value.identity_response_base64url,
    key_id: value.key_id,
    remote_address: value.remote_address,
    remote_family: value.remote_family,
    role,
    tls_certificate_sha256: value.tls_certificate_sha256,
    tls_protocol: value.tls_protocol,
    tls_public_key_sha256: value.tls_public_key_sha256
  });
}

function normalizedPossessionEndpoint(
  source,
  expected,
  role,
  bundleId,
  observedAt,
  nonce,
  label
) {
  const value = exactRecord(source, [
    "alpn_protocol",
    "endpoint_origin",
    "key_id",
    "possession_proof_base64url",
    "remote_address",
    "remote_family",
    "role",
    "tls_certificate_sha256",
    "tls_exporter_sha256",
    "tls_protocol",
    "tls_public_key_sha256"
  ], label);
  if (value.role !== role || value.key_id !== expected.identity.key_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", role);
  }
  const origin = normalizePlacementAdmissionCeremonyEndpointOrigin(value.endpoint_origin, label);
  if (origin !== expected.endpoint_origin || !origin.startsWith("https://")) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", `${role}-origin`);
  }
  if (
    (value.alpn_protocol !== null && (
      typeof value.alpn_protocol !== "string" || value.alpn_protocol.length > 32
    )) ||
    typeof value.remote_address !== "string" || isIP(value.remote_address) === 0 ||
    (value.remote_family !== "IPv4" && value.remote_family !== "IPv6") ||
    !regexpTest(DIGEST, value.tls_certificate_sha256) ||
    !regexpTest(DIGEST, value.tls_exporter_sha256) ||
    !regexpTest(DIGEST, value.tls_public_key_sha256) ||
    !regexpTest(TLS_PROTOCOL, value.tls_protocol)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-tls-observation`);
  const proofBytes = decodeBase64Url(value.possession_proof_base64url);
  if (proofBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-possession-proof`);
  }
  let proof;
  try {
    proof = restorePlacementAdmissionDeploymentPossessionProof(proofBytes);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-possession-proof`);
  }
  if (
    proof.ceremony_bundle_id !== bundleId ||
    proof.endpoint_origin !== origin ||
    proof.key_id !== expected.identity.key_id ||
    proof.observed_at_ms !== observedAt ||
    proof.observer_nonce_base64url !== encodeBase64Url(nonce) ||
    proof.role !== role ||
    proof.tls_exporter_sha256 !== value.tls_exporter_sha256
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", `${role}-possession-proof`);
  if (!verifyEd25519(expected.identity.public_key, proof.signing_message, proof.signature)) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY", `${role}-possession-signature`);
  }
  return freeze({
    alpn_protocol: value.alpn_protocol,
    endpoint_origin: origin,
    key_id: value.key_id,
    possession_proof_base64url: value.possession_proof_base64url,
    remote_address: value.remote_address,
    remote_family: value.remote_family,
    role,
    tls_certificate_sha256: value.tls_certificate_sha256,
    tls_exporter_sha256: value.tls_exporter_sha256,
    tls_protocol: value.tls_protocol,
    tls_public_key_sha256: value.tls_public_key_sha256
  });
}

function factsFor(issuer, subject) {
  return freeze({
    endpoint_origins_distinct: issuer.endpoint_origin !== subject.endpoint_origin,
    remote_addresses_distinct: issuer.remote_address !== subject.remote_address,
    tls_certificate_digests_distinct:
      issuer.tls_certificate_sha256 !== subject.tls_certificate_sha256,
    tls_public_key_digests_distinct:
      issuer.tls_public_key_sha256 !== subject.tls_public_key_sha256
  });
}

function observationContent(bundle, observedAt, nonce, issuer, subject, format) {
  const common = {
    ceremony_bundle_base64url: encodeBase64Url(bundle.bytes),
    ceremony_bundle_id: bundle.bundle_id,
    endpoint_observations: freeze([issuer, subject]),
    facts: factsFor(issuer, subject),
    format,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    non_authority: true,
    observed_at_ms: observedAt,
    observer_nonce_base64url: encodeBase64Url(nonce),
    requires_fresh_live_observation: true,
    tls_verification: "observer-process-trust-store"
  };
  return format === FORMAT
    ? freeze({ ...common, key_possession: "tls-exporter-role-key-signed" })
    : freeze(common);
}

function createObservation(bundle, observedAt, nonce, issuer, subject, format) {
  const content = observationContent(bundle, observedAt, nonce, issuer, subject, format);
  const observationId = domainHash(
    format === FORMAT ? DOMAIN : LEGACY_DOMAIN,
    canonicalBytes(content)
  );
  const bytes = canonicalBytes({ observation_id: observationId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observation_bytes) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT", "observation-bytes");
  }
  return freeze({
    bytes,
    facts: content.facts,
    observation_id: observationId,
    status: "observed"
  });
}

function requestIdentity(expected, role, timeout) {
  let origin;
  try {
    origin = new URL_CONSTRUCTOR(expected.endpoint_origin);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-origin`);
  }
  const protocol = reflectApply(urlProtocolGetter, origin, []);
  const pathname = reflectApply(urlPathnameGetter, origin, []);
  const search = reflectApply(urlSearchGetter, origin, []);
  const hash = reflectApply(urlHashGetter, origin, []);
  const hostname = reflectApply(urlHostnameGetter, origin, []);
  const port = reflectApply(urlPortGetter, origin, []);
  if (protocol !== "https:" || pathname !== "/" || search || hash) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", `${role}-https-origin`);
  }
  const options = {
    agent: false,
    headers: { accept: "application/json", connection: "close" },
    hostname,
    method: "GET",
    path: "/identity",
    port: port === "" ? 443 : Number(port),
    protocol: "https:",
    rejectUnauthorized: true,
    servername: isIP(hostname) === 0 ? hostname : undefined
  };
  return new PROMISE_CONSTRUCTOR((resolve, reject) => {
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      const trusted = error !== null && typeof error === "object" &&
        weakSetHas(deploymentErrors, error);
      reject(trusted ? error : new PlacementAdmissionDeploymentObservationError(
        "E_PLACEMENT_ADMISSION_DEPLOYMENT_NETWORK",
        role
      ));
    };
    const request = reflectApply(httpsRequestIntrinsic, null, [options, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          "E_PLACEMENT_ADMISSION_DEPLOYMENT_HTTP",
          `${role}-status`
        ));
        return;
      }
      const contentType = response.headers["content-type"];
      if (contentType !== "application/json; charset=utf-8") {
        response.resume();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          "E_PLACEMENT_ADMISSION_DEPLOYMENT_HTTP",
          `${role}-content-type`
        ));
        return;
      }
      const chunks = [];
      let length = 0;
      let tls;
      try {
        const socket = response.socket;
        const certificate = socket.getPeerCertificate(true);
        const certificateBytes = certificate?.raw;
        if (!reflectApply(bufferIsBufferIntrinsic, Buffer, [certificateBytes]) ||
          certificateBytes.byteLength < 1) {
          throw new Error("missing certificate");
        }
        const certificateObject = new X509Certificate(certificateBytes);
        const publicKeyObject = reflectApply(x509PublicKeyGetter, certificateObject, []);
        const publicKey = reflectApply(publicKeyObject.export, publicKeyObject, [{
          format: "der",
          type: "spki"
        }]);
        tls = freeze({
          alpn_protocol: typeof socket.alpnProtocol === "string" && socket.alpnProtocol !== ""
            ? socket.alpnProtocol
            : null,
          remote_address: socket.remoteAddress,
          remote_family: socket.remoteFamily,
          tls_certificate_sha256: sha256Digest(certificateBytes),
          tls_protocol: socket.getProtocol(),
          tls_public_key_sha256: sha256Digest(publicKey)
        });
      } catch {
        response.destroy();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          "E_PLACEMENT_ADMISSION_DEPLOYMENT_TLS",
          role
        ));
        return;
      }
      response.on("data", (chunk) => {
        length += chunk.byteLength;
        if (length > PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.identity_response_bytes) {
          response.destroy();
          finishReject(new PlacementAdmissionDeploymentObservationError(
            "E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT",
            `${role}-identity-response`
          ));
          return;
        }
        reflectApply(arrayPushIntrinsic, chunks, [chunk]);
      });
      response.once("error", finishReject);
      response.once("end", () => {
        if (settled) return;
        try {
          const bytes = reflectApply(bufferConcatIntrinsic, Buffer, [chunks, length]);
          identityResponse(bytes, expected.identity, role, `${role}-identity-response`);
          const endpoint = normalizedLegacyEndpoint({
            ...tls,
            endpoint_origin: expected.endpoint_origin,
            identity_response_base64url: encodeBase64Url(bytes),
            key_id: expected.identity.key_id,
            role
          }, expected, role, `${role}-endpoint-observation`);
          settled = true;
          resolve(endpoint);
        } catch (error) {
          finishReject(error);
        }
      });
    }]);
    request.setTimeout(timeout, () => {
      request.destroy(new PlacementAdmissionDeploymentObservationError(
        "E_PLACEMENT_ADMISSION_DEPLOYMENT_TIMEOUT",
        role
      ));
    });
    request.once("error", finishReject);
    request.end();
  });
}

function requestPossession(expected, role, bundleId, observedAt, nonce, authorization, timeout) {
  let origin;
  try {
    origin = new URL_CONSTRUCTOR(expected.endpoint_origin);
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-origin`);
  }
  const protocol = reflectApply(urlProtocolGetter, origin, []);
  const pathname = reflectApply(urlPathnameGetter, origin, []);
  const search = reflectApply(urlSearchGetter, origin, []);
  const hash = reflectApply(urlHashGetter, origin, []);
  const hostname = reflectApply(urlHostnameGetter, origin, []);
  const port = reflectApply(urlPortGetter, origin, []);
  if (protocol !== "https:" || pathname !== "/" || search || hash) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", `${role}-https-origin`);
  }
  let challengeBytes;
  try {
    challengeBytes = createPlacementAdmissionDeploymentPossessionChallenge({
      ceremony_bundle_id: bundleId,
      endpoint_origin: expected.endpoint_origin,
      key_id: expected.identity.key_id,
      observed_at_ms: observedAt,
      observer_nonce: nonce,
      role
    });
  } catch {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", `${role}-possession-challenge`);
  }
  const challengeBody = reflectApply(bufferFromIntrinsic, Buffer, [challengeBytes]);
  const options = {
    agent: false,
    headers: {
      accept: "application/octet-stream",
      authorization: `Bearer ${authorization}`,
      connection: "close",
      "content-length": String(challengeBytes.byteLength),
      "content-type": "application/octet-stream"
    },
    hostname,
    method: "POST",
    path: "/prove-deployment-possession",
    port: port === "" ? 443 : Number(port),
    protocol: "https:",
    rejectUnauthorized: true,
    servername: isIP(hostname) === 0 ? hostname : undefined
  };
  return new PROMISE_CONSTRUCTOR((resolve, reject) => {
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      const trusted = error !== null && typeof error === "object" &&
        weakSetHas(deploymentErrors, error);
      reject(trusted ? error : new PlacementAdmissionDeploymentObservationError(
        "E_PLACEMENT_ADMISSION_DEPLOYMENT_NETWORK",
        role
      ));
    };
    const request = reflectApply(httpsRequestIntrinsic, null, [options, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          response.statusCode === 401
            ? "E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY"
            : "E_PLACEMENT_ADMISSION_DEPLOYMENT_HTTP",
          `${role}-possession-status`
        ));
        return;
      }
      if (response.headers["content-type"] !== "application/octet-stream") {
        response.resume();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          "E_PLACEMENT_ADMISSION_DEPLOYMENT_HTTP",
          `${role}-possession-content-type`
        ));
        return;
      }
      const chunks = [];
      let length = 0;
      let tls;
      try {
        const socket = response.socket;
        const certificate = socket.getPeerCertificate(true);
        const certificateBytes = certificate?.raw;
        if (!reflectApply(bufferIsBufferIntrinsic, Buffer, [certificateBytes]) ||
          certificateBytes.byteLength < 1) {
          throw new Error("missing certificate");
        }
        const certificateObject = new X509Certificate(certificateBytes);
        const publicKeyObject = reflectApply(x509PublicKeyGetter, certificateObject, []);
        const publicKey = reflectApply(publicKeyObject.export, publicKeyObject, [{
          format: "der",
          type: "spki"
        }]);
        const exporter = reflectApply(tlsExportKeyingMaterialIntrinsic, socket, [
          PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.bytes,
          PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.label,
          challengeBody
        ]);
        tls = freeze({
          alpn_protocol: typeof socket.alpnProtocol === "string" && socket.alpnProtocol !== ""
            ? socket.alpnProtocol
            : null,
          remote_address: socket.remoteAddress,
          remote_family: socket.remoteFamily,
          tls_certificate_sha256: sha256Digest(certificateBytes),
          tls_exporter_sha256: derivePlacementAdmissionDeploymentTlsExporterDigest(exporter),
          tls_protocol: socket.getProtocol(),
          tls_public_key_sha256: sha256Digest(publicKey)
        });
      } catch {
        response.destroy();
        finishReject(new PlacementAdmissionDeploymentObservationError(
          "E_PLACEMENT_ADMISSION_DEPLOYMENT_TLS",
          role
        ));
        return;
      }
      response.on("data", (chunk) => {
        length += chunk.byteLength;
        if (length >
          PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.possession_response_bytes) {
          response.destroy();
          finishReject(new PlacementAdmissionDeploymentObservationError(
            "E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT",
            `${role}-possession-response`
          ));
          return;
        }
        reflectApply(arrayPushIntrinsic, chunks, [chunk]);
      });
      response.once("error", finishReject);
      response.once("end", () => {
        if (settled) return;
        try {
          const bytes = reflectApply(bufferConcatIntrinsic, Buffer, [chunks, length]);
          const endpoint = normalizedPossessionEndpoint({
            ...tls,
            endpoint_origin: expected.endpoint_origin,
            key_id: expected.identity.key_id,
            possession_proof_base64url: encodeBase64Url(bytes),
            role
          }, expected, role, bundleId, observedAt, nonce, `${role}-endpoint-observation`);
          settled = true;
          resolve(endpoint);
        } catch (error) {
          finishReject(error);
        }
      });
    }]);
    request.setTimeout(timeout, () => {
      request.destroy(new PlacementAdmissionDeploymentObservationError(
        "E_PLACEMENT_ADMISSION_DEPLOYMENT_TIMEOUT",
        role
      ));
    });
    request.once("error", finishReject);
    request.end(challengeBody);
  });
}

export function restorePlacementAdmissionDeploymentObservation(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_DEPLOYMENT_OBSERVATION_LIMITS.observation_bytes,
    "deployment-observation"
  );
  const format = parsed.value?.format;
  if (format !== FORMAT && format !== LEGACY_FORMAT) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-observation-format");
  }
  const envelopeKeys = [
    "ceremony_bundle_base64url",
    "ceremony_bundle_id",
    "endpoint_observations",
    "facts",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "non_authority",
    "observation_id",
    "observed_at_ms",
    "observer_nonce_base64url",
    "requires_fresh_live_observation",
    "tls_verification"
  ];
  if (format === FORMAT) reflectApply(arrayPushIntrinsic, envelopeKeys, ["key_possession"]);
  const value = exactRecord(parsed.value, envelopeKeys, "deployment-observation");
  if (
    value.format !== format ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.non_authority !== true ||
    value.requires_fresh_live_observation !== true ||
    value.tls_verification !== "observer-process-trust-store" ||
    (format === FORMAT && value.key_possession !== "tls-exporter-role-key-signed")
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-observation-envelope");
  const bundleBytes = decodeBase64Url(value.ceremony_bundle_base64url);
  const nonceBytes = decodeBase64Url(value.observer_nonce_base64url);
  if (bundleBytes === null || nonceBytes === null) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "deployment-observation-encoding");
  }
  const bundle = restorePlacementAdmissionCeremonyBundle(bundleBytes);
  if (bundle.bundle_id !== value.ceremony_bundle_id) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "ceremony-bundle-id");
  }
  const nonce = normalizedNonce(nonceBytes);
  const observedAt = normalizedObservedAt(value.observed_at_ms);
  if (!reflectApply(arrayIsArrayIntrinsic, Array, [value.endpoint_observations]) ||
    value.endpoint_observations.length !== 2) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT", "endpoint-observations");
  }
  const issuer = format === FORMAT
    ? normalizedPossessionEndpoint(
        value.endpoint_observations[0],
        bundle.issuer,
        "issuer",
        bundle.bundle_id,
        observedAt,
        nonce,
        "issuer-endpoint-observation"
      )
    : normalizedLegacyEndpoint(
        value.endpoint_observations[0],
        bundle.issuer,
        "issuer",
        "issuer-endpoint-observation"
      );
  const subject = format === FORMAT
    ? normalizedPossessionEndpoint(
        value.endpoint_observations[1],
        bundle.subject,
        "subject",
        bundle.bundle_id,
        observedAt,
        nonce,
        "subject-endpoint-observation"
      )
    : normalizedLegacyEndpoint(
        value.endpoint_observations[1],
        bundle.subject,
        "subject",
        "subject-endpoint-observation"
      );
  const facts = factsFor(issuer, subject);
  if (!equalBytes(canonicalBytes(facts), canonicalBytes(value.facts))) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "observation-facts");
  }
  const content = observationContent(bundle, observedAt, nonce, issuer, subject, format);
  const observationId = domainHash(
    format === FORMAT ? DOMAIN : LEGACY_DOMAIN,
    canonicalBytes(content)
  );
  if (value.observation_id !== observationId) {
    fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "observation-id");
  }
  return freeze({
    bytes: new UINT8_ARRAY(parsed.bytes),
    ceremony_bundle_id: bundle.bundle_id,
    endpoint_observations: freeze([issuer, subject]),
    facts,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    key_possession: format === FORMAT
      ? "tls-exporter-role-key-signed"
      : "identity-only-legacy",
    live_observation_verified: false,
    non_authority: true,
    observation_id: observationId,
    observer_nonce: new UINT8_ARRAY(nonce),
    observed_at_ms: observedAt,
    status: "integrity-verified",
    tls_verification: "observer-process-trust-store"
  });
}

export async function observePlacementAdmissionDeployment(options) {
  requireRealm();
  const source = exactRecord(options, [
    "ceremony_bundle_bytes",
    "observed_at_ms",
    "observer_nonce",
    "possession_authorizations",
    "timeout_ms"
  ], "deployment-observation-options");
  const bundleBytes = ownedBytes(
    source.ceremony_bundle_bytes,
    2 * 1024 * 1024,
    "ceremony-bundle"
  );
  const nonce = normalizedNonce(source.observer_nonce);
  const observedAt = normalizedObservedAt(source.observed_at_ms);
  const timeout = normalizedTimeout(source.timeout_ms);
  const authorizations = normalizedPossessionAuthorizations(source.possession_authorizations);
  const bundle = restorePlacementAdmissionCeremonyBundle(bundleBytes);
  if (
    !regexpTest(/^https:\/\//u, bundle.issuer.endpoint_origin) ||
    !regexpTest(/^https:\/\//u, bundle.subject.endpoint_origin)
  ) fail("E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING", "https-origins-required");
  const issuerPromise = authorizations === null
    ? requestIdentity(bundle.issuer, "issuer", timeout)
    : requestPossession(
        bundle.issuer,
        "issuer",
        bundle.bundle_id,
        observedAt,
        nonce,
        authorizations.issuer,
        timeout
      );
  const subjectPromise = authorizations === null
    ? requestIdentity(bundle.subject, "subject", timeout)
    : requestPossession(
        bundle.subject,
        "subject",
        bundle.bundle_id,
        observedAt,
        nonce,
        authorizations.subject,
        timeout
      );
  const [issuer, subject] = await reflectApply(promiseAllIntrinsic, Promise, [[
    issuerPromise,
    subjectPromise
  ]]);
  requireRealm();
  return createObservation(
    bundle,
    observedAt,
    nonce,
    issuer,
    subject,
    authorizations === null ? LEGACY_FORMAT : FORMAT
  );
}
