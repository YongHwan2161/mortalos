import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBase64Url,
  encodeBase64Url
} from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import {
  LinearizableCounterAuthority,
  MemoryCounterAuthorityStore,
  createCounterAuthorityFacade,
  generateCounterAuthorityKeyMaterial,
  observeCounterAuthorityEquivocation,
  deriveConfidentialEpochId
} from "../src/confidential/counter.mjs";
import {
  plaintextCommitment,
  randomTagged,
  domainHash,
  CONFIDENTIAL_DOMAINS,
  CONFIDENTIAL_LIMITS
} from "../src/confidential/format.mjs";
import {
  generateCustodianEncryptionKeyPair,
  generateStagingEpochKey,
  importCustodianPublicKey,
  unwrapEpochKey,
  wrapEpochKey
} from "../src/confidential/keys.mjs";
import {
  createConfidentialPackage,
  decryptConfidentialPackage,
  decryptConfidentialPackageForRecovery,
  verifyConfidentialPackage
} from "../src/confidential/package.mjs";
import {
  MemoryConfidentialEpochStore,
  rotateConfidentialState,
  validateConfidentialRotationInput,
  verifyConfidentialRotationAuthorization
} from "../src/confidential/recovery.mjs";
import {
  createConfidentialFixture,
  createNextMembershipHead,
  createRotationAuthorization,
  deterministicSecret,
  keyPairFor
} from "./confidential-helpers.mjs";

let fixturePromise;
function fixture() {
  fixturePromise ??= createConfidentialFixture();
  return fixturePromise;
}

function rotationInput({
  approvedMembershipHead,
  current,
  nextAuthority,
  nextCustodians,
  reason,
  toEpoch = "1"
}) {
  return {
    approved_membership_head: approvedMembershipHead,
    current_membership_head: current.membershipHead,
    format: "mortalos-confidential-rotation/1",
    from_epoch: current.epoch,
    next_authority_id: nextAuthority.descriptor.authority_id,
    next_custodian_key_digests: nextCustodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    reason,
    suite: "mortalos-confidential-state-suite/1",
    to_epoch: toEpoch
  };
}

test("ciphertext package round-trips only for exact current custodians with non-extractable keys", async () => {
  const value = await fixture();
  const verified = verifyConfidentialPackage({
    expectedCustodians: value.custodians,
    expectedEpochId: value.epochId,
    expectedMembershipHead: value.membershipHead,
    expectedOrganismId: value.organismId,
    expectedPriorConfidentialRoot: value.priorConfidentialRoot,
    expectedResourceId: value.resourceId,
    packageBytes: value.confidentialPackage.packageBytes
  });
  assert.equal(
    verified.confidentialRoot,
    value.confidentialPackage.confidentialRoot
  );
  for (const custodian of value.custodians) {
    const keyPair = keyPairFor(value, custodian);
    const options = {
      custodian,
      expectedCustodians: value.custodians,
      packageBytes: value.confidentialPackage.packageBytes,
      privateKey: keyPair.privateKey
    };
    const publicDecrypted = await decryptConfidentialPackage(options);
    assert.deepEqual(publicDecrypted.resource_bytes, value.resourceBytes);
    assert.equal(Object.hasOwn(publicDecrypted, "epoch_key"), false);
    const decrypted = await decryptConfidentialPackageForRecovery(options);
    assert.deepEqual(decrypted.resource_bytes, value.resourceBytes);
    assert.equal(decrypted.epoch_key.extractable, false);
    assert.deepEqual([...decrypted.epoch_key.usages], ["decrypt"]);
    await assert.rejects(
      crypto.subtle.encrypt(
        {
          additionalData: new Uint8Array(),
          iv: new Uint8Array(12),
          name: "AES-GCM",
          tagLength: 128
        },
        decrypted.epoch_key,
        new Uint8Array([1])
      ),
      /requested operation is not valid|InvalidAccessError/u
    );
    await assert.rejects(
      crypto.subtle.exportKey("raw", decrypted.epoch_key),
      /key is not extractable|InvalidAccessException/u
    );
    assert.equal(keyPair.privateKey.extractable, false);
    await assert.rejects(
      crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
      /key is not extractable|InvalidAccessException/u
    );
  }
});

