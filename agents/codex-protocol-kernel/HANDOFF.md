# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Promote the accepted canonical domain

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`
- Work branch: `agent/codex-protocol-kernel--canonical-domain`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/wt-custom-origin`
- Exact intended shared paths: `README.md`, `.github/workflows/deploy-lab.yml`,
  `docs/README.md`, `docs/BUILD_WEEK_EVIDENCE.md`,
  `docs/NORTH_STAR_ROADMAP.md`, `docs/ACCESS_ARCHITECTURE.md`, and
  `docs/TRACEABILITY.md`.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Contract affected: make `https://mortal-os.com/` the canonical judge and deploy-
  verification URL only after its exact-source, CORS/GPT, fixed-scenario, and three-
  context Chromium gates passed. Preserve `pages.dev` as fallback and leave protocol,
  scenario, kernel, and model-authority semantics unchanged.
- Required evidence: current public custom-host acceptance; Devpost public/required-
  field readback; spec/link/governance/workflow checks; full exact-head Verify;
  immutable independent review; expected-head merge; and exact-main custom deploy.
- Expected handoff: one reviewed canonical-domain reconciliation PR from current `main`.
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
