# Release intent and shared-path scope

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

Status: **TLS-CHANNEL-BOUND ROLE-KEY POSSESSION AND CRASH-RECOVERABLE COMPLETE PUBLIC-CHAIN REPLAY COMPLETE-SUITE PASS; EXACT-SHA EXTERNAL; SEPARATELY ADMINISTERED MULTI-HOST OPERATION NEXT**

### RELEASE INTENT — branch-active, main-historical

On a task branch this declaration is active. On `main` it is historical; exact-SHA
governance and deployment status comes from the PR, required checks, merge record,
post-merge workflows, and deployed asset manifest.

- Branch: `agent/codex-protocol-kernel--lease-bound-liveness-policy`
- Base: `285ccbae01011a7c69e16016dc1bdd1d8d2e1203` (`origin/main` after fresh fetch)
- Worktree: `work/mortalos-worktrees/codex-protocol-kernel--lease-bound-liveness-policy`
- Shared paths declared for this task: `agents/codex-protocol-kernel/`, `docs/`,
  `lab/`, `protocol/`, `scripts/`, `sdk/`, `security/`, `src/`, `test/`,
  `README.md`, and `package.json`.
- The prior uncommitted candidate closed the operator-side membership-epoch gap:
  a public request is derived only from verified ceremony bundles, the current
  Capsule, bounded policy/window, and optional exact predecessor; current custodians
  independently publish request-bound approvals with existing durable authorities;
  threshold finalization produces the existing canonical epoch. The same-PC
  deployment regression now admits each observer through a separate policy-locked
  service ceremony before that same durable key accepts and attests. The ordered
  suite passed P2P Node `70/70` in `3,529,502.2144ms` and reached final `verify:s4`.
  This is local operability evidence only; exact-SHA review and a separately
  administered multi-host run remain pending.
- The current follow-on closes three operator-boundary gaps. Issuer and subject
  administrators invoke role-local clients with only their own admission bearers and
  publish token-free responses; a coordinator with no bearer and no network finalizes
  them. Each signer can terminate native HTTPS with bounded role-local certificate/key
  bytes and exposes a separate possession-only token. Deployment observation `/2`
  challenges the configured role key to sign the same-connection TLS exporter digest,
  so copied identity bytes or captured proofs replayed under the same certificate on a
  new TLS connection reject. Because reconnecting also makes exact retry impossible,
  the combined CLI now hard-links a bounded token-free observation journal before the
  observer sign-once call; with both signer endpoints stopped and no possession tokens,
  a fresh process restores that journal and reproduces the byte-identical attestation.
  The public-chain verifier then recreates every ceremony, membership, deployment,
  attestation, and compact-view sidecar. Current affected integration passes `1/1` in
  `109,399.7366ms` (runner `109,718.1904ms`); signer-service tests pass `4/4` in
  `20,655.0405ms`, adjacent ceremony/session tests pass `7/7` in `10,071.95ms`, and
  async security audit passes `22` direct / `143` discovered surfaces. A prior
  same-source ordered run reached P2P test `51` without failure but lost its final
  PTY/exit receipt and remains incomplete historical evidence. It is superseded by
  the current 48-stage `npm test` receipt: exit `0`, final `verify:s4`, and 30 TAP
  summaries totaling `458/458` with zero failures, cancellations, or skips.
- User-directed scope now includes the smallest effect-time execution slice after the
  lease-bound policy and sampled-response work: one internal shard action re-verifies
  original Capsule/generation/commit plus current placement/liveness evidence, claims
  one durable replacement-independent failure slot, and invokes a private idempotent
  provider session with a replacement-bound effect ID. It does not add multi-action
  scheduling, network gossip, or observer admission/failure-domain authority in that
  slice; the later bounded admission slice is recorded below,
  provider-death/SLA/penalty/settlement claims, or deployment authority.
- The follow-on user-directed slice is limited to completing one already committed
  effect result into exactly one proved successor placement generation. The internal
  coordinator must rederive the effect and signed result from original evidence,
  replace only that failed shard, claim one durable completion slot, and delegate the
  Continuity commit through a private idempotent session. It must not add multi-action
  scheduling, network reconciliation, public SDK authority, or release/deployment
  mutation.
- The current user-directed slice extends that internal-only contract to the smallest
  multi-action vertical. One private evidence session supplies a fresh owned placement/
  liveness snapshot before scheduling, before every provider effect, and immediately
  before completion. The scheduler must preflight the exact committed repair-intent
  set before any provider call, reuse the existing per-shard durable effect slots,
  combine every verified result into one proved successor generation, and claim one
  durable batch-completion slot before a private idempotent Continuity call. Partial
  provider success must be retryable without duplicate calls; a late conflicting
  response must prevent all later provider/Continuity calls. This slice does not add
  transport discovery, a background gossip daemon, provider-session durability outside
  its own idempotency store, admission/failure-domain authority, or deployment mutation.
- The current bounded slice connects that private evidence capability to an existing
  participant transport without promoting transport bytes to authority. A module-owned
  session captures a private baseline reader and range capability, verifies every
  canonical relay frame, advances a monotonic local cursor, and contributes only
  deduplicated `liveness-response` payload bytes to the batch evaluator. It does not
  discover rooms, persist gossip state, accept relay metadata as proof, or widen the
  provider/Continuity capability boundary.
- The current bounded slice closes only cross-process first-provider-execution
  exclusion. One process may win a predecessor/effect-keyed no-replace execution
  claim; losing processes may restore a completed canonical result but must not invoke
  the provider while the claim is unresolved. A winner crash before result publication
  remains fail-closed and unavailable: this slice must not add a timeout, stale-claim
  takeover, or duplicate-effect recovery claim. Governed unresolved-claim recovery and
  connected evidence remains separately constrained by the same fail-closed claim.
- The follow-on bounded slice applies the same safety contract to the private
  Continuity capability. It persists the exact Capsule/generation request and returned
  Capsule/commit bytes, gives one conforming process the first commit call, and lets a
  fresh session restore a completed result without another signing operation. An
  unresolved winner remains fail-closed; no timer or takeover is added.
