# Build Week Release Evidence

As of: **2026-07-18 KST**

Evidence-sync branch: `agent/codex-protocol-kernel--release-evidence-freeze`

Evidence-sync base: `4bb8924d33b42be02bc9380ed6e3cee3eabd97b2`

This is a rolling release record, not a completion claim. A gate is `PASS` only when
the listed command or external readback has succeeded for the candidate. `WAIT`
means the implementation may exist but the required external evidence does not.

## Release scoreboard

| Stage | State | Strict evidence |
| --- | --- | --- |
| 0 — truthful baseline and Windows fidelity | PASS | Isolated current-main worktree; `.gitattributes`; repository text scan reports zero CRLF files; `npm ci` succeeds with zero audit vulnerabilities. |
| 1 — exact-SHA public Cloudflare release | PASS at `4bb8924d...` | PR #17 final head passed exact-head Verify/policy and immutable review; post-merge Verify `29630532558/1` and Deploy `29630532541/1` passed. The public manifest, six assets, security headers, API, and three-context Chromium path all matched exact `main`. |
| 2 — GPT-5.6 adversarial witness | PASS locally and publicly | Existing key, Responses API, `gpt-5.6` alias resolving to `gpt-5.6-sol`, strict JSON Schema, `store: false`, bounded body/output, 15-second production timeout, keyed privacy-preserving actor identifiers, no client secret. Public proposal, kernel verdict, and GPT-off exact replay passed. |
| 3 — 90-second judge path | PARTIAL locally | Three-context real-Chromium automation passes at 360/768/1440 with a keyboard-only full-control path, accessibility-tree/status/focus checks, simulated-broadband interactivity, four judge actions, and GPT-off replay. Three first-time human testers remain mandatory. |
| 4 — evidence and source reconciliation | PASS at accepted source | Judge-first README, five evidence mappings, link checker, source, tests, deployment config, evidence record, and demo script are repository-owned. The public manifest binds them to the reviewed source; this docs-only synchronization must repeat normal review/deploy gates. |
| 5 — Codex `/feedback` | PARTIAL | The submitter selected the current implementation session; exact Devpost field readback still remains. |
| 6 — Devpost fields and final story | PARTIAL | Project page is published and the public video is attached, but it is not submitted; submitter/country, Session ID, final URL/instructions, and required-field readback remain. |
| 7 — public narrated demo | PARTIAL | Public 2:38 YouTube video, English narration, burned captions, metadata, and logged-out oEmbed readback pass: <https://youtu.be/QJBHKFyMrno>. Its displayed source SHA predates the accepted deployment, so a final-source rerender/upload remains. |
| 8 — freeze, reviewed deploy, and submit | WAIT | Public deployment is accepted. Final-source video, three genuine first-time testers, required personal/form readback, and non-null Devpost `submitted_at` remain. |

## Stage 0 evidence

- Remote `main` audit base: `4bb8924d33b42be02bc9380ed6e3cee3eabd97b2`.
- PR #11, #12, #14, #15, #16, and #17 are merged. Latest post-merge `Verify`
  run `29630532558/1` passed.
- Exact-main deploy runs `29588418943` and `29591202642` passed source tests, then
  failed before deployment because Wrangler rejects `ratelimits` in a Pages project
  configuration. The account and repository credentials themselves are present.
- A Windows `core.autocrlf=true` clean clone of exact PR #17 head `4d792ae90448...`
  completed `npm ci && npm test` in 1,149.0 seconds with a clean checkout.
- `.gitattributes` now requires LF for source, workflow, JSON, Markdown, HTML, CSS,
  license, and Pages header files.
- A repository-wide scan over those text classes returned `LF scan: PASS (no CRLF)`.
- Windows exposed two pre-existing portability defects that Linux CI did not catch:
  `URL.pathname` produced a doubled drive prefix for the Python R1 verifier, and the
  coverage script used POSIX-only inline environment assignment. Both now have
  cross-platform launchers and regression coverage.

Pass condition: every runtime-changing candidate must preserve the recorded Windows
clean-clone gate. This evidence-only follow-up changes no runtime/build asset and
must still pass exact-head CI and diff/line-ending checks.

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

The deployment-compatible repair binds `SCENARIO_RATE_DB` to the provisioned
`mortalos-lab-rate-limit` D1 database. One atomic SQLite `INSERT ... ON CONFLICT ...
RETURNING` statement rotates the minute window and increments the counter. The only
stored actor value is the domain-separated HMAC identifier; no raw address is stored.
Requests 1–10 proceed, request 11 and later receive `429`, and missing/failed/malformed
D1 results fail closed before OpenAI. The remote strict-table migration passed, and
20 concurrent production D1 API calls returned each count exactly once from 1 through
20; the probe row was deleted and read back as absent.

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

