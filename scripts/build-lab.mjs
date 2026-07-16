import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import { labMediaType } from "./lab-contract.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function files(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !["_headers", "asset-manifest.json"].includes(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function digest(bytes) {
  return `sha256:${encodeBase64Url(createHash("sha256").update(bytes).digest())}`;
}

export async function buildLab({
  outdir = resolve(repositoryRoot, "dist/lab"),
  sourceCommit = process.env.MORTALOS_SOURCE_COMMIT ?? "local"
} = {}) {
  if (sourceCommit !== "local" && !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error("MORTALOS_SOURCE_COMMIT must be 'local' or a lowercase 40-character commit SHA");
  }
  await rm(outdir, { force: true, recursive: true });
  await mkdir(outdir, { recursive: true });
  const result = await build({
    absWorkingDir: repositoryRoot,
    entryPoints: {
      app: "lab/app.mjs",
      "custodian-worker": "lab/custodian-worker.mjs",
      "corpus-worker": "lab/corpus-worker.mjs"
    },
    outdir,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome120"],
    entryNames: "[name]",
    legalComments: "eof",
    minify: true,
    sourcemap: false,
    metafile: true,
    logLevel: "silent"
  });
  await Promise.all([
    copyFile(resolve(repositoryRoot, "lab/index.html"), resolve(outdir, "index.html")),
    copyFile(resolve(repositoryRoot, "lab/styles.css"), resolve(outdir, "styles.css")),
    copyFile(resolve(repositoryRoot, "lab/_headers"), resolve(outdir, "_headers")),
    copyFile(
      resolve(repositoryRoot, "lab/THIRD_PARTY_LICENSES.txt"),
      resolve(outdir, "THIRD_PARTY_LICENSES.txt")
    )
  ]);
  const assetEntries = await Promise.all((await files(outdir)).map(async (path) => ({
    media_type: labMediaType(path),
    path,
    sha256: digest(await readFile(resolve(outdir, path)))
  })));
  const assets = { format: "mortalos.lab-assets/1", files: assetEntries };
  const manifest = {
    ...assets,
    asset_digest: digest(canonicalBytes(assets)),
    source_commit: sourceCommit
  };
  await writeFile(resolve(outdir, "asset-manifest.json"), canonicalBytes(manifest));
  return {
    outdir,
    outputs: Object.keys(result.metafile.outputs).sort(),
    manifest
  };
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const result = await buildLab();
  console.log(`MortalOS Lab build: PASS (${result.outputs.length} bundled entries)`);
  console.log(`- ${result.outdir}`);
  console.log(`- asset digest: ${result.manifest.asset_digest}`);
  console.log(`- source commit: ${result.manifest.source_commit}`);
}
