import {
  decodeBase64Url,
  encodeBase64Url,
  equalBytes
} from "./bytes.mjs";
import { canonicalBytes, parseJsonBytes, snapshotBytes } from "./codec.mjs";
import {
  custodyAcceptanceMessage,
  custodyCommitment,
  derivePeerId,
  derivePulseHash,
  eventPayloadHash,
  genesisApprovalMessage,
  pulseApprovalMessage,
  verifyEd25519
} from "./crypto.mjs";
import { createContinuityCapsule, verifyContinuityCapsule } from "./capsule.mjs";
import { CUSTODY_LIMITS, recoverContinuityCapsuleQuorum } from "./custody.mjs";
import { PROTOCOL_PROFILE } from "./generated/protocol-profile.mjs";
import { createLineage } from "./lineage.mjs";
import {
  copyBoundedOwnDataArray,
  freeze,
  ownDataArrayLength,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotNamedOwnDataValues
} from "./primordials.mjs";
import {
  createInitialState,
  PULSE_SEED_V1_GENOME_BYTES,
  stateGenomeHash,
  stateRoot
} from "./state/engine.mjs";
import {
  createStatePackageInput,
  createStatePackageTransitionPayload,
  statePackageResourceRoot
} from "./state/package.mjs";
import {
  publishStatePackageChunks,
  RelayChunkRecoveryAdapter
} from "./transport/chunk-data-plane.mjs";
import {
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "./transport/protocol.mjs";
import {
  isValidatedLatentSuccessor,
  validateLatentSuccessor
} from "./validator.mjs";

export const CONTINUITY_HANDOFF_REQUEST_FORMAT = "mortalos-continuity-handoff-request/1";
export const CONTINUITY_HANDOFF_PROPOSAL_FORMAT = "mortalos-continuity-handoff-proposal/1";
export const CONTINUITY_RESULT_FORMAT = "mortalos-continuity-result/1";
export const CONTINUITY_SCENARIO_FORMAT = "mortalos-continuity-scenario/1";
export const CONTINUITY_SCENARIO_STEPS = freeze([
  "create-real-resource",
  "request-custody",
  "propose-handoff",
  "accept-handoff",
  "terminate-origin",
  "recover-two-of-three",
  "continue-lineage",
  "verify-fresh-process"
]);

const subtle = globalThis.crypto?.subtle;
const subtlePrototype = globalThis.SubtleCrypto?.prototype;
const cryptoKeyPrototype = globalThis.CryptoKey?.prototype;
const reflectApply = Reflect.apply;
const authorityBrand = new WeakSet();
const weakSetAdd = WeakSet.prototype.add;
const weakSetHas = WeakSet.prototype.has;
const subtleExportKey = subtlePrototype?.exportKey;
const subtleGenerateKey = subtlePrototype?.generateKey;
const subtleSign = subtlePrototype?.sign;
const cryptoKeyExtractable = cryptoKeyPrototype
  ? Object.getOwnPropertyDescriptor(cryptoKeyPrototype, "extractable")?.get
  : null;
const cryptoKeyType = cryptoKeyPrototype
  ? Object.getOwnPropertyDescriptor(cryptoKeyPrototype, "type")?.get
  : null;
const cryptoKeyUsages = cryptoKeyPrototype
  ? Object.getOwnPropertyDescriptor(cryptoKeyPrototype, "usages")?.get
  : null;

export class ContinuityError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "ContinuityError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new ContinuityError(code, detail);
}

function ownBytes(value, maximum, label) {
  try {
    return snapshotBytes(value, maximum);
  } catch {
    fail("E_CONTINUITY_INPUT", `${label}-bytes`);
  }
}

function ownToken(value, label, prefix = null) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 96 ||
    (prefix ? !value.startsWith(prefix) : !/^[A-Za-z0-9._-]+$/u.test(value))
  ) {
    fail("E_CONTINUITY_INPUT", label);
  }
  return value;
}

