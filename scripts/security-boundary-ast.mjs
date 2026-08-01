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
    const containingParameter = candidate.params.find((parameter) => contains(parameter, node));
    if (
      containingParameter &&
      !parameterExecutionRoots(containingParameter).some((root) => contains(root, node))
    ) {
      return false;
    }
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
  else if (pattern.type === "MemberExpression") {
    let target = pattern.object;
    while (target?.type === "MemberExpression") target = target.object;
    if (target?.type === "Identifier") names.push(target.name);
  }
  else if (pattern.type === "RestElement" || pattern.type === "SpreadElement") {
    bindingNames(pattern.argument, names);
  }
  else if (pattern.type === "AssignmentPattern") bindingNames(pattern.left, names);
  else if (pattern.type === "ArrayPattern" || pattern.type === "ArrayExpression") {
    for (const element of pattern.elements) bindingNames(element, names);
  } else if (pattern.type === "ObjectPattern" || pattern.type === "ObjectExpression") {
    for (const property of pattern.properties) {
      bindingNames(
        property.type === "RestElement" || property.type === "SpreadElement"
          ? property.argument
          : property.value,
        names
      );
    }
  }
  return names;
}

function isSideEffectFreeVerifiedArgument(node) {
  if (!node) return true;
  if (
    node.type === "Identifier" ||
    node.type === "Literal" ||
    node.type === "ThisExpression"
  ) {
    return true;
  }
  if (node.type === "ArrayExpression") {
    return node.elements.every((element) =>
      element?.type !== "SpreadElement" && isSideEffectFreeVerifiedArgument(element)
    );
  }
  if (node.type === "ObjectExpression") {
    return node.properties.every((property) =>
      property.type === "Property" &&
      property.kind === "init" &&
      !property.computed &&
      !property.method &&
      isSideEffectFreeVerifiedArgument(property.value)
    );
  }
  return false;
}

function isInsideOwnershipCall(ancestors, ownershipCallStarts) {
  return ancestors.slice(0, -1).some((candidate, index) => {
    if (candidate.type !== "CallExpression") return false;
    const child = ancestors[index + 1];
    return ownershipCallStarts.has(candidate.start) &&
      candidate.arguments.some((argument) =>
        contains(argument, child) && isSideEffectFreeVerifiedArgument(argument)
      );
  });
}

function taintSources(node, tainted, ownershipCallStarts) {
  if (!node) return new Set();
  const sources = new Set();
  ancestor(node, {
    Identifier(identifier, ancestors) {
      if (
        !tainted.has(identifier.name) ||
        !isIdentifierReference(identifier, ancestors) ||
        isInsideOwnershipCall(ancestors, ownershipCallStarts)
      ) {
        return;
      }
      for (const source of tainted.get(identifier.name)) sources.add(source);
    },
    ThisExpression(node, ancestors) {
      if (!tainted.has("this") || isInsideOwnershipCall(ancestors, ownershipCallStarts)) {
        return;
      }
      for (const source of tainted.get("this")) sources.add(source);
    }
  });
  return sources;
}

function callParts(node) {
  if (node.type === "TaggedTemplateExpression") {
    return { callee: node.tag, arguments: node.quasi.expressions };
  }
  return { callee: node.callee, arguments: node.arguments };
}

function callableRootName(callee) {
  let root = callee;
  while (root?.type === "MemberExpression" || root?.type === "ChainExpression") {
    root = root.type === "ChainExpression" ? root.expression : root.object;
  }
  return root?.type === "Identifier" ? root.name : null;
}

