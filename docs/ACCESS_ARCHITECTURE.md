# MortalOS endpoint-neutral access architecture

Status: **PORTABLE CORE PROMOTED; CURRENT RUNTIME/TEST/WORKFLOW FULL SUITE PASS; CURRENT DOCS SPEC/LINK/DIFF PASS; EXACT-SHA EXTERNAL**

Last synchronized: **2026-08-11 KST**

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
file | direct WebRTC | HTTP | WebSocket | future transports
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
consent and stores one atomic schema-v2 document containing a structured-cloned
non-extractable key, canonical public evidence, verified state references,
write-ahead sign-once journal, recoverable pending operation, and explicit
expiry/removal/migration metadata. It never stores or trusts a verdict, accepted
context, private-key bytes, locale, or relay authority. Every replacement compares
the caller's expected revision and writes the next consecutive revision in the same
strict transaction; a stale tab fails before signer invocation.

Restore fails closed on unknown schema, partial journal, missing commissioned
evidence, key/custody mismatch, extractable key material, state mismatch, or invalid
replay. Valid pending work is recovered. Successful legacy migration atomically
writes the v2 document and removes all legacy stores; failed migration rolls back
the whole version change. Reaching expiry disables signing until an expired-policy
latch is durably committed. Clock rollback cannot clear the latch; explicit
versioned renewal must set a non-null expiry strictly beyond the persisted
observation high-water mark. Null, stale, and equal renewals fail closed and retain
the expired state, while explicit removal deletes the only key and retains public
evidence read-only.

## Relay boundary

The Cloudflare Worker and Durable Object provide bounded room storage, presence,
HTTP catch-up, WebSocket fan-out, TTL alarms, and strict origin/schema/size limits.
Every valid room operation—including duplicate publish, range/presence reads,
presence writes, and WebSocket connect—shares one per-room admission ceiling.
The Worker, browser transport, and local acceptance server import one policy: two
active endpoints consume at most 204 scheduled operations/minute, or 252 with the
explicit 48-operation interaction burst, below the 300/min room ceiling. A real
two-profile Chromium gate also measures a 12-second active window; the remediated
source-revision run recorded 39 operations and no local `429`.
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

## Direct peer boundary

This source revision adds canonical manual WebRTC signaling and one ordered binary
DataChannel with `iceServers: []`. It carries the same bounded relay messages, chunk
fragments, and untrusted placement-artifact wrappers. After the source bundle is
loaded, the Chromium vertical denies origin and relay requests before transferring
the runtime file or resource-contract evidence.

Direct connection is not authority. Endpoints re-parse nested canonical bytes and
count a placement only after exact resource-execution verification. Manual same-host
ICE is a deterministic baseline, not arbitrary Internet/NAT proof. Replaceable
signaling, STUN, TURN, and relay adapters may be added without entering validity.
Outbound publication commits local range and duplicate state only after the
DataChannel accepts the send. A synchronous close, backpressure, or send failure
cannot manufacture local delivery, and an identical transient-failure retry remains
eligible for a real send. One private transcript map is the cursor and duplicate
SSOT; collection, iterator, scheduler, DataChannel, MessageEvent, and peer-connection
operations are captured before exposure. Relay artifact-kind membership uses the
captured Set operation as a separate transitive boundary. Named Node and actual
Chromium cases require selective `verdict` membership poison to produce zero send,
local range, remote range, or subscriber visibility while an allowed
`challenge` still reaches both peers at sequence 1. Browser acceptance into its send queue is
still not an end-to-end acknowledgement; signed higher-layer evidence remains the
only placement authority.

