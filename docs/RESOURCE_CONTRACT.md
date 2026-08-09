# Signed bounded resource contract v1

Status: **Normative merged implementation; no honest-meter or independent-provider claim**

This contract is the portable control plane for a participant that contributes
finite storage, bandwidth, or compute to MortalOS. It answers six questions with
canonical signed evidence:

1. What exact capacity did a provider offer, and for what interval?
2. What bounded subset did one consumer and the provider mutually accept?
3. Which declared witness quorum made that one consumption visible to the network?
4. What cumulative usage did both parties attest?
5. Who revoked which authority, when, and with what deterministic effect?
6. Which exact leased workload did the participant execute, with what verifiable
   result and jointly signed measured usage?

It does not discover peers, schedule work, determine price, take payment, or prove
that a provider controls independent hardware. The execution layer verifies evidence
produced by a participant data plane; it does not become that data plane or a fixed
backend.

## 1. Trust and authority boundary

[`src/resource-contract.mjs`](../src/resource-contract.mjs) is portable and owns no
private key, clock, network, storage, scheduler, or server capability. Every time is
an explicit canonical decimal-string input. Callers sign the returned 32-byte
messages with endpoint-local Ed25519 authority and return tagged signatures for
assembly and verification.

[`src/resource-execution.mjs`](../src/resource-execution.mjs) has the same boundary.
It accepts signed contract bytes, explicit challenges, results, and usage receipts.
It never generates a key, reads ambient time, discovers a peer, or decides where a
job runs. Result helpers are deterministic local computations over caller-supplied
bytes.

The default SDK exports read-only verification and evaluation. The explicit
`@mortal-os/core/resource-contract` subpath additionally exports draft/finalize
functions. Neither surface accepts or returns a private key.

## 2. Generated limits

[`protocol/profile.v1.json`](../protocol/profile.v1.json) is the single source for
all contract ceilings.

| Limit | Value | Effect |
| --- | ---: | --- |
| Canonical document | 16,384 bytes | Every offer, lease, witness, receipt, and revocation rejects at max + 1. |
| Gossip announcement | 65,536 bytes | One self-contained offer + lease + witness carrier rejects at max + 1. |
| Decimal maximum | 9,223,372,036,854,775,807 | Every capacity, usage, sequence, and time is finite. |
| Offer/lease duration | 31,536,000,000 ms | A single commitment cannot exceed 365 days. |
| Observed leases per offer | 8 | A bounded witness set can expose equivocation. |
| Receipts per lease | 4,096 | Receipt-chain verification is bounded. |
| Revocations per evaluation | 32 | Revocation evaluation is bounded. |
| Announcements per evaluation | 64 | Gossip convergence cannot create unbounded verification work. |
| Witnesses per offer | 16 | A provider cannot create an unbounded witness policy. |
| Execution resource | 4,194,304 bytes | A content commitment cannot hash an unbounded resource. |
| Storage proof leaf | 4,096 bytes | Storage challenges use one fixed-size Merkle leaf profile. |
| Bandwidth/compute input | 4,096 bytes | One challenge cannot force an unbounded input transfer. |
| Compute iterations | 4,096 | One deterministic hash-chain challenge has finite work. |

All integral protocol values are strings matching `0|[1-9][0-9]*`. JavaScript
floating-point numbers, signs, leading zeroes, exponents, and values above the
profile maximum reject.

## 3. Capacity vector

Offer `capacity` and lease `allocation` use the same exact shape:

```json
{
  "bandwidth": {
    "burst_bytes": "1000",
    "egress_bytes_total": "3000000",
    "ingress_bytes_total": "2000000",
    "rate_bytes_per_second": "100000"
  },
  "compute": {
    "concurrency": "4",
    "cpu_millis_total": "500000",
    "memory_bytes": "1073741824",
    "task_millis_max": "60000"
  },
  "storage": {
    "capacity_bytes": "10485760",
    "max_object_bytes": "1048576"
  }
}
```

Each resource group is either coherently disabled with all zeroes or enabled with
positive supporting limits. `max_object_bytes` cannot exceed storage capacity. A
bandwidth allocation requires positive rate and burst limits. A compute allocation
requires positive memory, task-duration, and concurrency limits. At least one
resource group must be enabled, and every lease field must be less than or equal to
the signed offer field.

