# MortalOS North Star stage tracking

Status: **ACTIVE — CURRENT CANDIDATE PROMOTION HOLD**

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

## Current candidate (2026-08-01)

S2 and S4 are reopened because capability ownership, first-await snapshots,
activation readback, and key redaction changed their security-critical sources.
Their older receipts remain historical exact-commit evidence only.

S5/S6 are implemented and locally verified. S7 passes a three-process HTTP CAS
fault/restart rehearsal, not a real independent-provider topology. S8 stateful fuzz,
adversarial Capsule custody, Chromium, and Firefox pass locally. WebKit is capability-
profiled through the 65,536-byte message ceiling: Windows lacks Ed25519 and Ubuntu
creates a key but cannot complete the full signing envelope, so both are verifier-only.
All new promotion receipts, immutable review,
merge, post-merge CI, and live readback remain **HOLD**.

GitHub ruleset `20168959` is active on `main` with no bypass and requires the trusted
policy check, protocol check, required Chromium/Firefox/WebKit capability-profiled
browser parity check, current base, resolved threads, stale-review dismissal, a
GitHub App `MortalOS Reviewer Attestation` exact-snapshot check, and one native
approval from someone other than the last pusher. Machine-user `ant713900-web` is
the separately credentialed native principal with repository `write`; GitHub App
`mortalos-review-gate` is the attester. Both remain controlled by the same project
operator, so this is not independent human, administrator, provider, or custody
evidence. The current candidate remains **HOLD** until its changed policy head passes
fresh CI, independent review, App attestation, and native approval.

## Historical promotion lineage

S1, S2, and S3 are promoted on `main` with main-history-portable receipts,
independent immutable review, expected-head merge, post-merge Verify, and exact-main
Deploy. S3 closed issue #32 at main
`1f8c055f1cf6fb4ee304f0b61cbe6507c65dba7d`. The independently reviewed S4
cryptographic ADR was then promoted at
`39529337b2a739b1aee4697e680643d77704bbaa`.

The historical S4 runtime promotion reached `main` at
`49c53029623c6da85566d7fa794b71f2068af682`. Its receipt remains valid only for
that exact promotion tree. The current candidate changes S2/S4 security-critical
capability and recovery sources, so neither the old branch review nor the old
receipt authorizes the new head. Current replacement evidence and remaining HOLD
conditions are recorded above; a fresh immutable-head promotion chain is required.
