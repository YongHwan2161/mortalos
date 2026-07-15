import { asBytes, equalBytes, isSharedByteView, utf8Bytes } from "./bytes.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const getPrototypeOf = Object.getPrototypeOf;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
const hasOwn = Object.hasOwn;
const isArray = Array.isArray;
const ownKeys = Reflect.ownKeys;
const functionToString = Function.prototype.toString;
const objectConstructorSource = functionToString.call(Object);

export const JSON_LIMITS = Object.freeze({
  default_bytes: 1024 * 1024,
  envelope_bytes: 64 * 1024,
  event_payload_bytes: 256 * 1024,
  max_depth: 64
});

export class JsonInputError extends Error {
  constructor(code, detail) {
    super(detail);
    this.name = "JsonInputError";
    this.code = code;
    this.detail = detail;
  }
}

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

function assertIJson(value) {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) {
      throw new JsonInputError("E_PARSE_NON_IJSON", "lone-surrogate");
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new JsonInputError("E_PARSE_NON_IJSON", "non-finite-number");
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) assertIJson(entry);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertIJson(key);
      assertIJson(entry);
    }
    return;
  }
  throw new JsonInputError("E_PARSE_NON_IJSON", `unsupported-${typeof value}`);
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
  if (!Number.isSafeInteger(value) || value < 0) {
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
  if (view.byteLength > maxBytes) {
    throw new JsonInputError(
      "E_PARSE_LIMIT_EXCEEDED",
      `bytes:${view.byteLength}/${maxBytes}`
    );
  }
  const snapshot = new Uint8Array(view.byteLength);
  try {
    snapshot.set(view);
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

function failNonIJson(detail) {
  throw new JsonInputError("E_PARSE_NON_IJSON", detail);
}

function snapshotOwnDescriptors(value) {
  try {
    const descriptorMap = getOwnPropertyDescriptors(value);
    return ownKeys(descriptorMap).map((key) => [
      key,
      getOwnPropertyDescriptor(descriptorMap, key).value
    ]);
  } catch {
    failNonIJson("uninspectable-object");
  }
}

function isDataProperty(descriptor) {
  return hasOwn(descriptor, "value");
}

function isArrayValue(value) {
  try {
    return isArray(value);
  } catch {
    failNonIJson("uninspectable-array-brand");
  }
}

function isPlainRecord(value) {
  let prototype;
  try {
    prototype = getPrototypeOf(value);
  } catch {
    failNonIJson("uninspectable-prototype");
  }
  if (prototype === null || prototype === Object.prototype) return true;

  try {
    if (getPrototypeOf(prototype) !== null) return false;
    const constructorDescriptor = getOwnPropertyDescriptor(prototype, "constructor");
    return Boolean(
      constructorDescriptor &&
        isDataProperty(constructorDescriptor) &&
        typeof constructorDescriptor.value === "function" &&
        functionToString.call(constructorDescriptor.value) === objectConstructorSource
    );
  } catch {
    return false;
  }
}

function canonicalizeArray(value, active) {
  const entries = snapshotOwnDescriptors(value);
  const byKey = new Map(entries);
  const lengthDescriptor = byKey.get("length");
  if (
    !lengthDescriptor ||
    !isDataProperty(lengthDescriptor) ||
    lengthDescriptor.enumerable ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    failNonIJson("array-length-invalid");
  }
  const length = lengthDescriptor.value;
  if (entries.length !== length + 1) failNonIJson("array-hole-or-extra-property");

  const serialized = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = byKey.get(String(index));
    if (!descriptor || !descriptor.enumerable || !isDataProperty(descriptor)) {
      failNonIJson("array-hole-or-accessor");
    }
    serialized.push(canonicalizeValue(descriptor.value, active));
  }
  return `[${serialized.join(",")}]`;
}

function canonicalizeRecord(value, active) {
  if (!isPlainRecord(value)) failNonIJson("exotic-object");
  const entries = snapshotOwnDescriptors(value);
  for (const [key, descriptor] of entries) {
    if (typeof key !== "string") failNonIJson("symbol-property");
    if (hasLoneSurrogate(key)) failNonIJson("lone-surrogate");
    if (!descriptor.enumerable) failNonIJson("non-enumerable-property");
    if (!isDataProperty(descriptor)) failNonIJson("accessor-property");
  }
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, descriptor]) =>
      `${JSON.stringify(key)}:${canonicalizeValue(descriptor.value, active)}`
    )
    .join(",")}}`;
}

function canonicalizeValue(value, active) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failNonIJson("non-finite-number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) failNonIJson("lone-surrogate");
    return JSON.stringify(value);
  }
  if (!value || typeof value !== "object") {
    failNonIJson(`unsupported-${typeof value}`);
  }
  if (active.has(value)) failNonIJson("cyclic-object");

  active.add(value);
  try {
    return isArrayValue(value)
      ? canonicalizeArray(value, active)
      : canonicalizeRecord(value, active);
  } finally {
    active.delete(value);
  }
}

export function canonicalize(value) {
  return canonicalizeValue(value, new WeakSet());
}

export function canonicalBytes(value) {
  return utf8Bytes(canonicalize(value));
}

export function isCanonical(bytes, value) {
  return equalBytes(snapshotBytes(bytes, Number.MAX_SAFE_INTEGER), canonicalBytes(value));
}
