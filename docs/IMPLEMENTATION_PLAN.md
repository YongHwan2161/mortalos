# MortalOS Implementation Plan

Status: **Pre-implementation protocol specification**  
Purpose: define the shortest falsifiable path from an idea to a demonstrated hostless digital life cycle.

## 1. The root problem

MortalOS is not initially a distributed compute marketplace, a virtual machine, a filesystem, or a decentralized LLM. Those may become organs of the system later.

The foundational problem is:

> Can a digital entity preserve one recognized identity and valid state lineage while every physical host is replaceable and no single peer owns the authority to continue it—and can that lineage become unable to continue when its live continuity threshold is lost?

This separates four concepts that ordinary distributed systems often conflate:

- **Data persistence:** some bits still exist somewhere.
- **Identity continuity:** a new state is a legitimate successor of the same entity.
- **Liveness:** the entity currently has the capability to produce another valid state.
- **Mortality:** the recognized lineage has lost that capability; a later copy is a clone or descendant, not the same life resumed.

The project succeeds only if these distinctions are executable and testable, not merely metaphorical.

## 2. Minimum Viable Life claim

The first MortalOS prototype will make exactly this claim:

1. Three peers create an entity with a `2-of-3` continuity rule.
2. Each accepted state, called a **pulse**, names its parent and commits to the entity state and current custodian set.
3. A pulse is valid only when the current rule authorizes it.
4. Custodians can be replaced through authorized handoffs.
5. All original custodians can be replaced while the entity ID and one valid lineage remain unchanged.
6. Once fewer than the required current custodians remain and their volatile authority is lost, a saved public snapshot cannot advance the same lineage.
7. Reusing the genome or historical state creates a new identity, not a resurrection.

Anything beyond this claim is lower priority until the claim passes every gate below.

## 3. Explicit system model for v0

### Assumptions

- Peers may join, leave, crash, reconnect, delay messages, duplicate messages, reorder messages, and become partitioned.
- v0 peers are **honest but fallible**: they follow the protocol but may disappear at any point.
- Each peer has an ephemeral signing key that is never intentionally persisted by the application.
- The protocol uses canonical serialized messages and deterministic validation.
- No central compute or storage backend is authoritative for entity state.
- A bootstrap or signaling service may help peers connect, but it may not decide valid MortalOS state.

### Non-goals for v0

- Byzantine fault tolerance
- Sybil resistance
- Proof that a malicious participant erased copied keys or data
- Cryptocurrency, tokens, or economic incentives
- A POSIX-compatible filesystem
- Linux or a conventional virtual machine
- General distributed scheduling
- WebGPU optimization
- Distributed LLM inference or training
- Autonomous mutation or open-ended evolution
- A globally provable wall-clock time of death

These exclusions are deliberate. Adding them before proving continuity and mortality would hide failure of the foundational claim behind unrelated engineering work.

## 4. Core data model

### 4.1 Genesis

```text
Genesis {
  protocol_version
  genome_hash
  initial_state_root
  initial_custodians[]
  quorum_rule
  created_nonce
  approvals[]
}

organism_id = HASH(canonical_encode(Genesis))
```

`organism_id` has no corresponding owner private key. It identifies the genesis event and the lineage derived from it.

### 4.2 Pulse

```text
Pulse {
  organism_id
  sequence
  parent_pulse_hash
  genome_hash
  state_root
  current_custodian_commitment
  next_custodian_set
  next_quorum_rule
  event_digest
  approvals[]
}
```

### 4.3 Pure validation function

```text
validate(previous_pulse, candidate_pulse, protocol_rules) ->
  Accept | Reject(reason_code)
```

The same inputs must always produce the same result on every conforming implementation.

## 5. Non-negotiable invariants

Every phase must preserve the following invariants:

| ID | Invariant |
|---|---|
| INV-1 | An organism ID never changes within one lineage. |
| INV-2 | Every non-genesis pulse names exactly one valid parent. |
| INV-3 | A pulse unauthorized by the parent state's quorum is invalid. |
| INV-4 | Mutation of any signed field invalidates the relevant approval. |
| INV-5 | An older state cannot replace a recognized newer state without an explicit, detectable fork. |
| INV-6 | Membership changes take effect only through a valid pulse. |
| INV-7 | Replacing every original custodian does not by itself change identity. |
| INV-8 | A group below the current quorum cannot advance the recognized lineage. |
| INV-9 | A clone created without lineage authority receives a new organism ID. |
| INV-10 | AI output, UI state, and transport messages can propose but never define protocol validity. |

## 6. Priority and gate policy

Phases are ordered. A phase may begin experimentally, but it is not considered complete and may not support a public claim until all its exit criteria pass.

- **P0–P4: Foundational critical path.** Failure invalidates the central MortalOS claim.
- **P5–P7: Network embodiment.** Required for a convincing browser demonstration.
- **P8–P9: First organs and AI interface.** Valuable only after the lifecycle is sound.
- **P10: Submission and reproducibility.** Converts the prototype into verifiable evidence.

## 7. Phased implementation plan

### P0 — Operational semantics and threat model ✅ COMPLETE

**Gate result:** PASS on 2026-07-14. See [`P0_VERIFICATION_REPORT.md`](P0_VERIFICATION_REPORT.md).

**Goal**

Turn birth, identity, pulse, continuity, fork, dormancy, death, extinction, clone, and descendant into unambiguous protocol terms.

**Deliverables**

- `docs/PROTOCOL.md`
- `docs/THREAT_MODEL.md`
- message schemas for Genesis and Pulse
- enumerated validation rejection codes
- invariant-to-test traceability table

**Strict exit criteria**

- [x] Every lifecycle term has a necessary and sufficient operational definition.
- [x] Death is defined as loss of recognized succession capability, not as an unverifiable claim that every bit was deleted.
- [x] Dormancy, partition, and death are explicitly distinguishable in the model, including cases where an observer cannot know which occurred.
- [x] The canonical encoding and hash domain-separation rules are specified.
- [x] Every field in Genesis and Pulse has a validation rule.
- [x] Every invariant `INV-1` through `INV-10` maps to at least one planned automated test.
- [x] No later phase is required to explain whether a candidate pulse is valid.

**Gate failure condition**

If two conforming readers can legitimately disagree on validity from the same input, P0 fails.

---

### P1 — Deterministic lifecycle state machine

**Goal**

Implement protocol validity as a pure library with no browser, networking, UI, storage, or AI dependency.

**Deliverables**

- canonical encoder/decoder
- Genesis and Pulse types
- pure `validate` function
- deterministic fixture generator
- unit and property-based tests

**Strict exit criteria**

- [ ] Repeated validation of identical bytes produces identical results across at least two fresh processes.
- [ ] Unknown fields, missing fields, malformed encodings, and non-canonical encodings are rejected deterministically.
- [ ] A one-bit mutation of any committed field is rejected.
- [ ] Sequence gaps, incorrect parent hashes, wrong organism IDs, and unauthorized membership changes are rejected.
- [ ] At least 10,000 seeded generated traces run without violating `INV-1` through `INV-6`.
- [ ] Any failing generated trace is reproducible from its printed seed.
- [ ] Core test coverage is at least 90% for branches in the validator, with uncovered branches documented.

**Gate failure condition**

Any nondeterministic validation result or unreproducible failing trace blocks P2.

---

### P2 — Quorum-authorized lineage

**Goal**

Prove that no individual peer owns the entity's continuation authority and that the current custodian quorum controls state succession.

**Initial mechanism**

Use ordinary per-peer signatures and explicit quorum verification. Do not begin with threshold-signature cryptography; compact threshold signatures can replace the mechanism later without changing lifecycle semantics.

**Deliverables**

- ephemeral peer key generation
- signed Genesis creation
- quorum approval verifier
- replay, duplicate, and signature-mutation tests

**Strict exit criteria**

