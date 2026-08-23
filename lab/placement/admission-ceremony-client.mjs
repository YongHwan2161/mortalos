import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  PLACEMENT_ADMISSION_LIMITS,
  finalizePlacementAdmissionEvidence,
  verifyPlacementAdmissionEvidence
} from "../../src/placement/admission.mjs";
import {
  arrayPush,
  freeze,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord,
  typedArraySet
} from "../../src/primordials.mjs";
import {
  restorePlacementAdmissionSignatureResponse,
  restorePlacementAdmissionSigningRequest
} from "./admission-signer-session.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_BINDING_FORMATS,
  PLACEMENT_ADMISSION_CEREMONY_BINDING_LIMITS,
  PlacementAdmissionCeremonyError,
  createPlacementAdmissionCeremonyChallenge,
  normalizePlacementAdmissionCeremonyEndpointOrigin,
  verifyPlacementAdmissionCeremonyChallenge,
  verifyPlacementAdmissionCeremonySignerBinding
} from "./admission-ceremony-binding.mjs";

const FORMAT = "mortalos-placement-admission-ceremony-bundle/1";
const BUNDLE_DOMAIN = "MortalOS placement admission ceremony bundle v1";
const ROLE_RESPONSE_FORMAT = "mortalos-placement-admission-ceremony-role-response/1";
const ROLE_RESPONSE_DOMAIN = "MortalOS placement admission ceremony role response v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const TOKEN = /^[\x21-\x7e]{32,4096}$/u;
const ROLES = freeze(["issuer", "subject"]);
const UINT8_ARRAY = Uint8Array;
const REQUEST_CONSTRUCTOR = Request;
const ABORT_SIGNAL_CONSTRUCTOR = AbortSignal;
const fetchIntrinsic = globalThis.fetch;
const abortSignalTimeoutIntrinsic = AbortSignal.timeout;
const responseBodyGetter = Object.getOwnPropertyDescriptor(Response.prototype, "body").get;
const responseStatusGetter = Object.getOwnPropertyDescriptor(Response.prototype, "status").get;
const streamGetReaderIntrinsic = ReadableStream.prototype.getReader;
const readerReadIntrinsic = ReadableStreamDefaultReader.prototype.read;
const readerCancelIntrinsic = ReadableStreamDefaultReader.prototype.cancel;
const readerReleaseLockIntrinsic = ReadableStreamDefaultReader.prototype.releaseLock;
const reflectApply = Reflect.apply;

export const PLACEMENT_ADMISSION_CEREMONY_FORMATS = freeze({
  bundle: FORMAT,
  challenge: PLACEMENT_ADMISSION_CEREMONY_BINDING_FORMATS.challenge,
  role_response: ROLE_RESPONSE_FORMAT
});

export const PLACEMENT_ADMISSION_CEREMONY_LIMITS = freeze({
  authorization_bytes: 4096,
  bundle_bytes: 2 * 1024 * 1024,
  endpoint_url_bytes: PLACEMENT_ADMISSION_CEREMONY_BINDING_LIMITS.endpoint_url_bytes,
  identity_response_bytes: 4096,
  response_bytes: PLACEMENT_ADMISSION_LIMITS.document_bytes,
  role_response_bytes: 2 * PLACEMENT_ADMISSION_LIMITS.document_bytes,
  timeout_ms_max: 60_000,
  timeout_ms_min: 1_000
});

export { PlacementAdmissionCeremonyError, createPlacementAdmissionCeremonyChallenge };

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
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 64 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function sameCanonical(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

function normalizedIdentity(source, label) {
  const value = exactRecord(source, ["key_id", "public_key"], label);
  if (!regexpTest(KEY_ID, value.key_id) || typeof value.public_key !== "string") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", label);
  }
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function role(value, label) {
  if (value !== ROLES[0] && value !== ROLES[1]) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ROLE", label);
  }
  return value;
}

