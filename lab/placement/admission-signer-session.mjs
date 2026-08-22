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
  createPlacementAdmissionTrustRoot,
  preparePlacementAdmissionEvidence
} from "../../src/placement/admission.mjs";
import {
  freeze,
  createMap,
  mapGet,
  mapSet,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  normalizePlacementAdmissionCeremonyEndpointOrigin,
  verifyPlacementAdmissionCeremonySignerBinding
} from "./admission-ceremony-binding.mjs";

const REQUEST_FORMAT = "mortalos-placement-admission-signing-request/1";
const RESPONSE_FORMAT = "mortalos-placement-admission-signature/1";
const POSSESSION_CHALLENGE_FORMAT =
  "mortalos-placement-admission-deployment-possession-challenge/1";
const POSSESSION_PROOF_FORMAT =
  "mortalos-placement-admission-deployment-possession-proof/1";
const SLOT_DOMAIN = "MortalOS placement admission signing slot v1";
const POLICY_DOMAIN = "MortalOS placement admission signer policy v1";
const POSSESSION_EXPORTER_DOMAIN =
  "MortalOS placement admission deployment TLS exporter v1";
const POSSESSION_PROOF_ID_DOMAIN =
  "MortalOS placement admission deployment possession proof v1";
const POSSESSION_PROOF_SIGNATURE_DOMAIN =
  "MortalOS placement admission deployment possession proof signature v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const SIGNATURE = /^ed25519:[A-Za-z0-9_-]{86}$/u;
const ROLES = freeze(["issuer", "subject"]);
const mapDeleteIntrinsic = Map.prototype.delete;
const promiseConstructor = Promise;
const promiseResolveIntrinsic = Promise.resolve;
const promiseThenIntrinsic = Promise.prototype.then;
const reflectApply = Reflect.apply;

export const PLACEMENT_ADMISSION_SIGNER_FORMATS = freeze({
  deployment_possession_challenge: POSSESSION_CHALLENGE_FORMAT,
  deployment_possession_proof: POSSESSION_PROOF_FORMAT,
  request: REQUEST_FORMAT,
  response: RESPONSE_FORMAT
});

export const PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER = freeze({
  bytes: 32,
  label: "EXPORTER-MortalOS-placement-admission-deployment-v1"
});

export function derivePlacementAdmissionDeploymentTlsExporterDigest(source) {
  requireRealm();
  if (
    isSharedByteView(source) ||
    byteLengthOfBytes(source) !==
      PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.bytes
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-tls-exporter");
  return domainHash(POSSESSION_EXPORTER_DOMAIN, new Uint8Array(source));
}

export const PLACEMENT_ADMISSION_SIGNER_LIMITS = freeze({
  deployment_possession_challenge_bytes: 4096,
  deployment_possession_proof_bytes: 8192,
  request_bytes: PLACEMENT_ADMISSION_LIMITS.document_bytes
});

export class PlacementAdmissionSignerSessionError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionSignerSessionError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionSignerSessionError(code, detail);
}

