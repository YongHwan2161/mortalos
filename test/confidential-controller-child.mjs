import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { deserialize } from "node:v8";
import {
  beginConfidentialPlacementReproof,
  commitConfidentialPlacementJournal,
  loadConfidentialPlacementJournal
} from "../lab/placement/confidential-controller.mjs";
import {
  createConfidentialPlacementJournal,
  evaluateConfidentialPlacementReproof
} from "../src/placement/confidential.mjs";

function evaluationOptions(input, placements = input.placements) {
  return {
    evaluated_at_ms: input.evaluated_at_ms,
    placements,
    prior_journal_bytes: input.prior_journal_bytes,
    reproof_context_bytes: input.reproof_context_bytes,
    unavailable_provider_ids: input.unavailable_provider_ids
  };
}

function attempt(input, options = evaluationOptions(input)) {
  try {
    const evaluation = evaluateConfidentialPlacementReproof(options);
    const journal = createConfidentialPlacementJournal({
      evaluation,
      prior_journal_bytes: input.prior_journal_bytes,
      reproof_context_bytes: input.reproof_context_bytes
    });
    return { error: null, journal: journal.journal_id };
  } catch (error) {
    return {
      error: typeof error?.message === "string" ? error.message : "rejected",
      journal: null
    };
  }
}

