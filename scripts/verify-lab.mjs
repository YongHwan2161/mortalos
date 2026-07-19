import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import { replayEvidenceBundle } from "../lab/evidence-export.mjs";
import { runReferenceProof } from "../lab/reference-engine.mjs";
import {
  MORTALOS_PRIMARY_ORIGIN,
  MORTALOS_RELAY_ORIGIN,
  MORTALOS_SAFE_API_ORIGIN,
  MORTALOS_SCENARIO_PATH
} from "../lab/runtime-endpoints.mjs";
import { buildLab } from "./build-lab.mjs";
import { LAB_CSP, startLabServer } from "./serve-lab.mjs";
import { verifyDeployedLab } from "./verify-deployed-lab.mjs";

const portableExpected = JSON.parse(
  await readFile(new URL("../test/vectors/portable-expected.json", import.meta.url), "utf8")
);
const [lifecycleFixture, forkFixture] = await Promise.all([
  readFile(new URL("../test/vectors/lifecycle.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../test/vectors/fork.json", import.meta.url), "utf8").then(JSON.parse)
]);
const nodeReferenceProof = runReferenceProof({ lifecycle: lifecycleFixture, fork: forkFixture });
const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
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

async function assertAxe(page, label) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await globalThis.axe.run(document, { resultTypes: ["violations"] });
    return result.violations
      .filter((entry) => entry.impact === "serious" || entry.impact === "critical")
      .map((entry) => ({ id: entry.id, impact: entry.impact, nodes: entry.nodes.length }));
  });
  assert.deepEqual(violations, [], `${label} axe serious/critical violations`);
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

