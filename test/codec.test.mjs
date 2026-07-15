import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  canonicalBytes,
  canonicalize,
  isCanonical,
  JsonInputError,
  JSON_LIMITS,
  parseJsonBytes,
  parseJsonDocument,
  snapshotBytes
} from "../src/index.mjs";

test("canonicalizer follows deterministic UTF-16 property order and JSON primitives", () => {
  const value = { z: [true, false, null, -1.5], a: "line\ntext", A: 1 };
  assert.equal(canonicalize(value), '{"A":1,"a":"line\\ntext","z":[true,false,null,-1.5]}');
  assert.deepEqual(parseJsonBytes(canonicalBytes(value)), Object.assign(Object.create(null), value));
  assert.equal(isCanonical(canonicalBytes(value), value), true);
  assert.equal(isCanonical(Buffer.from('{ "a":1}'), { a: 1 }), false);
});

test("canonicalizer matches RFC 8785 primitive and UTF-16 ordering examples", () => {
  const primitiveExample = {
    numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
    string: "€$\u000f\nAB\"\\\"/",
    literals: [null, true, false]
  };
  assert.equal(
    canonicalize(primitiveExample),
    '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nAB\\\"\\\\\\\"/"}'
  );

  const orderingExample = {
    "€": "Euro Sign",
    "\r": "Carriage Return",
    "דּ": "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "😀": "Emoji: Grinning Face",
    "\u0080": "Control",
    "ö": "Latin Small Letter O With Diaeresis"
  };
  assert.equal(
    canonicalize(orderingExample),
    '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}'
  );
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
  assert.throws(() => parseJsonBytes(Buffer.from("tru")), JsonInputError);
  assert.throws(() => parseJsonBytes(Buffer.from('"unterminated')), JsonInputError);
  assert.throws(() => canonicalize("\udc00"), JsonInputError);
  assert.throws(() => canonicalize(Number.POSITIVE_INFINITY), JsonInputError);
});

test("parser enforces deterministic byte and nesting limits before resource exhaustion", () => {
  assert.throws(
    () => parseJsonBytes(Buffer.alloc(JSON_LIMITS.default_bytes + 1, 0x20)),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_LIMIT_EXCEEDED"
  );
  const accepted = `${"[".repeat(JSON_LIMITS.max_depth)}${"]".repeat(
    JSON_LIMITS.max_depth
  )}`;
  assert.doesNotThrow(() => parseJsonBytes(Buffer.from(accepted)));

  const nested = `${"[".repeat(JSON_LIMITS.max_depth + 1)}${"]".repeat(
    JSON_LIMITS.max_depth + 1
  )}`;
  assert.throws(
    () => parseJsonBytes(Buffer.from(nested)),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_LIMIT_EXCEEDED"
  );
});

test("parser validates byte and depth limit options as non-negative safe integers", () => {
  const invalidLimits = [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "64", null];
  for (const invalid of invalidLimits) {
    assert.throws(
      () => parseJsonBytes(Buffer.from("0"), { maxBytes: invalid }),
      (error) =>
        error instanceof JsonInputError &&
        error.code === "E_PARSE_LIMIT_EXCEEDED" &&
        error.detail === "maxBytes:invalid"
    );
    assert.throws(
      () => parseJsonBytes(Buffer.from("0"), { maxDepth: invalid }),
      (error) =>
        error instanceof JsonInputError &&
        error.code === "E_PARSE_LIMIT_EXCEEDED" &&
        error.detail === "maxDepth:invalid"
    );
  }

  assert.equal(parseJsonBytes(Buffer.from("0"), { maxDepth: 0 }), 0);
  assert.throws(
    () => parseJsonBytes(Buffer.from("[]"), { maxDepth: 0 }),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_LIMIT_EXCEEDED"
  );
});

