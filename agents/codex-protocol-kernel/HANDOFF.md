# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

None.

## Completed handoffs

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
  wrongly tracked, behind, or diverged branches; the public legacy-workflow bootstrap
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
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/pr-policy.yml`,
  `scripts/create-agent-worktree.mjs`, `scripts/verify-agent-pr.mjs`,
  `test/agent-governance.test.mjs`, `package.json`, and `.npmignore`
- Author validation: governance 10/10, full `npm test`, coverage, dependency audit,
  and actual Chromium differential verification passed
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
