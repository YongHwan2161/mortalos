# Build Week Submission Checklist

Status: **active; project page published, hackathon submission not yet submitted**

Last synchronized with Devpost: **2026-07-17 KST**

Hard deadline: **2026-07-22 00:00 UTC / 2026-07-22 09:00 KST**

## Product position

- Project: **MortalOS**
- Product surface: **MortalOS Lab**
- Category: **Developer Tools**
- Job: let developers inspect and falsify identity, custody, succession, replay,
  fork, and qualified mortality assumptions in ephemeral multi-endpoint systems.

## Official deliverables

| Deliverable | State | Closure evidence |
| --- | --- | --- |
| Working project | R1 merged; public Sites Lab live; full Pages candidate locally green | reviewed exact-head Pages deployment plus logged-out smoke tests |
| Category | Selected in plan | Devpost field `Developer Tools` |
| Project description | Saved with R1/GPT story and Sites URL | final story matches merged code and deployed behavior |
| Demo video | Missing | public YouTube, under three minutes, narrated |
| Code repository | Available | public repo, Apache-2.0, final README |
| README/setup/sample/run guidance | Candidate implemented; exact public SHA pending | clean-room instructions and exact judge path |
| Codex and GPT-5.6 usage | Repository/story saved; video pending | concrete README/story/video examples |
| `/feedback` Session ID | Missing | required Devpost custom field |
| Dev-tool installation/platform/testing path | Public browser URL live; final text pending | browser URL plus local Node 22.5+ fallback |

The Devpost form does not globally require a website, but the Developer Tools rules
require a no-rebuild test path. The public Sites Lab is now the primary path; local
`npm ci && npm run dev:lab` is the fallback. Direct Cloudflare Pages is an optional
exact-commit evidence layer, not the submission definition of done.

## Repository release gate

- [x] Apache-2.0 root license and package metadata.
- [x] Third-party notices and bundled browser licenses.
- [x] Honest distinction among logical keys, physical failure domains, local
  authority loss, and qualified protocol death.
- [ ] PR #11's review-provenance/TOCTOU incident is recorded and not represented as
  a normal reviewer-gate pass; subsequent changes use the normal immutable-head gate.
- [x] Post-merge `main` Verify `29513454019/1` passed.
- [x] `npm test`, coverage, actual Chromium, Lab, audit, and package dry-run passed
  for the merged contract.
- [ ] README includes supported platforms, install/run commands, sample path, public
  test URL, deployed commit, and concise judge instructions.
- [x] PR #12's final R1 head passed exact-head Verify and logical immutable-head
  reviewer checks; its Python claim remains limited to the eight-record profile.
- [ ] Final secret scan finds no API token, private key, credential, or restricted
  artifact in source, history delta, logs, screenshots, bundle, or video.

## Public Sites minimum release gate

- [x] URL returns HTTP 200 without sign-in.
- [x] Public R1 result receives a structured GPT-5.6 explanation with HTTP 200.
- [x] An injected `private_key` field is rejected with HTTP 422 before inference.
- [x] Sites version 2 records an immutable source commit and archive digest.
- [ ] Sites source is committed to or reproducibly linked from the public repository.
- [x] The two displayed operation hashes/outcomes exactly match the merged R1 corpus.
- [ ] A repeatable repository smoke test covers public HTTP, response schema,
  private-field rejection, and Sites/R1 provenance.
- [ ] Devpost, README, video, and Sites version identify the same final evidence set.

## Direct H3B Cloudflare release gate

- [x] GitHub repository secret `OPENAI_API_KEY` exists; its value is never emitted.
- [x] GitHub repository secret `SAFETY_IDENTIFIER_SECRET` exists; its value is never
  emitted, and Cloudflare receives it only through the deployment secret pipe.
- [ ] GitHub repository secrets `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` are non-empty; the token is account-scoped to Cloudflare
  Pages Edit and never exposed in repository or logs.
