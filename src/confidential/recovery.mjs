import {
  asBytes,
  byteLengthOfBytes,
  concatBytes,
  encodeBase64Url,
  equalBytes,
  utf8Bytes
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import { verifyEd25519 } from "../crypto.mjs";
import {
  copyBoundedOwnDataArray,
  createUint8Array,
  freeze,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  snapshotNamedOwnDataValues,
  typedArraySet
} from "../primordials.mjs";
import { isValidatedAcceptance } from "../validator.mjs";
import { createStatePackage } from "../state/package.mjs";
import { recoverStatePackage } from "../state/recovery.mjs";
import {
  CONFIDENTIAL_FORMATS,
  CONFIDENTIAL_SUITE,
  ConfidentialStateError,
  assertDigest,
  confidentialFail,
  exactObjectKeys,
  parseEpoch,
  CONFIDENTIAL_DOMAINS
} from "./format.mjs";
import {
  createConfidentialPackage,
  decryptConfidentialPackageForRecovery,
  snapshotConfidentialCustodians,
  verifyConfidentialPackage
} from "./package.mjs";
import {
  counterAuthorityDescriptor,
  inspectCounterAuthority,
  isLinearizableCounterAuthority,
  isObservedCounterAuthorityEquivocation
} from "./counter.mjs";

const structuredCloneIntrinsic = globalThis.structuredClone;
const structuredCloneReflectApply = Reflect.apply;

function clone(value) {
  return structuredCloneReflectApply(structuredCloneIntrinsic, globalThis, [value]);
}

export class MemoryConfidentialEpochStore {
  #active = null;
  #fault = null;
  #tail = Promise.resolve();

  constructor({ fault = null } = {}) {
    this.#fault = fault;
    confidentialEpochStores.set(this, Object.freeze({
      commitActive: (options) => this.#commitActive(options),
      readActive: () => this.#readActive()
    }));
  }

  get active() {
    return this.#readActive();
  }

  async commitActive({
    candidate,
    expectedPriorConfidentialRoot,
    fault = null
  }) {
    return this.#commitActive({ candidate, expectedPriorConfidentialRoot, fault });
  }

  #readActive() {
    return this.#active ? clone(this.#active) : null;
  }

  async #commitActive({ candidate, expectedPriorConfidentialRoot, fault = null }) {
    let release;
    const prior = this.#tail;
    this.#tail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      const staged = clone(candidate);
      if (
        this.#active &&
        equalBytes(canonicalBytes(this.#active), canonicalBytes(staged))
      ) {
        return this.active;
      }
      const activeRoot = this.#active?.confidential_root ?? expectedPriorConfidentialRoot;
      if (activeRoot !== expectedPriorConfidentialRoot) {
        confidentialFail(
          "E_CONFIDENTIAL_ACTIVATION_STALE",
          "/active/confidential_root",
          "compare-and-swap"
        );
      }
      const boundary = fault ?? this.#fault;
      await boundary?.("activation:before");
      if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
      this.#active = staged;
      await boundary?.("activation:after");
      if (!realmIntrinsicsIntact()) throw new Error("realm-integrity");
      return this.active;
    } finally {
      release();
    }
  }
}

const confidentialEpochStores = new WeakMap();
const confidentialEpochStoreGet = WeakMap.prototype.get;
const confidentialReflectApply = Reflect.apply;

function confidentialEpochStoreCapability(store) {
  const capability = confidentialReflectApply(
    confidentialEpochStoreGet,
    confidentialEpochStores,
    [store]
  );
  if (!capability) {
    throw new TypeError("registered MortalOS confidential epoch store required");
  }
  return capability;
}

async function commitConfidentialActive(capability, options) {
  let committed;
  try {
    committed = await capability.commitActive(options);
  } catch (error) {
    const afterFailure = capability.readActive();
    if (
      error?.message === "realm-integrity" ||
      !afterFailure ||
      !equalBytes(canonicalBytes(afterFailure), canonicalBytes(options.candidate))
    ) {
      throw error;
    }
    committed = afterFailure;
  }
  const readback = capability.readActive();
  if (
    !committed ||
    !readback ||
    !equalBytes(canonicalBytes(committed), canonicalBytes(options.candidate)) ||
    !equalBytes(canonicalBytes(readback), canonicalBytes(options.candidate))
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ACTIVATION_STALE",
      "/active",
      "commit-readback"
    );
  }
  return readback;
}

