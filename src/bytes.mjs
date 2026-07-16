import {
  callGetter,
  createTextEncoder,
  createUint8Array,
  mathFloor,
  numberParseInt,
  regexpTest,
  stringCharCodeAt,
  stringSlice,
  textEncoderEncode,
  typedArraySet,
  typeError
} from "./primordials.mjs";

const encoder = createTextEncoder();
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
    if (callGetter(typedArrayTag, value) !== "Uint8Array") return null;
    byteLength = callGetter(typedArrayByteLength, value);
    byteOffset = callGetter(typedArrayByteOffset, value);
    backingBuffer = callGetter(typedArrayBuffer, value);
  } catch {
    return null;
  }

  if (sharedArrayBufferByteLength) {
    try {
      callGetter(sharedArrayBufferByteLength, backingBuffer);
      return null;
    } catch {
      // A normal ArrayBuffer fails the SharedArrayBuffer brand check.
    }
  }
  try {
    callGetter(arrayBufferByteLength, backingBuffer);
    return createUint8Array(backingBuffer, byteOffset, byteLength);
  } catch {
    return null;
  }
}

export function byteLengthOfBytes(value) {
  try {
    return callGetter(typedArrayByteLength, value);
  } catch {
    return null;
  }
}

export function isSharedByteView(value) {
  if (!sharedArrayBufferByteLength) return false;
  try {
    const backingBuffer = callGetter(typedArrayBuffer, value);
    callGetter(sharedArrayBufferByteLength, backingBuffer);
    return true;
  } catch {
    return false;
  }
}

export function utf8Bytes(value) {
  return textEncoderEncode(encoder, value);
}

export function asciiBytes(value) {
  const result = createUint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = stringCharCodeAt(value, index);
    if (code > 0x7f) throw typeError("ASCII input contains a non-ASCII code point");
    result[index] = code;
  }
  return result;
}

export function concatBytes(...parts) {
  const arrays = new Array(parts.length);
  const lengths = new Array(parts.length);
  let totalLength = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const entry = asBytes(parts[index]);
    if (entry === null) throw typeError("concatBytes accepts only byte arrays");
    const entryLength = byteLengthOfBytes(entry);
    if (entryLength === null) throw typeError("concatBytes accepts only stable byte arrays");
    arrays[index] = entry;
    lengths[index] = entryLength;
    totalLength += entryLength;
  }
  const result = createUint8Array(totalLength);
  let offset = 0;
  for (let index = 0; index < arrays.length; index += 1) {
    const entry = arrays[index];
    typedArraySet(result, entry, offset);
    offset += lengths[index];
  }
  return result;
}

export function equalBytes(left, right) {
  const leftBytes = asBytes(left);
  const rightBytes = asBytes(right);
  if (!leftBytes || !rightBytes) return false;
  const leftLength = byteLengthOfBytes(leftBytes);
  const rightLength = byteLengthOfBytes(rightBytes);
  if (leftLength === null || rightLength === null || leftLength !== rightLength) return false;
  let difference = 0;
  for (let index = 0; index < leftLength; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function encodeBase64Url(value) {
  const bytes = asBytes(value);
  if (!bytes) throw typeError("encodeBase64Url accepts only a byte array");
  const byteLength = byteLengthOfBytes(bytes);
  if (byteLength === null) throw typeError("encodeBase64Url accepts only a stable byte array");
  let result = "";
  for (let index = 0; index < byteLength; index += 3) {
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
  if (
    typeof value !== "string" ||
    value.length % 4 === 1 ||
    !regexpTest(/^[A-Za-z0-9_-]*$/, value)
  ) {
    return null;
  }
  const outputLength = mathFloor((value.length * 6) / 8);
  const result = createUint8Array(outputLength);
  let accumulator = 0;
  let bits = 0;
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
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
  if (
    typeof value !== "string" ||
    value.length % 2 !== 0 ||
    !regexpTest(/^[0-9a-fA-F]*$/, value)
  ) {
    return null;
  }
  const outputLength = value.length / 2;
  const result = createUint8Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    result[index] = numberParseInt(stringSlice(value, index * 2, index * 2 + 2), 16);
  }
  return result;
}
