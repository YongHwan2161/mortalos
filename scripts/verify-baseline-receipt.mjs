import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = resolve(root, "evidence", "baseline", "s0-baseline.json");
const receiptBytes = await readFile(receiptPath);
const receipt = JSON.parse(receiptBytes);
const schema = JSON.parse(await readFile(resolve(root, "schemas", "baseline-receipt.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
assert.ok(validate(receipt), ajv.errorsText(validate.errors, { separator: "\n" }));

const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
assert.equal(
  receipt.dependency_lock_digest,
  digest(await readFile(resolve(root, "package-lock.json"))),
  "dependency lock digest mismatch"
);

for (const [path, expected] of Object.entries(receipt.artifact_digests)) {
  assert.equal(digest(await readFile(resolve(root, path))), expected, `artifact digest mismatch: ${path}`);
}

const requiredCommands = [
  "npm ci",
  "npm test",
  "npm run verify:lab",
  "npm run test:chromium",
  "npm run verify:transport",
  "npm run test:coverage",
  "npm audit --audit-level=moderate",
  "npm run verify:baseline"
];
const commands = new Map(receipt.commands.map((entry) => [entry.command, entry.status]));
for (const command of requiredCommands) {
  assert.equal(commands.get(command), "PASS", `required baseline command is not PASS: ${command}`);
}
assert.equal(receipt.status, "PASS");
assert.deepEqual(receipt.failures, []);
assert.ok(Date.parse(receipt.started_at) <= Date.parse(receipt.completed_at));

console.log(`MortalOS ${receipt.stage} baseline receipt: PASS`);
console.log(`- source commit: ${receipt.source_commit}`);
console.log(`- receipt digest: ${digest(receiptBytes)}`);
console.log(`- artifacts read back: ${Object.keys(receipt.artifact_digests).length}`);
