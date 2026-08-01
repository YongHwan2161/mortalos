import assert from "node:assert/strict";
import test from "node:test";
import {
  LinearizableCounterAuthority,
  deriveConfidentialEpochId,
  verifyCounterReservationReceipt
} from "../src/confidential/counter.mjs";
import { randomTagged } from "../src/confidential/format.mjs";
import {
  MemoryCounterReplica,
  QuorumCounterAuthorityStore,
  assertIndependentTopology
} from "../src/distributed/quorum-counter-store.mjs";

function topology() {
  return {
    format: "mortalos-independent-topology/1",
    nodes: [
      {
        admin_domain: "operator-a",
        credential_domain: "vault-a",
        host_domain: "host-a",
        node_id: "counter-a",
        provider: "provider-a"
      },
      {
        admin_domain: "operator-b",
        credential_domain: "vault-b",
        host_domain: "host-b",
        node_id: "counter-b",
        provider: "provider-b"
      },
      {
        admin_domain: "operator-c",
        credential_domain: "vault-c",
        host_domain: "host-c",
        node_id: "counter-c",
        provider: "provider-c"
      }
    ]
  };
}

function epochIdFor(authority) {
  return deriveConfidentialEpochId({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key,
    custodianEncryptionKeys: [randomTagged("sha256:")],
    epoch: "7",
    membershipHead: randomTagged("sha256:"),
    organismId: randomTagged("mortalos:"),
    transitionId: "distributed-counter"
  });
}

test("S7 majority counter store has one winner across coordinators, partitions, repair, and restart", async () => {
  const replicas = ["a", "b", "c"].map(
    (failureDomain) => new MemoryCounterReplica({ failureDomain })
  );
  const store = new QuorumCounterAuthorityStore({ replicas });
  let left = await LinearizableCounterAuthority.create({ store });
  let right = await LinearizableCounterAuthority.create({ store });
  const epochId = epochIdFor(left);
  const intervals = [];

  for (let round = 0; round < 96; round += 1) {
    const current = await left.inspect(epochId);
    const input = {
      count: String((round % 3) + 1),
      epoch: "7",
      epochId,
      expectedNextCounter: current?.next_counter ?? "0",
      expectedPriorReceiptDigest:
        current?.last_counter_receipt_digest ?? null
    };
    const attempts = await Promise.allSettled([
      left.reserveRange(input),
      right.reserveRange({ ...input, count: String((round % 5) + 1) })
    ]);
    const accepted = attempts.filter(({ status }) => status === "fulfilled");
    const rejected = attempts.filter(({ status }) => status === "rejected");
    assert.equal(accepted.length, 1, `round ${round} must have one winner`);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.code, /^E_CONFIDENTIAL_COUNTER_(STALE|AUTHORITY)$/u);
    const winner = accepted[0].value;
    const verified = verifyCounterReservationReceipt({
      expectedEpochId: epochId,
      expectedPriorNextCounter: input.expectedNextCounter,
      expectedPriorReceiptDigest: input.expectedPriorReceiptDigest,
      receipt: winner.receipt
    });
    intervals.push([verified.intervalStart, verified.intervalEndExclusive]);

    if (round % 8 === 2) replicas[round % replicas.length].setOnline(false);
    if (round % 8 === 3) replicas.forEach((replica) => replica.restart());
    if (round % 12 === 5) {
      left = await LinearizableCounterAuthority.create({ store });
      right = await LinearizableCounterAuthority.create({ store });
    }
  }

  intervals.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (let index = 1; index < intervals.length; index += 1) {
    assert.ok(intervals[index - 1][1] <= intervals[index][0]);
  }
  replicas.forEach((replica) => replica.restart());
  const final = await left.inspect(epochId);
  assert.equal(final.next_counter, String(intervals.at(-1)[1]));
  const snapshots = replicas.map((replica) => replica.snapshot(epochId));
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
});

test("S7 store fails closed below quorum and validates independent administrative topology", async () => {
  const replicas = ["a", "b", "c"].map(
    (failureDomain) => new MemoryCounterReplica({ failureDomain })
  );
  const authorityInstance = await LinearizableCounterAuthority.create({
    store: new QuorumCounterAuthorityStore({ replicas })
  });
  replicas[1].setOnline(false);
  replicas[2].setOnline(false);
  await assert.rejects(
    authorityInstance.inspect(randomTagged("sha256:")),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );

  const accepted = assertIndependentTopology(topology());
  assert.equal(accepted.nodes.length, 3);
  const duplicate = structuredClone(topology());
  duplicate.nodes[2].credential_domain = duplicate.nodes[1].credential_domain;
  assert.throws(() => assertIndependentTopology(duplicate), /independent/u);
});

test("S7 stale repair cannot roll back a newer quorum revision", async () => {
  let repairEntered;
  const entered = new Promise((resolve) => { repairEntered = resolve; });
  let releaseRepair;
  const released = new Promise((resolve) => { releaseRepair = resolve; });
  let delay = true;
  const replicas = [
    new MemoryCounterReplica({
      failureDomain: "a",
      async fault(boundary, _epochId, candidate) {
        if (boundary === "repair:before" && candidate?.revision === 0 && delay) {
          repairEntered();
          await released;
        }
      }
    }),
    new MemoryCounterReplica({ failureDomain: "b" }),
    new MemoryCounterReplica({ failureDomain: "c" })
  ];
  const slow = await LinearizableCounterAuthority.create({
    store: new QuorumCounterAuthorityStore({ replicas })
  });
  const fast = await LinearizableCounterAuthority.create({
    store: new QuorumCounterAuthorityStore({ replicas })
  });
  const epochId = epochIdFor(slow);
  const first = slow.reserveRange({
    count: "1",
    epoch: "7",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  });
  await entered;
  const committed = await fast.inspect(epochId);
  const second = await fast.reserveRange({
    count: "1",
    epoch: "7",
    epochId,
    expectedNextCounter: committed.next_counter,
    expectedPriorReceiptDigest: committed.last_counter_receipt_digest
  });
  delay = false;
  releaseRepair();
  const initial = await first;
  assert.equal(initial.basis.interval_end_exclusive, "1");
  assert.equal(second.basis.interval_start, "1");
  assert.equal((await fast.inspect(epochId)).next_counter, "2");
  assert.ok(replicas.every((replica) => replica.snapshot(epochId).data.next_counter === "2"));
});
