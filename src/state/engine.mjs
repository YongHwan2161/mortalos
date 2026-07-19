import { sha256 } from "@noble/hashes/sha2.js";
import {
  canonicalBytes,
  isCanonical,
  parseJsonBytes
} from "../codec.mjs";
import { decodeBase64Url, encodeBase64Url } from "../bytes.mjs";

export const STATE_ENGINE_VERSION = "mortalos-state/1";
export const STATE_INPUT_FORMAT = "mortalos-state-input/1";
export const STATE_RECEIPT_FORMAT = "mortalos-state-receipt/1";
export const STATE_TRANSITION_FORMAT = "mortalos-state-transition/1";
export const STATE_LIMITS = Object.freeze({
  input_bytes: 1_024,
  pulse_count: 1_000_000,
  receipt_bytes: 4_096,
  state_bytes: 4_096,
  steps: 100
});

const STATE_DOMAIN = new TextEncoder().encode("MORTALOS/STATE/1/STATE\0");
const INPUT_DOMAIN = new TextEncoder().encode("MORTALOS/STATE/1/INPUT\0");
const GENOME_DOMAIN = new TextEncoder().encode("MORTALOS/STATE/1/GENOME\0");

export const PULSE_SEED_V1_GENOME = Object.freeze({
  engine: STATE_ENGINE_VERSION,
  genome: "pulse-seed-v1"
});
export const PULSE_SEED_V1_GENOME_BYTES = canonicalBytes(PULSE_SEED_V1_GENOME);

export class StateTransitionError extends Error {
  constructor(code, fieldPath, detail) {
    super(`${code}: ${detail}`);
    this.name = "StateTransitionError";
    this.code = code;
    this.fieldPath = fieldPath;
    this.detail = detail;
  }
}

function fail(code, fieldPath, detail) {
  throw new StateTransitionError(code, fieldPath, detail);
}

function exactKeys(value, expected, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_STATE_INPUT_INVALID", path, "object-required");
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_STATE_INPUT_INVALID", path, "keys");
  }
}

function ownBytes(source, maximum, path) {
  let bytes;
  try {
    bytes = source instanceof Uint8Array ? new Uint8Array(source) : new Uint8Array(source);
  } catch {
    fail("E_STATE_INPUT_INVALID", path, "bytes-required");
  }
  if (bytes.byteLength > maximum) fail("E_STATE_LIMIT_EXCEEDED", path, String(maximum));
  return bytes;
}

function parseCanonical(source, maximum, path) {
  const bytes = ownBytes(source, maximum, path);
  let value;
  try {
    value = parseJsonBytes(bytes, { maxBytes: maximum, maxDepth: 16 });
  } catch {
    fail("E_STATE_INPUT_INVALID", path, "json");
  }
  if (!isCanonical(bytes, value)) fail("E_STATE_INPUT_INVALID", path, "canonical");
  return { bytes, value };
}

function digest(domain, bytes) {
  const combined = new Uint8Array(domain.byteLength + bytes.byteLength);
  combined.set(domain);
  combined.set(bytes, domain.byteLength);
  return `sha256:${encodeBase64Url(sha256(combined))}`;
}

export function stateRoot(stateBytes) {
  return digest(STATE_DOMAIN, ownBytes(stateBytes, STATE_LIMITS.state_bytes, "/state"));
}

export function stateInputHash(inputBytes) {
  return digest(INPUT_DOMAIN, ownBytes(inputBytes, STATE_LIMITS.input_bytes, "/input"));
}

export function stateGenomeHash(genomeBytes = PULSE_SEED_V1_GENOME_BYTES) {
  return digest(GENOME_DOMAIN, ownBytes(genomeBytes, STATE_LIMITS.state_bytes, "/genome"));
}

export function createInitialState(avatarSeed) {
  let encoded;
  if (typeof avatarSeed === "string") {
    const decoded = decodeBase64Url(avatarSeed);
    if (!decoded || decoded.byteLength !== 16) fail("E_STATE_INPUT_INVALID", "/avatar_seed", "16-bytes");
    encoded = avatarSeed;
  } else {
    const bytes = ownBytes(avatarSeed, 16, "/avatar_seed");
    if (bytes.byteLength !== 16) fail("E_STATE_INPUT_INVALID", "/avatar_seed", "16-bytes");
    encoded = encodeBase64Url(bytes);
  }
  return canonicalBytes({ avatar_seed: encoded, format: STATE_ENGINE_VERSION, pulse_count: 0 });
}

