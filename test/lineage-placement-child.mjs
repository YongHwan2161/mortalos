import { readFile, writeFile } from "node:fs/promises";
import { decodeBase64Url } from "../src/bytes.mjs";
import { convergeLineagePlacementCommits } from "../src/placement/lineage-controller.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const candidates = input.candidates.map((candidate) => ({
  capsule_bytes: decodeBase64Url(candidate.capsule_base64url),
  commit_bytes: decodeBase64Url(candidate.commit_base64url),
  generation_bytes: decodeBase64Url(candidate.generation_base64url)
}));
const result = convergeLineagePlacementCommits({ candidates });
await writeFile(outputPath, result.bytes);
