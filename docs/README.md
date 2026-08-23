# MortalOS documentation map

Last synchronized: **2026-08-21 KST**

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
- [Lineage-governed placement admission](LINEAGE_GOVERNED_PLACEMENT_ADMISSION.md)
  — trust-root evidence, custody-approved membership epochs, deterministic logical
  operator/failure-domain rosters, compact sidecars, and physical-independence HOLD.
- [Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md)
  — provider-signed lease policy, consumer policy-bound challenge, offer-rostered observations, global-clock-free evidence, committed
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

Status: **CURRENT SOURCE/RUNTIME/TEST COMPLETE-SUITE PASS; POST-RUN DOCS STATIC
PASS; EXACT-SHA PENDING; SEPARATELY ADMINISTERED MULTI-HOST OPERATION NEXT**

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
The placement-history focused ceiling gates passed on the preceding candidate. Node
performed 128 signed
transitions with 381 genuine replacements to generation 129 and exactly 384
provider/lease/chain high-waters (`128/128/128` by shard). Mixed-runtime Chromium/Lab
performed 127 cycles from generation 2 to the same ceiling with actual browser-held
non-extractable keys. Both prove a signed generation-130 `3/3` candidate, then reject
its plus-one chain without changing the ceiling journal. The focused runtimes are
`2,841,685.4279ms` Node test-body time and `2,666,619ms` total Chromium time; the
Chromium guard is `3,300,000ms`. The historical `7,065.8s` full-suite PASS predates
that ceiling source. A later uninterrupted `8,076.826s` runtime/test/workflow PASS
now also predates the current WebRTC runtime/test/security remediation and is
historical rather than current-candidate evidence. The remediated direct and virtual
transports enforce one combined transcript of at most 512 unique canonical messages
and 8,388,608 decoded raw bytes; duplicates are free, outbound overflow precedes
native send, inbound overflow commits no transcript/dedupe entry or subscriber
delivery before fail-close cleanup clears subscriptions, and local/remote terminal
paths close native capabilities at most once.
The relay edge conservatively estimates decoded bytes from base64 and may reject
slightly earlier, so only the same upper ceiling and fail-closed result are shared.
The merged WebRTC candidate passed focused Node `24/24` in `31,241ms` and actual
Chromium in `50,086ms`. On that merged base, a hidden-wrapper full `npm test` ran from
`2026-08-11T06:42:38.6738575+09:00` through
`2026-08-11T09:06:30.4636057+09:00`, exited `0` in `8,631,790ms`
(`143m 51.790s`), and reached final `verify:s4`. Its source/runtime/test/workflow
files remained unchanged after the run and the related-workload inventory was zero
after excluding the probe itself. The lease-bound liveness-policy delta now passes
uninterrupted `npm test` in `7,476,222ms` through final `verify:s4`. The subsequent
membership-bound observer-attestation/view source also reaches final `verify:s4` in
a fresh ordered complete suite; post-run docs pass separate static gates. Exact-SHA
evidence remains external. Three persistent Chromium pages
hold non-extractable provider keys and
produce storage results/signatures while Node orchestrates the portable journal;
neither independent in-browser journal-kernel parity nor independent failure domains
are claimed.
Governance and deployment are exact-SHA external facts read from
the PR, required checks, merge record, post-merge workflows, and deployed manifest;
this document does not self-promote its containing revision. Physical independence
remains HOLD.

This worktree additionally removes raw unavailability from lineage generation:
offer-rostered 3-of-4 observer certificates bind exact predecessor/sequence and
  provider-signed exact local duration without a global clock. The core conditionally halts a derived plan
