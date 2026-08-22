import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { createServer as createHttpsServer } from "node:https";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";
import { decodeBase64Url, encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { verifyPlacementAdmissionEvidence } from "../src/placement/admission.mjs";
import {
  createPlacementAdmissionCeremonyChallenge,
  restorePlacementAdmissionCeremonyBundle,
  runPlacementAdmissionHttpCeremony
} from "../lab/placement/admission-ceremony-client.mjs";
import {
  restorePlacementAdmissionDeploymentObservation
} from "../lab/placement/admission-deployment-observer.mjs";
import {
  PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS
} from "../lab/placement/admission-signer-http-service.mjs";
import {
  PLACEMENT_ADMISSION_SIGNER_LIMITS,
  createPlacementAdmissionSigningRequest,
  restorePlacementAdmissionSigningRequest
} from "../lab/placement/admission-signer-session.mjs";
import {
  createPlacementAdmissionSignerProfile,
  restorePlacementAdmissionSignerProfile
} from "../lab/placement/admission-signer-profile.mjs";

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
const profileChild = fileURLToPath(new URL(
  "./placement-admission-signer-profile-child.mjs",
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
const deploymentObserverRunner = fileURLToPath(new URL(
  "../scripts/observe-placement-admission-deployment.mjs",
  import.meta.url
));

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

function policy() {
  return {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS deployed signer test domain", { site: "loopback-a" }),
    operator_root_id: digest("MortalOS deployed signer test operator", { operator: "operator-a" }),
    roles: ["provider"]
  };
}

function rootConfig() {
  const organismDigest = digest("MortalOS deployed signer organism", { name: "service-test" });
  return {
    authority_id: digest("MortalOS deployed signer root", { purpose: "admission" }),
    lineage_organism_id: `mortalos:${organismDigest.slice("sha256:".length)}`,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS deployed signer scope", { purpose: "membership" }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
}

function evidenceBody(subject, configuredPolicy, challengeBytes) {
  return {
    attestation_challenge_base64url: encodeBase64Url(challengeBytes),
    attestation_kind: configuredPolicy.attestation_kind,
    failure_domain_id: configuredPolicy.failure_domain_id,
    issued_at_ms: "1500",
    operator_root_id: configuredPolicy.operator_root_id,
    roles: configuredPolicy.roles,
    subject,
    valid_from_ms: "1200",
    valid_until_ms: "8000"
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
    keyPath
  };
}

async function startPossessionReplayServer({ certificate, key, port, proofBytes }) {
  const server = createHttpsServer({ cert: certificate, key }, (request, response) => {
    request.resume();
    response.writeHead(200, {
      "content-length": proofBytes.byteLength,
      "content-type": "application/octet-stream"
    });
    response.end(proofBytes);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return Object.freeze({
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
}

async function startSigner({
  authorityPath,
  configPath,
  endpointOrigin,
  policyPath,
  port,
  possessionToken = null,
  role,
  tlsCertificatePath = null,
  tlsPrivateKeyPath = null,
  token
}) {
  const args = signerArguments({
    authorityPath,
    configPath,
    endpointOrigin,
    policyPath,
    port,
    role,
    tlsCertificatePath,
    tlsPrivateKeyPath
  });
  const env = { ...process.env, MORTALOS_ADMISSION_SIGNER_TOKEN: token };
  if (possessionToken !== null) {
    env.MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN = possessionToken;
  }
  const child = spawn(process.execPath, [signerRunner, ...args], {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  const ready = await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error(`${role} service readiness timeout`)), 15_000);
    const reject = (error) => {
      clearTimeout(timer);
      rejectReady(error);
    };
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`${role} service exited ${code}: ${stderr}`)));
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolveReady(JSON.parse(line));
    });
  });
  let stopped = false;
  return {
    child,
    ready,
    stderr: () => stderr,
    async stop() {
      if (stopped) return;
      stopped = true;
      const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
      child.kill("SIGTERM");
      await exited;
      lines.close();
    }
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
  const rootArgument = role === "issuer" ? "--root-config" : "--trust-root";
  const args = [
    "--authority", authorityPath,
    "--endpoint-origin", endpointOrigin,
    "--listen-host", "127.0.0.1",
    "--listen-port", String(port),
    "--policy", policyPath,
    "--profile-state", `${authorityPath}.profile.json`,
    "--role", role,
    rootArgument, configPath
  ];
  if (tlsCertificatePath !== null) args.push("--tls-certificate", tlsCertificatePath);
  if (tlsPrivateKeyPath !== null) args.push("--tls-private-key", tlsPrivateKeyPath);
  return args;
}

async function runSignerFailure(options) {
  const env = { ...process.env, MORTALOS_ADMISSION_SIGNER_TOKEN: options.token };
  if (options.possessionToken !== undefined && options.possessionToken !== null) {
    env.MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN = options.possessionToken;
  }
  const child = spawn(process.execPath, [signerRunner, ...signerArguments(options)], {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectExit(new Error("signer failure process did not fail closed"));
    }, 10_000);
    child.once("error", rejectExit);
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      resolveExit(exitCode);
    });
  });
  return { code, stderr, stdout };
}

