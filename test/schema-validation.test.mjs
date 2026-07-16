import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  checkGenesisSchema,
  checkPulseSchema
} from "../src/schema-validation.mjs";
import { vector } from "./helpers.mjs";

function clone(value) {
  return structuredClone(value);
}

function mutated(value, operation) {
  const result = clone(value);
  operation(result);
  return result;
}

test("portable structural validators agree with the normative JSON Schemas", async () => {
  const [genesisSchema, pulseSchema] = await Promise.all([
    readFile(new URL("../schemas/genesis.schema.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../schemas/pulse.schema.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const ajvGenesis = ajv.compile(genesisSchema);
  const ajvPulse = ajv.compile(pulseSchema);

  const genesisCases = [
    vector.birth,
    null,
    [],
    {},
    mutated(vector.birth, (value) => { value.extra = true; }),
    mutated(vector.birth, (value) => { value.kind = 1; }),
    mutated(vector.birth, (value) => { value.body = null; }),
    mutated(vector.birth, (value) => { value.approvals = null; }),
    mutated(vector.birth, (value) => { value.approvals[0] = null; }),
    mutated(vector.birth, (value) => { value.approvals[0].extra = true; }),
    mutated(vector.birth, (value) => { value.approvals[0].signature = 1; }),
    mutated(vector.birth, (value) => { value.body.extra = true; }),
    mutated(vector.birth, (value) => { delete value.body.nonce; }),
    mutated(vector.birth, (value) => { value.body.initial_custodians = null; }),
    mutated(vector.birth, (value) => { value.body.initial_custodians[0] = null; }),
    mutated(vector.birth, (value) => { value.body.initial_custodians[0].extra = true; }),
    mutated(vector.birth, (value) => { value.body.initial_custodians[0].public_key = 1; }),
    mutated(vector.birth, (value) => { value.body.initial_quorum = null; }),
    mutated(vector.birth, (value) => { value.body.initial_quorum.threshold = "2"; })
  ];
  const pulse = vector.steps[0].envelope;
  const pulseCases = [
    pulse,
    null,
    [],
    {},
    mutated(pulse, (value) => { value.extra = true; }),
    mutated(pulse, (value) => { value.kind = 1; }),
    mutated(pulse, (value) => { value.body = null; }),
    mutated(pulse, (value) => { value.approvals = null; }),
    mutated(pulse, (value) => { value.acceptances = null; }),
    mutated(pulse, (value) => { value.acceptances[0] = null; }),
    mutated(pulse, (value) => { value.acceptances[0].key_id = 1; }),
    mutated(pulse, (value) => { value.body.extra = true; }),
    mutated(pulse, (value) => { delete value.body.sequence; }),
    mutated(pulse, (value) => { value.body.event = null; }),
    mutated(pulse, (value) => { value.body.event.extra = true; }),
    mutated(pulse, (value) => { value.body.event.payload_hash = 1; }),
    mutated(pulse, (value) => { value.body.next_custodians = null; }),
    mutated(pulse, (value) => { value.body.next_quorum = null; }),
    mutated(pulse, (value) => { value.body.next_quorum.threshold = "2"; })
  ];

  for (const candidate of genesisCases) {
    assert.equal(checkGenesisSchema(candidate).valid, Boolean(ajvGenesis(candidate)));
  }
  for (const candidate of pulseCases) {
    assert.equal(checkPulseSchema(candidate).valid, Boolean(ajvPulse(candidate)));
  }
  const validGenesis = checkGenesisSchema(vector.birth);
  assert.equal(validGenesis.valid, true);
  assert.equal(validGenesis.errors.length, 0);
  const unknown = genesisCases[4];
  const invalidGenesis = checkGenesisSchema(unknown);
  assert.equal(invalidGenesis.valid, false);
  assert.equal(invalidGenesis.errors[0].keyword, "additionalProperties");
});