## 4. Offer

`mortalos-resource-offer/1` contains an exact body, derived `resource-offer:` ID,
and provider signature. The body binds:

- strict Ed25519 provider identity (`key_id`, `public_key`);
- a canonical 128-bit `offer_nonce`;
- inclusive `valid_from_ms` and `expires_at_ms` boundaries;
- the complete capacity vector; and
- one sorted, unique `witness_policy` containing strict Ed25519 witness identities,
  integer `max_faulty`, and integer `threshold`.

For witness count `n`, declared Byzantine bound `f`, and threshold `q`, the offer
must satisfy all of:

```text
n >= 3f + 1
q <= n - f
2q > n + f
```

The provider cannot be a witness. These inequalities make two conflicting
thresholds intersect in more than `f` witnesses while preserving quorum
availability after up to `f` unavailable witnesses. The safety statement remains
conditional on no more than the signed `f` identities being Byzantine. A key roster
does not prove separate people, devices, operators, or failure domains.

An offer is a **single-use capability** in v1. Partial allocation does not leave an
implicitly reusable remainder. A provider that wants to offer the remainder signs a
new nonce and therefore a new offer ID. This deliberately trades utilization for a
simple, auditable anti-overcommit invariant.

## 5. Mutual lease

`mortalos-resource-lease/1` binds the exact offer ID, strict consumer identity,
128-bit lease nonce, contained interval, and contained allocation. Provider and
consumer sign distinct domain-separated messages over the same derived
`resource-lease:` ID.

The consumer cannot also occupy a witness slot in that offer. Provider, consumer,
and witness roles therefore remain cryptographically and logically distinct.

Both signatures are mandatory. A provider cannot fabricate consumer liability, and
a consumer cannot claim capacity the provider did not grant. If an observation
contains two different valid leases for one offer, evaluation returns
`E_RESOURCE_EQUIVOCATION`; it never selects a winner. A duplicate lease is replay.

## 6. Network-visible sign-once consumption

`mortalos-resource-consumption-witness/1` binds one derived
`resource-consumption:` claim to the exact offer ID, lease ID, and witness key ID.
The witness signs a distinct `resource-witness:` ID under the consumption-witness
signature domain.

`prepareResourceConsumptionWitness` returns the signing message together with this
sign-once request:

```text
tuple   = "resource-consumption:" + offer_id
message = domain-separated witness message for the exact lease_id
```

The existing endpoint-local authority journal therefore permits an idempotent retry
for the same lease but rejects a second lease message for the same offer. This works
with the non-extractable browser authority and crash-safe Node authority without
passing their private key to the resource core.

`mortalos-resource-consumption-announcement/1` carries the canonical offer, lease,
and one witness envelope together. It is self-contained, bounded, and may travel via
relay control, WebRTC, file, DHT, or another untrusted transport. Transport delivery
never makes it valid; every receiver re-verifies all nested signatures and bindings.
Duplicate announcements for the same witness and lease are idempotent, which makes
gossip convergence safe.

A lease remains `unwitnessed` until distinct valid witness keys reach `q`. A minority
partition cannot activate it. A witness signature for two lease IDs under one offer
is public `witness-double-sign` equivocation evidence. Two different mutually signed
leases are provider equivocation even when their witness subsets do not overlap. The
evaluator halts and never selects a winner.

## 7. Chained usage

`mortalos-resource-usage/1` is jointly signed and carries a zero-based sequence,
strictly increasing observation time, previous receipt ID, and usage:

- storage current bytes and monotonic peak bytes;
- cumulative ingress and egress bytes;
- cumulative CPU milliseconds;
- monotonic memory, task-duration, and concurrency peaks.

The first receipt has sequence `0` and `previous_receipt_id: null`. Every later
receipt increments by exactly one and binds the exact prior `resource-usage:` ID.
Cumulative counters and peaks cannot regress or exceed the lease. Current storage
may decrease but cannot exceed its signed peak. Forked, stale, reordered, future,
or over-limit receipts reject. Evaluation reports `exhausted` when a nonzero ingress,
egress, or CPU total reaches its lease allocation.

