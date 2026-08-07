import {
  byteLengthOfBytes,
  decodeBase64Url
} from "./bytes.mjs";
import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import {
  derivePeerId,
  deriveResourceConsumptionId,
  deriveResourceConsumptionWitnessId,
  deriveResourceLeaseId,
  deriveResourceOfferId,
  deriveResourceRevocationId,
  deriveResourceUsageId,
  resourceConsumptionWitnessSigningMessage,
  resourceLeaseConsumerSigningMessage,
  resourceLeaseProviderSigningMessage,
  resourceOfferSigningMessage,
  resourceRevocationSigningMessage,
  resourceUsageConsumerSigningMessage,
  resourceUsageProviderSigningMessage,
  verifyEd25519
} from "./crypto.mjs";
import { PROTOCOL_PROFILE } from "./generated/protocol-profile.mjs";
import {
  arrayLength,
  arraySort,
  arrayValueAt,
  bigInt,
  copyArrayByIndex,
  copyBoundedOwnDataArray,
  createMap,
  createSet,
  createUint8Array,
  freeze,
  isArray,
  mapGet,
  mapSet,
  numberIsSafeInteger,
  objectKeys,
  objectValues,
  ownDataArrayLength,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  setAdd,
  setHas,
  setSize,
  snapshotOwnDataRecord
} from "./primordials.mjs";

export const RESOURCE_FORMATS = freeze({
  announcement: "mortalos-resource-consumption-announcement/1",
  consumption_witness: "mortalos-resource-consumption-witness/1",
  lease: "mortalos-resource-lease/1",
  offer: "mortalos-resource-offer/1",
  revocation: "mortalos-resource-revocation/1",
  usage: "mortalos-resource-usage/1"
});

export const RESOURCE_CONTRACT_LIMITS = freeze({
  announcement_bytes: PROTOCOL_PROFILE.resource_contract.announcement_bytes,
  announcements_per_evaluation_max:
    PROTOCOL_PROFILE.resource_contract.announcements_per_evaluation_max,
  decimal_max: bigInt(PROTOCOL_PROFILE.resource_contract.decimal_max),
  document_bytes: PROTOCOL_PROFILE.resource_contract.document_bytes,
  lease_duration_ms_max: bigInt(PROTOCOL_PROFILE.resource_contract.lease_duration_ms_max),
  leases_per_offer_observation_max:
    PROTOCOL_PROFILE.resource_contract.leases_per_offer_observation_max,
  receipts_per_lease_max: PROTOCOL_PROFILE.resource_contract.receipts_per_lease_max,
  revocations_per_evaluation_max:
    PROTOCOL_PROFILE.resource_contract.revocations_per_evaluation_max,
  witnesses_per_offer_max: PROTOCOL_PROFILE.resource_contract.witnesses_per_offer_max
});

const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const REVOCATION_REASONS = createSet();
for (const reason of [
  "capacity-loss",
  "consumer-request",
  "policy-change",
  "resource-withdrawn",
  "security-incident"
]) setAdd(REVOCATION_REASONS, reason);

const CAPACITY_KEYS = ["bandwidth", "compute", "storage"];
const BANDWIDTH_KEYS = [
  "burst_bytes",
  "egress_bytes_total",
  "ingress_bytes_total",
  "rate_bytes_per_second"
];
const COMPUTE_KEYS = [
  "concurrency",
  "cpu_millis_total",
  "memory_bytes",
  "task_millis_max"
];
const STORAGE_KEYS = ["capacity_bytes", "max_object_bytes"];
const USAGE_KEYS = ["bandwidth", "compute", "storage"];
const BANDWIDTH_USAGE_KEYS = [
  "egress_bytes_cumulative",
  "ingress_bytes_cumulative"
];
const COMPUTE_USAGE_KEYS = [
  "concurrency_peak",
  "cpu_millis_cumulative",
  "memory_bytes_peak",
  "task_millis_peak"
];
const STORAGE_USAGE_KEYS = ["bytes_current", "bytes_peak"];

export class ResourceContractError extends Error {
  constructor(code, fieldPath = "", detail = "") {
    super(`${code}${fieldPath ? ` at ${fieldPath}` : ""}${detail ? `: ${detail}` : ""}`);
    this.name = "ResourceContractError";
    this.code = code;
    this.fieldPath = fieldPath;
    this.detail = detail;
  }
}

function fail(code, fieldPath = "", detail = "") {
  throw new ResourceContractError(code, fieldPath, detail);
}

function assertRuntime() {
  if (!realmIntrinsicsIntact()) {
    fail("E_RESOURCE_FORMAT", "", "realm-integrity");
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  const children = objectValues(value);
  for (let index = 0; index < arrayLength(children); index += 1) {
    deepFreeze(arrayValueAt(children, index));
  }
  return freeze(value);
}

function exactKeys(value, expected, path) {
  if (!value || typeof value !== "object" || isArray(value)) {
    fail("E_RESOURCE_FORMAT", path, "object-required");
  }
  const actual = objectKeys(value);
  const wanted = copyArrayByIndex(expected);
  arraySort(actual);
  arraySort(wanted);
  if (arrayLength(actual) !== arrayLength(wanted)) {
    fail("E_RESOURCE_FORMAT", path, "exact-keys");
  }
  for (let index = 0; index < arrayLength(actual); index += 1) {
    if (arrayValueAt(actual, index) !== arrayValueAt(wanted, index)) {
      fail("E_RESOURCE_FORMAT", path, "exact-keys");
    }
  }
}

function exactOptions(value, names, label) {
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_RESOURCE_FORMAT", "", `${label}-record`);
  }
  const actual = ownKeys(descriptors);
  if (arrayLength(actual) !== arrayLength(names)) {
    fail("E_RESOURCE_FORMAT", "", `${label}-exact-keys`);
  }
  const result = [];
  for (let index = 0; index < arrayLength(names); index += 1) {
    const entry = ownDataRecordEntry(descriptors, arrayValueAt(names, index));
    if (!entry.present) fail("E_RESOURCE_FORMAT", "", `${label}-exact-keys`);
    result[index] = entry.value;
  }
  return result;
}

function parseCanonicalDocument(
  source,
  path,
  maximum = RESOURCE_CONTRACT_LIMITS.document_bytes
) {
  let bytes;
  try {
    bytes = snapshotBytes(source, maximum);
  } catch (error) {
    fail(
      error?.code === "E_PARSE_LIMIT_EXCEEDED" ? "E_RESOURCE_LIMIT" : "E_RESOURCE_FORMAT",
      path,
      "canonical-bytes"
    );
  }
  let value;
  try {
    value = parseJsonBytes(bytes, {
      maxBytes: maximum,
      maxDepth: 16
    });
  } catch {
    fail("E_RESOURCE_FORMAT", path, "canonical-json");
  }
  if (!isCanonical(bytes, value)) fail("E_RESOURCE_FORMAT", path, "canonical-json");
  return { bytes, value };
}

