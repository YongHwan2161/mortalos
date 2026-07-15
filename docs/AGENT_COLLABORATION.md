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

`create` fetches `origin/main`, requires that neither a matching local nor remote task
branch exists, creates the branch at the captured immutable base commit, and places
the worktree in a sibling `<repository>-worktrees/` directory. It never silently
attaches an existing branch.

To reattach a previously published task branch:

```bash
node scripts/create-agent-worktree.mjs resume codex-protocol-kernel r2-state
```

`resume` is deliberately fail-closed. It fetches current remote refs and requires:

- a remote `origin/agent/<agent-id>--<task>` branch;
- a matching local branch, if present, whose upstream is exactly that remote branch;
- no commits on the remote that are missing locally; and
- current `origin/main` to be an ancestor of the branch being attached.

A stale, diverged, local-only, wrongly tracked, already checked-out, or path-colliding
branch is refused. The helper never rebases, merges, deletes, or repairs a branch;
the author must resolve those conditions explicitly.

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
- an author absent from the trusted base's registered-agent table
- author/branch mismatches
- reviewer equal to author
- duplicate machine-readable labels
- stale, malformed, non-descendant, or API-mismatched base/head evidence
- a `Shared-Paths` declaration that omits any current or previous renamed path
- root wildcards, traversal, duplicate, unused, or otherwise invalid path declarations
- incomplete validation claims or a risk statement without a level and concrete impact

`Verify` remains the product correctness gate. Passing policy CI does not imply the
implementation is correct.

### Policy trust boundary

`.github/workflows/trusted-pr-policy.yml` defines `Agent PR Policy` and uses
`pull_request_target` only so the workflow and parser come from the trusted PR base
rather than the proposed head. Its `branches: [main]` event filter is a platform-side
security boundary: GitHub must discard an alternate-base PR before a runner starts,
because a JavaScript `baseRef` rejection after checkout would be too late. It checks
out the immutable main-base SHA with credentials disabled, pins every third-party
Action to a full commit SHA, grants only `contents: read` and `pull-requests: read`,
and executes no install, build, test, hook, or script from the PR head.

The trusted parser reads the trusted `agents/README.md` and uses the API PR body as
the policy input. It requires that body to equal the event body, then re-fetches the
PR after collecting its authoritative base/head SHAs, refs, compare result, merge
base, and paginated changed-file list. Any body/ref/SHA change between the beginning
and ending snapshots fails closed, as does a changed `changed_files` count or a
paginated result whose length differs from that count. Workflow concurrency is keyed
by PR number with `cancel-in-progress: true`, so a newer edit or synchronization
supersedes an older in-flight policy run. Core evaluation accepts the evidence as
explicit inputs and is unit tested without network access. The normal `Verify`
workflow may execute proposed code under the lower-privilege `pull_request` event;
its purpose is product correctness, not policy self-validation.

For reproducible local review of this public repository, the verifier can make the
same read-only public API GETs without an authorization header. This changes only
authentication and rate limits, not the required evidence or validation; private or
inaccessible API data still fails closed. The temporary bootstrap never invokes the
verifier. The trusted `pull_request_target` job always supplies its read-only token.

### Temporary two-phase trigger migration for PR #3

`TEMPORARY-MIGRATION-STATE: ACTIVE` means PR #3 uses two distinct workflow files.
This is required because GitHub cannot run the new `pull_request_target` definition
from `main` until that definition has merged, while replacing the already-registered
legacy `pull_request` workflow otherwise leaves the migration PR with no visible
migration run at all.

The two workflow identities and check names are deliberately disjoint:

- `.github/workflows/pr-policy.yml` runs only `bootstrap-untrusted` under
  `pull_request` on `synchronize`. It is head-controlled, has `permissions: {}`,
  checks out nothing, executes no repository code, reads no token or secret, and
  emits only an `UNTRUSTED TEMPORARY` warning. Its workflow and job names both say
  untrusted and cannot produce `Agent PR Policy` or `Trusted main-base policy`.
- `.github/workflows/trusted-pr-policy.yml` declares only `pull_request_target`,
  remains restricted to base `main`, and is the sole owner of the trusted immutable-
  base policy job/check. The files also use separate concurrency groups.

Immediately after PR #3 merges, create a new author branch from the resulting `main`
and open the cleanup PR. It must delete `.github/workflows/pr-policy.yml`, remove this
section, the root temporary section, the reviewer exception, and the temporary-state
regression test. The permanent regression must again reject every `pull_request`
policy trigger. Do not rename, change, or weaken `trusted-pr-policy.yml` or its target
job. That now-trusted `pull_request_target` workflow on `main` must validate the
cleanup PR before it can merge.

## Review and merge

`reviewer-merge-gate` is the only logical agent role authorized to merge an agent PR.
It follows `agents/reviewer-merge-gate/README.md` and reviews one immutable snapshot,
not only a commit. The snapshot binds PR number, base/head SHAs, the SHA-256 of the
exact GitHub API body UTF-8 bytes, the complete changed-file count/digest, and the
latest non-cancelled `Agent PR Policy` run ID/attempt with `completed/success` status.
That permanent attestation also records `Agent-PR-Policy-Event: pull_request_target`.
The temporary `pull_request` workflow has a different workflow name and job/check
name, so a name-based required check cannot confuse it with trusted policy evidence.
The body digest hashes zero bytes for API JSON `null` and otherwise performs no
trimming, Unicode/line-ending normalization, rendering, or newline insertion. The
changed-file digest uses the exact JCS record construction defined in the reviewer
contract.

Immediately before merge, the reviewer re-fetches and recomputes every snapshot
field plus all required check results. A changed body, base, head, changed-file
count/digest, policy run identity/status, or required check invalidates the review.
The policy event is part of that identity and must remain `pull_request_target`.
Only then may it merge with `expected_head_sha`.

The reviewer must request changes instead of editing the author's branch. This keeps
authorship, correction, and final verification auditable.

## Enforcement boundary

Repository files implement discoverable instructions, deterministic PR-policy tests,
CI checks, scoped memories, and an auditable reviewer contract. They cannot by
themselves prevent an administrator from pushing directly to `main` or create a second
GitHub identity.

For account-level enforcement, configure a GitHub ruleset for `main` that requires:

1. pull requests instead of direct pushes
2. the `Trusted main-base policy` job/check from `Agent PR Policy` and the
   `protocol` job/check from `Verify`
3. dismissal of stale approvals after new commits
4. a branch-up-to-date requirement so a policy result cannot outlive a changed base
5. conversation resolution
6. no administrator bypass for normal agent work
7. approval by a separately authenticated reviewer GitHub App or bot

Until that external configuration exists, the reviewer agent is a process-level and
immutable-SHA gate, not a cryptographically distinct GitHub principal.
