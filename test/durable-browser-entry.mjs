import {
  DurableQuorumEndpoint
} from "../lab/participant/durable-quorum-endpoint.mjs";
import {
  deleteDurableStore,
  IndexedDbDurableStore
} from "../lab/storage/durable-store.mjs";
import {
  MemoryDurableStore
} from "../lab/storage/memory-durable-store.mjs";
import {
  createEvidenceBundle
} from "../lab/evidence-export.mjs";

function seed(value) {
  return new Uint8Array(16).fill(value);
}

function endpoint(id, databaseName) {
  const store = new IndexedDbDurableStore({ databaseName, endpointId: id });
  return {
    endpoint: new DurableQuorumEndpoint({
      endpointId: id,
      store,
      clock: () => 1_800_000_000_000
    }),
    store
  };
}

function bundleRecords(records) {
  return records.map((record, index) => index === 0
    ? { kind: "genesis", envelope: structuredClone(record.envelope) }
    : {
      kind: "pulse",
      envelope: structuredClone(record.envelope),
      payload: structuredClone(record.payload)
    });
}

async function createAcceptedHandoff(run) {
  const suffix = String(run).padStart(3, "0");
  const sourceName = `mortalos-s2-handoff-a-${suffix}`;
  const targetName = `mortalos-s2-handoff-b-${suffix}`;
  await Promise.all([deleteDurableStore(sourceName), deleteDurableStore(targetName)]);
  const source = endpoint(`A${suffix}`, sourceName);
  const target = endpoint(`B${suffix}`, targetName);
  await source.endpoint.initializeKey();
  await target.endpoint.initializeKey();
  const body = source.endpoint.createGenesisBody({
    custodians: [source.endpoint.custodian],
    initialStateSeed: seed((run % 200) + 1),
    nonceSeed: seed((run % 200) + 21),
    threshold: 1
  });
  const genesisApproval = await source.endpoint.approveGenesis(body);
  await source.endpoint.commissionGenesis(body, [genesisApproval]);
  await target.endpoint.observeEvidence(source.endpoint.records);
  const proposal = source.endpoint.createMembershipProposal({
    nextCustodians: [target.endpoint.custodian],
    nextQuorum: { type: "threshold", threshold: 1 },
    payload: {
      format: "mortalos-durable-handoff/1",
      from_key_id: source.endpoint.custodian.key_id,
      to_key_id: target.endpoint.custodian.key_id
    }
  });
  const approval = await source.endpoint.approveProposal(proposal);
  const acceptance = await target.endpoint.acceptMembership(proposal);
  await source.endpoint.commitProposal(proposal, [approval], [acceptance]);
  await target.endpoint.commitProposal(proposal, [approval], [acceptance]);
  const result = {
    database_name: targetName,
    head_hash: target.endpoint.publicState.head_hash,
    organism_id: target.endpoint.publicState.organism_id,
    sequence: target.endpoint.publicState.sequence
  };
  source.store.close();
  target.store.close();
  return result;
}

async function restoreAndAdvance(run) {
  const suffix = String(run).padStart(3, "0");
  const targetName = `mortalos-s2-handoff-b-${suffix}`;
  const target = endpoint(`B${suffix}`, targetName);
  await target.endpoint.restore();
  const before = target.endpoint.publicState;
  const proposal = target.endpoint.createStateProposal(1);
  const approval = await target.endpoint.approveProposal(proposal);
  await target.endpoint.commitProposal(proposal, [approval]);
  const after = target.endpoint.publicState;
  target.store.close();
  return {
    after,
    before,
    private_key_export_rejected: target.endpoint.document.key.private_key.extractable === false
  };
}

function lossNames(run, lost) {
  const suffix = `${lost}-${String(run).padStart(3, "0")}`;
  return ["A", "B", "C", "D"].map((id) => ({
    databaseName: `mortalos-s2-loss-${suffix}-${id.toLowerCase()}`,
    endpointId: `${id}L${lost}_${String(run).padStart(3, "0")}`
  }));
}

