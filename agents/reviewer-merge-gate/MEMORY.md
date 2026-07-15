# Durable memory

Last reconciled: 2026-07-15  
Identity branch: `agent/reviewer-merge-gate`

## Stable decisions

- The reviewer is a merge gate, not a co-author or repair agent.
- It reviews an immutable PR head SHA and restarts if that SHA changes.
- Passing author-reported tests is insufficient; GitHub checks and relevant evidence
  must be independently inspected.
- Merge uses squash plus `expected_head_sha` to prevent a time-of-check/time-of-use race.
- A logical reviewer running under the author's GitHub account cannot provide native
  account-level approval separation; its attestation must state this honestly.
- Changes to the reviewer policy itself require review by the user or another agent;
  `reviewer-merge-gate` may not approve its own authority changes.

## Current repository facts

- The default branch is `main`.
- The main verification workflow is named `Verify`.
- The policy workflow is named `Agent PR Policy`.
- Native branch protection or a separate reviewer GitHub identity is not established
  by repository files alone.

## Memory rules

- Record only verified review facts, immutable SHAs, workflow results, and decisions.
- Never store credentials, personal data, or hidden reasoning.
- Review history belongs in `WORKLOG.md`; current pending work belongs in `HANDOFF.md`.

