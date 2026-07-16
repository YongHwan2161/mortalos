# MortalOS

**An endpoint-neutral lifecycle protocol for network-native entities.**

MortalOS separates identity, continuation authority, lineage, state availability, and observable liveness. Its long-term question is whether one network-native entity can preserve an authorized identity after every original host has been replaced—and stop when succession becomes impossible under explicit assumptions.

## Honest status

The current artifact is a verified **portable protocol and evidence kernel with CLI and Chromium proof adapters**, not yet an OS, participant network, or state-bearing digital life.

Implemented:

- portable `Uint8Array` processing with intrinsic-backed immutable snapshots, `SharedArrayBuffer` rejection, duplicate-aware UTF-8/I-JSON parsing, exact root-depth limits, and data-only RFC 8785 canonicalization that rejects accessors and the explicitly probed, detectable internal-slot objects (subject to the Proxy/exotic limits in the protocol);
- eight domain-separated SHA-256 derivations and strict RFC 8032 Ed25519 verification, including canonical prime-subgroup checks for public keys and signature points;
- Genesis and Pulse validation for strict-majority custody descriptors from `1-of-1` through 16 custodians;
- total public validators with stable first-error precedence, non-forgeable recursively frozen contexts, and supplied-evidence-only public latent validation;
- membership handoff validation that proves the declared next quorum can activate from supplied approval and acceptance evidence;
- a lineage registry that rejects replay, detects valid siblings, exposes quorum equivocation, and halts after a fork;
- resource-bounded recognized-head mortality that recursively discovers target-tuple bodies and exact Ed25519 signature strings throughout every declared envelope/payload JSON tree; reconstructs same-body evidence cryptographically; filters one explicit usable-key snapshot through sign-once commitments; keeps equivocation, payload uncertainty, and incomplete evidence unclassified; verifies its captured runtime and crypto state before analysis; and returns `indeterminate / limit_exceeded` instead of classifying a truncated evidence set;
- a public singleton birth/heartbeat, a verified `1-of-1` to logical `2-of-3` custody/authority expansion, and the complete A/B/C → D/E/F lifecycle;
- a v5 committed result corpus with 15 named negatives, eight reported boundary outcomes, explicit incomplete-versus-complete mortality evidence, same-body completion, payload-unavailability, resource-limit, repairable-fork equivocation, and 10,000 seeded adversarial cases; Node and the isolated browser-target VM exercise every portable case; and
- a locked gate requiring byte-identical committed, Node.js, isolated browser-target, and actual headless-Chromium results for every changed review head; and
- a local H3A MortalOS Lab with three non-extractable Worker keys, live `2-of-3` birth/heartbeat experiments, reference lifecycle falsification, full corpus replay, canonical public-evidence export, and cross-origin-isolated browser boundary checks.

Not implemented:

- a public HTTPS deployment of the one-page MortalOS Lab;
- a stable CLI create/import/replay/export contract;
- participant-to-participant transport or replicated state;
- a deterministic executable genome or mutable logical state; and
- GPT-5.6 runtime integration.

