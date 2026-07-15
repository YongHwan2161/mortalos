# Single-Browser Incubator Profile

Status: **planned browser deployment profile; hardened portable protocol core verified**

Protocol: `mortalos/0`

## 1. Purpose

One person opening one page should be able to create a new organism without recruiting other people or devices, while visually demonstrating quorum and later handoff.

The browser profile will:

1. start three dedicated in-memory custodian Workers;
2. generate and retain one non-persisted Ed25519 key per Worker;
3. obtain all three Genesis approvals;
4. create a `2-of-3` continuation descriptor;
5. allow valid membership handoffs to independent endpoints; and
6. lose all local continuation authority if the sole page closes before handoff, under controlled ephemeral-key assumptions.

The repository now contains the hardened portable validator and an actual-Chromium differential runner. Publication candidate `9eae8c34` produced the same portable v3 result in Node 22, the isolated browser-target VM, and actual Chromium CI; every changed head must rerun that gate. The cross-runtime corpus covers hostile byte metadata, strict points, falsey roots, and deterministic outcomes; Node conformance additionally covers stable first-error precedence and next-quorum activation insufficiency. Shared-memory rejection runs in Node and the isolated browser-target VM; an actual-browser `SharedArrayBuffer` case requires cross-origin isolation and remains an H3 deployment test. The repository does not yet contain the incubator Workers, browser signing, or remote handoff.

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
| Sole-browser incubator | 3 | 1 | One person can create and continue; closing the page loses local authority under assumptions. |
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

This does not delete public history and is not a globally provable death certificate. A modified browser could copy a key, or independently carried body-bound signatures and a matching sidecar could still compose a successor. The UI must use qualified wording and ask `Lineage#evaluateMortality` to reconstruct raw pending components against the recognized head with one explicit usable-key observation; it must never supply its own head or cached latent verdict.

After enough valid handoffs move authority to other failure domains, the original page may close while the same lineage continues.

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

A second run closes before handoff and shows that public evidence alone cannot create the next valid Pulse.
