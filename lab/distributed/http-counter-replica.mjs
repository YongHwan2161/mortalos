import { registerCounterReplicaCapability } from "../../src/distributed/quorum-counter-store.mjs";

function clone(value) {
  return value === null ? null : structuredClone(value);
}

export class HttpCounterReplica {
  #read;

  constructor({ baseUrl, bearerToken, failureDomain }) {
    if (
      typeof baseUrl !== "string" ||
      !/^https?:\/\//u.test(baseUrl) ||
      typeof bearerToken !== "string" ||
      bearerToken.length < 16 ||
      typeof failureDomain !== "string" ||
      !/^[A-Za-z0-9._-]{1,64}$/u.test(failureDomain)
    ) {
      throw new TypeError("bounded HTTP counter replica configuration required");
    }
    const call = async (operation, body) => {
      const response = await fetch(new URL(operation, baseUrl), {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(5_000)
      });
      if (!response.ok) throw new Error(`counter-replica-http-${response.status}`);
      return response.json();
    };
    const read = async (epochId) => clone((await call("read", { epochId })).value);
    this.#read = read;
    registerCounterReplicaCapability(this, {
      compareAndSwap: async (epochId, expectedRevision, next) =>
        Boolean((await call("cas", { epochId, expectedRevision, next })).accepted),
      failureDomain,
      read,
      repair: async (epochId, committed) =>
        Boolean((await call("repair", { committed, epochId })).repaired)
    });
    Object.freeze(this);
  }

  async snapshot(epochId) {
    return clone(await this.#read(epochId));
  }
}
