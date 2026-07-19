import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { MORTALOS_PRIMARY_ORIGIN, MORTALOS_RELAY_ORIGIN } from "../lab/runtime-endpoints.mjs";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";
import { verifyDeployedLab } from "./verify-deployed-lab.mjs";

const RUNS = Number(process.env.MORTALOS_PERSISTENT_HANDOFF_RUNS ?? "20");
assert.equal(Number.isSafeInteger(RUNS) && RUNS >= 20, true, "persistent handoff gate requires at least 20 runs");

function assertParticipant(snapshot, { role, sequence, signingAuthority }) {
  assert.equal(snapshot.role, role);
  assert.equal(snapshot.participant.status, "accepted");
  assert.equal(snapshot.participant.sequence, sequence);
  assert.equal(snapshot.participant.signing_authority, signingAuthority);
  assert.match(snapshot.participant.organism_id, /^mortalos:[A-Za-z0-9_-]{43}$/);
  assert.match(snapshot.participant.head_hash, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.match(snapshot.participant.state_root, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(snapshot), /private[_-]?key|privateKey|pkcs8|seed[_-]?bytes/i);
}

function attachFailureCapture(page, label, errors) {
  page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${label} console ${message.type()}: ${message.text()}`);
    }
  });
}

async function firstPage(context) {
  return context.pages()[0] ?? context.newPage();
}

async function runHandoff({ launchOptions, locale, profileA, profileB, relayMetrics, run, serverUrl }) {
  let contextA = null;
  let contextB = null;
  let cadenceOperations12s = null;
  const errors = [];
  try {
    contextA = await chromium.launchPersistentContext(profileA, launchOptions);
    contextB = await chromium.launchPersistentContext(profileB, launchOptions);
    const pageA = await firstPage(contextA);
    const pageB = await firstPage(contextB);
    attachFailureCapture(pageA, `run-${run}-A`, errors);
    attachFailureCapture(pageB, `run-${run}-B`, errors);
    const route = locale === "ko" ? "/ko/#continuity-proof" : "/#continuity-proof";
    await pageA.goto(new URL(route, serverUrl).href, { waitUntil: "networkidle" });
    await pageA.click("#continuity-create");
    await pageA.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.create);
    const origin = await pageA.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertParticipant(origin, { role: "A", sequence: "0", signingAuthority: true });

    const joinHref = await pageA.locator("#continuity-join-link").getAttribute("href");
    assert.ok(joinHref);
    const joinUrl = new URL(joinHref);
    assert.equal(joinUrl.origin, new URL(serverUrl).origin);
    assert.match(joinUrl.searchParams.get("room") ?? "", /^[A-Za-z0-9_-]{22}$/);
    await pageB.goto(joinUrl.href, { waitUntil: "networkidle" });
    await pageB.click("#continuity-join");
    await pageB.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.join);
    const joined = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertParticipant(joined, { role: "B", sequence: "0", signingAuthority: false });
    assert.equal(joined.participant.organism_id, origin.participant.organism_id);
    assert.equal(joined.participant.head_hash, origin.participant.head_hash);

    if (run === 1 && relayMetrics) {
      const before = relayMetrics().find((entry) => entry.room_id === joinUrl.searchParams.get("room"));
      assert.ok(before, "local relay metrics must include the active room");
      await pageB.waitForTimeout(12_000);
      const after = relayMetrics().find((entry) => entry.room_id === joinUrl.searchParams.get("room"));
      assert.ok(after, "local relay metrics must retain the active room");
      cadenceOperations12s = after.admitted - before.admitted;
      assert.ok(cadenceOperations12s >= 32, `two-browser cadence unexpectedly idle: ${cadenceOperations12s}/12s`);
      assert.ok(cadenceOperations12s <= 48, `two-browser cadence exceeds 240/min: ${cadenceOperations12s}/12s`);
      assert.equal(after.rejected, 0, "production-equivalent local relay rejected normal two-browser cadence");
    }

    await pageA.locator("#continuity-approve:enabled").waitFor({ timeout: 20_000 });
    await pageA.click("#continuity-approve");
    await pageB.locator("#continuity-accept:enabled").waitFor({ timeout: 20_000 });
    const pendingText = await pageB.locator("#continuity-status").textContent();
    if (locale === "ko") {
      assert.doesNotMatch(pendingText ?? "", /검증 완료/);
      assert.match(pendingText ?? "", /로컬 검증 예정/);
    } else {
      assert.doesNotMatch(pendingText ?? "", /\bverified\b/i);
      assert.match(pendingText ?? "", /verify locally before accepting/i);
    }
    await pageB.click("#continuity-accept");
    await pageB.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.handoff && proof.participant?.sequence === "1";
    });
    await pageA.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.handoff && proof.participant?.sequence === "1";
    }, null, { timeout: 20_000 });
    const afterA = await pageA.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    const afterB = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertParticipant(afterA, { role: "A", sequence: "1", signingAuthority: false });
    assertParticipant(afterB, { role: "B", sequence: "1", signingAuthority: true });
    assert.equal(afterB.participant.organism_id, origin.participant.organism_id);
    assert.equal(afterB.participant.head_hash, afterA.participant.head_hash);
    assert.equal(afterB.participant.state_root, afterA.participant.state_root);

    const expectedPageOrigin = new URL(serverUrl).origin;
    const expectedRelayOrigin = expectedPageOrigin === MORTALOS_PRIMARY_ORIGIN
      ? MORTALOS_RELAY_ORIGIN
      : expectedPageOrigin;
    const relayText = await pageB.evaluate(async ({ relayOrigin, room }) => {
      const response = await fetch(`${relayOrigin}/v1/rooms/${room}/messages?after=0&limit=64`);
      if (!response.ok) throw new Error(`relay evidence fetch failed: ${response.status}`);
      return response.text();
    }, { relayOrigin: expectedRelayOrigin, room: joinUrl.searchParams.get("room") });
    assert.doesNotMatch(relayText, /private[_-]?key|privateKey|pkcs8|seed[_-]?bytes/i);
    assert.doesNotMatch(relayText, /"(?:accepted|valid|verdict)"\s*:/i);

    await contextA.close();
    contextA = null;
    await pageB.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.offline, null, {
      timeout: new URL(serverUrl).hostname === "mortal-os.com" ? 35_000 : 20_000
    });
    assert.equal(await pageB.locator("#continuity-continue").isEnabled(), true);
    await pageB.click("#continuity-continue");
    await pageB.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.continue && proof.participant?.sequence === "2";
    });
    const continued = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertParticipant(continued, { role: "B", sequence: "2", signingAuthority: true });
    assert.equal(continued.participant.organism_id, origin.participant.organism_id);
    assert.equal(continued.participant.pulse_count, 1);
    assert.notEqual(continued.participant.head_hash, afterB.participant.head_hash);
    assert.notEqual(continued.participant.state_root, afterB.participant.state_root);
    assert.deepEqual(errors, []);
    return {
      cadence_operations_12s: cadenceOperations12s,
      locale,
      organism_id: continued.participant.organism_id,
      post_handoff_head: afterB.participant.head_hash,
      continued_head: continued.participant.head_hash,
      sequence: continued.participant.sequence
    };
  } finally {
    if (contextA) await contextA.close();
    if (contextB) await contextB.close();
  }
}

const remoteUrl = process.env.MORTALOS_LAB_URL;
const server = remoteUrl
  ? { url: new URL("/", remoteUrl).href, close: async () => {}, relayMetrics: null }
  : await (async () => {
      await buildLab();
      return startLabServer();
    })();
if (remoteUrl) {
  await verifyDeployedLab({
    url: server.url,
    expectedCommit: process.env.MORTALOS_EXPECTED_COMMIT,
    attempts: Number(process.env.MORTALOS_DEPLOY_VERIFY_ATTEMPTS ?? "12"),
    retryDelayMs: Number(process.env.MORTALOS_DEPLOY_VERIFY_DELAY_MS ?? "5000")
  });
}

const profileRoot = await mkdtemp(join(tmpdir(), "mortalos-persistent-handoff-"));
const profileA = join(profileRoot, "profile-a");
const profileB = join(profileRoot, "profile-b");
assert.notEqual(profileA, profileB);
const launchOptions = { headless: true, viewport: { width: 720, height: 900 } };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

const traces = [];
try {
  for (let run = 1; run <= RUNS; run += 1) {
    traces.push(await runHandoff({
      launchOptions,
      locale: run % 2 === 0 ? "ko" : "en",
      profileA,
      profileB,
      relayMetrics: server.relayMetrics,
      run,
      serverUrl: server.url
    }));
  }
  assert.equal(traces.length, RUNS);
  assert.equal(traces.every((trace) => trace.sequence === "2"), true);
  assert.equal(new Set(traces.map((trace) => trace.organism_id)).size, RUNS);
  assert.deepEqual(new Set(traces.map((trace) => trace.locale)), new Set(["en", "ko"]));
  if (server.relayMetrics) {
    assert.equal(server.relayMetrics().reduce((sum, room) => sum + room.rejected, 0), 0);
  }
  console.log(`MortalOS two persistent browser profiles / ${RUNS} consecutive A→B handoffs: PASS`);
  const cadence = traces.find((trace) => trace.cadence_operations_12s !== null)?.cadence_operations_12s;
  if (cadence !== undefined) {
    console.log(`- measured two-browser relay cadence: ${cadence} operations/12s (<=48), zero local 429s`);
  }
  console.log("- profile A Chromium process closed after accepted handoff in every run");
  console.log("- profile B continued the same organism at exact sequence 2 without A's key");
  console.log("- English/Korean pending proposal text remained unverified until local acceptance");
} finally {
  await server.close();
  await rm(profileRoot, { force: true, maxRetries: 10, recursive: true, retryDelay: 250 });
}
