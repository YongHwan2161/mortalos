import { decodeBase64Url, encodeBase64Url } from "../../src/bytes.mjs";
import { verifyResourceOffer, verifyResourceLease } from "../../src/resource-contract.mjs";
import {
  createResourceContentCommitment,
  createResourceStoragePossessionProof,
  verifyResourceExecutionReceipt
} from "../../src/resource-execution.mjs";
import {
  createPlacementFailureCertificate,
  finalizeAdmittedPlacementLivenessPolicy,
  finalizePlacementLivenessObservation,
  finalizePlacementLivenessPossessionResponse,
  finalizePlacementLivenessPolicy,
  finalizePlacementLivenessPolicyChallenge,
  finalizePlacementLivenessResponse,
  PLACEMENT_LIVENESS_RESPONSE_PROFILES,
  prepareAdmittedPlacementLivenessPolicy,
  preparePlacementLivenessObservation,
  preparePlacementLivenessPossessionResponse,
  preparePlacementLivenessPolicy,
  preparePlacementLivenessPolicyChallenge,
  preparePlacementLivenessResponse
} from "../../src/placement/liveness.mjs";

function nonce(seed) {
  return encodeBase64Url(new Uint8Array(16).fill(seed & 0xff));
}

function placementRecord(source) {
  const record = source?.placement ?? source;
  if (!record?.offer || !record?.lease || !Array.isArray(record.execution_receipts)) {
    throw new TypeError("a verified placement record is required");
  }
  return record;
}

function placementContext(source) {
  const record = placementRecord(source);
  const offer = verifyResourceOffer(record.offer);
  const lease = verifyResourceLease({ offer: record.offer, lease: record.lease });
  const execution = verifyResourceExecutionReceipt({
    offer: record.offer,
    lease: record.lease,
    previous_execution_receipts: record.execution_receipts.slice(0, -1),
    receipt: record.execution_receipts.at(-1),
    usage_receipts: record.usage_receipts
  });
  return Object.freeze({ execution, lease, offer, record });
}

export async function createPlacementLivenessPolicyFixture({
  consumer,
  lineage_parent_hash,
  manifest_id,
  membership = null,
  membership_evaluated_at_ms = "1500",
  observers,
  placement,
  provider,
  response_proof_profile = PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample,
  response_window_ms = "5000",
  shard_index
}) {
  if (
    !consumer?.identity || !provider?.identity ||
    !Array.isArray(observers) || observers.length !== 4
  ) {
    throw new TypeError("consumer, provider, and four observer signers are required");
  }
  const context = placementContext(placement);
  if (consumer.identity.key_id !== context.lease.body.consumer.key_id) {
    throw new TypeError("consumer signer does not own the placement lease");
  }
  if (provider.identity.key_id !== context.offer.body.provider.key_id) {
    throw new TypeError("provider signer does not own the placement offer");
  }
  const roster = [...observers].sort((left, right) =>
    left.identity.key_id < right.identity.key_id ? -1 : 1);
  const agreedPolicy = context.offer.body.witness_policy;
  if (
    agreedPolicy.max_faulty !== 1 || agreedPolicy.threshold !== 3 ||
    JSON.stringify(roster.map(({ identity }) => identity)) !== JSON.stringify(agreedPolicy.witnesses)
  ) throw new TypeError("liveness observers must equal the provider-signed offer witness policy");
  const policyBody = {
    failure_sequence: String(Number(context.execution.challenge.body.challenge_sequence) + 1),
    lineage_parent_hash,
    manifest_id,
    ...(membership === null ? {} : { membership_evaluated_at_ms }),
    response_proof_profile,
    response_window_ms,
    shard_index,
    workload_id: context.execution.body.workload_id
  };
  const draft = membership === null
    ? preparePlacementLivenessPolicy({
        offer: context.offer.bytes,
        lease: context.lease.bytes,
        body: policyBody
      })
    : prepareAdmittedPlacementLivenessPolicy({
        body: policyBody,
        capsule: membership.capsule_bytes,
        lease: context.lease.bytes,
        membership_epoch: membership.epoch_bytes,
        offer: context.offer.bytes,
        prior_membership_epoch: membership.prior_epoch_bytes
      });
  const providerSignature = await provider.sign(draft.provider_signing_message);
  const bytes = membership === null
    ? finalizePlacementLivenessPolicy({
        body: draft.body,
        lease: context.lease.bytes,
        offer: context.offer.bytes,
        provider_signature: providerSignature
      })
    : finalizeAdmittedPlacementLivenessPolicy({
        body: draft.body,
        capsule: membership.capsule_bytes,
        lease: context.lease.bytes,
        membership_epoch: membership.epoch_bytes,
        offer: context.offer.bytes,
        prior_membership_epoch: membership.prior_epoch_bytes,
        provider_signature: providerSignature
      });
  return Object.freeze({
    bytes,
    context,
    observers: Object.freeze(roster),
    policy_id: draft.policy_id
  });
}

