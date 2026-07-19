import fork from "../test/vectors/fork.json";
import lifecycle from "../test/vectors/lifecycle.json";
import qrcode from "qrcode-generator";
import { canonicalBytes, decodeBase64Url, encodeBase64Url } from "../src/index.mjs";
import {
  createEvidenceBundle,
  importEvidenceBundleBytes,
  LAB_EVIDENCE_MAX_BYTES
} from "./evidence-export.mjs";
import { createTranslator, documentLocale } from "./i18n/index.mjs";
import { staticReplacements } from "./i18n/ko.mjs";
import { BrowserIncubator } from "./live-incubator.mjs";
import { DurableParticipant } from "./participant/durable-participant.mjs";
import { LiveEndpointParticipant } from "./participant/live-endpoint.mjs";
import { durableStoreExists } from "./storage/durable-store.mjs";
import { createRoomId, HttpRelayTransport } from "./transport/http-relay.mjs";
import {
  createRelayControlMessage,
  createRelayMessage,
  decodeRelayFrame
} from "../src/transport/protocol.mjs";
import { runReferenceProof } from "./reference-engine.mjs";
import { scenarioApiUrl } from "./runtime-endpoints.mjs";
import { createCuratedScenarioProposal, SCENARIO_REQUEST_FORMAT } from "./scenario-contract.mjs";
import { compileScenario, runCompiledScenario } from "./scenario-compiler.mjs";

const byId = (id) => document.getElementById(id);
let currentLocale = documentLocale();
let t = createTranslator(currentLocale);
const liveStatus = byId("live-status");
const createButton = byId("create-live");
const oneButton = byId("try-one");
const completeButton = byId("complete-quorum");
const replayButton = byId("replay-live");
const nurtureButton = byId("nurture-live");
const retireButton = byId("retire-live");
const exportButton = byId("export-live");
const firstSigner = byId("first-signer");
const secondSigner = byId("second-signer");
const incubator = new BrowserIncubator();
const durableParticipant = new DurableParticipant();
const scenarioClientId = crypto.randomUUID();
byId("public-repository-link").href = ["https:", "", "github.com", "YongHwan2161", "mortalos"].join("/");
let referenceProof = null;
let corpusProof = null;
let lastBundle = null;
let importedProof = null;
let guidedScenario = null;
let deploymentManifestPromise = null;
let turnstileScriptPromise = null;
let turnstileToken = null;
let turnstileWidgetId = null;
let logIndex = 1;
const continuityRoomParameter = new URLSearchParams(globalThis.location.search).get("room");
const continuityJoinMode = new URLSearchParams(globalThis.location.search).get("join") === "1";
const continuityRole = continuityJoinMode ? "B" : "A";
const continuityEndpointId = `${continuityRole}-${encodeBase64Url(crypto.getRandomValues(new Uint8Array(8)))}`;
let continuityParticipant = null;
let continuityTransport = null;
let continuityUnsubscribe = null;
let continuityPresenceTimer = null;
let continuityRoomId = continuityRoomParameter;
let continuityJoinRequest = null;
let continuityProposal = null;
let continuityJoinUrl = null;
let continuityPresence = [];
const continuityProcessed = new Set();
const continuityProgress = {
  create: false,
  join: false,
  handoff: false,
  stalled: false,
  offline: false,
  continue: false
};

const TURNSTILE_ACTION = "mortalos_gpt_scenario";
const TURNSTILE_HEADER = "x-mortalos-turnstile-token";

function replaceCatalogText(value, nextLocale) {
  const pairs = Object.entries(staticReplacements)
    .map(([english, korean]) => nextLocale === "ko" ? [english, korean] : [korean, english])
    .sort(([left], [right]) => right.length - left.length);
  let result = value;
  for (const [source, target] of pairs) result = result.replaceAll(source, target);
  return result;
}

