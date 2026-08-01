# Distributed counter authority ADR

Status: **PROCESS-ISOLATED IMPLEMENTATION PASS / PRODUCTION TOPOLOGY HOLD**

## Decision

MortalOS keeps the S4 epoch-wide counter contract and replaces its single durable
store with a majority-committed replicated log. Three or five replicas use distinct
failure domains. A reservation becomes usable only after compare-and-swap succeeds
on a majority at the same prior revision. Minority writes are never returned and are
repaired from the next majority read.

This preserves the promoted S4 receipt and IV format while removing one browser
profile as the counter-state source of truth. It does not claim Byzantine safety:
the epoch authority signing key remains trusted, and a compromised authority may
still equivocate. Loss of that credential requires the existing quorum-authorized
epoch rotation.

## Rejected alternatives

- Replicating one mutable store object or one credential under several URLs does not
  create independent failure domains.
- Last-write-wins replication can release overlapping intervals after a partition.
- Per-writer IV lanes would remove the coordinator, but require a new cryptographic
  suite, new IV/AAD formats, migration, and fresh S4 vectors. It remains the preferred
  S4-v2 research direction, not a silent change to suite 1.

## Safety and liveness contract

- Any two majorities intersect; a replica accepts only one successor revision.
- A caller receives a receipt only after majority commit.
- A one-replica partition cannot allocate.
- One lost replica leaves a 2-of-3 authority live; restoration repairs the outlier.
- No test or topology manifest may call same-host processes independent providers.
- Production S7 remains HOLD until the topology receipt proves distinct host,
  provider, administrator, and credential domains and passes the live failure matrix.

## Verification gate

`test/distributed-counter.test.mjs` runs concurrent-coordinator, partition, repair,
and restart schedules with zero overlapping returned intervals and rejects reused
failure domains. `scripts/verify-independent-counter-topology.mjs` starts three
separate HTTP replica processes, persists each replica to a separate disk file,
terminates one process, continues on quorum, restarts it, and verifies quorum repair.

That script proves a network/process failure boundary only. Its local node/provider
labels are test metadata, not production independence. Production promotion still
requires three externally administered hosts/providers/credentials, 100 live trials,
and the seven-day burn-in receipt.
