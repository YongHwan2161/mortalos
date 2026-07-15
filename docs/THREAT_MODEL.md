# MortalOS v0 Threat Model

Status: **Normative for v0 and the Minimum Viable Life claim**  
Protocol: `mortalos/0`

## 1. Security objective

MortalOS v0 protects one narrow claim:

> Within the declared assumptions, every successor requires the current descriptor's logical key quorum; safe custodian replacement can preserve identity; and after continuation authority is irreversibly lost, public historical data alone cannot continue the same lineage. No-unilateral-domain control is an additional deployment property, not a fact inferred from key IDs.

The system does not claim that all data copies can be deleted, that death can always be observed globally, or that v0 tolerates malicious custodians.

## 2. Protected assets

| Asset | Required property |
|---|---|
| Organism identity | Derived only from the canonical valid Genesis body and immutable within a lineage. |
| Lineage integrity | Every accepted Pulse has one accepted parent and obeys deterministic transition rules. |
| Continuity authority | The current descriptor's quorum is required to advance; no individual can advance only when its threshold is greater than one. |
| Custody membership | Changes only through a Pulse authorized by the current custody descriptor, accepted by new custodians, and evidenced strongly enough to activate the next quorum. |
| State integrity | `state_root` commits to the logical state used by the genome. |
| Genome integrity | `genome_hash` is fixed as a content commitment; v0 does not execute it. |
| Private signing keys | Never intentionally serialized, logged, committed, or sent over the network. |
| Mortality semantics | Loss of succession authority is not confused with deletion of all historical bytes or temporary loss of state availability. |
| Validator independence | Endpoint type, transport, UI, GPT, and signaling cannot alter validity rules. |
| Failure-domain honesty | Distinct key IDs are never presented as proof of independent people, browsers, devices, or operators. |
| Input consistency | A validation decision uses owned snapshots, not caller-controlled bytes that may change between checks. |

## 3. Trust boundaries

### 3.1 Trusted computing base for v0

The following are trusted for the v0 claim:

- the deterministic protocol validator implementation;
- the accepted-object graph and its non-forgeable validation-capability boundary;
- standards-conforming SHA-256 and Ed25519 implementations;
- correct RFC 8785 canonicalization;
- the creating endpoint's cryptographically secure random-number generator;
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
- membership descriptors whose supplied authorization cannot activate the next threshold; and
- attempted action by a peer removed from custody.

Safety MUST hold for every included failure. Liveness is conditional as specified below.

## 6. Adversaries excluded from the v0 guarantee

The following are explicitly out of scope for the foundational claim:

- a custodian intentionally signing conflicting children;
- collusion by enough current custodians to satisfy quorum;
- theft or extraction of a custodian private key;
- a modified client intentionally persisting a supposedly volatile key;
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

Validation reads caller byte inputs through trusted typed-array intrinsics into owned snapshots before semantic use. Shared backing memory is rejected, and hostile input maps to a stable rejection rather than escaping as an exception.

### S-12 — Recognized-head mortality scope

Only a lineage may evaluate mortality. It supplies the current graph-recognized head and revalidates raw pending successors against that head. A fork has no unique head and remains unclassified rather than producing a death result.

## 8. Conditional liveness properties

MortalOS v0 guarantees no unconditional progress in an asynchronous or partitioned network.

A valid next Pulse can eventually be produced only if:

1. at least the current quorum of honest custodian keys still exists;
2. those custodians eventually exchange messages;
3. the exact committed event-payload sidecar is available;
4. all newly added custodians accept a membership handoff, if any; and
5. the environment schedules sufficient computation.

MortalOS v0 has no state-transition event. Recoverable logical state is necessary for operational life but is not proven by a heartbeat or membership change.

If these conditions do not hold, stalling is correct behavior. Safety takes precedence over availability.

## 9. Mortality model

### 9.1 What death means

Protocol death in v0 is the irreversible loss of quorum-held authority to create any valid successor in the same lineage under the accepted current custody rule, with no pre-authorized latent successor remaining.

Examples under the v0 controlled-test assumptions:

- a `1-of-1` lineage irreversibly loses its sole current private key; or
- a `2-of-3` lineage loses two current private keys and those keys were never persisted.

The controlled test must also establish that no pending candidate already contains sufficient durable evidence to become valid without new signatures from the lost current quorum. Key destruction does not revoke signatures already created. `Lineage#evaluateMortality` supplies its own current recognized head and revalidates raw `pendingSuccessors`; it accepts as succession evidence either a fully valid direct child or a partial membership handoff whose current quorum is complete, whose supplied acceptances verify, whose next quorum can activate, and whose only missing evidence is explicitly listed new-custodian acceptance. Callers cannot inject a head or hand-built latent capability.

If two distinct raw pending successors are both fully valid children of the recognized head, mortality evaluation records the fork. If the lineage is forked, mortality is not classified. Fork resolution is outside v0, and selecting either sibling merely to obtain a life/death label would make an observer policy authoritative.

Loss of logical state by itself is `state-stalled`, not protocol-dead, because a valid heartbeat or membership change can still be signed from the committed root. State-backed mortality requires a later protocol with verifiable availability/recovery evidence.

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
- a UI may report `dormant`, `unreachable`, or `presumed dead under policy`;
- only candidate validity is cryptographically decidable from available inputs; and
- the controlled P4 death experiment must state its key-erasure assumption.

