import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("security/async-entrypoints.json", root), "utf8"));
assert.equal(registry.format, "mortalos-async-security-entrypoints/1");
assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 4);

for (const entry of registry.entries) {
  const source = await readFile(new URL(entry.file, root), "utf8");
  const start = source.indexOf(entry.entrypoint);
  assert.notEqual(start, -1, `${entry.file}: missing ${entry.entrypoint}`);
  const ownership = source.indexOf(entry.ownership_marker, start);
  const firstAwait = source.indexOf("await ", start);
  assert.notEqual(ownership, -1, `${entry.file}: missing ownership marker`);
  assert.notEqual(firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownership < firstAwait,
    `${entry.file}: ${entry.entrypoint} reaches await before transitive ownership`
  );
}

console.log(`MortalOS async security boundary audit: PASS (${registry.entries.length} entrypoints)`);
