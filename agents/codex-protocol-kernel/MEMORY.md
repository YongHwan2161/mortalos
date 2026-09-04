# Durable memory

Last reconciled: 2026-08-21 KST

Source branch context: `agent/codex-protocol-kernel--p2p-placement-repair` (historical
when this revision is read from `main`)

Historical integration base: `25de18d8c1af8b3dfcb5adffb1a07538afa33332`

Exact-SHA review, CI, merge, deployment, and promotion status is external to this
rolling source memory; consult immutable GitHub and deployed-manifest records.

## Verify-gated release artifact promotion

- Production release ordering is `protocol + browser-parity Verify PASS` → exact
  commit-addressed candidate build/upload → successful same-run `workflow_run`
  download/verification → Cloudflare mutation → public readback. Direct push and
  manual Deploy triggers are not equivalent and are removed.
- The canonical candidate receipt binds source commit, Git tree, Lab asset digest,
  and the exact path/byte-length/SHA-256 tuple for every deployable file. Verification
  rejects symlinks, extra or changed files, schema drift, non-canonical receipt or
  manifest bytes, and commit/tree substitution before deployment credentials.
- `scripts/deploy-lab.mjs` requires and re-verifies the promoted candidate; it does
  not rebuild production static bytes. The multi-hour repository suite remains one
  upstream Verify execution rather than running again in Deploy.
- This source design is not deployment evidence. Exact-head CI/review, expected-head
  merge, post-merge artifact upload/download, cloud mutation, and canonical public
  readback must still be observed independently.

## Network-visible sign-once resource contract

- A provider-signed canonical offer binds finite storage, bandwidth, compute, and
  validity. One offer is a single-use capability; two distinct valid leases halt as
  equivocation rather than selecting a winner or overcommitting silently.
- A lease is contained by the offer and requires distinct provider and consumer
  signatures. Usage receipts are jointly signed, predecessor-chained, cumulative,
  and allocation-bounded. Either lease party can sign unilateral revocation; offer
  revocation remains provider-only and cannot rewrite an already started lease.
- An offer also signs a sorted, role-disjoint witness roster, declared Byzantine
  bound `f`, and threshold `q`. The validator requires `n >= 3f + 1`,
  `q <= n - f`, and `2q > n + f`. A lease stays `unwitnessed` until `q` distinct
  valid announcements converge; minority partitions cannot activate it.
- Each witness signs one offer/lease consumption under a distinct domain. Its
  signing request reuses the existing endpoint-local sign-once journal with one
  tuple per offer and a message bound to the exact lease. Duplicate gossip is
  idempotent; provider conflict or witness double-sign halts with no winner.
- The portable core owns no private key, clock, network, scheduler, storage, or
  server. Default SDK exports verification/evaluation; the explicit package
  subpath exposes draft/finalize functions and signing messages.
- Generated profile limits bind 16,384-byte component documents, 65,536-byte
  announcements, 16 witnesses, 64 observed announcements, 63-bit decimals,
  365-day duration, eight observed leases, 4,096 receipts, and 32 revocations.
- Focused resource/profile `15/15`, transport `8/8`, SDK `4/4`, clean packed full
  witness flow, specification, links, conformance `76/76`, portable
  `10,000/10,000`, security inventory `21/119`, and zero-vulnerability audit pass.
  Fresh exact-tree full `npm test` also passed in `2,720.8s`. The subsequently
  remediated contract and execution vertical passed exact-head gates and merged in
  PR #56; the initial local run is retained only as candidate history.
- Lease-bound storage/bandwidth/compute execution proof is now merged for the local
  process topology. The root product gap has advanced to receipt-gated participant
  placement and repair over the real peer data plane. Quorum-visible signatures
  and local receipts still do not prove truthful physical metering, witness or
  provider independence, Sybil resistance, or independent administration.

## Lease-bound execution receipt implementation

- A consumer-signed canonical challenge binds one offer, lease, consumption ID,
  immutable workload, unpredictable 128-bit nonce, predecessor, sequence, and
  explicit issue time. The verifier gains no clock, scheduler, lifecycle, network,
  key, or storage authority.
- A provider/consumer-signed execution receipt embeds the exact challenge and binds
  deterministic result, workload ID, execution time, matching usage receipt, and
  exact prior execution receipt. Usage and execution chains must be one-to-one
  before `evaluateResourceExecutionContract` reports `proved`.
- Storage verifies a nonce-selected 4,096-byte Merkle leaf against a content root;
  bandwidth verifies an unpredictable payload round trip; compute reproduces a
  bounded `sha256-chain/1` result. Generated 4 MiB resource, 4 KiB input/leaf, and
  4,096-iteration limits pass at exact max and reject at plus one.
- An actual child provider reads a runtime file and executes all three workload
  classes. Its real PID exits and cannot sign again. A replacement provider needs a
  new signed offer and mutual lease; the exact workload ID remains stable while the
  old lease receipt is rejected.
- Focused resource/profile `22/22`, SDK `4/4`, browser-target bundling, and clean
  packed external-consumer compute receipt pass locally. Private material is absent
  from exchanged offers, leases, challenges, usage, and execution receipts.
- PR #56 promotes this only as a merged local process-isolation execution claim.
  It is not evidence of distinct hardware, account, region, credential,
  administrator, honest meter, or independent provider.

## Verified merged state

- PR #51 passed exact-head policy and browser/protocol CI, immutable independent
  review, GitHub App attestation, separately credentialed machine-user native
  approval, and no-bypass expected-head squash merge.
- Main includes module-private S2/S4 capabilities, first-await ownership checks,
  generated protocol limits, real relay chunk fragments, the authority-free S5
  SDK/verification CLI, S6 Continuity Capsules, the process-isolated S7 counter
  model, and S8 stateful fuzz plus capability-routed browser parity.
- Historical S1-S4 receipts remain exact-commit evidence. Merging revised code does
  not re-promote S2/S4 claims or prove same-origin signer isolation, WebKit signing,
  independent providers, administrators, devices, or global availability.
- PR #56 passed remediated exact-head policy and browser/protocol CI, immutable
  independent re-review, GitHub App attestation, separately credentialed native
  approval, and no-bypass expected-head merge as `0779741402244d6cd802a1179bd2c94555bdd030`.
  Its first review BLOCKed provider/consumer key reuse and announcement-only
  nested-object verification; both were fixed and independently reproduced.
  Exact-main Verify `31215007053` and Deploy `31215005995` then passed, including
  public artifact, relay, and bilingual-path readback.

## Product-continuity merged implementation

- The explicit `@mortal-os/core/continuity` surface and CLI now expose
  create/inspect/handoff/recover/continue over one core implementation.
- A runtime file is bound to lineage/state, copied through the relay-fragment data
  plane, transferred from A to B, recovered exactly from two of three copies after
  A exits, and committed as the next transition by B.
- Separate Node endpoint processes, a clean packed-package consumer, Chromium, and
  Firefox execute the same ordered scenario contract. Browser endpoints use
  non-extractable Ed25519 keys; CLI private keys remain endpoint-local files.
- One corrupt copy recovers. One copy, stale lineage, wrong authority, and a valid
  fork fail closed. Exchanged artifacts contain no private signing material.
- CLI authority files now use a flushed exclusive lock plus atomic journal replace;
  two conflicting Node processes yield exactly one signer and one equivocation
  rejection. A crash-left lock deliberately requires explicit recovery.
- The pre-lock checkout passed `npm test` in 2,542.8 seconds and browser parity in
  207.3 seconds; post-lock focused continuity, packed consumer, and the `21/119`
  async security inventory pass. PR #53 then passed exact-head policy and Verify,
  immutable review, App attestation, separately credentialed native approval,
  expected-head merge as `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`, and exact-main
  Verify `30754511404` plus Deploy `30754511395`. Package-registry publication and
  physical or administrative provider independence remain unclaimed.

## P2P placement/repair source evidence

