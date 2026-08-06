# MortalOS documentation map

Last synchronized: **2026-08-07 KST**

## Current authority

- [North Star implementation SSOT](IMPLEMENTATION_PLAN.md) — sole current direction,
  priority order, S0–S8 ledger, strict PASS/HOLD gates, and Definition of Done.
- [Current claim matrix](CLAIM_MATRIX.md) — implemented, exact-head verified, physically verified, promoted, and explicitly unclaimed behavior.

The former separate roadmap and stage-tracking files were folded into the
implementation SSOT to prevent priority and status drift. GitHub issues remain
coordination metadata; historical plans cannot promote a current claim.

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
`2-of-3` loss/repair, the S1 Participant Core, the historical S2 durable quorum
claim, and S3 exact logical resource recovery within the qualifications in the
claim matrix. Main `12e90e6199b16b5379a6d4c1caa62cd24f7446e5` also contains
revised S2/S4 code and S5–S8 implementation surfaces. Their presence in main does
not replace a stage receipt or prove physical independence.

The immediate product priority is the hostless participant substrate defined in the
implementation SSOT. The direct WebRTC P0 candidate proves that an already-loaded
A/B pair can complete signed Genesis, join, handoff, origin-A exit, and B continuation
after every HTTP path is denied. `mortal-os.com` remains an optional bootstrap and
demonstration origin, never a runtime authority. Peer-distributed application
bootstrap, cross-network reachability, signed resource leases, circulating repair,
migratable computation, independent failure domains, Byzantine/Sybil resistance,
global death, and WebKit full signing parity remain unpromoted. GPT is optional and
non-authoritative.
