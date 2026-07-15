# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

- None.

## Completed handoffs

### 2026-07-15 — Portable-kernel trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
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
- CI evidence: publication candidate `9eae8c34` passed Agent PR Policy and every
  Verify step, including Node 22, actual Chromium differential verification,
  coverage, and dependency audit. Every changed head must rerun the same gates.
- Handoff: ready for immutable-head review by `reviewer-merge-gate`; the local
  browser download endpoint returned an empty archive, so actual-browser evidence
  comes from the recorded GitHub CI run

### 2026-07-15 — Agent-isolated contribution and reviewer merge gate

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Work branch: `agent/codex-protocol-kernel--agent-governance`
- Paths: `AGENTS.md`, `agents/**`, `docs/AGENT_COLLABORATION.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/pr-policy.yml`,
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
