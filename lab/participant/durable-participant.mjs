import {
  canonicalBytes,
  encodeBase64Url
} from "../../src/index.mjs";
import {
  createInitialState
} from "../../src/state/engine.mjs";
import {
  createEvidenceBundle,
  importEvidenceBundleBytes,
  publicRecordsFromEvidenceBundle
} from "../evidence-export.mjs";
import {
  DURABLE_STORE_VERSION,
  openDurableStore,
  readDurableSnapshot,
  removeDurableAuthority,
  updateDurableEvidence,
  writeDurableSnapshot
} from "../storage/durable-store.mjs";
import {
  assembleParticipantGenesis,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore
} from "./core.mjs";
import {
  custodianFromPublicKeyBytes,
  signBytes,
  assertNonExtractableSigningKey
} from "./webcrypto-key-store.mjs";

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

function randomNonce(prefix) {
  return `${prefix}${encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`;
}

function bundleRecords(records) {
  return records.map((record, index) => index === 0
    ? { kind: "genesis", envelope: clone(record.envelope) }
    : { kind: "pulse", envelope: clone(record.envelope), payload: clone(record.payload) });
}

export class DurableParticipant {
  #core = new ParticipantCore("durable");
  #database = null;
  #digest = null;
  #keyRecord = null;
  #meta = null;

  static supported() {
    return Boolean(globalThis.indexedDB && globalThis.crypto?.subtle && globalThis.CryptoKey);
  }

  get publicState() {
    const snapshot = this.#core.snapshot({
      keyCount: this.#keyRecord ? 1 : 0,
      keyId: this.#keyRecord?.key_id ?? null
    });
    return {
      available: DurableParticipant.supported(),
      authority_removed: this.#meta?.authority_removed ?? false,
      configured: this.#core.initialized,
      digest: this.#digest,
      expires_at: this.#meta?.expires_at ?? null,
      head_hash: snapshot.head_hash,
      organism_id: snapshot.organism_id,
      private_export_rejected: this.#keyRecord?.private_export_rejected ?? null,
      pulse_count: snapshot.pulse_count,
      sequence: snapshot.sequence,
      signing_authority: snapshot.current_custodian && !this.#meta?.authority_removed,
      state_root: snapshot.state_root,
      storage: this.#core.initialized ? ["IndexedDB CryptoKey", "public evidence", "schema metadata"] : []
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
    const core = new ParticipantCore("durable");
    core.openGenesis(records[0], records.slice(1));

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
      assertKeys(snapshot.keys, ["id", "key_id", "private_key", "public_key_raw"], "durable key");
      if (
        snapshot.keys.id !== "active" ||
        !(snapshot.keys.private_key instanceof CryptoKey) ||
        !(snapshot.keys.public_key_raw instanceof ArrayBuffer)
      ) {
        throw new Error("Durable Participant key is corrupt or extractable");
      }
      await assertNonExtractableSigningKey(snapshot.keys.private_key);
      const custodian = custodianFromPublicKeyBytes(new Uint8Array(snapshot.keys.public_key_raw));
      if (custodian.key_id !== snapshot.keys.key_id) throw new Error("Durable Participant key metadata mismatch");
      if (!core.snapshot({ keyCount: 1, keyId: snapshot.keys.key_id }).current_custodian) {
        throw new Error("Durable Participant key is not a current custodian");
      }
      keyRecord = {
        ...snapshot.keys,
        private_export_rejected: true
      };
    } else if (!snapshot.meta.authority_removed) {
      throw new Error("Durable Participant current authority is missing");
    }

    this.#core = core;
    this.#digest = imported.bundle.digest;
    this.#keyRecord = keyRecord;
    this.#meta = clone(snapshot.meta);
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
    if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30) {
      throw new Error("Durable Participant expiry must be 1 through 30 days");
    }

    const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    await assertNonExtractableSigningKey(generated.privateKey);
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
    const custodian = custodianFromPublicKeyBytes(publicRaw);
    const body = createParticipantGenesisBody({
      custodians: [custodian],
      initialQuorum: { type: "threshold", threshold: 1 },
      initialStateBytes: createInitialState(crypto.getRandomValues(new Uint8Array(16))),
      nonce: randomNonce("nonce:")
    });
    const approval = await signBytes(
      custodian.key_id,
      generated.privateKey,
      genesisSigningRequest(body, custodian.key_id).message
    );
    const genesisRecord = assembleParticipantGenesis(body, [approval]);
    const bundle = createEvidenceBundle(bundleRecords([genesisRecord]));
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
    if (!this.#core.initialized) await this.restore();
    if (!this.#keyRecord || this.#meta.authority_removed) {
      throw new Error("local durable signing authority is unavailable");
    }
    const proposal = this.#core.createStateProposal(steps);
    const request = this.#core.approvalRequest(proposal, this.#keyRecord.key_id);
    const approval = await signBytes(this.#keyRecord.key_id, this.#keyRecord.private_key, request.message);
    this.#core.commitProposal(proposal, [approval]);
    const bundle = createEvidenceBundle(bundleRecords(this.#core.records));
    const evidence = { id: "active", bundle };
    await updateDurableEvidence(await this.#databaseHandle(), evidence, this.#meta);
    return this.#acceptSnapshot({
      evidence,
      keys: {
        id: "active",
        key_id: this.#keyRecord.key_id,
        private_key: this.#keyRecord.private_key,
        public_key_raw: this.#keyRecord.public_key_raw
      },
      meta: this.#meta
    });
  }

  async removeAuthority() {
    if (!this.#core.initialized) await this.restore();
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
