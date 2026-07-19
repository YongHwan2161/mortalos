import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { canonicalBytes } from "../src/index.mjs";
import { runTransportScheduleCorpus } from "../src/transport/corpus.mjs";

const directory = await mkdtemp(resolve(tmpdir(), "mortalos-transport-"));
try {
  const entry = resolve(directory, "entry.mjs");
  const bundle = resolve(directory, "bundle.js");
  const corpusPath = fileURLToPath(new URL("../src/transport/corpus.mjs", import.meta.url)).replaceAll("\\", "/");
  await writeFile(entry, `
    import { runTransportScheduleCorpus } from ${JSON.stringify(corpusPath)};
    globalThis.runTransportScheduleCorpus = runTransportScheduleCorpus;
  `);
  await build({ bundle: true, entryPoints: [entry], format: "iife", outfile: bundle, platform: "browser" });
  const browserSource = await readFile(bundle, "utf8");
  const nodeResult = await runTransportScheduleCorpus();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("data:text/html,<meta charset=utf-8>");
    await page.addScriptTag({ content: browserSource });
    const browserResult = await page.evaluate(() => globalThis.runTransportScheduleCorpus());
    assert.deepEqual(canonicalBytes(browserResult), canonicalBytes(nodeResult));
    console.log("MortalOS transport schedule differential: PASS");
    console.log(`- ${nodeResult.cases} seeded schedules / ${nodeResult.endpoints_recovered} endpoint recoveries`);
    console.log(`- Node/Chromium exact result ${nodeResult.digest}`);
  } finally {
    await browser.close();
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