async function openAdvancedWorkbench(page, keyboardOnly = false) {
  if (await page.locator("#advanced-evidence").getAttribute("open") !== null) return;
  if (keyboardOnly) {
    await focusByTab(page, "#advanced-evidence > summary");
    await page.keyboard.press("Enter");
  } else {
    await page.click("#advanced-evidence > summary");
  }
  assert.equal(await page.locator("#advanced-evidence").getAttribute("open"), "");
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
      assert.equal(await page.evaluate(() => document.activeElement?.className), "language-switch");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "hero-proof-link");
      const heroFocus = await page.locator("#hero-proof-link").evaluate((element) => {
        const style = getComputedStyle(element);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
      });
      assert.notEqual(heroFocus.outlineStyle, "none");
      assert.notEqual(heroFocus.outlineWidth, "0px");
      await page.keyboard.press("Enter");
      await openAdvancedWorkbench(page, true);
      await activate(page, "#guided-start", true);
      await page.locator("#guided-baseline").filter({ hasText: "3/3" }).waitFor();
      await focusByTab(page, "#scenario-kind");
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.locator("#scenario-kind").inputValue(), "fork");
      await focusByTab(page, "#scenario-hypothesis");
      await page.keyboard.press("Control+A");
      await page.keyboard.type("Can two signed siblings both become authoritative?");
      await activate(page, "#run-local-attack", true);
      await page.locator('#guided-status[data-state="accept"]').waitFor({ timeout: 25_000 });
      const guided = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().scenario);
      assert.equal(guided.model, "curated-offline/1");
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
      assert.equal(await page.locator("#run-local-attack").isEnabled(), true);
      assert.equal(await page.locator("#ask-gpt").isHidden(), true);
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
      await openAdvancedWorkbench(page);
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

    await activate(page, "#nurture-live", contextIndex === 0);
    await page.locator("#state-pulse-count").filter({ hasText: /1/ }).waitFor();
    const grown = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(grown.live.organism_id, born.live.organism_id);
    assert.equal(grown.live.protocol_version, "mortalos/1");
    assert.equal(grown.live.sequence, "2");
    assert.equal(grown.live.state.pulse_count, 1);
    assert.equal(grown.live.records.length, 3);
    assert.notEqual(grown.live.state_root, advanced.live.state_root);
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
      assert.equal(replayed.head_hash, grown.live.head_hash);
      assert.equal(replayed.sequence, "2");
      assert.deepEqual(canonicalBytes(replayed.state), canonicalBytes(grown.live.state));
      assert.equal(replayed.state_root, grown.live.state_root);
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
    await openAdvancedWorkbench(page);
    const reloaded = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(reloaded.live.organism_id, null);
    assert.equal(reloaded.live.custodians.length, 0);
    await activate(page, "#create-live", contextIndex === 0);
    await page.locator('#live-status[data-state="accept"]').waitFor({ timeout: 20_000 });
    const rebornId = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().live.organism_id);
    assert.notEqual(rebornId, born.live.organism_id);

    await assertAxe(page, `context-${contextIndex}`);

    assert.deepEqual(errors, []);
    const expectedOrigin = new URL(serverUrl).origin;
    const allowedExternalScenario = expectedOrigin === MORTALOS_PRIMARY_ORIGIN
      ? new URL(MORTALOS_SCENARIO_PATH, MORTALOS_SAFE_API_ORIGIN).href
      : null;
    assert.ok(requests.length > 0);
    for (const requestUrl of requests) {
      const parsed = new URL(requestUrl);
      if (parsed.protocol === "blob:" || parsed.protocol === "data:") continue;
      if (parsed.origin !== expectedOrigin) {
        assert.equal(parsed.href, allowedExternalScenario, `external browser request: ${requestUrl}`);
      }
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

async function runLocaleProof(browser, serverUrl, locale) {
  const context = await browser.newContext({ viewport: { width: 656, height: 912 } });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  try {
    const route = locale === "ko" ? "/ko/" : "/";
    const response = await page.goto(new URL(route, serverUrl).href, { waitUntil: "networkidle" });
    assert.ok(response);
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
      locale === "ko" ? "https://mortal-os.com/ko/" : "https://mortal-os.com/"
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    for (const selector of ["#hero-proof-link", "h1"]) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.y < 912, `${locale} ${selector} is outside the first short viewport`);
    }
    await openAdvancedWorkbench(page);
    await page.click("#guided-start");
    await page.click("#run-local-attack");
    await page.waitForFunction(() => !document.querySelector("#replay-without-gpt")?.disabled);
    await page.click("#replay-without-gpt");
    await page.locator("#guided-complete:not([hidden])").waitFor();
    const proof = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
    assert.equal(proof.scenario.model, "curated-offline/1");
    assert.equal(proof.scenario.proposal.format, "mortalos-scenario-proposal/1");
    if (locale === "en") {
      await page.click("#create-live");
      await page.locator('#live-status[data-state="accept"]').waitFor();
      const before = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
      const requestCount = requests.length;
      await page.click(".language-switch");
      assert.equal(await page.locator("html").getAttribute("lang"), "ko");
      assert.equal(new URL(page.url()).pathname, "/ko/");
      assert.equal(requests.length, requestCount, "locale switch must not issue a network request");
      const after = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot());
      assert.deepEqual(after.live, before.live);
      assert.deepEqual(after.scenario, before.scenario);
    }
    await assertAxe(page, locale);
    return proof;
  } finally {
    await context.close();
  }
}

