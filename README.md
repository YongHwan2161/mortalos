# MortalOS

**An endpoint-neutral lifecycle protocol for network-native entities.**

MortalOS separates identity, continuation authority, lineage, state availability, and observable liveness. Its long-term question is whether one network-native entity can preserve an authorized identity after every original host has been replaced—and stop when succession becomes impossible under explicit assumptions.

## Honest status

The current artifact is a verified **portable protocol and evidence kernel with CLI and Chromium proof adapters**, not yet an OS, participant network, or state-bearing digital life.

Implemented:

- portable `Uint8Array` processing with duplicate-aware UTF-8/I-JSON parsing and RFC 8785 canonicalization;
- eight domain-separated SHA-256 derivations and strict RFC 8032 Ed25519 verification;
- Genesis and Pulse validation for strict-majority custody descriptors from `1-of-1` through 16 custodians;
- non-forgeable, recursively frozen validation contexts;
- a lineage registry that rejects replay, detects valid siblings, exposes quorum equivocation, and halts after a fork;
- evidence-backed latent-successor and conditional mortality evaluation;
- a public singleton birth/heartbeat, a verified `1-of-1` to `2-of-3` authority expansion, and the complete A/B/C → D/E/F lifecycle;
- a committed result corpus with 15 named negative cases and 10,000 seeded adversarial cases; and
- byte-identical committed, Node.js, isolated browser-target, and actual headless-Chromium results.

Not implemented:

- the one-page browser incubator and MortalOS Lab judge experience;
- a stable CLI create/import/replay/export contract;
- participant-to-participant transport or replicated state;
- a deterministic executable genome or mutable logical state; and
- GPT-5.6 runtime integration.

The most important delivery gate is now **H3 MortalOS Lab**. The next fundamental research gate is a versioned deterministic state-bearing kernel. See [Project status](docs/PROJECT_STATUS.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## Run

Requirements: Node.js 22.5 or later and npm.

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run demo:singleton
npm run demo:trace
```

`npm test` runs license/specification gates, 26 conformance tests, the committed cross-runtime corpus, a fixed-seed 10,000-case property corpus, and the deterministic lifecycle trace. Coverage enforces at least 90% aggregate branch coverage across the trusted core.

Expected H2 trace digest:

```text
1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606
```

Committed vectors contain public verification material only. Tests that need signing keys generate them in memory and do not persist them.

## Creation profiles and ownership boundary

MortalOS counts distinct eligible custodian **key IDs**, not people, tabs, browsers, devices, or organizations.

- **CLI singleton (`1-of-1`)**: one ephemeral process can create a valid seed and heartbeat. This is creator-controlled, not ownerless.
- **Single-browser incubator (`2-of-3`)**: one planned page holds three logical keys and can satisfy quorum by itself. It remains one physical failure domain.
- **Distributed `2-of-3`**: no physical or administrative domain holds two keys, so no one domain can continue alone.

The verified singleton can hand authority to `2-of-3` without changing `organism_id`. After that handoff, the original sole key is insufficient while two eligible keys can advance. This makes the distinction explicit: creation may begin locally, but ownerless continuation is a property of the accepted custody distribution, not the UI used to create it.

Closing a browser or CLI process is not automatically a protocol death fact. Mortality remains conditional on the declared ephemeral-key policy, irreversibility, known latent evidence, and observation domain.

## Why browser first, but not browser only

The Build Week product is **MortalOS Lab**, a browser-based Developer Tools experience for inspecting and falsifying lifecycle traces. The browser is first because it offers a zero-install judge path and makes identity, custody, turnover, fork, and mortality visible.

The browser is not a protocol boundary. Browser, CLI, native, service, embedded, and future network participants must carry the same canonical evidence to the same portable kernel. UI, transport, storage, signaling, and model output cannot define validity.

## Verified lifecycle slice

```text
singleton birth and heartbeat
  -> optional handoff to distributed 2-of-3 authority

birth {A,B,C}
  -> handoff {B,C,D}
  -> handoff {C,D,E}
  -> pre-authorized handoff survives current-key loss
  -> handoff {D,E,F}
  -> exact replay rejected
  -> missing state reported as state-stalled
  -> irreversible below-quorum authority loss reported as dead under v0 assumptions
  -> public-snapshot resurrection rejected
  -> same-genome clone accepted only under a different organism_id
```

A public signed-fork fixture also proves `E_FORK_DETECTED`, one intersecting equivocator, and `E_LINEAGE_ALREADY_FORKED` after the fork.

## Trust boundary

`validateGenesis` and `validatePulse` verify transitions. Accepted results are frozen and carry an in-process capability that cloning, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` for recognized-head, replay, and fork behavior. After restart, replay canonical Genesis/Pulse evidence to reconstruct the graph; never persist or trust an `accepted: true` object.

`evaluateMortality` is a controlled-experiment observer, not a global death oracle. Key availability, state availability, irreversibility, and absence of hidden copies remain declared assumptions.

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

MortalOS Lab will use the same kernel as CLI and future network adapters. GPT-5.6 may propose schema-constrained adversarial scenarios, but deterministic validation remains the only validity authority.

Codex has assisted with protocol decomposition, red-team review, implementation, tests, portability, and documentation. Scope, assumptions, bootstrap profiles, public claims, and licensing remain human decisions.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions use the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Current dependency licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
