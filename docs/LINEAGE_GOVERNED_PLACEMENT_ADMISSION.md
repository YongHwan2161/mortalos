# Lineage-governed placement admission and logical failure domains

Status: **PUBLIC-CHAIN PILOT RECEIPT PREDECESSOR COMPLETE-SUITE PASS; CURRENT REPAIR-HARDENING FOCUSED PASS AND COMPLETE-SUITE RERUN PENDING; EXACT-SHA GATES EXTERNAL**

Last synchronized: **2026-08-22 KST**

## Claim

Placement repair authority no longer accepts the provider offer's key roster as
evidence that its observers are independent. A canonical admission-evidence `/1`
document carries an exact bounded challenge and is signed independently by the
admitted subject and an explicitly named trust-root issuer. The subject signature
proves key control for those exact bytes; the issuer signature records the logical
operator/domain assertion. A membership-epoch
`/1` document commits the exact trust roots, evidence, members, observer policy,
validity interval, current Continuity organism/head/custody descriptor, and current
custody-quorum approvals.

For each lease/workload/shard/failure sequence, the portable kernel derives a
deterministic observer roster from that epoch. Selection excludes the consumer and
provider, excludes the provider's operator root and failure domain, and uses a
bipartite matching so at most one selected observer occupies each logical operator
root and each logical failure domain. Alias keys therefore cannot multiply one
admitted operator or domain into quorum weight.

Adjacent epochs are accepted only when both their operator-root sets and their
failure-domain sets retain the declared quorum intersection. Valid siblings halt;
missing, extraneous, duplicated, or nonconsecutive epoch inputs halt. Continuity's
sign-once custody authority rejects a second conflicting epoch approval for the same
lineage head.

Every root also has a stable authority ID, positive sequence, and exact predecessor.
Rotation is direct-only. Silent removal is invalid; revocation is explicit. Epochs
retain cumulative root/issuer-key history plus retired authority IDs, so an old root,
an earlier issuer key, or an already retired authority cannot be reintroduced under a
new sequence. Competing same-parent rotations remain ordinary membership forks.

## Process-separated signing ceremony

The Lab now exposes a deployable, authority-narrow signer session rather than a raw
signing endpoint. The issuer and subject services each generate a non-extractable
Ed25519 key inside their own Node process. Each service locks itself to one exact
trust root and one exact attestation kind, operator root, failure domain, and role
set. The canonical policy digest must equal the root's `policy_digest`, making the
local signer policy portable and replayable. It reparses and rederives the bounded canonical admission request locally,
checks that its own public identity occupies the required role, and signs only that
role's domain-separated evidence message. The coordinator receives public identity,
root, request, and signature bytes, but no private-key capability.

One root/subject/challenge/role slot is sign-once. An exact retry returns the same
canonical response; a different evidence ID in that slot rejects as equivocation.
Wrong root, subject, policy, bearer token, malformed request, and max-plus-one HTTP
body reject before signing. The bearer token protects endpoint access but is not
protocol authority: portable evidence verification still decides acceptance.

For restart-safe operation the same session can delegate its owned role message and
deterministic slot tuple to the existing local Node authority. That authority keeps a
stable identity and sign-once journal in a file created with requested mode `0600`
on supporting filesystems, serializes competing
processes with its lock, and deterministically reproduces the exact signature after
restart. Two processes racing different evidence for one slot therefore produce one
winner and one equivocation; both the winner and loser remain stable after restart.
This is durable local-file custody, not a non-extractable HSM claim or evidence that
Windows/NTFS ACLs enforce POSIX mode bits.

## Endpoint-bound replay ceremony

