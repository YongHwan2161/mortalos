import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("../protocol/profile.v1.json", import.meta.url);
const outputUrl = new URL("../src/generated/protocol-profile.mjs", import.meta.url);
const profile = JSON.parse(await readFile(sourceUrl, "utf8"));

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

if (profile.format !== "mortalos-protocol-profile/1") {
  throw new Error("unsupported MortalOS protocol profile");
}
const body = JSON.stringify(sorted(profile), null, 2)
  .replace(/"([^"\\]+)":/g, "$1:")
  .replace(/^(\s*)"([^"\\]*)"([,]?)$/gm, '$1"$2"$3');
const output = `// Generated from protocol/profile.v1.json. Run npm run generate:protocol-profile.\nconst profile = ${body};\n\nfunction deepFreeze(value) {\n  for (const child of Object.values(value)) {\n    if (child && typeof child === "object") deepFreeze(child);\n  }\n  return Object.freeze(value);\n}\n\nexport const PROTOCOL_PROFILE = deepFreeze(profile);\n`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputUrl, "utf8");
  if (existing !== output) throw new Error("generated protocol profile is stale");
} else {
  await writeFile(fileURLToPath(outputUrl), output);
}