function normalizedEndpoint(source, label) {
  const value = exactRecord(source, ["authorization", "url"], label);
  if (
    typeof value.authorization !== "string" ||
    value.authorization.length > PLACEMENT_ADMISSION_CEREMONY_LIMITS.authorization_bytes ||
    !regexpTest(TOKEN, value.authorization)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_AUTHORIZATION", label);
  const origin = normalizePlacementAdmissionCeremonyEndpointOrigin(value.url, label);
  return freeze({
    authorization: value.authorization,
    identity_url: `${origin}/identity`,
    origin,
    signing_url: `${origin}/sign-admission`
  });
}

function normalizedPublicOrigin(value, label) {
  return normalizePlacementAdmissionCeremonyEndpointOrigin(value, label);
}

function verifyRequestChallenge(request, issuerOrigin, issuerIdentity, subjectOrigin, subjectIdentity) {
  return verifyPlacementAdmissionCeremonyChallenge({
    attestation_challenge_base64url: request.body.attestation_challenge_base64url,
    issuer_identity: issuerIdentity,
    issuer_origin: issuerOrigin,
    subject_identity: subjectIdentity,
    subject_origin: subjectOrigin
  });
}

function timeout(value) {
  if (
    !numberIsSafeInteger(value) ||
    value < PLACEMENT_ADMISSION_CEREMONY_LIMITS.timeout_ms_min ||
    value > PLACEMENT_ADMISSION_CEREMONY_LIMITS.timeout_ms_max
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", "timeout-ms");
  return value;
}

function concatOwned(chunks, length) {
  const result = new UINT8_ARRAY(length);
  let offset = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    typedArraySet(result, chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function boundedResponse(response, maximum, label) {
  requireRealm();
  let status;
  let body;
  try {
    status = reflectApply(responseStatusGetter, response, []);
    body = reflectApply(responseBodyGetter, response, []);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-response-slot`);
  }
  if (body === null) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-empty-body`);
  }
  let reader;
  try {
    reader = reflectApply(streamGetReaderIntrinsic, body, []);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-response-stream`);
  }
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      let step;
      try {
        step = await reflectApply(readerReadIntrinsic, reader, []);
      } catch {
        requireRealm();
        fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-response-read`);
      }
      requireRealm();
      const entry = exactRecord(step, ["done", "value"], `${label}-response-step`);
      if (entry.done === true) break;
      if (entry.done !== false) {
        fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-response-step`);
      }
      const chunkLength = byteLengthOfBytes(entry.value);
      if (chunkLength === null || isSharedByteView(entry.value)) {
        fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-response-chunk`);
      }
      if (length + chunkLength > maximum) {
        try {
          await reflectApply(readerCancelIntrinsic, reader, []);
        } catch {
          // The bounded verdict does not depend on a cooperative remote stream.
        }
        requireRealm();
        fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", `${label}-response-bytes`);
      }
      const owned = new UINT8_ARRAY(entry.value);
      arrayPush(chunks, owned);
      length += chunkLength;
    }
  } finally {
    try {
      reflectApply(readerReleaseLockIntrinsic, reader, []);
    } catch {
      // A terminal or cancelled stream may already have released its reader.
    }
  }
  if (length < 1) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-empty-body`);
  }
  return freeze({ bytes: concatOwned(chunks, length), status });
}

function createEndpointRequest(endpoint, { body = null, label, timeoutMs, url }) {
  const signal = reflectApply(abortSignalTimeoutIntrinsic, ABORT_SIGNAL_CONSTRUCTOR, [timeoutMs]);
  const init = body === null
    ? freeze({ cache: "no-store", credentials: "omit", method: "GET", redirect: "error", signal })
    : freeze({
      body,
      cache: "no-store",
      credentials: "omit",
      headers: freeze({
        accept: "application/octet-stream",
        authorization: `Bearer ${endpoint.authorization}`,
        "content-type": "application/octet-stream"
      }),
      method: "POST",
      redirect: "error",
      signal
    });
  try {
    return new REQUEST_CONSTRUCTOR(url, init);
  } catch {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-request`);
  }
}

