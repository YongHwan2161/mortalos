# Work log

This file is append-only. Each entry records the base commit, intended scope,
result, and reproducible verification.

## 2026-07-15 — Agent isolation bootstrap

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Branch: `agent/codex-protocol-kernel`
- Scope: define role boundaries and create a repository-tracked workspace/memory area
- Shared runtime files modified: none
- Result: role, durable memory, handoff protocol, and draft workspace established
- Validation: `main` remained at the fork point; the branch was exactly one commit
  ahead with only the six intended agent files; all remote blob SHAs matched the
  local files; `npm test` and the workspace secret-pattern scan passed

## 2026-07-15 — Agent collaboration and reviewer gate

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Branch: `agent/codex-protocol-kernel--agent-governance`
- Intended shared paths: agent policies, worktree/PR tooling, reviewer workspace,
  governance tests, PR template/workflow, `package.json`, and package exclusions
- Result: implemented isolated task-worktree creation, machine-readable PR policy,
  scoped agent memories, and an independent immutable-head reviewer/merge contract
- Verification: governance tests 10/10; full `npm test`; the then-current coverage
  gate passed; dependency audit 0 vulnerabilities; Node and the then-current pre-v3
  actual Chromium corpus were byte-identical with 10,000/10,000 adversarial rejections.
  This historical run does not satisfy the later v3 exact-head gate
- Handoff: `reviewer-merge-gate` must independently inspect and decide the PR

## 2026-07-15 — Portable trust-boundary hardening

- Original base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Final reconciled base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Branch: `agent/codex-protocol-kernel--trust-boundaries`
- Intended shared paths: portable bytes/codec/crypto/validation/lineage core,
  schemas and rejection codes, deterministic vectors and tests, current protocol,
  threat/status/plan/traceability documentation, dependency notices, and CI timeout
- Result: hardened intrinsic byte snapshots and I-JSON canonicalization; strict
  Ed25519 point/scalar validation; total deterministic validators; activatable
  custody handoffs; recognized-head mortality with independently pooled body,
  signature, and sidecar components, strict-first recomposition, explicit usable-key
  completion, reentrancy protection, and pending-sibling fork recording; removed the
  caller-selected mortality API; added portable corpus v3 and H2 lifecycle trace v3
- Verification: clean `npm ci`; full `npm test`; 55/55 conformance; 10,000 mixed
  property cases (1,008 accepts/8,992 rejects); portable committed/Node/browser-target
  byte identity with 10,000/10,000 adversarial rejects; 98.46% line, `>=93.7%`
  branch across supported Node/V8 runs, and 100% function coverage; H2 digest
  `b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36`;
  audit 0 vulnerabilities; 61-file package dry-run; license/spec/governance gates pass
- Pre-reconciliation CI: publication candidate `9eae8c34` passed the then-current
  Agent PR Policy and the complete
  Verify workflow, including Node 22, actual Chromium differential verification,
  coverage, and dependency audit
- Handoff: the reconciled head must pass the new trusted target policy and complete
  Verify workflow before immutable-snapshot review

## 2026-07-15 — Governance trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: trusted PR workflow/template, agent governance documents,
  worktree/PR policy scripts, governance tests, and `package.json`
- Result: bound PR policy execution and evidence to immutable trusted-base code,
  required registered identities and complete changed/renamed-path declarations,
  and made worktree creation/resume fail closed for branch reuse, stale ancestry,
  incorrect upstreams, and restricted remote fetch refspecs; retained a tokenless,
  read-only public API path for local public-repository verification
- Verification: full `npm test`; governance 25/25 at 91.91% line, 81.01% branch,
  and 93.48% function coverage; actual Chromium 149 differential with 10,000/10,000
  adversarial rejections; audit 0 vulnerabilities; package exclusion, YAML, syntax,
  and diff checks passed
- Handoff: local immutable commit to `reviewer-merge-gate` for independent decision;
  author did not push or approve its own work

