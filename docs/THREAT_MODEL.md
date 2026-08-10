# MortalOS v0/v1 Threat Model

Current source note (2026-08-10): the hardened S2/S4 source merged through PR #51,
while the revised S2/S4 stage claims remain reopened pending new exact-SHA receipts.
A branded
outer authority is insufficient when the store or method behind it is mutable.
Security-sensitive async entrypoints must capture complete transitive invocation
data and module-private capabilities before the first await, and authority-changing
commits require exact readback. The AST-based suspension audit rejects
marker-shaped comments/strings, same-expression comma and conditional escapes,
template interpolation, repeating-loop reads, deferred closures, and ordinary
borrowed-identifier reads after suspension. Historical receipts do not cover the
revised claims. This rolling document cannot promote its containing revision;
immutable receipt, review, CI, merge, and deployment records carry that decision.

Status: **Normative for v0 and the Minimum Viable Life claim**  
Protocol: `mortalos/0`, state extension `mortalos/1`

## 1. Security objective

MortalOS v0 protects one narrow claim:

> Within the declared assumptions, every successor requires the current descriptor's logical key quorum; safe custodian replacement can preserve identity; and after continuation authority is irreversibly lost, public historical data alone cannot continue the same lineage. No-unilateral-domain control is an additional deployment property, not a fact inferred from key IDs.

The system does not claim that all data copies can be deleted, that death can always be observed globally, or that v0 tolerates malicious custodians.

## 2. Protected assets

| Asset | Required property |
|---|---|
| Organism identity | Derived only from the canonical valid Genesis body and immutable within a lineage. |
| Lineage integrity | Every accepted Pulse has one accepted parent and obeys deterministic transition rules. |
| Continuity authority | The current descriptor's quorum is required to advance; no single custodian key can advance when its threshold is greater than one. No-individual or no-domain control requires separate deployment evidence. |
| Custody membership | Changes only through a Pulse authorized by the current custody descriptor, accepted by new custodians, and evidenced strongly enough to activate the next quorum. |
| State continuity | v0 authenticates one immutable opaque root. v1 signs exact initial artifacts and accepts a changed root only when the bounded Pulse Seed v1 engine reproduces the exact next state and receipt. Availability remains observer-relative. |
| Declared genome-hash continuity | v0 authenticates and preserves the opaque declared `genome_hash`; it does not receive artifact bytes or derive or verify their hash. An observer may independently bind an externally obtained artifact to the declaration. |
| Private signing keys | Never intentionally serialized, logged, committed, or sent over the network. |
| Mortality semantics | Loss of succession authority is not confused with deletion of all historical bytes, temporary state loss, or an incomplete pending-evidence observation. |
| Validator independence | Endpoint type, transport, UI, GPT, and signaling cannot alter validity rules. |
| Failure-domain honesty | Distinct key IDs are never presented as proof of independent people, browsers, devices, or operators. |
| Input consistency | A validation decision uses owned snapshots, not caller-controlled bytes that may change between checks. |

## 3. Trust boundaries

### 3.1 Trusted computing base for v0

The following are trusted for the v0 claim:

- the deterministic protocol validator implementation;
- the deterministic Participant Core for candidate construction, signing requests,
  sign-once reservation, append/head recognition, catch-up, fork projection, and
  public participant snapshots;
- the accepted-object graph and its non-forgeable validation-capability boundary;
- standards-conforming SHA-256 and Ed25519 implementations;
- correct RFC 8785 canonicalization;
- the creating endpoint's cryptographically secure random-number generator;
- the mortality observer adapter, which must produce honest Proxy-free inert own-data containers and truthful observation-policy assertions;
- the assumption that honest custodians obey sign-once, retain no hidden pending approvals, and delete volatile keys when the controlled test requires it.

The stronger no-single-domain-control claim additionally requires deployment evidence that no one physical or administrative failure domain holds `threshold` current keys. That condition is absent in both a `1-of-1` singleton and a sole-browser `2-of-3` incubator.

Compromise of these components may invalidate the v0 claim.

### 3.2 Untrusted components

The following MUST be treated as untrusted inputs:

- WebRTC, BroadcastChannel, WebSocket, or other transport;
- signaling, rendezvous, STUN, and TURN infrastructure;
- message order, timing, duplication, and delivery;
- UI, CLI presentation, and browser DOM state;
- GPT-5.6 and every other model output;
- user-entered text and imported files;
- event-payload sidecars, until canonical bytes and their domain-separated commitment are verified;
- mutable, subclassed, proxied, or SharedArrayBuffer-backed byte views;
- remote peer capability claims;
- public snapshots and historical messages; and
- deserialized, cloned, or hand-built objects that claim to be accepted or latent evidence.

Untrusted components may transport or propose protocol objects but cannot make them valid.

## 4. Actors

The foundational model treats custodians as **honest but fallible**: they follow the protocol and sign-once rule, but may crash, disconnect, or lose volatile state without warning.

