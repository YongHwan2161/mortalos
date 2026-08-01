import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  canonicalBytes,
  createInitialState,
  createLineage,
  createStatePackage,
  createStatePackageInput,
  createStatePackageTransitionPayload,
  custodyCommitment,
  decodeBase64Url,
  derivePeerId,
  deterministicReferenceResource,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  MemoryContentAddressedStore,
  pulseApprovalMessage,
  PULSE_SEED_V1_GENOME_BYTES,
  recoverStatePackage,
  ReplicaRecoveryAdapter,
  StatePackageError,
  STATE_PACKAGE_LIMITS,
  STATE_PACKAGE_TRANSITION_FORMAT,
  stateGenomeHash,
  statePackageChunkDigest,
  statePackageInputDigest,
  statePackageReceiptDigest,
  statePackageResourceRoot,
  statePackageStateRoot,
  stateRoot,
  verifyStatePackage,
  verifyStatePackageTransitionPayload,
  verifyStateTransitionPayload
} from "../src/index.mjs";

function packageFixture() {
  const initial = createInitialState(new Uint8Array(16).fill(3));
  const inputBytes = createStatePackageInput();
  const resourceBytes = deterministicReferenceResource();
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    inputBytes,
    priorStateRoot: stateRoot(initial),
    resourceBytes
  });
  return { initial, inputBytes, resourceBytes, statePackage };
}

function recoveryMatrixFixture() {
  const initial = createInitialState(new Uint8Array(16).fill(7));
  const inputBytes = createStatePackageInput({ transitionId: "seeded-recovery-matrix" });
  const resourceBytes = new Uint8Array(STATE_PACKAGE_LIMITS.chunk_bytes + 1);
  resourceBytes.fill(0x11, 0, STATE_PACKAGE_LIMITS.chunk_bytes);
  resourceBytes[resourceBytes.length - 1] = 0x22;
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    inputBytes,
    priorStateRoot: stateRoot(initial),
    resourceBytes
  });
  assert.equal(statePackage.manifest.chunks.length, 2);
  return { initial, inputBytes, resourceBytes, statePackage };
}

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function signature(actorValue, message) {
  return {
    key_id: actorValue.key_id,
    signature: `ed25519:${encodeBase64Url(sign(null, message, actorValue.privateKey))}`
  };
}

function mutateManifest(statePackage, mutate) {
  const manifest = JSON.parse(new TextDecoder().decode(statePackage.manifestBytes));
  mutate(manifest);
  return canonicalBytes(manifest);
}

function rebindPackageInput(statePackage, inputValue) {
  const inputBytes = canonicalBytes(inputValue);
  const manifest = structuredClone(statePackage.manifest);
  manifest.transition_input_digest = statePackageInputDigest(inputBytes);
  manifest.next_state_root = statePackageStateRoot(manifest);
  const receipt = {
    chunk_count: manifest.chunks.length,
    format: "mortalos-state-package-receipt/1",
    genome_hash: manifest.genome_hash,
    next_state_root: manifest.next_state_root,
    prior_state_root: manifest.prior_state_root,
    resource_root: manifest.resource_root,
    resource_size: manifest.resource_size,
    storage_policy: manifest.storage_policy,
    transition_input_digest: manifest.transition_input_digest
  };
  const receiptBytes = canonicalBytes(receipt);
  manifest.receipt_digest = statePackageReceiptDigest(receiptBytes);
  const manifestBytes = canonicalBytes(manifest);
  return {
    inputBytes,
    manifest,
    manifestBytes,
    nextStateRoot: manifest.next_state_root,
    payload: {
      format: STATE_PACKAGE_TRANSITION_FORMAT,
      input_base64url: encodeBase64Url(inputBytes),
      manifest_base64url: encodeBase64Url(manifestBytes),
      receipt_base64url: encodeBase64Url(receiptBytes)
    },
    receiptBytes
  };
}

function assertPackageCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof StatePackageError);
    assert.equal(error.code, code);
    return true;
  });
}

