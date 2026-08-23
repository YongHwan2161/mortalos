# MortalOS

> **Create once. Continue elsewhere.**

MortalOS is an endpoint-neutral lifecycle protocol and falsification Lab for digital
resources that must survive process and key rotation without trusting a browser,
relay, host, UI, or model as the source of truth.

- Live protocol Lab: [mortal-os.com](https://mortal-os.com/)
- Korean experience: [mortal-os.com/ko/](https://mortal-os.com/ko/)
- Source: [YongHwan2161/mortalos](https://github.com/YongHwan2161/mortalos)
- Current North Star and execution plan: [implementation SSOT](docs/IMPLEMENTATION_PLAN.md)

Main contains the unified Participant Core, crash-safe durable quorum, exact S3
recovery over real relay fragments, confidential S4 state, an authority-free
verification SDK plus an explicit continuity capability subpath, Continuity Capsules,
and a replicated counter-authority model. The revised
S2/S4 claims remain deliberately narrower than their merged implementation until
new stage receipts promote them. The
[claim matrix](docs/CLAIM_MATRIX.md) distinguishes
implemented, exact-head verified, physically verified, promoted, and explicitly
unclaimed behavior.

Source documents do not self-promote the revision that contains them. Governance
and deployment status are exact-SHA external facts read from the PR, required
checks, merge record, post-merge workflows, and deployed asset manifest.

## Current development focus

The real-file product vertical now exists in one core path: endpoint A selects a
bounded runtime file, endpoint B accepts custody with a distinct key, A exits, and B
recovers exact bytes from two of three current-custodian-signed copy envelopes before committing the next
transition. Node uses separate endpoint processes, Chromium uses separate persistent
browser endpoints and the built Lab, and a clean `npm pack` consumer runs the matching
CLI without repository-relative imports.

MortalOS includes a portable
[signed bounded resource contract](docs/RESOURCE_CONTRACT.md): a strict provider
offer defines finite storage, bandwidth, compute, and time; provider and consumer
mutually sign one contained lease; the offer's declared Byzantine witness quorum
must gossip that exact consumption before activation; both parties sign chained
cumulative usage; either lease party can revoke. One offer is single-use, so two
different valid leases or one witness double-sign halt as equivocation instead of
silently overcommitting capacity. Lease-bound
challenge/receipt chains now prove bounded storage, bandwidth, and deterministic
compute execution by the leased participant; they do not by themselves prove
honest metering, physical provider/witness independence, or independent
administration.

This source revision composes those contracts with a real direct participant data
plane. An actual runtime-selected file and every offer/lease/challenge/receipt
artifact cross ordered WebRTC DataChannels after origin and relay access are cut.
Each peer retains one combined inbound/outbound transcript with the generated
ceilings of 512 unique canonical messages and 8,388,608 decoded raw message bytes.
Exact duplicates consume neither limit. Outbound overflow rejects before native
send, and successful outbound state commits only after `DataChannel.send()` returns;
inbound overflow commits no transcript/dedupe entry or subscriber delivery before
terminal cleanup clears subscriptions and closes the channel and peer. The virtual transport
applies the same exact decoded-byte ceiling. The relay edge uses a conservative
base64-size estimate and can reject slightly earlier, so only the common upper bound
and fail-closed behavior—not byte-identical edge accounting—are claimed.
Only exact active storage execution receipts count as placement. One provider
process loss degrades three copies to two; a distinct provider/new lease repairs the
target, and after consumer A exits, B recovers exact bytes from two valid peer copies
while rejecting one corrupt readback. The composed confidential controller encrypts
the native file as an S4 package for B, sends three distinct ciphertext shards to
providers, excludes stale receipts at max age + 1 ms, restores a public-evidence
journal fail-closed, and makes B authorize renewed placement under new operational
lease keys after A exits. Journal v2 first claims a reproof context bound to the
exact prior journal head, next generation, manifest, policy, and epoch. Every
accepted storage challenge nonce is derived from that context and its receipt-chain
predecessor. A new head requires a branded, active, distinct-provider `3/3` proof
set and carries the epoch's cumulative per-chain receipt high-waters; one no-replace
hard link per predecessor is the local durable successor CAS. Legacy v1 state is
metadata-only migration input and cannot become available until a fresh rotated-epoch
`3/3` reproof commits. Those successor-authorized operational keys are not
inferred to be, or cryptographically bound to, B's Continuity custody identity.
Placement generations now bind that evidence and repair intent into the organism's
Continuity lineage. The current descriptor's required quorum can commit a generation;
the resulting placement action plan is public, forgeable derived data rather
than authority, so an executor must reverify the original committed and current
evidence. The A→B sign-once handoff transfers no key, identical evidence converges
byte-identically, and valid siblings halt instead of selecting a winner. Raw local
unavailability no longer qualifies a lineage repair plan by itself: 3-of-4 keys
from the provider-signed offer's fixed witness roster sign one predecessor-linked,
provider-signed, consumer-accepted bounded-duration non-response
challenge with no global clock. The certificate is committed into the generation.
It is a continuity-scheduling transcript, not proof of provider death, breach,
lease termination, penalty, or settlement; agreed duration is not honest-timer or SLA-breach proof.
When a caller supplies a late verified provider receipt and its current placement
chain, the core conditionally halts the derived plan. The internal Node batch now
reads an existing bounded transport transcript between effects: it verifies canonical
frames and contributes only deduplicated `liveness-response` payload bytes to the
core verifier. The origin-cut Chromium harness now binds that same session to an actual
connected DataChannel range: one exact duplicate consumes no frame, a rewrapped copy
deduplicates by response bytes, the late response stops provider 1 and Continuity, and
a mid-batch disconnect also stops every later call. Transport metadata is never proof
authority. This is source plus local evidence; it does
not self-assert stage promotion, a globally live participant network, arbitrary
Internet reachability, Sybil resistance, or physical independence. See
[P2P placement and repair](docs/P2P_PLACEMENT_AND_REPAIR.md),
[confidential P2P placement controller](docs/CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md),
[lineage placement convergence](docs/LINEAGE_PLACEMENT_CONVERGENCE.md),
[quorum liveness and repair certificates](docs/QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md), and the
[implementation SSOT](docs/IMPLEMENTATION_PLAN.md).

## Guided two-browser proof

1. In Browser A, choose **Create in this browser**.
2. Open the locally generated join QR or copied link in a clean Browser B profile.
3. Browser B creates its own non-extractable key. A and B authorize one canonical
   custody handoff; no private key crosses the relay.
4. Close Browser A.
5. In Browser B, choose **Continue here** and confirm that the same `organism_id`
   advances from sequence 1 to 2 with a new deterministic state root.

The page keeps one organism and one primary journey in view. GPT, the fixed reference
fixture, corpus replay, raw bytes, durable storage, and protocol diagnostics remain
available under **Advanced evidence**, but none is required to complete the main
proof.

## What is implemented and what is promoted

| Claim | Evidence |
| --- | --- |
| L1 — portable history | A clean browser imports canonical public evidence and reconstructs the same identity and head without receiving signing authority. |
| L2 — live endpoint succession | A→B custody handoff is accepted; after A closes, B signs the next state transition for the same identity. |
| L3 — quorum resilience | A/B/C hold distinct keys under `2-of-3`; every complementary pair continues after the third endpoint is lost, and a new D can repair membership. |
| L4 — deterministic state | JavaScript and an independently written Python verifier reproduce byte-identical next-state and receipt records; tamper and limits fail atomically. |
| L5 — recoverable resource state | A canonical manifest binds a bounded resource to lineage; any two logical replicas reconstruct the exact 1 MiB reference after the third replica and primary relay are deleted. S3 is promoted. |
| S4 revised implementation — confidential resource state | S3 stores only a canonical ciphertext package; authorized recovery returns exact bytes without exposing the internal epoch-key handle. Node, Chromium, and Firefox rotation/custody gates pass; a new stage receipt and isolated-signer claim remain separate. |
| S5/S6 product continuity — portable use | The default SDK remains verification-only; `@mortal-os/core/continuity` and the CLI expose create/inspect/handoff/recover/continue through explicit authority capabilities. A canonical Capsule binds lineage plus exact resource bytes, and clean-package Node plus built-Lab Chromium complete A→B recovery and continuation. The product Capsule is not a confidentiality claim. |
| S7/S8 merged implementation — replicated custody | Three process-isolated HTTP CAS replicas tolerate one loss and repair after disk restart; 2-of-3 signed Capsule-copy custody tolerates one corrupt/lost copy and rejects duplicate copy identity and a valid fork. This is not evidence of independent providers or administrators. |
| Resource execution — bounded contribution and verified work | Canonical offers, mutual single-use leases, threshold gossip, chained usage, and revocation are merged with lease-bound storage, bandwidth, and deterministic-compute challenge receipts. Actual child-process loss and new-lease reassignment pass, but this is not proof of honest meters or independent hardware, accounts, witnesses, or administrators. |
| Confidential lineage-bound P2P placement source | A native 98,317-byte file becomes an S4 package for B and three distinct 2-of-3 ciphertext shards cross direct DataChannels. Journal v2 binds every reproof to the exact prior head, next generation, manifest/policy, and an epoch nonce; challenge nonces also bind receipt-chain identity, sequence, and predecessor. Only a module-private branded active `3/3` set can create a head. The journal retains cumulative chain high-waters across provider replacement. The exact-ceiling Node and mixed-runtime Chromium gates reach generation 129 with 384 chains (`128/128/128`) and reject a signed plus-one candidate without changing bytes. A custody-quorum-signed membership epoch sidecar commits issuer roots, subject+issuer dual-signed challenge evidence, operator roots, logical failure domains, validity, prior epoch, cumulative root/key history, and the exact Capsule/head. Direct rotation, explicit revocation, old root/key rollback, retired-authority resurrection, and fork rules are fail-closed. Deterministic selection deduplicates aliases and counts at most one observer per operator/domain; adjacent epochs preserve quorum intersection and valid siblings halt. Compact admitted liveness policy `/2` binds the epoch ID and selection digest without recursively nesting the sidecar; compatibility policy `/1` remains parseable. Consumer challenge `/2` binds exact policy bytes/ID and predecessor. Provider response `/2` signs a nonce-selected storage Merkle leaf/path from stored bytes without a fresh consumer receipt; response-only is sampled `alive`, while response plus a 3-of-4 certificate halts. Receipt-pointer response `/1` and legacy challenge/certificate `/1` remain parseable but cannot authorize lineage repair. The internal single-shard executor ignores the forgeable public plan, re-verifies the original Capsule/generation/commit/current placement and liveness bytes, claims one failure slot durably, and passes a deterministic replacement-bound `effect_id` to a private provider session. That provider-domain adapter persists the exact canonical request and placement result before returning: a focused child exits after the provider result but before the executor result, and a new session restores it with `0` underlying provider calls. A predecessor/effect-keyed no-replace execution claim permits only one conforming local process to invoke the provider first. A second internal coordinator rederives the signed result, rejects any non-exact outer or encoded-placement schema, and replaces only that shard. Its durable completion slot is bound to the immutable repair slot, prior commit, manifest, and successor generation, while the exact result ID remains candidate content; a self-rehashed ignored-field variant therefore cannot reach a second private Continuity call. Its durable adapter persists exact Capsule/generation request and returned Capsule/commit bytes, excludes cross-process first commit, and restores a completed result with `0` underlying signing calls after outer failure. The internal multi-action scheduler requires the complete intent set, re-reads evidence before every effect and completion, reuses durable partial results, and commits one all-result proved successor. Its bounded network evidence session captures a private baseline/range capability, verifies a monotonic canonical transcript, and contributes only deduplicated response payload bytes. An actual origin-cut Chromium DataChannel range proves a late response after shard 0 leaves provider calls `[1,0]` and Continuity calls `0`; an exact duplicate consumes no extra frame, a differently wrapped identical payload deduplicates, a non-response artifact is ignored, and disconnect before the next read also leaves every later call at zero. A separate provider-interruption gate proves reversed concurrent retry converges without repeating shard 0. If a provider or Continuity winner crashes before durable result publication, a separate recovery executor can now import only an already-authoritative signed placement or verified successor Capsule/commit. Recovery accepts no provider or signing capability, requires the exact existing request and no-replace claim, and performs `0` duplicate external calls. Invalid proof changes no result; without proof the claim stays unresolved, with no timeout or stale-claim takeover. The connected evidence is a manually signaled same-host direct WebRTC pair. Admission proves policy-scoped logical diversity and subject key control, not external issuer honesty, physical/admin independence, arbitrary-NAT reachability, Sybil resistance, death, breach, termination, penalty, or settlement. Externally operated issuers and measured independent topology remain the next P0. |
| Honest failure | Closing A before the handoff leaves B read-only and stalled. A single remaining `2-of-3` endpoint is insufficient, not “dead.” |

The admission path now also has a bounded loopback ceremony in which issuer and
subject keys live in separate Node processes. Each endpoint is locked to one exact
trust root and admission policy, rederives the canonical request locally, exposes no
private capability, and rejects a conflicting reuse of the same challenge slot. An
optional local authority file, created with requested mode `0600` on supporting
filesystems, preserves the identity and sign-once tuple
across competing processes and restart: one conflicting race has one winner, exact
retry is byte-identical, and the loser remains rejected. This proves process/key and
local crash/restart separation on one PC; it is not HSM custody, does not prove
Windows/NTFS ACL enforcement, and does not prove separate administrators, hosts,
networks, or physical failure domains.

A private-key-free HTTP ceremony runner now accepts only a prebuilt canonical request
and two policy-locked endpoint capabilities. It constructs all identity/signature
requests before its first suspension, refuses redirects and non-loopback plaintext
HTTP, bounds streamed responses, and emits one immutable token-free replay bundle.
The `/2` challenge explicitly carries both endpoint origins/key IDs under a generated
512-byte ceiling and binds a digest over them. Each operator-facing signer service is
configured with its own advertised origin and rejects an alias before private-key use;
`scripts/prepare-placement-admission-issuer.mjs` first creates/restores the issuer's
host-local authority and publishes only its canonical public trust root no-replace, so
the subject host need not receive its private authority.
`scripts/prepare-placement-admission-subject.mjs` similarly publishes only the
subject's canonical public identity, and
`scripts/create-placement-admission-ceremony-request.mjs` combines those two public
files, the exact policy, both origins, bounded validity, and a fresh local random nonce
into one no-replace request before either service starts. The coordinator therefore
does not parse either long-running readiness stream or custody a signing key. Durable
authority files reproduce the exact bundle after process restart. For independently
administered operation, each signer host now runs a role-local client with only its own
generic bearer environment value and publishes a canonical token-free response. A
network-free finalizer consumes the request plus those two public responses; the public
pilot verifier repeats that finalization and requires byte-identical bundle output.
The signer CLI can now terminate TLS natively from administrator-local bounded
certificate/private-key files, requires an HTTPS advertised origin and TLS 1.2+, and
rejects an incomplete, oversized, or mismatched pair before creating an absent signing
authority. Native mode requires a separate possession-only token distinct from the
admission bearer. Readiness identifies native `https` versus private `http` proxy mode
and the proof capability without emitting any secret. The direct native-HTTPS test
verifies both roles, offline finalization, live peer certificate/public-key observation,
TLS-exporter-bound role-key possession, captured-proof replay rejection, and byte-identical
admission-response restart.
The older combined client remains compatible but is not the strict multi-administrator
path because it receives both bearer values. Changing an
origin and recomputing the public bundle ID therefore still rejects. The bundle proves that
both keys signed that exact endpoint declaration; it does not prove who administers
those endpoints or where they physically run. Current tests use loopback services.

A fresh-process deployment observer now restores that signed bundle, requires both
origins to be HTTPS, and by default requires each configured role key to sign a bounded
ceremony/origin/role/key/nonce/time proof carrying the digest of a TLS exporter derived
on that same request connection. It records the proof and platform-verified peer
certificate/public-key digests plus the actual socket remote address. Replaying the same
public identity or a captured valid proof under the same certificate on a new TLS
connection fails. Identity-only `/1` remains available only through explicit
`legacy-identity-only` mode for terminator compatibility and is not fresh key-possession
evidence. Because a TLS exporter is connection-specific, repeating the same logical probe
on a new connection intentionally produces another observation ID. The combined
observer/attester CLI therefore requires a no-replace observation-journal path, publishes
the exact token-free observation there before invoking the durable observer signer, and
reuses that journal without possession tokens or endpoint access after a crash. A new
connection is never mistaken for an exact plan-scoped retry. The immutable
artifact fixes `non_authority:true` and both independence verdicts to `"unproven"`;
different IPs or certificates remain measurements, never administrator or physical-
domain authority. The executable regressions cover both native-direct `/2` and explicit
proxy legacy `/1`, while both still use one PC/address and deliberately avoid promoting
topology.

Membership publication now has an operator path instead of assuming pre-existing
epoch files. The coordinator gives
`scripts/create-placement-membership-epoch-request.mjs` only the current Capsule,
logical policy/window, optional exact predecessor, and verified ceremony bundles for
the provider and every observer. The CLI derives the evidence/root set and publishes
one no-replace request; it accepts no free-form membership body. Each current Capsule
custodian independently runs `scripts/approve-placement-membership-epoch.mjs` with an
existing local authority. Non-custodians reject before signing, while the exact request
uses the durable membership sign-once tuple. The coordinator supplies threshold
approval sidecars to `scripts/finalize-placement-membership-epoch.mjs`; mixed requests,
insufficient quorum, wrong Capsule/predecessor, and duplicate approval ordering fail,
while approval input permutations finalize byte-identically. The deployment regression
no longer constructs observer evidence with raw private authorities: both durable
observer keys act as subjects in separate policy-locked issuer/subject ceremonies and
the same keys later accept the plan and attest.

A new non-authoritative deployment plan precommits one ceremony, a bounded logical
window/timeout, and a complete two-through-eight observer roster with one unique nonce
and declared administration/failure-domain/vantage digest set per durable Ed25519 key.
Each observer host first uses the public-identity preparation CLI to create or restore
its durable local key and publish only canonical `key_id`/`public_key` bytes no-replace;
the coordinator collects those public files before constructing the plan and never
receives observer private material. Every roster key must then publish a signed
acceptance. Its durable ceremony-scoped sign-once slot permits an exact retry but
rejects a different plan for the same ceremony. Only the complete sorted acceptance
set creates activation `/1`. A membership-binding `/2` then embeds that activation, the
exact ceremony bundle, the selected custody-quorum-signed current membership epoch, and
a canonical commitment to the complete supplied epoch-candidate view. It exists only
when that view forms one complete fork-free chain converging at the supplied current
Capsule, the ceremony subject evidence is in the selected epoch, and the plan roster is
exactly the epoch's complete two-through-eight observer membership, with each declared
administration/failure-domain digest matching its admitted member and remaining distinct
from the subject and every peer. Attestation `/5` signs the exact membership binding,
candidate-view commitment, and observation only after the combined operational CLI
re-verifies the current Capsule against the same complete supplied candidate sidecars,
derives the assigned nonce/window from the admitted activation, and completes the HTTPS
probe. Each durable observer uses one plan-scoped attestation sign-once slot: exact
retry is byte-identical, while a different membership view, observation, or attestation
instant under the same plan halts. Because plan acceptance is itself ceremony-scoped,
a later membership epoch requires a fresh ceremony, plan, complete acceptance set,
activation, and binding. The deterministic view requires the whole membership-bound roster and
rejects post-hoc observer, nonce, vantage, window, ceremony, plan, activation, epoch, or
membership substitution. A compact
`mortalos-placement-admission-deployment-attestation-view/1` manifest now commits the
key-sorted attestation/observer/observation IDs and complete derived roster summary
without nesting signature sidecars. Offline restore is self-hash-only; explicit
verification must receive every exact attestation sidecar and reproduce the manifest.
No-replace create and read-only verify CLIs make that all-roster result portable to a
fresh process. A second non-normative pilot receipt closes the wider public-file
chain. `scripts/create-placement-admission-pilot-evidence.mjs` consumes one canonical,
public-root-contained index and rechecks the exact trust-root/subject-identity/request/
bundle files for every ceremony, every request-bound custodian approval and finalized
epoch predecessor, the separately published plan/acceptances/activation, current-
Capsule membership convergence, all attestations, and the compact view. The independent
`scripts/verify-placement-admission-pilot-evidence.mjs` recreates the receipt from all
sidecars; offline receipt restore remains `public_chain_verified:false`. Unordered
bundle/approval/acceptance/attestation inputs are byte-deterministic, while missing or
substituted sidecars and public-root path escape reject. The receipt records the
expected Git commit but explicitly labels execution binding `recorded-only`; clean
exact-SHA execution and review remain external gates. A separate role-local layer now
narrows that gap without changing the public-chain receipt. The conforming
`attest-placement-admission-role-execution.mjs` path checks an exact Git `HEAD` and a
clean tracked/untracked/submodule worktree before the artifact's own authority signs a
canonical source/artifact receipt. `create-placement-admission-pilot-source-attestation.mjs`
then requires exactly one valid receipt for every ceremony role response, custody
approval, plan acceptance, and deployment attestation in the reverified pilot chain.
Its deterministic result reports
`source_commit_execution_binding:"role-key-attested-artifacts"`, while unsigned
coordinator execution, topology, and both independence claims stay `unproven`.
The final non-normative
`mortalos-placement-admission-pilot-source-verdict/1` does not add a coordinator key.
It first recreates that complete chain and receipt aggregate, then inventories every
remaining unsigned protocol artifact. An artifact is accepted only when participant
signatures endorse its exact digest or the verifier deterministically recreates it from
authenticated sidecars. The current fixture classifies all 21 such artifacts (12
participant-endorsed and 9 deterministically replayed), alongside 12 role-source
artifacts across 7 keys and the signature-verified Continuity Capsule. Only full
sidecar verification reports all three verification flags true and
`coordinator_protocol_authority:"not-required-for-verification"`; offline restore
reports them false. Coordinator execution itself remains explicitly `unproven`.
The participant-closure layer now narrows the remaining public-inventory ambiguity for
one deployment plan. Every unique key represented by those exact role receipts signs
the same source-verdict digest and ID under a durable sign-once tuple keyed by the
exact `deployment_plan_id`. The aggregate accepts no partial set and sorts the complete
key/role/ratification inventory. In the conforming durable-authority path, the same
role key cannot ratify a second verdict for that plan, so a coordinator cannot produce
two fully participant-closed final inventories. The current fixture requires all 7/7
role keys and reports `inventory_closure:"all-role-keys-ratified"`. This is
participant-ratified closure for that plan, not proof of artifacts hidden from every
honest participant or of copied-key/journal independence.
This is attributable operator testimony under the conforming CLI, not proof against a
dishonest operator or a replacement build process; exact-SHA CI and immutable review
remain separate. The current native `/2`, journal-
recovery, role-response-complete affected integration passes `1/1` in
`207,089.5934ms` (runner `207,282.5833ms`, exit `0`) with the complete 34-artifact
verdict and 7/7 participant closure verified. The signer-service file passes
`4/4` in `20,655.0405ms`, including direct native HTTPS, while adjacent ceremony/session
regressions pass `7/7` in `10,071.95ms`; those two concurrently run receipts cover
`11/11`. One same-source ordered run passed all
preceding stages and emitted P2P tests through `51` without a failure, but its final
PTY output/exit receipt was lost after worker exit and remains historical incomplete
evidence. A later receipt-complete current-source run passed all 48 configured stages,
`458/458` TAP tests, and final `verify:s4` with zero failures, cancellations, or skips.
This removes raw disjoint
**unadmitted** rosters and same-roster
multi-plan selection in the conforming flow. It does not make locally supplied times or
topology measurements authoritative: admission is policy-scoped under configured issuer
roots and lineage custody, while issuer honesty, physical independence, and absolute
Sybil resistance remain unproven. A candidate omitted from every observer's supplied
view is still unknowable. The focused public-chain test uses native role-local TLS
signers on one PC; explicit proxy `/1` compatibility is tested separately. Real
separately administered vantage operation is the next gate.

Current status is **TLS-CHANNEL-BOUND, CRASH-RECOVERABLE, ROLE-KEY-ATTESTED,
COORDINATOR-NON-AUTHORITY, ALL-ROLE-KEYS-RATIFIED PUBLIC-CHAIN PILOT COMPLETE-SUITE
PASS; EXACT-SHA GATES EXTERNAL; SEPARATELY
ADMINISTERED MULTI-HOST OPERATION NEXT**.
The production evidence-session corpus runs `10,000` deterministic schedules with
eight response/certificate/order/partition/disconnect/restart events each. Node and a
fresh process match byte-for-byte in `733,588.2114ms`; a separately bundled Chromium
run matches digest `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM`, with verdicts
`2749` completed, `2489` liveness-halted, `2044` order-halted, and `2718` partition-
unavailable, and zero duplicate provider/accounting/Continuity effects. The corpus is
anchored by the full executor and actual connected DataChannel focused gates; it is
not 10,000 real provider writes or independent-network trials. The Node placement-history ceiling
gate passed in `2,841,685.4279ms` test-body time
(`2,842,481.1467ms` runner; `2,842,596ms` shell), and the mixed-runtime Chromium/Lab
ceiling passed in `2,549,195ms` dynamic time (`2,666,619ms` total). The Chromium
guard is now `3,300,000ms` because the passing dynamic segment used 94.41% of the former
`2,700,000ms` cap; the protocol/deploy workflow ceilings remain 240 minutes without
skipping a gate. The historical `7,065.8s` full-suite PASS predates the placement-
history ceiling tests. A later uninterrupted `npm test` ran from
`2026-08-11 01:06:58.716+09:00` through
`03:21:35.542+09:00`, exited `0`, and completed every ordered gate through final
`verify:s4` in `8,076,826ms` (`8,076.826s`; `134m 36.826s`), but that run predates
the current WebRTC runtime/test/security remediation and is historical only. The
current candidate passes the literal count/byte cap-plus-one and native-close Node
gate `24/24` in `31,241ms` and the actual Chromium boundary/cleanup probe in
`50,086ms`. On the merged base before this liveness-policy delta, a hidden-wrapper
`npm test` ran uninterrupted from
`2026-08-11T06:42:38.6738575+09:00` to
`2026-08-11T09:06:30.4636057+09:00`, exited `0` after `8,631,790ms`
(`143m 51.790s`), and completed every ordered stage through final `verify:s4`.
The covered source/runtime/test/workflow files remained unchanged afterward and a
fresh process inventory found zero related workloads after excluding the inventory
command itself. That historical PASS does not transfer to the current policy source.
The current branch passed uninterrupted `npm test` from
`2026-08-21T15:08:09.9777152+09:00` through
`2026-08-21T17:12:46.1993423+09:00`, exit `0`, wall `7,476,222ms`
(`124m 36.222s`), through final `verify:s4`. Evidence documents changed afterward
only to record that result and are checked separately by spec, links, and diff gates.
After the membership-bound observer-attestation/view delta was added, a fresh ordered
`npm test` call issued at `2026-08-21T20:48:19.650+09:00` reached final
`verify:s4` PASS at `2026-08-21T23:11:26.544+09:00`. The command did not emit its own
wrapper wall-time marker, so those timestamps are an observed execution window rather
than a claimed exact duration. Every earlier `&&` stage completed, including the
observer test, the 68-test P2P group, actual Chromium P2P and confidential-placement
verticals, the 10,000-schedule corpus, SDK/package/relay/browser/Lab gates, and S0-S4.
Only evidence documents changed afterward; current docs pass separate spec, link, and
diff checks.
Exact-head CI, immutable review, approval, merge, deployment, and public readback
remain external.

Actual Chromium gates use isolated browser profiles and real non-extractable WebCrypto
keys. They prove browser/profile isolation and protocol behavior, not that three
people, organizations, or physical devices independently control the keys. They also
do not isolate signing authority from compromised same-origin JavaScript: a persisted
non-extractable `CryptoKey` can still sign without being exported.

## What MortalOS does not claim

- It is not a general-purpose operating system or an autonomous-agent runtime.
- A relay, room link, browser animation, GPT answer, process exit, or silence never
  establishes protocol validity or global death.
- A single-browser logical quorum is one physical failure domain.
- Finite evidence cannot prove that every hidden copy worldwide is gone.
- Chromium and Firefox durable-key paths pass actual-engine source-revision gates. WebKit
  is routed by a runtime capability probe that requires sign/verify through the
  canonical 65,536-byte message ceiling, not merely key generation. Current Windows
  and Ubuntu Playwright 26.5 builds are verifier-only for different measured reasons;
  any future full signer-capable build must run the complete S2/S4 custody matrix.

## Run locally

Requirements: Node.js 22.5 or later. Windows and Ubuntu are release-gated; current
Chromium is required for browser acceptance.

```bash
npm ci
npx playwright install chromium firefox webkit
npm test
npm run verify:lab
npm run dev:lab
```

Open the printed URL in two isolated browser profiles. The local server supplies a
deterministic relay and model fixture, so the proof requires no Cloudflare or OpenAI
credential.

Focused gates:

```bash
npm run test:i18n
npm run test:state
npm run test:transport
npm run test:p2p-placement
npm run test:relay
npm run test:multi-browser
npm run test:durable-quorum
npm run test:distributed-counter
npm run test:protocol-profile
npm run test:security-fuzz
npm run test:sdk
npm run test:capsule
npm run test:continuity
npm run verify:continuity-browser
npm run test:browser-capabilities
npm run test:browser-parity
npm run verify:security-boundaries
npm run verify:persistent-handoff
npm run verify:ux
npm run verify:state
npm run verify:transport
npm run verify:cost-controls
npm run test:chromium
npm run test:coverage
```

## Public continuity API and CLI

The default `@mortal-os/core` export remains verification-only. Product code opts
into authority use explicitly:

```js
import {
  continuity,
  createContinuityAuthority
} from "@mortal-os/core/continuity";

const authority = await createContinuityAuthority();
const created = await continuity.create({ authority, resourceBytes });
const verified = continuity.inspect({ capsuleBytes: created.capsule_bytes });
```

The CLI exposes the same lifecycle as machine-readable commands:

```text
mortalos create --resource FILE --authority A.key --out A.mosc --copies copies-a
mortalos handoff request --capsule A.mosc --authority B.key --out request.json
mortalos handoff propose --capsule A.mosc --authority A.key --request request.json --out proposal.json
mortalos handoff accept --capsule A.mosc --authority B.key --proposal proposal.json --out B.mosc --copies copies-b
mortalos recover --authority B.key --expected-head HASH --out-resource recovered.bin --copy COPY --copy COPY
mortalos continue --authority B.key --capsule B.mosc --expected-head HASH --resource recovered.bin --out C.mosc --copies copies-c
```

CLI private keys remain endpoint-local authority files. Capsules, handoff messages,
copy artifacts, SDK results, and CLI JSON never contain that private material.
Each authority file is serialized by an exclusive sibling lock before its sign-once
journal is flushed and atomically replaced. A conflicting second process fails
closed; a lock left by a crashed signer is never guessed stale and requires explicit
operator recovery. Persisted authority and custodian records use exact-key validation,
the sign-once journal is normalized into a null-prototype own-data record and read
with captured JSON/object operations, and public custodian objects are rebuilt from
`key_id` and `public_key` only.

`mortalos custody verify` and `recoverContinuityCapsuleQuorum` remain compatibility
tools for raw canonical Capsule integrity; byte-identical raw inputs do not prove
independent copies. Product recovery uses signed `mortalos-continuity-copy/1`
envelopes through `mortalos recover` or `recoverContinuityCopyQuorum`, and requires
distinct copy and logical-provider identities.

## Public resource-contract API

The default SDK exposes verification and deterministic explicit-time evaluation,
including lease-bound execution evidence.
Creating signed artifacts uses the explicit authority-free drafting subpath; the
caller keeps its signer outside the core:

```js
import {
  prepareResourceConsumptionWitness,
  prepareResourceOffer,
  finalizeResourceOffer
} from "@mortal-os/core/resource-contract";

const draft = prepareResourceOffer(offerBody);
const provider_signature = await endpointSigner(draft.provider_signing_message);
const offerBytes = finalizeResourceOffer({
  body: draft.body,
  provider_signature
});
```

The same prepare/finalize/verify pattern applies to mutual leases, consumption
witnesses, chained usage receipts, revocations, consumer-signed execution
challenges, and provider/consumer-signed execution receipts. Storage receipts
verify a challenged Merkle leaf, bandwidth receipts verify an unpredictable
payload round trip, and compute receipts reproduce a bounded deterministic hash
chain. Every execution binds one exact usage receipt and predecessor; the dedicated
execution evaluator rejects missing or cross-lease evidence. A witness draft exposes a
sign-once request whose tuple is the offer ID and whose message binds the exact lease
ID; the existing endpoint-local authority can sign it without moving private key
material into the resource core. Bounded self-contained announcements and
placement artifacts can travel over relay control or direct WebRTC, but receivers
always re-verify them. The core receives
tagged public signatures, never the private signer, ambient clock, transport,
scheduler, or storage capability.

The focused local gate executes all three workload classes in an actual child
provider process, terminates it, and permits reassignment only through a new signed
offer and lease while preserving the immutable workload ID. This is process-level
evidence, not a claim of separate hardware, account, region, administrator, or
credential custody.

The source-revision `npm run test:p2p-placement` gate additionally sends an actual file,
offers, leases, witness announcements, challenge, usage, and execution evidence over
direct DataChannels with `iceServers: []`. After bundle load, HTTP and relay access
are denied. It proves same-host browser/process behavior only; manual ICE does not
establish arbitrary Internet or NAT reachability.

`verify:lab` includes the strict 20-run two-persistent-profile handoff gate. The
focused command above runs that gate alone; it refuses a configured run count below
20. Its first run also measures two simultaneously active browsers for 12 seconds
against the production-shared relay policy and requires zero local `429` responses.

The fixed property corpus contains exactly 10,000 cases from seed `1297044052`.
The expected H2 trace digest remains:

```text
19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399
```

## Trust boundary

```text
Endpoint key custody
        │ signed canonical public messages and resource bytes
        ▼
replaceable carrier: direct WebRTC or untrusted relay
        │ canonical bytes; no verdict authority
        ▼
resource/placement and lifecycle validators
        │
        ▼
portable kernel → accepted lineage or stable rejection
```

Each endpoint verifies locally. The relay cannot return `accepted: true`, choose a
head, sign, resolve a fork, or declare death. Durable Participant storage is consent-
gated and uses one atomic versioned document for a non-extractable key, canonical
public evidence, state references, sign-once journal, pending recovery, and explicit
authority policy. Restore replays evidence instead of trusting cached verdicts.
Ephemeral Demo creates no durable browser storage.

The journal and counter CAS prevent equivocation by conforming concurrent endpoints;
they are not an XSS-resistant signer boundary. Strong sign-once custody remains HOLD
until key use and monotonic state move to a separately isolated origin/service or
hardware-backed authorization domain.

The governed total gate order remains:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → Durable Object relay → two-browser succession → three-endpoint 2-of-3 repair`

This source revision extends that foundation through:

`portable kernel → S4 ciphertext shards → signed bounded lease → direct peer transfer → fresh receipt-gated placement → crash recovery → successor-authorized operational repair → peer recovery`

## GPT-5.6 boundary and cost safety

GPT-5.6 is an optional, collapsed adversarial witness. The deterministic main journey
performs zero model calls. The browser never receives an OpenAI API key. The server
route is fail-closed behind explicit enablement, Turnstile validation, atomic D1
actor/global-minute/global-day caps, bounded input/output, and a circuit breaker.

If a production Turnstile widget and secret are not configured, optional GPT remains
disabled and the local curated attack path stays available. Model output can suggest
an allowlisted mutation but cannot sign, compile canonical authority, select a head,
or alter a kernel verdict.

## Release integrity

Every publishable SHA must pass local tests, immutable independent review, exact-head
CI, expected-head merge, post-merge CI, exact-main Cloudflare deployment, public
manifest/asset/header readback, and clean Chromium acceptance. An old green run does
not cover a new SHA.

To verify the accepted production artifact:

```bash
MORTALOS_LAB_URL=https://mortal-os.com \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:release
```

The `pages.dev` hostname is an incident fallback. Production bytes are never patched
out of band; a failed candidate preserves or restores the last accepted deployment.

## Documentation

- [Documentation map](docs/README.md)
- [North Star implementation SSOT](docs/IMPLEMENTATION_PLAN.md)
- [Current claim matrix](docs/CLAIM_MATRIX.md)
- [P2P storage placement and repair](docs/P2P_PLACEMENT_AND_REPAIR.md)
- [Confidential P2P placement controller](docs/CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md)
- [Lineage-bound placement convergence](docs/LINEAGE_PLACEMENT_CONVERGENCE.md)
- [Endpoint-neutral architecture](docs/ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](docs/BROWSER_PARTICIPANT_COMPATIBILITY.md)
- [Crash-safe durable quorum](docs/DURABLE_QUORUM.md)
- [Distributed counter-authority ADR](docs/DISTRIBUTED_COUNTER_AUTHORITY_ADR.md)
- [Protocol](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Traceability](docs/TRACEABILITY.md)
- [Historical documentation archive](docs/archive/README.md)
- [Agent collaboration and merge protocol](docs/AGENT_COLLABORATION.md)

MortalOS is licensed under the [Apache License 2.0](LICENSE). Direct dependency
licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