when supplied a late verified sampled response and current placement evidence; the
one-shard Lab executor reconciles supplied evidence at effect execution but does not
gossip or schedule multiple actions. Derived plans are
forgeable data, so executors must reverify the original signed and committed inputs.
The policy/window, provider-only sampled response `/2`, one-shard effect/completion,
provider-domain sequential restart recovery, and internal multi-action fresh-evidence
batch slices are implemented. No-replace claims now exclude cross-process first
provider and Continuity execution. An unresolved claim can be completed only by an
already-authoritative signed placement or verified successor Capsule/commit, checked
by the outer executor before a capability with no provider/signing method imports the
exact result. Invalid or absent proof remains fail-closed; there is no timeout,
takeover, or proof discovery. The origin-cut Chromium Lab now feeds that range adapter
from an actual DataChannel and proves late-response/disconnect zero-call behavior. The
bounded `10,000`-seed schedule corpus is now byte-identical across Node, a fresh
process, and bundled Chromium. Custody-signed membership epochs now bind explicit
trust roots, subject+issuer dual-signed challenge evidence, operator roots, logical
failure domains, validity, direct rotation/revocation, cumulative root/key history,
and lineage history; compact admitted policy `/2` references that sidecar
without crossing transport ceilings. A bounded process ceremony now locks separate
issuer/subject key services to one exact root and policy, with no coordinator private
capability and sign-once challenge slots. Optional local authority custody preserves
the identity and tuple across process races/restart. A private-key-free Node runner
binds both declared endpoint origins/key IDs explicitly into challenge `/2` under the
generated 512-byte ceiling and emits an offline token-free replay bundle. Each
operator-facing signer locks its own advertised origin before private-key use and
reproduces the same bundle after restart. The signer can terminate native TLS from
bounded administrator-local certificate/private-key files; malformed pairs reject
before absent authority creation, and readiness reports the transport mode without
secrets. Native mode additionally separates a possession-only token from the admission
bearer. The focused `/2` path requires each role key to sign its exact observer challenge
and same-connection TLS exporter digest, so a copied identity or captured proof fails on
a replacement TLS connection. A fresh-process observer records that proof plus peer
certificate/public-key/exporter and socket-address facts in a no-replace artifact whose
independence verdicts are fixed to `unproven`; explicit identity-only `/1` remains only
for legacy proxy compatibility, and both fixtures still share one PC/address. This is logical policy and
same-PC process diversity only. The next P0 is operating that
exact signer/coordinator contract under separately administered
credentials plus measured multi-host topology. Absolute
Sybil resistance cannot be inferred from self-created keys; manual same-host ICE and
one-PC administration remain explicit boundaries.

The deployment evidence path now also has a content-addressed non-authoritative plan,
roster-signed acceptance/activation `/1`, custody-epoch membership binding `/2`, observer
wrapper `/5`, and combined observe-
then-attest CLI. The plan fixes one ceremony, bounded logical window/timeout, complete
observer roster, and unique nonce plus declared administration/failure-domain/vantage
digests per key before observation. Every key uses a ceremony-scoped durable sign-once
slot to accept exactly one plan; the complete sorted set activates it. The membership
binding `/2` accepts only a complete fork-free supplied epoch-candidate chain converging
at the current Capsule, exact ceremony subject evidence, and the selected epoch's entire
2–8 observer membership with matching distinct operator/failure-domain IDs. Each
attestation binds that artifact, candidate-view commitment, and observation through one
plan-scoped durable sign-once slot. The combined CLI journals the exact token-free
TLS-exporter observation no-replace before signer use, so an exact retry is idempotent
without reconnecting; a different connection, view, observation, or instant under the
same plan halts. Since acceptance is ceremony-scoped,
epoch rotation requires a fresh ceremony and accepted plan. Deterministic comparison
rejects post-hoc epoch, membership, plan, activation, observer, nonce, window,
observation, or vantage substitution. Attestation-view manifest `/1` records only the
compact all-roster IDs and derived summary; restore is self-hash-only, while explicit
verification reruns every exact attestation sidecar. No-replace create and read-only
verify CLIs support fresh-process replay without nesting signatures. This is configured-policy roster admission, not
issuer-honesty, clock, Sybil, or independent-topology authority; current tests still use
local authority files and one loopback machine.
