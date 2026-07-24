import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documents = [
  "README.md",
  "docs/README.md",
  "docs/CLAIM_MATRIX.md",
  "docs/STAGE_TRACKING.md",
  "docs/NORTH_STAR_ROADMAP.md",
  "docs/POST_HACKATHON_NORTH_STAR_IMPLEMENTATION_PLAN.md",
  "docs/archive/README.md",
  "docs/archive/BUILD_WEEK_EVIDENCE.md",
  "docs/archive/MULTI_BROWSER_DIGITAL_LIFE_UX_IMPLEMENTATION_PLAN.md",
  "docs/archive/SINGLE_BROWSER_INCUBATOR.md"
];
const external = new Set();
let localCount = 0;

for (const document of documents) {
  const source = await readFile(resolve(root, document), "utf8");
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (target.startsWith("#") || target.startsWith("mailto:")) continue;
    if (/^https:\/\//.test(target)) {
      external.add(target);
      continue;
    }
    assert.ok(!/^[a-z]+:/i.test(target), `${document} uses unsupported link scheme: ${target}`);
    const path = decodeURIComponent(target.split(/[?#]/u, 1)[0]);
    assert.ok(path, `${document} contains an empty local link`);
    await access(resolve(root, dirname(document), path));
    localCount += 1;
  }
}

if (process.env.MORTALOS_CHECK_EXTERNAL_LINKS === "1") {
  for (const target of external) {
    let response = await fetch(target, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (response.status === 405) {
      response = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    }
    assert.ok(response.ok, `external link ${target} returned HTTP ${response.status}`);
  }
}

console.log("MortalOS release-document link check: PASS");
console.log(`- local targets: ${localCount}`);
console.log(`- HTTPS targets: ${external.size}${process.env.MORTALOS_CHECK_EXTERNAL_LINKS === "1" ? " resolved" : " syntax-only"}`);
