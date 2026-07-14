# MortalOS Implementation Plan

Status: **core trust boundary and stateful lineage gate verified; portable browser core is next**  
Last reviewed: **2026-07-14**  
Deadline source last checked: Devpost at **2026-07-14T10:06:54Z**

## 1. Review decision

The prior plan marked H1 complete while the public `validatePulse` API still trusted cloneable plain objects as accepted Genesis/parent context and had no accepted-object graph for replay or fork detection. A caller could clone an accepted result and have it trusted. The protocol specification promised ancestry, replay, and fork checks that the implementation did not perform.

That gap is now closed in the Node.js reference core:

- accepted contexts are recursively frozen and carry a non-cloneable in-process capability;
- `createLineage` reconstructs parent context from accepted raw ancestry;
- exact replay returns `E_REPLAY_STALE`;
- independently valid siblings produce `E_FORK_DETECTED` plus intersecting signer evidence;
- a forked lineage refuses automatic advancement;
- mortality evaluation accepts actual validated direct-child candidates instead of an asserted count; and
- the documented rejection-code set is generated from the same source manifest used by the implementation gate.

The priority order changes accordingly:

1. **C1 portable deterministic core** — the current Node-only implementation cannot power a browser judge experience without duplicating consensus logic.
2. **H3 browser MortalOS Lab** — required for a coherent, no-rebuild judge path.
3. **H4 GPT-5.6 adversarial scenario designer** — required by Build Week, outside the trusted computing base.
4. **H5 evidence and submission freeze** — required before the deadline.
5. **R2 state-bearing life kernel** — the next fundamental research milestone; it must precede claims of a living OS, distributed memory, or ownerless computation.

WebRTC, resource accounting, distributed inference, and general OS facilities remain below these gates.

## 2. Two synchronized paths

MortalOS has two legitimate but different critical paths:

- the **Build Week delivery path** (`H0`, `C0`, `C1`, `H3`–`H5`) produces a runnable Developer Tools submission before the deadline; and
- the **research path** (`R0`–`R6`) turns authority continuity into a state-bearing, network-embodied digital life.

Delivery urgency may reorder calendar work, but it must never allow UI, GPT, transport, or hosting infrastructure to become validity authority.

## 3. Root problem and current boundary

The root question remains:

> Can a digital entity preserve one recognized identity and valid state lineage while every physical host is replaceable and no single peer owns continuation authority—and can that lineage become unable to continue when its live threshold is irreversibly lost?

The current v0 core answers only the **identity and authority-lineage** portion. It does not yet establish a state-bearing life because `state_root` is immutable and no genome executes.

The model distinguishes:

- **data persistence:** some bytes still exist;
- **identity continuity:** a candidate is an authorized successor of the same Genesis;
- **authority viability:** a current quorum can authorize another Pulse;
- **state viability:** the committed logical state can be reconstructed and executed;
- **operational life:** both authority and state are viable;
- **state stall:** authority survives but state is unavailable;
- **latent succession:** a validated, already-authorized child may survive current-key loss; and
- **v0 protocol death:** authority is irreversibly below threshold, with no validated latent successor, under the controlled honest-ephemeral-key assumptions.

The phrase “MortalOS is alive” remains a research hypothesis until R2 and R3 add deterministic state transition and availability evidence.

## 4. Current verified baseline

| Capability | State | Evidence | Honest limitation |
|---|---|---|---|
| P0 operational semantics | Verified | `npm run verify:p0` | Specification proof is not implementation independence. |
| Apache-2.0 repository licensing | Verified | `LICENSE`, package metadata, `npm run verify:license` | Future data/model artifacts need separate review. |
| Duplicate-aware canonical input | Verified | codec tests plus RFC 8785 examples | Only the Node implementation exists. |
| Ed25519 and domain separation | Verified | RFC 8032 vector and signed lifecycle corpus | No threshold-signature scheme. |
| Transition verification | Verified | Genesis/Pulse conformance tests | Accepted capabilities are process-local by design. |
| Stateful lineage recognition | Verified | generated-key replay/fork/equivocation tests | No persistent database or Byzantine fork resolution. |
| H2 lifecycle trace v2 | Verified | `npm run verify:h2` | Mortality remains conditional on supplied observations. |
| Adversarial corpus | Verified | fixed-seed 10,000 invalid continuations | Not a generative corpus of arbitrary re-signed valid histories. |
| Critical-core coverage | Verified | aggregate branch coverage at least 90% | Coverage is not a security proof. |
| Local artifact/package boundary | Verified | private package plus Git/npm exclusions and package dry-run | A future public package needs an explicit export/support contract. |
| Browser Lab | Not started | — | Submission blocker. |
| GPT-5.6 runtime use | Not started | — | Submission blocker. |
| Mutable logical state/genome | Not started | — | Blocks a state-bearing life claim. |

