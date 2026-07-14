import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalBytes,
  eventPayloadHash,
  JSON_LIMITS,
  validateGenesis,
  validatePulse
} from "../src/index.mjs";
import { acceptedLineage, canonical, clone, vector } from "./helpers.mjs";

const zeroDigest = `sha256:${Buffer.alloc(32).toString("base64url")}`;
const zeroSignature = `ed25519:${Buffer.alloc(64).toString("base64url")}`;

function expectCode(result, code) {
  assert.equal(result.status, "reject", JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
}

function genesisMutation(mutator, bytes = null) {
  const envelope = clone(vector.birth);
  mutator(envelope);
  return validateGenesis(bytes ?? canonical(envelope));
}

function pulseMutation(index, mutator, options = {}) {
  const { genesis, parents } = acceptedLineage();
  const step = clone(vector.steps[index]);
  mutator(step);
  return validatePulse({
    genesis: options.genesis === undefined ? genesis : options.genesis,
    parent: options.parent === undefined ? parents[index] : options.parent,
    envelopeBytes: options.envelopeBytes ?? canonical(step.envelope),
    eventPayloadBytes:
      options.eventPayloadBytes === undefined ? canonical(step.payload) : options.eventPayloadBytes
  });
}

test("signed Genesis and three signed membership handoffs validate", () => {
  const { genesis, parents, head } = acceptedLineage();
  assert.equal(genesis.organism_id, "mortalos:4kWFalWRv6QYXut4FhLeWQDpX_qpRtYNEcTsxoK2bsw");
  assert.equal(parents.length, 4);
  assert.equal(head.sequence, "3");
  assert.equal(head.next_state_root, genesis.next_state_root);
  assert.equal(Object.isFrozen(genesis), true);
  assert.equal(Object.isFrozen(genesis.next_custody_descriptor.custodians), true);
  assert.equal(Object.isFrozen(head), true);
});

test("Genesis parsing, schema, canonicality, and algorithm precedence are stable", () => {
  expectCode(validateGenesis(Buffer.from('{"kind":')), "E_PARSE_INVALID_JSON");
  expectCode(validateGenesis(Buffer.from('{"kind":"mortalos.genesis","kind":"mortalos.genesis"}')), "E_PARSE_DUPLICATE_PROPERTY");
  expectCode(validateGenesis(Buffer.from([0xff])), "E_PARSE_INVALID_UTF8");
  expectCode(validateGenesis(Buffer.alloc(JSON_LIMITS.envelope_bytes + 1, 0x20)), "E_PARSE_LIMIT_EXCEEDED");
  expectCode(validateGenesis(Buffer.from(JSON.stringify(vector.birth, null, 2))), "E_CANONICAL_MISMATCH");
  expectCode(genesisMutation((value) => { value.extra = true; }), "E_SCHEMA_UNKNOWN_FIELD");
  expectCode(genesisMutation((value) => { value.kind = "other"; }), "E_SCHEMA_WRONG_KIND");
  expectCode(genesisMutation((value) => { value.body.protocol_version = "mortalos/9"; }), "E_VERSION_UNSUPPORTED");
  expectCode(genesisMutation((value) => { value.body.hash_algorithm = "sha-512"; }), "E_HASH_ALGORITHM_UNSUPPORTED");
  expectCode(genesisMutation((value) => { value.body.signature_algorithm = "rsa"; }), "E_SIGNATURE_ALGORITHM_UNSUPPORTED");
  expectCode(genesisMutation((value) => { delete value.body.nonce; }), "E_SCHEMA_INVALID");
});

test("Genesis custody, encoding, approval set, and signatures are semantic checks", () => {
  expectCode(genesisMutation((value) => { value.body.genome_hash = "sha256:short"; }), "E_BINARY_ENCODING");
  expectCode(genesisMutation((value) => { value.body.nonce = "nonce:short"; }), "E_BINARY_ENCODING");
  expectCode(genesisMutation((value) => { value.approvals.reverse(); }), "E_ARRAY_NOT_SORTED");
  expectCode(genesisMutation((value) => { value.approvals[1] = clone(value.approvals[0]); }), "E_APPROVAL_DUPLICATE");
  expectCode(genesisMutation((value) => { value.body.initial_custodians = []; }), "E_CUSTODIAN_COUNT_RANGE");
  expectCode(genesisMutation((value) => { [value.body.initial_custodians[0].public_key, value.body.initial_custodians[1].public_key] = [value.body.initial_custodians[1].public_key, value.body.initial_custodians[0].public_key]; }), "E_PEER_ID_MISMATCH");
  expectCode(genesisMutation((value) => { value.body.initial_custodians[1].public_key = value.body.initial_custodians[0].public_key; }), "E_CUSTODIAN_DUPLICATE_KEY");
  expectCode(genesisMutation((value) => { value.body.initial_quorum.type = "weight"; }), "E_QUORUM_TYPE_UNSUPPORTED");
  expectCode(genesisMutation((value) => { value.body.initial_quorum.threshold = 0; }), "E_QUORUM_THRESHOLD_RANGE");
  expectCode(genesisMutation((value) => {
    value.body.initial_custodians.push(clone(vector.actors.D));
    value.body.initial_custodians.sort((a, b) => a.key_id < b.key_id ? -1 : 1);
  }), "E_QUORUM_NOT_MAJORITY");
  expectCode(genesisMutation((value) => { value.approvals.pop(); }), "E_GENESIS_APPROVAL_SET");
  expectCode(genesisMutation((value) => { value.approvals[0].signature = zeroSignature; }), "E_APPROVAL_SIGNATURE_INVALID");
});

test("Pulse requires canonical envelope and exact canonical object sidecar", () => {
  expectCode(pulseMutation(0, () => {}, { eventPayloadBytes: null }), "E_EVENT_PAYLOAD_REQUIRED");
  expectCode(pulseMutation(0, () => {}, { eventPayloadBytes: Buffer.from('{"x":1,"x":2}') }), "E_EVENT_PAYLOAD_INVALID");
  expectCode(pulseMutation(0, () => {}, { eventPayloadBytes: Buffer.from('[1]') }), "E_EVENT_PAYLOAD_INVALID");
  const oversizedPayload = pulseMutation(0, () => {}, {
    eventPayloadBytes: Buffer.alloc(JSON_LIMITS.event_payload_bytes + 1, 0x20)
  });
  expectCode(oversizedPayload, "E_EVENT_PAYLOAD_INVALID");
  assert.equal(oversizedPayload.deterministic_detail, "E_PARSE_LIMIT_EXCEEDED");
  expectCode(pulseMutation(0, () => {}, { eventPayloadBytes: Buffer.from('{ "handoff":"A-to-D"}') }), "E_EVENT_PAYLOAD_INVALID");
  expectCode(pulseMutation(0, () => {}, { envelopeBytes: Buffer.from(JSON.stringify(vector.steps[0].envelope, null, 2)) }), "E_CANONICAL_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.extra = true; }), "E_SCHEMA_UNKNOWN_FIELD");
  expectCode(pulseMutation(0, (step) => { step.envelope.kind = "other"; }), "E_SCHEMA_WRONG_KIND");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.protocol_version = "mortalos/9"; }), "E_VERSION_UNSUPPORTED");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.event.kind = "state-transition"; }), "E_EVENT_KIND_UNSUPPORTED");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.sequence = "01"; }), "E_SEQUENCE_INVALID_FORMAT");
  const schemaInvalid = clone(vector.steps[0].envelope);
  delete schemaInvalid.body.sequence;
  expectCode(pulseMutation(0, () => {}, {
    envelopeBytes: canonical(schemaInvalid),
    eventPayloadBytes: Buffer.from('{"x":1,"x":2}')
  }), "E_EVENT_PAYLOAD_INVALID");
  expectCode(pulseMutation(0, () => {}, {
    envelopeBytes: Buffer.from('{"kind":'),
    eventPayloadBytes: Buffer.from('{"x":1,"x":2}')
  }), "E_PARSE_INVALID_JSON");
});

