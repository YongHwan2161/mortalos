import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { REJECTION_CODES } from "../src/rejection-codes.mjs";

const ROOT = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

const paths = {
  protocol: "docs/PROTOCOL.md",
  threatModel: "docs/THREAT_MODEL.md",
  rejectionCodes: "docs/REJECTION_CODES.md",
  traceability: "docs/TRACEABILITY.md",
  implementationPlan: "docs/IMPLEMENTATION_PLAN.md",
  projectStatus: "docs/PROJECT_STATUS.md",
  incubator: "docs/SINGLE_BROWSER_INCUBATOR.md",
  readme: "README.md",
  genesisSchema: "schemas/genesis.schema.json",
  pulseSchema: "schemas/pulse.schema.json",
  genesisExample: "examples/schema/genesis.valid.json",
  pulseExample: "examples/schema/pulse.valid.json",
  heartbeatPayloadExample: "examples/schema/heartbeat-payload.valid.json"
};

const entries = await Promise.all(
  Object.entries(paths).map(async ([name, path]) => [name, await read(path)])
);
const text = Object.fromEntries(entries);

const genesisSchema = JSON.parse(text.genesisSchema);
const pulseSchema = JSON.parse(text.pulseSchema);
const genesisExample = JSON.parse(text.genesisExample);
const pulseExample = JSON.parse(text.pulseExample);
const heartbeatPayloadExample = JSON.parse(text.heartbeatPayloadExample);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateGenesis = ajv.compile(genesisSchema);
const validatePulse = ajv.compile(pulseSchema);

assert(
  validateGenesis(genesisExample),
  `Genesis structural example failed schema: ${ajv.errorsText(validateGenesis.errors)}`
);
assert(
  validatePulse(pulseExample),
  `Pulse structural example failed schema: ${ajv.errorsText(validatePulse.errors)}`
);
assert(
  JSON.stringify(heartbeatPayloadExample) === "{}",
  "Heartbeat event-payload fixture must be the canonical empty object"
);

const heartbeatPayloadHash =
  "sha256:" +
  createHash("sha256")
    .update(Buffer.from("MORTALOS/V0/EVENT-PAYLOAD\0", "ascii"))
    .update(Buffer.from("{}", "utf8"))
    .digest("base64url");
assert(
  pulseExample.body.event.payload_hash === heartbeatPayloadHash,
  "Pulse heartbeat payload_hash does not bind the canonical payload fixture"
);

function mustReject(validate, candidate, label) {
  const accepted = validate(candidate);
  assert(!accepted, `${label} was unexpectedly accepted by its JSON Schema`);
}

{
  const candidate = clone(genesisExample);
  candidate.kind = "mortalos.unknown";
  mustReject(validateGenesis, candidate, "wrong Genesis kind");
}
{
  const candidate = clone(genesisExample);
  candidate.body.unknown = true;
  mustReject(validateGenesis, candidate, "unknown Genesis body field");
}
{
  const candidate = clone(genesisExample);
  candidate.body.genome_hash = 7;
  mustReject(validateGenesis, candidate, "wrong-type Genesis digest");
}
{
  const candidate = clone(genesisExample);
  delete candidate.approvals[0].signature;
  mustReject(validateGenesis, candidate, "malformed Genesis approval");
}
{
  const candidate = clone(pulseExample);
  candidate.body.sequence = 1;
  mustReject(validatePulse, candidate, "wrong-type Pulse sequence");
}
{
  const candidate = clone(pulseExample);
  candidate.body.event.kind = 1;
  mustReject(validatePulse, candidate, "wrong-type v0 event");
}
{
  const candidate = clone(pulseExample);
  delete candidate.approvals[0].signature;
  mustReject(validatePulse, candidate, "malformed Pulse approval");
}
{
  const candidate = clone(pulseExample);
  candidate.body.next_custodians[0].public_key = 1;
  mustReject(validatePulse, candidate, "wrong-type Pulse custodian key");
}

