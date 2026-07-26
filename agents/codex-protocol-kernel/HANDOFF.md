# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — S2 promotion-mode receipt regression

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `55db1a9b73bcffeeb4a4812ad408d31b8a4e673f`
- Work branch: `agent/codex-protocol-kernel--s2-promotion-mode-regression`
- Intended paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/WORKLOG.md`, and
  `scripts/verify-lab.mjs`, and `test/s2-receipt.test.mjs`
- Contract affected: the committed S2 receipt test must accept the verifier's
  repository-state-dependent `candidate` result before squash promotion and
  `promotion` result on the exact promoted `main`, while continuing to reject any
  other mode or failed receipt validation
- Required evidence: focused `npm run test:s2-receipt`; direct `npm run verify:s2`;
  full `npm test`; exact-head Agent PR Policy and Verify; independent immutable-head
  reviewer PASS; expected-head squash merge; exact-main Verify and Deploy
- Notes: PR #41 correctly promoted S2 to main at `55db1a9b`, but both post-merge
  workflows failed before deployment because the first receipt test asserted
  `candidate` unconditionally even though `verifyS2Receipt()` correctly returned
  `promotion`. PR #42 run `30180258092` then exposed that the synthetic promotion
  helper also depended on the mutable Git index; it must instead derive its tree
  from the exact existing promotion commit or committed candidate HEAD. This task
  changes no runtime, receipt, schema, or evidence bytes. Replacement run
  `30181647893` passed full `npm test` but exposed a separate Lab-verifier race:
  the nurture wait reused the already-true `accept` status instead of waiting for
  sequence `1` and pulse count `1`; the verifier must await those exact public
  outcomes.

### ACTIVE — Implement S2 crash-safe durable quorum

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `d0a9ba0f7e4f1a3a17cb7d4af04a9c1113a09ec4`
- Work branch: `agent/codex-protocol-kernel--s2-crash-safe-durable-quorum`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--s2-crash-safe-durable-quorum`
- Exact intended shared areas: versioned durable participant schema and adapters
  under `lab/participant/` and `lab/storage/`; the unified Participant Core only
  where a storage-neutral prepare/recover contract is required; focused Node and
  Chromium fault-injection tests; matching verifier, package command, workflow,
  protocol/traceability documentation, receipt schema/fixture, and Issue #31
  evidence.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md` and `WORKLOG.md`.
- Intended change: implement a storage-neutral write-ahead protocol that durably
  reserves each sign-once tuple before signature release, recovers only by replaying
  canonical evidence/state proofs, commits accepted evidence/state/journal metadata
  atomically, supports explicit renewal/removal, and gives IndexedDB and local Node
  adapters identical failure semantics for durable `2-of-3` birth, handoff,
  transition, one-loss continuation, and D repair.
- Required gates: every enumerated write boundary produces only old head,
  recoverable pending successor, or new head; no conflicting second signature;
  corrupt/unknown/mismatched schema, key, evidence, state, journal, or migration
  fails closed; B cold restart after handoff `100/100`; A/B/C loss, pair restart,
  transition, and D repair `100/100` per loss; clean Node and Chromium exact-head
  suites; full repository/coverage/audit regression; immutable independent review,
  expected-head merge, post-merge Verify, and exact-main Deploy.
- Excluded: S3 resource replication/reconstruction, S4 encrypted state/epoch keys,
  a production Node custody claim, SDK/CLI packaging, Capsule product work, or
  independent-provider promotion.
- Expected handoff: one focused Issue #31 PR with
  `evidence/stages/s2-durable-quorum.json`; independent immutable-head review and
  expected-head squash merge only after every S2 and regression gate passes.
- PR #41 head `826d186609dc87b034fd847d983bf761068f1768` passed policy
  `30158974173/1` and Verify `30158719779/1`, but independent review BLOCKed it
  without attestation or merge. Comment `5078803913` reproduced three P1 authority
  failures: blind same-revision writers released conflicting signatures; a removed
  v1 authority with a stale key migrated active; and reached expiry was reversible
  by wall-clock rollback.
- The replacement source must use a consecutive expected-revision CAS inside each
  whole-document transaction and fail stale reservations before signer invocation;
  abort inconsistent removed-plus-key and active-keyless migrations without
  rewriting v1; and durably latch reached expiry across same-process and cold-start
  clock rollback. Node plus actual IndexedDB regressions and a fully rebuilt source
  receipt are mandatory before a fresh immutable review.
- Exact replacement head `eabdb019e2430b00276a9f691916717d5f3e3509`
  closed those three findings, but independent reviewer comment `5079622973`
  correctly BLOCKed promotion because an expired authority could use
  `renewAuthority(null)` to regain indefinite signing authority.
- The next replacement must permit expired-authority renewal only with a non-null
  expiry strictly beyond the persisted observation high-water mark. Null, stale,
  and equal renewals must return `E_DURABLE_POLICY`, leave authority expired, and
  be proven in Node plus actual IndexedDB. This source change invalidates the prior
  receipt, PR-body snapshot, exact-head CI, and review decision.
- Exact head `f51a6867d7f5450d89ce6e8b39e3c5098b7db609` closed all prior
  P1s and passed policy `30171963307/1` plus Verify `30171939595/1`, but
  independent reviewer comment `5080410491` correctly BLOCKed promotion because
  successful v1 migration left the legacy `keys/active` signing key beside the v2
  document. After v2 authority removal, same-origin code could still sign through
  that orphaned non-extractable key.
- The next replacement must atomically create the v2 participant document and
  delete every legacy object store within the same version-change transaction.
  Failed migrations must retain the complete v1 database, while successful
  migration followed by removal must expose only the `participant` store, a
  removed/null-key document, no legacy key, and no raw signing path. A fresh source,
  receipt, CI snapshot, and independent review are mandatory.

### ACTIVE — S1 receipt post-squash portability correction

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `a4d5183941c82845532a003b55b03522e3e98872`
- Work branch: `agent/codex-protocol-kernel--s1-receipt-main-portability`
- Exact intended paths: `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/WORKLOG.md`,
  `.github/workflows/deploy-lab.yml`,
  `evidence/stages/s1-participant-core.json`,
  `schemas/s1-participant-core-receipt.schema.json`,
  `scripts/verify-s1-receipt.mjs`, and `test/s1-receipt.test.mjs`
- Contract affected: make the S1 receipt permanently verifiable from the promoted
  main commit after squash merge and branch deletion, without weakening exact
  artifact, lineage, result, interval, or receipt-byte binding
- Required evidence: focused receipt negative tests; full `npm test`; a fresh
  checkout that begins at depth 1, confirms the old branch-only source is absent,
  fetches full main history under the workflow contract, and passes; dependency
  audit; trusted policy and Verify on the immutable PR head; post-merge Verify and
  Deploy on one exact main SHA
- Local candidate evidence: receipt v2 negative suite 11/11, direct `verify:s1`,
  full `npm test`, and dependency audit passed. The receipt retains source
  `1a0de4e750ebe0f4ec1f1f178e82563f14cf4e09`, permanently binds promotion
  `a4d5183941c82845532a003b55b03522e3e98872`, verifies its exact 28-path diff
  and every promoted byte digest, and records the PR #39 review attestation.
  A fresh remote clone began at depth 1, fetched the full reachable branch/main
  history, confirmed the obsolete source object remained absent, and passed
  receipt tests 12/12 plus direct `verify:s1`.
- Expected handoff: one focused hotfix PR; independent immutable-head review;
  expected-head squash merge only after PASS

### ACTIVE — Implement S1 Unified Participant Core

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `4a3ede86402ba507c49fb5f563bf932fedd5eb1c`
- Work branch: `agent/codex-protocol-kernel--s1-unified-participant-core`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--s1-unified-participant-core`
- Exact shared paths: participant core/contracts/adapters under `lab/participant/`;
  participant tests/verifiers and matching package/workflow/docs/evidence files.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md` and `WORKLOG.md`.
- Intended change: move candidate construction, signing requests, sign-once policy,
  candidate verification, append/head recognition, catch-up/fork exposure, state
  projection, availability classification, and deterministic snapshots into one
  pure Participant Core. Live, Durable, and Quorum paths retain only key,
  persistence, transport, clock/consent, and UI adaptation.
- Required gates: every existing participant scenario through the same core;
  10,000 deterministic schedules on two runs and Node/browser parity; distinct
  stable negative outcomes; static forbidden-import boundary; core coverage at
  least 95/90/95; full existing repository/Chromium/Lab/transport/coverage/audit;
  immutable independent review, expected-head merge, and post-merge Verify.
- Excluded: S2 crash-safe prepare/commit storage, S3 recovery protocol, encrypted
  state, SDK/CLI, Capsule, independent provider topology, or production deployment.
- Candidate implementation: one `ParticipantCore` now owns construction,
  sign-once, append, recognized head, catch-up/fork, state/custody projection, and
  availability. BrowserIncubator, Live, Durable, and Quorum are adapters; a static
  test prohibits their direct low-level validation/signing imports.
- Frozen source commit:
  `1a0de4e750ebe0f4ec1f1f178e82563f14cf4e09`, a direct child of S0 main
  `4a3ede86402ba507c49fb5f563bf932fedd5eb1c`. Exact local evidence on that
  immutable source: `npm test` PASS from
  the beginning; Participant Core coverage 100.00% lines / 94.83% branches /
  100.00% functions; two Node runs and Chromium agree on 10,000 x 12 schedules at
  `sha256:tECHi0pIS7pbOKPEdX1NYweTxCRPrPiNmASrAz0-1zo`; full conformance 76/76;
  properties 10,000/10,000; isolated Chromium quorum PASS; Lab plus 20/20
  persistent A-to-B handoffs PASS; transport 10,000 schedules / 30,000 recoveries
  PASS; repository coverage 94.70% lines / 92.31% branches / 95.22% functions;
  dependency audit zero findings.
- Exact receipt:
  `evidence/stages/s1-participant-core.json`,
  `sha256:c34d8457f9a25cb1d76ef90d8d581c2864721e646c3b6aeb97218f5dc908b7b3`.
  Its 11-test negative suite and direct validator pass; it binds the exact
  source/base lineage, all 24 changed source paths and Git-object digests,
  contracts, commands, numerical outcomes, limitations, environment, and bytes.
- PR #39 review of the superseded head `07aa025356909e5f65c87162f7f86f2bbe13f958`
  correctly BLOCKed a silent rollback: `sync([])` or a prefix response replaced
  local evidence and could reduce sequence 2 to 0 or 1. No attestation or merge
  occurred. The corrected core monotonically unions received and recognized
  evidence; empty, prefix, duplicate, reordered, stale-peer, and post-fork
  incomplete responses now preserve the head or visible fork. Focused regression,
  coverage, model parity, and the complete exact-source release chain pass.
- Replacement head `5bbbb8578a282063362a37276caeb2dd5a443bc7` also remained
  BLOCKED without attestation or merge. Independent adversarial replay found that
  once aggregate R1 status was forked, catch-up skipped every failed candidate:
  post-fork corrupt evidence was retained and could reduce `fork_points` from one
  to zero. Remediation now permits only replay-stale, fork-detecting, and
  already-forked non-accept results during valid fork reconstruction. Corrupt,
  malformed, and below-quorum peer evidence fails before mutation and preserves
  the prior record set and fork snapshot.
- Required next action: rerun focused gates, rebuild the frozen source/evidence
  history and receipt, rerun the complete exact-source and changed-head chains,
  update PR #39, obtain a new immutable independent review, merge only the
  expected head, then require post-merge Verify and production deployment. No S2
  work may begin before those gates close.

### HISTORICAL — Implement S0 post-hackathon baseline reset

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7fd24209f6a4956d4710931fe53d9d4ca2a86b64`
- Work branch: `agent/codex-protocol-kernel--s0-baseline-reset`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--s0-baseline-reset`
- Exact shared paths: root `README.md`; current and historical `docs/`; S0 receipt
  schema/validator/fixture and matching package/test files.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md` and `WORKLOG.md`.
