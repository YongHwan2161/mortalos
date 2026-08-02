# Browser participant compatibility

Status: implementation evidence for the current candidate; production support is
claimed only after the exact deployed commit passes the same gate.

MortalOS exposes two deliberately different browser modes.

| Mode | Persistence | Signing authority after reload | Current verified support |
| --- | --- | --- | --- |
| Ephemeral Demo | none | no | Chromium; existing portable kernel also runs in the Node/browser differential target |
| Durable Participant | consent-gated IndexedDB schema v2 | yes, until explicit removal or reached expiry | Chromium and Firefox candidate gates; WebKit capability-routed per runtime |

## Durable Participant contract

- The user must select the retention disclosure before creation is enabled.
- The browser creates one non-extractable Ed25519 `CryptoKey`; MortalOS exposes no
  private-key export or transfer path.
- IndexedDB contains one atomic versioned participant document with the
  structured-cloned key, canonical public evidence, state references, sign-once
  journal, recoverable pending operation, replay-derived cache, migration, and
  expiry/authority metadata. Each replacement is a consecutive expected-revision
  compare-and-swap inside one strict transaction. Successful v1 migration retires
  the legacy `evidence`, `keys`, and `meta` stores in that same version-change
  transaction, so no parallel sign-capable key path remains. Locale remains
  URL-only.
- Restore never trusts stored head or verdict fields. It imports canonical evidence,
  replays it through R1, verifies the stored key against current custody, and only
  then exposes signing authority.
- Unknown schema, incomplete commissioned evidence, extractable/corrupt key,
  key/custody mismatch, partial journal, pending/body mismatch, state mismatch, or
  incomplete replay fails closed. A valid pending marker is recoverable, not a
  blanket rejection.
- Removing authority atomically deletes the key while retaining public history in a
  read-only state. Reaching expiry persists an expired-policy latch, so same-process
  and cold-restart clock rollback cannot restore signing. Explicit renewal requires
  a non-null expiry strictly beyond the persisted observation high-water mark;
  null, stale, and equal renewals are rejected without clearing the expired state.
  Explicit removal deletes the key.

## Browser downgrade behavior

Durable Participant requires secure-context Web Crypto Ed25519, structured cloning
of a non-extractable `CryptoKey` into IndexedDB, and `indexedDB.databases()` for the
no-implicit-storage check. If any prerequisite is unavailable, the site keeps the
Ephemeral Demo available and does not silently create a weaker or extractable key.

Firefox now passes the same actual-engine creation, non-extractable-key, concurrent
CAS, full process restart, expiry/removal, A/B/C loss, D repair, S4 rotation, and
corruption boundaries in the current candidate. It remains unpromoted until the
  exact-head release gate passes. The capability gate requires actual Ed25519
  sign/verify at 1, 1,024, and the canonical 65,536-byte message ceiling; key
  generation alone never grants custody. The Windows Playwright WebKit 26.5 build
  rejects Ed25519 with `NotSupportedError`. The Ubuntu build creates a valid
  non-extractable key and signs smaller vectors, but returned `OperationError` in the
  full S2 quorum path, so both builds are verifier-only. The protocol-ceiling stress
  probe runs in a disposable browser process; a signer crash is classified as missing
  custody capability without taking down the portable verifier. User-agent detection
  and exportable-key fallback are forbidden.

## Reproducible evidence

`npm run verify:lab` runs the Chromium lifecycle in a clean isolated profile.
`npm run test:browser-parity` applies the portable corpus plus the complete S2/S4
scenario family to Chromium and Firefox. WebKit runs that same family only when the
capability probe finds a native non-extractable signer that also passes the protocol-
ceiling sign/verify gate; otherwise only the portable verifier runs and signing stays
visibly disabled:

1. storage is zero before consent;
2. one non-extractable key and v1 Genesis are created in durable schema v2;
3. a state transition advances the same identity;
4. reload restores the exact head and state through canonical replay;
5. English/Korean switching changes no persisted or protocol value;
6. authority removal deletes the key and preserves public history;
7. reload remains read-only; and
8. an injected state-reference mismatch is rejected without exposing a head.

`npm run test:durable-quorum` additionally closes the target browser process after
handoff, cold-restores `100/100`, and runs every A/B/C one-loss/D-repair matrix
`100/100`. It also proves valid v1→v2 migration and that corrupt migration leaves the
version-1 copy unchanged. An actual IndexedDB two-instance race proves the stale
writer fails before its signer runs, and inconsistent `removed + key` or
`active + no key` legacy snapshots remain at version 1.

This verifies browser/profile isolation and protocol behavior. It does not by itself
prove a distinct physical device or administrative failure domain.
