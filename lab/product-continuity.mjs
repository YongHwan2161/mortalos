import {
  CONTINUITY_SCENARIO_FORMAT,
  CONTINUITY_SCENARIO_STEPS,
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  describeContinuityAuthority,
  handoffContinuity,
  inspectContinuity,
  recoverContinuity
} from "../sdk/continuity.mjs";
import { decodeBase64Url, encodeBase64Url, parseJsonBytes } from "../src/index.mjs";

const reflectApply = Reflect.apply;
const fileArrayBuffer = globalThis.File?.prototype?.arrayBuffer;

function requireAuthority(authority) {
  if (!authority) throw new Error("E_CONTINUITY_AUTHORITY: endpoint-not-initialized");
  return authority;
}

function decode(value) {
  if (typeof value !== "string") throw new TypeError("base64url bytes required");
  return decodeBase64Url(value);
}

function materialized(result) {
  return Object.freeze({
    capsule: encodeBase64Url(result.capsule_bytes),
    copies: Object.freeze(result.copies.map((copy) => encodeBase64Url(copy))),
    head_hash: result.head_hash,
    organism_id: result.organism_id,
    provider_receipts: result.provider_receipts,
    resource_root: result.resource_root,
    resource_size: result.resource_size,
    sequence: result.sequence,
    state_root: result.state_root,
    status: result.status
  });
}

export function installProductContinuityHarness() {
  let authority = null;
  const api = {
    scenario: Object.freeze({
      format: CONTINUITY_SCENARIO_FORMAT,
      steps: CONTINUITY_SCENARIO_STEPS
    }),
    async initialize() {
      if (authority) authority.destroy();
      authority = await createContinuityAuthority();
      return describeContinuityAuthority(authority);
    },
    async create(resourceBase64Url) {
      const endpoint = requireAuthority(authority);
      const resourceBytes = decode(resourceBase64Url);
      return materialized(await createContinuity({
        authority: endpoint,
        resourceBytes,
        transitionId: "lab-real-file-create"
      }));
    },
    async createFromFile(file) {
      const endpoint = requireAuthority(authority);
      if (!fileArrayBuffer || !(file instanceof File)) {
        throw new TypeError("native File required");
      }
      const buffer = await reflectApply(fileArrayBuffer, file, []);
      return materialized(await createContinuity({
        authority: endpoint,
        resourceBytes: new Uint8Array(buffer),
        transitionId: "lab-selected-file-create"
      }));
    },
    inspect(capsule) {
      return inspectContinuity({ capsuleBytes: decode(capsule) });
    },
    evidence(capsule) {
      const capsuleBytes = decode(capsule);
      inspectContinuity({ capsuleBytes });
      const document = parseJsonBytes(capsuleBytes, {
        maxBytes: capsuleBytes.byteLength,
        maxDepth: 64
      });
      return Object.freeze(document.records.map((record) => Object.freeze({
        envelope: parseJsonBytes(decode(record.envelope_base64url), {
          maxBytes: 64 * 1024,
          maxDepth: 64
        }),
        payload: parseJsonBytes(decode(record.event_payload_base64url), {
          maxBytes: 64 * 1024,
          maxDepth: 64
        })
      })));
    },
    async handoffRequest(capsule) {
      const endpoint = requireAuthority(authority);
      const capsuleBytes = decode(capsule);
      return handoffContinuity({ authority: endpoint, capsuleBytes, phase: "request" });
    },
    async handoffPropose(capsule, request) {
      const endpoint = requireAuthority(authority);
      const capsuleBytes = decode(capsule);
      return handoffContinuity({
        authority: endpoint,
        capsuleBytes,
        phase: "propose",
        request
      });
    },
    async handoffAccept(capsule, proposal) {
      const endpoint = requireAuthority(authority);
      const capsuleBytes = decode(capsule);
      return materialized(await handoffContinuity({
        authority: endpoint,
        capsuleBytes,
        phase: "accept",
        proposal
      }));
    },
    recover(copies, expectedHeadHash, expectedOrganismId) {
      const endpoint = requireAuthority(authority);
      const copyBytes = copies.map((copy) => decode(copy));
      const recovered = recoverContinuity({
        authority: endpoint,
        copies: copyBytes,
        expectedHeadHash,
        expectedOrganismId,
        quorum: 2
      });
      return Object.freeze({
        capsule: encodeBase64Url(recovered.capsule_bytes),
        head_hash: recovered.head_hash,
        organism_id: recovered.organism_id,
        rejected_copies: recovered.rejected_copies,
        resource: encodeBase64Url(recovered.resource_bytes),
        resource_root: recovered.resource_root,
        sequence: recovered.sequence,
        status: recovered.status,
        valid_copies: recovered.valid_copies
      });
    },
    async continue(capsule, expectedHeadHash, resource) {
      const endpoint = requireAuthority(authority);
      const capsuleBytes = decode(capsule);
      const resourceBytes = decode(resource);
      return materialized(await continueContinuity({
        authority: endpoint,
        capsuleBytes,
        expectedHeadHash,
        resourceBytes,
        transitionId: "lab-recovered-file-continue"
      }));
    },
    terminate() {
      if (authority) authority.destroy();
      authority = null;
      return Object.freeze({ status: "authority-destroyed" });
    }
  };
  globalThis.__MORTALOS_PRODUCT_CONTINUITY__ = Object.freeze(api);
  return globalThis.__MORTALOS_PRODUCT_CONTINUITY__;
}
