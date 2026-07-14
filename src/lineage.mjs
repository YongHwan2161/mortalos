import { JsonInputError, JSON_LIMITS, parseJsonBytes } from "./codec.mjs";
import { rejection as reject } from "./rejection-codes.mjs";
import { validateGenesis, validatePulse } from "./validator.mjs";

function freezeResult(value) {
  for (const entry of Object.values(value)) {
    if (Array.isArray(entry)) Object.freeze(entry);
  }
  return Object.freeze(value);
}

class Lineage {
  #genesis;
  #head;
  #nodes;
  #children;
  #approvalIds;
  #forked = false;
  #forkPoints = new Set();

  constructor(genesis) {
    this.#genesis = genesis;
    this.#head = genesis;
    this.#nodes = new Map([[genesis.object_hash, genesis]]);
    this.#children = new Map();
    this.#approvalIds = new Map();
  }

  get genesis() {
    return this.#genesis;
  }

  get head() {
    return this.#forked ? null : this.#head;
  }

  get isForked() {
    return this.#forked;
  }

  #inspect(envelopeBytes) {
    try {
      return {
        envelope: parseJsonBytes(envelopeBytes, {
          maxBytes: JSON_LIMITS.envelope_bytes,
          maxDepth: JSON_LIMITS.max_depth
        })
      };
    } catch (error) {
      if (error instanceof JsonInputError) return { envelope: null };
      throw error;
    }
  }

  #validateDetailed({ envelopeBytes, eventPayloadBytes }) {
    const { envelope } = this.#inspect(envelopeBytes);
    const parentHash = envelope?.body?.parent_hash;
    const parent = this.#nodes.get(parentHash);
    const validation = validatePulse({
      genesis: this.#genesis,
      parent: parent ?? null,
      envelopeBytes,
      eventPayloadBytes
    });
    if (validation.status === "reject" && validation.code === "E_PARENT_REQUIRED" && parentHash) {
      return {
        envelope,
        parent: null,
        validation: reject("E_PARENT_UNKNOWN", "/body/parent_hash", String(parentHash))
      };
    }
    return { envelope, parent: parent ?? null, validation };
  }

  validateCandidate(input) {
    return this.#validateDetailed(input).validation;
  }

  append(input) {
    const { envelope, parent, validation } = this.#validateDetailed(input);
    if (validation.status !== "accept") return validation;

    if (this.#nodes.has(validation.object_hash)) {
      return reject("E_REPLAY_STALE", "/body", validation.object_hash);
    }
    if (this.#forked) {
      return reject("E_LINEAGE_ALREADY_FORKED", "", [...this.#forkPoints].sort().join(","));
    }

    const parentHash = parent.object_hash;
    const existingChildren = this.#children.get(parentHash) ?? new Set();
    const approvalIds = new Set(envelope.approvals.map((entry) => entry.key_id));

    this.#nodes.set(validation.object_hash, validation);
    this.#approvalIds.set(validation.object_hash, approvalIds);
    existingChildren.add(validation.object_hash);
    this.#children.set(parentHash, existingChildren);

    if (existingChildren.size > 1) {
      const childHashes = [...existingChildren].sort();
      const equivocating = new Set();
      for (const childHash of childHashes) {
        if (childHash === validation.object_hash) continue;
        for (const keyId of this.#approvalIds.get(childHash) ?? []) {
          if (approvalIds.has(keyId)) equivocating.add(keyId);
        }
      }
      this.#forked = true;
      this.#head = null;
      this.#forkPoints.add(parentHash);
      return freezeResult({
        status: "forked",
        code: "E_FORK_DETECTED",
        parent_hash: parentHash,
        child_hashes: childHashes,
        equivocating_key_ids: [...equivocating].sort()
      });
    }

    this.#head = validation;
    return validation;
  }

  snapshot() {
    const forkPoints = [...this.#forkPoints].sort().map((parentHash) =>
      freezeResult({
        parent_hash: parentHash,
        child_hashes: [...(this.#children.get(parentHash) ?? [])].sort()
      })
    );
    return freezeResult({
      status: this.#forked ? "forked" : "linear",
      organism_id: this.#genesis.organism_id,
      genesis_hash: this.#genesis.object_hash,
      head_hash: this.#forked ? null : this.#head.object_hash,
      accepted_objects: this.#nodes.size,
      fork_points: Object.freeze(forkPoints)
    });
  }
}

export function createLineage(genesisEnvelopeBytes) {
  const genesis = validateGenesis(genesisEnvelopeBytes);
  if (genesis.status !== "accept") return genesis;
  return Object.freeze({ status: "accept", lineage: new Lineage(genesis) });
}
