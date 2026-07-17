import fork from "../test/vectors/fork.json";
import lifecycle from "../test/vectors/lifecycle.json";
import { canonicalBytes } from "../src/index.mjs";
import { createEvidenceBundle } from "./evidence-export.mjs";
import { BrowserIncubator } from "./live-incubator.mjs";
import { runReferenceProof } from "./reference-engine.mjs";
import { SCENARIO_REQUEST_FORMAT } from "./scenario-contract.mjs";
import { compileScenario, runCompiledScenario } from "./scenario-compiler.mjs";

const byId = (id) => document.getElementById(id);
const liveStatus = byId("live-status");
const createButton = byId("create-live");
const oneButton = byId("try-one");
const completeButton = byId("complete-quorum");
const replayButton = byId("replay-live");
const retireButton = byId("retire-live");
const exportButton = byId("export-live");
const firstSigner = byId("first-signer");
const secondSigner = byId("second-signer");
const incubator = new BrowserIncubator();
const scenarioClientId = crypto.randomUUID();
let referenceProof = null;
let corpusProof = null;
let lastBundle = null;
let guidedScenario = null;
let logIndex = 1;

function verdict(result) {
  return result?.code ?? result?.status ?? "unknown";
}

function shorten(value, start = 16, end = 8) {
  if (!value || value.length <= start + end + 1) return value ?? "—";
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function setStatus(element, text, state = "neutral") {
  element.textContent = text;
  element.className = `status ${state}`;
  element.dataset.state = state;
}

function log(message) {
  const entry = document.createElement("li");
  entry.textContent = `${String(logIndex).padStart(2, "0")} · ${message}`;
  logIndex += 1;
  byId("event-log").append(entry);
}

function buttonBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    delete button.dataset.label;
  }
}

function renderCustodians(custodians) {
  const container = byId("custodian-cards");
  container.replaceChildren();
  custodians.forEach((custodian, index) => {
    const card = document.createElement("article");
    card.className = "custodian";
    card.dataset.keyId = custodian.key_id;
    const label = document.createElement("span");
    label.textContent = String.fromCharCode(65 + index);
    const key = document.createElement("p");
    key.textContent = shorten(custodian.key_id, 18, 9);
    key.title = custodian.key_id;
    const security = document.createElement("small");
    security.textContent = custodian.private_extractable === false && custodian.private_export_rejected
      ? "private export blocked"
      : "security self-test failed";
    card.append(label, key, security);
    container.append(card);
  });
}

function renderLiveState() {
  const state = incubator.publicState;
  byId("live-identity").textContent = shorten(state.organism_id, 20, 10);
  byId("live-identity").title = state.organism_id ?? "";
  byId("live-sequence").textContent = state.sequence === null ? "—" : `sequence ${state.sequence}`;
  if (state.custodians.length) renderCustodians(state.custodians);
}

function handleError(error, scope = "Lab") {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(liveStatus, `${scope} failed`, "reject");
  log(`${scope} failed closed: ${message}`);
}

createButton.addEventListener("click", async () => {
  buttonBusy(createButton, true, "Creating…");
  setStatus(liveStatus, "Generating three keys", "busy");
  try {
    const { result } = await incubator.birth();
    renderLiveState();
    setStatus(liveStatus, "Genesis accepted", "accept");
    log(`Live Genesis ${result.status}; identity ${result.organism_id}`);
    createButton.disabled = true;
    oneButton.disabled = false;
    exportButton.disabled = false;
  } catch (error) {
    handleError(error, "Live birth");
    createButton.disabled = false;
  } finally {
    buttonBusy(createButton, false);
  }
});

oneButton.addEventListener("click", async () => {
  buttonBusy(oneButton, true, `Asking custodian ${String.fromCharCode(65 + Number(firstSigner.value))}…`);
  try {
    if (firstSigner.value === secondSigner.value) throw new Error("choose two different custodians");
    const result = await incubator.tryOneSigner(Number(firstSigner.value));
    byId("one-key-verdict").textContent = verdict(result);
    log(`One-signature candidate: ${verdict(result)}`);
    oneButton.disabled = true;
    completeButton.disabled = false;
    firstSigner.disabled = true;
    secondSigner.disabled = true;
  } catch (error) {
    handleError(error, "One-signature check");
    oneButton.disabled = false;
  } finally {
    buttonBusy(oneButton, false);
  }
});

