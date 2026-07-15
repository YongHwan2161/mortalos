import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  return { base: "main", branch, repoRoot: normalizedRoot, worktreePath };
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(" ")} failed with status ${result.status}`);
  }
  return result;
}

function refExists(repoRoot, ref) {
  return git(["show-ref", "--verify", "--quiet", ref], {
    cwd: repoRoot,
    allowFailure: true,
    capture: true,
  }).status === 0;
}

export function createWorktree(repoRoot, agentId, task) {
  const plan = buildWorktreePlan(repoRoot, agentId, task);
  if (existsSync(plan.worktreePath)) {
    throw new Error(`worktree path already exists: ${plan.worktreePath}`);
  }

  mkdirSync(dirname(plan.worktreePath), { recursive: true });
  git(["fetch", "--prune", "origin", plan.base], { cwd: plan.repoRoot });
  const localRef = `refs/heads/${plan.branch}`;
  const remoteRef = `refs/remotes/origin/${plan.branch}`;

  if (refExists(plan.repoRoot, localRef)) {
    git(["worktree", "add", plan.worktreePath, plan.branch], { cwd: plan.repoRoot });
  } else if (refExists(plan.repoRoot, remoteRef)) {
    git(["worktree", "add", "--track", "-b", plan.branch, plan.worktreePath, `origin/${plan.branch}`], {
      cwd: plan.repoRoot,
    });
  } else {
    git(["worktree", "add", "-b", plan.branch, plan.worktreePath, `origin/${plan.base}`], {
      cwd: plan.repoRoot,
    });
  }
  return plan;
}

function repositoryRoot() {
  const result = git(["rev-parse", "--show-toplevel"], { cwd: process.cwd(), capture: true });
  return result.stdout.trim();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [command, agentId, task] = process.argv.slice(2);
  if (!new Set(["plan", "create"]).has(command) || !agentId || !task) {
    console.error("Usage: node scripts/create-agent-worktree.mjs <plan|create> <agent-id> <task>");
    process.exitCode = 1;
  } else {
    try {
      const root = repositoryRoot();
      const plan = command === "create"
        ? createWorktree(root, agentId, task)
        : buildWorktreePlan(root, agentId, task);
      console.log(JSON.stringify(plan, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
