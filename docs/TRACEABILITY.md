# MortalOS v0 Requirements Traceability

Status: **Normative P0 traceability baseline, corrected by the 2026-07-14 red-team review**

This document maps every foundational invariant to protocol requirements, rejection codes, and planned automated tests. Test IDs are reserved now and implemented in P1 through P10.

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
| `INV-4` Mutation of a signed field invalidates approval. | Signatures bind domain-separated canonical Pulse or Genesis body hash. | `E_APPROVAL_SIGNATURE_INVALID`, `E_HASH_DERIVATION_MISMATCH` | `T-P2-SIGN-001`, `T-P2-SIGN-002`, `T-P2-SIGN-003` | P2 |
| `INV-5` Older state cannot silently replace a newer recognized state. | Replay and rollback are rejected; valid siblings cause `FORKED`. | `E_REPLAY_STALE`, `E_ROLLBACK_ATTEMPT`, `E_FORK_DETECTED` | `T-P1-REPLAY-001`, `T-P5-PARTITION-003`, `T-P5-FORK-001` | P1 |
| `INV-6` Membership changes only through a valid Pulse. | Current quorum authorizes and every added custodian accepts handoff. | `E_ACCEPTANCE_MISSING`, `E_ACCEPTANCE_SIGNER_NOT_NEW`, `E_MEMBERSHIP_STATE_CHANGED` | `T-P3-HANDOFF-001`, `T-P3-HANDOFF-002`, `T-P3-HANDOFF-003` | P3 |
| `INV-7` Complete safe custodian turnover preserves identity. | Handoffs change custody descriptor, never Genesis or organism ID. | `Accept` with unchanged `organism_id` | `T-P3-TURNOVER-001`, `T-P3-TURNOVER-002`, `T-P3-TURNOVER-RANDOM-001` | P3 |
| `INV-8` Below-quorum groups cannot advance. | Threshold is parent-derived; duplicate signatures count once. | `E_APPROVAL_DUPLICATE`, `E_APPROVAL_INSUFFICIENT_QUORUM` | `T-P2-AUTH-002`, `T-P2-AUTH-004`, `T-P5-MINORITY-001` | P2 |
| `INV-9` A clone without lineage authority has a new identity. | Clone creator samples a new Genesis nonce; a byte-identical Genesis is a replay, not a clone. | New `organism_id`; stale approvals rejected | `T-P1-NONCE-G-002`, `T-P4-CLONE-001`, `T-P4-CLONE-002`, `T-P4-SNAPSHOT-001` | P1 |
| `INV-10` AI, UI, and transport never define validity. | Only pure validator output accepts state; external layers submit bytes/proposals. | Protocol rejection code unchanged by source | `T-P6-UI-001`, `T-P7-TRANSPORT-001`, `T-P9-AI-001`, `T-P9-AI-002` | P6 |
| `INV-11` Semantic validation uses the exact event payload committed by the Pulse. | Canonical sidecar bytes are mandatory and their domain-separated digest equals `payload_hash`. | `E_EVENT_PAYLOAD_REQUIRED`, `E_EVENT_PAYLOAD_INVALID`, `E_EVENT_PAYLOAD_MISMATCH` | `T-P1-EVENT-002`, `T-P1-EVENT-003`, `T-P1-EVENT-004` | P1 |
| `INV-12` Authority availability and state availability are never conflated. | v0 state loss is `state-stalled`; only irreversible below-quorum authority loss establishes v0 protocol death under controlled assumptions. | Observer-state result; no death message | `T-P4-DEATH-001`, `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` | P4 |

## 3. P0 exit-criterion traceability

| P0 criterion | Evidence |
|---|---|
| Every lifecycle term has a necessary and sufficient operational definition. | `PROTOCOL.md` section 4. |
| Death is succession-capability loss, not unprovable universal byte deletion. | `PROTOCOL.md` 4.18 and `THREAT_MODEL.md` section 9. |
| Authority, state viability, state stall, dormancy, partition, and death are explicitly distinguishable. | `PROTOCOL.md` 4.10–4.18 and section 10. |
| Canonical encoding and hash domain separation are specified. | `PROTOCOL.md` sections 2 and 3. |
| Every Genesis and Pulse field has a validation rule. | `PROTOCOL.md` sections 6.1 and 7.1 plus JSON Schemas. |
| Every invariant maps to at least one planned automated test. | Invariant table in this document maps `INV-1` through `INV-12`. |
| Later phases are not required to decide envelope/lifecycle validity. | `PROTOCOL.md` sections 8 and 9; genome content validation is identified as an explicit required input, not an unspecified rule. |
| Two conforming validators receive the same first result. | Deterministic validation order and stable rejection codes; P1 will supply executable cross-process conformance vectors. |

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
| `body.initial_custodians` | Genesis schema | Protocol sections 5 and 6.1 | `T-P1-CUSTODY-G-001` |
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
| `body.next_custodians` | Pulse schema | Protocol 5.1 and 7.1 | `T-P3-HANDOFF-001` |
| `body.next_quorum` | Pulse schema | Protocol 5 and 7.1 | `T-P1-QUORUM-P-001` |
| `approvals` | Pulse schema | Protocol 5 and 7.1 | `T-P2-AUTH-001` |
| `acceptances` | Pulse schema | Protocol 5.1 and 7.1 | `T-P3-HANDOFF-002` |

## 5. Threat-to-test traceability

| Included threat/failure | Planned tests |
|---|---|
| Crash-stop and departure | `T-P3-CHURN-001`, `T-P5-REPAIR-001`, `T-P6-TAB-001` |
| Message delay/loss/duplication/reordering | `T-P5-NET-001` through `T-P5-NET-004` |
| Replay and stale state | `T-P1-REPLAY-001`, `T-P2-SIGN-003` |
| Partition and healing | `T-P5-PARTITION-001` through `T-P5-PARTITION-004` |
| Invalid signatures | `T-P2-SIGN-001` through `T-P2-SIGN-004` |
| Removed or premature signer | `T-P3-HANDOFF-003`, `T-P3-HANDOFF-004` |
| Public snapshot after death | `T-P4-SNAPSHOT-001`, `T-P4-SNAPSHOT-002` |
| Missing, malformed, or substituted event payload | `T-P1-EVENT-002` through `T-P1-EVENT-004` |
| State loss mislabeled as protocol death | `T-P4-STATE-STALLED-001`, `T-P6-UI-STATE-001` |
| Invalid GPT proposal | `T-P9-AI-001` through `T-P9-AI-004` |

## 6. Change rule

A change to any invariant, message field, domain separator, validation precedence, or v0 threat assumption MUST update this traceability document in the same commit. No requirement may be removed without an explicit protocol-version decision.
