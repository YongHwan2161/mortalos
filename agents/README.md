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

## Registered agents

| Agent ID | Role | Working branch |
| --- | --- | --- |
| `codex-protocol-kernel` | Protocol Kernel & Verification Maintainer | `agent/codex-protocol-kernel` |

