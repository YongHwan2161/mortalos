import { ed25519 } from "@noble/curves/ed25519.js";
import { DurableObject } from "cloudflare:workers";
import { decodeBase64Url, encodeBase64Url, equalBytes } from "../src/bytes.mjs";
import { canonicalBytes, parseJsonBytes, snapshotBytes } from "../src/codec.mjs";
import { CUSTODY_LIMITS, verifyContinuityCopy } from "../src/custody.mjs";
import {
  PROVIDER_POSSESSION_FORMAT,
  providerObjectDigest,
  verifyProviderPossessionReceipt
} from "../src/provider/possession.mjs";

const PROVIDER_FIELDS = Object.freeze([
  "account_domain",
  "admin_domain",
  "credential_domain",
  "failure_domain",
  "provider_id",
  "provider_kind",
  "region"
]);
const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const CHUNK_BYTES = 65_536;

function exactIdentityBasis(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("provider identity basis required");
  }
  const keys = Object.keys(source).sort();
  if (keys.join(",") !== [...PROVIDER_FIELDS].sort().join(",")) {
    throw new TypeError("provider identity basis has unexpected keys");
  }
  const identity = {};
  for (const field of PROVIDER_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") {
      throw new TypeError(`provider identity basis ${field} must be an own data string`);
    }
    if (!BOUNDED_ID.test(descriptor.value)) {
      throw new TypeError(`provider identity basis ${field} is invalid`);
    }
    identity[field] = descriptor.value;
  }
  return Object.freeze(identity);
}

function same(left, right) {
  return equalBytes(canonicalBytes(left), canonicalBytes(right));
}

