import {
  decodeBase64Url,
  encodeBase64Url
} from "../src/bytes.mjs";
import {
  LinearizableCounterAuthority,
  MemoryCounterAuthorityStore,
  deriveConfidentialEpochId
} from "../src/confidential/counter.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import { generateCustodianEncryptionKeyPair } from "../src/confidential/keys.mjs";
import {
  createConfidentialPackage,
  decryptConfidentialPackage
} from "../src/confidential/package.mjs";
import {
  createConfidentialPlacementShardSet,
  reconstructConfidentialPackage
} from "../src/placement/confidential.mjs";

const fileArrayBuffer = globalThis.File?.prototype?.arrayBuffer;
const reflectApply = Reflect.apply;

function materialize(value) {
  return JSON.parse(JSON.stringify(value));
}

function packageContext(created, custodians) {
  return Object.freeze({
    custodians: materialize(custodians),
    epoch_id: created.manifest.epoch_id,
    membership_head: created.manifest.membership_head,
    organism_id: created.manifest.organism_id,
    package_base64url: encodeBase64Url(created.packageBytes),
    prior_confidential_root: created.manifest.prior_confidential_root,
    resource_id: created.manifest.resource_id
  });
}

export function installConfidentialPlacementHarness() {
  let custodian = null;
  let authority = null;

  async function createPackage(custodians, resourceBytes) {
    if (!Array.isArray(custodians) || custodians.length < 1) {
      throw new TypeError("at least one public custodian descriptor required");
    }
    authority = await LinearizableCounterAuthority.create({
      store: new MemoryCounterAuthorityStore()
    });
    const epoch = "0";
    const membershipHead = randomTagged("sha256:");
    const organismId = randomTagged("mortalos:");
    const priorConfidentialRoot = randomTagged("sha256:");
    const resourceId = randomTagged("mortalos-resource:");
    const transitionId = "confidential-p2p-placement";
    const epochId = deriveConfidentialEpochId({
      authorityId: authority.descriptor.authority_id,
      authorityPublicKey: authority.descriptor.authority_public_key,
      custodianEncryptionKeys: custodians
        .map(({ encryption_key_digest: digest }) => digest)
        .sort(),
      epoch,
      membershipHead,
      organismId,
      transitionId
    });
    const created = await createConfidentialPackage({
      authority,
      custodians,
      epoch,
      epochId,
      membershipHead,
      organismId,
      priorConfidentialRoot,
      resourceBytes,
      resourceId,
      transitionId
    });
    return packageContext(created, custodians);
  }

  const api = {
    async createCustodian() {
      if (custodian) throw new Error("E_CONFIDENTIAL_CUSTODIAN_ALREADY_CREATED");
      custodian = await generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:"));
      return Object.freeze({
        descriptor: materialize(custodian.descriptor),
        private_material_exposed: false
      });
    },
    async createPackageFromFile(file, custodians) {
      if (!fileArrayBuffer || !(file instanceof File)) throw new TypeError("native File required");
      const bytes = new Uint8Array(await reflectApply(fileArrayBuffer, file, []));
      return createPackage(custodians, bytes);
    },
    async decryptPackage(context, packageBase64Url) {
      if (!custodian?.privateKey) throw new Error("E_CONFIDENTIAL_CUSTODIAN_UNAVAILABLE");
      const decrypted = await decryptConfidentialPackage({
        custodian: custodian.descriptor,
        expectedCustodians: context.custodians,
        expectedEpochId: context.epoch_id,
        expectedMembershipHead: context.membership_head,
        expectedOrganismId: context.organism_id,
        expectedPriorConfidentialRoot: context.prior_confidential_root,
        expectedResourceId: context.resource_id,
        packageBytes: decodeBase64Url(packageBase64Url),
        privateKey: custodian.privateKey
      });
      return Object.freeze({
        private_material_exposed: false,
        resource_base64url: encodeBase64Url(decrypted.resource_bytes)
      });
    },
    createShardSet(packageBase64Url) {
      const created = createConfidentialPlacementShardSet({
        confidential_package_bytes: decodeBase64Url(packageBase64Url)
      });
      return Object.freeze({
        manifest_base64url: encodeBase64Url(created.manifest_bytes),
        shards: Object.freeze(created.shards.map(({ bytes, shard_index: index, workload_id: workloadId }) => ({
          bytes_base64url: encodeBase64Url(bytes),
          shard_index: index,
          workload_id: workloadId
        })))
      });
    },
    reconstructPackage(manifestBase64Url, shardBase64Urls) {
      const recovered = reconstructConfidentialPackage({
        manifest_bytes: decodeBase64Url(manifestBase64Url),
        shard_bytes: shardBase64Urls.map((value) => decodeBase64Url(value))
      });
      return Object.freeze({
        package_base64url: encodeBase64Url(recovered.confidential_package_bytes),
        shard_indexes: recovered.shard_indexes
      });
    },
    snapshot() {
      return Object.freeze({
        authority_active: Boolean(authority),
        custodian_active: Boolean(custodian),
        private_material_exposed: false
      });
    },
    destroy() {
      custodian = null;
      authority = null;
      return Object.freeze({ status: "destroyed" });
    }
  };
  globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__ = Object.freeze(api);
  return globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__;
}

installConfidentialPlacementHarness();
