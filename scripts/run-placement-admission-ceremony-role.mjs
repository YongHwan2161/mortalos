import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { equalBytes } from "../src/bytes.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_LIMITS,
  runPlacementAdmissionHttpCeremonyRole
} from "../lab/placement/admission-ceremony-client.mjs";
import { PLACEMENT_ADMISSION_SIGNER_LIMITS } from "../lab/placement/admission-signer-session.mjs";

const ARGUMENTS = new Set([
  "--endpoint",
  "--output",
  "--request",
  "--role",
  "--timeout-ms"
]);

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_CEREMONY_ROLE_CLI";
  throw error;
}

function parseArguments(argv) {
  const values = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!ARGUMENTS.has(name) || value === undefined || values[name] !== undefined) {
      fail("expected unique named argument pairs");
    }
    values[name] = value;
  }
  for (const required of ["--endpoint", "--output", "--request", "--role"]) {
    if (values[required] === undefined) fail(`missing ${required}`);
  }
  if (values["--role"] !== "issuer" && values["--role"] !== "subject") {
    fail("role must be issuer or subject");
  }
  return values;
}

async function readBoundedFile(path, maximum) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail("request file is outside its bounded size");
  }
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== metadata.size) fail("request file changed while reading");
  return bytes;
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-role-${process.pid}-${randomBytes(16).toString("hex")}`
  );
  let handle;
  try {
    handle = await open(pending, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await link(pending, path);
    const readback = new Uint8Array(await readFile(path));
    if (!equalBytes(readback, bytes)) fail("published role response readback mismatch");
  } finally {
    if (handle !== null && handle !== undefined) await handle.close().catch(() => {});
    await unlink(pending).catch(() => {});
  }
}

async function requireAbsent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  fail("output path already exists");
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const requestPath = resolve(values["--request"]);
  const outputPath = resolve(values["--output"]);
  if (requestPath === outputPath) fail("request and output paths must differ");
  await requireAbsent(outputPath);
  const token = process.env.MORTALOS_ADMISSION_SIGNER_TOKEN;
  if (!token) fail("local signer bearer token is required through the environment");
  const timeoutMs = values["--timeout-ms"] === undefined
    ? 15_000
    : Number(values["--timeout-ms"]);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < PLACEMENT_ADMISSION_CEREMONY_LIMITS.timeout_ms_min ||
    timeoutMs > PLACEMENT_ADMISSION_CEREMONY_LIMITS.timeout_ms_max
  ) fail("timeout is outside its bounded range");
  const requestBytes = await readBoundedFile(
    requestPath,
    PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes
  );
  const result = await runPlacementAdmissionHttpCeremonyRole({
    endpoint: { authorization: token, url: values["--endpoint"] },
    request_bytes: requestBytes,
    role: values["--role"],
    timeout_ms: timeoutMs
  });
  await publishNoReplace(outputPath, result.bytes);
  process.stdout.write(`${JSON.stringify({
    endpoint_origin: result.endpoint_origin,
    evidence_id: result.evidence_id,
    output: outputPath,
    role: result.role,
    role_response_id: result.role_response_id,
    status: "verified"
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_CEREMONY_ROLE_CLI",
    detail: error?.detail ?? error?.message ?? "ceremony role failed"
  })}\n`);
  process.exitCode = 1;
});
