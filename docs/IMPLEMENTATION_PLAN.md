# MortalOS Implementation Plan

Status: **P0/H3A/H3B/R1 merged; public Sites fallback live; direct Pages final judge path under review; submission sprint active**

Last reviewed: **2026-07-18 KST**

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

`truthful status → reviewed exact-SHA Pages release → video → fields → submit`

The direct Cloudflare Pages Lab is the intended zero-install final submission
surface. It binds the repository-owned Function, assets, headers, and manifest to one
reviewed `main` SHA. The public Sites Lab remains a logged-out fallback only while
that Pages release is pending; it must not be presented as the final judge URL once
Pages passes the exact-SHA remote gate. Both surfaces show two committed R1 mortality
outcomes and call GPT-5.6 only as a server-side, non-authoritative witness. Neither
adds network participants, proves ownerlessness, or implements mutable state.

### Protocol lane — R1-A/R1-B merged; R1-C and R2 after submission

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

PR #12 merged a bounded R1-A/R1-B profile for Genesis validation, lineage replay, and
mortality across eight golden operations after exact-head CI and logical reviewer
verification. Its Python verifier intentionally covers only that frozen corpus
profile. R1-C and broader adversarial/differential coverage remain. H3B and Sites are
delivery surfaces, not substitutes for R1 or R2. The older R2 prototype is research
input only and must not merge ahead of current R1-C/submission work.

## 3. Submission critical path

### S0 — public judge path

Goal: a logged-out judge opens one HTTPS URL and completes the working Lab without
credentials, installation, or a local build.

Minimum Devpost pass criteria:

- the final Pages URL opens logged out over HTTPS and exposes the two deterministic R1
  scenarios without installation, a build, credentials, or a test account;
- the displayed operation hashes and outcomes match committed R1 corpus entries on
  the final reviewed repository SHA;
- GPT-5.6 receives only the public deterministic result, returns a bounded structured
  explanation, and never changes the R1 verdict;
- unknown or private fields are rejected before the model call, and model failure
  leaves the deterministic result usable;
- the repository contains the deployed Pages source and reproducible judge
  instructions; and
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

Implementation: OpenAI Sites remains the live fallback judge URL. Direct Cloudflare
Pages is the intended final judge path: its GitHub workflow migrates the rate-limit
database, builds, deploys, and re-verifies the exact reviewed repository commit.
Devpost reports `website_required: false`, but the direct Pages route supplies the
stronger no-rebuild proof tying source, Function, assets, headers, and manifest to one
SHA.

Failure rule: an unverified, stale, preview-only, or credentialed URL is not a pass.
Cloudflare account credentials are now present. The remaining gate is the reviewed
Pages-compatible D1 repair and its exact-main deployment. The Sites minimum path stays
available during repair, and no document may call the `pages.dev` target deployed
until its exact verifier passes.

Current evidence and closure sequence:

1. H3B merged at `294b741bc89c72ee4ae4f3aea27a21515d0d1469` and passed push
   Verify `29513454019/1`, including actual Chromium, Lab, coverage, and audit.
2. The initial deploy `29513454211/1` historically failed at credential preflight.
   The account ID, a Pages Edit plus D1 Edit user token, and all four GitHub secrets
   are now present. Exact-main runs `29588418943` and `29591202642` passed source
   tests, then exposed the unsupported Pages `ratelimits` configuration before deploy.
3. `https://mortalos-evidence-lab.ant713800.chatgpt.site` returned logged-out HTTP
   200; its GPT witness returned HTTP 200 for a public R1 result and rejected an
   injected `private_key` with HTTP 422 before inference. Devpost now uses this URL.
4. Sites version 2 is public and has its own immutable source commit/archive digest.
   Its two displayed operation hashes/outcomes exactly match the merged R1 corpus,
   but the Sites source commit is not a MortalOS repository commit. Import or
   reproducibly link the deployed source and add a repeatable smoke/provenance check.
5. PR #12 merged R1 at `6c5b85fd8e467feb4df63556864ea5f8949e7b61`
   after exact-head Verify `29515312168` and a logical reviewer PASS at head
   `f60be06529ac3b34c40d9873dddabc681577cb4d`. This correction removes the stale
   H3B checklist claims that landed with it while retaining the narrow R1 scope.
6. PR #16 merged the provisioned D1 database and one atomic private-actor
   minute-window UPSERT at `b107a683e4d646b1b7940b241207d7740853e25f` after
   immutable review and exact-head CI. Post-merge Verify passed and the exact-main
   deploy published Pages. The final gate correctly rejected a JavaScript MIME
   mismatch: live Pages used `application/javascript` while the manifest declared
   `text/javascript`. Review of the first fix found the masked canonical-route
   behavior too: `/index.html` redirects to `/`. Reconcile both contracts through
   review and redeploy, then accept the URL only after exact
   asset/header/API/Chromium proof.

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
| Jul 17, 12:00 | post-R1 status correction reviewed and merged | no stale reviewer/deployment claim survives; 8/8 R1 scope remains explicit |
| Jul 18, 12:00 | Pages-compatible repair reviewed and final public judge instructions prepared | immutable review and exact-head checks pass; Sites remains fallback until exact-main deployment |
| Jul 18, 18:00 | Devpost custom-field draft and video script/rehearsal complete | only public video and `/feedback` may remain open; duration below three minutes |
| Jul 19, 18:00 | public video uploaded and submission rehearsal completed | public YouTube voiceover covers project, Codex, and GPT-5.6 |
| Jul 20, 12:00 | `/feedback`, category, country, submitter type, URLs, and test instructions staged | every required field has a final value |
| Jul 21, 18:00 | final code/content freeze | all checks green; exact URLs and SHA frozen |
| Jul 22, 07:00 | Devpost submitted | non-draft submission confirmed; two-hour buffer remains |

Cloudflare direct deployment is the final judge-path gate. It must complete without
displacing R1 provenance, video, required fields, rehearsal, or the Jul 22 submission
deadline; Sites may replace it only as an explicitly documented emergency fallback.
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
- **R1-A merged through PR #12:** JavaScript emits bounded canonical operations/results
  for Genesis validation, linear lineage replay, replay rejection, two qualified
  mortality cases, version rejection, and noncanonical input.
- **R1-B merged through PR #12:** independently authored Python consumes those eight
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
