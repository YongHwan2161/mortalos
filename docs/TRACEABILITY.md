# MortalOS v0 Requirements Traceability

Status: **Normative v0 baseline with hardened portable core, Chromium differential, and committed H2 v3 evidence**

This document maps every foundational invariant to protocol requirements, rejection codes, and automated or planned tests. Transition, lineage, mortality, singleton, portable Node/Chromium, and H2 evidence are executable; state-runtime, participant-network, visual-UI, and AI IDs remain reserved.

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
| `INV-12` Authority availability and state availability are never conflated. | v0 state loss is `state-stalled`; only irreversible below-quorum authority loss with no latent successor establishes v0 protocol death under controlled assumptions. | Observer-state result; no death message | `T-P4-DEATH-001`, `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` | P4 |
| `INV-13` Destroying current private keys does not revoke previously created authorization evidence. | `validateLatentSuccessor` authenticates current quorum and supplied acceptances; lineage mortality revalidates raw pending direct-child evidence against its recognized head. | `latent successor / not dead` observer result | `T-P4-LATENT-001`, `T-P4-LATENT-002`, `T-P5-DELAY-001` | P4 |
| `INV-14` Invalid Ed25519 point encodings never create identity or authority. | Public keys and signature `R` must be canonical prime-order subgroup points; `S` must be canonical. Peer-ID derivation rejects invalid points. | `E_PUBLIC_KEY_INVALID_POINT` or evidence-specific signature-invalid code | `T-P2-KEY-STRICT-001`, `T-P2-KEY-MIXED-001`, `T-P2-SIGN-R-001`, `T-P2-SIGN-S-001` | P2 |
| `INV-15` One validation operation observes one immutable byte input. | Intrinsic metadata and an owned snapshot precede parsing; SharedArrayBuffer views and non-I-JSON programmatic values are rejected; public validators are total. | Parse/payload code or `E_VALIDATOR_INTERNAL` | `T-P1-SNAPSHOT-001`, `T-P1-SAB-001`, `T-P1-IJSON-001`, `T-P1-TOTAL-001`, `T-P4-LATENT-TOCTOU-001` | P1 |
| `INV-16` Mortality never trusts a caller-selected head. | `Lineage#evaluateMortality` uses the graph-recognized current head and revalidates raw pending direct children; distinct valid pending siblings record a fork and forks remain unclassified. | Observer `forked` or conditional mortality result | `T-P4-HEAD-SCOPE-001`, `T-P4-PENDING-RAW-001`, `T-P4-PENDING-FORK-001`, `T-P4-FORK-UNCLASSIFIED-001` | P4 |
| `INV-17` Multi-fault inputs have one runtime-independent first result. | Schema errors are normalized by explicit precedence and pointer/keyword order; semantic version/algorithm checks follow canonical encoding. | Stable first rejection code | `T-P1-PRECEDENCE-001`, `T-P1-PRECEDENCE-002`, `T-C1-DIFF-001` | P1 |

## 3. Specification-baseline traceability

| Baseline criterion | Evidence |
|---|---|
| Every lifecycle term has a necessary and sufficient operational definition. | `PROTOCOL.md` section 4. |
| Death is succession-capability loss, not unprovable universal byte deletion. | `PROTOCOL.md` 4.19 and `THREAT_MODEL.md` section 9. |
| Authority, state viability, state stall, dormancy, partition, latent succession, and death are explicitly distinguishable. | `PROTOCOL.md` 4.10–4.19 and section 10. |
| Canonical encoding and hash domain separation are specified. | `PROTOCOL.md` sections 2 and 3. |
| Every Genesis and Pulse field has a validation rule. | `PROTOCOL.md` sections 6.1 and 7.1 plus JSON Schemas. |
| Every invariant maps to at least one planned automated test. | Invariant table in this document maps `INV-1` through `INV-17`. |
| Later phases are not required to decide envelope/lifecycle validity. | `PROTOCOL.md` sections 8 and 9; v0 has no implementation-specific genome callback. |
| One reference validator produces the same first result reproducibly. | The committed expected result, direct Node execution, isolated browser-target bundle, and actual Chromium agree for the portable corpus. A second independently written implementation remains an R1 gate. |

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

