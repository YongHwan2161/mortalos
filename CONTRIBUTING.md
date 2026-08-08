# Contributing to MortalOS

MortalOS is licensed under the [Apache License 2.0](LICENSE). Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this repository is provided under the same Apache-2.0 terms, without additional conditions.

## Before opening a change

1. Preserve the normative rules and invariants in [`docs/PROTOCOL.md`](docs/PROTOCOL.md) and [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).
2. Update [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) in the same change when modifying an invariant, message field, domain separator, validation precedence, or threat assumption.
3. Add a deterministic positive or negative conformance case for every validator behavior change.
4. Run the complete gate:

   ```bash
   npm ci
   npm test
   npm run test:coverage
   npx playwright install chromium
   npm run test:chromium
   ```

   For a focused change to direct participant placement, run the shorter gate
   while iterating, then the complete gate before publication:

   ```bash
   npm run test:p2p-placement
   npm run test:sdk
   npm run verify:sdk-package
   npm run verify:security-boundaries
   ```

5. Never commit production private keys, API keys, tokens, `.env` files, or private signing material. Conformance vectors must contain only public verification material.

## Scope discipline

The deterministic core is the authority for transition validity. Recognized-head, replay, and fork behavior must go through `createLineage`; callers may not persist or fabricate acceptance-result objects. UI, transport, storage, network observations, and AI output may propose or explain inputs but must not bypass or redefine core results.

Changes to portable consensus logic must produce identical results in every supported runtime. Platform adapters may provide bytes and cryptographic primitives, but they may not change canonicalization, validation order, rejection codes, or lineage decisions.

Direct transport is not an authority. A DataChannel, relay, signaling helper, or
provider label may carry bytes but may not make an offer, lease, receipt, placement,
or recovery valid. Placement changes must retain the signed resource-contract checks
and add corrupt, stale, future-time, wrong-workload, duplicate-provider,
duplicate-shard, provider-loss, journal-replay, custody-successor, and repair
coverage. Provider data must remain S4 ciphertext-only in the confidential path;
placement succession creates successor-owned leases and never transfers a private
consumer or custodian key.
