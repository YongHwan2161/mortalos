import { readFile } from "node:fs/promises";
import {
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  handoffContinuity,
  recoverContinuity
} from "../sdk/continuity.mjs";
import { decodeBase64Url, encodeBase64Url } from "../src/index.mjs";

const authority = await createContinuityAuthority();

function bytes(value) {
  return decodeBase64Url(value);
}

function materialized(result) {
  return {
    capsule: encodeBase64Url(result.capsule_bytes),
    copies: result.copies.map((copy) => encodeBase64Url(copy)),
    head_hash: result.head_hash,
    organism_id: result.organism_id,
    resource_root: result.resource_root,
    sequence: result.sequence
  };
}

async function handle(message) {
  if (message.command === "create") {
    return materialized(await createContinuity({
      authority,
      resourceBytes: new Uint8Array(await readFile(message.resource_path)),
      transitionId: "node-process-create"
    }));
  }
  if (message.command === "handoff-request") {
    return handoffContinuity({
      authority,
      capsuleBytes: bytes(message.capsule),
      phase: "request"
    });
  }
  if (message.command === "handoff-propose") {
    return handoffContinuity({
      authority,
      capsuleBytes: bytes(message.capsule),
      phase: "propose",
      request: message.request
    });
  }
  if (message.command === "handoff-accept") {
    return materialized(await handoffContinuity({
      authority,
      capsuleBytes: bytes(message.capsule),
      phase: "accept",
      proposal: message.proposal
    }));
  }
  if (message.command === "recover") {
    const recovered = recoverContinuity({
      authority,
      copies: message.copies.map(bytes),
      expectedHeadHash: message.expected_head,
      expectedOrganismId: message.expected_organism,
      quorum: 2
    });
    return {
      capsule: encodeBase64Url(recovered.capsule_bytes),
      head_hash: recovered.head_hash,
      organism_id: recovered.organism_id,
      rejected_copies: recovered.rejected_copies.length,
      resource: encodeBase64Url(recovered.resource_bytes),
      sequence: recovered.sequence,
      valid_copies: recovered.valid_copies
    };
  }
  if (message.command === "continue") {
    return materialized(await continueContinuity({
      authority,
      capsuleBytes: bytes(message.capsule),
      expectedHeadHash: message.expected_head,
      resourceBytes: bytes(message.resource),
      transitionId: "node-process-continue"
    }));
  }
  if (message.command === "terminate") {
    authority.destroy();
    return { status: "authority-destroyed" };
  }
  throw new Error(`unknown endpoint command: ${message.command}`);
}

process.on("message", async (message) => {
  try {
    const result = await handle(message);
    process.send?.({ id: message.id, ok: true, result }, () => {
      if (message.command === "terminate") process.disconnect();
    });
  } catch (error) {
    process.send?.({
      error: { code: error?.code ?? "E_ENDPOINT", message: String(error?.message ?? error) },
      id: message.id,
      ok: false
    });
  }
});

process.send?.({
  custodian: authority.custodian,
  event: "ready",
  private_material_exposed: false
});
