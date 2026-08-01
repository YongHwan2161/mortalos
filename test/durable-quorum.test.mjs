import assert from "node:assert/strict";
import test from "node:test";
import {
  DurableQuorumEndpoint
} from "../lab/participant/durable-quorum-endpoint.mjs";
import {
  MemoryDurableStore
} from "../lab/storage/memory-durable-store.mjs";
import {
  assertDurableDocumentStructure,
  createAuthorityPolicy,
  createKeyReadyDocument,
  migrateLegacyDurableSnapshot,
  replayDurableDocument
} from "../lab/storage/durable-document.mjs";
import {
  createStoredWebCryptoKey
} from "../lab/participant/webcrypto-key-store.mjs";
function seed(value) {
  return new Uint8Array(16).fill(value);
}

function publicCustodians(endpoints) {
  return endpoints.map((endpoint) => endpoint.custodian).sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
}

async function createEndpoint(id, store = new MemoryDurableStore()) {
  const endpoint = new DurableQuorumEndpoint({
    endpointId: id,
    store,
    clock: () => 1_800_000_000_000
  });
  await endpoint.initializeKey();
  return { endpoint, store };
}

async function createCluster(offset = 0) {
  const nodes = await Promise.all(["A", "B", "C"].map((id) =>
    createEndpoint(`${id}${offset}`)));
  const endpoints = nodes.map((entry) => entry.endpoint);
  const body = endpoints[0].createGenesisBody({
    custodians: publicCustodians(endpoints),
    initialStateSeed: seed(10 + offset),
    nonceSeed: seed(20 + offset),
    threshold: 2
  });
  const approvals = [];
  for (const endpoint of endpoints) approvals.push(await endpoint.approveGenesis(body));
  for (const endpoint of endpoints) await endpoint.commissionGenesis(body, approvals);
  return { body, endpoints, nodes };
}

async function commitState(endpoints, signers = endpoints.slice(0, 2), steps = 1) {
  const proposal = endpoints[0].createStateProposal(steps);
  const approvals = [];
  for (const signer of signers) approvals.push(await signer.approveProposal(proposal));
  let record;
  for (const endpoint of endpoints) {
    record = await endpoint.commitProposal(proposal, approvals);
  }
  return record;
}

test("durable 2-of-3 commission, cold restart, transition, and exact replay", async () => {
  const { endpoints, nodes } = await createCluster();
  const organismId = endpoints[0].publicState.organism_id;
  assert.equal(new Set(endpoints.map((entry) => entry.publicState.head_hash)).size, 1);
  await commitState(endpoints, endpoints.slice(0, 2), 3);
  assert.deepEqual(endpoints.map((entry) => entry.publicState.sequence), ["1", "1", "1"]);
  assert.deepEqual(endpoints.map((entry) => entry.publicState.organism_id), [organismId, organismId, organismId]);

  const restarted = new DurableQuorumEndpoint({
    endpointId: "B0",
    store: nodes[1].store,
    clock: () => 1_800_000_000_000
  });
  await restarted.restore();
  assert.equal(restarted.publicState.sequence, "1");
  assert.equal(restarted.publicState.organism_id, organismId);
  const survivors = [endpoints[0], restarted, endpoints[2]];
  await commitState(survivors, survivors.slice(0, 2), 2);
  assert.deepEqual(survivors.map((entry) => entry.publicState.sequence), ["2", "2", "2"]);
});

test("any one loss leaves a cold-started pair able to continue and repair with D", async () => {
  for (let lost = 0; lost < 3; lost += 1) {
    const { endpoints, nodes } = await createCluster(10 + lost);
    const survivors = [];
    for (let index = 0; index < 3; index += 1) {
      if (index === lost) continue;
      const endpoint = new DurableQuorumEndpoint({
        endpointId: `${["A", "B", "C"][index]}${10 + lost}`,
        store: nodes[index].store,
        clock: () => 1_800_000_000_000
      });
      await endpoint.restore();
      survivors.push(endpoint);
    }
    await commitState(survivors, survivors, 1);
    const { endpoint: replacement } = await createEndpoint(`D${10 + lost}`);
    await replacement.observeEvidence(survivors[0].records);
    const nextCustodians = publicCustodians([...survivors, replacement]);
    const proposal = survivors[0].createMembershipProposal({
      nextCustodians,
      nextQuorum: { type: "threshold", threshold: 2 },
      payload: {
        format: "mortalos-durable-repair/1",
        removed_key_id: endpoints[lost].custodian.key_id
      }
    });
    const approvals = [
      await survivors[0].approveProposal(proposal),
      await survivors[1].approveProposal(proposal)
    ];
    const acceptance = await replacement.acceptMembership(proposal);
    const active = [...survivors, replacement];
    for (const endpoint of active) {
      await endpoint.commitProposal(proposal, approvals, [acceptance]);
    }
    assert.deepEqual(active.map((entry) => entry.publicState.sequence), ["2", "2", "2"]);
    assert.equal(replacement.publicState.signing_authority, true);
    await commitState(active, [survivors[0], replacement], 1);
    assert.deepEqual(active.map((entry) => entry.publicState.sequence), ["3", "3", "3"]);
  }
});