`lab/placement/admission-ceremony-client.mjs` now exposes both a compatibility combined
client and the strict independent-administration path. In the strict path,
`scripts/run-placement-admission-ceremony-role.mjs` runs separately under each signer
administrator, receives only that host's generic bearer environment value, and writes
one canonical token-free public role response no-replace. The coordinator receives the
two public responses and uses `scripts/finalize-placement-admission-ceremony.mjs` to
verify and combine them with no bearer value and no network request. Every CLI uses a
same-directory temporary file and hard-link publication. Existing output fails before
network or input reads as applicable; a failed partial run can recover by retrying the
exact request because each signer is independently sign-once. The combined
`run-placement-admission-ceremony.mjs` remains byte-compatible but is not the strict
multi-administrator path because one process receives both bearer values.

The external ceremony challenge `/2` fits the generated 512-byte ceiling and contains
a 256-bit nonce, the explicit issuer origin/key ID and subject origin/key ID, plus a
digest over that exact binding. Each signer session is configured with its own
canonical advertised origin and rejects a role-specific origin/key mismatch before
private-key use. Both roles sign the evidence ID that contains those bytes. Offline
replay therefore rejects an origin edit even when an attacker recomputes the bundle's
public self-hash. The coordinator constructs both
identity Requests and both signature Requests before its first suspension, denies
redirects, permits plaintext HTTP only for loopback, enforces one total bounded
timeout, and reads every response through a captured size-limited stream. Bearer
tokens, private keys, PKCS8, and signer capabilities are absent from the bundle.

`scripts/run-placement-admission-signer.mjs` turns the same boundary into an
operator-facing long-running process. It reads canonical bounded policy/root files,
keeps bearer authorization in an environment variable, uses a restart-stable local
Node authority, and publishes only public readiness metadata. Its HTTP adapter has
exact identity/sign routes, constant-time token comparison, content-type, body,
header, timeout, and concurrency bounds. A private listener may sit behind a TLS
terminator, but no forwarding header changes the configured signed origin.

`scripts/prepare-placement-admission-issuer.mjs` closes the cross-host bootstrap
boundary before that service starts. On the issuer host it creates or restores the
same local authority, derives the trust root from canonical policy/root configuration,
and publishes only canonical public trust-root bytes through a no-replace file. The
subject receives that public file; issuer private material never leaves its host.
`scripts/prepare-placement-admission-subject.mjs` independently creates or restores
the subject authority and exports only its canonical public identity. With those two
public files, `scripts/create-placement-admission-ceremony-request.mjs` validates the
root's exact policy digest, generates a fresh 32-byte nonce, binds both normalized
origins/key IDs, and publishes one canonical request no-replace. Neither long-running
service must be started or scraped for identity bootstrap. An existing public output
fails before an unrequested authority is created, and request output is never replaced.

`lab/placement/admission-membership-epoch-ceremony.mjs` closes the next operator
boundary without changing the core epoch format. A coordinator request is derived
only from verified ceremony bundles, the current Capsule, optional exact predecessor,
and the bounded observer policy/window; member evidence and trust roots cannot be
injected through a free-form body. `scripts/create-placement-membership-epoch-request.mjs`
publishes that canonical request no-replace. Every current Capsule custodian can then
use `scripts/approve-placement-membership-epoch.mjs` with its existing local authority.
The CLI rejects output collision and non-custodian identity before private-key use and
signs only the rederived core custody message under its sign-once tuple.
`scripts/finalize-placement-membership-epoch.mjs` verifies the request binding and all
approval sidecars, sorts approvals by key ID, enforces the current custody threshold,
and publishes the existing `mortalos-placement-membership-epoch/1` bytes no-replace.
An insufficient quorum, mixed request, wrong Capsule or predecessor, duplicate signer,
or signature substitution produces no epoch.

