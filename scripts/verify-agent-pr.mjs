import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const FULL_SHA = /^[0-9a-f]{40}$/;

function scalarField(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, "m"))?.[1] ?? null;
}

function hasRealValue(value) {
  return Boolean(value) && !/(replace|todo|tbd|<[^>]+>)/i.test(value);
}

function hasListItem(body, label) {
  const lines = body.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `${label}:`);
  if (start < 0) return false;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^(?:#{1,6}\s|[A-Za-z][A-Za-z-]*:)/u.test(line)) return false;
    if (line.startsWith("- ")) return hasRealValue(line.slice(2).trim());
    return false;
  }
  return false;
}

export function validatePullRequestPolicy(event) {
  const errors = [];
  const pull = event?.pull_request;
  if (!pull) return ["event does not contain pull_request"];

  const body = pull.body ?? "";
  const baseRef = pull.base?.ref ?? "";
  const baseSha = pull.base?.sha ?? "";
  const headRef = pull.head?.ref ?? "";
  const author = scalarField(body, "Author-Agent");
  const reviewer = scalarField(body, "Reviewer-Agent");
  const declaredBase = scalarField(body, "Base-Commit");
  const risk = scalarField(body, "Risk");

  if (baseRef !== "main") errors.push("PR base must be main");
  if (!AGENT_SEGMENT.test(author ?? "")) errors.push("Author-Agent is missing or invalid");
  if (reviewer !== "reviewer-merge-gate") {
    errors.push("Reviewer-Agent must be reviewer-merge-gate");
  }
  if (author && reviewer === author) errors.push("author and reviewer agents must differ");
  if (!FULL_SHA.test(declaredBase ?? "")) errors.push("Base-Commit must be a 40-character lowercase SHA");
  if (declaredBase && baseSha && declaredBase !== baseSha) {
    errors.push("Base-Commit does not match the current PR base SHA");
  }

  const branchMatch = headRef.match(/^agent\/([a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)$/u);
  if (!branchMatch) {
    errors.push("head branch must match agent/<agent-id>--<task>");
  } else if (author && branchMatch[1] !== author) {
    errors.push("head branch agent ID does not match Author-Agent");
  }

  if (!hasListItem(body, "Shared-Paths")) errors.push("Shared-Paths needs at least one real list item");
  if (!hasListItem(body, "Validation")) errors.push("Validation needs at least one real list item");
  if (!hasRealValue(risk)) errors.push("Risk needs a non-placeholder value");

  return errors;
}

export function verifyEventFile(eventPath) {
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const errors = validatePullRequestPolicy(event);
  if (errors.length) {
    throw new Error(`Agent PR policy failed:\n- ${errors.join("\n- ")}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("GITHUB_EVENT_PATH is required");
    process.exitCode = 1;
  } else {
    try {
      verifyEventFile(eventPath);
      console.log("Agent PR policy: PASS");
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}

