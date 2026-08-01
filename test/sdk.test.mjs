import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as sdk from "../sdk/index.mjs";

test("S5 SDK exports only the reviewed authority-free surface", () => {
  assert.deepEqual(Object.keys(sdk).sort(), [
    "CONTINUITY_CAPSULE_FORMAT",
    "CUSTODY_LIMITS",
    "ContinuityCapsuleError",
    "PROTOCOL_PROFILE",
    "createContinuityCapsule",
    "createLineage",
    "createStatePackage",
    "createStatePackageInput",
    "isValidatedAcceptance",
    "recoverContinuityCapsuleQuorum",
    "validateGenesis",
    "validatePulse",
    "verifyContinuityCapsule",
    "verifyStatePackage"
  ]);
  assert.doesNotMatch(Object.keys(sdk).join(" "), /private|CryptoKey|decrypt|authority|store/i);
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
  assert.ok(paths.includes("sdk/index.mjs"));
  for (const forbidden of ["agents/", "docs/", "evidence/", "lab/", "scripts/", "test/", ".github/"]) {
    assert.equal(paths.some((path) => path.startsWith(forbidden)), false, forbidden);
  }
});