- This source revision adds a manual WebRTC browser-platform transport outside portable
  `src/`, an untrusted
  canonical placement-artifact carrier, and an authority-free storage placement
  evaluator. Connection or delivery never counts without exact active storage
  execution proof for the requested workload. Internal WebRTC frames are immutable;
  publish, range fetch, and each subscriber receive detached frozen records, so a
  caller cannot mutate stored cursor state or another observer's frame. Outbound
  publication commits frame/dedupe state only after `DataChannel.send()` succeeds;
  transient failure leaves no ghost record and an exact retry performs a real send.
  The carrier now keeps one private transcript map and captures collection,
  iterator, scheduler, MessageEvent, DataChannel, and RTCPeerConnection capabilities.
  The relay decoder separately invokes captured artifact-kind Set membership, and
  the security verifier pins that exact transitive import, function, and module.
  Fourteen isolated Node poison cases plus an actual connected-Chromium probe require
  a selectively poisoned forbidden `verdict` to produce zero send/local/remote
  visibility while an allowed `challenge` crosses both peers once. This covers the
  named capabilities rather than every future decoder dependency. Native send
  success remains local queue admission, not an end-to-end receipt.
- Each peer now owns one combined inbound/outbound transcript budget: 512 unique
  canonical messages and 8,388,608 decoded raw bytes. Exact duplicates are
  non-consuming. Outbound capacity rejects before native send and local frame/dedupe
  state commits only after send success. Inbound overflow performs zero transcript,
  subscriber, or dedupe mutation before fail-close. The virtual transport enforces
  the same exact decoded-byte ceiling; the relay edge can conservatively overcount
  base64 and reject slightly earlier, so byte-identical edge accounting is not
  claimed. Local close, remote channel close, peer close, and error share one
  idempotent cleanup path and invoke each captured native close capability at most
  once.
- An independent exact-snapshot audit of
  `a2210f1958080067b021a9c75336645f718c7427` found the
  missing combined transcript ceilings and a remote-channel-close peer leak. That
  head remains BLOCKed. The replacement focused Node gate passes `24/24`, including
  literal cap-plus-one, combined-direction, cleanup, `Error` constructor, and
  `Symbol.hasInstance` poison cases; actual Chromium exercises both literal ceilings
  and native peer cleanup. The merged base subsequently passed the complete hidden-
  wrapper suite in `8,631,790ms` through final `verify:s4`; later deltas must rerun
  their own complete suite before inheriting that evidence.
- Confidential placement evaluates resource-contract status and receipt age at one
  canonical generation instant. Per-placement `observed_at_ms` remains historical
  carrier metadata and cannot keep a lease active after generation time. Exact
  regressions reject leases ending at `8900` when generation time is `9000`, reject
  a signed revocation effective at `1700` when generation time is `1800`, and prove
  the actual lineage creator emits no proved generation for either input.
- An actual runtime-selected file plus offer, lease, witness, challenge, usage, and
  execution evidence cross direct Chromium DataChannels after HTTP/origin denial.
  One provider process loss degrades three copies to two; D uses a new offer and
  lease to repair the same workload to three.
- Consumer A destroys authority and exits. Consumer B reads three peers, rejects one
  corrupt readback by workload commitment, and recovers exact bytes from two.
  Equivalent actual Node provider-process loss/repair and clean package import pass.
- This is local source evidence only. Plaintext transfer, one-shot receipt
  freshness, manual same-host ICE, same-origin signing, same-PC administration, and
  external topology remain HOLD.
- The first ordered full run correctly BLOCKed the WebRTC adapter when it lived
  below portable `src/`. After moving it to `lab/transport`, the `21/127` async
  inventory, actual Chromium vertical, portable `10,000/10,000` parity, and final
  ordered `npm test` (`4,168.7s`) all pass locally.

## Current priority

1. Provider-signed exact offer/lease-bound policy `/1`, consumer policy-bound
   challenge `/2`, and failure certificate `/2` now pass focused Node, fresh-process,
   lineage, SDK, security, and actual Chromium gates. Legacy `/1` remains parseable
   but cannot authorize lineage repair. Complete suite and exact-SHA gates remain
   external.
2. The provider-only sampled-storage response `/2`, one-shard effect executor,
   one-result successor completion coordinator, and internal multi-action fresh-
   evidence batch are implemented. A bounded range adapter now verifies canonical
   transport frames and feeds only deduplicated `liveness-response` payload bytes to
   effect-time reconciliation; focused Node proves a response published after shard 0
   stops shard 1 and Continuity. A provider-domain durable session now restores the
   canonical placement after a child exits between provider-result and executor-result
   commits, with `0` underlying provider calls on the new session. Cross-process first-
   provider-execution exclusion now passes through a no-replace claim. A matching
   Continuity-domain session restores completed Capsule/commit bytes with `0` underlying
   calls and excludes cross-process first commit. Next prove governed recovery for
   unresolved provider/Continuity claims, then bind the same adapter to an actual
   connected WebRTC/relay Lab path.
3. Then commit observer/provider membership epochs with explicit trust roots and
   failure-domain weights into Continuity and derive challenge rosters from them.
   Multiple or rotated keys under one operator root retain aggregate weight one;
   self-asserted labels do not prove independence or absolute Sybil resistance.
4. Run real distinct-device/network/account/credential/administrator trials while
   keeping discovery/signaling/STUN/TURN replaceable and non-authoritative. Retain
   honest-meter, arbitrary-NAT, physical-independence, and XSS-resistant custody
   HOLDs until their own exact evidence gates pass.

## Quorum-observed liveness source evidence

- `mortalos-placement-liveness-{challenge,observation,response}/1` and
  `mortalos-placement-failure-certificate/1` bind exact lineage, manifest, lease,
  workload, shard, prior execution receipt, next sequence, nonce, bounded local
  duration, and observer policy without an absolute deadline or global clock.
- The observer roster must equal the provider-signed offer witness policy. Exact
  3-of-4 signed no-response evidence is required; raw `unavailable_provider_ids`
  is rejected by lineage generation.
- The lease consumer selects the bounded response window; the provider has not
  pre-agreed that window. This transcript is not death, breach, lease-termination,
  penalty, or settlement evidence.
- Generation repair intent carries challenge/certificate IDs. The core conditionally
  checks late responses against actual current receipt chains and halts on
  certificate/proof conflict when callers provide those observations. The one-shard
  Lab/browser executor supplies current placement/response evidence immediately
  before effect, but does not gossip or schedule multiple asynchronous actions.
  Challenge and response forks also halt.
