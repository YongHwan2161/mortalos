# MortalOS Protocol v0

Status: **Normative v0 specification with an executable transition verifier and lineage registry**  
Protocol identifier: `mortalos/0`  
Scope: P0 operational semantics for birth, identity, lineage, continuity, fork, dormancy, death, extinction, clone, and descendant.

This document uses **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** as normative requirements.

## 1. Protocol purpose

MortalOS v0 defines how an entity can have one recognized identity and an authorized state lineage even though every physical host is replaceable and no individual peer owns the entity identity.

The protocol does **not** attempt to prove that all copies of data have been deleted. It defines death as loss of the capability to create another valid state in the same lineage under the declared system and threat model.

The following question is the P0 design boundary:

> Given a Genesis envelope, an optional accepted parent Pulse, a candidate Pulse, and the protocol rules in this document, must every conforming validator return the same validation result and rejection code?

The required answer is yes. Transport, UI, clocks, GPT output, and later implementation phases MUST NOT affect protocol validity.

## 2. Normative dependencies and encodings

MortalOS v0 uses:

- JSON Schema Draft 2020-12 for structural message schemas;
- RFC 8785 JSON Canonicalization Scheme (JCS) for deterministic JSON bytes;
- UTF-8 for canonical byte encoding;
- SHA-256 as specified by FIPS 180-4 for v0 hashes;
- Ed25519 as specified by RFC 8032 for v0 signatures; and
- unpadded base64url for binary values.

References:

- <https://json-schema.org/draft/2020-12/json-schema-core>
- <https://www.rfc-editor.org/rfc/rfc8785>
- <https://csrc.nist.gov/pubs/fips/180-4/upd1/final>
- <https://www.rfc-editor.org/rfc/rfc8032>
- <https://www.rfc-editor.org/rfc/rfc4648>

### 2.1 JSON restrictions

All signed objects MUST:

1. conform to their JSON Schema;
2. contain no duplicate property names;
3. contain no unknown properties;
4. use strings rather than JSON numbers for unbounded counters such as `sequence`;
5. preserve Unicode strings exactly as received; and
6. be canonicalized with RFC 8785 before hashing.

Arrays are semantically ordered. A conforming producer MUST sort:

- custodian arrays by ascending `key_id`;
- approval arrays by ascending `key_id`; and
- acceptance arrays by ascending `key_id`.

A validator MUST reject arrays that are not strictly sorted or that contain duplicate `key_id` values.

To keep untrusted-input failure deterministic across implementations, v0 fixes these pre-validation resource limits:

| Input | Maximum raw bytes | Maximum JSON container depth |
|---|---:|---:|
| Genesis or Pulse envelope | 65,536 | 64 |
| Event-payload sidecar | 262,144 | 64 |

An implementation MUST enforce the byte bound before UTF-8 decoding and the depth bound during duplicate-aware parsing. Exceeding either bound returns `E_PARSE_LIMIT_EXCEEDED` for an envelope or `E_EVENT_PAYLOAD_INVALID` with deterministic detail `E_PARSE_LIMIT_EXCEEDED` for a payload. These limits are consensus input rules, not UI policy.

For v0 keyed arrays, ascending order means lexicographic comparison of the complete ASCII `key_id` bytes as unsigned bytes. Because the v0 prefix and base64url alphabet are ASCII, this is also Unicode code-point order for these strings; locale-sensitive collation MUST NOT be used.

The JSON Schemas define envelope shape, required fields, unknown-field exclusion, and JSON value types. Protocol encodings and semantic ranges—including prefixed base64url lengths, supported event kinds, custodian count, quorum range, and approval sufficiency—are intentionally enforced by the semantic validator so their stable rejection codes remain reachable. Schema success alone never establishes protocol validity.

### 2.2 Text encodings

| Value | Text form | Binary length |
|---|---|---:|
| SHA-256 digest | `sha256:` + 43 base64url characters | 32 bytes |
| Organism ID | `mortalos:` + 43 base64url characters | 32 bytes |
| Peer ID | `peer:` + 43 base64url characters | 32 bytes |
| Ed25519 public key | `ed25519:` + 43 base64url characters | 32 bytes |
| Ed25519 signature | `ed25519:` + 86 base64url characters | 64 bytes |
| Genesis nonce | `nonce:` + 22 base64url characters | 16 bytes |

