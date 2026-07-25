import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyS1Receipt } from "../scripts/verify-s1-receipt.mjs";

const receipt = JSON.parse(await readFile(
  new URL("../evidence/stages/s1-participant-core.json", import.meta.url),
  "utf8"
));

function mutate(path, value) {
  const copy = structuredClone(receipt);
  let target = copy;
  for (const segment of path.slice(0, -1)) target = target[segment];
  target[path.at(-1)] = value;
  return copy;
}

test("the committed S1 receipt is bound to its exact promoted snapshot and results", async () => {
  const result = await verifyS1Receipt();
  assert.equal(result.receipt.source_commit, receipt.source_commit);
  assert.equal(result.receipt.promotion_commit, receipt.promotion_commit);
  assert.equal(result.artifactCount, 24);
});

test("source, baseline, and promotion lineage substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["source_commit"], receipt.base_commit) }),
    /source commit mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["base_commit"], receipt.source_commit) }),
    /base commit mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["promotion_commit"], receipt.base_commit) }),
    /promotion commit mismatch/
  );
});

test("package, lock, and artifact digest substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["dependency_lock_digest"], `sha256:${"0".repeat(64)}`) }),
    /lock digest mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["package_digests", "package.json"], `sha256:${"0".repeat(64)}`) }),
    /package digest mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["artifact_digests", "lab/participant/core.mjs"], `sha256:${"0".repeat(64)}`) }),
    /committed S1 receipt digest mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(
        ["promotion_artifact_digests", "lab/participant/core.mjs"],
        `sha256:${"0".repeat(64)}`
      )
    }),
    /promotion artifact digest mismatch/
  );
});

test("same-cardinality artifact path substitution fails closed", async () => {
  const substituted = structuredClone(receipt);
  const digest = substituted.artifact_digests["docs/PARTICIPANT_CORE.md"];
  delete substituted.artifact_digests["docs/PARTICIPANT_CORE.md"];
  substituted.artifact_digests["README.md"] = digest;
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: substituted }),
    /artifact digest inventory mismatch/
  );
});

test("participant model count and digest substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(["results", "participant_model_parity", "seeded_schedules"], 9999)
    }),
    /structured results mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(
        ["results", "participant_model_parity", "result_digest"],
        `sha256:${"0".repeat(64)}`
      )
    }),
    /structured results mismatch/
  );
});

test("coverage and behavior-matrix substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(["results", "participant_core_coverage_percent", "branches"], 90)
    }),
    /structured results mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(["results", "behavior_matrix", "visible_fork"], "HOLD")
    }),
    /structured results mismatch/
  );
});

test("command and limitation substitutions fail closed", async () => {
  const command = structuredClone(receipt);
  command.commands[9] = structuredClone(command.commands[8]);
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: command }),
    /command records mismatch/
  );
  const limitations = structuredClone(receipt);
  limitations.known_limitations[4] = "A schema-valid replacement limitation that changes the S1 scope.";
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: limitations }),
    /limitations mismatch/
  );
});

test("contract, environment, and seed substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(["contracts", "operation"], "mortalos-participant-operation/2")
    })
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["environment", "timezone"], "UTC") }),
    /environment mismatch/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["seeds", "property_corpus"], 1) })
  );
});

test("validation cannot predate the frozen source", async () => {
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["started_at"], "2026-07-24T21:50:29.000Z") }),
    /started before the source was frozen/
  );
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["source_committed_at"], "2026-07-25T00:32:00.000Z") }),
    /started before the source was frozen/
  );
});

test("authority-boundary and stable-outcome substitutions fail closed", async () => {
  await assert.rejects(
    verifyS1Receipt({
      receiptOverride: mutate(
        ["results", "authority_boundary", "adapter_acceptance_or_head_selection_branches"],
        1
      )
    }),
    /structured results mismatch/
  );
  const outcomes = structuredClone(receipt);
  outcomes.results.stable_negative_outcomes[6] = "E_PORT_TIMEOUT";
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: outcomes }),
    /structured results mismatch/
  );
});

test("an otherwise-unmodeled receipt-byte change fails the frozen digest", async () => {
  await assert.rejects(
    verifyS1Receipt({ receiptOverride: mutate(["completed_at"], "2026-07-25T00:57:29.4493734Z") }),
    /committed S1 receipt digest mismatch/
  );
});
