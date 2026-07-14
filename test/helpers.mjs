import { readFileSync } from "node:fs";
import { canonicalBytes, validateGenesis, validatePulse } from "../src/index.mjs";

export const vector = JSON.parse(
  readFileSync(new URL("./vectors/lifecycle.json", import.meta.url), "utf8")
);

export function clone(value) {
  return structuredClone(value);
}

export function canonical(value) {
  return canonicalBytes(value);
}

export function acceptedLineage() {
  const genesis = validateGenesis(canonical(vector.birth));
  if (genesis.status !== "accept") throw new Error(`fixture Genesis rejected: ${genesis.code}`);
  const parents = [genesis];
  let parent = genesis;
  for (const step of vector.steps) {
    parent = validatePulse({
      genesis,
      parent,
      envelopeBytes: canonical(step.envelope),
      eventPayloadBytes: canonical(step.payload)
    });
    if (parent.status !== "accept") throw new Error(`fixture Pulse rejected: ${parent.code}`);
    parents.push(parent);
  }
  return { genesis, parents, head: parent };
}
