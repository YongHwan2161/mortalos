# MortalOS documentation map

Last synchronized: **2026-08-10 KST**

## Read first

- [North Star implementation SSOT](IMPLEMENTATION_PLAN.md) — current direction,
  evidence layers, priority order, and strict completion gates.
- [Current claim matrix](CLAIM_MATRIX.md) — what is implemented, verified,
  promoted, and explicitly unclaimed.
- [P2P storage placement and repair](P2P_PLACEMENT_AND_REPAIR.md) — source
  contract, executable local gates, and nonclaims.
- [Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md)
  — ciphertext shards, journal-v2 reproof epochs and cumulative receipt high-waters,
  local crash recovery, and custody succession.
- [Lineage-bound placement convergence](LINEAGE_PLACEMENT_CONVERGENCE.md) — current-
  descriptor generation commit, derived placement action plan, deterministic
  convergence, and fork halt.
- [Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md)
  — offer-rostered observations, consumer-selected bounded window, global-clock-free evidence, committed
  repair-plan derivation, conditional late-proof conflict, and the next
  membership-truth gap.

These current files answer “where are we now?” Completed contest-era evidence and UX
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

Historical integration base `25de18d8c1af8b3dfcb5adffb1a07538afa33332` already contained the governed
continuity and local resource-execution verticals. This revision adds direct WebRTC
transport, receipt-gated placement/repair, S4 ciphertext-only 2-of-3 provider
shards, bounded proof freshness, and journal v2. Each reproof context binds the exact
prior head, next generation, manifest/policy, and epoch; each challenge nonce binds
that context plus its receipt-chain predecessor. Durable commit rederives a branded
active `3/3` set from raw signed evidence, retains cumulative per-chain high-waters,
and claims one successor per prior through a no-replace hard link. V1 is metadata-only
migration input and requires a fresh rotated-epoch `3/3` reproof. The format and
adapter are bounded and fail closed at their generated caps. They remain unsigned
local evidence, not hostile-disk protection, hidden-history detection, or global
consensus. The same revision adds successor-authorized new-lease continuation after
A exits. The operational signer is not inferred to be B's Continuity custody
identity. It also binds
placement generations to Continuity, gates derived placement action plans on a
current-descriptor commit, requires every supplied authenticated Capsule tip to be
represented by the convergence chain, and halts incomplete or sibling forks.
Focused Node/Chromium, fresh-process, security, packed-package, and final
ordered `npm test` (4,263.6s on the pre-review liveness-hardened source) gates
passed locally. Governance and deployment are exact-SHA external facts read from
the PR, required checks, merge record, post-merge workflows, and deployed manifest;
this document does not self-promote its containing revision. Physical independence
remains HOLD.

This worktree additionally removes raw unavailability from lineage generation:
offer-rostered 3-of-4 observer certificates bind exact predecessor/sequence and
local duration without a global clock. The core conditionally halts a derived plan
when supplied a late verified proof and current placement evidence; the current Lab
does not gossip or reconcile that evidence at effect execution. Derived plans are
forgeable data, so executors must reverify the original signed and committed inputs.
The next P0 is failure-precommitted liveness policy plus independent provider
response and effect-time exactly-once repair reconciliation. Lineage-governed
admission/failure-domain accounting with explicit trust roots follows. Absolute
Sybil resistance cannot be inferred from self-created keys; manual same-host ICE and
one-PC administration remain explicit boundaries.
