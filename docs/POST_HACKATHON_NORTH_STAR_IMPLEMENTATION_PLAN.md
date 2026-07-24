# MortalOS post-hackathon North Star implementation plan

Status: **PLAN ONLY — S0–S8 are not implemented or promoted by this document**

Plan authority date: **2026-07-25 KST**

Planning base: `origin/main`
`079e37dfdea8ce94998533979546b65cc09709d6`

Owner: `codex-protocol-kernel`

This is the execution SSOT for turning MortalOS from a verified browser
falsification Lab into a durable, recoverable, endpoint-neutral resource runtime.
The contest, Devpost submission, and demo-video state are historical evidence, not
future product priorities.

## 1. North Star

> When any one endpoint, administrative credential domain, and the primary relay
> disappear, the surviving quorum can cold-start, reconstruct the exact authorized
> identity and state, and commit the next deterministic transition without trusting
> a browser, server, cloud, UI, or model as authority.

The product sentence remains:

> **Create once. Continue elsewhere.**

`Elsewhere` now means a separately persisted process, device, credential boundary,
or transport—not merely another tab or an isolated browser context.

### 1.1 North Star acceptance trial

One versioned `2-of-3` resource must pass all of the following in one immutable
candidate:

1. Three participants hold three distinct current keys in three separately
   persisted stores.
2. No one runtime, host, cloud service, relay, or administrative credential can use
   enough keys to satisfy the threshold.
3. The harness selects and hard-stops any one participant, deletes its local
   authority and state replica, and blocks the primary relay.
4. The two survivors cold-start from disk or browser storage and use a replaceable
   transport to reconstruct one byte-identical recognized head and resource state.
5. The surviving quorum commits one new canonical transition and admits a new
   replacement participant.
6. Recovery completes within five minutes.
7. One hundred seeded trials complete consecutively with:
   - `100/100` exact-state recovery;
   - `100/100` authorized continuation;
   - zero unauthorized acceptance;
   - zero silent rollback;
   - zero hidden fork selection; and
   - zero false death classification.
8. The same candidate remains healthy through a seven-day natural burn-in without
   changing source, protocol version, state format, topology contract, or evidence
   policy.

This trial proves separation of technical and credential failure domains. It does
not prove that distinct humans or legal organizations independently control them.
That stronger claim requires separately administered participants and its own
external evidence.

## 2. Current verified baseline and the root gap

The following observations are planning inputs, not permanent completion claims.
They must be refreshed at S0.

| Area | Baseline at planning base | Root gap |
| --- | --- | --- |
| Kernel | Canonical parsing, Ed25519 validation, lineage, mortality, state, R1, transport, and stable rejection tests exist. | The kernel is strong enough to build on; rewriting it is not the priority. |
| Live handoff | A→B preserves identity and B advances after A closes. | The live participant keeps key and evidence in memory; B is not cold-restarted before continuation. |
| Durable participant | A consent-gated IndexedDB `1-of-1` participant restores after reload. | It is separate from live handoff and quorum, expires after 1–30 days, and cannot durably operate `2-of-3`. |
| Quorum | A/B/C logical `2-of-3`, every one-endpoint loss pair, and D repair pass in isolated Chromium contexts. | Context isolation is not independently persisted process/device/credential-domain evidence. |
| State | `mortalos-state/1` binds a bounded deterministic state transition and JS/Python receipts. | General availability, chunk recovery, confidentiality, and retrievability remain outside the accepted state transition. |
| Relay | Cloudflare Durable Object relay is bounded and non-authoritative. | Public evidence is retained for one to seven days; it is not the resource durability or confidentiality layer. |
| Product surface | A bilingual Lab exposes continuity, guided falsification, durability, corpus, and diagnostics. | Three participant implementations and a large Lab controller are not a stable SDK or one coherent product path. |
| Distribution | Source exports exist internally. | The package remains private `0.0.0` with no supported CLI/package contract. |
| Dependency health | Prerequisite PR #29 upgraded `wrangler` and `@cloudflare/vitest-pool-workers`, preserved both Windows workerd layouts, and restored the 2026-07-25 audit to zero findings. The before snapshot contained five high-severity findings through `wrangler`, `miniflare`, `sharp`, `fast-uri`, and the pool package. | S0 must bind the before/after advisory evidence and exact lockfile digest into the baseline receipt; any new high/critical finding returns the stage to HOLD. |
| Documentation | Protocol, threat model, traceability, release evidence, and contest roadmaps exist. | Active roadmaps still contain deadline, judge, Devpost, and already-completed promotion language. |

### 2.1 Most fundamental implementation decision

