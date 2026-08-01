import { equalBytes } from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import {
  confidentialFail
} from "../confidential/format.mjs";
import {
  registerCounterAuthorityStore
} from "../confidential/counter.mjs";
import {
  copyBoundedOwnDataArray,
  ownDataArrayLength,
  snapshotNamedOwnDataValues
} from "../primordials.mjs";

const REPLICA_RECORDS = new WeakMap();

function replicaRecord(replica) {
  const record = REPLICA_RECORDS.get(replica);
  if (!record) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority/replicas",
      "registered-replica"
    );
  }
  return record;
}

function registerReplica(replica, capability) {
  REPLICA_RECORDS.set(replica, Object.freeze(capability));
}

export function registerCounterReplicaCapability(replica, capability) {
  if ((typeof replica !== "object" && typeof replica !== "function") || replica === null) {
    throw new TypeError("counter replica object required");
  }
  if (REPLICA_RECORDS.has(replica)) {
    throw new TypeError("counter replica is already registered");
  }
  const [compareAndSwap, failureDomain, read, repair] = snapshotNamedOwnDataValues(
    capability,
    ["compareAndSwap", "failureDomain", "read", "repair"],
    "counter replica capability"
  );
  if (
    typeof compareAndSwap !== "function" ||
    typeof read !== "function" ||
    typeof repair !== "function" ||
    typeof failureDomain !== "string" ||
    !/^[A-Za-z0-9._-]{1,64}$/u.test(failureDomain)
  ) {
    throw new TypeError("bounded counter replica capability required");
  }
  registerReplica(replica, { compareAndSwap, failureDomain, read, repair });
  return replica;
}

function clone(value) {
  return value === null ? null : structuredClone(value);
}

function same(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

export class MemoryCounterReplica {
  constructor({ failureDomain, fault = null }) {
    if (typeof failureDomain !== "string" || !/^[A-Za-z0-9._-]{1,64}$/u.test(failureDomain)) {
      throw new TypeError("bounded counter replica failure domain required");
    }
    const record = {
      failureDomain,
      fault,
      online: true,
      records: new Map()
    };
    registerReplica(this, {
      compareAndSwap: async (epochId, expectedRevision, next) => {
        if (!record.online) throw new Error("counter-replica-offline");
        const current = record.records.get(epochId) ?? null;
        if ((current?.revision ?? null) !== expectedRevision) return false;
        if (next === null) record.records.delete(epochId);
        else record.records.set(epochId, clone(next));
        return true;
      },
      failureDomain,
      read: async (epochId) => {
        if (!record.online) throw new Error("counter-replica-offline");
        return clone(record.records.get(epochId) ?? null);
      },
      repair: async (epochId, committed) => {
        if (!record.online) return false;
        await record.fault?.("repair:before", epochId, committed);
        const current = record.records.get(epochId) ?? null;
        if (committed === null) {
          if (current !== null) return false;
          return true;
        }
        if ((current?.revision ?? -1) > committed.revision) return false;
        record.records.set(epochId, clone(committed));
        await record.fault?.("repair:after", epochId, committed);
        return true;
      },
      state: record
    });
    Object.freeze(this);
  }

  get failureDomain() {
    return replicaRecord(this).failureDomain;
  }

  setOnline(online) {
    replicaRecord(this).state.online = Boolean(online);
  }

  restart() {
    replicaRecord(this).state.online = true;
  }

  setFault(fault) {
    replicaRecord(this).state.fault = fault;
  }

  snapshot(epochId) {
    const record = replicaRecord(this).state;
    return clone(record.records.get(epochId) ?? null);
  }
}

async function committedRecord(replicas, quorum, epochId) {
  const observations = [];
  for (const replica of replicas) {
    try {
      observations.push({ replica, value: await replicaRecord(replica).read(epochId) });
    } catch {
      // Offline replicas do not vote.
    }
  }
  if (observations.length < quorum) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority/replicas",
      "quorum-unavailable"
    );
  }
  const groups = [];
  for (const observation of observations) {
    let group = groups.find((entry) => same(entry.value, observation.value));
    if (!group) {
      group = { voters: [], value: observation.value };
      groups.push(group);
    }
    group.voters.push(observation.replica);
  }
  const committed = groups
    .filter((entry) => entry.voters.length >= quorum)
    .sort((left, right) => (right.value?.revision ?? -1) - (left.value?.revision ?? -1))[0];
  if (!committed) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_STALE",
      "/counter_authority/replicas",
      "no-quorum-commit"
    );
  }
  return { observations, value: clone(committed.value) };
}