test("authority removal and renewal are explicit atomic policy operations", async () => {
  const { endpoints, nodes } = await createCluster(30);
  await endpoints[0].renewAuthority(1_900_000_000_000);
  assert.equal(endpoints[0].publicState.expires_at, 1_900_000_000_000);
  const before = endpoints[0].records;
  let now = 1_900_000_000_001;
  const restarted = new DurableQuorumEndpoint({
    endpointId: "A30",
    store: nodes[0].store,
    clock: () => now
  });
  await restarted.restore();
  assert.equal(restarted.publicState.signing_authority, false);
  assert.equal(restarted.document.policy.status, "expired");
  const proposal = endpoints[1].createStateProposal(1);
  await assert.rejects(
    () => restarted.approveProposal(proposal),
    (error) => error.code === "E_DURABLE_EXPIRED"
  );
  now = 1_899_999_999_999;
  assert.equal(restarted.publicState.signing_authority, false);
  await assert.rejects(
    () => restarted.approveProposal(proposal),
    (error) => error.code === "E_DURABLE_EXPIRED"
  );
  const coldRollback = new DurableQuorumEndpoint({
    endpointId: "A30",
    store: nodes[0].store,
    clock: () => now
  });
  await coldRollback.restore();
  assert.equal(coldRollback.publicState.signing_authority, false);
  await assert.rejects(
    () => coldRollback.approveProposal(proposal),
    (error) => error.code === "E_DURABLE_EXPIRED"
  );
  await assert.rejects(
    () => coldRollback.renewAuthority(null),
    (error) => error.code === "E_DURABLE_POLICY"
  );
  await assert.rejects(
    () => coldRollback.renewAuthority(1_900_000_000_001),
    (error) => error.code === "E_DURABLE_POLICY"
  );
  assert.equal(coldRollback.document.policy.status, "expired");
  assert.equal(coldRollback.publicState.signing_authority, false);
  await coldRollback.renewAuthority(1_900_000_000_100);
  assert.equal(coldRollback.publicState.signing_authority, true);
  now = 1_900_000_000_101;
  assert.equal(coldRollback.publicState.signing_authority, false);
  await coldRollback.expireAuthority();
  assert.deepEqual(coldRollback.records, before);
  assert.equal(coldRollback.publicState.signing_authority, false);
  assert.equal(coldRollback.document.key, null);
  assert.rejects(() => coldRollback.renewAuthority(null), (error) => error.code === "E_DURABLE_AUTHORITY");
});

test("signing intent survives a post-reservation crash and rejects a conflicting body", async () => {
  const { endpoints, nodes } = await createCluster(40);
  const proposal = endpoints[0].createStateProposal(1);
  nodes[0].store.setFault((boundary) => {
    if (boundary === "reserve:after") throw new Error("simulated crash after reserve");
  });
  await assert.rejects(() => endpoints[0].approveProposal(proposal), /simulated crash/);
  nodes[0].store.clearFault();
  const restarted = new DurableQuorumEndpoint({
    endpointId: "A40",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000
  });
  await restarted.restore();
  const approval = await restarted.approveProposal(proposal);
  assert.equal(typeof approval.signature, "string");
  const conflicting = endpoints[1].createStateProposal(2);
  await assert.rejects(
    () => restarted.approveProposal(conflicting),
    (error) => error.code === "E_DURABLE_EQUIVOCATION" || error.code === "E_DURABLE_PENDING"
  );
});

