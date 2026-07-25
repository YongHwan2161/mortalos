# MortalOS crash-safe durable quorum

Status: **S2 implementation present; promotion is bound to the exact S2 receipt,
independent review, merge, and post-merge evidence**

Contract versions:

- durable document: `mortalos-durable-participant/2`
- authority policy: `mortalos-authority-policy/1`
- sign-once journal entry: `mortalos-sign-once-journal-entry/1`
- recoverable pending operation: `mortalos-durable-pending/1`

## Storage authority boundary

Durable storage is not a validity oracle. A restored endpoint always rebuilds a
`ParticipantCore` from canonical Genesis/Pulse evidence and verifies state
references and local key identity. `committed_head_cache` is overwritten from that
replay and is never an accepted-head input.

The versioned document contains:

- one non-extractable local `CryptoKey` handle and its public identity, or `null`
  after authority removal;
- canonical public evidence;
- the current verified state-root reference;
- append-only sign-once journal entries;
- at most one recoverable pending proposal/signature;
- a replay-derived committed-head cache;
- explicit expiry, renewal, and removal policy metadata; and
- migration provenance.

The IndexedDB and local Node test stores replace the entire document with an
expected-revision compare-and-swap. IndexedDB reads the current revision and writes
the consecutive revision inside the same strict transaction. A stale writer receives
`E_DURABLE_CONFLICT` before its signer can run. The Node adapter is a
failure-semantics test adapter, not a production Node key-custody claim. Selecting a
production Node key store requires a separate platform-security ADR.

## Write-ahead signing

For every Genesis approval, Pulse approval, or custody acceptance:

1. Participant Core validates and derives the exact signing request.
2. The adapter computes one purpose/key/organism/sequence/parent tuple.
3. The tuple, canonical body digest, message digest, and pending proposal are
   durably reserved only if the caller's expected document revision still matches.
4. Only after the reservation transaction completes may the non-extractable key
   sign.
5. The signature is durably attached to the same journal/pending record before it is
   returned.
6. Accepted evidence, state reference, journal completion, pending removal, and
   cache refresh commit in one document transaction.

A conflicting body for an existing tuple returns `E_DURABLE_EQUIVOCATION`. A crash
after reservation recovers the exact pending body. A crash after signature storage
returns the already stored signature without invoking the signer again. A crash
around commit exposes only the old committed head with pending work or the new
committed head.

Two endpoints or tabs restored from the same revision may race, but only one
reservation CAS can commit. The loser fails before invoking its signer. If two
same-body signers race after one stored reservation, only the signer whose
signature CAS commits may return to its caller.

## Recovery and policy operations

Restore rejects unknown fields or versions, missing commissioned evidence, corrupt
or extractable keys, key/public-identity mismatch, key/custody mismatch, duplicate
or partial journal records, pending/body mismatch, state-reference mismatch, and
invalid canonical evidence.

Once the explicit expiry time is observed, restore or the next signing attempt
persists `policy.status = expired` and `expired_at` through the same revision CAS.
The in-process clock observation is non-decreasing, and the persisted latch prevents
a cold restart with a rolled-back wall clock from re-enabling signing. Explicit
renewal may move an expired authority to a new future expiry; it cannot revive
removed authority. `expireAuthority()` and removal abandon incomplete journal work,
delete the key in the same transaction, and retain canonical public evidence
read-only.

IndexedDB schema `1` migrates to schema `2` only when the complete legacy key,
evidence, metadata, and empty pending marker validate. Failed migration aborts the
upgrade transaction, leaving the only version-1 copy unchanged. In particular,
`authority_removed = true` with a retained key and active authority without a key
are inconsistent snapshots and cannot migrate.

## Local adapter error vocabulary

These exceptions are not portable Genesis/Pulse rejection codes and cannot change
R1 precedence:

| Code | Condition |
|---|---|
| `E_DURABLE_SCHEMA` | Unsupported/unknown/missing document, policy, cache, or collection field. |
| `E_DURABLE_KEY` | Missing, extractable, corrupt, or identity-inconsistent key. |
| `E_DURABLE_EVIDENCE` | Missing commissioned evidence or failed Participant Core replay. |
| `E_DURABLE_STATE` | State references differ from canonical replay. |
| `E_DURABLE_JOURNAL` | Partial, duplicated, or corrupt journal/pending binding. |
| `E_DURABLE_EQUIVOCATION` | A tuple is bound to another body/message or recovered signature. |
| `E_DURABLE_PENDING` | Another exact pending operation must finish first. |
| `E_DURABLE_CONFLICT` | The expected whole-document revision is stale or non-consecutive. |
| `E_DURABLE_CUSTODY` | A commissioned active key is not current after replay. |
| `E_DURABLE_AUTHORITY` | Local authority is removed, missing, or unavailable. |
| `E_DURABLE_EXPIRED` | Reached explicit expiry blocks signing pending removal. |
| `E_DURABLE_MIGRATION` | Complete non-destructive migration is impossible. |

## Verification

```text
npm run test:durable-quorum
```

The gate covers:

- Node integration and deterministic failure injection at reservation, signature,
  commit, expiry, renewal, removal, observation, synchronization, and
  initialization write boundaries;
- deterministic two-endpoint same-revision races in Node and actual IndexedDB,
  requiring one returned signature, zero stale-writer signer calls, and one durable
  tuple/body reservation;
- exact old/pending/new crash outcomes and signer-call accounting;
- unknown/corrupt schema, key, evidence, journal, state, custody, and migration
  rejection;
- explicit renewal, expiry, and atomic authority removal;
- actual Chromium IndexedDB migration and non-destructive corrupt,
  removed-plus-key, and active-keyless migration failure;
- reached-expiry same-process and cold-restart clock rollback rejection plus
  explicit renewal;
- `100/100` Browser-B accepted-handoff process closures and cold restarts; and
- `100/100` trials for each lost A/B/C choice where the surviving durable pair
  cold-starts, commits, repairs D, and commits the next transition.

These are same-host browser/profile and storage semantics. They do not prove
separate devices, administrators, providers, confidential resource storage, or
resource-byte reconstruction. Those remain S3, S4, and S7 work.
