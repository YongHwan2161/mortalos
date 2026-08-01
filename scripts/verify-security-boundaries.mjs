import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import {
  analyzeFunctionOwnership,
  analyzePostAwaitBorrowedIdentifiers,
  findSecurityEntrypoint,
  parseSecurityModule
} from "./security-boundary-ast.mjs";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("security/async-entrypoints.json", root), "utf8"));
assert.equal(registry.format, "mortalos-async-security-entrypoints/1");
assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 7);
assert.ok(Array.isArray(registry.export_scopes) && registry.export_scopes.length >= 3);

const SECURITY_EXPORT_SCOPES = Object.freeze([
  "src/confidential/recovery.mjs",
  "src/state/recovery.mjs",
  "src/transport/chunk-data-plane.mjs"
]);
const REQUIRED_ENTRYPOINTS = Object.freeze([
  "lab/storage/durable-store.mjs:async #signDurably",
  "src/confidential/recovery.mjs:export async function createConfidentialStatePackage",
  "src/confidential/recovery.mjs:export async function recoverAndDecryptConfidentialState",
  "src/confidential/recovery.mjs:export async function rotateConfidentialState",
  "src/state/recovery.mjs:export async function recoverStatePackage",
  "src/transport/chunk-data-plane.mjs:export async function publishStateChunk",
  "src/transport/chunk-data-plane.mjs:export async function publishStatePackageChunks"
]);

assert.deepEqual(
  [...registry.export_scopes].sort(),
  [...SECURITY_EXPORT_SCOPES].sort(),
  "security export scopes are verifier-owned, not registry-extensible"
);
assert.deepEqual(
  registry.entries.map(({ file, entrypoint }) => `${file}:${entrypoint}`).sort(),
  [...REQUIRED_ENTRYPOINTS].sort(),
  "security entrypoint inventory is verifier-owned"
);

export function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      assert.notEqual(close, -1, "unterminated block comment");
      index = close + 2;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const current = source[index];
        index += 1;
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === quote) break;
      }
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/u)?.[0];
    if (identifier) {
      tokens.push({ end: index + identifier.length, start: index, value: identifier });
      index += identifier.length;
      continue;
    }
    tokens.push({ end: index + 1, start: index, value: character });
    index += 1;
  }
  return tokens;
}

function tokenSequenceIndex(tokens, sequence, start = 0) {
  for (let index = start; index <= tokens.length - sequence.length; index += 1) {
    if (sequence.every((value, offset) => tokens[index + offset].value === value)) return index;
  }
  return -1;
}

function markerTokens(marker) {
  return tokenizeJavaScript(marker).map(({ value }) => value);
}

async function runtimeModules(relativeDirectory) {
  const discovered = [];
  const entries = await readdir(new URL(`${relativeDirectory}/`, root), {
    withFileTypes: true
  });
  for (const entry of entries) {
    const relative = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) discovered.push(...await runtimeModules(relative));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) discovered.push(relative);
  }
  return discovered;
}

export function postAwaitBorrowedIdentifiers(source, forbidden) {
  return analyzePostAwaitBorrowedIdentifiers(source, forbidden);
}

const registeredExports = new Set(
  registry.entries
    .filter(({ entrypoint }) => entrypoint.startsWith("export async function "))
    .map(({ file, entrypoint }) => `${file}:${entrypoint.split(" ").at(-1)}`)
);
const discoveredExports = new Set();
for (const file of SECURITY_EXPORT_SCOPES) {
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

const RAW_DURABLE_CAPABILITY_CONSUMERS = new Set(["lab/storage/durable-store.mjs"]);
for (const file of (await Promise.all(
  ["cli", "lab", "sdk", "src"].map(runtimeModules)
)).flat()) {
  const source = await readFile(new URL(file, root), "utf8");
  const identifiers = new Set(tokenizeJavaScript(source).map(({ value }) => value));
  if (
    (
      identifiers.has("readPrivateDurableDocument") ||
      identifiers.has("commitPrivateDurableDocument") ||
      identifiers.has("durableStoreCapability")
    ) &&
    !RAW_DURABLE_CAPABILITY_CONSUMERS.has(file)
  ) {
    assert.fail(`${file}: raw durable capability escaped its endpoint/storage modules`);
  }
}

for (const entry of registry.entries) {
  const source = await readFile(new URL(entry.file, root), "utf8");
  const ast = parseSecurityModule(source);
  const functionNode = findSecurityEntrypoint(ast, entry.entrypoint);
  assert.ok(functionNode, `${entry.file}: missing ${entry.entrypoint}`);
  const body = source.slice(functionNode.body.start + 1, functionNode.body.end - 1);
  const bodyTokens = tokenizeJavaScript(body);
  const ownership = tokenSequenceIndex(bodyTokens, markerTokens(entry.ownership_marker));
  const audit = analyzeFunctionOwnership(functionNode, entry.post_await_forbidden);
  const ownershipPosition = functionNode.body.start + 1 + bodyTokens[ownership]?.start;
  assert.notEqual(ownership, -1, `${entry.file}: missing ownership marker`);
  assert.notEqual(audit.firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownershipPosition < audit.firstAwait,
    `${entry.file}: ${entry.entrypoint} reaches await before transitive ownership`
  );
  assert.ok(
    Array.isArray(entry.post_await_forbidden) && entry.post_await_forbidden.length > 0,
    `${entry.file}: post-await borrowed-identifier policy is required`
  );
  const firstAwaitBoundary = audit.boundary;
  assert.notEqual(
    firstAwaitBoundary,
    -1,
    `${entry.file}: first await statement must have an auditable boundary`
  );
  assert.deepEqual(
    audit.identifiers,
    [],
    `${entry.file}: ${entry.entrypoint} re-reads borrowed identifiers after its first await`
  );
  const testSource = await readFile(new URL(entry.test_file, root), "utf8");
  assert.match(
    testSource,
    new RegExp(entry.test_marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    `${entry.file}: missing linked hostile-mutation regression`
  );
}

console.log(`MortalOS async security boundary audit: PASS (${registry.entries.length} entrypoints)`);
