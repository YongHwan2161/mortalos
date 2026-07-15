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
- Verification: governance tests 10/10; full `npm test`; the then-current coverage
  gate passed; dependency audit 0 vulnerabilities; Node and the then-current pre-v3
  actual Chromium corpus were byte-identical with 10,000/10,000 adversarial rejections.
  This historical run does not satisfy the later v3 exact-head gate
- Handoff: `reviewer-merge-gate` must independently inspect and decide the PR

## 2026-07-15 — Portable trust-boundary hardening

- Original base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Final reconciled base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Branch: `agent/codex-protocol-kernel--trust-boundaries`
- Intended shared paths: portable bytes/codec/crypto/validation/lineage core,
  schemas and rejection codes, deterministic vectors and tests, current protocol,
  threat/status/plan/traceability documentation, dependency notices, and CI timeout
- Result: hardened intrinsic byte snapshots and I-JSON canonicalization; strict
  Ed25519 point/scalar validation; total deterministic validators; activatable
  custody handoffs; recognized-head mortality with independently pooled body,
  signature, and sidecar components, strict-first recomposition, explicit usable-key
  completion, reentrancy protection, and pending-sibling fork recording; removed the
  caller-selected mortality API; added portable corpus v3 and H2 lifecycle trace v3
- Verification: clean `npm ci`; full `npm test`; 55/55 conformance; 10,000 mixed
  property cases (1,008 accepts/8,992 rejects); portable committed/Node/browser-target
  byte identity with 10,000/10,000 adversarial rejects; 98.46% line, `>=93.7%`
  branch across supported Node/V8 runs, and 100% function coverage; H2 digest
  `b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36`;
  audit 0 vulnerabilities; 61-file package dry-run; license/spec/governance gates pass
- Pre-reconciliation CI: publication candidate `9eae8c34` passed the then-current
  Agent PR Policy and the complete
  Verify workflow, including Node 22, actual Chromium differential verification,
  coverage, and dependency audit
- Handoff: the reconciled head must pass the new trusted target policy and complete
  Verify workflow before immutable-snapshot review

## 2026-07-15 — Governance trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: trusted PR workflow/template, agent governance documents,
  worktree/PR policy scripts, governance tests, and `package.json`
- Result: bound PR policy execution and evidence to immutable trusted-base code,
  required registered identities and complete changed/renamed-path declarations,
  and made worktree creation/resume fail closed for branch reuse, stale ancestry,
  incorrect upstreams, and restricted remote fetch refspecs; retained a tokenless,
  read-only public API path for local public-repository verification
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

## 2026-07-15 — Trusted target policy cleanup

- Base: `e6dce59fb314266acdd855748a9b1fb996864e81`
- Branch: `agent/codex-protocol-kernel--trusted-policy-cleanup`
- Intended shared paths: delete `.github/workflows/pr-policy.yml`; update `AGENTS.md`,
  this agent's handoff/worklog, the reviewer contract,
  `docs/AGENT_COLLABORATION.md`, and the governance regression test
- Result: removed the retired transition workflow and exception text; retained the
  permanent trusted-base policy unchanged; changed no runtime, protocol, schema, or
  product file
- Verification: governance 28/28; governance coverage 92.68% line, 84.39% branch,
  and 93.75% function; full `npm test`; audit 0 vulnerabilities; package dry-run 61
  files; YAML/JavaScript syntax, diff, scope, retired-language, and high-confidence
  secret scans passed; trusted workflow matched `origin/main` byte-for-byte at Git
  blob `94d2b0353fc44d931acd0a28604786a55e78786f` and SHA-256
  `42ad69df038be695f589bad02e01504215fef0058bac4d202ff82ba7ba042ee6`
- Handoff: focused immutable PR to `reviewer-merge-gate`; author does not merge or
  self-approve

## 2026-07-15 — HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