## 5. Foundational invariants

| ID | Invariant |
|---|---|
| `INV-1` | One lineage preserves one Genesis-derived organism identity. |
| `INV-2` | Every accepted non-Genesis Pulse has exactly one validated parent. |
| `INV-3` | An unauthorized candidate cannot advance. |
| `INV-4` | Mutation of a committed or signed field invalidates the relevant evidence. |
| `INV-5` | Replay, rollback, and valid siblings cannot silently replace the recognized head. |
| `INV-6` | Custody changes only through current-quorum authorization and new-member acceptance. |
| `INV-7` | Complete safe custodian turnover preserves identity. |
| `INV-8` | A below-threshold group cannot advance. |
| `INV-9` | A clone without lineage authority has a different identity. |
| `INV-10` | GPT, UI, transport, storage, and signaling never define validity. |
| `INV-11` | Semantic validation uses the exact canonical event payload committed by the Pulse. |
| `INV-12` | Authority availability and state availability are reported separately. |
| `INV-13` | Key destruction does not revoke previously created authorization evidence. |

## 6. Build Week delivery path

### H0 — Compliance and provenance ✅

Goal: maintain an eligible, licensed, reproducible public project.

Pass criteria:

- [x] Apache-2.0 text and metadata agree.
- [x] Locked clean installation and GitHub Actions run the same gates.
- [x] Public vectors contain no private signing material.
- [x] Build log distinguishes the pre-existing idea from in-period implementation.
- [x] The private package dry-run excludes uploads, tool state, environment files, logs, and archives.
- [ ] Final history, bundle, screenshots, and video frames pass a secret scan.
- [ ] `/feedback` Session ID and final third-party inventory are recorded.

### C0 — Trusted Node reference core ✅

Goal: provide one deterministic reference implementation whose trust boundary matches the protocol claim.

Pass criteria:

- [x] Hand-built or cloned acceptance objects fail closed.
- [x] Accepted results and their nested descriptors are immutable.
- [x] Parent lookup comes from an accepted-object graph, not caller-supplied plain state.
- [x] Exact replay is rejected.
- [x] Two valid siblings put the lineage in `FORKED` and expose intersecting signer evidence.
- [x] A forked lineage refuses automatic advancement.
- [x] A no-op `membership-change` is rejected.
- [x] Latent-successor mortality input is a validated direct child, not an integer assertion.
- [x] Documentation and the executable rejection-code manifest match exactly.
- [x] Envelope/payload byte limits and JSON depth limits reject resource-exhaustion inputs deterministically.
- [x] H2 trace v2 is byte-identical across fresh processes.

Failure rule: any path that accepts a fabricated context, silently selects a fork, or declares death from an unverified latent-successor count reopens C0.

### C1 — Portable deterministic core ⏭ NEXT

Goal: run the same consensus logic in Node.js and Chromium without maintaining two subtly different validators.

Deliverables:

- platform-neutral byte, base64url, SHA-256, and Ed25519 interfaces;
- Node and Web Crypto adapters;
- browser-compatible schema-validation loading;
- a serialized language-independent conformance corpus containing canonical input bytes and expected result objects;
- a headless Chromium differential runner; and
- a documented import boundary that keeps `node:*`, `Buffer`, filesystem, and process APIs outside portable modules.

Strict pass criteria:

- [ ] Portable modules contain no `node:*`, `Buffer`, filesystem, process, DOM, network, clock, or random input in validation paths.
- [ ] Node and Chromium return byte-identical results for every committed positive and negative vector.
- [ ] RFC 8785 primitive, number, string, and UTF-16 ordering vectors pass in both runtimes.
- [ ] RFC 8032 Ed25519 vector 1 and every MortalOS signature vector pass in both runtimes.
- [ ] The forged-context, replay, fork, equivocation, no-op membership, and latent-successor tests pass in both runtimes.
- [ ] At least 10,000 serialized fixed-seed cases are replayable from a printed seed and case ID.
- [ ] Clean Node install and a clean headless Chromium run both pass in CI.
- [ ] No platform adapter can override a validity decision or canonical bytes.

