# MortalOS North Star implementation SSOT

Status: **ACTIVE IMPLEMENTATION SSOT — S2/S4 claims reopened; candidate promotion HOLD**

Last synchronized: **2026-08-01 KST**

This is the sole ordered S0–S8 execution plan. Historical receipts remain valid
evidence for their named commits, but they do not authorize claims for a later
source tree. The current candidate obtains no promotion from old S2/S4 receipts.

## 1. North Star

> A digital organism remains deterministically identifiable, recoverable, and
> continuable after any one endpoint, relay, or storage replica disappears,
> without trusting a mutable public object, exposing private authority, or
> silently selecting a fork.

The product sentence remains **Create once. Continue elsewhere.** The protocol
claim is narrower than “decentralized”, “ownerless”, or “immortal”: a verified
quorum can continue one exact lineage and resource state under declared failure
assumptions.

## 2. Most fundamental improvement

The root problem is not a missing feature. It is an incomplete trust boundary:
previous code sometimes branded an outer authority while calling mutable methods
on the store behind it, or verified an object before `await` and used the caller's
mutable graph afterwards. A green test or historical receipt could then overstate
the current source.

The governing rule is now:

> Every security-sensitive async entrypoint must own its complete transitive
> invocation before its first `await`, and every authority-changing commit must
> use a module-private capability followed by exact readback.

This rule controls S2 sign-once, S3/S4 recovery, S4 rotation, S7 counter allocation,
Capsule activation, fuzzing, documentation, and promotion evidence.

## 3. Current implementation ledger

| Stage | Candidate state | Local evidence | Promotion state |
| --- | --- | --- | --- |
| S0/S1 | Historical baseline and Participant Core retained | Existing exact-commit receipts | Historical promotion only |
| S2 | Durable store capability captured privately; public document redacts `CryptoKey`; sign invocation owned before await | Node durable matrix and Chromium/Firefox persistent-profile matrix pass | **REOPENED / HOLD** until new exact-head receipt and review |
| S3 | Limits generated from one protocol profile; real relay fragment data plane; activation CAS/readback is idempotent | 1 MiB reconstruction, 10,000 recovery corpus, real relay message test pass | Existing promotion remains historical; new data plane is candidate |
| S4 | Recovery inputs owned; epoch activation uses private capability and exact readback; public decrypt/recovery results omit epoch keys | Node, Chromium, and Firefox cryptographic/rotation gates pass | **REOPENED / HOLD** until new exact-head receipt and review |
| S5 | Authority-free `@mortal-os/core` export map and `mortalos` CLI | SDK allowlist, CLI, and package allowlist pass | Candidate only |
| S6 | Canonical Continuity Capsule binds lineage, latest state transition, manifest, receipt, chunks, and exact resource | Cross-process CLI verification and tamper rejection pass | Candidate only |
| S7 | Majority counter store, three process-isolated HTTP CAS replicas, disk restart, repair, and topology validator | Concurrent coordinators, one replica loss, restart, and no-overlap gates pass | Local topology PASS; real independent providers/admins **HOLD** |
| S8 | Stateful mutation corpus and 2-of-3 adversarial Capsule custody | S2/S4 accessor/Proxy/prototype/array corpus; corrupt/lost/fork custody gate pass | Chromium/Firefox full local PASS; WebKit capability-routed exact-head CI **HOLD** |

## 4. Global gate and evidence rules

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

## 5. Required verification commands

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

## 6. S0 — Post-hackathon baseline reset

Stage alias: **S0 — baseline reset:** current claim and evidence authority.

Goal: preserve historical receipts as immutable evidence while resetting current
claim authority to the new candidate.

Pass criteria:

- current claim matrix says S2/S4 are reopened;
- old receipts still verify only their recorded commits;
- this SSOT, roadmap, tracking, threat model, traceability, README, and browser
  compatibility agree;
- no current document treats a local green run as promotion.

## 7. S1 — Unified Participant Core

Stage alias: **S1 — Unified Participant Core:** one deterministic authority path.

Goal: retain one deterministic lineage authority shared by UI, durable participant,
CLI, and recovery adapters.

Pass criteria:

- adapters cannot construct accepted context or choose a head;
- canonical Node/browser results remain byte-identical;
- proxy, accessor, cloned-context, fork, and bounded-input negatives remain green.

## 8. S2 — Durable capability and sign-once security

Goal: a mutable or spoofed store cannot lie about a committed signing intent, and no
supported public result exposes a usable signing key.

Implemented work:

- registered durable stores hold module-private read/write closures;
- endpoint code ignores replaced own/prototype `read` and `write` methods;
- body, proposal, purpose, key id, and message are owned before the first await;
- the public durable document is constructed without placing the private key in the
  clone graph, and contains key id and public key only;
- signer and WebCrypto facade injection cannot receive the key: signing calls a
  captured native intrinsic and the optional test boundary receives one string;
