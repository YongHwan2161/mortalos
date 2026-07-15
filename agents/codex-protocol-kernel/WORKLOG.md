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

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
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
- Handoff: local Playwright download returned an empty archive, so actual Node 22
  Chromium equivalence remains mandatory in PR CI before immutable-head review

## Entry template

### YYYY-MM-DD — Task

- Base: `<commit>`
- Branch: `<branch>`
- Intended shared paths: `<paths or none>`
- Result: `<concise outcome>`
- Verification: `<commands, vectors, CI run, or review>`
- Handoff: `<agent/dependency or none>`
