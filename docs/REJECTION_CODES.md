# MortalOS v0 Rejection Codes

Status: **Normative**

Validators return the first applicable code in the validation order defined by [`PROTOCOL.md`](PROTOCOL.md). Codes are stable protocol identifiers. Human-readable text may change without changing the code.

## 1. Result shape

```text
Reject {
  code: string,
  field_path: string,
  deterministic_detail: string
}
```

`field_path` uses JSON Pointer where possible. `deterministic_detail` contains machine-stable values, not localized prose.

## 2. Parse and encoding codes

| Code | Condition |
|---|---|
| `E_PARSE_INVALID_UTF8` | Input is not valid UTF-8. |
| `E_PARSE_INVALID_JSON` | Input is not valid JSON. |
| `E_PARSE_DUPLICATE_PROPERTY` | A JSON object contains a duplicate property name. |
| `E_PARSE_NON_IJSON` | Input violates the I-JSON constraints required by JCS. |
| `E_SCHEMA_WRONG_KIND` | Top-level `kind` is absent or unsupported. |
| `E_SCHEMA_INVALID` | Input fails its Draft 2020-12 structural schema. |
| `E_SCHEMA_UNKNOWN_FIELD` | Input contains a property forbidden by `additionalProperties: false`. |
| `E_CANONICAL_MISMATCH` | Parsed object cannot be represented or re-canonicalized as required by RFC 8785. |
| `E_ARRAY_NOT_SORTED` | A custodian, approval, or acceptance array is not strictly sorted by `key_id`. |
| `E_ARRAY_DUPLICATE_KEY_ID` | A keyed array contains a duplicate `key_id`. |
| `E_BINARY_ENCODING` | A prefixed base64url field has invalid characters, padding, or decoded length. |

## 3. Version and algorithm codes

| Code | Condition |
|---|---|
| `E_VERSION_UNSUPPORTED` | `protocol_version` is not `mortalos/0`. |
| `E_HASH_ALGORITHM_UNSUPPORTED` | Hash algorithm is not `sha-256`. |
| `E_SIGNATURE_ALGORITHM_UNSUPPORTED` | Signature algorithm is not `ed25519`. |

## 4. Identity, hash, and custody derivation codes

| Code | Condition |
|---|---|
| `E_PEER_ID_MISMATCH` | Custodian `key_id` is not derived from its declared public key. |
| `E_ORGANISM_ID_MISMATCH` | Pulse `organism_id` differs from the validated Genesis-derived ID. |
| `E_GENOME_HASH_MISMATCH` | Pulse genome hash differs from Genesis. |
| `E_CURRENT_CUSTODY_HASH_MISMATCH` | Pulse custody commitment differs from the parent-effective descriptor. |
| `E_STATE_ROOT_ENCODING` | State root is not a valid v0 digest. |
| `E_EVENT_PAYLOAD_HASH_ENCODING` | Event payload hash is not a valid v0 digest. |
| `E_HASH_DERIVATION_MISMATCH` | A supplied or recomputed digest does not match the normative domain-separated derivation. |

## 5. Custody and quorum codes

| Code | Condition |
|---|---|
| `E_CUSTODIAN_COUNT_RANGE` | Custodian count is outside 3 through 16. |
| `E_CUSTODIAN_DUPLICATE_KEY` | Two custodians declare the same public key or derived peer ID. |
| `E_QUORUM_TYPE_UNSUPPORTED` | Quorum type is not `threshold`. |
| `E_QUORUM_THRESHOLD_RANGE` | Threshold is less than 2 or greater than custodian count. |
| `E_QUORUM_NOT_MAJORITY` | `2 * threshold <= custodian_count`. |
| `E_GENESIS_APPROVAL_SET` | Genesis approvals do not contain exactly all initial custodians. |

## 6. Parent and sequence codes

| Code | Condition |
|---|---|
| `E_PARENT_REQUIRED` | Required accepted parent context is missing. |
| `E_PARENT_HASH_MISMATCH` | `parent_hash` does not identify the required Genesis or accepted parent Pulse. |
| `E_SEQUENCE_INVALID_FORMAT` | Sequence is not canonical unsigned decimal. |
| `E_SEQUENCE_NOT_NEXT` | Sequence is not exactly parent sequence plus one. |
| `E_LINEAGE_UNKNOWN` | Candidate cannot be connected to the validated Genesis. |
| `E_REPLAY_STALE` | Candidate is an already processed or ancestry-stale object that cannot advance the head. |
| `E_ROLLBACK_ATTEMPT` | Candidate attempts to replace the recognized head with an ancestor or unrelated lower state. |

