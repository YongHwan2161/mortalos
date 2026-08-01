# MortalOS North Star roadmap

Status: **ACTIVE — S2/S4 claims reopened; S5–S8 candidate implementation**

Last synchronized: **2026-08-01 KST**

The sole detailed implementation SSOT is the
[post-hackathon North Star implementation plan](POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md).
Historical contest and release plans remain discoverable under [`archive/`](archive/)
but do not set current priority.

## North Star

> When any one endpoint, administrative credential domain, or primary relay
> disappears, a surviving quorum can cold-start, reconstruct the exact authorized
> state, commit the next transition, and repair membership without making a browser,
> server, cloud provider, UI, or model the authority.

Product sentence:

> **Create once. Continue elsewhere.**

## Current position

MortalOS already has a portable deterministic kernel, v1 bounded state transitions,
browser-held non-extractable keys, A→B succession, logical `2-of-3` loss/repair
evidence, an authority-neutral relay, and English/Korean Lab acceptance.

S1 is promoted and routes the live incubator, durable reload, handoff, and logical
quorum participants through one deterministic Participant Core. S2 is promoted and
adds a versioned write-ahead sign-once journal, replay-only recovery, strict
IndexedDB transactions, explicit authority policy, schema migration, process-cold
handoff recovery, and durable one-loss/D-repair matrices. S3 is promoted at
`1f8c055f1cf6fb4ee304f0b61cbe6507c65dba7d` with a canonical resource manifest,
64 KiB content-addressed chunks, exact 1 MiB reconstruction, resumable recovery,
an independent Python verifier, exact-main Verify `30202501790/1`, and Deploy
`30202501782/2`. The S4 cryptographic ADR is promoted at `39529337…`; its runtime
candidate now implements ciphertext-only S3 packages, non-extractable RSA/AES key
handling, epoch-wide signed counter reservations, any-two recovery/decryption,
removed-member denial, and authority-only rotation. S4 promotion remains gated by
its exact receipt, frozen-source rerun, independent review, merge, and exact-main
deployment; the complete pre-freeze ordered suite passes. Independent failure
domains remain a later stage.

The current candidate reopens S2 and S4 because it moves the trust boundary below
the outer authority object: durable stores and confidential activation stores are
now module-private capabilities, complete invocations are owned before the first
await, and public decrypt/durable results redact key handles. It also adds a single
generated protocol profile, real relay chunk fragmentation, an S5 package/CLI, S6
Capsules, an S7 process-isolated replicated counter model, and S8 stateful custody
fuzzing. Chromium and Firefox pass full candidate browser paths. WebKit is no longer
classified by engine name: a capability probe runs the full custody path when a
non-extractable Ed25519 signer passes the canonical 65,536-byte message ceiling and
otherwise fails closed to verifier-only. Windows lacks Ed25519; Ubuntu WebKit creates
a key but fails the full protocol signing envelope, so both current builds take the
verifier-only path. The
[claim matrix](CLAIM_MATRIX.md) separates implemented, locally verified, physically
verified, promoted, and explicitly unclaimed behavior.

## Priority order

1. **P0 — re-promote S2/S4:** new receipts, full suite, immutable independent review,
   merge, post-merge CI, and exact deployment for the hardened trust boundary.
2. **P0 — finish S5/S6 release:** clean-install package evidence and exact Capsule
   interoperability receipt.
3. **P1 — production S7:** provision genuinely distinct providers/admins/credentials,
   run 100 failure trials, then immutable seven-day burn-in.
4. **P1 — GitHub merge authority:** live ruleset plus a separately provisioned
   reviewer identity that gives native exact-head approvals.
5. **P2 — WebKit signer parity:** close the capability-routed full S2/S4 matrix on
   a release runner that passes the protocol-ceiling signing probe; never infer full
   capability from key generation or fall back to exportable private bytes.

## Promotion invariant

A stage is promoted only when its exact source, receipt, tests, independent review,
and post-merge evidence agree. A partial green run, older receipt, local-only
topology, or healthy endpoint is not stage completion. Any missing field, skipped
runtime, source mismatch, hidden fork, key leak, or claim above evidence sets the
stage to **HOLD**.

## Verification continuity

Every publishable SHA must still pass:

- locked install, license, specification, links, governance, protocol, state,
  transport, relay, multi-browser, Lab, UX, and portable gates;
- actual Chromium comparison, coverage, and zero-finding dependency audit; and
- immutable review, expected-head merge, and post-merge exact-main Verify.

Committed, Node, isolated browser-target, and actual Chromium results must be
byte-identical for the portable corpus. Exactly 10,000 cases replay from seed
`1297044052`. Any cross-runtime mismatch reopens the earliest portable gate and
invalidates later evidence. An old green run does not cover a new SHA.

S3 satisfied its complete receipt, immutable review, expected-head merge,
post-merge Verify, and exact-main deployment gates. S4 may proceed only in this
order: promote the cryptographic ADR, freeze an implementation source and exact
receipt, obtain a second immutable implementation review, then merge and verify the
exact main deployment.
