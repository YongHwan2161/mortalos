import { hexToBytes } from "../src/bytes.mjs";
import { canonicalize } from "../src/codec.mjs";
import { aesGcmKnownAnswer } from "../src/confidential/package.mjs";
import { WYCHEPROOF_RSA_OAEP_3072_SHA256 } from "./vectors/wycheproof-rsa-oaep-3072-sha256.mjs";

export async function runConfidentialVectors() {
  const aes = await aesGcmKnownAnswer({
    ciphertext: hexToBytes(
      "cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919"
    ),
    iv: hexToBytes("000000000000000000000000"),
    key: hexToBytes("00".repeat(32)),
    plaintext: hexToBytes("00".repeat(16))
  });
  const vector = WYCHEPROOF_RSA_OAEP_3072_SHA256;
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    vector.jwk,
    { hash: "SHA-256", name: "RSA-OAEP" },
    false,
    ["decrypt"]
  );
  const ciphertext = hexToBytes(vector.ciphertext);
  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt(
      { label: new Uint8Array(), name: "RSA-OAEP" },
      privateKey,
      ciphertext
    )
  );
  const malformed = new Uint8Array(ciphertext);
  malformed[malformed.length - 1] ^= 1;
  let malformedRejected = false;
  let wrongLabelRejected = false;
  try {
    await crypto.subtle.decrypt(
      { label: new Uint8Array([1]), name: "RSA-OAEP" },
      privateKey,
      ciphertext
    );
  } catch {
    wrongLabelRejected = true;
  }
  try {
    await crypto.subtle.decrypt(
      { label: new Uint8Array(), name: "RSA-OAEP" },
      privateKey,
      malformed
    );
  } catch {
    malformedRejected = true;
  }
  return Object.freeze({
    aes_ciphertext_hex: BufferLikeHex(aes.ciphertext),
    aes_plaintext_hex: BufferLikeHex(aes.plaintext),
    jcs_fixture:
      canonicalize({
        epoch: "9007199254740992",
        format: "mortalos-s4-jcs-fixture/1",
        next_counter: "4294967296"
      }),
    rsa_key_bits: privateKey.algorithm.modulusLength,
    rsa_malformed_rejected: malformedRejected,
    rsa_message_hex: BufferLikeHex(decrypted),
    rsa_private_extractable: privateKey.extractable,
    rsa_wrong_label_rejected: wrongLabelRejected
  });
}

function BufferLikeHex(bytes) {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}
