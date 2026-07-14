# MortalOS

**An ownerless lifecycle protocol for browser-native systems—preserving identity across host turnover and halting when quorum-held succession authority is irreversibly lost.**

MortalOS asks whether a network-native entity can preserve one recognized identity while every physical host is replaceable and no single peer owns the authority to continue it.

The Build Week product is **MortalOS Lab**, a Developer Tools experience for validating, mutating, and replaying birth, quorum handoff, complete custodian turnover, authority death, resurrection rejection, and clone scenarios.

## Honest status

P0 semantics, the H1 deterministic Node.js validator, and the H2 Minimum Viable Life trace are implemented and verified. The validator performs duplicate-aware raw JSON parsing, deterministic canonicalization, all eight domain-separated derivations, real Ed25519 verification, current-quorum authorization, membership acceptance, and stable first-error rejection.

The repository does **not yet contain the H3 browser Lab or H4 GPT-5.6 integration**. Those are the next submission blockers; WebRTC, distributed computation, and a genome runtime remain deliberately deferred.

## Run the current verification

Requirements:

- Node.js 20 or later;
- npm; and
- Linux, macOS, or Windows with a standard Node.js environment.

```bash
npm ci
npm test
npm run test:coverage
npm run demo:trace
```

`npm test` runs the P0 specification gate, H1 conformance suite, a fixed-seed 10,000-case adversarial continuation corpus, and the H2 trace gate. `npm run test:coverage` enforces at least 90% branch coverage on the protocol validator. `npm run demo:trace` emits the deterministic judge-readable JSON trace.

Expected H2 verification digest:

```text
7b3046231a61f7b21882b02b67114941daccb3e4fb8b2fee745ab0e16de45ab7
```

The public conformance corpus stores public keys and signatures only. It contains no private signing material.

## Implemented vertical slice

```text
birth {A,B,C}
  -> handoff {B,C,D}
  -> handoff {C,D,E}
  -> pre-authorized handoff survives current-key loss
  -> handoff {D,E,F}
  -> state loss is reported as state-stalled
  -> irreversible below-quorum authority loss is reported as dead under v0 assumptions
  -> public snapshot continuation is rejected with E_APPROVAL_INSUFFICIENT_QUORUM
  -> same-genome clone is accepted only under a different organism_id
```

The executable validator lives in [`src/`](src/), the public vectors in [`test/vectors/`](test/vectors/), and the deterministic runner in [`scripts/demo-trace.mjs`](scripts/demo-trace.mjs).

## Protocol boundary

- Identity is derived from the canonical Genesis body; there is no organism-owner private key.
- Current custodian quorum holds temporary continuation authority.
- State availability and authority availability are separate.
- v0 keeps `state_root` immutable; executable genome/state-transition semantics require a later versioned deterministic runtime.
- v0 protocol death means irreversible below-quorum authority loss, with no latent pre-authorized successor, under the honest-ephemeral-key test assumption.
- Missing state with live authority is `state-stalled`, not protocol-dead.
- GPT, UI, transport, signaling, and hosted proposal services may propose or explain but never define validity.

## Documentation

- [Implementation and Build Week plan](docs/IMPLEMENTATION_PLAN.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [P0 verification report](docs/P0_VERIFICATION_REPORT.md)
- [H1/H2 verification report](docs/H1_H2_VERIFICATION_REPORT.md)
- [Devpost compliance matrix](docs/DEVPOST_COMPLIANCE.md)
- [Build Week provenance log](docs/BUILD_LOG.md)
- [Deep review](docs/DEEP_REVIEW_2026-07-14.md)

## OpenAI Build Week

- Track: **Developer Tools**
- Official deadline: **2026-07-22 09:00 KST** (`2026-07-22T00:00:00Z`)
- Current Devpost state: submission draft

Before submission, MortalOS still needs the browser judge experience, meaningful GPT-5.6 integration, a public video, corrected Devpost content, and a `/feedback` Codex Session ID. The validator, H2 trace, and repository license blockers are closed.

## How Codex has been used

Codex has helped turn the project vision into falsifiable protocol terms; draft Genesis and Pulse schemas; enumerate stable rejection codes; build the P0 consistency verifier; perform an adversarial second review; implement and test the H1 validator; create public Ed25519 conformance vectors; implement the H2 lifecycle trace; identify contradictions among state loss, authority loss, and death; analyze the live Devpost requirements; and maintain the gated implementation plan.

Key product decisions remain human-owned: pursuing the network-native life concept, treating the first release as a Developer Tool, accepting the protocol's scope and threat assumptions, selecting Apache-2.0, and deciding what is submitted publicly.

GPT-5.6 is **not yet integrated into the runnable project**. The planned use is a schema-constrained adversarial scenario designer whose output is independently accepted or rejected by the deterministic validator.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions are accepted under the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Third-party dependencies retain their respective licenses; future datasets, model weights, and trademarks may require separate terms.

## Core principle

> The network does not merely host MortalOS. Its authorized, state-bearing continuity is MortalOS.
