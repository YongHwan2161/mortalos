import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  DOMAINS,
  custodyAcceptanceMessage,
  custodyCommitment,
  deriveOrganismId,
  derivePeerId,
  derivePulseHash,
  eventPayloadHash,
  genesisApprovalMessage,
  isStrictEd25519PublicKey,
  pulseApprovalMessage,
  verifyEd25519,
  verifyEd25519Raw
} from "../src/index.mjs";
import { vector } from "./helpers.mjs";

const CURVE_ORDER = ed25519.Point.CURVE().n;
const TORSION_ENCODINGS = [
  "0100000000000000000000000000000000000000000000000000000000000000",
  "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
  "0000000000000000000000000000000000000000000000000000000000000080",
  "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
  "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa"
];

function tagged(raw) {
  return `ed25519:${Buffer.from(raw).toString("base64url")}`;
}

function bytesToNumberLE(bytes) {
  return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex")}`);
}

function numberToBytesLE(value) {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function hashToScalar(...parts) {
  const digest = createHash("sha512");
  for (const part of parts) digest.update(part);
  return bytesToNumberLE(digest.digest()) % CURVE_ORDER;
}

function representedSignature({ extendedKey, message, publicKey, r, signatureR }) {
  const challenge = hashToScalar(signatureR, publicKey, message);
  const scalar = (r + challenge * extendedKey.scalar) % CURVE_ORDER;
  return Buffer.concat([Buffer.from(signatureR), Buffer.from(numberToBytesLE(scalar))]);
}

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
  assert.equal(verifyEd25519Raw(publicKey, "not-bytes", signature), false);
  assert.equal(
    verifyEd25519Raw(publicKey, new Uint8Array(new SharedArrayBuffer(0)), signature),
    false
  );
});

test("signed lifecycle corpus satisfies the strict Ed25519 profile", () => {
  const publicKeys = new Map(
    Object.values(vector.actors).map((actor) => [actor.key_id, actor.public_key])
  );
  const genesisMessage = genesisApprovalMessage(vector.birth.body);
  for (const approval of vector.birth.approvals) {
    assert.equal(
      verifyEd25519(publicKeys.get(approval.key_id), genesisMessage, approval.signature),
      true
    );
  }
  for (const step of vector.steps) {
    const approvalMessage = pulseApprovalMessage(step.envelope.body);
    for (const approval of step.envelope.approvals) {
      assert.equal(
        verifyEd25519(publicKeys.get(approval.key_id), approvalMessage, approval.signature),
        true
      );
    }
    const acceptanceMessage = custodyAcceptanceMessage(step.envelope.body);
    for (const acceptance of step.envelope.acceptances) {
      assert.equal(
        verifyEd25519(publicKeys.get(acceptance.key_id), acceptanceMessage, acceptance.signature),
        true
      );
    }
  }
});

test("all canonical low-order encodings are rejected as public keys and signature R", () => {
  const message = Buffer.from("low-order regression", "utf8");
  const universalSignature = Buffer.concat([
    Buffer.from(TORSION_ENCODINGS[0], "hex"),
    Buffer.alloc(32)
  ]);

  for (const encoding of TORSION_ENCODINGS) {
    const publicKey = Buffer.from(encoding, "hex");
    assert.equal(isStrictEd25519PublicKey(tagged(publicKey)), false);
    assert.equal(derivePeerId(tagged(publicKey)), null);
    assert.equal(verifyEd25519Raw(publicKey, message, universalSignature), false);
  }

  const validPublicKey = Buffer.from(
    vector.actors.A.public_key.slice("ed25519:".length),
    "base64url"
  );
  for (const encoding of TORSION_ENCODINGS) {
    const signature = Buffer.concat([Buffer.from(encoding, "hex"), Buffer.alloc(32)]);
    assert.equal(verifyEd25519Raw(validPublicKey, message, signature), false);
  }
});

test("mixed-order public-key aliases are rejected before cofactored verification", () => {
  const secretKey = new Uint8Array(32).fill(7);
  const message = Buffer.from("mixed-order public-key regression", "utf8");
  const extendedKey = ed25519.utils.getExtendedPublicKey(secretKey);
  const r = hashToScalar(extendedKey.prefix, message);
  const signatureR = ed25519.Point.BASE.multiply(r).toBytes();

  for (const encoding of TORSION_ENCODINGS.slice(1)) {
    const torsionPoint = ed25519.Point.fromBytes(Buffer.from(encoding, "hex"), false);
    const publicKey = extendedKey.point.add(torsionPoint).toBytes();
    const signature = representedSignature({
      extendedKey,
      message,
      publicKey,
      r,
      signatureR
    });

    assert.equal(ed25519.verify(signature, message, publicKey, { zip215: false }), true);
    assert.equal(isStrictEd25519PublicKey(tagged(publicKey)), false);
    assert.equal(verifyEd25519Raw(publicKey, message, signature), false);
  }
});

