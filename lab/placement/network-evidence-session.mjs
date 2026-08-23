import { byteLengthOfBytes, isSharedByteView } from "../../src/bytes.mjs";
import { domainHash } from "../../src/confidential/format.mjs";
import {
  arrayPush,
  copyBoundedOwnDataArray,
  freeze,
  ownDataArrayLength,
  ownDataRecordEntry,
  ownKeys,
  realmIntrinsicsIntact,
  snapshotDataMethod,
  snapshotOwnDataRecord
} from "../../src/primordials.mjs";
import {
  decodeRelayFrame,
  openResourcePlacementArtifact,
  RELAY_LIMITS
} from "../../src/transport/protocol.mjs";

const RESPONSE_DOMAIN = "MortalOS placement network evidence response v1";
const MAX_LIVENESS_RESPONSES = 64;
const mapConstructor = Map;
const mapGetIntrinsic = Map.prototype.get;
const mapHasIntrinsic = Map.prototype.has;
const mapSetIntrinsic = Map.prototype.set;
const mapValuesIntrinsic = Map.prototype.values;
const mapIteratorPrototype = Object.getPrototypeOf(new Map().values());
const mapIteratorNextIntrinsic = mapIteratorPrototype.next;
const reflectApply = Reflect.apply;

export class PlacementNetworkEvidenceError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "PlacementNetworkEvidenceError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  throw new PlacementNetworkEvidenceError(code, detail);
}

function requireRealm() {
  if (!realmIntrinsicsIntact()) {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_RUNTIME", "realm-integrity");
  }
}

function exactRecord(value, expected, label) {
  requireRealm();
  let descriptors;
  try {
    descriptors = snapshotOwnDataRecord(value, label);
  } catch {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_FORMAT", `${label}-ordinary-own-data`);
  }
  const keys = ownKeys(descriptors);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !ownDataRecordEntry(descriptors, key).present)
  ) {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_FORMAT", `${label}-keys`);
  }
  const result = Object.create(null);
  for (let index = 0; index < expected.length; index += 1) {
    const key = expected[index];
    result[key] = ownDataRecordEntry(descriptors, key).value;
  }
  return result;
}

function denseArray(value, maximum, label) {
  let length;
  try {
    length = ownDataArrayLength(value, label);
  } catch {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_FORMAT", `${label}-dense-array`);
  }
  if (length > maximum) {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_LIMIT", `${label}-length`);
  }
  try {
    return copyBoundedOwnDataArray(value, length, label);
  } catch {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_FORMAT", `${label}-dense-array`);
  }
}

function ownedResponseBytes(value) {
  const length = byteLengthOfBytes(value);
  if (
    length === null ||
    length < 1 ||
    length > RELAY_LIMITS.message_bytes ||
    isSharedByteView(value)
  ) {
    fail("E_PLACEMENT_NETWORK_EVIDENCE_FORMAT", "liveness-response-bytes");
  }
  return new Uint8Array(value);
}

function responseId(bytes) {
  return domainHash(RESPONSE_DOMAIN, bytes);
}

function addResponse(target, source) {
  const bytes = ownedResponseBytes(source);
  const id = responseId(bytes);
  if (!reflectApply(mapHasIntrinsic, target, [id])) {
    if (target.size >= MAX_LIVENESS_RESPONSES) {
      fail("E_PLACEMENT_NETWORK_EVIDENCE_LIMIT", "liveness-response-count");
    }
    reflectApply(mapSetIntrinsic, target, [id, bytes]);
  }
}

function responseCopies(source) {
  const result = [];
  const iterator = reflectApply(mapValuesIntrinsic, source, []);
  while (true) {
    const step = reflectApply(mapIteratorNextIntrinsic, iterator, []);
    if (step.done) return freeze(result);
    arrayPush(result, new Uint8Array(step.value));
  }
}

export class PlacementNetworkEvidenceSession {
  #cursor = 0;
  #networkResponses = new mapConstructor();
  #readBaseline;
  #readRange;

