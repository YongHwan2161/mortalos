# H1/H2 Verification Report

Date: **2026-07-14**  
Scope: **Apache-2.0, H1 deterministic validator, real Ed25519 conformance, and H2 Minimum Viable Life trace**  
Result: **PASS for the stated Build Week gates**

## 1. Executive conclusion

MortalOS now has an executable reference core rather than only a protocol specification.

- The repository is licensed under Apache-2.0 using the unmodified official license text.
- Raw candidate bytes are parsed with duplicate-property detection before ordinary object conversion.
- Genesis and Pulse validation is deterministic and fail-closed.
- All eight protocol domains are implemented for SHA-256 derivation.
- Genesis approval, current-custodian approval, and new-custodian acceptance use real Ed25519 verification.
- Three signed `2-of-3` handoffs replace every original custodian without changing the organism ID.
- A fully authorized latent successor survives destruction of current signing keys.
- State loss with live authority is classified as `state_stalled`, not death.
- Irreversible below-quorum authority loss with zero pending authorized successors is classified as `dead_under_v0_assumptions`.
- A public snapshot with `0-of-3` approval cannot advance the lineage.
- Reusing the genome and state in a new unanimously approved Genesis yields a different organism ID.

This result does not claim a peer-to-peer browser network, globally provable death, Byzantine consensus, an executable genome, or a hosted judge UI. Those remain outside H1/H2.

## 2. License evidence

| Check | Evidence | Result |
|---|---|---|
| Official Apache-2.0 text | Root `LICENSE`, byte-identical to the system-distributed Apache-2.0 reference during verification | PASS |
| Package metadata | `package.json` and `package-lock.json` declare `Apache-2.0` | PASS |
| Inbound contribution terms | `CONTRIBUTING.md` states Apache-2.0 inbound terms | PASS |
| Separation of future assets | README notes that dependencies, data, weights, and trademarks may retain separate terms | PASS |

No `NOTICE` file is required at this point because the project does not currently distribute an upstream NOTICE attribution set.

## 3. H1 implementation

### 3.1 Byte and canonicalization boundary

`src/codec.mjs` implements:

- fatal UTF-8 decoding;
- recursive JSON parsing with duplicate-key detection;
- rejection of malformed JSON, invalid escapes, control characters, non-finite numbers, and lone surrogates;
- deterministic RFC 8785-compatible serialization for the v0 JSON value domain; and
- exact comparison between received bytes and canonical bytes.

Keyed arrays use locale-independent lexicographic ordering over their ASCII `key_id` bytes. Locale collation was explicitly rejected after it produced a different order for uppercase and lowercase base64url characters.

### 3.2 Cryptographic boundary

`src/crypto.mjs` implements:

- strict unpadded base64url decoding with decoded-length and round-trip checks;
- peer ID, organism ID, Pulse hash, custody commitment, and event-payload commitment;
- Genesis approval, Pulse approval, and custody acceptance messages; and
- Ed25519 verification from raw 32-byte public keys.

The independent primitive check uses RFC 8032 section 7.1 test vector 1. The MortalOS lifecycle corpus contains nine public keys and valid protocol signatures, but no private key or seed.

### 3.3 Validation boundary

`src/validator.mjs` enforces:

1. raw byte parsing;
2. structural schema and unknown-field rejection;
3. canonical envelope and sidecar bytes;
4. supported version, algorithms, and event kinds;
5. strict binary encodings, peer IDs, hashes, and custody commitments;
6. validated Genesis and accepted-parent context;
7. organism, sequence, parent, genome, state, and payload continuity;
8. current-custodian signer eligibility, Ed25519 signatures, and quorum;
9. exact new-custodian acceptance; and
10. stable first-error results.

The schema/semantic boundary was corrected during implementation. JSON Schema now enforces shape and JSON types, while protocol ranges and encodings remain semantic checks. Without this correction, `0-of-3` and `1-of-3` candidates were rejected generically by schema instead of reaching `E_APPROVAL_INSUFFICIENT_QUORUM`, and several normative rejection codes were impossible to emit.

## 4. Automated H1 evidence

Commands:

```bash
npm ci
npm run verify:p0
npm run test:conformance
npm run test:properties
npm run test:coverage
```

Observed result:

| Gate | Result |
|---|---|
| P0 schema/document consistency | PASS |
| H1 conformance tests | 16/16 PASS before the final replay/acceptance additions; the final full `npm test` is the authoritative count |
| RFC 8032 vector | PASS; mutated signature rejected |
| Signed MortalOS Genesis | PASS |
| Three signed `2-of-3` handoffs | PASS |
| `0-of-3` public snapshot attempt | `E_APPROVAL_INSUFFICIENT_QUORUM`, `0/2` |
| `1-of-3` attempt | `E_APPROVAL_INSUFFICIENT_QUORUM` |
| Duplicate/ineligible/replayed/corrupt evidence | rejected with stable codes |
| Fixed-seed adversarial continuations | 10,000/10,000 rejected without accepted-lineage invariant change |
| Two fresh-process trace comparison | byte-identical |
| Validator line coverage | **98.97%** |
| Validator branch coverage | **91.58%** |
| Validator function coverage | **100%** |
| Clean-room install and README commands | PASS with no pre-existing `node_modules` |
| GitHub remote file verification | 39/39 blob SHA matches, 0 mismatches |
| GitHub Actions | `Verify` run 13, push commit `b459485d3109e99ddb3e958c6108a50580074d1e`, success |

The two uncovered line ranges are defensive schema-error mappings for a wrong Pulse event kind and sequence format when schema validation itself fails first. Normal semantic values reach and test the explicit `E_EVENT_KIND_UNSUPPORTED` and `E_SEQUENCE_INVALID_FORMAT` paths.

## 5. H2 deterministic proof

Run:

```bash
npm run demo:trace
```

Trace digest:

```text
7b3046231a61f7b21882b02b67114941daccb3e4fb8b2fee745ab0e16de45ab7
```

| Sequence/observation | Custody or result | Identity result |
|---|---|---|
| Birth, sequence 0 | `{A,B,C}`, `2-of-3` | `mortalos:4kWF...2bsw` born |
| Handoff 1 | `{B,C,D}`, accepted | unchanged |
| Handoff 2 | `{C,D,E}`, accepted | unchanged |
| Current keys unavailable, one complete signed child pending | `latent_successor_not_dead` | lineage remains advanceable |
| Latent handoff 3 delivered | `{D,E,F}`, accepted | unchanged; all A/B/C absent |
| State material unavailable, all D/E/F authority usable | `state_stalled` | not protocol-dead |
| Only F usable, loss irreversible, pending set empty | `dead_under_v0_assumptions` | lineage cannot validly advance under test assumptions |
| Public snapshot proposes sequence 4 with no signatures | `E_APPROVAL_INSUFFICIENT_QUORUM (0/2)` | resurrection rejected |
| New Genesis reuses genome/state with G/H/I and new nonce | accepted | new ID `mortalos:Ett2...wnU` |

The mortality evaluator is deliberately an observer/test function. It does not create a consensus `death_certificate`. The trace proves the conditional v0 statement only because the controlled experiment explicitly supplies irreversible key-loss and complete pending-artifact assumptions.

## 6. Concrete insights

1. **Structural strictness and semantic determinism are different.** Over-constraining JSON Schema hid the protocol's normative error vocabulary. The corrected boundary makes conformance behavior observable.
2. **Locale is consensus input if allowed accidentally.** `localeCompare` sorted base64url IDs differently from raw byte order. Consensus sorting must state and implement byte order explicitly.
3. **A validator cannot prove death from bytes alone.** It can prove candidate invalidity; controlled mortality additionally needs evidence about usable keys and pending authorization artifacts.
4. **Public data is not continuity authority.** Genesis, full lineage, public keys, state commitment, and genome commitment are insufficient to produce a successor without current quorum signatures.
5. **Key deletion is not revocation.** The signed sequence-3 child remains valid after its signers disappear, so death may be declared only after pending authorized work is enumerated and drained.
6. **Identity survives complete substrate replacement.** A/B/C are all absent at sequence 3 while the Genesis-derived ID remains unchanged.
7. **Clone and resurrection are mechanically distinguishable.** A same-genome new Genesis with a new nonce is valid under a new identity; it cannot claim the old lineage.
8. **H2 is already a useful developer artifact.** The stable rejection code, deterministic JSON, and replay digest provide a stronger judging path than a purely visual mockup.

## 7. Residual risks and next gate

- Only the Node.js reference implementation exists; browser portability and a second independent validator remain unproved.
- The canonicalizer covers the protocol's tested I-JSON domain but should be differential-tested against an independent RFC 8785 implementation before declaring language-independent conformance complete.
- Fork/replay state across a store of previously accepted siblings is not implemented; H1 validates a supplied linear parent context.
- The 10,000-case corpus generates adversarial continuations from the accepted fixture rather than arbitrary cryptographically re-signed valid histories.
- Mortality assumptions are supplied by a controlled observer; malicious key backup and globally hidden latent messages remain out of scope.
- H3 must expose this exact core in a browser without duplicating validity logic.
- H4 must keep GPT-5.6 outside the trusted computing base.

**Next gate:** H3 MortalOS Lab, beginning with a browser portability spike for the codec and Ed25519 verification, followed by a one-click rendering of this exact H2 trace.