- `deriveCommittedPlacementActionPlan` returns
  `mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
  `verified_placement_receipt_ids`, `non_capability: true`, and
  `requires_executor_reverification: true`. This forgeable derived record is not an
  authority token; executors must reverify the original Capsule, generation, commit,
  and current placement/liveness evidence before effects. The Lab wrapper is
  `derivePlacementActionPlan`.
- The verified lease consumer must equal the signed challenge consumer. A rogue
  consumer using the exact valid observer roster is rejected.
- Generation `N` requires exactly `N - 1` authenticated prior placement transitions
  plus the latest predecessor ID/head. Repeated, decremented, skipped, noncanonical,
  or overflowing numbering rejects in creation, commit, or verification.
- Actual Chromium sends the exact challenge over direct WebRTC to the failed
  provider and four separate observer browser processes, waits 5,000 ms locally,
  commits 3-of-4 evidence, exits A, and continues repair under B. These processes
  still share one PC/admin/network and are not physical-independence evidence.
- A pre-review final ordered `npm test` baseline completed in `4,263.6s`, including
  its then-current 17 placement/liveness/lineage/transport Node cases, both
  actual Chromium placement verticals, packed SDK/continuity/Capsule, Lab/UX,
  portable `10,000/10,000`, independent differentials, and stage receipts.

## Confidential P2P placement controller source evidence

- `src/placement/confidential.mjs` encodes a verified S4 package into three
  deterministic 2-of-3 ciphertext envelopes and binds each shard to its own exact
  storage workload. Any two valid shards reconstruct and reverify the package;
  one, duplicate, corrupt, or wrong-manifest shard fails closed.
- Placement counts only fresh distinct-provider/distinct-shard receipts at the
  canonical generation time. Exact max age passes and max+1 fails; historical
  observation time cannot preserve an expired or effectively revoked lease.
- Journal v2 first claims an immutable reproof context bound to the exact prior
  journal head, next generation, manifest, max-age/`2-of-3` policy, epoch parent,
  and a 256-bit epoch nonce. Each storage challenge nonce is derived from that
  context plus receipt-chain identity, sequence, and predecessor.
- A journal-shaped object and its self-hash are not producer evidence. Only a
  module-private branded active shards-0/1/2, distinct-provider `3/3` evaluation can
  form a head. Brand issuance uses owned inert snapshots, captured collection
  operations, and post-acquisition plus post-validator realm checks; caller array
  methods, Proxy-array method overrides, accessors, and selective collection
  poisoning cannot mint the brand.
- `receipt_high_waters` is cumulative for every lease/provider/shard/workload chain
  committed during an epoch. Replacing A/B/C with D/E/F does not erase A/B/C replay
  barriers. A known chain must advance exactly one sequence and name the prior
  receipt; a new chain starts at sequence zero. Rotation can reset the bounded
  accumulator only after a fresh context-bound `3/3` set commits.
- V1 is migration metadata only. It supplies parent/generation provenance but never
  seeds v2 high-waters or becomes available until a fresh rotated-epoch context and
  three new context-bound receipts commit.
- The durable adapter re-evaluates raw signed inputs, fsyncs immutable context,
  journal, and transition files, and uses separate predecessor-keyed no-replace
  hard-link claims for reproof intent and successor commit. Conforming writers on
  one filesystem get one successor winner; stale writers fail and restart walks the
  linked head rather than trusting a mutable current pointer.
- Profile-generated caps are 2 MiB per journal, 4,096 linked head transitions, 128
  high-waters per shard, 384 total, a 32-byte epoch nonce, and a 16-byte derived
  reproof nonce. Overflow fails closed without silent pruning.
- `test/confidential-journal-v2.test.mjs` covers the exact generated history ceiling:
  128 sequential signed prior-head-bound transitions with 381 genuine provider
  replacements reach generation 129, 384 provider/lease/chain high-waters
  (`128/128/128` by shard), and 387 distinct execution receipts. A proved signed
  generation-130 `3/3` candidate then fails commit at the 385th total/129th shard-0
  chain without changing the generation-129 bytes. It also covers cumulative
  A/B/C-to-D/E/F history, old/unseen
  replay, exact known-chain successors, epoch rotation, v1 fresh-reproof migration,
  caps, and hostile inputs. A separate mixed-runtime Chromium/Lab vertical obtains
  the provider storage results and signatures for 127 cycles from generation 2 to
  the identical generation-129/384-chain ceiling from actual non-extractable browser
  provider keys while the portable journal controller is orchestrated in Node. It
  also proves browser-signed plus-one rejection, serialized oldest-replay rejection,
  private-material non-exposure, and zero post-cut requests; this is not in-browser
  journal-kernel parity.
  `test/confidential-controller-v2.test.mjs`
  covers fresh-process intent/successor CAS, concurrent one-winner behavior, stale
  writers, restart traversal, and migration HOLD. The older four-case policy corpus
  is supplementary; the mixed-runtime Chromium vertical is the required cross-
  runtime exact-ceiling gate.
- Journal, context, and transition documents are unsigned local crash-policy
  evidence. They do not prove hostile-disk integrity, discover completely hidden
  valid receipt history, establish cross-host/global consensus or global currentness,
  or turn genuine same-PC cryptographic transitions into independent physical
  failure domains.
- The actual Chromium vertical encrypts a native 98,317-byte File for B, stores only
  distinct ciphertext shards over direct DataChannels, cuts origin/relay requests,
  loses a provider, exits A, and makes B issue renewed placements under new
  successor-authorized operational keys. Those keys are not inferred to be, or
  cryptographically bound to, B's Continuity custody identity.
  B rejects one corrupt shard and decrypts exact bytes from another valid pair.
- A pre-review `npm run test:p2p-placement` baseline passed its then-current 17 Node
  cases plus both actual Chromium verticals. The newer
  lineage layer commits generation/proof/repair state through current
  custody, derives a reverified action plan only from a verified commit, converges reordered
  evidence byte-identically, requires the authenticated latest placement tip of every
  supplied verified Capsule to appear in the candidate chain, and halts an omitted
  tail or independently valid sibling fork. This is supplied-view currentness, not
  knowledge of a completely hidden newer Capsule. Same-PC
  administration, manual ICE, Sybil-resistant outage truth, exact-head governance,
  and physical independence HOLD.
- The earlier lineage-only source passed its then-current final ordered `npm test`
  in 3,129.8s. Governance and deployment of any later revision are exact-SHA
  external facts and are never inferred from this memory.
- Exact head `e0148aa2...` passed the pre-stateful-corpus full suite in `4,304.1s`
  (`71m 44s`) and then received BLOCK review `4893915817`; that result does not
  transfer. Later stateful-100 focused and full-suite results are historical evidence
  for their older source and do not transfer to the exact-ceiling source.
- Two later current-source full-suite attempts remain historical non-promotable
  failure evidence: the first failed at the relay test's wall-clock bucket race after
  `6,167s`, and the second failed after `6,122.7s` when the mixed-runtime Chromium
  gate exhausted its former `1,800,000ms` internal deadline. After the test-only relay
  repair and a bounded increase to `2,700,000ms`, a third fresh uninterrupted
  `npm test` exited `0` in `7,065.8s` (`117m 45.8s`). It completed both stateful
  100-transition paths, relay, and all later ordered gates; the root test tree was
  absent at `2026-08-10 22:54:53.946+09:00` (`RootTreeLiveCount=0`). Only the
  evidence documents changed afterward. The exact-ceiling test additions now
  postdate that run, so it is historical pre-ceiling PASS rather than evidence for
  the current source.
- Current focused exact-ceiling evidence passes. Node completed its 128 signed
  transitions in `2,841,685.4279ms` test-body time (`2,842,481.1467ms` runner;
  `2,842,596ms` shell), with `RootTreeLiveCount=0` at
  `2026-08-11 00:05:11.662+09:00`. Chromium completed 127 cycles in `2,549,195ms`
  dynamic time (`2,666,619ms` total), with no live browser tree at
  `2026-08-11 00:54:04.267+09:00`. The first Chromium attempt failed after
  `84,073ms` on a test-only `chain_id` aggregation assertion and the corrected
  aggregation then passed. Because the deadline-wrapped dynamic segment used 94.41%
  of the former
  `2,700,000ms` cap, the internal guard is now `3,300,000ms`; workflows remain 240
  minutes.
- The uninterrupted `npm test` over the then-current runtime/test/workflow source
  bytes started at
  `2026-08-11 01:06:58.716+09:00`, ended at `03:21:35.542+09:00`, exited `0`, and
  completed every ordered stage through final `verify:s4` in `8,076,826ms`
  (`8,076.826s`; `134m 36.826s`). It includes both then-current exact-ceiling paths and
  every later gate. PID `23824` was absent at `03:24:59.475+09:00`; a fresh probe at
  `03:26:01.147+09:00` confirmed that root absent and zero other matching MortalOS
  test workloads after excluding the probe itself. The current WebRTC runtime/test/
  security remediation postdates that `8,076.826s` run, so it is historical.
  Pre-full focused evidence is Node `24/24` in `31,241ms` command time and
  actual Chromium in `50,086ms`. A fresh uninterrupted hidden-wrapper `npm test`
  started at `2026-08-11T06:42:38.6738575+09:00`, ended at
  `2026-08-11T09:06:30.4636057+09:00`, exited `0` after `8,631,790ms`
  (`143m 51.790s`), and completed final `verify:s4`. Covered source/runtime/test/
  workflow files remained unchanged after the run, and a post-run process inventory
  found zero related workloads after excluding itself. That evidence belongs to the
  merged base. The later liveness-policy delta completed `npm test` from
  `2026-08-21T15:08:09.9777152+09:00` through
  `2026-08-21T17:12:46.1993423+09:00`, exit `0`, in `7,476,222ms`, through final
  `verify:s4`. Exact-SHA CI, immutable review, approval, merge, deployment, and
  public readback remain external.
- The policy/window, sampled response, one-shard effect, one-result successor
  completion, and internal multi-action fresh-evidence batch slices are implemented.
  Provider-domain sequential restart recovery now returns the exact stored placement
  with `0` underlying provider calls. A no-replace claim now excludes cross-process
  first-provider execution. Continuity restart/exclusion now applies the same boundary.
  Governed unresolved-claim recovery, actual connected transport reconciliation, and
  lineage-governed logical admission are implemented. The next evidence frontier is
  separately administered multi-host operation and measured failure-domain diversity.

## Stable decisions

1. Creation and continuation are protocol operations, not browser privileges.
2. UI, storage, relay, Cloudflare, event order, and GPT never decide validity.
3. Importing public evidence or a Capsule never confers signing authority.
4. A non-extractable key prevents export, not use by compromised same-origin code.
5. Process or browser-profile isolation is not physical or administrative
   independence.
6. Every publishable SHA needs fresh exact-source CI, immutable review, expected-
   head merge, and post-merge evidence; old green runs do not transfer.
7. Dirty historical worktrees and immutable audit records are preserved unless a
   separate cleanup explicitly proves they are disposable.

## 2026-08-18 single-shard effect-time executor

- The first internal effect-time execution slice is implemented. It ignores the
  public plan, re-verifies original/current evidence, claims one durable failure
  slot, and uses a replacement-bound provider idempotency key.
- Focused Node covers concurrency, retry, replacement conflict, already-repaired,
  forged/late-response zero-call, and process termination after provider storage.
  Origin-cut Chromium covers delayed-response zero-call, one shard-0 effect, and
  zero-effect retry while retaining the exact journal ceiling corpus.
- The claim is one local-filesystem action with a conforming idempotent provider
  session. This historical slice was followed by the one-result successor completion
  below; multi-action/network reconciliation and provider-session restart durability
  still precede lineage-governed admission.

## 2026-08-19 single-effect successor completion

- The internal coordinator rederives the original committed effect and signed result,
  replaces only that shard in a canonical successor placement set, requires the
  successor to be `proved` with zero repair intents, and claims a distinct durable
  prior-commit/effect-result/next-generation slot before any Continuity call.
- The Continuity signer remains behind a private idempotent session. Exact retry reads
  the immutable completion result with zero new session call; a different canonical
  successor for the same slot, forged result, late response, or superseded placement
  head fails before the session.
- Focused Node passes in `701,056.7907ms`, including concurrent completion and a
  commit-then-failure retry that preserves one signing operation. Actual origin-cut
  Chromium completes shard 0 into proved generation 2 once, then preserves all
  127 provider-history cycles and the generation-129 384-chain ceiling; its dynamic
  segment is `1,596,239ms`.
- The async security verifier passes `26/26` with `22` direct and `130`
  auto-discovered entrypoints; the coordinator function and complete executor module
  are digest-pinned.
- This is one local-filesystem effect/result only. Multi-action scheduling, network
  evidence reconciliation, provider-session durability independent of its own
  idempotency store, and lineage-governed admission remain later gates.

## 2026-08-20 multi-action fresh-evidence batch

- `executeAndCompleteLineagePlacementRepairBatch` snapshots the complete action and
  private-capability set, requires exactly one action for every committed repair
  intent, canonicalizes shard order, and preflights all effects before provider calls.
- A private evidence session is re-read before every per-shard effect and immediately
  before completion. A late sampled response after shard 0 prevents shard 1 and the
  Continuity call. Exact retry reuses the durable shard-0 result.
- Two reversed concurrent invocations converge on the ordinary per-shard slots and
  one batch completion slot, call both providers once, and commit one proved zero-
  intent generation-2 successor. A separate provider-interruption path repeats only
  the interrupted provider, not the already committed shard.
- Frozen-source focused evidence is `2/2` in `826,423.4941ms`: `547,889.2043ms`
  for late-proof/concurrency and `278,277.6054ms` for partial-provider restart.
  Async security passes `26/26`
  with `22` direct / `131` discovered entrypoints.
- This is a local private evidence capability, not an implemented transport gossip
  service. Later focused slices prove conforming same-filesystem provider and Continuity
  restart/exclusion. Governed unresolved-claim recovery, connected transport, complete
  suite, and exact-SHA governance remain pending.

## 2026-08-20 provider-domain sequential restart recovery

- `DurableRepairProviderSession` persists the exact canonical provider request and
  placement result keyed by the replacement-bound effect ID before returning to the
  executor. A new session restores the result before invoking the captured provider.
- Focused executor evidence passes `1/1` in `698,964.4042ms` runner time: a child exits
  `86` after the provider result but before executor-result commit, and the new parent
  session recovers with exactly `0` underlying provider calls; exact retry also keeps
  that count at `0`.
- Under conforming local-directory custody, a no-replace owner-nonce claim now
  serializes first execution across distinct processes. A two-process race creates one
  side effect; a winner exit before result publication leaves later sessions claimed
  and invokes the provider `0` times. There is no timeout or automatic takeover.
  The Continuity-domain durable session now applies the same completed-result-first and
  no-replace-claim boundary. Next prove governed recovery for unresolved provider and
  Continuity claims, then bind the evidence adapter to an actual connected WebRTC/relay
  path and run the bounded schedule corpus.

## 2026-08-20 Continuity-domain sequential restart and exclusion

- `DurableRepairContinuitySession` owns exact Capsule bytes, generation bytes, and the
  completion-bound idempotency key before suspension. It publishes immutable canonical
  request/result files and restores a completed Capsule/commit before invoking the
  captured Continuity capability.
- A request-keyed owner-nonce no-replace claim admits only one conforming local process
  to the first Continuity call. Focused process evidence passes `2/2` in
  `1,191.3289ms`: a two-process race creates one side effect and restart restores with
  `0` underlying calls; an exit `88` after the effect but before result publication
  leaves an unresolved claim and restart again performs `0` calls.
- The signed executor integration passes `1/1` in `632,431.3446ms`. An outer failure
  after durable Continuity result publication is recovered by a fresh session with one
  total signing operation; exact retry performs no new Continuity call.
- This is unsigned same-filesystem conforming-controller evidence, not returned-result
  authority, hostile-disk integrity, sudden-power-loss proof, timeout, or takeover.
  Governed recovery for unresolved provider/Continuity claims and an actual connected
  WebRTC/relay path remain next.

## 2026-08-21 proof-import unresolved-claim recovery

- `createDurableRepairProviderResultRecovery` and
  `createDurableRepairContinuityResultRecovery` fill an unresolved local result only
  when the exact canonical request and no-replace owner claim already exist. Their
  recovery records bind claim, request, and result IDs but are local provenance, not
  authority.
- `recoverLineagePlacementRepairEffect` rederives the original committed effect and
  verifies the signed placement receipt before provider-result import.
  `recoverLineagePlacementRepairCompletion` rederives the exact proved successor and
  verifies the supplied Capsule/commit before Continuity-result import. Neither API
  accepts the external execution/signing capability.
- Direct provider/Continuity recovery gates pass `4/4` in `504.1263ms`; the signed
  executor integration passes `1/1` in `912,307.6841ms`. Invalid receipt/commit bytes
  are rejected before recovery publication, valid proof restores with `0` duplicate
  calls, and absent proof still leaves the claim unresolved with no timeout/takeover.
- Async security passes `26/26` with `22` direct / `134` discovered entrypoints. The
  later local complete suite passes. Connected WebRTC reconciliation, bounded schedule
  corpus, and trust-rooted logical admission are implemented; exact-SHA governance and
  independently administered failure-domain evidence remain pending.

## 2026-08-21 connected WebRTC batch reconciliation

- `lab/p2p-placement.mjs` now exposes a connected transport range as detached,
  untrusted frames. It does not classify evidence or confer repair authority.
  `PlacementNetworkEvidenceSession` still verifies canonical frames, advances a
  monotonic cursor, ignores non-response artifacts, and deduplicates exact response
  payload bytes before the lineage/liveness evaluator sees them.
- The shared signed two-action fixture now drives both Node and actual Chromium
  evidence. The Node batch file passes `2/2` in `755,752.0478ms`. In the origin-cut
  Chromium pair, the receiver observes exact sequences `[1,2,3]`: publishing the
  same response twice creates no additional frame, a differently wrapped identical
  payload contributes only one response, and a challenge artifact is ignored.
- A response published after provider 0 stops provider 1 and Continuity with calls
  `[1,0]` and `0`. A separate reconnect followed by receiver disconnect makes the next
  range read fail closed and again leaves every later provider/Continuity call at zero.
- This closes the actual connected direct-DataChannel adapter gap without making
  transport bytes authoritative. It is manually signaled and same-host; background
  gossip/discovery, relay-service binding, arbitrary NAT reachability, independent
  failure domains, and exact-SHA governance remain pending. The later fixed-seed
  response/certificate/order/partition/disconnect/restart corpus and local complete
  suite pass.

## 2026-08-21 signed-evidence repair schedule corpus

- `test/placement-repair-schedule-corpus.mjs` runs a fresh production
  `PlacementNetworkEvidenceSession` for every seed over exact signed failure
  certificate and possession-response bytes. Eight deterministic events cover response,
  certificate, duplicate, rewrap, order fault, partition/heal, disconnect, provider
  interruption, durable-result restart, and Continuity restart.
- The schedule driver follows the executor checkpoints: initial evidence, provider 0,
  fresh evidence, provider 1, completion evidence, Continuity. It records committed
  effect/accounting IDs rather than equating raw failed invocations with billing.
- Node plus a separately generated fresh process pass `1/1` in `733,588.2114ms` and
  produce byte-identical results. Separately bundled Chromium matches committed digest
  `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM` for `10,000 × 8` events.
  Verdicts are `2749` completed, `2489` liveness-halted, `2044` order-halted, and
  `2718` partition-unavailable. Duplicate provider, accounting, and Continuity effect
  counters are all zero.
- This is production evidence-session and signed-evidence coverage anchored by the
  full executor and actual connected DataChannel focused gates. It is not 10,000 real
  provider writes, billing settlements, or independent-network trials. Fresh complete
  suite and exact-SHA governance remain pending. The next P0 is lineage-governed
  admission and failure-domain accounting with explicit trust roots.

## 2026-08-21 lineage-governed logical placement admission

- `src/placement/admission.mjs` adds bounded canonical trust roots, subject+issuer
  dual-signed challenge evidence, custody-quorum-signed membership epochs,
  direct sequence/predecessor rotation, explicit revocation, cumulative root/key
  history and retired-authority state, deterministic roster
  derivation, adjacent-epoch intersection, sibling halt, and epoch convergence.
- Alias keys under one operator root count once. Canonical bipartite matching selects
  at most one observer per operator root and logical failure domain and excludes the
  challenged provider's root/domain. These are policy-scoped logical labels, not
  proof of physical or administrative independence.
- The first design embedded the entire epoch beneath policy/challenge/response and
  crossed the generated 65,536-byte relay-message ceiling. The accepted architecture
  keeps the membership epoch as a content-addressed generation sidecar and makes
  admitted liveness policy `/2` bind only epoch ID, prior ID, evaluation instant, and
  selection digest. The transport limit was not raised.
- Lineage creation verifies the current Capsule and exact sidecar set. Commit, action,
  reconciliation, and effect-time execution reverify the sidecars against the
  authenticated historical Capsule descriptor. Missing, duplicate, extraneous, or
  mismatched sidecars fail closed.
- A policy-locked process ceremony now keeps issuer and subject Ed25519 keys in
  distinct Node children. Each service rederives one bounded canonical request,
  requires its configured root/policy/local identity, signs only its role domain, and
  rejects conflicting reuse of one challenge slot. The coordinator receives no
  private capability. This is same-PC loopback process/key separation, not independent
  administration or topology.
- Optional local Node-authority custody preserves the identity and deterministic
  sign-once tuple across process races and restart. One conflicting issuer race has
  one winner; restarted issuer/subject services reproduce byte-identical winner
  responses and keep the loser rejected. The PKCS8 file is created with requested
  mode `0600` on supporting filesystems; it is durable local custody, not HSM,
  hostile-disk protection, or evidence of Windows/NTFS ACL enforcement.
- A private-key-free endpoint coordinator accepts a canonical request plus two
  endpoint capabilities, constructs all four Requests before suspension, denies
  redirects/remote plaintext HTTP, bounds streamed bodies, verifies exact role/key
  responses, and publishes one immutable token-free offline bundle. The signed
  challenge `/2` explicitly binds both origin/key pairs and their digest under a
  generated 512-byte ceiling, so public bundle rehashing cannot rewrite them. Each
  operator-facing signer service locks its own advertised origin before private-key
  use, keeps bearer input out of arguments/readiness, and uses a separate durable
  authority file. A no-replace durable signer profile separately binds the authority key,
  role, trust root, policy digest, and endpoint origin, so restart or a concurrent
  process cannot silently move the same authority to an alias. Restart reproduces the
  same bundle. This is key agreement to endpoint declarations, not topology truth.
- Cross-host bootstrap no longer depends on parsing either long-running signer
  readiness stream. The issuer preparation CLI publishes only its canonical trust
  root; the subject preparation CLI publishes only its canonical public identity; a
  separate request creator validates the root-policy digest, generates a fresh
  32-byte nonce, binds both exact origins/key IDs and validity, and publishes the
  signing request no-replace before either service starts. Both private authorities
  remain host-local. Focused signer-service `3/3` and HTTPS ceremony-to-observer `1/1`
  execute this exact path; physical/admin separation remains an external gate.
- A fresh-process HTTPS deployment observer now embeds the exact signed ceremony,
  verifies both live role/key responses through its configured process trust store,
  and records peer certificate/public-key digests and socket addresses. The artifact is
  no-replace but explicitly `non_authority`; both independence fields stay `unproven`
  and offline restore cannot verify that the historical network observation occurred.
  The focused case deliberately has distinct TLS keys with one shared loopback address.
- Pre-attestation focused evidence: deployment observer plus signer-profile/service, ceremony/
  admission/liveness/profile/SDK `31/31` in `33,492.5431ms`;
  batch late-response `1/1` in `166,487.7185ms`; main lineage plus sidecar negatives
  `1/1` in `534,301.6707ms`; packed SDK and actual Chromium P2P/admission/repair PASS;
  security then covered `22` direct / `138` discovered. The later current-source full
  suite passes; exact-SHA governance remains pending.
- Unbounded test-file fan-out and later concurrency `2` both proved unsafe for the
  current signed journal/executor/schedule CPU corpora. Fresh detached exact-SHA
  execution on `894661b1...` produced P2P Node `70` pass / `2` timeout cancellations
  with zero assertion failures: executor crossed `1,500,000ms`, and schedule crossed
  `900,000ms` by `55.4977ms`. Serial replay still timed out executor at
  `1,538,640.1267ms` while schedule passed in `846,722.895ms`. Package-level p2p Node
  concurrency is therefore `1`; executor/schedule budgets are `2,000,000ms` and
  `1,200,000ms`, with corpora unchanged. The remediated serial pair passes `2/2` in
  `2,178,485.7704ms` (`1,345,547.9513ms` / `832,008.0928ms`). Fresh exact-SHA full
  suite evidence is still required.
- The next P0 is operating the implemented policy-locked signer services under
  independently administered credentials, then measuring hosts/networks/regions. Only after
  that evidence should the system infer real-world diversity, weights, SLA, penalty,
  settlement, contribution UX, or incentives.

## 2026-08-21 membership-bound attributable deployment observation

- The unsigned HTTPS observation remains the ground transcript. A new
  `mortalos-placement-admission-deployment-plan/1` content-addresses one ceremony,
  an issued/not-before/expires logical interval, one bounded timeout, and a sorted
  complete `2..8` observer roster. Every entry fixes one public observer identity,
  unique 32-byte nonce, and declared administration/failure-domain/vantage digests.
- Each roster key signs `mortalos-placement-admission-deployment-plan-acceptance/1`
  through one ceremony-scoped durable sign-once slot, and only the complete sorted set
  creates activation `/1`. Exact retry reproduces acceptance bytes; a different plan
  for the same ceremony/key halts. Membership binding `/2` embeds that activation, the
  exact ceremony, selected custody-quorum epoch, sorted candidate epoch IDs, and a
  candidate-view commitment. It accepts only a complete fork-free candidate chain
  converging at the current Capsule, exact ceremony subject evidence, and the selected
  epoch's full `2..8` observer membership with matching distinct operator/failure-domain
  IDs. Attestation `/5` embeds the exact binding, candidate-view ID, and observation
  through one plan-scoped durable slot. Exact retry is byte-identical; another view,
  observation, or instant under that plan halts. Ceremony-scoped acceptance means epoch
  rotation requires a fresh ceremony and plan. Compact attestation-view `/1` commits
  key-sorted sidecar IDs and the derived all-roster summary without nesting signatures;
  restore is self-hash-only and explicit verification requires every exact sidecar.
  `observeAndAttestPlacementAdmissionDeployment` owns every input and all supplied epoch
  sidecars, reruns convergence before network access, derives nonce/timeout/declarations
  only from the admitted entry, completes the captured HTTPS probe, then invokes the
  durable signer. The low-level API also requires the current Capsule and complete
  supplied candidate sidecars but does not prove that the signer performed the
  historical probe or observed a candidate withheld from its inventory.
- Deterministic comparison requires the complete membership-bound roster and one exact
  candidate-view commitment, and rejects a missing, duplicate, or substituted epoch,
  membership, plan, activation, observer, nonce, observation, or vantage. It may
  report whether declared administration/failure-domain IDs differ, but always retains
  `non_authority:true` and both independence verdicts as `unproven`.
- The expanded same-PC deployment test covers public plan creation/no-replace,
  public observer identity export without private material, output-exists rejection
  before authority creation, exact acceptance retry, same-key conflicting-plan halt,
  reversed creation/acceptance/view order, self-rehashed roster/activation reorder,
  signature/key/plan/activation/membership substitution, raw outsider roster, wrong
  Capsule, missing-prior candidate view, self-rehashed membership/candidate reorder,
  incomplete or duplicate acceptance/roster,
  wrong nonce/window, duplicate key/nonce/vantage, a third-epoch same-plan attestation
  conflict with exact original retry before and after rejection,
  fresh-process view create/verify, manifest substitution/no-replace, accessor/shared/
  sparse/max+1 input, caller mutation, and output reuse. Async security
  passes `26/26`, `22` direct / `141` discovered.
- This closes conforming-flow raw unadmitted roster selection, post-hoc observer selection,
  same-roster multi-plan choice, and same-plan multi-view signing, not the external operation. Membership is authority
  only under configured custody/issuer policy; candidates omitted from every observer's
  supplied inventory, issuer honesty,
  locally supplied logical times, clock, Sybil, and physical topology remain unproved.
  Both observer keys, TLS proxies, trust store, and network remain on one
  PC. The current source/runtime/test complete suite reaches final `verify:s4`, while
  exact-SHA gates remain pending; the next P0 is one
  fully accepted and activated plan executed by at least two separately administered combined observer
  processes plus induced-failure measurements.
- The current observer-attestation/view suite call was issued at
  `2026-08-21T20:48:19.650+09:00` and emitted final `verify:s4` PASS at
  `2026-08-21T23:11:26.544+09:00`; no exact wrapper wall-time marker was emitted.
  Its integrated observer file passed in `59,251.0818ms` and the P2P Node group
  passed `68/68` in `3,894,776.8885ms`. Evidence docs changed afterward and pass
  their static gates separately.
- A subsequent multi-host operability audit closed both signer-bootstrap readiness
  dependencies. The issuer publishes only a canonical trust root, the subject
  publishes only its canonical public identity, and the coordinator creates a fresh
  nonce/origin-bound request from those public files before either service starts.
  Focused signer service passes `3/3` in `4,052.6003ms`; focused HTTPS ceremony-to-
  observer passes `1/1` in `47,987.2761ms`. A fresh ordered full suite ran exactly
  `7,848.357s` from `2026-08-22T00:10:31.9611979+09:00` through
  `2026-08-22T02:21:20.3185492+09:00`, exited zero at final `verify:s4`, and included
  P2P Node `69/69` in `3,452,293.3145ms`. This enables the operator runbook; it is
  still not separately administered multi-host evidence.

## 2026-08-22 custody-approved membership operator path

- The runbook cannot freeze membership epochs before observer admission. The current
  local path therefore derives a public epoch request only after verified ceremony
  bundles exist, lets current Capsule custodians sign one exact request independently
  with existing durable authorities, and threshold-finalizes the existing canonical
  epoch. Request/approval envelopes are non-normative and carry no private key.
- The deployment regression admits each observer through its own policy-locked
  issuer/subject service ceremony and then uses that same observer key for plan
  acceptance and attestation. It no longer fabricates observer admission evidence
  from raw private authorities.
- Focused epoch/deployment evidence passes `2/2` in `57,055.0734ms`; the ordered full
  suite exits zero at final `verify:s4` with P2P Node `70/70` in
  `3,529,502.2144ms`. The fixture remains same-PC. Exact-SHA governance and a real
  separately administered multi-host pilot remain the next external gates.

## 2026-08-22 complete public pilot-chain replay receipt

- The compact attestation view was not a complete pilot receipt. The new
  non-normative public-chain receipt and verifier replay separately published ceremony
  roots/identities/requests/bundles, every request-bound custody approval and finalized
  predecessor epoch, plan/acceptances/activation, current-Capsule membership binding,
  attestations, and the compact view from a path-confined canonical index.
- Restore remains self-hash-only with `public_chain_verified:false`; only full sidecar
  replay can return true. The expected source commit is `recorded-only`, not proof of
  clean exact-SHA execution. Same-PC topology and independence remain unproven.
- The affected integration rerun passes `1/1` in `97,722.7414ms` with exit `0`. A
  same-source ordered run passed every preceding stage and emitted P2P tests through
  `51` without failure, but its final PTY output/exit receipt was lost after worker
  exit; retain it as incomplete evidence, not a current complete-suite PASS.

## 2026-08-22 role-local bearer custody and replay-complete ceremony sidecars

- The strict pilot could not claim independent administration while one coordinator
  received both issuer and subject bearer values. The implemented strict path now has
  each signer administrator run `run-placement-admission-ceremony-role.mjs` with only
  its local generic token and publish a canonical token-free role response. The
  coordinator runs `finalize-placement-admission-ceremony.mjs` without network or
  bearer values. The older combined runner remains byte-compatible but is explicitly a
  same-administrator compatibility path.
- The complete public pilot index now requires issuer and subject response sidecars for
  every ceremony. Receipt creation restores both, re-finalizes them with the exact
  request and recorded evaluation instant, and requires byte-identical equality with
  the stored bundle. The receipt records both response artifact digests and authenticated
  role-response IDs. Cross-ceremony response substitution fails before output.
- Focused external ceremony passes `4/4` in `5,143.0523ms`; the role-response-complete
  HTTPS deployment/public-chain integration passes `1/1` in `101,967.6271ms` (runner
  `102,159.8635ms`, exit `0`); specification, links, protocol-profile, diff, syntax, and
  async security gates pass. Security reports `26/26` and `22` direct / `142`
  auto-discovered surfaces. No commit, push, merge, deployment, live authority, or
  external mutation occurred. Exact-SHA review and actual separately administered
  multi-host execution remain HOLD.

## 2026-08-22 native HTTPS role-local signer operation

- The operator-facing signer no longer requires a separately configured TLS reverse
  proxy. It can terminate HTTPS directly from bounded owned role-local certificate and
  private-key bytes, enforces TLS 1.2 or newer and a bounded handshake, and reports only
  `listen_protocol` plus `tls_enabled`. Private HTTP behind an administrator-controlled
  terminator remains supported.
- The runner requires certificate/key arguments as a pair, requires an HTTPS advertised
  origin for native mode, and preflights the secure context before creating an absent
  durable signing authority. Incomplete, max+1, malformed, and mismatched material fail
  closed. Public readiness, role responses, bundle, observation, and transcripts contain
  neither bearer values nor private-key bytes.
- The native focused path starts two role-local signers with distinct certificates,
  invokes one-token-per-role clients, finalizes with poisoned token variables and no
  network, performs direct trust-store-validated deployment observation, then restarts
  both signers and reproduces byte-identical role responses. It records distinct peer
  certificate/public-key digests and `remote_addresses_distinct:false` on one PC.
- Current signer-service tests pass `4/4` in `9,327.4944ms`; the affected deployment/
  public-chain integration passes `1/1` in `100,274.1801ms` (runner
  `100,504.5843ms`); async security passes `26/26` with `22` direct / `142`
  auto-discovered surfaces. Specification, links, and generated profile gates pass.
- This removes an external reverse-proxy dependency from the direct pilot path. It does
  not prove certificate-authority custody, separate administrators, hosts, addresses,
  networks, regions, power, or physical failure domains. Current complete-suite,
  exact-SHA review, deployment, and live multi-host evidence remain pending.

## 2026-08-22 TLS-channel-bound role-key possession and crash-recoverable observation journal

- A fresh deployment audit found that HTTPS plus public `/identity` bytes did not prove
  live possession of the ceremony role key: a replacement TLS server could replay those
  bytes. Native observation `/2` now sends each role a bounded canonical ceremony/origin/
  role/key/nonce/time challenge, derives a fixed-label TLS exporter on both ends of that
  exact request connection, and requires the configured role key to sign its digest.
  Replaying a captured proof under the same certificate on another TLS connection fails.
  Missing proof-token configuration cannot downgrade to identity-only `/1`; the latter is
  available only through explicit `legacy-identity-only` compatibility mode.
- Native signer mode requires a possession-only bearer distinct from the admission
  bearer. It grants only the bounded proof route. Readiness reports the transport/proof
  mode without secrets; public responses, observations, journals, attestations, and
  transcripts contain neither bearer class nor private-key material. Missing, reused,
  invalid, max+1, mismatched, and wrong-role inputs fail closed.
- TLS exporters intentionally differ across connections. That invalidated the old
  assumption that reconnecting could recreate an exact same-plan observation and exposed
  a crash window after observer signing but before attestation publication. The combined
  operational CLI now requires `--observation-journal`, hard-links the exact bounded
  token-free observation no-replace before the durable observer sign-once call, and on
  retry restores and revalidates that exact journal instead of opening another connection.
  A fresh process reproduces the byte-identical attestation with both role signers stopped
  and no possession tokens; a time/mode/content conflict produces no output.
- Current focused validation: the native `/2`, two-epoch membership/deployment/public-
  chain integration passes `1/1` in `109,399.7366ms` (`109,718.1904ms` runner). The
  signer-service file passes `4/4` in `20,655.0405ms`; adjacent ceremony/session files
  pass `7/7` in `10,071.95ms`; together those cover `11/11`. The current async boundary
  audit passes `22` direct / `143` auto-discovered entrypoints.
- Key SHA-256 receipts: signer session
  `2abf102e1082a6326a8dd7f0be674735dcfc2c516fd71fe6ba0fed7e511350d2`; native signer
  service `d78a0e84bdb245edede4a6d3ddb2418434a8ad7a96de01ddbec9de1931d843b1`;
  observer `18717c7c0f49a494e1641bc39a4e584a8df2a48d1f8f90e42060aad0c6b2c425`;
  attestation/journal boundary
  `0044ce0d591390ab839c4b7009d56c05c7f1a641e6cbca6617f7cee44c914ccb`;
  combined CLI `79eb559442a3a09c126d5791fdf75203390b033b27d98d3b0a8ae0f9c3ec786c`;
  integrated test `96025101066a450b53b7b17bf8761061b1f7ea16208778781efab71607d3fcd9`;
  operator runbook `7cae8bae7350879f2a3d530af404e59656efb3d640fe046a9932d44299f26e14`.
- This is still same-PC logical/cryptographic evidence. The journal has local-directory
  no-replace durability, not hostile-disk or power-loss proof. Certificate authority,
  account, administrator, host, address, network, region, power, and physical failure-
  domain independence remain unproven. HEAD and `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative dirty worktree remains
  `109` paths (`43` modified, `66` untracked). No commit, push, merge, deployment, live
  multi-host authority, or external mutation occurred; current complete-suite and exact-
  SHA governance remain pending.

