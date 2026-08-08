import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1)));
const temporary = await mkdtemp(join(tmpdir(), "mortalos-sdk-consumer-"));
const npm = "npm";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: options.shell ?? false
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function runJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options).trim());
}

function reject(command, args, code, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: options.shell ?? false
  });
  if (result.error) throw result.error;
  assert.notEqual(result.status, 0, `unexpected success: ${args.join(" ")}`);
  const error = JSON.parse(result.stderr.trim());
  assert.equal(error.status, "rejected");
  assert.equal(error.code, code);
}

try {
  const report = JSON.parse(run(npm, [
    "pack",
    "--json",
    "--pack-destination",
    temporary
  ], { shell: process.platform === "win32" }))[0];
  const archive = join(temporary, report.filename);
  assert.ok((await readFile(archive)).byteLength > 0);
  await writeFile(join(temporary, "package.json"), JSON.stringify({
    name: "mortalos-clean-consumer",
    private: true,
    type: "module"
  }), "utf8");
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], {
    cwd: temporary,
    shell: process.platform === "win32"
  });
  const output = run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core').then((m)=>console.log(JSON.stringify(Object.keys(m).sort())))"
  ], { cwd: temporary });
  const exports = JSON.parse(output.trim());
  assert.ok(exports.includes("verifyContinuityCapsule"));
  assert.equal(exports.some((name) => /private|authority|epochKey|decrypt/i.test(name)), false);
  const continuityOutput = run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core/continuity').then((m)=>console.log(JSON.stringify(Object.keys(m.continuity).sort())))"
  ], { cwd: temporary });
  assert.deepEqual(JSON.parse(continuityOutput.trim()), [
    "continue", "create", "handoff", "inspect", "recover"
  ]);
  const placementOutput = run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core/placement').then((m)=>console.log(JSON.stringify(Object.keys(m).sort())))"
  ], { cwd: temporary });
  assert.deepEqual(JSON.parse(placementOutput.trim()), [
    "CONFIDENTIAL_PLACEMENT_FORMATS",
    "STORAGE_PLACEMENT_STATUS",
    "StoragePlacementError",
    "createConfidentialPlacementJournal",
    "createConfidentialPlacementShardSet",
    "evaluateConfidentialPlacementJournal",
    "evaluateConfidentialStoragePlacements",
    "evaluateStoragePlacements",
    "planConfidentialStorageRepair",
    "reconstructConfidentialPackage",
    "restoreConfidentialPlacementJournal"
  ]);
  const resourceOutput = run(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { generateKeyPairSync, sign } from "node:crypto";
     import {
       createResourceConsumptionAnnouncement,
       createResourceComputeExecutionResult,
       derivePeerId,
       evaluateResourceContract,
       evaluateResourceExecutionContract,
       finalizeResourceExecutionChallenge,
       finalizeResourceExecutionReceipt,
       finalizeResourceConsumptionWitness,
       finalizeResourceLease,
       finalizeResourceOffer,
       finalizeResourceUsageReceipt,
       prepareResourceExecutionChallenge,
       prepareResourceExecutionReceipt,
       prepareResourceConsumptionWitness,
       prepareResourceLease,
       prepareResourceOffer,
       prepareResourceUsageReceipt,
       verifyResourceConsumptionAnnouncement
     } from "@mortal-os/core/resource-contract";
     const actor = () => {
       const { privateKey, publicKey } = generateKeyPairSync("ed25519");
       const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
       const public_key = "ed25519:" + Buffer.from(raw).toString("base64url");
       return { key_id: derivePeerId(public_key), privateKey, public_key };
     };
     const identity = ({ key_id, public_key }) => ({ key_id, public_key });
     const signature = (signer, message) =>
       "ed25519:" + Buffer.from(sign(null, message, signer.privateKey)).toString("base64url");
     const provider = actor();
     const consumer = actor();
     const witnessActors = Array.from({ length: 4 }, actor)
       .sort((left, right) => left.key_id < right.key_id ? -1 : 1);
     const witnesses = witnessActors.map(identity);
     const draft = prepareResourceOffer({
       capacity: {
         bandwidth: { burst_bytes: "0", egress_bytes_total: "0", ingress_bytes_total: "0", rate_bytes_per_second: "0" },
         compute: { concurrency: "1", cpu_millis_total: "10", memory_bytes: "1024", task_millis_max: "1000" },
         storage: { capacity_bytes: "1024", max_object_bytes: "1024" }
       },
       expires_at_ms: "2000",
       offer_nonce: "AAAAAAAAAAAAAAAAAAAAAA",
       provider: identity(provider),
       valid_from_ms: "1000",
       witness_policy: { max_faulty: 1, threshold: 3, witnesses }
     });
     const offer = finalizeResourceOffer({
       body: draft.body,
       provider_signature: signature(provider, draft.provider_signing_message)
     });
     const leaseDraft = prepareResourceLease({
       offer,
       body: {
         allocation: draft.body.capacity,
         consumer: identity(consumer),
         ends_at_ms: "1900",
         lease_nonce: "AQEBAQEBAQEBAQEBAQEBAQ",
         offer_id: draft.offer_id,
         starts_at_ms: "1100"
       }
     });
     const lease = finalizeResourceLease({
       offer,
       body: leaseDraft.body,
       consumer_signature: signature(consumer, leaseDraft.consumer_signing_message),
       provider_signature: signature(provider, leaseDraft.provider_signing_message)
     });
     const announcements = witnessActors.slice(0, 3).map((witness) => {
       const witnessDraft = prepareResourceConsumptionWitness({
         offer,
         lease,
         witness_key_id: witness.key_id
       });
       const witnessBytes = finalizeResourceConsumptionWitness({
         offer,
         lease,
         witness_key_id: witness.key_id,
         witness_signature: signature(witness, witnessDraft.signing_message)
       });
       return createResourceConsumptionAnnouncement({ offer, lease, witness: witnessBytes });
     });
     const opened = verifyResourceConsumptionAnnouncement(announcements[0]);
     const evaluated = evaluateResourceContract({
       consumption_announcements: announcements,
       offer,
       leases: [],
       observed_at_ms: "1200",
       revocations: [],
       usage_receipts: []
     });
     const challengeDraft = prepareResourceExecutionChallenge({
       offer,
       lease,
       previous_execution_receipts: [],
       usage_receipts: [],
       body: {
         challenge_nonce: "AgICAgICAgICAgICAgICAg",
         challenge_sequence: "0",
         consumption_id: evaluated.consumption_id,
         issued_at_ms: "1200",
         kind: "compute",
         lease_id: leaseDraft.lease_id,
         offer_id: draft.offer_id,
         previous_execution_receipt_id: null,
         workload: {
           algorithm: "sha256-chain/1",
           input_base64url: Buffer.from("packed external consumer").toString("base64url"),
           iterations: "8"
         }
       }
     });
     const challenge = finalizeResourceExecutionChallenge({
       offer,
       lease,
       previous_execution_receipts: [],
       usage_receipts: [],
       body: challengeDraft.body,
       consumer_signature: signature(consumer, challengeDraft.consumer_signing_message)
     });
     const usageDraft = prepareResourceUsageReceipt({
       offer,
       lease,
       previous_receipts: [],
       body: {
         lease_id: leaseDraft.lease_id,
         observed_at_ms: "1201",
         previous_receipt_id: null,
         receipt_sequence: "0",
         usage: {
           bandwidth: { egress_bytes_cumulative: "0", ingress_bytes_cumulative: "0" },
           compute: {
             concurrency_peak: "1",
             cpu_millis_cumulative: "1",
             memory_bytes_peak: "1",
             task_millis_peak: "1"
           },
           storage: { bytes_current: "0", bytes_peak: "0" }
         }
       }
     });
     const usage = finalizeResourceUsageReceipt({
       offer,
       lease,
       previous_receipts: [],
       body: usageDraft.body,
       consumer_signature: signature(consumer, usageDraft.consumer_signing_message),
       provider_signature: signature(provider, usageDraft.provider_signing_message)
     });
     const result = createResourceComputeExecutionResult({
       offer,
       lease,
       previous_execution_receipts: [],
       usage_receipts: [],
       challenge
     });
     const executionDraft = prepareResourceExecutionReceipt({
       offer,
       lease,
       previous_execution_receipts: [],
       usage_receipts: [usage],
       challenge,
       result
     });
     const execution = finalizeResourceExecutionReceipt({
       offer,
       lease,
       previous_execution_receipts: [],
       usage_receipts: [usage],
       challenge,
       result,
       consumer_signature: signature(consumer, executionDraft.consumer_signing_message),
       provider_signature: signature(provider, executionDraft.provider_signing_message)
     });
     const executionEvaluation = evaluateResourceExecutionContract({
       consumption_announcements: announcements,
       offer,
       leases: [lease],
       observed_at_ms: "1201",
       revocations: [],
       usage_receipts: [usage],
       execution_receipts: [execution]
     });
     console.log(JSON.stringify({
       announcement: opened.status,
       execution: executionEvaluation.execution_status,
       id: draft.offer_id,
       message: draft.provider_signing_message.byteLength,
       status: evaluated.status,
       witnesses: evaluated.witnesses_verified
     }));`
  ], { cwd: temporary });
  const resourceDraft = JSON.parse(resourceOutput.trim());
  assert.match(resourceDraft.id, /^resource-offer:/u);
  assert.equal(resourceDraft.message, 32);
  assert.equal(resourceDraft.announcement, "verified");
  assert.equal(resourceDraft.execution, "proved");
  assert.equal(resourceDraft.status, "active");
  assert.equal(resourceDraft.witnesses, 3);
  const blocked = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    "import('@mortal-os/core/src/confidential/package.mjs')"
  ], { cwd: temporary, encoding: "utf8" });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/u);

  const cli = join(
    temporary,
    "node_modules",
    "@mortal-os",
    "core",
    "cli",
    "mortalos.mjs"
  );
  const resource = randomBytes(98_317);
  const resourcePath = join(temporary, "actual-consumer-file.bin");
  const recoveredPath = join(temporary, "recovered-consumer-file.bin");
  const authorityA = join(temporary, "endpoint-a.key.json");
  const authorityB = join(temporary, "endpoint-b.key.json");
  const createdCapsule = join(temporary, "created.mosc");
  const handedCapsule = join(temporary, "handed.mosc");
  const continuedCapsule = join(temporary, "continued.mosc");
  const createdCopies = join(temporary, "created-copies");
  const handedCopies = join(temporary, "handed-copies");
  const continuedCopies = join(temporary, "continued-copies");
  const requestPath = join(temporary, "handoff-request.json");
  const proposalPath = join(temporary, "handoff-proposal.json");
  await writeFile(resourcePath, resource);

  const created = runJson(process.execPath, [
    cli, "create",
    "--resource", resourcePath,
    "--authority", authorityA,
    "--out", createdCapsule,
    "--copies", createdCopies
  ], { cwd: temporary });
  assert.equal(created.sequence, "1");
  const request = runJson(process.execPath, [
    cli, "handoff", "request",
    "--capsule", createdCapsule,
    "--authority", authorityB,
    "--out", requestPath
  ], { cwd: temporary });
  assert.equal(request.status, "handoff-requested");
  const proposed = runJson(process.execPath, [
    cli, "handoff", "propose",
    "--capsule", createdCapsule,
    "--authority", authorityA,
    "--request", requestPath,
    "--out", proposalPath
  ], { cwd: temporary });
  assert.equal(proposed.status, "handoff-proposed");
  const handed = runJson(process.execPath, [
    cli, "handoff", "accept",
    "--capsule", createdCapsule,
    "--authority", authorityB,
    "--proposal", proposalPath,
    "--out", handedCapsule,
    "--copies", handedCopies
  ], { cwd: temporary });
  assert.equal(handed.sequence, "2");
  assert.equal(handed.organism_id, created.organism_id);

  const corruptPath = join(temporary, "corrupt-copy.mosc");
  const corrupt = new Uint8Array(await readFile(join(handedCopies, "copy-1.mosc")));
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  await writeFile(corruptPath, corrupt);
  const recovered = runJson(process.execPath, [
    cli, "recover",
    "--authority", authorityB,
    "--expected-head", handed.head_hash,
    "--out-resource", recoveredPath,
    "--copy", corruptPath,
    "--copy", join(handedCopies, "copy-2.mosc"),
    "--copy", join(handedCopies, "copy-3.mosc")
  ], { cwd: temporary });
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.rejected_copies, 1);
  assert.equal(recovered.valid_copies, 2);
  assert.deepEqual(await readFile(recoveredPath), resource);

  const continued = runJson(process.execPath, [
    cli, "continue",
    "--authority", authorityB,
    "--capsule", handedCapsule,
    "--expected-head", handed.head_hash,
    "--resource", recoveredPath,
    "--out", continuedCapsule,
    "--copies", continuedCopies
  ], { cwd: temporary });
  assert.equal(continued.sequence, "3");
  assert.equal(continued.organism_id, created.organism_id);
  assert.notEqual(continued.head_hash, handed.head_hash);
  const inspected = runJson(process.execPath, [
    cli, "inspect", "--capsule", continuedCapsule
  ], { cwd: temporary });
  assert.equal(inspected.sequence, "3");
  assert.equal(inspected.resource_root, created.resource_root);

  reject(process.execPath, [
    cli, "recover",
    "--authority", authorityB,
    "--expected-head", handed.head_hash,
    "--out-resource", join(temporary, "one-copy.bin"),
    "--copy", join(handedCopies, "copy-2.mosc")
  ], "E_CONTINUITY_QUORUM", { cwd: temporary });
  reject(process.execPath, [
    cli, "recover",
    "--authority", authorityB,
    "--expected-head", handed.head_hash,
    "--out-resource", join(temporary, "duplicate-copy.bin"),
    "--copy", join(handedCopies, "copy-2.mosc"),
    "--copy", join(handedCopies, "copy-2.mosc")
  ], "E_CONTINUITY_DUPLICATE_COPY", { cwd: temporary });
  reject(process.execPath, [
    cli, "recover",
    "--authority", authorityB,
    "--expected-head", created.head_hash,
    "--out-resource", join(temporary, "stale.bin"),
    "--copy", join(handedCopies, "copy-1.mosc"),
    "--copy", join(handedCopies, "copy-2.mosc")
  ], "E_CONTINUITY_STALE_HEAD", { cwd: temporary });
  reject(process.execPath, [
    cli, "recover",
    "--authority", authorityA,
    "--expected-head", handed.head_hash,
    "--out-resource", join(temporary, "wrong-authority.bin"),
    "--copy", join(handedCopies, "copy-1.mosc"),
    "--copy", join(handedCopies, "copy-2.mosc")
  ], "E_CONTINUITY_AUTHORITY", { cwd: temporary });

  const authorityDocumentA = JSON.parse(await readFile(authorityA, "utf8"));
  const authorityDocumentB = JSON.parse(await readFile(authorityB, "utf8"));
  assert.notEqual(authorityDocumentA.custodian.key_id, authorityDocumentB.custodian.key_id);
  assert.ok(authorityDocumentA.private_pkcs8_base64url.length > 32);
  assert.ok(authorityDocumentB.private_pkcs8_base64url.length > 32);
  const exchanged = Buffer.concat(await Promise.all([
    createdCapsule,
    handedCapsule,
    continuedCapsule,
    requestPath,
    proposalPath,
    ...handed.copies
  ].map((path) => readFile(path))));
  assert.doesNotMatch(
    exchanged.toString("utf8"),
    /private_pkcs8_base64url|BEGIN PRIVATE KEY|CryptoKey/iu
  );

  console.log("MortalOS S5 clean package install and continuity CLI: PASS");
  console.log("- public API: create/inspect/handoff/recover/continue");
  console.log("- resource-contract subpath: external offer -> lease -> 3-of-4 witness gossip -> compute receipt proved PASS");
  console.log("- real external file: A handoff -> B 2-of-3 recovery -> B continuation");
console.log("- one corrupt copy tolerated; one copy, duplicate identity, stale head, and wrong authority rejected");
  console.log("- endpoint-local private keys absent from exchanged artifacts");
} finally {
  await rm(temporary, { force: true, recursive: true });
}