`lab/placement/admission-pilot-evidence.mjs` closes the final local public-file replay
boundary without changing any core protocol artifact. A bounded canonical index names
only files under its own public evidence root. The create path verifies each separately
published trust root, subject identity, and request against its exact ceremony bundle;
rederives every membership request from the complete recorded bundle set; verifies
every request-bound current-custodian approval and finalized predecessor chain;
recreates activation from the separately published plan and complete acceptance set;
reruns current-Capsule membership convergence; and verifies all attestations plus the
compact view. It emits a deterministic no-replace
`mortalos-placement-admission-pilot-evidence/1` receipt containing only public artifact
digests and authenticated IDs. Its restorer is self-hash-only and reports
`public_chain_verified:false`; `scripts/verify-placement-admission-pilot-evidence.mjs`
reports true only after recreating exact bytes from every sidecar. Missing or swapped
ceremony input, omitted epoch, self-rehashed receipt substitution, source-commit
disagreement, absolute/parent/symlink path escape, and output reuse reject. The receipt
labels the Git commit `recorded-only`: it prevents index/receipt disagreement but does
not prove clean exact-SHA execution, review, topology, or administrator independence.

`lab/placement/admission-role-execution-receipt.mjs` adds a separate attributable
source claim for role-signed artifacts. Its operator CLI refuses a source-commit/HEAD
mismatch or any tracked, untracked, or submodule dirt before asking the existing
durable role authority to sign the exact artifact digest, authenticated artifact ID,
artifact kind, role, and source commit. The aggregate
`mortalos-placement-admission-pilot-source-attestation/1` independently replays the
public pilot receipt, derives the expected signer and identity for every ceremony role
response, custody approval, plan acceptance, and deployment attestation, and requires
one and only one matching receipt. Reversed receipt input is byte-identical; missing,
duplicate, wrong-key, wrong-artifact, wrong-SHA, and modified-signature inputs reject.
Offline aggregate restore remains sidecar-unverified. Only the full verifier reports
`source_commit_execution_binding:"role-key-attested-artifacts"` and
`receipts_verified:true`.

The signature makes the clean-checkout statement attributable to that role key; it
cannot prove that a dishonest operator used the conforming CLI, that unsigned
coordinator artifacts were built by the same source, or that CI/review/topology and
administrator separation are valid. Those fields therefore remain explicitly
`unproven` and exact-SHA governance remains a separate gate.

`lab/placement/admission-pilot-source-verdict.mjs` removes the need to promote that
remaining execution gap into a new coordinator authority. It first fully verifies the
public chain and every role-source receipt, then creates a sorted digest inventory of
all unsigned protocol artifacts. Trust roots, subject identities, ceremony requests,
membership requests, and the deployment plan are accepted only because later role
signatures endorse their exact content. Ceremony bundles, finalized epochs, plan
activation, current-Capsule membership binding, attestation view, and the pilot receipt
are accepted only because the verifier deterministically recreates or revalidates them
from authenticated sidecars. The Continuity Capsule remains a separately
signature-verified input.

The current fixture closes that inventory at 21 unsigned artifacts: 12
participant-endorsed plus 9 deterministically replayed. Together with 12
role-source artifacts and one authenticated Capsule, the verdict covers 34 distinct
evidence artifacts. A self-hash-only restore reports
`participant_receipts_verified:false`, `public_chain_verified:false`, and
`unsigned_protocol_artifacts_verified:false`; only full recreation reports all three
true and `coordinator_protocol_authority:"not-required-for-verification"`.
`coordinator_execution_binding` remains `unproven`: this is proof that coordinator
trust is unnecessary for verification, not proof of which executable produced bytes.

`lab/placement/admission-pilot-inventory-closure.mjs` adds participant finality without
making the coordinator an authority. Once the source verdict exists, every unique role
key derived from the exact verified execution-receipt set signs its verdict ID and byte
digest together with the pilot evidence ID, source commit, and exact deployment-plan
ID. The durable signature tuple is keyed only by deployment-plan ID. Exact retry is
idempotent, while a different self-hashed verdict for the same plan halts under that
role authority.

The closure verifier recreates the complete source verdict, derives the unique role-key
and role set from its already-bound receipts, verifies exactly one ratification per key,
binds the plan ID back to the pilot evidence, and emits a deterministic signature-free
summary. The current fixture closes 7/7 keys. A 6/7 set produces no closure; reversed
ratification order is canonical; restore alone reports `ratifications_verified:false`
and `source_verdict_verified:false`. Full replay reports
`inventory_closure:"all-role-keys-ratified"` and
`coordinator_protocol_authority:"not-required-for-inventory-closure"`.

