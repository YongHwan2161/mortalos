import {
  canonicalBytes,
  decodeBase64Url,
  encodeBase64Url
} from "../src/index.mjs";
import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import { createResourceStorageExecutionResult } from "../src/resource-execution.mjs";
import {
  publishStatePackageChunks,
  RelayChunkRecoveryAdapter
} from "../src/transport/chunk-data-plane.mjs";
import {
  createResourcePlacementArtifactMessage,
  decodeRelayFrame,
  openResourcePlacementArtifact
} from "../src/transport/protocol.mjs";
import { ManualWebRtcParticipantTransport } from "./transport/webrtc-peer.mjs";
import { createPlacementSigner } from "./placement/storage-contract.mjs";

const fileArrayBuffer = globalThis.File?.prototype?.arrayBuffer;
const reflectApply = Reflect.apply;

function documentBytes(value) {
  if (typeof value !== "string") throw new TypeError("base64url document required");
  return decodeBase64Url(value);
}

function splitResource(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.byteLength; offset += PROTOCOL_PROFILE.state.chunk_bytes) {
    chunks.push(bytes.slice(offset, offset + PROTOCOL_PROFILE.state.chunk_bytes));
  }
  return chunks;
}

function materialize(value) {
  return JSON.parse(JSON.stringify(value));
}

