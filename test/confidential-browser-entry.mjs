import { runConfidentialVectors } from "./confidential-vector-runner.mjs";
import {
  canonicalBytes,
  derivePeerId,
  encodeBase64Url,
  validateGenesis
} from "../src/index.mjs";
import {
  LinearizableCounterAuthority,
  createCounterAuthorityFacade,
  deriveConfidentialEpochId,
  inspectCounterAuthority,
  isLinearizableCounterAuthority,
  observeCounterAuthorityEquivocation,
  retireCounterAuthority
} from "../src/confidential/counter.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import { generateCustodianEncryptionKeyPair } from "../src/confidential/keys.mjs";
import { createConfidentialPackage } from "../src/confidential/package.mjs";
import {
  confidentialRotationAuthorizationMessage,
  rotateConfidentialState
} from "../src/confidential/recovery.mjs";
import { createInitialState } from "../src/state/engine.mjs";
import {
  assembleParticipantGenesis,
  createParticipantGenesisBody,
  genesisSigningRequest
} from "../lab/participant/core.mjs";
import {
  IndexedDbCounterAuthority,
  IndexedDbCounterAuthorityStore,
  deleteIndexedDbCounterAuthorityStore
} from "../lab/storage/confidential-counter-authority-store.mjs";

globalThis.__MORTALOS_S4_VECTORS__ = runConfidentialVectors;

async function withAuthority(databaseName, operation) {
  const authority = await IndexedDbCounterAuthority.open({ databaseName });
  try {
    return await operation(authority);
  } finally {
    authority.close();
  }
}

function compareTags(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function protocolActor() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );
  const publicKey = `ed25519:${encodeBase64Url(raw)}`;
  return Object.freeze({
    keyId: derivePeerId(publicKey),
    privateKey: keyPair.privateKey,
    publicKey
  });
}

async function protocolSignature(actor, message) {
  const raw = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, actor.privateKey, message)
  );
  return Object.freeze({
    key_id: actor.keyId,
    signature: `ed25519:${encodeBase64Url(raw)}`
  });
}

