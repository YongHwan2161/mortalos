import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  createPlacementAdmissionTrustRoot,
  finalizePlacementAdmissionEvidence,
  preparePlacementAdmissionEvidence,
  verifyPlacementAdmissionEvidence
} from "../src/placement/admission.mjs";
import {
  PLACEMENT_ADMISSION_SIGNER_LIMITS,
  createPlacementAdmissionSigningRequest,
  derivePlacementAdmissionSignerPolicyDigest,
  restorePlacementAdmissionSignatureResponse
} from "../lab/placement/admission-signer-session.mjs";

const childPath = fileURLToPath(new URL("./placement-admission-signer-child.mjs", import.meta.url));

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

function deepKeys(value, result = []) {
  if (value === null || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const entry of value) deepKeys(entry, result);
    return result;
  }
  for (const key of Object.keys(value)) {
    result.push(key);
    deepKeys(value[key], result);
  }
  return result;
}

async function startSigner(role, {
  authorityPath = null,
  policy,
  rootConfig = null,
  trustRoot = null
}) {
  const token = encodeBase64Url(randomBytes(32));
  const child = spawn(process.execPath, [childPath, role], {
    env: {
      ...process.env,
      MORTALOS_ADMISSION_AUTHORITY_PATH: authorityPath ?? "",
      MORTALOS_ADMISSION_ROOT_CONFIG: rootConfig === null ? "" : JSON.stringify(rootConfig),
      MORTALOS_ADMISSION_SIGNER_POLICY: JSON.stringify(policy),
      MORTALOS_ADMISSION_SIGNER_TOKEN: token,
      MORTALOS_ADMISSION_TRUST_ROOT: trustRoot === null ? "" : JSON.stringify(trustRoot)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${role} signer readiness timeout`)), 10_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      reject(new Error(`${role} signer exited ${code}: ${stderr}`));
    });
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolve(JSON.parse(line));
    });
  });
  let stopped = false;
  return {
    child,
    identity: ready.identity,
    pid: ready.pid,
    role: ready.role,
    token,
    trust_root: ready.trust_root,
    url: ready.url,
    async request(bytes, suppliedToken = token) {
      const response = await fetch(`${ready.url}/sign-admission`, {
        body: bytes,
        headers: {
          authorization: `Bearer ${suppliedToken}`,
          "content-type": "application/octet-stream"
        },
        method: "POST"
      });
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        status: response.status
      };
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
      lines.close();
    }
  };
}

function rootConfig() {
  const organismDigest = digest("MortalOS ceremony organism", { name: "ceremony-test" });
  return {
    authority_id: digest("MortalOS ceremony root authority", { purpose: "placement-admission" }),
    lineage_organism_id: `mortalos:${organismDigest.slice("sha256:".length)}`,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS ceremony scope", { purpose: "provider-membership" }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
}

function signerPolicy() {
  return {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS ceremony failure domain", { site: "loopback-a" }),
    operator_root_id: digest("MortalOS ceremony operator", { operator: "ceremony-a" }),
    roles: ["provider"]
  };
}

function body(subject, policy, overrides = {}) {
  return {
    attestation_challenge_base64url: encodeBase64Url(canonicalBytes({
      format: "mortalos-admission-ceremony-challenge/1",
      nonce: encodeBase64Url(new Uint8Array(32).fill(91)),
      subject_key_id: subject.key_id
    })),
    attestation_kind: policy.attestation_kind,
    failure_domain_id: policy.failure_domain_id,
    issued_at_ms: "1500",
    operator_root_id: policy.operator_root_id,
    roles: policy.roles,
    subject,
    valid_from_ms: "1200",
    valid_until_ms: "8000",
    ...overrides
  };
}

test("separate issuer and subject processes sign one bounded canonical admission ceremony", {
  timeout: 60_000
}, async () => {
  const policy = signerPolicy();
  const issuer = await startSigner("issuer", { policy, rootConfig: rootConfig() });
  const trustRoot = issuer.trust_root;
  const subject = await startSigner("subject", { policy, trustRoot });
  const other = await startSigner("subject", { policy, trustRoot });
  try {
    assert.notEqual(issuer.pid, subject.pid);
    assert.notEqual(other.pid, subject.pid);
    assert.notEqual(issuer.identity.key_id, subject.identity.key_id);
    assert.deepEqual(Object.keys(issuer).sort(), [
      "child", "identity", "pid", "request", "role", "stop", "token", "trust_root", "url"
    ]);
    assert.deepEqual(Object.keys(issuer.identity).sort(), ["key_id", "public_key"]);
    assert.deepEqual(Object.keys(subject.identity).sort(), ["key_id", "public_key"]);

    assert.equal(trustRoot.issuer.key_id, issuer.identity.key_id);
    const evidenceBody = body(subject.identity, policy);
    const prepared = preparePlacementAdmissionEvidence({
      body: evidenceBody,
      trust_root: trustRoot
    });
    const requestBytes = createPlacementAdmissionSigningRequest({
      body: evidenceBody,
      trust_root: trustRoot
    });

    const [issuerFirst, issuerRetry, subjectResult] = await Promise.all([
      issuer.request(requestBytes),
      issuer.request(requestBytes),
      subject.request(requestBytes)
    ]);
    assert.equal(issuerFirst.status, 200, new TextDecoder().decode(issuerFirst.bytes));
    assert.equal(issuerRetry.status, 200, new TextDecoder().decode(issuerRetry.bytes));
    assert.equal(subjectResult.status, 200, new TextDecoder().decode(subjectResult.bytes));
    assert.equal(equalBytes(issuerFirst.bytes, issuerRetry.bytes), true);

    const issuerSignature = restorePlacementAdmissionSignatureResponse(issuerFirst.bytes);
    const subjectSignature = restorePlacementAdmissionSignatureResponse(subjectResult.bytes);
    assert.equal(issuerSignature.role, "issuer");
    assert.equal(issuerSignature.key_id, issuer.identity.key_id);
    assert.equal(subjectSignature.role, "subject");
    assert.equal(subjectSignature.key_id, subject.identity.key_id);
    assert.equal(issuerSignature.evidence_id, subjectSignature.evidence_id);
    assert.notEqual(issuerSignature.slot_id, subjectSignature.slot_id);

    const evidenceBytes = finalizePlacementAdmissionEvidence({
      body: prepared.body,
      issuer_signature: issuerSignature.signature,
      subject_signature: subjectSignature.signature,
      trust_root: trustRoot
    });
    const verified = verifyPlacementAdmissionEvidence({
      evaluated_at_ms: "2000",
      evidence_bytes: evidenceBytes,
      trust_root: trustRoot
    });
    assert.equal(verified.status, "verified");
    assert.equal(verified.body.subject.key_id, subject.identity.key_id);

    const publicTranscript = {
      evidence_id: verified.evidence_id,
      issuer: issuer.identity,
      issuer_response: JSON.parse(new TextDecoder().decode(issuerFirst.bytes)),
      subject: subject.identity,
      subject_response: JSON.parse(new TextDecoder().decode(subjectResult.bytes))
    };
    assert.equal(deepKeys(publicTranscript).some((key) =>
      /private|pkcs8|jwk|secret/iu.test(key)), false);

    const conflictBytes = createPlacementAdmissionSigningRequest({
      body: body(subject.identity, policy, {
        valid_until_ms: "7900"
      }),
      trust_root: trustRoot
    });
    assert.equal((await issuer.request(conflictBytes)).status, 409);
    assert.equal((await subject.request(conflictBytes)).status, 409);

    const wrongSubjectBytes = createPlacementAdmissionSigningRequest({
      body: body(other.identity, policy),
      trust_root: trustRoot
    });
    assert.equal((await subject.request(wrongSubjectBytes)).status, 403);

    const wrongIssuerRoot = createPlacementAdmissionTrustRoot({
      ...rootConfig(),
      issuer: other.identity,
      policy_digest: derivePlacementAdmissionSignerPolicyDigest(policy)
    });
    const wrongIssuerBytes = createPlacementAdmissionSigningRequest({
      body: body(subject.identity, policy),
      trust_root: wrongIssuerRoot
    });
    assert.equal((await issuer.request(wrongIssuerBytes)).status, 403);

    assert.equal((await issuer.request(requestBytes, "x".repeat(43))).status, 401);
    assert.equal((await issuer.request(
      new Uint8Array(PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes + 1)
    )).status, 413);

    await issuer.stop();
    await assert.rejects(() => fetch(`${issuer.url}/identity`));
    assert.equal((await subject.request(requestBytes)).status, 200);
  } finally {
    await Promise.all([issuer.stop(), subject.stop(), other.stop()]);
  }
});

test("durable ceremony preserves one winner across concurrent processes and restart", {
  timeout: 60_000
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-ceremony-"));
  const issuerPath = join(directory, "issuer", "authority.json");
  const subjectPath = join(directory, "subject", "authority.json");
  const policy = signerPolicy();
  const services = [];
  try {
    const issuerA = await startSigner("issuer", {
      authorityPath: issuerPath,
      policy,
      rootConfig: rootConfig()
    });
    services.push(issuerA);
    const issuerB = await startSigner("issuer", {
      authorityPath: issuerPath,
      policy,
      rootConfig: rootConfig()
    });
    services.push(issuerB);
    assert.deepEqual(issuerB.identity, issuerA.identity);
    assert.deepEqual(issuerB.trust_root, issuerA.trust_root);

    const subject = await startSigner("subject", {
      authorityPath: subjectPath,
      policy,
      trustRoot: issuerA.trust_root
    });
    services.push(subject);
    const subjectIdentity = subject.identity;
    const requestA = createPlacementAdmissionSigningRequest({
      body: body(subjectIdentity, policy),
      trust_root: issuerA.trust_root
    });
    const requestB = createPlacementAdmissionSigningRequest({
      body: body(subjectIdentity, policy, { valid_until_ms: "7900" }),
      trust_root: issuerA.trust_root
    });
    const competed = await Promise.all([
      issuerA.request(requestA),
      issuerB.request(requestB)
    ]);
    assert.deepEqual(competed.map((entry) => entry.status).sort(), [200, 409]);
    const winnerIndex = competed[0].status === 200 ? 0 : 1;
    const winnerRequest = winnerIndex === 0 ? requestA : requestB;
    const loserRequest = winnerIndex === 0 ? requestB : requestA;
    const issuerWinnerResponse = competed[winnerIndex].bytes;
    const subjectWinner = await subject.request(winnerRequest);
    assert.equal(subjectWinner.status, 200);
    const subjectWinnerResponse = subjectWinner.bytes;

    const winnerBody = body(subjectIdentity, policy, {
      valid_until_ms: winnerIndex === 0 ? "8000" : "7900"
    });
    const prepared = preparePlacementAdmissionEvidence({
      body: winnerBody,
      trust_root: issuerA.trust_root
    });
    const evidenceBytes = finalizePlacementAdmissionEvidence({
      body: prepared.body,
      issuer_signature: restorePlacementAdmissionSignatureResponse(
        issuerWinnerResponse
      ).signature,
      subject_signature: restorePlacementAdmissionSignatureResponse(
        subjectWinnerResponse
      ).signature,
      trust_root: issuerA.trust_root
    });
    assert.equal(verifyPlacementAdmissionEvidence({
      evaluated_at_ms: "2000",
      evidence_bytes: evidenceBytes,
      trust_root: issuerA.trust_root
    }).status, "verified");

    await Promise.all(services.splice(0).map((service) => service.stop()));
    const restartedIssuer = await startSigner("issuer", {
      authorityPath: issuerPath,
      policy,
      rootConfig: rootConfig()
    });
    const restartedSubject = await startSigner("subject", {
      authorityPath: subjectPath,
      policy,
      trustRoot: restartedIssuer.trust_root
    });
    services.push(restartedIssuer, restartedSubject);
    assert.deepEqual(restartedIssuer.identity, issuerA.identity);
    assert.deepEqual(restartedSubject.identity, subjectIdentity);
    assert.deepEqual(restartedIssuer.trust_root, issuerA.trust_root);

    const issuerRetry = await restartedIssuer.request(winnerRequest);
    const subjectRetry = await restartedSubject.request(winnerRequest);
    assert.equal(issuerRetry.status, 200);
    assert.equal(subjectRetry.status, 200);
    assert.equal(equalBytes(issuerRetry.bytes, issuerWinnerResponse), true);
    assert.equal(equalBytes(subjectRetry.bytes, subjectWinnerResponse), true);
    assert.equal((await restartedIssuer.request(loserRequest)).status, 409);
    assert.equal((await restartedSubject.request(loserRequest)).status, 409);
  } finally {
    await Promise.all(services.map((service) => service.stop()));
    await rm(directory, { recursive: true, force: true });
  }
});
