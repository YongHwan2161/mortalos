# Durable memory

Last reconciled: 2026-07-15  
Branch: `agent/codex-protocol-kernel`  
Fork point: `0a8ce3e2cf09a040758611b3674e92aa32e13c4b`

## Verified project state

- MortalOS currently implements a portable lifecycle/evidence kernel, not yet a
  complete network OS, distributed state machine, or ownerless LLM runtime.
- The trusted `src/` kernel is endpoint-neutral and produces byte-identical corpus
  results in Node.js and actual Chromium.
- A signed `1-of-1` birth is a valid bootstrap profile, but it remains controlled
  by the sole key until custody is transferred.
- Logical `2-of-3` keys held in one browser remain one physical/administrative
  failure domain and therefore do not establish ownerlessness.
- The strong ownerless claim becomes supportable only when no one failure domain
  can satisfy the active threshold.
- Browser-first remains the best demonstration strategy, but the browser is an
  adapter and must not become the authority or protocol boundary.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. All adapters must consume and emit the same canonical evidence.
3. Transport choice must not alter identity, validity, lineage, or mortality.
4. Closing a process, tab, or endpoint is not by itself protocol death.
5. Security claims must distinguish logical key count from independent failure domains.
6. The next deep kernel problem is deterministic state: identical valid histories
   must produce the same state root under explicit resource bounds.

## Current priorities

1. Preserve and verify the portable lifecycle kernel while other agents build adapters.
2. Specify the minimal deterministic state-bearing organism kernel (R2).
3. Provide conformance contracts for the browser Lab (H3) and stable CLI adapter (C2).
4. Delay real transport selection until the same traces pass over an in-memory
   virtual transport with deterministic fault injection.

## Memory maintenance

- Store only facts supported by merged code, specifications, tests, or explicit
  user decisions.
- Replace stale current-state statements instead of accumulating contradictions.
- Preserve completed-task evidence in `WORKLOG.md`.
- Do not store secrets, access tokens, personal information, or hidden reasoning.

