# Durable memory

Last reconciled: 2026-07-19 KST

Branch: `agent/codex-protocol-kernel--custom-origin-bridge`

Current base: `f23a4d501f89a4798d6d2a490000117774c69457`

## Verified merged state

- MortalOS is a portable lifecycle/evidence kernel plus exact-source Cloudflare
  Pages falsification Lab, not yet an OS, participant network, state-bearing digital
  life, or ownerless model runtime.
- P0/H3A/H3B, the bounded GPT-5.6 witness, the four-action judge path, and R1-A/R1-B
  are merged. R1-C remains the next protocol implementation layer.
- Accepted `main` is `f23a4d501f89a4798d6d2a490000117774c69457` through PR #19.
  Post-merge Verify `29655465238` and deploy `29655465232` passed with aggregate
  asset digest `sha256:VW018QRVpiK50L0YHwTPG0p5PP7dILdiay2Ia9aFc98`.
- The verified zero-install judge URL is
  `https://mortalos-lab-yonghwan2161.pages.dev/`.
- Devpost submission `1080076` is `Submitted`; its non-null submission time is
  `2026-07-18T10:25:36.990-04:00`. The public narrated video is
  `https://youtu.be/kR-TPuwoNaI` and the required Session ID is
  `019f6b83-d606-70b0-a712-20c22deaac63`.
- The entrant is an `Individual` in `Korea Republic of`. Official live requirements
  do not impose a three-developer or three-tester gate.

## Current custom-domain boundary

- `mortal-os.com` is registered, attached to the Pages project, `Active`, SSL-enabled,
  and serves the exact accepted static manifest and assets.
- A schema-valid `POST /api/scenarios` reaches HKG and returns Cloudflare plaintext
  `502`; invalid requests still return the expected application JSON. The custom
  domain is therefore not yet an accepted judge path.
- Smart and targeted placement plus fresh production deployments did not clear the
  fault. The current candidate routes only the exact `mortal-os.com` page origin to
  the accepted `pages.dev` API origin and permits only that pair through CSP and
  bounded CORS/preflight; every other origin remains fail-closed.
- Candidate-local evidence is full-suite PASS: Lab/API 19/19, three-context Chromium,
  governance 30/30, conformance 76/76, property 10,000, R1, portable 10,000/10,000,
  coverage, audit, package, link, diff, and secret gates. Public evidence is pending.
- Do not promote the custom hostname in README, Devpost, or the deploy verifier until
  its exact-source, valid API, and three clean Chromium contexts all pass.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. Silence, process exit, key loss, and browser closure are not global death.
3. Logical key count and independent failure-domain count are different claims.
4. UI, transport, storage, hosting, and model output may carry evidence but never
   decide validity.
5. Every source SHA needs its own immutable review, full Verify, exact-main deploy,
   and public readback; an old green run does not cover a new SHA.
6. Protocol order is independent-verifier registration → R1-A JavaScript wire/golden
   → R1-B Python differential → R1-C consumers → R2 deterministic state → R3
   availability → R4 network embodiment.
7. `reviewer-merge-gate`, not the author, decides whether a PR may merge.

## Current priorities

1. Merge and deploy the exact-origin bridge candidate only after full
   local, exact-head, and immutable-review gates.
2. Re-run the complete custom-domain API and Chromium acceptance; promote only on
   PASS, otherwise keep `pages.dev` through the deadline.
3. Freeze submission-facing changes by 2026-07-21 18:00 KST.
4. Attempt one bounded R1-C vertical slice only if it cannot endanger the accepted
   release. R2 and networking remain conditional/post-submission work.

## Memory maintenance

- Store only verified merged facts or explicitly labeled candidate evidence.
- Replace stale current-state statements; leave historical detail in `WORKLOG.md` and
  Git history.
- Never store credentials, personal data beyond submission-required public facts,
  generated dependencies, disposable logs, or hidden reasoning.
