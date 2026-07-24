import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveWindowsWorkerdBinary } from "../scripts/resolve-workerd-binary.mjs";
import { RELAY_RATE_POLICY, relayTwoBrowserRequestBudget } from "../src/transport/relay-policy.mjs";

test("relay cadence keeps two active browsers plus an explicit burst below the shared room ceiling", () => {
  const budget = relayTwoBrowserRequestBudget();
  assert.deepEqual(budget, {
    burst: 48,
    ceiling: 300,
    per_endpoint: 102,
    steady_state: 204,
    worst_case: 252
  });
  assert.ok(budget.worst_case < RELAY_RATE_POLICY.room_requests_per_minute);
});

test("relay Worker is room-sharded, SQLite-backed, bounded, hibernatable, and authority-neutral", async () => {
  const source = await readFile(new URL("../relay/worker.mjs", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(new URL("../relay/wrangler.jsonc", import.meta.url), "utf8"));
  assert.match(source, /MORTALOS_ROOM\.getByName\(roomId\)/);
  assert.match(source, /ctx\.storage\.sql\.exec/);
  assert.match(source, /ctx\.acceptWebSocket\(pair\[1\]\)/);
  assert.match(source, /await this\.publish[\s\S]*?peer\.send/);
  assert.match(source, /await this\.ctx\.storage\.setAlarm/);
  assert.match(source, /RELAY_LIMITS\.room_messages/);
  assert.match(source, /RELAY_LIMITS\.room_bytes/);
  assert.doesNotMatch(source, /accepted\s*[:=]|verdict\s*[:=]|private[_-]?key/i);
  assert.deepEqual(config.durable_objects.bindings, [{ name: "MORTALOS_ROOM", class_name: "MortalOSRoom" }]);
  assert.deepEqual(config.migrations, [{ tag: "v1", new_sqlite_classes: ["MortalOSRoom"] }]);
  assert.equal(config.routes[0].pattern, "relay.mortal-os.com");
  assert.equal(config.env.preview.name, "mortalos-relay-preview");
  assert.notEqual(config.env.preview.vars.ALLOWED_ORIGIN, config.vars.ALLOWED_ORIGIN);
});

test("Windows workerd resolution prefers the pool-local compatible binary when both layouts exist", async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-workerd-layout-"));
  const nested = join(
    root,
    "node_modules",
    "@cloudflare",
    "vitest-pool-workers",
    "node_modules",
    "@cloudflare",
    "workerd-windows-64",
    "bin",
    "workerd.exe"
  );
  const hoisted = join(
    root,
    "node_modules",
    "@cloudflare",
    "workerd-windows-64",
    "bin",
    "workerd.exe"
  );
  try {
    await mkdir(join(nested, ".."), { recursive: true });
    await mkdir(join(hoisted, ".."), { recursive: true });
    await writeFile(nested, "pool-local");
    await writeFile(hoisted, "hoisted");
    assert.equal(await resolveWindowsWorkerdBinary(root), nested);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Windows workerd resolution falls back to the hoisted binary and rejects a missing install", async () => {
  const root = await mkdtemp(join(tmpdir(), "mortalos-workerd-layout-"));
  const hoisted = join(
    root,
    "node_modules",
    "@cloudflare",
    "workerd-windows-64",
    "bin",
    "workerd.exe"
  );
  try {
    await mkdir(join(hoisted, ".."), { recursive: true });
    await writeFile(hoisted, "hoisted");
    assert.equal(await resolveWindowsWorkerdBinary(root), hoisted);
    await rm(hoisted, { force: true });
    await assert.rejects(resolveWindowsWorkerdBinary(root), /installed workerd Windows binary was not found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
