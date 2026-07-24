# MortalOS v0/v1 requirements traceability

Status: **Normative v0 lifecycle plus v1 deterministic-state baseline with exact-head verification requirements**

This document maps every foundational invariant to protocol requirements, rejection
codes, and automated or planned tests. Transition, lineage, mortality, singleton,
Node/browser-target portability, actual Chromium, H2 evidence, and the H3A local
visual Lab are executable. Every changed review head must rerun the gate, and the
latest successful Verify run is the exact-head publication evidence. The H3B static
deployment contract and exact-source public Pages release are executable and
verified. The bounded `mortalos/1` state runtime is executable and cross-language
verified; R3 state availability/recovery and one unified durable participant network
remain open.

## 1. Test ID convention

```text
T-<phase>-<area>-<number>
```

Example: `T-P2-AUTH-003` is the third authorization test planned for P2.

## 2. Invariant traceability

| Invariant | Normative requirement | Rejection/result | Planned tests | Earliest phase |
|---|---|---|---|---|
| `INV-1` Identity never changes within one lineage. | Every Pulse `organism_id` equals the Genesis-derived ID. | `E_ORGANISM_ID_MISMATCH` | `T-P1-ID-001`, `T-P3-TURNOVER-001`, `T-P3-TURNOVER-004` | P1 |
| `INV-2` Every non-Genesis Pulse names exactly one valid parent. | Sequence 1 names Genesis digest; sequence n names accepted Pulse n-1. | `E_PARENT_REQUIRED`, `E_PARENT_HASH_MISMATCH`, `E_SEQUENCE_NOT_NEXT` | `T-P1-PARENT-001`, `T-P1-PARENT-002`, `T-P1-SEQUENCE-001` | P1 |
| `INV-3` Unauthorized Pulses are invalid. | Eligible unique current approvals meet parent-derived quorum. | `E_APPROVAL_SIGNER_INELIGIBLE`, `E_APPROVAL_INSUFFICIENT_QUORUM` | `T-P2-AUTH-001`, `T-P2-AUTH-002`, `T-P2-AUTH-003` | P2 |
| `INV-4` Mutation of a signed field invalidates approval. | Signatures bind domain-separated canonical Pulse or Genesis body hash. | Specific commitment mismatch or `E_APPROVAL_SIGNATURE_INVALID` | `T-P2-SIGN-001`, `T-P2-SIGN-002`, `T-P2-SIGN-003` | P2 |
| `INV-5` Older state cannot silently replace a newer recognized state. | Exact replay is rejected; a distinct valid sibling of a known ancestor causes `FORKED`. | `E_REPLAY_STALE`, `E_FORK_DETECTED`, `E_LINEAGE_ALREADY_FORKED` | `T-P1-REPLAY-001`, `T-P1-FORK-001`, `T-P5-PARTITION-003` | P1 |
| `INV-6` Membership changes only through a valid and activatable Pulse. | Current quorum authorizes, every added custodian accepts handoff, and retained approvers plus new acceptors cover the next threshold. | `E_ACCEPTANCE_MISSING`, `E_ACCEPTANCE_SIGNER_NOT_NEW`, `E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT`, `E_MEMBERSHIP_STATE_CHANGED` | `T-P3-HANDOFF-001`, `T-P3-HANDOFF-002`, `T-P3-HANDOFF-003`, `T-P3-ACTIVATION-001` | P3 |
| `INV-7` Complete safe custodian turnover preserves identity. | Handoffs change custody descriptor, never Genesis or organism ID. | `Accept` with unchanged `organism_id` | `T-P3-TURNOVER-001`, `T-P3-TURNOVER-002`, `T-P3-TURNOVER-RANDOM-001` | P3 |
| `INV-8` Below-quorum groups cannot advance. | Threshold is parent-derived; duplicate signatures count once. | `E_APPROVAL_DUPLICATE`, `E_APPROVAL_INSUFFICIENT_QUORUM` | `T-P2-AUTH-002`, `T-P2-AUTH-004`, `T-P5-MINORITY-001` | P2 |
| `INV-9` A clone without lineage authority has a new identity. | Clone creator samples a new Genesis nonce; a byte-identical Genesis is a replay, not a clone. | New `organism_id`; stale approvals rejected | `T-P1-NONCE-G-002`, `T-P4-CLONE-001`, `T-P4-CLONE-002`, `T-P4-SNAPSHOT-001` | P1 |
| `INV-10` AI, endpoint type, UI, and transport never define validity. | Only pure validator output accepts state; external layers submit bytes/proposals. | Protocol rejection code unchanged by source | `T-P6-UI-001`, `T-P7-TRANSPORT-001`, `T-P9-AI-001`, `T-P9-AI-002` | P6 |
| `INV-11` Semantic validation uses the exact event payload committed by the Pulse. | Canonical sidecar bytes are mandatory and their domain-separated digest equals `payload_hash`. | `E_EVENT_PAYLOAD_REQUIRED`, `E_EVENT_PAYLOAD_INVALID`, `E_EVENT_PAYLOAD_MISMATCH` | `T-P1-EVENT-002`, `T-P1-EVENT-003`, `T-P1-EVENT-004` | P1 |
| `INV-12` Authority availability and state availability are never conflated. | v0 state loss is `state-stalled`; death additionally requires irreversible below-quorum authority loss, an explicitly complete pending-evidence basis, and zero reconstructed latent successors. Missing completeness remains `authority_unavailable_not_proven_dead`. | Observer-state result; no death message | `T-P4-DEATH-001`, `T-P4-DEATH-BASIS-001`, `T-P4-LATE-EVIDENCE-001`, `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` | P4 |
| `INV-13` Destroying current private keys does not revoke previously created authorization evidence. | Public latent validation authenticates a supplied current quorum. Mortality recursively discovers target-tuple bodies and exact tagged signature values/property names throughout parsed declared envelope/payload trees, indexes declared payload roots as content-addressed sidecars, remaps signatures to eligible roles for each exact body, filters one early canonical usable-key snapshot through sign-once commitments, and—only after authority loss is declared irreversible—refuses death when a completion-capable membership body lacks its verified sidecar and no fresh quorum or verified latent child independently establishes non-death. | `latent successor / not dead`, `evidence_equivocation`, or conditional `evidence_payload_unavailable` observer result | `T-P4-LATENT-001`, `T-P4-LATENT-COMPLETION-001`, `T-P4-EVIDENCE-COALESCE-001`, `T-P4-EVIDENCE-POISON-001`, `T-P4-SIGN-ONCE-001`, `T-P4-PAYLOAD-OPAQUE-001`, `T-P5-DELAY-001` | P4 |
| `INV-14` Invalid Ed25519 point encodings never create identity or authority. | Public keys and signature `R` must be canonical prime-order subgroup points; `S` must be canonical. Peer-ID derivation rejects invalid points. | `E_PUBLIC_KEY_INVALID_POINT` or evidence-specific signature-invalid code | `T-P2-KEY-STRICT-001`, `T-P2-KEY-MIXED-001`, `T-P2-SIGN-R-001`, `T-P2-SIGN-S-001` | P2 |
| `INV-15` One validation operation observes one immutable input basis. | Intrinsic metadata and owned byte snapshots precede semantic use; SharedArrayBuffer and non-I-JSON values are rejected. Mortality trusts only honest Proxy-free ordinary own-data observer containers, reads fixed named fields and bounded indices without `ownKeys` or iterators, ignores unrelated properties as non-evidence, requires canonical usable-key IDs, rejects executable recognized fields, sparse indices, or foreign structure without invoking value getters, snapshots hostile bytes, verifies realm/dependency state and one constant-cost crypto checkpoint for every result including already-forked and pre-semantic resource-limit results, and treats every recognized acquisition, declared-byte parse, or internal failure as whole-operation uncertainty. | Parse/payload code, `E_VALIDATOR_INTERNAL`, or aborted observer classification | `T-P1-SNAPSHOT-001`, `T-P1-SAB-001`, `T-P1-IJSON-001`, `T-P1-IJSON-SLOT-001`, `T-P1-TOTAL-001`, `T-P4-LATENT-TOCTOU-001`, `T-P4-OBS-DATA-001`, `T-P4-CARRIER-UNCERTAINTY-001`, `T-P4-PRIMORDIAL-001`, `T-P4-DEPENDENCY-KAT-001`, `T-P4-BRAND-001` | P1 |
| `INV-16` Mortality never trusts a caller-selected head or infers evidence completeness from absence. | `Lineage` requires a module-private construction token; `Lineage#evaluateMortality` uses the graph-recognized current head, blocks reentrant mutation, reconstructs possible direct children from raw components, and requires an explicit complete evidence basis for death; strict siblings record a fork, while noncanonical multi-body evidence remains unclassified without graph mutation. | Observer `forked`, `evidence_equivocation`, `evidence_payload_unavailable`, or conditional mortality result | `T-P4-HEAD-SCOPE-001`, `T-P4-CONSTRUCTOR-001`, `T-P4-PENDING-RAW-001`, `T-P4-PENDING-FORK-001`, `T-P4-REPAIRABLE-FORK-001`, `T-P4-FORK-UNCLASSIFIED-001`, `T-P4-REENTRANCY-001`, `T-P4-DEATH-BASIS-001`, `T-P4-LATE-EVIDENCE-001` | P4 |
| `INV-17` Multi-fault inputs have one runtime-independent first result. | Schema errors are normalized by explicit precedence and pointer/keyword order; semantic version/algorithm checks follow canonical encoding. | Stable first rejection code | `T-P1-PRECEDENCE-001`, `T-P1-PRECEDENCE-002`, `T-C1-DIFF-001` | P1 |
| `INV-18` Resource pressure never turns a partial mortality observation into classification. | Seven whole-operation limits cover usable IDs/characters, pending records/bytes, target-body occurrences/canonical bytes, and conservative signature work. Candidate occurrences reserve before JCS and bytes before retention. The 1,152 signature ceiling admits the maximum 16-current/16-new transition at 1,088 units with 64 units of headroom; three identical complete carriers consume the exact boundary and a fourth is frozen, unclassified, graph-atomic, and retryable. | `indeterminate / limit_exceeded`; no graph mutation | `T-P4-LIMIT-001`, `T-P4-LIMIT-PRECEDENCE-001`, `T-P4-CANDIDATE-AMPLIFICATION-001`, `T-C1-DIFF-LIMIT-001` | P4 |

