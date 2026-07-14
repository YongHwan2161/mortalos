import assert from "node:assert/strict";
import test from "node:test";
import { rejection, REJECTION_CODES } from "../src/index.mjs";

test("rejection manifest is unique, immutable, and fails closed on unknown identifiers", () => {
  assert.equal(new Set(REJECTION_CODES).size, REJECTION_CODES.length);
  assert.equal(Object.isFrozen(REJECTION_CODES), true);
  assert.equal(rejection("E_PARENT_UNKNOWN").code, "E_PARENT_UNKNOWN");
  assert.equal(rejection("E_NOT_DECLARED").code, "E_VALIDATOR_INTERNAL");
  assert.equal(Object.isFrozen(rejection("E_PARENT_UNKNOWN")), true);
});
