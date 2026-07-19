# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Implement and release S0–S12 multi-browser digital-life candidate

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `8930992e5483c6b645af197348d5725a8648bd09`
- Work branch: `agent/codex-protocol-kernel--multi-browser-bilingual-plan`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--multi-browser-bilingual-plan`
- Exact intended shared areas: root/package/license notices; `.github/workflows/verify.yml`
  and `deploy-lab.yml`; `docs/` current/normative set; `functions/api/scenarios.js`;
  `lab/` UI, i18n, participant, storage, transport, evidence, endpoint, header, and
  license files; `relay/`; `r1/javascript/` and `r1/python/`; `schemas/`; `scripts/`
  build/deploy/spec/state/transport/quorum/UX/Lab verifiers; `src/` kernel/state/
  transport; and matching `test/` suites/vectors.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`,
  and `WORKLOG.md`.
- Contract affected: the site moves from an L0 single-browser/GPT-centered proof to
  one bilingual state-bearing organism whose custody moves A→B without private-key
  transfer; A loss after handoff permits B continuation, while premature loss stalls.
  A/B/C `2-of-3` evidence covers every one-endpoint loss and repair. R1/state remain
  local authority; relay, UI, Cloudflare, order, and optional GPT remain untrusted.
- Cost boundary: production GPT is disabled and its secrets are not injected until a
  confirmed Turnstile widget/secret exists. The deterministic main journey remains
  fully available.
- Required local evidence: license/spec/link/governance/conformance/property/i18n/
  state/transport/relay/multi-browser/Lab/R1/build/UX/portable/singleton/H2 through
  `npm test`; actual Chromium portable and Lab gates; coverage, audit, package,
  secret, diff, and clean-clone checks.
- Required release evidence: immutable independent review bound to the exact head,
  expected-head merge, post-merge Verify, exact relay and Pages deployment, manifest
  equality, English/Korean public A→B and quorum/negative acceptance, rollback
  record, and Devpost/video readback.
- Expected handoff: one immutable candidate PR from current `main`. The author does
  not self-review, merge, or push directly to `main`.

## Closed intents

All earlier Build Week runtime, D1, MIME, canonical-root, R1-A/R1-B, custom-domain,
release-evidence, and submission intents are closed. Their immutable SHAs, review
decisions, failures, and verification evidence remain in `WORKLOG.md` and Git history.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or review exception. PR #3
established the split trust boundary at
`e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the migration marker and
exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current policy workflow
remains `.github/workflows/trusted-pr-policy.yml`.
