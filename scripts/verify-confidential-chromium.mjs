import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";
import { counterReceiptDigest } from "../src/confidential/counter.mjs";
import { runConfidentialVectors } from "../test/confidential-vector-runner.mjs";

const temporaryRoot = await mkdtemp(join(tmpdir(), "mortalos-s4-chromium-"));
const labDirectory = resolve(temporaryRoot, "lab");
const profileDirectory = resolve(temporaryRoot, "profile");
const bundle = await build({
  bundle: true,
  entryPoints: ["test/confidential-browser-entry.mjs"],
  format: "iife",
  legalComments: "none",
  minify: true,
  platform: "browser",
  target: ["chrome120"],
  write: false
});
await buildLab({ outdir: labDirectory });
await writeFile(
  resolve(labDirectory, "confidential-browser-test.js"),
  bundle.outputFiles[0].contents
);
const server = await startLabServer({ directory: labDirectory });
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);
async function pageWithHarness(context) {
  const page = await context.newPage();
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({
    url: `${server.url}/confidential-browser-test.js`
  });
  await page.waitForFunction(() =>
    Boolean(
      globalThis.__MORTALOS_S4_VECTORS__ &&
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__
    )
  );
  return page;
}

let persistentContext = null;
try {
  const page = await pageWithHarness(browser);
  const browserResult = await page.evaluate(() =>
    globalThis.__MORTALOS_S4_VECTORS__()
  );
  const nodeResult = await runConfidentialVectors();
  assert.deepEqual(browserResult, nodeResult);

  const databaseName = "mortalos-s4-counter-authority-test";
  const epochId =
    "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  persistentContext = await chromium.launchPersistentContext(
    profileDirectory,
    launchOptions
  );
  const endpointA = await pageWithHarness(persistentContext);
  await endpointA.evaluate(
    (name) => globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.wipe(name),
    databaseName
  );
  const endpointB = await pageWithHarness(persistentContext);
  const [descriptorA, descriptorB, initialPolicy] = await Promise.all([
    endpointA.evaluate(
      (name) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.descriptor(name),
      databaseName
    ),
    endpointB.evaluate(
      (name) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.descriptor(name),
      databaseName
    ),
    endpointA.evaluate(
      (name) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.keyPolicy(name),
      databaseName
    )
  ]);
  assert.deepEqual(descriptorA, descriptorB);
  assert.deepEqual(initialPolicy, {
    extractable: false,
    type: "private",
    usages: ["sign"]
  });
  const firstInput = {
    count: "1",
    epoch: "0",
    epochId,
    expectedNextCounter: "0",
    expectedPriorReceiptDigest: null
  };
  const concurrent = await Promise.all([
    endpointA.evaluate(
      ({ name, input }) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.reserve(name, input),
      { input: firstInput, name: databaseName }
    ),
    endpointB.evaluate(
      ({ name, input }) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.reserve(name, input),
      { input: firstInput, name: databaseName }
    )
  ]);
  const successes = concurrent.filter(({ ok }) => ok);
  const stale = concurrent.filter(({ code }) =>
    code === "E_CONFIDENTIAL_COUNTER_STALE"
  );
  assert.equal(successes.length, 1);
  assert.equal(stale.length, 1);
  assert.equal(successes[0].receipt.basis.interval_start, "0");
  assert.equal(successes[0].receipt.basis.interval_end_exclusive, "1");
  const firstDigest = counterReceiptDigest(successes[0].receipt);
  const beforeRestart = await endpointA.evaluate(
    ({ epoch, name }) =>
      globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.inspect(name, epoch),
    { epoch: epochId, name: databaseName }
  );
  assert.equal(beforeRestart.next_counter, "1");
  assert.equal(beforeRestart.last_counter_receipt_digest, firstDigest);
  await persistentContext.close();
  persistentContext = null;

  persistentContext = await chromium.launchPersistentContext(
    profileDirectory,
    launchOptions
  );
  const restarted = await pageWithHarness(persistentContext);
  const [restartedDescriptor, restartedPolicy] = await Promise.all([
    restarted.evaluate(
      (name) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.descriptor(name),
      databaseName
    ),
    restarted.evaluate(
      (name) =>
        globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.keyPolicy(name),
      databaseName
    )
  ]);
  assert.deepEqual(restartedDescriptor, descriptorA);
  assert.deepEqual(restartedPolicy, initialPolicy);
  const afterRestart = await restarted.evaluate(
    ({ name, input }) =>
      globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.reserve(name, input),
    {
      input: {
        count: "1",
        epoch: "0",
        epochId,
        expectedNextCounter: "1",
        expectedPriorReceiptDigest: firstDigest
      },
      name: databaseName
    }
  );
  assert.equal(afterRestart.ok, true);
  assert.equal(afterRestart.receipt.basis.authority_id, descriptorA.authority_id);
  assert.equal(afterRestart.receipt.basis.interval_start, "1");
  assert.equal(afterRestart.receipt.basis.interval_end_exclusive, "2");
  const finalState = await restarted.evaluate(
    ({ epoch, name }) =>
      globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.inspect(name, epoch),
    { epoch: epochId, name: databaseName }
  );
  assert.equal(finalState.next_counter, "2");
  const trustDatabaseName = `${databaseName}-trust-boundary`;
  await restarted.evaluate(
    (name) => globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.wipe(name),
    trustDatabaseName
  );
  const trustBoundary = await restarted.evaluate(
    ({ name, input }) =>
      globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.trustBoundary(name, input),
    { input: firstInput, name: trustDatabaseName }
  );
  assert.deepEqual(trustBoundary, {
    branded: true,
    post_retirement_code: "E_CONFIDENTIAL_COUNTER_AUTHORITY",
    retired: true
  });
  const rotationDatabaseName = `${databaseName}-rotation-boundary`;
  const rotationBoundary = await restarted.evaluate(
    (name) =>
      globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__.rotationBoundary(name),
    rotationDatabaseName
  );
  assert.deepEqual(rotationBoundary, {
    equivocation: {
      authority_changed: true,
      evidence_status: "counter_authority_equivocation",
      old_authority_code: "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      retired: true
    },
    lost: {
      authority_changed: true,
      reason: "counter_authority_lost"
    },
    own_replacement_rejected: true,
    recipient_substitution_rejected: true,
    successor_substitution_rejected: true
  });
  await persistentContext.close();
  persistentContext = null;

  console.log("MortalOS S4 Node / actual Chromium vectors: PASS");
  console.log(`- AES-GCM: ${nodeResult.aes_ciphertext_hex}`);
  console.log("- RSA-OAEP-3072 SHA-256/MGF1-SHA-256: valid + malformed + wrong label");
  console.log("- JCS decimal strings: byte-identical");
  console.log("- IndexedDB/Web Locks authority: two endpoints, one CAS winner");
  console.log("- Chromium process restart: same non-extractable key and next counter");
  console.log("- Chromium authority facade: internally branded, retired, and blocked");
  console.log("- Chromium persistent rotations: lost + equivocation, mutation-resistant");
  console.log("- Chromium successor rotation input: inert snapshot, substitution rejected");
  console.log("- Chromium recipient membership: deep owned snapshot, substitution rejected");
} finally {
  await persistentContext?.close();
  await browser.close();
  await server.close();
  await rm(temporaryRoot, { force: true, recursive: true });
}
