import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import { replayEvidenceBundle } from "../lab/evidence-export.mjs";
import { buildLab } from "./build-lab.mjs";
import { LAB_CSP, startLabServer } from "./serve-lab.mjs";
import { verifyDeployedLab } from "./verify-deployed-lab.mjs";

const portableExpected = JSON.parse(
  await readFile(new URL("../test/vectors/portable-expected.json", import.meta.url), "utf8")
);
const expectedBoundaryCount = Object.keys(portableExpected.boundary_cases).length;
const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1440, height: 900 }),
  Object.freeze({ width: 768, height: 900 }),
  Object.freeze({ width: 360, height: 800 })
]);

function rgb(value) {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map((offset) => Number.parseInt(hex[1].slice(offset, offset + 2), 16));
  }
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`unsupported CSS color: ${value}`);
  return match.slice(1).map(Number);
}

function luminance([red, green, blue]) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function workerSignOnceAudit(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker("./custodian-worker.js", { type: "module" });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("custodian sign-once audit timed out"));
    }, 10_000);
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message || "custodian audit Worker failed"));
    };
    worker.onmessage = ({ data }) => {
      if (data.id === "init" && data.type === "ready") {
        worker.postMessage({
          id: "legacy-oracle",
          type: "sign",
          context: "pulse:test-parent",
          message: new Uint8Array(32).fill(1)
        });
      } else if (data.id === "legacy-oracle" && data.type === "error") {
        worker.postMessage({
          id: "first",
          type: "sign",
          operation: "pulse",
          body: {
            organism_id: `mortalos:${"A".repeat(43)}`,
            sequence: "1",
            parent_hash: `sha256:${"B".repeat(43)}`,
            candidate: "first"
          }
        });
      } else if (data.id === "first" && data.type === "signature") {
        worker.postMessage({
          id: "second",
          type: "sign",
          operation: "pulse",
          body: {
            organism_id: `mortalos:${"A".repeat(43)}`,
            sequence: "1",
            parent_hash: `sha256:${"B".repeat(43)}`,
            candidate: "conflicting"
          }
        });
      } else if (data.id === "second") {
        clearTimeout(timer);
        worker.terminate();
        resolve({ type: data.type, message: data.message, legacy_oracle_rejected: true });
      }
    };
    worker.postMessage({ id: "init", type: "init" });
  }));
}

async function storageSnapshot(page) {
  return page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    indexed_db: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).length : 0,
    caches: (await caches.keys()).length,
    service_workers: (await navigator.serviceWorker.getRegistrations()).length,
    cookies: document.cookie
  }));
}

async function focusByTab(page, selector, maximumTabs = 80) {
  for (let count = 0; count <= maximumTabs; count += 1) {
    if (await page.evaluate((target) => document.activeElement?.matches(target) === true, selector)) {
      const focus = await page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
      });
      assert.notEqual(focus.outlineStyle, "none", `${selector} has no visible focus outline`);
      assert.notEqual(focus.outlineWidth, "0px", `${selector} has a zero-width focus outline`);
      return;
    }
    await page.keyboard.press("Tab");
  }
  assert.fail(`keyboard tab order did not reach ${selector}`);
}

async function activate(page, selector, keyboardOnly) {
  if (keyboardOnly) {
    await focusByTab(page, selector);
    await page.keyboard.press("Enter");
  } else {
    await page.click(selector);
  }
}

