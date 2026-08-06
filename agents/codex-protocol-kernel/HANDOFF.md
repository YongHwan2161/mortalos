# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — Restore hostless North Star and implement direct WebRTC participants

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`
- Work branch: `agent/codex-protocol-kernel--hostless-webrtc-participants`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--hostless-webrtc-participants`
- Exact intended shared paths: `README.md`, `docs/README.md`,
  `docs/CLAIM_MATRIX.md`, `docs/IMPLEMENTATION_PLAN.md`,
  `docs/ACCESS_ARCHITECTURE.md`, `lab/participant/direct-session.mjs`,
  `lab/transport/webrtc-peer.mjs`, `scripts/build-lab.mjs`,
  `scripts/verify-spec.mjs`, `scripts/verify-webrtc-participants.mjs`,
  `test/webrtc-transport.test.mjs`, and `package.json`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Intended change: restore the original participant-owned, no-fixed-authoritative-
  backend North Star; add manually signaled WebRTC DataChannel transport; compose it
  with the browser participant flow; prove that loaded peers continue after origin
  and relay access are denied; keep Cloudflare as optional static bootstrap or
  non-authoritative convenience only.
- Required gates: deterministic unit/fault tests; strict bounded signaling and frame
  parsing; real two-process Chromium direct exchange; origin/relay cut before
  Genesis followed by successful custody and continuation after A's process exits;
  EN/KO and accessibility checks; full `npm test`; no credential/generated artifact;
  exact-head review before merge.
- Excluded: token economics, arbitrary untrusted compute, production deployment,
  claiming physical device independence from same-host tests, or making STUN/TURN,
  Cloudflare, a domain, UI, or signaling service authoritative.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