- Intended change: replace active contest/judge priorities with one post-hackathon
  North Star and claim matrix, archive historical evidence without deleting it,
  reconcile v0/v1 state and availability wording, track S1–S8 issues/milestone, and
  capture a complete machine-validated baseline receipt.
- Required gates: clean exact-main source, zero dependency audit, active-doc
  inventory, full test/Chromium/Lab/transport/coverage gates, receipt digest
  readback, immutable independent review, expected-head merge, and post-merge
  exact-main Verify. No Participant Core refactor or production deploy is in scope.
- Candidate source commit:
  `03ec496e9732c8d9f6861836bfce3c22f3fa6531`. Exact-source `npm test`,
  Chromium, Lab plus 20/20 persistent handoffs, 10,000 transport schedules,
  coverage, and audit gates PASS. The S0 receipt now reads back its frozen
  artifact and package digests directly from that Git commit, verifies its direct
  parent is the recorded main baseline, and checks the structured results. The
  Verify workflow fetches full history and enforces the receipt. Independent
  immutable review, expected-head merge, and post-merge Verify remain required.
- PR #38 independently PASSed and squash-merged as
  `4a3ede86402ba507c49fb5f563bf932fedd5eb1c`; post-merge Verify
  `30124569468/1` succeeded.

### HISTORICAL — Define the post-hackathon North Star implementation plan

