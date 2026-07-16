import { ed25519 } from "@noble/curves/ed25519.js";
import { SHA256_IV, SHA512_IV } from "@noble/hashes/_md.js";
import { _SHA256, _SHA512, sha256 } from "@noble/hashes/sha2.js";

// Capture the realm operations used after public-input getters have had a chance to
// run. Calling these references explicitly prevents later prototype replacement from
// changing capability checks, collection bookkeeping, or result immutability.
const reflectApply = Reflect.apply;
const reflectGet = Reflect.get;
const globalObject = globalThis;
const arrayConstructor = Array;
const arrayPrototype = Array.prototype;
const arrayAtIntrinsic = Array.prototype.at;
const arrayIsArrayIntrinsic = Array.isArray;
const arrayFilterIntrinsic = Array.prototype.filter;
const arrayForEachIntrinsic = Array.prototype.forEach;
const arrayIncludesIntrinsic = Array.prototype.includes;
const arrayIteratorIntrinsic = Array.prototype[Symbol.iterator];
const arrayJoinIntrinsic = Array.prototype.join;
const arrayMapIntrinsic = Array.prototype.map;
const arrayPushIntrinsic = Array.prototype.push;
const arrayReduceIntrinsic = Array.prototype.reduce;
const arraySliceIntrinsic = Array.prototype.slice;
const arraySomeIntrinsic = Array.prototype.some;
const arraySortIntrinsic = Array.prototype.sort;
const arrayBufferConstructor = ArrayBuffer;
const arrayBufferIsViewIntrinsic = ArrayBuffer.isView;
const bigIntConstructor = BigInt;
const bigIntToStringIntrinsic = BigInt.prototype.toString;
const bigInt64ArrayConstructor = BigInt64Array;
const bigUint64ArrayConstructor = BigUint64Array;
const booleanConstructor = Boolean;
const dataViewConstructor = DataView;
const errorConstructor = Error;
const evalErrorConstructor = EvalError;
const float32ArrayConstructor = Float32Array;
const float64ArrayConstructor = Float64Array;
const functionConstructor = Function;
const functionCallIntrinsic = Function.prototype.call;
const functionToStringIntrinsic = Function.prototype.toString;
const int8ArrayConstructor = Int8Array;
const int16ArrayConstructor = Int16Array;
const int32ArrayConstructor = Int32Array;
const jsonParseIntrinsic = JSON.parse;
const jsonStringifyIntrinsic = JSON.stringify;
const mapConstructor = Map;
const mapGetIntrinsic = Map.prototype.get;
const mapHasIntrinsic = Map.prototype.has;
const mapKeysIntrinsic = Map.prototype.keys;
const mapSetIntrinsic = Map.prototype.set;
const mapValuesIntrinsic = Map.prototype.values;
const mapSizeIntrinsic = Object.getOwnPropertyDescriptor(Map.prototype, "size").get;
const mapIteratorPrototype = Object.getPrototypeOf(new Map().keys());
const mapIteratorNextIntrinsic = mapIteratorPrototype.next;
const mathFloorIntrinsic = Math.floor;
const mathMaxIntrinsic = Math.max;
const numberConstructor = Number;
const numberIsFiniteIntrinsic = Number.isFinite;
const numberIsIntegerIntrinsic = Number.isInteger;
const numberIsSafeIntegerIntrinsic = Number.isSafeInteger;
const numberParseIntIntrinsic = Number.parseInt;
const objectConstructor = Object;
const objectPrototype = Object.prototype;
const objectCreateIntrinsic = Object.create;
const objectDefinePropertyIntrinsic = Object.defineProperty;
const objectEntriesIntrinsic = Object.entries;
const objectFreezeIntrinsic = Object.freeze;
const objectFromEntriesIntrinsic = Object.fromEntries;
const objectGetOwnPropertyDescriptorIntrinsic = Object.getOwnPropertyDescriptor;
const objectGetOwnPropertyDescriptorsIntrinsic = Object.getOwnPropertyDescriptors;
const objectGetPrototypeOfIntrinsic = Object.getPrototypeOf;
const objectHasOwnIntrinsic = Object.hasOwn;
const objectIsIntrinsic = Object.is;
const objectIsExtensibleIntrinsic = Object.isExtensible;
const objectKeysIntrinsic = Object.keys;
const objectValuesIntrinsic = Object.values;
const rangeErrorConstructor = RangeError;
const referenceErrorConstructor = ReferenceError;
const reflectOwnKeysIntrinsic = Reflect.ownKeys;
const regexpConstructor = RegExp;
const regexpExecIntrinsic = RegExp.prototype.exec;
const setConstructor = Set;
const setAddIntrinsic = Set.prototype.add;
const setHasIntrinsic = Set.prototype.has;
const setKeysIntrinsic = Set.prototype.keys;
const setSizeIntrinsic = Object.getOwnPropertyDescriptor(Set.prototype, "size").get;
const setIteratorPrototype = Object.getPrototypeOf(new Set().keys());
const setIteratorNextIntrinsic = setIteratorPrototype.next;
const sharedArrayBufferConstructor =
  typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer;