test("same-revision endpoints CAS before signing and cannot release conflicting bodies", async () => {
  const { endpoints, nodes } = await createCluster(45);
  let releaseSigner;
  let signerEntered;
  const entered = new Promise((resolve) => {
    signerEntered = resolve;
  });
  const release = new Promise((resolve) => {
    releaseSigner = resolve;
  });
  let primarySignerCalls = 0;
  let staleSignerCalls = 0;
  const primary = new DurableQuorumEndpoint({
    endpointId: "A45",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000,
    signingBoundary: async (boundary) => {
      if (boundary !== "before") return;
      primarySignerCalls += 1;
      signerEntered();
      await release;
    }
  });
  const stale = new DurableQuorumEndpoint({
    endpointId: "A45",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000,
    signingBoundary: async (boundary) => {
      if (boundary !== "before") return;
      staleSignerCalls += 1;
    }
  });
  await primary.restore();
  await stale.restore();
  const firstBody = primary.createStateProposal(1);
  const conflictingBody = stale.createStateProposal(2);
  const firstApproval = primary.approveProposal(firstBody);
  await entered;
  await assert.rejects(
    () => stale.approveProposal(conflictingBody),
    (error) => error.code === "E_DURABLE_CONFLICT"
  );
  assert.equal(staleSignerCalls, 0);
  releaseSigner();
  const signature = await firstApproval;
  assert.equal(typeof signature.signature, "string");
  assert.equal(primarySignerCalls, 1);

  const recovered = new DurableQuorumEndpoint({
    endpointId: "A45",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000
  });
  await recovered.restore();
  assert.equal(
    recovered.document.journal.filter((entry) => entry.purpose === "pulse-approval").length,
    1
  );
  await assert.rejects(
    () => recovered.approveProposal(conflictingBody),
    (error) => error.code === "E_DURABLE_EQUIVOCATION"
  );
  assert.equal(endpoints[0].publicState.sequence, "0");
});

test("private CryptoKey never reaches public signer hooks or mutable WebCrypto facades", async () => {
  const store = new MemoryDurableStore();
  let legacySignerCalls = 0;
  const observed = [];
  const endpoint = new DurableQuorumEndpoint({
    endpointId: "key-containment",
    store,
    clock: () => 1_800_000_000_000,
    signer() { legacySignerCalls += 1; },
    signingBoundary(...values) { observed.push(values); }
  });
  await endpoint.initializeKey();
  const body = endpoint.createGenesisBody({
    custodians: [endpoint.custodian],
    initialStateSeed: seed(91),
    nonceSeed: seed(92),
    threshold: 1
  });
  const subtle = globalThis.crypto.subtle;
  const originalStructuredClone = globalThis.structuredClone;
  let mutableFacadeCalls = 0;
  const mutableCloneInputs = [];
  Object.defineProperty(subtle, "sign", {
    configurable: true,
    value() {
      mutableFacadeCalls += 1;
      throw new Error("mutable WebCrypto facade reached");
    }
  });
  globalThis.structuredClone = (value, options) => {
    mutableCloneInputs.push(value);
    return originalStructuredClone(value, options);
  };
  try {
    assert.equal(endpoint.document.key.private_key, undefined);
    const approval = await endpoint.approveGenesis(body);
    assert.equal(typeof approval.signature, "string");
  } finally {
    delete subtle.sign;
    globalThis.structuredClone = originalStructuredClone;
  }
  const seen = new WeakSet();
  function containsCryptoKey(value) {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
    if (value instanceof CryptoKey) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (Object.hasOwn(descriptor, "value") && containsCryptoKey(descriptor.value)) return true;
    }
    return false;
  }
  assert.equal(legacySignerCalls, 0);
  assert.equal(mutableFacadeCalls, 0);
  assert.equal(mutableCloneInputs.some(containsCryptoKey), false);
  assert.deepEqual(observed, [["before"]]);
  assert.equal(endpoint.document.key.private_key, undefined);
});