The first runtime change is a **single Participant Core**. Durable storage,
multi-endpoint handoff, quorum signing, state replay, transport catch-up, and
authority removal must be adapters around one state machine. No new UI, model
feature, browser engine, or arbitrary genome precedes this convergence.

### 2.2 Dependency correction from the initial proposal

The bounded real-resource vertical is implemented before the final independent
failure-domain burn-in. A burn-in using only the toy pulse counter would prove
infrastructure mechanics but not useful state survival. This plan therefore orders
the work as:

`baseline → unified core → crash-safe durable quorum → recoverable state →
confidentiality → SDK/CLI → real resource → independent-domain burn-in →
advanced adversaries and browser parity`

## 3. Global invariants

Every stage must preserve these rules.

1. Only canonical bytes, signatures, recognized lineage, and the deterministic
   state contract establish validity.
2. UI, storage, transport order, relay presence, Cloudflare, model output, and
   cached verdicts never establish acceptance.
3. Importing evidence grants observation, not signing authority.
4. A participant signs at most one exact successor body per
   `(organism_id, sequence, parent_hash)` tuple.
5. A signature is never released before its sign-once intent is durably recorded.
6. A storage error, incomplete transaction, missing state chunk, unknown version,
   malformed evidence, or unavailable dependency fails closed.
7. State unavailable, key unavailable, transport unavailable, below quorum,
   dormant, forked, and dead remain different statuses.
8. Process exit, relay silence, storage absence, or timeout never becomes protocol
   death.
9. No stage weakens existing byte ceilings, depth limits, signature-work limits,
   deterministic rejection precedence, or exact-runtime differentials.
10. GPT or another model may propose or explain work but cannot sign, choose a head,
    determine completeness, recover a key, decrypt state, or change a verdict.
11. Every passing receipt binds the exact source commit, dependency lock digest,
    command, environment, seed, timestamp, and evidence digest.
12. An old PASS cannot authorize a changed source, protocol, state format, storage
    schema, crypto suite, topology, or evidence policy.

## 4. Stage status and promotion model

Each stage has exactly one of these states:

| State | Meaning |
| --- | --- |
| `PLANNED` | Scope and gate exist; no implementation claim. |
| `IMPLEMENTED_LOCAL` | Code exists, but the complete stage gate has not passed. |
| `CANDIDATE_PASS` | Exact-head automated and required physical/runtime evidence pass. |
| `PROMOTED` | Independent review, expected-head merge, post-merge gates, and required burn-in/readback pass. |
| `HOLD` | A mandatory input or gate failed, is stale, or is incomplete. |

`PARTIAL PASS` is not a promotion state. Optional exploratory evidence may be
recorded, but it cannot satisfy a strict gate.

## 5. Priority and critical path

| Stage | Priority | Estimated focused effort | Depends on | Promotion unlock |
| --- | --- | ---: | --- | --- |
| S0 — Post-hackathon baseline reset | P0 | 2–3 days | None | Current SSOT and exact baseline |
| S1 — Unified Participant Core | P0 | 7–10 days | S0 | One authority/replay state machine |
| S2 — Crash-safe Durable Quorum | P0 | 10–15 days | S1 | Cold-restart `2-of-3` continuity |
| S3 — R3 State Availability and Recovery | P0 | 10–15 days | S2 | Exact resource recovery |
| S4 — Confidential State and Epoch Keys | P1 | 7–12 days | S3 | Untrusted relay/storage privacy |
| S5 — Versioned SDK and CLI | P1 | 5–10 days | S1–S4 | Reusable endpoint-neutral product surface |
| S6 — Continuity Capsule vertical | P0 product | 7–10 days | S3–S5 | One useful resource, not a toy counter |
| S7 — Independent Failure-Domain Trial | P0 promotion | 7 days setup + 7 days burn-in | S6 | North Star claim |
| S8 — Adversarial Custody and Browser Parity | P2 | 10–20 days | S7 | Stronger threat model and reach |

Expected critical path is roughly 8–12 focused weeks plus the immutable seven-day
S7 burn-in. Estimates are planning ranges, never acceptance evidence.

## 6. S0 — Post-hackathon baseline reset

Priority: **P0**

Status: **PLANNED**

### Goal

Create one current, non-contest SSOT and a reproducible exact-main baseline before
runtime refactoring starts.

### Implementation scope and deliverables

1. Fetch current `origin/main` and record its exact commit.
2. Replace the active short `NORTH_STAR_ROADMAP.md` with a post-hackathon summary
   pointing to this plan.
3. Move contest-specific release, Devpost, deadline, and demo-video documents into a
   clearly labeled historical/archive map without deleting useful evidence.
