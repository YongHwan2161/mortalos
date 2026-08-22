import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  completeLineagePlacementRepairEffect,
  executeLineagePlacementRepairEffect,
  recoverLineagePlacementRepairCompletion,
  recoverLineagePlacementRepairEffect
} from "../lab/placement/repair-executor.mjs";
import {
  createDurableRepairContinuityResultRecovery,
  createDurableRepairContinuitySession
} from "../lab/placement/durable-repair-continuity-session.mjs";
import {
  createDurableRepairProviderResultRecovery,
  createDurableRepairProviderSession
} from "../lab/placement/durable-repair-provider-session.mjs";
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
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import { createConfidentialPlacementShardSet } from "../src/placement/confidential.mjs";
import {
  commitLineagePlacementGeneration,
  createLineagePlacementGeneration,
  deriveCommittedPlacementRepairEffect
} from "../src/placement/lineage-controller.mjs";
import { createConfidentialFixture } from "./confidential-helpers.mjs";

function record(fixture, shardIndex) {
  return Object.freeze({ ...fixture.placement, shard_index: shardIndex });
}

function serialPlacement(value) {
  return Object.freeze({
    consumption_announcements: value.consumption_announcements.map(encodeBase64Url),
    execution_receipts: value.execution_receipts.map(encodeBase64Url),
    lease: encodeBase64Url(value.lease),
    observed_at_ms: value.observed_at_ms,
    offer: encodeBase64Url(value.offer),
    revocations: value.revocations.map(encodeBase64Url),
    shard_index: value.shard_index,
    usage_receipts: value.usage_receipts.map(encodeBase64Url)
  });
}

async function setup() {
  const actual = new TextEncoder().encode("effect-time repair executor".repeat(120));
  const confidential = await createConfidentialFixture({ custodianCount: 1, resourceBytes: actual });
  const shardSet = createConfidentialPlacementShardSet({
    confidential_package_bytes: confidential.confidentialPackage.packageBytes
  });
  const consumer = await createPlacementSigner();
  const witnesses = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const providers = await Promise.all(Array.from({ length: 5 }, () => createPlacementSigner()));
  const initial = await Promise.all([0, 1, 2].map((shardIndex) =>
    createStoragePlacementFixture({
      consumer,
      provider: providers[shardIndex],
      resourceBytes: shardSet.shards[shardIndex].bytes,
      seed: 20 + shardIndex * 4,
      witnesses
    })));
  const authority = await createContinuityAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: actual,
    transitionId: "repair-effect-create"
  });
  const membership = await createPlacementMembershipFixture({
    authority,
    capsule_bytes: created.capsule_bytes,
    observers: witnesses,
    providers
  });
  const failure = await createPlacementFailureCertificateFixture({
    consumer,
    lineage_parent_hash: created.head_hash,
    manifest_id: shardSet.manifest.manifest_id,
    membership,
    observers: witnesses,
    placement: initial[0],
    provider: providers[0],
    response_window_ms: "5000",
    shard_index: 0
  });
  const generation = createLineagePlacementGeneration({
    capsule_bytes: created.capsule_bytes,
    evaluated_at_ms: "1800",
    failure_certificates: [failure.certificate_bytes],
    liveness_responses: [],
    manifest_bytes: shardSet.manifest_bytes,
    max_proof_age_ms: "500",
    membership_epochs: [membership.epoch_bytes],
    placements: initial.map(record),
    prior_commit_bytes: null,
    prior_generation_bytes: null,
    quorum: 2,
    target_shards: 3
  });
  const committed = await commitLineagePlacementGeneration({
    authority,
    capsule_bytes: created.capsule_bytes,
    generation_bytes: generation.bytes
  });
  const prepared = await prepareStoragePlacementFixture({
    consumer,
    provider: providers[3],
    resourceBytes: shardSet.shards[0].bytes,
    seed: 80,
    witnesses
  });
  const alternate = await prepareStoragePlacementFixture({
    consumer,
    provider: providers[4],
    resourceBytes: shardSet.shards[0].bytes,
    seed: 96,
    witnesses
  });
  const lateResponse = await createPlacementLivenessResponseFixture({
    challenge_bytes: failure.challenge_bytes,
    placement: initial[0],
    provider: providers[0],
    resource_bytes: shardSet.shards[0].bytes
  });
  return {
    alternate,
    authority,
    committed,
    failure,
    generation,
    initial,
    lateResponse,
    prepared,
    shardSet
  };
}

