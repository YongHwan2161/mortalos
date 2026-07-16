# Build Week Submission Checklist

Status: **active pre-submission product checklist; the repository is not yet submission-ready**

Last repository review: **2026-07-16**

Official event rules and the submission form remain authoritative. This file tracks durable repository evidence and intentionally omits transient form-field snapshots.

## Product position

- Product: **MortalOS Lab**
- Track: **Developer Tools**
- Job: let developers inspect and falsify identity, custody, replay, fork, turnover, and mortality assumptions in ephemeral multi-endpoint systems.

## Evidence state

| Requirement | State | Evidence or blocker |
|---|---|---|
| Public source and Apache-2.0 | Complete | Repository, root license, package metadata, contribution terms |
| Reproducible portable core | Implemented; exact-head gate required | Locked install, trust-boundary/conformance/property tests, coverage, deterministic H2 v4 traces, and all seven mortality-limit variants are implemented; every published SHA requires immutable-head review and its own Verify run |
| Node/Chromium differential | Implemented as a two-step gate | `verify:portable` establishes committed/Node/browser-target equality, then `test:chromium` compares actual Chromium with the committed result; every deployed/reviewed head needs its own successful Verify run |
| Canonical wire contract and independent verifier | Blocked | R1 must define bounded versioned operation/result bytes and replay them in an independently written non-JavaScript verifier |
| One-person CLI birth proof | Complete within proof scope | Ephemeral singleton birth/heartbeat; not a stable CLI product |
| No-rebuild developer-tool path | Blocked | H3A works locally; R1-C must first move it onto bounded wire records, then H3B can publish it over HTTPS |
| One-person visual browser birth | Implemented; exact-head gate required | The actual-Chromium gate covers three non-extractable Worker keys, 3/3 Genesis, one-key rejection, every 2-key heartbeat combination, and controlled termination |
| Reference falsification Lab | Implemented; exact-head gate required | The actual-Chromium gate covers turnover, four mutations, replay, signed fork, resurrection, mortality qualification, clone, corpus, and export |
| Meaningful GPT-5.6 use | Blocked | Scenario designer not implemented |
| Accurate project story/tagline | Open | Must describe only the final demonstrated scope |
| Public demo video | Blocked | Record after build and deployment freeze |
| `/feedback` Codex Session ID | Open | Preserve and record the session containing most core work |
| Final secret/license/package scan | Open | Current source passes; repeat against deployed commit and assets |

Git history is the canonical provenance record. The concept predates the event; repository commits identify implementation produced during the eligible period.

## Minimum judge path

1. one-person browser birth;
2. valid logical `2-of-3` heartbeat;
3. fixed public reference custody turnover with stable identity, visibly distinct from the random live organism;
4. replay/fork inspection;
5. qualified below-quorum mortality and rejected resurrection;
6. clone with a different identity; and
7. one accepted and one rejected GPT-generated scenario proposal.

The CLI singleton may be shown as evidence of endpoint neutrality, but it does not replace the visual judge path.

## No-submit conditions

Do not submit while:

- the executable path and public claims disagree;
- network silence, browser close, CLI exit, or an incomplete evidence inventory is presented as globally proven death;
- `1-of-1` creation is presented as ownerless authority;
- logical key quorum is presented as independent physical distribution;
- the judge cannot open the demonstrated product without rebuilding;
- GPT is described but not invoked in the submitted path;
- repository, deployment, and video use different commits or behavior;
- the `/feedback` session ID is missing; or
- any API key, token, private custodian key, or restricted artifact appears in source, history, logs, screenshots, or bundles.

## Claim discipline

Prefer:

- `portable lifecycle and evidence kernel`;
- `creator-controlled 1-of-1 bootstrap`;
- `logical 2-of-3 key quorum`;
- `one physical failure domain before handoff`;
- `local authority lost under controlled ephemeral-key assumptions`;
- `dead under v0 assumptions only with explicit irreversibility and a complete pending-evidence basis`; and
- `peer-validated evidence with participant-held custody authority and replaceable bootstrap infrastructure, without claiming ownerlessness until independently evidenced distribution`.

Do not claim globally provable death, guaranteed erasure, Byzantine safety, Sybil resistance, state-backed mortality, zero infrastructure, a running OS, or ownerless computation before the corresponding gate is implemented and demonstrated.