async function prepareLossTrial(run, lost) {
  const names = lossNames(run, lost);
  await Promise.all(names.map(({ databaseName }) => deleteDurableStore(databaseName)));
  const nodes = names.slice(0, 3).map(({ databaseName, endpointId }) =>
    endpoint(endpointId, databaseName));
  for (const node of nodes) await node.endpoint.initializeKey();
  const custodians = nodes.map((node) => node.endpoint.custodian).sort((left, right) =>
    left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const body = nodes[0].endpoint.createGenesisBody({
    custodians,
    initialStateSeed: seed(((run + lost * 31) % 200) + 1),
    nonceSeed: seed(((run + lost * 31) % 200) + 21),
    threshold: 2
  });
  const approvals = [];
  for (const node of nodes) approvals.push(await node.endpoint.approveGenesis(body));
  for (const node of nodes) await node.endpoint.commissionGenesis(body, approvals);
  const result = {
    head_hash: nodes[0].endpoint.publicState.head_hash,
    lost_key_id: nodes[lost].endpoint.custodian.key_id,
    organism_id: nodes[0].endpoint.publicState.organism_id
  };
  for (const node of nodes) node.store.close();
  return result;
}

async function restoreLossAndRepair(run, lost, expected) {
  const names = lossNames(run, lost);
  const survivors = names.slice(0, 3)
    .filter((_, index) => index !== lost)
    .map(({ databaseName, endpointId }) => endpoint(endpointId, databaseName));
  for (const node of survivors) await node.endpoint.restore();
  const transition = survivors[0].endpoint.createStateProposal(1);
  const transitionApprovals = [];
  for (const node of survivors) transitionApprovals.push(await node.endpoint.approveProposal(transition));
  for (const node of survivors) {
    await node.endpoint.commitProposal(transition, transitionApprovals);
  }

  const replacement = endpoint(names[3].endpointId, names[3].databaseName);
  await replacement.endpoint.initializeKey();
  await replacement.endpoint.observeEvidence(survivors[0].endpoint.records);
  const nextCustodians = [...survivors, replacement]
    .map((node) => node.endpoint.custodian)
    .sort((left, right) => left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0);
  const repair = survivors[0].endpoint.createMembershipProposal({
    nextCustodians,
    nextQuorum: { type: "threshold", threshold: 2 },
    payload: {
      format: "mortalos-durable-repair/1",
      removed_key_id: expected.lost_key_id
    }
  });
  const repairApprovals = [];
  for (const node of survivors) repairApprovals.push(await node.endpoint.approveProposal(repair));
  const acceptance = await replacement.endpoint.acceptMembership(repair);
  const active = [...survivors, replacement];
  for (const node of active) {
    await node.endpoint.commitProposal(repair, repairApprovals, [acceptance]);
  }

  const continued = active[0].endpoint.createStateProposal(1);
  const continuedApprovals = [
    await active[0].endpoint.approveProposal(continued),
    await replacement.endpoint.approveProposal(continued)
  ];
  for (const node of active) {
    await node.endpoint.commitProposal(continued, continuedApprovals);
  }
  const result = {
    head_hash: active[0].endpoint.publicState.head_hash,
    organism_id: active[0].endpoint.publicState.organism_id,
    replacement_authority: replacement.endpoint.publicState.signing_authority,
    sequence: active[0].endpoint.publicState.sequence
  };
  for (const node of active) node.store.close();
  return result;
}

async function createVersionOneDatabase(databaseName, snapshot) {
  await deleteDurableStore(databaseName);
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.addEventListener("upgradeneeded", () => {
      for (const name of ["evidence", "keys", "meta"]) {
        request.result.createObjectStore(name, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => {
      const database = request.result;
      const transaction = database.transaction(["evidence", "keys", "meta"], "readwrite");
      for (const name of ["evidence", "keys", "meta"]) {
        if (snapshot[name]) transaction.objectStore(name).put(snapshot[name]);
      }
      transaction.addEventListener("complete", () => {
        database.close();
        resolve();
      }, { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    }, { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

async function verifyVersionOneMigration() {
  const legacyStore = new MemoryDurableStore();
  const legacy = new DurableQuorumEndpoint({
    endpointId: "legacy",
    store: legacyStore,
    clock: () => 1_800_000_000_000
  });
  await legacy.initializeKey({ expiresAt: 1_900_000_000_000 });
  const body = legacy.createGenesisBody({
    custodians: [legacy.custodian],
    initialStateSeed: seed(91),
    nonceSeed: seed(92),
    threshold: 1
  });
  const approval = await legacy.approveGenesis(body);
  await legacy.commissionGenesis(body, [approval]);
  const document = legacy.document;
  const validName = "mortalos-s2-migration-valid";
  await createVersionOneDatabase(validName, {
    evidence: {
      bundle: createEvidenceBundle(bundleRecords(legacy.records)),
      id: "active"
    },
    keys: {
      id: "active",
      key_id: document.key.key_id,
      private_key: document.key.private_key,
      public_key_raw: document.key.public_key_raw
    },
    meta: {
      authority_removed: false,
      expires_at: 1_900_000_000_000,
      id: "active",
      pending: null,
      schema_version: 1
    }
  });
  const migratedStore = new IndexedDbDurableStore({
    databaseName: validName,
    endpointId: "legacy",
    migrationClock: () => 1_800_000_000_001
  });
  const migrated = new DurableQuorumEndpoint({
    endpointId: "legacy",
    store: migratedStore,
    clock: () => 1_800_000_000_001
  });
  await migrated.restore();
  const valid = {
    from_schema: migrated.document.migration.from_schema,
    organism_id: migrated.publicState.organism_id,
    schema_version: migrated.document.schema_version,
    signing_authority: migrated.publicState.signing_authority
  };
  migratedStore.close();

  const corruptName = "mortalos-s2-migration-corrupt";
  await createVersionOneDatabase(corruptName, {
    evidence: {
      bundle: createEvidenceBundle(bundleRecords(legacy.records)),
      id: "active"
    },
    keys: {
      id: "active",
      key_id: document.key.key_id,
      private_key: document.key.private_key,
      public_key_raw: document.key.public_key_raw
    },
    meta: {
      authority_removed: false,
      expires_at: 1_900_000_000_000,
      id: "active",
      pending: { status: "partial" },
      schema_version: 1
    }
  });
  let failedClosed = false;
  const corruptStore = new IndexedDbDurableStore({
    databaseName: corruptName,
    endpointId: "legacy",
    migrationClock: () => 1_800_000_000_001
  });
  try {
    await corruptStore.read();
  } catch {
    failedClosed = true;
  }
  corruptStore.close();
  const retainedVersion = await new Promise((resolve, reject) => {
    const request = indexedDB.open(corruptName);
    request.addEventListener("success", () => {
      const version = request.result.version;
      request.result.close();
      resolve(version);
    }, { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
  return { failed_closed: failedClosed, retained_version: retainedVersion, valid };
}

globalThis.__MORTALOS_DURABLE_BROWSER__ = Object.freeze({
  createAcceptedHandoff,
  prepareLossTrial,
  restoreLossAndRepair,
  restoreAndAdvance,
  verifyVersionOneMigration
});
