import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { decodeBase64Url, derivePeerId, encodeBase64Url } from "../src/index.mjs";

const FORMAT = "mortalos-local-node-authority/1";

function authorityDocument() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(publicDer.subarray(-32))}`;
  return {
    custodian: { key_id: derivePeerId(public_key), public_key },
    format: FORMAT,
    private_pkcs8_base64url: encodeBase64Url(
      privateKey.export({ type: "pkcs8", format: "der" })
    ),
    sign_once: {}
  };
}

function validate(document) {
  if (
    !document ||
    document.format !== FORMAT ||
    !document.custodian ||
    derivePeerId(document.custodian.public_key) !== document.custodian.key_id ||
    typeof document.private_pkcs8_base64url !== "string" ||
    !document.sign_once ||
    typeof document.sign_once !== "object" ||
    Array.isArray(document.sign_once)
  ) throw new Error("invalid local authority file");
  return document;
}

async function readDocument(path) {
  return validate(JSON.parse(await readFile(path, "utf8")));
}

async function writeDocument(path, document) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporary, path);
}

export async function loadNodeAuthority(path, { create = false } = {}) {
  let document;
  try {
    document = await readDocument(path);
  } catch (error) {
    if (!create || error?.code !== "ENOENT") throw error;
    document = authorityDocument();
    await writeDocument(path, document);
  }
  const custodian = Object.freeze({ ...document.custodian });
  return Object.freeze({
    custodian,
    async sign(request) {
      const message = new Uint8Array(request.message);
      const tuple = String(request.tuple);
      const current = await readDocument(path);
      if (current.custodian.key_id !== custodian.key_id) {
        const error = new Error("local authority identity changed");
        error.code = "E_CONTINUITY_AUTHORITY";
        throw error;
      }
      const messageId = encodeBase64Url(message);
      const prior = current.sign_once[tuple];
      if (prior && prior !== messageId) {
        const error = new Error(`local sign-once conflict: ${tuple}`);
        error.code = "E_CONTINUITY_EQUIVOCATION";
        throw error;
      }
      current.sign_once[tuple] = messageId;
      await writeDocument(path, current);
      const privateBytes = decodeBase64Url(current.private_pkcs8_base64url);
      if (!privateBytes) throw new Error("invalid local private key encoding");
      const privateKey = createPrivateKey({ key: privateBytes, format: "der", type: "pkcs8" });
      return Object.freeze({
        key_id: custodian.key_id,
        signature: `ed25519:${encodeBase64Url(nodeSign(null, message, privateKey))}`
      });
    }
  });
}
