import { sha256 } from "@noble/hashes/sha2.js";
import {
  byteLengthOfBytes,
  encodeBase64Url,
  equalBytes,
  isSharedByteView
} from "../../src/bytes.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../../src/codec.mjs";
import { derivePeerId, verifyEd25519 } from "../../src/crypto.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  arrayPush,
  arraySort,
  copyOwnDataArray,
  createMap,
  freeze,
  mapGet,
  mapHas,
  mapSet,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotDataMethod,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS
} from "./admission-pilot-evidence.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS
} from "./admission-pilot-source-attestation.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS,
  restorePlacementAdmissionPilotSourceVerdict,
  verifyPlacementAdmissionPilotSourceVerdict
} from "./admission-pilot-source-verdict.mjs";
import {
  PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS,
  restorePlacementAdmissionRoleExecutionReceipt
} from "./admission-role-execution-receipt.mjs";

const RATIFICATION_FORMAT =
  "mortalos-placement-admission-pilot-inventory-ratification/1";
const CLOSURE_FORMAT = "mortalos-placement-admission-pilot-inventory-closure/1";
const RATIFICATION_ID_DOMAIN =
  "MortalOS placement admission pilot inventory ratification v1";
const RATIFICATION_SIGNATURE_DOMAIN =
  "MortalOS placement admission pilot inventory ratification signature v1";
const CLOSURE_ID_DOMAIN = "MortalOS placement admission pilot inventory closure v1";
const DIGEST = /^sha256:[A-Za-z0-9_-]{43}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const SIGNATURE = /^ed25519:[A-Za-z0-9_-]{86}$/u;
const ROLES = freeze(["custodian", "issuer", "observer", "subject"]);
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS = freeze({
  closure_bytes: 64 * 1024,
  participants_max: PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max,
  ratification_bytes: 4 * 1024
});

export class PlacementAdmissionPilotInventoryClosureError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionPilotInventoryClosureError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionPilotInventoryClosureError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_RUNTIME", "realm-integrity");
  }
}

