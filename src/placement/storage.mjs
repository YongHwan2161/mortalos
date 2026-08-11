import { byteLengthOfBytes } from "../bytes.mjs";
import {
  evaluateResourceExecutionContract,
  verifyResourceExecutionReceipt
} from "../resource-execution.mjs";
import { verifyResourceOffer } from "../resource-contract.mjs";

export const STORAGE_PLACEMENT_STATUS = Object.freeze({
  proved: "proved",
  repairing: "repairing",
  unavailable: "unavailable"
});

const WORKLOAD_ID = /^resource-workload:[A-Za-z0-9_-]{43}$/u;

export class StoragePlacementError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new StoragePlacementError(code, message);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("E_PLACEMENT_FORMAT", `${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail("E_PLACEMENT_FORMAT", `${label} has unknown or missing fields`);
  }
}

function ownedBytes(value, label) {
  const length = byteLengthOfBytes(value);
  if (length === null || length < 1) fail("E_PLACEMENT_FORMAT", `${label} bytes required`);
  return new Uint8Array(value);
}

function ownedByteArray(value, label, maximum = 4_096) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail("E_PLACEMENT_LIMIT", `${label} must be a bounded array`);
  }
  return value.map((entry, index) => ownedBytes(entry, `${label}/${index}`));
}

function snapshotRecord(value, index) {
  exactKeys(
    value,
    [
      "consumption_announcements",
      "execution_receipts",
      "lease",
      "observed_at_ms",
      "offer",
      "revocations",
      "usage_receipts"
    ],
    `placement ${index}`
  );
  if (typeof value.observed_at_ms !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value.observed_at_ms)) {
    fail("E_PLACEMENT_FORMAT", `placement ${index} observed_at_ms is invalid`);
  }
  return Object.freeze({
    consumption_announcements: ownedByteArray(
      value.consumption_announcements,
      `placement ${index} announcements`,
      64
    ),
    execution_receipts: ownedByteArray(
      value.execution_receipts,
      `placement ${index} execution receipts`
    ),
    lease: ownedBytes(value.lease, `placement ${index} lease`),
    observed_at_ms: value.observed_at_ms,
    offer: ownedBytes(value.offer, `placement ${index} offer`),
    revocations: ownedByteArray(value.revocations, `placement ${index} revocations`, 32),
    usage_receipts: ownedByteArray(value.usage_receipts, `placement ${index} usage receipts`)
  });
}

function verifyRecord(record, expectedWorkloadId, unavailable) {
  const offer = verifyResourceOffer(record.offer);
  const providerId = offer.body.provider.key_id;
  const evaluated = evaluateResourceExecutionContract({
    consumption_announcements: record.consumption_announcements,
    offer: record.offer,
    leases: [record.lease],
    observed_at_ms: record.observed_at_ms,
    usage_receipts: record.usage_receipts,
    revocations: record.revocations,
    execution_receipts: record.execution_receipts
  });
  if (evaluated.status !== "active") {
    return Object.freeze({
      lease_id: evaluated.lease_id,
      provider_id: providerId,
      reason: `resource-${evaluated.status}`,
      status: "rejected",
      workload_id: null
    });
  }
  if (evaluated.execution_status !== "proved" || record.execution_receipts.length < 1) {
    return Object.freeze({
      lease_id: evaluated.lease_id,
      provider_id: providerId,
      reason: "execution-unproved",
      status: "rejected",
      workload_id: null
    });
  }
  const last = verifyResourceExecutionReceipt({
    offer: record.offer,
    lease: record.lease,
    previous_execution_receipts: record.execution_receipts.slice(0, -1),
    usage_receipts: record.usage_receipts,
    receipt: record.execution_receipts.at(-1)
  });
  if (last.body.kind !== "storage" || last.body.workload_id !== expectedWorkloadId) {
    return Object.freeze({
      lease_id: evaluated.lease_id,
      provider_id: providerId,
      reason: last.body.kind !== "storage" ? "not-storage" : "workload-mismatch",
      status: "rejected",
      workload_id: last.body.workload_id
    });
  }
  return Object.freeze({
    lease_id: evaluated.lease_id,
    provider_id: providerId,
    reason: unavailable.has(providerId) ? "transport-unavailable" : null,
    status: unavailable.has(providerId) ? "unavailable" : "proved",
    workload_id: last.body.workload_id
  });
}

export function evaluateStoragePlacements(options) {
  exactKeys(
    options,
    ["expected_workload_id", "placements", "quorum", "target_copies", "unavailable_provider_ids"],
    "storage placement evaluation options"
  );
  if (!WORKLOAD_ID.test(options.expected_workload_id)) {
    fail("E_PLACEMENT_WORKLOAD", "expected storage workload ID required");
  }
  if (
    !Number.isSafeInteger(options.quorum) || options.quorum < 1 ||
    !Number.isSafeInteger(options.target_copies) || options.target_copies < options.quorum ||
    options.target_copies > 16
  ) fail("E_PLACEMENT_POLICY", "bounded quorum and target required");
  if (!Array.isArray(options.placements) || options.placements.length > 16) {
    fail("E_PLACEMENT_LIMIT", "at most sixteen placement records are allowed");
  }
  if (
    !Array.isArray(options.unavailable_provider_ids) ||
    options.unavailable_provider_ids.some((entry) => typeof entry !== "string")
  ) fail("E_PLACEMENT_FORMAT", "unavailable provider IDs must be an array of strings");
  const unavailable = new Set(options.unavailable_provider_ids);
  const snapshots = options.placements.map(snapshotRecord);
  const evaluated = snapshots.map((record) => {
    try {
      return verifyRecord(record, options.expected_workload_id, unavailable);
    } catch (error) {
      return Object.freeze({
        lease_id: null,
        provider_id: null,
        reason: error?.code ?? "invalid-evidence",
        status: "rejected",
        workload_id: null
      });
    }
  });
  const counts = new Map();
  for (const placement of evaluated) {
    if (placement.provider_id && ["proved", "unavailable"].includes(placement.status)) {
      counts.set(placement.provider_id, (counts.get(placement.provider_id) ?? 0) + 1);
    }
  }
  const placements = evaluated.map((placement) => {
    if (placement.provider_id && (counts.get(placement.provider_id) ?? 0) > 1) {
      return Object.freeze({ ...placement, reason: "duplicate-provider", status: "rejected" });
    }
    return placement;
  });
  const proved = placements.filter((placement) => placement.status === "proved").length;
  const unavailableCount = placements.filter((placement) => placement.status === "unavailable").length;
  const rejected = placements.length - proved - unavailableCount;
  const status = proved >= options.target_copies
    ? STORAGE_PLACEMENT_STATUS.proved
    : proved >= options.quorum
      ? STORAGE_PLACEMENT_STATUS.repairing
      : STORAGE_PLACEMENT_STATUS.unavailable;
  return Object.freeze({
    available_copies: proved,
    expected_workload_id: options.expected_workload_id,
    placements: Object.freeze(placements),
    quorum: options.quorum,
    rejected_copies: rejected,
    repair_needed: Math.max(0, options.target_copies - proved),
    status,
    target_copies: options.target_copies,
    unavailable_copies: unavailableCount
  });
}
