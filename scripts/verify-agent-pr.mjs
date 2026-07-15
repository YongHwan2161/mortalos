import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const FULL_SHA = /^[0-9a-f]{40}$/u;

const SCALAR_LABELS = Object.freeze([
  "Author-Agent",
  "Reviewer-Agent",
  "Base-Commit",
  "Risk",
  "North-Star-Impact"
]);
const LIST_LABELS = Object.freeze(["Shared-Paths", "Summary", "Validation"]);
const ALL_LABELS = Object.freeze([...SCALAR_LABELS, ...LIST_LABELS]);
const PLACEHOLDER = /(?:\b(?:replace(?:-me)?|todo|tbd|placeholder|none|n\/a)\b|<[^>]+>)/iu;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function meaningfulText(value, minimumLength = 8) {
  const text = value?.trim() ?? "";
  return text.length >= minimumLength && !PLACEHOLDER.test(text) && /[\p{L}\p{N}]/u.test(text);
}

function labelOccurrences(lines, label) {
  const expression = new RegExp(`^${escapeRegExp(label)}:(.*)$`, "u");
  return lines.flatMap((line, index) => {
    const match = line.match(expression);
    return match ? [{ index, remainder: match[1] }] : [];
  });
}

function nextBoundary(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s/u.test(lines[index])) return index;
    if (ALL_LABELS.some((label) => lines[index].startsWith(`${label}:`))) return index;
  }
  return lines.length;
}

export function parsePullRequestBody(body) {
  const lines = String(body ?? "").split(/\r?\n/u);
  const errors = [];
  const scalars = {};
  const lists = {};

  for (const label of SCALAR_LABELS) {
    const occurrences = labelOccurrences(lines, label);
    if (occurrences.length !== 1) {
      errors.push(`${label} must appear exactly once`);
      continue;
    }
    const value = occurrences[0].remainder.trim();
    if (!value) errors.push(`${label} must be a scalar value on the label line`);
    scalars[label] = value;
  }

  for (const label of LIST_LABELS) {
    const occurrences = labelOccurrences(lines, label);
    if (occurrences.length !== 1) {
      errors.push(`${label} must appear exactly once`);
      continue;
    }
    const occurrence = occurrences[0];
    if (occurrence.remainder.trim()) {
      errors.push(`${label} must be followed by a Markdown list`);
      continue;
    }
    const items = [];
    let invalidLine = false;
    for (let index = occurrence.index + 1; index < nextBoundary(lines, occurrence.index); index += 1) {
      const line = lines[index];
      if (!line.trim()) continue;
      const match = line.match(/^-\s+(.+?)\s*$/u);
      if (!match) {
        invalidLine = true;
        break;
      }
      items.push(match[1]);
    }
    if (invalidLine) errors.push(`${label} contains a non-list line`);
    lists[label] = items;
  }

  return { errors, lists, scalars };
}

export function parseRegisteredAgents(markdown) {
  const agents = new Set();
  for (const line of String(markdown ?? "").split(/\r?\n/u)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/u);
    if (match && AGENT_SEGMENT.test(match[1])) agents.add(match[1]);
  }
  return agents;
}

