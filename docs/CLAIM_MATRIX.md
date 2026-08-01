# MortalOS current claim matrix

Status: **ACTIVE — S2/S4 REOPENED / CURRENT CANDIDATE HOLD**

Last synchronized: **2026-08-01 KST**

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
| Crash-safe durable `2-of-3` cold recovery and sign-once journal | Yes | Yes on current candidate: Node plus actual Chromium/Firefox bounded parity; historical Chromium `100/100` receipt remains commit-bound | No | Historical S2 commit only; current claim reopened | Module-private store capability, first-await ownership, and public key redaction changed the source. A fresh exact-head receipt/review is mandatory. |
| Exact R3 state replica recovery after storage/relay loss | Yes | Yes, 1 MiB/16-chunk logical stores, 20,000 end-to-end recovery executions, and JavaScript/Python differential | No | Yes, exact-main S3 receipt/review/Verify/Deploy | Inventory is a hint; exact fetched bytes and aggregate root are reverified. Logical stores do not prove independent domains. |
| Confidential replicated state with epoch-key removal | Yes, candidate | Node plus actual Chromium/Firefox pass locally; recovery/activation mutation corpus passes | No | Historical receipt only; current claim reopened | Public results omit epoch keys; activation uses private capability plus exact readback. WebKit signing, hidden forks, prior exposure, and physical independence remain unclaimed. |
| Public SDK/CLI package interoperability | Yes, candidate | Exact export allowlist, CLI, package allowlist, and cross-process Capsule verify pass | Not applicable | No | Package is not promoted/published until exact-head review and clean-install evidence pass. |
| Continuity Capsule resource lifecycle | Yes, candidate | Canonical lineage/state/chunk binding, process-boundary verification, and tamper tests pass | No | No | Capsule carries public evidence and encrypted resource bytes, never signing authority. |
| Independent host/relay/credential-domain survival | Process-isolated model only | Three HTTP CAS processes survive one termination and disk restart | No | No | Real S7 promotion still requires distinct provider, host, administrator, credential domains, 100 trials, and seven-day burn-in. |
| Adversarial 2-of-3 Capsule custody | Yes, candidate | One lost/corrupt copy recovers; valid fork and below-quorum sets reject | No | No | This is content custody, not private signing-key custody or Byzantine resolution. |
| Byzantine/Sybil resistance or automatic fork resolution | No | No | No | No | Forks halt automatic progress; no winner is selected. |
| Global death certificate or proof all copies are gone | No | No | No | No | Mortality remains observer-domain-relative under explicit assumptions. |
| Firefox durable participant parity | Yes, candidate | Portable, S2 restart/loss/repair, S4 counter/rotation actual-engine gates pass | No | No | Requires exact-head release matrix before a production support claim. |
| WebKit durable participant parity | Capability-routed candidate | Windows verifier-only path passes when Ed25519 is absent; signer-capable Ubuntu runtime is routed to full S2/S4 but exact-head CI is pending | No | No | Engine name never grants authority; unavailable capability fails closed and no raw-key fallback is allowed. |
| GPT/model authority | Intentionally absent | Not applicable | Not applicable | Not claimed | Optional model output cannot sign, select a head, or change a verdict. |

## Change rule

Any implementation, documentation, website, package, or deployment statement that
changes a row must update this matrix and its exact evidence in the same reviewed
change. Unavailable evidence is recorded as **No** or **HOLD**, never inferred from
silence or a healthy endpoint.
