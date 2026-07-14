# P0 Verification Report

Date: **2026-07-14**  
Stage: **P0 — Operational semantics and threat model**  
Result: **PASS**

## 1. Executive conclusion

P0 is complete under the scope defined in `IMPLEMENTATION_PLAN.md`.

MortalOS now has a deterministic normative answer for:

- what is born;
- what remains identical while hosts change;
- what constitutes an authorized successor;
- how custody moves between peers;
- when a local view is dormant or partitioned rather than dead;
- what death means despite copyable historical data;
- why a clone is not a resurrection; and
- which components are and are not trusted to decide validity.

The P0 Gate condition is satisfied at the specification level: given the same canonical message bytes and validation context, conforming validators have one prescribed validation order and first rejection code. P1 must now turn that specification into executable conformance vectors and a pure validator.

## 2. Artifacts reviewed

| Artifact | Purpose |
|---|---|
| [`PROTOCOL.md`](PROTOCOL.md) | Normative lifecycle semantics, message rules, domain separation, validation order, and conformance requirements. |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Trusted/untrusted boundaries, included failures, excluded adversaries, conditional liveness, and mortality limitations. |
| [`REJECTION_CODES.md`](REJECTION_CODES.md) | Stable deterministic failure vocabulary and precedence. |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Mapping from invariants and message fields to planned automated tests. |
| [`genesis.schema.json`](../schemas/genesis.schema.json) | Draft 2020-12 structural schema for birth messages. |
| [`pulse.schema.json`](../schemas/pulse.schema.json) | Draft 2020-12 structural schema for successor messages. |
| [`verify-p0.mjs`](../scripts/verify-p0.mjs) | Reproducible structural and documentation verification. |

## 3. Exit-criterion evaluation

| Criterion | Evidence | Result |
|---|---|---|
| Every lifecycle term has a necessary and sufficient operational definition. | Protocol sections 4.4–4.18 define birth, identity, Pulse, lineage, head, authority, alive, continuable, dormant, partitioned, fork, death, extinction, clone, and descendant. | PASS |
| Death is succession-capability loss rather than universal byte deletion. | Protocol 4.15 and Threat Model section 9. | PASS |
| Dormancy, partition, and death are distinguishable despite observer uncertainty. | Protocol 4.12–4.15 and section 10. | PASS |
| Canonical encoding and domain separation are specified. | RFC 8785/JCS rules and seven fixed domain separators in Protocol sections 2–3. | PASS |
| Every Genesis and Pulse field has a validation rule. | Protocol sections 6.1 and 7.1, two strict JSON Schemas, and field traceability. | PASS |
| Every invariant maps to a planned automated test. | Traceability section 2 maps `INV-1` through `INV-10` to reserved test IDs. | PASS |
| No later phase is required to explain envelope/lifecycle validity. | Protocol sections 8–9 specify complete context and evaluation order. Genome content validation is an explicit required input, not an unspecified rule. | PASS |
| Two conforming readers cannot legitimately choose different outcomes from the same complete input. | Canonical bytes, exact derivations, ordered validation, stable rejection codes, and fail-closed fork behavior. | PASS at specification level; executable cross-implementation vectors are P1 evidence. |

## 4. Automated verification

Command:

```bash
npm install
npm run verify:p0
```

Observed result:

```text
MortalOS P0 verification: PASS
- Schemas compiled: 2
- Structural valid examples accepted: 2
- Structural invalid mutations rejected: 8
- Operational lifecycle definitions checked: 15
- Domain separators checked: 7
- Message validation rows checked: 20
- Unique rejection codes checked: 60
- Invariant-to-test mappings checked: 10
- Threat-model boundary statements checked: 6
```

Document digests at verification time:

```text
docs/PROTOCOL.md        sha256:527d1ab78345b267d0e06a45749824511400195f94af5a7e695c5892d59dc383
docs/THREAT_MODEL.md    sha256:33f40829236d5ba48e793bdbcf38c25275ccddec2bdfcdca2ecf8579f3803ca9
docs/REJECTION_CODES.md sha256:58cf385551da7b4e4f436b78cb0d66142c928b8e0bd4d04a59f365ab2c1fa017
docs/TRACEABILITY.md    sha256:f405cde749f0b36d18c9a632d44b51c5b1784c97a6190e948603839a7a4e9815
```

The example signatures and key IDs are **schema fixtures only**, not cryptographically valid conformance vectors. P1 must generate real Ed25519 vectors and test every semantic rule.

## 5. Manual adversarial review

### 5.1 Copyability versus mortality

