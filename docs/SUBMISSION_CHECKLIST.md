# Build Week Submission Checklist

Status: **active; project page published, hackathon submission not yet submitted**

Last synchronized with Devpost: **2026-07-16**

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
| Working project | H3A works; H3B contract merged; public deploy blocked | exact-head CI and logged-out public Chromium run |
| Category | Selected in plan | Devpost field `Developer Tools` |
| Project description | Saved; final URL pending | final story matches deployed behavior |
| Demo video | Missing | public YouTube, under three minutes, narrated |
| Code repository | Available | public repo, Apache-2.0, final README |
| README/setup/sample/run guidance | Implemented; public URL pending | clean-room instructions and judge path |
| Codex and GPT-5.6 usage | Repository/story saved; video pending | concrete README/story/video examples |
| `/feedback` Session ID | Missing | required Devpost custom field |
| Dev-tool installation/platform/testing path | Documented; public URL pending | browser URL plus local Node 22.5+ fallback |

The Devpost form does not globally require a website, but the Developer Tools rules
require a no-rebuild test path. For this project, the public Cloudflare Lab is the
primary path; local `npm ci && npm run dev:lab` is the fallback, not the submission
definition of done.

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
- [ ] Final secret scan finds no API token, private key, credential, or restricted
  artifact in source, history delta, logs, screenshots, bundle, or video.

## Public Lab release gate

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

Runtime GPT is not required. The repository and video must instead show how Codex
with GPT-5.6 materially accelerated construction:

- [x] operational definitions of birth, identity, succession, qualified death, and
  resurrection rejection;
- [x] adversarial P0 review of evidence completeness, hostile observation, equivocation,
  and resource ceilings;
- [x] deterministic conformance/property/browser test generation and interpretation;
- [x] Cloudflare exact-artifact and security-header deployment contract; and
- [x] deadline-driven separation of submission surface from R1/R2 research.

Human decisions must remain visible: North Star, scope, threat assumptions, claim
limits, Apache-2.0, product category, and final submission wording.

## Minimum judge path

1. Open the public Lab and read the `3 logical custodians / 1 physical failure domain`
   warning.
2. Create a live organism; show one key rejected and two keys accepted.
3. Run the fixed reference succession path with stable identity.
4. Show replay, signed fork, qualified death, and resurrection rejection.
5. Run the committed corpus and export/replay canonical public evidence.
6. Point to the exact deployed SHA and explain browser-first, endpoint-neutral design.

The CLI singleton is supporting evidence only. It does not replace the visual path.

## Devpost form gate

- [ ] Submitter type completed.
- [ ] Country of residence completed.
- [ ] Category set to `Developer Tools`.
- [x] Repository URL entered.
- [ ] Public Lab URL and judge instructions entered.
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
- the Cloudflare URL has not passed exact-SHA remote verification; or
- any secret or private custodian material appears in a public artifact.

## Claim discipline

Prefer: `portable lifecycle and evidence kernel`, `logical 2-of-3`, `one physical
failure domain`, `signed succession`, `qualified death under explicit assumptions`,
and `browser Lab for inspection and falsification`.

Do not claim a completed OS, zero infrastructure, guaranteed erasure, global death,
independent-host resilience, Byzantine/Sybil safety, mutable state, ownerless
computation, or ownerless LLM inference before the corresponding gate exists.
