import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "stages", "s1-participant-core.json");
const EXPECTED_RECEIPT_DIGEST = "sha256:c34d8457f9a25cb1d76ef90d8d581c2864721e646c3b6aeb97218f5dc908b7b3";
const EXPECTED_ARTIFACT_PATHS = [
  ".github/workflows/verify.yml",
  "agents/codex-protocol-kernel/HANDOFF.md",
  "agents/codex-protocol-kernel/WORKLOG.md",
  "docs/CLAIM_MATRIX.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/PARTICIPANT_CORE.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/README.md",
  "docs/STAGE_TRACKING.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md",
  "lab/live-incubator.mjs",
  "lab/participant/contracts.mjs",
  "lab/participant/core.mjs",
  "lab/participant/durable-participant.mjs",
  "lab/participant/live-endpoint.mjs",
  "lab/participant/model.mjs",
  "lab/participant/protocol-objects.mjs",
  "lab/participant/quorum-endpoint.mjs",
  "lab/participant/webcrypto-key-store.mjs",
  "package.json",
  "scripts/verify-participant-core.mjs",
  "test/lab.test.mjs",
  "test/participant-core.test.mjs"
];
const EXPECTED_CONTRACTS = {
  operation: "mortalos-participant-operation/1",
  snapshot: "mortalos-participant-snapshot/1",
  port: "mortalos-participant-port/1",
  protocol: ["mortalos/0", "mortalos/1"],
  state: "mortalos-state/1",
  crypto: ["Ed25519", "SHA-256"]
};
const EXPECTED_COMMANDS = [
  {
    command: "npm run test:participant-core",
    status: "PASS",
    summary: "Ten Participant Core, adapter, boundary, and model tests passed."
  },
  {
    command: "npm run test:participant-core:coverage",
    status: "PASS",
    summary: "Participant Core coverage was 100.00% lines, 94.83% branches, and 100.00% functions."
  },
  {
    command: "npm run verify:participant-core",
    status: "PASS",
    summary: "Two Node runs and Chromium produced byte-identical results for 10,000 schedules of 12 events."
  },
  {
    command: "npm test",
    status: "PASS",
    summary: "The complete repository test chain passed from the beginning on the frozen source commit."
  },
  {
    command: "npm run verify:lab",
    status: "PASS",
    summary: "Chromium Lab acceptance and 20 consecutive persistent A-to-B handoffs passed."
  },
  {
    command: "npm run test:chromium",
    status: "PASS",
    summary: "Committed and Chromium corpus results were byte-identical; 10,000 adversarial cases were rejected."
  },
  {
    command: "npm run verify:transport",
    status: "PASS",
    summary: "10,000 seeded schedules and 30,000 endpoint recoveries matched in Node and Chromium."
  },
  {
    command: "npm run test:coverage",
    status: "PASS",
    summary: "Repository coverage was 94.70% lines, 92.31% branches, and 95.22% functions."
  },
  {
    command: "npm audit --audit-level=moderate",
    status: "PASS",
    summary: "Found 0 vulnerabilities."
  },
  {
    command: "npm run verify:s1",
    status: "PASS",
    summary: "Receipt schema, source lineage, exact changed-file inventory, digests, results, limitations, and bytes read back exactly."
  }
];
const EXPECTED_ENVIRONMENT = {
  os: "Windows",
  architecture: "x64",
  node: "v22.12.0",
  npm: "10.9.0",
  chromium: "149.0.7827.55",
  timezone: "Asia/Seoul",
  cross_origin_isolated_lab: true
};
const EXPECTED_SEEDS = {
  participant_schedule_count: 10000,
  participant_events_per_schedule: 12,
  property_corpus: 1297044052
};
const EXPECTED_LIMITATIONS = [
  "Crash-safe prepare, commit, and recovery across a durable 2-of-3 quorum remain S2 work.",
  "R3 state-manifest, chunk replication, and repair remain S3 work.",
  "State confidentiality and encrypted recovery remain S4 work.",
  "Independent SDK, CLI, and Continuity Capsule surfaces remain S5 and S6 work.",
  "Independent physical and administrative failure domains plus Firefox and WebKit parity remain S7 and S8 work."
];
const EXPECTED_RESULTS = {
  participant_core_tests: { passed: 10, failed: 0 },
  participant_core_coverage_percent: { lines: 100, branches: 94.83, functions: 100 },
  participant_model_parity: {
    seeded_schedules: 10000,
    events_per_schedule: 12,
    exact_json_bytes: 8338152,
    node_runs: 2,
    chromium_runs: 1,
    result_digest: "sha256:b440878b4a484bba5b38a3c4757d4d630793c4244facf88d9804ab033d3ed73a"
  },
  stable_negative_outcomes: [
    "E_STATE_MISSING",
    "E_APPROVAL_INSUFFICIENT_QUORUM",
    "E_SIGNATURE_DUPLICATE",
    "E_LOCAL_EQUIVOCATION_REFUSED",
    "E_PARENT_STALE",
    "E_EVIDENCE_CORRUPT",
    "E_TRANSPORT_UNAVAILABLE"
  ],
  behavior_matrix: {
    single_browser: "PASS",
    durable_reload: "PASS",
    a_to_b_handoff: "PASS",
    three_pair_loss_and_repair: "PASS",
    out_of_order_catch_up: "PASS",
    visible_fork: "PASS",
    negative_handoff: "PASS"
  },
  authority_boundary: {
    candidate_construction_owner: "ParticipantCore",
    recognized_head_owner: "ParticipantCore",
    forbidden_adapter_import_test: "PASS",
    adapter_acceptance_or_head_selection_branches: 0
  },
  protocol_conformance: { passed: 76, failed: 0 },
  property_cases: { accepted_or_rejected_as_expected: 10000, failed: 0 },
  state_transitions: { passed: 10000, failed: 0 },
  isolated_chromium_quorum: { fresh_runs: 10, failed: 0 },
  persistent_handoffs: {
    passed: 20,
    total: 20,
    relay_operations_per_12_seconds: 38,
    local_rate_limit_failures: 0
  },
  portable_adversarial_cases: { rejected: 10000, total: 10000 },
  transport: {
    seeded_schedules: 10000,
    endpoint_recoveries: 30000,
    node_chromium_result_digest: "sha256:4dd66c9bf7d68af2c3e520987c1bccb3fcad8213a063178319eb7fcba9ab81d3"
  },
  repository_coverage_percent: { lines: 94.7, branches: 92.31, functions: 95.22 },
  dependency_vulnerabilities: { moderate_or_higher: 0, total: 0 }
};

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

