import assert from "node:assert/strict";
import {
  createPlacementSigner,
  createStoragePlacementFixture,
  executePreparedStoragePlacementFixture,
  prepareStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import {
  createPlacementFailureCertificateFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import { createPlacementMembershipFixture } from "../lab/placement/admission-contract.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import { createConfidentialPlacementShardSet } from "../src/placement/confidential.mjs";
import {
  commitLineagePlacementGeneration,
  createLineagePlacementGeneration
} from "../src/placement/lineage-controller.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

export function placementRepairRecord(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

export async function setupPlacementRepairBatchFixture() {
  const resource = new TextEncoder().encode("multi-action repair reconciliation".repeat(128));
  const confidential = await createConfidentialFixture({
    custodianCount: 1,
    resourceBytes: resource
  });
  const shardSet = createConfidentialPlacementShardSet({
    confidential_package_bytes: confidential.confidentialPackage.packageBytes
  });
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () =>
    createPlacementSigner()));
  const providers = await Promise.all(Array.from({ length: 5 }, () =>
    createPlacementSigner()));
  const initial = await Promise.all([0, 1, 2].map((shardIndex) =>
    createStoragePlacementFixture({
      consumer,
      provider: providers[shardIndex],
      resourceBytes: shardSet.shards[shardIndex].bytes,
      seed: 200 + shardIndex * 8,
      witnesses
    })));
  const authority = await createContinuityAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: resource,
    transitionId: "repair-batch-create"
  });
  const membership = await createPlacementMembershipFixture({
    authority,
    capsule_bytes: created.capsule_bytes,
    observers: witnesses,
    providers
  });
  const failures = await Promise.all([0, 1].map((shardIndex) =>
    createPlacementFailureCertificateFixture({
      consumer,
      lineage_parent_hash: created.head_hash,
      manifest_id: shardSet.manifest.manifest_id,
      membership,
      observers: witnesses,
      placement: initial[shardIndex],
      provider: providers[shardIndex],
      response_window_ms: "5000",
      shard_index: shardIndex
    })));
  const generation = createLineagePlacementGeneration({
    capsule_bytes: created.capsule_bytes,
    evaluated_at_ms: "1800",
    failure_certificates: failures.map(({ certificate_bytes: bytes }) => bytes),
    liveness_responses: [],
    manifest_bytes: shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    membership_epochs: [membership.epoch_bytes],
    placements: initial.map(placementRepairRecord),
    prior_commit_bytes: null,
    prior_generation_bytes: null,
    quorum: 2,
    target_shards: 3
  });
  assert.equal(generation.repair_intents.length, 2);
  assert.deepEqual(
    generation.repair_intents.map(({ shard_index: index }) => index),
    [0, 1]
  );
  const committed = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: created.capsule_bytes,
    generation_bytes: generation.bytes
  });
  const prepared = await Promise.all([0, 1].map((shardIndex) =>
    prepareStoragePlacementFixture({
      consumer,
      provider: providers[3 + shardIndex],
      resourceBytes: shardSet.shards[shardIndex].bytes,
      seed: 300 + shardIndex * 8,
      witnesses
    })));
  const lateResponses = await Promise.all([0, 1].map((shardIndex) =>
    createPlacementLivenessResponseFixture({
      challenge_bytes: failures[shardIndex].challenge_bytes,
      placement: initial[shardIndex],
      provider: providers[shardIndex],
      resource_bytes: shardSet.shards[shardIndex].bytes
    })));
  return Object.freeze({
    authority,
    committed,
    failures,
    generation,
    initial,
    lateResponses,
    membership,
    prepared,
    shardSet
  });
}

export function placementRepairBatchActions(fixture, providers) {
  return [0, 1].map((shardIndex) => Object.freeze({
    provider: providers[shardIndex],
    replacement_lease_bytes: fixture.prepared[shardIndex].lease,
    replacement_offer_bytes: fixture.prepared[shardIndex].offer,
    resource_bytes: fixture.shardSet.shards[shardIndex].bytes,
    shard_index: shardIndex
  }));
}

export function stablePlacementRepairBatchEvidence(fixture) {
  return Object.freeze({
    observed_at_ms: "1800",
    observed_liveness_responses: [],
    observed_placements: fixture.initial.map(placementRepairRecord)
  });
}

export function placementRepairBatchOptions(
  fixture,
  directory,
  providers,
  continuity,
  evidence,
  overrides = {}
) {
  return {
    actions: placementRepairBatchActions(fixture, providers),
    capsule_bytes: fixture.committed.capsule_bytes,
    commit_bytes: fixture.committed.commit_bytes,
    continuity,
    directory,
    evidence,
    generation_bytes: fixture.generation.bytes,
    ...overrides
  };
}

export function placementRepairProviderSessions(
  fixture,
  calls,
  failOnceShard = null,
  afterExecute = null
) {
  const cache = [null, null];
  let failed = false;
  return [0, 1].map((shardIndex) => Object.freeze({
    async executeRepairEffect({ idempotency_key: idempotencyKey }) {
      if (cache[shardIndex]) {
        assert.equal(cache[shardIndex].idempotencyKey, idempotencyKey);
        return { placement: cache[shardIndex].placement };
      }
      calls[shardIndex] += 1;
      if (shardIndex === failOnceShard && !failed) {
        failed = true;
        throw new Error("synthetic-batch-provider-interruption");
      }
      const executed = await executePreparedStoragePlacementFixture({
        prepared: fixture.prepared[shardIndex]
      });
      cache[shardIndex] = { idempotencyKey, placement: executed.placement };
      if (afterExecute) await afterExecute(shardIndex);
      return { placement: executed.placement };
    }
  }));
}

export function placementRepairContinuitySession(fixture, state) {
  return Object.freeze({
    async commitPlacementGeneration({ capsule_bytes: capsuleBytes, generation_bytes: bytes }) {
      state.calls += 1;
      if (!state.committed) {
        state.committed = await commitLineagePlacementGeneration({
          authority: fixture.authority,
          capsule_bytes: capsuleBytes,
          generation_bytes: bytes
        });
      }
      return Object.freeze({
        capsule_bytes: state.committed.capsule_bytes,
        commit_bytes: state.committed.commit_bytes
      });
    }
  });
}
