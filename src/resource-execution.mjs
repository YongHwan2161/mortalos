import {
  byteLengthOfBytes,
  decodeBase64Url,
  encodeBase64Url
} from "./bytes.mjs";
import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes,
  snapshotBytes
} from "./codec.mjs";
import {
  decodeTagged,
  deriveResourceConsumptionId,
  deriveResourceContentRoot,
  deriveResourceExecutionChallengeId,
  deriveResourceExecutionReceiptId,
  deriveResourceExecutionWorkloadId,
  deriveResourceStorageChallengeDigest,
  resourceContentLeafDigest,
  resourceContentNodeDigest,
  resourceExecutionChallengeSigningMessage,
  resourceExecutionComputeStep,
  resourceExecutionConsumerSigningMessage,
  resourceExecutionPayloadDigest,
  resourceExecutionProviderSigningMessage,
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
  createUint8Array,
  freeze,
  isArray,
  mathFloor,
  objectKeys,
  objectValues,
  ownDataArrayLength,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord,
  typedArraySubarray
} from "./primordials.mjs";
import {
  RESOURCE_CONTRACT_LIMITS,
  ResourceContractError,
  evaluateResourceContract,
  verifyResourceLease,
  verifyResourceOffer,
  verifyResourceUsageReceiptChain
} from "./resource-contract.mjs";

export const RESOURCE_EXECUTION_FORMATS = freeze({
  challenge: "mortalos-resource-execution-challenge/1",
  receipt: "mortalos-resource-execution-receipt/1"
});

export const RESOURCE_EXECUTION_LIMITS = freeze({
  compute_iterations_max:
    PROTOCOL_PROFILE.resource_contract.execution_compute_iterations_max,
  input_bytes: PROTOCOL_PROFILE.resource_contract.execution_input_bytes,
  leaf_bytes: PROTOCOL_PROFILE.resource_contract.execution_leaf_bytes,
  resource_bytes: PROTOCOL_PROFILE.resource_contract.execution_resource_bytes
});

const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const EXECUTION_KINDS = ["bandwidth", "compute", "storage"];

function fail(code, fieldPath = "", detail = "") {
  throw new ResourceContractError(code, fieldPath, detail);
}

function assertRuntime() {
  if (!realmIntrinsicsIntact()) fail("E_RESOURCE_FORMAT", "", "realm-integrity");
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
  if (arrayLength(ownKeys(descriptors)) !== arrayLength(names)) {
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

function parseCanonicalDocument(source, path) {
  let bytes;
  try {
    bytes = snapshotBytes(source, RESOURCE_CONTRACT_LIMITS.document_bytes);
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
      maxBytes: RESOURCE_CONTRACT_LIMITS.document_bytes,
      maxDepth: 20
    });
  } catch {
    fail("E_RESOURCE_FORMAT", path, "canonical-json");
  }
  if (!isCanonical(bytes, value)) fail("E_RESOURCE_FORMAT", path, "canonical-json");
  return { bytes, value };
}

function ownCanonicalValue(source, path) {
  let bytes;
  try {
    bytes = canonicalBytes(source);
  } catch {
    fail("E_RESOURCE_FORMAT", path, "ordinary-own-data-json");
  }
  if (byteLengthOfBytes(bytes) > RESOURCE_CONTRACT_LIMITS.document_bytes) {
    fail("E_RESOURCE_LIMIT", path, "document-bytes");
  }
  return parseJsonBytes(bytes, {
    maxBytes: RESOURCE_CONTRACT_LIMITS.document_bytes,
    maxDepth: 20
  });
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
  if (parsed < 0n || parsed > maximum) fail("E_RESOURCE_DECIMAL", path, "range");
  return parsed;
}

function assertNonce(value, path) {
  const decoded = decodeBase64Url(value);
  if (!decoded || byteLengthOfBytes(decoded) !== 16) {
    fail("E_RESOURCE_FORMAT", path, "base64url-128-bit");
  }
}

function verifiedContext(offerSource, leaseSource) {
  const offer = verifyResourceOffer(offerSource);
  const lease = verifyResourceLease({ offer: offer.bytes, lease: leaseSource });
  return { lease, offer };
}

function consumptionId(context) {
  return deriveResourceConsumptionId({
    lease_id: context.lease.lease_id,
    offer_id: context.offer.offer_id
  });
}

function decodeBoundedBase64(value, maximum, path, emptyAllowed = false) {
  const bytes = decodeBase64Url(value);
  const length = bytes && byteLengthOfBytes(bytes);
  if (!bytes || length > maximum || (!emptyAllowed && length === 0)) {
    fail("E_RESOURCE_LIMIT", path, `base64url-bytes-${maximum}`);
  }
  return bytes;
}

function validateTagged(value, prefix, path) {
  if (!decodeTagged(value, prefix, 32)) fail("E_RESOURCE_BINDING", path, prefix);
}

