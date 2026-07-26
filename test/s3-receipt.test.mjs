import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyS3Receipt } from "../scripts/verify-s3-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(await readFile(
  new URL("../evidence/stages/s3-state-recovery.json", import.meta.url),
  "utf8"
));

function mutate(path, value) {
  const copy = structuredClone(receipt);
  let target = copy;
  for (const segment of path.slice(0, -1)) target = target[segment];
  target[path.at(-1)] = value;
  return copy;
}

function git(args, options = {}) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options
  }).trim();
}

function gitSucceeds(args) {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

function syntheticPromotionCommit(treeish) {
  const tree = git(["rev-parse", `${treeish}^{tree}`]);
  return git(
    ["commit-tree", tree, "-p", receipt.base_commit],
    {
      input: "test-only S3 squash snapshot\n",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "MortalOS receipt test",
        GIT_AUTHOR_EMAIL: "receipt-test@example.invalid",
        GIT_COMMITTER_NAME: "MortalOS receipt test",
        GIT_COMMITTER_EMAIL: "receipt-test@example.invalid"
      }
    }
  );
}

function syntheticPullRequestMergeCommit(head) {
  const tree = git(["rev-parse", `${head}^{tree}`]);
  return git(
    ["commit-tree", tree, "-p", receipt.base_commit, "-p", receipt.source_commit],
    {
      input: "test-only S3 pull-request merge snapshot\n",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "MortalOS receipt test",
        GIT_AUTHOR_EMAIL: "receipt-test@example.invalid",
        GIT_COMMITTER_NAME: "MortalOS receipt test",
        GIT_COMMITTER_EMAIL: "receipt-test@example.invalid"
      }
    }
  );
}

async function rejectsMutation(path, value) {
  await assert.rejects(
    verifyS3Receipt({ receiptOverride: mutate(path, value) }),
    /committed S3 receipt digest mismatch|source commit mismatch|base commit mismatch|must be equal to constant/
  );
}

test("the committed S3 receipt binds the exact source snapshot and strict results", async () => {
  const result = await verifyS3Receipt();
  const expectedMode = gitSucceeds([
    "merge-base",
    "--is-ancestor",
    receipt.source_commit,
    "HEAD"
  ])
    ? "candidate"
    : "promotion";
  assert.equal(result.mode, expectedMode);
  if (expectedMode === "promotion") {
    assert.match(result.promotionCommit, /^[0-9a-f]{40}$/u);
    assert.ok(
      gitSucceeds(["merge-base", "--is-ancestor", result.promotionCommit, "HEAD"]),
      "S3 promotion commit must remain on first-parent repository history"
    );
  } else {
    assert.equal(result.promotionCommit, null);
  }
  assert.equal(result.receipt.source_commit, receipt.source_commit);
  assert.equal(result.artifactCount, 25);
});

test("a synthetic direct-parent squash is permanently verifiable without source ancestry", async () => {
  const repositoryResult = await verifyS3Receipt();
  const promotionCommit = syntheticPromotionCommit(repositoryResult.promotionCommit ?? "HEAD");
  const result = await verifyS3Receipt({ promotionCommitOverride: promotionCommit });
  assert.equal(result.mode, "promotion");
  assert.equal(result.promotionCommit, promotionCommit);
});

test("a GitHub-style pull-request merge verifies its exact tree without masquerading as promotion", async () => {
  const head = git(["rev-parse", "HEAD"]);
  const mergeCommit = syntheticPullRequestMergeCommit(head);
  const replaceBase = "refs/s3-receipt-test-replace/";
  const replaceRef = `${replaceBase}${head}`;
  const previousReplaceBase = process.env.GIT_REPLACE_REF_BASE;
  git(["update-ref", replaceRef, mergeCommit]);
  process.env.GIT_REPLACE_REF_BASE = replaceBase;
  try {
    const result = await verifyS3Receipt();
    assert.equal(result.mode, "candidate");
    assert.equal(result.promotionCommit, null);
    assert.equal(git(["rev-parse", "HEAD^"]), receipt.base_commit);
  } finally {
    if (previousReplaceBase === undefined) delete process.env.GIT_REPLACE_REF_BASE;
    else process.env.GIT_REPLACE_REF_BASE = previousReplaceBase;
    git(["update-ref", "-d", replaceRef]);
  }
});

