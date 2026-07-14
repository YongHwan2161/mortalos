# MortalOS Implementation Plan

Status: **P0, Build Week H1, and Build Week H2 verified; H3 browser judge experience is next**  
Last reviewed: **2026-07-14**, including the live OpenAI Build Week rules, judging criteria, submission form, and announcements.  
Purpose: define the shortest falsifiable path from an idea to a demonstrated hostless digital life cycle while also producing a judgeable Developer Tools submission by the hackathon deadline.

This document has two synchronized paths:

- the **protocol path** (`P0`–`P10`), which protects the long-term research claim; and
- the **OpenAI Build Week delivery path** (`H0`–`H5`), which selects the smallest vertical slice that can be installed, run, judged, and explained before submission closes.

Hackathon scope may defer features, but it may never weaken a protocol invariant or make GPT, UI, transport, or a hosted service authoritative for validity.

## 1. The root problem

MortalOS is not initially a distributed compute marketplace, a virtual machine, a filesystem, or a decentralized LLM. Those may become organs of the system later.

The foundational problem is:

> Can a digital entity preserve one recognized identity and valid state lineage while every physical host is replaceable and no single peer owns the authority to continue it—and can that lineage become unable to continue when its live continuity threshold is lost?

This separates four concepts that ordinary distributed systems often conflate:

- **Data persistence:** some bits still exist somewhere.
- **Identity continuity:** a new state is a legitimate successor of the same entity.
- **Liveness:** the entity currently has the capability to produce another valid state.
- **Mortality:** the recognized lineage has lost that capability; a later copy is a clone or descendant, not the same life resumed.

P0 red-team review found that this must be refined further:

- **Authority viability:** a current quorum of signing authority still exists.
- **State viability:** the logical state committed by the head can be reconstructed and executed within an observation domain.
- **Operational life:** both authority and state are viable.
- **State stall:** authority exists but state cannot currently be reconstructed.
- **Protocol death in v0:** quorum authority is irreversibly below threshold under the honest-ephemeral-key test assumption.
- **Latent successor:** previously created durable authorization evidence may still advance a candidate after current keys disappear.

State loss alone is not v0 protocol death because a quorum can still sign a heartbeat or custody change from the committed root. A future state-backed mortality claim requires an explicit, verifiable availability mechanism.

Likewise, key destruction alone is not death if a pre-authorized successor can still be delivered or completed. The controlled mortality test must account for pending approval and acceptance artifacts.

The project succeeds only if these distinctions are executable and testable, not merely metaphorical.

## 2. Minimum Viable Life claim

The first MortalOS prototype will make exactly this claim:

1. Three peers create an entity with a `2-of-3` continuity rule.
2. Each accepted state, called a **pulse**, names its parent and commits to the entity state and current custodian set.
3. A pulse is valid only when the current rule authorizes it.
4. Custodians can be replaced through authorized handoffs.
5. All original custodians can be replaced while the entity ID and one valid lineage remain unchanged.
6. Once fewer than the required current custodians remain and their volatile authority is irreversibly lost under the v0 assumptions, a saved public snapshot cannot advance the same lineage.
7. Reusing the genome or historical state creates a new identity, not a resurrection.

Anything beyond this claim is lower priority until the claim passes every gate below.

## 3. Explicit system model for v0

### Assumptions

- Peers may join, leave, crash, reconnect, delay messages, duplicate messages, reorder messages, and become partitioned.
- v0 peers are **honest but fallible**: they follow the protocol but may disappear at any point.
- Each peer has an ephemeral signing key that is never intentionally persisted by the application.
- The protocol uses canonical serialized messages and deterministic validation.
- Every Pulse is validated with the exact canonical event-payload sidecar committed by its `payload_hash`.
- No central compute or storage backend is authoritative for entity state.
- v0 does not execute `genome_hash` or accept logical state transitions; those require a later deterministic, versioned runtime.
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
GenesisEnvelope {
  kind
  body {
    protocol_version
    hash_algorithm
    signature_algorithm
    genome_hash
    initial_state_root
    initial_custodians[]
    initial_quorum
    nonce
  }
  approvals[]
}