function ownTuple(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[A-Za-z0-9._:-]+$/u.test(value)
  ) fail("E_CONTINUITY_INPUT", "sign-once-tuple");
  return value;
}

function ownJson(value, label) {
  try {
    return parseJsonBytes(canonicalBytes(value), { maxBytes: 1_048_576, maxDepth: 64 });
  } catch {
    fail("E_CONTINUITY_INPUT", `${label}-json`);
  }
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_CONTINUITY_INPUT", `${label}-object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_CONTINUITY_INPUT", `${label}-keys`);
  }
}

function ownCustodian(value, label = "custodian") {
  const owned = ownJson(value, label);
  exactKeys(owned, ["key_id", "public_key"], label);
  if (derivePeerId(owned.public_key) !== owned.key_id) {
    fail("E_CONTINUITY_AUTHORITY", `${label}-identity`);
  }
  return freeze(owned);
}

function snapshotAuthority(authority, label = "authority") {
  const [custodian] = snapshotNamedOwnDataValues(authority, ["custodian"], label);
  const sign = snapshotDataMethod(authority, "sign", label);
  return freeze({ custodian: ownCustodian(custodian, `${label}-custodian`), sign });
}

function sortEvidence(entries) {
  return [...entries].sort((left, right) => left.key_id.localeCompare(right.key_id));
}