test("Verify and Deploy retain full main history without persisted credentials", async () => {
  const checkout = /uses: actions\/checkout@[^\r\n]+\r?\n\s+with:\r?\n\s+fetch-depth: 0\r?\n\s+persist-credentials: false/u;
  for (const workflow of ["verify.yml", "deploy-lab.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.match(source, checkout, `${workflow} checkout must retain receipt history`);
  }
});

test("source, base, path inventory, and artifact substitutions fail closed", async () => {
  await rejectsMutation(["source_commit"], receipt.base_commit);
  await rejectsMutation(["base_commit"], receipt.source_commit);
  const pathSubstitution = structuredClone(receipt);
  const value = pathSubstitution.artifact_digests["src/state/recovery.mjs"];
  delete pathSubstitution.artifact_digests["src/state/recovery.mjs"];
  pathSubstitution.artifact_digests["src/state/replacement.mjs"] = value;
  await assert.rejects(
    verifyS3Receipt({ receiptOverride: pathSubstitution }),
    /committed S3 receipt digest mismatch|artifact digest inventory mismatch/
  );
  await rejectsMutation(
    ["artifact_digests", "src/state/package.mjs"],
    `sha256:${"0".repeat(64)}`
  );
});

test("reference, verifier, and any-two recovery substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "reference_resource", "bytes"], 1048575],
    [["results", "reference_resource", "next_state_root"], "sha256:substituted"],
    [["results", "independent_verifier", "byte_identical"], false],
    [["results", "any_two_recovery", "passed"], 2],
    [["results", "any_two_recovery", "primary_relay_deleted"], false]
  ]) await rejectsMutation(path, value);
});

test("adversarial and recovery-semantics substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "adversarial_matrix", "stable_failures"], 10],
    [["results", "adversarial_matrix", "metadata_only_acceptances"], 1],
    [["results", "recovery_semantics", "missing_status"], "available"],
    [["results", "recovery_semantics", "resumable"], false],
    [["results", "recovery_semantics", "prior_active_state_preserved"], false],
    [["results", "recovery_semantics", "mortality_unchanged"], false]
  ]) await rejectsMutation(path, value);
});

test("legacy conformance, durable quorum, and portable substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "protocol_conformance", "passed"], 75],
    [["results", "property_cases", "failed"], 1],
    [["results", "durable_quorum", "loss_C_passed"], 99],
    [["results", "durable_quorum", "stale_signer_calls"], 1],
    [["results", "portable_contract", "adversarial_rejected"], 9999],
    [["results", "portable_contract", "node_browser_byte_identical"], false]
  ]) await rejectsMutation(path, value);
});

test("coverage and dependency substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "coverage_percent", "repository", "branches"], 89.99],
    [["results", "coverage_percent", "state_package", "branches"], 90],
    [["results", "coverage_percent", "state_recovery", "functions"], 99],
    [["results", "dependency_vulnerabilities", "total"], 1]
  ]) await rejectsMutation(path, value);
});

test("fixed limit and seed substitutions fail closed", async () => {
  for (const [path, value] of [
    [["limits", "chunk_bytes"], 65535],
    [["limits", "max_chunks"], 65],
    [["limits", "sources"], 9],
    [["seeds", "state_recovery_schedule"], 0],
    [["seeds", "state_recovery_schedule_count"], 9999]
  ]) await rejectsMutation(path, value);
});

test("commands, limitations, and review cannot be substituted", async () => {
  await rejectsMutation(
    ["known_limitations", 0],
    "A schema-valid substituted limitation."
  );
  await rejectsMutation(["review_snapshot"], "PASS without evidence");
  const command = structuredClone(receipt);
  command.commands[7] = structuredClone(command.commands[6]);
  await assert.rejects(
    verifyS3Receipt({ receiptOverride: command }),
    /committed S3 receipt digest mismatch/
  );
});

test("validation interval and environment substitutions fail closed", async () => {
  for (const [path, value] of [
    [["source_committed_at"], "2026-07-26T05:05:06.000Z"],
    [["completed_at"], "2026-07-26T05:05:03.000Z"],
    [["environment", "timezone"], "UTC"]
  ]) await rejectsMutation(path, value);
});

test("an otherwise unmodeled receipt-byte change fails the frozen digest", async () => {
  await rejectsMutation(
    ["commands", 0, "summary"],
    "A schema-valid substituted summary."
  );
});
