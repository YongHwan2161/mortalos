import { canonicalBytes } from "../../src/codec.mjs";
import { encodeBase64Url } from "../../src/bytes.mjs";
import { verifyContinuityCapsule } from "../../src/capsule.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  createPlacementAdmissionTrustRoot,
  finalizePlacementAdmissionEvidence,
  finalizePlacementMembershipEpoch,
  preparePlacementAdmissionEvidence,
  preparePlacementMembershipEpoch
} from "../../src/placement/admission.mjs";
import { createPlacementSigner } from "./storage-contract.mjs";

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

async function evidence({ issuer, organismId, roles, root, signer }) {
  const identityDigest = digest("MortalOS Lab admitted member identity", signer.identity);
  const prepared = preparePlacementAdmissionEvidence({
    body: {
      attestation_challenge_base64url: encodeBase64Url(canonicalBytes({
        format: "mortalos-lab-admission-challenge/1",
        organism_id: organismId,
        subject_key_id: signer.identity.key_id
      })),
      attestation_kind: "operator-domain-membership",
      failure_domain_id: digest("MortalOS Lab admitted failure domain", identityDigest),
      issued_at_ms: "1050",
      operator_root_id: digest("MortalOS Lab admitted operator root", identityDigest),
      roles,
      subject: signer.identity,
      valid_from_ms: "1000",
      valid_until_ms: "8900"
    },
    trust_root: root
  });
  return finalizePlacementAdmissionEvidence({
    body: prepared.body,
    issuer_signature: await issuer.sign(prepared.issuer_signing_message),
    subject_signature: await signer.sign(prepared.subject_signing_message),
    trust_root: root
  });
}

export async function createPlacementMembershipFixture({
  authority,
  capsule_bytes,
  observers,
  providers
}) {
  if (
    !authority?.custodian || !Array.isArray(observers) || observers.length < 4 ||
    !Array.isArray(providers) || providers.length < 1
  ) throw new TypeError("Continuity authority, providers, and at least four observers required");
  const capsule = verifyContinuityCapsule(capsule_bytes);
  const issuer = await createPlacementSigner();
  const root = createPlacementAdmissionTrustRoot({
    authority_id: digest("MortalOS Lab admission root authority", {
      organism_id: capsule.organism_id,
      purpose: "placement-liveness"
    }),
    issuer: issuer.identity,
    lineage_organism_id: capsule.organism_id,
    policy_digest: digest("MortalOS Lab admission issuer policy", {
      format: "mortalos-lab-admission-policy/1",
      issuer: issuer.identity
    }),
    scope_digest: digest("MortalOS Lab admission scope", {
      organism_id: capsule.organism_id,
      purpose: "placement-liveness"
    }),
    prior_trust_root_id: null,
    sequence: "1",
    valid_from_ms: "900",
    valid_until_ms: "9000"
  });
  const admissionEvidence = await Promise.all([
    ...providers.map((signer) => evidence({
      issuer,
      organismId: capsule.organism_id,
      roles: ["provider"],
      root,
      signer
    })),
    ...observers.map((signer) => evidence({
      issuer,
      organismId: capsule.organism_id,
      roles: ["observer"],
      root,
      signer
    }))
  ]);
  const parameters = {
    admission_evidence: admissionEvidence,
    evaluated_at_ms: "1100",
    expires_at_ms: "8800",
    observer_policy: { max_faulty: 1, roster_size: 4, threshold: 3 },
    revoked_trust_root_ids: [],
    trust_roots: [root]
  };
  const prepared = preparePlacementMembershipEpoch({
    capsule_bytes,
    parameters,
    prior_epoch_bytes: null
  });
  const bytes = typeof authority.createMembershipEpoch === "function"
    ? await authority.createMembershipEpoch({
        capsule_bytes: new Uint8Array(capsule_bytes),
        parameters,
        prior_epoch_bytes: null
      })
    : finalizePlacementMembershipEpoch({
        approvals: [await authority.sign({
          message: prepared.custody_approval_message,
          tuple: prepared.custody_approval_tuple
        })],
        body: prepared.body,
        capsule_bytes,
        prior_epoch_bytes: null
      });
  return Object.freeze({
    bytes,
    capsule_bytes: new Uint8Array(capsule_bytes),
    epoch_bytes: bytes,
    epoch_id: prepared.epoch_id,
    issuer: issuer.identity,
    prior_epoch_bytes: null,
    root
  });
}
