import assert from "node:assert/strict";
import { chromium } from "playwright";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

await buildLab();
const server = await startLabServer();
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const participants = [];

async function participant(role) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  participants.push({ browser, context });
  const page = await context.newPage();
  const errors = [];
  const requestsAfterCut = [];
  let cut = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => {
    if (cut) requestsAfterCut.push(request.url());
  });
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.evaluate(async ({ endpointId, role: participantRole }) => {
    const { DirectParticipantSession } = await import("/webrtc-participant.js");
    globalThis.__MORTALOS_DIRECT_SESSION__ = new DirectParticipantSession({
      endpointId,
      role: participantRole
    });
  }, { endpointId: `${role}-direct`, role });
  return {
    browser,
    context,
    cut: async () => {
      cut = true;
      await context.route("**/*", (route) => route.abort("internetdisconnected"));
    },
    errors,
    page,
    requestsAfterCut
  };
}

function snapshot(page) {
  return page.evaluate(() => globalThis.__MORTALOS_DIRECT_SESSION__.snapshot);
}

try {
  const [a, b] = await Promise.all([participant("A"), participant("B")]);
  const offer = await a.page.evaluate(() => globalThis.__MORTALOS_DIRECT_SESSION__.startOffer());
  assert.match(offer, /"type":"offer"/u);
  const answer = await b.page.evaluate((signal) => globalThis.__MORTALOS_DIRECT_SESSION__.acceptOffer(signal), offer);
  assert.match(answer, /"type":"answer"/u);

  const requestCountAtCut = server.requests.length;
  await Promise.all([a.cut(), b.cut()]);
  await a.page.evaluate((signal) => globalThis.__MORTALOS_DIRECT_SESSION__.completeAnswer(signal), answer);
  await b.page.evaluate(() => globalThis.__MORTALOS_DIRECT_SESSION__.waitUntilConnected());
  await Promise.all([
    a.page.waitForFunction(() => globalThis.__MORTALOS_DIRECT_SESSION__.snapshot.stage === "handoff"),
    b.page.waitForFunction(() => globalThis.__MORTALOS_DIRECT_SESSION__.snapshot.stage === "handoff")
  ]);

  const [aHandoff, bHandoff] = await Promise.all([snapshot(a.page), snapshot(b.page)]);
  assert.equal(aHandoff.error, null);
  assert.equal(bHandoff.error, null);
  assert.equal(aHandoff.participant.organism_id, bHandoff.participant.organism_id);
  assert.equal(aHandoff.participant.head_hash, bHandoff.participant.head_hash);
  assert.equal(aHandoff.participant.sequence, "1");
  assert.equal(bHandoff.participant.sequence, "1");
  assert.equal(aHandoff.remote_endpoint_id, "B-direct");
  assert.equal(bHandoff.remote_endpoint_id, "A-direct");

  const retired = await a.page.evaluate(() => globalThis.__MORTALOS_DIRECT_SESSION__.retireOrigin());
  assert.equal(retired.participant.signing_authority, false);
  await a.browser.close();
  const continued = await b.page.evaluate(() => globalThis.__MORTALOS_DIRECT_SESSION__.continueLocally());
  assert.equal(continued.stage, "continued");
  assert.equal(continued.participant.organism_id, bHandoff.participant.organism_id);
  assert.equal(continued.participant.sequence, "2");
  assert.equal(continued.participant.signing_authority, true);

  assert.equal(server.requests.length, requestCountAtCut, "origin received a request after the HTTP cut");
  assert.deepEqual(a.requestsAfterCut, []);
  assert.deepEqual(b.requestsAfterCut, []);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  assert.doesNotMatch(JSON.stringify({ aHandoff, bHandoff, continued, retired }), /private[_-]?key|CryptoKey/u);

  console.log("MortalOS direct WebRTC participant proof: PASS");
  console.log("- manual canonical offer/answer exchange used no signaling service or ICE server");
  console.log("- origin and relay HTTP were denied before Genesis, join, and signed custody handoff");
  console.log("- A removed its authority and its Chromium process exited before B committed sequence 2");
  console.log("- two isolated Chromium processes on one host are not physical failure-domain evidence");
} finally {
  await Promise.all(participants.map(({ browser }) => browser.close().catch(() => {})));
  await server.close();
}
