# Signed bounded resource contract v1

Status: **Normative implementation candidate; no independent-provider claim**

This contract is the portable control plane for a participant that contributes
finite storage, bandwidth, or compute to MortalOS. It answers four questions with
canonical signed evidence:

1. What exact capacity did a provider offer, and for what interval?
2. What bounded subset did one consumer and the provider mutually accept?
3. What cumulative usage did both parties attest?
4. Who revoked which authority, when, and with what deterministic effect?

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
| Canonical document | 16,384 bytes | Every offer, lease, receipt, and revocation rejects at max + 1. |
| Decimal maximum | 9,223,372,036,854,775,807 | Every capacity, usage, sequence, and time is finite. |
| Offer/lease duration | 31,536,000,000 ms | A single commitment cannot exceed 365 days. |
| Observed leases per offer | 8 | A bounded witness set can expose equivocation. |
| Receipts per lease | 4,096 | Receipt-chain verification is bounded. |
| Revocations per evaluation | 32 | Revocation evaluation is bounded. |

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
- the complete capacity vector.

An offer is a **single-use capability** in v1. Partial allocation does not leave an
implicitly reusable remainder. A provider that wants to offer the remainder signs a
new nonce and therefore a new offer ID. This deliberately trades utilization for a
simple, auditable anti-overcommit invariant.

## 5. Mutual lease

`mortalos-resource-lease/1` binds the exact offer ID, strict consumer identity,
128-bit lease nonce, contained interval, and contained allocation. Provider and
consumer sign distinct domain-separated messages over the same derived
`resource-lease:` ID.

Both signatures are mandatory. A provider cannot fabricate consumer liability, and
a consumer cannot claim capacity the provider did not grant. If an observation
contains two different valid leases for one offer, evaluation returns
`E_RESOURCE_EQUIVOCATION`; it never selects a winner. A duplicate lease is replay.

## 6. Chained usage

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

## 7. Revocation

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

## 8. Explicit-time evaluation

`evaluateResourceContract` verifies all supplied bytes before returning one state:

| State | Meaning |
| --- | --- |
| `pending` | Offer validity has not begun. |
| `available` | Offer is valid, unleased, and not effectively revoked. |
| `expired` | Unleased offer validity ended. |
| `scheduled` | One mutual lease exists but has not begun. |
| `active` | Lease is in its interval, not revoked, and consumable totals remain. |
| `exhausted` | A finite bandwidth or CPU total reached its signed allocation. |
| `completed` | Lease interval ended. |
| `revoked` | An applicable signed revocation is effective. |

The evaluator receives `observed_at_ms`; it never reads ambient time. Invalid input
throws a stable `ResourceContractError` code rather than falling back to availability.

## 9. Domain separation

Offer, lease, usage, and revocation IDs each hash the exact canonical body under a
distinct `MORTALOS/V1/...-ID\0` domain. Provider and consumer signatures use
separate role domains. A signature from another artifact or role cannot be replayed
as authorization here.

## 10. Verification and claim boundary

The focused gate proves:

- exact canonical shapes and strict Ed25519 identity/signature binding;
- every generated ceiling and max + 1 rejection;
- interval and allocation containment;
- two-party lease and usage consent;
- receipt-chain monotonicity and stale/fork rejection;
- deterministic earliest revocation;
- single-use offer equivocation detection;
- accessor, hostile Proxy, prototype, signature-substitution, and array rejection;
- Node execution, browser-target bundling, portable-source scanning, and clean
  packed-package consumption without repository-relative imports.

This proves a signed logical contract only. It does **not** prove truthful metering,
resource possession, service delivery, Sybil resistance, economic settlement,
independent failure domains, or continued reachability. The next architecture gate
must bind a lease to data-plane execution receipts produced by independently
observable participant runtimes.