function validateWorkload(kind, value, path = "/body/workload") {
  if (kind === "storage") {
    exactKeys(value, ["content_root", "leaf_bytes", "leaf_count", "resource_size"], path);
    validateTagged(value.content_root, "resource-content:", `${path}/content_root`);
    const resourceSize = canonicalDecimal(
      value.resource_size,
      `${path}/resource_size`,
      bigInt(RESOURCE_EXECUTION_LIMITS.resource_bytes)
    );
    if (resourceSize === 0n) fail("E_RESOURCE_LIMIT", `${path}/resource_size`, "non-zero");
    const leafBytes = canonicalDecimal(
      value.leaf_bytes,
      `${path}/leaf_bytes`,
      bigInt(RESOURCE_EXECUTION_LIMITS.leaf_bytes)
    );
    if (leafBytes !== bigInt(RESOURCE_EXECUTION_LIMITS.leaf_bytes)) {
      fail("E_RESOURCE_BINDING", `${path}/leaf_bytes`, "profile-leaf-size");
    }
    const leafCount = canonicalDecimal(
      value.leaf_count,
      `${path}/leaf_count`,
      bigInt(RESOURCE_EXECUTION_LIMITS.resource_bytes)
    );
    const expected = (resourceSize + leafBytes - 1n) / leafBytes;
    if (leafCount !== expected) fail("E_RESOURCE_BINDING", `${path}/leaf_count`, "size");
    return { leafCount, resourceSize };
  }
  if (kind === "bandwidth") {
    exactKeys(value, ["payload_base64url", "payload_digest", "payload_size"], path);
    const payload = decodeBoundedBase64(
      value.payload_base64url,
      RESOURCE_EXECUTION_LIMITS.input_bytes,
      `${path}/payload_base64url`
    );
    const size = canonicalDecimal(
      value.payload_size,
      `${path}/payload_size`,
      bigInt(RESOURCE_EXECUTION_LIMITS.input_bytes)
    );
    if (size !== bigInt(byteLengthOfBytes(payload))) {
      fail("E_RESOURCE_BINDING", `${path}/payload_size`, "payload-bytes");
    }
    if (value.payload_digest !== resourceExecutionPayloadDigest(payload)) {
      fail("E_RESOURCE_BINDING", `${path}/payload_digest`, "payload-digest");
    }
    return { payload, size };
  }
  if (kind === "compute") {
    exactKeys(value, ["algorithm", "input_base64url", "iterations"], path);
    if (value.algorithm !== "sha256-chain/1") {
      fail("E_RESOURCE_EXECUTION", `${path}/algorithm`, "unsupported");
    }
    const input = decodeBoundedBase64(
      value.input_base64url,
      RESOURCE_EXECUTION_LIMITS.input_bytes,
      `${path}/input_base64url`,
      true
    );
    const iterations = canonicalDecimal(
      value.iterations,
      `${path}/iterations`,
      bigInt(RESOURCE_EXECUTION_LIMITS.compute_iterations_max)
    );
    if (iterations === 0n) fail("E_RESOURCE_LIMIT", `${path}/iterations`, "non-zero");
    return { input, iterations };
  }
  fail("E_RESOURCE_EXECUTION", "/body/kind", "unsupported");
}

function computeResult(workload) {
  const checked = validateWorkload("compute", workload);
  let digest = resourceExecutionPayloadDigest(checked.input);
  for (let iteration = 0n; iteration < checked.iterations; iteration += 1n) {
    digest = resourceExecutionComputeStep({
      input_digest: resourceExecutionPayloadDigest(checked.input),
      iteration: String(iteration),
      previous_digest: digest
    });
  }
  return { output_digest: digest };
}

function contentLayers(resourceBytes) {
  let bytes;
  try {
    bytes = snapshotBytes(resourceBytes, RESOURCE_EXECUTION_LIMITS.resource_bytes);
  } catch (error) {
    fail(
      error?.code === "E_PARSE_LIMIT_EXCEEDED" ? "E_RESOURCE_LIMIT" : "E_RESOURCE_FORMAT",
      "/resource_bytes",
      "bounded-byte-array"
    );
  }
  const size = byteLengthOfBytes(bytes);
  if (size === 0) fail("E_RESOURCE_LIMIT", "/resource_bytes", "non-zero");
  const count = mathFloor((size + RESOURCE_EXECUTION_LIMITS.leaf_bytes - 1) /
    RESOURCE_EXECUTION_LIMITS.leaf_bytes);
  const layers = [];
  const leaves = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * RESOURCE_EXECUTION_LIMITS.leaf_bytes;
    const leaf = typedArraySubarray(
      bytes,
      start,
      start + RESOURCE_EXECUTION_LIMITS.leaf_bytes
    );
    leaves[index] = resourceContentLeafDigest({
      index: String(index),
      leaf_bytes_base64url: encodeBase64Url(leaf)
    });
  }
  layers[0] = leaves;
  let current = leaves;
  while (arrayLength(current) > 1) {
    const next = [];
    for (let index = 0; index < arrayLength(current); index += 2) {
      next[index / 2] = resourceContentNodeDigest({
        left: arrayValueAt(current, index),
        right: arrayValueAt(current, index + 1) ?? arrayValueAt(current, index)
      });
    }
    layers[arrayLength(layers)] = next;
    current = next;
  }
  const descriptor = {
    leaf_bytes: String(RESOURCE_EXECUTION_LIMITS.leaf_bytes),
    leaf_count: String(count),
    resource_size: String(size),
    tree_digest: arrayValueAt(current, 0)
  };
  return { bytes, descriptor, layers };
}