export function installP2pPlacementHarness() {
  let artifacts = [];
  let resource = null;
  const signers = new Map();
  let transport = null;
  let unsubscribe = null;

  async function ensureSigner(name) {
    if (typeof name !== "string" || !/^[a-z][a-z0-9-]{0,31}$/u.test(name)) {
      throw new TypeError("bounded signer name required");
    }
    if (!signers.has(name)) signers.set(name, await createPlacementSigner());
    return signers.get(name);
  }

  function bind(next) {
    unsubscribe?.();
    transport?.close();
    transport = next;
    artifacts = [];
    unsubscribe = transport.subscribe((frame) => {
      const opened = decodeRelayFrame(frame);
      if (opened.control?.kind === "resource-placement-artifact") {
        artifacts.push(openResourcePlacementArtifact(opened.control));
      }
    });
  }

  async function publishResourceBytes(bytes, requestId) {
    resource = new Uint8Array(bytes);
    const descriptors = await publishStatePackageChunks({
      chunkBytes: splitResource(resource),
      transport
    });
    await api.publishArtifact(
      "resource-descriptors",
      requestId,
      encodeBase64Url(canonicalBytes({
        descriptors: materialize(descriptors),
        format: "mortalos-p2p-resource-descriptors/1",
        resource_size: String(resource.byteLength)
      }))
    );
    return Object.freeze({ descriptors: materialize(descriptors), resource_size: resource.byteLength });
  }

  const api = {
    async initialize(role) {
      if (!new Set(["consumer", "provider"]).has(role)) throw new TypeError("consumer or provider role required");
      const signer = await ensureSigner("primary");
      return Object.freeze({
        identity: signer.identity,
        private_material_exposed: false,
        role
      });
    },
    async createSigner(name) {
      return (await ensureSigner(name)).identity;
    },
    async sign(name, messageBase64Url) {
      return (await ensureSigner(name)).sign(documentBytes(messageBase64Url));
    },
    async startOffer(endpointId) {
      const created = await ManualWebRtcParticipantTransport.createOffer({ endpointId });
      bind(created.transport);
      return created.signal;
    },
    async acceptOffer(endpointId, offer) {
      const accepted = await ManualWebRtcParticipantTransport.acceptOffer({ endpointId, offer });
      bind(accepted.transport);
      return accepted.signal;
    },
    async completeAnswer(answer) {
      await transport.complete(answer);
      await transport.ready();
      return api.snapshot();
    },
    async ready() {
      await transport.ready();
      return api.snapshot();
    },
    async publishArtifact(artifactKind, requestId, payloadBase64Url) {
      const response = await transport.publish(canonicalBytes(createResourcePlacementArtifactMessage({
        artifactKind,
        payloadBytes: documentBytes(payloadBase64Url),
        requestId
      })));
      return response.frame.message_id;
    },
    async waitArtifact(artifactKind, requestId, timeoutMs = 10_000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const index = artifacts.findIndex((entry) =>
          entry.artifact_kind === artifactKind && entry.request_id === requestId);
        if (index >= 0) {
          const [entry] = artifacts.splice(index, 1);
          return Object.freeze({
            artifact_kind: entry.artifact_kind,
            payload: materialize(entry.payload),
            payload_base64url: encodeBase64Url(entry.payload_bytes),
            request_id: entry.request_id
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`P2P_ARTIFACT_TIMEOUT: ${artifactKind}/${requestId}`);
    },
    async publishFile(file, requestId) {
      if (!fileArrayBuffer || !(file instanceof File)) throw new TypeError("native File required");
      const buffer = await reflectApply(fileArrayBuffer, file, []);
      return publishResourceBytes(new Uint8Array(buffer), requestId);
    },
    async publishResource(resourceBase64Url, requestId) {
      return publishResourceBytes(documentBytes(resourceBase64Url), requestId);
    },
    async publishStoredResource(requestId) {
      if (!resource) throw new Error("P2P_RESOURCE: no stored resource");
      return publishResourceBytes(resource, requestId);
    },
    async recoverResource(requestId) {
      const received = await api.waitArtifact("resource-descriptors", requestId);
      if (
        received.payload.format !== "mortalos-p2p-resource-descriptors/1" ||
        !Array.isArray(received.payload.descriptors)
      ) throw new Error("P2P_RESOURCE_DESCRIPTOR: invalid");
      const adapter = new RelayChunkRecoveryAdapter({
        descriptors: received.payload.descriptors,
        transport: { readRange: (after, limit) => transport.fetchRange(after, limit) }
      });
      const chunks = [];
      let size = 0;
      for (const descriptor of received.payload.descriptors) {
        const chunk = await adapter.readChunk(descriptor.chunk_digest);
        if (!chunk) throw new Error("P2P_RESOURCE_CHUNK: unavailable");
        chunks.push(chunk);
        size += chunk.byteLength;
      }
      if (String(size) !== received.payload.resource_size) throw new Error("P2P_RESOURCE_SIZE: mismatch");
      resource = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        resource.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return Object.freeze({ resource_base64url: encodeBase64Url(resource), resource_size: size });
    },
    createStorageResult({ challenge, lease, offer, previous_execution_receipts = [], usage_receipts = [] }) {
      if (!resource) throw new Error("P2P_RESOURCE: provider has no stored resource");
      return createResourceStorageExecutionResult({
        offer: documentBytes(offer),
        lease: documentBytes(lease),
        previous_execution_receipts: previous_execution_receipts.map(documentBytes),
        usage_receipts: usage_receipts.map(documentBytes),
        challenge: documentBytes(challenge),
        resource_bytes: resource
      });
    },
    corruptStoredResource(offset = 0) {
      if (!resource || !Number.isSafeInteger(offset) || offset < 0 || offset >= resource.byteLength) {
        throw new Error("P2P_RESOURCE: invalid corruption offset");
      }
      resource[offset] ^= 1;
      return Object.freeze({ resource_size: resource.byteLength, status: "corrupted-for-test" });
    },
    snapshot() {
      return Object.freeze({
        artifact_queue: artifacts.length,
        endpoint_id: transport?.endpointId ?? null,
        private_material_exposed: false,
        remote_endpoint_id: transport?.remoteEndpointId ?? null,
        resource_size: resource?.byteLength ?? 0,
        signer_count: signers.size,
        transport: transport?.state ?? "none"
      });
    },
    closeTransport() {
      unsubscribe?.();
      unsubscribe = null;
      transport?.close();
      transport = null;
    },
    destroy() {
      api.closeTransport();
      for (const signer of signers.values()) signer.destroy();
      signers.clear();
      resource?.fill(0);
      resource = null;
      artifacts = [];
      return Object.freeze({ status: "destroyed" });
    }
  };
  globalThis.__MORTALOS_P2P_PLACEMENT__ = Object.freeze(api);
  return globalThis.__MORTALOS_P2P_PLACEMENT__;
}

installP2pPlacementHarness();
