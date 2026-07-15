# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

### ACTIVE — H3A browser Lab vertical slice

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Work branch: `agent/codex-protocol-kernel--h3-lab`
- Intended paths: `lab/**`, `scripts/build-lab.mjs`, `scripts/serve-lab.mjs`,
  `scripts/verify-lab.mjs`, `test/lab*.test.mjs`, `package.json`,
  `scripts/verify-spec.mjs`, `.github/workflows/verify.yml`, `README.md`,
  `docs/IMPLEMENTATION_PLAN.md`,
  `docs/PROJECT_STATUS.md`, `docs/SINGLE_BROWSER_INCUBATOR.md`,
  `docs/TRACEABILITY.md`, `docs/SUBMISSION_CHECKLIST.md`, and this agent's
  `README.md`, `MEMORY.md`, `WORKLOG.md`, and `HANDOFF.md`
- Contract affected: no consensus-rule change; browser adapter, demo surface,
  executable acceptance gate, and planning/status documentation
- Required evidence: unit tests, three clean Chromium contexts using real
  non-extractable Ed25519 keys, exact 10,000-case portable corpus comparison,
  exported-trace replay, CSP/request audit, full `npm test`, coverage,
  Chromium differential verification, and dependency audit
- Expected handoff: draft PR with immutable head for `reviewer-merge-gate`
- Notes: H3A intentionally excludes public deployment and independent endpoint
  handoff; the page must disclose `3 logical custodians / 1 physical failure
  domain` and qualify page-close mortality claims.

## Completed handoffs

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