- The current bounded slice restores availability for an unresolved provider or
  Continuity claim only when an already-authoritative exact result is supplied. The
  outer executor rederives the original effect/successor and verifies the signed
  placement receipt or Capsule/commit before calling a recovery capability that has no
  provider-execution or Continuity-signing method. The recovery adapter requires the
  exact existing request and owner claim, publishes only the matching immutable result
  plus local provenance, and makes `0` duplicate external calls. Invalid or absent
  proof stays fail-closed; no timeout, takeover, or result discovery is added.
- Implemented focused result: provider policy `/1` embeds exact verified offer/lease
  bytes and binds provider, consumer, offer-roster digest, lineage parent, manifest,
  workload, shard, exact next sequence, exact bounded window, and the explicitly
  `storage-merkle-sample/1` response profile. Consumer challenge `/2`
  embeds the exact policy bytes/ID and binds predecessor plus nonce; 3-of-4
  observations form failure certificate `/2`. Legacy challenge/certificate `/1`
  remains parseable but projects `repair_authority:false`, and lineage rejects it as
  `policy-bound-authority-required`. Two valid policies for the same exact tuple halt
  as `policy-fork`.
- Implemented policy and complete-suite evidence: the combined resource execution/process,
  liveness, and SDK run passed `21/21` in `29,184.6727ms`, including liveness `8/8`,
  fresh process, exact policy-byte binding, 1ms injection/window mismatch,
  sampled-proof tamper/shared-memory/fork negatives, and clean SDK import; lineage repair `1/1`
  PASS in `364,882.0793ms`; SDK `5/5` plus clean packed consumer; async security
  `26/26` (`22` direct / `128` discovered); actual Chromium P2P PASS with provider
  deriving the nonce-selected Merkle sample from browser-held stored bytes and signing
  response `/2` using its non-extractable key, plus origin cut and existing transport/
  repair gates. Uninterrupted `npm test` passed from
  `2026-08-21T15:08:09.9777152+09:00` through
  `2026-08-21T17:12:46.1993423+09:00`, exit `0`, in `7,476,222ms`, reaching final
  `verify:s4`; exact-head review/CI, merge, deployment, and public readback remain external.
- Focused executor evidence: Node `test/placement-repair-executor.test.mjs` passes
  same-effect concurrency, exact retry, different replacement, already-repaired,
  forged Capsule, late response, and child-process termination after provider storage
  before local result commit. The actual origin-cut Chromium vertical supplies a valid
  delayed response for zero calls, then executes shard 0 once and verifies exact retry
  calls the provider zero additional times while the existing generation-129/384-chain
  corpus still passes. Security inventory is now `22` direct / `130` discovered
  after adding the completion entrypoint classification.
- Focused completion evidence: the same Node test passes one completion call under
  concurrency, exact zero-call retry, different-candidate/forged/late-response/
  superseded zero-call rejection, and commit-then-failure recovery with one signing
  operation in `700,895.2506ms` body time (`701,056.7907ms` runner). The origin-cut
  Chromium vertical completes the signed shard-0 result into proved generation 2
  exactly once, retries without another Continuity call, and preserves the 127-cycle
  generation-129/384-chain corpus (`1,596,239ms` dynamic segment).
- Focused transport-backed batch evidence: the final late-response target passes in
  `109,791.7103ms`. Provider 0 publishes a canonical `liveness-response` artifact to
  `VirtualTransportNetwork`; the session verifies the range, deduplicates the exact
  payload, and the next effect-time read stops with provider calls `[1,0]` and
  Continuity calls `0`; two differently wrapped frames with the same response payload
  deduplicate and a non-response artifact is ignored. The independent
  provider-interruption/concurrent-restart
  target passes in `533,175.9844ms`: shard 0 remains one call, interrupted shard 1
  advances from one failed call to one successful retry, reversed concurrent action
  lists converge on one completion, and Continuity remains `1`. Security inventory
  passed `26/26` with `22` direct / `132` discovered before the durable provider
  session entrypoint was added; the current inventory is `22` direct / `134`
  discovered.
- Focused provider-domain restart evidence: `test/placement-repair-executor.test.mjs`
  passes `1/1` in `698,797.1523ms` body time (`698,964.4042ms` runner). A fresh child
  commits the exact canonical provider request/result, exits `86` before the executor
  can commit its own result, and a new parent session restores the placement with
  exactly `0` calls to the captured underlying provider. Exact executor retry remains
  `already-committed` with `0` underlying calls. This target proves sequential restart;
  the following direct durable-session gate separately proves cross-process exclusion.
- Focused cross-process exclusion evidence: `test/durable-repair-provider-session.test.mjs`
  passes `2/2` in `968.7452ms`. Two released child processes share one session
  directory and effect; exactly one provider side-effect file is created, while the
  loser either restores the completed result or rejects `E_PLACEMENT_PROVIDER_SESSION_CLAIMED`.
  A separate winner exits `87` after the side effect but before result publication;
  the restarted session rejects the unresolved claim and invokes the provider `0`
  times. The existing executor integration remains `1/1` PASS in `636,460.3782ms`.
- Focused Continuity durability evidence: `test/durable-repair-continuity-session.test.mjs`
  passes `2/2` in `1,191.3289ms`. Two processes race one exact completion and create
  one commit side effect; completed result restart calls the underlying Continuity
  capability `0` times. A winner exit `88` before result publication leaves a durable
  unresolved claim and restart also calls the capability `0` times. The signed
  executor integration passes `1/1` in `632,431.3446ms`: one signing operation is
  durably restored after outer completion failure, and exact retry performs no new call.
- Focused proof-import recovery evidence: the provider and Continuity direct session
  tests pass `4/4` in `504.1263ms`. Crash exits `87`/`88` leave exact unresolved
  claims; invalid signed placement/commit proof is rejected before publication, while
  valid proof imports the exact result and restarted sessions invoke the underlying
  provider/Continuity capability `0` times. The full signed executor integration
  passes `1/1` in `912,102.634ms` body time (`912,307.6841ms` runner). Async security
  passes `26/26` with `22` direct / `135` discovered entrypoints.
