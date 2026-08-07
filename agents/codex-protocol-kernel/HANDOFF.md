# Handoff and shared-path intent

Historical declarations are preserved in Git history and `WORKLOG.md`; they are
not active locks.

## Active intent

### NEXT — Receipt-gated participant placement and repair

- The lease-bound execution vertical is merged by PR #56 at
  `0779741402244d6cd802a1179bd2c94555bdd030` after exact-head CI, independent
  BLOCK remediation/re-review, GitHub App attestation, machine-user native approval,
  and no-bypass expected-head squash merge.
- Exact-main Verify `31215007053` passed protocol and browser parity; Deploy
  `31215005995` passed exact-source publication plus public artifact, relay, and
  bilingual-path readback.
- The first closeout CI run then failed only its live dependency audit after GitHub
  advisory `GHSA-2v37-7h3g-55p8` was refreshed. The compatible transitive lock is
  patched from `nanoid@3.3.16` to `3.3.18`; no runtime source or direct dependency
  changed, and a fresh zero-vulnerability audit plus exact-head CI are required.
- The next implementation must compose untrusted offer gossip, mutual leases, the
  real participant transport, verified execution receipts, Continuity Capsules, and
  repair into one backend-free useful-resource workflow.
- Placement may become usable only when
  `evaluateResourceExecutionContract(...).execution_status === "proved"` for the
  exact workload and lease. Provider loss must create a new lease and preserve the
  workload/lineage identity; stale or single-copy evidence must never schedule work.
- Discovery, signaling, relay, domain, UI, Cloudflare, and GPT remain transport or
  presentation capabilities, never validity authorities. No fixed backend may be
  required for protocol correctness.
- Honest metering, distinct account/credential/administrator/failure domains,
  Sybil resistance, and physical provider independence remain explicit later HOLDs.

## Closed intents

All earlier implementation, evidence, release, and contest-era intents are closed.
Their exact branches, failures, review decisions, and verification evidence remain
available in Git history and the append-only `WORKLOG.md`.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or exception. PR #3 created
the split trust boundary at `e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5
retired it at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current
policy workflow remains `.github/workflows/trusted-pr-policy.yml`.
