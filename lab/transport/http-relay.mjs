import { canonicalBytes, encodeBase64Url, parseJsonBytes } from "../../src/index.mjs";
import {
  assertRoomId,
  decodeRelayFrame,
  RELAY_LIMITS
} from "../../src/transport/protocol.mjs";
import { RELAY_RATE_POLICY } from "../../src/transport/relay-policy.mjs";

export function createRoomId() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function relayBaseUrl(location = globalThis.location) {
  return location.hostname === "mortal-os.com"
    ? "https://relay.mortal-os.com"
    : location.origin;
}

async function strictResponse(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  let value = null;
  try {
    value = parseJsonBytes(bytes, { maxBytes: RELAY_LIMITS.frame_bytes, maxDepth: 16 });
  } catch {
    throw new Error(`relay returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`${value.code ?? "RELAY_ERROR"} (HTTP ${response.status})`);
  return value;
}

export class HttpRelayTransport {
  #baseUrl;
  #closed = false;
  #cursor = 0;
  #endpointId;
  #polling = false;
  #lastPresence = 0;
  #roomId;
  #timer = null;

  constructor({ baseUrl = relayBaseUrl(), endpointId, roomId }) {
    this.#roomId = assertRoomId(roomId);
    if (typeof endpointId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(endpointId)) {
      throw new TypeError("bounded endpoint ID required");
    }
    this.#endpointId = endpointId;
    this.#baseUrl = new URL(baseUrl).origin;
  }

  #url(action) {
    return `${this.#baseUrl}/v1/rooms/${this.#roomId}/${action}`;
  }

  async publish(messageBytes) {
    if (this.#closed) throw new Error("transport closed");
    return strictResponse(await fetch(this.#url("messages"), {
      body: messageBytes,
      headers: { "content-type": "application/json" },
      method: "POST"
    }));
  }

  async fetchRange(after = this.#cursor, limit = RELAY_LIMITS.range_limit) {
    if (this.#closed) throw new Error("transport closed");
    const value = await strictResponse(await fetch(
      `${this.#url("messages")}?after=${encodeURIComponent(after)}&limit=${encodeURIComponent(limit)}`
    ));
    if (!Array.isArray(value.frames) || value.frames.length > limit) throw new Error("relay range schema invalid");
    const frames = value.frames.map((frame) => {
      decodeRelayFrame(frame);
      return frame;
    });
    for (let index = 1; index < frames.length; index += 1) {
      if (frames[index].sequence !== frames[index - 1].sequence + 1) throw new Error("relay range gap detected");
    }
    return frames;
  }

  async presence() {
    if (this.#closed) throw new Error("transport closed");
    const value = await strictResponse(await fetch(this.#url("presence")));
    if (!Array.isArray(value.endpoints) || value.endpoints.some((entry) => typeof entry !== "string")) {
      throw new Error("relay presence schema invalid");
    }
    return [...value.endpoints].sort();
  }

  async touchPresence() {
    if (this.#closed) throw new Error("transport closed");
    const value = await strictResponse(await fetch(this.#url("presence"), {
      body: canonicalBytes({ endpoint_id: this.#endpointId, format: "mortalos-relay-presence/1" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    }));
    if (value.endpoint_id !== this.#endpointId || !Number.isSafeInteger(value.expires_at)) {
      throw new Error("relay presence acknowledgement invalid");
    }
    this.#lastPresence = Date.now();
    return value;
  }

  subscribe(handler, { intervalMs = RELAY_RATE_POLICY.message_poll_interval_ms, startAfter = 0 } = {}) {
    if (this.#closed) throw new Error("transport closed");
    if (typeof handler !== "function") throw new TypeError("subscriber function required");
    this.#cursor = startAfter;
    const poll = async () => {
      if (this.#closed || this.#polling) return;
      this.#polling = true;
      try {
        if (Date.now() - this.#lastPresence >= RELAY_RATE_POLICY.presence_touch_interval_ms) {
          await this.touchPresence();
        }
        for (const frame of await this.fetchRange(this.#cursor)) {
          if (frame.sequence !== this.#cursor + 1) throw new Error("relay subscription gap detected");
          await handler(frame);
          this.#cursor = frame.sequence;
        }
      } finally {
        this.#polling = false;
      }
    };
    void poll().catch(() => {});
    this.#timer = setInterval(() => void poll().catch(() => {}), intervalMs);
    return () => {
      if (this.#timer) clearInterval(this.#timer);
      this.#timer = null;
    };
  }

  close() {
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }
}