Usage receipts require an already witnessed lease. A receipt supplied below witness
quorum rejects instead of retroactively activating private work.

## 8. Lease-bound execution evidence

`mortalos-resource-execution-challenge/1` is signed by the lease consumer. Its
canonical body binds the exact offer, lease, derived consumption ID, zero-based
sequence, prior execution-receipt ID, issue time, 128-bit nonce, resource kind, and
immutable workload. The verifier chooses the nonce; it receives no lifecycle,
scheduling, storage, or signing authority by doing so.

`mortalos-resource-execution-receipt/1` embeds that complete challenge and binds its
ID to the exact result, execution time, workload ID, usage-receipt ID, sequence, and
prior execution-receipt ID. Provider and consumer sign different role-separated
messages over the same derived `resource-execution:` ID. Consequently a provider
cannot manufacture consumer observation, a consumer cannot manufacture provider
execution, and neither can move a valid receipt to another lease.

The three v1 workload proofs are deliberately small and deterministic:

- **storage** commits up to 4 MiB as a 4,096-byte-leaf Merkle tree. The challenge
  nonce, content root, and lease ID select the leaf. The result carries that leaf
  and its sibling path; verification recomputes the exact `resource-content:` root;
- **bandwidth** carries an unpredictable bounded payload. The provider process must
  return the same digest and exact ingress/egress byte counts, while the matching
  usage receipt must advance both cumulative counters by at least that size;
- **compute** carries a bounded input and iteration count for `sha256-chain/1`.
  Every verifier independently recomputes the exact output, and the matching usage
  receipt must advance cumulative CPU measurement.

Every execution sequence has exactly one usage receipt with the same sequence and
execution time. `evaluateResourceExecutionContract` returns `proved` only when the
two chains have equal length and every challenge, result, signature, predecessor,
and usage binding verifies. A valid lease with no execution receipts is `unproved`;
an unleased offer is `not-applicable`. The original `evaluateResourceContract`
remains a control-plane evaluator and must not be used to claim delivered service.

After provider loss, receipts from the old lease cannot continue under another
provider. Reassignment requires a new provider-signed offer and mutually signed
lease. The workload ID excludes provider and lease identity, so an exact workload
can be recognized across reassignment without treating the old receipt chain as the
new provider's evidence.

## 9. Revocation

`mortalos-resource-revocation/1` binds a target kind and ID, actor key ID,
effective time, 128-bit nonce, and one reason from:

- `capacity-loss`
- `consumer-request`
- `policy-change`
- `resource-withdrawn`
- `security-incident`

Only the provider may revoke an offer. Either provider or consumer may revoke their
lease; unilateral emergency exit must not depend on the counterparty. The earliest
valid effective revocation wins. Offer revocation prevents an unleased offer or a
lease whose start is at or after the revocation. Once a lease has begun, cancelling
that lease requires a lease-targeted revocation; an offer revocation cannot silently
rewrite an already mutual contract.

## 10. Explicit-time evaluation

`evaluateResourceContract` verifies all supplied bytes before returning one state:

| State | Meaning |
| --- | --- |
| `pending` | Offer validity has not begun. |
| `available` | Offer is valid, unleased, and not effectively revoked. |
| `expired` | Unleased offer validity ended. |
| `unwitnessed` | A mutual lease exists, but fewer than its signed witness threshold are visible. |
| `scheduled` | One mutual lease exists but has not begun. |
| `active` | Lease is in its interval, not revoked, and consumable totals remain. |
| `exhausted` | A finite bandwidth or CPU total reached its signed allocation. |
| `completed` | Lease interval ended. |
| `revoked` | An applicable signed revocation is effective. |

The evaluator receives `observed_at_ms`, explicit lease evidence, and bounded
`consumption_announcements`; it never reads ambient time or network state. Invalid
input throws a stable `ResourceContractError` code rather than falling back to
availability.

## 11. Domain separation

Offer, lease, consumption, consumption-witness, usage, revocation, execution
challenge, execution receipt, workload, content leaf/node/root, storage challenge,
payload, and compute step each hash
the exact canonical body under a distinct `MORTALOS/V1/...-ID\0` domain. Provider,
consumer, and witness signatures use separate role domains. A signature from another
artifact or role cannot be replayed as authorization here.

