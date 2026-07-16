import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  asciiBytes,
  byteLengthOfBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  hexToBytes
} from "./bytes.mjs";
import { canonicalBytes, snapshotBytes } from "./codec.mjs";
import {
  callFunction,
  stringSlice,
  stringStartsWith,
  typedArraySubarray
} from "./primordials.mjs";

const Ed25519Point = ed25519.Point;
const ed25519VerifyIntrinsic = ed25519.verify;
const pointAssertValidityIntrinsic = Ed25519Point.prototype.assertValidity;
const pointFromBytesIntrinsic = Ed25519Point.fromBytes;
const pointIsSmallOrderIntrinsic = Ed25519Point.prototype.isSmallOrder;
const pointIsTorsionFreeIntrinsic = Ed25519Point.prototype.isTorsionFree;
const pointToBytesIntrinsic = Ed25519Point.prototype.toBytes;
const EMPTY_BYTES = new Uint8Array(0);
const SHA256_EMPTY = hexToBytes(
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
);
const ED25519_KAT_PUBLIC_KEY = hexToBytes(
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
);
const ED25519_KAT_SIGNATURE = hexToBytes(
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
    "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
);

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

function hash(domain, message) {
  return sha256(concatBytes(domain, message));
}

function tagged(prefix, raw) {
  return `${prefix}${encodeBase64Url(raw)}`;
}

export function decodeTagged(value, prefix, length) {
  if (typeof value !== "string" || !stringStartsWith(value, prefix)) return null;
  const encoded = stringSlice(value, prefix.length);
  const raw = decodeBase64Url(encoded);
  return raw !== null && byteLengthOfBytes(raw) === length ? raw : null;
}

export function derivePeerId(publicKey) {
  const raw = decodeTagged(publicKey, "ed25519:", 32);
  if (!raw || !strictPointBytes(raw)) return null;
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

function copyBytes(value, expectedLength) {
  try {
    const copy = snapshotBytes(value, expectedLength ?? 9_007_199_254_740_991);
    if (expectedLength !== undefined && byteLengthOfBytes(copy) !== expectedLength) return null;
    return copy;
  } catch {
    return null;
  }
}

function strictPointBytes(value) {
  const bytes = copyBytes(value, 32);
  if (!bytes) return null;
  try {
    const point = callFunction(pointFromBytesIntrinsic, Ed25519Point, [bytes, false]);
    callFunction(pointAssertValidityIntrinsic, point, []);
    if (
      callFunction(pointIsSmallOrderIntrinsic, point, []) ||
      !callFunction(pointIsTorsionFreeIntrinsic, point, [])
    ) {
      return null;
    }
    if (!equalBytes(callFunction(pointToBytesIntrinsic, point, []), bytes)) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function isStrictEd25519PublicKey(publicKey) {
  const publicRaw = decodeTagged(publicKey, "ed25519:", 32);
  return strictPointBytes(publicRaw) !== null;
}

export function verifyEd25519(publicKey, message, signature) {
  const publicRaw = decodeTagged(publicKey, "ed25519:", 32);
  const signatureRaw = decodeTagged(signature, "ed25519:", 64);
  return publicRaw && signatureRaw
    ? verifyEd25519Raw(publicRaw, message, signatureRaw)
    : false;
}

export function verifyEd25519Raw(publicKeyRaw, message, signatureRaw) {
  const publicBytes = strictPointBytes(publicKeyRaw);
  const messageBytes = copyBytes(message);
  const signatureBytes = copyBytes(signatureRaw, 64);
  if (!publicBytes || !messageBytes || !signatureBytes) return false;
  const signatureR = strictPointBytes(typedArraySubarray(signatureBytes, 0, 32));
  if (!signatureR) return false;
  try {
    return callFunction(ed25519VerifyIntrinsic, ed25519, [
      signatureBytes,
      messageBytes,
      publicBytes,
      { zip215: false }
    ]);
  } catch {
    return false;
  }
}

export function cryptoRuntimeIntact() {
  try {
    return (
      equalBytes(sha256(EMPTY_BYTES), SHA256_EMPTY) &&
      verifyEd25519Raw(ED25519_KAT_PUBLIC_KEY, EMPTY_BYTES, ED25519_KAT_SIGNATURE)
    );
  } catch {
    return false;
  }
}
