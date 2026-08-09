import { encodeBase64Url } from "../../src/bytes.mjs";
import { verifyResourceOffer, verifyResourceLease } from "../../src/resource-contract.mjs";
import { verifyResourceExecutionReceipt } from "../../src/resource-execution.mjs";
import {
  createPlacementFailureCertificate,
  finalizePlacementLivenessChallenge,
  finalizePlacementLivenessObservation,
  finalizePlacementLivenessResponse,
  preparePlacementLivenessChallenge,
  preparePlacementLivenessObservation,
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

export async function createPlacementLivenessChallengeFixture({
  consumer,
  lineage_parent_hash,
  manifest_id,
  nonce_seed = 91,
  observers,
  placement,
  response_window_ms = "5000",
  shard_index
}) {
  if (!consumer?.identity || !Array.isArray(observers) || observers.length !== 4) {
    throw new TypeError("consumer and four observer signers are required");
  }
  const context = placementContext(placement);
  if (consumer.identity.key_id !== context.lease.body.consumer.key_id) {
    throw new TypeError("consumer signer does not own the placement lease");
  }
  const roster = [...observers].sort((left, right) =>
    left.identity.key_id < right.identity.key_id ? -1 : 1);
  const agreedPolicy = context.offer.body.witness_policy;
  if (
    agreedPolicy.max_faulty !== 1 || agreedPolicy.threshold !== 3 ||
    JSON.stringify(roster.map(({ identity }) => identity)) !== JSON.stringify(agreedPolicy.witnesses)
  ) throw new TypeError("liveness observers must equal the provider-signed offer witness policy");
  const draft = preparePlacementLivenessChallenge({
    consumer: context.lease.body.consumer,
    failure_sequence: String(Number(context.execution.challenge.body.challenge_sequence) + 1),
    lease_id: context.lease.lease_id,
    lineage_parent_hash,
    manifest_id,
    nonce: nonce(nonce_seed),
    observer_policy: {
      max_faulty: agreedPolicy.max_faulty,
      observers: agreedPolicy.witnesses,
      threshold: agreedPolicy.threshold
    },
    previous_execution_receipt_id: context.execution.receipt_id,
    provider: context.offer.body.provider,
    response_window_ms,
    shard_index,
    workload_id: context.execution.body.workload_id
  });
  const bytes = finalizePlacementLivenessChallenge({
    body: draft.body,
    consumer_signature: await consumer.sign(draft.consumer_signing_message)
  });
  return Object.freeze({ bytes, context, observers: Object.freeze(roster) });
}

export async function createPlacementFailureCertificateFixture(options) {
  const challenge = await createPlacementLivenessChallengeFixture(options);
  return createPlacementFailureCertificateFromChallengeFixture({
    challenge_bytes: challenge.bytes,
    observers: challenge.observers,
    waited_window_ms: options.response_window_ms ?? "5000"
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
  provider
}) {
  if (!provider?.identity) throw new TypeError("provider signer is required");
  const context = placementContext(placement);
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
