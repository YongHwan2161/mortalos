# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

### ACTIVE — Resource-bounded mortality observation

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`
- Work branch: `agent/codex-protocol-kernel--north-star-foundation`
- Intended paths (exact):
  - `agents/codex-protocol-kernel/HANDOFF.md`
  - `agents/codex-protocol-kernel/MEMORY.md`
  - `agents/codex-protocol-kernel/WORKLOG.md`
  - `README.md`
  - `docs/ACCESS_ARCHITECTURE.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PROTOCOL.md`
  - `docs/REJECTION_CODES.md`
  - `docs/THREAT_MODEL.md`
  - `docs/TRACEABILITY.md`
  - `scripts/verify-portable.mjs`
  - `scripts/verify-spec.mjs`
  - `src/lineage.mjs`
  - `test/mortality.test.mjs`
  - `test/portable-corpus.mjs`
  - `test/vectors/portable-expected.json`
- Contract affected: fixed mortality-observer resource limits and the portable
  `indeterminate` / `limit_exceeded` result; no accepted-object or wire-format change
- Required evidence: focused mortality limits, complete conformance/property/portable
  suites, actual Chromium differential, trusted-core coverage, audit, package scan,
  trusted Agent PR Policy, Verify, and immutable-head review
- Expected handoff: a focused P0 safety PR; the reviewer must reject truncation that
  could turn excessive pending evidence into a death or life classification

## Completed handoffs

### 2026-07-16 — H3A browser Lab merged

- PR: `#8`; squash merge on `main`:
  `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`
- Result: the local one-page Lab, three volatile Worker custodians, reference
  experiments, canonical export/replay, complete portable corpus, and actual-browser
  cross-origin-isolated SAB rejection passed review and post-merge verification
- Handoff: H3B public HTTPS deployment is a separate delivery task; the portable
  kernel remains the sole validity authority

### 2026-07-15 — Mortality-proof correction merged

- PR: `#7`; final reviewed head:
  `bc914d676b29a58efcd2ce6647ab04c727f10df3`
- Squash merge on `main`:
  `9791074ffe8f091b8007e09f2b3edd4080d4212b`
- Result: conservative sign-once-aware mortality, semantic-invalid sidecar handling,
  explicit irreversibility precedence, and current-base records passed independent
  review plus pre- and post-merge Verify
- Handoff: H3A may now consume the portable kernel without reopening the death proof

### 2026-07-15 — YAML lone-CR workflow identity hardening

- Main base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected local predecessor
  `bad47e5462725f5752d2a7a2eccf797f7c3d03c6`
- Work branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Exact changed paths: `test/agent-governance.test.mjs` and this author's append-only
  `HANDOFF.md`/`WORKLOG.md`; no workflow, runtime, protocol, or governing-doc change
- Reviewer finding: YAML recognizes a standalone carriage return as a line break,
  while `/\r?\n/` left it embedded in one JavaScript line. A later trusted root name
  after `run-name: harmless\r` or trusted job name after `timeout-minutes: 1\r`
  could therefore remain semantically active while invisible to identity ownership.
- Result: every workflow-parser line split now handles CRLF, LF, and standalone CR.
  Exact root-name and job-name lone-CR counterfeits plus one CRLF/LF/CR mixed-ending
  document are permanent adversarial fixtures.
- Author validation: full `npm test`; governance 30/30 at 92.68% line, 84.39%
  branch, and 93.75% function coverage; 55/55 conformance; seeded 10,000-case
  property corpus; portable Node/browser-target equality with 10,000/10,000
  adversarial rejects; license, spec, singleton, and H2 verification; audit 0
  vulnerabilities; JavaScript syntax, trusted-workflow integrity, three-path scope,
  historical-audit retention, and diff checks pass
- Integrity: `.github/workflows/trusted-pr-policy.yml` remains byte-identical to
  `f08c8be0fa43d86d706d67dfc56f577cf1a90f72` at Git blob
  `94d2b0353fc44d931acd0a28604786a55e78786f`
- Handoff: reviewer publishes the focused follow-up, reruns the exact CR byte
  fixtures plus trusted policy and `Verify`, and decides the immutable snapshot
  independently; author does not push, merge, or self-approve

### 2026-07-15 — Multiline plain-scalar workflow identity hardening

- Main base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected rebased
  predecessor `767a5a5c8007b0ea6a3b107340b35c0efaead34f`
- Work branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Exact changed paths: `test/agent-governance.test.mjs` and this author's append-only
  `HANDOFF.md`/`WORKLOG.md`; no workflow, runtime, protocol, or governing-doc change
- Reviewer finding: YAML folds an indented continuation of a plain scalar, so
  `name: Agent` followed by `  PR Policy` (and the analogous job-name form) retained
  the semantic trusted identity while the earlier parser saw only the first line
- Result: canonical root and job names now fail closed when a later significant line
  can continue the scalar. Exact root-name and job-name multiline reproductions are
  permanent adversarial tests alongside the existing comment, quoting, escape,
  folded-scalar, flow, alias, duplicate, and indentation cases.
- Author validation: full `npm test`; governance 30/30 at 92.68% line, 84.39%
  branch, and 93.75% function coverage; 55/55 conformance; seeded 10,000-case
  property corpus; portable Node/browser-target equality with 10,000/10,000
  adversarial rejects; license, spec, singleton, and H2 verification; audit 0
  vulnerabilities; trusted-workflow integrity, three-path scope, and diff checks pass
