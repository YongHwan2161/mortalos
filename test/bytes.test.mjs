import assert from "node:assert/strict";
import test from "node:test";
import {
  asBytes,
  asciiBytes,
  concatBytes,
  decodeBase64Url,
  encodeBase64Url,
  equalBytes,
  hexToBytes,
  utf8Bytes
} from "../src/index.mjs";

test("portable byte helpers are canonical and independent of Buffer", () => {
  assert.equal(Buffer.isBuffer(utf8Bytes("MortalOS")), false);
  assert.deepEqual([...asciiBytes("ABC\0")], [65, 66, 67, 0]);
  assert.throws(() => asciiBytes("생"), /non-ASCII/);
  assert.equal(encodeBase64Url(new Uint8Array()), "");
  assert.equal(encodeBase64Url(utf8Bytes("f")), "Zg");
  assert.equal(encodeBase64Url(utf8Bytes("fo")), "Zm8");
  assert.equal(encodeBase64Url(utf8Bytes("foo")), "Zm9v");
  assert.deepEqual([...decodeBase64Url("Zm9v")], [...utf8Bytes("foo")]);
  assert.equal(decodeBase64Url("A"), null);
  assert.equal(decodeBase64Url("AB"), null);
  assert.equal(decodeBase64Url("Zg=="), null);
  assert.equal(decodeBase64Url("!"), null);
  assert.deepEqual([...hexToBytes("00aF")], [0, 175]);
  assert.equal(hexToBytes("0"), null);
  assert.equal(hexToBytes("zz"), null);
  assert.deepEqual([...concatBytes(utf8Bytes("a"), utf8Bytes("b"))], [97, 98]);
  assert.equal(equalBytes(utf8Bytes("same"), utf8Bytes("same")), true);
  assert.equal(equalBytes(utf8Bytes("same"), utf8Bytes("diff")), false);
  assert.equal(equalBytes(utf8Bytes("a"), utf8Bytes("aa")), false);
  assert.equal(asBytes(new DataView(new ArrayBuffer(1))), null);
  assert.throws(() => concatBytes(utf8Bytes("a"), "b"), /byte arrays/);
  assert.throws(() => encodeBase64Url("not-bytes"), /byte array/);
});