export function validateConfidentialRotationInput(input) {
  const names = [
    "approved_membership_head",
    "current_membership_head",
    "format",
    "from_epoch",
    "next_authority_id",
    "next_custodian_key_digests",
    "reason",
    "suite",
    "to_epoch"
  ];
  exactObjectKeys(
    input,
    names,
    "/rotation"
  );
  let inputSnapshot;
  try {
    const values = snapshotNamedOwnDataValues(input, names, "confidential rotation");
    const digestCount = ownDataArrayLength(
      values[5],
      "confidential rotation custodian key digests"
    );
    inputSnapshot = freeze({
      approved_membership_head: values[0],
      current_membership_head: values[1],
      format: values[2],
      from_epoch: values[3],
      next_authority_id: values[4],
      next_custodian_key_digests: freeze(copyBoundedOwnDataArray(
        values[5],
        digestCount,
        "confidential rotation custodian key digests"
      )),
      reason: values[6],
      suite: values[7],
      to_epoch: values[8]
    });
  } catch {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "owned-data");
  }
  if (
    inputSnapshot.format !== CONFIDENTIAL_FORMATS.rotation ||
    inputSnapshot.suite !== CONFIDENTIAL_SUITE ||
    ![
      "membership_change",
      "counter_authority_lost",
      "counter_authority_equivocation"
    ].includes(inputSnapshot.reason)
  ) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "authorization");
  }
  const from = parseEpoch(inputSnapshot.from_epoch, "/rotation/from_epoch");
  const to = parseEpoch(inputSnapshot.to_epoch, "/rotation/to_epoch");
  if (to !== from + 1n) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation/to_epoch", "successor");
  }
  assertDigest(
    inputSnapshot.approved_membership_head,
    "/rotation/approved_membership_head"
  );
  assertDigest(
    inputSnapshot.current_membership_head,
    "/rotation/current_membership_head"
  );
  assertDigest(inputSnapshot.next_authority_id, "/rotation/next_authority_id");
  if (
    inputSnapshot.next_custodian_key_digests.length < 1 ||
    inputSnapshot.next_custodian_key_digests.length > 16
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation/next_custodian_key_digests",
      "count"
    );
  }
  const sorted = [...inputSnapshot.next_custodian_key_digests].sort();
  for (let index = 0; index < sorted.length; index += 1) {
    assertDigest(sorted[index], `/rotation/next_custodian_key_digests/${index}`);
    if (
      sorted[index] !== inputSnapshot.next_custodian_key_digests[index] ||
      (index > 0 && sorted[index] === sorted[index - 1])
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation/next_custodian_key_digests",
        "sorted-unique"
      );
    }
  }
  return inputSnapshot;
}

export function confidentialRotationAuthorizationMessage(rotationInput) {
  const rotation = validateConfidentialRotationInput(rotationInput);
  return concatBytes(
    utf8Bytes(CONFIDENTIAL_DOMAINS.rotation),
    new Uint8Array([0]),
    canonicalBytes(rotation)
  );
}

function snapshotObservedCounterAuthorityEquivocation(evidence) {
  if (!isObservedCounterAuthorityEquivocation(evidence)) return null;
  const values = snapshotNamedOwnDataValues(
    evidence,
    ["authority_id", "epoch_id", "receipt_digests", "status"],
    "observed counter authority equivocation"
  );
  if (values[3] !== "counter_authority_equivocation") return null;
  return freeze({ authorityId: values[0], epochId: values[1] });
}