function normalizeDeclaredPath(value) {
  const unquoted = value.startsWith("`") && value.endsWith("`") ? value.slice(1, -1) : value;
  const recursive = unquoted.endsWith("/**");
  const path = recursive ? unquoted.slice(0, -3) : unquoted;
  const segments = path.split("/");
  if (
    !path ||
    PLACEHOLDER.test(unquoted) ||
    (!recursive && unquoted.endsWith("/")) ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("`") ||
    /[*?\[\]\u0000\s]/u.test(path) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  return { display: unquoted, exact: !recursive, path };
}

function normalizeChangedPath(value) {
  if (typeof value !== "string" || value.startsWith("/") || value.includes("\\")) return null;
  const segments = value.split("/");
  return segments.some((segment) => !segment || segment === "." || segment === "..")
    ? null
    : value;
}

function declarationCovers(declaration, changedPath) {
  return declaration.exact
    ? declaration.path === changedPath
    : changedPath === declaration.path || changedPath.startsWith(`${declaration.path}/`);
}

function validateSharedPaths(items, changedFiles, errors) {
  if (!items.length) {
    errors.push("Shared-Paths needs at least one path declaration");
    return;
  }
  const declarations = [];
  const seen = new Set();
  for (const item of items) {
    const declaration = normalizeDeclaredPath(item.trim());
    if (!declaration) {
      errors.push(`Shared-Paths contains an invalid or overbroad declaration: ${item}`);
      continue;
    }
    if (seen.has(declaration.display)) {
      errors.push(`Shared-Paths contains a duplicate declaration: ${declaration.display}`);
      continue;
    }
    seen.add(declaration.display);
    declarations.push(declaration);
  }

  const changedPaths = new Set();
  for (const file of changedFiles ?? []) {
    for (const candidate of [file?.filename, file?.previous_filename]) {
      if (candidate === undefined) continue;
      const normalized = normalizeChangedPath(candidate);
      if (!normalized) errors.push("GitHub returned an invalid changed-file path");
      else changedPaths.add(normalized);
    }
  }
  if (!changedPaths.size) {
    errors.push("GitHub API reported no changed files");
    return;
  }

  const uncovered = [...changedPaths].filter(
    (path) => !declarations.some((declaration) => declarationCovers(declaration, path))
  );
  if (uncovered.length) errors.push(`Shared-Paths does not cover changed files: ${uncovered.sort().join(", ")}`);

  const unused = declarations.filter(
    (declaration) => ![...changedPaths].some((path) => declarationCovers(declaration, path))
  );
  if (unused.length) {
    errors.push(`Shared-Paths contains declarations with no changed file: ${unused.map((entry) => entry.display).sort().join(", ")}`);
  }
}

function validateValidation(items, errors) {
  if (!items.length) {
    errors.push("Validation needs at least one completed check");
    return;
  }
  for (const item of items) {
    if (!meaningfulText(item, 10) || !/\bPASS(?:ED)?\b\s*$/iu.test(item)) {
      errors.push(`Validation must name a check and end in PASS: ${item}`);
    }
  }
}

function validateRisk(value, errors) {
  const match = value?.match(/^(low|medium|high|critical)\s*(?:-|—|–|:)\s*(.+)$/iu);
  if (!match || !meaningfulText(match[2], 12)) {
    errors.push("Risk must include a level and a meaningful explanation");
  }
}

function validateApiEvidence(event, evidence, errors) {
  const pull = event.pull_request;
  if (!evidence) {
    errors.push("GitHub read-API evidence is required");
    return;
  }
  const apiPull = evidence.pullRequest ?? {};
  for (const [label, eventValue, apiValue] of [
    ["PR number", pull.number ?? event.number, apiPull.number],
    ["PR body", pull.body, apiPull.body],
    ["base ref", pull.base?.ref, apiPull.baseRef],
    ["base SHA", pull.base?.sha, apiPull.baseSha],
    ["head ref", pull.head?.ref, apiPull.headRef],
    ["head SHA", pull.head?.sha, apiPull.headSha]
  ]) {
    if (eventValue !== apiValue) errors.push(`event ${label} does not match GitHub API evidence`);
  }

  const finalPull = evidence.finalPullRequest ?? {};
  if (["number", "body", "baseRef", "baseSha", "headRef", "headSha", "changedFilesCount"].some(
    (field) => apiPull[field] !== finalPull[field]
  )) {
    errors.push("PR metadata, body, or changed-file count changed during policy evidence collection");
  }
  if (
    !Number.isInteger(apiPull.changedFilesCount) ||
    apiPull.changedFilesCount < 0 ||
    evidence.changedFiles?.length !== apiPull.changedFilesCount
  ) {
    errors.push("GitHub changed-file pagination count does not match the PR snapshot");
  }

  const comparison = evidence.comparison ?? {};
  if (comparison.requestedBaseSha !== apiPull.baseSha || comparison.baseCommitSha !== apiPull.baseSha) {
    errors.push("comparison base does not match the PR base SHA");
  }
  if (comparison.requestedHeadSha !== apiPull.headSha) {
    errors.push("comparison head does not match the PR head SHA");
  }
  if (
    comparison.status !== "ahead" ||
    comparison.mergeBaseSha !== apiPull.baseSha ||
    comparison.behindBy !== 0 ||
    !Number.isInteger(comparison.aheadBy) ||
    comparison.aheadBy < 1
  ) {
    errors.push("PR head must be a non-empty descendant of the current base SHA");
  }
}

export function validatePullRequestPolicy({ event, evidence, registeredAgents }) {
  const errors = [];
  const pull = event?.pull_request;
  if (!pull) return ["event does not contain pull_request"];

  const parsed = parsePullRequestBody(evidence?.pullRequest?.body ?? "");
  errors.push(...parsed.errors);
  const author = parsed.scalars["Author-Agent"] ?? "";
  const reviewer = parsed.scalars["Reviewer-Agent"] ?? "";
  const declaredBase = parsed.scalars["Base-Commit"] ?? "";
  const risk = parsed.scalars.Risk ?? "";
  const northStarImpact = parsed.scalars["North-Star-Impact"] ?? "";
  const baseRef = pull.base?.ref ?? "";
  const baseSha = pull.base?.sha ?? "";
  const headRef = pull.head?.ref ?? "";
  const headSha = pull.head?.sha ?? "";

  if (event?.repository?.default_branch !== "main") errors.push("repository default branch must be main");
  if (baseRef !== "main") errors.push("PR base must be main");
  if (!AGENT_SEGMENT.test(author) || PLACEHOLDER.test(author)) {
    errors.push("Author-Agent is missing or invalid");
  }
  if (!(registeredAgents instanceof Set) || !registeredAgents.has(author)) {
    errors.push("Author-Agent is not registered in trusted agents/README.md");
  }
  if (reviewer !== "reviewer-merge-gate") errors.push("Reviewer-Agent must be reviewer-merge-gate");
  if (!(registeredAgents instanceof Set) || !registeredAgents.has(reviewer)) {
    errors.push("Reviewer-Agent is not registered in trusted agents/README.md");
  }
  if (author && reviewer === author) errors.push("author and reviewer agents must differ");
  if (!FULL_SHA.test(declaredBase)) errors.push("Base-Commit must be a 40-character lowercase SHA");
  if (!FULL_SHA.test(baseSha) || !FULL_SHA.test(headSha)) errors.push("event base/head SHAs must be full lowercase SHAs");
  if (declaredBase && baseSha && declaredBase !== baseSha) {
    errors.push("Base-Commit does not match the current PR base SHA");
  }

  const branchMatch = headRef.match(/^agent\/([a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)$/u);
  if (!branchMatch) errors.push("head branch must match agent/<agent-id>--<task>");
  else if (author && branchMatch[1] !== author) errors.push("head branch agent ID does not match Author-Agent");

  if (!(parsed.lists.Summary ?? []).some((entry) => meaningfulText(entry, 12))) {
    errors.push("Summary needs at least one meaningful list item");
  }
  validateSharedPaths(parsed.lists["Shared-Paths"] ?? [], evidence?.changedFiles, errors);
  validateValidation(parsed.lists.Validation ?? [], errors);
  validateRisk(risk, errors);
  if (!meaningfulText(northStarImpact, 12)) errors.push("North-Star-Impact needs a meaningful value");
  validateApiEvidence(event, evidence, errors);

  return [...new Set(errors)];
}

async function githubJson(url, token, fetchImpl) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28"
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetchImpl(url, {
    headers
  });
  if (!response.ok) throw new Error(`GitHub read API returned ${response.status} for ${new URL(url).pathname}`);
  return response.json();
}

function normalizePullRequest(pull) {
  return {
    number: pull?.number,
    body: pull?.body,
    changedFilesCount: pull?.changed_files,
    baseRef: pull?.base?.ref,
    baseSha: pull?.base?.sha,
    headRef: pull?.head?.ref,
    headSha: pull?.head?.sha
  };
}

export async function fetchGitHubPullRequestEvidence({
  apiUrl,
  repository,
  pullNumber,
  token,
  fetchImpl = globalThis.fetch
}) {
  if (!apiUrl || !repository || !Number.isInteger(pullNumber) || pullNumber < 1) {
    throw new Error("GitHub API URL, repository, and pull number are required");
  }
  const [owner, name, ...extra] = repository.split("/");
  if (!owner || !name || extra.length) throw new Error("GITHUB_REPOSITORY must be owner/name");
  const root = `${apiUrl.replace(/\/$/u, "")}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const pullUrl = `${root}/pulls/${pullNumber}`;
  const pull = await githubJson(pullUrl, token, fetchImpl);
  const baseSha = pull?.base?.sha;
  const headSha = pull?.head?.sha;
  if (!FULL_SHA.test(baseSha ?? "") || !FULL_SHA.test(headSha ?? "")) {
    throw new Error("GitHub PR API did not return full base/head SHAs");
  }
  const comparison = await githubJson(
    `${root}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}`,
    token,
    fetchImpl
  );
  const changedFiles = [];
  for (let page = 1; page <= 30; page += 1) {
    const files = await githubJson(`${root}/pulls/${pullNumber}/files?per_page=100&page=${page}`, token, fetchImpl);
    if (!Array.isArray(files)) throw new Error("GitHub PR files API returned a non-array result");
    changedFiles.push(...files.map(({ filename, previous_filename }) => ({ filename, previous_filename })));
    if (files.length < 100) break;
    if (page === 30) throw new Error("GitHub PR files exceed the supported 3000-file policy limit");
  }
  const finalPull = await githubJson(pullUrl, token, fetchImpl);
  return {
    pullRequest: normalizePullRequest(pull),
    finalPullRequest: normalizePullRequest(finalPull),
    comparison: {
      requestedBaseSha: baseSha,
      requestedHeadSha: headSha,
      status: comparison.status,
      aheadBy: comparison.ahead_by,
      behindBy: comparison.behind_by,
      baseCommitSha: comparison.base_commit?.sha,
      mergeBaseSha: comparison.merge_base_commit?.sha
    },
    changedFiles
  };
}

export async function verifyEventFile(eventPath, environment = process.env, fetchImpl = globalThis.fetch) {
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const registeredAgents = parseRegisteredAgents(
    readFileSync(new URL("../agents/README.md", import.meta.url), "utf8")
  );
  const evidence = await fetchGitHubPullRequestEvidence({
    apiUrl: environment.GITHUB_API_URL,
    repository: environment.GITHUB_REPOSITORY,
    pullNumber: event.number,
    token: environment.GITHUB_TOKEN,
    fetchImpl
  });
  const errors = validatePullRequestPolicy({ event, evidence, registeredAgents });
  if (errors.length) throw new Error(`Agent PR policy failed:\n- ${errors.join("\n- ")}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("GITHUB_EVENT_PATH is required");
    process.exitCode = 1;
  } else {
    verifyEventFile(eventPath).then(
      () => console.log("Agent PR policy: PASS"),
      (error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    );
  }
}