export function createNurtureInput(steps = 1) {
  return canonicalBytes({ action: "nurture", format: STATE_INPUT_FORMAT, steps });
}

function validateGenome(genome) {
  exactKeys(genome, ["engine", "genome"], "/genome");
  if (genome.engine !== STATE_ENGINE_VERSION || genome.genome !== "pulse-seed-v1") {
    fail("E_STATE_GENOME_MISMATCH", "/genome", "pulse-seed-v1");
  }
}

function validateState(state) {
  exactKeys(state, ["avatar_seed", "format", "pulse_count"], "/state");
  const seed = decodeBase64Url(state.avatar_seed);
  if (!seed || seed.byteLength !== 16 || state.format !== STATE_ENGINE_VERSION) {
    fail("E_STATE_INPUT_INVALID", "/state", "format-or-seed");
  }
  if (!Number.isSafeInteger(state.pulse_count) || state.pulse_count < 0) {
    fail("E_STATE_INPUT_INVALID", "/state/pulse_count", "integer");
  }
  if (state.pulse_count > STATE_LIMITS.pulse_count) {
    fail("E_STATE_LIMIT_EXCEEDED", "/state/pulse_count", String(STATE_LIMITS.pulse_count));
  }
}

function validateInput(input) {
  exactKeys(input, ["action", "format", "steps"], "/input");
  if (input.format !== STATE_INPUT_FORMAT || input.action !== "nurture") {
    fail("E_STATE_INPUT_INVALID", "/input", "nurture-v1");
  }
  if (!Number.isSafeInteger(input.steps) || input.steps < 1) {
    fail("E_STATE_INPUT_INVALID", "/input/steps", "positive-integer");
  }
  if (input.steps > STATE_LIMITS.steps) {
    fail("E_STATE_LIMIT_EXCEEDED", "/input/steps", String(STATE_LIMITS.steps));
  }
}

export function validateGenesisStateBinding({
  expectedGenomeHash,
  expectedInitialStateRoot,
  genomeBytes,
  initialStateBytes
}) {
  const genome = parseCanonical(genomeBytes, STATE_LIMITS.state_bytes, "/body/genome_base64url");
  const state = parseCanonical(initialStateBytes, STATE_LIMITS.state_bytes, "/body/initial_state_base64url");
  validateGenome(genome.value);
  validateState(state.value);
  if (state.value.pulse_count !== 0) {
    fail("E_STATE_INITIAL_BINDING", "/body/initial_state_base64url", "pulse_count-zero");
  }
  if (stateGenomeHash(genome.bytes) !== expectedGenomeHash) {
    fail("E_STATE_GENOME_MISMATCH", "/body/genome_hash", expectedGenomeHash);
  }
  if (stateRoot(state.bytes) !== expectedInitialStateRoot) {
    fail("E_STATE_INITIAL_BINDING", "/body/initial_state_root", expectedInitialStateRoot);
  }
  return Object.freeze({ genomeBytes: genome.bytes, initialStateBytes: state.bytes });
}

export function transitionState({
  genomeBytes = PULSE_SEED_V1_GENOME_BYTES,
  inputBytes,
  stateBytes
}) {
  const genome = parseCanonical(genomeBytes, STATE_LIMITS.state_bytes, "/genome");
  const state = parseCanonical(stateBytes, STATE_LIMITS.state_bytes, "/state");
  const input = parseCanonical(inputBytes, STATE_LIMITS.input_bytes, "/input");
  validateGenome(genome.value);
  validateState(state.value);
  validateInput(input.value);
  const nextCount = state.value.pulse_count + input.value.steps;
  if (nextCount > STATE_LIMITS.pulse_count) {
    fail("E_STATE_LIMIT_EXCEEDED", "/state/pulse_count", String(STATE_LIMITS.pulse_count));
  }
  const nextStateBytes = canonicalBytes({
    avatar_seed: state.value.avatar_seed,
    format: STATE_ENGINE_VERSION,
    pulse_count: nextCount
  });
  const receiptBytes = canonicalBytes({
    engine_version: STATE_ENGINE_VERSION,
    format: STATE_RECEIPT_FORMAT,
    genome_hash: stateGenomeHash(genome.bytes),
    input_hash: stateInputHash(input.bytes),
    next_state_hash: stateRoot(nextStateBytes),
    prior_state_hash: stateRoot(state.bytes),
    step_count: input.value.steps
  });
  if (receiptBytes.byteLength > STATE_LIMITS.receipt_bytes) {
    fail("E_STATE_LIMIT_EXCEEDED", "/receipt", String(STATE_LIMITS.receipt_bytes));
  }
  return Object.freeze({ nextStateBytes, receiptBytes });
}

