# Reviewer work log

This log is append-only. Each review records the exact PR head and the evidence used.

## 2026-07-15 — PR #1

- Author agent: `codex-protocol-kernel`
- Base SHA: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Reviewed head SHA: `c646521fb2b5543b4a65859d01fbfb3cca0fedcf`
- Changed paths: 20 governance, agent-workspace, worktree/PR-policy, test,
  documentation, package-script, and package-exclusion paths; trusted `src/` unchanged
- Checks: `Agent PR Policy` run 29379380257 and `Verify` run 29379380258
  succeeded; independent detached-head npm, governance, conformance, property,
  coverage, Chromium differential, audit, package, and secret checks passed
- Findings: no blocking finding; residual limitation is logical-agent rather than
  separate GitHub-account identity and absent externally enforced main ruleset
- Review: structured `COMMENT` attestation 4699808544
- Verdict: `PASS`
- Merge SHA: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3` (squash with expected head)
- Post-merge verification: main `Verify` run 29379690175 succeeded for the merge SHA

## 2026-07-15 — PR #1 post-merge re-audit

- Author agent: `codex-protocol-kernel`
- Base SHA: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`
- Re-reviewed head SHA: `c646521fb2b5543b4a65859d01fbfb3cca0fedcf`
- Checks: complete diff and workflow logs re-inspected; detached-head `npm test`,
  coverage, audit, package exclusions, and governance tests reproduced
- Findings: proposed-head policy code can self-bypass; the PR contract accepts
  unregistered or placeholder-grade declarations; existing task branches can resume
  from stale `main`
- Review: structured post-merge `COMMENT` attestation 4699941694
- Verdict: `POST_MERGE_FAIL`; the preceding PASS entry is superseded
- Merge SHA: already merged as `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Corrective action: `agent/codex-protocol-kernel--governance-hardening` pending

## 2026-07-15 — PR #2

- Author agent: `codex-protocol-kernel`
- Base SHA: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Reviewed head SHA: `20424fc6010d7d918bc2a9e3d669a680e784c68e`
- Changed paths: 44 trusted-core, schema, rejection-code, vector, test, workflow,
  dependency-notice, protocol, threat-model, status, plan, and traceability paths
- Checks: exact-head `Agent PR Policy` run 29382765460 and `Verify` run
  29382765457 succeeded; independent detached-head `npm ci` and `npm test`
  passed
- Findings: mortality can falsely declare death when a pending threshold-raise body
  is completable by a surviving retained custodian; canonical hashing/signing accepts
  exotic non-I-JSON programmatic objects and collapses distinct values to `{}`
- Review: native `REQUEST_CHANGES` was rejected by GitHub because the connected
  identity is also the PR author; structured blocking `COMMENT` review 4700321564
  was anchored to the immutable head
- Verdict: `REQUEST_CHANGES`
- Merge SHA: not merged
- Post-merge verification: not applicable

## Entry template

### YYYY-MM-DD — PR #N

- Author agent: `<agent-id>`
- Base SHA: `<sha>`
- Reviewed head SHA: `<sha>`
- Changed paths: `<paths>`
- Checks: `<workflow and conclusion>`
- Findings: `<blocking findings or none>`
- Verdict: `PASS` or `REQUEST_CHANGES`
- Merge SHA: `<sha or not merged>`
- Post-merge verification: `<result or not applicable>`


## 2026-07-15 — PR #7

- Author agent: `codex-protocol-kernel`
- Base SHA: `e332bdf639f6b8c4e39186087cde5e0470f7846f`
- Reviewed head SHA: `bc914d676b29a58efcd2ce6647ab04c727f10df3`
- Review snapshot: body SHA-256
  `78160c805bfe9038a079061d725d5a1c3d409d6f409a531a8f8ec4d5302f6f54`;
  22 changed-file records at SHA-256
  `34bbd0f9cab442b5deef1363400cf83c4b7d97b5690251283dd06c604dcb31eb`
- Changed paths: 22 canonical-codec, validator/lineage mortality, portable-vector,
  adversarial-test, protocol/threat/status/plan/traceability, verification-script,
  and author-record paths
- Checks: trusted `Agent PR Policy` run `29392686827/1` and exact-head
  `Verify` run `29392683039` succeeded; independent detached-head full suite,
  two 10,000-case corpora, 98.05%/93.50%/100% coverage, actual Chromium 149,
  dependency audit, package manifest, and focused invalid-sidecar reproduction passed
- Findings: initial head was rejected for treating a hash-matching semantic-invalid
  sidecar as unavailable and later became stale after `main` advanced; the author
  fixed the mortality rule, added array/scalar and reversibility regressions, rebased
  on current `main`, and corrected the stale memory base. No blocker remained on
  the final immutable snapshot.
- Review: structured `COMMENT` attestation REST ID `4701355571`, anchored to the
  reviewed head; native approval was intentionally not used because the connected
  GitHub account is also the PR author
- Verdict: `PASS`
- Merge SHA: `9791074ffe8f091b8007e09f2b3edd4080d4212b` (squash with expected head)
- Post-merge verification: remote `main` matched the merge SHA and push `Verify`
  run `29393252181` completed successfully
