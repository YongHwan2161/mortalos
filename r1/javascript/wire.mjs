import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  createLineage,
  decodeBase64Url,
  encodeBase64Url,
  isCanonical,
  isJsonInputError,
  parseJsonDocument
} from "../../src/index.mjs";

export const R1_OPERATION_FORMAT = "mortalos-r1-operation/1";
export const R1_RESULT_FORMAT = "mortalos-r1-result/1";
export const R1_LIMITS = Object.freeze({
  operation_bytes: 2 * 1024 * 1024,
  history_records: 128,
  pending_records: 128,
  usable_key_ids: 16
});

const RESULT_FIELDS = Object.freeze([
  "status",
  "code",
  "kind",
  "organism_id",
  "object_hash",
  "sequence",
  "genome_hash",
  "next_state_root",
  "field_path",
  "deterministic_detail",
  "parent_hash",
  "child_hashes",
  "equivocating_key_ids",
  "mortality_classified",
  "head_hash",
  "usable_keys",
  "threshold",
  "authority_viable",
  "state_viable",
  "latent_successors",
  "latent_evidence_complete",
  "pending_body_hashes"
]);

class R1Error extends Error {
  constructor(code, detail) {
    super(detail);
    this.code = code;
    this.detail = detail;
  }
}

function ownKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : null;
}

function requireKeys(value, expected, path) {
  const actual = ownKeys(value);
  const sortedExpected = [...expected].sort();
  if (!actual || actual.length !== sortedExpected.length) {
    throw new R1Error("R1_SCHEMA", `${path}:keys`);
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== sortedExpected[index]) {
      throw new R1Error("R1_SCHEMA", `${path}:keys`);
    }
  }
}

function requireString(value, path, maximum = 2_000_000) {
  if (typeof value !== "string" || value.length > maximum) {
    throw new R1Error("R1_SCHEMA", path);
  }
  return value;
}

function decodeArtifact(value, path) {
  const encoded = requireString(value, path);
  const bytes = decodeBase64Url(encoded);
  if (!bytes) throw new R1Error("R1_SCHEMA", `${path}:base64url`);
  return bytes;
}

function decodeRecord(record, path) {
  requireKeys(record, ["envelope", "payload"], path);
  return {
    envelopeBytes: decodeArtifact(record.envelope, `${path}/envelope`),
    eventPayloadBytes: decodeArtifact(record.payload, `${path}/payload`)
  };
}

function decodeHistory(value) {
  if (!Array.isArray(value) || value.length > R1_LIMITS.history_records) {
    throw new R1Error("R1_LIMIT", "/history");
  }
  return value.map((record, index) => decodeRecord(record, `/history/${index}`));
}

function decodePending(value) {
  if (!Array.isArray(value) || value.length > R1_LIMITS.pending_records) {
    throw new R1Error("R1_LIMIT", "/observation/pending");
  }
  return value.map((record, index) => decodeRecord(record, `/observation/pending/${index}`));
}

function decisionView(result) {
  const view = {};
  for (const field of RESULT_FIELDS) {
    if (result[field] !== undefined) view[field] = result[field];
  }
  if (result.next_custody_descriptor) {
    view.custodian_key_ids = result.next_custody_descriptor.custodians
      .map((entry) => entry.key_id)
      .sort();
    view.threshold = result.next_custody_descriptor.quorum.threshold;
  }
  return view;
}

function lineageFrom(operation) {
  const genesisBytes = decodeArtifact(operation.genesis_envelope, "/genesis_envelope");
  const opened = createLineage(genesisBytes);
  if (opened.status !== "accept") return { failure: decisionView(opened) };
  const history = decodeHistory(operation.history);
  const steps = [];
  for (let index = 0; index < history.length; index += 1) {
    const result = opened.lineage.append(history[index]);
    steps.push(decisionView(result));
    if (result.status !== "accept") {
      return {
        failure: null,
        lineage: opened.lineage,
        terminal: decisionView(result),
        steps
      };
    }
  }
  return { failure: null, lineage: opened.lineage, terminal: null, steps };
}

function validateGenesisOperation(operation) {
  requireKeys(operation, ["format", "genesis_envelope", "operation"], "/");
  const opened = createLineage(decodeArtifact(operation.genesis_envelope, "/genesis_envelope"));
  return decisionView(opened.status === "accept" ? opened.lineage.genesis : opened);
}

function replayLineageOperation(operation) {
  requireKeys(operation, ["format", "genesis_envelope", "history", "operation"], "/");
  const replay = lineageFrom(operation);
  if (replay.failure) return { status: "genesis_rejected", genesis: replay.failure };
  return {
    status: replay.terminal ? "terminated" : "complete",
    steps: replay.steps,
    terminal: replay.terminal,
    snapshot: replay.lineage.snapshot()
  };
}