This prevents two complete participant-ratified verdicts for one plan when at least one
shared honest role key uses its conforming durable journal. It does not discover an
artifact unknown to every honest participant, prevent copied private keys with
independent journals, or prove administrator, host, network, or physical separation.

Endpoint origin agreement is still a signed declaration, not proof of DNS custody,
administrator separation, network path, region, power domain, or physical topology.
The focused test uses distinct loopback processes and origins; live multi-host use is
the remaining promotion gate.

`scripts/observe-placement-admission-deployment.mjs` is the bounded fresh-verifier
bridge for that gate. It restores the signed bundle, requires both exact origins to be
HTTPS, verifies each live public role/key, and records the platform-trusted TLS peer
certificate/public-key digests and actual socket remote address. The no-replace
artifact is deliberately non-authoritative: its administration and failure-domain
fields are fixed to `unproven`, its time is observer-declared, and offline restore says
only `integrity-verified` with `live_observation_verified:false`. Distinct addresses or
certificates therefore remain facts observed by one process, not topology authority.

## Transport and lineage composition

Membership epochs are content-addressed sidecars. They are not recursively embedded
in liveness messages. Provider-signed liveness policy `/2` contains only the exact
`membership_epoch_id`, optional prior ID, evaluation instant, and deterministic
selection digest in addition to the offer/lease policy fields. The consumer-signed
challenge embeds that compact policy.

This split is mandatory: embedding the full epoch recursively in policy, challenge,
and response exceeded the generated 65,536-byte relay-message ceiling in the first
real multi-action repair attempt. The compact policy, challenge, and certificate now
cross the existing VirtualTransport and actual Chromium carrier without increasing
that ceiling.

Each placement generation stores the sorted unique epoch sidecars once. Every
liveness reference must resolve exactly one supplied sidecar; every supplied sidecar
must be referenced. Generation creation verifies the epoch against the current
Capsule. Commit, action-plan, reconciliation, and repair-effect verification bind the
same epoch to the authenticated historical custody descriptor inside the successor
Capsule. A self-hashed sidecar or opaque ID is not authority.

## Evidence

- `test/placement-admission.test.mjs` covers subject+issuer evidence signatures,
  exact/max+1 challenge bytes, direct root rotation, explicit revocation, cumulative
  history, retired-authority and issuer-key rollback rejection, alias
  deduplication, deterministic operator/domain matching, compact transport messages,
  overlap-safe reconfiguration, sign-once rejection, and deterministic sibling halt.
- `test/placement-admission-ceremony.test.mjs` launches distinct issuer, subject, and
  negative-control processes over bounded loopback HTTP. It proves exact retry,
  root/policy/identity locking, same-challenge conflict rejection, request max+1,
  private-material absence from the coordinator transcript, portable final evidence
  verification, and survival of the subject endpoint after the issuer exits. Its
  durable case additionally races two issuer processes over one authority file,
  proves one winner, restarts issuer and subject, reproduces byte-identical winner
  responses, and keeps the loser rejected.
- `test/placement-admission-signer-session.test.mjs` proves request bytes are owned
  before the signing suspension, a failed private signer releases its slot for exact
  retry, and an accessor-backed signing capability is rejected without invocation.
- `test/placement-admission-external-ceremony.test.mjs` proves partial issuer success
  followed by subject-auth failure is recoverable by exact retry; caller bytes and
  endpoint objects are owned before suspension; post-import `fetch`, `URL`, and stream
  reader poisoning is not invoked; endpoint roles and signed origin/key bindings are
  enforced; redirects/remote plaintext HTTP and oversized streams reject; bundle
  replay is offline and token-free; and an existing output fails before dead endpoints
  are contacted while leaving no pending file. It also proves each role-local CLI uses
  only its own bearer, the offline finalizer ignores poisoned token variables, the
  resulting bundle is byte-identical to the combined path, swapped roles fail, and no
  token enters response, bundle, or transcript bytes.
