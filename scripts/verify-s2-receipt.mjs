import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "stages", "s2-durable-quorum.json");
const EXPECTED_RECEIPT_DIGEST =
  "sha256:519f743849817f5a10dedf1d5effd574c58c9a02f2ae59948ed671bf0d37d434";
const EXPECTED_SOURCE_COMMIT = "27e07bedc1e6375208be15d23551866360b5ddf8";
const EXPECTED_BASE_COMMIT = "d0a9ba0f7e4f1a3a17cb7d4af04a9c1113a09ec4";
const EXPECTED_PROMOTION_PACKAGE_DIGEST =
  "sha256:21231e7ad465c790b0f5497edbfeff57a05cf23faeb1ffe8183992dfd75a4a79";
const EXPECTED_SCHEMA_DIGEST =
  "sha256:90d14dfd25a31e9b492c1d4f627c43d446f84c4813e8b4e17e32afcd1aa5b4a3";
const EXPECTED_TEST_DIGEST =
  "sha256:c56c33de7aae70a491a38766f8d568776cce70cf053112c2b6f9f2894865679e";
const EXPECTED_TOPOLOGY_DIGEST =
  "sha256:5fb88e1e571145fbe3d26c85f41e8c871902ef5de49be3fbccc3a86bc5e7ed4a";
const EXPECTED_REVIEW_SNAPSHOT =
  "PENDING: external reviewer-merge-gate attestation must bind the immutable PR head; this receipt does not self-reference.";
const EXPECTED_SOURCE_PATHS = [
  "README.md",
  "agents/codex-protocol-kernel/HANDOFF.md",
  "agents/codex-protocol-kernel/WORKLOG.md",
  "docs/ACCESS_ARCHITECTURE.md",
  "docs/BROWSER_PARTICIPANT_COMPATIBILITY.md",
  "docs/CLAIM_MATRIX.md",
  "docs/DURABLE_QUORUM.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/PARTICIPANT_CORE.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/README.md",
  "docs/STAGE_TRACKING.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md",
  "lab/participant/contracts.mjs",
  "lab/participant/durable-participant.mjs",
  "lab/participant/durable-quorum-endpoint.mjs",
  "lab/participant/webcrypto-key-store.mjs",
  "lab/storage/durable-document.mjs",
  "lab/storage/durable-store.mjs",
  "lab/storage/memory-durable-store.mjs",
  "package.json",
  "scripts/verify-durable-quorum-chromium.mjs",
  "scripts/verify-lab.mjs",
  "test/durable-browser-entry.mjs",
  "test/durable-quorum.test.mjs",
  "test/lab.test.mjs",
  "test/participant-core.test.mjs"
];
const RECEIPT_PATH = "evidence/stages/s2-durable-quorum.json";
const SCHEMA_PATH = "schemas/s2-durable-quorum-receipt.schema.json";
const VERIFIER_PATH = "scripts/verify-s2-receipt.mjs";
const TEST_PATH = "test/s2-receipt.test.mjs";
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
    "S2 source artifact digest inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(
      digest(committedBytes(root, receipt.source_commit, path)),
      expected,
      `S2 source artifact digest mismatch: ${path}`
    );
  }
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, receipt.source_commit)),
    sorted(EXPECTED_SOURCE_PATHS),
    "S2 source diff inventory mismatch"
  );
}

function assertPromotionSnapshot(root, receipt, commit) {
  assert.equal(
    gitText(root, ["rev-parse", `${commit}^`]),
    receipt.base_commit,
    "S2 promotion is not a direct child of the recorded base"
  );
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, commit)),
    sorted(EXPECTED_PROMOTION_PATHS),
    "S2 promotion diff inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    if (path === "package.json") continue;
    assert.equal(
      digest(committedBytes(root, commit, path)),
      expected,
      `S2 promoted source artifact digest mismatch: ${path}`
    );
  }
  assert.equal(
    digest(committedBytes(root, commit, "package.json")),
    EXPECTED_PROMOTION_PACKAGE_DIGEST,
    "S2 promoted package digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, SCHEMA_PATH)),
    EXPECTED_SCHEMA_DIGEST,
    "S2 promoted schema digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, TEST_PATH)),
    EXPECTED_TEST_DIGEST,
    "S2 promoted test digest mismatch"
  );
  assert.equal(
    digest(committedBytes(root, commit, RECEIPT_PATH)),
    EXPECTED_RECEIPT_DIGEST,
    "S2 promoted receipt digest mismatch"
  );
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
  throw new Error("S2 promoted snapshot not found on first-parent main history");
}

