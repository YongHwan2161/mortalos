# Browser participant compatibility

Status: implementation evidence for the current candidate; production support is
claimed only after the exact deployed commit passes the same gate.

MortalOS exposes two deliberately different browser modes.

| Mode | Persistence | Signing authority after reload | Current verified support |
| --- | --- | --- | --- |
| Ephemeral Demo | none | no | Chromium; existing portable kernel also runs in the Node/browser differential target |
| Durable Participant | consent-gated IndexedDB only | yes, until removal or expiry | Chromium 149 local acceptance |

## Durable Participant contract

- The user must select the retention disclosure before creation is enabled.
- The browser creates one non-extractable Ed25519 `CryptoKey`; MortalOS exposes no
  private-key export or transfer path.
- IndexedDB contains exactly three stores: the structured-cloned key, canonical
  public evidence, and versioned expiry/authority metadata. Locale remains URL-only.
- Restore never trusts stored head or verdict fields. It imports canonical evidence,
  replays it through R1, verifies the stored key against current custody, and only
  then exposes signing authority.
- A non-null pending marker, unknown schema, incomplete snapshot, extractable key,
  key/custody mismatch, or incomplete replay fails closed.
- Removing authority atomically deletes the key while retaining public history in a
  read-only state. Expiry performs the same transition during restore.

## Browser downgrade behavior

Durable Participant requires secure-context Web Crypto Ed25519, structured cloning
of a non-extractable `CryptoKey` into IndexedDB, and `indexedDB.databases()` for the
no-implicit-storage check. If any prerequisite is unavailable, the site keeps the
Ephemeral Demo available and does not silently create a weaker or extractable key.

Firefox and WebKit are currently **feature-gated, not claimed supported**. They may
be promoted only after an actual-engine gate proves creation, private-export
rejection, crash/reload recovery, atomic authority removal, and corrupt-database
fail-closed behavior. User-agent detection is forbidden; capability checks and an
honest visible downgrade decide the mode.

## Reproducible evidence

`npm run verify:lab` runs the Chromium lifecycle in a clean isolated profile:

1. storage is zero before consent;
2. one non-extractable key and v1 Genesis are created;
3. a state transition advances the same identity;
4. reload restores the exact head and state through canonical replay;
5. English/Korean switching changes no persisted or protocol value;
6. authority removal deletes the key and preserves public history;
7. reload remains read-only; and
8. an injected stale pending marker is rejected without exposing a head.

This verifies browser/profile isolation and protocol behavior. It does not by itself
prove a distinct physical device or administrative failure domain.