const stringConstructor = String;
const stringCharCodeAtIntrinsic = String.prototype.charCodeAt;
const stringIteratorIntrinsic = String.prototype[Symbol.iterator];
const stringReplaceAllIntrinsic = String.prototype.replaceAll;
const stringSliceIntrinsic = String.prototype.slice;
const stringStartsWithIntrinsic = String.prototype.startsWith;
const syntaxErrorConstructor = SyntaxError;
const textDecoderConstructor = TextDecoder;
const textDecoderDecodeIntrinsic = TextDecoder.prototype.decode;
const textEncoderConstructor = TextEncoder;
const textEncoderEncodeIntrinsic = TextEncoder.prototype.encode;
const typeErrorConstructor = TypeError;
const symbolConstructor = Symbol;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayConstructor = Object.getPrototypeOf(Uint8Array);
const typedArraySetIntrinsic = typedArrayPrototype.set;
const typedArraySubarrayIntrinsic = typedArrayPrototype.subarray;
const uint8ArrayConstructor = Uint8Array;
const uint8ClampedArrayConstructor = Uint8ClampedArray;
const uint16ArrayConstructor = Uint16Array;
const uint32ArrayConstructor = Uint32Array;
const uriErrorConstructor = URIError;
const weakMapConstructor = WeakMap;
const weakSetConstructor = WeakSet;
const weakSetAddIntrinsic = WeakSet.prototype.add;
const weakSetDeleteIntrinsic = WeakSet.prototype.delete;
const weakSetHasIntrinsic = WeakSet.prototype.has;

function iteratorToArray(iterator, nextIntrinsic) {
  const result = new arrayConstructor();
  while (true) {
    const step = reflectApply(nextIntrinsic, iterator, []);
    if (step.done) return result;
    reflectApply(arrayPushIntrinsic, result, [step.value]);
  }
}

function ownDescriptor(target, property) {
  return reflectApply(objectGetOwnPropertyDescriptorIntrinsic, objectConstructor, [
    target,
    property
  ]);
}

function objectHasOwnCaptured(value, property) {
  return reflectApply(objectHasOwnIntrinsic, objectConstructor, [value, property]);
}

function descriptorMatches(actual, expected) {
  if (!actual || !expected) return actual === expected;
  if (
    actual.configurable !== expected.configurable ||
    actual.enumerable !== expected.enumerable
  ) {
    return false;
  }
  const expectedIsData = objectHasOwnCaptured(expected, "value");
  if (objectHasOwnCaptured(actual, "value") !== expectedIsData) return false;
  if (expectedIsData) {
    return (
      reflectApply(objectIsIntrinsic, objectConstructor, [actual.value, expected.value]) &&
      actual.writable === expected.writable
    );
  }
  return actual.get === expected.get && actual.set === expected.set;
}

const integrityTargets = new arrayConstructor();
const integrityTargetBrands = new weakSetConstructor();

function captureIntegrityTarget(target) {
  if (
    (typeof target !== "object" && typeof target !== "function") ||
    target === null ||
    reflectApply(weakSetHasIntrinsic, integrityTargetBrands, [target])
  ) {
    return;
  }
  reflectApply(weakSetAddIntrinsic, integrityTargetBrands, [target]);
  const keys = reflectApply(reflectOwnKeysIntrinsic, Reflect, [target]);
  const descriptors = new arrayConstructor(keys.length);
  for (let index = 0; index < keys.length; index += 1) {
    reflectApply(objectDefinePropertyIntrinsic, objectConstructor, [
      descriptors,
      stringConstructor(index),
      {
        configurable: true,
        enumerable: true,
        value: ownDescriptor(target, keys[index]),
        writable: true
      }
    ]);
  }
  reflectApply(arrayPushIntrinsic, integrityTargets, [
    {
      descriptors,
      extensible: reflectApply(objectIsExtensibleIntrinsic, objectConstructor, [target]),
      keys,
      prototype: reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [target]),
      target
    }
  ]);
}