test("every critical WAL boundary recovers only old, pending, or new head without a second released signature", async () => {
  const signingBoundaries = ["reserve:before", "reserve:after", "signature:before", "signature:after"];
  for (const [index, boundary] of signingBoundaries.entries()) {
    const { endpoints, nodes } = await createCluster(500 + index);
    const proposal = endpoints[0].createStateProposal(1);
    await endpoints[1].approveProposal(proposal);
    let signerCalls = 0;
    const store = nodes[0].store;
    const crashed = new DurableQuorumEndpoint({
      endpointId: `A${500 + index}`,
      store,
      clock: () => 1_800_000_000_000,
      signingBoundary: async (observed) => {
        if (observed !== "before") return;
        signerCalls += 1;
      }
    });
    await crashed.restore();
    store.setFault((name) => {
      if (name === boundary) throw new Error(`crash:${boundary}`);
    });
    await assert.rejects(() => crashed.approveProposal(proposal), new RegExp(`crash:${boundary}`));
    store.clearFault();
    let recoverySignerCalls = 0;
    const recovered = new DurableQuorumEndpoint({
      endpointId: `A${500 + index}`,
      store,
      clock: () => 1_800_000_000_000,
      signingBoundary: async (observed) => {
        if (observed !== "before") return;
        recoverySignerCalls += 1;
      }
    });
    await recovered.restore();
    assert.equal(recovered.publicState.sequence, "0");
    const approval = await recovered.approveProposal(proposal);
    assert.equal(typeof approval.signature, "string");
    assert.equal(
      recoverySignerCalls,
      boundary === "signature:after" ? 0 : 1,
      `${boundary} recovery signing count`
    );
    assert.equal(signerCalls, boundary.startsWith("signature:") ? 1 : 0);
  }

  for (const [index, boundary] of ["commit:before", "commit:after"].entries()) {
    const { endpoints, nodes } = await createCluster(510 + index);
    const proposal = endpoints[0].createStateProposal(1);
    const ownApproval = await endpoints[0].approveProposal(proposal);
    const peerApproval = await endpoints[1].approveProposal(proposal);
    const store = nodes[0].store;
    const crashed = new DurableQuorumEndpoint({
      endpointId: `A${510 + index}`,
      store,
      clock: () => 1_800_000_000_000
    });
    await crashed.restore();
    store.setFault((name) => {
      if (name === boundary) throw new Error(`crash:${boundary}`);
    });
    await assert.rejects(
      () => crashed.commitProposal(proposal, [ownApproval, peerApproval]),
      new RegExp(`crash:${boundary}`)
    );
    store.clearFault();
    const recovered = new DurableQuorumEndpoint({
      endpointId: `A${510 + index}`,
      store,
      clock: () => 1_800_000_000_000
    });
    await recovered.restore();
    assert.equal(recovered.publicState.sequence, boundary === "commit:after" ? "1" : "0");
    assert.equal(
      recovered.publicState.pending,
      boundary === "commit:after" ? null : "pulse-approval"
    );
  }
});

test("durable module exports no raw read or write authority", async () => {
  const durableStoreModule = await import("../lab/storage/durable-store.mjs");
  assert.equal(Object.hasOwn(durableStoreModule, "readDurableStore"), false);
  assert.equal(Object.hasOwn(durableStoreModule, "writeDurableStore"), false);
  assert.equal(Object.hasOwn(durableStoreModule, "readPrivateDurableDocument"), false);
  assert.equal(Object.hasOwn(durableStoreModule, "commitPrivateDurableDocument"), false);
});

