import { readFile } from "node:fs/promises";
import {
  canonicalBytes,
  encodeBase64Url,
  parseJsonBytes
} from "../../src/index.mjs";
import { executeR1Operation, R1_OPERATION_FORMAT } from "./wire.mjs";

const [vector, fork] = await Promise.all([
  readFile(new URL("../../test/vectors/lifecycle.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../../test/vectors/fork.json", import.meta.url), "utf8").then(JSON.parse)
]);

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
  const signatureTamper = structuredClone(vector.steps[0]);
  signatureTamper.envelope.approvals[0].signature = `ed25519:${encodeBase64Url(new Uint8Array(64))}`;

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
    withResult("candidate-verify-signature-tamper", operationBytes({
      candidate: record(signatureTamper),
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history: [],
      operation: "verify_candidate"
    })),
    withResult("candidate-append-linear", operationBytes({
      candidates: [record(vector.steps[0])],
      format: R1_OPERATION_FORMAT,
      genesis_envelope: birth,
      history: [],
      operation: "append_candidates"
    })),
    withResult("candidate-batch-replay-fork-halt", operationBytes({
      candidates: [
        record(fork.first),
        record(fork.first),
        record(fork.sibling),
        record(fork.post_fork)
      ],
      format: R1_OPERATION_FORMAT,
      genesis_envelope: artifact(fork.genesis),
      history: [],
      operation: "append_candidates"
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
