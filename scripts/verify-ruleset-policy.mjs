import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  ["Trusted main-base policy", "protocol"]
);
assert.equal(identity.format, "mortalos-reviewer-identity-policy/1");
assert.equal(identity.native_approval.required, true);
assert.equal(identity.native_approval.require_last_push_approval, true);
assert.notEqual(identity.logical_reviewer, identity.implementation_principal);
if (identity.provisioned_reviewer_principal === null) {
  assert.equal(identity.status, "HOLD_PENDING_SEPARATE_GITHUB_IDENTITY");
}
console.log(`MortalOS repository ruleset policy: PASS (${identity.status})`);