function ownCanonicalValue(
  source,
  path,
  maximum = RESOURCE_CONTRACT_LIMITS.document_bytes
) {
  let bytes;
  try {
    bytes = canonicalBytes(source);
  } catch {
    fail("E_RESOURCE_FORMAT", path, "ordinary-own-data-json");
  }
  if (byteLengthOfBytes(bytes) > maximum) {
    fail("E_RESOURCE_LIMIT", path, "document-bytes");
  }
  return parseJsonBytes(bytes, {
    maxBytes: maximum,
    maxDepth: 16
  });
}

function canonicalDecimal(value, path, maximum = RESOURCE_CONTRACT_LIMITS.decimal_max) {
  if (typeof value !== "string" || !regexpTest(DECIMAL_PATTERN, value)) {
    fail("E_RESOURCE_DECIMAL", path, "canonical-decimal-string");
  }
  let parsed;
  try {
    parsed = bigInt(value);
  } catch {
    fail("E_RESOURCE_DECIMAL", path, "integer");
  }
  if (parsed < 0n || parsed > maximum) {
    fail("E_RESOURCE_DECIMAL", path, "range");
  }
  return parsed;
}

function assertNonce(value, path) {
  const decoded = decodeBase64Url(value);
  if (!decoded || byteLengthOfBytes(decoded) !== 16) {
    fail("E_RESOURCE_FORMAT", path, "base64url-128-bit");
  }
}

function validateIdentity(value, path) {
  exactKeys(value, ["key_id", "public_key"], path);
  if (derivePeerId(value.public_key) !== value.key_id) {
    fail("E_RESOURCE_IDENTITY", path, "strict-ed25519-peer-binding");
  }
}

function validateWitnessPolicy(value, provider, path) {
  exactKeys(value, ["max_faulty", "threshold", "witnesses"], path);
  const maxFaulty = value.max_faulty;
  const threshold = value.threshold;
  if (
    !numberIsSafeInteger(maxFaulty) ||
    !numberIsSafeInteger(threshold) ||
    maxFaulty < 0 ||
    threshold < 1
  ) {
    fail("E_RESOURCE_WITNESS", path, "safe-integer-policy");
  }
  let count;
  let witnesses;
  try {
    count = ownDataArrayLength(value.witnesses, "resource witness policy");
    witnesses = copyBoundedOwnDataArray(
      value.witnesses,
      count,
      "resource witness policy"
    );
  } catch {
    fail("E_RESOURCE_FORMAT", `${path}/witnesses`, "ordinary-dense-array");
  }
  if (count < 1 || count > RESOURCE_CONTRACT_LIMITS.witnesses_per_offer_max) {
    fail("E_RESOURCE_LIMIT", `${path}/witnesses`, "witness-count");
  }
  let previousKeyId = null;
  for (let index = 0; index < count; index += 1) {
    const witness = arrayValueAt(witnesses, index);
    validateIdentity(witness, `${path}/witnesses/${index}`);
    if (witness.key_id === provider.key_id) {
      fail("E_RESOURCE_WITNESS", `${path}/witnesses/${index}`, "provider-disjoint");
    }
    if (previousKeyId !== null && previousKeyId >= witness.key_id) {
      fail("E_RESOURCE_WITNESS", `${path}/witnesses/${index}`, "strict-key-order");
    }
    previousKeyId = witness.key_id;
  }
  if (
    count < 3 * maxFaulty + 1 ||
    threshold > count - maxFaulty ||
    2 * threshold <= count + maxFaulty
  ) {
    fail("E_RESOURCE_WITNESS", path, "unsafe-byzantine-quorum");
  }
  return { maxFaulty, threshold, witnesses };
}

function witnessByKeyId(policy, keyId) {
  for (let index = 0; index < arrayLength(policy.witnesses); index += 1) {
    const witness = arrayValueAt(policy.witnesses, index);
    if (witness.key_id === keyId) return witness;
  }
  return null;
}

function validateCapacity(value, path) {
  exactKeys(value, CAPACITY_KEYS, path);
  exactKeys(value.storage, STORAGE_KEYS, `${path}/storage`);
  exactKeys(value.bandwidth, BANDWIDTH_KEYS, `${path}/bandwidth`);
  exactKeys(value.compute, COMPUTE_KEYS, `${path}/compute`);

  const parsed = {
    storage: {
      capacity_bytes: canonicalDecimal(
        value.storage.capacity_bytes, `${path}/storage/capacity_bytes`
      ),
      max_object_bytes: canonicalDecimal(
        value.storage.max_object_bytes, `${path}/storage/max_object_bytes`
      )
    },
    bandwidth: {
      ingress_bytes_total: canonicalDecimal(
        value.bandwidth.ingress_bytes_total, `${path}/bandwidth/ingress_bytes_total`
      ),
      egress_bytes_total: canonicalDecimal(
        value.bandwidth.egress_bytes_total, `${path}/bandwidth/egress_bytes_total`
      ),
      rate_bytes_per_second: canonicalDecimal(
        value.bandwidth.rate_bytes_per_second, `${path}/bandwidth/rate_bytes_per_second`
      ),
      burst_bytes: canonicalDecimal(
        value.bandwidth.burst_bytes, `${path}/bandwidth/burst_bytes`
      )
    },
    compute: {
      cpu_millis_total: canonicalDecimal(
        value.compute.cpu_millis_total, `${path}/compute/cpu_millis_total`
      ),
      memory_bytes: canonicalDecimal(
        value.compute.memory_bytes, `${path}/compute/memory_bytes`
      ),
      task_millis_max: canonicalDecimal(
        value.compute.task_millis_max, `${path}/compute/task_millis_max`
      ),
      concurrency: canonicalDecimal(
        value.compute.concurrency, `${path}/compute/concurrency`
      )
    }
  };

  const storageEnabled = parsed.storage.capacity_bytes > 0n;
  if (
    parsed.storage.max_object_bytes > parsed.storage.capacity_bytes ||
    storageEnabled !== (parsed.storage.max_object_bytes > 0n)
  ) fail("E_RESOURCE_CAPACITY", `${path}/storage`, "coherent-storage-bounds");

  const bandwidthEnabled =
    parsed.bandwidth.ingress_bytes_total > 0n ||
    parsed.bandwidth.egress_bytes_total > 0n;
  if (
    bandwidthEnabled !== (parsed.bandwidth.rate_bytes_per_second > 0n) ||
    bandwidthEnabled !== (parsed.bandwidth.burst_bytes > 0n)
  ) fail("E_RESOURCE_CAPACITY", `${path}/bandwidth`, "coherent-bandwidth-bounds");

  const computeEnabled = parsed.compute.cpu_millis_total > 0n;
  if (
    computeEnabled !== (parsed.compute.memory_bytes > 0n) ||
    computeEnabled !== (parsed.compute.task_millis_max > 0n) ||
    computeEnabled !== (parsed.compute.concurrency > 0n)
  ) fail("E_RESOURCE_CAPACITY", `${path}/compute`, "coherent-compute-bounds");

  if (!storageEnabled && !bandwidthEnabled && !computeEnabled) {
    fail("E_RESOURCE_CAPACITY", path, "nonzero-resource-required");
  }
  return parsed;
}

