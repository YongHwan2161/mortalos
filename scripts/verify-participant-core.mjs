import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { runSeededParticipantCorpus } from "../lab/participant/model.mjs";

const COUNT = 10_000;
const LENGTH = 12;

function digest(text) {
  return createHash("sha256").update(text).digest("base64url");
}

const firstBytes = JSON.stringify(runSeededParticipantCorpus(COUNT, LENGTH));
const secondBytes = JSON.stringify(runSeededParticipantCorpus(COUNT, LENGTH));
assert.equal(secondBytes, firstBytes, "two Node corpus runs must be byte-identical");

const bundle = await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../lab/participant/model.mjs", import.meta.url))],
  format: "iife",
  globalName: "MortalOSParticipantModel",
  platform: "browser",
  target: ["chrome120"],
  write: false
});
const source = bundle.outputFiles[0].text;
const server = createServer((_request, response) => {
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  }).end("<!doctype html><html><title>MortalOS participant model parity</title></html>");
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("participant parity server unavailable");

const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: source });
  const browserResult = await page.evaluate(async ({ count, length }) => {
    const text = JSON.stringify(globalThis.MortalOSParticipantModel.runSeededParticipantCorpus(count, length));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    let binary = "";
    for (const byte of hash) binary += String.fromCharCode(byte);
    return {
      digest: btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""),
      length: text.length
    };
  }, { count: COUNT, length: LENGTH });
  assert.deepEqual(errors, []);
  assert.deepEqual(browserResult, {
    digest: digest(firstBytes),
    length: firstBytes.length
  });
  console.log("MortalOS Participant Core deterministic parity: PASS");
  console.log(`- schedules: ${COUNT}`);
  console.log(`- events per schedule: ${LENGTH}`);
  console.log(`- exact JSON bytes: ${firstBytes.length}`);
  console.log(`- Node run 1 = Node run 2 = Chromium sha256:${browserResult.digest}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
