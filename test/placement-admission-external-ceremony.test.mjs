import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes, parseJsonBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  PLACEMENT_ADMISSION_LIMITS,
  verifyPlacementAdmissionEvidence
} from "../src/placement/admission.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_LIMITS,
  createPlacementAdmissionCeremonyChallenge,
  finalizePlacementAdmissionCeremonyBundle,
  restorePlacementAdmissionCeremonyBundle,
  restorePlacementAdmissionCeremonyRoleResponse,
  runPlacementAdmissionHttpCeremony,
  runPlacementAdmissionHttpCeremonyRole
} from "../lab/placement/admission-ceremony-client.mjs";
import {
  createPlacementAdmissionSigningRequest,
  derivePlacementAdmissionSignerPolicyDigest
} from "../lab/placement/admission-signer-session.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const finalizerPath = resolve(directory, "../scripts/finalize-placement-admission-ceremony.mjs");
const signerChildPath = resolve(directory, "placement-admission-signer-child.mjs");
const runnerPath = resolve(directory, "../scripts/run-placement-admission-ceremony.mjs");
const roleRunnerPath = resolve(directory, "../scripts/run-placement-admission-ceremony-role.mjs");

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
}

function rootConfig() {
  const organismDigest = digest("MortalOS external ceremony organism", {
    name: "external-ceremony-test"
  });
  return {
    authority_id: digest("MortalOS external ceremony root", { purpose: "admission" }),
    lineage_organism_id: `mortalos:${organismDigest.slice("sha256:".length)}`,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS external ceremony scope", { purpose: "membership" }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
}

function signerPolicy() {
  return {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS external ceremony domain", { site: "declared-a" }),
    operator_root_id: digest("MortalOS external ceremony operator", { operator: "external-a" }),
    roles: ["provider"]
  };
}

function evidenceBody(subject, policy, challengeBytes) {
  return {
    attestation_challenge_base64url: encodeBase64Url(challengeBytes),
    attestation_kind: policy.attestation_kind,
    failure_domain_id: policy.failure_domain_id,
    issued_at_ms: "1500",
    operator_root_id: policy.operator_root_id,
    roles: policy.roles,
    subject,
    valid_from_ms: "1200",
    valid_until_ms: "8000"
  };
}

async function startSigner(role, { policy, rootConfig: config = null, trustRoot = null }) {
  const token = encodeBase64Url(randomBytes(32));
  const child = spawn(process.execPath, [signerChildPath, role], {
    env: {
      ...process.env,
      MORTALOS_ADMISSION_AUTHORITY_PATH: "",
      MORTALOS_ADMISSION_ENDPOINT_ORIGIN: "self",
      MORTALOS_ADMISSION_ROOT_CONFIG: config === null ? "" : JSON.stringify(config),
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
  const ready = await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error(`${role} readiness timeout`)), 10_000);
    child.once("error", rejectReady);
    child.once("exit", (code) => rejectReady(new Error(`${role} exited ${code}: ${stderr}`)));
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolveReady(JSON.parse(line));
    });
  });
  let stopped = false;
  return {
    identity: ready.identity,
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
    token,
    trust_root: ready.trust_root,
    url: ready.url,
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

async function runCli(args, env, scriptPath = runnerPath) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
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
      rejectExit(new Error("external ceremony CLI timeout"));
    }, 30_000);
    child.once("error", rejectExit);
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      resolveExit(exitCode);
    });
  });
  return { code, stderr, stdout };
}

async function createFixture() {
  const policy = signerPolicy();
  const issuer = await startSigner("issuer", { policy, rootConfig: rootConfig() });
  const subject = await startSigner("subject", { policy, trustRoot: issuer.trust_root });
  const challengeBytes = createPlacementAdmissionCeremonyChallenge({
    issuer_identity: issuer.identity,
    issuer_origin: issuer.url,
    nonce: new Uint8Array(32).fill(73),
    subject_identity: subject.identity,
    subject_origin: subject.url
  });
  assert.ok(challengeBytes.byteLength <= PLACEMENT_ADMISSION_LIMITS.attestation_challenge_bytes_max);
  const body = evidenceBody(subject.identity, policy, challengeBytes);
  const requestBytes = createPlacementAdmissionSigningRequest({
    body,
    trust_root: issuer.trust_root
  });
  return { body, issuer, policy, requestBytes, subject };
}

