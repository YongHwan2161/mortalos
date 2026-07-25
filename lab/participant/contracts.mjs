export const PARTICIPANT_OPERATION_FORMAT = "mortalos-participant-operation/1";
export const PARTICIPANT_SNAPSHOT_FORMAT = "mortalos-participant-snapshot/1";
export const PARTICIPANT_PORT_FORMAT = "mortalos-participant-port/1";

export const PARTICIPANT_PORTS = Object.freeze({
  DurableStore: Object.freeze(["read", "write"]),
  EvidenceStore: Object.freeze(["load", "replace"]),
  KeyStore: Object.freeze(["create", "describe", "destroy", "sign"]),
  SignOnceJournal: Object.freeze(["complete", "read", "record", "reserve"]),
  StateStore: Object.freeze(["load", "replace"]),
  Transport: Object.freeze(["receive", "send"])
});

export const PORT_FAILURE_CODES = Object.freeze([
  "E_PORT_CAPABILITY_UNAVAILABLE",
  "E_PORT_CORRUPT_RESULT",
  "E_PORT_IO_FAILURE",
  "E_PORT_TIMEOUT",
  "E_PORT_TRANSPORT_UNAVAILABLE"
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function portSuccess(value = null) {
  return Object.freeze({
    format: PARTICIPANT_PORT_FORMAT,
    ok: true,
    value: clone(value)
  });
}

export function portFailure(code, detail = null) {
  if (!PORT_FAILURE_CODES.includes(code)) throw new TypeError(`unsupported participant port failure: ${code}`);
  if (detail !== null && typeof detail !== "string") throw new TypeError("participant port failure detail must be text");
  return Object.freeze({
    code,
    detail,
    format: PARTICIPANT_PORT_FORMAT,
    ok: false
  });
}

export function assertPortResult(result, label = "participant port") {
  if (!result || typeof result !== "object" || Array.isArray(result) || result.format !== PARTICIPANT_PORT_FORMAT) {
    throw new TypeError(`${label} returned an unversioned result`);
  }
  if (result.ok === true && Object.keys(result).sort().join(",") === "format,ok,value") return result.value;
  if (
    result.ok === false &&
    Object.keys(result).sort().join(",") === "code,detail,format,ok" &&
    PORT_FAILURE_CODES.includes(result.code)
  ) {
    const error = new Error(`${result.code}: ${result.detail ?? label}`);
    error.code = result.code;
    throw error;
  }
  throw new TypeError(`${label} returned a corrupt result`);
}

export function assertPortShape(port, name) {
  const required = PARTICIPANT_PORTS[name];
  if (!required) throw new TypeError(`unknown participant port: ${name}`);
  if (!port || typeof port !== "object") throw new TypeError(`${name} port is required`);
  for (const method of required) {
    if (typeof port[method] !== "function") throw new TypeError(`${name}.${method} is required`);
  }
  return port;
}
