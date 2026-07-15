import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildWorktreePlan,
  createWorktree,
  requireSegment,
  resumeWorktree
} from "../scripts/create-agent-worktree.mjs";
import {
  fetchGitHubPullRequestEvidence,
  parsePullRequestBody,
  parseRegisteredAgents,
  validatePullRequestPolicy,
  verifyEventFile
} from "../scripts/verify-agent-pr.mjs";

const BASE_SHA = "0".repeat(40);
const HEAD_SHA = "1".repeat(40);
const REGISTERED_AGENTS = new Set(["codex-protocol-kernel", "reviewer-merge-gate"]);

function validBody(overrides = {}) {
  const fields = {
    author: "codex-protocol-kernel",
    reviewer: "reviewer-merge-gate",
    base: BASE_SHA,
    sharedPaths: ["AGENTS.md"],
    summary: ["Harden the trusted pull-request policy boundary"],
    validation: ["npm test — PASS"],
    risk: "medium — policy mistakes could admit an undeclared change",
    northStar: "Keeps independent review evidence bound to immutable code",
    ...overrides
  };
  return [
    `Author-Agent: ${fields.author}`,
    `Reviewer-Agent: ${fields.reviewer}`,
    `Base-Commit: ${fields.base}`,
    "Shared-Paths:",
    ...fields.sharedPaths.map((entry) => `- ${entry}`),
    "Summary:",
    ...fields.summary.map((entry) => `- ${entry}`),
    "Validation:",
    ...fields.validation.map((entry) => `- ${entry}`),
    `Risk: ${fields.risk}`,
    `North-Star-Impact: ${fields.northStar}`
  ].join("\n");
}

function validEvent(overrides = {}) {
  return {
    number: 7,
    repository: { default_branch: "main" },
    pull_request: {
      number: 7,
      body: validBody(),
      base: { ref: "main", sha: BASE_SHA },
      head: {
        ref: "agent/codex-protocol-kernel--governance-hardening",
        sha: HEAD_SHA
      },
      ...overrides
    }
  };
}

function validEvidence(overrides = {}) {
  const pullRequest = {
    number: 7,
    body: validBody(),
    changedFilesCount: 1,
    baseRef: "main",
    baseSha: BASE_SHA,
    headRef: "agent/codex-protocol-kernel--governance-hardening",
    headSha: HEAD_SHA
  };
  return {
    pullRequest,
    finalPullRequest: { ...pullRequest },
    comparison: {
      requestedBaseSha: BASE_SHA,
      requestedHeadSha: HEAD_SHA,
      status: "ahead",
      aheadBy: 1,
      behindBy: 0,
      baseCommitSha: BASE_SHA,
      mergeBaseSha: BASE_SHA
    },
    changedFiles: [{ filename: "AGENTS.md" }],
    ...overrides
  };
}

function policyErrors(
  event = validEvent(),
  evidence = validEvidence(),
  agents = REGISTERED_AGENTS,
  bindEventBody = true
) {
  const boundEvidence = structuredClone(evidence);
  if (bindEventBody && event?.pull_request) {
    boundEvidence.pullRequest.body = event.pull_request.body ?? "";
    boundEvidence.finalPullRequest.body = event.pull_request.body ?? "";
  }
  return validatePullRequestPolicy({ event, evidence: boundEvidence, registeredAgents: agents });
}

test("valid registered-agent PR contract with API evidence passes", () => {
  assert.deepEqual(policyErrors(), []);
});

test("machine labels must occur exactly once and list labels cannot use inline bypasses", () => {
  const duplicate = validEvent({ body: `${validBody()}\nAuthor-Agent: codex-protocol-kernel` });
  assert.ok(policyErrors(duplicate).includes("Author-Agent must appear exactly once"));

  const inline = validEvent({ body: validBody().replace("Shared-Paths:\n- AGENTS.md", "Shared-Paths: AGENTS.md") });
  assert.ok(policyErrors(inline).includes("Shared-Paths must be followed by a Markdown list"));

  const parsed = parsePullRequestBody(`${validBody()}\nValidation:\n- npm test — PASS`);
  assert.ok(parsed.errors.includes("Validation must appear exactly once"));

  const nonList = parsePullRequestBody(validBody().replace("- npm test — PASS", "npm test — PASS"));
  assert.ok(nonList.errors.includes("Validation contains a non-list line"));
});

