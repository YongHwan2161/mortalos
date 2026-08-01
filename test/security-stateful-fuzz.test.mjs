import assert from "node:assert/strict";
import test from "node:test";
import { DurableQuorumEndpoint } from "../lab/participant/durable-quorum-endpoint.mjs";
import { MemoryDurableStore } from "../lab/storage/memory-durable-store.mjs";
import {
  MemoryConfidentialEpochStore,
  recoverAndDecryptConfidentialState
} from "../src/confidential/recovery.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import { createStatePackage, createStatePackageInput } from "../src/state/package.mjs";
import {
  MemoryContentAddressedStore,
  ReplicaRecoveryAdapter
} from "../src/state/recovery.mjs";
import {
  createConfidentialFixture,
  deterministicSecret,
  keyPairFor
} from "./confidential-helpers.mjs";

function seed(value) {
  return new Uint8Array(16).fill(value);
}

test("stateful S2 corpus composes accessor, Proxy, prototype, store, and array mutation without duplicate signing", async () => {
  for (let trial = 0; trial < 12; trial += 1) {
    const store = new MemoryDurableStore();
    let signerCalls = 0;
    const endpoint = new DurableQuorumEndpoint({
      endpointId: `fuzz-${trial}`,
      store,
      clock: () => 1_800_000_000_000,
      async signingBoundary(boundary) {
        assert.equal(typeof boundary, "string");
        assert.equal(boundary === "before" || boundary === "after", true);
        if (boundary !== "before") return;
        signerCalls += 1;
        await Promise.resolve();
      }
    });
    await endpoint.initializeKey();
    const body = structuredClone(endpoint.createGenesisBody({
      custodians: [endpoint.custodian],
      initialStateSeed: seed(20 + trial),
      nonceSeed: seed(40 + trial),
      threshold: 1
    }));
    const originalRead = MemoryDurableStore.prototype.read;
    const originalWrite = MemoryDurableStore.prototype.write;
    if (trial % 4 === 0) {
      const hostile = new Proxy(body, {
        getOwnPropertyDescriptor(target, property) {
          if (property === "initial_custodians") {
            return { configurable: true, enumerable: true, get() { return []; } };
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        }
      });
      await assert.rejects(endpoint.approveGenesis(hostile));
      assert.equal(signerCalls, 0);
      continue;
    }
    const approval = endpoint.approveGenesis(body);
    body.initial_custodians.splice(0, body.initial_custodians.length);
    store.read = async () => null;
    store.write = async () => {};
    MemoryDurableStore.prototype.read = async () => null;
    MemoryDurableStore.prototype.write = async () => {};
    try {
      const attempts = await Promise.allSettled([approval, endpoint.approveGenesis(endpoint.createGenesisBody({
        custodians: [endpoint.custodian],
        initialStateSeed: seed(20 + trial),
        nonceSeed: seed(40 + trial),
        threshold: 1
      }))]);
      const accepted = attempts.filter(({ status }) => status === "fulfilled");
      const rejected = attempts.filter(({ status }) => status === "rejected");
      assert.equal(accepted.length, 2);
      assert.equal(rejected.length, 0);
      assert.deepEqual(accepted[1].value, accepted[0].value);
      const replayed = await endpoint.approveGenesis(endpoint.createGenesisBody({
        custodians: [endpoint.custodian],
        initialStateSeed: seed(20 + trial),
        nonceSeed: seed(40 + trial),
        threshold: 1
      }));
      assert.deepEqual(replayed, accepted[0].value);
      assert.equal(signerCalls, 1);
      assert.equal(endpoint.document.key.private_key, undefined);
    } finally {
      MemoryDurableStore.prototype.read = originalRead;
      MemoryDurableStore.prototype.write = originalWrite;
    }
  }
});

test("stateful S4 recovery corpus snapshots transitive authority and ignores mutable activation facades", async () => {
  const fixture = await createConfidentialFixture({ resourceBytes: deterministicSecret(65_537) });
  const inputBytes = createStatePackageInput({ transitionId: "security-stateful-fuzz" });
  const genomeHash = randomTagged("sha256:");
  const priorStateRoot = randomTagged("sha256:");
  const state = createStatePackage({
    genomeHash,
    inputBytes,
    priorStateRoot,
    resourceBytes: fixture.confidentialPackage.packageBytes
  });
  const store = new MemoryContentAddressedStore();
  for (const descriptor of state.manifest.chunks) {
    await store.put(descriptor.digest, state.chunkBytes[descriptor.index], descriptor.size);
  }
  const expectedBasis = {
    custodians: fixture.custodians,
    epoch: fixture.epoch,
    epochId: fixture.epochId,
    genomeHash,
    membershipHead: fixture.membershipHead,
    nextStateRoot: state.nextStateRoot,
    organismId: fixture.organismId,
    priorConfidentialRoot: fixture.priorConfidentialRoot,
    priorStateRoot,
    resourceId: fixture.resourceId
  };

  for (let trial = 0; trial < 16; trial += 1) {
    const expected = structuredClone(expectedBasis);
    if (trial % 4 === 0) {
      const hostile = new Proxy(expected, {
        getOwnPropertyDescriptor(target, property) {
          if (property === "resourceId") {
            return { configurable: true, enumerable: true, get() { return target.resourceId; } };
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        }
      });
      const rejected = await recoverAndDecryptConfidentialState({
        confidentialDestination: new MemoryConfidentialEpochStore(),
        custodian: fixture.custodians[0],
        destination: new MemoryContentAddressedStore(),
        expected: hostile,
        inputBytes,
        manifestBytes: state.manifestBytes,
        privateKey: keyPairFor(fixture, fixture.custodians[0]).privateKey,
        receiptBytes: state.receiptBytes,
        sources: [new ReplicaRecoveryAdapter(store)]
      });
      assert.equal(rejected.status, "confidential_state_rejected");
      continue;
    }
    class MutableSource {
      async inventory() {
        await Promise.resolve();
        return store.inventory();
      }
      async readChunk(digest) {
        return store.get(digest);
      }
    }
    const source = new MutableSource();
    const sources = [source];
    const confidentialDestination = new MemoryConfidentialEpochStore();
    const originalReadChunk = MutableSource.prototype.readChunk;
    const recovery = recoverAndDecryptConfidentialState({
      confidentialDestination,
      custodian: fixture.custodians[0],
      destination: new MemoryContentAddressedStore(),
      expected,
      inputBytes,
      manifestBytes: state.manifestBytes,
      privateKey: keyPairFor(fixture, fixture.custodians[0]).privateKey,
      receiptBytes: state.receiptBytes,
      sources
    });
    expected.resourceId = randomTagged("sha256:");
    expected.custodians.splice(0, expected.custodians.length);
    sources.splice(0, sources.length);
    MutableSource.prototype.readChunk = async () => new Uint8Array([1]);
    confidentialDestination.commitActive = async () => null;
    try {
      const recovered = await recovery;
      assert.equal(recovered.status, "available");
      assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
      assert.equal(
        confidentialDestination.active.confidential_root,
        fixture.confidentialPackage.confidentialRoot
      );
      assert.equal(Object.hasOwn(recovered, "epoch_key"), false);
    } finally {
      MutableSource.prototype.readChunk = originalReadChunk;
    }
  }
});
