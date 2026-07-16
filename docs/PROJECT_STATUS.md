# MortalOS Project Status

As of: **2026-07-16**

Stage: **P0 mortality-proof reconciliation locally verified; exact-head publication gates pending**

Security baseline: **incomplete evidence, runtime drift, and work exhaustion cannot classify death**

This is the rolling status and audit document. Update it when evidence changes; use Git history for dated narratives.

## 1. Executive assessment

MortalOS now has a portable authority-lineage kernel. Genesis, signed Pulses, singleton creation, `2-of-3` handoffs, complete original-custodian turnover, replay/fork handling, latent succession, conditional mortality, and clone separation are executable. Byte acquisition, Ed25519 points, validation order, handoff activation, and mortality authority have explicit fail-closed boundaries rather than relying on caller discipline.

The trusted implementation no longer depends on Node.js or the browser. H3A uses that kernel in a local one-page Lab rather than creating a second validator. The current P0 candidate requires explicit irreversible authority loss **and** an explicitly complete latent-evidence inventory before death; malformed declared carriers and validator uncertainty abort; captured realm/crypto integrity is checked before analysis; and excessive usable-ID count/code units, pending records, owned evidence bytes, or signature-verification work returns `indeterminate / limit_exceeded` without truncation or graph mutation. Every changed head must rerun both the differential gate and the Lab acceptance gate before publication.

The project still does not transition mutable logical state or connect participants. It supports claims about deterministic identity and authority lineage, not yet an OS, independent-host deployment, or state-bearing digital life.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
|---|---|---|
| Apache-2.0 licensing | Verified | Root license digest, package metadata, and contribution terms agree. |
| Canonical input and limits | Verified | Intrinsic-backed snapshots ignore hostile view metadata and reject shared/detached storage. Programmatic canonicalization uses captured internal-slot probes plus one data-descriptor snapshot, rejects accessors without invoking their value getters, and documents the transparent-Proxy limit. Duplicate, UTF-8, I-JSON, JCS, byte, and exact root-depth rules remain enforced. |
| Portable Genesis/Pulse cryptography | Verified baseline; rerun required | RFC 8032 plus canonical, non-small-order, torsion-free prime-subgroup point checks and signed lifecycle vectors passed prior Node 22/browser-target/actual-Chromium publication gates. The current changed head must rerun the same evidence. |
| Deterministic validation | Verified | Public validators are total, preserve stable envelope-before-payload first-error precedence, and keep public durable-latent validation supplied-evidence-only. |
| `1-of-1` bootstrap | Verified | Public signed birth/heartbeat and an ephemeral CLI proof adapter. Creator-controlled, not ownerless. |
| `1-of-1` → logical `2-of-3` expansion | Verified | One-process generated-key proof: original sole key becomes insufficient and two eligible signers advance; physical distribution is not established. |
| `2-of-3` continuation | Verified | Current quorum, acceptance signatures, and sufficiency of the supplied next-quorum activation set are enforced. |
| Stateful lineage | Verified | Replay, fork, equivocator, unknown-parent, and post-fork halt tests pass. |
| Mortality observer | P0 reconciliation locally verified | The lineage supplies its recognized head through a private constructor capability, blocks reentrant mutation, owns every declared carrier, recursively discovers target-tuple bodies and exact tagged signatures, reconstructs evidence per exact body, and filters projected usable signers through sign-once commitments. Authenticated multi-body evidence, payload uncertainty, incomplete inventory, forks, and fixed work-limit overflow remain unclassified. Runtime/crypto drift and malformed declared carriers abort. Death requires exact irreversibility plus explicit completeness. The honest Proxy-free producer, carrier placement, completeness, global usability, and hidden-copy assumptions remain outside cryptographic proof. |
| Portable adversarial corpus | v5 candidate | Corpus v5 adds explicit incomplete-versus-complete mortality evidence to deterministic mortality-limit overflow, strict points, trust boundaries, same-body completion, sign-once-aware equivocation, missing-membership-payload uncertainty, 15/15 named negatives, eight boundary outcomes, and 10,000 fixed-seed rejects. Node/browser-target/actual-Chromium equality is required on the exact publication head. H3A additionally verifies actual-browser SAB rejection under cross-origin isolation. |
| Node/Chromium equivalence | Node/browser-target local PASS; actual browser pending | The committed v5 result, direct Node 24, and isolated browser-target realm are byte-identical on this candidate. Local Playwright Chromium installation returned a zero-byte/truncated CDN archive even after a workspace-cache and elevated retry, so the final immutable remote head must supply actual-Chromium evidence; any code change invalidates the prior run. |
| Single-browser incubator | Prior actual-browser proof; current unit proof | Three dedicated Workers hold non-extractable WebCrypto keys; 3/3 birth, one-key rejection, every 2-key heartbeat pair, controlled termination, and the one-physical-domain warning passed the earlier actual-Chromium gate. The current head must rerun it. Live retirement asserts incomplete evidence and cannot claim death. |
| MortalOS Lab | Candidate locally verified | Reference turnover, mutation, replay, fork, explicitly complete closed-fixture mortality, runtime-drift aborts, resurrection rejection, clone separation, 10,000-case corpus, canonical public-evidence export/replay, and unit/static gates pass. Exact-head actual-browser verification and public HTTPS H3B remain open. |
| Independent verifier | Not implemented | R1 must define canonical bounded operation/result bytes and reproduce them with an independently written non-JavaScript verifier before adapter surfaces become the long-term contract. |
| Stable CLI | Proof only | Creation works in memory; import, persistence, replay, export, and compatibility contract are absent. |
| Independent-participant survival | Not implemented | Requires adapters, signing lifecycle, handoff, and transport. |
| Mutable state/genome execution | Deferred | v0 deliberately preserves the Genesis state root. |
| GPT scenario designer | Not implemented | Model output remains an architectural boundary only. |

