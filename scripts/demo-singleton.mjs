import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import {
  canonicalBytes,
  createLineage,
  custodyCommitment,
  deriveOrganismId,
  derivePeerId,
  encodeBase64Url,
  eventPayloadHash,
  genesisApprovalMessage,
  genesisParentHash,
  pulseApprovalMessage
} from "../src/index.mjs";

const verifyOnly = process.argv.includes("--verify");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicDer = publicKey.export({ format: "der", type: "spki" });
const public_key = `ed25519:${encodeBase64Url(publicDer.subarray(-32))}`;
const actor = { key_id: derivePeerId(public_key), public_key };
const tagged = (prefix, length) =>
  `${prefix}${encodeBase64Url(randomBytes(length))}`;
const signature = (message) =>
  `ed25519:${encodeBase64Url(sign(null, message, privateKey))}`;
const quorum = { type: "threshold", threshold: 1 };
const body = {
  protocol_version: "mortalos/0",
  hash_algorithm: "sha-256",
  signature_algorithm: "ed25519",
  genome_hash: tagged("sha256:", 32),
  initial_state_root: tagged("sha256:", 32),
  initial_custodians: [actor],
  initial_quorum: quorum,
  nonce: tagged("nonce:", 16)
};
const birth = {
  kind: "mortalos.genesis",
  body,
  approvals: [{ key_id: actor.key_id, signature: signature(genesisApprovalMessage(body)) }]
};
const opened = createLineage(canonicalBytes(birth));
if (opened.status !== "accept") throw new Error(`generated Genesis rejected: ${opened.code}`);

const payload = {};
const pulseBody = {
  protocol_version: "mortalos/0",
  organism_id: deriveOrganismId(body),
  sequence: "1",
  parent_hash: genesisParentHash(deriveOrganismId(body)),
  genome_hash: body.genome_hash,
  current_custody_hash: custodyCommitment({ custodians: [actor], quorum }),
  state_root: body.initial_state_root,
  event: { kind: "heartbeat", payload_hash: eventPayloadHash(payload) },
  next_custodians: [actor],
  next_quorum: quorum
};
const heartbeat = {
  kind: "mortalos.pulse",
  body: pulseBody,
  approvals: [{ key_id: actor.key_id, signature: signature(pulseApprovalMessage(pulseBody)) }],
  acceptances: []
};
const pulse = opened.lineage.append({
  envelopeBytes: canonicalBytes(heartbeat),
  eventPayloadBytes: canonicalBytes(payload)
});
if (pulse.status !== "accept") throw new Error(`generated heartbeat rejected: ${pulse.code}`);

const trace = {
  mode: "ephemeral-cli-singleton",
  persistence: "none",
  organism_id: opened.lineage.genesis.organism_id,
  genesis_hash: opened.lineage.genesis.object_hash,
  head_hash: pulse.object_hash,
  sequence: pulse.sequence,
  alive: opened.lineage.evaluateMortality({
    usableKeyIds: [actor.key_id],
    stateAvailable: true
  }).status,
  after_declared_irreversible_process_loss: opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    authorityLossIrreversible: true
  }).status
};

if (verifyOnly) {
  console.log(`MortalOS ephemeral CLI singleton: PASS (${trace.organism_id})`);
} else {
  console.log(JSON.stringify(trace, null, 2));
}