const lifecycleSections = [
  "### 4.4 Birth",
  "### 4.5 Identity",
  "### 4.6 Pulse",
  "### 4.7 Lineage",
  "### 4.8 Recognized head",
  "### 4.9 Continuity authority",
  "### 4.10 Authority-viable",
  "### 4.11 State-viable",
  "### 4.12 Alive",
  "### 4.13 Continuable",
  "### 4.14 State-stalled",
  "### 4.15 Dormant",
  "### 4.16 Partitioned",
  "### 4.17 Fork",
  "### 4.18 Latent successor",
  "### 4.19 Death",
  "### 4.20 Extinction",
  "### 4.21 Clone",
  "### 4.22 Descendant"
];
for (const section of lifecycleSections) {
  assert(text.protocol.includes(section), `Missing operational definition: ${section}`);
}

const domains = [
  "MORTALOS/V0/GENESIS-ID\\0",
  "MORTALOS/V0/GENESIS-APPROVAL\\0",
  "MORTALOS/V0/PULSE-ID\\0",
  "MORTALOS/V0/PULSE-APPROVAL\\0",
  "MORTALOS/V0/CUSTODY-ACCEPTANCE\\0",
  "MORTALOS/V0/CUSTODY-COMMITMENT\\0",
  "MORTALOS/V0/EVENT-PAYLOAD\\0",
  "MORTALOS/V0/PEER-ID\\0"
];
for (const domain of domains) {
  assert(text.protocol.includes(domain), `Missing domain separator: ${domain}`);
}

const genesisFields = [
  "`kind`",
  "`body.protocol_version`",
  "`body.hash_algorithm`",
  "`body.signature_algorithm`",
  "`body.genome_hash`",
  "`body.initial_state_root`",
  "`body.initial_custodians`",
  "`body.initial_quorum`",
  "`body.nonce`",
  "`approvals`"
];
const pulseFields = [
  "`body.organism_id`",
  "`body.sequence`",
  "`body.parent_hash`",
  "`body.current_custody_hash`",
  "`body.state_root`",
  "`body.event.kind`",
  "`body.event.payload_hash`",
  "`body.next_custodians`",
  "`body.next_quorum`",
  "`acceptances`"
];
for (const field of [...genesisFields, ...pulseFields]) {
  assert(text.protocol.includes(`| ${field} |`), `Missing field validation row: ${field}`);
}

const rejectionCodes = [
  ...text.rejectionCodes.matchAll(/\| `(E_[A-Z0-9_]+)` \|/g)
].map((match) => match[1]);
assert(
  new Set(rejectionCodes).size === rejectionCodes.length,
  "Duplicate rejection code detected"
);
assert(
  JSON.stringify([...rejectionCodes].sort()) === JSON.stringify([...REJECTION_CODES].sort()),
  "Documented rejection codes do not exactly match src/rejection-codes.mjs"
);
for (const code of [
  "E_EVENT_PAYLOAD_REQUIRED",
  "E_EVENT_PAYLOAD_INVALID",
  "E_EVENT_PAYLOAD_MISMATCH"
]) {
  assert(rejectionCodes.includes(code), `Missing event-payload rejection code: ${code}`);
}

for (let index = 1; index <= 13; index += 1) {
  const invariant = `INV-${index}`;
  const traceLine = text.traceability
    .split("\n")
    .find((line) => line.includes(`| \`${invariant}\``));
  assert(traceLine?.includes("T-P"), `${invariant} has no planned automated test mapping`);
}

const requiredThreatStatements = [
  "honest but fallible",
  "modified client intentionally persisting",
  "Silence is ambiguous",
  "Safety takes precedence over availability",
  "GPT-5.6 must not",
  "peer-to-peer execution and state authority",
  "event-payload sidecars",
  "state-stalled",
  "latent successor",
  "failure domain"
];
for (const statement of requiredThreatStatements) {
  assert(
    text.threatModel.toLowerCase().includes(statement.toLowerCase()),
    `Threat model is missing: ${statement}`
  );
}

const nextGateStatements = [
  "Next gate — C1 portable deterministic core",
  "Run one consensus implementation in Node.js and Chromium",
  "Portable modules import no `node:*` APIs",
  "Node and Chromium return byte-identical results",
  "any cross-runtime mismatch blocks the browser gate"
];
for (const statement of nextGateStatements) {
  assert(text.implementationPlan.includes(statement), `Implementation plan lost C1 rule: ${statement}`);
}