organism_id = DOMAIN_HASH(canonical_encode(GenesisEnvelope.body))
```

`organism_id` has no corresponding owner private key. It identifies the genesis event and the lineage derived from it.

### 4.2 Pulse

```text
PulseEnvelope {
  kind
  body {
    protocol_version
    organism_id
    sequence
    parent_hash
    genome_hash
    current_custody_hash
    state_root
    event { kind, payload_hash }
    next_custodians[]
    next_quorum
  }
  approvals[]
  acceptances[]
}

EventPayloadSidecar = canonical_I_JSON_object_bytes
event.payload_hash = DOMAIN_HASH(EventPayloadSidecar)
```

### 4.3 Pure validation function

```text
validate(validation_context, candidate_envelope_bytes, event_payload_bytes) ->
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
| INV-11 | Every accepted Pulse is semantically validated against the exact canonical event payload committed by that Pulse. |
| INV-12 | Authority availability and state availability are reported separately; v0 never treats state silence or state loss alone as protocol death. |
| INV-13 | Destroying current private keys never retroactively invalidates existing approval or acceptance evidence; a latent successor prevents a death conclusion. |

## 6. Priority and gate policy

Phases are ordered. A phase may begin experimentally, but it is not considered complete and may not support a public claim until all its exit criteria pass.

- **P0–P4: Foundational critical path.** Failure invalidates the central MortalOS claim.
- **P5–P7: Network embodiment.** Required for a convincing browser demonstration.
- **P8–P9: First organs and AI interface.** Valuable only after the lifecycle is sound.
- **P10: Submission and reproducibility.** Converts the prototype into verifiable evidence.

## 7. OpenAI Build Week delivery path

The live Devpost data was checked on 2026-07-14. The project is registered and has a submission draft in the **Developer Tools** category. The canonical submission deadline is:

```text
2026-07-22T00:00:00Z
2026-07-21 17:00 Pacific Time
2026-07-22 09:00 Korea Standard Time
```

One announcement incorrectly labels July 21 as Monday; the official rules, overview, ISO timestamp, and 2026 calendar identify it as Tuesday. The ISO timestamp is the operational source of truth. See [`DEVPOST_COMPLIANCE.md`](DEVPOST_COMPLIANCE.md) for the complete evidence matrix and source conflicts.

The long-term roadmap is too large for one Build Week. The submission must implement this thin vertical slice instead of attempting WebRTC, general computation, circulating model weights, or a full OS.

### H0 — Compliance, provenance, and reproducibility

**Gate result:** PASS on 2026-07-14. Apache-2.0, provenance, clean-room commands, secret hygiene, dependency audit, and GitHub Actions are verified.

**Goal:** remove administrative and judgeability blockers before feature work hides them.

**Deliverables**

- explicit open-source license selected by the repository owner;
- README with installation, supported platforms, test command, architecture boundary, Codex collaboration, and GPT-5.6 status;
- public build timeline distinguishing work produced after the submission period opened;
- CI that runs from a clean checkout;
- Devpost compliance matrix and submission checklist;
- zero known high or critical dependency vulnerabilities, with moderate findings either fixed or documented.

**Strict gate**

- [x] The public repository contains the exact Apache License 2.0 text in `LICENSE`, and package metadata declares `Apache-2.0`.
- [x] All current repository work is traceable to commits made after the submission period opened; future work must preserve dated commits and Codex session evidence.
- [x] GitHub Actions `Verify` run 13 passes from commit `b459485d3109e99ddb3e958c6108a50580074d1e` using clean checkout, locked install, full tests, coverage enforcement, and dependency audit.
- [x] README `npm ci`, `npm test`, and coverage instructions pass in a clean-room copy with no pre-existing `node_modules`.
- [x] No secret, personal token, API key, or private signing key is present in the H1/H2 source, public vectors, or generated trace; vectors contain public verification material only. Git-history scanning remains part of the final H5 freeze.

### H1 — Deterministic protocol core ✅ VERIFIED

