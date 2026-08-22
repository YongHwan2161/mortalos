# MortalOS v0/v1 Rejection Codes

Status: **Normative and executable**

The code set in this document must exactly match [`src/rejection-codes.mjs`](../src/rejection-codes.mjs). `npm run verify:spec` fails if either side adds, removes, or misspells a code without updating the other.

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
| `E_PARSE_INVALID_UTF8` | Input is not an accepted stable `Uint8Array` snapshot source (including SharedArrayBuffer-backed views), or its bytes are not valid UTF-8. |
| `E_PARSE_INVALID_JSON` | Input is not valid JSON. |
| `E_PARSE_DUPLICATE_PROPERTY` | A raw JSON object contains a duplicate property name. |
| `E_PARSE_NON_IJSON` | Input violates the I-JSON/JCS value model, including an out-of-range number or lone surrogate; for programmatic input this also includes a custom record prototype, a recognizable intrinsic-slot object presented as an unbranded null-prototype record, cycle, sparse/extended array, symbol/non-enumerable/accessor property, unsupported value, or failed structural snapshot. Array prototypes are not inspected by programmatic canonicalization. |
| `E_PARSE_LIMIT_EXCEEDED` | Raw input exceeds the normative byte or JSON nesting-depth limit. |
| `E_SCHEMA_WRONG_KIND` | Top-level `kind` is absent or unsupported. |
| `E_SCHEMA_INVALID` | Input fails its Draft 2020-12 structural schema. |
| `E_SCHEMA_UNKNOWN_FIELD` | Input contains a property forbidden by `additionalProperties: false`. |
| `E_CANONICAL_MISMATCH` | Raw bytes are not exactly the RFC 8785 canonical encoding of the parsed value. |
| `E_ARRAY_NOT_SORTED` | A keyed array is not strictly sorted by complete `key_id` using lexicographic unsigned UTF-16 code-unit order. |
| `E_ARRAY_DUPLICATE_KEY_ID` | A custodian array contains a duplicate `key_id`. |
| `E_BINARY_ENCODING` | A prefixed base64url field has invalid characters, padding, prefix, or decoded length. |

## 3. Version and algorithms

| Code | Condition |
|---|---|
| `E_VERSION_UNSUPPORTED` | `protocol_version` is neither `mortalos/0` nor `mortalos/1`, or a Pulse version differs from its Genesis. |
| `E_HASH_ALGORITHM_UNSUPPORTED` | Genesis hash algorithm is not `sha-256`. |
| `E_SIGNATURE_ALGORITHM_UNSUPPORTED` | Genesis signature algorithm is not `ed25519`. |

## 4. Identity, commitments, and custody

