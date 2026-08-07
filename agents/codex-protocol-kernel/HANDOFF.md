# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — Lease-bound execution receipt vertical

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`
- Work branch: `agent/codex-protocol-kernel--resource-offer-leases`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--resource-offer-leases`
- Exact intended shared paths: `package.json`, `package-lock.json`,
  `protocol/profile.v1.json`,
  `src/generated/protocol-profile.mjs`, `src/crypto.mjs`,
  `src/rejection-codes.mjs`, new `src/resource-contract.mjs`,
  new `src/resource-execution.mjs`, `src/index.mjs`,
  `src/transport/protocol.mjs`,
  new `sdk/resource-contract.mjs`, `sdk/index.mjs`,
  new `test/resource-contract.test.mjs`, new `test/resource-execution.test.mjs`,
  new `test/resource-execution-node-endpoint.mjs`,
  new `test/resource-execution-process.test.mjs`, `test/protocol-profile.test.mjs`,
  `test/rejection-codes.test.mjs`, `test/sdk.test.mjs`, `test/transport.test.mjs`,
  `scripts/verify-sdk-package.mjs`, `scripts/verify-spec.mjs`,
  `docs/PROTOCOL.md`, `docs/REJECTION_CODES.md`,
  new `docs/RESOURCE_CONTRACT.md`, `docs/README.md`,
  `docs/IMPLEMENTATION_PLAN.md`, `docs/CLAIM_MATRIX.md`,
  `docs/TRACEABILITY.md`, `docs/THREAT_MODEL.md`, and `README.md`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/MEMORY.md`, and
  `agents/codex-protocol-kernel/WORKLOG.md`.
- Intended change: retain the signed bounded offer, lease, witness, usage, and
  revocation contract, and add a separate lease-bound execution-evidence layer.
  A consumer-signed unpredictable challenge and provider/consumer-signed chained
  execution receipt bind the exact offer, lease, consumption, workload, result,
  cumulative usage receipt, participant identities, and prior execution receipt.
  Storage uses a content-root challenge proof, bandwidth proves a challenge payload
  round trip, and compute verifies a deterministic bounded hash-chain result. A
  dedicated evaluator requires a one-to-one usage/execution chain before reporting
  proved execution. The core owns no private key, clock, network, storage provider,
  scheduler, witness service, or server.
- Required gates: exact-key canonical envelopes, generated finite ceilings and every
  plus-one rejection; strict Ed25519 identity/signature binding; allocation and time
  containment; cumulative receipt monotonicity and fork/stale rejection; earliest
  revocation wins; two distinct leases for one offer fail closed as equivocation;
  witness sets are sorted, unique, provider/consumer-disjoint, and satisfy
  `n >= 3f + 1`, `q <= n - f`, and `2q > n + f`; below-threshold partitions remain
  `unwitnessed`; threshold announcements activate exactly one lease; a witness
  signing two lease IDs for one offer produces deterministic equivocation evidence;
  accessor/Proxy/prototype/array mutations cannot alter accepted bytes; Node,
  browser-target, packed external-consumer, focused, and full verification pass;
  exact-head CI and immutable independent review pass before merge. An actual child
  provider process must execute all three workload classes, retain its private key,
  terminate, and be replaced only under a newly signed lease preserving the exact
  workload ID; replay, cross-lease, fork, stale, tampered proof, unsigned usage, and
  old-provider continuation all fail closed.
- Excluded: resource discovery, pricing/payment, reputation, NAT traversal, concrete
  WebRTC carriage (pending PR #55), physical witness/provider independence,
  Byzantine-fault truth beyond the offer's declared policy, automatic scheduling,
  package-registry publication, and any S7/S8 production claim.
- Candidate validation after independent-review remediation: focused resource/profile `22/22`, transport `8/8`, SDK
  `4/4`, clean packed external offer -> lease -> 3-of-4 witness gossip -> proved
  compute execution receipt, actual child-provider storage/bandwidth/compute plus
  death/new-lease reassignment, specification/link/profile checks, conformance `76/76`, portable
  `10,000/10,000`, async security boundaries `21 direct / 119 auto-discovered`,
  dependency audit with zero vulnerabilities, `git diff --check`, and fresh full
  `npm test` PASS in `2,963s`. The full chain includes actual Chromium durability,
  multi-browser/Lab/UX, confidentiality, continuity, and historical S0-S4 receipt
  regressions.
- First immutable review BLOCKed provider/consumer key reuse and announcement-only
  nested-object verification. The candidate now rejects role reuse at lease validation,
  reserializes announcement leases to canonical bytes, and carries exact regressions.
- Remaining gate: commit/push, exact-head CI, immutable independent re-review, GitHub
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
