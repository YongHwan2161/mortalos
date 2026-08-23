import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  evaluatePlacementLivenessEvidence,
  verifyPlacementAdmittedLivenessPolicy,
  verifyPlacementFailureCertificate,
  verifyPlacementLivenessPolicy
} from "../src/placement/liveness.mjs";
import { createResourcePlacementArtifactMessage } from "../src/transport/protocol.mjs";
import { createPlacementMembershipFixture } from "../lab/placement/admission-contract.mjs";
import { createPlacementFailureCertificateFixture } from "../lab/placement/liveness-contract.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { VirtualTransportNetwork } from "../lab/transport/virtual-transport.mjs";

export async function runPlacementAdmissionBrowserProbe() {
  const resource = new TextEncoder().encode("browser admitted liveness".repeat(48));
  const consumer = await createPlacementSigner();
  const provider = await createPlacementSigner();
  const observers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
  const placement = await createStoragePlacementFixture({
    consumer,
    provider,
    resourceBytes: resource,
    seed: 901,
    witnesses: observers
  });
  const authority = await createContinuityAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: resource,
    transitionId: "browser-admission-probe"
  });
  const membership = await createPlacementMembershipFixture({
    authority,
    capsule_bytes: created.capsule_bytes,
    observers,
    providers: [provider]
  });
  const failure = await createPlacementFailureCertificateFixture({
    consumer,
    lineage_parent_hash: created.head_hash,
    manifest_id: domainHash("MortalOS browser admission manifest", resource),
    membership,
    observers,
    placement,
    provider,
    response_window_ms: "5000",
    shard_index: 0
  });
  const reference = verifyPlacementLivenessPolicy(failure.policy_bytes);
  const admitted = verifyPlacementAdmittedLivenessPolicy({
    capsule: created.capsule_bytes,
    membership_epoch: membership.epoch_bytes,
    policy: failure.policy_bytes,
    prior_membership_epoch: null
  });
  const certificate = verifyPlacementFailureCertificate(failure.certificate_bytes);
  const evaluated = evaluatePlacementLivenessEvidence({
    certificates: [certificate.bytes],
    responses: []
  });
  const network = new VirtualTransportNetwork();
  const endpoint = network.endpoint("browserAdmissionRoom01", "browser-provider");
  const messageSizes = [];
  try {
    for (const [artifactKind, payloadBytes, requestId] of [
      ["resource-descriptors", failure.policy_bytes, "browser-admitted-policy"],
      ["liveness-challenge", failure.challenge_bytes, "browser-admitted-challenge"],
      ["failure-certificate", failure.certificate_bytes, "browser-admitted-certificate"]
    ]) {
      const messageBytes = canonicalBytes(createResourcePlacementArtifactMessage({
        artifactKind,
        payloadBytes,
        requestId
      }));
      if (messageBytes.byteLength > PROTOCOL_PROFILE.transport.message_bytes) {
        throw new Error("admitted liveness artifact exceeds transport ceiling");
      }
      const published = await endpoint.publish(messageBytes);
      if (published.duplicate) throw new Error("fresh admitted liveness artifact deduplicated");
      messageSizes.push(messageBytes.byteLength);
    }
  } finally {
    endpoint.close();
  }
  return Object.freeze({
    admitted: admitted.membership_admitted,
    epoch_id: admitted.membership_epoch_id,
    evaluated_status: evaluated.status,
    maximum_message_bytes: Math.max(...messageSizes),
    policy_id: admitted.policy_id,
    private_material_exposed: false,
    reference: reference.membership_reference,
    transport_message_ceiling: PROTOCOL_PROFILE.transport.message_bytes
  });
}
