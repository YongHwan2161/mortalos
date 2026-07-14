# MortalOS Project Status

As of: **2026-07-15**

Review base: `origin/main` at `622313a`

Stage: **C0 trusted Node core verified; C1 portable deterministic core next**

This is the rolling status and audit document. Update it when evidence changes; use Git history for dated narratives.

## 1. Executive assessment

MortalOS has a credible authority-lineage kernel. Genesis, signed Pulses, `2-of-3` handoffs, complete original-custodian turnover, replay/fork handling, latent succession, conditional mortality, and clone separation are executable.

The project still does not run its trusted core in a browser and does not transition mutable logical state. It therefore supports claims about deterministic identity and authority lineage, not yet a browser OS, independent-host deployment, or state-bearing digital life.

No new critical implementation defect was reproduced in this review. The highest-leverage next implementation is portability: one semantic core must produce byte-identical results in Node.js and Chromium before browser UI work begins.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
|---|---|---|
| Apache-2.0 licensing | Verified | Root license digest and package metadata agree. |
| Canonical input and limits | Verified | Duplicate, UTF-8, I-JSON, JCS, byte-limit, and depth-limit tests pass. |
| Genesis/Pulse cryptography | Verified | RFC 8032 and signed lifecycle vectors pass. |
| `2-of-3` continuation | Verified in Node | Current-custodian quorum and new-custodian acceptance are enforced. |
| Stateful lineage | Verified in Node | Replay, fork, equivocator, unknown-parent, and post-fork halt tests pass. |
| Mortality observer | Verified conditionally | Inputs are authenticated, but irreversibility/key absence remain observer assumptions. |
| Adversarial corpus | Verified within scope | 10,000 mutated invalid continuations reject; this is not arbitrary valid-history generation. |
| Node/Chromium equivalence | Not implemented | Node-specific APIs remain in the trusted modules. |
| Single-browser incubator | Planned | The protocol permits multiple keys per browser; Worker/WebCrypto lifecycle is absent. |
| Independent-browser survival | Not implemented | Requires the portable core, browser signing, handoff, and transport. |
| Mutable state/genome execution | Deferred | v0 deliberately preserves the Genesis state root. |
| GPT scenario designer | Not implemented | Model output remains an architectural boundary only. |

## 3. Verification snapshot

Commands:

```bash
npm ci
npm test
npm run test:coverage
npm run demo:trace
npm audit --audit-level=moderate
npm pack --dry-run
```

Current results:

- license and specification gates: PASS;
- conformance tests: 22/22 PASS;
- fixed-seed adversarial cases: 10,000/10,000 expected rejects;
- trusted-core coverage: 98.40% lines, 91.51% branches, 100% functions;
- fresh-process deterministic trace comparison: PASS;
- H2 trace digest: `1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606`;
- dependency audit: zero known vulnerabilities at the moderate threshold; and
- package and repository scans: no known private key/token matches or tool-local upload paths.

Coverage and a 10,000-case mutation corpus are useful regression evidence, not an independent security proof.

## 4. Review findings

### High — browser portability is on the trusted path

`src/codec.mjs` uses `Buffer`; `src/crypto.mjs` imports `node:crypto`; and `src/validator.mjs` uses `node:module` to load schemas. Copying those semantics into browser UI would create two validators and reopen consensus disagreement. C1 must isolate platform adapters while preserving one validation order and result vocabulary.

### High — key quorum was confused with peer independence

The implementation counts unique eligible key IDs, but prior prose claimed that one peer could not satisfy `2-of-3`. A single process holding two keys can satisfy it. The protocol and threat model now distinguish logical quorum from people, browsers, devices, and physical failure domains.

### High — the requested one-person birth remains unimplemented

The intended page must create three volatile logical custodians, obtain unanimous Genesis approval, and later use any two keys for a Pulse. Closing the sole page before handoff should lose local authority under explicit assumptions. The current Node trace validates pre-signed evidence; it is not this browser experience.

### Medium — accepted-context capability is process-local

The private `WeakSet` correctly prevents forged acceptance objects, but it cannot cross process restart or persistence. A durable application must store canonical evidence and replay it through `createLineage`, never deserialize an acceptance flag.

### Medium — the property corpus has a bounded claim

The 10,000 cases mutate signed fields or evidence and assert rejection. They do not generate arbitrary, correctly re-signed competing histories. Future lineage fuzzing should include valid churn, valid sibling forks, delayed acceptances, and restart/rebuild sequences.

### Fundamental research gap — no state-bearing life

`state_root` is immutable in v0 and no genome executes. Networking, browser Workers, or GPT integration would not close this gap. A later protocol version must define deterministic state bytes, transition inputs, execution limits, and availability evidence.

## 5. Decision

Proceed with **C1 portable deterministic core** as specified in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). It is the prerequisite for both the single-browser incubator and MortalOS Lab. The next fundamental research gate remains a versioned deterministic state-bearing kernel, but it should not displace C1 from the immediate delivery path.

## 6. Documentation policy

Current documentation contains only normative rules, rolling status/plan, deployment profile, traceability, and submission checklist. Historical audits, verification snapshots, and build logs remain available through Git history and must not be reintroduced as competing current truth.
