import { loadNodeAuthority } from "../cli/node-authority.mjs";
import {
  createPlacementAdmissionSignerSession,
  derivePlacementAdmissionSignerPolicyDigest
} from "../lab/placement/admission-signer-session.mjs";
import { createPlacementAdmissionSignerHttpService } from "../lab/placement/admission-signer-http-service.mjs";
import { createPlacementSigner } from "../lab/placement/storage-contract.mjs";
import { createPlacementAdmissionTrustRoot } from "../src/placement/admission.mjs";

const role = process.argv[2];
const token = process.env.MORTALOS_ADMISSION_SIGNER_TOKEN;
const policySource = process.env.MORTALOS_ADMISSION_SIGNER_POLICY;
if (
  (role !== "issuer" && role !== "subject") || !token || token.length < 32 ||
  !policySource
) {
  throw new Error("admission signer role and bearer token are required");
}

const authorityPath = process.env.MORTALOS_ADMISSION_AUTHORITY_PATH;
let signer;
if (authorityPath) {
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  signer = Object.freeze({
    destroy() {},
    identity: authority.custodian,
    async sign(request) {
      return (await authority.sign(request)).signature;
    }
  });
} else {
  const ephemeral = await createPlacementSigner();
  signer = Object.freeze({
    destroy() { ephemeral.destroy(); },
    identity: ephemeral.identity,
    sign(request) { return ephemeral.sign(request.message); }
  });
}
const policy = JSON.parse(policySource);
let trustRoot;
if (role === "issuer") {
  const config = JSON.parse(process.env.MORTALOS_ADMISSION_ROOT_CONFIG ?? "null");
  trustRoot = createPlacementAdmissionTrustRoot({
    ...config,
    issuer: signer.identity,
    policy_digest: derivePlacementAdmissionSignerPolicyDigest(policy)
  });
} else {
  trustRoot = JSON.parse(process.env.MORTALOS_ADMISSION_TRUST_ROOT ?? "null");
}
let session = null;
let closing = false;
const service = createPlacementAdmissionSignerHttpService({
  authorization: token,
  host: "127.0.0.1",
  identity: signer.identity,
  port: 0,
  possession_authorization: null,
  role,
  sign_admission_request(bytes) {
    if (session === null) {
      throw new Error("placement admission signer session is not ready");
    }
    return session.signAdmissionRequest(bytes);
  },
  sign_deployment_possession: null,
  tls: null
});
const address = await service.listen();
const origin = `http://127.0.0.1:${address.port}`;
const endpointOrigin = process.env.MORTALOS_ADMISSION_ENDPOINT_ORIGIN === "self"
  ? origin
  : process.env.MORTALOS_ADMISSION_ENDPOINT_ORIGIN || null;
session = createPlacementAdmissionSignerSession({
  endpoint_origin: endpointOrigin,
  policy,
  role,
  signer,
  trust_root: trustRoot
});
process.stdout.write(`${JSON.stringify({
  identity: session.identity,
  pid: process.pid,
  role: session.role,
  trust_root: trustRoot,
  url: origin
})}\n`);

async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    await service.close();
  } finally {
    signer.destroy();
    process.exit(0);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