| Code | Condition |
|---|---|
| `E_PUBLIC_KEY_INVALID_POINT` | A correctly sized Ed25519 public-key encoding is non-canonical, low-order, mixed-order, or outside the required prime-order subgroup. This precedes peer-ID comparison. |
| `E_PEER_ID_MISMATCH` | A custodian `key_id` is not derived from its declared public key. |
| `E_ORGANISM_ID_MISMATCH` | Pulse `organism_id` differs from the validated Genesis-derived ID. |
| `E_GENOME_HASH_MISMATCH` | Pulse genome hash differs from Genesis. |
| `E_CURRENT_CUSTODY_HASH_MISMATCH` | Pulse custody commitment differs from the parent-effective descriptor. |
| `E_STATE_ROOT_ENCODING` | State root is not a valid v0 SHA-256 encoding. |
| `E_STATE_GENOME_MISMATCH` | A v1 built-in genome byte artifact does not match the declared genome hash or supported Pulse Seed v1 genome. |
| `E_STATE_INITIAL_BINDING` | A v1 Genesis omits, malforms, or mismatches its exact genome/initial-state sidecars or begins with a nonzero pulse count. |
| `E_STATE_INPUT_INVALID` | A v1 state, input, transition payload, or artifact is malformed, noncanonical, wrong-versioned, or unsupported. |
| `E_STATE_LIMIT_EXCEEDED` | A v1 state/input/receipt byte, step, or pulse-count ceiling is exceeded; no transition is committed. |
| `E_STATE_PRIOR_ROOT_MISMATCH` | The transition's prior state bytes do not hash to the accepted parent state root. |
| `E_STATE_NEXT_ROOT_MISMATCH` | Deterministic next-state bytes differ from the supplied sidecar or declared next state root. |
| `E_STATE_RECEIPT_MISMATCH` | The supplied v1 receipt bytes differ from the deterministic engine receipt. |
| `E_STATE_CUSTODY_CHANGED` | A `state-transition` attempts to change custody or quorum. |
| `E_STATE_PACKAGE_INVALID` | A state-package input, manifest, receipt, or transition sidecar is malformed, noncanonical, wrong-versioned, or has unknown fields. |
| `E_STATE_PACKAGE_LIMIT_EXCEEDED` | A resource, chunk, document, source count, or inventory exceeds an S3 fixed ceiling. |
| `E_STATE_PACKAGE_DECODING_UNSUPPORTED` | A package requests compression, encoding, or a non-raw resource representation. |
| `E_STATE_PACKAGE_CHUNK_ORDER` | A manifest chunk index does not equal its canonical array position. |
| `E_STATE_PACKAGE_CHUNK_DUPLICATE` | A manifest repeats a content digest. |
| `E_STATE_PACKAGE_CHUNK_SIZE` | A chunk or aggregate size differs from the fixed manifest contract. |
| `E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH` | Fetched or stored chunk bytes do not match their named digest. |
| `E_STATE_PACKAGE_RESOURCE_ROOT_MISMATCH` | Reconstructed ordered resource bytes do not match the aggregate root. |
| `E_STATE_PACKAGE_STALE_ROOT` | A package prior root does not equal the accepted parent state root. |
| `E_STATE_PACKAGE_INPUT_MISMATCH` | The canonical transition input does not match the manifest input digest. |
| `E_STATE_PACKAGE_RECEIPT_MISMATCH` | Receipt bytes or their domain-separated digest differ from the deterministic package receipt. |
| `E_STATE_UNAVAILABLE` | The bounded recovery observation cannot obtain every required chunk; this is not protocol death. |
| `E_STATE_RECOVERY_INTERRUPTED` | A staged chunk or final active-record boundary was interrupted; the prior verified active record remains. |
| `E_CONFIDENTIAL_FORMAT` | An S4 canonical document has the wrong exact shape, format, encoding, or byte representation. |
| `E_CONFIDENTIAL_LIMIT` | An S4 resource, package, AAD, chunk, membership, or document exceeds a fixed suite-1 ceiling. |
| `E_CONFIDENTIAL_DECIMAL` | An epoch, counter, count, or interval is not a canonical bounded decimal string. |
| `E_CONFIDENTIAL_CRYPTO` | Required WebCrypto support or an exact suite-1 primitive result is unavailable. |
| `E_CONFIDENTIAL_KEY` | A custodian encryption public key has an invalid digest, encoding, algorithm, modulus, exponent, hash, or usage. |
| `E_CONFIDENTIAL_EPOCH` | An epoch ID basis is malformed, unsorted, duplicated, or not bound to its exact authority, membership, organism, and transition. |
| `E_CONFIDENTIAL_IV` | An IV is not the exact `MOS4 || uint64_be(counter)` value or repeats within a package. |
| `E_CONFIDENTIAL_COUNTER_RECEIPT` | A reservation receipt has invalid canonical fields, arithmetic, chain binding, authority identity, or strict Ed25519 signature. |
| `E_CONFIDENTIAL_COUNTER_STALE` | A reservation or receipt does not match the active next counter and prior-receipt digest. |
| `E_CONFIDENTIAL_COUNTER_EXHAUSTED` | A reservation would exceed the suite-1 `2^32` invocation cap for one epoch key. |
| `E_CONFIDENTIAL_COUNTER_AUTHORITY` | The bound counter authority is lost, retired, mismatched, or cannot perform its linearizable transaction. |
| `E_CONFIDENTIAL_WRAP` | An epoch-key wrap, OAEP label, recipient/key binding, wrapped length, or unwrap operation is invalid. |
| `E_CONFIDENTIAL_MEMBERSHIP` | The encryption membership is empty, duplicated, or inconsistent with the exact current custodian set. |
| `E_CONFIDENTIAL_CHUNK` | A ciphertext chunk has an invalid order, counter, length, tag, encoding, or digest. |
| `E_CONFIDENTIAL_AAD` | Canonical chunk AAD is oversized, malformed, or not bound to the exact package context. |
| `E_CONFIDENTIAL_BINDING` | A verified package differs from an explicitly required organism, membership, epoch, resource, or prior confidential root. |
| `E_CONFIDENTIAL_PACKAGE_ROOT` | The canonical ciphertext manifest does not reproduce its declared confidential root. |
| `E_CONFIDENTIAL_RECEIPT` | The confidential transition receipt does not exactly bind the verified package. |
| `E_CONFIDENTIAL_KEY_UNAVAILABLE` | Ciphertext is available but the endpoint has no exact current-recipient unwrap authority; this is not invalid lineage or death. |
| `E_CONFIDENTIAL_REJECTED` | Authenticated decryption or the encrypted internal resource commitment fails without exposing partial plaintext or an oracle detail. |
| `E_CONFIDENTIAL_INTERRUPTED` | S4 recovery or final confidential activation is interrupted while retaining a complete old or new epoch. |
| `E_CONFIDENTIAL_ACTIVATION_STALE` | An atomic confidential-epoch activation compares against a different active prior root. |
| `E_CONFIDENTIAL_ROTATION` | A rotation lacks exact quorum-validated input, a consecutive epoch, an allowed reason, or the required membership/authority binding. |
| `E_EVENT_PAYLOAD_HASH_ENCODING` | Event payload hash is not a valid v0 SHA-256 encoding. |
| `E_CUSTODIAN_COUNT_RANGE` | Custodian count is outside 1 through 16. |
| `E_CUSTODIAN_DUPLICATE_KEY` | Two custodians declare the same public key. |
| `E_QUORUM_TYPE_UNSUPPORTED` | Quorum type is not `threshold`. |
| `E_QUORUM_THRESHOLD_RANGE` | Threshold is less than 1 or greater than custodian count. |
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
| `E_EVENT_KIND_UNSUPPORTED` | Event kind is not `heartbeat` or `membership-change`, nor `state-transition` for a v1 lineage. |
| `E_EVENT_PAYLOAD_REQUIRED` | Exact event-payload sidecar bytes are absent. |
| `E_EVENT_PAYLOAD_INVALID` | Payload bytes are not a canonical I-JSON object or contain duplicate properties. |
| `E_EVENT_PAYLOAD_MISMATCH` | `payload_hash` does not commit to the supplied complete payload. |
| `E_HEARTBEAT_STATE_CHANGED` | A heartbeat changes `state_root`. |
| `E_HEARTBEAT_CUSTODY_CHANGED` | A heartbeat changes custody or quorum. |
| `E_HEARTBEAT_PAYLOAD_NONEMPTY` | A heartbeat payload is not canonical `{}`. |
| `E_MEMBERSHIP_STATE_CHANGED` | A membership-change Pulse changes logical state. |
| `E_MEMBERSHIP_CUSTODY_UNCHANGED` | A membership-change Pulse leaves custody and quorum unchanged. |