- Connected-range focused evidence: the full Node batch file passes `2/2` in
  `755,752.0478ms`. The actual origin-cut Chromium pair publishes one response twice,
  rewraps the same payload under another message ID, and publishes a non-response
  artifact. Its receiver range is exactly sequences `[1,2,3]`; the duplicate creates
  no frame, the rewrapped payload contributes one response, and the challenge is
  ignored. A late response after provider 0 leaves calls `[1,0]` and Continuity `0`.
  Reconnecting the pair and disconnecting before the next range read also leaves all
  later calls at zero. Security remains `26/26`, `22` direct / `135` discovered.
- Schedule-corpus focused evidence: `test/placement-repair-schedule.test.mjs` runs
  `10,000` signed-evidence schedules with eight deterministic events each in Node and
  a separately generated fresh process; canonical results match in `733,588.2114ms`.
  A separately bundled Chromium run matches the committed digest
  `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM`. Verdicts are `2749` completed,
  `2489` liveness-halted, `2044` order-halted, and `2718` partition-unavailable;
  duplicate provider, accounting, and Continuity effect counters are all `0`.
  Every seed instantiates the production `PlacementNetworkEvidenceSession` over actual
  signed response/certificate bytes. The effect ledger is a deterministic schedule
  oracle anchored by the full executor and actual DataChannel focused cases; it does
  not claim 10,000 external provider writes or 10,000 live network trials.
- Lineage-governed logical admission is now focused PASS. `src/placement/admission.mjs`
  verifies subject+issuer dual-signed challenge evidence, custody-signed membership
  epochs, direct root rotation, explicit revocation, cumulative root/issuer-key
  history, retired-authority resurrection rejection, deterministic
  operator/domain-deduplicated rosters, adjacent-epoch quorum intersection, and
  sibling halt. Generation documents carry exact content-addressed membership
  sidecars; compact admitted liveness policy `/2` references their IDs/digest rather
  than nesting them into relay artifacts. Missing, duplicate, extraneous, or
  history-mismatched sidecars fail closed.
- The policy-locked ceremony in `lab/placement/admission-signer-session.mjs` keeps
  issuer and subject keys in distinct child processes, accepts no arbitrary signing
  message, and checks one exact root, policy, local identity, and sign-once challenge
  slot before using its captured private signer. The coordinator transcript is public
  identity/root/request/signature material only. Wrong root/policy/identity/token,
  conflict, and max+1 reject; issuer exit does not remove the subject endpoint.
  Optional local Node-authority custody additionally persists both identities and the
  deterministic sign-once tuple. Two issuer processes racing different evidence have
  one winner; after issuer/subject restart the winner responses are byte-identical and
  both loser requests remain equivocation.
- `scripts/prepare-placement-admission-issuer.mjs` now creates or restores the issuer's
  host-local authority and publishes only a canonical public trust root no-replace.
  `scripts/prepare-placement-admission-subject.mjs` independently creates or restores
  the subject authority and publishes only its canonical public identity. Existing
  outputs reject before an unrequested authority is created.
  `scripts/create-placement-admission-ceremony-request.mjs` verifies the exact policy
  digest, generates the 32-byte nonce, binds both public identities/origins and the
  bounded interval, and publishes the canonical request no-replace before either
  service starts. No long-running readiness stream or private authority is required
  for bootstrap; focused signer-service evidence passes `3/3`, and the HTTPS
  ceremony-to-observer path passes `1/1` using this exact sequence.
- Current-source validation for that bootstrap delta is complete. Focused signer
  service passes `3/3` in `4,052.6003ms`; focused HTTPS ceremony-to-observer passes
  `1/1` in `47,987.2761ms`. Ordered `npm test` ran from
  `2026-08-22T00:10:31.9611979+09:00` through
  `2026-08-22T02:21:20.3185492+09:00`, exited zero in `7,848.357s`, reached final
  `verify:s4`, and included P2P Node `69/69` in `3,452,293.3145ms`. Only evidence
  documents changed after that run; current docs are covered by separate static gates.
- The private-key-free endpoint runner now constructs both identity and signature
  Requests before suspension, bounds and verifies endpoint responses, requires both
  signers to approve an explicit origin/key binding inside challenge `/2`, and publishes one
  token-free no-replace offline replay bundle. Existing output fails before network
  access; partial issuer success recovers on exact retry. Each operator-facing signer
  service locks its own configured advertised origin before private-key use, holds its
  bearer only in an environment variable, enforces bounded HTTP semantics, and uses a
  separate durable authority file. A second no-replace signer-profile file binds that
  identity, role, root, policy, and origin across restart; a conflicting origin race has
  one durable winner and the loser cannot relaunch the authority under an alias. Exact
  restart reproduces the same bundle. Current executable endpoints are loopback, so this
  is not independent-host evidence.
- The fresh deployment observer restores that signed bundle in a separate process,
  requires both origins to be HTTPS, matches live role/key responses, and records the
  process-trusted peer certificate/public-key digests and socket addresses. Its
  no-replace artifact fixes `non_authority:true`, both independence verdicts to
  `unproven`, and offline restore to `live_observation_verified:false`. The focused TLS
  endpoints have distinct origins/certificates/keys but one shared loopback address, so
  the result cannot be mistaken for a topology promotion.