## 12. Verification and claim boundary

The focused gate proves:

- exact canonical shapes and strict Ed25519 identity/signature binding;
- every generated ceiling and max + 1 rejection;
- interval and allocation containment;
- two-party lease and usage consent;
- receipt-chain monotonicity and stale/fork rejection;
- deterministic earliest revocation;
- single-use offer equivocation detection;
- generated Byzantine witness-policy inequalities and provider/consumer disjointness;
- minority-partition `unwitnessed`, threshold activation, duplicate-gossip
  idempotence, provider conflict, and witness double-sign rejection;
- self-contained relay-control carriage whose transport never decides validity;
- accessor, hostile Proxy, prototype, signature-substitution, and array rejection;
- Node execution, browser-target bundling, portable-source scanning, and clean
  packed-package consumption without repository-relative imports.
- actual child-provider execution of storage, bandwidth, and compute; provider PID
  termination; newly signed provider/offer/lease reassignment with the same workload
  ID; and no private material in exchanged evidence;
- one-to-one usage/execution enforcement, deterministic output, Merkle proof,
  replay/fork/cross-lease/tamper rejection, exact maxima, and max + 1 rejection.

This proves a signed logical contract plus verifiable lease-bound execution in a
local multi-process topology under the offer's declared witness-fault assumption.
It does **not** prove witness/provider identities are independently administered,
the declared fault bound is true, cumulative metering is physically honest, the
process ran on a distinct machine or region, or Sybil resistance/economic settlement.
The next architecture gate is a provider-signed lease-bound liveness policy,
independent possession response, and effect-time exactly-once repair executor.
Lineage-governed admission/failure-domain accounting with explicit trust roots
follows. Provider-neutral transport exists in the source, but self-asserted topology
labels do not establish independent domains.

## 13. Receipt-gated storage placement policy

This source revision composes the existing documents without introducing a new
signed placement verdict. `evaluateStoragePlacements` counts a placement only when:

1. the signed offer derives a distinct provider identity;
2. the exact mutual lease is active at the local observation time;
3. the declared witness threshold converges on that lease;
4. usage and execution receipts form one exact predecessor chain;
5. the last execution is `storage`; and
6. its workload ID equals the requested content commitment.

Duplicate provider identity, invalid signature, wrong workload, cross-lease
evidence, missing execution, expired/revoked/exhausted lease, or locally observed
unavailability cannot count. Meeting the recovery quorum but not the target returns
`repairing`; falling below quorum returns `unavailable`.

The confidential composition adds shard-specific workload binding and an explicit
local freshness window. Exact maximum age counts; maximum plus one millisecond is
`stale-proof`. A crash-restored journal requires an existing lease to extend the
journaled execution receipt directly before it can count again. A separately
generated successor-authorized operational signer creates new leases rather than
receiving A's private key. The operational signer is not inferred to be, or
cryptographically bound to, B's Continuity custody identity.

The lineage-placement source derives a deterministic placement action plan
from a fully reverified placement generation only after the current Continuity
descriptor commits it. `deriveCommittedPlacementActionPlan` returns
`mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
`verified_placement_receipt_ids`, `non_capability: true`, and
`requires_executor_reverification: true`. The output is public, forgeable JSON, not
authority; an executor must reverify the
original Capsule, generation, commit, and current placement/liveness evidence before
effects. Raw unavailable-provider input is rejected at this layer. One
provider counts as failed only when the provider-signed offer's witness policy signs
a predecessor/sequence-bound non-response certificate. A late provider response
must name an actual verified dual-signed execution receipt. The core conditionally
halts on conflict when a caller supplies that response and current placement
evidence; the current Lab/browser harness supplies empty late-response/current-
placement arrays and has no network gossip plus execution-time reconciliation loop.
This proves threshold key assertions, not honest
timers, Sybil resistance, honest metering, consensus, or independent failure domains. See
[P2P storage placement and repair](P2P_PLACEMENT_AND_REPAIR.md) and
[Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md),
[Lineage-bound placement convergence](LINEAGE_PLACEMENT_CONVERGENCE.md), and
[Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).
