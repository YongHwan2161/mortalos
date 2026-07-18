# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Preserve strict CSP at the Cloudflare edge

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `3f482227b73e899d292ae98b13913b213e099150`
- Work branch: `agent/codex-protocol-kernel--preserve-csp`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/wt-custom-origin`
- Exact intended shared paths: `lab/_headers`, `scripts/lab-contract.mjs`, and
  `test/lab.test.mjs`.
- Exact intended agent path: `agents/codex-protocol-kernel/HANDOFF.md`.
- Contract affected: retain `no-store` while adding the standards-defined
  `no-transform` response directive so Cloudflare cannot inject an analytics beacon
  that violates the Lab's self-only script CSP. Protocol, scenario, and kernel
  validity semantics do not change.
- Required evidence: focused Lab tests; full repository suite; exact-head policy
  and Verify; immutable independent review; expected-head merge; exact-main deploy;
  absence of the injected beacon; and three-context Chromium acceptance.
- Expected handoff: one focused reviewed CSP-preservation PR from current `main`.
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
