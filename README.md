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
- resource-bounded recognized-head mortality that independently pools candidate bodies, body-bound signatures, and content-addressed sidecars; cryptographically reconstructs same-body evidence; filters one explicit usable-key snapshot through sign-once commitments; keeps equivocation and payload uncertainty unclassified; and returns `indeterminate / limit_exceeded` instead of classifying a truncated evidence set;
- a public singleton birth/heartbeat, a verified `1-of-1` to logical `2-of-3` custody/authority expansion, and the complete A/B/C → D/E/F lifecycle;
- a v4 committed result corpus with 15 named negatives, seven reported boundary outcomes, same-body completion, payload-unavailability, resource-limit, repairable-fork equivocation, and 10,000 seeded adversarial cases; Node and the isolated browser-target VM exercise every portable case; and
- byte-identical committed, Node.js, isolated browser-target, and actual headless-Chromium gates that every changed head must rerun before publication; and
- a local H3A MortalOS Lab with three non-extractable Worker keys, live `2-of-3` birth/heartbeat experiments, reference lifecycle falsification, full corpus replay, canonical public-evidence export, and cross-origin-isolated browser boundary checks.

Not implemented:

- a public HTTPS deployment of the one-page MortalOS Lab;
- a stable CLI create/import/replay/export contract;
- participant-to-participant transport or replicated state;
- a deterministic executable genome or mutable logical state; and
- GPT-5.6 runtime integration.

The immediate safety gate is publication of the resource-bounded mortality candidate. The next delivery gate is **H3B public MortalOS Lab deployment**, and the next fundamental research gate is a versioned deterministic state-bearing kernel. See [Project status](docs/PROJECT_STATUS.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

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

`npm test` runs license/specification/governance gates, 59 conformance tests, Lab unit tests, the versioned cross-runtime corpus, a fixed-seed 10,000-case mixed valid/invalid property corpus, the deterministic lifecycle trace, and the static Lab build. `npm run verify:lab` adds real cross-origin-isolated Chromium acceptance. Coverage enforces at least 90% aggregate branch coverage across the trusted core.

Expected H2 trace digest:

```text
b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36
```

Committed vectors contain public verification material only. Tests that need signing keys generate them in memory and do not persist them.

## Creation profiles and ownership boundary

MortalOS counts distinct eligible custodian **key IDs**, not people, tabs, browsers, devices, or organizations.

- **CLI singleton (`1-of-1`)**: one ephemeral process can create a valid seed and heartbeat. This is creator-controlled, not ownerless.
- **Single-browser incubator (`2-of-3`)**: the local H3A page holds three logical keys and can satisfy quorum by itself. It remains one physical failure domain.
- **Distributed `2-of-3`**: no physical or administrative domain holds two keys, so no one domain can continue alone.

The verified singleton can hand logical custody authority to `2-of-3` without changing `organism_id`. After that handoff, the original sole key is insufficient while two eligible keys can advance. This makes the distinction explicit: creation may begin locally, but ownerless continuation depends on the deployment distribution of keys in the accepted custody descriptor, backed by external failure-domain evidence—not on the UI or descriptor alone.

Closing a browser or CLI process is not automatically a protocol death fact. Mortality remains conditional on the declared ephemeral-key policy, irreversibility, known latent evidence, and observation domain.

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
  -> irreversible below-quorum authority loss reported as dead under v0 assumptions
  -> public-snapshot resurrection rejected
  -> same-genome clone accepted only under a different organism_id
```

A public signed-fork fixture also proves `E_FORK_DETECTED`, one intersecting equivocator, and `E_LINEAGE_ALREADY_FORKED` after the fork.

## Trust boundary

`validateGenesis` and `validatePulse` verify transitions. Accepted results are frozen and carry an in-process capability that cloning, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` for recognized-head, replay, and fork behavior. After restart, replay canonical Genesis/Pulse evidence to reconstruct the graph; never persist or trust an `accepted: true` object.

`Lineage#evaluateMortality` is a controlled-experiment observer, not a global death oracle. It supplies the recognized head, blocks reentrant graph mutation, snapshots usable current keys once, and reconstructs possible successors from independently carried bodies, signatures, and payload sidecars. Unsigned carrier labels do not establish signer identity or evidence role; signatures are remapped only by successful domain-separated verification for an exact body. A usable key is not projected onto a second body after signing another, and authenticated multi-body evidence returns unclassified `evidence_equivocation`. Only after authority loss is declared irreversible can a completion-capable membership body without a verified sidecar return unclassified `evidence_payload_unavailable`, and then only when no fresh quorum or verified latent successor independently establishes non-death. A module-private constructor token prevents chosen-head injection, and internal conditional helpers are not re-exported by `src/index.mjs`. Global usable-key availability, state availability, irreversibility, and absence of hidden copies remain declared observer assumptions.

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
