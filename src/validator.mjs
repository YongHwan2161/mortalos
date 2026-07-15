import { equalBytes } from "./bytes.mjs";
import {
  canonicalBytes,
  JsonInputError,
  JSON_LIMITS,
  parseJsonDocument,
  snapshotBytes
} from "./codec.mjs";
import {
  custodyAcceptanceMessage,
  custodyCommitment,
  decodeTagged,
  deriveOrganismId,
  derivePeerId,
  derivePulseHash,
  eventPayloadHash,
  genesisApprovalMessage,
  genesisParentHash,
  isStrictEd25519PublicKey,
  pulseApprovalMessage,
  verifyEd25519
} from "./crypto.mjs";
import { rejection as reject } from "./rejection-codes.mjs";
import { checkGenesisSchema, checkPulseSchema } from "./schema-validation.mjs";
const acceptedContexts = new WeakSet();
const latentContexts = new WeakSet();

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const entry of Object.values(value)) deepFreeze(entry, seen);
  return Object.freeze(value);
}

function accept(context) {
  deepFreeze(context);
  acceptedContexts.add(context);
  return context;
}

function acceptLatent(context) {
  deepFreeze(context);
  latentContexts.add(context);
  return context;
}

export function isValidatedAcceptance(value) {
  return Boolean(value && acceptedContexts.has(value));
}

export function isValidatedLatentSuccessor(value) {
  return Boolean(value && latentContexts.has(value));
}

function total(operation) {
  try {
    return operation();
  } catch {
    return reject("E_VALIDATOR_INTERNAL");
  }
}

function safeDetail(value, missing = "missing") {
  if (value === undefined) return missing;
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

function pointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function fromInputError(error, payload = false) {
  if (!(error instanceof JsonInputError)) return reject("E_VALIDATOR_INTERNAL");
  if (payload) {
    return reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", error.code);
  }
  return reject(error.code, "", safeDetail(error.detail, ""));
}

function schemaPath(error) {
  if (error.keyword === "required") {
    return `${error.instancePath}/${pointerToken(error.params.missingProperty)}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${pointerToken(error.params.additionalProperty)}`;
  }
  return error.instancePath;
}

function stableSchemaErrors(errors) {
  return [...errors].sort((left, right) => {
    const leftPath = schemaPath(left);
    const rightPath = schemaPath(right);
    if (leftPath !== rightPath) return leftPath < rightPath ? -1 : 1;
    return left.keyword < right.keyword ? -1 : left.keyword > right.keyword ? 1 : 0;
  });
}

function schemaRejection(value, validate, expectedKind) {
  if (validate(value)) return null;
  const errors = stableSchemaErrors(validate.errors ?? []);
  const unknown = errors.find((entry) => entry.keyword === "additionalProperties");
  if (unknown) {
    const property = unknown.params.additionalProperty;
    return reject(
      "E_SCHEMA_UNKNOWN_FIELD",
      `${unknown.instancePath}/${pointerToken(property)}`,
      property
    );
  }
  if (value?.kind !== expectedKind) {
    return reject("E_SCHEMA_WRONG_KIND", "/kind", safeDetail(value?.kind));
  }
  const first = errors[0];
  return reject(
    "E_SCHEMA_INVALID",
    first ? schemaPath(first) : "",
    first?.keyword ?? "schema"
  );
}

function parseRawEnvelope(bytes) {
  try {
    return {
      parsedDocument: parseJsonDocument(bytes, {
        maxBytes: JSON_LIMITS.envelope_bytes,
        maxDepth: JSON_LIMITS.max_depth
      })
    };
  } catch (error) {
    return { failure: fromInputError(error) };
  }
}

function parseRawPayload(payloadBytes) {
  if (payloadBytes === undefined || payloadBytes === null) {
    return { failure: reject("E_EVENT_PAYLOAD_REQUIRED", "/event_payload", "missing") };
  }
  try {
    return {
      parsedDocument: parseJsonDocument(payloadBytes, {
        maxBytes: JSON_LIMITS.event_payload_bytes,
        maxDepth: JSON_LIMITS.max_depth
      })
    };
  } catch (error) {
    return { failure: fromInputError(error, true) };
  }
}

function documentIsCanonical(parsedDocument) {
  return equalBytes(parsedDocument.bytes, canonicalBytes(parsedDocument.value));
}

function checkSortedUnique(entries, fieldPath, duplicateCode = "E_ARRAY_DUPLICATE_KEY_ID") {
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1].key_id;
    const current = entries[index].key_id;
    if (current === previous) {
      return reject(duplicateCode, `${fieldPath}/${index}/key_id`, current);
    }
    if (current < previous) {
      return reject("E_ARRAY_NOT_SORTED", fieldPath, `${previous}>${current}`);
    }
  }
  return null;
}