test("pull-request template remains parseable but cannot pass with placeholders", async () => {
  const template = await readFile(resolve(".github/PULL_REQUEST_TEMPLATE.md"), "utf8");
  const parsed = parsePullRequestBody(template);
  assert.ok(!parsed.errors.includes("Shared-Paths contains a non-list line"));

  const event = validEvent({ body: template });
  const errors = policyErrors(event);
  assert.ok(errors.includes("Author-Agent is missing or invalid"));
  assert.ok(errors.some((entry) => entry.includes("invalid or overbroad declaration: replace-me")));
  assert.ok(errors.includes("Summary needs at least one meaningful list item"));
  assert.ok(errors.some((entry) => entry.startsWith("Validation must name a check and end in PASS")));
  assert.ok(errors.includes("Risk must include a level and a meaningful explanation"));
  assert.ok(errors.includes("North-Star-Impact needs a meaningful value"));
});

test("policy rejects unregistered authors, wrong reviewer, stale declaration, and mismatched branch", () => {
  const event = validEvent({
    body: validBody({
      author: "unregistered-agent",
      reviewer: "unregistered-reviewer",
      base: "2".repeat(40)
    }),
    head: { ref: "agent/another-agent--governance-hardening", sha: HEAD_SHA }
  });
  const errors = policyErrors(event);
  assert.ok(errors.includes("Author-Agent is not registered in trusted agents/README.md"));
  assert.ok(errors.includes("Reviewer-Agent must be reviewer-merge-gate"));
  assert.ok(errors.includes("Reviewer-Agent is not registered in trusted agents/README.md"));
  assert.ok(errors.includes("Base-Commit does not match the current PR base SHA"));
  assert.ok(errors.includes("head branch agent ID does not match Author-Agent"));
});

test("reviewer agent cannot author its own reviewed PR", () => {
  const event = validEvent({
    body: validBody({ author: "reviewer-merge-gate" }),
    head: { ref: "agent/reviewer-merge-gate--policy-change", sha: HEAD_SHA }
  });
  assert.ok(policyErrors(event).includes("author and reviewer agents must differ"));
});

test("meaningful summary, validation result, risk, and north-star impact are required", () => {
  const event = validEvent({
    body: validBody({
      summary: ["TODO"],
      validation: ["looks fine"],
      risk: "low",
      northStar: "replace-me"
    })
  });
  const errors = policyErrors(event);
  assert.ok(errors.includes("Summary needs at least one meaningful list item"));
  assert.ok(errors.some((entry) => entry.startsWith("Validation must name a check and end in PASS")));
  assert.ok(errors.includes("Risk must include a level and a meaningful explanation"));
  assert.ok(errors.includes("North-Star-Impact needs a meaningful value"));
});

test("Shared-Paths must cover every current and previous changed filename", () => {
  const evidence = validEvidence({
    pullRequest: { ...validEvidence().pullRequest, changedFilesCount: 2 },
    finalPullRequest: { ...validEvidence().finalPullRequest, changedFilesCount: 2 },
    changedFiles: [
      { filename: "scripts/verify-agent-pr.mjs" },
      { filename: "docs/new-name.md", previous_filename: "docs/old-name.md" }
    ]
  });
  const event = validEvent({
    body: validBody({ sharedPaths: ["scripts/**", "docs/new-name.md"] })
  });
  const errors = policyErrors(event, evidence);
  assert.ok(errors.some((entry) => entry.includes("docs/old-name.md")));

  event.pull_request.body = validBody({ sharedPaths: ["scripts/**", "docs/**"] });
  assert.deepEqual(policyErrors(event, evidence), []);
});

