# Quorum-observed liveness and repair certificates

Status: **SOURCE + LOCAL EVIDENCE PASS — EXACT-SHA PROMOTION EXTERNAL; INDEPENDENT FAILURE-DOMAIN PROMOTION HOLD**

Last synchronized: **2026-08-10 KST**

## Purpose

A possession receipt proves that one provider answered one challenge. A lineage
commit proves which custodian authorized one generation. Neither makes one
controller's private timeout a network-wide failure fact.

This layer turns provider non-response into bounded, signed evidence without a
global wall clock. It does not claim to solve asynchronous failure detection in the
absolute sense. It defines exactly which parties asserted that they observed no
response for one consumer-declared challenge window, then makes every repair verifier replay that
same transcript.

## Canonical documents

Four canonical, domain-separated documents form the contract:

1. `mortalos-placement-liveness-challenge/1` is signed by the lease consumer. It
   binds the provider and consumer identities, exact lease and workload, shard,
   confidential manifest, Continuity parent, last accepted execution receipt,
   next failure sequence, 128-bit nonce, consumer-selected bounded response window,
   and observer policy.
2. `mortalos-placement-liveness-observation/1` is signed by one rostered observer.
   It binds the exact challenge ID, observer identity, `no-response` outcome, and
   the exact challenge-declared consumer wait duration.
3. `mortalos-placement-failure-certificate/1` embeds the full challenge and a
   canonical observer-ordered threshold of valid observations. Duplicates do not
   count. `n >= 3f + 1`, `q <= n - f`, and `2q > n + f` are rechecked by every
   verifier.
4. `mortalos-placement-liveness-response/1` is signed by the challenged provider
   and binds the same challenge to a new execution receipt ID. It is only useful
   for placement eligibility after that referenced receipt is independently
   verified as the current dual-signed resource-execution chain.

The challenge contains no deadline, issue time, expiry time, UTC time, or clock
server reference. Ordering comes from the signed execution predecessor and next
sequence. Duration is a bounded observer-local claim. A signature proves who made
that claim; it cannot prove that a compromised observer's timer was honest.

## Provider consent and role boundary

The consumer may not invent a favorable observer quorum after suspecting failure.
The challenge observer roster and `n/f/q` values must be byte-equivalent, after
field-name normalization, to the `witness_policy` in the provider-signed offer that
the consumer accepted in the lease. Provider, lease consumer, and observer key
identities remain disjoint for that contract. The offer does not precommit the
challenge response window or create a provider liveness SLA; the lease consumer
selects any window inside the generated profile bound.

This closes post-failure roster selection. It does not prove that the roster's keys
belong to independent people, devices, networks, administrators, or failure
domains. That is the next root trust problem.

## Generation and repair binding

`mortalos-lineage-placement-generation/1` no longer accepts raw unavailable-provider
IDs. It embeds canonical failure certificates, liveness responses, and their
re-derived cases. Every case must bind the generation's exact Continuity parent and
manifest plus one currently verified placement's provider, lease, workload, shard,
receipt predecessor, and sequence.