test("external ceremony runner emits one offline-verifiable token-free bundle", {
  timeout: 60_000
}, async () => {
  const fixture = await createFixture();
  try {
    const options = {
      evaluated_at_ms: "2000",
      issuer: { authorization: fixture.issuer.token, url: fixture.issuer.url },
      request_bytes: fixture.requestBytes,
      subject: { authorization: fixture.subject.token, url: fixture.subject.url },
      timeout_ms: 10_000
    };
    const partialError = await runPlacementAdmissionHttpCeremony({
      ...options,
      subject: { authorization: "x".repeat(32), url: fixture.subject.url }
    }).then(() => null, (error) => error);
    assert.equal(partialError?.code, "E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT");
    assert.equal(partialError?.detail, "subject-signature-status-401");
    assert.equal(JSON.stringify(partialError).includes(fixture.issuer.token), false);
    assert.equal(JSON.stringify(partialError).includes(fixture.subject.token), false);
    const borrowedRequest = new Uint8Array(fixture.requestBytes);
    const borrowedIssuer = { ...options.issuer };
    const borrowedSubject = { ...options.subject };
    const pending = runPlacementAdmissionHttpCeremony({
      ...options,
      issuer: borrowedIssuer,
      request_bytes: borrowedRequest,
      subject: borrowedSubject
    });
    borrowedRequest.fill(0);
    borrowedIssuer.url = "http://example.com/";
    borrowedSubject.authorization = "x".repeat(32);
    const originalFetch = globalThis.fetch;
    const originalUrl = globalThis.URL;
    const originalRead = ReadableStreamDefaultReader.prototype.read;
    let poisonCalls = 0;
    globalThis.fetch = () => {
      poisonCalls += 1;
      throw new Error("ambient fetch must not be called");
    };
    globalThis.URL = class HostileURL {
      constructor() {
        poisonCalls += 1;
        throw new Error("ambient URL must not be called");
      }
    };
    ReadableStreamDefaultReader.prototype.read = function hostileRead() {
      poisonCalls += 1;
      throw new Error("ambient reader must not be called");
    };
    let first;
    try {
      first = await pending;
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.URL = originalUrl;
      ReadableStreamDefaultReader.prototype.read = originalRead;
    }
    assert.equal(poisonCalls, 0);
    const retry = await runPlacementAdmissionHttpCeremony(options);
    assert.equal(first.status, "verified");
    assert.equal(equalBytes(first.bytes, retry.bytes), true);
    assert.equal(first.issuer.identity.key_id, fixture.issuer.identity.key_id);
    assert.equal(first.subject.identity.key_id, fixture.subject.identity.key_id);
    assert.match(first.issuer.endpoint_origin, /^http:\/\/127\.0\.0\.1:\d+$/u);
    assert.match(first.subject.endpoint_origin, /^http:\/\/127\.0\.0\.1:\d+$/u);

    const restored = restorePlacementAdmissionCeremonyBundle(first.bytes);
    assert.equal(restored.bundle_id, first.bundle_id);
    assert.equal(restored.evidence_id, first.evidence_id);
    assert.equal(verifyPlacementAdmissionEvidence({
      evaluated_at_ms: "2000",
      evidence_bytes: restored.evidence_bytes,
      trust_root: restored.trust_root
    }).status, "verified");
    const publicText = new TextDecoder().decode(first.bytes);
    assert.equal(publicText.includes(fixture.issuer.token), false);
    assert.equal(publicText.includes(fixture.subject.token), false);
    assert.equal(/private|pkcs8|secret/iu.test(
      JSON.stringify(Object.keys(parseJsonBytes(first.bytes)))
    ), false);

    const tampered = parseJsonBytes(first.bytes);
    tampered.issuer.endpoint_origin = fixture.subject.url;
    const { bundle_id: ignoredBundleId, ...tamperedContent } = tampered;
    tampered.bundle_id = domainHash(
      "MortalOS placement admission ceremony bundle v1",
      canonicalBytes(tamperedContent)
    );
    assert.throws(
      () => restorePlacementAdmissionCeremonyBundle(canonicalBytes(tampered)),
      /E_PLACEMENT_ADMISSION_CEREMONY_BINDING/u
    );
    const wrongChallenge = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: fixture.issuer.identity,
      issuer_origin: fixture.subject.url,
      nonce: new Uint8Array(32).fill(74),
      subject_identity: fixture.subject.identity,
      subject_origin: fixture.subject.url
    });
    const wrongRequest = createPlacementAdmissionSigningRequest({
      body: evidenceBody(fixture.subject.identity, fixture.policy, wrongChallenge),
      trust_root: fixture.issuer.trust_root
    });
    assert.equal((await fixture.issuer.request(wrongRequest)).status, 403);
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({ ...options, request_bytes: wrongRequest }),
      /E_PLACEMENT_ADMISSION_CEREMONY_BINDING/u
    );
    const wrongSubjectChallenge = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: fixture.issuer.identity,
      issuer_origin: fixture.issuer.url,
      nonce: new Uint8Array(32).fill(75),
      subject_identity: fixture.subject.identity,
      subject_origin: fixture.issuer.url
    });
    const wrongSubjectRequest = createPlacementAdmissionSigningRequest({
      body: evidenceBody(fixture.subject.identity, fixture.policy, wrongSubjectChallenge),
      trust_root: fixture.issuer.trust_root
    });
    assert.equal((await fixture.subject.request(wrongSubjectRequest)).status, 403);
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({
        ...options,
        issuer: { authorization: fixture.subject.token, url: fixture.subject.url },
        subject: { authorization: fixture.issuer.token, url: fixture.issuer.url }
      }),
      /E_PLACEMENT_ADMISSION_CEREMONY_ROLE/u
    );
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({
        ...options,
        issuer: { authorization: fixture.issuer.token, url: "http://example.com/" }
      }),
      /E_PLACEMENT_ADMISSION_CEREMONY_ENDPOINT/u
    );
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({ ...options, timeout_ms: 999 }),
      /E_PLACEMENT_ADMISSION_CEREMONY_LIMIT/u
    );
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({
        ...options,
        issuer: { authorization: "x".repeat(31), url: fixture.issuer.url }
      }),
      /E_PLACEMENT_ADMISSION_CEREMONY_AUTHORIZATION/u
    );
    for (const nonceLength of [31, 33]) {
      assert.throws(() => createPlacementAdmissionCeremonyChallenge({
        issuer_identity: fixture.issuer.identity,
        issuer_origin: fixture.issuer.url,
        nonce: new Uint8Array(nonceLength),
        subject_identity: fixture.subject.identity,
        subject_origin: fixture.subject.url
      }), /E_PLACEMENT_ADMISSION_CEREMONY_LIMIT/u);
    }
    assert.throws(
      () => restorePlacementAdmissionCeremonyBundle(
        new Uint8Array(PLACEMENT_ADMISSION_CEREMONY_LIMITS.bundle_bytes + 1)
      ),
      /E_PLACEMENT_ADMISSION_CEREMONY_LIMIT/u
    );
  } finally {
    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
  }
});

