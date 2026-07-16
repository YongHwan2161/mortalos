# MortalOS Implementation Plan

Status: **P0 mortality-proof reconciliation locally verified; exact-head publication gates pending**

Last reviewed: **2026-07-16**

This is a rolling, gate-based plan. Current evidence belongs in [`PROJECT_STATUS.md`](PROJECT_STATUS.md); historical decisions belong in Git history.

## 1. Delivery order

1. deterministic protocol meaning;
2. authority lineage and recognized-head safety;
3. cross-runtime portability;
4. fail-closed mortality proof under incomplete evidence, runtime drift, and resource pressure;
5. canonical operation/result bytes plus an independent verifier;
6. one-page browser incubation and MortalOS Lab;
7. GPT-assisted adversarial scenarios and release evidence;
8. stable non-browser adapters;
9. deterministic mutable state and availability; and
10. transport/resource organs.

Browser is first for zero-install visual demonstration, not because the protocol lives in a browser. UI, endpoint type, transport, storage, model output, and hosted infrastructure may propose or carry bytes but may never become validity authority.

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
- conditional authority/state mortality states scoped to the graph-recognized head, with death requiring exact irreversibility and an explicitly complete latent-evidence inventory;
- bounded named-field acquisition, owned declared carriers, recursive target-body/signature discovery, and pre-analysis realm/crypto integrity checks;
- fixed whole-observation mortality limits that return indeterminate rather than
  classifying a truncated evidence set;
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
- [x] Pending-record, owned-byte, usable-ID count/character, and signature-work overflow returns portable `indeterminate / limit_exceeded` without graph mutation or a death decision.
- [x] Exactly 10,000 cases replay from seed `1297044052` and zero-based case ID.
- [x] Trusted-core branch coverage remains above 90%.
- [x] Clean locked installation and the full local suite pass.
- [x] The actual-Chromium runner is part of the required Verify workflow; a code change invalidates older run evidence.
- [x] An adapter cannot alter canonical bytes, validation order, rejection codes, or lineage decisions.

Failure rule: any cross-runtime mismatch reopens C1 and blocks endpoint product work. Do not copy the validator into UI or CLI code as a workaround.

The reconciled mortality candidate must still pass the exact-head actual-Chromium and remote CI gates before its evidence can be described as published. Limit values are versioned observer semantics; adapters may submit a smaller explicitly complete set but may not truncate, silently raise the limits, reinterpret overflow as missing evidence, or infer completeness from an empty list.

## 4. P0 — mortality-proof reconciliation ◐ CURRENT PUBLICATION GATE

### Objective

Prevent incomplete evidence, malformed declared carriers, runtime/dependency drift, and bounded-work exhaustion from collapsing into a false death classification.

### Implemented candidate

- [x] Death requires exact `authorityLossIrreversible: true` and `latentEvidenceComplete: true`; missing or false completeness remains `authority_unavailable_not_proven_dead`.
- [x] Every declared byte source must be ownable and parseable; ambiguity aborts the entire observation rather than becoming evidence absence.
- [x] Target-tuple body objects and exact tagged signatures, including property names, are recursively discovered throughout all parsed declared trees.
- [x] Captured realm/dependency descriptors plus SHA-256 and RFC 8032 known-answer checks abort before classification when trusted runtime state drifts.
- [x] Five whole-observation resource limits return structured `indeterminate / limit_exceeded` without truncation or graph mutation.
- [x] Portable corpus v5 and H2 trace v4 encode incomplete and complete evidence as distinct outcomes.
- [x] H3A's closed reference fixture asserts completeness; live Worker retirement explicitly does not.

### Publication exit

- [x] Clean locked install, full suite, coverage, audit, package, secret, syntax, spec, and diff gates pass locally; actual Chromium is separately blocked by a zero-byte CDN archive.
- [ ] The exact immutable remote head passes trusted policy, Node 22, browser-target, actual Chromium, and Lab Chromium verification.
- [ ] Independent review explicitly replays the empty-inventory/late-valid-child regression and runtime-drift probes and posts a superseding verdict on that immutable head.
- [ ] Post-merge `main` reruns the full Verify workflow.

Residual boundary: v0 deliberately reads only bounded documented names and never enumerates caller-owned containers. Unknown fields are ignored and are not evidence. A transparent Proxy can lie through descriptor traps, and evidence completeness remains a policy assertion. R1 is required before treating the observer as independently specified across implementations.

## 5. H3 — single-browser incubator and MortalOS Lab

### Why this follows R1

