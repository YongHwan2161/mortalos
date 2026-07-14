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
- removed `repair` as a duplicate consensus event kind;
- added `INV-11` and `INV-12` with planned tests;
- upgraded Ajv after a moderate advisory and obtained a zero-vulnerability audit;
- added clean-checkout CI; and
- reconciled the implementation plan with live Devpost rules, judging criteria, required submission fields, and date conflicts.

No P1 semantic validator, browser demo, or GPT-5.6 runtime integration existed at the end of this entry.

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
