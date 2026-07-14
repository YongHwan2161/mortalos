import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  asBytes,
  asciiBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url
} from "./bytes.mjs";
import { canonicalBytes } from "./codec.mjs";

export const DOMAINS = Object.freeze({
  GENESIS_ID: "MORTALOS/V0/GENESIS-ID\0",
  GENESIS_APPROVAL: "MORTALOS/V0/GENESIS-APPROVAL\0",
  PULSE_ID: "MORTALOS/V0/PULSE-ID\0",
  PULSE_APPROVAL: "MORTALOS/V0/PULSE-APPROVAL\0",
  CUSTODY_ACCEPTANCE: "MORTALOS/V0/CUSTODY-ACCEPTANCE\0",
  CUSTODY_COMMITMENT: "MORTALOS/V0/CUSTODY-COMMITMENT\0",
  EVENT_PAYLOAD: "MORTALOS/V0/EVENT-PAYLOAD\0",
  PEER_ID: "MORTALOS/V0/PEER-ID\0"
});

const DOMAIN_BYTES = Object.freeze(
  Object.fromEntries(Object.entries(DOMAINS).map(([name, value]) => [name, asciiBytes(value)]))
);

function hash(...parts) {
  return sha256(concatBytes(...parts));
}

function tagged(prefix, raw) {
  return `${prefix}${encodeBase64Url(raw)}`;
}

export function decodeTagged(value, prefix, length) {
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const encoded = value.slice(prefix.length);
  const raw = decodeBase64Url(encoded);
  return raw?.length === length ? raw : null;
}

export function derivePeerId(publicKey) {
  const raw = decodeTagged(publicKey, "ed25519:", 32);
  if (!raw) return null;
  return tagged("peer:", hash(DOMAIN_BYTES.PEER_ID, raw));
}

export function deriveOrganismId(genesisBody) {
  return tagged("mortalos:", hash(DOMAIN_BYTES.GENESIS_ID, canonicalBytes(genesisBody)));
}

export function genesisParentHash(organismId) {
  const raw = decodeTagged(organismId, "mortalos:", 32);
  return raw ? tagged("sha256:", raw) : null;
}

export function genesisApprovalMessage(genesisBody) {
  const organism = deriveOrganismId(genesisBody);
  const raw = decodeTagged(organism, "mortalos:", 32);
  return hash(DOMAIN_BYTES.GENESIS_APPROVAL, raw);
}

export function derivePulseHash(pulseBody) {
  return tagged("sha256:", hash(DOMAIN_BYTES.PULSE_ID, canonicalBytes(pulseBody)));
}

export function pulseApprovalMessage(pulseBody) {
  const raw = decodeTagged(derivePulseHash(pulseBody), "sha256:", 32);
  return hash(DOMAIN_BYTES.PULSE_APPROVAL, raw);
}

export function custodyAcceptanceMessage(pulseBody) {
  const raw = decodeTagged(derivePulseHash(pulseBody), "sha256:", 32);
  return hash(DOMAIN_BYTES.CUSTODY_ACCEPTANCE, raw);
}

export function custodyCommitment(descriptor) {
  return tagged(
    "sha256:",
    hash(DOMAIN_BYTES.CUSTODY_COMMITMENT, canonicalBytes(descriptor))
  );
}

export function eventPayloadHash(payload) {
  return tagged("sha256:", hash(DOMAIN_BYTES.EVENT_PAYLOAD, canonicalBytes(payload)));
}

export function verifyEd25519(publicKey, message, signature) {
  const publicRaw = decodeTagged(publicKey, "ed25519:", 32);
  const signatureRaw = decodeTagged(signature, "ed25519:", 64);
  return publicRaw && signatureRaw
    ? verifyEd25519Raw(publicRaw, message, signatureRaw)
    : false;
}

export function verifyEd25519Raw(publicKeyRaw, message, signatureRaw) {
  const publicBytes = asBytes(publicKeyRaw);
  const messageBytes = asBytes(message);
  const signatureBytes = asBytes(signatureRaw);
  if (
    publicBytes?.length !== 32 ||
    !messageBytes ||
    signatureBytes?.length !== 64
  ) {
    return false;
  }
  try {
    return ed25519.verify(signatureBytes, messageBytes, publicBytes, { zip215: false });
  } catch {
    return false;
  }
}