The immediate safety gate is publication of the reconciled mortality candidate. The next architectural gate is **R1: a canonical bounded mortality-observation wire record plus an independently written non-JavaScript verifier**. H3B should then expose that contract as a thin public Lab adapter; the deterministic state-bearing R2 kernel follows. See [Project status](docs/PROJECT_STATUS.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## Run

Requirements: Node.js 22.5 or later and npm.

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run test:lab
npm run build:lab
npm run verify:lab
npm run dev:lab
npm run demo:singleton
npm run demo:trace
```

`npm test` runs license/specification/governance gates, the conformance suite, Lab unit tests, the versioned cross-runtime corpus, a fixed-seed 10,000-case mixed valid/invalid property corpus, the deterministic lifecycle trace, and the static Lab build. `npm run verify:lab` adds real cross-origin-isolated Chromium acceptance. Coverage enforces at least 90% aggregate branch coverage across the trusted core. Exact test counts and coverage percentages belong to the latest successful verification output rather than this rolling overview.

Expected H2 trace digest:

```text
19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399
```

Committed vectors contain public verification material only. Tests that need signing keys generate them in memory and do not persist them.

## Creation profiles and ownership boundary

MortalOS counts distinct eligible custodian **key IDs**, not people, tabs, browsers, devices, or organizations.

- **CLI singleton (`1-of-1`)**: one ephemeral process can create a valid seed and heartbeat. This is creator-controlled, not ownerless.
- **Single-browser incubator (`2-of-3`)**: the local H3A page holds three logical keys and can satisfy quorum by itself. It remains one physical failure domain.
- **Distributed `2-of-3`**: no physical or administrative domain holds two keys, so no one domain can continue alone.

The verified singleton can hand logical custody authority to `2-of-3` without changing `organism_id`. After that handoff, the original sole key is insufficient while two eligible keys can advance. This makes the distinction explicit: creation may begin locally, but ownerless continuation depends on the deployment distribution of keys in the accepted custody descriptor, backed by external failure-domain evidence—not on the UI or descriptor alone.

Closing a browser or CLI process can remove every locally usable key and make the organism disappear operationally from that endpoint. It is not automatically a global or protocol death fact. Mortality reports `dead_under_v0_assumptions` only when authority loss is explicitly irreversible **and** the observer explicitly asserts that its latent-evidence inventory is complete. Missing or false completeness remains `authority_unavailable_not_proven_dead`.

## Why browser first, but not browser only

The Build Week product is **MortalOS Lab**, a browser-based Developer Tools experience for inspecting and falsifying lifecycle traces. The browser is first because it offers a zero-install judge path and makes identity, custody, turnover, fork, and mortality visible.

The browser is not a protocol boundary. Browser, CLI, native, service, embedded, and future network participants must carry the same canonical evidence to the same portable kernel. UI, transport, storage, signaling, and model output cannot define validity.

## Verified lifecycle slice

```text
singleton birth and heartbeat
  -> optional handoff to logical 2-of-3 authority
     (physical distribution requires external evidence)

birth {A,B,C}
  -> handoff {B,C,D}
  -> handoff {C,D,E}
  -> pre-authorized handoff survives current-key loss
  -> handoff {D,E,F}
  -> exact replay rejected
  -> missing state reported as state-stalled
  -> irreversible below-quorum authority loss plus a complete evidence inventory
     reported as dead under v0 assumptions
  -> public-snapshot resurrection rejected
  -> same-genome clone accepted only under a different organism_id
```

A public signed-fork fixture also proves `E_FORK_DETECTED`, one intersecting equivocator, and `E_LINEAGE_ALREADY_FORKED` after the fork.

## Trust boundary

`validateGenesis` and `validatePulse` verify transitions. Accepted results are frozen and carry an in-process capability that cloning, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` for recognized-head, replay, and fork behavior. After restart, replay canonical Genesis/Pulse evidence to reconstruct the graph; never persist or trust an `accepted: true` object.

`Lineage#evaluateMortality` is a controlled-experiment observer, not a global death oracle. It supplies the recognized head and blocks reentrant graph mutation. Its bounded adapter reads only the five documented option names and two documented carrier names through captured own-property descriptors; unknown fields are deliberately ignored and therefore are not evidence. Arrays are count-bounded before indexed acquisition, known accessors and sparse indices abort without invoking value getters, and every declared byte source must snapshot and parse successfully or the whole operation aborts as observer uncertainty. Before semantic analysis, captured realm/dependency descriptors plus SHA-256 and RFC 8032 known-answer checks must still pass. Phase two sees only owned bytes and recursively discovers target-tuple bodies and exact tagged signature values or property names throughout every parsed declared tree. Unsigned placement and labels do not establish signer identity or evidence role; signatures are remapped only by successful domain-separated verification for an exact body. A usable key is not projected onto a second body after signing another, and authenticated multi-body evidence returns unclassified `evidence_equivocation`. Only after authority loss is declared irreversible can a completion-capable membership body without a verified sidecar return unclassified `evidence_payload_unavailable`, and then only when no fresh quorum or verified latent successor independently establishes non-death. Actual death additionally requires `latentEvidenceComplete: true`. A module-private constructor token and frozen lineage surface prevent chosen-head injection and method shadowing, and internal conditional helpers are not re-exported by `src/index.mjs`.

This boundary still trusts an honest producer to place every relevant artifact in `envelopeBytes` or `eventPayloadBytes`, assert completeness truthfully, and provide Proxy-free ordinary containers. JavaScript cannot prove that a transparent `Proxy` is honest, while enumerating arbitrary caller keys would itself reopen unbounded work. R1 therefore replaces this object-graph boundary with one canonical, versioned, bounded operation/result byte contract and an independent verifier. Hidden key copies and global evidence completeness remain policy assumptions even after that change.

## Documentation

- [Project status and review findings](docs/PROJECT_STATUS.md)
- [Prioritized implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Endpoint-neutral access architecture](docs/ACCESS_ARCHITECTURE.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Single-browser incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md)
- [Build Week submission checklist](docs/SUBMISSION_CHECKLIST.md)

Current documentation contains only normative rules, rolling status/plan, deployment profiles, traceability, and submission evidence. Git history preserves dated provenance.

## Project direction

The next implementation contract should expose versioned raw operations and results that both the JavaScript kernel and an independent non-JavaScript verifier can replay. MortalOS Lab, CLI, and future network adapters should be thin consumers of that contract. GPT-5.6 may propose schema-constrained adversarial scenarios, but deterministic validation remains the only validity authority.

Codex has assisted with protocol decomposition, red-team review, implementation, tests, portability, and documentation. Scope, assumptions, bootstrap profiles, public claims, and licensing remain human decisions.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions use the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Current dependency licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
