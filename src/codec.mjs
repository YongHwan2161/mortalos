import {
  asBytes,
  byteLengthOfBytes,
  equalBytes,
  isSharedByteView,
  utf8Bytes
} from "./bytes.mjs";
import {
  createUint8Array,
  createWeakSet,
  defineOwnDataProperty,
  freeze,
  numberIsSafeInteger,
  typedArraySet,
  weakSetAdd,
  weakSetHas
} from "./primordials.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const arrayBufferIsView = ArrayBuffer.isView;
const arrayIsArray = Array.isArray;
const functionToString = Function.prototype.toString;
const jsonStringify = JSON.stringify;
const objectConstructorSource = functionToString.call(Object);
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const objectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
const objectGetPrototypeOf = Object.getPrototypeOf;
const reflectApply = Reflect.apply;
const reflectOwnKeys = Reflect.ownKeys;
const invalidRecordPrototype = Symbol("invalid record prototype");
const parsedRecords = new WeakSet();
const jsonInputErrorBrands = createWeakSet();
const slotProbeSentinel = Object.freeze({});
const intrinsicSlotProbes = [
  [Date.prototype.getTime, []],
  [objectGetOwnPropertyDescriptor(Map.prototype, "size").get, []],
  [objectGetOwnPropertyDescriptor(Set.prototype, "size").get, []],
  [WeakMap.prototype.has, [slotProbeSentinel]],
  [WeakSet.prototype.has, [slotProbeSentinel]],
  [Boolean.prototype.valueOf, []],
  [Number.prototype.valueOf, []],
  [String.prototype.valueOf, []],
  [BigInt.prototype.valueOf, []],
  [Symbol.prototype.valueOf, []],
  [objectGetOwnPropertyDescriptor(RegExp.prototype, "source").get, []],
  [objectGetOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get, []],
  [objectGetOwnPropertyDescriptor(DataView.prototype, "byteLength").get, []]
];
if (typeof SharedArrayBuffer === "function") {
  intrinsicSlotProbes.push([
    objectGetOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get,
    []
  ]);
}
if (typeof WeakRef === "function") {
  intrinsicSlotProbes.push([WeakRef.prototype.deref, []]);
}
Object.freeze(intrinsicSlotProbes);

export const JSON_LIMITS = Object.freeze({
  default_bytes: 1024 * 1024,
  envelope_bytes: 64 * 1024,
  event_payload_bytes: 256 * 1024,
  max_depth: 64
});

export class JsonInputError extends Error {
  constructor(code, detail) {
    super(detail);
    weakSetAdd(jsonInputErrorBrands, this);
    defineOwnDataProperty(this, "name", "JsonInputError");
    defineOwnDataProperty(this, "code", code);
    defineOwnDataProperty(this, "detail", detail);
  }
}

export function isJsonInputError(value) {
  return weakSetHas(jsonInputErrorBrands, value);
}

freeze(JsonInputError.prototype);
freeze(JsonInputError);

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function nonIJson(detail) {
  throw new JsonInputError("E_PARSE_NON_IJSON", detail);
}

function hasRecognizedIntrinsicSlots(value) {
  if (arrayBufferIsView(value)) return true;
  for (const [probe, args] of intrinsicSlotProbes) {
    try {
      reflectApply(probe, value, args);
      return true;
    } catch {
      // An incompatible receiver proves only that this particular slot is absent.
    }
  }
  return false;
}

function plainRecordPrototype(value) {
  let prototype;
  try {
    prototype = objectGetPrototypeOf(value);
  } catch {
    return invalidRecordPrototype;
  }
  if (prototype === null) return null;

  let parent;
  let constructorDescriptor;
  try {
    parent = objectGetPrototypeOf(prototype);
    constructorDescriptor = objectGetOwnPropertyDescriptor(prototype, "constructor");
  } catch {
    return invalidRecordPrototype;
  }
  if (parent !== null || !constructorDescriptor || !("value" in constructorDescriptor)) {
    return invalidRecordPrototype;
  }
  try {
    const prototypeDescriptor = objectGetOwnPropertyDescriptor(
      constructorDescriptor.value,
      "prototype"
    );
    return (
      typeof constructorDescriptor.value === "function" &&
      prototypeDescriptor &&
      "value" in prototypeDescriptor &&
      prototypeDescriptor.value === prototype &&
      functionToString.call(constructorDescriptor.value) === objectConstructorSource
    ) ? prototype : invalidRecordPrototype;
  } catch {
    return invalidRecordPrototype;
  }
}