test("Pulse ordering, encoding, custody, and validation context fail closed", () => {
  expectCode(pulseMutation(0, (step) => { step.envelope.approvals.reverse(); }), "E_ARRAY_NOT_SORTED");
  expectCode(pulseMutation(0, (step) => { step.envelope.approvals[1] = clone(step.envelope.approvals[0]); }), "E_APPROVAL_DUPLICATE");
  expectCode(pulseMutation(0, (step) => { step.envelope.acceptances.push(clone(step.envelope.acceptances[0])); }), "E_ACCEPTANCE_DUPLICATE");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.next_custodians = []; }), "E_CUSTODIAN_COUNT_RANGE");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.parent_hash = "sha256:short"; }), "E_BINARY_ENCODING");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.state_root = "sha256:short"; }), "E_STATE_ROOT_ENCODING");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.event.payload_hash = "sha256:short"; }), "E_EVENT_PAYLOAD_HASH_ENCODING");
  expectCode(pulseMutation(0, () => {}, { genesis: null }), "E_LINEAGE_UNKNOWN");
  expectCode(pulseMutation(0, () => {}, { parent: null }), "E_PARENT_REQUIRED");
  const foreign = validateGenesis(canonical(vector.clone));
  assert.equal(foreign.status, "accept");
  expectCode(pulseMutation(0, () => {}, { parent: foreign }), "E_LINEAGE_UNKNOWN");
  const { genesis, parents } = acceptedLineage();
  expectCode(
    pulseMutation(0, () => {}, { genesis: clone(genesis), parent: parents[0] }),
    "E_LINEAGE_UNKNOWN"
  );
  expectCode(
    pulseMutation(0, () => {}, { genesis, parent: clone(parents[0]) }),
    "E_PARENT_REQUIRED"
  );
});

