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
  migrateLegacyDurableSnapshot,
  replayDurableDocument
} from "../lab/storage/durable-document.mjs";
import {
  signBytes
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
    signer: async (...args) => {
      primarySignerCalls += 1;
      signerEntered();
      await release;
      return signBytes(...args);
    }
  });
  const stale = new DurableQuorumEndpoint({
    endpointId: "A45",
    store: nodes[0].store,
    clock: () => 1_800_000_000_000,
    signer: async (...args) => {
      staleSignerCalls += 1;
      return signBytes(...args);
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

test("every critical WAL boundary recovers only old, pending, or new head without a second released signature", async () => {
  const { endpoints, nodes } = await createCluster(50);
  const baseDocument = await nodes[0].store.read();
  const proposal = endpoints[0].createStateProposal(1);
  const peerApproval = await endpoints[1].approveProposal(proposal);

  for (const boundary of ["reserve:before", "reserve:after", "signature:before", "signature:after"]) {
    let signerCalls = 0;
    const store = new MemoryDurableStore({
      document: baseDocument,
      fault: (name) => {
        if (name === boundary) throw new Error(`crash:${boundary}`);
      }
    });
    const crashed = new DurableQuorumEndpoint({
      endpointId: "A50",
      store,
      clock: () => 1_800_000_000_000,
      signer: async (...args) => {
        signerCalls += 1;
        return signBytes(...args);
      }
    });
    await crashed.restore();
    await assert.rejects(() => crashed.approveProposal(proposal), new RegExp(`crash:${boundary}`));
    store.clearFault();
    let recoverySignerCalls = 0;
    const recovered = new DurableQuorumEndpoint({
      endpointId: "A50",
      store,
      clock: () => 1_800_000_000_000,
      signer: async (...args) => {
        recoverySignerCalls += 1;
        return signBytes(...args);
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

  const signedStore = new MemoryDurableStore({ document: baseDocument });
  const signer = new DurableQuorumEndpoint({
    endpointId: "A50",
    store: signedStore,
    clock: () => 1_800_000_000_000
  });
  await signer.restore();
  const ownApproval = await signer.approveProposal(proposal);
  for (const boundary of ["commit:before", "commit:after"]) {
    const store = new MemoryDurableStore({
      document: await signedStore.read(),
      fault: (name) => {
        if (name === boundary) throw new Error(`crash:${boundary}`);
      }
    });
    const crashed = new DurableQuorumEndpoint({
      endpointId: "A50",
      store,
      clock: () => 1_800_000_000_000
    });
    await crashed.restore();
    await assert.rejects(
      () => crashed.commitProposal(proposal, [ownApproval, peerApproval]),
      new RegExp(`crash:${boundary}`)
    );
    store.clearFault();
    const recovered = new DurableQuorumEndpoint({
      endpointId: "A50",
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

test("every durable adapter write exposes atomic before/after failure semantics", async () => {
  const { nodes } = await createCluster(55);
  const prior = await nodes[0].store.read();
  for (const operation of [
    "initialize",
    "expire",
    "reserve",
    "signature",
    "commit",
    "observe",
    "sync",
    "renew",
    "remove"
  ]) {
    for (const side of ["before", "after"]) {
      const candidate = structuredClone(prior);
      candidate.revision = operation === "initialize" ? 0 : prior.revision + 1;
      const store = new MemoryDurableStore({
        document: operation === "initialize" ? null : prior,
        fault: (boundary) => {
          if (boundary === `${operation}:${side}`) throw new Error(`crash:${operation}:${side}`);
        }
      });
      await assert.rejects(
        () => store.write(operation, candidate, {
          expectedRevision: operation === "initialize" ? null : prior.revision
        }),
        new RegExp(`crash:${operation}:${side}`)
      );
      const stored = await store.read();
      if (side === "before") {
        assert.equal(stored?.revision ?? null, operation === "initialize" ? null : prior.revision);
      } else {
        assert.equal(stored.revision, candidate.revision);
      }
    }
  }
});

test("unknown schema, corrupt key/evidence/journal/state, custody mismatch, and migration failure fail closed", async () => {
  const { nodes } = await createCluster(60);
  const valid = await nodes[0].store.read();
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

  const { store: outsiderStore } = await createEndpoint("outside");
  const wrongCustody = structuredClone(valid);
  wrongCustody.key = (await outsiderStore.read()).key;
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

test("public endpoint documents redact usable signing capability and store method mutation cannot bypass sign-once", async () => {
  const { endpoints, nodes } = await createCluster(70);
  const publicDocument = endpoints[0].document;
  assert.equal(Object.hasOwn(publicDocument.key, "private_key"), false);
  assert.doesNotMatch(JSON.stringify(publicDocument), /CryptoKey|private_key/u);

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
