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

test("same-cardinality package inventory substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  substituted.package_digests = {
    "README.md": receipt.artifact_digests["README.md"]
  };
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: substituted }),
    /package digest inventory mismatch/
  );
});

test("same-cardinality active-document substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  substituted.results.active_document_inventory = substituted.results.active_document_inventory
    .map((path) => path === "docs/PROTOCOL.md" ? "docs/archive/README.md" : path);
  await assert.rejects(verifyBaselineReceipt({ receiptOverride: substituted }));
});

test("arbitrary known-limitations substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  substituted.results.known_limitations = [
    "arbitrary replacement limitation one with sufficient characters",
    "arbitrary replacement limitation two with sufficient characters",
    "arbitrary replacement limitation three with sufficient characters",
    "arbitrary replacement limitation four with sufficient characters"
  ];
  await assert.rejects(verifyBaselineReceipt({ receiptOverride: substituted }));
});

test("transport and quorum seed substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  substituted.seeds.transport_schedule = "another deterministic-looking transport corpus";
  substituted.seeds.quorum_trials = "another deterministic-looking quorum corpus";
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: substituted }),
    /baseline seeds mismatch/
  );
});

test("topology scope substitution fails closed", async () => {
  await assert.rejects(
    verifyBaselineReceipt({
      receiptOverride: mutate(
        ["topology_digest"],
        "not_applicable: S0 uses a different but schema-valid topology explanation"
      )
    }),
    /baseline topology scope mismatch/
  );
});

test("environment substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  substituted.environment = {
    os: "Linux",
    architecture: "arm64",
    node: "v22.99.0",
    npm: "10.99.0",
    chromium: "999.0.0.0",
    timezone: "UTC",
    cross_origin_isolated_lab: false
  };
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: substituted }),
    /baseline environment mismatch/
  );
});

test("any otherwise-unmodeled receipt-byte drift fails the frozen digest", async () => {
  const substituted = structuredClone(receipt);
  substituted.completed_at = "2026-07-24T18:55:34.427Z";
  await assert.rejects(
    verifyBaselineReceipt({ receiptOverride: substituted }),
    /committed baseline receipt digest mismatch/
  );
});