async function runContext(browser, serverUrl, contextIndex, pair) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: VIEWPORTS[contextIndex]
  });
  const errors = [];
  const requests = [];
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: 1_250_000,
    uploadThroughput: 625_000
  });
  if (contextIndex === 2) await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console ${message.type()}: ${message.text()}`);
    }
  });

  try {
    const response = await page.goto(serverUrl, { waitUntil: "networkidle" });
    assert.ok(response, "Lab navigation must return a response");
    const headers = await response.allHeaders();
    assert.equal(headers["content-security-policy"], LAB_CSP);
    assert.equal(headers["cross-origin-embedder-policy"], "require-corp");
    assert.equal(headers["cross-origin-opener-policy"], "same-origin");
    assert.equal(headers["cross-origin-resource-policy"], "same-origin");
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "no-referrer");
    assert.match(headers["permissions-policy"], /camera=\(\)/);
    assert.equal(await page.evaluate(() => globalThis.isSecureContext), true);
    assert.deepEqual(await page.evaluate(() => ({
      cross_origin_isolated: globalThis.crossOriginIsolated,
      shared_array_buffer: typeof SharedArrayBuffer === "function"
    })), {
      cross_origin_isolated: true,
      shared_array_buffer: true
    });
    assert.deepEqual(await storageSnapshot(page), {
      local: 0,
      session: 0,
      indexed_db: 0,
      caches: 0,
      service_workers: 0,
      cookies: ""
    });
    const interactiveMs = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      return navigation?.domInteractive ?? Number.POSITIVE_INFINITY;
    });
    assert.ok(interactiveMs <= 2_000, `broadband-simulated DOM interactive ${interactiveMs}ms exceeds 2000ms`);
    assert.equal(await page.locator("#hero-proof-link").isVisible(), true);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });

    const signOnce = await workerSignOnceAudit(page);
    assert.equal(signOnce.type, "error");
    assert.equal(signOnce.legacy_oracle_rejected, true);
    assert.match(signOnce.message, /sign-once protocol context already used/);

    if (contextIndex === 0) {
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.className), "skip-link");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "hero-proof-link");
      const heroFocus = await page.locator("#hero-proof-link").evaluate((element) => {
        const style = getComputedStyle(element);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
      });
      assert.notEqual(heroFocus.outlineStyle, "none");
      assert.notEqual(heroFocus.outlineWidth, "0px");
      await page.keyboard.press("Enter");
      await activate(page, "#guided-start", true);
      await page.locator("#guided-baseline").filter({ hasText: "3/3" }).waitFor();
      await focusByTab(page, "#scenario-kind");
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.locator("#scenario-kind").inputValue(), "fork");
      await focusByTab(page, "#scenario-hypothesis");
      await page.keyboard.press("Control+A");
      await page.keyboard.type("Can two signed siblings both become authoritative?");
      await activate(page, "#ask-gpt", true);
      await page.locator('#guided-status[data-state="accept"]').waitFor({ timeout: 25_000 });
      const guided = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().scenario);
      assert.match(guided.model, /^gpt-5\.6/);
      assert.match(guided.compiled_digest, /^sha256:[A-Za-z0-9_-]{43}$/);
      assert.equal(guided.kernel.matches_trusted_expectation, true);
      assert.equal(guided.replay, null);
      await activate(page, "#replay-without-gpt", true);
      await page.locator("#offline-replay").filter({ hasText: "PASS" }).waitFor();
      const offline = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().scenario);
      assert.deepEqual(offline.replay.actual, offline.kernel.actual);
      assert.equal(offline.replay.matches_trusted_expectation, true);
      await page.locator("#guided-complete:not([hidden])").waitFor();
      assert.match(await page.locator("#release-asset-digest").textContent(), /^sha256:[A-Za-z0-9_-]{43}$/);
      assert.match(await page.locator("#release-source-commit").textContent(), /^(?:local|[0-9a-f]{40})$/);
      await activate(page, "#run-another-attack", true);
      assert.equal(await page.locator("#guided-complete").isHidden(), true);
      assert.equal(await page.locator("#ask-gpt").isEnabled(), true);
      await activate(page, "#create-live", true);
      await page.locator('#live-status[data-state="accept"]').waitFor({ timeout: 20_000 });
      await focusByTab(page, "#first-signer");
      await page.keyboard.press("End");
      await page.keyboard.press("Home");
      assert.equal(await page.locator("#first-signer").inputValue(), "0");
      await focusByTab(page, "#second-signer");
      await page.keyboard.press("End");
      await page.keyboard.press("Home");
      assert.equal(await page.locator("#second-signer").inputValue(), "1");
    } else {
      await page.selectOption("#first-signer", String(pair[0]));
      await page.selectOption("#second-signer", String(pair[1]));
      await activate(page, "#create-live", false);
    }
    await page.locator('#live-status[data-state="accept"]').waitFor({ timeout: 20_000 });

    const born = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(born.secure_context, true);
    assert.equal(born.live.custodians.length, 3);
    assert.equal(new Set(born.live.custodians.map((entry) => entry.key_id)).size, 3);
    for (const custodian of born.live.custodians) {
      assert.equal(custodian.private_extractable, false);
      assert.equal(custodian.private_export_rejected, true);
      assert.deepEqual(Object.keys(custodian).sort(), [
        "key_id", "private_export_rejected", "private_extractable", "public_key"
      ]);
    }
    assert.doesNotMatch(JSON.stringify(born), /private[_-]?key|CryptoKey|pkcs8/i);

    await activate(page, "#try-one", contextIndex === 0);
    await page.locator("#one-key-verdict").filter({ hasText: "E_APPROVAL_INSUFFICIENT_QUORUM" }).waitFor();
    await activate(page, "#complete-quorum", contextIndex === 0);
    await page.locator("#two-key-verdict").filter({ hasText: "accept" }).waitFor();
    const advanced = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(advanced.live.organism_id, born.live.organism_id);
    assert.equal(advanced.live.sequence, "1");
    assert.equal(advanced.live.records.length, 2);

    await activate(page, "#replay-live", contextIndex === 0);
    await page.locator("#replay-verdict").filter({ hasText: "E_REPLAY_STALE" }).waitFor();

    await activate(page, "#run-reference", contextIndex === 0);
    await page.locator('#reference-status[data-state="accept"]').waitFor();
    const reference = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().reference);
    assert.equal(reference.complete_initial_turnover, true);
    assert.equal(reference.replay.code, "E_REPLAY_STALE");
    assert.equal(reference.mutations.identity.code, "E_ORGANISM_ID_MISMATCH");
    assert.equal(reference.mutations.payload.code, "E_EVENT_PAYLOAD_MISMATCH");
    assert.equal(reference.mutations.signature.code, "E_APPROVAL_SIGNATURE_INVALID");
    assert.equal(reference.mutations.one_approval.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
    assert.equal(reference.fork.sibling, "E_FORK_DETECTED");
    assert.equal(reference.fork.post_fork, "E_LINEAGE_ALREADY_FORKED");
    assert.equal(reference.resurrection.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
    assert.equal(reference.clone.identity_separate, true);
    assert.equal(reference.mortality.status, "dead_under_v0_assumptions");
    assert.equal(reference.mortality.latent_evidence_complete, true);
    assert.match(reference.mortality.qualification, /closed fixture only/);
    assert.match(reference.mortality.qualification, /complete local evidence inventory/);

    let corpus = null;
    if (contextIndex === 0) {
      await activate(page, "#run-corpus", true);
      const corpusOutcome = await page.waitForFunction(() => {
        const result = document.getElementById("corpus-result")?.textContent ?? "";
        if (result === "Not run") return null;
        return {
          result,
          log: document.getElementById("event-log")?.lastElementChild?.textContent ?? ""
        };
      }, null, { timeout: 135_000 }).then((handle) => handle.jsonValue());
      assert.match(corpusOutcome.result, /exact/, corpusOutcome.log);
      corpus = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().corpus);
      assert.equal(corpus.exact, true);
      assert.equal(corpus.named_passed, corpus.named_total);
      assert.equal(corpus.boundary_passed, expectedBoundaryCount);
      assert.equal(corpus.boundary_total, expectedBoundaryCount);
      assert.equal(corpus.shared_memory_available, true);
      assert.equal(corpus.adversarial_rejected, 10_000);
      assert.equal(corpus.adversarial_cases, 10_000);
    }

    let exported = null;
    if (contextIndex === 0) {
      const downloadPromise = page.waitForEvent("download");
      await activate(page, "#export-live", true);
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "mortalos-lab-evidence.json");
      const path = await download.path();
      assert.ok(path, "evidence download path must exist");
      const raw = await readFile(path);
      exported = JSON.parse(raw.toString("utf8"));
      assert.deepEqual(new Uint8Array(raw), canonicalBytes(exported));
      const independentDigest = `sha256:${encodeBase64Url(createHash("sha256").update(canonicalBytes({
        format: exported.format,
        protocol: exported.protocol,
        records: exported.records
      })).digest())}`;
      assert.equal(exported.digest, independentDigest);
      const replayed = replayEvidenceBundle(exported);
      assert.equal(replayed.status, "accept");
      assert.equal(replayed.organism_id, born.live.organism_id);
      assert.equal(replayed.head_hash, advanced.live.head_hash);
      assert.doesNotMatch(JSON.stringify(exported), /private[_-]?key|acceptedContexts|CryptoKey/i);
    }

    await activate(page, "#retire-live", contextIndex === 0);
    await page.locator("#retirement-result").filter({ hasText: "authority_unavailable_not_proven_dead" }).waitFor();
    await page.locator("#retirement-result").filter({ hasText: "E_APPROVAL_INSUFFICIENT_QUORUM" }).waitFor();
    const retired = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(retired.live.retired, true);
    assert.deepEqual(await storageSnapshot(page), {
      local: 0,
      session: 0,
      indexed_db: 0,
      caches: 0,
      service_workers: 0,
      cookies: ""
    });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - globalThis.innerWidth);
    assert.ok(overflow <= 1, `page overflows viewport by ${overflow}px`);
    const primaryColors = await page.locator("#create-live").evaluate((element) => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
    assert.ok(contrast(rgb(primaryColors.foreground), rgb(primaryColors.background)) >= 4.5);
    const palette = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        faint: style.getPropertyValue("--faint"),
        muted: style.getPropertyValue("--muted"),
        surface: style.getPropertyValue("--surface"),
        surface2: style.getPropertyValue("--surface-2"),
        body: getComputedStyle(document.body).backgroundColor
      };
    });
    assert.ok(contrast(rgb(palette.faint), rgb(palette.surface)) >= 4.5);
    assert.ok(contrast(rgb(palette.faint), rgb(palette.surface2)) >= 4.5);
    assert.ok(contrast(rgb(palette.faint), rgb(palette.body)) >= 4.5);
    assert.ok(contrast(rgb(palette.muted), rgb(palette.surface)) >= 4.5);
    assert.ok(contrast(rgb(palette.muted), rgb(palette.surface2)) >= 4.5);
    const accessibility = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("button, select, textarea, a[href]")]
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          id: element.id,
          name: element.getAttribute("aria-label") || element.labels?.[0]?.textContent?.trim() || element.textContent?.trim()
        }));
      const statuses = [...document.querySelectorAll(".status")].map((element) => ({
        state: element.dataset.state,
        text: element.textContent?.trim(),
        role: element.getAttribute("role"),
        live: element.getAttribute("aria-live")
      }));
      return { controls, statuses };
    });
    assert.ok(accessibility.controls.length >= 13);
    for (const control of accessibility.controls) {
      assert.ok(control.name, `control ${control.id || "without id"} has no accessible name`);
    }
    for (const status of accessibility.statuses) {
      assert.ok(status.text, "status has no non-color text");
      assert.ok(status.state, "status has no machine-readable state");
      assert.equal(status.role, "status");
      assert.equal(status.live, "polite");
    }
    await cdp.send("Accessibility.enable");
    const tree = await cdp.send("Accessibility.getFullAXTree");
    const accessibleButtons = tree.nodes.filter((node) => node.role?.value === "button" && node.name?.value);
    assert.ok(accessibleButtons.length >= 8, "Chromium accessibility tree omitted named controls");
    const links = await page.locator("a[href]").evaluateAll((elements) => elements.map((element) => element.href));
    assert.ok(links.length >= 3);
    const pageOrigin = new URL(serverUrl).origin;
    for (const href of links) {
      const target = new URL(href);
      if (target.origin === pageOrigin) {
        const linked = await page.request.get(target.href);
        assert.equal(linked.status(), 200, `broken same-origin link: ${target.href}`);
      } else {
        assert.equal(target.protocol, "https:", `external link is not HTTPS: ${target.href}`);
      }
    }
    assert.equal(await page.locator("button[data-label]").count(), 0, "stale busy button label remains");
    assert.equal(await page.locator(".status.busy").count(), 0, "unrecoverable busy status remains");
    if (contextIndex === 2) {
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
    }

    await page.reload({ waitUntil: "networkidle" });
    const reloaded = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(reloaded.live.organism_id, null);
    assert.equal(reloaded.live.custodians.length, 0);
    await activate(page, "#create-live", contextIndex === 0);
    await page.locator('#live-status[data-state="accept"]').waitFor({ timeout: 20_000 });
    const rebornId = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().live.organism_id);
    assert.notEqual(rebornId, born.live.organism_id);

    assert.deepEqual(errors, []);
    const expectedOrigin = new URL(serverUrl).origin;
    assert.ok(requests.length > 0);
    for (const requestUrl of requests) {
      const parsed = new URL(requestUrl);
      if (parsed.protocol === "blob:" || parsed.protocol === "data:") continue;
      assert.equal(parsed.origin, expectedOrigin, `external browser request: ${requestUrl}`);
    }
    return {
      organismId: born.live.organism_id,
      rebornId,
      referenceId: reference.organism_id,
      referenceHead: reference.head_hash,
      corpus,
      exported
    };
  } finally {
    await context.close();
  }
}

const remoteUrl = process.env.MORTALOS_LAB_URL;
let deployment = null;
const server = remoteUrl
  ? {
      url: new URL("/", remoteUrl).href,
      requests: null,
      close: async () => {}
    }
  : await (async () => {
      await buildLab();
      return startLabServer();
    })();
if (remoteUrl) {
  deployment = await verifyDeployedLab({
    url: server.url,
    expectedCommit: process.env.MORTALOS_EXPECTED_COMMIT,
    attempts: Number(process.env.MORTALOS_DEPLOY_VERIFY_ATTEMPTS ?? "12"),
    retryDelayMs: Number(process.env.MORTALOS_DEPLOY_VERIFY_DELAY_MS ?? "5000")
  });
}
const licenseResponse = await fetch(`${server.url}/THIRD_PARTY_LICENSES.txt`);
assert.equal(licenseResponse.status, 200);
assert.match(licenseResponse.headers.get("content-type") ?? "", /^text\/plain/);
const bundledLicenses = await licenseResponse.text();
assert.match(bundledLicenses, /@noble\/curves 2\.2\.0/);
assert.match(bundledLicenses, /@noble\/hashes 2\.2\.0/);
assert.match(bundledLicenses, /Permission is hereby granted, free of charge/);
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);

try {
  const pairs = [[0, 1], [1, 2], [2, 0]];
  const runs = [];
  for (let index = 0; index < pairs.length; index += 1) {
    runs.push(await runContext(browser, server.url, index, pairs[index]));
  }
  assert.equal(new Set(runs.map((entry) => entry.organismId)).size, 3);
  assert.equal(new Set(runs.map((entry) => entry.rebornId)).size, 3);
  assert.equal(new Set(runs.map((entry) => entry.referenceId)).size, 1);
  assert.equal(new Set(runs.map((entry) => entry.referenceHead)).size, 1);
  assert.equal(runs.filter((entry) => entry.corpus?.exact).length, 1);

  if (server.requests) {
    const allowedPaths = new Set([
      "/", "/THIRD_PARTY_LICENSES.txt", "/api/scenarios", "/app.js", "/corpus-worker.js",
      "/custodian-worker.js", "/styles.css", "/asset-manifest.json"
    ]);
    assert.ok(server.requests.length > 0);
    for (const request of server.requests) {
      assert.ok(request.method === "GET" || (request.method === "POST" && request.pathname === "/api/scenarios"));
      assert.ok(allowedPaths.has(request.pathname), `unexpected request: ${request.pathname}`);
    }
  }

  console.log(`MortalOS Lab ${remoteUrl ? "H3B public" : "H3A local"} Chromium acceptance: PASS`);
  console.log("- 3 clean contexts / all 3 two-key quorum combinations: accepted");
  console.log("- Worker keys: non-extractable, private export rejected, message derived internally, sign-once per Pulse tuple");
  console.log("- one-key/replay/fork/post-fork/resurrection outcomes: exact kernel codes");
  console.log(`- full 15 named + ${expectedBoundaryCount} boundary + 10,000 adversarial corpus (separate Worker gate): committed-result exact`);
  console.log("- cross-origin-isolated page/Worker: SharedArrayBuffer available and rejected as unstable input");
  console.log("- public evidence: canonical, independently digested, replayed to identical head");
  console.log("- 360/768/1440 responsive, full keyboard, focus, accessibility-tree, status-text, reduced-motion gates: clean");
  console.log("- simulated broadband DOM interactive <= 2s; links/stale/loading/storage/service-worker/external-request/console gates: clean");
  if (deployment) console.log(`- deployed assets: ${deployment.assets} exact / ${deployment.asset_digest}`);
} finally {
  await browser.close();
  await server.close();
}
