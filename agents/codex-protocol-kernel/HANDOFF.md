# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — Signed bounded resource offer and lease contract

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`
- Work branch: `agent/codex-protocol-kernel--resource-offer-leases`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--resource-offer-leases`
- Exact intended shared paths: `package.json`, `protocol/profile.v1.json`,
  `src/generated/protocol-profile.mjs`, `src/crypto.mjs`,
  `src/rejection-codes.mjs`, new `src/resource-contract.mjs`, `src/index.mjs`,
  new `sdk/resource-contract.mjs`, `sdk/index.mjs`,
  new `test/resource-contract.test.mjs`, `test/protocol-profile.test.mjs`,
  `test/rejection-codes.test.mjs`, `test/sdk.test.mjs`,
  `scripts/verify-sdk-package.mjs`, `scripts/verify-spec.mjs`,
  `docs/PROTOCOL.md`, `docs/REJECTION_CODES.md`,
  new `docs/RESOURCE_CONTRACT.md`, `docs/README.md`,
  `docs/IMPLEMENTATION_PLAN.md`, `docs/CLAIM_MATRIX.md`,
  `docs/TRACEABILITY.md`, `docs/THREAT_MODEL.md`, and `README.md`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Intended change: define canonical, domain-separated, provider-signed bounded
  storage/bandwidth/compute offers; provider-and-consumer-signed single-use leases;
  chained cumulative usage receipts; unilateral signed offer/lease revocations; and
  an explicit-time deterministic evaluator with equivocation detection. The core
  owns no private key, clock, network, storage provider, scheduler, or server.
- Required gates: exact-key canonical envelopes, generated finite ceilings and every
  plus-one rejection; strict Ed25519 identity/signature binding; allocation and time
  containment; cumulative receipt monotonicity and fork/stale rejection; earliest
  revocation wins; two distinct leases for one offer fail closed as equivocation;
  accessor/Proxy/prototype/array mutations cannot alter accepted bytes; Node,
  browser-target, packed external-consumer, focused, and full verification pass;
  exact-head CI and immutable independent review pass before merge.
- Excluded: resource discovery, pricing/payment, reputation, NAT traversal, WebRTC
  carriage (pending PR #55), physical provider independence, automatic scheduling,
  package-registry publication, and any S7/S8 production claim.
- Candidate validation: focused resource/profile `12/12`, SDK `4/4`, clean packed
  consumer, specification/link checks, existing conformance `76/76`, portable
  `10,000/10,000`, and full `npm test` PASS in `3,329.6s`. The full run covered
  `21 direct / 119 auto-discovered` async security boundaries, actual browser/Lab,
  confidentiality, continuity, and historical S0-S4 receipt regressions.
- Remaining gate: commit/push, exact-head CI, immutable independent review, GitHub
  App attestation plus machine-user native approval, expected-head merge, and
  exact-main readback. Signed logical contract, delivery, and provider independence
  remain separate claims.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