function registerIntegritySurface(...targets) {
  for (let index = 0; index < targets.length; index += 1) {
    captureIntegrityTarget(targets[index]);
  }
}

const guardedGlobalNames = [
  "Array",
  "ArrayBuffer",
  "BigInt",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "DataView",
  "Error",
  "EvalError",
  "Float32Array",
  "Float64Array",
  "Function",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Map",
  "Math",
  "Number",
  "Object",
  "RangeError",
  "ReferenceError",
  "Reflect",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "SyntaxError",
  "TextDecoder",
  "TextEncoder",
  "TypeError",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
  "URIError",
  "WeakMap",
  "WeakSet"
];
if (sharedArrayBufferConstructor !== undefined) {
  reflectApply(arrayPushIntrinsic, guardedGlobalNames, ["SharedArrayBuffer"]);
}
const guardedGlobalDescriptors = new arrayConstructor(guardedGlobalNames.length);
for (let index = 0; index < guardedGlobalNames.length; index += 1) {
  reflectApply(objectDefinePropertyIntrinsic, objectConstructor, [
    guardedGlobalDescriptors,
    stringConstructor(index),
    {
      configurable: true,
      enumerable: true,
      value: ownDescriptor(globalObject, guardedGlobalNames[index]),
      writable: true
    }
  ]);
}

const arrayIteratorPrototype = Object.getPrototypeOf(new arrayConstructor()[Symbol.iterator]());
const stringIteratorPrototype = Object.getPrototypeOf(""[Symbol.iterator]());
const iteratorPrototype = Object.getPrototypeOf(arrayIteratorPrototype);
const typedArrayIteratorPrototype = Object.getPrototypeOf(
  new uint8ArrayConstructor()[Symbol.iterator]()
);

const intrinsicConstructors = [
  objectConstructor,
  functionConstructor,
  arrayConstructor,
  numberConstructor,
  bigIntConstructor,
  booleanConstructor,
  stringConstructor,
  symbolConstructor,
  regexpConstructor,
  errorConstructor,
  evalErrorConstructor,
  rangeErrorConstructor,
  referenceErrorConstructor,
  syntaxErrorConstructor,
  typeErrorConstructor,
  uriErrorConstructor,
  mapConstructor,
  setConstructor,
  weakMapConstructor,
  weakSetConstructor,
  arrayBufferConstructor,
  dataViewConstructor,
  uint8ArrayConstructor,
  uint8ClampedArrayConstructor,
  uint16ArrayConstructor,
  uint32ArrayConstructor,
  int8ArrayConstructor,
  int16ArrayConstructor,
  int32ArrayConstructor,
  float32ArrayConstructor,
  float64ArrayConstructor,
  bigInt64ArrayConstructor,
  bigUint64ArrayConstructor,
  textDecoderConstructor,
  textEncoderConstructor
];
if (sharedArrayBufferConstructor !== undefined) {
  reflectApply(arrayPushIntrinsic, intrinsicConstructors, [sharedArrayBufferConstructor]);
}
for (let index = 0; index < intrinsicConstructors.length; index += 1) {
  const constructor = intrinsicConstructors[index];
  captureIntegrityTarget(constructor);
  captureIntegrityTarget(constructor.prototype);
}
registerIntegritySurface(
  Math,
  JSON,
  Reflect,
  typedArrayConstructor,
  typedArrayPrototype,
  iteratorPrototype,
  arrayIteratorPrototype,
  mapIteratorPrototype,
  setIteratorPrototype,
  stringIteratorPrototype,
  typedArrayIteratorPrototype
);
const sha256SubclassPrototype = Object.getPrototypeOf(_SHA256.prototype);
const sha512SubclassPrototype = Object.getPrototypeOf(_SHA512.prototype);
const hashMdPrototype = Object.getPrototypeOf(sha256SubclassPrototype);
registerIntegritySurface(
  ed25519,
  ed25519.verify,
  ed25519.Point,
  ed25519.Point.prototype,
  ed25519.Point.BASE,
  ed25519.Point.ZERO,
  ed25519.Point.Fp,
  ed25519.Point.Fn,
  ed25519.lengths,
  sha256,
  _SHA256,
  _SHA256.prototype,
  sha256SubclassPrototype,
  _SHA512,
  _SHA512.prototype,
  sha512SubclassPrototype,
  hashMdPrototype,
  SHA256_IV,
  SHA512_IV
);

