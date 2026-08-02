import fork from "../test/vectors/fork.json" with { type: "json" };
import lifecycle from "../test/vectors/lifecycle.json" with { type: "json" };
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import {
  COMPILED_SCENARIO_FORMAT,
  SCENARIO_CATALOG,
  validateScenarioProposal
} from "./scenario-contract.mjs";
import { runReferenceScenario } from "./reference-engine.mjs";

async function digest(bytes) {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${encodeBase64Url(new Uint8Array(hash))}`;
}

export async function compileScenario(proposal, requestedKind = proposal?.scenario_kind) {
  if (!validateScenarioProposal(proposal, requestedKind)) throw new Error("invalid scenario proposal");
  const trusted = SCENARIO_CATALOG[proposal.mutation];
  const scenario = {
    format: COMPILED_SCENARIO_FORMAT,
    fixture: trusted.fixture,
    mutation: proposal.mutation,
    scenario_kind: trusted.kind
  };
  const bytes = canonicalBytes(scenario);
  return Object.freeze({
    bytes,
    digest: await digest(bytes),
    scenario,
    trusted_expected: Object.freeze({ code: trusted.code, status: trusted.status })
  });
}

export async function runCompiledScenario(compiled) {
  const owned = {
    bytes: compiled?.bytes instanceof Uint8Array ? new Uint8Array(compiled.bytes) : null,
    digest: compiled?.digest,
    scenario: compiled?.scenario === undefined
      ? undefined
      : JSON.parse(JSON.stringify(compiled.scenario)),
    trusted_expected: compiled?.trusted_expected === undefined
      ? undefined
      : JSON.parse(JSON.stringify(compiled.trusted_expected))
  };
  const expectedBytes = canonicalBytes(owned.scenario);
  if (!(owned.bytes instanceof Uint8Array) || expectedBytes.length !== owned.bytes.length ||
      !expectedBytes.every((byte, index) => byte === owned.bytes[index])) {
    throw new Error("compiled scenario bytes do not match the canonical scenario");
  }
  if (await digest(owned.bytes) !== owned.digest) throw new Error("compiled scenario digest mismatch");
  const actual = runReferenceScenario({ mutation: owned.scenario.mutation, lifecycle, fork });
  return Object.freeze({
    actual: Object.freeze({ code: actual.code ?? null, status: actual.status }),
    matches_trusted_expectation:
      actual.status === owned.trusted_expected.status &&
      (actual.code ?? null) === owned.trusted_expected.code
  });
}
