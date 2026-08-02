import assert from "node:assert/strict";
import test from "node:test";
import {
  createStatePackage,
  createStatePackageInput
} from "../src/state/package.mjs";
import {
  MemoryContentAddressedStore,
  ReplicaRecoveryAdapter
} from "../src/state/recovery.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import {
  createConfidentialStatePackage,
  MemoryConfidentialEpochStore,
  recoverAndDecryptConfidentialState
} from "../src/confidential/recovery.mjs";
import {
  createConfidentialFixture,
  deterministicSecret,
  keyPairFor
} from "./confidential-helpers.mjs";

test("every any-two S3 replica pair recovers ciphertext and decrypts the exact one-MiB resource after relay deletion", async () => {
  const fixture = await createConfidentialFixture({
    resourceBytes: deterministicSecret(1_048_576)
  });
  const inputBytes = createStatePackageInput({
    transitionId: "s4-any-two-recovery"
  });
  const priorStateRoot = randomTagged("sha256:");
  const genomeHash = randomTagged("sha256:");
  const statePackage = createStatePackage({
    genomeHash,
    inputBytes,
    priorStateRoot,
    resourceBytes: fixture.confidentialPackage.packageBytes
  });
  const replicas = [
    new MemoryContentAddressedStore(),
    new MemoryContentAddressedStore(),
    new MemoryContentAddressedStore()
  ];
  for (const descriptor of statePackage.manifest.chunks) {
    for (let replica = 0; replica < 3; replica += 1) {
      if (descriptor.index % 3 === replica) continue;
      await replicas[replica].put(
        descriptor.digest,
        statePackage.chunkBytes[descriptor.index],
        descriptor.size
      );
    }
  }
  const pairs = [
    [0, 1],
    [0, 2],
    [1, 2]
  ];
  for (let index = 0; index < pairs.length; index += 1) {
    const destination = new MemoryContentAddressedStore();
    const confidentialDestination = new MemoryConfidentialEpochStore();
    const custodian = fixture.custodians[index];
    const recovered = await recoverAndDecryptConfidentialState({
      confidentialDestination,
      custodian,
      destination,
      expected: {
        custodians: fixture.custodians,
        epoch: fixture.epoch,
        epochId: fixture.epochId,
        genomeHash,
        membershipHead: fixture.membershipHead,
        nextStateRoot: statePackage.nextStateRoot,
        organismId: fixture.organismId,
        priorConfidentialRoot: fixture.priorConfidentialRoot,
        priorStateRoot,
        resourceId: fixture.resourceId
      },
      inputBytes,
      manifestBytes: statePackage.manifestBytes,
      privateKey: keyPairFor(fixture, custodian).privateKey,
      receiptBytes: statePackage.receiptBytes,
      sources: pairs[index].map(
        (replica) => new ReplicaRecoveryAdapter(replicas[replica])
      )
    });
    assert.equal(recovered.status, "available");
    assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
    assert.equal(
      confidentialDestination.active.confidential_root,
      fixture.confidentialPackage.confidentialRoot
    );
  }
});

test("S3 availability and local decryption authority remain distinct statuses", async () => {
  const fixture = await createConfidentialFixture({
    resourceBytes: deterministicSecret(65_537)
  });
  const inputBytes = createStatePackageInput({
    transitionId: "s4-key-unavailable"
  });
  const priorStateRoot = randomTagged("sha256:");
  const genomeHash = randomTagged("sha256:");
  const statePackage = createStatePackage({
    genomeHash,
    inputBytes,
    priorStateRoot,
    resourceBytes: fixture.confidentialPackage.packageBytes
  });
  const sourceStore = new MemoryContentAddressedStore();
  for (const descriptor of statePackage.manifest.chunks) {
    await sourceStore.put(
      descriptor.digest,
      statePackage.chunkBytes[descriptor.index],
      descriptor.size
    );
  }
  const outsider = await createConfidentialFixture({
    resourceBytes: new Uint8Array([1])
  });
  const result = await recoverAndDecryptConfidentialState({
    confidentialDestination: new MemoryConfidentialEpochStore(),
    custodian: outsider.custodians[0],
    destination: new MemoryContentAddressedStore(),
    expected: {
      custodians: fixture.custodians,
      epoch: fixture.epoch,
      epochId: fixture.epochId,
      genomeHash,
      membershipHead: fixture.membershipHead,
      nextStateRoot: statePackage.nextStateRoot,
      organismId: fixture.organismId,
      priorConfidentialRoot: fixture.priorConfidentialRoot,
      priorStateRoot,
      resourceId: fixture.resourceId
    },
    inputBytes,
    manifestBytes: statePackage.manifestBytes,
    privateKey: outsider.keyPairs[0].privateKey,
    receiptBytes: statePackage.receiptBytes,
    sources: [new ReplicaRecoveryAdapter(sourceStore)]
  });
  assert.deepEqual(result, {
    code: "E_CONFIDENTIAL_KEY_UNAVAILABLE",
    status: "key_unavailable"
  });
});

