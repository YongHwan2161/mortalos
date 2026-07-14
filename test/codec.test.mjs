import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalBytes,
  canonicalize,
  isCanonical,
  JsonInputError,
  parseJsonBytes
} from "../src/index.mjs";

test("canonicalizer follows deterministic UTF-16 property order and JSON primitives", () => {
  const value = { z: [true, false, null, -1.5], a: "line\ntext", A: 1 };
  assert.equal(canonicalize(value), '{"A":1,"a":"line\\ntext","z":[true,false,null,-1.5]}');
  assert.deepEqual(parseJsonBytes(canonicalBytes(value)), Object.assign(Object.create(null), value));
  assert.equal(isCanonical(canonicalBytes(value), value), true);
  assert.equal(isCanonical(Buffer.from('{ "a":1}'), { a: 1 }), false);
});

test("duplicate-aware parser rejects duplicate properties before object conversion", () => {
  assert.throws(
    () => parseJsonBytes(Buffer.from('{"outer":{"x":1,"x":2}}')),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_DUPLICATE_PROPERTY"
  );
});

test("parser rejects invalid UTF-8, JSON, escapes, controls, and non-I-JSON values", () => {
  const inputs = [
    Buffer.from([0xff]),
    Buffer.from('{"a":}'),
    Buffer.from('{"a":"\\q"}'),
    Buffer.from('{"a":"\\u12"}'),
    Buffer.from('{"a":"line\n"}'),
    Buffer.from('{"a":01}'),
    Buffer.from('{"a":1e9999}'),
    Buffer.from('{"a":"\\ud800"}')
  ];
  for (const input of inputs) assert.throws(() => parseJsonBytes(input), JsonInputError);
});

test("parser accepts arrays, literals, escapes, exponent numbers, and empty containers", () => {
  const parsed = parseJsonBytes(Buffer.from('[{},[],true,false,null,"\\u0061",-1.25e+2]'));
  assert.equal(JSON.stringify(parsed), '[{},[],true,false,null,"a",-125]');
  assert.throws(() => canonicalize(undefined), JsonInputError);
});
