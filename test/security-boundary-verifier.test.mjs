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
  `, ["borrowed"], ["ownBorrowed"]);
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
  assert.deepEqual(loop.identifiers, ["borrowed", "index"]);

  const closure = postAwaitBorrowedIdentifiers(`
    const deferred = () => borrowed.byteLength;
    await publish(owned);
    return deferred();
  `, ["borrowed"]);
  assert.deepEqual(closure.identifiers, ["borrowed", "deferred"]);
});

test("security boundary AST propagates alias, shallow-freeze, spread, and destructuring taint", () => {
  const corpus = [
    {
      expected: "alias",
      source: "const alias = borrowed; await pause(); return alias.body;"
    },
    {
      expected: "invocation",
      source: "const invocation = Object.freeze({ request: borrowed }); await pause(); return invocation.request.body;"
    },
    {
      expected: "spread",
      source: "const spread = { ...borrowed }; await pause(); return spread.body;"
    },
    {
      expected: "body",
      source: "const { body } = borrowed; await pause(); return body;"
    },
    {
      expected: "invocation",
      source: "const invocation = {}; invocation.request = borrowed; await pause(); return invocation.request.body;"
    }
  ];
  for (const { expected, source } of corpus) {
    const audit = postAwaitBorrowedIdentifiers(source, ["borrowed"]);
    assert.deepEqual(audit.identifiers, [expected], source);
  }
});

test("security boundary AST clears taint only through an allowlisted deep ownership primitive", () => {
  const source = `
    const owned = deepOwn(borrowed);
    await pause();
    return owned.body;
  `;
  assert.deepEqual(
    postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers,
    ["owned"]
  );
  assert.deepEqual(
    postAwaitBorrowedIdentifiers(source, ["borrowed"], ["deepOwn"]).identifiers,
    []
  );
});

test("security boundary AST does not confuse property names with borrowed references", () => {
  const audit = postAwaitBorrowedIdentifiers(`
    await publish(owned);
    return { borrowed: owned.byteLength, value: owned.borrowed };
  `, ["borrowed"]);
  assert.deepEqual(audit.identifiers, []);
});
