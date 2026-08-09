import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as sdk from "../sdk/index.mjs";
import * as continuitySdk from "../sdk/continuity.mjs";
import * as placementSdk from "../sdk/placement.mjs";
import * as resourceContractSdk from "../sdk/resource-contract.mjs";

test("S5 SDK exports only the reviewed authority-free surface", () => {
  assert.deepEqual(Object.keys(sdk).sort(), [
    "CONFIDENTIAL_PLACEMENT_FORMATS",
    "CONTINUITY_CAPSULE_FORMAT",
    "CONTINUITY_COPY_FORMAT",
    "CUSTODY_LIMITS",
    "ContinuityCapsuleError",
    "LINEAGE_PLACEMENT_FORMATS",
    "LineagePlacementError",
    "PLACEMENT_LIVENESS_FORMATS",
    "PLACEMENT_LIVENESS_LIMITS",
    "PROTOCOL_PROFILE",
    "PlacementLivenessError",
    "RESOURCE_CONTRACT_LIMITS",
    "RESOURCE_EXECUTION_FORMATS",
    "RESOURCE_EXECUTION_LIMITS",
    "RESOURCE_FORMATS",
    "STORAGE_PLACEMENT_STATUS",
    "StoragePlacementError",
    "convergeLineagePlacementCommits",
    "createConfidentialPlacementJournal",
    "createConfidentialPlacementShardSet",
    "createContinuityCapsule",
    "createLineage",
    "createLineagePlacementGeneration",
    "createPlacementFailureCertificate",
    "createResourceContentCommitment",
    "createStatePackage",
    "createStatePackageInput",
    "deriveCommittedPlacementActionPlan",
    "evaluateConfidentialPlacementJournal",
    "evaluateConfidentialStoragePlacements",
    "evaluatePlacementLivenessEvidence",
    "evaluateResourceContract",
    "evaluateResourceExecutionContract",
    "evaluateStoragePlacements",
    "finalizePlacementLivenessChallenge",
    "finalizePlacementLivenessObservation",
    "finalizePlacementLivenessResponse",
    "isValidatedAcceptance",
    "planConfidentialStorageRepair",
    "preparePlacementLivenessChallenge",
    "preparePlacementLivenessObservation",
    "preparePlacementLivenessResponse",
    "reconstructConfidentialPackage",
    "recoverContinuityCapsuleQuorum",
    "recoverContinuityCopyQuorum",
    "restoreConfidentialPlacementJournal",
    "restoreLineagePlacementGeneration",
    "validateGenesis",
    "validatePulse",
    "verifyContinuityCapsule",
    "verifyContinuityCopy",
    "verifyLineagePlacementCommit",
    "verifyPlacementFailureCertificate",
    "verifyPlacementLivenessChallenge",
    "verifyPlacementLivenessObservation",
    "verifyPlacementLivenessResponse",
    "verifyResourceConsumptionAnnouncement",
    "verifyResourceConsumptionWitness",
    "verifyResourceExecutionChallenge",
    "verifyResourceExecutionReceipt",
    "verifyResourceLease",
    "verifyResourceOffer",
    "verifyResourceRevocation",
    "verifyResourceUsageReceipt",
    "verifyResourceUsageReceiptChain",
    "verifyStatePackage"
  ]);
  assert.equal(Object.keys(sdk).some((name) =>
    /^(?:sign|decrypt)|private|CryptoKey|authority|Store$/iu.test(name)), false);
});

test("placement subpath exports verifier policy without transport or signing authority", () => {
  assert.deepEqual(Object.keys(placementSdk).sort(), [
    "CONFIDENTIAL_PLACEMENT_FORMATS",
    "LINEAGE_PLACEMENT_FORMATS",
    "LineagePlacementError",
    "PLACEMENT_LIVENESS_FORMATS",
    "PLACEMENT_LIVENESS_LIMITS",
    "PlacementLivenessError",
    "STORAGE_PLACEMENT_STATUS",
    "StoragePlacementError",
    "convergeLineagePlacementCommits",
    "createConfidentialPlacementJournal",
    "createConfidentialPlacementShardSet",
    "createLineagePlacementGeneration",
    "createPlacementFailureCertificate",
    "deriveCommittedPlacementActionPlan",
    "evaluateConfidentialPlacementJournal",
    "evaluateConfidentialStoragePlacements",
    "evaluatePlacementLivenessEvidence",
    "evaluateStoragePlacements",
    "finalizePlacementLivenessChallenge",
    "finalizePlacementLivenessObservation",
    "finalizePlacementLivenessResponse",
    "planConfidentialStorageRepair",
    "preparePlacementLivenessChallenge",
    "preparePlacementLivenessObservation",
    "preparePlacementLivenessResponse",
    "reconstructConfidentialPackage",
    "restoreConfidentialPlacementJournal",
    "restoreLineagePlacementGeneration",
    "verifyLineagePlacementCommit",
    "verifyPlacementFailureCertificate",
    "verifyPlacementLivenessChallenge",
    "verifyPlacementLivenessObservation",
    "verifyPlacementLivenessResponse"
  ]);
  assert.equal(Object.keys(placementSdk).some((name) =>
    /^(?:sign|decrypt)|private|CryptoKey|network|Store$/iu.test(name)), false);
});

