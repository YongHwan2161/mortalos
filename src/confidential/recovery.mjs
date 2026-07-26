import { encodeBase64Url } from "../bytes.mjs";
import { createStatePackage } from "../state/package.mjs";
import { recoverStatePackage } from "../state/recovery.mjs";
import {
  CONFIDENTIAL_FORMATS,
  CONFIDENTIAL_SUITE,
  ConfidentialStateError,
  assertDigest,
  confidentialFail,
  exactObjectKeys,
  parseEpoch
} from "./format.mjs";
import {
  createConfidentialPackage,
  decryptConfidentialPackage,
  verifyConfidentialPackage
} from "./package.mjs";

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
      "format",
      "from_epoch",
      "quorum_validation",
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
    ].includes(input.reason) ||
    input.quorum_validation !== "accepted"
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
  return Object.freeze(input);
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
  currentCustodian,
  currentCustodians,
  currentPrivateKey,
  fault = null,
  next,
  rotationInput
}) {
  const rotation = validateConfidentialRotationInput(rotationInput);
  const current = verifyConfidentialPackage({
    expectedCustodians: currentCustodians,
    packageBytes: activePackageBytes
  });
  if (
    current.manifest.epoch !== rotation.from_epoch ||
    next.epoch !== rotation.to_epoch ||
    next.membershipHead !== rotation.approved_membership_head
  ) {
    confidentialFail("E_CONFIDENTIAL_ROTATION", "/rotation", "binding");
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
