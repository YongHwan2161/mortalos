# MortalOS

> **The network does not host MortalOS. The living network is MortalOS.**

MortalOS is an endpoint-neutral lifecycle protocol and falsification Lab for digital
resources that must survive process and key rotation without trusting a browser,
relay, host, UI, or model as the source of truth. Opt-in participants contribute
bounded storage, bandwidth, and eventually computation; identity, memory, and
execution must be able to circulate among those participants without a fixed
authoritative backend.

- Optional public bootstrap and protocol Lab: [mortal-os.com](https://mortal-os.com/)
- Korean experience: [mortal-os.com/ko/](https://mortal-os.com/ko/)
- Source: [YongHwan2161/mortalos](https://github.com/YongHwan2161/mortalos)
- Current North Star and execution plan: [implementation SSOT](docs/IMPLEMENTATION_PLAN.md)

Main contains the unified Participant Core, crash-safe durable quorum, exact S3
recovery over real relay fragments, confidential S4 state, an authority-free
verification SDK plus an explicit continuity capability subpath, Continuity Capsules,
and a replicated counter-authority model. The revised
S2/S4 claims remain deliberately narrower than their merged implementation until
new stage receipts promote them. The
[claim matrix](docs/CLAIM_MATRIX.md) distinguishes
implemented, exact-head verified, physically verified, promoted, and explicitly
unclaimed behavior.

## Current development focus

The continuity vertical is one organ of MortalOS, not its whole body. The current P0
candidate adds a direct participant-owned WebRTC DataChannel transport. Two isolated
Chromium processes manually exchange canonical offer/answer signals, the verifier then
cuts every HTTP request before Genesis, join, handoff, origin-A exit, and continuation,
and B advances the same organism without a relay or origin. The transport reuses the
same bounded canonical protocol frames and accepts no signaling-server, STUN, TURN,
HTTP, or relay fallback.

This proves a loaded pair can continue without a fixed backend. It does **not** yet
prove peer-distributed application bootstrap, cross-network NAT traversal, three
physical failure domains, or participant resource scheduling. Those are the next
product milestones. `mortal-os.com` is an optional bootstrap and demonstration
origin, not a runtime authority or required protocol dependency. See the
[implementation SSOT](docs/IMPLEMENTATION_PLAN.md).

## Guided two-browser proof

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

## What is implemented and what is promoted

| Claim | Evidence |
| --- | --- |
| L1 — portable history | A clean browser imports canonical public evidence and reconstructs the same identity and head without receiving signing authority. |
| L2 — live endpoint succession | A→B custody handoff is accepted; after A closes, B signs the next state transition for the same identity. |
| L3 — quorum resilience | A/B/C hold distinct keys under `2-of-3`; every complementary pair continues after the third endpoint is lost, and a new D can repair membership. |
| L4 — deterministic state | JavaScript and an independently written Python verifier reproduce byte-identical next-state and receipt records; tamper and limits fail atomically. |
| L5 — recoverable resource state | A canonical manifest binds a bounded resource to lineage; any two logical replicas reconstruct the exact 1 MiB reference after the third replica and primary relay are deleted. S3 is promoted. |
| S4 revised implementation — confidential resource state | S3 stores only a canonical ciphertext package; authorized recovery returns exact bytes without exposing the internal epoch-key handle. Node, Chromium, and Firefox rotation/custody gates pass; a new stage receipt and isolated-signer claim remain separate. |
| S5/S6 product continuity — portable use | The default SDK remains verification-only; `@mortal-os/core/continuity` and the CLI expose create/inspect/handoff/recover/continue through explicit authority capabilities. A canonical Capsule binds lineage plus exact resource bytes, and clean-package Node plus built-Lab Chromium complete A→B recovery and continuation. The product Capsule is not a confidentiality claim. |
| S7/S8 merged implementation — replicated custody | Three process-isolated HTTP CAS replicas tolerate one loss and repair after disk restart; 2-of-3 signed Capsule-copy custody tolerates one corrupt/lost copy and rejects duplicate copy identity and a valid fork. This is not evidence of independent providers or administrators. |
| Hostless WebRTC participant candidate | Two actual Chromium processes carry signed canonical Genesis, join, and handoff evidence directly over one ordered DataChannel after all HTTP is denied; A then removes its authority and its process exits, while B commits sequence 2 for the same organism. |
| Honest failure | Closing A before the handoff leaves B read-only and stalled. A single remaining `2-of-3` endpoint is insufficient, not “dead.” |

Actual Chromium gates use isolated browser profiles and real non-extractable WebCrypto
keys. They prove browser/profile isolation and protocol behavior, not that three
people, organizations, or physical devices independently control the keys. They also
do not isolate signing authority from compromised same-origin JavaScript: a persisted
non-extractable `CryptoKey` can still sign without being exported.

## What MortalOS does not claim

- It is not a general-purpose operating system or an autonomous-agent runtime.
- A relay, room link, browser animation, GPT answer, process exit, or silence never
  establishes protocol validity or global death.
- A single-browser logical quorum is one physical failure domain.
- Same-host WebRTC proves a direct participant data plane, not physical independence
  or connectivity through arbitrary NAT/firewall combinations. This P0 deliberately
  configures no STUN or TURN service.
- A loaded peer pair surviving origin loss does not yet prove that a new peer can
  obtain and authenticate the application bundle without a domain or origin.
- Finite evidence cannot prove that every hidden copy worldwide is gone.
- Chromium and Firefox durable-key paths pass actual-engine candidate gates. WebKit
  is routed by a runtime capability probe that requires sign/verify through the
  canonical 65,536-byte message ceiling, not merely key generation. Current Windows
  and Ubuntu Playwright 26.5 builds are verifier-only for different measured reasons;
  any future full signer-capable build must run the complete S2/S4 custody matrix.

## Run locally

Requirements: Node.js 22.5 or later. Windows and Ubuntu are release-gated; current
Chromium is required for browser acceptance.

```bash
npm ci
npx playwright install chromium firefox webkit
npm test
npm run verify:lab
npm run dev:lab
```

Open the printed URL in two isolated browser profiles. The local server supplies a
deterministic relay and model fixture, so the proof requires no Cloudflare or OpenAI
credential.

Focused gates:

```bash
npm run test:i18n
npm run test:state
npm run test:transport
npm run verify:webrtc-participants
npm run test:relay
npm run test:multi-browser
npm run test:durable-quorum
npm run test:distributed-counter
npm run test:security-fuzz
npm run test:sdk
npm run test:capsule
npm run test:continuity
npm run verify:continuity-browser
npm run test:browser-capabilities
npm run test:browser-parity
npm run verify:security-boundaries
npm run verify:persistent-handoff
npm run verify:ux
npm run verify:state
npm run verify:transport
npm run verify:cost-controls
npm run test:chromium
npm run test:coverage
```

## Public continuity API and CLI

The default `@mortal-os/core` export remains verification-only. Product code opts
into authority use explicitly:

```js
import {
  continuity,
  createContinuityAuthority
} from "@mortal-os/core/continuity";

const authority = await createContinuityAuthority();
const created = await continuity.create({ authority, resourceBytes });
const verified = continuity.inspect({ capsuleBytes: created.capsule_bytes });
```

The CLI exposes the same lifecycle as machine-readable commands:

```text
mortalos create --resource FILE --authority A.key --out A.mosc --copies copies-a
mortalos handoff request --capsule A.mosc --authority B.key --out request.json
mortalos handoff propose --capsule A.mosc --authority A.key --request request.json --out proposal.json
mortalos handoff accept --capsule A.mosc --authority B.key --proposal proposal.json --out B.mosc --copies copies-b
mortalos recover --authority B.key --expected-head HASH --out-resource recovered.bin --copy COPY --copy COPY
mortalos continue --authority B.key --capsule B.mosc --expected-head HASH --resource recovered.bin --out C.mosc --copies copies-c
```

CLI private keys remain endpoint-local authority files. Capsules, handoff messages,
copy artifacts, SDK results, and CLI JSON never contain that private material.
Each authority file is serialized by an exclusive sibling lock before its sign-once
journal is flushed and atomically replaced. A conflicting second process fails
closed; a lock left by a crashed signer is never guessed stale and requires explicit
operator recovery. Persisted authority and custodian records use exact-key validation,
the sign-once journal is normalized into a null-prototype own-data record and read
with captured JSON/object operations, and public custodian objects are rebuilt from
`key_id` and `public_key` only.

`mortalos custody verify` and `recoverContinuityCapsuleQuorum` remain compatibility
tools for raw canonical Capsule integrity; byte-identical raw inputs do not prove
independent copies. Product recovery uses signed `mortalos-continuity-copy/1`
envelopes through `mortalos recover` or `recoverContinuityCopyQuorum`, and requires
distinct copy and logical-provider identities.

`verify:lab` includes the strict 20-run two-persistent-profile handoff gate. The
focused command above runs that gate alone; it refuses a configured run count below
20. Its first run also measures two simultaneously active browsers for 12 seconds
against the production-shared relay policy and requires zero local `429` responses.

The fixed property corpus contains exactly 10,000 cases from seed `1297044052`.
The expected H2 trace digest remains:

```text
19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399
```

## Hostless runtime and trust boundary

A fixed backend MUST NOT define identity, head, membership, quorum, scheduling, or
continuity. A bootstrap origin, signaling rendezvous, STUN server, TURN relay, or
storage provider may help peers discover or reach each other, but it must remain
replaceable and unable to make a protocol decision. The P0 verifier uses manual
WebRTC offer/answer exchange and an empty ICE-server list so that the direct path is
observable without hiding a server dependency.

```text
Participant A key + kernel       Participant B key + kernel
             │ signed canonical public messages │
             └──────── WebRTC DataChannel ───────┘
                          untrusted delivery
                                  │
                                  ▼
R1 canonical operation/result bytes
        │
        ▼
portable kernel → accepted lineage or stable rejection

optional: static origin / manual or replaceable signaling / STUN / TURN
          distribution and reachability only; never protocol authority
```

Each endpoint verifies locally. No transport can return `accepted: true`, choose a
head, sign, resolve a fork, or declare death. The existing Cloudflare relay remains
a compatibility transport and public-demonstration convenience, not part of the
hostless protocol requirement. Durable Participant storage is consent-
gated and uses one atomic versioned document for a non-extractable key, canonical
public evidence, state references, sign-once journal, pending recovery, and explicit
authority policy. Restore replays evidence instead of trusting cached verdicts.
Ephemeral Demo creates no durable browser storage.

The journal and counter CAS prevent equivocation by conforming concurrent endpoints;
they are not an XSS-resistant signer boundary. Strong sign-once custody remains HOLD
until key use and monotonic state move to a separately isolated origin/service or
hardware-backed authorization domain.

The current source sequence is:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → direct WebRTC participant channel → local validation → succession after optional origin loss → three-endpoint repair`

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

Every protocol or package SHA must pass local tests, immutable independent review,
exact-head CI, expected-head merge, and post-merge CI. Any optional website deployment
adds an exact-main deployment and public manifest/asset/header readback gate; failure
to deploy the website does not invalidate already distributed participant state or
make the domain authoritative. An old green run does not cover a new SHA.

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
- [North Star implementation SSOT](docs/IMPLEMENTATION_PLAN.md)
- [Current claim matrix](docs/CLAIM_MATRIX.md)
- [Endpoint-neutral architecture](docs/ACCESS_ARCHITECTURE.md)
- [Browser participant compatibility](docs/BROWSER_PARTICIPANT_COMPATIBILITY.md)
- [Crash-safe durable quorum](docs/DURABLE_QUORUM.md)
- [Distributed counter-authority ADR](docs/DISTRIBUTED_COUNTER_AUTHORITY_ADR.md)
- [Protocol](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Traceability](docs/TRACEABILITY.md)
- [Historical documentation archive](docs/archive/README.md)
- [Agent collaboration and merge protocol](docs/AGENT_COLLABORATION.md)

MortalOS is licensed under the [Apache License 2.0](LICENSE). Direct dependency
licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
