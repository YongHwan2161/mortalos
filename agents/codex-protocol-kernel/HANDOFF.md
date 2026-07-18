# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Custom domain qualification and documentation consolidation

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `03e868ccd810064e81275a7ac2d71b543030b916`
- Work branch: `agent/codex-protocol-kernel--custom-domain-docs`
- Worktree:
  `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--release-evidence-freeze-worktrees/codex-protocol-kernel--custom-domain-docs`
- Exact intended shared paths: `README.md`, `wrangler.jsonc`, `test/lab.test.mjs`,
  `docs/README.md`,
  `docs/NORTH_STAR_ROADMAP.md`, `docs/BUILD_WEEK_EVIDENCE.md`,
  `docs/ACCESS_ARCHITECTURE.md`, `docs/TRACEABILITY.md`, removal of superseded
  submission/planning Markdown, `scripts/verify-links.mjs`, and
  `scripts/verify-spec.mjs`.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Contract affected: retain the verified Pages hostname while qualifying
  `https://mortal-os.com/`; target the D1/OpenAI-backed Function to
  `aws:us-east-1` after the observed HKG platform 502; consolidate documentation
  into a small current SSOT; define strict pre-deadline R1-C/R2 gates. Protocol and
  Lab validity semantics do not change.
- Required evidence: focused config/Lab/spec/link tests; full repository suite;
  coverage/audit/package/secret/diff gates; exact-head policy and Verify; immutable
  independent review; expected-head merge; post-merge Pages deploy; custom-domain
  exact-source/API/three-context Chromium acceptance; and final Devpost readback.
- Expected handoff: one focused reviewed remediation/SSOT PR from current `main`.
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