The initial formulation risked treating erased data as death. That is not enforceable in an open browser. P0 instead binds identity to an authorized lineage. Historical bytes can survive while authority to continue that identity does not.

Result: death is falsifiable in a controlled honest-ephemeral test without making an impossible global-erasure claim.

### 5.2 Silence versus death

No-message intervals cannot distinguish crash, pause, delay, or partition. Wall-clock timeout was therefore excluded from protocol validity.

Result: UIs may report dormancy or presumed death under policy, but cannot manufacture a consensus death fact.

### 5.3 Entity identity without an owner key

Giving the organism one private key would merely move ownership into that key. P0 derives `organism_id` from the Genesis body; no organism-owner private key exists.

Result: authority belongs to the current quorum while identity belongs to the lineage.

### 5.4 Birth consent versus operating quorum

A `2-of-3` quorum is appropriate for continuity but permits two peers to list a third peer that never accepted custody. P0 therefore requires unanimous initial-custodian approval at birth and uses the lower quorum only afterward.

Result: every initial custodian proves possession and consent without making all future transitions unanimous.

### 5.5 Safe handoff

Current-quorum approval alone cannot prove that a replacement peer controls the new private key or accepted responsibility. P0 adds a separate acceptance signature from every newly added custodian.

Result: membership changes now prove both authorization by the old body and acceptance by the new body.

### 5.6 Fork semantics

A deterministic lexicographic fork-choice rule would conceal equivocation and introduce a blockchain-like consensus claim without Byzantine analysis. P0 instead requires strict-majority quorum, honest sign-once, and fail-closed `FORKED` state.

Result: v0 detects but does not pretend to resolve Byzantine forks.

### 5.7 Atomic complexity

Combining logical state mutation and membership mutation in one Pulse creates ambiguous failure attribution and larger attack surfaces. P0 separates heartbeat, state transition, membership change, and repair events.

Result: each accepted Pulse has one primary semantic purpose in v0.

## 6. Insights produced by P0

1. **MortalOS life is a lineage, not a data object.** Its fundamental operation is authorized succession, not passive storage.
2. **Identity and authority must be separate.** Identity is Genesis-derived; authority is temporary and quorum-held.
3. **Death is loss of succession capability.** The continued presence of public history is compatible with death.
4. **Life status and observer status are different layers.** `Alive` may be true while a partitioned observer can report only `unknown` or `dormant`.
5. **Mortality cannot be fully adversarial in an open browser.** A modified client can persist keys, so v0 mortality needs an honest-ephemeral assumption.
6. **Handoff is a two-sided act.** The old quorum authorizes it and each new custodian accepts it.
7. **Quorum intersection is not Byzantine consensus.** Strict majority plus honest sign-once prevents forks only within the stated model.
8. **Network time must not define truth.** Local timers may drive cleanup and UI, never signed lineage validity.
9. **GPT belongs outside the trusted computing base.** It may propose and explain but cannot accept a Pulse.
10. **A distributed LLM is downstream.** Model sharding is an organ; it does not establish the life and death of MortalOS.

## 7. Residual risks accepted at P0

- JCS, SHA-256, and Ed25519 implementations are trusted dependencies.
- v0 has no Byzantine custodian or Sybil protection.
- v0 does not prove that an erased key had no malicious backup.
- v0 has no global death certificate.
- state confidentiality is absent.
- the genome transition validator is not yet implemented.
- JSON Schemas enforce structure, while ordering, derived IDs, signatures, quorum majority, and parent context require the P1 semantic validator.

These are scope boundaries, not hidden claims.

## 8. P1 recommendations

Proceed to P1 with the following order:

1. implement RFC 8785 canonicalization and domain-separated SHA-256 helpers;
2. implement strict parsers for prefixed base64url values and decimal sequence strings;
3. implement Genesis derivation and structural/semantic validation;
4. implement Pulse hash derivation and parent-context validation;
5. implement stable first-error rejection behavior;
6. generate real Ed25519 Genesis and Pulse conformance vectors;
7. implement property-based mutation tests for every signed field;
8. run at least 10,000 seeded lifecycle traces; and
9. publish fixtures that another independent implementation can consume.

Do not begin WebRTC, UI, WebAssembly actors, or GPT integration until the pure validator passes the P1 Gate. They would add debugging noise without strengthening the foundational claim.

## 9. Gate decision

**P0: PASS. P1 is authorized to begin.**

This decision covers protocol semantics and threat-model completeness. It does not claim that the semantics have already been correctly implemented; that is the purpose of P1.

