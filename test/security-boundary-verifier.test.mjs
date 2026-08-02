import assert from "node:assert/strict";
import test from "node:test";
import { full } from "acorn-walk";

import {
  assertImmutablePrimitiveBinding,
  assertSupportedOwnershipPrelude,
  postAwaitBorrowedIdentifiers,
  tokenizeJavaScript
} from "../scripts/verify-security-boundaries.mjs";
import {
  analyzeFunctionOwnership,
  parseSecurityModule
} from "../scripts/security-boundary-ast.mjs";

function borrowedIdentifiers(audit) {
  return audit.identifiers.filter((identifier) => !identifier.startsWith("ambient:"));
}

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
  assert.deepEqual(borrowedIdentifiers(audit).sort(), ["borrowed", "owned"]);
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
    assert.ok(audit.identifiers.includes("borrowed"), source);
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
    assert.ok(audit.identifiers.includes(expected), source);
    assert.ok(audit.identifiers.includes("borrowed"), source);
  }
});

test("security boundary AST clears taint only at a verifier-proven call site", () => {
  const source = `
    async function target(borrowed) {
      const owned = deepOwn(borrowed);
      await pause();
      return owned.body;
    }
  `;
  const ast = parseSecurityModule(source);
  const functionNode = ast.body[0];
  let callStart = -1;
  full(functionNode.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "deepOwn") callStart = node.start;
  });
  const unproven = analyzeFunctionOwnership(functionNode, ["borrowed"]);
  assert.ok(unproven.identifiers.includes("borrowed"));
  assert.ok(unproven.identifiers.includes("owned"));
  assert.deepEqual(
    analyzeFunctionOwnership(functionNode, ["borrowed"], [callStart]).identifiers,
    []
  );
});

test("security boundary AST never trusts an allowlisted callee string", () => {
  const source = `
    const clone = (value) => value;
    const owned = clone(borrowed);
    await pause();
    return owned.body;
  `;
  assert.ok(
    postAwaitBorrowedIdentifiers(source, ["borrowed"], ["clone"])
      .identifiers.includes("owned")
  );
});

test("security boundary AST propagates mutation-call taint", () => {
  const corpus = [
    "const invocation = { items: [] }; invocation.items.push(borrowed); await pause(); return invocation.items[0];",
    "const invocation = {}; Object.assign(invocation, { request: borrowed }); await pause(); return invocation.request;",
    "const invocation = {}; Object.defineProperty(invocation, 'request', { value: borrowed }); await pause(); return invocation.request;"
  ];
  for (const source of corpus) {
    assert.ok(
      postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers.includes("invocation"),
      source
    );
  }
});

test("security boundary AST propagates mutation through receiver aliases and computed calls", () => {
  const corpus = [
    "const invocation = { items: [] }; const items = invocation.items; items.push(borrowed); await pause(); return invocation.items[0];",
    "const invocation = {}; const target = invocation; Object.assign(target, { request: borrowed }); await pause(); return invocation.request;",
    "const invocation = {}; const target = invocation; Object.defineProperty(target, 'request', { value: borrowed }); await pause(); return invocation.request;",
    "const invocation = { items: [] }; const items = invocation.items; items['push'](borrowed); await pause(); return invocation.items[0];",
    "const invocation = {}; const target = invocation; Reflect.defineProperty(target, 'request', { value: borrowed }); await pause(); return invocation.request;"
  ];
  for (const source of corpus) {
    assert.ok(
      postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers.includes("invocation"),
      source
    );
  }
});

test("security boundary AST conservatively joins composite aliases and indirect call effects", () => {
  const corpus = [
    "const invocation = {}; const target = true ? invocation : {}; target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const target = (0, invocation); target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const [target] = [invocation]; target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const holder = { target: invocation }; holder.target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const identity = (value) => value; const target = identity(invocation); target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const O = Object; O.assign(invocation, { request: borrowed }); await pause(); return invocation.request;",
    "const invocation = {}; const { assign } = Object; assign(invocation, { request: borrowed }); await pause(); return invocation.request;",
    "const invocation = { items: [] }; Array.prototype.push.call(invocation.items, borrowed); await pause(); return invocation.items[0];",
    "const invocation = { items: [] }; Reflect.apply(Array.prototype.push, invocation.items, [borrowed]); await pause(); return invocation.items[0];"
  ];
  for (const source of corpus) {
    const identifiers = postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers;
    assert.ok(identifiers.includes("invocation"), source);
  }
});