4. Reconcile v0 and v1 wording across protocol, threat model, traceability, and
   README—especially state-transition and availability semantics.
5. Define one current claim matrix:
   - implemented;
   - exact-head locally verified;
   - physically verified;
   - promoted;
   - explicitly not claimed.
6. Create tracked issues/milestones for S1–S8 and assign a single owner and evidence
   path to each.
7. Verify the dependency remediation merged by PR #29 on exact current main and
   record its before/after advisory identifiers and exact lockfile delta. Preserve
   zero high/critical findings without `audit fix --force`, overrides, or ignore
   entries.
8. Capture a clean baseline receipt containing:
   - source commit;
   - lockfile digest;
   - full test results;
   - Chromium results;
   - coverage;
   - dependency audit;
   - active documentation inventory; and
   - known limitations.

### Strict PASS criteria

- [ ] Baseline commit equals freshly fetched `origin/main`.
- [ ] Working implementation tree is clean before the baseline run.
- [ ] `npm ci`, current Chromium installation, full `npm test`,
  `npm run verify:lab`, `npm run test:chromium`, coverage, and dependency audit all
  pass on that same commit.
- [ ] Active product documents contain no current contest deadline, judge path,
  Devpost mutation, or submission-freeze priority.
- [ ] Historical contest evidence remains discoverable but is explicitly marked
  non-authoritative for new development.
- [ ] Protocol/threat-model/traceability statements about v0 versus v1 state
  transitions are mutually consistent.
- [ ] Exactly one active North Star and one implementation SSOT exist.
- [ ] Every S1–S8 issue links to this plan and declares required evidence.
- [ ] Baseline receipt has no missing field and its digest is read back.

### HOLD / rollback

- HOLD if the baseline worktree is dirty, main changes during capture, a full gate
  fails, or the documentation claim matrix contradicts executable behavior.
- Do not begin S1 on a narrowed passing subset.
- Documentation cleanup must not delete historical receipts until their archive
  links and digests have been verified.

## 7. S1 — Unified Participant Core

Priority: **P0 — first runtime change**

Status: **PLANNED**

### Goal

Replace the separate live, durable, and quorum authority paths with one pure,
deterministic Participant Core and explicit I/O ports.

### Target contract

The core owns:

- recognized lineage and state projection;
- current custody and threshold;
- proposal construction;
- sign-once tuple policy;
- approval and acceptance collection;
- candidate verification and append;
- pending-successor state;
- catch-up and fork exposure;
- authority and state availability classification; and
- deterministic public snapshots.

Adapters own:

- key generation and signing;
- durable key storage;
- evidence/state storage;
- transport;
- clock and expiry policy;
- user consent; and
- UI presentation.

Adapters may return bytes or capabilities. They may not return `accepted: true` or
inject a recognized head.

### Implementation scope and deliverables

1. Add a versioned participant operation/snapshot contract.
2. Define `KeyStore`, `EvidenceStore`, `StateStore`, `SignOnceJournal`, and
   `Transport` interfaces with bounded inputs and explicit failure results.
3. Move shared creation, join, handoff, quorum, proposal, append, replay, and
   availability logic into one core module.
4. Convert the existing Live, Durable, and Quorum classes into thin adapters or
   remove them after all callers migrate.
5. Make snapshots canonical and deterministic; exclude `CryptoKey`, DOM, store
   handles, and transport objects.
6. Add a model-based state-machine corpus covering permitted and rejected operation
   sequences.
7. Freeze the import boundary so presentation code cannot call low-level signing
   message constructors directly.

### Strict PASS criteria

- [ ] Every existing single-browser, durable reload, A→B, A/B/C loss/repair,
  out-of-order, fork, and negative handoff test uses the same Participant Core.
- [ ] Only the Participant Core may construct candidate bodies, request signatures,
  append accepted records, or advance a recognized state.
- [ ] Key, storage, transport, and UI adapters contain no acceptance or head-selection
  branch.
- [ ] Ten thousand seeded participant-operation schedules produce deterministic,
  byte-identical snapshots on two independent runs.
- [ ] The same operation corpus agrees across Node and the browser-target runtime.
- [ ] A below-quorum action, duplicate signature, conflicting tuple signature,
  stale parent, missing state, corrupt evidence, and transport outage each return
  distinct stable outcomes.
- [ ] Existing `npm test`, R1, state, transport, Chromium, and Lab gates have zero
  regression.
- [ ] Coverage for the new core is at least 95% lines, 90% branches, and 95%
  functions, with every rejection branch named by a test.
- [ ] A static boundary test fails if an adapter imports forbidden validation
  capability or direct signing-message construction APIs.

### HOLD / rollback

