# MortalOS Deep Review — 2026-07-14

Review scope: P0 protocol closure, repository reproducibility, dependency risk, Build Week rule fit, judging readiness, and the shortest path to a working Developer Tools submission.

## 1. Bottom line

MortalOS has a stronger conceptual foundation than it had at the first P0 pass, but it is not yet a working hackathon project. Its current executable artifact is a documentation/schema consistency verifier.

The review outcome is:

- **P0 specification:** PASS after six corrections;
- **dependency audit:** PASS, zero known vulnerabilities;
- **clean local P0 test:** PASS;
- **semantic protocol implementation:** not started;
- **judgeable product experience:** not started;
- **GPT-5.6 product integration:** not started;
- **Devpost submission readiness:** FAIL, with explicit blockers;
- **long-term vision:** viable only if authority continuity, state availability, execution, and resource contribution remain separate layers.

## 2. Findings and remediation

| Severity | Finding | Why it mattered | Action | Status |
|---|---|---|---|---|
| Critical | Event payload was committed but absent from validation context. | Two implementations could validate different payload knowledge against the same Pulse. | Added canonical sidecar bytes, an eighth domain, rejection codes, context rule, fixture, and tests. | Fixed |
| Critical | State loss was classified as death while heartbeat remained valid. | The vocabulary contradicted the state machine. | Split authority viability, state viability, operational life, state stall, and v0 protocol death. | Fixed |
| High | Nonce “freshness” was a validator requirement. | No local validator can prove global uniqueness. | Made secure random sampling a creator duty; byte-identical Genesis is replay. | Fixed |
| Medium | `repair` duplicated `membership-change`. | Redundant consensus labels expand code and ambiguity without adding safety. | Removed `repair` event; repair is proposal policy. | Fixed |
| Critical | Key deletion was treated as revoking already produced signatures. | A delayed or conditionally completable successor can remain valid after current keys disappear. | Added latent-successor semantics, `INV-13`, and mandatory pending-artifact tests. | Fixed |
| Critical | `state-transition` depended on an unspecified genome callback. | Identical messages could receive different results in different runtimes. | Removed state transition from v0; P8 must version a deterministic genome ABI/runtime. | Fixed |
| Medium | Ajv `8.17.1` produced a moderate security advisory. | A clean public repo should not knowingly ship a vulnerable verification dependency. | Upgraded to `8.20.0`; audit now reports zero vulnerabilities. | Fixed |
| Medium | No CI ran the documented gate. | Local PASS was not externally reproducible. | Added a Node 22 GitHub Actions workflow using `npm ci` and `npm test`. | Added; remote run pending |
| High | Current P0 verifier checks structure and cross-document consistency, not protocol semantics. | A PASS can coexist with an unimplemented validator. | README/report now state the limitation; P1 requires executable vectors and property tests. | Open by design |
| High | Raw duplicate JSON properties could be erased by ordinary parsing. | JCS and schema checks after `JSON.parse` cannot detect the original duplicate. | P1 now requires a duplicate-aware raw parser before object conversion. | Planned H1/P1 |
| Critical | No working non-trivial project, sandbox, or browser experience exists. | Fails Build Week implementation, design, and test-path expectations. | Added H1–H3 thin vertical path. | Open |
| Critical | Public repository has no license. | Devpost requires relevant licensing for a public repository; ordinary copyright is not an open-source grant. | Added explicit H0 blocker; owner must choose the license. | Open—owner decision |
| Critical | GPT-5.6 is described but not used by runnable code. | The hackathon build and video must demonstrate actual Codex/GPT-5.6 usage. | Added H4 adversarial scenario designer outside the trusted computing base. | Open |
| High | Live Devpost tagline equates network disappearance with death. | Contradicts P0: silence or partition does not prove irreversible authority loss. | Corrected README wording and added a Devpost update blocker. | Devpost draft still needs edit |
| High | Devpost project description/video/session ID are absent and state is draft. | Submission cannot be accepted as complete. | Added H5 evidence gate and compliance matrix. | Open |

## 3. The more fundamental implementation stack

The project should not start by implementing “an OS.” It should implement five layers in this order:

### Layer A — Deterministic meaning

Input bytes, canonicalization, hashes, signatures, parents, quorum, event payloads, and pending authorization evidence must have one result in every implementation. This is the protocol kernel. v0 deliberately keeps `state_root` immutable.

### Layer B — Authority continuity