async function runImportProof(browser, serverUrl, locale, bundle) {
  const context = await browser.newContext({ viewport: { width: 656, height: 912 } });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  try {
    await page.goto(new URL(locale === "ko" ? "/ko/" : "/", serverUrl).href, { waitUntil: "networkidle" });
    await openAdvancedWorkbench(page);
    await page.locator("#import-file").setInputFiles({
      name: "mortalos-lab-evidence.json",
      mimeType: "application/json",
      buffer: Buffer.from(canonicalBytes(bundle))
    });
    await page.locator('#import-status[data-state="accept"]').waitFor();
    const proof = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().imported_proof);
    assert.equal(proof.mode, "verified_read_only");
    assert.equal(proof.signing_authority, false);
    assert.equal(proof.digest, bundle.digest);
    assert.equal(await page.locator("#import-continue").isDisabled(), true);
    assert.match(await page.locator("#imported-life-card").textContent(), locale === "ko" ? /서명 권한 없음/ : /No signing authority/);
    assert.deepEqual(await storageSnapshot(page), {
      local: 0,
      session: 0,
      indexed_db: 0,
      caches: 0,
      service_workers: 0,
      cookies: ""
    });

    if (locale === "en") {
      await page.locator("#import-file").setInputFiles({
        name: "forbidden.json",
        mimeType: "application/json",
        buffer: Buffer.from(canonicalBytes({ ...bundle, private_key: "forbidden" }))
      });
      await page.locator('#import-status[data-state="reject"]').waitFor();
      assert.equal(await page.locator("#imported-life-card").isHidden(), true);
      assert.equal(await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().imported_proof), null);
    }
    const expectedOrigin = new URL(serverUrl).origin;
    assert.ok(requests.every((url) => ["blob:", "data:"].includes(new URL(url).protocol) || new URL(url).origin === expectedOrigin));
    return proof;
  } finally {
    await context.close();
  }
}

