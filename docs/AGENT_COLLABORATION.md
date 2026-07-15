# Agent collaboration and merge protocol

## Purpose

MortalOS uses multiple agents, but shared access must not turn `main` or one local
checkout into a race. Identity, filesystem state, implementation history, and merge
authority are separated.

## Isolation model

```text
agent identity branch ── durable role and memory
           │
current main ── task branch in its own worktree ── pull request
                                                      │
                                    policy CI + Verify + full review
                                                      │
                                      reviewer-merge-gate ── main
```

A Git branch isolates commit history. It does **not** isolate an actively checked-out
filesystem. Every simultaneous agent therefore needs a separate clone or worktree.

## Branch naming

- Durable identity: `agent/<agent-id>`
- Disposable task: `agent/<agent-id>--<task>`
- Agent and task segments use lowercase letters, digits, and single hyphens.
- Every task branch starts from the remote's current `main`, not an old identity branch.

## Creating an isolated worktree

From a normal Git checkout:

```bash
node scripts/create-agent-worktree.mjs plan codex-protocol-kernel r2-state
node scripts/create-agent-worktree.mjs create codex-protocol-kernel r2-state
```

The command fetches `origin/main`, creates or attaches the task branch, and places the
worktree in a sibling `<repository>-worktrees/` directory. It never deletes a branch
or worktree.

## Shared-path intent

Before editing a path outside `agents/<agent-id>/`, the author records in its
`HANDOFF.md`:

- task and reason
- exact paths
- current `main` SHA
- expected tests and evidence
- intended reviewer/handoff

The author then checks open PRs and other ledgers. An overlap is resolved before code
is written; a ledger is an advisory lease, not a permanent lock.

## Pull-request contract

The exact labels in `.github/PULL_REQUEST_TEMPLATE.md` are machine-readable. The
`Agent PR Policy` workflow rejects:

- a base other than `main`
- a branch outside `agent/<author>--<task>`
- author/branch mismatches
- reviewer equal to author
- stale or malformed base commit
- missing shared paths, validation evidence, or risk statement

`Verify` remains the product correctness gate. Passing policy CI does not imply the
implementation is correct.

## Review and merge

`reviewer-merge-gate` is the only logical agent role authorized to merge an agent PR.
It follows `agents/reviewer-merge-gate/README.md`, reviews the entire immutable head,
checks CI for that SHA, and merges using `expected_head_sha`. Any new commit invalidates
the review.

The reviewer must request changes instead of editing the author's branch. This keeps
authorship, correction, and final verification auditable.

## Enforcement boundary

Repository files implement discoverable instructions, deterministic PR-policy tests,
CI checks, scoped memories, and an auditable reviewer contract. They cannot by
themselves prevent an administrator from pushing directly to `main` or create a second
GitHub identity.

For account-level enforcement, configure a GitHub ruleset for `main` that requires:

1. pull requests instead of direct pushes
2. successful `Agent PR Policy` and `Verify` checks
3. dismissal of stale approvals after new commits
4. conversation resolution
5. no administrator bypass for normal agent work
6. approval by a separately authenticated reviewer GitHub App or bot

Until that external configuration exists, the reviewer agent is a process-level and
immutable-SHA gate, not a cryptographically distinct GitHub principal.

