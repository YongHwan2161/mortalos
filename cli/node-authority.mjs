import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { decodeBase64Url, derivePeerId, encodeBase64Url } from "../src/index.mjs";
import { snapshotBytes } from "../src/codec.mjs";
import {
  arrayIncludes,
  arrayLength,
  arrayValueAt,
  defineOwnDataProperty,
  freeze,
  isArray,
  jsonParse,
  jsonStringify,
  objectCreate,
  objectKeys,
  ownDataRecordEntry,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord,
  snapshotNamedOwnDataValues,
  typeError
} from "../src/primordials.mjs";

const FORMAT = "mortalos-local-node-authority/1";
const LOCK_ATTEMPTS = 200;
const LOCK_RETRY_MS = 10;
const authorityRecords = new WeakMap();
const reflectApply = Reflect.apply;
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;
const TUPLE_PATTERN = /^[A-Za-z0-9._:-]+$/u;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

function runtimeError() {
  const error = typeError("local authority realm integrity check failed");
  error.code = "E_CONTINUITY_RUNTIME";
  return error;
}

function assertNodeRealm() {
  if (!realmIntrinsicsIntact()) throw runtimeError();
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = objectKeys(value);
  if (arrayLength(actual) !== arrayLength(expected)) {
    throw new Error(`${label} has unexpected keys`);
  }
  for (let index = 0; index < arrayLength(actual); index += 1) {
    if (!arrayIncludes(expected, arrayValueAt(actual, index))) {
      throw new Error(`${label} has unexpected keys`);
    }
  }
}

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
    sign_once: objectCreate(null)
  };
}

function validate(document) {
  exactKeys(
    document,
    ["custodian", "format", "private_pkcs8_base64url", "sign_once"],
    "local authority document"
  );
  exactKeys(document.custodian, ["key_id", "public_key"], "local authority custodian");
  if (
    !document ||
    document.format !== FORMAT ||
    !document.custodian ||
    derivePeerId(document.custodian.public_key) !== document.custodian.key_id ||
    typeof document.private_pkcs8_base64url !== "string" ||
    !document.sign_once ||
    typeof document.sign_once !== "object" ||
    isArray(document.sign_once)
  ) throw new Error("invalid local authority file");
  const journalDescriptors = snapshotOwnDataRecord(
    document.sign_once,
    "local authority sign-once journal"
  );
  const journalKeys = objectKeys(journalDescriptors);
  const journal = objectCreate(null);
  for (let index = 0; index < arrayLength(journalKeys); index += 1) {
    const tuple = arrayValueAt(journalKeys, index);
    const entry = ownDataRecordEntry(journalDescriptors, tuple);
    if (
      typeof tuple !== "string" ||
      tuple.length < 1 ||
      tuple.length > 512 ||
      !regexpTest(TUPLE_PATTERN, tuple) ||
      typeof entry.value !== "string" ||
      entry.value.length < 1 ||
      entry.value.length > 5_464 ||
      !regexpTest(MESSAGE_ID_PATTERN, entry.value)
    ) throw new Error("invalid local authority sign-once journal");
    defineOwnDataProperty(journal, tuple, entry.value);
  }
  document.sign_once = journal;
  return document;
}

async function readDocument(path) {
  const source = await readFile(path, "utf8");
  assertNodeRealm();
  return validate(jsonParse(source));
}

async function writeDocument(path, document) {
  await mkdir(dirname(path), { recursive: true });
  assertNodeRealm();
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${jsonStringify(document, null, 2)}\n`, {
    encoding: "utf8",
    flush: true,
    mode: 0o600
  });
  assertNodeRealm();
  await rename(temporary, path);
  assertNodeRealm();
}

async function acquireLock(path) {
  const lockPath = `${path}.lock`;
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${jsonStringify({ pid: process.pid })}\n`, "utf8");
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
    assertNodeRealm();
    const result = await operation();
    assertNodeRealm();
    return result;
  } finally {
    await lock.handle.close();
    await rm(lock.lockPath, { force: true });
    assertNodeRealm();
  }
}

async function readOrCreateDocument(path, create) {
  try {
    const existing = await readDocument(path);
    assertNodeRealm();
    return existing;
  } catch (error) {
    assertNodeRealm();
    if (!create || error?.code !== "ENOENT") throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  assertNodeRealm();
  return withLock(path, async () => {
    try {
      const existing = await readDocument(path);
      assertNodeRealm();
      return existing;
    } catch (error) {
      assertNodeRealm();
      if (error?.code !== "ENOENT") throw error;
    }
    const document = authorityDocument();
    await writeDocument(path, document);
    assertNodeRealm();
    return document;
  });
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
    !regexpTest(TUPLE_PATTERN, tuple)
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
    assertNodeRealm();
    if (current.custodian.key_id !== record.custodian.key_id) {
      const error = new Error("local authority identity changed");
      error.code = "E_CONTINUITY_AUTHORITY";
      throw error;
    }
    const messageId = encodeBase64Url(message);
    const journalDescriptors = snapshotOwnDataRecord(
      current.sign_once,
      "local authority sign-once journal"
    );
    const prior = ownDataRecordEntry(journalDescriptors, tuple);
    if (prior.present && prior.value !== messageId) {
      const error = new Error(`local sign-once conflict: ${tuple}`);
      error.code = "E_CONTINUITY_EQUIVOCATION";
      throw error;
    }
    if (!prior.present) defineOwnDataProperty(current.sign_once, tuple, messageId);
    await writeDocument(record.path, current);
    assertNodeRealm();
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
  const document = await readOrCreateDocument(path, create);
  assertNodeRealm();
  const custodian = freeze({
    key_id: document.custodian.key_id,
    public_key: document.custodian.public_key
  });
  let authority;
  authority = freeze({
    custodian,
    sign(request) {
      return signNodeAuthority(authority, request);
    }
  });
  reflectApply(weakMapSet, authorityRecords, [authority, freeze({ custodian, path })]);
  return authority;
}