for (const statement of [
  "C0 trusted Node core verified; C1 portable deterministic core next",
  "| Single-browser incubator | Planned |",
  "The implementation counts unique eligible key IDs"
]) {
  assert(text.projectStatus.includes(statement), `Project status is missing: ${statement}`);
}

for (const statement of [
  "One process that holds two or three current keys can advance by itself.",
  "three logical custodian slots but one physical failure domain",
  "public evidence alone cannot create the next valid Pulse"
]) {
  assert(text.incubator.includes(statement), `Incubator profile is missing: ${statement}`);
}

assert(
  pulseSchema.$defs.event.properties.kind.type === "string" &&
    !JSON.stringify(pulseSchema).includes('"repair"') &&
    !JSON.stringify(pulseSchema).includes('"state-transition"'),
  "schema must delegate the v0 event vocabulary to semantic validation without enumerating removed events"
);
assert(
  text.protocol.includes("Global nonce freshness is **not** a validator predicate"),
  "Protocol still exposes globally unverifiable nonce freshness"
);
assert(
  text.protocol.includes("A state-stalled lineage may still authorize a heartbeat"),
  "Protocol does not resolve state-loss versus protocol-death semantics"
);
assert(
  text.protocol.includes("the exact canonical event-payload sidecar bytes"),
  "Validation context omits the event-payload sidecar"
);
assert(
  text.protocol.includes("Destroying current private keys does not invalidate signatures already produced"),
  "Protocol omits latent successor authority"
);

const currentDocLinks = [
  "PROJECT_STATUS.md",
  "IMPLEMENTATION_PLAN.md",
  "PROTOCOL.md",
  "THREAT_MODEL.md",
  "REJECTION_CODES.md",
  "TRACEABILITY.md",
  "SINGLE_BROWSER_INCUBATOR.md",
  "SUBMISSION_CHECKLIST.md"
];
for (const fileName of currentDocLinks) {
  assert(text.readme.includes(`docs/${fileName}`), `README does not link current document: ${fileName}`);
}

const removedLegacyDocs = [
  "BUILD_LOG.md",
  "CORE_VERIFICATION_REPORT.md",
  "CURRENT_AUDIT_2026-07-14.md",
  "DEVPOST_COMPLIANCE.md",
  "P0_VERIFICATION_REPORT.md"
];
const existingDocs = new Set(await readdir(new URL("docs/", ROOT)));
for (const fileName of removedLegacyDocs) {
  assert(!existingDocs.has(fileName), `Legacy document must remain removed: ${fileName}`);
  assert(!text.readme.includes(fileName), `README still references legacy document: ${fileName}`);
}

const markdownPaths = [
  "README.md",
  "CONTRIBUTING.md",
  ...[...existingDocs]
    .filter((fileName) => fileName.endsWith(".md"))
    .sort()
    .map((fileName) => `docs/${fileName}`)
];
let relativeLinkCount = 0;
for (const markdownPath of markdownPaths) {
  const markdown = await read(markdownPath);
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    try {
      await access(new URL(target, new URL(markdownPath, ROOT)));
    } catch {
      throw new Error(`Broken relative Markdown link in ${markdownPath}: ${match[1]}`);
    }
    relativeLinkCount += 1;
  }
}

console.log("MortalOS specification verification: PASS");
console.log(`- Schemas compiled: 2`);
console.log(`- Structural valid examples accepted: 2`);
console.log(`- Canonical event-payload fixtures bound: 1`);
console.log(`- Structural invalid mutations rejected: 8`);
console.log(`- Operational lifecycle definitions checked: ${lifecycleSections.length}`);
console.log(`- Domain separators checked: ${domains.length}`);
console.log(`- Message validation rows checked: ${genesisFields.length + pulseFields.length}`);
console.log(`- Unique rejection codes checked: ${rejectionCodes.length}`);
console.log(`- Invariant-to-test mappings checked: 13`);
console.log("- Threat-model boundary statements checked: 10");
console.log(`- Relative Markdown links checked: ${relativeLinkCount}`);
console.log("Document digests:");
for (const name of ["protocol", "threatModel", "rejectionCodes", "traceability"]) {
  console.log(`  ${paths[name]} sha256:${sha256(text[name])}`);
}
