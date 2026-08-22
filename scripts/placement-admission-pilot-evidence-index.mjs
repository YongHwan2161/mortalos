import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { isCanonical, parseJsonBytes } from "../src/codec.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS
} from "../lab/placement/admission-deployment-plan-activation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS
} from "../lab/placement/admission-deployment-attestation.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS
} from "../lab/placement/admission-deployment-plan.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS
} from "../lab/placement/admission-deployment-plan-membership.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_LIMITS
} from "../lab/placement/admission-ceremony-client.mjs";
import {
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS
} from "../lab/placement/admission-membership-epoch-ceremony.mjs";

const FORMAT = "mortalos-placement-admission-pilot-evidence-index/1";
const INDEX_BYTES_MAX = 64 * 1024;
const COMMIT = /^[0-9a-f]{40}$/u;

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  error.detail = detail;
  throw error;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_FORMAT", label);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((entry, index) => entry !== wanted[index])
  ) fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_FORMAT", `${label}-keys`);
  return value;
}

function boundedArray(value, minimum, maximum, label) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_LIMIT", label);
  }
  return value;
}

function contained(base, candidate) {
  const fromBase = relative(base, candidate);
  return fromBase !== "" && !fromBase.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    fromBase !== ".." && !isAbsolute(fromBase);
}

function publicArtifact(base, path, maximum, label) {
  if (typeof path !== "string" || path.length < 1 || path.length > 1024 || isAbsolute(path)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH", label);
  }
  const lexical = resolve(base, path);
  if (!contained(base, lexical)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH", label);
  }
  let actual;
  let metadata;
  try {
    actual = realpathSync(lexical);
    metadata = statSync(actual);
  } catch {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH", label);
  }
  if (!contained(base, actual) || !metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH", label);
  }
  const bytes = new Uint8Array(readFileSync(actual));
  if (bytes.byteLength < 1 || bytes.byteLength > maximum) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_LIMIT", label);
  }
  return bytes;
}

