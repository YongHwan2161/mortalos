# Lineage-bound placement convergence

Status: **SOURCE + CURRENT SOURCE/RUNTIME/TEST COMPLETE-SUITE PASS; POST-RUN DOCS STATIC PASS; EXACT-SHA PENDING; PHYSICAL INDEPENDENCE HOLD**

Last synchronized: **2026-08-21 KST**

## Why this layer exists

A possession receipt proves that a provider answered one exact challenge under one
lease. A local journal proves what one controller last counted. Neither proves
which of two otherwise legitimate controllers may propose the next repair plan, or
which plan an executor may safely act on.

MortalOS therefore serializes placement authority through the organism's existing
Continuity lineage. It does not introduce a consensus server, Cloudflare service,
domain dependency, or private-key transfer.

## Canonical documents

`mortalos-lineage-placement-generation/1` binds the organism and exact lineage
parent; confidential manifest; generation and prior commit; quorum, target, and
freshness policy; complete public placement evidence; canonical liveness failure
certificates and responses; re-derived liveness cases and proved receipt set; and
certificate-bound repair intents. Its domain-separated ID covers every field except itself.
A verifier decodes every nested document, reruns the existing placement evaluator,
and rejects any summary that does not exactly match that evidence.

`mortalos-lineage-placement-commit/1` binds the generation ID to an existing
`state-transition` Pulse. The transition ID contains the generation hash; the Pulse
binds its parent, organism, state, current custodians, and event payload. Only the
current Continuity descriptor's required quorum can authorize an accepted commit,
and the existing sign-once tuple rejects a second different transition for the same
parent.

`mortalos-lineage-placement-action-plan/1` is a deterministic derived-plan record
created by `deriveCommittedPlacementActionPlan` only after the generation, commit,
and Capsule lineage verify. `planned_repair_actions` carry commit, generation,
manifest, shard, workload, liveness challenge, and failure-certificate bindings;
`verified_placement_receipt_ids` include only the committed proved set. The record
sets `non_capability: true` and `requires_executor_reverification: true`. It is
public, forgeable JSON, not a capability or authority token. An executor must reverify the original
Capsule, generation, commit, current placement evidence, and applicable liveness
evidence before performing effects. The API conditionally rejects newly supplied
late provider responses that conflict with actual current receipt chains; the
the Node batch can now supply canonical response payload bytes from a bounded transport
range, while the connected Lab/browser path does not yet use that adapter at execution.
A historically valid generation that is no longer the Capsule's latest placement
commit fails as `superseded-generation-plan` and cannot derive a current plan.

`mortalos-lineage-placement-convergence/1` deterministically deduplicates and orders
verified candidates. A correctly linked chain selects its highest generation.
Generation `N` requires exactly `N - 1` authenticated placement transitions before
its commit plus an exact latest predecessor ID/head match. Creation derives `N` from
the restored canonical prior-generation bytes; commit and verification rederive it
from signed Capsule history. The candidate set must begin at generation 1, and a
Capsule that already contains a placement commit cannot reset to generation 1.
Every supplied verified Capsule also contributes its authenticated latest placement
transition tip. That exact transition ID/head must be represented by the supplied
candidate chain. Historical prefix candidates remain valid, but presenting a
Capsule that already authenticates generation 3 while supplying only generation 1
and 2 candidates returns `halted / incomplete-chain`; convergence cannot select the
historical generation 2 as current.
Repeated, decremented, skipped, or overflowing numbering, different valid commits at
one generation, an incomplete or broken prior link, or different organisms return
`halted`; the algorithm never invents a winner.

## A-to-B vertical

1. Browser A selects the actual 98,317-byte file and creates a non-extractable
   continuity authority.
2. Three providers receive only S4 ciphertext shards over direct WebRTC and sign
   exact storage receipts.
3. Provider 0 receives a predecessor-linked liveness challenge over WebRTC and
   exits. Four identities from its signed offer's witness roster receive the same challenge in
   separate browser processes; three sign the exact bounded local no-response
   window selected by the lease consumer. A commits that certificate in generation 1; only that verified commit
   qualifies derivation of the shard 0 repair plan and its two billable proofs.
4. A approves B through the sign-once custody handoff. No private key transfers,
   and A is actually closed.
5. B reconstructs/decrypts exact bytes. A separately generated
   successor-authorized operational signer obtains a new provider and leases, and B
   commits generation 2 linked to generation 1 and its commit head. The operational
   signer is not inferred to be B's Continuity custody identity.
6. Generation 2 has three distinct proved providers and no repair action. Reordered
   or duplicated evidence converges to identical bytes after origin/relay cut.

## Executable evidence

