# MortalOS Participant Core

Status: **S1 promoted; S2 durable adapter uses this unchanged authority boundary**

Contract versions:

- operation: `mortalos-participant-operation/1`
- snapshot: `mortalos-participant-snapshot/1`
- port result: `mortalos-participant-port/1`
- model: `mortalos-participant-model/1`

## Authority boundary

`lab/participant/core.mjs` is the only participant runtime allowed to:

- construct Genesis, heartbeat, state-transition, membership, or handoff candidates;
- derive signing requests;
- reserve a signer/organism/sequence/parent sign-once tuple;
- validate or append evidence;
- select or remove a recognized head;
- expose fork and catch-up results;
- project the current state and custody threshold; or
- evaluate authority and state availability.

`lab/participant/protocol-objects.mjs` is an internal construction primitive used
only by the core. Presentation and adapters cannot import it.

The browser incubator, live endpoint, durable participant, and quorum endpoint are
adapters. They may generate randomness, create non-extractable keys, request a
signature, persist bytes, transport messages, enforce expiry/consent, and map a
core snapshot to UI fields. They cannot return a validity verdict or inject a head.

## Ports

`lab/participant/contracts.mjs` defines the required bounded method surface:

| Port | Required methods | Authority excluded |
| --- | --- | --- |
| `DurableStore` | `read`, `write` | Whole-document atomicity cannot decide acceptance. |
| `KeyStore` | `create`, `describe`, `destroy`, `sign` | Cannot choose a body or claim acceptance. |
| `EvidenceStore` | `load`, `replace` | Stored head metadata is never recognition authority. |
| `StateStore` | `load`, `replace` | State bytes must still reproduce the committed root. |
| `SignOnceJournal` | `read`, `reserve`, `record`, `complete` | A reservation or stored signature does not make a candidate valid. |
| `Transport` | `receive`, `send` | Delivery order or peer verdicts do not affect validity. |

Every port result uses an exact allowlisted success/failure envelope. Stable port
failure codes distinguish unavailable capability, corrupt result, I/O failure,
timeout, and transport outage.

S1 provides the authority contract and in-memory/WebCrypto adapters. S2 implements
the crash-safe journal and atomic evidence/state transaction in
[`DURABLE_QUORUM.md`](DURABLE_QUORUM.md). Storage still cannot construct candidates,
derive signing bytes, inject a head, or turn a reservation into acceptance.

## Deterministic snapshot

The core snapshot contains only JSON-compatible public data:

- endpoint ID;
- organism ID;
- recognized head and sequence, or explicit fork/stall;
- current state root and decoded bounded state;
- custody threshold and whether the supplied public key ID is current; and
- fork points.

It never contains a `CryptoKey`, private bytes, DOM object, database handle,
transport, clock, or adapter object. Identical evidence and public capability input
produce identical snapshot bytes.

## Fail-closed behavior

The test contract keeps these outcomes distinct:

- insufficient quorum;
- duplicate signature;
- conflicting sign-once tuple;
- stale parent or visible fork;
- missing state;
- corrupt evidence;
- unavailable transport; and
- missing key authority.

Catch-up monotonically unions received Pulse records with locally recognized
evidence, then sorts and deduplicates the complete set before asking R1 to append
it. Empty, prefix, duplicate, reordered, or stale-peer responses cannot roll back
a recognized head. A completed sibling becomes a visible fork with no recognized
head, and later incomplete responses cannot hide that fork. Only replay-stale,
fork-detecting, and already-forked R1 outcomes may coexist in a valid fork
reconstruction. Corrupt, malformed, or below-quorum peer evidence aborts catch-up
before local records change, preserving the prior fork snapshot atomically. The
core does not choose a winner.

## Verification

The S1 gate is:

```text
npm run test:participant-core
npm run test:participant-core:coverage
npm run test:multi-browser
npm run verify:lab
```

The model verifier runs 10,000 seeded schedules twice in Node and once in actual
Chromium. The serialized corpus length and SHA-256 digest must be exact. Core-only
coverage is required to remain at least 95% lines, 90% branches, and 95% functions.
A static source-boundary test rejects low-level validation, protocol-object, or
signing-message imports from UI and participant adapters.

The complete repository, Chromium, transport, R1, state, relay, dependency, review,
merge, and post-merge gates still apply. Passing S1 does not itself promote S2;
passing S2 does not promote S3 recovery, S4 confidentiality, or independent failure
domains.
