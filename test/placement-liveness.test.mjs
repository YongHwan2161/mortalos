import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createPlacementFailureCertificateFixture,
  createPlacementLivenessChallengeFixture,
  createPlacementLivenessPolicyFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { decodeBase64Url, encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  createPlacementFailureCertificate,
  evaluatePlacementLivenessEvidence,
  finalizePlacementLivenessChallenge,
  finalizePlacementLivenessObservation,
  PLACEMENT_LIVENESS_FORMATS,
  PLACEMENT_LIVENESS_LIMITS,
  PLACEMENT_LIVENESS_RESPONSE_PROFILES,
  preparePlacementLivenessChallenge,
  preparePlacementLivenessObservation,
  preparePlacementLivenessPolicyChallenge,
  preparePlacementLivenessPossessionResponse,
  verifyPlacementFailureCertificate,
  verifyPlacementLivenessChallenge,
  verifyPlacementLivenessPolicy,
  verifyPlacementLivenessResponse
} from "../src/placement/liveness.mjs";
import {
  createResourceContentCommitment,
  createResourceStoragePossessionProof,
  verifyResourceStoragePossessionProof
} from "../src/resource-execution.mjs";

async function setup() {
  const resource = new TextEncoder().encode("global-clock-free-liveness".repeat(6_000));
  const consumer = await createPlacementSigner();
  const provider = await createPlacementSigner();
  const observers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const placement = await createStoragePlacementFixture({
    consumer,
    provider,
    resourceBytes: resource,
    seed: 31,
    witnesses: observers
  });
  const lineageParentHash = domainHash("MortalOS liveness test lineage", resource);
  const manifestId = domainHash("MortalOS liveness test manifest", resource);
  const failure = await createPlacementFailureCertificateFixture({
    consumer,
    lineage_parent_hash: lineageParentHash,
    manifest_id: manifestId,
    observers,
    placement,
    provider,
    response_window_ms: "5000",
    shard_index: 0
  });
  return Object.freeze({
    consumer,
    failure,
    lineageParentHash,
    manifestId,
    observers,
    placement,
    provider,
    resource
  });
}

function legacyChallengeBody(challenge, overrides = {}) {
  const body = challenge.body;
  return {
    consumer: body.consumer,
    failure_sequence: body.failure_sequence,
    lease_id: body.lease_id,
    lineage_parent_hash: body.lineage_parent_hash,
    manifest_id: body.manifest_id,
    nonce: body.nonce,
    observer_policy: body.observer_policy,
    previous_execution_receipt_id: body.previous_execution_receipt_id,
    provider: body.provider,
    response_window_ms: body.response_window_ms,
    shard_index: body.shard_index,
    workload_id: body.workload_id,
    ...overrides
  };
}

const setupPromise = setup();

test("3-of-4 signed no-response observations create a clock-free failure certificate", async () => {
  const fixture = await setupPromise;
  const certificate = verifyPlacementFailureCertificate(fixture.failure.certificate_bytes);
  assert.equal(certificate.status, "verified");
  assert.equal(certificate.observer_ids.length, 3);
  const evaluated = evaluatePlacementLivenessEvidence({
    certificates: [certificate.bytes],
    responses: []
  });
  assert.equal(evaluated.status, "failed");
  assert.deepEqual(evaluated.failed_provider_ids, [fixture.provider.identity.key_id]);
  assert.deepEqual(evaluated.cases[0].consumer, fixture.consumer.identity);
  assert.equal(evaluated.cases[0].failure_sequence, "1");
  assert.equal(evaluated.cases[0].previous_execution_receipt_id, certificate.body.previous_execution_receipt_id);
  assert.doesNotMatch(
    new TextDecoder().decode(certificate.bytes),
    /(?:deadline|expires|issued|observed)_at_ms/u
  );

  assert.throws(() => createPlacementFailureCertificate({
    challenge: fixture.failure.challenge_bytes,
    observations: fixture.failure.observations.slice(0, 2)
  }), /E_PLACEMENT_LIVENESS_QUORUM/u);
  assert.throws(() => createPlacementFailureCertificate({
    challenge: fixture.failure.challenge_bytes,
    observations: [
      fixture.failure.observations[0],
      fixture.failure.observations[0],
      fixture.failure.observations[1]
    ]
  }), /E_PLACEMENT_LIVENESS_QUORUM/u);

  const outsider = await createPlacementSigner();
  assert.throws(() => preparePlacementLivenessObservation({
    challenge: fixture.failure.challenge_bytes,
    observer: outsider.identity,
    waited_window_ms: "5000"
  }), /observer-not-rostered/u);
  assert.throws(() => preparePlacementLivenessObservation({
    challenge: fixture.failure.challenge_bytes,
    observer: fixture.observers[0].identity,
    waited_window_ms: "4999"
  }), /waited-window-mismatch/u);
  const challenge = verifyPlacementLivenessChallenge(fixture.failure.challenge_bytes);
  assert.doesNotThrow(() => preparePlacementLivenessChallenge(legacyChallengeBody(challenge, {
    response_window_ms: PLACEMENT_LIVENESS_LIMITS.response_window_ms_max
  })));
  assert.throws(() => preparePlacementLivenessChallenge(legacyChallengeBody(challenge, {
    response_window_ms: String(Number(PLACEMENT_LIVENESS_LIMITS.response_window_ms_max) + 1)
  })), /E_PLACEMENT_LIVENESS_LIMIT/u);
  assert.throws(() => evaluatePlacementLivenessEvidence({
    certificates: Array(PLACEMENT_LIVENESS_LIMITS.certificates_per_evaluation + 1)
      .fill(certificate.bytes),
    responses: []
  }), /E_PLACEMENT_LIVENESS_LIMIT/u);
});