export function createResourceContentCommitment(resourceBytes) {
  assertRuntime();
  const built = contentLayers(resourceBytes);
  return deepFreeze({
    content_root: deriveResourceContentRoot(built.descriptor),
    leaf_bytes: built.descriptor.leaf_bytes,
    leaf_count: built.descriptor.leaf_count,
    resource_size: built.descriptor.resource_size
  });
}

function storageChallengeIndex(challengeBody, leafCount) {
  const digest = deriveResourceStorageChallengeDigest({
    challenge_nonce: challengeBody.challenge_nonce,
    content_root: challengeBody.workload.content_root,
    lease_id: challengeBody.lease_id
  });
  const raw = decodeTagged(digest, "sha256:", 32);
  let value = 0n;
  for (let index = 0; index < 8; index += 1) value = value * 256n + bigInt(raw[index]);
  return value % leafCount;
}

function validateChallengeBody(body, context, previous) {
  exactKeys(
    body,
    [
      "challenge_nonce",
      "challenge_sequence",
      "consumption_id",
      "issued_at_ms",
      "kind",
      "lease_id",
      "offer_id",
      "previous_execution_receipt_id",
      "workload"
    ],
    "/body"
  );
  assertNonce(body.challenge_nonce, "/body/challenge_nonce");
  if (!EXECUTION_KINDS.includes(body.kind)) {
    fail("E_RESOURCE_EXECUTION", "/body/kind", "unsupported");
  }
  if (
    body.offer_id !== context.offer.offer_id ||
    body.lease_id !== context.lease.lease_id ||
    body.consumption_id !== consumptionId(context)
  ) fail("E_RESOURCE_BINDING", "/body", "execution-parent-ids");
  const issued = canonicalDecimal(body.issued_at_ms, "/body/issued_at_ms");
  const starts = canonicalDecimal(context.lease.body.starts_at_ms, "/lease/body/starts_at_ms");
  const ends = canonicalDecimal(context.lease.body.ends_at_ms, "/lease/body/ends_at_ms");
  if (issued < starts || issued > ends) {
    fail("E_RESOURCE_TIME", "/body/issued_at_ms", "lease-window");
  }
  const sequence = canonicalDecimal(body.challenge_sequence, "/body/challenge_sequence");
  if (sequence >= bigInt(RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max)) {
    fail("E_RESOURCE_LIMIT", "/body/challenge_sequence", "receipt-count");
  }
  if (previous === null) {
    if (sequence !== 0n || body.previous_execution_receipt_id !== null) {
      fail("E_RESOURCE_REPLAY", "/body/previous_execution_receipt_id", "genesis-execution");
    }
  } else {
    const prior = canonicalDecimal(
      previous.body.execution_sequence,
      "/previous/body/execution_sequence"
    );
    if (sequence !== prior + 1n) {
      fail("E_RESOURCE_REPLAY", "/body/challenge_sequence", "next-sequence");
    }
    if (body.previous_execution_receipt_id !== previous.receipt_id) {
      fail("E_RESOURCE_REPLAY", "/body/previous_execution_receipt_id", "previous-id");
    }
    const priorTime = canonicalDecimal(previous.body.executed_at_ms, "/previous/body/executed_at_ms");
    if (issued <= priorTime) fail("E_RESOURCE_TIME", "/body/issued_at_ms", "strictly-increasing");
  }
  validateWorkload(body.kind, body.workload);
  return { issued, sequence };
}

function verifyChallengeEnvelope(context, previous, parsed) {
  const envelope = parsed.value;
  exactKeys(envelope, ["body", "challenge_id", "consumer_signature", "format"], "");
  if (envelope.format !== RESOURCE_EXECUTION_FORMATS.challenge) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_EXECUTION_FORMATS.challenge);
  }
  validateChallengeBody(envelope.body, context, previous);
  const challengeId = deriveResourceExecutionChallengeId(envelope.body);
  if (envelope.challenge_id !== challengeId) {
    fail("E_RESOURCE_BINDING", "/challenge_id", "body-id");
  }
  if (!verifyEd25519(
    context.lease.body.consumer.public_key,
    resourceExecutionChallengeSigningMessage(challengeId),
    envelope.consumer_signature
  )) fail("E_RESOURCE_SIGNATURE", "/consumer_signature", "execution-challenge-consumer");
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsed.bytes),
    challenge_id: challengeId,
    consumer_signature: envelope.consumer_signature,
    status: "verified"
  });
}

function executionUsageFor(context, usageSources) {
  return verifyResourceUsageReceiptChain({
    offer: context.offer.bytes,
    lease: context.lease.bytes,
    receipts: usageSources
  });
}

