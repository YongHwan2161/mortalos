import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

const trials = Number(process.env.MORTALOS_S2_CHROMIUM_TRIALS ?? "100");
if (!Number.isSafeInteger(trials) || trials < 1 || trials > 100) {
  throw new Error("MORTALOS_S2_CHROMIUM_TRIALS must be 1 through 100");
}
const lossTrials = Number(process.env.MORTALOS_S2_LOSS_TRIALS ?? String(trials));
if (!Number.isSafeInteger(lossTrials) || lossTrials < 1 || lossTrials > 100) {
  throw new Error("MORTALOS_S2_LOSS_TRIALS must be 1 through 100");
}

const engineName = process.env.MORTALOS_BROWSER_ENGINE ?? "chromium";
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`unsupported browser engine: ${engineName}`);
const temporaryRoot = await mkdtemp(join(tmpdir(), `mortalos-s2-${engineName}-`));
const labDirectory = resolve(temporaryRoot, "lab");
const profileDirectory = resolve(temporaryRoot, "profile");
const bundle = await build({
  entryPoints: ["test/durable-browser-entry.mjs"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  legalComments: "none",
  minify: true,
  write: false
});
await buildLab({ outdir: labDirectory });
await writeFile(resolve(labDirectory, "durable-browser-test.js"), bundle.outputFiles[0].contents);
const server = await startLabServer({ directory: labDirectory });

const launchOptions = { headless: true };
if (engineName === "chromium" && process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

async function pageWithHarness(context) {
  const page = await context.newPage();
  page.on("console", (message) => {
    console.log(`S2 ${engineName} browser: ${message.text()}`);
  });
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ url: `${server.url}/durable-browser-test.js` });
  await page.waitForFunction(() => Boolean(globalThis.__MORTALOS_DURABLE_BROWSER__));
  return page;
}

