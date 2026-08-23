import {
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  isSharedByteView,
  utf8Bytes
} from "../bytes.mjs";
import { verifyContinuityCapsule } from "../capsule.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../codec.mjs";
import { domainHash } from "../confidential/format.mjs";
import {
  custodyCommitment,
  derivePeerId,
  derivePulseHash,
  verifyEd25519
} from "../crypto.mjs";
import { PROTOCOL_PROFILE } from "../generated/protocol-profile.mjs";
import {
  copyOwnDataArray,
  createMap,
  createSet,
  mapGet,
  mapHas,
  mapKeys,
  mapSet,
  mapSize,
  mapValues,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  setAdd,
  setHas,
  setSize,
  setValues,
  snapshotOwnDataRecord
} from "../primordials.mjs";

export const PLACEMENT_ADMISSION_FORMATS = Object.freeze({
  evidence: "mortalos-placement-admission-evidence/1",
  epoch: "mortalos-placement-membership-epoch/1"
});

export const PLACEMENT_ADMISSION_LIMITS = PROTOCOL_PROFILE.placement_admission;

const DOMAINS = Object.freeze({
  evidence: "MortalOS placement admission evidence v1",
  evidenceIssuerSignature: "MortalOS placement admission evidence issuer signature v1\0",
  evidenceSubjectSignature: "MortalOS placement admission evidence subject signature v1\0",
  epoch: "MortalOS placement membership epoch v1",
  epochSignature: "MortalOS placement membership epoch signature v1\0",
  roster: "MortalOS placement admitted observer roster v1",
  rosterScore: "MortalOS placement admitted observer roster score v1",
  trustRoot: "MortalOS placement admission trust root v1"
});

const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const ORGANISM_ID = /^mortalos:[A-Za-z0-9_-]{43}$/u;
const PEER_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const PUBLIC_KEY = /^ed25519:[A-Za-z0-9_-]{43}$/u;
const WORKLOAD_ID = /^resource-workload:[A-Za-z0-9_-]{43}$/u;
const ROLE_VALUES = Object.freeze(["observer", "provider"]);
const ATTESTATION_KIND_VALUES = Object.freeze(["operator-domain-membership"]);

export class PlacementAdmissionError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionError(code, detail);
}

function assertRealm() {
  if (!realmIntrinsicsIntact()) fail("E_PLACEMENT_ADMISSION_RUNTIME", "realm-integrity");
  if (
    !Number.isSafeInteger(PLACEMENT_ADMISSION_LIMITS.observer_roster_max) ||
    PLACEMENT_ADMISSION_LIMITS.observer_roster_max < 1 ||
    PLACEMENT_ADMISSION_LIMITS.observer_roster_max !==
      PROTOCOL_PROFILE.placement_liveness.witnesses_per_policy ||
    PLACEMENT_ADMISSION_LIMITS.observer_roster_max !==
      PROTOCOL_PROFILE.resource_contract.witnesses_per_offer_max
  ) fail("E_PLACEMENT_ADMISSION_PROFILE", "observer-ceiling-drift");
}

function exactKeys(value, expected, label) {
  assertRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-ordinary-own-data`);
  }
  assertRealm();
  const actual = ownKeys(descriptors);
  if (actual.some((key) => typeof key !== "string")) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-keys`);
  }
  actual.sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-keys`);
  }
  const snapshot = {};
  for (const key of expected) {
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-keys`);
    snapshot[key] = entry.value;
  }
  return Object.freeze(snapshot);
}

function ownedBytes(value, label) {
  if (isSharedByteView(value)) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > PLACEMENT_ADMISSION_LIMITS.document_bytes) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", label);
  }
  return new Uint8Array(value);
}

