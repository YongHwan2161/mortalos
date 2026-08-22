import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes } from "../src/codec.mjs";
import { createContinuityCapsule } from "../src/capsule.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import {
  custodyCommitment,
  deriveResourceExecutionWorkloadId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  pulseApprovalMessage
} from "../src/index.mjs";
import { createLineage } from "../src/lineage.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import {
  convergePlacementMembershipEpochs,
  createPlacementAdmissionTrustRoot,
  derivePlacementObserverRoster,
  finalizePlacementAdmissionEvidence,
  finalizePlacementMembershipEpoch,
  preparePlacementAdmissionEvidence,
  preparePlacementMembershipEpoch,
  restorePlacementMembershipEpoch,
  verifyPlacementAdmissionEvidence,
  verifyPlacementMembershipEpoch
} from "../src/placement/admission.mjs";
import {
  createPlacementFailureCertificate,
  evaluatePlacementLivenessEvidence,
  finalizeAdmittedPlacementLivenessPolicy,
  finalizePlacementLivenessObservation,
  finalizePlacementLivenessPolicyChallenge,
  PLACEMENT_LIVENESS_RESPONSE_PROFILES,
  prepareAdmittedPlacementLivenessPolicy,
  preparePlacementLivenessObservation,
  preparePlacementLivenessPolicyChallenge,
  verifyPlacementAdmittedLivenessPolicy,
  verifyPlacementLivenessPolicy
} from "../src/placement/liveness.mjs";
import { createResourceContentCommitment } from "../src/resource-execution.mjs";
import { createResourcePlacementArtifactMessage } from "../src/transport/protocol.mjs";
import {
  createInitialState,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../src/state/engine.mjs";
import { createStatePackageTransitionPayload } from "../src/state/package.mjs";
import {
  createPlacementSigner,
  createStoragePlacementFixture
} from "../lab/placement/storage-contract.mjs";
import { VirtualTransportNetwork } from "../lab/transport/virtual-transport.mjs";

const encoder = new TextEncoder();

function digest(label) {
  return domainHash("MortalOS placement admission test", encoder.encode(label));
}

async function admissionEvidence({
  domainId,
  evidenceLabel,
  issuer,
  operatorId,
  roles,
  root,
  subject
}) {
  const prepared = preparePlacementAdmissionEvidence({
    body: {
      attestation_challenge_base64url: encodeBase64Url(canonicalBytes({
        evidence_label: evidenceLabel,
        subject_key_id: subject.identity.key_id
      })),
      attestation_kind: "operator-domain-membership",
      failure_domain_id: domainId,
      issued_at_ms: "1250",
      operator_root_id: operatorId,
      roles,
      subject: subject.identity,
      valid_from_ms: "1200",
      valid_until_ms: "8800"
    },
    trust_root: root
  });
  return finalizePlacementAdmissionEvidence({
    body: prepared.body,
    issuer_signature: await issuer.sign(prepared.issuer_signing_message),
    subject_signature: await subject.sign(prepared.subject_signing_message),
    trust_root: root
  });
}

async function membershipEpoch({
  authority,
  capsuleBytes,
  evidence,
  expiresAt = "8000",
  priorEpochBytes = null,
  revokedTrustRootIds = [],
  roots
}) {
  const prepared = preparePlacementMembershipEpoch({
    capsule_bytes: capsuleBytes,
    parameters: {
      admission_evidence: evidence,
      evaluated_at_ms: priorEpochBytes === null ? "2000" : "3000",
      expires_at_ms: expiresAt,
      observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
      revoked_trust_root_ids: revokedTrustRootIds,
      trust_roots: roots
    },
    prior_epoch_bytes: priorEpochBytes
  });
  const approval = await authority.sign({
    message: prepared.custody_approval_message,
    tuple: prepared.custody_approval_tuple
  });
  return Object.freeze({
    bytes: finalizePlacementMembershipEpoch({
      approvals: [approval],
      body: prepared.body,
      capsule_bytes: capsuleBytes,
      prior_epoch_bytes: priorEpochBytes
    }),
    prepared
  });
}

async function fixture() {
  const authority = await createContinuityAuthority();
  const created = await createContinuity({
    authority,
    resourceBytes: encoder.encode("placement admission fixture".repeat(32)),
    transitionId: "placement-admission-fixture"
  });
  const issuer = await createPlacementSigner();
  const provider = await createPlacementSigner();
  const consumer = await createPlacementSigner();
  const observers = await Promise.all(Array.from({ length: 7 }, () => createPlacementSigner()));
  const root = createPlacementAdmissionTrustRoot({
    authority_id: digest("issuer-authority-v1"),
    issuer: issuer.identity,
    lineage_organism_id: created.organism_id,
    policy_digest: digest("issuer-policy-v1"),
    prior_trust_root_id: null,
    sequence: "1",
    scope_digest: digest("placement-scope-v1"),
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  return { authority, consumer, created, issuer, observers, provider, root };
}

async function unfencedContinuityFixture() {
  const signer = await createPlacementSigner();
  const initial = createInitialState(new Uint8Array(16).fill(41));
  const genomeHash = stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES);
  const statePackage = createStatePackageTransitionPayload({
    genomeHash,
    inputBytes: canonicalBytes({
      format: "mortalos-state-package-input/1",
      operation: "replace-resource",
      transition_id: "placement-admission-fork"
    }),
    priorStateRoot: stateRoot(initial),
    resourceBytes: encoder.encode("unfenced membership fork fixture".repeat(32))
  });
  const genesisBody = {
    genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
    genome_hash: genomeHash,
    hash_algorithm: "sha-256",
    initial_custodians: [signer.identity],
    initial_quorum: { threshold: 1, type: "threshold" },
    initial_state_base64url: encodeBase64Url(initial),
    initial_state_root: stateRoot(initial),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(42))}`,
    protocol_version: "mortalos/1",
    signature_algorithm: "ed25519"
  };
  const birth = {
    approvals: [{
      key_id: signer.identity.key_id,
      signature: await signer.sign(genesisApprovalMessage(genesisBody))
    }],
    body: genesisBody,
    kind: "mortalos.genesis"
  };
  const lineage = createLineage(canonicalBytes(birth));
  assert.equal(lineage.status, "accept");
  const parent = lineage.lineage.head;
  const pulseBody = {
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    event: { kind: "state-transition", payload_hash: eventPayloadHash(statePackage.payload) },
    genome_hash: genomeHash,
    next_custodians: parent.next_custody_descriptor.custodians,
    next_quorum: parent.next_custody_descriptor.quorum,
    organism_id: lineage.lineage.genesis.organism_id,
    parent_hash: parent.object_hash,
    protocol_version: "mortalos/1",
    sequence: "1",
    state_root: statePackage.nextStateRoot
  };
  const pulse = {
    acceptances: [],
    approvals: [{
      key_id: signer.identity.key_id,
      signature: await signer.sign(pulseApprovalMessage(pulseBody))
    }],
    body: pulseBody,
    kind: "mortalos.pulse"
  };
  const capsule = createContinuityCapsule({
    records: [
      { envelope: birth, payload: {} },
      { envelope: pulse, payload: statePackage.payload }
    ],
    statePackage
  });
  return Object.freeze({
    authority: Object.freeze({
      custodian: signer.identity,
      async sign({ message }) {
        return Object.freeze({
          key_id: signer.identity.key_id,
          signature: await signer.sign(message)
        });
      }
    }),
    capsule,
    signer
  });
}

async function evidenceSet(context, entries) {
  return Promise.all(entries.map((entry, index) => admissionEvidence({
    domainId: digest(entry.domain),
    evidenceLabel: `evidence-${entry.label ?? index}`,
    issuer: context.issuer,
    operatorId: digest(entry.operator),
    roles: entry.roles,
    root: context.root,
    subject: entry.subject
  })));
}

function selection(context) {
  return {
    consumer_key_id: context.consumer.identity.key_id,
    failure_sequence: "1",
    lineage_parent_hash: context.created.head_hash,
    manifest_id: digest("manifest"),
    provider_key_id: context.provider.identity.key_id,
    shard_index: 0,
    workload_id: `resource-workload:${"A".repeat(43)}`
  };
}

test("lineage-approved membership deduplicates aliases and deterministically selects independent observers", { timeout: 120_000 }, async () => {
  const context = await fixture();
  const evidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    { domain: "domain-1", operator: "operator-1", roles: ["observer"], subject: context.observers[0] },
    { domain: "domain-2", operator: "operator-2", roles: ["observer"], subject: context.observers[1] },
    { domain: "domain-3", operator: "operator-3", roles: ["observer"], subject: context.observers[2] },
    { domain: "domain-4", operator: "operator-4", roles: ["observer"], subject: context.observers[3] },
    { domain: "domain-5", operator: "operator-1", roles: ["observer"], subject: context.observers[4] },
    { domain: "domain-1", operator: "operator-5", roles: ["observer"], subject: context.observers[5] }
  ]);
  const firstPrepared = preparePlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    parameters: {
      admission_evidence: evidence,
      evaluated_at_ms: "2000",
      expires_at_ms: "8000",
      observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
      revoked_trust_root_ids: [],
      trust_roots: [context.root]
    },
    prior_epoch_bytes: null
  });
  const reorderedPrepared = preparePlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    parameters: {
      admission_evidence: [...evidence].reverse(),
      evaluated_at_ms: "2000",
      expires_at_ms: "8000",
      observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
      revoked_trust_root_ids: [],
      trust_roots: [context.root]
    },
    prior_epoch_bytes: null
  });
  assert.equal(reorderedPrepared.epoch_id, firstPrepared.epoch_id);
  const approval = await context.authority.sign({
    message: firstPrepared.custody_approval_message,
    tuple: firstPrepared.custody_approval_tuple
  });
  const epochBytes = finalizePlacementMembershipEpoch({
    approvals: [approval],
    body: firstPrepared.body,
    capsule_bytes: context.created.capsule_bytes,
    prior_epoch_bytes: null
  });
  const verified = verifyPlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: epochBytes,
    prior_epoch_bytes: null
  });
  assert.equal(verified.status, "verified");
  assert.equal(verified.members.length, 7);

  const rosterA = derivePlacementObserverRoster({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: epochBytes,
    evaluated_at_ms: "2500",
    prior_epoch_bytes: null,
    selection: selection(context)
  });
  const rosterB = derivePlacementObserverRoster({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: epochBytes,
    evaluated_at_ms: "2500",
    prior_epoch_bytes: null,
    selection: selection(context)
  });
  assert.deepEqual(rosterB, rosterA);
  assert.equal(rosterA.observer_policy.observers.length, 4);
  assert.equal(rosterA.observer_policy.threshold, 3);
  assert.equal(rosterA.accounting.independent_weight, 4);
  assert.equal(rosterA.accounting.self_asserted_weight, 0);
  assert.equal(new Set(rosterA.accounting.observers.map((entry) => entry.operator_root_id)).size, 4);
  assert.equal(new Set(rosterA.accounting.observers.map((entry) => entry.failure_domain_id)).size, 4);
  assert.equal(rosterA.accounting.observers.some((entry) =>
    entry.operator_root_id === rosterA.accounting.provider.operator_root_id ||
    entry.failure_domain_id === rosterA.accounting.provider.failure_domain_id), false);

  const openedEvidence = verifyPlacementAdmissionEvidence({
    evaluated_at_ms: "2500",
    evidence_bytes: evidence[0],
    trust_root: context.root
  });
  assert.equal(openedEvidence.body.subject.key_id, context.provider.identity.key_id);
  assert.equal(openedEvidence.body.attestation_kind, "operator-domain-membership");

  const subjectSignatureTamper = JSON.parse(new TextDecoder().decode(evidence[0]));
  subjectSignatureTamper.subject_signature = subjectSignatureTamper.issuer_signature;
  assert.throws(
    () => verifyPlacementAdmissionEvidence({
      evaluated_at_ms: "2500",
      evidence_bytes: canonicalBytes(subjectSignatureTamper),
      trust_root: context.root
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_SIGNATURE" &&
      error.detail === "evidence-subject"
  );

  const boundaryBody = {
    attestation_challenge_base64url: encodeBase64Url(new Uint8Array(
      PROTOCOL_PROFILE.placement_admission.attestation_challenge_bytes_max
    ).fill(7)),
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("boundary-domain"),
    issued_at_ms: "1250",
    operator_root_id: digest("boundary-operator"),
    roles: ["observer"],
    subject: context.observers[6].identity,
    valid_from_ms: "1200",
    valid_until_ms: "8800"
  };
  assert.doesNotThrow(() => preparePlacementAdmissionEvidence({
    body: boundaryBody,
    trust_root: context.root
  }));
  assert.throws(
    () => preparePlacementAdmissionEvidence({
      body: {
        ...boundaryBody,
        attestation_challenge_base64url: encodeBase64Url(new Uint8Array(
          PROTOCOL_PROFILE.placement_admission.attestation_challenge_bytes_max + 1
        ).fill(7))
      },
      trust_root: context.root
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_LIMIT" &&
      error.detail === "attestation-challenge"
  );
  assert.throws(
    () => preparePlacementAdmissionEvidence({
      body: { ...boundaryBody, subject: context.issuer.identity },
      trust_root: context.root
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_IDENTITY" &&
      error.detail === "issuer-subject-role-overlap"
  );

  const insufficient = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    { domain: "domain-a", operator: "operator-a", roles: ["observer"], subject: context.observers[0] },
    { domain: "domain-b", operator: "operator-b", roles: ["observer"], subject: context.observers[1] },
    { domain: "domain-c", operator: "operator-c", roles: ["observer"], subject: context.observers[2] },
    { domain: "domain-d", operator: "operator-a", roles: ["observer"], subject: context.observers[3] }
  ]);
  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: insufficient,
        evaluated_at_ms: "2000",
        expires_at_ms: "8000",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [],
        trust_roots: [context.root]
      },
      prior_epoch_bytes: null
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_POLICY" &&
      error.detail === "insufficient-independent-membership"
  );
});

test("provider policy and challenge inherit the exact admitted epoch and deterministic roster", { timeout: 120_000 }, async () => {
  const context = await fixture();
  const evidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    ...[0, 1, 2, 3, 4, 5].map((index) => ({
      domain: `domain-${index + 1}`,
      operator: `operator-${index + 1}`,
      roles: ["observer"],
      subject: context.observers[index]
    }))
  ]);
  const epoch = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence,
    roots: [context.root]
  });
  const resource = encoder.encode("admitted liveness storage".repeat(128));
  const workload = createResourceContentCommitment(resource);
  const workloadId = deriveResourceExecutionWorkloadId({ kind: "storage", workload });
  const roster = derivePlacementObserverRoster({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: epoch.bytes,
    evaluated_at_ms: "2500",
    prior_epoch_bytes: null,
    selection: {
      consumer_key_id: context.consumer.identity.key_id,
      failure_sequence: "1",
      lineage_parent_hash: context.created.head_hash,
      manifest_id: digest("admitted-manifest"),
      provider_key_id: context.provider.identity.key_id,
      shard_index: 0,
      workload_id: workloadId
    }
  });
  const signersById = new Map(context.observers.map((signer) => [signer.identity.key_id, signer]));
  const witnesses = roster.observer_policy.observers.map(({ key_id: keyId }) => signersById.get(keyId));
  assert.equal(witnesses.every(Boolean), true);
  const placement = await createStoragePlacementFixture({
    consumer: context.consumer,
    provider: context.provider,
    resourceBytes: resource,
    seed: 701,
    witnesses
  });
  assert.equal(placement.expected_workload_id, workloadId);
  const policyDraft = prepareAdmittedPlacementLivenessPolicy({
    body: {
      failure_sequence: "1",
      lineage_parent_hash: context.created.head_hash,
      manifest_id: digest("admitted-manifest"),
      membership_evaluated_at_ms: "2500",
      response_proof_profile: PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample,
      response_window_ms: "5000",
      shard_index: 0,
      workload_id: workloadId
    },
    capsule: context.created.capsule_bytes,
    lease: placement.placement.lease,
    membership_epoch: epoch.bytes,
    offer: placement.placement.offer,
    prior_membership_epoch: null
  });
  const policyBytes = finalizeAdmittedPlacementLivenessPolicy({
    body: policyDraft.body,
    capsule: context.created.capsule_bytes,
    lease: placement.placement.lease,
    membership_epoch: epoch.bytes,
    offer: placement.placement.offer,
    prior_membership_epoch: null,
    provider_signature: await context.provider.sign(policyDraft.provider_signing_message)
  });
  const genericPolicy = verifyPlacementLivenessPolicy(policyBytes);
  const admittedPolicy = verifyPlacementAdmittedLivenessPolicy({
    capsule: context.created.capsule_bytes,
    membership_epoch: epoch.bytes,
    policy: policyBytes,
    prior_membership_epoch: null
  });
  assert.equal(genericPolicy.membership_admitted, false);
  assert.equal(genericPolicy.membership_reference, true);
  assert.equal(admittedPolicy.membership_epoch_id, epoch.prepared.epoch_id);
  assert.equal(admittedPolicy.membership_selection_digest, roster.selection_digest);
  assert.deepEqual(admittedPolicy.body.observer_policy, roster.observer_policy);

  const receiptDocument = JSON.parse(new TextDecoder().decode(
    placement.placement.execution_receipts.at(-1)
  ));
  const challengeDraft = preparePlacementLivenessPolicyChallenge({
    nonce: encodeBase64Url(new Uint8Array(16).fill(77)),
    policy: policyBytes,
    previous_execution_receipt_id: receiptDocument.receipt_id
  });
  const challengeBytes = finalizePlacementLivenessPolicyChallenge({
    consumer_signature: await context.consumer.sign(challengeDraft.consumer_signing_message),
    nonce: encodeBase64Url(new Uint8Array(16).fill(77)),
    policy: policyBytes,
    previous_execution_receipt_id: receiptDocument.receipt_id
  });
  assert.equal(policyBytes.byteLength <= PROTOCOL_PROFILE.transport.message_bytes, true);
  assert.equal(challengeBytes.byteLength <= PROTOCOL_PROFILE.transport.message_bytes, true);
  const observations = [];
  for (const observer of witnesses.slice(0, 3)) {
    const draft = preparePlacementLivenessObservation({
      challenge: challengeBytes,
      observer: observer.identity,
      waited_window_ms: "5000"
    });
    observations.push(finalizePlacementLivenessObservation({
      challenge: challengeBytes,
      observer: observer.identity,
      observer_signature: await observer.sign(draft.observer_signing_message),
      waited_window_ms: "5000"
    }));
  }
  const certificate = createPlacementFailureCertificate({
    challenge: challengeBytes,
    observations
  });
  assert.equal(certificate.bytes.byteLength <= PROTOCOL_PROFILE.transport.message_bytes, true);
  const network = new VirtualTransportNetwork();
  const endpoint = network.endpoint("admittedLivenessRoom01", "policy-provider");
  try {
    for (const [artifactKind, payloadBytes, requestId] of [
      ["resource-descriptors", policyBytes, "admitted-policy"],
      ["liveness-challenge", challengeBytes, "admitted-challenge"],
      ["failure-certificate", certificate.bytes, "admitted-certificate"]
    ]) {
      const messageBytes = canonicalBytes(createResourcePlacementArtifactMessage({
        artifactKind,
        payloadBytes,
        requestId
      }));
      assert.equal(messageBytes.byteLength <= PROTOCOL_PROFILE.transport.message_bytes, true);
      assert.equal((await endpoint.publish(messageBytes)).duplicate, false);
    }
  } finally {
    endpoint.close();
  }
  const evaluated = evaluatePlacementLivenessEvidence({
    certificates: [certificate.bytes],
    responses: []
  });
  assert.equal(evaluated.status, "failed");
  assert.equal(evaluated.cases[0].membership_admitted, false);
  assert.equal(evaluated.cases[0].membership_reference, true);
  assert.equal(evaluated.cases[0].membership_epoch_id, epoch.prepared.epoch_id);
  assert.equal(evaluated.cases[0].membership_selection_digest, roster.selection_digest);

  const wrongWitnesses = [...witnesses];
  wrongWitnesses[0] = context.observers.find((candidate) =>
    !roster.observer_policy.observers.some(({ key_id: keyId }) =>
      keyId === candidate.identity.key_id));
  await assert.rejects(
    createStoragePlacementFixture({
      consumer: context.consumer,
      provider: context.provider,
      resourceBytes: resource,
      seed: 702,
      witnesses: wrongWitnesses
    }).then((wrongPlacement) => prepareAdmittedPlacementLivenessPolicy({
      body: {
        failure_sequence: "1",
        lineage_parent_hash: context.created.head_hash,
        manifest_id: digest("admitted-manifest"),
        membership_evaluated_at_ms: "2500",
        response_proof_profile: PLACEMENT_LIVENESS_RESPONSE_PROFILES.storage_merkle_sample,
        response_window_ms: "5000",
        shard_index: 0,
        workload_id: workloadId
      },
      capsule: context.created.capsule_bytes,
      lease: wrongPlacement.placement.lease,
      membership_epoch: epoch.bytes,
      offer: wrongPlacement.placement.offer,
      prior_membership_epoch: null
    })),
    (error) => error.code === "E_PLACEMENT_LIVENESS_ADMISSION" &&
      error.detail === "offer-roster-not-admitted"
  );
});

test("adjacent epochs preserve operator and domain quorum intersection and sign once", { timeout: 120_000 }, async () => {
  const context = await fixture();
  const firstEvidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    ...[0, 1, 2, 3, 4].map((index) => ({
      domain: `domain-${index + 1}`,
      operator: `operator-${index + 1}`,
      roles: ["observer"],
      subject: context.observers[index]
    }))
  ]);
  const first = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence: firstEvidence,
    roots: [context.root]
  });
  assert.equal(restorePlacementMembershipEpoch(first.bytes).body.epoch, "1");

  const rotatedEvidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    { domain: "domain-1", operator: "operator-1", roles: ["observer"], subject: context.observers[5], label: "rotated-1" },
    { domain: "domain-2", operator: "operator-2", roles: ["observer"], subject: context.observers[1] },
    { domain: "domain-3", operator: "operator-3", roles: ["observer"], subject: context.observers[2] },
    { domain: "domain-4", operator: "operator-4", roles: ["observer"], subject: context.observers[3] },
    { domain: "domain-5", operator: "operator-5", roles: ["observer"], subject: context.observers[4] }
  ]);
  const second = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence: rotatedEvidence,
    priorEpochBytes: first.bytes,
    roots: [context.root]
  });
  const verifiedSecond = verifyPlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: second.bytes,
    prior_epoch_bytes: first.bytes
  });
  assert.equal(verifiedSecond.body.epoch, "2");
  assert.equal(verifiedSecond.body.prior_epoch_id, first.prepared.epoch_id);

  const unsafeEvidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: context.provider },
    { domain: "new-domain-1", operator: "new-operator-1", roles: ["observer"], subject: context.observers[0] },
    { domain: "new-domain-2", operator: "new-operator-2", roles: ["observer"], subject: context.observers[1] },
    { domain: "new-domain-3", operator: "new-operator-3", roles: ["observer"], subject: context.observers[2] },
    { domain: "new-domain-4", operator: "new-operator-4", roles: ["observer"], subject: context.observers[3] }
  ]);
  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: unsafeEvidence,
        evaluated_at_ms: "3000",
        expires_at_ms: "8000",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [],
        trust_roots: [context.root]
      },
      prior_epoch_bytes: first.bytes
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_INTERSECTION"
  );

  const forkPrepared = preparePlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    parameters: {
      admission_evidence: rotatedEvidence,
      evaluated_at_ms: "3000",
      expires_at_ms: "7900",
      observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
      revoked_trust_root_ids: [],
      trust_roots: [context.root]
    },
    prior_epoch_bytes: first.bytes
  });
  assert.notEqual(forkPrepared.epoch_id, second.prepared.epoch_id);
  await assert.rejects(
    context.authority.sign({
      message: forkPrepared.custody_approval_message,
      tuple: forkPrepared.custody_approval_tuple
    }),
    (error) => error.code === "E_CONTINUITY_EQUIVOCATION"
  );
});

test("trust-root rotation and revocation are direct, cumulative, and rollback-safe", { timeout: 120_000 }, async () => {
  const context = await fixture();
  const entries = [
    { domain: "root-domain-0", operator: "root-operator-0", roles: ["provider"], subject: context.provider },
    ...[0, 1, 2, 3, 4].map((index) => ({
      domain: `root-domain-${index + 1}`,
      operator: `root-operator-${index + 1}`,
      roles: ["observer"],
      subject: context.observers[index]
    }))
  ];
  const firstEvidence = await evidenceSet(context, entries);
  const first = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence: firstEvidence,
    roots: [context.root]
  });

  const rotatedIssuer = await createPlacementSigner();
  const rotatedRoot = createPlacementAdmissionTrustRoot({
    authority_id: context.root.authority_id,
    issuer: rotatedIssuer.identity,
    lineage_organism_id: context.created.organism_id,
    policy_digest: digest("issuer-policy-v2"),
    prior_trust_root_id: context.root.trust_root_id,
    sequence: "2",
    scope_digest: digest("placement-scope-v2"),
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  const rotatedContext = { ...context, issuer: rotatedIssuer, root: rotatedRoot };
  const rotatedEvidence = await evidenceSet(rotatedContext, entries);
  const second = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence: rotatedEvidence,
    priorEpochBytes: first.bytes,
    roots: [rotatedRoot]
  });
  const verifiedSecond = verifyPlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: second.bytes,
    prior_epoch_bytes: first.bytes
  });
  assert.equal(verifiedSecond.trust_roots[0].sequence, "2");
  assert.equal(verifiedSecond.trust_roots[0].prior_trust_root_id, context.root.trust_root_id);
  assert.deepEqual(verifiedSecond.body.retired_trust_root_authority_ids, []);
  assert.equal(verifiedSecond.body.trust_root_history.length, 2);

  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: firstEvidence,
        evaluated_at_ms: "3000",
        expires_at_ms: "7900",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [],
        trust_roots: [context.root]
      },
      prior_epoch_bytes: second.bytes
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE" &&
      error.detail === "trust-root-rotation"
  );

  const issuerKeyRollbackRoot = createPlacementAdmissionTrustRoot({
    authority_id: context.root.authority_id,
    issuer: context.issuer.identity,
    lineage_organism_id: context.created.organism_id,
    policy_digest: digest("issuer-policy-v3-rollback"),
    prior_trust_root_id: rotatedRoot.trust_root_id,
    sequence: "3",
    scope_digest: digest("placement-scope-v3-rollback"),
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: firstEvidence,
        evaluated_at_ms: "3000",
        expires_at_ms: "7900",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [],
        trust_roots: [issuerKeyRollbackRoot]
      },
      prior_epoch_bytes: second.bytes
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE" &&
      error.detail === "issuer-key-rollback"
  );
  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: rotatedEvidence,
        evaluated_at_ms: "3000",
        expires_at_ms: "7900",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [context.root.trust_root_id],
        trust_roots: [rotatedRoot]
      },
      prior_epoch_bytes: first.bytes
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE" &&
      error.detail === "trust-root-rotation"
  );

  const replacementIssuer = await createPlacementSigner();
  const replacementRoot = createPlacementAdmissionTrustRoot({
    authority_id: digest("replacement-root-authority"),
    issuer: replacementIssuer.identity,
    lineage_organism_id: context.created.organism_id,
    policy_digest: digest("replacement-policy-v1"),
    prior_trust_root_id: null,
    sequence: "1",
    scope_digest: digest("replacement-scope-v1"),
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  const replacementContext = { ...context, issuer: replacementIssuer, root: replacementRoot };
  const replacementEvidence = await evidenceSet(replacementContext, entries);
  const third = await membershipEpoch({
    authority: context.authority,
    capsuleBytes: context.created.capsule_bytes,
    evidence: replacementEvidence,
    expiresAt: "7900",
    priorEpochBytes: second.bytes,
    revokedTrustRootIds: [rotatedRoot.trust_root_id],
    roots: [replacementRoot]
  });
  const verifiedThird = verifyPlacementMembershipEpoch({
    capsule_bytes: context.created.capsule_bytes,
    epoch_bytes: third.bytes,
    prior_epoch_bytes: second.bytes
  });
  assert.deepEqual(
    verifiedThird.body.retired_trust_root_authority_ids,
    [context.root.authority_id]
  );
  assert.equal(verifiedThird.body.trust_root_history.length, 3);
  assert.throws(
    () => preparePlacementMembershipEpoch({
      capsule_bytes: context.created.capsule_bytes,
      parameters: {
        admission_evidence: firstEvidence,
        evaluated_at_ms: "3000",
        expires_at_ms: "7800",
        observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
        revoked_trust_root_ids: [replacementRoot.trust_root_id],
        trust_roots: [context.root]
      },
      prior_epoch_bytes: third.bytes
    }),
    (error) => error.code === "E_PLACEMENT_ADMISSION_ROOT_LIFECYCLE" &&
      error.detail === "trust-root-authority-reuse"
  );
});

test("independently valid membership siblings converge to a deterministic halt", { timeout: 120_000 }, async () => {
  const lineage = await unfencedContinuityFixture();
  const issuer = await createPlacementSigner();
  const provider = await createPlacementSigner();
  const consumer = await createPlacementSigner();
  const observers = await Promise.all(Array.from({ length: 6 }, () => createPlacementSigner()));
  const context = {
    authority: lineage.authority,
    consumer,
    created: {
      capsule_bytes: lineage.capsule.bytes,
      head_hash: lineage.capsule.head_hash,
      organism_id: lineage.capsule.organism_id
    },
    issuer,
    observers,
    provider
  };
  context.root = createPlacementAdmissionTrustRoot({
    authority_id: digest("fork-authority"),
    issuer: issuer.identity,
    lineage_organism_id: context.created.organism_id,
    policy_digest: digest("fork-policy"),
    prior_trust_root_id: null,
    sequence: "1",
    scope_digest: digest("fork-scope"),
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  const firstEvidence = await evidenceSet(context, [
    { domain: "domain-0", operator: "operator-0", roles: ["provider"], subject: provider },
    ...[0, 1, 2, 3, 4].map((index) => ({
      domain: `domain-${index + 1}`,
      operator: `operator-${index + 1}`,
      roles: ["observer"],
      subject: observers[index]
    }))
  ]);
  const first = await membershipEpoch({
    authority: lineage.authority,
    capsuleBytes: lineage.capsule.bytes,
    evidence: firstEvidence,
    roots: [context.root]
  });
  const childA = await membershipEpoch({
    authority: lineage.authority,
    capsuleBytes: lineage.capsule.bytes,
    evidence: firstEvidence,
    expiresAt: "7900",
    priorEpochBytes: first.bytes,
    roots: [context.root]
  });
  const childB = await membershipEpoch({
    authority: lineage.authority,
    capsuleBytes: lineage.capsule.bytes,
    evidence: firstEvidence,
    expiresAt: "7800",
    priorEpochBytes: first.bytes,
    roots: [context.root]
  });
  assert.notEqual(childA.prepared.epoch_id, childB.prepared.epoch_id);
  const forward = convergePlacementMembershipEpochs({
    candidates: [first.bytes, childA.bytes, childB.bytes],
    capsule_bytes: lineage.capsule.bytes
  });
  const reverse = convergePlacementMembershipEpochs({
    candidates: [childB.bytes, first.bytes, childA.bytes, childA.bytes],
    capsule_bytes: lineage.capsule.bytes
  });
  assert.equal(forward.status, "halted");
  assert.equal(forward.reason, "membership-fork");
  assert.deepEqual(reverse, forward);

  const complete = convergePlacementMembershipEpochs({
    candidates: [childA.bytes, first.bytes],
    capsule_bytes: lineage.capsule.bytes
  });
  assert.equal(complete.status, "converged");
  assert.equal(complete.epoch_id, childA.prepared.epoch_id);
  assert.deepEqual(complete.epoch_bytes, childA.bytes);
  const incomplete = convergePlacementMembershipEpochs({
    candidates: [childA.bytes],
    capsule_bytes: lineage.capsule.bytes
  });
  assert.equal(incomplete.status, "halted");
  assert.equal(incomplete.reason, "incomplete-chain");
});
