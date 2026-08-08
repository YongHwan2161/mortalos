import {
  generateKeyPairSync,
  sign
} from "node:crypto";
import {
  LinearizableCounterAuthority,
  MemoryCounterAuthorityStore,
  deriveConfidentialEpochId,
  deriveCounterAuthorityId
} from "../src/confidential/counter.mjs";
import {
  registerCounterAuthorityStoreInternal
} from "../src/confidential/counter-authority-internal.mjs";
import {
  canonicalBytes
} from "../src/codec.mjs";
import {
  derivePeerId,
  encodeBase64Url,
  validateGenesis,
  validatePulse
} from "../src/index.mjs";
import {
  randomTagged
} from "../src/confidential/format.mjs";
import {
  generateCustodianEncryptionKeyPair
} from "../src/confidential/keys.mjs";
import {
  createConfidentialPackage
} from "../src/confidential/package.mjs";
import {
  confidentialRotationAuthorizationMessage
} from "../src/confidential/recovery.mjs";
import {
  createInitialState
} from "../src/state/engine.mjs";
import {
  assembleParticipantGenesis,
  createParticipantGenesisBody,
  genesisSigningRequest,
  ParticipantCore,
  pulseEnvelope
} from "../lab/participant/core.mjs";

function protocolActor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), privateKey, public_key };
}

