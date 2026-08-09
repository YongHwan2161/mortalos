# Lineage-bound placement convergence

Status: **SOURCE + LOCAL EVIDENCE PASS — CERTIFICATE-GATED REPAIR; EXACT-SHA PROMOTION EXTERNAL; PHYSICAL INDEPENDENCE HOLD**

Last synchronized: **2026-08-10 KST**

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
current Lab/browser harness does not yet gossip or supply such evidence at execution.
A historically valid generation that is no longer the Capsule's latest placement
commit fails as `superseded-generation-plan` and cannot derive a current plan.

`mortalos-lineage-placement-convergence/1` deterministically deduplicates and orders
verified candidates. A correctly linked chain selects its highest generation.
Generation `N` requires exactly `N - 1` authenticated placement transitions before
its commit plus an exact latest predecessor ID/head match. Creation derives `N` from
the restored canonical prior-generation bytes; commit and verification rederive it
from signed Capsule history. The candidate set must begin at generation 1, and a
Capsule that already contains a placement commit cannot reset to generation 1.
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
| `node --test test/lineage-placement.test.mjs` | Actual signed storage fixtures; exact offer-witness-roster binding; consumer-selected bounded window; conditional late-proof conflict with supplied fresh response/current placement evidence; A→B key non-transfer; committed derived placement action plan; two fresh processes reproduce identical bytes; 1,000 partition/heal events; stale A rejects |
| adversarial cases in the same file | Repeated/skipped/noncanonical/overflowing generation numbers reject in commit or verification; an unsafe signer creates two independently valid same-parent generations, both verify, and convergence halts as `generation-fork` |
| `node scripts/verify-confidential-placement-chromium.mjs` | Native File, WebRTC ciphertext shards and liveness challenge, four observer browser processes, actual 5,000 ms local window, 3-of-4 certificate, A commit, sign-once A→B handoff, real A close, B repair/commit, byte-identical convergence, corrupt-shard rejection, zero post-cut requests |
| `npm run verify:security-boundaries` | Async commit owns caller bytes and resolves authority before its first suspension |
| `npm run test:sdk` and `npm run verify:sdk-package` | Public placement subpath verifies/converges without exporting signing authority |
| `npm test` | A pre-review source baseline completed the then-current ordered suite in 4,263.6s; exact-SHA CI is the current-revision authority |

## Explicit nonclaims

- Raw `unavailable_provider_ids` remains available only to the lower-level local
  diagnostic evaluator. The lineage generation API rejects it and derives outage
  input solely from verified consumer challenges and offer-rostered observation certificates.
- Signed observer-local durations are not an absolute or global proof of death.
- The provider did not pre-agree the response window. A certificate is not breach,
  lease-termination, penalty, or settlement evidence.
- Fork halt is safety, not liveness or automatic Byzantine consensus.
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
The next P0 is **failure-precommitted liveness policy and effect-time repair
execution**: provider-signed lease semantics, independent possession response, and
exactly-once current-evidence reconciliation. Lineage-governed admission and
failure-domain accounting with explicit trust roots follows. Threshold keys must be
selected from a membership epoch committed before failure, and self-asserted device,
network, region, account, credential, or administrator labels must not count as independent. Admission and
diversity claims need evidence rooted outside the admitted actor. Discovery/NAT
remains a replaceable carrier problem, not membership authority.