function applyDocumentLocale(nextLocale, { updateHistory = true } = {}) {
  if (nextLocale === currentLocale) return;
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) node.nodeValue = replaceCatalogText(node.nodeValue, nextLocale);
  for (const element of document.querySelectorAll("[aria-label], [title], [placeholder]")) {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, replaceCatalogText(element.getAttribute(attribute), nextLocale));
      }
    }
  }
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = replaceCatalogText(description.content, nextLocale);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = nextLocale === "ko" ? "https://mortal-os.com/ko/" : "https://mortal-os.com/";
  const switchLink = document.querySelector(".language-switch");
  if (switchLink) {
    switchLink.textContent = nextLocale === "ko" ? "English" : "한국어";
    switchLink.href = nextLocale === "ko" ? "/" : "/ko/";
    switchLink.lang = nextLocale === "ko" ? "en" : "ko";
    switchLink.hreflang = switchLink.lang;
  }
  document.documentElement.lang = nextLocale;
  currentLocale = nextLocale;
  t = createTranslator(nextLocale);
  renderLiveState();
  renderDurableState();
  renderContinuity();
  if (updateHistory) history.pushState(
    null,
    "",
    `${nextLocale === "ko" ? "/ko/" : "/"}${globalThis.location.search}${globalThis.location.hash}`
  );
}

document.querySelector(".language-switch")?.addEventListener("click", (event) => {
  event.preventDefault();
  applyDocumentLocale(currentLocale === "en" ? "ko" : "en");
});

globalThis.addEventListener("popstate", () => {
  applyDocumentLocale(globalThis.location.pathname.startsWith("/ko") ? "ko" : "en", { updateHistory: false });
});

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

function continuityTimeline() {
  for (const step of ["create", "join", "handoff", "offline", "continue"]) {
    const order = ["create", "join", "handoff", "offline", "continue"];
    const firstPending = order.find((name) => !continuityProgress[name]);
    byId(`continuity-step-${step}`).dataset.state = continuityProgress.stalled && step === "handoff"
      ? "stalled"
      : continuityProgress[step]
      ? "complete"
      : step === firstPending
        ? "active"
        : "pending";
  }
}

