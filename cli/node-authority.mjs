import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { decodeBase64Url, derivePeerId, encodeBase64Url } from "../src/index.mjs";
import { snapshotBytes } from "../src/codec.mjs";
import { snapshotNamedOwnDataValues } from "../src/primordials.mjs";

const FORMAT = "mortalos-local-node-authority/1";
const LOCK_ATTEMPTS = 200;
const LOCK_RETRY_MS = 10;
const authorityRecords = new WeakMap();
const reflectApply = Reflect.apply;
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;

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
    flush: true,
    mode: 0o600
  });
  await rename(temporary, path);
}

async function acquireLock(path) {
  const lockPath = `${path}.lock`;
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify({ pid: process.pid })}\n`, "utf8");
      await handle.sync();
      return { handle, lockPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await delay(LOCK_RETRY_MS);
    }
  }
  const error = new Error("local authority is locked; a stale lock requires explicit operator recovery");
  error.code = "E_CONTINUITY_AUTHORITY_LOCK";
  throw error;
}

async function withLock(path, operation) {
  const lock = await acquireLock(path);
  try {
    return await operation();
  } finally {
    await lock.handle.close();
    await rm(lock.lockPath, { force: true });
  }
}

function ownSigningRequest(request) {
  const [messageSource, tuple] = snapshotNamedOwnDataValues(
    request,
    ["message", "tuple"],
    "local authority signing request"
  );
  let message;
  try {
    message = snapshotBytes(messageSource, 4_096);
  } catch {
    throw new TypeError("bounded signing bytes required");
  }
  if (message.byteLength < 1) throw new TypeError("bounded signing bytes required");
  if (
    typeof tuple !== "string" ||
    tuple.length < 1 ||
    tuple.length > 512 ||
    !/^[A-Za-z0-9._:-]+$/u.test(tuple)
  ) throw new TypeError("bounded sign-once tuple required");
  return { message: new Uint8Array(message), tuple };
}

export async function signNodeAuthority(authority, request) {
  const record = reflectApply(weakMapGet, authorityRecords, [authority]);
  if (!record) {
    const error = new Error("unbranded local authority");
    error.code = "E_CONTINUITY_AUTHORITY";
    throw error;
  }
  const { message, tuple } = ownSigningRequest(request);
  return await withLock(record.path, async () => {
    const current = await readDocument(record.path);
    if (current.custodian.key_id !== record.custodian.key_id) {
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
    await writeDocument(record.path, current);
    const privateBytes = decodeBase64Url(current.private_pkcs8_base64url);
    if (!privateBytes) throw new Error("invalid local private key encoding");
    const privateKey = createPrivateKey({ key: privateBytes, format: "der", type: "pkcs8" });
    return Object.freeze({
      key_id: record.custodian.key_id,
      signature: `ed25519:${encodeBase64Url(nodeSign(null, message, privateKey))}`
    });
  });
}

export async function loadNodeAuthority(path, options = {}) {
  if (typeof path !== "string" || path.length < 1) throw new TypeError("authority path required");
  const create = options?.create === true;
  let document;
  try {
    document = await readDocument(path);
  } catch (error) {
    if (!create || error?.code !== "ENOENT") throw error;
    document = authorityDocument();
    await writeDocument(path, document);
  }
  const custodian = Object.freeze({ ...document.custodian });
  let authority;
  authority = Object.freeze({
    custodian,
    sign(request) {
      return signNodeAuthority(authority, request);
    }
  });
  reflectApply(weakMapSet, authorityRecords, [authority, Object.freeze({ custodian, path })]);
  return authority;
}
