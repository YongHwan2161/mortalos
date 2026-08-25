import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { canonicalBytes, encodeBase64Url } from "../src/index.mjs";
import { buildLab } from "./build-lab.mjs";
import { labMediaType } from "./lab-contract.mjs";

const execute = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPT_FORMAT = "mortalos.release-candidate/1";
const DIGEST_PATTERN = /^sha256:[A-Za-z0-9_-]{43}$/;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/;
const RECEIPT_NAME = "release-candidate.json";

function digest(bytes) {
  return `sha256:${encodeBase64Url(createHash("sha256").update(bytes).digest())}`;
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unexpected schema`);
  }
}

function validRelativePath(path) {
  return typeof path === "string" &&
    path.length > 0 &&
    path.length <= 512 &&
    !path.includes("\\") &&
    !path.startsWith("/") &&
    posix.normalize(path) === path &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

async function regularFiles(directory) {
  const found = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = resolve(current, entry.name);
      const path = relative(directory, absolute).replaceAll("\\", "/");
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) throw new Error(`release candidate contains a symbolic link: ${path}`);
      if (metadata.isDirectory()) await visit(absolute);
      else if (metadata.isFile()) found.push({ absolute, bytes: metadata.size, path });
      else throw new Error(`release candidate contains a non-regular entry: ${path}`);
    }
  }
  await visit(directory);
  return found.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

async function describeLabFiles(labDir) {
  return Promise.all((await regularFiles(labDir)).map(async (entry) => {
    const bytes = await readFile(entry.absolute);
    return {
      bytes: bytes.byteLength,
      path: `lab/${entry.path}`,
      sha256: digest(bytes)
    };
  }));
}

function validateFileEntries(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("release candidate files must be a non-empty array");
  }
  let prior = "";
  for (const [index, entry] of files.entries()) {
    exactKeys(entry, ["bytes", "path", "sha256"], `release candidate file ${index}`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`release candidate file ${index} has invalid byte length`);
    }
    if (!validRelativePath(entry.path) || !entry.path.startsWith("lab/")) {
      throw new Error(`release candidate file ${index} has invalid path`);
    }
    if (entry.path <= prior) throw new Error("release candidate file paths must be unique and sorted");
    if (!DIGEST_PATTERN.test(entry.sha256)) {
      throw new Error(`release candidate file ${index} has invalid digest`);
    }
    prior = entry.path;
  }
}

function validateReceipt(receipt) {
  exactKeys(
    receipt,
    ["candidate_digest", "files", "format", "lab_asset_digest", "source_commit", "source_tree"],
    "release candidate receipt"
  );
  if (receipt.format !== RECEIPT_FORMAT) throw new Error("release candidate format is unsupported");
  if (!GIT_OBJECT_PATTERN.test(receipt.source_commit)) throw new Error("release candidate source commit is invalid");
  if (!GIT_OBJECT_PATTERN.test(receipt.source_tree)) throw new Error("release candidate source tree is invalid");
  if (!DIGEST_PATTERN.test(receipt.lab_asset_digest)) throw new Error("release candidate lab asset digest is invalid");
  if (!DIGEST_PATTERN.test(receipt.candidate_digest)) throw new Error("release candidate digest is invalid");
  validateFileEntries(receipt.files);
  const { candidate_digest: claimed, ...payload } = receipt;
  if (digest(canonicalBytes(payload)) !== claimed) throw new Error("release candidate receipt digest mismatch");
}

async function validateLabManifest({ labDir, receipt }) {
  const manifestPath = resolve(labDir, "asset-manifest.json");
  const manifestBytes = await readFile(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes);
  } catch (error) {
    throw new Error("release candidate lab manifest is not valid JSON", { cause: error });
  }
  exactKeys(manifest, ["asset_digest", "files", "format", "source_commit"], "lab asset manifest");
  if (manifest.format !== "mortalos.lab-assets/1") throw new Error("lab asset manifest format is unsupported");
  if (manifest.source_commit !== receipt.source_commit) throw new Error("lab manifest source commit mismatch");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("lab asset manifest files must be a non-empty array");
  }
  let prior = "";
  for (const [index, entry] of manifest.files.entries()) {
    exactKeys(entry, ["media_type", "path", "sha256"], `lab asset ${index}`);
    if (!validRelativePath(entry.path) || entry.path <= prior) {
      throw new Error("lab asset paths must be valid, unique, and sorted");
    }
    if (entry.media_type !== labMediaType(entry.path) || !DIGEST_PATTERN.test(entry.sha256)) {
      throw new Error(`lab asset ${index} has invalid metadata`);
    }
    prior = entry.path;
  }
  const assets = { format: manifest.format, files: manifest.files };
  if (digest(canonicalBytes(assets)) !== manifest.asset_digest) throw new Error("lab asset digest mismatch");
  if (manifest.asset_digest !== receipt.lab_asset_digest) throw new Error("candidate and lab asset digests differ");
  if (!Buffer.from(canonicalBytes(manifest)).equals(manifestBytes)) {
    throw new Error("lab asset manifest is not canonically encoded");
  }

  const excluded = new Set(["_headers", "_routes.json", "asset-manifest.json"]);
  const actualAssets = (await regularFiles(labDir))
    .map((entry) => entry.path)
    .filter((path) => !excluded.has(path));
  const manifestPaths = manifest.files.map((entry) => entry.path);
  if (actualAssets.length !== manifestPaths.length || actualAssets.some((path, index) => path !== manifestPaths[index])) {
    throw new Error("lab asset manifest does not describe the exact deployable asset set");
  }
  for (const entry of manifest.files) {
    if (digest(await readFile(resolve(labDir, entry.path))) !== entry.sha256) {
      throw new Error(`lab asset digest mismatch: ${entry.path}`);
    }
  }
  return manifest;
}

export async function createReleaseCandidate({
  outdir = resolve(repositoryRoot, "dist/release-candidate"),
  sourceCommit,
  sourceTree
} = {}) {
  if (!GIT_OBJECT_PATTERN.test(sourceCommit ?? "")) throw new Error("sourceCommit must be a lowercase 40-character commit SHA");
  if (!GIT_OBJECT_PATTERN.test(sourceTree ?? "")) throw new Error("sourceTree must be a lowercase 40-character tree SHA");
  await rm(outdir, { force: true, recursive: true });
  await mkdir(outdir, { recursive: true });
  const labDir = resolve(outdir, "lab");
  const { manifest } = await buildLab({ outdir: labDir, sourceCommit });
  const payload = {
    files: await describeLabFiles(labDir),
    format: RECEIPT_FORMAT,
    lab_asset_digest: manifest.asset_digest,
    source_commit: sourceCommit,
    source_tree: sourceTree
  };
  const receipt = { ...payload, candidate_digest: digest(canonicalBytes(payload)) };
  await writeFile(resolve(outdir, RECEIPT_NAME), canonicalBytes(receipt));
  return { labDir, manifest, outdir, receipt };
}

export async function verifyReleaseCandidate({ directory, expectedCommit, expectedTree }) {
  if (!GIT_OBJECT_PATTERN.test(expectedCommit ?? "")) throw new Error("expectedCommit must be a lowercase 40-character commit SHA");
  if (!GIT_OBJECT_PATTERN.test(expectedTree ?? "")) throw new Error("expectedTree must be a lowercase 40-character tree SHA");
  const root = resolve(directory);
  if ((await lstat(root)).isSymbolicLink()) throw new Error("release candidate root cannot be a symbolic link");
  const rootEntries = await readdir(root, { withFileTypes: true });
  const rootNames = rootEntries.map((entry) => entry.name).sort();
  if (rootNames.length !== 2 || rootNames[0] !== "lab" || rootNames[1] !== RECEIPT_NAME) {
    throw new Error("release candidate root must contain exactly lab/ and release-candidate.json");
  }
  if (!rootEntries.find((entry) => entry.name === "lab")?.isDirectory() ||
      !rootEntries.find((entry) => entry.name === RECEIPT_NAME)?.isFile()) {
    throw new Error("release candidate root entries have invalid types");
  }
  const receiptBytes = await readFile(resolve(root, RECEIPT_NAME));
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes);
  } catch (error) {
    throw new Error("release candidate receipt is not valid JSON", { cause: error });
  }
  validateReceipt(receipt);
  if (!Buffer.from(canonicalBytes(receipt)).equals(receiptBytes)) {
    throw new Error("release candidate receipt is not canonically encoded");
  }
  if (receipt.source_commit !== expectedCommit) throw new Error("release candidate source commit mismatch");
  if (receipt.source_tree !== expectedTree) throw new Error("release candidate source tree mismatch");

  const actualFiles = await describeLabFiles(resolve(root, "lab"));
  if (JSON.stringify(actualFiles) !== JSON.stringify(receipt.files)) {
    throw new Error("release candidate files differ from the receipt");
  }
  const manifest = await validateLabManifest({ labDir: resolve(root, "lab"), receipt });
  return { labDir: resolve(root, "lab"), manifest, receipt };
}

async function gitValue(args) {
  return (await execute("git", args, { cwd: repositoryRoot })).stdout.trim();
}

async function main() {
  const command = process.argv[2];
  const directory = resolve(process.env.MORTALOS_RELEASE_CANDIDATE_DIR ?? "dist/release-candidate");
  const head = await gitValue(["rev-parse", "HEAD"]);
  const tree = await gitValue(["rev-parse", "HEAD^{tree}"]);
  const expectedCommit = process.env.MORTALOS_SOURCE_COMMIT ?? head;
  const expectedTree = process.env.MORTALOS_SOURCE_TREE ?? tree;
  if (expectedCommit !== head) throw new Error("expected release commit does not equal checked-out HEAD");
  if (expectedTree !== tree) throw new Error("expected release tree does not equal checked-out HEAD tree");
  if (command === "create") {
    const status = await gitValue(["status", "--porcelain=v1", "--untracked-files=all"]);
    if (status !== "") throw new Error("release candidate source has uncommitted files");
    const result = await createReleaseCandidate({ outdir: directory, sourceCommit: expectedCommit, sourceTree: expectedTree });
    console.log(`MortalOS release candidate: CREATED (${result.receipt.candidate_digest})`);
    console.log(`- source commit: ${expectedCommit}`);
    console.log(`- source tree: ${expectedTree}`);
    console.log(`- files: ${result.receipt.files.length}`);
    return;
  }
  if (command === "verify") {
    const result = await verifyReleaseCandidate({ directory, expectedCommit, expectedTree });
    console.log(`MortalOS release candidate: PASS (${result.receipt.candidate_digest})`);
    console.log(`- source commit: ${expectedCommit}`);
    console.log(`- source tree: ${expectedTree}`);
    console.log(`- files: ${result.receipt.files.length}`);
    return;
  }
  throw new Error("usage: node scripts/release-candidate.mjs <create|verify>");
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) await main();