- `lab/placement/admission-deployment-plan.mjs` now content-addresses one ceremony,
  bounded logical window/timeout, and a canonical complete `2..8` observer roster with
  one unique nonce and declared administration/failure-domain/vantage digest set per
  key. Each observer host can use
  `scripts/prepare-placement-admission-deployment-observer.mjs` to create or restore
  its durable authority and publish only canonical public identity bytes no-replace;
  the coordinator collects those public files without receiving observer private
  material. The public plan CLI publishes the complete plan no-replace. Every roster
  key then signs acceptance `/1` with a ceremony-scoped durable sign-once tuple; exact
  retry reproduces the same bytes and a different plan halts. The complete sorted set
  produces activation `/1`. `lab/placement/admission-deployment-plan-membership.mjs`
  and its no-replace CLI then embed that activation, exact ceremony, selected custody-
  quorum epoch, sorted candidate epoch IDs, and candidate-view commitment. Creation owns
  all supplied epoch sidecars, requires a complete fork-free chain converging at the
  current Capsule, and rejects missing prior/current, sibling, cyclic, unsafe, or
  extraneous views before checking exact subject evidence, the selected epoch's complete
  `2..8` observer membership, identity/operator/failure-domain matches, pairwise distinct
  roots/domains, and plan window. Attestation `/5` wraps the exact binding, candidate-view
  ID, and observation under the observer signature. Its durable tuple is scoped to the
  accepted plan: exact retry is byte-identical only from the exact no-replace observation
  journal, while another connection/view/observation/instant halts,
  and ceremony-scoped acceptance means epoch rotation requires a fresh ceremony and
  accepted plan. The combined CLI re-verifies the same
  supplied candidate view before endpoint contact, derives nonce, timeout,
  and declarations only from the admitted entry, finishes the HTTPS probe, hard-links
  its token-free observation journal, then uses its durable key. That journal permits an
  offline fresh-process retry after both role signers stop. The view requires the entire membership-bound roster; epoch/membership/
  plan/observer/nonce/observation/vantage/activation substitution rejects. Membership is
  configured-policy authority; topology verdicts stay `unproven`. Compact attestation-
  view `/1` records only key-sorted sidecar IDs and the derived all-roster summary.
  Offline restore reports `attestations_verified:false`; the explicit verifier and
  read-only CLI require all exact sidecars and reproduce byte-identical manifest bytes.
- Current focused evidence for the membership-bound ceremony/deployment path is `1/1`
  PASS in `46,573.5002ms`. It uses two
  fresh durable local observer authority files, exports only their canonical public
  identities, proves an existing identity output blocks creation of an unrequested
  third authority, reverses acceptance and view order byte-deterministically, proves
  exact acceptance retry, rejects a second plan for the same ceremony/key, and rejects
  mixed/incomplete/duplicate acceptance, a raw disjoint outsider roster, wrong Capsule,
  missing-prior candidate view, a third-epoch same-plan signing conflict with exact
  original retry before and after rejection, self-rehashed observer/candidate reorder, signature/key
  swaps, fresh-process view create/verify, self-rehashed manifest substitution, compact
  no-signature output, no-replace publication, duplicate observer/vantage,
  accessor/shared/sparse/max+1 input, Capsule/
  membership/candidate/observation post-call mutation, and output
  reuse. Async security passes `26/26`, `22` direct / `141` discovered. A fresh ordered
  complete suite including this observer-attestation delta reached final `verify:s4`;
  post-run evidence docs pass separate static gates.
- The fresh suite call was issued at `2026-08-21T20:48:19.650+09:00` and emitted its
  final S4 PASS at `2026-08-21T23:11:26.544+09:00`. The wrapper did not emit an exact
  wall-time marker. The observer file passed in `59,251.0818ms` under the integrated
  run; the full P2P Node group passed `68/68` in `3,894,776.8885ms`; actual Chromium
  P2P/WebRTC and confidential 127-cycle history, the signed ceiling/+1 corpus,
  10,000-schedule parity, package/relay/browser/Lab, and S0-S4 all completed.
- Pre-attestation focused evidence: deployment observer plus signer-profile/service,
  ceremony/admission/liveness/profile/SDK `31/31` in `33,492.5431ms`; the batch
  late-response case `1/1` in
  `166,487.7185ms`; the main
  lineage case including missing/duplicate sidecar negatives `1/1` in
  `534,301.6707ms`; packed SDK PASS; actual Chromium P2P/admission/repair PASS;
  security then covered `22` direct / `138` discovered. The later local complete suite
  passes; exact-SHA release gates remain pending.
- Earlier complete-suite attempts established that unbounded Node test-file fan-out
  made the signed journal ceiling contend with batch/executor/schedule CPU corpora.
  Bounding concurrency to `2` passed the then-current heavy group, but fresh detached
  exact-SHA execution exposed insufficient variance margin: commit `894661b1...`
  reached P2P Node `70` pass / `2` timeout cancellations with zero assertion failures.
  Executor exceeded `1,500,000ms`; schedule exceeded `900,000ms` by `55.4977ms`.
  A subsequent serial run reproduced executor timeout at `1,538,640.1267ms` while
  schedule passed in `846,722.895ms`, proving that serialization alone was necessary
  but insufficient. `test:p2p-placement` now uses test-file concurrency `1`; executor
  and schedule budgets are `2,000,000ms` and `1,200,000ms`, while batch interruption
  remains `1,200,000ms`. The unchanged executor and `10,000 × 8` schedule corpora then
  pass serially `2/2` in `2,178,485.7704ms` (`1,345,547.9513ms` and
  `832,008.0928ms`) with zero failures, cancellations, or skips. A fresh complete
  suite on the successor exact SHA remains required.
- Remaining next P0 is preparing separately custodied observer identities at their
  respective hosts, collecting only their public files, publishing one exact plan,
  collecting every ceremony-scoped acceptance, activating that one plan, and binding it
  to the exact current membership epoch, then operating these exact signer services and every assigned combined
  observe-and-attest process under separately administered credentials, durable
  observer keys, and measured independent topology. The current ceremony
  is one-PC loopback and the connected path is a manually signaled,
  same-host direct WebRTC pair, not a relay-service, background gossip/discovery,
  arbitrary-NAT, or independent-failure-domain claim. Response
  `/2` is a self-contained challenged leaf/path sample without a fresh consumer receipt;
  receipt-pointer `/1` is compatibility-only. Neither sample nor policy agreement is
  full/continuous custody, death, breach, SLA, penalty, settlement, honest-timer,
  externally verified issuer evidence, independent-topology, or Sybil evidence.
- The completed bounded implementation slice uses shared paths `lab/placement/`, `scripts/`,
  `test/`, `security/`, `docs/`, `README.md`, and `package.json` to add a private-key-
  free external ceremony client/CLI, origin-locked signer service/CLI, and fresh HTTPS
  deployment observer/CLI. It may discover public issuer/subject
  identities, submit only canonical bounded admission requests, verify the resulting
  dual-signed evidence, and emit a canonical replay bundle. Endpoint origins and
  locally observed transport metadata remain observations rather than admission or
  failure-domain authority. The slice must not deploy services, embed bearer tokens,
  infer independent administration/topology, or promote an availability claim. The
  remaining action is running that exact contract with separately controlled live
  services and preserving the resulting bundle plus operational measurements.
