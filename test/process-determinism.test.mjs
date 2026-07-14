import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("two fresh processes emit byte-identical H2 traces", async () => {
  const options = { cwd: new URL("..", import.meta.url), encoding: "utf8" };
  const [left, right] = await Promise.all([
    run(process.execPath, ["scripts/demo-trace.mjs"], options),
    run(process.execPath, ["scripts/demo-trace.mjs"], options)
  ]);
  assert.equal(left.stdout, right.stdout);
  assert.equal(left.stderr, "");
  assert.match(left.stdout, /"trace_sha256"/);
});