test("confidential/S3 constructor, unavailable ciphertext, and activation interruption remain distinct", async () => {
  const fixture = await createConfidentialFixture({
    resourceBytes: deterministicSecret(32_768),
    transitionId: "constructor-source"
  });
  const inputBytes = createStatePackageInput({
    transitionId: "s4-constructor-and-failures"
  });
  const priorStateRoot = randomTagged("sha256:");
  const genomeHash = randomTagged("sha256:");
  const active = await fixture.authority.inspect(fixture.epochId);
  const constructed = await createConfidentialStatePackage({
    confidential: {
      authority: fixture.authority,
      custodians: fixture.custodians,
      epoch: fixture.epoch,
      epochId: fixture.epochId,
      expectedNextCounter: active.next_counter,
      expectedPriorReceiptDigest: active.last_counter_receipt_digest,
      membershipHead: fixture.membershipHead,
      organismId: fixture.organismId,
      priorConfidentialRoot: fixture.confidentialPackage.confidentialRoot,
      resourceBytes: deterministicSecret(8_192),
      resourceId: fixture.resourceId,
      transitionId: fixture.transitionId
    },
    genomeHash,
    inputBytes,
    priorStateRoot
  });
  assert.deepEqual(
    constructed.statePackage.resourceBytes,
    constructed.confidentialPackage.packageBytes,
    "the S3 raw resource must be the ciphertext package, never application plaintext"
  );
  assert.ok(constructed.statePackage.chunkBytes.length > 0);

  const common = {
    custodian: fixture.custodians[0],
    expected: {
      custodians: fixture.custodians,
      epoch: fixture.epoch,
      epochId: fixture.epochId,
      genomeHash,
      membershipHead: fixture.membershipHead,
      nextStateRoot: constructed.statePackage.nextStateRoot,
      organismId: fixture.organismId,
      priorConfidentialRoot: fixture.confidentialPackage.confidentialRoot,
      priorStateRoot,
      resourceId: fixture.resourceId
    },
    inputBytes,
    manifestBytes: constructed.statePackage.manifestBytes,
    privateKey: keyPairFor(fixture, fixture.custodians[0]).privateKey,
    receiptBytes: constructed.statePackage.receiptBytes
  };
  const unavailable = await recoverAndDecryptConfidentialState({
    ...common,
    confidentialDestination: new MemoryConfidentialEpochStore(),
    destination: new MemoryContentAddressedStore(),
    sources: []
  });
  assert.equal(unavailable.status, "state_unavailable");

  const source = new MemoryContentAddressedStore();
  for (const descriptor of constructed.statePackage.manifest.chunks) {
    await source.put(
      descriptor.digest,
      constructed.statePackage.chunkBytes[descriptor.index],
      descriptor.size
    );
  }
  const interrupted = await recoverAndDecryptConfidentialState({
    ...common,
    confidentialDestination: new MemoryConfidentialEpochStore({
      fault() {
        throw new Error("activation-offline");
      }
    }),
    destination: new MemoryContentAddressedStore(),
    sources: [new ReplicaRecoveryAdapter(source)]
  });
  assert.deepEqual(interrupted, {
    code: "E_CONFIDENTIAL_INTERRUPTED",
    status: "confidential_state_interrupted"
  });

  const expected = structuredClone(common.expected);
  expected.resourceId = randomTagged("sha256:");
  const mutatingSource = {
    async inventory() {
      expected.resourceId = common.expected.resourceId;
      return source.inventory();
    },
    async readChunk(digest) {
      return source.get(digest);
    }
  };
  const timeOfCheck = await recoverAndDecryptConfidentialState({
    ...common,
    confidentialDestination: new MemoryConfidentialEpochStore(),
    destination: new MemoryContentAddressedStore(),
    expected,
    sources: [mutatingSource]
  });
  assert.equal(timeOfCheck.status, "confidential_state_rejected");

  const protectedActivation = new MemoryConfidentialEpochStore();
  protectedActivation.commitActive = async () => {};
  const protectedResult = await recoverAndDecryptConfidentialState({
    ...common,
    confidentialDestination: protectedActivation,
    destination: new MemoryContentAddressedStore(),
    sources: [new ReplicaRecoveryAdapter(source)]
  });
  assert.equal(protectedResult.status, "available");
  assert.equal(
    protectedActivation.active.confidential_root,
    constructed.confidentialPackage.confidentialRoot
  );
  assert.equal(Object.hasOwn(protectedResult, "epoch_key"), false);

  const unregisteredActivation = await recoverAndDecryptConfidentialState({
    ...common,
    confidentialDestination: { async commitActive() {} },
    destination: new MemoryContentAddressedStore(),
    sources: [new ReplicaRecoveryAdapter(source)]
  });
  assert.equal(unregisteredActivation.status, "confidential_state_rejected");
});
