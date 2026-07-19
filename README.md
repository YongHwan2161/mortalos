# MortalOS

> **Create once. Continue elsewhere.**

MortalOS is an endpoint-neutral lifecycle protocol and falsification Lab for digital
resources that must survive process and key rotation without trusting a browser,
relay, host, UI, or model as the source of truth.

- Live judge URL: [mortal-os.com](https://mortal-os.com/)
- Korean experience: [mortal-os.com/ko/](https://mortal-os.com/ko/)
- Source: [YongHwan2161/mortalos](https://github.com/YongHwan2161/mortalos)
- Exact release evidence: [Build Week release evidence](docs/BUILD_WEEK_EVIDENCE.md)

The repository now contains a locally verified multi-browser release candidate. A
claim becomes a **public production claim only after the exact merged commit passes
deployment, manifest, relay, and clean-Chromium readback**. Until then, the last
accepted public release remains the rollback baseline recorded in the release
evidence.

## 90-second judge path

1. In Browser A, choose **Create in this browser**.
2. Open the locally generated join QR or copied link in a clean Browser B profile.
3. Browser B creates its own non-extractable key. A and B authorize one canonical
   custody handoff; no private key crosses the relay.
4. Close Browser A.
5. In Browser B, choose **Continue here** and confirm that the same `organism_id`
   advances from sequence 1 to 2 with a new deterministic state root.

The page keeps one organism and one primary journey in view. GPT, the fixed reference
fixture, corpus replay, raw bytes, durable storage, and protocol diagnostics remain
available under **Advanced evidence**, but none is required to complete the main
proof.

## What this release candidate proves

| Claim | Evidence |
| --- | --- |
| L1 — portable history | A clean browser imports canonical public evidence and reconstructs the same identity and head without receiving signing authority. |
| L2 — live endpoint succession | A→B custody handoff is accepted; after A closes, B signs the next state transition for the same identity. |
| L3 — quorum resilience | A/B/C hold distinct keys under `2-of-3`; every complementary pair continues after the third endpoint is lost, and a new D can repair membership. |
| L4 — deterministic state | JavaScript and an independently written Python verifier reproduce byte-identical next-state and receipt records; tamper and limits fail atomically. |
| Honest failure | Closing A before the handoff leaves B read-only and stalled. A single remaining `2-of-3` endpoint is insufficient, not “dead.” |

Actual Chromium gates use isolated browser profiles and real non-extractable WebCrypto
keys. They prove browser/profile isolation and protocol behavior, not that three
people, organizations, or physical devices independently control the keys.

## What MortalOS does not claim

- It is not a general-purpose operating system or an autonomous-agent runtime.
- A relay, room link, browser animation, GPT answer, process exit, or silence never
  establishes protocol validity or global death.
- A single-browser logical quorum is one physical failure domain.
- Finite evidence cannot prove that every hidden copy worldwide is gone.
- Firefox and WebKit durable-key support remain feature-gated until their own actual-
  engine acceptance runs pass.

## Run locally

Requirements: Node.js 22.5 or later. Windows and Ubuntu are release-gated; current
Chromium is required for browser acceptance.

```bash
npm ci
npx playwright install chromium
npm test
npm run verify:lab
npm run dev:lab
```

Open the printed URL in two isolated browser profiles. The local server supplies a
deterministic relay and model fixture, so the main proof requires no Cloudflare or
OpenAI credential.

Focused gates:

```bash
npm run test:i18n
npm run test:state
npm run test:transport
npm run test:relay
npm run test:multi-browser
npm run verify:persistent-handoff
npm run verify:ux
npm run verify:state
npm run verify:transport
npm run verify:cost-controls
npm run test:chromium
npm run test:coverage
```

`verify:lab` includes the strict 20-run two-persistent-profile handoff gate. The
focused command above runs that gate alone; it refuses a configured run count below
20. Its first run also measures two simultaneously active browsers for 12 seconds
against the production-shared relay policy and requires zero local `429` responses.

The fixed property corpus contains exactly 10,000 cases from seed `1297044052`.
The expected H2 trace digest remains:

```text
19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399
```

## Trust boundary

```text
Browser A/B/C key custody
        │ signed canonical public messages
        ▼
Cloudflare room relay (ordering, presence, and bounded storage only)
        │ untrusted delivery
        ▼
R1 canonical operation/result bytes
        │
        ▼
portable kernel → accepted lineage or stable rejection
```

Each endpoint verifies locally. The relay cannot return `accepted: true`, choose a
head, sign, resolve a fork, or declare death. Durable Participant storage is consent-
gated and contains one non-extractable key plus canonical public evidence; restore
replays that evidence instead of trusting cached verdicts. Ephemeral Demo creates no
durable browser storage.

The implemented core sequence is:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → Durable Object relay → two-browser succession → three-endpoint 2-of-3 repair`

## GPT-5.6 boundary and cost safety

GPT-5.6 is an optional, collapsed adversarial witness. The deterministic main journey
performs zero model calls. The browser never receives an OpenAI API key. The server
route is fail-closed behind explicit enablement, Turnstile validation, atomic D1
actor/global-minute/global-day caps, bounded input/output, and a circuit breaker.

If a production Turnstile widget and secret are not configured, optional GPT remains
disabled and the local curated attack path stays available. Model output can suggest
an allowlisted mutation but cannot sign, compile canonical authority, select a head,
or alter a kernel verdict.

## Release integrity

Every publishable SHA must pass local tests, immutable independent review, exact-head
CI, expected-head merge, post-merge CI, exact-main Cloudflare deployment, public
manifest/asset/header readback, and clean Chromium acceptance. An old green run does
not cover a new SHA.

To verify the accepted production artifact:

```bash
MORTALOS_LAB_URL=https://mortal-os.com \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:release
```

The `pages.dev` hostname is an incident fallback. Production bytes are never patched
out of band; a failed candidate preserves or restores the last accepted deployment.

## Documentation

- [Documentation map](docs/README.md)
- [Multi-browser implementation and verification SSOT](docs/MULTI_BROWSER_DIGITAL_LIFE_UX_IMPLEMENTATION_PLAN.md)
- [North Star roadmap](docs/NORTH_STAR_ROADMAP.md)
- [Build Week release evidence](docs/BUILD_WEEK_EVIDENCE.md)
- [Endpoint-neutral architecture](docs/ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](docs/BROWSER_PARTICIPANT_COMPATIBILITY.md)
- [Protocol](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Traceability](docs/TRACEABILITY.md)
- [Single-browser legacy/incubator profile](docs/SINGLE_BROWSER_INCUBATOR.md)
- [Agent collaboration and merge protocol](docs/AGENT_COLLABORATION.md)

MortalOS is licensed under the [Apache License 2.0](LICENSE). Direct dependency
licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
