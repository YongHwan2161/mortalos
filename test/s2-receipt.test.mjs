import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyS2Receipt } from "../scripts/verify-s2-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(await readFile(
  new URL("../evidence/stages/s2-durable-quorum.json", import.meta.url),
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

function syntheticPromotionCommit() {
  const tree = git(["write-tree"]);
  return git(
    ["commit-tree", tree, "-p", receipt.base_commit],
    {
      input: "test-only S2 squash snapshot\n",
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
    verifyS2Receipt({ receiptOverride: mutate(path, value) }),
    /committed S2 receipt digest mismatch|source commit mismatch|base commit mismatch|must be equal to constant/
  );
}

test("the committed S2 receipt binds the exact source snapshot and strict results", async () => {
  const result = await verifyS2Receipt();
  assert.equal(result.mode, "candidate");
  assert.equal(result.receipt.source_commit, receipt.source_commit);
  assert.equal(result.artifactCount, 28);
});

test("a synthetic direct-parent squash is permanently verifiable without source ancestry", async () => {
  const promotionCommit = syntheticPromotionCommit();
  const result = await verifyS2Receipt({ promotionCommitOverride: promotionCommit });
  assert.equal(result.mode, "promotion");
  assert.equal(result.promotionCommit, promotionCommit);
});

test("Verify and Deploy retain full main history without persisted credentials", async () => {
  const checkout = /uses: actions\/checkout@[^\r\n]+\r?\n\s+with:\r?\n\s+fetch-depth: 0\r?\n\s+persist-credentials: false/u;
  for (const workflow of ["verify.yml", "deploy-lab.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.match(source, checkout, `${workflow} checkout must retain receipt history`);
  }
});

test("source, base, path inventory, and artifact digest substitutions fail closed", async () => {
  await rejectsMutation(["source_commit"], receipt.base_commit);
  await rejectsMutation(["base_commit"], receipt.source_commit);
  const pathSubstitution = structuredClone(receipt);
  const value = pathSubstitution.artifact_digests["docs/DURABLE_QUORUM.md"];
  delete pathSubstitution.artifact_digests["docs/DURABLE_QUORUM.md"];
  pathSubstitution.artifact_digests["docs/REPLACEMENT.md"] = value;
  await assert.rejects(
    verifyS2Receipt({ receiptOverride: pathSubstitution }),
    /committed S2 receipt digest mismatch|artifact digest inventory mismatch/
  );
  await rejectsMutation(
    ["artifact_digests", "lab/storage/durable-store.mjs"],
    `sha256:${"0".repeat(64)}`
  );
});

test("handoff, one-loss, fault, and sign-once substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "cold_process_handoffs", "passed"], 99],
    [["results", "single_endpoint_loss_repair", "C", "passed"], 99],
    [["results", "fault_matrix", "unexpected_outcomes"], 1],
    [["results", "sign_once", "conflicting_second_signatures"], 1]
  ]) await rejectsMutation(path, value);
});

test("concurrent writers cannot substitute signer or journal outcomes", async () => {
  for (const [path, value] of [
    [["results", "concurrent_compare_and_swap", "signatures_returned"], 2],
    [["results", "concurrent_compare_and_swap", "stale_signer_calls"], 1],
    [["results", "concurrent_compare_and_swap", "persisted_journal_entries"], 2],
    [["results", "concurrent_compare_and_swap", "stale_writer_error"], "PASS"]
  ]) await rejectsMutation(path, value);
});

test("successful migration retirement and post-removal key erasure substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "migration", "successful_store_names", 0], "keys"],
    [["results", "migration", "legacy_stores_removed_on_success"], "HOLD"],
    [["results", "migration", "empty_v1_document_absent"], false],
    [["results", "migration", "empty_v1_store_names", 0], "meta"],
    [["results", "migration", "empty_v1_legacy_stores_removed"], "HOLD"],
    [["results", "migration", "removal_status"], "active"],
    [["results", "migration", "participant_key_absent_after_removal"], false],
    [["results", "migration", "legacy_key_absent_after_removal"], false],
    [["results", "migration", "legacy_raw_signing_after_removal"], true]
  ]) await rejectsMutation(path, value);
});

test("failed migration retention and corruption substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "corruption_matrix", "partial_journal"], "HOLD"],
    [["results", "migration", "invalid_old_versions_retained"], false],
    [["results", "migration", "removed_with_key_v1_aborted"], "HOLD"],
    [["results", "migration", "active_without_key_v1_aborted"], "HOLD"]
  ]) await rejectsMutation(path, value);
});

test("expiry latch, bounded renewal, and removal substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "authority_policy", "expiry_latch_persisted"], "HOLD"],
    [["results", "authority_policy", "same_process_clock_rollback_prevented"], "HOLD"],
    [["results", "authority_policy", "cold_restart_clock_rollback_prevented"], "HOLD"],
    [["results", "authority_policy", "null_renewal_rejected"], "HOLD"],
    [["results", "authority_policy", "stale_or_equal_renewal_rejected"], "HOLD"],
    [["results", "authority_policy", "status_after_rejected_renewals"], "active"],
    [["results", "authority_policy", "explicit_future_renewal_required"], "HOLD"],
    [["results", "authority_policy", "hard_coded_30_day_lifetime"], true]
  ]) await rejectsMutation(path, value);
});

test("topology, command, limitation, review, and coverage substitutions fail closed", async () => {
  for (const [path, value] of [
    [["topology_digest"], `sha256:${"0".repeat(64)}`],
    [["known_limitations", 0], "A substituted but schema-valid limitation."],
    [["review_snapshot"], "PASS without evidence"],
    [["results", "repository_coverage_percent", "branches"], 92.24]
  ]) await rejectsMutation(path, value);
  const command = structuredClone(receipt);
  command.commands[7] = structuredClone(command.commands[6]);
  await assert.rejects(
    verifyS2Receipt({ receiptOverride: command }),
    /committed S2 receipt digest mismatch/
  );
});

test("validation interval and environment substitutions fail closed", async () => {
  for (const [path, value] of [
    [["source_committed_at"], "2026-07-25T20:27:06.000Z"],
    [["completed_at"], "2026-07-25T20:27:03.000Z"],
    [["environment", "timezone"], "UTC"]
  ]) await rejectsMutation(path, value);
});

test("an otherwise unmodeled receipt-byte change fails the frozen digest", async () => {
  await rejectsMutation(
    ["commands", 0, "summary"],
    "A schema-valid substituted summary."
  );
});
