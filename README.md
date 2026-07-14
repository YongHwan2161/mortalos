# MortalOS

**An ownerless lifecycle protocol for browser-native systems—preserving identity across host turnover and halting when quorum-held succession authority is irreversibly lost.**

MortalOS asks whether a network-native entity can retain one recognized identity while every physical host is replaceable and no single peer owns the authority to continue it.

For OpenAI Build Week, the product scope is **MortalOS Lab**: a Developer Tools experience for inspecting and falsifying birth, quorum handoff, complete custodian turnover, replay, fork, authority death, resurrection rejection, and clone scenarios.

## Honest status

Implemented and verified:

- the `mortalos/0` operational semantics and threat boundary;
- a Node.js transition verifier with duplicate-aware JSON parsing, RFC 8785 canonicalization checks, eight domain-separated derivations, and real Ed25519 verification;
- immutable, non-cloneable validated contexts, preventing callers from fabricating prior acceptance;
- a stateful lineage registry that reconstructs parent context from accepted raw ancestry, rejects exact replay, detects valid siblings, reports intersecting equivocators, and halts automatic advancement after a fork;
- evidence-backed mortality evaluation that accepts only validated direct-child latent successors; and
- a deterministic H2 lifecycle trace including complete custodian turnover, replay rejection, controlled authority death, resurrection rejection, and a distinct same-genome clone.

Not implemented:

- the browser MortalOS Lab and hosted judge path;
- GPT-5.6 runtime integration;
- a deterministic executable genome or mutable state transition;
- browser peer transport, replicated state, distributed computation, or an ownerless LLM.

The current artifact is therefore a **Node.js protocol and evidence core**, not yet a browser OS or distributed computer.

## Run the current verification

Requirements:

- Node.js 22.5 or later;
- npm; and
- Linux, macOS, or Windows with a standard Node.js environment.

```bash
npm ci
npm test
npm run test:coverage
npm run demo:trace
```

`npm test` runs the specification/document gate, standards and protocol conformance tests, a fixed-seed 10,000-case adversarial continuation corpus, and the H2 trace gate. `npm run test:coverage` enforces at least 90% aggregate branch coverage across every trusted core module.

Expected H2 verification digest:

```text
1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606
```

The committed conformance corpus contains public keys and signatures only. Runtime fork tests generate temporary signing keys in memory and never write them to disk.

## Implemented vertical slice

```text
birth {A,B,C}
  -> handoff {B,C,D}
  -> handoff {C,D,E}
  -> pre-authorized handoff survives current-key loss
  -> handoff {D,E,F}
  -> exact accepted-object replay is rejected
  -> state loss is reported as state-stalled
  -> irreversible below-quorum authority loss is reported as dead under v0 assumptions
  -> public snapshot continuation is rejected with E_APPROVAL_INSUFFICIENT_QUORUM
  -> same-genome clone is accepted only under a different organism_id
```

An additional generated-key test creates two independently valid children of one parent. The registry reports `E_FORK_DETECTED`, identifies the quorum members that signed both children, and refuses a third automatic advance with `E_LINEAGE_ALREADY_FORKED`.

## API trust boundary

`validateGenesis` and `validatePulse` are transition-verification primitives. Their accepted result objects are recursively frozen and carry an in-process capability that `structuredClone`, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` whenever recognized-head, replay, or fork behavior matters. It owns the accepted-object graph and resolves the parent from the candidate's committed `parent_hash`. After a process restart, replay the canonical Genesis and Pulse bytes to reconstruct this state; do not persist or fabricate acceptance-result objects.

`evaluateMortality` is an observer for controlled experiments, not a global death oracle. It requires a validated head and validated direct-child latent successors, but key availability, state availability, and irreversibility remain explicit observation-domain assumptions.

## Protocol boundary

- Identity is derived from the canonical Genesis body; there is no organism-owner private key.
- The current custodian quorum holds temporary continuation authority.
- State availability and authority availability are separate.
- v0 keeps `state_root` immutable; a state-bearing life claim requires a later versioned deterministic runtime.
- v0 protocol death is conditional on irreversible below-quorum authority loss, no validated latent successor, and the honest-ephemeral-key test assumption.
- Missing state with live authority is `state-stalled`, not protocol-dead.
- GPT, UI, transport, signaling, and hosted proposal services may propose or explain, but never define validity.

## Documentation

- [Prioritized implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Current deep audit](docs/CURRENT_AUDIT_2026-07-14.md)
- [Core verification report](docs/CORE_VERIFICATION_REPORT.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Historical P0 verification record](docs/P0_VERIFICATION_REPORT.md)
- [Devpost compliance matrix](docs/DEVPOST_COMPLIANCE.md)
- [Build Week provenance log](docs/BUILD_LOG.md)

## OpenAI Build Week

- Track: **Developer Tools**
- Official deadline: **2026-07-22 09:00 KST** (`2026-07-22T00:00:00Z`)
- Devpost state last checked 2026-07-14: **submission draft**

The remaining submission blockers are the browser judge experience, meaningful GPT-5.6 integration, an accessible no-rebuild test path, corrected Devpost content, a public video, and a `/feedback` Codex Session ID.

## How Codex has been used

Codex helped convert the original network-life idea into falsifiable identity, lineage, authority, state, and mortality terms; build and red-team the protocol; implement the verifier and lifecycle corpus; detect an acceptance-context forgery flaw; add the stateful lineage registry and fork evidence; harden mortality evaluation; reconcile the plan with live Devpost requirements; and maintain executable gates.

Human-owned decisions include pursuing the network-native life concept, choosing the Developer Tools framing, accepting the v0 threat assumptions, selecting Apache-2.0, and deciding what is submitted publicly.

GPT-5.6 is **not yet invoked by the runnable project**. The planned Build Week use is a schema-constrained adversarial scenario designer whose proposals remain subject to the deterministic core.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions are accepted under the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Third-party dependencies retain their respective licenses; future datasets, model weights, and trademarks may require separate terms.

## Core principle

> The network does not merely host MortalOS. Its authorized, state-bearing continuity is MortalOS.
