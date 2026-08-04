import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  handoffContinuity,
  recoverContinuity,
  PROVIDER_TOPOLOGY_FORMAT,
  recoverContinuityProviderQuorum,
  storeContinuityCopiesWithProviders
} from "../sdk/continuity.mjs";
import { encodeBase64Url } from "../src/bytes.mjs";
import { HttpPossessionProvider } from "../lab/distributed/http-possession-provider.mjs";

const root = await mkdtemp(join(tmpdir(), "mortalos-provider-topology-"));
const children = [];

function identityBasis(index) {
  return Object.freeze({
    account_domain: `isolated-account-${index}`,
    admin_domain: `isolated-admin-${index}`,
    credential_domain: `isolated-credential-${index}`,
    failure_domain: `isolated-process-${index}`,
    provider_id: `logical-provider-${index}`,
    provider_kind: `isolated-provider-${index}`,
    region: ["eu-west", "us-east", "apac-northeast"][index - 1]
  });
}

function startProvider(index) {
  const token = `possession-provider-${index}-test-token`;
  const seed = new Uint8Array(32).fill(index);
  const child = spawn(process.execPath, ["lab/distributed/possession-provider-service.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      MORTALOS_PROVIDER_DATA_DIRECTORY: join(root, `provider-${index}`),
      MORTALOS_PROVIDER_IDENTITY: JSON.stringify(identityBasis(index)),
      MORTALOS_PROVIDER_PORT: "0",
      MORTALOS_PROVIDER_SIGNING_SEED: encodeBase64Url(seed),
      MORTALOS_PROVIDER_TOKEN: token
    },
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error(`provider ${index} start timeout`)), 15_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timeout);
      const ready = JSON.parse(buffer.slice(0, newline));
      resolve({
        child,
        client: new HttpPossessionProvider({
          baseUrl: ready.url,
          bearerToken: token,
          identity: ready.identity
        }),
        identity: ready.identity
      });
    });
  });
}

async function stopProvider(provider) {
  if (provider.child.exitCode !== null || provider.child.signalCode !== null) return;
  const exited = new Promise((resolve) => provider.child.once("exit", resolve));
  provider.child.kill("SIGTERM");
  await exited;
  assert.ok(
    provider.child.exitCode !== null || provider.child.signalCode !== null,
    "terminated provider process must exit"
  );
}

async function transferred() {
  const resourceBytes = new TextEncoder().encode("actual provider process failure recovery");
  const authorityA = await createContinuityAuthority();
  const authorityB = await createContinuityAuthority();
  const created = await createContinuity({
    authority: authorityA,
    resourceBytes,
    transitionId: "provider-process-create"
  });
  const request = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "request"
  });
  const proposal = await handoffContinuity({
    authority: authorityA,
    capsuleBytes: created.capsule_bytes,
    phase: "propose",
    request
  });
  const handed = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "accept",
    proposal
  });
  return { authorityA, authorityB, created, handed, resourceBytes };
}

try {
  let providers = await Promise.all([1, 2, 3].map(startProvider));
  const topology = Object.freeze({
    format: PROVIDER_TOPOLOGY_FORMAT,
    providers: Object.freeze(providers.map(({ identity }) => identity))
  });
  const fixture = await transferred();
  const stored = await storeContinuityCopiesWithProviders({
    copies: fixture.handed.copies,
    providers: providers.map(({ client }) => client),
    topology
  });

  const firstFailedPid = providers[0].child.pid;
  await stopProvider(providers[0]);
  fixture.authorityA.destroy();
  const firstRecovery = await recoverContinuityProviderQuorum({
    providers: providers.map(({ client }) => client),
    quorum: 2,
    receipts: stored.receipts,
    topology
  });
  assert.equal(firstRecovery.valid_copies, 2);
  assert.equal(firstRecovery.rejected_providers[0].provider_id, "logical-provider-1");
  const recovered = recoverContinuity({
    authority: fixture.authorityB,
    copies: firstRecovery.provider_copies,
    expectedHeadHash: fixture.handed.head_hash,
    expectedOrganismId: fixture.handed.organism_id,
    quorum: 2
  });
  assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
  const continued = await continueContinuity({
    authority: fixture.authorityB,
    capsuleBytes: recovered.capsule_bytes,
    expectedHeadHash: recovered.head_hash,
    resourceBytes: recovered.resource_bytes,
    transitionId: "provider-process-continue"
  });
  assert.equal(continued.sequence, "3");

  await rm(join(root, "provider-1", "objects"), { force: true, recursive: true });
  const repairedProvider = await startProvider(1);
  providers = [repairedProvider, providers[1], providers[2]];
  const repaired = await storeContinuityCopiesWithProviders({
    copies: fixture.handed.copies,
    providers: providers.map(({ client }) => client),
    topology
  });
  await stopProvider(providers[1]);
  const repairRecovery = await recoverContinuityProviderQuorum({
    providers: providers.map(({ client }) => client),
    quorum: 2,
    receipts: repaired.receipts,
    topology
  });
  assert.equal(repairRecovery.valid_copies, 2);
  assert.ok(repairRecovery.accepted_provider_receipts.some((receipt) =>
    new TextDecoder().decode(receipt).includes("logical-provider-1")));
  assert.deepEqual(
    recoverContinuity({
      authority: fixture.authorityB,
    copies: repairRecovery.provider_copies,
      expectedHeadHash: fixture.handed.head_hash,
      expectedOrganismId: fixture.handed.organism_id,
      quorum: 2
    }).resource_bytes,
    fixture.resourceBytes
  );

  console.log("MortalOS provider-signed possession topology: PASS");
  console.log(`- provider process ${firstFailedPid} terminated; two surviving signed providers restored exact bytes`);
  console.log("- failed provider storage was removed, restarted with the same provider key, and repaired by verified rewrite/readback");
  console.log("- a second provider process then terminated; repaired provider plus third provider still formed quorum");
  console.log("- account/admin/credential/region labels are cryptographically bound topology declarations, not third-party account ownership proof");
} finally {
  await Promise.all(children.map((child) => {
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  }));
  await rm(root, { force: true, recursive: true });
}
