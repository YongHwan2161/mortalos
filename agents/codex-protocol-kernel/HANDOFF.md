# Handoff and shared-path intent

This is an advisory conflict-avoidance ledger. It does not grant ownership over
shared project files and must not be used as a lock that blocks the project indefinitely.

## Active intent

None.

## Completed handoffs

### 2026-07-15 — Permanent governance migration cleanup

- Main base: `e6dce59fb314266acdd855748a9b1fb996864e81`
- Work branch: `agent/codex-protocol-kernel--governance-cleanup`
- Exact changed paths: delete `.github/workflows/pr-policy.yml`; update `AGENTS.md`,
  `agents/codex-protocol-kernel/HANDOFF.md`,
  `agents/codex-protocol-kernel/WORKLOG.md`,
  `agents/reviewer-merge-gate/README.md`, `docs/AGENT_COLLABORATION.md`, and
  `test/agent-governance.test.mjs`
- Result: removed the completed migration workflow and all active exception
  instructions; permanent tests enumerate every workflow, reserve both trusted policy
  identities, and reject a `pull_request`/trusted-name collision. The trusted target
  workflow remains byte-for-byte unchanged at blob
  `94d2b0353fc44d931acd0a28604786a55e78786f`.
- Author validation: fresh `npm ci`; full `npm test`; governance 28/28 at 92.68% line,
  84.39% branch, and 93.75% function coverage; audit 0 vulnerabilities; YAML syntax
  and static trigger/name semantics; package dry-run with 61 entries; JavaScript syntax
  and diff checks passed
- PR contract: `Shared-Paths` must list exactly all seven changed paths above,
  including the deleted workflow path; the unchanged trusted workflow is not declared
- Handoff: reviewer publishes the immutable commit, requires a successful trusted
  `pull_request_target` policy run and `Verify`, then independently decides the exact
  snapshot; no push or self-approval by the author

### 2026-07-15 — Split-workflow PR #3 migration correction

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `0ab51f2b8514acd3bba14ee01d45c44f9cf9a91f`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: `.github/workflows/pr-policy.yml`, new
  `.github/workflows/trusted-pr-policy.yml`, `AGENTS.md`,
  `docs/AGENT_COLLABORATION.md`, `agents/reviewer-merge-gate/README.md`, governance
  tests, and this author's handoff/worklog; no runtime or `src/` change
- Result: the proposed-head bootstrap and trusted target policy now have distinct
  workflow files, workflow names, job/check names, permissions, and concurrency.
  No `pull_request` run can create the `Trusted main-base policy` check, and quoted
  bootstrap names preserve the literal `#3` text under YAML parsing.
- Author validation: governance 28/28; coverage 92.68% line, 84.39% branch, and
  93.75% function; full `npm test`; dependency audit 0 vulnerabilities; YAML syntax,
  package dry-run, JavaScript syntax, and diff checks passed. Local Chromium rerun
  remains an environment-only pending check because the sandbox lacks the binary and
  blocks its CDN; the published head requires a fresh `Verify` run before review.
- PR contract: add `.github/workflows/trusted-pr-policy.yml` to the exact
  `Shared-Paths` list before policy/reviewer snapshotting.
- Handoff: reviewer publishes the immutable correction, confirms only the untrusted
  marker runs for PR #3, requires fresh `Verify`, and independently decides the exact
  head; no push or self-approval by the author

### 2026-07-15 — Two-phase PR #3 trigger bootstrap

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `121f5269f1a1c146099d1aa936175c25670e3933`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: PR policy workflow, root/reviewer/collaboration migration contracts,
  governance tests, and author handoff/worklog; no runtime or `src/` change
- Result: an isolated zero-permission `pull_request` bootstrap marker temporarily
  coexists with the unchanged trusted target job; event-specific concurrency prevents
  cross-cancellation; permanent attestations require event `pull_request_target`; and
  docs mandate an immediate post-merge target-only cleanup PR
