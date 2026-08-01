import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LinearizableCounterAuthority,
  deriveConfidentialEpochId,
  generateCounterAuthorityKeyMaterial
} from "../src/confidential/counter.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import {
  QuorumCounterAuthorityStore,
  assertIndependentTopology
} from "../src/distributed/quorum-counter-store.mjs";
import { HttpCounterReplica } from "../lab/distributed/http-counter-replica.mjs";

const root = await mkdtemp(join(tmpdir(), "mortalos-counter-topology-"));
const children = [];

function startReplica(index) {
  const token = `counter-replica-${index}-test-token`;
  const child = spawn(process.execPath, ["lab/distributed/counter-replica-service.mjs"], {
    env: {
      ...process.env,
      MORTALOS_COUNTER_REPLICA_DATA_FILE: join(root, `replica-${index}.json`),
      MORTALOS_COUNTER_REPLICA_PORT: "0",
      MORTALOS_COUNTER_REPLICA_TOKEN: token
    },
    stdio: ["ignore", "pipe", "inherit"]
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error(`replica ${index} start timeout`)), 10_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timeout);
      const ready = JSON.parse(buffer.slice(0, newline));
      resolve({
        child,
        client: new HttpCounterReplica({
          baseUrl: ready.url,
          bearerToken: token,
          failureDomain: `process-${index}`
        })
      });
    });
  });
}

async function stopReplica(replica) {
  if (replica.child.exitCode !== null) return;
  const exited = new Promise((resolve) => replica.child.once("exit", resolve));
  replica.child.kill("SIGTERM");
  await exited;
}

try {
  const replicas = await Promise.all([0, 1, 2].map(startReplica));
  const topology = assertIndependentTopology({
    format: "mortalos-independent-topology/1",
    nodes: [0, 1, 2].map((index) => ({
      admin_domain: `test-operator-${index}`,
      credential_domain: `test-token-${index}`,
      host_domain: `node-process-${index}`,
      node_id: `counter-${index}`,
      provider: `test-provider-${index}`
    }))
  });
  assert.equal(topology.nodes.length, 3);
  const material = await generateCounterAuthorityKeyMaterial();
  const epochId = deriveConfidentialEpochId({
    authorityId: material.authorityId,
    authorityPublicKey: material.authorityPublicKey,
    custodianEncryptionKeys: [randomTagged("sha256:")],
    epoch: "8",
    membershipHead: randomTagged("sha256:"),
    organismId: randomTagged("mortalos:"),
    transitionId: "process-isolated-counter"
  });
  const makeAuthority = (clients) => new LinearizableCounterAuthority({
    authorityId: material.authorityId,
    authorityPublicKey: material.authorityPublicKey,
    privateKey: material.privateKey,
    store: new QuorumCounterAuthorityStore({ replicas: clients })
  });
  let clients = replicas.map(({ client }) => client);
  let left = makeAuthority(clients);
  let right = makeAuthority(clients);
  let current = null;
  for (let round = 0; round < 18; round += 1) {
    current = await left.inspect(epochId);
    const request = {
      count: "1",
      epoch: "8",
      epochId,
      expectedNextCounter: current?.next_counter ?? "0",
      expectedPriorReceiptDigest: current?.last_counter_receipt_digest ?? null
    };
    const attempts = await Promise.allSettled([
      left.reserveRange(request),
      right.reserveRange({ ...request, count: "2" })
    ]);
    assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1);
  }
  const beforeFailure = await left.inspect(epochId);
  const expectedAfterFailure = String(BigInt(beforeFailure.next_counter) + 6n);

  await stopReplica(replicas[0]);
  clients = [replicas[1].client, replicas[2].client, replicas[0].client];
  left = makeAuthority(clients);
  for (let round = 0; round < 6; round += 1) {
    current = await left.inspect(epochId);
    await left.reserveRange({
      count: "1",
      epoch: "8",
      epochId,
      expectedNextCounter: current.next_counter,
      expectedPriorReceiptDigest: current.last_counter_receipt_digest
    });
  }

  const restarted = await startReplica(0);
  clients = [restarted.client, replicas[1].client, replicas[2].client];
  left = makeAuthority(clients);
  current = await left.inspect(epochId);
  assert.equal(current.next_counter, expectedAfterFailure);
  const afterRepair = await restarted.client.snapshot(epochId);
  assert.equal(afterRepair.data.next_counter, expectedAfterFailure);
  console.log("MortalOS S7 process-isolated HTTP quorum: PASS");
  console.log("- two concurrent coordinators: one CAS winner per revision");
  console.log("- one replica terminated: quorum reservations continued");
  console.log("- replica disk state restarted and repaired from quorum truth");
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
