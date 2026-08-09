# MortalOS

> **Create once. Continue elsewhere.**

MortalOS is an endpoint-neutral lifecycle protocol and falsification Lab for digital
resources that must survive process and key rotation without trusting a browser,
relay, host, UI, or model as the source of truth.

- Live protocol Lab: [mortal-os.com](https://mortal-os.com/)
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

Source documents do not self-promote the revision that contains them. Governance
and deployment status are exact-SHA external facts read from the PR, required
checks, merge record, post-merge workflows, and deployed asset manifest.

## Current development focus

The real-file product vertical now exists in one core path: endpoint A selects a
bounded runtime file, endpoint B accepts custody with a distinct key, A exits, and B
recovers exact bytes from two of three current-custodian-signed copy envelopes before committing the next
transition. Node uses separate endpoint processes, Chromium uses separate persistent
browser endpoints and the built Lab, and a clean `npm pack` consumer runs the matching
CLI without repository-relative imports.

MortalOS includes a portable
[signed bounded resource contract](docs/RESOURCE_CONTRACT.md): a strict provider
offer defines finite storage, bandwidth, compute, and time; provider and consumer
mutually sign one contained lease; the offer's declared Byzantine witness quorum
must gossip that exact consumption before activation; both parties sign chained
cumulative usage; either lease party can revoke. One offer is single-use, so two
different valid leases or one witness double-sign halt as equivocation instead of
silently overcommitting capacity. Lease-bound
challenge/receipt chains now prove bounded storage, bandwidth, and deterministic
compute execution by the leased participant; they do not by themselves prove
honest metering, physical provider/witness independence, or independent
administration.

This source revision composes those contracts with a real direct participant data
plane. An actual runtime-selected file and every offer/lease/challenge/receipt
artifact cross ordered WebRTC DataChannels after origin and relay access are cut.
Only exact active storage execution receipts count as placement. One provider
process loss degrades three copies to two; a distinct provider/new lease repairs the
target, and after consumer A exits, B recovers exact bytes from two valid peer copies
while rejecting one corrupt readback. The composed confidential controller encrypts
the native file as an S4 package for B, sends three distinct ciphertext shards to
providers, excludes stale receipts at max age + 1 ms, restores a public-evidence
journal fail-closed, and makes B authorize renewed placement under new operational
lease keys after A exits. Those successor-authorized operational keys are not
inferred to be, or cryptographically bound to, B's Continuity custody identity.
Placement generations now bind that evidence and repair intent into the organism's
Continuity lineage. The current descriptor's required quorum can commit a generation;
the resulting placement action plan is public, forgeable derived data rather
than authority, so an executor must reverify the original committed and current
evidence. The A→B sign-once handoff transfers no key, identical evidence converges
byte-identically, and valid siblings halt instead of selecting a winner. Raw local
unavailability no longer qualifies a lineage repair plan by itself: 3-of-4 keys
from the provider-signed offer's fixed witness roster sign one predecessor-linked,
consumer-selected bounded-duration non-response
challenge with no global clock. The certificate is committed into the generation.
It is a continuity-scheduling transcript, not proof of provider death, breach,
lease termination, penalty, or settlement; the response window is not provider-agreed.
When a caller supplies a late verified provider receipt and its current placement
chain, the core conditionally halts the derived plan. The current Lab/browser harness
does not yet gossip or reconcile late evidence at effect execution. This is source plus local evidence; it does
not self-assert stage promotion, a globally live participant network, arbitrary
Internet reachability, Sybil resistance, or physical independence. See
[P2P placement and repair](docs/P2P_PLACEMENT_AND_REPAIR.md),
[confidential P2P placement controller](docs/CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md),
[lineage placement convergence](docs/LINEAGE_PLACEMENT_CONVERGENCE.md),
[quorum liveness and repair certificates](docs/QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md), and the
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
| Resource execution — bounded contribution and verified work | Canonical offers, mutual single-use leases, threshold gossip, chained usage, and revocation are merged with lease-bound storage, bandwidth, and deterministic-compute challenge receipts. Actual child-process loss and new-lease reassignment pass, but this is not proof of honest meters or independent hardware, accounts, witnesses, or administrators. |
| Confidential lineage-bound P2P placement source | A native 98,317-byte file becomes an S4 package for B and three distinct 2-of-3 ciphertext shards cross direct DataChannels. Fresh receipts and a crash-safe journal gate placement. Three of four keys from the provider-signed offer's witness roster sign a sequence/predecessor-bound, consumer-window non-response certificate after the challenge crosses WebRTC; no global clock or raw timeout alone qualifies the derived repair plan. This is not provider death, breach, termination, penalty, or settlement evidence. A commits the degraded generation, hands controller custody to B without a key transfer, exits, and B repairs under successor-authorized leases and commits the linked successor. Returned frames are detached and immutable; a failed DataChannel send commits no local frame or dedupe state and remains retryable. The direct carrier uses one private transcript map plus captured collection, iterator, scheduler, DataChannel, and peer-connection capabilities; Node and actual Chromium poison corpora reject ambient prototype replacement. Rogue consumers, stale prior generations, repeated/skipped generation numbers, realm drift, challenge forks, response forks, and sibling generation forks halt. Exact-SHA governance is external evidence; stage promotion, Sybil resistance, arbitrary NAT reachability, and physical independence remain HOLD. |
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
- Finite evidence cannot prove that every hidden copy worldwide is gone.
- Chromium and Firefox durable-key paths pass actual-engine source-revision gates. WebKit
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
npm run test:p2p-placement
npm run test:relay
npm run test:multi-browser
npm run test:durable-quorum
npm run test:distributed-counter
npm run test:protocol-profile
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

## Public resource-contract API

The default SDK exposes verification and deterministic explicit-time evaluation,
including lease-bound execution evidence.
Creating signed artifacts uses the explicit authority-free drafting subpath; the
caller keeps its signer outside the core:

```js
import {
  prepareResourceConsumptionWitness,
  prepareResourceOffer,
  finalizeResourceOffer
} from "@mortal-os/core/resource-contract";

const draft = prepareResourceOffer(offerBody);
const provider_signature = await endpointSigner(draft.provider_signing_message);
const offerBytes = finalizeResourceOffer({
  body: draft.body,
  provider_signature
});
```

The same prepare/finalize/verify pattern applies to mutual leases, consumption
witnesses, chained usage receipts, revocations, consumer-signed execution
challenges, and provider/consumer-signed execution receipts. Storage receipts
verify a challenged Merkle leaf, bandwidth receipts verify an unpredictable
payload round trip, and compute receipts reproduce a bounded deterministic hash
chain. Every execution binds one exact usage receipt and predecessor; the dedicated
execution evaluator rejects missing or cross-lease evidence. A witness draft exposes a
sign-once request whose tuple is the offer ID and whose message binds the exact lease
ID; the existing endpoint-local authority can sign it without moving private key
material into the resource core. Bounded self-contained announcements and
placement artifacts can travel over relay control or direct WebRTC, but receivers
always re-verify them. The core receives
tagged public signatures, never the private signer, ambient clock, transport,
scheduler, or storage capability.

The focused local gate executes all three workload classes in an actual child
provider process, terminates it, and permits reassignment only through a new signed
offer and lease while preserving the immutable workload ID. This is process-level
evidence, not a claim of separate hardware, account, region, administrator, or
credential custody.

The source-revision `npm run test:p2p-placement` gate additionally sends an actual file,
offers, leases, witness announcements, challenge, usage, and execution evidence over
direct DataChannels with `iceServers: []`. After bundle load, HTTP and relay access
are denied. It proves same-host browser/process behavior only; manual ICE does not
establish arbitrary Internet or NAT reachability.

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
Endpoint key custody
        │ signed canonical public messages and resource bytes
        ▼
replaceable carrier: direct WebRTC or untrusted relay
        │ canonical bytes; no verdict authority
        ▼
resource/placement and lifecycle validators
        │
        ▼
portable kernel → accepted lineage or stable rejection
```

Each endpoint verifies locally. The relay cannot return `accepted: true`, choose a
head, sign, resolve a fork, or declare death. Durable Participant storage is consent-
gated and uses one atomic versioned document for a non-extractable key, canonical
public evidence, state references, sign-once journal, pending recovery, and explicit
authority policy. Restore replays evidence instead of trusting cached verdicts.
Ephemeral Demo creates no durable browser storage.

The journal and counter CAS prevent equivocation by conforming concurrent endpoints;
they are not an XSS-resistant signer boundary. Strong sign-once custody remains HOLD
until key use and monotonic state move to a separately isolated origin/service or
hardware-backed authorization domain.

The governed total gate order remains:

`R1-C wire-only Lab → deterministic state → durable endpoint → transport-neutral runtime → Durable Object relay → two-browser succession → three-endpoint 2-of-3 repair`

This source revision extends that foundation through:

`portable kernel → S4 ciphertext shards → signed bounded lease → direct peer transfer → fresh receipt-gated placement → crash recovery → successor-authorized operational repair → peer recovery`

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
- [North Star implementation SSOT](docs/IMPLEMENTATION_PLAN.md)
- [Current claim matrix](docs/CLAIM_MATRIX.md)
- [P2P storage placement and repair](docs/P2P_PLACEMENT_AND_REPAIR.md)
- [Confidential P2P placement controller](docs/CONFIDENTIAL_P2P_PLACEMENT_CONTROLLER.md)
- [Lineage-bound placement convergence](docs/LINEAGE_PLACEMENT_CONVERGENCE.md)
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