function assertAllocationWithin(allocation, capacity, path) {
  for (const field of STORAGE_KEYS) {
    if (allocation.storage[field] > capacity.storage[field]) {
      fail("E_RESOURCE_CAPACITY", `${path}/storage/${field}`, "offer-bound");
    }
  }
  for (const field of BANDWIDTH_KEYS) {
    if (allocation.bandwidth[field] > capacity.bandwidth[field]) {
      fail("E_RESOURCE_CAPACITY", `${path}/bandwidth/${field}`, "offer-bound");
    }
  }
  for (const field of COMPUTE_KEYS) {
    if (allocation.compute[field] > capacity.compute[field]) {
      fail("E_RESOURCE_CAPACITY", `${path}/compute/${field}`, "offer-bound");
    }
  }
}

function validateOfferBody(body) {
  exactKeys(
    body,
    [
      "capacity",
      "expires_at_ms",
      "offer_nonce",
      "provider",
      "valid_from_ms",
      "witness_policy"
    ],
    "/body"
  );
  validateIdentity(body.provider, "/body/provider");
  assertNonce(body.offer_nonce, "/body/offer_nonce");
  const validFrom = canonicalDecimal(body.valid_from_ms, "/body/valid_from_ms");
  const expiresAt = canonicalDecimal(body.expires_at_ms, "/body/expires_at_ms");
  if (expiresAt <= validFrom) fail("E_RESOURCE_TIME", "/body/expires_at_ms", "after-start");
  if (expiresAt - validFrom > RESOURCE_CONTRACT_LIMITS.lease_duration_ms_max) {
    fail("E_RESOURCE_TIME", "/body/expires_at_ms", "duration-limit");
  }
  return {
    capacity: validateCapacity(body.capacity, "/body/capacity"),
    expiresAt,
    validFrom,
    witnessPolicy: validateWitnessPolicy(
      body.witness_policy,
      body.provider,
      "/body/witness_policy"
    )
  };
}

function resourceOfferDraft(bodySource) {
  const body = ownCanonicalValue(bodySource, "/body");
  validateOfferBody(body);
  const offerId = deriveResourceOfferId(body);
  return { body, offerId, signingMessage: resourceOfferSigningMessage(offerId) };
}

function verifyOfferEnvelope(parsedDocument) {
  const envelope = parsedDocument.value;
  exactKeys(envelope, ["body", "format", "offer_id", "provider_signature"], "");
  if (envelope.format !== RESOURCE_FORMATS.offer) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_FORMATS.offer);
  }
  validateOfferBody(envelope.body);
  const expectedId = deriveResourceOfferId(envelope.body);
  if (envelope.offer_id !== expectedId) {
    fail("E_RESOURCE_BINDING", "/offer_id", "body-id");
  }
  if (!verifyEd25519(
    envelope.body.provider.public_key,
    resourceOfferSigningMessage(expectedId),
    envelope.provider_signature
  )) fail("E_RESOURCE_SIGNATURE", "/provider_signature", "provider");
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsedDocument.bytes),
    offer_id: expectedId,
    status: "verified"
  });
}

export function prepareResourceOffer(bodySource) {
  assertRuntime();
  const draft = resourceOfferDraft(bodySource);
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    offer_id: draft.offerId,
    provider_signing_message: createUint8Array(draft.signingMessage)
  });
}

export function finalizeResourceOffer(options) {
  assertRuntime();
  const [bodySource, providerSignature] = exactOptions(
    options, ["body", "provider_signature"], "resource offer options"
  );
  const draft = resourceOfferDraft(bodySource);
  const bytes = canonicalBytes({
    body: draft.body,
    format: RESOURCE_FORMATS.offer,
    offer_id: draft.offerId,
    provider_signature: providerSignature
  });
  return verifyResourceOffer(bytes).bytes;
}

export function verifyResourceOffer(source) {
  assertRuntime();
  return verifyOfferEnvelope(parseCanonicalDocument(source, "/offer"));
}

function validateLeaseBody(body, offer) {
  exactKeys(
    body,
    ["allocation", "consumer", "ends_at_ms", "lease_nonce", "offer_id", "starts_at_ms"],
    "/body"
  );
  if (body.offer_id !== offer.offer_id) {
    fail("E_RESOURCE_BINDING", "/body/offer_id", "offer-id");
  }
  validateIdentity(body.consumer, "/body/consumer");
  assertNonce(body.lease_nonce, "/body/lease_nonce");
  const startsAt = canonicalDecimal(body.starts_at_ms, "/body/starts_at_ms");
  const endsAt = canonicalDecimal(body.ends_at_ms, "/body/ends_at_ms");
  const offerTimes = validateOfferBody(offer.body);
  if (body.consumer.key_id === offer.body.provider.key_id) {
    fail("E_RESOURCE_IDENTITY", "/body/consumer", "provider-consumer-role-conflict");
  }
  if (witnessByKeyId(offerTimes.witnessPolicy, body.consumer.key_id)) {
    fail("E_RESOURCE_WITNESS", "/body/consumer", "consumer-witness-role-conflict");
  }
  if (endsAt <= startsAt) fail("E_RESOURCE_TIME", "/body/ends_at_ms", "after-start");
  if (startsAt < offerTimes.validFrom || endsAt > offerTimes.expiresAt) {
    fail("E_RESOURCE_TIME", "/body", "offer-window");
  }
  if (endsAt - startsAt > RESOURCE_CONTRACT_LIMITS.lease_duration_ms_max) {
    fail("E_RESOURCE_TIME", "/body/ends_at_ms", "duration-limit");
  }
  const allocation = validateCapacity(body.allocation, "/body/allocation");
  assertAllocationWithin(allocation, offerTimes.capacity, "/body/allocation");
  return { allocation, endsAt, startsAt };
}

function resourceLeaseDraft(offerSource, bodySource) {
  const offer = verifyResourceOffer(offerSource);
  const body = ownCanonicalValue(bodySource, "/body");
  validateLeaseBody(body, offer);
  const leaseId = deriveResourceLeaseId(body);
  return {
    body,
    leaseId,
    offer,
    consumerMessage: resourceLeaseConsumerSigningMessage(leaseId),
    providerMessage: resourceLeaseProviderSigningMessage(leaseId)
  };
}

