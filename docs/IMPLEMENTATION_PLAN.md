# MortalOS North Star implementation SSOT

Status: **ACTIVE IMPLEMENTATION SSOT — HOSTLESS WEBRTC P0 CANDIDATE; PROMOTION HOLD**

Last synchronized: **2026-08-07 KST**

This is the sole current direction, stage ledger, and ordered implementation plan.
Historical receipts remain valid only for their named commits. Main
`12e90e6199b16b5379a6d4c1caa62cd24f7446e5` contains the reviewed S2-S8 platform
implementation; merge alone does not manufacture a stage receipt or a physical-
independence claim.

## 1. North Star

> **The network does not host MortalOS. The living network is MortalOS.**

Opt-in participants contribute bounded storage, bandwidth, and eventually
computation. One organism's identity, memory, custody, and execution circulate among
those participants and continue under explicit quorum and failure assumptions. No
fixed domain, origin, backend, relay, storage provider, or model is required to
validate a transition or continue an already distributed organism.

**Create once. Continue elsewhere.** remains the user sentence. The protocol claim
is narrower than “decentralized”, “ownerless”, or “immortal”: conforming participant
kernels continue one exact lineage and state under declared failure assumptions.
`mortal-os.com` is an optional bootstrap and demonstration origin, not a runtime
authority or required protocol dependency.

### Forbidden fixed-backend boundary

A fixed backend MUST NOT define identity, head, membership, quorum, scheduling, or
continuity. It also must not be the sole holder of live state needed for progress.
Static artifact distribution, peer rendezvous, STUN, TURN, archival storage, and
telemetry are optional replaceable adapters. Their output is untrusted input to each
participant's local kernel; losing any one of them may reduce reachability but cannot
change protocol truth.

## 2. Most fundamental improvement

The file-continuity vertical, SDK/CLI, durable quorum, and replicated custody are
implemented foundations. They are organs of MortalOS, not the participant network
itself. Treating independent cloud providers as the next root milestone would merely
replace one hosting topology with several hosting topologies and would drift from the
North Star.

The most fundamental remaining gap is **network embodiment**: participant-owned
transport, resource offers, bounded leases, repair, and deterministic work placement
must compose into one peer protocol. The current P0 candidate closes the first slice.
Two actual Chromium processes use a direct ordered WebRTC DataChannel; after a
manual WebRTC offer/answer exchange, every HTTP request is denied before Genesis,
join, handoff, A authority removal/process exit, and B's next transition. There is no
signaling-server, STUN, TURN, HTTP, or relay fallback in that proof.

