# OpenAI Build Week Compliance Matrix

Status: **Working submission gate**  
Last source check: **2026-07-14T05:48:44Z** through the connected Devpost Hackathons service  
Hackathon: [OpenAI Build Week](https://openai.devpost.com/)  
Official rules: [openai.devpost.com/rules](https://openai.devpost.com/rules)  
Project: [MortalOS](https://devpost.com/software/mortalos)  
Track: **Developer Tools**

This document converts live Devpost requirements into repository evidence. It is not a replacement for the official rules.

## 1. Live status

| Item | Devpost state on 2026-07-14 | Repository implication |
|---|---|---|
| Hackathon | `submissions_open` | Work may continue and the draft may be updated. |
| Registration | Registered | No registration action is pending. |
| Project | `MortalOS`, `submission_draft` | Submission is not complete. |
| Project description | Empty | Must be written in English after the demonstrated scope freezes. |
| Project tagline | Says the entity dies when the network disappears | Must be corrected: network silence/absence does not establish v0 protocol death. |
| Demo video | Missing | Public YouTube video is a submission blocker. |
| Category | Developer Tools selected in the credit request; required field still must be set in final submission | Product and judge path must be framed as a tool for developers. |
| Country | Connector eligibility list contains `Korea Republic of`; user registered from South Korea | Preserve accurate country selection in the final form. |

## 2. Canonical dates

| Milestone | Devpost timestamp | KST |
|---|---|---|
| Submission opens | `2026-07-13T16:00:00Z` | July 14, 01:00 |
| Codex credit request cutoff | July 17, 12:00 PT | July 18, 04:00 |
| Submission closes | `2026-07-22T00:00:00Z` | **July 22, 09:00** |
| Judging starts | `2026-07-22T16:00:00Z` | July 23, 01:00 |
| Winners announced | `2026-08-12T21:00:00Z` | August 13, 06:00 |

### Source conflicts and conservative resolution

- The July 13 announcement says “Monday, July 21st”; July 21, 2026 is Tuesday. The rules, overview, and ISO deadline agree on the date and time, so `2026-07-22T00:00:00Z` is authoritative for operations.
- The formal rules text lists judging through August 5 at 5:00 PM PT, while the key-date endpoint returns `2026-08-10T00:00:00Z`. Because a free test path must remain available during judging, keep the demo available through the later timestamp.
- Set an internal submission deadline of **July 21, 18:00 KST**, leaving 15 hours for upload or form failures.

## 3. Submission-object requirements

The live submission endpoint presents these required evidence objects. Its concise labels are: “A working project”, “A category”, “A project description”, “A demo video”, “Provide a URL to your code repository”, and “/feedback Codex Session ID”.

| Required object | MortalOS evidence | Current state | Gate |
|---|---|---|---|
| Working project | Pure validator, deterministic trace runner, MortalOS Lab judge path | Not implemented | Blocker |
| Category | Developer Tools | Selected in planning; final form pending | Open |
| Project description | Devpost Project Story in English | Empty | Blocker |
| Accurate tagline | Authority-loss wording consistent with the protocol | Current wording overclaims network-disappearance death | Blocker |
| Demo video | Public YouTube, less than 3 minutes, clear audio | Missing | Blocker |
| Repository URL | `https://github.com/YongHwan2161/mortalos` | Public | Partial |
| Relevant public-repo license | Repository-root `LICENSE` | Missing | **Blocker** |
| README setup and run guidance | Clean install, supported platforms, sample/test path | Partially added; clean-room run pending | Blocker |
| Codex/GPT-5.6 evidence | README build log plus video narration | Codex P0 evidence exists; actual GPT-5.6 product path missing | Blocker |
| `/feedback` session ID | Session containing most core functionality | Not captured | Blocker |
| Developer-tool testing instructions | Installation, platforms, sandbox/demo/test account | Not available | Blocker |

The live custom submission fields are IDs `27945` through `27951`. Required fields cover submitter type, country, one category, repository URL, and `/feedback` session ID. The developer-tool instruction field is conditionally required for MortalOS even though the generic form marks it optional.

## 4. Video acceptance gate

Before recording:

- freeze the exact build and trace shown;
- keep the final cut below 2:50 to avoid platform-duration ambiguity;
- show actual birth, complete custodian turnover, below-quorum rejection, clone identity, and the GPT-5.6 scenario boundary;
- narrate what MortalOS does, where Codex accelerated development, and how GPT-5.6 is invoked;
- use only music, images, logos, and other material the entrant may lawfully include; and
- upload publicly to YouTube and test the link from a logged-out browser.

A silent screencast, music-only recording, mock UI, or narration that omits either Codex or GPT-5.6 fails the submission gate.

## 5. Repository and licensing gate

The repository is public. Before submission it must have:

- a repository-root open-source license selected by the owner;
- reproducible `npm ci` and `npm test` commands;
- a supported-platform statement;
- installation and judge testing instructions;
- sample deterministic traces;
- a description of Codex collaboration and human decisions;
- accurate GPT-5.6 integration documentation;
- no secrets or private signing keys; and
- a hosted or prepared judge path that does not require rebuilding.

For a protocol and SDK, Apache-2.0 is the technical recommendation because it includes an explicit patent grant; MIT is simpler. This is an owner rights decision, so no license is applied automatically.

## 6. New-versus-existing-work evidence

The idea predates Build Week, but the repository and P0 implementation artifacts were created after the submission period opened. Continue to preserve:

- dated Git commits;
- the commit that introduces each major capability;
- Codex session evidence and the final `/feedback` session ID;
- a build log separating concept history from code produced during Build Week; and
- a precise list of any third-party code, service, model, data, and license.

Judges should be able to identify the work created during the eligible period without relying on a narrative assertion.

## 7. Judging-criteria evidence plan

The four criteria are equally weighted.

| Criterion | Evidence MortalOS must show |
|---|---|
| Technological Implementation | Non-trivial pure validator, real signatures, stable rejection codes, property tests, deterministic cross-process corpus, CI, and documented Codex collaboration. |
| Design | MortalOS Lab as a coherent judge experience with one-click trace, visual custody/lineage transitions, and actionable failure explanations. |
| Potential Impact | A specific developer audience: builders of ephemeral browser collaboration, agent, and peer-to-peer systems who need continuity/failure semantics and a test harness. |
| Quality of the Idea | Clear distinction among data persistence, identity, authority, state viability, and mortality, demonstrated rather than asserted. |

The current repository scores primarily on idea quality. It cannot credibly score on implementation, design, or demonstrated impact until H1–H4 pass.

Recommended corrected tagline, to apply only after owner approval:

> An ownerless lifecycle protocol for browser-native systems—preserving identity across host turnover and halting when quorum-held succession authority is lost.

## 8. GPT-5.6 and backend boundary

Build Week requires meaningful GPT-5.6 use, but MortalOS also requires model output to remain untrusted.

The submission path is:

```text
developer prompt
  -> GPT-5.6 scenario proposal
  -> strict scenario schema
  -> deterministic simulator and protocol validator
  -> accepted/rejected trace plus explanation
```

An API-key-protecting local proxy or replaceable hosted proposal service is allowed as non-authoritative infrastructure. It must not hold custodian keys, select a lineage head, store canonical MortalOS state, or turn an invalid Pulse into a valid one. Never embed an OpenAI API key in browser code.

## 9. Final no-submit conditions

Do not submit while any of these is true:

- Devpost still says `submission_draft`;
- the repository has no license;
- the build in the video differs from the accessible test build;
- a clean judge cannot install or open the project;
- GPT-5.6 is described but not actually used by the submitted project;
- the `/feedback` session ID is missing;
- the video is private, at least three minutes, silent, or omits required narration;
- testing requires payment, undisclosed credentials, or unavailable hardware; or
- public claims exceed the honest-custodian and authority-death threat model.