export function realmIntrinsicsIntact() {
  try {
    for (let index = 0; index < guardedGlobalNames.length; index += 1) {
      if (
        !descriptorMatches(
          ownDescriptor(globalObject, guardedGlobalNames[index]),
          guardedGlobalDescriptors[index]
        )
      ) {
        return false;
      }
    }
    for (let index = 0; index < integrityTargets.length; index += 1) {
      const baseline = integrityTargets[index];
      if (
        reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [baseline.target]) !==
          baseline.prototype ||
        reflectApply(objectIsExtensibleIntrinsic, objectConstructor, [baseline.target]) !==
          baseline.extensible
      ) {
        return false;
      }
      const keys = reflectApply(reflectOwnKeysIntrinsic, Reflect, [baseline.target]);
      if (keys.length !== baseline.keys.length) return false;
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        if (
          keys[keyIndex] !== baseline.keys[keyIndex] ||
          !descriptorMatches(
            ownDescriptor(baseline.target, keys[keyIndex]),
            baseline.descriptors[keyIndex]
          )
        ) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function isArray(value) {
  return reflectApply(arrayIsArrayIntrinsic, undefined, [value]);
}

export function createArray(length = 0) {
  return new arrayConstructor(length);
}

export function defineArrayIndex(target, index, value) {
  reflectApply(objectDefinePropertyIntrinsic, objectConstructor, [
    target,
    stringConstructor(index),
    {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    }
  ]);
  return target;
}

export function defineOwnDataProperty(target, property, value) {
  reflectApply(objectDefinePropertyIntrinsic, objectConstructor, [
    target,
    property,
    {
      configurable: false,
      enumerable: true,
      value,
      writable: false
    }
  ]);
  return target;
}

export function arrayLength(value) {
  const length = reflectGet(value, "length");
  if (!reflectApply(numberIsSafeIntegerIntrinsic, undefined, [length]) || length < 0) {
    throw new typeErrorConstructor("array length must be a safe non-negative integer");
  }
  return length;
}

export function arrayValueAt(value, index) {
  return reflectGet(value, stringConstructor(index));
}

export function copyArrayByIndex(value) {
  const length = arrayLength(value);
  const result = new arrayConstructor(length);
  for (let index = 0; index < length; index += 1) {
    defineArrayIndex(result, index, arrayValueAt(value, index));
  }
  return result;
}

function requireDataDescriptor(descriptor, message) {
  if (!descriptor || !objectHasOwnCaptured(descriptor, "value")) {
    throw new typeErrorConstructor(message);
  }
  return descriptor.value;
}

export function snapshotOwnDataRecord(value, label = "record") {
  if (value === null || typeof value !== "object") {
    throw new typeErrorConstructor(`${label} must be an ordinary data record`);
  }
  const prototype = reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [value]);
  if (prototype !== objectPrototype && prototype !== null) {
    throw new typeErrorConstructor(`${label} must be an ordinary data record`);
  }
  const descriptors = reflectApply(
    objectGetOwnPropertyDescriptorsIntrinsic,
    objectConstructor,
    [value]
  );
  const keys = reflectApply(reflectOwnKeysIntrinsic, Reflect, [descriptors]);
  for (let index = 0; index < keys.length; index += 1) {
    requireDataDescriptor(
      reflectGet(descriptors, keys[index]),
      `${label} must expose only own data properties`
    );
  }
  return descriptors;
}

export function ownDataRecordEntry(descriptors, property) {
  const holder = ownDescriptor(descriptors, property);
  if (!holder) return { present: false, value: undefined };
  return {
    present: true,
    value: requireDataDescriptor(holder.value, "observation property must be data")
  };
}

export function copyOwnDataArray(value, label = "array") {
  if (!reflectApply(arrayIsArrayIntrinsic, undefined, [value])) {
    throw new typeErrorConstructor(`${label} must be an array`);
  }
  const prototype = reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [value]);
  if (prototype !== arrayPrototype) {
    throw new typeErrorConstructor(`${label} must be an ordinary array`);
  }
  const descriptors = reflectApply(
    objectGetOwnPropertyDescriptorsIntrinsic,
    objectConstructor,
    [value]
  );
  const length = requireDataDescriptor(
    reflectGet(descriptors, "length"),
    `${label} length must be an own data property`
  );
  if (!reflectApply(numberIsSafeIntegerIntrinsic, undefined, [length]) || length < 0) {
    throw new typeErrorConstructor(`${label} length must be a safe non-negative integer`);
  }
  const keys = reflectApply(reflectOwnKeysIntrinsic, Reflect, [descriptors]);
  if (keys.length !== length + 1) {
    throw new typeErrorConstructor(`${label} must contain only dense indices and length`);
  }
  const result = new arrayConstructor(length);
  for (let index = 0; index < length; index += 1) {
    const property = stringConstructor(index);
    const entry = ownDescriptor(descriptors, property);
    if (!entry) {
      throw new typeErrorConstructor(`${label} must contain dense own indices`);
    }
    defineArrayIndex(
      result,
      index,
      requireDataDescriptor(entry.value, `${label} indices must be own data properties`)
    );
  }
  return result;
}