function validateBinary(value, prefix, length, fieldPath, code = "E_BINARY_ENCODING") {
  return decodeTagged(value, prefix, length)
    ? null
    : reject(code, fieldPath, `${prefix}${length}`);
}

function descriptor(custodians, quorum) {
  return { custodians, quorum };
}

function validateCustody(custodians, quorum, custodianPath, quorumPath) {
  if (custodians.length < 1 || custodians.length > 16) {
    return reject("E_CUSTODIAN_COUNT_RANGE", custodianPath, String(custodians.length));
  }
  const publicKeys = new Set();
  for (let index = 0; index < custodians.length; index += 1) {
    const entry = custodians[index];
    const keyPath = `${custodianPath}/${index}/public_key`;
    const keyFailure = validateBinary(entry.public_key, "ed25519:", 32, keyPath);
    if (keyFailure) return keyFailure;
    const idFailure = validateBinary(
      entry.key_id,
      "peer:",
      32,
      `${custodianPath}/${index}/key_id`
    );
    if (idFailure) return idFailure;
    if (!isStrictEd25519PublicKey(entry.public_key)) {
      return reject("E_PUBLIC_KEY_INVALID_POINT", keyPath, entry.key_id);
    }
    if (publicKeys.has(entry.public_key)) {
      return reject("E_CUSTODIAN_DUPLICATE_KEY", keyPath, entry.public_key);
    }
    publicKeys.add(entry.public_key);
    if (derivePeerId(entry.public_key) !== entry.key_id) {
      return reject(
        "E_PEER_ID_MISMATCH",
        `${custodianPath}/${index}/key_id`,
        entry.key_id
      );
    }
  }
  if (quorum.type !== "threshold") {
    return reject("E_QUORUM_TYPE_UNSUPPORTED", `${quorumPath}/type`, safeDetail(quorum.type));
  }
  if (quorum.threshold < 1 || quorum.threshold > custodians.length) {
    return reject(
      "E_QUORUM_THRESHOLD_RANGE",
      `${quorumPath}/threshold`,
      safeDetail(quorum.threshold)
    );
  }
  if (2 * quorum.threshold <= custodians.length) {
    return reject(
      "E_QUORUM_NOT_MAJORITY",
      `${quorumPath}/threshold`,
      safeDetail(quorum.threshold)
    );
  }
  return null;
}

function checkEvidenceEncoding(evidence, fieldPath) {
  for (let index = 0; index < evidence.length; index += 1) {
    const idFailure = validateBinary(
      evidence[index].key_id,
      "peer:",
      32,
      `${fieldPath}/${index}/key_id`
    );
    if (idFailure) return idFailure;
    const signatureFailure = validateBinary(
      evidence[index].signature,
      "ed25519:",
      64,
      `${fieldPath}/${index}/signature`
    );
    if (signatureFailure) return signatureFailure;
  }
  return null;
}

