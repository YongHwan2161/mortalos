# MortalOS Project Status

As of: **2026-07-17 KST**

Stage: **P0/H3A/H3B/R1 merged; public Sites judge path live; direct H3B deployment credential-blocked**

Security baseline: **every published or deployed SHA requires immutable-head review and its own successful verification**

## 1. Executive assessment

MortalOS is a portable lifecycle and evidence kernel plus a browser-based falsification
Lab. It is not yet an operating system, participant network, deterministic mutable
state machine, or ownerless model runtime.

Current `main` at audit time is
`1c3e7956b1386c4b6ff1edab2249ff0d6c5d21a7`. It contains P0, H3A, H3B, bounded
R1, and the post-R1 documentation reconciliation. The latest audited push Verify run
`29518934489` passed. Deploy
run `29518934440` failed before install or deployment because both required
Cloudflare repository secrets were empty; every deployment and public-verification
step was skipped.

The Build Week release candidate adds the repository-owned GPT-5.6 scenario route,
deterministic compiler, four-action judge path, Pages rate limiting, exact-secret
deployment plumbing, 25-case live evaluation, and narrated-video script. Its local
unit, live-model, and real-Chromium gates pass. It is not merged or deployed evidence
until independent immutable-head review, CI, and logged-out Pages verification pass.

PR #11 also has a governance incident: an attestation of unverifiable logical-agent
provenance was followed by merge before the assigned reviewer completed the required
immediate re-fetch and expected-head merge call. The assigned reviewer later passed
an independent full test/diff review, but explicitly recorded that it does not
retroactively satisfy the merge gate. This affects process evidence, not the green
post-merge technical Verify result.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
| --- | --- | --- |
| Apache-2.0 licensing | Verified on `main` | Root license, package metadata, contribution terms, and third-party notices agree. |
| Portable Genesis/Pulse kernel | Verified on `main` | Canonical bounded input, strict Ed25519, stable first-error validation, quorum activation, and endpoint-neutral `Uint8Array` processing. |
| Lineage and mortality P0 | Merged; each new head must rerun | Replay/fork halt, exact-body latent evidence, sign-once commitments, explicit irreversibility and completeness, fail-closed observer acquisition, and seven whole-operation limits. |
| Node/browser agreement | Required per review head | Committed, Node, isolated browser target, and actual Chromium results must be byte-identical; an old green run does not cover a new SHA. |
| CLI bootstrap proof | Verified proof only | Ephemeral `1-of-1` birth/heartbeat and handoff proof. No stable import/persistence/replay/export CLI contract. |
| H3A MortalOS Lab | Implemented | Three non-extractable Worker keys, logical `2-of-3`, reference turnover, replay/fork, qualified mortality, resurrection rejection, clone, full corpus, and public evidence export/replay. One browser remains one physical failure domain. |
| H3B deployment contract | Merged on `main`; post-merge Verify passed | Deterministic asset manifest, exact source SHA, Cloudflare headers, pinned Actions, idempotent Pages project discovery, remote asset verifier, and remote Chromium path. |
| Public Sites judge path | Live; source provenance pending | Logged-out HTTP 200, public-result GPT witness HTTP 200, and injected private field HTTP 422. Both displayed hashes/outcomes match merged R1. Sites version 2 has immutable source/archive metadata, but its source is not in this repository. |
| Direct H3B Cloudflare Pages release | Credential-blocked; not deployed | Deploy `29513454211/1` found both Cloudflare secrets empty. The exact asset/header/Chromium path remains optional submission hardening while Sites stays healthy. |
| Language-neutral wire and independent verifier | Merged through PR #12 | Eight bounded Genesis/replay/mortality operations with JS/Python byte equality. Exact-head Verify and logical reviewer checks passed. Python covers the committed corpus profile, not arbitrary pending/fork/resource-limit inputs. |
| Mutable logical state/genome | Not implemented on `main` | An older local R2 prototype is not merge evidence because it predates current P0 and R1. |
| Participant network/replication | Not implemented | No WebRTC/libp2p transport, distributed custody evidence, state availability protocol, or independent-host survival. |
| Runtime GPT witness | Live on Sites; repository source/provenance pending | Tested structured explanation of a public R1 result; private-field injection rejected before inference. GPT cannot sign, validate, choose a head, or classify death. |
| GPT adversarial scenario release candidate | Implemented and locally verified; review/deploy pending | Ten allowlisted mutations, strict Responses API schema, canonical compilation, existing-kernel verdict, GPT-off replay, 25/25 target selection, and 0/25 exact model verdict predictions. |

