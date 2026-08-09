# P2P storage placement and repair

Status: **SOURCE + LOCAL EVIDENCE PASS — EXACT-SHA PROMOTION EXTERNAL; PHYSICAL TOPOLOGY HOLD**

Last synchronized: **2026-08-10 KST**

## Contract

`evaluateStoragePlacements` is an authority-free local policy evaluator. It accepts
canonical public offer, lease, witness-announcement, usage, revocation, and execution
receipt bytes. A record counts only when the existing resource validator proves an
active lease and an exact storage execution chain for the requested workload ID.

The evaluator derives provider identity from the signed offer. Caller labels do not
count. Two records with the same provider identity are both excluded so a provider
cannot inflate failure-domain count. A locally observed unavailable provider is
excluded from current scheduling without invalidating its historical receipt.

Aggregate states are:

- `proved`: verified available copies meet the target;
- `repairing`: verified available copies meet recovery quorum but not the target;
- `unavailable`: verified available copies are below recovery quorum.

These lower-level states remain local scheduling policy. The lineage controller may
derive its unavailable set only from the separate signed liveness certificate
contract; raw local state is never lineage repair authority.

Malformed evaluator requests fail before any copy can count: `E_PLACEMENT_FORMAT`
for a wrong exact shape, `E_PLACEMENT_LIMIT` for a bounded-list overflow,
`E_PLACEMENT_WORKLOAD` for an invalid expected workload ID, and
`E_PLACEMENT_POLICY` for an unsafe quorum/target pair. Invalid signed evidence in a
well-formed request is returned as a rejected placement with its underlying resource
reason when available. These local SDK errors are deliberately outside the normative
lineage rejection-code registry.

## Direct transport

`ManualWebRtcParticipantTransport` uses:

- canonical bounded manual offer/answer documents;
- `RTCPeerConnection({ iceServers: [] })`;
- one ordered binary `mortalos-participant-v1` DataChannel;
- canonical relay messages and chunk fragments as the carried byte contract;
- bounded buffering, exact message digests, duplicate suppression, and no implicit
  HTTP, WebSocket, STUN, TURN, or server fallback;
- send-before-local-commit publication: a synchronous DataChannel failure creates no
  range, subscriber, or dedupe visibility, and the same message remains retryable.

`resource-placement-artifact` is an untrusted carrier for the existing documents
and proposals. Receiving it never means “accepted” or “proved”; the core must parse
and verify the nested canonical bytes again.

## Executable evidence

| Gate | Command | What it proves |
| --- | --- | --- |
| Pure policy and negatives | `node --test test/placement.test.mjs` | 3-copy proof, 3→2 degradation, new-lease repair, single/duplicate/corrupt/cross-lease/stale/unproved/wrong-workload rejection |
| Node process topology | `node --test test/placement-process.test.mjs` | Provider process directly stores and signs; process exit prevents later signing; replacement process/new lease repairs |
| Transport contract | `node --test test/webrtc-transport.test.mjs` | Canonical signaling, artifact bounds, no Node fallback, owned publish bytes, detached immutable frames, and failure-atomic send/retry |
| Actual browser vertical | `node scripts/verify-p2p-placement-chromium.mjs` | Runtime file and all evidence over direct peers, origin cut, provider loss/repair, A exit, B 2-of-3 readback with one corrupt copy |
| Confidential controller | `node --test test/confidential-placement.test.mjs` | S4 2-of-3 shards, exact freshness boundary, crash/restart journal, chained re-proof, 100-cycle policy corpus |
| Liveness contract | `node --test test/placement-liveness.test.mjs` | Offer-rostered 3-of-4 non-response certificate under a consumer-selected bounded window; no-clock schema; threshold/outsider/window negatives; late response, challenge fork, and response fork halt |
| Lineage controller | `node --test test/lineage-placement.test.mjs` | Certificate-bound current-descriptor quorum-authorized generation commit; conditional late-proof conflict when fresh response/current placement evidence is supplied; derived placement action plan; A→B key non-transfer; fresh-process convergence; 1,000 partition/heal events; valid sibling fork halt |
| Confidential browser vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual native File encrypted for B, distinct ciphertext shards and liveness challenge over peers, four observer processes and 3-of-4 local-duration certificate, provider loss, A generation commit, sign-once handoff, A exit, successor-authorized operational signer repair and successor commit, deterministic convergence, corrupt-shard rejection, exact decrypt; the signer is not custody-identity-bound |
| Combined gate | `npm run test:p2p-placement` | The pre-review baseline passed its then-current 17 Node cases and both Chromium verticals; exact-SHA CI is the current-revision authority |
| Package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed import of `@mortal-os/core/placement` |
| Complete repository regression | `npm test` | A pre-review source baseline completed in 4,263.6 seconds; exact-SHA CI is the current-revision authority |

## Explicit nonclaims

- Manual same-host ICE is not proof of arbitrary Internet or NAT reachability.
- Browser and Node processes on one PC are not independent hardware, account,
  credential, administrator, region, or failure domains.
- A fresh receipt proves possession at its challenge time. The bounded local age
  policy excludes old evidence but is not continuous monitoring or global truth.
- `unavailable_provider_ids` is a lower-level diagnostic input, not signed truth;
  the lineage API rejects it and derives repair only from a committed threshold
  certificate. See [Quorum liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).
- Threshold keys are not evidence of independent owners or failure domains.
- The historical regression vertical still transfers plaintext; the composed
  confidential vertical sends providers only S4 package shards. See
  [Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md).
- The ephemeral Lab signer proves process-local signing and redaction, not
  same-origin XSS resistance or hardware-backed custody.
- `deriveCommittedPlacementActionPlan` returns
  `mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
  `verified_placement_receipt_ids`, `non_capability: true`, and
  `requires_executor_reverification: true`. It is deterministic public, forgeable
  JSON, not authority. An effect executor must reverify the original Capsule,
  generation, commit, and current placement/liveness evidence.
- The core conditionally detects late-proof conflicts only when the caller supplies
  fresh response and current placement evidence. The current Lab/browser harness
  supplies empty late-response/current-placement arrays and has no network gossip
  plus execution-time reconciliation loop.
- Rolling source documentation does not self-promote its containing revision.
  Exact-head and exact-main review, CI, merge, deployment, and promotion facts live
  in immutable external records bound to a commit SHA.

The next root P0 is failure-precommitted liveness policy plus independent provider
response and effect-time exactly-once repair reconciliation. Lineage-governed
admission/failure-domain accounting with explicit trust roots follows; self-asserted
topology labels must not count as independent domains.
