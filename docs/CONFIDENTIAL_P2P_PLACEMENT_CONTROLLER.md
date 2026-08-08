# Confidential P2P placement controller

Status: **LOCAL EXACT-SOURCE PASS — GOVERNED MERGE AND PHYSICAL PROMOTION HOLD**

Last synchronized: **2026-08-09 KST**

## Purpose

This vertical closes two weaknesses of the first storage placement candidate:
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
7. the provider is not locally observed unavailable.

The exact maximum proof age counts. Maximum plus one millisecond returns
`stale-proof` and stops counting. Two available shards permit recovery while three
satisfy the placement target.

## Crash and custody succession

The portable journal contains only canonical public evidence: manifest, policy,
generation, provider/shard identity, challenge sequence, and last receipt ID. The
Node Lab adapter persists immutable journal and append-only generation-pointer
files. A crash before the pointer leaves an ignored orphan; two different pointers
for the same highest generation halt as a fork instead of choosing a winner.

After restart, an old receipt is not silently reused. For an existing lease, the
next counted proof must directly reference the journaled receipt and increment the
challenge sequence. A genuinely new provider and lease may enter with its first
valid receipt.

A stronger custody rule applies after endpoint A exits: A's private consumer key is
not transferred to B merely to extend A's leases. B reconstructs the encrypted
package from quorum, decrypts with B's non-extractable custodian key, and renews
placement under B's own consumer identity through new offers, leases, and receipts.
This makes key non-transfer and controller continuity compatible.

## Executable evidence

| Gate | Command | Result |
| --- | --- | --- |
| Shard, freshness, journal, repair negatives | `node --test test/confidential-placement.test.mjs` | Actual S4 package; every 2-of-3 pair; one/corrupt/duplicate/wrong-workload/stale/future/replay rejection; real commit-process exit and load-process restart; directly chained re-proof |
| Seeded controller policy corpus | same command | 100 deterministic loss, stale, repair, and corrupt-evidence cycles over cryptographically verified fixture states; no claim of 100 physical failures |
| Existing plaintext P2P regression | `node scripts/verify-p2p-placement-chromium.mjs` | Direct DataChannel transport, provider loss, repair, A exit, 2-of-3 readback |
| Confidential Chromium vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual 98,317-byte native File; S4 encryption for B; three distinct ciphertext shards over WebRTC; provider signatures; origin cut; journal replay rejection; provider loss; A exit; B new leases; corrupt-shard rejection; exact decryption |
| Combined placement gate | `npm run test:p2p-placement` | 12 Node tests plus both actual Chromium verticals PASS |
| Public package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed consumer imports the authority-free placement surface |
| Complete repository regression | `npm test` | Entire ordered suite PASS in 3,101.1 seconds after append-only generation-pointer hardening and pointer-to-journal generation binding, including durable browsers, S4, P2P, SDK, Lab UX, portable 10,000/10,000, independent differentials, and S3/S4 receipts |

## Explicit nonclaims

- The local controller is not globally serialized across multiple simultaneous
  custodians. Concurrent legitimate controllers can still issue redundant repair
  leases until placement state is bound to lifecycle lineage.
- Local `unavailable_provider_ids` input is not a signed global death or outage fact.
- Browser processes share this PC, administrator, network, and credential domain.
- Manual same-host ICE does not prove arbitrary NAT traversal or Internet discovery.
- Ephemeral same-origin signing is not an XSS-resistant signer boundary.
- The 100-cycle corpus is deterministic policy coverage over valid cryptographic
  states, not 100 independent machines or real network partitions.
- Cloudflare Pages may publish the static Lab artifact, but it is not storage,
  scheduling, custody, discovery, or validation authority.

## Next root priority

The next P0 is **lineage-bound distributed controller handoff and repair
convergence**. Placement policy state must become a signed part of the current
continuity transition so that exactly one successor plan is current, partitions
fail closed, and healed peers converge without duplicate repair or billing. Only
after that should the project optimize discovery/NAT adapters or claim independent
provider topology.