Padding (`=`), standard base64 characters (`+`, `/`), or incorrect decoded lengths MUST be rejected.

## 3. Domain separation

No v0 signature or hash input may be reused under another semantic purpose. The following ASCII byte strings, each including the final NUL byte, are normative:

```text
MORTALOS/V0/GENESIS-ID\0
MORTALOS/V0/GENESIS-APPROVAL\0
MORTALOS/V0/PULSE-ID\0
MORTALOS/V0/PULSE-APPROVAL\0
MORTALOS/V0/CUSTODY-ACCEPTANCE\0
MORTALOS/V0/CUSTODY-COMMITMENT\0
MORTALOS/V0/EVENT-PAYLOAD\0
MORTALOS/V0/PEER-ID\0
```

Let `H(x)` mean SHA-256 over bytes `x`, `JCS(x)` mean the RFC 8785 canonical UTF-8 bytes of JSON object `x`, and `B64(x)` mean unpadded base64url.

Derived values are:

```text
peer_id(public_key_raw) =
  "peer:" || B64(H(D_PEER_ID || public_key_raw))

organism_id(genesis_body) =
  "mortalos:" || B64(H(D_GENESIS_ID || JCS(genesis_body)))

genesis_approval_message(genesis_body) =
  H(D_GENESIS_APPROVAL || raw_digest(organism_id(genesis_body)))

pulse_hash(pulse_body) =
  "sha256:" || B64(H(D_PULSE_ID || JCS(pulse_body)))

pulse_approval_message(pulse_body) =
  H(D_PULSE_APPROVAL || raw_digest(pulse_hash(pulse_body)))

custody_acceptance_message(pulse_body) =
  H(D_CUSTODY_ACCEPTANCE || raw_digest(pulse_hash(pulse_body)))

custody_commitment(custody_descriptor) =
  "sha256:" || B64(H(D_CUSTODY_COMMITMENT || JCS(custody_descriptor)))

event_payload_hash(event_payload) =
  "sha256:" || B64(H(D_EVENT_PAYLOAD || JCS(event_payload)))
```

Here `D_*` is the corresponding domain separator above. `raw_digest` removes the textual prefix and base64url-decodes exactly 32 bytes.

## 4. Operational vocabulary

Each term below has a necessary and sufficient protocol meaning.

### 4.1 Peer

A **peer** is a process possessing an Ed25519 private key corresponding to a declared custodian public key. A browser tab or device without such a key is not a custodian peer for that key.

### 4.2 Custodian

A **custodian** at Pulse `P` is a peer whose `key_id` appears in the custody descriptor effective after `P`. For Genesis, the effective custody descriptor is `initial_custodians` plus `initial_quorum`.

A custodian holds authority only as part of a valid quorum. Custodian status is not ownership of `organism_id`.

### 4.3 Genome

The **genome** is an immutable content commitment identified by `genome_hash`. It names the intended transition-rule artifact, but MortalOS v0 does not execute that artifact or accept logical state transitions. The v0 `state_root` remains equal to the Genesis state root for every Pulse.

A later protocol may define a deterministic genome ABI and execution runtime. That change requires a protocol-version and threat-model revision; merely supplying an implementation-specific callback is insufficient for consensus determinism.

### 4.4 Birth

An entity is **born** if and only if:

1. its Genesis envelope passes structural and semantic validation;
2. every listed initial custodian supplies one valid Genesis approval; and
3. the derived organism ID is accepted as the identifier of the new lineage.

The all-initial-custodians birth rule proves consent and possession for every initial custodian. The lower `initial_quorum` governs Pulses after birth.

### 4.5 Identity

The entity's **identity** is exactly `organism_id`, derived from the canonical Genesis body. It is immutable within one lineage and has no corresponding organism owner private key.

Two byte-identical Genesis bodies have the same identity and describe the same birth, regardless of where or when they are observed.

A conforming creator of a distinct birth MUST sample a new 128-bit `nonce` from a cryptographically secure random-number generator. Global nonce freshness is **not** a validator predicate: a validator cannot know that no equal nonce exists elsewhere. Different canonical Genesis bodies yield independently derived identities; replaying a byte-identical Genesis does not create another entity.

### 4.6 Pulse

