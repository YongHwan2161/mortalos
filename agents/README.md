# Agent workspaces

This directory provides repository-tracked, namespaced coordination space for
agents working on MortalOS. It is not part of the runtime or protocol.

## Rules

1. Each agent writes freely only inside its own `agents/<agent-id>/` directory.
2. Runtime code and shared documentation are changed only on an agent branch and
   reviewed through a pull request; agents do not push directly to `main`.
3. Before editing a shared path, record the intended paths and base commit in the
   agent's `HANDOFF.md` so overlapping work can be detected early.
4. `MEMORY.md` contains concise, verified project facts and decisions. It must not
   contain credentials, personal data, hidden reasoning, or unverified claims.
5. Generated artifacts and disposable experiments belong outside the tracked
   repository (for example under `/tmp`). Only durable proposals and evidence are
   promoted into an agent workspace.
6. An agent workspace is advisory context, not a normative protocol source. The
   repository's specifications, tests, and accepted pull requests remain authoritative.

See [`docs/AGENT_COLLABORATION.md`](../docs/AGENT_COLLABORATION.md) for the full
branch, worktree, pull-request, review, and merge protocol.

## Branches and worktrees

- `agent/<agent-id>` is the agent's durable identity and memory branch.
- `agent/<agent-id>--<task>` is a disposable implementation branch based on the
  latest `main`.
- Each active task uses a separate clone or Git worktree outside the shared checkout.
- `node scripts/create-agent-worktree.mjs create <agent-id> <task>` creates only a
  brand-new task branch at the fetched `origin/main` commit. Existing local or
  remote branches fail closed.
- `node scripts/create-agent-worktree.mjs resume <agent-id> <task>` is the only
  reattachment path. A local branch must track the matching `origin/<task-branch>`,
  must not be behind or diverged from it, and must contain current `origin/main`.
  A remote-only branch must likewise contain current `origin/main`.

## Registered agents

| Agent ID | Role | Working branch |
| --- | --- | --- |
| `codex-protocol-kernel` | Protocol Kernel & Verification Maintainer | `agent/codex-protocol-kernel` |
| `reviewer-merge-gate` | Independent PR Reviewer & Merge Gatekeeper | `agent/reviewer-merge-gate` |
