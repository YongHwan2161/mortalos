import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const ruleset = JSON.parse(await readFile(
  new URL("../.github/rulesets/main.json", import.meta.url),
  "utf8"
));
const identity = JSON.parse(await readFile(
  new URL("../.github/reviewer-identity-policy.json", import.meta.url),
  "utf8"
));

assert.equal(ruleset.enforcement, "active");
assert.deepEqual(ruleset.bypass_actors, []);
assert.deepEqual(ruleset.conditions.ref_name.include, ["~DEFAULT_BRANCH"]);
const byType = Object.fromEntries(ruleset.rules.map((rule) => [rule.type, rule]));
for (const type of [
  "deletion",
  "non_fast_forward",
  "required_linear_history",
  "pull_request",
  "required_status_checks"
]) assert.ok(byType[type], `missing ruleset rule: ${type}`);
const pull = byType.pull_request.parameters;
assert.equal(pull.required_approving_review_count, 1);
assert.equal(pull.dismiss_stale_reviews_on_push, true);
assert.equal(pull.require_last_push_approval, true);
assert.equal(pull.required_review_thread_resolution, true);
const checks = byType.required_status_checks.parameters;
assert.equal(checks.strict_required_status_checks_policy, true);
assert.deepEqual(
  checks.required_status_checks.map(({ context }) => context).sort(),
  ["MortalOS Reviewer Attestation", "Trusted main-base policy", "browser-parity", "protocol"]
);
const attestation = checks.required_status_checks.find(
  ({ context }) => context === "MortalOS Reviewer Attestation"
);
assert.equal(attestation.integration_id, 4456370);
assert.equal(identity.format, "mortalos-reviewer-identity-policy/2");
assert.equal(identity.native_approval.required, true);
assert.equal(identity.native_approval.require_last_push_approval, true);
assert.notEqual(identity.logical_reviewer, identity.implementation_principal);
assert.equal(identity.provisioned_reviewer_principal.login, "ant713900-web");
assert.equal(identity.provisioned_reviewer_principal.principal_type, "machine_user");
assert.equal(identity.provisioned_reviewer_principal.required_repository_role, "write");
assert.deepEqual(identity.provisioned_reviewer_principal.repository_scope, ["YongHwan2161/mortalos"]);
assert.equal(identity.provisioned_reviewer_principal.ruleset_bypass, false);
assert.equal(identity.provisioned_reviewer_principal.separate_credential, true);
assert.equal(identity.provisioned_reviewer_principal.separate_human_or_administrator, false);
assert.equal(identity.attestation_check.context, "MortalOS Reviewer Attestation");
assert.equal(identity.attestation_check.github_app.app_id, 4456370);
assert.equal(identity.attestation_check.github_app.installation_id, 150549191);
assert.equal(identity.attestation_check.github_app.slug, "mortalos-review-gate");
assert.equal(identity.attestation_check.required, true);
assert.equal(identity.attestation_check.exact_head_required, true);
assert.equal(identity.runner.version, "mortalos-reviewer-gate/1");
assert.match(identity.runner.binary_sha256, /^[0-9a-f]{64}$/u);
assert.equal(identity.runner.execution_boundary, "outside_pr_controlled_github_actions");
assert.equal(identity.runner.repository_secret_forbidden, true);
assert.deepEqual(identity.runner.required_snapshot_fields, [
  "head_sha",
  "body_sha256",
  "base_sha",
  "changed_files_sha256",
  "diff_sha256",
  "policy_run",
  "required_check_runs",
  "reviewer_version"
]);
assert.equal(identity.account_security.two_factor_authentication, "required");
assert.equal(identity.account_security.passkey, "required");
assert.equal(identity.account_security.recovery_material, "outside_repository");
assert.equal(identity.account_security.login_alerts, "required");
assert.equal(identity.account_security.live_preflight_required, true);
assert.equal(identity.status, "ACTIVE_SEPARATE_MACHINE_IDENTITY_SAME_OPERATOR");
const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
for (const filename of await readdir(workflowDirectory)) {
  if (!/\.ya?ml$/u.test(filename)) continue;
  const source = await readFile(new URL(filename, workflowDirectory), "utf8");
  assert.doesNotMatch(
    source,
    /MORTALOS_(?:REVIEWER|REVIEW_GATE)|REVIEWER_(?:TOKEN|PRIVATE_KEY|GH_CONFIG)/u,
    `${filename} must not receive reviewer or attester credentials`
  );
}
console.log(`MortalOS repository ruleset policy: PASS (${identity.status})`);
