import {
  derivePeerId,
  encodeBase64Url
} from "../../src/index.mjs";
import {
  PARTICIPANT_OPERATION_FORMAT,
  portSuccess
} from "./contracts.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function custodianFromPublicKeyBytes(raw) {
  if (!(raw instanceof Uint8Array) || raw.byteLength !== 32) {
    throw new TypeError("Ed25519 public key must be exactly 32 bytes");
  }
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return Object.freeze({ key_id: derivePeerId(public_key), public_key });
}

export async function assertNonExtractableSigningKey(privateKey) {
  if (
    !privateKey ||
    privateKey.type !== "private" ||
    privateKey.extractable !== false ||
    privateKey.algorithm?.name !== "Ed25519" ||
    !privateKey.usages.includes("sign")
  ) {
    throw new TypeError("non-extractable Ed25519 signing key required");
  }
  let privateExportRejected = false;
  try {
    await crypto.subtle.exportKey("pkcs8", privateKey);
  } catch {
    privateExportRejected = true;
  }
  if (!privateExportRejected) throw new Error("private key export unexpectedly succeeded");
  return true;
}

export async function signBytes(keyId, privateKey, message) {
  if (typeof keyId !== "string" || !(message instanceof Uint8Array)) {
    throw new TypeError("bounded key ID and signing bytes required");
  }
  await assertNonExtractableSigningKey(privateKey);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, message);
  return Object.freeze({
    key_id: keyId,
    signature: `ed25519:${encodeBase64Url(new Uint8Array(signature))}`
  });
}

export async function createStoredWebCryptoKey() {
  const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  await assertNonExtractableSigningKey(generated.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const custodian = custodianFromPublicKeyBytes(raw);
  return {
    key_id: custodian.key_id,
    private_key: generated.privateKey,
    public_key: custodian.public_key,
    public_key_raw: raw.buffer
  };
}

export class WebCryptoKeyStore {
  #record = null;

  static supported() {
    return Boolean(globalThis.crypto?.subtle);
  }

  get custodian() {
    return this.#record ? clone(this.#record.custodian) : null;
  }

  get keyId() {
    return this.#record?.custodian.key_id ?? null;
  }

  get available() {
    return Boolean(this.#record);
  }

  get description() {
    return this.#record ? Object.freeze({
      available: true,
      custodian: this.custodian,
      non_extractable: true,
      private_export_rejected: true
    }) : Object.freeze({
      available: false,
      custodian: null,
      non_extractable: null,
      private_export_rejected: null
    });
  }

  async create() {
    if (this.#record) throw new Error("key store already contains a key");
    const generated = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    await assertNonExtractableSigningKey(generated.privateKey);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
    this.#record = {
      custodian: custodianFromPublicKeyBytes(raw),
      privateKey: generated.privateKey,
      publicKeyRaw: raw
    };
    return portSuccess(this.custodian);
  }

  async describe() {
    return portSuccess(this.description);
  }

  async destroy() {
    this.#record = null;
    return portSuccess(null);
  }

  async sign(request) {
    if (!this.#record) throw new Error("key store signing authority is unavailable");
    if (
      !request ||
      request.format !== PARTICIPANT_OPERATION_FORMAT ||
      request.operation !== "sign" ||
      request.key_id !== this.#record.custodian.key_id ||
      !(request.message instanceof Uint8Array)
    ) {
      throw new TypeError("invalid participant signing request");
    }
    return portSuccess(await signBytes(request.key_id, this.#record.privateKey, request.message));
  }
}