## 7. Event semantic codes

| Code | Condition |
|---|---|
| `E_EVENT_KIND_UNSUPPORTED` | Event kind is not a v0 event kind. |
| `E_EVENT_PAYLOAD_MISMATCH` | `payload_hash` does not commit to the provided complete payload. |
| `E_HEARTBEAT_STATE_CHANGED` | A heartbeat changes `state_root`. |
| `E_HEARTBEAT_CUSTODY_CHANGED` | A heartbeat changes custody or quorum. |
| `E_HEARTBEAT_PAYLOAD_NONEMPTY` | A heartbeat payload is not canonical `{}`. |
| `E_STATE_TRANSITION_CUSTODY_CHANGED` | A state transition also changes custody or quorum. |
| `E_STATE_TRANSITION_GENOME_REJECTED` | Immutable genome validator rejects the proposed logical transition. |
| `E_STATE_TRANSITION_VALIDATOR_MISSING` | Required genome validator is unavailable. |
| `E_MEMBERSHIP_STATE_CHANGED` | A membership-change Pulse changes logical state. |
| `E_REPAIR_STATE_CHANGED` | A repair Pulse changes logical state rather than storage/custody embodiment. |

## 8. Approval and acceptance codes

| Code | Condition |
|---|---|
| `E_APPROVAL_SIGNER_INELIGIBLE` | Approval signer is not a current custodian. |
| `E_APPROVAL_DUPLICATE` | More than one approval is supplied for the same `key_id`. |
| `E_APPROVAL_SIGNATURE_INVALID` | Ed25519 approval signature does not verify for the normative message. |
| `E_APPROVAL_INSUFFICIENT_QUORUM` | Valid eligible unique approvals are below current threshold. |
| `E_ACCEPTANCE_SIGNER_NOT_NEW` | Acceptance signer is not newly added by this Pulse. |
| `E_ACCEPTANCE_MISSING` | A newly added custodian has no valid acceptance. |
| `E_ACCEPTANCE_UNEXPECTED` | An unchanged, removed, or unrelated peer supplies an acceptance. |
| `E_ACCEPTANCE_DUPLICATE` | More than one acceptance is supplied for the same `key_id`. |
| `E_ACCEPTANCE_SIGNATURE_INVALID` | Custody-acceptance signature does not verify for the normative message. |

## 9. Contextual safety codes

| Code | Condition |
|---|---|
| `E_SIGNER_EQUIVOCATION` | The validator observes one key signing distinct children for the same organism, sequence, and parent. |
| `E_FORK_DETECTED` | Two distinct candidates independently validate against the same parent. The local lineage enters `FORKED`. |
| `E_LINEAGE_ALREADY_FORKED` | Automatic advancement is attempted while the local lineage is already `FORKED`. |
| `E_DESCENDANT_UNSUPPORTED_V0` | A v0 message claims protocol-recognized reproduction or descent. |

## 10. Internal fail-closed codes

These codes indicate an implementation or environmental failure. The candidate MUST NOT be accepted.

| Code | Condition |
|---|---|
| `E_CRYPTO_UNAVAILABLE` | Required SHA-256 or Ed25519 implementation is unavailable. |
| `E_CANONICALIZER_UNAVAILABLE` | RFC 8785 canonicalizer is unavailable. |
| `E_VALIDATOR_INTERNAL` | Validator encounters an invariant-breaking internal error. |

## 11. Precedence examples

- Malformed JSON with a forged signature returns `E_PARSE_INVALID_JSON`, not a signature code.
- A structurally valid Pulse with the wrong organism ID and insufficient signatures returns `E_ORGANISM_ID_MISMATCH` first.
- A validly signed heartbeat that changes state returns `E_HEARTBEAT_STATE_CHANGED` before quorum acceptance can make it valid.
- A second valid sibling produces `E_FORK_DETECTED` only after both candidates independently pass all intrinsic checks.

