import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import {
  setupPlacementRepairBatchFixture
} from "../test/placement-repair-batch-fixture.mjs";
import {
  PLACEMENT_REPAIR_SCHEDULE_CORPUS,
  PLACEMENT_REPAIR_SCHEDULE_EXPECTED
} from "../test/placement-repair-schedule-corpus.mjs";

const fixture = await setupPlacementRepairBatchFixture();
const certificateBytes = fixture.failures.map(({ certificate_bytes: bytes }) => bytes);
const responseBytes = fixture.lateResponses;
const baselineValue = Object.freeze({
  observed_at_ms: "1800",
  observed_liveness_responses: Object.freeze([]),
  observed_placements: Object.freeze([])
});
const bundled = await build({
  bundle: true,
  entryPoints: ["test/placement-repair-schedule-browser-entry.mjs"],
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  write: false
});
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><title>MortalOS repair schedule parity</title></html>");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const browserResult = await page.evaluate(async ({ baseline, certificates, responses }) => {
    const value = Object.freeze({
      observed_at_ms: baseline.observed_at_ms,
      observed_liveness_responses: baseline.observed_liveness_responses,
      observed_placements: baseline.observed_placements
    });
    return globalThis.__MORTALOS_PLACEMENT_REPAIR_SCHEDULE_CORPUS__({
      baseline: Object.freeze({ async readCurrentEvidence() { return value; } }),
      certificateBytes: certificates,
      responseBytes: responses
    });
  }, {
    baseline: baselineValue,
    certificates: certificateBytes,
    responses: responseBytes
  });
  assert.equal(browserResult.cases, PLACEMENT_REPAIR_SCHEDULE_CORPUS.cases);
  assert.equal(browserResult.events_per_case, PLACEMENT_REPAIR_SCHEDULE_CORPUS.events_per_case);
  assert.equal(browserResult.seed, PLACEMENT_REPAIR_SCHEDULE_CORPUS.seed);
  assert.equal(browserResult.digest, PLACEMENT_REPAIR_SCHEDULE_EXPECTED.digest);
  assert.deepEqual(browserResult.verdicts, PLACEMENT_REPAIR_SCHEDULE_EXPECTED.verdicts);
  assert.equal(browserResult.totals.duplicate_provider_effects, 0);
  assert.equal(browserResult.totals.duplicate_accounting_effects, 0);
  assert.equal(browserResult.totals.duplicate_continuity_effects, 0);
  console.log("MortalOS placement repair schedule differential: PASS");
  console.log(`- ${browserResult.cases} signed-evidence schedules x ${browserResult.events_per_case} events`);
  console.log(`- committed Node/fresh-process/Chromium exact result ${browserResult.digest}`);
  console.log(`- verdicts ${JSON.stringify(browserResult.verdicts)}`);
  console.log(`- duplicate provider/accounting/Continuity effects 0/0/0`);
} finally {
  await browser.close();
}