**Gate result:** PASS on 2026-07-14. Evidence: [`H1_H2_VERIFICATION_REPORT.md`](H1_H2_VERIFICATION_REPORT.md), `src/`, `test/`, and the enforced npm gates.

**Goal:** implement the smallest non-trivial Developer Tools artifact: a reusable pure validator and trace runner.

**Required subset:** P1 plus the essential signature/quorum mechanisms from P2.

**Strict gate**

- [x] Raw input parsing detects duplicate JSON properties before ordinary object parsing can erase them.
- [x] Genesis and Pulse validation uses exact canonical bytes and the mandatory event-payload sidecar.
- [x] Real Ed25519 signatures authorize `2-of-3`; `0-of-3`, `1-of-3`, duplicate, replayed, and mutated evidence fail with stable codes.
- [x] Two fresh processes return byte-identical results for the same conformance corpus.
- [x] A fixed-seed corpus of 10,000 adversarial trace continuations preserves `INV-1` through `INV-6`, `INV-11`, and v0 state-root immutability; failures print seed and case.
- [x] Validator branch coverage is **91.58%** and line coverage is **98.97%**, enforced by `npm run test:coverage`.

### H2 — Minimum Viable Life scenario ✅ VERIFIED

**Gate result:** PASS on 2026-07-14. `npm run demo:trace` emits deterministic JSON with SHA-256 `7b3046231a61f7b21882b02b67114941daccb3e4fb8b2fee745ab0e16de45ab7`.

**Goal:** prove the distinctive claim in one replayable command before building a UI.

**Required scenario**

```text
birth {A,B,C}
-> handoff {B,C,D}
-> handoff {C,D,E}
-> handoff {D,E,F}
-> drain and enumerate pending authorization artifacts
-> destroy authority below quorum
-> reject same-lineage successor from public snapshot
-> create clone with a different organism_id
```

**Strict gate**

- [x] `npm run demo:trace` executes the entire scenario without network or model access.
- [x] All original custodians are absent while the organism ID remains unchanged.
- [x] The dead-lineage public-snapshot continuation attempt fails with `E_APPROVAL_INSUFFICIENT_QUORUM` and deterministic detail `0/2`.
- [x] A complete pre-authorized child is independently verified, remains valid after current-key loss, and is accepted before death is declared.
- [x] State loss with live quorum is shown as `state_stalled`, never as v0 protocol death.
- [x] The same-genome clone receives a different `organism_id`.
- [x] The trace is deterministic JSON; two fresh processes emit byte-identical output.

### H3 — Judgeable MortalOS Lab experience

**Goal:** turn the protocol into a coherent developer tool rather than a terminal-only proof.

MortalOS Lab should let a developer run, inspect, mutate, and replay lifecycle scenarios. The primary judge path is one button that runs the H2 trace and exposes every signature, state root, custody change, and rejection reason.

**Strict gate**

- [ ] A judge can test the project without rebuilding it from source, through a hosted demo, sandbox, or prepared test path.
- [ ] The same pure validator used by tests is the only component that can accept a transition.
- [ ] The UI visibly distinguishes `continuable`, `state-stalled`, `dormant`, `partitioned`, `forked`, and `dead under v0 assumptions`.
- [ ] The required demo sequence completes three consecutive times in a clean browser profile.
- [ ] Unsupported browsers and platforms are stated explicitly.

### H4 — GPT-5.6 adversarial scenario designer

**Goal:** use GPT-5.6 in a way that strengthens the Developer Tools product without entering the trusted computing base.

GPT-5.6 will translate a natural-language failure experiment into a schema-constrained scenario proposal and explain the deterministic validator result. A local or replaceable proposal proxy may protect the OpenAI API key, but it must hold no custodian authority and no canonical state.

**Strict gate**

- [ ] The actual submitted build invokes GPT-5.6 for scenario generation or explanation; a label alone is insufficient.
- [ ] Model output passes a strict scenario schema before reaching the simulator.
- [ ] The deterministic validator independently accepts or rejects every proposed step.
- [ ] Removing or disabling GPT-5.6 leaves H1–H3 correct and manually operable.
- [ ] No OpenAI API key appears in browser code, logs, fixtures, screenshots, video frames, or Git history.
- [ ] The demo includes one useful model proposal and one model proposal rejected by protocol rules.

