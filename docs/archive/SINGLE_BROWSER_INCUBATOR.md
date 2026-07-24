# Single-browser incubator and profile boundary

> Historical profile — retained for the original single-browser experiment and
> regression context. It is not a current product roadmap or release instruction.

Status: **legacy L0 profile retained as advanced evidence; L2/L3 candidate uses
isolated browser participants and must pass exact production acceptance before public
promotion**

Protocol profiles: `mortalos/0` and `mortalos/1`

## Purpose

The original incubator lets one person visualize Genesis, quorum, heartbeat,
turnover, fork, and observer-relative mortality in one page. It creates three
in-memory non-extractable Ed25519 Worker keys and a logical `2-of-3` descriptor.
That remains useful protocol evidence, but it is deliberately no longer the main
product story.

## Profiles are different claims

| Profile | Persistence | What it proves | What it does not prove |
| --- | --- | --- | --- |
| CLI singleton | process memory | smallest valid `1-of-1` birth and continuation | ownerless authority |
| Ephemeral single-browser incubator | none | logical quorum and controlled local key loss | independent failure domains |
| Durable Participant | consent-gated IndexedDB | one endpoint can recover its non-extractable key and replay state after reload | key transfer or cross-browser succession by itself |
| Two-browser succession | endpoint-local keys | A→B accepted custody handoff and B continuation after A closes | `2-of-3` resilience |
| Three-endpoint quorum | endpoint-local keys | any complementary pair can continue and repair after one loss | three people, organizations, or physical devices |

The single-browser incubator has three logical custodian slots but one physical
failure domain. One process that holds two or three current keys can advance by
itself. Therefore UI labels and documentation must never call that profile
independently distributed or ownerless.

## Exact quorum meaning

- Birth requires every initial custodian to approve.
- A `2-of-3` Pulse needs signatures from two distinct eligible `key_id` values.
- One current key is insufficient.
- The protocol counts keys, not people, tabs, devices, or organizations.
- Independent control is external deployment evidence, not a validator predicate.

## Ephemeral close and mortality

Closing the incubator page terminates its dedicated Workers and removes locally
usable keys under the declared demo assumptions. This proves local authority loss,
not universal erasure. Public history remains, a modified client might have copied a
key, and separately carried signatures or sidecars might still compose a successor.

Consequently, public evidence alone cannot create the next valid Pulse, but browser
closure alone is also not a global death certificate. A live endpoint loss is shown
as `stalled` or read-only unless the observer separately supplies an explicit,
complete, irreversible evidence basis required by the mortality profile.

## Browser constraints

The Ephemeral Demo must:

- use dedicated Workers rather than a Service Worker;
- create no IndexedDB, local/session storage, cache, cookie, or key restoration;
- keep one non-extractable private key per Worker and export only public keys and
  signatures;
- import the same portable validator used outside the UI; and
- disclose its single failure domain.

The Durable Participant must:

- require explicit retention consent;
- store exactly the structured-cloned non-extractable key, canonical public evidence,
  and versioned expiry/authority metadata;
- replay evidence through R1/state validation on restore instead of trusting a stored
  head or verdict; and
- fail closed on pending, corrupt, stale, extractable, or custody-mismatched state.

## Required reproducible evidence

`npm run verify:lab` must show both boundaries in actual Chromium:

1. Ephemeral mode starts with and leaves no durable browser storage.
2. Durable mode creates one non-extractable key only after consent.
3. A state transition changes sequence and root, then survives reload by canonical
   replay.
4. English/Korean switching changes no key, evidence, identity, or protocol value.
5. Removing authority deletes the key and preserves read-only public history.
6. A stale pending marker restores no authority or trusted head.
7. A→B handoff keeps the same identity; premature A loss leaves B stalled.

The canonical judge host is <https://mortal-os.com/>. `pages.dev` is incident
fallback, and the separate Sites artifact is historical recovery evidence only.
