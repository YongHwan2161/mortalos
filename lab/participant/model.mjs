export const PARTICIPANT_MODEL_FORMAT = "mortalos-participant-model/1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialModel() {
  return {
    approvals: {},
    candidate: null,
    head: 0,
    journal: {},
    key_available: true,
    state_available: true,
    threshold: 2,
    transport_available: true
  };
}

export function participantModelStep(source, event) {
  const state = clone(source);
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { code: "E_MODEL_EVENT_INVALID", state, status: "reject" };
  }
  if (event.type === "capability") {
    if (!["key_available", "state_available", "transport_available"].includes(event.name) ||
        typeof event.available !== "boolean") {
      return { code: "E_MODEL_EVENT_INVALID", state, status: "reject" };
    }
    state[event.name] = event.available;
    return { code: "CAPABILITY_UPDATED", state, status: "accept" };
  }
  if (event.type === "propose") {
    if (!state.state_available) return { code: "E_STATE_MISSING", state, status: "reject" };
    if (event.parent !== state.head) return { code: "E_PARENT_STALE", state, status: "reject" };
    state.approvals = {};
    state.candidate = String(event.candidate);
    return { code: "PROPOSAL_READY", state, status: "accept" };
  }
  if (event.type === "approve") {
    if (!state.key_available) return { code: "E_KEY_UNAVAILABLE", state, status: "reject" };
    if (!state.transport_available) return { code: "E_TRANSPORT_UNAVAILABLE", state, status: "reject" };
    if (state.candidate === null) return { code: "E_PROPOSAL_MISSING", state, status: "reject" };
    const tuple = `${event.key_id}/${state.head + 1}/${state.head}`;
    const prior = state.journal[tuple];
    if (prior !== undefined && prior !== state.candidate) {
      return { code: "E_LOCAL_EQUIVOCATION_REFUSED", state, status: "reject" };
    }
    if (state.approvals[event.key_id] === state.candidate) {
      return { code: "E_SIGNATURE_DUPLICATE", state, status: "reject" };
    }
    state.journal[tuple] = state.candidate;
    state.approvals[event.key_id] = state.candidate;
    const count = Object.keys(state.approvals).length;
    return count < state.threshold
      ? { code: "E_APPROVAL_INSUFFICIENT_QUORUM", state, status: "reject" }
      : { code: "QUORUM_READY", state, status: "accept" };
  }
  if (event.type === "append") {
    if (!event.evidence_valid) return { code: "E_EVIDENCE_CORRUPT", state, status: "reject" };
    if (!state.state_available) return { code: "E_STATE_MISSING", state, status: "reject" };
    if (event.parent !== state.head) return { code: "E_PARENT_STALE", state, status: "reject" };
    if (Object.keys(state.approvals).length < state.threshold) {
      return { code: "E_APPROVAL_INSUFFICIENT_QUORUM", state, status: "reject" };
    }
    state.head += 1;
    state.approvals = {};
    state.candidate = null;
    return { code: "APPENDED", state, status: "accept" };
  }
  return { code: "E_MODEL_EVENT_INVALID", state, status: "reject" };
}

function nextRandom(source) {
  let value = source >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function createSeededParticipantSchedule(seed, length = 24) {
  if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(length) || length < 1 || length > 128) {
    throw new TypeError("bounded participant model seed and length required");
  }
  const events = [];
  let random = (seed + 1) >>> 0;
  let modelHead = 0;
  for (let index = 0; index < length; index += 1) {
    random = nextRandom(random);
    const choice = random % 11;
    if (choice === 0) {
      events.push({ available: false, name: "transport_available", type: "capability" });
    } else if (choice === 1) {
      events.push({ available: true, name: "transport_available", type: "capability" });
    } else if (choice === 2) {
      events.push({ available: false, name: "state_available", type: "capability" });
    } else if (choice === 3) {
      events.push({ available: true, name: "state_available", type: "capability" });
    } else if (choice === 4) {
      events.push({ candidate: `candidate-${seed}-${index}`, parent: modelHead, type: "propose" });
    } else if (choice === 5 || choice === 6) {
      events.push({ key_id: choice === 5 ? "A" : "B", type: "approve" });
    } else if (choice === 7) {
      events.push({ evidence_valid: true, parent: modelHead, type: "append" });
      modelHead += 1;
    } else if (choice === 8) {
      events.push({ evidence_valid: false, parent: modelHead, type: "append" });
    } else if (choice === 9) {
      events.push({ evidence_valid: true, parent: Math.max(0, modelHead - 1), type: "append" });
    } else {
      events.push({ available: Boolean(random & 1), name: "key_available", type: "capability" });
    }
  }
  return events;
}

export function runParticipantModelSchedule(events) {
  let state = initialModel();
  const outcomes = [];
  for (const event of events) {
    const outcome = participantModelStep(state, event);
    state = outcome.state;
    outcomes.push({ code: outcome.code, status: outcome.status });
  }
  return {
    final_state: state,
    format: PARTICIPANT_MODEL_FORMAT,
    outcomes
  };
}

export function runSeededParticipantCorpus(count = 10_000, length = 24) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 10_000) {
    throw new TypeError("participant model corpus count must be 1 through 10000");
  }
  return Array.from({ length: count }, (_, seed) => ({
    result: runParticipantModelSchedule(createSeededParticipantSchedule(seed, length)),
    seed
  }));
}