function equalCanonical(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

function validateGenesisDetailed(envelopeBytes) {
  const parsed = parseRawEnvelope(envelopeBytes);
  if (parsed.failure) return parsed.failure;
  const { parsedDocument } = parsed;
  const envelope = parsedDocument.value;

  const schemaFailure = schemaRejection(envelope, checkGenesisSchema, "mortalos.genesis");
  if (schemaFailure) return schemaFailure;
  if (!documentIsCanonical(parsedDocument)) {
    return reject("E_CANONICAL_MISMATCH", "", "envelope");
  }

  const custodyOrderFailure = checkSortedUnique(
    envelope.body.initial_custodians,
    "/body/initial_custodians"
  );
  if (custodyOrderFailure) return custodyOrderFailure;
  const approvalOrderFailure = checkSortedUnique(
    envelope.approvals,
    "/approvals",
    "E_APPROVAL_DUPLICATE"
  );
  if (approvalOrderFailure) return approvalOrderFailure;

  const { body, approvals } = envelope;
  if (body.protocol_version !== "mortalos/0") {
    return reject("E_VERSION_UNSUPPORTED", "/body/protocol_version", body.protocol_version);
  }
  if (body.hash_algorithm !== "sha-256") {
    return reject("E_HASH_ALGORITHM_UNSUPPORTED", "/body/hash_algorithm", body.hash_algorithm);
  }
  if (body.signature_algorithm !== "ed25519") {
    return reject(
      "E_SIGNATURE_ALGORITHM_UNSUPPORTED",
      "/body/signature_algorithm",
      body.signature_algorithm
    );
  }

  const approvalEncodingFailure = checkEvidenceEncoding(approvals, "/approvals");
  if (approvalEncodingFailure) return approvalEncodingFailure;
  const custodyFailure = validateCustody(
    body.initial_custodians,
    body.initial_quorum,
    "/body/initial_custodians",
    "/body/initial_quorum"
  );
  if (custodyFailure) return custodyFailure;
  for (const [field, prefix, length] of [
    ["genome_hash", "sha256:", 32],
    ["initial_state_root", "sha256:", 32],
    ["nonce", "nonce:", 16]
  ]) {
    const failure = validateBinary(body[field], prefix, length, `/body/${field}`);
    if (failure) return failure;
  }

  const expectedIds = body.initial_custodians.map((entry) => entry.key_id);
  if (
    approvals.length !== expectedIds.length ||
    approvals.some((entry, index) => entry.key_id !== expectedIds[index])
  ) {
    return reject("E_GENESIS_APPROVAL_SET", "/approvals", `${approvals.length}/${expectedIds.length}`);
  }
  const message = genesisApprovalMessage(body);
  for (let index = 0; index < approvals.length; index += 1) {
    if (
      !verifyEd25519(
        body.initial_custodians[index].public_key,
        message,
        approvals[index].signature
      )
    ) {
      return reject(
        "E_APPROVAL_SIGNATURE_INVALID",
        `/approvals/${index}/signature`,
        approvals[index].key_id
      );
    }
  }

  const organismId = deriveOrganismId(body);
  return accept({
    status: "accept",
    kind: "genesis",
    organism_id: organismId,
    object_hash: genesisParentHash(organismId),
    sequence: "0",
    genome_hash: body.genome_hash,
    next_custody_descriptor: descriptor(body.initial_custodians, body.initial_quorum),
    next_state_root: body.initial_state_root
  });
}

export function validateGenesis(envelopeBytes) {
  return total(() => validateGenesisDetailed(envelopeBytes));
}

function validatePulseDetailed(
  { contextInput, envelopeBytes, eventPayloadBytes, payloadFailure },
  mode
) {
  const parsed = parseRawEnvelope(envelopeBytes);
  if (parsed.failure) return parsed.failure;
  if (payloadFailure) return payloadFailure;
  const payload = parseRawPayload(eventPayloadBytes);
  if (payload.failure) return payload.failure;

  const envelope = parsed.parsedDocument.value;
  const payloadValue = payload.parsedDocument.value;
  const schemaFailure = schemaRejection(envelope, checkPulseSchema, "mortalos.pulse");
  if (schemaFailure) return schemaFailure;
  if (!payloadValue || Array.isArray(payloadValue) || typeof payloadValue !== "object") {
    return reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", "object-required");
  }
  if (!documentIsCanonical(parsed.parsedDocument)) {
    return reject("E_CANONICAL_MISMATCH", "", "envelope");
  }
  if (!documentIsCanonical(payload.parsedDocument)) {
    return reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", "canonical-required");
  }

  const { body, approvals, acceptances } = envelope;
  for (const [entries, fieldPath, duplicateCode] of [
    [body.next_custodians, "/body/next_custodians", "E_ARRAY_DUPLICATE_KEY_ID"],
    [approvals, "/approvals", "E_APPROVAL_DUPLICATE"],
    [acceptances, "/acceptances", "E_ACCEPTANCE_DUPLICATE"]
  ]) {
    const failure = checkSortedUnique(entries, fieldPath, duplicateCode);
    if (failure) return failure;
  }

  if (body.protocol_version !== "mortalos/0") {
    return reject("E_VERSION_UNSUPPORTED", "/body/protocol_version", body.protocol_version);
  }

  const approvalEncodingFailure = checkEvidenceEncoding(approvals, "/approvals");
  if (approvalEncodingFailure) return approvalEncodingFailure;
  const acceptanceEncodingFailure = checkEvidenceEncoding(acceptances, "/acceptances");
  if (acceptanceEncodingFailure) return acceptanceEncodingFailure;
  const nextCustodyFailure = validateCustody(
    body.next_custodians,
    body.next_quorum,
    "/body/next_custodians",
    "/body/next_quorum"
  );
  if (nextCustodyFailure) return nextCustodyFailure;
  for (const [field, code] of [
    ["organism_id", "E_BINARY_ENCODING"],
    ["parent_hash", "E_BINARY_ENCODING"],
    ["genome_hash", "E_BINARY_ENCODING"],
    ["current_custody_hash", "E_BINARY_ENCODING"],
    ["state_root", "E_STATE_ROOT_ENCODING"]
  ]) {
    const prefix = field === "organism_id" ? "mortalos:" : "sha256:";
    const failure = validateBinary(body[field], prefix, 32, `/body/${field}`, code);
    if (failure) return failure;
  }
  const payloadHashFailure = validateBinary(
    body.event.payload_hash,
    "sha256:",
    32,
    "/body/event/payload_hash",
    "E_EVENT_PAYLOAD_HASH_ENCODING"
  );
  if (payloadHashFailure) return payloadHashFailure;

  let genesis;
  let parent;
  try {
    genesis = contextInput.genesis;
    parent = contextInput.parent;
  } catch {
    return reject("E_VALIDATOR_INTERNAL");
  }

  if (!isValidatedAcceptance(genesis) || genesis.kind !== "genesis") {
    return reject("E_LINEAGE_UNKNOWN", "", "genesis-context");
  }
  if (!isValidatedAcceptance(parent)) {
    return reject("E_PARENT_REQUIRED", "", "parent-context");
  }
  if (parent.organism_id !== genesis.organism_id) {
    return reject("E_LINEAGE_UNKNOWN", "", "parent-organism-context");
  }

  if (typeof body.sequence !== "string" || !/^(0|[1-9][0-9]*)$/.test(body.sequence)) {
    return reject("E_SEQUENCE_INVALID_FORMAT", "/body/sequence", safeDetail(body.sequence));
  }
  if (typeof body.event.kind !== "string" || !["heartbeat", "membership-change"].includes(body.event.kind)) {
    return reject("E_EVENT_KIND_UNSUPPORTED", "/body/event/kind", safeDetail(body.event.kind));
  }
  if (body.organism_id !== genesis.organism_id) {
    return reject("E_ORGANISM_ID_MISMATCH", "/body/organism_id", body.organism_id);
  }
  const expectedSequence = (BigInt(parent.sequence) + 1n).toString();
  if (body.sequence !== expectedSequence) {
    return reject("E_SEQUENCE_NOT_NEXT", "/body/sequence", `${body.sequence}/${expectedSequence}`);
  }
  if (body.parent_hash !== parent.object_hash) {
    return reject("E_PARENT_HASH_MISMATCH", "/body/parent_hash", body.parent_hash);
  }
  if (body.genome_hash !== genesis.genome_hash) {
    return reject("E_GENOME_HASH_MISMATCH", "/body/genome_hash", body.genome_hash);
  }
  const expectedCustodyHash = custodyCommitment(parent.next_custody_descriptor);
  if (body.current_custody_hash !== expectedCustodyHash) {
    return reject(
      "E_CURRENT_CUSTODY_HASH_MISMATCH",
      "/body/current_custody_hash",
      body.current_custody_hash
    );
  }
  if (body.state_root !== parent.next_state_root) {
    return reject(
      body.event.kind === "heartbeat"
        ? "E_HEARTBEAT_STATE_CHANGED"
        : "E_MEMBERSHIP_STATE_CHANGED",
      "/body/state_root",
      body.state_root
    );
  }
  if (body.event.payload_hash !== eventPayloadHash(payloadValue)) {
    return reject("E_EVENT_PAYLOAD_MISMATCH", "/body/event/payload_hash", body.event.payload_hash);
  }

  const currentDescriptor = parent.next_custody_descriptor;
  const nextDescriptor = descriptor(body.next_custodians, body.next_quorum);
  if (body.event.kind === "heartbeat") {
    if (!equalCanonical(payloadValue, {})) {
      return reject("E_HEARTBEAT_PAYLOAD_NONEMPTY", "/event_payload", "nonempty");
    }
    if (!equalCanonical(currentDescriptor, nextDescriptor)) {
      return reject("E_HEARTBEAT_CUSTODY_CHANGED", "/body/next_custodians", "changed");
    }
  } else if (equalCanonical(currentDescriptor, nextDescriptor)) {
    return reject("E_MEMBERSHIP_CUSTODY_UNCHANGED", "/body/next_custodians", "unchanged");
  }

  const currentById = new Map(
    currentDescriptor.custodians.map((entry) => [entry.key_id, entry])
  );
  const approvalMessage = pulseApprovalMessage(body);
  for (let index = 0; index < approvals.length; index += 1) {
    const approval = approvals[index];
    const signer = currentById.get(approval.key_id);
    if (!signer) {
      return reject("E_APPROVAL_SIGNER_INELIGIBLE", `/approvals/${index}/key_id`, approval.key_id);
    }
    if (!verifyEd25519(signer.public_key, approvalMessage, approval.signature)) {
      return reject("E_APPROVAL_SIGNATURE_INVALID", `/approvals/${index}/signature`, approval.key_id);
    }
  }
  if (approvals.length < currentDescriptor.quorum.threshold) {
    return reject(
      "E_APPROVAL_INSUFFICIENT_QUORUM",
      "/approvals",
      `${approvals.length}/${currentDescriptor.quorum.threshold}`
    );
  }

  const nextById = new Map(body.next_custodians.map((entry) => [entry.key_id, entry]));
  const newIds = [...nextById.keys()].filter((keyId) => !currentById.has(keyId)).sort();
  const newIdSet = new Set(newIds);
  const suppliedAcceptanceIds = new Set();
  const acceptanceMessage = custodyAcceptanceMessage(body);
  for (let index = 0; index < acceptances.length; index += 1) {
    const acceptance = acceptances[index];
    if (!newIdSet.has(acceptance.key_id)) {
      if (currentById.has(acceptance.key_id) && nextById.has(acceptance.key_id)) {
        return reject(
          "E_ACCEPTANCE_SIGNER_NOT_NEW",
          `/acceptances/${index}/key_id`,
          acceptance.key_id
        );
      }
      return reject("E_ACCEPTANCE_UNEXPECTED", `/acceptances/${index}/key_id`, acceptance.key_id);
    }
    const signer = nextById.get(acceptance.key_id);
    if (!verifyEd25519(signer.public_key, acceptanceMessage, acceptance.signature)) {
      return reject(
        "E_ACCEPTANCE_SIGNATURE_INVALID",
        `/acceptances/${index}/signature`,
        acceptance.key_id
      );
    }
    suppliedAcceptanceIds.add(acceptance.key_id);
  }

  const missingAcceptanceIds = newIds.filter((keyId) => !suppliedAcceptanceIds.has(keyId));
  if (mode === "complete" && missingAcceptanceIds.length > 0) {
    return reject("E_ACCEPTANCE_MISSING", "/acceptances", missingAcceptanceIds[0]);
  }

  const activationIds = new Set(
    approvals.map((entry) => entry.key_id).filter((keyId) => nextById.has(keyId))
  );
  for (const keyId of suppliedAcceptanceIds) activationIds.add(keyId);
  if (mode === "latent") {
    for (const keyId of missingAcceptanceIds) activationIds.add(keyId);
  }
  if (activationIds.size < body.next_quorum.threshold) {
    return reject(
      "E_NEXT_QUORUM_ACTIVATION_INSUFFICIENT",
      "/body/next_quorum/threshold",
      `${activationIds.size}/${body.next_quorum.threshold}`
    );
  }

  const capability = {
    status: "accept",
    kind: "pulse",
    organism_id: body.organism_id,
    object_hash: derivePulseHash(body),
    parent_hash: body.parent_hash,
    sequence: body.sequence,
    genome_hash: body.genome_hash,
    next_custody_descriptor: nextDescriptor,
    next_state_root: body.state_root
  };
  if (missingAcceptanceIds.length === 0) return accept(capability);
  return acceptLatent({
    status: "latent",
    kind: "pulse",
    organism_id: capability.organism_id,
    object_hash: capability.object_hash,
    parent_hash: capability.parent_hash,
    sequence: capability.sequence,
    missing_acceptance_key_ids: missingAcceptanceIds
  });
}

function readPulseInput(input) {
  if (!input || typeof input !== "object") return { failure: reject("E_VALIDATOR_INTERNAL") };
  let envelopeSource;
  try {
    envelopeSource = input.envelopeBytes;
  } catch {
    return { failure: reject("E_VALIDATOR_INTERNAL") };
  }

  let envelopeBytes;
  try {
    envelopeBytes = snapshotBytes(envelopeSource, JSON_LIMITS.envelope_bytes);
  } catch (error) {
    return { failure: fromInputError(error) };
  }

  let payloadSource;
  try {
    payloadSource = input.eventPayloadBytes;
  } catch {
    return {
      contextInput: input,
      envelopeBytes,
      eventPayloadBytes: undefined,
      payloadFailure: reject("E_VALIDATOR_INTERNAL")
    };
  }
  if (payloadSource === undefined || payloadSource === null) {
    return {
      contextInput: input,
      envelopeBytes,
      eventPayloadBytes: payloadSource
    };
  }
  try {
    return {
      contextInput: input,
      envelopeBytes,
      eventPayloadBytes: snapshotBytes(payloadSource, JSON_LIMITS.event_payload_bytes)
    };
  } catch (error) {
    return {
      contextInput: input,
      envelopeBytes,
      eventPayloadBytes: undefined,
      payloadFailure: fromInputError(error, true)
    };
  }
}

export function validatePulse(input) {
  return total(() => {
    const ownedInput = readPulseInput(input);
    return ownedInput.failure ?? validatePulseDetailed(ownedInput, "complete");
  });
}

export function validateLatentSuccessor(input) {
  return total(() => {
    const ownedInput = readPulseInput(input);
    return ownedInput.failure ?? validatePulseDetailed(ownedInput, "latent");
  });
}