function renderJoinQr(value) {
  const container = byId("continuity-qr");
  container.replaceChildren();
  if (!value) return;
  const code = qrcode(0, "M");
  code.addData(value, "Byte");
  code.make();
  const modules = code.getModuleCount();
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `-4 -4 ${modules + 8} ${modules + 8}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("fill", "#f7fff0");
  background.setAttribute("height", String(modules + 8));
  background.setAttribute("width", String(modules + 8));
  background.setAttribute("x", "-4");
  background.setAttribute("y", "-4");
  const path = document.createElementNS(namespace, "path");
  const commands = [];
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (code.isDark(row, column)) commands.push(`M${column} ${row}h1v1h-1z`);
    }
  }
  path.setAttribute("d", commands.join(""));
  path.setAttribute("fill", "#07110e");
  svg.append(background, path);
  container.append(svg);
}

function continuityHealth() {
  if (!continuityProgress.create) return t("continuityHealthReady");
  if (continuityProgress.stalled) return t("continuityHealthStalled");
  if (continuityProgress.offline) return t("continuityHealthAOffline");
  if (continuityProgress.handoff) return t("continuityHealthMoved");
  if (continuityProgress.join) return t("continuityHealthBothOnline");
  return t("continuityHealthAOnline");
}

function renderContinuityFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error?.code === "string"
    ? error.code
    : message.match(/\b(?:E|R1|RELAY)_[A-Z0-9_]+\b/)?.[0] ?? "continuity_failed";
  byId("continuity-error-code").textContent = `${code} · ${message}`;
  byId("continuity-error-details").hidden = false;
  renderContinuity(t("continuityFailed"), "reject");
}

function renderContinuity(message = null, stateKind = "neutral") {
  const state = continuityParticipant?.publicState ?? null;
  byId("continuity-role").textContent = continuityRole === "A" ? t("continuityRoleA") : t("continuityRoleB");
  byId("continuity-identity").textContent = state?.organism_id ? shorten(state.organism_id, 20, 10) : t("continuityNoIdentity");
  byId("continuity-identity").title = state?.organism_id ?? "";
  byId("continuity-sequence").textContent = state?.sequence ?? "—";
  byId("continuity-state").textContent = t("pulseCount", { count: state?.pulse_count ?? 0 });
  byId("continuity-quorum").textContent = t("continuityQuorum");
  byId("continuity-custody").textContent = state?.signing_authority
    ? continuityRole === "A" ? t("continuityCustodyA") : t("continuityCustodyB")
    : continuityProgress.handoff ? t("continuityCustodyMoved") : t("continuityCustodyNone");
  byId("continuity-relay").textContent = continuityTransport ? t("continuityRelayConnected") : t("continuityRelayDisconnected");
  byId("continuity-health").textContent = continuityHealth();
  byId("continuity-full-identity").textContent = state?.organism_id ?? "—";
  byId("continuity-head").textContent = state?.head_hash ?? "—";
  byId("continuity-state-root").textContent = state?.state_root ?? "—";
  byId("continuity-stage").textContent = continuityProgress.continue
    ? t("continuityStageContinued")
    : continuityProgress.stalled
      ? t("continuityStageStalled")
    : continuityProgress.offline
      ? t("continuityStageOffline")
      : continuityProgress.handoff
        ? t("continuityStageHandoff")
        : continuityProgress.join
          ? t("continuityStageJoined")
          : continuityProgress.create
            ? t("continuityStageCreated")
            : continuityJoinMode
              ? t("continuityStageJoinReady")
              : t("continuityStageReady");
  if (state?.organism_id) {
    const seed = decodeBase64Url(state.organism_id.split(":")[1]);
    const hue = seed ? (seed[0] * 256 + seed[1]) % 360 : 165;
    byId("continuity-avatar").style.setProperty("--avatar-color", `hsl(${hue} 82% 68%)`);
    byId("continuity-avatar").style.setProperty("--avatar-glow", `${0.8 + (state.pulse_count ?? 0) * 0.12}rem`);
  }
  byId("continuity-create").hidden = continuityJoinMode;
  byId("continuity-join").hidden = !continuityJoinMode;
  byId("continuity-create").disabled = Boolean(continuityParticipant);
  byId("continuity-join").disabled = Boolean(continuityParticipant) || !/^[A-Za-z0-9_-]{22}$/.test(continuityRoomId ?? "");
  byId("continuity-approve").disabled = continuityRole !== "A" || !continuityJoinRequest || continuityProgress.handoff;
  byId("continuity-accept").disabled = continuityRole !== "B" || !continuityProposal || continuityProgress.handoff;
  const continueButton = byId("continuity-continue");
  continueButton.disabled = continuityRole !== "B" || !continuityProgress.handoff || !continuityProgress.offline || continuityProgress.continue;
  continueButton.className = continueButton.disabled ? "button" : "button primary";
  byId("continuity-remove-a").disabled = continuityRole !== "A" || !continuityProgress.handoff || continuityProgress.offline;
  byId("continuity-join-panel").hidden = !continuityJoinUrl;
  if (continuityJoinUrl) {
    byId("continuity-join-link").href = continuityJoinUrl;
    byId("continuity-join-link").textContent = t("continuityJoinLinkReady");
    renderJoinQr(continuityJoinUrl);
  }
  continuityTimeline();
  if (message) {
    if (stateKind !== "reject") {
      byId("continuity-error-details").hidden = true;
      byId("continuity-error-code").textContent = "—";
    }
    setStatus(byId("continuity-status"), message, stateKind);
  }
}

function relayRecordBytes(record) {
  return canonicalBytes(createRelayMessage(record));
}

function relayControlBytes(kind, content) {
  return canonicalBytes(createRelayControlMessage(kind, content));
}

async function observeContinuityFrame(frame) {
  const opened = decodeRelayFrame(frame);
  if (continuityProcessed.has(opened.message_id)) return;
  if (opened.control?.kind === "join-request" && continuityRole === "A") {
    if (opened.control.content.organism_id !== continuityParticipant?.publicState.organism_id) return;
    continuityJoinRequest = opened.control.content;
    continuityProgress.join = true;
    renderContinuity(t("continuityJoinObserved"), "busy");
  } else if (opened.control?.kind === "handoff-proposal" && continuityRole === "B") {
    continuityProposal = opened.control.content;
    renderContinuity(t("continuityProposalObserved"), "busy");
  } else if (opened.record?.envelope?.kind === "mortalos.pulse" && continuityParticipant) {
    const currentSequence = BigInt(continuityParticipant.publicState.sequence ?? "0");
    const incomingSequence = BigInt(opened.record.envelope.body.sequence);
    if (incomingSequence > currentSequence) {
      continuityParticipant.appendEvidence(opened.record);
      if (opened.record.envelope.body.event.kind === "membership-change") {
        continuityProgress.handoff = true;
        renderContinuity(t("continuityHandoffAccepted"), "accept");
      } else if (opened.record.envelope.body.event.kind === "state-transition") {
        continuityProgress.continue = true;
        renderContinuity(t("continuityContinued"), "accept");
      }
    }
  }
  continuityProcessed.add(opened.message_id);
}

function startContinuitySubscription(startAfter = 0) {
  continuityUnsubscribe?.();
  continuityUnsubscribe = continuityTransport.subscribe(observeContinuityFrame, { startAfter });
  if (!continuityPresenceTimer) {
    continuityPresenceTimer = setInterval(async () => {
      try {
        continuityPresence = await continuityTransport.presence();
        const originPresent = continuityPresence.some((endpoint) => endpoint.startsWith("A-"));
        if (continuityRole === "B" && continuityProgress.join && !originPresent) {
          if (continuityProgress.handoff) {
            continuityProgress.offline = true;
            renderContinuity(t("continuityOriginOffline"), "accept");
          } else if (!continuityProgress.stalled) {
            continuityProgress.stalled = true;
            renderContinuity(t("continuityOriginLostBeforeHandoff"), "reject");
          }
        }
      } catch {
        byId("continuity-relay").textContent = t("continuityRelayUnavailable");
      }
    }, 1_000);
  }
}

byId("continuity-create").addEventListener("click", async () => {
  const button = byId("continuity-create");
  buttonBusy(button, true, t("continuityCreating"));
  try {
    continuityRoomId = createRoomId();
    continuityParticipant = new LiveEndpointParticipant(continuityEndpointId);
    const genesis = await continuityParticipant.create();
    continuityTransport = new HttpRelayTransport({ endpointId: continuityEndpointId, roomId: continuityRoomId });
    const published = await continuityTransport.publish(relayRecordBytes(genesis));
    continuityProcessed.add(published.frame.message_id);
    await continuityTransport.touchPresence();
    startContinuitySubscription();
    const join = new URL(currentLocale === "ko" ? "/ko/" : "/", globalThis.location.origin);
    join.searchParams.set("room", continuityRoomId);
    join.searchParams.set("join", "1");
    join.hash = "continuity-proof";
    continuityJoinUrl = join.href;
    continuityProgress.create = true;
    renderContinuity(t("continuityCreated"), "accept");
  } catch (error) {
    renderContinuityFailure(error);
  } finally {
    buttonBusy(button, false);
    renderContinuity();
  }
});

byId("continuity-join").addEventListener("click", async () => {
  const button = byId("continuity-join");
  buttonBusy(button, true, t("continuityJoining"));
  try {
    continuityTransport = new HttpRelayTransport({ endpointId: continuityEndpointId, roomId: continuityRoomId });
    const frames = await continuityTransport.fetchRange(0);
    const genesisFrame = frames.map(decodeRelayFrame).find((opened) => opened.record?.envelope?.kind === "mortalos.genesis");
    if (!genesisFrame) throw new Error("room has no canonical Genesis evidence");
    continuityParticipant = new LiveEndpointParticipant(continuityEndpointId);
    continuityJoinRequest = await continuityParticipant.join(genesisFrame.record);
    continuityProcessed.add(genesisFrame.message_id);
    const published = await continuityTransport.publish(relayControlBytes("join-request", continuityJoinRequest));
    continuityProcessed.add(published.frame.message_id);
    await continuityTransport.touchPresence();
    startContinuitySubscription();
    continuityProgress.create = true;
    continuityProgress.join = true;
    renderContinuity(t("continuityJoined"), "accept");
  } catch (error) {
    renderContinuityFailure(error);
  } finally {
    buttonBusy(button, false);
    renderContinuity();
  }
});

byId("continuity-approve").addEventListener("click", async () => {
  try {
    continuityProposal = await continuityParticipant.proposeHandoff(continuityJoinRequest);
    const published = await continuityTransport.publish(relayControlBytes("handoff-proposal", continuityProposal));
    continuityProcessed.add(published.frame.message_id);
    renderContinuity(t("continuityProposalSent"), "busy");
  } catch (error) {
    renderContinuityFailure(error);
  }
});

byId("continuity-accept").addEventListener("click", async () => {
  try {
    const evidence = await continuityParticipant.acceptHandoff(continuityProposal);
    const published = await continuityTransport.publish(relayRecordBytes(evidence));
    continuityProcessed.add(published.frame.message_id);
    continuityProgress.handoff = true;
    renderContinuity(t("continuityHandoffAccepted"), "accept");
  } catch (error) {
    renderContinuityFailure(error);
  }
});

byId("continuity-remove-a").addEventListener("click", () => {
  continuityParticipant.removeAuthority();
  continuityTransport.close();
  continuityTransport = null;
  if (continuityPresenceTimer) clearInterval(continuityPresenceTimer);
  continuityPresenceTimer = null;
  continuityProgress.offline = true;
  renderContinuity(t("continuityOriginOffline"), "accept");
});

byId("continuity-continue").addEventListener("click", async () => {
  try {
    const evidence = await continuityParticipant.nurture();
    const published = await continuityTransport.publish(relayRecordBytes(evidence));
    continuityProcessed.add(published.frame.message_id);
    continuityProgress.continue = true;
    renderContinuity(t("continuityContinued"), "accept");
  } catch (error) {
    renderContinuityFailure(error);
  }
});

byId("continuity-copy").addEventListener("click", async () => {
  if (!continuityJoinUrl) return;
  await navigator.clipboard.writeText(continuityJoinUrl);
  renderContinuity(t("continuityLinkCopied"), "accept");
});

renderContinuity(
  continuityJoinMode
    ? /^[A-Za-z0-9_-]{22}$/.test(continuityRoomId ?? "") ? t("continuityJoinReady") : t("continuityInvalidRoom")
    : t("continuityReady"),
  continuityJoinMode && !/^[A-Za-z0-9_-]{22}$/.test(continuityRoomId ?? "") ? "reject" : "neutral"
);

function loadTurnstile() {
  if (globalThis.turnstile?.render) return Promise.resolve(globalThis.turnstile);
  turnstileScriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      if (globalThis.turnstile?.render) resolve(globalThis.turnstile);
      else reject(new Error("anti-abuse client did not initialize"));
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("anti-abuse client unavailable")), { once: true });
    document.head.append(script);
  });
  return turnstileScriptPromise;
}

function invalidateTurnstileToken(message) {
  turnstileToken = null;
  byId("ask-gpt").disabled = true;
  byId("turnstile-status").textContent = message;
}

async function enableOptionalGpt() {
  const sitekey = document.querySelector('meta[name="mortalos-turnstile-site-key"]')?.content.trim();
  byId("turnstile-panel").hidden = false;
  if (!sitekey) {
    invalidateTurnstileToken(t("gptDisabled"));
    return;
  }
  const turnstile = await loadTurnstile();
  if (turnstileWidgetId !== null) turnstile.remove(turnstileWidgetId);
  turnstileWidgetId = turnstile.render(byId("turnstile-widget"), {
    action: TURNSTILE_ACTION,
    callback(token) {
      turnstileToken = token;
      byId("ask-gpt").hidden = false;
      byId("ask-gpt").disabled = false;
      byId("turnstile-status").textContent = t("antiAbuseComplete");
    },
    "error-callback"() {
      invalidateTurnstileToken(t("antiAbuseFailed"));
    },
    "expired-callback"() {
      invalidateTurnstileToken(t("antiAbuseExpired"));
    },
    sitekey,
    size: "flexible",
    theme: "dark"
  });
}

function deploymentManifest() {
  deploymentManifestPromise ??= fetch("/asset-manifest.json", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error(`release manifest HTTP ${response.status}`);
    const value = await response.json();
    if (
      value?.format !== "mortalos.lab-assets/1" ||
      !/^sha256:[A-Za-z0-9_-]{43}$/.test(value.asset_digest ?? "") ||
      !/^(?:local|[0-9a-f]{40})$/.test(value.source_commit ?? "")
    ) {
      throw new Error("release manifest schema mismatch");
    }
    return value;
  });
  return deploymentManifestPromise;
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
  const logicalState = state.state;
  byId("state-pulse-count").textContent = t("pulseCount", { count: logicalState?.pulse_count ?? 0 });
  if (logicalState?.avatar_seed) {
    const seed = decodeBase64Url(logicalState.avatar_seed);
    const hue = seed ? ((seed[0] * 256 + seed[1]) % 360) : 165;
    byId("state-avatar").style.setProperty("--avatar-color", `hsl(${hue} 82% 68%)`);
    byId("state-avatar").style.setProperty("--avatar-glow", `${0.7 + Math.min(logicalState.pulse_count, 20) * 0.04}rem`);
  }
}

function handleError(error, scope = "Lab") {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(liveStatus, `${scope} failed`, "reject");
  log(`${scope} failed closed: ${message}`);
}

function renderDurableState(message = null, stateKind = "neutral") {
  const state = durableParticipant.publicState;
  byId("durable-details").hidden = !state.configured;
  byId("durable-identity").textContent = state.organism_id ?? "—";
  byId("durable-sequence").textContent = state.sequence ?? "—";
  byId("durable-state").textContent = state.pulse_count === null ? "—" : t("pulseCount", { count: state.pulse_count });
  byId("durable-storage").textContent = state.storage.join(" · ") || "—";
  byId("nurture-durable").disabled = !state.signing_authority;
  byId("remove-durable-authority").disabled = !state.signing_authority;
  byId("enable-durable").disabled = state.configured || !byId("durable-consent").checked;
  if (message) setStatus(byId("durable-status"), message, stateKind);
}

byId("durable-consent").addEventListener("change", () => renderDurableState());
byId("enable-durable").addEventListener("click", async () => {
  const button = byId("enable-durable");
  buttonBusy(button, true, t("durableCreating"));
  try {
    if (!byId("durable-consent").checked) throw new Error("explicit persistence consent is required");
    await durableParticipant.create(Number(byId("durable-expiry").value));
    renderDurableState(t("durableCreated"), "accept");
    log(t("durableCreated"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderDurableState(t("durableFailed", { message }), "reject");
  } finally {
    buttonBusy(button, false);
    renderDurableState();
  }
});
byId("nurture-durable").addEventListener("click", async () => {
  const button = byId("nurture-durable");
  buttonBusy(button, true, t("nurturing"));
  try {
    const state = await durableParticipant.nurture();
    renderDurableState(t("durableNurtured", { count: state.pulse_count, sequence: state.sequence }), "accept");
    log(t("durableNurtured", { count: state.pulse_count, sequence: state.sequence }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderDurableState(t("durableFailed", { message }), "reject");
  } finally {
    buttonBusy(button, false);
    renderDurableState();
  }
});
byId("remove-durable-authority").addEventListener("click", async () => {
  try {
    await durableParticipant.removeAuthority();
    renderDurableState(t("durableRemoved"), "reject");
    log(t("durableRemoved"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderDurableState(t("durableFailed", { message }), "reject");
  }
});

if (DurableParticipant.supported()) {
  durableStoreExists().then(async (exists) => {
    if (!exists) return;
    const restored = await durableParticipant.restore();
    if (restored) renderDurableState(
      restored.signing_authority ? t("durableRestored") : t("durableRestoredReadOnly"),
      restored.signing_authority ? "accept" : "reject"
    );
  }).catch((error) => {
    renderDurableState(t("durableFailed", { message: error instanceof Error ? error.message : String(error) }), "reject");
  });
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
    nurtureButton.disabled = false;
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
    nurtureButton.disabled = true;
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
    nurtureButton.disabled = false;
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

nurtureButton.addEventListener("click", async () => {
  buttonBusy(nurtureButton, true, t("nurturing"));
  try {
    if (firstSigner.value === secondSigner.value) throw new Error("choose two different custodians");
    const { result, state } = await incubator.nurture([
      Number(firstSigner.value),
      Number(secondSigner.value)
    ]);
    renderLiveState();
    replayButton.disabled = false;
    retireButton.disabled = false;
    log(t("nurtured", { count: state.state.pulse_count, sequence: result.sequence }));
  } catch (error) {
    handleError(error, "State transition");
  } finally {
    buttonBusy(nurtureButton, false);
    nurtureButton.disabled = incubator.publicState.retired;
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
    nurtureButton.disabled = true;
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

function renderImportedProof(proof) {
  byId("import-identity").textContent = proof.organism_id;
  byId("import-head").textContent = proof.head_hash;
  byId("import-sequence").textContent = proof.sequence;
  byId("import-objects").textContent = String(proof.accepted_objects);
  byId("imported-life-card").hidden = false;
  setStatus(byId("import-status"), t("importVerified"), "accept");
}

async function importEvidenceFile(file) {
  importedProof = null;
  byId("imported-life-card").hidden = true;
  setStatus(byId("import-status"), t("importVerifying"), "busy");
  try {
    if (!(file instanceof File)) throw new TypeError("choose one evidence file");
    if (file.size > LAB_EVIDENCE_MAX_BYTES) throw new TypeError("evidence import exceeds the 2 MiB limit");
    if (file.type && file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) {
      throw new TypeError("evidence import must be a JSON file");
    }
    const { replay } = importEvidenceBundleBytes(await file.arrayBuffer());
    importedProof = {
      ...replay,
      mode: "verified_read_only",
      signing_authority: false
    };
    renderImportedProof(importedProof);
    log(`Imported public evidence verified locally: ${replay.digest}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(byId("import-status"), t("importRejected", { message }), "reject");
    log(`Evidence import failed closed: ${message}`);
  }
}

