# MortalOS Project Status

As of: **2026-07-16**

Stage: **P0 implemented in this tree; immutable-head publication evidence required; H3A local Lab implemented**

Security baseline: **every published SHA requires immutable-head review and its own successful Verify run**

This is the rolling status and audit document. Update it when evidence changes; use Git history for dated narratives.

## 1. Executive assessment

MortalOS now has a portable authority-lineage kernel. Genesis, signed Pulses, singleton creation, `2-of-3` handoffs, complete original-custodian turnover, replay/fork handling, latent succession, conditional mortality, and clone separation are executable. Byte acquisition, Ed25519 points, validation order, handoff activation, and mortality authority have explicit fail-closed boundaries rather than relying on caller discipline.

The trusted implementation no longer depends on Node.js or the browser. The
verification contract requires the committed result, Node 22, an isolated
browser-target bundle, and actual headless Chromium to agree for every changed review
head. H3A uses that kernel in a local one-page Lab rather than creating a second
validator. The latest successful exact-head Verify run, not a SHA copied into rolling
prose, is the publication evidence.

The project still does not transition mutable logical state or connect participants. It supports claims about deterministic identity and authority lineage, not yet an OS, independent-host deployment, or state-bearing digital life.

## 2. Capability matrix

| Capability | State | Evidence or limitation |
|---|---|---|
| Apache-2.0 licensing | Verified | Root license digest, package metadata, and contribution terms agree. |
| Canonical input and limits | Verified | Intrinsic-backed snapshots ignore hostile view metadata and reject shared/detached storage. Programmatic canonicalization uses captured internal-slot probes plus one data-descriptor snapshot, rejects accessors without invoking their value getters, and documents the transparent-Proxy limit. Duplicate, UTF-8, I-JSON, JCS, byte, and exact root-depth rules remain enforced. |
| Portable Genesis/Pulse cryptography | Verified across runtimes | RFC 8032 plus canonical, non-small-order, torsion-free prime-subgroup point checks and signed lifecycle vectors are part of the Node, browser-target, and actual-Chromium gate required for each review head. |
| Deterministic validation | Verified | Public validators are total, preserve stable envelope-before-payload first-error precedence, and keep public durable-latent validation supplied-evidence-only. |
| `1-of-1` bootstrap | Verified | Public signed birth/heartbeat and an ephemeral CLI proof adapter. Creator-controlled, not ownerless. |
| `1-of-1` → logical `2-of-3` expansion | Verified | One-process generated-key proof: original sole key becomes insufficient and two eligible signers advance; physical distribution is not established. |
| `2-of-3` continuation | Verified | Current quorum, acceptance signatures, and sufficiency of the supplied next-quorum activation set are enforced. |
| Stateful lineage | Verified | Replay, fork, equivocator, unknown-parent, and post-fork halt tests pass. |
| Mortality observer | P0 implemented; exact-head gate required | The implementation supplies its recognized head privately, freezes mutation surfaces, blocks reentrancy, recursively reconstructs exact-body evidence under sign-once, and requires both irreversible loss and an explicitly complete inventory for death. Honest Proxy-free own-data observer containers are required; only bounded named fields and indices are read, while unrelated properties are ignored without enumeration. Owned-byte acquisition and runtime/dependency integrity checks protect every result, including already-forked results. Seven whole-observation limits additionally bound usable IDs, pending records/bytes, candidate occurrences/canonical bytes, and signature-verification work; the 1,152-unit signature ceiling admits a maximum 16-current/16-new valid transition at 1,088 units with 64 units of headroom. Overflow returns frozen `indeterminate / limit_exceeded` without graph mutation or evidence truncation. |
| Portable adversarial corpus | v4 implemented; exact-head gate required | One v4 corpus combines trust-boundary, incomplete-versus-complete mortality, bounded-observation, same-body completion, equivocation, payload-unavailability, named-negative, and fixed-seed probes. Runtime evidence belongs to the immutable reviewed SHA's Verify run. |
| Node/Chromium equivalence | Required per review head | Committed expected result, Node 22, browser-target realm, and actual Chromium must be byte-identical; a code change invalidates older run evidence. |
| Single-browser incubator | Implemented; exact-head gate required | Three dedicated Workers hold non-extractable WebCrypto keys; the required actual-Chromium gate covers 3/3 birth, one-key rejection, every 2-key heartbeat pair, controlled termination, and the one-physical-domain warning. |
| MortalOS Lab | Implemented; exact-head gate required | The required exact-head browser gate covers reference turnover, mutation, replay, fork, qualified complete-scope mortality, resurrection rejection, clone separation, the portable corpus, canonical public-evidence export/replay, and browser boundary probes. Public HTTPS hosting waits for R1-C and H3B. |
| Stable CLI | Proof only | Creation works in memory; import, persistence, replay, export, and compatibility contract are absent. |
| Independent-participant survival | Not implemented | Requires adapters, signing lifecycle, handoff, and transport. |
| Mutable state/genome execution | Deferred | v0 deliberately preserves the Genesis state root. |
| GPT scenario designer | Not implemented | Model output remains an architectural boundary only. |