`INV-15`'s pre-semantic limit checkpoint explicitly includes drift caused during the
bounded observer acquisition that reaches the limit; the exact Proxy-poison probe
must abort without returning `limit_exceeded` or mutating the lineage graph.

## 3. Specification-baseline traceability

| Baseline criterion | Evidence |
|---|---|
| Every lifecycle term has a necessary and sufficient operational definition. | `PROTOCOL.md` section 4. |
| Death is succession-capability loss, not unprovable universal byte deletion. | `PROTOCOL.md` 4.19 and `THREAT_MODEL.md` section 9. |
| Authority, state viability, state stall, dormancy, partition, latent succession, and death are explicitly distinguishable. | `PROTOCOL.md` 4.10–4.19 and section 10. |
| Canonical encoding and hash domain separation are specified. | `PROTOCOL.md` sections 2 and 3. |
| Every Genesis and Pulse field has a validation rule. | `PROTOCOL.md` sections 6.1 and 7.1 plus JSON Schemas. |
| Every invariant maps to at least one planned automated test. | Invariant table in this document maps `INV-1` through `INV-18`. |
| Later phases are not required to decide envelope/lifecycle validity. | `PROTOCOL.md` sections 8 and 9; v0 has no implementation-specific genome callback. |
| One reference validator produces the same first result reproducibly. | The committed expected result, direct Node execution, and isolated browser-target bundle agree locally for portable corpus v4. Actual Chromium must agree for the exact PR head in CI. An independently written non-JavaScript verifier over canonical operation/result wire bytes remains the R1 gate. |

