import { encodeBase64Url } from "../bytes.mjs";
import {
  createInitialState,
  createNurtureInput,
  PULSE_SEED_V1_GENOME_BYTES,
  transitionState
} from "./engine.mjs";

export function buildStateCorpus() {
  const entries = [
    { id: "seed-00-step-1", seed: 0, steps: 1 },
    { id: "seed-11-step-7", seed: 17, steps: 7 },
    { id: "seed-7f-step-31", seed: 127, steps: 31 },
    { id: "seed-ff-step-100", seed: 255, steps: 100 }
  ].map(({ id, seed, steps }) => {
    const stateBytes = createInitialState(new Uint8Array(16).fill(seed));
    const inputBytes = createNurtureInput(steps);
    const result = transitionState({
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      inputBytes,
      stateBytes
    });
    return {
      genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
      id,
      input_base64url: encodeBase64Url(inputBytes),
      next_state_base64url: encodeBase64Url(result.nextStateBytes),
      receipt_base64url: encodeBase64Url(result.receiptBytes),
      state_base64url: encodeBase64Url(stateBytes)
    };
  });
  return { format: "mortalos-state-corpus/1", entries };
}