- Governance-document scope now includes the active reviewer identity contract:
  logical reviewer COMMENT/receipt, GitHub App ID `4456370` exact-head attestation,
  and machine user `ant713900-web` native latest-head approval are distinct required
  gates and cannot substitute for one another.
- User-directed scope expands this agent role to implement real browser P2P
  transport plus the storage-first placement/repair vertical. The implementation
  must reuse existing offer, lease, challenge, usage, execution-receipt, and
  continuity contracts; it must not make discovery, signaling, relay, UI, or a
  fixed backend a validity authority.
- Placement is usable only after exact-lease storage execution evaluates to
  `proved`. Provider loss invalidates availability and repair requires a new
  provider offer and a new mutual lease while preserving content/workload identity.
- Required evidence includes Node process loss/repair, actual Chromium peer data
  channels with origin/relay cut after bootstrap, Lab parity, packed-consumer
  operation, corrupt/single/stale/fork/cross-lease/revoked/exhausted/duplicate-
  provider rejection, and explicit physical-independence HOLD.
- Exact head `e0148aa2...` completed the pre-stateful-corpus ordered `npm test` in
  `4,304.1s` (`71m 44s`), but review `4893915817` BLOCKed that head. A later
  `7,065.8s` (`117m 45.8s`) uninterrupted full-suite PASS closed the former
  stateful-100 source only. Both results predate the exact generated-ceiling tests
  now in the working source and therefore do not promote it.
- The preceding Node exact-ceiling test passed 128 sequential signed transitions and
  381 genuine provider replacements in `2,841,685.4279ms` test-body time
  (`2,842,481.1467ms` runner; `2,842,596ms` shell). Generation 129 contains exactly
  384 provider/lease/chain high-waters (`128/128/128` by shard) and 387 distinct
  execution receipts. A signed, proved generation-130 `3/3` candidate then fails
  commit at the 385th total/129th shard-0 chain without changing the exact ceiling
  bytes. The test tree was fully absent at `2026-08-11 00:05:11.662+09:00`.
- The preceding mixed-runtime Chromium/Lab exact-ceiling test passed 127 cycles from
  generation 2 to generation 129 in `2,549,195ms` dynamic time (`2,666,619ms`
  total), with the same 384 high-waters (`128/128/128`), 384 provider/lease/chain
  identities, and 387 receipts. Actual browser-held non-extractable keys signed the
  storage evidence and a valid generation-130 `3/3` candidate; its plus-one commit
  failed without changing bytes. Serialized reload rejected the oldest receipt
  replay, private material remained unexposed, and the network cut observed no
  requests. The first focused attempt failed after `84,073ms` on a test-only
  `chain_id` aggregation assertion; the corrected aggregation passed. The browser
  tree was fully absent at `2026-08-11 00:54:04.267+09:00`.
- The former `2,700,000ms` Chromium guard had only 5.59% focused headroom, so the
  current test-only guard is `3,300,000ms`. Workflow ceilings remain 240 minutes and
  no gate was removed or skipped.
- A fresh uninterrupted `npm test` over the then-current runtime/test/workflow source
  bytes started at
  `2026-08-11 01:06:58.716+09:00`, ended at `03:21:35.542+09:00`, and exited `0`
  after `8,076,826ms` (`8,076.826s`; `134m 36.826s`). It completed the Node exact-
  ceiling path, the mixed-runtime Chromium exact-ceiling path, every later ordered
  gate, and final `verify:s4`. PID `23824` was absent at
  `03:24:59.475+09:00`; a fresh probe at `03:26:01.147+09:00` also found that root
  absent and zero other matching MortalOS test workloads after excluding the probe
  itself. That run predates the current WebRTC runtime/test/security remediation and
  is historical rather than current-candidate full-suite evidence.
- An independent exact-snapshot audit of head
  `a2210f1958080067b021a9c75336645f718c7427`
  correctly BLOCKed two remaining transport resource-lifecycle defects: the private
  transcript had neither the generated 512-unique-message nor 8,388,608-decoded-raw-
  byte ceiling, and a remote DataChannel close set public state to closed while
  stranding the still-live RTCPeerConnection. No GitHub review, PASS receipt, App
  attestation, native approval, merge, or deployment follows from that head.
- The replacement uses one combined inbound/outbound count/byte budget. Exact
  duplicates consume neither budget; outbound capacity rejects before native send
  and state commits only after send success; inbound overflow mutates no transcript,
  subscriber, or dedupe state before fail-close. `VirtualTransportNetwork` applies
  the same exact decoded-byte ceiling. The relay edge can conservatively overcount
  base64 and reject slightly earlier, so byte-identical accounting is not claimed.
  Local/remote close and error paths converge through idempotent cleanup with each
  captured native close capability invoked at most once.
- The current focused Node gate passes `24/24` and includes literal message/byte
  cap-plus-one, combined-direction, duplicate, failure-atomicity, cleanup, `Error`
  constructor, and `Symbol.hasInstance` poison cases. The actual Chromium probe covers
  literal outbound/inbound boundaries and remote-channel/native-peer cleanup.
- The frozen runtime/test/workflow candidate then passed a fresh uninterrupted hidden-
  wrapper `npm test` from `2026-08-11T06:42:38.6738575+09:00` through
  `2026-08-11T09:06:30.4636057+09:00`, exit `0`, wall `8,631,790ms`
  (`143m 51.790s`), through final `verify:s4`. Covered source/runtime/test/workflow
  files remained unchanged after the run. A post-run process inventory found zero
  related workloads after excluding the probe itself. Docs changed only to record
  this evidence and separately pass spec/link/diff, so this is not a whole-current-
  tree exact full-suite claim. Exact-head CI, immutable review, merge, deployment,
  and promotion remain pending/external.
