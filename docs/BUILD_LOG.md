# Build Week Provenance Log

Hackathon submission period opened: **2026-07-13T16:00:00Z**  
Project concept: predates the submission period  
Repository implementation and documentation: began after the submission period opened

This log distinguishes the earlier idea from Build Week implementation work. Git commit timestamps remain the primary evidence; this document explains the intent and decisions behind them.

## 2026-07-14 — Repository and P0 baseline

Created the public MortalOS repository and converted the prior concept into a gate-driven implementation plan.

Codex-assisted work:

- decomposed the vision into identity, authority, lineage, state, death, clone, and host turnover;
- drafted the initial P0 protocol, threat model, schemas, rejection codes, and traceability;
- implemented a reproducible P0 documentation/schema verifier; and
- marked the first P0 specification gate complete.

Human-owned direction:

- pursue an ownerless network-native entity rather than a compute marketplace alone;
- treat life and death as the root research problem;
- publish the work as open source, subject to a final license choice; and
- target the OpenAI Build Week Developer Tools category.

## 2026-07-14 — Corrective red-team review

Re-opened P0 instead of treating the first PASS as final.

Corrections:

- added exact canonical event-payload sidecars to the complete validation input;
- replaced unverifiable global nonce freshness with a creator randomness obligation;
- split authority viability, state viability, operational life, state stall, and v0 protocol death;
- required controlled mortality tests to account for already signed latent successors;
- removed `state-transition` from v0 because an unspecified genome callback is not a deterministic consensus rule;
- removed `repair` as a duplicate consensus event kind;
- added `INV-11` through `INV-13` with planned tests;
- upgraded Ajv after a moderate advisory and obtained a zero-vulnerability audit;
- added clean-checkout CI; and
- reconciled the implementation plan with live Devpost rules, judging criteria, required submission fields, and date conflicts.

No P1 semantic validator, browser demo, or GPT-5.6 runtime integration existed at the end of this entry.

## 2026-07-14 — Apache-2.0, H1 validator, and H2 Minimum Viable Life

Implemented after the submission period opened:

- applied the unmodified Apache License 2.0 text and aligned package/contribution metadata;
- implemented duplicate-aware UTF-8/JSON parsing and deterministic canonical bytes;
- implemented all v0 domain-separated hashes and strict prefixed-base64url decoding;
- implemented deterministic Genesis and Pulse semantic validation with stable rejection codes;
- verified RFC 8032 Ed25519 vector 1 and a public-key-only MortalOS signed corpus;
- implemented three valid `2-of-3` custodian handoffs from ABC through DEF;
- demonstrated latent-successor survival, state stall, controlled authority death, public-snapshot rejection, and a distinct same-genome clone;
- added 10,000 fixed-seed adversarial trace continuations, cross-process determinism, and a 90% validator branch-coverage gate; and
- updated the protocol, rejection-code boundary, traceability, Build Week plan, README, and Devpost matrix.

Codex contribution:

- translated the normative validation order into the executable reference core;
- detected and corrected the schema/semantic boundary that had made quorum and encoding rejection codes unreachable;
- detected locale-sensitive custodian ordering during fixture verification and replaced it with protocol-defined ASCII byte order;
- generated public conformance signatures locally, then removed all temporary signing material before repository publication; and
- built the replayable H2 evidence and verification report.

Human decisions:

- selected Apache-2.0;
- authorized implementation of H1 and H2;
- retained the controlled honest-ephemeral-key mortality scope; and
- kept browser networking, general computation, and distributed LLM work behind the lifecycle proof.

Tests/evidence:

- `npm test`: PASS;
- GitHub commit: `b459485d3109e99ddb3e958c6108a50580074d1e`;
- remote readback: 39/39 blob SHA matches, zero mismatches;
- GitHub Actions `Verify` run 13: success;
- RFC 8032 vector and signed MortalOS lifecycle corpus: PASS;
- seeded adversarial continuations: 10,000/10,000;
- validator coverage: 98.97% lines, 91.58% branches, 100% functions; and
- H2 trace SHA-256: `7b3046231a61f7b21882b02b67114941daccb3e4fb8b2fee745ab0e16de45ab7`.

Known limitations:

- Node.js reference implementation only;
- no fork-aware accepted-object store or independent second implementation;
- no H3 browser Lab or hosted judge path; and
- no H4 GPT-5.6 runtime integration.

## Evidence still required

- the `/feedback` Codex Session ID for the thread containing most H1–H4 core functionality;
- dated commits for the pure validator, trace engine, browser lab, and GPT-5.6 boundary;
- clean CI results;
- hosted demo and video identifiers; and
- the owner-selected license commit.

## Entry template

```markdown
## YYYY-MM-DD — Capability

Commit(s):
Codex contribution:
Human decisions:
Tests/evidence:
Known limitations:
```