function sourceBytes(root, sourceCommit, path) {
  assertRepositoryPath(path, "digest");
  return git(root, ["show", `${sourceCommit}:${path}`], null);
}

function sorted(values) {
  return [...values].sort();
}

export async function verifyS1Receipt({
  root = defaultRoot,
  receiptPath = defaultReceiptPath,
  receiptOverride
} = {}) {
  const receiptBytes = receiptOverride
    ? Buffer.from(JSON.stringify(receiptOverride))
    : await readFile(receiptPath);
  const receipt = receiptOverride ?? JSON.parse(receiptBytes);
  const schema = JSON.parse(await readFile(
    resolve(root, "schemas", "s1-participant-core-receipt.schema.json"),
    "utf8"
  ));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  assert.ok(validate(receipt), ajv.errorsText(validate.errors, { separator: "\n" }));

  assert.equal(gitText(root, ["cat-file", "-t", receipt.source_commit]), "commit");
  assert.equal(gitText(root, ["cat-file", "-t", receipt.base_commit]), "commit");
  assert.equal(
    gitText(root, ["rev-parse", `${receipt.source_commit}^`]),
    receipt.base_commit,
    "S1 source commit is not a direct child of the recorded baseline"
  );
  const sourceCommittedAt = Date.parse(gitText(root, ["show", "-s", "--format=%cI", receipt.source_commit]));
  assert.ok(Number.isFinite(sourceCommittedAt), "S1 source commit timestamp is invalid");
  assert.ok(sourceCommittedAt <= Date.parse(receipt.started_at), "S1 validation started before the source was frozen");
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at), "S1 validation interval is inverted");

  assert.equal(
    receipt.dependency_lock_digest,
    digest(sourceBytes(root, receipt.source_commit, "package-lock.json")),
    "S1 dependency lock digest mismatch"
  );
  assert.deepEqual(Object.keys(receipt.package_digests), ["package.json"], "S1 package digest inventory mismatch");
  assert.equal(
    receipt.package_digests["package.json"],
    digest(sourceBytes(root, receipt.source_commit, "package.json")),
    "S1 package digest mismatch"
  );

  assert.deepEqual(
    sorted(Object.keys(receipt.artifact_digests)),
    sorted(EXPECTED_ARTIFACT_PATHS),
    "S1 artifact digest inventory mismatch"
  );
  const changedPaths = gitText(root, [
    "diff",
    "--name-only",
    receipt.base_commit,
    receipt.source_commit
  ]).split(/\r?\n/u).filter(Boolean);
  assert.deepEqual(sorted(changedPaths), sorted(EXPECTED_ARTIFACT_PATHS), "S1 source diff inventory mismatch");
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(digest(sourceBytes(root, receipt.source_commit, path)), expected, `S1 artifact digest mismatch: ${path}`);
  }

  assert.deepEqual(receipt.contracts, EXPECTED_CONTRACTS, "S1 contract inventory mismatch");
  assert.deepEqual(receipt.commands, EXPECTED_COMMANDS, "S1 command records mismatch");
  assert.equal(new Set(receipt.commands.map(({ command }) => command)).size, 10, "duplicate S1 command");
  assert.deepEqual(receipt.environment, EXPECTED_ENVIRONMENT, "S1 environment mismatch");
  assert.deepEqual(receipt.seeds, EXPECTED_SEEDS, "S1 seeds mismatch");
  assert.deepEqual(receipt.results, EXPECTED_RESULTS, "S1 structured results mismatch");
  assert.deepEqual(receipt.known_limitations, EXPECTED_LIMITATIONS, "S1 limitations mismatch");
  assert.equal(receipt.status, "PASS");
  assert.deepEqual(receipt.failures, []);
  assert.equal(receipt.review_snapshot, "pending: reviewer-merge-gate immutable-head review");
  assert.equal(digest(receiptBytes), EXPECTED_RECEIPT_DIGEST, "committed S1 receipt digest mismatch");

  return {
    artifactCount: Object.keys(receipt.artifact_digests).length,
    receipt,
    receiptDigest: digest(receiptBytes)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyS1Receipt();
  console.log("MortalOS S1 Participant Core receipt: PASS");
  console.log(`- source commit: ${result.receipt.source_commit}`);
  console.log(`- receipt digest: ${result.receiptDigest}`);
  console.log(`- exact changed source artifacts: ${result.artifactCount}`);
}
