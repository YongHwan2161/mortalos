# Durable memory

Last reconciled: 2026-07-15

Branch: `agent/codex-protocol-kernel--mortality-proof-correction`

Fork point: `f08c8be0fa43d86d706d67dfc56f577cf1a90f72`

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
  profile, the operation captures own-data observer options and pending records,
  owns all evidence bytes before analysis, blocks reentrant mutation, independently
  pools parseable bodies/signatures/content-addressed sidecars, and maps evidence
  cryptographically per exact body. Usable-key projection obeys observed sign-once
  commitments. Authenticated multi-body signing is `evidence_equivocation`. A
  completion-capable membership body without a verified sidecar becomes
  `evidence_payload_unavailable` only after authority loss is declared irreversible
  and no fresh quorum or verified latent child independently establishes non-death.
  Internal conditional helpers are not
  re-exported by `src/index.mjs`.
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
