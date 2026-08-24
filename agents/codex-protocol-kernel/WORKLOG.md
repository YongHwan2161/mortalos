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

## 2026-07-16 — Post-merge H3B and submission status correction

- Base: `294b741bc89c72ee4ae4f3aea27a21515d0d1469`
- Branch: `agent/codex-protocol-kernel--post-merge-status`
- GitHub evidence: PR #11 merged the H3B contract; push Verify
  `29513454019/1` passed every Node, actual-Chromium, Lab, coverage, and audit step.
  Deploy `29513454211/1` failed at credential preflight with empty
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; install, deployment, and all
  remote verification steps were skipped.
- Governance incident: review `4715507067` had unverifiable logical-agent provenance
  and merge occurred nine seconds later before the assigned reviewer performed the
  required immediate re-fetch and expected-head merge. Post-merge incident comment
  `4994066948` supersedes that review for governance purposes. The assigned
  reviewer's later independent full test/diff PASS is technical evidence only and
  is not retroactive approval.
- Devpost evidence: the project page is published with story/tagline/repository but
  `submitted_at` and video remain empty. At `2026-07-16T16:10:06Z`, submissions were
  open and the exact deadline remained `2026-07-22T00:00:00Z` (09:00 KST).
- Result: current docs distinguish the merged contract from an undeployed public
  Lab and make Cloudflare credentials, exact-SHA remote proof, video, `/feedback`,
  custom fields, and final submission the deadline-critical chain.
- Validation: clean locked install with an isolated writable npm cache; full
  `npm test` PASS (governance 30/30, conformance 76/76, seeded properties 10,000,
  Lab 8/8, portable 10,000/10,000, singleton, H2 v4); coverage 96.00% line,
  92.56% branch, and 95.22% function; audit zero vulnerabilities; package dry-run
  82 files; license/spec/link, JavaScript syntax, and diff checks PASS.

## 2026-07-17 KST — Sites/R1 submission-path reconciliation

- Base: `6c5b85fd8e467feb4df63556864ea5f8949e7b61`
- Branch: `agent/codex-protocol-kernel--submission-reconcile`
- Live Devpost state changed after the first status draft: the project now points to
  `https://mortalos-evidence-lab.ant713800.chatgpt.site`, its story describes the R1
  candidate and GPT witness, but `submitted_at` and `video_url` remain empty.
- Public verification: logged-out root returned HTTP 200; the server-side witness
  returned structured HTTP 200 for one public R1 result; adding an unknown
  `private_key` field returned HTTP 422. Sites reports public version 2 with an
  immutable source commit and archive digest.
- Provenance gap: the Sites source commit is not a MortalOS repository commit. PR #12
  subsequently merged its bounded R1 profile after exact-head CI and logical review,
  but also landed stale H3B checklist claims. This current-main reconciliation removes
  those claims and requires the public Sites results/source to bind to merged R1.
- Priority decision: Sites satisfies the Developer Tools no-rebuild path while
  healthy; direct Cloudflare Pages is optional exact-commit hardening, not a submit
  blocker. The critical chain is truthful status → Sites provenance →
  video → `/feedback`/custom fields → rehearsal → submit.
- Validation on current main plus documentation reconciliation: clean isolated-cache
  `npm ci`; full `npm test` PASS including governance 30/30, conformance, 10,000
  seeded properties, Lab 8/8, R1 4/4, JavaScript/Python differential 8/8, portable
  10,000/10,000 rejects, singleton, and H2 v4; coverage 96.00% line, 92.64% branch,
  and 95.22% function; audit zero vulnerabilities; package dry-run and diff check
  PASS. Public root/GPT/private-field smoke tests and exact R1 hash comparison PASS.
- Immutable review correction: reviewer BLOCK on initial PR #14 head
  `5a6cd517b185dbfa408c0af0cf42d104a52dcf55` found two shared documents outside
  the first declared scope that still described H3B and R1 as future work. The
  replacement scope includes `docs/ACCESS_ARCHITECTURE.md` and
  `docs/SINGLE_BROWSER_INCUBATOR.md`, distinguishes merged R1-A/R1-B from remaining
  R1-C, removes the duplicated incubator statement, and requires fresh exact-head CI
  plus a full new immutable review.

## 2026-07-17 KST — Build Week exact-witness and judge-path finalization

- Base: `1c3e7956b1386c4b6ff1edab2249ff0d6c5d21a7`
- Branch: `agent/codex-protocol-kernel--build-week-finalization`
- Product slice: added a same-origin Pages Function using the Responses API and
  strict output schema. GPT-5.6 may select only one of ten committed mutations; a
  pure compiler discards free-form text, emits canonical bytes and a digest, and the
  existing kernel remains the sole verdict authority. The guided UI exposes the
  model prediction, kernel result, and byte-identical replay without GPT in four
  visible actions while preserving the advanced Lab.
- Security boundary: server-only key, `store: false`, bounded request/output,
  15-second timeout, strict method/origin/media/schema checks, separate hashed
  safety and trusted-IP rate keys, structured non-sensitive logs, self-only CSP,
  and stable refusal/incomplete/upstream/rate/config error codes. No model text may
  supply a key, signature, accepted context, recognized head, or mortality proof.
- Fixed live evaluation with the existing secret: 25/25 schema/API results, 25/25
  intended mutation selections, 10/10 mutation coverage, 25/25 kernel and GPT-off
  replays, and 0 reflected private sentinels. Exact model prediction matched the
  kernel's status/code 0/25, directly supporting the untrusted-witness design.
- Local evidence: scenario API 6/6; Lab unit 14/14; three-context Chromium Lab PASS
  including all 2-key pairs, 15 named, 13 boundary, and 10,000 adversarial cases;
  governance 30/30; conformance 76/76; fixed properties 10,000; portable committed/
  Node/browser-target equality with 10,000/10,000 rejects; R1 JavaScript/Python 8/8;
  singleton and H2 PASS; coverage 96.00% line, 92.56% branch, 95.22% function;
  governance coverage 92.68%/84.39%/93.75%; audit zero vulnerabilities.
- Windows findings: `URL.pathname` doubled the drive prefix for the Python R1
  verifier and POSIX inline environment assignment broke the coverage command.
  Both have cross-platform launchers and regression coverage. The LF checkout
  contract prevents license/workflow byte drift. Generated `.wrangler` state is
  excluded from npm publication, and the heavy exact gates have a 60-minute CI
  bound based on measured component runtimes.
- External release gates remain exact and non-substitutable: independent immutable
  review, green GitHub exact-head checks, authenticated Cloudflare exact-SHA deploy
  and logged-out remote verification, public narrated video, real `/feedback`
  Session ID, required Devpost readback, and non-null `submitted_at`. The author does
  not self-review or merge.

## 2026-07-18 KST — Pages-compatible D1 production rate limit

- Base: `3d0529e40c66d13a7e326778d26312f6051c55bc`
- Branch: `agent/codex-protocol-kernel--pages-d1-rate-limit`
- Root cause: exact-main deploy runs `29588418943` and `29591202642` passed source
  tests but Wrangler rejected the Pages project configuration because Pages does not
  support the Worker `ratelimits` binding. Direct project API readback proved the
  token and account were valid; this was a configuration compatibility defect.
- Repair: replaced `SCENARIO_RATE_LIMITER` with the provisioned
  `SCENARIO_RATE_DB` D1 binding and a strict migration. One atomic minute-window
  UPSERT stores only the private domain-separated HMAC actor key, increments before
  OpenAI, permits counts 1–10, rejects 11+ with `429`, and fails closed on missing,
  failed, or malformed D1 responses. Deployment applies migrations before runtime
  secrets and emits bounded, secret-redacted Wrangler diagnostics.
- Live Cloudflare evidence: Wrangler accepted the candidate Pages configuration;
  remote migration `0001_scenario_rate_limits.sql` passed; 20 concurrent D1 queries
  returned the exact unique sequence 1–20 and stored 20. The probe row was deleted
  and read back at count zero. The earlier diagnostic Pages secret was deleted and
  production environment keys read back empty before final secret deployment.
- Local evidence: targeted scenario 8/8 and Lab 9/9; full `npm test` PASS in
  1,212.8 seconds, including governance 30/30, conformance 76/76, seeded properties
  10,000, combined Lab/API 17/17, portable 10,000/10,000, R1 JS/Python 8 records,
  singleton, and H2. Coverage PASS at 96.00% line, 92.56% branch, 95.22% function;
  actual Windows Chromium byte equality and 10,000/10,000 rejects PASS; three clean
  local Lab contexts and responsive/accessibility/security gates PASS; audit reports
  zero vulnerabilities; package dry-run includes the migration; diff checks and
  pattern plus exact-current-token scans report zero secret matches.
- External gates remain: immutable independent review, exact-head policy/Verify,
  merge to `main`, exact-main deploy, logged-out remote asset/header/API/Chromium
  acceptance, and final submission synchronization. The author does not self-review
  or merge.

## 2026-07-18 KST — PR #16 immutable-review documentation correction

- Reviewed snapshot: base `3d0529e40c66d13a7e326778d26312f6051c55bc`, head
  `aa4b0b5dc43073b2921fead4a0d8457e7fbe062d`; Agent PR Policy and Verify passed.
- Independent result: runtime/D1 tests reproduced, but the reviewer correctly
  blocked because current submission documents simultaneously called Sites primary
  and Pages optional while other release evidence made Pages the intended final
  judge path.
- Correction: Pages is now the single intended final judge path; Sites is explicitly
  an emergency fallback whose provenance gate blocks only if Devpost ultimately uses
  Sites. The Devpost synchronization date and completed video state were refreshed.
- Handoff: publish a new immutable head, rerun exact-head policy and Verify, and
  require a complete fresh independent review before merge. The author does not
  self-review or merge.

## 2026-07-18 KST — Cloudflare Pages JavaScript MIME reconciliation

- Base: `b107a683e4d646b1b7940b241207d7740853e25f`
- Branch: `agent/codex-protocol-kernel--pages-js-mime`
- Trigger: PR #16 passed fresh immutable review, merged with the expected head, and
  post-merge Verify `29628252577/1` passed. Exact-main deploy `29628252629/1`
  successfully applied the D1 migration, configured runtime secrets, and published
  Pages, but the strict remote verifier rejected `app.js` MIME.
- Root cause: Cloudflare Pages serves JavaScript as `application/javascript`, while
  the repository manifest and local server declared `text/javascript`. Bytes,
  deployment, and D1 were not the failing boundary.
- Repair: declare `application/javascript` as the shared manifest/local-server MIME
  and pin it with an explicit Lab regression assertion. The verifier remains strict;
  no MIME mismatch is ignored or allowlisted at verification time.
- Handoff: rerun focused and complete gates, publish an immutable review head, and
  redeploy only after independent expected-head merge.

## 2026-07-18 KST — PR #17 canonical-root review correction

- Reviewed snapshot: base `b107a683e4d646b1b7940b241207d7740853e25f`, head
  `a44b5380b6525e6e76c96db572b81150645c5452`; exact-head policy, Verify, and
  Windows fresh-clone tests passed.
- Independent result: BLOCK. Live `GET` and `HEAD /index.html` return `308` to `/`.
  The manifest includes `index.html`, and the verifier's strict asset loop would
  therefore fail after the JavaScript MIME correction. The earlier MIME failure
  masked this deterministic next failure, while the local mock returned `200` for
  every path and did not reproduce Pages routing.
- Correction: keep redirects forbidden, but fetch manifest `index.html` at canonical
  `/`, whose bytes, MIME, and headers are already exact-contract inputs. The test mock
  now returns the real `308` for `/index.html` and asserts that the verifier never
  requests that alias.
- Handoff: publish a new immutable head and require complete fresh policy, Verify,
  Windows clone, and independent review before merge.

## 2026-07-18 KST — Exact-main release evidence freeze

- Base: `4bb8924d33b42be02bc9380ed6e3cee3eabd97b2`
- Branch: `agent/codex-protocol-kernel--release-evidence-freeze`
- Accepted predecessor evidence: PR #17 final head
  `4d792ae90448c9e6baf7734b768cd242f60120bc` passed exact-head Verify
  `29629764845/1`, final-body policy `29630353742/1`, immutable review, and
  expected-head merge. Post-merge Verify `29630532558/1` and Deploy MortalOS Lab
  `29630532541/1` passed at the base above.
- Public readback: the four-action logged-out proof established the committed
  baseline, obtained a `gpt-5.6-sol` `parent_hash_mutation`, recorded authoritative
  `reject / E_PARENT_UNKNOWN`, and reproduced the exact canonical digest with GPT
  off. The page displayed source commit `4bb8924d...` and release asset digest
  `sha256:VW018QRVpiK50L0YHwTPG0p5PP7dILdiay2Ia9aFc98`.
- Change: synchronize README and rolling submission evidence with the accepted
  Pages release; preserve video SHA mismatch, three genuine human tests, personal
  Devpost fields, and non-null `submitted_at` as explicit external blockers. The
  specification gate now requires the accepted/submission-evidence status string so
  stale repair-in-progress documentation fails closed.
- Local evidence: `npm ci` PASS with zero vulnerabilities; focused license/spec/link/
  governance gates PASS; complete `npm test` PASS in 1,395.8 seconds, including
  governance 30/30, conformance 76/76, seeded properties 10,000, Lab/API 17/17,
  portable byte equality and 10,000/10,000 rejects, R1 JS/Python 8 records,
  singleton, and H2. External link resolution passed for all three HTTPS targets;
  moderate dependency audit reported zero vulnerabilities; package dry-run listed
  103 files; diff checks and the high-confidence evidence-delta secret scan passed
  with zero matches.
- Handoff: publish one focused evidence PR and require exact-head policy/Verify plus
  a complete immutable reviewer snapshot.
  The resulting main SHA must redeploy and pass its own manifest readback before the
  final-source video is rendered. The author does not self-review or merge.

## 2026-07-19 KST — Custom-domain qualification and documentation consolidation

- Base: `03e868ccd810064e81275a7ac2d71b543030b916`
- Branch: `agent/codex-protocol-kernel--custom-domain-docs`
- Domain evidence: `mortal-os.com` is registered, Pages-attached, `Active`,
  SSL-enabled, and serves the accepted exact static manifest and asset digest. A
  valid scenario request consistently returned Cloudflare plaintext `502` from HKG,
  while the same exact deployment on `pages.dev` returned HTTP 200 JSON from ICN
  with model `gpt-5.6-sol`. Smart Placement and a fresh production deployment did
  not remove the fault.
- Remediation: pin Pages Function placement to targeted `aws:us-east-1`, retain the
  verified `pages.dev` workflow/judge URL until full custom-host acceptance, and add
  a config regression. Wrangler 4.111.0 compiled the Functions bundle locally.
- Documentation: added a compact docs map and a standalone Korean North Star roadmap
  with strict PASS/HOLD/rollback gates; consolidated current release evidence;
  removed four superseded planning/status/checklist/demo documents; updated README,
  traceability/access architecture, link/spec verification, and current agent
  memory/handoff while preserving the required closed policy-migration audit marker.
- Devpost: refreshed live requirements, project description, answers 27949/27951,
  and all required answers. Submission `1080076` remained `Submitted` with original
  non-null `submitted_at`, Individual/Korea/Developer Tools, the public 2:37 video,
  and exact private feedback-field readback (value intentionally omitted from the repository).
- Local verification: full `npm test` PASS in 1,397.4 seconds; governance 30/30;
  conformance 76/76; property 10,000; Lab/API 17/17; portable and actual Chromium
  byte equality with 10,000/10,000 rejects; R1 5/5 plus eight JS/Python records;
  local three-context Lab PASS; core coverage 96.00/92.64/95.22; governance coverage
  92.68/84.39/93.75; audit zero vulnerabilities; package dry-run 101 files; focused
  spec/link/config tests, diff check, and high-confidence secret scan PASS.
- Remaining gate: publish one immutable PR head, require exact-head policy/Verify and
  independent review, merge only the expected head, wait for post-merge Pages deploy,
  then re-run the custom-domain API/three-context acceptance. Promote the hostname
  and update Devpost only on PASS; otherwise preserve `pages.dev` through the deadline.

## 2026-07-19 KST — Exact-origin custom-domain API bridge candidate

- Base: `f23a4d501f89a4798d6d2a490000117774c69457` after PR #19, post-merge
  Verify `29655465238/1`, and deploy `29655465232/1` all passed. Exact static
  custom-host readback passed, but direct valid API requests still returned HKG
  plaintext `502`; the identical Pages-host request returned ICN HTTP 200 with
  `gpt-5.6-sol`.
- Branch: `agent/codex-protocol-kernel--custom-origin-bridge`.
- Design: when and only when the browser page origin is `https://mortal-os.com`,
  select the accepted Pages API origin. CSP permits that one origin; the Function
  permits only the exact primary-page/Pages-API pair, POST, and `content-type`
  preflight header. Same-origin behavior remains unchanged and attacker origins,
  extra headers, and other methods fail closed. Model output and protocol validity
  semantics are unchanged. The fixed remote GPT verifier consumes the same endpoint
  selector so the documented custom-domain evaluation cannot bypass the bridge.
- Local evidence: endpoint/CORS/preflight/security unit cases and combined Lab/API
  **19/19** PASS; local three-context Chromium PASS; final full `npm test` PASS in
  **1,159.0 seconds** with governance 30/30, conformance 76/76, property 10,000,
  portable 10,000/10,000, R1 5/5 plus eight JS/Python records, singleton, and H2.
  Core coverage remained 96.00/92.64/95.22 and governance coverage
  92.68/84.39/93.75. Actual Chromium 149, Wrangler compile, audit, 102-file package
  dry-run, four external links, diff whitespace, and high-confidence secret scan
  passed.
- Remaining gate: exact-head policy/Verify, independent immutable reviewer, expected-
  head merge, exact-main deploy, custom-host preflight/valid POST/three-context
  Chromium acceptance. Canonical docs/workflow/Devpost switch only after that PASS.

## 2026-07-19 KST — Canonical custom-domain acceptance

- PR #20 passed policy `29657957607/1`, exact-head Verify `29657949540/1`,
  immutable reviewer binding, expected-head merge to
  `3f482227b73e899d292ae98b13913b213e099150`, post-merge Verify
  `29658461252/1`, and deploy `29658461259/1`.
- First custom-host three-context Chromium readback correctly failed because
  Cloudflare injected `static.cloudflareinsights.com/beacon.min.js`, which the
  self-only script CSP blocked. Pages and zone RUM settings displayed disabled, so
  the source-controlled repair retained `no-store` and added standards-defined
  `no-transform` rather than expanding the script allowlist.
- PR #21 head `73657522aaf4a9722f33c14b74dc4e204c6d4433` passed policy
  `29660690604/1`, exact-head Verify `29660657159/1`, immutable COMMENT review
  `4729301191`, and expected-head merge to
  `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`. Post-merge Verify
  `29660983347/1` and deploy `29660983299/1` passed.
- Public custom readback passed: root `200`, exact `no-store, no-transform`, no
  injected beacon, strict CSP/COEP, exact manifest source, six digest-valid assets,
  aggregate digest `sha256:HYNcJotcdxxFCItMhI7_RP6_3oqpwTFsqcbS83xMD3A`,
  preflight `204`, valid GPT POST `200`/`gpt-5.6-sol`, fixed scenarios 25/25, and
  three clean Chromium contexts with the full 10,000-case corpus.
- Devpost submission `1080076` was updated in place: public story and Try-it-out link,
  judge instructions, and installation/testing answer now prefer
  `https://mortal-os.com/`; validation names 19 Lab/API cases, PR #20/#21, main and
  run evidence. Public readback passed. Submitter remains Individual/Korea, Session
  ID remains exact, video is unchanged, and status remains `Submitted`.
- Current task: reconcile README, workflow, roadmap, release evidence, access,
  traceability, and agent ledgers so the accepted custom host is canonical and
  `pages.dev` is explicitly only the incident fallback. No protocol or model-authority
  semantics change.

## 2026-07-19 KST — Multi-browser plan S0 accepted baseline

- Base/branch: exact `origin/main` and task HEAD both
  `8930992e5483c6b645af197348d5725a8648bd09` on
  `agent/codex-protocol-kernel--multi-browser-bilingual-plan`.
- Full local `npm test` exited 0 in 1,235 seconds: license/spec/links/governance,
  conformance, 10,000-case properties, Lab/API, R1, build, portable Node/browser
  10,000/10,000, JS/Python differential, singleton, and H2 all passed.
- Actual Chromium differential passed with byte-identical committed/browser results
  and 10,000/10,000 adversarial rejects. Three-context Lab acceptance passed all
  quorum pairs, storage absence, evidence replay, responsive/accessibility, GPT
  witness, and corpus gates.
- Public `https://mortal-os.com/` exact-source verification passed with six assets,
  aggregate digest `sha256:HYNcJotcdxxFCItMhI7_RP6_3oqpwTFsqcbS83xMD3A`, and
  source commit `8930992e5483c6b645af197348d5725a8648bd09`.
- Claim audit remains L0: one browser controls three logical keys and one failure
  domain. No persistence, remote custody succession, state transition, or independent
  endpoint resilience is currently claimed.

## 2026-07-19 KST — Multi-browser S1–S11 local release candidate

- Implemented optional GPT cost controls with atomic actor/global-minute/global-day
  admission, circuit breaker, Turnstile boundary, and deterministic fallback. The
  production flag is disabled and the workflow injects no model/Turnstile secret
  until an external widget is explicitly confirmed.
- Added English `/` and Korean `/ko/`, localized first paint/catalog parity, R1
  wire-only UI paths, public evidence import/replay, `mortalos-state/1` JavaScript/
  Python parity, consent-gated durable participant storage, deterministic virtual
  transport, and a Cloudflare Durable Object relay.
- Actual Chromium proves EN/KO A→B custody handoff, A closure, and same-identity B
  continuation. Node tests cover all complementary `2-of-3` endpoint losses and D
  repair; ten isolated Chromium quorum runs passed with trace digest
  `sha256:oCaFctzCFMgqRExG26PlZLvVh4nuosXpk65ghKxvSKU`.
- Reworked the site around one protagonist and one primary journey; advanced evidence
  is collapsed, QR generation is local, premature loss is visibly stalled, and
  deterministic screenshots/performance gates passed. The final full-suite cold-
  cache medians were LCP 294.9ms, CLS 0, and TBT proxy 35ms.
- Reconciled README, docs map, short North Star, access/incubator profiles, release
  evidence, Devpost copy package, and 2:30 video script. Private feedback-field data
  is not duplicated in repository artifacts.
- Remaining: full candidate suite/coverage/audit/package/secret checks, immutable
  independent review, expected-head merge, post-merge CI, exact relay/Pages deploy,
  public bilingual multi-browser acceptance, and Devpost/video final readback.
- Full ordered `npm test` then passed in 1,475.8 seconds with all new stage gates,
  portable 10,000/10,000 rejection, four state and eleven R1 JS/Python differential
  records, singleton, and H2. Coverage/audit/package/secret/clean-clone and external
  release gates remain separate.

## 2026-07-19 KST — PR #23 independent-review remediation

- Reviewer snapshot `da3d69182d74bd0ba5a0fea4a09e6ca738976440` correctly
  returned `FAIL` and was not merged. It found trailing whitespace contradicting the
  PR validation, per-room admission and idle-room alarm gaps, no execution of the
  exact 20-run persistent-profile S8 criterion, and UI wording that called a relay
  proposal verified before local acceptance.
- Relay admission now covers duplicate publish, range/presence reads, presence
  writes, and WebSocket connect. The 121st same-room duplicate returns canonical
  `429`; presence-only and connect-only rooms schedule alarms and remove metadata,
  presence, rate buckets, and sockets at expiry. The ingress also avoids the reserved
  `Fetcher.connect` name, normalizes DO RPC results before canonical encoding, and
  implements hibernated socket close/error handlers.
- `verify:persistent-handoff` launches two distinct persistent Chromium user-data
  profiles, refuses fewer than 20 runs, closes A's browser process after every
  accepted handoff, and requires B to advance the same identity to sequence 2.
  English and Korean pending copy remains explicitly unverified until B accepts.
- Focused relay runtime passed 5/5 without uncaught runtime errors. The persistent
  profile gate passed 20/20 alone in 1,134.9 seconds and again inside the complete
  Lab command, where ordinary Lab plus the 20-run gate passed in 564.7 seconds.
- The restarted full release sequence (`verify:spec` then `npm test`) passed in
  1,946.4 seconds. Chromium portable 10,000/10,000, transport 10,000/30,000 with
  digest `sha256:TdZsm_fWivLD5SCYfBvMs_ytghOgYxeDGet_y6mrgdM`, trusted-core
  coverage 94.70/92.31/95.22, governance coverage 92.68/84.39/93.75, and moderate
  dependency audit with zero vulnerabilities passed.
- Required next action remains immutable commit/push, exact-head CI and policy,
  complete fresh reviewer snapshot, expected-head merge, then exact production and
  Devpost readback. The author does not self-review or merge.

## 2026-07-19 KST — PR #23 second fail-closed rate-policy remediation

- The fresh reviewer snapshot at `a5f56c6ffbaed1146b04afeafb3aa1a6fdc7a549`
  returned `FAIL` and was not merged. Exact-head Verify `29691408680/1` and policy
  `29691433408/1` were green, but a normal A+B session produced 80 relay operations
  in 12 seconds (about 399/min) against the Worker's 120/min room ceiling. The
  persistent acceptance server had no rate counter and could not observe this P1.
- Added `src/transport/relay-policy.mjs` as the common Worker/browser/local-acceptance
  contract. Message polling is 1s, presence touch/read are 3s, and two active
  endpoints budget 204 scheduled operations/minute plus a 48-operation interaction
  allowance under the 300/min ceiling.
- The local relay now enforces the same fixed-window ceiling and records admitted and
  rejected operations. Runtime coverage prepares the live bucket at 299, proves the
  300th valid duplicate remains accepted and the 301st is canonical `429`, while all
  valid operation classes remain admitted through the same path.
- `verify:persistent-handoff` now measures the first two-profile active interval for
  12 seconds, requires 32–48 operations and zero local `429`, then completes all 20
  A→B handoffs with A process closure and B-only sequence-2 continuation. Focused
  relay, i18n, Lab, build, and two remediated 20/20 persistent runs passed; the
  evidence-logging run measured 39 operations/12s with zero local `429`.
- Required next action: complete the restarted full local gates, publish one new
  immutable head, wait for exact-head Verify/policy, and require a completely fresh
  reviewer snapshot before any merge, deploy, or Devpost change.
- Final remediation-tree evidence: ordered `npm test` PASS in 1,591.2 seconds; full
  `verify:lab` PASS in 375.7 seconds, including 20/20 persistent-profile handoffs and
  a repeated 39 operations/12s measurement with zero local `429` responses.
- Trusted-core coverage remained 94.70/92.31/95.22 and governance coverage
  92.68/84.39/93.75. Chrome 149 reproduced byte-identical portable results and
  10,000/10,000 adversarial rejects; dependency audit found zero vulnerabilities.
  Package dry-run contained a stable 138-file inventory. Archive/unpacked sizes
  varied across checkout EOL/compression conditions and are deliberately not release
  invariants. Two clean output directories reproduced seven assets at
  `sha256:BXGfiKgl2rK_tpXyOZWr_9baW1xqK2UomjGOq4fd3ME`.

## 2026-07-19 KST — Post-merge deploy Chromium-order correction

- PR #23 reviewer PASS attestation `5016543306` bound head `3aec0a6…`, latest
  policy `29695018597/1`, and Verify `29694994415/1`; expected-head squash merge
  produced main `d20e66083cd79084667beab8bc8269fbac447828`.
- Deploy `29695521487/1` failed closed at pre-deploy `npm test`. The workflow had
  installed Chromium only after source verification, so `verify-quorum.mjs` could
  not launch Playwright. Relay migration, Pages deployment, and public verification
  were skipped; production remained unchanged.
- Correction branch `agent/codex-protocol-kernel--deploy-chromium-order` moves the
  sole Chromium install immediately after `npm ci` and before `npm test`. A Lab
  contract assertion requires exactly one install and freezes install → source
  verify → relay → Pages → public verify order.
- Required next action: focused/full local verification, immutable PR/policy/Verify,
  independent expected-head review/merge, and a natural exact-main Deploy rerun. Do
  not bypass the reviewed workflow with a manual Cloudflare deployment.

## 2026-07-19 KST — Public-verifier environment isolation correction

- PR #24 passed immutable reviewer gate at head `fdfe7618…` and expected-head
  squash-merged as `e47e438db0e751e5d1d9f01a90933095fbd67906`.
- Natural Deploy `29696536158/1` confirmed the earlier Chromium-order correction,
  then failed closed in pre-deploy `verify:ux`. Job-level `MORTALOS_LAB_URL` made
  `npm test` navigate to the older accepted public site, where the new
  `#advanced-evidence` contract was not yet present. Relay, Pages, and public
  verification were skipped; no Cloudflare mutation occurred.
- Correction branch `agent/codex-protocol-kernel--deploy-env-scope` retains
  `MORTALOS_SOURCE_COMMIT` at job scope but confines public URL, expected commit, and
  retry controls to the final post-deploy release-verification step. A Lab contract
  test rejects future remote-environment leakage into pre-deploy source tests.
- Required next action: focused validation, immutable PR/policy/Verify, independent
  expected-head review/merge, natural exact-main Deploy, public acceptance, and
  Devpost reconciliation. No manual deployment bypass.

## 2026-07-20 KST — Pages configuration validation correction

- PR #25 passed policy `29696855759/1`, exact-head Verify `29696855730/1`, immutable
  reviewer attestation `5016740789`, and expected-head squash merge as
  `7d0b5d272b5e4ab5819ab89d6a628af9e82baec2`. Post-merge Verify
  `29697373508/1` passed.
- Natural Deploy `29697373574/2` passed exact-source verification and, after the
  existing API token received `Workers Scripts:Edit` plus `Workers Routes:Edit`
  limited to `mortal-os.com`, deployed the exact relay and Durable Object migration.
  It then failed closed before Pages upload: Wrangler 4.111 reported that Pages
  project configurations do not support the root `observability` key. Public
  verification was skipped and the accepted Pages artifact remained unchanged.
