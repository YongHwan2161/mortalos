# MortalOS

**An endpoint-neutral lifecycle protocol for network-native entities.**

MortalOS separates identity, continuation authority, lineage, state availability, and observable liveness. Its long-term question is whether one network-native entity can preserve an authorized identity after every original host has been replaced—and stop when succession becomes impossible under explicit assumptions.

## Honest status

The current artifact is a verified **portable protocol and evidence kernel with CLI and Chromium proof adapters**, not yet an OS, participant network, or state-bearing digital life.

Implemented:

- portable `Uint8Array` processing with intrinsic-backed immutable snapshots, `SharedArrayBuffer` rejection, duplicate-aware UTF-8/I-JSON parsing, exact root-depth limits, and data-only RFC 8785 canonicalization that rejects accessors and the explicitly probed, detectable internal-slot objects (subject to the Proxy/exotic limits in the protocol);
- eight domain-separated SHA-256 derivations and strict RFC 8032 Ed25519 verification, including canonical prime-subgroup checks for public keys and signature points;
- Genesis and Pulse validation for strict-majority custody descriptors from `1-of-1` through 16 custodians;
- total public validators with stable first-error precedence, non-forgeable recursively frozen contexts, and supplied-evidence-only public latent validation;
- membership handoff validation that proves the declared next quorum can activate from supplied approval and acceptance evidence;
- a lineage registry that rejects replay, detects valid siblings, exposes quorum equivocation, and halts after a fork;
- recognized-head mortality that recursively discovers target-tuple candidate bodies and exact tagged signature strings throughout declared envelope/payload JSON under fixed occurrence, canonical-byte, pending-input, usable-key, and signature-work ceilings; independently indexes content-addressed sidecars; cryptographically reconstructs same-body evidence; filters one explicit usable-key snapshot through sign-once commitments; keeps equivocation and limit overflow unclassified; lets completion-capable missing membership payloads block only an otherwise unsupported death classification; and requires an explicit complete-evidence basis before reporting death;
- a public singleton birth/heartbeat, a verified `1-of-1` to logical `2-of-3` custody/authority expansion, and the complete A/B/C → D/E/F lifecycle;
- a v4 committed result corpus with named negatives, reported trust-boundary outcomes,
  explicit incomplete-versus-complete mortality evidence, bounded-observation probes,
  same-body completion and payload-unavailability cases, repairable-fork equivocation,
  and 10,000 seeded adversarial cases; Node and the isolated browser-target VM
  exercise every portable case;
- a locked gate that requires byte-identical committed, Node.js, isolated
  browser-target, and actual headless-Chromium results for every changed review head;
  and
- a local H3A MortalOS Lab with three non-extractable Worker keys, live `2-of-3`
  birth/heartbeat experiments, reference lifecycle falsification, full corpus replay,
  canonical public-evidence export, and cross-origin-isolated browser boundary checks.
- an H3B deployment contract on `main` that binds a clean static build to one source commit,
  hashes every served asset, mirrors the local security-header contract on Cloudflare
  Pages, and verifies the public bytes and Chromium judge path after deployment.

Not implemented:

- a direct, exact-commit-verified Cloudflare Pages release of the full H3A Lab;
- the open R1 candidate or deployed Sites source in this `main` tree;
- a stable CLI create/import/replay/export contract;
- participant-to-participant transport or replicated state;
- a deterministic executable genome or mutable logical state.