## 3. Verification snapshot

Commands:

```bash
npm ci
npm test
npm run test:coverage
npx playwright install chromium
npm run test:chromium
npm run verify:lab
npm run demo:singleton
npm run demo:trace
npm audit --audit-level=moderate
npm pack --dry-run
```

This rolling document does not promote in-progress local output into publication
evidence. Stable committed expectations are:

- 10,000 mixed valid/invalid Node property cases: 1,008 accepts and 8,992 rejects;
- 15 named portable negative codes and 10,000/10,000 seeded portable rejects from
  seed `1297044052`;
- genuine Node Ed25519 conformance for the exact 1,152/+1 remap boundary and maximum
  16-current/16-new transition; the portable browser corpus checks the normalized
  reservation-overflow result rather than replaying that expensive genuine boundary;
- H2 trace format `mortalos-lifecycle-trace/4` with digest
  `19fa3080831cb94f29bfda2e7e1f04f86927057f0823834a6bcbc7d746e25399`; and
- a required branch-coverage floor of 90% for the trusted core.

For every publishable SHA, the immutable exact-head command and GitHub Verify output
must establish the license/spec/governance/conformance/property/Lab/portable/singleton/
H2 gates, committed/Node/browser-target equality, committed/actual-Chromium equality,
actual-browser Lab acceptance, coverage, audit, package, link, and declared secret
checks. `test:chromium` is intentionally the second half of that sequence; standalone
use must run `verify:portable` immediately first. No actual-Chromium result is claimed
for an unverified candidate by this rolling file.

Cross-runtime agreement, coverage, and mutation corpora are strong regression evidence, not a second independent implementation or a security proof.

## 4. Review findings

### Closed — runtime portability was on the trusted path

Trusted `src/` modules now use portable bytes, structural validation, SHA-256, and strict Ed25519. The source gate rejects Node, `Buffer`, filesystem, process, DOM, network, clock, and ambient-random dependencies. Ajv remains development-only to compare the portable structural validators with the normative JSON Schemas.

### Closed — hostile inputs could cross runtime trust boundaries

The kernel now snapshots byte inputs through captured intrinsics, rejects `SharedArrayBuffer`, validates Ed25519 public/signature points under one strict subgroup profile, and makes validation APIs total. Programmatic canonicalization rejects accessors, custom record prototypes, and recognizable internal-slot objects presented as unbranded null-prototype records from one descriptor snapshot; it checks array shape but not array prototypes. Canonical bytes remain the stronger side-effect-free boundary, and the Proxy/exotic limits are explicit in the protocol. Stable first-error precedence is explicit and next-custody transitions cannot be accepted without an activatable supplied quorum. Mortality cannot trust a caller-selected head, leaked or shadowed methods, unsigned evidence labels or placement, fabricated latent result, empty local evidence array, accessors on recognized fields, invalid usable-key representations, or changed realm/dependency state. It accepts only honest Proxy-free ordinary own-data observer containers, reads a fixed named-field/index vocabulary without `ownKeys`, copies hostile byte evidence, recursively discovers target-tuple bodies and exact tagged signatures under occurrence/canonical-byte ceilings, reconstructs exact-body evidence cryptographically, applies sign-once to projected usable keys, tries strict acceptance first, leaves authenticated equivocation unclassified, and lets a completion-capable payload-opaque membership body block an otherwise unsupported death conclusion. Unrecognized caller properties are inert and never evidence. Death requires `authorityLossIrreversible: true` and `latentEvidenceComplete: true`; internal conditional helpers are not re-exported by `src/index.mjs`.