- `test/placement-admission-signer-service.test.mjs` runs two operator-facing services
  with different authority files, ports, bearer credentials, and exact advertised
  origins. Each service rejects its own `127.0.0.1` to `localhost` alias before key
  use, enforces content-type and max-plus-one body bounds, restarts with the same
  identity, and reproduces the byte-identical ceremony bundle. A separate process race
  locks two conflicting origins against one signer-profile path with exactly one winner;
  the loser and a later alias restart remain rejected while the profile bytes stay exact.

The same signer CLI now offers native HTTPS. Supplying both `--tls-certificate` and
`--tls-private-key` makes the service own bounded copies, require an HTTPS advertised
origin, preflight the certificate/key pair before creating an absent signing authority,
and serve with TLS 1.2 or newer plus a bounded handshake. Supplying only one, an
oversized key, or a mismatched pair fails before authority creation. Readiness exposes
only `listen_protocol` and `tls_enabled`; private TLS and bearer bytes are absent. An
administrator-controlled reverse proxy remains possible by omitting both TLS inputs
and binding the reported HTTP listener privately. The focused native path connects
both role-local clients through validated TLS, finalizes offline, records the actual
peer certificate/public-key digests, restarts both signers, and reproduces both public
role responses byte-for-byte. This is deployable transport custody, not proof that the
test's same-PC administrators or physical domains are independent.
- `test/placement-admission-deployment-observer.test.mjs` creates two distinct TLS test
  roots and native role-local signer endpoints observed by a fresh process. Exact live
  role-key possession, identities, and both
  peer keys verify; the shared loopback address remains explicitly non-distinct. Swapped
  identity, self-rehashed facts/authority, and no-replace retry fail closed. The expanded
  test also creates two durable local observer keys. Each key is the subject of its own
  policy-locked issuer/subject admission service ceremony before one complete-roster
  deployment plan. Each key accepts that exact plan through a ceremony-scoped durable
  sign-once slot, exact retry is byte-identical, a conflicting plan halts, and only the
  complete sorted acceptance set activates the combined probe-before-sign path. A
  deterministic membership binding `/2` then embeds the activation, exact ceremony,
  selected custody-quorum epoch, sorted candidate epoch IDs, and candidate-view
  commitment. It accepts only a complete fork-free candidate chain converging at the
  current Capsule, exact subject evidence, and the selected epoch's full observer
  membership with matching distinct operator/failure-domain IDs. Attestation `/5`
  embeds that binding and view ID through one plan-scoped durable attestation slot. The
  combined CLI hard-links the exact token-free observation before signer use because a
  new TLS connection has another exporter. With both signer endpoints stopped and no
  possession tokens, a fresh process restores that journal and reproduces the exact
  attestation. A different observation or rotated membership view under the same plan halts,
  so an epoch change requires a fresh ceremony and accepted plan. Compact view `/1`
  commits the key-sorted attestation sidecar IDs and derived all-roster summary;
  restore is self-hash-only and explicit verification must reproduce it from every
  exact sidecar. Reversed inputs compare deterministically;
  missing-prior candidate views, raw outsider rosters, wrong Capsule, self-rehashed
  plan/activation/membership candidate
  reorder, signature/key/plan/activation/membership substitution, incomplete
  roster/acceptance, wrong nonce/window, duplicate key/nonce/vantage, and
  shared/sparse/max+1 inputs reject. Membership is admitted under configured lineage and
  issuer policy; supplied times and physical topology remain `unproven`. The same test
  now constructs a two-epoch public pilot index spanning three separate ceremony input
  sets including both role-response sidecars, custodian requests/approvals, plan
  sidecars, current membership, two
  attestations, and the compact view. Direct and fresh-process replay produce identical
  receipt bytes; every ceremony is re-finalized from the two public responses and must
  reproduce the stored bundle exactly; reversed unordered inputs, omitted history,
  swapped ceremony response,
  self-rehashed receipt substitution, source-commit mismatch, path escape, output
  collision, accessor/shared/sparse/max+1 input, and private-material scan fail closed.