## 2026-08-22 role-key-attributed pilot source artifacts

- The public pilot receipt still correctly reports the index's source commit as
  `recorded-only`. A new separate role execution receipt owns the exact signed
  artifact bytes, source commit, authenticated artifact ID/kind, role, and signer
  identity before suspension, then uses an artifact-kind/ID keyed durable sign-once
  tuple. Exact retry is byte-identical; a second source/digest claim for the same
  artifact identity halts as equivocation.
- The operator CLI independently resolves a role-local Git root, requires exact
  `HEAD`, and rejects tracked, untracked, or submodule dirt before authority use. The
  aggregate first replays the complete pilot public chain, derives every expected
  signer/artifact, and requires exactly one receipt for every issuer/subject response,
  custody approval, plan acceptance, and deployment attestation. Restore is sidecar-
  unverified; full verification reports `role-key-attested-artifacts`.
- The focused native `/2` integration binds 12 signed artifacts across 7 role keys and
  passes `1/1` in `165,590.5383ms` (`165,777.909ms` runner). It covers exact retry,
  reversed receipt order, dirty checkout, wrong HEAD, modified signature, missing
  receipt, artifact-keyed equivocation, no private-material leakage, and no-replace
  publication. Async security passes `26/26`, `22` direct / `144` discovered; spec,
  links, and generated profile pass.