test("provider-signed lease policy fixes the response window and conflicting policies halt", async () => {
  const fixture = await setupPromise;
  const policy = verifyPlacementLivenessPolicy(fixture.failure.policy_bytes);
  const challenge = verifyPlacementLivenessChallenge(fixture.failure.challenge_bytes);
  const certificate = verifyPlacementFailureCertificate(fixture.failure.certificate_bytes);

  assert.equal(policy.status, "verified");
  assert.equal(policy.body.response_window_ms, "5000");
  assert.equal(
    policy.body.response_proof_profile,
    PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample
  );
  assert.equal(
    policy.body.observer_policy_id,
    domainHash(
      "MortalOS placement liveness observer policy v1",
      canonicalBytes(policy.body.observer_policy)
    )
  );
  assert.equal(policy.body.provider.key_id, fixture.provider.identity.key_id);
  assert.equal(policy.body.consumer.key_id, fixture.consumer.identity.key_id);
  assert.equal(challenge.format, PLACEMENT_LIVENESS_FORMATS.challenge_policy);
  assert.equal(challenge.authority, "policy-bound");
  assert.equal(challenge.policy_id, policy.policy_id);
  const challengeDocument = JSON.parse(new TextDecoder().decode(challenge.bytes));
  assert.deepEqual(
    decodeBase64Url(challengeDocument.body.policy_base64url),
    policy.bytes
  );
  assert.equal(certificate.certificate_format, PLACEMENT_LIVENESS_FORMATS.certificate_policy);
  assert.equal(certificate.repair_authority, true);

  const sharedPolicy = new Uint8Array(new SharedArrayBuffer(policy.bytes.byteLength));
  sharedPolicy.set(policy.bytes);
  assert.throws(
    () => verifyPlacementLivenessPolicy(sharedPolicy),
    /E_PLACEMENT_LIVENESS_FORMAT: liveness-policy-shared-memory/u
  );

  const legacyDraft = preparePlacementLivenessChallenge(legacyChallengeBody(challenge, {
    nonce: encodeBase64Url(new Uint8Array(16).fill(94))
  }));
  const legacyChallenge = finalizePlacementLivenessChallenge({
    body: legacyDraft.body,
    consumer_signature: await fixture.consumer.sign(legacyDraft.consumer_signing_message)
  });
  const legacyObservations = [];
  for (const observer of fixture.observers.slice(0, 3)) {
    const observationDraft = preparePlacementLivenessObservation({
      challenge: legacyChallenge,
      observer: observer.identity,
      waited_window_ms: "5000"
    });
    legacyObservations.push(finalizePlacementLivenessObservation({
      challenge: legacyChallenge,
      observer: observer.identity,
      observer_signature: await observer.sign(observationDraft.observer_signing_message),
      waited_window_ms: "5000"
    }));
  }
  const legacyCertificate = createPlacementFailureCertificate({
    challenge: legacyChallenge,
    observations: legacyObservations
  });
  assert.equal(
    verifyPlacementFailureCertificate(legacyCertificate.bytes).certificate_format,
    PLACEMENT_LIVENESS_FORMATS.certificate
  );
  assert.equal(verifyPlacementFailureCertificate(legacyCertificate.bytes).repair_authority, false);

  assert.throws(() => preparePlacementLivenessPolicyChallenge({
    nonce: challenge.body.nonce,
    policy: policy.bytes,
    previous_execution_receipt_id: challenge.body.previous_execution_receipt_id,
    response_window_ms: "1"
  }), /E_PLACEMENT_LIVENESS_FORMAT/u);
  assert.throws(() => preparePlacementLivenessObservation({
    challenge: challenge.bytes,
    observer: fixture.observers[0].identity,
    waited_window_ms: "5001"
  }), /waited-window-mismatch/u);

  for (const mutate of [
    (value) => { value.body.lease_id = `resource-lease:${"A".repeat(43)}`; },
    (value) => { value.body.provider = fixture.consumer.identity; },
    (value) => { value.body.consumer = fixture.provider.identity; },
    (value) => { value.body.shard_index = 1; },
    (value) => { value.body.failure_sequence = "2"; },
    (value) => { value.body.response_window_ms = "1"; },
    (value) => { value.body.observer_policy.observers[0] = fixture.consumer.identity; }
  ]) {
    const value = JSON.parse(new TextDecoder().decode(policy.bytes));
    mutate(value);
    assert.throws(
      () => verifyPlacementLivenessPolicy(canonicalBytes(value)),
      /E_PLACEMENT_LIVENESS_(?:BINDING|IDENTITY|POLICY|SIGNATURE)/u
    );
  }
  const selfRehashedPolicy = JSON.parse(new TextDecoder().decode(policy.bytes));
  selfRehashedPolicy.body.response_window_ms = "1";
  selfRehashedPolicy.policy_id = domainHash(
    "MortalOS placement liveness policy v1",
    canonicalBytes({
      body: selfRehashedPolicy.body,
      lease_base64url: selfRehashedPolicy.lease_base64url,
      offer_base64url: selfRehashedPolicy.offer_base64url
    })
  );
  assert.throws(
    () => verifyPlacementLivenessPolicy(canonicalBytes(selfRehashedPolicy)),
    /E_PLACEMENT_LIVENESS_SIGNATURE: policy-provider/u
  );

  const wrongPolicyChallenge = JSON.parse(new TextDecoder().decode(challenge.bytes));
  wrongPolicyChallenge.body.policy_id = domainHash(
    "MortalOS wrong liveness policy",
    fixture.resource
  );
  assert.throws(
    () => verifyPlacementLivenessChallenge(canonicalBytes(wrongPolicyChallenge)),
    /E_PLACEMENT_LIVENESS_BINDING/u
  );

  const alternatePolicy = await createPlacementLivenessPolicyFixture({
    consumer: fixture.consumer,
    lineage_parent_hash: fixture.lineageParentHash,
    manifest_id: fixture.manifestId,
    observers: fixture.observers,
    placement: fixture.placement,
    provider: fixture.provider,
    response_window_ms: "5001",
    shard_index: 0
  });
  assert.notEqual(alternatePolicy.policy_id, policy.policy_id);
  const selfRehashedChallenge = JSON.parse(new TextDecoder().decode(challenge.bytes));
  selfRehashedChallenge.body.policy_base64url = encodeBase64Url(alternatePolicy.bytes);
  selfRehashedChallenge.body.policy_id = alternatePolicy.policy_id;
  selfRehashedChallenge.challenge_id = domainHash(
    "MortalOS placement liveness challenge v2",
    canonicalBytes(selfRehashedChallenge.body)
  );
  assert.throws(
    () => verifyPlacementLivenessChallenge(canonicalBytes(selfRehashedChallenge)),
    /E_PLACEMENT_LIVENESS_SIGNATURE: challenge-consumer/u
  );
  const alternate = await createPlacementFailureCertificateFixture({
    consumer: fixture.consumer,
    lineage_parent_hash: fixture.lineageParentHash,
    manifest_id: fixture.manifestId,
    nonce_seed: 93,
    observers: fixture.observers,
    placement: fixture.placement,
    provider: fixture.provider,
    response_window_ms: "5001",
    shard_index: 0
  });
  const equivocation = evaluatePlacementLivenessEvidence({
    certificates: [fixture.failure.certificate_bytes, alternate.certificate_bytes],
    responses: []
  });
  assert.equal(equivocation.status, "halted");
  assert.ok(equivocation.cases.every(({ status }) => status === "policy-fork"));
});

