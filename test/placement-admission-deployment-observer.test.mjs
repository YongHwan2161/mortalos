import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { decodeBase64Url, encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes, parseJsonBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { createContinuity, createContinuityAuthority } from "../src/continuity.mjs";
import {
  restorePlacementMembershipEpoch
} from "../src/placement/admission.mjs";
import {
  restorePlacementAdmissionCeremonyBundle,
  restorePlacementAdmissionCeremonyRoleResponse
} from "../lab/placement/admission-ceremony-client.mjs";
import {
  restorePlacementAdmissionDeploymentObservation
} from "../lab/placement/admission-deployment-observer.mjs";
import {
  attestPlacementAdmissionDeploymentObservation,
  createPlacementAdmissionDeploymentAttestationView,
  evaluatePlacementAdmissionDeploymentAttestations,
  restorePlacementAdmissionDeploymentAttestation,
  restorePlacementAdmissionDeploymentAttestationView,
  verifyPlacementAdmissionDeploymentAttestationView
} from "../lab/placement/admission-deployment-attestation.mjs";
import {
  createPlacementAdmissionDeploymentPlan,
  restorePlacementAdmissionDeploymentPlan
} from "../lab/placement/admission-deployment-plan.mjs";
import {
  acceptPlacementAdmissionDeploymentPlan,
  createPlacementAdmissionDeploymentPlanActivation,
  restorePlacementAdmissionDeploymentPlanAcceptance,
  restorePlacementAdmissionDeploymentPlanActivation
} from "../lab/placement/admission-deployment-plan-activation.mjs";
import {
  createPlacementAdmissionDeploymentPlanMembership,
  restorePlacementAdmissionDeploymentPlanMembership,
  verifyPlacementAdmissionDeploymentPlanMembership
} from "../lab/placement/admission-deployment-plan-membership.mjs";
import {
  createPlacementAdmissionPilotEvidence,
  PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS,
  restorePlacementAdmissionPilotEvidence,
  verifyPlacementAdmissionPilotEvidence
} from "../lab/placement/admission-pilot-evidence.mjs";
import {
  createPlacementAdmissionPilotSourceAttestation,
  restorePlacementAdmissionPilotSourceAttestation,
  verifyPlacementAdmissionPilotSourceAttestation
} from "../lab/placement/admission-pilot-source-attestation.mjs";
import {
  createPlacementAdmissionPilotInventoryRatification,
  restorePlacementAdmissionPilotInventoryClosure,
  restorePlacementAdmissionPilotInventoryRatification
} from "../lab/placement/admission-pilot-inventory-closure.mjs";
import {
  restorePlacementAdmissionPilotSourceVerdict
} from "../lab/placement/admission-pilot-source-verdict.mjs";
import {
  createPlacementAdmissionRoleExecutionReceipt,
  restorePlacementAdmissionRoleExecutionReceipt
} from "../lab/placement/admission-role-execution-receipt.mjs";
import {
  restorePlacementMembershipEpochApproval
} from "../lab/placement/admission-membership-epoch-ceremony.mjs";
import {
  loadPlacementAdmissionPilotEvidenceIndex
} from "../scripts/placement-admission-pilot-evidence-index.mjs";
import { createPlacementSigner } from "../lab/placement/storage-contract.mjs";

const signerRunner = fileURLToPath(new URL(
  "../scripts/run-placement-admission-signer.mjs",
  import.meta.url
));
const issuerPreparer = fileURLToPath(new URL(
  "../scripts/prepare-placement-admission-issuer.mjs",
  import.meta.url
));
const subjectPreparer = fileURLToPath(new URL(
  "../scripts/prepare-placement-admission-subject.mjs",
  import.meta.url
));
const requestCreator = fileURLToPath(new URL(
  "../scripts/create-placement-admission-ceremony-request.mjs",
  import.meta.url
));
const ceremonyRoleRunner = fileURLToPath(new URL(
  "../scripts/run-placement-admission-ceremony-role.mjs",
  import.meta.url
));
const ceremonyFinalizer = fileURLToPath(new URL(
  "../scripts/finalize-placement-admission-ceremony.mjs",
  import.meta.url
));
const observerRunner = fileURLToPath(new URL(
  "../scripts/observe-placement-admission-deployment.mjs",
  import.meta.url
));
const attesterRunner = fileURLToPath(new URL(
  "../scripts/observe-and-attest-placement-admission-deployment.mjs",
  import.meta.url
));
const deploymentPlanRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-deployment-plan.mjs",
  import.meta.url
));
const prepareDeploymentObserverRunner = fileURLToPath(new URL(
  "../scripts/prepare-placement-admission-deployment-observer.mjs",
  import.meta.url
));
const acceptDeploymentPlanRunner = fileURLToPath(new URL(
  "../scripts/accept-placement-admission-deployment-plan.mjs",
  import.meta.url
));
const activateDeploymentPlanRunner = fileURLToPath(new URL(
  "../scripts/activate-placement-admission-deployment-plan.mjs",
  import.meta.url
));
const bindDeploymentPlanMembershipRunner = fileURLToPath(new URL(
  "../scripts/bind-placement-admission-deployment-plan-membership.mjs",
  import.meta.url
));
const createMembershipEpochRequestRunner = fileURLToPath(new URL(
  "../scripts/create-placement-membership-epoch-request.mjs",
  import.meta.url
));
const approveMembershipEpochRunner = fileURLToPath(new URL(
  "../scripts/approve-placement-membership-epoch.mjs",
  import.meta.url
));
const finalizeMembershipEpochRunner = fileURLToPath(new URL(
  "../scripts/finalize-placement-membership-epoch.mjs",
  import.meta.url
));
const createDeploymentAttestationViewRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-deployment-attestation-view.mjs",
  import.meta.url
));
const verifyDeploymentAttestationViewRunner = fileURLToPath(new URL(
  "../scripts/verify-placement-admission-deployment-attestation-view.mjs",
  import.meta.url
));
const createPilotEvidenceRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-pilot-evidence.mjs",
  import.meta.url
));
const verifyPilotEvidenceRunner = fileURLToPath(new URL(
  "../scripts/verify-placement-admission-pilot-evidence.mjs",
  import.meta.url
));
const attestRoleExecutionRunner = fileURLToPath(new URL(
  "../scripts/attest-placement-admission-role-execution.mjs",
  import.meta.url
));
const createPilotSourceAttestationRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-pilot-source-attestation.mjs",
  import.meta.url
));
const verifyPilotSourceAttestationRunner = fileURLToPath(new URL(
  "../scripts/verify-placement-admission-pilot-source-attestation.mjs",
  import.meta.url
));
const createPilotSourceVerdictRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-pilot-source-verdict.mjs",
  import.meta.url
));
const verifyPilotSourceVerdictRunner = fileURLToPath(new URL(
  "../scripts/verify-placement-admission-pilot-source-verdict.mjs",
  import.meta.url
));
const ratifyPilotSourceVerdictRunner = fileURLToPath(new URL(
  "../scripts/ratify-placement-admission-pilot-source-verdict.mjs",
  import.meta.url
));
const createPilotInventoryClosureRunner = fileURLToPath(new URL(
  "../scripts/create-placement-admission-pilot-inventory-closure.mjs",
  import.meta.url
));
const verifyPilotInventoryClosureRunner = fileURLToPath(new URL(
  "../scripts/verify-placement-admission-pilot-inventory-closure.mjs",
  import.meta.url
));

const DEPLOYMENT_ATTESTATION_DOMAIN =
  "MortalOS placement admission deployment attestation v5";
const DEPLOYMENT_PLAN_DOMAIN =
  "MortalOS placement admission deployment plan v1";
const DEPLOYMENT_PLAN_ACTIVATION_DOMAIN =
  "MortalOS placement admission deployment plan activation v1";
const DEPLOYMENT_PLAN_MEMBERSHIP_DOMAIN =
  "MortalOS placement admission deployment plan membership v2";
const DEPLOYMENT_ATTESTATION_VIEW_DOMAIN =
  "MortalOS placement admission deployment attestation view v1";
const PILOT_EVIDENCE_DOMAIN =
  "MortalOS placement admission pilot evidence v1";
const PILOT_SOURCE_VERDICT_DOMAIN =
  "MortalOS placement admission pilot source verdict v1";

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

function policy() {
  return {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS deployment observer test domain", { site: "tls-a" }),
    operator_root_id: digest("MortalOS deployment observer test operator", { name: "operator-a" }),
    roles: ["provider"]
  };
}

