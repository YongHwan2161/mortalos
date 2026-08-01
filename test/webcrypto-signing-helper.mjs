import { encodeBase64Url } from "../src/bytes.mjs";
import { derivePeerId } from "../src/crypto.mjs";

export async function createStoredWebCryptoKey() {
  const generated = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const public_key = `ed25519:${encodeBase64Url(raw)}`;
  return Object.freeze({
    key_id: derivePeerId(public_key),
    private_key: generated.privateKey,
    public_key,
    public_key_raw: raw.buffer
  });
}

export async function signBytes(keyId, privateKey, message) {
  const owned = new Uint8Array(message);
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", privateKey, owned)
  );
  return Object.freeze({
    key_id: keyId,
    signature: `ed25519:${encodeBase64Url(signature)}`
  });
}
