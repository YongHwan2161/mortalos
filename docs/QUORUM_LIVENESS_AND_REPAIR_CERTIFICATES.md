# Quorum-observed liveness and repair certificates

Status: **PREDECESSOR SOURCE/RUNTIME/TEST COMPLETE-SUITE PASS; CURRENT REPAIR-HARDENING FOCUSED PASS AND COMPLETE-SUITE RERUN PENDING; EXACT-SHA EXTERNAL; EXTERNAL ISSUER HONESTY/INDEPENDENCE HOLD**

Last synchronized: **2026-08-21 KST**

## Purpose

A possession receipt proves that one provider answered one challenge. A lineage
commit proves which custodian authorized one generation. Neither makes one
controller's private timeout a network-wide failure fact.

This layer turns provider non-response into bounded, signed evidence without a
global wall clock. It does not claim to solve asynchronous failure detection in the
absolute sense. It defines exactly which parties asserted that they observed no
response for the provider-signed policy window accepted by the consumer, then makes
every repair verifier replay that same transcript.

## Canonical documents

Seven canonical, domain-separated documents form the contract:

1. `mortalos-placement-liveness-policy/2` is signed by the exact offer provider
   before failure. It embeds and verifies the exact provider-signed offer and mutual
   lease, then binds their IDs, provider, consumer, lineage parent, manifest,
   workload, shard, next failure sequence, exact response window, response profile,
   and a compact reference to the custody-signed membership epoch: exact epoch ID,
   prior epoch ID, evaluation instant, and deterministic selection digest. Every
   repair verifier resolves that sidecar and rederives the roster. Policy `/1`
   remains compatibility-only for lineage repair. Repair-authoritative lineage also
   requires `storage-merkle-sample/1`; the former
   `execution-receipt-pointer/1` profile is compatibility-only.
2. `mortalos-placement-liveness-challenge/2` is signed by the verified lease
   consumer. It embeds the exact policy bytes and ID and adds only a 128-bit nonce
   plus the exact predecessor execution receipt. The consumer cannot select or
   rewrite the response window in this format.
3. `mortalos-placement-liveness-observation/1` is signed by one rostered observer.
   It binds the exact challenge ID, observer identity, `no-response` outcome, and
   the exact policy-declared observer-local wait duration.
4. `mortalos-placement-failure-certificate/2` embeds the full policy-bound challenge and a
   canonical observer-ordered threshold of valid observations. Duplicates do not
   count. `n >= 3f + 1`, `q <= n - f`, and `2q > n + f` are rechecked by every
   verifier.
5. `mortalos-placement-liveness-response/2` embeds the exact challenge bytes and is
   signed only by the challenged provider. It binds the exact provider, lease,
   storage workload/content root, challenge nonce, nonce-selected leaf bytes, and
   Merkle authentication path. Verification reuses the storage execution Merkle
   algorithm; no new usage or execution receipt and no post-challenge consumer
   signature is required.
6. `mortalos-placement-liveness-response/1` remains parseable as a signed execution
   receipt-ID pointer. It projects `independent_possession:false`, evaluates as
   `pointer-only`, and cannot satisfy lineage repair authority.
7. Legacy challenge and certificate `/1` documents remain parseable compatibility
   artifacts. Their verified projections set `repair_authority:false`; lineage
   generation rejects them as `policy-bound-authority-required`.

The policy-bound challenge contains no deadline, issue time, expiry time, UTC time, or clock
server reference. Ordering comes from the signed execution predecessor and next
sequence. Duration is a bounded observer-local claim. A signature proves who made
that claim; it cannot prove that a compromised observer's timer was honest.

## Provider consent and role boundary

The consumer may not invent a favorable observer quorum or response duration after
suspecting failure. The provider-signed policy derives its roster and `n/f/q` values
from the embedded verified offer and fixes one exact bounded duration. Provider,
lease consumer, and observer key identities remain disjoint. Two different valid
policy IDs for the same offer/lease/workload/shard/failure-sequence tuple halt as
`policy-fork`; neither becomes a repair winner.

This closes post-failure roster selection. It does not prove that the roster's keys
belong to independent people, devices, networks, administrators, or failure
domains. That is the next root trust problem.

## Generation and repair binding