- PR #28 merged the plan-only S0–S8 SSOT as
  `7fd24209f6a4956d4710931fe53d9d4ca2a86b64`.

### HISTORICAL — Remediate current dependency advisories

- Branch `agent/codex-protocol-kernel--dependency-advisory-remediation` upgraded
  Wrangler and the Cloudflare Vitest pool, preserved old/new Windows workerd layouts,
  and restored the mandatory zero-advisory Verify baseline.
- PR #29 passed independent expected-head review and squash-merged as
  `079e37dfdea8ce94998533979546b65cc09709d6`.

### HISTORICAL — Verify localized index assets at canonical directory routes

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `44771ae83e2d7450ff9cad654e7a0fae6d144c9e`
- Work branch: `agent/codex-protocol-kernel--canonical-locale-route`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--canonical-locale-route`
- Exact shared paths: `scripts/verify-deployed-lab.mjs` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: exact-main Deploy `29698934167/1` passed source, relay, and Pages upload.
  The exact seven-asset public manifest is live, but final acceptance failed because
  Cloudflare canonically redirects `ko/index.html` to `/ko/` while the verifier used
  `redirect: error` on the non-canonical file route.
- Intended change: resolve root and nested `*/index.html` manifest entries through
  their canonical directory URLs while continuing to compare their response bytes,
  MIME, headers, and digest with the exact built index files. Keep redirects rejected
  on every request actually made by the verifier.
- Required gates: focused remote-verifier/config tests, spec/diff/secret checks,
  exact-head Verify and policy, immutable review, expected-head merge, official
  exact-main Deploy, public manifest/relay/EN-KO acceptance, and Devpost reconciliation.

### HISTORICAL — Reject unsupported Pages deployment configuration

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7d0b5d272b5e4ab5819ab89d6a628af9e82baec2`
- Work branch: `agent/codex-protocol-kernel--pages-config-validation`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--pages-config-validation`
- Exact shared paths: `wrangler.jsonc` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: exact-main Deploy `29697373574/2` passed exact-source verification and
  deployed the relay/Durable Object, then failed closed before Pages upload because
  Wrangler 4.111 rejects the Workers-only root `observability` key in a Pages
  project configuration. The public Pages artifact and acceptance remained old.
- Intended change: remove only the unsupported Pages `observability` block, retain
  relay observability in `relay/wrangler.jsonc`, and freeze the Pages/Worker config
  boundary with a regression assertion. Wrangler exposes no Pages-deploy dry-run,
  so the source regression must explicitly reject the unsupported key.
- Required gates: focused Lab/config tests, spec/diff/secret checks, exact-head
  Verify and policy, immutable review, expected-head merge, natural exact-main
  Deploy, public manifest/relay/EN-KO acceptance, and Devpost reconciliation.

### HISTORICAL — Isolate public-verification environment from source tests

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `e47e438db0e751e5d1d9f01a90933095fbd67906`
- Work branch: `agent/codex-protocol-kernel--deploy-env-scope`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--deploy-env-scope`
- Exact shared paths: `.github/workflows/deploy-lab.yml` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: corrected Deploy `29696536158/1` installed Chromium first, then failed
  closed in pre-deploy `verify:ux` because job-level `MORTALOS_LAB_URL` redirected
  source tests to the older accepted public site. No Cloudflare mutation occurred.
