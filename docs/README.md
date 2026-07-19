# MortalOS documentation map

Last synchronized: **2026-07-19 KST**

This directory keeps one execution SSOT, one release record, and the normative or
operational documents needed to reproduce the product. Superseded checklists,
status snapshots, and demo scripts remain in Git history.

## Start here

- [Multi-browser implementation and verification SSOT](MULTI_BROWSER_DIGITAL_LIFE_UX_IMPLEMENTATION_PLAN.md) — S0–S12 goals, exact status, strict gates, HOLD rules, and release Definition of Done.
- [Build Week release evidence](BUILD_WEEK_EVIDENCE.md) — last accepted production release, current local candidate, Devpost/video state, and rollback boundary.
- [North Star roadmap](NORTH_STAR_ROADMAP.md) — the short product direction and remaining promotion gates.

## Architecture and compatibility

- [Endpoint-neutral access architecture](ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](BROWSER_PARTICIPANT_COMPATIBILITY.md)
- [Single-browser incubator and legacy L0 profile](SINGLE_BROWSER_INCUBATOR.md)

## Normative protocol set

- [Protocol](PROTOCOL.md)
- [Threat model](THREAT_MODEL.md)
- [Rejection codes](REJECTION_CODES.md)
- [Requirements traceability](TRACEABILITY.md)

## Governance

- [Agent collaboration and merge protocol](AGENT_COLLABORATION.md)
- [Repository contribution guide](../CONTRIBUTING.md)

## Current claim boundary

The source tree contains a locally verified L2/L3/L4 release candidate: canonical
A→B browser succession, complementary-pair `2-of-3` resilience and repair, and a
deterministic cross-language state engine. These become public claims only when the
exact merged commit passes production relay, manifest, English/Korean, and clean-
Chromium acceptance.

MortalOS is not a general-purpose OS, a globally complete death oracle, an ownerless
model runtime, or proof that isolated browser profiles are separate people or
administrative domains. GPT-5.6 is optional and non-authoritative. The canonical
judge URL is <https://mortal-os.com/>; `/ko/` is the Korean route and `pages.dev` is
incident fallback only.

The OpenAI Build Week rules allow an individual entrant. Three developers or three
first-time testers are not submission requirements; automated conformance and
isolated-browser evidence are the reproducible gates.
