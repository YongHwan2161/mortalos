import { readFile } from "node:fs/promises";
import {
  canonicalBytes,
  encodeBase64Url,
  parseJsonBytes
} from "../../src/index.mjs";
import { executeR1Operation, R1_OPERATION_FORMAT } from "./wire.mjs";

const vector = JSON.parse(
  await readFile(new URL("../../test/vectors/lifecycle.json", import.meta.url), "utf8")
);

function artifact(value) {
  return encodeBase64Url(canonicalBytes(value));
}

function record(step) {
  return { envelope: artifact(step.envelope), payload: artifact(step.payload) };
}

function operationBytes(operation) {
  return canonicalBytes(operation);
}

function withResult(id, bytes) {
  return {
    id,
    operation: encodeBase64Url(bytes),
    result: encodeBase64Url(executeR1Operation(bytes))
  };
}

export function buildR1Corpus() {
  const birth = artifact(vector.birth);
  const history = vector.steps.map(record);
  const invalidBirth = structuredClone(vector.birth);
  invalidBirth.approvals = [];
  const replayHistory = [...history, history.at(-1)];
  const finalCustodian = vector.actors.F.key_id;

  const entries = [
    withResult("genesis-accept", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      operation: "validate_genesis"
    })),
    withResult("genesis-reject-quorum", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: artifact(invalidBirth),
      operation: "validate_genesis"
    })),
    withResult("lineage-complete", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history,
      operation: "replay_lineage"
    })),
    withResult("lineage-replay-rejected", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history: replayHistory,
      operation: "replay_lineage"
    })),
    withResult("mortality-incomplete-not-dead", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history,
      observation: {
        authority_loss_irreversible: true,
        latent_evidence_complete: false,
        pending: [],
        state_available: true,
        usable_key_ids: [finalCustodian]
      },
      operation: "evaluate_mortality"
    })),
    withResult("mortality-complete-dead", operationBytes({
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history,
      observation: {
        authority_loss_irreversible: true,
        latent_evidence_complete: true,
        pending: [],
        state_available: true,
        usable_key_ids: [finalCustodian]
      },
      operation: "evaluate_mortality"
    })),
    withResult("unsupported-version", operationBytes({
      format: "mortalos-r1-operation/2",
      genesis_envelope: birth,
      operation: "validate_genesis"
    })),
    withResult("noncanonical-operation", new TextEncoder().encode(
      JSON.stringify({
        operation: "validate_genesis",
        format: R1_OPERATION_FORMAT,
        genesis_envelope: birth
      }, null, 2)
    ))
  ];

  return {
    format: "mortalos-r1-corpus/1",
    entries
  };
}

export function decodeCorpusEntry(entry) {
  const operation = parseJsonBytes(new TextEncoder().encode(JSON.stringify(entry)));
  return operation;
}