test("security boundary AST models tainted callees, captured closures, tags, and return aliases", () => {
  const corpus = [
    "const invocation = {}; borrowed.inject(invocation); await pause(); return invocation.request;",
    "const invocation = {}; borrowed(invocation); await pause(); return invocation.request;",
    "const invocation = {}; const Object = { inject(value) { invocation.request = value; } }; Object.inject(borrowed); await pause(); return invocation.request;",
    "const invocation = {}; const mutate = (strings, value) => { invocation.request = value; }; mutate`${borrowed}`; await pause(); return invocation.request;",
    "const invocation = {}; function get() { return invocation; } const target = get(); target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = { getSelf() { return this; } }; const target = invocation.getSelf(); target.request = borrowed; await pause(); return invocation.request;",
    "const invocation = {}; const mutate = (value) => { invocation.request = value; }; mutate(borrowed); await pause(); return invocation.request;"
  ];
  for (const source of corpus) {
    const identifiers = postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers;
    assert.ok(identifiers.includes("invocation"), source);
  }
});

test("security boundary AST recursively resolves composite call targets and class captures", () => {
  const corpus = [
    "const invocation = {}; mutate(...[invocation, borrowed]); await pause(); return invocation.request;",
    "const invocation = {}; mutate((0, invocation), borrowed); await pause(); return invocation.request;",
    "const invocation = {}; mutate(true ? invocation : {}, borrowed); await pause(); return invocation.request;",
    "const invocation = {}; const identity = (value) => value; mutate(identity(invocation), borrowed); await pause(); return invocation.request;",
    "const invocation = {}; dispatch((value) => { invocation.request = value; }, borrowed); await pause(); return invocation.request;",
    "const invocation = {}; class Mutator { static inject(value) { invocation.request = value; } } Mutator.inject(borrowed); await pause(); return invocation.request;",
    "const invocation = {}; class Mutator { inject(value) { invocation.request = value; } } new Mutator().inject(borrowed); await pause(); return invocation.request;",
    "const invocation = { getSelf() { return this; }, inject(value) { this.request = value; } }; invocation.getSelf().inject(borrowed); await pause(); return invocation.request;",
    "const invocation = { inject(value) { this.request = value; } }; function get() { return invocation; } get().inject(borrowed); await pause(); return invocation.request;"
  ];
  for (const source of corpus) {
    const identifiers = postAwaitBorrowedIdentifiers(source, ["borrowed"]).identifiers;
    assert.ok(identifiers.includes("invocation"), source);
  }
});

test("security boundary AST rejects trusted-call markers inside nested closures", () => {
  const ast = parseSecurityModule(`
    async function target(borrowed) {
      const identity = (value) => value;
      const owned = ((clone) => clone(borrowed))(identity);
      await pause();
      return owned.body;
    }
  `);
  const functionNode = ast.body[0];
  let nestedCallStart = -1;
  full(functionNode.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "clone") {
      nestedCallStart = node.start;
    }
  });
  const identifiers = analyzeFunctionOwnership(
    functionNode,
    ["borrowed"],
    [nestedCallStart]
  ).identifiers;
  assert.ok(identifiers.includes("borrowed"));
  assert.ok(identifiers.includes("owned"));
});

test("primitive provenance rejects nested parameters and loop write targets", () => {
  for (const source of [
    "async function target(borrowed) { return ((clone) => clone(borrowed))((value) => value); }",
    "async function target(borrowed) { for (clone of [(value) => value]) clone(borrowed); }"
  ]) {
    const ast = parseSecurityModule(`function clone(value) { return structuredClone(value); } ${source}`);
    assert.throws(
      () => assertImmutablePrimitiveBinding(ast, ast.body[1], "clone", "hostile.mjs"),
      /clone/u,
      source
    );
  }
});

test("reviewed ownership prelude rejects dynamic and unbounded callable syntax", () => {
  const corpus = [
    "function helper() {}",
    "class Helper {}",
    "tag`dynamic`",
    "eval('dynamic')",
    "import('./dynamic.mjs')"
  ];
  for (const statement of corpus) {
    const ast = parseSecurityModule(`async function target() { ${statement}; await pause(); }`);
    const functionNode = ast.body[0];
    const audit = analyzeFunctionOwnership(functionNode, []);
    assert.throws(
      () => assertSupportedOwnershipPrelude(functionNode, audit.boundary, "hostile.mjs"),
      /ownership-prelude|dynamic code/u,
      statement
    );
  }
});

