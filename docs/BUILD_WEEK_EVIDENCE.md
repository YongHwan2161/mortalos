# Build Week Release Evidence

As of: **2026-07-17 KST**

Candidate branch: `agent/codex-protocol-kernel--build-week-finalization`

Candidate base: `1c3e7956b1386c4b6ff1edab2249ff0d6c5d21a7`

This is a rolling release record, not a completion claim. A gate is `PASS` only when
the listed command or external readback has succeeded for the candidate. `WAIT`
means the implementation may exist but the required external evidence does not.

## Release scoreboard

| Stage | State | Strict evidence |
| --- | --- | --- |
| 0 — truthful baseline and Windows fidelity | PASS | Isolated current-main worktree; `.gitattributes`; repository text scan reports zero CRLF files; `npm ci` succeeds with zero audit vulnerabilities. |
| 1 — exact-SHA public Cloudflare release | WAIT | Pages Function and rate-limit configuration compile, but Cloudflare OAuth is waiting for account sign-in. No `pages.dev` success claim is permitted yet. |
| 2 — GPT-5.6 adversarial witness | PASS locally | Existing key, Responses API, `gpt-5.6` alias resolving to `gpt-5.6-sol`, strict JSON Schema, `store: false`, bounded body/output, 15-second production timeout, keyed privacy-preserving actor identifiers, no client secret. |
| 3 — 90-second judge path | PASS locally | Desktop/mobile visual check plus three-context real-Chromium acceptance; four or fewer judge actions; GPT-off replay uses the same canonical digest and kernel result. |
| 4 — evidence and source reconciliation | PASS locally | Source, tests, deployment config, this evidence record, and demo script are in the candidate; package, audit, coverage, and governance gates pass. Immutable review and deployed-SHA binding remain release gates. |
| 5 — Codex `/feedback` | WAIT | A qualifying Session ID has not been returned by `/feedback`; a task/thread UUID is not accepted as a substitute. |
| 6 — Devpost fields and final story | WAIT | Project page is published, not submitted; required Session ID, video, submitter/country/category readback, and final judge instructions remain. |
| 7 — public narrated demo | IN PROGRESS | A complete 2:50 script and shot list exist; final deployed recording and public YouTube readback remain. |
| 8 — freeze, reviewed deploy, and submit | WAIT | Requires immutable independent review, green exact-head CI, logged-out remote acceptance, public video, required form fields, and Devpost `submitted_at`. |

## Stage 0 evidence

- Remote `main` audit base: `1c3e7956b1386c4b6ff1edab2249ff0d6c5d21a7`.
- PR #11, #12, and #14 are merged. The latest audited `Verify` run on `main` passed.
- The earlier direct deploy run failed at credential preflight; it did not deploy.
- An isolated Windows worktree and task branch were created from that exact base.
- `.gitattributes` now requires LF for source, workflow, JSON, Markdown, HTML, CSS,
  license, and Pages header files.
- A repository-wide scan over those text classes returned `LF scan: PASS (no CRLF)`.
- Windows exposed two pre-existing portability defects that Linux CI did not catch:
  `URL.pathname` produced a doubled drive prefix for the Python R1 verifier, and the
  coverage script used POSIX-only inline environment assignment. Both now have
  cross-platform launchers and regression coverage.

Pass condition: a fresh Windows clone must preserve LF-sensitive governance and
workflow checks without manual conversion. This must be rerun after merge before
Stage 8 can close.

## Stage 2 evidence

### Authority boundary

`POST /api/scenarios` accepts only four exact request keys and a 4,096-byte maximum.
It permits ten versioned mutation enums across continuation, fork, and mortality.
GPT-5.6 returns a schema-constrained proposal, prediction, and rationale. The
compiler discards free-form text, derives a fixture from the selected enum, emits
canonical `mortalos-compiled-scenario/1` bytes, and hashes them. The existing
lineage/mortality kernel then evaluates fresh committed evidence.

The route rejects wrong method, origin, media type, body size, schema, mutation kind,
model family, refusal, incomplete response, malformed model output, missing binding,
and missing secret with stable non-sensitive errors. The server derives both the
Cloudflare rate key and OpenAI `safety_identifier` from the Cloudflare-injected
connecting address using HMAC-SHA-256, a runtime-only secret, and distinct domain
separation labels. The caller-controlled page `client_id` never contributes to either
identifier: the same edge actor remains stable across rotated client IDs and different
edge actors separate. Neither the raw address nor either derived value is logged or
returned.

This anonymous public Lab uses the strongest server-trusted actor signal available
without adding accounts, cookies, persistent browser storage, or an Enterprise-only
device fingerprint. OpenAI requires a stable, hashed end-user identifier, and
Cloudflare documents that direct edge traffic receives `CF-Connecting-IP` from the
edge while a client-supplied value is stripped. The HMAC secret prevents offline
recovery of low-entropy address values from the identifier.