- Correction branch `agent/codex-protocol-kernel--pages-config-validation` removes
  the unsupported block only from root Pages `wrangler.jsonc`; relay observability
  remains in `relay/wrangler.jsonc`. The focused Lab regression requires Pages to
  omit the key and relay to retain its explicit logging/tracing contract.
- Focused evidence: clean `npm ci` with zero vulnerabilities; Lab 9/9; license,
  specification, governance 30/30, Wrangler 4.111 Pages Functions compilation,
  diff check, and high-confidence evidence-delta secret scan PASS. Required next
  action is exact-head gates, immutable independent review, expected-head merge,
  natural exact-main deploy, public EN/KO multi-browser acceptance, and Devpost
  reconciliation. No manual deployment bypass.

## 2026-07-20 KST — Canonical localized-index verification correction

- PR #26 passed body-bound policy `29698402179/1`, exact-head Verify
  `29698363683/1`, immutable reviewer attestation `5016895518`, and expected-head
  squash merge as `44771ae83e2d7450ff9cad654e7a0fae6d144c9e` with reviewed-tree
  equality. GitHub did not create the normal push check suite, so the repository's
  official `workflow_dispatch` path launched exact-main Deploy `29698934167/1`.
- That run passed exact-source verification, relay/Durable Object deployment, and
  Pages upload. Live readback shows source commit `44771ae…`, seven exact assets, and
  digest `sha256:BXGfiKgl2rK_tpXyOZWr_9baW1xqK2UomjGOq4fd3ME`. Final acceptance then
  failed because the verifier requested `ko/index.html` with redirects forbidden;
  Cloudflare correctly returns `308 Location: /ko/`. The other six canonical asset
  requests returned 200 with their exact media types.
- Correction branch `agent/codex-protocol-kernel--canonical-locale-route` maps root
  and nested `*/index.html` manifest entries to canonical directory URLs, while
  still comparing the returned bytes, MIME, headers, and digest with the exact local
  index file. The mock now exposes the real nested redirect and requires `/ko/` to
  be requested instead of `/ko/index.html`; a mutated localized index is still
  rejected through that canonical route.
- Focused evidence: clean `npm ci` with zero vulnerabilities; Lab 9/9; license,
  specification, governance 30/30, diff/secret checks, and direct H3B verification
  of the live seven-asset `44771ae…` deployment and `sha256:BXGfiKgl2rK_tpXyOZWr_9baW1xqK2UomjGOq4fd3ME`
  digest PASS.
- Required next action: focused and exact-head gates, immutable independent review,
  expected-head merge, official exact-main Deploy, full public EN/KO multi-browser
  acceptance, and Devpost reconciliation. No verifier relaxation or redirect-follow
  bypass is permitted.

## 2026-07-25 KST — Current dependency advisory remediation

- Fresh `origin/main` base:
  `03fc3ab07ea086642027deebe282a90d804c4991`.
- Current registry audit reports five high-severity findings:
  `GHSA-v2hh-gcrm-f6hx` through `fast-uri`,
  `GHSA-f88m-g3jw-g9cj` through `sharp`, plus affected `miniflare`,
  `wrangler`, and `@cloudflare/vitest-pool-workers` package ranges.
- Minimal remediation scope is the direct development dependency update from
  `wrangler` 4.111.0 to 4.114.0 and
  `@cloudflare/vitest-pool-workers` 0.18.6 to 0.18.8, with the generated lockfile
  delta plus the matching locked-version license assertion and third-party notice.
  No force fix, override, ignore entry, runtime feature, or deployment mutation is
  authorized.
- Required evidence: current audit zero high/critical, full repository verification,
  exact-head CI/policy, immutable independent review, expected-head merge, and
  post-merge Verify.
- The upgraded dependency graph hoists `@cloudflare/workerd-windows-64` to the root
  instead of retaining the older pool-local copy. The Windows runtime-test launcher
  now resolves either valid installed layout and still fails closed when neither
  binary exists.
- Exact candidate validation: `npm ci`, `npm test`, `npm run test:chromium`,
  `npm run verify:lab`, `npm run verify:transport`, `npm run test:coverage`,
  `npm audit --audit-level=moderate`, and `git diff --check` all PASS. Coverage is
  94.70% lines, 92.31% branches, and 95.22% functions; audit is zero findings.
- The first full run failed at the old pool-local Windows workerd path after every
  preceding license/spec/link/governance/conformance/property/state/transport gate
  passed. The launcher compatibility correction was applied and the complete suite
  was rerun from the start to PASS; the earlier narrowed run is not used as release
  evidence.
- Independent review of head `50063ab1e655bf884dd73da2fa2b19ac31dab0da`
  reproduced an old-graph compatibility defect: root workerd 1.20260710.1 was
  selected ahead of pool-local 1.20260714.1 and could not satisfy compatibility date
  2026-07-19. The remediation now prefers the pool-local binary and uses the hoisted
  root only as fallback. Two filesystem regression tests cover both-present
  precedence, hoisted-only fallback, and missing-install failure.
- The first complete rerun after that correction reached the relay runtime after
  conformance 76/76 and the seeded 10,000-case property suite passed, then hit one
  90-second Vitest pool startup timeout. An immediate focused relay rerun passed
  contract 4/4, runtime 5/5, and Wrangler dry-run. The interrupted full run is not
  claimed as exact-head PASS; remote Verify and a fresh local full rerun remain
  required for the changed head.

## 2026-07-25 KST — Post-hackathon North Star implementation plan

- Created task branch
  `agent/codex-protocol-kernel--post-hackathon-north-star-plan` from exact
  `origin/main` `03fc3ab07ea086642027deebe282a90d804c4991`, then rebased its
  plan-only commit onto dependency-remediated main
  `079e37dfdea8ce94998533979546b65cc09709d6`.
- Added plan-only
  `docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md`. It defines a gate-driven
  S0–S8 sequence: baseline reset, one Participant Core, crash-safe durable quorum,
  R3 state recovery, confidential state, SDK/CLI, one bounded Continuity Capsule,
  independent failure-domain burn-in, and later adversarial custody/browser parity.
- Structural audit passed: exactly nine ordered S0–S8 sections, every stage contains
  Goal / Implementation scope and deliverables / Strict PASS criteria / HOLD /
  rollback, and the plan contains 92 strict checklist items.
- Repository document gates passed: links, specification, governance `30/30`, and
  `git diff --check`.
- Planning-time `npm ci` succeeded. The original base audit reported five
  high-severity findings; prerequisite PR #29 remediated them without force fixes,
  overrides, or ignores, and the rebased plan now records the zero-finding main
  baseline while preserving the before/after evidence.
- This task changes no kernel, runtime, deployment, package lock, or production
  state. Next implementation authority begins with a separate focused S0 PR only.

## 2026-07-25 KST — S0 post-hackathon baseline reset

- Fresh implementation base:
  `7fd24209f6a4956d4710931fe53d9d4ca2a86b64`.
- Scope is limited to S0: one active North Star and claim matrix, historical contest
  archive map, v0/v1 documentation reconciliation, S1–S8 tracking, and one complete
  machine-validated baseline receipt. S1 runtime convergence is explicitly excluded.
- Required evidence is exact-source full verification, Chromium, Lab persistent
  handoff, transport differential, coverage, zero dependency audit, receipt digest
  readback, independent review, expected-head merge, and post-merge Verify.
- Frozen candidate source:
  `03ec496e9732c8d9f6861836bfce3c22f3fa6531`. Exact-source validation passed:
  `npm ci`; full `npm test`; actual Chromium with 10,000/10,000 adversarial
  rejections; Lab acceptance plus 20/20 persistent A-to-B handoffs; 10,000
  transport schedules and 30,000 endpoint recoveries; coverage at 94.70% lines,
  92.31% branches, and 95.22% functions; and dependency audit with zero findings.
- Baseline receipt creation initially failed closed because strict Ajv rejects the
  JSON Schema union-type array syntax. The schema now expresses scalar unions with
  `anyOf`; the transport base64url digest was also decoded to its exact hex value.
  The corrected `npm run verify:baseline` reads back all ten frozen artifact
  digests, the active-document inventory, and the known-limitations ledger and
  PASSes with receipt digest
  `sha256:50fda9cd7b9353e9e72ff1d7a06ab442cd00f4dc75d1cdbb01896da73a298a90`.
  The Verify workflow now enforces this receipt on every PR and main push.
- Remaining promotion gates: immutable exact-head reviewer PASS, expected-head
  squash merge, and successful post-merge Verify. S0 remains candidate until all
  three close.
- PR #38 initially reached policy PASS after correcting the PR-body risk delimiter,
  but independent review rejected head
  `80744c34df744e4e2996a1372e70f219b99ee640`: the receipt validator read artifact
  and lock digests but did not semantically verify `package_digests`, source/base
  provenance, or structured result counts. That snapshot was revoked and its
  still-running Verify was cancelled before approval or merge.
- The corrected validator now reads package, lock, and artifact bytes from the
  exact recorded source commit, proves that commit is a direct child of the
  recorded main baseline, checks the source freeze timestamp, requires an exact
  unique command inventory, and binds protocol/storage/crypto versions, seeds,
  topology scope, tracking issues, active documents, limitations, and every
  numerical result. Verify now uses full Git history. Five negative-evidence tests
  mutate package/artifact digests, source/base lineage, result counts, commands,
  timestamps, and inventories; every mutation fails closed while the committed
  receipt passes.
- The first complete run on the provenance-corrected local head passed the new
  receipt tests, conformance 76/76, properties 10,000/10,000, state and transport,
  relay runtime, and isolated quorum, then failed at an existing Lab workflow
  assertion because it required `persist-credentials` to be the first checkout
  option. The assertion now continues to pin checkout/setup action SHAs and
  credentials isolation while additionally requiring `fetch-depth: 0` on Verify.
  This interrupted run is not used as exact-head release evidence; the corrected
  head requires a full rerun from the start.
- The next exact head `9a2213fe72b91bdc5bbbef32f791c15be9ab6fb3`
  passed the complete local gate set, but independent same-cardinality negative
  reproduction found six more receipt substitutions that preserved schema shape:
  package path, active-document entry, limitation prose, non-property seeds,
  topology explanation, and environment values. The reviewer published a second
  SHA-bound BLOCK and no merge occurred; its remote Verify was cancelled.
- The receipt contract now pins the exact package/artifact inventories, active
  documents, limitation statements, all environment values, all seeds, topology
  scope, and complete command records. It also reads back the exact committed
  receipt digest after semantic verification, so any otherwise-unmodeled byte
  change fails closed. The formal negative suite is now 12/12 and includes all six
  reviewer substitutions plus an unmodeled timestamp mutation.

## 2026-07-25 KST — S1 Unified Participant Core

- Fresh implementation base:
  `4a3ede86402ba507c49fb5f563bf932fedd5eb1c`, the independently reviewed S0
  squash merge with post-merge Verify `30124569468/1` SUCCESS.
- Current architecture has three authoritative participant implementations:
  `LiveEndpointParticipant`, `DurableParticipant`, and
  `QuorumEndpointParticipant`. Each currently constructs bodies or envelopes,
  validates candidates, appends records, and derives a head; Durable and Live also
  duplicate state-transition construction, while only Quorum owns a sign-once
  journal. This is the exact S1 root defect.
- S1 will introduce one versioned deterministic operation/snapshot contract and
  explicit key/evidence/state/sign-once/transport ports. All acceptance, recognized
  head, proposal, signature-request, append, fork, catch-up, and availability
  branches move into the core. Adapters may expose storage/UI projections but may
  not import candidate builders, signing-message constructors, or validation
  capabilities.
- Required promotion evidence is the complete S1 strict matrix from
  `docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md`; no narrowed unit-only
  success or parallel authoritative legacy path is sufficient.
- Added versioned operation/snapshot/port contracts, internal protocol-object
  construction primitives, WebCrypto key adapter, deterministic model, and one
  `ParticipantCore`. Replaced the independent authority branches in the live
  incubator, Live endpoint, Durable reload path, and Quorum endpoint with core
  calls. The core uses R1 append semantics—not candidate shape validation alone—
  so a stale completed sibling becomes visible fork evidence instead of advancing
  a second recognized head.
- Added a source-boundary gate that rejects direct `r1-client`,
  `protocol-objects`, validator/lineage, or signing-message imports from adapters
  and UI. The core-only gate passes at 100.00% lines, 94.19% branches, and 100.00%
  functions, above the S1 95/90/95 threshold.
- Added a 10,000-seed participant model corpus with stable outcomes for missing
  state, insufficient quorum, duplicate signature, transport outage, conflicting
  tuple, stale parent, corrupt evidence, and append. Two Node executions and
  actual Chromium serialize 8,338,152 exact JSON bytes to
  `sha256:tECHi0pIS7pbOKPEdX1NYweTxCRPrPiNmASrAz0-1zo`.
- Focused integration passed: participant tests 10/10, existing multi-browser
  tests 7/7, isolated Chromium quorum 10 runs, Lab source/API 23/23, full local Lab
  acceptance, and 20/20 persistent English/Korean A-to-B handoffs with profile A
  closed and zero relay 429s.
- Fresh full `npm test` passed from the beginning, including conformance 76/76,
  property corpus 10,000/10,000, state 10,000 transitions, relay runtime 5/5,
  R1 7/7, UX, portable 10,000/10,000, state/R1 Python differential, singleton, and
  H2. Separate actual Chromium, transport differential, repository coverage, and
  dependency audit passed. Repository coverage is 94.70% lines, 92.23% branches,
  and 95.22% functions; audit reports zero vulnerabilities.
- S1 remains an implementation candidate. The next immutable boundary is a source
  commit directly descended from S0 main, followed by a machine-validated receipt
  commit, changed-head verification, independent review, expected-head merge, and
  post-merge Verify.
- Froze the source implementation as
  `1a0de4e750ebe0f4ec1f1f178e82563f14cf4e09`, whose direct parent is the S0
  squash merge `4a3ede86402ba507c49fb5f563bf932fedd5eb1c`. The worktree was clean before
  the exact-source release chain began.
- Re-ran the complete release chain on that immutable source. `npm test`,
  `npm run verify:lab`, `npm run test:chromium`,
  `npm run verify:transport`, `npm run test:coverage`, and
  `npm audit --audit-level=moderate` all completed with exit code zero. This exact
  run records conformance 76/76, property cases 10,000/10,000, state transitions
  10,000, isolated Chromium quorum 10 runs, persistent handoff 20/20 at 37 relay
  operations per 12 seconds with zero local 429s, portable and Chromium
  adversarial rejection 10,000/10,000, transport 10,000 schedules / 30,000
  recoveries, repository coverage 94.70% lines / 92.31% branches / 95.22%
  functions, and zero dependency vulnerabilities.
- Added the strict S1 receipt schema, validator, and 11-test negative suite.
  `evidence/stages/s1-participant-core.json` binds the immutable source and parent,
  the exact 24-file source diff and every Git-object digest, participant contract
  versions, complete command records, environment, seeds, behavioral matrix,
  negative outcomes, quantitative evidence, remaining limitations, and frozen
  receipt bytes. Receipt digest:
  `sha256:c34d8457f9a25cb1d76ef90d8d581c2864721e646c3b6aeb97218f5dc908b7b3`.
- The committed-receipt candidate passes `npm run test:s1-receipt` 11/11,
  `npm run verify:s1`, `npm run verify:spec`, and `npm run verify:links`.
  Promotion remains HOLD until a descendant evidence commit is independently
  reviewed at an immutable head, expected-head merged, post-merge Verify succeeds,
  and the production deployment is verified.
- PR #39 first reached clean policy and Verify on head
  `07aa025356909e5f65c87162f7f86f2bbe13f958`, but independent
  `reviewer-merge-gate` reproduction BLOCKed the snapshot before attestation or
  merge. `ParticipantCore.sync()` validated only the incoming set and replaced
  all local Pulse records, so sequence 2 silently fell to 0 after `sync([])` and
  to 1 after a prefix response.
- Corrected catch-up to monotonically union recognized and received evidence
  before deterministic sorting, deduplication, and R1 replay. Added explicit
  empty, prefix, duplicate, reordered, stale-peer, and post-fork incomplete
  response regressions. The recognized head no longer decreases, and an exposed
  fork cannot be hidden by a later incomplete peer response.
- Rebuilt the two-commit source/evidence history instead of leaving the repair
  outside the frozen receipt. The corrected source is the direct child of S0;
  the receipt descendant binds its new source SHA and all changed Git-object
  digests. A fresh detached exact-source install and complete release chain
  passed: core 10/10 at 100.00/94.83/100.00 coverage, conformance 76/76,
  properties 10,000/10,000, multi-browser 7/7, isolated quorum 10 runs, Lab,
  persistent handoff 20/20 at 38 operations per 12 seconds and zero local 429s,
  Chromium and portable 10,000/10,000, transport 10,000/30,000, repository
  coverage 94.70/92.31/95.22, and zero vulnerabilities.
- The replacement exact-source run began at
  `2026-07-25T00:31:38.5986126Z` and completed at
  `2026-07-25T00:57:28.4493734Z`; no result from the superseded source was used
  as evidence for `1a0de4e750ebe0f4ec1f1f178e82563f14cf4e09`.
- Replacement head `5bbbb8578a282063362a37276caeb2dd5a443bc7` passed current
  Policy `30135536623/1` and Verify `30135488202/1`, but a fresh independent
  review again BLOCKed it without attestation or merge. After a valid sibling
  fork was visible, a peer-supplied corrupt record was incorrectly retained
  because `sync()` treated aggregate `forked` as permission to skip all failed
  candidate results. The poisoned history then projected `stalled` and erased
  the known fork point.
- Catch-up now allowlists only `E_FORK_DETECTED`, `E_LINEAGE_ALREADY_FORKED`, and
  `E_REPLAY_STALE` as compatible non-accept outcomes in a valid fork
  reconstruction. Post-fork corrupt payload, malformed envelope, and
  below-quorum regressions each require their stable rejection code and verify
  that both records and the prior fork snapshot remain byte-equivalent after the
  failed sync. The source receipt and immutable review evidence must be rebuilt
  again before promotion.

## 2026-07-25 — S1 receipt post-squash portability correction

- PR #39 was independently reviewed and expected-head squash merged as
  `a4d5183941c82845532a003b55b03522e3e98872`, but both post-merge Verify
  `30139055068` and Deploy `30139055066` failed closed before deployment.
  Their depth-1 checkout could not resolve branch-only source commit
  `1a0de4e750ebe0f4ec1f1f178e82563f14cf4e09` after branch deletion.
- Receipt format v2 retains the reviewed source SHA, source timestamp, original
  24-artifact digest inventory, exact quantitative evidence, and attestation.
  It additionally binds the permanent promotion commit, its direct S0 parent,
  its exact 28-path diff, and all 28 promoted Git-object byte digests.
- The verifier no longer requires an unreachable PR branch object. It requires
  the frozen source/base/promotion identities, verifies base and promotion
  objects and direct-parent relation, checks validation and promotion chronology,
  and reads package lock plus every promoted artifact from the permanent main
  commit. Any source, base, promotion, path, digest, result, interval, review, or
  receipt-byte substitution still fails closed.
- A deliberate depth-1 clone proved that neither the base nor promotion object is
  available without history. `Verify` already sets `fetch-depth: 0`; Deploy did
  not. Deploy now uses the same full-history, no-persisted-credentials checkout
  contract, and a regression test requires both workflows to retain it. The
  fresh-clone acceptance therefore begins at depth 1, proves the obsolete source
  object is absent, fetches full main history, and verifies only the reachable
  base/promotion chain.
- Local validation passed: receipt negative suite 11/11, direct `verify:s1`,
  full `npm test`, core coverage 100.00/94.83/100.00, Participant Core
  Node/Chromium 10,000-schedule parity, conformance 76/76, properties
  10,000/10,000, multi-browser 7/7, isolated quorum, Lab, R1, portable
  10,000/10,000, state/Python differential, UX, singleton, H2, relay dry-run,
  and dependency audit with zero vulnerabilities.
- Promotion remains HOLD until an exact depth-1 clone passes after the hotfix
  commit is published, the immutable PR head passes policy and Verify, an
  independent review attests PASS, and post-merge Verify plus production Deploy
  both succeed on one exact main SHA.
- Fresh remote-clone acceptance passed on the published candidate: the checkout
  began with exactly one commit, fetched full reachable branch/main history,
  proved the old source object was absent, then passed the 12-test receipt suite
  and direct verifier. Commit count is deliberately not evidence because every
  evidence-only descendant changes it. Promotion remains HOLD only for immutable
  PR policy, remote Verify, independent review, expected-head merge, and
  exact-main post-merge Verify plus Deploy.

## 2026-07-25 — S2 crash-safe durable quorum candidate

- Replaced the browser-only snapshot path with one versioned
  `mortalos-durable-participant/2` document and a storage-neutral
  `DurableQuorumEndpoint`. The endpoint delegates all candidate construction,
  signing-request validation, replay, fork, custody, and state semantics to the
  S1 `ParticipantCore`; adapters own only key custody, atomic persistence, clock,
  consent, and fault injection.
- The durable document binds the non-extractable WebCrypto key, public key
  identity, canonical evidence, current state reference, sign-once journal,
  pending proposal/signature, cache-only committed head, explicit expiry,
  renewal/removal state, and migration metadata. Restore replays evidence and
  checks the key, custody, journal, and state reference instead of trusting the
  cached head.
- Signing now follows reserve intent -> create signature -> persist signature ->
  commit evidence/state/journal. Every operation has deterministic before/after
  fault boundaries in the Node adapter, while IndexedDB replaces the complete
  participant document in one strict transaction. Authority removal deletes the
  key and abandons incomplete signing entries while retaining public evidence;
  expiry and renewal are explicit operations with no hard-coded 30-day limit.
- Node fault and recovery tests pass 7/7. They cover durable `2-of-3` commission,
  every one-endpoint loss and D repair, all operation boundaries, reserve/sign/
  commit crash states, signer-call accounting, explicit expiry/renewal/removal,
  schema/key/evidence/journal/state/custody corruption, and fail-closed legacy
  migration.
- Actual Chromium acceptance passed 100/100 A-to-B cold-process handoffs and
  100/100 independent cold-restart transition/repair runs for each complementary
  A, B, and C loss. The migration gate separately proved valid v1-to-v2 upgrade
  and corrupt-v1 transaction abort with the original version-1 database retained.
- On the same candidate bytes, the ordered repository chain passed through
  `verify:ux`, including governance 30/30, S0 and S1 receipts 12/12 each, core
  coverage 100.00/94.83/100.00, Participant Core Node/browser parity over 10,000
  schedules, conformance 76/76, properties 10,000/10,000, state and transport
  10,000 schedules, relay runtime and dry-run, multi-browser, Lab, cost controls,
  R1, build, and UX. The terminal was externally interrupted immediately after
  starting `verify:portable`; a standalone continuation on unchanged bytes then
  passed portable 10,000/10,000, state and R1 Python differential, singleton,
  and H2. This is strong local candidate evidence, not a substitute for one clean
  immutable-head CI run.
- S2 remains `CANDIDATE_PASS` only after a frozen source commit, a machine-checked
  main-portable receipt, the complete exact-head Verify workflow, independent
  immutable review, expected-head merge, and post-merge Verify plus Deploy.

### PR #41 independent review BLOCK and concurrency/policy remediation

- Head `826d186609dc87b034fd847d983bf761068f1768` passed Trusted policy
  `30158974173/1`, exact-head Verify `30158719779/1`, and a clean uninterrupted
  local `npm test`. Independent reviewer comment `5078803913` nevertheless
  correctly BLOCKed promotion with no attestation or merge.
- Two endpoint instances restored from one revision could each blind-put a
  conflicting reservation, run separate signers, persist one last-write-wins
  journal, and return both signatures. The replacement storage contract performs
  an expected-revision read/compare/consecutive-write in one transaction.
  Deterministic Node and actual IndexedDB races now require the stale call to fail
  `E_DURABLE_CONFLICT` before signer invocation, one signature to return, one
  journal entry to persist, and the losing body to remain forbidden after restart.
- Legacy `authority_removed = true` with a retained key is now an inconsistent
  snapshot, as is active authority without a key. Pure and actual IndexedDB
  migration regressions require both upgrades to abort and retain the version-1
  database unchanged.
- Authority policy now has an `expired` state and `expired_at` latch. Restore or a
  signing attempt that observes reached expiry commits that latch through CAS.
  Same-process and cold-restart clock rollback cannot restore authority; only an
  explicit CAS-protected renewal beyond the persisted high-water mark can reactivate
  it, while removal remains irreversible.
- Focused replacement evidence passes Node durability 8/8 and full actual
  Chromium 100/100 for handoff plus 100/100 for each A/B/C loss/repair matrix.
  The same browser run passes two-instance IndexedDB CAS with zero stale signer
  calls, same-process and cold-restart expiry rollback rejection, valid migration,
  and retention of corrupt, removed-with-key, and active-without-key version-1
  databases. The old source and receipt are superseded and must be rebuilt before
  any updated PR head is pushed.

### PR #41 second independent review BLOCK and renewal-bound remediation

- Exact replacement head `eabdb019e2430b00276a9f691916717d5f3e3509` closed the
  concurrency, migration, and clock-rollback findings, but independent reviewer
  comment `5079622973` correctly BLOCKed promotion: an already-expired authority
  could call `renewAuthority(null)`, clear both expiry fields, and regain indefinite
  signing authority.
- The next replacement permits expired-authority renewal only with a non-null
  expiry strictly beyond the persisted observation high-water mark. Null, stale,
  and equal renewals return `E_DURABLE_POLICY`, leave the authority expired, and
  cannot invoke signing. Node and actual IndexedDB regressions must prove these
  properties before a valid future renewal succeeds.
- This remediation changes source bytes and invalidates the prior receipt, PR-body
  snapshot, exact-head CI, and review decision. A new frozen source, rebuilt S2
  receipt, complete exact-head gates, and fresh immutable review are required
  before expected-head merge.

### PR #41 third independent review BLOCK and legacy-store retirement

- Exact head `f51a6867d7f5450d89ce6e8b39e3c5098b7db609` passed local
  exact-head `npm test`, policy `30171963307/1`, and Verify `30171939595/1`.
  Independent reviewer comment `5080410491` confirmed all prior P1s closed but
  found a new authority bypass: successful v1-to-v2 migration copied the
  non-extractable key into `participant` without deleting legacy `keys/active`.
- After `removeAuthority()`, the v2 document was removed/null-key but the legacy
  key remained usable by same-origin WebCrypto signing. This contradicted both
  the one-document storage contract and atomic key-removal claim.
- The replacement version-change transaction reads and validates all legacy
  records, schedules the v2 document write, and deletes `evidence`, `keys`, and
  `meta` stores atomically. Any read, validation, write, or schema-deletion failure
  aborts the transaction and retains the complete version-1 database.
- Actual Chromium regression must prove a successful database contains only the
  `participant` store and that post-removal state is `removed` with no participant
  key, no legacy key, and no raw signing path. Existing invalid-migration cases
  must still abort at version 1 unchanged.
- The focused replacement run passed Node durability 8/8 and actual Chromium with
  reduced 1/1 handoff plus 1/1 per A/B/C loss matrix. The browser inspection proved
  valid and empty v1 upgrades expose only `participant`, invalid v1 upgrades retain
  exactly `evidence`, `keys`, and `meta` at version 1, and removal leaves neither a
  participant key nor a legacy raw-signing path.
- Because these source and evidence bytes differ from `f51a686`, the previous S2
  receipt, schema, verifier, and receipt tests were removed from the source
  candidate. They may be rebuilt only after the replacement source commit passes
  the complete uninterrupted release chain.

### 2026-07-26 — S2 post-squash promotion-mode receipt regression

- PR #41 was independently reviewed at exact head
  `68a0e1cb47a627cec5b4a52099781cb6aff57921`, squash-promoted to main as
  `55db1a9b73bcffeeb4a4812ad408d31b8a4e673f`, and then failed both exact-main
  Verify `30178769037` and Deploy `30178769027` before deployment.
- The receipt verifier itself correctly found promotion commit `55db1a9b`, source
  `2ef4ea9e55e6d8ebfc1934dd38a663cb0befda90`, receipt
  `sha256:d757c480f1cf4ebb55e62c4d66e3c48e60f870c24d2c0bdc98c15b4f7ebcdfeb`,
  and 28 exact artifacts. The first receipt test alone incorrectly required
  `mode === "candidate"` in every repository state.
- The test now derives the expected state from exact Git ancestry. Candidate mode
  still requires no promotion commit; promotion mode requires a 40-hex promotion
  commit that remains an ancestor of current HEAD. Every verifier, receipt,
  schema, evidence, runtime, and workflow byte remains unchanged.
- Focused validation passed S2 receipt mutations 12/12 and direct promotion-mode
  `verify:s2`. A clean uninterrupted full `npm test` then passed governance 30/30,
  S0/S1/S2 receipts 12/12 each, Participant Core 10/10 and 10,000 schedule parity,
  Node durability 8/8, actual Chromium handoff and A/B/C loss/repair 100/100 each,
  conformance 76/76, properties 10,000/10,000, state and transport 10,000,
  multi-browser 7/7, Lab/API 23/23, cost controls 14/14, R1 7/7, UX, portable
  10,000/10,000, JavaScript/Python differentials, singleton, and H2.
- Promotion remains HOLD until this correction passes exact-head policy and Verify,
  independent immutable review, expected-head merge, and exact-main Verify plus
  Deploy.
- PR #42 head `e6dff823f5f089c527ab82e1ed3e779fef1924a2` passed policy
  `30180258137` but exact-head Verify `30180258092` failed the synthetic squash
  test. The helper used `git write-tree`, which reads the mutable index. The local
  pre-commit run therefore synthesized the unchanged main tree, while CI's clean
  checkout synthesized the PR head and correctly detected the changed HANDOFF
  digest. The replacement helper resolves an explicit committed tree: the found
  promotion commit in promotion mode, or committed HEAD in candidate mode. No
  uncommitted or staged index state can influence the synthetic receipt proof.
