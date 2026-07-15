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

Use `node scripts/create-agent-worktree.mjs create <agent-id> <task>` only for a
new task branch. The command fails if a matching local or remote branch already
exists. Reattaching requires the explicit `resume` command, a matching upstream,
and proof that current `origin/main` is an ancestor of the task branch.

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
- The author must be registered in the trusted base's `agents/README.md`.
- `Shared-Paths` must cover every changed and renamed path; validation entries must
  name completed checks and risk must identify a concrete failure mode.
- Every relevant test and required GitHub Actions check must pass.
- A change to the reviewed body, base, head, changed-file evidence, or latest bound
  policy run invalidates the review and requires a new snapshot review.

`.github/workflows/trusted-pr-policy.yml` defines `Agent PR Policy`. It runs only with
`pull_request_target`, a platform-side `main` base-branch filter, minimum read
permissions, and trusted base code. The branch filter must stop alternate-base PRs
before any checkout or script execution. The workflow must never check out or execute
PR head code, and concurrent runs for one PR cancel older runs. It binds the event
body to stable beginning/end API snapshots and requires the paginated file count to
equal both snapshots' `changed_files` count. It obtains immutable base/head metadata,
ancestry, and changed files through GitHub's read API before applying the unit-tested
policy parser. It is the repository's sole policy workflow; a `pull_request`-triggered
workflow is never policy or merge evidence.

## Reviewer and merge gate

The logical reviewer is `reviewer-merge-gate`. It must follow
`agents/reviewer-merge-gate/README.md` and must not edit the author branch.

It may merge only when it has inspected the entire diff at an immutable snapshot,
confirmed the PR contract and CI, found no unresolved blocking issue, and re-fetched
the body/base/head, changed files, and latest policy run immediately before merging.
Its attestation must bind the reviewed base/head, exact API-body SHA-256, changed-file
count/digest, and latest non-cancelled policy run ID/attempt plus `completed/success`
status and exact `pull_request_target` event. The merge call must include the expected
head SHA.

If the connected GitHub identity is also the PR author, GitHub cannot represent this
logical separation as a second native user approval. In that case the reviewer leaves
a structured `COMMENT` attestation, not a false `APPROVE`, and the independent agent
execution plus immutable-SHA merge is the auditable gate. Strong account-level
separation requires a distinct reviewer GitHub App or bot account and branch rules.