function executorOptions(fixture, directory, provider, prepared = fixture.prepared, overrides = {}) {
  return {
    capsule_bytes: fixture.committed.capsule_bytes,
    commit_bytes: fixture.committed.commit_bytes,
    directory,
    generation_bytes: fixture.generation.bytes,
    observed_at_ms: "1800",
    observed_liveness_responses: [],
    observed_placements: fixture.initial.map(record),
    provider,
    replacement_lease_bytes: prepared.lease,
    replacement_offer_bytes: prepared.offer,
    resource_bytes: fixture.shardSet.shards[0].bytes,
    shard_index: 0,
    ...overrides
  };
}

function completionOptions(fixture, directory, continuity, effectResult, overrides = {}) {
  const {
    directory: ignoredDirectory,
    provider: ignoredProvider,
    ...effectInputs
  } = executorOptions(fixture, directory, Object.freeze({ executeRepairEffect() {} }));
  return {
    ...effectInputs,
    continuity,
    directory,
    effect_result_bytes: effectResult.bytes,
    ...overrides
  };
}

test("single-shard repair re-verifies evidence, commits once, and rejects stale or contested effects", {
  timeout: 2_000_000
}, async () => {
  const fixture = await setup();
  const directory = await mkdtemp(join(tmpdir(), "mortalos-repair-effect-"));
  let effects = 0;
  let cached = null;
  const provider = Object.freeze({
    async executeRepairEffect({ idempotency_key: key }) {
      if (cached) {
        assert.equal(cached.key, key);
        return { placement: cached.fixture.placement };
      }
      effects += 1;
      const replacement = await executePreparedStoragePlacementFixture({ prepared: fixture.prepared });
      cached = { fixture: replacement, key };
      return { placement: replacement.placement };
    }
  });
  try {
    const {
      directory: ignoredDirectory,
      provider: ignoredProvider,
      ...effectInputs
    } = executorOptions(fixture, directory, provider);
    const derived = deriveCommittedPlacementRepairEffect(effectInputs);
    assert.equal(derived.value.non_capability, true);
    assert.equal(derived.value.requires_private_provider_capability, true);
    assert.equal(derived.value.shard_index, 0);
    assert.equal(derived.value.provider_id, fixture.prepared.provider.identity.key_id);

    const [left, right] = await Promise.all([
      executeLineagePlacementRepairEffect(executorOptions(fixture, directory, provider)),
      executeLineagePlacementRepairEffect(executorOptions(fixture, directory, provider))
    ]);
    assert.equal(effects, 1);
    assert.equal(left.value.result_id, right.value.result_id);
    assert.deepEqual(new Set([left.status, right.status]), new Set(["committed"]));

    const retry = await executeLineagePlacementRepairEffect(
      executorOptions(fixture, directory, provider)
    );
    assert.equal(retry.status, "already-committed");
    assert.equal(effects, 1);

    const providerRecoveryDirectory = await mkdtemp(
      join(tmpdir(), "mortalos-repair-provider-recovery-")
    );
    const providerRecoverySessionDirectory = join(providerRecoveryDirectory, "provider-session");
    const providerRecoveryPayloadPath = join(providerRecoveryDirectory, "provider-child.json");
    const providerRecoveryEffectPath = join(providerRecoveryDirectory, "provider-effect.txt");
    try {
      await writeFile(providerRecoveryPayloadPath, JSON.stringify({
        directory: providerRecoverySessionDirectory,
        effect_bytes: encodeBase64Url(derived.bytes),
        idempotency_key: derived.value.effect_id,
        mode: "crash-before-result",
        placement: serialPlacement(cached.fixture.placement),
        ready_path: null,
        release_path: null,
        replacement_lease_bytes: encodeBase64Url(fixture.prepared.lease),
        replacement_offer_bytes: encodeBase64Url(fixture.prepared.offer),
        resource_bytes: encodeBase64Url(fixture.shardSet.shards[0].bytes),
        side_effect_path: providerRecoveryEffectPath
      }));
      const crashedProvider = spawnSync(process.execPath, [
        fileURLToPath(new URL("./durable-repair-provider-session-child.mjs", import.meta.url)),
        providerRecoveryPayloadPath
      ], { encoding: "utf8", timeout: 120_000 });
      assert.equal(crashedProvider.status, 87, crashedProvider.stderr);

      const providerRecovery = createDurableRepairProviderResultRecovery({
        directory: providerRecoverySessionDirectory
      });
      const {
        provider: ignoredRecoveryProvider,
        ...providerRecoveryInputs
      } = executorOptions(
        fixture,
        providerRecoveryDirectory,
        Object.freeze({ executeRepairEffect() {} })
      );
      const forgedProviderReceipt = new Uint8Array(
        cached.fixture.placement.execution_receipts[0]
      );
      forgedProviderReceipt[forgedProviderReceipt.length - 1] ^= 1;
      assert.throws(() => recoverLineagePlacementRepairEffect({
        ...providerRecoveryInputs,
        provider_recovery: providerRecovery,
        recovered_placement: Object.freeze({
          ...cached.fixture.placement,
          execution_receipts: Object.freeze([forgedProviderReceipt])
        })
      }), /E_PLACEMENT_REPAIR_BINDING/u);
      const recoveredProviderEffect = recoverLineagePlacementRepairEffect({
        ...providerRecoveryInputs,
        provider_recovery: providerRecovery,
        recovered_placement: cached.fixture.placement
      });
      assert.equal(recoveredProviderEffect.status, "recovered");
      assert.equal(recoveredProviderEffect.value.result_id, left.value.result_id);

      let recoveredProviderCalls = 0;
      const restartedProvider = createDurableRepairProviderSession({
        directory: providerRecoverySessionDirectory,
        provider: Object.freeze({
          async executeRepairEffect() {
            recoveredProviderCalls += 1;
            throw new Error("recovered-provider-effect-was-reexecuted");
          }
        })
      });
      const recoveredProviderResult = await restartedProvider.executeRepairEffect({
        effect: derived.value,
        effect_bytes: derived.bytes,
        idempotency_key: derived.value.effect_id,
        replacement_lease_bytes: fixture.prepared.lease,
        replacement_offer_bytes: fixture.prepared.offer,
        resource_bytes: fixture.shardSet.shards[0].bytes
      });
      assert.equal(
        recoveredProviderResult.placement.observed_at_ms,
        cached.fixture.placement.observed_at_ms
      );
      assert.equal(recoveredProviderCalls, 0);
    } finally {
      await rm(providerRecoveryDirectory, { recursive: true, force: true });
    }

    const completionDirectory = await mkdtemp(join(tmpdir(), "mortalos-repair-completion-"));
    let completionCalls = 0;
    let committedSuccessor = null;
    const continuity = Object.freeze({
      async commitPlacementGeneration({ capsule_bytes: capsuleBytes, generation_bytes: bytes }) {
        completionCalls += 1;
        committedSuccessor = await commitLineagePlacementGeneration({
          authority: fixture.authority,
          capsule_bytes: capsuleBytes,
          generation_bytes: bytes
        });
        return {
          capsule_bytes: committedSuccessor.capsule_bytes,
          commit_bytes: committedSuccessor.commit_bytes
        };
      }
    });
    try {
      const [completedLeft, completedRight] = await Promise.all([
        completeLineagePlacementRepairEffect(completionOptions(
          fixture,
          completionDirectory,
          continuity,
          left
        )),
        completeLineagePlacementRepairEffect(completionOptions(
          fixture,
          completionDirectory,
          continuity,
          left
        ))
      ]);
      assert.equal(completionCalls, 1);
      assert.equal(completedLeft.value.completion_result_id,
        completedRight.value.completion_result_id);
      assert.equal(completedLeft.generation.generation, "2");
      assert.equal(completedLeft.generation.value.status, "proved");
      assert.equal(completedLeft.generation.repair_intents.length, 0);

      const completedRetry = await completeLineagePlacementRepairEffect(completionOptions(
        fixture,
        completionDirectory,
        continuity,
        left
      ));
      assert.equal(completedRetry.status, "already-committed");
      assert.equal(completionCalls, 1);

      const continuityRecoveryDirectory = await mkdtemp(
        join(tmpdir(), "mortalos-repair-continuity-recovery-")
      );
      const continuityRecoverySessionDirectory = join(
        continuityRecoveryDirectory,
        "continuity-session"
      );
      const continuityRecoveryPayloadPath = join(
        continuityRecoveryDirectory,
        "continuity-child.json"
      );
      const continuityRecoveryEffectPath = join(
        continuityRecoveryDirectory,
        "continuity-effect.txt"
      );
      try {
        await writeFile(continuityRecoveryPayloadPath, JSON.stringify({
          capsule_bytes: encodeBase64Url(fixture.committed.capsule_bytes),
          directory: continuityRecoverySessionDirectory,
          generation_bytes: encodeBase64Url(completedLeft.generation.bytes),
          idempotency_key: completedLeft.value.completion_id,
          mode: "crash-before-result",
          ready_path: null,
          release_path: null,
          result_capsule_bytes: encodeBase64Url(completedLeft.capsule_bytes),
          result_commit_bytes: encodeBase64Url(completedLeft.commit_bytes),
          side_effect_path: continuityRecoveryEffectPath
        }));
        const crashedContinuity = spawnSync(process.execPath, [
          fileURLToPath(new URL(
            "./durable-repair-continuity-session-child.mjs",
            import.meta.url
          )),
          continuityRecoveryPayloadPath
        ], { encoding: "utf8", timeout: 120_000 });
        assert.equal(crashedContinuity.status, 88, crashedContinuity.stderr);

        const continuityRecovery = createDurableRepairContinuityResultRecovery({
          directory: continuityRecoverySessionDirectory
        });
        const {
          continuity: ignoredRecoveryContinuity,
          ...continuityRecoveryInputs
        } = completionOptions(
          fixture,
          continuityRecoveryDirectory,
          Object.freeze({ commitPlacementGeneration() {} }),
          left
        );
        const forgedCommit = new Uint8Array(completedLeft.commit_bytes);
        forgedCommit[forgedCommit.length - 1] ^= 1;
        assert.throws(() => recoverLineagePlacementRepairCompletion({
          ...continuityRecoveryInputs,
          continuity_recovery: continuityRecovery,
          recovered_capsule_bytes: completedLeft.capsule_bytes,
          recovered_commit_bytes: forgedCommit
        }));
        const recoveredContinuity = recoverLineagePlacementRepairCompletion({
          ...continuityRecoveryInputs,
          continuity_recovery: continuityRecovery,
          recovered_capsule_bytes: completedLeft.capsule_bytes,
          recovered_commit_bytes: completedLeft.commit_bytes
        });
        assert.equal(recoveredContinuity.status, "recovered");
        assert.equal(
          recoveredContinuity.value.completion_result_id,
          completedLeft.value.completion_result_id
        );

        let recoveredContinuityCalls = 0;
        const restartedContinuity = createDurableRepairContinuitySession({
          continuity: Object.freeze({
            async commitPlacementGeneration() {
              recoveredContinuityCalls += 1;
              throw new Error("recovered-continuity-effect-was-reexecuted");
            }
          }),
          directory: continuityRecoverySessionDirectory
        });
        const recoveredContinuityResult = await restartedContinuity.commitPlacementGeneration({
          capsule_bytes: fixture.committed.capsule_bytes,
          generation_bytes: completedLeft.generation.bytes,
          idempotency_key: completedLeft.value.completion_id
        });
        assert.equal(
          equalBytes(recoveredContinuityResult.commit_bytes, completedLeft.commit_bytes),
          true
        );
        assert.equal(recoveredContinuityCalls, 0);
      } finally {
        await rm(continuityRecoveryDirectory, { recursive: true, force: true });
      }

      await assert.rejects(() => completeLineagePlacementRepairEffect(completionOptions(
        fixture,
        completionDirectory,
        continuity,
        left,
        { observed_placements: [...fixture.initial.map(record)].reverse() }
      )), /E_PLACEMENT_REPAIR_COMPLETION_CLAIMED/u);
      assert.equal(completionCalls, 1);

      const forgedResult = new Uint8Array(left.bytes);
      forgedResult[forgedResult.length - 1] ^= 1;
      await assert.rejects(() => completeLineagePlacementRepairEffect(completionOptions(
        fixture,
        join(completionDirectory, "forged"),
        continuity,
        left,
        { effect_result_bytes: forgedResult }
      )));
      assert.equal(completionCalls, 1);

      await assert.rejects(() => completeLineagePlacementRepairEffect(completionOptions(
        fixture,
        join(completionDirectory, "contested"),
        continuity,
        left,
        { observed_liveness_responses: [fixture.lateResponse] }
      )), /contested-or-forked-evidence/u);
      assert.equal(completionCalls, 1);

      await assert.rejects(() => completeLineagePlacementRepairEffect(completionOptions(
        fixture,
        join(completionDirectory, "superseded"),
        continuity,
        left,
        { capsule_bytes: completedLeft.capsule_bytes }
      )), /superseded-generation-plan/u);
      assert.equal(completionCalls, 1);

      const crashCompletionDirectory = await mkdtemp(
        join(tmpdir(), "mortalos-repair-completion-crash-")
      );
      let durableCommit = null;
      let signingOperations = 0;
      let failAfterCommit = true;
      const continuitySessionDirectory = join(crashCompletionDirectory, "continuity-session");
      const firstContinuitySession = createDurableRepairContinuitySession({
        continuity: Object.freeze({
          async commitPlacementGeneration({ capsule_bytes: capsuleBytes, generation_bytes: bytes }) {
            signingOperations += 1;
            if (!durableCommit) {
              durableCommit = await commitLineagePlacementGeneration({
                authority: fixture.authority,
                capsule_bytes: capsuleBytes,
                generation_bytes: bytes
              });
            }
            return {
              capsule_bytes: durableCommit.capsule_bytes,
              commit_bytes: durableCommit.commit_bytes
            };
          }
        }),
        directory: continuitySessionDirectory
      });
      const crashingContinuity = Object.freeze({
        async commitPlacementGeneration(request) {
          const committed = await firstContinuitySession.commitPlacementGeneration(request);
          if (failAfterCommit) {
            failAfterCommit = false;
            throw new Error("synthetic-crash-after-continuity-commit");
          }
          return committed;
        }
      });
      try {
        await assert.rejects(() => completeLineagePlacementRepairEffect(completionOptions(
          fixture,
          crashCompletionDirectory,
          crashingContinuity,
          left
        )), /synthetic-crash-after-continuity-commit/u);
        assert.equal(signingOperations, 1);
        let restartedUnderlyingCalls = 0;
        const restartedContinuity = createDurableRepairContinuitySession({
          continuity: Object.freeze({
            async commitPlacementGeneration() {
              restartedUnderlyingCalls += 1;
              throw new Error("durable-continuity-result-was-not-restored");
            }
          }),
          directory: continuitySessionDirectory
        });
        const recoveredCompletion = await completeLineagePlacementRepairEffect(
          completionOptions(
            fixture,
            crashCompletionDirectory,
            restartedContinuity,
            left
          )
        );
        assert.equal(recoveredCompletion.status, "committed");
        assert.equal(signingOperations, 1);
        assert.equal(restartedUnderlyingCalls, 0);
        const recoveredCompletionRetry = await completeLineagePlacementRepairEffect(
          completionOptions(
            fixture,
            crashCompletionDirectory,
            restartedContinuity,
            left
          )
        );
        assert.equal(recoveredCompletionRetry.status, "already-committed");
        assert.equal(signingOperations, 1);
        assert.equal(restartedUnderlyingCalls, 0);
      } finally {
        await rm(crashCompletionDirectory, { recursive: true, force: true });
      }
    } finally {
      await rm(completionDirectory, { recursive: true, force: true });
    }

    const alreadyRepairedDirectory = await mkdtemp(join(tmpdir(), "mortalos-repair-current-"));
    try {
      await assert.rejects(() => executeLineagePlacementRepairEffect(executorOptions(
        fixture,
        alreadyRepairedDirectory,
        provider,
        fixture.prepared,
        {
          observed_placements: [
            ...fixture.initial.map(record),
            record(cached.fixture, 0)
          ]
        }
      )), /repair-effect-current-placement/u);
      assert.equal(effects, 1);
    } finally {
      await rm(alreadyRepairedDirectory, { recursive: true, force: true });
    }

    let alternateCalls = 0;
    const alternateProvider = Object.freeze({
      async executeRepairEffect() {
        alternateCalls += 1;
        const replacement = await executePreparedStoragePlacementFixture({
          prepared: fixture.alternate
        });
        return { placement: replacement.placement };
      }
    });
    await assert.rejects(() => executeLineagePlacementRepairEffect(executorOptions(
      fixture,
      directory,
      alternateProvider,
      fixture.alternate
    )), /E_PLACEMENT_REPAIR_SLOT_CLAIMED/u);
    assert.equal(alternateCalls, 0);

    const contestedDirectory = await mkdtemp(join(tmpdir(), "mortalos-repair-contested-"));
    try {
      await assert.rejects(() => executeLineagePlacementRepairEffect(executorOptions(
        fixture,
        contestedDirectory,
        provider,
        fixture.prepared,
        { observed_liveness_responses: [fixture.lateResponse] }
      )), /contested-or-forked-evidence/u);
      assert.equal(effects, 1);
    } finally {
      await rm(contestedDirectory, { recursive: true, force: true });
    }

    const forged = new Uint8Array(fixture.committed.capsule_bytes);
    forged[forged.length - 1] ^= 1;
    const forgedDirectory = await mkdtemp(join(tmpdir(), "mortalos-repair-forged-"));
    try {
      await assert.rejects(() => executeLineagePlacementRepairEffect(executorOptions(
        fixture,
        forgedDirectory,
        provider,
        fixture.prepared,
        { capsule_bytes: forged }
      )));
      assert.equal(effects, 1);
    } finally {
      await rm(forgedDirectory, { recursive: true, force: true });
    }

    const crashDirectory = await mkdtemp(join(tmpdir(), "mortalos-repair-crash-"));
    const payloadPath = join(crashDirectory, "child.json");
    const providerEffectPath = join(crashDirectory, "provider-effect.bin");
    const providerSessionDirectory = join(crashDirectory, "provider-session");
    const childOptions = executorOptions(fixture, crashDirectory, provider);
    await writeFile(payloadPath, JSON.stringify({
      capsule_bytes: encodeBase64Url(childOptions.capsule_bytes),
      commit_bytes: encodeBase64Url(childOptions.commit_bytes),
      directory: crashDirectory,
      generation_bytes: encodeBase64Url(childOptions.generation_bytes),
      observed_at_ms: childOptions.observed_at_ms,
      observed_liveness_responses: childOptions.observed_liveness_responses.map(encodeBase64Url),
      observed_placements: childOptions.observed_placements.map(serialPlacement),
      provider_effect_path: providerEffectPath,
      provider_session_directory: providerSessionDirectory,
      replacement_placement: serialPlacement(cached.fixture.placement),
      replacement_lease_bytes: encodeBase64Url(childOptions.replacement_lease_bytes),
      replacement_offer_bytes: encodeBase64Url(childOptions.replacement_offer_bytes),
      resource_bytes: encodeBase64Url(childOptions.resource_bytes),
      shard_index: childOptions.shard_index
    }));
    try {
      const crashed = spawnSync(process.execPath, [
        fileURLToPath(new URL("./placement-repair-executor-child.mjs", import.meta.url)),
        payloadPath
      ], { encoding: "utf8", timeout: 120_000 });
      assert.equal(crashed.status, 86, crashed.stderr);
      assert.equal(equalBytes(
        new Uint8Array(await readFile(providerEffectPath)),
        fixture.shardSet.shards[0].bytes
      ), true);
      let retryProviderCalls = 0;
      const retryProvider = createDurableRepairProviderSession({
        directory: providerSessionDirectory,
        provider: Object.freeze({
          async executeRepairEffect() {
            retryProviderCalls += 1;
            throw new Error("durable-provider-result-was-not-restored");
          }
        })
      });
      const recovered = await executeLineagePlacementRepairEffect(executorOptions(
        fixture,
        crashDirectory,
        retryProvider
      ));
      assert.equal(recovered.status, "committed");
      assert.equal(retryProviderCalls, 0);
      const recoveredRetry = await executeLineagePlacementRepairEffect(executorOptions(
        fixture,
        crashDirectory,
        retryProvider
      ));
      assert.equal(recoveredRetry.status, "already-committed");
      assert.equal(retryProviderCalls, 0);
    } finally {
      await rm(crashDirectory, { recursive: true, force: true });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
