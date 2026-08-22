# P2P storage placement and repair

Status: **CURRENT SOURCE/RUNTIME/TEST COMPLETE-SUITE PASS; POST-RUN DOCS STATIC PASS; EXACT-SHA PENDING; PHYSICAL TOPOLOGY HOLD**

Last synchronized: **2026-08-21 KST**

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
- one combined inbound/outbound transcript per peer, bounded by the generated 512
  unique canonical-message and 8,388,608 decoded raw-byte ceilings. Duplicates are
  idempotent and consume neither limit;
- outbound capacity rejects before native send and commits transcript/dedupe only
  after send succeeds. Inbound overflow commits no transcript/dedupe entry or
  subscriber delivery before fail-close cleanup clears subscriptions;
- one private `Map` is the ordered transcript and duplicate SSOT. Captured
  `Map`/`Set`/`Array`/iterator/scheduler operations plus native DataChannel and
  RTCPeerConnection slots prevent later public-prototype or method replacement from
  fabricating the named publication, range, replay, signaling, or close behaviors;
- the transitive relay artifact-kind allowlist invokes captured Set membership. A
  selective poison cannot admit `verdict`: send/local/remote/subscriber
  visibility stays zero, while an allowed `challenge` still crosses both peers once;
- local close, remote DataChannel close, peer close, error, and repeated close use one
  idempotent shutdown. The still-live channel/peer native close capability executes
  at most once, and a remote channel close cannot strand the peer connection.

`VirtualTransportNetwork` enforces the same exact unique-message and decoded raw-byte
ceilings. The relay edge uses a conservative base64 decoded-size estimate and may
reject slightly earlier; this source claims the common upper ceiling and fail-closed
behavior, not byte-identical byte accounting across all three carriers.

`resource-placement-artifact` is an untrusted carrier for the existing documents
and proposals. Receiving it never means “accepted” or “proved”; the core must parse
and verify the nested canonical bytes again.

## Executable evidence

| Gate | Command | What it proves |
| --- | --- | --- |
| Pure policy and negatives | `node --test test/placement.test.mjs` | 3-copy proof, 3→2 degradation, new-lease repair, single/duplicate/corrupt/cross-lease/stale/unproved/wrong-workload rejection |
| Node process topology | `node --test test/placement-process.test.mjs` | Provider process directly stores and signs; process exit prevents later signing; replacement process/new lease repairs |
| Transport contract | `node --test test/transport.test.mjs test/webrtc-transport.test.mjs` | `24/24` focused Node cases in `31,241ms`: canonical signaling, artifact bounds, no Node fallback, owned publish bytes, detached immutable frames, failure-atomic send/retry, literal exact/count-plus-one and exact-byte/byte-plus-one boundaries, combined-direction budget, duplicate non-consumption, inbound overflow with no transcript/dedupe commit or delivery before terminal cleanup, at-most-once native close capability use, hostile `Error` constructor/`Symbol.hasInstance`, and the isolated artifact-kind/constructor/Map/Set/Array/iterator/scheduler/channel poison corpus |
| Actual browser vertical | `node scripts/verify-p2p-placement-chromium.mjs` | PASS in `50,086ms`: actual paired Chromium DataChannels keep forbidden verdict local/remote ranges and subscriber visibility at zero, exercise literal outbound/inbound 512-message and 8,388,608-byte ceilings plus remote-channel cleanup that closes the still-live peer once, deliver challenge sequence 1, preserve the other named native send/peer/transcript/replay/range/scheduler behaviors, then pass the runtime-file/evidence origin-cut provider-loss/repair and A-exit/B-readback vertical |
| Confidential controller | `node --test test/confidential-placement.test.mjs test/confidential-journal-v2.test.mjs` | S4 2-of-3 shards; one generation instant for contract status and proof age; historical-time expiry and effective-revocation rejection; exact freshness boundary; crash/restart journal; chained re-proof; four bounded policy cases; and an exact-ceiling path with 128 signed transitions, 381 genuine provider replacements, generation 129, 384 provider/lease/chain high-waters (`128/128/128`), 387 receipts, plus a proved signed generation-130 `3/3` candidate whose one-new-chain commit fails closed without changing bytes |
| Liveness contract | `node --test test/placement-liveness.test.mjs` | Provider-signed exact offer/lease-bound policy and consumer policy-bound challenge; 3-of-4 `/2` certificate; 1ms/window/field/policy-ID tamper rejection; policy/challenge/response forks halt; legacy `/1` compatibility is non-authoritative for lineage |
| Lineage controller | `node --test test/lineage-placement.test.mjs` | Certificate-bound current-descriptor quorum-authorized generation commit; conditional late-proof conflict when fresh response/current placement evidence is supplied; derived placement action plan; A→B key non-transfer; fresh-process convergence; 1,000 partition/heal events; valid sibling fork halt |
| Confidential browser vertical | `node scripts/verify-confidential-placement-chromium.mjs` | Actual native File encrypted for B, distinct ciphertext shards and liveness challenge over peers, four observer processes and 3-of-4 local-duration certificate, provider loss, A generation commit, sign-once handoff, A exit, successor-authorized operational signer repair and successor commit, then 127 cycles from generation 2 to the exact generation-129/384-chain ceiling with actual browser-held non-extractable provider keys, browser storage results/signatures, current-context receipts, and exact successor chains. A browser-signed generation-130 `3/3` candidate proves before plus-one rejection; exact bytes remain unchanged and oldest replay rejects after reload. The portable journal controller remains Node-orchestrated; this is not independently in-browser journal-kernel parity. Deterministic convergence, corrupt-shard rejection, exact decrypt; the signer is not custody-identity-bound |
| Combined gate | `npm run test:p2p-placement` | The containing revision must pass the current Node suite and both current Chromium verticals; historical 17-case results predate the stateful corpus and do not transfer; exact-SHA CI is the publication authority |
| Package boundary | `node scripts/verify-sdk-package.mjs` | Clean packed import of `@mortal-os/core/placement` |
| Complete repository regression | `npm test` | Current source/runtime/test PASS from `2026-08-21T15:08:09.9777152+09:00` through `2026-08-21T17:12:46.1993423+09:00`, exit `0`, wall `7,476,222ms`, through final `verify:s4`. Post-run evidence docs have separate static gates; exact-SHA CI remains the publication authority. |

