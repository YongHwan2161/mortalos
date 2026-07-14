function issue(keyword, instancePath, params = {}) {
  return { keyword, instancePath, params };
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function inspectObject(value, instancePath, required, allowed, errors) {
  if (!isRecord(value)) {
    errors.push(issue("type", instancePath, { type: "object" }));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      errors.push(issue("additionalProperties", instancePath, { additionalProperty: key }));
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.push(issue("required", instancePath, { missingProperty: key }));
  }
  return true;
}

function inspectString(value, instancePath, errors) {
  if (typeof value !== "string") errors.push(issue("type", instancePath, { type: "string" }));
}

function inspectInteger(value, instancePath, errors) {
  if (!Number.isInteger(value)) errors.push(issue("type", instancePath, { type: "integer" }));
}

function inspectConst(value, expected, instancePath, errors) {
  if (value !== expected) errors.push(issue("const", instancePath, { allowedValue: expected }));
}

function inspectArray(value, instancePath, inspectEntry, errors) {
  if (!Array.isArray(value)) {
    errors.push(issue("type", instancePath, { type: "array" }));
    return;
  }
  value.forEach((entry, index) => inspectEntry(entry, `${instancePath}/${index}`, errors));
}

function inspectCustodian(value, instancePath, errors) {
  if (!inspectObject(value, instancePath, ["key_id", "public_key"], ["key_id", "public_key"], errors)) return;
  inspectString(value.key_id, `${instancePath}/key_id`, errors);
  inspectString(value.public_key, `${instancePath}/public_key`, errors);
}

function inspectQuorum(value, instancePath, errors) {
  if (!inspectObject(value, instancePath, ["type", "threshold"], ["type", "threshold"], errors)) return;
  inspectString(value.type, `${instancePath}/type`, errors);
  inspectInteger(value.threshold, `${instancePath}/threshold`, errors);
}

function inspectEvidence(value, instancePath, errors) {
  if (!inspectObject(value, instancePath, ["key_id", "signature"], ["key_id", "signature"], errors)) return;
  inspectString(value.key_id, `${instancePath}/key_id`, errors);
  inspectString(value.signature, `${instancePath}/signature`, errors);
}

function inspectGenesisBody(value, instancePath, errors) {
  const keys = [
    "protocol_version",
    "hash_algorithm",
    "signature_algorithm",
    "genome_hash",
    "initial_state_root",
    "initial_custodians",
    "initial_quorum",
    "nonce"
  ];
  if (!inspectObject(value, instancePath, keys, keys, errors)) return;
  inspectString(value.protocol_version, `${instancePath}/protocol_version`, errors);
  inspectConst(value.protocol_version, "mortalos/0", `${instancePath}/protocol_version`, errors);
  inspectString(value.hash_algorithm, `${instancePath}/hash_algorithm`, errors);
  inspectConst(value.hash_algorithm, "sha-256", `${instancePath}/hash_algorithm`, errors);
  inspectString(value.signature_algorithm, `${instancePath}/signature_algorithm`, errors);
  inspectConst(value.signature_algorithm, "ed25519", `${instancePath}/signature_algorithm`, errors);
  inspectString(value.genome_hash, `${instancePath}/genome_hash`, errors);
  inspectString(value.initial_state_root, `${instancePath}/initial_state_root`, errors);
  inspectArray(value.initial_custodians, `${instancePath}/initial_custodians`, inspectCustodian, errors);
  inspectQuorum(value.initial_quorum, `${instancePath}/initial_quorum`, errors);
  inspectString(value.nonce, `${instancePath}/nonce`, errors);
}

function inspectEvent(value, instancePath, errors) {
  if (!inspectObject(value, instancePath, ["kind", "payload_hash"], ["kind", "payload_hash"], errors)) return;
  inspectString(value.kind, `${instancePath}/kind`, errors);
  inspectString(value.payload_hash, `${instancePath}/payload_hash`, errors);
}

function inspectPulseBody(value, instancePath, errors) {
  const keys = [
    "protocol_version",
    "organism_id",
    "sequence",
    "parent_hash",
    "genome_hash",
    "current_custody_hash",
    "state_root",
    "event",
    "next_custodians",
    "next_quorum"
  ];
  if (!inspectObject(value, instancePath, keys, keys, errors)) return;
  inspectString(value.protocol_version, `${instancePath}/protocol_version`, errors);
  inspectConst(value.protocol_version, "mortalos/0", `${instancePath}/protocol_version`, errors);
  for (const key of [
    "organism_id",
    "sequence",
    "parent_hash",
    "genome_hash",
    "current_custody_hash",
    "state_root"
  ]) {
    inspectString(value[key], `${instancePath}/${key}`, errors);
  }
  inspectEvent(value.event, `${instancePath}/event`, errors);
  inspectArray(value.next_custodians, `${instancePath}/next_custodians`, inspectCustodian, errors);
  inspectQuorum(value.next_quorum, `${instancePath}/next_quorum`, errors);
}

function createEnvelopeValidator(kind) {
  const genesis = kind === "mortalos.genesis";
  const required = genesis ? ["kind", "body", "approvals"] : ["kind", "body", "approvals", "acceptances"];
  const validate = (value) => {
    const errors = [];
    if (inspectObject(value, "", required, required, errors)) {
      inspectString(value.kind, "/kind", errors);
      inspectConst(value.kind, kind, "/kind", errors);
      if (genesis) inspectGenesisBody(value.body, "/body", errors);
      else inspectPulseBody(value.body, "/body", errors);
      inspectArray(value.approvals, "/approvals", inspectEvidence, errors);
      if (!genesis) inspectArray(value.acceptances, "/acceptances", inspectEvidence, errors);
    }
    validate.errors = errors;
    return errors.length === 0;
  };
  validate.errors = [];
  return validate;
}

export const checkGenesisSchema = createEnvelopeValidator("mortalos.genesis");
export const checkPulseSchema = createEnvelopeValidator("mortalos.pulse");