function mutationAssignment(node, localBindingNames, effectSummaryCallStarts) {
  const parts = callParts(node);
  const callableRoot = callableRootName(parts.callee) ?? "computed-callee";
  const targets = [...parts.arguments];
  if (parts.callee?.type === "MemberExpression") targets.unshift(parts.callee.object);
  if (parts.callee?.type === "Identifier" && localBindingNames.has(parts.callee.name)) {
    targets.unshift(parts.callee);
  }
  const sources = [parts.callee, ...parts.arguments];
  return {
    effectTargets: targets,
    expression: {
      end: node.end,
      start: node.start,
      type: "ArrayExpression",
      elements: sources
    },
    // A lexical "local" name is not evidence that callable authority is local:
    // it may alias an import, global, parameter, Proxy, or composite expression.
    // Only an exact verifier-proven effect-summary call site may suppress this.
    ambientEffect: !effectSummaryCallStarts.has(node.start),
    callableRoot,
    start: node.start
  };
}

function referenceRootNames(node, ownershipCallStarts, localBindingNames) {
  if (!node) return [];
  const names = new Set();
  ancestor(node, {
    Identifier(identifier, ancestors) {
      const call = ancestors.slice(0, -1).findLast((candidate) =>
        candidate.type === "CallExpression" ||
        candidate.type === "NewExpression" ||
        candidate.type === "TaggedTemplateExpression"
      );
      const callee = call ? callParts(call).callee : null;
      const isCallee = callee && contains(callee, identifier);
      const isReceiver = callee?.type === "MemberExpression" &&
        contains(callee.object, identifier);
      const localCallable = callee?.type === "Identifier" &&
        callee === identifier &&
        localBindingNames.has(identifier.name);
      if (
        isIdentifierReference(identifier, ancestors) &&
        (!isCallee || isReceiver || localCallable) &&
        !isInsideOwnershipCall(ancestors, ownershipCallStarts)
      ) {
        names.add(identifier.name);
      }
    },
    ThisExpression(node, ancestors) {
      if (!isInsideOwnershipCall(ancestors, ownershipCallStarts)) names.add("this");
    }
  });
  return [...names];
}

function connectAliases(aliases, leftNames, rightNames) {
  for (const left of leftNames) {
    for (const right of rightNames) {
      if (left === right) continue;
      if (!aliases.has(left)) aliases.set(left, new Set());
      if (!aliases.has(right)) aliases.set(right, new Set());
      aliases.get(left).add(right);
      aliases.get(right).add(left);
    }
  }
}

function aliasClosure(names, aliases) {
  const closure = new Set(names);
  const pending = [...closure];
  while (pending.length > 0) {
    const name = pending.pop();
    for (const alias of aliases.get(name) ?? []) {
      if (closure.has(alias)) continue;
      closure.add(alias);
      pending.push(alias);
    }
  }
  return closure;
}

function mergeTaint(tainted, names, sources, aliases) {
  let changed = false;
  for (const name of aliasClosure(names, aliases)) {
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

export function findFirstSuspension(functionNode) {
  if (!functionNode?.async || functionNode.body?.type !== "BlockStatement") {
    throw new TypeError("async function node with a block body required");
  }
  const suspensions = [];
  ancestor(functionNode.body, {
    AwaitExpression(node, ancestors) {
      if (!hasNestedFunctionAncestor(ancestors)) suspensions.push(node);
    },
    ForOfStatement(node, ancestors) {
      if (!node.await || hasNestedFunctionAncestor(ancestors)) return;
      suspensions.push({ end: node.right.end, start: node.right.end, type: "ForAwaitSuspension" });
    },
    YieldExpression(node, ancestors) {
      if (!hasNestedFunctionAncestor(ancestors)) suspensions.push(node);
    }
  });
  // For nested awaits, the inner operand suspends before the lexically earlier
  // outer AwaitExpression. Source-end order is the conservative evaluation order
  // for the supported expression grammar and also orders sibling awaits left-to-right.
  suspensions.sort((left, right) => left.end - right.end || left.start - right.start);
  return suspensions[0] ?? null;
}

function walkAuditRoots(functionNode, visitors) {
  for (const parameter of functionNode.params) ancestor(parameter, visitors);
  ancestor(functionNode.body, visitors);
}

function parameterExecutionRoots(pattern, roots = []) {
  if (!pattern) return roots;
  if (pattern.type === "AssignmentPattern") {
    roots.push(pattern.right);
    parameterExecutionRoots(pattern.left, roots);
  } else if (pattern.type === "RestElement") {
    parameterExecutionRoots(pattern.argument, roots);
  } else if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) parameterExecutionRoots(element, roots);
  } else if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "RestElement") {
        parameterExecutionRoots(property.argument, roots);
      } else {
        if (property.computed) roots.push(property.key);
        parameterExecutionRoots(property.value, roots);
      }
    }
  }
  return roots;
}

