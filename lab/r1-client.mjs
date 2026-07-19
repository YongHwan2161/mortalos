import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  encodeBase64Url,
  isCanonical,
  parseJsonBytes
} from "../src/index.mjs";
import {
  executeR1Operation,
  R1_OPERATION_FORMAT,
  R1_RESULT_FORMAT
} from "../r1/javascript/wire.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function artifact(value) {
  return encodeBase64Url(canonicalBytes(value));
}

function record(value) {
  return {
    envelope: artifact(value.envelope),
    payload: artifact(value.payload)
  };
}

function history(records) {
  return records
    .filter((entry) => entry.envelope?.kind === "mortalos.pulse")
    .map(record);
}

function execute(operation) {
  const operationBytes = canonicalBytes(operation);
  const resultBytes = executeR1Operation(operationBytes);
  const result = parseJsonBytes(resultBytes);
  const expectedHash = `sha256:${encodeBase64Url(sha256(operationBytes))}`;
  if (
    !isCanonical(resultBytes, result) ||
    result.format !== R1_RESULT_FORMAT ||
    result.operation !== operation.operation ||
    result.operation_hash !== expectedHash ||
    !result.outcome ||
    typeof result.outcome !== "object"
  ) {
    throw new Error("R1 returned a non-canonical or mismatched result envelope");
  }
  if (result.outcome.status === "reject" && String(result.outcome.code).startsWith("R1_")) {
    throw new Error(`R1 ${operation.operation} rejected its operation envelope: ${result.outcome.code}`);
  }
  return Object.freeze({
    operation_bytes: operationBytes,
    result_bytes: resultBytes,
    outcome: clone(result.outcome)
  });
}

function base(genesis, records, operation) {
  return {
    format: R1_OPERATION_FORMAT,
    genesis_envelope: artifact(genesis),
    history: history(records),
    operation
  };
}

export function r1ValidateGenesis(genesis) {
  return execute({
    format: R1_OPERATION_FORMAT,
    genesis_envelope: artifact(genesis),
    operation: "validate_genesis"
  });
}

export function r1ReplayLineage(genesis, records) {
  return execute(base(genesis, records, "replay_lineage"));
}

export function r1VerifyCandidate(genesis, records, candidate) {
  return execute({
    ...base(genesis, records, "verify_candidate"),
    candidate: record(candidate)
  });
}

export function r1AppendCandidates(genesis, records, candidates) {
  return execute({
    ...base(genesis, records, "append_candidates"),
    candidates: candidates.map(record)
  });
}

export function r1EvaluateMortality(genesis, records, observation) {
  return execute({
    ...base(genesis, records, "evaluate_mortality"),
    observation: {
      authority_loss_irreversible: observation.authorityLossIrreversible,
      latent_evidence_complete: observation.latentEvidenceComplete,
      pending: observation.pendingSuccessors.map(record),
      state_available: observation.stateAvailable,
      usable_key_ids: [...observation.usableKeyIds]
    }
  });
}
