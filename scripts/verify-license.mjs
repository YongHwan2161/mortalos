import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [license, packageText, lockText, contributing, notices] = await Promise.all([
  readFile(new URL("LICENSE", root)),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("package-lock.json", root), "utf8"),
  readFile(new URL("CONTRIBUTING.md", root), "utf8"),
  readFile(new URL("THIRD_PARTY_NOTICES.md", root), "utf8")
]);
const digest = createHash("sha256").update(license).digest("hex");
const expected = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
if (digest !== expected) throw new Error(`Apache-2.0 text digest mismatch: ${digest}`);
const packageDocument = JSON.parse(packageText);
const lockDocument = JSON.parse(lockText);
if (packageDocument.license !== "Apache-2.0") throw new Error("package.json license mismatch");
if (lockDocument.packages[""].license !== "Apache-2.0") throw new Error("package-lock license mismatch");
if (!contributing.includes("Apache-2.0")) throw new Error("contribution terms do not identify Apache-2.0");
for (const [name, version] of Object.entries({
  "@noble/curves": "2.2.0",
  "@noble/hashes": "2.2.0",
  ajv: "8.20.0",
  esbuild: "0.28.1",
  playwright: "1.61.1",
  "qrcode-generator": "1.4.4",
  wrangler: "4.114.0"
})) {
  const declared = packageDocument.dependencies?.[name] ?? packageDocument.devDependencies?.[name];
  if (declared !== version) throw new Error(`direct dependency version mismatch: ${name}`);
  if (lockDocument.packages[`node_modules/${name}`]?.version !== version) {
    throw new Error(`locked dependency version mismatch: ${name}`);
  }
  if (!notices.includes(`| \`${name}\``) || !notices.includes(`| ${version} |`)) {
    throw new Error(`third-party notice missing direct dependency: ${name}`);
  }
}
console.log(`Apache-2.0 verification: PASS (${digest})`);