try {
  const prepared = [];
  const preparedLoss = [[], [], []];
  let context = await browserType.launchPersistentContext(profileDirectory, launchOptions);
  let page = await pageWithHarness(context);
  for (let run = 0; run < trials; run += 1) {
    prepared.push(await page.evaluate((value) =>
      globalThis.__MORTALOS_DURABLE_BROWSER__.createAcceptedHandoff(value), run));
    if ((run + 1) % 10 === 0 || run + 1 === trials) {
      console.log(`S2 ${engineName} handoff prepared: ${run + 1}/${trials}`);
    }
  }
  for (let lost = 0; lost < 3; lost += 1) {
    for (let run = 0; run < lossTrials; run += 1) {
      preparedLoss[lost].push(await page.evaluate(
        ({ run: value, lost: index }) =>
          globalThis.__MORTALOS_DURABLE_BROWSER__.prepareLossTrial(value, index),
        { lost, run }
      ));
      if ((run + 1) % 10 === 0 || run + 1 === lossTrials) {
        console.log(`S2 ${engineName} loss ${["A", "B", "C"][lost]} prepared: ${run + 1}/${lossTrials}`);
      }
    }
  }
  await context.close();

  context = await browserType.launchPersistentContext(profileDirectory, launchOptions);
  page = await pageWithHarness(context);
  console.log(`S2 ${engineName} compare-and-swap: START`);
  const compareAndSwap = await page.evaluate(() =>
    globalThis.__MORTALOS_DURABLE_BROWSER__.verifyIndexedDbCompareAndSwap());
  console.log(`S2 ${engineName} compare-and-swap: COMPLETE`);
  assert.equal(compareAndSwap.accepted_signature, true);
  assert.equal(compareAndSwap.stale_code, "E_DURABLE_CONFLICT");
  assert.equal(compareAndSwap.stale_signer_calls, 0);
  assert.equal(compareAndSwap.primary_signer_calls, 1);
  assert.equal(compareAndSwap.persisted_pulse_entries, 1);
  assert.equal(compareAndSwap.conflicting_code, "E_DURABLE_EQUIVOCATION");
  console.log(`S2 ${engineName} expiry rollback latch: START`);
  const expiry = await page.evaluate(() =>
    globalThis.__MORTALOS_DURABLE_BROWSER__.verifyExpiryRollbackLatch());
  console.log(`S2 ${engineName} expiry rollback latch: COMPLETE`);
  assert.equal(expiry.at_expiry_code, "E_DURABLE_EXPIRED");
  assert.equal(expiry.persisted_status, "expired");
  assert.equal(expiry.rollback_authority, false);
  assert.equal(expiry.rollback_code, "E_DURABLE_EXPIRED");
  assert.equal(expiry.null_renewal_code, "E_DURABLE_POLICY");
  assert.equal(expiry.stale_renewal_code, "E_DURABLE_POLICY");
  assert.equal(expiry.status_after_rejected_renewals, "expired");
  assert.equal(expiry.renewed_authority, true);
  console.log(`S2 ${engineName} v1 migration: START`);
  const migration = await page.evaluate(() =>
    globalThis.__MORTALOS_DURABLE_BROWSER__.verifyVersionOneMigration());
  console.log(`S2 ${engineName} v1 migration: COMPLETE`);
  assert.equal(migration.valid.schema_version, 2);
  assert.equal(migration.valid.from_schema, 1);
  assert.equal(migration.valid.signing_authority, false);
  assert.match(migration.valid.organism_id, /^mortalos:/);
  assert.deepEqual(migration.valid.after_migration.store_names, ["participant"]);
  assert.equal(migration.valid.after_migration.participant_key_present, true);
  assert.equal(migration.valid.after_migration.legacy_key_present, false);
  assert.equal(migration.valid.after_migration.legacy_raw_signing, false);
  assert.deepEqual(migration.valid.removed_state, {
    key_present: false,
    status: "removed"
  });
  assert.deepEqual(migration.valid.after_removal.store_names, ["participant"]);
  assert.equal(migration.valid.after_removal.participant_status, "removed");
  assert.equal(migration.valid.after_removal.participant_key_present, false);
  assert.equal(migration.valid.after_removal.legacy_key_present, false);
  assert.equal(migration.valid.after_removal.legacy_raw_signing, false);
  assert.equal(migration.empty.document_absent, true);
  assert.deepEqual(migration.empty.inspection.store_names, ["participant"]);
  assert.equal(migration.empty.inspection.legacy_key_present, false);
  assert.equal(migration.empty.inspection.legacy_raw_signing, false);
  for (const [rejected, keyPresent] of [
    [migration.corrupt, true],
    [migration.removed_with_key, true],
    [migration.active_without_key, false]
  ]) {
    assert.equal(rejected.failed_closed, true);
    assert.equal(rejected.retained_version, 1);
    assert.deepEqual(rejected.retained.store_names, ["evidence", "keys", "meta"]);
    assert.equal(rejected.retained.participant_status, null);
    assert.equal(rejected.retained.participant_key_present, false);
    assert.equal(rejected.retained.legacy_key_present, keyPresent);
  }
  for (let run = 0; run < trials; run += 1) {
    const recovered = await page.evaluate((value) =>
      globalThis.__MORTALOS_DURABLE_BROWSER__.restoreAndAdvance(value), run);
    assert.equal(recovered.before.organism_id, prepared[run].organism_id);
    assert.equal(recovered.before.head_hash, prepared[run].head_hash);
    assert.equal(recovered.before.sequence, "1");
    assert.equal(recovered.after.organism_id, prepared[run].organism_id);
    assert.equal(recovered.after.sequence, "2");
    assert.equal(recovered.private_key_export_rejected, true);
    if ((run + 1) % 10 === 0 || run + 1 === trials) {
      console.log(`S2 ${engineName} handoff recovered: ${run + 1}/${trials}`);
    }
  }
  for (let lost = 0; lost < 3; lost += 1) {
    for (let run = 0; run < lossTrials; run += 1) {
      const recovered = await page.evaluate(
        ({ expected, run: value, lost: index }) =>
          globalThis.__MORTALOS_DURABLE_BROWSER__.restoreLossAndRepair(value, index, expected),
        { expected: preparedLoss[lost][run], lost, run }
      );
      assert.equal(recovered.organism_id, preparedLoss[lost][run].organism_id);
      assert.equal(recovered.sequence, "3");
      assert.equal(recovered.replacement_authority, true);
      if ((run + 1) % 10 === 0 || run + 1 === lossTrials) {
        console.log(`S2 ${engineName} loss ${["A", "B", "C"][lost]} recovered: ${run + 1}/${lossTrials}`);
      }
    }
  }
  await context.close();
  console.log(`MortalOS S2 ${engineName} durable handoff: PASS (${trials}/${trials})`);
  console.log("- target browser process fully closed between accepted handoff and recovery");
  console.log("- non-extractable IndexedDB CryptoKey, canonical evidence replay, and same-identity continuation");
  console.log("- same-revision IndexedDB writers use CAS before signing; stale signer calls: 0");
  console.log("- reached expiry survives clock rollback; null/stale renewal is rejected before future renewal");
  console.log(`- A/B/C loss, cold pair restart, transition, D repair, and next transition: ${lossTrials}/${lossTrials} each`);
  console.log("- valid v1→v2 migration atomically removed legacy stores; removal left no sign-capable legacy key");
  console.log("- corrupt/removed+key/active-keyless v1 copies stayed at version 1");
} finally {
  await server.close();
  await rm(temporaryRoot, {
    force: true,
    maxRetries: 8,
    recursive: true,
    retryDelay: 250
  });
}
