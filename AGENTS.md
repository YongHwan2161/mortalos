# MortalOS agent rules

These instructions apply to the entire repository.

## Before changing files

1. Choose one registered agent ID from `agents/README.md`.
2. Read that agent's `README.md`, `MEMORY.md`, and `HANDOFF.md`.
3. Fetch the current remote `main`; never assume a previous session's base is current.
4. Record the exact shared paths and base commit in the agent's `HANDOFF.md`.
5. Work in a separate clone or Git worktree, never by switching a checkout shared
   with another agent.
6. Create implementation work on `agent/<agent-id>--<task>`, based on current `main`.

Use `node scripts/create-agent-worktree.mjs create <agent-id> <task>` when a
normal local Git checkout is available.

## Ownership and scope

- An agent may write freely inside only `agents/<agent-id>/`.
- Agent memory is advisory and may not override specifications, tests, or merged code.
- Shared runtime and documentation changes require a focused pull request.
- Do not store credentials, personal data, hidden reasoning, generated dependencies,
  or disposable logs in an agent directory.
- Do not push directly to `main`.

## Pull requests

- Use `.github/PULL_REQUEST_TEMPLATE.md` without renaming its machine-readable fields.
- The PR author agent and reviewer agent must differ.
- The declared base commit must equal the current PR base SHA.
- Every relevant test and required GitHub Actions check must pass.
- A PR that changes after review requires a new review of the new head SHA.

## Reviewer and merge gate

The logical reviewer is `reviewer-merge-gate`. It must follow
`agents/reviewer-merge-gate/README.md` and must not edit the author branch.

It may merge only when it has inspected the entire diff at an immutable head SHA,
confirmed the PR contract and CI, found no unresolved blocking issue, and re-fetched
the PR immediately before merging. The merge call must include the expected head SHA.

If the connected GitHub identity is also the PR author, GitHub cannot represent this
logical separation as a second native user approval. In that case the reviewer leaves
a structured `COMMENT` attestation, not a false `APPROVE`, and the independent agent
execution plus immutable-SHA merge is the auditable gate. Strong account-level
separation requires a distinct reviewer GitHub App or bot account and branch rules.