completeButton.addEventListener("click", async () => {
  buttonBusy(completeButton, true, `Asking custodian ${String.fromCharCode(65 + Number(secondSigner.value))}…`);
  try {
    const result = await incubator.completeHeartbeat(Number(secondSigner.value));
    byId("two-key-verdict").textContent = verdict(result);
    renderLiveState();
    setStatus(liveStatus, "Heartbeat accepted", "accept");
    log(`Same heartbeat body with a second signature: ${verdict(result)} at sequence ${result.sequence}`);
    completeButton.disabled = true;
    replayButton.disabled = false;
    retireButton.disabled = false;
  } catch (error) {
    handleError(error, "Quorum completion");
    completeButton.disabled = false;
  } finally {
    buttonBusy(completeButton, false);
  }
});

replayButton.addEventListener("click", () => {
  try {
    const result = incubator.replayLast();
    byId("replay-verdict").textContent = verdict(result);
    log(`Exact accepted Pulse replay: ${verdict(result)}`);
    replayButton.disabled = true;
  } catch (error) {
    handleError(error, "Replay check");
  }
});

retireButton.addEventListener("click", async () => {
  buttonBusy(retireButton, true, "Terminating…");
  try {
    const result = await incubator.retire();
    const summary = `${result.mortality.status}; unsigned continuation ${verdict(result.continuation)}`;
    byId("retirement-result").textContent = `${summary}. No irreversible-loss claim was supplied, so death is not proven.`;
    setStatus(liveStatus, "Local authority unavailable", "reject");
    log(`Local Workers terminated: ${summary}`);
    retireButton.disabled = true;
    replayButton.disabled = true;
  } catch (error) {
    handleError(error, "Custodian termination");
    retireButton.disabled = false;
  } finally {
    buttonBusy(retireButton, false);
  }
});

exportButton.addEventListener("click", () => {
  try {
    lastBundle = createEvidenceBundle(incubator.publicState.records);
    const bytes = canonicalBytes(lastBundle);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mortalos-lab-evidence.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    byId("export-digest").textContent = lastBundle.digest;
    log(`Experimental public evidence exported: ${lastBundle.digest}`);
  } catch (error) {
    handleError(error, "Evidence export");
  }
});

function resultRow(label, value, testId) {
  const row = document.createElement("div");
  row.className = "result-row";
  if (testId) row.dataset.testid = testId;
  const name = document.createElement("span");
  name.textContent = label;
  const result = document.createElement("strong");
  result.textContent = String(value);
  row.append(name, result);
  return row;
}

