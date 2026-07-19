# MortalOS endpoint-neutral access architecture

Status: **R1 wire, deterministic state, participant storage, virtual transport, and
Cloudflare relay candidate implemented; production promotion remains exact-SHA gated**

Last synchronized: **2026-07-19 KST**

## Decision

MortalOS is not a browser-resident world. It is a protocol-defined world whose
recognized identity, state, and authority are reconstructed from canonical evidence.
Creation is a protocol operation, not a UI privilege.

The browser remains the first demonstration surface because it offers the shortest
zero-install path to see custody, state, handoff, loss, repair, and fork behavior.
Browser APIs, hosting, transport, and model output remain outside consensus validity.

## Layer boundary

```text
human or program intent
        │
        ▼
endpoint adapter and local key custody
browser | CLI | native | service | embedded
        │
        ▼
transport adapter
file | HTTP | WebSocket | future transports
        │ bounded public messages
        ▼
R1 canonical operation/result bytes
        │
        ▼
portable kernel and deterministic state engine
parse → canonicalize → authenticate → transition → recognize lineage
        │
        ▼
accepted graph/state or stable rejection
```

Only the local kernel decides whether Genesis or Pulse evidence is valid. Adapters
may create, store, request, display, and carry bytes; they cannot override signatures,
parent recognition, quorum, state roots, resource ceilings, fork handling, or first
rejection precedence.

## Participant contract

Each participant:

1. creates its own non-extractable Ed25519 key;
2. sends only public keys, canonical evidence, signatures, and routing metadata;
3. obtains custody only through accepted Genesis or membership evidence;
4. reconstructs its head and state by replay rather than a cached `accepted` flag;
5. refuses a second conflicting signature for the same parent/sequence; and
6. exposes validity, local recognition, connectivity, and mortality observation as
   different statuses.

Importing history is observation, not rebirth and not custody. A join link identifies
a bounded relay room but is not authentication. A participant becomes a custodian
only after the exact membership body, approvals, and acceptance signatures pass its
local kernel.

## Persistence profiles

Ephemeral Demo creates no durable browser state. Durable Participant requires explicit
consent and stores one structured-cloned non-extractable key, canonical public
evidence, and versioned expiry/authority metadata in IndexedDB. It never stores or
trusts a verdict, accepted context, private-key bytes, locale, or relay authority.

Restore fails closed on unknown schema, pending writes, missing evidence, key/custody
mismatch, extractable key material, invalid replay, or expiry. Authority removal
deletes the key while retaining public evidence read-only.

## Relay boundary

The Cloudflare Worker and Durable Object provide bounded room storage, presence,
HTTP catch-up, WebSocket fan-out, TTL alarms, and strict origin/schema/size limits.
Every valid room operation—including duplicate publish, range/presence reads,
presence writes, and WebSocket connect—shares one per-room admission ceiling.
Presence-only and connect-only rooms also schedule expiry alarms. They remain a
delivery optimization only.

The relay must not:

- accept private keys or browser capability objects;
- return `accepted: true`, choose a head, suppress a valid sibling, or declare death;
- make sequence arrival order authoritative; or
- turn availability or presence into custody.

Endpoints handle duplicates and out-of-order messages idempotently, buffer bounded
future records, surface sibling forks, and converge after reconnect by validating
the same canonical evidence locally. Relay loss pauses delivery; it does not weaken
validation or erase already held evidence.

## Implemented portability evidence

- R1-A has frozen bounded, versioned JavaScript operation/result records and committed
  goldens.
- R1-B independently reproduces the supported records in Python.
- R1-C makes the Lab representative paths consume public canonical wire bytes rather
  than trusted UI object graphs.
- `mortalos-state/1` produces deterministic next-state and receipt bytes in JavaScript
  and an independently written Python verifier.
- The virtual transport runs seeded duplicate, reorder, drop, partition, reconnect,
  and fork schedules in Node and Chromium.
- Actual Chromium demonstrates A→B succession in English and Korean, 20 consecutive
  handoffs across two distinct persistent user-data profiles with A's process closed
  after acceptance, plus ten isolated three-endpoint `2-of-3` loss/repair runs.

The trusted `src/` kernel contains no filesystem, process, DOM, network, ambient-clock,
or ambient-random dependency. All portable corpus results must remain byte-identical
across committed records, Node, isolated browser-target execution, and actual
Chromium for the exact reviewed head.

## Claim boundaries

- One browser holding three keys is still one physical failure domain.
- Several isolated profiles prove process/profile isolation but not separate people,
  devices, networks, or administrators.
- Non-extractable keys reduce accidental export; they do not prove erasure against a
  compromised browser or operating system.
- Silence and process exit are ambiguous. Only the bounded mortality observer may
  return `dead_under_v0_assumptions`, and only with explicit irreversibility and
  completeness assertions.
- The deterministic state canary is not a general arbitrary-code agent genome.

## Release consequence

The source sequence is now:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → Durable Object relay → two-browser succession → three-endpoint 2-of-3 repair`

The publication sequence remains:

`immutable independent review → expected-head merge → post-merge Verify → relay deploy → exact-main Pages deploy → public EN/KO multi-browser readback → Devpost reconciliation`

Reopen this architecture decision if any endpoint accepts evidence rejected by another
conforming endpoint, requires a browser-only signed value, treats relay/GPT/UI output
as authority, silently persists an ephemeral key, or converts disconnect into an
unconditional death fact.