test("provider-only storage possession response rebuts failure without a fresh consumer receipt", async () => {
  const fixture = await setupPromise;
  const response = await createPlacementLivenessResponseFixture({
    challenge_bytes: fixture.failure.challenge_bytes,
    placement: fixture.placement,
    provider: fixture.provider,
    resource_bytes: fixture.resource
  });
  const verifiedResponse = verifyPlacementLivenessResponse(response);
  assert.equal(verifiedResponse.response_format, PLACEMENT_LIVENESS_FORMATS.response_possession);
  assert.equal(verifiedResponse.independent_possession, true);
  assert.equal(verifiedResponse.execution_receipt_id, null);
  assert.equal(
    verifiedResponse.response_proof_profile,
    PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample
  );
  const alive = evaluatePlacementLivenessEvidence({ certificates: [], responses: [response] });
  assert.equal(alive.status, "alive");
  assert.equal(alive.cases[0].execution_receipt_ids.length, 0);
  assert.equal(alive.cases[0].possession_response_ids.length, 1);
  assert.equal(alive.cases[0].sampled_possession, true);
  const contested = evaluatePlacementLivenessEvidence({
    certificates: [fixture.failure.certificate_bytes],
    responses: [response]
  });
  assert.equal(contested.status, "halted");
  assert.equal(contested.cases[0].status, "contested");

  const challenge = verifyPlacementLivenessChallenge(fixture.failure.challenge_bytes);
  const workload = createResourceContentCommitment(fixture.resource);
  const proof = createResourceStoragePossessionProof({
    challenge_nonce: challenge.body.nonce,
    lease_id: challenge.body.lease_id,
    resource_bytes: fixture.resource,
    workload
  });
  assert.deepEqual(canonicalBytes(verifyResourceStoragePossessionProof({
    challenge_nonce: challenge.body.nonce,
    lease_id: challenge.body.lease_id,
    proof,
    workload
  })), canonicalBytes(proof));
  const wrongProof = structuredClone(proof);
  wrongProof.leaf_index = String((Number(wrongProof.leaf_index) + 1) % Number(workload.leaf_count));
  assert.throws(() => verifyResourceStoragePossessionProof({
    challenge_nonce: challenge.body.nonce,
    lease_id: challenge.body.lease_id,
    proof: wrongProof,
    workload
  }), /E_RESOURCE_EXECUTION/u);
  assert.throws(() => preparePlacementLivenessPossessionResponse({
    challenge: challenge.bytes,
    proof: wrongProof,
    provider: fixture.provider.identity,
    workload
  }), /E_PLACEMENT_LIVENESS_BINDING/u);

  const opened = JSON.parse(new TextDecoder().decode(response));
  opened.body.proof.leaf_bytes_base64url = encodeBase64Url(new Uint8Array(1));
  assert.throws(() => verifyPlacementLivenessResponse(canonicalBytes(opened)),
    /E_PLACEMENT_LIVENESS_BINDING/u);

  const alternate = await createPlacementFailureCertificateFixture({
    consumer: fixture.consumer,
    lineage_parent_hash: fixture.lineageParentHash,
    manifest_id: fixture.manifestId,
    nonce_seed: 92,
    observers: fixture.observers,
    placement: fixture.placement,
    provider: fixture.provider,
    response_window_ms: "5000",
    shard_index: 0
  });
  const challengeFork = evaluatePlacementLivenessEvidence({
    certificates: [fixture.failure.certificate_bytes, alternate.certificate_bytes],
    responses: []
  });
  assert.equal(challengeFork.status, "halted");
  assert.equal(challengeFork.cases[0].status, "challenge-fork");
  assert.notEqual(
    encodeBase64Url(fixture.failure.certificate_bytes),
    encodeBase64Url(alternate.certificate_bytes)
  );
});

