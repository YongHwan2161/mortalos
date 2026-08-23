import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  createPlacementAdmissionTrustRoot,
  finalizePlacementAdmissionEvidence,
  preparePlacementAdmissionEvidence,
  verifyPlacementAdmissionEvidence
} from "../src/placement/admission.mjs";
import {
  createPlacementAdmissionSignerSession,
  createPlacementAdmissionSigningRequest,
  derivePlacementAdmissionSignerPolicyDigest,
  restorePlacementAdmissionSignatureResponse
} from "../lab/placement/admission-signer-session.mjs";
import { createPlacementSigner } from "../lab/placement/storage-contract.mjs";

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

test("signer session owns request bytes before suspension and releases a failed slot", async () => {
  const issuer = await createPlacementSigner();
  const subject = await createPlacementSigner();
  const organismDigest = digest("MortalOS signer session organism", { fixture: 1 });
  const policy = {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS signer session domain", { fixture: 1 }),
    operator_root_id: digest("MortalOS signer session operator", { fixture: 1 }),
    roles: ["provider"]
  };
  const trustRoot = createPlacementAdmissionTrustRoot({
    authority_id: digest("MortalOS signer session authority", { fixture: 1 }),
    issuer: issuer.identity,
    lineage_organism_id: `mortalos:${organismDigest.slice("sha256:".length)}`,
    policy_digest: derivePlacementAdmissionSignerPolicyDigest(policy),
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS signer session scope", { fixture: 1 }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  });
  const body = {
    attestation_challenge_base64url: encodeBase64Url(new Uint8Array(32).fill(51)),
    attestation_kind: policy.attestation_kind,
    failure_domain_id: policy.failure_domain_id,
    issued_at_ms: "1500",
    operator_root_id: policy.operator_root_id,
    roles: policy.roles,
    subject: subject.identity,
    valid_from_ms: "1200",
    valid_until_ms: "8000"
  };
  const prepared = preparePlacementAdmissionEvidence({ body, trust_root: trustRoot });
  const requestBytes = createPlacementAdmissionSigningRequest({ body, trust_root: trustRoot });
  let calls = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const signer = Object.freeze({
    destroy() {},
    identity: subject.identity,
    async sign(request) {
      calls += 1;
      if (calls === 1) throw new Error("synthetic signer failure");
      await barrier;
      return subject.sign(request.message);
    }
  });
  const session = createPlacementAdmissionSignerSession({
    endpoint_origin: null,
    policy,
    role: "subject",
    signer,
    trust_root: trustRoot
  });

  await assert.rejects(
    () => session.signAdmissionRequest(requestBytes),
    /synthetic signer failure/u
  );
  const pending = session.signAdmissionRequest(requestBytes);
  requestBytes.fill(0);
  release();
  const response = restorePlacementAdmissionSignatureResponse(await pending);
  assert.equal(calls, 2);
  const evidenceBytes = finalizePlacementAdmissionEvidence({
    body: prepared.body,
    issuer_signature: await issuer.sign(prepared.issuer_signing_message),
    subject_signature: response.signature,
    trust_root: trustRoot
  });
  assert.equal(verifyPlacementAdmissionEvidence({
    evaluated_at_ms: "2000",
    evidence_bytes: evidenceBytes,
    trust_root: trustRoot
  }).status, "verified");

  let accessorCalls = 0;
  assert.throws(() => createPlacementAdmissionSignerSession({
    endpoint_origin: null,
    policy,
    role: "subject",
    signer: Object.defineProperty({
      destroy() {},
      identity: subject.identity
    }, "sign", { get() { accessorCalls += 1; throw new Error("accessor must not run"); } }),
    trust_root: trustRoot
  }), (error) => error?.code === "E_PLACEMENT_ADMISSION_SIGNER_FORMAT");
  assert.equal(accessorCalls, 0);

  const mismatchedRoot = createPlacementAdmissionTrustRoot({
    authority_id: trustRoot.authority_id,
    issuer: trustRoot.issuer,
    lineage_organism_id: trustRoot.lineage_organism_id,
    policy_digest: digest("MortalOS unrelated signer policy", { fixture: 1 }),
    prior_trust_root_id: null,
    scope_digest: trustRoot.scope_digest,
    sequence: "1",
    valid_from_ms: trustRoot.valid_from_ms,
    valid_until_ms: trustRoot.valid_until_ms
  });
  assert.throws(() => createPlacementAdmissionSignerSession({
    endpoint_origin: null,
    policy,
    role: "subject",
    signer: subject,
    trust_root: mismatchedRoot
  }), (error) =>
    error?.code === "E_PLACEMENT_ADMISSION_SIGNER_POLICY" &&
    error?.detail === "trust-root-policy-digest");
});