- The confidential controller is implemented locally: S4 package 2-of-3 shards,
  shard/provider/workload identity binding, exact proof-age boundary, crash-safe
  journal-v2 reproof contexts bound to the exact prior head and epoch, cumulative
  receipt-chain high-waters, an active distinct-provider `3/3` head barrier, and
  predecessor-keyed hard-link successor CAS. V1 is migration metadata only and needs
  a fresh rotated-epoch reproof. Deterministic repair and new leases use a separately
  generated successor-authorized operational signer after A exits; that signer is
  not cryptographically bound to B's Continuity custody identity.
- The lineage-bound source revision adds canonical placement generations, revalidates
  nested public evidence, and commits only through the current Continuity
  descriptor's required quorum. `deriveCommittedPlacementActionPlan` returns
  `mortalos-lineage-placement-action-plan/1` with `planned_repair_actions`,
  `verified_placement_receipt_ids`, `non_capability: true`, and
  `requires_executor_reverification: true`. It is forgeable derived data, not
  authority; an executor must revalidate the original and current evidence. Valid
  same-generation forks halt. A→B transfers no private key and B commits the
  repaired successor after A exits.
- The liveness source revision removes raw unavailable-provider input from lineage
  generation. The provider-signed offer fixes the observer roster; a consumer-signed
  predecessor/sequence challenge and exact 3-of-4 local-duration observations form
  the only repair certificate. Challenge, observations, responses, and certificate
  are bounded untrusted WebRTC artifacts.
- A late provider response is accepted for reconciliation only when its named
  receipt is the current fully verified offer/lease/usage/execution chain. It then
  conflicts with the certificate and conditionally halts plan derivation when a
  caller supplies that response and the current placement chain. The one-shard
  Lab/browser executor supplies both immediately before effect. The internal Node
  batch re-reads a private evidence session between actions, but has no transport
  gossip adapter. Challenge fork, response fork,
  offer-roster mismatch, stale lineage/manifest, and raw timeout input also fail
  closed.
- Historical note: the preceding `/1` challenge let the consumer select the window.
  Current policy `/1` makes the exact provider sign that duration and current
  challenge `/2` makes the consumer accept the exact policy bytes. Certificates are
  still continuity-scheduling transcripts, not provider death, breach, lease-
  termination, penalty, or settlement evidence.
- Independent pre-publication review reproduced and closed three core blockers:
  a rogue challenge signer different from the verified lease consumer, a stale
  prior generation that rewound generation numbering, and collection-primordial
  drift that could miscount duplicate observers. The core now binds the full
  consumer identity, requires the latest placement predecessor, fails closed on
  realm drift, and directly inventories the async commit ownership boundary.
- PR #58's first immutable review at exact head
  `1c559843c6af8300d744629215050c3fbd4d4781` correctly BLOCKed four additional
  issues despite green policy and Verify checks: the implementation-plan NEXT header
  contradicted its A-then-B body, this HANDOFF omitted `protocol/`, WebRTC returned
  aliases of mutable internal frames, and commit/verification accepted repeated
  generation numbering under a current predecessor. The replacement source aligns
  both SSOT records, owns immutable internal frames and returns detached frozen
  copies, and rederives exact consecutive generation sequence from authenticated
  Capsule history. Exact-head CI and fresh independent re-review remain external
  evidence and are not inferred here.
- PR #58's replacement review at exact head
  `b282e0d3be74c0d8480c038199b5ebc960166e8d` confirmed all four prior closures but
  correctly BLOCKed a new send-failure atomicity issue: local frame/dedupe state was
  committed before `DataChannel.send()`, so a transient failure became a ghost
  duplicate that could never reach its peer. Publication now sends first and commits
  local state only on success; a focused regression proves zero failed-send
  visibility, one real retry, later idempotence, and no close/backpressure ghosts.
  Replacement exact-head CI and another fresh immutable review remain external.
- PR #58's third immutable review at exact head
  `dcdd02d0c88015fc867381cb97b07215a8d7e429` confirmed every earlier closure and
  exact-head policy/Verify success, then correctly BLOCKed the remaining mutable
  capability boundary: private transcript, duplicate, range, replay, scheduling,
  signaling, and attached-send behavior still called ambient `Map`/`Set`/`Array`/
  iterator/scheduler/channel operations. The source now uses one captured private
  transcript SSOT, snapshots or native-captures DataChannel and RTCPeerConnection
  capabilities, and has isolated Node plus actual connected-Chromium poison gates.
  Fresh exact-head CI and a fourth independent review remain external facts.
- PR #58's fourth immutable review at exact head
  `8a3f285edf3e1056d4f78097b5cb5bc0ae065043` correctly reproduced a transitive
  decoder escape despite the captured WebRTC-local capabilities: selectively
  replacing `Set.prototype.has` admitted the forbidden `verdict` artifact and
  committed it on both actual Chromium peers. The relay decoder now invokes the
  captured Set operation. Isolated Node and connected-Chromium regressions require
  zero verdict send/local/remote visibility while an allowed `challenge` still
  crosses both peers once, and the security verifier pins the exact decoder import,
  function, and module used by `publish`. This evidence is deliberately limited to
  that named transitive dependency. The same replacement source closes review
  `4892650018`'s confidential-placement time-split blocker: resource-contract status
  and receipt freshness now use the same canonical generation `evaluated_at_ms`.
  A historical placement `observed_at_ms` cannot prolong an expired or effectively
  revoked lease; exact direct and lineage regressions cover `1500/8900/9000` expiry
  and `1500/1700/1800` revocation. Fresh exact-head CI and another immutable review
  remain external facts.
- `origin/main` was freshly fetched at
  `25de18d8c1af8b3dfcb5adffb1a07538afa33332`; it equals this task base. Deployment
  credentials remain workflow-owned and never enter this source tree.
- Focused lineage Node, adversarial sibling, fresh-process determinism, actual
  Chromium origin-cut A→B handoff/repair/commit, SDK/package, Lab build, async
  security, liveness, and actual Chromium gates pass. The final ordered `npm test`
  completed on the pre-review liveness-hardened source in `4,263.6s`; it reached the
  final S4 receipt gate after every prior `&&` stage passed. Focused remediation
  gates cover rogue consumer, stale/superseded prior, realm drift, and async
  ownership. The policy/window slice is now implemented; the next architectural P0
  is an effect-time exactly-once executor; sampled response `/2` is implemented.
  Lineage-governed admission/failure-domain accounting follows; provider-fair SLA
  and absolute Sybil resistance remain unclaimed.