function verifyLeaseEnvelope(offer, parsedDocument) {
  const envelope = parsedDocument.value;
  exactKeys(
    envelope,
    ["body", "consumer_signature", "format", "lease_id", "provider_signature"],
    ""
  );
  if (envelope.format !== RESOURCE_FORMATS.lease) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_FORMATS.lease);
  }
  validateLeaseBody(envelope.body, offer);
  const expectedId = deriveResourceLeaseId(envelope.body);
  if (envelope.lease_id !== expectedId) {
    fail("E_RESOURCE_BINDING", "/lease_id", "body-id");
  }
  if (!verifyEd25519(
    offer.body.provider.public_key,
    resourceLeaseProviderSigningMessage(expectedId),
    envelope.provider_signature
  )) fail("E_RESOURCE_SIGNATURE", "/provider_signature", "provider");
  if (!verifyEd25519(
    envelope.body.consumer.public_key,
    resourceLeaseConsumerSigningMessage(expectedId),
    envelope.consumer_signature
  )) fail("E_RESOURCE_SIGNATURE", "/consumer_signature", "consumer");
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsedDocument.bytes),
    lease_id: expectedId,
    offer_id: offer.offer_id,
    status: "verified"
  });
}

export function prepareResourceLease(options) {
  assertRuntime();
  const [offerSource, bodySource] = exactOptions(
    options, ["offer", "body"], "resource lease draft options"
  );
  const draft = resourceLeaseDraft(offerSource, bodySource);
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    consumer_signing_message: createUint8Array(draft.consumerMessage),
    lease_id: draft.leaseId,
    provider_signing_message: createUint8Array(draft.providerMessage)
  });
}

export function finalizeResourceLease(options) {
  assertRuntime();
  const [offerSource, bodySource, providerSignature, consumerSignature] = exactOptions(
    options,
    ["offer", "body", "provider_signature", "consumer_signature"],
    "resource lease options"
  );
  const draft = resourceLeaseDraft(offerSource, bodySource);
  const bytes = canonicalBytes({
    body: draft.body,
    consumer_signature: consumerSignature,
    format: RESOURCE_FORMATS.lease,
    lease_id: draft.leaseId,
    provider_signature: providerSignature
  });
  return verifyResourceLease({ offer: offerSource, lease: bytes }).bytes;
}

export function verifyResourceLease(options) {
  assertRuntime();
  const [offerSource, leaseSource] = exactOptions(
    options, ["offer", "lease"], "resource lease verification options"
  );
  const offer = verifyResourceOffer(offerSource);
  return verifyLeaseEnvelope(offer, parseCanonicalDocument(leaseSource, "/lease"));
}

function resourceConsumptionBasis(offer, lease) {
  return {
    lease_id: lease.lease_id,
    offer_id: offer.offer_id
  };
}

function validateConsumptionWitnessBody(body, offer, lease) {
  exactKeys(
    body,
    ["consumption_id", "lease_id", "offer_id", "witness_key_id"],
    "/body"
  );
  if (body.offer_id !== offer.offer_id || body.lease_id !== lease.lease_id) {
    fail("E_RESOURCE_BINDING", "/body", "consumption-parent-ids");
  }
  const expectedConsumptionId = deriveResourceConsumptionId(
    resourceConsumptionBasis(offer, lease)
  );
  if (body.consumption_id !== expectedConsumptionId) {
    fail("E_RESOURCE_BINDING", "/body/consumption_id", "offer-lease-id");
  }
  const policy = validateOfferBody(offer.body).witnessPolicy;
  const witness = witnessByKeyId(policy, body.witness_key_id);
  if (!witness) {
    fail("E_RESOURCE_WITNESS", "/body/witness_key_id", "offer-witness-membership");
  }
  return { consumptionId: expectedConsumptionId, witness };
}

function resourceConsumptionWitnessDraft(offerSource, leaseSource, witnessKeyId) {
  const offer = verifyResourceOffer(offerSource);
  const lease = verifyLeaseEnvelope(
    offer,
    parseCanonicalDocument(leaseSource, "/lease")
  );
  const consumptionId = deriveResourceConsumptionId(resourceConsumptionBasis(offer, lease));
  const body = ownCanonicalValue({
    consumption_id: consumptionId,
    lease_id: lease.lease_id,
    offer_id: offer.offer_id,
    witness_key_id: witnessKeyId
  }, "/body");
  validateConsumptionWitnessBody(body, offer, lease);
  const witnessId = deriveResourceConsumptionWitnessId(body);
  const signingMessage = resourceConsumptionWitnessSigningMessage(witnessId);
  return { body, consumptionId, lease, offer, signingMessage, witnessId };
}

function verifyConsumptionWitnessEnvelope(offer, lease, parsedDocument) {
  const envelope = parsedDocument.value;
  exactKeys(
    envelope,
    ["body", "format", "witness_id", "witness_signature"],
    ""
  );
  if (envelope.format !== RESOURCE_FORMATS.consumption_witness) {
    fail(
      "E_RESOURCE_FORMAT",
      "/format",
      RESOURCE_FORMATS.consumption_witness
    );
  }
  const context = validateConsumptionWitnessBody(envelope.body, offer, lease);
  const expectedWitnessId = deriveResourceConsumptionWitnessId(envelope.body);
  if (envelope.witness_id !== expectedWitnessId) {
    fail("E_RESOURCE_BINDING", "/witness_id", "body-id");
  }
  if (!verifyEd25519(
    context.witness.public_key,
    resourceConsumptionWitnessSigningMessage(expectedWitnessId),
    envelope.witness_signature
  )) {
    fail("E_RESOURCE_SIGNATURE", "/witness_signature", "consumption-witness");
  }
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsedDocument.bytes),
    consumption_id: context.consumptionId,
    lease_id: lease.lease_id,
    offer_id: offer.offer_id,
    status: "verified",
    witness_id: expectedWitnessId,
    witness_key_id: context.witness.key_id
  });
}

export function prepareResourceConsumptionWitness(options) {
  assertRuntime();
  const [offer, lease, witnessKeyId] = exactOptions(
    options,
    ["offer", "lease", "witness_key_id"],
    "resource consumption witness draft options"
  );
  const draft = resourceConsumptionWitnessDraft(offer, lease, witnessKeyId);
  const message = createUint8Array(draft.signingMessage);
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    consumption_id: draft.consumptionId,
    signing_message: createUint8Array(message),
    signing_request: freeze({
      message,
      tuple: `resource-consumption:${draft.offer.offer_id}`
    }),
    witness_id: draft.witnessId
  });
}

export function finalizeResourceConsumptionWitness(options) {
  assertRuntime();
  const [offer, lease, witnessKeyId, witnessSignature] = exactOptions(
    options,
    ["offer", "lease", "witness_key_id", "witness_signature"],
    "resource consumption witness options"
  );
  const draft = resourceConsumptionWitnessDraft(offer, lease, witnessKeyId);
  const bytes = canonicalBytes({
    body: draft.body,
    format: RESOURCE_FORMATS.consumption_witness,
    witness_id: draft.witnessId,
    witness_signature: witnessSignature
  });
  return verifyResourceConsumptionWitness({ offer, lease, witness: bytes }).bytes;
}

export function verifyResourceConsumptionWitness(options) {
  assertRuntime();
  const [offerSource, leaseSource, witnessSource] = exactOptions(
    options,
    ["offer", "lease", "witness"],
    "resource consumption witness verification options"
  );
  const offer = verifyResourceOffer(offerSource);
  const lease = verifyLeaseEnvelope(
    offer,
    parseCanonicalDocument(leaseSource, "/lease")
  );
  return verifyConsumptionWitnessEnvelope(
    offer,
    lease,
    parseCanonicalDocument(witnessSource, "/witness")
  );
}

