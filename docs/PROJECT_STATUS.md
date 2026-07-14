# MortalOS Project Status

As of: **2026-07-15**

Stage: **C1 portable deterministic core verified; H3 visual MortalOS Lab next**

This is the rolling status and audit document. Update it when evidence changes; use Git history for dated narratives.

## 1. Executive assessment

MortalOS now has a portable authority-lineage kernel. Genesis, signed Pulses, singleton creation, `2-of-3` handoffs, complete original-custodian turnover, replay/fork handling, latent succession, conditional mortality, and clone separation are executable.

The trusted implementation no longer depends on Node.js or the browser. Its committed result is byte-identical in direct Node execution, an isolated browser-target bundle, and actual headless Chromium. The browser can therefore become a visual adapter without creating a second validator.

The project still does not transition mutable logical state or connect participants. It supports claims about deterministic identity and authority lineage, not yet an OS, independent-host deployment, or state-bearing digital life.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
|---|---|---|
| Apache-2.0 licensing | Verified | Root license digest, package metadata, and contribution terms agree. |
| Canonical input and limits | Verified | Duplicate, UTF-8, I-JSON, JCS, byte-limit, and depth-limit tests pass. |
| Portable Genesis/Pulse cryptography | Verified | RFC 8032, mutation checks, and signed lifecycle vectors pass in Node and Chromium. |
| `1-of-1` bootstrap | Verified | Public signed birth/heartbeat and an ephemeral CLI proof adapter. Creator-controlled, not ownerless. |
| `1-of-1` → `2-of-3` expansion | Verified | Original sole key becomes insufficient; two eligible signers advance. |
| `2-of-3` continuation | Verified | Current-custodian quorum and new-custodian acceptance are enforced. |
| Stateful lineage | Verified | Replay, fork, equivocator, unknown-parent, and post-fork halt tests pass. |
| Mortality observer | Verified conditionally | Inputs are authenticated; irreversibility and key absence remain observer assumptions. |
| Portable adversarial corpus | Verified within scope | 15/15 named negatives and 10,000/10,000 fixed-seed rejects agree across runtimes. |
| Node/Chromium equivalence | Verified | Committed expected result, Node, browser-target realm, and actual Chromium are byte-identical. |
| Single-browser incubator | Planned | Portable core exists; Worker/WebCrypto key lifecycle and UI are absent. |
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
npm run demo:singleton
npm run demo:trace
npm audit --audit-level=moderate
npm pack --dry-run
```

Current results:

- license and specification gates: PASS;
- conformance tests: 26/26 PASS;
- fixed-seed Node property cases: 10,000/10,000 expected rejects;
- portable named negatives: 15/15 expected codes;
- portable fixed-seed cases: 10,000/10,000 expected rejects from seed `1297044052`;
- committed result, Node, browser-target realm, and actual Chromium: byte-identical;
- trusted-core coverage: 98.69% lines, 93.40% branches, 100% functions;
- fresh-process deterministic trace comparison: PASS;
- H2 trace digest: `1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606`;
- clean-room locked install/full suite/Chromium run: PASS;
- dependency audit: zero known vulnerabilities at the moderate threshold; and
- package, link, and repository secret scans: PASS within their declared patterns.

Cross-runtime agreement, coverage, and mutation corpora are strong regression evidence, not a second independent implementation or a security proof.

## 4. Review findings

### Closed — runtime portability was on the trusted path

Trusted `src/` modules now use portable bytes, structural validation, SHA-256, and strict Ed25519. The source gate rejects Node, `Buffer`, filesystem, process, DOM, network, clock, and ambient-random dependencies. Ajv remains development-only to compare the portable structural validators with the normative JSON Schemas.

### High — two bootstrap profiles serve different purposes

The verified CLI singleton uses one key and makes solitary creation minimal, but one key controls continuation. The planned browser incubator uses three logical keys with a `2-of-3` threshold, but one browser can still hold quorum and remains one physical failure domain. Neither arrangement proves ownerless continuation. That stronger claim begins only when no physical or administrative failure domain controls the accepted threshold.

### High — endpoint neutrality must survive product work

Browser is first because it gives judges a zero-install, visual explanation. It is not the world boundary. CLI, browser, native, service, embedded, and future transport adapters must all submit canonical evidence to the same kernel and reproduce the committed result corpus.

### Medium — accepted-context capability is process-local

The private `WeakSet` correctly prevents forged acceptance objects, but it cannot cross process restart or persistence. A durable application must store canonical evidence and replay it through `createLineage`, never deserialize an acceptance flag.

### Medium — the property corpus has a bounded claim

The 10,000 cases mutate signed fields or evidence and assert rejection. A public signed-fork fixture covers one valid competing history, but future lineage fuzzing should generate broader correctly re-signed churn, delayed acceptances, and restart/rebuild sequences.

### Fundamental research gap — no state-bearing life

`state_root` is immutable in v0 and no genome executes. Networking, browser Workers, CLI commands, or GPT integration would not close this gap. A later protocol version must define deterministic state bytes, transition inputs, execution limits, and availability evidence.

## 5. Decision

Proceed with **H3 MortalOS Lab** as the next delivery gate. It must import the verified portable kernel and expose browser creation, lifecycle inspection, mutation, replay, fork, and qualified mortality without adding validity logic.

Develop **C2 stable CLI** as the next non-browser access milestone using the same evidence-record and trace formats. The next fundamental research gate remains **R2 deterministic state-bearing kernel**.

## 6. Documentation policy

Current documentation contains only normative rules, rolling status/plan, access and deployment profiles, traceability, and the submission checklist. Historical audits, verification snapshots, and manual build logs remain in Git history and must not be reintroduced as competing current truth.
