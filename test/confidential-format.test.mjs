import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIDENTIAL_LIMITS,
  counterToIv,
  exactObjectKeys,
  parseCanonicalDocument,
  parseCounter,
  parseEpoch
} from "../src/confidential/format.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { encodeBase64Url } from "../src/bytes.mjs";

test("epoch and counter surfaces accept exact decimal-string boundaries only", () => {
  for (const value of [
    "0",
    "9007199254740991",
    "9007199254740992",
    "18446744073709551615"
  ]) {
    assert.equal(parseEpoch(value), BigInt(value));
  }
  for (const value of [
    0,
    4_294_967_296,
    9_007_199_254_740_992,
    "00",
    "01",
    "+1",
    "-1",
    "1 ",
    "",
    "1e3",
    "18446744073709551616"
  ]) {
    assert.throws(() => parseEpoch(value), /E_CONFIDENTIAL_DECIMAL/u);
  }
  assert.equal(
    parseCounter("4294967295", "/counter"),
    4_294_967_295n
  );
  assert.equal(
    parseCounter("4294967296", "/next", { exclusive: true }),
    CONFIDENTIAL_LIMITS.counter_max_exclusive
  );
  assert.throws(
    () => parseCounter("4294967296", "/counter"),
    /E_CONFIDENTIAL_DECIMAL/u
  );
  assert.throws(
    () => parseCounter("4294967297", "/next", { exclusive: true }),
    /E_CONFIDENTIAL_DECIMAL/u
  );
});

test("the deterministic IV is exactly MOS4 plus uint64 big-endian", () => {
  assert.equal(
    encodeBase64Url(counterToIv(0n)),
    encodeBase64Url(
      new Uint8Array([0x4d, 0x4f, 0x53, 0x34, 0, 0, 0, 0, 0, 0, 0, 0])
    )
  );
  assert.equal(
    encodeBase64Url(counterToIv(4_294_967_295n)),
    encodeBase64Url(
      new Uint8Array([
        0x4d, 0x4f, 0x53, 0x34, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff
      ])
    )
  );
  assert.throws(
    () => counterToIv(4_294_967_296n),
    /E_CONFIDENTIAL_COUNTER_EXHAUSTED/u
  );
});

test("bounded canonical documents and exact object shapes reject ambiguous input", () => {
  assert.doesNotThrow(() => exactObjectKeys({ a: 1 }, ["a"], "/fixture"));
  assert.throws(
    () => exactObjectKeys(null, ["a"], "/fixture"),
    /E_CONFIDENTIAL_FORMAT/u
  );
  assert.throws(
    () => exactObjectKeys({ a: 1, b: 2 }, ["a"], "/fixture"),
    /E_CONFIDENTIAL_FORMAT/u
  );
  const bytes = canonicalBytes({ a: "1" });
  assert.deepEqual(
    parseCanonicalDocument(bytes, 32, "/fixture").value,
    Object.assign(Object.create(null), { a: "1" })
  );
  assert.throws(
    () =>
      parseCanonicalDocument(
        new TextEncoder().encode('{"a":"1"} '),
        32,
        "/fixture"
      ),
    /E_CONFIDENTIAL_FORMAT/u
  );
  assert.throws(
    () => parseCanonicalDocument(bytes, 4, "/fixture"),
    /E_CONFIDENTIAL_LIMIT/u
  );
});
