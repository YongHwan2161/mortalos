# Durable memory

Last reconciled: 2026-07-16

Branch: `agent/codex-protocol-kernel--mortality-proof-reconcile-main`

Current base: `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`

## Verified project state

- MortalOS implements a portable lifecycle/evidence kernel, not yet a network OS,
  distributed state machine, or ownerless model runtime.
- H3A is implemented: one page can create a logical `2-of-3`
  lineage with three non-extractable Worker keys, but that remains one physical
  failure domain. Live Worker retirement reports local disappearance, not death;
  every publishable head still requires exact-head Chromium/Lab evidence.
- Base `3a1a4b6` permits a false-death classification because irreversible key loss
  does not independently establish that the latent-evidence inventory is complete.
  PR #9 is a concurrent mutable branch whose exact head must be re-fetched before
  comparison. Its historical `12cee117367dbe0afe0c0650c5bbdf24e8fbf53f`
  observation lacked the final bounded named-field/all-key correction; the latest
  2026-07-16 observation, `13428fa6905508c0a97649ebf46b9e4826f98403`,
  remained blocked under review `4710440852` because acquisition-triggered runtime
  poison could escape as a normal pre-semantic limit result.
- This P0 tree requires both irreversible authority loss and explicit
  evidence completeness, owns recognized hostile bytes, checks runtime/dependency
  integrity, and leaves forks, equivocation, missing completion payloads, and every
  limit overflow unclassified. Publication still requires immutable-head review and
  the exact SHA's Verify run.
- The mortality adapter reads only five option fields, two carrier fields,
  bounded lengths, and bounded own-data indices. It never enumerates caller keys or
  invokes caller iterators. Other properties are inert and cannot supply evidence;
  recognized accessors and malformed recognized sources abort.
- Seven fixed whole-operation limits cover usable IDs/characters, pending
  records/bytes, target-body occurrences/canonical bytes, and conservative signature
  work. Candidate occurrences reserve before JCS and canonical bytes reserve before
  retention. The signature maximum is 1,152: the maximum 16-current/16-new valid
  transition uses 1,088 with 64 units of headroom. Overflow is privately branded,
  frozen, graph-atomic, and retryable.
- Target-body/signature discovery is recursive and exact-body scoped. Usable-key
  projection obeys sign-once commitments. Authenticated multi-body signing is
  `evidence_equivocation`; payload-opaque membership evidence blocks only an
  otherwise unsupported death result after declared irreversibility.
- JavaScript cannot prove that an observer container is not a transparent Proxy.
  R1 must replace this call-entry object graph with canonical versioned raw
  operation/result bytes and an independently written non-JavaScript verifier.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. Closing a process, tab, or endpoint is not by itself protocol death.
3. `dead_under_v0_assumptions` requires separate true irreversibility and evidence-
   completeness assertions; an empty local array never proves completeness.
4. Resource exhaustion never truncates evidence into a life/death classification.
5. Only named observer fields and bounded indices have meaning; unrelated caller
   properties are ignored without enumeration.
6. Logical key count and independent failure-domain count are different claims.
7. All adapters must consume and emit one canonical evidence contract; transport,
   storage, UI, and model output never decide validity.
8. `reviewer-merge-gate`, not the author agent, decides whether a PR may merge.
9. One shared GitHub account can preserve logical agent/worktree separation, but
   account-level author/reviewer independence needs a separate GitHub App or bot.

## Current priorities

1. Publish this P0 implementation only after immutable-head review and Verify; do not
   treat blocked PR #9 as mergeable evidence.
2. Follow the critical order: P0 → independent-verifier registration → R1-A
   JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption →
   H3B public deployment → R2 deterministic state-bearing execution.
3. Preserve logical verifier separation through its identity/task/workspace and
   technical independence through non-JavaScript restrictions and golden
   differential; use a separate GitHub App/bot for account-level independence.
4. Stable CLI adapter work may proceed after R1-C but cannot reorder H3B → R2.

## Memory maintenance

- Store only facts supported by merged code, current candidate evidence, tests, or
  explicit user decisions; label candidates as unmerged.
- Replace stale current-state statements instead of accumulating contradictions.
- Preserve completed-task evidence in `WORKLOG.md`.
- Do not store secrets, access tokens, personal information, or hidden reasoning.
