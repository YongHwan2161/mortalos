# Provider-signed possession and S7/S8 topology

Status: **IMPLEMENTED CANDIDATE / EXTERNAL MULTI-ACCOUNT TOPOLOGY HOLD**

Last synchronized: **2026-08-04 KST**

## Decision

A custodian signature proves that a particular continuity copy is authorized. It
does not prove that a storage provider possesses the bytes. MortalOS therefore uses
an additional `mortalos-provider-possession-receipt/1` signed by the provider only
after the provider has durably written and read back the exact object.

The receipt binds all of the following in canonical bytes:

- provider public key and declared account, administrator, credential, region, and
  failure domains;
- Capsule ID, organism ID, accepted head, copy ID, and logical provider ID;
- exact object SHA-256 digest, byte length, and storage time.

Recovery accepts two of three copies only after it verifies the provider signature,
the topology-pinned provider identity, the fetched object digest and size, the
current-custodian copy signature, and the common Capsule lineage. A repeated copy,
provider identity, substituted receipt, changed object, valid divergent Capsule, or
single survivor fails closed.

## Capability boundary

`registerCustodyProviderCapability` snapshots the provider identity and exact
`store`/`read` functions into module-private `WeakMap` state. Public facade methods
are not called after registration. Both provider store and recovery entrypoints own
all caller arrays, receipt bytes, copy bytes, topology values, and registered
capabilities before their first `await`; the static security-boundary verifier pins
the helper bodies, module digest, and first-suspension preludes.

The default `@mortal-os/core` export remains authority-free. Provider capabilities
are exposed only from the explicit `@mortal-os/core/continuity` subpath.

## Runtime implementations

- The Node HTTP provider stores an object under a content digest, performs atomic
  replacement and exact readback, and signs with its own Ed25519 seed. The verifier
  terminates a real provider process, recovers from the other two, removes the lost
  provider's object, restarts and repairs it, then terminates a second provider and
  recovers again.
- `ProviderVault` is a private-service Cloudflare Durable Object. It keeps its random
  signing seed and immutable provider identity in private Durable Object storage,
  stores bounded objects as SQLite chunks, verifies readback before signing, and has
  no public HTTP storage route. The workerd gate evicts instances, exercises SQLite
  persistence, tolerates one unavailable vault, and rejects identity mutation and
  chunk corruption.

## Evidence levels

| Level | Required evidence | Current state |
| --- | --- | --- |
| Logical | Three unique copy/provider identities and 2-of-3 signed copy quorum | PASS |
| Process | Three OS processes with separate credentials, stores, keys, and actual process termination/restart | PASS |
| Provider runtime | Durable Object SQLite persistence, eviction, corruption rejection, and deploy bundle dry run | PASS |
| External S7/S8 | Three independently controlled provider accounts, regions, credentials, administrators, and failure domains; live provider outage and repair | **HOLD** |

The eight topology fields are signed declarations. Cryptography prevents later
substitution; it cannot prove that the named account, region, administrator, or
credential is genuinely independent. Same-host processes and three Durable Objects
in one account must never be reported as external S7/S8 independence.

## External promotion gate

External S7/S8 passes only when an out-of-band verifier receives three provider
configuration receipts from separately controlled accounts and confirms:

1. unique provider account and credential principals, with no shared bypass role;
2. independently assigned administrators and recovery channels;
3. region/jurisdiction placement from provider control-plane evidence rather than a
   best-effort location hint;
4. provider-signed write/readback receipts for the same current Capsule;
5. a real control-plane outage or credential revocation for provider 1 while 2 and 3
   recover exact bytes and endpoint B commits the next transition;
6. verified repair of provider 1, followed by the equivalent failure of provider 2;
7. 100 randomized failure trials, no false quorum, and a seven-day burn-in bound to
   one immutable release SHA.

Until those receipts exist, the correct result is **implementation PASS / external
topology HOLD**.

## Focused verification

```bash
npm run test:provider-possession
npm run verify:independent-provider-topology
npm run test:provider-runtime
npm run verify:security-boundaries
npm run verify:sdk-package
```
