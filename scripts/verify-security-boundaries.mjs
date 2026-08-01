import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

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
  "lab/participant/durable-quorum-endpoint.mjs:async #signDurably",
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
  const tokens = tokenizeJavaScript(source);
  const firstAwait = tokens.findIndex(({ value }) => value === "await");
  if (firstAwait === -1) return { boundary: -1, firstAwait, identifiers: [] };
  const boundary = tokens.findIndex(
    ({ value }, index) => index > firstAwait && value === ";"
  );
  if (boundary === -1) return { boundary, firstAwait, identifiers: [] };
  const identifiers = [];
  for (let index = boundary + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!forbidden.includes(token.value)) continue;
    const previous = tokens[index - 1]?.value;
    const next = tokens[index + 1]?.value;
    if (previous !== "." && next !== ":") identifiers.push(token.value);
  }
  return { boundary, firstAwait, identifiers };
}

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

const RAW_DURABLE_CAPABILITY_CONSUMERS = new Set([
  "lab/participant/durable-quorum-endpoint.mjs",
  "lab/storage/durable-store.mjs"
]);
for (const file of (await Promise.all(
  ["cli", "lab", "sdk", "src"].map(runtimeModules)
)).flat()) {
  const source = await readFile(new URL(file, root), "utf8");
  const identifiers = new Set(tokenizeJavaScript(source).map(({ value }) => value));
  if (
    (identifiers.has("readDurableStore") || identifiers.has("writeDurableStore")) &&
    !RAW_DURABLE_CAPABILITY_CONSUMERS.has(file)
  ) {
    assert.fail(`${file}: raw durable capability escaped its endpoint/storage modules`);
  }
}

for (const entry of registry.entries) {
  const source = await readFile(new URL(entry.file, root), "utf8");
  const sourceTokens = tokenizeJavaScript(source);
  const entrypointIndex = tokenSequenceIndex(sourceTokens, markerTokens(entry.entrypoint));
  assert.notEqual(entrypointIndex, -1, `${entry.file}: missing ${entry.entrypoint}`);
  const start = sourceTokens[entrypointIndex].start;
  const body = functionBody(source, start, `${entry.file}:${entry.entrypoint}`);
  const bodyTokens = tokenizeJavaScript(body);
  const ownership = tokenSequenceIndex(bodyTokens, markerTokens(entry.ownership_marker));
  const firstAwait = bodyTokens.findIndex(({ value }) => value === "await");
  assert.notEqual(ownership, -1, `${entry.file}: missing ownership marker`);
  assert.notEqual(firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownership < firstAwait,
    `${entry.file}: ${entry.entrypoint} reaches await before transitive ownership`
  );
  assert.ok(
    Array.isArray(entry.post_await_forbidden) && entry.post_await_forbidden.length > 0,
    `${entry.file}: post-await borrowed-identifier policy is required`
  );
  const postAwait = postAwaitBorrowedIdentifiers(body, entry.post_await_forbidden);
  const firstAwaitBoundary = postAwait.boundary;
  assert.notEqual(
    firstAwaitBoundary,
    -1,
    `${entry.file}: first await statement must have an auditable boundary`
  );
  assert.deepEqual(
    postAwait.identifiers,
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
