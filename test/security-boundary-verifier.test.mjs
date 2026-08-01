import assert from "node:assert/strict";
import test from "node:test";

import {
  postAwaitBorrowedIdentifiers,
  tokenizeJavaScript
} from "../scripts/verify-security-boundaries.mjs";

test("security boundary tokenizer ignores marker-shaped comments and strings", () => {
  const tokens = tokenizeJavaScript(`
    // const owned = ownBorrowed(borrowed);
    "const owned = ownBorrowed(borrowed)";
    const actual = 1;
  `).map(({ value }) => value);
  assert.equal(tokens.includes("ownBorrowed"), false);
  assert.equal(tokens.includes("actual"), true);
});

test("security boundary audit detects a borrowed identifier after suspension", () => {
  const audit = postAwaitBorrowedIdentifiers(`
    const owned = ownBorrowed(borrowed);
    await publish(owned);
    const size = borrowed.byteLength;
    const safe = owned.byteLength;
  `, ["borrowed"]);
  assert.deepEqual(audit.identifiers, ["borrowed"]);
});
