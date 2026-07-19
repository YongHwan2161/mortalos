import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  canonicalBytes,
  createLineage,
  derivePeerId,
  encodeBase64Url,
  genesisApprovalMessage,
  pulseApprovalMessage
} from "../src/index.mjs";
import {
  createEvidenceBundle,
  evidenceDigest,
  importEvidenceBundleBytes,
  LAB_EVIDENCE_MAX_BYTES,
  replayEvidenceBundle
} from "../lab/evidence-export.mjs";
import {
  createGenesisBody,
  createHeartbeatBody,
  genesisEnvelope,
  pulseEnvelope
} from "../lab/live-incubator.mjs";
import { MORTALOS_RELAY_ORIGIN, MORTALOS_SAFE_API_ORIGIN } from "../lab/runtime-endpoints.mjs";
import { summarizePortableCorpus } from "../lab/corpus-summary.mjs";
import { runReferenceProof } from "../lab/reference-engine.mjs";
import { buildLab } from "../scripts/build-lab.mjs";
import { pagesProjectExists, sanitizeWranglerDiagnostic } from "../scripts/deploy-lab.mjs";
import { LAB_SECURITY_HEADERS, labContentType, labMediaType } from "../scripts/lab-contract.mjs";
import { startLabServer } from "../scripts/serve-lab.mjs";
import { verifyDeployedLab } from "../scripts/verify-deployed-lab.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./vectors/${name}`, import.meta.url), "utf8"));
}

function actor() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  return { key_id: derivePeerId(public_key), public_key, privateKey };
}

function publicActor(value) {
  return { key_id: value.key_id, public_key: value.public_key };
}

function approval(value, message) {
  return { key_id: value.key_id, signature: `ed25519:${encodeBase64Url(sign(null, message, value.privateKey))}` };
}

function tagged(prefix, length, byte) {
  return `${prefix}${encodeBase64Url(new Uint8Array(length).fill(byte))}`;
}

test("H3A live builders submit one canonical heartbeat body to the existing lineage kernel", () => {
  const actors = Array.from({ length: 3 }, actor).sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  const body = createGenesisBody({
    custodians: actors.map(publicActor).reverse(),
    genomeHash: tagged("sha256:", 32, 41),
    stateRoot: tagged("sha256:", 32, 42),
    nonce: tagged("nonce:", 16, 43)
  });
  assert.deepEqual(body.initial_custodians.map((entry) => entry.key_id), actors.map((entry) => entry.key_id));
  assert.deepEqual(body.initial_quorum, { type: "threshold", threshold: 2 });

  const birth = genesisEnvelope(body, actors.map((entry) => approval(entry, genesisApprovalMessage(body))).reverse());
  const opened = createLineage(canonicalBytes(birth));
  assert.equal(opened.status, "accept");

  const heartbeatBody = createHeartbeatBody({ genesis: opened.lineage.genesis, parent: opened.lineage.head });
  const message = pulseApprovalMessage(heartbeatBody);
  const firstApproval = approval(actors[0], message);
  const oneKey = opened.lineage.verifyCandidate({
    envelopeBytes: canonicalBytes(pulseEnvelope(heartbeatBody, [firstApproval])),
    eventPayloadBytes: canonicalBytes({})
  });
  assert.equal(oneKey.code, "E_APPROVAL_INSUFFICIENT_QUORUM");

  const heartbeat = pulseEnvelope(heartbeatBody, [firstApproval, approval(actors[1], message)]);
  const accepted = opened.lineage.append({
    envelopeBytes: canonicalBytes(heartbeat),
    eventPayloadBytes: canonicalBytes({})
  });
  assert.equal(accepted.status, "accept");
  assert.equal(accepted.sequence, "1");
  assert.equal(accepted.organism_id, opened.lineage.genesis.organism_id);

  const replay = opened.lineage.append({
    envelopeBytes: canonicalBytes(heartbeat),
    eventPayloadBytes: canonicalBytes({})
  });
  assert.equal(replay.code, "E_REPLAY_STALE");
});