### H5 — Evidence, freeze, and submission

**Goal:** maximize evidence per second and satisfy every Devpost field before the deadline.

**Strict gate**

- [ ] A public YouTube video is under three minutes and includes clear audio covering what was built, how Codex was used, and how GPT-5.6 was used.
- [ ] README records where Codex accelerated work and where the user made key product, engineering, and design decisions.
- [ ] The `/feedback` Codex Session ID for the thread containing most core functionality is captured.
- [ ] Devpost contains the repository URL, Developer Tools category, installation/platform/testing instructions, and a free judge test path.
- [ ] All English-language submission materials accurately match the running build and video.
- [ ] The submission is no longer a draft.
- [ ] The demo remains available free of charge through the later of the two published judging-end dates; conservatively, keep it available through `2026-08-10T00:00:00Z`.

### Internal delivery schedule

| KST date | Required outcome |
|---|---|
| July 14 | Correct P0, close repository/compliance gaps, freeze the H1 interface. |
| July 15–16 | H1 validator, real signatures, deterministic corpus, and local coverage gate completed early on July 14; remote CI confirmation remains. |
| July 17 | H2 turnover/death/resurrection-rejection/clone trace completed early on July 14. |
| July 18 | Complete H3 judge experience and hosted test path. |
| July 19 | Complete H4 GPT-5.6 path and safety tests. |
| July 20 | Freeze features; write README/story and record the first complete video. |
| July 21, 18:00 | Internal submission deadline, leaving a 15-hour buffer. |
| July 22, 09:00 | Official submission deadline; no plan should rely on this final hour. |

## 8. Long-term phased implementation plan

### P0 — Operational semantics and threat model ✅ CORRECTED AND REVERIFIED

**Gate result:** PASS after a second adversarial review on 2026-07-14. The review corrected event-payload context, nonce freshness semantics, authority/state availability separation, latent-successor semantics, unspecified genome execution, and the redundant repair event. See [`P0_VERIFICATION_REPORT.md`](P0_VERIFICATION_REPORT.md).

**Goal**

Turn birth, identity, pulse, continuity, state stall, fork, dormancy, death, extinction, clone, and descendant into unambiguous protocol terms.

**Deliverables**

- `docs/PROTOCOL.md`
- `docs/THREAT_MODEL.md`
- message schemas for Genesis and Pulse
- canonical event-payload sidecar rules
- enumerated validation rejection codes
- invariant-to-test traceability table

**Strict exit criteria**

- [x] Every lifecycle term has a necessary and sufficient operational definition.
- [x] Death is defined as loss of recognized succession capability, not as an unverifiable claim that every bit was deleted.
- [x] Dormancy, partition, and death are explicitly distinguishable in the model, including cases where an observer cannot know which occurred.
- [x] The canonical encoding and hash domain-separation rules are specified.
- [x] Every field in Genesis and Pulse has a validation rule.
- [x] Every invariant `INV-1` through `INV-13` maps to at least one planned automated test.
- [x] No later phase is required to explain whether a candidate pulse is valid.
- [x] Nonce randomness is a producer obligation, not a globally unverifiable validator predicate.
- [x] Authority viability, state viability, state stall, and v0 protocol death are non-contradictory.
- [x] Every Pulse requires the exact canonical event payload committed by its `payload_hash`.
- [x] Key destruction is distinguished from latent, already-authorized succession.
- [x] v0 has no implementation-specific genome callback or state-transition event.

**Gate failure condition**

If two conforming readers can legitimately disagree on validity from the same input, P0 fails.

---

### P1 — Deterministic lifecycle state machine ◐ REFERENCE CORE IMPLEMENTED

**Current result:** the Build Week H1 subset is executable and verified. Remaining full-P1 work is an implementation-independent serialized corpus, exhaustive committed-byte mutation coverage, and an independent second implementation; these do not block H3.

**Goal**

Implement protocol validity as a pure library with no browser, networking, UI, storage, or AI dependency.

