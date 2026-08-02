# Durable memory

Last reconciled: 2026-08-02 KST

Branch: `agent/codex-protocol-kernel--product-continuity-vertical`

Base: `2dc63b2f8f43aa2a458a77035bf8933e973634c3`

## Verified merged state

- PR #51 passed exact-head policy and browser/protocol CI, immutable independent
  review, GitHub App attestation, separately credentialed machine-user native
  approval, and no-bypass expected-head squash merge.
- Main includes module-private S2/S4 capabilities, first-await ownership checks,
  generated protocol limits, real relay chunk fragments, the authority-free S5
  SDK/verification CLI, S6 Continuity Capsules, the process-isolated S7 counter
  model, and S8 stateful fuzz plus capability-routed browser parity.
- Historical S1-S4 receipts remain exact-commit evidence. Merging revised code does
  not re-promote S2/S4 claims or prove same-origin signer isolation, WebKit signing,
  independent providers, administrators, devices, or global availability.

## Product-continuity candidate

- The explicit `@mortal-os/core/continuity` surface and CLI now expose
  create/inspect/handoff/recover/continue over one core implementation.
- A runtime file is bound to lineage/state, copied through the relay-fragment data
  plane, transferred from A to B, recovered exactly from two of three copies after
  A exits, and committed as the next transition by B.
- Separate Node endpoint processes, a clean packed-package consumer, Chromium, and
  Firefox execute the same ordered scenario contract. Browser endpoints use
  non-extractable Ed25519 keys; CLI private keys remain endpoint-local files.
- One corrupt copy recovers. One copy, stale lineage, wrong authority, and a valid
  fork fail closed. Exchanged artifacts contain no private signing material.
- Exact current checkout passed `npm test` in 2,542.8 seconds and browser parity in
  207.3 seconds. Promotion still requires exact-head CI, immutable review, native
  approval/App attestation, expected-head merge, and post-merge readback.

## Current priority

1. Promote the exact product-continuity candidate through CI, immutable review,
   expected-head merge, and post-merge readback.
2. Replace the three in-process copy transports with provider-neutral durable
   adapters and prove distinct failure/credential domains.
3. Compose S4 confidentiality explicitly; the current product Capsule carries
   exact resource bytes and is not an encryption claim.
4. Turn the programmatic Lab harness into a visible minimal EN/KO file journey and
   freeze one integrated UX/runtime receipt.
5. Move signing plus sign-once state to an isolated authority service or hardware
   boundary before making XSS-resistant custody claims.

## Stable decisions

1. Creation and continuation are protocol operations, not browser privileges.
2. UI, storage, relay, Cloudflare, event order, and GPT never decide validity.
3. Importing public evidence or a Capsule never confers signing authority.
4. A non-extractable key prevents export, not use by compromised same-origin code.
5. Process or browser-profile isolation is not physical or administrative
   independence.
6. Every publishable SHA needs fresh exact-source CI, immutable review, expected-
   head merge, and post-merge evidence; old green runs do not transfer.
7. Dirty historical worktrees and immutable audit records are preserved unless a
   separate cleanup explicitly proves they are disposable.

## Memory maintenance

- Store merged facts or explicitly labeled candidate evidence only.
- Never store credentials, private submission values, generated dependencies,
  disposable logs, or hidden reasoning.
