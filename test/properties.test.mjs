import assert from "node:assert/strict";
import test from "node:test";
import { validatePulse } from "../src/index.mjs";
import { acceptedLineage, canonical, clone, vector } from "./helpers.mjs";

const CASES = 10_000;
const SEED = 0x4d4f5254;

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

test(`seeded ${CASES}-case mixed valid/invalid continuation corpus preserves core invariants`, () => {
  const random = generator(SEED);
  const { genesis, parents } = acceptedLineage();
  const zeroDigest = `sha256:${Buffer.alloc(32).toString("base64url")}`;
  const zeroSignature = `ed25519:${Buffer.alloc(64).toString("base64url")}`;
  const expectedIdentity = genesis.organism_id;
  let acceptedCases = 0;
  let rejectedCases = 0;

  for (let index = 0; index < CASES; index += 1) {
    const stepIndex = random() % vector.steps.length;
    const mutation = random() % 10;
    const step = clone(vector.steps[stepIndex]);
    let expectedCode = null;
    switch (mutation) {
      case 0:
        step.envelope.body.organism_id = `mortalos:${Buffer.alloc(32).toString("base64url")}`;
        expectedCode = "E_ORGANISM_ID_MISMATCH";
        break;
      case 1:
        step.envelope.body.sequence = String(Number(step.envelope.body.sequence) + 1);
        expectedCode = "E_SEQUENCE_NOT_NEXT";
        break;
      case 2:
        step.envelope.body.parent_hash = zeroDigest;
        expectedCode = "E_PARENT_HASH_MISMATCH";
        break;
      case 3:
        step.envelope.body.genome_hash = zeroDigest;
        expectedCode = "E_GENOME_HASH_MISMATCH";
        break;
      case 4:
        step.envelope.body.state_root = zeroDigest;
        expectedCode = "E_MEMBERSHIP_STATE_CHANGED";
        break;
      case 5:
        step.payload = { mutated_case: index };
        expectedCode = "E_EVENT_PAYLOAD_MISMATCH";
        break;
      case 6:
        step.envelope.approvals[0].signature = zeroSignature;
        expectedCode = "E_APPROVAL_SIGNATURE_INVALID";
        break;
      case 7:
        step.envelope.approvals = step.envelope.approvals.slice(0, 1);
        expectedCode = "E_APPROVAL_INSUFFICIENT_QUORUM";
        break;
      case 8:
        break;
      default:
        step.envelope.body.organism_id = `mortalos:${Buffer.alloc(32).toString("base64url")}`;
        step.envelope.approvals[0].signature = zeroSignature;
        expectedCode = "E_ORGANISM_ID_MISMATCH";
    }
    const result = validatePulse({
      genesis,
      parent: parents[stepIndex],
      envelopeBytes: canonical(step.envelope),
      eventPayloadBytes: canonical(step.payload)
    });
    if (expectedCode === null) {
      assert.equal(result.status, "accept", `seed=${SEED} case=${index} mutation=${mutation}`);
      acceptedCases += 1;
    } else {
      assert.equal(result.status, "reject", `seed=${SEED} case=${index} mutation=${mutation}`);
      assert.equal(result.code, expectedCode, `seed=${SEED} case=${index} mutation=${mutation}`);
      rejectedCases += 1;
    }
    assert.equal(genesis.organism_id, expectedIdentity, `seed=${SEED} case=${index} mutated accepted identity`);
    assert.equal(parents[stepIndex].next_state_root, genesis.next_state_root, `seed=${SEED} case=${index} mutated accepted state`);
  }
  assert.ok(acceptedCases > 0);
  assert.ok(rejectedCases > 0);
});