| Actor | v0 behavior |
|---|---|
| Honest custodian | Follows protocol, signs at most one child per parent, may crash or disconnect at any time. |
| Honest non-custodian peer | Relays or observes messages but has no continuity authority. |
| External sender | May send malformed, stale, duplicated, or forged messages. |
| Signaling operator | May observe or disrupt connection setup but has no state authority. |
| GPT control layer | Produces untrusted proposals and explanations only. |
| Observer | Maintains a local view that may be incomplete or partitioned. |
| Singleton creator | Controls one `1-of-1` key and therefore has unilateral authority until handoff. |
| Incubator operator | May control three logical keys in one volatile browser and satisfy `2-of-3`; receives no independent-host guarantee before handoff. |

## 5. Failures included in v0

The implementation and tests MUST cover:

- crash-stop failure at any protocol boundary;
- voluntary peer departure;
- endpoint stop, including browser tab close/reload, CLI exit, service crash, or device loss;
- loss of volatile local key material;
- temporary disconnect and reconnect;
- arbitrary message delay;
- message loss;
- message duplication;
- message reordering;
- stale message replay;
- fabricated accepted-parent or latent-successor context;
- network partition and healing;
- concurrent honest proposals;
- malformed JSON and schema violations;
- oversized or excessively nested JSON input;
- overrideable byte metadata, SharedArrayBuffer mutation, and time-of-check/time-of-use input substitution;
- wrong hashes, parents, sequence values, identities, or algorithms;
- low-order, non-canonical, and mixed-order Ed25519 public keys or signature `R` encodings;
- invalid, duplicate, ineligible, or insufficient signatures;
- invalid, duplicated, reordered, misplaced, or mislabeled outer evidence around an otherwise authentic body-bound signature;
- missing or substituted heartbeat and membership sidecars during conservative mortality analysis;
- one current signer authenticating multiple candidate bodies;
- membership descriptors whose supplied authorization cannot activate the next threshold; and
- attempted action by a peer removed from custody.

Safety MUST hold for every included failure. Liveness is conditional as specified below.

## 6. Adversaries excluded from the v0 guarantee

The following are explicitly out of scope for the foundational claim:

- a custodian intentionally signing conflicting children;
- collusion by enough current custodians to satisfy quorum;
- theft or extraction of a custodian private key;
- a modified client intentionally persisting a supposedly volatile key;
- a malicious mortality adapter or transparent `Proxy` that lies through prototype or descriptor traps while presenting an ordinary-looking observer container;
- compromised browser, CLI/runtime, operating system, firmware, or hardware;
- malicious cryptographic library or random-number generator;
- Sybil identities and fake resource contribution;
- traffic analysis and metadata privacy;
- denial of service by an unbounded attacker;
- coercion or legal control of participants;
- side-channel attacks;
- quantum attacks; and
- malicious genome code escaping a future process sandbox or producing nondeterministic results.

The validator still rejects malformed or unauthorized inputs from outsiders. Exclusion means v0 does not guarantee continued safety if a current custodian behaves Byzantine or its key is compromised.

### Signed resource-contract boundary

The v1 resource contract narrows “resource contribution” to signed finite intent
plus a network-visible sign-once claim. It rejects malformed identity, capacity
overflow, out-of-window allocation, signature substitution, receipt
regression/fork, replay, unsafe witness thresholds, role overlap, provider lease
equivocation, and witness double-signing. Provider and consumer must both sign a
lease and every usage receipt; either party may terminate their lease without
waiting for the other.

Each offer signs a sorted witness roster, a declared Byzantine bound `f`, and a
threshold `q`. For roster size `n`, the validator requires `n >= 3f + 1`,
`q <= n - f`, and `2q > n + f`. A lease cannot become scheduled, active,
exhausted, or completed until `q` distinct roster witnesses announce the exact
offer/lease consumption. A minority partition therefore remains `unwitnessed`.
Two conflicting threshold certificates must intersect in more than `f` witnesses,
so at least one identity has signed both claims if at most `f` are Byzantine. The
evaluator exposes this equivocation and selects no winner. These properties are
conditional on the signed fault bound; a roster does not establish independence.

The lease-bound execution layer now adds a consumer-signed unpredictable challenge
and a provider/consumer-signed receipt tied one-to-one to cumulative usage. It
recomputes a challenged content proof, payload round trip, or deterministic bounded
compute result and rejects replay, forks, cross-lease substitution, tampering, and
unproved usage. A verifier can challenge work but gains no scheduler or lifecycle
authority. Provider loss requires a new signed offer and lease; the stable workload
ID recognizes the same work without inheriting the old provider's receipt chain.

This still does not remove the Sybil/fake-independence threat. Provider and consumer
can collude on usage, one administrator can control many valid keys and processes,
and a local child process is not separate hardware, region, credential, or custody.
No scheduler may convert a valid receipt into a physical-independence or honest-
metering claim without a separate deployment evidence matrix.

## 7. Safety properties

Under the v0 assumptions:

### S-1 — Identity immutability

No accepted Pulse changes `organism_id`; every candidate must match the ID derived from Genesis.

### S-2 — Parent integrity

Every accepted non-Genesis Pulse has exactly one genuine validator-accepted parent and the next sequence. Acceptance-shaped caller data has no authority.

### S-3 — Quorum authorization

Fewer than the current threshold of eligible unique custodian keys cannot authorize a successor. If one endpoint controls threshold keys, it can satisfy the logical quorum; v0 does not misreport those keys as independent failure domains.

### S-4 — Membership safety

Only the current quorum may change custody, every newly added custodian must prove possession by accepting the handoff, and the retained current approvers plus new acceptors must cover the next threshold. A handoff cannot install a quorum that its transition evidence cannot activate.

