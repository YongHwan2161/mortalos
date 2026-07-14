# MortalOS Core Verification Report

Date: **2026-07-14**  
Scope: `mortalos/0` Node reference core, lineage registry, controlled mortality observer, and H2 trace v2.

## 1. Verified claims

- Raw input is UTF-8 decoded with duplicate-property detection before object conversion.
- Raw envelopes, payloads, and JSON depth are bounded by normative deterministic limits before expensive validation.
- Canonical checks follow the RFC 8785 JSON value domain used by v0, including the RFC number and UTF-16 sorting examples.
- Genesis identity, Pulse identity, custody commitments, event payloads, peer IDs, approvals, and acceptances use separate SHA-256 domains.
- Ed25519 verification passes RFC 8032 vector 1 and the public MortalOS signed corpus.
- Genesis requires all initial custodians; Pulse progression requires the current parent-derived quorum; newly added custodians must accept.
- Accepted contexts are recursively immutable and cannot be reproduced by clone or JSON serialization.
- The lineage registry rejects exact replay, detects valid siblings, exposes approval intersection, and freezes automatic progress after a fork.
- Mortality evaluation counts only distinct validator-authenticated direct-child succession evidence, including current-quorum-approved handoffs awaiting listed new-custodian acceptances.
- The H2 trace preserves identity through complete original-custodian replacement, rejects replay and snapshot resurrection, and separates clone identity.

This report does not claim browser networking, Byzantine consensus, global proof of death, mutable logical state, genome execution, distributed compute, or an ownerless LLM.

## 2. Commands

```bash
npm ci
npm test
npm run test:coverage
npm run demo:trace
npm audit --audit-level=moderate
```

Supported local runtime: Node.js **22.5 or later**. CI uses the latest Node.js 22 release.

## 3. Results

| Evidence | Result |
|---|---|
| Apache-2.0 exact-text digest | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| P0 executable documentation/schema gate | PASS |
| Conformance tests | 22/22 PASS |
| Fixed-seed property corpus | 10,000/10,000 expected rejects |
| Trusted-core line coverage | 98.40% |
| Trusted-core branch coverage | 91.51% |
| Trusted-core function coverage | 100.00% |
| Fresh-process deterministic trace comparison | PASS |
| H2 trace v2 digest | `1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606` |
| Clean-room `npm ci` and full suite | PASS |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| `npm pack --dry-run` local-artifact check | PASS; no upload/tool-local files |

Coverage is aggregated across codec, cryptography, rejection manifest, validator, lineage, and mortality modules; the npm gate requires at least 90% aggregate branch coverage.

The package is intentionally marked private while its public distribution contract is undefined. Git and npm packaging rules exclude local uploads, tool state, environment files, logs, coverage, and generated archives.

## 4. Trust-boundary evidence

The verifier distinguishes a genuine accepted result from a structurally identical clone:

| Context supplied to `validatePulse` | Result |
|---|---|
| Original validated Genesis and parent | candidate may proceed to semantic/signature checks |
| `structuredClone(validatedGenesis)` | `E_LINEAGE_UNKNOWN` |
| `structuredClone(validatedParent)` | `E_PARENT_REQUIRED` |
| Hand-built object with `status: "accept"` | rejected |

Accepted result objects and nested custody arrays are frozen. This is an in-process capability only. Persistence must store canonical source bytes and reconstruct the graph by replay.

## 5. Stateful lineage evidence

The generated-key test creates three alternative, fully signed sequence-1 membership changes from one Genesis. Private keys exist only in test-process memory.

1. First child: `accept` and becomes the linear head.
2. Same child again: `E_REPLAY_STALE`.
3. Second distinct valid child: `E_FORK_DETECTED`; both child hashes and shared approver IDs are returned; recognized head becomes `null`.
4. Third distinct valid child: `E_LINEAGE_ALREADY_FORKED`.

This proves detection and fail-closed behavior, not Byzantine fork resolution.

## 6. Controlled mortality evidence

`evaluateMortality` requires:

- a genuine validated head;
- declared usable current key IDs;
- an explicit state-availability observation;
- zero or more genuine validated direct-child or authenticated partial-latent results; and
- an explicit irreversibility assumption.

A cloned latent result is rejected as input. A fully valid direct child or a current-quorum-approved handoff awaiting only verified/listed new-custodian acceptances prevents a death conclusion after current-key loss. Once no such evidence is supplied and authority loss is declared irreversible below threshold, the result is `dead_under_v0_assumptions`.

This remains an experimental classification under declared observations, not a universally provable network fact.

## 7. H2 trace v2

The deterministic trace proves:

```text
Genesis ABC
  -> BCD
  -> CDE
  -> current-quorum-approved partial DEF handoff survives current-key loss
  -> DEF
  -> replay of DEF rejected
  -> state-stalled classification
  -> controlled authority-death classification
  -> unsigned public-snapshot continuation rejected (0/2)
  -> same-genome new Genesis accepted under a different organism_id
```

Trace digest:

```text
1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606
```

## 8. Residual conformance work

- Extract a platform-neutral implementation and run the same corpus in Chromium.
- Publish canonical input/result byte fixtures independent of the JavaScript API.
- Build a second independent implementation for true differential validation.
- Generate valid competing-history and churn corpora, not only invalid mutations.
- Add persistent raw-evidence replay and verify identical graph/fork reconstruction after restart.

The current core is sufficient to begin portability work. It is not sufficient to claim a browser OS or state-bearing digital life.