export function createResourceConsumptionAnnouncement(options) {
  assertRuntime();
  const [offerSource, leaseSource, witnessSource] = exactOptions(
    options,
    ["offer", "lease", "witness"],
    "resource consumption announcement options"
  );
  verifyResourceConsumptionWitness({
    offer: offerSource,
    lease: leaseSource,
    witness: witnessSource
  });
  const bytes = canonicalBytes({
    format: RESOURCE_FORMATS.announcement,
    lease: parseCanonicalDocument(leaseSource, "/lease").value,
    offer: parseCanonicalDocument(offerSource, "/offer").value,
    witness: parseCanonicalDocument(witnessSource, "/witness").value
  });
  return verifyResourceConsumptionAnnouncement(bytes).bytes;
}

export function verifyResourceConsumptionAnnouncement(source) {
  assertRuntime();
  const parsed = parseCanonicalDocument(
    source,
    "/announcement",
    RESOURCE_CONTRACT_LIMITS.announcement_bytes
  );
  const announcement = parsed.value;
  exactKeys(announcement, ["format", "lease", "offer", "witness"], "");
  if (announcement.format !== RESOURCE_FORMATS.announcement) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_FORMATS.announcement);
  }
  const offerBytes = canonicalBytes(announcement.offer);
  const leaseBytes = canonicalBytes(announcement.lease);
  const witnessBytes = canonicalBytes(announcement.witness);
  const offer = verifyResourceOffer(offerBytes);
  const lease = verifyResourceLease({ offer: offerBytes, lease: leaseBytes });
  const witness = verifyResourceConsumptionWitness({
    offer: offerBytes,
    lease: leaseBytes,
    witness: witnessBytes
  });
  return freeze({
    bytes: createUint8Array(parsed.bytes),
    consumption_id: witness.consumption_id,
    lease,
    offer,
    status: "verified",
    witness
  });
}

function validateUsageShape(value, allocation) {
  exactKeys(value, USAGE_KEYS, "/body/usage");
  exactKeys(value.storage, STORAGE_USAGE_KEYS, "/body/usage/storage");
  exactKeys(value.bandwidth, BANDWIDTH_USAGE_KEYS, "/body/usage/bandwidth");
  exactKeys(value.compute, COMPUTE_USAGE_KEYS, "/body/usage/compute");
  const usage = {
    storage: {
      bytes_current: canonicalDecimal(
        value.storage.bytes_current, "/body/usage/storage/bytes_current"
      ),
      bytes_peak: canonicalDecimal(
        value.storage.bytes_peak, "/body/usage/storage/bytes_peak"
      )
    },
    bandwidth: {
      ingress_bytes_cumulative: canonicalDecimal(
        value.bandwidth.ingress_bytes_cumulative,
        "/body/usage/bandwidth/ingress_bytes_cumulative"
      ),
      egress_bytes_cumulative: canonicalDecimal(
        value.bandwidth.egress_bytes_cumulative,
        "/body/usage/bandwidth/egress_bytes_cumulative"
      )
    },
    compute: {
      cpu_millis_cumulative: canonicalDecimal(
        value.compute.cpu_millis_cumulative,
        "/body/usage/compute/cpu_millis_cumulative"
      ),
      memory_bytes_peak: canonicalDecimal(
        value.compute.memory_bytes_peak, "/body/usage/compute/memory_bytes_peak"
      ),
      task_millis_peak: canonicalDecimal(
        value.compute.task_millis_peak, "/body/usage/compute/task_millis_peak"
      ),
      concurrency_peak: canonicalDecimal(
        value.compute.concurrency_peak, "/body/usage/compute/concurrency_peak"
      )
    }
  };
  if (usage.storage.bytes_current > usage.storage.bytes_peak) {
    fail("E_RESOURCE_USAGE", "/body/usage/storage", "current-not-above-peak");
  }
  const bounds = [
    [usage.storage.bytes_peak, allocation.storage.capacity_bytes, "/body/usage/storage/bytes_peak"],
    [usage.bandwidth.ingress_bytes_cumulative, allocation.bandwidth.ingress_bytes_total,
      "/body/usage/bandwidth/ingress_bytes_cumulative"],
    [usage.bandwidth.egress_bytes_cumulative, allocation.bandwidth.egress_bytes_total,
      "/body/usage/bandwidth/egress_bytes_cumulative"],
    [usage.compute.cpu_millis_cumulative, allocation.compute.cpu_millis_total,
      "/body/usage/compute/cpu_millis_cumulative"],
    [usage.compute.memory_bytes_peak, allocation.compute.memory_bytes,
      "/body/usage/compute/memory_bytes_peak"],
    [usage.compute.task_millis_peak, allocation.compute.task_millis_max,
      "/body/usage/compute/task_millis_peak"],
    [usage.compute.concurrency_peak, allocation.compute.concurrency,
      "/body/usage/compute/concurrency_peak"]
  ];
  for (let index = 0; index < arrayLength(bounds); index += 1) {
    const [observed, maximum, path] = arrayValueAt(bounds, index);
    if (observed > maximum) fail("E_RESOURCE_USAGE", path, "lease-bound");
  }
  return usage;
}

function assertUsageMonotonic(current, previous) {
  const pairs = [
    [current.storage.bytes_peak, previous.storage.bytes_peak, "/body/usage/storage/bytes_peak"],
    [current.bandwidth.ingress_bytes_cumulative,
      previous.bandwidth.ingress_bytes_cumulative,
      "/body/usage/bandwidth/ingress_bytes_cumulative"],
    [current.bandwidth.egress_bytes_cumulative,
      previous.bandwidth.egress_bytes_cumulative,
      "/body/usage/bandwidth/egress_bytes_cumulative"],
    [current.compute.cpu_millis_cumulative,
      previous.compute.cpu_millis_cumulative,
      "/body/usage/compute/cpu_millis_cumulative"],
    [current.compute.memory_bytes_peak,
      previous.compute.memory_bytes_peak,
      "/body/usage/compute/memory_bytes_peak"],
    [current.compute.task_millis_peak,
      previous.compute.task_millis_peak,
      "/body/usage/compute/task_millis_peak"],
    [current.compute.concurrency_peak,
      previous.compute.concurrency_peak,
      "/body/usage/compute/concurrency_peak"]
  ];
  for (let index = 0; index < arrayLength(pairs); index += 1) {
    const [observed, prior, path] = arrayValueAt(pairs, index);
    if (observed < prior) fail("E_RESOURCE_REPLAY", path, "cumulative-regression");
  }
}