### S-5 — No silent rollback

An exact replay is rejected. A distinct alternative valid child is retained as fork evidence and removes the unique recognized head rather than silently replacing it.

### S-6 — Fork visibility

If two valid siblings are observed, the local validator enters `FORKED`; it does not silently pick one.

### S-7 — Authority separation

GPT output, UI state, and transport behavior cannot convert an invalid candidate into an accepted Pulse.

### S-8 — Clone separation

A new birth using prior genome/state material but no parent authority samples a new Genesis nonce and has a different organism ID. A byte-identical Genesis is the same birth replayed, not another entity.

### S-9 — Payload binding

Every accepted Pulse binds the exact canonical event-payload sidecar used by semantic validation. Missing or hash-mismatched sidecars fail closed.

### S-10 — Strict key identity

Custodian public keys and signature `R` values must be canonical prime-order subgroup points. Low-order, non-canonical, and mixed-order encodings cannot create authority, peer-ID aliases, or universal signatures.

### S-11 — Snapshot consistency and totality

Validation reads caller byte inputs through trusted typed-array intrinsics into owned snapshots before semantic use. Mortality accepts only honest Proxy-free ordinary own-data option and carrier records plus dense current-realm own-data arrays from the trusted observer adapter. It reads a fixed five-field option vocabulary, two carrier fields, array lengths, and bounded own-data indices; it never enumerates caller keys or invokes caller iterators. Unknown and Symbol properties plus extra non-index array properties are ignored without descriptor access and cannot contribute evidence. Accessors on recognized fields or indices, sparse arrays, foreign prototypes, and invalid key representations abort without executing value getters. Raw evidence byte views remain hostile and are copied into owned bounded snapshots. After acquisition, the JavaScript reference checks exact global, constructor, prototype, iterator, and reachable dependency state plus one constant-cost SHA-256/RFC 8032 known-answer checkpoint before semantic or cryptographic work. Drift, source-access failure, unstable, detached, oversized, or wrong-type bytes, malformed declared JSON bytes, and unexpected internal validation failure abort the entire observer operation as uncertainty rather than being interpreted as missing evidence. Capability and limit-error brands are private; lineage, schema, and error surfaces are frozen; post-check work uses owned inputs and captured or exact-integrity-checked operations. Shared backing memory is rejected. Programmatic canonicalization consumes one data-descriptor snapshot, rejects accessors, custom record prototypes, and recognizable internal-slot objects presented as unbranded null-prototype records without invoking value getters, and checks array own-property shape but not array prototypes; its documented Proxy and unprobed-exotic limits remain.

### S-12 — Recognized-head mortality scope

Only a lineage created through its module-private capability may evaluate mortality. Its public instance, constructor, and prototype are frozen. It supplies the current graph-recognized head, owns one global usable-current-key observation, reuses that same set for every candidate body, and reconstructs possible direct children from owned raw pending components. It recursively discovers exact tagged Ed25519 signature strings—including object property names—and exact current target-tuple body objects anywhere in each parsed declared envelope or payload tree, while indexing each declared payload root as a content-addressed sidecar. Every target occurrence, including nested and canonical duplicates, reserves the 128-body budget before JCS; its canonical UTF-8 bytes reserve the 4 MiB aggregate budget immediately after JCS and before retention, hashing, or skeleton validation. Pending records/bytes, usable IDs/characters, and conservative signature-verification work have five additional fixed ceilings. The signature ceiling is 1,152 units: a maximum 16-current/16-new valid transition consumes at most 1,088 and retains 64 units of headroom, while repeated direct carriers retain per-validator reservations. Any overflow is frozen, unclassified, graph-atomic, and retryable; partial evidence never yields a life/death result. Each distinct observed signature is reverified against every eligible key under each body's separate approval and acceptance domains, preserving all verifying signers rather than stopping at a first match; canonical body grouping, signature-string de-duplication, and reuse of the completed current-approval map avoid a second identical remap pass. Different bodies never cross-union evidence. Projection filters the global usable set by each signer's observed body commitment. Authenticated multi-body signing leaves mortality unclassified, as does a completion-capable membership body whose committed sidecar remains unavailable in the exact circumstances defined by the protocol. Executable or ambiguous recognized observer reads are rejected; the runtime and dependency checkpoint aborts drift before every result, including an already-recorded fork and a pre-semantic acquisition limit. Poisoned runtime plus over-limit usable IDs, pending records, or bytes aborts instead of returning a normal limit result, and poisoned public typed-array copy, Set iteration, or array sorting never runs. A recorded fork has no unique head and remains unclassified. A death label additionally requires separate true assertions for irreversible authority loss and completeness of the declared latent-evidence observation.

The container rule does not sandbox arbitrary JavaScript. A transparent `Proxy` can make named descriptor traps return a consistent ordinary-looking view while mutating another source; ECMAScript exposes no reliable Proxy test. That behavior violates the trusted observer-adapter boundary and is not covered. Whole-key `ownKeys` amplification is nevertheless excluded: unknown observer properties are not enumerated or read. Invalid usable-key representations and any malformed, oversized, wrong-type, detached, or otherwise unsnapshotable recognized byte source abort the whole observation, so an attacker who can enter that trusted inventory can deny classification; the availability loss is intentional rather than risk false death. R1 replaces the public object graph with one canonical bounded operation/result byte contract and an independently written non-JavaScript verifier, removing this call-entry representation ambiguity. It cannot independently prove that the adapter's completeness assertion is true.

