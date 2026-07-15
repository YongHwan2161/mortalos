# Durable memory

Last reconciled: 2026-07-15

Branch: `agent/codex-protocol-kernel--trust-boundaries`

Fork point: `ec59f9cd17c99c972321e2fabbd7bee7a5735ff3`

## Verified project state

- MortalOS currently implements a portable lifecycle/evidence kernel, not yet a
  complete network OS, distributed state machine, or ownerless LLM runtime.
- The trusted `src/` kernel is endpoint-neutral. Its versioned corpus produces
  byte-identical committed, Node.js, and isolated browser-target results; actual
  Chromium remains a required immutable-head CI gate for every changed kernel.
- Byte acquisition uses captured typed-array intrinsics and owned snapshots;
  shared storage, detached storage, hostile metadata, and non-I-JSON programmatic
  values fail closed.
- Ed25519 identity and evidence use one strict canonical prime-subgroup profile.
- Public validators are total with stable first-error precedence. Membership
  changes also prove that supplied evidence can activate the declared next quorum.
- Mortality is a lineage operation over its recognized head. It independently pools
  parseable candidate bodies, signature strings, and content-addressed sidecars;
  cryptographically maps evidence per exact body; then combines every candidate with
  the same one-shot global usable-key snapshot. Its internal conditional validator is
  intentionally not re-exported by the supported `src/index.mjs` API, reentrant
  mutation is blocked, and distinct recomposed valid siblings record a fork before
  mortality.
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
7. Agent identity branches preserve scoped memory; implementation work belongs on
   task branches from current `main` in separate worktrees.
8. `reviewer-merge-gate`, not the author agent, decides whether a PR may merge.
9. One validation operation must decide from one owned byte snapshot; callers do
   not control metadata, accepted context, recognized head, or cached latent results.

## Current priorities

1. Deliver H3 MortalOS Lab as a thin, falsifiable visual adapter over the same kernel.
2. Specify the minimal deterministic state-bearing organism kernel (R2), the next
   fundamental North-Star gap.
3. Stabilize the C2 CLI create/import/verify/replay/export evidence contract.
4. Delay real transport selection until the same traces pass over an in-memory
   virtual transport with deterministic fault injection.

## Memory maintenance

- Store only facts supported by merged code, specifications, tests, or explicit
  user decisions.
- Replace stale current-state statements instead of accumulating contradictions.
- Preserve completed-task evidence in `WORKLOG.md`.
- Do not store secrets, access tokens, personal information, or hidden reasoning.