- Replacement head `43c384e0162e981eb670aed7c5c3dbea9bcf84ca` passed a
  second clean uninterrupted local `npm test` and policy `30181648416/1`.
  Exact-head Verify `30181647893/1` passed its own full `npm test`, Participant
  Core parity, and portable comparison, then failed the standalone `verify:lab`
  step because `runDurableProof()` waited for
  `#durable-status[data-state="accept"]` immediately after nurture. That selector
  was already true from durable creation, so CI could read sequence `0` before the
  async click handler committed sequence `1`.
- The Lab verifier now waits for the authoritative public snapshot to expose both
  `sequence === "1"` and `pulse_count === 1` with the existing 20-second bound.
  This removes the stale-status race without sleeping, relaxing assertions, or
  changing product/runtime behavior.
- The corrected `npm run verify:lab` passed three consecutive focused runs. Every
  run completed the full actual-Chromium Lab gate and persistent handoff 20/20;
  measured relay cadence was 38–39 operations per 12 seconds with zero local 429s.

### 2026-07-26 — S3 R3 state availability and recovery candidate

- S2 correction PR #42 independently PASSed at
  `a86ba9a8a5f2baea1de306b982c0df2da3990a19`, squash-merged as exact main
  `e04a579081d96a834455abba79c66e4a102a4487`, and passed post-merge Verify
  `30185065340/1` plus Deploy `30185065328/1`. The live artifact digest is
  `sha256:rmbyXLL2vg0rnHkzWw5yQRazHLADxd9acrQr3M-iqt4`; public Chromium and
  persistent handoff 20/20 passed. Issue #31 was closed with this evidence.
- S3 defines a raw-only canonical state-package manifest, deterministic transition
  input and receipt, domain-separated chunk/resource/state/receipt hashes, fixed
  64 KiB chunks, a 4 MiB resource ceiling, at most 64 chunks, eight sources, and
  64 inventory entries per source. The reference resource is deterministic 1 MiB
  split into 16 distinct chunks.
- `mortalos-state-package-transition/1` is dispatched through the existing
  `state-transition` validator. Exact manifest, receipt, genome, parent root, next
  root, and event payload are required; adapters never receive validation
  capability.
- Content-addressed recovery treats inventories as hints, verifies each fetched
  chunk and the reconstructed aggregate root, and updates the active record only
  after complete verification. Missing chunks return `state_unavailable`;
  interruption leaves the prior active record and resumable verified chunks.
- Focused S3 tests pass 12/12: exact 1 MiB binding; strict semantic-input and
  constructor rejection; lineage acceptance and receipt tamper rejection; each
  any-two pair after third-replica plus relay deletion; missing-state preservation;
  changed/reordered/duplicate/wrong-size/wrong-manifest/stale/oversized/decoding/
  inventory/source bounds; resume/idempotence; and the seeded matrix.
- The independent Python verifier reproduces all 16 chunk digests, resource root,
  manifest, next state root, input, and receipt bytes. Existing state tests pass
  4/4 including 10,000 transitions; full conformance and mortality pass 76/76,
  including the calibrated 1,152-unit boundary and unchanged H2 golden trace.
- Promotion remains HOLD until source freeze, exact S3 receipt, full `npm test`,
  immutable independent review, expected-head merge, and exact-main Verify plus
  Deploy.

### 2026-07-26 — S3 independent-review remediation

- The first independent review BLOCKed unknown input semantics, ambiguous
  `active:after` publication, and constructor-produced repeated chunk digests.
  Shared semantic validation, staged activation, constructor rejection, direct
  dispatcher and signed-lineage probes, and both activation-boundary retries close
  those findings.
- The second independent review confirmed those three fixes, then correctly
  BLOCKed the 10,000-schedule gate because it exercised only the planner while the
  plan, receipt, and PR claimed end-to-end recovery. It also found the active SSOT
  still named base `d0a9ba0` and a nonexistent `test:state-recovery` command.
- The replacement matrix uses a fixed two-chunk package and runs every one of
  10,000 seeded schedules twice through the public `recoverStatePackage` path.
  Healthy, partial, tampered, metadata-only, and interrupted cases exercise actual
  inventory, fetch, chunk verification, reconstruction, aggregate verification,
  activation, and prior-state preservation. The SSOT now binds base `e04a579` and
  the real `npm run test:state-package` command.

### 2026-07-26 — S3 promotion closeout

- PR #43 head `cbd38b00717cfa128699f63dd401fb887c555d11` passed policy
  `30201025754/1`, exact-head Verify `30201006539/1`, and fresh independent review
  comment `5083500477`. The parent independently reproduced body SHA-256
  `54f941fc62f69b46a3552034f77e0e13b2f503d1eda3483b422a5bfbe39eb8f3`
  and the 29-file JCS digest
  `b7333e376ba43ddb9fa9a627fdad327f1a2f9f574651837894c11d0c3386c210`.
- Expected-head squash promotion produced exact main
  `1f8c055f1cf6fb4ee304f0b61cbe6507c65dba7d`. Exact-main Verify
  `30202501790/1` passed.
- Deploy `30202501782/1` verified source and published relay/static artifacts, then
  failed closed because the custom domain served one stale `corpus-worker.js`
  digest for its 60-second propagation window. Direct custom, cache-busted,
  immutable-deployment, and canonical-pages readback converged to the expected
  135,829-byte digest
  `sha256:pBSBXgGtcOlV_x5o1X6IB6ShZIhl0i0MiJMdbJvYKjg`.
- Attempt `30202501782/2` reran exact-source verification, relay and static deploy,
  seven-asset public readback, public Chromium, English/Korean acceptance, and 20
  persistent A-to-B handoffs and passed. Issue #32 was closed as completed.

### 2026-07-26 — S4 cryptographic ADR candidate

- Runtime implementation remains HOLD. This documentation-only branch proposes
  `mortalos-confidential-state-suite/1` for independent review before code:
  AES-256-GCM with 128-bit tags, deterministic 96-bit IVs from a fixed suite field
  plus durable per-key 64-bit invocation counter, and
  RSA-OAEP-3072-SHA-256 recipient-specific epoch-key wrapping through WebCrypto.
- The ADR separates signing and encryption keys; binds organism, membership, epoch,
  resource, chunk position, lengths, prior root, and counter through canonical AAD;
  rotates a fresh epoch key on membership change; and requires atomic old-or-new
  recovery at every write boundary.
- The only future-member claim is denial of epochs created after removal. The ADR
  explicitly rejects retroactive secrecy, secure erasure, endpoint-compromise
  resistance, traffic-analysis resistance, and decryption-as-validity.
- Required implementation evidence includes standard and Node/Chromium vectors,
  one million unique IV records, relay/store capture, any-two ciphertext recovery,
  removed-member future denial, authentication adversaries, full rotation fault
  injection, exact S4 receipt, independent implementation review, and exact-main
  deployment.
- ADR candidate checks pass: locked install audited 93 installed packages with zero
  vulnerabilities; license, specification (81 relative links), release-link
  inventory (53 local and 12 HTTPS syntax-only), governance 30/30, and
  `git diff --check` are clean. Runtime and dependency files are unchanged.
- PR #44's first Verify correctly exposed a post-promotion regression in the S3
  receipt test fixture: its synthetic GitHub merge borrowed the mutable current
  branch tree, so the newly added ADR path was incorrectly counted as an S3
  promotion artifact. The fixture now obtains the immutable discovered S3
  promotion tree (or the candidate HEAD before promotion) before constructing the
  synthetic merge. Production receipt verification remains unchanged.
- The first independent PR #44 review correctly BLOCKed the ADR because a shared
  epoch AES key plus an endpoint-local durable counter can reuse a GCM IV after
  cross-endpoint failover, and because a JSON-number epoch cannot preserve the
  advertised unsigned 64-bit range under JCS. It also caught two Markdown
  hard-break spaces that made the claimed `git diff --check` result false.
- The remediated contract makes allocation epoch-wide through one linearizable
  compare-and-swap authority, forbids encryption until an authenticated
  non-overlapping reservation receipt is committed, retires the key if authority
  state is lost, and initially claimed concurrent/failover/local-only/overlap
  rejection. Epochs and counters are canonical decimal strings through
  `2^64 - 1`; the trailing whitespace is removed.
- The second independent review kept PR #44 BLOCKed because “authenticated
  reservation receipt” still omitted exact schema, signature bytes, domain,
  verification key, and epoch binding, while decimal counter representation was
  not exhaustive across reservation, package, receipt, and active surfaces.
- The next remediation binds a distinct strict Ed25519 counter-authority key and
  ID into the exact epoch-ID basis; freezes the reservation basis, signature
  preimage, receipt, digest, package binding, arithmetic, and key-retirement
  rules; and adds an exhaustive per-surface decimal matrix with `2^32`, `2^53`,
  and `2^64` boundary vectors. Authority compromise is now an explicit nonclaim.
- The third independent review correctly BLOCKed a remaining claim contradiction:
  two individually valid receipts signed by a compromised bound authority cannot
  both be rejected without joint history, so “overlap rejection” exceeded the
  stated non-Byzantine model. It also found no authority-only successor procedure
  when membership stays unchanged.
- The corrected ADR conditions confidentiality on a conforming uncompromised
  authority, chains receipts into the atomic active record, requires exactly one
  CAS successor in the honest reference model, and detects valid forks only when
  jointly observed. Such evidence disables writes and triggers a quorum-authorized
  unchanged-membership `N→N+1` rotation with fresh authority and AES keys,
  re-encryption, rewrapping, and old-or-new atomic recovery. Hidden forks and prior
  exposure remain explicit nonclaims.

## 2026-07-27 — S4 confidential-state runtime candidate

- Base: exact promoted ADR main
  `39529337b2a739b1aee4697e680643d77704bbaa`.
- Branch/worktree:
  `agent/codex-protocol-kernel--s4-confidential-state` /
  `codex-protocol-kernel--s4-confidential-state`.
- Implemented `mortalos-confidential-state-suite/1` under `src/confidential/`:
  canonical unsigned-64 decimal surfaces, strict Ed25519/JCS counter receipts,
  one epoch-wide CAS authority, `MOS4 || uint64_be(counter)` IVs,
  AES-256-GCM chunks, RSA-OAEP-3072-SHA-256 recipient wraps, ciphertext-only S3
  layering, authorized recovery/decryption, and old-or-new epoch activation.
- Custodian RSA private keys and recovered AES keys are non-extractable. S3 receives
  the canonical confidential package bytes, not application plaintext or its
  domain-separated internal commitment.
- Focused exact-head evidence passed: 32-way CAS produced one success; sixteen
  concurrent writer loops allocated exactly 1,000,000 distinct IVs with zero
  collisions; valid joint forks exposed explicit authority equivocation; lost,
  stale, rollback, overflow, replacement-key, and malformed-receipt paths failed
  closed.
- Pinned C2SP/Wycheproof RSA-OAEP-3072/SHA-256 tcId 1 at upstream commit
  `b61843a9a5115bb758134b6a1f5d5e502d445342` and the NIST AES-256-GCM zero vector
  pass in Node and actual Chromium with byte-identical JCS fixtures.
- Relay/store capture contains no reference plaintext marker or public plaintext
  commitment. Every `AB`, `AC`, and `BC` logical S3 replica pair reconstructed the
  ciphertext package and an authorized current custodian decrypted the exact
  one-MiB resource after third-replica and relay deletion.
- Membership rotation omitted the removed `N` recipient from all `N+1` wraps;
  its complete old capture and private key could not decrypt future state while a
  survivor could. Joint authority equivocation also rotated unchanged membership
  with a fresh authority, epoch ID, AES key, complete re-encryption, and rewrap.
- Injected failure after counter commit, every wrap, every chunk, package
  verification, rotation recovery/successor construction, and before/after active
  commit retained either the complete old or complete new epoch.
- Focused S4 coverage is 96.59% lines / 90.58% branches / 100% functions. The full
  repository coverage gate also passed at 96.22% / 92.17% / 96.75%. Dependency
  audit covers 177 records with zero findings; spec checks bind 101 rejection codes
  and all documentation links.
- Remaining release work: freeze the complete source commit; run the full ordered
  `npm test`; create and negatively test the exact S4 receipt; rerun all immutable
  gates; obtain independent implementation review; expected-head merge; and require
  exact-main Verify plus Deploy. No S4 promotion claim exists before those gates.
- The first full ordered candidate run reached the final portability gate after all
  S2, protocol, S3, S4, transport, relay, multi-browser, Lab, cost, R1, build, and
  UX gates passed. It correctly failed because the static portable scan treated a
  local variable named `document` in `src/confidential/package.mjs` as a DOM
  dependency. Renaming that value to `parsedPackage` changed no bytes or behavior;
  the focused portable rerun passed 22 modules, Node/browser byte identity, and
  10,000/10,000 adversarial rejections.
- Source-freeze review then found a real architectural gap: the million-IV test
  used logical endpoint loops against only the in-memory authority, and package
  verification accepted a declared `epoch_id` without recomputing its authority
  basis. The candidate now includes a versioned IndexedDB/Web Locks authority
  adapter. Actual Chromium proves exactly one winner across two endpoint pages and,
  after complete browser-process termination, restores the same non-extractable
  Ed25519 key and advances the persisted receipt chain from counter 1 to 2.
- Confidential manifests now include `transition_id`. Creation and import
  recompute `epoch_id` from the signed receipt authority, sorted current wrap-key
  set, epoch, membership, organism, and transition. A substituted local authority
  is rejected before its reservation method is invoked. The strengthened Node
  package/S3 suite passes 11/11 and the expanded actual-Chromium vector/failover
  verifier passes. A new complete ordered run remains required before source
  freeze.
- The complete strengthened pre-freeze `npm test` then passed in one uninterrupted
  ordered chain. It included S0/S1/S2/S3 receipt negatives, Participant Core
  100/94.83/100 coverage and 10,000 Node/Chromium schedules, S2 actual Chromium
  handoff plus every A/B/C loss at `100/100`, 76 protocol tests, 10,000 property
  cases, 10,000 deterministic state transitions, 10,000 S3 recovery schedules,
  exactly 1,000,000 distinct S4 IVs with zero duplicate, all 20 confidential-state
  cases, the expanded actual-Chromium durable authority gate, relay,
  multi-browser, Lab/API/cost/R1, build/UX, 22-module portable parity with
  10,000/10,000 adversarial rejections, independent Python state/state-package/R1,
  singleton/H2, and the promoted S3 receipt. This run proves the candidate tree,
  not yet the post-commit temporal receipt; the frozen source must rerun before S4
  evidence is authored.

## 2026-07-27 — S4 independent-review security remediation

- Independent review froze PR #45 at head
  `9f2236dc60ed826ccb7639e2b0f165385976972a` and returned **BLOCK**. No PASS
  comment, merge, deployment, or promotion claim was made.
- Four findings were reproduced: recovered AES handles retained encrypt usage;
  jointly observed valid forks left their authority writable; rotation accepted a
  caller-authored `quorum_validation: "accepted"` literal; and the last-character
  Base64URL mutation could be a no-op.
- Remediation makes recovered AES handles non-extractable and decrypt-only;
  deterministically flips a decoded ciphertext byte; requires module-private
  validator-branded current and direct-child membership heads plus exact
  current-quorum Ed25519 signatures over a domain-separated rotation basis; and
  binds reason, old/new epochs, membership heads, next authority ID, and resulting
  encryption-key digests.
- Joint-fork observation now accepts only an actual bound
  `LinearizableCounterAuthority`, retires it, confirms the retired record, and
  returns WeakSet-branded evidence. Cloned or forged evidence cannot authorize
  rotation. Lost-authority rotation likewise requires an actual bound authority,
  rejects reuse and membership changes, and succeeds only after its state is
  genuinely inaccessible.
- Focused remediation evidence: package/rotation tests pass `9/9`; the combined
  counter run allocated exactly 1,000,000 distinct IVs with zero duplicates and
  passed its remaining counter cases. The combined run's sole failure was a
  misplaced new test block; after relocating it, the package suite passed. A new
  frozen source, full ordered suite, fresh receipt, replacement PR, independent
  review, merge, and exact-main Verify/Deploy remain required.
- The first clean-worktree full source run passed specification, governance, and
  S0-S3 receipt gates, then failed closed because `package.json` invoked the not-yet
  authored S4 receipt test. Source and evidence phases are now explicit: the source
  commit runs the complete runtime suite without S4 receipt/verification commands;
  the later evidence commit alone adds the S4 receipt, verifier, negative tests,
  and Verify/Deploy receipt gates.

## 2026-07-27 — S4 second independent-review authority-boundary remediation

- Independent review froze replacement PR #46 at head
  `a16e2326a0bfda21660cf02bbca770f8c9108884` and returned **BLOCK** in
  review `4782830849`. No merge, deployment, or PASS attestation was made.
- The reviewer reproduced two related gaps. A subclass could override public
  `descriptor`, `inspect`, and `retire`, authorize a false lost-state rotation,
  or brand equivocation without retiring the real store. The actual persistent
  `IndexedDbCounterAuthority` wrapper also failed the `instanceof` gate, so the
  browser implementation could not perform the claimed recovery paths.
- The remediation rejects subclass construction, freezes exact authority
  instances, and binds exact authorities plus persistent facades to a
  module-private WeakMap record. Rotation and equivocation use direct record-backed
  descriptor, inspection, and retirement operations; they never call overrideable
  public methods. Proxies, prototype lookalikes, arbitrary caller objects, and
  unbranded wrappers fail closed.
- The IndexedDB adapter now returns a frozen facade whose hidden record resolves to
  the exact underlying authority. Focused Node tests cover subclass/proxy/lookalike
  rejection, prototype override resistance, real store retirement, and successful
  lost/equivocation rotation through a facade. The actual-Chromium gate additionally
  requires the persistent facade to be internally branded, directly retired, and
  unable to reserve after retirement.
- The blocked source/receipt pair remains invalid. This remediated tree must be
  frozen as a new direct-main source commit, then pass an uninterrupted exact-source
  suite before a fresh receipt promotion, replacement PR, immutable independent
  review, expected-head merge, exact-main verification, and deployment.

## 2026-08-02 — Separate reviewer identity and dual attestation gate

- GitHub App `mortalos-review-gate` was installed only on
  `YongHwan2161/mortalos`. Its first exact-head `APPROVE` proved a separate App
  identity but did not count toward branch protection because GitHub Apps are not
  write collaborators.
- Machine-user `ant713900-web` accepted repository `write`, has no administrator or
  ruleset bypass, and issued native review `4834922160` for exact head `e7ccbba…`.
  GitHub changed PR #51 from `REVIEW_REQUIRED/BLOCKED` to `APPROVED/CLEAN`.
- That approval intentionally exposed an SSOT mismatch: the candidate policy still
  recorded a null reviewer principal. This remediation replaces that HOLD record
  with the actual machine-user, explicitly records same-operator limitations, and
  requires both native approval and App-owned check `MortalOS Reviewer Attestation`.
- `security/reviewer-attestation.mjs` defines one canonical snapshot covering base,
  head, exact PR-body digest, paginated changed-file digest, Git-object diff digest,
  trusted policy run, required exact-head runs, reviewer version, PASS-receipt
  digest, and review time. Focused mutation tests prove every bound field changes
  the digest and stale, foreign, incomplete, or duplicate evidence fails closed.
- Credentials are forbidden from repository files and PR-executing workflows. The
  operational runner is provisioned outside the checkout. The policy still does not
  claim separate human, administrator, provider, host, or custody control.

## 2026-08-02 — Independent-review P0 remediation and runner issuer binding

- Independent review froze PR #51 at base `49c5302…`, head `a7ea8b8…`, and PR-body
  SHA-256 `9f41f4…`, then returned BLOCK. A same-endpoint/same-body barrier produced
  signer calls `2`, fulfilled promises `2`, and write trace
  `initialize,reserve,signature,signature`. Alias and shallow-freeze ownership
  bypasses also returned an empty violation list in the old AST checker.
- The durable endpoint now snapshots the full invocation before suspension,
  serializes owned signing operations on a module-private tail, and captures exact
  revisions for reservation and signature commits. The regression requires the two
  concurrent callers to receive the same approval while the signer and signature
  WAL each run exactly once.
- The ownership verifier now performs transitive identifier taint across alias,
  object/property, spread, destructuring, loop, and deferred-closure paths. Only a
  verifier-maintained deep-own/brand-clear allowlist can remove taint. Nine security
  modules are automatically inventoried; all 56 exported async functions and class
  methods must be directly audited or carry a concrete reviewed classification.
  Sixteen high-risk entrypoints are directly checked and hostile negative corpus
  covers the prior bypasses.
- Runtime hardening found by the stronger audit copies WebCrypto signing bytes,
  custodian wrap descriptors, AES vector buffers, and rotation records/arrays before
  suspension or reuse. All S4 ceilings now generate from the protocol profile and
  the exact mapping is tested. The external runner verifies GitHub Actions App ID
  `15368`, exact run/job identities, and its own repository-pinned SHA-256 before it
  can attest or approve.
- Focused evidence before source freeze: durable suite `12/12`, confidential package
  suite `11/11`, ownership AST `7/7` plus 16-entrypoint audit, protocol/format `5/5`,
  and ruleset-policy PASS. A new uninterrupted full suite, commit/push, exact-head
  CI, fresh independent review, App check, and machine-user native approval remain
  required. App Checks permission remains a user-owned live configuration HOLD.

## 2026-08-02 — PR #51 promotion and product-continuity documentation reset

- Independent reviewer revalidated exact head `8cc5375…`, required CI, App
  attestation, machine-user native approval, unresolved-thread count, and no-bypass
  ruleset immediately before expected-head squash merge. Main became `12e90e6…`.
- Repository analysis found the next root gap: the SDK, verification CLI, Capsule,
  real chunk data plane, and Lab pass independently but are not composed into one
  supported create/handoff/recover/continue user workflow. The CLI has no creation
  or continuation command and no Lab/Functions/Relay/example imports the new product
  surface.
- The active implementation SSOT was renamed to `docs/IMPLEMENTATION_PLAN.md` and
  recentered on a real-file A-to-B vertical. Duplicate roadmap and stage-tracking
  files were retired; their live priorities and issue links moved into the SSOT.
- Normative protocol, threat, traceability, ADR, claim history, archived contest
  evidence, and dirty historical worktrees were preserved. This change is
  documentation-only and does not promote S2/S4, publish S5/S6, change production,
  or claim physical independence.
- Focused validation passed: document links `44` local / `11` HTTPS syntax,
  specification with `73` relative links, governance `30/30`, historical receipt
  regressions S0-S4 `61/61`, Apache-2.0 verification, dependency audit with zero
  findings, and `git diff --check`.

## 2026-08-02 — Real-file continuity vertical and public capability API

- Added `@mortal-os/core/continuity` with create, inspect, three-phase handoff,
  2-of-3 recovery, and continuation. WebCrypto authorities are branded,
  non-extractable, sign-once, and redacted; the CLI uses distinct endpoint-local
  authority files and never emits their PKCS#8 material.
- Generalized Capsule verification so a verified state transition may be followed
  by a custody membership transition while the latest head remains bound to the
  same verified state root.
- Added matching CLI commands plus a clean `npm pack` consumer gate. The external
  consumer selects a runtime file, creates A/B authority files, accepts handoff,
  corrupts one copy, recovers exact bytes from the other two, commits sequence 3,
  and rejects one-copy, stale-head, and wrong-authority attempts.
- Added a separate-process Node endpoint test: B accepts custody, A's real PID exits,
  B recovers exact bytes after one corrupted copy, and the still-live B process
  commits the next transition. Valid fork and first-await mutation regressions also
  fail closed.
- Added the same ordered scenario to the built Lab. Chromium and Firefox select an
  actual File in isolated persistent endpoints, close A after B acceptance, recover
  and continue on B, and expose no private material. WebKit remains capability-
  routed verifier-only on the measured runtime.
- Added verifier-pinned transitive create/continue invocation snapshots. Async
  security inventory now reports `20 direct / 117 auto-discovered` entrypoints.
- Validation: exact checkout `npm test` PASS in `2542.8s`; browser parity PASS in
  `207.3s`; clean packed consumer PASS; focused continuity `4/4`; Chromium and
  Firefox continuity PASS; portable `10000/10000`; `git diff --check` PASS.
- Honest limits: three copies are one local administrative domain, product Capsules
  are not confidential, CLI key files rely on endpoint OS custody, and no stage
  receipt or production deployment is promoted by this candidate.

## 2026-08-02 — CLI cross-process sign-once race closed before immutable review

- Final source audit found that atomic file replacement alone did not serialize two
  processes that read the same authority revision concurrently. Conflicting bodies
  for one tuple could therefore both reach the endpoint-local private key.
- Added an exclusive per-authority lock, flushed lock/journal writes, atomic journal
  replacement before signing, a WeakMap-branded signer record, and fail-closed stale
  lock handling that requires explicit operator recovery rather than time guessing.
- Added a real two-process conflicting-body regression: exactly one process signs,
  the other returns `E_CONTINUITY_EQUIVOCATION`, and one journal binding persists.
- Added the CLI signer to the verifier-pinned first-await audit. Focused continuity
  `5/5`, clean packed consumer, and async security inventory `21 direct / 119
  auto-discovered` pass; prior CI is invalidated and must rerun on the new head.

## 2026-08-07 — Signed bounded resource offer, lease, usage, and revocation

- Added one generated finite profile and portable canonical contract for provider
  offers, mutual single-use leases, dual-signed cumulative usage chains, unilateral
  revocation, and deterministic explicit-time evaluation.
- Added ten role/ID domain separators, strict identity/signature/capacity/time
  binding, stable rejection codes, stale/replay/fork detection, and fail-closed
  offer equivocation with no automatic winner.
- Added authority-free default verification/evaluation plus the explicit
  `@mortal-os/core/resource-contract` draft/finalize subpath. A clean packed external
  consumer imports it without repository-relative paths or private authority.
- Updated the normative protocol, threat boundary, claim matrix, traceability,
  documentation map, README, and North Star SSOT. Signed intent is not described as
  physical capacity or delivery evidence.
- Validation: resource/profile `12/12`, SDK `4/4`, existing conformance `76/76`,
  portable `10,000/10,000`, specification/link checks, clean package consumer, and
  full `npm test` PASS in `3,329.6s`. Exact-head CI, immutable independent review,
  governed merge, and exact-main readback remain.

## 2026-08-07 — Network-visible sign-once consumption candidate

- Extended every offer with a sorted finite witness roster, declared Byzantine
  bound `f`, and activation threshold `q`. Unsafe policies, provider/consumer role
  overlap, and out-of-roster witnesses fail closed. The accepted inequalities are
  `n >= 3f + 1`, `q <= n - f`, and `2q > n + f`.
- Added domain-separated consumption and witness IDs, witness signatures, and a
  bounded self-contained gossip announcement carrying exact offer, lease, and
  witness evidence. Relay control transports the carrier but never decides its
  cryptographic validity.
- Reused the endpoint-local private sign-once authority through a request whose
  tuple is one offer and whose message binds one exact lease. Idempotent retry is
  permitted; signing a second lease for the offer rejects locally, while observed
  double-signing remains public equivocation evidence.
- Evaluation now requires threshold witness visibility before scheduled, active,
  exhausted, or completed state. Minority partitions remain `unwitnessed`, exact
  duplicate gossip does not inflate quorum, and provider conflict or witness
  double-sign halts without selecting a winner.
- Extended the authority-free default verifier and explicit drafting SDK. The clean
  packed consumer now runs offer -> mutual lease -> three independent witness
  signatures -> gossip -> active without repository-relative imports or transferring
  private keys. A locale-dependent sorting failure found only in the clean consumer
  was replaced with protocol-consistent code-point ordering.
- Focused evidence before the full suite: resource/profile `15/15`, transport `8/8`,
  SDK `4/4`, clean packed full witness flow, specification/link/profile checks,
  conformance `76/76`, portable `10,000/10,000`, async security inventory
  `21 direct / 119 auto-discovered`, dependency audit with zero vulnerabilities,
  `git diff --check`, and fresh full `npm test` in `2,720.8s` PASS. The full chain
  covered actual Chromium durability, multi-browser/Lab/UX, confidentiality,
  continuity, and historical S0-S4 receipt regressions. Exact-head CI, immutable
  review, governed merge, and exact-main readback remain.
- Honest boundary: witness quorum proves only logical visibility under the offer's
  declared fault bound. It does not prove witness independence, resource possession,
  data-plane delivery, truthful metering, Sybil resistance, or physical topology.

## 2026-08-08 — Lease-bound execution receipt vertical candidate

- Added consumer-signed execution challenges and provider/consumer-signed execution
  receipts that bind the exact offer, lease, consumption, immutable workload,
  challenge, deterministic result, measured usage receipt, sequence, and predecessor.
- Added bounded storage Merkle proofs, unpredictable bandwidth payload echoes, and
  deterministic `sha256-chain/1` compute. A dedicated evaluator counts execution
  only when the usage and execution chains are one-to-one and fully verified.
- Added generated 4 MiB resource, 4 KiB leaf/input, and 4,096-iteration ceilings;
  exact maxima pass and all relevant max + 1 inputs fail closed. Replays, forks,
  cross-lease substitution, tampering, accessors, Proxies, and unproved usage reject.
- Added an actual child provider endpoint. It reads a runtime file, executes all
  three workload types, retains its private key, terminates, and cannot continue.
  Repair succeeds only after a different provider signs a new offer and lease; the
  workload ID remains exact while old-lease evidence is rejected.
- Extended authority-free SDK verification, explicit drafting/result helpers,
  browser-target bundling, and the clean packed consumer through one proved compute
  receipt. No fixed backend, clock, scheduler, network, or private key entered core.
- Focused evidence: resource/profile `22/22`, SDK `4/4`, packed consumer PASS.
  Fresh full `npm test` PASS in `2,942.6s`, including actual browser, durability,
  confidentiality, continuity, fuzz, Lab/UX, portable `10,000/10,000`, and
  historical S0-S4 regression gates. Exact-head CI, immutable review, governed
  merge, and exact-main readback remain pending at this checkpoint.
- Honest boundary: process isolation does not prove independent hardware, account,
  region, credential, administrator, physical meter, or Sybil resistance. The next
  root gap is receipt-gated useful placement and repair over the participant data
  plane, followed by real failure-domain evidence.

## 2026-08-08 — Independent review BLOCK remediation