- HOLD if migration requires two authoritative participant paths at runtime.
- HOLD if an adapter can make an invalid candidate appear accepted.
- Preserve the pre-S1 implementation until the unified core passes the complete
  existing behavior matrix. Do not delete old paths based only on unit tests.

## 8. S2 — Crash-safe Durable Quorum

Priority: **P0**

Status: **PLANNED**

### Goal

Make a real `2-of-3` participant survive process termination, reload, and partial
storage failure without double-signing, inventing a head, or losing accepted state.

### Implementation scope and deliverables

1. Introduce a versioned durable participant schema for:
   - non-extractable key handle or supported platform key reference;
   - canonical Genesis and Pulse evidence;
   - state manifest references;
   - sign-once journal;
   - pending proposal/signature records;
   - committed head metadata used only as a cache hint;
   - expiry and authority-removal metadata; and
   - migration version.
2. Persist sign-once intent before releasing a signature.
3. Make accepted evidence, state references, and journal completion one recoverable
   transaction or write-ahead protocol.
4. Restore by replaying canonical evidence and state proofs; never trust cached
   acceptance or head fields.
5. Support durable `2-of-3` birth, membership handoff, state transition, loss, and D
   repair through the unified core.
6. Add browser IndexedDB and local Node test adapters with identical failure
   semantics. A production Node key-store choice requires a separate platform
   security ADR.
7. Add deterministic fault injection at every durable write and transaction boundary.

### Strict PASS criteria

- [ ] Browser B is fully closed after an accepted handoff, cold-started in a new
  process, restores its key/evidence/state, and advances the same identity.
- [ ] The above cold-restart handoff passes `100/100` consecutive seeded runs.
- [ ] For each A/B/C loss choice, the remaining durable pair cold-starts, commits
  one transition, and repairs membership with D in `100/100` runs.
- [ ] Forced termination at every enumerated storage boundary yields exactly one of:
  old committed head, recoverable pending successor, or new committed head.
- [ ] No crash point releases a second body signature for the same tuple.
- [ ] Unknown schema, corrupt key handle, missing evidence, key/custody mismatch,
  partial journal, state mismatch, and failed migration all fail closed.
- [ ] Authority removal atomically prevents future signing while retaining
  read-only public evidence.
- [ ] Expiry and renewal are explicit policy operations; no hard-coded 30-day
  product lifetime remains.
- [ ] The complete durable-quorum suite passes in clean Chromium and Node test
  adapters on the exact head.

### HOLD / rollback

- HOLD on any double-sign, cached-head trust, partial-state exposure, or
  nondeterministic recovery.
- A migration failure keeps the old schema read-only; it must never destructively
  rewrite the only copy.
- Do not promote Node production custody until its key-store threat model and
  platform evidence pass.

## 9. S3 — R3 State Availability and Recovery

Priority: **P0**

Status: **PLANNED**

### Goal

Bind an actual bounded resource to lineage and prove that its exact bytes remain
recoverable after one replica is lost.

### Implementation scope and deliverables

1. Specify a canonical versioned state-package manifest containing:
   - resource format and schema version;
   - ordered content chunk digests and sizes;
   - aggregate resource root;
   - prior and next state roots;
   - transition input digest;
   - deterministic receipt digest;
   - storage/recovery policy identifier; and
   - fixed resource ceilings.
2. Separate small canonical transition metadata from bounded content chunks.
3. Implement content-addressed local stores and a transport-neutral recovery
   adapter.
4. Extend the state engine so acceptance binds the exact manifest and transition
   receipt, while availability remains an explicitly observed status.
5. Add an independently written verifier for manifest/root/recovery records.
6. Implement replica inventory, missing-chunk discovery, bounded fetch, exact
   reconstruction, and post-recovery verification.
7. Keep death semantics unchanged until the new availability evidence and threat
   model are separately approved.

### Reference acceptance resource

The gate uses at least one deterministic 1 MiB resource split into fixed bounded
chunks. Exact ceilings and chunk size are normative in the S3 protocol ADR and
cannot be chosen from ambient runtime defaults.

### Strict PASS criteria

- [ ] JavaScript and an independently written non-JavaScript verifier produce
  byte-identical manifest, chunk, state-root, input, and receipt results.
- [ ] Any two current replicas reconstruct the exact 1 MiB reference resource after
  the third replica and primary relay are deleted.
- [ ] Reconstructed bytes match the pre-loss aggregate digest exactly.
- [ ] Missing chunks report `state_unavailable`; they never become an empty/default
  accepted state or protocol death.
- [ ] A changed byte, reordered chunk, duplicate chunk, wrong size, wrong manifest,
  stale root, oversized resource, and decompression/decoding bomb each fail with a
  stable bounded result.
