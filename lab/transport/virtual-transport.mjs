import {
  assertRoomId,
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../../src/transport/protocol.mjs";

function cloneFrame(frame) {
  return JSON.parse(JSON.stringify(frame));
}

export class VirtualTransportNetwork {
  #rooms = new Map();

  #room(roomId) {
    assertRoomId(roomId);
    if (!this.#rooms.has(roomId)) {
      this.#rooms.set(roomId, { endpoints: new Map(), frames: [], messages: new Map(), queue: [] });
    }
    return this.#rooms.get(roomId);
  }

  endpoint(roomId, endpointId) {
    if (typeof endpointId !== "string" || endpointId.length < 1 || endpointId.length > 64) {
      throw new TypeError("bounded endpoint ID required");
    }
    const room = this.#room(roomId);
    if (room.endpoints.has(endpointId)) throw new Error("endpoint already connected");
    const state = { closed: false, handler: null };
    room.endpoints.set(endpointId, state);
    return Object.freeze({
      close: () => {
        state.closed = true;
        state.handler = null;
        room.endpoints.delete(endpointId);
      },
      fetchRange: async (after = 0, limit = RELAY_LIMITS.range_limit) => {
        if (state.closed) throw new Error("transport closed");
        if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > RELAY_LIMITS.range_limit) {
          throw new TypeError("invalid range");
        }
        return room.frames.filter((frame) => frame.sequence > after).slice(0, limit).map(cloneFrame);
      },
      presence: async () => [...room.endpoints.keys()].sort(),
      publish: async (messageBytes) => {
        if (state.closed) throw new Error("transport closed");
        const opened = decodeRelayMessageBytes(messageBytes);
        const duplicate = room.messages.get(opened.message_id);
        if (duplicate) return { duplicate: true, frame: cloneFrame(duplicate) };
        if (room.frames.length >= RELAY_LIMITS.room_messages) throw new Error("room message ceiling reached");
        const frame = createRelayFrame(room.frames.length + 1, opened.bytes);
        room.messages.set(opened.message_id, frame);
        room.frames.push(frame);
        for (const [targetId, target] of room.endpoints) {
          if (!target.closed && target.handler) room.queue.push({ frame, room, targetId });
        }
        return { duplicate: false, frame: cloneFrame(frame) };
      },
      subscribe: (handler) => {
        if (state.closed) throw new Error("transport closed");
        if (typeof handler !== "function") throw new TypeError("subscriber function required");
        state.handler = handler;
        return () => {
          if (state.handler === handler) state.handler = null;
        };
      }
    });
  }

  async flush({ dropEvery = 0, duplicateEvery = 0, reverse = false, rotate = 0 } = {}) {
    let deliveries = [...this.#rooms.values()].flatMap((room) => room.queue.splice(0));
    if (deliveries.length && rotate) {
      const offset = ((rotate % deliveries.length) + deliveries.length) % deliveries.length;
      deliveries = [...deliveries.slice(offset), ...deliveries.slice(0, offset)];
    }
    if (reverse) deliveries.reverse();
    let delivered = 0;
    let dropped = 0;
    for (let index = 0; index < deliveries.length; index += 1) {
      const delivery = deliveries[index];
      if (dropEvery > 0 && (index + 1) % dropEvery === 0) {
        dropped += 1;
        continue;
      }
      const target = delivery.room.endpoints.get(delivery.targetId);
      if (!target?.handler) continue;
      await target.handler(cloneFrame(delivery.frame));
      delivered += 1;
      if (duplicateEvery > 0 && (index + 1) % duplicateEvery === 0) {
        await target.handler(cloneFrame(delivery.frame));
        delivered += 1;
      }
    }
    return { delivered, dropped };
  }
}