The pre-semantic limit checkpoint also detects ambient mutation triggered during
observer-container acquisition itself; no immediate limit result bypasses that
recheck.

## 8. Conditional liveness properties

MortalOS v0 guarantees no unconditional progress in an asynchronous or partitioned network.

A valid next Pulse can eventually be produced only if:

1. at least the current quorum of honest custodian keys still exists;
2. those custodians eventually exchange messages;
3. the exact committed event-payload sidecar is available;
4. all newly added custodians accept a membership handoff, if any; and
5. the environment schedules sufficient computation.

MortalOS v0 has no state-transition event. `mortalos/1` adds the bounded
deterministic transition defined in Protocol section 14, but neither version treats
a heartbeat, membership change, state root, or transition receipt as proof that the
resource bytes remain retrievable. R3 availability and recovery remain separate.

If these conditions do not hold, stalling is correct behavior. Safety takes precedence over availability.

## 9. Mortality model

### 9.1 What death means

Protocol death in v0 is a qualified observer result: irreversible loss of quorum-held authority to create any valid successor in the same lineage under the accepted current custody rule, with an explicitly complete observation basis showing zero pre-authorized latent successors.

Examples under the v0 controlled-test assumptions:

- a `1-of-1` lineage irreversibly loses its sole current private key; or
- a `2-of-3` lineage loses two current private keys and those keys were never persisted.

The controlled test must also establish that its collection of pending bodies, signature strings, and matching sidecars is complete for the stated observation domain, and that no collected candidate body can become valid without a new signature from a current key assumed lost. An empty local array or network silence is not that proof. Key destruction does not revoke signatures already created. `Lineage#evaluateMortality` supplies its own recognized head, snapshots canonical usable IDs, acquires bounded dense pending indices, and copies the two recognized own-data evidence byte fields before analysis. It recursively pools target-tuple bodies and signature strings across parsed declared JSON trees under all seven whole-observation limits, indexes declared payload roots as sidecars, recovers signer role and identity by domain-separated verification, and groups only same-body evidence. It excludes a key from projection onto a body after that key authenticated another same-tuple body, even when that committed body later fails a semantic rule. A committed key counts only for its signed body; only uncommitted usable keys count toward fresh authority, so split commitments cannot be mistaken for a live quorum. The result's `usable_keys` count means this uncommitted set, not the raw observer-supplied inventory. Both the possible current-approval set and the resulting next-activation set must reach their thresholds. A heartbeat may use synthesized canonical `{}` only for non-appendable completion analysis. A membership sidecar cannot be synthesized. Only when authority loss is declared irreversible, fresh uncommitted authority is below quorum, and no verified latent child already establishes non-death does a completion-capable signed body with no observed hash-matching parseable sidecar return `evidence_payload_unavailable` rather than a death classification. A hash-matching parseable but semantically invalid sidecar makes that exact body impossible and cannot create opacity. Without declared irreversibility the result remains `authority_unavailable_not_proven_dead`; if a fresh quorum remains, the independent result is `operationally_alive` or `state_stalled`. Authenticated multi-body signing returns `evidence_equivocation`. Callers cannot inject a head, conditional capability, per-body usability set, leaked constructor, authoritative key-ID label, accessor-backed recognized pending list or evidence field, or mutable array iterator.

If two distinct raw pending successors are both fully valid children of the recognized head, mortality evaluation records the fork. If the lineage is forked, mortality is not classified. Fork resolution is outside v0, and selecting either sibling merely to obtain a life/death label would make an observer policy authoritative.

Loss of logical state by itself is `state-stalled`, not protocol-dead, because current custodians can still sign a valid heartbeat or membership change that repeats the authenticated opaque declared root. State-backed mortality requires a later protocol with verifiable availability/recovery evidence.

### 9.2 What death does not mean

Death does not mean:

- Genesis or Pulse history is unreadable;
- the genome source code disappeared;
- no person saved a screenshot or public state;
- no hidden private-key copy exists anywhere; or
- every observer can prove the moment of death.

### 9.3 Observability limit

Silence is ambiguous. A peer may be dead, disconnected, paused, slow, or hidden behind a partition. Therefore:

- no absence-of-message timer may create a consensus death fact;
- no key-loss observation may claim death while a latent successor could still be delivered or completed;
- no empty or omitted local pending-evidence array may claim death unless the observer separately asserts a complete inventory for its declared domain;
- a UI may report `dormant`, `unreachable`, or `presumed dead under policy`;
- only candidate validity is cryptographically decidable from available inputs; and
- the controlled P4 death experiment must state its key-erasure assumption.

### 9.4 Malicious persistence limitation

An open endpoint cannot prove that a modified client did not copy a private key before deleting it. Therefore v0 mortality is guaranteed only for honest ephemeral custodians in the controlled experiment. Closing a CLI process or browser tab can end that endpoint's operational instance and local authority, but it is relevant to a protocol-death classification only when the experiment explicitly controls key persistence and irreversibility and supplies a complete pending-evidence basis. Process exit alone is never a global or protocol death fact.

