import {
  setupPlacementRepairBatchFixture
} from "./placement-repair-batch-fixture.mjs";
import {
  runPlacementRepairScheduleCorpus
} from "./placement-repair-schedule-corpus.mjs";

const fixture = await setupPlacementRepairBatchFixture();
const result = await runPlacementRepairScheduleCorpus({
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
});
process.stdout.write(`${JSON.stringify(result)}\n`);
