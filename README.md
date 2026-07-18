# MortalOS

**The problem:** long-running agents can rotate processes and keys, but ordinary uptime
checks cannot prove whether a successor is authorized, a replay is stale, two valid
children created a fork, or available evidence is complete enough for a qualified
mortality claim.

MortalOS is an endpoint-neutral lifecycle evidence protocol. GPT-5.6 proposes a
bounded attack; canonical bytes bind that proposal; the deterministic kernel alone
decides whether identity continued, forked, or lost authority.

Public final judge URL:
[MortalOS Lab](https://mortalos-lab-yonghwan2161.pages.dev/).
The release manifest displayed after the four-action proof identifies the exact
reviewed source commit and aggregate asset digest. The separate zero-install
[R1 evidence fallback](https://mortalos-evidence-lab.ant713800.chatgpt.site) remains
available for incident recovery but is not the final judge path.
The new [mortal-os.com](https://mortal-os.com/) hostname is TLS-active and serves the
exact static release, but remains a candidate canonical URL until its valid
`POST /api/scenarios` and three-context Chromium path pass the same remote gate.
Source: [YongHwan2161/mortalos](https://github.com/YongHwan2161/mortalos).

## 90-second judge path

1. Select **Run the 90-second proof**.
2. Run the committed deterministic baseline.
3. Ask GPT-5.6 for one allowlisted falsification; compare its prediction with the
   kernel's actual status and rejection code.
4. Replay the exact compiled bytes without GPT and confirm the same digest and verdict.

The path demonstrates three concrete proofs: stale evidence cannot advance a head;
valid signed siblings create a detected fork rather than two authoritative heads; and
silence or key loss is not global death without the explicitly closed evidence basis.

It does **not** claim that three browser Workers are three independent operators, that
the current artifact is an OS, or that v0 proves global death or ownerless operation.

## Three-minute local proof

Supported release gates are Windows and Ubuntu Linux with Node.js 22.5+, plus current
Chromium. Other operating systems are best-effort until they have an equivalent gate.

```bash
npm ci
npm run test:scenarios
npm run build:lab
npm run dev:lab
```

Open the printed local URL and follow the four actions above. This path uses a local,
schema-valid model fixture; it needs no API or Cloudflare credential. The full fixed
GPT-5.6 evaluation is intentionally separated under **Run** because it requires
runtime secrets.

## Codex and GPT-5.6 evidence, not endorsements

| Evidence | Concrete contribution | Human-owned boundary |
| --- | --- | --- |
| `functions/api/scenarios.js` + 7 API tests | Codex implemented strict request/output limits, fail-closed errors, HMAC actor privacy, and the Responses API adapter. | Maintainers chose the anonymous edge-actor compromise and secret policy. |
| `lab/scenario-compiler.mjs` + ten mutation cases | Codex connected each model enum to deterministic canonical bytes and the existing kernel. | GPT prose is discarded; no model output becomes authority. |
| `scripts/verify-gpt-scenarios.mjs` + 25 fixed calls | GPT-5.6 selected the intended attack 25/25 and covered all ten mutations. | The kernel disagreed with the model's exact verdict 25/25; the mismatch is preserved as evidence. |
| `.gitattributes`, portable launchers, Windows clean-clone run | Codex found and fixed LF, drive-path, and POSIX-only coverage defects exposed on Windows. | Windows and Ubuntu are the only claimed gated hosts. |
| `asset-manifest.json`, deployment verifier, immutable reviewer contract | Codex bound public bytes, headers, digest, and source SHA to a reviewed release. | An independent reviewer and post-merge CI must pass before deployment or submission. |

Exact commands, run IDs, coverage, remaining external gates, and human-owned decisions
are recorded in [Build Week release evidence](docs/BUILD_WEEK_EVIDENCE.md).

MortalOS separates identity, continuation authority, lineage, state availability, and
observable liveness. Its long-term question is whether one network-native entity can
preserve an authorized identity after every original host has been replaced—and stop
when succession becomes impossible under explicit assumptions.

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
  Pages, applies a D1-backed atomic ten-request-per-minute private-actor limit before
  OpenAI, and verifies the public bytes and Chromium judge path after deployment;
- a public, exact-source [Cloudflare Pages release](https://mortalos-lab-yonghwan2161.pages.dev/)
  whose strict remote verifier checks every served byte, MIME type, security header,
  D1-backed GPT route, and three clean Chromium judge contexts;
- an R1 canonical operation/result contract for Genesis validation, lineage replay,
  and qualified mortality, with exact byte ceilings, stable rejection results, eight
  committed goldens, and byte-identical JavaScript/Python corpus-profile differential
  verification; and
- a public [MortalOS Evidence Lab](https://mortalos-evidence-lab.ant713800.chatgpt.site)
  that contrasts incomplete and complete mortality evidence and uses GPT-5.6 only as
  a server-side, schema-constrained, non-authoritative witness.

Not implemented:

- the deployed Sites frontend/server source in this `main` tree;
- a stable CLI create/import/replay/export contract;
- participant-to-participant transport or replicated state;
- a deterministic executable genome or mutable logical state.

Submission status: the exact-source Cloudflare Pages Lab is the zero-install judge
path. Its four-action proof runs the committed baseline, calls GPT-5.6 only for an
allowlisted proposal, exposes the authoritative kernel result, and reproduces the
same digest and verdict with GPT off. The Devpost entry is `Submitted`, the public
narrated video is attached, and the required `/feedback` Session ID is saved. The
official rules allow an individual entrant and do not impose a three-developer or
three-first-time-tester gate.

This tree implements the **P0 mortality-safe kernel, H3A/H3B Lab contract, and bounded
R1-A/R1-B evidence profile**.
Any SHA is publishable only after immutable-head review and its own successful Verify
run. Every release update follows:

`immutable review → post-merge Verify → exact-SHA Cloudflare deploy → public readback → Devpost reconciliation`

Hosting improves judge access without claiming that it closes the JavaScript observer
boundary. R1-A/R1-B are merged; R1-C, R2, and networking remain the ordered core work:

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

See the [North Star and pre-deadline roadmap](docs/NORTH_STAR_ROADMAP.md) and
[current release evidence](docs/BUILD_WEEK_EVIDENCE.md).

### Build Week release

The reviewed release adds a repository-owned `POST /api/scenarios`
Pages Function and a four-action judge path. GPT-5.6 is a server-only, strict-schema
adversarial witness. It selects one of ten allowlisted mutations; a deterministic
compiler emits canonical scenario bytes; the existing MortalOS kernel independently
decides the result; and `Replay without GPT` proves the same digest and verdict with
no second model call.

The fixed live evaluation passed 25/25 scenario selections, covered all ten mutations,
and reproduced 25/25 kernel results offline. GPT's exact status/code prediction was
0/25, which demonstrates the intended authority boundary rather than hiding model
error. See [Build Week release evidence](docs/BUILD_WEEK_EVIDENCE.md). Runtime PR #17
and evidence PR #18 passed exact-head policy/CI, immutable review, expected-head
merge, post-merge Verify, and the complete public Cloudflare acceptance workflow.
Any later source SHA must repeat those gates.

## Run

Supported and release-gated platforms: Node.js 22.5 or later on Windows and Ubuntu
Linux, plus current Chromium for MortalOS Lab. Other platforms are best-effort until
the same clean-clone gates are recorded. The local H3A Lab needs no account.

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run test:lab
npm run test:scenarios
npm run test:r1
npm run build:lab
npm run verify:r1
npm run verify:lab
npm run dev:lab
npm run demo:singleton
npm run demo:trace
```

The live fixed GPT-5.6 evaluation additionally requires `OPENAI_API_KEY` and an
independent 32+ character `SAFETY_IDENTIFIER_SECRET` in the process environment.
Never write either value to a file, command transcript, or repository:

```bash
npm run verify:gpt-scenarios
```

Final release-document URLs are resolved, rather than syntax-checked only, with:

```bash
MORTALOS_CHECK_EXTERNAL_LINKS=1 npm run verify:links
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

Current accepted release: PR #18 produced `main`
`03e868ccd810064e81275a7ac2d71b543030b916`; post-merge Verify
`29632638423/1` and Deploy MortalOS Lab `29632638421/1` passed. The workflow
verified six exact assets and security headers, the API failure/happy/rate-limit
paths, and the full judge path in three clean Chromium contexts. The release asset
digest is `sha256:VW018QRVpiK50L0YHwTPG0p5PP7dILdiay2Ia9aFc98`.
A later source change is accepted only after its own post-merge deployment and public
manifest readback.

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

- [Documentation map](docs/README.md)
- [North Star and pre-deadline implementation roadmap](docs/NORTH_STAR_ROADMAP.md)
- [Endpoint-neutral access architecture](docs/ACCESS_ARCHITECTURE.md)
- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [Single-browser incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md)
- [Build Week release evidence](docs/BUILD_WEEK_EVIDENCE.md)
- [Agent collaboration and merge protocol](docs/AGENT_COLLABORATION.md)

Current documentation contains only normative rules, one current roadmap, deployment
profiles, traceability, governance, and release evidence. Git history preserves dated
provenance and superseded submission artifacts.

## Project direction

R1-A now exposes bounded versioned raw operations/results and a JavaScript golden
corpus; R1-B replays that eight-record profile in an independently written Python
verifier. The public Sites Lab consumes two committed R1 outcomes, while R1-C must
still move the full H3A experiment onto the wire contract. R2 then adds deterministic
state. CLI and network adapters remain thin consumers of the same contract.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 accelerated the conversion of the original “network life” idea
into falsifiable protocol claims: birth, identity, succession, qualified death, and
resurrection rejection. It was used to red-team evidence completeness and hostile
observer inputs, implement deterministic conformance/property/browser tests, compare
the project against Devpost requirements, and design the exact-asset Cloudflare
deployment verifier. Git history and committed vectors make those contributions
reviewable instead of treating model prose as evidence. The release-candidate Lab
also uses GPT-5.6 to select a bounded adversarial scenario. Model prose remains
display-only: canonical compilation and the existing kernel determine the actual
result, and GPT-off replay proves the result is not model-dependent. GPT cannot sign,
validate, select a head, or declare death.

The human retained the consequential decisions: North Star, threat assumptions,
scope, browser-first product strategy, claim limits, Apache-2.0 license, and final
submission wording. GPT-5.6 output is never a validity authority.

## License

MortalOS is licensed under the [Apache License 2.0](LICENSE). Contributions use the same terms as described in [CONTRIBUTING.md](CONTRIBUTING.md). Current dependency licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
