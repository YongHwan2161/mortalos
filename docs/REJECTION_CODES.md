# MortalOS v0 Rejection Codes

Status: **Normative and executable**

The code set in this document must exactly match [`src/rejection-codes.mjs`](../src/rejection-codes.mjs). `npm run verify:p0` fails if either side adds, removes, or misspells a code without updating the other.

Transition verification returns the first applicable code in the validation order from [`PROTOCOL.md`](PROTOCOL.md). The lineage registry adds parent-recognition, replay, and fork-state results after intrinsic transition checks.

## 1. Result shape

```text
Reject {
  status: "reject",
  code: string,
  field_path: string,
  deterministic_detail: string
}
```

`field_path` uses JSON Pointer where possible. `deterministic_detail` contains machine-stable values, never localized prose.

## 2. Parse, schema, and encoding

| Code | Condition |
|---|---|
| `E_PARSE_INVALID_UTF8` | Input is not valid UTF-8. |
| `E_PARSE_INVALID_JSON` | Input is not valid JSON. |
| `E_PARSE_DUPLICATE_PROPERTY` | A raw JSON object contains a duplicate property name. |
| `E_PARSE_NON_IJSON` | Input violates the I-JSON value constraints required by JCS. |
| `E_PARSE_LIMIT_EXCEEDED` | Raw input exceeds the normative byte or JSON nesting-depth limit. |
| `E_SCHEMA_WRONG_KIND` | Top-level `kind` is absent or unsupported. |
| `E_SCHEMA_INVALID` | Input fails its Draft 2020-12 structural schema. |
| `E_SCHEMA_UNKNOWN_FIELD` | Input contains a property forbidden by `additionalProperties: false`. |
| `E_CANONICAL_MISMATCH` | Raw bytes are not exactly the RFC 8785 canonical encoding of the parsed value. |
| `E_ARRAY_NOT_SORTED` | A keyed array is not strictly sorted by complete ASCII `key_id`. |
| `E_ARRAY_DUPLICATE_KEY_ID` | A custodian array contains a duplicate `key_id`. |
| `E_BINARY_ENCODING` | A prefixed base64url field has invalid characters, padding, prefix, or decoded length. |

## 3. Version and algorithms

| Code | Condition |
|---|---|
| `E_VERSION_UNSUPPORTED` | `protocol_version` is not `mortalos/0`. |
| `E_HASH_ALGORITHM_UNSUPPORTED` | Genesis hash algorithm is not `sha-256`. |
| `E_SIGNATURE_ALGORITHM_UNSUPPORTED` | Genesis signature algorithm is not `ed25519`. |

## 4. Identity, commitments, and custody

| Code | Condition |
|---|---|
| `E_PEER_ID_MISMATCH` | A custodian `key_id` is not derived from its declared public key. |
| `E_ORGANISM_ID_MISMATCH` | Pulse `organism_id` differs from the validated Genesis-derived ID. |
| `E_GENOME_HASH_MISMATCH` | Pulse genome hash differs from Genesis. |
| `E_CURRENT_CUSTODY_HASH_MISMATCH` | Pulse custody commitment differs from the parent-effective descriptor. |
| `E_STATE_ROOT_ENCODING` | State root is not a valid v0 SHA-256 encoding. |
| `E_EVENT_PAYLOAD_HASH_ENCODING` | Event payload hash is not a valid v0 SHA-256 encoding. |
| `E_CUSTODIAN_COUNT_RANGE` | Custodian count is outside 3 through 16. |
| `E_CUSTODIAN_DUPLICATE_KEY` | Two custodians declare the same public key. |
| `E_QUORUM_TYPE_UNSUPPORTED` | Quorum type is not `threshold`. |
| `E_QUORUM_THRESHOLD_RANGE` | Threshold is less than 2 or greater than custodian count. |
| `E_QUORUM_NOT_MAJORITY` | `2 * threshold <= custodian_count`. |
| `E_GENESIS_APPROVAL_SET` | Genesis approvals do not contain exactly all initial custodians. |

## 5. Parent, sequence, and lineage recognition

