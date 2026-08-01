import { parse } from "acorn";
import { ancestor, full } from "acorn-walk";

const PARSE_OPTIONS = Object.freeze({
  ecmaVersion: "latest",
  sourceType: "module"
});

const LOOP_TYPES = new Set([
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "WhileStatement"
]);

function contains(outer, inner) {
  return outer.start <= inner.start && inner.end <= outer.end;
}

function isFunctionNode(node) {
  return [
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression"
  ].includes(node.type);
}

function hasNestedFunctionAncestor(ancestors) {
  return ancestors.slice(0, -1).some(isFunctionNode);
}

function isIdentifierReference(node, ancestors) {
  const parent = ancestors.at(-2);
  if (!parent) return true;
  if (
    (parent.type === "MemberExpression" || parent.type === "PropertyDefinition") &&
    parent.property === node &&
    !parent.computed
  ) {
    return false;
  }
  if (
    (parent.type === "Property" || parent.type === "MethodDefinition") &&
    parent.key === node &&
    !parent.computed &&
    !parent.shorthand
  ) {
    return false;
  }
  if (
    (parent.type === "BreakStatement" ||
      parent.type === "ContinueStatement" ||
      parent.type === "LabeledStatement") &&
    parent.label === node
  ) {
    return false;
  }
  if (parent.type === "VariableDeclarator" && contains(parent.id, node)) return false;
  if (parent.type === "CatchClause" && parent.param && contains(parent.param, node)) return false;
  for (const candidate of ancestors.slice(0, -1).reverse()) {
    if (!isFunctionNode(candidate)) continue;
    if (candidate.id && contains(candidate.id, node)) return false;
    if (candidate.params.some((parameter) => contains(parameter, node))) return false;
    break;
  }
  if (
    [
      "ClassDeclaration",
      "ClassExpression",
      "ImportDefaultSpecifier",
      "ImportNamespaceSpecifier",
      "ImportSpecifier"
    ].includes(parent.type) &&
    parent.id === node
  ) {
    return false;
  }
  return true;
}

export function parseSecurityModule(source) {
  return parse(source, PARSE_OPTIONS);
}

export function findSecurityEntrypoint(ast, entrypoint) {
  const exported = entrypoint.match(/^export async function ([A-Za-z_$][\w$]*)$/u);
  const privateMethod = entrypoint.match(/^async #([A-Za-z_$][\w$]*)$/u);
  let found = null;
  full(ast, (node) => {
    if (found) return;
    if (
      exported &&
      node.type === "FunctionDeclaration" &&
      node.async &&
      node.id?.name === exported[1]
    ) {
      found = node;
    }
    if (
      privateMethod &&
      node.type === "MethodDefinition" &&
      node.value?.async &&
      node.key?.type === "PrivateIdentifier" &&
      node.key.name === privateMethod[1]
    ) {
      found = node.value;
    }
  });
  return found;
}

export function analyzeFunctionOwnership(functionNode, forbidden) {
  if (!functionNode?.async || functionNode.body?.type !== "BlockStatement") {
    throw new TypeError("async function node with a block body required");
  }
  const forbiddenSet = new Set(forbidden);
  const awaits = [];
  const references = [];
  ancestor(functionNode.body, {
    AwaitExpression(node, ancestors) {
      if (!hasNestedFunctionAncestor(ancestors)) awaits.push(node);
    },
    Identifier(node, ancestors) {
      if (!forbiddenSet.has(node.name) || !isIdentifierReference(node, ancestors)) return;
      references.push({ ancestors: [...ancestors], node });
    }
  });
  awaits.sort((left, right) => left.start - right.start);
  const firstAwait = awaits[0] ?? null;
  if (!firstAwait) {
    return { boundary: -1, firstAwait: -1, identifiers: [] };
  }
  const identifiers = [];
  for (const reference of references) {
    const nestedClosure = hasNestedFunctionAncestor(reference.ancestors);
    const repeatingLoop = reference.ancestors.some((ancestorNode) =>
      LOOP_TYPES.has(ancestorNode.type) &&
      awaits.some((awaitNode) => contains(ancestorNode, awaitNode))
    );
    if (reference.node.start > firstAwait.start || nestedClosure || repeatingLoop) {
      identifiers.push(reference.node.name);
    }
  }
  return {
    boundary: firstAwait.end,
    firstAwait: firstAwait.start,
    identifiers
  };
}

export function analyzePostAwaitBorrowedIdentifiers(source, forbidden) {
  const wrapped = `async function __mortalosSecurityBoundary__() {\n${source}\n}`;
  const ast = parseSecurityModule(wrapped);
  return analyzeFunctionOwnership(ast.body[0], forbidden);
}
