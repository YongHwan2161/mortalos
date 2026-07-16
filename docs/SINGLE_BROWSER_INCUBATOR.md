# Single-Browser Incubator Profile

Status: **H3A/H3B/R1 merged; public Sites judge path live; direct H3B Pages release unverified; every publishable SHA requires actual-Chromium evidence**

Protocol: `mortalos/0`

## 1. Purpose

One person opening one page should be able to create a new organism without recruiting other people or devices, while visually demonstrating quorum and later handoff.

The local browser profile does:

1. start three dedicated in-memory custodian Workers;
2. generate and retain one non-persisted Ed25519 key per Worker;
3. obtain all three Genesis approvals;
4. create a `2-of-3` continuation descriptor;
5. run a fixed public reference lineage through complete custodian turnover; and
6. demonstrate local authority loss by controlled Worker termination under explicit
   ephemeral-key assumptions.

The repository contains the hardened portable validator, three dedicated custodian
Workers, browser signing, a reference falsification Lab, a static build, and
actual-Chromium acceptance. Every changed review head must reproduce the same
portable v4 result in Node, the isolated browser-target VM, and actual Chromium.
The cross-origin-isolated Lab test additionally exposes `SharedArrayBuffer` and proves
that SAB-backed validator input is rejected. The Lab checks non-extractable/sign-once
Worker keys, all three quorum pairs, public-evidence export/replay, storage and Service
Worker absence, request/console cleanliness, narrow viewport, and reduced motion. It
does not implement remote handoff or prove independent failure domains.

## 2. Relationship to the singleton profile

MortalOS also verifies a simpler CLI `1-of-1` bootstrap. The two profiles are alternatives:

| Profile | Logical lesson | Limitation |
|---|---|---|
| CLI singleton | The smallest valid birth can be created by any endpoint. | One key has unilateral continuation and fork authority. |
| Single-browser `2-of-3` | Quorum, key slots, and handoff can be shown visually in one page. | One browser still controls quorum and is one failure domain. |
| Distributed `2-of-3` | No one domain can continue alone. | Requires real distribution evidence and participant adapters. |

A valid membership handoff can move either bootstrap toward distributed custody without rebirth.

## 3. Exact meaning of `2-of-3`

`2-of-3` counts distinct eligible custodian `key_id` values.

- Birth requires `3-of-3`: every initial key proves possession and consent.
- After birth, any two current keys may approve a Pulse.
- One current key cannot advance.
- One process that holds two or three current keys can advance by itself.

The protocol cannot infer how many people, tabs, browsers, devices, or organizations control those keys.

## 4. Logical quorum versus physical resilience

The sole-browser profile has three logical custodian slots but one physical failure domain.

| Profile | Logical custodians | Physical failure domains | Consequence |
|---|---:|---:|---|
| Sole-browser incubator | 3 | 1 | One person can create and continue; closing the page loses local authority under assumptions but is not itself global death. |
| Two-domain mixed handoff | 3 | 2 | Resilience depends on whether either domain controls two keys. |
| Three independent endpoints | 3 | 3 | Loss of one endpoint leaves two keys able to continue or repair. |

Independent-host resilience exists only when no one physical or administrative failure domain controls `threshold` current keys. This is deployment evidence, not a validator predicate.

## 5. Close and mortality semantics

Before handoff:

```text
three volatile keys in one page
  -> page reloads, crashes, or closes
  -> zero locally usable current keys
  -> no new local quorum can sign
  -> authority lost under controlled ephemeral-key assumptions
```

This does not delete public history and is not a globally provable death certificate. A modified browser could copy a key, or independently carried body-bound signatures and a matching sidecar could still compose a successor. The UI must describe the immediate result as local authority loss or local disappearance. R1 now supplies bounded canonical operation/result bytes for its committed corpus profile, but the full H3A experiment still uses a trusted Proxy-free own-data adapter until R1-C consumes that wire contract end to end; raw evidence remains hostile. Only the documented named fields and bounded indices are read; unrelated properties are ignored and cannot contribute evidence. Recognized accessors, invalid key representations, or any malformed, oversized, wrong-type, detached, or otherwise unsnapshotable declared byte source abort the whole observation as uncertainty and must be shown as such. The seven whole-observation limits return frozen unclassified overflow rather than analyze a truncated inventory. The adapter must never supply its own head or cached latent verdict. The controlled reference fixture may set both `authorityLossIrreversible: true` and `latentEvidenceComplete: true` because its local evidence inventory is closed and explicitly enumerated. Live-incubator Worker retirement sets both to false: closing the page demonstrates local disappearance but is not a complete death basis. An omitted or false completeness flag, or an empty array alone, remains `authority_unavailable_not_proven_dead`.

## 6. Browser constraints

The implementation must:

- use dedicated Workers, not a Service Worker designed to outlive the page;
- import the portable validator, never a UI-specific validity path;
- generate non-extractable WebCrypto keys where supported;
- avoid IndexedDB, local/session storage, restoration, analytics, and logs for private keys;
- keep one private key per Worker and exchange only public keys, signing requests, and signatures;
- disclose failure-domain concentration; and
- reconstruct accepted context only from canonical evidence.

Workers and non-extractable keys reduce accidental persistence. They do not prove erasure against a modified browser or compromised operating system.

## 7. Required demonstration

```text
one page creates Genesis
  -> any two local Workers sign a heartbeat
  -> browsers or other endpoints D, E, and F accept successive handoffs
  -> every incubator key is replaced
  -> original page closes
  -> the same organism_id continues
```

A second run closes before handoff and shows immediate local authority loss: public evidence alone cannot create the next valid Pulse. It must separately show the difference between an incomplete evidence view (`authority_unavailable_not_proven_dead`) and a controlled, explicitly complete successor-free view (`dead_under_v0_assumptions`).
