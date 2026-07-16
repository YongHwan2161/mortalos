# MortalOS Implementation Plan

Status: **P0/H3A/H3B contract merged; public Sites judge path live; R1 PR pending; submission sprint active**

Last reviewed: **2026-07-17 KST**

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

`truthful status → R1 merge → public Sites provenance → video → fields → submit`

The public Sites Lab is the zero-install submission surface. It shows two committed
R1 mortality outcomes and calls GPT-5.6 only as a server-side, non-authoritative
witness. It does not add network participants, prove ownerlessness, or implement
mutable state. Its source/version provenance and the R1 implementation it cites must
be reconciled with a reviewed repository commit before final freeze.

### Protocol lane — R1 now; R2 after submission

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

Open PR #12 implements a bounded R1-A/R1-B candidate for Genesis validation, lineage
replay, and mortality across eight golden operations. It is not merged or independently
reviewed yet, and its Python verifier intentionally covers only that frozen corpus
profile. R1-C and broader adversarial/differential coverage remain. H3B and Sites are
delivery surfaces, not substitutes for R1 or R2. The older R2 prototype is research
input only and must not merge ahead of the current mortality-safe main and reviewed R1.

## 3. Submission critical path

### S0 — public judge path

Goal: a logged-out judge opens one HTTPS URL and completes the working Lab without
credentials, installation, or a local build.

Minimum Devpost pass criteria:

- the Sites URL opens logged out over HTTPS and exposes the two deterministic R1
  scenarios without installation, a build, credentials, or a test account;
- the displayed operation hashes and outcomes match committed R1 corpus entries on
  the final reviewed repository SHA;
- GPT-5.6 receives only the public deterministic result, returns a bounded structured
  explanation, and never changes the R1 verdict;
- unknown or private fields are rejected before the model call, and model failure
  leaves the deterministic result usable;
- the repository contains or links reproducibly to the deployed Sites source, saved
  version, and judge instructions; and
- the public page, repository, video, and Devpost prose use the same claim boundaries.

Additional H3B exact-deployment criteria:

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

Implementation: OpenAI Sites is now the primary judge URL and is served publicly
through Cloudflare infrastructure. Direct Cloudflare Pages remains the deeper H3B
path: its GitHub workflow builds, deploys, and re-verifies the exact reviewed commit.
Devpost reports `website_required: false`; the Developer Tools rule requires a
no-rebuild path, which the verified Sites URL can satisfy without a separate Pages
deployment.

Failure rule: an unverified, stale, preview-only, or credentialed URL is not a pass.
Missing Cloudflare account credentials blocks only the direct H3B Pages proof while
the Sites minimum path remains healthy and traceable. No document may call the
`pages.dev` target deployed until its exact verifier passes.

Current evidence and closure sequence:

1. `main` `294b741bc89c72ee4ae4f3aea27a21515d0d1469` passed push Verify
   `29513454019/1`, including actual Chromium, Lab, coverage, and audit.
2. Deploy `29513454211/1` failed at credential preflight; both
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` were empty, so deployment and
   all remote checks were skipped.
3. `https://mortalos-evidence-lab.ant713800.chatgpt.site` returned logged-out HTTP
   200; its GPT witness returned HTTP 200 for a public R1 result and rejected an
   injected `private_key` with HTTP 422 before inference. Devpost now uses this URL.
4. Sites version 2 is public and has its own immutable source commit/archive digest,
   but that source commit is not a commit in the MortalOS repository. Import or
   reproducibly link the deployed source and bind its two displayed results to the
   final reviewed R1 corpus before freeze.
5. PR #12 is the current R1 candidate. It shares the pre-correction base and contains
   stale H3B review/deployment statements; it must rebase after the status correction,
   preserve the governance incident, and pass a fresh immutable-head review and CI.
6. A direct Cloudflare Pages deployment is a parallel hardening task, not a submit
   blocker. If an authenticated account becomes available within the time box, use a
   Pages-Edit-only token, store the account ID/token as the two GitHub secrets, rerun
   `Deploy MortalOS Lab`, and accept it only after exact asset/header/Chromium proof.

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

The event requirement concerns how the project was built and does not require runtime
inference, but a real Sites GPT-5.6 witness now exists. It remains outside validity:
the server route receives only one public R1 result, uses structured output, and may
fail without affecting the deterministic verdict. The repository still needs the
deployed route/source provenance and reproducible validation evidence.

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
2. 0:20–1:05 — switch between incomplete and complete evidence and compare the two
   deterministic mortality outcomes;
3. 1:05–1:35 — ask GPT-5.6 to explain the public result and point out that it has no
   signing, validation, head-selection, or death authority;
4. 1:35–2:10 — show the exact R1 corpus and JavaScript/Python byte equality;
5. 2:10–2:40 — explain how Codex/GPT-5.6 accelerated adversarial definitions, tests,
   deployment, and review while the human retained scope and threat assumptions; and
6. 2:40–2:55 — repository, claim boundaries, and next R1-C/R2 step.

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
| Jul 17, 12:00 | status correction merged; PR #12 rebased with truthful H3B/Sites state | no stale reviewer/deployment claim survives |
| Jul 17, 20:00 | R1 candidate independently reviewed, CI-green, and merged | exact-head review plus 8/8 JS/Python goldens; limitations explicit |
| Jul 18, 12:00 | Sites source/version provenance and final public judge instructions frozen | logged-out 200, GPT 200, private-field 422, displayed outcomes match reviewed R1 |
| Jul 18, 18:00 | Devpost custom-field draft and video script/rehearsal complete | only public video and `/feedback` may remain open; duration below three minutes |
| Jul 19, 18:00 | public video uploaded and submission rehearsal completed | public YouTube voiceover covers project, Codex, and GPT-5.6 |
| Jul 20, 12:00 | `/feedback`, category, country, submitter type, URLs, and test instructions staged | every required field has a final value |
| Jul 21, 18:00 | final code/content freeze | all checks green; exact URLs and SHA frozen |
| Jul 22, 07:00 | Devpost submitted | non-draft submission confirmed; two-hour buffer remains |

Cloudflare direct deployment may use spare capacity only through Jul 18 12:00 KST;
after that it cannot displace R1 provenance, video, fields, rehearsal, or submission.
Do not spend the submission lane on R2, distributed inference, WebRTC/libp2p, token
economics, durable key custody, or a polished CLI unless every S0–S5 blocker is closed.

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
- **R1-A candidate in PR #12:** JavaScript emits bounded canonical operations/results
  for Genesis validation, linear lineage replay, replay rejection, two qualified
  mortality cases, version rejection, and noncanonical input.
- **R1-B candidate in PR #12:** independently authored Python consumes those eight
  unchanged goldens without importing or executing the JavaScript implementation.
  This is a frozen-corpus differential, not yet a general Python implementation of
  arbitrary pending evidence, every fork, or all resource ceilings.
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
