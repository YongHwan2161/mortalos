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
const D1_DATABASE_NAME = /^[a-z][a-z0-9-]{2,63}$/;
const MAX_WRANGLER_DIAGNOSTIC_BYTES = 16_384;

function secretValues(environment, extra = []) {
  return [
    ...extra,
    environment.CLOUDFLARE_API_TOKEN,
    environment.OPENAI_API_KEY,
    environment.SAFETY_IDENTIFIER_SECRET
  ].filter((value) => typeof value === "string" && value.length >= 8);
}

export function sanitizeWranglerDiagnostic(input, secrets = []) {
  let diagnostic = String(input ?? "");
  for (const secret of secrets) diagnostic = diagnostic.replaceAll(secret, "[REDACTED]");
  diagnostic = diagnostic
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]{16,}/gi, "$1[REDACTED]")
    .trim();
  if (diagnostic.length > MAX_WRANGLER_DIAGNOSTIC_BYTES) {
    return `${diagnostic.slice(0, MAX_WRANGLER_DIAGNOSTIC_BYTES)}\n[diagnostic truncated]`;
  }
  return diagnostic;
}

function capturedStream(stream) {
  let output = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    if (output.length >= MAX_WRANGLER_DIAGNOSTIC_BYTES) return;
    output += chunk.slice(0, MAX_WRANGLER_DIAGNOSTIC_BYTES - output.length);
  });
  return () => output;
}

async function executeWrangler({ args, environment, operation, wrangler }) {
  try {
    return await execute(process.execPath, [wrangler, ...args], {
      env: environment,
      maxBuffer: 4 * 1024 * 1024
    });
  } catch (error) {
    const exit = Number.isInteger(error?.code) ? ` (exit ${error.code})` : "";
    const diagnostic = sanitizeWranglerDiagnostic(
      `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`,
      secretValues(environment)
    );
    throw new Error(`Wrangler ${operation} failed${exit}${diagnostic ? `\n${diagnostic}` : ""}`);
  }
}

function putPagesSecret({ environment, name, project, value, wrangler }) {
  return new Promise((resolveSecret, rejectSecret) => {
    const child = spawn(process.execPath, [
      wrangler, "pages", "secret", "put", name, "--project-name", project
    ], { env: environment, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = capturedStream(child.stdout);
    const stderr = capturedStream(child.stderr);
    child.once("error", rejectSecret);
    child.stdin.once("error", rejectSecret);
    child.once("close", (code) => {
      if (code === 0) resolveSecret();
      else {
        const secrets = secretValues(environment, [value]);
        const diagnostic = sanitizeWranglerDiagnostic(`${stdout()}\n${stderr()}`, secrets);
        rejectSecret(new Error(
          `Wrangler failed to configure ${name} secret (exit ${code})${diagnostic ? `\n${diagnostic}` : ""}`
        ));
      }
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
  const database = process.env.MORTALOS_D1_DATABASE ?? "mortalos-lab-rate-limit";
  const branch = "main";
  const commit = process.env.MORTALOS_SOURCE_COMMIT;
  const openAiKey = process.env.OPENAI_API_KEY;
  const safetyIdentifierSecret = process.env.SAFETY_IDENTIFIER_SECRET;

  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("MORTALOS_SOURCE_COMMIT must name the exact lowercase 40-character commit being deployed");
  }
  if (!PAGES_PROJECT_NAME.test(project)) {
    throw new Error("MORTALOS_PAGES_PROJECT has an invalid Cloudflare Pages project name");
  }
  if (!D1_DATABASE_NAME.test(database)) {
    throw new Error("MORTALOS_D1_DATABASE has an invalid Cloudflare D1 database name");
  }
  if (typeof openAiKey !== "string" || openAiKey.length < 20 || openAiKey.length > 512 || /[\r\n]/.test(openAiKey)) {
    throw new Error("OPENAI_API_KEY must be supplied as a single-line deployment secret");
  }
  if (
    typeof safetyIdentifierSecret !== "string" ||
    safetyIdentifierSecret.length < 32 ||
    safetyIdentifierSecret.length > 512 ||
    /[\r\n]/.test(safetyIdentifierSecret)
  ) {
    throw new Error("SAFETY_IDENTIFIER_SECRET must be supplied as a 32+ character single-line deployment secret");
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
  const listed = await executeWrangler({
    args: ["pages", "project", "list", "--json"],
    environment,
    operation: "Pages project list",
    wrangler
  });
  if (!pagesProjectExists(listed.stdout, project)) {
    await executeWrangler({
      args: ["pages", "project", "create", project, "--production-branch", branch],
      environment,
      operation: "Pages project creation",
      wrangler
    });
  }
  const migrations = await executeWrangler({
    args: ["d1", "migrations", "apply", database, "--remote"],
    environment,
    operation: "D1 migration",
    wrangler
  });
  process.stdout.write(sanitizeWranglerDiagnostic(
    `${migrations.stdout}${migrations.stderr}`,
    secretValues(environment)
  ));
  console.log("\nMortalOS Lab D1 rate-limit migration: PASS");
  await putPagesSecret({ environment, name: "OPENAI_API_KEY", project, value: openAiKey, wrangler });
  await putPagesSecret({
    environment,
    name: "SAFETY_IDENTIFIER_SECRET",
    project,
    value: safetyIdentifierSecret,
    wrangler
  });
  console.log("MortalOS Lab runtime secrets: configured in Cloudflare Pages");
  const deployment = await executeWrangler({
    args: [
      "pages", "deploy", "dist/lab",
      "--project-name", project,
      "--branch", branch,
      "--commit-hash", commit,
      "--commit-dirty=false"
    ],
    environment,
    operation: "Pages deployment",
    wrangler
  });

  const deploymentDiagnostic = sanitizeWranglerDiagnostic(
    `${deployment.stdout}${deployment.stderr}`,
    secretValues(environment)
  );
  if (deploymentDiagnostic) console.log(deploymentDiagnostic);
  console.log(`MortalOS Lab deployment: PASS (${manifest.asset_digest})`);
  console.log(`- canonical URL: https://${project}.pages.dev`);
  console.log(`- source commit: ${commit}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await deployLab();
}
