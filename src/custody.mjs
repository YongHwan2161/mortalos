import { equalBytes } from "./bytes.mjs";
import { verifyContinuityCapsule } from "./capsule.mjs";
import {
  copyBoundedOwnDataArray,
  ownDataArrayLength
} from "./primordials.mjs";

export const CUSTODY_LIMITS = Object.freeze({ copies: 9, copy_bytes: 9_000_000 });

function ownedBytes(value, path) {
  if (!(value instanceof Uint8Array) || value.byteLength > CUSTODY_LIMITS.copy_bytes) {
    throw new TypeError(`${path} must be a bounded Uint8Array`);
  }
  return new Uint8Array(value);
}

export function recoverContinuityCapsuleQuorum({ copies, quorum }) {
  const count = ownDataArrayLength(copies, "custody copies");
  if (
    !Number.isSafeInteger(quorum) ||
    quorum < 2 ||
    quorum > count ||
    count > CUSTODY_LIMITS.copies
  ) {
    throw new TypeError("bounded custody quorum required");
  }
  const owned = copyBoundedOwnDataArray(copies, count, "custody copies")
    .map((value, index) => ownedBytes(value, `custody copy ${index}`));
  const valid = [];
  const rejected = [];
  for (let index = 0; index < owned.length; index += 1) {
    try {
      valid.push({ bytes: owned[index], index, verified: verifyContinuityCapsule(owned[index]) });
    } catch (error) {
      rejected.push(Object.freeze({ index, reason: String(error?.message ?? error) }));
    }
  }
  const groups = [];
  for (const observation of valid) {
    let group = groups.find((entry) => entry.id === observation.verified.capsule_id);
    if (!group) {
      group = { id: observation.verified.capsule_id, observations: [] };
      groups.push(group);
    }
    group.observations.push(observation);
  }
  if (groups.length > 1) {
    const error = new Error("E_CUSTODY_EQUIVOCATION: divergent valid capsules");
    error.code = "E_CUSTODY_EQUIVOCATION";
    throw error;
  }
  const winner = groups[0];
  if (!winner || winner.observations.length < quorum) {
    const error = new Error("E_CUSTODY_QUORUM_UNAVAILABLE: valid copies below quorum");
    error.code = "E_CUSTODY_QUORUM_UNAVAILABLE";
    throw error;
  }
  const canonical = winner.observations[0].bytes;
  if (!winner.observations.every((entry) => equalBytes(entry.bytes, canonical))) {
    const error = new Error("E_CUSTODY_NONCANONICAL: same identity with different bytes");
    error.code = "E_CUSTODY_NONCANONICAL";
    throw error;
  }
  return Object.freeze({
    capsule_bytes: new Uint8Array(canonical),
    capsule_id: winner.id,
    rejected: Object.freeze(rejected),
    status: "available",
    valid_copies: winner.observations.length
  });
}