## Explicit nonclaims

- Manual same-host ICE is not proof of arbitrary Internet or NAT reachability.
- A synchronous native `RTCDataChannel.send()` success means the browser accepted
  bytes into its outbound queue. It is not a peer acknowledgement or durable
  end-to-end delivery receipt; higher layers still require canonical receipts and
  replay/reconciliation.
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
  fresh response and current placement evidence. The single-shard Lab/browser
  executor supplies both immediately before effect. The internal Node batch re-reads
  a private bounded transcript-range session between actions. The Chromium Lab now
  supplies that range from an actual connected DataChannel after origin cut; duplicate
  frames and rewrapped identical response payloads remain non-authoritative/deduplicated,
  while late proof or disconnect stops all later provider/Continuity calls.
- Rolling source documentation does not self-promote its containing revision.
  Exact-head and exact-main review, CI, merge, deployment, and promotion facts live
  in immutable external records bound to a commit SHA.

The lease-bound policy/window, provider-only sampled response `/2`, one-shard
effect/completion, provider-domain sequential restart recovery, and internal multi-
action fresh-evidence batch slices are implemented. No-replace claims exclude cross-
process first provider and Continuity execution. Proof-import recovery fills an
unresolved result only after exact signed-result verification, with no provider/signing
capability and no duplicate call; missing proof remains fail-closed. The bounded
signed-evidence schedule corpus is focused PASS across Node, fresh process, and bundled
Chromium, anchored by actual executor/DataChannel cases. Lineage-governed logical
admission and its origin-locked durable signer/replay runner are focused PASS on loopback;
A fresh HTTPS observer also binds live identities to the signed origins and records
TLS/socket facts without claiming authority or independence. A durable observer key
can attest those exact bytes only after the combined process completes its probe, while
the deterministic view keeps all declared topology IDs non-authoritative. Externally
administered issuers plus at least two separately controlled observer keys and measured
multi-host failure-domain evidence using that exact contract remain the next root P0;
signed self-declarations must not count as independent domains.
