import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import {
  CONTINUITY_SCENARIO_FORMAT,
  CONTINUITY_SCENARIO_STEPS
} from "../sdk/continuity.mjs";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

const engineName = process.env.MORTALOS_BROWSER_ENGINE ?? "chromium";
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`unsupported browser engine: ${engineName}`);

const temporaryRoot = await mkdtemp(join(tmpdir(), `mortalos-continuity-${engineName}-`));
const labDirectory = resolve(temporaryRoot, "lab");
const resourcePath = resolve(temporaryRoot, "actual-browser-selected-file.bin");
const profileA = resolve(temporaryRoot, "profile-a");
const profileB = resolve(temporaryRoot, "profile-b");
const resource = randomBytes(98_317);
await writeFile(resourcePath, resource);
await buildLab({ outdir: labDirectory });
const server = await startLabServer({ directory: labDirectory });
const launchOptions = { headless: true };
if (engineName === "chromium" && process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

async function openEndpoint(profile) {
  const context = await browserType.launchPersistentContext(profile, launchOptions);
  const page = context.pages()[0] ?? await context.newPage();
  page.on("console", (message) => console.log(`continuity ${engineName}: ${message.text()}`));
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(globalThis.__MORTALOS_PRODUCT_CONTINUITY__));
  const scenario = await page.evaluate(() =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.scenario);
  assert.equal(scenario.format, CONTINUITY_SCENARIO_FORMAT);
  assert.deepEqual(scenario.steps, CONTINUITY_SCENARIO_STEPS);
  const description = await page.evaluate(() =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.initialize());
  assert.equal(description.non_extractable, true);
  assert.equal(description.private_material_exposed, false);
  return { context, description, page, scenario };
}

let endpointA;
let endpointB;
try {
  endpointA = await openEndpoint(profileA);
  endpointB = await openEndpoint(profileB);
  await endpointA.page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "mortalos-runtime-file";
    input.type = "file";
    document.body.append(input);
  });
  await endpointA.page.locator("#mortalos-runtime-file").setInputFiles(resourcePath);
  const created = await endpointA.page.evaluate(async () => {
    const file = document.querySelector("#mortalos-runtime-file").files[0];
    return globalThis.__MORTALOS_PRODUCT_CONTINUITY__.createFromFile(file);
  });
  assert.equal(created.sequence, "1");
  assert.equal(created.resource_size, resource.byteLength);

  const request = await endpointB.page.evaluate((capsule) =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.handoffRequest(capsule), created.capsule);
  const proposal = await endpointA.page.evaluate(({ capsule, request: value }) =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.handoffPropose(capsule, value), {
    capsule: created.capsule,
    request
  });
  const handed = await endpointB.page.evaluate(({ capsule, proposal: value }) =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.handoffAccept(capsule, value), {
    capsule: created.capsule,
    proposal
  });
  assert.equal(handed.sequence, "2");
  assert.equal(handed.organism_id, created.organism_id);
  assert.equal(request.custodian.key_id, endpointB.description.custodian.key_id);

  assert.deepEqual(await endpointA.page.evaluate(() =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.terminate()), {
    status: "authority-destroyed"
  });
  await endpointA.context.close();
  assert.equal(endpointA.page.isClosed(), true);
  endpointA = null;

  const corrupt = Buffer.from(handed.copies[0], "base64url");
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  const recoveryCopies = [
    corrupt.toString("base64url"), handed.copies[1], handed.copies[2]
  ];
  const recovered = await endpointB.page.evaluate((value) =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.recover(
      value.copies,
      value.expectedHead,
      value.expectedOrganism
    ), {
    copies: recoveryCopies,
    expectedHead: handed.head_hash,
    expectedOrganism: handed.organism_id
  });
  assert.deepEqual(Buffer.from(recovered.resource, "base64url"), resource);
  assert.equal(recovered.rejected_copies.length, 1);
  assert.equal(recovered.valid_copies, 2);

  await assert.rejects(
    endpointB.page.evaluate((value) =>
      globalThis.__MORTALOS_PRODUCT_CONTINUITY__.recover(
        [value.copy], value.expectedHead, value.expectedOrganism
      ), {
      copy: handed.copies[1],
      expectedHead: handed.head_hash,
      expectedOrganism: handed.organism_id
    }),
    /E_CONTINUITY_QUORUM/u
  );
  await assert.rejects(
    endpointB.page.evaluate((value) =>
      globalThis.__MORTALOS_PRODUCT_CONTINUITY__.recover(
        value.copies, value.expectedHead, value.expectedOrganism
      ), {
      copies: created.copies.slice(0, 2),
      expectedHead: handed.head_hash,
      expectedOrganism: handed.organism_id
    }),
    /E_CONTINUITY_STALE_HEAD/u
  );

  const continued = await endpointB.page.evaluate((value) =>
    globalThis.__MORTALOS_PRODUCT_CONTINUITY__.continue(
      value.capsule, value.expectedHead, value.resource
    ), {
    capsule: recovered.capsule,
    expectedHead: recovered.head_hash,
    resource: recovered.resource
  });
  assert.equal(continued.sequence, "3");
  assert.equal(continued.organism_id, created.organism_id);
  assert.notEqual(continued.head_hash, handed.head_hash);
  assert.doesNotMatch(
    JSON.stringify({ created, handed, proposal, recovered, request }),
    /private_pkcs8_base64url|BEGIN PRIVATE KEY|CryptoKey/iu
  );

  console.log(`MortalOS ${engineName} real-file continuity vertical: PASS`);
  console.log("- actual File selected in endpoint A; separate persistent endpoint B accepted custody");
  console.log("- endpoint A browser context closed before B recovery and continuation");
  console.log("- one corrupt copy tolerated; one copy and stale lineage rejected");
  console.log("- exact bytes recovered, sequence 3 committed, private key material not transferred");
} finally {
  await endpointA?.context.close();
  await endpointB?.context.close();
  await server.close();
  await rm(temporaryRoot, {
    force: true,
    maxRetries: 8,
    recursive: true,
    retryDelay: 250
  });
}
