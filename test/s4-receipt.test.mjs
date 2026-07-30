import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyS4Receipt } from "../scripts/verify-s4-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(await readFile(
  new URL("../evidence/stages/s4-confidentiality.json", import.meta.url),
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
      input: "test-only S4 squash snapshot\n",
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
      input: "test-only S4 pull-request merge snapshot\n",
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
    verifyS4Receipt({ receiptOverride: mutate(path, value) }),
    /committed S4 receipt digest mismatch|source commit mismatch|base commit mismatch|must be equal to constant/
  );
}

test("the committed S4 receipt binds the exact source snapshot and strict results", async () => {
  const result = await verifyS4Receipt();
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
    assert.ok(gitSucceeds(["merge-base", "--is-ancestor", result.promotionCommit, "HEAD"]));
  } else {
    assert.equal(result.promotionCommit, null);
  }
  assert.equal(result.artifactCount, 35);
});

test("a synthetic direct-parent squash is permanently verifiable without source ancestry", async () => {
  const repositoryResult = await verifyS4Receipt();
  const promotionCommit = syntheticPromotionCommit(repositoryResult.promotionCommit ?? "HEAD");
  const result = await verifyS4Receipt({ promotionCommitOverride: promotionCommit });
  assert.equal(result.mode, "promotion");
  assert.equal(result.promotionCommit, promotionCommit);
});

test("a GitHub-style pull-request merge verifies its exact tree without masquerading as promotion", async () => {
  const repositoryResult = await verifyS4Receipt();
  const head = git(["rev-parse", "HEAD"]);
  const promotionTreeish = repositoryResult.promotionCommit ?? head;
  const mergeCommit = syntheticPullRequestMergeCommit(promotionTreeish);
  const replaceBase = "refs/s4-receipt-test-replace/";
  const replaceRef = `${replaceBase}${head}`;
  const previousReplaceBase = process.env.GIT_REPLACE_REF_BASE;
  git(["update-ref", replaceRef, mergeCommit]);
  process.env.GIT_REPLACE_REF_BASE = replaceBase;
  try {
    const result = await verifyS4Receipt();
    assert.equal(result.mode, "candidate");
    assert.equal(result.promotionCommit, null);
    assert.equal(git(["rev-parse", "HEAD^"]), receipt.base_commit);
  } finally {
    if (previousReplaceBase === undefined) delete process.env.GIT_REPLACE_REF_BASE;
    else process.env.GIT_REPLACE_REF_BASE = previousReplaceBase;
    git(["update-ref", "-d", replaceRef]);
  }
});

test("Verify and Deploy retain full history and enforce all promoted stage receipts", async () => {
  const checkout = /uses: actions\/checkout@[^\r\n]+\r?\n\s+with:\r?\n\s+fetch-depth: 0\r?\n\s+persist-credentials: false/u;
  for (const workflow of ["verify.yml", "deploy-lab.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8");
    assert.match(source, checkout, `${workflow} checkout must retain receipt history`);
    for (const stage of ["s2", "s3", "s4"]) {
      assert.match(source, new RegExp(`npm run verify:${stage}`, "u"));
    }
  }
});

test("source, base, path inventory, and artifact substitutions fail closed", async () => {
  await rejectsMutation(["source_commit"], receipt.base_commit);
  await rejectsMutation(["base_commit"], receipt.source_commit);
  const substitution = structuredClone(receipt);
  const value = substitution.artifact_digests["src/confidential/recovery.mjs"];
  delete substitution.artifact_digests["src/confidential/recovery.mjs"];
  substitution.artifact_digests["src/confidential/replacement.mjs"] = value;
  await assert.rejects(
    verifyS4Receipt({ receiptOverride: substitution }),
    /committed S4 receipt digest mismatch|artifact digest inventory mismatch/
  );
  await rejectsMutation(
    ["artifact_digests", "src/confidential/package.mjs"],
    `sha256:${"0".repeat(64)}`
  );
});

test("cryptography and published vector substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "cryptography", "content_cipher"], "AES-128-GCM"],
    [["results", "cryptography", "iv_bytes"], 16],
    [["results", "cryptography", "private_unwrap_key_extractable"], true],
    [["results", "cryptography", "recovered_epoch_key_decrypt_only"], false],
    [["results", "published_vectors", "accepted"], 1],
    [["results", "published_vectors", "wycheproof_commit"], "0".repeat(40)]
  ]) await rejectsMutation(path, value);
});