### Residual — JavaScript cannot prove an observer container is not a transparent Proxy

Named `Object.getOwnPropertyDescriptor` and prototype inspection remain trappable for a `Proxy`. A handler can mutate another not-yet-snapshotted source while returning descriptors indistinguishable from an ordinary record. The v0 guarantee therefore trusts the adapter that creates mortality options, arrays, carriers, and completeness assertions to be honest and Proxy-free; it does not trust the contained evidence bytes. The observer never calls `ownKeys` or iterators on those containers, ignores unrecognized properties, and bounds every recognized index. Invalid usable-key representations and malformed, oversized, wrong-type, detached, or otherwise unsnapshotable recognized byte sources intentionally abort the complete observation. That conservative rule prevents false death but permits denial of service by an attacker able to enter the trusted observer inventory.

### High — two bootstrap profiles serve different purposes

The verified CLI singleton uses one key and makes solitary creation minimal, but one
key controls continuation. The implemented local browser incubator lets one person
create with three logical key IDs and a `2-of-3` threshold, but one browser can still
hold quorum and remains one physical failure domain. Closing that sole page can end
its local operational instance under the declared ephemeral-key profile; it does not
by itself prove global protocol death. Neither arrangement proves ownerless
continuation. That stronger claim begins only when no physical or administrative
failure domain controls the accepted threshold.

### High — endpoint neutrality must survive product work

Browser is first because it gives judges a zero-install, visual explanation. It is not the world boundary. CLI, browser, native, service, embedded, and future transport adapters must all submit canonical evidence to the same kernel and reproduce the committed result corpus.

### Medium — accepted-context capability is process-local

The private `WeakSet` correctly prevents forged acceptance objects, but it cannot cross process restart or persistence. A durable application must store canonical evidence and replay it through `createLineage`, never deserialize an acceptance flag.

### Medium — the property corpus has a bounded claim

The property corpus mixes 1,008 baseline-valid continuations with 8,992 signed-field or evidence mutations and checks exact outcomes. Its accepted cases reuse fixed signed fixtures; future lineage fuzzing should generate broader correctly re-signed churn, delayed acceptances, and restart/rebuild sequences.

### Fundamental research gap — no state-bearing life

`state_root` is immutable in v0 and no genome executes. Networking, browser Workers, CLI commands, or GPT integration would not close this gap. A later protocol version must define deterministic state bytes, transition inputs, execution limits, and availability evidence.

## 5. Decision

This tree implements the **P0 integrated mortality-proof and bounded-observation
correction**. It becomes publishable only through immutable-head review and a
successful Verify run for that exact SHA; rolling prose or an older green run is not
evidence.

After P0, use this total order:

`P0 → independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → H3B public deployment → R2`

Register the independent verifier identity, task, and workspace before R1 fixtures
are authored to preserve logical separation. Technical independence comes from the
non-JavaScript implementation restrictions and differential gate, and account-level
independence requires a separate GitHub App or bot. R1-A then freezes a bounded
versioned operation/result byte contract and JavaScript golden corpus for
Genesis/Pulse validation, lineage replay/append/snapshot, fork state, and qualified
mortality. R1-B replays it in independently authored Python without importing the
reference implementation. R1-C moves the Lab onto those wire records.
Malformed, oversized, and unknown-version operations fail closed; process-local
capabilities never cross the wire. This removes JavaScript object-graph acquisition
ambiguity, although `latentEvidenceComplete` remains a deployment policy assertion.

Only after R1-C should **H3B public HTTPS Lab** publish the artifact with required
isolation/security headers and a logged-out judge-path proof. The H3B Lab and future
**C2 stable CLI** must share the wire contract and may not invent private result
shapes. CLI work may proceed after R1-C as non-blocking adapter work, but it cannot
reorder the critical H3B → R2 chain. **R2 deterministic state-bearing execution**
follows H3B.

North Star: authenticated evidence plus participating resources—not a browser, server, CLI, transport, model, or administrator—must determine one entity's identity, executable state, succession authority, and qualified death while every original host can be replaced. R1 first makes today's authority semantics independently reproducible; H3 explains and falsifies them; R2 then adds state-bearing life.

## 6. Documentation policy

Current documentation contains only normative rules, rolling status/plan, access and deployment profiles, traceability, and the submission checklist. Historical audits, verification snapshots, and manual build logs remain in Git history and must not be reintroduced as competing current truth.