export class ProviderVault extends DurableObject {
  #identity = null;
  #seed = null;

  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
          id INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS provider_identity (
          singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
          identity_json TEXT UNIQUE NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS objects (
          digest TEXT PRIMARY KEY NOT NULL,
          size INTEGER NOT NULL CHECK(size > 0),
          copy_json TEXT NOT NULL,
          stored_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS object_chunks (
          digest TEXT NOT NULL,
          ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
          bytes BLOB NOT NULL,
          PRIMARY KEY(digest, ordinal),
          FOREIGN KEY(digest) REFERENCES objects(digest) ON DELETE CASCADE
        ) STRICT;
        INSERT OR IGNORE INTO _sql_schema_migrations(id, applied_at) VALUES (1, unixepoch());
      `);
      const storedSeed = await ctx.storage.get("provider_signing_seed");
      if (storedSeed === undefined) {
        const created = crypto.getRandomValues(new Uint8Array(32));
        await ctx.storage.put("provider_signing_seed", created);
        this.#seed = new Uint8Array(created);
      } else {
        this.#seed = snapshotBytes(storedSeed, 32);
      }
      if (this.#seed.byteLength !== 32) throw new Error("provider signing seed is invalid");
      const row = ctx.storage.sql.exec(
        "SELECT identity_json FROM provider_identity WHERE singleton = 1"
      ).toArray()[0];
      if (row) this.#identity = Object.freeze(parseJsonBytes(
        new TextEncoder().encode(row.identity_json),
        { maxBytes: 4096, maxDepth: 8 }
      ));
    });
  }

  async configure(identitySource) {
    const basis = exactIdentityBasis(identitySource);
    const identity = Object.freeze({
      ...basis,
      public_key: `ed25519:${encodeBase64Url(ed25519.getPublicKey(this.#seed))}`
    });
    if (this.#identity && !same(this.#identity, identity)) {
      throw new Error("provider identity is immutable");
    }
    if (!this.#identity) {
      const identityJson = new TextDecoder().decode(canonicalBytes(identity));
      this.ctx.storage.sql.exec(
        "INSERT INTO provider_identity(singleton, identity_json) VALUES (1, ?)",
        identityJson
      );
      this.#identity = identity;
    }
    return structuredClone(this.#identity);
  }

  describe() {
    if (!this.#identity) throw new Error("provider identity is not configured");
    return structuredClone(this.#identity);
  }

  #readObject(digest) {
    if (typeof digest !== "string" || !/^sha256:[A-Za-z0-9_-]{43}$/u.test(digest)) {
      throw new TypeError("provider object digest is invalid");
    }
    const metadata = this.ctx.storage.sql.exec(
      "SELECT size FROM objects WHERE digest = ?",
      digest
    ).toArray()[0];
    if (!metadata) return null;
    const chunks = this.ctx.storage.sql.exec(
      "SELECT ordinal, bytes FROM object_chunks WHERE digest = ? ORDER BY ordinal",
      digest
    ).toArray();
    const bytes = new Uint8Array(metadata.size);
    let offset = 0;
    for (let index = 0; index < chunks.length; index += 1) {
      const row = chunks[index];
      const chunkBytes = row.bytes instanceof Uint8Array
        ? new Uint8Array(row.bytes)
        : row.bytes instanceof ArrayBuffer
          ? new Uint8Array(row.bytes)
          : null;
      if (row.ordinal !== index || !chunkBytes) {
        throw new Error("provider object chunk inventory is invalid");
      }
      bytes.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }
    if (offset !== bytes.byteLength || providerObjectDigest(bytes) !== digest) {
      throw new Error("provider object readback is invalid");
    }
    return bytes;
  }

  async put(copySource) {
    if (!this.#identity) throw new Error("provider identity is not configured");
    const copyBytes = snapshotBytes(copySource, CUSTODY_LIMITS.copy_bytes);
    if (copyBytes.byteLength < 1) throw new TypeError("provider object is empty");
    const verified = verifyContinuityCopy(copyBytes);
    if (verified.provider_id !== this.#identity.provider_id) {
      throw new Error("provider copy binding mismatch");
    }
    const digest = providerObjectDigest(copyBytes);
    const existing = this.#readObject(digest);
    let storedAt;
    if (existing) {
      if (!equalBytes(existing, copyBytes)) throw new Error("provider object collision");
      storedAt = this.ctx.storage.sql.exec(
        "SELECT stored_at FROM objects WHERE digest = ?",
        digest
      ).one().stored_at;
    } else {
      storedAt = new Date().toISOString();
      this.ctx.storage.sql.exec(
        "INSERT INTO objects(digest, size, copy_json, stored_at) VALUES (?, ?, ?, ?)",
        digest,
        copyBytes.byteLength,
        new TextDecoder().decode(canonicalBytes(verified.descriptor)),
        storedAt
      );
      for (let offset = 0, ordinal = 0; offset < copyBytes.byteLength; offset += CHUNK_BYTES, ordinal += 1) {
        this.ctx.storage.sql.exec(
          "INSERT INTO object_chunks(digest, ordinal, bytes) VALUES (?, ?, ?)",
          digest,
          ordinal,
          copyBytes.slice(offset, Math.min(offset + CHUNK_BYTES, copyBytes.byteLength))
        );
      }
      const readback = this.#readObject(digest);
      if (!readback || !equalBytes(readback, copyBytes)) {
        throw new Error("provider write readback failed");
      }
    }
    const body = Object.freeze({
      copy: verified.descriptor,
      format: PROVIDER_POSSESSION_FORMAT,
      object: Object.freeze({ digest, size: copyBytes.byteLength }),
      provider: this.#identity,
      stored_at: storedAt
    });
    const receipt = canonicalBytes({
      body,
      signature: `ed25519:${encodeBase64Url(ed25519.sign(canonicalBytes(body), this.#seed))}`
    });
    verifyProviderPossessionReceipt(receipt);
    return receipt;
  }

  get(digest) {
    const bytes = this.#readObject(digest);
    return bytes ? new Uint8Array(bytes) : null;
  }
}

export default {
  async fetch() {
    return Response.json(
      { code: "E_PROVIDER_SERVICE_BINDING_REQUIRED", status: "reject" },
      {
        headers: {
          "cache-control": "no-store, no-transform",
          "x-content-type-options": "nosniff"
        },
        status: 404
      }
    );
  }
};