async function createRotationContext() {
  const actors = (await Promise.all([
    protocolActor(),
    protocolActor(),
    protocolActor()
  ])).sort((left, right) => compareTags(left.keyId, right.keyId));
  const body = createParticipantGenesisBody({
    custodians: actors.map(({ keyId, publicKey }) => ({
      key_id: keyId,
      public_key: publicKey
    })),
    initialQuorum: { threshold: 2, type: "threshold" },
    initialStateBytes: createInitialState(new Uint8Array(16).fill(61)),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(62))}`
  });
  const approvals = await Promise.all(
    actors.map((actor) =>
      protocolSignature(actor, genesisSigningRequest(body, actor.keyId).message)
    )
  );
  const genesis = assembleParticipantGenesis(body, approvals, {
    requireAllOriginApprovals: true
  });
  const currentHead = validateGenesis(canonicalBytes(genesis.envelope));
  if (currentHead.status !== "accept") {
    throw new Error("browser rotation Genesis rejected");
  }
  return Object.freeze({ actors, currentHead });
}

async function createRotationAuthorization(context, rotation) {
  const message = confidentialRotationAuthorizationMessage(rotation);
  const approvals = await Promise.all(
    context.actors
      .slice(0, context.currentHead.next_custody_descriptor.quorum.threshold)
      .map((actor) => protocolSignature(actor, message))
  );
  return Object.freeze({
    approvals: approvals.sort((left, right) =>
      compareTags(left.key_id, right.key_id)
    ),
    format: "mortalos-confidential-rotation-authorization/1",
    rotation
  });
}

async function openPersistentAuthority(databaseName, material = null) {
  const store = new IndexedDbCounterAuthorityStore({ databaseName });
  const keyMaterial = material ?? (await store.loadOrCreateKeyMaterial());
  const authority = new LinearizableCounterAuthority({
    authorityId: keyMaterial.authorityId,
    authorityPublicKey: keyMaterial.authorityPublicKey,
    privateKey: keyMaterial.privateKey,
    store
  });
  const facade = createCounterAuthorityFacade({
    authority,
    close: () => store.close()
  });
  return Object.freeze({ authority, facade, material: keyMaterial, store });
}

async function createPersistentFixture(databaseName, rotationContext) {
  const persistent = await openPersistentAuthority(databaseName);
  const keyPairs = await Promise.all([
    generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:")),
    generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:")),
    generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:"))
  ]);
  const custodians = keyPairs
    .map(({ descriptor }) => descriptor)
    .sort((left, right) =>
      left.custodian_id.localeCompare(right.custodian_id)
    );
  const epoch = "0";
  const membershipHead = rotationContext.currentHead.object_hash;
  const organismId = rotationContext.currentHead.organism_id;
  const resourceId = randomTagged("mortalos-resource:");
  const transitionId = "chromium-persistent-rotation-source";
  const epochId = deriveConfidentialEpochId({
    authorityId: persistent.facade.descriptor.authority_id,
    authorityPublicKey: persistent.facade.descriptor.authority_public_key,
    custodianEncryptionKeys: custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch,
    membershipHead,
    organismId,
    transitionId
  });
  const confidentialPackage = await createConfidentialPackage({
    authority: persistent.facade,
    custodians,
    epoch,
    epochId,
    membershipHead,
    organismId,
    priorConfidentialRoot: randomTagged("sha256:"),
    resourceBytes: new Uint8Array(16_384).fill(73),
    resourceId,
    transitionId
  });
  return Object.freeze({
    ...persistent,
    confidentialPackage,
    custodians,
    epoch,
    epochId,
    keyPairs,
    membershipHead,
    organismId,
    resourceId,
    rotationContext
  });
}

function rotationInput({ current, nextAuthority, reason }) {
  return Object.freeze({
    approved_membership_head: current.membershipHead,
    current_membership_head: current.membershipHead,
    format: "mortalos-confidential-rotation/1",
    from_epoch: current.epoch,
    next_authority_id: nextAuthority.descriptor.authority_id,
    next_custodian_key_digests: current.custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    reason,
    suite: "mortalos-confidential-state-suite/1",
    to_epoch: "1"
  });
}

async function rotatePersistentFixture({
  current,
  equivocationEvidence = null,
  nextAuthority,
  reason,
  transitionId
}) {
  const rotation = rotationInput({
    current,
    nextAuthority,
    reason,
    transitionId
  });
  const authorization = await createRotationAuthorization(
    current.rotationContext,
    rotation
  );
  const nextEpochId = deriveConfidentialEpochId({
    authorityId: nextAuthority.descriptor.authority_id,
    authorityPublicKey: nextAuthority.descriptor.authority_public_key,
    custodianEncryptionKeys: rotation.next_custodian_key_digests,
    epoch: "1",
    membershipHead: current.membershipHead,
    organismId: current.organismId,
    transitionId
  });
  const custodian = current.custodians[0];
  const keyPair = current.keyPairs.find(
    ({ descriptor }) => descriptor.custodian_id === custodian.custodian_id
  );
  return rotateConfidentialState({
    activePackageBytes: current.confidentialPackage.packageBytes,
    authorization,
    currentCustodian: custodian,
    currentCustodians: current.custodians,
    currentHead: current.rotationContext.currentHead,
    currentPrivateKey: keyPair.privateKey,
    equivocationEvidence,
    next: {
      authority: nextAuthority,
      custodians: current.custodians,
      epoch: "1",
      epochId: nextEpochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null,
      membershipHead: current.membershipHead,
      organismId: current.organismId,
      resourceId: current.resourceId,
      transitionId
    },
    priorAuthority: current.facade
  });
}

globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__ = Object.freeze({
  async descriptor(databaseName) {
    return withAuthority(databaseName, (authority) => ({
      ...authority.descriptor
    }));
  },
  async inspect(databaseName, epochId) {
    return withAuthority(databaseName, (authority) =>
      authority.inspect(epochId)
    );
  },
  async keyPolicy(databaseName) {
    return withAuthority(databaseName, (authority) => authority.keyPolicy);
  },
  async reserve(databaseName, input) {
    try {
      const value = await withAuthority(databaseName, (authority) =>
        authority.reserveRange(input)
      );
      return {
        code: null,
        ok: true,
        receipt: value.receipt
      };
    } catch (error) {
      return {
        code: error?.code ?? "unexpected",
        ok: false
      };
    }
  },
  async trustBoundary(databaseName, input) {
    return withAuthority(databaseName, async (authority) => {
      const reserved = await authority.reserveRange(input);
      await retireCounterAuthority(authority, input.epochId);
      const retired = await inspectCounterAuthority(authority, input.epochId);
      let postRetirementCode = null;
      try {
        await authority.reserveRange({
          ...input,
          expectedNextCounter: reserved.basis.next_counter,
          expectedPriorReceiptDigest: reserved.digest
        });
      } catch (error) {
        postRetirementCode = error?.code ?? "unexpected";
      }
      return {
        branded: isLinearizableCounterAuthority(authority),
        post_retirement_code: postRetirementCode,
        retired: retired?.retired === true
      };
    });
  },
  async rotationBoundary(databaseName) {
    const names = [
      `${databaseName}-lost-current`,
      `${databaseName}-lost-next`,
      `${databaseName}-equivocation-current`,
      `${databaseName}-equivocation-fork`,
      `${databaseName}-equivocation-next`,
      `${databaseName}-substituted-next`
    ];
    for (const name of names) await deleteIndexedDbCounterAuthorityStore(name);
    const originalInspect = IndexedDbCounterAuthorityStore.prototype.inspect;
    const originalTransact = IndexedDbCounterAuthorityStore.prototype.transact;
    const closeables = [];
    try {
      IndexedDbCounterAuthorityStore.prototype.inspect = async () => {
        throw new Error("spoofed prototype loss");
      };
      IndexedDbCounterAuthorityStore.prototype.transact = async () => {
        throw new Error("spoofed prototype transaction");
      };
      const rotationContext = await createRotationContext();
      const lostCurrent = await createPersistentFixture(
        names[0],
        rotationContext
      );
      closeables.push(lostCurrent.facade);
      IndexedDbCounterAuthorityStore.prototype.inspect = originalInspect;
      IndexedDbCounterAuthorityStore.prototype.transact = originalTransact;

      let ownReplacementRejected = false;
      try {
        Object.defineProperties(lostCurrent.store, {
          inspect: {
            configurable: true,
            value: async () => {
              throw new Error("spoofed own loss");
            }
          },
          transact: {
            configurable: true,
            value: async () => true
          }
        });
      } catch (error) {
        ownReplacementRejected = error instanceof TypeError;
      }
      const lostNext = await openPersistentAuthority(names[1]);
      closeables.push(lostNext.facade);
      const substitutedNext = await openPersistentAuthority(names[5]);
      closeables.push(substitutedNext.facade);
      await lostCurrent.store.lose(lostCurrent.epochId);
      const substitutionRotation = rotationInput({
        current: lostCurrent,
        nextAuthority: lostNext.facade,
        reason: "counter_authority_lost"
      });
      const substitutionAuthorization = await createRotationAuthorization(
        lostCurrent.rotationContext,
        substitutionRotation
      );
      const substitutedEpochId = deriveConfidentialEpochId({
        authorityId: substitutedNext.facade.descriptor.authority_id,
        authorityPublicKey:
          substitutedNext.facade.descriptor.authority_public_key,
        custodianEncryptionKeys:
          substitutionRotation.next_custodian_key_digests,
        epoch: "1",
        membershipHead: lostCurrent.membershipHead,
        organismId: lostCurrent.organismId,
        transitionId: "chromium-successor-substitution"
      });
      const substitutionCustodian = lostCurrent.custodians[0];
      const substitutionKeyPair = lostCurrent.keyPairs.find(
        ({ descriptor }) =>
          descriptor.custodian_id === substitutionCustodian.custodian_id
      );
      let successorAuthorityReads = 0;
      const statefulNext = {
        custodians: lostCurrent.custodians,
        epoch: "1",
        epochId: substitutedEpochId,
        expectedNextCounter: "0",
        expectedPriorReceiptDigest: null,
        membershipHead: lostCurrent.membershipHead,
        organismId: lostCurrent.organismId,
        resourceId: lostCurrent.resourceId,
        transitionId: "chromium-successor-substitution"
      };
      Object.defineProperty(statefulNext, "authority", {
        enumerable: true,
        get() {
          successorAuthorityReads += 1;
          return successorAuthorityReads === 1
            ? lostNext.facade
            : substitutedNext.facade;
        }
      });
      let successorSubstitutionCode = null;
      try {
        await rotateConfidentialState({
          activePackageBytes: lostCurrent.confidentialPackage.packageBytes,
          authorization: substitutionAuthorization,
          currentCustodian: substitutionCustodian,
          currentCustodians: lostCurrent.custodians,
          currentHead: lostCurrent.rotationContext.currentHead,
          currentPrivateKey: substitutionKeyPair.privateKey,
          next: statefulNext,
          priorAuthority: lostCurrent.facade
        });
      } catch (error) {
        successorSubstitutionCode = error?.code ?? "unexpected";
      }
      const lostRotated = await rotatePersistentFixture({
        current: lostCurrent,
        nextAuthority: lostNext.facade,
        reason: "counter_authority_lost",
        transitionId: "chromium-persistent-lost-rotation"
      });

      const equivocationCurrent = await createPersistentFixture(
        names[2],
        rotationContext
      );
      closeables.push(equivocationCurrent.facade);
      const fork = await openPersistentAuthority(
        names[3],
        equivocationCurrent.material
      );
      closeables.push(fork.facade);
      const priorState = await equivocationCurrent.facade.inspect(
        equivocationCurrent.epochId
      );
      await fork.store.transact(equivocationCurrent.epochId, async () => ({
        next: priorState,
        value: true
      }));
      const request = {
        count: "1",
        epoch: equivocationCurrent.epoch,
        epochId: equivocationCurrent.epochId,
        expectedNextCounter:
          equivocationCurrent.confidentialPackage.manifest.interval_end_exclusive,
        expectedPriorReceiptDigest:
          equivocationCurrent.confidentialPackage.counterReceiptDigest
      };
      const [left, right] = await Promise.all([
        equivocationCurrent.facade.reserveRange(request),
        fork.facade.reserveRange({ ...request, count: "2" })
      ]);
      IndexedDbCounterAuthorityStore.prototype.inspect = async () => ({
        ...priorState,
        retired: true
      });
      IndexedDbCounterAuthorityStore.prototype.transact = async (
        _epochId,
        operation
      ) => (await operation(priorState)).value;
      const evidence = await observeCounterAuthorityEquivocation({
        authority: equivocationCurrent.facade,
        left: left.receipt,
        right: right.receipt
      });
      const actualRetired = await originalInspect.call(
        equivocationCurrent.store,
        equivocationCurrent.epochId
      );
      const equivocationNext = await openPersistentAuthority(names[4]);
      closeables.push(equivocationNext.facade);
      const equivocationRotated = await rotatePersistentFixture({
        current: equivocationCurrent,
        equivocationEvidence: evidence,
        nextAuthority: equivocationNext.facade,
        reason: "counter_authority_equivocation",
        transitionId: "chromium-persistent-equivocation-rotation"
      });
      let oldAuthorityCode = null;
      try {
        await equivocationCurrent.facade.reserveRange({
          ...request,
          expectedNextCounter: left.basis.next_counter,
          expectedPriorReceiptDigest: left.digest
        });
      } catch (error) {
        oldAuthorityCode = error?.code ?? "unexpected";
      }
      return {
        equivocation: {
          authority_changed:
            equivocationRotated.package.manifest.authority_id !==
            equivocationCurrent.confidentialPackage.manifest.authority_id,
          evidence_status: evidence.status,
          old_authority_code: oldAuthorityCode,
          retired: actualRetired?.retired === true
        },
        lost: {
          authority_changed:
            lostRotated.package.manifest.authority_id !==
            lostCurrent.confidentialPackage.manifest.authority_id,
          reason: lostRotated.reason
        },
        own_replacement_rejected: ownReplacementRejected,
        successor_substitution_rejected:
          successorSubstitutionCode === "E_CONFIDENTIAL_ROTATION" &&
          successorAuthorityReads === 0
      };
    } finally {
      IndexedDbCounterAuthorityStore.prototype.inspect = originalInspect;
      IndexedDbCounterAuthorityStore.prototype.transact = originalTransact;
      for (const closeable of closeables) closeable.close();
      for (const name of names) await deleteIndexedDbCounterAuthorityStore(name);
    }
  },
  async wipe(databaseName) {
    await deleteIndexedDbCounterAuthorityStore(databaseName);
    return true;
  }
});