function validateUsageBody(body, lease, previous) {
  exactKeys(
    body,
    ["lease_id", "observed_at_ms", "previous_receipt_id", "receipt_sequence", "usage"],
    "/body"
  );
  if (body.lease_id !== lease.lease_id) {
    fail("E_RESOURCE_BINDING", "/body/lease_id", "lease-id");
  }
  const leaseBounds = validateLeaseBody(lease.body, { offer_id: lease.offer_id, body: lease.offer.body });
  const sequence = canonicalDecimal(body.receipt_sequence, "/body/receipt_sequence");
  if (sequence >= bigInt(RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max)) {
    fail("E_RESOURCE_LIMIT", "/body/receipt_sequence", "receipt-count");
  }
  const observedAt = canonicalDecimal(body.observed_at_ms, "/body/observed_at_ms");
  if (observedAt < leaseBounds.startsAt || observedAt > leaseBounds.endsAt) {
    fail("E_RESOURCE_TIME", "/body/observed_at_ms", "lease-window");
  }
  const usage = validateUsageShape(body.usage, leaseBounds.allocation);
  if (previous === null) {
    if (sequence !== 0n || body.previous_receipt_id !== null) {
      fail("E_RESOURCE_REPLAY", "/body/previous_receipt_id", "genesis-receipt");
    }
  } else {
    const priorSequence = canonicalDecimal(
      previous.body.receipt_sequence, "/previous/body/receipt_sequence"
    );
    const priorTime = canonicalDecimal(
      previous.body.observed_at_ms, "/previous/body/observed_at_ms"
    );
    if (sequence !== priorSequence + 1n) {
      fail("E_RESOURCE_REPLAY", "/body/receipt_sequence", "next-sequence");
    }
    if (body.previous_receipt_id !== previous.receipt_id) {
      fail("E_RESOURCE_REPLAY", "/body/previous_receipt_id", "previous-id");
    }
    if (observedAt <= priorTime) {
      fail("E_RESOURCE_TIME", "/body/observed_at_ms", "strictly-increasing");
    }
    assertUsageMonotonic(usage, validateUsageShape(previous.body.usage, leaseBounds.allocation));
  }
  return { observedAt, sequence, usage };
}

function verifiedLeaseContext(offerSource, leaseSource) {
  const offer = verifyResourceOffer(offerSource);
  const lease = verifyLeaseEnvelope(offer, parseCanonicalDocument(leaseSource, "/lease"));
  return { lease: { ...lease, offer }, offer };
}

function verifyUsageEnvelope(context, previous, parsedDocument) {
  const envelope = parsedDocument.value;
  exactKeys(
    envelope,
    ["body", "consumer_signature", "format", "provider_signature", "receipt_id"],
    ""
  );
  if (envelope.format !== RESOURCE_FORMATS.usage) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_FORMATS.usage);
  }
  validateUsageBody(envelope.body, context.lease, previous);
  const expectedId = deriveResourceUsageId(envelope.body);
  if (envelope.receipt_id !== expectedId) {
    fail("E_RESOURCE_BINDING", "/receipt_id", "body-id");
  }
  if (!verifyEd25519(
    context.offer.body.provider.public_key,
    resourceUsageProviderSigningMessage(expectedId),
    envelope.provider_signature
  )) fail("E_RESOURCE_SIGNATURE", "/provider_signature", "provider");
  if (!verifyEd25519(
    context.lease.body.consumer.public_key,
    resourceUsageConsumerSigningMessage(expectedId),
    envelope.consumer_signature
  )) fail("E_RESOURCE_SIGNATURE", "/consumer_signature", "consumer");
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsedDocument.bytes),
    lease_id: context.lease.lease_id,
    receipt_id: expectedId,
    status: "verified"
  });
}

function verifyUsageChain(context, sourcesValue, path = "/previous_receipts") {
  const sources = boundedArray(
    sourcesValue,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "previous resource usage receipts"
  );
  let previous = null;
  for (let index = 0; index < arrayLength(sources); index += 1) {
    previous = verifyUsageEnvelope(
      context,
      previous,
      parseCanonicalDocument(arrayValueAt(sources, index), `${path}/${index}`)
    );
  }
  return previous;
}

function resourceUsageDraft(offerSource, leaseSource, previousSources, bodySource) {
  const context = verifiedLeaseContext(offerSource, leaseSource);
  const previous = verifyUsageChain(context, previousSources);
  const body = ownCanonicalValue(bodySource, "/body");
  validateUsageBody(body, context.lease, previous);
  const receiptId = deriveResourceUsageId(body);
  return {
    body,
    consumerMessage: resourceUsageConsumerSigningMessage(receiptId),
    context,
    previous,
    providerMessage: resourceUsageProviderSigningMessage(receiptId),
    receiptId
  };
}

export function prepareResourceUsageReceipt(options) {
  assertRuntime();
  const [offer, lease, previousReceipts, body] = exactOptions(
    options,
    ["offer", "lease", "previous_receipts", "body"],
    "resource usage draft options"
  );
  const draft = resourceUsageDraft(offer, lease, previousReceipts, body);
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    consumer_signing_message: createUint8Array(draft.consumerMessage),
    provider_signing_message: createUint8Array(draft.providerMessage),
    receipt_id: draft.receiptId
  });
}

export function finalizeResourceUsageReceipt(options) {
  assertRuntime();
  const [offer, lease, previousReceipts, body, providerSignature, consumerSignature] =
    exactOptions(
      options,
      [
        "offer",
        "lease",
        "previous_receipts",
        "body",
        "provider_signature",
        "consumer_signature"
      ],
      "resource usage options"
    );
  const draft = resourceUsageDraft(offer, lease, previousReceipts, body);
  const bytes = canonicalBytes({
    body: draft.body,
    consumer_signature: consumerSignature,
    format: RESOURCE_FORMATS.usage,
    provider_signature: providerSignature,
    receipt_id: draft.receiptId
  });
  return verifyUsageEnvelope(
    draft.context,
    draft.previous,
    parseCanonicalDocument(bytes, "/usage_receipt")
  ).bytes;
}

export function verifyResourceUsageReceipt(options) {
  assertRuntime();
  const [offer, lease, previousReceipts, receipt] = exactOptions(
    options,
    ["offer", "lease", "previous_receipts", "receipt"],
    "resource usage verification options"
  );
  const context = verifiedLeaseContext(offer, lease);
  const previous = verifyUsageChain(context, previousReceipts);
  return verifyUsageEnvelope(
    context,
    previous,
    parseCanonicalDocument(receipt, "/usage_receipt")
  );
}

export function verifyResourceUsageReceiptChain(options) {
  assertRuntime();
  const [offer, lease, receipts] = exactOptions(
    options,
    ["offer", "lease", "receipts"],
    "resource usage chain verification options"
  );
  const context = verifiedLeaseContext(offer, lease);
  const sources = boundedArray(
    receipts,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "resource usage receipts"
  );
  const verified = [];
  let previous = null;
  for (let index = 0; index < arrayLength(sources); index += 1) {
    previous = verifyUsageEnvelope(
      context,
      previous,
      parseCanonicalDocument(arrayValueAt(sources, index), `/receipts/${index}`)
    );
    verified[index] = previous;
  }
  return freeze(verified);
}