function ownDataDescriptors(value) {
  let descriptors;
  let keys;
  try {
    descriptors = objectGetOwnPropertyDescriptors(value);
    keys = reflectOwnKeys(descriptors);
  } catch {
    nonIJson("container-inspection-failed");
  }
  if (keys.some((key) => typeof key === "symbol")) nonIJson("symbol-property");
  return { descriptors, keys };
}

function dataValue(descriptor, detail) {
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    nonIJson(detail);
  }
  return descriptor.value;
}

function canonicalizeIJson(value, memo, active) {
  if (value === null || typeof value === "boolean") return jsonStringify(value);
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) nonIJson("lone-surrogate");
    return jsonStringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) nonIJson("non-finite-number");
    return jsonStringify(value);
  }
  if (!value || typeof value !== "object") nonIJson(`unsupported-${typeof value}`);
  if (memo.has(value)) return memo.get(value);
  if (active.has(value)) nonIJson("cyclic-reference");

  active.add(value);
  let result;
  try {
    if (arrayIsArray(value)) {
      const { descriptors, keys } = ownDataDescriptors(value);
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !("value" in lengthDescriptor)) nonIJson("array-length");
      const length = lengthDescriptor.value;
      if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) {
        nonIJson("sparse-or-extended-array");
      }
      const entries = [];
      for (let index = 0; index < length; index += 1) {
        entries.push(
          canonicalizeIJson(
            dataValue(descriptors[String(index)], "array-accessor-or-hole"),
            memo,
            active
          )
        );
      }
      result = `[${entries.join(",")}]`;
    } else {
      const recordPrototype = plainRecordPrototype(value);
      if (recordPrototype === invalidRecordPrototype) nonIJson("non-plain-object");
      if (
        recordPrototype === null &&
        !parsedRecords.has(value) &&
        hasRecognizedIntrinsicSlots(value)
      ) {
        nonIJson("intrinsic-slot-object");
      }
      const { descriptors, keys } = ownDataDescriptors(value);
      const names = keys;
      for (const name of names) {
        if (typeof name !== "string") nonIJson("symbol-property");
      }
      names.sort();
      result = `{${names
        .map((name) => {
          const entry = dataValue(descriptors[name], "object-accessor-or-non-enumerable");
          return `${canonicalizeIJson(name, memo, active)}:${canonicalizeIJson(entry, memo, active)}`;
        })
        .join(",")}}`;
    }
  } finally {
    active.delete(value);
  }
  memo.set(value, result);
  return result;
}

function assertIJson(value) {
  canonicalizeIJson(value, new WeakMap(), new WeakSet());
}

class DuplicateAwareParser {
  constructor(text, maxDepth) {
    this.text = text;
    this.index = 0;
    this.maxDepth = maxDepth;
  }

  fail(detail) {
    throw new JsonInputError("E_PARSE_INVALID_JSON", `${detail}@${this.index}`);
  }

  skipWhitespace() {
    while (/^[\u0009\u000a\u000d\u0020]$/.test(this.text[this.index] ?? "")) {
      this.index += 1;
    }
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail("trailing-data");
    assertIJson(value);
    return value;
  }

  parseValue(containerDepth) {
    const token = this.text[this.index];
    if (token === "{" || token === "[") {
      if (containerDepth >= this.maxDepth) {
        throw new JsonInputError("E_PARSE_LIMIT_EXCEEDED", `depth>${this.maxDepth}`);
      }
      return token === "{"
        ? this.parseObject(containerDepth + 1)
        : this.parseArray(containerDepth + 1);
    }
    if (token === '"') return this.parseString();
    if (token === "t") return this.parseLiteral("true", true);
    if (token === "f") return this.parseLiteral("false", false);
    if (token === "n") return this.parseLiteral("null", null);
    if (token === "-" || (token >= "0" && token <= "9")) return this.parseNumber();
    this.fail("expected-value");
  }

  parseLiteral(source, value) {
    if (this.text.slice(this.index, this.index + source.length) !== source) {
      this.fail(`expected-${source}`);
    }
    this.index += source.length;
    return value;
  }

