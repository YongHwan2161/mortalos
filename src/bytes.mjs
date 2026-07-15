const encoder = new TextEncoder();
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength"
).get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset"
).get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer"
).get;
const typedArrayTag = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag
).get;
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength"
).get;
const sharedArrayBufferByteLength =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get;
const BASE64URL_INDEX = Object.freeze(
  Object.fromEntries([...BASE64URL].map((character, index) => [character, index]))
);

export function asBytes(value) {
  let byteLength;
  let byteOffset;
  let backingBuffer;
  try {
    if (typedArrayTag.call(value) !== "Uint8Array") return null;
    byteLength = typedArrayByteLength.call(value);
    byteOffset = typedArrayByteOffset.call(value);
    backingBuffer = typedArrayBuffer.call(value);
  } catch {
    return null;
  }

  if (sharedArrayBufferByteLength) {
    try {
      sharedArrayBufferByteLength.call(backingBuffer);
      return null;
    } catch {
      // A normal ArrayBuffer fails the SharedArrayBuffer brand check.
    }
  }
  try {
    arrayBufferByteLength.call(backingBuffer);
    return new Uint8Array(backingBuffer, byteOffset, byteLength);
  } catch {
    return null;
  }
}

export function isSharedByteView(value) {
  if (!sharedArrayBufferByteLength) return false;
  try {
    const backingBuffer = typedArrayBuffer.call(value);
    sharedArrayBufferByteLength.call(backingBuffer);
    return true;
  } catch {
    return false;
  }
}

export function utf8Bytes(value) {
  return encoder.encode(value);
}

export function asciiBytes(value) {
  const result = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new TypeError("ASCII input contains a non-ASCII code point");
    result[index] = code;
  }
  return result;
}

export function concatBytes(...parts) {
  const arrays = parts.map(asBytes);
  if (arrays.some((entry) => entry === null)) {
    throw new TypeError("concatBytes accepts only byte arrays");
  }
  const result = new Uint8Array(arrays.reduce((total, entry) => total + entry.byteLength, 0));
  let offset = 0;
  for (const entry of arrays) {
    result.set(entry, offset);
    offset += entry.byteLength;
  }
  return result;
}

export function equalBytes(left, right) {
  const leftBytes = asBytes(left);
  const rightBytes = asBytes(right);
  if (!leftBytes || !rightBytes || leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function encodeBase64Url(value) {
  const bytes = asBytes(value);
  if (!bytes) throw new TypeError("encodeBase64Url accepts only a byte array");
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64URL[first >>> 2];
    result += BASE64URL[((first & 0x03) << 4) | ((second ?? 0) >>> 4)];
    if (second !== undefined) {
      result += BASE64URL[((second & 0x0f) << 2) | ((third ?? 0) >>> 6)];
    }
    if (third !== undefined) result += BASE64URL[third & 0x3f];
  }
  return result;
}

export function decodeBase64Url(value) {
  if (typeof value !== "string" || value.length % 4 === 1 || !/^[A-Za-z0-9_-]*$/.test(value)) {
    return null;
  }
  const outputLength = Math.floor((value.length * 6) / 8);
  const result = new Uint8Array(outputLength);
  let accumulator = 0;
  let bits = 0;
  let outputIndex = 0;
  for (const character of value) {
    const digit = BASE64URL_INDEX[character];
    if (digit === undefined) return null;
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result[outputIndex] = (accumulator >>> bits) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << bits) - 1;
    }
  }
  return encodeBase64Url(result) === value ? result : null;
}

export function hexToBytes(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(value)) {
    return null;
  }
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}
