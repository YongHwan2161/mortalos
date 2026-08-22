import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { createContinuityCapsule } from "../src/capsule.mjs";
import { encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import {
  custodyCommitment,
  eventPayloadHash,
  genesisApprovalMessage,
  pulseApprovalMessage
} from "../src/index.mjs";
import { createLineage } from "../src/lineage.mjs";
import { verifyPlacementMembershipEpoch } from "../src/placement/admission.mjs";
import {
  createInitialState,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../src/state/engine.mjs";
import { createStatePackageTransitionPayload } from "../src/state/package.mjs";
import {
  createPlacementAdmissionCeremonyChallenge,
  runPlacementAdmissionHttpCeremony
} from "../lab/placement/admission-ceremony-client.mjs";
import {
  restorePlacementMembershipEpochApproval,
  restorePlacementMembershipEpochRequest
} from "../lab/placement/admission-membership-epoch-ceremony.mjs";
import {
  createPlacementAdmissionSigningRequest
} from "../lab/placement/admission-signer-session.mjs";

const signerChildPath = fileURLToPath(new URL(
  "./placement-admission-signer-child.mjs",
  import.meta.url
));
const createRequestRunner = fileURLToPath(new URL(
  "../scripts/create-placement-membership-epoch-request.mjs",
  import.meta.url
));
const approveRequestRunner = fileURLToPath(new URL(
  "../scripts/approve-placement-membership-epoch.mjs",
  import.meta.url
));
const finalizeRequestRunner = fileURLToPath(new URL(
  "../scripts/finalize-placement-membership-epoch.mjs",
  import.meta.url
));

function digest(domain, value) {
  return domainHash(domain, canonicalBytes(value));
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

async function runNode(script, args, timeout = 30_000) {
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env },
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

async function startAdmissionSigner(role, { policy, rootConfig = null, trustRoot = null }) {
  const token = encodeBase64Url(randomBytes(32));
  const child = spawn(process.execPath, [signerChildPath, role], {
    env: {
      ...process.env,
      MORTALOS_ADMISSION_AUTHORITY_PATH: "",
      MORTALOS_ADMISSION_ENDPOINT_ORIGIN: "self",
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
    const timer = setTimeout(() => reject(new Error(`${role} readiness timeout`)), 10_000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    child.once("error", fail);
    child.once("exit", (code) => fail(new Error(`${role} exited ${code}: ${stderr}`)));
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolve(JSON.parse(line));
    });
  });
  let stopped = false;
  return {
    identity: ready.identity,
    token,
    trust_root: ready.trust_root,
    url: ready.url,
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

async function admissionBundle({ label, organismId, roles }) {
  const policy = {
    attestation_kind: "operator-domain-membership",
    failure_domain_id: digest("MortalOS membership ceremony domain", { label }),
    operator_root_id: digest("MortalOS membership ceremony operator", { label }),
    roles
  };
  const rootConfig = {
    authority_id: digest("MortalOS membership ceremony root", { label }),
    lineage_organism_id: organismId,
    prior_trust_root_id: null,
    scope_digest: digest("MortalOS membership ceremony scope", { label }),
    sequence: "1",
    valid_from_ms: "1000",
    valid_until_ms: "9000"
  };
  const issuer = await startAdmissionSigner("issuer", { policy, rootConfig });
  const subject = await startAdmissionSigner("subject", {
    policy,
    trustRoot: issuer.trust_root
  });
  try {
    const challenge = createPlacementAdmissionCeremonyChallenge({
      issuer_identity: issuer.identity,
      issuer_origin: issuer.url,
      nonce: new Uint8Array(32).fill(label.charCodeAt(0)),
      subject_identity: subject.identity,
      subject_origin: subject.url
    });
    const requestBytes = createPlacementAdmissionSigningRequest({
      body: {
        attestation_challenge_base64url: encodeBase64Url(challenge),
        attestation_kind: policy.attestation_kind,
        failure_domain_id: policy.failure_domain_id,
        issued_at_ms: "1500",
        operator_root_id: policy.operator_root_id,
        roles: policy.roles,
        subject: subject.identity,
        valid_from_ms: "1200",
        valid_until_ms: "8000"
      },
      trust_root: issuer.trust_root
    });
    const bundle = await runPlacementAdmissionHttpCeremony({
      evaluated_at_ms: "2000",
      issuer: { authorization: issuer.token, url: issuer.url },
      request_bytes: requestBytes,
      subject: { authorization: subject.token, url: subject.url },
      timeout_ms: 10_000
    });
    return bundle.bytes;
  } finally {
    await Promise.all([issuer.stop(), subject.stop()]);
  }
}

async function custodyCapsule(authorities) {
  const custodians = authorities.map((authority) => authority.custodian)
    .sort((left, right) => left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const initial = createInitialState(new Uint8Array(16).fill(61));
  const genomeHash = stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES);
  const statePackage = createStatePackageTransitionPayload({
    genomeHash,
    inputBytes: canonicalBytes({
      format: "mortalos-state-package-input/1",
      operation: "replace-resource",
      transition_id: "membership-epoch-ceremony"
    }),
    priorStateRoot: stateRoot(initial),
    resourceBytes: new TextEncoder().encode("membership epoch custody quorum".repeat(32))
  });
  const genesisBody = {
    genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
    genome_hash: genomeHash,
    hash_algorithm: "sha-256",
    initial_custodians: custodians,
    initial_quorum: { threshold: 2, type: "threshold" },
    initial_state_base64url: encodeBase64Url(initial),
    initial_state_root: stateRoot(initial),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(62))}`,
    protocol_version: "mortalos/1",
    signature_algorithm: "ed25519"
  };
  const genesisMessage = genesisApprovalMessage(genesisBody);
  const genesisApprovals = await Promise.all(authorities.map((authority) => authority.sign({
    message: genesisMessage,
    tuple: "test.membership-epoch.genesis"
  })));
  genesisApprovals.sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const birth = {
    approvals: genesisApprovals,
    body: genesisBody,
    kind: "mortalos.genesis"
  };
  const lineage = createLineage(canonicalBytes(birth));
  assert.equal(lineage.status, "accept", JSON.stringify(lineage));
  const parent = lineage.lineage.head;
  const pulseBody = {
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    event: { kind: "state-transition", payload_hash: eventPayloadHash(statePackage.payload) },
    genome_hash: genomeHash,
    next_custodians: custodians,
    next_quorum: { threshold: 2, type: "threshold" },
    organism_id: lineage.lineage.genesis.organism_id,
    parent_hash: parent.object_hash,
    protocol_version: "mortalos/1",
    sequence: "1",
    state_root: statePackage.nextStateRoot
  };
  const pulseMessage = pulseApprovalMessage(pulseBody);
  const pulseApprovals = await Promise.all(authorities.map((authority) => authority.sign({
    message: pulseMessage,
    tuple: "test.membership-epoch.pulse-1"
  })));
  pulseApprovals.sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const pulse = {
    acceptances: [],
    approvals: pulseApprovals,
    body: pulseBody,
    kind: "mortalos.pulse"
  };
  const appended = lineage.lineage.append({
    envelopeBytes: canonicalBytes(pulse),
    eventPayloadBytes: canonicalBytes(statePackage.payload)
  });
  assert.equal(appended.status, "accept", JSON.stringify(appended));
  const capsule = createContinuityCapsule({
    records: [
      { envelope: birth, payload: {} },
      { envelope: pulse, payload: statePackage.payload }
    ],
    statePackage
  });
  return {
    bytes: capsule.bytes,
    organismId: capsule.organism_id
  };
}

function requestArguments({ bundlePaths, capsulePath, expiresAt, outputPath }) {
  const args = ["--capsule", capsulePath];
  for (const bundlePath of bundlePaths) args.push("--ceremony-bundle", bundlePath);
  args.push(
    "--evaluated-at-ms", "2000",
    "--expires-at-ms", expiresAt,
    "--observer-max-faulty", "0",
    "--observer-roster-size", "2",
    "--observer-threshold", "2",
    "--output", outputPath
  );
  return args;
}

test("ceremony bundles become one deterministic 2-of-3 custody-approved membership epoch", {
  timeout: 120_000
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-membership-epoch-ceremony-"));
  try {
    const authorityPaths = [0, 1, 2].map((index) =>
      join(directory, `custodian-${index}.json`));
    const authorities = await Promise.all(authorityPaths.map((path) =>
      loadNodeAuthority(path, { create: true })));
    const capsule = await custodyCapsule(authorities);
    const capsulePath = join(directory, "capsule.json");
    await writeFile(capsulePath, capsule.bytes);
    const bundleBytes = await Promise.all([
      admissionBundle({ label: "provider", organismId: capsule.organismId, roles: ["provider"] }),
      admissionBundle({ label: "observer-a", organismId: capsule.organismId, roles: ["observer"] }),
      admissionBundle({ label: "observer-b", organismId: capsule.organismId, roles: ["observer"] })
    ]);
    const bundlePaths = bundleBytes.map((bytes, index) => join(directory, `bundle-${index}.json`));
    await Promise.all(bundlePaths.map((path, index) => writeFile(path, bundleBytes[index])));

    const requestPath = join(directory, "request.json");
    const reorderedRequestPath = join(directory, "request-reordered.json");
    const request2Path = join(directory, "request-2.json");
    const created = await runNode(createRequestRunner, requestArguments({
      bundlePaths,
      capsulePath,
      expiresAt: "8000",
      outputPath: requestPath
    }));
    assert.equal(created.code, 0, created.stderr);
    const requestBytes = new Uint8Array(await readFile(requestPath));
    const request = restorePlacementMembershipEpochRequest({
      capsule_bytes: capsule.bytes,
      prior_epoch_bytes: null,
      request_bytes: requestBytes
    });
    assert.equal(request.custody_threshold, 2);
    assert.equal(request.custodian_key_ids.length, 3);
    assert.equal(request.body.admission_evidence_base64url.length, 3);
    const reordered = await runNode(createRequestRunner, requestArguments({
      bundlePaths: [...bundlePaths].reverse(),
      capsulePath,
      expiresAt: "8000",
      outputPath: reorderedRequestPath
    }));
    assert.equal(reordered.code, 0, reordered.stderr);
    assert.equal(equalBytes(
      requestBytes,
      new Uint8Array(await readFile(reorderedRequestPath))
    ), true);
    const requestCollision = await runNode(createRequestRunner, requestArguments({
      bundlePaths,
      capsulePath,
      expiresAt: "8000",
      outputPath: requestPath
    }));
    assert.notEqual(requestCollision.code, 0);
    assert.match(requestCollision.stderr, /E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_OUTPUT_EXISTS/u);

    const collisionApprovalPath = join(directory, "approval-collision.json");
    await writeFile(collisionApprovalPath, "immutable sentinel");
    const authorityBeforeCollision = await readFile(authorityPaths[0]);
    const approvalCollision = await runNode(approveRequestRunner, [
      "--authority", authorityPaths[0],
      "--capsule", capsulePath,
      "--request", requestPath,
      "--output", collisionApprovalPath
    ]);
    assert.notEqual(approvalCollision.code, 0);
    assert.match(approvalCollision.stderr, /E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_OUTPUT_EXISTS/u);
    assert.equal((await readFile(collisionApprovalPath, "utf8")), "immutable sentinel");
    assert.equal((await readFile(authorityPaths[0])).equals(authorityBeforeCollision), true);

    const outsiderPath = join(directory, "outsider.json");
    await loadNodeAuthority(outsiderPath, { create: true });
    const outsiderBefore = await readFile(outsiderPath);
    const outsiderApprovalPath = join(directory, "outsider-approval.json");
    const outsiderApproval = await runNode(approveRequestRunner, [
      "--authority", outsiderPath,
      "--capsule", capsulePath,
      "--request", requestPath,
      "--output", outsiderApprovalPath
    ]);
    assert.notEqual(outsiderApproval.code, 0);
    assert.match(outsiderApproval.stderr, /E_PLACEMENT_MEMBERSHIP_EPOCH_CLI_AUTHORITY/u);
    assert.equal(await absent(outsiderApprovalPath), true);
    assert.equal((await readFile(outsiderPath)).equals(outsiderBefore), true);

    const approval1Path = join(directory, "approval-1.json");
    const approval1RetryPath = join(directory, "approval-1-retry.json");
    const approval2Path = join(directory, "approval-2.json");
    for (const [authorityPath, outputPath] of [
      [authorityPaths[0], approval1Path],
      [authorityPaths[1], approval2Path],
      [authorityPaths[0], approval1RetryPath]
    ]) {
      const result = await runNode(approveRequestRunner, [
        "--authority", authorityPath,
        "--capsule", capsulePath,
        "--request", requestPath,
        "--output", outputPath
      ]);
      assert.equal(result.code, 0, result.stderr);
    }
    const approval1Bytes = new Uint8Array(await readFile(approval1Path));
    const approval2Bytes = new Uint8Array(await readFile(approval2Path));
    assert.equal(equalBytes(
      approval1Bytes,
      new Uint8Array(await readFile(approval1RetryPath))
    ), true);
    assert.equal(restorePlacementMembershipEpochApproval({
      approval_bytes: approval1Bytes,
      capsule_bytes: capsule.bytes,
      prior_epoch_bytes: null,
      request_bytes: requestBytes
    }).request_id, request.request_id);

    const insufficientPath = join(directory, "epoch-insufficient.json");
    const insufficient = await runNode(finalizeRequestRunner, [
      "--capsule", capsulePath,
      "--request", requestPath,
      "--approval", approval1Path,
      "--output", insufficientPath
    ]);
    assert.notEqual(insufficient.code, 0);
    assert.match(insufficient.stderr, /E_PLACEMENT_ADMISSION_QUORUM/u);
    assert.equal(await absent(insufficientPath), true);

    const epochPath = join(directory, "epoch.json");
    const epochReorderedPath = join(directory, "epoch-reordered.json");
    const finalized = await runNode(finalizeRequestRunner, [
      "--capsule", capsulePath,
      "--request", requestPath,
      "--approval", approval2Path,
      "--approval", approval1Path,
      "--output", epochPath
    ]);
    assert.equal(finalized.code, 0, finalized.stderr);
    const finalizedReordered = await runNode(finalizeRequestRunner, [
      "--capsule", capsulePath,
      "--request", requestPath,
      "--approval", approval1Path,
      "--approval", approval2Path,
      "--output", epochReorderedPath
    ]);
    assert.equal(finalizedReordered.code, 0, finalizedReordered.stderr);
    const epochBytes = new Uint8Array(await readFile(epochPath));
    assert.equal(equalBytes(
      epochBytes,
      new Uint8Array(await readFile(epochReorderedPath))
    ), true);
    const verified = verifyPlacementMembershipEpoch({
      capsule_bytes: capsule.bytes,
      epoch_bytes: epochBytes,
      prior_epoch_bytes: null
    });
    assert.equal(verified.status, "verified");
    assert.equal(verified.approvals.length, 2);
    assert.equal(verified.members.length, 3);

    const created2 = await runNode(createRequestRunner, requestArguments({
      bundlePaths,
      capsulePath,
      expiresAt: "7900",
      outputPath: request2Path
    }));
    assert.equal(created2.code, 0, created2.stderr);
    const approval3Request2Path = join(directory, "approval-3-request-2.json");
    const approval3Request2 = await runNode(approveRequestRunner, [
      "--authority", authorityPaths[2],
      "--capsule", capsulePath,
      "--request", request2Path,
      "--output", approval3Request2Path
    ]);
    assert.equal(approval3Request2.code, 0, approval3Request2.stderr);
    const mixedEpochPath = join(directory, "epoch-mixed.json");
    const mixed = await runNode(finalizeRequestRunner, [
      "--capsule", capsulePath,
      "--request", requestPath,
      "--approval", approval1Path,
      "--approval", approval3Request2Path,
      "--output", mixedEpochPath
    ]);
    assert.notEqual(mixed.code, 0);
    assert.match(mixed.stderr, /E_PLACEMENT_MEMBERSHIP_EPOCH_CEREMONY_BINDING/u);
    assert.equal(await absent(mixedEpochPath), true);

    const authorityBeforeConflict = await readFile(authorityPaths[0]);
    const conflictApprovalPath = join(directory, "approval-conflict.json");
    const conflict = await runNode(approveRequestRunner, [
      "--authority", authorityPaths[0],
      "--capsule", capsulePath,
      "--request", request2Path,
      "--output", conflictApprovalPath
    ]);
    assert.notEqual(conflict.code, 0);
    assert.match(conflict.stderr, /E_CONTINUITY_EQUIVOCATION/u);
    assert.equal(await absent(conflictApprovalPath), true);
    assert.equal((await readFile(authorityPaths[0])).equals(authorityBeforeConflict), true);

    const publicArtifacts = [requestBytes, approval1Bytes, approval2Bytes, epochBytes];
    for (const bytes of publicArtifacts) {
      assert.equal(/private|pkcs8|secret/iu.test(new TextDecoder().decode(bytes)), false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
