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

The IndexedDB and local Node test stores replace the entire document in one strict
transaction. The Node adapter is a failure-semantics test adapter, not a production
Node key-custody claim. Selecting a production Node key store requires a separate
platform-security ADR.

## Write-ahead signing

For every Genesis approval, Pulse approval, or custody acceptance:

1. Participant Core validates and derives the exact signing request.
2. The adapter computes one purpose/key/organism/sequence/parent tuple.
3. The tuple, canonical body digest, message digest, and pending proposal are
   durably reserved.
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

## Recovery and policy operations

Restore rejects unknown fields or versions, missing commissioned evidence, corrupt
or extractable keys, key/public-identity mismatch, key/custody mismatch, duplicate
or partial journal records, pending/body mismatch, state-reference mismatch, and
invalid canonical evidence.

Expiry does not silently rewrite storage during restore. Once the explicit expiry
time is reached, signing is disabled until `expireAuthority()` atomically removes
the key. Renewal is a separate versioned write and cannot revive removed authority.
Removal abandons incomplete journal work, deletes the key in the same transaction,
and retains canonical public evidence read-only.

IndexedDB schema `1` migrates to schema `2` only when the complete legacy key,
evidence, metadata, and empty pending marker validate. Failed migration aborts the
upgrade transaction, leaving the only version-1 copy unchanged.

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
  commit, renewal, removal, observation, synchronization, and initialization write
  boundaries;
- exact old/pending/new crash outcomes and signer-call accounting;
- unknown/corrupt schema, key, evidence, journal, state, custody, and migration
  rejection;
- explicit renewal, expiry, and atomic authority removal;
- actual Chromium IndexedDB migration and non-destructive migration failure;
- `100/100` Browser-B accepted-handoff process closures and cold restarts; and
- `100/100` trials for each lost A/B/C choice where the surviving durable pair
  cold-starts, commits, repairs D, and commits the next transition.

These are same-host browser/profile and storage semantics. They do not prove
separate devices, administrators, providers, confidential resource storage, or
resource-byte reconstruction. Those remain S3, S4, and S7 work.
