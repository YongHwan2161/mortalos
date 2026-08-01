import assert from "node:assert/strict";
import test from "node:test";

import { PROTOCOL_PROFILE } from "../src/generated/protocol-profile.mjs";
import { hasNativeSignerCapability } from "../scripts/browser-capability-probe.mjs";

function signer(protocolSignVerify) {
  return {
    ed25519: {
      extractable: false,
      protocol_message_bytes: PROTOCOL_PROFILE.transport.message_bytes,
      protocol_sign_verify: protocolSignVerify,
      type: "private",
      usages: ["sign"]
    }
  };
}

test("browser custody requires the complete protocol signing envelope", () => {
  assert.equal(hasNativeSignerCapability(signer(true)), true);
  assert.equal(
    hasNativeSignerCapability(signer("OperationError:protocol message rejected")),
    false
  );
  assert.equal(
    hasNativeSignerCapability(signer("BrowserClosedError:signer process terminated")),
    false
  );
  assert.equal(
    hasNativeSignerCapability({
      ed25519: {
        extractable: false,
        protocol_message_bytes: PROTOCOL_PROFILE.transport.message_bytes - 1,
        protocol_sign_verify: true,
        type: "private",
        usages: ["sign"]
      }
    }),
    false
  );
});