- [ ] Ten thousand seeded loss, reorder, duplicate, partial-fetch, and tamper
  schedules produce zero false acceptance and deterministic outcomes.
- [ ] Recovery is resumable and idempotent; interruption never replaces the last
  verified local state.
- [ ] Existing v0/v1 corpus and mortality behavior remain byte-identical unless a
  separately versioned specification change explicitly updates fixtures.

### HOLD / rollback

- HOLD if resource availability is inferred from relay presence, a cached flag, or
  a single unverified store response.
- HOLD if missing state changes candidate validity or death classification without
  an approved protocol version.
- Keep the last verified state package until the replacement manifest and every
  required chunk pass.

## 10. S4 — Confidential State and Epoch Keys

Priority: **P1**

Status: **PLANNED**

### Goal

Prevent relay and storage operators from learning resource contents while
preserving deterministic integrity, recovery, and explicit membership changes.

### Implementation scope and deliverables

1. Approve a cryptographic ADR before implementation. It must define:
   - audited WebCrypto-compatible AEAD;
   - key derivation and domain separation;
   - unique nonce construction and collision policy;
   - epoch and membership binding;
   - associated canonical metadata;
   - participant key wrapping/distribution;
   - removed-member semantics;
   - recovery and rotation;
   - metadata leakage; and
   - algorithm/version migration.
2. Encrypt resource chunks before transport or remote storage.
3. Commit ciphertext and encryption metadata into the state package without making
   the relay an oracle.
4. Rotate the content epoch on accepted membership change.
5. Make “removed participants cannot read future epochs” the claim; do not claim
   erasure of data or keys they previously possessed.
6. Add key-loss and partial-rotation recovery rules.

### Strict PASS criteria

- [ ] The crypto ADR is independently reviewed before code is merged.
- [ ] Standard known-answer vectors and cross-runtime vectors pass.
- [ ] Relay and remote-store captures contain no plaintext resource content,
  plaintext content key, private signing key, or unwrapped epoch key.
- [ ] Current quorum participants recover and decrypt exact state after one replica
  and relay loss.
- [ ] A participant removed at epoch `N` cannot decrypt state first created at epoch
  `N+1`, while authorized survivors can.
- [ ] Replayed, substituted, truncated, reordered, or cross-resource ciphertext
  fails authentication without exposing partial plaintext.
- [ ] Nonce uniqueness is enforced by construction and tested across at least
  1,000,000 generated encryption records with zero collision.
- [ ] Rotation interrupted at every write boundary restores the old complete epoch
  or the new complete epoch, never a mixed accepted state.
- [ ] Metadata leakage and absence of retroactive secrecy are visibly documented.

### HOLD / rollback

- HOLD if code selects an algorithm before the ADR, uses custom cryptography,
  permits nonce reuse, or treats decryption success as protocol acceptance.
- On rotation failure retain the prior epoch and prior membership-readable state;
  do not destroy the only decryptable copy.

## 11. S5 — Versioned SDK and CLI

Priority: **P1**

Status: **PLANNED**

### Goal

Turn the internal Lab implementation into a reusable, endpoint-neutral developer
surface without exposing validation capabilities or unstable storage internals.

### Implementation scope and deliverables

1. Define package boundaries for:
   - deterministic kernel;
   - Participant Core;
   - browser adapters;
   - Node/CLI adapters;
   - state package and recovery; and
   - test vectors.
2. Publish an internal pre-release API contract before making the package public.
3. Add CLI operations equivalent to:
   - `create`;
   - `join`;
   - `status`;
   - `propose`;
   - `approve`;
   - `continue`;
   - `recover`;
   - `repair`;
   - `export`;
   - `import`;
   - `verify`; and
   - `remove-authority`.
4. Make CLI output canonical JSON by default with an explicit human-readable view.
5. Provide transport and store adapter examples without embedding secrets.
6. Freeze semver, migration, deprecation, and supported-runtime policy.

### Strict PASS criteria

- [ ] `npm pack` produces only allowlisted source, declarations, fixtures, license,
  and documentation files.
- [ ] A clean Windows environment and a clean Linux environment install the packed
  artifacts and complete create→join→continue→recover→repair→verify.
- [ ] Browser and CLI consume the same Participant Core and produce byte-identical
  operation/result records.
- [ ] No exported API can manufacture an accepted context, inject a head, access a
  private validation brand, or bypass the sign-once journal.
- [ ] Unknown/removed API fields and unsupported versions fail closed with stable
  errors.
- [ ] Public API type tests, examples, migration tests, license audit, secret scan,
  package-content audit, and dependency audit pass.
