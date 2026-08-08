# P2P storage placement and repair

Status: **LOCAL CANDIDATE PASS — CONFIDENTIAL CONTROLLER COMPOSED; GOVERNED MERGE AND PHYSICAL TOPOLOGY HOLD**

Last synchronized: **2026-08-09 KST**

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

These states are local scheduling policy, not global consensus and not a new signed
receipt family.

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
  HTTP, WebSocket, STUN, TURN, or server fallback.

`resource-placement-artifact` is an untrusted carrier for the existing documents
and proposals. Receiving it never means “accepted” or “proved”; the core must parse
and verify the nested canonical bytes again.

## Executable evidence

| Gate | Command | What it proves |
| --- | --- | --- |
| Pure policy and negatives | `node --test test/placement.test.mjs` | 3-copy proof, 3→2 degradation, new-lease repair, single/duplicate/corrupt/cross-lease/stale/unproved/wrong-workload rejection |
| Node process topology | `node --test test/placement-process.test.mjs` | Provider process directly stores and signs; process exit prevents later signing; replacement process/new lease repairs |
| Transport contract | `node --test test/webrtc-transport.test.mjs` | Canonical signaling, artifact bounds, no Node fallback, owned publish bytes |
| Actual browser vertical | `node scripts/verify-p2p-placement-chromium.mjs` | Runtime file and all evidence over direct peers, origin cut, provider loss/repair, A exit, B 2-of-3 readback with one corrupt copy |
| Confidential controller | `node --test test/confidential-placement.test.mjs` | S4 2-of-3 shards, exact freshness boundary, crash/restart journal, chained re-proof, 100-cycle policy corpus |
| Confidential browser vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual native File encrypted for B, distinct ciphertext shards over peers, provider loss, A exit, B-owned new leases, corrupt-shard rejection, exact decrypt |
| Combined gate | `npm run test:p2p-placement` | All of the above |
| Package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed import of `@mortal-os/core/placement` |
| Complete repository regression | `npm test` | Final exact-source ordered candidate suite PASS in 3,101.1 seconds after append-only generation-pointer hardening and pointer-to-journal generation binding, including both P2P Chromium verticals and every existing stage verifier |

## Explicit nonclaims

- Manual same-host ICE is not proof of arbitrary Internet or NAT reachability.
- Browser and Node processes on one PC are not independent hardware, account,
  credential, administrator, region, or failure domains.
- A fresh receipt proves possession at its challenge time. The bounded local age
  policy excludes old evidence but is not continuous monitoring or global truth.
- `unavailable_provider_ids` is a local observation input, not signed global truth.
- The historical regression vertical still transfers plaintext; the composed
  confidential vertical sends providers only S4 package shards. See
  [Confidential P2P placement controller](CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md).
- The ephemeral Lab signer proves process-local signing and redaction, not
  same-origin XSS resistance or hardware-backed custody.
- No candidate result is merged, deployed, or promoted until exact-head and
  exact-main governance gates pass.
