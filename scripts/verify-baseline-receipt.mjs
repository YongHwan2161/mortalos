import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReceiptPath = resolve(defaultRoot, "evidence", "baseline", "s0-baseline.json");

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
  assert.ok(Array.isArray(results.active_document_inventory));
  assert.ok(results.active_document_inventory.length >= 9);
  assert.equal(new Set(results.active_document_inventory).size, results.active_document_inventory.length);
  for (const path of results.active_document_inventory) {
    assert.ok(receipt.artifact_digests[path], `active document lacks an artifact digest: ${path}`);
  }
  assert.ok(Array.isArray(results.known_limitations) && results.known_limitations.length >= 4);
  assert.ok(results.known_limitations.every((entry) => typeof entry === "string" && entry.length >= 20));
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
  for (const [path, expected] of Object.entries(receipt.package_digests)) {
    assert.equal(digest(sourceBytes(root, receipt.source_commit, path)), expected, `package digest mismatch: ${path}`);
  }
  for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
    assert.equal(digest(sourceBytes(root, receipt.source_commit, path)), expected, `artifact digest mismatch: ${path}`);
  }

  const requiredCommands = [
    "npm ci",
    "npm test",
    "npm run verify:lab",
    "npm run test:chromium",
    "npm run verify:transport",
    "npm run test:coverage",
    "npm audit --audit-level=moderate",
    "npm run verify:baseline"
  ];
  assert.equal(receipt.commands.length, requiredCommands.length, "baseline command inventory mismatch");
  const commandNames = receipt.commands.map((entry) => entry.command);
  assert.equal(new Set(commandNames).size, commandNames.length, "duplicate baseline command");
  assertExactStrings(commandNames, requiredCommands, "baseline command inventory");
  assert.ok(receipt.commands.every((entry) => entry.status === "PASS"), "a baseline command is not PASS");

  assertExactStrings(receipt.protocol_versions, ["mortalos/0", "mortalos/1"], "protocol versions");
  assertExactStrings(receipt.state_versions, ["mortalos-state/1"], "state versions");
  assertExactStrings(receipt.storage_schema_versions, ["durable-participant/1", "relay-sqlite/v1"], "storage versions");
  assertExactStrings(receipt.crypto_versions, ["Ed25519", "SHA-256"], "crypto versions");
  assert.equal(receipt.status, "PASS");
  assert.deepEqual(receipt.failures, []);
  assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at));
  assert.equal(receipt.seeds.property_corpus, 1297044052);
  assert.match(receipt.topology_digest, /^not_applicable: S0 /);
  assert.equal(receipt.review_snapshot, "pending: reviewer-merge-gate immutable-head review");
  assertStructuredResults(receipt);

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
