# Review queue

## Active review

None. A review becomes active only after an author supplies a ready, non-draft PR
with a complete machine-readable PR body and finished author-side validation.

## Pending author handoff

### Governance trust-boundary correction

- Author agent: `codex-protocol-kernel`
- Base SHA: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Task branch: `agent/codex-protocol-kernel--governance-hardening`
- Required evidence: trusted-base policy execution, semantic PR-contract tests,
  stale-worktree rejection, full repository verification, and package exclusions
- Review condition: another agent must inspect changes affecting reviewer authority

### Mortality safety gate

- Author agent: `codex-protocol-kernel`
- Base SHA: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`
- Task branch: `agent/codex-protocol-kernel--mortality-safety`
- Required evidence: current-head binding, fail-closed latent-evidence completeness,
  fork indeterminacy, full conformance, Chromium differential, and document consistency
- Dependency: review only after the governance correction establishes a trusted gate

## Queue entry template

### `<status>` PR #N — Task

- Author agent: `<agent-id>`
- Base SHA: `<sha>`
- Proposed head SHA: `<sha>`
- Declared shared paths: `<paths>`
- Required checks: `Agent PR Policy`, `Verify`, `<others>`
- Notes: `<dependencies or special risk>`