test("resource-contract subpath exposes signing drafts without owning private authority", () => {
  assert.deepEqual(Object.keys(resourceContractSdk).sort(), [
    "RESOURCE_CONTRACT_LIMITS",
    "RESOURCE_EXECUTION_FORMATS",
    "RESOURCE_EXECUTION_LIMITS",
    "RESOURCE_FORMATS",
    "ResourceContractError",
    "createResourceBandwidthExecutionResult",
    "createResourceComputeExecutionResult",
    "createResourceConsumptionAnnouncement",
    "createResourceContentCommitment",
    "createResourceStorageExecutionResult",
    "derivePeerId",
    "evaluateResourceContract",
    "evaluateResourceExecutionContract",
    "finalizeResourceConsumptionWitness",
    "finalizeResourceExecutionChallenge",
    "finalizeResourceExecutionReceipt",
    "finalizeResourceLease",
    "finalizeResourceOffer",
    "finalizeResourceRevocation",
    "finalizeResourceUsageReceipt",
    "prepareResourceConsumptionWitness",
    "prepareResourceExecutionChallenge",
    "prepareResourceExecutionReceipt",
    "prepareResourceLease",
    "prepareResourceOffer",
    "prepareResourceRevocation",
    "prepareResourceUsageReceipt",
    "verifyResourceConsumptionAnnouncement",
    "verifyResourceConsumptionWitness",
    "verifyResourceExecutionChallenge",
    "verifyResourceExecutionReceipt",
    "verifyResourceLease",
    "verifyResourceOffer",
    "verifyResourceRevocation",
    "verifyResourceUsageReceipt",
    "verifyResourceUsageReceiptChain"
  ]);
  assert.doesNotMatch(
    Object.keys(resourceContractSdk).join(" "),
    /private|CryptoKey|store|network|clock/i
  );
});

test("product continuity subpath exposes the complete capability-oriented API", () => {
  assert.deepEqual(Object.keys(continuitySdk.continuity).sort(), [
    "continue", "create", "handoff", "inspect", "recover"
  ]);
  assert.deepEqual(Object.keys(continuitySdk).sort(), [
    "CONTINUITY_HANDOFF_PROPOSAL_FORMAT",
    "CONTINUITY_HANDOFF_REQUEST_FORMAT",
    "CONTINUITY_RESULT_FORMAT",
    "CONTINUITY_SCENARIO_FORMAT",
    "CONTINUITY_SCENARIO_STEPS",
    "ContinuityError",
    "continueContinuity",
    "continuity",
    "createContinuity",
    "createContinuityAuthority",
    "describeContinuityAuthority",
    "handoffContinuity",
    "inspectContinuity",
    "recoverContinuity"
  ]);
});

test("S5 CLI is deterministic and the package tarball excludes lab and evidence internals", () => {
  const profile = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../cli/mortalos.mjs", import.meta.url)), "profile"],
    { encoding: "utf8" }
  );
  assert.equal(profile.status, 0, profile.stderr);
  assert.deepEqual(JSON.parse(profile.stdout), sdk.PROTOCOL_PROFILE);

  const packed = spawnSync(
    "npm pack --dry-run --json",
    [],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      shell: true
    }
  );
  assert.equal(packed.status, 0, packed.stderr);
  const report = JSON.parse(packed.stdout)[0];
  const paths = report.files.map(({ path }) => path);
  assert.ok(paths.includes("cli/mortalos.mjs"));
  assert.ok(paths.includes("cli/node-authority.mjs"));
  assert.ok(paths.includes("sdk/continuity.mjs"));
  assert.ok(paths.includes("sdk/resource-contract.mjs"));
  assert.ok(paths.includes("sdk/placement.mjs"));
  assert.ok(paths.includes("sdk/index.mjs"));
  for (const forbidden of ["agents/", "docs/", "evidence/", "lab/", "scripts/", "test/", ".github/"]) {
    assert.equal(paths.some((path) => path.startsWith(forbidden)), false, forbidden);
  }
});