Potential later mitigations include non-exportable device keys, trusted execution, distributed key generation, proactive resharing, and threshold signatures. Each introduces new trust or availability assumptions and is not part of v0.

## 10. Partition and fork analysis

For `n=3`, `threshold=2`, where one key is held per failure domain:

- a `2 + 1` partition permits the two-key component to progress;
- the one-key component must stall;
- two disjoint quorum components cannot exist; and
- two valid siblings require at least one custodian to violate sign-once or lose key integrity.

For every permitted v0 custody descriptor, threshold is a strict majority. Therefore any two quorums intersect. Quorum intersection plus honest sign-once prevents valid siblings, but quorum intersection alone does not protect against a Byzantine intersecting peer.

For `n=1`, `threshold=1`, the sole custodian can progress and can create valid siblings by violating sign-once. This mode establishes portable solitary birth, not distributed or ownerless authority. An accepted handoff to `2-of-3` changes the logical custody boundary immediately and makes the old sole key insufficient; the physical or administrative failure-domain boundary changes only when deployment evidence shows those keys are independently controlled.

If a valid fork is observed, MortalOS v0 halts automatic progress and reports fork evidence. It does not claim Byzantine resolution.

## 11. Signaling and backend boundary

MortalOS may use infrastructure for peer discovery and NAT traversal. That infrastructure:

- may reveal metadata or prevent peers from connecting;
- may relay encrypted transport packets;
- must not hold a privileged signing key;
- must not decide the recognized head;
- must not bypass current quorum; and
- must not be required to reconstruct accepted state after peers connect, except as a non-authoritative cache.

The source revision includes manual WebRTC participant transport plus receipt-gated
encrypted placement and repair. The correct claim is **peer-to-peer execution and state authority
with replaceable bootstrap infrastructure**, not zero
infrastructure. The public Lab's default journey still uses the HTTP relay and the
confidential P2P vertical remains an automated acceptance harness; neither fact
establishes an open participant resource network or independent physical providers.
The direct adapter treats public JavaScript constructors, collection/iterator
methods, delivery schedulers, Event/DataChannel slots, and RTCPeerConnection methods
as mutable capabilities. It captures reviewed native operations, keeps one private
transcript map, publishes locally only after a synchronous native send succeeds, and
returns detached immutable frames. Node and actual connected-Chromium poison corpora
exercise those named boundaries. Relay artifact-kind membership is a separately
pinned transitive decoder dependency and invokes captured `Set.has`; selective
`verdict` poison must leave send and both transcripts at zero while challenge remains
deliverable. This does not claim that every future relay validator dependency is
automatically primordial-safe. A successful send is only local queue admission, not a
peer acknowledgement, durable storage proof, or placement verdict.

### 11.1 Bootstrap endpoint boundary

A CLI or other endpoint MAY create a `1-of-1` singleton. One browser MAY instead create three volatile logical custodian keys and complete unanimous Genesis approval for a `2-of-3` descriptor. These bootstrap profiles differ cryptographically but share a deployment limitation: one physical domain controls continuation.

- The singleton has one logical key and one failure domain.
- The browser incubator has three logical key slots but one failure domain.
- Either may later hand authority to independent endpoints without changing identity.
- Process exit or page close loses local authority under explicit ephemeral-key and no-hidden-copy assumptions; a death label additionally requires irreversibility and an explicitly complete pending-evidence observation.

The UI and CLI MUST disclose concentration and MUST NOT call the entity independently distributed or ownerless until no failure domain controls threshold keys. Workers and non-extractable keys reduce accidental persistence but do not prove physical independence or erasure.

## 12. GPT-5.6 boundary

GPT-5.6 may:

- translate human intent into a schema-constrained proposal;
- explain a validation result;
- summarize observed network health; and
- propose fault experiments.

GPT-5.6 must not:

- access private signing keys;
- sign as a custodian unless separately and explicitly modeled as one, which v0 forbids;
- change schemas or validation rules at runtime;
- waive quorum or new-custodian acceptance;
- select a fork winner; or
- label silence as protocol-proven death.

## 13. Privacy and resource limitations

MortalOS v0 provides integrity and lineage semantics, not confidentiality. Public keys, membership changes, pulse metadata, and public state roots may be observable. The later S4 extension encrypts bounded state packages, but that does not retroactively make v0 metadata confidential or promote the revised S4 stage claim.

Resource contribution is explicit, bounded, signed, metered, and revocable in the
later resource-contract and P2P placement source extensions. Those extensions are
outside the v0 validity/death claim and do not establish independent providers or
honest metering. v0 itself does not include background execution, hidden mining,
incentives, or unrestricted arbitrary code.

## 14. Security claims matrix