test("security boundary AST rejects unsummarized ambient effects", () => {
  const corpus = [
    {
      marker: "ambient:globalMutator",
      source: "globalMutator(borrowed);"
    },
    {
      marker: "ambient:local",
      source: "const local = globalMutator; local(borrowed);"
    },
    {
      marker: "ambient:computed-callee",
      source: "(0, globalMutator)(borrowed);"
    }
  ];
  for (const { marker, source } of corpus) {
    const audit = postAwaitBorrowedIdentifiers(`
      const invocation = {};
      globalThis.slot = invocation;
      ${source}
      await pause();
      return invocation.request;
    `, ["borrowed"]);
    assert.ok(audit.identifiers.includes(marker), source);
  }
});

test("security boundary AST audits default parameter effects before body entry", () => {
  const source = `
    async function target(
      borrowed,
      invocation,
      side = borrowed.inject(invocation)
    ) {
      await pause();
      return invocation.request;
    }
  `;
  const functionNode = parseSecurityModule(source).body[0];
  const audit = analyzeFunctionOwnership(functionNode, ["borrowed"]);
  assert.ok(audit.identifiers.includes("invocation"));
  assert.match(source.slice(functionNode.start, audit.boundary), /borrowed\.inject\(invocation\)/u);
});

test("security boundary AST treats for-await and async yield as suspension", () => {
  const forAwait = parseSecurityModule(`
    async function target(borrowed) {
      for await (const item of borrowed) return borrowed.value;
    }
  `).body[0];
  const forAwaitAudit = analyzeFunctionOwnership(forAwait, ["borrowed"]);
  assert.equal(forAwaitAudit.suspensionType, "ForAwaitSuspension");
  assert.ok(forAwaitAudit.identifiers.includes("borrowed"));

  const generator = parseSecurityModule(`
    async function* target(borrowed) {
      yield borrowed.value;
      return borrowed.value;
    }
  `).body[0];
  const generatorAudit = analyzeFunctionOwnership(generator, ["borrowed"]);
  assert.equal(generatorAudit.suspensionType, "YieldExpression");
  assert.ok(generatorAudit.identifiers.includes("borrowed"));
});

test("reviewed ownership prelude includes and rejects dynamic first-await operands", () => {
  const source = `async function target(borrowed) {
    await eval("borrowed.value = 1");
  }`;
  const functionNode = parseSecurityModule(source).body[0];
  const audit = analyzeFunctionOwnership(functionNode, ["borrowed"]);
  assert.match(source.slice(functionNode.start, audit.boundary), /eval/u);
  assert.throws(
    () => assertSupportedOwnershipPrelude(functionNode, audit.boundary, "hostile.mjs"),
    /dynamic code/u
  );
});

test("security boundary rejects implicit Proxy, accessor, coercion, and iterator effects", async () => {
  const corpus = [
    "external.sink = borrowed;",
    "external[borrowed];",
    "delete external[borrowed];",
    "borrowed in external;",
    "borrowed instanceof external;",
    "'' + borrowed;",
    "`${borrowed}`;",
    "for (const item of borrowed) void item;",
    "[...borrowed];",
    "({...borrowed});",
    "const { value } = borrowed; void value;"
  ];
  for (const expression of corpus) {
    const audit = postAwaitBorrowedIdentifiers(`
      const invocation = {};
      globalThis.slot = invocation;
      ${expression}
      await pause();
      return invocation.request;
    `, ["borrowed"]);
    assert.ok(audit.identifiers.includes("borrowed"), expression);
  }

  const borrowed = Object.freeze({ marker: "borrowed" });
  const invocation = {};
  globalThis.__mortalosProxyWitness = invocation;
  const external = new Proxy({}, {
    set(_target, _property, value) {
      globalThis.__mortalosProxyWitness.request = value;
      return true;
    }
  });
  try {
    external.sink = borrowed;
    await Promise.resolve();
    assert.equal(invocation.request, borrowed);
  } finally {
    delete globalThis.__mortalosProxyWitness;
  }
});

