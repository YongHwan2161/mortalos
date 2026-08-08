# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### ACTIVE — confidential controller closeout, exact commit, and static Lab deployment

- Branch: `agent/codex-protocol-kernel--p2p-placement-repair`
- Base: `25de18d8c1af8b3dfcb5adffb1a07538afa33332`
- Worktree: `work/mortalos-worktrees/codex-protocol-kernel--p2p-placement-repair`
- Shared paths declared for this task: `src/transport/`, `src/placement/`,
  `src/confidential/`, `src/index.mjs`, `sdk/`, `cli/`, `lab/`, `test/`,
  `scripts/`, `security/`, `package.json`, `wrangler.jsonc`, `README.md`,
  `CONTRIBUTING.md`, and `docs/`.
- User-directed scope expands this agent role to implement real browser P2P
  transport plus the storage-first placement/repair vertical. The implementation
  must reuse existing offer, lease, challenge, usage, execution-receipt, and
  continuity contracts; it must not make discovery, signaling, relay, UI, or a
  fixed backend a validity authority.
- Placement is usable only after exact-lease storage execution evaluates to
  `proved`. Provider loss invalidates availability and repair requires a new
  provider offer and a new mutual lease while preserving content/workload identity.
- Required evidence includes Node process loss/repair, actual Chromium peer data
  channels with origin/relay cut after bootstrap, Lab parity, packed-consumer
  operation, corrupt/single/stale/fork/cross-lease/revoked/exhausted/duplicate-
  provider rejection, and explicit physical-independence HOLD.
- Focused policy, Node process, transport, Chromium origin-cut, SDK, clean package,
  Lab build, portable `10,000/10,000`, and async security-inventory gates pass
  locally. The final ordered `npm test` passed in `4,168.7s`. The first full run
  correctly BLOCKed a WebRTC adapter under portable `src/`; moving it to the Lab
  browser-platform layer preserved actual browser behavior and restored the
  network-free portable boundary. Exact-head CI, independent review, merge,
  exact-main verification, deployment, and promotion have not run.
- The confidential controller is implemented locally: S4 package 2-of-3 shards,
  shard/provider/workload identity binding, exact proof-age boundary, crash-safe
  canonical journal, post-restart direct-successor proof requirement, deterministic
  repair plan, and successor-owned new leases after A exits.
- The user now authorizes implementation, commit, and deployment of that P0. The
  candidate must compose existing S4 ciphertext packages with placement, use exact
  proof-age boundaries and predecessor chains, recover controller state from
  canonical public evidence, and pass at least 100 seeded loss/partition/restart/
  repair cycles in Node plus actual Chromium. `npm run test:p2p-placement` now passes
  12 Node cases and both actual Chromium verticals. Deployment may occur only from a
  clean exact commit and must not convert Cloudflare Pages into storage, scheduling,
  custody, discovery, or validity authority.
- `origin/main` was freshly fetched at
  `25de18d8c1af8b3dfcb5adffb1a07538afa33332`; it equals this task base. Wrangler
  `4.114.0` is installed, but CLI authentication is currently absent and remains a
  deployment-time gate rather than a reason to weaken source verification.
- Final exact-source ordered `npm test` PASS in `3,101.1s` after append-only
  generation-pointer hardening and pointer-to-journal generation binding,
  including the new P2P gates and all
  existing browser/stage verifiers. Remaining closeout: final documentation/spec/
  link/audit readback, clean exact commit, Cloudflare authentication, exact-commit static Pages
  deployment, and public artifact readback. The next architectural P0 after this
  closeout is lineage-bound distributed controller handoff and repair convergence.

### HISTORICAL CONTEXT — Receipt-gated participant placement and repair

- The lease-bound execution vertical is merged by PR #56 at
  `0779741402244d6cd802a1179bd2c94555bdd030` after exact-head CI, independent
  BLOCK remediation/re-review, GitHub App attestation, machine-user native approval,
  and no-bypass expected-head squash merge.
- Exact-main Verify `31215007053` passed protocol and browser parity; Deploy
  `31215005995` passed exact-source publication plus public artifact, relay, and
  bilingual-path readback.
- The first closeout CI run then failed only its live dependency audit after GitHub
  advisory `GHSA-2v37-7h3g-55p8` was refreshed. The compatible transitive lock is
  patched from `nanoid@3.3.16` to `3.3.18`; no runtime source or direct dependency
  changed, and a fresh zero-vulnerability audit plus exact-head CI are required.
- This historical gap motivated the current candidate that composes untrusted offer
  gossip, mutual leases, direct participant transport, verified execution receipts,
  and repair. Full encrypted Continuity Capsule composition remains later work.
- Placement may become usable only when
  `evaluateResourceExecutionContract(...).execution_status === "proved"` for the
  exact workload and lease. Provider loss must create a new lease and preserve the
  workload/lineage identity; stale or single-copy evidence must never schedule work.
- Discovery, signaling, relay, domain, UI, Cloudflare, and GPT remain transport or
  presentation capabilities, never validity authorities. No fixed backend may be
  required for protocol correctness.
- Honest metering, distinct account/credential/administrator/failure domains,
  Sybil resistance, and physical provider independence remain explicit later HOLDs.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
