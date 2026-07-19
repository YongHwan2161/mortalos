import { env, exports } from "cloudflare:workers";
import {
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { canonicalBytes } from "../src/index.mjs";
import { createRelayMessage } from "../src/transport/protocol.mjs";
import { RELAY_RATE_POLICY } from "../src/transport/relay-policy.mjs";

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
    expect((await stub.fetchRange(ROOM, 0, 128)).frames).toEqual([first.frame]);

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
    expect((await stub.fetchRange(ROOM, 0, 128)).frames).toEqual([first.frame]);
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
    expect((await stub.fetchRange(room, 0, 128)).frames).toEqual([]);
  });

  it("admits every valid room operation and returns canonical 429 for duplicate floods", async () => {
    const floodRoom = "DDDDDDDDDDDDDDDDDDDDDD";
    const floodPath = `/v1/rooms/${floodRoom}/messages`;
    const body = publicMessage();
    const floodStub = env.MORTALOS_ROOM.getByName(floodRoom);
    expect((await floodStub.publish(floodRoom, body)).duplicate).toBe(false);
    await runInDurableObject(floodStub, async (_instance, state) => {
      const bucket = Math.floor(Date.now() / 60_000);
      state.storage.sql.exec("DELETE FROM rate_limits");
      state.storage.sql.exec(
        "INSERT INTO rate_limits(bucket, request_count) VALUES (?, ?)",
        bucket,
        RELAY_RATE_POLICY.room_requests_per_minute - 1
      );
    });
    const admittedAtCeiling = await relayRequest(floodPath, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    expect(admittedAtCeiling.status).toBe(200);
    const limited = await relayRequest(floodPath, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" }
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("access-control-allow-origin")).toBe("https://mortal-os.com");
    expect(await limited.text()).toBe('{"code":"RELAY_RATE","status":"reject"}');

    const operationRoom = "EEEEEEEEEEEEEEEEEEEEEE";
    const stub = env.MORTALOS_ROOM.getByName(operationRoom);
    expect((await stub.fetchRange(operationRoom, 0, 128)).frames).toEqual([]);
    expect((await stub.presence(operationRoom)).endpoints).toEqual([]);
    await stub.touchPresence(operationRoom, "endpoint-a");
    const connection = await relayRequest(`/v1/rooms/${operationRoom}/connect?endpoint=endpoint-b`, {
      headers: { upgrade: "websocket" }
    });
    expect(connection.status).toBe(101);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(state.storage.sql.exec(
        "SELECT request_count FROM rate_limits"
      ).one().request_count).toBe(4);
      expect(await state.storage.getAlarm()).not.toBeNull();
    });
  }, 30_000);

  it("schedules and executes TTL cleanup for presence-only and connect-only rooms", async () => {
    for (const [room, operation] of [
      ["FFFFFFFFFFFFFFFFFFFFFF", async (stub, roomId) => stub.touchPresence(roomId, "presence-only")],
      ["GGGGGGGGGGGGGGGGGGGGGG", async (_stub, roomId) => {
        const response = await relayRequest(`/v1/rooms/${roomId}/connect?endpoint=connect-only`, {
          headers: { upgrade: "websocket" }
        });
        expect(response.status).toBe(101);
      }]
    ]) {
      const stub = env.MORTALOS_ROOM.getByName(room);
      await operation(stub, room);
      await runInDurableObject(stub, async (_instance, state) => {
        expect(await state.storage.getAlarm()).not.toBeNull();
        expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM room_metadata").one().count).toBe(1);
        state.storage.sql.exec("UPDATE room_metadata SET expires_at = 0");
        await state.storage.setAlarm(Date.now() + 60_000);
      });
      await evictDurableObject(stub);
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      await runInDurableObject(stub, async (_instance, state) => {
        expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM room_metadata").one().count).toBe(0);
        expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM presence").one().count).toBe(0);
        expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM rate_limits").one().count).toBe(0);
        expect(await state.storage.getAlarm()).toBeNull();
      });
    }
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
