import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVIEW_ATTESTATION_CHECK,
  REVIEW_ATTESTATION_APP,
  REVIEW_ATTESTATION_FORMAT,
  REVIEWER_PRINCIPAL,
  REVIEWER_VERSION,
  normalizeReviewSnapshot,
  reviewAttestationBytes,
  reviewAttestationDigest,
  reviewAttestationExternalId
} from "../security/reviewer-attestation.mjs";

const BASE = "0".repeat(40);
const HEAD = "1".repeat(40);
const DIGEST = "2".repeat(64);

function validSnapshot() {
  return {
    format: REVIEW_ATTESTATION_FORMAT,
    repository: "YongHwan2161/mortalos",
    pull_request: 51,
    base_sha: BASE,
    head_sha: HEAD,
    body_sha256: DIGEST,
    changed_files_count: 75,
    changed_files_sha256: "3".repeat(64),
    diff_sha256: "4".repeat(64),
    policy: {
      workflow: "Agent PR Policy",
      check: "Trusted main-base policy",
      run_id: "30693774098",
      run_attempt: 1,
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      run_url: "https://github.com/YongHwan2161/mortalos/actions/runs/30693774098"
    },
    required_checks: [
      {
        context: "protocol",
        head_sha: HEAD,
        status: "completed",
        conclusion: "success",
        run_url: "https://github.com/YongHwan2161/mortalos/actions/runs/1"
      },
      {
        context: "Trusted main-base policy",
        head_sha: HEAD,
        status: "completed",
        conclusion: "success",
        run_url: "https://github.com/YongHwan2161/mortalos/actions/runs/2"
      },
      {
        context: "browser-parity",
        head_sha: HEAD,
        status: "completed",
        conclusion: "success",
        run_url: "https://github.com/YongHwan2161/mortalos/actions/runs/3"
      }
    ],
    reviewer: {
      logical_reviewer: "reviewer-merge-gate",
      version: REVIEWER_VERSION,
      verdict: "PASS",
      receipt_sha256: "5".repeat(64)
    },
    reviewed_at: "2026-08-02T00:00:00.000Z"
  };
}

test("review gate exposes the exact native principal and GitHub App check identities", () => {
  assert.equal(REVIEWER_PRINCIPAL, "ant713900-web");
  assert.equal(REVIEW_ATTESTATION_CHECK, "MortalOS Reviewer Attestation");
  assert.deepEqual(REVIEW_ATTESTATION_APP, { id: 4456370, slug: "mortalos-review-gate" });
});

test("review snapshot canonicalizes check order and produces a stable external id", () => {
  const first = validSnapshot();
  const second = validSnapshot();
  second.required_checks.reverse();
  assert.deepEqual(normalizeReviewSnapshot(first), normalizeReviewSnapshot(second));
  assert.deepEqual(reviewAttestationBytes(first), reviewAttestationBytes(second));
  assert.equal(reviewAttestationDigest(first), reviewAttestationDigest(second));
  assert.equal(
    reviewAttestationExternalId(first),
    `${REVIEW_ATTESTATION_FORMAT}:${reviewAttestationDigest(first)}`
  );
});

test("every mutable review boundary changes the attestation digest", () => {
  const baseline = validSnapshot();
  const digest = reviewAttestationDigest(baseline);
  const mutations = [
    (value) => { value.base_sha = "6".repeat(40); },
    (value) => { value.head_sha = "7".repeat(40); value.required_checks.forEach((check) => { check.head_sha = value.head_sha; }); },
    (value) => { value.body_sha256 = "8".repeat(64); },
    (value) => { value.changed_files_count += 1; },
    (value) => { value.changed_files_sha256 = "9".repeat(64); },
    (value) => { value.diff_sha256 = "a".repeat(64); },
    (value) => { value.policy.run_id = "30693774099"; },
    (value) => { value.required_checks[0].run_url = "https://github.com/YongHwan2161/mortalos/actions/runs/9"; },
    (value) => { value.reviewer.receipt_sha256 = "b".repeat(64); },
    (value) => { value.reviewed_at = "2026-08-02T00:00:01.000Z"; }
  ];
  for (const mutate of mutations) {
    const candidate = validSnapshot();
    mutate(candidate);
    assert.notEqual(reviewAttestationDigest(candidate), digest);
  }
});

test("review snapshot rejects stale, incomplete, duplicated, or foreign evidence", () => {
  const invalid = [
    (value) => { value.extra = true; },
    (value) => { value.repository = "attacker/repository"; },
    (value) => { value.head_sha = value.base_sha; },
    (value) => { value.policy.event = "pull_request"; },
    (value) => { value.policy.conclusion = "failure"; },
    (value) => { value.required_checks.pop(); },
    (value) => { value.required_checks[0].context = "browser-parity"; },
    (value) => { value.required_checks[0].head_sha = "f".repeat(40); },
    (value) => { value.required_checks[0].run_url = "https://example.com/run"; },
    (value) => { value.reviewer.version = "untrusted-reviewer/1"; },
    (value) => { value.reviewer.verdict = "HOLD"; },
    (value) => { value.reviewed_at = "2026-08-02"; }
  ];
  for (const mutate of invalid) {
    const candidate = validSnapshot();
    mutate(candidate);
    assert.throws(() => normalizeReviewSnapshot(candidate));
  }
});

test("normalized snapshot is transitively frozen and detached from later caller mutation", () => {
  const input = validSnapshot();
  const normalized = normalizeReviewSnapshot(input);
  input.required_checks[0].context = "attacker";
  input.policy.run_id = "999";
  assert.equal(normalized.required_checks.some(({ context }) => context === "attacker"), false);
  assert.equal(normalized.policy.run_id, "30693774098");
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.required_checks));
  assert.ok(normalized.required_checks.every(Object.isFrozen));
});
