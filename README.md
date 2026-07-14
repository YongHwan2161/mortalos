# MortalOS

**An ownerless lifecycle protocol for browser-native systems—preserving identity across host turnover and halting when quorum-held succession authority is irreversibly lost.**

MortalOS asks whether a network-native entity can preserve one recognized identity while every physical host is replaceable and no single peer owns the authority to continue it.

The Build Week product is **MortalOS Lab**, a planned Developer Tools experience for validating, mutating, and replaying birth, quorum handoff, complete custodian turnover, authority death, and clone scenarios.

## Honest status

P0 protocol semantics and threat model are corrected and verified. The repository currently contains a reproducible **specification gate**, strict message schemas, and planning evidence. It does **not yet contain the P1 semantic validator or a working browser demo**.

Next milestone: implement the pure deterministic validator with real Ed25519 vectors and event-payload sidecars before adding UI, WebRTC, or distributed computation.

## Run the current verification

Requirements:

- Node.js 20 or later;
- npm; and
- Linux, macOS, or Windows with a standard Node.js environment.

```bash
npm ci
npm test
```

`npm test` currently compiles both JSON Schemas, validates positive and negative structural fixtures, checks the canonical heartbeat payload commitment, and audits the required P0 definitions, domain separators, rejection codes, threat boundaries, and invariant traceability.

This command is a P0 documentation/schema consistency gate. It is not a substitute for the executable protocol conformance tests required by P1.

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
- [Devpost compliance matrix](docs/DEVPOST_COMPLIANCE.md)
- [Build Week provenance log](docs/BUILD_LOG.md)
- [Deep review](docs/DEEP_REVIEW_2026-07-14.md)

## OpenAI Build Week

- Track: **Developer Tools**
- Official deadline: **2026-07-22 09:00 KST** (`2026-07-22T00:00:00Z`)
- Current Devpost state: submission draft

Before submission, MortalOS still needs a working validator and judge experience, meaningful GPT-5.6 integration, a public video, a `/feedback` Codex Session ID, and an owner-selected open-source license.

## How Codex has been used

Codex has helped turn the project vision into falsifiable protocol terms; draft Genesis and Pulse schemas; enumerate stable rejection codes; build the P0 consistency verifier; perform an adversarial second review; identify contradictions among state loss, authority loss, and death; analyze the live Devpost requirements; and maintain the gated implementation plan.

Key product decisions remain human-owned: pursuing the network-native life concept, treating the first release as a Developer Tool, accepting or rejecting the protocol's scope and threat assumptions, choosing the final open-source license, and deciding what is submitted publicly.

GPT-5.6 is **not yet integrated into the runnable project**. The planned use is a schema-constrained adversarial scenario designer whose output is independently accepted or rejected by the deterministic validator.

## Licensing status

No open-source license has been selected yet. That means ordinary copyright applies and reuse permission is not granted. A repository-root license is a Devpost submission blocker; Apache-2.0 is recommended for its explicit patent grant, but the repository owner must make that rights decision.

## Core principle

> The network does not merely host MortalOS. Its authorized, state-bearing continuity is MortalOS.