- PR #58's fifth immutable review at exact head
  `775d4dbfdb48985c31018a78bf7a80459ad4d8ed` confirmed every prior closure and
  exact-head policy/Verify success, then correctly BLOCKed two deeper provenance
  errors in review `4892815258`: an evaluation-shaped object or raw self-hashed
  journal could omit every replay barrier, and convergence could select historical
  generation 2 even when a supplied verified Capsule already authenticated
  generation 3. The replacement source acquires recognized records, dense arrays,
  and byte views as owned inert data, uses captured array/collection/WeakMap
  operations, rechecks the runtime after hostile acquisition and nested validation,
  and only then brands the evaluator result. Selective `Array.prototype.map`,
  Proxy-array method, accessor, and collection poisoning cannot fabricate that
  provenance. It requires a complete distinct-provider `3/3` receipt barrier
  including stale/unavailable evidence, rederives the journal inside
  durable commit, and rejects raw/empty/partial/self-hashed incomplete documents at
  restore/load. A subsequent independent pre-commit attack showed that ambient
  `Array.prototype.map` could self-restore while hiding the newest existing pointer
  from the loader. The replacement loader checks realm integrity at entry and after
  filesystem reads, snapshots the directory listing, uses captured parsing and a
  bounded order-independent latest-generation/fork scan, rejects the poison without
  invoking it, and still ignores a superseded historical fork when a unique later
  generation exists. Convergence retains every supplied Capsule's authenticated latest
  placement tip and halts an unrepresented tail as `incomplete-chain`, while valid
  historical prefixes and deterministic input ordering remain supported. A hidden
  newer Capsule and hostile local-disk replacement remain explicit nonclaims. Fresh
  exact-head CI and immutable re-review are external facts and are not inferred here.
- The journal-v1 provenance repair above was necessary but not sufficient for
  cumulative anti-replay. Current journal v2 gives each predecessor exactly one
  immutable reproof-context intent, binding prior journal ID, next generation,
  manifest/policy, epoch parent, and a 256-bit epoch nonce. Storage challenge nonces
  are derived from that context plus chain identity, sequence, and predecessor.
  Only a module-private branded active shards-0/1/2 distinct-provider `3/3` can form
  a head. `receipt_high_waters` accumulates every committed chain in the epoch, so
  replacing A/B/C with D/E/F does not erase A/B/C replay barriers; a known chain
  must advance exactly once while a new chain starts at sequence zero.
- `beginConfidentialPlacementReproof` and `commitConfidentialPlacementJournal`
  rederive the current linked head and use separate predecessor-keyed no-replace
  hard-link claims for intent and successor. Immutable context, journal, and
  transition files are fsynced before the link linearization point. V1 load remains
  unavailable, continuation without rotation fails, and migration commits only
  after a fresh context-bound `3/3` set. All visible v1 anchors are checked for a v2
  successor; a late v1 pointer competing with the migrated anchor halts as a root
  fork. Caps are profile-generated: 2 MiB document,
  4,096 head transitions, 128 high-waters per shard, 384 total, 32-byte epoch nonce,
  and 16-byte derived reproof nonce; no pruning is an authorization path.
- Primary focused gates are the journal-v2 exact-ceiling Node test, the durable
  controller-v2/CAS test, and the mixed-runtime Chromium/Lab vertical. The four-case
  placement-policy corpus is supplementary evidence. Independent review `4893915817`
  blocked exact head `e0148aa2...`
  because its frozen PR body still described the pre-v2 scope and because the then-
  named 100-cycle policy test only re-counted four cached evaluations while review
  `4893187627` required at least 100 stateful provider replacements in Node and
  actual Chromium/Lab. This source replaces that cached claim with 128 sequential
  signed prior-head-bound transitions and 381 genuine replacements in the Node
  portable-kernel gate, plus a separate 127-cycle mixed-runtime path from generation
  2 to the same generation-129 generated ceiling. In the latter, actual Chromium/Lab provider pages
  hold non-extractable keys and create storage results/signatures while the portable
  journal controller is orchestrated in Node; independently in-browser journal-kernel
  parity remains unclaimed. Every step rejects displaced receipts, creates one fresh
  provider/offer/lease chain, advances two exact receipt predecessors, and commits a
  new `3/3` journal. Both focused paths reach 384 cumulative chains, exactly 128 per
  shard, then prove a signed `3/3` generation-130 candidate before its one-new-chain
  commit fails closed and leaves generation-129 bytes unchanged. The focused Node
  and mixed-runtime Chromium/Lab gates pass locally. The historical `7,065.8s` full
  suite predates these ceiling tests; the later uninterrupted `8,076.826s` suite
  predates the WebRTC remediation and is historical. The merged base passes the
  uninterrupted `8,631,790ms` suite through final `verify:s4`. The liveness-policy
  delta now also passes uninterrupted `npm test` in `7,476,222ms` through final
  `verify:s4`; external exact-head governance remains pending.
- Two earlier uninterrupted full-suite attempts on the stateful-100 source are
  retained as failure evidence, not PASS. The first reached the relay gate after
  `6,167s` and exposed a
  minute-boundary race in the historical test harness; the production relay remained
  unchanged, and the repaired runtime passed 20 consecutive runs plus complete
  `test:relay`. The second stopped after `6,122.7s` inside the mixed-runtime Chromium
  segment when its `1,800,000ms` internal deadline expired after 75/100 progress.
  The focused segment had consumed `1,776,198ms`, leaving only `23,802ms` (`1.32%`)
  headroom. Its bounded deadline was then `2,700,000ms`; the sequential 100 steps and
  every final invariant remain unchanged. The third `7,065.8s` run completed within
  that guard and superseded the two historical local HOLDs for that older source
  without erasing them. It is pre-ceiling evidence and does not transfer to the
  current source.
- The exact-ceiling Chromium path later passed in `2,549,195ms` dynamic time
  (`2,666,619ms` total); the deadline-wrapped dynamic segment consumed 94.41% of the
  `2,700,000ms` guard. The test-only guard is therefore now bounded at
  `3,300,000ms`; its 127 cycles and every final assertion remain unchanged.
