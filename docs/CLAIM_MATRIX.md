# MortalOS current claim matrix

Status: **ACTIVE S0 claim authority**

Last synchronized: **2026-07-25 KST**

This matrix is the current claim boundary. “Implemented” means code exists;
“exact-head locally verified” means the named repository gates pass on the current
candidate; “physically verified” requires distinct physical or administrative
failure domains; and “promoted” requires merged exact-main evidence. No column
inherits truth from another.

| Capability | Implemented | Exact-head locally verified | Physically verified | Promoted | Explicit boundary |
| --- | --- | --- | --- | --- | --- |
| Portable v0 lifecycle and R1 canonical operation/result bytes | Yes | Yes | Not applicable | Yes | Validation authority is the portable kernel, never an adapter or UI. |
| Bounded deterministic `mortalos/1` state transition | Yes | Yes | Not applicable | Yes | This is content binding and deterministic transition, not availability or arbitrary code execution. |
| Read-only canonical evidence export/import | Yes | Yes | Not applicable | Yes | Import does not confer signing authority. |
| A→B browser custody succession after A closes | Yes | Yes, Chromium persistent profiles | No | Yes, within the browser-profile claim | Profiles are not evidence of separate people, devices, organizations, or credential domains. |
| Logical browser `2-of-3` loss and D repair | Yes | Yes, isolated Chromium contexts | No | Yes, as logical quorum evidence | Current contexts can share one host and administrative domain. |
| Consent-gated durable `1-of-1` participant reload | Yes | Yes, Chromium | No | Yes, as single-participant durability | Not crash-safe durable quorum and not sufficient for the North Star. |
| Crash-safe durable `2-of-3` cold recovery and sign-once journal | No | No | No | No | S2 target; current in-memory quorum evidence must not be relabeled durable. |
| Exact R3 state replica recovery after storage/relay loss | No | No | No | No | Current v1 state roots prove transition integrity, not retrievability. |
| Confidential replicated state with epoch-key removal | No | No | No | No | Current protocol provides integrity, not state confidentiality. |
| Public SDK/CLI package interoperability | No | No | No | No | Repository scripts are not a supported package or stable public API. |
| Continuity Capsule resource lifecycle | No | No | No | No | S6 target; no second workload is authorized before it passes. |
| Independent host/relay/credential-domain survival | No | No | No | No | Requires S7 topology evidence, 100 trials, and seven-day burn-in. |
| Byzantine/Sybil resistance or automatic fork resolution | No | No | No | No | Forks halt automatic progress; no winner is selected. |
| Global death certificate or proof all copies are gone | No | No | No | No | Mortality remains observer-domain-relative under explicit assumptions. |
| Firefox/WebKit durable participant parity | Feature-gated | No | No | No | Unsupported engines must visibly downgrade; Chromium evidence cannot promote them. |
| GPT/model authority | Intentionally absent | Not applicable | Not applicable | Not claimed | Optional model output cannot sign, select a head, or change a verdict. |

## Change rule

Any implementation, documentation, website, package, or deployment statement that
changes a row must update this matrix and its exact evidence in the same reviewed
change. Unavailable evidence is recorded as **No** or **HOLD**, never inferred from
silence or a healthy endpoint.
