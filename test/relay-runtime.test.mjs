import { env, exports } from "cloudflare:workers";
import {
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { canonicalBytes } from "../src/index.mjs";
import { createRelayMessage } from "../src/transport/protocol.mjs";

const ROOM = "BBBBBBBBBBBBBBBBBBBBBB";

function publicMessage(ordinal = 0) {
  return canonicalBytes(createRelayMessage({
    envelope: { kind: ordinal === 0 ? "mortalos.genesis" : "mortalos.pulse", ordinal },
    payload: { ordinal }
  }));
}

function relayRequest(path, init = {}) {
  return exports.default.fetch(`https://relay.mortal-os.com${path}`, {
    ...init,
    headers: {
      origin: "https://mortal-os.com",
      ...(init.headers ?? {})
    }
  });
}

describe("MortalOSRoom runtime", () => {
  it("persists canonical public frames across eviction and deduplicates atomically", async () => {
    const stub = env.MORTALOS_ROOM.getByName(ROOM);
    const bytes = publicMessage();
    const first = await stub.publish(ROOM, bytes);
    expect(first.duplicate).toBe(false);
    expect(first.frame.sequence).toBe(1);
    const duplicate = await stub.publish(ROOM, bytes);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.frame).toEqual(first.frame);
    expect(await stub.fetchRange(ROOM, 0, 128)).toEqual([first.frame]);

    await runInDurableObject(stub, async (_instance, state) => {
      const tables = state.storage.sql.exec(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).toArray().map((row) => row.name);
      expect(tables).toContain("messages");
      expect(tables).toContain("rate_limits");
      expect(tables).toContain("room_metadata");
      const migration = state.storage.sql.exec(
        "SELECT id FROM _sql_schema_migrations ORDER BY id"
      ).toArray();
      expect(migration).toEqual([{ id: 1 }]);
    });

    await evictDurableObject(stub);
    expect(await stub.fetchRange(ROOM, 0, 128)).toEqual([first.frame]);
  });

  it("alarm expiry removes durable messages and survives an explicit runtime restart", async () => {
    const room = "CCCCCCCCCCCCCCCCCCCCCC";
    const stub = env.MORTALOS_ROOM.getByName(room);
    await stub.publish(room, publicMessage());
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec("UPDATE messages SET expires_at = 0");
      await state.storage.setAlarm(Date.now() + 60_000);
    });
    await evictDurableObject(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await stub.fetchRange(room, 0, 128)).toEqual([]);
  });

  it("ingress enforces exact origin, media type, canonical schema, size, and range ceilings", async () => {
    const wrongOrigin = await exports.default.fetch(
      `https://relay.mortal-os.com/v1/rooms/${ROOM}/messages`,
      { headers: { origin: "https://attacker.example" } }
    );
    expect(wrongOrigin.status).toBe(403);

    const wrongType = await relayRequest(`/v1/rooms/${ROOM}/messages`, {
      method: "POST",
      body: publicMessage(),
      headers: { "content-type": "text/plain" }
    });
    expect(wrongType.status).toBe(400);

    const unknownAuthorityHint = await relayRequest(`/v1/rooms/${ROOM}/messages`, {
      method: "POST",
      body: canonicalBytes({ accepted: true, format: "mortalos-relay-message/1", record: {} }),
      headers: { "content-type": "application/json" }
    });
    expect(unknownAuthorityHint.status).toBe(400);

    const oversized = await relayRequest(`/v1/rooms/${ROOM}/messages`, {
      method: "POST",
      body: new Uint8Array(64 * 1024 + 1),
      headers: { "content-type": "application/json" }
    });
    expect(oversized.status).toBe(413);

    const invalidRange = await relayRequest(`/v1/rooms/${ROOM}/messages?after=-1`);
    expect(invalidRange.status).toBe(400);
  });
});