## 2026-07-15 — Alternate-base and policy snapshot correction

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `a0d1e19a001e1922244dc1d5a6574758620ffc65`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: PR policy workflow/verifier/tests and their governance docs
- Result: added the platform-side `main` base filter, per-PR cancellation, API-body
  authority, event/API body binding, stable beginning/end PR snapshots, and exact
  paginated/declared changed-file-count binding
- Verification: governance 26/26 at 92.68% line, 84.39% branch, and 93.75%
  function coverage; full, Chromium, audit, package, syntax, YAML, and diff checks
  passed
- Handoff: preserve the rejected predecessor and submit a new immutable commit to
  `reviewer-merge-gate`; author must not push or self-approve

## 2026-07-15 — Reviewer snapshot attestation binding

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; corrected predecessor
  `5f41549437309eb59b94c2cb6783c31b1ad62941`
- Branch: `agent/codex-protocol-kernel--governance-hardening`
- Intended shared paths: reviewer/root/collaboration contracts and governance test
- Result: defined exact body and changed-file digests, expanded the structured PASS
  attestation, and required pre-merge revalidation of every mutable review field and
  the latest non-cancelled policy run
- Verification: full `npm test`; governance 27/27 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; Chromium 149 differential; audit, package, YAML,
  syntax, and diff checks passed
- Handoff: preserve prior commits and submit a new immutable commit for independent
  decision; author must not push or self-approve

## 2026-07-15 — Trusted target policy cleanup

- Base: `e6dce59fb314266acdd855748a9b1fb996864e81`
- Branch: `agent/codex-protocol-kernel--trusted-policy-cleanup`
- Intended shared paths: delete `.github/workflows/pr-policy.yml`; update `AGENTS.md`,
  this agent's handoff/worklog, the reviewer contract,
  `docs/AGENT_COLLABORATION.md`, and the governance regression test
- Result: removed the retired transition workflow and exception text; retained the
  permanent trusted-base policy unchanged; changed no runtime, protocol, schema, or
  product file
- Verification: governance 28/28; governance coverage 92.68% line, 84.39% branch,
  and 93.75% function; full `npm test`; audit 0 vulnerabilities; package dry-run 61
  files; YAML/JavaScript syntax, diff, scope, retired-language, and high-confidence
  secret scans passed; trusted workflow matched `origin/main` byte-for-byte at Git
  blob `94d2b0353fc44d931acd0a28604786a55e78786f` and SHA-256
  `42ad69df038be695f589bad02e01504215fef0058bac4d202ff82ba7ba042ee6`
- Handoff: focused immutable PR to `reviewer-merge-gate`; author does not merge or
  self-approve

## 2026-07-15 — HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

- Status: closed audit trail, not an active workflow or review exception
- Reviewer decisions: reject proposed-head policy self-validation; reject a combined
  migration workflow that let an untrusted run expose the trusted check name; accept
  only the split, zero-permission liveness marker as one-time migration evidence; and
  require normal target-only policy evidence after cleanup
