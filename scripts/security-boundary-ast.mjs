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

function bindingNames(pattern, names = []) {
  if (!pattern) return names;
  if (pattern.type === "Identifier") names.push(pattern.name);
  else if (pattern.type === "RestElement") bindingNames(pattern.argument, names);
  else if (pattern.type === "AssignmentPattern") bindingNames(pattern.left, names);
  else if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) bindingNames(element, names);
  } else if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      bindingNames(property.type === "RestElement" ? property.argument : property.value, names);
    }
  }
  return names;
}

function calleeName(node) {
  if (node?.type === "Identifier") return node.name;
  if (
    node?.type === "MemberExpression" &&
    !node.computed &&
    node.object?.type === "Identifier" &&
    node.property?.type === "Identifier"
  ) {
    return `${node.object.name}.${node.property.name}`;
  }
  return null;
}

function isInsideOwnershipCall(ancestors, ownershipPrimitives) {
  return ancestors.slice(0, -1).some((candidate, index) => {
    if (candidate.type !== "CallExpression") return false;
    const child = ancestors[index + 1];
    return candidate.arguments.some((argument) => contains(argument, child)) &&
      ownershipPrimitives.has(calleeName(candidate.callee));
  });
}

function taintSources(node, tainted, ownershipPrimitives) {
  if (!node) return new Set();
  const sources = new Set();
  ancestor(node, {
    Identifier(identifier, ancestors) {
      if (
        !tainted.has(identifier.name) ||
        !isIdentifierReference(identifier, ancestors) ||
        isInsideOwnershipCall(ancestors, ownershipPrimitives)
      ) {
        return;
      }
      for (const source of tainted.get(identifier.name)) sources.add(source);
    }
  });
  return sources;
}

function mergeTaint(tainted, names, sources) {
  let changed = false;
  for (const name of names) {
    const current = tainted.get(name) ?? new Set();
    for (const source of sources) {
      if (!current.has(source)) {
        current.add(source);
        changed = true;
      }
    }
    if (current.size > 0) tainted.set(name, current);
  }
  return changed;
}

export function parseSecurityModule(source) {
  return parse(source, PARSE_OPTIONS);
}

export function findSecurityEntrypoint(ast, entrypoint) {
  const exported = entrypoint.match(/^export async function ([A-Za-z_$][\w$]*)$/u);
  const internalFunction = entrypoint.match(/^async function ([A-Za-z_$][\w$]*)$/u);
  const privateMethod = entrypoint.match(/^async #([A-Za-z_$][\w$]*)$/u);
  const classMethod = entrypoint.match(
    /^([A-Za-z_$][\w$]*)\.(static )?async (#[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)$/u
  );
  if (classMethod) {
    const className = classMethod[1];
    const isStatic = Boolean(classMethod[2]);
    const methodName = classMethod[3];
    for (const statement of ast.body) {
      const declaration = statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
      if (declaration?.type !== "ClassDeclaration" || declaration.id?.name !== className) continue;
      for (const method of declaration.body.body) {
        const actualName = method.key?.type === "PrivateIdentifier"
          ? `#${method.key.name}`
          : method.key?.name;
        if (method.value?.async && method.static === isStatic && actualName === methodName) {
          return method.value;
        }
      }
    }
    return null;
  }
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
      internalFunction &&
      node.type === "FunctionDeclaration" &&
      node.async &&
      node.id?.name === internalFunction[1]
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

export function discoverExportedAsyncSecurityEntrypoints(ast) {
  const discovered = [];
  for (const statement of ast.body) {
    if (statement.type !== "ExportNamedDeclaration" || !statement.declaration) continue;
    const declaration = statement.declaration;
    if (declaration.type === "FunctionDeclaration" && declaration.async) {
      discovered.push(`export async function ${declaration.id.name}`);
    }
    if (declaration.type !== "ClassDeclaration") continue;
    for (const method of declaration.body.body) {
      if (!method.value?.async || method.kind === "constructor") continue;
      const name = method.key.type === "PrivateIdentifier"
        ? `#${method.key.name}`
        : method.key.name;
      discovered.push(
        `${declaration.id.name}.${method.static ? "static " : ""}async ${name}`
      );
    }
  }
  return discovered.sort();
}

export function analyzeFunctionOwnership(functionNode, forbidden, ownershipPrimitives = []) {
  if (!functionNode?.async || functionNode.body?.type !== "BlockStatement") {
    throw new TypeError("async function node with a block body required");
  }
  const forbiddenSet = new Set(forbidden);
  const primitiveSet = new Set(ownershipPrimitives);
  const awaits = [];
  const assignments = [];
  ancestor(functionNode.body, {
    AwaitExpression(node, ancestors) {
      if (!hasNestedFunctionAncestor(ancestors)) awaits.push(node);
    },
    AssignmentExpression(node) {
      assignments.push({ expression: node.right, pattern: node.left, start: node.start });
    },
    VariableDeclarator(node) {
      assignments.push({ expression: node.init, pattern: node.id, start: node.start });
    }
  });
  awaits.sort((left, right) => left.start - right.start);
  const firstAwait = awaits[0] ?? null;
  if (!firstAwait) {
    return { boundary: -1, firstAwait: -1, identifiers: [] };
  }
  const tainted = new Map([...forbiddenSet].map((name) => [name, new Set([name])]));
  assignments.sort((left, right) => left.start - right.start);
  let changed = true;
  while (changed) {
    changed = false;
    for (const assignment of assignments) {
      const sources = taintSources(assignment.expression, tainted, primitiveSet);
      if (sources.size > 0) {
        changed = mergeTaint(tainted, bindingNames(assignment.pattern), sources) || changed;
      }
    }
  }
  const references = [];
  ancestor(functionNode.body, {
    Identifier(node, ancestors) {
      if (
        !tainted.has(node.name) ||
        !isIdentifierReference(node, ancestors) ||
        isInsideOwnershipCall(ancestors, primitiveSet)
      ) {
        return;
      }
      references.push({ ancestors: [...ancestors], node });
    }
  });
  const identifiers = [];
  for (const reference of references) {
    const nestedClosure = hasNestedFunctionAncestor(reference.ancestors);
    const repeatingLoop = reference.ancestors.some((ancestorNode) =>
      LOOP_TYPES.has(ancestorNode.type) &&
      awaits.some((awaitNode) => contains(ancestorNode, awaitNode))
    );
    if (reference.node.start > firstAwait.start || nestedClosure || repeatingLoop) {
      if (!identifiers.includes(reference.node.name)) identifiers.push(reference.node.name);
    }
  }
  return {
    boundary: firstAwait.end,
    firstAwait: firstAwait.start,
    identifiers,
    tainted: Object.freeze(Object.fromEntries(
      [...tainted].map(([name, sources]) => [name, Object.freeze([...sources].sort())])
    ))
  };
}

export function analyzePostAwaitBorrowedIdentifiers(source, forbidden, ownershipPrimitives = []) {
  const wrapped = `async function __mortalosSecurityBoundary__() {\n${source}\n}`;
  const ast = parseSecurityModule(wrapped);
  return analyzeFunctionOwnership(ast.body[0], forbidden, ownershipPrimitives);
}