function exactRecord(source, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(source, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function copiedArray(source, minimum, maximum, label) {
  let values;
  try {
    values = copyOwnDataArray(source, label);
  } catch {
    requireRealm();
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", label);
  }
  requireRealm();
  if (values.length < minimum || values.length > maximum) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_LIMIT", label);
  }
  return values;
}

function ownedBytes(source, maximum, label) {
  if (isSharedByteView(source)) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-shared-memory`);
  }
  const length = byteLengthOfBytes(source);
  if (length === null || length < 1 || length > maximum) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_LIMIT", label);
  }
  return new UINT8_ARRAY(source);
}

function parseCanonical(source, maximum, label) {
  const bytes = ownedBytes(source, maximum, label);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 32 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-json`);
  }
  if (!isCanonical(bytes, value)) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-canonical`);
  }
  return freeze({ bytes, value });
}

function normalizedDigest(value, label) {
  if (typeof value !== "string" || !regexpTest(DIGEST, value)) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", label);
  }
  return value;
}

function normalizedCommit(value, label) {
  if (typeof value !== "string" || !regexpTest(COMMIT, value)) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", label);
  }
  return value;
}

function normalizedRole(value, label) {
  if (typeof value !== "string") {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", label);
  }
  for (let index = 0; index < ROLES.length; index += 1) {
    if (ROLES[index] === value) return value;
  }
  fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", label);
}

function normalizedIdentity(source, label) {
  const value = exactRecord(source, ["key_id", "public_key"], label);
  if (
    typeof value.key_id !== "string" || !regexpTest(KEY_ID, value.key_id) ||
    typeof value.public_key !== "string" ||
    derivePeerId(value.public_key) !== value.key_id
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_IDENTITY", label);
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function snapshotSigner(source) {
  let identitySource;
  let sign;
  try {
    [identitySource] = snapshotNamedOwnDataValues(
      source,
      ["custodian"],
      "pilot-inventory-signer"
    );
    sign = snapshotDataMethod(source, "sign", "pilot-inventory-signer");
  } catch {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_IDENTITY", "pilot-inventory-signer");
  }
  return freeze({
    identity: normalizedIdentity(identitySource, "pilot-inventory-signer-identity"),
    sign
  });
}

function artifactDigest(bytes) {
  return `sha256:${encodeBase64Url(sha256(bytes))}`;
}

function ratificationContent({ deploymentPlanId, signer, verdict }) {
  return freeze({
    deployment_plan_id: deploymentPlanId,
    format: RATIFICATION_FORMAT,
    inventory_statement: "complete-for-deployment-plan",
    non_authority: true,
    pilot_evidence_id: verdict.pilot_evidence_id,
    signer,
    source_commit: verdict.source_commit,
    source_verdict_artifact_digest: artifactDigest(verdict.bytes),
    source_verdict_id: verdict.verdict_id
  });
}

function ratificationMessage(ratificationId) {
  return canonicalBytes({
    format: RATIFICATION_FORMAT,
    ratification_id: ratificationId,
    signature_domain: RATIFICATION_SIGNATURE_DOMAIN
  });
}

function projectRatification(bytes, content, ratificationId, signature) {
  return freeze({
    bytes: new UINT8_ARRAY(bytes),
    deployment_plan_id: content.deployment_plan_id,
    inventory_statement: "complete-for-deployment-plan",
    non_authority: true,
    pilot_evidence_id: content.pilot_evidence_id,
    ratification_id: ratificationId,
    signature,
    signature_verified: true,
    signer: content.signer,
    source_commit: content.source_commit,
    source_verdict_artifact_digest: content.source_verdict_artifact_digest,
    source_verdict_id: content.source_verdict_id,
    status: "placement-admission-pilot-inventory-ratification-verified"
  });
}

export async function createPlacementAdmissionPilotInventoryRatification(options) {
  requireRealm();
  const source = exactRecord(options, [
    "deployment_plan_id",
    "signer",
    "source_verdict_bytes"
  ], "pilot-inventory-ratification-options");
  const deploymentPlanId = normalizedDigest(
    source.deployment_plan_id,
    "pilot-inventory-deployment-plan-id"
  );
  const verdictBytes = ownedBytes(
    source.source_verdict_bytes,
    PLACEMENT_ADMISSION_PILOT_SOURCE_VERDICT_LIMITS.verdict_bytes,
    "pilot-inventory-source-verdict"
  );
  const verdict = restorePlacementAdmissionPilotSourceVerdict(verdictBytes);
  const signer = snapshotSigner(source.signer);
  const content = ratificationContent({
    deploymentPlanId,
    signer: signer.identity,
    verdict
  });
  const ratificationId = domainHash(RATIFICATION_ID_DOMAIN, canonicalBytes(content));
  const message = ratificationMessage(ratificationId);
  const result = await signer.sign(freeze({
    message: new UINT8_ARRAY(message),
    tuple: "placement.admission.pilot.inventory." +
      deploymentPlanId.slice("sha256:".length)
  }));
  requireRealm();
  const signed = exactRecord(result, ["key_id", "signature"], "pilot-inventory-signature");
  if (
    signed.key_id !== signer.identity.key_id ||
    typeof signed.signature !== "string" ||
    !regexpTest(SIGNATURE, signed.signature) ||
    !verifyEd25519(signer.identity.public_key, message, signed.signature)
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_IDENTITY", "pilot-inventory-signature");
  const bytes = canonicalBytes({
    ratification_id: ratificationId,
    ...content,
    signature: signed.signature
  });
  if (bytes.byteLength > PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.ratification_bytes) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_LIMIT", "pilot-inventory-ratification-bytes");
  }
  return projectRatification(bytes, content, ratificationId, signed.signature);
}

export function restorePlacementAdmissionPilotInventoryRatification(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.ratification_bytes,
    "pilot-inventory-ratification"
  );
  const value = exactRecord(parsed.value, [
    "deployment_plan_id",
    "format",
    "inventory_statement",
    "non_authority",
    "pilot_evidence_id",
    "ratification_id",
    "signature",
    "signer",
    "source_commit",
    "source_verdict_artifact_digest",
    "source_verdict_id"
  ], "pilot-inventory-ratification");
  if (
    value.format !== RATIFICATION_FORMAT ||
    value.inventory_statement !== "complete-for-deployment-plan" ||
    value.non_authority !== true ||
    typeof value.signature !== "string" ||
    !regexpTest(SIGNATURE, value.signature)
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", "pilot-inventory-ratification-envelope");
  const content = freeze({
    deployment_plan_id: normalizedDigest(
      value.deployment_plan_id,
      "pilot-inventory-ratification-plan-id"
    ),
    format: RATIFICATION_FORMAT,
    inventory_statement: "complete-for-deployment-plan",
    non_authority: true,
    pilot_evidence_id: normalizedDigest(
      value.pilot_evidence_id,
      "pilot-inventory-ratification-evidence-id"
    ),
    signer: normalizedIdentity(value.signer, "pilot-inventory-ratification-signer"),
    source_commit: normalizedCommit(
      value.source_commit,
      "pilot-inventory-ratification-source-commit"
    ),
    source_verdict_artifact_digest: normalizedDigest(
      value.source_verdict_artifact_digest,
      "pilot-inventory-ratification-verdict-digest"
    ),
    source_verdict_id: normalizedDigest(
      value.source_verdict_id,
      "pilot-inventory-ratification-verdict-id"
    )
  });
  const ratificationId = domainHash(RATIFICATION_ID_DOMAIN, canonicalBytes(content));
  const message = ratificationMessage(ratificationId);
  if (
    value.ratification_id !== ratificationId ||
    !verifyEd25519(content.signer.public_key, message, value.signature) ||
    !equalBytes(parsed.bytes, canonicalBytes({
      ratification_id: ratificationId,
      ...content,
      signature: value.signature
    }))
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_BINDING", "pilot-inventory-ratification");
  return projectRatification(parsed.bytes, content, ratificationId, value.signature);
}

function roleIncludes(roles, role) {
  for (let index = 0; index < roles.length; index += 1) {
    if (roles[index] === role) return true;
  }
  return false;
}

function expectedParticipants(receiptSources) {
  const values = copiedArray(
    receiptSources,
    1,
    PLACEMENT_ADMISSION_PILOT_SOURCE_ATTESTATION_LIMITS.receipts_max,
    "pilot-inventory-execution-receipts"
  );
  const participants = [];
  const indexes = createMap();
  for (let index = 0; index < values.length; index += 1) {
    const bytes = ownedBytes(
      values[index],
      PLACEMENT_ADMISSION_ROLE_EXECUTION_RECEIPT_LIMITS.receipt_bytes,
      `pilot-inventory-execution-receipt-${index}`
    );
    const receipt = restorePlacementAdmissionRoleExecutionReceipt(bytes);
    if (!mapHas(indexes, receipt.signer.key_id)) {
      mapSet(indexes, receipt.signer.key_id, participants.length);
      arrayPush(participants, {
        identity: receipt.signer,
        roles: [receipt.role]
      });
    } else {
      const participant = participants[mapGet(indexes, receipt.signer.key_id)];
      if (participant.identity.public_key !== receipt.signer.public_key) {
        fail("E_PLACEMENT_ADMISSION_INVENTORY_IDENTITY", "receipt-participant-key");
      }
      if (!roleIncludes(participant.roles, receipt.role)) {
        arrayPush(participant.roles, receipt.role);
      }
    }
  }
  for (let index = 0; index < participants.length; index += 1) {
    arraySort(participants[index].roles, (left, right) => left < right ? -1 : left > right ? 1 : 0);
    participants[index] = freeze({
      identity: participants[index].identity,
      roles: freeze(participants[index].roles)
    });
  }
  arraySort(participants, (left, right) => left.identity.key_id < right.identity.key_id
    ? -1
    : left.identity.key_id > right.identity.key_id ? 1 : 0);
  return freeze(participants);
}

function pilotDeploymentPlanId(pilotEvidenceBytes, expectedEvidenceId) {
  const parsed = parseCanonical(
    pilotEvidenceBytes,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.evidence_bytes,
    "pilot-inventory-pilot-evidence"
  );
  const value = exactRecord(parsed.value, [
    "capsule_artifact_digest",
    "capsule_id",
    "ceremonies",
    "deployment",
    "epochs",
    "evidence_id",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "lineage_head_hash",
    "lineage_organism_id",
    "non_authority",
    "source_commit",
    "source_commit_execution_binding",
    "topology_authority"
  ], "pilot-inventory-pilot-evidence");
  if (value.evidence_id !== expectedEvidenceId) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_BINDING", "pilot-evidence-id");
  }
  const deployment = exactRecord(value.deployment, [
    "acceptances",
    "activation_artifact_digest",
    "activation_id",
    "attestations",
    "membership_artifact_digest",
    "membership_candidate_view_id",
    "membership_id",
    "observation_ids",
    "observer_key_ids",
    "plan_artifact_digest",
    "plan_id",
    "primary_ceremony_bundle_artifact_digest",
    "primary_ceremony_bundle_id",
    "view_artifact_digest",
    "view_id"
  ], "pilot-inventory-pilot-deployment");
  return normalizedDigest(deployment.plan_id, "pilot-inventory-deployment-plan-id");
}

function closureParticipants(ratificationSources, expected, binding) {
  const values = copiedArray(
    ratificationSources,
    expected.length,
    expected.length,
    "pilot-inventory-ratifications"
  );
  const ratifications = new Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    ratifications[index] = restorePlacementAdmissionPilotInventoryRatification(
      ownedBytes(
        values[index],
        PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.ratification_bytes,
        `pilot-inventory-ratification-${index}`
      )
    );
  }
  arraySort(ratifications, (left, right) => left.signer.key_id < right.signer.key_id
    ? -1
    : left.signer.key_id > right.signer.key_id ? 1 : 0);
  const summaries = new Array(ratifications.length);
  for (let index = 0; index < ratifications.length; index += 1) {
    const ratification = ratifications[index];
    const participant = expected[index];
    if (
      ratification.signer.key_id !== participant.identity.key_id ||
      ratification.signer.public_key !== participant.identity.public_key ||
      ratification.deployment_plan_id !== binding.deployment_plan_id ||
      ratification.pilot_evidence_id !== binding.pilot_evidence_id ||
      ratification.source_commit !== binding.source_commit ||
      ratification.source_verdict_artifact_digest !==
        binding.source_verdict_artifact_digest ||
      ratification.source_verdict_id !== binding.source_verdict_id ||
      (index > 0 && ratifications[index - 1].signer.key_id === ratification.signer.key_id)
    ) fail("E_PLACEMENT_ADMISSION_INVENTORY_BINDING", `ratification-${index}`);
    summaries[index] = freeze({
      key_id: participant.identity.key_id,
      ratification_id: ratification.ratification_id,
      roles: participant.roles
    });
  }
  return freeze(summaries);
}

function closureContent(verdict, deploymentPlanId, participants) {
  return freeze({
    competing_verdict_policy: "durable-sign-once-per-deployment-plan-and-role-key",
    coordinator_protocol_authority: "not-required-for-inventory-closure",
    deployment_plan_id: deploymentPlanId,
    evidence_artifact_count: verdict.evidence_artifact_count,
    format: CLOSURE_FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    inventory_closure: "all-role-keys-ratified",
    non_authority: true,
    participant_count: participants.length,
    participants,
    pilot_evidence_id: verdict.pilot_evidence_id,
    source_commit: verdict.source_commit,
    source_verdict_artifact_digest: artifactDigest(verdict.bytes),
    source_verdict_id: verdict.verdict_id,
    topology_authority: "unproven"
  });
}

function projectClosure(bytes, content, closureId, verified) {
  return freeze({
    bytes: new UINT8_ARRAY(bytes),
    closure_id: closureId,
    competing_verdict_policy: content.competing_verdict_policy,
    coordinator_protocol_authority: content.coordinator_protocol_authority,
    deployment_plan_id: content.deployment_plan_id,
    evidence_artifact_count: content.evidence_artifact_count,
    inventory_closure: content.inventory_closure,
    non_authority: true,
    participant_count: content.participant_count,
    pilot_evidence_id: content.pilot_evidence_id,
    ratifications_verified: verified,
    source_commit: content.source_commit,
    source_verdict_id: content.source_verdict_id,
    source_verdict_verified: verified,
    status: verified
      ? "placement-admission-pilot-inventory-closure-verified"
      : "placement-admission-pilot-inventory-closure-restored",
    topology_authority: "unproven"
  });
}

export function createPlacementAdmissionPilotInventoryClosure(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "deployment",
    "epoch_records",
    "execution_receipt_bytes",
    "pilot_evidence_bytes",
    "ratification_bytes",
    "source_attestation_bytes",
    "source_commit",
    "source_verdict_bytes"
  ], "pilot-inventory-closure-options");
  const expected = expectedParticipants(source.execution_receipt_bytes);
  copiedArray(
    source.ratification_bytes,
    expected.length,
    expected.length,
    "pilot-inventory-ratification-count"
  );
  const verdict = verifyPlacementAdmissionPilotSourceVerdict({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    execution_receipt_bytes: source.execution_receipt_bytes,
    pilot_evidence_bytes: source.pilot_evidence_bytes,
    source_attestation_bytes: source.source_attestation_bytes,
    source_commit: source.source_commit,
    verdict_bytes: source.source_verdict_bytes
  });
  const deploymentPlanId = pilotDeploymentPlanId(
    source.pilot_evidence_bytes,
    verdict.pilot_evidence_id
  );
  const binding = freeze({
    deployment_plan_id: deploymentPlanId,
    pilot_evidence_id: verdict.pilot_evidence_id,
    source_commit: verdict.source_commit,
    source_verdict_artifact_digest: artifactDigest(verdict.bytes),
    source_verdict_id: verdict.verdict_id
  });
  const participants = closureParticipants(source.ratification_bytes, expected, binding);
  const content = closureContent(verdict, deploymentPlanId, participants);
  const closureId = domainHash(CLOSURE_ID_DOMAIN, canonicalBytes(content));
  const bytes = canonicalBytes({ closure_id: closureId, ...content });
  if (bytes.byteLength > PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.closure_bytes) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_LIMIT", "pilot-inventory-closure-bytes");
  }
  return projectClosure(bytes, content, closureId, true);
}

function restoredRoles(source, label) {
  const values = copiedArray(source, 1, ROLES.length, label);
  const result = new Array(values.length);
  let prior = null;
  for (let index = 0; index < values.length; index += 1) {
    const role = normalizedRole(values[index], `${label}-${index}`);
    if (prior !== null && prior >= role) {
      fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", `${label}-order`);
    }
    prior = role;
    result[index] = role;
  }
  return freeze(result);
}

function restoredParticipants(source, count) {
  const values = copiedArray(source, count, count, "pilot-inventory-closure-participants");
  const result = new Array(values.length);
  let prior = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = exactRecord(values[index], [
      "key_id",
      "ratification_id",
      "roles"
    ], `pilot-inventory-closure-participant-${index}`);
    if (
      typeof value.key_id !== "string" || !regexpTest(KEY_ID, value.key_id) ||
      (prior !== null && prior >= value.key_id)
    ) fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", "closure-participant-order");
    prior = value.key_id;
    result[index] = freeze({
      key_id: value.key_id,
      ratification_id: normalizedDigest(
        value.ratification_id,
        `closure-participant-${index}-ratification-id`
      ),
      roles: restoredRoles(value.roles, `closure-participant-${index}-roles`)
    });
  }
  return freeze(result);
}

export function restorePlacementAdmissionPilotInventoryClosure(source) {
  requireRealm();
  const parsed = parseCanonical(
    source,
    PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.closure_bytes,
    "pilot-inventory-closure"
  );
  const value = exactRecord(parsed.value, [
    "closure_id",
    "competing_verdict_policy",
    "coordinator_protocol_authority",
    "deployment_plan_id",
    "evidence_artifact_count",
    "format",
    "independent_administration",
    "independent_failure_domains",
    "inventory_closure",
    "non_authority",
    "participant_count",
    "participants",
    "pilot_evidence_id",
    "source_commit",
    "source_verdict_artifact_digest",
    "source_verdict_id",
    "topology_authority"
  ], "pilot-inventory-closure");
  if (
    value.format !== CLOSURE_FORMAT ||
    value.competing_verdict_policy !==
      "durable-sign-once-per-deployment-plan-and-role-key" ||
    value.coordinator_protocol_authority !== "not-required-for-inventory-closure" ||
    value.independent_administration !== "unproven" ||
    value.independent_failure_domains !== "unproven" ||
    value.inventory_closure !== "all-role-keys-ratified" ||
    value.non_authority !== true ||
    value.topology_authority !== "unproven" ||
    !numberIsSafeInteger(value.evidence_artifact_count) ||
    value.evidence_artifact_count < 1 ||
    !numberIsSafeInteger(value.participant_count) ||
    value.participant_count < 1 ||
    value.participant_count >
      PLACEMENT_ADMISSION_PILOT_INVENTORY_CLOSURE_LIMITS.participants_max
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_FORMAT", "pilot-inventory-closure-envelope");
  const content = freeze({
    competing_verdict_policy: "durable-sign-once-per-deployment-plan-and-role-key",
    coordinator_protocol_authority: "not-required-for-inventory-closure",
    deployment_plan_id: normalizedDigest(
      value.deployment_plan_id,
      "pilot-inventory-closure-plan-id"
    ),
    evidence_artifact_count: value.evidence_artifact_count,
    format: CLOSURE_FORMAT,
    independent_administration: "unproven",
    independent_failure_domains: "unproven",
    inventory_closure: "all-role-keys-ratified",
    non_authority: true,
    participant_count: value.participant_count,
    participants: restoredParticipants(value.participants, value.participant_count),
    pilot_evidence_id: normalizedDigest(
      value.pilot_evidence_id,
      "pilot-inventory-closure-evidence-id"
    ),
    source_commit: normalizedCommit(
      value.source_commit,
      "pilot-inventory-closure-source-commit"
    ),
    source_verdict_artifact_digest: normalizedDigest(
      value.source_verdict_artifact_digest,
      "pilot-inventory-closure-verdict-digest"
    ),
    source_verdict_id: normalizedDigest(
      value.source_verdict_id,
      "pilot-inventory-closure-verdict-id"
    ),
    topology_authority: "unproven"
  });
  const closureId = domainHash(CLOSURE_ID_DOMAIN, canonicalBytes(content));
  if (
    value.closure_id !== closureId ||
    !equalBytes(parsed.bytes, canonicalBytes({ closure_id: closureId, ...content }))
  ) fail("E_PLACEMENT_ADMISSION_INVENTORY_BINDING", "pilot-inventory-closure-id");
  return projectClosure(parsed.bytes, content, closureId, false);
}

export function verifyPlacementAdmissionPilotInventoryClosure(options) {
  requireRealm();
  const source = exactRecord(options, [
    "capsule_bytes",
    "ceremony_records",
    "closure_bytes",
    "deployment",
    "epoch_records",
    "execution_receipt_bytes",
    "pilot_evidence_bytes",
    "ratification_bytes",
    "source_attestation_bytes",
    "source_commit",
    "source_verdict_bytes"
  ], "pilot-inventory-closure-verification-options");
  const restored = restorePlacementAdmissionPilotInventoryClosure(source.closure_bytes);
  const created = createPlacementAdmissionPilotInventoryClosure({
    capsule_bytes: source.capsule_bytes,
    ceremony_records: source.ceremony_records,
    deployment: source.deployment,
    epoch_records: source.epoch_records,
    execution_receipt_bytes: source.execution_receipt_bytes,
    pilot_evidence_bytes: source.pilot_evidence_bytes,
    ratification_bytes: source.ratification_bytes,
    source_attestation_bytes: source.source_attestation_bytes,
    source_commit: source.source_commit,
    source_verdict_bytes: source.source_verdict_bytes
  });
  if (!equalBytes(restored.bytes, created.bytes)) {
    fail("E_PLACEMENT_ADMISSION_INVENTORY_BINDING", "pilot-inventory-closure-sidecars");
  }
  return created;
}