function randomBytes(length) {
  if (!globalThis.crypto?.getRandomValues) fail("E_CONTINUITY_CRYPTO", "random-unavailable");
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function taggedRandom(prefix) {
  return `${prefix}${encodeBase64Url(randomBytes(16))}`;
}

function keyProperty(getter, key) {
  return reflectApply(getter, key, []);
}

async function assertPrivateKey(privateKey) {
  if (!subtle || !subtleExportKey || !cryptoKeyExtractable || !cryptoKeyType || !cryptoKeyUsages) {
    fail("E_CONTINUITY_CRYPTO", "native-webcrypto-required");
  }
  let extractable;
  let type;
  let usages;
  try {
    extractable = keyProperty(cryptoKeyExtractable, privateKey);
    type = keyProperty(cryptoKeyType, privateKey);
    usages = keyProperty(cryptoKeyUsages, privateKey);
  } catch {
    fail("E_CONTINUITY_CRYPTO", "native-cryptokey-required");
  }
  if (extractable !== false || type !== "private" || usages.length !== 1 || usages[0] !== "sign") {
    fail("E_CONTINUITY_CRYPTO", "non-extractable-signing-key-required");
  }
  let rejected = false;
  try {
    await reflectApply(subtleExportKey, subtle, ["pkcs8", privateKey]);
  } catch {
    rejected = true;
  }
  if (!rejected) fail("E_CONTINUITY_CRYPTO", "private-export-succeeded");
}

export async function createContinuityAuthority() {
  if (!subtle || !subtleGenerateKey || !subtleSign || !subtleExportKey) {
    fail("E_CONTINUITY_CRYPTO", "ed25519-webcrypto-unavailable");
  }
  const generated = await reflectApply(subtleGenerateKey, subtle, [
    { name: "Ed25519" }, false, ["sign", "verify"]
  ]);
  await assertPrivateKey(generated.privateKey);
  const raw = new Uint8Array(await reflectApply(subtleExportKey, subtle, ["raw", generated.publicKey]));
  const publicKey = `ed25519:${encodeBase64Url(raw)}`;
  const custodian = freeze({ key_id: derivePeerId(publicKey), public_key: publicKey });
  const journal = new Map();
  let privateKey = generated.privateKey;
  const authority = {
    custodian,
    destroy() {
      privateKey = null;
      journal.clear();
    },
    async sign(request) {
      const [messageSource, tupleSource] = snapshotNamedOwnDataValues(
        request,
        ["message", "tuple"],
        "continuity signing request"
      );
      const message = ownBytes(messageSource, 4_096, "signing-message");
      const tuple = ownTuple(tupleSource);
      if (!privateKey) fail("E_CONTINUITY_AUTHORITY", "authority-destroyed");
      const body = encodeBase64Url(message);
      const prior = journal.get(tuple);
      if (prior && prior !== body) fail("E_CONTINUITY_EQUIVOCATION", tuple);
      journal.set(tuple, body);
      await assertPrivateKey(privateKey);
      const signature = new Uint8Array(
        await reflectApply(subtleSign, subtle, ["Ed25519", privateKey, message])
      );
      return freeze({
        key_id: custodian.key_id,
        signature: `ed25519:${encodeBase64Url(signature)}`
      });
    }
  };
  const frozenAuthority = freeze(authority);
  reflectApply(weakSetAdd, authorityBrand, [frozenAuthority]);
  return frozenAuthority;
}

export function describeContinuityAuthority(authority) {
  if (!reflectApply(weakSetHas, authorityBrand, [authority])) {
    fail("E_CONTINUITY_AUTHORITY", "unbranded-authority");
  }
  const snapshot = snapshotAuthority(authority);
  return freeze({
    custodian: snapshot.custodian,
    non_extractable: true,
    private_material_exposed: false
  });
}

async function signWithAuthority(authority, messageSource, tuple) {
  const message = ownBytes(messageSource, 4_096, "authority-message");
  const result = await authority.sign(freeze({ message, tuple }));
  const owned = ownJson(result, "authority-result");
  exactKeys(owned, ["key_id", "signature"], "authority-result");
  if (
    owned.key_id !== authority.custodian.key_id ||
    !verifyEd25519(authority.custodian.public_key, message, owned.signature)
  ) {
    fail("E_CONTINUITY_AUTHORITY", "signature-verification");
  }
  return freeze(owned);
}

function genesisBody({ avatarSeed, authority, nonce }) {
  const initialStateBytes = createInitialState(avatarSeed);
  return {
    body: {
      genome_base64url: encodeBase64Url(PULSE_SEED_V1_GENOME_BYTES),
      genome_hash: stateGenomeHash(PULSE_SEED_V1_GENOME_BYTES),
      hash_algorithm: "sha-256",
      initial_custodians: [authority.custodian],
      initial_quorum: { threshold: 1, type: "threshold" },
      initial_state_base64url: encodeBase64Url(initialStateBytes),
      initial_state_root: stateRoot(initialStateBytes),
      nonce,
      protocol_version: "mortalos/1",
      signature_algorithm: "ed25519"
    },
    initialStateBytes
  };
}

function pulseBody({ eventKind, genomeHash, nextCustodians, organismId, parent, payload, stateRoot: nextStateRoot }) {
  return {
    current_custody_hash: custodyCommitment(parent.next_custody_descriptor),
    event: { kind: eventKind, payload_hash: eventPayloadHash(payload) },
    genome_hash: genomeHash,
    next_custodians: [...nextCustodians].sort((left, right) => left.key_id.localeCompare(right.key_id)),
    next_quorum: { threshold: 1, type: "threshold" },
    organism_id: organismId,
    parent_hash: parent.object_hash,
    protocol_version: "mortalos/1",
    sequence: (BigInt(parent.sequence) + 1n).toString(),
    state_root: nextStateRoot
  };
}

function openCapsule(capsuleSource) {
  const capsuleBytes = ownBytes(capsuleSource, PROTOCOL_PROFILE.provider.object_bytes, "capsule");
  const verified = verifyContinuityCapsule(capsuleBytes);
  const capsuleDocument = parseJsonBytes(capsuleBytes, {
    maxBytes: PROTOCOL_PROFILE.provider.object_bytes,
    maxDepth: 64
  });
  const records = capsuleDocument.records.map((record) => ({
    envelope: parseJsonBytes(decodeBase64Url(record.envelope_base64url)),
    payload: parseJsonBytes(decodeBase64Url(record.event_payload_base64url))
  }));
  const lineageResult = createLineage(canonicalBytes(records[0].envelope));
  if (lineageResult.status !== "accept") fail("E_CONTINUITY_LINEAGE", lineageResult.code);
  for (let index = 1; index < records.length; index += 1) {
    const appended = lineageResult.lineage.append({
      envelopeBytes: canonicalBytes(records[index].envelope),
      eventPayloadBytes: canonicalBytes(records[index].payload)
    });
    if (appended.status !== "accept") fail("E_CONTINUITY_LINEAGE", appended.code);
  }
  const statePackage = {
    chunkBytes: capsuleDocument.state.chunks.map((entry) => decodeBase64Url(entry.bytes_base64url)),
    inputBytes: decodeBase64Url(capsuleDocument.state.input_base64url),
    manifestBytes: decodeBase64Url(capsuleDocument.state.manifest_base64url),
    receiptBytes: decodeBase64Url(capsuleDocument.state.receipt_base64url)
  };
  return freeze({
    capsuleBytes,
    capsuleDocument,
    lineage: lineageResult.lineage,
    records,
    statePackage,
    verified
  });
}

function memoryRelayTransport() {
  const frames = [];
  return freeze({
    publish(messageSource) {
      const messageBytes = ownBytes(messageSource, RELAY_LIMITS.message_bytes, "relay-message");
      decodeRelayMessageBytes(messageBytes);
      const frame = createRelayFrame(frames.length + 1, messageBytes);
      frames.push(frame);
      return freeze({ frame });
    },
    readRange(after, limit) {
      if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1) {
        fail("E_CONTINUITY_TRANSPORT", "range");
      }
      return frames.filter((frame) => frame.sequence > after).slice(0, limit);
    }
  });
}

