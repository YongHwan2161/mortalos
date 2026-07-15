# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

- None.

## Completed handoffs

### 2026-07-15 — Portable-kernel trust-boundary hardening

- Original base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Final reconciled base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Work branch: `agent/codex-protocol-kernel--trust-boundaries`
- Paths: portable trusted core, schemas/rejection codes, deterministic vectors and
  tests, current protocol/threat/status/plan/traceability/access/submission docs,
  direct dependency notices, package lock, and CI timeout
- Author validation: clean locked install and full Node suite passed; 55/55
  conformance; 10,000 mixed property cases; portable v3 committed/Node/browser-target
  equality and 10,000/10,000 adversarial rejects; 98.46% line, `>=93.7%` branch,
  and 100% function coverage across supported Node runs (branch accounting varies
  slightly with Node/V8); H2 v3 golden; audit, license, spec, governance, package,
  diff, and source-portability gates passed
- Independent findings resolved: mortality now combines durable evidence with
  explicitly usable current signers, reconstructs bodies/signatures/sidecars across
  misleading carriers by cryptographic verification, blocks reentrant mutation,
  records recomposed valid sibling forks, and does not re-export its internal
  conditional validator from the supported `src/index.mjs` API;
  sparse/exotic programmatic values and hostile context getters also fail closed
- Pre-reconciliation CI evidence: publication candidate `9eae8c34` passed the
  then-current Agent PR Policy and every
  Verify step, including Node 22, actual Chromium differential verification,
  coverage, and dependency audit. The reconciled head must rerun the new trusted
  policy and the complete Verify workflow.
- Handoff: after the reconciled head passes all gates, `reviewer-merge-gate` must
  bind its attestation to the new base/head/body/file-evidence snapshot

### 2026-07-15 — Trusted target policy cleanup

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Main base: `e6dce59fb314266acdd855748a9b1fb996864e81`
- Work branch: `agent/codex-protocol-kernel--trusted-policy-cleanup`
- Paths: deleted `.github/workflows/pr-policy.yml`; updated `AGENTS.md`,
  `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/WORKLOG.md`,
  `agents/reviewer-merge-gate/README.md`, `docs/AGENT_COLLABORATION.md`, and
  `test/agent-governance.test.mjs`; no runtime, protocol, schema, or product file
- Result: retired the one-time transition path and exception; permanent tests now
  require the trusted policy to expose only `pull_request_target`, require the former
  workflow path to be absent, and reject stale exception language in governing docs
- Author validation: governance 28/28; governance coverage 92.68% line, 84.39%
  branch, and 93.75% function; full `npm test`; dependency audit 0 vulnerabilities;
  package dry-run 61 files; YAML and JavaScript syntax, diff, runtime-scope,
  transition-language, and high-confidence secret scans passed
- Integrity: `.github/workflows/trusted-pr-policy.yml` remained byte-identical to
  `origin/main` with Git blob `94d2b0353fc44d931acd0a28604786a55e78786f` and
  SHA-256 `42ad69df038be695f589bad02e01504215fef0058bac4d202ff82ba7ba042ee6`
- Handoff: publish one focused immutable PR and require the normal trusted target
  policy, `Verify`, and independent `reviewer-merge-gate` PASS; do not merge as author

### 2026-07-15 — Reviewer snapshot attestation binding

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `5f41549437309eb59b94c2cb6783c31b1ad62941`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: reviewer/root/collaboration contracts, governance regression test, and
  author handoff/worklog; no runtime or `src/` change
- Result: reviewer PASS evidence now binds base/head, exact API-body digest,
  changed-file count/digest, and latest non-cancelled policy run ID/attempt/status;
  any pre-merge snapshot movement requires a complete restart
- Author validation: full `npm test`; governance 27/27 with 92.68% line, 84.39%
  branch, and 93.75% function coverage; Chromium 149 differential; dependency,
  package, syntax, YAML, and diff checks passed
- Handoff: follow-up commit requires a fresh independent review decision

### 2026-07-15 — Alternate-base and policy snapshot correction

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `a0d1e19a001e1922244dc1d5a6574758620ffc65`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: trusted PR workflow, policy verifier/tests, and governance documentation;
  no `src/` protocol or wire-format change
- Result: GitHub now filters the workflow to `main`-base PRs before runner execution;
  per-PR concurrency cancels obsolete runs; event/API bodies and beginning/end
  body/ref/SHA/changed-file-count snapshots must remain identical, and pagination
  must return exactly the API-declared file count
- Author validation: governance 26/26 with 92.68% line, 84.39% branch, and 93.75%
  function coverage; full and Chromium checks passed; dependency, package, syntax,
  YAML, and diff checks passed before immutable-head handoff
- Handoff: follow-up commit requires a fresh independent review decision

### 2026-07-15 — PR governance trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: trusted PR workflow/template, agent governance documentation,
  worktree/PR policy scripts, governance tests, and `package.json`; no `src/`
  protocol or wire-format change
- Result: policy code now executes only from the immutable PR base with read-only
  permissions; declarations and GitHub API ancestry/path evidence fail closed; new
  worktrees reject existing branches and explicit resume rejects stale, local-only,
  wrongly tracked, behind, or diverged branches; local public-repository verification
  can obtain the same read-only API evidence without an exported token
- Author validation: full `npm test`; governance 25/25 with 91.91% line, 81.01%
  branch, and 93.48% function coverage; actual Chromium 149 differential 10,000/10,000;
  dependency audit 0 vulnerabilities; package exclusion, YAML, syntax, and diff checks
  passed
- Handoff: ready for immutable-head review by `reviewer-merge-gate`
### 2026-07-15 — Agent-isolated contribution and reviewer merge gate

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Work branch: `agent/codex-protocol-kernel--agent-governance`
- Paths: `AGENTS.md`, `agents/**`, `docs/AGENT_COLLABORATION.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, the PR policy workflow,
  `scripts/create-agent-worktree.mjs`, `scripts/verify-agent-pr.mjs`,
  `test/agent-governance.test.mjs`, `package.json`, and `.npmignore`
- Author validation: governance 10/10, full `npm test`, coverage, dependency audit,
  and the then-current pre-v3 actual Chromium differential verification passed; this
  historical result does not satisfy the trust-boundary branch's v3 exact-head gate
- Handoff: ready for immutable-head review by `reviewer-merge-gate`

## Before changing shared paths

Add an active entry containing:

- task and reason
- exact intended paths
- base `main` commit
- expected validation
- expected handoff or pull request

Then check the current remote `main`, open pull requests, and other agent ledgers.
If another agent is already modifying the same semantics, coordinate or split the
work before writing code.

## Handoff template

### `<status>` Task name

- From / to: `<agent-id>`
- Base: `<commit>`
- Intended paths: `<paths>`
- Contract affected: `<protocol/API/schema/docs>`
- Required evidence: `<tests or review>`
- Notes: `<short context>`