test("security boundary taints arguments aliases and bans dynamic code after suspension", () => {
  const argumentsAlias = postAwaitBorrowedIdentifiers(`
    const alias = arguments[0];
    await pause();
    return alias;
  `, ["borrowed"]);
  assert.ok(argumentsAlias.identifiers.includes("arguments"));
  assert.ok(argumentsAlias.identifiers.includes("alias"));

  for (const dynamicExpression of [
    "eval('borrowed')",
    "globalThis['eval']('borrowed')",
    "import('./dynamic.mjs')"
  ]) {
    const functionNode = parseSecurityModule(`
      async function target(borrowed) {
        await pause();
        return ${dynamicExpression};
      }
    `).body[0];
    const audit = analyzeFunctionOwnership(functionNode, ["borrowed"]);
    assert.throws(
      () => assertSupportedOwnershipPrelude(functionNode, audit.boundary, "hostile.mjs"),
      /dynamic code/u,
      dynamicExpression
    );
  }
});

test("verified calls reject effectful argument evaluation and nested parameter keys", async () => {
  const trustedSource = `
    async function target(borrowed) {
      const invocation = {};
      globalThis.slot = invocation;
      const owned = own(borrowed.payload);
      await pause();
      return invocation.request ?? owned;
    }
  `;
  const trustedFunction = parseSecurityModule(trustedSource).body[0];
  let trustedCallStart = -1;
  full(trustedFunction.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "own") {
      trustedCallStart = node.start;
    }
  });
  const ownershipAudit = analyzeFunctionOwnership(
    trustedFunction,
    ["borrowed"],
    [trustedCallStart]
  );
  const summaryAudit = analyzeFunctionOwnership(
    trustedFunction,
    ["borrowed"],
    [],
    [trustedCallStart]
  );
  assert.ok(ownershipAudit.identifiers.includes("borrowed"));
  assert.ok(summaryAudit.identifiers.includes("borrowed"));

  const nestedParameter = postAwaitBorrowedIdentifiers(`
    const invocation = {};
    globalThis.slot = invocation;
    (({ [borrowed]: value }) => void value)({});
    await pause();
    return invocation.request;
  `, ["borrowed"]);
  assert.ok(nestedParameter.identifiers.includes("borrowed"));

  const getterInvocation = {};
  const getterBorrowed = new Proxy({ payload: 1 }, {
    get(target, property, receiver) {
      if (property === "payload") getterInvocation.request = receiver;
      return Reflect.get(target, property, receiver);
    }
  });
  const own = (value) => value;
  own(getterBorrowed.payload);
  await Promise.resolve();
  assert.equal(getterInvocation.request, getterBorrowed);

  const coercionInvocation = {};
  const coercionBorrowed = {
    [Symbol.toPrimitive]() {
      coercionInvocation.request = this;
      return "borrowed";
    }
  };
  (({ [coercionBorrowed]: value }) => value)({ borrowed: 1 });
  await Promise.resolve();
  assert.equal(coercionInvocation.request, coercionBorrowed);
});

test("ordinary async functions treat caller-controlled this as borrowed input", async () => {
  const source = `
    async function target(borrowed) {
      const owned = own(borrowed);
      await pause();
      return this.request ?? owned;
    }
  `;
  const functionNode = parseSecurityModule(source).body[0];
  let ownCallStart = -1;
  full(functionNode.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "own") {
      ownCallStart = node.start;
    }
  });
  const audit = analyzeFunctionOwnership(functionNode, ["borrowed"], [ownCallStart]);
  assert.ok(audit.identifiers.includes("this"));

  const borrowed = { value: 1 };
  async function runtimeTarget(value) {
    const owned = { ...value };
    await Promise.resolve();
    return this.request ?? owned;
  }
  assert.equal(await runtimeTarget.call({ request: borrowed }, borrowed), borrowed);
});