## 3. H3B merged contract and release state

The deployment contract adds no consensus or validity logic. A clean build emits
`mortalos.lab-assets/1`, containing sorted asset paths, media types, SHA-256 digests,
an aggregate digest, and one exact source commit. Cloudflare `_headers` mirrors the
local server contract. The remote verifier rejects wrong protocol/path, source SHA,
root bytes, manifest bytes, asset bytes, MIME type, or security header.

The GitHub workflow:

1. checks out the exact reviewed `main` SHA with persisted credentials disabled;
2. requires a clean main ref and Cloudflare credentials scoped only to credential
   check and deployment steps;
3. runs the full locked test suite;
4. creates the Pages project if absent and deploys exact static bytes; and
5. runs the complete Lab acceptance suite against the public HTTPS origin.

No public URL is considered valid merely because a deploy command returned success.
The first run did not reach the deploy command at all.

## 4. Build Week status

Live Devpost state observed at `2026-07-16T16:25:23Z`:

- event phase: submissions open;
- hard deadline: `2026-07-22T00:00:00Z` = **2026-07-22 09:00 KST**;
- project: `MortalOS`; its public project page is published, but it has not been
  submitted to the hackathon (`submitted_at` is empty);
- project description, R1/GPT-5.6 story, repository link, and public Sites test URL:
  saved;
- video URL: missing; and
- hackathon submission timestamp: missing.

The exact deadline remains unchanged. Submission-critical blockers, in order:

1. merge this truthful post-R1 status correction without restoring PR #12's stale H3B
   review/deployment checklist claims;
2. commit or reproducibly link the deployed Sites source and add a repeatable public
   smoke/provenance verifier; both displayed operation hashes already match merged R1;
3. publish exact judge instructions covering the A/B result, GPT non-authority, and
   local verifier;
4. record and upload the public sub-three-minute narrated video;
5. add the `/feedback` Codex Session ID plus submitter, country, category, repository,
   test, and dev-tool instruction fields; and
6. perform a logged-out final run and submit the already-published project page.

Cloudflare Pages is not a Devpost deliverable: the form reports
`website_required: false`. Developer Tools still need a no-rebuild test path, and the
live public Sites Lab now supplies it. Direct Pages deployment remains valuable
exact-commit evidence, but missing Cloudflare account credentials no longer blocks
submission while the Sites path and its provenance gates pass.

## 5. Claim boundaries

Supported descriptions:

- endpoint-neutral lifecycle and evidence kernel;
- creator-controlled `1-of-1` bootstrap;
- logical `2-of-3` browser incubation in one physical failure domain;
- signed succession and complete original-custodian turnover;
- deterministic replay/fork/resurrection rejection;
- death only under explicit irreversible-loss and complete-evidence assumptions;
- a public Sites Lab for contrasting incomplete and complete mortality evidence; and
- GPT-5.6 as an untrusted explanatory witness over public deterministic output.

Unsupported descriptions:

- a completed network OS or running distributed world;
- globally proven erasure or death from network silence;
- independent-host resilience from one browser;
- Byzantine/Sybil resistance, mutable state, state availability, shared computation,
  or ownerless LLM inference; and
- GPT-5.6 as a validator, signer, lineage judge, death oracle, or protocol authority.

## 6. Fundamental next work

The bounded R1-A/R1-B profile is now merged because Devpost and the public Sites Lab
already describe it. The protocol lane remains:

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

R1 is more fundamental than R2 because current JavaScript mortality observation
still trusts an honest Proxy-free adapter container. PR #12 begins replacing that
boundary with canonical versioned bytes and a narrow independent verifier, but R1-C
and general adversarial coverage remain before the boundary is fully replaced. R2
can then make state transitions reproducible without inheriting ambiguity.

North Star: authenticated evidence plus participating resources—not a browser,
server, CLI, transport, model, host, or administrator—must determine identity,
succession authority, state, and qualified death while original hosts are replaceable.