export function verifyConfidentialRotationAuthorization({
  authorization,
  currentHead,
  nextMembershipHead = null
}) {
  exactObjectKeys(
    authorization,
    ["approvals", "format", "rotation"],
    "/rotation_authorization"
  );
  if (
    authorization.format !== CONFIDENTIAL_FORMATS.rotation_authorization ||
    !isValidatedAcceptance(currentHead) ||
    !["genesis", "pulse"].includes(currentHead.kind)
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation_authorization",
      "validated-current-head"
    );
  }
  const rotation = validateConfidentialRotationInput(authorization.rotation);
  if (
    rotation.current_membership_head !== currentHead.object_hash ||
    currentHead.organism_id === undefined
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation_authorization",
      "current-head-binding"
    );
  }
  if (rotation.reason === "membership_change") {
    if (
      !isValidatedAcceptance(nextMembershipHead) ||
      nextMembershipHead.kind !== "pulse" ||
      nextMembershipHead.parent_hash !== currentHead.object_hash ||
      nextMembershipHead.object_hash !== rotation.approved_membership_head ||
      nextMembershipHead.organism_id !== currentHead.organism_id
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation_authorization",
        "next-head-binding"
      );
    }
  } else if (
    nextMembershipHead !== null ||
    rotation.approved_membership_head !== currentHead.object_hash
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation_authorization",
      "unchanged-membership-head"
    );
  }
  if (!Array.isArray(authorization.approvals)) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation_authorization/approvals",
      "array"
    );
  }
  const descriptor = currentHead.next_custody_descriptor;
  const currentById = new Map(
    descriptor.custodians.map((entry) => [entry.key_id, entry])
  );
  const message = confidentialRotationAuthorizationMessage(rotation);
  let prior = null;
  for (let index = 0; index < authorization.approvals.length; index += 1) {
    const approval = authorization.approvals[index];
    exactObjectKeys(
      approval,
      ["key_id", "signature"],
      `/rotation_authorization/approvals/${index}`
    );
    const signer = currentById.get(approval.key_id);
    if (
      !signer ||
      approval.key_id <= (prior ?? "") ||
      !verifyEd25519(signer.public_key, message, approval.signature)
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        `/rotation_authorization/approvals/${index}`,
        "signature-or-order"
      );
    }
    prior = approval.key_id;
  }
  if (authorization.approvals.length < descriptor.quorum.threshold) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation_authorization/approvals",
      "quorum"
    );
  }
  return Object.freeze({ rotation });
}

export async function createConfidentialStatePackage({
  confidential,
  genomeHash,
  inputBytes,
  priorStateRoot
}) {
  const inputView = asBytes(inputBytes);
  const inputLength = inputView === null ? null : byteLengthOfBytes(inputView);
  if (inputLength === null) {
    throw new TypeError("state package input must be an owned Uint8Array");
  }
  const ownedInputBytes = createUint8Array(inputLength);
  typedArraySet(ownedInputBytes, inputView, 0);
  let confidentialValues;
  try {
    confidentialValues = snapshotNamedOwnDataValues(
      confidential,
      [
        "authority",
        "custodians",
        "epoch",
        "epochId",
        "expectedNextCounter",
        "expectedPriorReceiptDigest",
        "fault",
        "membershipHead",
        "organismId",
        "priorConfidentialRoot",
        "resourceBytes",
        "resourceId",
        "transitionId"
      ],
      "confidential package input"
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_FORMAT", "/confidential", "own-data-record");
  }
  const resourceView = asBytes(confidentialValues[10]);
  const resourceLength = resourceView === null ? null : byteLengthOfBytes(resourceView);
  if (resourceLength === null) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", "/resource", "bytes-required");
  }
  const ownedResourceBytes = createUint8Array(resourceLength);
  typedArraySet(ownedResourceBytes, resourceView, 0);
  const confidentialSnapshot = Object.freeze({
    authority: confidentialValues[0],
    custodians: snapshotConfidentialCustodians(confidentialValues[1]),
    epoch: confidentialValues[2],
    epochId: confidentialValues[3],
    expectedNextCounter: confidentialValues[4] ?? "0",
    expectedPriorReceiptDigest: confidentialValues[5] ?? null,
    fault: confidentialValues[6] ?? null,
    membershipHead: confidentialValues[7],
    organismId: confidentialValues[8],
    priorConfidentialRoot: confidentialValues[9],
    resourceBytes: ownedResourceBytes,
    resourceId: confidentialValues[11],
    transitionId: confidentialValues[12]
  });
  const confidentialPackage = await createConfidentialPackage(confidentialSnapshot);
  const statePackage = createStatePackage({
    genomeHash,
    inputBytes: ownedInputBytes,
    priorStateRoot,
    resourceBytes: confidentialPackage.packageBytes
  });
  return Object.freeze({ confidentialPackage, statePackage });
}