## 4. Message-field traceability

### 4.1 Genesis

| Field | Schema | Semantic rule | Negative test reservation |
|---|---|---|---|
| `kind` | Genesis schema | Protocol 6.1 | `T-P1-SCHEMA-G-001` |
| `body.protocol_version` | Genesis schema | Protocol 6.1 | `T-P1-VERSION-G-001` |
| `body.hash_algorithm` | Genesis schema | Protocol 6.1 | `T-P1-ALGO-G-001` |
| `body.signature_algorithm` | Genesis schema | Protocol 6.1 | `T-P1-ALGO-G-002` |
| `body.genome_hash` | Genesis schema | Protocol 6.1 | `T-P1-HASH-G-001` |
| `body.initial_state_root` | Genesis schema | Protocol 6.1 | `T-P1-HASH-G-002` |
| `body.initial_custodians` | Genesis schema | Protocol sections 2.3, 5, and 6.1 | `T-P1-CUSTODY-G-001`, `T-P2-KEY-STRICT-001` |
| `body.initial_quorum` | Genesis schema | Protocol sections 5 and 6.1 | `T-P1-QUORUM-G-001` |
| `body.nonce` | Genesis schema | Protocol 4.5 and 6.1 | `T-P1-NONCE-G-001`, `T-P1-NONCE-G-002` |
| `approvals` | Genesis schema | Protocol 4.4 and 6.1 | `T-P2-AUTH-G-001` |