async function endpointRequest(request, maximum, label) {
  let response;
  try {
    response = await reflectApply(fetchIntrinsic, undefined, [request]);
  } catch {
    requireRealm();
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-network`);
  }
  requireRealm();
  const result = await boundedResponse(
    response,
    maximum,
    label
  );
  if (result.status !== 200) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT", `${label}-status-${result.status}`);
  }
  return result.bytes;
}

async function endpointIdentity(request, expectedRole) {
  const bytes = await endpointRequest(
    request,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.identity_response_bytes,
    `${expectedRole}-identity`
  );
  requireRealm();
  const parsed = parseCanonical(
    bytes,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.identity_response_bytes,
    `${expectedRole}-identity`
  );
  const envelope = exactRecord(parsed.value, ["identity", "role"], `${expectedRole}-identity`);
  if (role(envelope.role, `${expectedRole}-identity`) !== expectedRole) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ROLE", `${expectedRole}-identity`);
  }
  return normalizedIdentity(envelope.identity, `${expectedRole}-identity`);
}

function observation(source, expectedRole, label) {
  const value = exactRecord(
    source,
    ["endpoint_origin", "identity", "response_base64url", "role"],
    label
  );
  const responseBytes = decodeBase64Url(value.response_base64url);
  if (responseBytes === null) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", `${label}-response-encoding`);
  }
  return freeze({
    endpoint_origin: normalizedPublicOrigin(value.endpoint_origin, `${label}-endpoint`),
    identity: normalizedIdentity(value.identity, `${label}-identity`),
    response_bytes: ownedBytes(
      responseBytes,
      PLACEMENT_ADMISSION_CEREMONY_LIMITS.response_bytes,
      `${label}-response`
    ),
    response_base64url: value.response_base64url,
    role: role(value.role, label) === expectedRole ? expectedRole : fail(
      "E_PLACEMENT_ADMISSION_CEREMONY_ROLE",
      label
    )
  });
}

function roleResponseContent({
  endpointOrigin,
  evidenceId,
  identity,
  responseBase64Url,
  signerRole
}) {
  return freeze({
    endpoint_origin: endpointOrigin,
    evidence_id: evidenceId,
    format: ROLE_RESPONSE_FORMAT,
    identity,
    response_base64url: responseBase64Url,
    role: signerRole
  });
}

function createRoleResponse({ endpointOrigin, identity, responseBytes, signerRole }) {
  const response = restorePlacementAdmissionSignatureResponse(responseBytes);
  const content = roleResponseContent({
    endpointOrigin,
    evidenceId: response.evidence_id,
    identity,
    responseBase64Url: encodeBase64Url(response.bytes),
    signerRole
  });
  const roleResponseId = domainHash(ROLE_RESPONSE_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ role_response_id: roleResponseId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", "role-response-bytes");
  }
  return bytes;
}

export function restorePlacementAdmissionCeremonyRoleResponse(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
    "ceremony-role-response"
  );
  const value = exactRecord(parsed.value, [
    "endpoint_origin",
    "evidence_id",
    "format",
    "identity",
    "response_base64url",
    "role",
    "role_response_id"
  ], "ceremony-role-response");
  if (
    value.format !== ROLE_RESPONSE_FORMAT ||
    !regexpTest(DIGEST, value.evidence_id) ||
    !regexpTest(DIGEST, value.role_response_id)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "role-response-format");
  const signerRole = role(value.role, "role-response-role");
  const observed = observation({
    endpoint_origin: value.endpoint_origin,
    identity: value.identity,
    response_base64url: value.response_base64url,
    role: signerRole
  }, signerRole, "role-response-observation");
  const response = restorePlacementAdmissionSignatureResponse(observed.response_bytes);
  if (
    response.role !== signerRole ||
    response.key_id !== observed.identity.key_id ||
    response.evidence_id !== value.evidence_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "role-response-signature");
  const content = roleResponseContent({
    endpointOrigin: observed.endpoint_origin,
    evidenceId: response.evidence_id,
    identity: observed.identity,
    responseBase64Url: observed.response_base64url,
    signerRole
  });
  const roleResponseId = domainHash(ROLE_RESPONSE_DOMAIN, canonicalBytes(content));
  if (value.role_response_id !== roleResponseId) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "role-response-id");
  }
  return freeze({
    bytes: new UINT8_ARRAY(parsed.bytes),
    endpoint_origin: observed.endpoint_origin,
    evidence_id: response.evidence_id,
    identity: observed.identity,
    response_bytes: new UINT8_ARRAY(response.bytes),
    role: signerRole,
    role_response_id: roleResponseId
  });
}

function bundleContent({
  evaluatedAt,
  evidenceBase64Url,
  evidenceId,
  issuer,
  requestBase64Url,
  subject,
  trustRoot
}) {
  return freeze({
    evaluated_at_ms: evaluatedAt,
    evidence_base64url: evidenceBase64Url,
    evidence_id: evidenceId,
    format: FORMAT,
    issuer: freeze({
      endpoint_origin: issuer.endpoint_origin,
      identity: issuer.identity,
      response_base64url: issuer.response_base64url,
      role: "issuer"
    }),
    request_base64url: requestBase64Url,
    subject: freeze({
      endpoint_origin: subject.endpoint_origin,
      identity: subject.identity,
      response_base64url: subject.response_base64url,
      role: "subject"
    }),
    trust_root: trustRoot
  });
}

function createBundle(content) {
  const bundleId = domainHash(BUNDLE_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ bundle_id: bundleId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_CEREMONY_LIMITS.bundle_bytes) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_LIMIT", "bundle-bytes");
  }
  return bytes;
}

export function restorePlacementAdmissionCeremonyBundle(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.bundle_bytes,
    "ceremony-bundle"
  );
  const value = exactRecord(parsed.value, [
    "bundle_id",
    "evaluated_at_ms",
    "evidence_base64url",
    "evidence_id",
    "format",
    "issuer",
    "request_base64url",
    "subject",
    "trust_root"
  ], "ceremony-bundle");
  if (value.format !== FORMAT) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "bundle-format");
  }
  const requestSource = decodeBase64Url(value.request_base64url);
  const evidenceSource = decodeBase64Url(value.evidence_base64url);
  if (requestSource === null || evidenceSource === null) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "bundle-byte-encoding");
  }
  const request = restorePlacementAdmissionSigningRequest(requestSource);
  if (!sameCanonical(value.trust_root, request.trust_root)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "bundle-trust-root");
  }
  const issuer = observation(value.issuer, "issuer", "bundle-issuer");
  const subject = observation(value.subject, "subject", "bundle-subject");
  if (
    !sameCanonical(issuer.identity, request.trust_root.issuer) ||
    !sameCanonical(subject.identity, request.body.subject)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", "bundle-endpoint-identity");
  verifyRequestChallenge(
    request,
    issuer.endpoint_origin,
    issuer.identity,
    subject.endpoint_origin,
    subject.identity
  );
  const issuerResponse = restorePlacementAdmissionSignatureResponse(issuer.response_bytes);
  const subjectResponse = restorePlacementAdmissionSignatureResponse(subject.response_bytes);
  if (
    issuerResponse.role !== "issuer" || subjectResponse.role !== "subject" ||
    issuerResponse.key_id !== issuer.identity.key_id ||
    subjectResponse.key_id !== subject.identity.key_id ||
    issuerResponse.evidence_id !== request.evidence_id ||
    subjectResponse.evidence_id !== request.evidence_id ||
    value.evidence_id !== request.evidence_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "bundle-signature-response");
  const evidenceBytes = ownedBytes(
    evidenceSource,
    PLACEMENT_ADMISSION_LIMITS.document_bytes,
    "bundle-evidence"
  );
  const reconstructedEvidence = finalizePlacementAdmissionEvidence({
    body: request.body,
    issuer_signature: issuerResponse.signature,
    subject_signature: subjectResponse.signature,
    trust_root: request.trust_root
  });
  if (!equalBytes(reconstructedEvidence, evidenceBytes)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "bundle-response-evidence");
  }
  const evidence = verifyPlacementAdmissionEvidence({
    evaluated_at_ms: value.evaluated_at_ms,
    evidence_bytes: evidenceBytes,
    trust_root: request.trust_root
  });
  if (
    evidence.evidence_id !== request.evidence_id ||
    !sameCanonical(evidence.body, request.body)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "bundle-evidence");
  const content = bundleContent({
    evaluatedAt: value.evaluated_at_ms,
    evidenceBase64Url: value.evidence_base64url,
    evidenceId: value.evidence_id,
    issuer,
    requestBase64Url: value.request_base64url,
    subject,
    trustRoot: request.trust_root
  });
  const expectedBundleId = domainHash(BUNDLE_DOMAIN, canonicalBytes(content));
  if (value.bundle_id !== expectedBundleId) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "bundle-id");
  }
  return freeze({
    bundle_id: expectedBundleId,
    bytes: new UINT8_ARRAY(parsed.bytes),
    evaluated_at_ms: value.evaluated_at_ms,
    evidence_bytes: new UINT8_ARRAY(evidenceBytes),
    evidence_id: evidence.evidence_id,
    issuer: freeze({ endpoint_origin: issuer.endpoint_origin, identity: issuer.identity }),
    request_bytes: new UINT8_ARRAY(request.bytes),
    status: "verified",
    subject: freeze({ endpoint_origin: subject.endpoint_origin, identity: subject.identity }),
    trust_root: request.trust_root
  });
}

export function finalizePlacementAdmissionCeremonyBundle(options) {
  requireRealm();
  const values = exactRecord(options, [
    "evaluated_at_ms",
    "issuer_response_bytes",
    "request_bytes",
    "subject_response_bytes"
  ], "ceremony-finalization-options");
  if (typeof values.evaluated_at_ms !== "string") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "evaluated-at-ms");
  }
  const request = restorePlacementAdmissionSigningRequest(values.request_bytes);
  const issuer = restorePlacementAdmissionCeremonyRoleResponse(values.issuer_response_bytes);
  const subject = restorePlacementAdmissionCeremonyRoleResponse(values.subject_response_bytes);
  if (issuer.role !== "issuer" || subject.role !== "subject") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_ROLE", "finalization-responses");
  }
  if (
    !sameCanonical(issuer.identity, request.trust_root.issuer) ||
    !sameCanonical(subject.identity, request.body.subject)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", "finalization-identity");
  verifyRequestChallenge(
    request,
    issuer.endpoint_origin,
    issuer.identity,
    subject.endpoint_origin,
    subject.identity
  );
  const issuerResponse = restorePlacementAdmissionSignatureResponse(issuer.response_bytes);
  const subjectResponse = restorePlacementAdmissionSignatureResponse(subject.response_bytes);
  if (
    issuerResponse.evidence_id !== request.evidence_id ||
    subjectResponse.evidence_id !== request.evidence_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "finalization-evidence-id");
  const evidenceBytes = finalizePlacementAdmissionEvidence({
    body: request.body,
    issuer_signature: issuerResponse.signature,
    subject_signature: subjectResponse.signature,
    trust_root: request.trust_root
  });
  const evidence = verifyPlacementAdmissionEvidence({
    evaluated_at_ms: values.evaluated_at_ms,
    evidence_bytes: evidenceBytes,
    trust_root: request.trust_root
  });
  const content = bundleContent({
    evaluatedAt: values.evaluated_at_ms,
    evidenceBase64Url: encodeBase64Url(evidenceBytes),
    evidenceId: evidence.evidence_id,
    issuer: {
      endpoint_origin: issuer.endpoint_origin,
      identity: issuer.identity,
      response_base64url: encodeBase64Url(issuer.response_bytes)
    },
    requestBase64Url: encodeBase64Url(request.bytes),
    subject: {
      endpoint_origin: subject.endpoint_origin,
      identity: subject.identity,
      response_base64url: encodeBase64Url(subject.response_bytes)
    },
    trustRoot: request.trust_root
  });
  return restorePlacementAdmissionCeremonyBundle(createBundle(content));
}

export async function runPlacementAdmissionHttpCeremonyRole(options) {
  requireRealm();
  const values = exactRecord(options, [
    "endpoint",
    "request_bytes",
    "role",
    "timeout_ms"
  ], "ceremony-role-options");
  const request = restorePlacementAdmissionSigningRequest(values.request_bytes);
  const endpoint = normalizedEndpoint(values.endpoint, "role-endpoint");
  const signerRole = role(values.role, "ceremony-role");
  const timeoutMs = timeout(values.timeout_ms);
  verifyPlacementAdmissionCeremonySignerBinding({
    attestation_challenge_base64url: request.body.attestation_challenge_base64url,
    endpoint_origin: endpoint.origin,
    issuer_identity: request.trust_root.issuer,
    role: signerRole,
    subject_identity: request.body.subject
  });
  const requests = freeze({
    identity: createEndpointRequest(endpoint, {
      label: `${signerRole}-identity`,
      timeoutMs,
      url: endpoint.identity_url
    }),
    signature: createEndpointRequest(endpoint, {
      body: request.bytes,
      label: `${signerRole}-signature`,
      timeoutMs,
      url: endpoint.signing_url
    })
  });
  const identity = await endpointIdentity(requests.identity, signerRole);
  requireRealm();
  const expectedIdentity = signerRole === "issuer"
    ? request.trust_root.issuer
    : request.body.subject;
  if (!sameCanonical(identity, expectedIdentity)) {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", `${signerRole}-endpoint-identity`);
  }
  const responseBytes = await endpointRequest(
    requests.signature,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.response_bytes,
    `${signerRole}-signature`
  );
  requireRealm();
  const response = restorePlacementAdmissionSignatureResponse(responseBytes);
  if (
    response.role !== signerRole ||
    response.key_id !== identity.key_id ||
    response.evidence_id !== request.evidence_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", `${signerRole}-signature-response`);
  return restorePlacementAdmissionCeremonyRoleResponse(createRoleResponse({
    endpointOrigin: endpoint.origin,
    identity,
    responseBytes,
    signerRole
  }));
}

export async function runPlacementAdmissionHttpCeremony(options) {
  requireRealm();
  const values = exactRecord(options, [
    "evaluated_at_ms",
    "issuer",
    "request_bytes",
    "subject",
    "timeout_ms"
  ], "ceremony-options");
  const request = restorePlacementAdmissionSigningRequest(values.request_bytes);
  const issuerEndpoint = normalizedEndpoint(values.issuer, "issuer-endpoint");
  const subjectEndpoint = normalizedEndpoint(values.subject, "subject-endpoint");
  const timeoutMs = timeout(values.timeout_ms);
  const evaluatedAt = values.evaluated_at_ms;
  if (typeof evaluatedAt !== "string") {
    fail("E_PLACEMENT_ADMISSION_CEREMONY_FORMAT", "evaluated-at-ms");
  }
  const requests = freeze({
    issuer_identity: createEndpointRequest(issuerEndpoint, {
      label: "issuer-identity",
      timeoutMs,
      url: issuerEndpoint.identity_url
    }),
    issuer_signature: createEndpointRequest(issuerEndpoint, {
      body: request.bytes,
      label: "issuer-signature",
      timeoutMs,
      url: issuerEndpoint.signing_url
    }),
    subject_identity: createEndpointRequest(subjectEndpoint, {
      label: "subject-identity",
      timeoutMs,
      url: subjectEndpoint.identity_url
    }),
    subject_signature: createEndpointRequest(subjectEndpoint, {
      body: request.bytes,
      label: "subject-signature",
      timeoutMs,
      url: subjectEndpoint.signing_url
    })
  });

  const issuerIdentity = await endpointIdentity(requests.issuer_identity, "issuer");
  requireRealm();
  const subjectIdentity = await endpointIdentity(requests.subject_identity, "subject");
  requireRealm();
  if (
    !sameCanonical(issuerIdentity, request.trust_root.issuer) ||
    !sameCanonical(subjectIdentity, request.body.subject)
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_IDENTITY", "endpoint-identity");
  verifyRequestChallenge(
    request,
    issuerEndpoint.origin,
    issuerIdentity,
    subjectEndpoint.origin,
    subjectIdentity
  );

  const issuerResponseBytes = await endpointRequest(
    requests.issuer_signature,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.response_bytes,
    "issuer-signature"
  );
  requireRealm();
  const issuerResponse = restorePlacementAdmissionSignatureResponse(issuerResponseBytes);
  const subjectResponseBytes = await endpointRequest(
    requests.subject_signature,
    PLACEMENT_ADMISSION_CEREMONY_LIMITS.response_bytes,
    "subject-signature"
  );
  requireRealm();
  const subjectResponse = restorePlacementAdmissionSignatureResponse(subjectResponseBytes);
  if (
    issuerResponse.role !== "issuer" || subjectResponse.role !== "subject" ||
    issuerResponse.key_id !== issuerIdentity.key_id ||
    subjectResponse.key_id !== subjectIdentity.key_id ||
    issuerResponse.evidence_id !== request.evidence_id ||
    subjectResponse.evidence_id !== request.evidence_id
  ) fail("E_PLACEMENT_ADMISSION_CEREMONY_BINDING", "endpoint-signature-response");

  const issuerRoleResponse = createRoleResponse({
    endpointOrigin: issuerEndpoint.origin,
    identity: issuerIdentity,
    responseBytes: issuerResponseBytes,
    signerRole: "issuer"
  });
  const subjectRoleResponse = createRoleResponse({
    endpointOrigin: subjectEndpoint.origin,
    identity: subjectIdentity,
    responseBytes: subjectResponseBytes,
    signerRole: "subject"
  });
  return finalizePlacementAdmissionCeremonyBundle({
    evaluated_at_ms: evaluatedAt,
    issuer_response_bytes: issuerRoleResponse,
    request_bytes: request.bytes,
    subject_response_bytes: subjectRoleResponse
  });
}
