# Confidential P2P placement controller

Status: **SOURCE + LOCAL EVIDENCE PASS — EXACT-SHA PROMOTION EXTERNAL; PHYSICAL PROMOTION HOLD**

Last synchronized: **2026-08-10 KST**

## Purpose

This source vertical closes two weaknesses of the first storage placement revision:
providers saw the resource plaintext, and a historically valid possession receipt
could be mistaken for current availability.

The controller now composes existing S4 confidential packages with the existing
resource lease and execution-receipt contract. It does not create a backend, a
global scheduler, or a new signed verdict family.

## Data boundary

Endpoint A encrypts the selected file as an S4 confidential package for the
successor custodian. The package bytes are encoded as three deterministic XOR
shares:

- shard 0 is the first padded half;
- shard 1 is the second padded half;
- shard 2 is shard 0 XOR shard 1.

Any two distinct valid shards reconstruct the exact S4 package. One shard reveals
only a fragment of an already encrypted package and cannot reconstruct it. Every
shard is a canonical envelope bound to the package digest, package length, shard
index, shard digest, and exact storage workload ID. Providers receive only these
envelopes. They receive no plaintext, epoch key, unwrap capability, custodian
private key, or continuity signing key.

This is erasure-style availability for ciphertext, not information-theoretic secret
sharing of plaintext. Confidentiality still depends on S4 encryption and successor
private-key custody.

## Freshness and counting

`evaluateConfidentialStoragePlacements` counts one shard only when all of the
following are true:

1. the placement record has the exact canonical public evidence shape;
2. the signed offer yields one distinct provider identity;
3. the lease and witness threshold are active;
4. usage and execution receipts verify for the exact shard workload;
5. the proof time is not in the future and its age is at most the configured bound;
6. neither provider identity nor shard index is duplicated; and
7. when a lineage generation marks the provider unavailable, the exact placement
   is named by a threshold certificate from the offer's fixed witness roster rather than a raw
   controller timeout.

The exact maximum proof age counts. Maximum plus one millisecond returns
`stale-proof` and stops counting. Two available shards permit recovery while three
satisfy the placement target.

Resource-contract status and proof freshness use the same canonical generation
`evaluated_at_ms`. The placement record's `observed_at_ms` remains historical
carrier metadata and cannot keep a lease active after completion or after a signed
revocation becomes effective. Regressions cover observation `1500`, lease end
`8900`, generation `9000`, plus revocation `1700` and generation `1800`; the actual
lineage creator emits no proved generation for either stale-time input.

## Crash and custody succession

The portable journal contains only canonical public evidence: manifest, policy,
generation, provider/shard identity, challenge sequence, and last receipt ID. A v1
journal is valid only when it contains exactly one receipt barrier for each of the
three shards under three distinct providers. Barriers include the last verified
receipt even when its current evaluation is `stale` or `unavailable`; otherwise a
caller could omit that record and replay it after restart.

`createConfidentialPlacementJournal` accepts only a module-private result produced
by `evaluateConfidentialStoragePlacements`, not an evaluation-shaped plain object,
clone, accessor, or Proxy. That brand is issued only after the evaluator copies its
recognized option/placement records, dense arrays, and byte views into owned inert
data, uses captured array and collection operations, and rechecks the runtime after
hostile acquisition and after nested signed-artifact validators. It never invokes a
caller array method or recognized getter. Selective `Array.prototype.map`, a
Proxy-array method override, `Map.get`, or `Set.has` therefore cannot fabricate a
proved evaluation and obtain the private brand. The Node Lab commit boundary does not accept caller-made
`journal_bytes`; it re-evaluates the raw signed placement records and derives the
journal in the commit process. Empty or partial evidence cannot advance v1 because
v1 has no authenticated prior-barrier carry-forward mechanism. Restoration again
requires the complete ordered barrier set. The adapter then persists the immutable
journal and append-only generation-pointer files. A crash before the pointer leaves
an ignored orphan; two different pointers for the same highest generation halt as a
fork instead of choosing a winner. Restart loading checks runtime integrity at entry
and after each filesystem acquisition, copies the directory listing into dense owned
data, and uses captured pointer parsing plus an order-independent bounded scan for the
maximum generation. A selective self-restoring prototype override therefore cannot
hide the newest pointer and make an older journal current. A historical fork below a
unique later generation remains historical rather than becoming a listing-order
dependent false halt.

After restart, an old receipt is not silently reused. For an existing lease, the
next counted proof must directly reference the journaled receipt and increment the
challenge sequence. A genuinely new provider and lease may enter with its first
valid receipt. The journal remains unsigned local crash-policy evidence: file mode,
directory custody, and the conforming commit adapter are trust assumptions. It does
not claim hostile-disk tamper resistance or global placement truth.