test("role-local bearer use publishes public responses for token-free finalization", {
  timeout: 60_000
}, async () => {
  const fixture = await createFixture();
  const temp = await mkdtemp(join(tmpdir(), "mortalos-role-local-ceremony-"));
  try {
    const borrowedRequest = new Uint8Array(fixture.requestBytes);
    const borrowedEndpoint = { authorization: fixture.issuer.token, url: fixture.issuer.url };
    const issuerPending = runPlacementAdmissionHttpCeremonyRole({
      endpoint: borrowedEndpoint,
      request_bytes: borrowedRequest,
      role: "issuer",
      timeout_ms: 10_000
    });
    borrowedRequest.fill(0);
    borrowedEndpoint.authorization = "x".repeat(32);
    borrowedEndpoint.url = fixture.subject.url;
    const issuerRole = await issuerPending;
    const subjectRole = await runPlacementAdmissionHttpCeremonyRole({
      endpoint: { authorization: fixture.subject.token, url: fixture.subject.url },
      request_bytes: fixture.requestBytes,
      role: "subject",
      timeout_ms: 10_000
    });
    assert.equal(restorePlacementAdmissionCeremonyRoleResponse(issuerRole.bytes).role, "issuer");
    assert.equal(restorePlacementAdmissionCeremonyRoleResponse(subjectRole.bytes).role, "subject");
    let accessorCalls = 0;
    const accessorOptions = {
      get endpoint() {
        accessorCalls += 1;
        return { authorization: fixture.issuer.token, url: fixture.issuer.url };
      },
      request_bytes: fixture.requestBytes,
      role: "issuer",
      timeout_ms: 10_000
    };
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremonyRole(accessorOptions),
      /E_PLACEMENT_ADMISSION_CEREMONY_FORMAT/u
    );
    assert.equal(accessorCalls, 0);
    if (typeof SharedArrayBuffer === "function") {
      const sharedRequest = new Uint8Array(new SharedArrayBuffer(fixture.requestBytes.byteLength));
      sharedRequest.set(fixture.requestBytes);
      await assert.rejects(
        () => runPlacementAdmissionHttpCeremonyRole({
          endpoint: { authorization: fixture.issuer.token, url: fixture.issuer.url },
          request_bytes: sharedRequest,
          role: "issuer",
          timeout_ms: 10_000
        }),
        /E_PLACEMENT_ADMISSION_(?:CEREMONY|SIGNER)_LIMIT/u
      );
    }
    const finalized = finalizePlacementAdmissionCeremonyBundle({
      evaluated_at_ms: "2000",
      issuer_response_bytes: issuerRole.bytes,
      request_bytes: fixture.requestBytes,
      subject_response_bytes: subjectRole.bytes
    });
    const combined = await runPlacementAdmissionHttpCeremony({
      evaluated_at_ms: "2000",
      issuer: { authorization: fixture.issuer.token, url: fixture.issuer.url },
      request_bytes: fixture.requestBytes,
      subject: { authorization: fixture.subject.token, url: fixture.subject.url },
      timeout_ms: 10_000
    });
    assert.equal(equalBytes(finalized.bytes, combined.bytes), true);

    const requestPath = join(temp, "request.json");
    const issuerResponsePath = join(temp, "issuer-response.json");
    const subjectResponsePath = join(temp, "subject-response.json");
    const bundlePath = join(temp, "bundle.json");
    await writeFile(requestPath, fixture.requestBytes);
    const issuerArgs = [
      "--endpoint", fixture.issuer.url,
      "--output", issuerResponsePath,
      "--request", requestPath,
      "--role", "issuer",
      "--timeout-ms", "10000"
    ];
    const subjectArgs = [
      "--endpoint", fixture.subject.url,
      "--output", subjectResponsePath,
      "--request", requestPath,
      "--role", "subject",
      "--timeout-ms", "10000"
    ];
    const issuerCli = await runCli(issuerArgs, {
      MORTALOS_ADMISSION_ISSUER_TOKEN: "",
      MORTALOS_ADMISSION_SIGNER_TOKEN: fixture.issuer.token,
      MORTALOS_ADMISSION_SUBJECT_TOKEN: ""
    }, roleRunnerPath);
    assert.equal(issuerCli.code, 0, issuerCli.stderr);
    const subjectCli = await runCli(subjectArgs, {
      MORTALOS_ADMISSION_ISSUER_TOKEN: "",
      MORTALOS_ADMISSION_SIGNER_TOKEN: fixture.subject.token,
      MORTALOS_ADMISSION_SUBJECT_TOKEN: ""
    }, roleRunnerPath);
    assert.equal(subjectCli.code, 0, subjectCli.stderr);
    const issuerBytes = new Uint8Array(await readFile(issuerResponsePath));
    const subjectBytes = new Uint8Array(await readFile(subjectResponsePath));
    assert.equal(equalBytes(issuerBytes, issuerRole.bytes), true);
    assert.equal(equalBytes(subjectBytes, subjectRole.bytes), true);

    const finalizeArgs = [
      "--evaluated-at-ms", "2000",
      "--issuer-response", issuerResponsePath,
      "--output", bundlePath,
      "--request", requestPath,
      "--subject-response", subjectResponsePath
    ];
    const finalizeCli = await runCli(finalizeArgs, {
      MORTALOS_ADMISSION_ISSUER_TOKEN: fixture.issuer.token,
      MORTALOS_ADMISSION_SIGNER_TOKEN: "",
      MORTALOS_ADMISSION_SUBJECT_TOKEN: fixture.subject.token
    }, finalizerPath);
    assert.equal(finalizeCli.code, 0, finalizeCli.stderr);
    const bundleBytes = new Uint8Array(await readFile(bundlePath));
    assert.equal(equalBytes(bundleBytes, finalized.bytes), true);
    const transcript = [
      issuerCli.stdout,
      issuerCli.stderr,
      subjectCli.stdout,
      subjectCli.stderr,
      finalizeCli.stdout,
      finalizeCli.stderr,
      new TextDecoder().decode(issuerBytes),
      new TextDecoder().decode(subjectBytes),
      new TextDecoder().decode(bundleBytes)
    ].join("\n");
    assert.equal(transcript.includes(fixture.issuer.token), false);
    assert.equal(transcript.includes(fixture.subject.token), false);

    const wrongRolePath = join(temp, "wrong-role.json");
    const wrongRole = await runCli([
      "--endpoint", fixture.subject.url,
      "--output", wrongRolePath,
      "--request", requestPath,
      "--role", "issuer",
      "--timeout-ms", "10000"
    ], { MORTALOS_ADMISSION_SIGNER_TOKEN: fixture.subject.token }, roleRunnerPath);
    assert.notEqual(wrongRole.code, 0);
    assert.equal((await readdir(temp)).includes("wrong-role.json"), false);

    const swappedPath = join(temp, "swapped-bundle.json");
    const swapped = await runCli([
      "--evaluated-at-ms", "2000",
      "--issuer-response", subjectResponsePath,
      "--output", swappedPath,
      "--request", requestPath,
      "--subject-response", issuerResponsePath
    ], {}, finalizerPath);
    assert.notEqual(swapped.code, 0);
    assert.equal((await readdir(temp)).includes("swapped-bundle.json"), false);

    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
    const collision = await runCli(issuerArgs, {
      MORTALOS_ADMISSION_SIGNER_TOKEN: fixture.issuer.token
    }, roleRunnerPath);
    assert.notEqual(collision.code, 0);
    assert.equal(equalBytes(new Uint8Array(await readFile(issuerResponsePath)), issuerBytes), true);
    const finalizationCollision = await runCli([
      "--evaluated-at-ms", "2000",
      "--issuer-response", join(temp, "missing-issuer-response.json"),
      "--output", bundlePath,
      "--request", join(temp, "missing-request.json"),
      "--subject-response", join(temp, "missing-subject-response.json")
    ], {}, finalizerPath);
    assert.notEqual(finalizationCollision.code, 0);
    assert.equal(equalBytes(new Uint8Array(await readFile(bundlePath)), bundleBytes), true);
    const names = await readdir(temp);
    assert.equal(names.some((name) => name.startsWith(".mortalos-pending-admission-role-")), false);
    assert.equal(names.some((name) => name.startsWith(
      ".mortalos-pending-admission-finalize-"
    )), false);
  } finally {
    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
    await rm(temp, { recursive: true, force: true });
  }
});