function walkReferenceRoots(functionNode, visitors) {
  for (const parameter of functionNode.params) {
    for (const root of parameterExecutionRoots(parameter)) ancestor(root, visitors);
  }
  ancestor(functionNode.body, visitors);
}

export function analyzeFunctionOwnership(
  functionNode,
  forbidden,
  ownershipCallStarts = [],
  effectSummaryCallStarts = []
) {
  if (!functionNode?.async || functionNode.body?.type !== "BlockStatement") {
    throw new TypeError("async function node with a block body required");
  }
  const forbiddenSet = new Set(forbidden);
  const trustedCallStarts = new Set(ownershipCallStarts);
  const summarizedCallStarts = new Set(effectSummaryCallStarts);
  const firstAwait = findFirstSuspension(functionNode);
  if (!firstAwait) {
    return { boundary: -1, firstAwait: -1, identifiers: [] };
  }
  const assignments = [];
  const localBindingNames = new Set();
  for (const parameter of functionNode.params) {
    for (const name of bindingNames(parameter)) localBindingNames.add(name);
  }
  full(functionNode.body, (node) => {
    if (node.type === "FunctionDeclaration" && node.id) {
      localBindingNames.add(node.id.name);
    }
    if (node.type === "ClassDeclaration" && node.id) {
      localBindingNames.add(node.id.name);
    }
    if (node.type === "VariableDeclarator") {
      for (const name of bindingNames(node.id)) localBindingNames.add(name);
    }
    if (node.type === "CatchClause") {
      for (const name of bindingNames(node.param)) localBindingNames.add(name);
    }
  });
  walkAuditRoots(functionNode, {
    CallExpression(node, ancestors) {
      const repeatsAcrossSuspension = ancestors.some((ancestorNode) =>
        LOOP_TYPES.has(ancestorNode.type) && contains(ancestorNode, firstAwait)
      );
      const outsideTrustedPhase =
        hasNestedFunctionAncestor(ancestors) ||
        node.end > firstAwait.end ||
        repeatsAcrossSuspension;
      if (outsideTrustedPhase) {
        trustedCallStarts.delete(node.start);
        summarizedCallStarts.delete(node.start);
      }
    }
  });
  walkAuditRoots(functionNode, {
    AssignmentPattern(node) {
      assignments.push({ alias: true, expression: node.right, pattern: node.left, start: node.start });
    },
    AssignmentExpression(node) {
      assignments.push({ alias: true, expression: node.right, pattern: node.left, start: node.start });
    },
    CallExpression(node) {
      if (!trustedCallStarts.has(node.start) && !summarizedCallStarts.has(node.start)) {
        assignments.push(mutationAssignment(node, localBindingNames, summarizedCallStarts));
      }
    },
    FunctionDeclaration(node) {
      if (node.id) {
        assignments.push({ alias: true, expression: node.body, pattern: node.id, start: node.start });
      }
    },
    ClassDeclaration(node) {
      if (node.id) {
        assignments.push({ alias: true, expression: node.body, pattern: node.id, start: node.start });
      }
    },
    NewExpression(node) {
      assignments.push(mutationAssignment(node, localBindingNames, summarizedCallStarts));
    },
    TaggedTemplateExpression(node) {
      assignments.push(mutationAssignment(node, localBindingNames, summarizedCallStarts));
    },
    VariableDeclarator(node) {
      assignments.push({ alias: true, expression: node.init, pattern: node.id, start: node.start });
    }
  });
  assignments.sort((left, right) => left.start - right.start);
  const aliases = new Map();
  for (const assignment of assignments) {
    if (!assignment.alias) continue;
    connectAliases(
      aliases,
      bindingNames(assignment.pattern),
      referenceRootNames(assignment.expression, trustedCallStarts, localBindingNames)
    );
  }
  const tainted = new Map();
  const ambientEffects = new Set();
  for (const name of forbiddenSet) mergeTaint(tainted, [name], new Set([name]), aliases);
  if (functionNode.type !== "ArrowFunctionExpression" && forbiddenSet.size > 0) {
    mergeTaint(tainted, ["arguments"], forbiddenSet, aliases);
  }
  if (functionNode.type === "FunctionDeclaration" && forbiddenSet.size > 0) {
    mergeTaint(tainted, ["this"], forbiddenSet, aliases);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const assignment of assignments) {
      const sources = taintSources(assignment.expression, tainted, trustedCallStarts);
      if (sources.size > 0) {
        if (assignment.ambientEffect && assignment.start < firstAwait.end) {
          ambientEffects.add(assignment.callableRoot);
        }
        const targetNames = assignment.effectTargets
          ? assignment.effectTargets.flatMap((target) =>
              referenceRootNames(target, trustedCallStarts, localBindingNames)
            )
          : bindingNames(assignment.pattern);
        changed = mergeTaint(
          tainted,
          targetNames,
          sources,
          aliases
        ) || changed;
      }
    }
  }
  const references = [];
  walkReferenceRoots(functionNode, {
    Identifier(node, ancestors) {
      if (
        !tainted.has(node.name) ||
        !isIdentifierReference(node, ancestors) ||
        isInsideOwnershipCall(ancestors, trustedCallStarts)
      ) {
        return;
      }
      references.push({ ancestors: [...ancestors], node });
    },
    ThisExpression(node, ancestors) {
      if (!tainted.has("this") || isInsideOwnershipCall(ancestors, trustedCallStarts)) {
        return;
      }
      references.push({ ancestors: [...ancestors], node });
    }
  });
  const identifiers = [];
  for (const reference of references) {
    const referenceName = reference.node.type === "ThisExpression"
      ? "this"
      : reference.node.name;
    const nestedClosure = hasNestedFunctionAncestor(reference.ancestors);
    const insideEffectSummary = isInsideOwnershipCall(
      reference.ancestors,
      summarizedCallStarts
    );
    const unsafePreludeUse = reference.node.start < firstAwait.end && !insideEffectSummary;
    const repeatingLoop = reference.ancestors.some((ancestorNode) =>
      LOOP_TYPES.has(ancestorNode.type) &&
      contains(ancestorNode, firstAwait)
    );
    if (
      unsafePreludeUse ||
      reference.node.start > firstAwait.start ||
      nestedClosure ||
      repeatingLoop
    ) {
      if (!identifiers.includes(referenceName)) identifiers.push(referenceName);
    }
  }
  for (const callableRoot of [...ambientEffects].sort()) {
    identifiers.push(`ambient:${callableRoot}`);
  }
  return {
    boundary: firstAwait.end,
    firstAwait: firstAwait.start,
    identifiers,
    suspensionType: firstAwait.type,
    tainted: Object.freeze(Object.fromEntries(
      [...tainted].map(([name, sources]) => [name, Object.freeze([...sources].sort())])
    ))
  };
}

export function analyzePostAwaitBorrowedIdentifiers(source, forbidden, ownershipCallStarts = []) {
  const wrapped = `async function __mortalosSecurityBoundary__() {\n${source}\n}`;
  const ast = parseSecurityModule(wrapped);
  return analyzeFunctionOwnership(ast.body[0], forbidden, ownershipCallStarts);
}