test("nonce and browser authority substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "nonce_uniqueness", "records"], 999999],
    [["results", "nonce_uniqueness", "duplicate_ivs"], 1],
    [["results", "nonce_uniqueness", "single_cas_winner"], 2],
    [["results", "browser_counter_authority", "full_process_restart"], false],
    [["results", "browser_counter_authority", "same_nonextractable_sign_only_key"], false],
    [["results", "browser_counter_authority", "next_counter_after_restart"], "1"],
    [["results", "browser_counter_authority", "private_record_branded"], false],
    [["results", "browser_counter_authority", "store_capability_private_record"], false],
    [["results", "browser_counter_authority", "own_method_replacement_rejected"], false],
    [["results", "browser_counter_authority", "prototype_method_replacement_ignored"], false],
    [["results", "browser_counter_authority", "retirement_persisted"], false],
    [["results", "browser_counter_authority", "post_retirement_reservation_rejected"], false],
    [["results", "browser_counter_authority", "lost_rotation_completed"], false],
    [["results", "browser_counter_authority", "equivocation_rotation_completed"], false],
    [["results", "browser_counter_authority", "old_authority_blocked_after_equivocation"], false],
    [["results", "browser_counter_authority", "successor_substitution_rejected"], false],
    [["results", "browser_counter_authority", "recipient_substitution_rejected"], false]
  ]) await rejectsMutation(path, value);
});

test("capture, any-two recovery, and rotation substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "ciphertext_capture", "relay_plaintext_occurrences"], 1],
    [["results", "ciphertext_capture", "ciphertext_only_s3"], false],
    [["results", "any_two_recovery", "passed"], 2],
    [["results", "any_two_recovery", "primary_relay_deleted"], false],
    [["results", "membership_and_rotation", "removed_member_future_epoch_denied"], false],
    [["results", "membership_and_rotation", "new_epoch_activated_atomically"], false],
    [["results", "membership_and_rotation", "observed_equivocation_retires_bound_authority"], false],
    [["results", "membership_and_rotation", "forged_equivocation_evidence_rejected"], false],
    [["results", "membership_and_rotation", "fake_lost_authority_rejected"], false],
    [["results", "membership_and_rotation", "subclass_authority_rejected"], false],
    [["results", "membership_and_rotation", "proxy_authority_rejected"], false],
    [["results", "membership_and_rotation", "public_method_override_ignored"], false],
    [["results", "membership_and_rotation", "persistent_facade_rotation_supported"], false],
    [["results", "membership_and_rotation", "rotation_requires_validator_branded_head"], false],
    [["results", "membership_and_rotation", "rotation_requires_current_quorum_signatures"], false],
    [["results", "membership_and_rotation", "hidden_fork_global_detection_claimed"], true]
  ]) await rejectsMutation(path, value);
});

test("failure and status substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "failure_matrix", "unexpected_acceptances"], 1],
    [["results", "failure_matrix", "failover_local_reservation_calls"], 1],
    [["results", "failure_matrix", "authentication_tag_rejected"], false],
    [["results", "resource_boundary", "max_plaintext_resource_bytes"], 3098891],
    [["results", "resource_boundary", "max_confidential_package_bytes"], 4194304],
    [["results", "resource_boundary", "max_plus_one_rejected"], false],
    [["results", "resource_boundary", "custodian_seventeen_rejected"], false],
    [["results", "status_separation", "decryption_failure_is_not_mortality"], false],
    [["results", "status_separation", "missing_authority_is_not_reconstructed_from_ciphertext"], false]
  ]) await rejectsMutation(path, value);
});

test("legacy, portable, coverage, and dependency substitutions fail closed", async () => {
  for (const [path, value] of [
    [["results", "protocol_conformance", "passed"], 75],
    [["results", "property_cases", "failed"], 1],
    [["results", "portable_contract", "modules"], 21],
    [["results", "portable_contract", "node_browser_byte_identical"], false],
    [["results", "coverage_percent", "counter", "branches"], 90],
    [["results", "dependency_vulnerabilities", "total"], 1]
  ]) await rejectsMutation(path, value);
});

test("limits, seeds, commands, limitations, and review cannot be substituted", async () => {
  for (const [path, value] of [
    [["limits", "counter_max_exclusive"], "4294967295"],
    [["limits", "epoch_max"], "18446744073709551616"],
    [["limits", "max_custodians"], 17],
    [["limits", "package_bytes"], 5000000],
    [["limits", "resource_bytes"], 3098891],
    [["seeds", "million_iv_records"], 999999],
    [["known_limitations", 0], "A schema-valid substituted limitation."],
    [["review_snapshot"], "PASS without evidence"]
  ]) await rejectsMutation(path, value);
  const command = structuredClone(receipt);
  command.commands[7] = structuredClone(command.commands[6]);
  await assert.rejects(
    verifyS4Receipt({ receiptOverride: command }),
    /committed S4 receipt digest mismatch/
  );
});

test("validation interval and environment substitutions fail closed", async () => {
  for (const [path, value] of [
    [["source_committed_at"], "2026-07-26T18:15:01.000Z"],
    [["completed_at"], "2026-07-26T18:14:59.000Z"],
    [["environment", "timezone"], "UTC"]
  ]) await rejectsMutation(path, value);
});