test("experimental Lab evidence contains canonical public bytes and replays from raw evidence", () => {
  const actors = Array.from({ length: 3 }, actor).sort((left, right) => left.key_id < right.key_id ? -1 : 1);
  const body = createGenesisBody({
    custodians: actors.map(publicActor),
    genomeHash: tagged("sha256:", 32, 51),
    stateRoot: tagged("sha256:", 32, 52),
    nonce: tagged("nonce:", 16, 53)
  });
  const birth = genesisEnvelope(body, actors.map((entry) => approval(entry, genesisApprovalMessage(body))));
  const opened = createLineage(canonicalBytes(birth));
  const heartbeatBody = createHeartbeatBody({ genesis: opened.lineage.genesis, parent: opened.lineage.head });
  const message = pulseApprovalMessage(heartbeatBody);
  const pulse = pulseEnvelope(heartbeatBody, actors.slice(0, 2).map((entry) => approval(entry, message)));
  assert.equal(opened.lineage.append({ envelopeBytes: canonicalBytes(pulse), eventPayloadBytes: canonicalBytes({}) }).status, "accept");

  const bundle = createEvidenceBundle([
    { kind: "genesis", envelope: birth },
    { kind: "pulse", envelope: pulse, payload: {} }
  ]);
  assert.equal(bundle.digest, evidenceDigest(bundle));
  assert.doesNotMatch(JSON.stringify(bundle), /private[_-]?key|acceptedContexts|next_custody_descriptor/i);

  const independentDigest = `sha256:${encodeBase64Url(createHash("sha256").update(canonicalBytes({
    format: bundle.format,
    protocol: bundle.protocol,
    records: bundle.records
  })).digest())}`;
  assert.equal(bundle.digest, independentDigest);

  const replayed = replayEvidenceBundle(bundle);
  assert.equal(replayed.status, "accept");
  assert.equal(replayed.organism_id, opened.lineage.genesis.organism_id);
  assert.equal(replayed.head_hash, opened.lineage.head.object_hash);
  assert.equal(replayed.accepted_objects, 2);

  const tampered = structuredClone(bundle);
  const encoded = tampered.records[0].envelope_base64url;
  tampered.records[0].envelope_base64url = `${encoded.slice(0, -1)}${encoded.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => replayEvidenceBundle(tampered), /digest mismatch/);
  assert.throws(() => replayEvidenceBundle({ ...bundle, private_key: "forbidden" }), /allowlisted/);

  const imported = importEvidenceBundleBytes(canonicalBytes(bundle));
  assert.equal(imported.replay.organism_id, opened.lineage.genesis.organism_id);
  assert.equal(imported.replay.head_hash, opened.lineage.head.object_hash);
  assert.equal(imported.replay.sequence, "1");

  const recalculate = (value) => ({ ...value, digest: evidenceDigest(value) });
  const flipLast = (value) => `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
  const tamperedEnvelope = structuredClone(bundle);
  tamperedEnvelope.records[1].envelope_base64url = flipLast(tamperedEnvelope.records[1].envelope_base64url);
  assert.throws(
    () => importEvidenceBundleBytes(canonicalBytes(recalculate(tamperedEnvelope))),
    /rejected|canonical|JSON/
  );
  const tamperedPayload = structuredClone(bundle);
  tamperedPayload.records[1].event_payload_base64url = flipLast(tamperedPayload.records[1].event_payload_base64url);
  assert.throws(
    () => importEvidenceBundleBytes(canonicalBytes(recalculate(tamperedPayload))),
    /rejected|canonical|JSON/
  );
  const unknown = recalculate({ ...bundle, format: "mortalos-lab-evidence/99" });
  assert.throws(() => importEvidenceBundleBytes(canonicalBytes(unknown)), /unsupported/);
  assert.throws(
    () => importEvidenceBundleBytes(new TextEncoder().encode('{"a":1,"a":2}')),
    /strict JSON/
  );
  assert.throws(
    () => importEvidenceBundleBytes(new TextEncoder().encode(JSON.stringify(bundle, null, 2))),
    /not canonical/
  );
  assert.throws(
    () => importEvidenceBundleBytes(new Uint8Array(LAB_EVIDENCE_MAX_BYTES + 1)),
    /2 MiB/
  );
});

