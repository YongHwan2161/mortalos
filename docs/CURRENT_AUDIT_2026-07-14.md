# MortalOS Current Deep Audit — 2026-07-14

Scope: complete source, test, protocol, plan, provenance, licensing, CI, and live Devpost-state review after the first H1/H2 implementation.

## 1. Verdict

The cryptographic transition rules were substantially implemented, but the previous “H1 verified” claim was too broad. Two protocol-level promises were missing from the executable trust boundary:

1. `validatePulse` accepted ordinary objects whose fields merely resembled an accepted Genesis or parent. A `structuredClone` of a result retained no proof of validation but was still trusted.
2. No stateful accepted-object graph existed, so the reference code could not enforce its own replay/fork rules.

The audit reopened the core gate, reproduced the flaw, and repaired it. The current Node reference now has an immutable capability boundary and a stateful lineage registry. The H2 trace was upgraded to consume that boundary.

The project is materially stronger, but the next hard blocker is **portability**, not WebRTC: Node-specific crypto, `Buffer`, `node:module`, JSON loading, and filesystem fixtures prevent the trusted core from running directly in the planned browser Lab.

## 2. Reproduced critical defect

Before remediation, this sequence returned `accept`:

```text
validate Genesis and Pulse
  -> structuredClone both accepted result objects
  -> pass the clones as Genesis/parent context
  -> validate the signed child
  -> ACCEPT
```

Both original objects were mutable and no unforgeable validation provenance existed. This violated the stated rule that a Pulse requires a *validated* Genesis and parent.

Severity: **Critical** for API consumers. Cryptographic signatures were still checked, but recognition of the parent context was delegated to caller-controlled fields.

## 3. Remediation implemented

| Finding | Remediation | Executable evidence |
|---|---|---|
| Cloneable/fabricable acceptance context | Accepted results are recursively frozen and registered in a module-private `WeakSet`; clones and hand-built objects fail. | Validator tests cover forged Genesis and parent clones. |
| No ancestry owner | Added `createLineage`, which owns validated nodes and resolves parents by committed `parent_hash`. | Lineage ancestry test. |
| Exact replay not detected | Existing object hash returns `E_REPLAY_STALE`. | H2 trace and lineage test. |
| Fork promise was documentation-only | A second valid sibling is retained as evidence, yields `E_FORK_DETECTED`, and sets local state to `FORKED`. | Runtime-generated Ed25519 fork fixture. |
| Sign-once violation was invisible | Fork output includes sorted `equivocating_key_ids` from quorum-signature intersection. | Generated fork fixture expects both shared signers. |
| Progress after fork was ambiguous | Further automatic append returns `E_LINEAGE_ALREADY_FORKED`. | Third valid sibling test. |
| Latent successor was an asserted integer | Mortality evaluator now accepts only validated direct children of the trusted head and deduplicates by object hash. | Mortality tests reject cloned latent evidence. |
| Accepted result could be mutated after validation | Results and nested descriptors are recursively frozen. | Immutability assertions. |
| No-op membership event expanded ambiguity | `membership-change` must change custody or quorum; otherwise `E_MEMBERSHIP_CUSTODY_UNCHANGED`. | Validator negative test. |
| Error vocabulary drift | Added one executable rejection-code manifest and made the P0 gate require exact documentation equality. | `npm run verify:p0`. |
| JCS test was too narrow | Added the RFC 8785 primitive/number and UTF-16 property-order examples. | Codec conformance test. |
| Unbounded JSON could exhaust memory or recursion | Added fixed envelope/payload byte ceilings and a 64-container depth limit with stable failure. | Codec and validator limit tests. |
| Runtime support claim was inaccurate | Raised the documented engine to Node 22.5, matching the coverage include functionality used by CI. | `package.json`, lockfile, README. |
| Local-only uploads entered `npm pack` | Kept the package private and added explicit Git/npm exclusions for upload and tool-local directories. | `npm pack --dry-run` contains no `upload/`, `.agents/`, or `.codex/` artifacts. |

## 4. Documentation review

The following stale material was removed:

- the first deep review, which still said the semantic validator, license, and real Ed25519 vectors did not exist; and
- the old H1/H2 report, whose coverage numbers, trace digest, replay claims, and “no fork store” limitation no longer matched the code.

The implementation plan was rewritten around two paths:

