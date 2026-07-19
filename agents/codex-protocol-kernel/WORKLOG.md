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