function assertSemanticEvidence(receipt) {
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.topology_digest, EXPECTED_TOPOLOGY_DIGEST, "S2 topology digest mismatch");
  assert.equal(receipt.review_snapshot, EXPECTED_REVIEW_SNAPSHOT, "S2 review snapshot mismatch");
  assert.equal(receipt.commands.length, 8, "S2 command count mismatch");
  assert.equal(new Set(receipt.commands.map(({ command }) => command)).size, 8, "duplicate S2 command");
  assert.deepEqual(receipt.results.durable_node_tests, { passed: 8, failed: 0 });
  assert.deepEqual(receipt.results.cold_process_handoffs, { passed: 100, total: 100, failed: 0 });
  for (const endpoint of ["A", "B", "C"]) {
    assert.deepEqual(receipt.results.single_endpoint_loss_repair[endpoint], {
      passed: 100,
      total: 100
    });
  }
  assert.equal(receipt.results.single_endpoint_loss_repair.failed, 0);
  assert.equal(receipt.results.fault_matrix.unexpected_outcomes, 0);
  assert.ok(receipt.results.fault_matrix.operations.includes("expire"));
  assert.equal(receipt.results.sign_once.conflicting_second_signatures, 0);
  assert.deepEqual(receipt.results.concurrent_compare_and_swap, {
    adapters: ["memory", "indexeddb"],
    simultaneous_instances: 2,
    signatures_returned: 1,
    stale_signer_calls: 0,
    persisted_journal_entries: 1,
    stale_writer_error: "E_DURABLE_CONFLICT",
    restart_losing_body_error: "E_DURABLE_EQUIVOCATION"
  });
  assert.ok(
    Object.values(receipt.results.corruption_matrix).every((value) => value === "PASS"),
    "S2 corruption matrix is incomplete"
  );
  assert.deepEqual(receipt.results.migration, {
    valid_v1_to_v2: "PASS",
    corrupt_v1_aborted: "PASS",
    removed_with_key_v1_aborted: "PASS",
    active_without_key_v1_aborted: "PASS",
    invalid_old_versions_retained: true
  });
  assert.deepEqual(receipt.results.authority_policy, {
    removal_prevents_future_signing: "PASS",
    public_evidence_retained: "PASS",
    expiry_latch_persisted: "PASS",
    same_process_clock_rollback_prevented: "PASS",
    cold_restart_clock_rollback_prevented: "PASS",
    explicit_future_renewal_required: "PASS",
    hard_coded_30_day_lifetime: false
  });
  assert.deepEqual(receipt.results.repository_coverage_percent, {
    lines: 94.7,
    branches: 92.23,
    functions: 95.22
  });
  assert.deepEqual(receipt.results.dependency_vulnerabilities, {
    moderate_or_higher: 0,
    total: 0
  });
  assert.equal(receipt.known_limitations.length, 5);
  assert.deepEqual(receipt.failures, []);
}

export async function verifyS2Receipt({
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

  assert.equal(receipt.source_commit, EXPECTED_SOURCE_COMMIT, "S2 source commit mismatch");
  assert.equal(receipt.base_commit, EXPECTED_BASE_COMMIT, "S2 base commit mismatch");
  assert.equal(digest(receiptBytes), EXPECTED_RECEIPT_DIGEST, "committed S2 receipt digest mismatch");
  assertSemanticEvidence(receipt);

  const sourceCommittedAt = Date.parse(receipt.source_committed_at);
  assert.ok(Number.isFinite(sourceCommittedAt), "S2 source commit timestamp is invalid");
  assert.ok(sourceCommittedAt <= Date.parse(receipt.started_at), "S2 validation started before source freeze");
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at), "S2 validation interval is inverted");

  const sourceIsCurrentAncestor =
    !promotionCommitOverride &&
    gitSucceeds(root, ["merge-base", "--is-ancestor", receipt.source_commit, "HEAD"]);
  let mode;
  let promotionCommit = null;
  if (sourceIsCurrentAncestor) {
    mode = "candidate";
    assert.equal(gitText(root, ["cat-file", "-t", receipt.source_commit]), "commit");
    assert.ok(
      gitSucceeds(root, ["merge-base", "--is-ancestor", receipt.base_commit, receipt.source_commit]),
      "S2 recorded base is not an ancestor of the source commit"
    );
    assert.notEqual(receipt.source_commit, receipt.base_commit, "S2 source equals recorded base");
    assertSourceArtifacts(root, receipt);
    assert.deepEqual(
      sorted(changedPaths(root, receipt.base_commit, "HEAD")),
      sorted(EXPECTED_PROMOTION_PATHS),
      "S2 candidate diff inventory mismatch"
    );
    assert.equal(
      digest(committedBytes(root, receipt.source_commit, "package-lock.json")),
      receipt.dependency_lock_digest,
      "S2 dependency lock digest mismatch"
    );
    assert.equal(
      receipt.package_digests["package.json"],
      receipt.artifact_digests["package.json"],
      "S2 source package digest mismatch"
    );
  } else {
    mode = "promotion";
    promotionCommit = promotionCommitOverride ?? findPromotionCommit(root, receipt);
    assertPromotionSnapshot(root, receipt, promotionCommit);
    assert.equal(
      digest(committedBytes(root, promotionCommit, "package-lock.json")),
      receipt.dependency_lock_digest,
      "S2 promoted dependency lock digest mismatch"
    );
    const promotedAt = Date.parse(gitText(root, ["show", "-s", "--format=%cI", promotionCommit]));
    assert.ok(Number.isFinite(promotedAt), "S2 promotion timestamp is invalid");
    assert.ok(Date.parse(receipt.completed_at) <= promotedAt, "S2 promotion predates completed validation");
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
  const result = await verifyS2Receipt();
  console.log("MortalOS S2 durable quorum receipt: PASS");
  console.log(`- verification mode: ${result.mode}`);
  console.log(`- source commit: ${result.receipt.source_commit}`);
  if (result.promotionCommit) console.log(`- promotion commit: ${result.promotionCommit}`);
  console.log(`- receipt digest: ${result.receiptDigest}`);
  console.log(`- exact changed source artifacts: ${result.artifactCount}`);
}