| Gate | Contract |
| --- | --- |
| `node --test test/lineage-placement.test.mjs` | Actual signed storage fixtures; exact provider-signed offer/lease-bound policy and consumer policy-bound challenge; valid legacy `/1` certificate rejected as repair authority; conditional late-proof conflict with supplied fresh response/current placement evidence; A→B key non-transfer; committed derived placement action plan; fresh-process convergence; stale A rejects |
| adversarial cases in the same file | Repeated/skipped/noncanonical/overflowing generation numbers reject in commit or verification; a supplied Capsule tip omitted from the candidate chain halts as `incomplete-chain`; historical prefixes, ordering, and duplicates remain deterministic; an unsafe signer creates two independently valid same-parent generations, both verify, and convergence halts as `generation-fork` |
| `node scripts/verify-confidential-placement-chromium.mjs` | Native File, WebRTC ciphertext shards and liveness challenge, four observer browser processes, actual 5,000 ms local window, 3-of-4 certificate, A commit, sign-once A→B handoff, real A close, B repair/commit, byte-identical convergence, corrupt-shard rejection, zero post-cut requests |
| `npm run verify:security-boundaries` | Async commit owns caller bytes and resolves authority before its first suspension |
| `npm run test:sdk` and `npm run verify:sdk-package` | Public placement subpath verifies/converges without exporting signing authority |
| focused WebRTC remediation | Node `24/24` in `31,241ms` and actual Chromium in `50,086ms`; combined 512-message/8,388,608-raw-byte transcript, duplicate non-consumption, outbound/inbound atomicity, virtual-transport byte ceiling, hostile `Error`/`Symbol.hasInstance` containment, and remote-channel cleanup that closes a still-live peer with each native close capability invoked at most once PASS. Relay base64 estimation may reject slightly earlier, so byte-identical edge accounting is not claimed. |
| `npm test` | The current source/runtime/test ordered chain was invoked at `2026-08-21T20:48:19.650+09:00` and emitted final `verify:s4` PASS at `2026-08-21T23:11:26.544+09:00`; the wrapper did not emit an exact wall-time marker. Post-run evidence docs have separate static gates; exact-SHA CI remains the publication authority. |

## Explicit nonclaims

- Raw `unavailable_provider_ids` remains available only to the lower-level local
  diagnostic evaluator. The lineage generation API rejects it and derives outage
  input solely from verified consumer challenges and offer-rostered observation certificates.
- Signed observer-local durations are not an absolute or global proof of death.
- The provider signs and the consumer accepts the exact response window. A certificate
  still is not death, breach, lease-termination, penalty, or settlement evidence.
- Fork halt is safety, not liveness or automatic Byzantine consensus.
- Currentness is relative to the supplied authenticated Capsules. If a caller hides a
  newer Capsule entirely, convergence cannot infer unseen global state.
- Manual same-host ICE is not arbitrary NAT reachability or decentralized discovery.
- One-PC browser/process isolation is not distinct hardware, account, region,
  credential, administrator, or failure-domain evidence.
- Non-extractable keys prevent export, not same-origin use.
- Receipts do not prove honest physical metering, economic value, or Sybil resistance.
- The current Lab/browser harness passes empty late-response and current-placement
  arrays to the conditional reconciliation surface; it is not an execution-time
  gossip/revalidation implementation.
- The successor-authorized operational signer is separate from the Continuity
  custody identity; the test does not prove a cryptographic delegation binding.
- A derived action plan is forgeable data. It cannot authorize effects without
  executor-side revalidation of the original signed and committed evidence.

## Next root priority

The liveness layer is implemented locally; see
[Quorum-observed liveness and repair certificates](QUORUM_LIVENESS_AND_REPAIR_CERTIFICATES.md).
The policy/window, sampled provider response, and one-shard effect-time executor
slices are implemented. The executor re-verifies original signed evidence, uses a
replacement-independent durable slot claim and replacement-bound provider
idempotency key, and never consumes the public plan as authority. The internal
single-result coordinator rederives the signed result, claims a separate completion
slot, and commits exactly one proved successor generation through a private idempotent
Continuity session. The internal batch now schedules the complete repair-intent set
against fresh private evidence and commits one successor. A provider-domain adapter
now restores the same canonical result after sequential process restart with zero
underlying provider calls. No-replace claims now exclude cross-process first provider
and Continuity execution. Proof-import recovery fills an unresolved result only after
the outer executor verifies an exact signed placement or successor Capsule/commit;
missing proof remains fail-closed. The Chromium Lab now feeds the range adapter from an
actual origin-cut DataChannel and proves late-response/disconnect zero-call behavior.
The `10,000`-seed production evidence-session corpus is now byte-identical in Node,
fresh process, and bundled Chromium. Lineage-governed logical admission is now
focused PASS: threshold keys are selected deterministically from a custody-signed
membership epoch committed before failure; aliases collapse under one operator root,
one logical domain contributes at most one observer, adjacent epochs preserve quorum
intersection, and valid siblings halt. The exact epoch remains a content-addressed
generation sidecar referenced by compact admitted policy `/2`. Self-asserted device,
network, region, account, credential, or administrator labels are still not physical
independence evidence. One non-authoritative plan can now precommit the full observer
roster, per-key nonce, bounded logical window, and declared vantage digests; every
observer signs the exact plan and live-probe transcript, and the view requires the
complete roster. This removes conforming-flow post-hoc selection but only attributes
the declarations and locally supplied times. The next P0 is externally administered
issuers, at least two separately controlled observer keys executing that one published
plan, and measured multi-host topology using the now policy-locked process-separated
signer service.
Discovery/NAT remains a carrier problem, not membership authority.
