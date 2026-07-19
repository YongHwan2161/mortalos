import { writeFile } from "node:fs/promises";
import { buildStateCorpus } from "../src/state/corpus.mjs";

await writeFile(
  new URL("../test/vectors/state-v1.json", import.meta.url),
  `${JSON.stringify(buildStateCorpus(), null, 2)}\n`,
  "utf8"
);
console.log("MortalOS state v1 corpus generated");