export function loadPlacementAdmissionPilotEvidenceIndex(source) {
  let indexPath;
  let metadata;
  try {
    indexPath = realpathSync(resolve(source));
    metadata = statSync(indexPath);
  } catch {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH", "index");
  }
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > INDEX_BYTES_MAX) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_LIMIT", "index");
  }
  const indexBytes = new Uint8Array(readFileSync(indexPath));
  let value;
  try {
    value = parseJsonBytes(indexBytes, { maxBytes: INDEX_BYTES_MAX, maxDepth: 32 });
  } catch {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_FORMAT", "index-json");
  }
  if (!isCanonical(indexBytes, value)) {
    fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_FORMAT", "index-canonical");
  }
  exactKeys(value, [
    "capsule",
    "ceremonies",
    "deployment",
    "epochs",
    "format",
    "source_commit"
  ], "index");
  if (value.format !== FORMAT || typeof value.source_commit !== "string" || !COMMIT.test(
    value.source_commit
  )) fail("E_PLACEMENT_ADMISSION_PILOT_INDEX_FORMAT", "index-envelope");
  const base = realpathSync(dirname(indexPath));
  const ceremonies = boundedArray(
    value.ceremonies,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.ceremonies_max,
    "index-ceremonies"
  ).map((entry, index) => {
    exactKeys(entry, [
      "bundle",
      "issuer_response",
      "request",
      "subject_identity",
      "subject_response",
      "trust_root"
    ], `index-ceremony-${index}`);
    return {
      bundle_bytes: publicArtifact(
        base,
        entry.bundle,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `index-ceremony-${index}-bundle`
      ),
      issuer_response_bytes: publicArtifact(
        base,
        entry.issuer_response,
        PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
        `index-ceremony-${index}-issuer-response`
      ),
      request_bytes: publicArtifact(
        base,
        entry.request,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `index-ceremony-${index}-request`
      ),
      subject_identity_bytes: publicArtifact(
        base,
        entry.subject_identity,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `index-ceremony-${index}-subject-identity`
      ),
      subject_response_bytes: publicArtifact(
        base,
        entry.subject_response,
        PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
        `index-ceremony-${index}-subject-response`
      ),
      trust_root_bytes: publicArtifact(
        base,
        entry.trust_root,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `index-ceremony-${index}-trust-root`
      )
    };
  });
  const epochs = boundedArray(
    value.epochs,
    1,
    PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max,
    "index-epochs"
  ).map((entry, index) => {
    exactKeys(
      entry,
      ["approvals", "ceremony_bundles", "epoch", "request"],
      `index-epoch-${index}`
    );
    return {
      approval_bytes: boundedArray(
        entry.approvals,
        1,
        PROTOCOL_PROFILE.placement_admission.members_per_epoch_max,
        `index-epoch-${index}-approvals`
      ).map((path, approvalIndex) => publicArtifact(
        base,
        path,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.approval_bytes,
        `index-epoch-${index}-approval-${approvalIndex}`
      )),
      ceremony_bundle_bytes: boundedArray(
        entry.ceremony_bundles,
        1,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundles_max,
        `index-epoch-${index}-bundles`
      ).map((path, bundleIndex) => publicArtifact(
        base,
        path,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.ceremony_bundle_bytes,
        `index-epoch-${index}-bundle-${bundleIndex}`
      )),
      epoch_bytes: publicArtifact(
        base,
        entry.epoch,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.membership_epoch_bytes,
        `index-epoch-${index}-epoch`
      ),
      request_bytes: publicArtifact(
        base,
        entry.request,
        PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_LIMITS.request_bytes,
        `index-epoch-${index}-request`
      )
    };
  });
  const deployment = exactKeys(value.deployment, [
    "acceptances",
    "activation",
    "attestations",
    "membership",
    "plan",
    "primary_ceremony_bundle",
    "view"
  ], "index-deployment");
  return Object.freeze({
    capsule_bytes: publicArtifact(
      base,
      value.capsule,
      PROTOCOL_PROFILE.provider.object_bytes,
      "index-capsule"
    ),
    ceremony_records: ceremonies,
    deployment: Object.freeze({
      acceptance_bytes: boundedArray(
        deployment.acceptances,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_min,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.observers_max,
        "index-deployment-acceptances"
      ).map((path, index) => publicArtifact(
        base,
        path,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.acceptance_bytes,
        `index-deployment-acceptance-${index}`
      )),
      activation_bytes: publicArtifact(
        base,
        deployment.activation,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_ACTIVATION_LIMITS.activation_bytes,
        "index-deployment-activation"
      ),
      attestation_bytes: boundedArray(
        deployment.attestations,
        PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_min,
        PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestations_per_view_max,
        "index-deployment-attestations"
      ).map((path, index) => publicArtifact(
        base,
        path,
        PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.attestation_bytes,
        `index-deployment-attestation-${index}`
      )),
      membership_bytes: publicArtifact(
        base,
        deployment.membership,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.artifact_bytes,
        "index-deployment-membership"
      ),
      plan_bytes: publicArtifact(
        base,
        deployment.plan,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_LIMITS.plan_bytes,
        "index-deployment-plan"
      ),
      primary_ceremony_bundle_bytes: publicArtifact(
        base,
        deployment.primary_ceremony_bundle,
        PLACEMENT_ADMISSION_DEPLOYMENT_PLAN_MEMBERSHIP_LIMITS.ceremony_bundle_bytes,
        "index-deployment-primary-bundle"
      ),
      view_bytes: publicArtifact(
        base,
        deployment.view,
        PLACEMENT_ADMISSION_DEPLOYMENT_ATTESTATION_LIMITS.view_bytes,
        "index-deployment-view"
      )
    }),
    epoch_records: epochs,
    index_path: indexPath,
    public_root: base,
    source_commit: value.source_commit
  });
}
