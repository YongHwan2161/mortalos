import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalBytes, encodeBase64Url } from "../index.mjs";
import {
  createRelayFrame,
  createRelayMessage,
  decodeRelayFrame
} from "./protocol.mjs";

function nextRandom(state) {
  let value = state.value >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return state.value;
}

function message(kind, ordinal) {
  const envelope = kind === "genesis"
    ? { kind: "mortalos.genesis", transport_fixture: ordinal }
    : { kind: "mortalos.pulse", transport_fixture: ordinal };
  return canonicalBytes(createRelayMessage({ envelope, payload: { ordinal } }));
}

export async function runTransportScheduleCorpus({ cases = 10_000, seed = 1_297_044_052 } = {}) {
  if (!Number.isSafeInteger(cases) || cases < 1 || cases > 10_000) throw new TypeError("invalid case count");
  const state = { value: seed >>> 0 };
  const messageBytes = [message("genesis", 0), message("pulse", 1), message("pulse", 2)];
  const frames = messageBytes.map((bytes, index) => createRelayFrame(index + 1, bytes));
  const messageIds = frames.map((frame) => decodeRelayFrame(frame).message_id);
  const baselineDeliveries = [0, 1, 2].flatMap((endpoint) => frames.map((frame) => ({ endpoint, frame })));
  let dropped = 0;
  let duplicated = 0;
  let reordered = 0;
  let recovered = 0;
  let scheduleChecksum = 0;

  for (let caseIndex = 0; caseIndex < cases; caseIndex += 1) {
    const observed = [new Set(), new Set(), new Set()];
    const random = nextRandom(state);
    const dropEvery = random % 5 === 0 ? 2 + (random % 4) : 0;
    const duplicateEvery = random % 3 === 0 ? 2 + (random % 3) : 0;
    const reverse = (random & 8) !== 0;
    const rotate = random % 9;
    let deliveries = [...baselineDeliveries];
    if (rotate) {
      const offset = rotate % deliveries.length;
      deliveries = [...deliveries.slice(offset), ...deliveries.slice(0, offset)];
    }
    if (reverse) deliveries.reverse();
    for (let index = 0; index < deliveries.length; index += 1) {
      if (dropEvery > 0 && (index + 1) % dropEvery === 0) {
        dropped += 1;
        continue;
      }
      const delivery = deliveries[index];
      observed[delivery.endpoint].add(delivery.frame.message_id);
      if (duplicateEvery > 0 && (index + 1) % duplicateEvery === 0) {
        observed[delivery.endpoint].add(delivery.frame.message_id);
        duplicated += 1;
      }
    }
    reordered += reverse || rotate ? 1 : 0;
    for (let endpointIndex = 0; endpointIndex < observed.length; endpointIndex += 1) {
      for (const messageId of messageIds) observed[endpointIndex].add(messageId);
      if (observed[endpointIndex].size !== 3) throw new Error("range recovery did not converge");
      recovered += 1;
    }
    scheduleChecksum = (scheduleChecksum + Math.imul(random, caseIndex + 1)) >>> 0;
  }

  const result = {
    cases,
    dropped,
    duplicated,
    endpoints_recovered: recovered,
    format: "mortalos-transport-schedule-result/1",
    reordered,
    schedule_checksum: scheduleChecksum,
    seed
  };
  return {
    ...result,
    digest: `sha256:${encodeBase64Url(sha256(canonicalBytes(result)))}`
  };
}