**Deliverables**

- duplicate-aware raw UTF-8/JSON parser plus RFC 8785 canonical encoder/decoder
- Genesis and Pulse types
- canonical event-payload sidecar parser and hash verifier
- pure `validate` function
- deterministic fixture generator
- unit and property-based tests

**Strict exit criteria**

- [x] Repeated validation of identical bytes produces byte-identical trace results across two fresh processes.
- [x] Unknown fields, missing fields, malformed encodings, and non-canonical encodings are rejected deterministically.
- [x] Duplicate JSON properties are rejected before conversion into ordinary language objects.
- [ ] A one-bit mutation of any committed field is rejected.
- [x] A missing, non-canonical, duplicate-key, non-object, or substituted event payload is rejected with the specified first error code.
- [x] `state-transition` is rejected as unsupported and every accepted v0 Pulse preserves the parent state root.
- [x] Sequence gaps, incorrect parent hashes, wrong organism IDs, and unauthorized membership changes are rejected.
- [ ] A repeated byte-identical Genesis is treated as the same birth; nonce freshness is never guessed from local history.
- [x] At least 10,000 fixed-seed adversarial trace continuations run without violating `INV-1` through `INV-6` and `INV-11`.
- [x] Any failing generated case reports its fixed seed, case number, and mutation class.
- [x] Validator branch coverage is 91.58%; the two uncovered schema-mapping branches are documented in the H1/H2 verification report.

**Gate failure condition**

Any nondeterministic validation result, payload/context ambiguity, duplicate-property acceptance, or unreproducible failing trace blocks P2.

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

Prove authority-level protocol mortality: once current continuation authority is irrecoverably below threshold under the v0 assumptions, historical public data cannot continue the same recognized lineage. Separately prove that state loss alone is reported as `state-stalled` in v0.

**Deliverables**

- volatile authority lifecycle
- local expiry and key-destruction behavior
- death and dormancy test fixtures
- state-stalled fixture with quorum authority still present
- latent-successor fixtures with delayed complete and partially complete authorization evidence
- clone-from-genome operation that creates a new Genesis

**Strict exit criteria**

- [ ] After all current authority below quorum is destroyed, no available test actor can produce an accepted successor pulse.
- [ ] A complete public snapshot of Genesis, pulses, and state data is insufficient to advance the dead lineage.
- [ ] Loading a historical snapshot cannot roll back a later recognized pulse.
- [ ] Creating from the same genome and state produces a different `organism_id`.
- [ ] The UI and API label this result as a clone or descendant, never as the original lineage resumed.
- [ ] Tests explicitly document that a malicious client may persist keys, which is outside the v0 threat model.
- [ ] Temporary message silence alone is not asserted as globally proven death.
- [ ] Loss of state with a still-usable quorum is labeled `state-stalled`; a heartbeat does not claim state recoverability.
- [ ] A fully signed delayed child, or a membership change completable without new current-quorum signatures, prevents a death conclusion.

**Gate failure condition**

If public historical data alone can create new authority, if latent authorization is ignored, or if state loss is presented as v0 protocol death, the foundational mortality claim fails.

---

### P5 — Self-repair and partition behavior

**Goal**

Make maintenance an active policy: the entity monitors viable custodian redundancy and proposes an ordinary `membership-change` Pulse while sufficient peers remain. `repair` is not a separate consensus event kind.

**Deliverables**

- pulse leases and refresh events
- peer health observations
- deterministic repair-policy proposals expressed as membership changes
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

This phase must define a deterministic genome ABI/runtime and introduce state transition through an explicit protocol-version decision. An implementation-specific callback is not a consensus rule.

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
- [ ] Falling below the recovery threshold is reported as state-stalled unless this phase introduces a versioned, verifiable state-availability rule and updates the threat model.
- [ ] Reconstructed content matches its committed state root byte-for-byte.
- [ ] No process can access browser capabilities absent from its declared capability set.
- [ ] Lifecycle correctness remains valid with the actor disabled or crashed.

**Gate failure condition**

If actor migration corrupts lineage state, the actor becomes an authority over protocol validity, or the implementation silently changes v0 death semantics, P8 fails.