function verifyResult(kind, workload, result, challengeBody) {
  if (kind === "compute") {
    exactKeys(result, ["output_digest"], "/body/result");
    if (result.output_digest !== computeResult(workload).output_digest) {
      fail("E_RESOURCE_EXECUTION", "/body/result/output_digest", "deterministic-output");
    }
    return;
  }
  if (kind === "bandwidth") {
    exactKeys(result, ["echo_digest", "egress_bytes", "ingress_bytes"], "/body/result");
    const checked = validateWorkload(kind, workload);
    if (result.echo_digest !== workload.payload_digest) {
      fail("E_RESOURCE_EXECUTION", "/body/result/echo_digest", "challenge-echo");
    }
    if (
      canonicalDecimal(result.egress_bytes, "/body/result/egress_bytes") !== checked.size ||
      canonicalDecimal(result.ingress_bytes, "/body/result/ingress_bytes") !== checked.size
    ) fail("E_RESOURCE_EXECUTION", "/body/result", "round-trip-byte-count");
    return;
  }
  exactKeys(result, ["leaf_bytes_base64url", "leaf_index", "proof"], "/body/result");
  const checked = validateWorkload(kind, workload);
  const expectedIndex = storageChallengeIndex(challengeBody, checked.leafCount);
  const index = canonicalDecimal(result.leaf_index, "/body/result/leaf_index", checked.leafCount - 1n);
  if (index !== expectedIndex) fail("E_RESOURCE_EXECUTION", "/body/result/leaf_index", "challenge-index");
  const leaf = decodeBoundedBase64(
    result.leaf_bytes_base64url,
    RESOURCE_EXECUTION_LIMITS.leaf_bytes,
    "/body/result/leaf_bytes_base64url"
  );
  const expectedLength = index === checked.leafCount - 1n
    ? Number(checked.resourceSize - index * bigInt(RESOURCE_EXECUTION_LIMITS.leaf_bytes))
    : RESOURCE_EXECUTION_LIMITS.leaf_bytes;
  if (byteLengthOfBytes(leaf) !== expectedLength) {
    fail("E_RESOURCE_EXECUTION", "/body/result/leaf_bytes_base64url", "leaf-length");
  }
  const proof = boundedArray(result.proof, 32, "resource storage proof");
  let nodes = checked.leafCount;
  let required = 0;
  while (nodes > 1n) {
    required += 1;
    nodes = (nodes + 1n) / 2n;
  }
  if (arrayLength(proof) !== required) fail("E_RESOURCE_EXECUTION", "/body/result/proof", "proof-depth");
  let digest = resourceContentLeafDigest({
    index: String(index),
    leaf_bytes_base64url: result.leaf_bytes_base64url
  });
  let position = index;
  for (let level = 0; level < required; level += 1) {
    const sibling = arrayValueAt(proof, level);
    validateTagged(sibling, "sha256:", `/body/result/proof/${level}`);
    digest = position % 2n === 0n
      ? resourceContentNodeDigest({ left: digest, right: sibling })
      : resourceContentNodeDigest({ left: sibling, right: digest });
    position /= 2n;
  }
  const root = deriveResourceContentRoot({
    leaf_bytes: workload.leaf_bytes,
    leaf_count: workload.leaf_count,
    resource_size: workload.resource_size,
    tree_digest: digest
  });
  if (root !== workload.content_root) {
    fail("E_RESOURCE_EXECUTION", "/body/result/proof", "content-root");
  }
}

function validateUsageCoverage(kind, workload, usage, previousUsage) {
  const zero = {
    bandwidth: { egress_bytes_cumulative: "0", ingress_bytes_cumulative: "0" },
    compute: { cpu_millis_cumulative: "0" }
  };
  const prior = previousUsage?.body.usage ?? zero;
  if (kind === "storage") {
    const required = canonicalDecimal(workload.resource_size, "/body/workload/resource_size");
    if (
      canonicalDecimal(usage.body.usage.storage.bytes_current, "/usage/storage/bytes_current") < required ||
      canonicalDecimal(usage.body.usage.storage.bytes_peak, "/usage/storage/bytes_peak") < required
    ) fail("E_RESOURCE_EXECUTION", "/usage/storage", "measured-usage-understates-work");
  } else if (kind === "bandwidth") {
    const required = canonicalDecimal(workload.payload_size, "/body/workload/payload_size");
    const ingress = canonicalDecimal(usage.body.usage.bandwidth.ingress_bytes_cumulative, "/usage/bandwidth/ingress");
    const egress = canonicalDecimal(usage.body.usage.bandwidth.egress_bytes_cumulative, "/usage/bandwidth/egress");
    const priorIngress = canonicalDecimal(prior.bandwidth.ingress_bytes_cumulative, "/previous/usage/bandwidth/ingress");
    const priorEgress = canonicalDecimal(prior.bandwidth.egress_bytes_cumulative, "/previous/usage/bandwidth/egress");
    if (ingress - priorIngress < required || egress - priorEgress < required) {
      fail("E_RESOURCE_EXECUTION", "/usage/bandwidth", "measured-usage-understates-work");
    }
  } else {
    const current = canonicalDecimal(usage.body.usage.compute.cpu_millis_cumulative, "/usage/compute/cpu");
    const priorCpu = canonicalDecimal(prior.compute.cpu_millis_cumulative, "/previous/usage/compute/cpu");
    if (current <= priorCpu) fail("E_RESOURCE_EXECUTION", "/usage/compute", "zero-measured-work");
  }
}