Failure rule: one Node/Chromium result mismatch blocks H3. Do not copy the Node validator into UI code as a workaround.

### H3 — MortalOS Lab browser experience

Goal: make the verified lifecycle understandable and testable without rebuilding from source.

Required judge path:

```text
open Lab
  -> run signed reference lifecycle
  -> inspect identity/custody/parent/evidence timeline
  -> replay or mutate one artifact
  -> see stable rejection or fork evidence
  -> export deterministic trace
```

Strict pass criteria:

- [ ] A public URL loads without credentials or payment.
- [ ] One action runs birth → turnover → replay rejection → controlled death → resurrection rejection → clone.
- [ ] The UI labels assumptions and never converts silence into death.
- [ ] A fork fixture visibly halts advancement and shows both child hashes and equivocating key IDs.
- [ ] The displayed result is the portable core result; the UI has no alternative validator.
- [ ] Exported trace bytes and digest match the CLI/reference result.
- [ ] The complete judge path succeeds three times in a clean browser profile.
- [ ] Keyboard navigation, readable contrast, narrow viewport, and reduced-motion behavior are checked.
- [ ] Unsupported platforms and current limitations are visible.

### H4 — GPT-5.6 adversarial scenario designer

Goal: use GPT-5.6 for a task that materially improves the developer tool while keeping model output untrusted.

Flow:

```text
developer failure hypothesis
  -> GPT-5.6 structured scenario proposal
  -> strict scenario schema
  -> deterministic fixture compiler/simulator
  -> portable validator
  -> trace and explanation grounded in stable codes
```

Strict pass criteria:

- [ ] The submitted build invokes GPT-5.6 in the demonstrated path.
- [ ] Model output is parsed only through a strict allowlisted schema with size limits.
- [ ] GPT cannot supply an accepted context, private key, final validity result, or recognized head.
- [ ] Invalid or incomplete model proposals fail closed and remain editable.
- [ ] At least 25 fixed adversarial prompts cover malformed JSON, invented fields, forged authority, prompt injection, impossible transitions, and overclaiming death.
- [ ] The same compiled scenario has the same result with GPT disabled.
- [ ] No OpenAI key appears in browser code, logs, artifacts, screenshots, or Git history.
- [ ] The README and video distinguish Codex-assisted development from GPT-5.6 runtime behavior.

### H5 — Evidence and submission freeze

Goal: submit a reproducible working project, not a narrative promise.

Strict pass criteria:

- [ ] GitHub repository description and Devpost tagline describe only the implemented scope and no longer claim a browser OS or equate network disappearance with protocol death.
- [ ] Project Story describes only demonstrated capabilities.
- [ ] Public repository URL, Apache-2.0 license, setup instructions, supported platforms, sample data, and no-rebuild test URL are present.
- [ ] Public YouTube video is under three minutes, shows the working product, and includes audio explaining both Codex and GPT-5.6 use.
- [ ] `/feedback` Session ID is present.
- [ ] The exact deployed commit passes all CI, dependency, license, link, and secret gates.
- [ ] The final judge path succeeds from a logged-out clean browser.
- [ ] Submission is no longer `submission_draft` before the internal deadline.

Operational deadline: **2026-07-21 18:00 KST**, fifteen hours before the official `2026-07-22T00:00:00Z` cutoff.

## 7. Research path

### R0 — Operational meaning ✅

Birth, identity, Pulse, lineage, head, fork, state stall, dormancy, death, extinction, clone, and descendant have operational v0 definitions. The threat model explicitly limits mortality claims.

### R1 — Ownerless authority lineage ◐

The Node reference path now proves quorum authorization, complete custodian turnover, replay rejection, fork visibility, clone separation, and conditional authority death. R1 remains incomplete until C1 supplies cross-runtime conformance and an independent serialized corpus.

Exit criteria beyond C1:

- [ ] A second independently written implementation consumes the corpus without importing reference code.
- [ ] Both implementations agree on every result and first rejection code.
- [ ] Generative valid-history tests cover competing signed siblings, churn, delayed evidence, and arbitrary safe handoffs.
- [ ] Persistent replay reconstructs the same graph and fork state after restart.

