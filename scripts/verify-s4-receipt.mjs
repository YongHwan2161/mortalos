import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "stages", "s4-confidentiality.json");
const EXPECTED_RECEIPT_DIGEST =
  "sha256:8ada74961d143b26b8d0161e7c0c2098fc1d02e2ca7e884a4df851b0183ac5aa";
const EXPECTED_SOURCE_COMMIT = "eb4f7d332b48b4a692693f83511b07b4f09387cb";
const EXPECTED_BASE_COMMIT = "39529337b2a739b1aee4697e680643d77704bbaa";
const EXPECTED_PROMOTION_PACKAGE_DIGEST =
  "sha256:8168a3e4f3fc323afdebf69c963e1ff2ef02c980a0f3963bf31f018080267b02";
const EXPECTED_SCHEMA_DIGEST =
  "sha256:9e0439d05e81684840adf4585e0a168dad436750849fbb3fb7ad65ae8dd505c8";
const EXPECTED_TEST_DIGEST =
  "sha256:9127ea497c89d32b213e5ea9e67e6023dad3229dc684d02577cec98d58cb01ad";
const EXPECTED_VERIFY_WORKFLOW_DIGEST =
  "sha256:bffce147d0dc0ec737d112b95a332e39bffd7563b2f5fc36a777e7f18676d110";
const EXPECTED_DEPLOY_WORKFLOW_DIGEST =
  "sha256:e89d380421ce234c016ba165b333a8c36fa1b23b890b093afea12edb9e352f9d";
const EXPECTED_REVIEW_SNAPSHOT =
  "PENDING: external reviewer-merge-gate attestation must bind the immutable PR head; this receipt does not self-reference.";
const EXPECTED_SOURCE_PATHS = [
  ".github/workflows/deploy-lab.yml",
  ".github/workflows/verify.yml",
  "README.md",
  "agents/codex-protocol-kernel/HANDOFF.md",
  "agents/codex-protocol-kernel/WORKLOG.md",
  "docs/CLAIM_MATRIX.md",
  "docs/CONFIDENTIAL_STATE_CRYPTOGRAPHY.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/README.md",
  "docs/REJECTION_CODES.md",
  "docs/STAGE_TRACKING.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md",
  "lab/storage/confidential-counter-authority-store.mjs",
  "package.json",
  "scripts/run-coverage.mjs",
  "scripts/verify-confidential-chromium.mjs",
  "src/confidential/counter.mjs",
  "src/confidential/format.mjs",
  "src/confidential/keys.mjs",
  "src/confidential/package.mjs",
  "src/confidential/recovery.mjs",
  "src/index.mjs",
  "src/rejection-codes.mjs",
  "test/confidential-browser-entry.mjs",
  "test/confidential-counter.test.mjs",
  "test/confidential-crypto-vectors.test.mjs",
  "test/confidential-format.test.mjs",
  "test/confidential-helpers.mjs",
  "test/confidential-package.test.mjs",
  "test/confidential-s3-recovery.test.mjs",
  "test/confidential-vector-runner.mjs",
  "test/vectors/wycheproof-rsa-oaep-3072-sha256.mjs"
];
const RECEIPT_PATH = "evidence/stages/s4-confidentiality.json";
const SCHEMA_PATH = "schemas/s4-confidentiality-receipt.schema.json";
const VERIFIER_PATH = "scripts/verify-s4-receipt.mjs";
const TEST_PATH = "test/s4-receipt.test.mjs";
const VERIFY_WORKFLOW_PATH = ".github/workflows/verify.yml";
const DEPLOY_WORKFLOW_PATH = ".github/workflows/deploy-lab.yml";
const EXPECTED_PROMOTION_PATHS = [...new Set([
  ...EXPECTED_SOURCE_PATHS,
  RECEIPT_PATH,
  SCHEMA_PATH,
  VERIFIER_PATH,
  TEST_PATH,
  VERIFY_WORKFLOW_PATH,
  DEPLOY_WORKFLOW_PATH
])];

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
    "S4 source artifact digest inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(
      digest(committedBytes(root, receipt.source_commit, path)),
      expected,
      `S4 source artifact digest mismatch: ${path}`
    );
  }
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, receipt.source_commit)),
    sorted(EXPECTED_SOURCE_PATHS),
    "S4 source diff inventory mismatch"
  );
  assert.equal(
    gitText(root, ["rev-parse", `${receipt.source_commit}^`]),
    receipt.base_commit,
    "S4 source is not a direct child of the recorded base"
  );
}

