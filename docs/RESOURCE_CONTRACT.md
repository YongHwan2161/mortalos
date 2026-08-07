# Signed bounded resource contract v1

Status: **Normative implementation candidate; no independent-provider claim**

This contract is the portable control plane for a participant that contributes
finite storage, bandwidth, or compute to MortalOS. It answers five questions with
canonical signed evidence:

1. What exact capacity did a provider offer, and for what interval?
2. What bounded subset did one consumer and the provider mutually accept?
3. Which declared witness quorum made that one consumption visible to the network?
4. What cumulative usage did both parties attest?
5. Who revoked which authority, when, and with what deterministic effect?

It does not discover peers, move bytes, execute jobs, determine price, take payment,
or prove that a provider controls real hardware. Those are separate data-plane,
scheduling, settlement, and topology claims.

## 1. Trust and authority boundary

[`src/resource-contract.mjs`](../src/resource-contract.mjs) is portable and owns no
private key, clock, network, storage, scheduler, or server capability. Every time is
an explicit canonical decimal-string input. Callers sign the returned 32-byte
messages with endpoint-local Ed25519 authority and return tagged signatures for
assembly and verification.

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

## 8. Revocation

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

## 9. Explicit-time evaluation

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

## 10. Domain separation

Offer, lease, consumption, consumption-witness, usage, and revocation IDs each hash
the exact canonical body under a distinct `MORTALOS/V1/...-ID\0` domain. Provider,
consumer, and witness signatures use separate role domains. A signature from another
artifact or role cannot be replayed as authorization here.

## 11. Verification and claim boundary

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

This proves a signed logical contract and accountable network-visible consumption
under the offer's declared witness-fault assumption. It does **not** prove the
witness identities are independent, the declared fault bound is true, metering is
honest, resources exist, work was delivered, or Sybil resistance/economic settlement.
The next architecture gate must bind the witnessed lease to data-plane execution
receipts produced by independently observable participant runtimes.