- Merge anchors: PR #3 established the split trust boundary at
  `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the marker workflow and
  exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Permanent state: `.github/workflows/trusted-pr-policy.yml` alone owns
  `Agent PR Policy` / `Trusted main-base policy`, and its accepted event is only
  `pull_request_target`

## 2026-07-15 — Canonical workflow identity regression

- Base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: added repository-wide workflow enumeration and a dependency-free,
  fail-closed parser for exactly one canonical root block-form `on:` section with
  two-space event keys; adversarial quoted, flow, alias, inline-event, and duplicate
  variants are rejected, and trusted names/events are reserved to the unchanged
  trusted workflow
- Verification: fresh `npm ci`; full `npm test`; governance 29/29 at 92.68% line,
  84.39% branch, and 93.75% function coverage; audit 0 vulnerabilities; YAML 1.2,
  JavaScript syntax, docs/spec, trusted-workflow integrity, scope, and diff checks pass
- Handoff: focused three-path immutable commit to `reviewer-merge-gate`; author does
  not push, merge, or self-approve

## 2026-07-15 — Canonical workflow/check-name representation hardening

- Base: `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`; corrected local predecessor
  `57266ba29fa4eb8e652d3ad169388a91092eeb80`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression and append-only author ledgers only
- Result: replaced regex-only trusted-name ownership checks with fail-closed parsing
  of the root workflow name and job/check names; rejected comment-equivalent names,
  quoting, Unicode escapes, root/job folded scalars, flow/inline forms, aliases,
  duplicates, bad indentation, and malformed keys/values
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; audit 0 vulnerabilities; JavaScript syntax,
  trusted-workflow integrity, three-path scope, docs/spec, and diff checks pass
- Handoff: corrected immutable commit to `reviewer-merge-gate`; author does not push,
  merge, or self-approve

## 2026-07-15 — Multiline plain-scalar workflow identity hardening

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected rebased predecessor
  `767a5a5c8007b0ea6a3b107340b35c0efaead34f`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: closed the remaining YAML plain-scalar identity bypass by rejecting
  significant indented continuations after a canonical root workflow name or direct
  job/check name; added the exact `Agent` + `PR Policy` and `Trusted` +
  `main-base policy` multiline adversarial reproductions
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; 55/55 conformance; seeded 10,000-case property
  corpus; portable Node/browser-target equality and 10,000/10,000 adversarial
  rejects; license/spec/singleton/H2 gates; audit 0 vulnerabilities; trusted workflow
  unchanged at blob `94d2b0353fc44d931acd0a28604786a55e78786f`; three-path scope and diff checks pass
- Handoff: focused rebased local commit to `reviewer-merge-gate`; author does not push,
  merge, or self-approve

## 2026-07-15 — YAML lone-CR workflow identity hardening

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`; corrected local predecessor
  `bad47e5462725f5752d2a7a2eccf797f7c3d03c6`
- Branch: `agent/codex-protocol-kernel--policy-identity-regression`
- Intended shared paths: governance regression plus append-only author handoff/worklog
- Result: aligned every workflow-parser line split with YAML CRLF, LF, and standalone
  CR line breaks; added exact root/job identity counterfeits and a mixed-ending
  document that previously hid trusted names behind `run-name` or `timeout-minutes`
- Verification: full `npm test`; governance 30/30 at 92.68% line, 84.39% branch,
  and 93.75% function coverage; 55/55 conformance; seeded 10,000-case property
  corpus; portable Node/browser-target equality and 10,000/10,000 adversarial
  rejects; license/spec/singleton/H2 gates; audit 0 vulnerabilities; syntax, trusted
  workflow blob, three-path scope, historical-audit retention, and diff checks pass
- Handoff: focused local follow-up to `reviewer-merge-gate`; author does not push,
  merge, or self-approve
## 2026-07-15 — Reviewed PR #2 correction integration

- Base: PR #2 head `00af46d53dc4bf02882925e57ae9396d6ae99cca`; current
  remote `main` was `e6dce59fb314266acdd855748a9b1fb996864e81`
- Branch: `fix/pr2-integration`
- Intended shared paths: canonical codec, validator/lineage mortality core,
  focused conformance and portable vectors, current normative/rolling docs,
  verification scripts, and agent coordination records
- Result: retained the remote independent body/signature/sidecar evidence pool,
  reentrancy guard, usable-key snapshot, and canonical recomposed fork evidence;
  integrated descriptor-only canonicalization, module-private lineage construction,
  sign-once projections, explicit `evidence_equivocation`, heartbeat `{}` fallback,
  and conditional `evidence_payload_unavailable` after irreversible authority loss
  when an opaque membership body is the sole remaining obstacle to death classification
- Verification: full `npm test`; 58/58 conformance; seeded 10,000-case properties;
  portable committed/Node/browser-target byte identity with 10,000/10,000 rejects;
  actual Headless Chromium 149 byte identity; coverage 98.59% line, 93.97% branch,
  100% functions; H2 digest
  `b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36`;
  audit 0 vulnerabilities; 61-file package dry-run; license/spec/governance and
  diff checks pass
