import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildLab({ outdir = resolve(repositoryRoot, "dist/lab") } = {}) {
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
    copyFile(
      resolve(repositoryRoot, "lab/THIRD_PARTY_LICENSES.txt"),
      resolve(outdir, "THIRD_PARTY_LICENSES.txt")
    )
  ]);
  return {
    outdir,
    outputs: Object.keys(result.metafile.outputs).sort()
  };
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const result = await buildLab();
  console.log(`MortalOS Lab build: PASS (${result.outputs.length} bundled entries)`);
  console.log(`- ${result.outdir}`);
}
