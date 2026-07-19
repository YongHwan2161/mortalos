import {
  canonicalBytes,
  decodeBase64Url,
  derivePeerId,
  encodeBase64Url,
  genesisApprovalMessage,
  pulseApprovalMessage
} from "../../src/index.mjs";
import {
  createInitialState,
  createNurtureInput,
  createStateTransitionPayload,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "../../src/state/engine.mjs";
import {
  createEvidenceBundle,
  importEvidenceBundleBytes,
  publicRecordsFromEvidenceBundle
} from "../evidence-export.mjs";
import {
  createGenesisBody,
  createStateTransitionBody,
  genesisEnvelope,
  pulseEnvelope
} from "../live-incubator.mjs";
import { r1AppendCandidates, r1ReplayLineage, r1ValidateGenesis } from "../r1-client.mjs";
import {
  DURABLE_STORE_VERSION,
  openDurableStore,
  readDurableSnapshot,
  removeDurableAuthority,
  updateDurableEvidence,
  writeDurableSnapshot
} from "../storage/durable-store.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is corrupt`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} schema is corrupt`);
  }
}

function publicCustodian(raw) {
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return { key_id: derivePeerId(public_key), public_key };
}

async function approval(keyId, privateKey, message) {
  const signature = await crypto.subtle.sign("Ed25519", privateKey, message);
  return { key_id: keyId, signature: `ed25519:${encodeBase64Url(new Uint8Array(signature))}` };
}

async function privateExportRejected(privateKey) {
  try {
    await crypto.subtle.exportKey("pkcs8", privateKey);
    return false;
  } catch {
    return true;
  }
}

export class DurableParticipant {
  #database = null;
  #keyRecord = null;
  #meta = null;
  #records = [];
  #replay = null;

  static supported() {
    return Boolean(globalThis.indexedDB && globalThis.crypto?.subtle && globalThis.CryptoKey);
  }

  get publicState() {
    return {
      available: DurableParticipant.supported(),
      authority_removed: this.#meta?.authority_removed ?? false,
      configured: Boolean(this.#replay),
      digest: this.#replay?.digest ?? null,
      expires_at: this.#meta?.expires_at ?? null,
      head_hash: this.#replay?.head_hash ?? null,
      organism_id: this.#replay?.organism_id ?? null,
      private_export_rejected: this.#keyRecord?.private_export_rejected ?? null,
      pulse_count: this.#replay?.state?.pulse_count ?? null,
      sequence: this.#replay?.sequence ?? null,
      signing_authority: Boolean(this.#keyRecord && !this.#meta?.authority_removed),
      state_root: this.#replay?.state_root ?? null,
      storage: this.#replay ? ["IndexedDB CryptoKey", "public evidence", "schema metadata"] : []
    };
  }

  async #databaseHandle() {
    if (!DurableParticipant.supported()) throw new Error("Durable Participant is unsupported in this browser");
    this.#database ??= await openDurableStore();
    return this.#database;
  }

  async #acceptSnapshot(snapshot) {
    if (!snapshot.evidence && !snapshot.keys && !snapshot.meta) return null;
    if (!snapshot.evidence || !snapshot.meta) throw new Error("Durable Participant snapshot is incomplete");
    assertKeys(snapshot.evidence, ["bundle", "id"], "durable evidence");
    assertKeys(snapshot.meta, ["authority_removed", "expires_at", "id", "pending", "schema_version"], "durable metadata");
    if (
      snapshot.evidence.id !== "active" ||
      snapshot.meta.id !== "active" ||
      snapshot.meta.schema_version !== DURABLE_STORE_VERSION ||
      snapshot.meta.pending !== null ||
      typeof snapshot.meta.authority_removed !== "boolean" ||
      !Number.isSafeInteger(snapshot.meta.expires_at)
    ) {
      throw new Error("Durable Participant metadata is unsupported or corrupt");
    }
    const imported = importEvidenceBundleBytes(canonicalBytes(snapshot.evidence.bundle));
    const records = publicRecordsFromEvidenceBundle(imported.bundle);
    const genesis = records[0].envelope;
    const replay = r1ReplayLineage(genesis, records).outcome;
    if (replay.status !== "complete") throw new Error("Durable Participant evidence did not replay completely");

    if (!snapshot.meta.authority_removed && snapshot.meta.expires_at <= Date.now()) {
      snapshot = {
        ...snapshot,
        keys: null,
        meta: { ...snapshot.meta, authority_removed: true }
      };
      await removeDurableAuthority(await this.#databaseHandle(), snapshot.meta);
    }
    let keyRecord = null;
    if (snapshot.keys) {
      assertKeys(
        snapshot.keys,
        ["id", "key_id", "private_key", "public_key_raw"],
        "durable key"
      );
      if (
        snapshot.keys.id !== "active" ||
        !(snapshot.keys.private_key instanceof CryptoKey) ||
        snapshot.keys.private_key.type !== "private" ||
        snapshot.keys.private_key.extractable !== false ||
        snapshot.keys.private_key.algorithm?.name !== "Ed25519" ||
        !snapshot.keys.private_key.usages.includes("sign") ||
        !(snapshot.keys.public_key_raw instanceof ArrayBuffer)
      ) {
        throw new Error("Durable Participant key is corrupt or extractable");
      }
      const custodian = publicCustodian(new Uint8Array(snapshot.keys.public_key_raw));
      if (custodian.key_id !== snapshot.keys.key_id) throw new Error("Durable Participant key metadata mismatch");
      const head = replay.steps.at(-1) ?? r1ValidateGenesis(genesis).outcome;
      if (!head.next_custody_descriptor.custodians.some((entry) => entry.key_id === snapshot.keys.key_id)) {
        throw new Error("Durable Participant key is not a current custodian");
      }
      keyRecord = {
        ...snapshot.keys,
        private_export_rejected: await privateExportRejected(snapshot.keys.private_key)
      };
      if (!keyRecord.private_export_rejected) throw new Error("Durable Participant private export succeeded");
    } else if (!snapshot.meta.authority_removed) {
      throw new Error("Durable Participant current authority is missing");
    }

    this.#keyRecord = keyRecord;
    this.#meta = clone(snapshot.meta);
    this.#records = records;
    this.#replay = clone(imported.replay);
    return this.publicState;
  }

  async restore() {
    return this.#acceptSnapshot(await readDurableSnapshot(await this.#databaseHandle()));
  }

  async create(ttlDays = 7) {
    const database = await this.#databaseHandle();
    const existing = await readDurableSnapshot(database);
    if (existing.evidence || existing.keys || existing.meta) {
      throw new Error("Durable Participant already exists; restore or remove it first");
    }
    const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    if (generated.privateKey.extractable) throw new Error("browser created an extractable private key");
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
    const custodian = publicCustodian(publicRaw);
    const initialStateBytes = createInitialState(crypto.getRandomValues(new Uint8Array(16)));
    const body = createGenesisBody({
      custodians: [custodian],
      genomeHash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes,
      protocolVersion: "mortalos/1",
      stateRoot: stateRoot(initialStateBytes),
      nonce: `nonce:${encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`
    });
    const envelope = genesisEnvelope(body, [
      await approval(custodian.key_id, generated.privateKey, genesisApprovalMessage(body))
    ]);
    const accepted = r1ValidateGenesis(envelope).outcome;
    if (accepted.status !== "accept") throw new Error(`Durable Genesis rejected: ${accepted.code}`);
    const bundle = createEvidenceBundle([{ kind: "genesis", envelope }]);
    if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30) {
      throw new Error("Durable Participant expiry must be 1 through 30 days");
    }
    const snapshot = {
      evidence: { id: "active", bundle },
      keys: {
        id: "active",
        key_id: custodian.key_id,
        private_key: generated.privateKey,
        public_key_raw: publicRaw.buffer
      },
      meta: {
        id: "active",
        authority_removed: false,
        expires_at: Date.now() + ttlDays * 86_400_000,
        pending: null,
        schema_version: DURABLE_STORE_VERSION
      }
    };
    await writeDurableSnapshot(database, snapshot);
    return this.#acceptSnapshot(snapshot);
  }

