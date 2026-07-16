# MortalOS Implementation Plan

Status: **P0 implemented; every published SHA requires immutable-head review and Verify; H3A local Lab implemented**

Last reviewed: **2026-07-16**

This is a rolling, gate-based plan. Current evidence belongs in [`PROJECT_STATUS.md`](PROJECT_STATUS.md); historical decisions belong in Git history.

## 1. Delivery order

1. deterministic protocol meaning;
2. authority lineage and recognized-head safety;
3. cross-runtime portability;
4. independent-verifier registration, then a versioned raw operation/result wire
   contract, JavaScript golden corpus, and independent Python differential verifier;
5. thin one-page browser incubation and MortalOS Lab consuming that wire contract;
6. optional stable non-browser adapter work after R1-C, outside the critical gate chain;
7. deterministic mutable state and availability;
8. GPT-assisted adversarial scenarios and release evidence; and
9. transport/resource organs.

Browser is first for zero-install visual demonstration, not because the protocol lives in a browser. UI, endpoint type, transport, storage, model output, and hosted infrastructure may propose or carry bytes but may never become validity authority.

The next gates have one reviewed order:

`P0 → independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → H3B public deployment → R2`

Stable CLI work may proceed after R1-C as non-blocking adapter work, but it cannot
delay, replace, or reorder that critical chain.

## 2. Verified baseline — C0

The reference core verifies:

- canonical bounded Genesis/Pulse/payload snapshots with hostile-metadata and shared-memory defenses;
- strict canonical prime-subgroup Ed25519 Genesis approval, Pulse quorum, and custody acceptance;
- total validation with stable first-error precedence;
- immutable validator-produced context capabilities;
- parent resolution from an accepted-object graph;
- replay rejection, fork evidence, intersecting signer evidence, and post-fork halt;
- complete A/B/C → D/E/F custodian turnover with stable identity;
- single-read public validation of complete and durable acceptance-incomplete successors, plus lineage-internal completion from independently collected body/signature/sidecar evidence, one early usable-key snapshot filtered per body by sign-once commitments, unclassified authenticated equivocation, and conditional payload-unavailability after irreversible authority loss when an opaque membership body is the sole obstacle to a death conclusion;
- conditional authority and state mortality states scoped to the graph-recognized head, with death requiring both explicit irreversibility and a complete pending-evidence basis;
- bounded named-field mortality acquisition plus seven whole-observation limits, including pre-JCS candidate occurrence and post-JCS aggregate canonical-byte ceilings that return frozen unclassified results without graph mutation;
- 10,000 deterministic mixed valid/invalid continuation cases; and
- byte-identical H2 v4 traces in fresh processes.

## 3. Verified gate — C1 portable deterministic core

### Objective

Run one consensus implementation in Node.js and Chromium and obtain byte-identical results for the committed corpus.

### Implemented boundary

- portable `Uint8Array`, base64url, UTF-8, and constant-time comparison helpers;
- intrinsic-backed owned byte snapshots that reject shared or detached storage and preserve exact root-depth semantics, plus data-descriptor canonicalization with captured internal-slot probes and an explicit transparent-Proxy limit;
- portable SHA-256 and strict RFC 8032 Ed25519 using locked direct pure-JavaScript dependencies, with canonical prime-subgroup point validation;
- portable structural validators, differentially checked against normative JSON Schemas with development-only Ajv;
- total semantic validators with stable first-error precedence; strict complete/public-durable validation remains separate from lineage-internal mortality completion helpers, which are not re-exported by `src/index.mjs`;
- custody-change activation proof and recognized-head-only conditional mortality;
- no `node:*`, `Buffer`, filesystem, process, DOM, network, ambient clock, or ambient randomness in trusted `src/` paths;
- a public signed singleton, multi-custodian turnover, clone, and fork corpus;
- a committed expected result with named first-error outcomes and a fixed-seed histogram; and
- isolated browser-target plus actual headless-Chromium runners.

### Pass record

- [x] Portable modules contain no forbidden platform dependency.
- [x] The committed result, Node 22, isolated browser-target, and actual Chromium results are required to be byte-identical on every review head; the latest successful exact-head Verify run is the publication evidence.
- [x] The PR workflow requires every changed head to rerun the Node/Chromium differential gate.
- [x] RFC 8785 number/string/UTF-16 ordering and RFC 8032 positive/mutation cases pass in Node and the isolated browser-target runtime.
- [x] Forged context, leaked constructor, replay, fork, no-op membership, durable latent succession, conditional-current-approval completion, evidence poisoning, sign-once/equivocation, and payload-unavailability cases pass in Node and the isolated browser-target runtime.
- [x] Hostile byte metadata, shared storage, invalid Ed25519 points, falsey roots, activation insufficiency, and caller-selected mortality heads fail closed.
- [x] Node conformance covers exact/+1, precedence, frozen-result, graph atomicity,
  and retry for every mortality limit, including genuine signature work and depth-64
  nested candidate amplification. The portable browser-target and actual-Chromium
  corpus cover the normalized +1 result for all seven resource identifiers.