A **Pulse** is an authorized state-successor proposal consisting of a signed Pulse body and its approval/acceptance evidence. A Pulse becomes accepted relative to a parent only when every applicable structural, contextual, semantic, and authorization rule passes.

### 4.7 Lineage

A **lineage view** is the accepted-object graph rooted at one valid Genesis. While no fork is known, its recognized path is the ordered sequence:

```text
valid Genesis -> accepted Pulse 1 -> accepted Pulse 2 -> ... -> accepted Pulse n
```

Every Pulse after Genesis MUST name exactly one parent and increment its parent's sequence by one. The first Pulse has sequence `"1"` and uses the Genesis organism digest as its `parent_hash`. Later Pulses use an accepted Pulse hash. A persistence layer MUST reconstruct the accepted graph from validated canonical source bytes; a deserialized object that merely claims `status: accept` is not accepted context.

### 4.8 Recognized head

For a validator's known message set, the **recognized head** is the unique highest accepted Pulse reachable from Genesis while the accepted graph is linear.

If two distinct, individually valid Pulses share one accepted parent, the validator MUST enter `FORKED` state and MUST NOT automatically choose either child. A deterministic winner rule is intentionally absent in v0; Byzantine fork resolution is out of scope.

### 4.9 Continuity authority

**Continuity authority** is the ability of a set of current custodians to satisfy the current quorum with valid signatures for one candidate successor.

No individual peer has continuity authority in a `2-of-3` entity.

### 4.10 Authority-viable

A lineage is **authority-viable** if and only if at least one set of current custodians actually retains enough private keys to satisfy the current quorum for a candidate successor.

Authority viability is an ontic property. It need not be observable to any one peer.

### 4.11 State-viable

A lineage is **state-viable within observation domain O** if and only if O contains enough state material to reconstruct the logical state committed by the recognized head.

MortalOS v0 commits to state integrity but does not include a proof-of-retrievability or state-recovery protocol. State viability is therefore observer-domain-relative and is not inferred from a heartbeat signature.

### 4.12 Alive

A lineage is **operationally alive within observation domain O** if and only if it is both authority-viable and state-viable within O. This is stronger than merely being able to sign a heartbeat.

### 4.13 Continuable

A lineage is **continuable to observer O** when O has current cryptographic evidence and connectivity sufficient to assemble at least one valid next Pulse. This is observer-relative and may change after a partition heals. Continuable does not by itself prove that the current logical state is recoverable.

### 4.14 State-stalled

A lineage is **state-stalled within observation domain O** if and only if it remains authority-viable but O cannot reconstruct the state committed by the recognized head. A state-stalled lineage may still authorize a heartbeat or custody change and therefore is not protocol-dead in v0.

### 4.15 Dormant

A lineage is **dormant to observer O** when O has an accepted head but has not observed a valid successor within O's local activity window and lacks evidence proving continuity, state viability, or death.

Dormancy MUST NOT be treated as death. The local activity window is a UI/operations parameter and MUST NOT affect Pulse validity.

### 4.16 Partitioned

A lineage is **partitioned to observer O** when O has evidence that the current peer communication graph is split or that peers report mutually unreachable components.

Partition is a network condition, not a proof of life or death. In a `2-of-3` partition, a component with two current custodians may advance; a component with one MUST stall.

### 4.17 Fork

A **fork** exists if two distinct Pulse bodies:

- have the same `organism_id`;
- have the same `sequence`;
- have the same `parent_hash`; and
- each independently passes all validations relative to that parent.

In the v0 honest-custodian model, quorum intersection plus the sign-once rule prevents a valid fork. Observation of a valid fork is evidence of equivocation, key compromise, a validator defect, or a violated threat-model assumption.

### 4.18 Latent successor

A **latent successor** is a not-yet-accepted candidate for which enough durable approval or acceptance evidence already exists that the candidate can still become valid without any new signature from the current custody quorum.

Destroying current private keys does not invalidate signatures already produced. In particular, a fully signed heartbeat or a current-quorum-approved membership change that can later collect only new-custodian acceptances may survive authority loss. Protocol death therefore requires accounting for latent successors, not merely counting remaining private keys.