function assertPromotionTree(root, receipt, commit) {
  assert.deepEqual(
    sorted(changedPaths(root, receipt.base_commit, commit)),
    sorted(EXPECTED_PROMOTION_PATHS),
    "S4 promotion diff inventory mismatch"
  );
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    if (
      path === "package.json" ||
      path === VERIFY_WORKFLOW_PATH ||
      path === DEPLOY_WORKFLOW_PATH
    ) continue;
    assert.equal(
      digest(committedBytes(root, commit, path)),
      expected,
      `S4 promoted source artifact digest mismatch: ${path}`
    );
  }
  for (const [path, expected] of [
    ["package.json", EXPECTED_PROMOTION_PACKAGE_DIGEST],
    [SCHEMA_PATH, EXPECTED_SCHEMA_DIGEST],
    [TEST_PATH, EXPECTED_TEST_DIGEST],
    [VERIFY_WORKFLOW_PATH, EXPECTED_VERIFY_WORKFLOW_DIGEST],
    [DEPLOY_WORKFLOW_PATH, EXPECTED_DEPLOY_WORKFLOW_DIGEST],
    [RECEIPT_PATH, EXPECTED_RECEIPT_DIGEST]
  ]) {
    assert.equal(
      digest(committedBytes(root, commit, path)),
      expected,
      `S4 promoted artifact digest mismatch: ${path}`
    );
  }
  assert.equal(
    digest(committedBytes(root, commit, "package-lock.json")),
    receipt.dependency_lock_digest,
    "S4 dependency lock digest mismatch"
  );
}

function assertPromotionSnapshot(root, receipt, commit) {
  assert.equal(
    gitText(root, ["rev-parse", `${commit}^`]),
    receipt.base_commit,
    "S4 promotion parent mismatch"
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
  throw new Error("S4 promoted snapshot not found on first-parent main history");
}

function assertSemanticEvidence(receipt) {
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.review_snapshot, EXPECTED_REVIEW_SNAPSHOT, "S4 review snapshot mismatch");
  assert.equal(receipt.commands.length, 8, "S4 command count mismatch");
  assert.equal(new Set(receipt.commands.map(({ command }) => command)).size, 8, "duplicate S4 command");
  assert.deepEqual(receipt.formats, [
    "mortalos-confidential-active-epoch/1",
    "mortalos-confidential-epoch-id/1",
    "mortalos-confidential-package/1",
    "mortalos-confidential-package-manifest/1",
    "mortalos-confidential-rotation/1",
    "mortalos-confidential-rotation-authorization/1",
    "mortalos-counter-reservation-basis/1",
    "mortalos-counter-reservation-receipt/1",
    "mortalos-epoch-key-wrap/1",
    "mortalos-epoch-wrap-label/1"
  ]);
  assert.deepEqual(receipt.limits, {
    aad_bytes: 4096,
    chunk_plaintext_bytes: 65536,
    counter_max_exclusive: "4294967296",
    epoch_max: "18446744073709551615",
    max_chunks: 64,
    package_bytes: 5000000,
    reference_resource_bytes: 1048576,
    rsa_wrapped_key_bytes: 384
  });
  assert.deepEqual(receipt.seeds, {
    million_iv_workers: 16,
    million_iv_reservations: 15625,
    million_iv_records: 1000000,
    property_corpus_count: 10000,
    participant_schedule_count: 10000,
    state_recovery_schedule_count: 10000
  });
  assert.deepEqual(receipt.results.confidential_tests, { passed: 21, failed: 0 });
  assert.deepEqual(receipt.results.cryptography, {
    content_cipher: "AES-256-GCM",
    key_wrap: "RSA-OAEP-3072-SHA-256",
    counter_signature: "Ed25519",
    iv_prefix_hex: "4d4f5334",
    iv_bytes: 12,
    authentication_tag_bytes: 16,
    private_unwrap_key_extractable: false,
    recovered_epoch_key_extractable: false,
    recovered_epoch_key_decrypt_only: true,
    counter_signing_key_extractable: false
  });
  assert.deepEqual(receipt.results.published_vectors, {
    wycheproof_commit: "b61843a9a5115bb758134b6a1f5d5e502d445342",
    wycheproof_case: "rsa_oaep_3072_sha256_mgf1_sha256_tcId_1",
    nist_aes_256_gcm_ciphertext_and_tag:
      "cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919",
    accepted: 2,
    failed: 0
  });
  assert.deepEqual(receipt.results.nonce_uniqueness, {
    records: 1000000,
    writers: 16,
    reservations: 15625,
    duplicate_ivs: 0,
    counter_start: "0",
    counter_end_exclusive: "1000000",
    single_cas_winner: 1,
    stale_cas_rejections: 31
  });
  assert.deepEqual(receipt.results.browser_counter_authority, {
    endpoints: 2,
    cas_winners: 1,
    stale_rejections: 1,
    full_process_restart: true,
    same_authority_id: true,
    same_nonextractable_sign_only_key: true,
    next_counter_before_restart: "1",
    next_counter_after_restart: "2"
  });
  assert.deepEqual(receipt.results.ciphertext_capture, {
    relay_plaintext_occurrences: 0,
    store_plaintext_occurrences: 0,
    raw_epoch_key_occurrences: 0,
    private_key_occurrences: 0,
    ciphertext_only_s3: true
  });
  assert.deepEqual(receipt.results.any_two_recovery, {
    combinations: ["AB", "AC", "BC"],
    passed: 3,
    failed: 0,
    third_replica_deleted: true,
    primary_relay_deleted: true,
    exact_bytes_decrypted: 1048576
  });
  assert.deepEqual(receipt.results.membership_and_rotation, {
    removed_member_future_epoch_denied: true,
    authorized_survivor_succeeded: true,
    old_epoch_remained_atomic_on_fault: true,
    new_epoch_activated_atomically: true,
    authority_loss_requires_fresh_authority: true,
    observed_equivocation_blocks_activation: true,
    observed_equivocation_retires_bound_authority: true,
    forged_equivocation_evidence_rejected: true,
    fake_lost_authority_rejected: true,
    rotation_requires_validator_branded_head: true,
    rotation_requires_current_quorum_signatures: true,
    hidden_fork_global_detection_claimed: false
  });
  assert.deepEqual(receipt.results.failure_matrix, {
    stable_rejection_codes: 23,
    unexpected_acceptances: 0,
    failover_local_reservation_calls: 0,
    wrong_key_rejected: true,
    wrong_epoch_rejected: true,
    wrong_label_rejected: true,
    duplicate_wrap_rejected: true,
    authentication_tag_rejected: true,
    counter_rollback_rejected: true,
    counter_overflow_rejected: true
  });
  assert.deepEqual(receipt.results.status_separation, {
    state_unavailable_is_not_decryption_failure: true,
    decryption_failure_is_not_mortality: true,
    missing_authority_is_not_reconstructed_from_ciphertext: true
  });
  assert.deepEqual(receipt.results.protocol_conformance, { passed: 76, failed: 0 });
  assert.deepEqual(receipt.results.property_cases, { passed: 10000, failed: 0 });
  assert.deepEqual(receipt.results.portable_contract, {
    modules: 22,
    browser_bundle_bytes: 131734,
    adversarial_rejected: 10000,
    adversarial_total: 10000,
    node_browser_byte_identical: true
  });
  assert.deepEqual(receipt.results.coverage_percent, {
    repository: { lines: 95.51, branches: 91.95, functions: 96.83 },
    counter: { lines: 96.19, branches: 94.55, functions: 100 },
    format: { lines: 96.43, branches: 90.57, functions: 100 },
    keys: { lines: 97.81, branches: 93.88, functions: 100 },
    package: { lines: 94.69, branches: 87.5, functions: 100 },
    recovery: { lines: 88.57, branches: 84.62, functions: 100 }
  });
  assert.deepEqual(receipt.results.dependency_vulnerabilities, {
    production_dependencies: 4,
    total_dependencies: 177,
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    total: 0
  });
  assert.equal(receipt.known_limitations.length, 6);
  assert.deepEqual(receipt.failures, []);
}