- The first exact-snapshot review of PR #56 at `bc600a8` correctly BLOCKed merge.
  A provider could reuse its own key as the lease consumer, collapsing provider,
  consumer, usage, and execution consent into one authority. Lease validation now
  rejects that role collision as `E_RESOURCE_IDENTITY` before any signature flow.
- The same review found that execution evaluation with `leases: []` recovered the
  nested lease object from a gossip announcement and passed it to the canonical-byte
  verifier. The evaluator now reserializes that already-parsed value with the
  module-private canonical encoder before verifying the exact lease envelope.
- Added regressions for provider/consumer key reuse and a complete three-receipt
  storage/bandwidth/compute evaluation using announcement-only lease discovery.
  Corrected README next-gap language, the six-question contract count, rejection
  semantics, the exact changed-path list, and the active handoff state.
- Remediated evidence: resource/profile `22/22`, SDK/transport `12/12`, clean packed
  external consumer PASS, specification PASS, zero-vulnerability audit, and fresh
  full `npm test` PASS in `2,963s`. This does not reuse the pre-remediation CI or
  review; a new exact-head CI and immutable re-review are required before merge.

## 2026-08-08 — PR #56 promotion and execution-document closeout

- Final implementation head `f848b2248f0df9e39e80e1a8e90a4d804ff6bfc3`
  passed trusted policy `31210644452/1` and Verify `31210597658` with browser job
  `92972207663` and protocol job `92972207880`.
- Fresh independent review PASS bound base, head, API body, all 33 changed files,
  Git-object diff, and exact CI runs after independently reproducing both prior
  findings as closed. GitHub App check `92985696733` and machine-user native review
  `4886246982` bound the same attestation digest before no-bypass expected-head merge.
- PR #56 squash-merged as `0779741402244d6cd802a1179bd2c94555bdd030` at
  `2026-08-07T20:14:42Z`. Exact-main Verify `31215007053` passed protocol in 44m18s
  and browser parity in 4m34s. Deploy `31215005995` passed exact-source deployment
  and public artifact, relay, and bilingual-path verification.
- README, claim matrix, implementation SSOT, resource contract, durable memory, and
  handoff now describe resource execution as a merged local evidence claim and make
  receipt-gated participant placement/repair the active P0 next step.
- Honest boundary remains unchanged: these receipts do not prove honest meters,
  distinct hardware/accounts/credentials/administrators, Sybil resistance, or
  physical witness/provider independence.
- The first closeout PR run `31218354601` passed browser parity, the complete source
  suite, portable/Lab/transport/coverage checks, and S0-S4 receipts, then correctly
  failed its final audit because GitHub refreshed high advisory
  `GHSA-2v37-7h3g-55p8`. The transitive `postcss` range accepts the patched line, so
  only `package-lock.json` moved `nanoid` from `3.3.16` to `3.3.18`. Fresh local
  `npm audit --audit-level=moderate` reports zero vulnerabilities; old CI is not
  reused and the replacement head requires every gate again.
- Replacement head `a1f7b9be4458c8be5fd6d1cdaa2868dc66d83959` passed trusted
  policy `31221495943/1` and Verify `31221375045`, including browser job
  `93006491592`, protocol job `93006491652`, and the patched dependency audit.
  Independent review `4887084891` still correctly BLOCKed promotion: current durable
  memory retained pre-merge execution and continuity candidate language that
  contradicted the closeout claim. No PASS receipt, App attestation, approval, or
  merge was issued.
- Remediation aligns durable memory, the documentation map, claim matrix, and stage
  ledger with governed PR #53 and PR #56 merges while retaining public-registry,
  honest-meter, and physical/administrative-independence HOLDs. The replacement head
  must rerun every exact-head gate and receive a fresh immutable review.
## 2026-08-08 KST — P2P receipt-gated storage placement/repair candidate

- Based branch `agent/codex-protocol-kernel--p2p-placement-repair` on exact
  `origin/main` `25de18d8c1af8b3dfcb5adffb1a07538afa33332` in a dedicated worktree.
- Added canonical manual WebRTC signaling, ordered binary DataChannel transport,
  bounded untrusted placement-artifact carriage, and the authority-free
  `evaluateStoragePlacements` policy plus `@mortal-os/core/placement` subpath.
- The policy counts only distinct-provider active storage execution receipts for one
  exact workload. Single, duplicate, corrupt, cross-lease, stale, unproved, and
  wrong-workload evidence does not count; local loss yields `repairing` below target.
- Actual Node child providers store bytes and sign from their own processes. One PID
  exits and cannot sign again; a fourth provider/new offer/new lease repairs 3→2→3
  while preserving workload identity.
- Actual Chromium loads all bundles, cuts origin/HTTP/relay access, sends one runtime
  file and complete contract evidence over direct peers, exits one provider, repairs
  through D, destroys/exits consumer A, and lets B recover exact bytes from two valid
  of three peer readbacks while rejecting one corrupt copy.
- Focused placement, Node process, WebRTC, Chromium, Lab build, SDK, transport, and
  async security inventory (`21/127`) checks pass locally. Full-suite, exact-head CI,
  independent review, merge, exact-main verification, deployment, and promotion are
  not yet claimed.
- Root next gap: providers currently receive plaintext and one receipt is only a
  point-in-time possession proof. Next P0 is ciphertext shards plus recurring chained
  challenges, proof freshness, crash-safe controller recovery, and automatic repair.
- The first ordered `npm test` ran for `2,788.4s` and correctly BLOCKed at
  `verify:portable`: the WebRTC capability adapter was under portable `src/` and
  therefore violated the network-free core boundary. No gate was weakened. The
  adapter moved to `lab/transport`, while its eight async surfaces remained in the
  ownership inventory.
- After the boundary correction, async inventory `21/127`, portable source scan
  `34` modules, portable `10,000/10,000`, WebRTC `4/4`, actual P2P Node/Chromium
  `8/8` plus runtime vertical, Lab build, and the previously unreached tail
  verifiers all passed.
- The final unchanged ordered `npm test` passed end to end in `4,168.7s` with
  specification, links, every stage receipt, actual browsers, P2P placement/repair,
  SDK/packed consumer, UX, portable parity, independent Python differentials, and
  S3/S4 receipt verification. Exact-head CI, independent review, merge, exact-main
  verification, deployment, and external-topology promotion remain unclaimed.

## 2026-08-08 KST — Confidential continuously re-proved P2P placement controller

- Added `mortalos-confidential-placement-{shard,manifest,journal}/1`. A verified S4
  package becomes three deterministic XOR-coded ciphertext envelopes; every two
  distinct valid shards reconstruct and reverify the exact package. Each descriptor
  binds shard index/digest/size and its exact storage workload ID.
- Added a freshness-aware evaluator that counts only distinct provider and shard
  identities with exact active storage receipts. Exact max age passes; max+1,
  future-time, duplicate, corrupt, wrong workload, unavailable transport, and invalid
  evidence fail closed without manufacturing a global outage fact.
- Added an immutable canonical public-evidence journal and append-only generation-pointer Lab
  adapter. An actual commit child exits and a new load child recovers exact bytes.
  The restored controller counts no repeated pre-crash receipt; an existing lease
  must extend the journaled receipt directly, while a new provider/lease may enter
  with a fresh first proof.
- The controller policy test passes every 2-of-3 pair, corrupt/single/duplicate
  negatives, directly chained re-proof, and 100 deterministic loss/stale/repair/
  corrupt schedules over cryptographically verified states. The 100 cycles are not
  misrepresented as 100 physical machines or partitions.
- Added an actual Chromium vertical. Browser A selects and encrypts a native
  98,317-byte file for B; three providers receive distinct S4 package shards over
  direct DataChannels and sign exact workload receipts. HTTP/origin/relay access is
  cut after bundle load. Provider loss degrades the target, A destroys authority and
  exits, and B reconstructs/decrypts exact bytes, then renews all placements through
  B-owned new leases instead of receiving A's private key. One corrupted shard is
  rejected and another valid pair succeeds.
- Focused result: `npm run test:p2p-placement` PASS in 198.9s: 12 Node cases plus
  the existing plaintext transport regression and new confidential Chromium
  vertical. SDK allowlists, clean packed install, and five-entry Lab build pass.
- Root next gap: the crash-safe journal is still local. Placement generations and
  repair intent must bind into Continuity lineage so multiple legitimate controllers
  converge, forks halt, and no partition can create silent duplicate repair/billing
  authority. Physical/admin independence and arbitrary NAT reachability remain HOLD.
- The first complete candidate `npm test` PASS took `3,476.4s`. Replacing the
  delete/rename current-pointer window with fsync-backed append-only generation
  pointers and explicit same-generation fork rejection passed in `3,177.5s`.
  A final review then bound the pointer filename, journal ID, pointer generation,
  and restored journal generation so an old journal cannot masquerade as a newer
  generation; the final exact-source ordered `npm test` PASS took `3,101.1s`.
  The final run included license,
  spec/link/profile, async security, governance and historical receipts, Participant
  Core, durable Chromium, S4 confidentiality, both P2P Chromium verticals, transport,
  distributed counter, fuzz, SDK/packed consumer, continuity/Capsule/relay,
  multi-browser/Lab/UX, portable `10,000/10,000`, independent Python differentials,
  and S3/S4 receipt verification. No gate was reduced for this candidate.

## 2026-08-09 KST — Lineage-bound placement handoff and convergence

- Added `mortalos-lineage-placement-{generation,commit,authorization,convergence}/1`.
  A generation carries complete canonical placement evidence and re-derives its
  proof/repair summary instead of trusting controller output.
- A generation becomes authoritative only through a current-custodian Continuity
  state transition whose sign-once tuple binds one exact parent. The derived
  authorization names committed repair actions and billable proof IDs; unsigned
  plans do not grant either authority.
- Node A commits a two-proof degraded generation, performs the existing sign-once
  custody handoff to B without key transfer, is destroyed, and B commits a linked
  three-proof repaired generation under B-owned leases. Two fresh verifier processes
  reproduce byte-identical convergence output.
- The adversarial fixture intentionally bypasses sign-once with an unsafe raw signer
  and produces two separately valid same-parent generation commits. Both verify,
  but convergence returns `generation-fork` and selects neither.
- The actual Chromium vertical now creates controller authority from the selected
  98,317-byte File, commits loss under A, hands control to B, closes A, repairs over
  direct WebRTC, and commits under B. Reordered/duplicated evidence converges exactly
  with origin and relay still cut; no private material appears in results.
- Focused PASS: the hardened `npm run test:p2p-placement` completed in 372.6s with 14 Node
  cases and both actual Chromium verticals; async security inventory, SDK surface,
  clean packed-package import, and five-entry Lab build also pass.
  Final ordered `npm test` then passed on the hardened source in 3,129.8s, including every existing browser,
  protocol, SDK, continuity, Lab, portable, differential, and stage-receipt gate.
  Exact commit, independent review, merge, deployment, and promotion remain open.
- Root next gap: the commit proves who authorized a generation, not whether a local
  timeout is globally true. Next P0 is quorum-observed, predecessor-linked liveness
  and failure certificates without a global clock. Physical/admin independence,
  honest metering, Sybil resistance, arbitrary NAT reachability, and XSS-resistant
  signing remain HOLD.

## 2026-08-09 KST — Quorum-observed liveness and repair certificates

- Added canonical, domain-separated liveness challenge, observer no-response,
  provider response, and threshold failure-certificate documents. Challenge order
  is the exact prior execution receipt plus next sequence; the schema contains a
  bounded local duration but no deadline, UTC time, clock server, or global clock.
- Closed a policy-selection flaw found during implementation: the consumer cannot
  create a favorable observer roster after failure. The roster and `n/f/q` must
  equal the provider-signed offer witness policy already accepted by the lease.
- Removed raw unavailable-provider input from lineage generation. Only verified
  failed cases derive the lower-level unavailable set, and committed repair intent
  carries the exact challenge and certificate IDs.
- Added execution-time reconciliation. A late provider response counts only when a
  supplied current placement proves the referenced dual-signed execution receipt;
  response versus certificate, two challenges for one predecessor tuple, or two
  receipt responses for one challenge halt with no repair winner.
- Node liveness/transport focused gates pass. The lineage gate covers malicious
  unagreed observers, committed certificate IDs, late-proof halt, two fresh verifier
  processes, and 1,000 partition/heal inputs in four bounded batches. The exact
  final lineage rerun remains part of the final ordered verification below.
- Actual Chromium PASS: the challenge crossed direct WebRTC to provider 0 and four
  observer browser processes, provider 0 exited, three observers signed after the
  actual 5,000 ms local window, A committed the certified repair and handed control
  to B without key transfer, A exited, and B committed repaired continuity. Origin,
  HTTP, and relay request counts remained unchanged after cut.
- Root insight: quorum signatures close controller-local outage fabrication but not
  Sybil control. The next P0 is lineage-committed membership plus measured
  failure-domain diversity so one operator cannot manufacture both provider and
  observer populations. Same-PC/admin/network, honest timers, honest metering,
  arbitrary NAT, and physical independence remain HOLD.
- Final ordered repository regression PASS: `npm test` completed in `4,263.6s`.
  The liveness-hardened placement gate passed 17 Node cases plus both actual
  Chromium verticals; portable rejected `10,000/10,000` serialized adversarial
  cases; state/state-package/R1 differentials, Lab/UX, SDK/continuity/Capsule,
  relay/quorum, and the final S3/S4 receipt gates all passed. The command root and
  descendants were absent at the post-run readback.

## 2026-08-10 KST — Pre-publication security reconciliation and claim boundary

- Independent adversarial review reproduced three release blockers and one derived-
  plan gap: a rogue liveness consumer could differ from the verified lease consumer;
  a stale prior generation could rewind placement numbering after a newer commit;
  poisoned collection primordials could count one repeated observer as a quorum; and
  an older committed generation could derive a plan against a later Capsule head.
- The core now binds the full lease/challenge consumer identity, requires the unique
  latest committed placement predecessor in creation, commit, and verification,
  rejects superseded generation plans, and uses captured realm/own-data snapshots for
  hostile accessor, Proxy, sparse-array, `Set`, `Map`, `Object`, and `Array` inputs.
  The public plan remains forgeable `non_capability` data and grants no execution
  authority.
- `commitLineagePlacementGeneration` is now a direct async security-registry entry.
  Its authority resolution and canonical input-byte ownership occur before the first
  suspension. Generated-profile checks also require the resource-offer and liveness
  witness ceilings to match and the certificate observation ceiling to represent the
  full accepted roster; exact 16 witnesses pass and 17 reject.
- Focused current-source PASS: lineage `2/2` in `740.9s`; liveness `5/5`;
  resource/profile `15/15`; async security `26/26` with `22` direct and `128`
  discovered entrypoints; SDK `5/5`; clean packed-package flow; specification,
  links, generated profile, and `git diff --check`. A separate read-only security
  rerun independently passed lineage `2/2` in `736.4s` and found no material release
  block.
- Claims are deliberately narrower than the implementation's signed transcript. The
  response window is consumer-selected, not provider-agreed; a failure certificate
  is not provider death, breach, lease termination, penalty, or settlement evidence;
  and the current Chromium Lab does not execute repair through an effect-time,
  current-evidence-gated executor.
- Root next P0 is therefore a provider-signed, lease-bound liveness policy plus an
  independent provider possession response and exactly-once repair executor. Only
  after that semantic and effect boundary is fixed should lineage-governed membership
  epochs assign trust-rooted failure-domain weights. Independent topology, absolute
  Sybil resistance, honest metering, arbitrary NAT reachability, and same-origin
  signer isolation remain HOLD.
- After the implementation and preceding documentation reconciliation, the complete
  ordered `npm test` passed without a skipped gate in `3,664.8s`. It included both
  actual Chromium placement verticals, portable `10,000/10,000`, independent
  state/state-package/R1 differentials, and the final S3/S4 receipt verifiers. This
  evidence line was appended after that run; exact-head CI remains the authority for
  the final committed documentation revision.
- Exact-SHA review, CI, merge, deployment, and public promotion remain external facts
  read from the PR, required checks, merge record, post-main workflows, and deployed
  manifest; this append-only source record does not self-promote its containing SHA.

## 2026-08-10 KST — PR #58 first independent BLOCK and replacement closure

- PR #58's first immutable review pinned head
  `1c559843c6af8300d744629215050c3fbd4d4781` and all 61 changed files. Trusted policy
  run `31325465476` job `93274993590`, Verify run `31325465489` browser job
  `93274993578`, and protocol job `93274993553` all passed. Structured review
  `4892040607` nevertheless BLOCKed the head with four material findings; no PASS
  receipt, App attestation, native approval, merge, or deployment was issued.
- The status header in `IMPLEMENTATION_PLAN.md` contradicted the body by naming
  admission as immediate NEXT, and HANDOFF omitted the changed `protocol/` path.
  Both SSOT records now state the same ordered priority and exact shared-path set.
- A WebRTC publisher, range reader, or first subscriber could mutate a shared internal
  frame reference and poison later cursor/subscriber state. The adapter now owns
  binary inputs through captured intrinsic slots, rejects accessor/Proxy/SAB
  impostors, stores immutable frames, and returns a detached frozen record for every
  publish, duplicate, fetch, and subscriber delivery. Transport regressions pass
  `16/16`, including the original `1 -> 777` and cross-subscriber `900` attacks.
- A forged latest-parent successor could repeat generation `2`, recompute its public
  ID and commit hash, and still verify. Creation now derives the next number from
  restored canonical prior bytes; commit and verification require generation `N` to
  have exactly `N - 1` authenticated prior placement transitions plus the latest
  predecessor ID/head. Repeated `2`, skipped `4`, noncanonical `01`, and overflow
  all reject. The focused signed lineage suite passes `2/2` in `783.3s`.
- Reviewed module and entrypoint digests were refreshed only after source inspection;
  async security passes `26/26` with `22` direct and `128` discovered surfaces.
  Specification, links, governance `30/30`, and `git diff --check` pass. Replacement
  exact-head CI and fresh immutable re-review remain required before any approval,
  merge, deployment, or promotion.

## 2026-08-10 KST — PR #58 replacement BLOCK and send-failure closure

- Replacement head `b282e0d3be74c0d8480c038199b5ebc960166e8d` passed trusted
  policy `31329658282` job `93285742521`, browser parity job `93285745426`,
  focused lineage `2/2`, transport `16/16`, async security `26/26`, governance
  `30/30`, package, profile, spec, link, audit, and diff gates. Immutable review
  `4892277944` confirmed all four findings from review `4892040607` were closed,
  then correctly BLOCKed a new outbound-publication atomicity defect. No PASS
  receipt, App attestation, native approval, merge, or deployment was issued.
- `publish()` formerly inserted its frame and message-ID dedupe entry before
  `DataChannel.send()`. A transient synchronous send failure therefore left a ghost
  local frame; the exact retry returned `duplicate: true` without a second network
  send. The adapter now sends first and commits local state only after success.
- The new regression proves: failed send => zero range/subscriber/dedupe visibility;
  exact retry => a real second send and exactly one committed frame; later duplicate
  => idempotent without a third send; backpressure and closed-channel rejection =>
  no extra frame. Transport plus virtual 10,000-schedule coverage passes `17/17`,
  and reviewed security digests were refreshed only after inspecting the source.
- The same North Star audit reproduced two honest HOLDs recorded in the active SSOT:
  a consumer-selected 1 ms window can yield a valid local non-response certificate,
  and an ID-only provider response is not self-contained possession proof. They are
  inputs to the next provider-signed liveness-policy/possession/executor P0, not
  grounds to overstate this scheduling-only source claim.

## 2026-08-10 KST — PR #58 third BLOCK and transitive WebRTC capability containment

- Exact head `dcdd02d0c88015fc867381cb97b07215a8d7e429` passed trusted policy
  `31330801325/1` job `93288610889` and exact-head Verify `31330802529/1`
  (`protocol` job `93288613346`, `browser-parity` job `93288613359`). Immutable
  review `4892393270` confirmed the five prior findings were closed and then
  correctly BLOCKed one remaining trust-boundary defect. No PASS receipt, App
  attestation, native approval, merge, or deployment was issued.
- The private WebRTC transcript still invoked ambient mutable `Map`, `Set`, `Array`,
  iterator, scheduler, and attached-channel methods. Independent reproductions could
  fabricate a first-send duplicate, suppress duplicate detection, fabricate range
  sequence `777`, drop replay/live delivery, accept bogus signaling, or record local
  publication after a replaced no-op `send` while the existing security digest gate
  stayed green.
- The replacement source uses one private ordered `Map` for frame order and message-ID
  dedupe, invokes captured collection/iterator/scheduler operations, snapshots
  fallback data-method capabilities without invoking accessors, and native-captures
  DataChannel, MessageEvent, RTCDataChannelEvent, and RTCPeerConnection constructors,
  methods, and live-slot getters. Publication performs the captured real send first
  and makes one local transcript commit only after synchronous success.
- Thirteen isolated child-process poison cases separate the adapter boundary from
  the transitive codec parser and cover pre/post-construction Map/Set, individual
  mutation and iterator methods, Array range construction, scheduler promises,
  signaling type, and attached `send`. `test/webrtc-transport.test.mjs` passes
  `10/10`. A test-only browser bundle connects an actual Chromium A/B DataChannel
  pair, replaces native channel/peer methods and collection prototypes, records zero
  poison calls, and still delivers exactly three remote frames.
- The actual Chromium P2P vertical then passed in `55.3s`: runtime file and signed
  evidence crossed direct peers, one provider loss repaired through a new lease, A
  exited, and B recovered two valid copies while rejecting one corruption with zero
  origin/relay requests after cut. The confidential vertical passed in `152.1s` with
  the native 98,317-byte file, S4 2-of-3 shards, 3-of-4 no-clock observations,
  lineage handoff, A exit, exact B recovery, and corrupt-shard rejection.
- Reviewed module/function hashes were updated only after the containment and browser
  evidence were inspected; the async security gate passes `26/26` (`22` direct,
  `128` auto-discovered). A successful browser `send()` remains only local outbound
  queue admission, not peer acknowledgement, durable possession, or placement truth.
  Fresh exact-head CI and a fourth immutable review remain required.

## 2026-08-10 KST — PR #58 fourth BLOCK: transitive relay allowlist containment

- Immutable review `4892650018` at exact head
  `8a3f285edf3e1056d4f78097b5cb5bc0ae065043` reproduced that the otherwise
  contained WebRTC publisher still delegated artifact-kind classification to ambient
  `Set.prototype.has`. Selective poisoning admitted a manually canonicalized
  forbidden `verdict` and committed sequence 1 on both actual Chromium peers. No
  PASS receipt, approval, merge, or deployment follows from the blocked head.
- The source correction is deliberately narrow: `src/transport/protocol.mjs` imports
  the module-captured `setHas` primordial and invokes it for the existing artifact-kind
  allowlist. No relay schema, artifact set, WebRTC sequencing, or placement policy
  changed.
- The isolated Node regression canonicalizes raw forbidden and allowed carriers before
  poison. Under selective membership replacement, `verdict` rejects with
  `RELAY_SCHEMA`, performs zero sends, and leaves the local range empty; `challenge`
  then sends once and commits sequence 1. The poison target records zero calls. The
  parent covers 14 isolated cases, and a missing child argument now exits explicitly
  with code 64 instead of entering a poison scenario.
- The actual connected-Chromium A/B probe first rejects the same forbidden bytes in a
  clean baseline and again under poison. Forbidden local range, remote range, and
  subscriber delivery remain zero; while the poison is installed, an allowed
  challenge reaches both peers at sequence 1. The verifier asserts
  `artifact_kind_poison_calls: 0`, `forbidden_local_frames: 0`, and
  `forbidden_remote_frames: 0` before continuing the origin-cut placement/repair
  vertical.
- `verify-security-boundaries.mjs` now pins the exact imported
  `decodeRelayMessageBytes` function digest and full `src/transport/protocol.mjs`
  module digest, and proves that classified `publish` directly invokes that named
  dependency. This is evidence for the named dependency only, not a general claim
  that future decoder dependencies are primordial-safe.
- Current-tree focused evidence: transport/WebRTC `18/18`; async security `26/26`
  with `22` direct and `128` auto-discovered entrypoints; actual Chromium P2P
  placement/repair PASS in `39.8s`; specification PASS; links PASS; and
  `git diff --check` PASS. Direct child execution passed, missing-argument exit took
  `142ms`, and final process inspection found `PoisonChildNodeLiveCount=0` and
  `ChromiumVerifierNodeLiveCount=0`.
- Review `4892650018` also reported that confidential placement used historical
  `record.observed_at_ms` for resource status while using generation time only for
  proof age. The replacement evaluates both at the canonical generation instant.
  With record `1500`, lease end `8900`, and generation `9000`, all three shards are
  `resource-completed`, proof count is zero, and actual lineage creation halts. A
  signed revocation effective `1700` similarly rejects in generation `1800`.
- Confidential direct/lineage targeted regressions pass `2/2` in `53.0s`; the full
  confidential suite passes `5/5` in `129.9s`. Exhaustion remains cumulative
  receipt state and is not misreported as a time-based result. Fresh exact-head CI
  and immutable re-review remain required before approval, merge, deployment, or
  promotion.

## 2026-08-10 KST — PR #58 fifth BLOCK: journal provenance and Capsule-tip completeness

- Immutable review `4892815258` at exact head
  `775d4dbfdb48985c31018a78bf7a80459ad4d8ed` confirmed all earlier BLOCK closures
  and exact-head policy/Verify success, then correctly BLOCKed two deeper faults. A
  caller-shaped evaluation and publicly self-hashed journal could omit every
  pre-crash replay barrier; separately, convergence could select historical
  generation 2 even when a supplied verified Capsule authenticated generation 3.
  No PASS receipt, App attestation, approval, merge, or deployment followed.
- Journal creation now accepts only a module-private evaluator result bound to the
  exact manifest, policy, max age, and complete ordered distinct-provider `3/3`
  receipt barrier. The producer first copies recognized records, dense arrays, and
  bytes into owned inert data, uses captured collection/WeakMap operations, and
  checks the runtime after hostile acquisition and nested signed-artifact validation.
  Selective `Array.prototype.map`, Proxy-array method, accessor, Map, and Set attacks
  invoke no caller method and cannot mint the brand. Incomplete evaluations are not
  branded.
- The durable commit API no longer accepts raw `journal_bytes`; it re-evaluates raw
  signed placement evidence and derives/restores the canonical journal inside the
  write boundary. V1 restore requires exactly one ordered barrier for each shard,
  three distinct providers and receipts, exact `2-of-3` policy, and its canonical
  self-hash. Empty, partial, cloned, accessor-backed, Proxy-backed, or self-hashed
  incomplete documents cannot advance a pointer. A syntactically complete forged
  unsigned local journal and hostile local-disk replacement remain explicit
  nonclaims.
- A pre-commit adversarial review then found that restart loading used ambient array
  methods before its realm check. A self-restoring override hid generation 2 and made
  an existing generation 1 current without changing disk. The loader now checks the
  realm at entry and after filesystem reads, copies directory entries as dense own
  data, uses captured pointer parsing, and selects the maximum generation plus fork
  state in one bounded order-independent pass. The exact attack is rejected with
  zero poison calls; a current-max fork halts while a unique later generation
  supersedes a historical fork under both listing permutations.
- Convergence retains every supplied Capsule's authenticated latest placement
  transition count, ID, and head. Every such tip must be represented by a verified
  candidate, the selected generation must equal the maximum supplied authenticated
  count, and numeric gaps halt as `incomplete-chain`. Valid historical prefixes and
  non-placement tails remain valid; sibling candidates halt as `generation-fork`;
  duplicates and permutations remain byte-identical. A completely hidden newer
  Capsule remains unknowable and is not claimed.
- Exact frozen-source local evidence: confidential placement `7/7` in `133.9s`;
  lineage placement `3/3` in `1,332.7s`; placement/liveness/WebRTC `19/19`;
  profile/resource/execution `22/22`; transport `8/8`; SDK `5/5` plus clean packed
  consumer; governance `30/30`; security boundary `26/26` with `22` direct and `128`
  discovered surfaces; actual Chromium P2P placement/repair PASS in `40.8s`; actual
  Chromium confidential A-to-B vertical PASS in `103.6s`; portable verifier PASS in
  `452.4s` with `10,000/10,000` adversarial cases rejected; Lab `23/23`, UX, build,
  license, specification, links, ruleset, audit-zero, and diff checks PASS. The sync
  verifier pins exact frozen modules only after review.
- These are source and local runtime facts, not promotion. Fresh exact-head policy,
  Verify, immutable independent review, App attestation, separately credentialed
  native approval, expected-head merge, exact-main Verify/Deploy, and public artifact
  readback remain external gates.

## 2026-08-10 KST — Journal v2 cumulative anti-replay and hard-link successor CAS

- The fifth-review journal repair proved complete active `3/3` provenance for one
  head but did not preserve every older receipt-chain barrier after provider
  replacement. A public evaluator input could also choose its own replay context.
  Journal v2 moves that authority into a prior-head-bound reproof intent and a
  module-private branded evaluation.
- Each reproof context binds prior journal ID, next generation, manifest, policy,
  epoch parent, and a 256-bit epoch nonce. Each challenge nonce is derived from the
  context plus the exact chain ID, sequence, and predecessor. Only active shards
  0/1/2 under three distinct providers can advance the head.
- The journal now carries cumulative per-chain high-waters for the epoch. A/B/C
  remain replay barriers after D/E/F becomes active; a known chain advances only as
  the exact direct successor, while a new chain starts at sequence zero. A rotated
  epoch can reset this bounded state only after a fresh context-bound `3/3` reproof.
- Legacy v1 is metadata-only migration input. It cannot seed v2 high-waters or be
  treated as available until a fresh rotated-epoch reproof commits. Generated caps
  bound documents, linked transitions, per-shard and total high-waters, and nonce
  sizes; overflow fails closed without pruning.
- The durable adapter fsyncs immutable context, journal, and transition files before
  separate predecessor-keyed no-replace hard-link claims for reproof intent and
  successor commit. This gives conforming same-filesystem writers a single winner
  and rejects stale writers without reintroducing a mutable current pointer.