| Claim | v0 status | Qualification |
|---|---|---|
| Holder of one current key cannot advance a 2-of-3 lineage | Guaranteed | Quorum counts distinct eligible keys. |
| Low-order or mixed-order key aliases can satisfy quorum | Rejected | Strict public-key and signature-`R` subgroup/canonical checks run before authority is counted. |
| A transition can install an evidenced-but-inactive next quorum | Rejected | Retained valid approvers plus valid new acceptors must cover the next threshold. |
| One endpoint holding two of three keys cannot advance alone | Not claimed | It can satisfy logical quorum; failure-domain distribution is separate. |
| One key controls a 1-of-1 lineage | Explicit bootstrap property | Do not describe this custody state as ownerless authority. |
| Bootstrap close loses continuation authority | Conditional | Requires ephemeral keys, no hidden copy, explicit irreversibility, an explicitly complete pending-evidence basis, and zero reconstructed latent successors. |
| Identity survives complete safe host turnover | Guaranteed by protocol | Requires every handoff to be valid and accepted. |
| Minority partition cannot advance | Guaranteed | Under current threshold rule. |
| Public snapshot cannot sign a successor | Guaranteed | Snapshot excludes private keys. |
| Destroying keys invalidates pre-existing signatures | Not claimed | A latent authorized successor remains usable. |
| Caller-selected candidate can be treated as the mortality head | Rejected | The lineage supplies its unique recognized head and reconstructs possible direct children from independently observed bodies, signatures, and sidecars. |
| Nested/duplicate candidate evidence can amplify unbounded mortality work | Rejected within fixed v0 limits | Occurrences reserve before JCS and aggregate canonical bytes reserve before retention; overflow is frozen, unclassified, graph-atomic, and retryable. |
| Unknown observer properties can amplify key enumeration or inject evidence | Rejected | Only fixed named fields and bounded indices are read; `ownKeys`, iterators, and unrelated properties are ignored. |
| Forked lineage has a v0 death classification | Not claimed | Without a unique recognized head, mortality remains unclassified. |
| Missing state alone kills the v0 lineage | Not claimed | v0 preserves an authenticated declared root, not content binding or retrievability; report `state-stalled`. |
| All hidden copies are erased at death | Not claimed | Impossible to establish in open untrusted clients. |
| Byzantine quorum cannot fork | Not guaranteed | Future work. |
| Sybil-resistant openness | Not implemented | Future work. |
| Confidential bounded state packages | Implemented as the S4 source extension; revised stage claim reopened | Providers see ciphertext shards, not plaintext or keys; same-origin/XSS-resistant custody and independent-provider promotion remain HOLD. |
| Zero infrastructure | Not claimed | Bootstrap/relay may exist. |
| GPT cannot bypass validity | Required architecture property | The optional GPT/presentation path is non-authoritative and cost-gated; protocol validators do not consume its verdicts. |

## 15. v1 state-specific boundaries

- Genome, state, input, and receipt sidecars are public evidence, not capabilities.
- v1 proves deterministic content transition, not storage durability,
  retrievability, execution liveness, or global availability.
- Only the bounded Pulse Seed v1 genome is executable. Arbitrary code, floating
  point, clocks, randomness, network input, and host callbacks are outside the ABI.
- A UI updates pulse count or avatar only after the same canonical Pulse is accepted.
  A prepared receipt, relay hint, or animation never advances state.
- Restart recovery replays signed evidence and state sidecars. A pending, corrupt,
  or partially persisted candidate cannot become an accepted head.

## 16. S2 durable-quorum assumptions and exclusions

- A non-extractable browser `CryptoKey` prevents supported API export; it does not
  resist a compromised browser process, same-origin script/XSS, operating system,
  hardware, or user account. Same-origin code can retrieve a structured-cloned key
  from IndexedDB and invoke `sign` without exporting it.
- IndexedDB atomicity and strict durability are platform assumptions. The S2 fault
  gate verifies every adapter-visible boundary but does not claim power-loss
  guarantees beyond the browser/storage contract.
- A durable reservation prevents signing a conflicting body for the same tuple. If
  a crash occurs after Ed25519 computation but before signature persistence, the
  exact deterministic message may be signed again during recovery; the failed call
  released no signature and a different body remains forbidden.
- Separate endpoint instances restored from one revision are concurrent writers.
  Every whole-document write therefore uses a consecutive expected-revision CAS
  inside the storage transaction. A stale reservation fails before signer
  invocation; process-local serialization alone is not a security boundary.
- The committed-head cache is non-authoritative and disposable. Evidence replay,
  key identity, custody, and state references determine recovery.
- Reached expiry is a persisted policy latch. Same-process and cold-restart clock
  rollback cannot reactivate it; only a versioned CAS-protected renewal with a
  non-null expiry strictly beyond the persisted observation high-water mark may
  reactivate it. Null, stale, or equal renewal remains expired. Expiry still does
  not erase previously released signatures, public evidence, browser backups, or
  hidden copies.
- Legacy removal metadata and key presence must agree. `removed + key` and
  `active + no key` abort migration and retain the version-1 database. Successful
  migration atomically creates the v2 participant document and deletes every
  legacy store; authority removal cannot leave a second raw-signing key behind.
- Node's memory durable store proves failure semantics only. It is not a production
  Node key store or hardware-backed custody claim.
- The `100/100` Chromium matrices use separately persisted profiles/databases on one
  host and one administrative domain. They do not satisfy S7 independent failure
  domains.
- S2 state references bind deterministic state already carried by evidence. S2 does
  not prove external chunk availability, confidential state, relay independence, or
  exact resource-byte reconstruction.

## 17. S3 state-recovery assumptions and exclusions

- The canonical manifest and receipt bind resource bytes to the accepted lineage,
  but chunk availability is observed through untrusted bounded adapters.