- Handoff: no commit, push, PR update, or merge was performed here; root publishes
  the inspected exact tree and `reviewer-merge-gate` re-reviews the immutable head

## 2026-07-15 — Post-merge mortality-proof correction rebased

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72` (merged PR #2)
- Branch: `agent/codex-protocol-kernel--mortality-proof-correction`
- Intended shared paths: the 22 runtime, conformance, portable-vector,
  specification/status, verification, and agent-record paths listed in the active
  handoff
- Result: preserved the reviewed correction as a focused follow-up on the exact
  current `main` tree without rewriting merged PR #2; the rebase applied cleanly
  over the trusted-policy and PR #2 squash merges
- Verification: the identical correction tree passed 58/58 conformance, two 10,000
  case corpora, actual Chromium 149, 98.59%/93.97%/100% coverage, audit, package,
  H2, license, spec, and diff gates before the clean rebase; final-head governance,
  full suite, and CI must rerun against this new base
- Handoff: publish a new PR and require `reviewer-merge-gate` to bind its decision to
  the final immutable head and fresh trusted-policy/Verify runs

## 2026-07-15 — Mortality proof made monotone under observed evidence

- Base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`
- Branch: `agent/codex-protocol-kernel--mortality-proof-correction`
- Result: prevented global heartbeat-payload leakage, reconstructed-fork poisoning,
  split-commitment false liveness, semantic-invalid sign-once bypass, pending
  list/record/byte TOCTOU, and repeated observer-option reads; fresh authority now
  means usable keys uncommitted to the current tuple, while opaque membership
  evidence blocks only an otherwise unsupported death conclusion after authority
  loss is declared irreversible
- Input boundary: ordinary own-data observer options and evidence records are copied
  before analysis; transparent Proxy-backed observer structures remain explicitly
  outside the v0 mortality-proof profile pending a canonical aggregate record
- Independent review: no remaining functional, specification, documentation, or
  governance blocker was found after the adversarial regressions and exact 22-path
  handoff reconciliation
- Verification: full `npm test`; governance 28/28; conformance 58/58; seeded 10,000
  valid/invalid continuation cases; portable committed/Node/browser-target byte
  identity and 10,000/10,000 rejects; actual Headless Chromium 149 byte identity;
  98.05% line, at least 93.38% branch across validated Node/V8 runs, and 100%
  function coverage; H2 digest
  `b5443d179a48a5645d40c940e7420831f9672ebf5afa51e2f45c4e9fb3abda36`;
  audit 0 vulnerabilities; 61-file package dry-run; spec and diff checks pass
- Handoff: publish one immutable PR, require trusted Agent PR Policy and Verify on
  that exact head, then submit it to `reviewer-merge-gate`; author does not merge

## 2026-07-15 — Mortality correction reconciled with current main

- Base: `e332bdf639f6b8c4e39186087cde5e0470f7846f`
- Branch: `agent/codex-protocol-kernel--mortality-proof-correction`
- Intended shared paths: the same exact 22 paths listed in the active handoff
- Result: rebased the three focused correction commits after PR #6 advanced `main`;
  retained its workflow-identity governance regressions and both append-only agent
  histories while leaving the mortality/runtime delta unchanged
- Verification: final-head full `npm test`; governance 30/30; conformance 58/58;
  seeded 10,000-case properties; portable committed/Node/browser-target equality
  with 10,000/10,000 rejects; actual Chromium 149 equality; 98.05% line, at least
  93.38% branch across validated Node/V8 runs, and 100% function coverage; H2 v3
  digest unchanged; audit 0; 61-file package dry-run; license/spec/diff gates pass.
  Remote trusted policy and `Verify` must rerun on the replacement immutable head
- Handoff: replace stale PR #7 head/base evidence, then restart independent review;
  author does not approve or merge

## Entry template

## 2026-07-15 — H3A local MortalOS Lab

- Base: `9791074ffe8f091b8007e09f2b3edd4080d4212b`
- Branch: `agent/codex-protocol-kernel--h3-browser-lab`
- Intended shared paths: the exact Lab, build/verification, workflow, documentation,
  and agent-record paths declared in the active handoff