- [ ] Cloudflare Pages deployment completes from reviewed `main`.
- [ ] `asset-manifest.json` names the exact deployed source commit.
- [ ] Every remote asset matches local bytes, digest, MIME, and security headers.
- [ ] `npm run verify:lab` passes against the public URL in three clean contexts.
- [ ] Logged-out browser completes birth, one-key rejection, every two-key heartbeat
  pair, replay, fork, qualified death, resurrection rejection, clone, corpus, and
  canonical evidence export/replay.
- [ ] No external browser requests, analytics, cookies, persistence, Service Worker,
  private custodian material, or console errors.

## Codex/GPT-5.6 evidence gate

The release candidate includes a tested GPT-5.6 adversarial witness. The repository
and video must show both its strict non-authority boundary and how Codex with GPT-5.6
materially accelerated construction:

- [x] operational definitions of birth, identity, succession, qualified death, and
  resurrection rejection;
- [x] adversarial P0 review of evidence completeness, hostile observation, equivocation,
  and resource ceilings;
- [x] deterministic conformance/property/browser test generation and interpretation;
- [x] Cloudflare exact-artifact and security-header deployment contract; and
- [x] deadline-driven separation of submission surface from R1/R2 research.
- [x] Repository-owned GPT route, strict request/response schema, deterministic
  compiler, all ten kernel cases, security failures, and 25-case live eval.
- [x] Live eval selects the intended mutation 25/25 and covers 10/10, while exact
  model verdict prediction is honestly reported as 0/25.
- [ ] The reviewed source is deployed and bound to the exact public manifest SHA;
  no model credential appears client-side, in logs, screenshots, or video.

Human decisions must remain visible: North Star, scope, threat assumptions, claim
limits, Apache-2.0, product category, and final submission wording.

## Minimum judge path

1. Open the final public Lab without signing in and choose `Run the 90-second proof`.
2. Run the committed deterministic baseline.
3. Ask GPT-5.6 to propose one bounded attack; compare its prediction with the actual
   kernel status/code and canonical digest.
4. Choose `Replay without GPT`; verify the same digest and kernel result with no
   second API call.
5. In advanced mode, show the logical `2-of-3` browser incubator, reference turnover,
   and complete committed corpus.
6. Open the repository evidence record and R1 JavaScript/Python verifier.

The CLI singleton is supporting evidence only. It does not replace the visual path.

## Devpost form gate

- [ ] Submitter type completed.
- [ ] Country of residence completed.
- [ ] Category set to `Developer Tools`.
- [x] Repository URL entered.
- [x] Public Sites Lab URL entered.
- [ ] Final judge instructions entered.
- [ ] `/feedback` Session ID entered.
- [ ] Dev-tool installation, supported platforms, and test instructions entered.
- [x] Project story and accurate tagline saved.
- [ ] Public narrated YouTube video attached.
- [ ] Team membership is correct.
- [ ] Final state is submitted to the hackathon; a merely published project page is
  not sufficient.

## Video gate

- [ ] Duration is less than three minutes.
- [ ] Video is public on YouTube and the URL opens logged out.
- [ ] Voiceover explains the project, Codex use, and GPT-5.6 use.
- [ ] Loading, typing, silence, and irrelevant setup are removed.
- [ ] No private key, token, account detail, or unrelated notification is visible.
- [ ] The recorded behavior and repository both match the deployed commit.

## No-submit conditions

Do not submit while:

- the executable path and public claims disagree;
- browser close, process exit, silence, or incomplete evidence is presented as death;
- `1-of-1` or one-browser logical quorum is presented as ownerless distribution;
- the judge cannot test the project without rebuilding;
- repository, deployment, video, and story use different behavior or commits;
- the video, `/feedback` Session ID, or required fields are missing;
- the primary Sites URL/provenance/R1 evidence does not pass its minimum release
  gate; or
- any secret or private custodian material appears in a public artifact.

## Claim discipline

Prefer: `portable lifecycle and evidence kernel`, `logical 2-of-3`, `one physical
failure domain`, `signed succession`, `qualified death under explicit assumptions`,
and `browser Lab for inspection and falsification`.

Do not claim a completed OS, zero infrastructure, guaranteed erasure, global death,
independent-host resilience, Byzantine/Sybil safety, mutable state, ownerless
computation, or ownerless LLM inference before the corresponding gate exists.