export async function recoverAndDecryptConfidentialState({
  confidentialDestination,
  custodian,
  destination,
  expected,
  inputBytes,
  manifestBytes,
  privateKey,
  receiptBytes,
  sources
}) {
  let expectedValues;
  let expectedCustodians;
  let ownedCustodian;
  let confidentialCommitCapability;
  try {
    expectedValues = snapshotNamedOwnDataValues(
      expected,
      [
        "custodians",
        "epoch",
        "epochId",
        "genomeHash",
        "membershipHead",
        "nextStateRoot",
        "organismId",
        "priorConfidentialRoot",
        "priorStateRoot",
        "resourceId"
      ],
      "confidential recovery expected basis"
    );
    expectedCustodians = snapshotConfidentialCustodians(expectedValues[0]);
    ownedCustodian = snapshotConfidentialCustodians([custodian])[0];
    confidentialCommitCapability = confidentialEpochStoreCapability(confidentialDestination);
  } catch {
    return Object.freeze({
      code: "E_CONFIDENTIAL_REJECTED",
      status: "confidential_state_rejected"
    });
  }
  const expectedSnapshot = Object.freeze({
    custodians: expectedCustodians,
    epoch: expectedValues[1],
    epochId: expectedValues[2],
    genomeHash: expectedValues[3],
    membershipHead: expectedValues[4],
    nextStateRoot: expectedValues[5],
    organismId: expectedValues[6],
    priorConfidentialRoot: expectedValues[7],
    priorStateRoot: expectedValues[8],
    resourceId: expectedValues[9]
  });
  const recoveryPromise = recoverStatePackage({
    destination,
    expectedGenomeHash: expectedSnapshot.genomeHash,
    expectedNextStateRoot: expectedSnapshot.nextStateRoot,
    expectedPriorStateRoot: expectedSnapshot.priorStateRoot,
    inputBytes,
    manifestBytes,
    receiptBytes,
    sources
  });
  const recovered = await recoveryPromise;
  if (recovered.status !== "available") return recovered;
  let decrypted;
  try {
    decrypted = await decryptConfidentialPackageForRecovery({
      custodian: ownedCustodian,
      expectedCustodians: expectedSnapshot.custodians,
      expectedEpochId: expectedSnapshot.epochId,
      expectedMembershipHead: expectedSnapshot.membershipHead,
      expectedOrganismId: expectedSnapshot.organismId,
      expectedPriorConfidentialRoot: expectedSnapshot.priorConfidentialRoot,
      expectedResourceId: expectedSnapshot.resourceId,
      packageBytes: recovered.resource_bytes,
      privateKey
    });
  } catch (error) {
    if (error instanceof ConfidentialStateError) {
      return Object.freeze({
        code: error.code,
        status:
          error.code === "E_CONFIDENTIAL_KEY_UNAVAILABLE"
            ? "key_unavailable"
            : "confidential_state_rejected"
      });
    }
    return Object.freeze({
      code: "E_CONFIDENTIAL_REJECTED",
      status: "confidential_state_rejected"
    });
  }
  const candidate = Object.freeze({
    confidential_root: decrypted.confidential_root,
    epoch: expectedSnapshot.epoch,
    epoch_id: expectedSnapshot.epochId,
    package_base64url: encodeBase64Url(recovered.resource_bytes),
    resource_id: expectedSnapshot.resourceId,
    s3_state_root: recovered.next_state_root,
    status: "verified"
  });
  try {
    await commitConfidentialActive(confidentialCommitCapability, {
      candidate,
      expectedPriorConfidentialRoot: expectedSnapshot.priorConfidentialRoot
    });
  } catch {
    return Object.freeze({
      code: "E_CONFIDENTIAL_INTERRUPTED",
      status: "confidential_state_interrupted"
    });
  }
  return Object.freeze({
    code: null,
    confidential_root: decrypted.confidential_root,
    resource_bytes: decrypted.resource_bytes,
    status: "available"
  });
}

