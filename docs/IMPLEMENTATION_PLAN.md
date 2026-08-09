# MortalOS North Star implementation SSOT

Status: **ACTIVE IMPLEMENTATION SSOT — P2P LINEAGE/LIVENESS SOURCE PASS; NEXT: FAILURE-PRECOMMITTED LIVENESS POLICY AND EFFECT-TIME EXECUTOR; THEN: LINEAGE-GOVERNED ADMISSION**

Last synchronized: **2026-08-10 KST**

This is the sole current direction, stage ledger, and ordered implementation plan.
Historical receipts remain valid only for their named commits. Historical
integration base `25de18d8c1af8b3dfcb5adffb1a07538afa33332` already contained the
governed product-continuity and lease-bound execution implementations. This revision contains the confidential,
lineage-bound P2P placement-controller source and local evidence. Governance and
deployment status are exact-SHA external facts read from the PR, required checks,
merge record, post-merge workflows, and deployed manifest; this document does not
self-promote its containing revision. No source success manufactures a stage receipt,
global-availability claim, or physical-independence claim.

## 1. North Star

> A user can bind a real digital resource to one verifiable organism on endpoint A,
> move custody and recover the exact resource on endpoint B, and commit the next
> authorized transition after A disappears, without trusting a UI, relay, storage
> provider, or model to decide the result.

The product sentence remains **Create once. Continue elsewhere.** The protocol
claim is narrower than “decentralized”, “ownerless”, or “immortal”: a verified
quorum can continue one exact lineage and resource state under declared failure
assumptions.

## 2. Most fundamental improvement

The product-composition gap is implemented in this source tree. One shared core now
creates a Capsule from a runtime file, completes A-to-B custody acceptance, recovers
after A exits, and commits the next transition. The public continuity subpath, CLI,
separate-process Node test, clean packed consumer, and built-Lab Chromium verifier
exercise that contract.

The merged signed resource contract defines finite storage, bandwidth, and
compute intent; mutual single-use leases; a signed Byzantine witness policy;
threshold gossip before activation; jointly signed cumulative usage; and unilateral
revocation without owning a key, clock, network, scheduler, or server. It reuses the
endpoint-local sign-once authority tuple so a witness can retry one exact lease but
cannot honestly witness two leases for the same offer. This closes the ambiguous
“participants contribute resources” control-plane gap and makes conflicting
consumption publicly detectable under the offer's declared witness-fault bound.

The merged lease-bound execution vertical closes the next local evidence gap. A
consumer-signed challenge and dual-signed predecessor chain bind exact storage
content proofs, bandwidth payload round trips, or deterministic bounded compute to
one usage receipt and one witnessed lease. An actual child provider executes all
three classes, is terminated, and can be replaced only under a newly signed offer
and lease while retaining the immutable workload ID.

This source revision closes the next composition gap for storage: an actual runtime file,
signed offer/lease/witness/usage/execution artifacts, provider loss, new-lease repair,
consumer A exit, and consumer B readback cross direct `RTCDataChannel` connections.
Only distinct-provider active storage execution receipts for the exact workload
count. One corrupt copy is rejected and two valid copies recover the bytes.

This revision closes the confidentiality/freshness gap locally. A encrypts the real
file as an S4 package for B; providers receive three distinct ciphertext envelopes,
any two reconstruct the package, and only fresh exact-workload receipts from
distinct providers/shards count. A canonical journal survives an actual process
restart and rejects pre-crash receipt replay. After A exits, B does not inherit A's
private lease key: B reconstructs the encrypted package and renews all placements
under separately generated successor-authorized operational keys. Those keys are not
inferred to be, or cryptographically bound to, B's Continuity custody identity.

This revision closes the controller-authority split locally. Canonical placement
generations bind complete public evidence, proof set, repair intent, policy, prior
generation, and exact Continuity parent. The current descriptor's required quorum
can authorize a generation commit through the existing sign-once lineage transition.
Only that verified commit qualifies derivation of a placement action plan. The returned
plan is public, forgeable JSON rather than an authority capability; an effect
executor must reverify its original signed/committed inputs and current evidence.
Reordered evidence converges byte-identically; two independently valid same-parent
generations halt.

This revision closes the raw-local-unavailability gap. The provider-signed offer
fixes the witness roster while the verified lease consumer signs one exact
lease/workload/shard/predecessor/sequence challenge and selects its bounded response
window. A
3-of-4 non-response certificate contains no global deadline or clock-server fact;
it records bounded observer-local duration claims. Raw unavailable-provider IDs no
longer enter lineage generations. A repair plan derives only from a certificate
committed into Continuity. When supplied by a caller, a late provider response counts
only with its actual verified dual-signed receipt chain and a certificate/proof
conflict halts the derived plan. The current Lab/browser harness supplies empty
late-response/current-placement arrays and does not implement network gossip plus
execution-time reconciliation.

The immediate root gap is **failure-precommitted liveness semantics and an
effect-time repair executor**. The consumer currently chooses the response window
after the lease exists, the provider cannot independently rebut with a possession
proof that avoids consumer co-signature, and the Lab does not reconcile evidence at
the point of effect. Even perfectly independent honest observers can therefore sign
a truthful 1 ms non-response transcript that is unfair as provider-failure evidence.
Admission cannot repair an underspecified assertion.