## 3. Verification snapshot

Commands:

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run verify:lab
npm run demo:singleton
npm run demo:trace
npm audit --audit-level=moderate
npm pack --dry-run
```

Current results:

- license and specification gates: PASS;
- conformance tests: 70/70 PASS locally on this candidate;
- fixed-seed Node property cases: 10,000 mixed valid/invalid continuations (1,008 accepts and 8,992 rejects) with exact expected outcomes and invariant preservation;
- portable named negatives: 15/15 expected codes;
- portable boundary probes: 8/8 expected outcomes in Node and the isolated browser-target, including deterministic pending-count and usable-ID-character mortality overflow;
- portable fixed-seed cases: 10,000/10,000 expected rejects from seed `1297044052`;
- committed portable v5 result, direct Node 24, and isolated browser-target realm: byte-identical; 10,000/10,000 adversarial rejects; actual Chromium remains part of the exact-head remote gate;
- trusted-core coverage: 96.14% line, 93.01% branch, and 95.18% function across 69 tests, including `src/primordials.mjs`; the aggregate branch floor is 90%;
- fresh-process deterministic trace comparison: PASS;
- H2 trace format: `mortalos-lifecycle-trace/4`;
- H2 trace digest: `19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399`;
- clean locked installation and full `npm test`: PASS; conformance 70/70, governance 30/30, mortality 22/22, Lab 5/5, static Lab build, portable v5, singleton, and H2 v4 all pass;
- actual Chromium differential: locally blocked before launch because every Playwright CDN attempt returned a zero-byte/truncated archive; exact-head remote Verify remains mandatory;
- H3A actual-Chromium acceptance: historical PASS in three clean contexts; the exact reconciled head must rerun all `2-of-3` pairs, full reference experiments, 10,000 adversarial cases, runtime-drift probes, cross-origin-isolated SAB rejection, canonical export/replay, and clean storage/network/console boundaries;
- dependency audit: zero known vulnerabilities at the moderate threshold;
- package dry-run: PASS with 77 files, including the static Lab source, `src/primordials.mjs`, and build/verification scripts; and
- link and repository secret scans: PASS within their declared patterns.

Cross-runtime agreement, coverage, and mutation corpora are strong regression evidence, not a second independent implementation or a security proof.

## 4. Review findings

### Closed — runtime portability was on the trusted path

Trusted `src/` modules now use portable bytes, structural validation, SHA-256, and strict Ed25519. The source gate rejects Node, `Buffer`, filesystem, process, DOM, network, clock, and ambient-random dependencies. Ajv remains development-only to compare the portable structural validators with the normative JSON Schemas.

### Closed — hostile inputs could cross runtime trust boundaries

The kernel now snapshots byte inputs through captured intrinsics, rejects `SharedArrayBuffer`, validates Ed25519 public/signature points under one strict subgroup profile, and makes validation APIs total. Programmatic canonicalization rejects accessors and the explicitly probed, detectable internal-slot objects from one descriptor snapshot; canonical bytes remain the stronger side-effect-free boundary, and the Proxy/exotic limits are explicit in the protocol. Stable first-error precedence is explicit and next-custody transitions cannot be accepted without an activatable supplied quorum. Mortality cannot trust a caller-selected head, leaked constructor, unsigned evidence labels, carrier placement, or fabricated latent result: it reconstructs exact-body evidence cryptographically, applies sign-once to projected usable keys, tries strict acceptance first, leaves authenticated equivocation unclassified, and—only after authority loss is declared irreversible—lets a completion-capable payload-opaque membership body block a death conclusion that lacks independent fresh-quorum or verified-latent evidence. Internal conditional helpers are not re-exported by `src/index.mjs`.

### Closed in P0 candidate — absence and runtime drift could manufacture death

Earlier mortality logic treated an empty pending list as if it proved that no latent successor existed. Independent review reproduced a contradiction: the same irreversible-loss observation reported death with an empty list, then reported `latent_successor_not_dead` when one already valid direct child was added. A separate mutation of trusted runtime dispatch or crypto state could also collapse valid evidence into false absence. The candidate now requires an explicit complete-inventory assertion, owns and parses every declared carrier or aborts, discovers target bodies/signatures recursively, and verifies captured realm/crypto integrity before analysis. Missing completeness, late evidence, malformed carriers, and runtime drift cannot become death.

### Closed in P0 candidate — mortality work was unbounded

The observer now fixes limits of 16 supplied usable IDs, 768 total usable-ID UTF-16 code units, 128 pending records, 4 MiB of owned pending bytes, and 4,096 conservative attacker-proportional signature-verification work units. Every usable ID must be one canonical `peer:` identifier. Fixed crypto known-answer tests are constant integrity overhead outside that budget. Any overflow returns a structured unclassified result and leaves the graph unchanged. This trades an availability false-negative under evidence flooding for the safety property that resource pressure cannot manufacture a death conclusion.

### Residual — JavaScript observer containers are not an independent evidence format

The bounded observer intentionally reads only documented names and indices and never enumerates caller-owned containers. That closes the unbounded `ownKeys` path, but unknown fields are ignored and a transparent Proxy can lie through targeted descriptor traps. Correctness therefore still trusts an honest Proxy-free producer, documented carrier placement, and a truthful completeness assertion. R1 must replace this boundary with canonical bounded bytes and an independent non-JavaScript verifier; hidden copies and global completeness will remain explicit policy assumptions.

### High — two bootstrap profiles serve different purposes

The verified CLI singleton uses one key and makes solitary creation minimal, but one key controls continuation. The implemented local browser incubator uses three logical keys with a `2-of-3` threshold, but one browser can still hold quorum and remains one physical failure domain. Neither arrangement proves ownerless continuation. That stronger claim begins only when no physical or administrative failure domain controls the accepted threshold.

### High — endpoint neutrality must survive product work

Browser is first because it gives judges a zero-install, visual explanation. It is not the world boundary. CLI, browser, native, service, embedded, and future transport adapters must all submit canonical evidence to the same kernel and reproduce the committed result corpus.

### Medium — accepted-context capability is process-local

The private `WeakSet` correctly prevents forged acceptance objects, but it cannot cross process restart or persistence. A durable application must store canonical evidence and replay it through `createLineage`, never deserialize an acceptance flag.

### Medium — the property corpus has a bounded claim

The property corpus mixes 1,008 baseline-valid continuations with 8,992 signed-field or evidence mutations and checks exact outcomes. Its accepted cases reuse fixed signed fixtures; future lineage fuzzing should generate broader correctly re-signed churn, delayed acceptances, and restart/rebuild sequences.

### Fundamental research gap — no state-bearing life

`state_root` is immutable in v0 and no genome executes. Networking, browser Workers, CLI commands, or GPT integration would not close this gap. A later protocol version must define deterministic state bytes, transition inputs, execution limits, and availability evidence.

## 5. Decision

Publish the P0 candidate only after its exact-head Node/browser-target/actual-Chromium, Lab, coverage, audit, package, policy, and independent-review gates pass, followed by the same post-merge `main` verification.

Then implement **R1 canonical authority-observation records and an independent non-JavaScript verifier**. This is the next architectural gate because the false-death defect exposed an implementation-bound object-graph assumption. H3B should follow as the next delivery gate and consume R1 as a thin adapter; it must publish the reviewed artifact over HTTPS with the required isolation/security headers and prove the logged-out judge path from the deployed commit.

Develop **C2 stable CLI** as the next non-browser access milestone using the same R1 operation/result and trace formats. The next fundamental state research gate remains **R2 deterministic state-bearing kernel**.

North Star: authenticated evidence plus participating resources—not a browser, server, CLI, transport, model, or administrator—must determine one entity's identity, executable state, succession authority, and qualified death while every original host can be replaced. R1 makes today's authority/death decisions independently reproducible; H3 explains and falsifies them; R2 then adds the missing deterministic state-bearing life kernel.

## 6. Documentation policy

Current documentation contains only normative rules, rolling status/plan, access and deployment profiles, traceability, and the submission checklist. Historical audits, verification snapshots, and manual build logs remain in Git history and must not be reintroduced as competing current truth.
