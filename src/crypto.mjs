import {
  createHash,
  createPublicKey,
  verify as verifySignature
} from "node:crypto";
import { canonicalBytes } from "./codec.mjs";

export const DOMAINS = Object.freeze({
  GENESIS_ID: Buffer.from("MORTALOS/V0/GENESIS-ID\0", "ascii"),
  GENESIS_APPROVAL: Buffer.from("MORTALOS/V0/GENESIS-APPROVAL\0", "ascii"),
  PULSE_ID: Buffer.from("MORTALOS/V0/PULSE-ID\0", "ascii"),
  PULSE_APPROVAL: Buffer.from("MORTALOS/V0/PULSE-APPROVAL\0", "ascii"),
  CUSTODY_ACCEPTANCE: Buffer.from("MORTALOS/V0/CUSTODY-ACCEPTANCE\0", "ascii"),
  CUSTODY_COMMITMENT: Buffer.from("MORTALOS/V0/CUSTODY-COMMITMENT\0", "ascii"),
  EVENT_PAYLOAD: Buffer.from("MORTALOS/V0/EVENT-PAYLOAD\0", "ascii"),
  PEER_ID: Buffer.from("MORTALOS/V0/PEER-ID\0", "ascii")
});

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function hash(...parts) {
  const digest = createHash("sha256");
  for (const part of parts) digest.update(part);
  return digest.digest();
}

function tagged(prefix, raw) {
  return `${prefix}${Buffer.from(raw).toString("base64url")}`;
}

export function decodeTagged(value, prefix, length) {
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const encoded = value.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.includes("=")) return null;
  const raw = Buffer.from(encoded, "base64url");
  if (raw.length !== length || raw.toString("base64url") !== encoded) return null;
  return raw;
}

export function derivePeerId(publicKey) {
  const raw = decodeTagged(publicKey, "ed25519:", 32);
  if (!raw) return null;
  return tagged("peer:", hash(DOMAINS.PEER_ID, raw));
}

export function deriveOrganismId(genesisBody) {
  return tagged("mortalos:", hash(DOMAINS.GENESIS_ID, canonicalBytes(genesisBody)));
}

export function genesisParentHash(organismId) {
  const raw = decodeTagged(organismId, "mortalos:", 32);
  return raw ? tagged("sha256:", raw) : null;
}

export function genesisApprovalMessage(genesisBody) {
  const organism = deriveOrganismId(genesisBody);
  const raw = decodeTagged(organism, "mortalos:", 32);
  return hash(DOMAINS.GENESIS_APPROVAL, raw);
}

export function derivePulseHash(pulseBody) {
  return tagged("sha256:", hash(DOMAINS.PULSE_ID, canonicalBytes(pulseBody)));
}

export function pulseApprovalMessage(pulseBody) {
  const raw = decodeTagged(derivePulseHash(pulseBody), "sha256:", 32);
  return hash(DOMAINS.PULSE_APPROVAL, raw);
}

export function custodyAcceptanceMessage(pulseBody) {
  const raw = decodeTagged(derivePulseHash(pulseBody), "sha256:", 32);
  return hash(DOMAINS.CUSTODY_ACCEPTANCE, raw);
}

export function custodyCommitment(descriptor) {
  return tagged(
    "sha256:",
    hash(DOMAINS.CUSTODY_COMMITMENT, canonicalBytes(descriptor))
  );
}

export function eventPayloadHash(payload) {
  return tagged("sha256:", hash(DOMAINS.EVENT_PAYLOAD, canonicalBytes(payload)));
}

export function verifyEd25519(publicKey, message, signature) {
  const publicRaw = decodeTagged(publicKey, "ed25519:", 32);
  const signatureRaw = decodeTagged(signature, "ed25519:", 64);
  if (!publicRaw || !signatureRaw) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, publicRaw]),
      format: "der",
      type: "spki"
    });
    return verifySignature(null, message, key, signatureRaw);
  } catch {
    return false;
  }
}

export function verifyEd25519Raw(publicKeyRaw, message, signatureRaw) {
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKeyRaw)]),
      format: "der",
      type: "spki"
    });
    return verifySignature(null, message, key, signatureRaw);
  } catch {
    return false;
  }
}
