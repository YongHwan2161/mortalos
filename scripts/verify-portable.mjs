import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import { runPortableCorpus } from "../test/portable-corpus.mjs";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return nested.flat().filter((path) => path.endsWith(".mjs"));
}

const forbidden = [
  ["Node built-in import", /(?:from\s+|import\s*)["']node:/],
  ["Node Buffer global", /\bBuffer\b/],
  ["process global", /\bprocess\s*\./],
  ["CommonJS require", /\brequire\s*\(/],
  ["DOM dependency", /\b(?:window|document)\s*\./],
  ["network dependency", /\b(?:fetch|WebSocket)\s*\(?/],
  ["ambient clock", /\bDate\s*\./],
  ["ambient randomness", /\bMath\s*\.\s*random\s*\(/]
];

const violations = [];
const files = await sourceFiles("src");
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const [name, pattern] of forbidden) {
    if (pattern.test(source)) violations.push(`${file}: ${name}`);
  }
}
if (violations.length) throw new Error(`portable boundary violations:\n${violations.join("\n")}`);

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
  throw new Error(`committed portable result mismatch:\n${JSON.stringify({ directResult, expected }, null, 2)}`);
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
const sandbox = {
  TextDecoder,
  TextEncoder,
  Uint8Array,
  ArrayBuffer,
  SharedArrayBuffer,
  DataView
};
vm.runInNewContext(bundled.outputFiles[0].text, sandbox, { timeout: 180000 });
const browserResult = sandbox.__MORTALOS_BROWSER_CONTRACT__;
if (JSON.stringify(browserResult) !== JSON.stringify(directResult)) {
  throw new Error(`browser bundle mismatch:\n${JSON.stringify({ directResult, browserResult }, null, 2)}`);
}

console.log("MortalOS portable contract: PASS");
console.log(`- Portable source modules scanned: ${files.length}`);
console.log(`- Browser bundle bytes: ${bundled.outputFiles[0].contents.byteLength}`);
console.log(`- Committed/Node/browser-target results: byte-identical`);
console.log(`- Serialized adversarial cases: ${directResult.adversarial.rejected}/${directResult.adversarial.cases} rejected`);
console.log(`- Singleton organism: ${directResult.singleton.organism_id}`);
