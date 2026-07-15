# Work log

This file is append-only. Each entry records the base commit, intended scope,
result, and reproducible verification.

## 2026-07-15 — Agent isolation bootstrap

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Branch: `agent/codex-protocol-kernel`
- Scope: define role boundaries and create a repository-tracked workspace/memory area
- Shared runtime files modified: none
- Result: role, durable memory, handoff protocol, and draft workspace established
- Validation: `main` remained at the fork point; the branch was exactly one commit
  ahead with only the six intended agent files; all remote blob SHAs matched the
  local files; `npm test` and the workspace secret-pattern scan passed

## 2026-07-15 — Agent collaboration and reviewer gate

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Branch: `agent/codex-protocol-kernel--agent-governance`
- Intended shared paths: agent policies, worktree/PR tooling, reviewer workspace,
  governance tests, PR template/workflow, `package.json`, and package exclusions
- Result: implemented isolated task-worktree creation, machine-readable PR policy,
  scoped agent memories, and an independent immutable-head reviewer/merge contract
- Verification: governance tests 10/10; full `npm test`; 98.69% line, 93.40%
  branch, and 100% function coverage; dependency audit 0 vulnerabilities; Node and
  actual Chromium corpus byte-identical with 10,000/10,000 adversarial rejections
- Handoff: `reviewer-merge-gate` must independently inspect and decide the PR

## 2026-07-15 — Governance trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: trusted PR workflow/template, agent governance documents,
  worktree/PR policy scripts, governance tests, and `package.json`
- Result: bound PR policy execution and evidence to immutable trusted-base code,
  required registered identities and complete changed/renamed-path declarations,
  and made worktree creation/resume fail closed for branch reuse, stale ancestry,
  incorrect upstreams, and restricted remote fetch refspecs; retained a tokenless,
  read-only public API path solely for the legacy workflow bootstrap
- Verification: full `npm test`; governance 25/25 at 91.91% line, 81.01% branch,
  and 93.48% function coverage; actual Chromium 149 differential with 10,000/10,000
  adversarial rejections; audit 0 vulnerabilities; package exclusion, YAML, syntax,
  and diff checks passed
- Handoff: local immutable commit to `reviewer-merge-gate` for independent decision;
  author did not push or approve its own work

## 2026-07-15 — Alternate-base and policy snapshot correction

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `a0d1e19a001e1922244dc1d5a6574758620ffc65`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: PR policy workflow/verifier/tests and their governance docs
- Result: added the platform-side `main` base filter, per-PR cancellation, API-body
  authority, event/API body binding, stable beginning/end PR snapshots, and exact
  paginated/declared changed-file-count binding
- Verification: governance 26/26 at 92.68% line, 84.39% branch, and 93.75%
  function coverage; full, Chromium, audit, package, syntax, YAML, and diff checks
  passed
- Handoff: preserve the rejected predecessor and submit a new immutable commit to
  `reviewer-merge-gate`; author must not push or self-approve

## 2026-07-15 — Reviewer snapshot attestation binding

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `5f41549437309eb59b94c2cb6783c31b1ad62941`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: reviewer/root/collaboration contracts and governance test
- Result: defined exact body and changed-file digests, expanded the structured PASS
  attestation, and required pre-merge revalidation of every mutable review field and
  the latest non-cancelled policy run
- Verification: full `npm test`; governance 27/27 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; Chromium 149 differential; audit, package, YAML,
  syntax, and diff checks passed
- Handoff: preserve prior commits and submit a new immutable commit for independent
  decision; author must not push or self-approve

## 2026-07-15 — Two-phase PR #3 trigger bootstrap

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `121f5269f1a1c146099d1aa936175c25670e3933`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: policy workflow, migration/reviewer contracts, and governance
  regression test
- Result: added a temporary zero-permission, no-checkout `pull_request` liveness marker
  alongside the separately conditioned trusted target job, bound permanent reviewer
  evidence to event `pull_request_target`, and specified the immediate cleanup lifecycle
- Verification: full `npm test`; governance 28/28 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; Chromium 149 differential; audit, package, YAML,
  syntax, and diff checks passed
- Handoff: reviewer publishes and confirms a real bootstrap run for PR #3; after merge,
  author creates a fresh target-only cleanup PR from new `main`

## 2026-07-15 — Split-workflow migration correction

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `0ab51f2b8514acd3bba14ee01d45c44f9cf9a91f`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: two PR policy workflow files, migration/reviewer contracts,
  governance test, and author ledgers; PR `Shared-Paths` must add
  `.github/workflows/trusted-pr-policy.yml`
- Result: moved trusted `pull_request_target` policy into a distinct permanent file
  and reduced the existing temporary file to one zero-permission untrusted marker;
  workflow/job names and concurrency are disjoint, so the bootstrap cannot manufacture
  or satisfy the trusted name-based check
- Verification: full `npm test`; governance 28/28 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; audit 0 vulnerabilities; YAML syntax, package dry-run,
  JavaScript syntax, and diff checks passed. Chromium needs a fresh published `Verify`
  run because this sandbox cannot download the missing browser binary.
- Handoff: preserve the corrected predecessor and submit this new immutable commit for
  independent review; author must not push or self-approve

## 2026-07-15 — Permanent governance migration cleanup

- Base: `e6dce59fb314266acdd855748a9b1fb996864e81`
- Branch: `agent/codex-protocol-kernel--governance-cleanup`
- Intended shared paths: delete the temporary PR policy workflow; update root,
  collaboration, reviewer, governance-test, and author-ledger contracts only
- Result: removed the completed PR #3 migration exception and reserved the permanent
  workflow/check identities for unchanged `trusted-pr-policy.yml`; the regression now
  enumerates every workflow and fails on any `pull_request`/trusted-name collision
- Verification: fresh `npm ci`; full `npm test`; governance 28/28 at 92.68% line,
  84.39% branch, and 93.75% function coverage; audit 0 vulnerabilities; YAML/static
  workflow semantics, package dry-run, JavaScript syntax, and diff checks passed;
  trusted workflow blob remained `94d2b0353fc44d931acd0a28604786a55e78786f`
- Handoff: submit an immutable seven-path cleanup commit for independent trusted-policy
  review; author must not push or self-approve

## Entry template

### YYYY-MM-DD — Task

- Base: `<commit>`
- Branch: `<branch>`
- Intended shared paths: `<paths or none>`
- Result: `<concise outcome>`
- Verification: `<commands, vectors, CI run, or review>`
- Handoff: `<agent/dependency or none>`