  constructor(options) {
    const values = exactRecord(options, ["evidence", "transport"], "network-evidence-options");
    try {
      this.#readBaseline = snapshotDataMethod(
        values.evidence,
        "readCurrentEvidence",
        "network-evidence-baseline"
      );
      this.#readRange = snapshotDataMethod(
        values.transport,
        "readRange",
        "network-evidence-transport"
      );
    } catch {
      fail("E_PLACEMENT_NETWORK_EVIDENCE_CAPABILITY", "baseline-or-range");
    }
    freeze(this);
  }

  async readCurrentEvidence() {
    requireRealm();
    const baselineSource = await this.#readBaseline();
    requireRealm();
    const baseline = exactRecord(baselineSource, [
      "observed_at_ms",
      "observed_liveness_responses",
      "observed_placements"
    ], "network-evidence-baseline-result");
    const baselineResponses = denseArray(
      baseline.observed_liveness_responses,
      MAX_LIVENESS_RESPONSES,
      "network-evidence-baseline-responses"
    );
    const placements = denseArray(
      baseline.observed_placements,
      64,
      "network-evidence-baseline-placements"
    );

    let nextCursor = this.#cursor;
    const pending = new mapConstructor();
    let scanned = 0;
    while (true) {
      const pageSource = await this.#readRange(nextCursor, RELAY_LIMITS.range_limit);
      requireRealm();
      const page = denseArray(
        pageSource,
        RELAY_LIMITS.range_limit,
        "network-evidence-range"
      );
      if (page.length === 0) break;
      for (let index = 0; index < page.length; index += 1) {
        const opened = decodeRelayFrame(page[index]);
        if (opened.sequence <= nextCursor) {
          fail("E_PLACEMENT_NETWORK_EVIDENCE_ORDER", "non-monotonic-frame-sequence");
        }
        nextCursor = opened.sequence;
        scanned += 1;
        if (scanned > RELAY_LIMITS.room_messages) {
          fail("E_PLACEMENT_NETWORK_EVIDENCE_LIMIT", "range-scan-count");
        }
        if (opened.control?.kind !== "resource-placement-artifact") continue;
        const artifact = openResourcePlacementArtifact(opened.control);
        if (artifact.artifact_kind !== "liveness-response") continue;
        const bytes = ownedResponseBytes(artifact.payload_bytes);
        const id = responseId(bytes);
        if (
          !reflectApply(mapHasIntrinsic, this.#networkResponses, [id]) &&
          !reflectApply(mapHasIntrinsic, pending, [id])
        ) {
          if (this.#networkResponses.size + pending.size >= MAX_LIVENESS_RESPONSES) {
            fail("E_PLACEMENT_NETWORK_EVIDENCE_LIMIT", "network-response-count");
          }
          reflectApply(mapSetIntrinsic, pending, [id, bytes]);
        }
      }
      if (page.length < RELAY_LIMITS.range_limit) break;
    }

    const pendingIterator = reflectApply(mapValuesIntrinsic, pending, []);
    while (true) {
      const step = reflectApply(mapIteratorNextIntrinsic, pendingIterator, []);
      if (step.done) break;
      const id = responseId(step.value);
      reflectApply(mapSetIntrinsic, this.#networkResponses, [id, step.value]);
    }
    this.#cursor = nextCursor;

    const combined = new mapConstructor();
    for (let index = 0; index < baselineResponses.length; index += 1) {
      addResponse(combined, baselineResponses[index]);
    }
    const networkIterator = reflectApply(mapValuesIntrinsic, this.#networkResponses, []);
    while (true) {
      const step = reflectApply(mapIteratorNextIntrinsic, networkIterator, []);
      if (step.done) break;
      addResponse(combined, step.value);
    }
    return freeze({
      observed_at_ms: baseline.observed_at_ms,
      observed_liveness_responses: responseCopies(combined),
      observed_placements: freeze(placements)
    });
  }
}

export function createPlacementNetworkEvidenceSession(options) {
  const session = new PlacementNetworkEvidenceSession(options);
  const readCurrentEvidence = snapshotDataMethod(
    session,
    "readCurrentEvidence",
    "network-evidence-session"
  );
  return freeze({
    readCurrentEvidence() {
      return readCurrentEvidence();
    }
  });
}