function validateReceiptBody(body, context, previous, challenge, usage, previousUsage) {
  exactKeys(
    body,
    [
      "challenge_id",
      "consumption_id",
      "executed_at_ms",
      "execution_sequence",
      "kind",
      "lease_id",
      "offer_id",
      "previous_execution_receipt_id",
      "result",
      "usage_receipt_id",
      "workload_id"
    ],
    "/body"
  );
  const challengeBody = challenge.body;
  if (
    body.challenge_id !== challenge.challenge_id ||
    body.offer_id !== context.offer.offer_id ||
    body.lease_id !== context.lease.lease_id ||
    body.consumption_id !== consumptionId(context) ||
    body.consumption_id !== challengeBody.consumption_id ||
    body.kind !== challengeBody.kind
  ) fail("E_RESOURCE_BINDING", "/body", "execution-challenge-parent");
  if (
    body.execution_sequence !== challengeBody.challenge_sequence ||
    body.previous_execution_receipt_id !== challengeBody.previous_execution_receipt_id
  ) fail("E_RESOURCE_REPLAY", "/body", "challenge-chain");
  if (body.usage_receipt_id !== usage.receipt_id) {
    fail("E_RESOURCE_BINDING", "/body/usage_receipt_id", "usage-receipt");
  }
  if (usage.body.receipt_sequence !== body.execution_sequence) {
    fail("E_RESOURCE_REPLAY", "/body/execution_sequence", "usage-sequence");
  }
  const executed = canonicalDecimal(body.executed_at_ms, "/body/executed_at_ms");
  if (
    body.executed_at_ms !== usage.body.observed_at_ms ||
    executed < canonicalDecimal(challengeBody.issued_at_ms, "/challenge/body/issued_at_ms")
  ) fail("E_RESOURCE_TIME", "/body/executed_at_ms", "challenge-and-usage-time");
  const workloadId = deriveResourceExecutionWorkloadId({
    kind: challengeBody.kind,
    workload: challengeBody.workload
  });
  if (body.workload_id !== workloadId) {
    fail("E_RESOURCE_BINDING", "/body/workload_id", "workload");
  }
  if (previous === null) {
    if (body.previous_execution_receipt_id !== null) {
      fail("E_RESOURCE_REPLAY", "/body/previous_execution_receipt_id", "genesis-execution");
    }
  } else if (body.previous_execution_receipt_id !== previous.receipt_id) {
    fail("E_RESOURCE_REPLAY", "/body/previous_execution_receipt_id", "previous-id");
  }
  verifyResult(body.kind, challengeBody.workload, body.result, challengeBody);
  validateUsageCoverage(body.kind, challengeBody.workload, usage, previousUsage);
  return { workloadId };
}

function verifyReceiptEnvelope(context, previous, challenge, usage, previousUsage, parsed) {
  const envelope = parsed.value;
  exactKeys(
    envelope,
    ["body", "challenge", "consumer_signature", "format", "provider_signature", "receipt_id"],
    ""
  );
  if (envelope.format !== RESOURCE_EXECUTION_FORMATS.receipt) {
    fail("E_RESOURCE_FORMAT", "/format", RESOURCE_EXECUTION_FORMATS.receipt);
  }
  if (!isCanonical(canonicalBytes(envelope.challenge), envelope.challenge)) {
    fail("E_RESOURCE_FORMAT", "/challenge", "canonical");
  }
  const embeddedChallenge = verifyChallengeEnvelope(
    context,
    previous,
    parseCanonicalDocument(canonicalBytes(envelope.challenge), "/challenge")
  );
  if (challenge && embeddedChallenge.challenge_id !== challenge.challenge_id) {
    fail("E_RESOURCE_BINDING", "/challenge", "supplied-challenge");
  }
  validateReceiptBody(
    envelope.body,
    context,
    previous,
    embeddedChallenge,
    usage,
    previousUsage
  );
  const receiptId = deriveResourceExecutionReceiptId(envelope.body);
  if (envelope.receipt_id !== receiptId) fail("E_RESOURCE_BINDING", "/receipt_id", "body-id");
  if (!verifyEd25519(
    context.offer.body.provider.public_key,
    resourceExecutionProviderSigningMessage(receiptId),
    envelope.provider_signature
  )) fail("E_RESOURCE_SIGNATURE", "/provider_signature", "execution-provider");
  if (!verifyEd25519(
    context.lease.body.consumer.public_key,
    resourceExecutionConsumerSigningMessage(receiptId),
    envelope.consumer_signature
  )) fail("E_RESOURCE_SIGNATURE", "/consumer_signature", "execution-consumer");
  return freeze({
    body: deepFreeze(envelope.body),
    bytes: createUint8Array(parsed.bytes),
    challenge: embeddedChallenge,
    receipt_id: receiptId,
    status: "verified",
    workload_id: envelope.body.workload_id
  });
}

function verifyExecutionChain(context, receiptSourcesValue, usage) {
  const sources = boundedArray(
    receiptSourcesValue,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "resource execution receipts"
  );
  if (arrayLength(sources) > arrayLength(usage)) {
    fail("E_RESOURCE_EXECUTION", "/execution_receipts", "missing-usage-receipt");
  }
  const verified = [];
  let previous = null;
  for (let index = 0; index < arrayLength(sources); index += 1) {
    previous = verifyReceiptEnvelope(
      context,
      previous,
      null,
      arrayValueAt(usage, index),
      index === 0 ? null : arrayValueAt(usage, index - 1),
      parseCanonicalDocument(arrayValueAt(sources, index), `/execution_receipts/${index}`)
    );
    verified[index] = previous;
  }
  return verified;
}