test("byte snapshots use intrinsic Uint8Array metadata and preserve Buffer compatibility", () => {
  class HostileBytes extends Uint8Array {
    get byteLength() {
      throw new Error("untrusted byteLength getter reached");
    }

    get buffer() {
      throw new Error("untrusted buffer getter reached");
    }

    get [Symbol.toStringTag]() {
      throw new Error("untrusted tag getter reached");
    }
  }

  const hostile = new HostileBytes(Buffer.from('{"ok":true}'));
  assert.equal(parseJsonBytes(hostile).ok, true);
  assert.equal(parseJsonBytes(new Uint8Array(Buffer.from("42"))), 42);
  assert.equal(parseJsonBytes(Buffer.from("42")), 42);

  const oversized = new HostileBytes(9);
  assert.throws(
    () => snapshotBytes(oversized, 8),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_LIMIT_EXCEEDED"
  );

  for (const invalid of [new ArrayBuffer(1), new DataView(new ArrayBuffer(1)), new Uint16Array(1)]) {
    assert.throws(
      () => snapshotBytes(invalid),
      (error) => error instanceof JsonInputError && error.code === "E_PARSE_INVALID_UTF8"
    );
  }
});

test("byte snapshots accept foreign ArrayBuffers but reject local and foreign SharedArrayBuffers", () => {
  const foreignBytes = vm.runInNewContext("new Uint8Array([52, 50])");
  assert.equal(parseJsonBytes(foreignBytes), 42);

  const sharedViews = [
    new Uint8Array(new SharedArrayBuffer(2)),
    vm.runInNewContext("new Uint8Array(new SharedArrayBuffer(2))")
  ];
  for (const shared of sharedViews) {
    assert.throws(
      () => snapshotBytes(shared),
      (error) =>
        error instanceof JsonInputError &&
        error.code === "E_PARSE_INVALID_UTF8" &&
        error.detail === "shared-buffer-unsupported"
    );
  }
});

test("parseJsonDocument owns its byte snapshot and generic canonical checks have no JSON size cap", () => {
  const source = Buffer.from('{"ok":true}');
  const document = parseJsonDocument(source);
  source.fill(0x20);
  assert.equal(Buffer.from(document.bytes).toString("utf8"), '{"ok":true}');
  assert.equal(document.value.ok, true);

  const largeValue = "x".repeat(JSON_LIMITS.default_bytes + 1);
  assert.equal(isCanonical(canonicalBytes(largeValue), largeValue), true);

  const detached = new Uint8Array(Buffer.from("42"));
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(
    () => snapshotBytes(detached),
    (error) => error instanceof JsonInputError && error.code === "E_PARSE_INVALID_UTF8"
  );
});

test("parser accepts arrays, literals, escapes, exponent numbers, and empty containers", () => {
  const parsed = parseJsonBytes(Buffer.from('[{},[],true,false,null,"\\u0061",-1.25e+2]'));
  assert.equal(JSON.stringify(parsed), '[{},[],true,false,null,"a",-125]');
  assert.throws(() => canonicalize(undefined), JsonInputError);
});

test("canonicalizer rejects sparse arrays and every non-JSON value instead of eliding it", () => {
  const sparse = [];
  sparse.length = 1;
  for (const value of [
    sparse,
    [undefined],
    { nested: undefined },
    [() => {}],
    [Symbol("not-json")],
    [1n]
  ]) {
    assert.throws(
      () => canonicalize(value),
      (error) => error instanceof JsonInputError && error.code === "E_PARSE_NON_IJSON"
    );
  }
});

