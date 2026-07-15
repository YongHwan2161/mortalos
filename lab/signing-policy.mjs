import {
  deriveOrganismId,
  genesisApprovalMessage,
  pulseApprovalMessage
} from "../src/index.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireTagged(value, prefix, label) {
  if (
    typeof value !== "string" ||
    !value.startsWith(prefix) ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.slice(prefix.length))
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function deriveSigningRequest(operation, body) {
  if (!isRecord(body)) throw new Error("signing body must be an object");
  if (operation === "genesis") {
    const organismId = deriveOrganismId(body);
    return {
      context: `birth:${organismId}`,
      message: genesisApprovalMessage(body)
    };
  }
  if (operation === "pulse") {
    const organismId = requireTagged(body.organism_id, "mortalos:", "organism_id");
    const parentHash = requireTagged(body.parent_hash, "sha256:", "parent_hash");
    if (typeof body.sequence !== "string" || !/^(0|[1-9][0-9]*)$/.test(body.sequence)) {
      throw new Error("sequence is invalid");
    }
    return {
      context: `pulse:${organismId}:${body.sequence}:${parentHash}`,
      message: pulseApprovalMessage(body)
    };
  }
  throw new Error("signing operation is invalid");
}