function mortalityOperation(operation) {
  requireKeys(
    operation,
    ["format", "genesis_envelope", "history", "observation", "operation"],
    "/"
  );
  const replay = lineageFrom(operation);
  if (replay.failure) return { status: "genesis_rejected", genesis: replay.failure };
  if (replay.terminal) {
    return {
      status: "history_terminated",
      terminal: replay.terminal,
      snapshot: replay.lineage.snapshot()
    };
  }
  const observation = operation.observation;
  requireKeys(
    observation,
    [
      "authority_loss_irreversible",
      "latent_evidence_complete",
      "pending",
      "state_available",
      "usable_key_ids"
    ],
    "/observation"
  );
  if (
    typeof observation.state_available !== "boolean" ||
    typeof observation.authority_loss_irreversible !== "boolean" ||
    typeof observation.latent_evidence_complete !== "boolean" ||
    !Array.isArray(observation.usable_key_ids) ||
    observation.usable_key_ids.length > R1_LIMITS.usable_key_ids ||
    observation.usable_key_ids.some((entry) => typeof entry !== "string")
  ) {
    throw new R1Error("R1_SCHEMA", "/observation");
  }
  const result = replay.lineage.evaluateMortality({
    usableKeyIds: observation.usable_key_ids,
    stateAvailable: observation.state_available,
    pendingSuccessors: decodePending(observation.pending),
    authorityLossIrreversible: observation.authority_loss_irreversible,
    latentEvidenceComplete: observation.latent_evidence_complete
  });
  return {
    status: "complete",
    mortality: decisionView(result),
    snapshot: replay.lineage.snapshot()
  };
}

function resultEnvelope(operationBytes, operation, outcome) {
  return {
    format: R1_RESULT_FORMAT,
    operation: operation ?? null,
    operation_hash: operationBytes === null
      ? null
      : `sha256:${encodeBase64Url(sha256(operationBytes))}`,
    outcome
  };
}

function errorEnvelope(operationBytes, operation, error) {
  const code = error instanceof R1Error
    ? error.code
    : isJsonInputError(error)
      ? error.code === "E_PARSE_LIMIT_EXCEEDED" ? "R1_LIMIT" : "R1_PARSE"
      : "R1_INTERNAL";
  const detail = error instanceof R1Error
    ? error.detail
    : isJsonInputError(error)
      ? error.detail
      : "internal";
  return resultEnvelope(operationBytes, operation, { status: "reject", code, detail });
}

export function executeR1Operation(operationBytes) {
  let operationName = null;
  let inputLength = null;
  try {
    inputLength = operationBytes instanceof Uint8Array
      ? operationBytes.byteLength
      : null;
  } catch {
    return canonicalBytes(errorEnvelope(null, null, new R1Error("R1_PARSE", "input")));
  }
  if (inputLength !== null && inputLength > R1_LIMITS.operation_bytes) {
    return canonicalBytes(errorEnvelope(
      null,
      null,
      new R1Error("R1_LIMIT", "operation_bytes")
    ));
  }
  try {
    const document = parseJsonDocument(operationBytes, {
      maxBytes: R1_LIMITS.operation_bytes,
      maxDepth: 64
    });
    if (!isCanonical(document.bytes, document.value)) {
      throw new R1Error("R1_CANONICAL", "operation");
    }
    const operation = document.value;
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      throw new R1Error("R1_SCHEMA", "/");
    }
    operationName = typeof operation.operation === "string" ? operation.operation : null;
    if (operation.format !== R1_OPERATION_FORMAT) {
      throw new R1Error("R1_VERSION", "/format");
    }
    let outcome;
    if (operationName === "validate_genesis") outcome = validateGenesisOperation(operation);
    else if (operationName === "replay_lineage") outcome = replayLineageOperation(operation);
    else if (operationName === "evaluate_mortality") outcome = mortalityOperation(operation);
    else throw new R1Error("R1_OPERATION", "/operation");
    return canonicalBytes(resultEnvelope(document.bytes, operationName, outcome));
  } catch (error) {
    let stableBytes;
    try {
      stableBytes = inputLength !== null && inputLength <= R1_LIMITS.operation_bytes
        ? new Uint8Array(operationBytes)
        : new Uint8Array(0);
    } catch {
      stableBytes = new Uint8Array(0);
    }
    return canonicalBytes(errorEnvelope(stableBytes, operationName, error));
  }
}
