import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { buildWorktreePlan, createWorktree, requireSegment } from "../scripts/create-agent-worktree.mjs";
import { validatePullRequestPolicy } from "../scripts/verify-agent-pr.mjs";

const BASE_SHA = "0".repeat(40);

function validEvent(overrides = {}) {
  const body = [
    "Author-Agent: codex-protocol-kernel",
    "Reviewer-Agent: reviewer-merge-gate",
    `Base-Commit: ${BASE_SHA}`,
    "Shared-Paths:",
    "- AGENTS.md",
    "Validation:",
    "- npm test",
    "Risk: low - governance-only change",
  ].join("\n");
  return {
    pull_request: {
      body,
      base: { ref: "main", sha: BASE_SHA },
      head: { ref: "agent/codex-protocol-kernel--agent-governance", sha: "1".repeat(40) },
      ...overrides,
    },
  };
}

test("valid agent PR contract passes", () => {
  assert.deepEqual(validatePullRequestPolicy(validEvent()), []);
});

test("PR policy rejects wrong base and generic branch", () => {
  const event = validEvent({
    base: { ref: "develop", sha: BASE_SHA },
    head: { ref: "feature/governance", sha: "1".repeat(40) },
  });
  const errors = validatePullRequestPolicy(event);
  assert.ok(errors.includes("PR base must be main"));
  assert.ok(errors.includes("head branch must match agent/<agent-id>--<task>"));
});

test("PR policy binds author, reviewer, and current base SHA", () => {
  const event = validEvent();
  event.pull_request.body = event.pull_request.body
    .replace("Author-Agent: codex-protocol-kernel", "Author-Agent: another-agent")
    .replace("Reviewer-Agent: reviewer-merge-gate", "Reviewer-Agent: another-agent")
    .replace(BASE_SHA, "2".repeat(40));
  const errors = validatePullRequestPolicy(event);
  assert.ok(errors.includes("Reviewer-Agent must be reviewer-merge-gate"));
  assert.ok(errors.includes("Base-Commit does not match the current PR base SHA"));
  assert.ok(errors.includes("head branch agent ID does not match Author-Agent"));
});

test("reviewer agent cannot author its own reviewed PR", () => {
  const event = validEvent();
  event.pull_request.body = event.pull_request.body
    .replace("Author-Agent: codex-protocol-kernel", "Author-Agent: reviewer-merge-gate");
  event.pull_request.head.ref = "agent/reviewer-merge-gate--policy-change";
  assert.ok(validatePullRequestPolicy(event).includes("author and reviewer agents must differ"));
});

test("PR policy rejects placeholders and missing evidence", () => {
  const event = validEvent();
  event.pull_request.body = event.pull_request.body
    .replace("- AGENTS.md", "- replace-me")
    .replace("- npm test", "- TODO")
    .replace("Risk: low - governance-only change", "Risk: replace-me");
  const errors = validatePullRequestPolicy(event);
  assert.ok(errors.includes("Shared-Paths needs at least one real list item"));
  assert.ok(errors.includes("Validation needs at least one real list item"));
  assert.ok(errors.includes("Risk needs a non-placeholder value"));
});

test("worktree plan isolates task branch outside repository", () => {
  const root = resolve("/tmp/mortalos");
  const plan = buildWorktreePlan(root, "codex-protocol-kernel", "r2-state");
  assert.equal(plan.branch, "agent/codex-protocol-kernel--r2-state");
  assert.equal(plan.base, "main");
  assert.equal(plan.worktreePath, resolve("/tmp/mortalos-worktrees/codex-protocol-kernel--r2-state"));
  assert.equal(plan.worktreePath.startsWith(`${root}/`), false);
});

test("agent and task segments reject ref-injection characters", () => {
  assert.throws(() => requireSegment("bad/id", "agent-id"));
  assert.throws(() => requireSegment("bad..task", "task"));
  assert.throws(() => requireSegment("-leading", "task"));
});

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("worktree creator builds a real isolated task branch from origin/main", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "mortalos-agent-worktree-"));
  const origin = join(sandbox, "origin.git");
  const repository = join(sandbox, "mortalos");
  try {
    runGit(["init", "--bare", origin], sandbox);
    runGit(["init", "-b", "main", repository], sandbox);
    await writeFile(join(repository, "README.md"), "fixture\n", "utf8");
    runGit(["add", "README.md"], repository);
    runGit(["-c", "user.name=MortalOS Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], repository);
    runGit(["remote", "add", "origin", origin], repository);
    runGit(["push", "-u", "origin", "main"], repository);

    const mainSha = runGit(["rev-parse", "HEAD"], repository);
    const plan = createWorktree(repository, "test-agent", "isolated-task");
    assert.equal(runGit(["branch", "--show-current"], plan.worktreePath), "agent/test-agent--isolated-task");
    assert.equal(runGit(["rev-parse", "HEAD"], plan.worktreePath), mainSha);
    assert.equal(plan.worktreePath.startsWith(`${repository}/`), false);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("registered agents have durable role, memory, worklog, and handoff files", async () => {
  for (const agent of ["codex-protocol-kernel", "reviewer-merge-gate"]) {
    for (const file of ["README.md", "MEMORY.md", "WORKLOG.md", "HANDOFF.md"]) {
      const content = await readFile(new URL(`../agents/${agent}/${file}`, import.meta.url), "utf8");
      assert.ok(content.trim().length > 0, `${agent}/${file} must not be empty`);
    }
  }
});

test("root agent instructions identify the only logical merge gate", async () => {
  const instructions = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(instructions, /reviewer-merge-gate/u);
  assert.match(instructions, /expected head SHA/u);
  assert.match(instructions, /Do not push directly to `main`/u);
});
