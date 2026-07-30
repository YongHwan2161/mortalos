# MortalOS North Star stage tracking

Status: **ACTIVE**

Milestone: [Post-hackathon North Star S1–S8](https://github.com/YongHwan2161/mortalos/milestone/1)

Owner: `codex-protocol-kernel`

Every issue is subordinate to the
[implementation SSOT](POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md). An issue
state is coordination metadata, not promotion evidence.

| Stage | Issue | Required receipt |
| --- | --- | --- |
| S1 — Unified Participant Core | [#30](https://github.com/YongHwan2161/mortalos/issues/30) | `evidence/stages/s1-participant-core.json` |
| S2 — Crash-safe Durable Quorum | [#31](https://github.com/YongHwan2161/mortalos/issues/31) | `evidence/stages/s2-durable-quorum.json` |
| S3 — R3 State Availability and Recovery | [#32](https://github.com/YongHwan2161/mortalos/issues/32) | `evidence/stages/s3-state-recovery.json` |
| S4 — Confidential State and Epoch Keys | [#33](https://github.com/YongHwan2161/mortalos/issues/33) | `evidence/stages/s4-confidentiality.json` |
| S5 — SDK and CLI | [#34](https://github.com/YongHwan2161/mortalos/issues/34) | `evidence/stages/s5-sdk-cli.json` |
| S6 — Continuity Capsule v1 | [#35](https://github.com/YongHwan2161/mortalos/issues/35) | `evidence/stages/s6-continuity-capsule.json` |
| S7 — Independent Failure Domains and Burn-in | [#36](https://github.com/YongHwan2161/mortalos/issues/36) | `evidence/stages/s7-failure-domains.json` |
| S8 — Adversarial Custody and Browser Parity | [#37](https://github.com/YongHwan2161/mortalos/issues/37) | `evidence/stages/s8-adversarial-custody.json` |

Promotion requires all strict stage criteria, an exact machine-validated receipt,
independent immutable-head review, expected-head merge, and post-merge evidence.
Anything less is **HOLD**.

## Current candidate

S1, S2, and S3 are promoted on `main` with main-history-portable receipts,
independent immutable review, expected-head merge, post-merge Verify, and exact-main
Deploy. S3 closed issue #32 at main
`1f8c055f1cf6fb4ee304f0b61cbe6507c65dba7d`. The independently reviewed S4
cryptographic ADR was then promoted at
`39529337b2a739b1aee4697e680643d77704bbaa`.

S4 runtime implementation is an exact-head candidate on
`agent/codex-protocol-kernel--s4-confidential-state`. Focused Node, one-million-IV,
capture, any-two S3 recovery/decryption, removal/rotation, fault, coverage, and
actual-Chromium gates pass. Promotion remains **HOLD** pending the exact
`s4-confidentiality.json` receipt, frozen-source ordered rerun, immutable
implementation review, expected-head merge, and exact-main Verify plus Deploy.
The complete pre-freeze ordered suite passes, including the expanded actual
Chromium authority contention and process-restart gate.
