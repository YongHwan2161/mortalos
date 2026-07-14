# P0 Verification Report

Date: **2026-07-14**  
Stage: **P0 — Operational semantics and threat model**  
Result: **PASS after corrective adversarial review**

## 1. Executive conclusion

P0 now passes at the specification-consistency level defined in `IMPLEMENTATION_PLAN.md`.

The first P0 check proved that required sections and structural schemas existed. A deeper second review then falsified four assumptions that the first string/schema gate did not detect:

1. `payload_hash` existed, but the exact payload was absent from the complete validation context;
2. global nonce “freshness” was written as a validator rule even though a validator cannot observe the whole network;
3. state loss was described as death even though a quorum could still produce a valid heartbeat or membership-change Pulse; and
4. `repair` duplicated the validity semantics of `membership-change`.

The normative documents, schema, rejection codes, traceability, fixtures, verifier, README, and implementation plan were corrected together. P0 is marked PASS only after those corrections.

This is not a claim that the protocol validator has been implemented. P1 must still produce executable semantic conformance vectors and a pure validator.

## 2. Corrective decisions

### 2.1 Event-payload closure

Every Pulse must now be supplied with exact canonical event-payload sidecar bytes. A new domain separator commits those bytes, the validation context explicitly requires them, and missing, malformed, non-canonical, or substituted payloads have stable rejection codes.

Result: a conforming validator no longer needs an unspecified later input to evaluate event semantics.

### 2.2 Nonce randomness versus freshness

A creator must sample a new 128-bit nonce for a distinct birth. A validator checks canonical encoding but does not claim global uniqueness. A byte-identical Genesis is the same birth replayed, not a second organism.

Result: identity derivation is deterministic without pretending that a local reader can prove a global negative.

### 2.3 Authority death versus state stall

P0 now separates:

- authority viability;
- state viability within an observation domain;
- operational life, requiring both;
- state stall, where authority exists but state cannot be reconstructed; and
- v0 protocol death, where quorum authority is irreversibly below threshold under the controlled honest-ephemeral-key assumption.

State loss alone does not kill a v0 lineage because current custodians can still sign a heartbeat or membership change from the committed state root. A future state-backed mortality claim needs a versioned, verifiable availability rule.

Result: the life/death vocabulary matches the actual Pulse transition system.

### 2.4 Repair as policy

`repair` was removed as a distinct Pulse event. Repair logic observes degraded custody and proposes an ordinary `membership-change` Pulse.

Result: the consensus vocabulary has no duplicate event labels with identical transition validity.

## 3. Artifacts reviewed

| Artifact | Purpose |
|---|---|
| [`PROTOCOL.md`](PROTOCOL.md) | Normative lifecycle semantics, payload closure, domain separation, validation order, and conformance. |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Trusted boundaries, included failures, state/authority separation, conditional liveness, and mortality limits. |
| [`REJECTION_CODES.md`](REJECTION_CODES.md) | Stable deterministic failure vocabulary and precedence. |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Mapping from `INV-1` through `INV-12` and message fields to planned tests. |
| [`genesis.schema.json`](../schemas/genesis.schema.json) | Strict Genesis envelope structure. |
| [`pulse.schema.json`](../schemas/pulse.schema.json) | Strict Pulse envelope structure with three non-duplicative event kinds. |
| [`heartbeat-payload.valid.json`](../examples/schema/heartbeat-payload.valid.json) | Canonical event-payload sidecar fixture bound by the Pulse example. |
| [`verify-p0.mjs`](../scripts/verify-p0.mjs) | Reproducible structural and cross-document consistency gate. |

## 4. Exit-criterion evaluation

| Criterion | Evidence | Result |
|---|---|---|
| Lifecycle terms are operationally defined. | Protocol sections 4.4–4.21. | PASS |
| Death is succession-authority loss rather than byte deletion. | Protocol 4.18 and Threat Model section 9. | PASS |
| Authority, state viability, state stall, dormancy, partition, and death are distinct. | Protocol 4.10–4.18 and observer-state table. | PASS |
| Canonical encoding and domain separation are closed. | RFC 8785 rules and eight fixed domains, including event payload. | PASS |
| Every Genesis/Pulse field has a rule. | Protocol 6.1 and 7.1 plus strict envelope schemas. | PASS |
| Exact event semantics have complete inputs. | Protocol 7.2–7.3 and section 8. | PASS |
| Every invariant maps to tests. | Traceability maps `INV-1` through `INV-12`. | PASS |
| Same complete input has one prescribed first outcome. | Canonical bytes, complete sidecar context, ordered validation, stable codes, and fail-closed forks. | PASS at specification level |