function parseCanonical(value, label) {
  const bytes = ownedBytes(value, label);
  let parsed;
  try {
    parsed = parseJsonBytes(bytes, {
      maxBytes: PLACEMENT_ADMISSION_LIMITS.document_bytes,
      maxDepth: 32
    });
  } catch {
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, parsed)) fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-canonical`);
  return Object.freeze({ bytes, value: parsed });
}

function decimal(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", label);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", label);
  }
  return parsed;
}

function digest(value, label) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    fail("E_PLACEMENT_ADMISSION_BINDING", label);
  }
  return value;
}

function organismId(value, label) {
  if (typeof value !== "string" || !ORGANISM_ID.test(value)) {
    fail("E_PLACEMENT_ADMISSION_BINDING", label);
  }
  return value;
}

function identity(value, label) {
  const source = exactKeys(value, ["key_id", "public_key"], label);
  if (
    typeof source.key_id !== "string" || !PEER_ID.test(source.key_id) ||
    typeof source.public_key !== "string" || !PUBLIC_KEY.test(source.public_key) ||
    derivePeerId(source.public_key) !== source.key_id
  ) fail("E_PLACEMENT_ADMISSION_IDENTITY", label);
  return Object.freeze({ key_id: source.key_id, public_key: source.public_key });
}

function roles(value, label) {
  let copied;
  try {
    copied = copyOwnDataArray(value, label);
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", label);
  }
  assertRealm();
  if (copied.length < 1 || copied.length > ROLE_VALUES.length) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", label);
  }
  copied.sort();
  let prior = null;
  for (const role of copied) {
    if (!ROLE_VALUES.includes(role) || role === prior) {
      fail("E_PLACEMENT_ADMISSION_POLICY", label);
    }
    prior = role;
  }
  return Object.freeze(copied);
}

function attestationChallenge(value) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_FORMAT", "attestation-challenge");
  }
  const bytes = decodeBase64Url(value);
  if (
    !bytes || bytes.byteLength < 16 ||
    bytes.byteLength > PLACEMENT_ADMISSION_LIMITS.attestation_challenge_bytes_max ||
    encodeBase64Url(bytes) !== value
  ) fail("E_PLACEMENT_ADMISSION_LIMIT", "attestation-challenge");
  return value;
}

function digestList(value, label, maximum) {
  let copied;
  try {
    copied = copyOwnDataArray(value, label);
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", label);
  }
  assertRealm();
  if (copied.length > maximum) fail("E_PLACEMENT_ADMISSION_LIMIT", label);
  copied.sort();
  let prior = null;
  for (const entry of copied) {
    digest(entry, label);
    if (entry === prior) fail("E_PLACEMENT_ADMISSION_POLICY", `${label}-duplicate`);
    prior = entry;
  }
  return Object.freeze(copied);
}

function trustRootHistory(value) {
  let copied;
  try {
    copied = copyOwnDataArray(value, "trust-root-history");
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", "trust-root-history");
  }
  assertRealm();
  if (copied.length > PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", "trust-root-history");
  }
  const entries = copied.map((value, index) => {
    const source = exactKeys(value, [
      "authority_id",
      "issuer_key_id",
      "sequence",
      "trust_root_id"
    ], `trust-root-history-${index}`);
    const sequence = decimal(
      source.sequence,
      "trust-root-history-sequence",
      1,
      PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max
    );
    return Object.freeze({
      authority_id: digest(source.authority_id, "trust-root-history-authority"),
      issuer_key_id: typeof source.issuer_key_id === "string" && PEER_ID.test(source.issuer_key_id)
        ? source.issuer_key_id
        : fail("E_PLACEMENT_ADMISSION_IDENTITY", "trust-root-history-issuer"),
      sequence: String(sequence),
      trust_root_id: digest(source.trust_root_id, "trust-root-history-id")
    });
  });
  entries.sort((left, right) => left.trust_root_id < right.trust_root_id ? -1 : 1);
  let prior = null;
  for (const entry of entries) {
    if (entry.trust_root_id === prior) {
      fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "duplicate-root-history");
    }
    prior = entry.trust_root_id;
  }
  return Object.freeze(entries);
}

function trustRootHistoryEntry(root) {
  return Object.freeze({
    authority_id: root.authority_id,
    issuer_key_id: root.issuer.key_id,
    sequence: root.sequence,
    trust_root_id: root.trust_root_id
  });
}

function idMessage(domain, identifier) {
  digest(identifier, "identifier");
  const raw = decodeBase64Url(identifier.slice("sha256:".length));
  if (!raw || raw.byteLength !== 32) fail("E_PLACEMENT_ADMISSION_BINDING", "identifier");
  return concatBytes(utf8Bytes(domain), raw);
}

function sameCanonicalValue(left, right) {
  const leftBytes = canonicalBytes(left);
  const rightBytes = canonicalBytes(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

function trustRoot(value) {
  const source = exactKeys(value, [
    "authority_id",
    "issuer",
    "lineage_organism_id",
    "policy_digest",
    "prior_trust_root_id",
    "sequence",
    "scope_digest",
    "trust_root_id",
    "valid_from_ms",
    "valid_until_ms"
  ], "trust-root");
  const basis = Object.freeze({
    authority_id: digest(source.authority_id, "trust-root-authority"),
    issuer: identity(source.issuer, "trust-root-issuer"),
    lineage_organism_id: organismId(source.lineage_organism_id, "trust-root-organism"),
    policy_digest: digest(source.policy_digest, "trust-root-policy"),
    prior_trust_root_id: source.prior_trust_root_id,
    sequence: source.sequence,
    scope_digest: digest(source.scope_digest, "trust-root-scope"),
    valid_from_ms: source.valid_from_ms,
    valid_until_ms: source.valid_until_ms
  });
  const sequence = decimal(
    basis.sequence,
    "trust-root-sequence",
    1,
    PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max
  );
  if (
    sequence === 1
      ? basis.prior_trust_root_id !== null
      : typeof basis.prior_trust_root_id !== "string" ||
        !DIGEST.test(basis.prior_trust_root_id)
  ) fail("E_PLACEMENT_ADMISSION_BINDING", "trust-root-prior");
  const validFrom = decimal(basis.valid_from_ms, "trust-root-valid-from");
  const validUntil = decimal(basis.valid_until_ms, "trust-root-valid-until", validFrom + 1);
  if (validUntil - validFrom > Number(PLACEMENT_ADMISSION_LIMITS.validity_ms_max)) {
    fail("E_PLACEMENT_ADMISSION_TIME", "trust-root-validity");
  }
  const rootId = domainHash(DOMAINS.trustRoot, canonicalBytes(basis));
  if (source.trust_root_id !== rootId) {
    fail("E_PLACEMENT_ADMISSION_BINDING", "trust-root-id");
  }
  return Object.freeze({ ...basis, trust_root_id: rootId });
}

export function createPlacementAdmissionTrustRoot(body) {
  assertRealm();
  const source = exactKeys(body, [
    "authority_id",
    "issuer",
    "lineage_organism_id",
    "policy_digest",
    "prior_trust_root_id",
    "sequence",
    "scope_digest",
    "valid_from_ms",
    "valid_until_ms"
  ], "trust-root-body");
  const basis = Object.freeze({
    authority_id: digest(source.authority_id, "trust-root-authority"),
    issuer: identity(source.issuer, "trust-root-issuer"),
    lineage_organism_id: organismId(source.lineage_organism_id, "trust-root-organism"),
    policy_digest: digest(source.policy_digest, "trust-root-policy"),
    prior_trust_root_id: source.prior_trust_root_id,
    sequence: source.sequence,
    scope_digest: digest(source.scope_digest, "trust-root-scope"),
    valid_from_ms: source.valid_from_ms,
    valid_until_ms: source.valid_until_ms
  });
  const sequence = decimal(
    basis.sequence,
    "trust-root-sequence",
    1,
    PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max
  );
  if (
    sequence === 1
      ? basis.prior_trust_root_id !== null
      : typeof basis.prior_trust_root_id !== "string" ||
        !DIGEST.test(basis.prior_trust_root_id)
  ) fail("E_PLACEMENT_ADMISSION_BINDING", "trust-root-prior");
  const validFrom = decimal(basis.valid_from_ms, "trust-root-valid-from");
  const validUntil = decimal(basis.valid_until_ms, "trust-root-valid-until", validFrom + 1);
  if (validUntil - validFrom > Number(PLACEMENT_ADMISSION_LIMITS.validity_ms_max)) {
    fail("E_PLACEMENT_ADMISSION_TIME", "trust-root-validity");
  }
  return trustRoot(Object.freeze({
    ...basis,
    trust_root_id: domainHash(DOMAINS.trustRoot, canonicalBytes(basis))
  }));
}

function evidenceDraft(rootSource, bodySource) {
  const root = trustRoot(rootSource);
  const source = exactKeys(bodySource, [
    "attestation_challenge_base64url",
    "attestation_kind",
    "failure_domain_id",
    "issued_at_ms",
    "operator_root_id",
    "roles",
    "subject",
    "valid_from_ms",
    "valid_until_ms"
  ], "admission-evidence-body-input");
  if (!ATTESTATION_KIND_VALUES.includes(source.attestation_kind)) {
    fail("E_PLACEMENT_ADMISSION_POLICY", "attestation-kind");
  }
  const subject = identity(source.subject, "admission-subject");
  if (subject.key_id === root.issuer.key_id) {
    fail("E_PLACEMENT_ADMISSION_IDENTITY", "issuer-subject-role-overlap");
  }
  const body = Object.freeze({
    attestation_challenge_base64url: attestationChallenge(
      source.attestation_challenge_base64url
    ),
    attestation_kind: source.attestation_kind,
    failure_domain_id: digest(source.failure_domain_id, "admission-failure-domain"),
    issued_at_ms: source.issued_at_ms,
    lineage_organism_id: root.lineage_organism_id,
    operator_root_id: digest(source.operator_root_id, "admission-operator-root"),
    policy_digest: root.policy_digest,
    roles: roles(source.roles, "admission-roles"),
    scope_digest: root.scope_digest,
    subject,
    trust_root_id: root.trust_root_id,
    valid_from_ms: source.valid_from_ms,
    valid_until_ms: source.valid_until_ms
  });
  const validFrom = decimal(body.valid_from_ms, "admission-valid-from");
  const validUntil = decimal(body.valid_until_ms, "admission-valid-until", validFrom + 1);
  const issuedAt = decimal(body.issued_at_ms, "admission-issued-at");
  const rootFrom = decimal(root.valid_from_ms, "trust-root-valid-from");
  const rootUntil = decimal(root.valid_until_ms, "trust-root-valid-until");
  if (
    issuedAt < validFrom || issuedAt > validUntil ||
    validFrom < rootFrom || validUntil > rootUntil ||
    validUntil - validFrom > Number(PLACEMENT_ADMISSION_LIMITS.validity_ms_max)
  ) fail("E_PLACEMENT_ADMISSION_TIME", "evidence-outside-root-validity");
  const evidenceId = domainHash(DOMAINS.evidence, canonicalBytes(body));
  return Object.freeze({
    body,
    evidenceId,
    root,
    issuerSigningMessage: idMessage(DOMAINS.evidenceIssuerSignature, evidenceId),
    subjectSigningMessage: idMessage(DOMAINS.evidenceSubjectSignature, evidenceId)
  });
}

function evidenceDraftFromEnvelope(value, rootSource) {
  const body = exactKeys(value.body, [
    "attestation_challenge_base64url",
    "attestation_kind",
    "failure_domain_id",
    "issued_at_ms",
    "lineage_organism_id",
    "operator_root_id",
    "policy_digest",
    "roles",
    "scope_digest",
    "subject",
    "trust_root_id",
    "valid_from_ms",
    "valid_until_ms"
  ], "admission-evidence-body");
  const root = trustRoot(rootSource);
  const draft = evidenceDraft(root, {
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
  if (!sameCanonicalValue(body, draft.body)) {
    fail("E_PLACEMENT_ADMISSION_BINDING", "evidence-root-scope");
  }
  return draft;
}

export function preparePlacementAdmissionEvidence(options) {
  assertRealm();
  const source = exactKeys(options, ["body", "trust_root"], "evidence-options");
  const draft = evidenceDraft(source.trust_root, source.body);
  return Object.freeze({
    body: draft.body,
    evidence_id: draft.evidenceId,
    issuer_signing_message: new Uint8Array(draft.issuerSigningMessage),
    subject_signing_message: new Uint8Array(draft.subjectSigningMessage)
  });
}

export function finalizePlacementAdmissionEvidence(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["body", "issuer_signature", "subject_signature", "trust_root"],
    "evidence-finalize-options"
  );
  const draft = evidenceDraftFromEnvelope({ body: source.body }, source.trust_root);
  const bytes = canonicalBytes({
    body: draft.body,
    evidence_id: draft.evidenceId,
    format: PLACEMENT_ADMISSION_FORMATS.evidence,
    issuer_signature: source.issuer_signature,
    subject_signature: source.subject_signature
  });
  restoreEvidence(bytes, draft.root);
  return bytes;
}

function restoreEvidence(evidenceSource, rootSource) {
  const root = trustRoot(rootSource);
  const parsed = parseCanonical(evidenceSource, "admission-evidence");
  const value = exactKeys(parsed.value, [
    "body",
    "evidence_id",
    "format",
    "issuer_signature",
    "subject_signature"
  ], "admission-evidence");
  if (value.format !== PLACEMENT_ADMISSION_FORMATS.evidence) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", "evidence-format");
  }
  const draft = evidenceDraftFromEnvelope(value, root);
  if (value.evidence_id !== draft.evidenceId) {
    fail("E_PLACEMENT_ADMISSION_BINDING", "evidence-id");
  }
  if (!verifyEd25519(
    root.issuer.public_key,
    draft.issuerSigningMessage,
    value.issuer_signature
  )) {
    fail("E_PLACEMENT_ADMISSION_SIGNATURE", "evidence-issuer");
  }
  if (!verifyEd25519(
    draft.body.subject.public_key,
    draft.subjectSigningMessage,
    value.subject_signature
  )) fail("E_PLACEMENT_ADMISSION_SIGNATURE", "evidence-subject");
  return Object.freeze({
    body: draft.body,
    bytes: parsed.bytes,
    evidence_id: draft.evidenceId,
    status: "verified",
    trust_root: root
  });
}

export function verifyPlacementAdmissionEvidence(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["evaluated_at_ms", "evidence_bytes", "trust_root"],
    "evidence-verify-options"
  );
  const evidence = restoreEvidence(source.evidence_bytes, source.trust_root);
  const evaluatedAt = decimal(source.evaluated_at_ms, "evidence-evaluated-at");
  const validFrom = decimal(evidence.body.valid_from_ms, "admission-valid-from");
  const validUntil = decimal(evidence.body.valid_until_ms, "admission-valid-until");
  if (evaluatedAt < validFrom || evaluatedAt > validUntil) {
    fail("E_PLACEMENT_ADMISSION_TIME", "evidence-not-current");
  }
  return evidence;
}

function authorityDescriptor(value, label = "lineage-authority") {
  const source = exactKeys(value, ["custodians", "quorum"], label);
  let custodianSources;
  try {
    custodianSources = copyOwnDataArray(source.custodians, `${label}-custodians`);
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", `${label}-custodians`);
  }
  assertRealm();
  if (custodianSources.length < 1 || custodianSources.length > 16) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", `${label}-custodians`);
  }
  const custodians = custodianSources.map((entry, index) =>
    identity(entry, `${label}-custodian-${index}`));
  custodians.sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  for (let index = 1; index < custodians.length; index += 1) {
    if (custodians[index - 1].key_id === custodians[index].key_id) {
      fail("E_PLACEMENT_ADMISSION_IDENTITY", `${label}-duplicate-custodian`);
    }
  }
  const quorum = exactKeys(source.quorum, ["threshold", "type"], `${label}-quorum`);
  if (
    quorum.type !== "threshold" ||
    !Number.isSafeInteger(quorum.threshold) ||
    quorum.threshold < 1 || quorum.threshold > custodians.length ||
    2 * quorum.threshold <= custodians.length
  ) fail("E_PLACEMENT_ADMISSION_QUORUM", `${label}-quorum`);
  return Object.freeze({
    custodians: Object.freeze(custodians),
    quorum: Object.freeze({ threshold: quorum.threshold, type: "threshold" })
  });
}

function capsuleAuthority(capsuleSource) {
  if (isSharedByteView(capsuleSource)) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", "continuity-capsule-shared-memory");
  }
  const capsuleLength = byteLengthOfBytes(capsuleSource);
  if (
    capsuleLength === null || capsuleLength < 1 ||
    capsuleLength > PROTOCOL_PROFILE.provider.object_bytes
  ) fail("E_PLACEMENT_ADMISSION_LIMIT", "continuity-capsule");
  const bytes = new Uint8Array(capsuleSource);
  let verified;
  let capsuleDocument;
  try {
    verified = verifyContinuityCapsule(bytes);
    capsuleDocument = parseJsonBytes(bytes, {
      maxBytes: PROTOCOL_PROFILE.provider.object_bytes,
      maxDepth: 64
    });
  } catch (error) {
    fail("E_PLACEMENT_ADMISSION_LINEAGE", error?.code ?? "capsule-invalid");
  }
  const latestRecord = capsuleDocument.records[capsuleDocument.records.length - 1];
  const envelopeBytes = decodeBase64Url(latestRecord?.envelope_base64url);
  if (!envelopeBytes) fail("E_PLACEMENT_ADMISSION_LINEAGE", "capsule-head-envelope");
  const envelope = parseJsonBytes(envelopeBytes, { maxBytes: 1_048_576, maxDepth: 64 });
  const descriptor = authorityDescriptor({
    custodians: envelope.body.next_custodians,
    quorum: envelope.body.next_quorum
  });
  return Object.freeze({
    capsule_id: verified.capsule_id,
    descriptor,
    head_hash: verified.head_hash,
    organism_id: verified.organism_id
  });
}

function capsuleAuthorityAtHead(capsuleSource, headHash) {
  const current = capsuleAuthority(capsuleSource);
  const bytes = new Uint8Array(capsuleSource);
  const capsuleDocument = parseJsonBytes(bytes, {
    maxBytes: PROTOCOL_PROFILE.provider.object_bytes,
    maxDepth: 64
  });
  const matches = [];
  for (const record of capsuleDocument.records) {
    const envelopeBytes = decodeBase64Url(record.envelope_base64url);
    if (!envelopeBytes) continue;
    const envelope = parseJsonBytes(envelopeBytes, { maxBytes: 1_048_576, maxDepth: 64 });
    if (envelope.kind !== "mortalos.pulse" || derivePulseHash(envelope.body) !== headHash) continue;
    matches.push(authorityDescriptor({
      custodians: envelope.body.next_custodians,
      quorum: envelope.body.next_quorum
    }, "historical-lineage-authority"));
  }
  if (matches.length !== 1) {
    fail("E_PLACEMENT_ADMISSION_LINEAGE", "membership-head-not-authenticated");
  }
  return Object.freeze({
    descriptor: matches[0],
    organism_id: current.organism_id
  });
}

function observerPolicy(value) {
  const source = exactKeys(
    value,
    ["max_faulty", "roster_size", "threshold"],
    "admission-observer-policy"
  );
  if (
    !Number.isSafeInteger(source.max_faulty) || source.max_faulty < 0 ||
    !Number.isSafeInteger(source.roster_size) || source.roster_size < 1 ||
    source.roster_size > PLACEMENT_ADMISSION_LIMITS.observer_roster_max ||
    !Number.isSafeInteger(source.threshold) || source.threshold < 1 ||
    source.threshold > source.roster_size - source.max_faulty ||
    source.threshold <= source.max_faulty
  ) fail("E_PLACEMENT_ADMISSION_POLICY", "observer-quorum");
  return Object.freeze({
    max_faulty: source.max_faulty,
    roster_size: source.roster_size,
    threshold: source.threshold
  });
}

function normalizeRoots(rootSources, organism, evaluatedAt, expiresAt) {
  let copied;
  try {
    copied = copyOwnDataArray(rootSources, "epoch-trust-roots");
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", "epoch-trust-roots");
  }
  assertRealm();
  if (
    copied.length < 1 ||
    copied.length > PLACEMENT_ADMISSION_LIMITS.trust_roots_per_epoch_max
  ) fail("E_PLACEMENT_ADMISSION_LIMIT", "epoch-trust-roots");
  const roots = copied.map((entry) => trustRoot(entry));
  roots.sort((left, right) => left.trust_root_id < right.trust_root_id ? -1 : 1);
  const byId = createMap();
  const byAuthority = createMap();
  for (const root of roots) {
    if (
      mapHas(byId, root.trust_root_id) || root.lineage_organism_id !== organism ||
      mapHas(byAuthority, root.authority_id) ||
      evaluatedAt < decimal(root.valid_from_ms, "trust-root-valid-from") ||
      expiresAt > decimal(root.valid_until_ms, "trust-root-valid-until")
    ) fail("E_PLACEMENT_ADMISSION_POLICY", "epoch-trust-root-invalid");
    mapSet(byId, root.trust_root_id, root);
    mapSet(byAuthority, root.authority_id, root);
  }
  return Object.freeze({ byAuthority, byId, roots: Object.freeze(roots) });
}

function trustRootLifecycle(
  currentRoots,
  prior,
  revokedSource,
  claimedRetired = null,
  claimedHistory = null
) {
  const revoked = digestList(
    revokedSource,
    "epoch-revoked-trust-roots",
    PLACEMENT_ADMISSION_LIMITS.trust_roots_per_epoch_max
  );
  const revokedIds = createSet();
  for (const rootId of revoked) setAdd(revokedIds, rootId);
  const retired = prior
    ? [...prior.body.retired_trust_root_authority_ids]
    : [];
  const retiredIds = createSet();
  for (const authorityId of retired) setAdd(retiredIds, authorityId);
  const history = prior ? [...prior.body.trust_root_history] : [];
  const historyByRootId = createMap();
  for (const entry of history) mapSet(historyByRootId, entry.trust_root_id, entry);

  const currentByAuthority = createMap();
  for (const root of currentRoots) {
    if (
      mapHas(currentByAuthority, root.authority_id) ||
      setHas(retiredIds, root.authority_id)
    ) fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "trust-root-authority-reuse");
    mapSet(currentByAuthority, root.authority_id, root);
  }

  if (prior === null) {
    if (revoked.length !== 0) {
      fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "genesis-root-revocation");
    }
    for (const root of currentRoots) {
      if (root.sequence !== "1" || root.prior_trust_root_id !== null) {
        fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "genesis-root-sequence");
      }
      history.push(trustRootHistoryEntry(root));
      mapSet(historyByRootId, root.trust_root_id, trustRootHistoryEntry(root));
    }
  } else {
    const priorById = createMap();
    const priorByAuthority = createMap();
    for (const root of prior.trust_roots) {
      mapSet(priorById, root.trust_root_id, root);
      mapSet(priorByAuthority, root.authority_id, root);
    }
    for (const root of currentRoots) {
      const previous = mapGet(priorByAuthority, root.authority_id);
      if (!previous) {
        if (root.sequence !== "1" || root.prior_trust_root_id !== null) {
          fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "new-root-must-be-genesis");
        }
        history.push(trustRootHistoryEntry(root));
        mapSet(historyByRootId, root.trust_root_id, trustRootHistoryEntry(root));
        continue;
      }
      if (root.trust_root_id === previous.trust_root_id) continue;
      if (
        decimal(root.sequence, "trust-root-sequence", 1) !==
          decimal(previous.sequence, "prior-trust-root-sequence", 1) + 1 ||
        root.prior_trust_root_id !== previous.trust_root_id ||
        setHas(revokedIds, previous.trust_root_id)
      ) fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "trust-root-rotation");
      for (const entry of history) {
        if (
          entry.authority_id === root.authority_id &&
          entry.issuer_key_id === root.issuer.key_id &&
          entry.trust_root_id !== previous.trust_root_id
        ) fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "issuer-key-rollback");
      }
      if (mapHas(historyByRootId, root.trust_root_id)) {
        fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "trust-root-id-reuse");
      }
      history.push(trustRootHistoryEntry(root));
      mapSet(historyByRootId, root.trust_root_id, trustRootHistoryEntry(root));
    }
    for (const previous of prior.trust_roots) {
      const current = mapGet(currentByAuthority, previous.authority_id);
      if (current) continue;
      if (!setHas(revokedIds, previous.trust_root_id)) {
        fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "trust-root-removal-without-revocation");
      }
      setAdd(retiredIds, previous.authority_id);
    }
    for (const rootId of revoked) {
      const previous = mapGet(priorById, rootId);
      if (!previous || mapHas(currentByAuthority, previous.authority_id)) {
        fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "invalid-root-revocation");
      }
    }
  }

  const normalizedRetired = [...setValues(retiredIds)].sort();
  if (normalizedRetired.length > PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", "retired-trust-root-authorities");
  }
  if (claimedRetired !== null && !sameCanonicalValue(claimedRetired, normalizedRetired)) {
    fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "retired-trust-root-history");
  }
  const normalizedHistory = trustRootHistory(history);
  if (claimedHistory !== null && !sameCanonicalValue(claimedHistory, normalizedHistory)) {
    fail("E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE", "trust-root-history");
  }
  return Object.freeze({
    history: normalizedHistory,
    retired: Object.freeze(normalizedRetired),
    revoked
  });
}

function normalizeEvidence(evidenceSources, roots, organism, evaluatedAt, expiresAt) {
  let copied;
  try {
    copied = copyOwnDataArray(evidenceSources, "epoch-admission-evidence");
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", "epoch-admission-evidence");
  }
  assertRealm();
  if (
    copied.length < 1 ||
    copied.length > PLACEMENT_ADMISSION_LIMITS.admission_evidence_per_epoch_max
  ) fail("E_PLACEMENT_ADMISSION_LIMIT", "epoch-admission-evidence");
  const restored = [];
  for (const source of copied) {
    const bytes = typeof source === "string" ? decodeBase64Url(source) : source;
    if (!bytes) fail("E_PLACEMENT_ADMISSION_FORMAT", "epoch-admission-evidence-encoding");
    const parsed = parseCanonical(bytes, "epoch-admission-evidence-entry");
    const rootId = parsed.value?.body?.trust_root_id;
    const root = mapGet(roots.byId, rootId);
    if (!root) fail("E_PLACEMENT_ADMISSION_POLICY", "evidence-untrusted-root");
    const evidence = restoreEvidence(parsed.bytes, root);
    if (
      evidence.body.lineage_organism_id !== organism ||
      evaluatedAt < decimal(evidence.body.valid_from_ms, "admission-valid-from") ||
      expiresAt > decimal(evidence.body.valid_until_ms, "admission-valid-until")
    ) fail("E_PLACEMENT_ADMISSION_TIME", "evidence-does-not-cover-epoch");
    restored.push(evidence);
  }
  restored.sort((left, right) => left.evidence_id < right.evidence_id ? -1 : 1);
  const evidenceIds = createSet();
  const memberIds = createSet();
  for (const evidence of restored) {
    if (
      setHas(evidenceIds, evidence.evidence_id) ||
      setHas(memberIds, evidence.body.subject.key_id)
    ) fail("E_PLACEMENT_ADMISSION_POLICY", "duplicate-evidence-or-member");
    setAdd(evidenceIds, evidence.evidence_id);
    setAdd(memberIds, evidence.body.subject.key_id);
  }
  if (restored.length > PLACEMENT_ADMISSION_LIMITS.members_per_epoch_max) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", "epoch-members");
  }
  return Object.freeze({
    encoded: Object.freeze(restored.map((entry) => encodeBase64Url(entry.bytes))),
    members: Object.freeze(restored.map((entry) => Object.freeze({
      evidence_id: entry.evidence_id,
      failure_domain_id: entry.body.failure_domain_id,
      identity: entry.body.subject,
      operator_root_id: entry.body.operator_root_id,
      roles: entry.body.roles,
      trust_root_id: entry.body.trust_root_id,
      valid_from_ms: entry.body.valid_from_ms,
      valid_until_ms: entry.body.valid_until_ms
    })))
  });
}

function assertMembershipCapacity(members, policy) {
  const observerOperators = createSet();
  const observerDomains = createSet();
  let providers = 0;
  for (const member of members) {
    if (member.roles.includes("provider")) providers += 1;
    if (member.roles.includes("observer")) {
      setAdd(observerOperators, member.operator_root_id);
      setAdd(observerDomains, member.failure_domain_id);
    }
  }
  if (
    providers < 1 ||
    setSize(observerOperators) < policy.roster_size ||
    setSize(observerDomains) < policy.roster_size
  ) fail("E_PLACEMENT_ADMISSION_POLICY", "insufficient-independent-membership");
}

function epochBasis({
  authority,
  capsule,
  encodedEvidence,
  epoch,
  evaluatedAtMs,
  expiresAtMs,
  observerPolicy: policy,
  priorEpochId,
  retiredTrustRootAuthorityIds,
  revokedTrustRootIds,
  trustRootHistory,
  roots
}) {
  return Object.freeze({
    admission_evidence_base64url: encodedEvidence,
    epoch,
    evaluated_at_ms: evaluatedAtMs,
    expires_at_ms: expiresAtMs,
    lineage_authority: authority,
    lineage_capsule_id: capsule.capsule_id,
    lineage_custody_hash: custodyCommitment(authority),
    lineage_head_hash: capsule.head_hash,
    lineage_organism_id: capsule.organism_id,
    observer_policy: policy,
    prior_epoch_id: priorEpochId,
    retired_trust_root_authority_ids: retiredTrustRootAuthorityIds,
    revoked_trust_root_ids: revokedTrustRootIds,
    trust_root_history: trustRootHistory,
    trust_roots: roots
  });
}

function epochDraftFromParameters(capsuleSource, priorSource, parameterSource) {
  const capsule = capsuleAuthority(capsuleSource);
  const parameters = exactKeys(parameterSource, [
    "admission_evidence",
    "evaluated_at_ms",
    "expires_at_ms",
    "observer_policy",
    "revoked_trust_root_ids",
    "trust_roots"
  ], "epoch-parameters");
  const evaluatedAt = decimal(parameters.evaluated_at_ms, "epoch-evaluated-at");
  const expiresAt = decimal(parameters.expires_at_ms, "epoch-expires-at", evaluatedAt + 1);
  if (expiresAt - evaluatedAt > Number(PLACEMENT_ADMISSION_LIMITS.validity_ms_max)) {
    fail("E_PLACEMENT_ADMISSION_TIME", "epoch-validity");
  }
  let prior = null;
  let epochNumber = 1;
  if (priorSource !== null) {
    prior = restorePlacementMembershipEpoch(priorSource);
    if (prior.body.lineage_organism_id !== capsule.organism_id) {
      fail("E_PLACEMENT_ADMISSION_LINEAGE", "prior-organism");
    }
    epochNumber = decimal(prior.body.epoch, "prior-epoch", 1) + 1;
    if (!Number.isSafeInteger(epochNumber)) fail("E_PLACEMENT_ADMISSION_LIMIT", "epoch-overflow");
  }
  const policy = observerPolicy(parameters.observer_policy);
  const roots = normalizeRoots(
    parameters.trust_roots,
    capsule.organism_id,
    evaluatedAt,
    expiresAt
  );
  const rootLifecycle = trustRootLifecycle(
    roots.roots,
    prior,
    parameters.revoked_trust_root_ids
  );
  const evidence = normalizeEvidence(
    parameters.admission_evidence,
    roots,
    capsule.organism_id,
    evaluatedAt,
    expiresAt
  );
  assertMembershipCapacity(evidence.members, policy);
  const body = epochBasis({
    authority: capsule.descriptor,
    capsule,
    encodedEvidence: evidence.encoded,
    epoch: String(epochNumber),
    evaluatedAtMs: parameters.evaluated_at_ms,
    expiresAtMs: parameters.expires_at_ms,
    observerPolicy: policy,
    priorEpochId: prior?.epoch_id ?? null,
    retiredTrustRootAuthorityIds: rootLifecycle.retired,
    revokedTrustRootIds: rootLifecycle.revoked,
    trustRootHistory: rootLifecycle.history,
    roots: roots.roots
  });
  const epochId = domainHash(DOMAINS.epoch, canonicalBytes(body));
  return Object.freeze({
    body,
    capsule,
    epochId,
    members: evidence.members,
    prior,
    roots: roots.roots,
    signingMessage: idMessage(DOMAINS.epochSignature, epochId),
    signingTuple: `placement-membership.${capsule.organism_id}.${epochNumber}.${prior?.epoch_id ?? "genesis"}`
  });
}

function epochDraftFromBody(bodySource) {
  const body = exactKeys(bodySource, [
    "admission_evidence_base64url",
    "epoch",
    "evaluated_at_ms",
    "expires_at_ms",
    "lineage_authority",
    "lineage_capsule_id",
    "lineage_custody_hash",
    "lineage_head_hash",
    "lineage_organism_id",
    "observer_policy",
    "prior_epoch_id",
    "retired_trust_root_authority_ids",
    "revoked_trust_root_ids",
    "trust_root_history",
    "trust_roots"
  ], "membership-epoch-body");
  const epochNumber = decimal(body.epoch, "epoch", 1);
  if (epochNumber === 1 ? body.prior_epoch_id !== null : !DIGEST.test(body.prior_epoch_id)) {
    fail("E_PLACEMENT_ADMISSION_BINDING", "epoch-prior");
  }
  const evaluatedAt = decimal(body.evaluated_at_ms, "epoch-evaluated-at");
  const expiresAt = decimal(body.expires_at_ms, "epoch-expires-at", evaluatedAt + 1);
  if (expiresAt - evaluatedAt > Number(PLACEMENT_ADMISSION_LIMITS.validity_ms_max)) {
    fail("E_PLACEMENT_ADMISSION_TIME", "epoch-validity");
  }
  const organism = organismId(body.lineage_organism_id, "epoch-organism");
  const authority = authorityDescriptor(body.lineage_authority);
  if (body.lineage_custody_hash !== custodyCommitment(authority)) {
    fail("E_PLACEMENT_ADMISSION_LINEAGE", "epoch-custody-hash");
  }
  digest(body.lineage_capsule_id, "epoch-capsule-id");
  digest(body.lineage_head_hash, "epoch-head-hash");
  const policy = observerPolicy(body.observer_policy);
  const roots = normalizeRoots(body.trust_roots, organism, evaluatedAt, expiresAt);
  const revokedTrustRootIds = digestList(
    body.revoked_trust_root_ids,
    "epoch-revoked-trust-roots",
    PLACEMENT_ADMISSION_LIMITS.trust_roots_per_epoch_max
  );
  const retiredTrustRootAuthorityIds = digestList(
    body.retired_trust_root_authority_ids,
    "epoch-retired-trust-root-authorities",
    PLACEMENT_ADMISSION_LIMITS.trust_root_history_per_epoch_max
  );
  const normalizedTrustRootHistory = trustRootHistory(body.trust_root_history);
  const evidence = normalizeEvidence(
    body.admission_evidence_base64url,
    roots,
    organism,
    evaluatedAt,
    expiresAt
  );
  assertMembershipCapacity(evidence.members, policy);
  const normalized = Object.freeze({
    admission_evidence_base64url: evidence.encoded,
    epoch: body.epoch,
    evaluated_at_ms: body.evaluated_at_ms,
    expires_at_ms: body.expires_at_ms,
    lineage_authority: authority,
    lineage_capsule_id: body.lineage_capsule_id,
    lineage_custody_hash: body.lineage_custody_hash,
    lineage_head_hash: body.lineage_head_hash,
    lineage_organism_id: organism,
    observer_policy: policy,
    prior_epoch_id: body.prior_epoch_id,
    retired_trust_root_authority_ids: retiredTrustRootAuthorityIds,
    revoked_trust_root_ids: revokedTrustRootIds,
    trust_root_history: normalizedTrustRootHistory,
    trust_roots: roots.roots
  });
  if (!sameCanonicalValue(body, normalized)) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", "epoch-normalization");
  }
  const epochId = domainHash(DOMAINS.epoch, canonicalBytes(normalized));
  return Object.freeze({
    body: normalized,
    epochId,
    members: evidence.members,
    roots: roots.roots,
    signingMessage: idMessage(DOMAINS.epochSignature, epochId),
    signingTuple: `placement-membership.${organism}.${epochNumber}.${body.prior_epoch_id ?? "genesis"}`
  });
}

function approvals(value, draft) {
  let copied;
  try {
    copied = copyOwnDataArray(value, "membership-approvals");
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", "membership-approvals");
  }
  assertRealm();
  const byKey = createMap();
  for (const custodian of draft.body.lineage_authority.custodians) {
    mapSet(byKey, custodian.key_id, custodian);
  }
  let prior = null;
  const normalized = [];
  for (let index = 0; index < copied.length; index += 1) {
    const approval = exactKeys(copied[index], ["key_id", "signature"], `membership-approval-${index}`);
    const signer = mapGet(byKey, approval.key_id);
    if (
      !signer || approval.key_id <= (prior ?? "") ||
      !verifyEd25519(signer.public_key, draft.signingMessage, approval.signature)
    ) fail("E_PLACEMENT_ADMISSION_SIGNATURE", `membership-approval-${index}`);
    prior = approval.key_id;
    normalized.push(Object.freeze({ key_id: approval.key_id, signature: approval.signature }));
  }
  if (normalized.length < draft.body.lineage_authority.quorum.threshold) {
    fail("E_PLACEMENT_ADMISSION_QUORUM", "membership-approval-quorum");
  }
  return Object.freeze(normalized);
}

function operatorAndDomainSets(members) {
  const operators = createSet();
  const domains = createSet();
  for (const member of members) {
    if (!member.roles.includes("observer")) continue;
    setAdd(operators, member.operator_root_id);
    setAdd(domains, member.failure_domain_id);
  }
  return Object.freeze({ domains, operators });
}

function assertAdjacentIntersection(prior, current) {
  const previous = operatorAndDomainSets(prior.members);
  const next = operatorAndDomainSets(current.members);
  const operatorUnion = createSet();
  const domainUnion = createSet();
  for (const value of setValues(previous.operators)) setAdd(operatorUnion, value);
  for (const value of setValues(next.operators)) setAdd(operatorUnion, value);
  for (const value of setValues(previous.domains)) setAdd(domainUnion, value);
  for (const value of setValues(next.domains)) setAdd(domainUnion, value);
  const thresholdSum =
    prior.body.observer_policy.threshold + current.body.observer_policy.threshold;
  if (
    thresholdSum <= setSize(operatorUnion) ||
    thresholdSum <= setSize(domainUnion)
  ) fail("E_PLACEMENT_ADMISSION_INTERSECTION", "adjacent-observer-quorum");
}

function assertPriorRelation(current, prior) {
  const currentEpoch = decimal(current.body.epoch, "epoch", 1);
  if (
    current.body.prior_epoch_id !== prior.epoch_id ||
    decimal(prior.body.epoch, "prior-epoch", 1) + 1 !== currentEpoch ||
    prior.body.lineage_organism_id !== current.body.lineage_organism_id ||
    decimal(current.body.evaluated_at_ms, "epoch-evaluated-at") <
      decimal(prior.body.evaluated_at_ms, "prior-evaluated-at") ||
    decimal(current.body.evaluated_at_ms, "epoch-evaluated-at") >
      decimal(prior.body.expires_at_ms, "prior-expires-at")
  ) fail("E_PLACEMENT_ADMISSION_BINDING", "membership-prior-chain");
  trustRootLifecycle(
    current.roots ?? current.trust_roots,
    prior,
    current.body.revoked_trust_root_ids,
    current.body.retired_trust_root_authority_ids,
    current.body.trust_root_history
  );
  assertAdjacentIntersection(prior, current);
}

function epochMatchesCapsule(epoch, capsule) {
  return (
    epoch.body.lineage_capsule_id === capsule.capsule_id &&
    epoch.body.lineage_head_hash === capsule.head_hash &&
    epoch.body.lineage_organism_id === capsule.organism_id &&
    epoch.body.lineage_custody_hash === custodyCommitment(capsule.descriptor) &&
    sameCanonicalValue(epoch.body.lineage_authority, capsule.descriptor)
  );
}

function assertCurrentAndPrior(draft, capsuleSource, priorSource) {
  const capsule = capsuleAuthority(capsuleSource);
  if (!epochMatchesCapsule(draft, capsule)) {
    fail("E_PLACEMENT_ADMISSION_LINEAGE", "membership-current-head");
  }
  const epochNumber = decimal(draft.body.epoch, "epoch", 1);
  if (epochNumber === 1) {
    if (priorSource !== null || draft.body.prior_epoch_id !== null) {
      fail("E_PLACEMENT_ADMISSION_BINDING", "genesis-membership-prior");
    }
    trustRootLifecycle(
      draft.roots ?? draft.trust_roots,
      null,
      draft.body.revoked_trust_root_ids,
      draft.body.retired_trust_root_authority_ids,
      draft.body.trust_root_history
    );
    return Object.freeze({ capsule, prior: null });
  }
  if (priorSource === null) fail("E_PLACEMENT_ADMISSION_BINDING", "membership-prior-required");
  const prior = restorePlacementMembershipEpoch(priorSource);
  assertPriorRelation(draft, prior);
  return Object.freeze({ capsule, prior });
}

export function preparePlacementMembershipEpoch(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["capsule_bytes", "parameters", "prior_epoch_bytes"],
    "membership-prepare-options"
  );
  const draft = epochDraftFromParameters(
    source.capsule_bytes,
    source.prior_epoch_bytes,
    source.parameters
  );
  if (draft.prior) assertAdjacentIntersection(draft.prior, draft);
  return Object.freeze({
    body: draft.body,
    custody_approval_message: new Uint8Array(draft.signingMessage),
    custody_approval_tuple: draft.signingTuple,
    epoch_id: draft.epochId
  });
}

export function finalizePlacementMembershipEpoch(options) {
  assertRealm();
  const source = exactKeys(options, [
    "approvals",
    "body",
    "capsule_bytes",
    "prior_epoch_bytes"
  ], "membership-finalize-options");
  const draft = epochDraftFromBody(source.body);
  assertCurrentAndPrior(draft, source.capsule_bytes, source.prior_epoch_bytes);
  const normalizedApprovals = approvals(source.approvals, draft);
  const bytes = canonicalBytes({
    approvals: normalizedApprovals,
    body: draft.body,
    epoch_id: draft.epochId,
    format: PLACEMENT_ADMISSION_FORMATS.epoch
  });
  restorePlacementMembershipEpoch(bytes);
  return bytes;
}

export function restorePlacementMembershipEpoch(epochSource) {
  assertRealm();
  const parsed = parseCanonical(epochSource, "membership-epoch");
  const value = exactKeys(parsed.value, ["approvals", "body", "epoch_id", "format"], "membership-epoch");
  if (value.format !== PLACEMENT_ADMISSION_FORMATS.epoch) {
    fail("E_PLACEMENT_ADMISSION_FORMAT", "membership-format");
  }
  const draft = epochDraftFromBody(value.body);
  if (value.epoch_id !== draft.epochId) {
    fail("E_PLACEMENT_ADMISSION_BINDING", "membership-epoch-id");
  }
  const normalizedApprovals = approvals(value.approvals, draft);
  return Object.freeze({
    approvals: normalizedApprovals,
    body: draft.body,
    bytes: parsed.bytes,
    epoch_id: draft.epochId,
    members: draft.members,
    status: "restored",
    trust_roots: draft.roots
  });
}

export function verifyPlacementMembershipEpoch(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["capsule_bytes", "epoch_bytes", "prior_epoch_bytes"],
    "membership-verify-options"
  );
  const restored = restorePlacementMembershipEpoch(source.epoch_bytes);
  const draft = Object.freeze({
    body: restored.body,
    epochId: restored.epoch_id,
    members: restored.members,
    roots: restored.trust_roots
  });
  const current = assertCurrentAndPrior(draft, source.capsule_bytes, source.prior_epoch_bytes);
  return Object.freeze({ ...restored, prior_epoch_id: current.prior?.epoch_id ?? null, status: "verified" });
}

export function verifyPlacementMembershipEpochHistory(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["capsule_bytes", "epoch_bytes", "prior_epoch_bytes"],
    "membership-history-verify-options"
  );
  const restored = restorePlacementMembershipEpoch(source.epoch_bytes);
  const historical = capsuleAuthorityAtHead(
    source.capsule_bytes,
    restored.body.lineage_head_hash
  );
  if (
    restored.body.lineage_organism_id !== historical.organism_id ||
    restored.body.lineage_custody_hash !== custodyCommitment(historical.descriptor) ||
    !sameCanonicalValue(restored.body.lineage_authority, historical.descriptor)
  ) fail("E_PLACEMENT_ADMISSION_LINEAGE", "membership-historical-authority");
  const epochNumber = decimal(restored.body.epoch, "epoch", 1);
  let prior = null;
  if (epochNumber === 1) {
    if (source.prior_epoch_bytes !== null || restored.body.prior_epoch_id !== null) {
      fail("E_PLACEMENT_ADMISSION_BINDING", "genesis-membership-prior");
    }
    trustRootLifecycle(
      restored.trust_roots,
      null,
      restored.body.revoked_trust_root_ids,
      restored.body.retired_trust_root_authority_ids,
      restored.body.trust_root_history
    );
  } else {
    if (source.prior_epoch_bytes === null) {
      fail("E_PLACEMENT_ADMISSION_BINDING", "membership-prior-required");
    }
    prior = restorePlacementMembershipEpoch(source.prior_epoch_bytes);
    assertPriorRelation(restored, prior);
  }
  return Object.freeze({
    ...restored,
    prior_epoch_id: prior?.epoch_id ?? null,
    status: "verified-history"
  });
}

function convergenceResult(status, reason, epoch = null) {
  const basis = Object.freeze({
    epoch_id: epoch?.epoch_id ?? null,
    reason,
    status
  });
  return Object.freeze({
    ...basis,
    convergence_id: domainHash("MortalOS placement membership convergence v1", canonicalBytes(basis)),
    epoch_bytes: epoch ? new Uint8Array(epoch.bytes) : null
  });
}

export function convergePlacementMembershipEpochs(options) {
  assertRealm();
  const source = exactKeys(options, ["candidates", "capsule_bytes"], "membership-convergence-options");
  let candidateSources;
  try {
    candidateSources = copyOwnDataArray(source.candidates, "membership-candidates");
  } catch {
    assertRealm();
    fail("E_PLACEMENT_ADMISSION_FORMAT", "membership-candidates");
  }
  assertRealm();
  if (candidateSources.length < 1 || candidateSources.length > PLACEMENT_ADMISSION_LIMITS.members_per_epoch_max) {
    fail("E_PLACEMENT_ADMISSION_LIMIT", "membership-candidates");
  }
  const capsule = capsuleAuthority(source.capsule_bytes);
  const byId = createMap();
  for (const candidateSource of candidateSources) {
    const candidate = restorePlacementMembershipEpoch(candidateSource);
    const existing = mapGet(byId, candidate.epoch_id);
    if (!existing || encodeBase64Url(candidate.bytes) < encodeBase64Url(existing.bytes)) {
      mapSet(byId, candidate.epoch_id, candidate);
    }
  }
  const candidates = [...mapValues(byId)];
  const siblings = createMap();
  for (const candidate of candidates) {
    const tuple = [
      candidate.body.lineage_organism_id,
      candidate.body.epoch,
      candidate.body.prior_epoch_id ?? "genesis"
    ].join("\u0000");
    const existing = mapGet(siblings, tuple);
    if (existing && existing !== candidate.epoch_id) {
      return convergenceResult("halted", "membership-fork");
    }
    mapSet(siblings, tuple, candidate.epoch_id);
  }
  const current = candidates.filter((candidate) => epochMatchesCapsule(candidate, capsule));
  if (current.length < 1) return convergenceResult("halted", "current-epoch-missing");
  current.sort((left, right) => {
    const leftEpoch = decimal(left.body.epoch, "epoch", 1);
    const rightEpoch = decimal(right.body.epoch, "epoch", 1);
    return rightEpoch - leftEpoch || (left.epoch_id < right.epoch_id ? -1 : 1);
  });
  const selected = current[0];
  const chainIds = createSet();
  let cursor = selected;
  while (cursor) {
    if (setHas(chainIds, cursor.epoch_id)) {
      return convergenceResult("halted", "membership-cycle");
    }
    setAdd(chainIds, cursor.epoch_id);
    const epochNumber = decimal(cursor.body.epoch, "epoch", 1);
    if (epochNumber === 1) {
      if (cursor.body.prior_epoch_id !== null) {
        return convergenceResult("halted", "incomplete-chain");
      }
      try {
        trustRootLifecycle(
          cursor.trust_roots,
          null,
          cursor.body.revoked_trust_root_ids,
          cursor.body.retired_trust_root_authority_ids,
          cursor.body.trust_root_history
        );
      } catch (error) {
        if (error instanceof PlacementAdmissionError) {
          return convergenceResult("halted", "unsafe-root-history");
        }
        throw error;
      }
      break;
    }
    const prior = mapGet(byId, cursor.body.prior_epoch_id);
    if (!prior) return convergenceResult("halted", "incomplete-chain");
    try {
      assertPriorRelation(cursor, prior);
    } catch (error) {
      if (error instanceof PlacementAdmissionError) {
        return convergenceResult(
          "halted",
          error.code === "E_PLACEMENT_ADMISSION_INTERSECTION"
            ? "unsafe-reconfiguration"
            : error.code === "E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE"
              ? "unsafe-root-history"
              : "incomplete-chain"
        );
      }
      throw error;
    }
    cursor = prior;
  }
  if (setSize(chainIds) !== candidates.length) {
    return convergenceResult("halted", "extraneous-candidate");
  }
  return convergenceResult("converged", null, selected);
}

function selectionMaterial(value) {
  const source = exactKeys(value, [
    "consumer_key_id",
    "failure_sequence",
    "lineage_parent_hash",
    "manifest_id",
    "provider_key_id",
    "shard_index",
    "workload_id"
  ], "observer-selection");
  if (
    typeof source.consumer_key_id !== "string" || !PEER_ID.test(source.consumer_key_id) ||
    typeof source.provider_key_id !== "string" || !PEER_ID.test(source.provider_key_id) ||
    source.provider_key_id === source.consumer_key_id ||
    !DIGEST.test(source.lineage_parent_hash) || !DIGEST.test(source.manifest_id) ||
    typeof source.workload_id !== "string" || !WORKLOAD_ID.test(source.workload_id) ||
    !Number.isSafeInteger(source.shard_index) || source.shard_index < 0 || source.shard_index > 2
  ) fail("E_PLACEMENT_ADMISSION_BINDING", "observer-selection");
  decimal(source.failure_sequence, "observer-selection-failure-sequence", 1);
  return Object.freeze({ ...source });
}

function edgeScore(seed, member) {
  return domainHash(DOMAINS.rosterScore, canonicalBytes({
    failure_domain_id: member.failure_domain_id,
    key_id: member.identity.key_id,
    operator_root_id: member.operator_root_id,
    seed
  }));
}

function admittedRoster(epoch, material) {
  const provider = epoch.members.find((member) => member.identity.key_id === material.provider_key_id);
  if (!provider || !provider.roles.includes("provider")) {
    fail("E_PLACEMENT_ADMISSION_POLICY", "provider-not-admitted");
  }
  const seed = domainHash(DOMAINS.roster, canonicalBytes({
    epoch_id: epoch.epoch_id,
    selection: material
  }));
  const pairBest = createMap();
  for (const member of epoch.members) {
    if (
      !member.roles.includes("observer") ||
      member.identity.key_id === material.consumer_key_id ||
      member.identity.key_id === material.provider_key_id ||
      member.operator_root_id === provider.operator_root_id ||
      member.failure_domain_id === provider.failure_domain_id
    ) continue;
    const score = edgeScore(seed, member);
    const pair = `${member.operator_root_id}\u0000${member.failure_domain_id}`;
    const existing = mapGet(pairBest, pair);
    if (!existing || score < existing.score ||
      (score === existing.score && member.identity.key_id < existing.member.identity.key_id)) {
      mapSet(pairBest, pair, Object.freeze({ member, score }));
    }
  }
  const adjacency = createMap();
  for (const edge of mapValues(pairBest)) {
    const list = mapGet(adjacency, edge.member.operator_root_id) ?? [];
    list.push(edge);
    mapSet(adjacency, edge.member.operator_root_id, list);
  }
  for (const list of mapValues(adjacency)) {
    list.sort((left, right) => left.score < right.score ? -1 : left.score > right.score ? 1 : 0);
  }
  const operators = [...mapKeys(adjacency)].sort((left, right) => {
    const leftScore = mapGet(adjacency, left)[0].score;
    const rightScore = mapGet(adjacency, right)[0].score;
    return leftScore < rightScore ? -1 : leftScore > rightScore ? 1 : left < right ? -1 : 1;
  });
  const byDomain = createMap();
  function assign(operatorId, visitedOperators, visitedDomains) {
    if (setHas(visitedOperators, operatorId)) return false;
    setAdd(visitedOperators, operatorId);
    for (const edge of mapGet(adjacency, operatorId) ?? []) {
      const domainId = edge.member.failure_domain_id;
      if (setHas(visitedDomains, domainId)) continue;
      setAdd(visitedDomains, domainId);
      const current = mapGet(byDomain, domainId);
      if (!current || assign(current.member.operator_root_id, visitedOperators, visitedDomains)) {
        mapSet(byDomain, domainId, edge);
        return true;
      }
    }
    return false;
  }
  const target = epoch.body.observer_policy.roster_size;
  for (const operatorId of operators) {
    assign(operatorId, createSet(), createSet());
    if (mapSize(byDomain) === target) break;
  }
  if (mapSize(byDomain) < target) {
    fail("E_PLACEMENT_ADMISSION_POLICY", "observer-roster-unavailable");
  }
  const selected = [...mapValues(byDomain)].map((edge) => edge.member);
  selected.sort((left, right) => left.identity.key_id < right.identity.key_id ? -1 : 1);
  return Object.freeze({ seed, selected: Object.freeze(selected), provider });
}

function rosterResult(epoch, evaluatedAtSource, selectionSource) {
  const evaluatedAt = decimal(evaluatedAtSource, "observer-roster-evaluated-at");
  if (
    evaluatedAt < decimal(epoch.body.evaluated_at_ms, "epoch-evaluated-at") ||
    evaluatedAt > decimal(epoch.body.expires_at_ms, "epoch-expires-at")
  ) fail("E_PLACEMENT_ADMISSION_TIME", "membership-epoch-not-current");
  const material = selectionMaterial(selectionSource);
  if (material.lineage_parent_hash !== epoch.body.lineage_head_hash) {
    fail("E_PLACEMENT_ADMISSION_LINEAGE", "observer-selection-head");
  }
  const roster = admittedRoster(epoch, material);
  const observerPolicyValue = Object.freeze({
    max_faulty: epoch.body.observer_policy.max_faulty,
    observers: Object.freeze(roster.selected.map((member) => member.identity)),
    threshold: epoch.body.observer_policy.threshold
  });
  return Object.freeze({
    accounting: Object.freeze({
      independent_weight: roster.selected.length,
      observers: Object.freeze(roster.selected.map((member) => Object.freeze({
        failure_domain_id: member.failure_domain_id,
        key_id: member.identity.key_id,
        operator_root_id: member.operator_root_id,
        weight: 1
      }))),
      provider: Object.freeze({
        failure_domain_id: roster.provider.failure_domain_id,
        key_id: roster.provider.identity.key_id,
        operator_root_id: roster.provider.operator_root_id,
        weight: 1
      }),
      self_asserted_weight: 0
    }),
    epoch_id: epoch.epoch_id,
    observer_policy: observerPolicyValue,
    selection_digest: roster.seed,
    status: "selected"
  });
}

export function derivePlacementObserverRosterFromEpoch(options) {
  assertRealm();
  const source = exactKeys(
    options,
    ["epoch_bytes", "evaluated_at_ms", "selection"],
    "observer-roster-restored-options"
  );
  const epoch = restorePlacementMembershipEpoch(source.epoch_bytes);
  return rosterResult(epoch, source.evaluated_at_ms, source.selection);
}

export function derivePlacementObserverRoster(options) {
  assertRealm();
  const source = exactKeys(options, [
    "capsule_bytes",
    "epoch_bytes",
    "evaluated_at_ms",
    "prior_epoch_bytes",
    "selection"
  ], "observer-roster-options");
  const epoch = verifyPlacementMembershipEpoch({
    capsule_bytes: source.capsule_bytes,
    epoch_bytes: source.epoch_bytes,
    prior_epoch_bytes: source.prior_epoch_bytes
  });
  return rosterResult(epoch, source.evaluated_at_ms, source.selection);
}
