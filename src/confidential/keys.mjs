import {
  decodeBase64Url,
  encodeBase64Url
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import {
  CONFIDENTIAL_DOMAINS,
  CONFIDENTIAL_FORMATS,
  CONFIDENTIAL_LIMITS,
  CONFIDENTIAL_SUITE,
  assertCustodianId,
  assertDigest,
  assertOrganismId,
  canonicalDomainHash,
  confidentialFail,
  domainHash,
  exactObjectKeys,
  parseEpoch,
  taggedBytes
} from "./format.mjs";

const RSA_ALGORITHM = Object.freeze({
  hash: "SHA-256",
  modulusLength: 3072,
  name: "RSA-OAEP",
  publicExponent: new Uint8Array([1, 0, 1])
});

export function assertWebCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    confidentialFail("E_CONFIDENTIAL_CRYPTO", "", "webcrypto-required");
  }
  return globalThis.crypto.subtle;
}

export async function generateCustodianEncryptionKeyPair(custodianId) {
  assertCustodianId(custodianId);
  const subtle = assertWebCrypto();
  const keyPair = await subtle.generateKey(
    RSA_ALGORITHM,
    false,
    ["wrapKey", "unwrapKey"]
  );
  const spki = new Uint8Array(await subtle.exportKey("spki", keyPair.publicKey));
  const publicKey = `spki:${encodeBase64Url(spki)}`;
  const encryptionKeyDigest = domainHash(
    CONFIDENTIAL_DOMAINS.encryption_key,
    spki
  );
  return Object.freeze({
    descriptor: Object.freeze({
      custodian_id: custodianId,
      encryption_key_digest: encryptionKeyDigest,
      encryption_public_key: publicKey
    }),
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey
  });
}

export async function importCustodianPublicKey(descriptor) {
  exactObjectKeys(
    descriptor,
    ["custodian_id", "encryption_key_digest", "encryption_public_key"],
    "/custodian"
  );
  assertCustodianId(descriptor.custodian_id, "/custodian/custodian_id");
  assertDigest(
    descriptor.encryption_key_digest,
    "/custodian/encryption_key_digest"
  );
  const spki = taggedBytes(
    descriptor.encryption_public_key,
    "spki:",
    422,
    "/custodian/encryption_public_key"
  );
  if (
    domainHash(CONFIDENTIAL_DOMAINS.encryption_key, spki) !==
    descriptor.encryption_key_digest
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_KEY",
      "/custodian/encryption_key_digest",
      "digest"
    );
  }
  let key;
  try {
    key = await assertWebCrypto().importKey(
      "spki",
      spki,
      { hash: "SHA-256", name: "RSA-OAEP" },
      true,
      ["wrapKey"]
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_KEY", "/custodian", "rsa-public-key");
  }
  const algorithm = key.algorithm;
  if (
    algorithm.name !== "RSA-OAEP" ||
    algorithm.modulusLength !== 3072 ||
    algorithm.publicExponent?.length !== 3 ||
    algorithm.publicExponent[0] !== 1 ||
    algorithm.publicExponent[1] !== 0 ||
    algorithm.publicExponent[2] !== 1 ||
    algorithm.hash?.name !== "SHA-256" ||
    !key.usages.includes("wrapKey")
  ) {
    confidentialFail("E_CONFIDENTIAL_KEY", "/custodian", "rsa-parameters");
  }
  return key;
}

export function createWrapLabel({
  custodian,
  epoch,
  epochId,
  membershipHead,
  organismId
}) {
  assertCustodianId(custodian.custodian_id);
  assertDigest(custodian.encryption_key_digest, "/custodian_encryption_key");
  parseEpoch(epoch);
  assertDigest(epochId, "/epoch_id");
  assertDigest(membershipHead, "/membership_head");
  assertOrganismId(organismId);
  return Object.freeze({
    custodian_encryption_key: custodian.encryption_key_digest,
    custodian_id: custodian.custodian_id,
    epoch,
    epoch_id: epochId,
    format: CONFIDENTIAL_FORMATS.wrap_label,
    membership_head: membershipHead,
    organism_id: organismId,
    suite: CONFIDENTIAL_SUITE
  });
}