test("reference Lab derives lifecycle, mutation, fork, mortality, resurrection, and clone outcomes from the kernel", async () => {
  const [lifecycle, fork] = await Promise.all([fixture("lifecycle.json"), fixture("fork.json")]);
  const result = runReferenceProof({ lifecycle, fork });
  assert.equal(result.steps.length, 3);
  assert.ok(result.steps.every((entry) => entry.status === "accept"));
  assert.equal(result.complete_initial_turnover, true);
  assert.deepEqual(result.replay, {
    status: "reject",
    code: "E_REPLAY_STALE",
    head_unchanged: true
  });
  assert.equal(result.mutations.identity.code, "E_ORGANISM_ID_MISMATCH");
  assert.equal(result.mutations.payload.code, "E_EVENT_PAYLOAD_MISMATCH");
  assert.equal(result.mutations.signature.code, "E_APPROVAL_SIGNATURE_INVALID");
  assert.equal(result.mutations.one_approval.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
  assert.equal(result.fork.first, "accept");
  assert.equal(result.fork.replay, "E_REPLAY_STALE");
  assert.equal(result.fork.sibling, "E_FORK_DETECTED");
  assert.equal(result.fork.equivocators, 1);
  assert.equal(result.fork.post_fork, "E_LINEAGE_ALREADY_FORKED");
  assert.equal(result.fork.head_after_fork, null);
  assert.equal(result.resurrection.code, "E_APPROVAL_INSUFFICIENT_QUORUM");
  assert.equal(result.mortality.status, "dead_under_v0_assumptions");
  assert.equal(result.mortality.latent_evidence_complete, true);
  assert.match(result.mortality.qualification, /closed fixture only/);
  assert.equal(result.clone.same_genome, true);
  assert.equal(result.clone.identity_separate, true);
});

test("Lab corpus adapter reads replay and fork outcomes from the portable result contract", () => {
  const portable = {
    format: "fixture",
    negative_cases: [{ pass: true }, { pass: true }],
    boundary_cases: { first: true, second: "expected-code" },
    adversarial: { cases: 10_000, rejected: 10_000 },
    fork_cases: { replay: "replay-code", sibling: "fork-code", post_fork: "halt-code" }
  };
  assert.deepEqual(summarizePortableCorpus(portable, portable), {
    exact: true,
    format: "fixture",
    named_passed: 2,
    named_total: 2,
    boundary_passed: 2,
    boundary_total: 2,
    adversarial_cases: 10_000,
    adversarial_rejected: 10_000,
    replay: "replay-code",
    fork: "fork-code",
    post_fork: "halt-code"
  });
});

test("browser Lab source fails closed and contains no persistence or copied validity logic", async () => {
  const files = [
    "app.mjs",
    "corpus-summary.mjs",
    "corpus-worker.mjs",
    "custodian-worker.mjs",
    "evidence-export.mjs",
    "live-incubator.mjs",
    "r1-client.mjs",
    "reference-engine.mjs",
    "runtime-endpoints.mjs",
    "signing-policy.mjs"
  ];
  const sources = await Promise.all(files.map((name) => readFile(new URL(`../lab/${name}`, import.meta.url), "utf8")));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /\b(?:localStorage|sessionStorage|indexedDB|serviceWorker|caches\s*\.)\b/);
  assert.doesNotMatch(combined, /\bE_[A-Z0-9_]+\b/);
  assert.doesNotMatch(combined, /\bcreateLineage\b|\.verifyCandidate\(|\.evaluateMortality\(/);
  const custodianSource = await readFile(new URL("../lab/custodian-worker.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(custodianSource, /@noble|privateKey\s*:/);
  assert.doesNotMatch(custodianSource, /request\.(?:context|message)/);
  assert.match(custodianSource, /deriveSigningRequest\(request\.operation, request\.body\)/);
  assert.match(combined, /generateKey\([\s\S]*?false,[\s\S]*?\["sign", "verify"\]/);
  assert.match(combined, /exportKey\("pkcs8", generated\.privateKey\)/);

  const durableSource = await readFile(new URL("../lab/participant/durable-participant.mjs", import.meta.url), "utf8");
  const durableStoreSource = await readFile(new URL("../lab/storage/durable-store.mjs", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../lab/app.mjs", import.meta.url), "utf8");
  assert.match(durableSource, /generateKey\(\{ name: "Ed25519" \}, false, \["sign", "verify"\]\)/);
  assert.match(durableSource, /initialQuorum: \{ type: "threshold", threshold: 1 \}/);
  assert.match(durableSource, /exportKey\("pkcs8", privateKey\)/);
  assert.match(durableSource, /pending !== null/);
  assert.match(durableStoreSource, /database\.transaction\(STORES, "readwrite", \{ durability: "strict" \}\)/);
  assert.match(durableStoreSource, /event\.oldVersion !== 0/);
  assert.doesNotMatch(durableStoreSource, /request\.oldVersion/);
  assert.match(durableStoreSource, /objectStore\("keys"\)\.delete\("active"\)/);
  assert.match(appSource, /if \(!byId\("durable-consent"\)\.checked\) throw/);

  const serverSource = await readFile(new URL("../scripts/serve-lab.mjs", import.meta.url), "utf8");
  assert.match(serverSource, /LAB_SECURITY_HEADERS, labContentType.*lab-contract\.mjs/);
  assert.equal(LAB_SECURITY_HEADERS["cache-control"], "no-store, no-transform");
  assert.equal(LAB_SECURITY_HEADERS["cross-origin-embedder-policy"], "require-corp");
  assert.equal(LAB_SECURITY_HEADERS["cross-origin-opener-policy"], "same-origin");
  assert.equal(LAB_SECURITY_HEADERS["cross-origin-resource-policy"], "same-origin");
  assert.equal(
    LAB_SECURITY_HEADERS["content-security-policy"].includes(`connect-src 'self' ${MORTALOS_SAFE_API_ORIGIN}`),
    true
  );

  const deploymentHeaders = await readFile(new URL("../lab/_headers", import.meta.url), "utf8");
  assert.match(deploymentHeaders, /Cache-Control: no-store, no-transform/);
  assert.match(deploymentHeaders, /Cross-Origin-Embedder-Policy: require-corp/);
  assert.match(deploymentHeaders, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(deploymentHeaders, /Content-Security-Policy: default-src 'none'/);
  assert.match(deploymentHeaders, new RegExp(`connect-src 'self' ${MORTALOS_SAFE_API_ORIGIN.replaceAll(".", "\\.")}`));

  const deploymentSource = await readFile(new URL("../scripts/deploy-lab.mjs", import.meta.url), "utf8");
  assert.match(deploymentSource, /\["rev-parse", "HEAD"\]/);
  assert.match(deploymentSource, /\["status", "--porcelain=v1", "--untracked-files=all"\]/);
  assert.match(deploymentSource, /const branch = "main"/);

  const gptVerifierSource = await readFile(new URL("../scripts/verify-gpt-scenarios.mjs", import.meta.url), "utf8");
  assert.match(gptVerifierSource, /remote batch evaluation is disabled/);
  assert.doesNotMatch(gptVerifierSource, /fetch\(scenarioApiUrl/);

  const deploymentWorkflow = await readFile(new URL("../.github/workflows/deploy-lab.yml", import.meta.url), "utf8");
  assert.match(deploymentWorkflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(deploymentWorkflow, /test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/);
  assert.doesNotMatch(deploymentWorkflow, /^      CLOUDFLARE_(?:ACCOUNT_ID|API_TOKEN):/m);
  assert.equal((deploymentWorkflow.match(/^          CLOUDFLARE_ACCOUNT_ID:/gm) ?? []).length, 3);
  assert.equal((deploymentWorkflow.match(/^          CLOUDFLARE_API_TOKEN:/gm) ?? []).length, 3);
  assert.equal((deploymentWorkflow.match(/^          OPENAI_API_KEY:/gm) ?? []).length, 0);
  assert.equal((deploymentWorkflow.match(/^          SAFETY_IDENTIFIER_SECRET:/gm) ?? []).length, 0);
  assert.equal((deploymentWorkflow.match(/^          TURNSTILE_SECRET_KEY:/gm) ?? []).length, 0);
  assert.match(deploymentWorkflow, /wrangler deploy --config relay\/wrangler\.jsonc/);
  assert.match(deploymentWorkflow, /npm run verify:release/);
  const chromiumInstall = deploymentWorkflow.indexOf("npx playwright install --with-deps chromium");
  const sourceVerification = deploymentWorkflow.indexOf("run: npm test");
  const relayDeployment = deploymentWorkflow.indexOf("npx wrangler deploy --config relay/wrangler.jsonc");
  const staticDeployment = deploymentWorkflow.indexOf("run: npm run deploy:lab");
  const publicVerification = deploymentWorkflow.indexOf("run: npm run verify:release");
  assert.ok(chromiumInstall > 0);
  assert.equal(deploymentWorkflow.indexOf("npx playwright install --with-deps chromium", chromiumInstall + 1), -1);
  assert.ok(chromiumInstall < sourceVerification);
  assert.ok(sourceVerification < relayDeployment);
  assert.ok(relayDeployment < staticDeployment);
  assert.ok(staticDeployment < publicVerification);
  assert.match(deploymentWorkflow, /^      MORTALOS_SOURCE_COMMIT: \$\{\{ github\.sha \}\}$/m);
  for (const remoteOnlyVariable of [
    "MORTALOS_EXPECTED_COMMIT",
    "MORTALOS_LAB_URL",
    "MORTALOS_DEPLOY_VERIFY_ATTEMPTS",
    "MORTALOS_DEPLOY_VERIFY_DELAY_MS"
  ]) {
    assert.doesNotMatch(deploymentWorkflow, new RegExp(`^      ${remoteOnlyVariable}:`, "m"));
  }
  const publicVerificationStep = deploymentWorkflow.slice(
    deploymentWorkflow.lastIndexOf("- name: Verify public artifact, relay, and bilingual judge path")
  );
  assert.match(publicVerificationStep, /^          MORTALOS_EXPECTED_COMMIT: \$\{\{ github\.sha \}\}$/m);
  assert.match(publicVerificationStep, /^          MORTALOS_LAB_URL: https:\/\/mortal-os\.com$/m);
  assert.match(publicVerificationStep, /^          MORTALOS_DEPLOY_VERIFY_ATTEMPTS: 12$/m);
  assert.match(publicVerificationStep, /^          MORTALOS_DEPLOY_VERIFY_DELAY_MS: 5000$/m);
  assert.ok(
    publicVerificationStep.indexOf("MORTALOS_LAB_URL") <
      publicVerificationStep.indexOf("run: npm run verify:release")
  );
  assert.doesNotMatch(deploymentWorkflow, /^      OPENAI_API_KEY:/m);
  assert.doesNotMatch(deploymentWorkflow, /^      SAFETY_IDENTIFIER_SECRET:/m);
  assert.doesNotMatch(deploymentWorkflow, /^      TURNSTILE_SECRET_KEY:/m);
  for (const workflow of [
    deploymentWorkflow,
    await readFile(new URL("../.github/workflows/verify.yml", import.meta.url), "utf8")
  ]) {
    const actions = [...workflow.matchAll(/^\s+uses:\s+(actions\/(?:checkout|setup-node)@[0-9a-f]+)(?:\s+#.*)?$/gm)]
      .map((match) => match[1]);
    assert.deepEqual(actions, [
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
    ]);
    assert.match(workflow, /uses: actions\/checkout@[0-9a-f]+ # v4\.3\.1\n        with:\n          persist-credentials: false/);
  }

  const html = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
  assert.match(html, new RegExp(`connect-src 'self' ${MORTALOS_SAFE_API_ORIGIN.replaceAll(".", "\\.")}`));
  assert.match(html, /worker-src 'self'/);
  assert.deepEqual(
    [...new Set(html.match(/https?:\/\/[^"'\s;]+/g) ?? [])].sort(),
    [
      "https://challenges.cloudflare.com",
      "https://mortal-os.com/",
      "https://mortal-os.com/ko/",
      MORTALOS_RELAY_ORIGIN,
      MORTALOS_SAFE_API_ORIGIN
    ].sort()
  );
  assert.match(html, /THIRD_PARTY_LICENSES\.txt/);
  assert.match(html, /pending-evidence inventory is explicitly complete/);

  const liveSource = await readFile(new URL("../lab/live-incubator.mjs", import.meta.url), "utf8");
  assert.match(liveSource, /authorityLossIrreversible:\s*false,\s*latentEvidenceComplete:\s*false/);
  assert.match(liveSource, /r1ValidateGenesis|r1VerifyCandidate|r1AppendCandidates|r1EvaluateMortality/);
  const referenceSource = await readFile(new URL("../lab/reference-engine.mjs", import.meta.url), "utf8");
  assert.match(referenceSource, /authorityLossIrreversible:\s*true,\s*latentEvidenceComplete:\s*true/);
  assert.match(referenceSource, /r1ValidateGenesis|r1VerifyCandidate|r1AppendCandidates|r1EvaluateMortality/);

  const bundledLicenses = await readFile(new URL("../lab/THIRD_PARTY_LICENSES.txt", import.meta.url), "utf8");
  assert.match(bundledLicenses, /@noble\/curves 2\.2\.0/);
  assert.match(bundledLicenses, /@noble\/hashes 2\.2\.0/);
  assert.match(bundledLicenses, /qrcode-generator 1\.4\.4/);
  assert.match(bundledLicenses, /Permission is hereby granted, free of charge/);
});

test("H3B build binds every served asset, MIME type, security header, and source commit", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "mortalos-lab-contract-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const sourceCommit = "a".repeat(40);
  const { manifest } = await buildLab({ outdir: directory, sourceCommit });
  const manifestBytes = new Uint8Array(await readFile(resolve(directory, "asset-manifest.json")));
  assert.deepEqual(manifestBytes, canonicalBytes(manifest));
  assert.equal(manifest.source_commit, sourceCommit);
  assert.deepEqual(
    manifest.files.map((entry) => entry.path),
    [...manifest.files.map((entry) => entry.path)].sort()
  );
  assert.ok(manifest.files.length >= 6);
  assert.ok(!manifest.files.some((entry) => ["_headers", "asset-manifest.json"].includes(entry.path)));
  for (const asset of manifest.files) {
    const bytes = await readFile(resolve(directory, asset.path));
    assert.equal(asset.media_type, labMediaType(asset.path));
    assert.equal(
      asset.sha256,
      `sha256:${encodeBase64Url(createHash("sha256").update(bytes).digest())}`
    );
  }
  assert.equal(
    manifest.files.find((entry) => entry.path === "app.js")?.media_type,
    "application/javascript",
    "the manifest must match Cloudflare Pages' canonical JavaScript MIME"
  );
  assert.equal(labContentType("app.js"), "application/javascript; charset=utf-8");
  const assets = { format: manifest.format, files: manifest.files };
  assert.equal(
    manifest.asset_digest,
    `sha256:${encodeBase64Url(createHash("sha256").update(canonicalBytes(assets)).digest())}`
  );

  const headerSource = await readFile(resolve(directory, "_headers"), "utf8");
  for (const [name, value] of Object.entries(LAB_SECURITY_HEADERS)) {
    const headerName = name.split("-")
      .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join("-");
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(headerSource, new RegExp(`^  ${headerName}: ${escaped}$`, "m"));
  }

  const server = await startLabServer({ directory });
  try {
    for (const asset of manifest.files) {
      const response = await fetch(new URL(asset.path, `${server.url}/`));
      assert.equal(response.status, 200, asset.path);
      const escapedMediaType = asset.media_type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        response.headers.get("content-type") ?? "",
        new RegExp(`^${escapedMediaType}(?:;|$)`)
      );
      for (const [name, value] of Object.entries(LAB_SECURITY_HEADERS)) {
        assert.equal(response.headers.get(name), value, `${asset.path} ${name}`);
      }
    }
  } finally {
    await server.close();
  }
  await assert.rejects(
    buildLab({ outdir: directory, sourceCommit: "not-a-commit" }),
    /lowercase 40-character commit SHA/
  );
});

test("H3B remote verifier rejects any deployed byte or contract substitution", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "mortalos-lab-remote-contract-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const sourceCommit = "b".repeat(40);
  const { manifest } = await buildLab({ outdir: directory, sourceCommit });
  const originalFetch = globalThis.fetch;
  const requestedPaths = [];
  let tamperedPath = null;
  globalThis.fetch = async (url) => {
    const pathname = new URL(url).pathname;
    requestedPaths.push(pathname);
    if (pathname === "/index.html") {
      return new Response(null, { status: 308, headers: { location: "/" } });
    }
    const path = pathname.slice(1) || "index.html";
    const bytes = new Uint8Array(await readFile(resolve(directory, path)));
    if (path === tamperedPath) bytes[0] ^= 1;
    return new Response(bytes, {
      status: 200,
      headers: {
        ...LAB_SECURITY_HEADERS,
        "content-type": labContentType(path)
      }
    });
  };
  try {
    const result = await verifyDeployedLab({
      url: "https://mortalos.example/",
      expectedCommit: sourceCommit
    });
    assert.deepEqual(result, {
      asset_digest: manifest.asset_digest,
      assets: manifest.files.length,
      source_commit: sourceCommit
    });
    assert.equal(requestedPaths.includes("/index.html"), false);
    assert.ok(
      requestedPaths.filter((path) => path === "/").length >= 2,
      "manifest index.html bytes must be verified at the canonical root"
    );
    tamperedPath = manifest.files[0].path;
    await assert.rejects(verifyDeployedLab({
      url: "https://mortalos.example/",
      expectedCommit: sourceCommit
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("H3B Cloudflare project discovery is idempotent and fails closed on schema drift", () => {
  const project = (name) => ({
    "Project Name": name,
    "Project Domains": `${name}.pages.dev`,
    "Git Provider": "No",
    "Last Modified": "a minute ago"
  });
  assert.equal(
    pagesProjectExists(JSON.stringify([
      project("another-pages-project"),
      project("mortalos-lab-yonghwan2161")
    ]), "mortalos-lab-yonghwan2161"),
    true
  );
  assert.equal(
    pagesProjectExists(JSON.stringify([
      project("another-pages-project")
    ]), "mortalos-lab-yonghwan2161"),
    false
  );
  assert.throws(
    () => pagesProjectExists(JSON.stringify([
      { name: "mortalos-lab-yonghwan2161" }
    ]), "mortalos-lab-yonghwan2161"),
    /unexpected schema/
  );
  assert.throws(
    () => pagesProjectExists("{", "mortalos-lab-yonghwan2161"),
    /did not return valid JSON/
  );
});

test("H3B Pages deployment uses the provisioned D1 database and a strict migration", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const relayConfig = JSON.parse(
    await readFile(new URL("../relay/wrangler.jsonc", import.meta.url), "utf8")
  );
  assert.equal("ratelimits" in config, false);
  assert.equal("observability" in config, false);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(config.placement, { mode: "targeted", region: "aws:us-east-1" });
  assert.deepEqual(config.vars, {
    ENVIRONMENT: "production",
    GPT_DAILY_REQUEST_CAP: "50",
    GPT_GLOBAL_MINUTE_CAP: "5",
    GPT_SCENARIOS_ENABLED: "false",
    TURNSTILE_EXPECTED_HOSTNAME: "mortal-os.com"
  });
  assert.deepEqual(relayConfig.observability, {
    enabled: true,
    logs: { enabled: true, head_sampling_rate: 1, invocation_logs: true },
    traces: { enabled: true, head_sampling_rate: 0.1 }
  });
  assert.deepEqual(config.d1_databases, [{
    binding: "SCENARIO_RATE_DB",
    database_name: "mortalos-lab-rate-limit",
    database_id: "d3010cc7-fba4-42ad-8b16-b54e8f777a04",
    migrations_dir: "migrations"
  }]);

  const migration = await readFile(
    new URL("../migrations/0001_scenario_rate_limits.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS scenario_rate_limits/);
  assert.match(migration, /actor_key TEXT PRIMARY KEY NOT NULL/);
  assert.match(migration, /request_count INTEGER NOT NULL CHECK \(request_count >= 1\)/);
  assert.match(migration, /\) STRICT;/);

  const deployment = await readFile(new URL("../scripts/deploy-lab.mjs", import.meta.url), "utf8");
  assert.match(deployment, /"d1", "migrations", "apply", database, "--remote"/);
  assert.match(deployment, /name: "TURNSTILE_SECRET_KEY"/);
  assert.match(deployment, /process\.env\.TURNSTILE_SECRET_KEY/);
  assert.match(deployment, /if \(gptEnabled\)/);
  assert.doesNotMatch(deployment, /process\.(?:stdout|stderr)\.write\(deployment\.(?:stdout|stderr)\)/);
  const secret = "test-secret-value-that-must-not-escape";
  const diagnostic = sanitizeWranglerDiagnostic(
    `failed for ${secret}; Authorization: Bearer another-sensitive-token-value`,
    [secret]
  );
  assert.doesNotMatch(diagnostic, /test-secret-value|another-sensitive-token/);
  assert.match(diagnostic, /\[REDACTED\]/);
});