The reference implementation represents latent succession with a non-cloneable validated evidence result. It verifies the complete candidate through current-quorum authorization, verifies every supplied new-custodian acceptance, and lists only the missing new-custodian acceptances. An integer count or hand-built “latent” object is not evidence.

### 4.19 Death

A lineage is **protocol-dead in v0** if and only if both conditions hold under the stated observation domain and honest-ephemeral-key assumptions:

1. fewer usable current private keys remain than the quorum requires and that authority loss is irreversible; and
2. no latent successor exists that can become valid without new signatures from the lost current quorum.

Loss of logical state alone is not protocol death in v0 because current custodians can still authorize a heartbeat or membership change using the committed state root. Such a condition is `state-stalled`. A later protocol may make a verifiable state-availability capability indispensable, but it MUST define the evidence and validation rule before claiming state loss as lineage death.

Death does not require historical bytes, public keys, Genesis, Pulses, genome artifacts, or state commitments to disappear. Those artifacts may remain readable.

An observer cannot generally prove that no unobserved key or state copy exists. Therefore v0 defines no globally authoritative `death_certificate` message. UIs MAY report `presumed dead` under a stated local policy but MUST distinguish it from protocol-proven invalidity of a candidate Pulse.

### 4.20 Extinction

A lineage is **extinct within observation domain O** if and only if:

1. it is dead within O under the stated assumptions; and
2. O contains no recoverable genome and state material sufficient to create a new Genesis derived from it.

Global extinction is not provable in an open network because unknown copies may exist. Extinction is not emitted as a consensus fact in v0.

### 4.21 Clone

A **clone** is a separately born entity whose Genesis reuses a prior entity's `genome_hash` and optionally a historical `initial_state_root`, but is not authorized by a reproduction event in the prior lineage.

A clone creator MUST sample a new Genesis nonce and therefore produce a different canonical Genesis body and `organism_id`. If the body is byte-identical, the object is a replay of the same Genesis, not a clone.

### 4.22 Descendant

A **descendant** is a separately born entity whose Genesis is cryptographically linked to an authorized reproduction event in a parent lineage.

MortalOS v0 reserves this term but defines no valid reproduction event. Any claim of protocol-recognized descent in v0 MUST be rejected as unsupported. A later protocol version may define it.

## 5. Custody and quorum rules

A custody descriptor has this logical form:

```json
{
  "custodians": [
    { "key_id": "peer:...", "public_key": "ed25519:..." }
  ],
  "quorum": { "type": "threshold", "threshold": 2 }
}
```

For v0:

- custodian count MUST be between 3 and 16 inclusive;
- `key_id` and public key MUST be unique;
- each `key_id` MUST equal the derived peer ID of its public key;
- threshold MUST be at least 2 and no greater than custodian count;
- threshold MUST be a strict majority: `2 * threshold > custodian_count`; and
- arrays MUST be strictly sorted by `key_id`.

Every current custodian MUST follow the **sign-once rule**: it MUST sign no more than one distinct Pulse hash for a given `(organism_id, sequence, parent_hash)` tuple.

### 5.1 Membership handoff

A valid Pulse may replace custodians. It requires:

1. valid approvals satisfying the current parent-derived quorum; and
2. one valid custody acceptance from every public key newly added to `next_custodians`.

New custodians have no authority before the handoff Pulse is accepted. Removed custodians have no authority after it is accepted.

## 6. Genesis message

The structural schema is [`schemas/genesis.schema.json`](../schemas/genesis.schema.json).

### 6.1 Genesis field validation

| Field | Normative validation |
|---|---|
| `kind` | MUST equal `mortalos.genesis`. |
| `body.protocol_version` | MUST equal `mortalos/0`. |
| `body.hash_algorithm` | MUST equal `sha-256`. |
| `body.signature_algorithm` | MUST equal `ed25519`. |
| `body.genome_hash` | MUST be a correctly encoded SHA-256 digest. |
| `body.initial_state_root` | MUST be a correctly encoded SHA-256 digest. |
| `body.initial_custodians` | MUST satisfy all custody rules and be strictly sorted. |
| `body.initial_quorum` | MUST satisfy threshold and strict-majority rules. |
| `body.nonce` | MUST be the canonical encoding of exactly 16 bytes. A creator MUST randomly sample it for a distinct birth; validators do not assert global freshness. |
| `approvals` | MUST contain exactly one valid Genesis approval from every initial custodian, sorted by `key_id`, with no other signers. |