- Focused source gates are `test/confidential-journal-v2.test.mjs` and
  `test/confidential-controller-v2.test.mjs`, with the existing confidential policy
  corpus and actual Chromium vertical as supplementary evidence. Verification and
  exact-revision governance results must be recorded separately; this entry does not
  infer PASS, approval, merge, deployment, or promotion.
- Journal, context, and transition artifacts remain unsigned local evidence. They do
  not prove hostile-disk integrity, completely hidden receipt history, cross-host or
  global consensus/currentness, physical independence, or arbitrary Internet
  reachability. The next P0 order remains provider-agreed lease-bound liveness policy
  plus effect-time exactly-once repair execution, followed by lineage-governed
  admission and failure-domain accounting.

## 2026-08-10 KST — Journal v2 final local release gate

- Adversarial pre-freeze review found and closed late-v1 migration-anchor drift,
  self-rehashed skipped-generation genesis contexts, SharedArrayBuffer-backed byte
  inputs, partial-canonical crash publication, generation-4096 off-by-one handling,
  and mutable diagnostic proof projections. Visible late-v1 competition now halts
  as `E_CONFIDENTIAL_PLACEMENT_ROOT_FORK`; `prior=null` requires generation 1 at
  restore, binding, and durable genesis boundaries.
- Exact focused evidence: journal plus confidential placement `12/12`; durable
  controller `3/3` in `409.7s`; security boundary `26/26` with `22` direct and `128`
  discovered surfaces; packed SDK/profile/spec/links PASS; audit `0` vulnerabilities.
  The controller corpus includes different-candidate one-winner, same-candidate
  idempotence, partial/complete pending orphan isolation, late-v1 root fork, exact
  generation 4,096 load, generation 4,097 rejection, and child `LiveCount=0`.
- A fresh uninterrupted ordered `npm test` then passed in `4,304.1s` (`71m 44s`),
  including both actual Chromium placement verticals, lineage, portable
  `10,000/10,000`, UX, Lab, and historical H2/S3/S4 verifiers. No test workload
  remained after completion. Only this evidence-only documentation update followed
  the runtime run; final exact-head CI must rerun the complete chain.
- This is local source/runtime evidence, not promotion. Policy, exact-head Verify,
  fresh immutable independent review, App attestation, separately credentialed
  native approval, expected-head merge, exact-main Verify/Deploy, and public
  artifact readback remain external gates.

## 2026-08-10 KST — PR #58 seventh BLOCK and stateful-100 remediation

- Review `4893187627` at `193cfff1...` found that provider replacement could erase
  cumulative replay barriers and required journal v2 plus stateful 100-transition
  Node and Chromium/Lab regressions. Journal v2 implemented prior-head-bound reproof
  contexts, chain/sequence/predecessor-derived challenges, cumulative epoch high-
  waters, fresh-`3/3` v1 migration, generated caps, and predecessor-keyed no-replace
  intent/successor claims.
- Review `4893915817` at `e0148aa2...` confirmed the focused journal-v2 remediation
  but BLOCKed its stale PR body and the then-named 100-cycle test, which merely re-
  counted four cached evaluations. That exact head's policy, protocol, and browser-
  parity checks passed, but no PASS receipt, App attestation, native approval, merge,
  or deployment followed.
- The current working source replaces the cached claim with 100 evolving prior-bound
  transitions in the Node portable-kernel gate and 100 mixed-runtime transitions
  whose provider keys, storage results, and signatures are created by actual
  Chromium/Lab pages while the journal controller is orchestrated in Node. The Node
  focused gate passed `1/1` in `1,850.9s`; the Chromium vertical passed in `1,886.9s`
  with a `1,776.2s` dynamic segment, generation `102`, `106` cumulative high-waters,
  and `306` distinct receipts. This is not independently in-browser journal-kernel
  parity.
- Chromium rotates logical signer identities inside three persistent provider pages
  and recomputes possession evidence from already stored exact shard bytes. The
  corpus does not represent 100 new browser processes, transfers, physical failures,
  machines, accounts, administrators, or independent failure domains.
- This remediation raises the current candidate's protocol and deploy workflow
  maxima from 120 minutes to 180 minutes; relative to the task base, the final ceiling
  is 60 to 180 minutes. No check is removed or weakened. Uninterrupted full-suite,
  exact-head CI, fresh independent review, approval, merge, deployment, and public
  readback remain separate gates for the containing revision.

## 2026-08-10 KST — Stateful-100 full-suite relay boundary diagnosis

- The first uninterrupted full-suite run for the stateful-100 source reached the
  relay runtime after every preceding gate, including both new 100-transition
  placement paths, had passed. It then failed after `6,167s` because the relay test
  expected `429` but received `200`. This run is evidence of a failure and is not a
  full-suite PASS.
- Independent diagnosis found no relay Worker regression or state leakage from the
  long placement run. The historical test inserted `limit - 1` only into the current
  wall-clock minute and assumed its next two requests remained in that minute. If
  the minute changed between those requests, the second request correctly entered a
  fresh fixed-window bucket and returned `200`.
- The test-only repair now primes both the current and next bounded minute before
  each independent assertion: `limit - 1` proves the last request is admitted, then
  `limit` proves the following request is rejected. The production Worker and rate
  policy are unchanged; the 30-second test timeout cannot reach an unprimed second
  successor bucket.
- The repaired runtime passed 20 consecutive isolated runs in `107.045s`, crossing
  the `19:03` and `19:04` minute boundaries, and the complete `test:relay` gate then
  passed in `9.0s`, including contract tests, the Worker runtime, and Wrangler dry
  deployment. A new uninterrupted full suite remains required before local release
  evidence can be promoted from HOLD.

## 2026-08-10 KST — Stateful-100 full-suite Chromium deadline HOLD

- After the relay harness repair passed 20 isolated runtime repetitions and complete
  `test:relay`, a second uninterrupted `npm test` still did not close the release
  gate. All ordered gates through the Node stateful-100 corpus and the first actual
  P2P Chromium vertical passed.
- The run stopped after `6,122.7s` in the mixed-runtime Chromium 100-transition
  segment because its local `1,800,000ms` guard expired after logged progress through
  75/100 cycles. The earlier focused segment took `1,776,198ms`, leaving only
  `23,802ms` (`1.32%`) headroom. Later ordered gates were not executed.
- This is deadline-budget failure evidence, not semantic PASS evidence and not by
  itself proof of a protocol regression. Independent review projected approximately
  `2,400,000ms` at the observed full-run pace, so the harness remains bounded at a
  revised `2,700,000ms` while preserving all 100 sequential transitions and final
  assertions. Protocol and deploy workflow maxima increase from 180 to 240 minutes;
  no gate is removed or weakened.
- Full-suite, exact-head CI, fresh independent review, approval, merge, deployment,
  and public readback remain HOLD until a new exact-source run completes.

## 2026-08-10 KST — Stateful-100 uninterrupted local full-suite PASS

- A third fresh uninterrupted `npm test` on the current runtime/test source exited
  `0` in `7,065.8s` (`117m 45.8s`). It completed the 100 sequential Node portable-
  kernel replacements, the 100-transition mixed-runtime Chromium/Lab path within its
  bounded `2,700,000ms` guard, the repaired relay runtime, and every later ordered
  repository gate. The exact mixed-runtime segment duration was not recovered from
  truncated output and is not estimated.
- The Chromium boundary remains explicit: three persistent browser provider pages
  held non-extractable keys and created the storage results and signatures; the
  portable journal controller ran in Node. This is not independently in-browser
  journal-kernel parity, 100 new browser processes/transfers, or evidence of 100
  independent machines, accounts, administrators, regions, or failure domains.
- The test root and all observed descendants were absent at
  `2026-08-10 22:54:53.946+09:00` (`RootTreeLiveCount=0`). This successful run
  supersedes the preceding `6,167s` relay-race and `6,122.7s` deadline HOLDs as the
  current local full-suite result; both failed attempts remain retained above as
  diagnostic history.
- Workflow ceilings remain 240 minutes and the internal mixed-runtime guard remains
  `2,700,000ms`; no ordered gate or final assertion was skipped. Only evidence
  documentation changed after this run. Exact-head policy/Verify, fresh immutable
  independent review, App attestation, separately credentialed native approval,
  expected-head merge, exact-main Verify/Deploy, and public readback remain external
  and pending.

## 2026-08-11 KST — Exact generated-history ceiling focused PASS; full-suite HOLD

- The former stateful-100 corpus did not exercise the profile-generated 128-chain-
  per-shard/384-chain-total boundary. The Node replacement test now performs 128
  sequential signed prior-head-bound transitions with 381 genuine provider
  replacements. It reaches generation 129 with exactly 384 distinct provider,
  lease, and chain identities (`128/128/128` by shard) plus 387 distinct execution
  receipts. It then obtains a separately signed, proved generation-130 `3/3`
  candidate and rejects its 385th total/129th shard-0 chain at commit without
  changing the exact generation-129 journal bytes.
- The focused Node body passed in `2,841,685.4279ms`; the Node test runner completed
  in `2,842,481.1467ms` and the shell in `2,842,596ms`. The root test tree was absent
  at `2026-08-11 00:05:11.662+09:00` (`RootTreeLiveCount=0`).
- The first focused Chromium attempt failed after `84,073ms` because a test-only
  aggregate omitted initial `chain_id` values before comparing the complete signed
  history. The aggregation was corrected; protocol/runtime semantics and the
  generated caps were unchanged. This failed attempt is retained as evidence rather
  than counted as PASS.
- The corrected mixed-runtime Chromium/Lab gate passed 127 cycles from generation 2
  to the same generation-129 ceiling in `2,549,195ms` dynamic time and `2,666,619ms`
  total. It records 384 distinct provider/lease/chain identities
  (`128/128/128` by shard) and 387 receipts, proves a browser-signed generation-130
  `3/3` candidate, rejects its plus-one commit without changing bytes, reloads the
  serialized ceiling and rejects the oldest replay, exposes no private material,
  and records zero post-cut requests. The browser tree was absent at
  `2026-08-11 00:54:04.267+09:00` (`RootTreeLiveCount=0`).
- Three persistent browser pages reuse already stored exact shard bytes, and Node
  orchestrates the portable journal controller. This is genuine browser-signature
  evidence but not independent in-browser journal-kernel parity, 127 fresh browser
  processes/transfers, independent possession domains, machines, accounts,
  administrators, networks, regions, or credentials.
- The passing deadline-wrapped `2,549,195ms` Chromium dynamic segment consumed
  94.41% of the former `2,700,000ms` guard (`2,666,619ms` total outside that exact
  segment boundary). The test-only bound is now `3,300,000ms`; the workflow limits
  remain 240 minutes and no cycle or final assertion is skipped.
- The preceding `7,065.8s` uninterrupted full-suite PASS is historical pre-ceiling
  evidence and does not transfer to this changed source. Current status is **focused
  exact-ceiling PASS; full suite pending; exact-SHA external**. A fresh uninterrupted
  `npm test` is required before exact-head CI, immutable review, approval, merge,
  deployment, or public readback can advance.

## 2026-08-11 KST — Exact-ceiling exact-tree uninterrupted full-suite PASS

- A fresh exact-tree `npm test` started at
  `2026-08-11 01:06:58.716+09:00` and ended at
  `2026-08-11 03:21:35.542+09:00`. It exited `0` after exactly `8,076,826ms`
  (`8,076.826s`; `134m 36.826s`).
- The ordered chain completed the current 128-transition Node exact-ceiling test,
  the current 127-cycle mixed-runtime Chromium exact-ceiling test, all subsequent
  repository stages, and the final `verify:s4` PASS. This promotes the current local
  evidence from focused-only to uninterrupted exact-source full-suite PASS without
  altering the earlier focused runtimes, the `3,300,000ms` Chromium dynamic guard,
  or the 240-minute workflow ceilings.
- PID `23824` was absent at `2026-08-11 03:24:59.475+09:00`. A fresh conservative
  probe at `03:26:01.147+09:00` found that root absent and zero other matching
  MortalOS test workloads after excluding the probe process itself.
- This remains local source/runtime evidence. Mixed-runtime Node orchestration,
  same-PC persistent provider pages, unsigned journal/context/transition documents,
  conforming same-filesystem hard-link CAS, and all physical/admin/credential-domain
  nonclaims remain unchanged. Exact-head CI, immutable review, App attestation,
  native approval, merge, exact-main Verify/Deploy, and public readback remain
  external and pending.

## 2026-08-11 KST — Full-suite evidence scope correction

- The preceding entry's “exact-tree” and “exact-source full-suite” wording was too
  broad. The `npm test` ended at `03:21:35.542+09:00`, while evidence documents were
  edited afterward to record that result. Therefore the later 67-file working tree
  as a whole did not run that full suite and must not inherit an exact-tree PASS.
- The bounded claim is: the unchanged current runtime/test/workflow source bytes ran
  uninterrupted `npm test` from `01:06:58.716+09:00` to `03:21:35.542+09:00`, exited
  `0` in `8,076.826s`, and completed both exact-ceiling paths plus every later gate
  through final `verify:s4`. Only evidence docs changed afterward.
- The current documentation tree is validated separately by `verify:spec`,
  `verify:links`, and `git diff --check`. This split evidence does not prove a full
  suite over the whole current tree. Exact-SHA CI, immutable review, approval, merge,
  deployment, and public readback remain external gates.

## 2026-08-11 KST — PR #58 transcript-ceiling and terminal-cleanup BLOCK remediation

- An independent exact-snapshot audit of head
  `a2210f1958080067b021a9c75336645f718c7427` correctly BLOCKed two remaining
  WebRTC resource-lifecycle defects. A peer could retain more than the generated
  512 unique canonical messages and 8,388,608 decoded raw message bytes, and a
  remote DataChannel close marked the transport closed without closing the still-live
  RTCPeerConnection. No GitHub review, PASS receipt, App attestation, native
  approval, merge, or deployment was issued for that head.
- `ManualWebRtcParticipantTransport` now treats inbound and outbound entries as one
  combined transcript budget. Duplicate detection precedes capacity accounting, so
  exact duplicates consume neither count nor bytes. Outbound cap checks precede
  native send and frame/dedupe state commits only after send success. Inbound
  overflow creates no transcript/dedupe entry or subscriber delivery before
  fail-close cleanup clears subscriptions.
- `VirtualTransportNetwork` now enforces the exact generated decoded raw-byte ceiling
  as well as the unique-message ceiling. The relay edge retains its conservative
  base64 decoded-size estimate and may reject slightly earlier. Therefore the bounded
  claim is the same upper ceiling plus fail-closed behavior, not byte-identical edge,
  virtual, and WebRTC accounting.
- Local close, remote channel close, remote peer close, error, and repeated calls now
  converge through one idempotent shutdown path. Captured native DataChannel and
  RTCPeerConnection close capabilities are each invoked at most once; remote channel
  close closes the still-live peer instead of stranding it. Error propagation no
  longer consults ambient `Error` construction or `instanceof`, and focused poison
  cases cover hostile `Error` and `Symbol.hasInstance`.
- Literal focused evidence passes on the frozen replacement source: Node transport
  `24/24` in `31,241ms` command time (`30,998.3923ms` TAP duration) and actual
  Chromium in `50,086ms`. These gates cover exact 512/message 513, exact 8,388,608/
  byte 8,388,609, combined inbound/outbound consumption, duplicate non-consumption,
  send-failure retry, no overflow-frame commit or delivery before cleanup,
  remote-channel cleanup, and one close of the still-live remote peer in the actual
  Chromium scenario. `git diff --check` also passes for the candidate.
- The earlier uninterrupted `8,076.826s` runtime/test/workflow full-suite PASS
  predates the current WebRTC runtime/test/security remediation and is historical. A
  fresh complete local suite, exact-head CI, immutable review, approval, merge,
  exact-main Verify/Deploy, and public readback remain pending or external gates.
- The root next P0 order is unchanged: provider-signed lease-bound liveness policy,
  independent provider possession response, and an effect-time exactly-once repair
  executor first; lineage-governed admission and failure-domain accounting follow.

## 2026-08-11 KST — WebRTC-remediated uninterrupted full-suite PASS

- The first fresh `npm test` attempt began around `05:23` KST. User steering stopped
  its tool cell and test process after approximately 82 minutes. It produced neither
  an exit-0 result nor the final `verify:s4` receipt and is therefore retained as an
  interrupted attempt, not a full-suite PASS.
- A separate hidden wrapper restarted the complete ordered suite at
  `2026-08-11T06:42:38.6738575+09:00`. It ended at
  `2026-08-11T09:06:30.4636057+09:00`, exited `0`, and completed every ordered stage
  through final `verify:s4` after `8,631,790ms` (`143m 51.790s`). This is the current
  runtime/test/workflow full-suite PASS for the WebRTC-remediated candidate.
- Covered source/runtime/test/workflow files remained unchanged after the successful
  run. A post-run process inventory found zero related workloads after excluding the
  inventory command itself.
- Evidence documents changed afterward only to record the successful run and are
  validated separately by `verify:spec`, `verify:links`, and `git diff --check`.
  Therefore the bounded claim is **CURRENT RUNTIME/TEST/WORKFLOW FULL SUITE PASS;
  CURRENT DOCS SPEC/LINK/DIFF PASS; EXACT-SHA EXTERNAL**, not a whole-current-tree
  exact full-suite PASS.
- The reviewer identity SSOT is also corrected without changing runtime code: the
  logical reviewer COMMENT/receipt, GitHub App ID `4456370` exact-head attestation,
  and machine user `ant713900-web` native latest-head approval are separate required
  gates. None substitutes for another, and exact-head governance remains external
  until all are re-issued for the final immutable candidate.

## 2026-08-13 — Lease-bound liveness policy focused slice

- Fresh base: `285ccbae01011a7c69e16016dc1bdd1d8d2e1203` (`origin/main` after fetch),
  branch `agent/codex-protocol-kernel--lease-bound-liveness-policy`.
- Added provider-signed `mortalos-placement-liveness-policy/1`, consumer-signed
  `mortalos-placement-liveness-challenge/2`, and policy-bound
  `mortalos-placement-failure-certificate/2`. The policy embeds exact verified offer
  and lease bytes and binds provider, consumer, roster digest, lineage, manifest,
  workload, shard, next sequence, exact window, and the limited
  `execution-receipt-pointer/1` profile. Legacy `/1` stays parseable but projects no
  lineage repair authority; observed conflicting provider policies halt.
- Focused PASS: `test/placement-liveness.test.mjs` `7/7` including fresh process and
  binding/window/fork/shared-memory negatives; lineage repair `1/1` in `630,717ms`;
  SDK `5/5`; async security `26/26` (`22/128`); actual Chromium P2P `61.1s` with
  browser-held non-extractable provider/consumer/observer keys and the existing
  transport/resource/origin-cut checks. Relevant lineage child count was zero after
  completion.
- One earlier lineage wrapper expired at 10 minutes while the CPU-active child kept
  running and then exited naturally; it was not counted as PASS. The exact-current
  rerun above completed with exit `0` under a 20-minute bound.
- Complete `npm test`, exact-head review/CI, merge, deploy, and public readback remain
  pending. Independent possession response and effect-time exactly-once execution are
  still the next P0; no provider-death/SLA/penalty/settlement or independence claim.

## 2026-08-13 — Exact policy-byte binding and final focused rerun

- Tightened challenge `/2` so the consumer-signed canonical body contains the exact
  provider policy bytes as well as its policy ID, predecessor receipt, and nonce.
  This removes the gap between semantic policy-ID binding and the documented exact-
  bytes claim.
- The first final liveness run was **not** counted as PASS: `6/7` completed and the
  new legacy-compatibility case exposed a missing test import. After adding only that
  import, the fresh rerun passed `7/7` in `36,640.729ms`.
- Exact-current follow-up PASS: SDK `5/5`; clean packed SDK consumer; security
  boundaries `26/26` (`22` direct / `128` discovered); generated profile; spec
  (`115` rejection codes, `102` relative links); links (`58` local, `11` HTTPS
  syntax-only); actual Chromium P2P in `61.6s`; lineage repair `1/1` in
  `632,324.675ms` runner time (`634.8s` command).
- The final relevant process inventory was `0`. Complete `npm test` and every
  exact-SHA governance/deployment gate remain pending for this source.
- A final test-only strengthening recomputed both a tampered provider policy ID and a
  swapped-policy challenge ID, proving that neither the provider nor consumer
  signature can be replayed over the rehashed document. The resulting exact test
  source passes liveness `7/7` in `36,750.888ms`; runtime source bytes did not change.

## 2026-08-17 — Provider-only sampled storage possession response

- Added canonical `mortalos-placement-liveness-response/2` with the
  `storage-merkle-sample/1` profile. The provider derives a nonce-selected leaf/path
  from its stored resource bytes and signs the exact challenge, lease, workload,
  content root, and proof without obtaining a fresh consumer execution receipt or
  consumer signature after the challenge.
- Resource execution now exposes the same lease/workload/nonce-bound Merkle proof
  primitive used by storage execution and liveness, avoiding a second proof
  definition. Sampled response-only evidence evaluates as `alive`; a valid failure
  certificate plus sampled response is `contested` and halts. Receipt-pointer `/1`
  remains parseable compatibility evidence but cannot authorize lineage repair.
- Exact-current focused evidence: combined resource execution/process, liveness, and
  SDK tests `21/21` PASS in `29,184.6727ms` (including liveness `8/8` and fresh
  process); lineage repair `1/1` PASS in `364,882.0793ms`; clean packed SDK consumer;
  async security boundaries `26/26` (`22` direct / `128` discovered); actual Chromium
  P2P PASS with browser-held stored bytes and a non-extractable provider key.
- One challenged Merkle sample is not full or continuous custody, provider death,
  breach, termination, penalty, settlement, honest timing, independent topology, or
  Sybil evidence. The next P0 remains effect-time reconciliation and exactly-once
  repair execution. Complete `npm test` and all exact-SHA review/deployment gates are
  still pending for this source.

## 2026-08-18 — Sampled-possession uninterrupted full-suite PASS

- Frozen source/runtime/test/docs-at-start `npm test` began at
  `2026-08-17T23:24:27.2533400+09:00`, ended at
  `2026-08-18T00:54:08.8156896+09:00`, exited `0`, and completed every ordered stage
  through final `verify:s4` in `5,381,562ms` (`89m 41.562s`).
- Material coverage included liveness response `/2`, resource possession helpers,
  lineage repair and fork halt, journal-v2 `128` signed replacement transitions to
  `384` chains plus-one rejection, `127/127` live-browser cycles to the same ceiling,
  browser-held stored-byte possession response, origin/relay cut, SDK/packed consumer,
  transport ceilings, security boundaries, governance, and final stage receipts.
- All related test child processes terminated naturally; the post-run relevant
  process inventory was zero. Evidence documents changed afterward only to record
  this result and are validated separately by spec, links, profile, security, and
  diff gates. The bounded claim is current source/runtime/test full-suite PASS plus
  post-run docs static PASS, not an exact-SHA review, merge, deployment, or public
  promotion receipt.

## 2026-08-18 — Single-shard effect-time repair executor focused slice

- Added `deriveCommittedPlacementRepairEffect`, which consumes original Capsule,
  generation and commit bytes plus current placement/liveness evidence. It never
  consumes the public action plan. The descriptor binds the failure policy,
  challenge, certificate IDs, sequence, shard/workload, replacement provider/lease,
  and a replacement-independent repair slot.
- Added the internal durable executor. A no-replace hard-link claim selects one
  replacement per failure slot. The replacement-bound `effect_id` is passed as the
  private provider session's idempotency key; a signed placement result is verified
  before immutable local commit.
- Final focused Node PASS: `test/placement-repair-executor.test.mjs` `1/1` in
  `209,083.6219ms`, including concurrent same-effect convergence, retry, different
  replacement, forged/contested/already-repaired zero-call paths, and process exit
  after provider storage before local result commit followed by exact-key recovery.
- Final exact-source origin-cut Chromium PASS: delayed sampled
  response caused zero provider calls; certificate-only provider loss executed shard
  0 once and retry did not call the provider again. The existing 127-cycle corpus
  reached generation 129, exact 384 chains (`128/128/128`) and 387 receipts in
  `1,542,995ms`, rejected the signed plus-one candidate without changing bytes,
  reloaded, and rejected the oldest replay.
- Security boundary inventory PASS at `22` direct / `129` discovered. Fresh complete
  suite and exact-SHA governance remain pending. This is one local-filesystem action
  with a conforming idempotent provider session, not multi-action scheduling, global
  gossip/consensus, independent provider restart durability, or admission evidence.
- Final lineage focused regression PASS: `test/lineage-placement.test.mjs` `3/3`
  in `819,941.0788ms`, including generation-time resource rejection, A-to-B repair,
  fresh-process/schedule convergence, and same-parent fork halt.

## 2026-08-19 — Single-effect successor completion focused slice

- Added an internal completion coordinator beside the effect executor. It rederives
  the committed failure/effect and signed provider result, builds one proved successor
  placement generation, claims a replacement-result-bound completion slot, and calls
  only a private idempotent Continuity session.
- Focused Node `test/placement-repair-executor.test.mjs`: PASS `1/1`; body
  `700,895.2506ms`, runner `701,056.7907ms`. Coverage includes concurrent one-call
  completion, zero-call exact retry, different candidate, forged result, late response,
  superseded head, and commit-then-failure recovery with one signing operation.
- Actual origin-cut Chromium confidential-placement verifier: PASS. The executor
  performs shard 0 once, the coordinator commits proved generation 2 once, retry adds
  neither provider nor Continuity call, and the existing `127/127` provider-history
  corpus reaches generation 129 / 384 chains (`128/128/128`) with a `1,596,239ms`
  dynamic segment. Signed plus-one, reload/replay, private-material, and post-cut
  request-zero assertions remain PASS.
- Async security boundary verifier PASS `26/26`, `22` direct / `130` discovered;
  specification PASS (`115` rejection codes, `102` relative links), link check PASS
  (`58` local, `11` HTTPS syntax-only), and `git diff --check` PASS.
- No complete `npm test`, exact-SHA CI/review, commit, push, merge, or deployment was
  performed for this slice. Multi-action/network reconciliation remains HOLD.

## 2026-08-20 — Multi-action fresh-evidence batch focused slice

- Added the internal `executeAndCompleteLineagePlacementRepairBatch` entrypoint. It
  snapshots the complete action/capability set, requires one replacement for every
  committed repair intent, canonicalizes shard order, preflights before provider
  effects, and re-reads a private evidence session before every effect and completion.
- The batch reuses each single-effect durable slot and result. It creates one canonical
  batch completion slot from all repair/result IDs and commits one proved successor
  containing every replacement. Public plans and results remain non-capabilities.
- Late-proof/concurrency focused PASS: `1/1`, body `554,644.4665ms`, runner
  `554,891.4078ms`. A late response after shard 0 produced zero shard-1 and Continuity
  calls; stable retry reused shard 0; reversed concurrent action lists converged with
  provider calls `[1,1]`, one Continuity call, proved generation 2, and zero intents.
- Partial-provider focused PASS: `1/1`, body `285,382.863ms`, runner
  `285,659.9977ms`. The first run left shard 0 committed and shard 1 interrupted;
  retry kept shard 0 at one call, retried shard 1 only, and committed one successor.
- Security boundary verifier PASS `26/26`, `22` direct / `131` discovered; the new
  entrypoint and complete module are digest-pinned. Syntax and `git diff --check`
  PASS. The batch test is included in `test:p2p-placement`.
- This is local private-capability reconciliation, not a transport gossip service.
  Fresh complete suite, actual network adapter, provider/Continuity restart durability
  independent of their idempotency stores, exact-SHA governance, and deployment remain
  pending.

### Frozen-source batch rerun after Promise-boundary hardening

- Replaced dynamic Promise `.then/.finally` continuation in the batch completion path
  with an internal `try/finally` async boundary, then refreshed the reviewed module and
  entrypoint digests.
- Exact final `node --test test/placement-repair-batch.test.mjs` PASS `2/2`, total
  `826,423.4941ms`; late-proof/concurrency `547,889.2043ms`, partial-provider retry
  `278,277.6054ms`. No source/test edits followed that run.

## 2026-08-20 — Transport-backed effect-time evidence focused PASS

- Added `lab/placement/network-evidence-session.mjs`. The factory returns the exact
  plain own-data capability required by the batch executor while retaining a private
  monotonic cursor and deduplicated payload set. Every fetched frame is decoded and
  canonicalized by the portable relay verifier; only `liveness-response` payload
  bytes enter the evidence snapshot. Relay sequence, request ID, and message metadata
  confer no placement authority.
- Reworked the existing two-fixture batch gate without adding another expensive
  cryptographic setup. In the first target provider 0 publishes the shard-1 late
  response through `VirtualTransportNetwork`; the next read rejects before provider 1
  and Continuity, leaving calls `[1,0]` and `0`. It passes `1/1` in
  `109,791.7103ms` after adding differently wrapped duplicate-payload and ignored-
  artifact coverage. In the second target a provider interruption followed by reversed
  concurrent retries converges on one completion without repeating shard 0; it passes
  `1/1` in `533,175.9844ms` with provider calls `[1,2]` and Continuity calls `1`.
- The async security registry and whole-module/function pins now include the session;
  the audit passes `26/26` with `22` direct / `132` auto-discovered entrypoints.
- This is focused local source evidence only. Fresh complete suite, actual connected
  WebRTC/relay binding, provider/Continuity restart durability, exact-SHA CI/review,
  merge, deploy, and public readback remain external or HOLD.

## 2026-08-20 — Provider-domain sequential restart recovery focused PASS

- Added `lab/placement/durable-repair-provider-session.mjs`. Before suspension it
  owns the canonical effect, replacement offer/lease, and resource bytes; the
  replacement-bound `effect_id` is the provider-domain idempotency key. It publishes
  immutable canonical request and placement-result files through same-filesystem
  no-replace links and restores an existing result before invoking the captured
  provider capability. Same-process concurrent calls coalesce on one in-flight
  operation.
- Strengthened the executor crash target. A fresh child commits the provider-domain
  result and exits `86` before the executor can commit its own local result. A new
  parent session uses the same directory with an underlying provider that would throw;
  recovery returns `committed`, exact retry returns `already-committed`, and the
  underlying provider call count remains exactly `0` for both.
