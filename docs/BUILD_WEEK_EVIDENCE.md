# Build Week release evidence

Last synchronized: **2026-07-19 KST**

This file is the current external-release record. Historical failures, superseded
video scripts, and pre-submission checklists remain available in Git history. A claim
is `PASS` only when its local, GitHub, public deployment, or Devpost readback exists.

## Current scoreboard

| Surface | State | Current evidence |
| --- | --- | --- |
| Protocol and Lab | PASS | P0/H3A/H3B, GPT guided path, R1-A/R1-B, fixed portable/property/browser gates are merged. |
| Reviewed source | PASS | Runtime baseline `main` `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`, PR #21, post-merge Verify `29660983347`. |
| Public Pages release | PASS | Deploy run `29660983299`; exact source manifest, six assets, MIME, headers, API, and three clean Chromium contexts passed. |
| Canonical domain | PASS | `mortal-os.com` is Active with SSL; exact source/assets, no-transform/CSP, preflight, valid GPT POST, 25 scenarios, and three clean Chromium contexts passed. |
| GPT-5.6 evaluation | PASS | 25/25 schema/API and intended mutation; 10/10 mutation coverage; 25/25 kernel/offline replay; 0/25 exact model verdict agreement. |
| Public video | PASS | <https://youtu.be/kR-TPuwoNaI>, public, narrated, below three minutes, attached to Devpost. |
| Devpost | PASS | Submission `1080076`, state `Submitted`, `submitted_at` `2026-07-18T10:25:36.990-04:00`. |
| `/feedback` | PASS | Session ID `019f6b83-d606-70b0-a712-20c22deaac63` saved in required field 27950. |
| Entrant | PASS | `Individual`, `Korea Republic of`; official live rules report `team_required: false`. |

The hackathon does not require three developers or three first-time testers. Those
items were an internal clean-room idea, not a submission rule, and are not a release
gate. Browser automation, protocol conformance, exact-source deployment, logged-out
judge access, and truthful claim boundaries remain mandatory.

## Accepted source and deployment

- Repository: <https://github.com/YongHwan2161/mortalos>
- Accepted runtime `main`: `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`
- CSP-preservation PR: <https://github.com/YongHwan2161/mortalos/pull/21>
- Exact-head Verify: `29660657159/1`
- Final-body trusted-base policy: `29660690604/1`
- Post-merge Verify: <https://github.com/YongHwan2161/mortalos/actions/runs/29660983347>
- Post-merge deploy: <https://github.com/YongHwan2161/mortalos/actions/runs/29660983299>
- Accepted aggregate asset digest:
  `sha256:HYNcJotcdxxFCItMhI7_RP6_3oqpwTFsqcbS83xMD3A`
- PR #20 supplied the exact-origin bridge; PR #21 added `no-transform` so the
  Cloudflare edge cannot inject an analytics script that violates the self-only CSP.

The canonical judge host is <https://mortal-os.com/>. The exact-source
<https://mortalos-lab-yonghwan2161.pages.dev/> hostname is an incident fallback.
The separate Sites evidence Lab remains recovery only and is not proof of the Pages
Function or exact release assets.

Current domain evidence: dashboard `Active`, SSL, HTTPS root `200`, exact manifest,
six file digests, MIME, strict CSP/COEP, and `Cache-Control: no-store, no-transform`
all pass. Direct custom-host inference previously reached HKG and returned platform
plaintext `502`; Smart and targeted placement did not clear it. The accepted bridge
therefore keeps the Pages API as the only inference endpoint and, only for the exact
`mortal-os.com` page origin, permits that origin through bounded CSP/CORS/preflight.
The public preflight returned `204`, a valid request returned `200` with
`gpt-5.6-sol`, the fixed 25-call evaluation passed, and three clean custom-host
Chromium contexts passed without injected analytics, console errors, or unexpected
external requests.

## Trusted runtime boundary

`POST /api/scenarios` accepts only the documented bounded request. GPT-5.6 may select
one of ten versioned adversarial mutations and return a display rationale. A
deterministic compiler discards free-form text, emits canonical
`mortalos-compiled-scenario/1` bytes, and the existing kernel produces the only
authoritative result. `Replay without GPT` reproduces the digest and verdict without
a second model call.

