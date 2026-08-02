import { decodeBase64Url, equalBytes } from "./bytes.mjs";
import { verifyContinuityCapsule } from "./capsule.mjs";
import { canonicalBytes, parseJsonBytes, snapshotBytes } from "./codec.mjs";
import { verifyEd25519 } from "./crypto.mjs";
import { PROTOCOL_PROFILE } from "./generated/protocol-profile.mjs";
import {
  arrayLength,
  arrayPush,
  arraySort,
  arrayValueAt,
  copyArrayByIndex,
  copyBoundedOwnDataArray,
  createArray,
  createSet,
  freeze,
  isArray,
  numberIsSafeInteger,
  objectKeys,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  regexpExec,
  setAdd,
  setHas,
  typeError
} from "./primordials.mjs";

export const CUSTODY_LIMITS = freeze({
  copies: 9,
  copy_bytes: PROTOCOL_PROFILE.continuity.copy_envelope_bytes,
  signed_copies: PROTOCOL_PROFILE.continuity.signed_copy_count,
  signed_quorum: PROTOCOL_PROFILE.continuity.signed_copy_quorum
});
export const CONTINUITY_COPY_FORMAT = "mortalos-continuity-copy/1";

const COPY_ID_PATTERN = /^copy-([1-3])$/u;

function codedError(code, detail) {
  const error = typeError(`${code}: ${detail}`);
  error.code = code;
  return error;
}

function assertRealmIntegrity() {
  if (!realmIntrinsicsIntact()) {
    throw codedError("E_CUSTODY_RUNTIME", "realm integrity check failed");
  }
}

function ownedBytes(value, path) {
  try {
    return snapshotBytes(value, CUSTODY_LIMITS.copy_bytes);
  } catch {
    throw typeError(`${path} must be a bounded Uint8Array`);
  }
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || isArray(value)) {
    throw typeError(`${label} must be an object`);
  }
  const actual = objectKeys(value);
  const wanted = copyArrayByIndex(expected);
  arraySort(actual);
  arraySort(wanted);
  if (arrayLength(actual) !== arrayLength(wanted)) {
    throw typeError(`${label} has unexpected keys`);
  }
  for (let index = 0; index < arrayLength(actual); index += 1) {
    if (arrayValueAt(actual, index) !== arrayValueAt(wanted, index)) {
      throw typeError(`${label} has unexpected keys`);
    }
  }
}

function currentCustodian(capsuleBytes, keyId) {
  const capsule = parseJsonBytes(capsuleBytes, {
    maxBytes: PROTOCOL_PROFILE.provider.object_bytes,
    maxDepth: 64
  });
  const recordCount = arrayLength(capsule.records);
  if (recordCount < 1) return null;
  const last = arrayValueAt(capsule.records, recordCount - 1);
  const envelope = parseJsonBytes(decodeBase64Url(last.envelope_base64url), {
    maxBytes: 1_048_576,
    maxDepth: 64
  });
  const custodians = envelope.body.next_custodians;
  for (let index = 0; index < arrayLength(custodians); index += 1) {
    const custodian = arrayValueAt(custodians, index);
    if (custodian.key_id === keyId) return custodian;
  }
  return null;
}

export function verifyContinuityCopy(copySource) {
  assertRealmIntegrity();
  const copyBytes = ownedBytes(copySource, "continuity copy");
  const envelope = parseJsonBytes(copyBytes, {
    maxBytes: CUSTODY_LIMITS.copy_bytes,
    maxDepth: 64
  });
  exactKeys(
    envelope,
    ["attestation", "capsule_base64url", "descriptor", "format"],
    "continuity copy"
  );
  if (envelope.format !== CONTINUITY_COPY_FORMAT) {
    throw typeError("continuity copy format is invalid");
  }
  exactKeys(
    envelope.descriptor,
    ["capsule_id", "copy_id", "head_hash", "organism_id", "provider_id"],
    "continuity copy descriptor"
  );
  exactKeys(envelope.attestation, ["key_id", "signature"], "continuity copy attestation");
  const identity = regexpExec(COPY_ID_PATTERN, envelope.descriptor.copy_id);
  if (!identity || envelope.descriptor.provider_id !== `logical-provider-${identity[1]}`) {
    throw typeError("continuity copy identity is invalid");
  }
  const capsuleBytes = ownedBytes(
    decodeBase64Url(envelope.capsule_base64url),
    "continuity copy capsule"
  );
  if (capsuleBytes.byteLength > PROTOCOL_PROFILE.provider.object_bytes) {
    throw typeError("continuity copy capsule exceeds provider limit");
  }
  const verified = verifyContinuityCapsule(capsuleBytes);
  if (
    verified.capsule_id !== envelope.descriptor.capsule_id ||
    verified.head_hash !== envelope.descriptor.head_hash ||
    verified.organism_id !== envelope.descriptor.organism_id
  ) throw typeError("continuity copy descriptor binding is invalid");
  const signer = currentCustodian(capsuleBytes, envelope.attestation.key_id);
  if (
    !signer ||
    !verifyEd25519(
      signer.public_key,
      canonicalBytes(envelope.descriptor),
      envelope.attestation.signature
    )
  ) throw typeError("continuity copy attestation is invalid");
  return freeze({
    capsule_bytes: new Uint8Array(capsuleBytes),
    capsule_id: verified.capsule_id,
    copy_id: envelope.descriptor.copy_id,
    descriptor: freeze({
      capsule_id: envelope.descriptor.capsule_id,
      copy_id: envelope.descriptor.copy_id,
      head_hash: envelope.descriptor.head_hash,
      organism_id: envelope.descriptor.organism_id,
      provider_id: envelope.descriptor.provider_id
    }),
    head_hash: verified.head_hash,
    organism_id: verified.organism_id,
    provider_id: envelope.descriptor.provider_id,
    resource_bytes: new Uint8Array(verified.resource_bytes),
    state_root: verified.state_root,
    status: "verified"
  });
}