- Key SHA-256 receipts: role receipt module
  `12fce022814d511104531b05fbdcaa751dc16889206d0c6b914b304408ca7002`;
  aggregate module
  `a60f351ee1e39c277cdf519eaa8c3c28cae6974152b45877ad2a8ea02e857201`;
  role CLI `bd317ad06ab3f6deb5ac62b1f0f2c8e5fc8ab7703e2133e3a90de85c62003110`;
  aggregate create/verify CLIs
  `3da818097e691215b49306cbd14db61bf626f5c8a5e9d34e27105c9daa0a902a` /
  `890534af7ccbaee27a299d69656cc1ffb0f23b61ea5280576e34cab9066be36a`;
  integrated test
  `9d577fb54865458130f1a6ce9f71baeb413f16838c684cc5b614fdb0fc202ee5`;
  runbook `4d5edfdd7065d52e60da6c149e2dcf49c4a2d06b3cf30ff1f88c4a57859b22de`.
- This is attributable operator testimony, not proof that a dishonest operator used
  the conforming CLI or that unsigned coordinator artifacts ran from that source.
  Topology and both independence fields remain `unproven`. HEAD and `origin/main`
  remain `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative dirty worktree is
  `114` paths (`43` modified, `71` untracked). No commit, push, merge, deployment,
  live authority, or external mutation occurred. Current complete-suite, exact-SHA
  governance, and separately administered multi-host execution remain pending.

## 2026-08-22 coordinator-non-authority pilot source verdict

- Auditing `unsigned_coordinator_execution_binding:"unproven"` showed that adding a
  coordinator signing key would create another trusted actor without improving
  protocol validity. The bounded successor instead proves that every unsigned
  protocol artifact is either endorsed by later participant signatures or
  deterministically replayed/revalidated from authenticated public sidecars.
- `mortalos-placement-admission-pilot-source-verdict/1` first recreates the complete
  public chain and role-source aggregate. It then inventories ceremony trust roots,
  subject identities, requests and bundles; membership requests and finalized epochs;
  plan, activation, membership binding and attestation view; and the pilot evidence
  itself. The Continuity Capsule remains a separately signature-verified input.
- The focused native `/2` integration passes `1/1` in `178,826.3298ms`
  (`179,032.6269ms` runner). The verdict closes 34 evidence artifacts: 12 exact-source
  participant artifacts across 7 role keys, 21 unsigned protocol artifacts (12
  participant-endorsed and 9 deterministically replayed), and one authenticated
  Capsule. Offline restore keeps participant-receipt, public-chain, and unsigned-
  artifact verification false; the complete verifier sets all three true.
- Structural gates pass: async security `26/26`, `22` direct / `144` discovered;
  specification `115` rejection codes / `104` relative links; release links `59`
  local / `11` HTTPS syntax-only; generated protocol profile, relevant syntax, and
  diff checks all exit `0`.
- Key SHA-256 receipts: verdict module
  `b0127b0356ec0e086ce7b8ffaa1ad9b6d5873994fcd51463b3c742c62761b9ab`;
  create/verify CLIs
  `045a8ffd19a2df8bbb5c9c2252ebb5cf1064391785348327f7e87bb063802d2f` /
  `2dd6c7b28f869bb4c584a765b2748b5d23f112431fde3741796198a60183e432`;
  integrated test
  `146ce919e57e759dd0790f7885b67110c284d2b9e61036904a0afb0bb691debd`;
  operator runbook
  `220c0f9fa7410ef6bbca1d9bdd5c693f68dd20fa6ee3d96d0128013253312a70`.
- This proves `coordinator_protocol_authority:"not-required-for-verification"`, not
  coordinator execution provenance. `coordinator_execution_binding`, topology, and
  administrator/account/host/network/physical independence remain `unproven`.
  Current complete-suite and exact-SHA governance remain pending. HEAD and
  `origin/main` remain `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative
  dirty worktree is `117` paths (`43` modified, `74` untracked). No commit, push,
  merge, deployment, live authority, or external mutation occurred.