export async function wrapEpochKey({
  custodian,
  epoch,
  epochId,
  membershipHead,
  organismId,
  stagingKey
}) {
  const publicKey = await importCustodianPublicKey(custodian);
  const label = createWrapLabel({
    custodian,
    epoch,
    epochId,
    membershipHead,
    organismId
  });
  const labelBytes = canonicalBytes(label);
  let wrapped;
  try {
    wrapped = new Uint8Array(
      await assertWebCrypto().wrapKey(
        "raw",
        stagingKey,
        publicKey,
        { label: labelBytes, name: "RSA-OAEP" }
      )
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap", "wrap-failed");
  }
  if (wrapped.byteLength !== CONFIDENTIAL_LIMITS.rsa_wrapped_bytes) {
    confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap", "wrapped-length");
  }
  return Object.freeze({
    custodian_encryption_key: custodian.encryption_key_digest,
    custodian_id: custodian.custodian_id,
    epoch,
    epoch_id: epochId,
    format: CONFIDENTIAL_FORMATS.wrap,
    label_digest: canonicalDomainHash(CONFIDENTIAL_DOMAINS.wrap_label, label),
    suite: CONFIDENTIAL_SUITE,
    wrapped_epoch_key_base64url: encodeBase64Url(wrapped),
    wrapped_epoch_key_digest: domainHash(CONFIDENTIAL_DOMAINS.wrap, wrapped)
  });
}

export async function unwrapEpochKey({
  custodian,
  epoch,
  epochId,
  membershipHead,
  organismId,
  privateKey,
  wrap
}) {
  try {
    exactObjectKeys(
      wrap,
      [
        "custodian_encryption_key",
        "custodian_id",
        "epoch",
        "epoch_id",
        "format",
        "label_digest",
        "suite",
        "wrapped_epoch_key_base64url",
        "wrapped_epoch_key_digest"
      ],
      "/wrap"
    );
    if (
      wrap.format !== CONFIDENTIAL_FORMATS.wrap ||
      wrap.suite !== CONFIDENTIAL_SUITE ||
      wrap.epoch !== epoch ||
      wrap.epoch_id !== epochId ||
      wrap.custodian_id !== custodian.custodian_id ||
      wrap.custodian_encryption_key !== custodian.encryption_key_digest
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap", "binding");
    }
    const label = createWrapLabel({
      custodian,
      epoch,
      epochId,
      membershipHead,
      organismId
    });
    if (
      wrap.label_digest !==
      canonicalDomainHash(CONFIDENTIAL_DOMAINS.wrap_label, label)
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap/label_digest", "digest");
    }
    const wrapped = decodeBase64Url(wrap.wrapped_epoch_key_base64url);
    if (
      !wrapped ||
      wrapped.byteLength !== CONFIDENTIAL_LIMITS.rsa_wrapped_bytes ||
      domainHash(CONFIDENTIAL_DOMAINS.wrap, wrapped) !==
        wrap.wrapped_epoch_key_digest
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap", "ciphertext");
    }
    if (
      privateKey?.type !== "private" ||
      privateKey.extractable ||
      privateKey.algorithm?.name !== "RSA-OAEP" ||
      privateKey.algorithm?.modulusLength !== 3072 ||
      privateKey.algorithm?.hash?.name !== "SHA-256" ||
      !privateKey.usages.includes("unwrapKey")
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", "/private_key", "binding");
    }
    return await assertWebCrypto().unwrapKey(
      "raw",
      wrapped,
      privateKey,
      { label: canonicalBytes(label), name: "RSA-OAEP" },
      { length: 256, name: "AES-GCM" },
      false,
      ["decrypt"]
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_WRAP", "/wrap", "rejected");
  }
}

export async function generateStagingEpochKey() {
  return assertWebCrypto().generateKey(
    { length: 256, name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}