async function materializeCopies(records, statePackage) {
  const recordSnapshot = ownJson(records, "records");
  const chunkCount = ownDataArrayLength(statePackage.chunkBytes, "state package chunks");
  const ownedChunks = copyBoundedOwnDataArray(
    statePackage.chunkBytes,
    chunkCount,
    "state package chunks"
  ).map((chunk, index) => ownBytes(chunk, PROTOCOL_PROFILE.state.chunk_bytes, `chunk-${index}`));
  const inputBytes = ownBytes(statePackage.inputBytes, PROTOCOL_PROFILE.state.input_bytes, "state-input");
  const manifestBytes = ownBytes(statePackage.manifestBytes, PROTOCOL_PROFILE.state.manifest_bytes, "state-manifest");
  const receiptBytes = ownBytes(statePackage.receiptBytes, PROTOCOL_PROFILE.state.receipt_bytes, "state-receipt");
  if (!realmIntrinsicsIntact()) fail("E_CONTINUITY_RUNTIME", "realm-integrity");
  const copies = [];
  const providers = [];
  for (let provider = 0; provider < 3; provider += 1) {
    const transport = memoryRelayTransport();
    const descriptors = await publishStatePackageChunks({ chunkBytes: ownedChunks, transport });
    const adapter = new RelayChunkRecoveryAdapter({ descriptors, transport });
    const recoveredChunks = [];
    let fragmentCount = 0;
    for (const descriptor of descriptors) {
      const chunk = await adapter.readChunk(descriptor.chunk_digest);
      if (!chunk) fail("E_CONTINUITY_TRANSPORT", `provider-${provider}-chunk`);
      recoveredChunks.push(chunk);
      fragmentCount += descriptor.message_ids.length;
    }
    const capsule = createContinuityCapsule({
      records: recordSnapshot,
      statePackage: { chunkBytes: recoveredChunks, inputBytes, manifestBytes, receiptBytes }
    });
    copies.push(new Uint8Array(capsule.bytes));
    providers.push(freeze({
      chunk_count: descriptors.length,
      fragment_count: fragmentCount,
      provider: provider + 1,
      transport: "relay-fragment-data-plane"
    }));
  }
  if (!copies.every((copy) => equalBytes(copy, copies[0]))) {
    fail("E_CONTINUITY_TRANSPORT", "provider-copy-mismatch");
  }
  return freeze({ copies: freeze(copies), provider_receipts: freeze(providers) });
}