Demonstrate that no single participant owns succession, every original custodian can be replaced, removed custodians lose authority, and below-quorum history cannot continue the lineage.

### Layer C — State embodiment

Only after authority works should MortalOS add content-addressed blocks, replication, recovery thresholds, and a migratable deterministic actor. State availability is a separate capability, not implied by a signature.

### Layer D — Resource and execution fabric

Scheduling, WebGPU, storage contribution, bandwidth accounting, and sandboxed computation are organs. They do not define identity or death and must not be allowed to bypass the validator.

### Layer E — Cognitive organ

An LLM may propose operations, synthesize tests, explain failures, or eventually execute a bounded process. It is downstream of identity, authority, and state embodiment.

This layered order is the deepest implementation conclusion of the review. Reversing it would produce an impressive distributed demo with no coherent answer to which state is MortalOS or whether it survived.

## 4. Build Week scope decision

The full stack cannot be built credibly before the deadline. The correct submission is **MortalOS Lab**, a developer tool that makes the root lifecycle protocol inspectable.

The minimum judgeable product is:

1. a pure validator with real cryptography;
2. a deterministic trace engine;
3. one full birth → turnover → authority death → rejected resurrection → clone scenario;
4. a coherent visual debugger for that trace; and
5. GPT-5.6 translating a developer's failure experiment into a schema-constrained scenario proposal, with the deterministic validator retaining final authority.

WebRTC, distributed model weights, general scheduling, tokens, Linux compatibility, and true state-backed mortality are explicitly deferred.

## 5. Why Developer Tools is the correct track

MortalOS is currently too abstract to make a credible consumer promise. As MortalOS Lab, it has a concrete audience and job:

> Help developers design and falsify continuity, quorum handoff, partition, clone, and mortality assumptions in ephemeral peer-to-peer or browser-native systems.

This framing maps directly to testing, security, distributed-systems debugging, and agentic workflow safety. It also gives judges a concrete task they can perform instead of asking them to accept the “digital life” metaphor.

## 6. Judging readiness

| Criterion | Current evidence | Readiness | Required improvement |
|---|---|---|---|
| Technological Implementation | Schemas, normative protocol, rejection codes, consistency verifier | Low | Real signatures, pure validator, 10,000 traces, CI evidence, clean install. |
| Design | Documentation only | None | One-click MortalOS Lab trace and coherent state visualization. |
| Potential Impact | Broad future OS/LLM vision | Low | Specific developer audience, test workflow, sample failure scenarios. |
| Quality of the Idea | Strong identity/authority/death distinction | High conceptually | Demonstrate it in code and avoid overclaiming. |

The project cannot compensate for missing implementation and design with a deeper manifesto. The next unit of progress must be executable evidence.

## 7. Backendless claim and GPT-5.6

A browser must not contain an OpenAI API key. A local companion or replaceable hosted proposal proxy is therefore acceptable for GPT-5.6, provided it is outside the protocol's trusted computing base.

The accurate architectural claim is:

> MortalOS lineage validity and state authority are peer-held and deterministic; replaceable infrastructure may provide discovery, relay, or untrusted AI proposals.

“No backend of any kind” would be both unnecessary and misleading once GPT-5.6 and WebRTC signaling are included.

## 8. Remaining decisions requiring the owner

1. Select the public repository license. Apache-2.0 is recommended; MIT is the simpler alternative.
2. Approve the narrower hackathon product name/positioning: MortalOS Lab under the existing MortalOS project.
3. Decide whether the first judge path is a hosted static browser app or a packaged local sandbox.
4. Ensure the Codex thread containing most core H1–H4 implementation is preserved and retrieve its `/feedback` session ID.
5. Approve the corrected Devpost tagline before the draft is edited.

## 9. Verification evidence

```text
npm test: PASS
npm audit --audit-level=moderate: 0 vulnerabilities
P0 schemas compiled: 2
event-payload fixtures bound: 1
negative structural mutations rejected: 8
operational lifecycle definitions checked: 19
domain separators checked: 8
unique rejection codes checked: 58
invariant mappings checked: 13
```

The GitHub Actions workflow has been added locally and must be confirmed after the repository update.

## 10. Recommended immediate next action

Implement H1/P1 as a pure TypeScript package with no React, browser transport, storage, or OpenAI dependency. Freeze its public input/output types and conformance corpus first. The first visible deliverable should be `npm run demo:trace`; MortalOS Lab and GPT-5.6 integration should consume that same core rather than reimplementing it.