After that semantic contract is fixed, the next root gap is **lineage-governed
admission and failure-domain accounting with explicit trust roots**. The protocol
proves threshold offer-rostered keys signed, but one operator can still control many
apparently distinct keys. A backend-free network of self-created keys cannot prove
absolute Sybil resistance. Physical meter honesty, independent credentials and
administrators, arbitrary Internet reachability, and same-origin signer isolation
remain separate gates.

### P0 — Signed bounded participant resource contract (merged)

Goal: make every storage, bandwidth, and compute grant finite, mutually accepted,
measurable, revocable, replay-safe, and transport-neutral.

Strict pass criteria:

- one generated profile fixes document, decimal, duration, observation, receipt,
  and revocation ceilings; exact max passes and max + 1 rejects;
- strict provider identity signs the offer; provider and consumer both sign the
  lease and usage; either lease party may sign a terminating revocation;
- allocation never exceeds offer capacity or time, cumulative usage never regresses
  or exceeds allocation, and every receipt binds its exact predecessor;
- two different valid leases for one single-use offer return equivocation with no
  winner; duplicate evidence returns replay;
- a signed `n/f/q` witness policy satisfies `n >= 3f + 1`, `q <= n - f`, and
  `2q > n + f`; provider, consumer, and witness roles cannot overlap;
- fewer than `q` self-contained gossip announcements remain `unwitnessed`, exact
  duplicate gossip is idempotent, and `q` distinct valid witnesses are required
  before scheduled, active, exhausted, or completed state;
- the endpoint-local sign-once tuple is one offer ID and its message binds the exact
  lease ID; witness double-sign and provider conflict halt with no selected winner;
- Node, browser-target bundling, portable 10,000-case regression, and a clean packed
  external consumer pass without private key, clock, network, or repository-relative
  authority in the core;
- PR #56 passed exact-head CI, immutable independent review, GitHub App attestation,
  separately credentialed native approval, expected-head merge, and exact-main
  readback; the contract is therefore a main implementation claim.

### P0 — Lease-bound execution receipt vertical (merged)

Goal: prove that a selected participant actually stored named bytes, transferred a
challenge range, or executed a deterministic bounded task under one exact lease.

Strict pass criteria:

- the receipt binds `offer_id`, `lease_id`, resource/content root, challenge nonce,
  input, deterministic output, measured usage, participant identity, and prior
  receipt; replay and cross-lease substitution reject;
- a verifier can issue unpredictable challenges without becoming lifecycle or
  scheduling authority; no fixed backend is required for validity;
- provider loss moves the task only through a new signed lease and preserves exact
  lineage; unsigned telemetry or UI state never counts as service evidence;
- one local multi-process topology passes first, but any independent-provider claim
  remains HOLD until distinct account, credential, administrator, and failure-domain
  evidence passes the declared trial and burn-in gates.

Local source acceptance and promotion are complete: all three workload classes execute in an
actual child provider process; exact/max + 1, replay, fork, cross-lease, tamper,
unsigned-usage, process termination, reassignment, browser-target, and clean packed
consumer gates pass. PR #56's first independent review BLOCKed provider/consumer
key reuse and announcement-only nested-object verification; both were fixed and
independently reproduced before the expected-head merge.

### P0 — Receipt-gated participant placement and repair (source + local evidence PASS)

Goal: compose the existing offer/lease, direct participant transport, execution
receipt, and repair primitives into one backend-free storage vertical.

Strict pass criteria:

- a consumer accepts bounded signed offer artifacts from an untrusted peer carrier
  and grants no signaling, relay, domain, or UI component validation authority;
- useful runtime-file chunks and contract artifacts traverse the real participant data
  plane, and placement becomes usable only after
  `evaluateResourceExecutionContract(...).execution_status === "proved"`;
- an outbound DataChannel send commits frame and dedupe state only after send success;
  a transient send failure exposes no range/subscriber record and the exact message
  remains retryable without a ghost duplicate;
- the direct carrier uses one private ordered transcript map and captured
  collection/iterator/scheduler/DataChannel/peer capabilities; isolated Node cases
  and an actual connected Chromium pair must record zero poison-capability calls,
  exact local range state, and exact remote delivery after constructor/prototype/
  attached-method replacement;
- termination of one provider makes its placement unavailable; repair chooses a
  different offer, signs a new lease, preserves the exact workload/content ID, and
  produces a new valid receipt before counting restored redundancy;
- stale, forked, revoked, exhausted, unproved, or cross-lease receipts never count
  toward placement, repair quorum, billing, or continuity;
- no fixed Cloudflare Worker, Durable Object, domain, relay, rendezvous service, or
  model is required for protocol validity; optional infrastructure is replaceable
  transport/discovery only;
- local multi-process and two-browser profiles pass the same scenario first.
  Distinct-account/region/credential/administrator trials and burn-in remain a
  separate S7/S8 promotion gate.