- [ ] A valid `2-of-3` approval advances the lineage.
- [ ] Every `0-of-3` and `1-of-3` attempt is rejected.
- [ ] Signatures valid for another organism, pulse, sequence, or protocol version are rejected.
- [ ] Duplicate signatures from one peer count once, not multiple times.
- [ ] Replayed approvals cannot authorize a different pulse.
- [ ] Private key material is absent from logs, exported fixtures, serialized application state, and repository history.
- [ ] Corrupting any signature or signed field produces a stable rejection code.

**Gate failure condition**

If a single peer can advance a `2-of-3` lineage or reuse an approval for another transition, P2 fails.

---

### P3 — Complete substrate turnover

**Goal**

Demonstrate the central Ship of Theseus property: all original custodians can disappear while one identity and valid lineage continue.

**Reference scenario**

```text
{A, B, C} -> {B, C, D} -> {C, D, E} -> {D, E, F}
```

**Deliverables**

- custodian handoff transition
- safe quorum-rule update validation
- randomized churn simulator
- lineage visualization fixture

**Strict exit criteria**

- [ ] The reference scenario completes with the same `organism_id` at every pulse.
- [ ] No original custodian A, B, or C remains at completion.
- [ ] Every handoff is authorized under the rule active in its parent pulse.
- [ ] Removed custodians cannot authorize future pulses.
- [ ] Newly added custodians cannot authorize a pulse before their membership becomes active.
- [ ] At least 10,000 randomized safe-handoff traces preserve `INV-1` through `INV-8`.
- [ ] Unsafe handoff traces that drop below quorum stop rather than silently changing identity or rules.

**Gate failure condition**

If identity depends on any original host or if an old member retains protocol authority after removal, P3 fails.

---

### P4 — Mortality, snapshots, and clone semantics

**Goal**

Prove protocol-level mortality: once the current continuation authority is irrecoverably below threshold under the v0 assumptions, historical public data cannot continue the same recognized lineage.

**Deliverables**

- volatile authority lifecycle
- local expiry and key-destruction behavior
- death and dormancy test fixtures
- clone-from-genome operation that creates a new Genesis

**Strict exit criteria**

- [ ] After all current authority below quorum is destroyed, no available test actor can produce an accepted successor pulse.
- [ ] A complete public snapshot of Genesis, pulses, and state data is insufficient to advance the dead lineage.
- [ ] Loading a historical snapshot cannot roll back a later recognized pulse.
- [ ] Creating from the same genome and state produces a different `organism_id`.
- [ ] The UI and API label this result as a clone or descendant, never as the original lineage resumed.
- [ ] Tests explicitly document that a malicious client may persist keys, which is outside the v0 threat model.
- [ ] Temporary message silence alone is not asserted as globally proven death.

**Gate failure condition**

If public historical data alone can advance the same organism ID after authority loss, the foundational mortality claim fails.

---

### P5 — Self-repair and partition behavior

**Goal**

Make maintenance an active process: the entity monitors its viable custodian/state redundancy and repairs itself while sufficient peers remain.

**Deliverables**

- pulse leases and refresh events
- peer health observations
- deterministic repair proposals
- partition and rejoin simulator

**Strict exit criteria**

- [ ] Loss of one peer in a healthy `2-of-3` entity triggers a repair proposal without changing organism ID.
- [ ] With a reachable quorum and an eligible replacement, the entity restores three custodians within a configured number of protocol rounds.
- [ ] A minority partition cannot advance the lineage.
- [ ] A quorum partition may advance; the rejoining minority accepts the valid descendant or exposes a detectable conflict—never silent rollback.
- [ ] Message duplication, reordering, and temporary loss do not violate safety invariants.
- [ ] A 1,000-scenario fault matrix records expected outcome, actual outcome, and seed with zero unexplained mismatches.

**Gate failure condition**

Any silent rollback, unauthorized minority progress, or undetected conflicting lineage blocks browser networking.

---

### P6 — Browser embodiment without network complexity

**Goal**

Run the validated lifecycle in real browser contexts while keeping transport local and observable.

**Transport**

Use `BroadcastChannel` or an equivalent same-origin local transport for multiple tabs. This phase tests browser lifecycle behavior, not Internet connectivity.

