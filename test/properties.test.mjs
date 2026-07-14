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

test(`seeded ${CASES}-case adversarial continuation corpus preserves core invariants`, () => {
  const random = generator(SEED);
  const { genesis, parents } = acceptedLineage();
  const zeroDigest = `sha256:${Buffer.alloc(32).toString("base64url")}`;
  const zeroSignature = `ed25519:${Buffer.alloc(64).toString("base64url")}`;
  const expectedIdentity = genesis.organism_id;

  for (let index = 0; index < CASES; index += 1) {
    const stepIndex = random() % vector.steps.length;
    const mutation = random() % 8;
    const step = clone(vector.steps[stepIndex]);
    switch (mutation) {
      case 0:
        step.envelope.body.organism_id = `mortalos:${Buffer.alloc(32).toString("base64url")}`;
        break;
      case 1:
        step.envelope.body.sequence = String(Number(step.envelope.body.sequence) + 1);
        break;
      case 2:
        step.envelope.body.parent_hash = zeroDigest;
        break;
      case 3:
        step.envelope.body.genome_hash = zeroDigest;
        break;
      case 4:
        step.envelope.body.state_root = zeroDigest;
        break;
      case 5:
        step.payload = { mutated_case: index };
        break;
      case 6:
        step.envelope.approvals[0].signature = zeroSignature;
        break;
      default:
        step.envelope.approvals = step.envelope.approvals.slice(0, 1);
    }
    const result = validatePulse({
      genesis,
      parent: parents[stepIndex],
      envelopeBytes: canonical(step.envelope),
      eventPayloadBytes: canonical(step.payload)
    });
    assert.equal(result.status, "reject", `seed=${SEED} case=${index} mutation=${mutation}`);
    assert.equal(genesis.organism_id, expectedIdentity, `seed=${SEED} case=${index} mutated accepted identity`);
    assert.equal(parents[stepIndex].next_state_root, genesis.next_state_root, `seed=${SEED} case=${index} mutated accepted state`);
  }
});