- Final focused `node --test test/placement-repair-executor.test.mjs` PASS: `1/1`,
  body `698,797.1523ms`, runner `698,964.4042ms`. The first attempt failed only because
  the child test projected executor-only `shard_index` into the seven-field provider
  placement; the fixture projection was narrowed and the final frozen-source rerun
  passed.
- The async security registry now covers the durable session entrypoint; the reviewed
  whole-module and function digests are pinned. The inventory is `22` direct / `133`
  auto-discovered entrypoints. This entry does not promote unsigned local files to
  authority.
- Scope remains narrow. Sequential restart after a durable provider result is proved,
  but two distinct processes racing the first provider call are not serialized by a
  cross-process execution lease. Continuity-session restart, actual connected
  WebRTC/relay binding, bounded schedule corpus, fresh complete suite, and exact-SHA
  governance remain HOLD or external.

## 2026-08-20 — Cross-process first-provider execution exclusion focused PASS

- Replaced the request-file-as-claim convention with a canonical
  `mortalos-durable-repair-provider-claim/1` carrying the exact request ID and a fresh
  32-byte owner nonce. Each process publishes a unique temporary claim and competes
  for one predecessor/effect-keyed hard link. Only the link winner may invoke the
  provider; a loser restores a completed result or rejects
  `E_PLACEMENT_PROVIDER_SESSION_CLAIMED` before the provider call.
- Added `test/durable-repair-provider-session.test.mjs` and its child harness. Two
  processes wait behind one release barrier, then race the same exact effect. The gate
  passes `2/2` in `968.7452ms`: exactly one side-effect file is created and a restarted
  session restores the result with `0` underlying provider calls.
- A separate child exits `87` after its provider side effect but before durable result
  publication. The surviving claim prevents a restarted session from calling the
  provider again; it rejects `E_PLACEMENT_PROVIDER_SESSION_CLAIMED` with call count
  `0`. This is intentional safety-over-availability: no timer, stale-owner inference,
  claim deletion, or automatic takeover is implemented.
- Existing integration remains compatible: final
  `node --test test/placement-repair-executor.test.mjs` PASS `1/1`, body
  `636,184.7358ms`, runner `636,460.3782ms`. The security verifier passes `26/26`
  with `22` direct / `133` discovered after refreshing the whole-module digest.
- Remaining P0: Continuity-session restart, a governed recovery artifact for an
  unresolved provider claim without duplicate external effect, actual connected
  WebRTC/relay binding, bounded schedules, fresh complete suite, and exact-SHA gates.

## 2026-08-20 — Continuity-domain durable restart and exclusion focused PASS

- Added `lab/placement/durable-repair-continuity-session.mjs`. It owns the exact
  Capsule/generation/completion-idempotency request before suspension, publishes
  immutable canonical request and Capsule/commit result files, restores a completed
  result before the captured Continuity call, and uses one request-keyed owner-nonce
  hard-link claim for cross-process first execution.
- Added `test/durable-repair-continuity-session.test.mjs` and its child harness. Final
  focused evidence passes `2/2` in `1,191.3289ms`: a two-process release race produces
  exactly one side effect and a restarted session restores with `0` underlying calls.
  A separate child exits `88` after its side effect but before result publication; the
  unresolved claim makes restart reject `E_PLACEMENT_CONTINUITY_SESSION_CLAIMED` with
  `0` underlying calls. No timeout, stale-owner inference, deletion, or takeover exists.
- Strengthened the signed executor recovery target. The durable Continuity result is
  published before a synthetic outer failure; a fresh session recovers the exact
  Capsule/commit and exact retry remains `already-committed`. Final
  `node --test test/placement-repair-executor.test.mjs` passes `1/1`, body
  `632,007.0601ms`, runner `632,431.3446ms`, with exactly one signing operation and
  `0` restarted underlying Continuity calls.
- The async registry and reviewed module/function pins now include the Continuity
  session; the security audit passes `26/26` with `22` direct / `134` discovered
  entrypoints. `test:p2p-placement` includes the direct durable-session gate.
- Scope remains unsigned conforming same-filesystem execution evidence. The adapter
  does not independently authorize returned Continuity bytes. Governed recovery for
  unresolved provider/Continuity claims, actual connected WebRTC/relay binding, fresh
  complete suite, exact-SHA CI/review, merge, and deployment remain HOLD or external.

## 2026-08-21 — Proof-import unresolved-claim recovery focused PASS

- Added separate provider and Continuity result-recovery capabilities. They require
  the exact already-published canonical request and no-replace owner claim, write one
  immutable result plus a self-hashed recovery record, and expose no provider
  execution or Continuity signing method. The recovery record is local provenance,
  not authority.
- Added outer executor recovery APIs. Provider recovery rederives the original effect
  and verifies the signed placement receipt against the exact generation/provider/
  lease/workload/shard before import. Continuity recovery reconstructs the exact
  proved successor and verifies the supplied Capsule/commit before import. Invalid
  proof is rejected before durable result publication; absent proof keeps the claim
  unresolved with no timeout, deletion, or takeover.
- `node --test test/durable-repair-provider-session.test.mjs
  test/durable-repair-continuity-session.test.mjs` passes `4/4` in `504.1263ms`.
  Crash exits `87`/`88` leave unresolved claims, valid proof restores the exact result,
  and fresh sessions invoke the captured underlying capability `0` times.
- `node --test test/placement-repair-executor.test.mjs` passes `1/1`, body
  `912,102.634ms`, runner `912,307.6841ms`. Two earlier runs were non-PASS evidence:
  one test assertion incorrectly used unsigned placement `observed_at_ms` as a forged
  authority field, and one complete matrix exceeded the former `900,000ms` harness
  deadline. The final test uses a corrupted signed execution receipt and a forged
  Continuity commit, retains the full existing matrix, and raises only the explicit
  test timeout to `1,200,000ms`.
- `npm run verify:security-boundaries` passes `26/26` with `22` direct / `134`
  discovered entrypoints; the three changed module digests are pinned. Fresh complete
  suite and exact-SHA gates remain external. The next P0 is the connected WebRTC/relay
  batch evidence adapter plus a bounded schedule corpus, then trust-rooted admission.

## 2026-08-21 — Connected WebRTC batch reconciliation focused PASS

- Added one harness-only `readTransportRange(after, limit)` surface to the participant
  Lab. It returns detached frames from an already-connected transport and performs no
  evidence classification, lineage decision, provider call, or signing operation.
  The existing private `PlacementNetworkEvidenceSession` remains the trust boundary:
  it re-decodes canonical frames, verifies monotonic sequence, ignores non-response
  artifacts, and deduplicates exact response payload bytes.
- Extracted the signed two-action batch setup into
  `test/placement-repair-batch-fixture.mjs` so the Node and actual Chromium gates use
  the same canonical Capsule, generation, liveness, provider-session, and Continuity
  setup. The complete Node batch file passes `2/2`: late-proof/concurrency plus
  interruption/reversed retry, runner `755,752.0478ms`.
- Extended `scripts/verify-p2p-placement-chromium.mjs` after origin cut. Two actual
  browser endpoints connect directly, publish one liveness response twice, rewrap the
  identical payload under another message ID, and publish an ignored challenge. The
  receiver range is exactly sequences `[1,2,3]`; the duplicate consumes no frame and
  the two response wrappers contribute one deduplicated response.
- Publishing the response after provider 0 leaves provider calls `[1,0]` and
  Continuity calls `0`. A separate reconnect followed by receiver disconnect makes
  the next range read reject before provider 1, again leaving every later provider and
  Continuity call at zero. The actual Chromium verifier passes with all pre-existing
  file, receipt, repair, transport-capacity, cleanup, primordial, and origin-cut gates.
  Its exact wall time was not captured and is intentionally not claimed.
- `npm run verify:security-boundaries` remains PASS `26/26`, `22` direct / `134`
  discovered; the harness range surface required no new authority pin. This is a
  manually signaled same-host direct WebRTC transcript, not background gossip,
  relay-service binding, arbitrary-NAT reachability, or independent topology.
  Fresh complete suite and exact-SHA gates remain external. The next P0 is a fixed-seed
  bounded response/certificate/order/partition/disconnect/restart schedule corpus.

## 2026-08-21 — Signed-evidence repair schedule corpus focused PASS

- Added `test/placement-repair-schedule-corpus.mjs`. Each of `10,000` seeds creates a
  fresh production `PlacementNetworkEvidenceSession` and applies eight deterministic
  response/certificate/order/partition/disconnect/restart events over the exact signed
  failure certificates and sampled-possession responses from the shared two-action
  fixture. The schedule follows the executor's three evidence checkpoints rather than
  repeatedly ticking a planner.
- The driver distinguishes raw provider invocation from a committed repair/accounting
  effect. Before-effect interruption may retry an invocation, while durable provider
  and Continuity results survive restart and their effect IDs can enter each ledger at
  most once. Exact duplicate frames consume no transcript entry, differently wrapped
  responses deduplicate by payload, certificate artifacts do not widen the committed
  generation, corrupt order halts, and an unavailable partition performs no later call.
- `node --test test/placement-repair-schedule.test.mjs` passes `1/1`, body
  `736,437.8624ms`, runner `736,594.7467ms`. The parent and a separately generated
  fresh child process return byte-identical canonical results despite distinct
  WebCrypto key material.
- `node scripts/verify-placement-repair-schedules.mjs` passes in separately bundled
  Chromium. The committed Node/fresh-process/Chromium digest is
  `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM`; verdicts are `2749` completed,
  `2489` liveness-halted, `2044` order-halted, and `2718` partition-unavailable.
  Duplicate provider/accounting/Continuity effects are exactly `0/0/0`.
- Added the Node and Chromium schedule gates to `test:p2p-placement`. The corpus uses
  production evidence parsing and signed bytes but its effect ledger is an oracle
  anchored by the existing full executor and actual DataChannel focused tests; it is
  not 10,000 external writes, billing settlements, or independent-network trials.
  Fresh complete suite and exact-SHA gates remain external. The next P0 is lineage-
  governed admission/failure-domain accounting with explicit trust roots.

## 2026-08-21 — Exact-source schedule corpus revalidation

- After pinning the golden digest, exact verdict distribution, provider invocation-
  versus-effect assertion, and a 600-second child timeout, the current exact test file
  was rerun. `node --test test/placement-repair-schedule.test.mjs` passes `1/1`, body
  `733,441.2098ms`, runner `733,588.2114ms`, with no fail/cancel/skip.
- The separately bundled Chromium golden-digest gate also passes on its final optimized
  source. It recomputes all `10,000 × 8` schedules in Chromium without first rerunning
  the Node corpus in the same command, and still matches the committed digest and
  `2749/2489/2044/2718` verdicts with duplicate effects `0/0/0`.

## 2026-08-21 — Lineage-governed logical admission focused PASS

- Added bounded placement-admission trust roots, issuer-signed evidence, and custody-
  quorum-signed membership epoch `/1`. The epoch binds the exact Capsule/head,
  provider exclusion, evidence set, validity, prior epoch, and deterministic roster.
  Alias keys collapse by operator root; canonical matching selects at most one observer
  per operator root and logical failure domain. Adjacent epochs preserve operator/domain
  quorum intersection, while independently valid same-parent epochs halt.
- The initial nested design crossed the generated 65,536-byte relay-message ceiling.
  The final architecture keeps each epoch as a content-addressed lineage generation
  sidecar and makes admitted liveness policy `/2` bind only epoch ID, prior ID,
  evaluation instant, and selection digest. The transport ceiling was preserved.
- Lineage creation verifies sidecars against the current Capsule. Commit, action,
  reconciliation, and effect-time paths reverify against the authenticated historical
  Capsule descriptor. Missing, duplicate, extraneous, noncanonical, or history-
  mismatched sidecars fail closed.
- Exact focused results: admission/liveness/profile/SDK `21/21` in `31,918.614ms`;
  late-response batch `1/1` in `166,487.7185ms`; main lineage with missing/duplicate
  sidecar negatives `1/1` in `534,301.6707ms`; packed SDK PASS; actual Chromium
  P2P/admission/repair PASS; security `26/26`, `22` direct / `134` discovered.
- This establishes policy-scoped logical diversity only. Trust-root/evidence labels are
  not external truth, and the same-PC fixtures do not prove distinct devices, networks,
  credentials, administrators, regions, physical capacity, or Sybil resistance. Fresh
  complete-suite and exact-SHA gates remain pending. The next P0 is external issuer
  root rotation/revocation plus evidence-byte verification, followed by measured
  independently administered topology.

## 2026-08-21 — Dual-signed attestation and trust-root rollback closure

- Replaced the opaque admission-evidence digest with a self-contained canonical
  challenge statement. The subject and issuer sign distinct domains over the same
  evidence ID. Verification now proves exact subject-key control and the issuer's
  operator/domain assertion without consulting a live API. Exact generated maximum
  challenge bytes pass; max+1, issuer/subject overlap, and subject-signature tamper
  fail closed.
- Trust roots now bind a stable authority ID, positive sequence, and exact predecessor.
  Membership epochs require direct rotation, explicit removal-by-revocation,
  cumulative root/issuer-key history, and cumulative retired-authority state. Skipped
  rotation, stale-root revocation, silent removal, root-ID reuse, prior issuer-key
  rollback, and retired-authority resurrection reject before membership publication.
- Focused admission tests pass `5/5` in `27,452.9363ms`. The combined admission,
  liveness, profile, and SDK group passes `22/22` in `32,804.4758ms`, including a
  separately spawned liveness process. The existing actual Chromium P2P verifier
  passes with browser WebCrypto subject+issuer evidence signatures while retaining
  WebRTC, origin-cut, liveness, placement, and batch reconciliation checks.
- Generated profile, clean packed SDK, diff-check, and security-boundary audit pass;
  security remains `26/26`, `22` direct / `134` discovered. The reviewed admission
  module hash is `3d394b4ee33d58fa947d241849066d326d31904d78ec98d49177bede8cc1aba4`.
- This closes local lifecycle replay and exact evidence-byte verification, not issuer
  honesty or physical independence. The next P0 is to operate these exact artifacts
  with independently administered issuer credentials and measure induced failures
  across distinct hosts, networks, and administrative domains.

## 2026-08-21 — Policy-locked process admission ceremony

- Added `lab/placement/admission-signer-session.mjs`. It accepts only a bounded
  canonical placement-admission request, locally rederives the evidence ID, locks the
  signer to one exact trust root and attestation policy, verifies that the local
  public identity occupies the configured issuer/subject role, and delegates only
  that role's domain-separated message to a constructor-captured private signer.
- One root/subject/challenge/role slot is sign-once. Exact retries return the same
  canonical response; a different evidence ID in the same slot rejects. A signer
  failure releases the slot rather than publishing a partial response.
- Added a bounded loopback HTTP child and process test. Issuer, subject, and negative
  control keys are generated as non-extractable WebCrypto keys in distinct children.
  The coordinator receives public identities, the public trust root, canonical
  request, and two signature responses only. Wrong root, policy, identity, bearer
  token, conflicting challenge reuse, and request max+1 reject before signing; issuer
  termination leaves the subject endpoint usable.
- The ceremony test passes `1/1` in `953.7608ms`. The combined ceremony/admission/
  liveness/profile/SDK gate passes `23/23` in `32,610.1841ms`. The new test and the
  existing admission test are now part of `test:p2p-placement`, closing their prior
  omission from the complete-suite path.
- The signer session is now an audited async export. Security passes `26/26` with
  `22` direct / `135` discovered entries; its module digest is
  `1821b85e73f0b712ccefec48fc204f481604a749e303900ff8f7f9e715194230`.
- This is a real process/key-capability boundary but remains one-PC loopback under one
  test coordinator. It does not prove separate administrators, hosts, networks,
  power domains, or honest failure-domain labels. Fresh complete-suite, actual
  multi-host operation, exact-SHA governance, commit, push, and deployment remain
  pending.
- Added a direct signer-session containment regression after the initial process
  gate. It mutates the caller request immediately after the async call, injects one
  private-signer failure, retries the same slot, and verifies the resulting subject
  signature; it also proves an accessor-backed `sign` capability is rejected with
  zero getter calls. The direct session plus process ceremony pass `2/2` in
  `990.193ms`.
- With that regression included, the exact combined ceremony/admission/liveness/
  profile/SDK command passes `24/24` in `33,406.2827ms`.
- Finalized the portable policy connection after that run: the canonical configured
  signer policy digest must equal the trust root's `policy_digest`; an unrelated
  self-consistent root policy is rejected at session construction. The exact current
  direct process/session gate passes `2/2` in `905.4801ms`, and the exact current
  combined ceremony/admission/liveness/profile/SDK gate passes `24/24` in
  `33,082.783ms`.
- After the policy-digest binding, the reviewed signer-session module digest is
  `2d0778d564eb5571fbfafd174ffbb88468e2570cd77501b0ebea56d4fc73084c`;
  async security again passes `26/26`, `22` direct / `135` discovered.
- Added optional durable custody through the existing local Node authority. The signer
  session now delegates an owned role message plus deterministic challenge-slot tuple;
  the authority's mode-0600 identity file, atomic sign-once journal, and process lock
  preserve both the key identity and decision across restart.
- The durable process test starts two issuer services over one authority path and races
  different evidence for the same slot. Exactly one returns `200` and one `409`.
  After issuer and subject restart, both identities and the root are unchanged, exact
  winner responses are byte-identical, and both loser requests still return `409`.
  The complete direct ceremony/session file pair passes `3/3` in `2,111.8895ms`.
- A first `25`-test combined attempt correctly remained FAIL because its public-
  transcript assertion searched random base64 values for English words such as
  `secret`; one public key happened to match. The regression now inspects recursive
  field names, which is the actual private-material boundary, rather than random
  public values. That failed run is not promoted.
- Fresh exact-current ceremony/admission/liveness/profile/SDK passes `25/25` in
  `33,355.2228ms`. Security passes `26/26`, `22` direct / `135` discovered. The
  reviewed signer-session module/function digests are
  `d8211b006422f68aedbda3ce97174b863414c57fed3f4eb97a4329867cf1a34d` and
  `2e1fdb096beeff20e876fdb6434d05bb8f957b04b4e4e25e1dcabb9e9a53d1af`.
- Durable local PKCS8 custody is explicitly not HSM/non-extractable, hostile-disk, or
  independent-administrator evidence. Complete-suite, multi-host operation,
  exact-SHA governance, commit, push, and deployment remain pending.
- Evidence-scope correction: the local authority requests file mode `0600` where the
  filesystem supports it. That request is not evidence that Windows/NTFS ACLs enforce
  POSIX mode bits; the established result is process-race and restart durability on
  one PC, not OS-level key isolation.

## 2026-08-21 KST — Private-key-free endpoint ceremony replay

- Added `mortalos-placement-admission-external-ceremony-challenge/1`: its 32-byte
  nonce accompanies a domain-separated digest over exact issuer origin/key ID and
  subject origin/key ID. Both signers approve those bytes through the existing
  dual-signed evidence ID. Recomputing the public bundle hash after an origin edit
  therefore still fails offline replay.
- Added a private-key-free HTTP coordinator and CLI. It owns the canonical request,
  endpoints, bearer strings, timeout, and all four captured Request objects before
  suspension; refuses redirects and non-loopback plaintext HTTP; bounds every response
  stream; verifies role identities, responses, and final evidence; and publishes one
  token-free bundle by no-replace hard link. An existing output rejects before network
  access and pending files are cleaned.
- A first post-import capability-poison test correctly exposed that capturing only
  `fetch` was shallow: Undici consulted ambient `URL` when starting the second request.
  That failed run is not promoted. Constructing all four Request objects before the
  first await closes the transitive dependency; hostile ambient `fetch`, `URL`, and
  reader methods record zero calls.
- Focused external ceremony `3/3` passes in `2,629.6625ms`; the exact-current combined
  admission/ceremony/liveness/profile/SDK gate passes `28/28` in `33,419.5179ms`.
  Security passes `26/26`, `22` direct / `136` discovered. The reviewed ceremony-client
  module/function digests are `8a31adac1cfddb239905caba3b9e14ddaef8c3198675dbae9bf5778dbf18a625`
  and `3d7cfd7d1eed8980e344da0f26d9ca360490ed47a58b6d299ad80d2184e0fa02`.
- All executable endpoints remain loopback on one PC. The bundle proves exact key
  agreement to endpoint declarations and deterministic replay, not independent
  administrators, DNS/TLS custody, hosts, networks, regions, or physical domains.
  Fresh complete suite, exact-SHA governance, live multi-host operation, commit, push,
  and deployment remain pending.

## 2026-08-21 KST — Origin-locked durable signer services

- The preceding offline bundle correctly detected a rewritten advertised origin, but
  that was not yet signer-local authorization: a service could still sign a request
  whose origin declaration differed from the endpoint it was configured to operate.
  Challenge format `/2` now carries both exact canonical origins and key IDs plus their
  domain-separated binding digest, and each signer checks its role-specific origin
  before claiming a slot or invoking private-key authority.
- The explicit two-origin challenge did not fit the old generated 256-byte ceiling. A
  first exact `/2` run therefore rejected all three external cases at `challenge-bytes`;
  that failed run is not promoted. The protocol profile now sets the still-bounded
  challenge ceiling to 512 bytes, with the existing exact-max/max-plus-one gates.
- Added the bounded operator-facing HTTP service and signer CLI. Bearer credentials are
  environment-only, readiness exposes public identity/configuration only, bodies and
  concurrency are bounded, redirects and remote plaintext coordinator requests remain
  forbidden, and the final replay bundle contains no bearer or private material. Both
  issuer and subject reject a `127.0.0.1` to `localhost` alias before key use.
- A second-order restart gap then became visible: durable private-key and sign-once state
  did not durably bind endpoint policy. Added self-hashed signer profile `/1` and one
  same-directory no-replace hard-link lock over identity key ID, role, trust root ID,
  policy digest, and canonical endpoint origin. Two processes racing different origins
  against one profile path have exactly one winner; exact retry restores byte-identical
  state, the losing origin remains `E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CONFLICT`, and
  crash-left pending files are never selected.
- `test/placement-admission-signer-service.test.mjs` passes `2/2` in
  `2,457.7781ms`. The exact signer-profile/service plus ceremony/admission/liveness/
  profile/SDK group passes `30/30` in `33,864.4836ms`. Security passes `26/26`,
  `22` direct / `137` discovered; generated profile check passes.
- Frozen module SHA-256 values are binding `5a9e22411376852642d782c5bb0655c055d8cc0ff387cdde17ceb0ef801443b6`,
  client `af145a5f2b48b46059ec1026df3a0227264cb478e125654934d5d34cbd00f92f`,
  signer session `f58cc1a1a8f0e44025e21e697bb810c9f8170e8b66ae5753423cfcb64161432c`,
  HTTP service `7b7b9278602a53e321e6a37f10b00b01d8da2408eedb612717eac4f11b865f45`,
  and durable profile `8af79356e5c81ca94fa2258c37eb43ebba11a6d830393753be43f59a7c6940c7`.
- The durable profile is unsigned local state under trusted directory custody. Loopback
  services do not prove DNS/TLS certificate custody, independent administrators, hosts,
  networks, regions, or physical failure domains. Fresh complete-suite, exact-SHA
  governance, live multi-host operation, commit, push, and deployment remain pending.

## 2026-08-21 KST — Fresh HTTPS deployment observation without topology promotion

- Added `mortalos-placement-admission-deployment-observation/1` and an operator CLI.
  A fresh process restores the exact dual-signed ceremony, requires both declared
  origins to be HTTPS, verifies bounded live `/identity` role/key responses through
  its process trust store, and records TLS protocol, ALPN, peer certificate/public-key
  digests, and socket remote addresses.
- The central boundary is intentionally negative: a certificate, address, or live key
  match is an observation, not administrative or failure-domain authority. Every valid
  artifact fixes `non_authority:true`, `independent_administration:"unproven"`,
  `independent_failure_domains:"unproven"`, and
  `requires_fresh_live_observation:true`; offline restore reports integrity only.
- The focused regression uses two distinct self-signed TLS roots and keys behind two
  local HTTPS reverse proxies sharing one loopback address. It therefore proves that
  distinct origins/certificates/keys can coexist with
  `remote_addresses_distinct:false` and must not be promoted to topology truth.
  Swapping one live identity rejects before output; self-rehashed observation or
  authority promotion rejects; an existing no-replace output rejects before dead
  endpoints are contacted. An early canonical-parse call and an invalid generic
  `KeyObject.prototype.export` capture were corrected before evidence collection and
  are not promoted as PASS runs.
- Focused observer `1/1` passes in `2,153.6788ms`. The exact-current deployment-
  observer plus signer-profile/service, ceremony/admission/liveness/profile/SDK group
  passes `31/31` in `33,492.5431ms`. Security passes `26/26`, `22` direct / `138`
  discovered. Frozen observer module/function SHA-256 values are
  `56a525add073cd61bf5a9e47ec66a870bd361159b09827607460f08d9265be8b` and
  `ea3d2bc27cbd79e3583a19bddb2f64850b0cabc14de1e0254ac0fdad7cfd5a79`.
- TLS trust-store configuration, DNS/account custody, independent operators, hosts,
  networks, regions, and physical failure domains remain external evidence. Fresh
  complete-suite, exact-SHA governance, live multi-host operation, commit, push, and
  deployment remain pending.

## 2026-08-21 KST — Bounded p2p test-file concurrency after timeout-only full attempt

- The first cumulative `npm test` attempt started at `07:36:16.2725370+09:00` and
  ended nonzero at `08:33:12.9786832+09:00`, wall `3,416,706ms`. There were no
  protocol assertion failures. Default Node test-file fan-out made the genuine signed
  128-cycle journal ceiling compete with batch, executor, and 10,000-schedule CPU
  corpora; those three tests were cancelled only at their `900,000ms`, `1,200,000ms`,
  and `900,000ms` wall limits. This run is not promoted as PASS evidence.
- The three cancelled files then ran with `--test-concurrency=1` and passed `4/4` in
  `2,894,352.8904ms`: provider-interruption batch `826,790.9508ms`, executor
  `1,163,858.3671ms`, and schedule `734,196.6988ms`. The first two consumed 91.9%
  and 97.0% of their old limits, proving that both unbounded fan-out and inadequate
  variance margin contributed.
- `test:p2p-placement` now fixes Node test-file concurrency at `2`. Only the measured
  provider-interruption batch timeout changes `900,000→1,200,000ms`, and executor
  `1,200,000→1,500,000ms`; the schedule limit and every assertion remain unchanged.
- The exact worst-case four-file group—journal v2 plus batch, executor, and schedule—
  passes `13/13` in `2,650,963.2847ms`. Under bounded concurrency the signed ceiling
  passes in `1,753,841.0621ms`, batch interruption in `871,815.9221ms` (72.7% of
  budget), executor in `1,211,615.595ms` (80.8%), and schedule in
  `780,052.3548ms` (86.7%). A fresh complete suite after this source freeze is still
  required; exact-SHA governance, commit, push, deployment, and live multi-host
  evidence remain pending.

## 2026-08-21 KST — Full-suite authority and portable-boundary failure epochs

- Full attempt 2 started at `10:10:35.2403813+09:00` and ended nonzero at
  `11:38:31.5138692+09:00`, wall `5,276,273ms`. Its bounded Node P2P corpus passed
  `68/68`, including the formerly cancelled batch/executor/schedule files, and the
  schedule differential plus actual P2P Chromium vertical passed. The confidential
  Chromium vertical then correctly rejected generation creation as
  `E_LINEAGE_PLACEMENT_LIVENESS: policy-bound-authority-required`: its provider-signed
  policy lacked an admitted membership epoch sidecar. This run is not PASS evidence.
- The Lab controller now exposes only a high-level browser-held Continuity capability
  that prepares, custody-approves, and finalizes the exact membership epoch. The
  admission fixture uses that capability without exposing a raw signing oracle. The
  confidential Chromium verifier admits the exact provider/observer roster, binds the
  liveness challenge to that epoch, and passes the epoch bytes into generation 1.
  Focused admission/liveness passes `13/13`; the final high-level confidential
  Chromium vertical passes in `1,945,182ms`, including membership-bound failure,
  durable repair, generation 129/384-chain ceiling, and signed plus-one rejection.
- Full attempt 3 started at `12:51:23.6288990+09:00` and ended nonzero at
  `14:58:53.4014434+09:00`, wall `7,649,773ms`. It passed every core, security,
  receipt, P2P Node, schedule differential, actual P2P Chromium, confidential
  Chromium, transport, SDK, continuity, relay, multi-browser, Lab, cost, R1, build,
  and UX gate. Near the end, `verify:portable` rejected the local variable spelling
  `document` in `src/placement/admission.mjs` as a DOM dependency. This run is not
  PASS evidence.
- The portable correction is intentionally mechanical: two local `document`
  variables became `capsuleDocument`; behavior and serialized bytes are unchanged.
  The admission module security pin is synchronized to
  `dbed9fd15611f4fc6fcba0c79b663d779aedef0b9f23ef1b36b84ce9dd3b0283`.
  The direct recovery gate passes `verify:portable`, security boundaries `26/26`,
  admission/liveness `13/13`, syntax, and diff checking.

## 2026-08-21 KST — First complete policy-bound admission/liveness/repair suite PASS

- Frozen runtime/test bytes ran uninterrupted `npm test` from
  `2026-08-21T15:08:09.9777152+09:00` through
  `2026-08-21T17:12:46.1993423+09:00`, exit `0`, wall `7,476,222ms`
  (`124m 36.222s`). The ordered chain reached final `verify:s4`; this is the first
  complete-suite PASS that includes bounded P2P concurrency, lineage-governed
  membership, provider-signed lease-bound liveness, independent possession response,
  durable effect-time repair, and the portable admission module together.
- Node P2P passed `68/68` in `3,105,337.3217ms`. The genuine signed replacement corpus
  passed in `1,604,917.5764ms`; batch interruption in `777,672.3232ms`; the single-
  shard executor in `1,087,799.2389ms`; the 10,000-schedule corpus in
  `671,882.6544ms`. No test was cancelled or timed out.
