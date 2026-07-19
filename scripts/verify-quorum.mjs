import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";

const bundle = await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../lab/participant/quorum-endpoint.mjs", import.meta.url))],
  format: "iife",
  globalName: "MortalOSQuorum",
  platform: "browser",
  target: ["chrome120"],
  write: false
});
const source = bundle.outputFiles[0].text;
const harnessServer = createServer((_request, response) => {
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  }).end("<!doctype html><html><title>MortalOS isolated quorum endpoint</title></html>");
});
await new Promise((resolve, reject) => {
  harnessServer.once("error", reject);
  harnessServer.listen(0, "127.0.0.1", resolve);
});
const harnessAddress = harnessServer.address();
if (!harnessAddress || typeof harnessAddress === "string") throw new Error("quorum harness address unavailable");
const harnessUrl = `http://127.0.0.1:${harnessAddress.port}/`;
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);

async function bootEndpoint(label) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(harnessUrl, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: source });
  const custodian = await page.evaluate(async (endpointLabel) => {
    globalThis.endpoint = new globalThis.MortalOSQuorum.QuorumEndpointParticipant(endpointLabel);
    return globalThis.endpoint.initializeKey();
  }, label);
  return { context, custodian, errors, label, page };
}

async function call(endpoint, method, ...args) {
  return endpoint.page.evaluate(async ({ args: values, method: name }) =>
    globalThis.endpoint[name](...values), { args, method });
}

async function read(endpoint, property) {
  return endpoint.page.evaluate((name) => globalThis.endpoint[name], property);
}

const traces = [];
try {
  for (let run = 0; run < 10; run += 1) {
    const origin = await Promise.all(["A", "B", "C"].map((label) => bootEndpoint(`${label}${run}`)));
    const body = await origin[0].page.evaluate((custodians) =>
      globalThis.MortalOSQuorum.createThreeEndpointGenesisBody(custodians),
    origin.map((endpoint) => endpoint.custodian));
    const genesisApprovals = await Promise.all(origin.map((endpoint) => call(endpoint, "approveGenesis", body)));
    const genesis = await origin[0].page.evaluate(({ approvals, genesisBody }) =>
      globalThis.MortalOSQuorum.assembleThreeEndpointGenesis(genesisBody, approvals),
    { approvals: genesisApprovals, genesisBody: body });
    await Promise.all(origin.map((endpoint) => call(endpoint, "openGenesis", genesis)));
    assert.equal(genesis.envelope.approvals.length, 3);
    assert.equal(genesis.envelope.body.initial_quorum.threshold, 2);

    const lostIndex = run % 3;
    const lost = origin[lostIndex];
    const survivors = origin.filter((_, index) => index !== lostIndex);
    const organismId = (await read(survivors[0], "publicState")).organism_id;
    await lost.context.close();
    const proposal = await call(survivors[0], "createStateProposal", 1);
    const approvals = await Promise.all(survivors.map((endpoint) => call(endpoint, "approveProposal", proposal)));
    const transition = await call(survivors[0], "commitProposal", proposal, approvals);
    await call(survivors[1], "appendEvidence", transition);
    const continuedStates = await Promise.all(survivors.map((endpoint) => read(endpoint, "publicState")));
    for (const state of continuedStates) {
      assert.equal(state.organism_id, organismId);
      assert.equal(state.sequence, "1");
      assert.equal(state.pulse_count, 1);
      assert.equal(state.current_custodian, true);
    }
    assert.equal(continuedStates[0].head_hash, continuedStates[1].head_hash);

    const replacement = await bootEndpoint(`D${run}`);
    await call(replacement, "openGenesis", genesis, [transition]);
    const repairPayload = {
      added_key_id: replacement.custodian.key_id,
      format: "mortalos-quorum-repair/1",
      removed_key_id: lost.custodian.key_id
    };
    const repairProposal = await call(survivors[0], "createMembershipProposal", {
      nextCustodians: [...survivors.map((endpoint) => endpoint.custodian), replacement.custodian],
      payload: repairPayload
    });
    const repairApprovals = await Promise.all(survivors.map((endpoint) => call(endpoint, "approveProposal", repairProposal)));
    const acceptance = await call(replacement, "acceptMembership", repairProposal);
    const repair = await call(survivors[0], "commitProposal", repairProposal, repairApprovals, [acceptance]);
    await call(survivors[1], "appendEvidence", repair);
    await call(replacement, "appendEvidence", repair);
    const repairedEndpoints = [...survivors, replacement];
    const repairedStates = await Promise.all(repairedEndpoints.map((endpoint) => read(endpoint, "publicState")));
    const inventories = await Promise.all(repairedEndpoints.map((endpoint) => read(endpoint, "keyInventory")));
    for (const state of repairedStates) {
      assert.equal(state.organism_id, organismId);
      assert.equal(state.sequence, "2");
      assert.equal(state.current_custodian, true);
      assert.equal(state.threshold, 2);
    }
    assert.equal(new Set(repairedStates.map((state) => state.head_hash)).size, 1);
    assert.equal(new Set(inventories.map((inventory) => inventory.key_id)).size, 3);
    for (const inventory of inventories) {
      assert.equal(inventory.key_count, 1);
      assert.equal(inventory.non_extractable, true);
      assert.equal(inventory.private_export_rejected, true);
    }
    assert.doesNotMatch(JSON.stringify({ genesis, inventories, repair, repairedStates, transition }),
      /private[_-]?key|privateKey|pkcs8|CryptoKey/i);
    for (const endpoint of repairedEndpoints) assert.deepEqual(endpoint.errors, []);
    traces.push({
      lost: lost.label[0],
      organism_id: organismId,
      repaired_head: repairedStates[0].head_hash,
      run,
      sequence: repairedStates[0].sequence
    });
    await Promise.all(repairedEndpoints.map((endpoint) => endpoint.context.close()));
  }
  assert.deepEqual(traces.map((trace) => trace.lost), ["A", "B", "C", "A", "B", "C", "A", "B", "C", "A"]);
  const digest = `sha256:${encodeBase64Url(createHash("sha256").update(canonicalBytes(traces)).digest())}`;
  console.log("MortalOS isolated Chromium 2-of-3 quorum acceptance: PASS");
  console.log("- 10 fresh runs / three complementary single-endpoint loss combinations: accepted");
  console.log("- lost origin context closed before remaining pair state transition");
  console.log("- D replacement accepted exact membership repair; three distinct one-key inventories restored");
  console.log(`- trace digest: ${digest}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => harnessServer.close((error) => error ? reject(error) : resolve()));
}