function challengeDraft(offerSource, leaseSource, executionSources, usageSources, bodySource) {
  const context = verifiedContext(offerSource, leaseSource);
  const usage = executionUsageFor(context, usageSources);
  const previousReceipts = verifyExecutionChain(context, executionSources, usage);
  if (arrayLength(previousReceipts) !== arrayLength(usage)) {
    fail("E_RESOURCE_EXECUTION", "/usage_receipts", "unproved-prior-usage");
  }
  const previous = arrayLength(previousReceipts) === 0
    ? null
    : arrayValueAt(previousReceipts, arrayLength(previousReceipts) - 1);
  const body = ownCanonicalValue(bodySource, "/body");
  validateChallengeBody(body, context, previous);
  const challengeId = deriveResourceExecutionChallengeId(body);
  return { body, challengeId, context, previous, usage };
}

export function prepareResourceExecutionChallenge(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, body] = exactOptions(
    options,
    ["offer", "lease", "previous_execution_receipts", "usage_receipts", "body"],
    "resource execution challenge draft options"
  );
  const draft = challengeDraft(
    offer,
    lease,
    previousExecutionReceipts,
    usageReceipts,
    body
  );
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    challenge_id: draft.challengeId,
    consumer_signing_message: createUint8Array(
      resourceExecutionChallengeSigningMessage(draft.challengeId)
    )
  });
}

export function finalizeResourceExecutionChallenge(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, body, consumerSignature] =
    exactOptions(
      options,
      [
        "offer",
        "lease",
        "previous_execution_receipts",
        "usage_receipts",
        "body",
        "consumer_signature"
      ],
      "resource execution challenge options"
    );
  const draft = challengeDraft(offer, lease, previousExecutionReceipts, usageReceipts, body);
  const bytes = canonicalBytes({
    body: draft.body,
    challenge_id: draft.challengeId,
    consumer_signature: consumerSignature,
    format: RESOURCE_EXECUTION_FORMATS.challenge
  });
  return verifyChallengeEnvelope(
    draft.context,
    draft.previous,
    parseCanonicalDocument(bytes, "/challenge")
  ).bytes;
}

export function verifyResourceExecutionChallenge(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, challenge] = exactOptions(
    options,
    ["offer", "lease", "previous_execution_receipts", "usage_receipts", "challenge"],
    "resource execution challenge verification options"
  );
  const context = verifiedContext(offer, lease);
  const usage = executionUsageFor(context, usageReceipts);
  const previousReceipts = verifyExecutionChain(context, previousExecutionReceipts, usage);
  if (arrayLength(previousReceipts) !== arrayLength(usage)) {
    fail("E_RESOURCE_EXECUTION", "/usage_receipts", "unproved-prior-usage");
  }
  const previous = arrayLength(previousReceipts) === 0
    ? null
    : arrayValueAt(previousReceipts, arrayLength(previousReceipts) - 1);
  return verifyChallengeEnvelope(context, previous, parseCanonicalDocument(challenge, "/challenge"));
}

function receiptDraft(
  offerSource,
  leaseSource,
  executionSources,
  usageSources,
  challengeSource,
  resultSource
) {
  const context = verifiedContext(offerSource, leaseSource);
  const usage = executionUsageFor(context, usageSources);
  if (arrayLength(usage) === 0) fail("E_RESOURCE_EXECUTION", "/usage_receipts", "current-required");
  const previousUsageCount = arrayLength(usage) - 1;
  const previousUsage = [];
  for (let index = 0; index < previousUsageCount; index += 1) previousUsage[index] = arrayValueAt(usage, index);
  const previousReceipts = verifyExecutionChain(context, executionSources, previousUsage);
  if (arrayLength(previousReceipts) !== previousUsageCount) {
    fail("E_RESOURCE_EXECUTION", "/execution_receipts", "one-to-one-prior-chain");
  }
  const previous = previousUsageCount === 0
    ? null
    : arrayValueAt(previousReceipts, previousUsageCount - 1);
  const challenge = verifyChallengeEnvelope(
    context,
    previous,
    parseCanonicalDocument(challengeSource, "/challenge")
  );
  const currentUsage = arrayValueAt(usage, previousUsageCount);
  const result = ownCanonicalValue(resultSource, "/result");
  const body = {
    challenge_id: challenge.challenge_id,
    consumption_id: challenge.body.consumption_id,
    executed_at_ms: currentUsage.body.observed_at_ms,
    execution_sequence: challenge.body.challenge_sequence,
    kind: challenge.body.kind,
    lease_id: challenge.body.lease_id,
    offer_id: challenge.body.offer_id,
    previous_execution_receipt_id: challenge.body.previous_execution_receipt_id,
    result,
    usage_receipt_id: currentUsage.receipt_id,
    workload_id: deriveResourceExecutionWorkloadId({
      kind: challenge.body.kind,
      workload: challenge.body.workload
    })
  };
  validateReceiptBody(body, context, previous, challenge, currentUsage, previousUsageCount === 0
    ? null
    : arrayValueAt(usage, previousUsageCount - 1));
  const receiptId = deriveResourceExecutionReceiptId(body);
  return { body, challenge, context, currentUsage, previous, previousUsage, receiptId };
}