- Integrity: `.github/workflows/trusted-pr-policy.yml` remains byte-identical to
  `f08c8be0fa43d86d706d67dfc56f577cf1a90f72` at Git blob
  `94d2b0353fc44d931acd0a28604786a55e78786f`
- Handoff: reviewer publishes the focused rebased commit, reruns the exact multiline
  adversarials plus trusted policy and `Verify`, and decides the immutable snapshot
  independently; author does not push, merge, or self-approve

### 2026-07-15 — Post-merge mortality-proof correction prepared

- Final reconciled `main` base:
  `e332bdf639f6b8c4e39186087cde5e0470f7846f`; initial post-PR-#2 base:
  `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`
- Historical comparison base: PR #2 head
  `00af46d53dc4bf02882925e57ae9396d6ae99cca`
- Reviewed correction source: `fe27a4cc601335a0458269b13808312499f439cf`
- Work branch: `agent/codex-protocol-kernel--mortality-proof-correction`
- Paths: canonical codec and portability scan; lineage/validator mortality core;
  codec, mortality, portable-corpus/scenario tests and expected vector; current
  protocol/threat/status/plan/traceability/access/rejection docs; spec gate; and
  this agent's handoff/memory/worklog
- Result: preserved carrier-independent body/signature/sidecar recomposition,
  reentrant-mutation protection, one early usable-key snapshot, and canonical
  reconstructed-fork regressions; added data-only intrinsic-slot canonicalization,
  private lineage construction, sign-once-aware projection/equivocation, heartbeat
  fallback, and conditional payload-opaque membership uncertainty after irreversible
  authority loss when no fresh quorum or verified latent child independently
  establishes non-death
- Author validation: full `npm test`; 58/58 conformance; 10,000 mixed property
  cases; portable committed/Node/browser-target equality and 10,000/10,000 rejects;
  actual Headless Chromium 149 byte equality; 98.05% line, at least 93.38% branch
  across validated Node/V8 runs, and 100% function coverage; H2 v3 digest unchanged;
  audit 0 vulnerabilities; 61-file
  package dry-run; license/spec/governance/diff gates pass
- Historical CI retained: publication candidate `9eae8c34` passed the preceding
  exact-head Node 22/actual-Chromium workflow; the newly published head must rerun CI
- Handoff: publish as a new focused PR from current `main` and submit its immutable
  head to `reviewer-merge-gate`; do not modify the already merged PR #2 branch

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

### 2026-07-15 — Canonical workflow/check-name representation hardening

- Main base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`; corrected local predecessor
  `57266ba29fa4eb8e652d3ad169388a91092eeb80`
- Work branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Exact changed paths: `test/agent-governance.test.mjs` and this author's append-only
  `HANDOFF.md`/`WORKLOG.md`; no workflow or governing implementation changed
- Reviewer finding: YAML comments preserved the semantic trusted workflow/check names
  while evading the earlier exact-name regular expressions
- Result: the fail-closed parser now extracts a canonical plain root workflow name,
  canonical block-form jobs, and canonical job/check names in addition to events.
  Commented, quoted, Unicode-escaped, folded-scalar, flow/inline, alias, duplicate,
  mis-indented, and malformed identity representations are rejected.
- Author validation: full `npm test`; governance 30/30 at 92.68% line, 84.39%
  branch, and 93.75% function coverage; audit 0 vulnerabilities; JavaScript syntax,
  trusted-workflow integrity, three-path scope, docs/spec, and diff checks pass
- Handoff: reviewer publishes the corrected immutable tree and reruns the exact
  comment/Unicode/folded adversarial reproductions plus trusted policy and `Verify`;
  author does not push, merge, or self-approve

### 2026-07-15 — Canonical workflow identity regression

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Main base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Work branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Exact changed paths: `test/agent-governance.test.mjs` and this author's append-only
  `HANDOFF.md`/`WORKLOG.md`; no workflow, runtime, protocol, or governing-doc change
- Result: every `.github/workflows/*.yml`/`*.yaml` file is enumerated; one canonical
  root block-form `on:` is required; two-space event keys are extracted; and quoted,
  flow, alias, inline-event, duplicate, or malformed trigger forms fail closed. Only
  `trusted-pr-policy.yml` may own the trusted workflow/check identities and its sole
  event must be `pull_request_target`.
- Author validation: fresh `npm ci`; full `npm test`; governance 29/29 at 92.68% line,
  84.39% branch, and 93.75% function coverage; audit 0 vulnerabilities; YAML 1.2,
  JavaScript syntax, docs/spec, trusted-workflow integrity, scope, and diff checks pass
- Integrity: `.github/workflows/trusted-pr-policy.yml` remains byte-identical to the
  base at blob `94d2b0353fc44d931acd0a28604786a55e78786f`
- Handoff: reviewer publishes one focused three-path PR, requires normal trusted
  target policy plus `Verify`, and decides the immutable snapshot independently;
  author does not push, merge, or self-approve

### 2026-07-15 — HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

- Status: closed history only; this record grants no active exception, trigger, or
  merge instruction
- Sequence: the reviewer rejected proposed-head `pull_request` self-validation, then
  rejected a combined transition whose untrusted run could expose the trusted check
  name. The author split the zero-permission liveness marker from the target-only
  policy before PR #3 merged as
  `e6dce59fb314266acdd855748a9b1fb996864e81`.
- Retirement: PR #5 merged as `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
  and deleted the marker workflow and one-time reviewer exception
- Current decision boundary: only the normal `Agent PR Policy` run with event
  `pull_request_target` and job/check `Trusted main-base policy` is review evidence;
  no historical marker or exception may be reused

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