The one private transcript is also the shared resource-accounting boundary for both
directions: at most 512 unique canonical messages and 8,388,608 decoded raw bytes.
Duplicates are non-consuming. Outbound capacity is checked before native send and
state is committed only after send succeeds. Inbound overflow commits no transcript
or dedupe entry and schedules no subscriber delivery before fail-close; terminal
cleanup then clears subscriptions. The virtual transport applies the
same exact decoded-byte ceiling. The relay edge's base64 estimate may overcount
slightly, so it shares only the upper ceiling and fail-closed guarantee, not byte-
identical accounting. Local close, remote channel close, peer close, and error share
one idempotent teardown path; each native close capability runs at most once, and a
remote channel close closes a still-live peer instead of stranding it.

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
- The S2 actual-Chromium gate persists each endpoint in a separate IndexedDB,
  closes the browser process, and passes `100/100` B handoff recoveries plus
  `100/100` cold pair recovery/transition/D-repair/next-transition trials for each
  lost A, B, and C. This is same-host profile evidence, not S7 failure-domain proof.
- The P2P source vertical transfers one actual file and complete signed placement evidence
  to three provider Chromium processes after the HTTP cut, terminates one provider,
  repairs through D under a new lease, terminates consumer A, and lets B recover two
  exact of three readbacks with one corrupt copy rejected.
- The confidential composition encrypts another actual native File for B, transfers
  only three distinct S4 package shards to providers, excludes max-age + 1 receipts,
  restores a public-evidence journal fail-closed, terminates A, and lets B renew
  placement with a separately generated successor-authorized operational signer
  before exact 2-of-3 decrypt. That signer is not inferred to be, or
  cryptographically bound to, B's Continuity custody identity. Pages, origin, relay,
  and domain remain absent from the validity path.
- Literal generated-boundary regressions cover exact 512 and message 513, exact
8,388,608 raw bytes and byte 8,388,609, duplicate non-consumption, no overflow-frame
commit or delivery before cleanup, and at-most-once native close capability use. The current candidate passes
  focused Node `24/24` in `31,241ms` and the actual Chromium probe in `50,086ms`.
  The prior `8,076.826s` runtime/test/workflow full-suite PASS predates the current
  WebRTC remediation. The frozen runtime/test/workflow candidate passes the fresh
  `8,631,790ms` suite through final `verify:s4`, its covered files stayed unchanged,
  and docs pass separate spec/link/diff. Exact-SHA governance remains external.

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
- `deriveCommittedPlacementActionPlan` (Lab:
  `derivePlacementActionPlan`) returns
  `mortalos-lineage-placement-action-plan/1` with
  `planned_repair_actions`, `verified_placement_receipt_ids`,
  `non_capability: true`, and `requires_executor_reverification: true`. It is public,
  forgeable JSON, not authority. An effect executor must reverify the original
  Capsule, generation, commit, and current placement/liveness evidence.
- The core can reject a late-proof conflict when supplied fresh response and current
  placement evidence. The Lab/browser harness currently supplies empty late-response
  arrays and does not implement a network gossip plus execution-time reconciliation
  loop.
- Operational lease signers are separately authorized test identities; no source
  rule cryptographically binds them to a successor's Continuity custody identity.
- Provider/observer keys and labels do not prove independent devices, accounts,
  regions, networks, credentials, or administrators without explicit trust roots.

## Release consequence

The governed total gate order remains:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → Durable Object relay → two-browser succession → three-endpoint 2-of-3 repair`

This source revision extends that foundation through:

`portable kernel → S4 ciphertext shards → signed bounded lease → direct peer transfer → fresh receipt-gated placement → crash recovery → successor-authorized operational repair → peer recovery`

The publication sequence remains a gate contract, not a statement that the
containing revision has passed it:

`immutable independent review → expected-head merge → post-merge Verify → exact-main deploy → public EN/KO multi-browser readback`

Reopen this architecture decision if any endpoint accepts evidence rejected by another
conforming endpoint, requires a browser-only signed value, treats relay/GPT/UI output
as authority, silently persists an ephemeral key, or converts disconnect into an
unconditional death fact.

The next root P0 is a provider-signed lease-bound liveness policy plus independent
provider possession response and an effect-time exactly-once repair executor.
Lineage-governed admission and
failure-domain accounting with explicit trust roots follows; self-asserted metadata
must not manufacture quorum diversity.
