import { build } from "esbuild";
import { chromium as playwrightChromium } from "playwright";
import { readFile } from "node:fs/promises";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../test/vectors/${name}`, import.meta.url), "utf8"));
}

const expected = await fixture("portable-expected.json");
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
  if (JSON.stringify(browserResult) !== JSON.stringify(expected)) {
    throw new Error(`Chromium mismatch:\n${JSON.stringify({ expected, browserResult }, null, 2)}`);
  }
  console.log("MortalOS Chromium differential: PASS");
  console.log(`- ${userAgent}`);
  console.log("- Committed/Chromium corpus results: byte-identical");
  console.log(`- Serialized adversarial cases: ${browserResult.adversarial.rejected}/${browserResult.adversarial.cases} rejected`);
  console.log(`- Singleton organism: ${browserResult.singleton.organism_id}`);
} finally {
  await browser.close();
}
