import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalize } from "../src/index.mjs";
import { buildStateCorpus } from "../src/state/corpus.mjs";

const corpusUrl = new URL("../test/vectors/state-v1.json", import.meta.url);
const committed = JSON.parse(await readFile(corpusUrl, "utf8"));
if (canonicalize(committed) !== canonicalize(buildStateCorpus())) {
  throw new Error("committed state v1 corpus differs from JavaScript regeneration");
}
const python = spawnSync("python3", [
  new URL("../r1/python/state_verify.py", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"),
  corpusUrl.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1")
], { encoding: "utf8" });
if (python.status !== 0) throw new Error(python.stderr || python.stdout);
console.log(python.stdout.trim());
console.log(`MortalOS state v1 JavaScript/Python differential: PASS (${committed.entries.length} records)`);