  async nurture(steps = 1) {
    if (!this.#replay) await this.restore();
    if (!this.#keyRecord || this.#meta.authority_removed) throw new Error("local durable signing authority is unavailable");
    const genesis = this.#records[0].envelope;
    const current = r1ReplayLineage(genesis, this.#records).outcome;
    if (current.status !== "complete") throw new Error("durable evidence replay terminated");
    const head = current.steps.at(-1) ?? r1ValidateGenesis(genesis).outcome;
    const stateBytes = decodeBase64Url(this.#replay.state_base64url);
    if (!stateBytes) throw new Error("durable state encoding is corrupt");
    const transition = createStateTransitionPayload({
      genomeBytes: PULSE_SEED_V1_GENOME_BYTES,
      inputBytes: createNurtureInput(steps),
      stateBytes
    });
    const body = createStateTransitionBody({
      genesis: r1ValidateGenesis(genesis).outcome,
      parent: head,
      nextStateRoot: stateRoot(transition.nextStateBytes),
      payload: transition.payload
    });
    const envelope = pulseEnvelope(body, [
      await approval(this.#keyRecord.key_id, this.#keyRecord.private_key, pulseApprovalMessage(body))
    ]);
    const result = r1AppendCandidates(genesis, this.#records, [{ envelope, payload: transition.payload }])
      .outcome.results[0];
    if (result.status !== "accept") throw new Error(`Durable transition rejected: ${result.code}`);
    const nextRecords = [...this.#records, { kind: "pulse", envelope, payload: transition.payload }];
    const bundle = createEvidenceBundle(nextRecords);
    const evidence = { id: "active", bundle };
    await updateDurableEvidence(await this.#databaseHandle(), evidence, this.#meta);
    return this.#acceptSnapshot({ evidence, keys: {
      id: "active",
      key_id: this.#keyRecord.key_id,
      private_key: this.#keyRecord.private_key,
      public_key_raw: this.#keyRecord.public_key_raw
    }, meta: this.#meta });
  }

  async removeAuthority() {
    if (!this.#replay) await this.restore();
    const meta = { ...this.#meta, authority_removed: true, pending: null };
    await removeDurableAuthority(await this.#databaseHandle(), meta);
    this.#keyRecord = null;
    this.#meta = meta;
    return this.publicState;
  }

  close() {
    this.#database?.close();
    this.#database = null;
    this.#keyRecord = null;
  }
}
