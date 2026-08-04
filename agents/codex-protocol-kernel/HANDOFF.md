# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### READY FOR INDEPENDENT REVIEW — Provider possession and minimal continuity UI

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`
- Work branch: `agent/codex-protocol-kernel--s7-s8-provider-recovery-ui`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--s7-s8-provider-recovery-ui`
- Exact changed shared paths: `package.json`, `package-lock.json`,
  `THIRD_PARTY_NOTICES.md`, `sdk/continuity.mjs`,
  new `src/provider/possession.mjs`, new `provider/worker.mjs`,
  new `provider/wrangler.jsonc`, new `provider/vitest.config.mjs`,
  new `lab/distributed/http-possession-provider.mjs`,
  new `lab/distributed/possession-provider-service.mjs`,
  new `scripts/verify-independent-provider-topology.mjs`,
  new `scripts/run-provider-runtime-tests.mjs`,
  new `test/provider-possession.test.mjs`,
  new `test/provider-runtime.test.mjs`, `security/async-entrypoints.json`,
  `lab/index.html`, `lab/styles.css`, `lab/app.mjs`,
  `lab/i18n/ko.mjs`, `scripts/verify-ux.mjs`,
  `scripts/verify-lab.mjs`, `scripts/verify-sdk-package.mjs`,
  `scripts/verify-license.mjs`, `test/sdk.test.mjs`,
  `README.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/CLAIM_MATRIX.md`,
  `docs/THREAT_MODEL.md`, `docs/DISTRIBUTED_COUNTER_AUTHORITY_ADR.md`,
  and new `docs/PROVIDER_POSSESSION_TOPOLOGY.md`.
- Exact agent path: `agents/codex-protocol-kernel/HANDOFF.md`.
- Intended change: make each durable provider sign its own possession receipt only
  after bounded write/readback; pin receipt keys to a topology manifest; recover the
  same Capsule and exact file from any two providers while one provider process is
  actually terminated and then repaired; add a Cloudflare SQLite Durable Object
  implementation for provider-runtime parity. Reduce the default EN/KO site to the
  one A-to-B continuity journey, showing only the action relevant to the current
  endpoint and moving research workbenches off the default visual path.
- Required gates: provider capabilities and mutable inputs are captured before the
  first await; provider identity, copy descriptor, object digest/size, account,
  region, credential, administrator, and failure-domain bindings are signed and
  verified; duplicate provider/key/topology domains and forged/stale receipts fail
  closed; one process is actually killed, 2-of-3 recovers exact bytes, the provider
  restarts and repairs; Workers-runtime tests and dry-run config validation pass;
  default EN/KO pages have one visible primary action, no advanced controls, no
  horizontal overflow, WCAG automated checks, and the full two-browser path passes.
- Excluded: claiming genuinely independent cloud accounts or administrators from
  self-declared local identities, inducing a real third-party regional outage,
  package-registry publication, S1-S4 claim re-promotion, or weakening the existing
  browser/signer and global-availability nonclaims. Those require independently
  controlled credentials and provider evidence not present in this checkout.
- Completed gates: locked install and zero-vulnerability audit; 23-direct/121-export
  async security audit; provider unit negatives; actual three-process loss, exact
  recovery, storage-loss restart/repair, and second-process loss; Durable Object
  SQLite eviction/corruption tests and Worker dry-run; clean packed consumer; default
  EN/KO one-action UX; automated two-browser completion; portable 10,000-case
  differential; full S2 100/100 Chromium handoff plus A/B/C 100/100 loss/repair;
  remaining conformance, confidentiality, relay, multi-browser, Lab, R1, S3, and S4
  regression gates.
- Remaining gate: publish this exact candidate, obtain immutable independent review on
  that exact head, then merge. External three-account/provider/admin proof and live
  deployment remain separate HOLD gates.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