test("Pulse identity, sequence, parent, genome, custody, state, and payload are bound", () => {
  expectCode(pulseMutation(0, (step) => { step.envelope.body.organism_id = `mortalos:${Buffer.alloc(32).toString("base64url")}`; }), "E_ORGANISM_ID_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.sequence = "2"; }), "E_SEQUENCE_NOT_NEXT");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.parent_hash = zeroDigest; }), "E_PARENT_HASH_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.genome_hash = zeroDigest; }), "E_GENOME_HASH_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.current_custody_hash = zeroDigest; }), "E_CURRENT_CUSTODY_HASH_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.state_root = zeroDigest; }), "E_MEMBERSHIP_STATE_CHANGED");
  expectCode(pulseMutation(0, (step) => { step.payload.handoff = "substituted"; }), "E_EVENT_PAYLOAD_MISMATCH");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.event.kind = "heartbeat"; step.envelope.body.state_root = zeroDigest; }), "E_HEARTBEAT_STATE_CHANGED");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.event.kind = "heartbeat"; }), "E_HEARTBEAT_PAYLOAD_NONEMPTY");
  expectCode(pulseMutation(0, (step) => { step.envelope.body.event.kind = "heartbeat"; step.payload = {}; step.envelope.body.event.payload_hash = eventPayloadHash({}); }), "E_HEARTBEAT_CUSTODY_CHANGED");
  expectCode(pulseMutation(0, (step) => {
    step.envelope.body.next_custodians = clone(vector.birth.body.initial_custodians);
    step.envelope.body.next_quorum = clone(vector.birth.body.initial_quorum);
    step.envelope.acceptances = [];
  }), "E_MEMBERSHIP_CUSTODY_UNCHANGED");
});

test("Pulse approval and acceptance evidence enforces eligibility, quorum, and handoff consent", () => {
  expectCode(pulseMutation(0, (step) => { step.envelope.approvals[0].signature = zeroSignature; }), "E_APPROVAL_SIGNATURE_INVALID");
  expectCode(pulseMutation(0, (step) => { step.envelope.approvals = step.envelope.approvals.slice(0, 1); }), "E_APPROVAL_INSUFFICIENT_QUORUM");
  expectCode(pulseMutation(0, (step) => {
    step.envelope.approvals[1] = { key_id: vector.actors.E.key_id, signature: zeroSignature };
    step.envelope.approvals.sort((a, b) => a.key_id < b.key_id ? -1 : 1);
  }), "E_APPROVAL_SIGNER_INELIGIBLE");
  expectCode(pulseMutation(0, (step) => { step.envelope.acceptances = []; }), "E_ACCEPTANCE_MISSING");
  expectCode(pulseMutation(0, (step) => { step.envelope.acceptances[0].signature = zeroSignature; }), "E_ACCEPTANCE_SIGNATURE_INVALID");
  expectCode(pulseMutation(0, (step) => {
    step.envelope.acceptances.unshift({ key_id: vector.actors.B.key_id, signature: zeroSignature });
  }), "E_ACCEPTANCE_SIGNER_NOT_NEW");
  expectCode(pulseMutation(0, (step) => {
    step.envelope.acceptances.push({ key_id: vector.actors.G.key_id, signature: zeroSignature });
    step.envelope.acceptances.sort((a, b) => a.key_id < b.key_id ? -1 : 1);
  }), "E_ACCEPTANCE_UNEXPECTED");
  expectCode(pulseMutation(1, (step) => {
    step.envelope.approvals[0].signature = vector.steps[0].envelope.approvals[1].signature;
  }), "E_APPROVAL_SIGNATURE_INVALID");
});

test("public snapshot continuation is rejected at the semantic quorum gate", () => {
  const { genesis, head } = acceptedLineage();
  const result = validatePulse({
    genesis,
    parent: head,
    envelopeBytes: canonical(vector.resurrection_attempt.envelope),
    eventPayloadBytes: canonical(vector.resurrection_attempt.payload)
  });
  expectCode(result, "E_APPROVAL_INSUFFICIENT_QUORUM");
  assert.equal(result.deterministic_detail, "0/2");
});