test("Shared-Paths rejects root wildcards, traversal, duplicates, and unused declarations", () => {
  const event = validEvent({
    body: validBody({ sharedPaths: ["replace-me", "**", "../AGENTS.md", "AGENTS.md", "AGENTS.md", "src/**"] })
  });
  const errors = policyErrors(event);
  assert.ok(errors.some((entry) => entry.includes("invalid or overbroad declaration: replace-me")));
  assert.ok(errors.some((entry) => entry.includes("invalid or overbroad declaration: **")));
  assert.ok(errors.some((entry) => entry.includes("invalid or overbroad declaration: ../AGENTS.md")));
  assert.ok(errors.some((entry) => entry.includes("duplicate declaration: AGENTS.md")));
  assert.ok(errors.some((entry) => entry.includes("declarations with no changed file: src/**")));
});

test("GitHub API metadata and descendant evidence must match the event", () => {
  const mismatched = validEvidence({
    pullRequest: {
      ...validEvidence().pullRequest,
      headSha: "3".repeat(40)
    },
    comparison: {
      ...validEvidence().comparison,
      status: "diverged",
      behindBy: 1,
      mergeBaseSha: "4".repeat(40)
    }
  });
  const errors = policyErrors(validEvent(), mismatched);
  assert.ok(errors.includes("event head SHA does not match GitHub API evidence"));
  assert.ok(errors.includes("comparison head does not match the PR head SHA"));
  assert.ok(errors.includes("PR head must be a non-empty descendant of the current base SHA"));

  const alternateBaseEvent = validEvent({ base: { ref: "attacker-base", sha: BASE_SHA } });
  const alternateBasePull = {
    ...validEvidence().pullRequest,
    baseRef: "attacker-base"
  };
  const alternateBaseEvidence = validEvidence({
    pullRequest: alternateBasePull,
    finalPullRequest: { ...alternateBasePull }
  });
  assert.ok(policyErrors(alternateBaseEvent, alternateBaseEvidence).includes("PR base must be main"));

  assert.deepEqual(
    validatePullRequestPolicy({ event: {}, evidence: undefined, registeredAgents: REGISTERED_AGENTS }),
    ["event does not contain pull_request"]
  );
  assert.ok(
    validatePullRequestPolicy({
      event: validEvent(),
      evidence: undefined,
      registeredAgents: REGISTERED_AGENTS
    }).includes("GitHub read-API evidence is required")
  );
});

test("policy binds the event body to stable beginning and ending API snapshots", () => {
  const apiBodyChangedBeforeCollection = validEvidence({
    pullRequest: { ...validEvidence().pullRequest, body: validBody({ risk: "high — API body changed before validation completed" }) }
  });
  const initialErrors = policyErrors(validEvent(), apiBodyChangedBeforeCollection, REGISTERED_AGENTS, false);
  assert.ok(initialErrors.includes("event PR body does not match GitHub API evidence"));
  assert.ok(initialErrors.includes("PR metadata, body, or changed-file count changed during policy evidence collection"));

  const apiBodyChangedDuringCollection = validEvidence({
    finalPullRequest: {
      ...validEvidence().finalPullRequest,
      body: validBody({ risk: "high — API body changed during validation collection" })
    }
  });
  assert.ok(
    policyErrors(validEvent(), apiBodyChangedDuringCollection, REGISTERED_AGENTS, false)
      .includes("PR metadata, body, or changed-file count changed during policy evidence collection")
  );

  const countChangedDuringCollection = validEvidence({
    finalPullRequest: { ...validEvidence().finalPullRequest, changedFilesCount: 2 }
  });
  assert.ok(
    policyErrors(validEvent(), countChangedDuringCollection)
      .includes("PR metadata, body, or changed-file count changed during policy evidence collection")
  );

  const incompletePagination = validEvidence({ changedFiles: [] });
  assert.ok(
    policyErrors(validEvent(), incompletePagination)
      .includes("GitHub changed-file pagination count does not match the PR snapshot")
  );

  const emptyStringBody = validEvidence({
    pullRequest: { ...validEvidence().pullRequest, body: "" },
    finalPullRequest: { ...validEvidence().finalPullRequest, body: "" }
  });
  assert.ok(
    policyErrors(validEvent({ body: null }), emptyStringBody, REGISTERED_AGENTS, false)
      .includes("event PR body does not match GitHub API evidence")
  );
});

