import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startLabServer } from "./serve-lab.mjs";

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "mortalos-r2-reachability-"));
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

let browser;
let server;
try {
  await writeFile(
    resolve(temporaryRoot, "index.html"),
    "<!doctype html><meta charset=\"utf-8\"><title>MortalOS R2 reachability</title>\n"
  );
  await build({
    absWorkingDir: repositoryRoot,
    bundle: true,
    entryPoints: ["test/webrtc-transport-browser-entry.mjs"],
    format: "esm",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    outfile: resolve(temporaryRoot, "reachability.js"),
    platform: "browser",
    sourcemap: false,
    target: ["chrome120"]
  });
  server = await startLabServer({ directory: temporaryRoot });
  browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const probe = await import("/reachability.js");
    return probe.runWebRtcSelectedRouteBrowserProbe();
  });
  assert.deepEqual(result, {
    non_authority: true,
    selected_route_classes: ["host", "host"]
  });
  assert.deepEqual(errors, []);
  console.log("MortalOS R2 WebRTC reachability contract: PASS");
  console.log("- actual Chromium selected host/host without raw candidate metadata");
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await rm(temporaryRoot, { recursive: true, force: true });
}