- Status: closed audit trail, not an active workflow or review exception
- Reviewer decisions: reject proposed-head policy self-validation; reject a combined
  migration workflow that let an untrusted run expose the trusted check name; accept
  only the split, zero-permission liveness marker as one-time migration evidence; and
  require normal target-only policy evidence after cleanup
- Merge anchors: PR #3 established the split trust boundary at
  `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the marker workflow and
  exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Permanent state: `.github/workflows/trusted-pr-policy.yml` alone owns
  `Agent PR Policy` / `Trusted main-base policy`, and its accepted event is only
  `pull_request_target`

## 2026-07-15 — Canonical workflow identity regression

- Base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: added repository-wide workflow enumeration and a dependency-free,
  fail-closed parser for exactly one canonical root block-form `on:` section with
  two-space event keys; adversarial quoted, flow, alias, inline-event, and duplicate
  variants are rejected, and trusted names/events are reserved to the unchanged
  trusted workflow
- Verification: fresh `npm ci`; full `npm test`; governance 29/29 at 92.68% line,
  84.39% branch, and 93.75% function coverage; audit 0 vulnerabilities; YAML 1.2,
  JavaScript syntax, docs/spec, trusted-workflow integrity, scope, and diff checks pass
- Handoff: focused three-path immutable commit to `reviewer-merge-gate`; author does
  not push, merge, or self-approve

## 2026-07-15 — Canonical workflow/check-name representation hardening

- Base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`; corrected local predecessor
  `57266ba29fa4eb8e652d3ad169388a91092eeb80`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression and append-only author ledgers only
- Result: replaced regex-only trusted-name ownership checks with fail-closed parsing
  of the root workflow name and job/check names; rejected comment-equivalent names,
  quoting, Unicode escapes, root/job folded scalars, flow/inline forms, aliases,
  duplicates, bad indentation, and malformed keys/values
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; audit 0 vulnerabilities; JavaScript syntax,
  trusted-workflow integrity, three-path scope, docs/spec, and diff checks pass
- Handoff: corrected immutable commit to `reviewer-merge-gate`; author does not push,
  merge, or self-approve

## 2026-07-15 — Multiline plain-scalar workflow identity hardening

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected rebased predecessor
  `767a5a5c8007b0ea6a3b107340b35c0efaead34f`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: closed the remaining YAML plain-scalar identity bypass by rejecting
  significant indented continuations after a canonical root workflow name or direct
  job/check name; added the exact `Agent` + `PR Policy` and `Trusted` +
  `main-base policy` multiline adversarial reproductions
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; 55/55 conformance; seeded 10,000-case property
  corpus; portable Node/browser-target equality and 10,000/10,000 adversarial
  rejects; license/spec/singleton/H2 gates; audit 0 vulnerabilities; trusted workflow
  unchanged at blob `94d2b0353fc44d931acd0a28604786a55e78786f`; three-path scope and diff checks pass
- Handoff: focused rebased local commit to `reviewer-merge-gate`; author does not push,
  merge, or self-approve

## 2026-07-15 — YAML lone-CR workflow identity hardening

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected local predecessor
  `bad47e5462725f5752d2a7a2eccf797f7c3d03c6`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: aligned every workflow-parser line split with YAML CRLF, LF, and standalone
  CR line breaks; added exact root/job identity counterfeits and a mixed-ending
  document that previously hid trusted names behind `run-name` or `timeout-minutes`
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; 55/55 conformance; seeded 10,000-case property
  corpus; portable Node/browser-target equality and 10,000/10,000 adversarial
  rejects; license/spec/singleton/H2 gates; audit 0 vulnerabilities; syntax, trusted
  workflow blob, three-path scope, historical-audit retention, and diff checks pass
- Handoff: focused local follow-up to `reviewer-merge-gate`; author does not push,
  merge, or self-approve

## Entry template

### YYYY-MM-DD — Task

- Base: `<commit>`
- Branch: `<branch>`
- Intended shared paths: `<paths or none>`
- Result: `<concise outcome>`
- Verification: `<commands, vectors, CI run, or review>`
- Handoff: `<agent/dependency or none>`