test("CLI publishes one immutable replay bundle without exposing bearer tokens", {
  timeout: 60_000
}, async () => {
  const fixture = await createFixture();
  const temp = await mkdtemp(join(tmpdir(), "mortalos-external-ceremony-"));
  try {
    const requestPath = join(temp, "request.json");
    const outputPath = join(temp, "bundle.json");
    await writeFile(requestPath, fixture.requestBytes);
    const args = [
      "--evaluated-at-ms", "2000",
      "--issuer", fixture.issuer.url,
      "--output", outputPath,
      "--request", requestPath,
      "--subject", fixture.subject.url,
      "--timeout-ms", "10000"
    ];
    const env = {
      MORTALOS_ADMISSION_ISSUER_TOKEN: fixture.issuer.token,
      MORTALOS_ADMISSION_SUBJECT_TOKEN: fixture.subject.token
    };
    const first = await runCli(args, env);
    assert.equal(first.code, 0, first.stderr);
    const summary = JSON.parse(first.stdout);
    assert.equal(summary.status, "verified");
    const bundleBytes = new Uint8Array(await readFile(outputPath));
    const restored = restorePlacementAdmissionCeremonyBundle(bundleBytes);
    assert.equal(restored.bundle_id, summary.bundle_id);
    const transcript = `${first.stdout}\n${first.stderr}\n${new TextDecoder().decode(bundleBytes)}`;
    assert.equal(transcript.includes(fixture.issuer.token), false);
    assert.equal(transcript.includes(fixture.subject.token), false);

    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
    const second = await runCli(args, env);
    assert.notEqual(second.code, 0);
    assert.equal(equalBytes(new Uint8Array(await readFile(outputPath)), bundleBytes), true);
    assert.equal(`${second.stdout}\n${second.stderr}`.includes(fixture.issuer.token), false);
    assert.equal(`${second.stdout}\n${second.stderr}`.includes(fixture.subject.token), false);
    assert.equal((await readdir(temp)).some((name) => name.startsWith(
      ".mortalos-pending-admission-"
    )), false);
  } finally {
    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
    await rm(temp, { recursive: true, force: true });
  }
});