**Deliverables**

- browser peer runtime
- three-tab dashboard
- in-memory key and state handling
- birth, pulse, handoff, repair, and death controls

**Strict exit criteria**

- [ ] Three tabs create one organism and display the same accepted head.
- [ ] Closing one tab exercises the P5 repair path.
- [ ] All original tabs can be replaced while the organism ID remains unchanged.
- [ ] Closing below quorum prevents valid progress.
- [ ] Reloading from public history without live authority cannot continue the dead lineage.
- [ ] No correctness decision depends on React state, DOM state, or GPT output.
- [ ] The demo passes in two clean browser profiles with caches cleared before the run.

**Gate failure condition**

If the browser implementation accepts a transition rejected by the pure validator, P6 fails.

---

### P7 — Peer-to-peer Internet transport

**Goal**

Move the same protocol between browsers on separate devices without giving signaling infrastructure authority over state.

**Deliverables**

- WebRTC DataChannel transport adapter
- explicit room or invitation handshake
- bounded message queue and retransmission policy
- disconnect and reconnect handling
- documented signaling/STUN/TURN boundary

**Strict exit criteria**

- [ ] Two separate devices exchange and validate pulses over WebRTC.
- [ ] At least three peers complete birth and one handoff across devices.
- [ ] Disconnecting signaling after peer establishment does not invalidate or control the lineage.
- [ ] Forged, malformed, duplicated, reordered, and stale transport messages are rejected or safely ignored.
- [ ] A transport reconnect cannot bypass membership or quorum rules.
- [ ] The README accurately states that the execution/state plane is peer-to-peer while bootstrap infrastructure may still exist.
- [ ] The full P6 lifecycle demo passes three consecutive times without manual state repair.

**Gate failure condition**

If the signaling service or any single transport peer can define accepted state, MortalOS is not hostless and P7 fails.

---

### P8 — Circulating memory and a migratable process

**Goal**

Add the first real organ: a small deterministic process whose state is maintained and moved by the living network.

**Deliverables**

- content-addressed state blocks
- replication or erasure-coded shard policy
- deterministic checkpoint format
- one bounded WebAssembly or worker-based actor
- migration and recovery demo

**Strict exit criteria**

- [ ] The actor produces identical output for identical checkpoint and input.
- [ ] The actor resumes from a checkpoint on a different peer without changing organism ID.
- [ ] Losing one permitted shard/replica remains recoverable under the documented threshold.
- [ ] Falling below the state recovery threshold stops safely and is reported explicitly.
- [ ] Reconstructed content matches its committed state root byte-for-byte.
- [ ] No process can access browser capabilities absent from its declared capability set.
- [ ] Lifecycle correctness remains valid with the actor disabled or crashed.

**Gate failure condition**

If actor migration corrupts lineage state or the actor becomes an authority over protocol validity, P8 fails.

---

### P9 — GPT-5.6 interpretive control layer

**Goal**

Use GPT-5.6 meaningfully without making probabilistic AI part of the trusted computing base.

**Permitted role**

- translate a human request into a schema-constrained lifecycle proposal;
- explain current network health, quorum, lineage, fork, and mortality risks;
- generate proposed failure experiments and human-readable reports.

**Forbidden role**

- directly mutate accepted state;
- waive signatures or quorum;
- define protocol validity;
- receive or expose private signing material.

**Strict exit criteria**

- [ ] Every model response is parsed through a strict schema before becoming a proposal.
- [ ] Invalid, unknown, or unsafe actions are rejected before reaching the transition engine.
- [ ] The deterministic validator independently accepts or rejects every AI proposal.
- [ ] Prompt-injection tests cannot reveal keys, bypass quorum, or alter validator rules.
- [ ] The demo shows at least one accepted and one rejected AI-generated proposal with explanations.
- [ ] Removing GPT-5.6 leaves the lifecycle protocol fully correct and manually operable.
- [ ] Model name, prompts, response schema, and failure behavior are documented.

**Gate failure condition**

