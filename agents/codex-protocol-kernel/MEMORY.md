# Durable memory

Last reconciled: 2026-08-02 KST

Branch: `agent/codex-protocol-kernel--product-continuity-docs`

Base: `12e90e6199b16b5379a6d4c1caa62cd24f7446e5`

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

## Product gap

- The SDK, CLI, Capsule, data plane, and Lab pass separate tests but do not form one
  supported create/handoff/recover/continue workflow.
- The CLI verifies profiles, Capsules, and custody copies only. It cannot create a
  real-file Capsule or continue a lineage.
- The Lab, Functions, Relay, and examples do not import the Capsule or chunk data-
  plane product surface.
- S5/S6 have no integrated stage receipt. The next evidence freeze must cover the
  composed product, not another disconnected layer.

## Current priority

1. Build one real-file A-to-B vertical through the public SDK, CLI, and Lab.
2. Close A, recover exact bytes from two of three content copies on B, and commit
   the next transition for the same organism.
3. Verify the result in a fresh packed-package consumer process.
4. Simplify the EN/KO Lab around that journey, then freeze one integrated receipt.
5. Defer isolated signer custody, full WebKit signing, and real provider burn-in
   without weakening their explicit nonclaims or regression tests.

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
