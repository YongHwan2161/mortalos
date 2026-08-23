import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { isIP } from "node:net";
import { TLSSocket } from "node:tls";
import { byteLengthOfBytes, isSharedByteView } from "../../src/bytes.mjs";
import { canonicalBytes } from "../../src/codec.mjs";
import {
  freeze,
  numberIsSafeInteger,
  objectCreate,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  regexpTest,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER,
  PLACEMENT_ADMISSION_SIGNER_LIMITS
} from "./admission-signer-session.mjs";

const TOKEN = /^[\x21-\x7e]{32,4096}$/u;
const KEY_ID = /^peer:[A-Za-z0-9_-]{43}$/u;
const ROLES = freeze(["issuer", "subject"]);
const bufferConcatIntrinsic = Buffer.concat;
const bufferFromIntrinsic = Buffer.from;
const arrayPushIntrinsic = Array.prototype.push;
const reflectApply = Reflect.apply;
const tlsExportKeyingMaterialIntrinsic = TLSSocket.prototype.exportKeyingMaterial;
const UINT8_ARRAY = Uint8Array;

export const PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS = freeze({
  concurrent_requests: 16,
  headers_count: 32,
  headers_timeout_ms: 10_000,
  keep_alive_timeout_ms: 2_000,
  request_timeout_ms: 15_000,
  tls_certificate_bytes: 1024 * 1024,
  tls_private_key_bytes: 256 * 1024
});

export class PlacementAdmissionSignerHttpError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementAdmissionSignerHttpError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementAdmissionSignerHttpError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (keys.length !== expected.length) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", `${label}-keys`);
  }
  const result = objectCreate(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    const entry = ownDataRecordEntry(descriptors, key);
    if (!entry.present) {
      fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", `${label}-keys`);
    }
    result[key] = entry.value;
  }
  requireRealm();
  return result;
}

function normalizedIdentity(source) {
  const value = exactRecord(source, ["key_id", "public_key"], "signer-http-identity");
  if (!regexpTest(KEY_ID, value.key_id) || typeof value.public_key !== "string") {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", "signer-http-identity");
  }
  return freeze({ key_id: value.key_id, public_key: value.public_key });
}

function normalizedRole(value) {
  if (value !== ROLES[0] && value !== ROLES[1]) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", "signer-http-role");
  }
  return value;
}

function normalizedHost(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 255 || isIP(value) === 0) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", "signer-http-host");
  }
  return value;
}

function normalizedPort(value) {
  if (!numberIsSafeInteger(value) || value < 0 || value > 65_535) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT", "signer-http-port");
  }
  return value;
}

function ownedBytes(value, maximum, label) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1 || length > maximum || isSharedByteView(value)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_LIMIT", label);
  }
  return new UINT8_ARRAY(value);
}

function normalizedTls(source) {
  if (source === null) return null;
  const value = exactRecord(source, [
    "certificate_bytes",
    "private_key_bytes"
  ], "signer-http-tls");
  return freeze({
    certificate_bytes: ownedBytes(
      value.certificate_bytes,
      PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.tls_certificate_bytes,
      "signer-http-tls-certificate"
    ),
    private_key_bytes: ownedBytes(
      value.private_key_bytes,
      PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.tls_private_key_bytes,
      "signer-http-tls-private-key"
    )
  });
}

function responseHeaders(contentType, length) {
  return {
    "cache-control": "no-store",
    "content-length": String(length),
    "content-type": contentType,
    "x-content-type-options": "nosniff"
  };
}

function sendBytes(response, status, contentType, bytes) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, responseHeaders(contentType, bytes.byteLength));
  response.end(bytes);
}

function sendJson(response, status, value) {
  sendBytes(response, status, "application/json; charset=utf-8", canonicalBytes(value));
}

function publicError(error) {
  const code = typeof error?.code === "string"
    ? error.code
    : "E_PLACEMENT_ADMISSION_SIGNER_FAILURE";
  const detail = typeof error?.detail === "string" ? error.detail : null;
  return freeze({ code, detail });
}