## 7. Approval and acceptance evidence

The mortality-feasibility validator described below is an internal helper intentionally not re-exported by the supported `src/index.mjs` API. It can inform observer classification but cannot publicly accept a Pulse.

| Code | Condition |
|---|---|
| `E_APPROVAL_SIGNER_INELIGIBLE` | Approval signer is not a current custodian. |
| `E_APPROVAL_DUPLICATE` | More than one approval is supplied for the same `key_id`. |
| `E_APPROVAL_SIGNATURE_INVALID` | Ed25519 approval signature does not verify for the normative message. |
| `E_APPROVAL_INSUFFICIENT_QUORUM` | Valid eligible unique supplied approvals are below the parent-derived threshold. Internal mortality feasibility reports this only when their union with explicitly usable eligible current signers is still below threshold; ordinary validation never counts hypothetical signatures. |
| `E_ACCEPTANCE_SIGNER_NOT_NEW` | Acceptance signer remains in both current and next custody and is not newly added. |
| `E_ACCEPTANCE_MISSING` | A newly added custodian has no acceptance. Public `validateLatentSuccessor` may convert this into durable latent evidence only after the supplied current quorum and every supplied acceptance signature pass. Internal mortality feasibility may report it alongside missing explicitly usable current approvals. |
| `E_ACCEPTANCE_UNEXPECTED` | A removed or unrelated peer supplies an acceptance. |
| `E_ACCEPTANCE_DUPLICATE` | More than one acceptance is supplied for the same `key_id`. |
| `E_ACCEPTANCE_SIGNATURE_INVALID` | A supplied new-custodian acceptance signature does not verify. |
| `E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT` | Valid retained current approvers plus valid new-custodian acceptances do not cover `next_quorum.threshold`. Ordinary validation counts supplied evidence only. Public durable-latent validation may count explicitly missing required new acceptances; internal mortality feasibility may additionally count a missing retained-current approval only when that key is in the single snapshotted usable set. |

## 8. Fork safety

| Code | Condition |
|---|---|
| `E_FORK_DETECTED` | Two distinct candidates independently validate against the same accepted parent. The registry returns both child hashes and intersecting approval signer IDs, then enters `FORKED`. |
| `E_LINEAGE_ALREADY_FORKED` | An otherwise valid, non-replay append is attempted after the registry has entered `FORKED`; intrinsic validation and replay checks retain their earlier precedence. |

Signer equivocation in two accepted sibling appends is evidence attached to `E_FORK_DETECTED`, not a competing first-error code. Strict-majority valid siblings necessarily have at least one approval signer in common. During conservative mortality analysis, authenticated multi-body evidence that cannot safely be promoted to an accepted fork instead yields the observer state `evidence_equivocation`; that state is not a rejection code.

## 9. Signed resource contract

