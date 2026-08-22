import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalBytes } from "../src/codec.mjs";
import {
  setupPlacementRepairBatchFixture
} from "./placement-repair-batch-fixture.mjs";
import {
  PLACEMENT_REPAIR_SCHEDULE_CORPUS,
  PLACEMENT_REPAIR_SCHEDULE_EXPECTED,
  runPlacementRepairScheduleCorpus
} from "./placement-repair-schedule-corpus.mjs";

const execFileAsync = promisify(execFile);

function inputs(fixture) {
  return {
    baseline: Object.freeze({
      async readCurrentEvidence() {
        return Object.freeze({
          observed_at_ms: "1800",
          observed_liveness_responses: Object.freeze([]),
          observed_placements: Object.freeze([])
        });
      }
    }),
    certificateBytes: fixture.failures.map(({ certificate_bytes: bytes }) => bytes),
    responseBytes: fixture.lateResponses
  };
}

test("10,000 signed-evidence repair schedules are deterministic and effect-safe across restart", {
  timeout: 900_000
}, async () => {
  const fixture = await setupPlacementRepairBatchFixture();
  const first = await runPlacementRepairScheduleCorpus(inputs(fixture));
  assert.equal(first.cases, PLACEMENT_REPAIR_SCHEDULE_CORPUS.cases);
  assert.equal(first.events_per_case, PLACEMENT_REPAIR_SCHEDULE_CORPUS.events_per_case);
  assert.equal(first.seed, PLACEMENT_REPAIR_SCHEDULE_CORPUS.seed);
  assert.equal(first.digest, PLACEMENT_REPAIR_SCHEDULE_EXPECTED.digest);
  assert.deepEqual(first.verdicts, PLACEMENT_REPAIR_SCHEDULE_EXPECTED.verdicts);
  assert.equal(first.totals.duplicate_provider_effects, 0);
  assert.equal(first.totals.duplicate_accounting_effects, 0);
  assert.equal(first.totals.duplicate_continuity_effects, 0);
  assert.ok(first.verdicts.completed > 0);
  assert.ok(first.verdicts["halted-liveness"] > 0);
  assert.ok(first.verdicts["halted-order"] > 0);
  assert.ok(first.verdicts["unavailable-partition"] > 0);
  assert.ok(first.totals.provider_effects > 0);
  assert.ok(first.totals.provider_invocations > first.totals.provider_effects);
  assert.ok(first.totals.continuity_effects > 0);
  assert.equal(first.totals.continuity_invocations, first.totals.continuity_effects);
  assert.ok(first.totals.response_frames > 0);
  assert.ok(first.totals.certificate_frames > 0);
  assert.ok(first.totals.exact_duplicates > 0);
  assert.ok(first.totals.rewrapped_responses > 0);
  assert.ok(first.totals.partitions > 0);
  assert.ok(first.totals.heals > 0);
  assert.ok(first.totals.restarts > 0);
  assert.ok(first.totals.order_faults > 0);

  const child = await execFileAsync(process.execPath, [
    fileURLToPath(new URL("./placement-repair-schedule-child.mjs", import.meta.url))
  ], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 600_000,
    windowsHide: true
  });
  assert.deepEqual(canonicalBytes(JSON.parse(child.stdout)), canonicalBytes(first));
});