test("legacy receipt-pointer response remains parseable but is not possession authority", async () => {
  const fixture = await setupPromise;
  const legacyFailure = await createPlacementFailureCertificateFixture({
    consumer: fixture.consumer,
    lineage_parent_hash: fixture.lineageParentHash,
    manifest_id: fixture.manifestId,
    nonce_seed: 97,
    observers: fixture.observers,
    placement: fixture.placement,
    provider: fixture.provider,
    response_proof_profile: PLACEMENT_LIVENESS_RESPONSE_PROFILES.execution_receipt_pointer,
    response_window_ms: "5000",
    shard_index: 0
  });
  const refreshed = await refreshStoragePlacementFixture({
    consumer: fixture.consumer,
    fixture: fixture.placement,
    issuedAtMs: 1400,
    provider: fixture.provider,
    resourceBytes: fixture.resource,
    seed: 61
  });
  const pointer = await createPlacementLivenessResponseFixture({
    challenge_bytes: legacyFailure.challenge_bytes,
    placement: refreshed,
    provider: fixture.provider
  });
  const verified = verifyPlacementLivenessResponse(pointer);
  assert.equal(verified.response_format, PLACEMENT_LIVENESS_FORMATS.response);
  assert.equal(verified.independent_possession, false);
  const evaluated = evaluatePlacementLivenessEvidence({ certificates: [], responses: [pointer] });
  assert.equal(evaluated.status, "clear");
  assert.equal(evaluated.cases[0].status, "pointer-only");
});

