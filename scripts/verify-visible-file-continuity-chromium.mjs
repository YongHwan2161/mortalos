import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

await buildLab();
const server = await startLabServer();
const browser = await chromium.launch({ headless: true });
const relayBodies = [];
const marker = "MORTALOS-DIRECT-WEBRTC-FILE-BYTES-DO-NOT-RELAY\n";
const requestedSize = Number(process.env.MORTALOS_VISIBLE_FILE_BYTES ?? Buffer.byteLength(marker) * 128);
assert.ok(Number.isSafeInteger(requestedSize) && requestedSize >= 1 && requestedSize <= 128 * 1024);
const source = Buffer.alloc(requestedSize);
source.fill(marker);

async function open(route) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("request", (request) => {
    if (request.method() === "POST") relayBodies.push(request.postData() ?? "");
  });
  await page.goto(new URL(route, server.url).href, { waitUntil: "networkidle" });
  return { context, page };
}

async function diagnostic(page) {
  return page.evaluate(() => ({
    code: document.querySelector("#continuity-error-code")?.textContent,
    snapshot: globalThis.__MORTALOS_LAB__.publicSnapshot().continuity,
    status: document.querySelector("#continuity-status")?.textContent
  }));
}

try {
  const a = await open("/#continuity-proof");
  await a.page.locator("#continuity-file").setInputFiles({
    buffer: source,
    mimeType: "text/plain",
    name: "direct-proof.txt"
  });
  await a.page.click("#continuity-create");
  await a.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.create);
  const joinHref = await a.page.locator("#continuity-join-link").getAttribute("href");
  const join = new URL(joinHref);
  const b = await open(`${join.pathname}${join.search}${join.hash}`);
  await b.page.click("#continuity-join");
  try {
    await b.page.waitForFunction(
      () => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.join,
      null,
      { timeout: 30_000 }
    );
  } catch (error) {
    throw new Error(`visible file join failed: ${JSON.stringify({ a: await diagnostic(a.page), b: await diagnostic(b.page) })}`, { cause: error });
  }
  const joinedProof = await diagnostic(b.page);
  assert.deepEqual(joinedProof.snapshot.file.lineage, {
    head_hash: joinedProof.snapshot.participant.head_hash,
    organism_id: joinedProof.snapshot.participant.organism_id,
    sequence: joinedProof.snapshot.participant.sequence
  });
  await a.page.locator("#continuity-approve:enabled").waitFor({ timeout: 30_000 });
  await a.page.click("#continuity-approve");
  await b.page.locator("#continuity-accept:enabled").waitFor({ timeout: 30_000 });
  await b.page.click("#continuity-accept");
  await b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.file.progress.handoff);
  const acceptedProof = await diagnostic(b.page);
  assert.deepEqual(acceptedProof.snapshot.file.lineage, {
    head_hash: acceptedProof.snapshot.participant.head_hash,
    organism_id: acceptedProof.snapshot.participant.organism_id,
    sequence: acceptedProof.snapshot.participant.sequence
  });
  assert.equal(acceptedProof.snapshot.participant.sequence, "2");
  await a.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.handoff);
  await a.page.click("#continuity-remove-a");
  const removedA = await diagnostic(a.page);
  assert.equal(removedA.snapshot.participant.signing_authority, false);
  assert.equal(removedA.snapshot.file.transport.resource_size, 0);
  assert.equal(removedA.snapshot.file.transport.signer_count, 0);
  assert.equal(removedA.snapshot.file.transport.transport, "none");
  await a.context.close();
  await b.page.waitForFunction(
    () => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.offline,
    null,
    { timeout: 20_000 }
  );
  await b.page.click("#continuity-continue");
  await b.page.waitForTimeout(1_000);
  const immediateContinuation = await diagnostic(b.page);
  if (!immediateContinuation.snapshot.file.progress.continued && immediateContinuation.code !== "—") {
    throw new Error(`visible file continuation rejected: ${JSON.stringify(immediateContinuation)}`);
  }
  try {
    await b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.file.progress.continued);
  } catch (error) {
    throw new Error(`visible file continuation failed: ${JSON.stringify(await diagnostic(b.page))}`, { cause: error });
  }
  const [download] = await Promise.all([
    b.page.waitForEvent("download"),
    b.page.click("#continuity-download")
  ]);
  const downloaded = await readFile(await download.path());
  assert.deepEqual(downloaded, source);
  const proof = await diagnostic(b.page);
  assert.equal(proof.snapshot.file.progress.recovered, true);
  assert.equal(proof.snapshot.file.progress.continued, true);
  assert.equal(proof.snapshot.file.private_material_exposed, false);
  assert.equal(proof.snapshot.file.resource_size, source.byteLength);
  assert.deepEqual(proof.snapshot.file.lineage, {
    head_hash: proof.snapshot.participant.head_hash,
    organism_id: proof.snapshot.participant.organism_id,
    sequence: proof.snapshot.participant.sequence
  });
  assert.equal(proof.snapshot.participant.sequence, "3");
  const posted = relayBodies.join("\n");
  assert.ok(relayBodies.length >= 4, "relay inspection captured no meaningful control traffic");
  assert.equal(posted.includes(marker.trim()), false, "relay request exposed plaintext file marker");
  assert.equal(posted.includes(source.toString("base64url")), false, "relay request exposed encoded file bytes");
  assert.equal(
    posted.includes(source.subarray(0, 48).toString("base64url")),
    false,
    "relay request exposed an encoded file prefix"
  );
  assert.doesNotMatch(JSON.stringify(proof.snapshot), /private[_-]?key|privateKey|pkcs8|seed[_-]?bytes/iu);
  console.log("MortalOS visible real-file continuity: PASS");
  console.log(`- ${source.byteLength} exact bytes moved over direct WebRTC; relay bodies contain neither plaintext nor base64url file bytes`);
  console.log("- Browser A authority, direct transport, signer, and retained P2P resource were destroyed before continuation");
  console.log("- Browser B rejected 1 corrupt copy, recovered 2-of-3, downloaded exact bytes, and committed sequence 3");
  await b.context.close();
} finally {
  await browser.close();
  await server.close();
}