- The schedule differential passed `10,000 × 8` events with digest
  `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM` and zero duplicate provider,
  accounting, or Continuity effects. Actual P2P Chromium passed direct File transfer,
  browser-held policy and sampled possession response, provider-loss/new-lease repair,
  origin/relay cut, WebRTC ceilings, and terminal cleanup.
- Confidential Chromium passed the high-level browser-held membership authority and
  liveness/repair path, then `127/127` live-browser replacement cycles in
  `1,433,739ms`, reaching generation 129 and 384 chains (`128/128/128`) with 387
  receipts. The browser-signed generation-130 `3/3` candidate proved, while its 385th
  total/129th shard-0 chain failed without changing the ceiling journal; serialized
  reload rejected the oldest replay.
- `verify:portable` passed 38 modules, a 180,337-byte browser bundle, byte-identical
  committed/Node/browser results, and `10,000/10,000` adversarial rejections. Final
  S3 and S4 promotion receipts both passed. A post-run process inventory found
  `RELEVANT_LIVE_COUNT=0`.
- Evidence documents were updated only after the run and are checked separately by
  specification, link, security, generated-profile, syntax, and diff gates. Exact-SHA
  CI, immutable review, approval, merge, deployment, public readback, and separately
  administered multi-host operation remain external. No commit, push, or deployment
  was performed in this evidence epoch.

## 2026-08-21 KST — Observer-attributed deployment evidence boundary

- Added `mortalos-placement-admission-deployment-attestation/1`, which embeds exact
  deployment observation bytes/ID, a derived Ed25519 observer identity, attestation
  time, and signed declared administration, failure-domain, and vantage digests. Its
  content ID and signature use separate domains. Restore recomputes both the embedded
  observation and attestation before verifying the observer signature.
- The high-level `observeAndAttestPlacementAdmissionDeployment` path snapshots all
  inputs, completes the HTTPS identity/TLS probe, and only then invokes the durable
  observer key. `scripts/observe-and-attest-placement-admission-deployment.mjs`
  publishes that self-contained artifact no-replace. The separate low-level API can
  co-sign an existing observation but is explicitly not proof that its signer
  performed the historical probe.
- A deterministic view accepts `2..8` attestations for exactly one ceremony and
  requires distinct observer keys, observation IDs, and declared vantage IDs. It
  reports declaration diversity while fixing `non_authority:true`,
  `independent_administration:"unproven"`, and
  `independent_failure_domains:"unproven"`.
- Focused deployment test: `1/1` PASS, `9,730.372ms`. The fixture uses two fresh
  persistent local observer authority files and distinct fresh observations; reversed
  order is byte-deterministic. Signature/key swaps, duplicate observer/vantage,
  accessor/shared/sparse/max+1 input, mutation after async invocation, and existing
  output all fail closed.
- Async security: `26/26` PASS, `22` direct / `140` auto-discovered, with exact module,
  async-function, restored-observation, and Ed25519-verifier provenance pins. This is
  focused source/runtime/test evidence only. The prior complete suite does not include
  this delta; a fresh complete suite and exact-SHA gates remain pending. Both local
  observer keys and TLS endpoints still share one PC, so independent administration
  and physical topology remain HOLD. No commit, push, or deployment was performed.
- After adding the explicit reversed-input byte-determinism assertion, the frozen
  deployment-observer test reran `1/1` PASS in `6,293.8438ms`. Security, spec, links,
  syntax, JSON parsing, and diff checks all passed on that same source/document state.

## 2026-08-21 KST — Precommitted deployment plan and public observer provisioning

- Replaced the unmerged observer attestation format with
  `mortalos-placement-admission-deployment-attestation/2` and added
  `mortalos-placement-admission-deployment-plan/1`. The plan content-addresses one
  ceremony, a bounded issued/not-before/expires window and timeout, and the complete
  sorted `2..8` observer roster. Every assignment fixes the exact public key, unique
  32-byte nonce, and declared administration/failure-domain/vantage digests.
- Added `scripts/prepare-placement-admission-deployment-observer.mjs`. Each observer
  host can create or restore its durable local authority and publish only canonical
  `key_id`/`public_key` bytes through a no-replace pending-file/hard-link flow. The
  coordinator can therefore construct the plan from public files without receiving
  private observer material. An existing output rejects before a new authority is
  created.
- The combined observe-and-attest path now accepts only a precommitted plan assignment,
  rejects wrong ceremony/observer/window before endpoint access, derives nonce,
  timeout, and declarations from the plan, completes the live HTTPS probe, and only
  then invokes the durable signer. The deterministic view requires every planned
  observer and rejects missing or substituted plan/key/nonce/observation/vantage.
- Final focused ceremony/deployment evidence is `3/3` PASS in `9,226.0736ms`; the
  deployment subtest is `1/1` PASS in `9,017.1127ms`. It covers public identity
  preparation without private bytes, output-exists-before-authority-create, public
  plan creation/no-replace, reversed plan/view determinism, self-rehashed reorder,
  signature/key/plan substitution, incomplete roster, wrong nonce/window, duplicate
  key/nonce/vantage, accessor/shared/sparse/max+1 input, caller mutation, and output
  reuse. Async security passes `22` direct / `140` discovered.
- This closes conforming-flow post-hoc observer, nonce, and window selection. It does
  not prove that the unsigned plan's times or declarations are true, that the operator
  followed the combined API, or that keys, hosts, networks, administrators, regions,
  power, and physical failure domains are independent. The fixture remains one PC;
  fresh complete-suite and exact-SHA release gates remain pending. No commit, push,
  deployment, or live multi-host mutation was performed.

## 2026-08-21 KST — All-roster activated deployment plan

- A second-order selection attack remained after the unsigned draft-plan slice: the
  durable observer's attestation sign-once tuple included the final attestation ID, so
  one key could sign observations under multiple plans for the same ceremony and a
  coordinator could retain only the favorable complete view.
- Added `mortalos-placement-admission-deployment-plan-acceptance/1` and
  `mortalos-placement-admission-deployment-plan-activation/1`. Every planned observer
  signs the exact plan ID, ceremony ID, and identity through one ceremony-scoped
  durable sign-once tuple. Exact-plan retry reproduces byte-identical acceptance;
  a different plan for the same ceremony/key returns `E_CONTINUITY_EQUIVOCATION`.
  Activation requires the complete key-sorted roster of valid acceptances and rejects
  missing, duplicate, mixed-plan, reordered/self-rehashed, substituted, or invalidly
  signed entries.
- Added no-replace observer-side acceptance and coordinator-side activation CLIs.
  `mortalos-placement-admission-deployment-attestation/3` now embeds the exact
  activation plus observation, and the combined path refuses an unsigned draft plan.
  The deterministic view requires one activation and its whole roster.
- Focused ceremony/deployment tests pass `3/3` in `11,968.9394ms`; the deployment
  subtest is `1/1` PASS in `11,778.6381ms`. The new corpus covers exact acceptance
  recovery, same-key conflicting-plan halt with zero output, reversed acceptance
  convergence, incomplete/duplicate/mixed acceptance rejection, activation no-replace,
  self-rehashed activation reorder, activation substitution, and all prior identity,
  plan, observation, window, ownership, and bounded-input attacks.
- Async security adds the plan-acceptance boundary and passes `22` direct / `141`
  auto-discovered exports and methods with exact module, function, activation restore/
  selection, plan restore/selection, and Ed25519 provenance pins.
- This closes same-roster multi-plan choice only inside the conforming flow. It does
  not authenticate roster admission, stop disjoint Sybil rosters, prove acceptance
  time, prevent pre-import observations, establish independent administration or
  topology, or prove use of the combined API. The activation remains
  `non_authority:true`; fresh complete-suite, exact-SHA, multi-host operation, commit,
  push, and deployment remain pending.

## 2026-08-21 KST — Custody-membership-bound deployment roster

- Added `mortalos-placement-admission-deployment-plan-membership/1` and a bounded
  no-replace binding CLI. Creation verifies the custody-quorum membership epoch against
  the exact current Capsule and prior epoch, binds the exact ceremony subject evidence,
  and requires the activated plan roster to equal the epoch's complete `2..8` observer
  membership. Observer key, operator-root, and failure-domain declarations must match
  the admitted members, and observer roots/domains must be pairwise distinct and
  distinct from the ceremony subject.
- Upgraded the still-unmerged observer attestation from `/3` to `/4`. Each attestation
  embeds the complete membership binding plus the live observation; the operational
  CLI accepts current Capsule, optional prior epoch, and membership bytes rather than
  a raw activation. The combined path re-verifies current membership before endpoint
  access, probes only the admitted assignment, and invokes the durable observer key
  only after observation succeeds. Historical restore remains separate from explicit
  current-membership verification.
- The focused HTTPS deployment test passes `1/1` in `20,484.066ms`. It covers exact
  binding no-replace, raw disjoint outsider activation rejection, wrong Capsule/prior,
  self-rehashed observer reorder, incomplete/duplicate/mixed acceptances, signature,
  plan, activation, membership, nonce, window, realm, shared-memory, sparse, max+1,
  post-call mutation, and output-reuse attacks. Async security passes `26/26`, `22`
  direct / `141` discovered exports and methods with exact module/function/provenance
  pins.
- This closes raw unadmitted roster selection only under the configured lineage and
  issuer policy. It does not prove issuer honesty, global epoch uniqueness, trusted
  clock time, separate administrators, accounts, hosts, networks, regions, power, or
  physical failure domains. A hidden independently admitted competing epoch remains
  unknowable without convergence evidence. The test is same-PC; fresh complete-suite,
  exact-SHA, commit, push, deployment, and multi-host evidence remain pending.

- Evidence refresh after adding direct post-call mutation coverage for the membership
  bytes: the same focused file passes `1/1` in `22,026.3952ms`, superseding the
  `20,484.066ms` measurement in the immediately preceding entry. No source semantics
  or claim boundary changed.

- A follow-up ownership audit found that the combined observe-and-attest path reused
  caller Capsule/prior byte references after its HTTPS suspension. Both low-level and
  combined paths now synchronously own bounded Capsule, optional prior-epoch,
  membership, and observation bytes. A direct Capsule post-call mutation regression
  was added. The refreshed focused file passes `1/1` in `23,463.9947ms`; async
  security re-pinned the reviewed functions/module and passes `22` direct / `141`
  discovered exports and methods.

## 2026-08-21 KST — Observer-signed supplied membership convergence view

- Replaced the still-unmerged deployment membership format with `/2` and attestation
  with `/5`. Membership binding now owns a bounded set of custody-signed epoch
  candidates, invokes the existing deterministic convergence algorithm against the
  supplied current Capsule, embeds the selected epoch, and commits the sorted unique
  candidate epoch IDs through a separate candidate-view ID. Missing prior/current,
  sibling fork, cycle, unsafe root history/reconfiguration, and extraneous candidates
  halt before roster binding.
- Restore intentionally proves only the selected signed epoch and integrity of the
  candidate-ID commitment. Explicit verification and both attestation entrypoints must
  receive the full supplied candidate sidecars, rerun convergence, and reproduce the
  exact selected bytes, IDs, and view commitment. Each observer `/5` signature therefore
  attributes the exact candidate view it used, rather than an unsigned coordinator's
  bare claim that one epoch was current.
- The no-replace binding and observe-and-attest CLIs now accept repeated
  `--membership-epoch` inputs. The focused test builds a real two-epoch direct chain,
  proves reversed candidate order is byte-deterministic, rejects the valid child when
  its signed prior is omitted, rejects a wrong current Capsule and self-rehashed
  candidate reorder, and owns Capsule/membership/candidate/observation bytes before
  suspension. It passes `1/1` in `31,365.1946ms`; async security passes `26/26`, `22`
  direct / `141` discovered exports and methods.
- This closes known incomplete or forked candidate views only when an honest observer
  supplies its complete local inventory. A valid epoch withheld from every observer,
  global inventory completeness, issuer honesty, independent administration, clocks,
  networks, regions, power, and physical failure domains remain unproved. Fresh
  complete-suite, exact-SHA, multi-host operation, commit, push, and deployment remain
  pending.

## 2026-08-21 KST — Plan-scoped observer attestation choice

- A follow-up selection audit found that attestation `/5` bound the candidate-view ID
  in signed bytes but used the final attestation ID as its durable sign-once tuple. One
  conforming durable observer could therefore sign multiple membership views,
  observations, or instants under the same already accepted plan, allowing a
  coordinator to collect and retain a favorable complete view.
- The attestation signer now reserves one durable tuple derived from the accepted plan
  ID. Exact retry returns byte-identical attestation bytes. A different membership
  binding/view, observation, or attestation instant under that plan returns
  `E_CONTINUITY_EQUIVOCATION`; a membership-epoch rotation must begin with a fresh
  accepted plan and activation.
- The focused test adds a real third custody-signed membership epoch, proves its rotated
  candidate view differs, rejects a same-plan signature for that view, and proves the
  original attestation remains byte-identically retryable both before and after the
  conflict. The exact file passes `1/1` in `36,592.033ms`.
- This closes conforming durable-key same-plan multi-view choice. It does not reveal an
  epoch withheld from every observer, prove issuer or clock honesty, establish physical
  or administrative independence, or harden a signer implementation that ignores the
  supplied sign-once tuple. Fresh complete-suite, exact-SHA, multi-host operation,
  commit, push, and deployment remain pending.

- Evidence refresh after adding a direct changed-attestation-instant conflict: the same
  exact focused file passes `1/1` in `37,932.5299ms`, superseding the `36,592.033ms`
  measurement in the immediately preceding entry. No product-source semantics changed.

- Final short gates pass: async security `26/26` with `22` direct / `141` discovered,
  specification verification with `115` rejection codes and `104` relative links,
  release links `59` local / `11` HTTPS syntax-only, generated protocol profile,
  syntax, JSON parse, and `git diff --check`. Source/test SHA-256 values are
  `bfd6d0894d437f2072927afd8bc81016bf2831fe6564ebdfc57682572168e5fb` and
  `93646fa469040fc16fa1bc81c697d29dc97ff2722a57a80c9b0dad5fa621b39a`;
  relevant Node workload count is zero after verification.

## 2026-08-21 KST — Compact all-roster attestation view and ceremony lifecycle correction

- The preceding plan-scoped choice entry described epoch rotation as requiring a
  fresh accepted plan. That wording was incomplete: plan acceptance itself uses a
  ceremony-scoped durable sign-once tuple, so the same observer cannot accept another
  plan for the same ceremony. The conforming rotation unit is therefore a fresh
  ceremony followed by a fresh plan, complete acceptance/activation roster, membership
  binding, observation, and attestation. Active protocol and handoff documents now use
  that boundary; the historical entry above remains unchanged.
- Added `mortalos-placement-admission-deployment-attestation-view/1`, a compact
  content-addressed manifest over the complete key-sorted `2..8` attestation sidecars.
  It commits the exact attestation, observer, observation, vantage, ceremony, plan,
  activation, membership, selected epoch, and candidate-view IDs plus the derived
  roster summary without nesting Ed25519 signature bytes. Offline restore proves only
  canonical shape and self-hash and returns `attestations_verified:false`; explicit
  verification reruns every sidecar signature and membership constraint and must
  recreate byte-identical manifest bytes.
- Added fresh-process no-replace creation and read-only verification CLIs. Reversed
  sidecar input order is deterministic. A self-rehashed manifest substitution,
  one/missing/duplicate/extra sidecars, output reuse, or sidecar/view mismatch fails
  closed. The direct evaluator and creator now share the same explicit `2..8` roster
  bound, preventing a public API from producing a view that its restorer would reject.
- Final focused evidence on the resulting source/test bytes is `1/1` PASS in
  `46,573.5002ms`. Async security passes `26/26` with `22` direct / `141` discovered;
  the generated profile, syntax, and `git diff --check` pass. Source/test/create-CLI/
  verify-CLI SHA-256 values are respectively
  `4d82e9990fa021a453bcfde75ebd0bd31fa342079d1a7a7032a532560eda9892`,
  `45315df0ad7c347ffe5447135ed6359875269ab327613fe7ef1c6701b7b7c61b`,
  `abb91c2293cfd7ae7782d847f7ab3d3e041342cf4d68fcdf38910076bee12cc4`,
  and `9a7feff4f1330ecc26e4e957723c632cbcffc7dbb5e8c915ad35bb1f32fd9b66`.
- This is portable evidence packaging, not proof of global inventory, honest issuers,
  trusted time, Sybil resistance, or independent accounts, administrators, hosts,
  networks, regions, power, or physical failure domains. The fixture remains same-PC.
  Fresh complete-suite, exact-SHA, genuine multi-host operation, commit, push, review,
  merge, and deployment remain pending.

## 2026-08-21 KST — Observer-attestation current-source complete-suite PASS

- A fresh ordered `npm test` call was issued at
  `2026-08-21T20:48:19.650+09:00` on the compact all-roster attestation-view source.
  The final `verify:s4` PASS output was emitted at
  `2026-08-21T23:11:26.544+09:00`. The command did not print its own wrapper start/end
  markers, so these timestamps are an observed execution window rather than an exact
  wall-time claim. Because the package script is one ordered `&&` chain and reached
  its final S4 command, every preceding stage completed successfully.
- The full P2P Node group passed `68/68` in `3,894,776.8885ms`. The observer-
  attestation file itself passed in `59,251.0818ms` under that integrated load. The
  run also completed the generated 4,096-head journal boundary, the signed 128-cycle
  384-chain ceiling and signed plus-one rejection, the `10,000 × 8` repair-schedule
  corpus, actual Chromium P2P/WebRTC, and the actual Chromium confidential 127-cycle
  provider-history path. The latter reported `1,514,737ms` dynamic time and retained
  generation 129 with 384 chains before its signed plus-one rejection.
- SDK, clean packed consumer, relay, Chromium/Firefox capability probes, Lab build,
  portable verification, governance/security/profile checks, and S0-S4 all remained
  in the ordered chain; the last observed output was `MortalOS S4 confidentiality
  receipt: PASS`.
- Only evidence/status documents were changed after the run. Therefore the complete-
  suite result is attributed to the unchanged source/runtime/test/workflow bytes;
  current documentation is verified separately by spec, link, and diff checks rather
  than called a whole-current-tree complete-suite run.
- This closes the local complete-suite gate for the observer-attribution/view delta.
  It does not close exact-SHA CI, immutable review, commit/push/merge/deploy, hidden-
  inventory completeness, issuer or clock honesty, Sybil resistance, or independently
  administered accounts, hosts, networks, regions, power, and physical domains.
- Final post-run static gates pass on the current evidence-document bytes:
  `verify:spec` covers 115 rejection codes and 104 relative links;
  `verify:links` covers 59 local and 11 HTTPS syntax-only targets;
  async security passes `26/26` with `22` direct / `141` discovered; generated profile,
  syntax, security-module pin, and `git diff --check` pass. The attestation module hash
  remains `4d82e9990fa021a453bcfde75ebd0bd31fa342079d1a7a7032a532560eda9892`,
  and the relevant Node workload count is zero.

## 2026-08-22 KST — Public signer bootstrap and current-source complete-suite PASS

- A multi-host runbook audit found a real bootstrap dependency that the same-process
  tests had hidden: a ceremony request binds the subject public key and both endpoint
  origins, but the only way to obtain the subject key was to start its long-running
  signer and parse readiness stdout. The draft runbook also attempted to freeze the
  trust root and request before fresh authorities existed, which was impossible.
- Added `scripts/prepare-placement-admission-subject.mjs`. It creates or restores only
  the subject host's durable authority, publishes its canonical public identity by a
  same-directory no-replace hard-link, verifies readback, exposes no private material,
  and rejects an existing output before creating an unrequested authority.
- Added `scripts/create-placement-admission-ceremony-request.mjs`. It accepts only the
  canonical public trust root, subject identity, exact policy, two endpoint origins,
  and bounded logical times; verifies the root-policy digest, generates a fresh local
  32-byte nonce, creates the endpoint-bound challenge and signing request, and
  publishes the canonical request no-replace. It requires neither signer service nor
  either private authority.
- The signer-service and HTTPS deployment-observer tests now execute the operator
  sequence `issuer trust root -> subject public identity -> request -> services ->
  ceremony` instead of constructing the request from service readiness. Focused
  evidence passes signer service `3/3` in `4,052.6003ms` and HTTPS ceremony-to-observer
  `1/1` in `47,987.2761ms`. Collision tests prove occupied issuer/subject/request
  outputs are not replaced and occupied public identity outputs do not create the
  corresponding authority.
- A fresh ordered `npm test` ran from
  `2026-08-22T00:10:31.9611979+09:00` through
  `2026-08-22T02:21:20.3185492+09:00` and exited zero after exactly
  `7,848.357s`. The P2P Node group passed `69/69` in `3,452,293.3145ms`; under
  integrated load the HTTPS deployment-observer path passed in `49,972.145ms` and
  signer-service restart path in `2,554.1807ms`. The run reached final `verify:s4`
  after actual Chromium DataChannel, `10,000 x 8` repair schedules with duplicate
  provider/accounting/Continuity effects `0/0/0`, the Node 384-chain ceiling, and the
  Chromium 127-cycle generation-129/384-chain ceiling plus signed plus-one rejection.
- Source/runtime/test/workflow bytes did not change during that suite. Only status and
  evidence documents changed afterward and are covered by separate current static
  gates. SHA-256 values for issuer prep, subject prep, request creation, signer runner,
  ceremony runner, signer-service test, and observer integration test are respectively
  `70a6185043649436766c4469afa390004239934383d00a688aed9cb5954da2e2`,
  `c38d09729ada6291935eddd5388d43d8eb4d7b026dfe9b812171348e70d9fefa`,
  `2192396c367f46898df72e0d2d43c532d42df86e3c59a79abe69433ff0a73b2f`,
  `b68436d579d751eb10e383c981289a0cbfdebbd4ff470e57ac3b1de8aa7daf15`,
  `5e07b588e5bf6c0ee213ce3a2ba718487f753d9ae0a4b30a3e8ac9db8d9c2f0b`,
  `ae2d900496fc05094f6f056ce4fb475c942dfaa71910838f19875f75ca725095`,
  and `2ea3bec58db268f6b543b84c638665a6082d9d48bf8da94693e0835703aae089`.
- This closes the private-key-free public-file bootstrap needed to make a four-context
  pilot operable. It does not execute that pilot or prove independent accounts,
  administrators, hosts, networks, regions, power domains, issuer honesty, trusted
  time, global inventory, or Sybil resistance. Exact-SHA CI/review, commit, push,
  merge, deployment, and all external mutation remain pending.
- Final post-run document/static gates pass on the current bytes: specification
  verification covers `115` rejection codes and `104` relative links; release links
  cover `59` local and `11` HTTPS syntax-only targets; async security passes `26/26`
  with `22` direct / `141` discovered exports and methods; generated protocol profile,
  syntax, and `git diff --check` pass. Repository-related Node workload count is zero.

## 2026-08-22 KST — Custody-approved membership ceremony and 70/70 complete-suite PASS

- A second runbook audit found that the pilot still assumed pre-existing membership
  epochs even though those epochs can only be created after the observer admission
  ceremonies. The only test path created them by calling the portable core with raw
  private authorities, so a coordinator could not operate the documented workflow
  without collapsing custody boundaries.
- Added the non-normative operator envelopes
  `mortalos-placement-membership-epoch-request/1` and
  `mortalos-placement-membership-epoch-approval/1`. A request accepts no free-form
  epoch body: it derives the candidate from verified ceremony bundles, the current
  Capsule, bounded observer policy/window, and an optional exact predecessor. Each
  current custodian independently signs the rederived core custody message with an
  existing durable authority. Finalization sorts approvals by code-unit key order,
  enforces the current Capsule quorum, and publishes only the existing canonical
  membership epoch `/1` bytes.
- Added no-replace request, approval, and finalize CLIs. Output collision and a
  non-custodian reject before signing; the approval path never creates an authority.
  Exact retry is byte-identical, one approval is insufficient for a 2-of-3 Capsule,
  reversed threshold approval inputs produce identical epoch bytes, mixed requests
  reject, and a conflicting reuse of the same sign-once tuple halts without changing
  the authority file.
- Reworked the deployment regression so that every observer durable plan/attestation
  key is also the subject of its own policy-locked issuer/subject HTTP ceremony. The
  same admitted key accepts the plan and signs the observation. Epochs 1 through 3
  now flow through request, current-custodian approval, threshold finalization, and
  exact predecessor chaining; the raw private-authority admission-evidence shortcut
  is gone.
- Focused evidence passes the new epoch ceremony `1/1` in `12,405.8186ms`, the
  integrated deployment path `1/1` in `56,774.1555ms`, and both together `2/2` in
  `57,055.0734ms`. Async security passes `26/26` with `22` direct / `141` discovered;
  specification verification covers `115` rejection codes and `104` relative links;
  release-link verification covers `59` local and `11` HTTPS syntax-only targets.
- A fresh ordered `npm test` on unchanged source/runtime/test/workflow bytes exited
  zero after final `verify:s4`. P2P Node passed `70/70` in `3,529,502.2144ms`, including
  the new membership ceremony in `12,715.6333ms` and integrated deployment path in
  `59,835.4188ms`. The run also passed the actual Chromium WebRTC path, the
  `10,000 x 8` repair corpus with digest
  `sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM` and duplicate external effects
  `0/0/0`, the Node 128-cycle/384-chain ceiling, and the Chromium 127-cycle
  generation-129/384-chain ceiling plus signed plus-one rejection. No exact wrapper
  timestamps were captured, so no wall-time claim is made.
- SHA-256 values for the ceremony module, request CLI, approval CLI, finalize CLI,
  focused ceremony test, integrated deployment test, and updated runbook are
  respectively
  `f8ce4287e37f7d6476aec976709e4de79f21236308c27c80ca727295172819b0`,
  `173c8893986a90a054de1016ffbdba851ee6333beb2d120fea36ca65061d1c5d`,
  `cf95ce6546e5fac7ce5444361ad9c3eedb84def56e837f0118796640a2288c31`,
  `28fec0c3412dc4a722acf17c0b58be37da9592f8c7bdc424366e9789482b8d72`,
  `49d9135132bb8be8620e760d4aa4e580de91904feba6796ec69091cfa517d40a`,
  `7a7f257a507a7b1150bcf52a4aedc4f094449c51e234f54d44003e91c3437979`,
  and `a2bc9915678b0edea9390f92e88c0c98677c070b651e6b7e14703fedcbcbf02a`.
- The relevant Node workload count was zero after the run. No commit, push, merge,
  deployment, live authority, or external mutation occurred. This removes the last
  known local operator workflow gap before a real pilot; it does not prove issuer or
  clock honesty, hidden-inventory completeness, Sybil resistance, or independent
  administrators, credentials, accounts, hosts, networks, regions, power, and
  physical failure domains. Exact-SHA governance and real multi-host operation remain
  HOLD.

## 2026-08-22 KST — Complete public pilot-chain replay receipt; focused PASS, ordered final-receipt HOLD

- A second Phase 9 audit found that the compact attestation-view verifier covered only
  the view and attestation sidecars. It did not independently replay the separately
  published ceremony trust roots, subject identities and requests, membership request/
  approval/finalized predecessor chain, plan/acceptances/activation, current membership
  convergence, or the exact primary ceremony. The executable evidence was therefore
  weaker than the runbook's complete-public-chain promotion criterion.
- Added non-normative receipt `mortalos-placement-admission-pilot-evidence/1`, its
  canonical public-root-confined index `/1`, a no-replace creation CLI, and a read-only
  verification CLI. Creation and verification replay every separately published
  ceremony input and bundle, rederive each membership request, verify current-custodian
  approvals and the chronological finalized chain, recreate activation, rerun current-
  Capsule membership convergence, and verify all attestations plus the compact view.
  The receipt contains only authenticated IDs and public SHA-256 digests. Restore is
  deliberately self-hash-only with `public_chain_verified:false`; only full sidecar
  replay can return true.
- The index rejects absolute paths, lexical `..` escape, and symlinks resolving outside
  its public evidence root. Unordered ceremony, bundle, approval, acceptance, and
  attestation sets are deterministic. The integration rejects omitted predecessor
  history, swapped ceremony roots, self-rehashed manifest substitution, expected-commit
  mismatch, output reuse, accessors, shared buffers, sparse/max+1 epoch inputs, and
  private-material leakage. The expected commit is explicitly `recorded-only`; this is
  not clean exact-SHA execution evidence.
- The final affected integration rerun ran from
  `2026-08-22T12:39:38.5332432+09:00` through
  `2026-08-22T12:41:16.3329643+09:00`, exited `0`, and passed `1/1` in
  `97,722.7414ms` (`97.800s` shell). The unchanged membership-epoch ceremony also has
  focused `1/1` PASS evidence in `11,673.7641ms` runner time.
- A same-source ordered `npm test` started at
  `2026-08-22T11:20:59.6179276+09:00`. Every preceding stage passed, including
  conformance `76/76`, 10,000-case properties/state/recovery, confidentiality `26/26`
  with one million allocations and zero IV duplication, actual Chromium S4 vectors,
  protocol/resource `23/23`, and security `26/26` with `22` direct / `141`
  auto-discovered surfaces. The P2P group emitted successful tests through `51`,
  including the 384-chain ceiling, the `872,566.7433ms` interruption/resume batch, and
  the `1,209,841.2291ms` single-shard executor. The final PTY output and wrapper exit
  receipt were lost after the last worker exited. No failure was observed and all
  related processes ended, but process disappearance is not an exit-zero receipt;
  this attempt is preserved as incomplete evidence and is not called a current
  complete-suite PASS.
- SHA-256 values for the receipt module, index loader, create CLI, verify CLI,
  integrated test, and runbook are respectively
  `fcc4c7502f1978066f2f50b6c1563f37a683c342fa0b1cefac7457391f0d2ed6`,
  `2ab8a3f05085d11f9af60833eb440f344f507a17e2f2eed5d3245622d9a48e07`,
  `cee29dbd12752a82ff40ae880249880758da6241992d588c0dc0cf4e7008e9f1`,
  `f907aafca2682d73b111947be4a62958f0c8509bc2ac09d80b73ede5dffe22ff`,
  `ca267985fe34647825b01be79ced0b67c546cf8d335f26d047aca5e0809358d5`,
  and `65e136ee5bfa939dae7e1ca1ffb2c72d2675894132ca810870662415ae8f7093`.
