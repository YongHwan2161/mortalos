import { canonicalBytes, derivePulseHash, encodeBase64Url } from "../../src/index.mjs";
import { decodeRelayFrame } from "../../src/transport/protocol.mjs";
import { r1AppendCandidates, r1ValidateGenesis } from "../r1-client.mjs";

function recordId(record) {
  return record.envelope.kind === "mortalos.genesis"
    ? encodeBase64Url(canonicalBytes(record.envelope))
    : derivePulseHash(record.envelope.body);
}

function compareRecords(left, right) {
  const leftSequence = BigInt(left.envelope.body.sequence);
  const rightSequence = BigInt(right.envelope.body.sequence);
  if (leftSequence !== rightSequence) return leftSequence < rightSequence ? -1 : 1;
  return recordId(left).localeCompare(recordId(right));
}

export class TransportReplica {
  #frames = new Map();
  #genesis = null;
  #records = new Map();
  #state = Object.freeze({ status: "empty", accepted_records: 0, head_hash: null, sequence: null });

  get publicState() {
    return JSON.parse(JSON.stringify(this.#state));
  }

  receive(frame) {
    let opened;
    try {
      opened = decodeRelayFrame(frame);
    } catch (error) {
      return { status: "reject", code: error.code ?? "RELAY_INVALID" };
    }
    if (this.#frames.has(opened.message_id)) return { status: "duplicate", message_id: opened.message_id };
    this.#frames.set(opened.message_id, opened.sequence);
    if (opened.control) {
      return { status: "control_observed", kind: opened.control.kind, message_id: opened.message_id };
    }
    if (opened.record.envelope.kind === "mortalos.genesis") {
      const result = r1ValidateGenesis(opened.record.envelope).outcome;
      if (result.status !== "accept") return { status: "reject", code: result.code };
      if (this.#genesis && recordId({ envelope: this.#genesis }) !== recordId(opened.record)) {
        this.#state = Object.freeze({ status: "genesis_conflict", accepted_records: 0, head_hash: null, sequence: null });
        return { status: "reject", code: "RELAY_GENESIS_CONFLICT" };
      }
      this.#genesis = opened.record.envelope;
    } else {
      this.#records.set(recordId(opened.record), opened.record);
    }
    this.#rebuild();
    return { status: "observed", message_id: opened.message_id };
  }

  #rebuild() {
    if (!this.#genesis) {
      this.#state = Object.freeze({ status: "awaiting_genesis", accepted_records: 0, head_hash: null, sequence: null });
      return;
    }
    const candidates = [...this.#records.values()].sort(compareRecords);
    const operation = r1AppendCandidates(this.#genesis, [], candidates).outcome;
    const results = operation.results ?? [];
    const accepted = results.filter((result) => result.status === "accept");
    const fork = results.find((result) => result.code === "E_FORK_DETECTED");
    const terminal = results.find((result) => result.code === "E_LINEAGE_ALREADY_FORKED");
    const last = accepted.at(-1) ?? r1ValidateGenesis(this.#genesis).outcome;
    this.#state = Object.freeze({
      accepted_records: accepted.length + 1,
      fork_points: operation.snapshot?.fork_points ?? [],
      head_hash: fork || terminal ? null : last.object_hash,
      organism_id: last.organism_id,
      rejected_codes: results.filter((result) => result.status !== "accept").map((result) => result.code),
      sequence: fork || terminal ? null : last.sequence,
      status: fork || terminal ? "FORKED" : "accepted"
    });
  }
}
