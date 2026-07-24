import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "baseline", "s0-baseline.json");
const EXPECTED_RECEIPT_DIGEST = "sha256:50fda9cd7b9353e9e72ff1d7a06ab442cd00f4dc75d1cdbb01896da73a298a90";
const EXPECTED_PACKAGE_PATHS = ["package.json"];
const EXPECTED_ARTIFACT_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/CLAIM_MATRIX.md",
  "docs/STAGE_TRACKING.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/PROTOCOL.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md",
  "docs/archive/README.md"
];
const EXPECTED_ACTIVE_DOCUMENTS = [
  "README.md",
  "docs/README.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/CLAIM_MATRIX.md",
  "docs/STAGE_TRACKING.md",
  "docs/PROTOCOL.md",
  "docs/THREAT_MODEL.md",
  "docs/TRACEABILITY.md"
];
const EXPECTED_LIMITATIONS = [
  "v0 and v1 still use separate participant execution paths; S1 will create one Participant Core.",
  "Durable quorum commit is not yet crash-safe across participants; S2 owns prepare/commit recovery.",
  "R3 state availability, encrypted state, SDK/CLI, and Continuity Capsule work remain unimplemented.",
  "The current hosted relay and UI share a Cloudflare administrative and infrastructure failure domain; independent topology is deferred to S7."
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
  property_corpus: 1297044052,
  transport_schedule: "deterministic committed transport corpus",
  quorum_trials: "deterministic clean-context combinations"
};
const EXPECTED_TOPOLOGY = "not_applicable: S0 records the local baseline; independent failure-domain topology begins at S7";
const EXPECTED_COMMANDS = [
  {
    command: "npm ci",
    status: "PASS",
    summary: "Clean lockfile install completed on the frozen candidate source."
  },
  {
    command: "npm test",
    status: "PASS",
    summary: "Protocol, state, relay, two-browser, UX, portable, differential, singleton, and H2 gates passed."
  },
  {
    command: "npm run verify:lab",
    status: "PASS",
    summary: "Local Chromium acceptance and 20 consecutive persistent A-to-B handoffs passed."
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
    summary: "75 tests: 73 passed, 2 intentionally skipped; line 94.70%, branch 92.31%, function 95.22%."
  },
  {
    command: "npm audit --audit-level=moderate",
    status: "PASS",
    summary: "Found 0 vulnerabilities."
  },
  {
    command: "npm run verify:baseline",
    status: "PASS",
    summary: "Receipt schema, source metadata, lock digest, artifact digests, required commands, and temporal bounds read back exactly."
  }
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

function assertExactStrings(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} mismatch`);
}

function assertStructuredResults(receipt) {
  const { results } = receipt;
  assert.deepEqual(results.protocol_conformance, { passed: 76, failed: 0 });
  assert.deepEqual(results.property_cases, { accepted_or_rejected_as_expected: 10000, failed: 0 });
  assert.deepEqual(results.portable_adversarial_cases, { rejected: 10000, total: 10000 });
  assert.deepEqual(results.transport, {
    seeded_schedules: 10000,
    endpoint_recoveries: 30000,
    node_chromium_result_digest: "sha256:4dd66c9bf7d68af2c3e520987c1bccb3fcad8213a063178319eb7fcba9ab81d3"
  });
  assert.deepEqual(results.persistent_handoffs, {
    passed: 20,
    total: 20,
    local_rate_limit_failures: 0
  });
  assert.deepEqual(results.coverage_percent, {
    lines: 94.7,
    branches: 92.31,
    functions: 95.22
  });
  assert.deepEqual(results.dependency_vulnerabilities, {
    moderate_or_higher: 0,
    total: 0
  });
  assert.deepEqual(results.tracking, {
    milestone: 1,
    stage_issues: [30, 31, 32, 33, 34, 35, 36, 37]
  });
  assert.deepEqual(results.active_document_inventory, EXPECTED_ACTIVE_DOCUMENTS);
  for (const path of results.active_document_inventory) {
    assert.ok(receipt.artifact_digests[path], `active document lacks an artifact digest: ${path}`);
  }
  assert.deepEqual(results.known_limitations, EXPECTED_LIMITATIONS);
}

export async function verifyBaselineReceipt({
  root = defaultRoot,
  receiptPath = defaultReceiptPath,
  receiptOverride
} = {}) {
  const receiptBytes = receiptOverride
    ? Buffer.from(JSON.stringify(receiptOverride))
    : await readFile(receiptPath);
  const receipt = receiptOverride ?? JSON.parse(receiptBytes);
  const schema = JSON.parse(await readFile(resolve(root, "schemas", "baseline-receipt.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  assert.ok(validate(receipt), ajv.errorsText(validate.errors, { separator: "\n" }));

  assert.equal(gitText(root, ["cat-file", "-t", receipt.source_commit]), "commit");
  assert.equal(gitText(root, ["cat-file", "-t", receipt.base_commit]), "commit");
  assert.equal(
    gitText(root, ["rev-parse", `${receipt.source_commit}^`]),
    receipt.base_commit,
    "source commit is not a direct child of the recorded main baseline"
  );
  const sourceCommittedAt = Date.parse(gitText(root, ["show", "-s", "--format=%cI", receipt.source_commit]));
  assert.ok(Number.isFinite(sourceCommittedAt), "source commit timestamp is invalid");
  assert.ok(sourceCommittedAt <= Date.parse(receipt.started_at), "baseline started before the source was frozen");

  assert.equal(
    receipt.dependency_lock_digest,
    digest(sourceBytes(root, receipt.source_commit, "package-lock.json")),
    "dependency lock digest mismatch"
  );
  assertExactStrings(Object.keys(receipt.package_digests), EXPECTED_PACKAGE_PATHS, "package digest inventory");
  for (const [path, expected] of Object.entries(receipt.package_digests)) {
    assert.equal(digest(sourceBytes(root, receipt.source_commit, path)), expected, `package digest mismatch: ${path}`);
  }
  assertExactStrings(Object.keys(receipt.artifact_digests), EXPECTED_ARTIFACT_PATHS, "artifact digest inventory");
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(digest(sourceBytes(root, receipt.source_commit, path)), expected, `artifact digest mismatch: ${path}`);
  }

  const requiredCommands = EXPECTED_COMMANDS.map((entry) => entry.command);
  assert.equal(receipt.commands.length, EXPECTED_COMMANDS.length, "baseline command inventory mismatch");
  const commandNames = receipt.commands.map((entry) => entry.command);
  assert.equal(new Set(commandNames).size, commandNames.length, "duplicate baseline command");
  assertExactStrings(commandNames, requiredCommands, "baseline command inventory");
  assert.deepEqual(receipt.commands, EXPECTED_COMMANDS, "baseline command records mismatch");

  assertExactStrings(receipt.protocol_versions, ["mortalos/0", "mortalos/1"], "protocol versions");
  assertExactStrings(receipt.state_versions, ["mortalos-state/1"], "state versions");
  assertExactStrings(receipt.storage_schema_versions, ["durable-participant/1", "relay-sqlite/v1"], "storage versions");
  assertExactStrings(receipt.crypto_versions, ["Ed25519", "SHA-256"], "crypto versions");
  assert.equal(receipt.status, "PASS");
  assert.deepEqual(receipt.failures, []);
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at));
  assert.deepEqual(receipt.environment, EXPECTED_ENVIRONMENT, "baseline environment mismatch");
  assert.deepEqual(receipt.seeds, EXPECTED_SEEDS, "baseline seeds mismatch");
  assert.equal(receipt.topology_digest, EXPECTED_TOPOLOGY, "baseline topology scope mismatch");
  assert.equal(receipt.review_snapshot, "pending: reviewer-merge-gate immutable-head review");
  assertStructuredResults(receipt);
  assert.equal(digest(receiptBytes), EXPECTED_RECEIPT_DIGEST, "committed baseline receipt digest mismatch");

  return {
    artifactCount: Object.keys(receipt.artifact_digests).length,
    receipt,
    receiptDigest: digest(receiptBytes)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyBaselineReceipt();
  console.log(`MortalOS ${result.receipt.stage} baseline receipt: PASS`);
  console.log(`- source commit: ${result.receipt.source_commit}`);
  console.log(`- receipt digest: ${result.receiptDigest}`);
  console.log(`- source artifacts read back: ${result.artifactCount}`);
}
