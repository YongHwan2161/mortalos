# Build Week release evidence

Last synchronized: **2026-07-19 KST**

This file is the current external-release record. Historical failures, superseded
video scripts, and pre-submission checklists remain available in Git history. A claim
is `PASS` only when its local, GitHub, public deployment, or Devpost readback exists.

## Current scoreboard

| Surface | State | Current evidence |
| --- | --- | --- |
| Protocol and Lab | PASS | P0/H3A/H3B, GPT guided path, R1-A/R1-B, fixed portable/property/browser gates are merged. |
| Reviewed source | PASS | `main` `03e868ccd810064e81275a7ac2d71b543030b916`, PR #18, post-merge Verify `29632638423`. |
| Public Pages release | PASS | Deploy run `29632638421`; exact source manifest, six assets, MIME, headers, API, and three clean Chromium contexts passed. |
| Canonical domain | HOLD | `mortal-os.com` is Active with SSL and exact static bytes, but a valid scenario POST returns a Cloudflare HKG plaintext 502; `pages.dev` remains the judge URL. |
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
- Accepted `main`: `03e868ccd810064e81275a7ac2d71b543030b916`
- Evidence PR: <https://github.com/YongHwan2161/mortalos/pull/18>
- Exact-head Verify: `29631936378/1`
- Final-body trusted-base policy: `29632195368/1`
- Post-merge Verify: <https://github.com/YongHwan2161/mortalos/actions/runs/29632638423>
- Post-merge deploy: <https://github.com/YongHwan2161/mortalos/actions/runs/29632638421>
- Accepted aggregate asset digest:
  `sha256:VW018QRVpiK50L0YHwTPG0p5PP7dILdiay2Ia9aFc98`
- Accepted source changed documentation only after runtime PR #17, so the deployed
  asset digest stayed constant while `asset-manifest.json.source_commit` advanced.

The current verified fallback host is
<https://mortalos-lab-yonghwan2161.pages.dev/>. The canonical judge host becomes
<https://mortal-os.com/> only after DNS, TLS, manifest, API, and Chromium readback all
pass. The separate Sites evidence Lab remains incident recovery only and is not proof
of the Pages Function or exact release assets.

Current domain evidence: dashboard status `Active`, SSL enabled, HTTPS root `200`,
and `asset-manifest.json` exact source/digest equality all pass. Invalid API requests
return the expected JSON errors, but a schema-valid request reaches HKG and returns
platform plaintext `502` before the application response. Smart Placement plus a
fresh production deployment did not clear the fault. The reviewed remediation
candidate uses explicit targeted placement in `aws:us-east-1`; no promotion occurs
until that exact-main deployment passes the full remote gate.

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

## Current candidate local and browser evidence

The targeted-placement/documentation candidate passed:

- `npm test`: complete ordered repository contract in **1,397.4 seconds** on Windows;
- conformance: **76** cases;
- fixed property corpus: **10,000** cases, seed `1297044052`;
- serialized adversarial rejections: **10,000**;
- Lab/API unit cases: **17**;
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
- Wrangler 4.111.0 compiled the targeted Pages Functions bundle successfully;
- package dry-run: **101** files; and
- high-confidence secret scan: zero matches.

The accepted release also passed its Windows `core.autocrlf=true` clean-clone and
public API happy/error/rate-limit plus three-context judge flow. Those old public
runs do not cover this candidate; its exact-head CI and post-merge deployment remain
mandatory.

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

The public project description and answers 27949/27951 were refreshed on 2026-07-19
with the 90-second zero-install path, 17 Lab/API cases, PR #17/#18 evidence, supported
platforms, and local commands. The readback remained `Submitted` with the original
non-null `submitted_at`. After the custom domain passes, those fields are updated once
more to prefer `https://mortal-os.com/`; resubmission updates the existing entry rather
than creating a second project.

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

Use the fallback Pages hostname in these commands until the canonical-domain status
is `Active` and the full remote gate passes.

## Rollback and HOLD rule

Preserve the last logged-out-verified production deployment while a fault is
investigated. Revert faulty source through a focused reviewed PR and deploy the new
exact `main`; never patch production bytes or relabel an older manifest.

Place release promotion on `HOLD` if any of the following is absent: independent
immutable review, exact-head/full-suite success, post-merge deploy, public manifest
source equality, asset/MIME/header/API/Chromium acceptance, public video, exact
Session ID, required Devpost field readback, or non-null `submitted_at`.