test("registered agents are parsed only from the trusted registry table", () => {
  const agents = parseRegisteredAgents([
    "codex-protocol-kernel outside a table",
    "| Agent ID | Role |",
    "| --- | --- |",
    "| `codex-protocol-kernel` | author |",
    "| `bad/id` | invalid |",
    "| `reviewer-merge-gate` | reviewer |"
  ].join("\n"));
  assert.deepEqual([...agents].sort(), ["codex-protocol-kernel", "reviewer-merge-gate"]);
});

test("GitHub evidence loader uses only read endpoints and preserves rename evidence", async () => {
  const requests = [];
  const payloads = [
    {
      number: 7,
      body: validBody(),
      changed_files: 1,
      base: { ref: "main", sha: BASE_SHA },
      head: { ref: "agent/codex-protocol-kernel--governance-hardening", sha: HEAD_SHA }
    },
    {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      base_commit: { sha: BASE_SHA },
      merge_base_commit: { sha: BASE_SHA }
    },
    [{ filename: "new.md", previous_filename: "old.md" }],
    {
      number: 7,
      body: validBody(),
      changed_files: 1,
      base: { ref: "main", sha: BASE_SHA },
      head: { ref: "agent/codex-protocol-kernel--governance-hardening", sha: HEAD_SHA }
    }
  ];
  const mockFetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => payloads.shift() };
  };
  const evidence = await fetchGitHubPullRequestEvidence({
    apiUrl: "https://api.github.test",
    repository: "owner/repository",
    pullNumber: 7,
    token: "test-token",
    fetchImpl: mockFetch
  });
  assert.equal(requests.length, 4);
  assert.match(requests[0].url, /\/pulls\/7$/u);
  assert.match(requests[1].url, new RegExp(`/compare/${BASE_SHA}\\.\\.\\.${HEAD_SHA}$`, "u"));
  assert.match(requests[2].url, /\/pulls\/7\/files\?per_page=100&page=1$/u);
  assert.match(requests[3].url, /\/pulls\/7$/u);
  assert.equal(requests[0].options.headers.authorization, "Bearer test-token");
  assert.equal(evidence.pullRequest.changedFilesCount, 1);
  assert.equal(evidence.finalPullRequest.changedFilesCount, 1);
  assert.deepEqual(evidence.changedFiles, [{ filename: "new.md", previous_filename: "old.md" }]);
});