### 4.2 Pulse

| Field | Schema | Semantic rule | Negative test reservation |
|---|---|---|---|
| `kind` | Pulse schema | Protocol 7.1 | `T-P1-SCHEMA-P-001` |
| `body.protocol_version` | Pulse schema | Protocol 7.1 | `T-P1-VERSION-P-001` |
| `body.organism_id` | Pulse schema | Protocol 4.5 and 7.1 | `T-P1-ID-001` |
| `body.sequence` | Pulse schema | Protocol 4.7 and 7.1 | `T-P1-SEQUENCE-001` |
| `body.parent_hash` | Pulse schema | Protocol 4.7 and 7.1 | `T-P1-PARENT-001` |
| `body.genome_hash` | Pulse schema | Protocol 4.3 and 7.1 | `T-P1-GENOME-001` |
| `body.current_custody_hash` | Pulse schema | Protocol 3 and 7.1 | `T-P1-CUSTODY-P-001` |
| `body.state_root` | Pulse schema | Protocol 7.1–7.2 | `T-P1-STATE-001` |
| `body.event.kind` | Pulse schema | Protocol 7.2 | `T-P1-EVENT-001` |
| `body.event.payload_hash` | Pulse schema | Protocol 3 and 7.1–7.3 | `T-P1-EVENT-002`, `T-P1-EVENT-003`, `T-P1-EVENT-004` |
| `body.next_custodians` | Pulse schema | Protocol 2.3, 5.2, and 7.1 | `T-P3-HANDOFF-001`, `T-P2-KEY-STRICT-001` |
| `body.next_quorum` | Pulse schema | Protocol 5 and 7.1 | `T-P1-QUORUM-P-001`, `T-P3-ACTIVATION-001` |
| `approvals` | Pulse schema | Protocol 5 and 7.1 | `T-P2-AUTH-001` |
| `acceptances` | Pulse schema | Protocol 5.2 and 7.1 | `T-P3-HANDOFF-002` |

## 5. Threat-to-test traceability

