# Confidential P2P placement controller

Status: **CURRENT SOURCE/RUNTIME/TEST COMPLETE-SUITE PASS; POST-RUN DOCS STATIC PASS; EXACT-SHA PENDING; PHYSICAL PROMOTION HOLD**

Last synchronized: **2026-08-21 KST**

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

The portable v2 journal contains only canonical public evidence. Its
`active_proofs` are the current distinct-provider shard 0/1/2 proofs, while
`receipt_high_waters` is an epoch-wide append-only logical set for every receipt
chain ever committed in that epoch. A chain is identified by manifest, shard,
provider, lease, and workload—not by provider alone and not by receipt ID. Provider
replacement therefore does not erase an earlier chain, while the same provider may
legitimately start sequence zero under a different signed lease.

Every generation begins with a canonical reproof context that binds the exact prior
journal ID, next generation, manifest, proof-age policy, quorum, target shards, and
epoch. The storage execution challenge nonce is deterministically derived from that
context plus chain identity, sequence, and prior receipt ID. Because the complete
challenge is signed by the consumer and embedded in the provider-signed execution
receipt, a byte-identical receipt created before the current durable head cannot be
relabelled as current proof. An existing chain must advance by exactly one and name
its exact high-water receipt; a new lease chain must start at sequence zero with a
null predecessor. All three active receipts must be current-context proofs before a
new journal can be branded or committed. Stale, unavailable, partial, old-context,
and replayed evidence leaves the durable head unchanged.

`createConfidentialPlacementJournal` accepts only a module-private result produced
by `evaluateConfidentialPlacementReproof`, not an evaluation-shaped plain object,
clone, accessor, or Proxy wrapper around that result. The evaluator snapshots recognized records, dense arrays,
and byte views into owned inert data, uses captured collection operations, and
rechecks the realm around nested signed-artifact validation. The durable commit API
does not accept caller-selected generation, prior journal, high-water set, context
bytes, or journal bytes. `beginConfidentialPlacementReproof` reads the authoritative
head and fsyncs one immutable prior-bound intent before any receipt is produced;
commit reloads that intent and head, re-evaluates raw signed placements, and derives
the journal inside the boundary.

The v2 adapter writes immutable journal and transition files, then hard-links the
complete transition to a canonical `successor-<prior>.json` path. That no-replace
hard link is the CAS linearization point: different candidates for one prior cannot
both commit, an identical retry is idempotent, and a stale writer cannot append to a
  superseded head. A process crash before CAS leaves only ignored immutable orphans; after CAS,
  the claim already names a complete fsynced transition and journal. Loading follows
  successor claims from genesis or the exact legacy head rather than selecting the
  largest directory filename.

Journal v1 remains parseable only as migration metadata. Its three visible barriers
are not treated as complete history. Migration first persists a new 256-bit epoch
intent bound to the v1 head and remains unavailable until three fresh context-bound
storage receipts exist. Every visible v1 pointer is also checked for a v2 successor;
a late v1 writer that competes with an already-migrated anchor is a root fork, never
an automatically selected replacement. The epoch high-water ceilings are generated from the protocol
profile (128 chains per shard, 384 total); overflow fails closed without pruning and
requires another prior-bound epoch rotation. The journal remains unsigned local
  crash-policy evidence: file mode, directory custody, and the conforming controller
  are trust assumptions. It does not claim hostile-disk tamper resistance, global
  placement consensus, physical provider independence, or sudden-power-loss
  durability on a platform/filesystem that rejects directory fsync. Crash-left
  `.mortalos-pending-*` files are ignored but bounded reclamation is not yet implemented,
  so repeated crashes can consume disk and cause fail-closed unavailability. The
  adapter also assumes a trusted Node bootstrap and unmodified built-in module
  bindings; same-process arbitrary code is not a sandboxed adversary.

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
| Shard, freshness, journal, repair negatives | `node --test test/confidential-placement.test.mjs test/confidential-journal-v2.test.mjs` | Actual S4 package; every 2-of-3 pair; one/corrupt/duplicate/wrong-workload/stale/future rejection; generation-time completion and effective-revocation rejection; owned-inert evaluator and reproof-context acquisition; A/B/C→D/E/F→old A/B/C replay rejection; unseen historical receipt rejection; direct successor and new-lease acceptance only under the current context; v1 migration reproof; exact history cap/+1 failure; and journal/context tamper rejection |
| Stateful replacement and policy corpus | same command | Four bounded loss/stale/repair/corrupt policy cases plus an exact-ceiling path: 128 sequential signed prior-head-bound transitions, 381 genuine replacements, generation 129, 384 distinct provider/lease/chain high-waters (`128/128/128`), and 387 distinct receipts. A separately signed generation-130 `3/3` candidate proves before its 385th total/129th shard-0 chain fails commit without changing the ceiling bytes; no claim of independent physical failures |
| Existing plaintext P2P regression | `node scripts/verify-p2p-placement-chromium.mjs` | Direct DataChannel transport, provider loss, repair, A exit, 2-of-3 readback |
| Confidential Chromium vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual 98,317-byte native File; S4 encryption for B; three distinct ciphertext shards plus liveness challenge over WebRTC; provider loss; four observer processes and 3-of-4 certificate; A lineage commit; sign-once A→B custody handoff; A exit; successor-authorized operational signer creates new leases and successor commit. Then 127 mixed-runtime cycles from generation 2 use actual browser-held non-extractable provider keys, browser storage results/signatures, prior-head-bound contexts, and exact receipt successors to reach generation 129 with 384 distinct provider/lease/chain high-waters (`128/128/128`) and 387 receipts. A browser-signed generation-130 `3/3` candidate proves before plus-one commit rejection; bytes remain unchanged, serialized reload rejects the oldest replay, private material remains unexposed, and post-cut requests stay zero. The portable context/evaluation/journal controller is Node-orchestrated, so this is not independently in-browser journal-kernel parity; byte-identical convergence; corrupt-shard rejection; exact decryption; no custody-identity binding claim |
| Lineage controller | `node --test test/lineage-placement.test.mjs` | Provider-signed exact offer/lease-bound policy and consumer policy-bound challenge; legacy `/1` certificate rejects as repair authority; conditional late-proof conflict with supplied fresh response/current placement evidence; fresh-process deterministic replay; stale A rejection; independently valid same-parent generation fork halts |
| Current transport remediation | `node --test test/transport.test.mjs test/webrtc-transport.test.mjs` and `node scripts/verify-p2p-placement-chromium.mjs` | Focused Node `24/24` in `31,241ms` and actual Chromium PASS in `50,086ms`: one combined 512-unique-message/8,388,608-decoded-raw-byte transcript, duplicates non-consuming, outbound pre-send capacity/post-success commit, inbound overflow with no transcript/dedupe commit or delivery before terminal cleanup, virtual-transport exact raw-byte ceiling, hostile `Error`/`Symbol.hasInstance` containment, and remote-channel cleanup that closes a still-live peer while invoking native close capabilities at most once. Relay edge base64 estimation may reject slightly earlier; byte-identical edge accounting is not claimed. |
| Combined placement gate | `npm run test:p2p-placement` | The containing revision must pass the current Node suite and both current Chromium verticals; historical 17-case results predate the stateful corpus and do not transfer; exact-SHA CI is the publication authority |
| Public package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed consumer imports the authority-free placement surface |
| Complete repository regression | `npm test` | The current source/runtime/test ordered chain was invoked at `2026-08-21T20:48:19.650+09:00` and emitted final `verify:s4` PASS at `2026-08-21T23:11:26.544+09:00`; the wrapper did not emit an exact wall-time marker. Post-run evidence docs have separate static gates; exact-SHA CI remains the publication authority. |

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
  response and its verified current placement chain. The one-shard Lab/browser
  executor supplies both immediately before effect. The internal batch re-reads a
  private bounded transcript-range session between actions. The origin-cut Chromium
  gate now supplies that range from an actual direct DataChannel; the session still
  re-decodes canonical frames and admits only deduplicated response payload bytes.