byId("guided-start").addEventListener("click", () => {
  const button = byId("guided-start");
  buttonBusy(button, true, "Running committed evidence…");
  setStatus(byId("guided-status"), "Baseline running", "busy");
  try {
    referenceProof = runReferenceProof({ lifecycle, fork });
    const accepted = referenceProof.steps.filter((step) => step.status === "accept").length;
    byId("guided-baseline").textContent = `${accepted}/${referenceProof.steps.length} lifecycle steps accepted · replay ${referenceProof.replay.code} · fork ${referenceProof.fork.sibling}`;
    setStatus(byId("guided-status"), "Baseline proven", "accept");
    byId("ask-gpt").disabled = false;
    button.disabled = true;
    log("90-second proof baseline established from committed public evidence");
  } catch (error) {
    byId("guided-baseline").textContent = "Failed closed";
    setStatus(byId("guided-status"), "Baseline failed", "reject");
    button.disabled = false;
    log(`Guided baseline failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("ask-gpt").addEventListener("click", async () => {
  const button = byId("ask-gpt");
  buttonBusy(button, true, "GPT proposes; kernel decides…");
  setStatus(byId("guided-status"), "Generating bounded scenario", "busy");
  try {
    if (!referenceProof) throw new Error("run the deterministic baseline first");
    const scenarioKind = byId("scenario-kind").value;
    const hypothesis = byId("scenario-hypothesis").value.trim();
    if (!hypothesis) throw new Error("enter a hypothesis");
    const response = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: scenarioClientId,
        format: SCENARIO_REQUEST_FORMAT,
        hypothesis,
        scenario_kind: scenarioKind
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`scenario API ${payload?.error ?? response.status}`);
    if (!/^gpt-5\.6(?:-|$)/.test(payload?.model ?? "")) throw new Error("unexpected scenario model");
    const compiled = await compileScenario(payload.proposal, scenarioKind);
    const kernel = await runCompiledScenario(compiled);
    const modelPrediction = `${payload.proposal.prediction.status} / ${payload.proposal.prediction.code ?? "no code"}`;
    const kernelActual = `${kernel.actual.status} / ${kernel.actual.code ?? "no code"}`;
    byId("gpt-proposal").textContent = `${payload.model} chose ${compiled.scenario.mutation}`;
    byId("model-prediction").textContent = modelPrediction;
    byId("kernel-actual").textContent = kernelActual;
    byId("compiled-digest").textContent = compiled.digest;
    byId("scenario-rationale").textContent = `Untrusted model note: ${payload.proposal.rationale}`;
    guidedScenario = { compiled, kernel, model: payload.model, proposal: payload.proposal, replay: null };
    byId("replay-without-gpt").disabled = false;
    button.disabled = true;
    byId("scenario-kind").disabled = true;
    byId("scenario-hypothesis").disabled = true;
    setStatus(byId("guided-status"), kernel.matches_trusted_expectation ? "Kernel decided" : "Kernel mismatch", kernel.matches_trusted_expectation ? "accept" : "reject");
    log(`GPT proposal ${compiled.scenario.mutation}; authoritative kernel result ${kernelActual}`);
  } catch (error) {
    byId("gpt-proposal").textContent = "Failed closed; no model output executed";
    setStatus(byId("guided-status"), "Scenario failed closed", "reject");
    button.disabled = false;
    log(`Guided scenario failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("replay-without-gpt").addEventListener("click", async () => {
  const button = byId("replay-without-gpt");
  buttonBusy(button, true, "Replaying exact bytes…");
  try {
    if (!guidedScenario) throw new Error("no compiled scenario exists");
    const replay = await runCompiledScenario(guidedScenario.compiled);
    const identical = JSON.stringify(replay.actual) === JSON.stringify(guidedScenario.kernel.actual);
    if (!identical) throw new Error("offline replay changed the kernel result");
    guidedScenario.replay = replay;
    byId("offline-replay").textContent = `PASS · ${guidedScenario.compiled.digest} · ${replay.actual.status} / ${replay.actual.code ?? "no code"}`;
    setStatus(byId("guided-status"), "GPT-off replay exact", "accept");
    button.disabled = true;
    log(`GPT-off replay byte/result identity: ${guidedScenario.compiled.digest}`);
  } catch (error) {
    byId("offline-replay").textContent = "Failed closed";
    setStatus(byId("guided-status"), "Replay failed", "reject");
    button.disabled = false;
    log(`GPT-off replay failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("run-reference").addEventListener("click", () => {
  const button = byId("run-reference");
  buttonBusy(button, true, "Validating evidence…");
  setStatus(byId("reference-status"), "Running", "busy");
  try {
    referenceProof = runReferenceProof({ lifecycle, fork });
    const results = byId("reference-results");
    results.replaceChildren(
      resultRow("Accepted lifecycle", `${referenceProof.steps.filter((step) => step.status === "accept").length}/${referenceProof.steps.length}`, "reference-lifecycle"),
      resultRow("Complete A/B/C turnover", referenceProof.complete_initial_turnover, "reference-turnover"),
      resultRow("Replay", referenceProof.replay.code, "reference-replay"),
      resultRow("Identity mutation", verdict(referenceProof.mutations.identity), "mutation-identity"),
      resultRow("Payload mutation", verdict(referenceProof.mutations.payload), "mutation-payload"),
      resultRow("Signature mutation", verdict(referenceProof.mutations.signature), "mutation-signature"),
      resultRow("One-approval mutation", verdict(referenceProof.mutations.one_approval), "mutation-quorum"),
      resultRow("Signed sibling", referenceProof.fork.sibling, "reference-fork"),
      resultRow("Post-fork candidate", referenceProof.fork.post_fork, "reference-post-fork"),
      resultRow("Resurrection attempt", referenceProof.resurrection.code, "reference-resurrection"),
      resultRow("Conditional mortality", referenceProof.mortality.status, "reference-mortality"),
      resultRow("Clone identity separate", referenceProof.clone.identity_separate, "reference-clone")
    );
    setStatus(byId("reference-status"), "Kernel proof complete", "accept");
    log(`Reference proof complete; identity ${referenceProof.organism_id}; head ${referenceProof.head_hash}`);
    button.disabled = true;
  } catch (error) {
    setStatus(byId("reference-status"), "Failed closed", "reject");
    log(`Reference proof failed closed: ${error instanceof Error ? error.message : String(error)}`);
    button.disabled = false;
  } finally {
    buttonBusy(button, false);
  }
});

function runCorpus() {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./corpus-worker.js", { type: "module", name: "mortalos-corpus" });
    const id = "complete-portable-corpus";
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("corpus Worker timed out"));
    }, 120_000);
    worker.addEventListener("message", ({ data }) => {
      const allowed = [
        "adversarial_cases", "adversarial_rejected", "exact", "fork", "format", "id",
        "boundary_passed", "boundary_total", "named_passed", "named_total",
        "post_fork", "replay", "shared_memory_available", "type"
      ];
      if (data?.id !== id) return;
      clearTimeout(timer);
      worker.terminate();
      if (data.type === "error") {
        reject(new Error(data.message || "corpus Worker failed"));
      } else if (data.type !== "result" || Object.keys(data).some((key) => !allowed.includes(key))) {
        reject(new Error("corpus Worker response was not allowlisted"));
      } else {
        resolve(data);
      }
    });
    worker.addEventListener("error", (event) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message || "corpus Worker failed"));
    });
    worker.postMessage({ id, type: "run" });
  });
}

byId("run-corpus").addEventListener("click", async () => {
  const button = byId("run-corpus");
  buttonBusy(button, true, "Running 10,000 cases…");
  try {
    corpusProof = await runCorpus();
    if (!corpusProof.exact) throw new Error("browser corpus differs from committed expected result");
    if (!corpusProof.shared_memory_available) {
      throw new Error("cross-origin isolation did not expose SharedArrayBuffer to the corpus Worker");
    }
    byId("corpus-result").textContent = `${corpusProof.named_passed}/${corpusProof.named_total} named · ${corpusProof.boundary_passed}/${corpusProof.boundary_total} boundary · ${corpusProof.adversarial_rejected}/${corpusProof.adversarial_cases} adversarial · SAB rejected · exact`;
    log(`Portable corpus byte-equivalent: ${corpusProof.exact}`);
    button.disabled = true;
  } catch (error) {
    byId("corpus-result").textContent = "Failed closed";
    log(`Portable corpus failed closed: ${error instanceof Error ? error.message : String(error)}`);
    button.disabled = false;
  } finally {
    buttonBusy(button, false);
  }
});

globalThis.addEventListener("pagehide", () => incubator.shutdown());
globalThis.addEventListener("pageshow", (event) => {
  if (event.persisted) globalThis.location.reload();
});

globalThis.__MORTALOS_LAB__ = Object.freeze({
  publicSnapshot() {
    return structuredClone({
      secure_context: globalThis.isSecureContext,
      live: incubator.publicState,
      reference: referenceProof,
      corpus: corpusProof,
      export_bundle: lastBundle,
      scenario: guidedScenario ? {
        compiled_digest: guidedScenario.compiled.digest,
        kernel: guidedScenario.kernel,
        model: guidedScenario.model,
        proposal: guidedScenario.proposal,
        replay: guidedScenario.replay
      } : null
    });
  }
});
