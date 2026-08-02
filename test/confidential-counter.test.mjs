import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase64Url } from "../src/bytes.mjs";
import {
  LinearizableCounterAuthority,
  MemoryCounterAuthorityStore,
  createCounterAuthorityFacade,
  detectCounterAuthorityEquivocation,
  deriveCounterAuthorityId,
  deriveConfidentialEpochId,
  generateCounterAuthorityKeyMaterial,
  isLinearizableCounterAuthority,
  observeCounterAuthorityEquivocation,
  reservationIvs,
  verifyCounterReservationReceipt
} from "../src/confidential/counter.mjs";
import { registerCounterAuthorityStoreInternal } from "../src/confidential/counter-authority-internal.mjs";
import {
  counterToIv,
  randomTagged
} from "../src/confidential/format.mjs";
import { createForkableCounterAuthorityPair } from "./confidential-helpers.mjs";

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
  const controlled = await createForkableCounterAuthorityPair();
  const store = controlled.leftStore;
  const authority = controlled.left;
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

  const capped = await createForkableCounterAuthorityPair();
  const capStore = capped.leftStore;
  const capAuthority = capped.left;
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

test("one store-bound signing key cannot issue conflicting same-prior successors", async () => {
  const store = new MemoryCounterAuthorityStore();
  const leftAuthority = await LinearizableCounterAuthority.create({ store });
  const rightAuthority = await LinearizableCounterAuthority.create({ store });
  const epochId = epochIdFor(leftAuthority);
  const request = {
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  };
  const attempts = await Promise.allSettled([
    leftAuthority.reserveRange(request),
    rightAuthority.reserveRange({ ...request, count: "2" })
  ]);
  const accepted = attempts.filter(({ status }) => status === "fulfilled");
  const rejected = attempts.filter(({ status }) => status === "rejected");
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason.code, /^E_CONFIDENTIAL_COUNTER_(STALE|AUTHORITY)$/u);
  const receipt = accepted[0].value.receipt;
  assert.doesNotThrow(() => verifyCounterReservationReceipt({ receipt }));
  assert.equal(
    detectCounterAuthorityEquivocation(receipt, receipt).status,
    "no_joint_equivocation"
  );
});

test("package-private stores retain one default authority identity and public facades preserve retirement semantics", async () => {
  let active = null;
  const store = {};
  registerCounterAuthorityStoreInternal(store, {
    inspect: async () => active === null ? null : structuredClone(active),
    loadAuthorityCapability: null,
    transact: async (_epochId, operation) => {
      const outcome = await operation(
        active === null ? null : structuredClone(active)
      );
      active = outcome.next === null ? null : structuredClone(outcome.next);
      return outcome.value;
    }
  });
  Object.freeze(store);

  const authority = await LinearizableCounterAuthority.create({ store });
  const sameStoreAuthority = await LinearizableCounterAuthority.create({ store });
  assert.deepEqual(sameStoreAuthority.descriptor, authority.descriptor);
  const epochId = epochIdFor(authority);
  let closes = 0;
  const keyPolicy = Object.freeze({ custody: "test-only-module-private" });
  const facade = createCounterAuthorityFacade({
    authority,
    close: () => { closes += 1; },
    keyPolicy
  });
  assert.equal(facade.keyPolicy, keyPolicy);
  assert.deepEqual(facade.descriptor, authority.descriptor);

  const reserved = await facade.reserveRange({
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  });
  assert.equal(reserved.basis.interval_start, "0");
  assert.equal((await facade.inspect(epochId)).next_counter, "1");
  assert.equal(await facade.retire(epochId), true);
  assert.equal((await facade.inspect(epochId)).retired, true);
  facade.close();
  assert.equal(closes, 1);
  await assert.rejects(
    facade.reserveRange({
      count: "1",
      epoch: "0",
      epochId,
      expectedNextCounter: "1",
      expectedPriorReceiptDigest: reserved.digest
    }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );

  assert.throws(
    () => createCounterAuthorityFacade({ authority, close: null }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  await assert.rejects(
    LinearizableCounterAuthority.create({ store: Object.freeze({}) }),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.throws(
    () => deriveCounterAuthorityId(`ed25519:${encodeBase64Url(new Uint8Array(32))}`),
    /E_CONFIDENTIAL_COUNTER_RECEIPT/u
  );
});

test("counter authority ignores store own and prototype method replacement before and after construction", async () => {
  const originalInspect = MemoryCounterAuthorityStore.prototype.inspect;
  const originalTransact = MemoryCounterAuthorityStore.prototype.transact;
  let authorityFromMutatedPrototype;
  MemoryCounterAuthorityStore.prototype.inspect = async () => {
    throw new Error("spoofed prototype loss");
  };
  MemoryCounterAuthorityStore.prototype.transact = async () => {
    throw new Error("spoofed prototype transaction");
  };
  try {
    const store = new MemoryCounterAuthorityStore();
    authorityFromMutatedPrototype =
      await LinearizableCounterAuthority.create({ store });
    const epochId = epochIdFor(authorityFromMutatedPrototype);
    const reserved = await authorityFromMutatedPrototype.reserveRange({
      count: "1",
      epoch: "0",
      epochId,
      expectedNextCounter: "0",
      expectedPriorReceiptDigest: null
    });
    assert.equal(reserved.basis.interval_start, "0");
    assert.equal(
      (await authorityFromMutatedPrototype.inspect(epochId)).next_counter,
      "1"
    );
  } finally {
    MemoryCounterAuthorityStore.prototype.inspect = originalInspect;
    MemoryCounterAuthorityStore.prototype.transact = originalTransact;
  }

  const store = new MemoryCounterAuthorityStore();
  const authority = await LinearizableCounterAuthority.create({ store });
  const epochId = epochIdFor(authority);
  const initialRequest = {
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  };
  await authority.reserveRange(initialRequest);
  let ownReplacementAccepted = false;
  try {
    Object.defineProperties(store, {
      inspect: {
        configurable: true,
        value: async () => ({ retired: true })
      },
      transact: {
        configurable: true,
        value: async () => ({ value: "spoofed" })
      }
    });
    ownReplacementAccepted = true;
  } catch (error) {
    assert.ok(error instanceof TypeError);
  }

  if (ownReplacementAccepted) {
    delete store.inspect;
    delete store.transact;
  }
  const actual = await originalInspect.call(store, epochId);
  assert.equal(actual.next_counter, "1");
});

test("epoch identity, authority construction, reservation surfaces, and receipt fields fail closed independently", async () => {
  const material = await generateCounterAuthorityKeyMaterial();
  assert.equal(Object.hasOwn(material, "privateKey"), false);
  assert.doesNotMatch(JSON.stringify(material), /private[_-]?key|CryptoKey/u);
  const authority = await LinearizableCounterAuthority.create({
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
    () => new SpoofedCounterAuthority(null, {}),
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
    () => new LinearizableCounterAuthority(null, {}),
    /E_CONFIDENTIAL_COUNTER_AUTHORITY/u
  );
  assert.throws(
    () => new LinearizableCounterAuthority(null, { privateKey: null }),
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
  assert.equal(invalidStore.transact, undefined);
  assert.equal(invalidStore.lose, undefined);
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