## 5. Automated verification

Commands:

```bash
npm ci
npm test
npm audit --audit-level=moderate
```

Observed P0 result:

```text
MortalOS P0 verification: PASS
- Schemas compiled: 2
- Structural valid examples accepted: 2
- Canonical event-payload fixtures bound: 1
- Structural invalid mutations rejected: 8
- Operational lifecycle definitions checked: 18
- Domain separators checked: 8
- Message validation rows checked: 20
- Unique rejection codes checked: 61
- Invariant-to-test mappings checked: 12
- Threat-model boundary statements checked: 8
```

Dependency audit result: **0 known vulnerabilities** after upgrading Ajv from `8.17.1` to `8.20.0`.

Document digests:

```text
docs/PROTOCOL.md        sha256:442f395dc89137eea4595bbc35b914624415a5ada836713ae7b941be6c29142d
docs/THREAT_MODEL.md    sha256:d4ebb5d447bd624cdc5677e93a4f4b0b5acd3d38e4206fe2fe88a373364daaf9
docs/REJECTION_CODES.md sha256:26e7e9af70e63bf04542c019bfa09a25733a98cf7b233b1b50f675882538c76d
docs/TRACEABILITY.md    sha256:48dee802b4f4815c80df81df4c3321f8ee302f6e036630c382c1cc7e3d7f81f6
```

The example signatures and key IDs remain schema fixtures, not cryptographically valid conformance vectors. P1 must generate real Ed25519 vectors and test every semantic rule.

## 6. Concrete insights

1. **The smallest complete protocol object is not a Pulse alone.** It is candidate bytes plus verified Genesis/parent context plus exact event-payload bytes.
2. **Randomness obligations and validation predicates are different.** Producers sample nonces; validators derive identities deterministically.
3. **Digital life is not binary.** Authority can survive while memory is unavailable, yielding a state-stalled lineage that is neither operationally alive nor protocol-dead.
4. **State-backed death is substantially harder than key-backed death.** It requires availability/retrievability evidence, not another descriptive field.
5. **Repair belongs above consensus.** The repair policy may evolve without changing the validity language.
6. **Identity and authority remain separate.** Identity is Genesis-derived; authority is temporary and quorum-held.
7. **Quorum intersection is not Byzantine consensus.** Strict majority plus honest sign-once prevents forks only within the stated model.
8. **Network time cannot define truth.** Local timers may drive UI and policy, never signed lineage validity.
9. **GPT remains outside the trusted computing base.** It can design failure scenarios and explain results, but not accept a Pulse.
10. **The first verifier was necessary but insufficient.** Presence checks do not prove semantic closure; P1 needs executable differential and property testing.

## 7. Residual risks and blockers

- There is still no semantic Genesis/Pulse validator.
- There are no real Ed25519 conformance vectors.
- Duplicate JSON properties require a raw duplicate-aware parser; ordinary `JSON.parse` is insufficient.
- v0 has no Byzantine custodian, Sybil, privacy, or proof-of-retrievability guarantee.
- v0 cannot prove that a malicious client did not back up a supposedly volatile key.
- The genome transition validator is not implemented.
- The repository does not yet contain the working, non-trivial product required for Devpost.
- The public repository has no owner-selected open-source license.
- GPT-5.6 is planned but not yet invoked by the runnable project.

## 8. P1 execution order

1. implement a duplicate-aware raw message parser;
2. implement RFC 8785 canonicalization and all eight domain-separated SHA-256 helpers;
3. implement strict prefixed-base64url and decimal parsers;
4. implement Genesis identity derivation and semantic validation;
5. implement event-payload sidecar validation;
6. implement Pulse parent/context/event validation;
7. implement stable first-error behavior;
8. generate real Ed25519 Genesis, Pulse, and custody-acceptance vectors;
9. mutate every signed and committed byte in property tests;
10. run at least 10,000 seeded lifecycle traces; and
11. publish an implementation-independent corpus another validator can consume.

Do not begin WebRTC, distributed memory, or distributed LLM work until this gate is executable. For Build Week, a judgeable local/browser vertical slice and GPT-5.6 scenario designer follow only after the pure core works.

## 9. Gate decision

**P0: PASS after correction. P1 and the H0/H1 Build Week gates are authorized to proceed.**
