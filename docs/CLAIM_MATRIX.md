# MortalOS current claim matrix

Status: **ACTIVE — PRODUCT VERTICAL NOT YET INTEGRATED**

Last synchronized: **2026-08-02 KST**

This matrix is the current claim boundary. “Implemented” means code exists in main;
“exact-source verified” means the named gates passed for that exact source;
“physically verified” requires distinct physical or administrative failure domains;
and “promoted” requires the stage's receipt, review, merge, and post-merge evidence.
No column inherits truth from another.

| Capability | Implemented | Exact-source verified | Physically verified | Promoted | Explicit boundary |
| --- | --- | --- | --- | --- | --- |
| Portable v0 lifecycle and R1 canonical operation/result bytes | Yes | Yes | Not applicable | Yes | Validation authority is the portable kernel, never an adapter or UI. |
| Bounded deterministic `mortalos/1` state transition | Yes | Yes | Not applicable | Yes | This is content binding and deterministic transition, not availability or arbitrary code execution. |
| Read-only canonical evidence export/import | Yes | Yes | Not applicable | Yes | Import does not confer signing authority. |
| A→B browser custody succession after A closes | Yes | Yes, Chromium persistent profiles | No | Yes, within the browser-profile claim | Profiles are not evidence of separate people, devices, organizations, or credential domains. |
| Logical browser `2-of-3` loss and D repair | Yes | Yes, isolated Chromium contexts | No | Yes, as logical quorum evidence | Current contexts can share one host and administrative domain. |
| Consent-gated durable `1-of-1` participant reload | Yes | Yes, Chromium schema v2 | No | Yes, within exact receipt/deploy evidence | Uses the same replay/WAL path as durable quorum; it remains one-key authority. |
| Unified deterministic Participant Core | Yes | Yes, Node and Chromium | Not applicable | Yes | S1 receipt v2 is main-history portable; live, durable, handoff, quorum, catch-up, fork, snapshot, and availability paths use one core. |
| Crash-safe durable `2-of-3` cold recovery and sign-once journal | Yes, for conforming endpoint concurrency | Yes on merged source `12e90e6…`: Node plus actual Chromium/Firefox bounded parity; historical Chromium `100/100` receipt remains commit-bound | No | Historical S2 claim only; revised claim reopened | Module-private capability and CAS block public-API/store-facade bypass. A same-origin script can still use the persisted non-extractable key outside the journal, so XSS-resistant sign-once is explicitly **HOLD** pending a separate signer trust domain. |
| Exact R3 state replica recovery after storage/relay loss | Yes | Yes, 1 MiB/16-chunk logical stores, 20,000 end-to-end recovery executions, and JavaScript/Python differential | No | Yes, exact-main S3 receipt/review/Verify/Deploy | Inventory is a hint; exact fetched bytes and aggregate root are reverified. Logical stores do not prove independent domains. |
| Confidential replicated state with epoch-key removal | Yes, main | Node plus actual Chromium/Firefox passed on `12e90e6…`; recovery/activation mutation corpus passed | No | Historical receipt only; revised claim reopened | Public results omit epoch keys; activation uses private capability plus exact readback. Browser non-extractability prevents export, not same-origin key use; XSS-resistant counter custody, WebKit signing, hidden forks, prior exposure, and physical independence remain unclaimed. |
| Public SDK/CLI package interoperability | Yes, main | Exact export allowlist, verification CLI, packed-file allowlist, and clean temporary install pass | Not applicable | No | Package is not published; create/handoff/recover/continue orchestration is not yet exposed. |
| Continuity Capsule resource lifecycle | Yes, main | Canonical lineage/state/chunk binding, process-boundary verification, and tamper tests pass | No | No | Capsule carries public evidence and encrypted resource bytes, never signing authority. |
| Real-file A-to-B product continuity | No | No | No | No | SDK, CLI, Capsule, data plane, and Lab are not yet composed into one supported create/handoff/recover/continue workflow. This is the current P0. |
| Independent host/relay/credential-domain survival | Process-isolated model only | Three HTTP CAS processes survive one termination and disk restart | No | No | Real S7 promotion still requires distinct provider, host, administrator, credential domains, 100 trials, and seven-day burn-in. |
| Adversarial 2-of-3 Capsule custody | Yes, main | One lost/corrupt copy recovers; valid fork and below-quorum sets reject | No | No | This is content custody, not private signing-key custody or Byzantine resolution. |
| Byzantine/Sybil resistance or automatic fork resolution | No | No | No | No | Forks halt automatic progress; no winner is selected. |
| Global death certificate or proof all copies are gone | No | No | No | No | Mortality remains observer-domain-relative under explicit assumptions. |
| Firefox durable participant parity | Yes, main | Portable, S2 restart/loss/repair, and S4 counter/rotation actual-engine gates passed on `12e90e6…` | No | No | Requires an integrated release receipt before a production support claim. |
| WebKit durable participant parity | Capability-routed main | Windows rejects Ed25519; Ubuntu creates a key but fails the protocol-ceiling/full-quorum signing envelope, so both measured runtimes are verifier-only | No | No | Engine name or key generation never grants authority; full custody requires the exact bounded sign/verify probe and no raw-key fallback is allowed. |
| GPT/model authority | Intentionally absent | Not applicable | Not applicable | Not claimed | Optional model output cannot sign, select a head, or change a verdict. |

## Change rule

Any implementation, documentation, website, package, or deployment statement that
changes a row must update this matrix and its exact evidence in the same reviewed
change. Unavailable evidence is recorded as **No** or **HOLD**, never inferred from
silence or a healthy endpoint.
