# Durable memory

Last reconciled: 2026-07-16

Branch: `agent/codex-protocol-kernel--north-star-foundation`

Current base: `3a1a4b6f93857d216cac4e4a3c0b2f71007911af`

Original post-PR-#2 base: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`

## Verified project state

- MortalOS currently implements a portable lifecycle/evidence kernel, not yet a
  complete network OS, distributed state machine, or ownerless LLM runtime.
- The trusted `src/` kernel is endpoint-neutral. Publication candidate `9eae8c34`
  produced byte-identical committed, Node 22, isolated browser-target, and actual
  Chromium results. Every changed kernel must rerun the same CI gate.
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
  constructor token blocks chosen-head injection. Within its non-Proxy v0 input
  profile, the operation acquires only bounded named/indexed own-data fields,
  owns all evidence bytes before analysis, blocks reentrant mutation, independently
  pools parseable bodies/signatures/content-addressed sidecars, and maps evidence
  cryptographically per exact body. Usable-key projection obeys observed sign-once
  commitments. Authenticated multi-body signing is `evidence_equivocation`. A
  completion-capable membership body without a verified sidecar becomes
  `evidence_payload_unavailable` only after authority loss is declared irreversible
  and no fresh quorum or verified latent child independently establishes non-death.
  The current P0 candidate fixes whole-observation limits for usable IDs, pending
  records, owned pending bytes, and conservative signature-verification work;
  overflow returns `indeterminate / limit_exceeded` without graph mutation or a
  truncated death decision. Internal conditional helpers are not re-exported by
  `src/index.mjs`.
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
6. The next deep kernel problem is deterministic state: identical valid histories
   must produce the same state root under explicit resource bounds.
7. Agent identity branches preserve scoped memory; implementation work belongs on
   task branches from current `main` in separate worktrees.
8. `reviewer-merge-gate`, not the author agent, decides whether a PR may merge.
9. One validation operation must decide from one owned byte snapshot; callers do
   not control metadata, accepted context, recognized head, or cached latent results.
10. Resource exhaustion is observer uncertainty, not evidence absence. Mortality
    analysis must return indeterminate instead of truncating toward life or death.

## Current priorities

1. Publish the P0 resource-bound candidate after exact-head cross-runtime review.
2. Deploy the verified H3A artifact as an H3B public HTTPS, logged-out judge path
   with the same cross-origin isolation and security-header contract.
3. Specify the minimal deterministic state-bearing organism kernel (R2), the next
   fundamental North-Star gap.
4. Stabilize the C2 CLI create/import/verify/replay/export evidence contract.
5. Delay real transport selection until the same traces pass over an in-memory
   virtual transport with deterministic fault injection.

## Memory maintenance

- Store only facts supported by merged code, specifications, tests, or explicit
  user decisions.
- Replace stale current-state statements instead of accumulating contradictions.
- Preserve completed-task evidence in `WORKLOG.md`.
- Do not store secrets, access tokens, personal information, or hidden reasoning.