export async function createPlacementLivenessChallengeFixture(options) {
  const policy = await createPlacementLivenessPolicyFixture(options);
  const draft = preparePlacementLivenessPolicyChallenge({
    nonce: nonce(options.nonce_seed ?? 91),
    policy: policy.bytes,
    previous_execution_receipt_id: policy.context.execution.receipt_id
  });
  const bytes = finalizePlacementLivenessPolicyChallenge({
    consumer_signature: await options.consumer.sign(draft.consumer_signing_message),
    nonce: nonce(options.nonce_seed ?? 91),
    policy: policy.bytes,
    previous_execution_receipt_id: policy.context.execution.receipt_id
  });
  return Object.freeze({
    bytes,
    context: policy.context,
    observers: policy.observers,
    policy_bytes: policy.bytes,
    policy_id: policy.policy_id
  });
}

export async function createPlacementFailureCertificateFixture(options) {
  const challenge = await createPlacementLivenessChallengeFixture(options);
  const certificate = await createPlacementFailureCertificateFromChallengeFixture({
    challenge_bytes: challenge.bytes,
    observers: challenge.observers,
    waited_window_ms: options.response_window_ms ?? "5000"
  });
  return Object.freeze({
    ...certificate,
    policy_bytes: challenge.policy_bytes,
    policy_id: challenge.policy_id
  });
}

export async function createPlacementFailureCertificateFromChallengeFixture({
  challenge_bytes,
  observers,
  waited_window_ms
}) {
  const observations = [];
  const roster = [...observers].sort((left, right) =>
    left.identity.key_id < right.identity.key_id ? -1 : 1);
  for (const observer of roster.slice(0, 3)) {
    const draft = preparePlacementLivenessObservation({
      challenge: challenge_bytes,
      observer: observer.identity,
      waited_window_ms
    });
    observations.push(finalizePlacementLivenessObservation({
      challenge: challenge_bytes,
      observer: observer.identity,
      observer_signature: await observer.sign(draft.observer_signing_message),
      waited_window_ms
    }));
  }
  const certificate = createPlacementFailureCertificate({
    challenge: challenge_bytes,
    observations
  });
  return Object.freeze({
    certificate_bytes: certificate.bytes,
    certificate_id: certificate.certificate_id,
    challenge_bytes,
    observations: Object.freeze(observations)
  });
}

export async function createPlacementLivenessResponseFixture({
  challenge_bytes,
  placement,
  provider,
  resource_bytes
}) {
  if (!provider?.identity) throw new TypeError("provider signer is required");
  const context = placementContext(placement);
  if (resource_bytes === undefined) {
    const draft = preparePlacementLivenessResponse({
      challenge: challenge_bytes,
      execution_receipt_id: context.execution.receipt_id,
      provider: provider.identity
    });
    return finalizePlacementLivenessResponse({
      challenge: challenge_bytes,
      execution_receipt_id: context.execution.receipt_id,
      provider: provider.identity,
      provider_signature: await provider.sign(draft.provider_signing_message)
    });
  }
  const workload = createResourceContentCommitment(resource_bytes);
  const challenge = JSON.parse(new TextDecoder().decode(challenge_bytes));
  const policy = JSON.parse(new TextDecoder().decode(decodeBase64Url(
    challenge.body.policy_base64url
  )));
  const proof = createResourceStoragePossessionProof({
    challenge_nonce: challenge.body.nonce,
    lease_id: policy.body.lease_id,
    resource_bytes,
    workload
  });
  const draft = preparePlacementLivenessPossessionResponse({
    challenge: challenge_bytes,
    proof,
    provider: provider.identity,
    workload
  });
  return finalizePlacementLivenessPossessionResponse({
    challenge: challenge_bytes,
    proof,
    provider: provider.identity,
    provider_signature: await provider.sign(draft.provider_signing_message),
    workload
  });
}
