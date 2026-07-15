# Durable memory

Last reconciled: 2026-07-15  
Identity branch: `agent/reviewer-merge-gate`

## Stable decisions

- The reviewer is a merge gate, not a co-author or repair agent.
- It reviews an immutable PR head SHA and restarts if that SHA changes.
- Passing author-reported tests is insufficient; GitHub checks and relevant evidence
  must be independently inspected.
- A policy check is not trusted when the proposed PR can replace the workflow or
  verifier that produces the check. Policy code must come from the trusted base and
  must never execute proposed-head code.
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
- The original PASS review for PR #1 was superseded by post-merge review 4699941694
  after trust-boundary and stale-worktree defects were independently reproduced.
- Corrective governance and mortality-safety author branches both start from
  `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`; neither is approved merely by existing.

## Memory rules

- Record only verified review facts, immutable SHAs, workflow results, and decisions.
- Never store credentials, personal data, or hidden reasoning.
- Review history belongs in `WORKLOG.md`; current pending work belongs in `HANDOFF.md`.
