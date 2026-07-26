import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalize } from "../src/index.mjs";
import { buildStatePackageCorpus } from "../src/state/package-corpus.mjs";

const corpusUrl = new URL("../test/vectors/state-package-v1.json", import.meta.url);
const committed = JSON.parse(await readFile(corpusUrl, "utf8"));
const regenerated = buildStatePackageCorpus();
if (canonicalize(committed) !== canonicalize(regenerated)) {
  throw new Error("committed state-package corpus differs from JavaScript regeneration");
}
const python = spawnSync("python3", [
  fileURLToPath(new URL("../r1/python/state_package_verify.py", import.meta.url)),
  fileURLToPath(corpusUrl)
], { encoding: "utf8" });
if (python.status !== 0) throw new Error(python.stderr || python.stdout);
console.log(python.stdout.trim());
const entry = committed.entries[0];
console.log(
  `MortalOS state-package JavaScript/Python differential: PASS ` +
  `(${entry.resource_size} bytes / ${entry.chunk_digests.length} chunks / ${entry.next_state_root})`
);