The kernel is portable, but judges and developers cannot yet see or manipulate the world without rebuilding. A browser Lab turns verified evidence into a comprehensible product. The public H3B artifact should consume R1's canonical operation/result contract rather than cementing the current JavaScript object-graph observer boundary. This is a delivery milestone, not the deepest research milestone.

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

### H3A local executable slice — verified

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

### H3B public deployment — next delivery gate after R1

- [ ] A public HTTPS URL works without credentials, install, or rebuilding.
- [ ] The deployed commit equals the reviewed repository commit.
- [ ] CSP, COOP, COEP, CORP, no-store, and MIME behavior match the local acceptance server.
- [ ] `npm run verify:lab` passes against the deployed URL in three clean contexts.
- [ ] A logged-out judge can complete birth, heartbeat, falsification, corpus, and export paths.
- [ ] No analytics, external requests, storage, Service Worker, private material, or console errors appear.
- [ ] Mortality inputs and displayed results round-trip through the R1 canonical operation/result record and agree with the independent verifier.

## 6. H4 — GPT-5.6 adversarial scenario designer

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

## 7. H5 — release evidence

- accurate repository and submission descriptions;
- Apache-2.0, third-party inventory, setup, platform, sample, and no-rebuild testing information;
- exact deployed commit passing CI, audit, link, package, and secret gates;
- a public sub-three-minute video of the working path;
- `/feedback` Codex Session ID; and
- a logged-out clean-browser judge run.

Do not claim an OS, independent-host resilience, globally provable death, mutable digital life, or ownerless computation unless the corresponding executable gate is complete.

## 8. C2 — stable CLI adapter

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

R1 remains ahead of both public H3B and C2 because otherwise both adapters would freeze an implementation-specific mortality input boundary. H3B remains ahead of C2 for the visual judge path; C2 is still the required proof that browser-first does not become browser-only.

## 9. Research path

### R1 — canonical authority-observation contract ⏭ NEXT ARCHITECTURAL GATE

Define a versioned bounded wire operation containing the recognized-head reference, usable-key observation, state-availability assertion, irreversibility assertion, completeness assertion, and declared envelope/payload byte carriers. Lengths and budgets are canonical byte counts, not JavaScript UTF-16 or object-shape behavior. Define a canonical result record for accept/reject/lineage/mortality outcomes.

Exit criteria:

- [ ] A normative schema and canonical bytes cover every current operation and result, including the five mortality limit resources and observer-abort outcomes.
- [ ] The JavaScript reference consumes the same decoded record used by adapters; browser and CLI objects cannot add evidence semantics.
- [ ] An independently written non-JavaScript verifier imports no reference source or runtime dependency and reproduces every committed result byte-for-byte.
- [ ] Differential generation includes incomplete/late evidence, nested artifact placement, runtime-independent malformed inputs, exact budget edges, correctly re-signed histories, restart/replay, and fork cases.
- [ ] Completeness and hidden-copy assumptions remain explicit policy fields; the wire format does not overclaim that they became cryptographically provable.
- [ ] Persistent evidence replay reconstructs the same graph and result after process restart.

A live `1-of-1` or single-browser `2-of-3` state is still not ownerless; independently evidenced deployment distribution must ensure no one failure domain can satisfy the active threshold.

### R2 — deterministic state-bearing kernel ⏭ FUNDAMENTAL

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

## 10. Stop conditions

Reopen the earliest responsible gate if:

- hostile, shared, detached, or changing byte storage influences a decision after acquisition;
- a non-canonical, small-order, torsion, or non-prime-subgroup Ed25519 point is accepted;
- a cloned or hand-built context is accepted;
- two runtimes disagree on bytes, signatures, parent resolution, or first rejection code;
- a custody handoff is accepted although the supplied approval-and-acceptance activation set cannot activate the declared threshold;
- replay or fork silently changes the head;
- mortality trusts a caller-selected head or prevalidated pending capability;
- mortality projects a usable signer onto a body after that signer authenticated another body, treats authenticated equivocation as life/death, or ignores a completion-capable membership body solely because its committed sidecar is unavailable;
- mortality truncates over-limit evidence or converts resource exhaustion into an alive/dead classification;
- mortality reports death without exact irreversibility and explicit complete-evidence assertions;
- a declared mortality carrier cannot be snapshotted or parsed yet is treated as absent;
- realm, dependency, schema, or crypto-state drift changes a mortality result instead of aborting;
- an adapter treats unknown object fields as evidence or omits documented carriers while claiming completeness;
- UI, GPT, endpoint, transport, or storage bypasses validation;
- `1-of-1` or one-browser logical quorum is misrepresented as ownerless physical distribution;
- death is inferred only from silence, process exit, or an unverified deletion claim; or
- public claims exceed executable evidence.