test("unknown schema, corrupt key/evidence/journal/state, custody mismatch, and migration failure fail closed", async () => {
  const firstKey = await createStoredWebCryptoKey();
  const firstStore = new MemoryDurableStore({
    document: createKeyReadyDocument({
      endpointId: "A60",
      key: firstKey,
      policy: createAuthorityPolicy()
    })
  });
  const first = new DurableQuorumEndpoint({
    endpointId: "A60",
    store: firstStore,
    clock: () => 1_800_000_000_000
  });
  await first.restore();
  const peers = await Promise.all([createEndpoint("B60"), createEndpoint("C60")]);
  const endpoints = [first, ...peers.map(({ endpoint }) => endpoint)];
  const body = first.createGenesisBody({
    custodians: publicCustodians(endpoints),
    initialStateSeed: seed(70),
    nonceSeed: seed(80),
    threshold: 2
  });
  const approvals = [];
  for (const endpoint of endpoints) approvals.push(await endpoint.approveGenesis(body));
  for (const endpoint of endpoints) await endpoint.commissionGenesis(body, approvals);
  const valid = { ...first.document, key: firstKey };
  const structuralMutations = [
    (value) => { value.extra = true; },
    (value) => { value.schema_version = 99; },
    (value) => { value.evidence = []; },
    (value) => { value.journal = [{
      body_digest: "sha256:bad",
      format: "mortalos-sign-once-journal-entry/1",
      key_id: value.key.key_id,
      message_digest: "sha256:bad",
      purpose: "pulse-approval",
      signature: null,
      status: "signed",
      tuple: "bad"
    }]; }
  ];
  for (const mutate of structuralMutations) {
    const changed = structuredClone(valid);
    mutate(changed);
    assert.throws(() => assertDurableDocumentStructure(changed));
  }

  const badState = structuredClone(valid);
  badState.state_references[0].state_root = `sha256:${"A".repeat(43)}`;
  await assert.rejects(() => replayDurableDocument(badState), (error) => error.code === "E_DURABLE_STATE");

  const badKey = structuredClone(valid);
  badKey.key.public_key_raw = new ArrayBuffer(32);
  await assert.rejects(() => replayDurableDocument(badKey), (error) => error.code === "E_DURABLE_KEY");

  const wrongCustody = structuredClone(valid);
  wrongCustody.key = await createStoredWebCryptoKey();
  await assert.rejects(
    () => replayDurableDocument(wrongCustody),
    (error) => error.code === "E_DURABLE_CUSTODY"
  );

  assert.throws(
    () => migrateLegacyDurableSnapshot({
      evidence: null,
      keys: null,
      meta: { id: "active", schema_version: 1 }
    }, { completedAt: 1_800_000_000_000 }),
    (error) => error.code === "E_DURABLE_MIGRATION"
  );
  assert.throws(
    () => migrateLegacyDurableSnapshot({
      evidence: { bundle: {}, id: "active" },
      keys: { id: "active" },
      meta: {
        authority_removed: true,
        expires_at: 1_900_000_000_000,
        id: "active",
        pending: null,
        schema_version: 1
      }
    }, { completedAt: 1_800_000_000_000 }),
    (error) => error.code === "E_DURABLE_MIGRATION"
  );
  assert.throws(
    () => migrateLegacyDurableSnapshot({
      evidence: { bundle: {}, id: "active" },
      keys: null,
      meta: {
        authority_removed: false,
        expires_at: 1_900_000_000_000,
        id: "active",
        pending: null,
        schema_version: 1
      }
    }, { completedAt: 1_800_000_000_000 }),
    (error) => error.code === "E_DURABLE_MIGRATION"
  );
});

test("public endpoint and store diagnostics redact private CryptoKey authority", async () => {
  const { endpoints, nodes } = await createCluster(70);
  const publicDocument = endpoints[0].document;
  assert.equal(Object.hasOwn(publicDocument.key, "private_key"), false);
  assert.doesNotMatch(JSON.stringify(publicDocument), /CryptoKey|private_key/u);

  const publicStoreDocument = await nodes[0].store.read();
  assert.equal(Object.hasOwn(publicStoreDocument.key, "private_key"), false);
  const seen = new WeakSet();
  function containsPrivateCryptoKey(value) {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
    if (value instanceof CryptoKey) return value.type === "private";
    if (seen.has(value)) return false;
    seen.add(value);
    return Object.values(Object.getOwnPropertyDescriptors(value)).some((descriptor) =>
      Object.hasOwn(descriptor, "value") && containsPrivateCryptoKey(descriptor.value));
  }
  assert.equal(containsPrivateCryptoKey(publicStoreDocument), false);
  await assert.rejects(
    () => nodes[0].store.write("commit", publicStoreDocument, {
      expectedRevision: publicStoreDocument.revision
    }),
    /raw durable store writes are internal/u
  );

  const first = endpoints[0].createStateProposal(1);
  nodes[0].store.write = async () => {};
  nodes[0].store.read = async () => null;
  const approval = await endpoints[0].approveProposal(first);
  assert.equal(typeof approval.signature, "string");

  const restarted = new DurableQuorumEndpoint({
    endpointId: "A70",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000
  });
  await restarted.restore();
  const conflicting = restarted.createStateProposal(2);
  await assert.rejects(
    () => restarted.approveProposal(conflicting),
    (error) => error.code === "E_DURABLE_EQUIVOCATION"
  );
});
