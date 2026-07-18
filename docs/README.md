# MortalOS documentation map

Last synchronized: **2026-07-19 KST**

This directory intentionally keeps only documents that are normative, operationally
current, or needed to reproduce the submitted artifact. Dated audits, superseded
plans, submission checklists, and video scripts belong in Git history rather than the
current documentation surface.

## Start here

- [North Star and pre-deadline roadmap](NORTH_STAR_ROADMAP.md) — current priorities,
  strict pass/fail gates, time boxes, and stop conditions.
- [Build Week release evidence](BUILD_WEEK_EVIDENCE.md) — accepted source, deployment,
  Devpost, video, and verification readback.
- [Endpoint-neutral access architecture](ACCESS_ARCHITECTURE.md) — the boundary
  between protocol authority and browser/CLI/service adapters.

## Normative protocol set

- [Protocol v0](PROTOCOL.md)
- [Threat model](THREAT_MODEL.md)
- [Rejection codes](REJECTION_CODES.md)
- [Requirements traceability](TRACEABILITY.md)
- [Single-browser incubator profile](SINGLE_BROWSER_INCUBATOR.md)

## Repository governance

- [Agent collaboration and merge protocol](AGENT_COLLABORATION.md)
- [Repository contribution guide](../CONTRIBUTING.md)

## Current claim boundary

MortalOS is a portable lifecycle evidence kernel and browser falsification Lab. It is
not yet a state-bearing operating system, an independent-host participant network, a
globally complete death oracle, or an ownerless model runtime. The current release
proves deterministic lifecycle decisions, exact-byte replay, a bounded GPT-5.6
adversarial-witness boundary, and exact-source public deployment. The canonical
zero-install judge URL is <https://mortal-os.com/>; the `pages.dev` hostname is an
incident fallback.

The OpenAI Build Week rules allow an individual entrant. There is no three-developer
or three-first-time-tester submission requirement. Automated browser, protocol,
deployment, and logged-out acceptance remain release gates; an invented human gate
does not.