### R2 — State-bearing life kernel ⏭ FUNDAMENTAL RESEARCH NEXT

Goal: make a Pulse represent an actual deterministic state transition, not only an authority/membership event.

This requires a new protocol version rather than silently changing `mortalos/0`.

Deliverables:

- a minimal deterministic genome ABI;
- canonical event input and deterministic transition output;
- content-addressed state blocks and a reproducible `state_root`;
- resource ceilings, capability declarations, and deterministic failure codes; and
- a reference program small enough to verify exhaustively.

Strict pass criteria:

- [ ] Two independent runtimes compute identical next-state bytes and roots for every vector.
- [ ] Every accepted state-changing Pulse proves `next_state_root = transition(genome, prior_state, event)`.
- [ ] Missing blocks, nondeterminism, floating-point differences, clock/random access, and capability violations fail closed.
- [ ] At least 10,000 valid and invalid transitions replay identically from fixed seeds.
- [ ] A state mutation without authority and an authorized transition with wrong state output both fail.
- [ ] The reference life performs a small persistent behavior that survives complete custodian turnover.

Failure rule: until R2 passes, describe MortalOS as a lifecycle protocol, not a running OS or autonomous data life.

### R3 — State availability and recovery

Goal: separate “a state root exists” from “enough participants can reconstruct and execute the state.”

Strict pass criteria:

- [ ] State is split/replicated under a documented recovery threshold.
- [ ] Recovery succeeds after any loss pattern inside the declared fault budget.
- [ ] Availability claims are backed by verifiable possession/retrieval challenges, not peer self-report.
- [ ] Authority-viable/state-stalled/dead classifications remain distinct under partition and delayed blocks.
- [ ] A fully authorized transition cannot advance from unavailable prior state unless the versioned protocol explicitly permits it.

### R4 — Browser network embodiment

Goal: move the same state-bearing protocol across replaceable browser peers.

Order:

1. multiple local contexts with deterministic virtual transport;
2. `BroadcastChannel` multi-tab churn;
3. WebRTC across devices with replaceable signaling; and
4. partition/healing and durable graph reconstruction.

Transport may deliver bytes but never select accepted state.

### R5 — Resource-sharing organs

Only after R2–R4 pass may MortalOS add sandboxed tasks, storage contribution, bandwidth accounting, WebGPU, scheduling, or incentives. Resource contribution must be capability-limited and must not confer identity ownership or unilateral authority.

### R6 — Ownerless model organ

A distributed model becomes plausible only after lineage, state, recovery, and execution are real. Model weights, inference state, and updates must be content-addressed and governed by the same deterministic transition boundary. “Nobody owns the model” is not established merely by splitting weights across peers.

## 8. P0 acceptance record

The following criteria remain normative and verified:

- [x] Every lifecycle term has a necessary and sufficient operational definition.
- [x] Death is defined as loss of recognized succession capability under explicit assumptions, not deletion of all bytes.
- [x] Dormancy, partition, and death are explicitly distinguishable in the model.
- [x] The canonical encoding and hash domain-separation rules are specified.
- [x] Every field in Genesis and Pulse has a validation rule.
- [x] Every invariant `INV-1` through `INV-13` maps to at least one planned automated test.
- [x] No later phase is required to explain whether a candidate pulse is valid.
- [x] Nonce randomness is a producer obligation, not a globally decidable validator predicate.
- [x] Authority viability, state viability, state stall, and v0 protocol death are non-contradictory.
- [x] Every Pulse requires the exact canonical event payload committed by its hash.
- [x] Key destruction is distinguished from latent, already-authorized succession.
- [x] v0 has no implementation-specific genome callback or state-transition event.

## 9. Global stop conditions

Stop and reopen the earliest responsible gate if any of the following occurs:

- a cloned or hand-built context is trusted as accepted;
- two platforms disagree on canonical bytes, signature validity, parent resolution, or first rejection code;
- a replay or fork changes the recognized head silently;
- the UI or GPT path can bypass deterministic validation;
- a death label relies only on silence, an unverifiable key-deletion claim, or an asserted pending count;
- mutable state is claimed without a versioned deterministic transition rule;
- signaling, hosting, or an API proxy becomes state or identity authority;
- a clean judge cannot run the submitted project without rebuilding; or
- public claims exceed executable evidence.

The next implementation task is **C1 portable deterministic core**, while the next fundamental research task is **R2 state-bearing life kernel**.
