import { writeFile } from "node:fs/promises";
import { buildR1Corpus } from "../r1/javascript/corpus.mjs";

const target = new URL("../test/vectors/r1-operations.json", import.meta.url);
await writeFile(target, `${JSON.stringify(buildR1Corpus(), null, 2)}\n`, "utf8");
console.log("MortalOS R1 corpus generated");