- Result: added a one-page browser adapter over the portable kernel with three
  dedicated non-extractable/sign-once custodian Workers, live `2-of-3` birth and
  heartbeat, fixed reference turnover and falsification experiments, corpus replay,
  and canonical public-evidence export/replay; the UI explicitly reports three
  logical custodians as one physical/administrative failure domain
- Verification: Lab unit tests and static build pass; real cross-origin-isolated
  Chromium passes three clean contexts, every two-key pair, one-key/replay/fork/
  post-fork/resurrection exact codes, 15 named plus six boundary and 10,000 seeded
  corpus outcomes, SAB rejection, evidence digest/replay, storage/Service Worker/
  request/console boundaries, accessibility semantics, narrow viewport, and reduced
  motion; full `npm test`, actual Chromium differential, 98.05% line/93.50% branch/
  100% function coverage, audit 0 vulnerabilities, 76-file package dry-run,
  license/spec/governance, and diff checks pass; remote CI remains required on the
  immutable PR head
- Handoff: H3B public hosting is deliberately separate; `reviewer-merge-gate` must
  inspect the immutable H3A diff and reject UI-side validity or ownerlessness claims

### YYYY-MM-DD — Task

- Base: `<commit>`
- Branch: `<branch>`
- Intended shared paths: `<paths or none>`
- Result: `<concise outcome>`
- Verification: `<commands, vectors, CI run, or review>`
- Handoff: `<agent/dependency or none>`

## 2026-07-16 — Superseding P0 mortality proof reconciled on current main

- Base: exact `origin/main`
  `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`
- Branch: `agent/codex-protocol-kernel--mortality-proof-reconcile-main`
- Sources reviewed: correction `38458708c9df38214664953112edcf2c6a61e5ed`
  plus useful resource/history deltas through blocked PR #9 head
  `12cee117367dbe0afe0c0650c5bbdf24e8fbf53f`; PR #9 was not edited,
  force-pushed, approved, closed, or merged
- Result: requires independent irreversibility and completeness assertions for death;
  acquires only bounded named observer fields/indices; snapshots hostile bytes through
  captured typed-array copy; checks realm/dependency integrity for every result,
  including already-forked state; bounds candidate occurrences/canonical bytes and
  five other resources; and preserves all verifying signers under exact-body,
  sign-once-aware reconstruction. The calibrated signature ceiling is 1,152: a
  maximum 16-current/16-new transition uses 1,088 with 64 units of headroom, three
  identical complete carriers consume exactly 1,152, and a fourth returns frozen,
  graph-atomic, retryable 1,153/1,152 overflow.
- Test architecture: genuine Node Ed25519 exact/+1 and maximum-role regressions run
  once in conformance and are excluded only from the redundant coverage replay;
  portable browser evidence checks the normalized reservation overflow. The CI
  sequence first establishes committed/Node/browser-target equality in `npm test`,
  then compares committed/actual-Chromium without recomputing Node a second time.
- Documentation: the evergreen critical order is P0 → independent-verifier
  registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab
  wire consumption → H3B public deployment → R2. Registration preserves logical
  task/workspace separation; a separate GitHub App/bot is still required for
  account-level independence. Stable CLI work is non-blocking after R1-C.
- Verification: clean `npm ci` and full `npm test` PASS in 963.46 s: governance
  30/30, conformance 75/75 (including both genuine full-signature-budget tests),
  seeded 10,000-case properties, Lab unit/build, singleton, H2 v4 digest
  `19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399`,
  and committed/Node/browser-target portable equality with 10,000/10,000 rejects.
  An exact-source, environment-unset mortality replay then passed 27/27 with zero
  skips, explicitly executing the 1,152/+1 and maximum 16→16 boundary tests;
  coverage replay skipped exactly those two redundant tests and still passed at
  96.00% line, 92.64% branch, and 95.22% function coverage. Governance coverage
  passed 30/30 at 92.68%/84.39%/93.75%; spec/limit parity, license, Lab build,
  package dry-run (77 files), and audit (0 vulnerabilities) passed. Seven focused
  mortality tests also passed in 84.4 s. Actual Chromium and browser-driven Lab
  checks could not start locally because no browser executable is installed and
  Playwright's sandboxed and approved download attempts both returned empty,
  invalid archives; this is an environment limitation, not a browser PASS. Exact-head
  GitHub Chromium/Lab evidence therefore remains required before merge.
