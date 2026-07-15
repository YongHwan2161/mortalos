import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function requireSegment(value, label) {
  if (!SEGMENT.test(value ?? "")) {
    throw new Error(`${label} must use lowercase letters, digits, and single hyphens`);
  }
  return value;
}

export function buildWorktreePlan(repoRoot, agentId, task) {
  requireSegment(agentId, "agent-id");
  requireSegment(task, "task");
  const normalizedRoot = resolve(repoRoot);
  const branch = `agent/${agentId}--${task}`;
  const worktreeRoot = join(dirname(normalizedRoot), `${basename(normalizedRoot)}-worktrees`);
  const worktreePath = join(worktreeRoot, `${agentId}--${task}`);
  return {
    base: "origin/main",
    baseBranch: "main",
    branch,
    repoRoot: normalizedRoot,
    worktreePath
  };
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? (result.stderr || result.stdout).trim() : "";
    throw new Error(`git ${args.join(" ")} failed with status ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function gitOutput(args, cwd) {
  return git(args, { cwd, capture: true }).stdout.trim();
}

function refExists(repoRoot, ref) {
  return git(["show-ref", "--verify", "--quiet", ref], {
    cwd: repoRoot,
    allowFailure: true,
    capture: true
  }).status === 0;
}

function isAncestor(repoRoot, ancestor, descendant) {
  return git(["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repoRoot,
    allowFailure: true,
    capture: true
  }).status === 0;
}

function fetchCurrentRefs(plan) {
  git(
    ["fetch", "--prune", "origin", "+refs/heads/main:refs/remotes/origin/main"],
    { cwd: plan.repoRoot, capture: true }
  );
  if (!refExists(plan.repoRoot, "refs/remotes/origin/main")) {
    throw new Error("origin/main is unavailable after fetch");
  }
  const remoteBranch = git(
    ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${plan.branch}`],
    { cwd: plan.repoRoot, allowFailure: true, capture: true }
  );
  if (![0, 2].includes(remoteBranch.status)) {
    throw new Error(`could not determine whether origin/${plan.branch} exists`);
  }
  const remoteExists = remoteBranch.status === 0;
  if (remoteExists) {
    git(
      [
        "fetch",
        "origin",
        `+refs/heads/${plan.branch}:refs/remotes/origin/${plan.branch}`
      ],
      { cwd: plan.repoRoot, capture: true }
    );
  }
  return {
    baseCommit: gitOutput(["rev-parse", "refs/remotes/origin/main"], plan.repoRoot),
    remoteExists
  };
}

function existingRefs(plan, remoteExists) {
  const localRef = `refs/heads/${plan.branch}`;
  const remoteRef = `refs/remotes/origin/${plan.branch}`;
  return {
    localExists: refExists(plan.repoRoot, localRef),
    localRef,
    remoteExists,
    remoteRef
  };
}

function requireAvailablePath(plan) {
  if (existsSync(plan.worktreePath)) throw new Error(`worktree path already exists: ${plan.worktreePath}`);
}

function requireFreshBase(plan, baseCommit, ref) {
  if (!isAncestor(plan.repoRoot, baseCommit, ref)) {
    throw new Error(`${ref} is stale: current origin/main is not an ancestor`);
  }
}

function requireExpectedUpstream(plan, localRef, remoteRef) {
  const upstream = gitOutput(["for-each-ref", "--format=%(upstream:short)", localRef], plan.repoRoot);
  const expected = `origin/${plan.branch}`;
  if (upstream !== expected) {
    throw new Error(`${localRef} must track ${expected} before resume`);
  }
  const [localOnly, remoteOnly] = gitOutput(
    ["rev-list", "--left-right", "--count", `${localRef}...${remoteRef}`],
    plan.repoRoot
  ).split(/\s+/u).map(Number);
  if (!Number.isInteger(localOnly) || !Number.isInteger(remoteOnly)) {
    throw new Error("could not determine local/upstream relationship");
  }
  if (remoteOnly > 0) {
    throw new Error(`${localRef} is behind or diverged from ${expected}; synchronize explicitly before resume`);
  }
}

function ensureTaskFetchRefspec(plan) {
  const existing = git(["config", "--get-all", "remote.origin.fetch"], {
    cwd: plan.repoRoot,
    allowFailure: true,
    capture: true
  });
  if (![0, 1].includes(existing.status)) throw new Error("could not inspect origin fetch refspecs");
  const exact = `+refs/heads/${plan.branch}:refs/remotes/origin/${plan.branch}`;
  const coversTask = existing.stdout.split(/\r?\n/u).some(
    (entry) => entry === exact || entry === "+refs/heads/*:refs/remotes/origin/*"
  );
  if (!coversTask) {
    git(["config", "--add", "remote.origin.fetch", exact], {
      cwd: plan.repoRoot,
      capture: true
    });
  }
}

export function createWorktree(repoRoot, agentId, task) {
  const plan = buildWorktreePlan(repoRoot, agentId, task);
  requireAvailablePath(plan);
  const fetched = fetchCurrentRefs(plan);
  const refs = existingRefs(plan, fetched.remoteExists);
  if (refs.localExists || refs.remoteExists) {
    throw new Error(`task branch already exists: ${plan.branch}; use the explicit resume command`);
  }

  mkdirSync(dirname(plan.worktreePath), { recursive: true });
  git(
    ["worktree", "add", "--no-track", "-b", plan.branch, plan.worktreePath, fetched.baseCommit],
    { cwd: plan.repoRoot, capture: true }
  );
  return {
    ...plan,
    baseCommit: fetched.baseCommit,
    mode: "create"
  };
}

export function resumeWorktree(repoRoot, agentId, task) {
  const plan = buildWorktreePlan(repoRoot, agentId, task);
  requireAvailablePath(plan);
  const fetched = fetchCurrentRefs(plan);
  const refs = existingRefs(plan, fetched.remoteExists);
  if (!refs.localExists && !refs.remoteExists) {
    throw new Error(`task branch does not exist: ${plan.branch}; use create`);
  }
  if (refs.localExists && !refs.remoteExists) {
    throw new Error(`local task branch has no matching origin branch: ${plan.branch}`);
  }

  if (refs.localExists) {
    requireExpectedUpstream(plan, refs.localRef, refs.remoteRef);
    requireFreshBase(plan, fetched.baseCommit, refs.localRef);
    git(["worktree", "add", plan.worktreePath, plan.branch], { cwd: plan.repoRoot, capture: true });
  } else {
    requireFreshBase(plan, fetched.baseCommit, refs.remoteRef);
    ensureTaskFetchRefspec(plan);
    git(
      ["worktree", "add", "--track", "-b", plan.branch, plan.worktreePath, refs.remoteRef],
      { cwd: plan.repoRoot, capture: true }
    );
  }

  return {
    ...plan,
    baseCommit: fetched.baseCommit,
    branchCommit: gitOutput(["rev-parse", plan.branch], plan.repoRoot),
    mode: "resume"
  };
}

function repositoryRoot() {
  return gitOutput(["rev-parse", "--show-toplevel"], process.cwd());
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [command, agentId, task] = process.argv.slice(2);
  if (!new Set(["plan", "create", "resume"]).has(command) || !agentId || !task) {
    console.error("Usage: node scripts/create-agent-worktree.mjs <plan|create|resume> <agent-id> <task>");
    process.exitCode = 1;
  } else {
    try {
      const root = repositoryRoot();
      const plan = command === "create"
        ? createWorktree(root, agentId, task)
        : command === "resume"
          ? resumeWorktree(root, agentId, task)
          : buildWorktreePlan(root, agentId, task);
      console.log(JSON.stringify(plan, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