function normalizedSigningFailure(error) {
  if (error?.code === "E_CONTINUITY_EQUIVOCATION") {
    return new PlacementAdmissionSignerSessionError(
      "E_PLACEMENT_ADMISSION_SIGNER_EQUIVOCATION",
      "durable-challenge-slot-conflict"
    );
  }
  return error;
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-keys`);
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function ownedBytes(value, label) {
  const length = byteLengthOfBytes(value);
  if (
    length === null ||
    length < 1 ||
    length > PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes ||
    isSharedByteView(value)
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", label);
  return new Uint8Array(value);
}

function parseCanonical(source, label) {
  const bytes = ownedBytes(source, label);
  let value;
  try {
    value = parseJsonBytes(bytes, {
      maxBytes: PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes,
      maxDepth: 32
    });
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function role(value) {
  if (value !== ROLES[0] && value !== ROLES[1]) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_ROLE", "role");
  }
  return value;
}

function normalizedPossessionChallengeValue(source, label) {
  const value = exactRecord(source, [
    "ceremony_bundle_id",
    "endpoint_origin",
    "format",
    "key_id",
    "observed_at_ms",
    "observer_nonce_base64url",
    "role"
  ], label);
  if (
    value.format !== POSSESSION_CHALLENGE_FORMAT ||
    typeof value.ceremony_bundle_id !== "string" ||
    !DIGEST.test(value.ceremony_bundle_id) ||
    typeof value.key_id !== "string" ||
    !KEY_ID.test(value.key_id) ||
    !numberIsSafeInteger(value.observed_at_ms) ||
    value.observed_at_ms < 0
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", label);
  const nonce = decodeBase64Url(value.observer_nonce_base64url);
  if (nonce === null || nonce.byteLength !== 32) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", `${label}-nonce`);
  }
  const endpointOrigin = normalizedEndpointOrigin(value.endpoint_origin);
  if (endpointOrigin === null) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT", `${label}-origin`);
  }
  return freeze({
    ceremony_bundle_id: value.ceremony_bundle_id,
    endpoint_origin: endpointOrigin,
    format: POSSESSION_CHALLENGE_FORMAT,
    key_id: value.key_id,
    observed_at_ms: value.observed_at_ms,
    observer_nonce_base64url: value.observer_nonce_base64url,
    role: role(value.role)
  });
}

function restorePossessionChallenge(source) {
  const parsed = parseCanonical(source, "deployment-possession-challenge");
  if (parsed.bytes.byteLength >
    PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_challenge_bytes) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-challenge");
  }
  const value = normalizedPossessionChallengeValue(
    parsed.value,
    "deployment-possession-challenge"
  );
  return freeze({ bytes: parsed.bytes, value });
}

function possessionProofContent(challenge, tlsExporterDigest) {
  return freeze({
    ceremony_bundle_id: challenge.ceremony_bundle_id,
    endpoint_origin: challenge.endpoint_origin,
    format: POSSESSION_PROOF_FORMAT,
    key_id: challenge.key_id,
    observed_at_ms: challenge.observed_at_ms,
    observer_nonce_base64url: challenge.observer_nonce_base64url,
    role: challenge.role,
    tls_exporter_sha256: tlsExporterDigest
  });
}

function possessionProofSigningMessage(proofId) {
  return canonicalBytes({
    format: POSSESSION_PROOF_FORMAT,
    proof_id: proofId,
    signature_domain: POSSESSION_PROOF_SIGNATURE_DOMAIN
  });
}

export function createPlacementAdmissionDeploymentPossessionChallenge(options) {
  requireRealm();
  const source = exactRecord(options, [
    "ceremony_bundle_id",
    "endpoint_origin",
    "key_id",
    "observed_at_ms",
    "observer_nonce",
    "role"
  ], "deployment-possession-challenge-options");
  if (isSharedByteView(source.observer_nonce)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-observer-nonce");
  }
  const nonceLength = byteLengthOfBytes(source.observer_nonce);
  if (nonceLength !== 32) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "deployment-possession-observer-nonce");
  }
  const value = normalizedPossessionChallengeValue({
    ceremony_bundle_id: source.ceremony_bundle_id,
    endpoint_origin: source.endpoint_origin,
    format: POSSESSION_CHALLENGE_FORMAT,
    key_id: source.key_id,
    observed_at_ms: source.observed_at_ms,
    observer_nonce_base64url: encodeBase64Url(new Uint8Array(source.observer_nonce)),
    role: source.role
  }, "deployment-possession-challenge");
  const bytes = canonicalBytes(value);
  if (bytes.byteLength >
    PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_challenge_bytes) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-challenge");
  }
  return bytes;
}

export function restorePlacementAdmissionDeploymentPossessionProof(source) {
  requireRealm();
  const parsed = parseCanonical(source, "deployment-possession-proof");
  if (parsed.bytes.byteLength >
    PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_proof_bytes) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-proof");
  }
  const value = exactRecord(parsed.value, [
    "ceremony_bundle_id",
    "endpoint_origin",
    "format",
    "key_id",
    "observed_at_ms",
    "observer_nonce_base64url",
    "proof_id",
    "role",
    "signature",
    "tls_exporter_sha256"
  ], "deployment-possession-proof");
  if (
    value.format !== POSSESSION_PROOF_FORMAT ||
    typeof value.proof_id !== "string" || !DIGEST.test(value.proof_id) ||
    typeof value.signature !== "string" || !SIGNATURE.test(value.signature) ||
    typeof value.tls_exporter_sha256 !== "string" ||
    !DIGEST.test(value.tls_exporter_sha256)
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "deployment-possession-proof");
  const challenge = normalizedPossessionChallengeValue({
    ceremony_bundle_id: value.ceremony_bundle_id,
    endpoint_origin: value.endpoint_origin,
    format: POSSESSION_CHALLENGE_FORMAT,
    key_id: value.key_id,
    observed_at_ms: value.observed_at_ms,
    observer_nonce_base64url: value.observer_nonce_base64url,
    role: value.role
  }, "deployment-possession-proof-challenge");
  const content = possessionProofContent(challenge, value.tls_exporter_sha256);
  const proofId = domainHash(POSSESSION_PROOF_ID_DOMAIN, canonicalBytes(content));
  if (value.proof_id !== proofId) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "deployment-possession-proof-id");
  }
  return freeze({
    ...content,
    bytes: parsed.bytes,
    proof_id: proofId,
    signature: value.signature,
    signing_message: possessionProofSigningMessage(proofId)
  });
}

function sameIdentity(left, right) {
  return left.key_id === right.key_id && left.public_key === right.public_key;
}

function sameCanonical(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

function normalizedTrustRoot(source) {
  const root = exactRecord(source, [
    "authority_id",
    "issuer",
    "lineage_organism_id",
    "policy_digest",
    "prior_trust_root_id",
    "scope_digest",
    "sequence",
    "trust_root_id",
    "valid_from_ms",
    "valid_until_ms"
  ], "signer-trust-root");
  const normalized = createPlacementAdmissionTrustRoot({
    authority_id: root.authority_id,
    issuer: root.issuer,
    lineage_organism_id: root.lineage_organism_id,
    policy_digest: root.policy_digest,
    prior_trust_root_id: root.prior_trust_root_id,
    scope_digest: root.scope_digest,
    sequence: root.sequence,
    valid_from_ms: root.valid_from_ms,
    valid_until_ms: root.valid_until_ms
  });
  if (normalized.trust_root_id !== root.trust_root_id) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_ROOT", "trust-root-id");
  }
  return normalized;
}

function normalizedPolicy(source) {
  const policy = exactRecord(source, [
    "attestation_kind",
    "failure_domain_id",
    "operator_root_id",
    "roles"
  ], "signer-policy");
  let detached;
  try {
    detached = parseJsonBytes(canonicalBytes(policy), { maxBytes: 4096, maxDepth: 8 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_POLICY", "policy-format");
  }
  return freeze(detached);
}

function normalizedEndpointOrigin(source) {
  if (source === null) return null;
  try {
    return normalizePlacementAdmissionCeremonyEndpointOrigin(source, "configured-signer-endpoint");
  } catch (error) {
    fail(
      "E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT",
      error?.detail ?? "configured-signer-endpoint"
    );
  }
}

export function derivePlacementAdmissionSignerPolicyDigest(policySource) {
  requireRealm();
  return domainHash(POLICY_DOMAIN, canonicalBytes(normalizedPolicy(policySource)));
}

function admissionInputBody(body) {
  return freeze({
    attestation_challenge_base64url: body.attestation_challenge_base64url,
    attestation_kind: body.attestation_kind,
    failure_domain_id: body.failure_domain_id,
    issued_at_ms: body.issued_at_ms,
    operator_root_id: body.operator_root_id,
    roles: body.roles,
    subject: body.subject,
    valid_from_ms: body.valid_from_ms,
    valid_until_ms: body.valid_until_ms
  });
}

function restoreRequest(source) {
  const parsed = parseCanonical(source, "signing-request");
  const envelope = exactRecord(parsed.value, ["body", "format", "trust_root"], "signing-request");
  if (envelope.format !== REQUEST_FORMAT) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "signing-request-format");
  }
  const prepared = preparePlacementAdmissionEvidence({
    body: envelope.body,
    trust_root: envelope.trust_root
  });
  return freeze({
    body: prepared.body,
    bytes: parsed.bytes,
    evidence_id: prepared.evidence_id,
    issuer_signing_message: prepared.issuer_signing_message,
    subject_signing_message: prepared.subject_signing_message,
    trust_root: envelope.trust_root
  });
}

export function createPlacementAdmissionSigningRequest(options) {
  requireRealm();
  const source = exactRecord(options, ["body", "trust_root"], "signing-request-options");
  const prepared = preparePlacementAdmissionEvidence({
    body: source.body,
    trust_root: source.trust_root
  });
  const bytes = canonicalBytes({
    body: admissionInputBody(prepared.body),
    format: REQUEST_FORMAT,
    trust_root: source.trust_root
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "signing-request");
  }
  return bytes;
}

export function restorePlacementAdmissionSigningRequest(source) {
  requireRealm();
  const restored = restoreRequest(source);
  return freeze({
    body: restored.body,
    bytes: new Uint8Array(restored.bytes),
    evidence_id: restored.evidence_id,
    trust_root: restored.trust_root
  });
}

export function restorePlacementAdmissionSignatureResponse(source) {
  requireRealm();
  const parsed = parseCanonical(source, "signature-response");
  const value = exactRecord(
    parsed.value,
    ["evidence_id", "format", "key_id", "role", "signature", "slot_id"],
    "signature-response"
  );
  if (value.format !== RESPONSE_FORMAT) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "signature-response-format");
  }
  if (!DIGEST.test(value.evidence_id) || !DIGEST.test(value.slot_id)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "signature-response-id");
  }
  if (!KEY_ID.test(value.key_id) || !SIGNATURE.test(value.signature)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_FORMAT", "signature-response-signature");
  }
  return freeze({
    bytes: parsed.bytes,
    evidence_id: value.evidence_id,
    key_id: value.key_id,
    role: role(value.role),
    signature: value.signature,
    slot_id: value.slot_id
  });
}

export class PlacementAdmissionSignerSession {
  #endpointOrigin;
  #identity;
  #pending;
  #policy;
  #role;
  #sign;
  #trustRoot;

  constructor(options) {
    requireRealm();
    const source = exactRecord(
      options,
      ["endpoint_origin", "policy", "role", "signer", "trust_root"],
      "signer-session-options"
    );
    const signer = exactRecord(source.signer, ["destroy", "identity", "sign"], "signer-capability");
    const identity = exactRecord(signer.identity, ["key_id", "public_key"], "signer-identity");
    if (!KEY_ID.test(identity.key_id) || typeof identity.public_key !== "string") {
      fail("E_PLACEMENT_ADMISSION_SIGNER_IDENTITY", "signer-identity");
    }
    this.#endpointOrigin = normalizedEndpointOrigin(source.endpoint_origin);
    this.#identity = freeze({ key_id: identity.key_id, public_key: identity.public_key });
    this.#pending = createMap();
    this.#policy = normalizedPolicy(source.policy);
    this.#role = role(source.role);
    this.#trustRoot = normalizedTrustRoot(source.trust_root);
    if (
      this.#trustRoot.policy_digest !==
      domainHash(POLICY_DOMAIN, canonicalBytes(this.#policy))
    ) fail("E_PLACEMENT_ADMISSION_SIGNER_POLICY", "trust-root-policy-digest");
    if (this.#role === "issuer" && !sameIdentity(this.#identity, this.#trustRoot.issuer)) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_IDENTITY", "configured-issuer-identity");
    }
    try {
      this.#sign = snapshotDataMethod(source.signer, "sign", "placement-admission-signer");
    } catch {
      fail("E_PLACEMENT_ADMISSION_SIGNER_CAPABILITY", "signer-sign");
    }
    freeze(this);
  }

  get identity() {
    return this.#identity;
  }

  get role() {
    return this.#role;
  }

  async signDeploymentPossession(challengeSource, tlsExporterSource) {
    requireRealm();
    const challenge = restorePossessionChallenge(challengeSource).value;
    if (
      isSharedByteView(tlsExporterSource) ||
      byteLengthOfBytes(tlsExporterSource) !==
        PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.bytes
    ) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-tls-exporter");
    }
    const tlsExporter = new Uint8Array(tlsExporterSource);
    const signerIdentity = this.#identity;
    const signerRole = this.#role;
    const endpointOrigin = this.#endpointOrigin;
    if (
      endpointOrigin === null ||
      challenge.endpoint_origin !== endpointOrigin ||
      challenge.key_id !== signerIdentity.key_id ||
      challenge.role !== signerRole
    ) fail("E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT", "deployment-possession-binding");
    const content = possessionProofContent(
      challenge,
      derivePlacementAdmissionDeploymentTlsExporterDigest(tlsExporter)
    );
    const proofId = domainHash(POSSESSION_PROOF_ID_DOMAIN, canonicalBytes(content));
    let signature;
    try {
      const signatureResult = this.#sign(freeze({
        message: possessionProofSigningMessage(proofId),
        tuple: `placement.admission.deployment-possession.${signerRole}.${proofId.slice("sha256:".length)}`
      }));
      signature = await reflectApply(
        promiseResolveIntrinsic,
        promiseConstructor,
        [signatureResult]
      );
    } catch (error) {
      throw normalizedSigningFailure(error);
    }
    requireRealm();
    const bytes = canonicalBytes({
      ...content,
      proof_id: proofId,
      signature
    });
    if (bytes.byteLength > PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_proof_bytes) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_LIMIT", "deployment-possession-proof");
    }
    return bytes;
  }

  async signAdmissionRequest(requestSource) {
    requireRealm();
    const requestBytes = ownedBytes(requestSource, "signing-request");
    const restored = restoreRequest(requestBytes);
    const signerIdentity = this.#identity;
    if (!sameCanonical(restored.trust_root, this.#trustRoot)) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_ROOT", "unconfigured-trust-root");
    }
    if (
      restored.body.attestation_kind !== this.#policy.attestation_kind ||
      restored.body.failure_domain_id !== this.#policy.failure_domain_id ||
      restored.body.operator_root_id !== this.#policy.operator_root_id ||
      !sameCanonical(restored.body.roles, this.#policy.roles)
    ) fail("E_PLACEMENT_ADMISSION_SIGNER_POLICY", "unconfigured-admission-policy");
    const expectedIdentity = this.#role === "issuer"
      ? restored.trust_root.issuer
      : restored.body.subject;
    if (!sameIdentity(signerIdentity, expectedIdentity)) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_IDENTITY", `${this.#role}-identity`);
    }
    if (this.#endpointOrigin !== null) {
      try {
        verifyPlacementAdmissionCeremonySignerBinding({
          attestation_challenge_base64url: restored.body.attestation_challenge_base64url,
          endpoint_origin: this.#endpointOrigin,
          issuer_identity: restored.trust_root.issuer,
          role: this.#role,
          subject_identity: restored.body.subject
        });
      } catch (error) {
        fail(
          "E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT",
          error?.detail ?? `${this.#role}-configured-origin`
        );
      }
    }
    const slotId = domainHash(SLOT_DOMAIN, canonicalBytes({
      attestation_challenge_base64url: restored.body.attestation_challenge_base64url,
      role: this.#role,
      subject_key_id: restored.body.subject.key_id,
      trust_root_id: restored.body.trust_root_id
    }));
    const prior = mapGet(this.#pending, slotId);
    if (prior) {
      if (prior.evidenceId !== restored.evidence_id) {
        fail("E_PLACEMENT_ADMISSION_SIGNER_EQUIVOCATION", "challenge-slot-conflict");
      }
      return new Uint8Array(await prior.responsePromise);
    }
    const signingMessage = this.#role === "issuer"
      ? restored.issuer_signing_message
      : restored.subject_signing_message;
    let resolveResponse;
    let rejectResponse;
    const responsePromise = new promiseConstructor((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    const entry = {
      evidenceId: restored.evidence_id,
      responsePromise
    };
    mapSet(this.#pending, slotId, entry);
    const reject = (error) => {
      reflectApply(mapDeleteIntrinsic, this.#pending, [slotId]);
      rejectResponse(normalizedSigningFailure(error));
    };
    try {
      const signatureResult = this.#sign(freeze({
        message: new Uint8Array(signingMessage),
        tuple: `placement.admission.${this.#role}.${slotId.slice("sha256:".length)}`
      }));
      const normalized = reflectApply(promiseResolveIntrinsic, promiseConstructor, [signatureResult]);
      reflectApply(promiseThenIntrinsic, normalized, [(signature) => resolveResponse(canonicalBytes({
        evidence_id: restored.evidence_id,
        format: RESPONSE_FORMAT,
        key_id: signerIdentity.key_id,
        role: this.#role,
        signature,
        slot_id: slotId
      })), reject]);
    } catch (error) {
      reject(error);
    }
    return new Uint8Array(await entry.responsePromise);
  }
}

export function createPlacementAdmissionSignerSession(options) {
  return new PlacementAdmissionSignerSession(options);
}
