import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
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
  replayEvidenceBundle
} from "../lab/evidence-export.mjs";
import {
  createGenesisBody,
  createHeartbeatBody,
  genesisEnvelope,
  pulseEnvelope
} from "../lab/live-incubator.mjs";
import { summarizePortableCorpus } from "../lab/corpus-summary.mjs";
import { runReferenceProof } from "../lab/reference-engine.mjs";

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
});

test("reference Lab derives lifecycle, mutation, fork, mortality, resurrection, and clone outcomes from the kernel", async () => {
  const [lifecycle, fork] = await Promise.all([fixture("lifecycle.json"), fixture("fork.json")]);
  const result = runReferenceProof({ lifecycle, fork });
  assert.equal(result.format, "mortalos-reference-proof/2");
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
  assert.match(result.mortality.qualification, /complete closed-fixture evidence inventory/);
  assert.equal(result.runtime_integrity.data_view_dispatch.aborted, true);
  assert.equal(
    result.runtime_integrity.data_view_dispatch.recovered,
    "latent_successor_not_dead"
  );
  assert.equal(result.runtime_integrity.sha256_state.aborted, true);
  assert.equal(
    result.runtime_integrity.sha256_state.recovered,
    "latent_successor_not_dead"
  );
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
    "reference-engine.mjs",
    "signing-policy.mjs"
  ];
  const sources = await Promise.all(files.map((name) => readFile(new URL(`../lab/${name}`, import.meta.url), "utf8")));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /\b(?:localStorage|sessionStorage|indexedDB|serviceWorker|caches\s*\.)\b/);
  assert.doesNotMatch(combined, /\bE_[A-Z0-9_]+\b/);
  const custodianSource = await readFile(new URL("../lab/custodian-worker.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(custodianSource, /@noble|privateKey\s*:/);
  assert.doesNotMatch(custodianSource, /request\.(?:context|message)/);
  assert.match(custodianSource, /deriveSigningRequest\(request\.operation, request\.body\)/);
  assert.match(combined, /generateKey\([\s\S]*?false,[\s\S]*?\["sign", "verify"\]/);
  assert.match(combined, /exportKey\("pkcs8", generated\.privateKey\)/);
  const referenceSource = await readFile(
    new URL("../lab/reference-engine.mjs", import.meta.url),
    "utf8"
  );
  const incubatorSource = await readFile(
    new URL("../lab/live-incubator.mjs", import.meta.url),
    "utf8"
  );
  assert.match(referenceSource, /latentEvidenceComplete: true/);
  assert.match(incubatorSource, /latentEvidenceComplete: false/);

  const serverSource = await readFile(new URL("../scripts/serve-lab.mjs", import.meta.url), "utf8");
  assert.match(serverSource, /"Cross-Origin-Embedder-Policy": "require-corp"/);
  assert.match(serverSource, /"Cross-Origin-Opener-Policy": "same-origin"/);
  assert.match(serverSource, /"Cross-Origin-Resource-Policy": "same-origin"/);

  const html = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /worker-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /THIRD_PARTY_LICENSES\.txt/);

  const bundledLicenses = await readFile(new URL("../lab/THIRD_PARTY_LICENSES.txt", import.meta.url), "utf8");
  assert.match(bundledLicenses, /@noble\/curves 2\.2\.0/);
  assert.match(bundledLicenses, /@noble\/hashes 2\.2\.0/);
  assert.match(bundledLicenses, /Permission is hereby granted, free of charge/);
});