- [x] Exactly 10,000 cases replay from seed `1297044052` and zero-based case ID.
- [x] Trusted-core branch coverage remains above 90%.
- [x] The Verify workflow performs a clean locked installation and full repository suite for every publishable head.
- [x] Actual Chromium execution is part of the required CI gate for every review head.
- [x] An adapter cannot alter canonical bytes, validation order, rejection codes, or lineage decisions.

Failure rule: any cross-runtime mismatch reopens C1 and blocks endpoint product work. Do not copy the validator into UI or CLI code as a workaround.

## 4. H3 — single-browser incubator and MortalOS Lab

### Delivery and fundamental gates

H3A already demonstrates the portable JavaScript kernel locally. H3B does not run in
parallel with R1: public hosting waits until an independent verifier identity is
registered, R1-A freezes bounded wire/golden bytes, R1-B proves them in Python, and
R1-C moves the Lab onto those wire records. H3B then publishes that reviewed thin
consumer without adding UI-side validity logic.

### Incubator path

```text
one person opens one page
  -> three dedicated volatile custodian Workers generate one key each
  -> all three approve Genesis
  -> the portable core accepts birth
  -> any two workers authorize a Pulse
```

The UI must display `3 logical custodians / 1 physical failure domain`. It must not describe the initial profile as independently distributed.

### Developer-tool path

```text
run reference lifecycle
  -> inspect identity, parent, custody, and evidence timeline
  -> mutate or replay one artifact
  -> see stable rejection or fork evidence
  -> export canonical trace bytes and digest
```

### H3A local executable slice — implemented; exact-head gate required

- [x] Worker private keys are non-extractable and never persisted, exported, logged, or sent.
- [x] Controlled Worker termination visibly demonstrates local authority loss without claiming global death.
- [x] The displayed decisions come from the portable kernel.
- [x] Replay, fork, mortality qualifications, resurrection rejection, clone separation, and logical-key/failure-domain distinctions are visible.
- [x] Canonical public evidence exports, independently digests, and raw-replays to the same head.
- [x] The complete committed portable corpus runs in the Lab.
- [x] Cross-origin-isolated Chromium exposes `SharedArrayBuffer`, and SAB-backed validator input is rejected.
- [x] The local judge path passes three clean browser contexts.
- [x] Keyboard semantics, contrast profile, narrow viewport, and reduced-motion behavior are checked.

The reference handoff trace proves stable identity through complete custody turnover. Moving live Worker slots to genuinely independent endpoints remains a network-adapter milestone, because a browser-only simulation cannot prove physical distribution.

### H3B public deployment — after R1-C

- [ ] A public HTTPS URL works without credentials, install, or rebuilding.
- [ ] The deployed commit equals the reviewed repository commit.
- [ ] CSP, COOP, COEP, CORP, no-store, and MIME behavior match the local acceptance server.
- [ ] `npm run verify:lab` passes against the deployed URL in three clean contexts.
- [ ] A logged-out judge can complete birth, heartbeat, falsification, corpus, and export paths.
- [ ] No analytics, external requests, storage, Service Worker, private material, or console errors appear.

## 5. H4 — GPT-5.6 adversarial scenario designer

Flow:

```text
developer hypothesis
  -> GPT-5.6 structured scenario proposal
  -> strict allowlisted schema and size limits
  -> deterministic fixture compiler
  -> portable validator
  -> trace plus stable-code explanation
```

Pass criteria:

- [ ] The submitted product invokes GPT-5.6 in the demonstrated path.
- [ ] Model output cannot supply accepted context, private keys, recognized heads, or validity results.
- [ ] Invalid or incomplete proposals fail closed and remain editable.
- [ ] At least 25 fixed adversarial prompts cover forgery, injection, impossible transitions, malformed fields, and overclaimed death.
- [ ] The compiled scenario produces the same result with GPT disabled.
- [ ] No API key appears in browser code, logs, artifacts, screenshots, or history.

## 6. H5 — release evidence

- accurate repository and submission descriptions;
- Apache-2.0, third-party inventory, setup, platform, sample, and no-rebuild testing information;
- exact deployed commit passing CI, audit, link, package, and secret gates;
- a public sub-three-minute video of the working path;
- `/feedback` Codex Session ID; and
- a logged-out clean-browser judge run.

Do not claim an OS, independent-host resilience, globally provable death, mutable digital life, or ownerless computation unless the corresponding executable gate is complete.

## 7. C2 — stable CLI adapter

The existing singleton script proves that a CLI endpoint can create a valid world. It is not yet a supported interface.

Target commands:

```text
mortalos create --custody singleton --ephemeral
mortalos verify < evidence.jsonl
mortalos replay lineage.jsonl
mortalos inspect --json
mortalos export --canonical
```

Pass criteria:

- [ ] Creation emits only canonical public evidence; private material never appears in output, logs, trace files, or shell arguments.
- [ ] Ephemeral and persistent key policies are explicit and testable.
- [ ] Import/replay reconstructs the same graph, head, fork state, and digest after restart.
- [ ] CLI and browser import the same kernel and pass the same committed corpus.
- [ ] Machine output is versioned; human prose is never consensus input.
- [ ] File, stdin, IPC, and future network adapters carry the same bounded evidence records.
- [ ] `1-of-1` creation warns that it is creator-controlled and exposes a handoff path to distributed custody.
- [ ] Partial writes, concurrent writers, corrupt input, and interrupted key creation fail closed.

After R1-C moves H3A onto the verified raw wire contract, H3B publishes the first
thin visual consumer and C2 can provide the first stable non-browser adapter. Neither
may define a private result shape or duplicate validation logic.

## 8. Research path

### R1 — language-neutral authority evidence ⏭ NEXT

Define a versioned, bounded raw operation/result wire contract for Genesis validation, Pulse validation, lineage replay/append/snapshot, and qualified mortality observations. Each operation and each result must itself have canonical wire bytes; operations carry canonical evidence bytes and explicit observation assumptions, never process-local capabilities or prose.

Execute R1 as three reviewable implementation gates after first registering the
independent-verifier identity, task, workspace, and isolation rules. Registration
preserves logical separation; technical independence comes from the non-JavaScript
implementation restrictions and differential golden gate, while account-level
independence requires a separate GitHub App or bot:

- **R1-A — JavaScript wire/golden:** define bounded versioned operation/result bytes,
  implement the JavaScript adapter, and commit canonical positive/negative golden
  records without Python code;
- **R1-B — Python differential:** an independently authored Python verifier consumes
  the frozen records without importing or translating the JavaScript implementation
  and must match canonical results, precedence, hashes, fork state, and mortality
  qualification; and
- **R1-C — Lab wire consumption:** MortalOS Lab stops calling the object-graph
  mortality boundary directly and imports/exports the same bounded wire records
  before public hosting.

Exit criteria:

- one committed operation/result corpus is replayed unchanged by the JavaScript implementation and an independently written non-JavaScript verifier;
- both implementations agree on canonical bytes, stable rejection codes and precedence, accepted hashes, fork state, and mortality qualification;
- restart rebuilds accepted context only by replaying canonical evidence;
- malformed, unknown-version, and oversized operations fail closed; and
- broader correctly re-signed histories cover churn, delayed evidence, and rebuild.

Every changed review head must still rerun the Node/browser-target/actual-Chromium reference-agreement gate. A live `1-of-1` or single-browser `2-of-3` state is not ownerless; externally evidenced key distribution must show that no physical or administrative domain controls threshold keys.

### R2 — deterministic state-bearing kernel ⏭ AFTER H3B

Create a new protocol version with:

- a minimal deterministic genome ABI;
- canonical prior-state and event inputs;
- deterministic next-state bytes and content-addressed root;
- capability/resource ceilings and stable failure codes; and
- two independent runtimes agreeing on every vector.

Until this passes, MortalOS is an authority-lineage protocol rather than an executing life or OS.

### R3 — state availability and recovery

Define replication/recovery thresholds and verifiable possession or retrieval evidence. Preserve the distinction among authority-viable, state-stalled, and dead.

### R4 — endpoint-neutral network embodiment

Add deterministic virtual transport, a process-neutral adapter contract, browser multi-context and CLI process churn, then swappable WebRTC/libp2p/other transports with replaceable discovery. Transport never selects accepted state.

### R5/R6 — resource and model organs

Only after state transition, recovery, and participant turnover work should the project add sandboxed compute, storage markets, WebGPU, distributed weights, or ownerless model claims.

## 9. Stop conditions

Reopen the earliest responsible gate if:

- hostile, shared, detached, or changing byte storage influences a decision after acquisition;
- a non-canonical, small-order, torsion, or non-prime-subgroup Ed25519 point is accepted;
- a cloned or hand-built context is accepted;
- two runtimes disagree on bytes, signatures, parent resolution, or first rejection code;
- a custody handoff is accepted although the supplied approval-and-acceptance activation set cannot activate the declared threshold;
- replay or fork silently changes the head;
- mortality trusts a caller-selected head or prevalidated pending capability;
- mortality projects a usable signer onto a body after that signer authenticated another body, treats authenticated equivocation as life/death, or ignores a completion-capable membership body solely because its committed sidecar is unavailable;
- mortality converts an incomplete inventory, a malformed declared carrier, an acquisition or parse failure, runtime/dependency drift, or an unexpected internal failure into absence or death;
- mortality enumerates caller container keys, truncates an over-limit observation, retains an over-budget target body, or mutates the graph before returning `indeterminate / limit_exceeded`;
- UI, GPT, endpoint, transport, or storage bypasses validation;
- `1-of-1` or one-browser logical quorum is misrepresented as ownerless physical distribution;
- death is inferred only from silence, process exit, an empty local inventory, or an unverified deletion claim; or
- public claims exceed executable evidence.