export function prepareResourceExecutionReceipt(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, challenge, result] = exactOptions(
    options,
    ["offer", "lease", "previous_execution_receipts", "usage_receipts", "challenge", "result"],
    "resource execution receipt draft options"
  );
  const draft = receiptDraft(
    offer,
    lease,
    previousExecutionReceipts,
    usageReceipts,
    challenge,
    result
  );
  return freeze({
    body: deepFreeze(draft.body),
    body_bytes: canonicalBytes(draft.body),
    consumer_signing_message: createUint8Array(
      resourceExecutionConsumerSigningMessage(draft.receiptId)
    ),
    provider_signing_message: createUint8Array(
      resourceExecutionProviderSigningMessage(draft.receiptId)
    ),
    receipt_id: draft.receiptId
  });
}

export function finalizeResourceExecutionReceipt(options) {
  assertRuntime();
  const [
    offer,
    lease,
    previousExecutionReceipts,
    usageReceipts,
    challenge,
    result,
    providerSignature,
    consumerSignature
  ] = exactOptions(
    options,
    [
      "offer",
      "lease",
      "previous_execution_receipts",
      "usage_receipts",
      "challenge",
      "result",
      "provider_signature",
      "consumer_signature"
    ],
    "resource execution receipt options"
  );
  const draft = receiptDraft(
    offer,
    lease,
    previousExecutionReceipts,
    usageReceipts,
    challenge,
    result
  );
  const challengeValue = parseCanonicalDocument(challenge, "/challenge").value;
  const bytes = canonicalBytes({
    body: draft.body,
    challenge: challengeValue,
    consumer_signature: consumerSignature,
    format: RESOURCE_EXECUTION_FORMATS.receipt,
    provider_signature: providerSignature,
    receipt_id: draft.receiptId
  });
  return verifyReceiptEnvelope(
    draft.context,
    draft.previous,
    draft.challenge,
    draft.currentUsage,
    arrayLength(draft.previousUsage) === 0
      ? null
      : arrayValueAt(draft.previousUsage, arrayLength(draft.previousUsage) - 1),
    parseCanonicalDocument(bytes, "/execution_receipt")
  ).bytes;
}

export function verifyResourceExecutionReceipt(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, receipt] = exactOptions(
    options,
    ["offer", "lease", "previous_execution_receipts", "usage_receipts", "receipt"],
    "resource execution receipt verification options"
  );
  const context = verifiedContext(offer, lease);
  const usage = executionUsageFor(context, usageReceipts);
  if (arrayLength(usage) === 0) fail("E_RESOURCE_EXECUTION", "/usage_receipts", "current-required");
  const previousUsage = [];
  for (let index = 0; index < arrayLength(usage) - 1; index += 1) {
    previousUsage[index] = arrayValueAt(usage, index);
  }
  const previousReceipts = verifyExecutionChain(context, previousExecutionReceipts, previousUsage);
  if (arrayLength(previousReceipts) !== arrayLength(previousUsage)) {
    fail("E_RESOURCE_EXECUTION", "/execution_receipts", "one-to-one-prior-chain");
  }
  const previous = arrayLength(previousReceipts) === 0
    ? null
    : arrayValueAt(previousReceipts, arrayLength(previousReceipts) - 1);
  return verifyReceiptEnvelope(
    context,
    previous,
    null,
    arrayValueAt(usage, arrayLength(usage) - 1),
    arrayLength(previousUsage) === 0
      ? null
      : arrayValueAt(previousUsage, arrayLength(previousUsage) - 1),
    parseCanonicalDocument(receipt, "/execution_receipt")
  );
}

function challengeForResult(options, label, extraName) {
  const names = [
    "offer",
    "lease",
    "previous_execution_receipts",
    "usage_receipts",
    "challenge",
    extraName
  ];
  const values = exactOptions(options, names, label);
  const challenge = verifyResourceExecutionChallenge({
    offer: values[0],
    lease: values[1],
    previous_execution_receipts: values[2],
    usage_receipts: values[3],
    challenge: values[4]
  });
  return { challenge, extra: values[5] };
}

export function createResourceStorageExecutionResult(options) {
  assertRuntime();
  const prepared = challengeForResult(
    options,
    "resource storage execution options",
    "resource_bytes"
  );
  if (prepared.challenge.body.kind !== "storage") {
    fail("E_RESOURCE_EXECUTION", "/challenge/body/kind", "storage-required");
  }
  const built = contentLayers(prepared.extra);
  const root = deriveResourceContentRoot(built.descriptor);
  if (root !== prepared.challenge.body.workload.content_root) {
    fail("E_RESOURCE_EXECUTION", "/resource_bytes", "content-root");
  }
  const leafCount = bigInt(built.descriptor.leaf_count);
  const leafIndex = storageChallengeIndex(prepared.challenge.body, leafCount);
  const proof = [];
  let position = Number(leafIndex);
  for (let level = 0; level < arrayLength(built.layers) - 1; level += 1) {
    const layer = arrayValueAt(built.layers, level);
    const siblingIndex = position % 2 === 0 ? position + 1 : position - 1;
    proof[level] = arrayValueAt(layer, siblingIndex) ?? arrayValueAt(layer, position);
    position = mathFloor(position / 2);
  }
  const start = Number(leafIndex) * RESOURCE_EXECUTION_LIMITS.leaf_bytes;
  const leaf = typedArraySubarray(
    built.bytes,
    start,
    start + RESOURCE_EXECUTION_LIMITS.leaf_bytes
  );
  const result = {
    leaf_bytes_base64url: encodeBase64Url(leaf),
    leaf_index: String(leafIndex),
    proof
  };
  verifyResult("storage", prepared.challenge.body.workload, result, prepared.challenge.body);
  return deepFreeze(result);
}

