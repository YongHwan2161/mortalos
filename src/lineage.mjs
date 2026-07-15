import {
  JsonInputError,
  JSON_LIMITS,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import { rejection as reject } from "./rejection-codes.mjs";
import {
  isValidatedAcceptance,
  isValidatedLatentSuccessor,
  validateGenesis,
  validateLatentSuccessor,
  validatePulse
} from "./validator.mjs";

function freezeResult(value) {
  for (const entry of Object.values(value)) {
    if (Array.isArray(entry)) Object.freeze(entry);
  }
  return Object.freeze(value);
}

function requireCondition(condition, message) {
  if (!condition) throw new TypeError(message);
}

function evaluateMortalityState({
  head,
  usableKeyIds,
  stateAvailable,
  latentSuccessors = [],
  authorityLossIrreversible = false
}) {
  requireCondition(isValidatedAcceptance(head), "head must be a validated acceptance");
  requireCondition(Array.isArray(usableKeyIds), "usableKeyIds must be an array");
  requireCondition(typeof stateAvailable === "boolean", "stateAvailable must be boolean");
  requireCondition(Array.isArray(latentSuccessors), "latentSuccessors must be an array");
  requireCondition(
    typeof authorityLossIrreversible === "boolean",
    "authorityLossIrreversible must be boolean"
  );

  const latentHashes = new Set();
  for (const candidate of latentSuccessors) {
    const trustedSuccessionEvidence =
      (isValidatedAcceptance(candidate) && candidate.kind === "pulse") ||
      isValidatedLatentSuccessor(candidate);
    requireCondition(
      trustedSuccessionEvidence &&
        candidate.organism_id === head.organism_id &&
        candidate.parent_hash === head.object_hash,
      "latent successors must be validated direct children of head"
    );
    latentHashes.add(candidate.object_hash);
  }

  const custodyDescriptor = head.next_custody_descriptor;
  const declared = new Set(custodyDescriptor.custodians.map((entry) => entry.key_id));
  const usable = new Set(usableKeyIds.filter((keyId) => declared.has(keyId)));
  const threshold = custodyDescriptor.quorum.threshold;
  const authorityViable = usable.size >= threshold;
  const latentSuccessorCount = latentHashes.size;

  if (authorityViable && stateAvailable) {
    return Object.freeze({
      status: "operationally_alive",
      authority_viable: true,
      state_viable: true,
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    });
  }
  if (authorityViable) {
    return Object.freeze({
      status: "state_stalled",
      authority_viable: true,
      state_viable: false,
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    });
  }
  if (latentSuccessorCount > 0) {
    return Object.freeze({
      status: "latent_successor_not_dead",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    });
  }
  if (authorityLossIrreversible) {
    return Object.freeze({
      status: "dead_under_v0_assumptions",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      usable_keys: usable.size,
      threshold,
      latent_successors: 0
    });
  }
  return Object.freeze({
    status: "authority_unavailable_not_proven_dead",
    authority_viable: false,
    state_viable: Boolean(stateAvailable),
    usable_keys: usable.size,
    threshold,
    latent_successors: 0
  });
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
        ok: true,
        envelope: parseJsonBytes(envelopeBytes, {
          maxBytes: JSON_LIMITS.envelope_bytes,
          maxDepth: JSON_LIMITS.max_depth
        })
      };
    } catch (error) {
      if (error instanceof JsonInputError) return { ok: false };
      throw error;
    }
  }

  #snapshotEnvelope(input) {
    let envelopeSource;
    try {
      envelopeSource = input?.envelopeBytes;
    } catch {
      return { failure: reject("E_VALIDATOR_INTERNAL") };
    }

    let envelopeBytes;
    try {
      envelopeBytes = snapshotBytes(envelopeSource, JSON_LIMITS.envelope_bytes);
    } catch (error) {
      return {
        failure:
          error instanceof JsonInputError
            ? reject(error.code, "", error.detail)
            : reject("E_VALIDATOR_INTERNAL")
      };
    }
    return { envelopeBytes };
  }

  #snapshotPayload(input) {
    let payloadSource;
    try {
      payloadSource = input?.eventPayloadBytes;
    } catch {
      return { failure: reject("E_VALIDATOR_INTERNAL") };
    }
    if (payloadSource === undefined || payloadSource === null) {
      return {
        failure: reject("E_EVENT_PAYLOAD_REQUIRED", "/event_payload", "missing")
      };
    }
    let eventPayloadBytes;
    try {
      eventPayloadBytes = snapshotBytes(payloadSource, JSON_LIMITS.event_payload_bytes);
    } catch (error) {
      return {
        failure:
          error instanceof JsonInputError
            ? reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", error.code)
            : reject("E_VALIDATOR_INTERNAL")
      };
    }
    return { eventPayloadBytes };
  }

  #validateDetailed(input) {
    const envelopeSnapshot = this.#snapshotEnvelope(input);
    if (envelopeSnapshot.failure) {
      return { envelope: null, parent: null, validation: envelopeSnapshot.failure };
    }
    const { envelopeBytes } = envelopeSnapshot;
    const inspection = this.#inspect(envelopeBytes);
    if (!inspection.ok) {
      return {
        envelope: null,
        parent: null,
        validation: validatePulse({
          genesis: this.#genesis,
          parent: null,
          envelopeBytes,
          eventPayloadBytes: undefined
        })
      };
    }
    const { envelope } = inspection;
    const payloadSnapshot = this.#snapshotPayload(input);
    if (payloadSnapshot.failure) {
      return { envelope, parent: null, validation: payloadSnapshot.failure };
    }
    const { eventPayloadBytes } = payloadSnapshot;
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

  verifyCandidate(input) {
    return this.#validateDetailed(input).validation;
  }

  evaluateMortality({
    usableKeyIds,
    stateAvailable,
    pendingSuccessors = [],
    authorityLossIrreversible = false
  } = {}) {
    if (this.#forked) {
      return freezeResult({
        status: "forked",
        mortality_classified: false,
        fork_points: [...this.#forkPoints].sort()
      });
    }
    if (!Array.isArray(pendingSuccessors)) {
      throw new TypeError("pendingSuccessors must be an array");
    }
    if (!Array.isArray(usableKeyIds)) {
      throw new TypeError("usableKeyIds must be an array");
    }
    if (typeof stateAvailable !== "boolean") {
      throw new TypeError("stateAvailable must be boolean");
    }
    if (typeof authorityLossIrreversible !== "boolean") {
      throw new TypeError("authorityLossIrreversible must be boolean");
    }

    const latentSuccessors = [];
    const acceptedSuccessors = new Map();
    for (const input of pendingSuccessors) {
      const envelopeSnapshot = this.#snapshotEnvelope(input);
      if (envelopeSnapshot.failure) {
        continue;
      }
      const inspection = this.#inspect(envelopeSnapshot.envelopeBytes);
      if (!inspection.ok) continue;
      const payloadSnapshot = this.#snapshotPayload(input);
      if (payloadSnapshot.failure) continue;
      const candidate = validateLatentSuccessor({
        genesis: this.#genesis,
        parent: this.#head,
        envelopeBytes: envelopeSnapshot.envelopeBytes,
        eventPayloadBytes: payloadSnapshot.eventPayloadBytes
      });
      if (candidate.status === "accept" || candidate.status === "latent") {
        latentSuccessors.push(candidate);
      }
      if (candidate.status === "accept") {
        acceptedSuccessors.set(candidate.object_hash, {
          candidate,
          approvalIds: new Set(
            inspection.envelope.approvals.map((entry) => entry.key_id)
          )
        });
      }
    }

    if (acceptedSuccessors.size > 1) {
      const parentHash = this.#head.object_hash;
      const existingChildren = this.#children.get(parentHash) ?? new Set();
      for (const [childHash, { candidate, approvalIds }] of acceptedSuccessors) {
        this.#nodes.set(childHash, candidate);
        this.#approvalIds.set(childHash, approvalIds);
        existingChildren.add(childHash);
      }
      this.#children.set(parentHash, existingChildren);
      this.#forked = true;
      this.#head = null;
      this.#forkPoints.add(parentHash);
      return freezeResult({
        status: "forked",
        mortality_classified: false,
        fork_points: [...this.#forkPoints].sort()
      });
    }

    return evaluateMortalityState({
      head: this.#head,
      usableKeyIds,
      stateAvailable,
      latentSuccessors,
      authorityLossIrreversible
    });
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