const importFile = byId("import-file");
const importDrop = byId("import-drop");
importDrop.addEventListener("click", () => importFile.click());
importDrop.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    importFile.click();
  }
});
for (const type of ["dragenter", "dragover"]) {
  importDrop.addEventListener(type, (event) => {
    event.preventDefault();
    importDrop.classList.add("dragover");
  });
}
for (const type of ["dragleave", "drop"]) {
  importDrop.addEventListener(type, (event) => {
    event.preventDefault();
    importDrop.classList.remove("dragover");
  });
}
importDrop.addEventListener("drop", (event) => importEvidenceFile(event.dataTransfer?.files?.[0]));
importFile.addEventListener("change", async () => {
  await importEvidenceFile(importFile.files?.[0]);
  importFile.value = "";
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
  buttonBusy(button, true, t("baselineRunning"));
  setStatus(byId("guided-status"), t("baselineRunning"), "busy");
  try {
    referenceProof = runReferenceProof({ lifecycle, fork });
    const accepted = referenceProof.steps.filter((step) => step.status === "accept").length;
    byId("guided-baseline").textContent = `${accepted}/${referenceProof.steps.length} lifecycle steps accepted · replay ${referenceProof.replay.code} · fork ${referenceProof.fork.sibling}`;
    setStatus(byId("guided-status"), t("baselineProven"), "accept");
    byId("run-local-attack").disabled = false;
    byId("enable-gpt").disabled = false;
    button.disabled = true;
    log("90-second proof baseline established from committed public evidence");
  } catch (error) {
    byId("guided-baseline").textContent = "Failed closed";
    setStatus(byId("guided-status"), t("baselineFailed"), "reject");
    button.disabled = false;
    log(`Guided baseline failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

async function runGuidedProposal(proposal, source) {
  if (!referenceProof) throw new Error("run the deterministic baseline first");
  const scenarioKind = byId("scenario-kind").value;
  const compiled = await compileScenario(proposal, scenarioKind);
  const kernel = await runCompiledScenario(compiled);
  const modelPrediction = `${proposal.prediction.status} / ${proposal.prediction.code ?? "no code"}`;
    const kernelActual = `${kernel.actual.status} / ${kernel.actual.code ?? "no code"}`;
    byId("gpt-proposal").textContent = `${source} chose ${compiled.scenario.mutation}`;
    byId("model-prediction").textContent = modelPrediction;
    byId("kernel-actual").textContent = kernelActual;
    byId("compiled-digest").textContent = compiled.digest;
    byId("scenario-rationale").textContent = `Untrusted proposal note: ${proposal.rationale}`;
    guidedScenario = { compiled, kernel, model: source, proposal, replay: null };
    byId("replay-without-gpt").disabled = false;
    byId("run-local-attack").disabled = true;
    byId("ask-gpt").disabled = true;
    byId("enable-gpt").disabled = true;
    byId("scenario-kind").disabled = true;
    byId("scenario-hypothesis").disabled = true;
    setStatus(
      byId("guided-status"),
      kernel.matches_trusted_expectation ? t("kernelDecided") : t("kernelMismatch"),
      kernel.matches_trusted_expectation ? "accept" : "reject"
    );
    log(`${source} proposal ${compiled.scenario.mutation}; authoritative kernel result ${kernelActual}`);
}

byId("run-local-attack").addEventListener("click", async () => {
  const button = byId("run-local-attack");
  buttonBusy(button, true, t("compilingOffline"));
  setStatus(byId("guided-status"), t("runningOffline"), "busy");
  try {
    await runGuidedProposal(
      createCuratedScenarioProposal(byId("scenario-kind").value),
      "curated-offline/1"
    );
  } catch (error) {
    byId("gpt-proposal").textContent = t("proposalFailed");
    setStatus(byId("guided-status"), t("scenarioFailed"), "reject");
    button.disabled = false;
    log(`Guided scenario failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("enable-gpt").addEventListener("click", async () => {
  const button = byId("enable-gpt");
  buttonBusy(button, true, t("gptLoading"));
  try {
    await enableOptionalGpt();
    button.disabled = true;
  } catch (error) {
    invalidateTurnstileToken(t("gptEnableFailed"));
    button.disabled = false;
    log(`Optional GPT unavailable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("ask-gpt").addEventListener("click", async () => {
  const button = byId("ask-gpt");
  buttonBusy(button, true, t("gptRunning"));
  setStatus(byId("guided-status"), t("generatingScenario"), "busy");
  try {
    if (!referenceProof) throw new Error("run the deterministic baseline first");
    if (!turnstileToken) throw new Error("complete the anti-abuse check first");
    const scenarioKind = byId("scenario-kind").value;
    const hypothesis = byId("scenario-hypothesis").value.trim();
    if (!hypothesis) throw new Error("enter a hypothesis");
    const token = turnstileToken;
    invalidateTurnstileToken(t("tokenSubmitted"));
    const response = await fetch(scenarioApiUrl(globalThis.location.href), {
      method: "POST",
      headers: { "content-type": "application/json", [TURNSTILE_HEADER]: token },
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
    await runGuidedProposal(payload.proposal, payload.model);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Optional GPT failed closed: ${message}; switching to curated offline attack`);
    try {
      await runGuidedProposal(
        createCuratedScenarioProposal(byId("scenario-kind").value),
        "curated-offline/1 (GPT fallback)"
      );
      byId("turnstile-status").textContent = t("gptFallback", { message });
    } catch (fallbackError) {
      byId("gpt-proposal").textContent = t("proposalFailed");
      setStatus(byId("guided-status"), t("scenarioFailed"), "reject");
      button.disabled = false;
      log(`Offline fallback failed closed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
  } finally {
    buttonBusy(button, false);
  }
});

byId("replay-without-gpt").addEventListener("click", async () => {
  const button = byId("replay-without-gpt");
  buttonBusy(button, true, t("replayRunning"));
  try {
    if (!guidedScenario) throw new Error("no compiled scenario exists");
    const replay = await runCompiledScenario(guidedScenario.compiled);
    const identical = JSON.stringify(replay.actual) === JSON.stringify(guidedScenario.kernel.actual);
    if (!identical) throw new Error("offline replay changed the kernel result");
    guidedScenario.replay = replay;
    const manifest = await deploymentManifest();
    byId("offline-replay").textContent = `PASS · ${guidedScenario.compiled.digest} · ${replay.actual.status} / ${replay.actual.code ?? "no code"}`;
    byId("release-asset-digest").textContent = manifest.asset_digest;
    byId("release-source-commit").textContent = manifest.source_commit;
    byId("guided-complete").hidden = false;
    setStatus(byId("guided-status"), t("offlineReplayExact"), "accept");
    button.disabled = true;
    log(`Offline replay byte/result identity: ${guidedScenario.compiled.digest}`);
  } catch (error) {
    byId("offline-replay").textContent = "Failed closed";
    setStatus(byId("guided-status"), t("replayFailed"), "reject");
    button.disabled = false;
    log(`Offline replay failed closed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    buttonBusy(button, false);
  }
});

byId("run-another-attack").addEventListener("click", () => {
  guidedScenario = null;
  byId("scenario-kind").disabled = false;
  byId("scenario-hypothesis").disabled = false;
  byId("run-local-attack").disabled = false;
  byId("enable-gpt").disabled = false;
  byId("ask-gpt").disabled = true;
  byId("ask-gpt").hidden = true;
  byId("turnstile-panel").hidden = true;
  invalidateTurnstileToken(t("turnstileNotEnabled"));
  if (turnstileWidgetId !== null && globalThis.turnstile?.remove) {
    globalThis.turnstile.remove(turnstileWidgetId);
    turnstileWidgetId = null;
  }
  byId("replay-without-gpt").disabled = true;
  byId("gpt-proposal").textContent = "Waiting for a new bounded proposal";
  byId("model-prediction").textContent = "—";
  byId("kernel-actual").textContent = "—";
  byId("compiled-digest").textContent = "—";
  byId("scenario-rationale").textContent = t("noProposal");
  byId("offline-replay").textContent = "Not run";
  byId("guided-complete").hidden = true;
  setStatus(byId("guided-status"), t("readyAnother"), "neutral");
  byId("scenario-kind").focus();
  log("Guided attack reset; deterministic baseline retained");
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

globalThis.addEventListener("pagehide", () => {
  incubator.shutdown();
  durableParticipant.close();
  continuityUnsubscribe?.();
  continuityTransport?.close();
  if (continuityPresenceTimer) clearInterval(continuityPresenceTimer);
});
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
      imported_proof: importedProof,
      continuity: {
        participant: continuityParticipant?.publicState ?? null,
        presence: [...continuityPresence],
        progress: { ...continuityProgress },
        role: continuityRole
      },
      durable: durableParticipant.publicState,
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