Source result: PASS locally in Node child processes and separate Chromium
processes. The historical regression sends plaintext, while the composed controller
below sends only ciphertext shards. Signaling is manual same-host ICE, availability
is a local observation. Exact-SHA governance and deployment are external evidence;
stage promotion remains HOLD.
Executable evidence and nonclaims are recorded in
[P2P placement and repair](P2P_PLACEMENT_AND_REPAIR.md).

### P0 — Confidential, continuously re-proved placement controller (source + local evidence PASS)

Goal: make placement safe and useful beyond one point-in-time plaintext proof.

Strict pass criteria:

- providers receive only S4 ciphertext shards and never receive resource plaintext,
  epoch keys, unwrap authority, or continuity private keys;
- every usable copy has a fresh execution receipt bound to its predecessor, exact
  lease, exact workload, unpredictable challenge, and cumulative usage;
- exact maximum proof age passes and maximum plus one millisecond stops counting
  until a new proof arrives;
- a crash-safe local controller reconstructs state from canonical evidence, then
  re-challenges before scheduling or billing;
- timeout, delayed response, crash, partition, corrupt shard, replay, fork, revoke,
  exhaustion, restart, heal, and repair preserve quorum without provider duplication
  or cross-lease reuse in at least 100 seeded cycles;
- a new provider/new offer/new lease repairs the same encrypted workload, and only
  an authorized successor with quorum can reconstruct and decrypt exact bytes;
- Node multiprocess, actual Chromium, built Lab, and a clean packed consumer execute
  the same scenario contract. Physical independence and same-origin signer isolation
  remain HOLD until separately proven.

Source result: PASS locally. `test/confidential-placement.test.mjs` proves every
2-of-3 combination, exact-age and max+1 behavior, duplicate provider/shard rejection,
actual journal commit-process exit and load-process restart, directly chained
re-proof, and 100 deterministic controller-policy cycles over cryptographically
verified states. `verify-confidential-placement-chromium.mjs` proves a native
98,317-byte File, S4 encryption for B, distinct shards over direct DataChannels,
provider-signed exact workloads, origin cut, loss/repair, A exit, new leases under a
separately generated successor-authorized operational signer, corrupt-shard
rejection, and exact decrypt. No custody-identity binding is claimed. See
[Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md).

### P0 — Lineage-bound controller handoff and repair convergence (source + local evidence PASS)

Goal: make one placement plan follow the organism's exact current custody so local
controllers cannot split scheduling, repair, or billing truth.

Strict pass criteria:

- a canonical placement generation binds organism ID, lineage head, confidential
  manifest ID, target/quorum policy, prior generation, active lease IDs, and last
  accepted proof IDs;
- generation `N` requires exactly `N - 1` authenticated prior placement transitions
  and the latest predecessor ID/head; repeated, decremented, skipped, noncanonical,
  or overflowing successor numbers fail in creation, commit, and verification;
- only the current Continuity descriptor's required quorum may authorize the next
  generation commit, and the existing sign-once/continuity acceptance rules prevent
  two successors for one prior generation;
- a repaired shard is counted only after its new lease and fresh proof are committed
  into the accepted generation; unsigned or derived local intent cannot itself
  schedule or bill, and an executor revalidates the original evidence before effects;
- two independently restarted controllers presented with the same evidence select
  byte-identical state, while a valid divergent generation halts automatically;
- partitioned controllers may preserve recovery quorum but may not double-count a
  provider, emit conflicting repair plans, or silently choose a fork after heal;
- A→B custody handoff carries no private key, A termination is real, and B can renew
  or repair through the public protocol with Cloudflare/domain/relay disabled;
- Node multiprocess, Chromium, built Lab, clean packed SDK, 1,000 seeded
  partition/heal/restart schedules, and final ordered repository gates pass;
- physical/admin independence, Sybil resistance, honest metering, and global outage
  truth remain explicit HOLDs rather than inferred from convergence.

Source result: focused Node, fresh-process, async-boundary, SDK/package, Lab
build, actual Chromium, and the pre-liveness ordered `npm test` (3,129.8s) pass. A real A→B sign-once controller handoff
transfers no private key; A exits; B commits the repaired successor generation. A
deliberately unsafe signer can create two valid siblings, but convergence returns
`generation-fork` with no winner. See
[Lineage-bound placement convergence](LINEAGE_PLACEMENT_CONVERGENCE.md).

### P0 — Quorum-observed liveness and repair certificates (source + local evidence PASS)

Goal: prevent one controller's private timeout or wall clock from becoming shared
outage, repair, or billing truth.

Strict pass criteria:

- every availability decision binds lease, workload, last accepted proof,
  challenge sequence, bounded response window, and observer policy;
- no single controller/custodian/provider/witness role can alone declare a provider
  unavailable; role-disjoint threshold attestations are required;
- wall-clock skew cannot create a valid failure certificate: ordering uses signed
  sequence/predecessor links and bounded local duration checks;
- repair accepts only a failure certificate committed into the next lineage
  generation; raw timeout, UI state, or unsigned gossip cannot schedule or bill;
