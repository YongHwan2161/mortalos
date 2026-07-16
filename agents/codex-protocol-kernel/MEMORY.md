# Durable memory

Last reconciled: 2026-07-16

Branch: `agent/codex-protocol-kernel--north-star-foundation`

Current base: `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`

Original post-PR-#2 base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`

## Verified project state

- MortalOS currently implements a portable lifecycle/evidence kernel, not yet a
  complete network OS, distributed state machine, or ownerless LLM runtime.
- The trusted `src/` kernel is endpoint-neutral. Every changed review head must
  reproduce the committed result byte-for-byte in Node 22, the isolated
  browser-target, and actual Chromium; older exact-head evidence does not cover new
  code.
- Byte acquisition uses captured typed-array intrinsics and owned snapshots.
  Programmatic canonicalization uses captured internal-slot probes and one
  data-descriptor snapshot; shared/detached storage, recognized exotica,
  accessors, hostile metadata, and non-I-JSON values fail closed. Canonical byte
  parsing remains the stronger boundary for transparent Proxies and
  indistinguishable host objects.
- Ed25519 identity and evidence use one strict canonical prime-subgroup profile.
- Public validators are total with stable first-error precedence. Membership
  changes also prove that supplied evidence can activate the declared next quorum.
- Mortality is a lineage operation over its recognized head. A module-private
  constructor token blocks chosen-head injection. Within its Proxy-free v0 input
  profile, the operation acquires only bounded named/indexed fields, owns and parses
  every declared carrier or aborts, checks captured realm/dependency state plus
  SHA-256/RFC 8032 known answers, recursively discovers target bodies and exact
  tagged signatures, and maps evidence cryptographically per exact body. Death
  requires exact irreversibility and an explicitly complete evidence inventory;
  missing/false completeness remains `authority_unavailable_not_proven_dead`.
  Usable-key projection obeys observed sign-once commitments. Authenticated
  multi-body signing is `evidence_equivocation`; payload opacity remains
  unclassified. Five whole-observation limits cover usable-ID count/UTF-16 code
  units, pending records, owned pending bytes, and attacker-proportional signature
  work; overflow returns `indeterminate / limit_exceeded` without graph mutation or
  truncation. Unknown observer fields are ignored and are not evidence. The trusted
  producer must use documented carriers and assert completeness honestly.
- A signed `1-of-1` birth is a valid bootstrap profile, but it remains controlled
  by the sole key until custody is transferred.
- Logical `2-of-3` keys held in one browser remain one physical/administrative
  failure domain and therefore do not establish ownerlessness.
- The strong ownerless claim becomes supportable only when no one failure domain
  can satisfy the active threshold.
- Browser-first remains the best demonstration strategy, but the browser is an
  adapter and must not become the authority or protocol boundary.
- H3A now provides a local one-page Lab: three non-extractable Worker keys,
  live logical `2-of-3` incubation, fixed reference falsification experiments,
  full corpus replay, and canonical public-evidence export/replay. It remains
  one physical/administrative failure domain and is not yet publicly hosted.

## Stable design decisions

1. Creation is a protocol operation, not a browser privilege.
2. All adapters must consume and emit the same canonical evidence.
3. Transport choice must not alter identity, validity, lineage, or mortality.
4. Closing a process, tab, or endpoint is not by itself protocol death.
5. Security claims must distinguish logical key count from independent failure domains.
6. The next architectural problem is a canonical bounded operation/result record
   plus an independently written non-JavaScript verifier; the next deep state problem
   is deterministic execution under explicit resource bounds.
7. Agent identity branches preserve scoped memory; implementation work belongs on
   task branches from current `main` in separate worktrees.
8. `reviewer-merge-gate`, not the author agent, decides whether a PR may merge.
9. One validation operation must decide from one owned byte snapshot; callers do
   not control metadata, accepted context, recognized head, or cached latent results.
10. Resource exhaustion is observer uncertainty, not evidence absence. Mortality
    analysis must return indeterminate instead of truncating toward life or death.
11. An empty pending list is not proof of completeness. Death requires the exact
    completeness assertion, and any declared-carrier/runtime uncertainty aborts.
12. JavaScript object graphs are not the long-term evidence contract. R1 must use
    canonical bytes; transparent Proxy honesty and hidden-copy absence cannot be
    inferred by the v0 verifier.
13. Bounded carrier bytes do not bound recursive canonical work. Candidate
    occurrences and aggregate canonical bytes need independent whole-observation
    limits before retention.
14. Signature work must be exhaustive and order-invariant. Cache only an exact
    body/domain/signer/signature result, and keep fork results behind the same
    runtime/dependency integrity gate.

## Current priorities

1. Publish the reconciled P0 mortality candidate after exact-head cross-runtime,
   actual-browser Lab, policy, and independent review.
2. Implement R1 canonical bounded operation/result bytes and an independent
   non-JavaScript verifier.
3. Deploy H3B as a thin R1-consuming public HTTPS, logged-out judge path with the
   same cross-origin isolation and security-header contract.
4. Specify the minimal deterministic state-bearing organism kernel (R2), the next
   fundamental state gap.
5. Stabilize the C2 CLI create/import/verify/replay/export contract over R1 records.
6. Delay real transport selection until the same traces pass over an in-memory
   virtual transport with deterministic fault injection.

## Memory maintenance

- Store only facts supported by merged code, specifications, tests, or explicit
  user decisions.
- Replace stale current-state statements instead of accumulating contradictions.
- Preserve completed-task evidence in `WORKLOG.md`.
- Do not store secrets, access tokens, personal information, or hidden reasoning.