function compareTags(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function publicProtocolActor(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

function protocolSignature(actor, message) {
  return {
    key_id: actor.key_id,
    signature: `ed25519:${encodeBase64Url(sign(null, message, actor.privateKey))}`
  };
}

function createRotationContext(seed = 41) {
  const actors = Array.from({ length: 3 }, protocolActor).sort((left, right) =>
    compareTags(left.key_id, right.key_id));
  const body = createParticipantGenesisBody({
    custodians: actors.map(publicProtocolActor),
    initialQuorum: { type: "threshold", threshold: 2 },
    initialStateBytes: createInitialState(new Uint8Array(16).fill(seed)),
    nonce: `nonce:${encodeBase64Url(new Uint8Array(16).fill(seed + 1))}`
  });
  const approvals = actors.map((actor) => {
    const request = genesisSigningRequest(body, actor.key_id);
    return protocolSignature(actor, request.message);
  });
  const genesis = assembleParticipantGenesis(body, approvals, {
    requireAllOriginApprovals: true
  });
  const currentHead = validateGenesis(canonicalBytes(genesis.envelope));
  if (currentHead.status !== "accept") throw new Error("rotation Genesis rejected");
  const core = new ParticipantCore("s4_rotation");
  core.openGenesis(genesis, [], { requireAllOriginApprovals: true });
  return Object.freeze({ actors, core, currentHead, genesis });
}

export function createRotationAuthorization(context, rotation) {
  const message = confidentialRotationAuthorizationMessage(rotation);
  return Object.freeze({
    approvals: context.actors
      .slice(0, context.currentHead.next_custody_descriptor.quorum.threshold)
      .map((actor) => protocolSignature(actor, message))
      .sort((left, right) => compareTags(left.key_id, right.key_id)),
    format: "mortalos-confidential-rotation-authorization/1",
    rotation
  });
}

export function createNextMembershipHead(context) {
  const added = protocolActor();
  const nextActors = [
    context.actors[1],
    context.actors[2],
    added
  ].sort((left, right) => compareTags(left.key_id, right.key_id));
  const payload = { format: "mortalos-confidential-membership-head/1" };
  const proposal = context.core.createMembershipProposal({
    nextCustodians: nextActors.map(publicProtocolActor),
    nextQuorum: { type: "threshold", threshold: 2 },
    payload
  });
  const approvals = context.actors.slice(0, 2).map((actor) =>
    protocolSignature(
      actor,
      context.core.approvalRequest(proposal, actor.key_id).message
    ));
  const acceptanceRequest = context.core.acceptanceRequest(proposal, added.key_id);
  const envelope = pulseEnvelope(
    proposal.body,
    approvals,
    [protocolSignature(added, acceptanceRequest.message)]
  );
  const nextHead = validatePulse({
    envelopeBytes: canonicalBytes(envelope),
    eventPayloadBytes: canonicalBytes(payload),
    genesis: context.currentHead,
    parent: context.currentHead
  });
  if (nextHead.status !== "accept") throw new Error("rotation membership head rejected");
  return Object.freeze({ added, nextActors, nextHead });
}

export function deterministicSecret(size = 1_048_576) {
  const bytes = new Uint8Array(size);
  const marker = new TextEncoder().encode(
    "MORTALOS-S4-PLAINTEXT-MARKER-DO-NOT-LEAK:"
  );
  bytes.set(marker);
  for (let index = marker.byteLength; index < bytes.byteLength; index += 1) {
    bytes[index] =
      (index * 97 + (index >>> 8) * 31 + (index >>> 16) * 13 + 19) & 0xff;
  }
  return bytes;
}

// Test-only model of a compromised external custody service. The raw key never
// leaves this helper; production APIs expose no equivalent construction path.
export async function createForkableCounterAuthorityPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const authorityPublicKey = `ed25519:${encodeBase64Url(raw)}`;
  const material = Object.freeze({
    authorityId: deriveCounterAuthorityId(authorityPublicKey),
    authorityPublicKey,
    privateKey: keyPair.privateKey
  });
  const createStore = () => {
    let lost = false;
    let record = null;
    const store = {};
    const authorityLost = () => {
      const error = new Error("E_CONFIDENTIAL_COUNTER_AUTHORITY: test custody lost");
      error.code = "E_CONFIDENTIAL_COUNTER_AUTHORITY";
      throw error;
    };
    const inspect = async () => {
      if (lost) authorityLost();
      return record === null ? null : structuredClone(record);
    };
    const transact = async (_epochId, operation) => {
      if (lost) authorityLost();
      const outcome = await operation(record === null ? null : structuredClone(record));
      record = outcome.next === null ? null : structuredClone(outcome.next);
      return outcome.value;
    };
    registerCounterAuthorityStoreInternal(store, {
      inspect,
      loadAuthorityCapability: async () => Object.freeze({
        authorityId: material.authorityId,
        authorityPublicKey: material.authorityPublicKey,
        sign: async (message) => new Uint8Array(
          await crypto.subtle.sign("Ed25519", material.privateKey, new Uint8Array(message))
        )
      }),
      transact
    });
    Object.defineProperties(store, {
      inspect: { value: inspect },
      lose: { value: async () => { lost = true; record = null; } },
      transact: { value: transact }
    });
    return Object.freeze(store);
  };
  const leftStore = createStore();
  const rightStore = createStore();
  return Object.freeze({
    left: await LinearizableCounterAuthority.create({ store: leftStore }),
    leftStore,
    right: await LinearizableCounterAuthority.create({ store: rightStore }),
    rightStore
  });
}

export async function createConfidentialFixture({
  counterAuthority = null,
  counterAuthorityStore = null,
  custodianCount = 3,
  epoch = "0",
  priorConfidentialRoot = randomTagged("sha256:"),
  resourceBytes = deterministicSecret(131_072),
  transitionId = "s4-reference"
} = {}) {
  if (!Number.isSafeInteger(custodianCount) || custodianCount < 1 || custodianCount > 3) {
    throw new TypeError("custodianCount must be between one and three");
  }
  const rotationContext = createRotationContext();
  const counterStore = counterAuthorityStore ?? new MemoryCounterAuthorityStore();
  const authority = counterAuthority ?? await LinearizableCounterAuthority.create({
    store: counterStore
  });
  const counterKeyMaterial = Object.freeze({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key
  });
  const keyPairs = [];
  for (let index = 0; index < custodianCount; index += 1) {
    keyPairs.push(
      await generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:"))
    );
  }
  const custodians = keyPairs
    .map(({ descriptor }) => descriptor)
    .sort((left, right) =>
      left.custodian_id.localeCompare(right.custodian_id)
    );
  const organismId = rotationContext.currentHead.organism_id;
  const membershipHead = rotationContext.currentHead.object_hash;
  const resourceId = randomTagged("mortalos-resource:");
  const epochId = deriveConfidentialEpochId({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key,
    custodianEncryptionKeys: custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch,
    membershipHead,
    organismId,
    transitionId
  });
  const confidentialPackage = await createConfidentialPackage({
    authority,
    custodians,
    epoch,
    epochId,
    membershipHead,
    organismId,
    priorConfidentialRoot,
    resourceBytes,
    resourceId,
    transitionId
  });
  return Object.freeze({
    authority,
    confidentialPackage,
    counterKeyMaterial,
    counterStore,
    custodians,
    epoch,
    epochId,
    keyPairs,
    membershipHead,
    organismId,
    priorConfidentialRoot,
    resourceBytes,
    resourceId,
    rotationContext,
    transitionId
  });
}

export function keyPairFor(fixture, custodian) {
  return fixture.keyPairs.find(
    ({ descriptor }) => descriptor.custodian_id === custodian.custodian_id
  );
}