The organism ID is derived, never transmitted as an authoritative field in Genesis. A display implementation MAY show the derived value.

## 7. Pulse message

The structural schema is [`schemas/pulse.schema.json`](../schemas/pulse.schema.json).

### 7.1 Pulse field validation

| Field | Normative validation |
|---|---|
| `kind` | MUST equal `mortalos.pulse`. |
| `body.protocol_version` | MUST equal `mortalos/0`. |
| `body.organism_id` | MUST equal the ID derived from the validated Genesis. |
| `body.sequence` | MUST be canonical decimal without a sign or leading zero and equal parent sequence + 1. |
| `body.parent_hash` | For sequence 1, MUST encode the Genesis identity digest as `sha256:`; otherwise MUST equal the accepted parent Pulse hash. |
| `body.genome_hash` | MUST equal the Genesis genome hash. |
| `body.current_custody_hash` | MUST equal the commitment derived from the custody descriptor effective at the parent. |
| `body.state_root` | MUST be a correctly encoded SHA-256 digest and equal the parent state root for every v0 event. |
| `body.event.kind` | MUST be one of the v0 event kinds below. |
| `body.event.payload_hash` | MUST equal `event_payload_hash` of the exact canonical event-payload sidecar supplied in validation context. |
| `body.next_custodians` | MUST satisfy all custody rules and be strictly sorted. |
| `body.next_quorum` | MUST satisfy threshold and strict-majority rules. |
| `approvals` | MUST contain unique valid signatures from current custodians meeting the parent-derived quorum. |
| `acceptances` | MUST contain exactly one valid custody-acceptance signature from every newly added custodian and no others. |

### 7.2 Event-specific rules

| Event kind | State root | Next custody | Required event-payload sidecar semantics |
|---|---|---|---|
| `heartbeat` | MUST equal parent state root. | MUST equal current custody. | Canonical empty object. |
| `membership-change` | MUST equal parent state root. | MUST differ in custody or quorum. | Canonical I-JSON object; metadata is committed but does not independently authorize the handoff. |

Composite state-and-membership changes are forbidden in v0. This separation makes validation and failure attribution deterministic.

`state-transition` and `repair` are not v0 event kinds. State transition waits for a versioned deterministic genome runtime. Repair is policy that observes degraded custody and proposes an ordinary `membership-change` Pulse. Keeping both outside the v0 consensus vocabulary avoids unspecified execution and duplicate validity rules.

### 7.3 Event-payload sidecar

Every candidate Pulse MUST be validated together with the exact event-payload bytes. Those bytes MUST:

1. be valid UTF-8 and I-JSON with no duplicate property names;
2. decode to a JSON object;
3. exactly equal the RFC 8785 canonical encoding of that object; and
4. reproduce `body.event.payload_hash` using the event-payload domain separator.

Missing, malformed, non-canonical, or hash-mismatched payload bytes cause deterministic rejection. The payload is a content-addressed sidecar rather than an authoritative transport message; transport location and arrival order do not affect validity.

## 8. Validation context

A Pulse cannot be validated from its bytes alone. The complete required context is:

- validated Genesis body and approvals;
- the unique accepted parent Pulse, if sequence is greater than 1;
- the custody descriptor effective at the parent;
- the parent state root;
- the exact canonical event-payload sidecar bytes;
- the known accepted graph needed to reject replay and detect alternative valid children as forks; and
- known pending approval and acceptance artifacts needed to detect a latent successor in a controlled mortality evaluation.

An implementation MUST establish that context itself. In-process accepted results MAY be represented by an unforgeable capability; across persistence or process boundaries, the implementation MUST replay canonical Genesis/Pulse bytes and rebuild the accepted graph. Callers MUST NOT obtain authority by supplying a plain object with acceptance-shaped fields.

No network, UI, AI, or wall-clock input is part of protocol validity.

P0 fully determines all v0 lifecycle and envelope validity rules. The repository implements the Node reference transition verifier, latent-evidence verifier, and accepted-object graph. Cross-runtime and independent-implementation conformance remain future evidence. No implementation-specific transition callback is part of v0 validity.

## 9. Deterministic validation order

