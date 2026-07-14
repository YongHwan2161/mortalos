import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveOrganismId,
  derivePeerId,
  eventPayloadHash,
  verifyEd25519Raw
} from "../src/index.mjs";
import { vector } from "./helpers.mjs";

test("RFC 8032 Ed25519 vector 1 verifies with no private material", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./vectors/rfc8032-ed25519.json", import.meta.url), "utf8")
  );
  const publicKey = Buffer.from(fixture.public_key_hex, "hex");
  const message = Buffer.from(fixture.message_hex, "hex");
  const signature = Buffer.from(fixture.signature_hex, "hex");
  assert.equal(verifyEd25519Raw(publicKey, message, signature), true);
  const mutated = Buffer.from(signature);
  mutated[0] ^= 1;
  assert.equal(verifyEd25519Raw(publicKey, message, mutated), false);
  assert.equal(verifyEd25519Raw(Buffer.alloc(31), message, signature), false);
});

test("domain-separated MortalOS derivations match the signed corpus", () => {
  assert.equal(
    derivePeerId(vector.actors.A.public_key),
    vector.actors.A.key_id
  );
  assert.equal(
    deriveOrganismId(vector.birth.body),
    "mortalos:4kWFalWRv6QYXut4FhLeWQDpX_qpRtYNEcTsxoK2bsw"
  );
  assert.equal(
    eventPayloadHash({}),
    "sha256:RYGNp2qv_DDuVz6U77cLRxbufdBBT7eBWrm-oPH4C2U"
  );
  assert.equal(derivePeerId("ed25519:bad"), null);
});