- a late valid proof and competing failure certificate for the same sequence
  reconcile deterministically or halt, never double billing or repair;
- 1,000 seeded loss/delay/partition/heal/skew schedules and actual multi-process plus
  Chromium trials produce byte-identical verdicts across independent restarts;
- external-topology claims remain HOLD until distinct devices, networks, accounts,
  credentials, administrators, and regions are measured.

Source result: focused Node liveness, lineage/fresh-process, transport, SDK, and
actual Chromium gates pass. The browser challenge crosses direct WebRTC to the
failed provider and four separate observer processes; exact 3-of-4 observations
after a real 5,000 ms local duration gate the committed repair. The lineage layer
rejects a consumer-invented observer roster, raw unavailable-provider input,
certificate/late-proof conflict when the response and its current placement chain
are supplied, challenge fork, response fork, and sibling generation fork. The
current Lab/browser flow does not yet ingest asynchronous late proofs at execution.
A pre-review source baseline completed its then-current ordered `npm test` in
4,263.6s, including 17 placement/liveness/lineage/transport Node cases and both
actual Chromium placement verticals. Exact-SHA CI is the current-revision authority.
See
[Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).

### P0 next — Failure-precommitted liveness policy and effect-time repair executor

Goal: make every repair-triggering assertion mutually pre-agreed before failure,
independently rebuttable by the provider, and revalidated immediately before one
exactly-once placement effect.

Strict pass criteria:

- a canonical provider-signed, lease-bound `mortalos-placement-liveness-policy/1`
  is committed before failure and binds exact offer, lease, workload, provider,
  consumer, witness-policy digest, response window, challenge rate, outstanding
  ceiling, provider response-proof format/path, and validity sequence range;
- the same lease cannot acquire two valid policies: sign-once reuse is idempotent and
  conflicting policy bytes halt as equivocation;
- every challenge binds the exact policy ID; min-1/max+1 window, wrong lease,
  provider, consumer, roster, policy, stale sequence, or rate overflow fails before
  observer signing;
- a provider can sign an exact challenge-bound possession response without a fresh
  consumer signature; a signed receipt-ID pointer without self-contained possession
  proof is never classified as authoritative `alive`; certificate plus valid response
  is `contested` and performs zero repair effects;
- the public action plan remains `non_capability: true`; a dedicated executor owns
  the private provider/session capability and re-verifies current Capsule/head,
  generation, commit, policy, placement, certificate, and responses immediately
  before exactly one lease/store effect;
- forged, stale, superseded, replayed, or raced plans call provider/signing effects
  zero times;
- actual Chromium proves delayed-but-live provider => zero replacement lease/write,
  truly exited provider => exactly one repair after the agreed window, and late
  response race => zero effect, both before and after origin/relay cut;
- Node, fresh-process, packed-SDK, and Chromium outputs agree; 10,000 seeded
  response/certificate/order/partition/restart schedules produce byte-identical
  verdicts or halt with zero duplicate repair or accounting effects.

### P0 following — Lineage-governed admission and failure-domain accounting

Goal: ensure that a threshold of valid observer signatures represents policy-scoped,
independently admitted failure domains rather than many keys controlled by one
actor, without claiming absolute Sybil resistance from self-created keys.

Strict pass criteria:

- one signed membership epoch is committed before any challenge and binds provider,
  observer, domain weights, admission-evidence digests, explicit trust roots,
  eligibility, expiry, and the prior membership epoch;
- observer selection is deterministic from committed membership and challenge
  material; neither consumer nor controller can choose a favorable roster after
  seeing failure;
- joins, removals, and key rotation preserve quorum intersection across adjacent
  epochs; partitioned controllers cannot create two active memberships;
- keys, rotations, and aliases under one admission/operator root have aggregate
  weight one; self-asserted domain labels have independent weight zero or unknown;
- external account, device, or hardware attestation is valid only under the exact
  issuer key, policy, expiry, and scope committed in the epoch; a live central API
  response never becomes validation authority;
- real trials use distinct devices and networks first, then distinct credentials,
  administrators, accounts, and regions; induced provider, observer, network, and
  controller failures retain safety and recover when the declared quorum survives;
- 10,000 stateful churn/partition/heal schedules plus fresh Node and browser
  processes converge byte-identically or halt with no duplicate repair/billing;
- discovery, rendezvous, Cloudflare, and `mortal-os.com` remain replaceable carriers,
  never membership or validation authority;
- only after this admission gate passes may peer anti-entropy/discovery and then
  public contribution UX or incentives advance; reversing the order amplifies the
  Sybil surface.

The governing product rule is:

> No new stage begins until one shared public workflow proves the North Star with a
> real bounded file across two isolated clients and a fresh verifier process.

That entry condition is now implemented locally. The governing promotion rule is:

> No availability or confidentiality claim is promoted until the same public
> workflow proves its declared failure domains and data-exposure boundary.

Security hardening is deferred, not reversed. Existing capability ownership,
private-key containment, exact-readback, bounded-input, and fail-closed browser
gates remain mandatory regression boundaries. Strong same-origin signer isolation
and real independent-provider topology return only after the product vertical is
usable and stable.

