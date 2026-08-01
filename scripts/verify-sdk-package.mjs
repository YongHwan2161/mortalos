import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1)));
const temporary = await mkdtemp(join(tmpdir(), "mortalos-sdk-consumer-"));
const npm = "npm";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: options.shell ?? false
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  const report = JSON.parse(run(npm, [
    "pack",
    "--json",
    "--pack-destination",
    temporary
  ], { shell: process.platform === "win32" }))[0];
  const archive = join(temporary, report.filename);
  assert.ok((await readFile(archive)).byteLength > 0);
  await writeFile(join(temporary, "package.json"), JSON.stringify({
    name: "mortalos-clean-consumer",
    private: true,
    type: "module"
  }), "utf8");
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], {
    cwd: temporary,
    shell: process.platform === "win32"
  });
  const output = run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core').then((m)=>console.log(JSON.stringify(Object.keys(m).sort())))"
  ], { cwd: temporary });
  const exports = JSON.parse(output.trim());
  assert.ok(exports.includes("verifyContinuityCapsule"));
  assert.equal(exports.some((name) => /private|authority|epochKey|decrypt/i.test(name)), false);
  const blocked = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core/src/confidential/package.mjs')"
  ], { cwd: temporary, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/u);
  console.log("MortalOS S5 clean package install: PASS");
} finally {
  await rm(temporary, { force: true, recursive: true });
}