test("relay/store capture contains no plaintext marker or public plaintext commitment", async () => {
  const value = await fixture();
  const capture = value.confidentialPackage.packageBytes;
  const marker = new TextEncoder().encode(
    "MORTALOS-S4-PLAINTEXT-MARKER-DO-NOT-LEAK:"
  );
  assert.equal(Buffer.from(capture).includes(Buffer.from(marker)), false);
  assert.equal(
    new TextDecoder().decode(capture).includes(
      plaintextCommitment(value.resourceBytes)
    ),
    false
  );
  const parsed = verifyConfidentialPackage({ packageBytes: capture });
  assert.equal(parsed.manifest.chunks.length, 3);
  assert.equal(parsed.manifest.wraps.length, 3);
  assert.ok(
    parsed.manifest.chunks.every(
      ({ ciphertext_bytes, aad }) =>
        ciphertext_bytes === aad.plaintext_bytes + 16
    )
  );
});

test("public-key substitution, malformed SPKI, wrap misuse, label mismatch, and wrong private key collapse closed", async () => {
  const value = await fixture();
  const custodian = value.custodians[0];
  const pair = keyPairFor(value, custodian);
  const changedDigest = {
    ...custodian,
    encryption_key_digest: randomTagged("sha256:")
  };
  await assert.rejects(
    importCustodianPublicKey(changedDigest),
    /E_CONFIDENTIAL_KEY/u
  );
  const spki = decodeBase64Url(custodian.encryption_public_key.slice(5));
  const malformedSpki = new Uint8Array(spki);
  malformedSpki[0] ^= 1;
  await assert.rejects(
    importCustodianPublicKey({
      ...custodian,
      encryption_key_digest: domainHash(
        CONFIDENTIAL_DOMAINS.encryption_key,
        malformedSpki
      ),
      encryption_public_key: `spki:${encodeBase64Url(malformedSpki)}`
    }),
    /E_CONFIDENTIAL_KEY/u
  );
  await assert.rejects(
    wrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      stagingKey: pair.publicKey
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
  const stagingKey = await generateStagingEpochKey();
  const wrap = await wrapEpochKey({
    custodian,
    epoch: value.epoch,
    epochId: value.epochId,
    membershipHead: value.membershipHead,
    organismId: value.organismId,
    stagingKey
  });
  await assert.rejects(
    unwrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      privateKey: pair.privateKey,
      wrap: { ...wrap, label_digest: randomTagged("sha256:") }
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
  await assert.rejects(
    unwrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      privateKey: pair.privateKey,
      wrap: { ...wrap, format: "mortalos-epoch-key-wrap/2" }
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
  await assert.rejects(
    unwrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      privateKey: pair.privateKey,
      wrap: { ...wrap, wrapped_epoch_key_base64url: "bad" }
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
  await assert.rejects(
    unwrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      privateKey: value.keyPairs.find(
        ({ descriptor }) =>
          descriptor.custodian_id !== custodian.custodian_id
      ).privateKey,
      wrap
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
  await assert.rejects(
    unwrapEpochKey({
      custodian,
      epoch: value.epoch,
      epochId: value.epochId,
      membershipHead: value.membershipHead,
      organismId: value.organismId,
      privateKey: null,
      wrap
    }),
    /E_CONFIDENTIAL_WRAP/u
  );
});

test("wrap and rotation validators detach nested caller state before suspension or reuse", async () => {
  const value = await fixture();
  const originalCustodian = value.custodians[0];
  const mutableCustodian = { ...originalCustodian };
  const stagingKey = await generateStagingEpochKey();
  const pendingWrap = wrapEpochKey({
    custodian: mutableCustodian,
    epoch: value.epoch,
    epochId: value.epochId,
    membershipHead: value.membershipHead,
    organismId: value.organismId,
    stagingKey
  });
  mutableCustodian.custodian_id = randomTagged("mortalos-key:");
  mutableCustodian.encryption_key_digest = randomTagged("sha256:");
  const wrapped = await pendingWrap;
  assert.equal(wrapped.custodian_id, originalCustodian.custodian_id);
  assert.equal(
    wrapped.custodian_encryption_key,
    originalCustodian.encryption_key_digest
  );

  const digest = randomTagged("sha256:");
  const digests = [digest];
  const rotation = {
    approved_membership_head: randomTagged("sha256:"),
    current_membership_head: randomTagged("sha256:"),
    format: "mortalos-confidential-rotation/1",
    from_epoch: "0",
    next_authority_id: randomTagged("sha256:"),
    next_custodian_key_digests: digests,
    reason: "counter_authority_lost",
    suite: "mortalos-confidential-state-suite/1",
    to_epoch: "1"
  };
  const ownedRotation = validateConfidentialRotationInput(rotation);
  digests[0] = randomTagged("sha256:");
  rotation.reason = "membership_change";
  assert.equal(ownedRotation.next_custodian_key_digests[0], digest);
  assert.equal(ownedRotation.reason, "counter_authority_lost");
  assert.notEqual(ownedRotation, rotation);
});

test("tamper, substitution, truncation, reorder, duplicate wrap, and wrong binding release no plaintext", async () => {
  const value = await fixture();
  const original = value.confidentialPackage.package;
  const custodian = value.custodians[0];
  const privateKey = keyPairFor(value, custodian).privateKey;
  const mutations = [];

  const ciphertext = structuredClone(original);
  const changedCiphertext = decodeBase64Url(
    ciphertext.manifest.chunks[1].ciphertext_base64url
  );
  changedCiphertext[0] ^= 0x01;
  ciphertext.manifest.chunks[1].ciphertext_base64url =
    encodeBase64Url(changedCiphertext);
  mutations.push(ciphertext);

  const aad = structuredClone(original);
  aad.manifest.chunks[1].aad.plaintext_bytes -= 1;
  mutations.push(aad);

  const iv = structuredClone(original);
  iv.manifest.chunks[1].iv_base64url =
    iv.manifest.chunks[0].iv_base64url;
  mutations.push(iv);

  const reordered = structuredClone(original);
  [reordered.manifest.chunks[0], reordered.manifest.chunks[1]] = [
    reordered.manifest.chunks[1],
    reordered.manifest.chunks[0]
  ];
  mutations.push(reordered);

  const duplicateWrap = structuredClone(original);
  duplicateWrap.manifest.wraps[1] = structuredClone(
    duplicateWrap.manifest.wraps[0]
  );
  mutations.push(duplicateWrap);

  const wrongEpoch = structuredClone(original);
  wrongEpoch.manifest.epoch = "1";
  mutations.push(wrongEpoch);

  for (const mutation of mutations) {
    await assert.rejects(
      decryptConfidentialPackage({
        custodian,
        packageBytes: canonicalBytes(mutation),
        privateKey
      }),
      /E_CONFIDENTIAL_/u
    );
  }
  await assert.rejects(
    decryptConfidentialPackage({
      custodian,
      packageBytes: value.confidentialPackage.packageBytes.slice(0, -1),
      privateKey
    }),
    /E_CONFIDENTIAL_/u
  );
  await assert.rejects(
    decryptConfidentialPackage({
      custodian,
      expectedResourceId: randomTagged("mortalos-resource:"),
      packageBytes: value.confidentialPackage.packageBytes,
      privateKey
    }),
    /E_CONFIDENTIAL_BINDING/u
  );
});

test("constructor limits, membership uniqueness, unknown formats, and numeric epochs reject before acceptance", async () => {
  const value = await fixture();
  const base = {
    authority: value.authority,
    custodians: value.custodians,
    epoch: value.epoch,
    epochId: value.epochId,
    membershipHead: value.membershipHead,
    organismId: value.organismId,
    priorConfidentialRoot: value.priorConfidentialRoot,
    resourceId: value.resourceId,
    transitionId: value.transitionId
  };
  await assert.rejects(
    createConfidentialPackage({ ...base, resourceBytes: new Uint8Array() }),
    /E_CONFIDENTIAL_LIMIT/u
  );
  await assert.rejects(
    createConfidentialPackage({
      ...base,
      custodians: [value.custodians[0], value.custodians[0]],
      resourceBytes: new Uint8Array([1])
    }),
    /E_CONFIDENTIAL_MEMBERSHIP/u
  );
  await assert.rejects(
    createConfidentialPackage({
      ...base,
      custodians: [
        {
          ...value.custodians[0],
          extra: true
        }
      ],
      resourceBytes: new Uint8Array([1])
    }),
    /E_CONFIDENTIAL_FORMAT/u
  );
  const localAuthority = await LinearizableCounterAuthority.create();
  let localReserveCalls = 0;
  await assert.rejects(
    createConfidentialPackage({
      ...base,
      authority: {
        descriptor: localAuthority.descriptor,
        async reserveRange(input) {
          localReserveCalls += 1;
          return localAuthority.reserveRange(input);
        }
      },
      resourceBytes: new Uint8Array([1])
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.equal(
    localReserveCalls,
    0,
    "a failover-local authority must reject before reservation or encryption"
  );
  let forgedReserveCalls = 0;
  await assert.rejects(
    createConfidentialPackage({
      ...base,
      authority: {
        descriptor: value.authority.descriptor,
        async reserveRange(input) {
          forgedReserveCalls += 1;
          return value.authority.reserveRange(input);
        }
      },
      resourceBytes: new Uint8Array([1])
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.equal(
    forgedReserveCalls,
    0,
    "package creation must dispatch only through a branded authority capability"
  );
  const replacementCustodian = await generateCustodianEncryptionKeyPair(
    randomTagged("mortalos-key:")
  );
  const mutableCustodians = [...value.custodians];
  const expectedRecipientIds = mutableCustodians
    .map(({ custodian_id: id }) => id)
    .sort();
  const localEpochId = deriveConfidentialEpochId({
    authorityId: localAuthority.descriptor.authority_id,
    authorityPublicKey: localAuthority.descriptor.authority_public_key,
    custodianEncryptionKeys: mutableCustodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch: base.epoch,
    membershipHead: base.membershipHead,
    organismId: base.organismId,
    transitionId: base.transitionId
  });
  let membershipMutated = false;
  const ownedMembershipPackage = await createConfidentialPackage({
    ...base,
    authority: localAuthority,
    custodians: mutableCustodians,
    epochId: localEpochId,
    fault: async (step) => {
      if (step === "counter:committed") {
        mutableCustodians.splice(0, 1, replacementCustodian.descriptor);
        membershipMutated = true;
      }
    },
    resourceBytes: new Uint8Array([1])
  });
  assert.equal(membershipMutated, true);
  assert.deepEqual(
    ownedMembershipPackage.manifest.wraps.map(({ custodian_id: id }) => id),
    expectedRecipientIds
  );
  assert.equal(
    ownedMembershipPackage.manifest.wraps.some(
      ({ custodian_id: id }) => id === replacementCustodian.descriptor.custodian_id
    ),
    false
  );
  for (const [path, replacement] of [
    ["format", "mortalos-confidential-package/2"],
    ["manifest.format", "mortalos-confidential-package-manifest/2"],
    ["manifest.suite", "mortalos-confidential-state-suite/2"],
    ["manifest.epoch", 0],
    ["manifest.transition_id", "substituted-transition"],
    ["manifest.count", "64"],
    ["manifest.confidential_root", randomTagged("sha256:")],
    ["receipt.format", "mortalos-confidential-transition-receipt/2"]
  ]) {
    const changed = structuredClone(value.confidentialPackage.package);
    const segments = path.split(".");
    let target = changed;
    for (const segment of segments.slice(0, -1)) target = target[segment];
    target[segments.at(-1)] = replacement;
    assert.throws(
      () =>
        verifyConfidentialPackage({
          packageBytes: canonicalBytes(changed)
        }),
      /E_CONFIDENTIAL_/u,
      path
    );
  }
});

test("maximum S4 resource stays inside the S3 package ceiling for sixteen custodians", async () => {
  const base = await fixture();
  const keyPairs = [...base.keyPairs];
  while (keyPairs.length < CONFIDENTIAL_LIMITS.max_custodians) {
    keyPairs.push(
      await generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:"))
    );
  }
  const custodians = keyPairs
    .map(({ descriptor }) => descriptor)
    .sort((left, right) =>
      left.custodian_id.localeCompare(right.custodian_id)
    );
  const store = new MemoryCounterAuthorityStore();
  const material = await generateCounterAuthorityKeyMaterial();
  const authority = new LinearizableCounterAuthority({
    authorityId: material.authorityId,
    authorityPublicKey: material.authorityPublicKey,
    privateKey: material.privateKey,
    store
  });
  const epoch = String(CONFIDENTIAL_LIMITS.epoch_max);
  const transitionId = "x".repeat(64);
  const epochId = deriveConfidentialEpochId({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key,
    custodianEncryptionKeys: custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch,
    membershipHead: base.membershipHead,
    organismId: base.organismId,
    transitionId
  });
  const expectedNextCounter = "4294967247";
  const expectedPriorReceiptDigest = randomTagged("sha256:");
  await store.transact(epochId, async () => ({
    next: {
      epoch,
      epoch_id: epochId,
      last_counter_receipt_digest: expectedPriorReceiptDigest,
      next_counter: expectedNextCounter,
      retired: false
    },
    value: true
  }));
  const input = {
    authority,
    custodians,
    epoch,
    epochId,
    expectedNextCounter,
    expectedPriorReceiptDigest,
    membershipHead: base.membershipHead,
    organismId: base.organismId,
    priorConfidentialRoot: base.priorConfidentialRoot,
    resourceId: base.resourceId,
    transitionId
  };
  const maximum = await createConfidentialPackage({
    ...input,
    resourceBytes: new Uint8Array(CONFIDENTIAL_LIMITS.resource_bytes)
  });
  assert.equal(maximum.packageBytes.byteLength, 4_194_303);
  assert.equal(maximum.packageBytes.byteLength <= CONFIDENTIAL_LIMITS.package_bytes, true);
  assert.equal(maximum.manifest.chunks.length, 49);
  assert.equal(maximum.manifest.wraps.length, CONFIDENTIAL_LIMITS.max_custodians);
  await assert.rejects(
    createConfidentialPackage({
      ...input,
      resourceBytes: new Uint8Array(CONFIDENTIAL_LIMITS.resource_bytes + 1)
    }),
    /E_CONFIDENTIAL_LIMIT/u
  );
  await assert.rejects(
    createConfidentialPackage({
      ...input,
      custodians: [...custodians, custodians[0]],
      resourceBytes: new Uint8Array([1])
    }),
    /E_CONFIDENTIAL_MEMBERSHIP/u
  );
});

test("membership rotation omits the removed member and preserves exact survivor access", async () => {
  const current = await fixture();
  const added = await generateCustodianEncryptionKeyPair(
    randomTagged("mortalos-key:")
  );
  const nextCustodians = [
    current.custodians[1],
    current.custodians[2],
    added.descriptor
  ].sort((left, right) => left.custodian_id.localeCompare(right.custodian_id));
  const membership = createNextMembershipHead(current.rotationContext);
  const nextMembershipHead = membership.nextHead.object_hash;
  const nextEpochId = deriveConfidentialEpochId({
    authorityId: current.authority.descriptor.authority_id,
    authorityPublicKey: current.authority.descriptor.authority_public_key,
    custodianEncryptionKeys: nextCustodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch: "1",
    membershipHead: nextMembershipHead,
    organismId: current.organismId,
    transitionId: "membership-rotation"
  });
  const survivor = current.custodians[1];
  const rotation = rotationInput({
    approvedMembershipHead: nextMembershipHead,
    current,
    nextAuthority: current.authority,
    nextCustodians,
    reason: "membership_change"
  });
  const authorization = createRotationAuthorization(
    current.rotationContext,
    rotation
  );
  const rotated = await rotateConfidentialState({
    activePackageBytes: current.confidentialPackage.packageBytes,
    authorization,
    currentCustodian: survivor,
    currentCustodians: current.custodians,
    currentHead: current.rotationContext.currentHead,
    currentPrivateKey: keyPairFor(current, survivor).privateKey,
    next: {
      authority: current.authority,
      custodians: nextCustodians,
      epoch: "1",
      epochId: nextEpochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null,
      membershipHead: nextMembershipHead,
      organismId: current.organismId,
      resourceId: current.resourceId,
      transitionId: "membership-rotation"
    },
    nextMembershipHead: membership.nextHead
  });
  const removed = current.custodians[0];
  assert.equal(
    rotated.package.manifest.wraps.some(
      ({ custodian_id: id }) => id === removed.custodian_id
    ),
    false
  );
  await assert.rejects(
    decryptConfidentialPackage({
      custodian: removed,
      expectedCustodians: nextCustodians,
      packageBytes: rotated.package.packageBytes,
      privateKey: keyPairFor(current, removed).privateKey
    }),
    /E_CONFIDENTIAL_KEY_UNAVAILABLE/u
  );
  const survivorDecryption = await decryptConfidentialPackage({
    custodian: survivor,
    expectedCustodians: nextCustodians,
    packageBytes: rotated.package.packageBytes,
    privateKey: keyPairFor(current, survivor).privateKey
  });
  assert.deepEqual(survivorDecryption.resource_bytes, current.resourceBytes);

  assert.throws(
    () =>
      validateConfidentialRotationInput({
        ...rotation,
        to_epoch: "2"
      }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  assert.throws(
    () =>
      verifyConfidentialRotationAuthorization({
        authorization,
        currentHead: structuredClone(current.rotationContext.currentHead),
        nextMembershipHead: membership.nextHead
      }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization,
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next: {
        authority: current.authority,
        custodians: nextCustodians,
        epoch: "2",
        epochId: nextEpochId,
        membershipHead: nextMembershipHead,
        organismId: current.organismId,
        resourceId: current.resourceId,
        transitionId: "membership-rotation"
      },
      nextMembershipHead: membership.nextHead
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
});

test("authority equivocation rotates with unchanged membership, a fresh authority, and a fresh epoch key", async () => {
  const current = await createConfidentialFixture({
    resourceBytes: deterministicSecret(65_537),
    transitionId: "authority-rotation-source"
  });
  const replacementAuthority = await LinearizableCounterAuthority.create();
  const nextMembershipHead = current.membershipHead;
  const nextEpochId = deriveConfidentialEpochId({
    authorityId: replacementAuthority.descriptor.authority_id,
    authorityPublicKey: replacementAuthority.descriptor.authority_public_key,
    custodianEncryptionKeys: current.custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch: "1",
    membershipHead: nextMembershipHead,
    organismId: current.organismId,
    transitionId: "authority-equivocation-rotation"
  });
  const survivor = current.custodians[1];
  const forkStore = new MemoryCounterAuthorityStore();
  const priorState = await current.authority.inspect(current.epochId);
  await forkStore.transact(current.epochId, async () => ({
    next: priorState,
    value: true
  }));
  const forkAuthority = new LinearizableCounterAuthority({
    authorityId: current.counterKeyMaterial.authorityId,
    authorityPublicKey: current.counterKeyMaterial.authorityPublicKey,
    privateKey: current.counterKeyMaterial.privateKey,
    store: forkStore
  });
  const request = {
    count: "1",
    epoch: current.epoch,
    epochId: current.epochId,
    expectedNextCounter: current.confidentialPackage.manifest.interval_end_exclusive,
    expectedPriorReceiptDigest:
      current.confidentialPackage.counterReceiptDigest
  };
  const [left, right] = await Promise.all([
    current.authority.reserveRange(request),
    forkAuthority.reserveRange({ ...request, count: "2" })
  ]);
  const priorAuthorityFacade = createCounterAuthorityFacade({
    authority: current.authority
  });
  const equivocationEvidence = await observeCounterAuthorityEquivocation({
    authority: priorAuthorityFacade,
    left: left.receipt,
    right: right.receipt
  });
  await assert.rejects(
    current.authority.reserveRange({
      count: "1",
      epoch: "0",
      epochId: current.epochId,
      expectedNextCounter: left.basis.next_counter,
      expectedPriorReceiptDigest: left.digest
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  const rotation = rotationInput({
    approvedMembershipHead: nextMembershipHead,
    current,
    nextAuthority: replacementAuthority,
    nextCustodians: current.custodians,
    reason: "counter_authority_equivocation"
  });
  const authorization = createRotationAuthorization(
    current.rotationContext,
    rotation
  );
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization,
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      equivocationEvidence: structuredClone(equivocationEvidence),
      next: {
        authority: replacementAuthority,
        custodians: current.custodians,
        epoch: "1",
        epochId: nextEpochId,
        expectedNextCounter: "0",
        expectedPriorReceiptDigest: null,
        membershipHead: nextMembershipHead,
        organismId: current.organismId,
        resourceId: current.resourceId,
        transitionId: "authority-equivocation-rotation"
      },
      priorAuthority: priorAuthorityFacade
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  const rotated = await rotateConfidentialState({
    activePackageBytes: current.confidentialPackage.packageBytes,
    authorization,
    currentCustodian: survivor,
    currentCustodians: current.custodians,
    currentHead: current.rotationContext.currentHead,
    currentPrivateKey: keyPairFor(current, survivor).privateKey,
    equivocationEvidence,
    next: {
      authority: replacementAuthority,
      custodians: current.custodians,
      epoch: "1",
      epochId: nextEpochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null,
      membershipHead: nextMembershipHead,
      organismId: current.organismId,
      resourceId: current.resourceId,
      transitionId: "authority-equivocation-rotation"
    },
    priorAuthority: priorAuthorityFacade
  });
  assert.notEqual(
    rotated.package.manifest.authority_id,
    current.confidentialPackage.manifest.authority_id
  );
  assert.deepEqual(
    rotated.package.manifest.wraps.map(({ custodian_id }) => custodian_id),
    current.confidentialPackage.manifest.wraps.map(
      ({ custodian_id }) => custodian_id
    )
  );
  const recovered = await decryptConfidentialPackage({
    custodian: survivor,
    expectedCustodians: current.custodians,
    packageBytes: rotated.package.packageBytes,
    privateKey: keyPairFor(current, survivor).privateKey
  });
  assert.deepEqual(recovered.resource_bytes, current.resourceBytes);
});

test("lost-authority rotation requires real quorum signatures, unchanged membership, and a fresh authority", async () => {
  const current = await createConfidentialFixture({
    resourceBytes: deterministicSecret(65_536),
    transitionId: "lost-authority-source"
  });
  const replacementAuthority = await LinearizableCounterAuthority.create();
  const survivor = current.custodians[1];
  await current.counterStore.lose(current.epochId);
  const priorAuthorityFacade = createCounterAuthorityFacade({
    authority: current.authority
  });
  const rotation = rotationInput({
    approvedMembershipHead: current.membershipHead,
    current,
    nextAuthority: replacementAuthority,
    nextCustodians: current.custodians,
    reason: "counter_authority_lost"
  });
  const authorization = createRotationAuthorization(
    current.rotationContext,
    rotation
  );
  const nextEpochId = deriveConfidentialEpochId({
    authorityId: replacementAuthority.descriptor.authority_id,
    authorityPublicKey: replacementAuthority.descriptor.authority_public_key,
    custodianEncryptionKeys: rotation.next_custodian_key_digests,
    epoch: "1",
    membershipHead: current.membershipHead,
    organismId: current.organismId,
    transitionId: "lost-authority-rotation"
  });
  const next = {
    authority: replacementAuthority,
    custodians: current.custodians,
    epoch: "1",
    epochId: nextEpochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null,
    membershipHead: current.membershipHead,
    organismId: current.organismId,
    resourceId: current.resourceId,
    transitionId: "lost-authority-rotation"
  };
  const substitutedAuthority = await LinearizableCounterAuthority.create();
  const substitutedEpochId = deriveConfidentialEpochId({
    authorityId: substitutedAuthority.descriptor.authority_id,
    authorityPublicKey: substitutedAuthority.descriptor.authority_public_key,
    custodianEncryptionKeys: rotation.next_custodian_key_digests,
    epoch: "1",
    membershipHead: current.membershipHead,
    organismId: current.organismId,
    transitionId: "lost-authority-rotation"
  });
  let authorityReads = 0;
  const statefulNext = {
    ...next,
    epochId: substitutedEpochId
  };
  Object.defineProperty(statefulNext, "authority", {
    enumerable: true,
    get() {
      authorityReads += 1;
      return authorityReads === 1
        ? replacementAuthority
        : substitutedAuthority;
    }
  });
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization,
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next: statefulNext,
      priorAuthority: priorAuthorityFacade
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  assert.equal(authorityReads, 0);

  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization: {
        ...authorization,
        approvals: []
      },
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next,
      priorAuthority: priorAuthorityFacade
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization,
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next,
      priorAuthority: {
        descriptor: current.authority.descriptor,
        inspect: async () => {
          throw new Error("claimed lost");
        }
      }
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  const oldAuthorityRotation = rotationInput({
    approvedMembershipHead: current.membershipHead,
    current,
    nextAuthority: current.authority,
    nextCustodians: current.custodians,
    reason: "counter_authority_lost"
  });
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization: createRotationAuthorization(
        current.rotationContext,
        oldAuthorityRotation
      ),
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next: { ...next, authority: current.authority },
      priorAuthority: priorAuthorityFacade
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );
  const added = await generateCustodianEncryptionKeyPair(
    randomTagged("mortalos-key:")
  );
  const changedCustodians = [
    current.custodians[1],
    current.custodians[2],
    added.descriptor
  ].sort((left, right) => left.custodian_id.localeCompare(right.custodian_id));
  const changedRotation = rotationInput({
    approvedMembershipHead: current.membershipHead,
    current,
    nextAuthority: replacementAuthority,
    nextCustodians: changedCustodians,
    reason: "counter_authority_lost"
  });
  await assert.rejects(
    rotateConfidentialState({
      activePackageBytes: current.confidentialPackage.packageBytes,
      authorization: createRotationAuthorization(
        current.rotationContext,
        changedRotation
      ),
      currentCustodian: survivor,
      currentCustodians: current.custodians,
      currentHead: current.rotationContext.currentHead,
      currentPrivateKey: keyPairFor(current, survivor).privateKey,
      next: { ...next, custodians: changedCustodians },
      priorAuthority: priorAuthorityFacade
    }),
    /E_CONFIDENTIAL_ROTATION/u
  );

  const mutableNextCustodians = [...current.custodians];
  let nextCustodiansMutated = false;
  const rotated = await rotateConfidentialState({
    activePackageBytes: current.confidentialPackage.packageBytes,
    authorization,
    currentCustodian: survivor,
    currentCustodians: current.custodians,
    currentHead: current.rotationContext.currentHead,
    currentPrivateKey: keyPairFor(current, survivor).privateKey,
    fault: async (step) => {
      if (step === "rotation:plaintext-recovered") {
        mutableNextCustodians.splice(
          0,
          mutableNextCustodians.length,
          ...changedCustodians
        );
        nextCustodiansMutated = true;
      }
    },
    next: {
      ...next,
      custodians: mutableNextCustodians
    },
    priorAuthority: priorAuthorityFacade
  });
  assert.equal(nextCustodiansMutated, true);
  assert.notEqual(
    rotated.package.manifest.authority_id,
    current.confidentialPackage.manifest.authority_id
  );
  assert.deepEqual(
    rotated.package.manifest.wraps.map(({ custodian_id }) => custodian_id),
    current.confidentialPackage.manifest.wraps.map(({ custodian_id }) => custodian_id)
  );
  assert.equal(
    rotated.package.manifest.wraps.some(
      ({ custodian_id: id }) => id === added.descriptor.custodian_id
    ),
    false
  );
});

test("counter, wrap, chunk, package, rotation, and activation faults leave one complete epoch", async () => {
  const base = await fixture();
  const oldCandidate = {
    confidential_root: base.priorConfidentialRoot,
    epoch: "18446744073709551614",
    epoch_id: randomTagged("sha256:"),
    package_base64url: "old",
    resource_id: base.resourceId,
    s3_state_root: randomTagged("sha256:"),
    status: "verified"
  };
  const store = new MemoryConfidentialEpochStore();
  await store.commitActive({
    candidate: oldCandidate,
    expectedPriorConfidentialRoot: base.priorConfidentialRoot
  });

  const phaseNames = [
    "counter:committed",
    "wrap:0:complete",
    "wrap:1:complete",
    "wrap:2:complete",
    "chunk:0:complete",
    "chunk:1:complete",
    "package:verified"
  ];
  for (const phase of phaseNames) {
    const active = await base.authority.inspect(base.epochId);
    await assert.rejects(
      createConfidentialPackage({
        authority: base.authority,
        custodians: base.custodians,
        epoch: base.epoch,
        epochId: base.epochId,
        expectedNextCounter: active.next_counter,
        expectedPriorReceiptDigest: active.last_counter_receipt_digest,
        fault(point) {
          if (point === phase) throw new Error(`fault:${phase}`);
        },
        membershipHead: base.membershipHead,
        organismId: base.organismId,
        priorConfidentialRoot: base.priorConfidentialRoot,
        resourceBytes: new Uint8Array([1, 2, 3]),
        resourceId: base.resourceId,
        transitionId: base.transitionId
      }),
      new RegExp(`fault:${phase}`, "u")
    );
    assert.deepEqual(store.active, oldCandidate);
  }

  const newCandidate = {
    ...oldCandidate,
    confidential_root: randomTagged("sha256:"),
    epoch: "18446744073709551615",
    package_base64url: "new"
  };
  await assert.rejects(
    store.commitActive({
      candidate: newCandidate,
      expectedPriorConfidentialRoot: oldCandidate.confidential_root,
      fault(point) {
        if (point === "activation:before") throw new Error("before");
      }
    }),
    /before/u
  );
  assert.deepEqual(store.active, oldCandidate);
  await assert.rejects(
    store.commitActive({
      candidate: newCandidate,
      expectedPriorConfidentialRoot: oldCandidate.confidential_root,
      fault(point) {
        if (point === "activation:after") throw new Error("after");
      }
    }),
    /after/u
  );
  assert.deepEqual(store.active, newCandidate);
  assert.deepEqual(
    await store.commitActive({
      candidate: newCandidate,
      expectedPriorConfidentialRoot: oldCandidate.confidential_root
    }),
    newCandidate
  );
  await assert.rejects(
    store.commitActive({
      candidate: oldCandidate,
      expectedPriorConfidentialRoot: oldCandidate.confidential_root
    }),
    /E_CONFIDENTIAL_ACTIVATION_STALE/u
  );
});
