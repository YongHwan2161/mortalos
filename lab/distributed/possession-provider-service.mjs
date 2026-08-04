import { ed25519 } from "@noble/curves/ed25519.js";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeBase64Url, encodeBase64Url, equalBytes } from "../../src/bytes.mjs";
import { canonicalBytes } from "../../src/codec.mjs";
import { CUSTODY_LIMITS, verifyContinuityCopy } from "../../src/custody.mjs";
import {
  PROVIDER_POSSESSION_FORMAT,
  providerObjectDigest,
  verifyProviderPossessionReceipt
} from "../../src/provider/possession.mjs";

const token = process.env.MORTALOS_PROVIDER_TOKEN;
const seed = decodeBase64Url(process.env.MORTALOS_PROVIDER_SIGNING_SEED ?? "");
const dataDirectory = process.env.MORTALOS_PROVIDER_DATA_DIRECTORY;
const port = Number(process.env.MORTALOS_PROVIDER_PORT ?? "0");
let identityBasis;
try {
  identityBasis = JSON.parse(process.env.MORTALOS_PROVIDER_IDENTITY ?? "null");
} catch {
  identityBasis = null;
}
if (
  typeof token !== "string" ||
  token.length < 16 ||
  !seed ||
  seed.byteLength !== 32 ||
  typeof dataDirectory !== "string" ||
  dataDirectory.length < 1 ||
  !Number.isSafeInteger(port) ||
  !identityBasis ||
  typeof identityBasis !== "object"
) {
  throw new Error("provider token, signing seed, identity, data directory, and port are required");
}

const identity = Object.freeze({
  account_domain: identityBasis.account_domain,
  admin_domain: identityBasis.admin_domain,
  credential_domain: identityBasis.credential_domain,
  failure_domain: identityBasis.failure_domain,
  provider_id: identityBasis.provider_id,
  provider_kind: identityBasis.provider_kind,
  public_key: `ed25519:${encodeBase64Url(ed25519.getPublicKey(seed))}`,
  region: identityBasis.region
});
const objectDirectory = join(dataDirectory, "objects");
await mkdir(objectDirectory, { recursive: true });

function fixedHash(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

function authorized(request) {
  const supplied = request.headers.authorization ?? "";
  return timingSafeEqual(fixedHash(supplied), fixedHash(`Bearer ${token}`));
}

function objectPath(digest) {
  if (typeof digest !== "string" || !/^sha256:[A-Za-z0-9_-]{43}$/u.test(digest)) {
    throw new Error("invalid-object-digest");
  }
  return join(objectDirectory, `${digest.slice(7)}.bin`);
}

function respondJson(response, status, value) {
  const bytes = canonicalBytes(value);
  response.writeHead(status, {
    "cache-control": "no-store, no-transform",
    "content-length": String(bytes.byteLength),
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(bytes);
}

function respondBytes(response, bytes) {
  response.writeHead(200, {
    "cache-control": "no-store, no-transform",
    "content-length": String(bytes.byteLength),
    "content-type": "application/octet-stream",
    "x-content-type-options": "nosniff"
  });
  response.end(bytes);
}

async function readRequestBytes(request) {
  const declared = request.headers["content-length"];
  if (
    declared !== undefined &&
    (!/^(?:0|[1-9][0-9]*)$/u.test(declared) || Number(declared) > CUSTODY_LIMITS.copy_bytes)
  ) {
    throw new Error("provider-object-too-large");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > CUSTODY_LIMITS.copy_bytes) throw new Error("provider-object-too-large");
    chunks.push(chunk);
  }
  if (size < 1) throw new Error("provider-object-empty");
  return new Uint8Array(Buffer.concat(chunks));
}

async function persistAndAttest(copyBytes) {
  const verified = verifyContinuityCopy(copyBytes);
  if (verified.provider_id !== identity.provider_id) throw new Error("provider-copy-binding-mismatch");
  const digest = providerObjectDigest(copyBytes);
  const destination = objectPath(digest);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, copyBytes);
  await rename(temporary, destination);
  const readback = new Uint8Array(await readFile(destination));
  if (!equalBytes(readback, copyBytes) || providerObjectDigest(readback) !== digest) {
    throw new Error("provider-write-readback-mismatch");
  }
  const body = Object.freeze({
    copy: verified.descriptor,
    format: PROVIDER_POSSESSION_FORMAT,
    object: Object.freeze({ digest, size: copyBytes.byteLength }),
    provider: identity,
    stored_at: new Date().toISOString()
  });
  const receipt = canonicalBytes({
    body,
    signature: `ed25519:${encodeBase64Url(ed25519.sign(canonicalBytes(body), seed))}`
  });
  verifyProviderPossessionReceipt(receipt);
  return receipt;
}

const server = createServer(async (request, response) => {
  try {
    if (!authorized(request)) {
      respondJson(response, 401, { code: "E_PROVIDER_AUTH", status: "reject" });
      return;
    }
    const url = new URL(request.url, "http://provider.invalid");
    if (request.method === "POST" && url.pathname === "/objects") {
      if (request.headers["content-type"] !== "application/octet-stream") {
        throw new Error("provider-media-type");
      }
      const receipt = await persistAndAttest(await readRequestBytes(request));
      respondJson(response, 201, {
        format: "mortalos-provider-store-response/1",
        receipt_base64url: encodeBase64Url(receipt)
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/objects") {
      const digest = url.searchParams.get("digest");
      const bytes = new Uint8Array(await readFile(objectPath(digest)));
      if (providerObjectDigest(bytes) !== digest) throw new Error("provider-object-corrupt");
      respondBytes(response, bytes);
      return;
    }
    respondJson(response, 404, { code: "E_PROVIDER_NOT_FOUND", status: "reject" });
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 400;
    respondJson(response, status, {
      code: status === 404 ? "E_PROVIDER_OBJECT_MISSING" : "E_PROVIDER_REQUEST",
      status: "reject"
    });
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
const address = server.address();
console.log(JSON.stringify({
  identity,
  ready: true,
  url: `http://127.0.0.1:${address.port}/`
}));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
