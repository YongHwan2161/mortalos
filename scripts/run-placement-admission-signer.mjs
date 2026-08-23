import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createSecureContext } from "node:tls";
import { loadNodeAuthority } from "../cli/node-authority.mjs";
import { isCanonical, parseJsonBytes } from "../src/codec.mjs";
import { createPlacementAdmissionTrustRoot } from "../src/placement/admission.mjs";
import { normalizePlacementAdmissionCeremonyEndpointOrigin } from "../lab/placement/admission-ceremony-binding.mjs";
import {
  createPlacementAdmissionSignerSession,
  derivePlacementAdmissionSignerPolicyDigest
} from "../lab/placement/admission-signer-session.mjs";
import {
  createPlacementAdmissionSignerHttpService,
  PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS
} from "../lab/placement/admission-signer-http-service.mjs";
import {
  createPlacementAdmissionSignerProfile,
  lockPlacementAdmissionSignerProfile
} from "../lab/placement/admission-signer-profile.mjs";

const ARGUMENTS = new Set([
  "--authority",
  "--endpoint-origin",
  "--listen-host",
  "--listen-port",
  "--policy",
  "--profile-state",
  "--role",
  "--root-config",
  "--tls-certificate",
  "--tls-private-key",
  "--trust-root"
]);
const TOKEN = /^[\x21-\x7e]{32,4096}$/u;

function fail(detail) {
  const error = new Error(detail);
  error.code = "E_PLACEMENT_ADMISSION_SIGNER_CLI";
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
    "--authority",
    "--endpoint-origin",
    "--listen-host",
    "--listen-port",
    "--policy",
    "--profile-state",
    "--role"
  ]) {
    if (values[required] === undefined) fail(`missing ${required}`);
  }
  const role = values["--role"];
  if (role !== "issuer" && role !== "subject") fail("role must be issuer or subject");
  if (
    (role === "issuer" && (
      values["--root-config"] === undefined || values["--trust-root"] !== undefined
    )) ||
    (role === "subject" && (
      values["--trust-root"] === undefined || values["--root-config"] !== undefined
    ))
  ) fail("issuer requires only --root-config; subject requires only --trust-root");
  if (
    (values["--tls-certificate"] === undefined) !==
    (values["--tls-private-key"] === undefined)
  ) fail("native TLS requires both --tls-certificate and --tls-private-key");
  return values;
}

async function readCanonicalFile(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail(`${label} file is outside its bounded size`);
  }
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== metadata.size) fail(`${label} file changed while reading`);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail(`${label} file is not valid bounded JSON`);
  }
  if (!isCanonical(bytes, value)) fail(`${label} file must be canonical JSON`);
  return value;
}

async function readOpaqueFile(path, maximum, label) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximum) {
    fail(`${label} file is outside its bounded size`);
  }
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== metadata.size) fail(`${label} file changed while reading`);
  return bytes;
}

async function readTlsConfiguration(values, endpointOrigin) {
  if (values["--tls-certificate"] === undefined) return null;
  if (!endpointOrigin.startsWith("https://")) {
    fail("native TLS requires an https endpoint origin");
  }
  const [certificateBytes, privateKeyBytes] = await Promise.all([
    readOpaqueFile(
      resolve(values["--tls-certificate"]),
      PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.tls_certificate_bytes,
      "TLS certificate"
    ),
    readOpaqueFile(
      resolve(values["--tls-private-key"]),
      PLACEMENT_ADMISSION_SIGNER_HTTP_LIMITS.tls_private_key_bytes,
      "TLS private key"
    )
  ]);
  try {
    createSecureContext({ cert: certificateBytes, key: privateKeyBytes });
  } catch {
    fail("TLS certificate and private key cannot create a secure context");
  }
  return Object.freeze({
    certificate_bytes: certificateBytes,
    private_key_bytes: privateKeyBytes
  });
}

