import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { decodeBase64Url, encodeBase64Url } from "../src/bytes.mjs";
import { derivePeerId } from "../src/crypto.mjs";
import {
  createResourceBandwidthExecutionResult,
  createResourceComputeExecutionResult,
  createResourceStorageExecutionResult
} from "../src/resource-execution.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const public_key = `ed25519:${encodeBase64Url(raw)}`;

function bytes(value) {
  const decoded = decodeBase64Url(value);
  if (!decoded) throw new Error("invalid base64url IPC bytes");
  return decoded;
}

function executionOptions(message) {
  return {
    offer: bytes(message.offer),
    lease: bytes(message.lease),
    previous_execution_receipts: message.previous_execution_receipts.map(bytes),
    usage_receipts: message.usage_receipts.map(bytes),
    challenge: bytes(message.challenge)
  };
}

process.on("message", async (message) => {
  try {
    let value;
    if (message.type === "sign") {
      value = `ed25519:${encodeBase64Url(sign(null, bytes(message.message), privateKey))}`;
    } else if (message.type === "storage") {
      value = createResourceStorageExecutionResult({
        ...executionOptions(message),
        resource_bytes: new Uint8Array(await readFile(message.resource_path))
      });
    } else if (message.type === "bandwidth") {
      value = createResourceBandwidthExecutionResult({
        ...executionOptions(message),
        echoed_payload: bytes(message.payload)
      });
    } else if (message.type === "compute") {
      value = createResourceComputeExecutionResult(executionOptions(message));
    } else {
      throw new Error("unsupported endpoint message");
    }
    process.send({ id: message.id, ok: true, value });
  } catch (error) {
    process.send({
      id: message.id,
      ok: false,
      error: { code: error?.code ?? "E_ENDPOINT", message: String(error?.message ?? error) }
    });
  }
});

process.send({
  ready: true,
  identity: { key_id: derivePeerId(public_key), public_key }
});