- [ ] Package version is no longer `0.0.0` before public publication.
- [ ] Publication remains blocked until exact tarball digest, independent review,
  and clean-install evidence are recorded.

### HOLD / rollback

- HOLD if browser and CLI maintain separate protocol logic.
- HOLD if the package includes generated credentials, local stores, receipts with
  private values, coverage output, or disposable artifacts.
- Keep packages private until the compatibility and migration contracts pass.

## 12. S6 — Continuity Capsule real-resource vertical

Priority: **P0 product**

Status: **PLANNED**

### Goal

Prove useful continuity with one bounded real resource before expanding to arbitrary
applications or executable genomes.

### Product choice

Implement **Continuity Capsule v1**: a deterministic, encrypted, append-only resource
containing bounded canonical entries and attachments. It may represent a durable
note, configuration, evidence notebook, or agent-memory capsule, but a model is
never required to create, verify, recover, or continue it.

### Implementation scope and deliverables

1. Specify the Capsule schema, limits, canonical operations, conflict behavior, and
   deterministic state reducer.
2. Support create, append, handoff, quorum approval, cold restart, recovery, member
   repair, export, read-only import, and authority removal.
3. Present one primary product path separate from protocol diagnostics.
4. Keep raw bytes, corpus, model witness, and advanced mortality tools outside the
   primary flow.
5. Add a concise English/Korean status surface showing only:
   - identity;
   - accepted sequence;
   - state digest and size;
   - quorum and current custodians;
   - replica availability;
   - transport status; and
   - pending/recovery/fork state.
6. Make every claim expandable to its canonical evidence and local verifier result.

### Strict PASS criteria

- [ ] Capsule create→append→A/B/C commissioning→one-loss recovery→D repair completes
  without enabling GPT or opening Advanced evidence.
- [ ] The exact Capsule bytes and digest survive browser and CLI cold restarts.
- [ ] One replica and primary relay can be removed without data loss or authority
  concentration.
- [ ] A read-only imported Capsule cannot sign or mutate.
- [ ] Conflicting valid siblings show an explicit fork and stop automatic progress.
- [ ] Invalid, oversized, corrupt, undecryptable, stale, and below-quorum operations
  fail without changing the last accepted Capsule.
- [ ] Automated desktop and mobile Chromium flows complete the primary path in under
  five minutes on the reference environment.
- [ ] English and Korean flows produce identical protocol/state values.
- [ ] WCAG-oriented axe scan has zero critical/serious violations and keyboard-only
  flow completes.
- [ ] Primary-path application code uses only the public SDK contract.

### HOLD / rollback

- HOLD if the vertical requires protocol-specific manual JSON editing, a model call,
  or direct access to internal participant objects.
- Do not add a second resource type until Capsule v1 passes S7.
- If the simplified UI hides uncertainty, fall back to explicit technical statuses
  rather than optimistic “alive” language.

## 13. S7 — Independent Failure-Domain Trial and burn-in

Priority: **P0 promotion**

Status: **PLANNED**

### Goal

Run the complete North Star trial on separately persisted endpoints and credential
domains using the real Continuity Capsule.

### Required topology

At minimum:

- three separately persisted participants;
- three distinct key stores;
- no credential capable of directly reading or using threshold private keys;
- at least two host/process failure domains;
- at least two transport paths, one of which is not the primary Cloudflare relay;
- immutable topology manifest;
- synchronized but non-authoritative observation clocks; and
- out-of-band retention of public receipts only.

One experimenter may own the test infrastructure. The promoted claim is therefore
credential/host/provider separation, not independent-human governance. A separate
human/organization-control claim requires externally administered custodians and
must not reuse this receipt.

### Implementation scope and deliverables

1. Build a topology manifest binding endpoint, host, key-store class, administrative
   credential, transport, software commit, package digest, and resource limits.
2. Add remote harness commands that never export or centrally collect private keys.
3. Implement seeded loss selection, relay blocking, cold restart, recovery timing,
   next transition, and D repair.
4. Produce one signed public receipt per trial plus one aggregate receipt.
5. Run 100 consecutive randomized trials.
6. Freeze the candidate and run a seven-day natural burn-in.
7. Re-run the full trial after burn-in without changing the candidate.

### Strict PASS criteria

- [ ] Topology audit shows no runtime, host, relay, cloud service, or administrative
  credential can use threshold private keys.
- [ ] Each of A, B, and C is selected as the lost participant in the seeded matrix.
- [ ] Primary relay is blocked during every recovery trial.
- [ ] All `100/100` trials recover exact Capsule bytes, continue one sequence, and
  repair membership.