- Intended change: retain exact source binding at job scope, but expose the public
  URL, expected commit, and retry controls only to the final post-deploy release
  verifier. Add a regression contract for this environment boundary.
- Required gates: focused/unit/spec/diff/secret checks, exact-head Verify and policy,
  immutable review, expected-head merge, exact-main Deploy, public readback, and
  Devpost reconciliation. No rerun or manual deployment bypass before correction.

### HISTORICAL — Repair production deploy Chromium ordering

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `d20e66083cd79084667beab8bc8269fbac447828`
- Work branch: `agent/codex-protocol-kernel--deploy-chromium-order`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--deploy-chromium-order`
- Exact shared paths: `.github/workflows/deploy-lab.yml` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: post-merge Deploy `29695521487/1` failed at `npm test` before any
  Cloudflare mutation because Playwright Chromium was installed only after the test.
- Intended change: install Chromium immediately after locked dependencies and before
  exact-source verification; remove the later duplicate install step. Deployment
  order remains verify → relay → Pages → exact public acceptance.
- Required gates: workflow structure/unit assertions, spec/diff/secret checks,
  exact-head Verify and Agent PR Policy, independent immutable review, expected-head
  merge, then exact-main Deploy and public readback. No manual deployment bypass.
- Rollback: no production mutation occurred in the failed run; current accepted
  deployment remains live until the corrected exact-main workflow passes.

### HISTORICAL — Implement and release S0–S12 multi-browser digital-life candidate

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `8930992e5483c6b645af197348d5725a8648bd09`
- Work branch: `agent/codex-protocol-kernel--multi-browser-bilingual-plan`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--multi-browser-bilingual-plan`
- Exact intended shared areas: root/package/license notices; `.github/workflows/verify.yml`
  and `deploy-lab.yml`; `docs/` current/normative set; `functions/api/scenarios.js`;
  `lab/` UI, i18n, participant, storage, transport, evidence, endpoint, header, and
  license files; `relay/`; `r1/javascript/` and `r1/python/`; `schemas/`; `scripts/`
  build/deploy/spec/state/transport/quorum/UX/Lab verifiers; `src/` kernel/state/
  transport; and matching `test/` suites/vectors.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`,
  and `WORKLOG.md`.
- Contract affected: the site moves from an L0 single-browser/GPT-centered proof to
  one bilingual state-bearing organism whose custody moves A→B without private-key
  transfer; A loss after handoff permits B continuation, while premature loss stalls.
  A/B/C `2-of-3` evidence covers every one-endpoint loss and repair. R1/state remain
  local authority; relay, UI, Cloudflare, order, and optional GPT remain untrusted.
- Cost boundary: production GPT is disabled and its secrets are not injected until a
  confirmed Turnstile widget/secret exists. The deterministic main journey remains
  fully available.
- Required local evidence: license/spec/link/governance/conformance/property/i18n/
  state/transport/relay/multi-browser/Lab/R1/build/UX/portable/singleton/H2 through
  `npm test`; actual Chromium portable and Lab gates; coverage, audit, package,
  secret, diff, and clean-clone checks.
- Required release evidence: immutable independent review bound to the exact head,
  expected-head merge, post-merge Verify, exact relay and Pages deployment, manifest
  equality, English/Korean public A→B and quorum/negative acceptance, rollback
  record, and Devpost/video readback.
- Expected handoff: one immutable candidate PR from current `main`. The author does
  not self-review, merge, or push directly to `main`.
- Reviewer FAIL remediation (PR #23 snapshot `da3d691…`): remove the false
  clean-diff evidence, make every valid relay request subject to the per-room
  admission ceiling (including duplicates, range/presence reads and connect), bind
  room/presence TTL to actual alarms, add flood and idle-room runtime tests, add the
  exact 20-run two-persistent-profile Chromium gate, and remove pre-validation
  “verified” UI wording. The intended shared paths remain within the declaration
  above; the remediated head requires a completely fresh reviewer snapshot.
- Second reviewer FAIL (snapshot `a5f56c6…`): exact production cadence was about
  399/min for A+B against the 120/min room ceiling, while the local acceptance mock
  had no rate counter. The new remediation makes `src/transport/relay-policy.mjs`
  authoritative for Worker/browser/mock, budgets 204 scheduled + 48 burst operations
  below a 300/min ceiling, tests the 300th/301st boundary, measures a real 12-second
  two-profile window, and fails on any local `429`. This changed head again requires
  a fully fresh immutable reviewer snapshot; neither earlier review may authorize it.

## Closed intents

All earlier Build Week runtime, D1, MIME, canonical-root, R1-A/R1-B, custom-domain,
release-evidence, and submission intents are closed. Their immutable SHAs, review
decisions, failures, and verification evidence remain in `WORKLOG.md` and Git history.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or review exception. PR #3
established the split trust boundary at
`e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the migration marker and
exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current policy workflow
remains `.github/workflows/trusted-pr-policy.yml`.