- OpenAI: <https://developers.openai.com/api/docs/guides/safety-checks#implementing-safety-identifiers-for-individual-users>
- Cloudflare: <https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip>

### Fixed evaluation

Command: `npm run verify:gpt-scenarios`

Observed result using the existing key:

- model readback: `gpt-5.6-sol`;
- fixed cases: **25/25** API/schema passes;
- intended mutation selection: **25/25**;
- selected mutation coverage: **10/10**;
- kernel plus GPT-off replay: **25/25**;
- injected private sentinel reflected: **0**; and
- model status/code prediction exactly matching the kernel: **0/25**.

The last result is the strongest product evidence: GPT found the intended attack in
every case but did not reproduce the protocol's exact verdict vocabulary. The model
is useful as an adversarial witness and unsafe as a validity oracle.

Unit command: `npm run test:scenarios`

Observed result: **7/7 tests pass**, including stable same-actor/different-client-ID
and different-actor privacy regressions, all ten enum-to-kernel cases, request
abuse, rate limiting, missing configuration, upstream failures/refusal/incomplete
output, timeout, secret non-disclosure, canonical digest stability, and byte tamper
rejection.

## Stage 4 local release evidence

- `npm run test:coverage`: **73 pass, 0 fail, 2 intentional skips**; 96.00% line,
  92.56% branch, and 95.22% function coverage.
- `npm run test:governance:coverage`: **30/30 pass**; 92.68% line, 84.39% branch,
  and 93.75% function coverage over the governed worktree and PR verifiers.
- `npm test`: the complete ordered repository contract passes in **1,131.8 seconds**
  on Windows, including genuine signature-budget boundaries, 10,000 fixed property
  cases, and committed/Node/browser-target portable equality.
- `npm audit --audit-level=moderate`: **0 vulnerabilities**.
- `npm pack --dry-run --json`: succeeds after excluding local Wrangler build state;
  no generated `.wrangler` implementation or type artifact is publishable.
- Measured Windows component gates total more than 20 minutes because the fixed
  10,000-case property and portable differential checks are intentionally heavy.
  Verify and deploy workflow limits are therefore 60 minutes, avoiding a false
  timeout while retaining a hard upper bound.

## Stage 3 evidence

Command: `npm run verify:lab`

Observed result: `MortalOS Lab H3A local Chromium acceptance: PASS` in 67.6 seconds.

- three clean contexts and all three logical two-key combinations accepted;
- non-extractable Worker keys and private export rejection;
- sign-once request derivation inside the Worker;
- 15 named, 13 boundary, and 10,000 seeded adversarial corpus cases exact;
- cross-origin isolation and `SharedArrayBuffer` rejection as protocol input;
- canonical public evidence exported and replayed to the same head;
- the guided GPT scenario compiled, ran in the kernel, and replayed without GPT;
- mobile 360-pixel and reduced-motion checks; and
- no persistence, cookie, Service Worker, external browser request, or console error.

The guided path requires at most four visible actions:

1. open `Run the 90-second proof`;
2. run the deterministic baseline;
3. ask GPT, compile, and run the kernel; and
4. replay the exact bytes without GPT.

## Deployment evidence still required

The final Cloudflare evidence is all-or-nothing:

1. authenticated account and account-scoped Pages token;
2. GitHub secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
   `OPENAI_API_KEY`, and `SAFETY_IDENTIFIER_SECRET` present without value disclosure;
3. independent review of one immutable candidate head;
4. deploy from reviewed `main`, never a dirty tree or feature branch;
5. `asset-manifest.json.source_commit` equals that exact 40-character SHA;
6. byte, digest, MIME, security-header, API, and Chromium remote gates pass;
7. logged-out public URL and API work; and
8. Devpost, video, repository, and manifest identify the same behavior and SHA.

The live Sites URL remains a judge-access fallback until those criteria pass. It is
not evidence that this candidate's Pages Function or exact assets are deployed.

## Release commands

```bash
npm ci
npm test
npm run test:coverage
npm run test:chromium
npm run verify:lab
npm run verify:gpt-scenarios
npm audit --audit-level=high
npm pack --dry-run
```

Remote exact-head commands:

```bash
MORTALOS_LAB_URL=https://mortalos-lab-yonghwan2161.pages.dev \
MORTALOS_EXPECTED_COMMIT=<reviewed-main-sha> \
npm run verify:deployed-lab

MORTALOS_LAB_URL=https://mortalos-lab-yonghwan2161.pages.dev \
npm run verify:gpt-scenarios
```

## No-submit rule

Do not submit while any of the following is absent: public narrated YouTube URL,
real `/feedback` Session ID, required Devpost field readback, independently reviewed
and green source head, logged-out working judge URL, or consistent final SHA/story.
