import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlacementFailureCertificateFixture,
  createPlacementLivenessChallengeFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  refreshStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { encodeBase64Url } from "../src/bytes.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  createPlacementFailureCertificate,
  evaluatePlacementLivenessEvidence,
  finalizePlacementLivenessObservation,
  finalizePlacementLivenessResponse,
  PLACEMENT_LIVENESS_LIMITS,
  preparePlacementLivenessChallenge,
  preparePlacementLivenessObservation,
  preparePlacementLivenessResponse,
  verifyPlacementFailureCertificate,
  verifyPlacementLivenessChallenge
} from "../src/placement/liveness.mjs";

async function setup() {
  const resource = new TextEncoder().encode("global-clock-free-liveness".repeat(20));
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
  assert.doesNotThrow(() => preparePlacementLivenessChallenge({
    ...challenge.body,
    response_window_ms: PLACEMENT_LIVENESS_LIMITS.response_window_ms_max
  }));
  assert.throws(() => preparePlacementLivenessChallenge({
    ...challenge.body,
    response_window_ms: String(Number(PLACEMENT_LIVENESS_LIMITS.response_window_ms_max) + 1)
  }), /E_PLACEMENT_LIVENESS_LIMIT/u);
  assert.throws(() => evaluatePlacementLivenessEvidence({
    certificates: Array(PLACEMENT_LIVENESS_LIMITS.certificates_per_evaluation + 1)
      .fill(certificate.bytes),
    responses: []
  }), /E_PLACEMENT_LIVENESS_LIMIT/u);
});

test("late provider proof and liveness forks halt deterministically", async () => {
  const fixture = await setupPromise;
  const refreshed = await refreshStoragePlacementFixture({
    consumer: fixture.consumer,
    fixture: fixture.placement,
    issuedAtMs: 1400,
    provider: fixture.provider,
    resourceBytes: fixture.resource,
    seed: 61
  });
  const response = await createPlacementLivenessResponseFixture({
    challenge_bytes: fixture.failure.challenge_bytes,
    placement: refreshed,
    provider: fixture.provider
  });
  const alive = evaluatePlacementLivenessEvidence({ certificates: [], responses: [response] });
  assert.equal(alive.status, "alive");
  assert.equal(alive.cases[0].execution_receipt_ids.length, 1);
  const contested = evaluatePlacementLivenessEvidence({
    certificates: [fixture.failure.certificate_bytes],
    responses: [response]
  });
  assert.equal(contested.status, "halted");
  assert.equal(contested.cases[0].status, "contested");

  const fakeReceiptId = `resource-execution:${domainHash(
    "MortalOS conflicting response",
    fixture.resource
  ).slice("sha256:".length)}`;
  const challenge = verifyPlacementLivenessChallenge(fixture.failure.challenge_bytes);
  const forkDraft = preparePlacementLivenessResponse({
    challenge: challenge.bytes,
    execution_receipt_id: fakeReceiptId,
    provider: fixture.provider.identity
  });
  const forkResponse = finalizePlacementLivenessResponse({
    challenge: challenge.bytes,
    execution_receipt_id: fakeReceiptId,
    provider: fixture.provider.identity,
    provider_signature: await fixture.provider.sign(forkDraft.provider_signing_message)
  });
  const responseFork = evaluatePlacementLivenessEvidence({
    certificates: [],
    responses: [response, forkResponse]
  });
  assert.equal(responseFork.status, "halted");
  assert.equal(responseFork.cases[0].status, "response-fork");

  const alternate = await createPlacementFailureCertificateFixture({
    consumer: fixture.consumer,
    lineage_parent_hash: fixture.lineageParentHash,
    manifest_id: fixture.manifestId,
    nonce_seed: 92,
    observers: fixture.observers,
    placement: fixture.placement,
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

test("no evidence remains clear rather than claiming provider liveness", () => {
  const evaluated = evaluatePlacementLivenessEvidence({ certificates: [], responses: [] });
  assert.equal(evaluated.status, "clear");
  assert.deepEqual(evaluated.failed_provider_ids, []);
  assert.deepEqual(evaluated.cases, []);
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
  assert.doesNotThrow(() => preparePlacementLivenessChallenge({
    ...challenge.body,
    observer_policy: maxPolicy
  }));
  const extraObserver = await createPlacementSigner();
  assert.throws(() => preparePlacementLivenessChallenge({
    ...challenge.body,
    observer_policy: {
      ...maxPolicy,
      observers: [...maxPolicy.observers, extraObserver.identity]
    }
  }), /E_PLACEMENT_LIVENESS_POLICY/u);
});