function snapshotCopies(copies, count) {
  const sources = copyBoundedOwnDataArray(copies, count, "custody copies");
  assertRealmIntegrity();
  const owned = createArray();
  for (let index = 0; index < count; index += 1) {
    arrayPush(owned, ownedBytes(arrayValueAt(sources, index), `custody copy ${index}`));
  }
  return owned;
}

function validateQuorum(copies, quorum) {
  const count = ownDataArrayLength(copies, "custody copies");
  assertRealmIntegrity();
  if (
    !numberIsSafeInteger(quorum) ||
    quorum < 2 ||
    quorum > count ||
    count > CUSTODY_LIMITS.copies
  ) {
    throw typeError("bounded custody quorum required");
  }
  return { count, owned: snapshotCopies(copies, count) };
}

function validObservations(owned, verifier) {
  const valid = createArray();
  const rejected = createArray();
  for (let index = 0; index < arrayLength(owned); index += 1) {
    try {
      arrayPush(valid, { index, verified: verifier(arrayValueAt(owned, index)) });
    } catch (error) {
      arrayPush(rejected, freeze({
        code: error?.code ?? "E_CUSTODY_COPY_INVALID",
        index,
        reason: String(error?.message ?? error)
      }));
    }
  }
  return { rejected, valid };
}

function groupByCapsule(valid) {
  const groups = createArray();
  for (let index = 0; index < arrayLength(valid); index += 1) {
    const observation = arrayValueAt(valid, index);
    let group = null;
    for (let groupIndex = 0; groupIndex < arrayLength(groups); groupIndex += 1) {
      const candidate = arrayValueAt(groups, groupIndex);
      if (candidate.id === observation.verified.capsule_id) {
        group = candidate;
        break;
      }
    }
    if (!group) {
      group = { id: observation.verified.capsule_id, observations: createArray() };
      arrayPush(groups, group);
    }
    arrayPush(group.observations, observation);
  }
  if (arrayLength(groups) > 1) {
    throw codedError("E_CUSTODY_EQUIVOCATION", "divergent valid capsules");
  }
  return arrayValueAt(groups, 0);
}

function quorumResult(winner, rejected, quorum, bytesOf) {
  if (!winner || arrayLength(winner.observations) < quorum) {
    throw codedError("E_CUSTODY_QUORUM_UNAVAILABLE", "valid copies below quorum");
  }
  const canonical = bytesOf(arrayValueAt(winner.observations, 0));
  for (let index = 1; index < arrayLength(winner.observations); index += 1) {
    if (!equalBytes(bytesOf(arrayValueAt(winner.observations, index)), canonical)) {
      throw codedError("E_CUSTODY_NONCANONICAL", "same identity with different bytes");
    }
  }
  return freeze({
    capsule_bytes: new Uint8Array(canonical),
    capsule_id: winner.id,
    rejected: freeze(rejected),
    status: "available",
    valid_copies: arrayLength(winner.observations)
  });
}

// Compatibility verifier for raw canonical Capsules. It proves content integrity and
// quorum count only; byte-identical inputs do not prove independent copy identities.
export function recoverContinuityCapsuleQuorum({ copies, quorum }) {
  assertRealmIntegrity();
  const { owned } = validateQuorum(copies, quorum);
  const { rejected, valid } = validObservations(owned, (bytes) => {
    const verified = verifyContinuityCapsule(bytes);
    return freeze({ ...verified, capsule_bytes: new Uint8Array(bytes) });
  });
  return quorumResult(
    groupByCapsule(valid),
    rejected,
    quorum,
    (observation) => observation.verified.capsule_bytes
  );
}

// Product recovery path. Every quorum member must carry a distinct, current-custodian
// signed copy_id/provider_id binding so repeating one physical file cannot count twice.
export function recoverContinuityCopyQuorum({ copies, quorum }) {
  assertRealmIntegrity();
  const { owned } = validateQuorum(copies, quorum);
  const { rejected, valid } = validObservations(owned, verifyContinuityCopy);
  const copyIds = createSet();
  const providerIds = createSet();
  for (let index = 0; index < arrayLength(valid); index += 1) {
    const observation = arrayValueAt(valid, index);
    if (
      setHas(copyIds, observation.verified.copy_id) ||
      setHas(providerIds, observation.verified.provider_id)
    ) {
      throw codedError("E_CUSTODY_DUPLICATE_COPY", "duplicate signed copy identity");
    }
    setAdd(copyIds, observation.verified.copy_id);
    setAdd(providerIds, observation.verified.provider_id);
  }
  return quorumResult(
    groupByCapsule(valid),
    rejected,
    quorum,
    (observation) => observation.verified.capsule_bytes
  );
}
