# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Exact-origin custom-domain API bridge

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `f23a4d501f89a4798d6d2a490000117774c69457`
- Work branch: `agent/codex-protocol-kernel--custom-origin-bridge`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/wt-custom-origin`
- Exact intended shared paths: `functions/api/scenarios.js`, `lab/app.mjs`,
  `lab/runtime-endpoints.mjs`, `lab/index.html`, `lab/_headers`,
  `scripts/lab-contract.mjs`, `scripts/verify-gpt-scenarios.mjs`,
  `scripts/verify-lab.mjs`,
  `test/scenario-api.test.mjs`, `test/lab.test.mjs`, and the current README,
  roadmap, release-evidence, access, traceability, and agent status documents.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Contract affected: when and only when the page origin is `https://mortal-os.com`,
  send the bounded scenario request to the exact accepted Pages API origin. Permit
  only that origin pair through CSP and CORS/preflight; retain same-origin behavior
  elsewhere and reject every other cross-origin request. Protocol and Lab validity
  semantics do not change.
- Required evidence: focused CORS/CSP/Lab tests; full repository suite;
  coverage/audit/package/secret/diff gates; exact-head policy and Verify; immutable
  independent review; expected-head merge; exact-main deploy; custom-domain
  preflight/valid API/three-context Chromium acceptance; and final canonical switch.
- Expected handoff: one focused reviewed origin-bridge PR from current `main`.
  The author does not self-review, merge, or push directly to `main`.

## Closed intents

All earlier Build Week runtime, D1, MIME, canonical-root, R1-A/R1-B, release-evidence,
and submission intents are closed. Their immutable SHAs, review decisions, failures,
and verification evidence remain in `WORKLOG.md` and Git history.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or review exception. PR #3
established the split trust boundary at
`e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the migration marker and
exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current policy workflow
remains `.github/workflows/trusted-pr-policy.yml`.
