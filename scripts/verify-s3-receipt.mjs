import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "stages", "s3-state-recovery.json");
const EXPECTED_RECEIPT_DIGEST =
  "sha256:7ef6b5f1d991e85bad9f40eac76faf3fabbceeb5653f214fcf99795050b1f603";
const EXPECTED_SOURCE_COMMIT = "9470e35e2804238f41212049ce14484c7b9e2e58";
const EXPECTED_BASE_COMMIT = "e04a579081d96a834455abba79c66e4a102a4487";
const EXPECTED_PROMOTION_PACKAGE_DIGEST =
  "sha256:e1deb5964531af54db9760a5f559ba00b6468252a62cac1e7c38bb0d994f15d1";
const EXPECTED_SCHEMA_DIGEST =
  "sha256:10eb65ed34ecdc43224d36659716dcb79620a1605dc49c8964258bae2fb73e0f";
const EXPECTED_TEST_DIGEST =
  "sha256:a2fc2e8215504aa3777e64faf72c63d78a9f6113999d499a630f00ce68ebfc42";
const EXPECTED_REVIEW_SNAPSHOT =
  "PENDING: external reviewer-merge-gate attestation must bind the immutable PR head; this receipt does not self-reference.";
const EXPECTED_SOURCE_PATHS = [
  "README.md",
  "agents/codex-protocol-kernel/HANDOFF.md",
  "agents/codex-protocol-kernel/WORKLOG.md",
  "docs/CLAIM_MATRIX.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/PROTOCOL.md",
  "docs/README.md",
  "docs/REJECTION_CODES.md",
  "docs/STAGE_TRACKING.md",
  "docs/STATE_AVAILABILITY_AND_RECOVERY.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md",
  "package.json",
  "r1/python/state_package_verify.py",
  "scripts/run-coverage.mjs",
  "scripts/verify-state-package.mjs",
  "src/index.mjs",
  "src/rejection-codes.mjs",
  "src/state/engine.mjs",
  "src/state/package-corpus.mjs",
  "src/state/package.mjs",
  "src/state/recovery.mjs",
  "test/state-package.test.mjs",
  "test/vectors/state-package-v1.json"
];
const RECEIPT_PATH = "evidence/stages/s3-state-recovery.json";
const SCHEMA_PATH = "schemas/s3-state-recovery-receipt.schema.json";
const VERIFIER_PATH = "scripts/verify-s3-receipt.mjs";
const TEST_PATH = "test/s3-receipt.test.mjs";
const EXPECTED_PROMOTION_PATHS = [
  ...EXPECTED_SOURCE_PATHS,
  RECEIPT_PATH,
  SCHEMA_PATH,
  VERIFIER_PATH,
  TEST_PATH
];

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function git(root, args, encoding = "utf8") {
  return execFileSync("git", ["-C", root, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function gitText(root, args) {
  return git(root, args, "utf8").trim();
}

function gitSucceeds(root, args) {
  return spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: "ignore"
  }).status === 0;
}

function sorted(values) {
  return [...values].sort();
}

function assertRepositoryPath(path, label) {
  assert.equal(typeof path, "string", `${label} path must be a string`);
  assert.ok(path.length > 0 && path.length <= 240, `${label} path is empty or too long`);
  assert.equal(isAbsolute(path), false, `${label} path must be repository-relative`);
  assert.equal(path.includes("\\"), false, `${label} path must use forward slashes`);
  assert.match(path, /^[A-Za-z0-9._/-]+$/, `${label} path has unsupported characters`);
  assert.ok(
    path.split("/").every((segment) => segment && segment !== "." && segment !== ".."),
    `${label} path has an unsafe segment`
  );
}

function committedBytes(root, commit, path) {
  assertRepositoryPath(path, "committed");
  return git(root, ["show", `${commit}:${path}`], null);
}

function changedPaths(root, from, to) {
  return gitText(root, ["diff", "--name-only", from, to])
    .split(/\r?\n/u)
    .filter(Boolean);
}

function assertSourceArtifacts(root, receipt) {
  assert.deepEqual(
    sorted(Object.keys(receipt.artifact_digests)),
    sorted(EXPECTED_SOURCE_PATHS),
    "S3 source artifact digest inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(
      digest(committedBytes(root, receipt.source_commit, path)),
      expected,
      `S3 source artifact digest mismatch: ${path}`
    );
  }
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, receipt.source_commit)),
    sorted(EXPECTED_SOURCE_PATHS),
    "S3 source diff inventory mismatch"
  );
  assert.equal(
    gitText(root, ["rev-parse", `${receipt.source_commit}^`]),
    receipt.base_commit,
    "S3 source is not a direct child of the recorded base"
  );
}

