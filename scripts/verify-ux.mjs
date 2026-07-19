import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { buildLab } from "./build-lab.mjs";
import { startLabServer } from "./serve-lab.mjs";

const remoteUrl = process.env.MORTALOS_LAB_URL;
const server = remoteUrl
  ? { close: async () => {}, url: new URL("/", remoteUrl).href }
  : await (async () => {
      await buildLab();
      return startLabServer();
    })();
const output = await mkdtemp(join(tmpdir(), "mortalos-ux-"));
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(launchOptions);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("base64url");
}

async function newPage(route = "/") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    globalThis.__MORTALOS_PERF__ = { cls: 0, lcp: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.__MORTALOS_PERF__.lcp = entry.startTime;
    }).observe({ buffered: true, type: "largest-contentful-paint" });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) globalThis.__MORTALOS_PERF__.cls += entry.value;
      }
    }).observe({ buffered: true, type: "layout-shift" });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.__MORTALOS_PERF__.longTasks.push(entry.duration);
    }).observe({ buffered: true, type: "longtask" });
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.goto(new URL(route, server.url).href, { waitUntil: "networkidle" });
  return { context, errors, page };
}

async function captureStable(name, page, locator = null) {
  const first = join(output, `${name}-1.png`);
  const second = join(output, `${name}-2.png`);
  const target = locator ?? page;
  const options = { animations: "disabled", caret: "hide", path: first };
  if (target === page) options.fullPage = false;
  await target.screenshot(options);
  await target.screenshot({ ...options, path: second });
  const [left, right] = await Promise.all([readFile(first), readFile(second)]);
  assert.ok(left.byteLength > 5_000, `${name} screenshot is unexpectedly empty`);
  assert.equal(digest(left), digest(right), `${name} visual state changed without an event`);
  return digest(left);
}

async function assertViewportContract(page, locale) {
  const contract = await page.evaluate(() => {
    const inViewport = (element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
    };
    return {
      horizontal_overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      primary_ctas: [...document.querySelectorAll(".button.primary")].filter(inViewport).map((entry) => entry.id),
      protagonist_identities: [...document.querySelectorAll("#continuity-identity")].filter(inViewport).length,
      secondary_ctas: [...document.querySelectorAll("#hero-proof-link")].filter(inViewport).map((entry) => entry.id),
      workbench_open: document.querySelector("#advanced-evidence").open
    };
  });
  assert.ok(contract.primary_ctas.length <= 1, `${locale} first viewport has multiple primary CTAs`);
  assert.ok(contract.secondary_ctas.length <= 1, `${locale} first viewport has multiple secondary CTAs`);
  assert.equal(contract.protagonist_identities, 1, `${locale} first viewport protagonist count`);
  assert.ok(contract.horizontal_overflow <= 1, `${locale} horizontal overflow`);
  assert.equal(contract.workbench_open, false, `${locale} advanced workbench must be collapsed initially`);
}

async function performanceRun(locale) {
  const session = await newPage(locale === "ko" ? "/ko/" : "/");
  try {
    await pageDelay(session.page, 1_000);
    const metrics = await session.page.evaluate(() => ({
      cls: globalThis.__MORTALOS_PERF__.cls,
      dom_interactive: performance.getEntriesByType("navigation")[0]?.domInteractive ?? Infinity,
      lcp: globalThis.__MORTALOS_PERF__.lcp,
      tbt: globalThis.__MORTALOS_PERF__.longTasks.reduce((total, duration) => total + Math.max(0, duration - 50), 0)
    }));
    assert.deepEqual(session.errors, []);
    return metrics;
  } finally {
    await session.context.close();
  }
}

function pageDelay(page, milliseconds) {
  return page.waitForTimeout(milliseconds);
}

async function createAndJoin(locale = "en") {
  const a = await newPage(locale === "ko" ? "/ko/#continuity-proof" : "/#continuity-proof");
  await a.page.click("#continuity-create");
  await a.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.create);
  assert.equal(await a.page.locator("#continuity-join-link").textContent(), locale === "ko" ? "비공개 참여 링크 준비됨" : "Private join link ready");
  assert.equal(await a.page.locator("#continuity-qr svg").count(), 1);
  const join = await a.page.locator("#continuity-join-link").getAttribute("href");
  const b = await newPage(new URL(join).pathname + new URL(join).search + new URL(join).hash);
  await b.page.click("#continuity-join");
  await b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.join);
  return { a, b };
}

async function completeHandoff(a, b) {
  await a.page.locator("#continuity-approve:enabled").waitFor({ timeout: 15_000 });
  await a.page.click("#continuity-approve");
  await b.page.locator("#continuity-accept:enabled").waitFor({ timeout: 15_000 });
  await b.page.click("#continuity-accept");
  await b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.handoff);
}

