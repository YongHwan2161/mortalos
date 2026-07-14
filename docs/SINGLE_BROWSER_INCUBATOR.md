# Single-Browser Incubator Profile

Status: **Planned browser deployment profile; protocol core implemented in Node.js**

Protocol: `mortalos/0`

## 1. Required user experience

One person opening one page must be able to create a new organism without recruiting other people or devices.

The browser profile will:

1. start three dedicated in-memory custodian Workers;
2. generate and retain one non-persisted Ed25519 key per Worker;
3. obtain all three Genesis approvals;
4. create a `2-of-3` continuation descriptor;
5. allow valid membership handoffs to independent browsers; and
6. lose all local continuation authority if the sole page closes before handoff, under the controlled ephemeral-key assumptions.

The current repository validates Genesis, Pulses, handoffs, lineage, and mortality in Node.js. It does not yet contain these Workers, browser signing, or remote handoff.

## 2. Exact meaning of `2-of-3`

`2-of-3` counts distinct eligible custodian `key_id` values.

- Birth requires `3-of-3`: every initial key proves possession and consent.
- After birth, any two current keys may approve a Pulse.
- One current key cannot advance.
- One process that holds two or three current keys can advance by itself.

The protocol cannot infer how many people, tabs, browsers, devices, or organizations control those keys.

## 3. Logical quorum versus physical resilience

The sole-browser profile has three logical custodian slots but one physical failure domain.

| Profile | Logical custodians | Physical failure domains | Consequence |
|---|---:|---:|---|
| Sole-browser incubator | 3 | 1 | One person can create and continue; closing the page loses all local authority. |
| Two-domain mixed handoff | 3 | 2 | Resilience depends on whether either domain controls two keys. |
| Three independent browsers | 3 | 3 | Loss of one browser leaves two keys able to continue or repair. |

Independent-host resilience exists only when no one physical or administrative failure domain controls `threshold` current keys. This is deployment evidence, not a validator predicate.

## 4. Close and mortality semantics

Before handoff:

```text
three volatile keys in one page
  -> page reloads, crashes, or closes
  -> zero locally usable current keys
  -> no new local quorum can sign
  -> authority lost under controlled ephemeral-key assumptions
```

This does not delete public history and is not a globally provable death certificate. A modified browser could copy a key, or a previously signed latent successor could remain deliverable. The UI must use qualified wording and evaluate known pending evidence.

After enough valid handoffs move authority to other failure domains, the original page may close while the same lineage continues.

## 5. Browser constraints

The implementation must:

- use dedicated Workers, not a Service Worker designed to outlive the page;
- use the C1 portable validator, never a UI-specific validity path;
- generate non-extractable WebCrypto keys where supported;
- avoid IndexedDB, local/session storage, restoration, analytics, and logs for private keys;
- keep one private key per Worker and exchange only public keys, signing requests, and signatures;
- disclose failure-domain concentration; and
- reconstruct accepted context only from canonical evidence.

Workers and non-extractable keys reduce accidental persistence. They do not prove erasure against a modified browser or compromised operating system.

## 6. Required demonstration

```text
one page creates Genesis
  -> any two local Workers sign a heartbeat
  -> browsers D, E, and F accept successive handoffs
  -> every incubator key is replaced
  -> original page closes
  -> the same organism_id continues
```

A second run closes before handoff and shows that public evidence alone cannot create the next valid Pulse.
