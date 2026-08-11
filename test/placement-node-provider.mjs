import { createInterface } from "node:readline";
import { decodeBase64Url, encodeBase64Url } from "../src/bytes.mjs";
import { createResourceStorageExecutionResult } from "../src/resource-execution.mjs";
import { createPlacementSigner } from "../lab/placement/storage-contract.mjs";

const signer = await createPlacementSigner();
let resource = null;

function documents(values) {
  return values.map((value) => decodeBase64Url(value));
}

async function dispatch(message) {
  if (message.action === "identity") return signer.identity;
  if (message.action === "sign") {
    return signer.sign(decodeBase64Url(message.message));
  }
  if (message.action === "store") {
    resource = decodeBase64Url(message.resource);
    return { resource_size: resource.byteLength, status: "stored" };
  }
  if (message.action === "create-storage-result") {
    if (!resource) throw new Error("provider resource unavailable");
    return createResourceStorageExecutionResult({
      offer: decodeBase64Url(message.offer),
      lease: decodeBase64Url(message.lease),
      previous_execution_receipts: documents(message.previous_execution_receipts),
      usage_receipts: documents(message.usage_receipts),
      challenge: decodeBase64Url(message.challenge),
      resource_bytes: resource
    });
  }
  if (message.action === "destroy") {
    signer.destroy();
    resource?.fill(0);
    resource = null;
    return { status: "destroyed" };
  }
  throw new Error("unsupported provider action");
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const message = JSON.parse(line);
  try {
    const result = await dispatch(message);
    process.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
    if (message.action === "destroy") process.exit(0);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ id: message.id, error: error.message })}\n`);
  }
}