async function distributedStores(statePackage) {
  const replicas = [
    new MemoryContentAddressedStore(),
    new MemoryContentAddressedStore(),
    new MemoryContentAddressedStore()
  ];
  const relay = new MemoryContentAddressedStore();
  for (const descriptor of statePackage.manifest.chunks) {
    const bytes = statePackage.chunkBytes[descriptor.index];
    await relay.put(descriptor.digest, bytes, descriptor.size);
    for (let replica = 0; replica < replicas.length; replica += 1) {
      if (descriptor.index % 3 === replica) continue;
      await replicas[replica].put(descriptor.digest, bytes, descriptor.size);
    }
  }
  return { relay, replicas };
}

function recoveryOptions(fixture, destination, sources) {
  return {
    destination,
    expectedGenomeHash: fixture.statePackage.manifest.genome_hash,
    expectedNextStateRoot: fixture.statePackage.nextStateRoot,
    expectedPriorStateRoot: fixture.statePackage.manifest.prior_state_root,
    inputBytes: fixture.inputBytes,
    manifestBytes: fixture.statePackage.manifestBytes,
    receiptBytes: fixture.statePackage.receiptBytes,
    sources
  };
}

test("canonical package binds manifest, receipt, and exact 1 MiB bytes", () => {
  const fixture = packageFixture();
  assert.equal(fixture.resourceBytes.byteLength, 1_048_576);
  assert.equal(fixture.statePackage.manifest.chunks.length, 16);
  assert.equal(new Set(fixture.statePackage.manifest.chunks.map(({ digest }) => digest)).size, 16);
  const verified = verifyStatePackage({
    expectedGenomeHash: fixture.statePackage.manifest.genome_hash,
    expectedNextStateRoot: fixture.statePackage.nextStateRoot,
    expectedPriorStateRoot: fixture.statePackage.manifest.prior_state_root,
    inputBytes: fixture.inputBytes,
    manifestBytes: fixture.statePackage.manifestBytes,
    receiptBytes: fixture.statePackage.receiptBytes
  });
  assert.equal(verified.manifest.resource_root, statePackageResourceRoot(fixture.resourceBytes));
});

test("package constructors and transition sidecars reject every bounded input class", () => {
  const fixture = packageFixture();
  const base = {
    genomeHash: fixture.statePackage.manifest.genome_hash,
    inputBytes: fixture.inputBytes,
    priorStateRoot: fixture.statePackage.manifest.prior_state_root,
    resourceBytes: fixture.resourceBytes
  };
  assertPackageCode(
    () => createStatePackageInput({ operation: "append" }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackageInput({ transitionId: "bad id" }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => deterministicReferenceResource(0),
    "E_STATE_PACKAGE_LIMIT_EXCEEDED"
  );
  assertPackageCode(
    () => statePackageChunkDigest(new Uint8Array(STATE_PACKAGE_LIMITS.chunk_bytes + 1)),
    "E_STATE_PACKAGE_LIMIT_EXCEEDED"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, resourceFormat: "application/gzip" }),
    "E_STATE_PACKAGE_DECODING_UNSUPPORTED"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, schemaVersion: "2" }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, resourceBytes: new Uint8Array() }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackage({
      ...base,
      resourceBytes: new Uint8Array(STATE_PACKAGE_LIMITS.chunk_bytes * 2)
    }),
    "E_STATE_PACKAGE_CHUNK_DUPLICATE"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, inputBytes: canonicalBytes({ format: "wrong", operation: "replace-resource", transition_id: "x" }) }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackage({
      ...base,
      inputBytes: canonicalBytes({
        format: "mortalos-state-package-input/1",
        operation: "replace-resource",
        transition_id: ""
      })
    }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, inputBytes: new Uint8Array([0xff]) }),
    "E_STATE_PACKAGE_INVALID"
  );
  assertPackageCode(
    () => createStatePackage({ ...base, inputBytes: new TextEncoder().encode('{ "format":"mortalos-state-package-input/1","operation":"replace-resource","transition_id":"x"}') }),
    "E_STATE_PACKAGE_INVALID"
  );
  const common = {
    expectedGenomeHash: fixture.statePackage.manifest.genome_hash,
    expectedNextStateRoot: fixture.statePackage.nextStateRoot,
    expectedPriorStateRoot: fixture.statePackage.manifest.prior_state_root,
    payload: fixture.statePackage.payload
  };
  for (const [mutate, code] of [
    [(payload) => { payload.format = "wrong"; }, "E_STATE_PACKAGE_INVALID"],
    [(payload) => { payload.input_base64url = 1; }, "E_STATE_PACKAGE_INVALID"],
    [(payload) => { payload.input_base64url = "*"; }, "E_STATE_PACKAGE_INVALID"],
    [(payload) => { payload.receipt_base64url = "A".repeat(6_000); }, "E_STATE_PACKAGE_LIMIT_EXCEEDED"]
  ]) {
    const payload = structuredClone(fixture.statePackage.payload);
    mutate(payload);
    assertPackageCode(
      () => verifyStatePackageTransitionPayload({ ...common, payload }),
      code
    );
  }
  assert.equal(fixture.statePackage.payload.format, STATE_PACKAGE_TRANSITION_FORMAT);
});