### 9.4 Malicious persistence limitation

An open endpoint cannot prove that a modified client did not copy a private key before deleting it. Therefore v0 mortality is guaranteed only for honest ephemeral custodians in the controlled experiment. Closing a CLI process or browser tab is relevant evidence only when the experiment explicitly controls key persistence and irreversibility; process exit alone is never a protocol death fact.

Potential later mitigations include non-exportable device keys, trusted execution, distributed key generation, proactive resharing, and threshold signatures. Each introduces new trust or availability assumptions and is not part of v0.

## 10. Partition and fork analysis

For `n=3`, `threshold=2`, where one key is held per failure domain:

- a `2 + 1` partition permits the two-key component to progress;
- the one-key component must stall;
- two disjoint quorum components cannot exist; and
- two valid siblings require at least one custodian to violate sign-once or lose key integrity.

For every permitted v0 custody descriptor, threshold is a strict majority. Therefore any two quorums intersect. Quorum intersection plus honest sign-once prevents valid siblings, but quorum intersection alone does not protect against a Byzantine intersecting peer.

For `n=1`, `threshold=1`, the sole custodian can progress and can create valid siblings by violating sign-once. This mode establishes portable solitary birth, not distributed or ownerless authority. An accepted handoff to `2-of-3` changes that boundary immediately.

If a valid fork is observed, MortalOS v0 halts automatic progress and reports fork evidence. It does not claim Byzantine resolution.

## 11. Signaling and backend boundary

MortalOS may use infrastructure for peer discovery and NAT traversal. That infrastructure:

- may reveal metadata or prevent peers from connecting;
- may relay encrypted transport packets;
- must not hold a privileged signing key;
- must not decide the recognized head;
- must not bypass current quorum; and
- must not be required to reconstruct accepted state after peers connect, except as a non-authoritative cache.

If later phases implement this architecture, the correct public claim will be **peer-to-peer execution and state authority with replaceable bootstrap infrastructure**, not zero infrastructure. The current portable kernel and its CLI/browser verification adapters have no participant-to-participant network transport.

### 11.1 Bootstrap endpoint boundary

A CLI or other endpoint MAY create a `1-of-1` singleton. One browser MAY instead create three volatile logical custodian keys and complete unanimous Genesis approval for a `2-of-3` descriptor. These bootstrap profiles differ cryptographically but share a deployment limitation: one physical domain controls continuation.

- The singleton has one logical key and one failure domain.
- The browser incubator has three logical key slots but one failure domain.
- Either may later hand authority to independent endpoints without changing identity.
- Process exit or page close loses authority only under explicit ephemeral-key, no-hidden-copy, irreversibility, and no-latent-successor assumptions.

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

MortalOS v0 provides integrity and lineage semantics, not confidentiality. Public keys, membership changes, pulse metadata, and public state roots may be observable.

Resource contribution must be explicit and revocable in later participant-runtime phases. v0 does not include background execution, hidden mining, incentives, or unrestricted arbitrary code.

## 14. Security claims matrix

| Claim | v0 status | Qualification |
|---|---|---|
| Holder of one current key cannot advance a 2-of-3 lineage | Guaranteed | Quorum counts distinct eligible keys. |
| Low-order or mixed-order key aliases can satisfy quorum | Rejected | Strict public-key and signature-`R` subgroup/canonical checks run before authority is counted. |
| A transition can install an evidenced-but-inactive next quorum | Rejected | Retained valid approvers plus valid new acceptors must cover the next threshold. |
| One endpoint holding two of three keys cannot advance alone | Not claimed | It can satisfy logical quorum; failure-domain distribution is separate. |
| One key controls a 1-of-1 lineage | Explicit bootstrap property | Do not describe this custody state as ownerless authority. |
| Bootstrap close loses continuation authority | Conditional | Requires ephemeral keys, no hidden copy, irreversibility, and no latent successor. |
| Identity survives complete safe host turnover | Guaranteed by protocol | Requires every handoff to be valid and accepted. |
| Minority partition cannot advance | Guaranteed | Under current threshold rule. |
| Public snapshot cannot sign a successor | Guaranteed | Snapshot excludes private keys. |
| Destroying keys invalidates pre-existing signatures | Not claimed | A latent authorized successor remains usable. |
| Caller-selected candidate can be treated as the mortality head | Rejected | The lineage supplies its unique recognized head and revalidates raw pending direct children. |
| Forked lineage has a v0 death classification | Not claimed | Without a unique recognized head, mortality remains unclassified. |
| Missing state alone kills the v0 lineage | Not claimed | v0 commits to integrity, not retrievability; report `state-stalled`. |
| All hidden copies are erased at death | Not claimed | Impossible to establish in open untrusted clients. |
| Byzantine quorum cannot fork | Not guaranteed | Future work. |
| Sybil-resistant openness | Not implemented | Future work. |
| Confidential prompts/state | Not implemented | Future work. |
| Zero infrastructure | Not claimed | Bootstrap/relay may exist. |
| GPT cannot bypass validity | Required architecture property | Runtime integration and adversarial tests are planned for H4/P9. |

## 15. Threat-model change control

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