- Inventories are hints. A fetched chunk is owned, size-checked, and rehashed before
  storage; the ordered reconstructed resource is rehashed before activation.
- The raw-only format rejects compression and decoding rather than attempting to
  bound an attacker-controlled expansion ratio.
- Recovery interruption may retain verified content-addressed chunks, but cannot
  replace the last verified active-state record. Retry is resumable and idempotent.
- `state_unavailable` is not candidate invalidity, global absence, or death.
- The S3 logical stores share one process and administrative domain. Confidentiality
  is S4 work; independent provider/domain evidence is S7 work; browser-engine parity
  is S8 work.

## 18. S4 confidential-state boundary

The [confidential-state cryptographic ADR](CONFIDENTIAL_STATE_CRYPTOGRAPHY.md) was
independently promoted before runtime work began. The exact-head implementation
candidate uses AES-256-GCM only for bounded
chunk authenticated encryption and RSA-OAEP-3072-SHA-256 only for recipient-specific
epoch-key wrapping through WebCrypto.

- Signing authority and confidentiality keys remain distinct.
- GCM IVs are unique under one epoch key through a durable 64-bit invocation
  counter; gaps are safe and reuse is forbidden.
- The browser reference authority stores its non-extractable sign-only key and
  counter chain in IndexedDB and serializes same-origin endpoint callers with Web
  Locks plus a storage revision CAS. Actual Chromium contention and full process
  restart are required evidence; this is one credential/storage domain, not S7
  physical independence.
- Web Locks and revision CAS serialize conforming callers only. They do not stop a
  same-origin script from using the stored key outside the counter protocol; strong
  counter custody requires a separate origin/service or hardware authorization
  boundary and remains HOLD.
- Authority records resolve immutable constructor-registered store capabilities,
  never caller-visible store methods. Own or prototype method replacement cannot
  forge authority loss or retirement; actual Chromium must complete both loss and
  equivocation rotations through the persistent IndexedDB/Web Locks facade.
- Rotation captures the successor request once as an inert own-data record.
  Current and successor membership arrays plus every recipient descriptor become
  frozen owned records before authorization or any asynchronous callback. The
  approved descriptor and package reservation resolve through the same exact,
  WeakMap-branded authority capability; caller wrappers, accessors, repeated
  public `descriptor` or `reserveRange` reads, and post-authorization array
  mutation cannot substitute a different authority or recipient set. Actual
  Chromium must reject the stateful `X`-then-`Y` authority substitution before
  either authority reserves a counter and must keep the quorum-approved wrap set
  despite a pre-construction recipient-array mutation.
- Canonical AAD binds organism, membership head, epoch, resource, chunk position,
  prior confidential root, plaintext length, and invocation counter.
- The S4 plaintext ceiling is 3,098,890 bytes for 1–16 custodians; its worst legal
  16-wrap encoding is 4,194,303 bytes and therefore fits the S3 4,194,304-byte
  raw-resource ceiling. Exact max, max+1, and custodian 17 are executable gates.
- The confidential manifest carries `transition_id`; creation and import recompute
  `epoch_id` from the exact receipt authority, current wrap-key set, membership,
  organism, epoch, and transition. A failover-local allocator cannot merely repeat
  the declared epoch ID.
- Membership change creates a fresh epoch key and wraps it for every and only the
  new membership.
- Decryption success is never protocol acceptance.
- Removed-member denial applies only to future epochs. Retroactive secrecy, secure
  erasure, endpoint-compromise resistance, and traffic-analysis resistance are not
  claimed.
- Rotation activation is atomic old-or-new; any mixed membership/key/package state
  fails closed while the prior complete epoch remains readable.

The hardened source revision has focused relay/store capture evidence, standard and cross-runtime
vectors, one-million-record IV uniqueness, actual IndexedDB/Web Locks endpoint
contention, browser-process restart recovery, persistent loss/equivocation
rotation, mutable-store attack rejection, successor-substitution rejection,
recipient-substitution rejection, failover-local authority rejection,
removed-member denial, authority-only rotation, and
every-write-boundary old-or-new fault evidence. That source merged through PR #51,
but the revised S4 stage claim remains reopened until a new exact-SHA receipt covers
it. Rolling source text cannot substitute for immutable review, CI, merge,
deployment, and receipt records.

## 19. Threat-model change control

Any implementation change that introduces one of the following requires a threat-model revision before merge:

- persisted private keys;
- a new signature or hash algorithm;
- a non-majority quorum;
- a fork-choice rule;
- state confidentiality claims;
- Byzantine or Sybil resistance claims;
- autonomous genome changes;
- executable genome or state-transition semantics;
- state-availability evidence that changes protocol death semantics;
- model-controlled state mutation;
- authoritative server-side state; or
- a claim that logical key separation proves physical or administrative independence.

The revision must identify the new trust assumption, affected invariant, failure mode, and required test.

## 20. S7/S8 distributed and browser boundary

- Majority CAS tolerates crash/partition faults only; it does not tolerate Byzantine
  replicas or a compromised signing authority.
- Three localhost processes and three files prove process/network restart semantics,
  not separate hosts, providers, administrators, or credential domains.
- A Continuity Capsule contains public lineage plus encrypted resource state and no
  signing authority. A 2-of-3 Capsule quorum is content availability, not key quorum.
