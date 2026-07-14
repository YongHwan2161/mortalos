const decoder = new TextDecoder("utf-8", { fatal: true });

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
  }
}

class DuplicateAwareParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
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
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail("trailing-data");
    assertIJson(value);
    return value;
  }

  parseValue() {
    const token = this.text[this.index];
    if (token === "{") return this.parseObject();
    if (token === "[") return this.parseArray();
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

  parseArray() {
    const result = [];
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      result.push(this.parseValue());
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

  parseObject() {
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
      result[key] = this.parseValue();
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

export function parseJsonBytes(bytes) {
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new JsonInputError("E_PARSE_INVALID_UTF8", "invalid-utf8");
  }
  return new DuplicateAwareParser(text).parse();
}

export function canonicalize(value) {
  assertIJson(value);
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new JsonInputError("E_PARSE_NON_IJSON", `unsupported-${typeof value}`);
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalize(value), "utf8");
}

export function isCanonical(bytes, value) {
  return Buffer.from(bytes).equals(canonicalBytes(value));
}
