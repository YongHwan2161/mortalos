import { DurableObject } from "cloudflare:workers";
import {
  canonicalBytes,
  decodeBase64Url,
  encodeBase64Url,
  isCanonical,
  parseJsonBytes
} from "../src/index.mjs";
import {
  assertRoomId,
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS,
  RelayProtocolError
} from "../src/transport/protocol.mjs";
import { RELAY_RATE_POLICY } from "../src/transport/relay-policy.mjs";

const DEFAULT_TTL_SECONDS = 86_400;
const MAX_TTL_SECONDS = 604_800;
const MIN_TTL_SECONDS = 3_600;
const MAX_ENDPOINT_ID = 64;
const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store, no-transform",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
});

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!/^(?:0|[1-9][0-9]*)$/.test(String(value))) throw new Error("invalid bounded integer configuration");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error("bounded integer configuration outside policy");
  }
  return parsed;
}

function exactOrigin(request, env) {
  if (typeof env.ALLOWED_ORIGIN !== "string" || !/^https:\/\/[a-z0-9.-]+$/.test(env.ALLOWED_ORIGIN)) {
    return null;
  }
  return request.headers.get("origin") === env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : null;
}

function responseJson(body, status, origin = null, extraHeaders = {}) {
  const headers = new Headers({ ...JSON_HEADERS, ...extraHeaders });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(canonicalBytes(body), { status, headers });
}

function failure(error, origin = null) {
  const code = error instanceof RelayProtocolError
    ? error.code
    : error?.code === "RELAY_RATE"
      ? "RELAY_RATE"
      : "RELAY_UNAVAILABLE";
  const status = code === "RELAY_RATE"
    ? 429
    : code === "RELAY_LIMIT"
      ? 413
      : code === "RELAY_UNAVAILABLE"
        ? 503
        : 400;
  return responseJson({ code, status: "reject" }, status, origin);
}

function pathRoute(pathname) {
  const match = pathname.match(/^\/v1\/rooms\/([A-Za-z0-9_-]{22})\/(messages|presence|connect)$/);
  return match ? { roomId: match[1], action: match[2] } : null;
}

async function requestBytes(request) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > RELAY_LIMITS.message_bytes)) {
    throw new RelayProtocolError("RELAY_LIMIT", "request too large");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > RELAY_LIMITS.message_bytes) {
    throw new RelayProtocolError("RELAY_LIMIT", "request too large");
  }
  return bytes;
}

