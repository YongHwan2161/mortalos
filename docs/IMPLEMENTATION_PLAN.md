# MortalOS Implementation Plan

Status: **P0 merged; H3A implemented; H3B deployment contract in review; submission sprint active**

Last reviewed: **2026-07-16**

This is the only rolling implementation plan. Current evidence belongs in
[`PROJECT_STATUS.md`](PROJECT_STATUS.md); historical plans remain in Git history.

## 1. Fixed deadline and optimization target

OpenAI Build Week submissions close at **2026-07-22 00:00 UTC**, which is
**2026-07-22 09:00 KST**. The internal freeze is **2026-07-21 18:00 KST** and the
submit target is **2026-07-22 07:00 KST**, leaving a two-hour recovery buffer.

The judging dimensions are technological implementation, design, potential impact,
and quality of the idea. The submission must include a working project, one category,
a project description, a public YouTube demo under three minutes with voiceover
covering Codex and GPT-5.6 use, a code repository with README and appropriate
licensing, and a `/feedback` Codex Session ID. Because MortalOS is submitted as a
Developer Tool, it also needs installation/platform guidance and a way to test
without rebuilding.

The deadline changes delivery order, not protocol truth. The sprint optimizes for
one coherent, falsifiable, zero-install product slice. It does not attempt to finish
a network OS in five days.

## 2. Two lanes, one source of truth

### Submission lane — now

`P0 merged → H3B honest Lab preview → release evidence → video → submit`

H3B may publish H3A before R1 solely as a static, explicitly qualified preview. It
does not upgrade the JavaScript observer boundary, add network participants, prove
ownerlessness, or implement mutable state. The deployment must be byte-bound to one
reviewed commit and may expose only claims already enforced by the portable kernel.

### Protocol lane — after submission

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

This remains the North Star path. H3B is a delivery surface, not a substitute for
R1 or R2. The previously prepared R2 prototype was based on a pre-P0 branch and is
research input only; it must not be merged ahead of the current mortality-safe main
or the language-neutral R1 contract.

## 3. Submission critical path

### S0 — public judge path

Goal: a logged-out judge opens one HTTPS URL and completes the working Lab without
credentials, installation, or a local build.

Strict pass criteria:

- the deployed `source_commit` is an exact 40-character SHA on reviewed `main`;
- the canonical asset manifest matches a clean local build byte-for-byte;
- every HTML, JavaScript, CSS, JSON, and license asset matches its declared SHA-256
  and MIME type;
- CSP, COOP, COEP, CORP, no-store, permissions, referrer, and nosniff headers match
  the checked-in deployment contract;
- actual Chromium completes birth, every two-key quorum pair, heartbeat, replay,
  fork, qualified mortality, resurrection rejection, clone, corpus, and evidence
  export/replay in three clean contexts;
- the page performs no external request and uses no cookies, persistent storage,
  Service Worker, analytics, or embedded secret; and
- `npm run verify:lab` passes against the public URL and exact deployed SHA.

Implementation: Cloudflare Pages is the chosen host. A GitHub workflow builds,
tests, deploys, and then re-verifies the exact reviewed commit. Cloudflare is not a
global Devpost website requirement; it is the lowest-friction way to satisfy the
Developer Tools no-rebuild test-path requirement for this browser-first project.

Failure rule: an unverified, stale, preview-only, or credentialed URL is not a pass.
If Cloudflare credentials are unavailable, local H3A remains verified but S0 remains
blocked; no document may call it publicly deployed.

### S1 — repository and judge instructions

Goal: the public repository independently explains what exists, how to run it, and
what it does not prove.

Strict pass criteria:

- Apache-2.0, package metadata, contribution terms, and third-party notices agree;
- Node 22.5+, supported browsers, `npm ci`, local Lab, full tests, and deployed-verifier
  commands are explicit;
- sample evidence and the shortest judge path are documented;
- public claims distinguish logical `2-of-3` from physical distribution and qualified
  death from silence or browser closure;
- Codex/GPT-5.6 workflow contributions and human decisions are described accurately;
- secret, dependency-audit, package, link, and clean-tree checks pass on the final SHA.

### S2 — Codex and GPT-5.6 evidence

Goal: show genuine use of Codex with GPT-5.6 during construction.

The event requirement concerns how the project was built; it does not require an
OpenAI API call in the product runtime. Therefore a rushed model endpoint is not a
submission gate. The evidence package must instead identify concrete work accelerated
by Codex/GPT-5.6: operational lifecycle definitions, P0 adversarial review, conformance
vectors, browser boundary tests, deployment invariants, and deadline replanning.

Strict pass criteria:

- README and Devpost story contain concrete, reviewable examples rather than generic
  “AI helped” language;
- the demo voiceover explains both Codex and GPT-5.6 use;
- the required `/feedback` Session ID names the session containing most core work;
- no runtime GPT integration is claimed unless a real tested path exists; and
- model output never becomes validity authority.

### S3 — Devpost story and category

Goal: an honest Developer Tools submission whose prose matches the final executable.

Strict pass criteria:

- category is `Developer Tools`;
- the tagline describes a lifecycle/evidence Lab, not a completed ownerless OS;
- the story covers inspiration, operation, construction, challenges, accomplishments,
  learning, and next work;
- repository and public-test URLs resolve logged out; and
- all required custom fields are complete before submission.

### S4 — public demo video

Goal: one clear public YouTube video, shorter than three minutes.

Required sequence:

