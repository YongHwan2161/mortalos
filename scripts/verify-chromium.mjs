import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";
import { readFile } from "node:fs/promises";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../test/vectors/${name}`, import.meta.url), "utf8"));
}

const cases = Number(process.env.MORTALOS_PORTABLE_CASES ?? "10000");
if (!Number.isSafeInteger(cases) || cases < 1 || cases > 10_000) {
  throw new Error("MORTALOS_PORTABLE_CASES must be 1 through 10000");
}
globalThis.__MORTALOS_PORTABLE_CASES__ = cases;
const { runPortableCorpus } = await import("../test/portable-corpus.mjs");
const expected = cases === 10_000
  ? await fixture("portable-expected.json")
  : runPortableCorpus({
      fork: await fixture("fork.json"),
      lifecycle: await fixture("lifecycle.json"),
      rfc8032: await fixture("rfc8032-ed25519.json"),
      singleton: await fixture("singleton.json")
    });
const bundled = await build({
  entryPoints: ["test/browser-contract-entry.mjs"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  write: false,
  define: {
    "globalThis.__MORTALOS_PORTABLE_CASES__": JSON.stringify(cases)
  }
});

const engineName = process.env.MORTALOS_BROWSER_ENGINE ?? "chromium";
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`unsupported browser engine: ${engineName}`);
const launchOptions = { headless: true };
if (engineName === "chromium" && process.env.MORTALOS_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.MORTALOS_CHROMIUM_EXECUTABLE;
}

const browser = await browserType.launch(launchOptions);
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><title>MortalOS portable contract</title></html>");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const browserResult = await page.evaluate(() => globalThis.__MORTALOS_BROWSER_CONTRACT__);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  if (JSON.stringify(browserResult) !== JSON.stringify(expected)) {
    throw new Error(`${engineName} mismatch:\n${JSON.stringify({ expected, browserResult }, null, 2)}`);
  }
  console.log(`MortalOS ${engineName} differential: PASS`);
  console.log(`- ${userAgent}`);
  console.log(`- Committed/${engineName} corpus results: byte-identical`);
  console.log(`- Serialized adversarial cases: ${browserResult.adversarial.rejected}/${browserResult.adversarial.cases} rejected`);
  console.log(`- Singleton organism: ${browserResult.singleton.organism_id}`);
} finally {
  await browser.close();
}