If model output can cause an otherwise invalid pulse to be accepted, P9 fails.

---

### P10 — Hackathon evidence and reproducibility

**Goal**

Turn the prototype into independently inspectable evidence rather than a staged animation.

**Required demonstration sequence**

1. Birth with three peers.
2. Display organism ID and current pulse head.
3. Replace every original peer through valid handoffs.
4. Show the same identity after complete substrate turnover.
5. Remove one peer and show self-repair.
6. Lose continuity authority below quorum.
7. Show that a public snapshot cannot continue the dead lineage.
8. Create a clone and show its new organism ID.
9. Show GPT-5.6 proposing or explaining a lifecycle action without bypassing validation.

**Strict exit criteria**

- [ ] A clean clone of the public repository installs and runs using documented commands.
- [ ] All automated tests pass from a clean environment.
- [ ] The live demo completes the required sequence three consecutive times.
- [ ] The video is under the hackathon time limit and shows actual working software.
- [ ] The repository contains architecture, protocol, threat-model, test, and run documentation.
- [ ] Every public claim maps to a test, code path, or visible demonstration.
- [ ] Known limitations explicitly include honest-peer assumptions, browser volatility, signaling infrastructure, and the impossibility of proving malicious copies were erased.
- [ ] No secret, API key, personal token, or private key appears in Git history or client bundles.

**Gate failure condition**

If the central continuity-and-mortality sequence cannot be reproduced from the public repository, the project is not submission-ready.

## 8. Test matrix required before expanding scope

| Scenario | Expected result |
|---|---|
| 2 valid approvals in 2-of-3 | Accept successor |
| 1 valid approval in 2-of-3 | Reject insufficient quorum |
| Duplicate approval from one key | Count once; reject if below quorum |
| Mutated state after signing | Reject signature/commitment mismatch |
| Old pulse replay | Reject stale sequence or recognized ancestry |
| New peer signs before activation | Reject unauthorized signer |
| Removed peer signs later pulse | Reject unauthorized signer |
| Safe A/B/C to D/E/F turnover | Preserve organism ID and lineage |
| Minority network partition | Stall; do not advance |
| Quorum partition | Advance under current rule; reconcile safely |
| Below-quorum authority loss | No valid successor |
| Public snapshot after death | Readable but unable to continue lineage |
| Clone from same genome/state | New organism ID |
| Invalid GPT-generated action | Reject before state mutation |

## 9. Metrics

The project will report evidence using these metrics rather than vague claims:

- **Safety violations:** target `0` across generated and fault-injection traces.
- **Unauthorized acceptances:** target `0`.
- **Identity changes during safe turnover:** target `0`.
- **Undetected forks:** target `0` in the v0 fault model.
- **Randomized traces:** at least `10,000` for foundational phases.
- **Browser demo reliability:** `3/3` consecutive clean runs.
- **Repair latency:** measured in protocol rounds, with a configured bound stated before the test.
- **Validator branch coverage:** at least `90%`, with exceptions documented.
- **Reproducibility:** every randomized failure must print a replayable seed.

## 10. Scope expansion after the first proof

Only after P0–P10 pass should the project evaluate:

1. threshold signatures and distributed key generation;
2. proactive resharing across changing committees;
3. Byzantine peers and equivocation evidence;
4. Sybil resistance and resource accounting;
5. privacy-preserving state or computation;
6. scalable overlays beyond a full WebRTC mesh;
7. WebGPU and heterogeneous scheduling;
8. distributed model-weight custody and inference;
9. intentional reproduction, mutation, and competing lineages; and
10. governance by explicit protocol forks rather than an implicit central administrator.

An LLM is a future cognitive organ of MortalOS. It is not evidence that MortalOS itself is alive. The lifecycle proof comes first.

## 11. Definition of foundational success

MortalOS has passed its foundational milestone only when this statement is demonstrated and reproducible:

> Every original host is gone, yet one authorized identity and lineage remain alive. After the live continuation threshold is irreversibly lost under the stated threat model, historical data cannot continue that same lineage; it can only begin a new one.