- `test/placement-membership-epoch-ceremony.test.mjs` starts three real provider/observer
  HTTP ceremonies, constructs a 2-of-3 current Capsule, and exercises the complete
  request/independent-approval/finalization CLI chain. Output collision and a
  non-custodian leave authority bytes unchanged, one approval cannot finalize, exact
  retry reproduces approval bytes, reversed threshold approvals reproduce epoch bytes,
  mixed-request approvals reject, and conflicting reuse of one epoch tuple halts.
- `test/placement-liveness-policy-child.mjs` reproduces the admitted policy and
  sampled provider response in a fresh process.
- The current native `/2`, journal-recovery, expanded observer deployment and role-
  response-complete public-chain receipt path passes `1/1` in `109,399.7366ms`
  (`109,718.1904ms` runner, exit `0`). The signer-service file passes `4/4` in
  `20,655.0405ms`; adjacent ceremony/session regressions pass `7/7` in
  `10,071.95ms`. The
  unchanged epoch ceremony has focused `1/1` PASS evidence in `12,405.8186ms`.
  The immediately preceding source passed the ordered complete suite with P2P Node
  `70/70` through final `verify:s4`. One same-source ordered run on this delta passed
  every preceding stage and emitted P2P tests through `51` without a failure, but its
  final PTY output/exit receipt was lost after the last worker exited. It is therefore
  retained as historical incomplete evidence. A later receipt-complete predecessor run
  at `4b0ff0d290626318f68e4479d4b35d586a936822` passed all 48 configured stages and
  `458/458` TAP tests through final `verify:s4` with zero failures, cancellations, or
  skips. The current repair-hardening successor passes focused executor `1/1`; its
  complete-suite rerun remains pending.
- The exact multi-action late-response case passes `1/1` in `166,487.7185ms`.
- The exact A-to-B lineage case, including missing/duplicate sidecar rejection and
  current/historical Capsule binding, passes `1/1` in `534,301.6707ms`.
- `scripts/verify-p2p-placement-chromium.mjs` passes with a browser-WebCrypto
  membership epoch and compact policy/challenge/certificate publication while the
  existing WebRTC, origin-cut, and batch checks remain enabled.
- `scripts/verify-sdk-package.mjs` installs a clean package and has an external
  consumer generate distinct Ed25519 subject/issuer keys, sign one canonical
  challenge through the placement subpath, and verify the evidence without Lab code.
- `npm run verify:security-boundaries` passes `26/26` with `22` direct and `145`
  discovered async entrypoints. The admission and liveness sync modules are pinned.

## Explicit nonclaims and next P0

The ceremony processes, operator-facing services, trust-root configuration, operator
IDs, failure-domain IDs, private-key-free HTTP runner, and TLS observation regression
are still launched on one PC by one test coordinator. Process
and key-capability separation is real, but administrative and physical separation is
not. Dual signatures prove subject key control and the issuer's exact assertion;
custody quorum approval makes that assertion lineage policy. None of these operations
makes the issuer or label externally true. The current algorithm gives one logical vote per distinct admitted
operator/domain pair; it does not implement economic or capacity weights.

Therefore this source does **not** prove Sybil resistance, independent
administrators, independent machines/networks/power, arbitrary-NAT reachability, or
provider death/SLA/penalty/settlement. The next P0 is to operate this exact ceremony
under separately administered credentials and measured multi-host topology: distinct
issuer/subject hosts, live challenge transport, and induced failures across separately
administered domains.
Until that evidence exists, logical diversity is useful fail-closed scheduling policy,
not physical independence.