test("ownership exemptions end at the runtime-first suspension and cannot repeat across it", async () => {
  const corpus = [
    `async function target(borrowed) {
      const first = own(borrowed);
      await pause();
      const second = own(borrowed);
      return second;
    }`,
    `async function target(borrowed) {
      const first = own(borrowed);
      await outer(await pause(), own(borrowed));
      return first;
    }`,
    `async function target(borrowed) {
      let result;
      for (let index = 0; index < 2; index += 1) {
        result = own(borrowed);
        if (index === 0) await pause();
      }
      return result;
    }`
  ];
  for (const source of corpus) {
    const functionNode = parseSecurityModule(source).body[0];
    const ownCallStarts = [];
    full(functionNode.body, (node) => {
      if (node.type === "CallExpression" && node.callee?.name === "own") {
        ownCallStarts.push(node.start);
      }
    });
    const audit = analyzeFunctionOwnership(functionNode, ["borrowed"], ownCallStarts);
    assert.ok(audit.identifiers.includes("borrowed"), source);
  }

  const summarizedAfterAwait = `async function target(borrowed) {
    await pause();
    summary(borrowed);
    return 1;
  }`;
  const summarizedFunction = parseSecurityModule(summarizedAfterAwait).body[0];
  let summarizedCallStart = -1;
  full(summarizedFunction.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "summary") {
      summarizedCallStart = node.start;
    }
  });
  const summarizedAudit = analyzeFunctionOwnership(
    summarizedFunction,
    ["borrowed"],
    [],
    [summarizedCallStart]
  );
  assert.ok(summarizedAudit.identifiers.includes("borrowed"));

  let releasePause;
  const paused = new Promise((resolve) => { releasePause = resolve; });
  const borrowed = { value: 1 };
  const copy = (value) => ({ ...value });
  async function nestedRuntime(value) {
    const first = copy(value);
    const second = await ((await paused), copy(value));
    return { first, second };
  }
  const pending = nestedRuntime(borrowed);
  borrowed.value = 2;
  releasePause();
  const observed = await pending;
  assert.equal(observed.first.value, 1);
  assert.equal(observed.second.value, 2);
});

test("ownership preludes reject post-suspension destructuring defaults and computed keys", async () => {
  const corpus = [
    `async function target(borrowed) {
      let owned;
      [owned = own(borrowed)] = await pause();
      return owned;
    }`,
    `async function target(borrowed) {
      let owned;
      ({ value: owned = own(borrowed) } = await pause());
      return owned;
    }`,
    `async function target(borrowed) {
      let owned;
      const [value = (owned = own(borrowed))] = await pause();
      return owned ?? value;
    }`,
    `async function target(borrowed) {
      let owned;
      ({ [(owned = own(borrowed), await key())]: value } = await pause());
      return owned ?? value;
    }`
  ];
  for (const source of corpus) {
    const functionNode = parseSecurityModule(source).body[0];
    const ownCallStarts = [];
    full(functionNode.body, (node) => {
      if (node.type === "CallExpression" && node.callee?.name === "own") {
        ownCallStarts.push(node.start);
      }
    });
    const audit = analyzeFunctionOwnership(functionNode, ["borrowed"], ownCallStarts);
    assert.deepEqual(audit.identifiers, [], "witness must exercise the former exemption gap");
    assert.throws(
      () => assertSupportedOwnershipPrelude(functionNode, audit.boundary, "hostile.mjs"),
      /suspension combined with destructuring/u
    );
  }

  const summarizedSource = `async function target(borrowed) {
    let ignored;
    [ignored = summary(borrowed)] = await pause();
    return 1;
  }`;
  const summarizedFunction = parseSecurityModule(summarizedSource).body[0];
  let summaryCallStart = -1;
  full(summarizedFunction.body, (node) => {
    if (node.type === "CallExpression" && node.callee?.name === "summary") {
      summaryCallStart = node.start;
    }
  });
  const summarizedAudit = analyzeFunctionOwnership(
    summarizedFunction,
    ["borrowed"],
    [],
    [summaryCallStart]
  );
  assert.deepEqual(
    summarizedAudit.identifiers,
    [],
    "witness must exercise the former effect-summary exemption gap"
  );
  assert.throws(
    () => assertSupportedOwnershipPrelude(
      summarizedFunction,
      summarizedAudit.boundary,
      "hostile.mjs"
    ),
    /suspension combined with destructuring/u
  );

  let releasePause;
  const paused = new Promise((resolve) => { releasePause = resolve; });
  const borrowed = { value: 1 };
  const observedBySummary = [];
  const summary = (value) => {
    observedBySummary.push(value.value);
    return value.value;
  };
  async function runtimeWitness(value) {
    let ignored;
    [ignored = summary(value)] = await paused;
    return ignored;
  }
  const pending = runtimeWitness(borrowed);
  borrowed.value = 2;
  releasePause([undefined]);
  assert.equal(await pending, 2);
  assert.deepEqual(observedBySummary, [2]);
});

test("security boundary AST does not confuse property names with borrowed references", () => {
  const audit = postAwaitBorrowedIdentifiers(`
    await publish(owned);
    return { borrowed: owned.byteLength, value: owned.borrowed };
  `, ["borrowed"]);
  assert.deepEqual(audit.identifiers, []);
});