- [ ] Recovery time is ≤5 minutes for every trial; p95 is reported separately.
- [ ] Unauthorized acceptance, silent rollback, hidden fork choice, false death,
  plaintext relay leakage, and private-key collection are all zero.
- [ ] Trial receipts bind the exact topology, source, package, protocol/state/crypto
  versions, seed, and public evidence digest.
- [ ] Seven-day burn-in has no source, config, topology, policy, or evidence-rule
  change and no unresolved integrity incident.
- [ ] The post-burn-in 100-trial rerun also passes.
- [ ] Independent review reproduces at least one trial from public evidence and
  confirms that imported evidence has no signing authority.

### HOLD / rollback

- Any candidate, topology, state-format, crypto, credential, or evidence-policy
  change resets the burn-in clock.
- HOLD if one orchestrator can access threshold private keys, even if the test uses
  several processes.
- HOLD if relay outage is simulated only in UI while the transport remains reachable.
- Preserve the last S6 local candidate; do not call it independent-domain PASS.

## 14. S8 — Adversarial custody and browser parity

Priority: **P2 after North Star promotion**

Status: **PLANNED**

### Goal

Strengthen the honest-but-fallible model with bounded malicious-custodian and
key-compromise recovery, then expand durable runtime support beyond Chromium.

### Implementation scope and deliverables

1. Specify a versioned adversarial-custodian threat-model extension.
2. Detect and preserve evidence of one custodian signing conflicting bodies.
3. Support compromised-key removal and epoch rotation by an unaffected quorum.
4. Add bounded recovery from stale, malicious, censoring, or equivocating transports.
5. Decide through ADR whether threshold signatures, distributed key generation, or
   proactive resharing are justified. They are not implicitly required.
6. Run actual Firefox and WebKit capability, persistence, crash, migration, removal,
   and recovery gates.
7. Preserve honest capability downgrade when an engine cannot safely persist the
   required key.

### Strict PASS criteria

- [ ] Conflicting signatures from one current custodian create explicit equivocation
  evidence and never automatic winner selection.
- [ ] An unaffected quorum removes a declared compromised key, rotates the content
  epoch, repairs membership, and continues exact state.
- [ ] The removed key cannot authorize a later successor or decrypt later epochs.
- [ ] Censorship, duplicate floods, stale range results, and malicious transport
  ordering cannot change the accepted result.
- [ ] Updated threat model names every new assumption and excluded attack.
- [ ] Firefox and WebKit each pass actual-engine creation, non-exportability,
  reload/crash recovery, durable quorum, authority removal, corrupt-store failure,
  and Capsule recovery—or remain visibly unsupported with no weakened fallback.
- [ ] No browser uses user-agent detection to claim support.
- [ ] Existing Chromium, Node, R1, state, recovery, confidentiality, and S7 evidence
  matrices have zero regression.
- [ ] Any threshold-crypto/DKG implementation, if chosen, has an independently
  reviewed ADR, standard vectors, interoperability evidence, and separate audit.

### HOLD / rollback

- HOLD if malicious behavior is “resolved” by last-write-wins, server choice, model
  choice, or administrator deletion of inconvenient evidence.
- Unsupported engines retain read-only/ephemeral capability only when explicitly
  disclosed; they must not silently persist extractable keys.
- Do not market Byzantine or Sybil resistance unless the exact implemented scope
  passes.

## 15. Verification command contract

Existing commands remain mandatory until intentionally versioned:

```text
npm test
npm run verify:lab
npm run test:chromium
npm run test:coverage
npm run verify:r1
npm run verify:state
npm run verify:transport
```

The following target commands must be introduced by the owning stages:

| Command | Owning stage | Required proof |
| --- | --- | --- |
| `npm run test:participant-core` | S1 | Model/state-machine and adapter-boundary corpus |
| `npm run test:durable-quorum` | S2 | Cold restart, fault injection, sign-once durability |
| `npm run test:state-recovery` | S3 | Chunk/manifest recovery and tamper matrix |
| `npm run test:confidentiality` | S4 | AEAD, epoch, rotation, relay-capture matrix |
| `npm run test:sdk` | S5 | Package/API/CLI clean-install interoperability |
| `npm run test:capsule` | S6 | Complete bounded resource lifecycle |
| `npm run verify:failure-domains` | S7 | Remote topology, 100 trials, burn-in receipts |
| `npm run test:adversarial-custody` | S8 | Equivocation and compromised-key recovery |
| `npm run test:browser-matrix` | S8 | Chromium/Firefox/WebKit actual-engine matrix |
| `npm run verify:north-star` | S7/S8 | Exact receipt aggregation and final claim gate |

