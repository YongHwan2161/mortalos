# Durable memory

Last reconciled: 2026-07-16

Branch: `agent/codex-protocol-kernel--submission-sprint`

Current base: `d50c8f41ec648c757cb26b170340c467f792b770`

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

## Submission-sprint candidate

- H3B adds a deterministic static asset manifest, exact source commit, Cloudflare
  `_headers`, pinned GitHub Actions, Pages deployment, remote asset/header verifier,
  and remote Chromium judge-path mode without changing trusted `src/` semantics.
- A public URL is not complete until the reviewed main SHA deploys and passes the
  exact remote verifier. Local Wrangler has no authenticated Cloudflare account or
  token. The unauthenticated temporary-account path was not used because it requires
  accepting Cloudflare terms and does not provide the durable submission URL needed.
- The permanent GitHub deployment workflow is designed to run automatically after
  merge using repository-scoped Cloudflare secrets if present.
- The older H3B/R2 local prototype at `29eb34f9def495f15a6e51e85a7556179b5b43ac`
  is based on pre-P0 main. Its R2 code is research input only and must not be merged
  ahead of current P0 or R1.

## Build Week facts

- Submissions close `2026-07-22T00:00:00Z`, equal to 2026-07-22 09:00 KST.
- MortalOS is currently a Devpost submission draft with no description, video, or
  public test URL.
- Required deliverables include working project, category, description, public
  narrated YouTube video under three minutes, code repository/README/license,
  concrete Codex and GPT-5.6 usage, and `/feedback` Session ID.
- A website is not globally required, but Developer Tools need a no-rebuild test
  path. A public static Lab is the chosen path.
- Runtime GPT integration is not required by the event wording; construction with
  Codex/GPT-5.6 must be explained and evidenced. Model output never decides validity.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. Silence, process exit, and browser closure are not protocol death.
3. Logical key count and independent failure-domain count are different claims.
4. UI, transport, storage, deployment, and model output may carry evidence but never
   decide validity.
5. Submission hosting may precede R1 only as a qualified exact-commit preview.
6. Post-submission order is independent-verifier registration → R1-A JavaScript
   wire/golden → R1-B Python differential → R1-C consumers → R2 deterministic state
   → availability → network embodiment.
7. `reviewer-merge-gate`, not the author, decides whether a PR may merge.

## Current priorities

1. Complete H3B tests, exact-head PR, independent review, CI, merge, and public run.
2. Close README/platform/judge-path and Codex/GPT-5.6 evidence gaps.
3. Finalize honest Devpost category, story, test instructions, video, and `/feedback`
   field before the internal 2026-07-22 07:00 KST submit target.
4. Resume R1 after submission; do not spend the sprint on R2 or networking.

## Memory maintenance

- Store only verified merged facts or explicitly labeled candidate evidence.
- Replace stale current-state statements; leave historical detail in `WORKLOG.md` and
  Git history.
- Never store credentials, personal data, generated dependencies, disposable logs,
  or hidden reasoning.