export class QuorumCounterAuthorityStore {
  #quorum;
  #replicas;
  #tail = Promise.resolve();

  constructor({ replicas }) {
    const count = ownDataArrayLength(replicas, "counter replicas");
    if (count < 3 || count > 7 || count % 2 === 0) {
      throw new TypeError("an odd three-to-seven replica counter quorum is required");
    }
    const owned = copyBoundedOwnDataArray(replicas, count, "counter replicas");
    const domains = new Set(owned.map((replica) => replicaRecord(replica).failureDomain));
    if (domains.size !== count) {
      throw new TypeError("counter replicas require distinct failure domains");
    }
    this.#replicas = Object.freeze(owned);
    this.#quorum = Math.floor(count / 2) + 1;
    registerCounterAuthorityStore(this, {
      inspect: (epochId) => this.#inspect(epochId),
      transact: (epochId, operation) => this.#transact(epochId, operation)
    });
    Object.freeze(this);
  }

  get topology() {
    return Object.freeze({
      failure_domains: Object.freeze(
        this.#replicas.map((replica) => replicaRecord(replica).failureDomain).sort()
      ),
      quorum: this.#quorum,
      replicas: this.#replicas.length
    });
  }

  async #inspect(epochId) {
    const committed = await committedRecord(this.#replicas, this.#quorum, epochId);
    for (const { replica, value } of committed.observations) {
      if (!same(value, committed.value)) {
        try {
          await replicaRecord(replica).repair(epochId, committed.value);
        } catch {
          // Repair is best effort; quorum truth remains authoritative.
        }
      }
    }
    return clone(committed.value?.data ?? null);
  }

  async #transact(epochId, operation) {
    let release;
    const prior = this.#tail;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await prior;
    try {
      const committed = (await committedRecord(this.#replicas, this.#quorum, epochId)).value;
      const outcome = await operation(clone(committed?.data ?? null));
      if (!outcome || !Object.hasOwn(outcome, "next")) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "transaction-result"
        );
      }
      const next = outcome.next === null
        ? null
        : {
            data: clone(outcome.next),
            revision: (committed?.revision ?? -1) + 1
          };
      let accepted = 0;
      for (const replica of this.#replicas) {
        try {
          if (await replicaRecord(replica).compareAndSwap(
            epochId,
            committed?.revision ?? null,
            next
          )) accepted += 1;
        } catch {
          // An unavailable replica cannot vote.
        }
      }
      if (accepted < this.#quorum) {
        const winner = (await committedRecord(this.#replicas, this.#quorum, epochId)).value;
        for (const replica of this.#replicas) {
          try { await replicaRecord(replica).repair(epochId, winner); } catch {}
        }
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_STALE",
          "/counter_authority",
          "quorum-compare-and-swap"
        );
      }
      for (const replica of this.#replicas) {
        try { await replicaRecord(replica).repair(epochId, next); } catch {}
      }
      return outcome.value;
    } finally {
      release();
    }
  }
}

export function assertIndependentTopology(topology) {
  const [format, nodes] = snapshotNamedOwnDataValues(
    topology,
    ["format", "nodes"],
    "S7 topology"
  );
  const count = ownDataArrayLength(nodes, "S7 topology nodes");
  const owned = copyBoundedOwnDataArray(nodes, count, "S7 topology nodes");
  if (format !== "mortalos-independent-topology/1" || count < 3) {
    throw new TypeError("S7 topology requires at least three nodes");
  }
  const observed = owned.map((node, index) => {
    const values = snapshotNamedOwnDataValues(
      node,
      ["admin_domain", "credential_domain", "host_domain", "node_id", "provider"],
      `S7 node ${index}`
    );
    if (values.some((value) => typeof value !== "string" || value.length < 1 || value.length > 128)) {
      throw new TypeError("S7 topology identifiers must be bounded strings");
    }
    return Object.freeze({
      admin_domain: values[0],
      credential_domain: values[1],
      host_domain: values[2],
      node_id: values[3],
      provider: values[4]
    });
  });
  for (const field of ["admin_domain", "credential_domain", "host_domain", "provider"]) {
    if (new Set(observed.map((node) => node[field])).size !== count) {
      throw new TypeError(`S7 topology ${field} values must be independent`);
    }
  }
  return Object.freeze({ format, nodes: Object.freeze(observed) });
}
