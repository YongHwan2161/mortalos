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

test("security boundary AST rejects same-expression and template interpolation escapes", () => {
  const corpus = [
    "const size = (await publish(owned), borrowed.byteLength);",
    "await publish(owned); return `${borrowed.byteLength}`;",
    "return (await publish(owned)) && borrowed.byteLength;",
    "return (await publish(owned)) ? borrowed.byteLength : 0;"
  ];
  for (const source of corpus) {
    const audit = postAwaitBorrowedIdentifiers(source, ["borrowed"]);
    assert.deepEqual(audit.identifiers, ["borrowed"], source);
  }
});

test("security boundary AST rejects borrowed loop state and deferred closures", () => {
  const loop = postAwaitBorrowedIdentifiers(`
    for (let index = borrowed.offset; index < 2; index += 1) {
      await publish(owned);
    }
  `, ["borrowed"]);
  assert.deepEqual(loop.identifiers, ["borrowed"]);

  const closure = postAwaitBorrowedIdentifiers(`
    const deferred = () => borrowed.byteLength;
    await publish(owned);
    return deferred();
  `, ["borrowed"]);
  assert.deepEqual(closure.identifiers, ["borrowed"]);
});

test("security boundary AST does not confuse property names with borrowed references", () => {
  const audit = postAwaitBorrowedIdentifiers(`
    await publish(owned);
    return { borrowed: owned.byteLength, value: owned.borrowed };
  `, ["borrowed"]);
  assert.deepEqual(audit.identifiers, []);
});
