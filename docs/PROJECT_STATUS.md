# MortalOS Project Status

As of: **2026-07-16**

Stage: **P0 merged on `main`; H3A local Lab implemented; H3B deployment candidate in review**

Security baseline: **every published or deployed SHA requires immutable-head review and its own successful verification**

## 1. Executive assessment

MortalOS is a portable lifecycle and evidence kernel plus a browser-based falsification
Lab. It is not yet an operating system, participant network, deterministic mutable
state machine, or ownerless model runtime.

Current `main` at audit time is
`d50c8f41ec648c757cb26b170340c467f792b770`. It contains the merged P0 mortality
correction and H3A Lab. The submission-sprint branch adds a Cloudflare Pages build,
deployment, exact-asset/header verifier, and remote Chromium path without changing
trusted `src/` protocol semantics. Those changes are candidate evidence until their
own PR and checks pass.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
| --- | --- | --- |
| Apache-2.0 licensing | Verified on `main` | Root license, package metadata, contribution terms, and third-party notices agree. |
| Portable Genesis/Pulse kernel | Verified on `main` | Canonical bounded input, strict Ed25519, stable first-error validation, quorum activation, and endpoint-neutral `Uint8Array` processing. |
| Lineage and mortality P0 | Merged; each new head must rerun | Replay/fork halt, exact-body latent evidence, sign-once commitments, explicit irreversibility and completeness, fail-closed observer acquisition, and seven whole-operation limits. |
| Node/browser agreement | Required per review head | Committed, Node, isolated browser target, and actual Chromium results must be byte-identical; an old green run does not cover a new SHA. |
| CLI bootstrap proof | Verified proof only | Ephemeral `1-of-1` birth/heartbeat and handoff proof. No stable import/persistence/replay/export CLI contract. |
| H3A MortalOS Lab | Implemented | Three non-extractable Worker keys, logical `2-of-3`, reference turnover, replay/fork, qualified mortality, resurrection rejection, clone, full corpus, and public evidence export/replay. One browser remains one physical failure domain. |
| H3B deployment contract | Candidate in this branch | Deterministic asset manifest, exact source SHA, Cloudflare headers, pinned Actions, Pages deploy workflow, remote asset verifier, and remote Chromium path. |
| Public HTTPS Lab | Not yet verified | It becomes complete only after the reviewed `main` SHA is deployed and the public verifier plus logged-out Chromium gate pass. |
| Language-neutral wire and independent verifier | Not implemented | R1 remains the most fundamental post-submission trust-boundary improvement. |
| Mutable logical state/genome | Not implemented on `main` | An older local R2 prototype is not merge evidence because it predates current P0 and R1. |
| Participant network/replication | Not implemented | No WebRTC/libp2p transport, distributed custody evidence, state availability protocol, or independent-host survival. |
| Runtime GPT feature | Not implemented and not required for the current judge path | Build Week evidence concerns construction with Codex/GPT-5.6; model output is not validity authority. |

## 3. H3B candidate contract

The deployment candidate adds no consensus or validity logic. A clean build emits
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

## 4. Build Week status

Live Devpost state observed on 2026-07-16:

- event phase: submissions open;
- hard deadline: `2026-07-22T00:00:00Z` = **2026-07-22 09:00 KST**;
- project: `MortalOS`, state `submission_draft`;
- project description: empty;
- video URL: missing; and
- website/test URL: missing.

Submission-critical blockers, in order:

1. merge and verify the exact H3B candidate, then observe the public Cloudflare run;
2. document installation, platforms, shortest judge path, and concrete Codex/GPT-5.6
   construction evidence;
3. replace the overbroad draft tagline/story with the demonstrated Lab scope;
4. record and upload the public sub-three-minute narrated video;
5. add the `/feedback` Codex Session ID and all required custom fields; and
6. perform a logged-out final run and move the Devpost project out of draft.

Cloudflare hosting is not a universal Devpost deliverable: the form reports
`website_required: false`. For a Developer Tool, however, the rules require a way to
test without rebuilding. MortalOS Lab is browser-first, so a public static deployment
is the simplest and strongest compliant path.

## 5. Claim boundaries

Supported descriptions:

- endpoint-neutral lifecycle and evidence kernel;
- creator-controlled `1-of-1` bootstrap;
- logical `2-of-3` browser incubation in one physical failure domain;
- signed succession and complete original-custodian turnover;
- deterministic replay/fork/resurrection rejection;
- death only under explicit irreversible-loss and complete-evidence assumptions; and
- a browser Lab for inspecting and falsifying those claims.

Unsupported descriptions:

- a completed network OS or running distributed world;
- globally proven erasure or death from network silence;
- independent-host resilience from one browser;
- Byzantine/Sybil resistance, mutable state, state availability, shared computation,
  or ownerless LLM inference; and
- runtime GPT-5.6 behavior.

## 6. Fundamental next work

The submission lane publishes and explains what exists. The protocol lane remains:

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

R1 is more fundamental than R2 because current JavaScript mortality observation
still trusts an honest Proxy-free adapter container. R1 replaces that boundary with
canonical versioned bytes and an independently written verifier. R2 can then make
state transitions reproducible without inheriting an ambiguous operation boundary.

North Star: authenticated evidence plus participating resources—not a browser,
server, CLI, transport, model, host, or administrator—must determine identity,
succession authority, state, and qualified death while original hosts are replaceable.