async function runTool(script, args, label, env = {}) {
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
  const code = await new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectExit(new Error(`${label} did not finish`));
    }, 10_000);
    child.once("error", rejectExit);
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      resolveExit(exitCode);
    });
  });
  return { code, stderr, stdout };
}

async function post(url, token, bytes, contentType = "application/octet-stream") {
  return fetch(`${url}/sign-admission`, {
    body: bytes,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": contentType
    },
    method: "POST"
  });
}

async function runProfileChild(statePath, profilePath) {
  const child = spawn(process.execPath, [profileChild, statePath, profilePath], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", resolveExit);
  });
  return { code, stderr, stdout };
}

test("signer profile no-replace CAS gives conflicting origins one durable winner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-profile-race-"));
  try {
    const statePath = join(directory, "profile.json");
    const firstPath = join(directory, "first.json");
    const secondPath = join(directory, "second.json");
    const common = {
      identity_key_id: `peer:${"A".repeat(43)}`,
      policy_digest: `sha256:${"B".repeat(43)}`,
      role: "issuer",
      trust_root_id: `sha256:${"C".repeat(43)}`
    };
    const first = createPlacementAdmissionSignerProfile({
      ...common,
      endpoint_origin: "http://127.0.0.1:18001"
    });
    const second = createPlacementAdmissionSignerProfile({
      ...common,
      endpoint_origin: "http://127.0.0.1:18002"
    });
    await Promise.all([
      writeFile(firstPath, first.bytes),
      writeFile(secondPath, second.bytes)
    ]);
    const race = await Promise.all([
      runProfileChild(statePath, firstPath),
      runProfileChild(statePath, secondPath)
    ]);
    assert.deepEqual(race.map((entry) => entry.code).sort(), [0, 1]);
    const installed = restorePlacementAdmissionSignerProfile(new Uint8Array(await readFile(statePath)));
    const winnerPath = installed.profile_id === first.profile_id ? firstPath : secondPath;
    const loserPath = winnerPath === firstPath ? secondPath : firstPath;
    assert.equal((await runProfileChild(statePath, winnerPath)).code, 0);
    const loser = await runProfileChild(statePath, loserPath);
    assert.equal(loser.code, 1);
    assert.match(loser.stderr, /E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CONFLICT/u);
    assert.deepEqual(
      (await readdir(directory)).filter((name) => name.startsWith(".mortalos-pending-")),
      []
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("signer bootstrap publishes only canonical public inputs and never replaces outputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-issuer-prepare-"));
  try {
    const policyPath = join(directory, "policy.json");
    const rootConfigPath = join(directory, "root-config.json");
    const issuerAuthorityPath = join(directory, "issuer-authority.json");
    const trustRootPath = join(directory, "trust-root.json");
    const subjectAuthorityPath = join(directory, "subject-authority.json");
    const subjectIdentityPath = join(directory, "subject-identity.json");
    const requestPath = join(directory, "request.json");
    await writeFile(policyPath, canonicalBytes(policy()));
    await writeFile(rootConfigPath, canonicalBytes(rootConfig()));
    await writeFile(trustRootPath, canonicalBytes({ occupied: true }));
    const issuerArgs = [
      "--authority", issuerAuthorityPath,
      "--policy", policyPath,
      "--root-config", rootConfigPath,
      "--output", trustRootPath
    ];
    const blocked = await runTool(issuerPreparer, issuerArgs, "issuer preparation");
    assert.notEqual(blocked.code, 0);
    assert.equal(blocked.stdout, "");
    assert.match(blocked.stderr, /E_PLACEMENT_ADMISSION_SIGNER_CLI/u);
    await assert.rejects(access(issuerAuthorityPath), { code: "ENOENT" });
    await rm(trustRootPath);

    const prepared = await runTool(issuerPreparer, issuerArgs, "issuer preparation");
    assert.equal(prepared.code, 0, prepared.stderr);
    const status = JSON.parse(prepared.stdout);
    const trustRootBytes = new Uint8Array(await readFile(trustRootPath));
    const trustRoot = JSON.parse(new TextDecoder().decode(trustRootBytes));
    assert.equal(status.status, "placement-admission-issuer-trust-root-prepared");
    assert.equal(status.private_material_exposed, false);
    assert.equal(status.issuer_key_id, trustRoot.issuer.key_id);
    assert.equal(status.trust_root_id, trustRoot.trust_root_id);
    assert.equal(equalBytes(trustRootBytes, canonicalBytes(trustRoot)), true);
    assert.equal(new TextDecoder().decode(trustRootBytes).includes("private"), false);

    await writeFile(subjectIdentityPath, canonicalBytes({ occupied: true }));
    const subjectArgs = [
      "--authority", subjectAuthorityPath,
      "--output", subjectIdentityPath
    ];
    const blockedSubject = await runTool(subjectPreparer, subjectArgs, "subject preparation");
    assert.notEqual(blockedSubject.code, 0);
    assert.equal(blockedSubject.stdout, "");
    await assert.rejects(access(subjectAuthorityPath), { code: "ENOENT" });
    await rm(subjectIdentityPath);
    const preparedSubject = await runTool(subjectPreparer, subjectArgs, "subject preparation");
    assert.equal(preparedSubject.code, 0, preparedSubject.stderr);
    const subjectStatus = JSON.parse(preparedSubject.stdout);
    const subjectIdentityBytes = new Uint8Array(await readFile(subjectIdentityPath));
    const subjectIdentity = JSON.parse(new TextDecoder().decode(subjectIdentityBytes));
    assert.equal(subjectStatus.status, "placement-admission-subject-public-identity-prepared");
    assert.equal(subjectStatus.private_material_exposed, false);
    assert.equal(subjectStatus.subject_key_id, subjectIdentity.key_id);
    assert.equal(equalBytes(subjectIdentityBytes, canonicalBytes(subjectIdentity)), true);
    assert.equal(new TextDecoder().decode(subjectIdentityBytes).includes("private"), false);

    const requestArgs = [
      "--trust-root", trustRootPath,
      "--subject-identity", subjectIdentityPath,
      "--policy", policyPath,
      "--issuer-origin", "https://issuer.example.invalid",
      "--subject-origin", "https://subject.example.invalid",
      "--issued-at-ms", "1500",
      "--valid-from-ms", "1200",
      "--valid-until-ms", "8000",
      "--output", requestPath
    ];
    await writeFile(requestPath, canonicalBytes({ occupied: true }));
    const blockedRequest = await runTool(requestCreator, requestArgs, "request creation");
    assert.notEqual(blockedRequest.code, 0);
    assert.equal(blockedRequest.stdout, "");
    await rm(requestPath);
    const createdRequest = await runTool(requestCreator, requestArgs, "request creation");
    assert.equal(createdRequest.code, 0, createdRequest.stderr);
    const requestStatus = JSON.parse(createdRequest.stdout);
    const requestBytes = new Uint8Array(await readFile(requestPath));
    const request = restorePlacementAdmissionSigningRequest(requestBytes);
    assert.equal(requestStatus.status, "placement-admission-ceremony-request-created");
    assert.equal(requestStatus.private_material_required, false);
    assert.equal(requestStatus.nonce_generated_locally, true);
    assert.equal(requestStatus.evidence_id, request.evidence_id);
    assert.equal(requestStatus.issuer_key_id, trustRoot.issuer.key_id);
    assert.equal(requestStatus.subject_key_id, subjectIdentity.key_id);
    assert.equal(requestStatus.trust_root_id, trustRoot.trust_root_id);
    assert.equal(equalBytes(requestBytes, request.bytes), true);
    assert.deepEqual(
      (await readdir(directory)).filter((name) => name.startsWith(".mortalos-pending-")),
      []
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("operator-facing signers terminate native HTTPS under role-local TLS custody", {
  timeout: 90_000
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-native-tls-"));
  const issuerPort = await freePort();
  let subjectPort = await freePort();
  while (subjectPort === issuerPort) subjectPort = await freePort();
  const issuerOrigin = `https://127.0.0.1:${issuerPort}`;
  const subjectOrigin = `https://127.0.0.1:${subjectPort}`;
  const issuerToken = encodeBase64Url(randomBytes(32));
  const subjectToken = encodeBase64Url(randomBytes(32));
  const issuerPossessionToken = encodeBase64Url(randomBytes(32));
  const subjectPossessionToken = encodeBase64Url(randomBytes(32));
  const policyPath = join(directory, "policy.json");
  const rootConfigPath = join(directory, "root-config.json");
  const trustRootPath = join(directory, "trust-root.json");
  const issuerAuthorityPath = join(directory, "issuer-authority.json");
  const subjectAuthorityPath = join(directory, "subject-authority.json");
  const subjectIdentityPath = join(directory, "subject-identity.json");
  const requestPath = join(directory, "request.json");
  const issuerResponsePath = join(directory, "issuer-response.json");
  const subjectResponsePath = join(directory, "subject-response.json");
  const issuerResponseRetryPath = join(directory, "issuer-response-retry.json");
  const subjectResponseRetryPath = join(directory, "subject-response-retry.json");
  const bundlePath = join(directory, "bundle.json");
  const observationPath = join(directory, "observation.json");
  const legacyObservationPath = join(directory, "legacy-observation.json");
  const missingObserverAuthorizationPath = join(directory, "missing-observer-authorization.json");
  const sharedObserverAuthorizationPath = join(directory, "shared-observer-authorization.json");
  const replayObservationPath = join(directory, "replay-observation.json");
  const caBundlePath = join(directory, "ca-bundle.pem");
  const invalidHalfAuthorityPath = join(directory, "invalid-half-authority.json");
  const invalidPairAuthorityPath = join(directory, "invalid-pair-authority.json");
  const oversizedKeyPath = join(directory, "oversized-tls-key.pem");
  const oversizedKeyAuthorityPath = join(directory, "oversized-key-authority.json");
  const missingPossessionAuthorityPath = join(directory, "missing-possession-authority.json");
  const reusedPossessionAuthorityPath = join(directory, "reused-possession-authority.json");
  let issuer;
  let issuerReplay;
  let subject;
  let subjectReplay;
  try {
    const [issuerCertificate, subjectCertificate] = await Promise.all([
      generateCertificate(directory, "issuer-native-tls"),
      generateCertificate(directory, "subject-native-tls")
    ]);
    await Promise.all([
      writeFile(policyPath, canonicalBytes(policy())),
      writeFile(rootConfigPath, canonicalBytes(rootConfig())),
      writeFile(caBundlePath, Buffer.concat([
        issuerCertificate.certificate,
        Buffer.from("\n"),
        subjectCertificate.certificate
      ]))
    ]);
    const preparedIssuer = await runTool(issuerPreparer, [
      "--authority", issuerAuthorityPath,
      "--policy", policyPath,
      "--root-config", rootConfigPath,
      "--output", trustRootPath
    ], "native TLS issuer preparation");
    assert.equal(preparedIssuer.code, 0, preparedIssuer.stderr);
    const preparedSubject = await runTool(subjectPreparer, [
      "--authority", subjectAuthorityPath,
      "--output", subjectIdentityPath
    ], "native TLS subject preparation");
    assert.equal(preparedSubject.code, 0, preparedSubject.stderr);
    const createdRequest = await runTool(requestCreator, [
      "--trust-root", trustRootPath,
      "--subject-identity", subjectIdentityPath,
      "--policy", policyPath,
      "--issuer-origin", issuerOrigin,
      "--subject-origin", subjectOrigin,
      "--issued-at-ms", "1500",
      "--valid-from-ms", "1200",
      "--valid-until-ms", "8000",
      "--output", requestPath
    ], "native TLS request creation");
    assert.equal(createdRequest.code, 0, createdRequest.stderr);

    const incompleteTls = await runSignerFailure({
      authorityPath: invalidHalfAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      token: issuerToken
    });
    assert.notEqual(incompleteTls.code, 0);
    assert.match(incompleteTls.stderr, /native TLS requires both/u);
    await assert.rejects(access(invalidHalfAuthorityPath), { code: "ENOENT" });

    const mismatchedTls = await runSignerFailure({
      authorityPath: invalidPairAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      tlsPrivateKeyPath: subjectCertificate.keyPath,
      token: issuerToken
    });
    assert.notEqual(mismatchedTls.code, 0);
    assert.match(mismatchedTls.stderr, /cannot create a secure context/u);
    assert.equal(mismatchedTls.stderr.includes("BEGIN PRIVATE KEY"), false);
    await assert.rejects(access(invalidPairAuthorityPath), { code: "ENOENT" });

    await writeFile(
      oversizedKeyPath,
      new Uint8Array(PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.tls_private_key_bytes + 1)
    );
    const oversizedTls = await runSignerFailure({
      authorityPath: oversizedKeyAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      tlsPrivateKeyPath: oversizedKeyPath,
      token: issuerToken
    });
    assert.notEqual(oversizedTls.code, 0);
    assert.match(oversizedTls.stderr, /TLS private key file is outside its bounded size/u);
    await assert.rejects(access(oversizedKeyAuthorityPath), { code: "ENOENT" });

    const missingPossession = await runSignerFailure({
      authorityPath: missingPossessionAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      tlsPrivateKeyPath: issuerCertificate.keyPath,
      token: issuerToken
    });
    assert.notEqual(missingPossession.code, 0);
    assert.match(missingPossession.stderr, /SIGNER_POSSESSION_TOKEN/u);
    await assert.rejects(access(missingPossessionAuthorityPath), { code: "ENOENT" });
    const reusedPossession = await runSignerFailure({
      authorityPath: reusedPossessionAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      possessionToken: issuerToken,
      role: "issuer",
      tlsCertificatePath: issuerCertificate.certificatePath,
      tlsPrivateKeyPath: issuerCertificate.keyPath,
      token: issuerToken
    });
    assert.notEqual(reusedPossession.code, 0);
    assert.match(reusedPossession.stderr, /must differ/u);
    await assert.rejects(access(reusedPossessionAuthorityPath), { code: "ENOENT" });

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
    assert.equal(issuer.ready.listen_protocol, "https");
    assert.equal(subject.ready.listen_protocol, "https");
    assert.equal(issuer.ready.tls_enabled, true);
    assert.equal(subject.ready.tls_enabled, true);
    assert.equal(issuer.ready.key_possession, "tls-exporter-role-key-signed");
    assert.equal(subject.ready.key_possession, "tls-exporter-role-key-signed");
    assert.equal(JSON.stringify(issuer.ready).includes("PRIVATE KEY"), false);
    assert.equal(JSON.stringify(subject.ready).includes("PRIVATE KEY"), false);

    const roleEnvironment = { NODE_EXTRA_CA_CERTS: caBundlePath };
    const observerEnvironment = {
      ...roleEnvironment,
      MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN: issuerPossessionToken,
      MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN: subjectPossessionToken
    };
    const [issuerResponse, subjectResponse] = await Promise.all([
      runTool(ceremonyRoleRunner, [
        "--endpoint", issuerOrigin,
        "--output", issuerResponsePath,
        "--request", requestPath,
        "--role", "issuer",
        "--timeout-ms", "15000"
      ], "native TLS issuer response", {
        ...roleEnvironment,
        MORTALOS_ADMISSION_SIGNER_TOKEN: issuerToken
      }),
      runTool(ceremonyRoleRunner, [
        "--endpoint", subjectOrigin,
        "--output", subjectResponsePath,
        "--request", requestPath,
        "--role", "subject",
        "--timeout-ms", "15000"
      ], "native TLS subject response", {
        ...roleEnvironment,
        MORTALOS_ADMISSION_SIGNER_TOKEN: subjectToken
      })
    ]);
    assert.equal(issuerResponse.code, 0, issuerResponse.stderr);
    assert.equal(subjectResponse.code, 0, subjectResponse.stderr);
    const finalized = await runTool(ceremonyFinalizer, [
      "--evaluated-at-ms", "2000",
      "--issuer-response", issuerResponsePath,
      "--output", bundlePath,
      "--request", requestPath,
      "--subject-response", subjectResponsePath
    ], "native TLS offline finalization", {
      MORTALOS_ADMISSION_ISSUER_TOKEN: "unused-issuer-token",
      MORTALOS_ADMISSION_SIGNER_TOKEN: "unused-generic-token",
      MORTALOS_ADMISSION_SUBJECT_TOKEN: "unused-subject-token"
    });
    assert.equal(finalized.code, 0, finalized.stderr);
    const bundleBytes = new Uint8Array(await readFile(bundlePath));
    const bundle = restorePlacementAdmissionCeremonyBundle(bundleBytes);
    assert.equal(bundle.status, "verified");
    assert.equal(bundle.evaluated_at_ms, "2000");
    const missingObserverAuthorization = await runTool(deploymentObserverRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(116)),
      "--output", missingObserverAuthorizationPath,
      "--timeout-ms", "15000"
    ], "missing deployment possession authorization", roleEnvironment);
    assert.notEqual(missingObserverAuthorization.code, 0);
    assert.match(missingObserverAuthorization.stderr, /possession-token-environment/u);
    await assert.rejects(access(missingObserverAuthorizationPath), { code: "ENOENT" });
    const sharedObserverAuthorization = await runTool(deploymentObserverRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(116)),
      "--output", sharedObserverAuthorizationPath,
      "--timeout-ms", "15000"
    ], "shared deployment possession authorization", {
      ...roleEnvironment,
      MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN: issuerPossessionToken,
      MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN: issuerPossessionToken
    });
    assert.notEqual(sharedObserverAuthorization.code, 0);
    assert.match(sharedObserverAuthorization.stderr, /possession-token-environment/u);
    await assert.rejects(access(sharedObserverAuthorizationPath), { code: "ENOENT" });
    const legacyObserved = await runTool(deploymentObserverRunner, [
      "--bundle", bundlePath,
      "--key-possession-mode", "legacy-identity-only",
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(116)),
      "--output", legacyObservationPath,
      "--timeout-ms", "15000"
    ], "explicit legacy deployment identity observation", roleEnvironment);
    assert.equal(legacyObserved.code, 0, legacyObserved.stderr);
    const legacyObservation = restorePlacementAdmissionDeploymentObservation(
      new Uint8Array(await readFile(legacyObservationPath))
    );
    assert.equal(legacyObservation.key_possession, "identity-only-legacy");
    const observed = await runTool(deploymentObserverRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(117)),
      "--output", observationPath,
      "--timeout-ms", "15000"
    ], "native TLS deployment observation", observerEnvironment);
    assert.equal(observed.code, 0, observed.stderr);
    const observation = restorePlacementAdmissionDeploymentObservation(
      new Uint8Array(await readFile(observationPath))
    );
    assert.equal(observation.status, "integrity-verified");
    assert.equal(observation.key_possession, "tls-exporter-role-key-signed");
    assert.equal(observation.live_observation_verified, false);
    assert.equal(observation.facts.tls_certificate_digests_distinct, true);
    assert.equal(observation.facts.tls_public_key_digests_distinct, true);
    assert.equal(observation.facts.remote_addresses_distinct, false);
    const publicTranscript = new TextDecoder().decode(Buffer.concat([
      await readFile(issuerResponsePath),
      await readFile(subjectResponsePath),
      await readFile(bundlePath),
      await readFile(legacyObservationPath),
      await readFile(observationPath),
      Buffer.from(
        issuerResponse.stdout + subjectResponse.stdout + finalized.stdout +
        legacyObserved.stdout + observed.stdout
      )
    ]));
    assert.equal(publicTranscript.includes(issuerToken), false);
    assert.equal(publicTranscript.includes(subjectToken), false);
    assert.equal(publicTranscript.includes(issuerPossessionToken), false);
    assert.equal(publicTranscript.includes(subjectPossessionToken), false);
    assert.doesNotMatch(publicTranscript, /BEGIN (?:RSA )?PRIVATE KEY/u);

    await Promise.all([issuer.stop(), subject.stop()]);
    issuer = null;
    subject = null;
    const issuerProofBytes = decodeBase64Url(
      observation.endpoint_observations[0].possession_proof_base64url
    );
    const subjectProofBytes = decodeBase64Url(
      observation.endpoint_observations[1].possession_proof_base64url
    );
    assert.notEqual(issuerProofBytes, null);
    assert.notEqual(subjectProofBytes, null);
    issuerReplay = await startPossessionReplayServer({
      certificate: issuerCertificate.certificate,
      key: await readFile(issuerCertificate.keyPath),
      port: issuerPort,
      proofBytes: issuerProofBytes
    });
    subjectReplay = await startPossessionReplayServer({
      certificate: subjectCertificate.certificate,
      key: await readFile(subjectCertificate.keyPath),
      port: subjectPort,
      proofBytes: subjectProofBytes
    });
    const replayed = await runTool(deploymentObserverRunner, [
      "--bundle", bundlePath,
      "--observed-at-ms", "2100",
      "--observer-nonce-base64url", encodeBase64Url(new Uint8Array(32).fill(117)),
      "--output", replayObservationPath,
      "--timeout-ms", "15000"
    ], "replayed deployment possession proof", observerEnvironment);
    assert.notEqual(replayed.code, 0);
    assert.match(replayed.stderr, /possession-proof/u);
    await assert.rejects(access(replayObservationPath), { code: "ENOENT" });
    await Promise.all([issuerReplay.close(), subjectReplay.close()]);
    issuerReplay = null;
    subjectReplay = null;
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
    assert.equal(issuer.ready.profile_status, "restored");
    assert.equal(subject.ready.profile_status, "restored");
    const [issuerRetry, subjectRetry] = await Promise.all([
      runTool(ceremonyRoleRunner, [
        "--endpoint", issuerOrigin,
        "--output", issuerResponseRetryPath,
        "--request", requestPath,
        "--role", "issuer",
        "--timeout-ms", "15000"
      ], "native TLS issuer response retry", {
        ...roleEnvironment,
        MORTALOS_ADMISSION_SIGNER_TOKEN: issuerToken
      }),
      runTool(ceremonyRoleRunner, [
        "--endpoint", subjectOrigin,
        "--output", subjectResponseRetryPath,
        "--request", requestPath,
        "--role", "subject",
        "--timeout-ms", "15000"
      ], "native TLS subject response retry", {
        ...roleEnvironment,
        MORTALOS_ADMISSION_SIGNER_TOKEN: subjectToken
      })
    ]);
    assert.equal(issuerRetry.code, 0, issuerRetry.stderr);
    assert.equal(subjectRetry.code, 0, subjectRetry.stderr);
    assert.deepEqual(
      new Uint8Array(await readFile(issuerResponseRetryPath)),
      new Uint8Array(await readFile(issuerResponsePath))
    );
    assert.deepEqual(
      new Uint8Array(await readFile(subjectResponseRetryPath)),
      new Uint8Array(await readFile(subjectResponsePath))
    );
    assert.deepEqual(
      (await readdir(directory)).filter((name) => name.startsWith(".mortalos-pending-")),
      []
    );
  } finally {
    await Promise.all([
      issuer?.stop(),
      subject?.stop(),
      issuerReplay?.close(),
      subjectReplay?.close()
    ]);
    await rm(directory, { force: true, recursive: true });
  }
});