No command may silently skip an unavailable required runtime. A missing dependency
is a failed or explicitly unsupported gate, not PASS.

## 16. Evidence receipt schema

Every stage receipt must include:

```text
format
stage
status
source_commit
base_commit
dependency_lock_digest
protocol_versions
state_versions
storage_schema_versions
crypto_versions
package_digests
topology_digest
commands
environment
seeds
started_at
completed_at
results
failures
artifact_digests
review_snapshot
```

Fields not applicable to an early stage must be present as `not_applicable` with a
reason. Missing fields fail receipt validation. Secrets, private keys, decrypted
resource contents, personal data, and hidden reasoning are forbidden.

## 17. Cross-stage acceptance matrix

| Scenario | Expected result | First owning stage |
| --- | --- | --- |
| B cold restart after A→B handoff | Same identity and authority restored | S2 |
| Any one of A/B/C hard-lost | Remaining pair continues and repairs | S2 |
| Crash before signature journal | No signature released | S2 |
| Crash after signature but before publish | Pending signed body recoverable; no second body signed | S2 |
| One state replica and relay lost | Exact state reconstructed | S3 |
| Chunk missing | `state_unavailable`, not empty state or death | S3 |
| Chunk tampered | Stable rejection, no commit | S3 |
| Removed custodian reads future state | Decryption denied | S4 |
| Browser and CLI replay same evidence | Byte-identical result | S5 |
| Read-only Capsule import attempts mutation | No signing authority | S6 |
| Valid siblings arrive | Visible fork, no winner | S1/S6 |
| Host plus primary relay lost | North Star recovery ≤5 minutes | S7 |
| One signer equivocates | Evidence preserved, automatic progress halted | S8 |
| Unsupported browser durable mode | Honest visible downgrade | S8 |

## 18. Stop-work rules

Immediately stop promotion and set the current stage to HOLD when:

1. a private key or plaintext resource appears in relay, logs, receipts, or source;
2. an adapter, relay, model, UI, or cached field changes a verdict;
3. one credential or runtime controls threshold keys contrary to the declared
   topology;
4. crash recovery yields different heads from the same durable evidence;
5. a missing state is accepted as an empty/default state;
6. a changed source reuses an older PASS;
7. a failing or unavailable runtime is silently skipped;
8. evidence is incomplete, stale, non-reproducible, or not bound to the candidate;
9. a fork is hidden or automatically resolved; or
10. public/product wording exceeds the exact promoted evidence.

## 19. Explicit non-goals before S7 PASS

- additional GPT/model product features;
- more Lab dashboards or decorative visualization;
- arbitrary WASM or user-supplied genome execution;
- background compute contribution or mining;
- tokens, incentives, or Sybil-resistant economics;
- global death certificates;
- ownerless or globally decentralized claims;
- threshold signatures or DKG without an approved S8 ADR;
- a second application workload; and
- browser-market expansion that weakens the Participant Core.

## 20. Whole-plan Definition of Done

The post-hackathon North Star program is complete only when:

- [ ] S0 through S8 are all `PROMOTED` with exact receipts.
- [ ] One Participant Core serves browser, CLI, durable, handoff, and quorum paths.
- [ ] A durable `2-of-3` Capsule survives every one-endpoint loss, cold restart,
  primary-relay outage, exact state recovery, continuation, and repair.
- [ ] State availability, confidentiality, and authority are independently verified
  and separately reported.
- [ ] Browser and CLI produce byte-identical canonical results.
- [ ] The North Star 100-trial matrix passes before and after an immutable seven-day
  burn-in.
- [ ] Technical/credential failure-domain evidence is complete and does not imply
  independent-human governance.
- [ ] Compromised-key removal and explicit equivocation handling pass the bounded S8
  threat model.
- [ ] Chromium, Firefox, and WebKit support claims match actual-engine durable tests
  with no silent downgrade.
- [ ] All old contest priorities are historical, and current README, roadmap,
  protocol, threat model, traceability, SDK, CLI, and product claims agree.
- [ ] Full test, coverage, audit, package, secret, clean-install, clean-clone,
  independent-review, and post-merge evidence pass on the final exact source.

If any item is missing, the status is **HOLD**, not “mostly complete.”

## 21. First authorized implementation slice after plan approval

The first implementation PR should contain S0 only:

1. current baseline receipt;
2. post-hackathon North Star/claim matrix;
3. v0/v1 documentation reconciliation;
4. historical documentation map;
5. S1–S8 tracked milestones; and
6. no Participant Core refactor.

S1 begins from the merged, independently reviewed S0 baseline. Combining S0 and S1
would make claim cleanup, architectural movement, and regression diagnosis one
unreviewable unit and is therefore prohibited.