Submission status outside this `main` snapshot: the public
[MortalOS Evidence Lab](https://mortalos-evidence-lab.ant713800.chatgpt.site)
provides a zero-install A/B view of two R1 mortality outcomes and an explicitly
non-authoritative GPT-5.6 explanation. Logged-out HTTP, GPT response, and private-field
rejection smoke tests pass. Its R1 implementation is open in PR #12 and its Sites
source/version provenance must be reconciled with the final reviewed repository SHA
before submission freeze.

This tree implements the **P0 mortality-proof and bounded-observation correction**.
Any SHA is publishable only after immutable-head review and its own successful Verify
run. The Build Week submission lane now follows:

`truthful status → R1 merge → Sites provenance → video → fields → submit`

That deadline exception improves judge access without claiming that hosting closes
the JavaScript observer boundary. R1 is now deadline-critical because the public Lab
and Devpost story already describe it; R2 and networking remain post-submission:

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

See [Project status](docs/PROJECT_STATUS.md) and the [implementation
plan](docs/IMPLEMENTATION_PLAN.md).

## Run

Supported platforms: Node.js 22.5 or later on macOS, Linux, or Windows for local
verification; a current Chromium-class browser for MortalOS Lab. The public Lab is
static and needs no account or extension.

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run test:lab
npm run build:lab
npm run verify:lab
npm run dev:lab
npm run demo:singleton
npm run demo:trace
```

To verify a reviewed Cloudflare deployment against its exact commit:

```bash
MORTALOS_LAB_URL=https://mortalos-lab-yonghwan2161.pages.dev \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:deployed-lab
```

Maintainers deploy through the reviewed GitHub workflow. `npm run deploy:lab` is the
equivalent local maintainer command and requires Cloudflare credentials; judges do
not need those credentials.

Current release status: the H3B contract is merged and the post-merge Verify run
passes, but the first direct Pages workflow stopped at credential preflight because
the repository has neither `CLOUDFLARE_ACCOUNT_ID` nor `CLOUDFLARE_API_TOKEN`.
Therefore the `pages.dev` URL above is only a target. The separate Sites URL is the
current public judge path; it does not satisfy H3B's exact-asset contract.

`npm test` runs license/specification/governance gates, the conformance and Lab unit
tests, the versioned cross-runtime corpus, a fixed-seed 10,000-case mixed
valid/invalid property corpus, the deterministic lifecycle trace, and the static Lab
build. `npm run verify:lab` adds real cross-origin-isolated Chromium acceptance.
Coverage enforces at least 90% aggregate branch coverage across the trusted core;
exact counts and percentages belong to the latest successful verification output.
`npm run test:chromium` compares actual Chromium with the committed portable result;
when running it outside the full sequence, run `npm run verify:portable` immediately
first to establish committed/Node/browser-target equality on the same source head.

Expected H2 trace digest:

```text
19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399
```

Committed vectors contain public verification material only. Tests that need signing keys generate them in memory and do not persist them.

## Creation profiles and ownership boundary

MortalOS counts distinct eligible custodian **key IDs**, not people, tabs, browsers, devices, or organizations.

- **CLI singleton (`1-of-1`)**: one ephemeral process can create a valid seed and heartbeat. This is creator-controlled, not ownerless.
- **Single-browser incubator (`2-of-3`)**: the local H3A page holds three logical keys and can satisfy quorum by itself. It remains one physical failure domain.
- **Distributed `2-of-3`**: no physical or administrative domain holds two keys, so no one domain can continue alone.

The verified singleton can hand logical custody authority to `2-of-3` without changing `organism_id`. After that handoff, the original sole key is insufficient while two eligible keys can advance. This makes the distinction explicit: creation may begin locally, but ownerless continuation depends on the deployment distribution of keys in the accepted custody descriptor, backed by external failure-domain evidence—not on the UI or descriptor alone.

Closing a browser or CLI process can remove every locally usable key and make the organism disappear operationally from that endpoint. It is not automatically a global or protocol death fact. Mortality reports `dead_under_v0_assumptions` only when authority loss is explicitly irreversible **and** the observer explicitly declares its pending-evidence inventory complete; missing or false completeness remains `authority_unavailable_not_proven_dead`.

## Why browser first, but not browser only

The Build Week product is **MortalOS Lab**, a browser-based Developer Tools experience for inspecting and falsifying lifecycle traces. The browser is first because it offers a zero-install judge path and makes identity, custody, turnover, fork, and mortality visible.

The browser is not a protocol boundary. Browser, CLI, native, service, embedded, and future network participants must carry the same canonical evidence to the same portable kernel. UI, transport, storage, signaling, and model output cannot define validity.

## Verified lifecycle slice

```text
singleton birth and heartbeat
  -> optional handoff to logical 2-of-3 authority
     (physical distribution requires external evidence)

birth {A,B,C}
  -> handoff {B,C,D}
  -> handoff {C,D,E}
  -> pre-authorized handoff survives current-key loss
  -> handoff {D,E,F}
  -> exact replay rejected
  -> missing state reported as state-stalled
  -> irreversible below-quorum authority loss plus a complete evidence inventory reported as dead under v0 assumptions
  -> public-snapshot resurrection rejected
  -> same-genome clone accepted only under a different organism_id
```

A public signed-fork fixture also proves `E_FORK_DETECTED`, one intersecting equivocator, and `E_LINEAGE_ALREADY_FORKED` after the fork.

## Trust boundary

`validateGenesis` and `validatePulse` verify transitions. Accepted results are frozen and carry an in-process capability that cloning, JSON serialization, or hand-built objects cannot reproduce.

Use `createLineage` for recognized-head, replay, and fork behavior. After restart, replay canonical Genesis/Pulse evidence to reconstruct the graph; never persist or trust an `accepted: true` object.

`Lineage#evaluateMortality` is a controlled-experiment observer, not a global death oracle. It supplies the recognized head and blocks reentrant graph mutation. Its observer adapter is a trusted boundary: options, inventory arrays, and carriers must be honest, Proxy-free ordinary own-data containers. The observer reads only five documented option fields, two carrier fields, bounded array lengths, and bounded own-data indices; unrelated properties are ignored without `ownKeys`, iterator, or getter access and cannot contribute evidence. Recognized accessors, sparse indices, foreign prototypes, and noncanonical usable-key IDs abort. Raw evidence bytes remain hostile and are copied into owned storage before use. An exact runtime/dependency check plus one constant SHA-256/RFC 8032 known-answer checkpoint must pass before any mortality result, including an already-forked result. Malformed, oversized, wrong-type, detached, or otherwise unsnapshotable declared byte sources abort the whole mortality operation as observer uncertainty, never as zero evidence. Seven fixed whole-operation limits cover usable IDs, pending records/bytes, target-body occurrences/canonical bytes, and conservative signature work. The 1,152 signature-unit ceiling admits the maximum 16-current/16-new transition at 1,088 units with 64 units of headroom; duplicate direct carriers retain per-validator reservations. Each target occurrence is reserved before JCS and its canonical bytes immediately afterward, before retention; overflow returns a frozen unclassified result without graph mutation or evidence truncation. Phase two reads only owned snapshots, uses private brands and frozen public surfaces, and reuses one usable-key snapshot while reconstructing exact-body successors. Exact Ed25519 signature strings, including object property names, and target-tuple candidate body objects are discovered recursively anywhere in every parsed declared envelope or payload tree. Unsigned placement and labels do not establish signer identity or evidence role; signatures are remapped against every eligible key under the correct body/domain and all verifying signers are preserved. A usable key is not projected onto a second body after signing another, and authenticated multi-body evidence returns unclassified `evidence_equivocation`. Only after authority loss is declared irreversible can a completion-capable membership body without a verified sidecar return unclassified `evidence_payload_unavailable`, and then only when no fresh quorum or verified latent successor independently establishes non-death. Actual death additionally requires `latentEvidenceComplete: true`. A module-private constructor token and frozen lineage surface prevent chosen-head injection and method shadowing, and internal conditional helpers are not re-exported by `src/index.mjs`. Global usable-key availability, state availability, irreversibility, evidence completeness, and absence of hidden copies remain declared observer assumptions.

JavaScript cannot distinguish a transparent `Proxy` that lies consistently through descriptor traps. A hostile Proxy at the observer-container boundary can therefore falsify a v0 mortality input and is explicitly outside the current guarantee; callers must enforce a Proxy-free honest producer before invoking the observer. R1 replaces this object-graph boundary with one canonical versioned operation/result byte contract and an independent non-JavaScript verifier. Completeness itself remains an explicit policy assertion even after that change.

## Documentation

- [Project status and review findings](docs/PROJECT_STATUS.md)
- [Prioritized implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Endpoint-neutral access architecture](docs/ACCESS_ARCHITECTURE.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Single-browser incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md)
- [Build Week submission checklist](docs/SUBMISSION_CHECKLIST.md)

Current documentation contains only normative rules, rolling status/plan, deployment profiles, traceability, and submission evidence. Git history preserves dated provenance.

## Project direction

H3B first gives judges an honest zero-install view of H3A. After submission, R1-A
exposes bounded versioned raw operations and results plus a JavaScript golden corpus;
R1-B replays that corpus in an independently written Python verifier; and R1-C moves
the Lab onto those records. R2 then adds deterministic state. CLI and network adapters
remain thin consumers of the same contract.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 accelerated the conversion of the original “network life” idea
into falsifiable protocol claims: birth, identity, succession, qualified death, and
resurrection rejection. It was used to red-team evidence completeness and hostile
observer inputs, implement deterministic conformance/property/browser tests, compare
the project against Devpost requirements, and design the exact-asset Cloudflare
deployment verifier. Git history and committed vectors make those contributions
reviewable instead of treating model prose as evidence.

The human retained the consequential decisions: North Star, threat assumptions,
scope, browser-first product strategy, claim limits, Apache-2.0 license, and final
submission wording. GPT-5.6 output is never a validity authority, and the current Lab
does not claim a runtime OpenAI API integration.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions use the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Current dependency licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