function resultFromMaterialized(materialized, extra = {}) {
  const inspected = inspectContinuity({ capsuleBytes: materialized.copies[0] });
  return freeze({
    ...inspected,
    ...extra,
    capsule_bytes: new Uint8Array(materialized.copies[0]),
    copies: materialized.copies,
    format: CONTINUITY_RESULT_FORMAT,
    provider_receipts: materialized.provider_receipts
  });
}

function snapshotContinuityCreateInvocation(options) {
  const [authoritySource, avatarSeedSource, nonceSource, resourceSource, transitionSource] =
    snapshotNamedOwnDataValues(
      options,
      ["authority", "avatarSeed", "nonce", "resourceBytes", "transitionId"],
      "continuity create options"
    );
  const authority = snapshotAuthority(authoritySource, "origin authority");
  const resourceBytes = ownBytes(resourceSource, PROTOCOL_PROFILE.state.resource_bytes, "resource");
  if (resourceBytes.byteLength < 1) fail("E_CONTINUITY_INPUT", "resource-empty");
  const avatarSeed = avatarSeedSource === undefined
    ? randomBytes(16)
    : ownBytes(avatarSeedSource, 16, "avatar-seed");
  if (avatarSeed.byteLength !== 16) fail("E_CONTINUITY_INPUT", "avatar-seed-length");
  const nonce = nonceSource === undefined
    ? taggedRandom("nonce:")
    : ownToken(nonceSource, "nonce", "nonce:");
  const transitionId = transitionSource === undefined
    ? "resource-create"
    : ownToken(transitionSource, "transition-id");
  return freeze({ authority, avatarSeed, nonce, resourceBytes, transitionId });
}

export async function createContinuity(options) {
  const { authority, avatarSeed, nonce, resourceBytes, transitionId } =
    snapshotContinuityCreateInvocation(options);
  const genesis = genesisBody({ avatarSeed, authority, nonce });
  const genesisApproval = await signWithAuthority(
    authority,
    genesisApprovalMessage(genesis.body),
    `genesis.${authority.custodian.key_id}.${nonce}`
  );
  const birth = {
    approvals: [genesisApproval],
    body: genesis.body,
    kind: "mortalos.genesis"
  };
  const lineageResult = createLineage(canonicalBytes(birth));
  if (lineageResult.status !== "accept") fail("E_CONTINUITY_LINEAGE", lineageResult.code);
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: genesis.body.genome_hash,
    inputBytes: createStatePackageInput({ transitionId }),
    priorStateRoot: genesis.body.initial_state_root,
    resourceBytes
  });
  const stateBody = pulseBody({
    eventKind: "state-transition",
    genomeHash: genesis.body.genome_hash,
    nextCustodians: [authority.custodian],
    organismId: lineageResult.lineage.genesis.organism_id,
    parent: lineageResult.lineage.head,
    payload: statePackage.payload,
    stateRoot: statePackage.nextStateRoot
  });
  const stateApproval = await signWithAuthority(
    authority,
    pulseApprovalMessage(stateBody),
    `pulse.${stateBody.organism_id}.${stateBody.sequence}.${stateBody.parent_hash}`
  );
  const stateEnvelope = {
    acceptances: [], approvals: [stateApproval], body: stateBody, kind: "mortalos.pulse"
  };
  const appended = lineageResult.lineage.append({
    envelopeBytes: canonicalBytes(stateEnvelope),
    eventPayloadBytes: canonicalBytes(statePackage.payload)
  });
  if (appended.status !== "accept") fail("E_CONTINUITY_LINEAGE", appended.code);
  const records = [
    { envelope: birth, payload: {} },
    { envelope: stateEnvelope, payload: statePackage.payload }
  ];
  return resultFromMaterialized(await materializeCopies(records, statePackage));
}

