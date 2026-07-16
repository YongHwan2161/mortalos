import {
  canonicalBytes,
  canonicalize,
  isJsonInputError,
  JSON_LIMITS,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import { byteLengthOfBytes, equalBytes } from "./bytes.mjs";
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
  assertOrdinaryDataRecord,
  bigInt,
  bigIntToString,
  createArray,
  createTextEncoder,
  createWeakSet,
  defineArrayIndex,
  defineOwnDataProperty,
  freeze,
  isArray,
  objectKeys,
  objectValues,
  ordinaryArrayLength,
  ownDataProperty,
  ownDataRecordEntry,
  realmIntrinsicsIntact,
  snapshotOwnDataRecord,
  textEncoderEncode,
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

const mortalityLimitBrands = createWeakSet();

class MortalityLimitExceeded extends Error {
  constructor(resource, maximum) {
    super(`mortality ${resource} limit exceeded`);
    weakSetAdd(mortalityLimitBrands, this);
    defineOwnDataProperty(this, "name", "MortalityLimitExceeded");
    defineOwnDataProperty(this, "resource", resource);
    defineOwnDataProperty(this, "observed", maximum + 1);
    defineOwnDataProperty(this, "maximum", maximum);
  }
}
freeze(MortalityLimitExceeded.prototype);
freeze(MortalityLimitExceeded);

function snapshotDataArray(value, label, limit = null) {
  let length;
  try {
    length = ordinaryArrayLength(value, label);
  } catch {
    throw typeError(`${label} must be a dense ordinary data array`);
  }
  if (limit !== null && length > limit.maximum) {
    throw new MortalityLimitExceeded(limit.resource, limit.maximum);
  }
  const snapshot = createArray(length);
  for (let index = 0; index < length; index += 1) {
    let entry;
    try {
      entry = ownDataProperty(value, `${index}`, label);
    } catch {
      throw typeError(`${label} must contain only own data entries`);
    }
    if (!entry.present) {
      throw typeError(`${label} must be a dense ordinary data array`);
    }
    defineArrayIndex(snapshot, index, entry.value);
  }
  return snapshot;
}

function snapshotObserverOptions(value) {
  try {
    assertOrdinaryDataRecord(value, "mortality options");
  } catch {
    throw typeError("mortality options must expose only ordinary own data properties");
  }
  const dataField = (name) => {
    try {
      const entry = ownDataProperty(value, name, "mortality options");
      return entry.present ? entry.value : undefined;
    } catch {
      throw typeError(`mortality options.${name} must be an own data property`);
    }
  };
  return freeze({
    authorityLossIrreversible: dataField("authorityLossIrreversible"),
    latentEvidenceComplete: dataField("latentEvidenceComplete"),
    pendingSuccessors: dataField("pendingSuccessors"),
    stateAvailable: dataField("stateAvailable"),
    usableKeyIds: dataField("usableKeyIds")
  });
}

function snapshotUsableKeyIds(value) {
  const references = snapshotDataArray(value, "usableKeyIds", {
    resource: "usable_key_ids",
    maximum: MORTALITY_LIMITS.usable_key_ids
  });
  let observedChars = 0;
  const snapshot = createArray(references.length);
  for (let index = 0; index < references.length; index += 1) {
    const keyId = references[index];
    if (typeof keyId !== "string") {
      throw typeError("usableKeyIds entries must be canonical peer IDs");
    }
    const nextObservedChars = observedChars + keyId.length;
    if (nextObservedChars > MORTALITY_LIMITS.usable_key_id_chars) {
      throw new MortalityLimitExceeded(
        "usable_key_id_chars",
        MORTALITY_LIMITS.usable_key_id_chars
      );
    }
    observedChars = nextObservedChars;
    if (decodeTagged(keyId, "peer:", 32) === null) {
      throw typeError("usableKeyIds entries must be canonical peer IDs");
    }
    defineArrayIndex(snapshot, index, keyId);
  }
  return snapshot;
}

function snapshotPendingRecords(value) {
  const references = snapshotDataArray(value, "pendingSuccessors", {
    resource: "pending_records",
    maximum: MORTALITY_LIMITS.pending_records
  });
  const snapshots = createArray(references.length);
  let observedBytes = 0;
  for (let index = 0; index < references.length; index += 1) {
    const input = references[index];
    try {
      assertOrdinaryDataRecord(input, `pendingSuccessors[${index}]`);
    } catch {
      throw typeError("mortality carriers must expose only ordinary own data properties");
    }
    const dataField = (name) => {
      try {
        const entry = ownDataProperty(
          input,
          name,
          `pendingSuccessors[${index}]`
        );
        return entry.present ? entry.value : undefined;
      } catch {
        throw typeError(
          `pendingSuccessors[${index}].${name} must be an own data property`
        );
      }
    };
    const envelopeSource = dataField("envelopeBytes");
    const payloadSource = dataField("eventPayloadBytes");
    if (
      (envelopeSource === undefined || envelopeSource === null) &&
      (payloadSource === undefined || payloadSource === null)
    ) {
      throw typeError("mortality carrier must contain an envelope or event-payload source");
    }
    const ownBytes = (source, maxBytes, label) => {
      if (source === undefined || source === null) return null;
      let owned;
      try {
        owned = snapshotBytes(source, maxBytes);
      } catch {
        throw typeError(`mortality ${label} source could not be snapshotted`);
      }
      const byteLength = byteLengthOfBytes(owned);
      if (byteLength === null) {
        throw typeError(`mortality ${label} source could not be snapshotted`);
      }
      const nextObservedBytes = observedBytes + byteLength;
      if (nextObservedBytes > MORTALITY_LIMITS.pending_bytes) {
        throw new MortalityLimitExceeded(
          "pending_bytes",
          MORTALITY_LIMITS.pending_bytes
        );
      }
      observedBytes = nextObservedBytes;
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

function requireCondition(condition, message) {
  if (!condition) throw typeError(message);
}

function requireObservationResult(result) {
  if (result.status === "reject" && result.code === "E_VALIDATOR_INTERNAL") {
    throw typeError("mortality observation could not complete validation");
  }
  return result;
}

function assertMortalityRuntimeIntact() {
  if (!realmIntrinsicsIntact()) {
    throw typeError("mortality observation changed realm intrinsics");
  }
  if (!cryptoRuntimeIntact()) {
    throw typeError("mortality observation changed trusted crypto state");
  }
}

function createVerificationBudget() {
  let used = 0;
  const reserve = (count = 1) => {
    const observed = used + count;
    if (observed > MORTALITY_LIMITS.signature_verifications) {
      throw new MortalityLimitExceeded(
        "signature_verifications",
        MORTALITY_LIMITS.signature_verifications
      );
    }
    used = observed;
  };
  return freeze({
    reserve,
    reserveEnvelope(envelope) {
      const approvals = isArray(envelope?.approvals) ? envelope.approvals.length : 0;
      const acceptances = isArray(envelope?.acceptances)
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
  requireCondition(isArray(usableKeyIds), "usableKeyIds must be an array");
  requireCondition(typeof stateAvailable === "boolean", "stateAvailable must be boolean");
  requireCondition(isArray(latentSuccessors), "latentSuccessors must be an array");
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
      if (weakSetHas(mortalityLimitBrands, error)) {
        return limitExceededResult(error);
      }
      throw error;
    } finally {
      this.#evaluatingMortality = false;
    }
  }

  #evaluateMortalityUnsafe(options = {}) {
    // A fork is still a security-relevant observer result. Check the same realm
    // and dependency boundary before consulting or serializing graph state.
    assertMortalityRuntimeIntact();
    if (this.#forked) {
      return freezeResult({
        status: "forked",
        mortality_classified: false,
        fork_points: [...this.#forkPoints].sort()
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
    // Descriptor traps on the explicitly out-of-profile Proxy boundary can run
    // during acquisition. Recheck after every caller-owned value has been copied.
    assertMortalityRuntimeIntact();
    const verificationBudget = createVerificationBudget();
    const canonicalTextEncoder = createTextEncoder();
    const groups = new Map();
    const payloadsByHash = new Map();
    const observedSignatures = new Set();
    const directlyAcceptedSuccessors = new Map();
    const expectedSequence = bigIntToString(bigInt(this.#head.sequence) + 1n);
    let observedCandidateBodies = 0;
    let observedCandidateCanonicalBytes = 0;

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
      observedCandidateBodies += 1;
      if (observedCandidateBodies > MORTALITY_LIMITS.candidate_bodies) {
        throw new MortalityLimitExceeded(
          "candidate_bodies",
          MORTALITY_LIMITS.candidate_bodies
        );
      }
      const groupKey = canonicalize(value);
      const canonicalLength = byteLengthOfBytes(
        textEncoderEncode(canonicalTextEncoder, groupKey)
      );
      if (canonicalLength === null) {
        throw typeError("mortality candidate body could not be measured");
      }
      const nextCanonicalBytes = observedCandidateCanonicalBytes + canonicalLength;
      if (nextCanonicalBytes > MORTALITY_LIMITS.candidate_canonical_bytes) {
        throw new MortalityLimitExceeded(
          "candidate_canonical_bytes",
          MORTALITY_LIMITS.candidate_canonical_bytes
        );
      }
      observedCandidateCanonicalBytes = nextCanonicalBytes;
      let group = groups.get(groupKey);
      if (!group) {
        group = { body: value, hasCanonicalCarrier: false };
        groups.set(groupKey, group);
      }
      group.hasCanonicalCarrier ||= hasCanonicalCarrier;
    };

    const rememberArtifacts = (value, canonicalCarrierBody = null) => {
      if (typeof value === "string") {
        if (decodeTagged(value, "ed25519:", 64) !== null) {
          observedSignatures.add(value);
        }
        return;
      }
      if (value === null || typeof value !== "object") return;
      if (!isArray(value)) {
        rememberCandidateBody(value, value === canonicalCarrierBody);
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
        rememberArtifacts(entries[index], canonicalCarrierBody);
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
      rememberArtifacts(envelope, canonicalCarrier ? envelope?.body : null);
      if (!envelope || typeof envelope !== "object" || isArray(envelope)) continue;

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
    }

    const currentDescriptor = this.#head.next_custody_descriptor;
    const allCurrentKeyIds = currentDescriptor.custodians.map((entry) => entry.key_id);
    const currentById = new Map(
      currentDescriptor.custodians.map((entry) => [entry.key_id, entry])
    );
    const preparedGroups = [];
    const signerBodies = new Map();
    const verificationCache = new Map();
    const orderedObservedSignatures = [...observedSignatures].sort();

    const verifyObservedSignature = (
      group,
      domain,
      signer,
      message,
      signature
    ) => {
      let groupCache = verificationCache.get(group);
      if (!groupCache) {
        groupCache = new Map();
        verificationCache.set(group, groupCache);
      }
      let domainCache = groupCache.get(domain);
      if (!domainCache) {
        domainCache = new Map();
        groupCache.set(domain, domainCache);
      }
      let signerCache = domainCache.get(signer);
      if (!signerCache) {
        signerCache = new Map();
        domainCache.set(signer, signerCache);
      }
      if (signerCache.has(signature)) return signerCache.get(signature);
      const verified = verificationBudget.verify(
        signer.public_key,
        message,
        signature
      );
      signerCache.set(signature, verified);
      return verified;
    };

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
      for (const signer of currentDescriptor.custodians) {
        let verifiedForBody = false;
        for (const signature of orderedObservedSignatures) {
          if (verifyObservedSignature(
            group,
            "approval",
            signer,
            approvalMessage,
            signature
          )) {
            verifiedForBody = true;
          }
        }
        if (verifiedForBody) {
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
        verificationBudget.reserveEnvelope(skeletonEnvelope);
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
        verificationBudget.reserveEnvelope(skeletonEnvelope);
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
      const approvals = new Map();
      const acceptances = new Map();
      const approvalMessage = pulseApprovalMessage(group.body);
      const acceptanceMessage = custodyAcceptanceMessage(group.body);

      for (const signature of orderedObservedSignatures) {
        for (const signer of currentDescriptor.custodians) {
          if (!verifyObservedSignature(
            group,
            "approval",
            signer,
            approvalMessage,
            signature
          )) continue;
          const normalized = { key_id: signer.key_id, signature };
          const existing = approvals.get(signer.key_id);
          if (!existing || signature < existing.signature) {
            approvals.set(signer.key_id, normalized);
          }
        }
        for (const keyId of [...newIds].sort()) {
          const signer = nextById.get(keyId);
          if (!verifyObservedSignature(
            group,
            "acceptance",
            signer,
            acceptanceMessage,
            signature
          )) continue;
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
