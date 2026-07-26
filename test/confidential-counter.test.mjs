import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase64Url } from "../src/bytes.mjs";
import {
  LinearizableCounterAuthority,
  MemoryCounterAuthorityStore,
  createCounterAuthorityFacade,
  detectCounterAuthorityEquivocation,
  deriveConfidentialEpochId,
  generateCounterAuthorityKeyMaterial,
  isLinearizableCounterAuthority,
  observeCounterAuthorityEquivocation,
  reservationIvs,
  verifyCounterReservationReceipt
} from "../src/confidential/counter.mjs";
import {
  counterToIv,
  randomTagged
} from "../src/confidential/format.mjs";

function epochIdFor(authority, epoch = "0") {
  return deriveConfidentialEpochId({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key,
    custodianEncryptionKeys: [randomTagged("sha256:")],
    epoch,
    membershipHead: randomTagged("sha256:"),
    organismId: randomTagged("mortalos:"),
    transitionId: "counter-test"
  });
}

test("linearizable CAS emits one successor and rejects every stale writer before reuse", async () => {
  const authority = await LinearizableCounterAuthority.create();
  const epochId = epochIdFor(authority);
  const attempts = await Promise.allSettled(
    Array.from({ length: 32 }, () =>
      authority.reserveRange({
        count: "1",
        epoch: "0",
        epochId,
        expectedNextCounter: "0",
        expectedPriorReceiptDigest: null
      })
    )
  );
  const accepted = attempts.filter(({ status }) => status === "fulfilled");
  const rejected = attempts.filter(({ status }) => status === "rejected");
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 31);
  assert.ok(
    rejected.every(({ reason }) => reason.code === "E_CONFIDENTIAL_COUNTER_STALE")
  );
  const verified = verifyCounterReservationReceipt({
    expectedEpochId: epochId,
    expectedPriorNextCounter: "0",
    expectedPriorReceiptDigest: null,
    receipt: accepted[0].value.receipt
  });
  assert.equal(verified.basis.interval_start, "0");
  assert.equal(verified.basis.interval_end_exclusive, "1");
  assert.equal(reservationIvs(verified.receipt).length, 1);
});