`mortalos-lineage-placement-generation/1` no longer accepts raw unavailable-provider
IDs. It embeds canonical failure certificates, liveness responses, and their
re-derived cases. Every case must bind the generation's exact Continuity parent and
manifest plus one currently verified placement's provider, lease, workload, shard,
receipt predecessor, and sequence.

A failed case derives the only unavailable-provider input used by the lower-level
placement evaluator. Its repair intent carries the failure challenge and certificate
IDs. Only after the generation is committed into Continuity may the public surface
derive that repair plan. `deriveCommittedPlacementActionPlan` returns
`mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
`verified_placement_receipt_ids`, `non_capability: true`, and
`requires_executor_reverification: true`; it is public, forgeable JSON, not a
capability or authority token.

The core API supports conditional late-proof reconciliation when a caller supplies
newly observed liveness responses and corresponding current placement evidence. A
sampled response counts only after its embedded exact challenge, provider signature,
storage workload, nonce-selected leaf, and Merkle path verify against the policy-bound
lease/content root. A valid failure certificate plus a valid sampled response
for the same tuple returns `E_LINEAGE_PLACEMENT_LIVENESS: late-proof-conflict`; no
repair plan is selected. Different challenges or different valid sampled response
IDs for the same tuple also halt.

No verifier can react to evidence withheld from it. Implementations must therefore
deliver provider responses and perform reconciliation at the point of repair, not
cache an old derived plan indefinitely. The internal batch executor now revalidates
original Capsule/generation/commit plus current placement/liveness evidence before
every effect and completion, and the origin-cut Chromium gate feeds it an actual
connected DataChannel range. The ordinary public Lab helper still does not run an
autonomous background gossip/discovery service.

## Actual browser vertical

The Chromium acceptance uses no backend clock or outage oracle:

1. Provider 0 signs a policy over its exact offer/lease, roster, 5,000 ms window,
   and sampled-storage response profile; Consumer A accepts it by signing the
   policy-bound challenge.
2. The exact challenge crosses direct WebRTC DataChannels to provider 0 and four
   observer identities hosted in four other browser processes.
3. In the direct-response acceptance, provider 0 reads its browser-held stored bytes,
   derives the nonce-selected Merkle sample, and signs response `/2` without a fresh
   consumer receipt; response-only evaluates `alive`, while response plus certificate
   halts as contested.
4. In the failure path provider 0 exits. Each observer process completes the same
   5,000 ms local wait.
5. Three distinct rostered observers sign `no-response`; the threshold certificate
   is embedded in A's degraded generation.
6. Only A's verified committed generation qualifies derivation of the shard repair
   plan. A then performs sign-once
   controller handoff, exits, and B repairs and commits the linked successor without
   receiving A's private key.
7. Origin, HTTP, and relay request counts stay unchanged after the cut.

## Executable evidence

| Gate | Contract |
| --- | --- |
| `node --test test/placement-admission.test.mjs test/placement-admission-ceremony.test.mjs test/placement-admission-deployment-observer.test.mjs test/placement-admission-external-ceremony.test.mjs test/placement-admission-signer-service.test.mjs test/placement-admission-signer-session.test.mjs test/placement-liveness.test.mjs test/protocol-profile.test.mjs test/sdk.test.mjs` | The pre-attestation source epoch passed this combined group `31/31` in `33,492.5431ms`: policy-locked separate-process subject/issuer ceremony, configured-policy digest bound to the root, durable sign-once and signer-profile one-winner races, byte-identical restart, conflicting-origin restart rejection, private-key-free endpoint runner with signer-approved origin/key binding and offline token-free replay, fresh HTTPS identity/TLS/address observation without topology promotion, bounded HTTP/partial retry/no-replace output/post-import capability containment, pre-await request ownership and failed-slot retry, dual-signed evidence, challenge and request max/max+1, direct root rotation, explicit revocation, cumulative history, root/key rollback rejection, liveness `8/8`, fresh-process reproduction, profile, SDK, policy/window/quorum/fork/runtime containment. The changed deployment-observer file is separately reverified below; predecessor `4b0ff0d290626318f68e4479d4b35d586a936822` reaches final `verify:s4`, while the current repair-hardening successor complete-suite rerun remains pending. |
| `node --test test/placement-admission-deployment-observer.test.mjs` | Current focused `1/1` PASS in `109,399.7366ms` (`109,718.1904ms` runner): native observation `/2` requires same-connection TLS-exporter-bound role-key proofs and rejects captured-proof replay. Durable public identity export and no-replace plan/acceptance/activation `/1` remain deterministic. Membership binding `/2` commits a sorted candidate view and selected epoch, reruns current-Capsule convergence, and rejects missing prior/current, sibling, unsafe, cyclic, or extraneous views before checking exact ceremony subject evidence, complete admitted observer membership, identities/operator/failure-domain declarations, distinct roots/domains, and plan window. Attestation `/5` embeds the candidate-view ID plus exact transcript and uses one plan-scoped durable slot. The combined CLI publishes the exact observation journal before signer use; after both role signers stop, a fresh process with no possession tokens restores it and reproduces the byte-identical attestation. A new connection, changed instant, or third-epoch rotated view under the same plan halts, and retry after conflict remains exact. Attestation-view `/1` is a compact no-signature manifest: fresh-process no-replace creation and read-only verification are byte-deterministic, offline restore stays unverified, and self-rehashed ID substitution or one/missing/duplicate sidecars reject. Reordered candidates/acceptances/views converge; outsider roster, wrong Capsule, identity/fact/signature/key/plan/activation/membership tamper, nonce/window, accessor/shared/sparse/max+1, post-call mutation, failure output, and output reuse reject. Membership and convergence are supplied-view policy claims; hidden candidates, clock, issuer honesty, Sybil resistance, power-loss durability, and physical/admin independence remain unproven. |
| `node --test --test-name-pattern="current custodian commits a repair plan" test/lineage-placement.test.mjs` | Focused `1/1` PASS in `364,882.0793ms`: sampled-profile certificate authorizes the existing generation/commit/action-plan/successor path; response `/2` needs no new placement receipt and conflicts with the committed failure before repair; legacy `/1` certificate remains non-authority |
| `node --test test/transport.test.mjs test/webrtc-transport.test.mjs` | Focused Node `24/24` in `31,241ms`: challenge, observation, response, and certificate remain bounded untrusted artifact kinds; one combined 512-message/8,388,608-raw-byte transcript, duplicates, outbound/inbound atomicity, virtual byte ceiling, hostile `Error`/`Symbol.hasInstance`, at-most-once native close capability use, and selective artifact-kind poison pass |
| `node scripts/verify-p2p-placement-chromium.mjs` | Actual Chromium PASS: existing transport/resource/repair/origin-cut gates plus browser-held non-extractable provider, consumer, and observer keys; the provider derives the nonce-selected sample from browser-held stored bytes and signs response `/2` without a fresh consumer receipt; certificate-only failure and contested halt are also checked |
| `node --test --test-concurrency=1 test/confidential-journal-v2.test.mjs test/placement-repair-batch.test.mjs test/placement-repair-executor.test.mjs test/placement-repair-schedule.test.mjs` | Test files are serialized because exact-SHA concurrency `2` produced zero assertion failures but timeout-cancelled executor and schedule. Serialization alone still observed executor `1,538,640.1267ms` beyond its former `1,500,000ms` budget and schedule `846,722.895/900,000ms`. With unchanged corpora and budgets `2,000,000ms` / `1,200,000ms`, the remediated executor/schedule serial pair passes `2/2` in `2,178,485.7704ms` (`1,345,547.9513ms` / `832,008.0928ms`). Batch interruption remains capped at `1,200,000ms`; those corpora were subsequently included in the receipt-complete 48-stage `458/458` predecessor suite at `4b0ff0d290626318f68e4479d4b35d586a936822`. The current repair-hardening executor regression passes focused `1/1`; its complete-suite rerun remains pending. |
| `node --test test/placement-repair-schedule.test.mjs` and `node scripts/verify-placement-repair-schedules.mjs` | `10,000 × 8` signed-evidence schedules use a fresh production range session per seed. Node/fresh process pass `1/1` in `733,588.2114ms`; bundled Chromium matches digest `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM`, verdicts `2749/2489/2044/2718`, and duplicate provider/accounting/Continuity effects `0/0/0`. The deterministic ledger is anchored by separate full executor and actual DataChannel gates, not 10,000 external writes. |
| `node scripts/verify-confidential-placement-chromium.mjs` | Native 98,317-byte file, direct challenge delivery, four separate observer browser processes, actual local duration, 3-of-4 certificate, committed repair, A exit, B continuation, exact 2-of-3 recovery, zero post-cut origin/relay requests |
| `npm run test:sdk` and `node scripts/verify-sdk-package.mjs` | Authority-free public drafts, finalizers, verifiers, evaluator, and clean packed import; no signing key or network authority exported |
| `npm test` | PASS from `2026-08-21T15:08:09.9777152+09:00` through `2026-08-21T17:12:46.1993423+09:00`, exit `0`, wall `7,476,222ms`, through final `verify:s4`. Evidence documents were updated afterward and rechecked separately; exact-head CI remains the publication authority. |

## Explicit nonclaims

- Non-response is never absolute proof of death; it is a threshold statement under
  one declared policy and local-duration assumption.
- The response window is provider-signed and consumer-accepted for this exact lease
  tuple. That agreement still does not prove breach, death, lease termination,
  penalty, settlement, or an honest-timer/provider-fair SLA violation.
- A duration string and signatures do not prove honest timers or uncompromised
  observers.
- Key-level role separation is not Sybil resistance or physical independence.
- Same-PC browser processes are not different devices, networks, regions,
  credentials, administrators, or legal operators.
- Manual ICE exchange is not decentralized discovery or arbitrary NAT reachability.
- A certificate does not prove honest metering, economic value, or continuous
  availability after authorization.
- A derived action plan is forgeable data, not authority. The internal executor owns
  effect-time revalidation; the public Lab still does not provide autonomous background
  gossip/discovery or turn received bytes into authority.
- Response `/2` proves one challenged leaf/path matched one committed storage root
  at response construction. It is not proof of every byte, continuous custody,
  future availability, independent infrastructure, honest hardware, or an SLA.
- Response `/1` is still only a receipt-ID pointer. It is parseable but projects
  `pointer-only`/`independent_possession:false` and is not lineage authority.

## Next root P0

The policy/window and provider-only sampled-possession slices are implemented. A
minimal internal **single-shard effect-time executor** now re-verifies current evidence,
claims a replacement-independent slot, and passes a replacement-bound idempotency
key to a private provider session. A separate internal coordinator rederives the
signed result, claims one completion slot, and commits one proved successor generation
through a private idempotent Continuity session. Node covers concurrent/retry,
commit-then-failure recovery, and zero-call negatives; origin-cut Chromium covers
delayed-response zero-call, one real shard-0 effect, and one generation-2 completion
with zero additional effect or Continuity call on retry. The internal Node batch now
applies the same contract to every committed action and re-reads private evidence
between actions. A focused bounded range adapter now verifies canonical transport
frames and contributes only deduplicated response payload bytes; a late response
published after shard 0 stops shard 1 and Continuity. The origin-cut Chromium Lab now
feeds the same adapter from an actual connected DataChannel: an exact duplicate creates
no new frame, a rewrapped identical response deduplicates, ordered late proof leaves
provider calls `[1,0]` and Continuity `0`, and mid-batch disconnect leaves the same
later-call zeros. A provider-domain adapter now
restores results after sequential process restart with zero underlying provider or
Continuity calls. No-replace claims now exclude cross-process first execution in both
domains; proof-import recovery fills an unresolved result only after exact signed-
result verification and otherwise stays fail-closed. The `10,000`-seed deterministic
schedule corpus is now byte-identical in Node, a fresh process, and bundled Chromium,
with four verdict classes and zero duplicate provider/accounting/Continuity effects.
It uses the production evidence session and signed bytes, while its effect ledger is
anchored by representative full executor/DataChannel cases rather than 10,000 real
external writes. Lineage-governed logical admission is now focused PASS: custody-
signed membership epochs commit issuer roots and subject+issuer dual-signed challenge
evidence, preserve cumulative root/key history, collapse aliases by
operator root, select at most one observer per logical domain, preserve adjacent-
epoch quorum intersection, and halt on valid siblings. The next P0 is externally
administered issuers and measured multi-host topology. Until that gate passes,
provider-fair SLA, independent-topology, and Sybil-resistance claims remain HOLD.
