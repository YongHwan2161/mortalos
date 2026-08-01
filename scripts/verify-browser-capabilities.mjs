import assert from "node:assert/strict";
import {
  hasNativeSignerCapability,
  probeBrowserCapabilities
} from "./browser-capability-probe.mjs";

const requested = process.env.MORTALOS_BROWSER_ENGINE
  ? [process.env.MORTALOS_BROWSER_ENGINE]
  : ["chromium", "firefox", "webkit"];
const expectedWithoutSigner = {
  indexed_db: true,
  locks: "acquired",
  rsa_oaep_3072: { extractable: false, type: "private", usages: ["decrypt"] },
  structured_clone_crypto_key: true
};

for (const name of requested) {
  const result = await probeBrowserCapabilities(name);
  const signerCapable = hasNativeSignerCapability(result);
  try {
    assert.deepEqual(
      {
        indexed_db: result.indexed_db,
        locks: result.locks,
        rsa_oaep_3072: result.rsa_oaep_3072,
        structured_clone_crypto_key: result.structured_clone_crypto_key
      },
      expectedWithoutSigner
    );
    if (name === "webkit" && !signerCapable) {
      assert.match(result.ed25519, /^NotSupportedError:/u);
    } else {
      assert.equal(signerCapable, true);
    }
  } catch (error) {
    error.message += `\n${name} capabilities: ${JSON.stringify(result, null, 2)}`;
    throw error;
  }
  console.log(
    `MortalOS ${name} capability smoke: PASS (` +
      (signerCapable ? "native signer/custody" : "verifier-only fail-closed") +
      ")"
  );
}
