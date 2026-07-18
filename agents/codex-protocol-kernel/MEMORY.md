# Durable memory

Last reconciled: 2026-07-19 KST

Branch: `agent/codex-protocol-kernel--canonical-domain`

Current base: `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`

## Verified merged state

- MortalOS is a portable lifecycle/evidence kernel plus exact-source Cloudflare
  Pages falsification Lab, not yet an OS, participant network, state-bearing digital
  life, or ownerless model runtime.
- P0/H3A/H3B, the bounded GPT-5.6 witness, the four-action judge path, and R1-A/R1-B
  are merged. R1-C remains the next protocol implementation layer.
- Accepted runtime `main` is `61cdd01865d7382066fec04d5dc1be7b1a68c8ae`
  through PR #21. Post-merge Verify `29660983347` and deploy `29660983299` passed
  with aggregate asset digest
  `sha256:HYNcJotcdxxFCItMhI7_RP6_3oqpwTFsqcbS83xMD3A`.
- The verified zero-install canonical judge URL is `https://mortal-os.com/`.
- Devpost submission `1080076` is `Submitted`; its non-null submission time is
  `2026-07-18T10:25:36.990-04:00`. The public narrated video is
  `https://youtu.be/kR-TPuwoNaI` and the required Session ID is
  `019f6b83-d606-70b0-a712-20c22deaac63`.
- The entrant is an `Individual` in `Korea Republic of`. Official live requirements
  do not impose a three-developer or three-tester gate.

## Current canonical-domain boundary

- `mortal-os.com` is registered, attached to the Pages project, `Active`, SSL-enabled,
  and serves exact accepted static bytes with `no-store, no-transform`, strict CSP,
  six valid asset digests, and no injected analytics beacon.
- Direct custom-host inference previously reached HKG and returned Cloudflare
  plaintext `502`; Smart and targeted placement did not clear it. PR #20 routes only
  the exact `mortal-os.com` page origin to the accepted `pages.dev` API and permits
  only that pair through bounded CSP/CORS/preflight. Every other origin fails closed.
- Public acceptance passed: preflight `204`, valid GPT POST `200` with `gpt-5.6-sol`,
  fixed 25/25 scenario/kernel/offline replay, exact manifest/six assets, and three
  clean custom-host Chromium contexts.
- Devpost public story, Try-it-out link, judge instructions, and installation answer
  prefer `mortal-os.com`; status remains `Submitted`. `pages.dev` is incident fallback.

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

1. Merge the canonical-domain documentation/workflow reconciliation only after
   exact-head and immutable-review gates, then verify exact-main custom deployment.
2. Freeze submission-facing changes by 2026-07-21 18:00 KST.
3. Attempt one bounded R1-C vertical slice only if it cannot endanger the accepted
   release. R2 and networking remain conditional/post-submission work.

## Memory maintenance

- Store only verified merged facts or explicitly labeled candidate evidence.
- Replace stale current-state statements; leave historical detail in `WORKLOG.md` and
  Git history.
- Never store credentials, personal data beyond submission-required public facts,
  generated dependencies, disposable logs, or hidden reasoning.