export function copyBoundedOwnDataArray(value, expectedLength, label = "array") {
  if (ownDataArrayLength(value, label) !== expectedLength) {
    throw new typeErrorConstructor(`${label} length changed during snapshot`);
  }
  const result = new arrayConstructor(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = ownDescriptor(value, stringConstructor(index));
    if (!descriptor) {
      throw new typeErrorConstructor(`${label} must contain dense own indices`);
    }
    defineArrayIndex(
      result,
      index,
      requireDataDescriptor(descriptor, `${label} indices must be own data properties`)
    );
  }
  if (ownDataArrayLength(value, label) !== expectedLength) {
    throw new typeErrorConstructor(`${label} length changed during snapshot`);
  }
  return result;
}

export function snapshotNamedOwnDataValues(value, names, label = "record") {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    throw new typeErrorConstructor(`${label} must be an ordinary data record`);
  }
  const prototype = reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [value]);
  if (prototype !== objectPrototype && prototype !== null) {
    throw new typeErrorConstructor(`${label} must be an ordinary data record`);
  }
  const result = new arrayConstructor(names.length);
  for (let index = 0; index < names.length; index += 1) {
    const descriptor = ownDescriptor(value, names[index]);
    defineArrayIndex(
      result,
      index,
      descriptor === undefined
        ? undefined
        : requireDataDescriptor(
          descriptor,
          `${label}.${names[index]} must be an own data property`
        )
    );
  }
  return result;
}

export function ownDataArrayLength(value, label = "array") {
  if (!reflectApply(arrayIsArrayIntrinsic, undefined, [value])) {
    throw new typeErrorConstructor(`${label} must be an array`);
  }
  const prototype = reflectApply(objectGetPrototypeOfIntrinsic, objectConstructor, [value]);
  if (prototype !== arrayPrototype) {
    throw new typeErrorConstructor(`${label} must be an ordinary array`);
  }
  const length = requireDataDescriptor(
    ownDescriptor(value, "length"),
    `${label} length must be an own data property`
  );
  if (!reflectApply(numberIsSafeIntegerIntrinsic, undefined, [length]) || length < 0) {
    throw new typeErrorConstructor(`${label} length must be a safe non-negative integer`);
  }
  return length;
}

export function arrayFilter(value, callback) {
  return reflectApply(arrayFilterIntrinsic, value, [callback]);
}

export function arrayIncludes(value, entry) {
  return reflectApply(arrayIncludesIntrinsic, value, [entry]);
}

export function arrayMap(value, callback) {
  return reflectApply(arrayMapIntrinsic, value, [callback]);
}

export function arrayJoin(value, separator) {
  return reflectApply(arrayJoinIntrinsic, value, [separator]);
}

export function arrayPush(value, entry) {
  return reflectApply(arrayPushIntrinsic, value, [entry]);
}

export function arraySlice(value, start, end) {
  return reflectApply(arraySliceIntrinsic, value, [start, end]);
}

export function arraySort(value, compare) {
  return reflectApply(arraySortIntrinsic, value, [compare]);
}

export function freeze(value) {
  return reflectApply(objectFreezeIntrinsic, undefined, [value]);
}

export function objectCreate(prototype) {
  return reflectApply(objectCreateIntrinsic, objectConstructor, [prototype]);
}

export function objectEntries(value) {
  return reflectApply(objectEntriesIntrinsic, objectConstructor, [value]);
}

export function objectHasOwn(value, property) {
  return reflectApply(objectHasOwnIntrinsic, objectConstructor, [value, property]);
}

export function objectKeys(value) {
  return reflectApply(objectKeysIntrinsic, objectConstructor, [value]);
}

export function ownKeys(value) {
  return reflectApply(reflectOwnKeysIntrinsic, Reflect, [value]);
}