- No commit, push, merge, deployment, authority use, live multi-host operation, or
  external mutation occurred. The next meaningful gate is a separately administered
  pilot whose exact public index reproduces this receipt contract; exact-SHA execution,
  issuer/clock honesty, hidden-inventory completeness, Sybil resistance, and physical/
  administrative failure-domain independence remain HOLD.
- Final post-document gates ran from `2026-08-22T12:44:10.3658988+09:00` through
  `2026-08-22T12:44:13.7361020+09:00` and exited `0`: specification covers `115`
  rejection codes and `104` relative links; release links cover `59` local and `11`
  HTTPS syntax-only targets; async security passes `26/26` with `22` direct / `141`
  auto-discovered surfaces; generated protocol profile, all four new-file syntax
  checks, and `git diff --check` pass. The relevant Node/cmd workload count is zero.

## 2026-08-22 KST — Role-local bearer custody and response-complete public replay

- An operator-runbook audit found a direct contradiction: the strict target prohibited
  bearer tokens from crossing role custody, while Phase 3 instructed the coordinator to
  receive both tokens. This was a real administrative-separation defect even though the
  combined runner never persisted the tokens or placed them in bundle bytes.
- Added canonical public role-response `/1` artifacts and a role-local HTTP client. Each
  invocation owns one request, endpoint, role, timeout, and bearer before suspension;
  validates the configured origin and live role/key; constructs both Requests before
  the first await; and can call only one signer. The operator CLI reads only
  `MORTALOS_ADMISSION_SIGNER_TOKEN` and publishes one response no-replace.
- Added a synchronous/network-free finalizer and CLI. It receives the request plus
  issuer/subject public responses, checks roles, identities, origin challenge binding,
  evidence IDs and signatures, then recreates the existing ceremony bundle `/1`.
  Existing output paths reject before input reads. The compatibility combined runner
  delegates to the same finalizer and produces byte-identical output.
- Extended the pilot index so every ceremony must carry both role responses. Receipt
  creation re-finalizes those sidecars at the bundle's recorded evaluation instant and
  requires exact bundle-byte equality. The compact receipt records public response
  SHA-256 digests and authenticated response IDs. The integrated negative control swaps
  an issuer response between two ceremonies and fails at `finalization-identity` with no
  evidence output.
- `node --test test/placement-admission-external-ceremony.test.mjs` exits `0`, `4/4`, in
  `5,143.0523ms`. It covers one-local-token-per-role operation, accessor/shared-memory
  rejection, caller-mutation ownership, poisoned token variables at offline finalization,
  exact compatibility bytes, wrong role/origin, swapped responses, output collisions,
  dead endpoints, no pending residue, and token-free artifacts/transcripts.
- `node --test test/placement-admission-deployment-observer.test.mjs` exits `0`, `1/1`,
  with subtest `101,967.6271ms` and runner `102,159.8635ms`. The full same-PC HTTPS path
  now uses role-local CLIs for the provider and both observer ceremonies, then replays
  all response/request/bundle, two membership epochs, plan/acceptance/activation,
  membership convergence, observation/attestation, compact view, and final public
  receipt sidecars.
- Post-change gates exit `0`: specification (`115` rejection codes, `104` relative
  links), release links (`59` local, `11` HTTPS syntax-only), generated protocol
  profile, async security (`26/26`, `22` direct / `142` auto-discovered), syntax checks,
  and `git diff --check`.
- Key SHA-256 receipts are: ceremony client
  `90099fe5be6096ce34c2dc3c317c9d470c6990cbd93f1a048b51964b49d93f40`; role CLI
  `0f849b9ea18edf511f3d2ea754eeb66ebc3ec25dd9966d53e5ce4bed6e5c1019`; finalizer CLI
  `7592f480993528a6ae892cc092e50835567e18eee3514af7c553ab042f420834`;
  pilot evidence module
  `91d1923942898f3962248a668474ae4b77f3aa9f1964db1eaa51566d4f5c64bf`; index loader
  `dd67c0579158ef3b85d5d7c6f8831ac9e5b1d8ee32406fc67e46be456b6c359d`;
  external test `24259861fd1b01a27035340b4a5b3799370164d9c16cb8fb0af72a9935385902`;
  integrated test `6e3fd95c924f01e14ca538af408459214857ac22ab8a53f64386c525d1e2498f`;
  runbook `2555d051f3e367f7c14a36ed30f7b138eef580554e17489f922e2b81504ea9b2`.
- HEAD and `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`. The cumulative dirty worktree is `109`
  paths (`43` modified, `66` untracked); unrelated and prior task bytes were preserved.
  No commit, push, merge, deployment, real signer authority, or external mutation
  occurred. Current complete-suite and exact-SHA governance remain pending; external
  issuer/clock honesty, hidden-inventory completeness, Sybil resistance, and real
  administrative/host/network/region/power/physical independence remain HOLD.

## 2026-08-22 KST — Native HTTPS under role-local signer custody

- The next operational audit found that every supposedly independent signer still
  required an out-of-process TLS terminator. That left certificate/private-key custody
  and the direct executable path outside the signer role even though the coordinator and
  bearer boundaries were already separated.
- Added optional native HTTPS to the operator-facing service. TLS certificate bytes are
  bounded to 1 MiB, private-key bytes to 256 KiB, both are copied into owned non-shared
  storage, the listener requires TLS 1.2 or newer, and its handshake is bounded by the
  existing 10-second header deadline. Omitting TLS preserves private HTTP reverse-proxy
  mode. Public service state exposes only `protocol`.
- The runner adds paired `--tls-certificate` and `--tls-private-key` inputs, bounded
  regular-file reads with changed-size detection, an HTTPS advertised-origin
  requirement, and secure-context preflight before policy loading or absent durable
  authority creation. Readiness adds only `listen_protocol` and `tls_enabled`; it never
  emits certificate/private-key bytes or `MORTALOS_ADMISSION_SIGNER_TOKEN`.
- The new direct-path regression proves that incomplete TLS arguments, a max+1 private
  key, and a mismatched pair fail before authority creation. It starts two native HTTPS
  role signers with distinct certificates, runs one-token-per-role clients, performs
  network-free finalization with poisoned token variables, restores the exact bundle,
  and observes both endpoints through a trusted CA set. The observation records distinct
  peer certificate/public-key digests and `remote_addresses_distinct:false`; offline
  restore reports `live_observation_verified:false`. Restart reproduces byte-identical
  issuer/subject responses, no pending residue remains, and public artifacts/transcripts
  contain neither bearer nor private-key material.
- `node --test test/placement-admission-signer-service.test.mjs` exits `0`, `4/4`, with
  native HTTPS subtest `4,468.9245ms` and runner `9,327.4944ms`.
- `node --test test/placement-admission-deployment-observer.test.mjs` exits `0`, `1/1`,
  with subtest `100,274.1801ms` and runner `100,504.5843ms`. This confirms that the
  existing proxy-backed admission/deployment/public-chain integration remains intact.
- Related signer/ceremony regressions pass `7/7` in `6,014.1666ms`. Post-change gates
  exit `0`: async security `26/26` with `22` direct / `142` auto-discovered surfaces;
  specification verification with `115` rejection codes and `104` relative links;
  release links with `59` local and `11` HTTPS syntax-only targets; generated protocol
  profile; syntax checks; and `git diff --check`.
- Key SHA-256 receipts are: native signer service
  `bbc111766fadd66dfdb438e6e983ebdd1acd19eafee0f2a4c7ac270750b58274`; signer runner
  `56253860e998eae77beafad1e11a191d8d5fa6fb777742b155588765bf398455`; signer-service
  test `016345d3e63dc7984141086d45642d0a671e683c4d1b5b8ddf9bf1d3f10e4988`; operator
  runbook `34562d75cdc6149758ea3733060eee75ae80776a1bd2f68d68bd4ff55285e5ef`.
- HEAD and freshly verified `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`. The cumulative dirty worktree remains
  `109` paths (`43` modified, `66` untracked); unrelated and earlier task bytes were
  preserved. No commit, push, merge, deployment, real signer authority, external
  mutation, or live multi-host operation occurred.
- This removes the external TLS-proxy dependency from the directly executable pilot
  path. It is still same-PC evidence: distinct certificates do not prove independent
  certificate authority, accounts, administrators, hosts, addresses, networks, regions,
  power, or physical failure domains. The current complete-suite, exact-SHA review, and
  separately administered multi-host pilot remain HOLD.

## 2026-08-22 KST — TLS-channel role-key proof and crash-recoverable observation journal

- Auditing the newly native HTTPS boundary found that the deployment observer still
  called only public `/identity`. A server holding the trusted certificate but not the
  ceremony role key could replay those bytes and satisfy the old freshness claim.
- Added canonical possession challenge/proof `/1`. The challenge binds ceremony bundle,
  exact signed origin, role, key ID, observer nonce, and observation instant. Client and
  signer derive 32 bytes from
  `EXPORTER-MortalOS-placement-admission-deployment-v1` with the exact challenge bytes as
  TLS exporter context on that request connection; the configured role key signs the
  exporter digest. Observation `/2` verifies the bundle key signature and records the
  bounded proof, exporter digest, certificate/public-key digests, TLS protocol, and
  socket facts. A fake HTTPS server using the same test certificate and captured proof
  fails on a new connection's exporter.
- Native signer startup now requires
  `MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN`, distinct from the admission bearer. The
  proof route cannot call admission signing. Default observer and combined-attester CLIs
  require distinct issuer/subject possession tokens and never downgrade; explicit
  `legacy-identity-only` produces parseable observation `/1` only. Missing/reused tokens
  fail before input/network or absent authority creation as applicable. Both token
  classes and private-key bytes are absent from readiness, public artifacts, journals,
  and transcripts.
- TLS exporter freshness exposed a second bug: reconnecting with the same logical
  nonce/time necessarily creates another observation ID, so a crash after durable
  observer signing but before attestation publication could not reproduce the
  plan-scoped sign-once message. The combined CLI now requires
  `--observation-journal`. Its captured journal capability hard-links and reads back the
  exact bounded token-free observation before the observer signer is invoked. If the
  journal exists, a retry restores and fully revalidates its mode, time, ceremony,
  proofs, nonce, membership, and plan assignment and performs no endpoint request. A
  conflict fails before signing.
- The final integrated regression exits `0`, `1/1`, with subtest `109,399.7366ms` and
  runner `109,718.1904ms`. It exercises two native role signers, live `/2` proofs,
  captured-proof replay rejection, two-epoch membership/deployment/attestation/public-
  chain replay, journal secret scans, then stops both signers and removes all possession
  tokens before a fresh process reproduces the byte-identical attestation from the
  journal. Reusing that journal with a different observation instant fails with no
  output.
- The current signer-service file exits `0`, `4/4`, in `20,655.0405ms`; adjacent
  ceremony/external-ceremony/signer-session files exit `0`, `7/7`, in `10,071.95ms`.
  Those concurrent receipts cover `11/11`. Final async security exits `0`, `26/26`,
  with audit `22` direct / `143` auto-discovered entrypoints. Specification verification
  passes with `115` rejection codes and `104` relative links; release links pass `59`
  local / `11` HTTPS syntax-only; generated protocol profile, relevant syntax checks,
  and `git diff --check` also exit `0`.
- Key SHA-256 receipts are: signer session
  `2abf102e1082a6326a8dd7f0be674735dcfc2c516fd71fe6ba0fed7e511350d2`; native signer
  service `d78a0e84bdb245edede4a6d3ddb2418434a8ad7a96de01ddbec9de1931d843b1`;
  observer `18717c7c0f49a494e1641bc39a4e584a8df2a48d1f8f90e42060aad0c6b2c425`;
  attestation/journal boundary
  `0044ce0d591390ab839c4b7009d56c05c7f1a641e6cbca6617f7cee44c914ccb`;
  signer runner `317edcc12a86f5c0d64b5e9166e107a5d15b82d9868b8f5992a07f0108f218ee`;
  observer CLI `3f2f702e2dd549174f4ffe70eec3e828f04d503cd7baf1304435e964a07b0273`;
  combined CLI `79eb559442a3a09c126d5791fdf75203390b033b27d98d3b0a8ae0f9c3ec786c`;
  signer-service test `bae190dc4bf05de3a0309446c406b8ada843cc0107bf23024e3bd923462def02`;
  integrated test `96025101066a450b53b7b17bf8761061b1f7ea16208778781efab71607d3fcd9`;
  runbook `7cae8bae7350879f2a3d530af404e59656efb3d640fe046a9932d44299f26e14`.
- HEAD and freshly verified `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`. The cumulative dirty worktree remains
  `109` paths (`43` modified, `66` untracked); prior and unrelated bytes were preserved.
  No commit, push, merge, deployment, live signer authority, or external mutation
  occurred. Journal durability is local-directory/no-replace scoped, not hostile-disk or
  power-loss proof. All current endpoints still share one PC/address; certificate-
  authority, account, administrator, host, network, region, power, and physical-domain
  independence, current complete-suite, exact-SHA review, and the real multi-host pilot
  remain HOLD.

## 2026-08-22 KST — Role-key-attributed pilot source artifacts; focused PASS

- A current-state audit found one remaining local operational gap before the real
  multi-host pilot: `pilot-evidence/1` recorded one expected commit but no role key
  attested which source checkout produced each signed public artifact. The receipt was
  correctly labeled `recorded-only`, so this delta adds a separate layer rather than
  silently changing that claim or format.
- Added `mortalos-placement-admission-role-execution-receipt/1`. It binds exact artifact
  bytes by SHA-256, authenticated artifact ID/kind, fixed role, public signer identity,
  source commit, and `checkout_state:"clean"`. All caller bytes/scalars and the signer
  capability are snapshotted before suspension. The durable sign-once tuple is keyed by
  artifact kind plus authenticated ID: exact retry returns the same bytes, while a
  different source/digest assertion for the same artifact identity returns
  `E_CONTINUITY_EQUIVOCATION`.
- Added the role-local operational CLI. Before private-key use it resolves the supplied
  Git top level, requires exact `HEAD`, and requires empty tracked/untracked/submodule
  porcelain status. It then signs and hard-link-publishes the receipt no-replace.
  Wrong HEAD and an untracked marker both reject with no output.
- Added `mortalos-placement-admission-pilot-source-attestation/1` plus no-replace create
  and read-only verify CLIs. Creation first replays the exact existing public pilot
  receipt and sidecars, derives the expected key and artifact for every ceremony role
  response, membership approval, plan acceptance, and deployment attestation, and
  requires exactly one matching signed receipt. Receipt input order is canonicalized.
  Offline restore sets `receipts_verified:false`; full replay sets it true and reports
  `source_commit_execution_binding:"role-key-attested-artifacts"`. Unsigned coordinator
  execution, topology, and both independence verdicts remain `unproven`.
- Final native `/2` HTTPS/membership/deployment/public-chain/source integration is
  `1/1` PASS in `165,590.5383ms` (`165,777.909ms` runner). The fixture binds 12 signed
  artifacts across 7 role keys and covers clean real-Git CLI success, exact retry,
  artifact-keyed conflicting-SHA halt, dirty checkout, wrong HEAD, modified receipt,
  missing receipt, reversed input byte equality, self-hash-only restore, no secret
  leakage, and no-replace output.
- Async security includes the new suspension boundary and passes `26/26` with `22`
  direct / `144` auto-discovered functions. Specification passes with `115` rejection
  codes and `104` relative links; release links pass `59` local / `11` HTTPS syntax-
  only; generated profile and syntax/diff checks pass.
- Key SHA-256 receipts: role receipt module
  `12fce022814d511104531b05fbdcaa751dc16889206d0c6b914b304408ca7002`;
  aggregate module
  `a60f351ee1e39c277cdf519eaa8c3c28cae6974152b45877ad2a8ea02e857201`;
  role CLI `bd317ad06ab3f6deb5ac62b1f0f2c8e5fc8ab7703e2133e3a90de85c62003110`;
  aggregate create/verify CLIs
  `3da818097e691215b49306cbd14db61bf626f5c8a5e9d34e27105c9daa0a902a` /
  `890534af7ccbaee27a299d69656cc1ffb0f23b61ea5280576e34cab9066be36a`;
  integrated test
  `9d577fb54865458130f1a6ce9f71baeb413f16838c684cc5b614fdb0fc202ee5`;
  security registry/verifier
  `dcc74c953057402484e6c96b2e6de993d737a075a8e0bae03c39540f5852de33` /
  `f020b39cd9b583d28441a35b40ee6b41acb263db1c51db221610a60ac641d1eb`;
  operator runbook
  `4d5edfdd7065d52e60da6c149e2dcf49c4a2d06b3cf30ff1f88c4a57859b22de`.
- This result is attributable role-key testimony under the conforming CLI, not proof
  against a dishonest operator or proof that unsigned coordinator artifacts ran from
  the claimed source. HEAD and `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative dirty worktree is `114`
  paths (`43` modified, `71` untracked). No commit, push, merge, deployment, live role
  authority, or external mutation occurred. Current complete-suite, exact-SHA
  governance, and a separately administered multi-host pilot remain HOLD.

## 2026-08-22 KST — Coordinator-non-authority source verdict; focused PASS

- Audited the remaining `unsigned_coordinator_execution_binding:"unproven"` boundary.
  Adding a coordinator key would have promoted the orchestrator into a new trust actor,
  contrary to the participant-authority North Star. Implemented a bounded final verdict
  that retains coordinator execution as unproven while proving it is unnecessary as a
  verification authority.
- Added `mortalos-placement-admission-pilot-source-verdict/1`. Full creation first
  recreates the complete pilot public chain and exact role-source aggregate, then
  derives a sorted digest inventory of every unsigned protocol artifact. Trust roots,
  subject identities, ceremony requests, membership requests, and the deployment plan
  must be endorsed by participant signatures. Ceremony bundles, finalized epochs,
  activation, membership binding, attestation view, and pilot evidence must be
  deterministically replayed or revalidated. The Capsule is a separately authenticated
  input. No coordinator key or signature exists.
- Added no-replace create and read-only verify CLIs. Offline restore is self-hash-only
  and sets `participant_receipts_verified`, `public_chain_verified`, and
  `unsigned_protocol_artifacts_verified` false. Full verification recreates exact
  verdict bytes from every public sidecar and receipt before setting all three true.
- Final native `/2` HTTPS/membership/deployment/public-chain/source/verdict integration
  is `1/1` PASS in `178,826.3298ms` (`179,032.6269ms` runner). The exact current fixture
  closes 34 evidence artifacts: 12 role-source artifacts across 7 keys, 21 unsigned
  artifacts (12 participant-endorsed and 9 deterministically replayed), and one
  signature-verified Continuity Capsule.
- Async security exits `0`, `26/26`, with `22` direct / `144` auto-discovered exports
  and class methods. Specification exits `0` with `115` rejection codes and `104`
  relative links; release links exit `0` with `59` local / `11` HTTPS syntax-only;
  generated protocol profile, relevant syntax, and `git diff --check` pass.
- Key SHA-256 receipts: verdict module
  `b0127b0356ec0e086ce7b8ffaa1ad9b6d5873994fcd51463b3c742c62761b9ab`;
  create/verify CLIs
  `045a8ffd19a2df8bbb5c9c2252ebb5cf1064391785348327f7e87bb063802d2f` /
  `2dd6c7b28f869bb4c584a765b2748b5d23f112431fde3741796198a60183e432`;
  integrated test
  `146ce919e57e759dd0790f7885b67110c284d2b9e61036904a0afb0bb691debd`;
  runbook
  `220c0f9fa7410ef6bbca1d9bdd5c693f68dd20fa6ee3d96d0128013253312a70`;
  claim matrix
  `18aac72a20f3dc5a2fd1e5b059713de43906b21d08a7a82e3dbd88c8e59dcbb1`;
  traceability
  `60b32bfde383621f9fa15a660e27113dbefd390536e72840e97ac0d20201a943`.
- The result reports
  `coordinator_protocol_authority:"not-required-for-verification"` and deliberately
  retains `coordinator_execution_binding:"unproven"`. It is not exact-SHA CI/review,
  public inventory completeness, issuer/clock honesty, or independent administrator,
  account, host, network, power, or physical-domain evidence. HEAD and `origin/main`
  remain `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative worktree is `117`
  paths (`43` modified, `74` untracked). No commit, push, merge, deployment, live
  authority, or external mutation occurred. Full-suite, exact-SHA governance, and real
  separately administered multi-host operation remain HOLD.

## 2026-08-22 KST — All-role-key participant inventory closure; focused PASS

- Audited the remaining `public inventory completeness` limitation. Objective global
  completeness is unknowable from supplied sidecars, but a coordinator can be denied
  the ability to complete two different final inventories for one deployment plan by
  requiring every participating role key to make one durable plan-keyed choice.
- Added `mortalos-placement-admission-pilot-inventory-ratification/1`. It binds exact
  source-verdict ID and byte digest, pilot evidence ID, source commit, deployment-plan
  ID, and signer identity. The async boundary owns/restores all bytes and snapshots the
  signer before suspension; the plan-keyed sign-once tuple gives byte-identical exact
  retry and rejects another verdict under the same conforming durable authority.
- Added `mortalos-placement-admission-pilot-inventory-closure/1` plus role-local ratify,
  no-replace aggregate-create, and read-only aggregate-verify CLIs. Closure creation
  fully recreates the source verdict, derives the unique key/role set from its exact
  verified execution receipts, binds the plan to pilot evidence, and requires one
  ratification from every key. Restore is sidecar-unverified; full replay reports
  `inventory_closure:"all-role-keys-ratified"`.
- Final native `/2` integration is `1/1` PASS in `207,089.5934ms`
  (`207,282.5833ms` runner). The fixture closes 7/7 unique role keys. It proves exact
  retry, plan-keyed conflicting-verdict equivocation, reversed-input determinism,
  missing 6/7 early failure with no output, secret-free public bytes, and fresh-process
  exact closure verification.
- Async security exits `0`, `26/26`, with `22` direct / `145` auto-discovered exports
  and class methods. Specification exits `0` with `115` rejection codes and `104`
  relative links; release links exit `0` with `59` local / `11` HTTPS syntax-only;
  generated protocol profile, relevant syntax, registry JSON, and `git diff --check`
  pass.
- Key SHA-256 receipts: closure/ratification module
  `a7108b54330bca9b55cdd32601ec9f97a089840aaabbc89c7b1339bce30eb828`;
  ratify/create/verify CLIs
  `6a806cacb907ac9e11a1c8195afe2df706d4189cc0189e8946f705ef87f2152c` /
  `275afed702c9a27ab7106c805cadc41667e988539981cc16238867f897ba8a24` /
  `f269037b342c1596a291b81c50e52cacfa1c167105384dcd4cfc5c927f298754`;
  integrated test
  `30dc414bad76d3a6b49bc95f069f65ea5ef681943169098cc6e8a4c4fda6ec86`;
  security registry/verifier
  `f25f44f75145368e33cd5fcb39190e1d3fe67e4ece0bcf1ea20f3e5711b9fcf3` /
  `1b0509eb7fdbd524c625d52e40119cf741450b69952e0a5873a117f661f5a2d3`;
  operator runbook
  `491a783801b58313fcbd61b06b04853928afbbb4aff88ef340ac3f9a32f995c4`;
  claim matrix
  `26f61aa9c57d2991703cd69372e232a77aabbe28bd04f59a2f9f9ba0d6290c45`;
  traceability
  `05f3e6406e31229f01b18f6b9bea8074d25855c70d6c970a5dfa904abcef639a`.
- This is participant-ratified plan finality, not global hidden-artifact discovery.
  Copied keys/separate journals, dishonest operators, issuer/clock honesty, independent
  administrators/accounts/hosts/networks/power/physical domains, and Sybil resistance
  remain unproven. HEAD and `origin/main` remain
  `285ccbae01011a7c69e16016dc1bdd1d8d2e1203`; the cumulative worktree is `121` paths
  (`43` modified, `78` untracked). No commit, push, merge, deployment, live authority,
  or external mutation occurred. Full suite, exact-SHA governance, and real separately
  administered multi-host execution remain HOLD.

## 2026-08-23 — Exact-SHA flake discovery and serial P2P orchestration remediation

- Committed the approved 121-path candidate as `116207b2ffb453ed70e2d9fb0a4bfc311e9a0094`
  with exact tree `f483ff3780722c0edbb4fed9ce54af3eb38172cd`; branch and actual index were clean.
  A fresh detached worktree and `npm ci` completed with exit `0`, 95 audited packages,
  and zero vulnerabilities.
- The first exact-SHA suite stopped at `test:protocol-profile` because the storage
  possession test assumed two arbitrary nonces always select different Merkle leaves.
  With three leaves, distinct nonces can validly collide on one challenge-selected
  leaf. The test now searches for a nonce that actually selects another leaf before
  requiring the original proof to reject. The focused case passes independently
  `20/20`; the full protocol-profile group passes `23/23`. The fix is commit
  `894661b107e4490883ec30c1b03bd889d5fdd1f8`.
- Fresh detached execution on `894661b1...` passed every preceding stage and P2P Node
  assertions, but ended nonzero after `6,598,172ms`: P2P summary was `70` pass / `2`
  timeout cancellations / zero assertion failures. Executor crossed its
  `1,500,000ms` limit; the `10,000 × 8` schedule crossed `900,000ms` by `55.4977ms`.
  Complete log SHA-256 is
  `76a639889b2f74e4ce30c9b79cb549b8e3f56dbeb11be1e4822e3e01123f8700`.
- Serial replay proved concurrency `1` necessary but not sufficient: executor still
  timed out at `1,538,640.1267ms`, while schedule passed in `846,722.895ms`. The package
  gate now serializes P2P Node test files. Executor and schedule limits are
  `2,000,000ms` and `1,200,000ms`; batch interruption remains `1,200,000ms`. No corpus,
  seed, assertion, or product source changed.
- The remediated executor/schedule pair passes serially `2/2`, with zero failure,
  cancellation, or skip, in `2,178,485.7704ms`: executor `1,345,547.9513ms`, schedule
  `832,008.0928ms`. Log SHA-256 is
  `143cd1f2021075142086ff68e3e8b8fe711ba1b10dcca0404d1c650d53632f91`.
  Fresh full-suite evidence on the successor exact SHA remains pending; no push, PR,
  merge, deployment, or live authority mutation occurred.

## 2026-08-24 — Visible EN/KO real-file continuity journey

- Started from freshly fetched `origin/main` at
  `9fedd6ce733fad9b5eae61490667adef1193ab18` in a dedicated task worktree. The public
  page had a clear identity/custody A→B proof but no visible file selection, transfer,
  recovery, or download path.
- Composed the existing product Continuity and manual WebRTC harnesses into the main
  five-step journey. A selects 1–131,072 native bytes and creates a Capsule; HTTP
  relays only public evidence plus bounded canonical WebRTC signals; the file-bearing
  Capsule crosses the ordered direct DataChannel. B requests and accepts custody with
  its own non-extractable authority, A destroys its authority and direct transport,
  and B rejects one corrupt signed copy, recovers exact bytes from 2-of-3, downloads
  them, and commits product sequence 3.
- Reduced the direct transfer from three redundant pre-handoff copies to one Capsule;
  B creates its current signed recovery copies only after acceptance. This cut a
  34,816-byte UX fixture's direct payload snapshot from about 360,941 bytes to the
  single-Capsule path while preserving post-handoff corruption recovery.
- `build:lab`, i18n `2/2`, WebRTC `15/15`, focused 6,016-byte Chromium, exact-ceiling
  131,072-byte Chromium, and integrated UX all pass. The UX receipt reports median
  LCP `244.6ms`, CLS `0.000`, TBT `16.0ms`, DOM interactive `154.1ms`; seven stable
  EN/KO/failure/fork screenshot states; under-90-second success; honest read-only
  stall on premature A loss. HTTP POST inspection contains neither plaintext nor
  base64url file bytes. Exact-SHA governance, full suite, deployment, independent
  hosts/administrators/networks, and arbitrary-NAT reachability remain pending.
- Adjacent regression closure passes: Continuity `10/10`; relay contract `5/5`,
  runtime `5/5`, dry-run deploy; multi-browser `7/7` plus isolated Chromium quorum;
  Lab/API `23/23`; H3A full browser Lab; persistent profiles `20/20` with 38 admitted
  operations/12s and zero local 429s; security boundary `26/26` over 22 direct and 145
  discovered async surfaces; spec and links. The security module-closure digest was
  intentionally refreshed only after the new bounded artifact-kind allowlist passed
  the focused artifact tests. Full ordered P2P and exact-SHA CI remain pending.

## 2026-08-24 — PR #60 independent-review single-lineage remediation

- Independent immutable review of head
  `bdc4ace4b12f1c43729de39f3e855184645653b4` returned BLOCK with one P1:
  the Product Continuity Capsule and visible Life Card each created a different
  `organism_id`, so the page presented one handoff while executing two lineages.
- Removed the second `LiveEndpointParticipant` lineage from the visible-file path.
  The product harness now returns only validated public Genesis/Pulse evidence from
  the Capsule; a read-only evidence view replays those exact records for the Life
  Card. Product create, handoff accept, and continuation supply sequence 1, 2, and 3
  respectively, and their public records are the only lineage evidence sent through
  HTTP relay. File-bearing Capsule bytes still cross only direct WebRTC.
- The focused browser snapshot now exposes the active Capsule lineage and asserts
  exact `organism_id`, `head_hash`, and `sequence` equality with the displayed state
  after transfer, acceptance, and continuation. The UX gate now requires displayed
  sequence 3 and the same equality.
- Local remediation evidence: focused Chromium PASS at 6,016 and 131,072 bytes;
  integrated EN/KO UX PASS with median LCP `188.4ms`, CLS `0.000`, TBT `0.0ms`, and
  DOM interactive `114.9ms`; Continuity `10/10`; WebRTC `15/15`; Lab/API `23/23`;
  i18n `2/2`; persistent profiles `20/20` with 38 admitted operations/12s and zero
  local 429s; security `26/26` over 22 direct / 145 discovered surfaces; build and
  diff checks PASS. New commit, exact-head CI, independent re-review, App/native
  attestations, merge, and deployment remain pending.