function rootConfig(organismId) {
  return {
    authority_id: digest("MortalOS deployment observer root", { purpose: "admission" }),
    lineage_organism_id: organismId,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS deployment observer scope", { purpose: "membership" }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
}

function placementSignerObserver(signer) {
  return Object.freeze({
    custodian: signer.identity,
    async sign({ message }) {
      return Object.freeze({
        key_id: signer.identity.key_id,
        signature: await signer.sign(message)
      });
    }
  });
}

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

async function generateCertificate(directory, label) {
  const keyPath = join(directory, `${label}.key.pem`);
  const certificatePath = join(directory, `${label}.cert.pem`);
  await new Promise((resolve, reject) => {
    execFile("openssl", [
      "req",
      "-x509",
      "-newkey", "rsa:2048",
      "-sha256",
      "-nodes",
      "-days", "1",
      "-subj", `/CN=${label}`,
      "-addext", "subjectAltName=IP:127.0.0.1",
      "-addext", "basicConstraints=critical,CA:TRUE",
      "-addext", "keyUsage=critical,keyCertSign,digitalSignature",
      "-keyout", keyPath,
      "-out", certificatePath
    ], { cwd: directory }, (error) => error ? reject(error) : resolve());
  });
  return {
    certificate: await readFile(certificatePath),
    certificatePath,
    key: await readFile(keyPath),
    keyPath
  };
}

function signerArguments({
  authorityPath,
  configPath,
  endpointOrigin,
  policyPath,
  port,
  role,
  tlsCertificatePath = null,
  tlsPrivateKeyPath = null
}) {
  const args = [
    "--authority", authorityPath,
    "--endpoint-origin", endpointOrigin,
    "--listen-host", "127.0.0.1",
    "--listen-port", String(port),
    "--policy", policyPath,
    "--profile-state", `${authorityPath}.profile.json`,
    "--role", role,
    role === "issuer" ? "--root-config" : "--trust-root", configPath
  ];
  if (tlsCertificatePath !== null) args.push("--tls-certificate", tlsCertificatePath);
  if (tlsPrivateKeyPath !== null) args.push("--tls-private-key", tlsPrivateKeyPath);
  return args;
}

async function startSigner(options) {
  const env = { ...process.env, MORTALOS_ADMISSION_SIGNER_TOKEN: options.token };
  if (options.possessionToken !== undefined && options.possessionToken !== null) {
    env.MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN = options.possessionToken;
  }
  const child = spawn(process.execPath, [signerRunner, ...signerArguments(options)], {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${options.role} readiness timeout`)), 15_000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    child.once("error", fail);
    child.once("exit", (code) => fail(new Error(`${options.role} exited ${code}: ${stderr}`)));
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolve(JSON.parse(line));
    });
  });
  let stopped = false;
  return {
    ready,
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

async function runNode(script, args, env, timeout = 30_000) {
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`child timeout: ${script}`));
    }, timeout);
    child.once("error", reject);
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  return { code, stderr, stdout };
}

async function runCommand(command, args, options = {}) {
  return await new Promise((resolveCommand, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolveCommand({ stderr, stdout });
    });
  });
}

async function createObserverAdmissionCeremony({
  directory,
  failureDomainId,
  label,
  operatorRootId,
  organismId,
  subjectAuthorityPath,
  subjectIdentityPath
}) {
  const policyPath = join(directory, `${label}-policy.json`);
  const rootConfigPath = join(directory, `${label}-root-config.json`);
  const trustRootPath = join(directory, `${label}-trust-root.json`);
  const issuerAuthorityPath = join(directory, `${label}-issuer-authority.json`);
  const requestPath = join(directory, `${label}-request.json`);
  const issuerResponsePath = join(directory, `${label}-issuer-response.json`);
  const subjectResponsePath = join(directory, `${label}-subject-response.json`);
  const bundlePath = join(directory, `${label}-bundle.json`);
  const policyValue = {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: failureDomainId,
    operator_root_id: operatorRootId,
    roles: ["observer"]
  };
  const rootConfigValue = {
    authority_id: digest("MortalOS deployment observer admission root", { label }),
    lineage_organism_id: organismId,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS deployment observer admission scope", { label }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
  await Promise.all([
    writeFile(policyPath, canonicalBytes(policyValue)),
    writeFile(rootConfigPath, canonicalBytes(rootConfigValue))
  ]);
  const preparedIssuer = await runNode(issuerPreparer, [
    "--authority", issuerAuthorityPath,
    "--policy", policyPath,
    "--root-config", rootConfigPath,
    "--output", trustRootPath
  ], {});
  assert.equal(preparedIssuer.code, 0, preparedIssuer.stderr);
  const issuerPort = await freePort();
  let subjectPort = await freePort();
  while (subjectPort === issuerPort) subjectPort = await freePort();
  const issuerOrigin = `http://127.0.0.1:${issuerPort}`;
  const subjectOrigin = `http://127.0.0.1:${subjectPort}`;
  const createdRequest = await runNode(requestCreator, [
    "--trust-root", trustRootPath,
    "--subject-identity", subjectIdentityPath,
    "--policy", policyPath,
    "--issuer-origin", issuerOrigin,
    "--subject-origin", subjectOrigin,
    "--issued-at-ms", "1500",
    "--valid-from-ms", "1200",
    "--valid-until-ms", "8000",
    "--output", requestPath
  ], {});
  assert.equal(createdRequest.code, 0, createdRequest.stderr);
  let issuerService;
  let subjectService;
  const issuerToken = encodeBase64Url(randomBytes(32));
  const subjectToken = encodeBase64Url(randomBytes(32));
  try {
    issuerService = await startSigner({
      authorityPath: issuerAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      token: issuerToken
    });
    subjectService = await startSigner({
      authorityPath: subjectAuthorityPath,
      configPath: trustRootPath,
      endpointOrigin: subjectOrigin,
      policyPath,
      port: subjectPort,
      role: "subject",
      token: subjectToken
    });
    const [issuerResponse, subjectResponse] = await Promise.all([
      runNode(ceremonyRoleRunner, [
        "--endpoint", issuerOrigin,
        "--output", issuerResponsePath,
        "--request", requestPath,
        "--role", "issuer",
        "--timeout-ms", "15000"
      ], { MORTALOS_ADMISSION_SIGNER_TOKEN: issuerToken }),
      runNode(ceremonyRoleRunner, [
        "--endpoint", subjectOrigin,
        "--output", subjectResponsePath,
        "--request", requestPath,
        "--role", "subject",
        "--timeout-ms", "15000"
      ], { MORTALOS_ADMISSION_SIGNER_TOKEN: subjectToken })
    ]);
    assert.equal(issuerResponse.code, 0, issuerResponse.stderr);
    assert.equal(subjectResponse.code, 0, subjectResponse.stderr);
    const finalized = await runNode(ceremonyFinalizer, [
      "--evaluated-at-ms", "2000",
      "--issuer-response", issuerResponsePath,
      "--output", bundlePath,
      "--request", requestPath,
      "--subject-response", subjectResponsePath
    ], {});
    assert.equal(finalized.code, 0, finalized.stderr);
  } finally {
    await Promise.all([
      issuerService?.stop(),
      subjectService?.stop()
    ]);
  }
  return {
    bundleBytes: new Uint8Array(await readFile(bundlePath)),
    bundlePath,
    issuerAuthorityPath,
    issuerResponsePath,
    subjectResponsePath,
    trustRootBytes: new Uint8Array(await readFile(trustRootPath))
  };
}

async function createMembershipEpochViaCli({
  approvalPath,
  bundlePaths,
  capsulePath,
  continuityAuthorityPath,
  epochPath,
  priorEpochPath = null,
  requestPath
}) {
  const requestArgs = ["--capsule", capsulePath];
  for (const bundlePath of bundlePaths) {
    requestArgs.push("--ceremony-bundle", bundlePath);
  }
  requestArgs.push(
    "--evaluated-at-ms", "2000",
    "--expires-at-ms", "8000",
    "--observer-max-faulty", "0",
    "--observer-roster-size", "2",
    "--observer-threshold", "2"
  );
  if (priorEpochPath !== null) {
    requestArgs.push("--prior-epoch", priorEpochPath);
  }
  requestArgs.push("--output", requestPath);
  const created = await runNode(createMembershipEpochRequestRunner, requestArgs, {});
  assert.equal(created.code, 0, created.stderr);

  const approvalArgs = [
    "--authority", continuityAuthorityPath,
    "--capsule", capsulePath,
    "--request", requestPath
  ];
  if (priorEpochPath !== null) approvalArgs.push("--prior-epoch", priorEpochPath);
  approvalArgs.push("--output", approvalPath);
  const approved = await runNode(approveMembershipEpochRunner, approvalArgs, {});
  assert.equal(approved.code, 0, approved.stderr);

  const finalizationArgs = [
    "--capsule", capsulePath,
    "--request", requestPath,
    "--approval", approvalPath
  ];
  if (priorEpochPath !== null) finalizationArgs.push("--prior-epoch", priorEpochPath);
  finalizationArgs.push("--output", epochPath);
  const finalized = await runNode(finalizeMembershipEpochRunner, finalizationArgs, {});
  assert.equal(finalized.code, 0, finalized.stderr);
  const bytes = new Uint8Array(await readFile(epochPath));
  return restorePlacementMembershipEpoch(bytes);
}

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

test("fresh HTTPS deployment observation binds live identities without promoting topology", {
  timeout: 480_000
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-deployment-"));
  const continuityAuthorityPath = join(directory, "continuity-authority.json");
  const continuityAuthority = await loadNodeAuthority(continuityAuthorityPath, { create: true });
  const continuity = await createContinuity({
    authority: continuityAuthority,
    resourceBytes: new TextEncoder().encode("deployment membership authority".repeat(32)),
    transitionId: "deployment-membership-authority"
  });
  const issuerPort = await freePort();
  let subjectPort = await freePort();
  while (subjectPort === issuerPort) subjectPort = await freePort();
  const issuerCertificate = await generateCertificate(directory, "issuer-test-ca");
  const subjectCertificate = await generateCertificate(directory, "subject-test-ca");
  const issuerOrigin = `https://127.0.0.1:${issuerPort}`;
  const subjectOrigin = `https://127.0.0.1:${subjectPort}`;
  const caBundlePath = join(directory, "test-ca-bundle.pem");
  await writeFile(caBundlePath, Buffer.concat([
    issuerCertificate.certificate,
    Buffer.from("\n"),
    subjectCertificate.certificate
  ]));
  let issuer;
  let subject;
  try {
    const issuerToken = encodeBase64Url(randomBytes(32));
    const subjectToken = encodeBase64Url(randomBytes(32));
    const issuerPossessionToken = encodeBase64Url(randomBytes(32));
    const subjectPossessionToken = encodeBase64Url(randomBytes(32));
    const proofEnvironment = {
      MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN: issuerPossessionToken,
      MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN: subjectPossessionToken,
      NODE_EXTRA_CA_CERTS: caBundlePath
    };
    const policyPath = join(directory, "policy.json");
    const rootConfigPath = join(directory, "root-config.json");
    const trustRootPath = join(directory, "trust-root.json");
    const issuerAuthorityPath = join(directory, "issuer-authority.json");
    const subjectAuthorityPath = join(directory, "subject-authority.json");
    const subjectIdentityPath = join(directory, "subject-identity.json");
    const requestPath = join(directory, "request.json");
    const issuerResponsePath = join(directory, "issuer-response.json");
    const subjectResponsePath = join(directory, "subject-response.json");
    const bundlePath = join(directory, "bundle.json");
    const wrongPath = join(directory, "wrong-observation.json");
    const observationPath = join(directory, "observation.json");
    const observation2Path = join(directory, "observation-2.json");
    const observerAuthority1Path = join(directory, "observer-authority-1.json");
    const observerAuthority2Path = join(directory, "observer-authority-2.json");
    const uncreatedObserverAuthorityPath = join(directory, "observer-authority-uncreated.json");
    const observerIdentity1Path = join(directory, "observer-identity-1.json");
    const observerIdentity2Path = join(directory, "observer-identity-2.json");
    const planInputPath = join(directory, "deployment-plan-input.json");
    const generatedPlanPath = join(directory, "generated-deployment-plan.json");
    const planPath = join(directory, "deployment-plan.json");
    const substitutedPlanPath = join(directory, "deployment-plan-substituted.json");
    const acceptance1Path = join(directory, "deployment-plan-acceptance-1.json");
    const acceptance1RetryPath = join(directory, "deployment-plan-acceptance-1-retry.json");
    const acceptance2Path = join(directory, "deployment-plan-acceptance-2.json");
    const conflictingAcceptancePath = join(directory, "deployment-plan-acceptance-conflict.json");
    const activationPath = join(directory, "deployment-plan-activation.json");
    const capsulePath = join(directory, "capsule.json");
    const membershipEpochPath = join(directory, "membership-epoch.json");
    const membershipEpoch2Path = join(directory, "membership-epoch-2.json");
    const membershipEpoch3Path = join(directory, "membership-epoch-3.json");
    const membershipRequestPath = join(directory, "membership-request.json");
    const membershipRequest2Path = join(directory, "membership-request-2.json");
    const membershipApprovalPath = join(directory, "membership-approval.json");
    const membershipApproval2Path = join(directory, "membership-approval-2.json");
    const membershipRequest3Path = join(directory, "membership-request-3.json");
    const membershipApproval3Path = join(directory, "membership-approval-3.json");
    const deploymentMembershipPath = join(directory, "deployment-plan-membership.json");
    const attestation1Path = join(directory, "attestation-1.json");
    const attestation2Path = join(directory, "attestation-2.json");
    const attestation1ObservationJournalPath = join(
      directory,
      "attestation-1-observation-journal.json"
    );
    const attestation2ObservationJournalPath = join(
      directory,
      "attestation-2-observation-journal.json"
    );
    const attestation1RecoveryPath = join(directory, "attestation-1-recovery.json");
    const attestation1JournalConflictPath = join(
      directory,
      "attestation-1-journal-conflict.json"
    );
    const attestationViewPath = join(directory, "attestation-view.json");
    const attestationViewRetryPath = join(directory, "attestation-view-retry.json");
    const pilotIndexPath = join(directory, "pilot-index.json");
    const pilotReversedIndexPath = join(directory, "pilot-index-reversed.json");
    const pilotOmittedIndexPath = join(directory, "pilot-index-omitted.json");
    const pilotEscapedIndexPath = join(directory, "pilot-index-escaped.json");
    const pilotCeremonySwapIndexPath = join(directory, "pilot-index-ceremony-swap.json");
    const pilotEvidencePath = join(directory, "pilot-evidence.json");
    const pilotEvidenceRetryPath = join(directory, "pilot-evidence-retry.json");
    const pilotEvidenceOmittedPath = join(directory, "pilot-evidence-omitted.json");
    const pilotEvidenceEscapedPath = join(directory, "pilot-evidence-escaped.json");
    const pilotEvidenceCeremonySwapPath = join(directory, "pilot-evidence-ceremony-swap.json");
    const pilotEvidenceWrongCommitPath = join(directory, "pilot-evidence-wrong-commit.json");
    const pilotEvidenceTamperedPath = join(directory, "pilot-evidence-tampered.json");
    const pilotSourceAttestationPath = join(directory, "pilot-source-attestation.json");
    const pilotSourceAttestationRetryPath = join(
      directory,
      "pilot-source-attestation-retry.json"
    );
    const pilotSourceAttestationMissingPath = join(
      directory,
      "pilot-source-attestation-missing.json"
    );
    const pilotSourceVerdictPath = join(directory, "pilot-source-verdict.json");
    const pilotInventoryClosurePath = join(directory, "pilot-inventory-closure.json");
    const pilotInventoryClosureMissingPath = join(
      directory,
      "pilot-inventory-closure-missing.json"
    );
    const pilotInventoryRatificationRetryPath = join(
      directory,
      "pilot-inventory-ratification-retry.json"
    );
    const roleExecutionReceiptRetryPath = join(
      directory,
      "role-execution-receipt-retry.json"
    );
    const roleExecutionReceiptDirtyPath = join(
      directory,
      "role-execution-receipt-dirty.json"
    );
    const outsideWindowPath = join(directory, "attestation-outside-window.json");
    const outsideWindowObservationJournalPath = join(
      directory,
      "attestation-outside-window-observation-journal.json"
    );
    await writeFile(policyPath, canonicalBytes(policy()));
    await writeFile(rootConfigPath, canonicalBytes(rootConfig(continuity.organism_id)));
    await writeFile(capsulePath, continuity.capsule_bytes);
    const preparedIssuer = await runNode(issuerPreparer, [
      "--authority", issuerAuthorityPath,
      "--policy", policyPath,
      "--root-config", rootConfigPath,
      "--output", trustRootPath
    ], {});
    assert.equal(preparedIssuer.code, 0, preparedIssuer.stderr);
    const preparedIssuerStatus = JSON.parse(preparedIssuer.stdout);
    const preparedSubject = await runNode(subjectPreparer, [
      "--authority", subjectAuthorityPath,
      "--output", subjectIdentityPath
    ], {});
    assert.equal(preparedSubject.code, 0, preparedSubject.stderr);
    const preparedSubjectStatus = JSON.parse(preparedSubject.stdout);
    const subjectIdentityBytes = new Uint8Array(await readFile(subjectIdentityPath));
    const subjectIdentity = parseJsonBytes(subjectIdentityBytes);
    const createdRequest = await runNode(requestCreator, [
      "--trust-root", trustRootPath,
      "--subject-identity", subjectIdentityPath,
      "--policy", policyPath,
      "--issuer-origin", issuerOrigin,
      "--subject-origin", subjectOrigin,
      "--issued-at-ms", "1500",
      "--valid-from-ms", "1200",
      "--valid-until-ms", "8000",
      "--output", requestPath
    ], {});
    assert.equal(createdRequest.code, 0, createdRequest.stderr);
    const createdRequestStatus = JSON.parse(createdRequest.stdout);
    issuer = await startSigner({
      authorityPath: issuerAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      possessionToken: issuerPossessionToken,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      tlsPrivateKeyPath: issuerCertificate.keyPath,
      token: issuerToken
    });
    assert.equal(preparedIssuerStatus.issuer_key_id, issuer.ready.identity.key_id);
    assert.equal(preparedIssuerStatus.trust_root_id, issuer.ready.trust_root.trust_root_id);
    assert.equal(equalBytes(
      new Uint8Array(await readFile(trustRootPath)),
      canonicalBytes(issuer.ready.trust_root)
    ), true);
    subject = await startSigner({
      authorityPath: subjectAuthorityPath,
      configPath: trustRootPath,
      endpointOrigin: subjectOrigin,
      policyPath,
      port: subjectPort,
      possessionToken: subjectPossessionToken,
      role: "subject",
      tlsCertificatePath: subjectCertificate.certificatePath,
      tlsPrivateKeyPath: subjectCertificate.keyPath,
      token: subjectToken
    });
    assert.equal(preparedSubjectStatus.subject_key_id, subject.ready.identity.key_id);
    assert.equal(createdRequestStatus.subject_key_id, subject.ready.identity.key_id);
    assert.equal(createdRequestStatus.issuer_key_id, issuer.ready.identity.key_id);
    assert.equal(equalBytes(subjectIdentityBytes, canonicalBytes(subject.ready.identity)), true);
    assert.equal(subjectIdentity.key_id, subject.ready.identity.key_id);
    const [issuerResponse, subjectResponse] = await Promise.all([
      runNode(ceremonyRoleRunner, [
        "--endpoint", issuerOrigin,
        "--output", issuerResponsePath,
        "--request", requestPath,
        "--role", "issuer",
        "--timeout-ms", "15000"
      ], {
        MORTALOS_ADMISSION_SIGNER_TOKEN: issuerToken,
        NODE_EXTRA_CA_CERTS: caBundlePath
      }),
      runNode(ceremonyRoleRunner, [
        "--endpoint", subjectOrigin,
        "--output", subjectResponsePath,
        "--request", requestPath,
        "--role", "subject",
        "--timeout-ms", "15000"
      ], {
        MORTALOS_ADMISSION_SIGNER_TOKEN: subjectToken,
        NODE_EXTRA_CA_CERTS: caBundlePath
      })
    ]);
    assert.equal(issuerResponse.code, 0, issuerResponse.stderr);
    assert.equal(subjectResponse.code, 0, subjectResponse.stderr);
    const ceremony = await runNode(ceremonyFinalizer, [
      "--evaluated-at-ms", "2000",
      "--issuer-response", issuerResponsePath,
      "--output", bundlePath,
      "--request", requestPath,
      "--subject-response", subjectResponsePath
    ], {
      MORTALOS_ADMISSION_SIGNER_TOKEN: "unused-by-offline-finalizer"
    });
    assert.equal(ceremony.code, 0, ceremony.stderr);

    const wrong = await runNode(observerRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(112)),
      "--output", wrongPath,
      "--timeout-ms", "15000"
    ], {
      ...proofEnvironment,
      MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN: encodeBase64Url(randomBytes(32))
    });
    assert.notEqual(wrong.code, 0);
    assert.match(wrong.stderr, /E_PLACEMENT_ADMISSION_DEPLOYMENT_IDENTITY/u);
    assert.equal(await absent(wrongPath), true);

    const observed = await runNode(observerRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(113)),
      "--output", observationPath,
      "--timeout-ms", "15000"
    ], proofEnvironment);
    assert.equal(observed.code, 0, observed.stderr);
    const opened = restorePlacementAdmissionDeploymentObservation(
      new Uint8Array(await readFile(observationPath))
    );
    assert.equal(opened.status, "integrity-verified");
    assert.equal(opened.key_possession, "tls-exporter-role-key-signed");
    assert.equal(opened.live_observation_verified, false);
    assert.equal(opened.non_authority, true);
    assert.equal(opened.independent_administration, "unproven");
    assert.equal(opened.independent_failure_domains, "unproven");
    assert.equal(opened.tls_verification, "observer-process-trust-store");
    assert.deepEqual(opened.facts, {
      endpoint_origins_distinct: true,
      remote_addresses_distinct: false,
      tls_certificate_digests_distinct: true,
      tls_public_key_digests_distinct: true
    });
    assert.equal(opened.endpoint_observations[0].role, "issuer");
    assert.equal(opened.endpoint_observations[1].role, "subject");
    assert.notEqual(
      opened.endpoint_observations[0].tls_certificate_sha256,
      opened.endpoint_observations[1].tls_certificate_sha256
    );
    const factTamper = parseJsonBytes(opened.bytes);
    factTamper.facts.remote_addresses_distinct = true;
    const factBasis = { ...factTamper };
    delete factBasis.observation_id;
    factTamper.observation_id = domainHash(
      "MortalOS placement admission deployment observation v2",
      canonicalBytes(factBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentObservation(canonicalBytes(factTamper)),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_BINDING/u
    );
    const authorityTamper = parseJsonBytes(opened.bytes);
    authorityTamper.independent_administration = "proved";
    const authorityBasis = { ...authorityTamper };
    delete authorityBasis.observation_id;
    authorityTamper.observation_id = domainHash(
      "MortalOS placement admission deployment observation v2",
      canonicalBytes(authorityBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentObservation(canonicalBytes(authorityTamper)),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_FORMAT/u
    );
    const text = new TextDecoder().decode(opened.bytes);
    assert.equal(text.includes(issuerToken), false);
    assert.equal(text.includes(subjectToken), false);
    assert.equal(text.includes(issuerPossessionToken), false);
    assert.equal(text.includes(subjectPossessionToken), false);
    assert.equal(text.includes("BEGIN PRIVATE KEY"), false);

    const observed2 = await runNode(observerRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2101",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(114)),
      "--output", observation2Path,
      "--timeout-ms", "15000"
    ], proofEnvironment);
    assert.equal(observed2.code, 0, observed2.stderr);
    const opened2 = restorePlacementAdmissionDeploymentObservation(
      new Uint8Array(await readFile(observation2Path))
    );
    assert.notEqual(opened2.observation_id, opened.observation_id);
    assert.equal(opened2.ceremony_bundle_id, opened.ceremony_bundle_id);

    const administration1 = digest(
      "MortalOS deployment observer declared administration",
      { name: "operator-a" }
    );
    const administration2 = digest(
      "MortalOS deployment observer declared administration",
      { name: "operator-b" }
    );
    const failureDomain1 = digest(
      "MortalOS deployment observer declared failure domain",
      { name: "site-a" }
    );
    const failureDomain2 = digest(
      "MortalOS deployment observer declared failure domain",
      { name: "site-b" }
    );
    const vantage1 = digest("MortalOS deployment observer declared vantage", { name: "vantage-a" });
    const vantage2 = digest("MortalOS deployment observer declared vantage", { name: "vantage-b" });
    const vantage3 = digest("MortalOS deployment observer declared vantage", { name: "vantage-c" });
    const preparedObserver1 = await runNode(prepareDeploymentObserverRunner, [
      "--authority", observerAuthority1Path,
      "--output", observerIdentity1Path
    ]);
    const preparedObserver2 = await runNode(prepareDeploymentObserverRunner, [
      "--authority", observerAuthority2Path,
      "--output", observerIdentity2Path
    ]);
    assert.equal(preparedObserver1.code, 0, preparedObserver1.stderr);
    assert.equal(preparedObserver2.code, 0, preparedObserver2.stderr);
    const observerIdentity1Bytes = await readFile(observerIdentity1Path);
    const observerIdentity2Bytes = await readFile(observerIdentity2Path);
    const observerIdentity1 = parseJsonBytes(observerIdentity1Bytes);
    const observerIdentity2 = parseJsonBytes(observerIdentity2Bytes);
    assert.deepEqual(Object.keys(observerIdentity1).sort(), ["key_id", "public_key"]);
    assert.deepEqual(Object.keys(observerIdentity2).sort(), ["key_id", "public_key"]);
    assert.equal(new TextDecoder().decode(observerIdentity1Bytes).includes("private"), false);
    assert.equal(new TextDecoder().decode(observerIdentity2Bytes).includes("private"), false);
    const preparedObserverRetry = await runNode(prepareDeploymentObserverRunner, [
      "--authority", uncreatedObserverAuthorityPath,
      "--output", observerIdentity1Path
    ]);
    assert.notEqual(preparedObserverRetry.code, 0);
    assert.match(
      preparedObserverRetry.stderr,
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u
    );
    assert.equal(await absent(uncreatedObserverAuthorityPath), true);
    const observerAuthority1 = await loadNodeAuthority(observerAuthority1Path);
    const observerAuthority2 = await loadNodeAuthority(observerAuthority2Path);
    assert.equal(observerAuthority1.custodian.key_id, observerIdentity1.key_id);
    assert.equal(observerAuthority1.custodian.public_key, observerIdentity1.public_key);
    assert.equal(observerAuthority2.custodian.key_id, observerIdentity2.key_id);
    assert.equal(observerAuthority2.custodian.public_key, observerIdentity2.public_key);
    await writeFile(planInputPath, canonicalBytes({
      format: "mortalos-placement-admission-deployment-plan-input/1",
      observers: [
        {
          declared_administration_id: administration1,
          declared_failure_domain_id: failureDomain1,
          declared_vantage_id: vantage1,
          observer: observerIdentity1
        },
        {
          declared_administration_id: administration2,
          declared_failure_domain_id: failureDomain2,
          declared_vantage_id: vantage2,
          observer: observerIdentity2
        }
      ]
    }));
    const generatedPlanResult = await runNode(deploymentPlanRunner, [
      "--assignments", planInputPath,
      "--bundle", bundlePath,
      "--expires-at-ms", "8000",
      "--issued-at-ms", "2000",
      "--not-before-ms", "2100",
      "--output", generatedPlanPath,
      "--timeout-ms", "5000"
    ]);
    assert.equal(generatedPlanResult.code, 0, generatedPlanResult.stderr);
    const generatedPlan = restorePlacementAdmissionDeploymentPlan(
      new Uint8Array(await readFile(generatedPlanPath))
    );
    assert.equal(generatedPlan.status, "deployment-plan-verified");
    assert.equal(generatedPlan.observers.length, 2);
    assert.equal(generatedPlan.non_authority, true);
    const generatedPlanRetry = await runNode(deploymentPlanRunner, [
      "--assignments", planInputPath,
      "--bundle", bundlePath,
      "--expires-at-ms", "8000",
      "--issued-at-ms", "2000",
      "--not-before-ms", "2100",
      "--output", generatedPlanPath,
      "--timeout-ms", "5000"
    ]);
    assert.notEqual(generatedPlanRetry.code, 0);
    assert.match(
      generatedPlanRetry.stderr,
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u
    );
    const planOptions = (observers) => ({
      ceremony_bundle_bytes: new Uint8Array(awaitableBundleBytes),
      expires_at_ms: 8000,
      issued_at_ms: 2000,
      not_before_ms: 2100,
      observers,
      timeout_ms: 5000
    });
    const awaitableBundleBytes = await readFile(bundlePath);
    const observerAssignments = [
      {
        declared_administration_id: administration1,
        declared_failure_domain_id: failureDomain1,
        declared_vantage_id: vantage1,
        observer: observerIdentity1,
        observer_nonce: new Uint8Array(32).fill(113)
      },
      {
        declared_administration_id: administration2,
        declared_failure_domain_id: failureDomain2,
        declared_vantage_id: vantage2,
        observer: observerIdentity2,
        observer_nonce: new Uint8Array(32).fill(114)
      }
    ];
    const plan = createPlacementAdmissionDeploymentPlan(planOptions(observerAssignments));
    const reversedPlan = createPlacementAdmissionDeploymentPlan(
      planOptions([observerAssignments[1], observerAssignments[0]])
    );
    assert.deepEqual(reversedPlan, plan);
    const substitutedPlan = createPlacementAdmissionDeploymentPlan(planOptions([
      { ...observerAssignments[0], observer_nonce: new Uint8Array(32).fill(115) },
      observerAssignments[1]
    ]));
    await writeFile(planPath, plan.bytes);
    const acceptedPlan1 = await runNode(acceptDeploymentPlanRunner, [
      "--authority", observerAuthority1Path,
      "--deployment-plan", planPath,
      "--output", acceptance1Path
    ]);
    const acceptedPlan2 = await runNode(acceptDeploymentPlanRunner, [
      "--authority", observerAuthority2Path,
      "--deployment-plan", planPath,
      "--output", acceptance2Path
    ]);
    assert.equal(acceptedPlan1.code, 0, acceptedPlan1.stderr);
    assert.equal(acceptedPlan2.code, 0, acceptedPlan2.stderr);
    const acceptance1Bytes = new Uint8Array(await readFile(acceptance1Path));
    const acceptance2Bytes = new Uint8Array(await readFile(acceptance2Path));
    const acceptedPlan1Retry = await runNode(acceptDeploymentPlanRunner, [
      "--authority", observerAuthority1Path,
      "--deployment-plan", planPath,
      "--output", acceptance1RetryPath
    ]);
    assert.equal(acceptedPlan1Retry.code, 0, acceptedPlan1Retry.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(acceptance1RetryPath)),
      acceptance1Bytes
    );
    await writeFile(substitutedPlanPath, substitutedPlan.bytes);
    const conflictingAcceptance = await runNode(acceptDeploymentPlanRunner, [
      "--authority", observerAuthority1Path,
      "--deployment-plan", substitutedPlanPath,
      "--output", conflictingAcceptancePath
    ]);
    assert.notEqual(conflictingAcceptance.code, 0);
    assert.match(conflictingAcceptance.stderr, /E_CONTINUITY_EQUIVOCATION/u);
    assert.equal(await absent(conflictingAcceptancePath), true);
    const activatedPlan = await runNode(activateDeploymentPlanRunner, [
      "--deployment-plan", planPath,
      "--acceptance", acceptance2Path,
      "--acceptance", acceptance1Path,
      "--output", activationPath
    ]);
    assert.equal(activatedPlan.code, 0, activatedPlan.stderr);
    const activation = restorePlacementAdmissionDeploymentPlanActivation(
      new Uint8Array(await readFile(activationPath))
    );
    assert.equal(activation.status, "deployment-plan-activation-verified");
    assert.equal(activation.plan_id, plan.plan_id);
    assert.deepEqual(activation.observer_key_ids, [
      observerIdentity1.key_id,
      observerIdentity2.key_id
    ].sort());
    assert.deepEqual(
      createPlacementAdmissionDeploymentPlanActivation({
        acceptance_bytes: [acceptance1Bytes, acceptance2Bytes],
        plan_bytes: plan.bytes
      }),
      createPlacementAdmissionDeploymentPlanActivation({
        acceptance_bytes: [acceptance2Bytes, acceptance1Bytes],
        plan_bytes: plan.bytes
      })
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlanActivation({
        acceptance_bytes: [acceptance1Bytes],
        plan_bytes: plan.bytes
      }),
      /incomplete-deployment-plan-acceptances/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlanActivation({
        acceptance_bytes: [acceptance1Bytes, acceptance1Bytes],
        plan_bytes: plan.bytes
      }),
      /deployment-plan-activation-roster/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlanActivation({
        acceptance_bytes: [acceptance1Bytes, acceptance2Bytes],
        plan_bytes: substitutedPlan.bytes
      }),
      /deployment-plan-acceptance-plan/u
    );
    const reversedActivationDocument = parseJsonBytes(activation.bytes);
    reversedActivationDocument.acceptances_base64url.reverse();
    const reversedActivationBasis = { ...reversedActivationDocument };
    delete reversedActivationBasis.activation_id;
    reversedActivationDocument.activation_id = domainHash(
      DEPLOYMENT_PLAN_ACTIVATION_DOMAIN,
      canonicalBytes(reversedActivationBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentPlanActivation(
        canonicalBytes(reversedActivationDocument)
      ),
      /deployment-plan-activation-roster/u
    );
    const activationRetry = await runNode(activateDeploymentPlanRunner, [
      "--deployment-plan", planPath,
      "--acceptance", acceptance1Path,
      "--acceptance", acceptance2Path,
      "--output", activationPath
    ]);
    assert.notEqual(activationRetry.code, 0);
    assert.match(activationRetry.stderr, /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u);

    const bundle = restorePlacementAdmissionCeremonyBundle(new Uint8Array(awaitableBundleBytes));
    const [observerCeremony1, observerCeremony2] = await Promise.all([
      createObserverAdmissionCeremony({
        directory,
        failureDomainId: failureDomain1,
        label: "observer-1-admission",
        operatorRootId: administration1,
        organismId: continuity.organism_id,
        subjectAuthorityPath: observerAuthority1Path,
        subjectIdentityPath: observerIdentity1Path
      }),
      createObserverAdmissionCeremony({
        directory,
        failureDomainId: failureDomain2,
        label: "observer-2-admission",
        operatorRootId: administration2,
        organismId: continuity.organism_id,
        subjectAuthorityPath: observerAuthority2Path,
        subjectIdentityPath: observerIdentity2Path
      })
    ]);
    const membershipBundlePaths = [
      bundlePath,
      observerCeremony1.bundlePath,
      observerCeremony2.bundlePath
    ];
    const membershipEpoch = await createMembershipEpochViaCli({
      approvalPath: membershipApprovalPath,
      bundlePaths: membershipBundlePaths,
      capsulePath,
      continuityAuthorityPath,
      epochPath: membershipEpochPath,
      requestPath: membershipRequestPath
    });
    const membershipEpochBytes = membershipEpoch.bytes;
    const membershipEpoch2 = await createMembershipEpochViaCli({
      approvalPath: membershipApproval2Path,
      bundlePaths: membershipBundlePaths,
      capsulePath,
      continuityAuthorityPath,
      epochPath: membershipEpoch2Path,
      priorEpochPath: membershipEpochPath,
      requestPath: membershipRequest2Path
    });
    const membershipEpoch2Bytes = membershipEpoch2.bytes;
    assert.deepEqual(
      membershipEpoch.members.map((entry) => entry.identity.key_id).sort(),
      [subjectIdentity.key_id, observerIdentity1.key_id, observerIdentity2.key_id].sort()
    );
    assert.equal(observerCeremony1.bundleBytes.byteLength > 0, true);
    assert.equal(observerCeremony2.bundleBytes.byteLength > 0, true);
    const deploymentMembership = createPlacementAdmissionDeploymentPlanMembership({
      activation_bytes: activation.bytes,
      capsule_bytes: continuity.capsule_bytes,
      ceremony_bundle_bytes: bundle.bytes,
      membership_epoch_candidate_bytes: [membershipEpoch2Bytes, membershipEpochBytes]
    });
    assert.equal(deploymentMembership.status, "deployment-plan-membership-current");
    assert.equal(deploymentMembership.membership_admitted, true);
    assert.equal(deploymentMembership.membership_current, true);
    assert.equal(deploymentMembership.membership_candidate_view_verified, true);
    assert.equal(deploymentMembership.membership_epoch_id, membershipEpoch2.epoch_id);
    assert.equal(deploymentMembership.membership_candidate_epoch_ids.length, 2);
    assert.deepEqual(
      deploymentMembership.membership_candidate_epoch_ids,
      [membershipEpoch.epoch_id, membershipEpoch2.epoch_id].sort()
    );
    assert.equal(deploymentMembership.physical_independence, "unproven");
    assert.equal(deploymentMembership.sybil_resistance, "unproven");
    assert.deepEqual(deploymentMembership.observer_key_ids, activation.observer_key_ids);
    assert.equal(
      restorePlacementAdmissionDeploymentPlanMembership(deploymentMembership.bytes).membership_current,
      false
    );
    assert.equal(
      restorePlacementAdmissionDeploymentPlanMembership(deploymentMembership.bytes)
        .membership_candidate_view_verified,
      false
    );
    assert.equal(
      verifyPlacementAdmissionDeploymentPlanMembership({
        capsule_bytes: continuity.capsule_bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
        membership_bytes: deploymentMembership.bytes
      }).membership_current,
      true
    );
    assert.deepEqual(
      createPlacementAdmissionDeploymentPlanMembership({
        activation_bytes: activation.bytes,
        capsule_bytes: continuity.capsule_bytes,
        ceremony_bundle_bytes: bundle.bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes]
      }),
      deploymentMembership
    );
    const boundMembership = await runNode(bindDeploymentPlanMembershipRunner, [
      "--activation", activationPath,
      "--bundle", bundlePath,
      "--capsule", capsulePath,
      "--membership-epoch", membershipEpoch2Path,
      "--membership-epoch", membershipEpochPath,
      "--output", deploymentMembershipPath
    ]);
    assert.equal(boundMembership.code, 0, boundMembership.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(deploymentMembershipPath)),
      deploymentMembership.bytes
    );
    const boundMembershipRetry = await runNode(bindDeploymentPlanMembershipRunner, [
      "--activation", activationPath,
      "--bundle", bundlePath,
      "--capsule", capsulePath,
      "--membership-epoch", membershipEpochPath,
      "--membership-epoch", membershipEpoch2Path,
      "--output", deploymentMembershipPath
    ]);
    assert.notEqual(boundMembershipRetry.code, 0);
    assert.match(
      boundMembershipRetry.stderr,
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u
    );

    const outsiderSigners = await Promise.all([createPlacementSigner(), createPlacementSigner()]);
    const outsiderObservers = outsiderSigners.map(placementSignerObserver);
    const outsiderPlan = createPlacementAdmissionDeploymentPlan(planOptions(
      outsiderSigners.map((signer, index) => ({
        declared_administration_id: digest(
          "MortalOS deployment outsider administration",
          { index }
        ),
        declared_failure_domain_id: digest(
          "MortalOS deployment outsider failure domain",
          { index }
        ),
        declared_vantage_id: digest("MortalOS deployment outsider vantage", { index }),
        observer: signer.identity,
        observer_nonce: new Uint8Array(32).fill(120 + index)
      }))
    ));
    const outsiderAcceptances = await Promise.all(outsiderObservers.map((observer) =>
      acceptPlacementAdmissionDeploymentPlan({ observer, plan_bytes: outsiderPlan.bytes })));
    const outsiderActivation = createPlacementAdmissionDeploymentPlanActivation({
      acceptance_bytes: outsiderAcceptances.map((entry) => entry.bytes),
      plan_bytes: outsiderPlan.bytes
    });
    assert.throws(
      () => createPlacementAdmissionDeploymentPlanMembership({
        activation_bytes: outsiderActivation.bytes,
        capsule_bytes: continuity.capsule_bytes,
        ceremony_bundle_bytes: bundle.bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes]
      }),
      /deployment-plan-membership-assignment/u
    );
    const wrongContinuityAuthority = await createContinuityAuthority();
    const wrongContinuity = await createContinuity({
      authority: wrongContinuityAuthority,
      resourceBytes: new TextEncoder().encode("wrong deployment membership".repeat(32)),
      transitionId: "wrong-deployment-membership"
    });
    assert.throws(
      () => verifyPlacementAdmissionDeploymentPlanMembership({
        capsule_bytes: wrongContinuity.capsule_bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
        membership_bytes: deploymentMembership.bytes
      }),
      /deployment-membership-current-epoch-missing/u
    );
    assert.throws(
      () => verifyPlacementAdmissionDeploymentPlanMembership({
        capsule_bytes: continuity.capsule_bytes,
        membership_epoch_candidate_bytes: [membershipEpoch2Bytes],
        membership_bytes: deploymentMembership.bytes
      }),
      /deployment-membership-incomplete-chain/u
    );
    const reorderedMembershipDocument = parseJsonBytes(deploymentMembership.bytes);
    reorderedMembershipDocument.observer_key_ids.reverse();
    const reorderedMembershipBasis = { ...reorderedMembershipDocument };
    delete reorderedMembershipBasis.membership_id;
    reorderedMembershipDocument.membership_id = domainHash(
      DEPLOYMENT_PLAN_MEMBERSHIP_DOMAIN,
      canonicalBytes(reorderedMembershipBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentPlanMembership(
        canonicalBytes(reorderedMembershipDocument)
      ),
      /deployment-plan-membership-fields/u
    );
    const reorderedCandidateView = parseJsonBytes(deploymentMembership.bytes);
    reorderedCandidateView.membership_candidate_epoch_ids.reverse();
    const reorderedCandidateViewBasis = { ...reorderedCandidateView };
    delete reorderedCandidateViewBasis.membership_id;
    reorderedCandidateView.membership_id = domainHash(
      DEPLOYMENT_PLAN_MEMBERSHIP_DOMAIN,
      canonicalBytes(reorderedCandidateViewBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentPlanMembership(
        canonicalBytes(reorderedCandidateView)
      ),
      /deployment-membership-candidate-order/u
    );

    const attestationArguments = ({
      authority,
      observationJournal,
      observedAt,
      output
    }) => [
      "--attested-at-ms", "2200",
      "--authority", authority,
      "--capsule", capsulePath,
      "--deployment-plan-membership", deploymentMembershipPath,
      "--membership-epoch", membershipEpochPath,
      "--membership-epoch", membershipEpoch2Path,
      "--observed-at-ms", String(observedAt),
      "--observation-journal", observationJournal,
      "--output", output
    ];
    const attested1 = await runNode(attesterRunner, attestationArguments({
      authority: observerAuthority1Path,
      observationJournal: attestation1ObservationJournalPath,
      observedAt: 2100,
      output: attestation1Path
    }), proofEnvironment);
    const attested2 = await runNode(attesterRunner, attestationArguments({
      authority: observerAuthority2Path,
      observationJournal: attestation2ObservationJournalPath,
      observedAt: 2101,
      output: attestation2Path
    }), proofEnvironment);
    assert.equal(attested1.code, 0, attested1.stderr);
    assert.equal(attested2.code, 0, attested2.stderr);
    assert.equal(JSON.parse(attested1.stdout).observation_source, "live");
    assert.equal(JSON.parse(attested2.stdout).observation_source, "live");
    const attestation1 = restorePlacementAdmissionDeploymentAttestation(
      new Uint8Array(await readFile(attestation1Path))
    );
    const attestation2 = restorePlacementAdmissionDeploymentAttestation(
      new Uint8Array(await readFile(attestation2Path))
    );
    const attestation1Document = parseJsonBytes(attestation1.bytes);
    const attestation2Document = parseJsonBytes(attestation2.bytes);
    const attestedObservation1Bytes = decodeBase64Url(
      attestation1Document.observation_base64url
    );
    const attestedObservation2Bytes = decodeBase64Url(
      attestation2Document.observation_base64url
    );
    assert.notEqual(attestedObservation1Bytes, null);
    assert.notEqual(attestedObservation2Bytes, null);
    const attestedObservation1 = restorePlacementAdmissionDeploymentObservation(
      attestedObservation1Bytes
    );
    const attestedObservation2 = restorePlacementAdmissionDeploymentObservation(
      attestedObservation2Bytes
    );
    assert.deepEqual(
      new Uint8Array(await readFile(attestation1ObservationJournalPath)),
      attestedObservation1.bytes
    );
    assert.deepEqual(
      new Uint8Array(await readFile(attestation2ObservationJournalPath)),
      attestedObservation2.bytes
    );
    const observationJournalText = await readFile(
      attestation1ObservationJournalPath,
      "utf8"
    );
    assert.equal(observationJournalText.includes(issuerToken), false);
    assert.equal(observationJournalText.includes(subjectToken), false);
    assert.equal(observationJournalText.includes(issuerPossessionToken), false);
    assert.equal(observationJournalText.includes(subjectPossessionToken), false);
    assert.equal(observationJournalText.includes("BEGIN PRIVATE KEY"), false);
    assert.equal(attestation1.status, "attestation-verified");
    assert.equal(attestation1.non_authority, true);
    assert.equal(attestation1.independent_administration, "unproven");
    assert.equal(attestation1.independent_failure_domains, "unproven");
    assert.equal(attestation1.deployment_plan_activation_id, activation.activation_id);
    assert.equal(attestation1.deployment_plan_id, plan.plan_id);
    assert.equal(attestation1.deployment_plan_membership_id, deploymentMembership.membership_id);
    assert.equal(attestation1.membership_admitted, true);
    assert.equal(
      attestation1.membership_candidate_view_id,
      deploymentMembership.membership_candidate_view_id
    );
    assert.equal(attestation1.membership_epoch_id, deploymentMembership.membership_epoch_id);
    assert.equal(attestation1.observation_id, attestedObservation1.observation_id);
    assert.equal(attestation2.observation_id, attestedObservation2.observation_id);
    assert.notEqual(attestation1.observation_id, opened.observation_id);
    assert.notEqual(attestation2.observation_id, opened2.observation_id);
    assert.equal(attestedObservation1.observed_at_ms, opened.observed_at_ms);
    assert.equal(attestedObservation2.observed_at_ms, opened2.observed_at_ms);
    assert.equal(attestedObservation1.ceremony_bundle_id, opened.ceremony_bundle_id);
    assert.equal(attestedObservation2.ceremony_bundle_id, opened2.ceremony_bundle_id);
    assert.notEqual(attestation1.observer.key_id, attestation2.observer.key_id);
    const view = evaluatePlacementAdmissionDeploymentAttestations({
      attestation_bytes: [attestation2.bytes, attestation1.bytes]
    });
    assert.equal(view.status, "consistent-attested-observations");
    assert.equal(view.attestation_count, 2);
    assert.equal(view.ceremony_bundle_id, opened.ceremony_bundle_id);
    assert.equal(view.deployment_plan_activation_id, activation.activation_id);
    assert.equal(view.deployment_plan_id, plan.plan_id);
    assert.equal(view.deployment_plan_membership_id, deploymentMembership.membership_id);
    assert.equal(view.membership_admitted, true);
    assert.equal(
      view.membership_candidate_view_id,
      deploymentMembership.membership_candidate_view_id
    );
    assert.equal(view.membership_epoch_id, deploymentMembership.membership_epoch_id);
    assert.equal(view.declared_administration_ids_distinct, true);
    assert.equal(view.declared_failure_domain_ids_distinct, true);
    assert.equal(view.independent_administration, "unproven");
    assert.equal(view.independent_failure_domains, "unproven");
    assert.equal(view.non_authority, true);
    assert.deepEqual(
      view.observer_key_ids,
      [...view.observer_key_ids].sort()
    );
    assert.deepEqual(
      evaluatePlacementAdmissionDeploymentAttestations({
        attestation_bytes: [attestation1.bytes, attestation2.bytes]
      }),
      view
    );
    const attestationView = createPlacementAdmissionDeploymentAttestationView({
      attestation_bytes: [attestation2.bytes, attestation1.bytes]
    });
    assert.equal(attestationView.status, "deployment-attestation-view-verified");
    assert.equal(attestationView.attestations_verified, true);
    assert.equal(attestationView.attestation_count, 2);
    assert.deepEqual(attestationView.attestation_ids, view.attestation_ids);
    assert.deepEqual(attestationView.observer_key_ids, view.observer_key_ids);
    assert.equal(
      attestationView.membership_candidate_view_id,
      deploymentMembership.membership_candidate_view_id
    );
    const restoredAttestationView = restorePlacementAdmissionDeploymentAttestationView(
      attestationView.bytes
    );
    assert.equal(restoredAttestationView.status, "deployment-attestation-view-restored");
    assert.equal(restoredAttestationView.attestations_verified, false);
    assert.deepEqual(
      verifyPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes, attestation2.bytes],
        view_bytes: attestationView.bytes
      }),
      attestationView
    );
    assert.deepEqual(
      createPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes, attestation2.bytes]
      }),
      attestationView
    );
    assert.equal(new TextDecoder().decode(attestationView.bytes).includes("ed25519:"), false);
    const createdAttestationView = await runNode(createDeploymentAttestationViewRunner, [
      "--attestation", attestation2Path,
      "--attestation", attestation1Path,
      "--output", attestationViewPath
    ]);
    assert.equal(createdAttestationView.code, 0, createdAttestationView.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(attestationViewPath)),
      attestationView.bytes
    );
    const createdAttestationViewRetry = await runNode(createDeploymentAttestationViewRunner, [
      "--attestation", attestation1Path,
      "--attestation", attestation2Path,
      "--output", attestationViewRetryPath
    ]);
    assert.equal(createdAttestationViewRetry.code, 0, createdAttestationViewRetry.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(attestationViewRetryPath)),
      attestationView.bytes
    );
    const verifiedAttestationView = await runNode(verifyDeploymentAttestationViewRunner, [
      "--view", attestationViewPath,
      "--attestation", attestation1Path,
      "--attestation", attestation2Path
    ]);
    assert.equal(verifiedAttestationView.code, 0, verifiedAttestationView.stderr);
    assert.deepEqual(JSON.parse(verifiedAttestationView.stdout), {
      attestation_count: 2,
      attestations_verified: true,
      membership_candidate_view_id: deploymentMembership.membership_candidate_view_id,
      non_authority: true,
      status: "deployment-attestation-view-verified",
      view_id: attestationView.view_id
    });
    const sourceCheckoutPath = join(directory, "source-checkout");
    await mkdir(sourceCheckoutPath);
    await writeFile(join(sourceCheckoutPath, "source-marker.txt"), "verified source\n");
    await runCommand("git", ["init", "--quiet"], { cwd: sourceCheckoutPath });
    await runCommand("git", ["add", "source-marker.txt"], { cwd: sourceCheckoutPath });
    await runCommand("git", [
      "-c", "user.name=MortalOS Test",
      "-c", "user.email=mortalos-test@example.invalid",
      "-c", "commit.gpgsign=false",
      "commit", "--quiet", "-m", "source fixture"
    ], { cwd: sourceCheckoutPath });
    const sourceCommit = (await runCommand(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: sourceCheckoutPath }
    )).stdout.trim();
    assert.match(sourceCommit, /^[0-9a-f]{40}$/u);
    const pilotIndex = {
      capsule: "capsule.json",
      ceremonies: [
        {
          bundle: "bundle.json",
          issuer_response: "issuer-response.json",
          request: "request.json",
          subject_identity: "subject-identity.json",
          subject_response: "subject-response.json",
          trust_root: "trust-root.json"
        },
        {
          bundle: "observer-1-admission-bundle.json",
          issuer_response: "observer-1-admission-issuer-response.json",
          request: "observer-1-admission-request.json",
          subject_identity: "observer-identity-1.json",
          subject_response: "observer-1-admission-subject-response.json",
          trust_root: "observer-1-admission-trust-root.json"
        },
        {
          bundle: "observer-2-admission-bundle.json",
          issuer_response: "observer-2-admission-issuer-response.json",
          request: "observer-2-admission-request.json",
          subject_identity: "observer-identity-2.json",
          subject_response: "observer-2-admission-subject-response.json",
          trust_root: "observer-2-admission-trust-root.json"
        }
      ],
      deployment: {
        acceptances: [
          "deployment-plan-acceptance-1.json",
          "deployment-plan-acceptance-2.json"
        ],
        activation: "deployment-plan-activation.json",
        attestations: ["attestation-1.json", "attestation-2.json"],
        membership: "deployment-plan-membership.json",
        plan: "deployment-plan.json",
        primary_ceremony_bundle: "bundle.json",
        view: "attestation-view.json"
      },
      epochs: [
        {
          approvals: ["membership-approval.json"],
          ceremony_bundles: [
            "bundle.json",
            "observer-1-admission-bundle.json",
            "observer-2-admission-bundle.json"
          ],
          epoch: "membership-epoch.json",
          request: "membership-request.json"
        },
        {
          approvals: ["membership-approval-2.json"],
          ceremony_bundles: [
            "bundle.json",
            "observer-1-admission-bundle.json",
            "observer-2-admission-bundle.json"
          ],
          epoch: "membership-epoch-2.json",
          request: "membership-request-2.json"
        }
      ],
      format: "mortalos-placement-admission-pilot-evidence-index/1",
      source_commit: sourceCommit
    };
    await writeFile(pilotIndexPath, canonicalBytes(pilotIndex));
    const loadedPilotIndex = loadPlacementAdmissionPilotEvidenceIndex(pilotIndexPath);
    const directPilotEvidence = createPlacementAdmissionPilotEvidence({
      capsule_bytes: loadedPilotIndex.capsule_bytes,
      ceremony_records: loadedPilotIndex.ceremony_records,
      deployment: loadedPilotIndex.deployment,
      epoch_records: loadedPilotIndex.epoch_records,
      source_commit: loadedPilotIndex.source_commit
    });
    assert.equal(directPilotEvidence.public_chain_verified, true);
    const sparseEpochRecords = [];
    sparseEpochRecords.length = 1;
    assert.throws(
      () => createPlacementAdmissionPilotEvidence({
        capsule_bytes: loadedPilotIndex.capsule_bytes,
        ceremony_records: loadedPilotIndex.ceremony_records,
        deployment: loadedPilotIndex.deployment,
        epoch_records: sparseEpochRecords,
        source_commit: loadedPilotIndex.source_commit
      }),
      /E_PLACEMENT_ADMISSION_PILOT_FORMAT/u
    );
    assert.throws(
      () => createPlacementAdmissionPilotEvidence({
        capsule_bytes: loadedPilotIndex.capsule_bytes,
        ceremony_records: loadedPilotIndex.ceremony_records,
        deployment: loadedPilotIndex.deployment,
        epoch_records: new Array(
          PLACEMENT_ADMISSION_PILOT_EVIDENCE_LIMITS.epochs_max + 1
        ).fill(loadedPilotIndex.epoch_records[0]),
        source_commit: loadedPilotIndex.source_commit
      }),
      /E_PLACEMENT_ADMISSION_PILOT_LIMIT/u
    );
    if (typeof SharedArrayBuffer === "function") {
      const sharedCapsule = new Uint8Array(new SharedArrayBuffer(
        loadedPilotIndex.capsule_bytes.byteLength
      ));
      sharedCapsule.set(loadedPilotIndex.capsule_bytes);
      assert.throws(
        () => createPlacementAdmissionPilotEvidence({
          capsule_bytes: sharedCapsule,
          ceremony_records: loadedPilotIndex.ceremony_records,
          deployment: loadedPilotIndex.deployment,
          epoch_records: loadedPilotIndex.epoch_records,
          source_commit: loadedPilotIndex.source_commit
        }),
        /pilot-capsule-shared-memory/u
      );
    }
    let accessorCalls = 0;
    const pilotAccessorOptions = {
      ceremony_records: loadedPilotIndex.ceremony_records,
      deployment: loadedPilotIndex.deployment,
      epoch_records: loadedPilotIndex.epoch_records,
      source_commit: loadedPilotIndex.source_commit
    };
    Object.defineProperty(pilotAccessorOptions, "capsule_bytes", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return loadedPilotIndex.capsule_bytes;
      }
    });
    assert.throws(
      () => createPlacementAdmissionPilotEvidence(pilotAccessorOptions),
      /ordinary-own-data/u
    );
    assert.equal(accessorCalls, 0);
    const createdPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotIndexPath,
      "--output", pilotEvidencePath
    ]);
    assert.equal(createdPilotEvidence.code, 0, createdPilotEvidence.stderr);
    const createdPilotStatus = JSON.parse(createdPilotEvidence.stdout);
    assert.equal(createdPilotStatus.epoch_count, 2);
    assert.equal(createdPilotStatus.public_chain_verified, true);
    assert.equal(createdPilotStatus.source_commit, sourceCommit);
    assert.equal(createdPilotStatus.source_commit_execution_binding, "recorded-only");
    assert.equal(createdPilotStatus.topology_authority, "unproven");
    assert.equal(createdPilotStatus.view_id, attestationView.view_id);
    const pilotEvidenceBytes = new Uint8Array(await readFile(pilotEvidencePath));
    assert.deepEqual(pilotEvidenceBytes, directPilotEvidence.bytes);
    const restoredPilotEvidence = restorePlacementAdmissionPilotEvidence(pilotEvidenceBytes);
    assert.equal(restoredPilotEvidence.public_chain_verified, false);
    assert.equal(restoredPilotEvidence.source_commit_execution_binding, "recorded-only");
    assert.equal(restoredPilotEvidence.topology_authority, "unproven");
    assert.doesNotMatch(
      new TextDecoder().decode(pilotEvidenceBytes),
      /private|pkcs8|secret|bearer|token|BEGIN PRIVATE KEY/iu
    );
    const verifiedPilotEvidence = await runNode(verifyPilotEvidenceRunner, [
      "--evidence", pilotEvidencePath,
      "--expected-source-commit", sourceCommit,
      "--index", pilotIndexPath
    ]);
    assert.equal(verifiedPilotEvidence.code, 0, verifiedPilotEvidence.stderr);
    assert.deepEqual(
      verifyPlacementAdmissionPilotEvidence({
        capsule_bytes: loadedPilotIndex.capsule_bytes,
        ceremony_records: loadedPilotIndex.ceremony_records,
        deployment: loadedPilotIndex.deployment,
        epoch_records: loadedPilotIndex.epoch_records,
        evidence_bytes: pilotEvidenceBytes,
        expected_source_commit: sourceCommit,
        source_commit: loadedPilotIndex.source_commit
      }).bytes,
      pilotEvidenceBytes
    );
    assert.deepEqual(JSON.parse(verifiedPilotEvidence.stdout), {
      epoch_count: 2,
      evidence_id: createdPilotStatus.evidence_id,
      non_authority: true,
      public_chain_verified: true,
      source_commit: sourceCommit,
      source_commit_execution_binding: "recorded-only",
      status: "placement-admission-pilot-public-chain-verified",
      topology_authority: "unproven",
      view_id: attestationView.view_id
    });

    const providerIssuerResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(issuerResponsePath))
    );
    const providerSubjectResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(subjectResponsePath))
    );
    const observer1IssuerResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(observerCeremony1.issuerResponsePath))
    );
    const observer1SubjectResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(observerCeremony1.subjectResponsePath))
    );
    const observer2IssuerResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(observerCeremony2.issuerResponsePath))
    );
    const observer2SubjectResponse = restorePlacementAdmissionCeremonyRoleResponse(
      new Uint8Array(await readFile(observerCeremony2.subjectResponsePath))
    );
    const membershipApproval = restorePlacementMembershipEpochApproval({
      approval_bytes: new Uint8Array(await readFile(membershipApprovalPath)),
      capsule_bytes: continuity.capsule_bytes,
      prior_epoch_bytes: null,
      request_bytes: new Uint8Array(await readFile(membershipRequestPath))
    });
    const membershipApproval2 = restorePlacementMembershipEpochApproval({
      approval_bytes: new Uint8Array(await readFile(membershipApproval2Path)),
      capsule_bytes: continuity.capsule_bytes,
      prior_epoch_bytes: membershipEpochBytes,
      request_bytes: new Uint8Array(await readFile(membershipRequest2Path))
    });
    const acceptance1 = restorePlacementAdmissionDeploymentPlanAcceptance({
      acceptance_bytes: acceptance1Bytes,
      plan_bytes: plan.bytes
    });
    const acceptance2 = restorePlacementAdmissionDeploymentPlanAcceptance({
      acceptance_bytes: acceptance2Bytes,
      plan_bytes: plan.bytes
    });
    const roleExecutionSpecs = [
      {
        artifactId: providerIssuerResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: issuerResponsePath,
        authorityPath: issuerAuthorityPath,
        role: "issuer"
      },
      {
        artifactId: providerSubjectResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: subjectResponsePath,
        authorityPath: subjectAuthorityPath,
        role: "subject"
      },
      {
        artifactId: observer1IssuerResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: observerCeremony1.issuerResponsePath,
        authorityPath: observerCeremony1.issuerAuthorityPath,
        role: "issuer"
      },
      {
        artifactId: observer1SubjectResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: observerCeremony1.subjectResponsePath,
        authorityPath: observerAuthority1Path,
        role: "subject"
      },
      {
        artifactId: observer2IssuerResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: observerCeremony2.issuerResponsePath,
        authorityPath: observerCeremony2.issuerAuthorityPath,
        role: "issuer"
      },
      {
        artifactId: observer2SubjectResponse.role_response_id,
        artifactKind: "ceremony-role-response",
        artifactPath: observerCeremony2.subjectResponsePath,
        authorityPath: observerAuthority2Path,
        role: "subject"
      },
      {
        artifactId: membershipApproval.approval_id,
        artifactKind: "membership-epoch-approval",
        artifactPath: membershipApprovalPath,
        authorityPath: continuityAuthorityPath,
        role: "custodian"
      },
      {
        artifactId: membershipApproval2.approval_id,
        artifactKind: "membership-epoch-approval",
        artifactPath: membershipApproval2Path,
        authorityPath: continuityAuthorityPath,
        role: "custodian"
      },
      {
        artifactId: acceptance1.acceptance_id,
        artifactKind: "deployment-plan-acceptance",
        artifactPath: acceptance1Path,
        authorityPath: observerAuthority1Path,
        role: "observer"
      },
      {
        artifactId: acceptance2.acceptance_id,
        artifactKind: "deployment-plan-acceptance",
        artifactPath: acceptance2Path,
        authorityPath: observerAuthority2Path,
        role: "observer"
      },
      {
        artifactId: attestation1.attestation_id,
        artifactKind: "deployment-observation-attestation",
        artifactPath: attestation1Path,
        authorityPath: observerAuthority1Path,
        role: "observer"
      },
      {
        artifactId: attestation2.attestation_id,
        artifactKind: "deployment-observation-attestation",
        artifactPath: attestation2Path,
        authorityPath: observerAuthority2Path,
        role: "observer"
      }
    ];
    const roleExecutionReceiptPaths = [];
    const roleExecutionReceiptBytes = [];
    for (let index = 0; index < roleExecutionSpecs.length; index += 1) {
      const spec = roleExecutionSpecs[index];
      const outputPath = join(directory, `role-execution-receipt-${index}.json`);
      if (index === 0) {
        const attested = await runNode(attestRoleExecutionRunner, [
          "--authority", spec.authorityPath,
          "--artifact", spec.artifactPath,
          "--artifact-id", spec.artifactId,
          "--artifact-kind", spec.artifactKind,
          "--role", spec.role,
          "--source-commit", sourceCommit,
          "--repo-root", sourceCheckoutPath,
          "--output", outputPath
        ], {});
        assert.equal(attested.code, 0, attested.stderr);
        const status = JSON.parse(attested.stdout);
        assert.equal(status.checkout_state, "clean");
        assert.equal(status.source_commit, sourceCommit);
        assert.equal(status.status, "role-execution-receipt-verified");
      } else {
        const signer = await loadNodeAuthority(spec.authorityPath, { create: false });
        const created = await createPlacementAdmissionRoleExecutionReceipt({
          artifact_bytes: new Uint8Array(await readFile(spec.artifactPath)),
          artifact_id: spec.artifactId,
          artifact_kind: spec.artifactKind,
          role: spec.role,
          signer,
          source_commit: sourceCommit
        });
        await writeFile(outputPath, created.bytes);
      }
      const bytes = new Uint8Array(await readFile(outputPath));
      const receipt = restorePlacementAdmissionRoleExecutionReceipt(bytes);
      assert.equal(receipt.artifact_id, spec.artifactId);
      assert.equal(receipt.artifact_kind, spec.artifactKind);
      assert.equal(receipt.role, spec.role);
      assert.equal(receipt.signature_verified, true);
      roleExecutionReceiptPaths.push(outputPath);
      roleExecutionReceiptBytes.push(bytes);
    }
    const tamperedRoleReceipt = parseJsonBytes(roleExecutionReceiptBytes[0]);
    tamperedRoleReceipt.artifact_digest = digest(
      "MortalOS placement admission substituted execution artifact",
      { substituted: true }
    );
    assert.throws(
      () => restorePlacementAdmissionRoleExecutionReceipt(
        canonicalBytes(tamperedRoleReceipt)
      ),
      /E_PLACEMENT_ADMISSION_EXECUTION_BINDING/u
    );
    const roleExecutionRetry = await runNode(attestRoleExecutionRunner, [
      "--authority", roleExecutionSpecs[0].authorityPath,
      "--artifact", roleExecutionSpecs[0].artifactPath,
      "--artifact-id", roleExecutionSpecs[0].artifactId,
      "--artifact-kind", roleExecutionSpecs[0].artifactKind,
      "--role", roleExecutionSpecs[0].role,
      "--source-commit", sourceCommit,
      "--repo-root", sourceCheckoutPath,
      "--output", roleExecutionReceiptRetryPath
    ], {});
    assert.equal(roleExecutionRetry.code, 0, roleExecutionRetry.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(roleExecutionReceiptRetryPath)),
      roleExecutionReceiptBytes[0]
    );
    await assert.rejects(
      createPlacementAdmissionRoleExecutionReceipt({
        artifact_bytes: new Uint8Array(await readFile(roleExecutionSpecs[0].artifactPath)),
        artifact_id: roleExecutionSpecs[0].artifactId,
        artifact_kind: roleExecutionSpecs[0].artifactKind,
        role: roleExecutionSpecs[0].role,
        signer: await loadNodeAuthority(roleExecutionSpecs[0].authorityPath, { create: false }),
        source_commit: "b".repeat(40)
      }),
      (error) => error?.code === "E_CONTINUITY_EQUIVOCATION"
    );
    const dirtyMarkerPath = join(sourceCheckoutPath, "untracked-marker.txt");
    await writeFile(dirtyMarkerPath, "dirty\n");
    const dirtyRoleExecution = await runNode(attestRoleExecutionRunner, [
      "--authority", roleExecutionSpecs[0].authorityPath,
      "--artifact", roleExecutionSpecs[0].artifactPath,
      "--artifact-id", roleExecutionSpecs[0].artifactId,
      "--artifact-kind", roleExecutionSpecs[0].artifactKind,
      "--role", roleExecutionSpecs[0].role,
      "--source-commit", sourceCommit,
      "--repo-root", sourceCheckoutPath,
      "--output", roleExecutionReceiptDirtyPath
    ], {});
    assert.notEqual(dirtyRoleExecution.code, 0);
    assert.match(dirtyRoleExecution.stderr, /checkout-not-clean/u);
    assert.equal(await absent(roleExecutionReceiptDirtyPath), true);
    await rm(dirtyMarkerPath);
    const wrongHeadRoleExecution = await runNode(attestRoleExecutionRunner, [
      "--authority", roleExecutionSpecs[0].authorityPath,
      "--artifact", roleExecutionSpecs[0].artifactPath,
      "--artifact-id", roleExecutionSpecs[0].artifactId,
      "--artifact-kind", roleExecutionSpecs[0].artifactKind,
      "--role", roleExecutionSpecs[0].role,
      "--source-commit", "b".repeat(40),
      "--repo-root", sourceCheckoutPath,
      "--output", roleExecutionReceiptDirtyPath
    ], {});
    assert.notEqual(wrongHeadRoleExecution.code, 0);
    assert.match(wrongHeadRoleExecution.stderr, /source-commit-head-mismatch/u);
    assert.equal(await absent(roleExecutionReceiptDirtyPath), true);

    const directPilotSourceAttestation = createPlacementAdmissionPilotSourceAttestation({
      capsule_bytes: loadedPilotIndex.capsule_bytes,
      ceremony_records: loadedPilotIndex.ceremony_records,
      deployment: loadedPilotIndex.deployment,
      epoch_records: loadedPilotIndex.epoch_records,
      execution_receipt_bytes: roleExecutionReceiptBytes,
      pilot_evidence_bytes: pilotEvidenceBytes,
      source_commit: sourceCommit
    });
    assert.equal(directPilotSourceAttestation.attested_artifact_count, 12);
    assert.equal(directPilotSourceAttestation.role_key_count, 7);
    assert.equal(
      directPilotSourceAttestation.source_commit_execution_binding,
      "role-key-attested-artifacts"
    );
    assert.equal(directPilotSourceAttestation.unsigned_coordinator_execution_binding, "unproven");
    const sourceAttestationArgs = [
      "--index", pilotIndexPath,
      "--pilot-evidence", pilotEvidencePath,
      "--expected-source-commit", sourceCommit
    ];
    for (const receiptPath of roleExecutionReceiptPaths) {
      sourceAttestationArgs.push("--execution-receipt", receiptPath);
    }
    const createdPilotSourceAttestation = await runNode(
      createPilotSourceAttestationRunner,
      [...sourceAttestationArgs, "--output", pilotSourceAttestationPath],
      {}
    );
    assert.equal(createdPilotSourceAttestation.code, 0, createdPilotSourceAttestation.stderr);
    const createdPilotSourceStatus = JSON.parse(createdPilotSourceAttestation.stdout);
    assert.equal(createdPilotSourceStatus.attested_artifact_count, 12);
    assert.equal(createdPilotSourceStatus.receipts_verified, true);
    assert.equal(createdPilotSourceStatus.role_key_count, 7);
    assert.equal(createdPilotSourceStatus.source_commit, sourceCommit);
    assert.equal(
      createdPilotSourceStatus.source_commit_execution_binding,
      "role-key-attested-artifacts"
    );
    assert.equal(createdPilotSourceStatus.topology_authority, "unproven");
    assert.equal(createdPilotSourceStatus.unsigned_coordinator_execution_binding, "unproven");
    const pilotSourceAttestationBytes = new Uint8Array(
      await readFile(pilotSourceAttestationPath)
    );
    assert.deepEqual(pilotSourceAttestationBytes, directPilotSourceAttestation.bytes);
    const restoredPilotSourceAttestation = restorePlacementAdmissionPilotSourceAttestation(
      pilotSourceAttestationBytes
    );
    assert.equal(restoredPilotSourceAttestation.receipts_verified, false);
    assert.equal(restoredPilotSourceAttestation.attested_artifact_count, 12);
    assert.doesNotMatch(
      new TextDecoder().decode(pilotSourceAttestationBytes),
      /private|pkcs8|secret|bearer|token|BEGIN PRIVATE KEY/iu
    );
    assert.deepEqual(
      verifyPlacementAdmissionPilotSourceAttestation({
        capsule_bytes: loadedPilotIndex.capsule_bytes,
        ceremony_records: loadedPilotIndex.ceremony_records,
        deployment: loadedPilotIndex.deployment,
        epoch_records: loadedPilotIndex.epoch_records,
        execution_receipt_bytes: roleExecutionReceiptBytes,
        pilot_evidence_bytes: pilotEvidenceBytes,
        source_attestation_bytes: pilotSourceAttestationBytes,
        source_commit: sourceCommit
      }).bytes,
      pilotSourceAttestationBytes
    );
    const verifiedPilotSourceAttestation = await runNode(
      verifyPilotSourceAttestationRunner,
      [
        "--attestation", pilotSourceAttestationPath,
        ...sourceAttestationArgs
      ],
      {}
    );
    assert.equal(verifiedPilotSourceAttestation.code, 0, verifiedPilotSourceAttestation.stderr);
    assert.deepEqual(JSON.parse(verifiedPilotSourceAttestation.stdout), {
      attestation_id: createdPilotSourceStatus.attestation_id,
      attested_artifact_count: 12,
      non_authority: true,
      pilot_evidence_id: createdPilotStatus.evidence_id,
      receipts_verified: true,
      role_key_count: 7,
      source_commit: sourceCommit,
      source_commit_execution_binding: "role-key-attested-artifacts",
      status: "placement-admission-pilot-source-attestation-verified",
      topology_authority: "unproven",
      unsigned_coordinator_execution_binding: "unproven"
    });
    const reversedReceiptArgs = [
      "--index", pilotIndexPath,
      "--pilot-evidence", pilotEvidencePath,
      "--expected-source-commit", sourceCommit
    ];
    for (const receiptPath of [...roleExecutionReceiptPaths].reverse()) {
      reversedReceiptArgs.push("--execution-receipt", receiptPath);
    }
    const reversedPilotSourceAttestation = await runNode(
      createPilotSourceAttestationRunner,
      [...reversedReceiptArgs, "--output", pilotSourceAttestationRetryPath],
      {}
    );
    assert.equal(
      reversedPilotSourceAttestation.code,
      0,
      reversedPilotSourceAttestation.stderr
    );
    assert.deepEqual(
      new Uint8Array(await readFile(pilotSourceAttestationRetryPath)),
      pilotSourceAttestationBytes
    );
    const missingPilotSourceAttestation = await runNode(
      createPilotSourceAttestationRunner,
      [
        "--index", pilotIndexPath,
        "--pilot-evidence", pilotEvidencePath,
        "--expected-source-commit", sourceCommit,
        ...sourceAttestationArgs.slice(6, -2),
        "--output", pilotSourceAttestationMissingPath
      ],
      {}
    );
    assert.notEqual(missingPilotSourceAttestation.code, 0);
    assert.match(missingPilotSourceAttestation.stderr, /incomplete-role-execution-receipts/u);
    assert.equal(await absent(pilotSourceAttestationMissingPath), true);

    const sourceVerdictArgs = [
      ...sourceAttestationArgs,
      "--pilot-source-attestation", pilotSourceAttestationPath
    ];
    const createdPilotSourceVerdict = await runNode(
      createPilotSourceVerdictRunner,
      [...sourceVerdictArgs, "--output", pilotSourceVerdictPath],
      {}
    );
    assert.equal(createdPilotSourceVerdict.code, 0, createdPilotSourceVerdict.stderr);
    const createdPilotSourceVerdictStatus = JSON.parse(createdPilotSourceVerdict.stdout);
    assert.equal(createdPilotSourceVerdictStatus.authenticated_input_artifact_count, 1);
    assert.equal(createdPilotSourceVerdictStatus.coordinator_execution_binding, "unproven");
    assert.equal(
      createdPilotSourceVerdictStatus.coordinator_protocol_authority,
      "not-required-for-verification"
    );
    assert.equal(createdPilotSourceVerdictStatus.deterministically_replayed_artifact_count, 9);
    assert.equal(createdPilotSourceVerdictStatus.evidence_artifact_count, 34);
    assert.equal(createdPilotSourceVerdictStatus.participant_endorsed_artifact_count, 12);
    assert.equal(createdPilotSourceVerdictStatus.participant_receipts_verified, true);
    assert.equal(createdPilotSourceVerdictStatus.participant_source_artifact_count, 12);
    assert.equal(createdPilotSourceVerdictStatus.public_chain_verified, true);
    assert.equal(createdPilotSourceVerdictStatus.role_key_count, 7);
    assert.equal(createdPilotSourceVerdictStatus.source_commit, sourceCommit);
    assert.equal(
      createdPilotSourceVerdictStatus.source_commit_execution_binding,
      "role-key-attested-artifacts"
    );
    assert.equal(createdPilotSourceVerdictStatus.topology_authority, "unproven");
    assert.equal(createdPilotSourceVerdictStatus.unsigned_protocol_artifact_count, 21);
    assert.equal(createdPilotSourceVerdictStatus.unsigned_protocol_artifacts_verified, true);
    const pilotSourceVerdictBytes = new Uint8Array(await readFile(pilotSourceVerdictPath));
    const restoredPilotSourceVerdict = restorePlacementAdmissionPilotSourceVerdict(
      pilotSourceVerdictBytes
    );
    assert.equal(restoredPilotSourceVerdict.participant_receipts_verified, false);
    assert.equal(restoredPilotSourceVerdict.public_chain_verified, false);
    assert.equal(restoredPilotSourceVerdict.unsigned_protocol_artifacts_verified, false);
    assert.equal(restoredPilotSourceVerdict.evidence_artifact_count, 34);
    assert.doesNotMatch(
      new TextDecoder().decode(pilotSourceVerdictBytes),
      /private|pkcs8|secret|bearer|token|BEGIN PRIVATE KEY/iu
    );
    const verifiedPilotSourceVerdict = await runNode(
      verifyPilotSourceVerdictRunner,
      ["--verdict", pilotSourceVerdictPath, ...sourceVerdictArgs],
      {}
    );
    assert.equal(verifiedPilotSourceVerdict.code, 0, verifiedPilotSourceVerdict.stderr);
    assert.deepEqual(JSON.parse(verifiedPilotSourceVerdict.stdout), {
      authenticated_input_artifact_count: 1,
      coordinator_execution_binding: "unproven",
      coordinator_protocol_authority: "not-required-for-verification",
      deterministically_replayed_artifact_count: 9,
      evidence_artifact_count: 34,
      non_authority: true,
      participant_endorsed_artifact_count: 12,
      participant_receipts_verified: true,
      participant_source_artifact_count: 12,
      pilot_evidence_id: createdPilotStatus.evidence_id,
      public_chain_verified: true,
      role_key_count: 7,
      source_commit: sourceCommit,
      source_commit_execution_binding: "role-key-attested-artifacts",
      status: "placement-admission-pilot-source-verdict-verified",
      topology_authority: "unproven",
      unsigned_protocol_artifact_count: 21,
      unsigned_protocol_artifacts_verified: true,
      verdict_id: createdPilotSourceVerdictStatus.verdict_id
    });

    const participantAuthorityPaths = [];
    const participantKeyIds = new Set();
    for (const spec of roleExecutionSpecs) {
      const signer = await loadNodeAuthority(spec.authorityPath, { create: false });
      if (!participantKeyIds.has(signer.custodian.key_id)) {
        participantKeyIds.add(signer.custodian.key_id);
        participantAuthorityPaths.push(spec.authorityPath);
      }
    }
    assert.equal(participantAuthorityPaths.length, 7);
    const inventoryRatificationPaths = [];
    const inventoryRatificationBytes = [];
    for (let index = 0; index < participantAuthorityPaths.length; index += 1) {
      const signer = await loadNodeAuthority(participantAuthorityPaths[index], {
        create: false
      });
      const ratification = await createPlacementAdmissionPilotInventoryRatification({
        deployment_plan_id: plan.plan_id,
        signer,
        source_verdict_bytes: pilotSourceVerdictBytes
      });
      const outputPath = join(directory, `pilot-inventory-ratification-${index}.json`);
      await writeFile(outputPath, ratification.bytes);
      const restored = restorePlacementAdmissionPilotInventoryRatification(
        ratification.bytes
      );
      assert.equal(restored.deployment_plan_id, plan.plan_id);
      assert.equal(restored.inventory_statement, "complete-for-deployment-plan");
      assert.equal(restored.signature_verified, true);
      assert.equal(restored.source_verdict_id, createdPilotSourceVerdictStatus.verdict_id);
      inventoryRatificationPaths.push(outputPath);
      inventoryRatificationBytes.push(ratification.bytes);
    }
    const ratificationRetry = await runNode(ratifyPilotSourceVerdictRunner, [
      "--authority", participantAuthorityPaths[0],
      "--deployment-plan", planPath,
      "--source-verdict", pilotSourceVerdictPath,
      "--output", pilotInventoryRatificationRetryPath
    ], {});
    assert.equal(ratificationRetry.code, 0, ratificationRetry.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(pilotInventoryRatificationRetryPath)),
      inventoryRatificationBytes[0]
    );
    const conflictingVerdictContent = parseJsonBytes(pilotSourceVerdictBytes);
    delete conflictingVerdictContent.verdict_id;
    conflictingVerdictContent.source_commit = "b".repeat(40);
    const conflictingVerdictId = domainHash(
      PILOT_SOURCE_VERDICT_DOMAIN,
      canonicalBytes(conflictingVerdictContent)
    );
    const conflictingVerdictBytes = canonicalBytes({
      verdict_id: conflictingVerdictId,
      ...conflictingVerdictContent
    });
    assert.equal(
      restorePlacementAdmissionPilotSourceVerdict(conflictingVerdictBytes).source_commit,
      "b".repeat(40)
    );
    await assert.rejects(
      createPlacementAdmissionPilotInventoryRatification({
        deployment_plan_id: plan.plan_id,
        signer: await loadNodeAuthority(participantAuthorityPaths[0], { create: false }),
        source_verdict_bytes: conflictingVerdictBytes
      }),
      (error) => error?.code === "E_CONTINUITY_EQUIVOCATION"
    );

    const inventoryClosureBaseArgs = [
      "--index", pilotIndexPath,
      "--pilot-evidence", pilotEvidencePath,
      "--pilot-source-attestation", pilotSourceAttestationPath,
      "--pilot-source-verdict", pilotSourceVerdictPath,
      "--expected-source-commit", sourceCommit
    ];
    for (const receiptPath of roleExecutionReceiptPaths) {
      inventoryClosureBaseArgs.push("--execution-receipt", receiptPath);
    }
    const inventoryClosureArgs = [...inventoryClosureBaseArgs];
    for (const ratificationPath of [...inventoryRatificationPaths].reverse()) {
      inventoryClosureArgs.push("--ratification", ratificationPath);
    }
    const createdPilotInventoryClosure = await runNode(
      createPilotInventoryClosureRunner,
      [...inventoryClosureArgs, "--output", pilotInventoryClosurePath],
      {}
    );
    assert.equal(
      createdPilotInventoryClosure.code,
      0,
      createdPilotInventoryClosure.stderr
    );
    const createdPilotInventoryClosureStatus = JSON.parse(
      createdPilotInventoryClosure.stdout
    );
    assert.equal(
      createdPilotInventoryClosureStatus.competing_verdict_policy,
      "durable-sign-once-per-deployment-plan-and-role-key"
    );
    assert.equal(
      createdPilotInventoryClosureStatus.coordinator_protocol_authority,
      "not-required-for-inventory-closure"
    );
    assert.equal(createdPilotInventoryClosureStatus.deployment_plan_id, plan.plan_id);
    assert.equal(createdPilotInventoryClosureStatus.evidence_artifact_count, 34);
    assert.equal(
      createdPilotInventoryClosureStatus.inventory_closure,
      "all-role-keys-ratified"
    );
    assert.equal(createdPilotInventoryClosureStatus.participant_count, 7);
    assert.equal(createdPilotInventoryClosureStatus.ratifications_verified, true);
    assert.equal(createdPilotInventoryClosureStatus.source_verdict_verified, true);
    const pilotInventoryClosureBytes = new Uint8Array(
      await readFile(pilotInventoryClosurePath)
    );
    const restoredPilotInventoryClosure = restorePlacementAdmissionPilotInventoryClosure(
      pilotInventoryClosureBytes
    );
    assert.equal(restoredPilotInventoryClosure.participant_count, 7);
    assert.equal(restoredPilotInventoryClosure.ratifications_verified, false);
    assert.equal(restoredPilotInventoryClosure.source_verdict_verified, false);
    assert.doesNotMatch(
      new TextDecoder().decode(pilotInventoryClosureBytes),
      /private|pkcs8|secret|bearer|token|BEGIN PRIVATE KEY/iu
    );
    const verifiedPilotInventoryClosure = await runNode(
      verifyPilotInventoryClosureRunner,
      ["--closure", pilotInventoryClosurePath, ...inventoryClosureArgs],
      {}
    );
    assert.equal(
      verifiedPilotInventoryClosure.code,
      0,
      verifiedPilotInventoryClosure.stderr
    );
    assert.deepEqual(JSON.parse(verifiedPilotInventoryClosure.stdout), {
      closure_id: createdPilotInventoryClosureStatus.closure_id,
      competing_verdict_policy: "durable-sign-once-per-deployment-plan-and-role-key",
      coordinator_protocol_authority: "not-required-for-inventory-closure",
      deployment_plan_id: plan.plan_id,
      evidence_artifact_count: 34,
      inventory_closure: "all-role-keys-ratified",
      non_authority: true,
      participant_count: 7,
      pilot_evidence_id: createdPilotStatus.evidence_id,
      ratifications_verified: true,
      source_commit: sourceCommit,
      source_verdict_id: createdPilotSourceVerdictStatus.verdict_id,
      source_verdict_verified: true,
      status: "placement-admission-pilot-inventory-closure-verified",
      topology_authority: "unproven"
    });
    const missingInventoryClosureArgs = [...inventoryClosureBaseArgs];
    for (const ratificationPath of inventoryRatificationPaths.slice(1)) {
      missingInventoryClosureArgs.push("--ratification", ratificationPath);
    }
    const missingPilotInventoryClosure = await runNode(
      createPilotInventoryClosureRunner,
      [
        ...missingInventoryClosureArgs,
        "--output", pilotInventoryClosureMissingPath
      ],
      {}
    );
    assert.notEqual(missingPilotInventoryClosure.code, 0);
    assert.match(missingPilotInventoryClosure.stderr, /ratification-count/u);
    assert.equal(await absent(pilotInventoryClosureMissingPath), true);

    const reversedPilotIndex = structuredClone(pilotIndex);
    reversedPilotIndex.ceremonies.reverse();
    reversedPilotIndex.deployment.acceptances.reverse();
    reversedPilotIndex.deployment.attestations.reverse();
    for (const epoch of reversedPilotIndex.epochs) epoch.ceremony_bundles.reverse();
    await writeFile(pilotReversedIndexPath, canonicalBytes(reversedPilotIndex));
    const reversedPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotReversedIndexPath,
      "--output", pilotEvidenceRetryPath
    ]);
    assert.equal(reversedPilotEvidence.code, 0, reversedPilotEvidence.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(pilotEvidenceRetryPath)),
      pilotEvidenceBytes
    );

    const omittedPilotIndex = structuredClone(pilotIndex);
    omittedPilotIndex.epochs.shift();
    await writeFile(pilotOmittedIndexPath, canonicalBytes(omittedPilotIndex));
    const omittedPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotOmittedIndexPath,
      "--output", pilotEvidenceOmittedPath
    ]);
    assert.notEqual(omittedPilotEvidence.code, 0);
    assert.match(omittedPilotEvidence.stderr, /E_PLACEMENT_/u);
    assert.equal(await absent(pilotEvidenceOmittedPath), true);

    const escapedPilotIndex = structuredClone(pilotIndex);
    escapedPilotIndex.capsule = "../capsule.json";
    await writeFile(pilotEscapedIndexPath, canonicalBytes(escapedPilotIndex));
    const escapedPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotEscapedIndexPath,
      "--output", pilotEvidenceEscapedPath
    ]);
    assert.notEqual(escapedPilotEvidence.code, 0);
    assert.match(escapedPilotEvidence.stderr, /E_PLACEMENT_ADMISSION_PILOT_INDEX_PATH/u);
    assert.equal(await absent(pilotEvidenceEscapedPath), true);

    const ceremonySwapPilotIndex = structuredClone(pilotIndex);
    ceremonySwapPilotIndex.ceremonies[1].issuer_response =
      ceremonySwapPilotIndex.ceremonies[2].issuer_response;
    await writeFile(pilotCeremonySwapIndexPath, canonicalBytes(ceremonySwapPilotIndex));
    const ceremonySwapPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotCeremonySwapIndexPath,
      "--output", pilotEvidenceCeremonySwapPath
    ]);
    assert.notEqual(ceremonySwapPilotEvidence.code, 0);
    assert.match(ceremonySwapPilotEvidence.stderr, /finalization-identity/u);
    assert.equal(await absent(pilotEvidenceCeremonySwapPath), true);

    const wrongCommitPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", "b".repeat(40),
      "--index", pilotIndexPath,
      "--output", pilotEvidenceWrongCommitPath
    ]);
    assert.notEqual(wrongCommitPilotEvidence.code, 0);
    assert.match(wrongCommitPilotEvidence.stderr, /source-commit/u);
    assert.equal(await absent(pilotEvidenceWrongCommitPath), true);

    const tamperedPilotDocument = parseJsonBytes(pilotEvidenceBytes);
    tamperedPilotDocument.epochs[0].request_artifact_digest = digest(
      "MortalOS placement admission pilot substituted request",
      { substituted: true }
    );
    const tamperedPilotBasis = { ...tamperedPilotDocument };
    delete tamperedPilotBasis.evidence_id;
    tamperedPilotDocument.evidence_id = domainHash(
      PILOT_EVIDENCE_DOMAIN,
      canonicalBytes(tamperedPilotBasis)
    );
    const tamperedPilotBytes = canonicalBytes(tamperedPilotDocument);
    assert.equal(
      restorePlacementAdmissionPilotEvidence(tamperedPilotBytes).public_chain_verified,
      false
    );
    await writeFile(pilotEvidenceTamperedPath, tamperedPilotBytes);
    const tamperedPilotVerification = await runNode(verifyPilotEvidenceRunner, [
      "--evidence", pilotEvidenceTamperedPath,
      "--expected-source-commit", sourceCommit,
      "--index", pilotIndexPath
    ]);
    assert.notEqual(tamperedPilotVerification.code, 0);
    assert.match(tamperedPilotVerification.stderr, /pilot-evidence-sidecars/u);

    const existingPilotEvidence = await runNode(createPilotEvidenceRunner, [
      "--expected-source-commit", sourceCommit,
      "--index", pilotEscapedIndexPath,
      "--output", pilotEvidencePath
    ]);
    assert.notEqual(existingPilotEvidence.code, 0);
    assert.match(
      existingPilotEvidence.stderr,
      /E_PLACEMENT_ADMISSION_PILOT_CLI_OUTPUT_EXISTS/u
    );
    const existingAttestationView = await runNode(createDeploymentAttestationViewRunner, [
      "--attestation", attestation1Path,
      "--attestation", attestation2Path,
      "--output", attestationViewPath
    ]);
    assert.notEqual(existingAttestationView.code, 0);
    assert.match(
      existingAttestationView.stderr,
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u
    );
    const substitutedAttestationViewDocument = parseJsonBytes(attestationView.bytes);
    substitutedAttestationViewDocument.attestation_ids.reverse();
    const substitutedAttestationViewBasis = { ...substitutedAttestationViewDocument };
    delete substitutedAttestationViewBasis.view_id;
    substitutedAttestationViewDocument.view_id = domainHash(
      DEPLOYMENT_ATTESTATION_VIEW_DOMAIN,
      canonicalBytes(substitutedAttestationViewBasis)
    );
    const substitutedAttestationViewBytes = canonicalBytes(
      substitutedAttestationViewDocument
    );
    assert.equal(
      restorePlacementAdmissionDeploymentAttestationView(
        substitutedAttestationViewBytes
      ).attestations_verified,
      false
    );
    assert.throws(
      () => verifyPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes, attestation2.bytes],
        view_bytes: substitutedAttestationViewBytes
      }),
      /deployment-attestation-view-sidecars/u
    );
    assert.throws(
      () => verifyPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes],
        view_bytes: attestationView.bytes
      }),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT/u
    );
    assert.throws(
      () => verifyPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes, attestation2.bytes, attestation2.bytes],
        view_bytes: attestationView.bytes
      }),
      /duplicate-deployment-observer/u
    );
    assert.throws(
      () => evaluatePlacementAdmissionDeploymentAttestations({
        attestation_bytes: [attestation1.bytes]
      }),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentAttestationView({
        attestation_bytes: [attestation1.bytes]
      }),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT/u
    );

    const exactAttestationRetry = await attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
      observation_bytes: attestedObservation1.bytes,
      observer: observerAuthority1
    });
    assert.deepEqual(exactAttestationRetry.bytes, attestation1.bytes);
    await assert.rejects(
      () => attestPlacementAdmissionDeploymentObservation({
        attested_at_ms: 2201,
        capsule_bytes: continuity.capsule_bytes,
        deployment_plan_membership_bytes: deploymentMembership.bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
        observation_bytes: attestedObservation1.bytes,
        observer: observerAuthority1
      }),
      (error) => {
        assert.equal(error.code, "E_CONTINUITY_EQUIVOCATION");
        return true;
      }
    );

    const membershipEpoch3 = await createMembershipEpochViaCli({
      approvalPath: membershipApproval3Path,
      bundlePaths: membershipBundlePaths,
      capsulePath,
      continuityAuthorityPath,
      epochPath: membershipEpoch3Path,
      priorEpochPath: membershipEpoch2Path,
      requestPath: membershipRequest3Path
    });
    const membershipEpoch3Bytes = membershipEpoch3.bytes;
    const rotatedDeploymentMembership = createPlacementAdmissionDeploymentPlanMembership({
      activation_bytes: activation.bytes,
      capsule_bytes: continuity.capsule_bytes,
      ceremony_bundle_bytes: bundle.bytes,
      membership_epoch_candidate_bytes: [
        membershipEpoch3Bytes,
        membershipEpochBytes,
        membershipEpoch2Bytes
      ]
    });
    assert.equal(
      rotatedDeploymentMembership.membership_epoch_id,
      membershipEpoch3.epoch_id
    );
    assert.notEqual(
      rotatedDeploymentMembership.membership_candidate_view_id,
      deploymentMembership.membership_candidate_view_id
    );
    await assert.rejects(
      () => attestPlacementAdmissionDeploymentObservation({
        attested_at_ms: 2200,
        capsule_bytes: continuity.capsule_bytes,
        deployment_plan_membership_bytes: rotatedDeploymentMembership.bytes,
        membership_epoch_candidate_bytes: [
          membershipEpochBytes,
          membershipEpoch2Bytes,
          membershipEpoch3Bytes
        ],
        observation_bytes: attestedObservation1.bytes,
        observer: observerAuthority1
      }),
      (error) => {
        assert.equal(error.code, "E_CONTINUITY_EQUIVOCATION");
        assert.match(error.message, /placement\.admission\.deployment\.attestation/u);
        return true;
      }
    );
    const retryAfterRotatedViewConflict = await attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: [membershipEpoch2Bytes, membershipEpochBytes],
      observation_bytes: attestedObservation1.bytes,
      observer: observerAuthority1
    });
    assert.deepEqual(retryAfterRotatedViewConflict.bytes, attestation1.bytes);

    const tampered = parseJsonBytes(attestation1.bytes);
    tampered.declared_vantage_id = vantage3;
    const tamperedBasis = { ...tampered };
    delete tamperedBasis.attestation_id;
    delete tamperedBasis.signature;
    tampered.attestation_id = domainHash(
      DEPLOYMENT_ATTESTATION_DOMAIN,
      canonicalBytes(tamperedBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentAttestation(canonicalBytes(tampered)),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_(?:BINDING|IDENTITY)/u
    );
    const keySwap = parseJsonBytes(attestation1.bytes);
    keySwap.observer = attestation2.observer;
    const keySwapBasis = { ...keySwap };
    delete keySwapBasis.attestation_id;
    delete keySwapBasis.signature;
    keySwap.attestation_id = domainHash(
      DEPLOYMENT_ATTESTATION_DOMAIN,
      canonicalBytes(keySwapBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentAttestation(canonicalBytes(keySwap)),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_(?:BINDING|IDENTITY)/u
    );
    const planSwap = parseJsonBytes(attestation1.bytes);
    planSwap.deployment_plan_activation_id = substitutedPlan.plan_id;
    const planSwapBasis = { ...planSwap };
    delete planSwapBasis.attestation_id;
    delete planSwapBasis.signature;
    planSwap.attestation_id = domainHash(
      DEPLOYMENT_ATTESTATION_DOMAIN,
      canonicalBytes(planSwapBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentAttestation(canonicalBytes(planSwap)),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_(?:BINDING|IDENTITY)/u
    );

    assert.throws(
      () => createPlacementAdmissionDeploymentPlan(planOptions([
        observerAssignments[0],
        { ...observerAssignments[1], observer: observerIdentity1 }
      ])),
      /duplicate-deployment-plan-observer/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlan(planOptions([
        observerAssignments[0],
        { ...observerAssignments[1], declared_vantage_id: vantage1 }
      ])),
      /duplicate-deployment-plan-vantage/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlan(planOptions([
        observerAssignments[0],
        { ...observerAssignments[1], observer_nonce: new Uint8Array(32).fill(113) }
      ])),
      /duplicate-deployment-plan-nonce/u
    );
    const reversedPlanDocument = parseJsonBytes(plan.bytes);
    reversedPlanDocument.observers.reverse();
    const reversedPlanBasis = { ...reversedPlanDocument };
    delete reversedPlanBasis.plan_id;
    reversedPlanDocument.plan_id = domainHash(
      DEPLOYMENT_PLAN_DOMAIN,
      canonicalBytes(reversedPlanBasis)
    );
    assert.throws(
      () => restorePlacementAdmissionDeploymentPlan(canonicalBytes(reversedPlanDocument)),
      /deployment-plan-observer-order/u
    );
    const sparseObservers = new Array(2);
    sparseObservers[0] = observerAssignments[0];
    assert.throws(
      () => createPlacementAdmissionDeploymentPlan(planOptions(sparseObservers)),
      /deployment-plan-observers/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlan(planOptions(
        new Array(9).fill(observerAssignments[0])
      )),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT/u
    );
    assert.throws(
      () => createPlacementAdmissionDeploymentPlan({
        ...planOptions(observerAssignments),
        expires_at_ms: 7099
      }),
      /deployment-plan-window/u
    );
    const outsideWindow = await runNode(attesterRunner, [
      "--attested-at-ms", "8001",
      "--authority", observerAuthority1Path,
      "--capsule", capsulePath,
      "--deployment-plan-membership", deploymentMembershipPath,
      "--membership-epoch", membershipEpochPath,
      "--membership-epoch", membershipEpoch2Path,
      "--observed-at-ms", "8001",
      "--observation-journal", outsideWindowObservationJournalPath,
      "--output", outsideWindowPath
    ], proofEnvironment);
    assert.notEqual(outsideWindow.code, 0);
    assert.match(outsideWindow.stderr, /deployment-plan-window/u);
    assert.equal(await absent(outsideWindowPath), true);
    assert.equal(await absent(outsideWindowObservationJournalPath), true);

    await assert.rejects(
      () => attestPlacementAdmissionDeploymentObservation({
        attested_at_ms: 2201,
        capsule_bytes: continuity.capsule_bytes,
        deployment_plan_membership_bytes: deploymentMembership.bytes,
        membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
        observation_bytes: attestedObservation1.bytes,
        observer: observerAuthority2
      }),
      /deployment-plan-observation/u
    );

    const localAuthority = observerAuthority1;
    const mutableCapsule = new Uint8Array(continuity.capsule_bytes);
    const capsuleMutationPromise = attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: mutableCapsule,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
      observation_bytes: attestedObservation1.bytes,
      observer: localAuthority
    });
    mutableCapsule[0] ^= 0xff;
    const capsuleMutationOwned = await capsuleMutationPromise;
    assert.equal(
      restorePlacementAdmissionDeploymentAttestation(capsuleMutationOwned.bytes)
        .deployment_plan_membership_id,
      deploymentMembership.membership_id
    );
    const mutableMembership = new Uint8Array(deploymentMembership.bytes);
    const membershipMutationPromise = attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: mutableMembership,
      membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
      observation_bytes: attestedObservation1.bytes,
      observer: localAuthority
    });
    mutableMembership[0] ^= 0xff;
    const membershipMutationOwned = await membershipMutationPromise;
    assert.equal(
      restorePlacementAdmissionDeploymentAttestation(membershipMutationOwned.bytes)
        .deployment_plan_membership_id,
      deploymentMembership.membership_id
    );
    const mutableMembershipCandidates = [
      new Uint8Array(membershipEpochBytes),
      new Uint8Array(membershipEpoch2Bytes)
    ];
    const candidateMutationPromise = attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: mutableMembershipCandidates,
      observation_bytes: attestedObservation1.bytes,
      observer: localAuthority
    });
    mutableMembershipCandidates[0][0] ^= 0xff;
    mutableMembershipCandidates[1][0] ^= 0xff;
    const candidateMutationOwned = await candidateMutationPromise;
    assert.equal(
      restorePlacementAdmissionDeploymentAttestation(candidateMutationOwned.bytes)
        .membership_candidate_view_id,
      deploymentMembership.membership_candidate_view_id
    );
    const mutableObservation = new Uint8Array(attestedObservation1.bytes);
    const mutationPromise = attestPlacementAdmissionDeploymentObservation({
      attested_at_ms: 2200,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
      observation_bytes: mutableObservation,
      observer: localAuthority
    });
    mutableObservation[0] ^= 0xff;
    const mutationOwned = await mutationPromise;
    assert.equal(
      restorePlacementAdmissionDeploymentAttestation(mutationOwned.bytes).observation_id,
      attestedObservation1.observation_id
    );
    const accessorOptions = {
      attested_at_ms: 2202,
      capsule_bytes: continuity.capsule_bytes,
      deployment_plan_membership_bytes: deploymentMembership.bytes,
      membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
      observation_bytes: attestedObservation1.bytes
    };
    Object.defineProperty(accessorOptions, "observer", { get() { return localAuthority; } });
    await assert.rejects(
      () => attestPlacementAdmissionDeploymentObservation(accessorOptions),
      /ordinary-own-data/u
    );
    if (typeof SharedArrayBuffer === "function") {
      const shared = new Uint8Array(new SharedArrayBuffer(attestedObservation1.bytes.byteLength));
      shared.set(attestedObservation1.bytes);
      await assert.rejects(
        () => attestPlacementAdmissionDeploymentObservation({
          attested_at_ms: 2202,
          capsule_bytes: continuity.capsule_bytes,
          deployment_plan_membership_bytes: deploymentMembership.bytes,
          membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
          observation_bytes: shared,
          observer: localAuthority
        }),
        /shared-memory/u
      );
      const sharedCandidate = new Uint8Array(
        new SharedArrayBuffer(membershipEpochBytes.byteLength)
      );
      sharedCandidate.set(membershipEpochBytes);
      await assert.rejects(
        () => attestPlacementAdmissionDeploymentObservation({
          attested_at_ms: 2202,
          capsule_bytes: continuity.capsule_bytes,
          deployment_plan_membership_bytes: deploymentMembership.bytes,
          membership_epoch_candidate_bytes: [sharedCandidate, membershipEpoch2Bytes],
          observation_bytes: attestedObservation1.bytes,
          observer: localAuthority
        }),
        /shared-memory/u
      );
      const sharedMembership = new Uint8Array(
        new SharedArrayBuffer(deploymentMembership.bytes.byteLength)
      );
      sharedMembership.set(deploymentMembership.bytes);
      await assert.rejects(
        () => attestPlacementAdmissionDeploymentObservation({
          attested_at_ms: 2202,
          capsule_bytes: continuity.capsule_bytes,
          deployment_plan_membership_bytes: sharedMembership,
          membership_epoch_candidate_bytes: [membershipEpochBytes, membershipEpoch2Bytes],
          observation_bytes: attestedObservation1.bytes,
          observer: localAuthority
        }),
        /shared-memory/u
      );
    }
    const sparse = new Array(2);
    sparse[0] = attestation1.bytes;
    assert.throws(
      () => evaluatePlacementAdmissionDeploymentAttestations({ attestation_bytes: sparse }),
      /deployment-attestation-view-inputs/u
    );
    assert.throws(
      () => evaluatePlacementAdmissionDeploymentAttestations({
        attestation_bytes: new Array(9).fill(attestation1.bytes)
      }),
      /E_PLACEMENT_ADMISSION_DEPLOYMENT_LIMIT/u
    );
    const existingAttestation = await runNode(attesterRunner, attestationArguments({
      authority: observerAuthority1Path,
      observationJournal: attestation1ObservationJournalPath,
      observedAt: 2100,
      output: attestation1Path
    }), proofEnvironment);
    assert.notEqual(existingAttestation.code, 0);
    assert.match(existingAttestation.stderr, /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u);

    await Promise.all([
      issuer.stop(),
      subject.stop()
    ]);
    issuer = null;
    subject = null;
    const recoveredAttestation = await runNode(attesterRunner, attestationArguments({
      authority: observerAuthority1Path,
      observationJournal: attestation1ObservationJournalPath,
      observedAt: 2100,
      output: attestation1RecoveryPath
    }), {});
    assert.equal(recoveredAttestation.code, 0, recoveredAttestation.stderr);
    assert.equal(JSON.parse(recoveredAttestation.stdout).observation_source, "journal");
    assert.deepEqual(
      new Uint8Array(await readFile(attestation1RecoveryPath)),
      attestation1.bytes
    );
    const journalTimeConflict = await runNode(attesterRunner, attestationArguments({
      authority: observerAuthority1Path,
      observationJournal: attestation1ObservationJournalPath,
      observedAt: 2101,
      output: attestation1JournalConflictPath
    }), {});
    assert.notEqual(journalTimeConflict.code, 0);
    assert.match(journalTimeConflict.stderr, /observation-journal-time/u);
    assert.equal(await absent(attestation1JournalConflictPath), true);
    const existing = await runNode(observerRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2200",
      "--output", observationPath
    ], proofEnvironment);
    assert.notEqual(existing.code, 0);
    assert.match(existing.stderr, /E_PLACEMENT_ADMISSION_DEPLOYMENT_CLI_OUTPUT_EXISTS/u);
  } finally {
    await Promise.all([
      issuer?.stop(),
      subject?.stop()
    ]);
    await rm(directory, { force: true, recursive: true });
  }
});
