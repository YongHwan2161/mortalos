import {
  canonicalBytes,
  canonicalize,
  JsonInputError,
  JSON_LIMITS,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import { asBytes, equalBytes } from "./bytes.mjs";
import {
  custodyAcceptanceMessage,
  derivePulseHash,
  eventPayloadHash,
  pulseApprovalMessage,
  verifyEd25519
} from "./crypto.mjs";
import { rejection as reject } from "./rejection-codes.mjs";
import {
  isValidatedAcceptance,
  isValidatedLatentSuccessor,
  isValidatedMortalitySuccessor,
  validateGenesis,
  validateMortalitySuccessor,
  validateOpaqueMortalitySuccessor,
  validatePulse
} from "./validator.mjs";

const arrayIsArray = Array.isArray;
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

export const MORTALITY_LIMITS = Object.freeze({
  pending_records: 128,
  pending_bytes: 4 * 1024 * 1024,
  signature_verifications: 4096,
  usable_key_ids: 16
});

class MortalityLimitExceeded extends Error {
  constructor(resource, observed, maximum) {
    super(`mortality ${resource} limit exceeded`);
    this.name = "MortalityLimitExceeded";
    this.resource = resource;
    this.observed = observed;
    this.maximum = maximum;
  }
}

function snapshotDataArray(value, label, limit = null) {
  let lengthDescriptor;
  try {
    if (!arrayIsArray(value)) throw new TypeError();
    lengthDescriptor = objectGetOwnPropertyDescriptor(value, "length");
  } catch {
    throw new TypeError(`${label} must be an array`);
  }
  const length = lengthDescriptor?.value;
  if (
    !lengthDescriptor ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(length) ||
    length < 0
  ) {
    throw new TypeError(`${label} must have a stable length`);
  }
  if (limit !== null && length > limit.maximum) {
    throw new MortalityLimitExceeded(limit.resource, length, limit.maximum);
  }

  const snapshot = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor;
    try {
      descriptor = objectGetOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new TypeError(`${label} must be an inspectable array`);
    }
    if (!descriptor) {
      throw new TypeError(`${label} must be a dense data-only array`);
    }
    if (!("value" in descriptor)) {
      throw new TypeError(`${label} must contain only own data entries`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function snapshotObserverOptions(value) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError("mortality options must be an object");
  }
  const dataField = (name) => {
    let descriptor;
    try {
      descriptor = objectGetOwnPropertyDescriptor(value, name);
    } catch {
      throw new TypeError("mortality options must be an inspectable record");
    }
    if (descriptor === undefined) return undefined;
    if (!("value" in descriptor)) {
      throw new TypeError(`mortality options.${name} must be an own data property`);
    }
    return descriptor.value;
  };
  return Object.freeze({
    authorityLossIrreversible: dataField("authorityLossIrreversible"),
    pendingSuccessors: dataField("pendingSuccessors"),
    stateAvailable: dataField("stateAvailable"),
    usableKeyIds: dataField("usableKeyIds")
  });
}

function snapshotPendingRecords(value) {
  const references = snapshotDataArray(value, "pendingSuccessors", {
    resource: "pending_records",
    maximum: MORTALITY_LIMITS.pending_records
  });
  let observedBytes = 0;
  return references.map((input, index) => {
    if (input === null || (typeof input !== "object" && typeof input !== "function")) {
      return Object.freeze({});
    }

    const dataField = (name) => {
      let descriptor;
      try {
        descriptor = objectGetOwnPropertyDescriptor(input, name);
      } catch {
        throw new TypeError(`pendingSuccessors[${index}] must be an inspectable record`);
      }
      if (descriptor === undefined) return undefined;
      if (!("value" in descriptor)) {
        throw new TypeError(
          `pendingSuccessors[${index}].${name} must be an own data property`
        );
      }
      return descriptor.value;
    };
    const ownBytes = (source, maxBytes) => {
      if (source === undefined || source === null) return undefined;
      try {
        const stableView = asBytes(source);
        if (
          stableView &&
          stableView.byteLength <= maxBytes &&
          observedBytes + stableView.byteLength > MORTALITY_LIMITS.pending_bytes
        ) {
          throw new MortalityLimitExceeded(
            "pending_bytes",
            observedBytes + stableView.byteLength,
            MORTALITY_LIMITS.pending_bytes
          );
        }
        const owned = snapshotBytes(source, maxBytes);
        const nextObservedBytes = observedBytes + owned.byteLength;
        if (nextObservedBytes > MORTALITY_LIMITS.pending_bytes) {
          throw new MortalityLimitExceeded(
            "pending_bytes",
            nextObservedBytes,
            MORTALITY_LIMITS.pending_bytes
          );
        }
        observedBytes = nextObservedBytes;
        return owned;
      } catch (error) {
        if (error instanceof MortalityLimitExceeded) throw error;
        // Malformed byte fields are retained only as absence of usable evidence.
        // No caller-owned reference crosses into the mortality analysis.
        return undefined;
      }
    };

    const envelopeBytes = ownBytes(
      dataField("envelopeBytes"),
      JSON_LIMITS.envelope_bytes
    );
    const eventPayloadBytes = ownBytes(
      dataField("eventPayloadBytes"),
      JSON_LIMITS.event_payload_bytes
    );
    return Object.freeze({ envelopeBytes, eventPayloadBytes });
  });
}

function freezeResult(value) {
  for (const entry of Object.values(value)) {
    if (Array.isArray(entry)) Object.freeze(entry);
  }
  return Object.freeze(value);
}

function limitExceededResult(error) {
  return freezeResult({
    status: "indeterminate",
    reason: "limit_exceeded",
    mortality_classified: false,
    resource: error.resource,
    observed: error.observed,
    maximum: error.maximum
  });
}

function createVerificationBudget() {
  let used = 0;
  const reserve = (count = 1) => {
    const observed = used + count;
    if (observed > MORTALITY_LIMITS.signature_verifications) {
      throw new MortalityLimitExceeded(
        "signature_verifications",
        observed,
        MORTALITY_LIMITS.signature_verifications
      );
    }
    used = observed;
  };
  return Object.freeze({
    reserve,
    reserveEnvelope(envelope) {
      const approvals = arrayIsArray(envelope?.approvals) ? envelope.approvals.length : 0;
      const acceptances = arrayIsArray(envelope?.acceptances)
        ? envelope.acceptances.length
        : 0;
      reserve(approvals + acceptances);
    },
    verify(publicKey, message, signature) {
      reserve();
      return verifyEd25519(publicKey, message, signature);
    }
  });
}

function requireCondition(condition, message) {
  if (!condition) throw new TypeError(message);
}

const lineageConstructionToken = Symbol("MortalOS Lineage construction");

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
      isValidatedLatentSuccessor(candidate) ||
      isValidatedMortalitySuccessor(candidate);
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
  #evaluatingMortality = false;
  #forked = false;
  #forkPoints = new Set();

  constructor(token, genesis) {
    requireCondition(token === lineageConstructionToken, "Lineage construction is private");
    requireCondition(
      isValidatedAcceptance(genesis) && genesis.kind === "genesis",
      "Lineage requires a validated Genesis"
    );
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

  evaluateMortality(options = {}) {
    if (this.#evaluatingMortality) {
      throw new TypeError("mortality evaluation is already active");
    }
    this.#evaluatingMortality = true;
    try {
      return this.#evaluateMortalityUnsafe(options);
    } catch (error) {
      if (error instanceof MortalityLimitExceeded) {
        return limitExceededResult(error);
      }
      throw error;
    } finally {
      this.#evaluatingMortality = false;
    }
  }

  #evaluateMortalityUnsafe(options = {}) {
    if (this.#forked) {
      return freezeResult({
        status: "forked",
        mortality_classified: false,
        fork_points: [...this.#forkPoints].sort()
      });
    }
    const observerOptions = snapshotObserverOptions(options);
    const usableKeyIdsInput = observerOptions.usableKeyIds;
    const usableKeyIdsSnapshot = snapshotDataArray(usableKeyIdsInput, "usableKeyIds", {
      resource: "usable_key_ids",
      maximum: MORTALITY_LIMITS.usable_key_ids
    });
    const stateAvailable = observerOptions.stateAvailable;
    if (typeof stateAvailable !== "boolean") {
      throw new TypeError("stateAvailable must be boolean");
    }
    const authorityLossInput = observerOptions.authorityLossIrreversible;
    const authorityLossIrreversible = authorityLossInput === undefined
      ? false
      : authorityLossInput;
    if (typeof authorityLossIrreversible !== "boolean") {
      throw new TypeError("authorityLossIrreversible must be boolean");
    }
    const pendingInputValue = observerOptions.pendingSuccessors;
    const pendingInput = pendingInputValue === undefined ? [] : pendingInputValue;
    const pendingSnapshot = snapshotPendingRecords(pendingInput);
    const groups = new Map();
    const payloadsByHash = new Map();
    const observedSignatures = new Set();
    const directlyAcceptedSuccessors = new Map();
    const verificationBudget = createVerificationBudget();

    const rememberPayload = (payload) => {
      const payloadKey = canonicalize(payload);
      const payloadHash = eventPayloadHash(payload);
      let payloads = payloadsByHash.get(payloadHash);
      if (!payloads) {
        payloads = new Map();
        payloadsByHash.set(payloadHash, payloads);
      }
      payloads.set(payloadKey, payload);
    };
    for (const input of pendingSnapshot) {
      const envelopeSnapshot = this.#snapshotEnvelope(input);
      const payloadSnapshot = this.#snapshotPayload(input);
      if (!payloadSnapshot.failure) {
        try {
          rememberPayload(
            parseJsonBytes(payloadSnapshot.eventPayloadBytes, {
              maxBytes: JSON_LIMITS.event_payload_bytes,
              maxDepth: JSON_LIMITS.max_depth
            })
          );
        } catch (error) {
          if (!(error instanceof JsonInputError)) throw error;
        }
      }

      if (envelopeSnapshot.failure) continue;
      const inspection = this.#inspect(envelopeSnapshot.envelopeBytes);
      if (!inspection.ok) continue;
      const envelope = inspection.envelope;
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) continue;

      let canonicalCarrier = false;
      try {
        canonicalCarrier = equalBytes(
          envelopeSnapshot.envelopeBytes,
          canonicalBytes(envelope)
        );
      } catch {
        // Parsed JSON is expected to be canonicalizable. Treat any failure as an
        // untrusted carrier rather than letting it affect mortality.
      }

      if (!payloadSnapshot.failure) {
        verificationBudget.reserveEnvelope(envelope);
        const direct = validatePulse({
          genesis: this.#genesis,
          parent: this.#head,
          envelopeBytes: envelopeSnapshot.envelopeBytes,
          eventPayloadBytes: payloadSnapshot.eventPayloadBytes
        });
        if (direct.status === "accept") {
          directlyAcceptedSuccessors.set(direct.object_hash, {
            candidate: direct,
            approvalIds: new Set(envelope.approvals.map((entry) => entry.key_id))
          });
        }
      }

      for (const entries of [envelope.approvals, envelope.acceptances]) {
        if (!Array.isArray(entries)) continue;
        for (const evidence of entries) {
          if (typeof evidence?.signature === "string") {
            observedSignatures.add(evidence.signature);
          }
        }
      }
      if (
        envelope.body &&
        typeof envelope.body === "object" &&
        !Array.isArray(envelope.body)
      ) {
        const groupKey = canonicalize(envelope.body);
        let group = groups.get(groupKey);
        if (!group) {
          group = { body: envelope.body, hasCanonicalCarrier: false };
          groups.set(groupKey, group);
        }
        group.hasCanonicalCarrier ||= canonicalCarrier;
      }
    }

    const currentDescriptor = this.#head.next_custody_descriptor;
    const sortedObservedSignatures = [...observedSignatures].sort();
    const allCurrentKeyIds = currentDescriptor.custodians.map((entry) => entry.key_id);
    const currentById = new Map(
      currentDescriptor.custodians.map((entry) => [entry.key_id, entry])
    );
    const preparedGroups = [];
    const signerBodies = new Map();

    const recordSignerBodies = (keyIds, bodyHash) => {
      for (const keyId of keyIds) {
        const bodyHashes = signerBodies.get(keyId) ?? new Set();
        bodyHashes.add(bodyHash);
        signerBodies.set(keyId, bodyHashes);
      }
    };

    const expectedSequence = (BigInt(this.#head.sequence) + 1n).toString();
    for (const group of groups.values()) {
      const body = group.body;
      if (
        body?.organism_id !== this.#head.organism_id ||
        body?.sequence !== expectedSequence ||
        body?.parent_hash !== this.#head.object_hash
      ) {
        continue;
      }
      const approvalMessage = pulseApprovalMessage(body);
      const bodyHash = derivePulseHash(body);
      for (const signer of currentDescriptor.custodians) {
        if (sortedObservedSignatures.some((signature) =>
          verificationBudget.verify(signer.public_key, approvalMessage, signature)
        )) {
          recordSignerBodies([signer.key_id], bodyHash);
        }
      }
    }

    for (const group of groups.values()) {
      const skeletonEnvelope = {
        acceptances: [],
        approvals: [],
        body: group.body,
        kind: "mortalos.pulse"
      };
      let validatedPayload = null;
      let structuralCapability = null;
      const payloads = new Map(
        payloadsByHash.get(group.body?.event?.payload_hash) ?? []
      );
      if (group.body?.event?.kind === "heartbeat") {
        const heartbeatPayload = {};
        payloads.set(canonicalize(heartbeatPayload), heartbeatPayload);
      }
      for (const payloadKey of [...payloads.keys()].sort()) {
        const payload = payloads.get(payloadKey);
        const skeleton = validateMortalitySuccessor(
          {
            genesis: this.#genesis,
            parent: this.#head,
            envelopeBytes: canonicalBytes(skeletonEnvelope),
            eventPayloadBytes: canonicalBytes(payload)
          },
          allCurrentKeyIds
        );
        if (skeleton.status !== "reject") {
          validatedPayload = payload;
          structuralCapability = skeleton;
          break;
        }
      }
      if (
        validatedPayload === null &&
        payloads.size === 0 &&
        group.body?.event?.kind === "membership-change"
      ) {
        const opaque = validateOpaqueMortalitySuccessor(
          {
            genesis: this.#genesis,
            parent: this.#head,
            envelopeBytes: canonicalBytes(skeletonEnvelope)
          },
          allCurrentKeyIds
        );
        if (opaque.status !== "reject") structuralCapability = opaque;
      }
      if (structuralCapability === null) continue;

      const nextById = new Map(
        group.body.next_custodians.map((entry) => [entry.key_id, entry])
      );
      const newIds = new Set(
        [...nextById.keys()].filter((keyId) => !currentById.has(keyId))
      );
      const approvals = new Map();
      const acceptances = new Map();
      const approvalMessage = pulseApprovalMessage(group.body);
      const acceptanceMessage = custodyAcceptanceMessage(group.body);

      for (const signature of sortedObservedSignatures) {
        for (const signer of currentDescriptor.custodians) {
          if (!verificationBudget.verify(signer.public_key, approvalMessage, signature)) {
            continue;
          }
          const normalized = { key_id: signer.key_id, signature };
          const existing = approvals.get(signer.key_id);
          if (!existing || signature < existing.signature) {
            approvals.set(signer.key_id, normalized);
          }
        }
        for (const keyId of [...newIds].sort()) {
          const signer = nextById.get(keyId);
          if (!verificationBudget.verify(signer.public_key, acceptanceMessage, signature)) {
            continue;
          }
          const normalized = { key_id: keyId, signature };
          const existing = acceptances.get(keyId);
          if (!existing || signature < existing.signature) {
            acceptances.set(keyId, normalized);
          }
        }
      }

      const combinedEnvelope = {
        acceptances: [...acceptances.values()].sort((left, right) =>
          left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0
        ),
        approvals: [...approvals.values()].sort((left, right) =>
          left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0
        ),
        body: group.body,
        kind: "mortalos.pulse"
      };
      recordSignerBodies(approvals.keys(), structuralCapability.object_hash);
      preparedGroups.push({
        acceptances,
        approvals,
        combinedEnvelope,
        hasCanonicalCarrier: group.hasCanonicalCarrier,
        objectHash: structuralCapability.object_hash,
        payload: validatedPayload,
        payloadAvailable: validatedPayload !== null
      });
    }

    const recordStrictFork = (acceptedSuccessors) => {
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
    };

    if (directlyAcceptedSuccessors.size > 1) {
      return recordStrictFork(directlyAcceptedSuccessors);
    }

    const reconstructedAcceptances = new Map();
    for (const group of preparedGroups) {
      if (!group.payloadAvailable) continue;
      verificationBudget.reserveEnvelope(group.combinedEnvelope);
      const candidate = validatePulse({
        genesis: this.#genesis,
        parent: this.#head,
        envelopeBytes: canonicalBytes(group.combinedEnvelope),
        eventPayloadBytes: canonicalBytes(group.payload)
      });
      if (candidate.status === "accept") {
        reconstructedAcceptances.set(group.objectHash, {
          candidate,
          approvalIds: new Set(group.approvals.keys()),
          promotable: group.hasCanonicalCarrier
        });
      }
    }

    const promotableReconstructed = [...reconstructedAcceptances]
      .filter(([, entry]) => entry.promotable);
    if (promotableReconstructed.length > 1) {
      return recordStrictFork(
        new Map(
          promotableReconstructed.map(([hash, entry]) => [hash, {
            candidate: entry.candidate,
            approvalIds: entry.approvalIds
          }])
        )
      );
    }

    const equivocatingKeyIds = [...signerBodies]
      .filter(([, bodyHashes]) => bodyHashes.size > 1)
      .map(([keyId]) => keyId)
      .sort();
    if (equivocatingKeyIds.length > 0) {
      return freezeResult({
        status: "evidence_equivocation",
        mortality_classified: false,
        equivocating_key_ids: equivocatingKeyIds
      });
    }

    const usable = new Set(
      usableKeyIdsSnapshot.filter((keyId) => currentById.has(keyId))
    );
    const freshUsable = new Set(
      [...usable].filter((keyId) => !signerBodies.has(keyId))
    );
    const latentSuccessors = [];
    const payloadUnavailableHashes = new Set();

    for (const group of preparedGroups) {
      const usableForBody = [...usable].filter((keyId) => {
        const signedBodies = signerBodies.get(keyId);
        return !signedBodies || signedBodies.has(group.objectHash);
      });
      const combinedInput = {
        genesis: this.#genesis,
        parent: this.#head,
        envelopeBytes: canonicalBytes(group.combinedEnvelope)
      };

      if (!group.payloadAvailable) {
        verificationBudget.reserveEnvelope(group.combinedEnvelope);
        const candidate = validateOpaqueMortalitySuccessor(
          combinedInput,
          usableForBody
        );
        if (candidate.status !== "reject") {
          payloadUnavailableHashes.add(group.objectHash);
        }
        continue;
      }

      combinedInput.eventPayloadBytes = canonicalBytes(group.payload);
      const completeCandidate = reconstructedAcceptances.get(group.objectHash)?.candidate;
      if (completeCandidate === undefined) {
        verificationBudget.reserveEnvelope(group.combinedEnvelope);
      }
      const candidate =
        completeCandidate ?? validateMortalitySuccessor(combinedInput, usableForBody);
      if (candidate.status === "accept" || candidate.status === "latent") {
        latentSuccessors.push(candidate);
      }
    }

    if (
      authorityLossIrreversible &&
      freshUsable.size < currentDescriptor.quorum.threshold &&
      latentSuccessors.length === 0 &&
      payloadUnavailableHashes.size > 0
    ) {
      return freezeResult({
        status: "evidence_payload_unavailable",
        mortality_classified: false,
        pending_body_hashes: [...payloadUnavailableHashes].sort()
      });
    }

    return evaluateMortalityState({
      head: this.#head,
      usableKeyIds: [...freshUsable],
      stateAvailable,
      latentSuccessors,
      authorityLossIrreversible
    });
  }

  append(input) {
    if (this.#evaluatingMortality) {
      return reject("E_VALIDATOR_INTERNAL", "", "mortality-evaluation-active");
    }
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
  return Object.freeze({
    status: "accept",
    lineage: new Lineage(lineageConstructionToken, genesis)
  });
}
