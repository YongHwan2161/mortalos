import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("security/async-entrypoints.json", root), "utf8"));
assert.equal(registry.format, "mortalos-async-security-entrypoints/1");
assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 7);
assert.ok(Array.isArray(registry.export_scopes) && registry.export_scopes.length >= 3);

function functionBody(source, start, label) {
  const signatureClose = source.indexOf(") {", start);
  const open = signatureClose === -1 ? -1 : signatureClose + 2;
  assert.notEqual(open, -1, `${label}: missing function body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`${label}: unterminated function body`);
}

const registeredExports = new Set(
  registry.entries
    .filter(({ entrypoint }) => entrypoint.startsWith("export async function "))
    .map(({ file, entrypoint }) => `${file}:${entrypoint.split(" ").at(-1)}`)
);
const discoveredExports = new Set();
for (const file of registry.export_scopes) {
  const source = await readFile(new URL(file, root), "utf8");
  for (const match of source.matchAll(/export\s+async\s+function\s+([A-Za-z_$][\w$]*)/gu)) {
    discoveredExports.add(`${file}:${match[1]}`);
  }
}
assert.deepEqual(
  [...registeredExports].sort(),
  [...discoveredExports].sort(),
  "every exported async function in the security scope must be registered"
);

for (const entry of registry.entries) {
  const source = await readFile(new URL(entry.file, root), "utf8");
  const start = source.indexOf(entry.entrypoint);
  assert.notEqual(start, -1, `${entry.file}: missing ${entry.entrypoint}`);
  const body = functionBody(source, start, `${entry.file}:${entry.entrypoint}`);
  const ownership = body.indexOf(entry.ownership_marker);
  const firstAwait = body.indexOf("await ");
  assert.notEqual(ownership, -1, `${entry.file}: missing ownership marker`);
  assert.notEqual(firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownership < firstAwait,
    `${entry.file}: ${entry.entrypoint} reaches await before transitive ownership`
  );
  const testSource = await readFile(new URL(entry.test_file, root), "utf8");
  assert.match(
    testSource,
    new RegExp(entry.test_marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    `${entry.file}: missing linked hostile-mutation regression`
  );
}

console.log(`MortalOS async security boundary audit: PASS (${registry.entries.length} entrypoints)`);
