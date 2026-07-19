import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import test from "node:test";
import {
  canonicalBytes,
  decodeBase64Url,
  parseJsonBytes
} from "../src/index.mjs";
import { buildR1Corpus } from "../r1/javascript/corpus.mjs";
import {
  executeR1Operation,
  R1_LIMITS,
  R1_OPERATION_FORMAT,
  R1_RESULT_FORMAT
} from "../r1/javascript/wire.mjs";
import { r1PythonArguments } from "../scripts/r1-python-paths.mjs";

test("R1 Python verifier receives native absolute paths on every platform", () => {
  const paths = r1PythonArguments();
  assert.equal(paths.length, 2);
  assert.ok(paths.every(isAbsolute));
  if (process.platform === "win32") {
    assert.ok(paths.every((path) => /^[A-Za-z]:\\/.test(path)));
    assert.ok(paths.every((path) => !/^\/[A-Za-z]:/.test(path)));
  }
});

test("R1 operations return canonical versioned result bytes", () => {
  for (const entry of buildR1Corpus().entries) {
    const bytes = decodeBase64Url(entry.operation);
    assert.ok(bytes, entry.id);
    const resultBytes = executeR1Operation(bytes);
    assert.deepEqual(resultBytes, canonicalBytes(parseJsonBytes(resultBytes)), entry.id);
    assert.equal(parseJsonBytes(resultBytes).format, R1_RESULT_FORMAT, entry.id);
  }
});

test("R1 rejects unknown fields and operations", () => {
  const unknownField = parseJsonBytes(executeR1Operation(canonicalBytes({
    format: R1_OPERATION_FORMAT,
    genesis_envelope: "",
    operation: "validate_genesis",
    surprise: true
  })));
  assert.equal(unknownField.outcome.code, "R1_SCHEMA");
  const unknownOperation = parseJsonBytes(executeR1Operation(canonicalBytes({
    format: R1_OPERATION_FORMAT,
    operation: "invent_authority"
  })));
  assert.equal(unknownOperation.outcome.code, "R1_OPERATION");
});

test("R1 operation byte ceiling is exact and +1 fails closed", () => {
  const exact = new Uint8Array(R1_LIMITS.operation_bytes);
  exact.fill(0x20);
  assert.equal(parseJsonBytes(executeR1Operation(exact)).outcome.code, "R1_PARSE");
  const over = new Uint8Array(R1_LIMITS.operation_bytes + 1);
  const overResult = parseJsonBytes(executeR1Operation(over));
  assert.equal(overResult.outcome.code, "R1_LIMIT");
  assert.equal(overResult.operation_hash, null);
  const muchLarger = new Uint8Array(R1_LIMITS.operation_bytes * 16);
  assert.deepEqual(executeR1Operation(muchLarger), executeR1Operation(over));
});
test("R1 mortality distinguishes incomplete evidence from qualified death", () => {
  const entries = new Map(buildR1Corpus().entries.map((entry) => [entry.id, entry]));
  const incomplete = parseJsonBytes(decodeBase64Url(entries.get("mortality-incomplete-not-dead").result));
  const dead = parseJsonBytes(decodeBase64Url(entries.get("mortality-complete-dead").result));
  assert.equal(incomplete.outcome.mortality.status, "authority_unavailable_not_proven_dead");
  assert.equal(dead.outcome.mortality.status, "dead_under_v0_assumptions");
});

test("R1 candidate operations preserve accept, tamper, replay, fork, and halt semantics", () => {
  const entries = new Map(buildR1Corpus().entries.map((entry) => [entry.id, entry]));
  const outcome = (id) => parseJsonBytes(decodeBase64Url(entries.get(id).result)).outcome;
  assert.equal(
    outcome("candidate-verify-signature-tamper").result.code,
    "E_APPROVAL_SIGNATURE_INVALID"
  );
  assert.equal(outcome("candidate-append-linear").results[0].status, "accept");
  const forked = outcome("candidate-batch-replay-fork-halt");
  assert.deepEqual(
    forked.results.map((entry) => entry.code ?? entry.status),
    ["accept", "E_REPLAY_STALE", "E_FORK_DETECTED", "E_LINEAGE_ALREADY_FORKED"]
  );
  assert.equal(forked.snapshot.status, "forked");
  assert.equal(forked.snapshot.head_hash, null);
});

test("R1 candidate count ceiling is exact and +1 fails closed", () => {
  const entries = new Map(buildR1Corpus().entries.map((entry) => [entry.id, entry]));
  const base = parseJsonBytes(decodeBase64Url(entries.get("candidate-append-linear").operation));
  const candidate = base.candidates[0];
  const exact = parseJsonBytes(executeR1Operation(canonicalBytes({
    ...base,
    candidates: Array.from({ length: R1_LIMITS.candidate_records }, () => candidate)
  })));
  assert.equal(exact.outcome.status, "complete");
  const over = parseJsonBytes(executeR1Operation(canonicalBytes({
    ...base,
    candidates: Array.from({ length: R1_LIMITS.candidate_records + 1 }, () => candidate)
  })));
  assert.equal(over.outcome.code, "R1_LIMIT");
});