function errorStatus(error) {
  if (error?.code === "E_PLACEMENT_ADMISSION_SIGNER_EQUIVOCATION") return 409;
  if (
    error?.code === "E_PLACEMENT_ADMISSION_SIGNER_ENDPOINT" ||
    error?.code === "E_PLACEMENT_ADMISSION_SIGNER_IDENTITY" ||
    error?.code === "E_PLACEMENT_ADMISSION_SIGNER_POLICY" ||
    error?.code === "E_PLACEMENT_ADMISSION_SIGNER_ROOT"
  ) return 403;
  if (error?.code === "E_PLACEMENT_ADMISSION_SIGNER_LIMIT") return 413;
  return 400;
}

function authorized(header, tokenBytes) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const candidate = reflectApply(bufferFromIntrinsic, Buffer, [header.slice(7), "utf8"]);
  return candidate.byteLength === tokenBytes.byteLength && timingSafeEqual(candidate, tokenBytes);
}

export function createPlacementAdmissionSignerHttpService(options) {
  requireRealm();
  const source = exactRecord(options, [
    "authorization",
    "host",
    "identity",
    "port",
    "possession_authorization",
    "role",
    "sign_admission_request",
    "sign_deployment_possession",
    "tls"
  ], "signer-http-options");
  if (typeof source.authorization !== "string" || !regexpTest(TOKEN, source.authorization)) {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_AUTHORIZATION", "signer-http-authorization");
  }
  if (typeof source.sign_admission_request !== "function") {
    fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_CAPABILITY", "sign-admission-request");
  }
  const host = normalizedHost(source.host);
  const port = normalizedPort(source.port);
  const identity = normalizedIdentity(source.identity);
  const role = normalizedRole(source.role);
  const tls = normalizedTls(source.tls);
  if (
    (source.possession_authorization === null) !==
      (source.sign_deployment_possession === null) ||
    (source.possession_authorization !== null && (
      tls === null ||
      typeof source.possession_authorization !== "string" ||
      !regexpTest(TOKEN, source.possession_authorization) ||
      source.possession_authorization === source.authorization ||
      typeof source.sign_deployment_possession !== "function"
    ))
  ) fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_CAPABILITY", "deployment-possession");
  const signAdmissionRequest = source.sign_admission_request;
  const signDeploymentPossession = source.sign_deployment_possession;
  const tokenBytes = reflectApply(bufferFromIntrinsic, Buffer, [source.authorization, "utf8"]);
  const possessionTokenBytes = source.possession_authorization === null
    ? null
    : reflectApply(bufferFromIntrinsic, Buffer, [source.possession_authorization, "utf8"]);
  const identityBytes = canonicalBytes({ identity, role });
  let active = 0;
  let listening = false;
  let closed = false;

  const handleRequest = (request, response) => {
    if (closed) {
      sendJson(response, 503, { code: "E_PLACEMENT_ADMISSION_SIGNER_HTTP_CLOSED", detail: null });
      request.resume();
      return;
    }
    if (request.method === "GET" && request.url === "/identity") {
      sendBytes(response, 200, "application/json; charset=utf-8", identityBytes);
      request.resume();
      return;
    }
    const admissionRoute = request.method === "POST" && request.url === "/sign-admission";
    const possessionRoute = request.method === "POST" &&
      request.url === "/prove-deployment-possession" && possessionTokenBytes !== null;
    const routeTokenBytes = possessionRoute ? possessionTokenBytes : tokenBytes;
    if ((!admissionRoute && !possessionRoute) ||
      !authorized(request.headers.authorization, routeTokenBytes)) {
      const authenticated = authorized(request.headers.authorization, routeTokenBytes);
      sendJson(response, authenticated ? 404 : 401, {
        code: authenticated
          ? "E_PLACEMENT_ADMISSION_SIGNER_HTTP_ROUTE"
          : "E_PLACEMENT_ADMISSION_SIGNER_HTTP_UNAUTHORIZED",
        detail: null
      });
      request.resume();
      return;
    }
    if (request.headers["content-type"] !== "application/octet-stream") {
      sendJson(response, 415, {
        code: "E_PLACEMENT_ADMISSION_SIGNER_HTTP_CONTENT_TYPE",
        detail: null
      });
      request.resume();
      return;
    }
    if (active >= PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.concurrent_requests) {
      sendJson(response, 503, {
        code: "E_PLACEMENT_ADMISSION_SIGNER_HTTP_BUSY",
        detail: null
      });
      request.resume();
      return;
    }
    const requestMaximum = possessionRoute
      ? PLACEMENT_ADMISSION_SIGNER_LIMITS.deployment_possession_challenge_bytes
      : PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes;
    const requestLabel = possessionRoute
      ? "deployment-possession-challenge"
      : "signing-request";
    const declared = request.headers["content-length"];
    if (
      declared !== undefined &&
      (
        typeof declared !== "string" || !/^\d+$/u.test(declared) ||
        Number(declared) > requestMaximum
      )
    ) {
      sendJson(response, 413, {
        code: "E_PLACEMENT_ADMISSION_SIGNER_LIMIT",
        detail: requestLabel
      });
      request.resume();
      return;
    }
    active += 1;
    const chunks = [];
    let length = 0;
    let overLimit = false;
    let released = false;
    let streamEnded = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
    };
    request.on("data", (chunk) => {
      length += chunk.byteLength;
      if (length > requestMaximum) {
        overLimit = true;
        chunks.length = 0;
        return;
      }
      if (!overLimit) reflectApply(arrayPushIntrinsic, chunks, [chunk]);
    });
    const abandon = () => {
      streamEnded = true;
      release();
    };
    request.once("aborted", abandon);
    request.once("error", abandon);
    request.once("end", () => {
      if (streamEnded) return;
      streamEnded = true;
      if (overLimit || length < 1) {
        release();
        sendJson(response, overLimit ? 413 : 400, {
          code: overLimit
            ? "E_PLACEMENT_ADMISSION_SIGNER_LIMIT"
            : "E_PLACEMENT_ADMISSION_SIGNER_HTTP_FORMAT",
          detail: requestLabel
        });
        return;
      }
      const bytes = new Uint8Array(reflectApply(bufferConcatIntrinsic, Buffer, [chunks, length]));
      let pending;
      try {
        if (possessionRoute) {
          const exporter = reflectApply(tlsExportKeyingMaterialIntrinsic, request.socket, [
            PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.bytes,
            PLACEMENT_ADMISSION_DEPLOYMENT_POSSESSION_TLS_EXPORTER.label,
            reflectApply(bufferFromIntrinsic, Buffer, [bytes])
          ]);
          pending = signDeploymentPossession(bytes, new Uint8Array(exporter));
        } else {
          pending = signAdmissionRequest(bytes);
        }
      } catch (error) {
        release();
        sendJson(response, errorStatus(error), publicError(error));
        return;
      }
      Promise.resolve(pending).then(
        (signatureBytes) => {
          release();
          sendBytes(
            response,
            200,
            "application/octet-stream",
            new Uint8Array(signatureBytes)
          );
        },
        (error) => {
          release();
          sendJson(response, errorStatus(error), publicError(error));
        }
      );
    });
  };
  const server = tls === null
    ? createHttpServer(handleRequest)
    : createHttpsServer({
      cert: tls.certificate_bytes,
      handshakeTimeout: PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.headers_timeout_ms,
      key: tls.private_key_bytes,
      minVersion: "TLSv1.2"
    }, handleRequest);
  server.maxHeadersCount = PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.headers_count;
  server.headersTimeout = PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.headers_timeout_ms;
  server.keepAliveTimeout = PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.keep_alive_timeout_ms;
  server.requestTimeout = PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.request_timeout_ms;

  const service = {
    async close() {
      if (closed) return;
      closed = true;
      if (!listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      listening = false;
    },
    identity,
    async listen() {
      if (closed) fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_CLOSED", "listen-after-close");
      if (listening) fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_STATE", "already-listening");
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      listening = true;
      const address = server.address();
      if (address === null || typeof address === "string") {
        await service.close();
        fail("E_PLACEMENT_ADMISSION_SIGNER_HTTP_STATE", "listening-address");
      }
      return freeze({ address: address.address, port: address.port });
    },
    protocol: tls === null ? "http" : "https",
    role
  };
  return freeze(service);
}