async function run() {
  const values = parseArguments(process.argv.slice(2));
  const token = process.env.MORTALOS_ADMISSION_SIGNER_TOKEN;
  if (typeof token !== "string" || !TOKEN.test(token)) {
    fail("bearer token is required only through MORTALOS_ADMISSION_SIGNER_TOKEN");
  }
  const role = values["--role"];
  const listenPort = Number(values["--listen-port"]);
  if (!Number.isSafeInteger(listenPort) || listenPort < 1 || listenPort > 65_535) {
    fail("listen port is outside 1..65535");
  }
  const endpointOrigin = normalizePlacementAdmissionCeremonyEndpointOrigin(
    values["--endpoint-origin"],
    "signer-cli-endpoint"
  );
  const tls = await readTlsConfiguration(values, endpointOrigin);
  const possessionToken = process.env.MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN;
  if (tls !== null) {
    if (typeof possessionToken !== "string" || !TOKEN.test(possessionToken)) {
      fail("native TLS requires MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN");
    }
    if (possessionToken === token) {
      fail("native TLS possession token must differ from admission bearer token");
    }
  } else if (possessionToken !== undefined) {
    fail("MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN requires native TLS");
  }
  const policy = await readCanonicalFile(resolve(values["--policy"]), 4096, "policy");
  const authority = await loadNodeAuthority(resolve(values["--authority"]), { create: true });
  const signer = Object.freeze({
    destroy() {},
    identity: authority.custodian,
    async sign(request) {
      return (await authority.sign(request)).signature;
    }
  });
  let trustRoot;
  if (role === "issuer") {
    const rootConfig = await readCanonicalFile(
      resolve(values["--root-config"]),
      65_536,
      "root-config"
    );
    trustRoot = createPlacementAdmissionTrustRoot({
      ...rootConfig,
      issuer: signer.identity,
      policy_digest: derivePlacementAdmissionSignerPolicyDigest(policy)
    });
  } else {
    trustRoot = await readCanonicalFile(
      resolve(values["--trust-root"]),
      65_536,
      "trust-root"
    );
  }
  const profile = createPlacementAdmissionSignerProfile({
    endpoint_origin: endpointOrigin,
    identity_key_id: signer.identity.key_id,
    policy_digest: trustRoot.policy_digest,
    role,
    trust_root_id: trustRoot.trust_root_id
  });
  const profileLock = await lockPlacementAdmissionSignerProfile({
    path: resolve(values["--profile-state"]),
    profile_bytes: profile.bytes
  });
  const session = createPlacementAdmissionSignerSession({
    endpoint_origin: endpointOrigin,
    policy,
    role,
    signer,
    trust_root: trustRoot
  });
  const service = createPlacementAdmissionSignerHttpService({
    authorization: token,
    host: values["--listen-host"],
    identity: session.identity,
    port: listenPort,
    possession_authorization: tls === null ? null : possessionToken,
    role: session.role,
    sign_admission_request(bytes) {
      return session.signAdmissionRequest(bytes);
    },
    sign_deployment_possession: tls === null
      ? null
      : (challengeBytes, tlsExporterBytes) => session.signDeploymentPossession(
          challengeBytes,
          tlsExporterBytes
        ),
    tls
  });
  const address = await service.listen();
  process.stdout.write(`${JSON.stringify({
    endpoint_origin: endpointOrigin,
    identity: session.identity,
    listen_address: address.address,
    listen_port: address.port,
    listen_protocol: service.protocol,
    key_possession: service.protocol === "https"
      ? "tls-exporter-role-key-signed"
      : "unavailable",
    pid: process.pid,
    profile_id: profileLock.profile_id,
    profile_status: profileLock.status,
    role: session.role,
    tls_enabled: service.protocol === "https",
    trust_root: trustRoot
  })}\n`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await service.close();
  };
  await new Promise((resolveStop, rejectStop) => {
    const shutdown = () => stop().then(resolveStop, rejectStop);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_SIGNER_CLI",
    detail: error?.detail ?? error?.message ?? "signer service failed"
  })}\n`);
  process.exitCode = 1;
});
