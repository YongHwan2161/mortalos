import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import {
  analyzeFunctionOwnership,
  analyzePostAwaitBorrowedIdentifiers,
  discoverExportedAsyncSecurityEntrypoints,
  findSecurityEntrypoint,
  parseSecurityModule
} from "./security-boundary-ast.mjs";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("security/async-entrypoints.json", root), "utf8"));
assert.equal(registry.format, "mortalos-async-security-entrypoints/2");
assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 7);
assert.ok(Array.isArray(registry.export_scopes) && registry.export_scopes.length >= 9);
assert.ok(Array.isArray(registry.classifications));

const SECURITY_EXPORT_SCOPES = Object.freeze([
  "lab/participant/webcrypto-key-store.mjs",
  "lab/storage/durable-document.mjs",
  "src/confidential/counter.mjs",
  "src/confidential/keys.mjs",
  "src/confidential/package.mjs",
  "src/confidential/recovery.mjs",
  "src/distributed/quorum-counter-store.mjs",
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
const DEEP_OWNERSHIP_PRIMITIVES = new Set([
  "clone",
  "confidentialEpochStoreCapability",
  "copyBoundedOwnDataArray",
  "createUint8Array",
  "createWrapLabel",
  "decodeBase64Url",
  "decryptConfidentialPackageWithEpochKey",
  "ownChunkBytes",
  "ownDataArrayLength",
  "ownCryptoInputBytes",
  "ownOptionalCryptoInputBytes",
  "ownSigningBytes",
  "recoverStatePackage",
  "reserveCounterAuthority",
  "resourcePlaintextParts",
  "snapshotConfidentialCustodians",
  "snapshotDataMethod",
  "snapshotNamedOwnDataValues",
  "snapshotObservedCounterAuthorityEquivocation",
  "snapshotRecoveryInvocation",
  "taggedBytes",
  "unwrapEpochKey",
  "verifyConfidentialPackage",
  "verifyConfidentialRotationAuthorization",
  "verifyStatePackage"
]);

assert.deepEqual(
  [...registry.export_scopes].sort(),
  [...SECURITY_EXPORT_SCOPES].sort(),
  "security export scopes are verifier-owned, not registry-extensible"
);
const registeredEntrypoints = new Set(
  registry.entries.map(({ file, entrypoint }) => `${file}:${entrypoint}`)
);
for (const required of REQUIRED_ENTRYPOINTS) {
  assert.ok(registeredEntrypoints.has(required), `missing verifier-required entrypoint ${required}`);
}

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

export function postAwaitBorrowedIdentifiers(source, forbidden, ownershipPrimitives = []) {
  return analyzePostAwaitBorrowedIdentifiers(source, forbidden, ownershipPrimitives);
}

const discoveredExports = new Set();
for (const file of SECURITY_EXPORT_SCOPES) {
  const source = await readFile(new URL(file, root), "utf8");
  const ast = parseSecurityModule(source);
  for (const entrypoint of discoverExportedAsyncSecurityEntrypoints(ast)) {
    discoveredExports.add(`${file}:${entrypoint}`);
  }
}
const classifiedExports = new Set([
  ...registry.entries
    .map(({ file, entrypoint }) => `${file}:${entrypoint}`)
    .filter((entrypoint) => discoveredExports.has(entrypoint)),
  ...registry.classifications.map(({ file, entrypoint }) => `${file}:${entrypoint}`)
]);
assert.deepEqual(
  [...classifiedExports].sort(),
  [...discoveredExports].sort(),
  "every exported async security function and class method must be audited or explicitly classified"
);
const CLASSIFICATION_MODES = new Set([
  "branded-immutable-capability",
  "delegates-to-audited-boundary",
  "module-private-owned-state",
  "no-borrowed-mutable-input"
]);
for (const classification of registry.classifications) {
  assert.ok(CLASSIFICATION_MODES.has(classification.mode), "recognized classification mode required");
  assert.ok(
    typeof classification.reason === "string" && classification.reason.length >= 20,
    `${classification.file}: classification requires a concrete review reason`
  );
}

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
  assert.ok(
    Array.isArray(entry.ownership_primitives) && entry.ownership_primitives.length > 0,
    `${entry.file}: allowlisted ownership primitive is required`
  );
  for (const primitive of entry.ownership_primitives) {
    assert.ok(
      DEEP_OWNERSHIP_PRIMITIVES.has(primitive),
      `${entry.file}: unrecognized ownership primitive ${primitive}`
    );
  }
  const audit = analyzeFunctionOwnership(
    functionNode,
    entry.post_await_forbidden,
    entry.ownership_primitives
  );
  const body = source.slice(functionNode.body.start + 1, functionNode.body.end - 1);
  const bodyTokens = tokenizeJavaScript(body);
  const ownershipPositions = entry.ownership_primitives.map((primitive) =>
    tokenSequenceIndex(bodyTokens, markerTokens(primitive))
  );
  assert.ok(
    ownershipPositions.every((position) => position !== -1),
    `${entry.file}: missing allowlisted ownership primitive call`
  );
  assert.notEqual(audit.firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownershipPositions.every((position) =>
      functionNode.body.start + 1 + bodyTokens[position].start < audit.boundary),
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

console.log(
  `MortalOS async security boundary audit: PASS (${registry.entries.length} direct / ` +
  `${discoveredExports.size} auto-discovered exports and class methods)`
);
