import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  canonicalize,
  decodeBase64Url,
  encodeBase64Url
} from "../src/index.mjs";
import { buildR1Corpus } from "../r1/javascript/corpus.mjs";
import { executeR1Operation, R1_LIMITS } from "../r1/javascript/wire.mjs";
import { r1PythonArguments } from "./r1-python-paths.mjs";

const expected = JSON.parse(
  await readFile(new URL("../test/vectors/r1-operations.json", import.meta.url), "utf8")
);
const generated = buildR1Corpus();
if (canonicalize(expected) !== canonicalize(generated)) {
  throw new Error("R1 committed corpus differs from JavaScript regeneration");
}
for (const entry of expected.entries) {
  const operation = decodeBase64Url(entry.operation);
  const expectedResult = entry.result;
  if (!operation || encodeBase64Url(executeR1Operation(operation)) !== expectedResult) {
    throw new Error(`R1 JavaScript replay mismatch: ${entry.id}`);
  }
}

const exact = new Uint8Array(R1_LIMITS.operation_bytes);
exact.fill(0x20);
const exactResult = JSON.parse(new TextDecoder().decode(executeR1Operation(exact)));
if (exactResult.outcome.code !== "R1_PARSE") {
  throw new Error("R1 exact-byte limit did not reach parsing");
}
const over = new Uint8Array(R1_LIMITS.operation_bytes + 1);
const overResult = JSON.parse(new TextDecoder().decode(executeR1Operation(over)));
if (overResult.outcome.code !== "R1_LIMIT") {
  throw new Error("R1 byte-limit +1 did not fail closed");
}

const python = spawnSync("python3", r1PythonArguments(import.meta.url), { encoding: "utf8" });
if (python.status !== 0) {
  throw new Error(`R1 Python differential failed: ${python.stderr || python.stdout}`);
}
console.log(`MortalOS R1 JavaScript/Python differential: PASS (${expected.entries.length} records)`);
