import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { buildLab } from "./build-lab.mjs";

const execute = promisify(execFile);
const project = process.env.MORTALOS_PAGES_PROJECT ?? "mortalos-lab-yonghwan2161";
const branch = "main";
const commit = process.env.MORTALOS_SOURCE_COMMIT;

if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error("MORTALOS_SOURCE_COMMIT must name the exact lowercase 40-character commit being deployed");
}
if (!/^[a-z][a-z0-9-]{4,57}[a-z0-9]$/.test(project)) {
  throw new Error("MORTALOS_PAGES_PROJECT has an invalid Cloudflare Pages project name");
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
const projects = JSON.parse(listed.stdout);
if (!projects.some((entry) => entry.name === project)) {
  await execute(process.execPath, [
    wrangler, "pages", "project", "create", project,
    "--production-branch", branch
  ], { env: environment });
}
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
