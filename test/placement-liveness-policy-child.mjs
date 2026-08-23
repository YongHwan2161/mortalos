import {
  createPlacementFailureCertificateFixture,
  createPlacementLivenessResponseFixture
} from "../lab/placement/liveness-contract.mjs";
import { createPlacementMembershipFixture } from "../lab/placement/admission-contract.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  evaluatePlacementLivenessEvidence,
  verifyPlacementAdmittedLivenessPolicy,
  verifyPlacementFailureCertificate,
  verifyPlacementLivenessChallenge,
  verifyPlacementLivenessPolicy,
  verifyPlacementLivenessResponse
} from "../src/placement/liveness.mjs";

const resource = new TextEncoder().encode("fresh-process-policy-bound-liveness".repeat(12));
const consumer = await createPlacementSigner();
const provider = await createPlacementSigner();
const observers = await Promise.all(Array.from({ length: 4 }, () => createPlacementSigner()));
const placement = await createStoragePlacementFixture({
  consumer,
  provider,
  resourceBytes: resource,
  seed: 151,
  witnesses: observers
});
const authority = await createContinuityAuthority();
const created = await createContinuity({
  authority,
  resourceBytes: resource,
  transitionId: "fresh-admitted-liveness"
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
  manifest_id: domainHash("MortalOS child liveness manifest", resource),
  membership,
  observers,
  placement,
  provider,
  response_window_ms: "5000",
  shard_index: 0
});
const policy = verifyPlacementLivenessPolicy(failure.policy_bytes);
const admittedPolicy = verifyPlacementAdmittedLivenessPolicy({
  capsule: created.capsule_bytes,
  membership_epoch: membership.epoch_bytes,
  policy: failure.policy_bytes,
  prior_membership_epoch: null
});
const challenge = verifyPlacementLivenessChallenge(failure.challenge_bytes);
const certificate = verifyPlacementFailureCertificate(failure.certificate_bytes);
const evaluated = evaluatePlacementLivenessEvidence({
  certificates: [certificate.bytes],
  responses: []
});
const response = await createPlacementLivenessResponseFixture({
  challenge_bytes: failure.challenge_bytes,
  placement,
  provider,
  resource_bytes: resource
});
const verifiedResponse = verifyPlacementLivenessResponse(response);
const alive = evaluatePlacementLivenessEvidence({ certificates: [], responses: [response] });

process.stdout.write(JSON.stringify({
  authority: challenge.authority,
  certificate_format: certificate.certificate_format,
  membership_admitted: admittedPolicy.membership_admitted,
  membership_reference: policy.membership_reference,
  policy_id: policy.policy_id,
  possession_response: verifiedResponse.response_format,
  response_window_ms: policy.body.response_window_ms,
  status: evaluated.status,
  response_status: alive.status
}));