test(
  "one million allocations from concurrent endpoint loops have zero IV duplication",
  {
    skip:
      process.env.MORTALOS_SKIP_S4_MILLION_IV === "1"
        ? "the coverage subprocess runs the same allocator through bounded cases"
        : false
  },
  async () => {
  const authority = await LinearizableCounterAuthority.create();
  const epochId = epochIdFor(authority);
  const reservations = 1_000_000 / 64;
  let nextJob = 0;
  const ivs = new Set();
  let staleConflicts = 0;

  async function writer() {
    while (true) {
      const job = nextJob;
      nextJob += 1;
      if (job >= reservations) return;
      while (true) {
        const active = await authority.inspect(epochId);
        try {
          const reserved = await authority.reserveRange({
            count: "64",
            epoch: "0",
            epochId,
            expectedNextCounter: active?.next_counter ?? "0",
            expectedPriorReceiptDigest:
              active?.last_counter_receipt_digest ?? null
          });
          for (
            let counter = reserved.intervalStart;
            counter < reserved.intervalEndExclusive;
            counter += 1n
          ) {
            const iv = counterToIv(counter);
            const encoded = encodeBase64Url(iv);
            assert.equal(ivs.has(encoded), false);
            ivs.add(encoded);
          }
          break;
        } catch (error) {
          if (error.code !== "E_CONFIDENTIAL_COUNTER_STALE") throw error;
          staleConflicts += 1;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: 16 }, () => writer()));
  const active = await authority.inspect(epochId);
  assert.equal(active.next_counter, "1000000");
  assert.equal(ivs.size, 1_000_000);
  assert.ok(staleConflicts > 0);
  }
);

test("lost authority state, cap overflow, receipt mutation, and rollback fail closed", async () => {
  const store = new MemoryCounterAuthorityStore();
  const authority = await LinearizableCounterAuthority.create({ store });
  const epochId = epochIdFor(authority);
  const first = await authority.reserveRange({
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  });
  const changed = structuredClone(first.receipt);
  changed.basis.next_counter = "2";
  assert.throws(
    () => verifyCounterReservationReceipt({ receipt: changed }),
    /E_CONFIDENTIAL_COUNTER_RECEIPT/u
  );
  await assert.rejects(
    authority.reserveRange({
      count: "1",
      epoch: "0",
      epochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null
    }),
    /E_CONFIDENTIAL_COUNTER_STALE/u
  );
  await store.lose(epochId);
  await assert.rejects(
    authority.reserveRange({
      count: "1",
      epoch: "0",
      epochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );

  const capStore = new MemoryCounterAuthorityStore();
  const capAuthority = await LinearizableCounterAuthority.create({
    store: capStore
  });
  const capEpochId = epochIdFor(capAuthority);
  await capStore.transact(capEpochId, async () => ({
    next: {
      epoch: "0",
      epoch_id: capEpochId,
      last_counter_receipt_digest: randomTagged("sha256:"),
      next_counter: "4294967295",
      retired: false
    },
    value: true
  }));
  const capActive = await capAuthority.inspect(capEpochId);
  await assert.rejects(
    capAuthority.reserveRange({
      count: "2",
      epoch: "0",
      epochId: capEpochId,
      expectedNextCounter: capActive.next_counter,
      expectedPriorReceiptDigest: capActive.last_counter_receipt_digest
    }),
    /E_CONFIDENTIAL_COUNTER_EXHAUSTED/u
  );
});

test("jointly observed valid successors expose authority equivocation; either alone remains valid", async () => {
  const material = await generateCounterAuthorityKeyMaterial();
  const leftAuthority = new LinearizableCounterAuthority({
    ...material,
    store: new MemoryCounterAuthorityStore()
  });
  const rightAuthority = new LinearizableCounterAuthority({
    ...material,
    store: new MemoryCounterAuthorityStore()
  });
  const epochId = epochIdFor(leftAuthority);
  const request = {
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  };
  const [left, right] = await Promise.all([
    leftAuthority.reserveRange(request),
    rightAuthority.reserveRange({ ...request, count: "2" })
  ]);
  assert.doesNotThrow(() =>
    verifyCounterReservationReceipt({ receipt: left.receipt })
  );
  assert.doesNotThrow(() =>
    verifyCounterReservationReceipt({ receipt: right.receipt })
  );
  assert.equal(
    detectCounterAuthorityEquivocation(left.receipt, right.receipt).status,
    "counter_authority_equivocation"
  );
  await assert.rejects(
    observeCounterAuthorityEquivocation({
      authority: {
        descriptor: leftAuthority.descriptor,
        inspect: async () => ({ retired: true }),
        retire: async () => true
      },
      left: left.receipt,
      right: right.receipt
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  const originalInspect = LinearizableCounterAuthority.prototype.inspect;
  const originalRetire = LinearizableCounterAuthority.prototype.retire;
  LinearizableCounterAuthority.prototype.inspect = async () => ({
    retired: false
  });
  LinearizableCounterAuthority.prototype.retire = async () => true;
  let observed;
  try {
    observed = await observeCounterAuthorityEquivocation({
      authority: leftAuthority,
      left: left.receipt,
      right: right.receipt
    });
  } finally {
    LinearizableCounterAuthority.prototype.inspect = originalInspect;
    LinearizableCounterAuthority.prototype.retire = originalRetire;
  }
  assert.equal(observed.status, "counter_authority_equivocation");
  assert.equal((await leftAuthority.inspect(epochId)).retired, true);
  await assert.rejects(
    leftAuthority.reserveRange({
      ...request,
      expectedNextCounter: left.basis.next_counter,
      expectedPriorReceiptDigest: left.digest
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.equal(
    detectCounterAuthorityEquivocation(left.receipt, left.receipt).status,
    "no_joint_equivocation"
  );
});

test("epoch identity, authority construction, reservation surfaces, and receipt fields fail closed independently", async () => {
  const material = await generateCounterAuthorityKeyMaterial();
  const authority = new LinearizableCounterAuthority({
    ...material,
    store: new MemoryCounterAuthorityStore()
  });
  const epochId = epochIdFor(authority);
  const accepted = await authority.reserveRange({
    count: "2",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  });
  class SpoofedCounterAuthority extends LinearizableCounterAuthority {}
  assert.throws(
    () =>
      new SpoofedCounterAuthority({
        ...material,
        store: new MemoryCounterAuthorityStore()
      }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.equal(
    isLinearizableCounterAuthority(
      Object.create(LinearizableCounterAuthority.prototype)
    ),
    false
  );
  assert.equal(isLinearizableCounterAuthority(new Proxy(authority, {})), false);
  assert.throws(
    () =>
      Object.defineProperty(authority, "inspect", {
        value: async () => {
          throw new Error("spoofed loss");
        }
      }),
    TypeError
  );
  const facade = createCounterAuthorityFacade({ authority });
  assert.equal(isLinearizableCounterAuthority(facade), true);
  assert.deepEqual(facade.descriptor, authority.descriptor);

  assert.throws(
    () =>
      new LinearizableCounterAuthority({
        ...material,
        authorityId: randomTagged("sha256:"),
        store: new MemoryCounterAuthorityStore()
      }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.throws(
    () =>
      new LinearizableCounterAuthority({
        ...material,
        privateKey: null,
        store: new MemoryCounterAuthorityStore()
      }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.throws(
    () =>
      deriveConfidentialEpochId({
        authorityId: randomTagged("sha256:"),
        authorityPublicKey: material.authorityPublicKey,
        custodianEncryptionKeys: [randomTagged("sha256:")],
        epoch: "0",
        membershipHead: randomTagged("sha256:"),
        organismId: randomTagged("mortalos:"),
        transitionId: "x"
      }),
    /E_CONFIDENTIAL_EPOCH/u
  );
  for (const custodianEncryptionKeys of [
    [],
    null,
    [randomTagged("sha256:"), randomTagged("sha256:")].sort().reverse(),
    (() => {
      const value = randomTagged("sha256:");
      return [value, value];
    })()
  ]) {
    assert.throws(
      () =>
        deriveConfidentialEpochId({
          authorityId: material.authorityId,
          authorityPublicKey: material.authorityPublicKey,
          custodianEncryptionKeys,
          epoch: "0",
          membershipHead: randomTagged("sha256:"),
          organismId: randomTagged("mortalos:"),
          transitionId: "x"
        }),
      /E_CONFIDENTIAL_EPOCH/u
    );
  }
  assert.throws(
    () =>
      deriveConfidentialEpochId({
        authorityId: material.authorityId,
        authorityPublicKey: material.authorityPublicKey,
        custodianEncryptionKeys: [randomTagged("sha256:")],
        epoch: "0",
        membershipHead: randomTagged("sha256:"),
        organismId: "mortalos:bad",
        transitionId: ""
      }),
    /E_CONFIDENTIAL_EPOCH/u
  );

  await assert.rejects(
    authority.reserveRange({
      count: "1",
      epoch: "0",
      epochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: randomTagged("sha256:")
    }),
    /E_CONFIDENTIAL_COUNTER_STALE/u
  );
  const invalidStore = new MemoryCounterAuthorityStore();
  await assert.rejects(
    invalidStore.transact(epochId, async () => ({ value: true })),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  await assert.rejects(
    authority.retire(randomTagged("sha256:")),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );

  const mutations = [
    ["format", "mortalos-counter-reservation-receipt/2"],
    ["basis.format", "mortalos-counter-reservation-basis/2"],
    ["basis.suite", "mortalos-confidential-state-suite/2"],
    ["basis.epoch_id", randomTagged("sha256:")],
    ["basis.authority_id", randomTagged("sha256:")],
    ["basis.request_id", "reservation:bad"],
    ["basis.count", "0"],
    ["basis.interval_start", "1"],
    ["basis.prior_receipt_digest", randomTagged("sha256:")],
    ["signature", `ed25519:${"A".repeat(86)}`]
  ];
  for (const [path, replacement] of mutations) {
    const changed = structuredClone(accepted.receipt);
    const segments = path.split(".");
    let target = changed;
    for (const segment of segments.slice(0, -1)) target = target[segment];
    target[segments.at(-1)] = replacement;
    assert.throws(
      () =>
        verifyCounterReservationReceipt({
          expectedEpochId: epochId,
          receipt: changed
        }),
      /E_CONFIDENTIAL_/u,
      path
    );
  }
  assert.throws(
    () =>
      verifyCounterReservationReceipt({
        expectedPriorNextCounter: "1",
        receipt: accepted.receipt
      }),
    /E_CONFIDENTIAL_COUNTER_STALE/u
  );
  assert.throws(
    () =>
      verifyCounterReservationReceipt({
        expectedPriorReceiptDigest: randomTagged("sha256:"),
        receipt: accepted.receipt
      }),
    /E_CONFIDENTIAL_COUNTER_STALE/u
  );
});
