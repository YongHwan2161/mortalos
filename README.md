# MortalOS

**A deterministic lifecycle protocol for replaceable browser-native custodians.**

MortalOS separates identity, continuation authority, lineage, state availability, and observable liveness. Its long-term question is whether one network-native entity can preserve an authorized identity after every original host has been replaced—and stop when succession becomes impossible under explicit assumptions.

## Honest status

The current artifact is a verified **Node.js protocol and evidence core**, not yet a browser OS or state-bearing digital life.

Implemented:

- duplicate-aware UTF-8/I-JSON parsing and RFC 8785 canonicalization;
- eight domain-separated SHA-256 derivations and real Ed25519 verification;
- Genesis and Pulse validation, including current `2-of-3` approval and new-custodian acceptance;
- non-forgeable, recursively frozen validation contexts;
- a lineage registry that rejects replay, detects valid siblings, exposes quorum equivocation, and halts after a fork;
- evidence-backed latent-successor and conditional mortality evaluation; and
- a deterministic birth → complete turnover → replay/death/resurrection/clone trace.

Not implemented:

- a portable core that runs identically in Node.js and Chromium;
- the one-page browser incubator and MortalOS Lab judge experience;
- browser peer transport or replicated state;
- a deterministic executable genome or mutable logical state; and
- GPT-5.6 runtime integration.

The most important next gate is **C1 portable deterministic core**. Browser UI must not create a second, subtly different validator. See [Project status](docs/PROJECT_STATUS.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## Run

Requirements: Node.js 22.5 or later and npm.

```bash
npm ci
npm test
npm run test:coverage
npm run demo:trace
```

`npm test` runs license/specification gates, 22 conformance tests, a fixed-seed 10,000-case adversarial continuation corpus, and the deterministic lifecycle trace gate. Coverage enforces at least 90% aggregate branch coverage across the trusted core.

Expected trace digest:

```text
1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606
```

Committed vectors contain public verification material only. Tests that need signing keys generate them in memory.

## What `2-of-3` means

Quorum counts distinct eligible custodian **key IDs**, not people, tabs, browsers, devices, or organizations.

- Genesis requires all three initial keys: `3-of-3` birth consent.
- Every later Pulse needs any two current keys: `2-of-3` continuation.
- One person may initially run all three keys in one browser so an organism can be created without other participants.
- That browser can satisfy the logical quorum by itself and is one physical failure domain.
- Closing it before a valid handoff loses local continuation authority under the controlled ephemeral-key assumptions.
- After handoffs distribute enough keys to independent browsers, the original browser may close while the same `organism_id` continues.

The current Node core validates the cryptographic rules but does not yet implement this browser key lifecycle. See the [single-browser incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md).

## Verified lifecycle slice

```text
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

A generated-key test also creates two valid children of one parent. The lineage reports `E_FORK_DETECTED`, identifies intersecting signers, and rejects further automatic advancement with `E_LINEAGE_ALREADY_FORKED`.

## Trust boundary

`validateGenesis` and `validatePulse` verify transitions. Accepted results are frozen and carry an in-process capability that cloning, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` for recognized-head, replay, and fork behavior. After restart, replay canonical Genesis/Pulse evidence to reconstruct the graph; never persist or trust an `accepted: true` object.

`evaluateMortality` is a controlled-experiment observer, not a global death oracle. Key availability, state availability, irreversibility, and absence of hidden copies remain declared assumptions.

## Protocol boundary

- `organism_id` is derived from Genesis; it has no owner private key.
- Current custodian keys hold temporary continuation authority.
- Logical key quorum and physical failure-domain independence are different properties.
- v0 keeps `state_root` immutable and executes no genome.
- Missing state is `state-stalled`, not automatically dead.
- Death is conditional irreversible authority loss with no validated latent successor, not deletion of all history.
- UI, transport, signaling, storage, and model output cannot define validity.

## Documentation

- [Project status and review findings](docs/PROJECT_STATUS.md)
- [Prioritized implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Single-browser incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md)
- [Build Week submission checklist](docs/SUBMISSION_CHECKLIST.md)

Dated audits, phase reports, and manual build logs were removed from current documentation. Git history preserves their provenance; this smaller set is the maintained source of truth.

## Project direction

The near-term product is **MortalOS Lab**, a Developer Tools experience for inspecting and falsifying lifecycle traces. GPT-5.6 may propose schema-constrained adversarial scenarios, but the deterministic core remains the only validity authority.

Codex has assisted with protocol decomposition, red-team review, implementation, tests, and documentation. Scope, assumptions, the one-person browser-incubation requirement, public claims, and licensing remain human decisions.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions use the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md).
