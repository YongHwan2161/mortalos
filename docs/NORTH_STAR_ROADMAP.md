# MortalOS North Star roadmap

Status: **ACTIVE — S3 promoted; S4 cryptographic ADR review**

Last synchronized: **2026-07-26 KST**

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
`30202501782/2`. S4 implementation remains blocked while the
[confidential-state cryptographic ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md) is under
independent review. Independent failure domains remain a later stage. The
[claim matrix](CLAIM_MATRIX.md) separates implemented, locally verified, physically
verified, promoted, and explicitly unclaimed behavior.

## Priority order

1. **S0 — baseline reset:** current documents, claims, tracking, dependency evidence,
   and one reproducible receipt.
2. **S1 — Unified Participant Core:** one authoritative state machine and adapter
   boundary for browser, CLI, durable, handoff, and quorum paths.
3. **S2 — crash-safe durable quorum:** cold restart, sign-once journal, one-endpoint
   loss, continuation, and repair.
4. **S3/S4 — recoverable confidential state:** exact R3 reconstruction followed by
   epoch-key confidentiality and revocation.
5. **S5/S6 — usable product surface:** SDK/CLI and one bounded Continuity Capsule.
6. **S7 — independent failure domains:** 100-trial matrix and immutable seven-day
   burn-in across genuinely separate credential/runtime domains.
7. **S8 — adversarial custody and browser parity:** explicit equivocation handling,
   compromised-key recovery, and actual Chromium/Firefox/WebKit capability claims.

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