test("manifest, input, and receipt mutations have stable rejection precedence", () => {
  const fixture = packageFixture();
  const common = {
    expectedGenomeHash: fixture.statePackage.manifest.genome_hash,
    expectedNextStateRoot: fixture.statePackage.nextStateRoot,
    expectedPriorStateRoot: fixture.statePackage.manifest.prior_state_root,
    inputBytes: fixture.inputBytes,
    receiptBytes: fixture.statePackage.receiptBytes
  };
  for (const [mutate, code] of [
    [(value) => { value.format = "wrong"; }, "E_STATE_PACKAGE_INVALID"],
    [(value) => { value.schema_version = "2"; }, "E_STATE_PACKAGE_INVALID"],
    [(value) => { value.storage_policy = "wrong"; }, "E_STATE_PACKAGE_DECODING_UNSUPPORTED"],
    [(value) => { value.chunk_size = 1; }, "E_STATE_PACKAGE_LIMIT_EXCEEDED"],
    [(value) => { value.chunks = []; value.resource_size = 0; }, "E_STATE_PACKAGE_LIMIT_EXCEEDED"],
    [(value) => { value.chunks = Array.from({ length: 65 }, () => value.chunks[0]); }, "E_STATE_PACKAGE_LIMIT_EXCEEDED"],
    [(value) => { value.genome_hash = value.prior_state_root; }, "E_STATE_GENOME_MISMATCH"],
    [(value) => { value.receipt_digest = value.prior_state_root; }, "E_STATE_PACKAGE_RECEIPT_MISMATCH"]
  ]) {
    assertPackageCode(
      () => verifyStatePackage({
        ...common,
        manifestBytes: mutateManifest(fixture.statePackage, mutate)
      }),
      code
    );
  }
  const alternateInput = createStatePackageInput({ transitionId: "alternate" });
  assertPackageCode(
    () => verifyStatePackage({
      ...common,
      inputBytes: alternateInput,
      manifestBytes: fixture.statePackage.manifestBytes
    }),
    "E_STATE_PACKAGE_INPUT_MISMATCH"
  );
  for (const inputValue of [
    {
      format: "attacker-state-input/999",
      operation: "replace-resource",
      transition_id: "semantic-rebind"
    },
    {
      format: "mortalos-state-package-input/1",
      operation: "delete-authorized-resource",
      transition_id: "semantic-rebind"
    },
    {
      format: "mortalos-state-package-input/1",
      operation: "replace-resource",
      transition_id: ""
    }
  ]) {
    const rebound = rebindPackageInput(fixture.statePackage, inputValue);
    assert.throws(
      () => verifyStateTransitionPayload({
        expectedGenomeHash: rebound.manifest.genome_hash,
        expectedNextStateRoot: rebound.nextStateRoot,
        expectedPriorStateRoot: rebound.manifest.prior_state_root,
        genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
        payload: rebound.payload
      }),
      (error) => {
        assert.equal(error.code, "E_STATE_PACKAGE_INVALID");
        return true;
      }
    );
  }
  const receipt = JSON.parse(new TextDecoder().decode(fixture.statePackage.receiptBytes));
  receipt.chunk_count -= 1;
  assertPackageCode(
    () => verifyStatePackage({
      ...common,
      manifestBytes: fixture.statePackage.manifestBytes,
      receiptBytes: canonicalBytes(receipt)
    }),
    "E_STATE_PACKAGE_RECEIPT_MISMATCH"
  );
});

