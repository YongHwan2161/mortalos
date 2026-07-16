import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import { buildLab } from "./build-lab.mjs";
import { LAB_SECURITY_HEADERS } from "./lab-contract.mjs";

function digest(bytes) {
  return `sha256:${encodeBase64Url(createHash("sha256").update(bytes).digest())}`;
}

async function verifyOnce({ url, expectedCommit }) {
  const origin = new URL(url);
  assert.equal(origin.protocol, "https:", "deployed Lab must use HTTPS");
  assert.equal(origin.username, "");
  assert.equal(origin.password, "");
  assert.equal(origin.pathname, "/", "deployed Lab URL must name the canonical root");
  assert.equal(origin.search, "");
  assert.equal(origin.hash, "");
  assert.match(expectedCommit ?? "", /^[0-9a-f]{40}$/, "expected deployed commit must be exact");

  const directory = await mkdtemp(resolve(tmpdir(), "mortalos-lab-verify-"));
  try {
    const local = await buildLab({ outdir: directory, sourceCommit: expectedCommit });
    const rootResponse = await fetch(new URL("/", origin), { cache: "no-store", redirect: "error" });
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.headers.get("content-type") ?? "", /^text\/html(?:;|$)/);
    for (const [name, value] of Object.entries(LAB_SECURITY_HEADERS)) {
      assert.equal(rootResponse.headers.get(name), value, `root header ${name}`);
    }
    assert.deepEqual(
      new Uint8Array(await rootResponse.arrayBuffer()),
      new Uint8Array(await readFile(resolve(directory, "index.html"))),
      "root route must serve the exact built index"
    );

    const response = await fetch(new URL("asset-manifest.json", origin), {
      cache: "no-store",
      redirect: "error"
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    for (const [name, value] of Object.entries(LAB_SECURITY_HEADERS)) {
      assert.equal(response.headers.get(name), value, `manifest header ${name}`);
    }
    const remoteBytes = new Uint8Array(await response.arrayBuffer());
    const remote = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(remoteBytes));
    assert.deepEqual(remote, local.manifest);
    assert.deepEqual(remoteBytes, canonicalBytes(remote));
    assert.equal(remote.source_commit, expectedCommit);

    for (const asset of remote.files) {
      const assetResponse = await fetch(new URL(asset.path, origin), {
        cache: "no-store",
        redirect: "error"
      });
      assert.equal(assetResponse.status, 200, asset.path);
      const mediaType = asset.media_type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        assetResponse.headers.get("content-type") ?? "",
        new RegExp(`^${mediaType}(?:;|$)`),
        `${asset.path} content type`
      );
      for (const [name, value] of Object.entries(LAB_SECURITY_HEADERS)) {
        assert.equal(assetResponse.headers.get(name), value, `${asset.path} header ${name}`);
      }
      const bytes = new Uint8Array(await assetResponse.arrayBuffer());
      assert.equal(digest(bytes), asset.sha256, asset.path);
      assert.deepEqual(bytes, new Uint8Array(await readFile(resolve(directory, asset.path))), asset.path);
    }
    return {
      asset_digest: remote.asset_digest,
      assets: remote.files.length,
      source_commit: remote.source_commit
    };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function verifyDeployedLab({ url, expectedCommit, attempts = 1, retryDelayMs = 0 }) {
  assert.ok(
    Number.isSafeInteger(attempts) && attempts >= 1 && attempts <= 60,
    "deployment verification attempts must be 1..60"
  );
  assert.ok(
    Number.isSafeInteger(retryDelayMs) && retryDelayMs >= 0 && retryDelayMs <= 60_000,
    "deployment retry delay must be 0..60000ms"
  );
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await verifyOnce({ url, expectedCommit });
    } catch (error) {
      lastError = error;
      if (attempt < attempts && retryDelayMs > 0) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs));
      }
    }
  }
  throw lastError;
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const url = process.env.MORTALOS_LAB_URL;
  if (!url) throw new Error("MORTALOS_LAB_URL is required");
  const result = await verifyDeployedLab({
    url,
    expectedCommit: process.env.MORTALOS_EXPECTED_COMMIT,
    attempts: Number(process.env.MORTALOS_DEPLOY_VERIFY_ATTEMPTS ?? "1"),
    retryDelayMs: Number(process.env.MORTALOS_DEPLOY_VERIFY_DELAY_MS ?? "0")
  });
  console.log("MortalOS Lab H3B deployed artifact: PASS");
  console.log(`- ${result.assets} exact assets / ${result.asset_digest}`);
  console.log(`- source commit: ${result.source_commit}`);
}