test("external ceremony bounds an untrusted endpoint body before signature parsing", {
  timeout: 60_000
}, async () => {
  const fixture = await createFixture();
  const identityBytes = canonicalBytes({ identity: fixture.issuer.identity, role: "issuer" });
  const oversized = new Uint8Array(PLACEMENT_ADMISSION_CEREMONY_LIMITS.response_bytes + 1);
  const malicious = createServer((request, response) => {
    if (request.method === "GET") {
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(identityBytes);
      return;
    }
    request.resume();
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(oversized);
  });
  await new Promise((resolveListen, rejectListen) => {
    malicious.once("error", rejectListen);
    malicious.listen(0, "127.0.0.1", resolveListen);
  });
  const address = malicious.address();
  try {
    const maliciousOrigin = `http://127.0.0.1:${address.port}`;
    const challengeBytes = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: fixture.issuer.identity,
      issuer_origin: maliciousOrigin,
      nonce: new Uint8Array(32).fill(75),
      subject_identity: fixture.subject.identity,
      subject_origin: fixture.subject.url
    });
    const requestBytes = createPlacementAdmissionSigningRequest({
      body: evidenceBody(fixture.subject.identity, fixture.policy, challengeBytes),
      trust_root: fixture.issuer.trust_root
    });
    await assert.rejects(
      () => runPlacementAdmissionHttpCeremony({
        evaluated_at_ms: "2000",
        issuer: {
          authorization: fixture.issuer.token,
          url: maliciousOrigin
        },
        request_bytes: requestBytes,
        subject: { authorization: fixture.subject.token, url: fixture.subject.url },
        timeout_ms: 10_000
      }),
      (error) => error?.code === "E_PLACEMENT_ADMISSION_CEREMONY_LIMIT" &&
        error?.detail === "issuer-signature-response-bytes"
    );
  } finally {
    await new Promise((resolveClose) => malicious.close(resolveClose));
    await Promise.all([fixture.issuer.stop(), fixture.subject.stop()]);
  }
});