function poisonCorpus(input) {
  const results = {};
  const fakePlacements = [0, 1, 2].map((shardIndex) => ({
    challenge_sequence: "0",
    issued_at_ms: "1500",
    lease_id: `lease-${shardIndex}`,
    previous_execution_receipt_id: null,
    provider_id: `peer:${String.fromCharCode(65 + shardIndex).repeat(43)}`,
    reason: null,
    receipt_id: `resource-execution:${String.fromCharCode(68 + shardIndex).repeat(43)}`,
    shard_index: shardIndex,
    status: "proved",
    workload_id: `resource-workload:${"W".repeat(43)}`
  }));

  const emptyPlacements = [];
  const originalArrayMap = Object.getOwnPropertyDescriptor(Array.prototype, "map");
  let selectiveMapCalls = 0;
  try {
    Object.defineProperty(Array.prototype, "map", {
      ...originalArrayMap,
      value(callback, thisArgument) {
        if (this === emptyPlacements) {
          selectiveMapCalls += 1;
          return fakePlacements;
        }
        return Reflect.apply(originalArrayMap.value, this, [callback, thisArgument]);
      }
    });
    results.selective_array_map = attempt(input, evaluationOptions(input, emptyPlacements));
  } finally {
    Object.defineProperty(Array.prototype, "map", originalArrayMap);
  }
  results.selective_array_map.calls = selectiveMapCalls;

  let proxyMapGets = 0;
  const proxyPlacements = new Proxy([], {
    get(target, property, receiver) {
      if (property === "map") {
        proxyMapGets += 1;
        return () => fakePlacements;
      }
      return Reflect.get(target, property, receiver);
    }
  });
  results.proxy_array_method = attempt(input, evaluationOptions(input, proxyPlacements));
  results.proxy_array_method.gets = proxyMapGets;

  for (const [name, prototype, property] of [
    ["map_get", Map.prototype, "get"],
    ["set_has", Set.prototype, "has"]
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    let calls = 0;
    try {
      Object.defineProperty(prototype, property, {
        ...descriptor,
        value(...argumentsList) {
          calls += 1;
          return Reflect.apply(descriptor.value, this, argumentsList);
        }
      });
      results[name] = attempt(input, evaluationOptions(input, []));
    } finally {
      Object.defineProperty(prototype, property, descriptor);
    }
    results[name].calls = calls;
  }

  let optionAccessorGets = 0;
  const optionAccessor = evaluationOptions(input, []);
  Object.defineProperty(optionAccessor, "placements", {
    enumerable: true,
    get() {
      optionAccessorGets += 1;
      return fakePlacements;
    }
  });
  results.option_accessor = attempt(input, optionAccessor);
  results.option_accessor.gets = optionAccessorGets;

  let optionProxyGets = 0;
  const optionProxy = new Proxy(evaluationOptions(input, []), {
    get(target, property, receiver) {
      optionProxyGets += 1;
      if (property === "placements") return fakePlacements;
      return Reflect.get(target, property, receiver);
    }
  });
  results.option_proxy = attempt(input, optionProxy);
  results.option_proxy.gets = optionProxyGets;

  let placementAccessorGets = 0;
  const placementAccessor = { ...input.placements[0] };
  Object.defineProperty(placementAccessor, "shard_index", {
    enumerable: true,
    get() {
      placementAccessorGets += 1;
      return 0;
    }
  });
  results.placement_accessor = attempt(
    input,
    evaluationOptions(input, [placementAccessor])
  );
  results.placement_accessor.gets = placementAccessorGets;

  let placementProxyGets = 0;
  const placementProxy = new Proxy({}, {
    get(_target, property) {
      placementProxyGets += 1;
      return input.placements[0][property];
    }
  });
  results.placement_proxy = attempt(input, evaluationOptions(input, [placementProxy]));
  results.placement_proxy.gets = placementProxyGets;

  results.sparse_placements = attempt(
    input,
    evaluationOptions(input, new Array(3))
  );
  return results;
}

function loadWithSelectiveSelfRestoringMapPoison(directory) {
  const originalMap = Object.getOwnPropertyDescriptor(Array.prototype, "map");
  let calls = 0;
  let error = null;
  let generation = null;
  try {
    Object.defineProperty(Array.prototype, "map", {
      ...originalMap,
      value(callback, thisArgument) {
        calls += 1;
        Object.defineProperty(Array.prototype, "map", originalMap);
        let oldestPointer;
        for (let index = 0; index < this.length; index += 1) {
          const entry = this[index];
          if (
            typeof entry === "string" &&
            /^pointer-/u.test(entry) &&
            (oldestPointer === undefined || entry < oldestPointer)
          ) {
            oldestPointer = entry;
          }
        }
        return oldestPointer === undefined
          ? Reflect.apply(originalMap.value, this, [callback, thisArgument])
          : Reflect.apply(originalMap.value, [oldestPointer], [callback, thisArgument]);
      }
    });
    generation = loadConfidentialPlacementJournal(directory).generation;
  } catch (caught) {
    error = typeof caught?.message === "string" ? caught.message : "rejected";
  } finally {
    Object.defineProperty(Array.prototype, "map", originalMap);
  }
  return { calls, error, generation };
}

function commitInput(directory, input) {
  return commitConfidentialPlacementJournal({
    ...input,
    directory
  });
}

function waitForRelease(path) {
  const waitState = new Int32Array(new SharedArrayBuffer(4));
  while (!existsSync(path)) Atomics.wait(waitState, 0, 0, 10);
}

function contestedCommit(directory, documentPath, readyPath, releasePath) {
  const input = deserialize(readFileSync(documentPath));
  writeFileSync(readyPath, String(process.pid), { flag: "wx" });
  waitForRelease(releasePath);
  try {
    return {
      outcome: "success",
      result: commitInput(directory, input)
    };
  } catch (error) {
    return {
      code: typeof error?.code === "string" ? error.code : null,
      message: typeof error?.message === "string" ? error.message : "rejected",
      outcome: "error"
    };
  }
}

const [action, directory, documentPath, readyPath, releasePath] = process.argv.slice(2);
if (action === "begin") {
  const input = deserialize(readFileSync(documentPath));
  const result = beginConfidentialPlacementReproof({
    ...input,
    directory
  });
  process.stdout.write(JSON.stringify({
    reproof_context_id: result.reproof_context_id,
    status: result.status
  }));
} else if (action === "commit") {
  const input = deserialize(readFileSync(documentPath));
  const result = commitInput(directory, input);
  process.stdout.write(JSON.stringify(result));
} else if (action === "commit-contended") {
  process.stdout.write(JSON.stringify(
    contestedCommit(directory, documentPath, readyPath, releasePath)
  ));
} else if (action === "load") {
  const restored = loadConfidentialPlacementJournal(directory);
  writeFileSync(documentPath, restored.journal_bytes);
  process.stdout.write(JSON.stringify({
    generation: restored.generation,
    journal_id: restored.journal_id,
    status: "loaded"
  }));
} else if (action === "poison") {
  const input = deserialize(readFileSync(documentPath));
  process.stdout.write(JSON.stringify(poisonCorpus(input)));
} else if (action === "load-map-poison") {
  process.stdout.write(JSON.stringify(loadWithSelectiveSelfRestoringMapPoison(directory)));
} else {
  throw new Error(
    "begin, commit, commit-contended, load, load-map-poison, or poison action required"
  );
}
