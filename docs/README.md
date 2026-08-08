# MortalOS documentation map

Last synchronized: **2026-08-09 KST**

## Read first

- [North Star implementation SSOT](IMPLEMENTATION_PLAN.md) — current direction,
  evidence layers, priority order, and strict completion gates.
- [Current claim matrix](CLAIM_MATRIX.md) — what is implemented, verified,
  promoted, and explicitly unclaimed.
- [P2P storage placement and repair](P2P_PLACEMENT_AND_REPAIR.md) — current local
  candidate contract, executable gates, and nonclaims.
- [Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md)
  — ciphertext shards, proof freshness, crash recovery, custody succession, and the
  next controller-convergence gap.

These three files answer “where are we now?” Completed contest-era evidence and UX
plans remain isolated under `docs/archive/` because historical baseline receipts bind
them; they are not current instructions. GitHub issues are coordination metadata and
cannot promote a claim.

## Normative contracts

- [Protocol](PROTOCOL.md)
- [Threat model](THREAT_MODEL.md)
- [Rejection codes](REJECTION_CODES.md)
- [Requirements traceability](TRACEABILITY.md)
- [Signed bounded resource contract](RESOURCE_CONTRACT.md)

The lifecycle kernel, resource contract, and placement policy are different layers.
The kernel decides canonical lineage validity. The resource validator decides
whether signed offer/lease/usage/execution evidence is valid. Placement is a local
scheduling policy that counts only valid exact-workload receipts. Transport, UI,
discovery, signaling, Cloudflare, and GPT decide none of those results.

## Architecture and compatibility

- [Unified Participant Core](PARTICIPANT_CORE.md)
- [Crash-safe durable quorum](DURABLE_QUORUM.md)
- [State availability and recovery](STATE_AVAILABILITY_AND_RECOVERY.md)
- [Confidential-state cryptographic ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md)
- [Distributed counter-authority ADR](DISTRIBUTED_COUNTER_AUTHORITY_ADR.md)
- [Endpoint-neutral access architecture](ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](BROWSER_PARTICIPANT_COMPATIBILITY.md)

## Governance

- [Agent collaboration and merge protocol](AGENT_COLLABORATION.md)
- [Repository contribution guide](../CONTRIBUTING.md)

## Current boundary

Main base `25de18d8c1af8b3dfcb5adffb1a07538afa33332` contains the governed
continuity and local resource-execution verticals. This candidate adds direct WebRTC
transport, receipt-gated placement/repair, S4 ciphertext-only 2-of-3 provider
shards, bounded proof freshness, crash-safe public-evidence journals, and B-owned
new-lease continuation after A exits. Focused Node/Chromium and packed-package gates
pass locally; exact-head CI, independent review, merge, exact-main verification,
publication, and physical independence remain HOLD.

The next P0 is lineage-bound distributed controller handoff and repair convergence.
Manual same-host ICE, local outage observation, and one-PC administration remain
explicit boundaries.