Validators MUST evaluate in the following order and return the first applicable rejection code from [`REJECTION_CODES.md`](REJECTION_CODES.md):

1. envelope and event-payload byte decoding and JSON parsing;
2. envelope schema, payload-object, and unknown-field validation;
3. canonical encoding and array ordering for both envelope and payload;
4. protocol version and algorithm identifiers;
5. derived identifiers, key IDs, hashes, and commitments;
6. Genesis or parent context;
7. sequence, parent, lineage, genome, and event semantics;
8. signer eligibility, signature validity, duplicate evidence, and quorum;
9. new-custodian acceptance validation; and
10. replay, equivocation, and fork-context checks.

Validation returns one of:

```text
Accept {
  organism_id,
  object_hash,
  parent_hash?,
  next_custody_descriptor,
  next_state_root
}

Latent {
  organism_id,
  object_hash,
  parent_hash,
  missing_acceptance_key_ids[]
}

Reject {
  code,
  field_path,
  deterministic_detail
}

Forked {
  code,
  parent_hash,
  child_hashes[],
  equivocating_key_ids[]
}
```

`deterministic_detail` MUST NOT include locale-specific or runtime-dependent text. Human-readable messages are UI metadata keyed by stable rejection code.

## 10. Observer states versus protocol facts

The following table prevents a UI from converting uncertainty into a false death claim.

| Observation | Allowed local label | Forbidden conclusion |
|---|---|---|
| Recent accepted Pulse and reachable quorum, state availability unknown | `continuable / state unknown` | `operationally alive`. |
| Reachable quorum and reconstructable state | `operationally alive in this observation domain` | Globally alive. |
| Reachable quorum but unreconstructable state | `state-stalled` | `dead`. |
| No recent Pulse; peer reachability unknown | `dormant` or `unknown` | `dead`. |
| Known minority component | `partitioned / stalled` | Entire lineage is dead. |
| Current candidate lacks quorum | `candidate rejected` | No other valid candidate can exist. |
| Volatile keys intentionally destroyed below quorum under controlled test | `dead under v0 test assumptions` | Every possible copy was physically erased. |
| Below-quorum keys but a pre-authorized child remains pending | `latent successor / not dead` | Key destruction retroactively revoked existing signatures. |
| Two valid children of one parent | `forked` | Silently select a winner. |

## 11. Clone procedure

To create a clone:

1. select a prior `genome_hash` and optional historical `initial_state_root`;
2. sample a new 128-bit nonce with a cryptographically secure random-number generator;
3. choose a new initial custodian set and valid quorum;
4. construct and unanimously approve a new Genesis; and
5. derive its new organism ID.

The clone MUST NOT reference prior signatures as authority. Historical artifacts may be provenance metadata outside the v0 signed Genesis body, but they confer no lineage continuity.

## 12. Conformance

A v0 implementation is conforming only if it:

- validates the exact schemas;
- implements the domain-separated derivations above;
- follows the deterministic validation order;
- implements every field rule and event-specific rule;
- requires and verifies the exact canonical event-payload sidecar;
- exposes stable rejection codes;
- treats acceptance and latent-successor evidence as validator-produced capabilities or reconstructs them from canonical raw evidence;
- uses an accepted-object graph to reject replay and expose forks;
- never treats GPT, UI, transport, or signaling output as authority;
- enters `FORKED` instead of silently resolving two valid siblings; and
- states the mortality limitations from the threat model in user-facing documentation.

The repository reference implementation is in [`src/`](../src/), including [`lineage.mjs`](../src/lineage.mjs). Public Ed25519 and lifecycle vectors are in [`test/vectors/`](../test/vectors/); they contain verification material but no private signing keys. Fork tests generate temporary keys in memory. [`scripts/demo-trace.mjs`](../scripts/demo-trace.mjs) is a deterministic H2 consumer of the same core.

## 13. Normative companion documents

- [`THREAT_MODEL.md`](THREAT_MODEL.md)
- [`REJECTION_CODES.md`](REJECTION_CODES.md)
- [`TRACEABILITY.md`](TRACEABILITY.md)
- [`P0_VERIFICATION_REPORT.md`](P0_VERIFICATION_REPORT.md)
- [`genesis.schema.json`](../schemas/genesis.schema.json)
- [`pulse.schema.json`](../schemas/pulse.schema.json)
