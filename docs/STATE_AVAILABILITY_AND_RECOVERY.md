# MortalOS R3 state availability and recovery

Current candidate note (2026-08-01): `protocol/profile.v1.json` now generates the
state/transport/provider/confidential ceilings. A 64 KiB state chunk is carried as
two bounded 32 KiB relay fragments, each domain-digested and reassembled only after
exact message/chunk/root verification. Final activation uses expected-prior CAS,
exact readback, and idempotent acceptance of the same already-active candidate. The
publisher owns the outer chunk list and every nested byte array before its first
transport await; recovery accepts only a module-branded destination capability.

Status: **S3 CANDIDATE — receipt, independent review, promotion, and exact-main
deployment required**

This document is the normative S3 protocol ADR. It defines how bounded resource
bytes are committed by a `mortalos/1` state transition and recovered without making
a browser, relay, store, inventory response, or availability label authoritative.

## Fixed formats and ceilings

| Item | Normative value |
| --- | --- |
| Manifest | `mortalos-state-package-manifest/1` |
| Transition sidecar | `mortalos-state-package-transition/1` |
| Receipt | `mortalos-state-package-receipt/1` |
| Input | `mortalos-state-package-input/1` |
| Storage policy | `mortalos-state-recovery-policy/1` |
| Resource representation | raw `application/octet-stream` only |
| Chunk size | 65,536 bytes |
| Maximum resource | 4,194,304 bytes |
| Maximum chunks | 64 |
| Maximum manifest | 32,768 canonical UTF-8 bytes |
| Maximum input / receipt | 4,096 canonical UTF-8 bytes each |
| Recovery sources | 8 |
| Inventory entries per source | 64 |
| Acceptance resource | deterministic 1,048,576 bytes / 16 chunks |

Compression, implicit decoding, sparse chunks, repeated chunk digests, reordered
indices, ambient store defaults, and unbounded inventories are forbidden. This
keeps a compressed or encoded bomb outside the accepted format instead of trying
to estimate its expanded cost.

## Canonical commitment

The manifest contains the exact ordered `{digest,index,size}` chunk descriptors,
resource format and schema version, aggregate resource root, prior and next state
roots, transition-input digest, deterministic receipt digest, genome hash, storage
policy, and the fixed ceilings. All documents use canonical JSON.

SHA-256 is domain-separated with:

- `MORTALOS/STATE-PACKAGE/1/CHUNK\0`;
- `MORTALOS/STATE-PACKAGE/1/RESOURCE\0`;
- `MORTALOS/STATE-PACKAGE/1/INPUT\0`;
- `MORTALOS/STATE-PACKAGE/1/STATE\0`; and
- `MORTALOS/STATE-PACKAGE/1/RECEIPT\0`.

The logical next state root is derived from the manifest's state basis before the
receipt digest is inserted. The receipt then binds that next root, prior root,
resource root and size, input digest, genome hash, chunk count, and storage policy.
The final manifest binds the receipt digest. The Pulse binds the complete canonical
transition sidecar through its existing event-payload hash. There is no
self-referential hash.

## Recovery algorithm

1. Verify the canonical input, manifest, receipt, fixed ceilings, prior root, next
   root, and all domain-separated digests before consulting storage.
2. Read bounded inventories as hints only. An inventory entry never proves that a
   chunk exists or is valid.
3. Fetch only named missing digests through the transport-neutral adapter.
4. Own each returned byte array and verify its exact size and chunk digest before
   placing it in the destination content-addressed store.
5. Re-read every ordered chunk from the destination, reconstruct the exact bounded
   resource, and verify the aggregate resource root.
6. Atomically replace the active verified-state record only after every prior step
   succeeds.

Verified staged chunks may survive interruption. Retrying skips already verified
chunks and is idempotent. An interruption or missing chunk never replaces the last
verified active record. The registered destination capability's `commitActive`
operation MUST stage
the complete next record, exercise all failure boundaries before publication, and
publish atomically. Any thrown or rejected result means the prior active record is
still exact; once the next record is published, the operation MUST resolve as
successful. An adapter that can expose an ambiguous post-publication error does not
implement this contract. Structurally similar caller objects and replaced public
destination methods are never invoked as activation authority.

The transition input is semantic, not merely digest-bound. Construction and
verification both require exactly `mortalos-state-package-input/1`,
`replace-resource`, and a 1–64 character `[A-Za-z0-9._-]` transition identifier.
Unknown versions, operations, or empty/invalid identifiers fail before transition
acceptance even when an attacker recomputes every dependent digest. A constructor
also rejects repeated chunk digests before returning, so it never emits a package
that its verifier refuses.

## Availability result boundary

`available` means that this recovery operation reconstructed and rehashed the exact
resource. `state_unavailable` means that the bounded observation could not obtain
every required chunk. `rejected` means supplied metadata or bytes violated the
contract. These are local recovery results, not lineage acceptance, fork choice,
global availability, or protocol mortality.

The lineage validator accepts only the exact canonical manifest/receipt transition
bound to the parent and next state roots. It does not inspect inventories or fetch
chunks. Conversely, a recovery adapter cannot make an invalid candidate accepted.
Missing bytes never become empty/default state and never contribute to a death
classification.

## Evidence boundary

S3 proves logical recovery on deterministic in-process content-addressed stores and
a transport-neutral adapter. It does not prove confidentiality, independent
physical or administrative failure domains, provider survival, durable browser
quota behavior, or multi-engine browser parity. Those remain S4, S7, and S8 work.