export class MortalOSRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
          id INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_metadata (
          room_id TEXT PRIMARY KEY NOT NULL,
          expires_at INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS messages (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT UNIQUE NOT NULL,
          message_base64url TEXT NOT NULL,
          received_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS messages_expiry ON messages(expires_at);
        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket INTEGER PRIMARY KEY NOT NULL,
          request_count INTEGER NOT NULL CHECK(request_count >= 1)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS presence (
          endpoint_id TEXT PRIMARY KEY NOT NULL,
          expires_at INTEGER NOT NULL
        ) STRICT;
        INSERT OR IGNORE INTO _sql_schema_migrations(id, applied_at) VALUES (1, unixepoch());
      `);
    });
  }

  #ttlMs() {
    return boundedInteger(
      this.env.ROOM_TTL_SECONDS,
      DEFAULT_TTL_SECONDS,
      MIN_TTL_SECONDS,
      MAX_TTL_SECONDS
    ) * 1_000;
  }

  #ensureRoom(roomId, now) {
    assertRoomId(roomId);
    const existing = this.ctx.storage.sql
      .exec("SELECT room_id, expires_at FROM room_metadata LIMIT 1")
      .toArray()[0];
    if (existing && existing.room_id !== roomId) {
      throw new RelayProtocolError("RELAY_ROOM", "Durable Object room mismatch");
    }
    const expiresAt = now + this.#ttlMs();
    this.ctx.storage.sql.exec(
      `INSERT INTO room_metadata(room_id, expires_at) VALUES (?, ?)
       ON CONFLICT(room_id) DO UPDATE SET expires_at = excluded.expires_at`,
      roomId,
      expiresAt
    );
    return expiresAt;
  }

  #admit(now) {
    const bucket = Math.floor(now / 60_000);
    const row = this.ctx.storage.sql.exec(
      `INSERT INTO rate_limits(bucket, request_count) VALUES (?, 1)
       ON CONFLICT(bucket) DO UPDATE SET request_count = request_count + 1
       RETURNING request_count`,
      bucket
    ).one();
    this.ctx.storage.sql.exec("DELETE FROM rate_limits WHERE bucket < ?", bucket - 1);
    return row.request_count <= RELAY_RATE_POLICY.room_requests_per_minute;
  }

  async #admitRoom(roomId, now) {
    if (!this.#admit(now)) return null;
    const expiresAt = this.#ensureRoom(roomId, now);
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null || expiresAt < currentAlarm) {
      await this.ctx.storage.setAlarm(expiresAt);
    }
    return expiresAt;
  }

  async publish(roomId, messageBytes) {
    const now = Date.now();
    const opened = decodeRelayMessageBytes(
      messageBytes instanceof Uint8Array ? messageBytes : new Uint8Array(messageBytes)
    );
    const expiresAt = await this.#admitRoom(roomId, now);
    if (expiresAt === null) return { rate_limited: true };
    const duplicate = this.ctx.storage.sql.exec(
      "SELECT sequence, message_base64url FROM messages WHERE message_id = ?",
      opened.message_id
    ).toArray()[0];
    if (duplicate) {
      return {
        duplicate: true,
        frame: createRelayFrame(duplicate.sequence, decodeBase64Url(duplicate.message_base64url)),
        rate_limited: false
      };
    }
    const usage = this.ctx.storage.sql.exec(
      "SELECT COUNT(*) AS count, COALESCE(SUM(length(message_base64url)), 0) AS encoded_bytes FROM messages"
    ).one();
    const encoded = encodeBase64Url(opened.bytes);
    if (
      usage.count >= RELAY_LIMITS.room_messages ||
      Math.ceil((usage.encoded_bytes + encoded.length) * 3 / 4) > RELAY_LIMITS.room_bytes
    ) {
      throw new RelayProtocolError("RELAY_LIMIT", "room storage ceiling reached");
    }
    const inserted = this.ctx.storage.sql.exec(
      `INSERT INTO messages(message_id, message_base64url, received_at, expires_at)
       VALUES (?, ?, ?, ?) RETURNING sequence`,
      opened.message_id,
      encoded,
      now,
      expiresAt
    ).one();
    return {
      duplicate: false,
      frame: createRelayFrame(inserted.sequence, opened.bytes),
      rate_limited: false
    };
  }

  async fetchRange(roomId, after = 0, limit = RELAY_LIMITS.range_limit) {
    assertRoomId(roomId);
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > RELAY_LIMITS.range_limit) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid range");
    }
    if (await this.#admitRoom(roomId, Date.now()) === null) {
      return { frames: [], rate_limited: true };
    }
    const frames = this.ctx.storage.sql.exec(
      `SELECT sequence, message_id, message_base64url FROM messages
       WHERE sequence > ? ORDER BY sequence LIMIT ?`,
      after,
      limit
    ).toArray().map((row) => ({
      format: "mortalos-relay-frame/1",
      message_base64url: row.message_base64url,
      message_id: row.message_id,
      sequence: row.sequence
    }));
    return { frames, rate_limited: false };
  }

  async presence(roomId) {
    assertRoomId(roomId);
    const now = Date.now();
    if (await this.#admitRoom(roomId, now) === null) {
      return { endpoints: [], rate_limited: true };
    }
    this.ctx.storage.sql.exec("DELETE FROM presence WHERE expires_at <= ?", now);
    const endpoints = new Set(this.ctx.storage.sql.exec(
      "SELECT endpoint_id FROM presence ORDER BY endpoint_id"
    ).toArray().map((row) => row.endpoint_id));
    for (const socket of this.ctx.getWebSockets()) {
      const endpointId = socket.deserializeAttachment()?.endpoint_id;
      if (typeof endpointId === "string") endpoints.add(endpointId);
    }
    return { endpoints: [...endpoints].sort(), rate_limited: false };
  }

  async touchPresence(roomId, endpointId) {
    assertRoomId(roomId);
    if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(endpointId)) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid endpoint ID");
    }
    const now = Date.now();
    if (await this.#admitRoom(roomId, now) === null) return { rate_limited: true };
    this.ctx.storage.sql.exec("DELETE FROM presence WHERE expires_at <= ?", now);
    const count = this.ctx.storage.sql.exec("SELECT COUNT(*) AS count FROM presence").one().count;
    const exists = this.ctx.storage.sql.exec(
      "SELECT endpoint_id FROM presence WHERE endpoint_id = ?",
      endpointId
    ).toArray().length === 1;
    if (!exists && count >= 16) throw new RelayProtocolError("RELAY_LIMIT", "presence ceiling reached");
    this.ctx.storage.sql.exec(
      `INSERT INTO presence(endpoint_id, expires_at) VALUES (?, ?)
       ON CONFLICT(endpoint_id) DO UPDATE SET expires_at = excluded.expires_at`,
      endpointId,
      now + 15_000
    );
    return { endpoint_id: endpointId, expires_at: now + 15_000, rate_limited: false };
  }

  async #openSocket(roomId, endpointId) {
    assertRoomId(roomId);
    if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(endpointId)) {
      throw new RelayProtocolError("RELAY_SCHEMA", "invalid endpoint ID");
    }
    if (await this.#admitRoom(roomId, Date.now()) === null) {
      return responseJson({ code: "RELAY_RATE", status: "reject" }, 429);
    }
    const pair = new WebSocketPair();
    pair[1].serializeAttachment({ endpoint_id: endpointId, room_id: roomId });
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (
      request.method !== "GET" ||
      url.pathname !== "/__mortalos/connect" ||
      request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    ) {
      return responseJson({ code: "RELAY_METHOD", status: "reject" }, 405);
    }
    return this.#openSocket(url.searchParams.get("room"), url.searchParams.get("endpoint"));
  }

  async webSocketMessage(socket, message) {
    try {
      if (typeof message !== "string" || new TextEncoder().encode(message).byteLength > RELAY_LIMITS.frame_bytes) {
        throw new RelayProtocolError("RELAY_LIMIT", "WebSocket frame too large");
      }
      const bytes = new TextEncoder().encode(message);
      const value = parseJsonBytes(bytes, { maxBytes: RELAY_LIMITS.frame_bytes, maxDepth: 8 });
      if (!isCanonical(bytes, value) || Object.keys(value).sort().join(",") !== "format,message_base64url") {
        throw new RelayProtocolError("RELAY_NONCANONICAL", "invalid publish frame");
      }
      if (value.format !== "mortalos-relay-publish/1") {
        throw new RelayProtocolError("RELAY_VERSION", "unsupported publish frame");
      }
      const publicBytes = decodeBase64Url(value.message_base64url);
      if (!publicBytes) throw new RelayProtocolError("RELAY_PARSE", "invalid publish bytes");
      const attachment = socket.deserializeAttachment();
      const result = await this.publish(attachment.room_id, publicBytes);
      if (result.rate_limited) {
        socket.send(new TextDecoder().decode(canonicalBytes({ code: "RELAY_RATE", status: "reject" })));
        return;
      }
      const response = new TextDecoder().decode(canonicalBytes(result.frame));
      for (const peer of this.ctx.getWebSockets()) {
        try { peer.send(response); } catch { /* disconnected peers disappear from getWebSockets */ }
      }
    } catch (error) {
      socket.send(new TextDecoder().decode(canonicalBytes({
        code: error instanceof RelayProtocolError ? error.code : "RELAY_UNAVAILABLE",
        status: "reject"
      })));
    }
  }

  async webSocketClose(_socket, _code, _reason, _wasClean) {
    // Hibernatable sockets are already removed from getWebSockets() by the runtime.
  }

  async webSocketError(socket) {
    try { socket.close(1011, "relay socket error"); } catch { /* socket is already gone */ }
  }

  async alarm() {
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM messages WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec("DELETE FROM rate_limits WHERE bucket < ?", Math.floor(now / 60_000) - 1);
    this.ctx.storage.sql.exec("DELETE FROM presence WHERE expires_at <= ?", now);
    const roomExpiry = this.ctx.storage.sql.exec(
      "SELECT expires_at FROM room_metadata LIMIT 1"
    ).toArray()[0]?.expires_at ?? null;
    if (roomExpiry !== null && roomExpiry <= now) {
      this.ctx.storage.sql.exec("DELETE FROM messages");
      this.ctx.storage.sql.exec("DELETE FROM presence");
      this.ctx.storage.sql.exec("DELETE FROM rate_limits");
      this.ctx.storage.sql.exec("DELETE FROM room_metadata");
      for (const socket of this.ctx.getWebSockets()) socket.close(1001, "room expired");
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const deadlines = [
      roomExpiry,
      this.ctx.storage.sql.exec("SELECT MIN(expires_at) AS expires_at FROM messages").one().expires_at,
      this.ctx.storage.sql.exec("SELECT MIN(expires_at) AS expires_at FROM presence").one().expires_at
    ].filter((value) => value !== null && value > now);
    if (deadlines.length === 0) {
      this.ctx.storage.sql.exec("DELETE FROM room_metadata");
      for (const socket of this.ctx.getWebSockets()) socket.close(1001, "room expired");
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }
}

export default {
  async fetch(request, env) {
    const origin = exactOrigin(request, env);
    if (!origin) return responseJson({ code: "RELAY_ORIGIN", status: "reject" }, 403);
    if (request.method === "OPTIONS") {
      if (
        request.headers.get("access-control-request-method") !== "POST" ||
        request.headers.get("access-control-request-headers")?.toLowerCase() !== "content-type"
      ) {
        return responseJson({ code: "RELAY_CORS", status: "reject" }, 403, origin);
      }
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "POST",
          "access-control-allow-origin": origin,
          "access-control-max-age": "600",
          "cache-control": "no-store, no-transform",
          vary: "Origin"
        }
      });
    }
    const route = pathRoute(new URL(request.url).pathname);
    if (!route) return responseJson({ code: "RELAY_NOT_FOUND", status: "reject" }, 404, origin);
    try {
      const roomId = assertRoomId(route.roomId);
      const stub = env.MORTALOS_ROOM.getByName(roomId);
      if (route.action === "messages" && request.method === "POST") {
        if (request.headers.get("content-type") !== "application/json") {
          throw new RelayProtocolError("RELAY_MEDIA_TYPE", "application/json required");
        }
        const opened = decodeRelayMessageBytes(await requestBytes(request));
        const result = await stub.publish(roomId, opened.bytes);
        if (result.rate_limited) {
          return responseJson({ code: "RELAY_RATE", status: "reject" }, 429, origin);
        }
        const frame = {
          format: result.frame.format,
          message_base64url: result.frame.message_base64url,
          message_id: result.frame.message_id,
          sequence: result.frame.sequence
        };
        const duplicate = result.duplicate === true;
        return responseJson({ duplicate, frame }, duplicate ? 200 : 201, origin);
      }
      if (route.action === "messages" && request.method === "GET") {
        const url = new URL(request.url);
        const afterRaw = url.searchParams.get("after") ?? "0";
        const limitRaw = url.searchParams.get("limit") ?? String(RELAY_LIMITS.range_limit);
        if (!/^(?:0|[1-9][0-9]*)$/.test(afterRaw) || !/^[1-9][0-9]*$/.test(limitRaw)) {
          throw new RelayProtocolError("RELAY_SCHEMA", "invalid range");
        }
        const after = Number(afterRaw);
        const limit = Number(limitRaw);
        if (!Number.isSafeInteger(after) || !Number.isSafeInteger(limit) || limit > RELAY_LIMITS.range_limit) {
          throw new RelayProtocolError("RELAY_SCHEMA", "invalid range");
        }
        const result = await stub.fetchRange(roomId, after, limit);
        if (result.rate_limited) {
          return responseJson({ code: "RELAY_RATE", status: "reject" }, 429, origin);
        }
        const frames = result.frames.map((frame) => ({
          format: frame.format,
          message_base64url: frame.message_base64url,
          message_id: frame.message_id,
          sequence: frame.sequence
        }));
        return responseJson({ frames }, 200, origin);
      }
      if (route.action === "presence" && request.method === "GET") {
        const result = await stub.presence(roomId);
        if (result.rate_limited) {
          return responseJson({ code: "RELAY_RATE", status: "reject" }, 429, origin);
        }
        return responseJson({ endpoints: [...result.endpoints] }, 200, origin);
      }
      if (route.action === "presence" && request.method === "POST") {
        if (request.headers.get("content-type") !== "application/json") {
          throw new RelayProtocolError("RELAY_MEDIA_TYPE", "application/json required");
        }
        const bytes = await requestBytes(request);
        const value = parseJsonBytes(bytes, { maxBytes: 1024, maxDepth: 4 });
        if (
          !isCanonical(bytes, value) ||
          Object.keys(value).sort().join(",") !== "endpoint_id,format" ||
          value.format !== "mortalos-relay-presence/1"
        ) {
          throw new RelayProtocolError("RELAY_SCHEMA", "invalid presence update");
        }
        const touched = await stub.touchPresence(roomId, value.endpoint_id);
        if (touched.rate_limited) {
          return responseJson({ code: "RELAY_RATE", status: "reject" }, 429, origin);
        }
        return responseJson({ endpoint_id: touched.endpoint_id, expires_at: touched.expires_at }, 200, origin);
      }
      if (route.action === "connect" && request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const endpointId = new URL(request.url).searchParams.get("endpoint");
        if (!endpointId || endpointId.length > MAX_ENDPOINT_ID) throw new RelayProtocolError("RELAY_SCHEMA", "endpoint required");
        const internalUrl = new URL("https://mortalos-relay.invalid/__mortalos/connect");
        internalUrl.searchParams.set("endpoint", endpointId);
        internalUrl.searchParams.set("room", roomId);
        const connected = await stub.fetch(new Request(internalUrl, { headers: { upgrade: "websocket" } }));
        if (connected.status === 429) {
          return responseJson({ code: "RELAY_RATE", status: "reject" }, 429, origin);
        }
        return connected;
      }
      return responseJson({ code: "RELAY_METHOD", status: "reject" }, 405, origin, { allow: "GET, POST, OPTIONS" });
    } catch (error) {
      if (!(error instanceof RelayProtocolError) && error?.code !== "RELAY_RATE") {
        console.error("MortalOS relay unavailable", {
          message: error instanceof Error ? error.message : "unknown failure",
          name: error instanceof Error ? error.name : typeof error
        });
      }
      return failure(error, origin);
    }
  }
};
