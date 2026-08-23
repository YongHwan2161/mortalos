import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("../protocol/profile.v1.json", import.meta.url);
const outputUrl = new URL("../src/generated/protocol-profile.mjs", import.meta.url);
const profile = JSON.parse(await readFile(sourceUrl, "utf8"));

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

if (profile.format !== "mortalos-protocol-profile/1") {
  throw new Error("unsupported MortalOS protocol profile");
}
const livenessWitnesses = profile.placement_liveness?.witnesses_per_policy;
const offerWitnesses = profile.resource_contract?.witnesses_per_offer_max;
const certificateObservations = profile.placement_liveness?.observations_per_certificate;
const admissionObserverRoster = profile.placement_admission?.observer_roster_max;
if (
  !Number.isSafeInteger(livenessWitnesses) || livenessWitnesses < 1 ||
  !Number.isSafeInteger(offerWitnesses) || offerWitnesses < 1 ||
  livenessWitnesses !== offerWitnesses
) {
  throw new Error(
    "placement liveness and resource offer witness ceilings must be equal positive safe integers"
  );
}
if (
  !Number.isSafeInteger(admissionObserverRoster) || admissionObserverRoster < 1 ||
  admissionObserverRoster !== livenessWitnesses
) {
  throw new Error(
    "placement admission and liveness observer roster ceilings must be equal positive safe integers"
  );
}
if (
  !Number.isSafeInteger(profile.placement_admission?.members_per_epoch_max) ||
  profile.placement_admission.members_per_epoch_max < admissionObserverRoster ||
  profile.placement_admission.admission_evidence_per_epoch_max !==
    profile.placement_admission.members_per_epoch_max ||
  !Number.isSafeInteger(profile.placement_admission.attestation_challenge_bytes_max) ||
  profile.placement_admission.attestation_challenge_bytes_max < 16 ||
  !Number.isSafeInteger(profile.placement_admission.membership_epochs_per_generation_max) ||
  profile.placement_admission.membership_epochs_per_generation_max <
    profile.placement_liveness.certificates_per_evaluation +
      profile.placement_liveness.responses_per_evaluation ||
  !Number.isSafeInteger(profile.placement_admission.trust_roots_per_epoch_max) ||
  profile.placement_admission.trust_roots_per_epoch_max < 1 ||
  !Number.isSafeInteger(profile.placement_admission.trust_root_history_per_epoch_max) ||
  profile.placement_admission.trust_root_history_per_epoch_max <
    profile.placement_admission.trust_roots_per_epoch_max
) {
  throw new Error(
    "placement admission epochs must bound active/history roots, evidence, members, and the maximum liveness roster"
  );
}
if (
  !Number.isSafeInteger(certificateObservations) ||
  certificateObservations < livenessWitnesses
) {
  throw new Error(
    "placement failure certificates must hold the maximum resource offer witness roster"
  );
}
const journal = profile.placement_journal;
if (
  !journal ||
  journal.document_bytes !== 2 * 1024 * 1024 ||
  journal.epoch_nonce_bytes !== 32 ||
  journal.reproof_nonce_bytes !== 16 ||
  journal.head_transitions_max !== 4096 ||
  !Number.isSafeInteger(journal.high_waters_per_shard_max) ||
  journal.high_waters_per_shard_max < 1 ||
  journal.high_waters_total_max !== journal.high_waters_per_shard_max * 3
) {
  throw new Error(
    "placement journal limits must bind 256-bit epochs, 128-bit reproofs, 2 MiB documents, and three equal shard histories"
  );
}
const body = JSON.stringify(sorted(profile), null, 2)
  .replace(/"([^"\\]+)":/g, "$1:")
  .replace(/^(\s*)"([^"\\]*)"([,]?)$/gm, '$1"$2"$3');
const output = `// Generated from protocol/profile.v1.json. Run npm run generate:protocol-profile.\nconst profile = ${body};\n\nfunction deepFreeze(value) {\n  for (const child of Object.values(value)) {\n    if (child && typeof child === "object") deepFreeze(child);\n  }\n  return Object.freeze(value);\n}\n\nexport const PROTOCOL_PROFILE = deepFreeze(profile);\n`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputUrl, "utf8");
  if (existing !== output) throw new Error("generated protocol profile is stale");
} else {
  await writeFile(fileURLToPath(outputUrl), output);
}