- The protocol and deploy workflow maximum is 240 minutes so the new cryptographic
  stateful corpus can finish on shared runners. No test, browser vertical, audit,
  coverage check, or deployment verification is skipped or weakened; the tradeoff
  is a larger bounded runner cost and longer delayed-failure window.
- The v2 artifacts remain unsigned local crash-policy evidence. A
  conforming same-filesystem hard-link winner does not prove hostile-disk integrity,
  receipt history hidden from every supplied head, cross-host consensus, or global
  currentness. Crash-left pending files are ignored, but bounded cleanup and sudden-
  power-loss durability remain HOLD. The policy/window, sampled-response, and
  one-shard executor, single-result successor completion, and internal multi-action
  fresh-evidence batch slices are implemented. Exact proof-import recovery now fills an
  unresolved provider/Continuity result only after outer signed-result verification,
  with no duplicate external call. Connected direct-DataChannel evidence, bounded
  schedules, and lineage-governed logical admission/failure-domain accounting are now
  implemented locally. The remaining next P0 is operating the exact ceremony and
  observer-attestation lifecycle under separately administered multi-host custody and
  induced-failure measurement; another same-PC adapter cannot prove that boundary.

### HISTORICAL CONTEXT — Receipt-gated participant placement and repair

- The lease-bound execution vertical is merged by PR #56 at
  `0779741402244d6cd802a1179bd2c94555bdd030` after exact-head CI, independent
  BLOCK remediation/re-review, GitHub App attestation, machine-user native approval,
  and no-bypass expected-head squash merge.
- Exact-main Verify `31215007053` passed protocol and browser parity; Deploy
  `31215005995` passed exact-source publication plus public artifact, relay, and
  bilingual-path readback.
- The first closeout CI run then failed only its live dependency audit after GitHub
  advisory `GHSA-2v37-7h3g-55p8` was refreshed. The compatible transitive lock is
  patched from `nanoid@3.3.16` to `3.3.18`; no runtime source or direct dependency
  changed, and a fresh zero-vulnerability audit plus exact-head CI are required.
- This historical gap motivated the source revision that composes untrusted offer
  gossip, mutual leases, direct participant transport, verified execution receipts,
  encrypted Continuity state, and repair.
- Placement may become usable only when
  `evaluateResourceExecutionContract(...).execution_status === "proved"` for the
  exact workload and lease. Provider loss must create a new lease and preserve the
  workload/lineage identity; stale or single-copy evidence must never schedule work.
- Discovery, signaling, relay, domain, UI, Cloudflare, and GPT remain transport or
  presentation capabilities, never validity authorities. No fixed backend may be
  required for protocol correctness.
- Honest metering, distinct account/credential/administrator/failure domains,
  Sybil resistance, and physical provider independence remain explicit later HOLDs.

## Current coordinator-non-authority source verdict

- Audit base remains freshly fetched `origin/main` and local `HEAD`
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`. Existing and unrelated dirty bytes were
  preserved.
- The successor audit closes the plan-scoped participant inventory boundary without a
  coordinator key or another transport adapter. Every unique role key signs the exact
  source verdict under a deployment-plan-keyed durable sign-once tuple; aggregate
  closure recreates the verdict and requires exact all-key coverage.
- `mortalos-placement-admission-pilot-source-verdict/1` is implemented without a
  coordinator key and without changing the underlying public-chain or source-
  attestation formats. It first recreates both, then exhaustively classifies each
  unsigned protocol artifact as participant-endorsed or deterministically replayed.
  The Continuity Capsule is a separately signature-verified input.
- Final focused evidence is `1/1` PASS in `178,826.3298ms` (`179,032.6269ms` runner).
  The exact fixture closes 34 evidence artifacts: 12 role-source artifacts across 7
  keys, 21 unsigned artifacts (12 participant-endorsed / 9 replayed), and one Capsule.
  Offline restore leaves all three sidecar verification flags false; the complete
  verifier sets them true and reports
  `coordinator_protocol_authority:"not-required-for-verification"`.
- The successor focused integration is `1/1` PASS in `207,089.5934ms`
  (`207,282.5833ms` runner), requiring all 7/7 unique role keys. Exact retry is byte-
  identical; another self-hashed verdict for the plan halts; reversed input is
  deterministic; a 6/7 set fails before output. Full replay reports
  `inventory_closure:"all-role-keys-ratified"` while restore reports both verification
  flags false.
- Security is now `26/26`, `22` direct / `145` discovered; spec, links, generated
  profile, syntax, registry JSON, and diff gates pass. Exact hashes and commands are
  recorded in `MEMORY.md` and the append-only `WORKLOG.md`.
- The exact 121-path pre-document-sync candidate completed all 48 configured `npm test`
  stages from `2026-08-22T17:27:15.2047412+09:00` through
  `2026-08-22T19:46:22.2970708+09:00`, exited `0`, and reached final `verify:s4` in
  `8,347,092ms`. Thirty TAP summaries total `458/458` with zero failures,
  cancellations, or skips; P2P Node is `72/72`. The complete log SHA-256 is
  `3f4dc9d2e88a0070727a36b7c3b1df365dcb37b3fce0c3a7b047fb520acdfa18`.
  Pre-run, post-run, and fresh pre-sync comparison found all 121 paths byte-stable;
  their canonical entries-only inventory SHA-256 is
  `7a666332d2453ad95cf895bc035baae66040b97f7d866dc8e7332a08bc319022`.
  The subsequent status synchronization is documentation-only and requires separate
  static gates; exact-SHA CI/review remains external.
- Objective global hidden-artifact discovery, copied-key/separate-journal resistance,
  `coordinator_execution_binding`, exact-SHA CI/review, and administrator/account/host/
  network/physical independence remain external. The
  next root P0 is the real separately administered multi-host run; do not add another
  same-PC adapter or coordinator authority.
- HEAD and `origin/main` remain `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`.
  The cumulative worktree is `121` paths (`43` modified, `78` untracked); prior and
  unrelated bytes were preserved. No commit, push, merge, deployment, live authority,
  or other external mutation occurred.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