export function inspectContinuity(options) {
  const [capsuleSource] = snapshotNamedOwnDataValues(
    options,
    ["capsuleBytes"],
    "continuity inspect options"
  );
  const opened = openCapsule(capsuleSource);
  const head = opened.lineage.head;
  return freeze({
    capsule_id: opened.verified.capsule_id,
    current_custodians: freeze(
      head.next_custody_descriptor.custodians.map((entry) => ownCustodian(entry))
    ),
    head_hash: head.object_hash,
    organism_id: opened.verified.organism_id,
    resource_root: statePackageResourceRoot(opened.verified.resource_bytes),
    resource_size: opened.verified.resource_bytes.byteLength,
    sequence: head.sequence,
    state_root: opened.verified.state_root,
    status: "verified"
  });
}

async function requestHandoff(options) {
  const [authoritySource, capsuleSource, nonceSource] = snapshotNamedOwnDataValues(
    options,
    ["authority", "capsuleBytes", "nonce"],
    "continuity handoff request options"
  );
  const authority = snapshotAuthority(authoritySource, "successor authority");
  const opened = openCapsule(capsuleSource);
  const nonce = nonceSource === undefined
    ? taggedRandom("join:")
    : ownToken(nonceSource, "handoff-request-nonce", "join:");
  return freeze({
    custodian: authority.custodian,
    format: CONTINUITY_HANDOFF_REQUEST_FORMAT,
    nonce,
    organism_id: opened.verified.organism_id
  });
}

async function proposeHandoff(options) {
  const [authoritySource, capsuleSource, requestSource] = snapshotNamedOwnDataValues(
    options,
    ["authority", "capsuleBytes", "request"],
    "continuity handoff propose options"
  );
  const authority = snapshotAuthority(authoritySource, "origin authority");
  const opened = openCapsule(capsuleSource);
  const request = ownJson(requestSource, "handoff-request");
  exactKeys(request, ["custodian", "format", "nonce", "organism_id"], "handoff-request");
  if (
    request.format !== CONTINUITY_HANDOFF_REQUEST_FORMAT ||
    request.organism_id !== opened.verified.organism_id
  ) fail("E_CONTINUITY_HANDOFF", "request-lineage");
  const recipient = ownCustodian(request.custodian, "handoff-recipient");
  const head = opened.lineage.head;
  if (!head.next_custody_descriptor.custodians.some((entry) => entry.key_id === authority.custodian.key_id)) {
    fail("E_CONTINUITY_AUTHORITY", "origin-not-current");
  }
  const payload = {
    format: "mortalos-custody-handoff/1",
    from_key_id: authority.custodian.key_id,
    request_nonce: ownToken(request.nonce, "handoff-request-nonce", "join:"),
    to_key_id: recipient.key_id
  };
  const body = pulseBody({
    eventKind: "membership-change",
    genomeHash: head.genome_hash,
    nextCustodians: [recipient],
    organismId: opened.verified.organism_id,
    parent: head,
    payload,
    stateRoot: head.next_state_root
  });
  const approval = await signWithAuthority(
    authority,
    pulseApprovalMessage(body),
    `pulse.${body.organism_id}.${body.sequence}.${body.parent_hash}`
  );
  const envelope = {
    acceptances: [], approvals: [approval], body, kind: "mortalos.pulse"
  };
  const latent = validateLatentSuccessor({
    envelopeBytes: canonicalBytes(envelope),
    eventPayloadBytes: canonicalBytes(payload),
    genesis: opened.lineage.genesis,
    parent: head
  });
  if (
    !isValidatedLatentSuccessor(latent) ||
    latent.missing_acceptance_key_ids.length !== 1 ||
    latent.missing_acceptance_key_ids[0] !== recipient.key_id
  ) fail("E_CONTINUITY_HANDOFF", latent.code ?? "proposal-invalid");
  return freeze({
    approvals: freeze([approval]),
    body: freeze(body),
    format: CONTINUITY_HANDOFF_PROPOSAL_FORMAT,
    payload: freeze(payload)
  });
}

