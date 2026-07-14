import { equalBytes } from "./bytes.mjs";
import {
  canonicalBytes,
  isCanonical,
  JsonInputError,
  JSON_LIMITS,
  parseJsonBytes
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

function fromInputError(error, payload = false) {
  if (!(error instanceof JsonInputError)) return reject("E_VALIDATOR_INTERNAL");
  if (payload) {
    return reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", error.code);
  }
  return reject(error.code, "", error.detail);
}

function schemaRejection(value, validate, expectedKind) {
  if (validate(value)) return null;
  const errors = validate.errors ?? [];
  const unknown = errors.find((entry) => entry.keyword === "additionalProperties");
  if (unknown) {
    const property = unknown.params.additionalProperty;
    return reject("E_SCHEMA_UNKNOWN_FIELD", `${unknown.instancePath}/${property}`, property);
  }
  if (value?.kind !== expectedKind) {
    return reject("E_SCHEMA_WRONG_KIND", "/kind", String(value?.kind ?? "missing"));
  }
  if (value?.body?.protocol_version !== "mortalos/0") {
    return reject("E_VERSION_UNSUPPORTED", "/body/protocol_version", String(value?.body?.protocol_version));
  }
  if (expectedKind === "mortalos.genesis" && value?.body?.hash_algorithm !== "sha-256") {
    return reject("E_HASH_ALGORITHM_UNSUPPORTED", "/body/hash_algorithm", String(value?.body?.hash_algorithm));
  }
  if (expectedKind === "mortalos.genesis" && value?.body?.signature_algorithm !== "ed25519") {
    return reject("E_SIGNATURE_ALGORITHM_UNSUPPORTED", "/body/signature_algorithm", String(value?.body?.signature_algorithm));
  }
  if (expectedKind === "mortalos.pulse" && !["heartbeat", "membership-change"].includes(value?.body?.event?.kind)) {
    return reject("E_EVENT_KIND_UNSUPPORTED", "/body/event/kind", String(value?.body?.event?.kind));
  }
  if (expectedKind === "mortalos.pulse" && !/^(0|[1-9][0-9]*)$/.test(value?.body?.sequence ?? "")) {
    return reject("E_SEQUENCE_INVALID_FORMAT", "/body/sequence", String(value?.body?.sequence));
  }
  return reject("E_SCHEMA_INVALID", errors[0]?.instancePath ?? "", errors[0]?.keyword ?? "schema");
}

function parseRawEnvelope(bytes) {
  let value;
  try {
    value = parseJsonBytes(bytes, {
      maxBytes: JSON_LIMITS.envelope_bytes,
      maxDepth: JSON_LIMITS.max_depth
    });
  } catch (error) {
    return { failure: fromInputError(error) };
  }
  return { value };
}

function checkEnvelope(value, bytes, validate, expectedKind) {
  const schemaFailure = schemaRejection(value, validate, expectedKind);
  if (schemaFailure) return schemaFailure;
  if (!isCanonical(bytes, value)) {
    return reject("E_CANONICAL_MISMATCH", "", "envelope");
  }
  return null;
}

function parseEnvelope(bytes, validate, expectedKind) {
  const parsed = parseRawEnvelope(bytes);
  if (parsed.failure) return parsed;
  const failure = checkEnvelope(parsed.value, bytes, validate, expectedKind);
  return failure ? { failure } : parsed;
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

function validateCustody(custodians, quorum, fieldPath) {
  if (custodians.length < 1 || custodians.length > 16) {
    return reject("E_CUSTODIAN_COUNT_RANGE", fieldPath, String(custodians.length));
  }
  const orderingFailure = checkSortedUnique(custodians, fieldPath);
  if (orderingFailure) return orderingFailure;
  const publicKeys = new Set();
  for (let index = 0; index < custodians.length; index += 1) {
    const entry = custodians[index];
    const keyFailure = validateBinary(entry.public_key, "ed25519:", 32, `${fieldPath}/${index}/public_key`);
    if (keyFailure) return keyFailure;
    const idFailure = validateBinary(entry.key_id, "peer:", 32, `${fieldPath}/${index}/key_id`);
    if (idFailure) return idFailure;
    if (publicKeys.has(entry.public_key)) {
      return reject("E_CUSTODIAN_DUPLICATE_KEY", `${fieldPath}/${index}/public_key`, entry.public_key);
    }
    publicKeys.add(entry.public_key);
    if (derivePeerId(entry.public_key) !== entry.key_id) {
      return reject("E_PEER_ID_MISMATCH", `${fieldPath}/${index}/key_id`, entry.key_id);
    }
  }
  if (quorum.type !== "threshold") {
    return reject("E_QUORUM_TYPE_UNSUPPORTED", `${fieldPath}/../quorum/type`, String(quorum.type));
  }
  if (quorum.threshold < 1 || quorum.threshold > custodians.length) {
    return reject("E_QUORUM_THRESHOLD_RANGE", `${fieldPath}/../quorum/threshold`, String(quorum.threshold));
  }
  if (2 * quorum.threshold <= custodians.length) {
    return reject("E_QUORUM_NOT_MAJORITY", `${fieldPath}/../quorum/threshold`, String(quorum.threshold));
  }
  return null;
}

function checkEvidenceEncoding(evidence, fieldPath, duplicateCode) {
  const orderingFailure = checkSortedUnique(evidence, fieldPath, duplicateCode);
  if (orderingFailure) return orderingFailure;
  for (let index = 0; index < evidence.length; index += 1) {
    const idFailure = validateBinary(evidence[index].key_id, "peer:", 32, `${fieldPath}/${index}/key_id`);
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

export function validateGenesis(envelopeBytes) {
  const parsed = parseEnvelope(envelopeBytes, checkGenesisSchema, "mortalos.genesis");
  if (parsed.failure) return parsed.failure;
  const envelope = parsed.value;
  const { body, approvals } = envelope;

  const approvalEncodingFailure = checkEvidenceEncoding(approvals, "/approvals", "E_APPROVAL_DUPLICATE");
  if (approvalEncodingFailure) return approvalEncodingFailure;
  const custodyFailure = validateCustody(body.initial_custodians, body.initial_quorum, "/body/initial_custodians");
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
  if (approvals.length !== expectedIds.length || approvals.some((entry, index) => entry.key_id !== expectedIds[index])) {
    return reject("E_GENESIS_APPROVAL_SET", "/approvals", `${approvals.length}/${expectedIds.length}`);
  }
  const message = genesisApprovalMessage(body);
  for (let index = 0; index < approvals.length; index += 1) {
    if (!verifyEd25519(body.initial_custodians[index].public_key, message, approvals[index].signature)) {
      return reject("E_APPROVAL_SIGNATURE_INVALID", `/approvals/${index}/signature`, approvals[index].key_id);
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

function parseRawPayload(payloadBytes) {
  if (payloadBytes === undefined || payloadBytes === null) {
    return { failure: reject("E_EVENT_PAYLOAD_REQUIRED", "/event_payload", "missing") };
  }
  let value;
  try {
    value = parseJsonBytes(payloadBytes, {
      maxBytes: JSON_LIMITS.event_payload_bytes,
      maxDepth: JSON_LIMITS.max_depth
    });
  } catch (error) {
    return { failure: fromInputError(error, true) };
  }
  return { value };
}

function checkPayload(value, payloadBytes) {
  return !value || Array.isArray(value) || typeof value !== "object" || !isCanonical(payloadBytes, value)
    ? reject("E_EVENT_PAYLOAD_INVALID", "/event_payload", "object-or-canonical")
    : null;
}

export function validatePulse({ genesis, parent, envelopeBytes, eventPayloadBytes }) {
  const parsed = parseRawEnvelope(envelopeBytes);
  if (parsed.failure) return parsed.failure;
  const payload = parseRawPayload(eventPayloadBytes);
  if (payload.failure) return payload.failure;
  const envelopeFailure = checkEnvelope(
    parsed.value,
    envelopeBytes,
    checkPulseSchema,
    "mortalos.pulse"
  );
  if (envelopeFailure) return envelopeFailure;
  const payloadFailure = checkPayload(payload.value, eventPayloadBytes);
  if (payloadFailure) return payloadFailure;
  const envelope = parsed.value;
  const { body, approvals, acceptances } = envelope;

  if (!/^(0|[1-9][0-9]*)$/.test(body.sequence)) {
    return reject("E_SEQUENCE_INVALID_FORMAT", "/body/sequence", body.sequence);
  }
  if (!["heartbeat", "membership-change"].includes(body.event.kind)) {
    return reject("E_EVENT_KIND_UNSUPPORTED", "/body/event/kind", body.event.kind);
  }

  const nextCustodyOrderingFailure = checkSortedUnique(body.next_custodians, "/body/next_custodians");
  if (nextCustodyOrderingFailure) return nextCustodyOrderingFailure;
  const approvalEncodingFailure = checkEvidenceEncoding(approvals, "/approvals", "E_APPROVAL_DUPLICATE");
  if (approvalEncodingFailure) return approvalEncodingFailure;
  const acceptanceEncodingFailure = checkEvidenceEncoding(
    acceptances,
    "/acceptances",
    "E_ACCEPTANCE_DUPLICATE"
  );
  if (acceptanceEncodingFailure) return acceptanceEncodingFailure;
  const nextCustodyFailure = validateCustody(body.next_custodians, body.next_quorum, "/body/next_custodians");
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

  if (!isValidatedAcceptance(genesis) || genesis.kind !== "genesis") {
    return reject("E_LINEAGE_UNKNOWN", "", "genesis-context");
  }
  if (!isValidatedAcceptance(parent)) {
    return reject("E_PARENT_REQUIRED", "", "parent-context");
  }
  if (parent.organism_id !== genesis.organism_id) {
    return reject("E_LINEAGE_UNKNOWN", "", "parent-organism-context");
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
    return reject("E_CURRENT_CUSTODY_HASH_MISMATCH", "/body/current_custody_hash", body.current_custody_hash);
  }
  if (body.state_root !== parent.next_state_root) {
    return reject(
      body.event.kind === "heartbeat" ? "E_HEARTBEAT_STATE_CHANGED" : "E_MEMBERSHIP_STATE_CHANGED",
      "/body/state_root",
      body.state_root
    );
  }
  if (body.event.payload_hash !== eventPayloadHash(payload.value)) {
    return reject("E_EVENT_PAYLOAD_MISMATCH", "/body/event/payload_hash", body.event.payload_hash);
  }

  const currentDescriptor = parent.next_custody_descriptor;
  const nextDescriptor = descriptor(body.next_custodians, body.next_quorum);
  if (body.event.kind === "heartbeat") {
    if (!equalCanonical(payload.value, {})) {
      return reject("E_HEARTBEAT_PAYLOAD_NONEMPTY", "/event_payload", "nonempty")
    }
    if (!equalCanonical(currentDescriptor, nextDescriptor)) {
      return reject("E_HEARTBEAT_CUSTODY_CHANGED", "/body/next_custodians", "changed")
    }
  } else if (equalCanonical(currentDescriptor, nextDescriptor)) {
    return reject("E_MEMBERSHIP_CUSTODY_UNCHANGED", "/body/next_custodians", "unchanged")
  }

  const currentById = new Map(currentDescriptor.custodians.map((entry) => [entry.key_id, entry]));
  const approvalMessage = pulseApprovalMessage(body);
  for (let index = 0; index < approvals.length; index += 1) {
    const signer = currentById.get(approvals[index].key_id);
    if (!signer) {
      return reject("E_APPROVAL_SIGNER_INELIGIBLE", `/approvals/${index}/key_id`, approvals[index].key_id);
    }
    if (!verifyEd25519(signer.public_key, approvalMessage, approvals[index].signature)) {
      return reject("E_APPROVAL_SIGNATURE_INVALID", `/approvals/${index}/signature`, approvals[index].key_id);
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
  const acceptanceIds = acceptances.map((entry) => entry.key_id);
  for (let index = 0; index < acceptanceIds.length; index += 1) {
    if (!newIds.includes(acceptanceIds[index])) {
      if (currentById.has(acceptanceIds[index]) && nextById.has(acceptanceIds[index])) {
        return reject("E_ACCEPTANCE_SIGNER_NOT_NEW", `/acceptances/${index}/key_id`, acceptanceIds[index]);
      }
      return reject("E_ACCEPTANCE_UNEXPECTED", `/acceptances/${index}/key_id`, acceptanceIds[index]);
    }
  }
  const missing = newIds.find((keyId) => !acceptanceIds.includes(keyId));
  if (missing) return reject("E_ACCEPTANCE_MISSING", "/acceptances", missing);
  const acceptanceMessage = custodyAcceptanceMessage(body);
  for (let index = 0; index < acceptances.length; index += 1) {
    const signer = nextById.get(acceptances[index].key_id);
    if (!verifyEd25519(signer.public_key, acceptanceMessage, acceptances[index].signature)) {
      return reject("E_ACCEPTANCE_SIGNATURE_INVALID", `/acceptances/${index}/signature`, acceptances[index].key_id);
    }
  }

  return accept({
    status: "accept",
    kind: "pulse",
    organism_id: body.organism_id,
    object_hash: derivePulseHash(body),
    parent_hash: body.parent_hash,
    sequence: body.sequence,
    genome_hash: body.genome_hash,
    next_custody_descriptor: nextDescriptor,
    next_state_root: body.state_root
  });
}

export function validateLatentSuccessor(input) {
  const result = validatePulse(input);
  if (result.status === "accept" || result.code !== "E_ACCEPTANCE_MISSING") return result;

  const envelope = parseJsonBytes(input.envelopeBytes);
  const { body, acceptances } = envelope;
  const nextById = new Map(body.next_custodians.map((entry) => [entry.key_id, entry]));
  const currentIds = new Set(
    input.parent.next_custody_descriptor.custodians.map((entry) => entry.key_id)
  );
  const newIds = [...nextById.keys()].filter((keyId) => !currentIds.has(keyId)).sort();
  const acceptanceMessage = custodyAcceptanceMessage(body);
  for (let index = 0; index < acceptances.length; index += 1) {
    const signer = nextById.get(acceptances[index].key_id);
    if (!verifyEd25519(signer.public_key, acceptanceMessage, acceptances[index].signature)) {
      return reject(
        "E_ACCEPTANCE_SIGNATURE_INVALID",
        `/acceptances/${index}/signature`,
        acceptances[index].key_id
      );
    }
  }
  const supplied = new Set(acceptances.map((entry) => entry.key_id));
  return acceptLatent({
    status: "latent",
    kind: "pulse",
    organism_id: body.organism_id,
    object_hash: derivePulseHash(body),
    parent_hash: body.parent_hash,
    sequence: body.sequence,
    missing_acceptance_key_ids: newIds.filter((keyId) => !supplied.has(keyId))
  });
}
