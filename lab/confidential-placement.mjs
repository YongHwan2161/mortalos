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
import {
  commitLineagePlacementGeneration,
  convergeLineagePlacementCommits,
  createLineagePlacementGeneration,
  deriveCommittedPlacementActionPlan
} from "../src/placement/lineage-controller.mjs";
import {
  createContinuity,
  createContinuityAuthority,
  handoffContinuity
} from "../src/continuity.mjs";

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
  let continuityAuthority = null;

  function placementRecord(value) {
    return Object.freeze({
      consumption_announcements: value.consumption_announcements_base64url.map(decodeBase64Url),
      execution_receipts: value.execution_receipts_base64url.map(decodeBase64Url),
      lease: decodeBase64Url(value.lease_base64url),
      observed_at_ms: value.observed_at_ms,
      offer: decodeBase64Url(value.offer_base64url),
      revocations: value.revocations_base64url.map(decodeBase64Url),
      shard_index: value.shard_index,
      usage_receipts: value.usage_receipts_base64url.map(decodeBase64Url)
    });
  }

  function controllerCandidate(value) {
    return Object.freeze({
      capsule_bytes: decodeBase64Url(value.capsule_base64url),
      commit_bytes: decodeBase64Url(value.commit_base64url),
      generation_bytes: decodeBase64Url(value.generation_base64url)
    });
  }

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
    async createControllerFromFile(file) {
      if (!fileArrayBuffer || !(file instanceof File)) throw new TypeError("native File required");
      continuityAuthority = await createContinuityAuthority();
      const resourceBytes = new Uint8Array(await reflectApply(fileArrayBuffer, file, []));
      const created = await createContinuity({
        authority: continuityAuthority,
        resourceBytes,
        transitionId: "browser-placement-controller-create"
      });
      return Object.freeze({
        capsule_base64url: encodeBase64Url(created.capsule_bytes),
        head_hash: created.head_hash,
        organism_id: created.organism_id,
        private_material_exposed: false
      });
    },
    async createController() {
      if (continuityAuthority) throw new Error("E_CONTROLLER_ALREADY_CREATED");
      continuityAuthority = await createContinuityAuthority();
      return Object.freeze({
        custodian: materialize(continuityAuthority.custodian),
        private_material_exposed: false
      });
    },
    createPlacementGeneration(options) {
      const generation = createLineagePlacementGeneration({
        capsule_bytes: decodeBase64Url(options.capsule_base64url),
        evaluated_at_ms: options.evaluated_at_ms,
        failure_certificates: options.failure_certificates_base64url.map(decodeBase64Url),
        liveness_responses: options.liveness_responses_base64url.map(decodeBase64Url),
        manifest_bytes: decodeBase64Url(options.manifest_base64url),
        max_proof_age_ms: options.max_proof_age_ms,
        placements: options.placements.map(placementRecord),
        prior_commit_bytes: options.prior_commit_base64url === null
          ? null
          : decodeBase64Url(options.prior_commit_base64url),
        prior_generation_bytes: options.prior_generation_base64url === null
          ? null
          : decodeBase64Url(options.prior_generation_base64url),
        quorum: options.quorum,
        target_shards: options.target_shards
      });
      return Object.freeze({
        generation: generation.generation,
        generation_base64url: encodeBase64Url(generation.bytes),
        generation_id: generation.generation_id,
        repair_shard_indexes: generation.repair_intents.map(({ shard_index: index }) => index),
        status: generation.value.status
      });
    },
    async commitPlacementGeneration(capsuleBase64Url, generationBase64Url) {
      if (!continuityAuthority) throw new Error("E_CONTROLLER_AUTHORITY_UNAVAILABLE");
      const committed = await commitLineagePlacementGeneration({
        authority: continuityAuthority,
        capsule_bytes: decodeBase64Url(capsuleBase64Url),
        generation_bytes: decodeBase64Url(generationBase64Url)
      });
      return Object.freeze({
        capsule_base64url: encodeBase64Url(committed.capsule_bytes),
        commit_base64url: encodeBase64Url(committed.commit_bytes),
        commit_id: committed.commit_id,
        generation_id: committed.generation_id,
        head_hash: committed.head_hash,
        private_material_exposed: false
      });
    },
    async requestControllerHandoff(capsuleBase64Url) {
      if (!continuityAuthority) throw new Error("E_CONTROLLER_AUTHORITY_UNAVAILABLE");
      return materialize(await handoffContinuity({
        authority: continuityAuthority,
        capsuleBytes: decodeBase64Url(capsuleBase64Url),
        phase: "request"
      }));
    },
    async proposeControllerHandoff(capsuleBase64Url, request) {
      if (!continuityAuthority) throw new Error("E_CONTROLLER_AUTHORITY_UNAVAILABLE");
      return materialize(await handoffContinuity({
        authority: continuityAuthority,
        capsuleBytes: decodeBase64Url(capsuleBase64Url),
        phase: "propose",
        request
      }));
    },
    async acceptControllerHandoff(capsuleBase64Url, proposal) {
      if (!continuityAuthority) throw new Error("E_CONTROLLER_AUTHORITY_UNAVAILABLE");
      const handed = await handoffContinuity({
        authority: continuityAuthority,
        capsuleBytes: decodeBase64Url(capsuleBase64Url),
        phase: "accept",
        proposal
      });
      return Object.freeze({
        capsule_base64url: encodeBase64Url(handed.capsule_bytes),
        head_hash: handed.head_hash,
        organism_id: handed.organism_id,
        private_material_exposed: false
      });
    },
    derivePlacementActionPlan(candidate) {
      return materialize(deriveCommittedPlacementActionPlan({
        ...controllerCandidate(candidate),
        observed_at_ms: null,
        observed_liveness_responses: [],
        observed_placements: []
      }));
    },
    convergePlacement(candidates) {
      const converged = convergeLineagePlacementCommits({
        candidates: candidates.map(controllerCandidate)
      });
      return Object.freeze({
        bytes_base64url: encodeBase64Url(converged.bytes),
        value: materialize(converged.value)
      });
    },
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
        manifest_id: created.manifest.manifest_id,
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
      continuityAuthority?.destroy?.();
      continuityAuthority = null;
      return Object.freeze({ status: "destroyed" });
    }
  };
  globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__ = Object.freeze(api);
  return globalThis.__MORTALOS_CONFIDENTIAL_PLACEMENT__;
}

installConfidentialPlacementHarness();
