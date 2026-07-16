import {
  canonicalBytes,
  canonicalize,
  isJsonInputError,
  JSON_LIMITS,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import { asBytes, byteLengthOfBytes, equalBytes, utf8Bytes } from "./bytes.mjs";
import {
  cryptoRuntimeIntact,
  custodyAcceptanceMessage,
  decodeTagged,
  derivePulseHash,
  eventPayloadHash,
  pulseApprovalMessage,
  verifyEd25519
} from "./crypto.mjs";
import {
  bigInt,
  bigIntToString,
  arrayLength,
  arraySort,
  copyBoundedOwnDataArray,
  createArray,
  createWeakSet,
  defineArrayIndex,
  defineOwnDataProperty,
  freeze,
  isArray,
  numberIsSafeInteger,
  objectKeys,
  objectValues,
  ownDataArrayLength,
  ownDataRecordEntry,
  realmIntrinsicsIntact,
  snapshotNamedOwnDataValues,
  snapshotOwnDataRecord,
  setValues,
  typeError,
  weakSetAdd,
  weakSetHas
} from "./primordials.mjs";
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

export const MORTALITY_LIMITS = freeze({
  candidate_bodies: 128,
  candidate_canonical_bytes: 4 * 1024 * 1024,
  pending_records: 128,
  pending_bytes: 4 * 1024 * 1024,
  signature_verifications: 1152,
  usable_key_id_chars: 16 * 48,
  usable_key_ids: 16
});

const mortalityLimitErrorBrands = createWeakSet();

function throwMortalityLimit(resource, maximum) {
  const error = typeError(`mortality ${resource} limit exceeded`);
  defineOwnDataProperty(error, "name", "MortalityLimitExceeded");
  defineOwnDataProperty(error, "resource", resource);
  defineOwnDataProperty(error, "observed", maximum + 1);
  defineOwnDataProperty(error, "maximum", maximum);
  weakSetAdd(mortalityLimitErrorBrands, error);
  throw freeze(error);
}

function isMortalityLimitError(value) {
  return weakSetHas(mortalityLimitErrorBrands, value);
}

function assertMortalityRuntimeIntact() {
  if (!realmIntrinsicsIntact()) {
    throw typeError("mortality observation changed realm intrinsics");
  }
  if (!cryptoRuntimeIntact()) {
    throw typeError("mortality observation changed trusted crypto state");
  }
}

function snapshotDataArray(value, label, limit = null) {
  let length;
  try {
    length = ownDataArrayLength(value, label);
  } catch {
    throw typeError(`${label} must be a dense ordinary data array`);
  }
  if (limit !== null && length > limit.maximum) {
    throwMortalityLimit(limit.resource, limit.maximum);
  }
  try {
    return copyBoundedOwnDataArray(value, length, label);
  } catch {
    throw typeError(`${label} must be a dense ordinary data array`);
  }
}

function snapshotObserverOptions(value) {
  let fields;
  try {
    fields = snapshotNamedOwnDataValues(value, [
      "authorityLossIrreversible",
      "latentEvidenceComplete",
      "pendingSuccessors",
      "stateAvailable",
      "usableKeyIds"
    ], "mortality options");
  } catch {
    throw typeError("mortality options must expose only ordinary own data properties");
  }
  return freeze({
    authorityLossIrreversible: fields[0],
    latentEvidenceComplete: fields[1],
    pendingSuccessors: fields[2],
    stateAvailable: fields[3],
    usableKeyIds: fields[4]
  });
}

function snapshotUsableKeyIds(value) {
  const references = snapshotDataArray(value, "usableKeyIds", {
    resource: "usable_key_ids",
    maximum: MORTALITY_LIMITS.usable_key_ids
  });
  let observedChars = 0;
  for (let index = 0; index < references.length; index += 1) {
    const keyId = references[index];
    if (typeof keyId !== "string") {
      throw typeError("usableKeyIds entries must be canonical peer IDs");
    }
    const nextObservedChars = observedChars + keyId.length;
    if (nextObservedChars > MORTALITY_LIMITS.usable_key_id_chars) {
      throwMortalityLimit(
        "usable_key_id_chars",
        MORTALITY_LIMITS.usable_key_id_chars
      );
    }
    observedChars = nextObservedChars;
    if (decodeTagged(keyId, "peer:", 32) === null) {
      throw typeError("usableKeyIds entries must be canonical peer IDs");
    }
  }
  return references;
}

function snapshotPendingRecords(value) {
  const references = snapshotDataArray(value, "pendingSuccessors", {
    resource: "pending_records",
    maximum: MORTALITY_LIMITS.pending_records
  });
  let observedBytes = 0;
  const snapshots = createArray(references.length);
  for (let index = 0; index < references.length; index += 1) {
    const input = references[index];
    let fields;
    try {
      fields = snapshotNamedOwnDataValues(input, [
        "envelopeBytes",
        "eventPayloadBytes"
      ], `pendingSuccessors[${index}]`);
    } catch {
      throw typeError("mortality carriers must expose only ordinary own data properties");
    }
    const envelopeSource = fields[0];
    const payloadSource = fields[1];
    if (
      (envelopeSource === undefined || envelopeSource === null) &&
      (payloadSource === undefined || payloadSource === null)
    ) {
      throw typeError("mortality carrier must contain an envelope or event-payload source");
    }
    const ownBytes = (source, maxBytes, label) => {
      if (source === undefined || source === null) return null;
      const view = asBytes(source);
      const sourceLength = view === null ? null : byteLengthOfBytes(view);
      if (sourceLength === null || sourceLength > maxBytes) {
        throw typeError(`mortality ${label} source could not be snapshotted`);
      }
      if (observedBytes + sourceLength > MORTALITY_LIMITS.pending_bytes) {
        throwMortalityLimit("pending_bytes", MORTALITY_LIMITS.pending_bytes);
      }
      let owned;
      try {
        owned = snapshotBytes(source, maxBytes);
      } catch {
        throw typeError(`mortality ${label} source could not be snapshotted`);
      }
      const ownedLength = byteLengthOfBytes(owned);
      if (ownedLength === null || ownedLength !== sourceLength) {
        throw typeError(`mortality ${label} source changed during snapshot`);
      }
      if (observedBytes + ownedLength > MORTALITY_LIMITS.pending_bytes) {
        throwMortalityLimit("pending_bytes", MORTALITY_LIMITS.pending_bytes);
      }
      observedBytes += ownedLength;
      return owned;
    };

    const envelopeBytes = ownBytes(
      envelopeSource,
      JSON_LIMITS.envelope_bytes,
      "envelope"
    );
    const eventPayloadBytes = ownBytes(
      payloadSource,
      JSON_LIMITS.event_payload_bytes,
      "event-payload"
    );
    defineArrayIndex(snapshots, index, freeze({ envelopeBytes, eventPayloadBytes }));
  }
  return snapshots;
}

function freezeResult(value) {
  const entries = objectValues(value);
  for (let index = 0; index < entries.length; index += 1) {
    if (isArray(entries[index])) freeze(entries[index]);
  }
  return freeze(value);
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
    if (!numberIsSafeInteger(count) || count < 0) {
      throw typeError("mortality signature budget received an invalid reservation");
    }
    if (
      count > MORTALITY_LIMITS.signature_verifications - used
    ) {
      throwMortalityLimit(
        "signature_verifications",
        MORTALITY_LIMITS.signature_verifications
      );
    }
    used += count;
  };
  return freeze({
    reserve,
    reserveEnvelope(envelope) {
      const approvals = isArray(envelope?.approvals)
        ? arrayLength(envelope.approvals)
        : 0;
      const acceptances = isArray(envelope?.acceptances)
        ? arrayLength(envelope.acceptances)
        : 0;
      reserve(approvals + acceptances);
    },
    verify(publicKey, message, signature) {
      reserve();
      return verifyEd25519(publicKey, message, signature);
    }
  });
}

