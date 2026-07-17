import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { buildLab } from "./build-lab.mjs";

const execute = promisify(execFile);
const PAGES_PROJECT_KEYS = Object.freeze([
  "Git Provider",
  "Last Modified",
  "Project Domains",
  "Project Name"
]);
const PAGES_PROJECT_NAME = /^[a-z][a-z0-9-]{4,57}[a-z0-9]$/;

function putPagesSecret({ environment, project, value, wrangler }) {
  return new Promise((resolveSecret, rejectSecret) => {
    const child = spawn(process.execPath, [
      wrangler, "pages", "secret", "put", "OPENAI_API_KEY", "--project-name", project
    ], { env: environment, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.resume();
    child.stderr.resume();
    child.once("error", rejectSecret);
    child.stdin.once("error", rejectSecret);
    child.once("close", (code) => {
      if (code === 0) resolveSecret();
      else rejectSecret(new Error(`Wrangler failed to configure OPENAI_API_KEY secret (exit ${code})`));
    });
    child.stdin.end(`${value}\n`);
  });
}

function equalStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function pagesProjectExists(stdout, project) {
  let projects;
  try {
    projects = JSON.parse(stdout);
  } catch (error) {
    throw new Error("Wrangler Pages project list did not return valid JSON", { cause: error });
  }
  if (!Array.isArray(projects)) {
    throw new Error("Wrangler Pages project list JSON must be an array");
  }
  for (const [index, entry] of projects.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Wrangler Pages project list entry ${index} must be an object`);
    }
    const keys = Object.keys(entry).sort();
    if (!equalStrings(keys, PAGES_PROJECT_KEYS)) {
      throw new Error(`Wrangler Pages project list entry ${index} has an unexpected schema`);
    }
    if (
      typeof entry["Project Name"] !== "string" ||
      !PAGES_PROJECT_NAME.test(entry["Project Name"]) ||
      typeof entry["Project Domains"] !== "string" ||
      !["Yes", "No"].includes(entry["Git Provider"]) ||
      typeof entry["Last Modified"] !== "string" ||
      entry["Last Modified"].length === 0
    ) {
      throw new Error(`Wrangler Pages project list entry ${index} contains invalid field values`);
    }
  }
  return projects.some((entry) => entry["Project Name"] === project);
}

export async function deployLab() {
  const project = process.env.MORTALOS_PAGES_PROJECT ?? "mortalos-lab-yonghwan2161";
  const branch = "main";
  const commit = process.env.MORTALOS_SOURCE_COMMIT;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("MORTALOS_SOURCE_COMMIT must name the exact lowercase 40-character commit being deployed");
  }
  if (!PAGES_PROJECT_NAME.test(project)) {
    throw new Error("MORTALOS_PAGES_PROJECT has an invalid Cloudflare Pages project name");
  }
  if (typeof openAiKey !== "string" || openAiKey.length < 20 || openAiKey.length > 512 || /[\r\n]/.test(openAiKey)) {
    throw new Error("OPENAI_API_KEY must be supplied as a single-line deployment secret");
  }

  const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
  const environment = {
    ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? "/tmp/mortalos-wrangler-config"
  };
  const head = (await execute("git", ["rev-parse", "HEAD"])).stdout.trim();
  if (head !== commit) {
    throw new Error(`deployment source commit ${commit} does not equal checked-out HEAD ${head}`);
  }
  const status = (await execute("git", ["status", "--porcelain=v1", "--untracked-files=all"])).stdout;
  if (status !== "") {
    throw new Error("deployment source has uncommitted files; commit and review the exact artifact source first");
  }

  const { manifest } = await buildLab({ sourceCommit: commit });
  const listed = await execute(process.execPath, [wrangler, "pages", "project", "list", "--json"], {
    env: environment,
    maxBuffer: 4 * 1024 * 1024
  });
  if (!pagesProjectExists(listed.stdout, project)) {
    await execute(process.execPath, [
      wrangler, "pages", "project", "create", project,
      "--production-branch", branch
    ], { env: environment });
  }
  await putPagesSecret({ environment, project, value: openAiKey, wrangler });
  console.log("MortalOS Lab OpenAI secret: configured in Cloudflare Pages");
  const deployment = await execute(process.execPath, [
    wrangler, "pages", "deploy", "dist/lab",
    "--project-name", project,
    "--branch", branch,
    "--commit-hash", commit,
    "--commit-dirty=false"
  ], { env: environment, maxBuffer: 4 * 1024 * 1024 });

  process.stdout.write(deployment.stdout);
  process.stderr.write(deployment.stderr);
  console.log(`MortalOS Lab deployment: PASS (${manifest.asset_digest})`);
  console.log(`- canonical URL: https://${project}.pages.dev`);
  console.log(`- source commit: ${commit}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await deployLab();
}