function validateRevocationBody(body, context) {
  exactKeys(
    body,
    ["actor_key_id", "effective_at_ms", "reason", "revocation_nonce", "target_id", "target_kind"],
    "/body"
  );
  assertNonce(body.revocation_nonce, "/body/revocation_nonce");
  if (!setHas(REVOCATION_REASONS, body.reason)) {
    fail("E_RESOURCE_REVOCATION", "/body/reason", "unsupported");
  }
  const effectiveAt = canonicalDecimal(body.effective_at_ms, "/body/effective_at_ms");
  let signer;
  let latest;
  if (body.target_kind === "offer") {
    if (body.target_id !== context.offer.offer_id) {
      fail("E_RESOURCE_BINDING", "/body/target_id", "offer-id");
    }
    if (body.actor_key_id !== context.offer.body.provider.key_id) {
      fail("E_RESOURCE_REVOCATION", "/body/actor_key_id", "offer-provider-only");
    }
    signer = context.offer.body.provider;
    latest = canonicalDecimal(context.offer.body.expires_at_ms, "/offer/body/expires_at_ms");
  } else if (body.target_kind === "lease") {
    if (!context.lease || body.target_id !== context.lease.lease_id) {
      fail("E_RESOURCE_BINDING", "/body/target_id", "lease-id");
    }
    const provider = context.offer.body.provider;
    const consumer = context.lease.body.consumer;
    signer = body.actor_key_id === provider.key_id
      ? provider
      : body.actor_key_id === consumer.key_id
        ? consumer
        : null;
    if (!signer) {
      fail("E_RESOURCE_REVOCATION", "/body/actor_key_id", "lease-party-only");
    }
    latest = canonicalDecimal(context.lease.body.ends_at_ms, "/lease/body/ends_at_ms");
  } else {
    fail("E_RESOURCE_REVOCATION", "/body/target_kind", "offer-or-lease");
  }
  if (effectiveAt > latest) {
    fail("E_RESOURCE_TIME", "/body/effective_at_ms", "target-window");
  }
  return { effectiveAt, signer };
}

function resourceRevocationDraft(offerSource, leaseSource, bodySource) {
  const offer = verifyResourceOffer(offerSource);
  const lease = leaseSource === null
    ? null
    : verifyLeaseEnvelope(offer, parseCanonicalDocument(leaseSource, "/lease"));
  const context = { lease, offer };
  const body = ownCanonicalValue(bodySource, "/body");
  const validation = validateRevocationBody(body, context);
  const revocationId = deriveResourceRevocationId(body);
  return {
    body,
    context,
    revocationId,
    signer: validation.signer,
    signingMessage: resourceRevocationSigningMessage(revocationId)
  };
}

function verifyRevocationEnvelope(context, parsedDocument) {
  const envelope = parsedDocument.value;
  exactKeys(envelope, ["body", "format", "revocation_id", "signature"], "");
  if (envelope.format !== RESOURCE_FORMATS.revocation) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_FORMATS.revocation);
  }
  const validation = validateRevocationBody(envelope.body, context);
  const expectedId = deriveResourceRevocationId(envelope.body);
  if (envelope.revocation_id !== expectedId) {
    fail("E_RESOURCE_BINDING", "/revocation_id", "body-id");
  }
  if (!verifyEd25519(
    validation.signer.public_key,
    resourceRevocationSigningMessage(expectedId),
    envelope.signature
  )) fail("E_RESOURCE_SIGNATURE", "/signature", "revocation-actor");
  return freeze({
    actor_key_id: envelope.body.actor_key_id,
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsedDocument.bytes),
    effective_at_ms: envelope.body.effective_at_ms,
    revocation_id: expectedId,
    status: "verified",
    target_id: envelope.body.target_id,
    target_kind: envelope.body.target_kind
  });
}

export function prepareResourceRevocation(options) {
  assertRuntime();
  const [offer, lease, body] = exactOptions(
    options, ["offer", "lease", "body"], "resource revocation draft options"
  );
  const draft = resourceRevocationDraft(offer, lease, body);
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    revocation_id: draft.revocationId,
    signing_message: createUint8Array(draft.signingMessage),
    signer_key_id: draft.signer.key_id
  });
}

export function finalizeResourceRevocation(options) {
  assertRuntime();
  const [offer, lease, body, signature] = exactOptions(
    options,
    ["offer", "lease", "body", "signature"],
    "resource revocation options"
  );
  const draft = resourceRevocationDraft(offer, lease, body);
  const bytes = canonicalBytes({
    body: draft.body,
    format: RESOURCE_FORMATS.revocation,
    revocation_id: draft.revocationId,
    signature
  });
  return verifyRevocationEnvelope(
    draft.context,
    parseCanonicalDocument(bytes, "/revocation")
  ).bytes;
}

export function verifyResourceRevocation(options) {
  assertRuntime();
  const [offerSource, leaseSource, revocationSource] = exactOptions(
    options,
    ["offer", "lease", "revocation"],
    "resource revocation verification options"
  );
  const offer = verifyResourceOffer(offerSource);
  const lease = leaseSource === null
    ? null
    : verifyLeaseEnvelope(offer, parseCanonicalDocument(leaseSource, "/lease"));
  return verifyRevocationEnvelope(
    { lease, offer },
    parseCanonicalDocument(revocationSource, "/revocation")
  );
}

function boundedArray(value, maximum, label) {
  let length;
  try {
    length = ownDataArrayLength(value, label);
  } catch {
    fail("E_RESOURCE_FORMAT", "", `${label}-array`);
  }
  if (length > maximum) fail("E_RESOURCE_LIMIT", "", `${label}-count`);
  try {
    return copyBoundedOwnDataArray(value, length, label);
  } catch {
    fail("E_RESOURCE_FORMAT", "", `${label}-array`);
  }
}

function usageExhausted(receipt, lease) {
  if (!receipt) return false;
  const allocation = validateCapacity(lease.body.allocation, "/lease/body/allocation");
  const usage = validateUsageShape(receipt.body.usage, allocation);
  return (
    (allocation.bandwidth.ingress_bytes_total > 0n &&
      usage.bandwidth.ingress_bytes_cumulative === allocation.bandwidth.ingress_bytes_total) ||
    (allocation.bandwidth.egress_bytes_total > 0n &&
      usage.bandwidth.egress_bytes_cumulative === allocation.bandwidth.egress_bytes_total) ||
    (allocation.compute.cpu_millis_total > 0n &&
      usage.compute.cpu_millis_cumulative === allocation.compute.cpu_millis_total)
  );
}

