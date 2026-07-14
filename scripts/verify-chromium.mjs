import { build } from "esbuild";
import { chromium as playwrightChromium } from "playwright";
import { readFile } from "node:fs/promises";
import { runPortableCorpus } from "../test/portable-corpus.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../test/vectors/${name}`, import.meta.url), "utf8"));
}

const [fork, lifecycle, rfc8032, singleton, expected] = await Promise.all([
  fixture("fork.json"),
  fixture("lifecycle.json"),
  fixture("rfc8032-ed25519.json"),
  fixture("singleton.json"),
  fixture("portable-expected.json")
]);
const directResult = runPortableCorpus({ fork, lifecycle, rfc8032, singleton });
if (JSON.stringify(directResult) !== JSON.stringify(expected)) {
  throw new Error("Node result differs from the committed portable result");
}
const bundled = await build({
  entryPoints: ["test/browser-contract-entry.mjs"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  write: false
});

const launchOptions = { headless: true };
if (process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

const browser = await playwrightChromium.launch(launchOptions);
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><title>MortalOS portable contract</title></html>");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const browserResult = await page.evaluate(() => globalThis.__MORTALOS_BROWSER_CONTRACT__);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  if (JSON.stringify(browserResult) !== JSON.stringify(directResult)) {
    throw new Error(`Chromium mismatch:\n${JSON.stringify({ directResult, browserResult }, null, 2)}`);
  }
  console.log("MortalOS Chromium differential: PASS");
  console.log(`- ${userAgent}`);
  console.log("- Committed/Node/Chromium corpus results: byte-identical");
  console.log(`- Serialized adversarial cases: ${browserResult.adversarial.rejected}/${browserResult.adversarial.cases} rejected`);
  console.log(`- Singleton organism: ${directResult.singleton.organism_id}`);
} finally {
  await browser.close();
}