- Concurrent-review follow-up: PR #9 later moved to observed head
  `13428fa6905508c0a97649ebf46b9e4826f98403` and remained blocked under review
  `4710440852`: a prototype trap could poison `Array.prototype.sort` during option
  acquisition and then reach an immediate usable-key limit without a trusted-basis
  recheck. This local tree already aborted that probe; the exact regression is now
  permanent. Focused replay passed 1/1, and the environment-unset mortality file
  passed 28/28 with zero skips before spec, syntax, stale-language, and diff checks.
- Handoff: publish one ready superseding PR and bind review to its immutable base,
  head, body, changed-file digest, trusted policy run, and Verify run. The author does
  not self-review or merge.

## 2026-07-16 — Build Week submission sprint and H3B deployment contract

- Base: `d50c8f41ec648c757cb26b170340c467f792b770`
- Branch: `agent/codex-protocol-kernel--submission-sprint`
- Result: added a deterministic `mortalos.lab-assets/1` manifest with exact source
  commit, per-asset SHA-256 and media types; one shared local/Cloudflare security
  header contract; clean-tree exact-head Pages deployment; remote byte/header/source
  verification; and a remote mode for the full Chromium Lab judge path. GitHub
  Actions are pinned and persisted checkout credentials are disabled. Trusted `src/`
  protocol code is unchanged.
- Submission review: live Devpost data fixed the deadline at
  `2026-07-22T00:00:00Z` (09:00 KST), confirmed the project remains a draft, and
  identified the public video, `/feedback` Session ID, honest story, and no-rebuild
  Developer Tools path as mandatory blockers. The rolling plan now separates the
  submission lane from post-submission R1/R2 research. Runtime GPT is not treated as
  a requirement; concrete construction use of Codex/GPT-5.6 must be evidenced.
- Verification: `npm test` PASS with governance 30/30, conformance 76/76, seeded
  10,000-case properties, Lab 8/8, static build, committed/Node/browser-target
  portability with 10,000/10,000 adversarial rejects, singleton, and H2 v4 digest
  `19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399`.
  Trusted-core coverage passed at 96.00% line, 92.56% branch, and 95.22% function;
  audit found zero vulnerabilities; package dry-run contained 82 files; license,
  direct-dependency notice, spec, workflow/governance, syntax, and diff checks passed.
  Actual Chromium could not run locally because no executable exists and the
  Playwright CDN returned empty invalid archives; exact-head GitHub CI remains the
  required browser evidence.
- Deployment state: local Wrangler is 4.111.0 but has no authenticated Cloudflare
  account or token. The unauthenticated temporary-account path was not used because
  it requires accepting Cloudflare terms and is not a durable submission URL. The
  automatic post-merge GitHub workflow will use repository-scoped deployment secrets
  if present and then verify the public artifact.
- Reviewer correction: PR #11 head
  `c50b6c8e9384f18019acdfd8fdb4bc70f370ad71` passed Verify run
  `29511017380`, but immutable review correctly blocked merge because Wrangler
  4.111.0 emits `"Project Name"` while the deployment code read `entry.name`. The
  author correction validates the complete pinned list-entry schema, reads the real
  key, skips creation for an existing project, creates only when absent, and fails
  closed on malformed or drifted JSON. Focused Lab replay passed 8/8 and the full
  repository suite passed before the replacement head was published.
- Handoff: publish one ready PR from this branch, require immutable-head policy and
  Verify success, then let `reviewer-merge-gate` decide merge and observe the
  automatic Cloudflare run. Do not call H3B complete without the public verifier.
