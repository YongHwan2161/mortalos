import {
  concatBytes,
  encodeBase64Url,
  utf8Bytes
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import { verifyEd25519 } from "../crypto.mjs";
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
  decryptConfidentialPackage,
  verifyConfidentialPackage
} from "./package.mjs";
import {
  counterAuthorityDescriptor,
  inspectCounterAuthority,
  isLinearizableCounterAuthority,
  isObservedCounterAuthorityEquivocation
} from "./counter.mjs";

export class MemoryConfidentialEpochStore {
  #active = null;
  #tail = Promise.resolve();

  get active() {
    return this.#active ? structuredClone(this.#active) : null;
  }

  async commitActive({
    candidate,
    expectedPriorConfidentialRoot,
    fault = null
  }) {
    let release;
    const prior = this.#tail;
    this.#tail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      const activeRoot = this.#active?.confidential_root ?? expectedPriorConfidentialRoot;
      if (activeRoot !== expectedPriorConfidentialRoot) {
        confidentialFail(
          "E_CONFIDENTIAL_ACTIVATION_STALE",
          "/active/confidential_root",
          "compare-and-swap"
        );
      }
      await fault?.("activation:before");
      this.#active = structuredClone(candidate);
      await fault?.("activation:after");
      return this.active;
    } finally {
      release();
    }
  }
}

export function validateConfidentialRotationInput(input) {
  exactObjectKeys(
    input,
    [
      "approved_membership_head",
      "current_membership_head",
      "format",
      "from_epoch",
      "next_authority_id",
      "next_custodian_key_digests",
      "reason",
      "suite",
      "to_epoch"
    ],
    "/rotation"
  );
  if (
    input.format !== CONFIDENTIAL_FORMATS.rotation ||
    input.suite !== CONFIDENTIAL_SUITE ||
    ![
      "membership_change",
      "counter_authority_lost",
      "counter_authority_equivocation"
    ].includes(input.reason)
  ) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "authorization");
  }
  const from = parseEpoch(input.from_epoch, "/rotation/from_epoch");
  const to = parseEpoch(input.to_epoch, "/rotation/to_epoch");
  if (to !== from + 1n) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation/to_epoch", "successor");
  }
  assertDigest(
    input.approved_membership_head,
    "/rotation/approved_membership_head"
  );
  assertDigest(
    input.current_membership_head,
    "/rotation/current_membership_head"
  );
  assertDigest(input.next_authority_id, "/rotation/next_authority_id");
  if (
    !Array.isArray(input.next_custodian_key_digests) ||
    input.next_custodian_key_digests.length < 1 ||
    input.next_custodian_key_digests.length > 16
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_ROTATION",
      "/rotation/next_custodian_key_digests",
      "count"
    );
  }
  const sorted = [...input.next_custodian_key_digests].sort();
  for (let index = 0; index < sorted.length; index += 1) {
    assertDigest(sorted[index], `/rotation/next_custodian_key_digests/${index}`);
    if (
      sorted[index] !== input.next_custodian_key_digests[index] ||
      (index > 0 && sorted[index] === sorted[index - 1])
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation/next_custodian_key_digests",
        "sorted-unique"
      );
    }
  }
  return Object.freeze(input);
}

export function confidentialRotationAuthorizationMessage(rotationInput) {
  const rotation = validateConfidentialRotationInput(rotationInput);
  return concatBytes(
    utf8Bytes(CONFIDENTIAL_DOMAINS.rotation),
    new Uint8Array([0]),
    canonicalBytes(rotation)
  );
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
  const confidentialPackage = await createConfidentialPackage(confidential);
  const statePackage = createStatePackage({
    genomeHash,
    inputBytes,
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
  const recovered = await recoverStatePackage({
    destination,
    expectedGenomeHash: expected.genomeHash,
    expectedNextStateRoot: expected.nextStateRoot,
    expectedPriorStateRoot: expected.priorStateRoot,
    inputBytes,
    manifestBytes,
    receiptBytes,
    sources
  });
  if (recovered.status !== "available") return recovered;
  let decrypted;
  try {
    decrypted = await decryptConfidentialPackage({
      custodian,
      expectedCustodians: expected.custodians,
      expectedEpochId: expected.epochId,
      expectedMembershipHead: expected.membershipHead,
      expectedOrganismId: expected.organismId,
      expectedPriorConfidentialRoot: expected.priorConfidentialRoot,
      expectedResourceId: expected.resourceId,
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
    epoch: expected.epoch,
    epoch_id: expected.epochId,
    package_base64url: encodeBase64Url(recovered.resource_bytes),
    resource_id: expected.resourceId,
    s3_state_root: recovered.next_state_root,
    status: "verified"
  });
  try {
    await confidentialDestination.commitActive({
      candidate,
      expectedPriorConfidentialRoot: expected.priorConfidentialRoot
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
    epoch_key: decrypted.epoch_key,
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
  const authorized = verifyConfidentialRotationAuthorization({
    authorization,
    currentHead,
    nextMembershipHead
  });
  const rotation = authorized.rotation;
  const current = verifyConfidentialPackage({
    expectedCustodians: currentCustodians,
    packageBytes: activePackageBytes
  });
  if (
    current.manifest.epoch !== rotation.from_epoch ||
    current.manifest.membership_head !== rotation.current_membership_head ||
    current.manifest.organism_id !== currentHead.organism_id ||
    next.epoch !== rotation.to_epoch ||
    next.membershipHead !== rotation.approved_membership_head ||
    next.organismId !== currentHead.organism_id ||
    next.authority?.descriptor?.authority_id !== rotation.next_authority_id ||
    JSON.stringify(
      next.custodians
        .map(({ encryption_key_digest: digest }) => digest)
        .sort()
    ) !== JSON.stringify(rotation.next_custodian_key_digests)
  ) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "binding");
  }
  const currentKeyDigests = currentCustodians
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
          !isObservedCounterAuthorityEquivocation(equivocationEvidence) ||
          equivocationEvidence.authority_id !== current.manifest.authority_id ||
          equivocationEvidence.epoch_id !== current.manifest.epoch_id))
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_ROTATION",
        "/rotation",
        "authority-state"
      );
    }
  }
  const decrypted = await decryptConfidentialPackage({
    custodian: currentCustodian,
    expectedCustodians: currentCustodians,
    packageBytes: activePackageBytes,
    privateKey: currentPrivateKey
  });
  await fault?.("rotation:plaintext-recovered");
  const created = await createConfidentialPackage({
    ...next,
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