export async function verifyS4Receipt({
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

  assert.equal(receipt.source_commit, EXPECTED_SOURCE_COMMIT, "S4 source commit mismatch");
  assert.equal(receipt.base_commit, EXPECTED_BASE_COMMIT, "S4 base commit mismatch");
  assert.equal(digest(receiptBytes), EXPECTED_RECEIPT_DIGEST, "committed S4 receipt digest mismatch");
  assertSemanticEvidence(receipt);

  const sourceCommittedAt = Date.parse(receipt.source_committed_at);
  assert.ok(Number.isFinite(sourceCommittedAt), "S4 source commit timestamp is invalid");
  assert.ok(sourceCommittedAt <= Date.parse(receipt.started_at), "S4 validation started before source freeze");
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at), "S4 validation interval is inverted");

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
    assert.ok(Number.isFinite(promotedAt), "S4 promotion timestamp is invalid");
    assert.ok(Date.parse(receipt.completed_at) <= promotedAt, "S4 promotion predates completed validation");
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
  const result = await verifyS4Receipt();
  console.log("MortalOS S4 confidentiality receipt: PASS");
  console.log(`- verification mode: ${result.mode}`);
  console.log(`- source commit: ${result.receipt.source_commit}`);
  if (result.promotionCommit) console.log(`- promotion commit: ${result.promotionCommit}`);
  console.log(`- receipt digest: ${result.receiptDigest}`);
  console.log(`- exact changed source artifacts: ${result.artifactCount}`);
}