export async function rotateConfidentialState({
  activePackageBytes,
  authorization,
  currentCustodian,
  currentCustodians,
  currentHead,
  currentPrivateKey,
  equivocationEvidence = null,
  fault = null,
  next,
  nextMembershipHead = null,
  priorAuthority = null
}) {
  const activePackageView = asBytes(activePackageBytes);
  const activePackageLength = activePackageView === null
    ? null
    : byteLengthOfBytes(activePackageView);
  if (activePackageLength === null) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "active-package");
  }
  const ownedActivePackageBytes = createUint8Array(activePackageLength);
  typedArraySet(ownedActivePackageBytes, activePackageView, 0);
  const observedEquivocation = snapshotObservedCounterAuthorityEquivocation(
    equivocationEvidence
  );
  let nextValues;
  try {
    nextValues = snapshotNamedOwnDataValues(
      next,
      [
        "authority",
        "custodians",
        "epoch",
        "epochId",
        "expectedNextCounter",
        "expectedPriorReceiptDigest",
        "membershipHead",
        "organismId",
        "resourceId",
        "transitionId"
      ],
      "confidential successor"
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "successor-snapshot");
  }
  const [
    authority,
    custodians,
    epoch,
    epochId,
    expectedNextCounter,
    expectedPriorReceiptDigest,
    membershipHead,
    organismId,
    resourceId,
    transitionId
  ] = nextValues;
  const currentMembership =
    snapshotConfidentialCustodians(currentCustodians);
  const nextMembership = snapshotConfidentialCustodians(custodians);
  const currentRecipient =
    snapshotConfidentialCustodians([currentCustodian])[0];
  const nextSnapshot = Object.freeze({
    authority,
    custodians: nextMembership,
    epoch,
    epochId,
    expectedNextCounter,
    expectedPriorReceiptDigest,
    membershipHead,
    organismId,
    resourceId,
    transitionId
  });
  const nextAuthorityDescriptor = counterAuthorityDescriptor(
    nextSnapshot.authority
  );
  const authorized = verifyConfidentialRotationAuthorization({
    authorization,
    currentHead,
    nextMembershipHead
  });
  const rotation = authorized.rotation;
  const current = verifyConfidentialPackage({
    expectedCustodians: currentMembership,
    packageBytes: ownedActivePackageBytes
  });
  if (
    current.manifest.epoch !== rotation.from_epoch ||
    current.manifest.membership_head !== rotation.current_membership_head ||
    current.manifest.organism_id !== currentHead.organism_id ||
    nextSnapshot.epoch !== rotation.to_epoch ||
    nextSnapshot.membershipHead !== rotation.approved_membership_head ||
    nextSnapshot.organismId !== currentHead.organism_id ||
    nextAuthorityDescriptor.authority_id !== rotation.next_authority_id ||
    JSON.stringify(
      nextSnapshot.custodians
        .map(({ encryption_key_digest: digest }) => digest)
        .sort()
    ) !== JSON.stringify(rotation.next_custodian_key_digests)
  ) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "binding");
  }
  const currentKeyDigests = currentMembership
    .map(({ encryption_key_digest: digest }) => digest)
    .sort();
  const nextKeyDigests = rotation.next_custodian_key_digests;
  const membershipChanged =
    JSON.stringify(currentKeyDigests) !== JSON.stringify(nextKeyDigests);
  if (rotation.reason === "membership_change") {
    if (!membershipChanged) {
      confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "membership-unchanged");
    }
  } else {
    const priorDescriptor = isLinearizableCounterAuthority(priorAuthority)
      ? counterAuthorityDescriptor(priorAuthority)
      : null;
    if (
      membershipChanged ||
      !priorDescriptor ||
      priorDescriptor.authority_id !== current.manifest.authority_id ||
      rotation.next_authority_id === current.manifest.authority_id
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation",
        "authority-only-invariants"
      );
    }
    let priorState = null;
    let priorStateLost = false;
    try {
      priorState = await inspectCounterAuthority(
        priorAuthority,
        current.manifest.epoch_id
      );
    } catch {
      priorStateLost = true;
    }
    if (
      (rotation.reason === "counter_authority_lost" && !priorStateLost) ||
      (rotation.reason === "counter_authority_equivocation" &&
        (!priorState?.retired ||
          !observedEquivocation ||
          observedEquivocation.authorityId !== current.manifest.authority_id ||
          observedEquivocation.epochId !== current.manifest.epoch_id))
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation",
        "authority-state"
      );
    }
  }
  const decrypted = await decryptConfidentialPackageForRecovery({
    custodian: currentRecipient,
    expectedCustodians: currentMembership,
    packageBytes: ownedActivePackageBytes,
    privateKey: currentPrivateKey
  });
  await fault?.("rotation:plaintext-recovered");
  const created = await createConfidentialPackage({
    ...nextSnapshot,
    fault,
    priorConfidentialRoot: current.confidentialRoot,
    resourceBytes: decrypted.resource_bytes
  });
  await fault?.("rotation:successor-complete");
  return Object.freeze({
    from_confidential_root: current.confidentialRoot,
    package: created,
    reason: rotation.reason,
    to_confidential_root: created.confidentialRoot
  });
}