- Chromium and Firefox have actual-engine source-revision evidence. WebKit is selected by
  measured capability, not engine name or key generation: native non-extractable
  Ed25519 must sign and verify through the canonical 65,536-byte message ceiling
  before the full custody suite runs. `NotSupportedError` or `OperationError` permits
  verifier-only operation. Raw or exportable private-key fallback is forbidden.
- Any valid divergent Capsule or lineage is equivocation evidence and halts automatic
  activation; MortalOS does not select a winner.

## 21. Confidential P2P placement source boundary

- WebRTC connection success, manual signaling text, a provider label, or receipt
  delivery is not placement proof. Only the exact active lease and storage execution
  chain for the requested workload can count.
- Provider identity is derived from the signed offer. Repeated identity cannot count
  as multiple failure domains.
- A historical receipt proves possession at one challenge time. The confidential
  evaluator applies a bounded local proof age: the exact maximum counts and maximum
  plus one millisecond does not. This improves scheduling freshness but does not
  prove continuous liveness; local failed readback remains non-global observation.
- A historical placement timestamp is not evaluation authority. Resource-contract
  completion or effective revocation and proof freshness are both evaluated at the
  canonical generation instant; otherwise a caller could rewind only the placement
  timestamp and admit an expired lease into a current generation.
- The composed path sends providers only canonical shards of an S4 encrypted
  package. Providers receive no resource plaintext, epoch key, unwrap authority, or
  custodian private key. This depends on S4 encryption; XOR shard coding itself is
  availability coding and is not plaintext secret sharing.
- A restored controller does not count the same prior receipt again. An existing
  lease must extend the journaled receipt directly; after custody moves from A to B,
  a separately generated successor-authorized operational signer creates new leases
  rather than receiving A's private consumer key. This operational identity is not
  inferred to be, or cryptographically bound to, B's Continuity custody identity.
- A journal-shaped object or its self-hash is not producer evidence. The conforming
  creator accepts only a module-private evaluator result. The producer copies
  recognized records, dense arrays, and byte views into owned inert data, uses
  captured collection operations, and rechecks the runtime after hostile acquisition
  and nested validators before issuing the brand. It does not invoke caller array
  methods or recognized getters, so selective array-method, Proxy-array, accessor,
  Map, or Set poisoning fails closed rather than producing proved barriers. The durable commit
  adapter rederives a complete three-shard barrier from raw verified placement
  evidence. Empty, partial, cloned, accessor-backed, Proxy-backed, or manually
  self-hashed incomplete journals cannot advance the pointer. Stale or unavailable
  receipt-bearing placements remain barriers. Restart enumeration and pointer
  selection are also contained and checked before/after filesystem reads; a
  self-restoring prototype override cannot conceal the newest existing generation,
  and current-fork selection is independent of listing order. Hostile replacement of an otherwise
  complete unsigned journal on local disk is outside this source claim.
- Canonical placement generations are committed through the current Continuity
  descriptor's quorum-authorized sign-once transition. A verified commit qualifies derivation of a
  deterministic placement action plan. `deriveCommittedPlacementActionPlan` returns
  `mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
  `verified_placement_receipt_ids`, `non_capability: true`, and
  `requires_executor_reverification: true`; it is public, forgeable JSON rather than
  authority. The effect executor must reverify the original Capsule, generation,
  commit, current placement evidence, and liveness evidence. Generation numbering is
  rederived from authenticated Capsule placement-transition history; repetition,
  decrement, skip, or overflow fails closed. A valid same-generation
  sibling fork halts with no selected head; reordered or duplicated evidence
  converges byte-identically. Convergence also retains the authenticated latest
  placement tip from every supplied verified Capsule; a chain that ends before any
  supplied tip halts as `incomplete-chain` instead of selecting a historical winner.
  A completely hidden newer Capsule remains unknowable and is not a global-currentness
  claim.
- Raw `unavailable_provider_ids` remains a lower-level diagnostic input and is
  rejected by lineage generation. Provider failure at that layer requires a
  predecessor/sequence-bound challenge and a threshold of role-disjoint observations
  under the provider-signed offer witness policy. No global clock or deadline is
  trusted. The core conditionally halts a derived plan for a valid late receipt
  response, challenge fork, or response fork when the caller supplies the response
  and corresponding verified current placement evidence. The current Lab/browser
  harness supplies empty late-response/current-placement arrays and has no network
  gossip plus execution-time reconciliation loop; that production control remains
  unimplemented.
- This prevents one controller key from declaring failure, but does not prove honest
  observer timers or independent actors. One administrator may control multiple
  valid observer keys; Sybil resistance and physical failure-domain diversity remain
  HOLD.
- Manual `iceServers: []` same-host success does not prove NAT traversal, Internet
  reachability, or origin-free discovery. Signaling, STUN, TURN, and relays may be
  replaceable availability capabilities but never validity authorities.
- Separate browser and Node processes on this PC share hardware, network,
  administrator, and credential domains. Physical S7/S8 claims remain HOLD.

The next root P0 is failure-precommitted liveness policy plus independent provider
response and effect-time exactly-once repair reconciliation. Lineage-governed
admission/failure-domain accounting with explicit trust roots follows. Self-asserted
topology labels must not count as independent domains; admission and diversity
claims require evidence rooted outside the admitted actor.