| Included threat/failure | Test IDs and executable regressions |
|---|---|
| Crash-stop and departure | `T-P3-CHURN-001`, `T-P5-REPAIR-001`, `T-P6-TAB-001`, `T-C2-CLI-EXIT-001` |
| Message delay/loss/duplication/reordering | `T-P5-NET-001` through `T-P5-NET-004` |
| Replay and stale state | `T-P1-REPLAY-001`, `T-P2-SIGN-003` |
| Partition and healing | `T-P5-PARTITION-001` through `T-P5-PARTITION-004` |
| Invalid signatures | `T-P2-SIGN-001` through `T-P2-SIGN-004` |
| Removed or premature signer | `T-P3-HANDOFF-003`, `T-P3-HANDOFF-004` |
| Public snapshot after death | `T-P4-SNAPSHOT-001`, `T-P4-SNAPSHOT-002` |
| Delayed or partially completed pre-authorized successor | `T-P4-LATENT-001`, `T-P4-LATENT-002`, `T-P4-LATENT-COMPLETION-001`, `T-P5-DELAY-001`; [`test/lineage.test.mjs`](../test/lineage.test.mjs) — “mortality completion combines durable approvals with explicitly usable current keys” |
| Evidence split across misleading envelopes, arrays, labels, bodies, and sidecars | `T-P4-EVIDENCE-COALESCE-001`; [`test/lineage.test.mjs`](../test/lineage.test.mjs) — “mortality coalesces verified evidence only within the same candidate body” |
| Invalid outer evidence attempts to poison an authentic signature | `T-P4-EVIDENCE-POISON-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — “mortality unions verified fragments only for the same body” |
| Completion-capable membership evidence lacks a verified sidecar | `T-P4-PAYLOAD-OPAQUE-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — “payload opacity blocks death only after irreversible loss without a non-death proof”; hash-matching array/scalar roots remain semantic-invalid evidence, not opacity |
| Usable-key projection violates sign-once or authentic evidence equivocates | `T-P4-SIGN-ONCE-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — “mortality projections keep verification body-scoped, obey sign-once, and leave equivocation unclassified” |
| Executable observer fields attempt reentrant lineage mutation | `T-P4-REENTRANCY-001`, `T-P4-OBS-DATA-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — accessors execute zero times, observation aborts, and the recognized head is unchanged |
| Empty or incomplete local evidence misreported as death | `T-P4-DEATH-BASIS-001`, `T-P4-LATE-EVIDENCE-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — “death requires irreversible loss and an explicitly complete evidence inventory” |
| Realm or dependency replacement for arrays, collections, scalar, regex, string, typed-array metadata/set, schema, brand, freezing, or SHA IV state | `T-P4-PRIMORDIAL-001`, `T-P4-DEPENDENCY-KAT-001`, `T-P4-BRAND-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) pre-call descriptor and SHA-IV drift, captured typed-array copy, `startsWith`, self-restoring typed-array metadata, already-forked Set/sort poisoning, and capability regressions |
| Accessor, sparse index, detachable source, malformed, oversized, or wrong-type mortality inventory ambiguity | `T-P4-OBS-DATA-001`, `T-P4-LATENT-TOCTOU-001`, `T-P4-CARRIER-UNCERTAINTY-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) named-field boundary, no-getter/no-detach, dense-index, and whole-observation abort regressions |
| Caller `ownKeys` amplification or recursive candidate/JCS work amplification | `T-P4-LIMIT-001`, `T-P4-CANDIDATE-AMPLIFICATION-001`, `T-C1-DIFF-LIMIT-001`; named descriptor acquisition never invokes `ownKeys`; Node covers the depth-64 exact/+1 candidate boundary with frozen graph-atomic retry, while browser-target/Chromium cover the normalized over-limit outcome |
| Transparent Proxy lies at the mortality observer-container boundary | Documented residual: the trusted adapter MUST supply honest Proxy-free containers. R1 replaces the object graph with canonical operation/result wire bytes; completeness honesty remains a policy assumption. |
| Missing, malformed, or substituted event payload | `T-P1-EVENT-002` through `T-P1-EVENT-004` |
| State loss mislabeled as protocol death | `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` |
| Invalid GPT proposal | `T-P9-AI-001` through `T-P9-AI-004` |
| Multiple logical keys concentrated in one endpoint | `T-H3A-INCUBATOR-001`, `T-H3A-FAILURE-DOMAIN-001`, `scripts/verify-lab.mjs` |
| Singleton authority misrepresented as ownerless | `T-C1-SINGLETON-001`, `T-H3-CLAIM-001` |
| Low-order, non-canonical, or mixed-order Ed25519 encodings | `T-P2-KEY-STRICT-001`, `T-P2-KEY-MIXED-001`, `T-P2-SIGN-R-001`, `T-P2-SIGN-S-001` |
| Overrideable byte metadata, shared memory, sparse/non-JSON values, or TOCTOU substitution | `T-P1-SNAPSHOT-001`, `T-P1-SAB-001`, `T-P1-IJSON-001`, `T-P4-LATENT-TOCTOU-001` |
| Next custody cannot activate its threshold | `T-P3-ACTIVATION-001`, `T-P3-ACTIVATION-002` |
| Caller-injected mortality head or pending valid-sibling fork classification | `T-P4-HEAD-SCOPE-001`, `T-P4-PENDING-FORK-001`, `T-P4-FORK-UNCLASSIFIED-001`; [`test/mortality.test.mjs`](../test/mortality.test.mjs) — “lineage mortality states use its private recognized head” and “distinct fully valid pending siblings record a fork and leave mortality unclassified” |
| Multi-fault schema precedence disagreement | `T-P1-PRECEDENCE-001`, `T-C1-DIFF-001` |

## 6. Change rule

A change to any invariant, message field, domain separator, validation precedence, or v0 threat assumption MUST update this traceability document in the same commit. No requirement may be removed without an explicit protocol-version decision.

## 7. Executable portable reference evidence

| Requirement group | Executable evidence | Result |
|---|---|---|
| Raw UTF-8/JSON, duplicates, I-JSON, sparse/non-JSON rejection, and canonical bytes | `src/bytes.mjs`, `src/codec.mjs`, `test/bytes.test.mjs`, `test/codec.test.mjs` | PASS |
| Eight domain-separated derivations and strict RFC 8032 verification | `src/crypto.mjs`, `test/crypto.test.mjs`, `test/vectors/rfc8032-ed25519.json`; low-order, mixed-order, non-canonical `R`, and non-canonical `S` regressions | PASS |
| Intrinsic byte limits, owned snapshots, SAB rejection, and exact depth boundary | `src/bytes.mjs`, `src/codec.mjs`, `test/codec.test.mjs`; depth 64 accepts and 65 rejects | PASS |
| Genesis birth and unanimous initial consent | `validateGenesis`, signed lifecycle vector, validator conformance suite | PASS |
| Pulse identity, parent, sequence, genome, state, and payload binding | `validatePulse`, validator conformance suite | PASS |
| Current quorum approval, new-custodian acceptance, and next-quorum activation | singleton and `2-of-3` signed handoffs plus activation-insufficient regressions | PASS |
| `0-of-3`, `1-of-3`, duplicate, ineligible, and corrupt evidence rejection | `test/validator.test.mjs` | PASS |
| Genuine-context capability, accepted-object replay, fork, and post-fork halt | `test/validator.test.mjs`, `test/lineage.test.mjs` | PASS |
| Durable latent validation plus sign-once-aware observer completion | public `validateLatentSuccessor` stays supplied-evidence-only; lineage-internal feasibility combines verified durable evidence with one early global usable-key snapshot filtered per body by observed signer commitments; internal completion helpers are not re-exported by supported `src/index.mjs` | PASS |
| Pending evidence recomposition and recognized-head mortality scope | [`test/lineage.test.mjs`](../test/lineage.test.mjs) and [`test/mortality.test.mjs`](../test/mortality.test.mjs): target-tuple bodies and exact tagged signature values/property names are recursively discovered across parsed declared envelope/payload trees; declared payload roots are indexed independently; signatures are remapped per body; unrelated observer fields are ignored without enumeration, while unsnapshotable recognized or malformed-JSON declared byte sources abort; distinct bodies never cross-union; missing membership payload and equivocation remain unclassified; same-tuple semantic-invalid and split commitments constrain fresh authority; observable mutation and realm poisoning cannot alter the owned basis; death requires explicit completeness; strict siblings record a fork | PASS within the trusted Proxy-free adapter boundary |
| Bounded mortality work and atomic overflow | Node conformance uses genuine Ed25519 signatures for 1,152/+1 remap work and a maximum 16-current/16-new transition, including direct and reconstruction reservations, exact duplicate-carrier boundary, frozen overflow, unchanged graph, and retry. The portable corpus and exact-head Chromium cover the stable normalized reservation-overflow result plus all seven resource identifiers, while depth-64 candidate amplification runs in Node/browser-target/Chromium. | PASS required on exact reviewed head |
| Fixed-seed invariant stress | `test/properties.test.mjs`, 10,000 mixed valid/invalid continuations with exact expected codes | PASS |
| Cross-process determinism | `test/process-determinism.test.mjs` | PASS |
| `INV-5`, `INV-7`, `INV-9`, and `INV-12` H2 lifecycle proof | `scripts/demo-trace.mjs` trace format v4, committed full golden comparison, digest `19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399`. The trace records explicit complete mortality evidence and one supplied-quorum latent successor, but does not cover `INV-13` conditional completion/evidence coalescing or `INV-16` boundary/fork adversarial cases; those are separate conformance regressions above. | PASS within stated slice |
| Public snapshot cannot advance a dead lineage | zero-approval sequence-4 candidate returns `E_APPROVAL_INSUFFICIENT_QUORUM (0/2)` | PASS |
| Endpoint-neutral source boundary | `scripts/verify-portable.mjs` scans every trusted source module | PASS |
| `1-of-1` birth and controlled singleton mortality | `test/vectors/singleton.json`, `test/singleton.test.mjs`, `scripts/demo-singleton.mjs` | PASS |
| `1-of-1` to logical `2-of-3` authority expansion | one-process generated-key handoff test; former sole key is then insufficient; physical distribution is not established | PASS |
| Cross-runtime portable result corpus | Format v4 covers strict points, hostile metadata, explicit incomplete and complete mortality evidence, bounded-observation outcomes, deterministic decisions, same-body completion, sign-once-aware equivocation, missing-membership-payload uncertainty, and strict rejection. Node, the browser-target realm, and actual Chromium must agree for the exact reviewed head. Node and browser-target exercise SAB rejection, and H3A verifies the same boundary in an actual cross-origin-isolated browser. | Local validation plus latest successful exact-head Verify required for publication |
| Portable replay/fork/equivocation/post-fork halt | `test/vectors/fork.json`, `test/portable-corpus.mjs` | PASS |
| Real browser birth with non-extractable Worker keys | `lab/custodian-worker.mjs`, `test/lab.test.mjs`, `scripts/verify-lab.mjs` | PASS |
| One-key rejection and all three two-key heartbeat combinations | `lab/live-incubator.mjs`, `scripts/verify-lab.mjs` | PASS |
| Fixed reference turnover, mutations, resurrection, mortality, and clone | `lab/reference-engine.mjs`, `test/lab.test.mjs`, `scripts/verify-lab.mjs` | PASS |
| Experimental public-evidence canonical export, digest, and raw replay | `lab/evidence-export.mjs`, `test/lab.test.mjs`, `scripts/verify-lab.mjs` | PASS |
| Browser storage, Service Worker, CSP, request, accessibility, and viewport boundary | `lab/index.html`, `scripts/serve-lab.mjs`, `scripts/verify-lab.mjs` | PASS |
| Exact custom-page to accepted-API origin bridge; bounded preflight/CORS; attacker origins and extra methods/headers rejected | `lab/runtime-endpoints.mjs`, `functions/api/scenarios.js`, `test/scenario-api.test.mjs`, `scripts/verify-lab.mjs` | PASS; exact-main public preflight, valid GPT POST, fixed 25-call evaluation, and three-context Chromium accepted |
| Static artifact third-party license preservation | `lab/THIRD_PARTY_LICENSES.txt`, `scripts/build-lab.mjs`, `scripts/verify-lab.mjs` | PASS |
| v1 Genesis exact genome/initial-state binding | `src/state/engine.mjs`, `src/validator.mjs`, `schemas/genesis.schema.json`, `test/state-engine.test.mjs` | PASS |
| v1 deterministic state/receipt bytes across JavaScript and independent Python | `test/vectors/state-v1.json`, `scripts/verify-state.mjs`, `r1/python/state_verify.py` | PASS |
| v1 malformed/limit/tamper atomic rejection and 10,000 transitions | `test/state-engine.test.mjs`, stable `E_STATE_*` codes | PASS |
| v1 actual Chromium Nurture and export/import reconstruction | `lab/live-incubator.mjs`, `lab/evidence-export.mjs`, `scripts/verify-lab.mjs` | PASS |

The validator enforces unique eligible key IDs. It does not prove that keys belong to independent people, processes, devices, or failure domains. A `1-of-1` descriptor is explicitly unilateral; a multi-key descriptor is independently controlled only when deployment evidence shows that no domain controls its threshold.

The portable JavaScript implementation exposes the reference result and a committed, language-readable expected-result fixture. Node, browser-target, and actual-Chromium conformance is an exact-head gate; rolling documentation intentionally does not pin a self-invalidating candidate SHA. Full implementation independence still requires an independently written non-JavaScript verifier that consumes canonical operation and result records without importing reference code.