| Code | Condition |
|---|---|
| `E_RESOURCE_FORMAT` | An offer, lease, consumption witness, gossip announcement, usage receipt, revocation, option record, array, nonce, or canonical byte envelope has the wrong exact shape or representation. |
| `E_RESOURCE_LIMIT` | A generated document, announcement, observed-lease, witness roster, announcement-set, receipt-chain, revocation-set, or sequence ceiling is exceeded. |
| `E_RESOURCE_DECIMAL` | A resource capacity, usage, time, or sequence is not a canonical non-negative decimal string within the generated 63-bit maximum. |
| `E_RESOURCE_IDENTITY` | A provider, consumer, or witness identity is not a strict Ed25519 public key bound to its derived peer ID, or one key attempts to occupy both provider and consumer roles in a lease. |
| `E_RESOURCE_SIGNATURE` | A provider, consumer, witness, usage, or revocation signature does not verify under its exact role-specific domain. |
| `E_RESOURCE_WITNESS` | The signed witness policy violates its generated roster limit or Byzantine quorum inequalities, a role overlaps, a witness is outside the roster, or usage is supplied before the declared threshold is visible. |
| `E_RESOURCE_TIME` | An interval is empty, outside its parent interval, over the duration ceiling, non-monotonic, after its target, or observed in the future relative to explicit evaluation time. |
| `E_RESOURCE_CAPACITY` | A capacity group is incoherent or empty, or a lease allocation exceeds its signed offer. |
| `E_RESOURCE_BINDING` | A derived ID, offer reference, lease reference, target ID, or envelope body binding differs from the supplied parent evidence. |
| `E_RESOURCE_USAGE` | Current/peak usage is inconsistent or a signed usage quantity exceeds its lease allocation. |
| `E_RESOURCE_REPLAY` | A lease, revocation, receipt sequence, previous receipt ID, or cumulative quantity is duplicated, stale, reordered, or regressed. |
| `E_RESOURCE_EQUIVOCATION` | Two different valid mutually signed leases consume the same single-use offer, or one witness signs different lease claims for that offer; no winner is selected. |
| `E_RESOURCE_REVOCATION` | A revocation has an unsupported target/reason or is not signed by the provider for an offer or by one of the two lease parties. |
| `E_RESOURCE_EXECUTION` | A lease-bound challenge, deterministic result, content proof, measured-usage binding, or one-to-one execution-receipt chain is missing, unsupported, or invalid. |

## 10. Internal fail-closed code

| Code | Condition |
|---|---|
| `E_VALIDATOR_INTERNAL` | An unknown internal rejection identifier, hostile public input that cannot be safely inspected, or invariant-breaking exception is mapped to the stable fail-closed result. Public validation operations do not throw. |

## 11. Mortality observer resource result