async function inspectDurableDatabase(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("mortalos-participant", 1);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    try {
      const transaction = database.transaction(["evidence", "keys", "meta"], "readonly");
      const read = (store) => new Promise((resolve, reject) => {
        const request = transaction.objectStore(store).get("active");
        request.addEventListener("success", () => resolve(request.result ?? null), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
      const [evidence, key, meta] = await Promise.all([read("evidence"), read("keys"), read("meta")]);
      let privateExportRejected = null;
      if (key?.private_key) {
        try {
          await crypto.subtle.exportKey("pkcs8", key.private_key);
          privateExportRejected = false;
        } catch {
          privateExportRejected = true;
        }
      }
      return {
        evidence,
        key: key ? {
          extractable: key.private_key.extractable,
          key_id: key.key_id,
          private_export_rejected: privateExportRejected,
          type: key.private_key.type,
          usages: [...key.private_key.usages]
        } : null,
        meta,
        stores: [...database.objectStoreNames]
      };
    } finally {
      database.close();
    }
  });
}

async function runDurableProof(browser, serverUrl) {
  const context = await browser.newContext({ viewport: { width: 656, height: 912 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  try {
    await page.goto(serverUrl, { waitUntil: "networkidle" });
    await openAdvancedWorkbench(page);
    assert.deepEqual(await storageSnapshot(page), {
      local: 0,
      session: 0,
      indexed_db: 0,
      caches: 0,
      service_workers: 0,
      cookies: ""
    });
    assert.equal(await page.locator("#enable-durable").isDisabled(), true);
    await page.locator("#durable-consent").check();
    assert.equal(await page.locator("#enable-durable").isEnabled(), true);
    await page.click("#enable-durable");
    await page.locator('#durable-status[data-state="accept"]').waitFor({ timeout: 20_000 });

    const created = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.equal(created.available, true);
    assert.equal(created.configured, true);
    assert.equal(created.signing_authority, true);
    assert.equal(created.private_export_rejected, true);
    assert.equal(created.sequence, "0");
    assert.equal(created.pulse_count, 0);
    assert.deepEqual(created.storage, ["IndexedDB CryptoKey", "public evidence", "schema metadata"]);
    assert.deepEqual(await storageSnapshot(page), {
      local: 0,
      session: 0,
      indexed_db: 1,
      caches: 0,
      service_workers: 0,
      cookies: ""
    });
    assert.doesNotMatch(JSON.stringify(created), /"private_key"|private[_-]?bytes|pkcs8/i);

    const database = await inspectDurableDatabase(page);
    assert.deepEqual(database.stores, ["evidence", "keys", "meta"]);
    assert.deepEqual(database.key, {
      extractable: false,
      key_id: database.key.key_id,
      private_export_rejected: true,
      type: "private",
      usages: ["sign"]
    });
    assert.equal(database.meta.pending, null);
    assert.equal(database.meta.schema_version, 1);
    assert.doesNotMatch(JSON.stringify(database.evidence), /private[_-]?key|pkcs8|CryptoKey/i);

    await page.click("#nurture-durable");
    await page.locator('#durable-status[data-state="accept"]').waitFor();
    const nurtured = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.equal(nurtured.organism_id, created.organism_id);
    assert.equal(nurtured.sequence, "1");
    assert.equal(nurtured.pulse_count, 1);
    assert.notEqual(nurtured.head_hash, created.head_hash);
    assert.notEqual(nurtured.state_root, created.state_root);

    await page.reload({ waitUntil: "networkidle" });
    await openAdvancedWorkbench(page);
    await page.locator('#durable-status[data-state="accept"]').waitFor({ timeout: 20_000 });
    const restored = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.deepEqual(restored, nurtured);

    const requestCount = [];
    page.on("request", (request) => requestCount.push(request.url()));
    const beforeSwitch = requestCount.length;
    await page.click(".language-switch");
    assert.equal(new URL(page.url()).pathname, "/ko/");
    assert.equal(await page.locator("html").getAttribute("lang"), "ko");
    assert.equal(requestCount.length, beforeSwitch, "durable locale switch must remain request-free");
    assert.deepEqual(
      await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable),
      restored
    );

    await page.click("#remove-durable-authority");
    await page.locator('#durable-status[data-state="reject"]').waitFor();
    const removed = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.equal(removed.configured, true);
    assert.equal(removed.authority_removed, true);
    assert.equal(removed.signing_authority, false);
    assert.equal(removed.organism_id, created.organism_id);
    assert.equal(removed.head_hash, nurtured.head_hash);
    assert.equal(await page.locator("#nurture-durable").isDisabled(), true);
    assert.equal((await inspectDurableDatabase(page)).key, null);

    await page.reload({ waitUntil: "networkidle" });
    await openAdvancedWorkbench(page);
    await page.locator('#durable-status[data-state="reject"]').waitFor({ timeout: 20_000 });
    const readOnly = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.deepEqual(readOnly, removed);

    await page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mortalos-participant", 1);
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
      const transaction = database.transaction("meta", "readwrite", { durability: "strict" });
      const current = await new Promise((resolve, reject) => {
        const request = transaction.objectStore("meta").get("active");
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
      transaction.objectStore("meta").put({ ...current, pending: { status: "prepared" } });
      await new Promise((resolve, reject) => {
        transaction.addEventListener("complete", resolve, { once: true });
        transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
      });
      database.close();
    });
    await page.reload({ waitUntil: "networkidle" });
    await openAdvancedWorkbench(page);
    await page.locator('#durable-status[data-state="reject"]').waitFor({ timeout: 20_000 });
    assert.match(await page.locator("#durable-status").textContent(), /안전 중단|failed closed/i);
    const corrupt = await page.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().durable);
    assert.equal(corrupt.configured, false);
    assert.equal(corrupt.signing_authority, false);
    assert.equal(corrupt.head_hash, null);
    assert.deepEqual(errors, []);
    return { created, nurtured, removed };
  } finally {
    await context.close();
  }
}

function assertContinuitySnapshot(snapshot, { role, sequence, signingAuthority }) {
  assert.equal(snapshot.role, role);
  assert.equal(snapshot.participant.status, "accepted");
  assert.equal(snapshot.participant.sequence, sequence);
  assert.equal(snapshot.participant.signing_authority, signingAuthority);
  assert.match(snapshot.participant.organism_id, /^mortalos:[A-Za-z0-9_-]{43}$/);
  assert.match(snapshot.participant.head_hash, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.match(snapshot.participant.state_root, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(snapshot), /private[_-]?key|privateKey|pkcs8|seed[_-]?bytes/i);
}

async function runTwoBrowserContinuityProof(browser, serverUrl, locale) {
  let contextA = await browser.newContext({ viewport: { width: 720, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 720, height: 900 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errors = [];
  const requests = [];
  for (const [label, page] of [["A", pageA], ["B", pageB]]) {
    page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        errors.push(`${label} console ${message.type()}: ${message.text()}`);
      }
    });
    page.on("request", (request) => requests.push(request.url()));
  }
  try {
    const route = locale === "ko" ? "/ko/#continuity-proof" : "/#continuity-proof";
    await pageA.goto(new URL(route, serverUrl).href, { waitUntil: "networkidle" });
    await pageA.click("#continuity-create");
    await pageA.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.create);
    const origin = await pageA.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertContinuitySnapshot(origin, { role: "A", sequence: "0", signingAuthority: true });
    assert.equal(origin.progress.join, false);

    const joinHref = await pageA.locator("#continuity-join-link").getAttribute("href");
    assert.ok(joinHref);
    const joinUrl = new URL(joinHref);
    assert.equal(joinUrl.origin, new URL(serverUrl).origin);
    assert.equal(joinUrl.pathname, locale === "ko" ? "/ko/" : "/");
    assert.equal(joinUrl.searchParams.get("join"), "1");
    assert.match(joinUrl.searchParams.get("room") ?? "", /^[A-Za-z0-9_-]{22}$/);
    assert.equal(joinUrl.hash, "#continuity-proof");

    await pageB.goto(joinUrl.href, { waitUntil: "networkidle" });
    assert.equal(await pageB.locator("html").getAttribute("lang"), locale);
    await pageB.click("#continuity-join");
    await pageB.waitForFunction(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity.progress.join);
    const joined = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertContinuitySnapshot(joined, { role: "B", sequence: "0", signingAuthority: false });
    assert.equal(joined.participant.organism_id, origin.participant.organism_id);
    assert.equal(joined.participant.head_hash, origin.participant.head_hash);

    await pageA.locator("#continuity-approve:enabled").waitFor({ timeout: 15_000 });
    await pageA.click("#continuity-approve");
    await pageB.locator("#continuity-accept:enabled").waitFor({ timeout: 15_000 });
    await pageB.click("#continuity-accept");
    await pageB.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.handoff && proof.participant?.sequence === "1";
    });
    await pageA.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.handoff && proof.participant?.sequence === "1";
    }, null, { timeout: 15_000 });
    const afterA = await pageA.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    const afterB = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertContinuitySnapshot(afterA, { role: "A", sequence: "1", signingAuthority: false });
    assertContinuitySnapshot(afterB, { role: "B", sequence: "1", signingAuthority: true });
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
      timeout: new URL(serverUrl).hostname === "mortal-os.com" ? 35_000 : 15_000
    });
    assert.equal(await pageB.locator("#continuity-continue").isEnabled(), true);
    await pageB.click("#continuity-continue");
    await pageB.waitForFunction(() => {
      const proof = globalThis.__MORTALOS_LAB__.publicSnapshot().continuity;
      return proof.progress.continue && proof.participant?.sequence === "2";
    });
    const continued = await pageB.evaluate(() => globalThis.__MORTALOS_LAB__.publicSnapshot().continuity);
    assertContinuitySnapshot(continued, { role: "B", sequence: "2", signingAuthority: true });
    assert.equal(continued.participant.organism_id, origin.participant.organism_id);
    assert.equal(continued.participant.pulse_count, 1);
    assert.notEqual(continued.participant.head_hash, afterB.participant.head_hash);
    assert.notEqual(continued.participant.state_root, afterB.participant.state_root);
    assert.deepEqual(errors, []);

    for (const requestUrl of requests) {
      const requestOrigin = new URL(requestUrl).origin;
      assert.ok(
        requestOrigin === expectedPageOrigin || requestOrigin === expectedRelayOrigin,
        `two-browser proof made an unexpected request: ${requestUrl}`
      );
    }
    await assertAxe(pageB, `${locale}-two-browser-continuity`);
    return { afterB, continued, origin, room: joinUrl.searchParams.get("room") };
  } finally {
    if (contextA) await contextA.close();
    await contextB.close();
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
  const englishProof = await runLocaleProof(browser, server.url, "en");
  const koreanProof = await runLocaleProof(browser, server.url, "ko");
  assert.deepEqual(koreanProof.reference, englishProof.reference);
  assert.deepEqual(englishProof.reference.r1_receipt, nodeReferenceProof.r1_receipt);
  assert.deepEqual(koreanProof.scenario, englishProof.scenario);
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
  const englishImport = await runImportProof(browser, server.url, "en", runs[0].exported);
  const koreanImport = await runImportProof(browser, server.url, "ko", runs[0].exported);
  assert.deepEqual(koreanImport, englishImport);
  assert.equal(englishImport.organism_id, runs[0].organismId);
  assert.equal(englishImport.head_hash, replayEvidenceBundle(runs[0].exported).head_hash);
  assert.equal(englishImport.sequence, "2");
  assert.equal(englishImport.state.pulse_count, 1);
  const durable = await runDurableProof(browser, server.url);
  assert.equal(durable.created.organism_id, durable.nurtured.organism_id);
  assert.equal(durable.removed.organism_id, durable.nurtured.organism_id);
  const englishContinuity = await runTwoBrowserContinuityProof(browser, server.url, "en");
  const koreanContinuity = await runTwoBrowserContinuityProof(browser, server.url, "ko");
  for (const proof of [englishContinuity, koreanContinuity]) {
    assert.equal(proof.origin.participant.organism_id, proof.continued.participant.organism_id);
    assert.equal(proof.continued.participant.sequence, "2");
    assert.equal(proof.continued.participant.pulse_count, 1);
  }

  if (server.requests) {
    const allowedPaths = new Set([
      "/", "/ko/", "/THIRD_PARTY_LICENSES.txt", "/api/scenarios", "/app.js", "/corpus-worker.js",
      "/custodian-worker.js", "/styles.css", "/asset-manifest.json"
    ]);
    assert.ok(server.requests.length > 0);
    for (const request of server.requests) {
      const relayPath = /^\/v1\/rooms\/[A-Za-z0-9_-]{22}\/(messages|presence)$/.test(request.pathname);
      assert.ok(request.method === "GET" || (request.method === "POST" && (request.pathname === "/api/scenarios" || relayPath)));
      assert.ok(allowedPaths.has(request.pathname) || relayPath, `unexpected request: ${request.pathname}`);
    }
  }

  console.log(`MortalOS Lab ${remoteUrl ? "H3B public" : "H3A local"} Chromium acceptance: PASS`);
  console.log("- 3 clean contexts / all 3 two-key quorum combinations: accepted");
  console.log("- Worker keys: non-extractable, private export rejected, message derived internally, sign-once per Pulse tuple");
  console.log("- one-key/replay/fork/post-fork/resurrection outcomes: exact kernel codes");
  console.log("- canonical R1 operation/result receipt: Node and actual Chromium bytes exact");
  console.log(`- full 15 named + ${expectedBoundaryCount} boundary + 10,000 adversarial corpus (separate Worker gate): committed-result exact`);
  console.log("- cross-origin-isolated page/Worker: SharedArrayBuffer available and rejected as unstable input");
  console.log("- public evidence: canonical, independently digested, replayed to identical head");
  console.log("- clean English/Korean import: identical identity/head/sequence, read-only, no signing authority or storage");
  console.log("- consent-gated durable participant: non-extractable key, exact reload recovery, authority removal, corrupt-pending fail-closed");
  console.log("- English/Korean two-browser succession: A creates, B joins, both authorize handoff, A closes, B continues the same identity");
  console.log("- 360/768/1440 responsive, full keyboard, focus, accessibility-tree, status-text, reduced-motion gates: clean");
  console.log("- / English + /ko/ Korean first paint, canonical/hreflang, locale parity, state-preserving no-request switch: exact");
  console.log("- simulated broadband DOM interactive <= 2s; links/stale/loading/storage/service-worker/external-request/console gates: clean");
  if (deployment) console.log(`- deployed assets: ${deployment.assets} exact / ${deployment.asset_digest}`);
} finally {
  await browser.close();
  await server.close();
}
