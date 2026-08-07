import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as sdk from "../sdk/index.mjs";
import * as continuitySdk from "../sdk/continuity.mjs";
import * as resourceContractSdk from "../sdk/resource-contract.mjs";

test("S5 SDK exports only the reviewed authority-free surface", () => {
  assert.deepEqual(Object.keys(sdk).sort(), [
    "CONTINUITY_CAPSULE_FORMAT",
    "CONTINUITY_COPY_FORMAT",
    "CUSTODY_LIMITS",
    "ContinuityCapsuleError",
    "PROTOCOL_PROFILE",
    "RESOURCE_CONTRACT_LIMITS",
    "RESOURCE_FORMATS",
    "createContinuityCapsule",
    "createLineage",
    "createStatePackage",
    "createStatePackageInput",
    "evaluateResourceContract",
    "isValidatedAcceptance",
    "recoverContinuityCapsuleQuorum",
    "recoverContinuityCopyQuorum",
    "validateGenesis",
    "validatePulse",
    "verifyContinuityCapsule",
    "verifyContinuityCopy",
    "verifyResourceLease",
    "verifyResourceOffer",
    "verifyResourceRevocation",
    "verifyResourceUsageReceipt",
    "verifyStatePackage"
  ]);
  assert.doesNotMatch(Object.keys(sdk).join(" "), /private|CryptoKey|decrypt|authority|store/i);
});

test("resource-contract subpath exposes signing drafts without owning private authority", () => {
  assert.deepEqual(Object.keys(resourceContractSdk).sort(), [
    "RESOURCE_CONTRACT_LIMITS",
    "RESOURCE_FORMATS",
    "ResourceContractError",
    "derivePeerId",
    "evaluateResourceContract",
    "finalizeResourceLease",
    "finalizeResourceOffer",
    "finalizeResourceRevocation",
    "finalizeResourceUsageReceipt",
    "prepareResourceLease",
    "prepareResourceOffer",
    "prepareResourceRevocation",
    "prepareResourceUsageReceipt",
    "verifyResourceLease",
    "verifyResourceOffer",
    "verifyResourceRevocation",
    "verifyResourceUsageReceipt"
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
  assert.ok(paths.includes("sdk/index.mjs"));
  for (const forbidden of ["agents/", "docs/", "evidence/", "lab/", "scripts/", "test/", ".github/"]) {
    assert.equal(paths.some((path) => path.startsWith(forbidden)), false, forbidden);
  }
});