A stronger operational rule applies after endpoint A exits: A's private consumer
key is not transferred merely to extend A's leases. B reconstructs the encrypted
package from quorum and decrypts with B's non-extractable custodian key. A separately
generated successor-authorized operational signer forms the new offers, leases, and
receipts. The source does not infer or cryptographically bind that operational signer
to B's Continuity custody identity. This proves key non-transfer, not identity-bound
controller delegation.

## Executable evidence

| Gate | Command | Result |
| --- | --- | --- |
| Shard, freshness, journal, repair negatives | `node --test test/confidential-placement.test.mjs` | Actual S4 package; every 2-of-3 pair; one/corrupt/duplicate/wrong-workload/stale/future/replay rejection; generation-time completion and effective-revocation rejection; owned-inert evaluator acquisition, selective array/Proxy/collection poison containment, private brand/WeakMap-prototype containment, zero/partial/self-hashed incomplete journal rejection, durable in-process re-derivation, self-restoring stale-pointer concealment rejection, order-independent current-fork selection, real commit-process exit/load-process restart, and directly chained re-proof |
| Seeded controller policy corpus | same command | 100 deterministic loss, stale, repair, and corrupt-evidence cycles over cryptographically verified fixture states; no claim of 100 physical failures |
| Existing plaintext P2P regression | `node scripts/verify-p2p-placement-chromium.mjs` | Direct DataChannel transport, provider loss, repair, A exit, 2-of-3 readback |
| Confidential Chromium vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual 98,317-byte native File; S4 encryption for B; three distinct ciphertext shards plus liveness challenge over WebRTC; provider loss; four observer processes and 3-of-4 certificate; A lineage commit; sign-once A→B custody handoff; A exit; successor-authorized operational signer creates new leases and successor commit; byte-identical convergence; corrupt-shard rejection; exact decryption; no custody-identity binding claim |
| Lineage controller | `node --test test/lineage-placement.test.mjs` | Offer-rostered certificate-gated derived placement action plan; consumer-selected bounded window; conditional late-proof conflict when fresh response/current placement evidence is supplied; fresh-process deterministic replay; 1,000 partition/heal evidence events; stale A rejection; independently valid same-parent generation fork halts |
| Combined placement gate | `npm run test:p2p-placement` | The pre-review baseline passed its then-current 17 Node cases and both Chromium verticals; exact-SHA CI is the current-revision authority |
| Public package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed consumer imports the authority-free placement surface |
| Complete repository regression | `npm test` | A pre-review source baseline completed in 4,263.6 seconds; exact-SHA CI is the current-revision authority |

## Explicit nonclaims

- Placement generation commits are serialized through current-custodian Continuity
  commits, and lineage repair-plan derivation requires a threshold certificate under
  the provider-signed offer policy. `deriveCommittedPlacementActionPlan` returns a
  `mortalos-lineage-placement-action-plan/1` record whose
  `planned_repair_actions` and `verified_placement_receipt_ids` are explicitly marked
  `non_capability: true` and `requires_executor_reverification: true`. It is
  forgeable public JSON, not authority. An executor must reverify the
  original Capsule, generation, commit, current placement, and liveness evidence
  before effects.
- The core conditionally rejects a late-proof conflict only when supplied the fresh
  response and its verified current placement chain. The current Lab/browser harness
  supplies empty late-response/current-placement arrays and has no network gossip
  plus execution-time reconciliation loop.
- Local `unavailable_provider_ids` remains a diagnostic evaluator input only; the
  lineage generation surface rejects it.
- Browser processes share this PC, administrator, network, and credential domain.
- Manual same-host ICE does not prove arbitrary NAT traversal or Internet discovery.
- Ephemeral same-origin signing is not an XSS-resistant signer boundary.
- The 100-cycle corpus is deterministic policy coverage over valid cryptographic
  states, not 100 independent machines or real network partitions.
- Cloudflare Pages may publish the static Lab artifact, but it is not storage,
  scheduling, custody, discovery, or validation authority.

## Next root priority

The lineage and liveness layers are now implemented locally; see
[Lineage-bound placement convergence](LINEAGE_PLACEMENT_CONVERGENCE.md) and
[Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).
The next P0 is a provider-signed lease-bound liveness policy, independent possession
response, and effect-time exactly-once repair executor. Lineage-governed admission
and failure-domain accounting with explicit trust roots follows. Key-count quorum
and self-asserted topology labels must not be promoted as independent topology.
