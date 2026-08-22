import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { equalBytes } from "../src/bytes.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_LIMITS,
  runPlacementAdmissionHttpCeremony
} from "../lab/placement/admission-ceremony-client.mjs";
import { PLACEMENT_ADMISSION_SIGNER_LIMITS } from "../lab/placement/admission-signer-session.mjs";

const ARGUMENTS = new Set([
  "--evaluated-at-ms",
  "--issuer",
  "--output",
  "--request",
  "--subject",
  "--timeout-ms"
]);

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_CEREMONY_CLI";
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
  for (const required of ["--evaluated-at-ms", "--issuer", "--output", "--request", "--subject"]) {
    if (values[required] === undefined) fail(`missing ${required}`);
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
    `.mortalos-pending-admission-${process.pid}-${randomBytes(16).toString("hex")}`
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
    if (!equalBytes(readback, bytes)) fail("published bundle readback mismatch");
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
  const issuerToken = process.env.MORTALOS_ADMISSION_ISSUER_TOKEN;
  const subjectToken = process.env.MORTALOS_ADMISSION_SUBJECT_TOKEN;
  if (!issuerToken || !subjectToken) {
    fail("issuer and subject bearer tokens are required through environment variables");
  }
  const requestPath = resolve(values["--request"]);
  const outputPath = resolve(values["--output"]);
  if (requestPath === outputPath) fail("request and output paths must differ");
  await requireAbsent(outputPath);
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
  const result = await runPlacementAdmissionHttpCeremony({
    evaluated_at_ms: values["--evaluated-at-ms"],
    issuer: { authorization: issuerToken, url: values["--issuer"] },
    request_bytes: requestBytes,
    subject: { authorization: subjectToken, url: values["--subject"] },
    timeout_ms: timeoutMs
  });
  await publishNoReplace(outputPath, result.bytes);
  process.stdout.write(`${JSON.stringify({
    bundle_id: result.bundle_id,
    evidence_id: result.evidence_id,
    issuer_origin: result.issuer.endpoint_origin,
    output: outputPath,
    status: result.status,
    subject_origin: result.subject.endpoint_origin
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_CEREMONY_CLI",
    detail: error?.detail ?? error?.message ?? "ceremony failed"
  })}\n`);
  process.exitCode = 1;
});
