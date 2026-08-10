# Release intent and shared-path scope

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

Status: **FOCUSED EXACT-CEILING + CURRENT RUNTIME/TEST/WORKFLOW FULL SUITE PASS; CURRENT DOCS SPEC/LINK/DIFF PASS; EXACT-SHA EXTERNAL**

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
- Exact head `e0148aa2...` completed the pre-stateful-corpus ordered `npm test` in
  `4,304.1s` (`71m 44s`), but review `4893915817` BLOCKed that head. A later
  `7,065.8s` (`117m 45.8s`) uninterrupted full-suite PASS closed the former
  stateful-100 source only. Both results predate the exact generated-ceiling tests
  now in the working source and therefore do not promote it.
- The current Node exact-ceiling test passed 128 sequential signed transitions and
  381 genuine provider replacements in `2,841,685.4279ms` test-body time
  (`2,842,481.1467ms` runner; `2,842,596ms` shell). Generation 129 contains exactly
  384 provider/lease/chain high-waters (`128/128/128` by shard) and 387 distinct
  execution receipts. A signed, proved generation-130 `3/3` candidate then fails
  commit at the 385th total/129th shard-0 chain without changing the exact ceiling
  bytes. The test tree was fully absent at `2026-08-11 00:05:11.662+09:00`.
- The current mixed-runtime Chromium/Lab exact-ceiling test passed 127 cycles from
  generation 2 to generation 129 in `2,549,195ms` dynamic time (`2,666,619ms`
  total), with the same 384 high-waters (`128/128/128`), 384 provider/lease/chain
  identities, and 387 receipts. Actual browser-held non-extractable keys signed the
  storage evidence and a valid generation-130 `3/3` candidate; its plus-one commit
  failed without changing bytes. Serialized reload rejected the oldest receipt
  replay, private material remained unexposed, and the network cut observed no
  requests. The first focused attempt failed after `84,073ms` on a test-only
  `chain_id` aggregation assertion; the corrected aggregation passed. The browser
  tree was fully absent at `2026-08-11 00:54:04.267+09:00`.
- The former `2,700,000ms` Chromium guard had only 5.59% focused headroom, so the
  current test-only guard is `3,300,000ms`. Workflow ceilings remain 240 minutes and
  no gate was removed or skipped.
- A fresh uninterrupted `npm test` over the unchanged current runtime/test/workflow
  source bytes started at
  `2026-08-11 01:06:58.716+09:00`, ended at `03:21:35.542+09:00`, and exited `0`
  after `8,076,826ms` (`8,076.826s`; `134m 36.826s`). It completed the Node exact-
  ceiling path, the mixed-runtime Chromium exact-ceiling path, every later ordered
  gate, and final `verify:s4`. Only evidence docs changed afterward; the current
  documentation tree separately passes spec, link, and diff checks. This is not a
  whole-current-tree full-suite claim. PID `23824` was absent at
  `03:24:59.475+09:00`; a fresh probe at `03:26:01.147+09:00` also found that root
  absent and zero other matching MortalOS test workloads after excluding the probe
  itself. Exact-head CI, fresh independent review, merge, deployment, and promotion
  remain separate external gates.
- The confidential controller is implemented locally: S4 package 2-of-3 shards,
  shard/provider/workload identity binding, exact proof-age boundary, crash-safe
  journal-v2 reproof contexts bound to the exact prior head and epoch, cumulative
  receipt-chain high-waters, an active distinct-provider `3/3` head barrier, and
  predecessor-keyed hard-link successor CAS. V1 is migration metadata only and needs
  a fresh rotated-epoch reproof. Deterministic repair and new leases use a separately
  generated successor-authorized operational signer after A exits; that signer is
  not cryptographically bound to B's Continuity custody identity.
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
- PR #58's fifth immutable review at exact head
  `775d4dbfdb48985c31018a78bf7a80459ad4d8ed` confirmed every prior closure and
  exact-head policy/Verify success, then correctly BLOCKed two deeper provenance
  errors in review `4892815258`: an evaluation-shaped object or raw self-hashed
  journal could omit every replay barrier, and convergence could select historical
  generation 2 even when a supplied verified Capsule already authenticated
  generation 3. The replacement source acquires recognized records, dense arrays,
  and byte views as owned inert data, uses captured array/collection/WeakMap
  operations, rechecks the runtime after hostile acquisition and nested validation,
  and only then brands the evaluator result. Selective `Array.prototype.map`,
  Proxy-array method, accessor, and collection poisoning cannot fabricate that
  provenance. It requires a complete distinct-provider `3/3` receipt barrier
  including stale/unavailable evidence, rederives the journal inside
  durable commit, and rejects raw/empty/partial/self-hashed incomplete documents at
  restore/load. A subsequent independent pre-commit attack showed that ambient
  `Array.prototype.map` could self-restore while hiding the newest existing pointer
  from the loader. The replacement loader checks realm integrity at entry and after
  filesystem reads, snapshots the directory listing, uses captured parsing and a
  bounded order-independent latest-generation/fork scan, rejects the poison without
  invoking it, and still ignores a superseded historical fork when a unique later
  generation exists. Convergence retains every supplied Capsule's authenticated latest
  placement tip and halts an unrepresented tail as `incomplete-chain`, while valid
  historical prefixes and deterministic input ordering remain supported. A hidden
  newer Capsule and hostile local-disk replacement remain explicit nonclaims. Fresh
  exact-head CI and immutable re-review are external facts and are not inferred here.