- expected-revision CAS occurs before signing and exact replay restores authority.

Pass criteria:

- concurrent same-revision writers produce one signer call and one released tuple;
- every WAL boundary yields only old, pending, or complete new state;
- cold restart, expiry rollback latch, migration, A/B/C loss, and D repair pass in
  actual Chromium and Firefox;
- accessor/Proxy/prototype/store/array fuzz releases no duplicate signature;
- `JSON.stringify(endpoint.document)` contains neither `private_key` nor a
  `CryptoKey` handle.

## 9. S3 — Protocol profile and real chunk data plane

Goal: one generated profile governs state, transport, provider, and confidential
limits, and a legal state chunk actually traverses relay messages.

Implemented work:

- `protocol/profile.v1.json` is the source for generated constants;
- 64 KiB state chunks are split into 32 KiB relay fragments with domain-separated
  digests and bounded reassembly;
- recovery fetches actual relay frames, verifies fragment/chunk/root bindings, and
  commits by CAS plus readback;
- the outer chunk array and every nested byte array are owned before the first
  transport await;
- exact-max and max-plus-one cases are generated from the profile.

Pass criteria:

- generated file equals source profile byte-for-byte after regeneration;
- no S3 chunk can exceed a transport/provider envelope;
- a real 1 MiB package traverses relay frames and reconstructs exact bytes;
- missing, duplicate, reordered, oversized, corrupt, or cross-chunk fragments never
  activate state;
- repeating the same completed activation succeeds idempotently; a conflicting
  successor fails closed.

## 10. S4 — Recovery, activation, and private-key containment

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

## 11. S5 — SDK and CLI

Goal: installable consumers use one reviewed, authority-free protocol surface.

Pass criteria:

- package `exports` exposes only the SDK and protocol profile;
- SDK export names exactly match the allowlist and contain no authority, store,
  decrypt-key, or private-key primitive;
- CLI verifies profiles, one Capsule, and quorum custody copies deterministically;
- packed artifacts omit lab, evidence, tests, scripts, agents, and GitHub internals;
- a clean temporary install runs on supported Node versions.

## 12. S6 — Continuity Capsule

Goal: one canonical bounded artifact carries enough public evidence and encrypted
resource state to verify and continue elsewhere without private authority.

Pass criteria:

- Capsule binds organism, complete lineage, latest state-transition payload,
  manifest, receipt, ordered chunks, and profile;
- another process verifies the same capsule id/head/state/resource;
- mutation, truncation, stale lineage, wrong chunk, or wrong receipt fails before
  activation;
- serialized bytes contain no private key, `CryptoKey`, PKCS#8, or raw epoch key.

## 13. S7 — Independent counter authority and topology

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

## 14. S8 — Adversarial custody and browser parity

Goal: hostile storage/custody behavior is classified without last-write-wins, and
every browser gets an evidence-backed capability profile.

Pass criteria:

- deterministic stateful corpus combines accessor, Proxy, prototype, store-method,
  and array mutation at await boundaries;
- 2-of-3 Capsule custody recovers one lost/corrupt copy, rejects a valid fork, and
  fails below quorum;
- Chromium and Firefox pass portable validation, S2 durable restart/loss, and S4
  counter/rotation in actual engines;
- WebKit passes portable validation and capability detection; runtimes with native
  non-extractable Ed25519 must run the full S2/S4 family, while runtimes reporting
  `NotSupportedError` remain verifier-only;
- no user-agent string grants support and no fallback exports raw key material.

WebKit full signing parity is therefore **HOLD** until the signer-capable CI route
passes on the exact head; non-capable runtimes remain an explicit verifier-only
profile. Weakening key containment is not an acceptable workaround.

## 15. GitHub merge authority

Goal: native branch protection requires an approval from a GitHub identity that is
not the author/implementer and dismisses approval when the head changes.

Pass criteria:

- default-branch ruleset requires pull request, one native approval, code-owner
  review where applicable, conversation resolution, and required CI;
- force push, deletion, and bypass are disabled except documented break-glass;
- reviewer bot/App or machine account has its own identity and least-privilege
  review permission;
- an approval binds the exact immutable head and a changed head dismisses it;
- the reviewer cannot alter the implementation branch or its own policy workflow.

Repository policy files may be implemented locally, but the gate remains **HOLD**
until the external identity is provisioned and the live ruleset readback proves it.

## 16. Completion and explicit nonclaims

The program is complete only when all S0–S8 rows have exact receipts, independent
review, expected-head merge, post-merge CI, and—where claimed—live topology/deploy
evidence. Until then the aggregate status is **HOLD**.

Explicit nonclaims:

- Byzantine or Sybil resistance and automatic fork resolution;
- proof that every hidden copy is erased;
- physical independence inferred from profiles, ports, containers, or processes;
- global death certificates;
- GPT/model product features as protocol authority.
