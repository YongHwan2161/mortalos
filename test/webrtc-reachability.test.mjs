import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createWebRtcReachabilityPlan,
  createWebRtcReachabilityObservation,
  verifyWebRtcReachabilityObservationAgainstPlan,
  verifyWebRtcReachabilityObservationBytes,
  verifyWebRtcReachabilityPlanBytes,
  WEBRTC_REACHABILITY_OBSERVATION_FORMAT
} from "../lab/transport/webrtc-reachability.mjs";

const digest = `sha256:${"A".repeat(43)}`;
const sourceCommit = "9ede05cb8f7c120a24ac3ce645fe85caa61bb6e9";
const sourceTree = "9329129836d5d89e9a76f9fa4b4e2d81b0d57c54";

function replaceValue(target, property, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { ...descriptor, value: replacement });
  return () => Object.defineProperty(target, property, descriptor);
}

function plan({ reconnectPathClasses = ["srflx", "relay"] } = {}) {
  return {
    campaign_nonce: "N".repeat(43),
    claim_scope: "single-operator-reachability",
    format: "mortalos-webrtc-reachability-plan/1",
    non_authority: true,
    profiles: [
      { attempts: 20, expected_path_classes: ["host"], profile: "lan-direct" },
      { attempts: 20, expected_path_classes: ["srflx"], profile: "nat-stun" },
      { attempts: 20, expected_path_classes: ["relay"], profile: "forced-turn" },
      {
        attempts: 20,
        expected_path_classes: reconnectPathClasses,
        profile: "reconnect-fallback"
      }
    ],
    resource: {
      capsule_id: digest,
      lineage_head: digest,
      organism_id: digest,
      resource_bytes: 131_072,
      resource_digest: digest,
      source_commit: sourceCommit,
      source_tree: sourceTree
    }
  };
}

const pilot = createWebRtcReachabilityPlan(plan());

function route(pathClass = "host") {
  return {
    format: "mortalos-webrtc-selected-route/1",
    local_route_class: pathClass,
    non_authority: true,
    path_class: pathClass,
    remote_route_class: pathClass
  };
}

function connection(sequence, pathClass) {
  return {
    answerer_route: route(pathClass),
    offerer_route: route(pathClass),
    sequence
  };
}

function verticalResult() {
  return {
    below_quorum_failed_closed: true,
    continuity_duplicate_effects: 0,
    corrupt_copy_rejected: true,
    provider_duplicate_effects: 0,
    recovered_capsule_id: digest,
    recovered_organism_id: digest,
    recovered_resource_bytes: 131_072,
    recovered_resource_digest: digest,
    source_retired_before_recovery: true,
    successor_lineage_head: `sha256:${"B".repeat(43)}`
  };
}

function observation({
  connections = [connection(1, "host")],
  expectedPathClasses = ["host"],
  failureCode = null,
  outcome = "pass",
  productResult = undefined,
  profile = "lan-direct"
} = {}) {
  return {
    attempt: 1,
    capsule_id: digest,
    claim_scope: "single-operator-reachability",
    completed_at: "2026-09-02T01:00:01.000Z",
    connections,
    expected_path_classes: expectedPathClasses,
    failure_code: failureCode,
    format: WEBRTC_REACHABILITY_OBSERVATION_FORMAT,
    lineage_head: digest,
    non_authority: true,
    organism_id: digest,
    outcome,
    plan_id: pilot.plan_id,
    product_result: productResult === undefined
      ? (outcome === "pass" ? verticalResult() : null)
      : productResult,
    profile,
    resource_bytes: 131_072,
    resource_digest: digest,
    source_commit: sourceCommit,
    source_tree: sourceTree,
    started_at: "2026-09-02T01:00:00.000Z"
  };
}