function createCandidateBudget() {
  let observedBodies = 0;
  let observedCanonicalBytes = 0;
  return freeze({
    reserveBody() {
      if (observedBodies >= MORTALITY_LIMITS.candidate_bodies) {
        throwMortalityLimit(
          "candidate_bodies",
          MORTALITY_LIMITS.candidate_bodies
        );
      }
      observedBodies += 1;
    },
    reserveCanonicalBytes(count) {
      if (!numberIsSafeInteger(count) || count < 0) {
        throw typeError("mortality candidate byte budget received an invalid reservation");
      }
      if (
        count > MORTALITY_LIMITS.candidate_canonical_bytes - observedCanonicalBytes
      ) {
        throwMortalityLimit(
          "candidate_canonical_bytes",
          MORTALITY_LIMITS.candidate_canonical_bytes
        );
      }
      observedCanonicalBytes += count;
    }
  });
}

function requireCondition(condition, message) {
  if (!condition) throw typeError(message);
}

function requireObservationResult(result) {
  if (result.status === "reject" && result.code === "E_VALIDATOR_INTERNAL") {
    throw typeError("mortality observation could not complete validation");
  }
  return result;
}

const lineageConstructionToken = Symbol("MortalOS Lineage construction");

function evaluateMortalityState({
  head,
  usableKeyIds,
  stateAvailable,
  latentSuccessors = [],
  authorityLossIrreversible = false,
  latentEvidenceComplete = false
}) {
  requireCondition(isValidatedAcceptance(head), "head must be a validated acceptance");
  requireCondition(Array.isArray(usableKeyIds), "usableKeyIds must be an array");
  requireCondition(typeof stateAvailable === "boolean", "stateAvailable must be boolean");
  requireCondition(Array.isArray(latentSuccessors), "latentSuccessors must be an array");
  requireCondition(
    typeof authorityLossIrreversible === "boolean",
    "authorityLossIrreversible must be boolean"
  );
  requireCondition(
    typeof latentEvidenceComplete === "boolean",
    "latentEvidenceComplete must be boolean"
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
  const common = {
    usable_keys: usable.size,
    threshold,
    latent_successors: latentSuccessorCount,
    latent_evidence_complete: latentEvidenceComplete
  };

  if (authorityViable && stateAvailable) {
    return freeze({
      status: "operationally_alive",
      authority_viable: true,
      state_viable: true,
      ...common
    });
  }
  if (authorityViable) {
    return freeze({
      status: "state_stalled",
      authority_viable: true,
      state_viable: false,
      ...common
    });
  }
  if (latentSuccessorCount > 0) {
    return freeze({
      status: "latent_successor_not_dead",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      ...common
    });
  }
  if (authorityLossIrreversible && latentEvidenceComplete) {
    return freeze({
      status: "dead_under_v0_assumptions",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      ...common
    });
  }
  return freeze({
    status: "authority_unavailable_not_proven_dead",
    authority_viable: false,
    state_viable: Boolean(stateAvailable),
    ...common
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
      if (isJsonInputError(error)) return { ok: false };
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
          isJsonInputError(error)
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
          isJsonInputError(error)
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
      throw typeError("mortality evaluation is already active");
    }
    this.#evaluatingMortality = true;
    try {
      return this.#evaluateMortalityUnsafe(options);
    } catch (error) {
      if (isMortalityLimitError(error)) {
        assertMortalityRuntimeIntact();
        return limitExceededResult(error);
      }
      throw error;
    } finally {
      this.#evaluatingMortality = false;
    }
  }

  #evaluateMortalityUnsafe(options = {}) {
    if (this.#forked) {
      assertMortalityRuntimeIntact();
      return freezeResult({
        status: "forked",
        mortality_classified: false,
        fork_points: arraySort(setValues(this.#forkPoints))
      });
    }
    const observerOptions = snapshotObserverOptions(options);
    const usableKeyIdsInput = observerOptions.usableKeyIds;
    const usableKeyIdsSnapshot = snapshotUsableKeyIds(usableKeyIdsInput);
    const stateAvailable = observerOptions.stateAvailable;
    if (typeof stateAvailable !== "boolean") {
      throw typeError("stateAvailable must be boolean");
    }
    const authorityLossInput = observerOptions.authorityLossIrreversible;
    const authorityLossIrreversible = authorityLossInput === undefined
      ? false
      : authorityLossInput;
    if (typeof authorityLossIrreversible !== "boolean") {
      throw typeError("authorityLossIrreversible must be boolean");
    }
    const completenessInput = observerOptions.latentEvidenceComplete;
    const latentEvidenceComplete = completenessInput === undefined
      ? false
      : completenessInput;
    if (typeof latentEvidenceComplete !== "boolean") {
      throw typeError("latentEvidenceComplete must be boolean");
    }
    const pendingInputValue = observerOptions.pendingSuccessors;
    const pendingInput = pendingInputValue === undefined ? [] : pendingInputValue;
    const pendingSnapshot = snapshotPendingRecords(pendingInput);
    assertMortalityRuntimeIntact();
    const groups = new Map();
    const candidateGroupsByObject = new Map();
    const payloadsByHash = new Map();
    const observedSignatures = new Set();
    const directlyAcceptedSuccessors = new Map();
    const candidateBudget = createCandidateBudget();
    const verificationBudget = createVerificationBudget();
    const expectedSequence = bigIntToString(bigInt(this.#head.sequence) + 1n);

    const rememberCandidateBody = (value, hasCanonicalCarrier = false) => {
      if (value === null || typeof value !== "object" || isArray(value)) return;
      const descriptors = snapshotOwnDataRecord(value, "parsed mortality candidate");
      const organismId = ownDataRecordEntry(descriptors, "organism_id");
      const sequence = ownDataRecordEntry(descriptors, "sequence");
      const parentHash = ownDataRecordEntry(descriptors, "parent_hash");
      if (
        !organismId.present ||
        organismId.value !== this.#head.organism_id ||
        !sequence.present ||
        sequence.value !== expectedSequence ||
        !parentHash.present ||
        parentHash.value !== this.#head.object_hash
      ) {
        return;
      }
      candidateBudget.reserveBody();
      const groupKey = canonicalize(value);
      const groupByteLength = byteLengthOfBytes(utf8Bytes(groupKey));
      if (groupByteLength === null) {
        throw typeError("mortality candidate canonical bytes could not be measured");
      }
      candidateBudget.reserveCanonicalBytes(groupByteLength);
      let group = groups.get(groupKey);
      if (!group) {
        group = {
          body: value,
          hasCanonicalCarrier: false
        };
        groups.set(groupKey, group);
      }
      group.hasCanonicalCarrier ||= hasCanonicalCarrier;
      candidateGroupsByObject.set(value, group);
    };

    const rememberArtifacts = (value) => {
      if (typeof value === "string") {
        if (decodeTagged(value, "ed25519:", 64) !== null) {
          observedSignatures.add(value);
        }
        return;
      }
      if (value === null || typeof value !== "object") return;
      if (!isArray(value)) {
        rememberCandidateBody(value);
        const keys = objectKeys(value);
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index];
          if (decodeTagged(key, "ed25519:", 64) !== null) {
            observedSignatures.add(key);
          }
        }
      }
      const entries = objectValues(value);
      for (let index = 0; index < entries.length; index += 1) {
        rememberArtifacts(entries[index]);
      }
    };

    const rememberPayload = (payload) => {
      rememberArtifacts(payload);
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
      if (input.eventPayloadBytes !== null) {
        try {
          rememberPayload(
            parseJsonBytes(input.eventPayloadBytes, {
              maxBytes: JSON_LIMITS.event_payload_bytes,
              maxDepth: JSON_LIMITS.max_depth
            })
          );
        } catch (error) {
          if (!isJsonInputError(error)) throw error;
          throw typeError("mortality event-payload bytes could not be parsed");
        }
      }

      if (input.envelopeBytes === null) continue;
      const inspection = this.#inspect(input.envelopeBytes);
      if (!inspection.ok) {
        throw typeError("mortality envelope bytes could not be parsed");
      }
      const envelope = inspection.envelope;
      rememberArtifacts(envelope);
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) continue;

      let canonicalCarrier = false;
      try {
        canonicalCarrier = equalBytes(
          input.envelopeBytes,
          canonicalBytes(envelope)
        );
      } catch {
        // Parsed JSON is expected to be canonicalizable. Treat any failure as an
        // untrusted carrier rather than letting it affect mortality.
      }

      if (input.eventPayloadBytes !== null) {
        verificationBudget.reserveEnvelope(envelope);
        const direct = requireObservationResult(validatePulse({
          genesis: this.#genesis,
          parent: this.#head,
          envelopeBytes: input.envelopeBytes,
          eventPayloadBytes: input.eventPayloadBytes
        }));
        if (direct.status === "accept") {
          directlyAcceptedSuccessors.set(direct.object_hash, {
            candidate: direct,
            approvalIds: new Set(envelope.approvals.map((entry) => entry.key_id))
          });
        }
      }

      const carrierGroup = candidateGroupsByObject.get(envelope.body);
      if (carrierGroup) carrierGroup.hasCanonicalCarrier ||= canonicalCarrier;
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
      const currentApprovals = new Map();
      for (const signature of sortedObservedSignatures) {
        for (const signer of currentDescriptor.custodians) {
          if (!verificationBudget.verify(signer.public_key, approvalMessage, signature)) {
            continue;
          }
          const normalized = { key_id: signer.key_id, signature };
          const existing = currentApprovals.get(signer.key_id);
          if (!existing || signature < existing.signature) {
            currentApprovals.set(signer.key_id, normalized);
          }
        }
      }
      group.bodyHash = bodyHash;
      group.currentApprovals = currentApprovals;
      recordSignerBodies(currentApprovals.keys(), bodyHash);
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
        const skeleton = requireObservationResult(validateMortalitySuccessor(
          {
            genesis: this.#genesis,
            parent: this.#head,
            envelopeBytes: canonicalBytes(skeletonEnvelope),
            eventPayloadBytes: canonicalBytes(payload)
          },
          allCurrentKeyIds
        ));
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
        const opaque = requireObservationResult(validateOpaqueMortalitySuccessor(
          {
            genesis: this.#genesis,
            parent: this.#head,
            envelopeBytes: canonicalBytes(skeletonEnvelope)
          },
          allCurrentKeyIds
        ));
        if (opaque.status !== "reject") structuralCapability = opaque;
      }
      if (structuralCapability === null) continue;

      const nextById = new Map(
        group.body.next_custodians.map((entry) => [entry.key_id, entry])
      );
      const newIds = new Set(
        [...nextById.keys()].filter((keyId) => !currentById.has(keyId))
      );
      const approvals = new Map(group.currentApprovals);
      const acceptances = new Map();
      const acceptanceMessage = custodyAcceptanceMessage(group.body);

      for (const signature of sortedObservedSignatures) {
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
      preparedGroups.push({
        acceptances,
        approvals,
        combinedEnvelope,
        hasCanonicalCarrier: group.hasCanonicalCarrier,
        objectHash: group.bodyHash,
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
        fork_points: arraySort(setValues(this.#forkPoints))
      });
    };

    if (directlyAcceptedSuccessors.size > 1) {
      return recordStrictFork(directlyAcceptedSuccessors);
    }

    const reconstructedAcceptances = new Map();
    for (const group of preparedGroups) {
      if (!group.payloadAvailable) continue;
      verificationBudget.reserveEnvelope(group.combinedEnvelope);
      const candidate = requireObservationResult(validatePulse({
        genesis: this.#genesis,
        parent: this.#head,
        envelopeBytes: canonicalBytes(group.combinedEnvelope),
        eventPayloadBytes: canonicalBytes(group.payload)
      }));
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
        const candidate = requireObservationResult(validateOpaqueMortalitySuccessor(
          combinedInput,
          usableForBody
        ));
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
        completeCandidate ?? requireObservationResult(
          validateMortalitySuccessor(combinedInput, usableForBody)
        );
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
      authorityLossIrreversible,
      latentEvidenceComplete
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
      fork_points: freeze(forkPoints)
    });
  }
}

freeze(Lineage.prototype);
freeze(Lineage);

export function createLineage(genesisEnvelopeBytes) {
  const genesis = validateGenesis(genesisEnvelopeBytes);
  if (genesis.status !== "accept") return genesis;
  return freeze({
    status: "accept",
    lineage: freeze(new Lineage(lineageConstructionToken, genesis))
  });
}