test("mixed-order and noncanonical signature R encodings are rejected", () => {
  const secretKey = new Uint8Array(32).fill(11);
  const message = Buffer.from("strict signature R regression", "utf8");
  const extendedKey = ed25519.utils.getExtendedPublicKey(secretKey);
  const r = hashToScalar(extendedKey.prefix, message);
  const subgroupR = ed25519.Point.BASE.multiply(r);

  for (const encoding of TORSION_ENCODINGS.slice(1)) {
    const torsionPoint = ed25519.Point.fromBytes(Buffer.from(encoding, "hex"), false);
    const signatureR = subgroupR.add(torsionPoint).toBytes();
    const signature = representedSignature({
      extendedKey,
      message,
      publicKey: extendedKey.pointBytes,
      r,
      signatureR
    });

    assert.equal(
      ed25519.verify(signature, message, extendedKey.pointBytes, { zip215: false }),
      true
    );
    assert.equal(verifyEd25519Raw(extendedKey.pointBytes, message, signature), false);
  }

  const noncanonicalIdentity = Buffer.from(`ee${"ff".repeat(30)}7f`, "hex");
  assert.equal(isStrictEd25519PublicKey(tagged(noncanonicalIdentity)), false);
  assert.equal(derivePeerId(tagged(noncanonicalIdentity)), null);
  const noncanonicalSignature = representedSignature({
    extendedKey,
    message,
    publicKey: extendedKey.pointBytes,
    r: 0n,
    signatureR: noncanonicalIdentity
  });
  assert.equal(
    ed25519.verify(noncanonicalSignature, message, extendedKey.pointBytes, { zip215: true }),
    true
  );
  assert.equal(
    ed25519.verify(noncanonicalSignature, message, extendedKey.pointBytes, { zip215: false }),
    false
  );
  assert.equal(
    verifyEd25519Raw(extendedKey.pointBytes, message, noncanonicalSignature),
    false
  );
});

test("noncanonical Ed25519 scalar S is rejected", () => {
  const secretKey = new Uint8Array(32).fill(19);
  const message = Buffer.from("noncanonical scalar regression", "utf8");
  const publicKey = ed25519.getPublicKey(secretKey);
  const signature = ed25519.sign(message, secretKey);
  const noncanonical = Uint8Array.from(signature);
  const scalar = bytesToNumberLE(noncanonical.subarray(32));
  noncanonical.set(numberToBytesLE(scalar + CURVE_ORDER), 32);

  assert.equal(verifyEd25519Raw(publicKey, message, signature), true);
  assert.equal(verifyEd25519Raw(publicKey, message, noncanonical), false);
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

test("public domain constants cannot mutate consensus derivations or messages", () => {
  const pulseBody = vector.steps[0].envelope.body;
  const descriptor = {
    custodians: pulseBody.next_custodians,
    quorum: pulseBody.next_quorum
  };
  const before = {
    peerId: derivePeerId(vector.actors.A.public_key),
    organismId: deriveOrganismId(vector.birth.body),
    pulseHash: derivePulseHash(pulseBody),
    custodyCommitment: custodyCommitment(descriptor),
    eventPayloadHash: eventPayloadHash({}),
    genesisApproval: genesisApprovalMessage(vector.birth.body).toString("hex"),
    pulseApproval: pulseApprovalMessage(pulseBody).toString("hex"),
    custodyAcceptance: custodyAcceptanceMessage(pulseBody).toString("hex")
  };

  assert.equal(Object.isFrozen(DOMAINS), true);
  for (const separator of Object.values(DOMAINS)) {
    assert.equal(typeof separator, "string");
  }
  assert.throws(() => {
    DOMAINS.PEER_ID = "ATTACKER-CONTROLLED\0";
  }, TypeError);
  assert.throws(() => {
    DOMAINS.PULSE_APPROVAL[0] = "X";
  }, TypeError);

  const exposedApproval = genesisApprovalMessage(vector.birth.body);
  exposedApproval.fill(0);

  assert.deepEqual(
    {
      peerId: derivePeerId(vector.actors.A.public_key),
      organismId: deriveOrganismId(vector.birth.body),
      pulseHash: derivePulseHash(pulseBody),
      custodyCommitment: custodyCommitment(descriptor),
      eventPayloadHash: eventPayloadHash({}),
      genesisApproval: genesisApprovalMessage(vector.birth.body).toString("hex"),
      pulseApproval: pulseApprovalMessage(pulseBody).toString("hex"),
      custodyAcceptance: custodyAcceptanceMessage(pulseBody).toString("hex")
    },
    before
  );
});
