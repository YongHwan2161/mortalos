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
import {
  signBytes
} from "../lab/participant/webcrypto-key-store.mjs";

function seed(value) {
  return new Uint8Array(16).fill(value);
}

function indexedDbRequest(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function indexedDbTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
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
  const persisted = await target.store.read();
  target.store.close();
  return {
    after,
    before,
    private_key_export_rejected:
      persisted.key.private_key.extractable === false &&
      !Object.hasOwn(target.endpoint.document.key, "private_key")
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

async function verifyIndexedDbCompareAndSwap() {
  const databaseName = "mortalos-s2-concurrent-cas";
  await deleteDurableStore(databaseName);
  const bootstrap = endpoint("CAS", databaseName);
  await bootstrap.endpoint.initializeKey();
  const body = bootstrap.endpoint.createGenesisBody({
    custodians: [bootstrap.endpoint.custodian],
    initialStateSeed: seed(81),
    nonceSeed: seed(82),
    threshold: 1
  });
  const genesisApproval = await bootstrap.endpoint.approveGenesis(body);
  await bootstrap.endpoint.commissionGenesis(body, [genesisApproval]);
  bootstrap.store.close();

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
  const primaryStore = new IndexedDbDurableStore({ databaseName, endpointId: "CAS" });
  const staleStore = new IndexedDbDurableStore({ databaseName, endpointId: "CAS" });
  const primary = new DurableQuorumEndpoint({
    endpointId: "CAS",
    store: primaryStore,
    clock: () => 1_800_000_000_000,
    signer: async (...args) => {
      primarySignerCalls += 1;
      signerEntered();
      await release;
      return signBytes(...args);
    }
  });
  const stale = new DurableQuorumEndpoint({
    endpointId: "CAS",
    store: staleStore,
    clock: () => 1_800_000_000_000,
    signer: async (...args) => {
      staleSignerCalls += 1;
      return signBytes(...args);
    }
  });
  await Promise.all([primary.restore(), stale.restore()]);
  const acceptedBody = primary.createStateProposal(1);
  const rejectedBody = stale.createStateProposal(2);
  const acceptedPromise = primary.approveProposal(acceptedBody);
  await entered;
  let staleCode = null;
  try {
    await stale.approveProposal(rejectedBody);
  } catch (error) {
    staleCode = error.code;
  }
  releaseSigner();
  const accepted = await acceptedPromise;
  primaryStore.close();
  staleStore.close();

  const recoveredStore = new IndexedDbDurableStore({ databaseName, endpointId: "CAS" });
  const recovered = new DurableQuorumEndpoint({
    endpointId: "CAS",
    store: recoveredStore,
    clock: () => 1_800_000_000_000
  });
  await recovered.restore();
  let conflictingCode = null;
  try {
    await recovered.approveProposal(rejectedBody);
  } catch (error) {
    conflictingCode = error.code;
  }
  const persistedPulseEntries = recovered.document.journal
    .filter((entry) => entry.purpose === "pulse-approval").length;
  recoveredStore.close();
  return {
    accepted_signature: typeof accepted.signature === "string",
    conflicting_code: conflictingCode,
    persisted_pulse_entries: persistedPulseEntries,
    primary_signer_calls: primarySignerCalls,
    stale_code: staleCode,
    stale_signer_calls: staleSignerCalls
  };
}

async function verifyExpiryRollbackLatch() {
  const databaseName = "mortalos-s2-expiry-rollback";
  await deleteDurableStore(databaseName);
  let now = 1_800_000_000_000;
  const initialStore = new IndexedDbDurableStore({ databaseName, endpointId: "EXP" });
  const initial = new DurableQuorumEndpoint({
    endpointId: "EXP",
    store: initialStore,
    clock: () => now
  });
  await initial.initializeKey({ expiresAt: now + 100 });
  const body = initial.createGenesisBody({
    custodians: [initial.custodian],
    initialStateSeed: seed(83),
    nonceSeed: seed(84),
    threshold: 1
  });
  const genesisApproval = await initial.approveGenesis(body);
  await initial.commissionGenesis(body, [genesisApproval]);
  const proposal = initial.createStateProposal(1);
  now += 100;
  let atExpiryCode = null;
  try {
    await initial.approveProposal(proposal);
  } catch (error) {
    atExpiryCode = error.code;
  }
  initialStore.close();

  now -= 1;
  const rollbackStore = new IndexedDbDurableStore({ databaseName, endpointId: "EXP" });
  const rollback = new DurableQuorumEndpoint({
    endpointId: "EXP",
    store: rollbackStore,
    clock: () => now
  });
  await rollback.restore();
  const rollbackAuthority = rollback.publicState.signing_authority;
  let rollbackCode = null;
  try {
    await rollback.approveProposal(proposal);
  } catch (error) {
    rollbackCode = error.code;
  }
  const persistedStatus = rollback.document.policy.status;
  let nullRenewalCode = null;
  try {
    await rollback.renewAuthority(null);
  } catch (error) {
    nullRenewalCode = error.code;
  }
  let staleRenewalCode = null;
  try {
    await rollback.renewAuthority(now + 1);
  } catch (error) {
    staleRenewalCode = error.code;
  }
  const statusAfterRejectedRenewals = rollback.document.policy.status;
  await rollback.renewAuthority(now + 1_000);
  const renewedAuthority = rollback.publicState.signing_authority;
  rollbackStore.close();
  return {
    at_expiry_code: atExpiryCode,
    null_renewal_code: nullRenewalCode,
    persisted_status: persistedStatus,
    renewed_authority: renewedAuthority,
    rollback_authority: rollbackAuthority,
    rollback_code: rollbackCode,
    stale_renewal_code: staleRenewalCode,
    status_after_rejected_renewals: statusAfterRejectedRenewals
  };
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

async function inspectMigratedDatabase(databaseName) {
  const database = await indexedDbRequest(indexedDB.open(databaseName));
  const storeNames = Array.from(database.objectStoreNames);
  const readableStores = ["participant", "keys"].filter((name) => storeNames.includes(name));
  const records = {};
  if (readableStores.length > 0) {
    const transaction = database.transaction(readableStores, "readonly");
    const done = indexedDbTransaction(transaction);
    await Promise.all(readableStores.map(async (name) => {
      records[name] = await indexedDbRequest(transaction.objectStore(name).get("active"));
    }));
    await done;
  }
  database.close();
  let legacyRawSigning = false;
  if (records.keys?.private_key) {
    try {
      await signBytes(records.keys.private_key, new Uint8Array([1, 2, 3]));
      legacyRawSigning = true;
    } catch {
      legacyRawSigning = false;
    }
  }
  return {
    legacy_key_present: Boolean(records.keys?.private_key),
    legacy_raw_signing: legacyRawSigning,
    participant_key_present: Boolean(records.participant?.key),
    participant_status: records.participant?.policy?.status ?? null,
    store_names: storeNames
  };
}

async function rejectedVersionOneMigration(databaseName, endpointId, snapshot) {
  await createVersionOneDatabase(databaseName, snapshot);
  let failedClosed = false;
  const store = new IndexedDbDurableStore({
    databaseName,
    endpointId,
    migrationClock: () => 1_800_000_000_001
  });
  try {
    await store.read();
  } catch {
    failedClosed = true;
  }
  store.close();
  const retainedVersion = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.addEventListener("success", () => {
      const version = request.result.version;
      request.result.close();
      resolve(version);
    }, { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
  const retained = await inspectMigratedDatabase(databaseName);
  return {
    failed_closed: failedClosed,
    retained,
    retained_version: retainedVersion
  };
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
  const document = await legacyStore.read();
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
  const afterMigration = await inspectMigratedDatabase(validName);
  await migrated.removeAuthority();
  const removedState = {
    key_present: Boolean(migrated.document.key),
    status: migrated.document.policy.status
  };
  migratedStore.close();
  const afterRemoval = await inspectMigratedDatabase(validName);
  const valid = {
    after_migration: afterMigration,
    after_removal: afterRemoval,
    from_schema: migrated.document.migration.from_schema,
    organism_id: migrated.publicState.organism_id,
    removed_state: removedState,
    schema_version: migrated.document.schema_version,
    signing_authority: migrated.publicState.signing_authority
  };

  const emptyName = "mortalos-s2-migration-empty";
  await createVersionOneDatabase(emptyName, {});
  const emptyStore = new IndexedDbDurableStore({
    databaseName: emptyName,
    endpointId: "empty",
    migrationClock: () => 1_800_000_000_001
  });
  const emptyDocument = await emptyStore.read();
  emptyStore.close();
  const empty = {
    document_absent: emptyDocument === null,
    inspection: await inspectMigratedDatabase(emptyName)
  };

  const commonEvidence = {
    bundle: createEvidenceBundle(bundleRecords(legacy.records)),
    id: "active"
  };
  const commonKey = {
    id: "active",
    key_id: document.key.key_id,
    private_key: document.key.private_key,
    public_key_raw: document.key.public_key_raw
  };
  const corrupt = await rejectedVersionOneMigration(
    "mortalos-s2-migration-corrupt",
    "legacy",
    {
      evidence: commonEvidence,
      keys: commonKey,
      meta: {
        authority_removed: false,
        expires_at: 1_900_000_000_000,
        id: "active",
        pending: { status: "partial" },
        schema_version: 1
      }
    }
  );
  const removedWithKey = await rejectedVersionOneMigration(
    "mortalos-s2-migration-removed-with-key",
    "legacy",
    {
      evidence: commonEvidence,
      keys: commonKey,
      meta: {
        authority_removed: true,
        expires_at: 1_900_000_000_000,
        id: "active",
        pending: null,
        schema_version: 1
      }
    }
  );
  const activeWithoutKey = await rejectedVersionOneMigration(
    "mortalos-s2-migration-active-without-key",
    "legacy",
    {
      evidence: commonEvidence,
      keys: null,
      meta: {
        authority_removed: false,
        expires_at: 1_900_000_000_000,
        id: "active",
        pending: null,
        schema_version: 1
      }
    }
  );
  return {
    active_without_key: activeWithoutKey,
    corrupt,
    empty,
    removed_with_key: removedWithKey,
    valid
  };
}

globalThis.__MORTALOS_DURABLE_BROWSER__ = Object.freeze({
  createAcceptedHandoff,
  prepareLossTrial,
  restoreLossAndRepair,
  restoreAndAdvance,
  verifyExpiryRollbackLatch,
  verifyIndexedDbCompareAndSwap,
  verifyVersionOneMigration
});
