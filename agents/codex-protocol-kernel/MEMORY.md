# Durable memory

Last reconciled: 2026-08-10 KST

Source branch context: `agent/codex-protocol-kernel--p2p-placement-repair` (historical
when this revision is read from `main`)

Historical integration base: `25de18d8c1af8b3dfcb5adffb1a07538afa33332`

Exact-SHA review, CI, merge, deployment, and promotion status is external to this
rolling source memory; consult immutable GitHub and deployed-manifest records.

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
  execution proof for the requested workload.
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

1. Commit a provider-signed, lease-bound liveness policy before failure. It must
   bind the observer-policy digest, response window, challenge rate/outstanding
   ceiling, independent provider response path, and validity sequence range.
2. Add a dedicated exactly-once repair executor that treats the public action plan
   as non-capability data, reconciles current signed evidence immediately before an
   effect, and calls provider/session authority zero times for stale, superseded,
   forged, or contested plans.
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
  certificate/proof conflict when callers provide those observations. The current
  Lab/browser harness supplies empty late-response/current-placement arrays and does
  not gossip or revalidate asynchronous late responses at effect execution.
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
- Placement counts only fresh distinct-provider/distinct-shard receipts. Exact max
  age passes and max+1 fails. A restored canonical journal refuses the same
  pre-crash receipt and requires a direct chained successor or a new provider/lease.
- The Node gate uses separate commit and load processes for the journal and runs
  100 deterministic loss/stale/repair/corrupt policy cycles over cryptographically
  verified states. This is not 100 physical failure domains.
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
  evidence byte-identically, and halts an independently valid sibling fork. Same-PC
  administration, manual ICE, Sybil-resistant outage truth, exact-head governance,
  and physical independence HOLD.
- The earlier lineage-only source passed its then-current final ordered `npm test`
  in 3,129.8s. Governance and deployment of any later revision are exact-SHA
  external facts and are never inferred from this memory.

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

## Memory maintenance

- Store merged facts or explicitly labeled candidate evidence only.
- Never store credentials, private submission values, generated dependencies,
  disposable logs, or hidden reasoning.