## 2026-08-22 all-role-key participant inventory closure

- The next audit narrowed `public inventory completeness` without adding a
  coordinator key or another network adapter. Every unique key represented by the
  exact verified role-execution receipts now signs the same source-verdict ID/digest,
  pilot evidence ID, source commit, and deployment-plan ID. The durable sign-once
  tuple is plan-keyed, so exact retry is idempotent and another verdict for that plan
  halts under the conforming authority journal.
- `mortalos-placement-admission-pilot-inventory-closure/1` fully recreates the source
  verdict, derives exact unique key and role coverage from its receipt set, binds the
  plan back to pilot evidence, requires exactly one ratification per key, and emits a
  deterministic signature-free summary. Offline restore keeps ratification and source-
  verdict verification false; full replay reports `all-role-keys-ratified`.
- Focused native `/2` integration passes `1/1` in `207,089.5934ms`
  (`207,282.5833ms` runner). It covers 7/7 role keys, byte-identical ratification retry,
  a competing self-hashed verdict rejected by durable equivocation, reversed input,
  6/7 missing failure before output, no private-material leakage, and fresh-process
  closure verification.
- Structural gates pass: async security `26/26`, `22` direct / `145` discovered;
  specification `115` rejection codes / `104` relative links; release links `59`
  local / `11` HTTPS syntax-only; generated protocol profile, syntax, JSON, and diff
  checks all exit `0`.