test("operator-facing signer services bind their own origins and survive exact restart", {
  timeout: 90_000
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-admission-service-"));
  const issuerPort = await freePort();
  let subjectPort = await freePort();
  while (subjectPort === issuerPort) subjectPort = await freePort();
  const issuerOrigin = `http://127.0.0.1:${issuerPort}`;
  const subjectOrigin = `http://127.0.0.1:${subjectPort}`;
  const issuerToken = encodeBase64Url(randomBytes(32));
  const subjectToken = encodeBase64Url(randomBytes(32));
  const policyPath = join(directory, "policy.json");
  const rootConfigPath = join(directory, "root-config.json");
  const trustRootPath = join(directory, "trust-root.json");
  const issuerAuthorityPath = join(directory, "issuer-authority.json");
  const subjectAuthorityPath = join(directory, "subject-authority.json");
  const subjectIdentityPath = join(directory, "subject-identity.json");
  const requestPath = join(directory, "request.json");
  await writeFile(policyPath, canonicalBytes(policy()));
  await writeFile(rootConfigPath, canonicalBytes(rootConfig()));
  let issuer;
  let subject;
  try {
    const prepared = await runTool(issuerPreparer, [
      "--authority", issuerAuthorityPath,
      "--policy", policyPath,
      "--root-config", rootConfigPath,
      "--output", trustRootPath
    ], "issuer preparation");
    assert.equal(prepared.code, 0, prepared.stderr);
    const preparedStatus = JSON.parse(prepared.stdout);
    const preparedSubject = await runTool(subjectPreparer, [
      "--authority", subjectAuthorityPath,
      "--output", subjectIdentityPath
    ], "subject preparation");
    assert.equal(preparedSubject.code, 0, preparedSubject.stderr);
    const preparedSubjectStatus = JSON.parse(preparedSubject.stdout);
    const subjectIdentityBytes = new Uint8Array(await readFile(subjectIdentityPath));
    const subjectIdentity = JSON.parse(new TextDecoder().decode(subjectIdentityBytes));
    const createdRequest = await runTool(requestCreator, [
      "--trust-root", trustRootPath,
      "--subject-identity", subjectIdentityPath,
      "--policy", policyPath,
      "--issuer-origin", issuerOrigin,
      "--subject-origin", subjectOrigin,
      "--issued-at-ms", "1500",
      "--valid-from-ms", "1200",
      "--valid-until-ms", "8000",
      "--output", requestPath
    ], "request creation");
    assert.equal(createdRequest.code, 0, createdRequest.stderr);
    const createdRequestStatus = JSON.parse(createdRequest.stdout);
    const requestBytes = new Uint8Array(await readFile(requestPath));
    const restoredRequest = restorePlacementAdmissionSigningRequest(requestBytes);
    assert.equal(createdRequestStatus.evidence_id, restoredRequest.evidence_id);
    issuer = await startSigner({
      authorityPath: issuerAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      token: issuerToken
    });
    assert.equal(preparedStatus.issuer_key_id, issuer.ready.identity.key_id);
    assert.equal(preparedStatus.trust_root_id, issuer.ready.trust_root.trust_root_id);
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
      role: "subject",
      token: subjectToken
    });
    assert.equal(preparedSubjectStatus.subject_key_id, subject.ready.identity.key_id);
    assert.equal(equalBytes(subjectIdentityBytes, canonicalBytes(subject.ready.identity)), true);
    assert.equal(issuer.ready.endpoint_origin, issuerOrigin);
    assert.equal(subject.ready.endpoint_origin, subjectOrigin);
    assert.notEqual(issuer.ready.pid, subject.ready.pid);
    assert.notEqual(issuer.ready.identity.key_id, subject.ready.identity.key_id);
    assert.equal(issuer.ready.profile_status, "locked");
    assert.equal(subject.ready.profile_status, "locked");
    assert.equal(issuer.ready.listen_protocol, "http");
    assert.equal(subject.ready.listen_protocol, "http");
    assert.equal(issuer.ready.tls_enabled, false);
    assert.equal(subject.ready.tls_enabled, false);
    assert.equal(JSON.stringify(issuer.ready).includes(issuerToken), false);
    assert.equal(JSON.stringify(subject.ready).includes(subjectToken), false);

    const first = await runPlacementAdmissionHttpCeremony({
      evaluated_at_ms: "2000",
      issuer: { authorization: issuerToken, url: issuerOrigin },
      request_bytes: requestBytes,
      subject: { authorization: subjectToken, url: subjectOrigin },
      timeout_ms: 10_000
    });
    assert.equal(first.status, "verified");
    const restored = restorePlacementAdmissionCeremonyBundle(first.bytes);
    assert.equal(verifyPlacementAdmissionEvidence({
      evaluated_at_ms: "2000",
      evidence_bytes: restored.evidence_bytes,
      trust_root: restored.trust_root
    }).status, "verified");

    const issuerAliasChallenge = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: issuer.ready.identity,
      issuer_origin: `http://localhost:${issuerPort}`,
      nonce: new Uint8Array(32).fill(98),
      subject_identity: subject.ready.identity,
      subject_origin: subjectOrigin
    });
    const issuerAliasRequest = createPlacementAdmissionSigningRequest({
      body: evidenceBody(subject.ready.identity, policy(), issuerAliasChallenge),
      trust_root: issuer.ready.trust_root
    });
    assert.equal((await post(issuerOrigin, issuerToken, issuerAliasRequest)).status, 403);
    const subjectAliasChallenge = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: issuer.ready.identity,
      issuer_origin: issuerOrigin,
      nonce: new Uint8Array(32).fill(99),
      subject_identity: subject.ready.identity,
      subject_origin: `http://localhost:${subjectPort}`
    });
    const subjectAliasRequest = createPlacementAdmissionSigningRequest({
      body: evidenceBody(subject.ready.identity, policy(), subjectAliasChallenge),
      trust_root: issuer.ready.trust_root
    });
    assert.equal((await post(subjectOrigin, subjectToken, subjectAliasRequest)).status, 403);
    assert.equal((await post(issuerOrigin, issuerToken, requestBytes, "application/json")).status, 415);
    assert.equal((await post(
      issuerOrigin,
      issuerToken,
      new Uint8Array(PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes + 1)
    )).status, 413);

    const issuerProfilePath = `${issuerAuthorityPath}.profile.json`;
    const issuerProfileBefore = new Uint8Array(await readFile(issuerProfilePath));
    assert.equal(new TextDecoder().decode(issuerProfileBefore).includes(issuerToken), false);
    await Promise.all([issuer.stop(), subject.stop()]);
    issuer = null;
    subject = null;
    const drift = await runSignerFailure({
      authorityPath: issuerAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: `http://localhost:${issuerPort}`,
      policyPath,
      port: issuerPort,
      role: "issuer",
      token: issuerToken
    });
    assert.notEqual(drift.code, 0);
    assert.equal(drift.stdout, "");
    assert.match(drift.stderr, /E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CONFLICT/u);
    assert.equal(drift.stderr.includes(issuerToken), false);
    assert.equal(equalBytes(
      new Uint8Array(await readFile(issuerProfilePath)),
      issuerProfileBefore
    ), true);
    const restartedIssuer = await startSigner({
      authorityPath: issuerAuthorityPath,
      configPath: rootConfigPath,
      endpointOrigin: issuerOrigin,
      policyPath,
      port: issuerPort,
      role: "issuer",
      token: issuerToken
    });
    const restartedSubject = await startSigner({
      authorityPath: subjectAuthorityPath,
      configPath: trustRootPath,
      endpointOrigin: subjectOrigin,
      policyPath,
      port: subjectPort,
      role: "subject",
      token: subjectToken
    });
    issuer = restartedIssuer;
    subject = restartedSubject;
    assert.equal(issuer.ready.profile_status, "restored");
    assert.equal(subject.ready.profile_status, "restored");
    assert.equal(issuer.ready.identity.key_id, restored.issuer.identity.key_id);
    assert.equal(subject.ready.identity.key_id, restored.subject.identity.key_id);
    const retry = await runPlacementAdmissionHttpCeremony({
      evaluated_at_ms: "2000",
      issuer: { authorization: issuerToken, url: issuerOrigin },
      request_bytes: requestBytes,
      subject: { authorization: subjectToken, url: subjectOrigin },
      timeout_ms: 10_000
    });
    assert.equal(equalBytes(retry.bytes, first.bytes), true);
    assert.equal(issuer.stderr().includes(issuerToken), false);
    assert.equal(subject.stderr().includes(subjectToken), false);
  } finally {
    await Promise.all([
      issuer?.stop(),
      subject?.stop()
    ]);
    await rm(directory, { force: true, recursive: true });
  }
});