The production route uses `store: false`, a 15-second fail-closed timeout, strict
Structured Outputs, bounded body/output, a server-side OpenAI key, an HMAC-derived
privacy-preserving safety identifier, and a separate HMAC actor key for D1 rate
limiting. Missing/failed/malformed D1 state fails closed before inference. Static Lab
requests do not invoke the model route.

Fixed live evaluation:

- response model readback: `gpt-5.6-sol`;
- API/schema handling: **25/25**;
- intended mutation: **25/25**;
- allowlist coverage: **10/10**;
- kernel result and GPT-off replay: **25/25**;
- private sentinel reflection: **0**; and
- model exact status/rejection-code agreement with the kernel: **0/25**.

The last result is evidence, not a defect: GPT-5.6 is useful as an adversarial witness
and unsafe as a consensus oracle.

## Current accepted local and browser evidence

The exact-origin bridge and CSP-preservation releases pass:

- PR #21 `npm test`: complete ordered repository contract in **1,152.1 seconds** on Windows;
- conformance: **76** cases;
- fixed property corpus: **10,000** cases, seed `1297044052`;
- serialized adversarial rejections: **10,000**;
- Lab/API unit cases: **19**;
- trusted-core coverage: **96.00%** line, **92.64%** branch, **95.22%** function;
- governance: **30/30**, with **92.68%** line, **84.39%** branch, and
  **93.75%** function coverage;
- dependency audit: zero vulnerabilities;
- R1: eight byte-identical JavaScript/Python records;
- actual Chromium 149: committed/browser results byte-identical and
  **10,000/10,000** serialized adversarial cases rejected;
- local Lab Chromium: three clean contexts, 360/768/1440 widths, all logical two-key
  pairs, keyboard-only controls, accessibility/status/focus checks, exact corpus
  replay;
- exact-pair endpoint, CORS/preflight, attacker-origin, and CSP regressions;
- Wrangler 4.111.0 compiled the Pages Functions bundle successfully;
- package dry-run: **102** files; and
- high-confidence secret scan: zero matches.

The accepted release also passed its Windows `core.autocrlf=true` clean-clone,
exact-head Verify, public API happy/error/rate-limit path, fixed 25-call evaluation,
and three-context custom-host judge flow.

Every new source SHA must rerun its own gates. An old green run does not cover a new
SHA.

## Devpost readback

Live requirements refreshed **2026-07-19 KST**:

- one working project in one of four categories;
- public `< 3 minute` YouTube video with audio covering the project, Codex, and
  GPT-5.6;
- repository URL with license, README, setup/test guidance, and concrete Codex/GPT
  contribution evidence;
- required `/feedback` Session ID; and
- installation/platform/testing instructions for a developer tool.

Current project:

- public page: <https://devpost.com/software/mortalos>;
- category: `Developer Tools`;
- submitter: `Individual`;
- country: `Korea Republic of`;
- video: <https://youtu.be/kR-TPuwoNaI>;
- submission ID: `1080076`;
- status: `Submitted`;
- `submitted_at`: `2026-07-18T10:25:36.990-04:00`; and
- required Session ID: exact match to the user-provided value above.

The public project story, Try-it-out links, and answers 27949/27951 were refreshed on
2026-07-19 with `https://mortal-os.com/` first, the 90-second zero-install path, 19
Lab/API cases, PR #20/#21 and run evidence, supported platforms, and local/remote
commands. Public readback shows the custom URL and updated validation paragraph. The
entry remains `Submitted` with the original non-null `submitted_at`; no second project
was created.

## Current release commands

```bash
npm ci
npm test
npm run test:coverage
npm run test:chromium
npm run verify:lab
npm audit --audit-level=high
npm pack --dry-run
```

Remote exact-source acceptance:

```bash
MORTALOS_LAB_URL=https://mortal-os.com \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:deployed-lab

MORTALOS_LAB_URL=https://mortal-os.com \
npm run verify:gpt-scenarios
```

Use the Pages hostname only as the recorded incident fallback. Canonical release
verification targets `mortal-os.com`.

## Rollback and HOLD rule

Preserve the last logged-out-verified production deployment while a fault is
investigated. Revert faulty source through a focused reviewed PR and deploy the new
exact `main`; never patch production bytes or relabel an older manifest.

Place release promotion on `HOLD` if any of the following is absent: independent
immutable review, exact-head/full-suite success, post-merge deploy, public manifest
source equality, asset/MIME/header/API/Chromium acceptance, public video, exact
Session ID, required Devpost field readback, or non-null `submitted_at`.
