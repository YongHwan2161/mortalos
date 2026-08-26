import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { cp, mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createReleaseCandidate, verifyReleaseCandidate } from "../scripts/release-candidate.mjs";

const COMMIT = "1".repeat(40);
const TREE = "2".repeat(40);
let root;
let baseline;

async function cloneCandidate(name) {
  const target = resolve(root, name);
  await cp(baseline, target, { recursive: true });
  return target;
}

before(async () => {
  root = await mkdtemp(resolve(tmpdir(), "mortalos-release-candidate-"));
  baseline = resolve(root, "baseline");
  await createReleaseCandidate({ outdir: baseline, sourceCommit: COMMIT, sourceTree: TREE });
});

after(async () => {
  await rm(root, { force: true, recursive: true });
});

test("release candidate binds the exact deployable files, source commit, and source tree", async () => {
  const result = await verifyReleaseCandidate({ directory: baseline, expectedCommit: COMMIT, expectedTree: TREE });
  assert.equal(result.receipt.format, "mortalos.release-candidate/1");
  assert.equal(result.receipt.source_commit, COMMIT);
  assert.equal(result.receipt.source_tree, TREE);
  assert.equal(result.receipt.lab_asset_digest, result.manifest.asset_digest);
  assert.ok(result.receipt.files.length > 10);
  assert.deepEqual(
    [...result.receipt.files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    result.receipt.files
  );
});

test("release candidate rejects changed, added, and linked deployable files", async (t) => {
  await t.test("changed file", async () => {
    const candidate = await cloneCandidate("changed");
    await writeFile(resolve(candidate, "lab/index.html"), "changed");
    await assert.rejects(
      verifyReleaseCandidate({ directory: candidate, expectedCommit: COMMIT, expectedTree: TREE }),
      /files differ from the receipt/u
    );
  });

  await t.test("added file", async () => {
    const candidate = await cloneCandidate("added");
    await writeFile(resolve(candidate, "lab/unreviewed.js"), "unreviewed");
    await assert.rejects(
      verifyReleaseCandidate({ directory: candidate, expectedCommit: COMMIT, expectedTree: TREE }),
      /files differ from the receipt/u
    );
  });

  await t.test("symbolic link", async () => {
    const candidate = await cloneCandidate("linked");
    const external = resolve(root, "external");
    await mkdir(external, { recursive: true });
    await writeFile(resolve(external, "payload.js"), "unreviewed");
    await symlink(external, resolve(candidate, "lab/linked"), "junction");
    await assert.rejects(
      verifyReleaseCandidate({ directory: candidate, expectedCommit: COMMIT, expectedTree: TREE }),
      /symbolic link/u
    );
  });
});

test("release candidate rejects receipt substitution and non-canonical encoding", async (t) => {
  await t.test("digest mutation", async () => {
    const candidate = await cloneCandidate("receipt-digest");
    const path = resolve(candidate, "release-candidate.json");
    const receipt = JSON.parse(await readFile(path, "utf8"));
    receipt.candidate_digest = `sha256:${"A".repeat(43)}`;
    await writeFile(path, JSON.stringify(receipt));
    await assert.rejects(
      verifyReleaseCandidate({ directory: candidate, expectedCommit: COMMIT, expectedTree: TREE }),
      /receipt digest mismatch/u
    );
  });

  await t.test("non-canonical bytes", async () => {
    const candidate = await cloneCandidate("receipt-encoding");
    const path = resolve(candidate, "release-candidate.json");
    const receipt = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
    await assert.rejects(
      verifyReleaseCandidate({ directory: candidate, expectedCommit: COMMIT, expectedTree: TREE }),
      /not canonically encoded/u
    );
  });
});

test("release candidate rejects a different expected commit or tree", async () => {
  await assert.rejects(
    verifyReleaseCandidate({ directory: baseline, expectedCommit: "3".repeat(40), expectedTree: TREE }),
    /source commit mismatch/u
  );
  await assert.rejects(
    verifyReleaseCandidate({ directory: baseline, expectedCommit: COMMIT, expectedTree: "4".repeat(40) }),
    /source tree mismatch/u
  );
});

test("deployment consumes only the successful Verify run artifact", async () => {
  const deployment = await readFile(new URL("../.github/workflows/deploy-lab.yml", import.meta.url), "utf8");
  const verification = await readFile(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8");

  assert.match(deployment, /^  workflow_run:\n    workflows: \[Verify\]/m);
  assert.doesNotMatch(deployment, /^  (?:push|workflow_dispatch):/m);
  assert.match(deployment, /workflow_run\.conclusion == 'success'/);
  assert.match(deployment, /workflow_run\.event == 'push'/);
  assert.match(deployment, /workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(deployment, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(deployment, /name: mortalos-release-candidate-\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(deployment, /run: npm run verify:release-candidate/);
  assert.doesNotMatch(deployment, /run: npm test/);
  assert.doesNotMatch(deployment, /MORTALOS_(?:SOURCE|EXPECTED)_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(deployment, /wrangler deploy --env="" --config relay\/wrangler\.jsonc/);

  const verifyArtifact = verification.indexOf("run: npm run build:release-candidate");
  const uploadArtifact = verification.indexOf("uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
  assert.ok(verifyArtifact > 0 && verifyArtifact < uploadArtifact);
  assert.match(verification, /needs: \[browser-parity, protocol\]/);

  const downloadArtifact = deployment.indexOf("uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c");
  const candidateVerification = deployment.indexOf("run: npm run verify:release-candidate");
  const credentialGate = deployment.indexOf("- name: Require deployment credentials");
  const relayMutation = deployment.indexOf("npx wrangler deploy");
  assert.ok(downloadArtifact > 0 && downloadArtifact < candidateVerification);
  assert.ok(candidateVerification < credentialGate && credentialGate < relayMutation);
});