- Local `unavailable_provider_ids` remains a diagnostic evaluator input only; the
  lineage generation surface rejects it.
- Browser processes share this PC, administrator, network, and credential domain.
- Manual same-host ICE does not prove arbitrary NAT traversal or Internet discovery.
- Ephemeral same-origin signing is not an XSS-resistant signer boundary.
- The Node exact-ceiling corpus executes the portable kernel directly. The separate
  mixed-runtime gate obtains each provider storage result and signature from an actual
  Chromium/Lab page while the Node verifier orchestrates the portable journal kernel.
  It does not prove independently in-browser journal-kernel parity. Both remain a
  same-PC deterministic topology, not independent machines, administrators,
  networks, or real partitions.
- Cloudflare Pages may publish the static Lab artifact, but it is not storage,
  scheduling, custody, discovery, or validation authority.

## Next root priority

The lineage and liveness layers are now implemented locally; see
[Lineage-bound placement convergence](LINEAGE_PLACEMENT_CONVERGENCE.md) and
[Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).
The policy/window, provider-only sampled response, one-shard effect/completion,
provider-domain sequential restart recovery, and internal multi-action fresh-evidence
batch slices are implemented. No-replace claims exclude cross-process first provider
and Continuity execution. Proof-import recovery completes an unresolved claim only
after outer verification of an exact authoritative result; missing proof remains
fail-closed. The Chromium Lab now connects the range adapter to an actual origin-cut
DataChannel and proves late-response and disconnect zero-call behavior. Lineage-
governed logical admission is now focused PASS: custody-signed membership sidecars,
operator/domain deduplication, overlap-safe reconfiguration, and compact admitted
policy `/2` are verified through the generation. The `10,000`-seed signed-evidence
schedule corpus is focused PASS in Node, fresh process, and bundled Chromium. A
private-key-free endpoint coordinator now produces an offline replay bundle on
loopback, while each durable signer service locks its own explicit challenge `/2`
origin before key use and survives restart. A fresh HTTPS observer records live identity,
peer-certificate/public-key, and socket-address facts but leaves both independence
verdicts `unproven`. A combined observer process can now attest exact probe bytes and
declared administration/failure-domain/vantage digests with a durable key. One
non-authoritative content-addressed plan precommits the complete observer roster,
per-key nonces, logical window, and those declarations. Every roster key signs one
ceremony-scoped acceptance and the complete set activates the exact plan before the
  combined probe; a conflicting same-ceremony plan halts. Membership binding `/1` then
  requires the current custody-quorum epoch's exact ceremony subject evidence and complete
  observer membership, with identity/operator/failure-domain matches. Attestation `/4`
  binds that artifact and the view rejects a missing or substituted assignment. This
  prevents same-roster post-hoc plan selection and raw disjoint unadmitted rosters in the
  conforming flow. It is policy-scoped roster admission, not trusted clock, issuer honesty,
  physical topology, or absolute Sybil authority.
The next P0 is operating that exact signer/coordinator contract plus the whole plan
roster under external administration and measured multi-host topology. Key-count
quorum and self-asserted topology labels must not be promoted as physical independence.
