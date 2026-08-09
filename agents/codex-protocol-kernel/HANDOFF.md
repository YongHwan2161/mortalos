# Release intent and shared-path scope

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### RELEASE INTENT — branch-active, main-historical

On a task branch this declaration is active. On `main` it is historical; exact-SHA
governance and deployment status comes from the PR, required checks, merge record,
post-merge workflows, and deployed asset manifest.

- Branch: `agent/codex-protocol-kernel--p2p-placement-repair`
- Base: `25de18d8c1af8b3dfcb5adffb1a07538afa33332`
- Worktree: `work/mortalos-worktrees/codex-protocol-kernel--p2p-placement-repair`
- Shared paths declared for this task: `.github/workflows/`,
  `agents/codex-protocol-kernel/`, `docs/`, `lab/`, `protocol/`, `scripts/`,
  `sdk/`, `security/`, `src/`, `test/`, `CONTRIBUTING.md`, `README.md`, and
  `package.json`.
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
  network-free portable boundary. This source document does not infer exact-head
  governance, deployment, or promotion status.
- The confidential controller is implemented locally: S4 package 2-of-3 shards,
  shard/provider/workload identity binding, exact proof-age boundary, crash-safe
  canonical journal, post-restart direct-successor proof requirement, deterministic
  repair plan, and new leases under a separately generated successor-authorized
  operational signer after A exits. That signer is not cryptographically bound to
  B's Continuity custody identity.
- The lineage-bound source revision adds canonical placement generations, revalidates
  nested public evidence, and commits only through the current Continuity
  descriptor's required quorum. `deriveCommittedPlacementActionPlan` returns
  `mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
  `verified_placement_receipt_ids`, `non_capability: true`, and
  `requires_executor_reverification: true`. It is forgeable derived data, not
  authority; an executor must revalidate the original and current evidence. Valid
  same-generation forks halt. A→B transfers no private key and B commits the
  repaired successor after A exits.
- The liveness source revision removes raw unavailable-provider input from lineage
  generation. The provider-signed offer fixes the observer roster; a consumer-signed
  predecessor/sequence challenge and exact 3-of-4 local-duration observations form
  the only repair certificate. Challenge, observations, responses, and certificate
  are bounded untrusted WebRTC artifacts.
- A late provider response is accepted for reconciliation only when its named
  receipt is the current fully verified offer/lease/usage/execution chain. It then
  conflicts with the certificate and conditionally halts plan derivation when a
  caller supplies that response and the current placement chain. The current
  Lab/browser harness supplies empty late-response/current-placement arrays and has
  no gossip plus execution-time reconciliation loop. Challenge fork, response fork,
  offer-roster mismatch, stale lineage/manifest, and raw timeout input also fail
  closed.
- The offer signature fixes the witness roster but does not pre-agree the
  consumer-selected response window. Certificates are continuity-scheduling
  transcripts, not provider death, breach, lease-termination, penalty, or settlement
  evidence.
- Independent pre-publication review reproduced and closed three core blockers:
  a rogue challenge signer different from the verified lease consumer, a stale
  prior generation that rewound generation numbering, and collection-primordial
  drift that could miscount duplicate observers. The core now binds the full
  consumer identity, requires the latest placement predecessor, fails closed on
  realm drift, and directly inventories the async commit ownership boundary.
- PR #58's first immutable review at exact head
  `1c559843c6af8300d744629215050c3fbd4d4781` correctly BLOCKed four additional
  issues despite green policy and Verify checks: the implementation-plan NEXT header
  contradicted its A-then-B body, this HANDOFF omitted `protocol/`, WebRTC returned
  aliases of mutable internal frames, and commit/verification accepted repeated
  generation numbering under a current predecessor. The replacement source aligns
  both SSOT records, owns immutable internal frames and returns detached frozen
  copies, and rederives exact consecutive generation sequence from authenticated
  Capsule history. Exact-head CI and fresh independent re-review remain external
  evidence and are not inferred here.
- PR #58's replacement review at exact head
  `b282e0d3be74c0d8480c038199b5ebc960166e8d` confirmed all four prior closures but
  correctly BLOCKed a new send-failure atomicity issue: local frame/dedupe state was
  committed before `DataChannel.send()`, so a transient failure became a ghost
  duplicate that could never reach its peer. Publication now sends first and commits
  local state only on success; a focused regression proves zero failed-send
  visibility, one real retry, later idempotence, and no close/backpressure ghosts.
  Replacement exact-head CI and another fresh immutable review remain external.
- PR #58's third immutable review at exact head
  `dcdd02d0c88015fc867381cb97b07215a8d7e429` confirmed every earlier closure and
  exact-head policy/Verify success, then correctly BLOCKed the remaining mutable
  capability boundary: private transcript, duplicate, range, replay, scheduling,
  signaling, and attached-send behavior still called ambient `Map`/`Set`/`Array`/
  iterator/scheduler/channel operations. The source now uses one captured private
  transcript SSOT, snapshots or native-captures DataChannel and RTCPeerConnection
  capabilities, and has isolated Node plus actual connected-Chromium poison gates.
  Fresh exact-head CI and a fourth independent review remain external facts.
- PR #58's fourth immutable review at exact head
  `8a3f285edf3e1056d4f78097b5cb5bc0ae065043` correctly reproduced a transitive
  decoder escape despite the captured WebRTC-local capabilities: selectively
  replacing `Set.prototype.has` admitted the forbidden `verdict` artifact and
  committed it on both actual Chromium peers. The relay decoder now invokes the
  captured Set operation. Isolated Node and connected-Chromium regressions require
  zero verdict send/local/remote visibility while an allowed `challenge` still
  crosses both peers once, and the security verifier pins the exact decoder import,
  function, and module used by `publish`. This evidence is deliberately limited to
  that named transitive dependency. The same replacement source closes review
  `4892650018`'s confidential-placement time-split blocker: resource-contract status
  and receipt freshness now use the same canonical generation `evaluated_at_ms`.
  A historical placement `observed_at_ms` cannot prolong an expired or effectively
  revoked lease; exact direct and lineage regressions cover `1500/8900/9000` expiry
  and `1500/1700/1800` revocation. Fresh exact-head CI and another immutable review
  remain external facts.
- `origin/main` was freshly fetched at
  `25de18d8c1af8b3dfcb5adffb1a07538afa33332`; it equals this task base. Deployment
  credentials remain workflow-owned and never enter this source tree.
- Focused lineage Node, adversarial sibling, fresh-process determinism, actual
  Chromium origin-cut A→B handoff/repair/commit, SDK/package, Lab build, async
  security, liveness, and actual Chromium gates pass. The final ordered `npm test`
  completed on the pre-review liveness-hardened source in `4,263.6s`; it reached the
  final S4 receipt gate after every prior `&&` stage passed. Focused remediation
  gates cover rogue consumer, stale/superseded prior, realm drift, and async
  ownership. The next architectural P0 is a provider-signed lease-bound liveness
  policy plus independent possession response and effect-time exactly-once executor.
  Lineage-governed admission/failure-domain accounting follows; provider-fair SLA
  and absolute Sybil resistance remain unclaimed.

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
- This historical gap motivated the source revision that composes untrusted offer
  gossip, mutual leases, direct participant transport, verified execution receipts,
  encrypted Continuity state, and repair.
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