- Author validation: full `npm test`; governance 28/28 with 92.68% line, 84.39%
  branch, and 93.75% function coverage; Chromium 149 differential; dependency,
  package, syntax, YAML, and diff checks passed
- Handoff: reviewer must publish, observe the actual bootstrap run, and independently
  decide the exact new head; no push or self-approval by the author

### 2026-07-15 — Reviewer snapshot attestation binding

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `5f41549437309eb59b94c2cb6783c31b1ad62941`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: reviewer/root/collaboration contracts, governance regression test, and
  author handoff/worklog; no runtime or `src/` change
- Result: reviewer PASS evidence now binds base/head, exact API-body digest,
  changed-file count/digest, and latest non-cancelled policy run ID/attempt/status;
  any pre-merge snapshot movement requires a complete restart
- Author validation: full `npm test`; governance 27/27 with 92.68% line, 84.39%
  branch, and 93.75% function coverage; Chromium 149 differential; dependency,
  package, syntax, YAML, and diff checks passed
- Handoff: follow-up commit requires a fresh independent review decision

### 2026-07-15 — Alternate-base and policy snapshot correction

- Main base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrected predecessor: `a0d1e19a001e1922244dc1d5a6574758620ffc65`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: trusted PR workflow, policy verifier/tests, and governance documentation;
  no `src/` protocol or wire-format change
- Result: GitHub now filters the workflow to `main`-base PRs before runner execution;
  per-PR concurrency cancels obsolete runs; event/API bodies and beginning/end
  body/ref/SHA/changed-file-count snapshots must remain identical, and pagination
  must return exactly the API-declared file count
- Author validation: governance 26/26 with 92.68% line, 84.39% branch, and 93.75%
  function coverage; full and Chromium checks passed; dependency, package, syntax,
  YAML, and diff checks passed before immutable-head handoff
- Handoff: follow-up commit requires a fresh independent review decision

### 2026-07-15 — PR governance trust-boundary hardening

- Base: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Work branch: `agent/codex-protocol-kernel--governance-hardening`
- Paths: trusted PR workflow/template, agent governance documentation,
  worktree/PR policy scripts, governance tests, and `package.json`; no `src/`
  protocol or wire-format change
- Result: policy code now executes only from the immutable PR base with read-only
  permissions; declarations and GitHub API ancestry/path evidence fail closed; new
  worktrees reject existing branches and explicit resume rejects stale, local-only,
  wrongly tracked, behind, or diverged branches; the public legacy-workflow bootstrap
  can obtain the same read-only API evidence without an exported token
- Author validation: full `npm test`; governance 25/25 with 91.91% line, 81.01%
  branch, and 93.48% function coverage; actual Chromium 149 differential 10,000/10,000;
  dependency audit 0 vulnerabilities; package exclusion, YAML, syntax, and diff checks
  passed
- Handoff: ready for immutable-head review by `reviewer-merge-gate`

### 2026-07-15 — Agent-isolated contribution and reviewer merge gate

- Base: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Work branch: `agent/codex-protocol-kernel--agent-governance`
- Paths: `AGENTS.md`, `agents/**`, `docs/AGENT_COLLABORATION.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/pr-policy.yml`,
  `scripts/create-agent-worktree.mjs`, `scripts/verify-agent-pr.mjs`,
  `test/agent-governance.test.mjs`, `package.json`, and `.npmignore`
- Author validation: governance 10/10, full `npm test`, coverage, dependency audit,
  and actual Chromium differential verification passed
- Handoff: ready for immutable-head review by `reviewer-merge-gate`

## Before changing shared paths

Add an active entry containing:

- task and reason
- exact intended paths
- base `main` commit
- expected validation
- expected handoff or pull request

Then check the current remote `main`, open pull requests, and other agent ledgers.
If another agent is already modifying the same semantics, coordinate or split the
work before writing code.

## Handoff template

### `<status>` Task name

- From / to: `<agent-id>`
- Base: `<commit>`
- Intended paths: `<paths>`
- Contract affected: `<protocol/API/schema/docs>`
- Required evidence: `<tests or review>`
- Notes: `<short context>`