The current production-timeout rerun captured a redacted trace for all 25 actual
`POST https://api.openai.com/v1/responses` calls: request model `gpt-5.6`, response
model `gpt-5.6-sol`, HTTP 200, `store: false`, and valid privacy identifier format on
every call. No header, credential, hypothesis, response ID, or free-form content is
retained in the trace. End-to-end API latency was p50 **4,425 ms**, p95 **11,140 ms**,
and maximum **12,817 ms** under the production 15,000 ms deadline.

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

Observed result: `MortalOS Lab H3A local Chromium acceptance: PASS` in 87.8 seconds.

- three clean contexts and all three logical two-key combinations accepted;
- non-extractable Worker keys and private export rejection;
- sign-once request derivation inside the Worker;
- 15 named, 13 boundary, and 10,000 seeded adversarial corpus cases exact;
- cross-origin isolation and `SharedArrayBuffer` rejection as protocol input;
- canonical public evidence exported and replayed to the same head;
- the guided GPT scenario compiled, ran in the kernel, and replayed without GPT;
- 360-, 768-, and 1440-pixel overflow checks;
- every interactive control exercised through the keyboard-only context with a
  non-zero focus outline, plus named-control Chromium accessibility-tree evidence;
- live-region roles, non-color status text, reduced motion, and final release
  digest/source/repository/`Run another attack` completion state;
- simulated 10 Mbps/40 ms broadband DOM interactive at or below two seconds; and
- no broken same-origin link, stale busy label, unrecoverable loading state,
  persistence, cookie, Service Worker, external browser request, or console error.

The guided path requires at most four visible actions:

1. open `Run the 90-second proof`;
2. run the deterministic baseline;
3. ask GPT, compile, and run the kernel; and
4. replay the exact bytes without GPT.

The automated contexts do not satisfy the separate human gate. Three first-time
developers must still complete the protocol in `outputs/CLEAN_ROOM_TEST_PROTOCOL.md`
without coaching and correctly explain logical-versus-physical quorum and
silence-versus-qualified-death before Stage 3 can be marked complete.

## Stage 4 local evidence

- The README begins with the problem, public-status truth, four-action judge path,
  three proofs, three non-claims, credential-free quickstart, and five concrete
  Codex/GPT decision-or-test mappings.
- Claimed release hosts are Windows, Ubuntu Linux, and current Chromium; macOS is no
  longer presented as a gated platform.
- `npm run verify:links` resolves all 19 local release-document targets and validates
  HTTPS syntax. `MORTALOS_CHECK_EXTERNAL_LINKS=1 npm run verify:links` is the final
  public-resolution gate after the exact Cloudflare URL exists.
- The credential-free Run block no longer includes the live GPT evaluation. Its two
  required runtime secrets and non-persistence rule are stated separately.

## Accepted deployment evidence and recurrence rule

The final Cloudflare evidence is all-or-nothing. The release at
`4bb8924d33b42be02bc9380ed6e3cee3eabd97b2` satisfied items 1–7:

1. authenticated account and user token scoped to Pages Edit and D1 Edit on the target account;
2. GitHub secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
   `OPENAI_API_KEY`, and `SAFETY_IDENTIFIER_SECRET` present without value disclosure;
3. independent review of one immutable candidate head;
4. deploy from reviewed `main`, never a dirty tree or feature branch;
5. `asset-manifest.json.source_commit` equals that exact 40-character SHA;
6. byte, digest, MIME, security-header, API, and Chromium remote gates pass;
7. logged-out public URL and API work; and
8. Devpost, video, repository, and manifest identify the same behavior and SHA.

The accepted workflow was
<https://github.com/YongHwan2161/mortalos/actions/runs/29630532541>. It applied the
D1 migration, configured runtime secrets without exposing values, deployed exact
`main`, verified six remote assets and the checked-in security-header contract, ran
the API happy/error/rate-limit suite, and completed the full Lab in three clean
Chromium contexts. A separate interactive logged-out readback completed baseline,
`gpt-5.6-sol` proposal, kernel rejection, and GPT-off replay with canonical digest
`sha256:-DZGv0YfUmLcIjxHOlWB8yWrT-1yA4KSq-kQqQe64Zg`. The page displayed release
asset digest `sha256:VW018QRVpiK50L0YHwTPG0p5PP7dILdiay2Ia9aFc98` and the exact
source commit above.

Rollback rule: preserve the last logged-out-verified production deployment while a
fault is investigated. Revert the faulty source through a focused PR, bind review and
CI to that immutable revert head, merge with an expected SHA, and let the exact-main
workflow deploy the resulting new commit. Never patch production bytes, bypass review,
or relabel an older manifest as the current source.

The live Sites URL remains a judge-access emergency fallback. It is not evidence for
the Pages Function or exact assets and is not the final Devpost judge URL.

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