export function objectValues(value) {
  return reflectApply(objectValuesIntrinsic, undefined, [value]);
}

export function numberIsFinite(value) {
  return reflectApply(numberIsFiniteIntrinsic, undefined, [value]);
}

export function numberIsInteger(value) {
  return reflectApply(numberIsIntegerIntrinsic, undefined, [value]);
}

export function numberIsSafeInteger(value) {
  return reflectApply(numberIsSafeIntegerIntrinsic, undefined, [value]);
}

export function numberParseInt(value, radix) {
  return reflectApply(numberParseIntIntrinsic, undefined, [value, radix]);
}

export function mathFloor(value) {
  return reflectApply(mathFloorIntrinsic, undefined, [value]);
}

export function callGetter(getter, target) {
  return reflectApply(getter, target, []);
}

export function callFunction(fn, target, argumentsList) {
  return reflectApply(fn, target, argumentsList);
}

export function regexpExec(expression, value) {
  return reflectApply(regexpExecIntrinsic, expression, [value]);
}

export function regexpTest(expression, value) {
  return reflectApply(regexpExecIntrinsic, expression, [value]) !== null;
}

export function stringCharCodeAt(value, index) {
  return reflectApply(stringCharCodeAtIntrinsic, value, [index]);
}

export function stringReplaceAll(value, search, replacement) {
  return reflectApply(stringReplaceAllIntrinsic, value, [search, replacement]);
}

export function stringSlice(value, start, end) {
  return reflectApply(stringSliceIntrinsic, value, [start, end]);
}

export function stringStartsWith(value, prefix) {
  return reflectApply(stringStartsWithIntrinsic, value, [prefix]);
}

export function bigInt(value) {
  return reflectApply(bigIntConstructor, undefined, [value]);
}

export function bigIntToString(value) {
  return reflectApply(bigIntToStringIntrinsic, value, []);
}

export function createUint8Array(first, second, third) {
  if (second === undefined) return new uint8ArrayConstructor(first);
  return new uint8ArrayConstructor(first, second, third);
}

export function typedArraySet(target, source, offset) {
  return reflectApply(typedArraySetIntrinsic, target, [source, offset]);
}

export function typedArraySubarray(target, start, end) {
  return reflectApply(typedArraySubarrayIntrinsic, target, [start, end]);
}

export function textEncoderEncode(target, value) {
  return reflectApply(textEncoderEncodeIntrinsic, target, [value]);
}

export function textDecoderDecode(target, value) {
  return reflectApply(textDecoderDecodeIntrinsic, target, [value]);
}

export function createTextEncoder() {
  return new textEncoderConstructor();
}

export function createTextDecoder(label, options) {
  return new textDecoderConstructor(label, options);
}

export function typeError(message) {
  return new typeErrorConstructor(message);
}

export function createMap() {
  return new mapConstructor();
}

export function mapGet(target, key) {
  return reflectApply(mapGetIntrinsic, target, [key]);
}

export function mapHas(target, key) {
  return reflectApply(mapHasIntrinsic, target, [key]);
}

export function mapSet(target, key, value) {
  reflectApply(mapSetIntrinsic, target, [key, value]);
  return target;
}

export function mapKeys(target) {
  return iteratorToArray(reflectApply(mapKeysIntrinsic, target, []), mapIteratorNextIntrinsic);
}

export function mapValues(target) {
  return iteratorToArray(
    reflectApply(mapValuesIntrinsic, target, []),
    mapIteratorNextIntrinsic
  );
}

export function mapSize(target) {
  return reflectApply(mapSizeIntrinsic, target, []);
}

export function createSet() {
  return new setConstructor();
}

export function setAdd(target, value) {
  reflectApply(setAddIntrinsic, target, [value]);
  return target;
}

export function setHas(target, value) {
  return reflectApply(setHasIntrinsic, target, [value]);
}

export function setValues(target) {
  return iteratorToArray(reflectApply(setKeysIntrinsic, target, []), setIteratorNextIntrinsic);
}

export function setSize(target) {
  return reflectApply(setSizeIntrinsic, target, []);
}

export function createWeakSet() {
  return new weakSetConstructor();
}

export function weakSetAdd(target, value) {
  reflectApply(weakSetAddIntrinsic, target, [value]);
  return target;
}

export function weakSetDelete(target, value) {
  return reflectApply(weakSetDeleteIntrinsic, target, [value]);
}

export function weakSetHas(target, value) {
  return reflectApply(weakSetHasIntrinsic, target, [value]);
}