test("GitHub evidence loader and event verifier fail closed on malformed API evidence", async () => {
  await assert.rejects(
    fetchGitHubPullRequestEvidence({ apiUrl: "", repository: "owner/repository", pullNumber: 7, token: "token" }),
    /are required/u
  );
  await assert.rejects(
    fetchGitHubPullRequestEvidence({
      apiUrl: "https://api.github.test",
      repository: "invalid-repository",
      pullNumber: 7,
      token: "token",
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) })
    }),
    /owner\/name/u
  );
  await assert.rejects(
    fetchGitHubPullRequestEvidence({
      apiUrl: "https://api.github.test",
      repository: "owner/repository",
      pullNumber: 7,
      token: "token",
      fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) })
    }),
    /returned 403/u
  );

  const sandbox = await mkdtemp(join(tmpdir(), "mortalos-policy-event-"));
  try {
    const eventPath = join(sandbox, "event.json");
    await writeFile(eventPath, JSON.stringify(validEvent()), "utf8");
    const payloads = [
      {
        number: 7,
        body: validBody(),
        changed_files: 1,
        base: { ref: "main", sha: BASE_SHA },
        head: { ref: "agent/codex-protocol-kernel--governance-hardening", sha: HEAD_SHA }
      },
      {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        base_commit: { sha: BASE_SHA },
        merge_base_commit: { sha: BASE_SHA }
      },
      [{ filename: "AGENTS.md" }],
      {
        number: 7,
        body: validBody(),
        changed_files: 1,
        base: { ref: "main", sha: BASE_SHA },
        head: { ref: "agent/codex-protocol-kernel--governance-hardening", sha: HEAD_SHA }
      }
    ];
    const bootstrapRequests = [];
    await verifyEventFile(
      eventPath,
      {
        GITHUB_API_URL: "https://api.github.test",
        GITHUB_REPOSITORY: "owner/repository"
      },
      async (url, options) => {
        bootstrapRequests.push({ url, options });
        return { ok: true, status: 200, json: async () => payloads.shift() };
      }
    );
    assert.equal(bootstrapRequests.length, 4);
    assert.ok(bootstrapRequests.every(({ options }) => !("authorization" in options.headers)));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("policy workflow runs immutable trusted-base code with minimum read permissions", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pr-policy.yml", import.meta.url), "utf8");
  const lines = workflow.split(/\r?\n/u);
  const targetIndex = lines.indexOf("  pull_request_target:");
  assert.ok(targetIndex > lines.indexOf("on:"));
  const targetBlock = lines.slice(
    targetIndex + 1,
    lines.findIndex((line, index) => index > targetIndex && /^\S/u.test(line))
  );
  assert.deepEqual(targetBlock.filter((line) => line.startsWith("    branches:")), ["    branches: [main]"]);
  assert.ok(targetBlock.includes("    types: [opened, edited, synchronize, reopened, ready_for_review]"));
  assert.match(workflow, /^concurrency:\n(?:  #.*\n)?  group: agent-pr-policy-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \}\}\n  cancel-in-progress: true$/mu);
  assert.match(workflow, /^    if: github\.event_name == 'pull_request_target'$/mu);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.doesNotMatch(workflow, /pull_request\.head/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /pull-requests: read/u);
  assert.doesNotMatch(workflow, /:\s*write\s*$/mu);
  const actionRefs = [...workflow.matchAll(/uses:\s+actions\/[a-z-]+@([^\s]+)/gu)].map((entry) => entry[1]);
  assert.ok(actionRefs.length >= 2);
  assert.ok(actionRefs.every((reference) => /^[0-9a-f]{40}$/u.test(reference)));
});

test("temporary PR #3 bootstrap is isolated, untrusted, and requires immediate cleanup", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pr-policy.yml", import.meta.url), "utf8");
  const lines = workflow.split(/\r?\n/u);
  assert.equal(lines[0], "name: Agent PR Policy (TEMPORARY migration; bootstrap is UNTRUSTED)");

  const pullIndex = lines.indexOf("  pull_request:");
  const targetIndex = lines.indexOf("  pull_request_target:");
  assert.ok(pullIndex > lines.indexOf("on:") && pullIndex < targetIndex);
  assert.deepEqual(lines.slice(pullIndex + 1, targetIndex).filter((line) => line.startsWith("    branches:")), ["    branches: [main]"]);
  assert.ok(lines.slice(pullIndex + 1, targetIndex).includes("    types: [synchronize]"));

  const bootstrapIndex = lines.indexOf("  bootstrap-untrusted:");
  const policyIndex = lines.indexOf("  policy:");
  assert.ok(bootstrapIndex > lines.indexOf("jobs:") && policyIndex > bootstrapIndex);
  const bootstrap = lines.slice(bootstrapIndex, policyIndex).join("\n");
  assert.match(bootstrap, /name: UNTRUSTED TEMPORARY bootstrap signal - remove after PR #3/u);
  assert.match(bootstrap, /if: github\.event_name == 'pull_request'/u);
  assert.match(bootstrap, /permissions: \{\}/u);
  assert.doesNotMatch(bootstrap, /^\s*uses:|actions\/checkout|GITHUB_TOKEN|secrets\.|scripts\/|^\s*run:\s*(?:npm|node)\b/mu);
  assert.match(bootstrap, /not a policy verdict/u);

  const [instructions, collaboration, reviewer] = await Promise.all([
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/AGENT_COLLABORATION.md", import.meta.url), "utf8"),
    readFile(new URL("../agents/reviewer-merge-gate/README.md", import.meta.url), "utf8")
  ]);
  for (const document of [instructions, collaboration, reviewer]) {
    assert.match(document, /TEMPORARY-MIGRATION-STATE: ACTIVE/u);
  }
  assert.match(collaboration, /Immediately after PR #3 merges/u);
  assert.match(collaboration, /permanent regression must again reject any `pull_request` trigger/u);
  assert.match(collaboration, /trusted `pull_request_target` workflow on\s+`main` must validate the cleanup PR/u);
  assert.match(reviewer, /Verdict: MIGRATION-EXCEPTION/u);
  assert.match(reviewer, /Bootstrap-Status: completed\/success/u);
  assert.match(reviewer, /never policy or normal PASS evidence/u);
});

test("worktree plan isolates task branch outside repository", () => {
  const root = resolve("/tmp/mortalos");
  const plan = buildWorktreePlan(root, "codex-protocol-kernel", "r2-state");
  assert.equal(plan.branch, "agent/codex-protocol-kernel--r2-state");
  assert.equal(plan.base, "origin/main");
  assert.equal(plan.worktreePath, resolve("/tmp/mortalos-worktrees/codex-protocol-kernel--r2-state"));
  assert.equal(plan.worktreePath.startsWith(`${root}/`), false);
});

test("agent and task segments reject ref-injection characters", () => {
  assert.throws(() => requireSegment("bad/id", "agent-id"));
  assert.throws(() => requireSegment("bad..task", "task"));
  assert.throws(() => requireSegment("-leading", "task"));
});

test("worktree creation fails closed outside a Git repository", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "mortalos-not-a-repository-"));
  try {
    assert.throws(() => createWorktree(sandbox, "test-agent", "invalid-root"), /git fetch/u);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function repositoryFixture() {
  const sandbox = await mkdtemp(join(tmpdir(), "mortalos-agent-worktree-"));
  const origin = join(sandbox, "origin.git");
  const repository = join(sandbox, "mortalos");
  runGit(["init", "--bare", origin], sandbox);
  runGit(["init", "-b", "main", repository], sandbox);
  await writeFile(join(repository, "README.md"), "fixture\n", "utf8");
  runGit(["add", "README.md"], repository);
  runGit([
    "-c", "user.name=MortalOS Test",
    "-c", "user.email=test@example.invalid",
    "commit", "-m", "fixture"
  ], repository);
  runGit(["remote", "add", "origin", origin], repository);
  runGit(["push", "-u", "origin", "main"], repository);
  return { origin, repository, sandbox };
}

test("worktree create builds a new isolated branch from current origin/main", async () => {
  const fixture = await repositoryFixture();
  try {
    const mainSha = runGit(["rev-parse", "HEAD"], fixture.repository);
    const plan = createWorktree(fixture.repository, "test-agent", "isolated-task");
    assert.equal(runGit(["branch", "--show-current"], plan.worktreePath), "agent/test-agent--isolated-task");
    assert.equal(runGit(["rev-parse", "HEAD"], plan.worktreePath), mainSha);
    assert.equal(plan.baseCommit, mainSha);
    assert.equal(plan.mode, "create");
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
  }
});

test("default create rejects an existing local or remote task branch", async () => {
  const localFixture = await repositoryFixture();
  try {
    runGit(["branch", "agent/test-agent--existing-local", "origin/main"], localFixture.repository);
    assert.throws(
      () => createWorktree(localFixture.repository, "test-agent", "existing-local"),
      /use the explicit resume command/u
    );
  } finally {
    await rm(localFixture.sandbox, { recursive: true, force: true });
  }

  const remoteFixture = await repositoryFixture();
  try {
    runGit(["branch", "agent/test-agent--existing-remote", "origin/main"], remoteFixture.repository);
    runGit(["push", "origin", "agent/test-agent--existing-remote"], remoteFixture.repository);
    runGit(["branch", "-D", "agent/test-agent--existing-remote"], remoteFixture.repository);
    runGit(["config", "--unset-all", "remote.origin.fetch"], remoteFixture.repository);
    runGit([
      "config",
      "--add",
      "remote.origin.fetch",
      "+refs/heads/main:refs/remotes/origin/main"
    ], remoteFixture.repository);
    runGit(["update-ref", "-d", "refs/remotes/origin/agent/test-agent--existing-remote"], remoteFixture.repository);
    assert.throws(
      () => createWorktree(remoteFixture.repository, "test-agent", "existing-remote"),
      /use the explicit resume command/u
    );
  } finally {
    await rm(remoteFixture.sandbox, { recursive: true, force: true });
  }
});

test("create and resume reject path collisions, missing branches, and local-only branches", async () => {
  const fixture = await repositoryFixture();
  try {
    assert.throws(
      () => resumeWorktree(fixture.repository, "test-agent", "missing-task"),
      /task branch does not exist/u
    );

    runGit(["branch", "agent/test-agent--local-only", "origin/main"], fixture.repository);
    assert.throws(
      () => resumeWorktree(fixture.repository, "test-agent", "local-only"),
      /has no matching origin branch/u
    );

    const collision = buildWorktreePlan(fixture.repository, "test-agent", "path-collision");
    await mkdir(collision.worktreePath, { recursive: true });
    assert.throws(
      () => createWorktree(fixture.repository, "test-agent", "path-collision"),
      /worktree path already exists/u
    );
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
  }
});

test("explicit resume tracks a fresh remote task branch", async () => {
  const fixture = await repositoryFixture();
  try {
    runGit(["branch", "agent/test-agent--resume-task", "origin/main"], fixture.repository);
    runGit(["push", "origin", "agent/test-agent--resume-task"], fixture.repository);
    runGit(["branch", "-D", "agent/test-agent--resume-task"], fixture.repository);
    runGit(["config", "--unset-all", "remote.origin.fetch"], fixture.repository);
    runGit([
      "config",
      "--add",
      "remote.origin.fetch",
      "+refs/heads/main:refs/remotes/origin/main"
    ], fixture.repository);
    runGit(["update-ref", "-d", "refs/remotes/origin/agent/test-agent--resume-task"], fixture.repository);
    const plan = resumeWorktree(fixture.repository, "test-agent", "resume-task");
    assert.equal(plan.mode, "resume");
    assert.equal(runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], plan.worktreePath), "origin/agent/test-agent--resume-task");
    assert.equal(runGit(["merge-base", "--is-ancestor", "origin/main", "HEAD"], plan.worktreePath), "");
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
  }
});

test("explicit resume rejects a stale branch after origin/main advances", async () => {
  const fixture = await repositoryFixture();
  try {
    runGit(["branch", "agent/test-agent--stale-task", "origin/main"], fixture.repository);
    runGit(["push", "origin", "agent/test-agent--stale-task"], fixture.repository);
    runGit(["branch", "-D", "agent/test-agent--stale-task"], fixture.repository);
    await writeFile(join(fixture.repository, "README.md"), "advanced main\n", "utf8");
    runGit(["add", "README.md"], fixture.repository);
    runGit([
      "-c", "user.name=MortalOS Test",
      "-c", "user.email=test@example.invalid",
      "commit", "-m", "advance main"
    ], fixture.repository);
    runGit(["push", "origin", "main"], fixture.repository);
    assert.throws(
      () => resumeWorktree(fixture.repository, "test-agent", "stale-task"),
      /current origin\/main is not an ancestor/u
    );
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
  }
});

test("explicit resume rejects a local branch with the wrong upstream", async () => {
  const fixture = await repositoryFixture();
  try {
    const branch = "agent/test-agent--wrong-upstream";
    runGit(["branch", "--track", branch, "origin/main"], fixture.repository);
    runGit(["push", "origin", branch], fixture.repository);
    assert.throws(
      () => resumeWorktree(fixture.repository, "test-agent", "wrong-upstream"),
      /must track origin\/agent\/test-agent--wrong-upstream/u
    );
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
  }
});

test("explicit resume rejects a local branch that is behind its matching upstream", async () => {
  const fixture = await repositoryFixture();
  try {
    const branch = "agent/test-agent--behind-upstream";
    runGit(["checkout", "-b", branch, "origin/main"], fixture.repository);
    runGit(["push", "-u", "origin", branch], fixture.repository);
    runGit(["checkout", "main"], fixture.repository);

    const publisher = join(fixture.sandbox, "publisher");
    runGit(["clone", fixture.origin, publisher], fixture.sandbox);
    runGit(["checkout", branch], publisher);
    await writeFile(join(publisher, "REMOTE.md"), "remote advance\n", "utf8");
    runGit(["add", "REMOTE.md"], publisher);
    runGit([
      "-c", "user.name=MortalOS Test",
      "-c", "user.email=test@example.invalid",
      "commit", "-m", "advance task remotely"
    ], publisher);
    runGit(["push", "origin", branch], publisher);

    assert.throws(
      () => resumeWorktree(fixture.repository, "test-agent", "behind-upstream"),
      /behind or diverged/u
    );
  } finally {
    await rm(fixture.sandbox, { recursive: true, force: true });
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

test("root agent instructions identify the logical merge gate and trusted policy boundary", async () => {
  const instructions = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(instructions, /reviewer-merge-gate/u);
  assert.match(instructions, /expected\s+head SHA/u);
  assert.match(instructions, /trusted base/u);
  assert.match(instructions, /Do not push directly to `main`/u);
});

test("reviewer attestation binds the complete mutable PR review snapshot", async () => {
  const contract = await readFile(
    new URL("../agents/reviewer-merge-gate/README.md", import.meta.url),
    "utf8"
  );
  for (const field of [
    "Reviewed-PR: <positive integer>",
    "Reviewed-Base: <40-character lowercase SHA>",
    "Reviewed-Head: <40-character lowercase SHA>",
    "Reviewed-Body-SHA256: <64 lowercase hex>",
    "Reviewed-Changed-Files-Count: <non-negative integer>",
    "Reviewed-Changed-Files-SHA256: <64 lowercase hex>",
    "Agent-PR-Policy-Run: <run-id>/<run-attempt>",
    "Agent-PR-Policy-Event: pull_request_target",
    "Agent-PR-Policy-Status: completed/success"
  ]) {
    assert.equal(contract.split(field).length - 1, 1, `${field} must appear exactly once`);
  }
  assert.match(contract, /exact UTF-8 bytes/u);
  assert.match(contract, /JSON `null`, hash the zero-length byte string/u);
  assert.match(contract, /Do\s+not trim, normalize Unicode, convert line endings/u);
  assert.match(contract, /RFC 8785 JCS/u);
  assert.match(contract, /latest non-cancelled `Agent PR Policy` run/u);
  assert.match(contract, /event must be `pull_request_target`/u);
  assert.match(contract, /At review start, fetch and capture/u);
  assert.match(contract, /Immediately before the decision, re-fetch/u);
  assert.match(contract, /If body, base, head, changed-file/u);
  assert.match(contract, /restart the review from step 2/u);
});