export function evaluateResourceContract(options) {
  assertRuntime();
  const [
    announcementSourcesValue,
    offerSource,
    leaseSourcesValue,
    observed,
    receiptSourcesValue,
    revocationSourcesValue
  ] = exactOptions(
    options,
    [
      "consumption_announcements",
      "offer",
      "leases",
      "observed_at_ms",
      "usage_receipts",
      "revocations"
    ],
    "resource evaluation options"
  );
  const announcementSources = boundedArray(
    announcementSourcesValue,
    RESOURCE_CONTRACT_LIMITS.announcements_per_evaluation_max,
    "resource consumption announcements"
  );
  const leaseSources = boundedArray(
    leaseSourcesValue,
    RESOURCE_CONTRACT_LIMITS.leases_per_offer_observation_max,
    "resource leases"
  );
  const receiptSources = boundedArray(
    receiptSourcesValue,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "resource usage receipts"
  );
  const revocationSources = boundedArray(
    revocationSourcesValue,
    RESOURCE_CONTRACT_LIMITS.revocations_per_evaluation_max,
    "resource revocations"
  );
  const observedAt = canonicalDecimal(observed, "/observed_at_ms");
  const offer = verifyResourceOffer(offerSource);
  const offerTimes = validateOfferBody(offer.body);

  let lease = null;
  for (let index = 0; index < arrayLength(leaseSources); index += 1) {
    const candidate = verifyLeaseEnvelope(
      offer,
      parseCanonicalDocument(arrayValueAt(leaseSources, index), `/leases/${index}`)
    );
    if (lease) {
      fail(
        candidate.lease_id === lease.lease_id ? "E_RESOURCE_REPLAY" : "E_RESOURCE_EQUIVOCATION",
        `/leases/${index}`,
        "single-use-offer"
      );
    }
    lease = candidate;
  }

  const witnessCommitments = createMap();
  const witnessedKeys = createSet();
  for (let index = 0; index < arrayLength(announcementSources); index += 1) {
    const announcement = verifyResourceConsumptionAnnouncement(
      arrayValueAt(announcementSources, index)
    );
    if (announcement.offer.offer_id !== offer.offer_id) {
      fail(
        "E_RESOURCE_BINDING",
        `/consumption_announcements/${index}/offer`,
        "evaluation-offer"
      );
    }
    const witnessKeyId = announcement.witness.witness_key_id;
    const priorLeaseId = mapGet(witnessCommitments, witnessKeyId);
    if (priorLeaseId && priorLeaseId !== announcement.lease.lease_id) {
      fail(
        "E_RESOURCE_EQUIVOCATION",
        `/consumption_announcements/${index}/witness`,
        "witness-double-sign"
      );
    }
    if (!priorLeaseId) {
      mapSet(witnessCommitments, witnessKeyId, announcement.lease.lease_id);
    }
    if (lease && announcement.lease.lease_id !== lease.lease_id) {
      fail(
        "E_RESOURCE_EQUIVOCATION",
        `/consumption_announcements/${index}/lease`,
        "single-use-offer"
      );
    }
    lease ??= announcement.lease;
    setAdd(witnessedKeys, witnessKeyId);
  }

  const witnessesVerified = setSize(witnessedKeys);
  const witnessThreshold = offerTimes.witnessPolicy.threshold;
  const witnessed = lease !== null && witnessesVerified >= witnessThreshold;
  if (arrayLength(receiptSources) > 0 && !witnessed) {
    fail("E_RESOURCE_WITNESS", "/usage_receipts", "witness-quorum-required");
  }

  const context = { lease, offer };
  let previousReceipt = null;
  for (let index = 0; index < arrayLength(receiptSources); index += 1) {
    if (!lease) fail("E_RESOURCE_BINDING", `/usage_receipts/${index}`, "lease-required");
    const receipt = verifyUsageEnvelope(
      { lease: { ...lease, offer }, offer },
      previousReceipt,
      parseCanonicalDocument(arrayValueAt(receiptSources, index), `/usage_receipts/${index}`)
    );
    if (canonicalDecimal(receipt.body.observed_at_ms, "/body/observed_at_ms") > observedAt) {
      fail("E_RESOURCE_TIME", `/usage_receipts/${index}`, "future-observation");
    }
    previousReceipt = receipt;
  }

  let earliestOfferRevocation = null;
  let earliestLeaseRevocation = null;
  const revocationIds = createSet();
  for (let index = 0; index < arrayLength(revocationSources); index += 1) {
    const revocation = verifyRevocationEnvelope(
      context,
      parseCanonicalDocument(arrayValueAt(revocationSources, index), `/revocations/${index}`)
    );
    if (setHas(revocationIds, revocation.revocation_id)) {
      fail("E_RESOURCE_REPLAY", `/revocations/${index}`, "duplicate-revocation");
    }
    setAdd(revocationIds, revocation.revocation_id);
    const effectiveAt = canonicalDecimal(
      revocation.effective_at_ms, `/revocations/${index}/body/effective_at_ms`
    );
    if (revocation.target_kind === "offer") {
      if (!earliestOfferRevocation || effectiveAt < earliestOfferRevocation.effectiveAt) {
        earliestOfferRevocation = { effectiveAt, revocation };
      }
    } else if (!earliestLeaseRevocation || effectiveAt < earliestLeaseRevocation.effectiveAt) {
      earliestLeaseRevocation = { effectiveAt, revocation };
    }
  }

  let status;
  let effectiveRevocation = null;
  if (!lease) {
    if (earliestOfferRevocation && earliestOfferRevocation.effectiveAt <= observedAt) {
      status = "revoked";
      effectiveRevocation = earliestOfferRevocation.revocation;
    } else if (observedAt < offerTimes.validFrom) {
      status = "pending";
    } else if (observedAt > offerTimes.expiresAt) {
      status = "expired";
    } else {
      status = "available";
    }
  } else {
    const leaseTimes = validateLeaseBody(lease.body, offer);
    if (
      earliestOfferRevocation &&
      earliestOfferRevocation.effectiveAt <= leaseTimes.startsAt &&
      earliestOfferRevocation.effectiveAt <= observedAt
    ) {
      status = "revoked";
      effectiveRevocation = earliestOfferRevocation.revocation;
    } else if (
      earliestLeaseRevocation && earliestLeaseRevocation.effectiveAt <= observedAt
    ) {
      status = "revoked";
      effectiveRevocation = earliestLeaseRevocation.revocation;
    } else if (!witnessed) {
      status = "unwitnessed";
    } else if (observedAt < leaseTimes.startsAt) {
      status = "scheduled";
    } else if (observedAt > leaseTimes.endsAt) {
      status = "completed";
    } else if (usageExhausted(previousReceipt, lease)) {
      status = "exhausted";
    } else {
      status = "active";
    }
  }

  return freeze({
    announcements_verified: arrayLength(announcementSources),
    consumption_id: lease === null
      ? null
      : deriveResourceConsumptionId(resourceConsumptionBasis(offer, lease)),
    effective_revocation_id: effectiveRevocation?.revocation_id ?? null,
    lease_id: lease?.lease_id ?? null,
    offer_id: offer.offer_id,
    observed_at_ms: observed,
    receipts_verified: arrayLength(receiptSources),
    status,
    witness_threshold: witnessThreshold,
    witnesses_verified: witnessesVerified
  });
}

freeze(ResourceContractError.prototype);
freeze(ResourceContractError);
