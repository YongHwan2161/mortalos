# MortalOS Implementation Plan

Status: **C0 Node reference verified; C1 portability is next**

Last reviewed: **2026-07-15**

This is a rolling, gate-based plan. Current evidence belongs in [`PROJECT_STATUS.md`](PROJECT_STATUS.md); historical decisions belong in Git history.

## 1. Delivery order

1. deterministic protocol meaning;
2. authority lineage and recognized-head safety;
3. cross-runtime portability;
4. one-page browser incubation and developer experience;
5. GPT-assisted adversarial scenarios;
6. deterministic mutable state and availability; and
7. network/resource organs.

UI, transport, storage, model output, and hosted infrastructure may propose or carry bytes but may never become validity authority.

## 2. Verified baseline — C0

The Node reference currently verifies:

- canonical bounded Genesis/Pulse/payload bytes;
- real Ed25519 Genesis approval, Pulse quorum, and custody acceptance;
- immutable validator-produced context capabilities;
- parent resolution from an accepted-object graph;
- replay rejection, fork evidence, intersecting signer evidence, and post-fork halt;
- complete A/B/C → D/E/F custodian turnover with stable identity;
- validated complete and acceptance-incomplete latent successors;
- conditional authority/state mortality states;
- 10,000 deterministic invalid-continuation mutations; and
- byte-identical H2 traces in fresh Node processes.

This proves a Node authority-lineage reference, not browser portability, independent implementation agreement, state execution, or global death.

## 3. Next gate — C1 portable deterministic core

### Objective

Run one consensus implementation in Node.js and Chromium and obtain byte-identical results for every committed vector.

This gate is more important than browser UI or WebRTC because duplicating canonicalization, signature, context, or rejection behavior in a second implementation would split protocol truth.

### Work packages

#### C1.1 — portable module boundary

- replace validation-path `Buffer` use with `Uint8Array` helpers;
- inject SHA-256 and Ed25519 verification through a narrow asynchronous crypto interface;
- keep schema acquisition/compilation outside semantic modules;
- isolate `node:*`, filesystem, process, DOM, network, clock, randomness, and key generation in adapters; and
- preserve the non-forgeable accepted-context capability in both runtimes.

#### C1.2 — Node and Web Crypto adapters

- Node adapter using `node:crypto`;
- browser adapter using `crypto.subtle`;
- identical tagged-base64url and SPKI/raw Ed25519 behavior; and
- explicit error mapping so platform exceptions never leak into protocol results.

#### C1.3 — serialized conformance corpus

- canonical Genesis/Pulse/payload bytes;
- required context and ancestry evidence;
- expected accept/reject/fork result bytes;
- positive and first-error negative cases;
- RFC 8785 and RFC 8032 vectors; and
- replayable seed and case ID for generated cases.

#### C1.4 — Chromium differential gate

- headless Chromium runner over the same corpus;
- Node/Chromium byte comparison;
- clean CI execution; and
- mismatch artifacts that identify vector, runtime, and first differing byte.

### Pass criteria

- [ ] Portable modules import no `node:*` APIs and reference no `Buffer`, filesystem, process, DOM, network, clock, or randomness.
- [ ] Node and Chromium return byte-identical results for all positive and negative vectors.
- [ ] RFC 8785 number/string/UTF-16 ordering and RFC 8032 vector 1 pass in both runtimes.
- [ ] Forged context, replay, fork, no-op membership, and latent-successor cases pass in both runtimes.
- [ ] At least 10,000 serialized cases replay from a printed seed and case ID.
- [ ] Trusted-core branch coverage remains at least 90%.
- [ ] Clean Node and clean Chromium jobs pass in CI.
- [ ] An adapter cannot alter canonical bytes, validation order, rejection codes, or lineage decisions.

Failure rule: any cross-runtime mismatch blocks the browser gate. Do not copy the validator into UI code as a workaround.

## 4. H3 — single-browser incubator and MortalOS Lab

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
  -> see the stable rejection or fork evidence
  -> export canonical trace bytes and digest
```

### Pass criteria

- [ ] A public URL works without credentials or rebuilding.
- [ ] Worker private keys are non-extractable where supported and are never persisted, exported, logged, or sent.
- [ ] Page close before handoff loses local authority under the declared assumptions.
- [ ] A valid handoff can move slots to independent browsers without changing `organism_id`.
- [ ] The displayed result is exactly the portable-core result.
- [ ] Replay, fork, mortality qualifications, and clone separation are visible.
- [ ] Exported trace digest matches the CLI/reference digest.
- [ ] The judge path passes three times in a clean browser profile.
- [ ] Keyboard, contrast, narrow viewport, and reduced-motion checks pass.

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
- [ ] Invalid/incomplete proposals fail closed and remain editable.
- [ ] At least 25 fixed adversarial prompts cover forgery, injection, impossible transitions, malformed fields, and overclaimed death.
- [ ] The compiled scenario produces the same result with GPT disabled.
- [ ] No API key appears in browser code, logs, artifacts, screenshots, or history.

## 6. H5 — release evidence

- accurate repository and submission descriptions;
- Apache-2.0, setup, platform, sample, and no-rebuild testing information;
- exact deployed commit passing CI, audit, link, package, and secret gates;
- a public sub-three-minute video of the working path;
- `/feedback` Codex Session ID; and
- a logged-out clean-browser judge run.

Do not claim a browser OS, independent-host resilience, globally provable death, mutable digital life, or ownerless computation unless the corresponding executable gate is complete.

## 7. Research path after the browser proof

### R2 — deterministic state-bearing kernel

Create a new protocol version with:

- a minimal deterministic genome ABI;
- canonical prior-state and event inputs;
- deterministic next-state bytes and content-addressed root;
- capability/resource ceilings and stable failure codes; and
- two independent runtimes agreeing on every vector.

Until this passes, MortalOS is an authority-lineage protocol rather than an executing life or OS.

### R3 — state availability and recovery

Define replication/recovery thresholds and verifiable possession or retrieval evidence. Preserve the distinction among authority-viable, state-stalled, and dead.

### R4 — browser network embodiment

Add deterministic virtual transport, multi-context churn, then WebRTC with replaceable signaling. Transport never selects accepted state.

### R5/R6 — resource and model organs

Only after state transition, recovery, and browser turnover work should the project add sandboxed compute, storage markets, WebGPU, distributed weights, or ownerless model claims.

## 8. Stop conditions

Reopen the earliest responsible gate if:

- a cloned or hand-built context is accepted;
- two runtimes disagree on bytes, signatures, parent resolution, or first rejection code;
- replay or fork silently changes the head;
- UI, GPT, transport, or storage bypasses validation;
- one-browser logical quorum is misrepresented as physical distribution;
- death is inferred only from silence or an unverified deletion claim; or
- public claims exceed executable evidence.