| Code | Condition |
|---|---|
| `E_PARENT_REQUIRED` | The low-level transition verifier did not receive a genuine validated parent capability. |
| `E_PARENT_UNKNOWN` | The lineage registry cannot resolve the committed `parent_hash` in its accepted graph. |
| `E_PARENT_HASH_MISMATCH` | Candidate `parent_hash` differs from the supplied genuine parent. |
| `E_SEQUENCE_INVALID_FORMAT` | Sequence is not canonical unsigned decimal. |
| `E_SEQUENCE_NOT_NEXT` | Sequence is not exactly parent sequence plus one. |
| `E_LINEAGE_UNKNOWN` | Genesis capability is invalid or parent and Genesis belong to different organisms. |
| `E_REPLAY_STALE` | The lineage registry already contains the candidate object hash. |

There is no public operation that replaces a recognized head with an ancestor, so v0 does not expose a separate rollback code. A repeated object is replay; a distinct valid child of an ancestor whose child is already known is a fork.

## 6. Event semantics

| Code | Condition |
|---|---|
| `E_EVENT_KIND_UNSUPPORTED` | Event kind is not `heartbeat` or `membership-change`. |
| `E_EVENT_PAYLOAD_REQUIRED` | Exact event-payload sidecar bytes are absent. |
| `E_EVENT_PAYLOAD_INVALID` | Payload bytes are not a canonical I-JSON object or contain duplicate properties. |
| `E_EVENT_PAYLOAD_MISMATCH` | `payload_hash` does not commit to the supplied complete payload. |
| `E_HEARTBEAT_STATE_CHANGED` | A heartbeat changes `state_root`. |
| `E_HEARTBEAT_CUSTODY_CHANGED` | A heartbeat changes custody or quorum. |
| `E_HEARTBEAT_PAYLOAD_NONEMPTY` | A heartbeat payload is not canonical `{}`. |
| `E_MEMBERSHIP_STATE_CHANGED` | A membership-change Pulse changes logical state. |
| `E_MEMBERSHIP_CUSTODY_UNCHANGED` | A membership-change Pulse leaves custody and quorum unchanged. |

## 7. Approval and acceptance evidence

| Code | Condition |
|---|---|
| `E_APPROVAL_SIGNER_INELIGIBLE` | Approval signer is not a current custodian. |
| `E_APPROVAL_DUPLICATE` | More than one approval is supplied for the same `key_id`. |
| `E_APPROVAL_SIGNATURE_INVALID` | Ed25519 approval signature does not verify for the normative message. |
| `E_APPROVAL_INSUFFICIENT_QUORUM` | Valid eligible unique approvals are below the parent-derived threshold. |
| `E_ACCEPTANCE_SIGNER_NOT_NEW` | Acceptance signer remains in both current and next custody and is not newly added. |
| `E_ACCEPTANCE_MISSING` | A newly added custodian has no acceptance. `validateLatentSuccessor` may convert this into authenticated latent evidence only after every earlier rule and supplied acceptance signature passes. |
| `E_ACCEPTANCE_UNEXPECTED` | A removed or unrelated peer supplies an acceptance. |
| `E_ACCEPTANCE_DUPLICATE` | More than one acceptance is supplied for the same `key_id`. |
| `E_ACCEPTANCE_SIGNATURE_INVALID` | A supplied new-custodian acceptance signature does not verify. |

## 8. Fork safety

| Code | Condition |
|---|---|
| `E_FORK_DETECTED` | Two distinct candidates independently validate against the same accepted parent. The registry returns both child hashes and intersecting approval signer IDs, then enters `FORKED`. |
| `E_LINEAGE_ALREADY_FORKED` | Automatic append is attempted after the registry has entered `FORKED`. |

Signer equivocation is evidence attached to `E_FORK_DETECTED`, not a competing first-error code. Strict-majority valid siblings necessarily have at least one approval signer in common.

## 9. Internal fail-closed code

| Code | Condition |
|---|---|
| `E_VALIDATOR_INTERNAL` | An unknown internal rejection identifier or invariant-breaking error is mapped to the stable fail-closed result. |

## 10. Precedence examples

- Malformed JSON with forged signatures returns `E_PARSE_INVALID_JSON` before any cryptographic result.
- A structurally valid Pulse with the wrong organism ID and insufficient signatures returns `E_ORGANISM_ID_MISMATCH` first.
- A validly signed heartbeat that changes state returns `E_HEARTBEAT_STATE_CHANGED` before quorum acceptance can make it valid.
- A cloned accepted parent returns `E_PARENT_REQUIRED`; acceptance-shaped fields do not create a capability.
- A second valid sibling produces `E_FORK_DETECTED` only after it passes every intrinsic transition check.
