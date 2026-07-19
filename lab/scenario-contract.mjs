const REQUEST_FORMAT = "mortalos-scenario-request/1";
const PROPOSAL_FORMAT = "mortalos-scenario-proposal/1";
const COMPILED_FORMAT = "mortalos-compiled-scenario/1";

export const SCENARIO_KINDS = Object.freeze(["continuation", "fork", "mortality"]);

// This is display metadata for model-vs-kernel comparison. It does not decide
// validity: every scenario is independently evaluated by the existing kernel.
export const SCENARIO_CATALOG = Object.freeze({
  exact_replay: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_REPLAY_STALE",
    label: "Replay exact accepted evidence"
  }),
  signature_byte_mutation: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_APPROVAL_SIGNATURE_INVALID",
    label: "Mutate one approval signature"
  }),
  parent_hash_mutation: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_PARENT_UNKNOWN",
    label: "Point to an unknown parent"
  }),
  organism_id_mutation: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_ORGANISM_ID_MISMATCH",
    label: "Substitute another organism identity"
  }),
  insufficient_quorum: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_APPROVAL_INSUFFICIENT_QUORUM",
    label: "Remove one required approval"
  }),
  no_op_membership_change: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_MEMBERSHIP_CUSTODY_UNCHANGED",
    label: "Claim a membership change without changing custody"
  }),
  unsigned_forged_acceptance: Object.freeze({
    kind: "continuation", fixture: "public-lifecycle-v1", status: "reject", code: "E_ACCEPTANCE_SIGNATURE_INVALID",
    label: "Forge a successor acceptance"
  }),
  signed_fork_sibling: Object.freeze({
    kind: "fork", fixture: "public-fork-v1", status: "forked", code: "E_FORK_DETECTED",
    label: "Submit a validly signed sibling"
  }),
  resurrection_after_qualified_death: Object.freeze({
    kind: "mortality", fixture: "public-lifecycle-v1", status: "reject", code: "E_APPROVAL_INSUFFICIENT_QUORUM",
    label: "Attempt continuation after the closed death fixture"
  }),
  incomplete_evidence_claiming_death: Object.freeze({
    kind: "mortality", fixture: "public-lifecycle-v1", status: "authority_unavailable_not_proven_dead", code: null,
    label: "Claim death without complete latent-evidence coverage"
  })
});

export const SCENARIO_MUTATIONS = Object.freeze(Object.keys(SCENARIO_CATALOG));
export const SCENARIO_REQUEST_FORMAT = REQUEST_FORMAT;
export const SCENARIO_PROPOSAL_FORMAT = PROPOSAL_FORMAT;
export const COMPILED_SCENARIO_FORMAT = COMPILED_FORMAT;

export function createCuratedScenarioProposal(requestedKind) {
  const selected = Object.entries(SCENARIO_CATALOG)
    .find(([, scenario]) => scenario.kind === requestedKind);
  if (!selected) throw new TypeError("unknown scenario kind");
  const [mutation, scenario] = selected;
  return Object.freeze({
    format: PROPOSAL_FORMAT,
    scenario_kind: scenario.kind,
    mutation,
    prediction: Object.freeze({ status: scenario.status, code: scenario.code }),
    rationale: "Curated offline attack selected deterministically from the committed allowlist. The kernel remains the only verdict authority."
  });
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

export function validateScenarioRequest(value) {
  if (!exactObject(value, ["client_id", "format", "hypothesis", "scenario_kind"])) return false;
  return value.format === REQUEST_FORMAT &&
    SCENARIO_KINDS.includes(value.scenario_kind) &&
    typeof value.hypothesis === "string" &&
    value.hypothesis.length >= 1 && value.hypothesis.length <= 280 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.hypothesis) &&
    typeof value.client_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.client_id);
}

export function validateScenarioProposal(value, requestedKind) {
  if (!exactObject(value, ["format", "mutation", "prediction", "rationale", "scenario_kind"])) return false;
  if (!exactObject(value.prediction, ["code", "status"])) return false;
  const catalog = SCENARIO_CATALOG[value.mutation];
  return value.format === PROPOSAL_FORMAT &&
    SCENARIO_KINDS.includes(value.scenario_kind) &&
    value.scenario_kind === requestedKind &&
    catalog?.kind === requestedKind &&
    typeof value.prediction.status === "string" && value.prediction.status.length >= 1 && value.prediction.status.length <= 80 &&
    (value.prediction.code === null || (typeof value.prediction.code === "string" && /^E_[A-Z0-9_]{1,80}$/.test(value.prediction.code))) &&
    typeof value.rationale === "string" && value.rationale.length >= 1 && value.rationale.length <= 400 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.rationale);
}

export const SCENARIO_PROPOSAL_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["format", "scenario_kind", "mutation", "prediction", "rationale"],
  properties: {
    format: { type: "string", enum: [PROPOSAL_FORMAT] },
    scenario_kind: { type: "string", enum: [...SCENARIO_KINDS] },
    mutation: { type: "string", enum: [...SCENARIO_MUTATIONS] },
    prediction: {
      type: "object",
      additionalProperties: false,
      required: ["status", "code"],
      properties: {
        status: { type: "string", minLength: 1, maxLength: 80 },
        code: { anyOf: [{ type: "string", pattern: "^E_[A-Z0-9_]{1,80}$" }, { type: "null" }] }
      }
    },
    rationale: { type: "string", minLength: 1, maxLength: 400 }
  }
});
