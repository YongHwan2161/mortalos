# MortalOS current claim matrix

Status: **ACTIVE S3 promoted / S4 exact-head candidate claim authority**

Last synchronized: **2026-07-26 KST**

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
| Consent-gated durable `1-of-1` participant reload | Yes | Yes, Chromium schema v2 | No | Yes, within exact receipt/deploy evidence | Uses the same replay/WAL path as durable quorum; it remains one-key authority. |
| Unified deterministic Participant Core | Yes | Yes, Node and Chromium | Not applicable | Yes | S1 receipt v2 is main-history portable; live, durable, handoff, quorum, catch-up, fork, snapshot, and availability paths use one core. |
| Crash-safe durable `2-of-3` cold recovery and sign-once journal | Yes | Yes, Node plus actual Chromium `100/100` per required matrix | No | Yes, exact-main S2 receipt/review/Verify/Deploy | Same-host profiles and test adapters do not prove independent devices, credentials, or administrators. |
| Exact R3 state replica recovery after storage/relay loss | Yes | Yes, 1 MiB/16-chunk logical stores, 20,000 end-to-end recovery executions, and JavaScript/Python differential | No | Yes, exact-main S3 receipt/review/Verify/Deploy | Inventory is a hint; exact fetched bytes and aggregate root are reverified. Logical stores do not prove independent domains. |
| Confidential replicated state with epoch-key removal | Yes, candidate | Complete pre-freeze ordered gate PASS; frozen-source receipt rerun pending | No | No | Ciphertext-only logical stores, any-two recovery/decryption, actual Chromium authority restart, and future-epoch removed-member denial are candidate evidence. A conforming uncompromised counter authority is trusted; hidden forks, prior exposure, physical domains, and exact-main promotion remain unclaimed. |
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
