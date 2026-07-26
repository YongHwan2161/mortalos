import assert from "node:assert/strict";
import test from "node:test";
import { runConfidentialVectors } from "./confidential-vector-runner.mjs";

test("NIST AES-256-GCM and pinned Wycheproof RSA-OAEP-3072-SHA-256 vectors pass", async () => {
  assert.deepEqual(await runConfidentialVectors(), {
    aes_ciphertext_hex:
      "cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919",
    aes_plaintext_hex: "00000000000000000000000000000000",
    jcs_fixture:
      '{"epoch":"9007199254740992","format":"mortalos-s4-jcs-fixture/1","next_counter":"4294967296"}',
    rsa_key_bits: 3072,
    rsa_malformed_rejected: true,
    rsa_message_hex: "",
    rsa_private_extractable: false,
    rsa_wrong_label_rejected: true
  });
});
