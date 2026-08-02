# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — Real-file product continuity vertical ready for immutable review

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `2dc63b2f8f43aa2a458a77035bf8933e973634c3`
- Work branch: `agent/codex-protocol-kernel--product-continuity-vertical`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--product-continuity-vertical`
- Exact intended shared paths: `package.json`, `sdk/index.mjs`,
  new `sdk/continuity.mjs`,
  `cli/mortalos.mjs`, new `cli/node-authority.mjs`,
  new `src/continuity.mjs`, `src/capsule.mjs`, `src/index.mjs`,
  new `lab/product-continuity.mjs`, `lab/app.mjs`,
  new `test/continuity.test.mjs`, new `test/continuity-node-endpoint.mjs`,
  `test/sdk.test.mjs`,
  new `scripts/verify-continuity-chromium.mjs`,
  `scripts/verify-browser-parity.mjs`, `scripts/verify-sdk-package.mjs`,
  `security/async-entrypoints.json`, `scripts/verify-security-boundaries.mjs`,
  `README.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/CLAIM_MATRIX.md`,
  and `docs/TRACEABILITY.md`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Intended change: expose one public create/inspect/handoff/recover/continue API and
  matching CLI; move a caller-supplied real file through the existing state-package,
  relay-fragment data plane, canonical Capsule, 2-of-3 custody, A-to-B acceptance,
  A process exit, B recovery, and next transition; run the same contract in Node,
  packed-package CLI, actual browser contexts, and the built Lab.
- Required gates: all borrowed mutable inputs and signer methods are owned before
  the first await; every returned signature is verified; private key material is
  absent from every exchanged/public artifact; one corrupt copy recovers exact bytes;
  valid fork, stale head, wrong authority, and one-copy recovery fail closed; clean
  packed consumer uses no repository-relative import; normal full CI, immutable
  independent review, expected-head merge, and exact post-merge readback pass.
- Excluded: package registry publication, claim promotion without a new receipt,
  physical provider independence, WebKit full signing, and changing existing S2/S4
  nonclaims.
- Candidate validation: pre-lock full `npm test` PASS in `2542.8s` and browser
  parity PASS in `207.3s`; post-lock continuity Node `5/5`, clean packed consumer,
  cross-process conflicting sign-once serialization, and security inventory
  `21 direct / 119 auto-discovered` PASS. Exact-head CI must supersede the earlier
  full run before review.
- Remaining gate: final commit/push, exact-head CI, immutable reviewer freeze, GitHub App
  attestation plus machine-user native approval, expected-head merge, post-merge CI,
  and exact-main readback. No receipt or production claim is promoted by local PASS.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