const screenshotDigests = {};
try {
  const performanceRuns = [];
  for (let index = 0; index < 3; index += 1) performanceRuns.push(await performanceRun("en"));
  const median = (field) => performanceRuns.map((entry) => entry[field]).sort((a, b) => a - b)[1];
  const perfSummary = {
    cls: median("cls"),
    dom_interactive: median("dom_interactive"),
    lcp: median("lcp"),
    tbt: median("tbt")
  };
  assert.ok(perfSummary.lcp > 0 && perfSummary.lcp <= 2_500, `median LCP ${perfSummary.lcp}ms`);
  assert.ok(perfSummary.cls <= 0.1, `median CLS ${perfSummary.cls}`);
  assert.ok(perfSummary.tbt <= 200, `median TBT ${perfSummary.tbt}ms`);

  for (const locale of ["en", "ko"]) {
    const idle = await newPage(locale === "ko" ? "/ko/" : "/");
    await assertViewportContract(idle.page, locale);
    screenshotDigests[`${locale}-idle`] = await captureStable(`${locale}-idle`, idle.page);
    assert.deepEqual(idle.errors, []);
    await idle.context.close();
  }

  const judgeStarted = performance.now();
  const alive = await createAndJoin("en");
  screenshotDigests["en-joining"] = await captureStable("en-joining", alive.b.page, alive.b.page.locator("#continuity-proof"));
  await completeHandoff(alive.a, alive.b);
  const organismId = (await alive.b.page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.participant.organism_id));
  await alive.a.context.close();
  await alive.b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.offline, null, { timeout: 20_000 });
  await alive.b.page.click("#continuity-continue");
  await alive.b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.continue);
  const aliveProof = await alive.b.page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
  assert.equal(aliveProof.participant.organism_id, organismId);
  assert.equal(aliveProof.participant.sequence, "2");
  assert.ok(performance.now() - judgeStarted < 90_000, "automated judge path exceeded 90 seconds");
  screenshotDigests["en-alive"] = await captureStable("en-alive", alive.b.page, alive.b.page.locator("#continuity-proof"));
  assert.deepEqual(alive.b.errors, []);
  await alive.b.context.close();

  const stalled = await createAndJoin("en");
  await stalled.a.context.close();
  await stalled.b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.stalled, null, { timeout: 20_000 });
  const stalledProof = await stalled.b.page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
  assert.equal(stalledProof.participant.signing_authority, false);
  assert.equal(stalledProof.progress.handoff, false);
  assert.match(await stalled.b.page.locator("#continuity-status").textContent(), /read-only|읽기 전용/i);
  screenshotDigests["en-stalled"] = await captureStable("en-stalled", stalled.b.page, stalled.b.page.locator("#continuity-proof"));
  assert.deepEqual(stalled.b.errors, []);
  await stalled.b.context.close();

  const koreanAlive = await createAndJoin("ko");
  await completeHandoff(koreanAlive.a, koreanAlive.b);
  await koreanAlive.a.context.close();
  await koreanAlive.b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.offline, null, { timeout: 20_000 });
  await koreanAlive.b.page.click("#continuity-continue");
  await koreanAlive.b.page.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.continue);
  screenshotDigests["ko-alive"] = await captureStable("ko-alive", koreanAlive.b.page, koreanAlive.b.page.locator("#continuity-proof"));
  assert.deepEqual(koreanAlive.b.errors, []);
  await koreanAlive.b.context.close();

  const forked = await newPage("/");
  await forked.page.click("#advanced-evidence > summary");
  await forked.page.click("#run-reference");
  await forked.page.locator('#reference-status[data-state="accept"]').waitFor();
  assert.match(await forked.page.locator("#reference-results").textContent(), /E_FORK_DETECTED/);
  screenshotDigests["en-forked"] = await captureStable("en-forked", forked.page, forked.page.locator("#reference-results"));
  assert.deepEqual(forked.errors, []);
  await forked.context.close();

  console.log("MortalOS UX and performance acceptance: PASS");
  console.log(`- cold-cache median: LCP ${perfSummary.lcp.toFixed(1)}ms / CLS ${perfSummary.cls.toFixed(3)} / TBT ${perfSummary.tbt.toFixed(1)}ms / DOM interactive ${perfSummary.dom_interactive.toFixed(1)}ms`);
  console.log("- first viewport: <=1 primary CTA, <=1 secondary CTA, exactly 1 protagonist, advanced workbench collapsed");
  console.log("- automated two-browser judge path: under 90 seconds; premature A loss: honest read-only stall");
  console.log(`- stable screenshot states: ${Object.keys(screenshotDigests).join(", ")}`);
} finally {
  await browser.close();
  await server.close();
  await rm(output, { force: true, recursive: true });
}
