# MortalOS North Star priority execution roadmap

Status: **EXECUTION COMPANION — NOT A CLAIM OR STAGE SSOT**

Snapshot base: `9b418ee35559c488528bc55ad433708ce94499d8`
(`main`, 2026-08-31 KST)

Authority remains [the North Star implementation SSOT](IMPLEMENTATION_PLAN.md).
That document alone defines current direction, stage order, and promotion rules.
This roadmap turns its remaining gaps into smaller execution gates. It must be
refreshed against live source, issues, checks, receipts, and deployment evidence
before any gate is executed.

## 1. Re-audited position

| Evidence layer | Current verified position | Boundary that remains |
| --- | --- | --- |
| Product vertical | Release `a6cfb657…` proves a real bounded file can move A to B, recover 2-of-3 after A exits, and continue the same lineage | The promoted run is not independent-host or arbitrary-NAT evidence |
| Status synchronization | PR #63 is squash-merged as this snapshot base `9b418ee…` | Its exact-main Verify `33350808561/1` was still running at this audit: `browser-parity` passed while `protocol` remained in progress; no post-merge release result is inferred |
| WebRTC reachability | The actual Chromium carrier, canonical manual signaling, transcript ceilings, close semantics, and same-host origin-cut tests pass in the promoted release | Production construction still fixes `iceServers: []`; STUN, TURN fallback, forced relay, arbitrary NAT, and Internet reachability remain unproved |
| Admission and observation | Policy-locked role services, membership-bound plans, complete-roster activation, observer attestation, public-chain replay, and role-source receipts are implemented locally | Current executable evidence is one-PC/loopback. Signed declarations, TLS keys, profiles, or process separation do not prove administrative or physical independence |
| Stage evidence | Receipts exist only for S1-S4. Issues [#33](https://github.com/YongHwan2161/mortalos/issues/33) through [#37](https://github.com/YongHwan2161/mortalos/issues/37) remain open | S5-S8 receipts are absent; revised S4, S6 physical independence, S7 production topology, and S8 strong custody are HOLD |
| Browser custody | Chromium and Firefox full paths and WebKit verifier-only capability detection are implemented | Same-origin code may still invoke a non-extractable key; WebKit full signing and isolated signer/counter custody remain HOLD |

The critical distinction is:

> A network path can be reachable without being independently operated.

A same-administrator STUN/TURN success may close only the reachability gate. It
must never promote distinct provider, administrator, credential, host, network,
power, or physical failure-domain claims.

## 2. Priority map

```text
R0 exact-main release closeout
  -> R1 bounded ICE configuration contract
  -> R2 measured NAT and TURN reachability pilot
  -> R3 separately administered admitted topology
  -> R4 100 induced failures plus immutable seven-day burn-in
  -> R5 exact S7 receipt and governed promotion

After R4: S5/S6 receipt debt -> isolated signer/counter custody -> S4/S8 promotion
          -> contribution UX, capacity/SLA, incentives, broader discovery
```

R0-R5 are the critical path. Later work must not displace it. Receipt preparation
may run in parallel only when it does not change a claim, topology, credential, or
release candidate.

## 3. P0 release gate — R0 exact-main closeout

Objective: close the automatically started release lineage for this snapshot before
using it as the base of another runtime candidate.

Pass gate:

1. Verify `33350808561/1` must complete successfully on exact head `9b418ee…`.
2. `protocol`, `browser-parity`, and `Promote exact release candidate` must all
   succeed with no disqualifying annotation or skipped required gate.
3. The exact candidate artifact must pass the repository verifier.
4. Its `workflow_run` Deploy must bind the same Verify run and head and complete
   successfully without manual substitution.
5. Two no-cache public-manifest reads must be byte-identical; the manifest source
   must name `9b418ee…`, and every declared public asset must match its SHA-256.

HOLD on cancellation, failure, moving `main`, missing artifact, ambiguous workflow
lineage, changed public bytes, or incomplete annotations. Monitoring is read-only;
this gate does not authorize a manual rerun or deployment.

## 4. P0 implementation gate — R1 bounded ICE configuration

Objective: make real-network reachability configurable without making STUN, TURN,
signaling, or relay infrastructure a validity authority.

Smallest focused implementation:

- replace the two hard-coded production `iceServers: []` constructions with one
  immutable, owned, bounded RTC configuration capability;
- retain the empty-server default so existing direct/same-host behavior is
  byte-compatible;
- support only the deliberately selected direct-or-`relay` ICE transport policy so
  a forced-TURN evidence profile cannot silently fall back to a direct candidate;
- accept only the deliberately supported STUN/TURN URL and credential shapes, with
  exact count and byte ceilings and fail-closed malformed/max+1 cases;
- keep TURN credentials runtime-local and absent from canonical protocol evidence,
  public receipts, diagnostics, URLs, and committed fixtures;
- preserve canonical manual signaling, transcript budgets, send-before-commit
  atomicity, cleanup idempotence, and transport-non-authority boundaries;
- add focused Node and actual-browser tests for default direct mode, configured
  mode, caller mutation, malformed/oversized configuration, and credential
  non-disclosure.

Pass gate: focused transport/security/Lab tests and the complete exact-head suite
pass without weakening any current claim boundary. This gate proves only a safe
adapter; it proves neither NAT traversal nor independence.

## 5. P0 evidence gate — R2 NAT and TURN reachability pilot

Objective: determine whether the exact product journey survives representative
network paths before paying the operational cost of the independence burn-in.

Pre-register four profiles:

1. same-LAN direct baseline;
2. distinct NATs with a server-reflexive STUN path;
3. forced TURN relay with direct candidates disabled;
4. connection loss followed by one bounded reconnect/fallback attempt.

For every profile, run at least 20 consecutive fresh A-to-B journeys using a runtime
file. Record only sanitized path class (`host`, `srflx`, or `relay`), timing, bounded
failure code, exact source/resource/head digests, and result. Do not persist candidate
strings, IP addresses, TURN credentials, or file plaintext.

Pass gate:

- 20/20 journeys per profile finish the same bounded user scenario;
- A is gone before B recovers and commits the successor;
- exact resource bytes, organism ID, lineage head, and Capsule bindings verify;
- one corrupt copy is rejected and below quorum fails closed;
- no file plaintext or complete encoded file appears in signaling, HTTP relay, TURN
  logs, or public evidence;
- no duplicate provider or Continuity effect is observed during reconnect/fallback.

Any success here is labeled **reachability evidence under one operating domain**.
It does not satisfy S7.

## 6. P0 operations gate — R3 separately administered topology

Objective: run the already implemented admission and observer ceremony with custody
and topology facts rooted outside one operator.

Required topology and custody:

- distinct provider, host, administrator, and credential domains for every S7
  participant counted as independent;
- at least three independently administered counter/provider replicas and the exact
  complete admitted observer roster required by the selected membership epoch;
- host-local issuer, subject, observer, TLS, and possession credentials that never
  pass through the coordinator;
- distinct networks and failure domains recorded from externally auditable provider
  or administrator evidence, not inferred from process IDs, browser profiles,
  declared labels, keys, certificates, or socket addresses alone;
- one frozen ceremony, deployment plan, complete acceptance roster, activation,
  membership binding, observation journal, attestation set, compact view, public
  chain, role-source aggregate, source verdict, and all-role-key closure.

Pass gate: fresh verifier processes replay every exact public sidecar; missing,
extra, substituted, conflicting, or reordered evidence fails closed. The topology
assessment must keep every non-observed dimension `unproven`.

## 7. P0 resilience gate — R4 induced failures and burn-in

Objective: satisfy the production-only S7 criterion rather than extrapolating it
from local replicas or a short pilot.

Pre-register a 100-trial matrix covering at minimum:

- provider/process termination before and after result publication;
- observer loss, signer loss, and network partition/heal;
- counter-replica loss, restart, repair, and competing coordinators;
- TURN or signaling loss after transport establishment;
- A loss before handoff, after handoff, and during B recovery;
- one corrupt shard/copy, below-quorum loss, and stale/forked evidence;
- crash recovery from an exact durable result with the underlying capability absent.

Then operate the unchanged candidate for seven continuous days with append-only,
content-addressed evidence. Configuration, credentials, binaries, manifests, and
trial definitions are frozen before trial 1; any change starts a new candidate and
resets the burn-in.

Pass gate:

- all 100 pre-registered trials produce their expected deterministic PASS or
  fail-closed outcome;
- recovery bytes are exact and the continued lineage is unique;
- below quorum never progresses;
- duplicate provider, counter-allocation, accounting, and Continuity effects are
  all zero;
- the seven-day evidence chain has no gap, replacement, or mutable overwrite;
- independent reviewers can reproduce the aggregate from public, secret-free
  evidence.

## 8. P0 promotion gate — R5 S7 receipt

Objective: convert the exact R3/R4 candidate into a governed claim rather than a
report.

Required sequence:

1. create `evidence/stages/s7-failure-domains.json` from the immutable candidate and
   exact operational evidence;
2. run locked install, all focused gates, full suite, inventory, and receipt
   verification on one immutable SHA;
3. obtain the logical reviewer receipt, GitHub App exact-head attestation, and native
   latest-head approval as three non-substitutable gates;
4. use expected-head merge;
5. verify the exact new `main`, candidate artifact, automatic Deploy, and public
   readback before changing the S7 claim state.

Until all five complete, issue #36 remains open and physical/administrative
independence remains HOLD.

## 9. P1 evidence and distribution debt

Start only after R4 is stable enough that it cannot be displaced by documentation or
distribution work.

- S5: create `evidence/stages/s5-sdk-cli.json`; separately decide whether public
  package-registry publication is desired. A receipt does not imply publication, and
  publication does not imply the receipt.
- S6: create `evidence/stages/s6-continuity-capsule.json` against the exact integrated
  product journey and R3/R4 topology evidence.
- S4: do not reissue `evidence/stages/s4-confidentiality.json` until signer/counter
  custody satisfies its separate-origin/service or hardware authorization boundary.
- S8: create `evidence/stages/s8-adversarial-custody.json` only after the strong
  custody boundary below is resolved; verifier-only WebKit remains an honest profile.

Each receipt has its own exact-head review, merge, and readback lifecycle. Receipt
work must not rewrite historical receipt bytes.

## 10. P2 custody and browser hardening

Objective: remove the largest remaining key-use gap after real independent operation
is demonstrated.

- move the signing key and counter state together into a separate origin/service or
  hardware authorization domain;
- require explicit bounded requests rather than exposing general same-origin sign
  use;
- prove sign-once and counter allocation across restart, concurrency, compromise of
  the product origin, and below-quorum operation;
- rerun Chromium/Firefox full families and WebKit capability detection; promote
  WebKit signing only if its native implementation passes the complete canonical
  envelope and S2/S4 family without exporting key material.

No fallback may weaken key containment merely to turn WebKit green.

## 11. P3 product and network expansion

Only after R5 and the custody gate:

- public contribution UX and provider onboarding;
- capacity and SLA weights backed by observed domains;
- incentives, penalties, or settlement backed by attributable metering;
- broader rendezvous, anti-entropy, and discovery;
- availability targets derived from measured failure distributions.

Discovery, relay, UI, GPT, and Cloudflare remain replaceable carriers. None becomes
membership, validity, mortality, or repair authority.

## 12. Research nonclaims and stop list

Do not schedule these as release blockers or claim them from R0-R5 evidence:

- absolute Sybil resistance;
- global hidden-artifact discovery or global currentness;
- objective global death;
- hostile-disk or sudden-power-loss proof beyond the declared storage boundary;
- copied-key detection outside the admitted custody and journal model;
- “decentralized”, “ownerless”, “immortal”, or arbitrary-Internet claims without
  their own exact evidence.

Also do not start another same-PC transport, coordinator, receipt wrapper, or signed
declaration merely to approximate R3. The next useful implementation is R1; the next
meaningful North Star promotion is R5.

## 13. Immediate execution queue

1. Observe R0 to a terminal exact-main result; do not mutate external state while it
   is running.
2. Open one focused R1 implementation candidate with no operational credentials.
3. Freeze the R2 profiles and sanitized evidence schema before the first network run.
4. Recruit and verify the R3 administrative domains before creating any live
   authority, ceremony, or seven-day candidate.
5. Pre-register R4 before trial 1; a retrospective trial matrix does not count.

Every step reports `PASS` or `HOLD`, the immutable source/evidence identifiers, and
the exact boundary not proved.
