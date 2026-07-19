# MortalOS North Star roadmap

Status: **S0–S10 locally implemented and verified; S11 documentation candidate in
progress; S12 review, merge, production relay/Pages deployment, and public readback
remain promotion gates**

Last synchronized: **2026-07-19 KST**

Submission deadline: **2026-07-22 09:00 KST**

Change freeze target: **2026-07-21 18:00 KST**

The detailed execution SSOT is
[the S0–S12 implementation plan](MULTI_BROWSER_DIGITAL_LIFE_UX_IMPLEMENTATION_PLAN.md).
This file intentionally stays short.

## North Star

> A digital resource preserves one authorized identity and deterministic state after
> its original host disappears, using only canonical evidence and participant-held
> keys—without making any browser, relay, cloud, UI, or model the authority.

Product sentence:

> **Create once. Continue elsewhere.**

The most important improvement was not another dashboard or AI feature. It was an
end-to-end scene in which Browser A creates one state-bearing organism, Browser B
creates its own non-extractable key, both authorize a custody handoff, A closes, and
B advances the same `organism_id` and state.

## Claim ladder

| Level | Current source evidence | Promotion rule |
| --- | --- | --- |
| L0 | Single-browser three-key logical quorum | Never describe as independent distribution. |
| L1 | Canonical evidence export/import and read-only replay | Import confers no signing authority. |
| L2 | Actual Chromium A→B succession and A-before-handoff stalled negative | Public claim only after exact production relay/Pages run. |
| L3 | All three complementary `2-of-3` loss pairs plus D repair, repeated in ten isolated Chromium runs | Browser profiles prove isolation, not three people or organizations. |
| L4 | Deterministic state/receipt bytes agree in JavaScript and independent Python; tamper and limits fail atomically | Not an arbitrary autonomous-agent runtime. |
| L5 | Mortality remains observer-relative and explicitly bounded | Never claim globally complete death. |

## Current priority order

1. **S11 — documentation/submission convergence:** keep README, site, Devpost, and
   video at the same actually deployed claim level; retain the existing compliant
   video until a new L2 production recording exists.
2. **S12 — exact release:** full local gate, immutable independent review,
   expected-head merge, post-merge CI, relay deployment, Pages deployment, manifest
   equality, bilingual multi-browser Chromium acceptance, and Devpost readback.
3. **After the deadline:** actual Firefox/WebKit durable-key promotion, independent
   physical/administrative failure-domain trials, encrypted relay payloads, and a
   richer deterministic genome only as separate versioned work.

## Release invariants

Every publishable SHA must still pass:

1. license, specification, link, governance, protocol, state, transport, relay,
   multi-browser, bilingual, UX, build, and portable gates through `npm test`;
2. current Chromium portable and Lab acceptance;
3. immutable independent review whose recorded head equals the merge candidate;
4. expected-head merge, post-merge Verify, and exact-main deployment;
5. public source-manifest, asset, MIME, header, route, relay, and clean-browser
   readback; and
6. submission surfaces that make no claim above the deployed evidence.

Committed, Node, isolated browser-target, and actual Chromium results must be
byte-identical for the portable corpus. Exactly 10,000 cases replay from seed
`1297044052`. Any cross-runtime mismatch reopens the earliest portable gate and puts
all later stages on `HOLD`.

Additional invariants:

- GPT-5.6 may suggest an allowlisted attack but cannot sign, select a head, create an
  accepted context, decide completeness, or change a verdict.
- The main proof must complete with GPT and its API disabled.
- Relay sequence, presence, storage, or availability never creates authority.
- A valid sibling race is a visible fork, never last-write-wins.
- Closing or losing an endpoint before handoff means stalled/read-only, not dead.
- An old green run does not cover a new SHA.

## Verification baseline required per candidate

| Evidence | Requirement |
| --- | --- |
| Node/browser agreement | Required per review head |
| CLI bootstrap proof | Verified proof only |
| Property corpus | 10,000 cases, seed `1297044052` |
| H3A MortalOS Lab | Three non-extractable Worker keys; logical `2-of-3`; one physical failure domain |
| Additional H3B exact-deployment criteria | source SHA, aggregate/file digests, MIME, headers, API policy, clean Chromium |
| R1/state | canonical JS/Python byte equality and stable tamper rejection |
| Multi-browser | EN/KO A→B continuation plus three-pair quorum loss/repair |
| Performance | cold-cache median LCP ≤2.5s, CLS ≤0.1, TBT proxy ≤200ms |

## Stop and rollback rules

- Preserve the last accepted production deployment until every S12 gate passes.
- If relay fails, disable the network journey and retain L1 import/replay; do not
  imply live succession.
- If GPT or anti-abuse configuration fails, disable GPT and retain the deterministic
  main proof.
- If `/ko/` is broken, do not publish the broken route as supported.
- If protocol/state integrity fails, roll back the whole candidate rather than
  narrowing tests or relabeling partial success.
- Never return the already-submitted Devpost project to Draft merely to ship a risky
  candidate.

The winning strategy is one strong, visible, reproducible continuity proof followed
by inspectable cryptographic depth—not a larger number of competing widgets.