---

### P9 — GPT-5.6 interpretive control layer

**Goal**

Use GPT-5.6 meaningfully without making probabilistic AI part of the trusted computing base.

**Permitted role**

- translate a human request into a schema-constrained lifecycle proposal;
- explain current network health, quorum, lineage, fork, and mortality risks;
- generate proposed failure experiments and human-readable reports.

For the Build Week submission, H4 implements a narrow early slice of this phase. API access MUST use a local or replaceable non-authoritative proposal boundary; a browser bundle MUST NOT contain an API key.

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

**Full evidence sequence**

1. Birth with three peers.
2. Display organism ID and current pulse head.
3. Replace every original peer through valid handoffs.
4. Show the same identity after complete substrate turnover.
5. Remove one peer and show repair policy proposing a membership change.
6. Lose continuity authority below quorum.
7. Show that a public snapshot cannot continue the dead lineage.
8. Create a clone and show its new organism ID.
9. Show GPT-5.6 proposing or explaining a lifecycle action without bypassing validation.

**Strict exit criteria**

- [ ] A clean clone of the public repository installs and runs using documented commands.
- [ ] All automated tests pass from a clean environment.
- [ ] The live demo completes the required sequence three consecutive times.
- [ ] A relevant open-source license is attached to the public repository.
- [ ] The public YouTube video is less than three minutes, shows actual working software, and has audio covering the project, Codex use, and GPT-5.6 use.
- [ ] The repository contains architecture, protocol, threat-model, test, and run documentation.
- [ ] README includes setup, supported platforms, sample data if needed, a judge test path, Codex collaboration, key human decisions, and GPT-5.6 usage.
- [ ] The `/feedback` Codex Session ID containing most core functionality is entered in Devpost.
- [ ] A hosted demo, sandbox, or equivalent test path lets judges evaluate the developer tool without rebuilding it.
- [ ] English project text, testing instructions, and narration accurately match the submitted build.
- [ ] Every public claim maps to a test, code path, or visible demonstration.
- [ ] Known limitations explicitly include honest-peer assumptions, browser volatility, signaling infrastructure, and the impossibility of proving malicious copies were erased.
- [ ] No secret, API key, personal token, or private key appears in Git history or client bundles.

**Gate failure condition**

If the central continuity-and-mortality sequence cannot be reproduced, the Devpost draft is incomplete, or any required evidence above is absent, the project is not submission-ready.

## 9. Test matrix required before expanding scope

| Scenario | Expected result |
|---|---|
| 2 valid approvals in 2-of-3 | Accept successor |
| 1 valid approval in 2-of-3 | Reject insufficient quorum |
| Duplicate approval from one key | Count once; reject if below quorum |
| Mutated state after signing | Reject signature/commitment mismatch |
| Missing or substituted event-payload sidecar | Reject required/invalid/mismatch code |
| Old pulse replay | Reject stale sequence or recognized ancestry |
| New peer signs before activation | Reject unauthorized signer |
| Removed peer signs later pulse | Reject unauthorized signer |
| Safe A/B/C to D/E/F turnover | Preserve organism ID and lineage |
| Minority network partition | Stall; do not advance |
| Quorum partition | Advance under current rule; reconcile safely |
| Below-quorum authority loss | No valid successor |
| Public snapshot after death | Readable but unable to continue lineage |
| State unavailable while quorum keys remain | Report state-stalled, not protocol-dead |
| Clone from same genome/state | New organism ID |
| Invalid GPT-generated action | Reject before state mutation |

## 10. Metrics

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
- **Devpost judge path:** one documented path that works without rebuilding.
- **Submission evidence:** `100%` of required Devpost fields mapped to a repository, video, demo, or form artifact.

## 11. Scope expansion after the first proof

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

## 12. Definition of foundational success

MortalOS has passed its foundational milestone only when this statement is demonstrated and reproducible:

> Every original host is gone, yet one authorized identity and lineage remain alive. After the live continuation threshold is irreversibly lost under the stated threat model, historical data cannot continue that same lineage; it can only begin a new one.
