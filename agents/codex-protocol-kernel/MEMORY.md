# Durable memory

Last reconciled: 2026-07-17 KST

Branch: `agent/codex-protocol-kernel--submission-reconcile`

Current base: `6c5b85fd8e467feb4df63556864ea5f8949e7b61`

## Verified merged state

- PR #10 is merged at current `main`; P0 mortality observation now requires explicit
  irreversible authority loss and complete evidence, owns hostile bytes, checks
  runtime/dependency integrity, and bounds every recognized observation resource.
- MortalOS remains a portable lifecycle/evidence kernel plus H3A Lab, not an OS,
  participant network, state-bearing entity, or ownerless model runtime.
- H3A uses three non-extractable/sign-once Worker keys for a logical `2-of-3` quorum
  in one physical failure domain. Browser closure is local authority loss, not global
  death.
- Every new review/deployment SHA needs its own Node/browser-target/actual-Chromium,
  Lab, coverage, audit, package, and governance evidence.
- JavaScript cannot prove a mortality observer container is not a transparent Proxy.
  R1 must replace that operation boundary with bounded versioned bytes and an
  independently authored non-JavaScript verifier.

## Submission-sprint merged state

- PR #11 merged H3B at `294b741bc89c72ee4ae4f3aea27a21515d0d1469`:
  a deterministic static asset manifest, exact source commit, Cloudflare
  `_headers`, pinned GitHub Actions, Pages deployment, remote asset/header verifier,
  and remote Chromium judge-path mode without changing trusted `src/` semantics.
- A public URL is not complete until the reviewed main SHA deploys and passes the
  exact remote verifier. Local Wrangler has no authenticated Cloudflare account or
  token. The unauthenticated temporary-account path was not used because it requires
  accepting Cloudflare terms and does not provide the durable submission URL needed.
- Push Verify `29513454019/1` passed. Deploy `29513454211/1` stopped at credential
  preflight because both Cloudflare repository secrets were empty; deployment and
  remote verification were skipped, so no public H3B claim is valid yet.
- PR #11 merged after an attestation of unverifiable logical-agent provenance and
  before the assigned reviewer completed the mandatory immediate re-fetch/expected-
  head merge decision. Later independent tests passed but do not retroactively close
  that governance gate; incident comment `4994066948` records the boundary.
- Wrangler 4.111.0 `pages project list --json` exposes the project identifier as
  `"Project Name"`, not `name`. Deployment discovery must validate that pinned
  schema and remain idempotent for an already-existing project.
- The older H3B/R2 local prototype at `29eb34f9def495f15a6e51e85a7556179b5b43ac`
  is based on pre-P0 main. Its R2 code is research input only and must not be merged
  ahead of current P0 or R1.
- PR #12 merged bounded R1-A/R1-B at
  `6c5b85fd8e467feb4df63556864ea5f8949e7b61`: eight canonical
  Genesis/replay/mortality operations, exact oversized-input rejection, and
  JavaScript/Python corpus-profile equality. Python is not a general verifier for
  arbitrary pending/fork/resource-limit inputs; full H3A consumption remains R1-C.

## Build Week facts

- Submissions close `2026-07-22T00:00:00Z`, equal to 2026-07-22 09:00 KST.
- MortalOS has a published Devpost project page with its repository and public Sites
  URL, but it is not submitted to the hackathon and still lacks the video.
- Required deliverables include working project, category, description, public
  narrated YouTube video under three minutes, code repository/README/license,
  concrete Codex and GPT-5.6 usage, and `/feedback` Session ID.
- A website is not globally required, but Developer Tools need a no-rebuild test
  path. The public Sites Lab is live and returned HTTP 200; its GPT witness returned
  200 on a public R1 result and private-field injection returned 422.
- Sites version 2 has immutable source/archive metadata, but that source commit is not
  in the MortalOS repository. Both displayed hashes/outcomes match merged R1; the
  final repository must still contain or reproducibly link deployed source and a
  repeatable public smoke/provenance verifier.
- Runtime GPT integration is not required by the event wording. The deployed witness
  exists but never decides validity.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. Silence, process exit, and browser closure are not protocol death.
3. Logical key count and independent failure-domain count are different claims.
4. UI, transport, storage, deployment, and model output may carry evidence but never
   decide validity.
5. Sites may carry a submission preview, but its source and results must bind to a
   reviewed repository snapshot before freeze.
6. Protocol order is independent-verifier registration → R1-A JavaScript
   wire/golden → R1-B Python differential → R1-C consumers → R2 deterministic state
   → availability → network embodiment.
7. `reviewer-merge-gate`, not the author, decides whether a PR may merge.

## Current priorities

1. Merge the truthful post-R1 status correction without preserving stale H3B
   governance/deployment claims from PR #12.
2. Bind the public Sites version/source and two displayed results to merged R1
   repository SHA, then finalize judge instructions.
3. Complete the video, `/feedback`, custom fields, final rehearsal, and submission by
   the internal 2026-07-22 07:00 KST target.
4. Treat direct Cloudflare Pages as optional hardening; do not let credentials displace
   the submission-critical path. Do not start R2 or networking before submission.

## Memory maintenance

- Store only verified merged facts or explicitly labeled candidate evidence.
- Replace stale current-state statements; leave historical detail in `WORKLOG.md` and
  Git history.
- Never store credentials, personal data, generated dependencies, disposable logs,
  or hidden reasoning.