test("mortalos/1 lineage accepts the exact package manifest and receipt only", () => {
  const fixture = packageFixture();
  const actors = Array.from({ length: 3 }, actor).sort(
    (a, b) => a.key_id < b.key_id ? -1 : 1
  );
  const custodians = actors.map(({ key_id, public_key }) => ({ key_id, public_key }));
  const body = {
    genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
    genome_hash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
    hash_algorithm: "sha-256",
    initial_custodians: custodians,
    initial_quorum: { threshold: 2, type: "threshold" },
    initial_state_base64url: encodeBase64Url(fixture.initial),
    initial_state_root: stateRoot(fixture.initial),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(4))}`,
    protocol_version: "mortalos/1",
    signature_algorithm: "ed25519"
  };
  const birth = {
    approvals: actors.map((entry) => signature(entry, genesisApprovalMessage(body))),
    body,
    kind: "mortalos.genesis"
  };
  const opened = createLineage(canonicalBytes(birth));
  assert.equal(opened.status, "accept");
  const parent = opened.lineage.head;
  const pulseBody = {
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    event: {
      kind: "state-transition",
      payload_hash: eventPayloadHash(fixture.statePackage.payload)
    },
    genome_hash: opened.lineage.genesis.genome_hash,
    next_custodians: parent.next_custody_descriptor.custodians,
    next_quorum: parent.next_custody_descriptor.quorum,
    organism_id: opened.lineage.genesis.organism_id,
    parent_hash: parent.object_hash,
    protocol_version: "mortalos/1",
    sequence: "1",
    state_root: fixture.statePackage.nextStateRoot
  };
  const envelope = {
    acceptances: [],
    approvals: actors.slice(0, 2).map((entry) => signature(entry, pulseApprovalMessage(pulseBody))),
    body: pulseBody,
    kind: "mortalos.pulse"
  };
  const accepted = opened.lineage.append({
    envelopeBytes: canonicalBytes(envelope),
    eventPayloadBytes: canonicalBytes(fixture.statePackage.payload)
  });
  assert.equal(accepted.status, "accept");
  const second = createLineage(canonicalBytes(birth));
  const badPayload = structuredClone(fixture.statePackage.payload);
  const receipt = JSON.parse(
    new TextDecoder().decode(decodeBase64Url(badPayload.receipt_base64url))
  );
  receipt.resource_size -= 1;
  badPayload.receipt_base64url = encodeBase64Url(canonicalBytes(receipt));
  const badBody = structuredClone(pulseBody);
  badBody.event.payload_hash = eventPayloadHash(badPayload);
  const badEnvelope = {
    ...envelope,
    approvals: actors.slice(0, 2).map((entry) => signature(entry, pulseApprovalMessage(badBody))),
    body: badBody
  };
  assert.equal(second.lineage.append({
    envelopeBytes: canonicalBytes(badEnvelope),
    eventPayloadBytes: canonicalBytes(badPayload)
  }).code, "E_STATE_PACKAGE_RECEIPT_MISMATCH");

  const attackerPackage = rebindPackageInput(fixture.statePackage, {
    format: "attacker-state-input/999",
    operation: "delete-authorized-resource",
    transition_id: ""
  });
  const attackerBody = {
    ...structuredClone(pulseBody),
    event: {
      kind: "state-transition",
      payload_hash: eventPayloadHash(attackerPackage.payload)
    },
    state_root: attackerPackage.nextStateRoot
  };
  const attackerEnvelope = {
    ...envelope,
    approvals: actors.slice(0, 2).map(
      (entry) => signature(entry, pulseApprovalMessage(attackerBody))
    ),
    body: attackerBody
  };
  const third = createLineage(canonicalBytes(birth));
  assert.equal(third.lineage.append({
    envelopeBytes: canonicalBytes(attackerEnvelope),
    eventPayloadBytes: canonicalBytes(attackerPackage.payload)
  }).code, "E_STATE_PACKAGE_INVALID");
});

test("any two replicas recover exact bytes after the third replica and relay are deleted", async () => {
  const fixture = packageFixture();
  for (let lost = 0; lost < 3; lost += 1) {
    const { relay, replicas } = await distributedStores(fixture.statePackage);
    relay.destroy();
    replicas[lost].destroy();
    const destination = new MemoryContentAddressedStore();
    const sources = replicas
      .filter((_, index) => index !== lost)
      .map((store) => new ReplicaRecoveryAdapter(store));
    const recovered = await recoverStatePackage(recoveryOptions(fixture, destination, sources));
    assert.equal(recovered.status, "available", `lost replica ${lost}`);
    assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
    assert.equal(recovered.resource_root, fixture.statePackage.manifest.resource_root);
  }
});

test("missing chunks remain state_unavailable and never replace the last verified state", async () => {
  const fixture = packageFixture();
  const source = new MemoryContentAddressedStore();
  for (const descriptor of fixture.statePackage.manifest.chunks.slice(1)) {
    await source.put(
      descriptor.digest,
      fixture.statePackage.chunkBytes[descriptor.index],
      descriptor.size
    );
  }
  const destination = new MemoryContentAddressedStore();
  await destination.commitActive({
    next_state_root: fixture.statePackage.manifest.prior_state_root,
    status: "verified"
  });
  const before = destination.active;
  const recovered = await recoverStatePackage(
    recoveryOptions(fixture, destination, [new ReplicaRecoveryAdapter(source)])
  );
  assert.equal(recovered.status, "state_unavailable");
  assert.equal(recovered.code, "E_STATE_UNAVAILABLE");
  assert.deepEqual(destination.active, before);
});

test("manifest and fetch adversaries fail with stable bounded results", async () => {
  const fixture = packageFixture();
  const cases = [
    ["reordered", (value) => { [value.chunks[0], value.chunks[1]] = [value.chunks[1], value.chunks[0]]; }, "E_STATE_PACKAGE_CHUNK_ORDER"],
    ["duplicate", (value) => { value.chunks[1].digest = value.chunks[0].digest; }, "E_STATE_PACKAGE_CHUNK_DUPLICATE"],
    ["wrong-size", (value) => { value.chunks[0].size -= 1; }, "E_STATE_PACKAGE_CHUNK_SIZE"],
    ["wrong-manifest", (value) => { value.resource_root = value.prior_state_root; }, "E_STATE_NEXT_ROOT_MISMATCH"],
    ["stale-root", (value) => { value.prior_state_root = value.resource_root; }, "E_STATE_PACKAGE_STALE_ROOT"],
    ["oversized", (value) => { value.resource_size = STATE_PACKAGE_LIMITS.resource_bytes + 1; }, "E_STATE_PACKAGE_LIMIT_EXCEEDED"],
    ["decoding-bomb", (value) => { value.compression = "gzip"; }, "E_STATE_PACKAGE_DECODING_UNSUPPORTED"]
  ];
  for (const [name, mutate, code] of cases) {
    const destination = new MemoryContentAddressedStore();
    const recovered = await recoverStatePackage({
      ...recoveryOptions(fixture, destination, []),
      manifestBytes: mutateManifest(fixture.statePackage, mutate)
    });
    assert.equal(recovered.code, code, name);
    assert.equal(destination.active, null, name);
  }
  const descriptors = fixture.statePackage.manifest.chunks;
  const changed = new Uint8Array(fixture.statePackage.chunkBytes[0]);
  changed[0] ^= 1;
  const badSource = {
    async inventory() { return descriptors.map(({ digest }) => digest); },
    async readChunk(digest) {
      const index = descriptors.findIndex((entry) => entry.digest === digest);
      return index === 0 ? changed : fixture.statePackage.chunkBytes[index];
    }
  };
  const tampered = await recoverStatePackage(
    recoveryOptions(fixture, new MemoryContentAddressedStore(), [badSource])
  );
  assert.equal(tampered.code, "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH");
  const excessiveSources = await recoverStatePackage(
    recoveryOptions(
      fixture,
      new MemoryContentAddressedStore(),
      Array.from({ length: 9 }, () => badSource)
    )
  );
  assert.equal(excessiveSources.code, "E_STATE_PACKAGE_LIMIT_EXCEEDED");
  const oversizedInventory = {
    async inventory() { return Array.from({ length: 65 }, (_, index) => `invalid-${index}`); },
    async readChunk() { throw new Error("chunk read must not run"); }
  };
  const excessiveInventory = await recoverStatePackage(
    recoveryOptions(fixture, new MemoryContentAddressedStore(), [oversizedInventory])
  );
  assert.equal(excessiveInventory.code, "E_STATE_PACKAGE_LIMIT_EXCEEDED");
});

test("recovery is resumable and idempotent without replacing the prior active state", async () => {
  const fixture = packageFixture();
  const source = new MemoryContentAddressedStore();
  for (const descriptor of fixture.statePackage.manifest.chunks) {
    await source.put(descriptor.digest, fixture.statePackage.chunkBytes[descriptor.index], descriptor.size);
  }
  let writes = 0;
  const destination = new MemoryContentAddressedStore({
    fault: (boundary) => {
      if (boundary === "chunk:after" && ++writes === 3) throw new Error("forced-stop");
    }
  });
  await destination.commitActive({
    next_state_root: fixture.statePackage.manifest.prior_state_root,
    status: "verified"
  });
  const before = destination.active;
  const first = await recoverStatePackage(
    recoveryOptions(fixture, destination, [new ReplicaRecoveryAdapter(source)])
  );
  assert.equal(first.code, "E_STATE_RECOVERY_INTERRUPTED");
  assert.deepEqual(destination.active, before);
  assert.equal((await destination.inventory()).length, 3);
  destination.clearFault();
  const second = await recoverStatePackage(
    recoveryOptions(fixture, destination, [new ReplicaRecoveryAdapter(source)])
  );
  assert.equal(second.status, "available");
  const active = destination.active;
  const third = await recoverStatePackage(
    recoveryOptions(fixture, destination, [new ReplicaRecoveryAdapter(source)])
  );
  assert.equal(third.status, "available");
  assert.deepEqual(destination.active, active);

  for (const boundary of ["active:before", "active:after"]) {
    const atomicDestination = new MemoryContentAddressedStore();
    for (const descriptor of fixture.statePackage.manifest.chunks) {
      await atomicDestination.put(
        descriptor.digest,
        fixture.statePackage.chunkBytes[descriptor.index],
        descriptor.size
      );
    }
    await atomicDestination.commitActive({
      next_state_root: fixture.statePackage.manifest.prior_state_root,
      status: "verified"
    });
    const priorActive = atomicDestination.active;
    atomicDestination.setFault((observed) => {
      if (observed === boundary) throw new Error(`forced-${boundary}`);
    });
    const interrupted = await recoverStatePackage(
      recoveryOptions(fixture, atomicDestination, [])
    );
    assert.deepEqual(interrupted, {
      code: "E_STATE_RECOVERY_INTERRUPTED",
      detail: `forced-${boundary}`,
      status: "interrupted"
    });
    assert.deepEqual(atomicDestination.active, priorActive, boundary);
    atomicDestination.clearFault();
    assert.equal(
      (await recoverStatePackage(recoveryOptions(fixture, atomicDestination, []))).status,
      "available"
    );
  }
});

test("adapter read interruption is stable and preserves the prior active state", async () => {
  const fixture = packageFixture();
  const destination = new MemoryContentAddressedStore();
  await destination.commitActive({
    next_state_root: fixture.statePackage.manifest.prior_state_root,
    status: "verified"
  });
  const before = destination.active;
  const source = {
    async inventory() {
      return fixture.statePackage.manifest.chunks.map(({ digest }) => digest);
    },
    async readChunk() {
      throw new Error("adapter-offline");
    }
  };
  const recovered = await recoverStatePackage(
    recoveryOptions(fixture, destination, [source])
  );
  assert.deepEqual(recovered, {
    code: "E_STATE_RECOVERY_INTERRUPTED",
    detail: "adapter-offline",
    status: "interrupted"
  });
  assert.deepEqual(destination.active, before);
});

test("store and destination failure boundaries remain stable before activation", async () => {
  const fixture = packageFixture();
  const first = fixture.statePackage.manifest.chunks[0];
  const firstBytes = fixture.statePackage.chunkBytes[0];
  const store = new MemoryContentAddressedStore();
  await assert.rejects(store.put(first.digest, firstBytes, first.size - 1), /chunk-size/u);
  const changed = new Uint8Array(firstBytes);
  changed[0] ^= 1;
  await assert.rejects(store.put(first.digest, changed, first.size), /chunk-digest/u);
  store.setFault(() => {});
  store.clearFault();
  store.destroy();
  assert.deepEqual(await store.inventory(), []);
  assert.equal(await store.get(first.digest), null);
  await assert.rejects(store.put(first.digest, firstBytes, first.size), /store-destroyed/u);
  await assert.rejects(store.commitActive({ next_state_root: "x" }), /store-destroyed/u);

  const invalidSources = await recoverStatePackage({
    ...recoveryOptions(fixture, new MemoryContentAddressedStore(), []),
    sources: null
  });
  assert.equal(invalidSources.code, "E_STATE_PACKAGE_LIMIT_EXCEEDED");

  const inventoryFailure = await recoverStatePackage(
    recoveryOptions(fixture, new MemoryContentAddressedStore(), [{
      async inventory() { throw new Error("inventory-offline"); },
      async readChunk() { return null; }
    }])
  );
  assert.equal(inventoryFailure.code, "E_STATE_PACKAGE_INTERNAL");

  const advertisedMissing = await recoverStatePackage(
    recoveryOptions(fixture, new MemoryContentAddressedStore(), [{
      async inventory() {
        return fixture.statePackage.manifest.chunks.map(({ digest }) => digest);
      },
      async readChunk() { return null; }
    }])
  );
  assert.equal(advertisedMissing.code, "E_STATE_UNAVAILABLE");

  const hostileBytes = await recoverStatePackage(
    recoveryOptions(fixture, new MemoryContentAddressedStore(), [{
      async inventory() {
        return fixture.statePackage.manifest.chunks.map(({ digest }) => digest);
      },
      async readChunk() {
        return Object.defineProperty({}, "byteLength", {
          get() { throw new Error("hostile-bytes"); }
        });
      }
    }])
  );
  assert.equal(hostileBytes.code, "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH");

  const fullInventory = fixture.statePackage.manifest.chunks.map(({ digest }) => digest);
  const chunkFor = (digest) => {
    const index = fixture.statePackage.manifest.chunks.findIndex((entry) => entry.digest === digest);
    return fixture.statePackage.chunkBytes[index];
  };
  const throwingGet = {
    async inventory() { return fullInventory; },
    async get() { throw new Error("destination-offline"); },
    async put() { throw new Error("unexpected-put"); },
    async commitActive() { throw new Error("unexpected-commit"); },
    async readActive() { return null; }
  };
  assert.equal(
    (await recoverStatePackage(recoveryOptions(fixture, throwingGet, []))).code,
    "E_STATE_RECOVERY_INTERRUPTED"
  );
  const missingGet = {
    ...throwingGet,
    async get() { return null; }
  };
  assert.equal(
    (await recoverStatePackage(recoveryOptions(fixture, missingGet, []))).code,
    "E_STATE_UNAVAILABLE"
  );
  const corruptGet = {
    ...throwingGet,
    async get(digest) {
      const bytes = new Uint8Array(chunkFor(digest));
      bytes[0] ^= 1;
      return bytes;
    }
  };
  assert.equal(
    (await recoverStatePackage(recoveryOptions(fixture, corruptGet, []))).code,
    "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH"
  );
  const commitFailure = {
    ...throwingGet,
    async get(digest) { return chunkFor(digest); },
    async commitActive() { throw new Error("commit-offline"); }
  };
  assert.equal(
    (await recoverStatePackage(recoveryOptions(fixture, commitFailure, []))).code,
    "E_STATE_RECOVERY_INTERRUPTED"
  );
});

test("aggregate resource verification is independent from valid chunk digests", async () => {
  const fixture = packageFixture();
  const manifest = structuredClone(fixture.statePackage.manifest);
  manifest.resource_root = manifest.prior_state_root;
  manifest.next_state_root = statePackageStateRoot(manifest);
  const receipt = {
    chunk_count: manifest.chunks.length,
    format: "mortalos-state-package-receipt/1",
    genome_hash: manifest.genome_hash,
    next_state_root: manifest.next_state_root,
    prior_state_root: manifest.prior_state_root,
    resource_root: manifest.resource_root,
    resource_size: manifest.resource_size,
    storage_policy: manifest.storage_policy,
    transition_input_digest: manifest.transition_input_digest
  };
  const receiptBytes = canonicalBytes(receipt);
  manifest.receipt_digest = statePackageReceiptDigest(receiptBytes);
  const destination = new MemoryContentAddressedStore();
  for (const descriptor of manifest.chunks) {
    await destination.put(
      descriptor.digest,
      fixture.statePackage.chunkBytes[descriptor.index],
      descriptor.size
    );
  }
  const recovered = await recoverStatePackage({
    destination,
    expectedGenomeHash: manifest.genome_hash,
    expectedNextStateRoot: manifest.next_state_root,
    expectedPriorStateRoot: manifest.prior_state_root,
    inputBytes: fixture.inputBytes,
    manifestBytes: canonicalBytes(manifest),
    receiptBytes,
    sources: []
  });
  assert.equal(recovered.code, "E_STATE_PACKAGE_RESOURCE_ROOT_MISMATCH");
  assert.equal(destination.active, null);
});

test("10,000 seeded loss, reorder, duplicate, partial, and tamper recoveries execute end to end without metadata-only acceptance", async () => {
  const fixture = recoveryMatrixFixture();
  const descriptors = fixture.statePackage.manifest.chunks;
  const digests = descriptors.map(({ digest }) => digest);
  let seed = 0x53335233;
  const outcomes = {
    available: 0,
    interrupted: 0,
    rejected: 0,
    state_unavailable: 0
  };

  async function executeSchedule({ index, scheduleSeed }) {
    const mode = index % 5;
    const lost = scheduleSeed % 3;
    const target = (scheduleSeed >>> 8) % digests.length;
    const destination = new MemoryContentAddressedStore();
    await destination.commitActive({
      next_state_root: fixture.statePackage.manifest.prior_state_root,
      status: "verified"
    });
    const priorActive = destination.active;
    if ((scheduleSeed & 32) !== 0) {
      const cached = descriptors[(target + 1) % descriptors.length];
      await destination.put(
        cached.digest,
        fixture.statePackage.chunkBytes[cached.index],
        cached.size
      );
    }
    const sources = [0, 1, 2]
      .filter((replica) => replica !== lost)
      .map((replica, sourceIndex) => {
        let inventory = descriptors
          .filter(({ index: chunkIndex }) => chunkIndex % 3 !== replica)
          .map(({ digest }) => digest);
        if (mode === 1) inventory = inventory.filter((digest) => digest !== digests[target]);
        if (mode >= 2 && !inventory.includes(digests[target])) {
          inventory.push(digests[target]);
        }
        if ((scheduleSeed & 4) !== 0) inventory.reverse();
        if ((scheduleSeed & 8) !== 0 && inventory.length > 0) {
          inventory.push(inventory[0]);
        }
        return {
          async inventory() {
            return [...inventory];
          },
          async readChunk(digest) {
            const descriptor = descriptors.find((entry) => entry.digest === digest);
            if (!descriptor) return null;
            if (descriptor.index === target) {
              if (mode === 2) {
                const changed = new Uint8Array(
                  fixture.statePackage.chunkBytes[descriptor.index]
                );
                changed[0] ^= 1;
                return changed;
              }
              if (mode === 3) return null;
              if (mode === 4 && sourceIndex === 0) {
                throw new Error("seeded-source-interruption");
              }
            }
            return fixture.statePackage.chunkBytes[descriptor.index];
          }
        };
      });
    const recovered = await recoverStatePackage(
      recoveryOptions(fixture, destination, sources)
    );
    const expected = [
      ["available", null],
      ["state_unavailable", "E_STATE_UNAVAILABLE"],
      ["rejected", "E_STATE_PACKAGE_CHUNK_DIGEST_MISMATCH"],
      ["state_unavailable", "E_STATE_UNAVAILABLE"],
      ["interrupted", "E_STATE_RECOVERY_INTERRUPTED"]
    ][mode];
    assert.deepEqual([recovered.status, recovered.code], expected, `schedule ${index}`);
    if (mode === 0) {
      assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes, `schedule ${index}`);
      assert.equal(destination.active.next_state_root, fixture.statePackage.nextStateRoot);
    } else {
      assert.deepEqual(destination.active, priorActive, `schedule ${index}`);
    }
    return {
      active_root: destination.active.next_state_root,
      code: recovered.code,
      inventory: await destination.inventory(),
      mode,
      status: recovered.status
    };
  }

  for (let index = 0; index < 10_000; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const left = await executeSchedule({ index, scheduleSeed: seed });
    const right = await executeSchedule({ index, scheduleSeed: seed });
    assert.deepEqual(left, right, `schedule ${index}`);
    outcomes[left.status] += 1;
  }
  assert.deepEqual(outcomes, {
    available: 2000,
    interrupted: 2000,
    rejected: 2000,
    state_unavailable: 4000
  });
});
