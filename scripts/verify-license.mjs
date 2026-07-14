import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [license, packageText, lockText, contributing] = await Promise.all([
  readFile(new URL("LICENSE", root)),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("package-lock.json", root), "utf8"),
  readFile(new URL("CONTRIBUTING.md", root), "utf8")
]);
const digest = createHash("sha256").update(license).digest("hex");
const expected = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
if (digest !== expected) throw new Error(`Apache-2.0 text digest mismatch: ${digest}`);
if (JSON.parse(packageText).license !== "Apache-2.0") throw new Error("package.json license mismatch");
if (JSON.parse(lockText).packages[""].license !== "Apache-2.0") throw new Error("package-lock license mismatch");
if (!contributing.includes("Apache-2.0")) throw new Error("contribution terms do not identify Apache-2.0");
console.log(`Apache-2.0 verification: PASS (${digest})`);
