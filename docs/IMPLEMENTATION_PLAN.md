# MortalOS Implementation Plan

Status: **C1 portable deterministic core verified; H3 visual Lab next**

Last reviewed: **2026-07-15**

This is a rolling, gate-based plan. Current evidence belongs in [`PROJECT_STATUS.md`](PROJECT_STATUS.md); historical decisions belong in Git history.

## 1. Delivery order

1. deterministic protocol meaning;
2. authority lineage and recognized-head safety;
3. cross-runtime portability;
4. one-page browser incubation and MortalOS Lab;
5. GPT-assisted adversarial scenarios;
6. release evidence;
7. stable non-browser adapters;
8. deterministic mutable state and availability; and
9. transport/resource organs.

Browser is first for zero-install visual demonstration, not because the protocol lives in a browser. UI, endpoint type, transport, storage, model output, and hosted infrastructure may propose or carry bytes but may never become validity authority.

## 2. Verified baseline — C0

The reference core verifies:

- canonical bounded Genesis/Pulse/payload bytes;
- real Ed25519 Genesis approval, Pulse quorum, and custody acceptance;
- immutable validator-produced context capabilities;
- parent resolution from an accepted-object graph;
- replay rejection, fork evidence, intersecting signer evidence, and post-fork halt;
- complete A/B/C → D/E/F custodian turnover with stable identity;
- validated complete and acceptance-incomplete latent successors;
- conditional authority/state mortality states;
- 10,000 deterministic invalid-continuation mutations; and
- byte-identical H2 traces in fresh processes.

## 3. Verified gate — C1 portable deterministic core

### Objective

Run one consensus implementation in Node.js and Chromium and obtain byte-identical results for the committed corpus.

### Implemented boundary

- portable `Uint8Array`, base64url, UTF-8, and constant-time comparison helpers;
- portable SHA-256 and strict RFC 8032 Ed25519 using locked pure-JavaScript dependencies;
- portable structural validators, differentially checked against normative JSON Schemas with development-only Ajv;
- no `node:*`, `Buffer`, filesystem, process, DOM, network, ambient clock, or ambient randomness in trusted `src/` paths;
- a public signed singleton, distributed lifecycle, clone, and fork corpus;
- a committed expected result with named first-error outcomes and a fixed-seed histogram; and
- isolated browser-target plus actual headless-Chromium runners.

### Pass record

- [x] Portable modules contain no forbidden platform dependency.
- [x] Committed, Node, browser-target, and actual Chromium results are byte-identical.
- [x] RFC 8785 number/string/UTF-16 ordering and RFC 8032 positive/mutation cases pass in both runtimes.
- [x] Forged context, replay, fork, equivocation, no-op membership, and latent-successor cases pass in both runtimes.
- [x] Exactly 10,000 cases replay from seed `1297044052` and zero-based case ID.
- [x] Trusted-core branch coverage remains above 90%.
- [x] Clean locked installation and actual Chromium execution pass.
- [x] An adapter cannot alter canonical bytes, validation order, rejection codes, or lineage decisions.

Failure rule: any cross-runtime mismatch reopens C1 and blocks endpoint product work. Do not copy the validator into UI or CLI code as a workaround.

## 4. H3 — single-browser incubator and MortalOS Lab ⏭ NEXT DELIVERY

### Why this is next

The kernel is now portable, but judges and developers cannot yet see or manipulate the world without rebuilding. A browser Lab turns verified evidence into a comprehensible product before the Build Week deadline. This is a delivery milestone, not the deepest research milestone.

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

### Pass criteria

- [ ] A public URL works without credentials or rebuilding.
- [ ] Worker private keys are non-extractable where supported and are never persisted, exported, logged, or sent.
- [ ] Page close before handoff loses local authority only under visibly declared assumptions.
- [ ] A valid handoff can move slots to independent endpoints without changing `organism_id`.
- [ ] The displayed result is exactly the portable-core result.
- [ ] Replay, fork, mortality qualifications, clone separation, and the distinction between logical keys and failure domains are visible.
- [ ] Exported trace digest matches the reference digest.
- [ ] The complete committed portable corpus runs in the deployed Lab.
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

H3 remains ahead of C2 for the hackathon because visual explanation and a hosted judge path are submission blockers. C2 is nevertheless the required proof that browser-first does not become browser-only.

## 8. Research path

### R1 — ownerless authority lineage ◐

Cross-runtime reference agreement is complete. Remaining exit criteria are a second independently written implementation, persistent evidence replay, and broader correctly re-signed valid-history generation. A live `1-of-1` or single-browser `2-of-3` state is not ownerless; the accepted failure-domain distribution must prevent unilateral continuation.

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

## 9. Stop conditions

Reopen the earliest responsible gate if:

- a cloned or hand-built context is accepted;
- two runtimes disagree on bytes, signatures, parent resolution, or first rejection code;
- replay or fork silently changes the head;
- UI, GPT, endpoint, transport, or storage bypasses validation;
- `1-of-1` or one-browser logical quorum is misrepresented as ownerless physical distribution;
- death is inferred only from silence, process exit, or an unverified deletion claim; or
- public claims exceed executable evidence.