This is source-level and same-host Chromium evidence, not physical distribution or
Internet-wide reachability. The next architecture milestone is therefore a signed,
bounded participant resource-offer/lease contract exercised by at least three peers
under churn. Independent providers remain useful optional participants and failure
domains, but no provider becomes the OS.

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
| S3 | Generated profile and real relay fragment data plane | 1 MiB reconstruction, recovery corpus, real relay message test | Product-integrated local candidate; independent provider topology remains unproven |
| S4 | Private activation capability, exact readback, key-redacted recovery | Node plus Chromium/Firefox cryptographic and rotation gates | Historical receipt only; revised claim remains **HOLD** |
| [S5](https://github.com/YongHwan2161/mortalos/issues/34) | Authority-free default SDK plus explicit continuity capability subpath and full CLI | Export/pack/install/full-flow tests | Product-integrated candidate; publish and promotion pending |
| [S6](https://github.com/YongHwan2161/mortalos/issues/35) | Canonical Continuity Capsule and signed 2-of-3 content custody | Cross-process verification, handoff, exact recovery, and duplicate/tamper/fork rejection | End-to-end candidate complete; integrated receipt pending |
| [S7](https://github.com/YongHwan2161/mortalos/issues/36) | Three process-isolated HTTP counter replicas | Concurrent CAS, one loss, restart, repair | Logical model only; real provider independence deferred |
| [S8](https://github.com/YongHwan2161/mortalos/issues/37) | Stateful mutation corpus and capability-routed browser parity | Chromium/Firefox full path; WebKit verifier-only | Merged regression boundary; strong custody deferred |
| Hostless WebRTC P0 | Direct participant DataChannel and backend-cut succession | Actual isolated Chromium contexts; canonical manual signals; HTTP denied before protocol flow | Local candidate; exact-head CI/review/merge and physical topology remain **HOLD** |

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

### P0 — Restore the North Star and forbidden boundary

- make participant-owned execution, storage, and transport the governing product
  architecture rather than a fixed service topology;
- mark the public domain and every bootstrap/signaling/relay/provider adapter as
  optional, replaceable, and non-authoritative;
- retain the existing continuity, cryptography, and fail-closed validation as kernel
  components rather than presenting them as the whole OS;
- make specification verification fail if these boundaries disappear from the SSOT.

Strict pass criteria:

- README, architecture, plan, documentation map, and claim matrix agree on the exact
  North Star and current HOLD boundary;
- the spec gate requires the North Star sentence, fixed-backend prohibition, optional
  domain status, direct WebRTC proof, and revised source sequence;
- no website deployment, Cloudflare account, DNS record, provider receipt, or model
  credential is required by the protocol/package verification gate.

### P0 — Actual WebRTC participant transport

- carry the existing bounded canonical participant messages over a real ordered
  WebRTC DataChannel;
- use canonical exact-key offer/answer signals that can be copied or transported by
  any replaceable rendezvous mechanism;
- default to an empty ICE-server list and fail closed when WebRTC, signaling, bounds,
  canonical encoding, binary frames, or the channel are invalid;
- expose a participant session that performs Genesis, join, custody handoff, A
  authority removal, and B continuation without exporting either private key.

Strict pass criteria:

- two isolated actual Chromium processes exchange the manual offer/answer without a
  signaling service;
- both contexts load from a random local origin, then all browser and server HTTP is
  denied before Genesis, join, handoff, A exit, and B continuation;
- A's authority is removed and A's browser process is closed before B commits sequence 2 for
  the same `organism_id`;
- the transport uses no HTTP relay, WebSocket relay, STUN, TURN, or fallback path;
- malformed, non-canonical, wrong-role, unknown-key, and oversized signals reject;
- public snapshots contain no private key material;
- the focused Node transport suite, Lab build, and backend-cut Chromium verifier pass.

Candidate status: implemented in this source tree; promotion remains **HOLD** pending
exact-head CI, immutable review, expected-head merge, and post-merge verification.
Same-host processes are not a physical-failure-domain claim.

### P1 — Participant resource offer and bounded lease

Define signed offers for storage bytes, bandwidth rate/burst, compute class, lease
duration, revocation, and proof cadence. The scheduler must be a deterministic local
policy over verified offers, not a server decision. Pass when three peers allocate and
repair one resource across join/leave/revoke churn; forged capacity, stale offers,
overcommit, Sybil double-counting, and silent expiry fail closed.

### P1 — Circulating memory and repair

Compose Continuity Capsule chunks with participant leases and erasure/quorum repair.
Pass when the origin and one custodian disappear, remaining peers reconstruct exact
bytes, repair onto a new peer, and commit the next lineage transition without any
fixed provider. Cross-device/network trials and explicit resource accounting are
required; same-host ports do not satisfy this gate.

### P1 — Migratable deterministic computation

Introduce a bounded deterministic WASM task profile whose code, input, state root,
resource budget, and output receipt are canonical. Pass when execution moves A→B→C,
all conforming runtimes reproduce the result, and nondeterminism, budget exhaustion,
unsupported host calls, stale input, or conflicting output halt safely.

### P1 — Peer-distributed bootstrap and usable Lab

Keep `mortal-os.com` as an optional discovery channel while adding signed bundle
export/import and peer invitation. Pass when a new clean client authenticates a bundle
obtained from another participant, joins without DNS/origin access, and completes the
same flow through accessible EN/KO instructions. Advanced diagnostics remain hidden
from the primary journey.

### P2 — Stronger custody and Internet topology

After the participant substrate passes, add replaceable rendezvous and opt-in
STUN/TURN adapters, Firefox/WebKit parity, isolated signer custody, real independent
devices/networks/administrators, 100 failure trials, and burn-in. Optional cloud
providers may participate under the same lease contract; none may become privileged.

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
npm run verify:webrtc-participants
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

The North Star/forbidden-boundary documentation and direct WebRTC participant P0 are
implemented as a local candidate but remain promotion **HOLD** until exact-head CI,
immutable independent review, expected-head merge, and post-merge verification pass.
The prior real-file vertical and public package surface remain foundations. S2/S4
strong-custody, product Capsule confidentiality, cross-device WebRTC reachability,
peer-distributed bootstrap, and S7 physical-independence claims remain **HOLD**
without blocking ordinary product iteration.

Explicit nonclaims:

- Byzantine or Sybil resistance and automatic fork resolution;
- proof that every hidden copy is erased;
- physical independence inferred from profiles, ports, containers, or processes;
- domain-free application distribution or new-peer bootstrap inferred from an
  already-loaded pair surviving origin loss;
- arbitrary Internet reachability without replaceable rendezvous/STUN/TURN adapters;
- global death certificates;
- GPT/model product features as protocol authority.