test("R2 reachability observations are canonical, content-addressed, and schema-valid", async () => {
  const [planSchema, observationSchema] = await Promise.all([
    readFile(new URL("../schemas/r2-reachability-plan.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../schemas/r2-reachability-observation.schema.json", import.meta.url), "utf8")
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validatePlan = ajv.compile(JSON.parse(planSchema));
  const validateObservation = ajv.compile(JSON.parse(observationSchema));
  assert.equal(validatePlan(pilot.plan), true, JSON.stringify(validatePlan.errors));
  assert.deepEqual(verifyWebRtcReachabilityPlanBytes(pilot.bytes), {
    plan: pilot.plan,
    plan_id: pilot.plan_id
  });
  const cases = [
    observation(),
    observation({
      connections: [connection(1, "srflx")],
      expectedPathClasses: ["srflx"],
      profile: "nat-stun"
    }),
    observation({
      connections: [connection(1, "relay")],
      expectedPathClasses: ["relay"],
      profile: "forced-turn"
    }),
    observation({
      connections: [connection(1, "srflx"), connection(2, "relay")],
      expectedPathClasses: ["srflx", "relay"],
      profile: "reconnect-fallback"
    })
  ];
  for (const source of cases) {
    const created = createWebRtcReachabilityObservation(source);
    assert.equal(
      validateObservation(created.observation),
      true,
      JSON.stringify(validateObservation.errors)
    );
    assert.match(created.observation_id, /^sha256:[A-Za-z0-9_-]{43}$/u);
    assert.deepEqual(verifyWebRtcReachabilityObservationBytes(created.bytes), {
      observation: created.observation,
      observation_id: created.observation_id
    });
    assert.deepEqual(
      verifyWebRtcReachabilityObservationAgainstPlan(pilot.bytes, created.bytes),
      {
        observation: created.observation,
        observation_id: created.observation_id,
        plan: pilot.plan,
        plan_id: pilot.plan_id
      }
    );
  }
});

test("R2 pilot plan fixes all 80 attempts before observations exist", () => {
  assert.equal(pilot.plan.profiles.reduce((sum, profile) => sum + profile.attempts, 0), 80);
  assert.throws(
    () => createWebRtcReachabilityPlan(plan({ reconnectPathClasses: ["relay", "relay"] })),
    /direct-or-STUN to relay fallback/u
  );
  const reordered = plan();
  [reordered.profiles[0], reordered.profiles[1]] = [reordered.profiles[1], reordered.profiles[0]];
  assert.throws(
    () => createWebRtcReachabilityPlan(reordered),
    /canonical order/u
  );
  const freshPlan = plan();
  freshPlan.campaign_nonce = "M".repeat(43);
  assert.notEqual(createWebRtcReachabilityPlan(freshPlan).plan_id, pilot.plan_id);
});

test("R2 PASS requires the pre-registered route class and exact connection count", () => {
  assert.throws(() => createWebRtcReachabilityObservation(observation({
    connections: [connection(1, "host")],
    expectedPathClasses: ["relay"],
    profile: "forced-turn"
  })), /pre-registered path class/u);
  assert.throws(() => createWebRtcReachabilityObservation(observation({
    connections: [connection(1, "srflx")],
    expectedPathClasses: ["srflx", "relay"],
    profile: "reconnect-fallback"
  })), /missing a connection/u);
  assert.throws(() => createWebRtcReachabilityObservation(observation({
    connections: [connection(2, "host")]
  })), /not consecutive/u);
});

test("R2 failure evidence is bounded and cannot carry raw network or credential fields", () => {
  const failed = createWebRtcReachabilityObservation(observation({
    connections: [],
    failureCode: "WEBRTC_ROUTE_UNAVAILABLE",
    outcome: "fail",
    profile: "forced-turn",
    expectedPathClasses: ["relay"]
  }));
  assert.equal(failed.observation.outcome, "fail");
  assert.equal(failed.observation.connections.length, 0);
  const text = new TextDecoder().decode(failed.bytes);
  assert.doesNotMatch(text, /credential|iceServers|selectedCandidatePairId|address|port|sdp/iu);

  const leaked = observation();
  leaked.connections[0].offerer_route.address = "203.0.113.7";
  assert.throws(() => createWebRtcReachabilityObservation(leaked), /unknown or missing fields/u);
  assert.throws(() => createWebRtcReachabilityObservation(observation({
    connections: [],
    failureCode: "SECRET_FROM_BROWSER",
    outcome: "fail"
  })), /allowlisted failure_code/u);

  let getterCalls = 0;
  const accessor = observation();
  Object.defineProperty(accessor, "turn_credential", {
    enumerable: true,
    get() { getterCalls += 1; return "secret"; }
  });
  assert.throws(() => createWebRtcReachabilityObservation(accessor), /owned canonical JSON data/u);
  assert.equal(getterCalls, 0);
});

test("R2 PASS binds the complete post-retirement product vertical", () => {
  const mismatch = verticalResult();
  mismatch.recovered_resource_digest = `sha256:${"C".repeat(43)}`;
  assert.throws(
    () => createWebRtcReachabilityObservation(observation({ productResult: mismatch })),
    /recovered identity/u
  );
  const duplicate = verticalResult();
  duplicate.provider_duplicate_effects = 1;
  assert.throws(
    () => createWebRtcReachabilityObservation(observation({ productResult: duplicate })),
    /required fail-closed vertical/u
  );
  assert.throws(
    () => createWebRtcReachabilityObservation(observation({ productResult: null })),
    /requires product_result/u
  );
});

test("R2 verification rejects noncanonical bytes and observation ID substitution", () => {
  const created = createWebRtcReachabilityObservation(observation());
  const parsed = JSON.parse(new TextDecoder().decode(created.bytes));
  parsed.observation_id = digest;
  assert.throws(
    () => verifyWebRtcReachabilityObservationBytes(canonicalBytes(parsed)),
    /observation_id mismatch/u
  );
  const noncanonical = new TextEncoder().encode(JSON.stringify(parsed, null, 2));
  assert.throws(
    () => verifyWebRtcReachabilityObservationBytes(noncanonical),
    /not canonical/u
  );
});

test("R2 observation cannot be moved to another plan or post-hoc expected path", () => {
  const created = createWebRtcReachabilityObservation(observation());
  const otherPlanSource = plan();
  otherPlanSource.resource.lineage_head = `sha256:${"B".repeat(43)}`;
  const otherPlan = createWebRtcReachabilityPlan(otherPlanSource);
  assert.throws(
    () => verifyWebRtcReachabilityObservationAgainstPlan(otherPlan.bytes, created.bytes),
    /not bound to this plan/u
  );
  assert.throws(
    () => createWebRtcReachabilityObservation(observation({
      connections: [connection(1, "host")],
      expectedPathClasses: ["host"],
      profile: "forced-turn"
    })),
    /must pre-register relay/u
  );
});

test("R2 verification uses captured contract operations under hostile mutation", () => {
  const createdPlan = createWebRtcReachabilityPlan(plan());
  const observationSource = observation();
  observationSource.plan_id = createdPlan.plan_id;
  const createdObservation = createWebRtcReachabilityObservation(observationSource);
  const invoked = [];
  const poison = (label) => () => { invoked.push(label); throw new Error("ambient operation used"); };
  const restores = [
    replaceValue(Array, "isArray", poison("Array.isArray")),
    replaceValue(Array.prototype, "every", poison("Array.every")),
    replaceValue(Array.prototype, "find", poison("Array.find")),
    replaceValue(Date, "parse", poison("Date.parse")),
    replaceValue(Date.prototype, "toISOString", poison("Date.toISOString")),
    replaceValue(Object, "freeze", poison("Object.freeze")),
    replaceValue(Object, "keys", poison("Object.keys"))
  ];
  let verified;
  try {
    verified = verifyWebRtcReachabilityObservationAgainstPlan(
      createdPlan.bytes,
      createdObservation.bytes
    );
  } finally {
    for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]();
  }
  assert.deepEqual(invoked, []);
  assert.equal(verified.plan_id, createdPlan.plan_id);
  assert.equal(verified.observation_id, createdObservation.observation_id);
});