A failed case derives the only unavailable-provider input used by the lower-level
placement evaluator. Its repair intent carries the failure challenge and certificate
IDs. Only after the generation is committed into Continuity may the public surface
derive that repair plan. `deriveCommittedPlacementActionPlan` returns
`mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
`verified_placement_receipt_ids`, `non_capability: true`, and
`requires_executor_reverification: true`; it is public, forgeable JSON, not a
capability or authority token.

The core API supports conditional late-proof reconciliation when a caller supplies
newly observed liveness responses and corresponding current placement evidence. A
response counts only if its receipt is present in a valid
offer/lease/usage/execution chain. A valid failure certificate plus a valid response
for the same tuple returns `E_LINEAGE_PLACEMENT_LIVENESS: late-proof-conflict`; no
repair plan is selected. Different challenges for the same predecessor
or two response receipt IDs for one challenge also halt.

No verifier can react to evidence withheld from it. Implementations must therefore
gossip provider responses and perform reconciliation at the point of repair, not
cache an old derived plan indefinitely. The current Lab/browser harness supplies
empty late-response and current-placement arrays and does not yet implement this
network gossip plus execution-time revalidation loop. A production executor must
also reverify the original Capsule, generation, commit, placement, and liveness
evidence before effects.

## Actual browser vertical

The Chromium acceptance uses no backend clock or outage oracle:

1. Consumer A creates a challenge using provider 0's signed offer witness roster and
   a consumer-selected bounded response window.
2. The exact challenge crosses direct WebRTC DataChannels to provider 0 and four
   observer identities hosted in four other browser processes.
3. Provider 0 exits. Each observer process completes the same 5,000 ms local wait.
4. Three distinct rostered observers sign `no-response`; the threshold certificate
   is embedded in A's degraded generation.
5. Only A's verified committed generation qualifies derivation of the shard repair
   plan. A then performs sign-once
   controller handoff, exits, and B repairs and commits the linked successor without
   receiving A's private key.
6. Origin, HTTP, and relay request counts stay unchanged after the cut.

## Executable evidence

| Gate | Contract |
| --- | --- |
| `node --test test/placement-liveness.test.mjs` | Exact 3-of-4 threshold, duplicate/under-threshold rejection, outsider and wait mismatch rejection, no-clock schema, late response conflict, challenge fork, response fork, accessor/Proxy/sparse-array and realm-drift rejection, exact/max+1 roster bound, and honest `clear` for absent evidence |
| `node --test test/lineage-placement.test.mjs` | Exact offer-witness-roster and lease-consumer binding; certificate-to-placement/predecessor/sequence binding; committed repair certificate IDs; stale-prior rejection; conditional late-proof conflict with supplied fresh response/current placement evidence; A-to-B handoff; fresh-process deterministic replay; four 250-event partition/heal batches; sibling-generation halt |
| `node --test test/webrtc-transport.test.mjs` | Challenge, observation, response, and certificate are bounded untrusted WebRTC artifact kinds, never transport verdicts |
| `node scripts/verify-confidential-placement-chromium.mjs` | Native 98,317-byte file, direct challenge delivery, four separate observer browser processes, actual local duration, 3-of-4 certificate, committed repair, A exit, B continuation, exact 2-of-3 recovery, zero post-cut origin/relay requests |
| `npm run test:sdk` and `node scripts/verify-sdk-package.mjs` | Authority-free public drafts, finalizers, verifiers, evaluator, and clean packed import; no signing key or network authority exported |
| `npm test` | A pre-review source baseline completed the then-current ordered suite in 4,263.6s; exact-SHA CI is the current-revision authority |

## Explicit nonclaims

- Non-response is never absolute proof of death; it is a threshold statement under
  one declared policy and local-duration assumption.
- The response window is selected by the lease consumer, not pre-agreed by the
  provider. The certificate therefore does not prove breach, lease termination,
  penalty, settlement, or a provider-fair SLA violation.
- A duration string and signatures do not prove honest timers or uncompromised
  observers.
- Key-level role separation is not Sybil resistance or physical independence.
- Same-PC browser processes are not different devices, networks, regions,
  credentials, administrators, or legal operators.
- Manual ICE exchange is not decentralized discovery or arbitrary NAT reachability.
- A certificate does not prove honest metering, economic value, or continuous
  availability after authorization.
- A derived action plan is forgeable data, not authority. The current Lab does not
  implement late-proof gossip or execution-time effect authorization.
- The current provider response signs a receipt-ID pointer, not self-contained
  possession evidence. The standalone evaluator's `alive` label is therefore not a
  possession claim; lineage acceptance separately requires the current verified
  execution chain.

## Next root P0

The next P0 is **failure-precommitted liveness policy and effect-time repair
execution**. A provider-signed, lease-bound policy must commit window/rate/path and
response-proof semantics before failure; the provider must be able to submit an
independent self-contained possession response without a fresh consumer signature;
an ID-only assertion must not become authoritative `alive`; and a dedicated
exactly-once executor must
reconcile current evidence immediately before any lease/store effect. Delayed-live
provider, true exit, and late-response races must produce respectively zero, one,
and zero repair effects in Node, packed SDK, fresh processes, and origin-cut
Chromium, including 10,000 deterministic schedules.

Immediately after that, lineage-governed admission must commit membership epochs,
overlap-safe reconfiguration, trust roots, and failure-domain weights. Self-asserted
labels count as zero independent domains. Until both gates pass, provider-fair SLA,
independent-topology, and Sybil-resistance claims remain HOLD.