async function acceptHandoff(options) {
  const [authoritySource, capsuleSource, proposalSource] = snapshotNamedOwnDataValues(
    options,
    ["authority", "capsuleBytes", "proposal"],
    "continuity handoff accept options"
  );
  const authority = snapshotAuthority(authoritySource, "successor authority");
  const opened = openCapsule(capsuleSource);
  const proposal = ownJson(proposalSource, "handoff-proposal");
  exactKeys(proposal, ["approvals", "body", "format", "payload"], "handoff-proposal");
  if (
    proposal.format !== CONTINUITY_HANDOFF_PROPOSAL_FORMAT ||
    proposal.body.organism_id !== opened.verified.organism_id ||
    proposal.body.parent_hash !== opened.lineage.head.object_hash ||
    proposal.body.event.kind !== "membership-change" ||
    proposal.body.next_custodians.length !== 1 ||
    proposal.body.next_custodians[0].key_id !== authority.custodian.key_id ||
    proposal.payload.to_key_id !== authority.custodian.key_id
  ) fail("E_CONTINUITY_HANDOFF", "proposal-recipient-or-parent");
  const acceptance = await signWithAuthority(
    authority,
    custodyAcceptanceMessage(proposal.body),
    `accept.${proposal.body.organism_id}.${proposal.body.sequence}.${proposal.body.parent_hash}`
  );
  const envelope = {
    acceptances: [acceptance],
    approvals: sortEvidence(proposal.approvals),
    body: proposal.body,
    kind: "mortalos.pulse"
  };
  const appended = opened.lineage.append({
    envelopeBytes: canonicalBytes(envelope),
    eventPayloadBytes: canonicalBytes(proposal.payload)
  });
  if (appended.status !== "accept") fail("E_CONTINUITY_HANDOFF", appended.code);
  const records = [...opened.records, { envelope, payload: proposal.payload }];
  const materialized = await materializeCopies(records, opened.statePackage);
  return resultFromMaterialized(materialized, {
    handoff: freeze({
      from_key_id: proposal.payload.from_key_id,
      to_key_id: authority.custodian.key_id
    })
  });
}

export async function handoffContinuity(options) {
  const [phase] = snapshotNamedOwnDataValues(options, ["phase"], "continuity handoff options");
  if (phase === "request") return requestHandoff(options);
  if (phase === "propose") return proposeHandoff(options);
  if (phase === "accept") return acceptHandoff(options);
  fail("E_CONTINUITY_HANDOFF", "phase");
}

export function recoverContinuity(options) {
  const [authoritySource, copiesSource, expectedHeadSource, expectedOrganismSource, quorumSource] =
    snapshotNamedOwnDataValues(
      options,
      ["authority", "copies", "expectedHeadHash", "expectedOrganismId", "quorum"],
      "continuity recover options"
    );
  const authority = snapshotAuthority(authoritySource, "recovery authority");
  const count = ownDataArrayLength(copiesSource, "continuity copies");
  const quorum = quorumSource === undefined ? 2 : quorumSource;
  if (
    !Number.isSafeInteger(quorum) ||
    quorum < 2 ||
    quorum > count ||
    count > CUSTODY_LIMITS.copies
  ) fail("E_CONTINUITY_QUORUM", "bounded-custody-quorum-required");
  const copies = copyBoundedOwnDataArray(copiesSource, count, "continuity copies")
    .map((copy, index) => ownBytes(copy, PROTOCOL_PROFILE.provider.object_bytes, `copy-${index}`));
  const recovered = recoverContinuityCapsuleQuorum({ copies, quorum });
  const opened = openCapsule(recovered.capsule_bytes);
  const head = opened.lineage.head;
  if (expectedHeadSource !== undefined && head.object_hash !== expectedHeadSource) {
    fail("E_CONTINUITY_STALE_HEAD", String(expectedHeadSource));
  }
  if (expectedOrganismSource !== undefined && opened.verified.organism_id !== expectedOrganismSource) {
    fail("E_CONTINUITY_LINEAGE", "organism-mismatch");
  }
  if (!head.next_custody_descriptor.custodians.some((entry) => entry.key_id === authority.custodian.key_id)) {
    fail("E_CONTINUITY_AUTHORITY", "recovery-authority-not-current");
  }
  return freeze({
    capsule_bytes: new Uint8Array(recovered.capsule_bytes),
    capsule_id: recovered.capsule_id,
    head_hash: head.object_hash,
    organism_id: opened.verified.organism_id,
    rejected_copies: freeze(recovered.rejected),
    resource_bytes: new Uint8Array(opened.verified.resource_bytes),
    resource_root: statePackageResourceRoot(opened.verified.resource_bytes),
    sequence: head.sequence,
    state_root: opened.verified.state_root,
    status: "recovered",
    valid_copies: recovered.valid_copies
  });
}

