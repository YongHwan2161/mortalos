# MortalOS documentation map

Last synchronized: **2026-08-01 KST**

## Current authority

- [North Star roadmap](NORTH_STAR_ROADMAP.md) — short current direction and stage order.
- [North Star implementation SSOT](POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md) — current compact S0–S8 ledger, strict PASS/HOLD gates, and Definition of Done.
- [Current claim matrix](CLAIM_MATRIX.md) — implemented, exact-head verified, physically verified, promoted, and explicitly unclaimed behavior.
- [Stage tracking](STAGE_TRACKING.md) — S1–S8 issues, owner, milestone, and required receipt paths.

Exactly one active roadmap and one detailed implementation SSOT exist. Historical
plans cannot promote a current claim.

## Normative protocol and evidence boundaries

- [Protocol](PROTOCOL.md)
- [Threat model](THREAT_MODEL.md)
- [Rejection codes](REJECTION_CODES.md)
- [Requirements traceability](TRACEABILITY.md)

`mortalos/0` preserves an opaque declared state root and has no state-transition
event. `mortalos/1` binds exact bounded state artifacts and deterministic
transitions. The [R3 state availability ADR](STATE_AVAILABILITY_AND_RECOVERY.md)
adds the promoted bounded manifest/chunk recovery protocol, but does not prove
physical-domain durability or global availability. The
[S4 confidential-state ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md) is promoted. Its
runtime is an exact-head candidate and grants no promoted confidentiality claim
before its receipt, full suite, review, merge, and exact-main deployment pass.

## Architecture and compatibility

- [Unified Participant Core](PARTICIPANT_CORE.md)
- [Crash-safe durable quorum](DURABLE_QUORUM.md)
- [R3 state availability and recovery](STATE_AVAILABILITY_AND_RECOVERY.md)
- [S4 confidential-state cryptographic ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md)
- [Distributed counter-authority ADR](DISTRIBUTED_COUNTER_AUTHORITY_ADR.md)
- [Endpoint-neutral access architecture](ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](BROWSER_PARTICIPANT_COMPATIBILITY.md)

## Governance

- [Agent collaboration and merge protocol](AGENT_COLLABORATION.md)
- [Repository contribution guide](../CONTRIBUTING.md)

## Historical records

- [Historical documentation archive](archive/README.md)

The archive preserves release and experiment evidence without treating old
deadlines, submission paths, or promotion status as current authority.

## Current claim boundary

The repository promotes portable lifecycle validation, deterministic v1 state
transition, read-only evidence replay, Chromium A→B succession, logical Chromium
`2-of-3` loss/repair, the merged S1 Participant Core, S2 crash-safe durable quorum,
and S3 exact logical resource recovery within the qualifications in the claim
matrix. The current candidate reopens S2/S4 after trust-boundary hardening and adds
S5–S8 candidate surfaces. No new stage is promoted until its new exact-head receipt,
immutable review, merge, and post-merge evidence complete.

It does not yet promote the current confidential-state revision, independent
failure domains, SDK/CLI/Capsule release, Byzantine/Sybil resistance, global death,
or WebKit signing parity. GPT is optional and non-authoritative.