function assertPromotionTree(root, receipt, commit) {
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, commit)),
    sorted(EXPECTED_PROMOTION_PATHS),
    "S3 promotion diff inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    if (path === "package.json") continue;
    assert.equal(
      digest(committedBytes(root, commit, path)),
      expected,
      `S3 promoted source artifact digest mismatch: ${path}`
    );
  }
  assert.equal(
    digest(committedBytes(root, commit, "package.json")),
    EXPECTED_PROMOTION_PACKAGE_DIGEST,
    "S3 promoted package digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, SCHEMA_PATH)),
    EXPECTED_SCHEMA_DIGEST,
    "S3 promoted schema digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, TEST_PATH)),
    EXPECTED_TEST_DIGEST,
    "S3 promoted test digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, RECEIPT_PATH)),
    EXPECTED_RECEIPT_DIGEST,
    "S3 promoted receipt digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, "package-lock.json")),
    receipt.dependency_lock_digest,
    "S3 dependency lock digest mismatch"
  );
}

function assertPromotionSnapshot(root, receipt, commit) {
  assert.equal(
    gitText(root, ["rev-parse", `${commit}^`]),
    receipt.base_commit,
    "S3 promotion parent mismatch"
  );
  assertPromotionTree(root, receipt, commit);
}

function findPromotionCommit(root, receipt) {
  const head = gitText(root, ["rev-parse", "HEAD"]);
  const commits = gitText(root, [
    "rev-list",
    "--first-parent",
    "--reverse",
    `${receipt.base_commit}..${head}`
  ]).split(/\r?\n/u).filter(Boolean);
  for (const commit of commits) {
    if (gitText(root, ["rev-parse", `${commit}^`]) !== receipt.base_commit) continue;
    if (
      JSON.stringify(sorted(changedPaths(root, receipt.base_commit, commit))) !==
      JSON.stringify(sorted(EXPECTED_PROMOTION_PATHS))
    ) continue;
    if (digest(committedBytes(root, commit, RECEIPT_PATH)) !== EXPECTED_RECEIPT_DIGEST) continue;
    return commit;
  }
  throw new Error("S3 promoted snapshot not found on first-parent main history");
}

function assertSemanticEvidence(receipt) {
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.review_snapshot, EXPECTED_REVIEW_SNAPSHOT, "S3 review snapshot mismatch");
  assert.equal(receipt.commands.length, 8, "S3 command count mismatch");
  assert.equal(new Set(receipt.commands.map(({ command }) => command)).size, 8, "duplicate S3 command");
  assert.deepEqual(receipt.limits, {
    chunk_bytes: 65536,
    input_bytes: 4096,
    manifest_bytes: 32768,
    max_chunks: 64,
    receipt_bytes: 4096,
    reference_resource_bytes: 1048576,
    resource_bytes: 4194304,
    sources: 8,
    inventory_entries_per_source: 64
  });
  assert.deepEqual(receipt.results.state_package_tests, { passed: 12, failed: 0 });
  assert.deepEqual(receipt.results.reference_resource, {
    bytes: 1048576,
    chunks: 16,
    chunk_bytes: 65536,
    resource_root: "sha256:_H1crgtitnrQps3Z71-BnuB3I6MrVwRbswhu6RiYF7Q",
    next_state_root: "sha256:qzqUy7QG1wQM-JWGhKhZTNg1dgMlMF77WXuf3CkostE"
  });
  assert.deepEqual(receipt.results.independent_verifier, {
    implementations: ["JavaScript", "Python"],
    byte_identical: true,
    records: 1
  });
  assert.deepEqual(receipt.results.any_two_recovery, {
    combinations: ["AB", "AC", "BC"],
    passed: 3,
    failed: 0,
    third_replica_deleted: true,
    primary_relay_deleted: true,
    exact_bytes_reconstructed: 1048576
  });
  assert.deepEqual(receipt.results.adversarial_matrix, {
    cases: [
      "changed_byte",
      "reordered_chunk",
      "duplicate_chunk",
      "wrong_size",
      "wrong_manifest",
      "stale_root",
      "oversized_resource",
      "decoding_bomb",
      "adapter_interruption",
      "destination_interruption",
      "aggregate_root_mismatch"
    ],
    stable_failures: 11,
    unexpected_acceptances: 0,
    seeded_schedules: 10000,
    metadata_only_acceptances: 0
  });
  assert.deepEqual(receipt.results.recovery_semantics, {
    missing_status: "state_unavailable",
    missing_code: "E_STATE_UNAVAILABLE",
    interrupted_status: "interrupted",
    interrupted_code: "E_STATE_RECOVERY_INTERRUPTED",
    resumable: true,
    idempotent: true,
    prior_active_state_preserved: true,
    mortality_unchanged: true
  });
  assert.deepEqual(receipt.results.protocol_conformance, {
    passed: 76,
    failed: 0,
    signature_budget_units: 1152,
    overflow_unit_rejected: 1153
  });
  assert.deepEqual(receipt.results.property_cases, { passed: 10000, failed: 0 });
  assert.deepEqual(receipt.results.durable_quorum, {
    node_tests_passed: 8,
    handoff_passed: 100,
    loss_A_passed: 100,
    loss_B_passed: 100,
    loss_C_passed: 100,
    stale_signer_calls: 0
  });
  assert.deepEqual(receipt.results.portable_contract, {
    modules: 17,
    browser_bundle_bytes: 129123,
    adversarial_rejected: 10000,
    adversarial_total: 10000,
    node_browser_byte_identical: true
  });
  assert.deepEqual(receipt.results.coverage_percent, {
    repository: { lines: 95.98, branches: 92.26, functions: 95.93 },
    state_package: { lines: 97.08, branches: 91.6, functions: 100 },
    state_recovery: { lines: 99.3, branches: 94.69, functions: 100 }
  });
  assert.deepEqual(receipt.results.dependency_vulnerabilities, {
    production_dependencies: 4,
    total_dependencies: 177,
    high_or_higher: 0,
    total: 0
  });
  assert.equal(receipt.known_limitations.length, 5);
  assert.deepEqual(receipt.failures, []);
}