test("canonicalizer accepts only data-only JSON containers and never invokes accessors", () => {
  class RecordLike {
    constructor() {
      this.visible = true;
    }
  }

  const symbolOnly = { [Symbol("hidden")]: 1 };
  const nonEnumerable = {};
  Object.defineProperty(nonEnumerable, "hidden", { value: 1 });
  const customPrototype = Object.create({ inherited: true });
  customPrototype.visible = 1;
  const arrayWithExtraProperty = [1];
  arrayWithExtraProperty.extra = 2;
  const arrayWithSymbol = [1];
  arrayWithSymbol[Symbol("hidden")] = 2;
  let getterReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterReads += 1;
      return 1;
    }
  });
  const cyclic = {};
  cyclic.self = cyclic;

  for (const value of [
    new Date(0),
    new Map([["a", 1]]),
    new Set([1]),
    new Number(1),
    new String("value"),
    new Boolean(true),
    Object(Symbol("boxed")),
    /pattern/u,
    new RecordLike(),
    symbolOnly,
    nonEnumerable,
    customPrototype,
    arrayWithExtraProperty,
    arrayWithSymbol,
    accessor,
    cyclic
  ]) {
    assert.throws(
      () => canonicalize(value),
      (error) => error instanceof JsonInputError && error.code === "E_PARSE_NON_IJSON"
    );
  }
  assert.equal(getterReads, 0);

  const foreignPlain = vm.runInNewContext("({ b: [2], a: 1 })");
  const foreignNullPrototype = vm.runInNewContext(
    "Object.assign(Object.create(null), { b: [2], a: 1 })"
  );
  assert.equal(canonicalize(foreignPlain), '{"a":1,"b":[2]}');
  assert.equal(canonicalize(foreignNullPrototype), '{"a":1,"b":[2]}');
  assert.equal(canonicalize(Object.assign(Object.create(null), { a: 1 })), '{"a":1}');
  assert.equal(canonicalize(Object.freeze({ a: 1 })), '{"a":1}');
  assert.equal(canonicalize(Object.freeze([1, { a: 2 }])), '[1,{"a":2}]');

  const strippedExotics = [
    new Date(0),
    new Map([["x", 1]]),
    new Set([1]),
    new WeakMap(),
    new WeakSet(),
    new Boolean(true),
    new Number(7),
    new String("value"),
    Object(1n),
    Object(Symbol("boxed")),
    /pattern/u,
    new ArrayBuffer(8),
    new DataView(new ArrayBuffer(8)),
    new Uint8Array([1, 2])
  ];
  if (typeof SharedArrayBuffer === "function") {
    strippedExotics.push(new SharedArrayBuffer(8));
  }
  if (typeof WeakRef === "function") {
    strippedExotics.push(new WeakRef({}));
  }
  for (const exotic of strippedExotics) {
    Object.setPrototypeOf(exotic, null);
    assert.throws(
      () => canonicalize(exotic),
      (error) => error instanceof JsonInputError && error.code === "E_PARSE_NON_IJSON"
    );
  }
  const disguisedDate = new Date(0);
  Object.setPrototypeOf(disguisedDate, Object.prototype);
  assert.equal(canonicalize(disguisedDate), "{}");
  const foreignStrippedDate = vm.runInNewContext(
    "Object.setPrototypeOf(new Date(0), null)"
  );
  assert.throws(() => canonicalize(foreignStrippedDate), JsonInputError);

  const spoofedPrototype = Object.create(null);
  Object.defineProperty(spoofedPrototype, "constructor", {
    value: Object,
    enumerable: false
  });
  const spoofedRecord = Object.create(spoofedPrototype);
  spoofedRecord.a = 1;
  assert.throws(() => canonicalize(spoofedRecord), JsonInputError);

  let arrayGetterReads = 0;
  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      arrayGetterReads += 1;
      return 1;
    }
  });
  accessorArray.length = 1;
  assert.throws(() => canonicalize(accessorArray), JsonInputError);
  assert.equal(arrayGetterReads, 0);

  const hugeSparse = [];
  hugeSparse.length = 1_000_000_000;
  assert.throws(() => canonicalize(hugeSparse), JsonInputError);
  assert.throws(() => canonicalize({ "\ud800": 1 }), JsonInputError);

  const indirect = { child: [] };
  indirect.child.push(indirect);
  assert.throws(() => canonicalize(indirect), JsonInputError);

  const counters = { descriptors: 0, gets: 0, getPrototypeOf: 0, ownKeys: 0 };
  const proxy = new Proxy({ x: 1 }, {
    get(target, key, receiver) {
      counters.gets += 1;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      counters.descriptors += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    getPrototypeOf(target) {
      counters.getPrototypeOf += 1;
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      counters.ownKeys += 1;
      return Reflect.ownKeys(target);
    }
  });
  assert.equal(canonicalize({ a: proxy, b: proxy }), '{"a":{"x":1},"b":{"x":1}}');
  assert.deepEqual(counters, { descriptors: 1, gets: 0, getPrototypeOf: 1, ownKeys: 1 });

  for (const target of [{ a: 1 }, [1]]) {
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();
    assert.throws(
      () => canonicalize(revocable.proxy),
      (error) => error instanceof JsonInputError && error.code === "E_PARSE_NON_IJSON"
    );
  }
});
