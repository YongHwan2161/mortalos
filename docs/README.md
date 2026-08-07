# MortalOS documentation map

Last synchronized: **2026-08-08 KST**

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
- [Signed bounded resource contract](RESOURCE_CONTRACT.md)

`mortalos/0` preserves an opaque declared state root and has no state-transition
event. `mortalos/1` binds exact bounded state artifacts and deterministic
transitions. The [R3 state availability ADR](STATE_AVAILABILITY_AND_RECOVERY.md)
adds the promoted bounded manifest/chunk recovery protocol, but does not prove
physical-domain durability or global availability. The
[S4 confidential-state ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md) is promoted. Its
revised runtime is merged, but the revised confidentiality claim remains reopened
until its own fresh stage receipt and promotion gates pass.

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
claim matrix. Main `0779741402244d6cd802a1179bd2c94555bdd030` also contains
revised S2/S4 code, the governed PR #53 continuity vertical, S5–S8 implementation
surfaces, and the governed PR #56 resource contract/execution vertical. Their
presence in main does not replace a claim-specific receipt or prove physical
independence.

The real-file A-to-B continuity vertical, portable signed resource contract,
threshold network-visible sign-once gossip, and lease-bound
storage/bandwidth/compute receipts are merged. The execution proof is deliberately
limited to an actual local provider process. Missing, tampered, replayed, forked,
or cross-lease work evidence cannot be reported as proved. Provider loss requires a
newly signed offer and lease while the same immutable workload ID can be retained.
This does not prove independent witnesses, providers, credentials, administrators,
regions, or failure domains. It does not promote the revised confidential-state
claim, provider independence, public registry publication,
Byzantine/Sybil resistance, global death, or WebKit full signing parity. GPT is
optional and non-authoritative.