function snapshotContinuityContinueInvocation(options) {
  const [authoritySource, capsuleSource, expectedHeadSource, resourceSource, transitionSource] =
    snapshotNamedOwnDataValues(
      options,
      ["authority", "capsuleBytes", "expectedHeadHash", "resourceBytes", "transitionId"],
      "continuity continue options"
    );
  const authority = snapshotAuthority(authoritySource, "continuation authority");
  const opened = openCapsule(capsuleSource);
  const head = opened.lineage.head;
  if (expectedHeadSource !== undefined && head.object_hash !== expectedHeadSource) {
    fail("E_CONTINUITY_STALE_HEAD", String(expectedHeadSource));
  }
  if (!head.next_custody_descriptor.custodians.some((entry) =>
    entry.key_id === authority.custodian.key_id)) {
    fail("E_CONTINUITY_AUTHORITY", "continuation-authority-not-current");
  }
  const resourceBytes = resourceSource === undefined
    ? new Uint8Array(opened.verified.resource_bytes)
    : ownBytes(resourceSource, PROTOCOL_PROFILE.state.resource_bytes, "continued-resource");
  const transitionId = transitionSource === undefined
    ? `continue-${BigInt(head.sequence) + 1n}`
    : ownToken(transitionSource, "transition-id");
  return freeze({ authority, head, opened, resourceBytes, transitionId });
}

export async function continueContinuity(options) {
  const { authority, head, opened, resourceBytes, transitionId } =
    snapshotContinuityContinueInvocation(options);
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: head.genome_hash,
    inputBytes: createStatePackageInput({ transitionId }),
    priorStateRoot: head.next_state_root,
    resourceBytes
  });
  const body = pulseBody({
    eventKind: "state-transition",
    genomeHash: head.genome_hash,
    nextCustodians: head.next_custody_descriptor.custodians,
    organismId: opened.verified.organism_id,
    parent: head,
    payload: statePackage.payload,
    stateRoot: statePackage.nextStateRoot
  });
  const approval = await signWithAuthority(
    authority,
    pulseApprovalMessage(body),
    `pulse.${body.organism_id}.${body.sequence}.${body.parent_hash}`
  );
  const envelope = {
    acceptances: [], approvals: [approval], body, kind: "mortalos.pulse"
  };
  const appended = opened.lineage.append({
    envelopeBytes: canonicalBytes(envelope),
    eventPayloadBytes: canonicalBytes(statePackage.payload)
  });
  if (appended.status !== "accept") fail("E_CONTINUITY_LINEAGE", appended.code);
  const records = [...opened.records, { envelope, payload: statePackage.payload }];
  return resultFromMaterialized(await materializeCopies(records, statePackage));
}

export const continuity = freeze({
  continue: continueContinuity,
  create: createContinuity,
  handoff: handoffContinuity,
  inspect: inspectContinuity,
  recover: recoverContinuity
});
