# Contributing to MortalOS

MortalOS is licensed under the [Apache License 2.0](LICENSE). Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this repository is provided under the same Apache-2.0 terms, without additional conditions.

## Before opening a change

1. Preserve the protocol invariants in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
2. Update [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) in the same change when modifying an invariant, message field, domain separator, validation precedence, or threat assumption.
3. Add a deterministic positive or negative conformance case for every validator behavior change.
4. Run the complete gate:

   ```bash
   npm ci
   npm test
   npm run test:coverage
   ```

5. Never commit production private keys, API keys, tokens, `.env` files, or private signing material. Conformance vectors must contain only public verification material.

## Scope discipline

The H1 validator is the authority for protocol validity. UI, transport, storage, network observations, and AI output may propose or explain inputs but must not bypass or redefine validator results.