- Key SHA-256 receipts: closure/ratification module
  `a7108b54330bca9b55cdd32601ec9f97a089840aaabbc89c7b1339bce30eb828`;
  ratify/create/verify CLIs
  `6a806cacb907ac9e11a1c8195afe2df706d4189cc0189e8946f705ef87f2152c` /
  `275afed702c9a27ab7106c805cadc41667e988539981cc16238867f897ba8a24` /
  `f269037b342c1596a291b81c50e52cacfa1c167105384dcd4cfc5c927f298754`;
  integrated test
  `30dc414bad76d3a6b49bc95f069f65ea5ef681943169098cc6e8a4c4fda6ec86`;
  security registry/verifier
  `f25f44f75145368e33cd5fcb39190e1d3fe67e4ece0bcf1ea20f3e5711b9fcf3` /
  `1b0509eb7fdbd524c625d52e40119cf741450b69952e0a5873a117f661f5a2d3`;
  runbook
  `491a783801b58313fcbd61b06b04853928afbbb4aff88ef340ac3f9a32f995c4`.
- This gives participant-ratified finality for one deployment plan. It does not reveal
  artifacts unknown to every honest participant, prevent copied private keys with
  independent journals, or prove global completeness, administrator/account/host/
  network/physical independence, or Sybil resistance. HEAD and `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative dirty worktree is `121`
  paths (`43` modified, `78` untracked). No commit, push, merge, deployment, live
  authority, or external mutation occurred. Full-suite, exact-SHA governance, and the
  real separately administered multi-host pilot remain HOLD.

## 2026-08-24 visible real-file continuity journey candidate

- The default EN/KO Lab journey now composes the existing participant handoff,
  product Continuity Capsule, HTTP relay, and manual WebRTC transport. HTTP carries
  only public canonical evidence and bounded offer/answer signals; the file-bearing
  Capsule crosses the ordered direct DataChannel.
- B accepts custody, creates three signed recovery copies locally, rejects one
  deliberately corrupt copy, reconstructs exact bytes from 2-of-3, exposes a real
  download, and commits product sequence 3 after A authority and transport close.
- Focused Chromium passes at 6,016 bytes and the exact 131,072-byte UI ceiling with
  neither plaintext nor base64url file bytes observed in HTTP POST bodies. Integrated
  EN/KO UX, visual stability, under-90-second path, and premature-A-loss read-only
  stall pass locally. Persistent browser profiles also pass 20/20 A→B handoffs at
  38 admitted relay operations/12s and zero local 429s. These are candidate source/runtime/test facts, not exact-SHA
  promotion, independent-host, administrator, network, or arbitrary-NAT evidence.

## 2026-09-02 R2-A content-addressed reachability contract candidate

- Fresh `origin/main` and local base are
  `9ede05cb8f7c120a24ac3ce645fe85caa61bb6e9`, tree
  `9329129836d5d89e9a76f9fa4b4e2d81b0d57c54`. PR #65 is merged; exact-main
  Verify `33403682605/1` and linked Deploy `33419081003/1` are completed/success.
- `ManualWebRtcParticipantTransport.selectedRoute()` invokes a constructor-captured
  native `getStats`, admits at most 512 records and one selected pair, normalizes
  `prflx` to `srflx`, and returns only frozen `host`/`srflx`/`relay` classes with
  `non_authority:true`. Raw candidate, IP, port, protocol, SDP, URL, username,
  credential, accessor, and ambiguous/oversized reports cannot enter the result.
- `mortalos-webrtc-reachability-plan/1` freezes the exact source/tree, resource,
  organism, Capsule, starting lineage, a fresh public 256-bit campaign nonce, four
  canonical profiles, and 20 attempts per profile before execution.
  `mortalos-webrtc-reachability-observation/1` is canonical,
  content-addressed, plan-bound, and requires complete post-A-retirement recovery,
  unique successor, corrupt-copy/below-quorum rejection, and zero provider/Continuity
  duplicate effects for PASS. Failed attempts retain an allowlisted code and cannot
  claim a complete product result.
- Local evidence passes: R2 transport/contract `27/27`; actual Chromium `host/host`
  selected-route probe; complete Chromium P2P placement/repair; async security
  `26/26`, `22` direct / `146` discovered; governance `30/30`; spec, links, ruleset,
  Lab build, and diff checks. This is same-host local evidence, not the R2-B 80-path
  live pilot or R3 independence.
- The Korean priority roadmap now records R0/R1 PASS, R2-A local PASS/remote HOLD,
  then R2-B 80 paths, R3 independent administration, R4 100 failures plus 7-day
  burn-in, and R5 exact S7 promotion. No live service, credential, issue, receipt,
  push, PR, merge, deploy, or public claim was mutated.

## Memory maintenance

- Store merged facts or explicitly labeled candidate evidence only.
- Never store credentials, private submission values, generated dependencies,
  disposable logs, or hidden reasoning.