  parseString() {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index));
        } catch {
          this.fail("invalid-string");
        }
      }
      if (code <= 0x1f) this.fail("unescaped-control-character");
      if (code === 0x5c) {
        this.index += 1;
        const escape = this.text[this.index];
        if (escape === "u") {
          const digits = this.text.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) this.fail("invalid-unicode-escape");
          this.index += 5;
          continue;
        }
        if (!['"', "\\", "/", "b", "f", "n", "r", "t"].includes(escape)) {
          this.fail("invalid-escape");
        }
      }
      this.index += 1;
    }
    this.fail("unterminated-string");
  }

  parseNumber() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
      this.text.slice(this.index)
    );
    if (!match) this.fail("invalid-number");
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      throw new JsonInputError("E_PARSE_NON_IJSON", "number-out-of-range");
    }
    return value;
  }

  parseArray(containerDepth) {
    const result = [];
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      result.push(this.parseValue(containerDepth));
      this.skipWhitespace();
      const token = this.text[this.index];
      if (token === "]") {
        this.index += 1;
        return result;
      }
      if (token !== ",") this.fail("expected-array-separator");
      this.index += 1;
    }
  }

  parseObject(containerDepth) {
    const result = Object.create(null);
    parsedRecords.add(result);
    const keys = new Set();
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') this.fail("expected-property-name");
      const key = this.parseString();
      if (keys.has(key)) {
        throw new JsonInputError("E_PARSE_DUPLICATE_PROPERTY", key);
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") this.fail("expected-colon");
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue(containerDepth);
      this.skipWhitespace();
      const token = this.text[this.index];
      if (token === "}") {
        this.index += 1;
        return result;
      }
      if (token !== ",") this.fail("expected-object-separator");
      this.index += 1;
    }
  }
}

function assertLimit(name, value) {
  if (!numberIsSafeInteger(value) || value < 0) {
    throw new JsonInputError("E_PARSE_LIMIT_EXCEEDED", `${name}:invalid`);
  }
}

export function snapshotBytes(bytes, maxBytes = JSON_LIMITS.default_bytes) {
  assertLimit("maxBytes", maxBytes);
  const view = asBytes(bytes);
  if (!view) {
    throw new JsonInputError(
      "E_PARSE_INVALID_UTF8",
      isSharedByteView(bytes) ? "shared-buffer-unsupported" : "input-not-stable-uint8array"
    );
  }
  const byteLength = byteLengthOfBytes(view);
  if (byteLength === null) {
    throw new JsonInputError("E_PARSE_INVALID_UTF8", "input-buffer-invalid");
  }
  if (byteLength > maxBytes) {
    throw new JsonInputError(
      "E_PARSE_LIMIT_EXCEEDED",
      `bytes:${byteLength}/${maxBytes}`
    );
  }
  const snapshot = createUint8Array(byteLength);
  try {
    typedArraySet(snapshot, view, 0);
  } catch {
    throw new JsonInputError("E_PARSE_INVALID_UTF8", "input-buffer-invalid");
  }
  return snapshot;
}

export function parseJsonDocument(
  bytes,
  { maxBytes = JSON_LIMITS.default_bytes, maxDepth = JSON_LIMITS.max_depth } = {}
) {
  assertLimit("maxBytes", maxBytes);
  assertLimit("maxDepth", maxDepth);
  const snapshot = snapshotBytes(bytes, maxBytes);
  let text;
  try {
    text = decoder.decode(snapshot);
  } catch {
    throw new JsonInputError("E_PARSE_INVALID_UTF8", "invalid-utf8");
  }
  return {
    bytes: snapshot,
    value: new DuplicateAwareParser(text, maxDepth).parse()
  };
}

export function parseJsonBytes(bytes, options = {}) {
  return parseJsonDocument(bytes, options).value;
}

export function canonicalize(value) {
  try {
    return canonicalizeIJson(value, new WeakMap(), new WeakSet());
  } catch (error) {
    if (isJsonInputError(error)) throw error;
    throw new JsonInputError("E_PARSE_NON_IJSON", "canonicalization-failed");
  }
}

export function canonicalBytes(value) {
  return utf8Bytes(canonicalize(value));
}

export function isCanonical(bytes, value) {
  return equalBytes(snapshotBytes(bytes, Number.MAX_SAFE_INTEGER), canonicalBytes(value));
}