## 3. Current implementation ledger

| Stage | Main implementation | Evidence | Claim state |
| --- | --- | --- | --- |
| S0/S1 | Historical baseline and Participant Core retained | Existing exact-commit receipts | Historical promotion only |
| S2 | Module-private durable capability, first-await ownership, key-redacted diagnostics | Node plus Chromium/Firefox conforming-caller matrices | Historical receipt only; XSS-resistant sign-once remains **HOLD** |
| S3 | Generated profile and real relay fragment data plane | 1 MiB reconstruction, recovery corpus, real relay message test | Historical exact-commit stage promotion plus merged source hardening; independent provider topology remains unproven |
| S4 | Private activation capability, exact readback, key-redacted recovery | Node plus Chromium/Firefox cryptographic and rotation gates | Historical receipt only; revised claim remains **HOLD** |
| [S5](https://github.com/YongHwan2161/mortalos/issues/34) | Authority-free default SDK plus explicit continuity capability subpath and full CLI | Export/pack/install/full-flow tests plus PR #53 exact-head and exact-main gates | Merged implementation; S5 receipt and public registry publication pending |
| [S6](https://github.com/YongHwan2161/mortalos/issues/35) | Canonical Continuity Capsule and signed 2-of-3 content custody | Cross-process verification, handoff, exact recovery, duplicate/tamper/fork rejection, and PR #53 governed merge | Merged implementation; S6 integrated receipt and physical independence **HOLD** |
| [S7](https://github.com/YongHwan2161/mortalos/issues/36) | Three process-isolated HTTP counter replicas | Concurrent CAS, one loss, restart, repair | Logical model only; real provider independence deferred |
| [S8](https://github.com/YongHwan2161/mortalos/issues/37) | Stateful mutation corpus and capability-routed browser parity | Chromium/Firefox full path; WebKit verifier-only | Merged regression boundary; strong custody deferred |
| Resource execution | Lease-bound storage/bandwidth/compute challenge and receipt layer | Local child-provider execution, death, reassignment, browser-target, packed consumer, exact-head CI/review/App/native approval/merge | Merged local execution claim; physical independence **HOLD** |
| P2P placement | Direct WebRTC storage, exact receipt gating, provider loss and new-lease repair | Node process plus actual Chromium origin-cut vertical | Source + local evidence; exact-SHA governance external; Internet reachability **HOLD** |
| Confidential controller | S4 2-of-3 provider shards, proof-age policy, crash-safe journal, successor-authorized operational leases | Node process restart, 100-cycle policy corpus, actual Chromium 98,317-byte file vertical, packed SDK import | Source + local evidence; custody-identity binding and physical independence **HOLD** |
| Lineage placement convergence | Generation/evidence/prior/repair binding, current-descriptor sign-once commit, derived plan, executor revalidation contract, fork halt | Node A→B and adversarial siblings, two fresh verifier processes, 1,000 partition/heal events, actual Chromium origin-cut A→B repair/commit | Source + local evidence; exact-SHA governance external |
| Quorum liveness certificates | Offer-rostered sequence/predecessor challenge, consumer-selected bounded window, 3-of-4 local-duration observations, canonical failure certificate, generation binding, conditional late-proof conflict | Node threshold/fork corpus, offer-roster negative, fresh-process lineage replay, WebRTC artifact gate, actual Chromium unreachable provider plus four observer processes | Core conditional PASS; provider-agreed liveness SLA, breach/death/settlement evidence, Lab gossip/execution reconciliation, Sybil resistance, and independent failure domains **HOLD** |

Stage coordination remains subordinate to this SSOT:

| Stage | Issue | Required receipt |
| --- | --- | --- |
| S1 | [#30](https://github.com/YongHwan2161/mortalos/issues/30) | `evidence/stages/s1-participant-core.json` |
| S2 | [#31](https://github.com/YongHwan2161/mortalos/issues/31) | `evidence/stages/s2-durable-quorum.json` |
| S3 | [#32](https://github.com/YongHwan2161/mortalos/issues/32) | `evidence/stages/s3-state-recovery.json` |
| S4 | [#33](https://github.com/YongHwan2161/mortalos/issues/33) | `evidence/stages/s4-confidentiality.json` |
| S5 | [#34](https://github.com/YongHwan2161/mortalos/issues/34) | `evidence/stages/s5-sdk-cli.json` |
| S6 | [#35](https://github.com/YongHwan2161/mortalos/issues/35) | `evidence/stages/s6-continuity-capsule.json` |
| S7 | [#36](https://github.com/YongHwan2161/mortalos/issues/36) | `evidence/stages/s7-failure-domains.json` |
| S8 | [#37](https://github.com/YongHwan2161/mortalos/issues/37) | `evidence/stages/s8-adversarial-custody.json` |

## 4. Priority order

### Completed P0 — One real continuity vertical

Use one implementation path in the SDK, CLI, and Lab to prove this sequence:

1. Endpoint A selects a real bounded file and creates the organism and canonical
   state package.
2. Endpoint B creates its own non-extractable key and accepts a canonical custody
   handoff; no private key crosses clients.
3. The resource, lineage, and manifest are exported as a canonical Capsule and
   wrapped in three current-custodian-signed copy/provider envelopes after traversal
   through the real chunk data plane.
4. A is closed. B recovers the exact resource from any two copies, verifies the
   Capsule, and commits the next authorized state transition.
5. A fresh CLI process verifies the new organism ID, head, state root, resource
   digest, and Capsule ID without receiving signing authority.

Strict pass criteria:

- the same core and ordered scenario contract drive Node integration, actual
  Chromium, and the built Lab;
- the file is supplied at runtime, not embedded as a test fixture;
- A's process is actually gone before B continues;
- one missing or corrupt signed copy recovers exact bytes, while one remaining
  copy, a repeated copy identity, a valid fork, stale lineage, or altered chunk
  fails closed;
- no internal `src/` authority module is imported by the product surface; public
  SDK boundaries are used throughout;
- the programmatic Lab harness completes without a model call. A visible EN/KO
  product journey and ten-run UX timing remain P1, not a hidden P0 claim.

### Completed P0 — Complete the public package surface

- expose create, inspect, handoff, recover, and continue orchestration through the
  explicit `@mortal-os/core/continuity` capability subpath;
- expose matching CLI commands with machine-readable JSON output;
- run the complete scenario from a clean packed-tarball consumer;
- retain the authority-free default export and no-private-material invariant.

PR #53 exact-head CI proved the clean temporary consumer on the supported runner,
then immutable review, App attestation, native approval, expected-head merge, and
exact-main Verify/Deploy completed. Public package-registry publication remains a
separate unclaimed distribution step.

### P1 — Make the Lab a product demonstration

- reduce the default journey to **Create resource → Move custody → Recover and
  continue**;
- keep protocol bytes, GPT witness, fuzzing, and diagnostics under Advanced evidence;
- show one stable organism ID, resource digest, custody state, and next action;
- provide accessible EN/KO copy and actionable fail-closed recovery guidance.

Pass when a first-time user can complete the flow from visible instructions alone,
and automated accessibility, mobile layout, two-profile Chromium, and failure-path
tests remain green.

### P1 — Promote only the integrated result

Freeze S5/S6 receipts after the product vertical stabilizes. Bind source, packed
artifact, exact user scenario, browser evidence, and public readback to one SHA.
Do not spend release evidence on another disconnected candidate.

### P2 — Deferred strengthening

Return to isolated signer custody, WebKit full signing, real independent providers,
100 failure trials, and seven-day burn-in only after P0/P1 pass. These are explicit
nonclaims meanwhile and must not be weakened to make the product flow pass.

## 5. Global gate and evidence rules

A stage passes only when all of the following bind the same immutable SHA:

1. locked install, generated-profile check, focused tests, full suite, and clean
   package build;
2. no skipped required runtime and no undisclosed capability downgrade;
3. exact source inventory plus machine-readable receipt;
4. immutable independent review on the final diff;
5. expected-head merge, post-merge CI, and exact deployment readback when a live
   claim changes.

Any source edit after review invalidates that review. Any source edit covered by an
older receipt reopens the claim. Locally separate processes are not physically or
administratively independent providers.

An old green run does not cover a new SHA.

Every publishable SHA must still pass: locked install, license, specification,
links, governance, protocol, state, transport, relay, Lab, UX, package, and browser
gates. Committed, Node, isolated browser-target, and actual Chromium results must be
byte-identical for the portable corpus. Exactly 10,000 cases replay from seed
`1297044052`. Any cross-runtime mismatch reopens the earliest portable gate and
invalidates all later evidence.

## 6. Required verification commands

```bash
npm ci
npm run verify:protocol-profile
npm run verify:security-boundaries
npm run test:durable-quorum
npm run test:state-package
npm run test:confidentiality
npm run test:protocol-profile
npm run test:transport
npm run test:distributed-counter
npm run test:security-fuzz
npm run test:sdk
npm run test:capsule
npm run test:browser-capabilities
npm run test:browser-parity
npm test
```

The million-IV test and the 100-run persistent browser matrices remain release
gates even when a bounded local parity run is used for iteration.

## 7. S0 — Current claim baseline

Stage alias: **S0 — baseline reset:** current claim and evidence authority.

Goal: preserve historical receipts as immutable evidence while separating merged
implementation, current product integration, and promoted claims.

Pass criteria:

- current claim matrix says S2/S4 revised claims remain reopened;
- old receipts still verify only their recorded commits;
- this SSOT, claim matrix, threat model, traceability, README, and browser
  compatibility agree;
- no current document treats a local green run as promotion.

## 8. S1 — Unified Participant Core

Stage alias: **S1 — Unified Participant Core:** one deterministic authority path.

Goal: retain one deterministic lineage authority shared by UI, durable participant,
CLI, and recovery adapters.

Pass criteria:

- adapters cannot construct accepted context or choose a head;
- canonical Node/browser results remain byte-identical;
- proxy, accessor, cloned-context, fork, and bounded-input negatives remain green.

## 9. S2 — Durable capability and sign-once security

Goal: a mutable or spoofed store cannot lie about a committed signing intent, and no
supported public result exposes a usable signing key.

Implemented work:

- registered durable stores hold module-private read/write closures;
- the endpoint implementation and raw store capability are co-located in that
  closure; the former endpoint module is only a safe compatibility re-export;
- the production module namespace exposes no raw document read/write function, and
  tests create their own authority fixtures instead of extracting store internals;
- endpoint code ignores replaced own/prototype `read` and `write` methods;
- body, proposal, purpose, key id, and message are owned before the first await;
- endpoint and store diagnostics are constructed without placing the private key in
  the clone graph, contain key id and public key only, and reject public raw writes;
- signer and WebCrypto facade injection cannot receive the key: signing calls a
  captured native intrinsic and the optional test boundary receives one string;
- expected-revision CAS occurs before signing and exact replay restores authority.

Pass criteria:

- concurrent same-revision writers produce one signer call and one released tuple;
- every WAL boundary yields only old, pending, or complete new state;
- cold restart, expiry rollback latch, migration, A/B/C loss, and D repair pass in
  actual Chromium and Firefox;
- accessor/Proxy/prototype/store/array fuzz releases no duplicate signature;
- endpoint and store diagnostic graphs contain no private `CryptoKey`, and neither
  surface permits raw durable writes;
- the public module namespace contains no raw store capability and hostile
  replacement of public `read`/`write` methods cannot affect endpoint commits.

Boundary: these criteria prove public-API redaction and conforming concurrency, not
same-origin/XSS-resistant sign-once. Strong custody is deferred and requires an
isolated signer that owns both key use and monotonic journal state.

## 10. S3 — Protocol profile and real chunk data plane

Goal: one generated profile governs state, transport, provider, and confidential
limits, and a legal state chunk actually traverses relay messages.

Implemented work:

- `protocol/profile.v1.json` is the source for generated constants;
- 64 KiB state chunks are split into 32 KiB relay fragments with domain-separated
  digests and bounded reassembly;
- recovery fetches actual relay frames, verifies fragment/chunk/root bindings, and
  commits by CAS plus readback;
- the transport method, outer chunk array, every nested byte array, and single-chunk
  descriptor size are owned before the first transport await;
- exact-max and max-plus-one cases are generated from the profile.

Pass criteria:

- generated file equals source profile byte-for-byte after regeneration;
- no S3 chunk can exceed a transport/provider envelope;
- a real 1 MiB package traverses relay frames and reconstructs exact bytes;
- missing, duplicate, reordered, oversized, corrupt, or cross-chunk fragments never
  activate state;
- repeating the same completed activation succeeds idempotently; a conflicting
  successor fails closed.

## 11. S4 — Recovery, activation, and private-key containment

Goal: ciphertext recovery cannot be redirected after verification, activation
cannot be faked through a mutable facade, and supported public APIs return no epoch
or private-key handle.

Implemented work:

- expected bindings and complete custodian membership are owned before await;
- activation store capability is a private WeakMap record;
- S3 recovery accepts only a branded destination capability; arbitrary public
  `commitActive`/`readActive` pairs are never invoked;
- commit verifies expected prior root, committed candidate, and exact readback;
- retry of the identical candidate is idempotent;
- public decrypt and combined recovery results omit `epoch_key`;
- counter store methods and recovery destination methods may be replaced without
  changing the trusted capability.

Pass criteria:

- any-two ciphertext recovery returns the exact 1 MiB resource;
- no-op/throwing public commit methods cannot fabricate retirement or activation;
- caller mutation during inventory/read/decrypt cannot change bindings;
- non-extractable AES/RSA/Ed25519 key properties hold internally and package/SDK,
  CLI, capsule, logs, and public documents contain no private handle;
- one-million IVs contain no duplicate and rotation blocks the old authority.

Boundary: the current browser adapter persists a non-extractable key in same-origin
IndexedDB. This blocks export but not direct `sign` use by compromised same-origin
code. Strong counter custody cannot pass until signing and counter state are moved
together to a separate origin/service or hardware authorization domain.

## 12. S5 — SDK and CLI

Goal: installable consumers create, inspect, hand off, recover, verify, and continue
through an explicit capability surface while the default import remains
authority-free.

Pass criteria:

- package `exports` exposes the verification SDK, continuity capability subpath,
  and protocol profile only;
- default SDK names exactly match the authority-free allowlist; the explicit
  continuity subpath exposes signer capabilities but never private key material;
- CLI exposes the P0 create/handoff/recover/continue workflow and deterministic
  verification with stable JSON output;
- concurrent CLI processes serialize an authority file before journal commit, a
  conflicting tuple has exactly one signer, and a crash-left lock fails closed
  until explicit operator recovery;
- concurrent first-use creators produce one identity, and exact persisted-file
  schemas prevent extra private material from entering public custodian output;
- captured JSON operations plus a null-prototype own-data journal reject transient
  parser replacement and `Object.prototype` tuple accessors without changing the
  first committed signing intent;
- packed artifacts omit lab, evidence, tests, scripts, agents, and GitHub internals;
- a clean temporary install executes the real-file continuity vertical on supported
  Windows and Ubuntu Node versions.

## 13. S6 — Continuity Capsule

Goal: one canonical bounded artifact carries enough public evidence and exact
resource state to verify and continue elsewhere without private signing authority.

Pass criteria:

- Capsule binds organism, complete lineage, latest state-transition payload,
  manifest, receipt, ordered chunks, and profile;
- another process verifies the same capsule id/head/state/resource;
- mutation, truncation, stale lineage, wrong chunk, or wrong receipt fails before
  activation;
- serialized bytes contain no private key, `CryptoKey`, PKCS#8, or raw epoch key;
- each product copy binds Capsule ID, head, organism, copy ID, and logical provider
  under the current custodian signature; duplicate copy/provider identities cannot
  satisfy quorum;
- the Lab and packed CLI produce and consume canonical Capsule bytes for the P0
  user-selected resource scenario;
- confidentiality is not inferred from Capsule custody; encrypted product Capsules
  require an explicit S4 composition step.

## 14. S7 — Independent counter authority and topology

Goal: counter allocation survives one replica loss without releasing overlapping
AES-GCM invocation counters.

Pass criteria:

- three-to-seven odd replicas use majority CAS and repair;
- two concurrent coordinators have exactly one winner per prior revision;
- below-quorum operation fails closed;
- process-isolated HTTP replicas survive termination, disk restart, and repair;
- production promotion additionally requires distinct provider, host,
  administrator, and credential domains plus 100 failure trials and immutable
  seven-day burn-in.

The local process topology satisfies implementation verification only. It cannot
promote the last production criterion.

## 15. S8 — Adversarial custody and browser parity

Goal: hostile storage/custody behavior is classified without last-write-wins, and
every browser gets an evidence-backed capability profile.

Pass criteria:

- deterministic stateful corpus combines accessor, Proxy, prototype, store-method,
  and array mutation at await boundaries;
- 2-of-3 signed Capsule-copy custody recovers one lost/corrupt copy, rejects a
  repeated copy/provider identity and valid fork, and fails below quorum;
- transient `Map` replacement cannot bypass sign-once, while persistent hostile
  `Set`/`Array` replacement fails realm integrity before quorum bookkeeping;
- Chromium and Firefox pass portable validation, S2 durable restart/loss, and S4
  counter/rotation in actual engines;
- WebKit passes portable validation and capability detection; runtimes with native
  non-extractable Ed25519 must also sign and verify through the canonical 65,536-byte
  ceiling before running the full S2/S4 family; `NotSupportedError` or
  `OperationError` keeps the runtime verifier-only;
- no user-agent string grants support and no fallback exports raw key material.

WebKit full signing parity is therefore **HOLD**: the current Ubuntu build creates a
key but fails the full protocol envelope. Non-capable runtimes remain an explicit
verifier-only profile. Weakening key containment is not an acceptable workaround.

## 16. GitHub merge authority

Goal: native branch protection requires both a signed exact-snapshot attestation
and approval from a separately credentialed GitHub identity, dismissing approval
when the head changes.

Pass criteria:

- default-branch ruleset requires pull request, one native approval, code-owner
  review where applicable, conversation resolution, and required CI;
- force push, deletion, and bypass are disabled except documented break-glass;
- GitHub App `mortalos-review-gate` is repository-scoped, cannot bypass the ruleset,
  and alone may emit required check `MortalOS Reviewer Attestation`;
- machine-user `ant713900-web` is repository-scoped and has the minimum GitHub role
  that makes native approval count; it has no ruleset bypass;
- App and machine-user credentials remain outside the repository and every workflow
  that can execute pull-request code;
- the external runner binds head, body digest, base, changed-file digest,
  Git-object diff digest, exact CI run identities, reviewer version, and independent
  receipt digest before either attestation or approval;
- an approval binds the exact immutable head and a changed head dismisses it;
- the reviewer cannot alter the implementation branch or its own policy workflow;
- machine-user 2FA, passkey, recovery isolation, and login alerts pass live preflight.

PR #51 passed exact-head CI, immutable review, App attestation, native approval,
no-bypass ruleset enforcement, and expected-head squash merge as
`12e90e6199b16b5379a6d4c1caa62cd24f7446e5`. This proves separate GitHub
credentials under one operator, not separate human or administrative control.
Future source changes must repeat the same exact-snapshot gate.

## 17. Completion and explicit nonclaims

The P0 real-file vertical, public package surface, signed resource contract, and
lease-bound execution vertical are merged on main. Their local execution evidence
does not promote the stronger topology or custody claims below.
Receipt-gated peer placement/repair, S2/S4 strong custody, product Capsule
confidentiality, and S7 physical independence remain **HOLD** without blocking
ordinary product iteration.

Explicit nonclaims:

- Byzantine or Sybil resistance and automatic fork resolution;
- proof that every hidden copy is erased;
- physical independence inferred from profiles, ports, containers, or processes;
- global death certificates;
- GPT/model product features as protocol authority.