export function createResourceBandwidthExecutionResult(options) {
  assertRuntime();
  const prepared = challengeForResult(
    options,
    "resource bandwidth execution options",
    "echoed_payload"
  );
  if (prepared.challenge.body.kind !== "bandwidth") {
    fail("E_RESOURCE_EXECUTION", "/challenge/body/kind", "bandwidth-required");
  }
  let echoed;
  try {
    echoed = snapshotBytes(prepared.extra, RESOURCE_EXECUTION_LIMITS.input_bytes);
  } catch {
    fail("E_RESOURCE_FORMAT", "/echoed_payload", "bounded-byte-array");
  }
  const expected = prepared.challenge.body.workload;
  if (
    byteLengthOfBytes(echoed) !== Number(canonicalDecimal(expected.payload_size, "/workload/payload_size")) ||
    resourceExecutionPayloadDigest(echoed) !== expected.payload_digest
  ) fail("E_RESOURCE_EXECUTION", "/echoed_payload", "challenge-echo");
  const result = {
    echo_digest: expected.payload_digest,
    egress_bytes: expected.payload_size,
    ingress_bytes: expected.payload_size
  };
  verifyResult("bandwidth", expected, result, prepared.challenge.body);
  return deepFreeze(result);
}

export function createResourceComputeExecutionResult(options) {
  assertRuntime();
  const [offer, lease, previousExecutionReceipts, usageReceipts, challenge] = exactOptions(
    options,
    ["offer", "lease", "previous_execution_receipts", "usage_receipts", "challenge"],
    "resource compute execution options"
  );
  const opened = verifyResourceExecutionChallenge({
    offer,
    lease,
    previous_execution_receipts: previousExecutionReceipts,
    usage_receipts: usageReceipts,
    challenge
  });
  if (opened.body.kind !== "compute") {
    fail("E_RESOURCE_EXECUTION", "/challenge/body/kind", "compute-required");
  }
  return deepFreeze(computeResult(opened.body.workload));
}

export function evaluateResourceExecutionContract(options) {
  assertRuntime();
  const [
    announcementSources,
    offer,
    leaseSources,
    observedAt,
    usageSources,
    revocationSources,
    executionSources
  ] = exactOptions(
    options,
    [
      "consumption_announcements",
      "offer",
      "leases",
      "observed_at_ms",
      "usage_receipts",
      "revocations",
      "execution_receipts"
    ],
    "resource execution evaluation options"
  );
  const base = evaluateResourceContract({
    consumption_announcements: announcementSources,
    offer,
    leases: leaseSources,
    observed_at_ms: observedAt,
    usage_receipts: usageSources,
    revocations: revocationSources
  });
  const executions = boundedArray(
    executionSources,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "resource execution receipts"
  );
  const usage = boundedArray(
    usageSources,
    RESOURCE_CONTRACT_LIMITS.receipts_per_lease_max,
    "resource usage receipts"
  );
  if (arrayLength(executions) !== arrayLength(usage)) {
    fail("E_RESOURCE_EXECUTION", "/execution_receipts", "one-to-one-usage-chain");
  }
  let last = null;
  if (arrayLength(executions) > 0) {
    const leases = boundedArray(
      leaseSources,
      RESOURCE_CONTRACT_LIMITS.leases_per_offer_observation_max,
      "resource leases"
    );
    const announcements = boundedArray(
      announcementSources,
      RESOURCE_CONTRACT_LIMITS.announcements_per_evaluation_max,
      "resource consumption announcements"
    );
    const leaseSource = arrayLength(leases) === 0
      ? canonicalBytes(
          parseCanonicalDocument(arrayValueAt(announcements, 0), "/announcement").value.lease
        )
      : arrayValueAt(leases, 0);
    const context = verifiedContext(offer, leaseSource);
    const verifiedUsage = executionUsageFor(context, usage);
    const verifiedExecutions = verifyExecutionChain(context, executions, verifiedUsage);
    last = arrayValueAt(verifiedExecutions, arrayLength(verifiedExecutions) - 1);
  }
  return freeze({
    announcements_verified: base.announcements_verified,
    consumption_id: base.consumption_id,
    effective_revocation_id: base.effective_revocation_id,
    execution_status: base.lease_id === null
      ? "not-applicable"
      : arrayLength(executions) === 0 ? "unproved" : "proved",
    executions_verified: arrayLength(executions),
    last_execution_receipt_id: last?.receipt_id ?? null,
    lease_id: base.lease_id,
    offer_id: base.offer_id,
    observed_at_ms: base.observed_at_ms,
    receipts_verified: base.receipts_verified,
    status: base.status,
    witness_threshold: base.witness_threshold,
    witnesses_verified: base.witnesses_verified
  });
}
