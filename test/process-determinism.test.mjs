import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("two fresh processes emit the committed byte-identical H2 golden trace", async () => {
  const options = { cwd: new URL("..", import.meta.url), encoding: "utf8" };
  const [left, right, expectedText] = await Promise.all([
    run(process.execPath, ["scripts/demo-trace.mjs"], options),
    run(process.execPath, ["scripts/demo-trace.mjs"], options),
    readFile(new URL("./vectors/h2-trace.expected.json", import.meta.url), "utf8")
  ]);
  assert.equal(left.stdout, right.stdout);
  assert.equal(left.stderr, "");
  assert.equal(left.stdout, expectedText);
  assert.match(left.stdout, /"trace_sha256"/);
});