export async function verifyS3Receipt({
  root = defaultRoot,
  receiptPath = defaultReceiptPath,
  receiptOverride,
  promotionCommitOverride
} = {}) {
  const receiptBytes = receiptOverride
    ? Buffer.from(JSON.stringify(receiptOverride))
    : await readFile(receiptPath);
  const receipt = receiptOverride ?? JSON.parse(receiptBytes);
  const schema = JSON.parse(await readFile(resolve(root, SCHEMA_PATH), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  assert.ok(validate(receipt), ajv.errorsText(validate.errors, { separator: "\n" }));

  assert.equal(receipt.source_commit, EXPECTED_SOURCE_COMMIT, "S3 source commit mismatch");
  assert.equal(receipt.base_commit, EXPECTED_BASE_COMMIT, "S3 base commit mismatch");
  assert.equal(digest(receiptBytes), EXPECTED_RECEIPT_DIGEST, "committed S3 receipt digest mismatch");
  assertSemanticEvidence(receipt);

  const sourceCommittedAt = Date.parse(receipt.source_committed_at);
  assert.ok(Number.isFinite(sourceCommittedAt), "S3 source commit timestamp is invalid");
  assert.ok(sourceCommittedAt <= Date.parse(receipt.started_at), "S3 validation started before source freeze");
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at), "S3 validation interval is inverted");

  const sourceIsCurrentAncestor =
    !promotionCommitOverride &&
    gitSucceeds(root, ["merge-base", "--is-ancestor", receipt.source_commit, "HEAD"]);
  let mode;
  let promotionCommit = null;
  if (sourceIsCurrentAncestor) {
    mode = "candidate";
    assertSourceArtifacts(root, receipt);
    assertPromotionTree(root, receipt, "HEAD");
  } else {
    mode = "promotion";
    promotionCommit = promotionCommitOverride ?? findPromotionCommit(root, receipt);
    assertPromotionSnapshot(root, receipt, promotionCommit);
    const promotedAt = Date.parse(gitText(root, ["show", "-s", "--format=%cI", promotionCommit]));
    assert.ok(Number.isFinite(promotedAt), "S3 promotion timestamp is invalid");
    assert.ok(Date.parse(receipt.completed_at) <= promotedAt, "S3 promotion predates completed validation");
  }

  return {
    artifactCount: Object.keys(receipt.artifact_digests).length,
    mode,
    promotionCommit,
    receipt,
    receiptDigest: digest(receiptBytes)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyS3Receipt();
  console.log("MortalOS S3 state recovery receipt: PASS");
  console.log(`- verification mode: ${result.mode}`);
  console.log(`- source commit: ${result.receipt.source_commit}`);
  if (result.promotionCommit) console.log(`- promotion commit: ${result.promotionCommit}`);
  console.log(`- receipt digest: ${result.receiptDigest}`);
  console.log(`- exact changed source artifacts: ${result.artifactCount}`);
}