| Included threat/failure | Planned tests |
|---|---|
| Crash-stop and departure | `T-P3-CHURN-001`, `T-P5-REPAIR-001`, `T-P6-TAB-001`, `T-C2-CLI-EXIT-001` |
| Message delay/loss/duplication/reordering | `T-P5-NET-001` through `T-P5-NET-004` |
| Replay and stale state | `T-P1-REPLAY-001`, `T-P2-SIGN-003` |
| Partition and healing | `T-P5-PARTITION-001` through `T-P5-PARTITION-004` |
| Invalid signatures | `T-P2-SIGN-001` through `T-P2-SIGN-004` |
| Removed or premature signer | `T-P3-HANDOFF-003`, `T-P3-HANDOFF-004` |
| Public snapshot after death | `T-P4-SNAPSHOT-001`, `T-P4-SNAPSHOT-002` |
| Delayed or partially completed pre-authorized successor | `T-P4-LATENT-001`, `T-P4-LATENT-002`, `T-P5-DELAY-001` |
| Missing, malformed, or substituted event payload | `T-P1-EVENT-002` through `T-P1-EVENT-004` |
| State loss mislabeled as protocol death | `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` |
| Invalid GPT proposal | `T-P9-AI-001` through `T-P9-AI-004` |
| Multiple logical keys concentrated in one endpoint | `T-H3-INCUBATOR-001`, `T-H3-FAILURE-DOMAIN-001` |
| Singleton authority misrepresented as ownerless | `T-C1-SINGLETON-001`, `T-H3-CLAIM-001` |
| Low-order, non-canonical, or mixed-order Ed25519 encodings | `T-P2-KEY-STRICT-001`, `T-P2-KEY-MIXED-001`, `T-P2-SIGN-R-001`, `T-P2-SIGN-S-001` |
| Overrideable byte metadata, shared memory, sparse/non-JSON values, or TOCTOU substitution | `T-P1-SNAPSHOT-001`, `T-P1-SAB-001`, `T-P1-IJSON-001`, `T-P4-LATENT-TOCTOU-001` |
| Next custody cannot activate its threshold | `T-P3-ACTIVATION-001`, `T-P3-ACTIVATION-002` |
| Caller-injected mortality head or pending valid-sibling fork classification | `T-P4-HEAD-SCOPE-001`, `T-P4-PENDING-FORK-001`, `T-P4-FORK-UNCLASSIFIED-001` |
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
| Single-pass latent validation, recognized-head mortality scope, and pending valid-sibling fork recording | `validateLatentSuccessor`, `Lineage#evaluateMortality`, `test/lineage.test.mjs`, `test/mortality.test.mjs` | PASS |
| Fixed-seed invariant stress | `test/properties.test.mjs`, 10,000 mixed valid/invalid continuations with exact expected codes | PASS |
| Cross-process determinism | `test/process-determinism.test.mjs` | PASS |
| `INV-5`, `INV-7`, `INV-9`, `INV-12`, `INV-13`, and `INV-16` vertical proof | `scripts/demo-trace.mjs` trace format v3, committed full golden comparison, digest `b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36` | PASS |
| Public snapshot cannot advance a dead lineage | zero-approval sequence-4 candidate returns `E_APPROVAL_INSUFFICIENT_QUORUM (0/2)` | PASS |
| Endpoint-neutral source boundary | `scripts/verify-portable.mjs` scans every trusted source module | PASS |
| `1-of-1` birth and controlled singleton mortality | `test/vectors/singleton.json`, `test/singleton.test.mjs`, `scripts/demo-singleton.mjs` | PASS |
| `1-of-1` to `2-of-3` authority expansion | generated-key handoff test; former sole key is then insufficient | PASS |
| Cross-runtime portable result corpus | format v2 committed expected result, Node, browser-target realm, and actual Chromium, including strict-point/SAB/hostile-metadata boundary cases | PASS |
| Portable replay/fork/equivocation/post-fork halt | `test/vectors/fork.json`, `test/portable-corpus.mjs` | PASS |

The validator enforces unique eligible key IDs. It does not prove that keys belong to independent people, processes, devices, or failure domains. A `1-of-1` descriptor is explicitly unilateral; a multi-key descriptor is independently controlled only when deployment evidence shows that no domain controls its threshold.

The portable JavaScript implementation exposes the reference result and a committed, language-readable expected-result fixture. Cross-runtime conformance within that implementation is verified. Full implementation independence still requires a second implementation that consumes canonical evidence records without importing reference code.