- Build Week: portable core → browser Lab → GPT-5.6 → evidence freeze;
- research: authority lineage → deterministic state-bearing kernel → availability/recovery → browser network → resource organs → ownerless model organ.

Historical P0 material is retained only as an explicitly labeled gate record.

## 5. Current local evidence

| Gate | Result |
|---|---|
| License text/metadata | PASS |
| P0 schema/document/rejection-manifest consistency | PASS |
| Standards and protocol conformance | 22/22 PASS |
| Fixed-seed adversarial continuations | 10,000/10,000 rejected without accepted-state mutation |
| Trusted-core aggregate line coverage | 98.40% |
| Trusted-core aggregate branch coverage | 91.51% |
| Trusted-core aggregate function coverage | 100.00% |
| H2 trace v2 | PASS |
| H2 trace SHA-256 | `1393d92d0d42dea697551c67458d52c59f92ee1067d6dedb1c21225c977ab606` |
| Fresh-process trace identity | PASS |
| Clean-room locked install and full suite | PASS |
| Dependency audit at moderate threshold | 0 vulnerabilities |
| Package dry-run local-artifact exclusion | PASS |
| Common private-key/token pattern scan | PASS (0 matches) |
| GitHub remote blob readback | 44/44 match; 0 mismatches |
| GitHub Actions | `Verify` run 15, commit `9c5f0b76d9d7e00549677145950b329b445e93d9`, success |

The standards tests are grounded in [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) and [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032). The JCS test now includes the RFC's number and UTF-16 sort examples, not only project-shaped ASCII objects.

## 6. Remaining high-risk gaps

### 6.1 One implementation, one JavaScript runtime family

The Node reference is deterministic in repeated processes, but this is not independent implementation agreement. A language-independent byte corpus and Chromium differential runner are required next.

### 6.2 Process-local acceptance capability

The `WeakSet` capability is intentionally not serializable. After restart, applications must replay canonical Genesis and Pulse bytes through `createLineage`. A future persistent store must persist raw evidence and rebuild recognition; it must never deserialize “accepted: true”.

### 6.3 No Byzantine fork resolution

The registry detects and freezes on valid siblings. It does not choose a winner. Strict-majority quorum guarantees signer intersection, but a Byzantine intersecting signer can still create the fork.

### 6.4 Mortality is still conditional

The latent-successor input is now cryptographically grounded, but `usableKeyIds`, `stateAvailable`, and `authorityLossIrreversible` remain observer-supplied assumptions. Open networks cannot prove that a malicious custodian erased every key copy or hid no signed artifact.

### 6.5 No state-bearing life

`state_root` does not change in v0. The current project proves authority lineage, not an executing OS. The next fundamental protocol must define a deterministic transition function and reconstructable content-addressed state.

### 6.6 No browser product or GPT runtime

Live Devpost readback at `2026-07-14T10:06:54Z` still shows an empty description, missing video, inaccurate disappearance/death tagline, and `submission_draft`. Build Week also requires an actual GPT-5.6 path and a no-rebuild way for judges to test a developer tool.

### 6.7 Public metadata still overclaims the implementation

The GitHub repository description still calls MortalOS a hostless browser network OS, while the implemented system is a Node reference protocol core. The Devpost tagline likewise equates network disappearance with death. Both public metadata fields must be corrected before H5; changing README prose alone is insufficient.

## 7. Concrete insights

1. **Validation results are capabilities, not DTOs.** A field named `status: accept` cannot be allowed to carry protocol authority across a trust boundary.
2. **Transition validity and lineage recognition are separate layers.** A child may be intrinsically valid against a parent while the local recognized lineage must still reject replay or halt on a fork.
3. **Quorum intersection turns a fork into accountable evidence.** With strict majority, two valid siblings necessarily share at least one approver; exposing that intersection is more useful than a generic fork flag.
4. **Death requires evidence accounting, not a counter.** A latent successor must be the actual validated direct child whose durable evidence survives—not a caller's assertion that one exists.
5. **Browser portability is now on the trusted path.** Building UI before a shared portable core would create two validators and reopen consensus ambiguity.
6. **The deepest missing organ is state transition.** Networking and compute sharing do not create data life if the protocol cannot say what the next logical state is.

## 8. Decision

- C0 trusted Node reference core: **PASS after reopening and remediation**.
- C1 portable deterministic core: **next implementation gate**.
- R2 deterministic state-bearing life kernel: **next fundamental research gate**.
- Devpost submission readiness: **FAIL until H3–H5 close**.
