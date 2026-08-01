import { createHash } from "node:crypto";

export const REVIEW_ATTESTATION_FORMAT = "mortalos-review-attestation/1";
export const REVIEWER_VERSION = "reviewer-merge-gate/1";
export const REVIEW_REPOSITORY = "YongHwan2161/mortalos";
export const REVIEWER_PRINCIPAL = "ant713900-web";
export const REVIEW_ATTESTATION_CHECK = "MortalOS Reviewer Attestation";
export const REVIEW_ATTESTATION_APP = Object.freeze({
  id: 4456370,
  slug: "mortalos-review-gate"
});
export const REQUIRED_REVIEW_CHECKS = Object.freeze([
  "Trusted main-base policy",
  "browser-parity",
  "protocol"
]);

const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const RUN_ID = /^[1-9][0-9]*$/u;
const textEncoder = new TextEncoder();

function requireRecord(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain record`);
  }
  return value;
}

function requireExactKeys(value, expected, path) {
  const record = requireRecord(value, path);
  const keys = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${path} has an unexpected or missing field`);
  }
  return record;
}

function requireString(value, path, pattern) {
  if (typeof value !== "string" || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new TypeError(`${path} is invalid`);
  }
  return value;
}

function requireInteger(value, path, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${path} is invalid`);
  }
  return value;
}

function requireGitHubUrl(value, path) {
  const url = new URL(requireString(value, path));
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new TypeError(`${path} must be an https://github.com URL`);
  }
  return url.href;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("canonical value contains a non-integer number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) {
      throw new TypeError("canonical value contains a sparse or extended array");
    }
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = requireRecord(value, "canonical value");
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const keys = Object.keys(descriptors).sort();
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError("canonical value contains an accessor or hidden field");
    }
  }
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(descriptors[key].value)}`).join(",")}}`;
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function normalizeReviewSnapshot(input) {
  const snapshot = requireExactKeys(input, [
    "format",
    "repository",
    "pull_request",
    "base_sha",
    "head_sha",
    "body_sha256",
    "changed_files_count",
    "changed_files_sha256",
    "diff_sha256",
    "policy",
    "required_checks",
    "reviewer",
    "reviewed_at"
  ], "snapshot");

  if (snapshot.format !== REVIEW_ATTESTATION_FORMAT) throw new TypeError("snapshot.format is invalid");
  if (snapshot.repository !== REVIEW_REPOSITORY) throw new TypeError("snapshot.repository is invalid");
  const baseSha = requireString(snapshot.base_sha, "snapshot.base_sha", HEX_40);
  const headSha = requireString(snapshot.head_sha, "snapshot.head_sha", HEX_40);
  if (baseSha === headSha) throw new TypeError("snapshot must bind a non-empty diff");

  const policy = requireExactKeys(snapshot.policy, [
    "workflow",
    "check",
    "run_id",
    "run_attempt",
    "event",
    "status",
    "conclusion",
    "run_url"
  ], "snapshot.policy");
  if (policy.workflow !== "Agent PR Policy" || policy.check !== "Trusted main-base policy") {
    throw new TypeError("snapshot.policy identity is invalid");
  }
  if (policy.event !== "pull_request_target" || policy.status !== "completed" || policy.conclusion !== "success") {
    throw new TypeError("snapshot.policy is not completed/success pull_request_target evidence");
  }

  if (!Array.isArray(snapshot.required_checks) || snapshot.required_checks.length !== REQUIRED_REVIEW_CHECKS.length) {
    throw new TypeError("snapshot.required_checks has the wrong cardinality");
  }
  const checks = snapshot.required_checks.map((entry, index) => {
    const check = requireExactKeys(entry, ["context", "head_sha", "status", "conclusion", "run_url"], `snapshot.required_checks[${index}]`);
    const context = requireString(check.context, `snapshot.required_checks[${index}].context`);
    if (!REQUIRED_REVIEW_CHECKS.includes(context)) throw new TypeError(`unexpected required check: ${context}`);
    if (check.head_sha !== headSha || check.status !== "completed" || check.conclusion !== "success") {
      throw new TypeError(`required check ${context} is not exact-head completed/success`);
    }
    return {
      context,
      head_sha: headSha,
      status: "completed",
      conclusion: "success",
      run_url: requireGitHubUrl(check.run_url, `snapshot.required_checks[${index}].run_url`)
    };
  }).sort((left, right) => left.context < right.context ? -1 : left.context > right.context ? 1 : 0);
  if (new Set(checks.map(({ context }) => context)).size !== REQUIRED_REVIEW_CHECKS.length) {
    throw new TypeError("snapshot.required_checks contains a duplicate context");
  }

  const reviewer = requireExactKeys(snapshot.reviewer, [
    "logical_reviewer",
    "version",
    "verdict",
    "receipt_sha256"
  ], "snapshot.reviewer");
  if (reviewer.logical_reviewer !== "reviewer-merge-gate" || reviewer.version !== REVIEWER_VERSION || reviewer.verdict !== "PASS") {
    throw new TypeError("snapshot.reviewer is not an authorized PASS receipt");
  }

  const reviewedAt = new Date(requireString(snapshot.reviewed_at, "snapshot.reviewed_at"));
  if (Number.isNaN(reviewedAt.getTime()) || reviewedAt.toISOString() !== snapshot.reviewed_at) {
    throw new TypeError("snapshot.reviewed_at must be canonical UTC ISO-8601");
  }

  return deepFreeze({
    format: REVIEW_ATTESTATION_FORMAT,
    repository: REVIEW_REPOSITORY,
    pull_request: requireInteger(snapshot.pull_request, "snapshot.pull_request", 1),
    base_sha: baseSha,
    head_sha: headSha,
    body_sha256: requireString(snapshot.body_sha256, "snapshot.body_sha256", HEX_64),
    changed_files_count: requireInteger(snapshot.changed_files_count, "snapshot.changed_files_count", 1),
    changed_files_sha256: requireString(snapshot.changed_files_sha256, "snapshot.changed_files_sha256", HEX_64),
    diff_sha256: requireString(snapshot.diff_sha256, "snapshot.diff_sha256", HEX_64),
    policy: {
      workflow: "Agent PR Policy",
      check: "Trusted main-base policy",
      run_id: requireString(policy.run_id, "snapshot.policy.run_id", RUN_ID),
      run_attempt: requireInteger(policy.run_attempt, "snapshot.policy.run_attempt", 1),
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      run_url: requireGitHubUrl(policy.run_url, "snapshot.policy.run_url")
    },
    required_checks: checks,
    reviewer: {
      logical_reviewer: "reviewer-merge-gate",
      version: REVIEWER_VERSION,
      verdict: "PASS",
      receipt_sha256: requireString(reviewer.receipt_sha256, "snapshot.reviewer.receipt_sha256", HEX_64)
    },
    reviewed_at: reviewedAt.toISOString()
  });
}

export function reviewAttestationBytes(input) {
  return textEncoder.encode(canonicalJson(normalizeReviewSnapshot(input)));
}

export function reviewAttestationDigest(input) {
  return createHash("sha256").update(reviewAttestationBytes(input)).digest("hex");
}

export function reviewAttestationExternalId(input) {
  return `${REVIEW_ATTESTATION_FORMAT}:${reviewAttestationDigest(input)}`;
}