export function createStateTransitionPayload({ genomeBytes, inputBytes, stateBytes }) {
  const transition = transitionState({ genomeBytes, inputBytes, stateBytes });
  return Object.freeze({
    payload: {
      format: STATE_TRANSITION_FORMAT,
      input_base64url: encodeBase64Url(ownBytes(inputBytes, STATE_LIMITS.input_bytes, "/input")),
      next_state_base64url: encodeBase64Url(transition.nextStateBytes),
      prior_state_base64url: encodeBase64Url(ownBytes(stateBytes, STATE_LIMITS.state_bytes, "/state")),
      receipt_base64url: encodeBase64Url(transition.receiptBytes)
    },
    ...transition
  });
}

function payloadArtifact(value, maximum, path) {
  if (typeof value !== "string") fail("E_STATE_INPUT_INVALID", path, "base64url");
  const bytes = decodeBase64Url(value);
  if (!bytes) fail("E_STATE_INPUT_INVALID", path, "base64url");
  return ownBytes(bytes, maximum, path);
}

export function verifyStateTransitionPayload({
  expectedGenomeHash,
  expectedNextStateRoot,
  expectedPriorStateRoot,
  genomeBytes,
  payload
}) {
  exactKeys(payload, [
    "format",
    "input_base64url",
    "next_state_base64url",
    "prior_state_base64url",
    "receipt_base64url"
  ], "/event_payload");
  if (payload.format !== STATE_TRANSITION_FORMAT) {
    fail("E_STATE_INPUT_INVALID", "/event_payload/format", String(payload.format));
  }
  const priorStateBytes = payloadArtifact(payload.prior_state_base64url, STATE_LIMITS.state_bytes, "/event_payload/prior_state_base64url");
  const inputBytes = payloadArtifact(payload.input_base64url, STATE_LIMITS.input_bytes, "/event_payload/input_base64url");
  const nextStateBytes = payloadArtifact(payload.next_state_base64url, STATE_LIMITS.state_bytes, "/event_payload/next_state_base64url");
  const receiptBytes = payloadArtifact(payload.receipt_base64url, STATE_LIMITS.receipt_bytes, "/event_payload/receipt_base64url");
  const genome = ownBytes(genomeBytes, STATE_LIMITS.state_bytes, "/genome");
  if (stateGenomeHash(genome) !== expectedGenomeHash) {
    fail("E_STATE_GENOME_MISMATCH", "/body/genome_hash", expectedGenomeHash);
  }
  if (stateRoot(priorStateBytes) !== expectedPriorStateRoot) {
    fail("E_STATE_PRIOR_ROOT_MISMATCH", "/body/state_root", expectedPriorStateRoot);
  }
  const expected = transitionState({ genomeBytes: genome, inputBytes, stateBytes: priorStateBytes });
  if (!isCanonical(nextStateBytes, parseCanonical(nextStateBytes, STATE_LIMITS.state_bytes, "/event_payload/next_state_base64url").value)) {
    fail("E_STATE_INPUT_INVALID", "/event_payload/next_state_base64url", "canonical");
  }
  if (encodeBase64Url(expected.nextStateBytes) !== encodeBase64Url(nextStateBytes)) {
    fail("E_STATE_NEXT_ROOT_MISMATCH", "/event_payload/next_state_base64url", "transition-output");
  }
  if (encodeBase64Url(expected.receiptBytes) !== encodeBase64Url(receiptBytes)) {
    fail("E_STATE_RECEIPT_MISMATCH", "/event_payload/receipt_base64url", "receipt");
  }
  if (stateRoot(nextStateBytes) !== expectedNextStateRoot) {
    fail("E_STATE_NEXT_ROOT_MISMATCH", "/body/state_root", expectedNextStateRoot);
  }
  return Object.freeze({ nextStateBytes, receiptBytes, priorStateBytes });
}