Mortality resource exhaustion is not a Pulse rejection and does not add an `E_*`
code. The observer returns frozen `indeterminate / limit_exceeded` with
`mortality_classified: false`, a stable resource identifier, normalized
`observed = maximum + 1`, and the fixed maximum. The seven resources are
`candidate_bodies` (128), `candidate_canonical_bytes` (4,194,304),
`usable_key_ids` (16), `usable_key_id_chars` (768), `pending_records` (128),
`pending_bytes` (4,194,304), and `signature_verifications` (1,152). The signature
ceiling admits the maximum 16-current/16-new transition at 1,088 units with 64 units
of headroom; three identical complete direct carriers consume exactly 1,152 because
each direct validator call is reserved independently while exact-body remapping is
de-duplicated. Partial work
cannot produce a life, death, fork, opacity, equivocation, or latent-successor result,
and cannot mutate the accepted graph. Exact precedence and the normative result shape
are specified in [`PROTOCOL.md`](PROTOCOL.md#8-validation-context-and-dependency-rules).

## 12. Precedence examples

S6/S8 local Capsule custody APIs additionally use `E_CUSTODY_EQUIVOCATION` for
multiple different valid Capsules, `E_CUSTODY_QUORUM_UNAVAILABLE` when valid copies
are below the requested quorum, and `E_CUSTODY_NONCANONICAL` if one capsule identity
is represented by different bytes. Signed product-copy recovery also uses
`E_CUSTODY_DUPLICATE_COPY` (surfaced as `E_CONTINUITY_DUPLICATE_COPY`) for a repeated
copy/provider identity and `E_CUSTODY_RUNTIME`/`E_CONTINUITY_RUNTIME` for corrupted
realm intrinsics. Raw `recoverContinuityCapsuleQuorum` is compatibility integrity
counting; only `recoverContinuityCopyQuorum` proves distinct signed logical identities.
These are local activation errors, not v0/v1 lineage rejection codes.

The lineage-placement controller similarly throws local scheduling errors rather
than validator rejection codes: `E_LINEAGE_PLACEMENT_RUNTIME` for realm-integrity
drift, `E_LINEAGE_PLACEMENT_FORMAT` for malformed, accessor/Proxy/sparse-array, or
non-canonical documents, `E_LINEAGE_PLACEMENT_LIMIT` for bounded-input violations
including `generation-sequence-overflow`,
`E_LINEAGE_PLACEMENT_GENERATION` for an invalid evidence summary, ID, prior binding,
or repeated/decremented/skipped successor number (`generation-sequence`),
`E_LINEAGE_PLACEMENT_STALE` when a generation no longer names the current
Continuity parent, and `E_LINEAGE_PLACEMENT_COMMIT` when the named generation or
prior transition is absent or mismatched in the verified Capsule. A valid sibling
set is not thrown away; convergence returns the explicit fail-closed state
`halted / generation-fork` with no selected commit. A candidate chain that omits
generation 1, skips an intermediate generation, or fails to represent the latest
authenticated placement transition visible in any supplied verified Capsule returns
`halted / incomplete-chain`; a Capsule with an existing placement commit cannot
reset to generation 1. Historical prefix candidates remain valid when the complete
chain represents every supplied Capsule tip.

The confidential placement journal-v2 layer uses
`E_CONFIDENTIAL_PLACEMENT_REPROOF` for a malformed context or one that does not bind
the exact prior journal head, next generation, manifest/policy, or epoch transition,
and for invalid chain/nonce-derivation inputs. During evaluation, a challenge nonce
that differs from the context-derived value becomes the placement reason
`reproof-context-mismatch`; a previously seen chain that is not the exact
sequence/predecessor successor of its cumulative high-water becomes
`restart-reproof-required`. Neither can enter the private active-proof brand.
`E_CONFIDENTIAL_PLACEMENT_JOURNAL` rejects an unbranded evaluation, anything other
than an active distinct-provider/shard `3/3` set, a context/journal mismatch,
ambiguous or incomplete high-water history, an active proof that is not its chain
high-water, or a malformed/self-hash-mismatched v2 document. Evaluator acquisition
and nested validation use owned inert snapshots plus contained operations;
executable recognized fields, sparse arrays, caller method overrides, or runtime
drift fail closed as `E_CONFIDENTIAL_PLACEMENT_FORMAT` and cannot mint the private
reproof brand.

`E_CONFIDENTIAL_PLACEMENT_MIGRATION` prevents a legacy v1 journal from being restored
as a live v2 head. The durable adapter reports
`E_CONFIDENTIAL_PLACEMENT_MIGRATION_REPROOF_REQUIRED` until a v1 head receives a
fresh 256-bit rotated-epoch context and three new context-bound receipts.
The generated 2 MiB document, 4,096-transition head walk, 128 high-waters per
shard, and 384 total high-water caps fail closed without pruning. Depending on the
validation boundary, an overflow reports `E_CONFIDENTIAL_PLACEMENT_LIMIT`,
`E_CONFIDENTIAL_PLACEMENT_HISTORY_LIMIT`, or, for an oversized encoded input,
`E_CONFIDENTIAL_PLACEMENT_FORMAT`. The v2 durable path uses predecessor-keyed
no-replace hard links rather than a mutable current pointer:
`E_CONFIDENTIAL_PLACEMENT_HEAD_STALE` rejects stale expected heads or losing
successors, `E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT` rejects a missing or mismatched
claimed intent, `E_CONFIDENTIAL_PLACEMENT_REPROOF_CONTEXT_FORK` rejects two
incompatible intents for one predecessor, `E_CONFIDENTIAL_PLACEMENT_TRANSITION` and
`E_CONFIDENTIAL_PLACEMENT_TRANSITION_BINDING` reject malformed or mismatched linked
successors, `E_CONFIDENTIAL_PLACEMENT_GENERATION_SEQUENCE` rejects a nonconsecutive
walk, `E_CONFIDENTIAL_PLACEMENT_IMMUTABLE_COLLISION` rejects different bytes at an
already claimed immutable path, and `E_CONFIDENTIAL_PLACEMENT_ROOT_FORK` rejects
simultaneous legacy and v2 roots. `E_CONFIDENTIAL_PLACEMENT_POINTER*` remains
legacy-v1 migration parsing only, not the current-head protocol.

The liveness layer uses local verifier errors: `E_PLACEMENT_LIVENESS_RUNTIME` and
`E_PLACEMENT_LIVENESS_PROFILE` for realm-integrity or generated-ceiling drift;
`E_PLACEMENT_LIVENESS_FORMAT` and `E_PLACEMENT_LIVENESS_LIMIT` for non-canonical,
accessor/Proxy/sparse-array, or oversized evidence;
`E_PLACEMENT_LIVENESS_IDENTITY`, `E_PLACEMENT_LIVENESS_SIGNATURE`, and
`E_PLACEMENT_LIVENESS_BINDING` for invalid roles, signatures, predecessor data, or
nonce/lease/workload/Merkle sampled-response binding;
`E_PLACEMENT_LIVENESS_POLICY`, `E_PLACEMENT_LIVENESS_WINDOW`, and
`E_PLACEMENT_LIVENESS_QUORUM` for an unsafe roster/response profile, a duration that
does not equal the provider-signed lease policy, or
under-threshold certificate; and `E_PLACEMENT_LIVENESS_EQUIVOCATION` for observer
double-sign evidence. The lineage composition maps any invalid, offer-roster-mismatched,
lease-consumer-mismatched, stale, forked, or late-proof-conflicting liveness input to
`E_LINEAGE_PLACEMENT_LIVENESS` and derives no repair plan. Auditable details include
`uncertified-repair-intent`, `policy-bound-authority-required`, `policy-fork`,
`offer-witness-roster-binding`, `lease-consumer-binding`,
`response-possession-binding`, and
`late-proof-conflict`; a stale supplied placement
predecessor fails as `stale-prior-generation`, while a historically valid but
superseded commit cannot derive a current plan and fails as
`superseded-generation-plan`. A successful derived plan
is public, forgeable JSON rather than a bearer capability; effect execution requires
fresh verification of the original committed and current evidence.

The placement-admission layer uses `E_PLACEMENT_ADMISSION_RUNTIME` and
`E_PLACEMENT_ADMISSION_PROFILE` for realm or generated-ceiling drift;
`E_PLACEMENT_ADMISSION_FORMAT` and `E_PLACEMENT_ADMISSION_LIMIT` for malformed,
noncanonical, shared, sparse, or oversized inputs; `E_PLACEMENT_ADMISSION_IDENTITY`,
`E_PLACEMENT_ADMISSION_SIGNATURE`, and `E_PLACEMENT_ADMISSION_BINDING` for invalid
roles, issuer/custodian signatures, lineage references, or evidence/epoch IDs;
`E_PLACEMENT_ADMISSION_LINEAGE` for a membership epoch not bound to the current or
authenticated historical Capsule descriptor; `E_PLACEMENT_ADMISSION_POLICY` for an
insufficient logically independent roster; `E_PLACEMENT_ADMISSION_QUORUM` for
insufficient custody approval; `E_PLACEMENT_ADMISSION_INTERSECTION` for unsafe
operator-root or failure-domain reconfiguration;
`E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE` for a skipped rotation, silent removal,
invalid revocation, cumulative-history rewrite, retired-authority resurrection, old
root-ID reuse, or issuer-key rollback; and `E_PLACEMENT_ADMISSION_TIME`
for invalid root/evidence/epoch validity. Lineage maps a missing, duplicated,
extraneous, or reference-mismatched epoch sidecar to
`E_LINEAGE_PLACEMENT_LIVENESS` and performs no repair effect.

The Lab process ceremony uses the internal `E_PLACEMENT_ADMISSION_SIGNER_*` family,
including `E_PLACEMENT_ADMISSION_SIGNER_EQUIVOCATION`, to reject realm drift,
malformed/oversized requests, an unconfigured role,
identity, root, or policy, missing private signing capability, and conflicting reuse
of one sign-once challenge slot. `E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT` additionally
rejects an explicit role-specific origin/key binding that differs from the signer's
configured advertised origin before private-key use. The operator-facing adapter uses
`E_PLACEMENT_ADMISSION_SIGNER_HTTP_*` and `E_PLACEMENT_ADMISSION_SIGNER_CLI` for
authentication, route/content-type, concurrency, bounded-body, canonical-config,
listen-state, bounded native-TLS certificate/private-key input, secure-context
preflight, and runtime failures. An incomplete, oversized, malformed, or mismatched
TLS pair, missing possession-only token, or reuse of the admission bearer as that token
rejects before absent durable authority creation. The same signer families reject a
malformed, oversized, wrong-role/key/origin, or conflicting TLS-exporter possession
challenge/proof. These operational errors are not portable admission
evidence or additional protocol authority; final evidence still verifies through the
stable placement-admission codes above.

The private-key-free HTTP coordinator uses the internal
`E_PLACEMENT_ADMISSION_CEREMONY_*` family for malformed or oversized bundles,
challenge/origin/key binding mismatches, wrong endpoint role or identity, invalid
authorization syntax, remote plaintext origins, redirect/network/status failure,
stream/time limits, runtime drift, and no-replace CLI publication failure. These
errors describe an operational observation attempt. They are not portable membership
rejections and do not make the coordinator, bearer token, endpoint origin, or bundle
self-hash an admission authority.

The fresh HTTPS observer uses the internal
`E_PLACEMENT_ADMISSION_DEPLOYMENT_*` family. `FORMAT`, `LIMIT`, and `RUNTIME`
reject malformed, shared, noncanonical, oversized, or realm-drifted inputs;
`BINDING` and `IDENTITY` reject non-HTTPS signed origins, bundle mismatches, a live
role/key mismatch, observer nonce/time/origin mismatch, TLS-exporter mismatch, invalid
role-key possession signature, replayed proof, or derived-fact tampering; `TLS`, `HTTP`, `NETWORK`, and `TIMEOUT`
reject a failed platform-trust-store handshake, status/content-type failure, transport
failure, or bounded deadline. The CLI additionally uses `CLI_USAGE`, `CLI_FORMAT`,
`CLI_LIMIT`, `CLI_OUTPUT_EXISTS`, `CLI_COLLISION`, and `CLI_FAILURE` for argument,
file, possession-token environment, explicit legacy-mode, and no-replace publication
failures. Missing proof authorization never silently selects legacy `/1`. These codes describe a non-authoritative
observer-local transcript and never promote endpoint, administrator, or failure-domain
independence.

Deployment plan, acceptance, activation `/1`, membership binding `/2`, attestation `/5`, and the deterministic
observer view reuse the same internal family. They additionally reject an invalid
observer identity/signature; a plan, acceptance, activation, observation, or attestation
ID mismatch; a noncanonical plan/activation/membership roster; a mixed ceremony, epoch,
membership, plan, or activation;
a missing assigned observer; duplicate observer, acceptance, nonce, observation, or
declared vantage; a wrong observer assignment, nonce, or bounded logical window; an
unadmitted/partial/extra observer roster; a ceremony subject absent from the epoch; a
wrong current Capsule; a supplied membership candidate view with a missing prior or
current epoch, sibling fork, cycle, unsafe root history/reconfiguration, extraneous
candidate, selected-epoch mismatch, candidate-ID reorder, or candidate-view mismatch;
an assignment whose identity/operator/failure-domain
does not match its admitted member; an observer root/domain alias or subject overlap; an
incomplete complete-plan roster/acceptance set; count outside `2..8`; and accessor/
shared/sparse or oversized input. The durable authority separately emits
`E_CONTINUITY_EQUIVOCATION` if one observer key is asked to accept a second plan for
the same ceremony-scoped sign-once tuple, or to sign a different membership view,
observation, or attestation instant through the same plan-scoped attestation tuple.
Exact retries remain idempotent; ceremony-scoped plan acceptance means epoch rotation
requires a fresh ceremony and accepted plan. Attestation-view `/1` additionally rejects
a malformed or self-hash-mismatched manifest, noncanonical/duplicate/unordered roster
IDs, and any missing, extra, reordered, or substituted attestation sidecar that fails to
recreate the exact manifest. Restore alone is not a sidecar-verification result. CLI codes also cover public identity/plan/
acceptance/activation input, path aliasing, and no-replace publication; an existing
public-identity output rejects before a new local authority is created. These failures
mean that precommitted selection, exact same-roster plan agreement, supplied-view
membership convergence, configured-policy membership, observer attribution, or comparison could not be verified. A valid binding
does admit the exact roster under its configured custody/issuer policy; it never turns
locally supplied times or declared administration/failure-domain/vantage IDs into trusted
clock, hidden-candidate completeness, issuer-honesty, Sybil, or physical-topology authority.

The internal single-shard effect executor uses `E_PLACEMENT_REPAIR_RUNTIME` for
realm drift, `E_PLACEMENT_REPAIR_FORMAT` for malformed options/bytes,
`E_PLACEMENT_REPAIR_CAPABILITY` for a missing private provider method,
`E_PLACEMENT_REPAIR_BINDING` for a provider result that does not prove the exact
replacement lease/provider/workload/shard, `E_PLACEMENT_REPAIR_SLOT_CLAIMED` when a
different replacement has already won the failure slot, and
`E_PLACEMENT_REPAIR_IMMUTABLE_COLLISION` for non-identical bytes at an immutable
effect/result path. Invalid, contested, already-repaired, stale, or superseded
lineage evidence fails in the lineage verifier before provider invocation.
`E_PLACEMENT_REPAIR_COMPLETION_CLAIMED` means another canonical successor candidate
already owns the same prior-commit/effect-result/next-generation completion slot;
the Continuity capability is not called for the losing candidate.
The internal multi-action batch uses the same family. A missing, duplicate, or extra
shard action is `E_PLACEMENT_REPAIR_FORMAT` or `E_PLACEMENT_REPAIR_BINDING`; a late
response is rejected by lineage liveness before the next provider or Continuity call;
and `E_PLACEMENT_REPAIR_COMPLETION_CLAIMED` also covers a different canonical all-
result successor for the same batch slot.

The durable provider-domain adapter uses `E_PLACEMENT_PROVIDER_SESSION_RUNTIME` for
realm drift, `E_PLACEMENT_PROVIDER_SESSION_FORMAT` for malformed options, canonical
requests, stored results, or provider placements, and
`E_PLACEMENT_PROVIDER_SESSION_LIMIT` for bounded placement-evidence arrays.
`E_PLACEMENT_PROVIDER_SESSION_CAPABILITY` means the private provider method was not an
ordinary owned data capability. `E_PLACEMENT_PROVIDER_SESSION_BINDING` means the
canonical effect ID, request, idempotency key, or stored result do not bind the same
operation. `E_PLACEMENT_PROVIDER_SESSION_CLAIMED` means the existing no-replace claim
already owns first execution for the exact request and no canonical result is yet
available; a conforming loser does not invoke the provider. A malformed claim or one
bound to a different request is `E_PLACEMENT_PROVIDER_SESSION_FORMAT` or
`E_PLACEMENT_PROVIDER_SESSION_BINDING`, and
`E_PLACEMENT_PROVIDER_SESSION_IMMUTABLE_COLLISION` means a request/result path already
contains different bytes. `E_PLACEMENT_PROVIDER_SESSION_CLAIMED` has no timeout or
automatic takeover meaning. `E_PLACEMENT_PROVIDER_SESSION_RECOVERY` means an import
was attempted without the exact previously published request and no-replace claim.
The recovery path accepts no provider execution capability; the outer executor must
first verify an exact signed placement result. Without that proof, an unresolved
winner remains unavailable.

The durable Continuity-domain adapter uses
`E_PLACEMENT_CONTINUITY_SESSION_RUNTIME` for realm drift and
`E_PLACEMENT_CONTINUITY_SESSION_FORMAT` for malformed options, canonical requests,
claims, stored results, or returned Capsule/commit bytes.
`E_PLACEMENT_CONTINUITY_SESSION_CAPABILITY` means the private
`commitPlacementGeneration` method was not an ordinary owned data capability.
`E_PLACEMENT_CONTINUITY_SESSION_BINDING` means a stored claim or result does not bind
the exact request and completion idempotency key.
`E_PLACEMENT_CONTINUITY_SESSION_CLAIMED` means another process owns first Continuity
execution for the exact request and no canonical result is yet available; a conforming
loser performs zero Continuity calls. It has no timeout or automatic takeover meaning.
`E_PLACEMENT_CONTINUITY_SESSION_IMMUTABLE_COLLISION` means an immutable request or
result path already contains different bytes. A completed matching result is restored
instead of calling Continuity again. `E_PLACEMENT_CONTINUITY_SESSION_RECOVERY` means
an import was attempted without the exact previously published request and claim.
The recovery path accepts no Continuity signing capability; the outer executor must
first verify the exact successor Capsule/commit. Without those authoritative bytes,
an unresolved winner remains unavailable.

The internal transport-backed evidence session uses
`E_PLACEMENT_NETWORK_EVIDENCE_RUNTIME` for realm drift,
`E_PLACEMENT_NETWORK_EVIDENCE_CAPABILITY` for a missing private baseline/range
method, `E_PLACEMENT_NETWORK_EVIDENCE_FORMAT` for malformed frames or owned bytes,
`E_PLACEMENT_NETWORK_EVIDENCE_ORDER` for a non-monotonic transcript, and
`E_PLACEMENT_NETWORK_EVIDENCE_LIMIT` for range or response ceilings. Passing this
adapter does not authenticate a response: only the downstream lineage/liveness
verifier can turn exact payload bytes into an `alive`, `failed`, or `contested`
verdict.

- Malformed JSON with forged signatures returns `E_PARSE_INVALID_JSON` before any cryptographic result.
- An invalid-UTF-8 envelope with an oversized payload returns envelope `E_PARSE_INVALID_UTF8`; payload acquisition cannot overtake envelope parsing.
- If a schema engine reports several faults, unknown fields take precedence, then wrong top-level kind, then the lexicographically first normalized JSON-Pointer/keyword pair by unsigned UTF-16 code units; engine error enumeration order is ignored.
- A canonical, correctly sized low-order public key with a mismatched key ID returns `E_PUBLIC_KEY_INVALID_POINT` before `E_PEER_ID_MISMATCH`.
- A structurally valid Pulse with the wrong organism ID and insufficient signatures returns `E_ORGANISM_ID_MISMATCH` first.
- A validly signed heartbeat that changes state returns `E_HEARTBEAT_STATE_CHANGED` before quorum acceptance can make it valid.
- A complete handoff whose valid evidence cannot activate the next threshold returns `E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT` after acceptance checks.
- A cloned accepted parent returns `E_PARENT_REQUIRED`; acceptance-shaped fields do not create a capability.
- A second valid sibling produces `E_FORK_DETECTED` only after it passes every intrinsic transition check.