- The journal-v1 provenance repair above was necessary but not sufficient for
  cumulative anti-replay. Current journal v2 gives each predecessor exactly one
  immutable reproof-context intent, binding prior journal ID, next generation,
  manifest/policy, epoch parent, and a 256-bit epoch nonce. Storage challenge nonces
  are derived from that context plus chain identity, sequence, and predecessor.
  Only a module-private branded active shards-0/1/2 distinct-provider `3/3` can form
  a head. `receipt_high_waters` accumulates every committed chain in the epoch, so
  replacing A/B/C with D/E/F does not erase A/B/C replay barriers; a known chain
  must advance exactly once while a new chain starts at sequence zero.
- `beginConfidentialPlacementReproof` and `commitConfidentialPlacementJournal`
  rederive the current linked head and use separate predecessor-keyed no-replace
  hard-link claims for intent and successor. Immutable context, journal, and
  transition files are fsynced before the link linearization point. V1 load remains
  unavailable, continuation without rotation fails, and migration commits only
  after a fresh context-bound `3/3` set. All visible v1 anchors are checked for a v2
  successor; a late v1 pointer competing with the migrated anchor halts as a root
  fork. Caps are profile-generated: 2 MiB document,
  4,096 head transitions, 128 high-waters per shard, 384 total, 32-byte epoch nonce,
  and 16-byte derived reproof nonce; no pruning is an authorization path.
- Primary focused gates are the journal-v2 exact-ceiling Node test, the durable
  controller-v2/CAS test, and the mixed-runtime Chromium/Lab vertical. The four-case
  placement-policy corpus is supplementary evidence. Independent review `4893915817`
  blocked exact head `e0148aa2...`
  because its frozen PR body still described the pre-v2 scope and because the then-
  named 100-cycle policy test only re-counted four cached evaluations while review
  `4893187627` required at least 100 stateful provider replacements in Node and
  actual Chromium/Lab. This source replaces that cached claim with 128 sequential
  signed prior-head-bound transitions and 381 genuine replacements in the Node
  portable-kernel gate, plus a separate 127-cycle mixed-runtime path from generation
  2 to the same generation-129 generated ceiling. In the latter, actual Chromium/Lab provider pages
  hold non-extractable keys and create storage results/signatures while the portable
  journal controller is orchestrated in Node; independently in-browser journal-kernel
  parity remains unclaimed. Every step rejects displaced receipts, creates one fresh
  provider/offer/lease chain, advances two exact receipt predecessors, and commits a
  new `3/3` journal. Both focused paths reach 384 cumulative chains, exactly 128 per
  shard, then prove a signed `3/3` generation-130 candidate before its one-new-chain
  commit fails closed and leaves generation-129 bytes unchanged. The focused Node
  and mixed-runtime Chromium/Lab gates pass locally. The historical `7,065.8s` full
  suite predates these ceiling tests; the current runtime/test/workflow source passes
  the uninterrupted full suite in `8,076.826s`, and later evidence-doc changes pass
  their separate spec/link/diff gates. External exact-head governance remains pending.
- Two earlier uninterrupted full-suite attempts on the stateful-100 source are
  retained as failure evidence, not PASS. The first reached the relay gate after
  `6,167s` and exposed a
  minute-boundary race in the historical test harness; the production relay remained
  unchanged, and the repaired runtime passed 20 consecutive runs plus complete
  `test:relay`. The second stopped after `6,122.7s` inside the mixed-runtime Chromium
  segment when its `1,800,000ms` internal deadline expired after 75/100 progress.
  The focused segment had consumed `1,776,198ms`, leaving only `23,802ms` (`1.32%`)
  headroom. Its bounded deadline was then `2,700,000ms`; the sequential 100 steps and
  every final invariant remain unchanged. The third `7,065.8s` run completed within
  that guard and superseded the two historical local HOLDs for that older source
  without erasing them. It is pre-ceiling evidence and does not transfer to the
  current source.
- The exact-ceiling Chromium path later passed in `2,549,195ms` dynamic time
  (`2,666,619ms` total); the deadline-wrapped dynamic segment consumed 94.41% of the
  `2,700,000ms` guard. The test-only guard is therefore now bounded at
  `3,300,000ms`; its 127 cycles and every final assertion remain unchanged.
- The protocol and deploy workflow maximum is 240 minutes so the new cryptographic
  stateful corpus can finish on shared runners. No test, browser vertical, audit,
  coverage check, or deployment verification is skipped or weakened; the tradeoff
  is a larger bounded runner cost and longer delayed-failure window.
- The v2 artifacts remain unsigned local crash-policy evidence. A
  conforming same-filesystem hard-link winner does not prove hostile-disk integrity,
  receipt history hidden from every supplied head, cross-host consensus, or global
  currentness. Crash-left pending files are ignored, but bounded cleanup and sudden-
  power-loss durability remain HOLD. The next P0 remains provider-agreed lease-bound
  liveness policy plus independent possession response and effect-time exactly-once
  repair execution; lineage-governed admission/failure-domain accounting follows.

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