1. 0:00–0:20 — the problem and honest scope;
2. 0:20–1:20 — live logical `2-of-3` birth, one-key failure, two-key heartbeat;
3. 1:20–2:10 — turnover, replay/fork, qualified death, resurrection rejection;
4. 2:10–2:35 — exact evidence/corpus and endpoint neutrality;
5. 2:35–2:55 — how Codex and GPT-5.6 accelerated the implementation; and
6. final seconds — repository, public Lab, and next R1/R2 step.

Strict pass criteria: public YouTube URL, duration under three minutes, audible
voiceover, no secret/private key in frame, and behavior identical to the deployed SHA.

### S5 — final submission

Strict pass criteria:

- repository, deployment, README, video, and Devpost prose describe the same SHA;
- every required field including category, repo URL, video, test instructions, and
  `/feedback` Session ID is present;
- final logged-out smoke test and GitHub checks pass;
- submission state is not draft; and
- completion occurs by **07:00 KST on July 22**, not at the 09:00 hard deadline.

## 4. Calendar

| KST deadline | Deliverable | Exit gate |
| --- | --- | --- |
| Jul 17, 23:59 | H3B PR reviewed and merged; automatic Cloudflare run observed | exact-SHA CI plus public verifier, or an explicit credential blocker without false deployment claim |
| Jul 18, 23:59 | README, install/platform/test path, Codex/GPT-5.6 evidence | clean-room local and public judge-path rehearsal |
| Jul 19, 23:59 | Devpost story/category/custom-field draft and video script | every statement mapped to executable evidence |
| Jul 20, 23:59 | public video recorded and uploaded | under three minutes; voiceover covers project, Codex, GPT-5.6 |
| Jul 21, 18:00 | final code/content freeze | all checks green; exact URLs and SHA frozen |
| Jul 22, 07:00 | Devpost submitted | non-draft submission confirmed; two-hour buffer remains |

Do not spend the submission lane on R2, distributed inference, WebRTC/libp2p,
token economics, durable key custody, or a polished CLI unless every S0–S5 blocker
is already closed.

## 5. Verified foundation

P0 on current `main` provides canonical bounded Genesis/Pulse evidence, strict
Ed25519, stable first-error validation, quorum activation, recognized-head lineage,
replay/fork handling, sign-once-aware latent evidence, explicit irreversible-loss and
complete-inventory requirements for qualified death, and seven whole-observation
resource ceilings. H3A provides a local one-page Lab over the same kernel.

Every publishable SHA must still pass:

Committed, Node, isolated browser-target, and actual Chromium results must be
byte-identical for each review head. Exactly 10,000 cases replay from seed
`1297044052`. Any cross-runtime mismatch reopens the earliest portable gate.

```bash
npm ci
npm test
npm run test:coverage
npm run test:chromium
npm run verify:lab
npm audit --audit-level=moderate
npm pack --dry-run
```

For a public deployment:

```bash
MORTALOS_LAB_URL=https://mortalos-lab-yonghwan2161.pages.dev \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:deployed-lab
```

## 6. Post-submission protocol gates

### R1 — language-neutral authority evidence

Goal: replace the JavaScript object-graph operation boundary with canonical bounded
operation/result bytes and independent verification.

- **Registration gate:** register an independent verifier identity, task, workspace,
  non-JavaScript restriction, and separate reviewer before golden fixtures are frozen.
- **R1-A:** JavaScript emits canonical positive/negative operation/result goldens for
  Genesis, Pulse, replay, append, snapshot, fork, and qualified mortality.
- **R1-B:** independently authored Python consumes those unchanged bytes without
  importing or translating the JavaScript implementation.
- **R1-C:** Lab and later CLI consume the same wire records; process-local accepted
  capabilities never cross a persistence or network boundary.

Exit criteria: byte-identical results and rejection precedence across both languages;
bounded unknown/malformed inputs fail closed; restart rebuilds state only by replay;
and the browser no longer supplies mortality observation as a JavaScript object graph.

### R2 — deterministic state-bearing kernel

Goal: make one entity carry deterministic mutable state without conflating state with
custody or liveness.

Exit criteria:

- versioned genome ABI and canonical prior-state/event inputs;
- deterministic next-state bytes and content-addressed root;
- explicit instruction, memory, output, and state-size ceilings with stable errors;
- at least two independent runtimes agree on every committed vector;
- replay, restart, crash, invalid instruction, and resource exhaustion are atomic;
- lifecycle Pulse binds the resulting state root without letting the executor decide
  custody validity; and
- 10,000 seeded differential transitions produce exact results.

### R3/R4 — availability and network embodiment

R3 defines replication/recovery thresholds and verifiable possession or retrieval
evidence. R4 adds process-neutral transport, multi-endpoint churn, then swappable
WebRTC/libp2p/other transports. Transport and storage carry evidence; neither selects
accepted state.

### R5/R6 — resource and model organs

Only after R2–R4 should MortalOS add sandboxed shared compute, storage markets,
WebGPU, distributed weights, or ownerless-model claims.

## 7. Global stop conditions

Stop and reopen the earliest responsible gate if:

- two runtimes disagree on bytes, signatures, parent resolution, state, or first error;
- replay/fork silently changes the recognized head;
- death is inferred from silence, process exit, empty local evidence, or unverifiable
  deletion;
- UI, endpoint, transport, storage, deployment, or model output bypasses validation;
- logical keys are presented as independent physical participants;
- a URL is called deployed without exact-SHA asset/header/browser verification;
- repository, deployment, video, and submission describe different behavior; or
- a public claim exceeds executable evidence.
