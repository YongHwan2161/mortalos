# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — Recenter development on one end-to-end continuity product path

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `12e90e6199b16b5379a6d4c1caa62cd24f7446e5`
- Work branch: `agent/codex-protocol-kernel--product-continuity-docs`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--product-continuity-docs`
- Exact intended shared paths: `README.md`, `docs/README.md`,
  `docs/CLAIM_MATRIX.md`, new `docs/IMPLEMENTATION_PLAN.md`,
  retired `docs/NORTH_STAR_ROADMAP.md`,
  `docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md`,
  `docs/STAGE_TRACKING.md`, `docs/archive/README.md`,
  `scripts/verify-links.mjs`, and `scripts/verify-spec.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Intended change: replace the security-first current priority with the user-directed
  product priority; make one file-to-Capsule-to-recovery-to-next-transition vertical
  slice the North Star; rename the sole active implementation SSOT; fold duplicate
  roadmap and stage ledgers into it; preserve normative and historical evidence.
- Required gates: no runtime/package/schema change; all claims distinguish merged
  implementation from promoted evidence; internal Markdown links pass; spec and
  governance checks pass; diff contains no credential or generated artifact; exact
  head receives normal CI and independent review before merge.
- Excluded: deleting historical evidence, cleaning any dirty worktree, publishing
  the package, changing production, claiming independent failure domains, or
  implementing the product vertical in this documentation-only change.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
