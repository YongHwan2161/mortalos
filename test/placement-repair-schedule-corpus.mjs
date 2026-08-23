import { canonicalBytes } from "../src/codec.mjs";
import { equalBytes } from "../src/bytes.mjs";
import { domainHash } from "../src/confidential/format.mjs";
import { evaluatePlacementLivenessEvidence } from "../src/placement/liveness.mjs";
import {
  createRelayFrame,
  createResourcePlacementArtifactMessage,
  RELAY_LIMITS
} from "../src/transport/protocol.mjs";
import {
  createPlacementNetworkEvidenceSession
} from "../lab/placement/network-evidence-session.mjs";

const FORMAT = "mortalos-placement-repair-schedule-corpus-result/1";
const RESULT_DOMAIN = "MortalOS placement repair schedule corpus result v1";
const DEFAULT_CASES = 10_000;
const DEFAULT_EVENTS = 8;
const DEFAULT_SEED = 1_784_239_611;

function nextRandom(state) {
  let value = state.value >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return state.value;
}

function requireBytesArray(value, label) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${label} must contain exactly two byte records`);
  }
  return value.map((entry) => {
    if (!(entry instanceof Uint8Array) || entry.byteLength < 1) {
      throw new TypeError(`${label} must contain owned bytes`);
    }
    return new Uint8Array(entry);
  });
}

function semanticTable(certificates, responses) {
  const table = [];
  for (let mask = 0; mask < 4; mask += 1) {
    const selected = [];
    if ((mask & 1) !== 0) selected.push(responses[0]);
    if ((mask & 2) !== 0) selected.push(responses[1]);
    const evaluated = evaluatePlacementLivenessEvidence({
      certificates,
      responses: selected
    });
    table.push(evaluated.status);
  }
  if (table[0] !== "failed" || table.slice(1).some((status) => status !== "halted")) {
    throw new Error("signed schedule evidence does not establish failed/contested semantics");
  }
  return table;
}

function responseMask(observed, responses) {
  let mask = 0;
  for (const bytes of observed) {
    if (equalBytes(bytes, responses[0])) mask |= 1;
    else if (equalBytes(bytes, responses[1])) mask |= 2;
    else throw new Error("network evidence session returned an unknown response payload");
  }
  return mask;
}

function createTranscript(metrics) {
  const frames = [];
  const messageIds = new Set();
  const pending = [];
  let connected = true;
  let corruptNextRead = false;
  let lastMessageBytes = null;

  function commit(messageBytes, artifactKind) {
    const candidate = createRelayFrame(frames.length + 1, messageBytes);
    if (messageIds.has(candidate.message_id)) {
      metrics.exact_duplicates += 1;
      return false;
    }
    messageIds.add(candidate.message_id);
    frames.push(candidate);
    if (artifactKind === "liveness-response") metrics.response_frames += 1;
    else metrics.certificate_frames += 1;
    return true;
  }

  function queueOrCommit(messageBytes, artifactKind) {
    lastMessageBytes = new Uint8Array(messageBytes);
    if (!connected) {
      pending.push({ artifactKind, messageBytes: new Uint8Array(messageBytes) });
      metrics.queued_while_partitioned += 1;
      return false;
    }
    return commit(messageBytes, artifactKind);
  }

  return {
    corrupt() {
      corruptNextRead = true;
      metrics.order_faults += 1;
    },
    disconnect() {
      connected = false;
      metrics.partitions += 1;
    },
    get connected() {
      return connected;
    },
    heal(reverse) {
      connected = true;
      metrics.heals += 1;
      const queued = pending.splice(0);
      if (reverse) queued.reverse();
      for (const entry of queued) commit(entry.messageBytes, entry.artifactKind);
    },
    publish(artifactKind, payloadBytes, requestId) {
      const messageBytes = canonicalBytes(createResourcePlacementArtifactMessage({
        artifactKind,
        payloadBytes,
        requestId
      }));
      return queueOrCommit(messageBytes, artifactKind);
    },
    repeatLast() {
      if (lastMessageBytes === null) return false;
      return queueOrCommit(lastMessageBytes, "liveness-response");
    },
    async readRange(after, limit) {
      if (!connected) throw new Error("P2P_TRANSPORT: disconnected schedule transcript");
      let page = frames.filter(({ sequence }) => sequence > after).slice(0, limit);
      if (corruptNextRead && page.length > 0) {
        corruptNextRead = false;
        page = page.length === 1
          ? [page[0], page[0]]
          : [page[1], page[0], ...page.slice(2)];
      }
      return page;
    }
  };
}

function caseMetrics() {
  return {
    availability_failures: 0,
    certificate_frames: 0,
    continuity_effects: 0,
    continuity_invocations: 0,
    duplicate_accounting_effects: 0,
    duplicate_continuity_effects: 0,
    duplicate_provider_effects: 0,
    exact_duplicates: 0,
    heals: 0,
    order_faults: 0,
    partitions: 0,
    provider_effects: 0,
    provider_invocations: 0,
    queued_while_partitioned: 0,
    response_frames: 0,
    restarts: 0,
    rewrapped_responses: 0
  };
}

async function runCase({ baseline, caseIndex, certificates, events, random, responses, semantics }) {
  const metrics = caseMetrics();
  const transcript = createTranscript(metrics);
  const durableProviders = [false, false];
  const providerEffects = new Set();
  const accountingEffects = new Set();
  const continuityEffects = new Set();
  let session = null;
  let terminal = null;
  let completed = false;
  let failNextProvider = false;
  let crashAfterProvider = false;
  let crashAfterContinuity = false;
  let continuityDurable = false;
  const mode = caseIndex % 8;

  function restart() {
    if (terminal || completed) return;
    session = null;
    metrics.restarts += 1;
  }

  function ensureSession() {
    if (session !== null) return;
    session = createPlacementNetworkEvidenceSession({
      evidence: baseline,
      transport: Object.freeze({ readRange: transcript.readRange })
    });
  }

  async function readEvidence() {
    ensureSession();
    try {
      const evidence = await session.readCurrentEvidence();
      const mask = responseMask(evidence.observed_liveness_responses, responses);
      if (semantics[mask] === "halted") terminal = "halted-liveness";
      return terminal === null;
    } catch (error) {
      if (error?.code === "E_PLACEMENT_NETWORK_EVIDENCE_ORDER") {
        terminal = "halted-order";
        return false;
      }
      if (typeof error?.code === "string" && error.code.startsWith("E_PLACEMENT_NETWORK_EVIDENCE_")) {
        terminal = "halted-transport";
        return false;
      }
      metrics.availability_failures += 1;
      terminal = "unavailable-partition";
      return false;
    }
  }

  const phases = [[], [], []];
  for (let eventIndex = 0; eventIndex < events; eventIndex += 1) {
    const value = nextRandom(random);
    let code = value % 16;
    if (mode === 0 || mode === 4) {
      if (code === 1 || code === 2 || code === 4) code = 5 + ((value >>> 8) & 1);
      else if (code === 7 || code === 13) code = 9;
    } else if (mode === 3 && code === 8) code = 9;
    phases[(value >>> 16) % phases.length].push({ code, eventIndex, value });
  }

  if (mode === 1) phases[1].unshift({ code: 1, eventIndex: events, value: 1 });
  else if (mode === 2) {
    phases[0].unshift(
      { code: 5, eventIndex: events, value: 5 },
      { code: 6, eventIndex: events + 1, value: 6 },
      { code: 13, eventIndex: events + 2, value: 13 }
    );
  } else if (mode === 3) phases[0].unshift({ code: 7, eventIndex: events, value: 7 });

  function applyEvent({ code, eventIndex, value }) {
    const shardIndex = (value >>> 8) & 1;
    const requestId = `s${caseIndex.toString(36)}.e${eventIndex.toString(36)}.${value.toString(36)}`;
    if (code === 1 || code === 2) {
      transcript.publish("liveness-response", responses[code - 1], requestId);
    } else if (code === 3) transcript.repeatLast();
    else if (code === 4) {
      transcript.publish("liveness-response", responses[shardIndex], `${requestId}.rewrap`);
      metrics.rewrapped_responses += 1;
    } else if (code === 5 || code === 6) {
      transcript.publish("failure-certificate", certificates[code - 5], requestId);
    } else if (code === 7) transcript.disconnect();
    else if (code === 8) transcript.heal(((value >>> 10) & 1) !== 0);
    else if (code === 9 || code === 14) restart();
    else if (code === 10) failNextProvider = true;
    else if (code === 11) crashAfterProvider = true;
    else if (code === 12) crashAfterContinuity = true;
    else if (code === 13) transcript.corrupt();
  }

  for (let phase = 0; phase < phases.length && terminal === null; phase += 1) {
    for (const event of phases[phase]) applyEvent(event);
    if (!(await readEvidence())) break;
    if (phase < 2) {
      const shardIndex = phase;
      if (!durableProviders[shardIndex]) {
        metrics.provider_invocations += 1;
        if (failNextProvider) {
          failNextProvider = false;
          restart();
          if (!(await readEvidence())) break;
          metrics.provider_invocations += 1;
        }
        durableProviders[shardIndex] = true;
        const effectId = `provider-effect-${shardIndex}`;
        if (providerEffects.has(effectId)) metrics.duplicate_provider_effects += 1;
        else {
          providerEffects.add(effectId);
          metrics.provider_effects += 1;
        }
        if (accountingEffects.has(effectId)) metrics.duplicate_accounting_effects += 1;
        else accountingEffects.add(effectId);
        if (crashAfterProvider) {
          crashAfterProvider = false;
          restart();
        }
      }
    } else {
      if (!durableProviders[0] || !durableProviders[1]) {
        terminal = "halted-model";
        break;
      }
      if (!continuityDurable) {
        metrics.continuity_invocations += 1;
        continuityDurable = true;
        if (continuityEffects.has("continuity-effect")) metrics.duplicate_continuity_effects += 1;
        else {
          continuityEffects.add("continuity-effect");
          metrics.continuity_effects += 1;
        }
        if (crashAfterContinuity) {
          crashAfterContinuity = false;
          restart();
        }
      }
      completed = true;
    }
  }
  if (!terminal && !completed) terminal = "halted-bound";

  const verdict = completed ? "completed" : terminal;
  const summaryCode = (
    (completed ? 1 : 0) |
    (verdict === "halted-liveness" ? 2 : 0) |
    (verdict === "halted-order" ? 4 : 0) |
    (verdict === "unavailable-partition" ? 8 : 0) |
    (metrics.provider_effects << 4) |
    (metrics.continuity_effects << 7) |
    ((metrics.restarts & 0xff) << 8) |
    ((metrics.response_frames & 0xff) << 16) |
    ((metrics.certificate_frames & 0xff) << 24)
  ) >>> 0;
  return { metrics, summaryCode, verdict };
}

export async function runPlacementRepairScheduleCorpus({
  baseline,
  cases = DEFAULT_CASES,
  certificateBytes,
  events = DEFAULT_EVENTS,
  responseBytes,
  seed = DEFAULT_SEED
}) {
  if (!Number.isSafeInteger(cases) || cases < 1 || cases > DEFAULT_CASES) {
    throw new TypeError("placement repair schedule cases must be 1 through 10000");
  }
  if (!Number.isSafeInteger(events) || events < 1 || events > 64) {
    throw new TypeError("placement repair schedule events must be 1 through 64");
  }
  const certificates = requireBytesArray(certificateBytes, "certificateBytes");
  const responses = requireBytesArray(responseBytes, "responseBytes");
  const semantics = semanticTable(certificates, responses);
  const random = { value: seed >>> 0 };
  const totals = caseMetrics();
  const verdicts = Object.create(null);
  let scheduleChecksum = 0;
  for (let caseIndex = 0; caseIndex < cases; caseIndex += 1) {
    const result = await runCase({
      baseline,
      caseIndex,
      certificates,
      events,
      random,
      responses,
      semantics
    });
    verdicts[result.verdict] = (verdicts[result.verdict] ?? 0) + 1;
    for (const key of Object.keys(totals)) totals[key] += result.metrics[key];
    scheduleChecksum = (scheduleChecksum + Math.imul(result.summaryCode, caseIndex + 1)) >>> 0;
  }
  const result = {
    cases,
    events_per_case: events,
    format: FORMAT,
    schedule_checksum: scheduleChecksum,
    seed: seed >>> 0,
    totals,
    verdicts: Object.fromEntries(Object.entries(verdicts).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0))
  };
  return Object.freeze({
    ...result,
    digest: domainHash(RESULT_DOMAIN, canonicalBytes(result))
  });
}

export const PLACEMENT_REPAIR_SCHEDULE_CORPUS = Object.freeze({
  cases: DEFAULT_CASES,
  events_per_case: DEFAULT_EVENTS,
  seed: DEFAULT_SEED
});

export const PLACEMENT_REPAIR_SCHEDULE_EXPECTED = Object.freeze({
  digest: "sha256:t0Guc2x3-rrM8G9q7iqYZ1nYNriIj77sgcPort-E5iM",
  verdicts: Object.freeze({
    completed: 2749,
    "halted-liveness": 2489,
    "halted-order": 2044,
    "unavailable-partition": 2718
  })
});
