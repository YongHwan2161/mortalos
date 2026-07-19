import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
