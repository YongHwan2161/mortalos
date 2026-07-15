import { deriveSigningRequest } from "./signing-policy.mjs";

let keyPair = null;
const signedContexts = new Set();
let birthSigned = false;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function reply(id, type, fields = {}) {
  globalThis.postMessage({ id, type, ...fields });
}

async function initialize(id) {
  if (keyPair) throw new Error("custodian is already initialized");
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
    throw new Error("secure-context WebCrypto is required");
  }

  const generated = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  if (generated.privateKey.extractable !== false) {
    throw new Error("private key is unexpectedly extractable");
  }

  let privateExportRejected = false;
  try {
    await globalThis.crypto.subtle.exportKey("pkcs8", generated.privateKey);
  } catch {
    privateExportRejected = true;
  }
  if (!privateExportRejected) {
    throw new Error("private-key export self-test failed closed");
  }

  const publicKeyRaw = new Uint8Array(
    await globalThis.crypto.subtle.exportKey("raw", generated.publicKey)
  );
  if (publicKeyRaw.byteLength !== 32) throw new Error("unexpected Ed25519 public-key length");

  keyPair = generated;
  reply(id, "ready", {
    publicKeyRaw,
    privateExtractable: generated.privateKey.extractable,
    privateExportRejected
  });
}

async function signOnce(id, request) {
  if (!keyPair) throw new Error("custodian is not initialized");
  const { context, message } = deriveSigningRequest(request.operation, request.body);
  if (request.operation === "genesis" && birthSigned) {
    throw new Error("custodian already approved a Genesis");
  }
  if (signedContexts.has(context)) {
    throw new Error("sign-once protocol context already used");
  }
  if (request.operation === "genesis") birthSigned = true;
  signedContexts.add(context);
  const signatureRaw = new Uint8Array(
    await globalThis.crypto.subtle.sign("Ed25519", keyPair.privateKey, message)
  );
  if (signatureRaw.byteLength !== 64) throw new Error("unexpected Ed25519 signature length");
  reply(id, "signature", { signatureRaw, context });
}

globalThis.onmessage = async ({ data }) => {
  const id = isRecord(data) && typeof data.id === "string" ? data.id : "invalid";
  try {
    if (!isRecord(data) || typeof data.type !== "string") throw new Error("invalid request");
    if (data.type === "init" && hasExactKeys(data, ["id", "type"])) {
      await initialize(id);
      return;
    }
    if (data.type === "sign" && hasExactKeys(data, ["body", "id", "operation", "type"])) {
      await signOnce(id, data);
      return;
    }
    if (data.type === "destroy" && hasExactKeys(data, ["id", "type"])) {
      keyPair = null;
      signedContexts.clear();
      birthSigned = false;
      reply(id, "destroyed");
      globalThis.close();
      return;
    }
    throw new Error("request is not allowlisted");
  } catch (error) {
    reply(id, "error", {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : "custodian operation failed"
    });
  }
};
