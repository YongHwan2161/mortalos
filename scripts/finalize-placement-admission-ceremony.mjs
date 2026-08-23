import { randomBytes } from "node:crypto";
import { link, lstat, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { equalBytes } from "../src/bytes.mjs";
import {
  PLACEMENT_ADMISSION_CEREMONY_LIMITS,
  finalizePlacementAdmissionCeremonyBundle
} from "../lab/placement/admission-ceremony-client.mjs";
import { PLACEMENT_ADMISSION_SIGNER_LIMITS } from "../lab/placement/admission-signer-session.mjs";

const ARGUMENTS = new Set([
  "--evaluated-at-ms",
  "--issuer-response",
  "--output",
  "--request",
  "--subject-response"
]);

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_CEREMONY_FINALIZE_CLI";
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
  for (const required of [
    "--evaluated-at-ms",
    "--issuer-response",
    "--output",
    "--request",
    "--subject-response"
  ]) {
    if (values[required] === undefined) fail(`missing ${required}`);
  }
  return values;
}

async function readBoundedFile(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail(`${label} file is outside its bounded size`);
  }
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== metadata.size) fail(`${label} file changed while reading`);
  return bytes;
}

async function publishNoReplace(path, bytes) {
  const pending = resolve(
    dirname(path),
    `.mortalos-pending-admission-finalize-${process.pid}-${randomBytes(16).toString("hex")}`
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
    if (!equalBytes(readback, bytes)) fail("published ceremony bundle readback mismatch");
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
  const issuerResponsePath = resolve(values["--issuer-response"]);
  const subjectResponsePath = resolve(values["--subject-response"]);
  const outputPath = resolve(values["--output"]);
  if (
    outputPath === requestPath ||
    outputPath === issuerResponsePath ||
    outputPath === subjectResponsePath
  ) fail("output path must differ from every input path");
  await requireAbsent(outputPath);
  const [requestBytes, issuerResponseBytes, subjectResponseBytes] = await Promise.all([
    readBoundedFile(requestPath, PLACEMENT_ADMISSION_SIGNER_LIMITS.request_bytes, "request"),
    readBoundedFile(
      issuerResponsePath,
      PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
      "issuer response"
    ),
    readBoundedFile(
      subjectResponsePath,
      PLACEMENT_ADMISSION_CEREMONY_LIMITS.role_response_bytes,
      "subject response"
    )
  ]);
  const result = finalizePlacementAdmissionCeremonyBundle({
    evaluated_at_ms: values["--evaluated-at-ms"],
    issuer_response_bytes: issuerResponseBytes,
    request_bytes: requestBytes,
    subject_response_bytes: subjectResponseBytes
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
    code: error?.code ?? "E_PLACEMENT_ADMISSION_CEREMONY_FINALIZE_CLI",
    detail: error?.detail ?? error?.message ?? "ceremony finalization failed"
  })}\n`);
  process.exitCode = 1;
});