test("no evidence remains clear rather than claiming provider liveness", () => {
  const evaluated = evaluatePlacementLivenessEvidence({ certificates: [], responses: [] });
  assert.equal(evaluated.status, "clear");
  assert.deepEqual(evaluated.failed_provider_ids, []);
  assert.deepEqual(evaluated.cases, []);
});

test("policy-bound liveness converges in a fresh process", () => {
  const child = fileURLToPath(new URL("./placement-liveness-policy-child.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [child], {
    encoding: "utf8",
    timeout: 120_000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.authority, "policy-bound");
  assert.equal(output.certificate_format, PLACEMENT_LIVENESS_FORMATS.certificate_policy);
  assert.equal(output.membership_admitted, true);
  assert.equal(output.membership_reference, true);
  assert.match(output.policy_id, /^sha256:[A-Za-z0-9_-]{43}$/u);
  assert.equal(output.possession_response, PLACEMENT_LIVENESS_FORMATS.response_possession);
  assert.equal(output.response_window_ms, "5000");
  assert.equal(output.response_status, "alive");
  assert.equal(output.status, "failed");
});

test("liveness verification fails closed when collection and traversal primordials drift", async () => {
  const fixture = await setupPromise;
  const operations = [
    {
      property: "Set",
      replacement: class LyingSet extends globalThis.Set {
        get size() { return 3; }
      },
      target: globalThis
    },
    {
      property: "Map",
      replacement: class LyingMap extends globalThis.Map {},
      target: globalThis
    },
    { property: "keys", replacement: () => [], target: Object },
    { property: "map", replacement: () => [], target: Array.prototype }
  ];
  for (const { property, replacement, target } of operations) {
    const descriptor = Object.getOwnPropertyDescriptor(target, property);
    let observed;
    try {
      Object.defineProperty(target, property, { ...descriptor, value: replacement });
      try {
        verifyPlacementFailureCertificate(fixture.failure.certificate_bytes);
      } catch (error) {
        observed = error;
      }
    } finally {
      Object.defineProperty(target, property, descriptor);
    }
    assert.match(String(observed), /E_PLACEMENT_LIVENESS_RUNTIME: realm-integrity/u);
  }
});

test("liveness snapshots reject accessors, Proxy side effects, sparse arrays, and limit drift", async () => {
  const fixture = await setupPromise;
  let accessorInvoked = false;
  const accessorOptions = { responses: [] };
  Object.defineProperty(accessorOptions, "certificates", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return [fixture.failure.certificate_bytes];
    }
  });
  assert.throws(
    () => evaluatePlacementLivenessEvidence(accessorOptions),
    /E_PLACEMENT_LIVENESS_FORMAT/u
  );
  assert.equal(accessorInvoked, false, "security input accessors must never run");

  const sparse = [];
  sparse.length = 1;
  assert.throws(
    () => evaluatePlacementLivenessEvidence({ certificates: sparse, responses: [] }),
    /E_PLACEMENT_LIVENESS_FORMAT/u
  );

  const originalSet = globalThis.Set;
  const proxyOptions = new Proxy(
    { certificates: [], responses: [] },
    {
      ownKeys(target) {
        globalThis.Set = class PoisonedSet extends originalSet {};
        return Reflect.ownKeys(target);
      }
    }
  );
  let proxyError;
  try {
    try {
      evaluatePlacementLivenessEvidence(proxyOptions);
    } catch (error) {
      proxyError = error;
    }
  } finally {
    globalThis.Set = originalSet;
  }
  assert.match(String(proxyError), /E_PLACEMENT_LIVENESS_RUNTIME: realm-integrity/u);

  const challenge = verifyPlacementLivenessChallenge(fixture.failure.challenge_bytes);
  const maxObservers = await Promise.all(Array.from(
    { length: PLACEMENT_LIVENESS_LIMITS.witnesses_per_policy },
    () => createPlacementSigner()
  ));
  const maxPolicy = {
    max_faulty: 5,
    observers: maxObservers.map(({ identity }) => identity),
    threshold: 11
  };
  assert.doesNotThrow(() => preparePlacementLivenessChallenge(legacyChallengeBody(challenge, {
    observer_policy: maxPolicy
  })));
  const extraObserver = await createPlacementSigner();
  assert.throws(() => preparePlacementLivenessChallenge(legacyChallengeBody(challenge, {
    observer_policy: {
      ...maxPolicy,
      observers: [...maxPolicy.observers, extraObserver.identity]
    }
  })), /E_PLACEMENT_LIVENESS_POLICY/u);
});
