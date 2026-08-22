import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  executeAndCompleteLineagePlacementRepairBatch
} from "../lab/placement/repair-executor.mjs";
import {
  createPlacementNetworkEvidenceSession
} from "../lab/placement/network-evidence-session.mjs";
import { VirtualTransportNetwork } from "../lab/transport/virtual-transport.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  createResourcePlacementArtifactMessage
} from "../src/transport/protocol.mjs";
import {
  placementRepairBatchActions as batchActions,
  placementRepairBatchOptions as batchOptions,
  placementRepairContinuitySession as continuitySession,
  placementRepairProviderSessions as providerSessions,
  setupPlacementRepairBatchFixture as setupBatchFixture,
  stablePlacementRepairBatchEvidence as stableEvidence
} from "./placement-repair-batch-fixture.mjs";

test("multi-action repair stops after a transport-delivered late response", {
  timeout: 900_000
}, async () => {
  const fixture = await setupBatchFixture();
  const directory = await mkdtemp(join(tmpdir(), "mortalos-repair-batch-"));
  const providerCalls = [0, 0];
  const network = new VirtualTransportNetwork();
  const roomId = "repairBatchEvidence001";
  const publisher = network.endpoint(roomId, "provider-evidence");
  const reader = network.endpoint(roomId, "repair-executor");
  const providers = providerSessions(fixture, providerCalls, null, async (shardIndex) => {
    if (shardIndex !== 0) return;
    const message = createResourcePlacementArtifactMessage({
      artifactKind: "liveness-response",
      payloadBytes: fixture.lateResponses[1],
      requestId: "repair-batch-late-response-1"
    });
    const rewrapped = createResourcePlacementArtifactMessage({
      artifactKind: "liveness-response",
      payloadBytes: fixture.lateResponses[1],
      requestId: "repair-batch-late-response-2"
    });
    const ignored = createResourcePlacementArtifactMessage({
      artifactKind: "challenge",
      payloadBytes: fixture.lateResponses[1],
      requestId: "repair-batch-ignored-challenge"
    });
    const first = await publisher.publish(canonicalBytes(message));
    const duplicate = await publisher.publish(canonicalBytes(message));
    const rewrappedResult = await publisher.publish(canonicalBytes(rewrapped));
    const ignoredResult = await publisher.publish(canonicalBytes(ignored));
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(rewrappedResult.duplicate, false);
    assert.equal(ignoredResult.duplicate, false);
  });
  const continuityState = { calls: 0, committed: null };
  const continuity = continuitySession(fixture, continuityState);
  const baseline = Object.freeze({
    async readCurrentEvidence() {
      return stableEvidence(fixture);
    }
  });
  const evidence = createPlacementNetworkEvidenceSession({
    evidence: baseline,
    transport: Object.freeze({ readRange: reader.fetchRange })
  });
  try {
    await assert.rejects(() => executeAndCompleteLineagePlacementRepairBatch(
      batchOptions(fixture, directory, providers, continuity, evidence)
    ), /contested-or-forked-evidence|late-proof-conflict/u);
    assert.deepEqual(providerCalls, [1, 0]);
    assert.equal(continuityState.calls, 0);

    await assert.rejects(() => executeAndCompleteLineagePlacementRepairBatch(
      batchOptions(fixture, join(directory, "missing"), providers, continuity, evidence, {
        actions: [batchActions(fixture, providers)[0]]
      })
    ), /repair-batch-actions-length/u);
    assert.deepEqual(providerCalls, [1, 0]);
    assert.equal(continuityState.calls, 0);
  } finally {
    publisher.close();
    reader.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("multi-action repair resumes after a provider interruption without repeating prior effects", {
  timeout: 1_200_000
}, async () => {
  const fixture = await setupBatchFixture();
  const directory = await mkdtemp(join(tmpdir(), "mortalos-repair-batch-partial-"));
  const providerCalls = [0, 0];
  const providers = providerSessions(fixture, providerCalls, 1);
  const continuityState = { calls: 0, committed: null };
  const continuity = continuitySession(fixture, continuityState);
  const evidence = Object.freeze({
    async readCurrentEvidence() {
      return stableEvidence(fixture);
    }
  });
  try {
    await assert.rejects(() => executeAndCompleteLineagePlacementRepairBatch(
      batchOptions(fixture, directory, providers, continuity, evidence)
    ), /synthetic-batch-provider-interruption/u);
    assert.deepEqual(providerCalls, [1, 1]);
    assert.equal(continuityState.calls, 0);

    const [completed, concurrent] = await Promise.all([
      executeAndCompleteLineagePlacementRepairBatch(
        batchOptions(fixture, directory, providers, continuity, evidence)
      ),
      executeAndCompleteLineagePlacementRepairBatch(
        batchOptions(fixture, directory, providers, continuity, evidence, {
          actions: batchActions(fixture, providers).reverse()
        })
      )
    ]);
    assert.equal(completed.status, "committed");
    assert.equal(concurrent.value.completion_result_id, completed.value.completion_result_id);
    assert.deepEqual(providerCalls, [1, 2]);
    assert.equal(continuityState.calls, 1);
    assert.equal(completed.generation.value.status, "proved");
    assert.equal(completed.generation.repair_intents.length, 0);

    const retried = await executeAndCompleteLineagePlacementRepairBatch(
      batchOptions(fixture, directory, providers, continuity, evidence)
    );
    assert.equal(retried.status, "already-committed");
    assert.equal(retried.value.completion_result_id, completed.value.completion_result_id);
    assert.deepEqual(providerCalls, [1, 2]);
    assert.equal(continuityState.calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
