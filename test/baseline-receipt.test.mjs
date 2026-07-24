import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyBaselineReceipt } from "../scripts/verify-baseline-receipt.mjs";

const receipt = JSON.parse(await readFile(
  new URL("../evidence/baseline/s0-baseline.json", import.meta.url),
  "utf8"
));

function mutate(path, value) {
  const copy = structuredClone(receipt);
  let target = copy;
  for (const segment of path.slice(0, -1)) target = target[segment];
  target[path.at(-1)] = value;
  return copy;
}

test("the committed S0 receipt is bound to its exact source snapshot and structured results", async () => {
  const result = await verifyBaselineReceipt();
  assert.equal(result.receipt.source_commit, receipt.source_commit);
  assert.equal(result.artifactCount, 10);
});

test("package and artifact digest substitutions fail closed", async () => {
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["package_digests", "package.json"], `sha256:${"0".repeat(64)}`)
    }),
    /package digest mismatch/
  );
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["artifact_digests", "README.md"], `sha256:${"0".repeat(64)}`)
    }),
    /artifact digest mismatch/
  );
});

test("source/base lineage substitutions fail closed", async () => {
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: mutate(["source_commit"], receipt.base_commit) }),
    /source commit is not a direct child/
  );
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: mutate(["base_commit"], receipt.source_commit) }),
    /source commit is not a direct child/
  );
});

test("structured result and command substitutions fail closed", async () => {
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["results", "property_cases", "accepted_or_rejected_as_expected"], 9999)
    })
  );
  const duplicate = structuredClone(receipt);
  duplicate.commands[7] = structuredClone(duplicate.commands[6]);
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: duplicate }),
    /duplicate baseline command/
  );
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["results", "tracking", "stage_issues"], [30, 31, 32])
    })
  );
});

test("temporal and inventory substitutions fail closed", async () => {
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["started_at"], "2026-07-24T18:29:59.000Z")
    }),
    /baseline started before the source was frozen/
  );
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(["results", "active_document_inventory"], ["README.md"])
    })
  );
});
