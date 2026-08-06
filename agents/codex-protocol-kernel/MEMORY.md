# Durable memory

Last reconciled: 2026-08-07 KST

Branch: `agent/codex-protocol-kernel--hostless-webrtc-participants`

Base: `7c9f6a46f4a26debba6902121bdb36c2b791ffc7`

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
- CLI authority files now use a flushed exclusive lock plus atomic journal replace;
  two conflicting Node processes yield exactly one signer and one equivocation
  rejection. A crash-left lock deliberately requires explicit recovery.
- The pre-lock checkout passed `npm test` in 2,542.8 seconds and browser parity in
  207.3 seconds; post-lock focused continuity, packed consumer, and the `21/119`
  async security inventory pass. Promotion still requires exact-head CI, immutable review, native
  approval/App attestation, expected-head merge, and post-merge readback.

## Current priority

1. Promote the exact hostless WebRTC candidate through CI, immutable review,
   expected-head merge, and post-merge verification.
2. Define signed, bounded participant resource offers and leases for storage,
   bandwidth, and deterministic compute. No server may schedule authoritatively.
3. Compose Continuity Capsule chunks with at least three participant leases and
   prove repair after origin plus one custodian disappear.
4. Add a bounded deterministic WASM profile and migrate one computation A→B→C.
5. Add signed peer-distributed bundle bootstrap and then replaceable rendezvous,
   STUN/TURN, device/network, Firefox/WebKit, and signer-isolation gates.

## Hostless WebRTC candidate

- The governing North Star is restored: “The network does not host MortalOS. The
  living network is MortalOS.” The domain is optional distribution and demonstration,
  never protocol authority or a required runtime dependency.
- `ManualWebRtcParticipantTransport` carries existing bounded canonical participant
  messages over an ordered binary DataChannel with canonical manual offer/answer
  signals and `iceServers: []`; it has no HTTP, WebSocket, STUN, TURN, or relay
  fallback.
- `DirectParticipantSession` composes Genesis, B join, signed custody handoff, A
  authority removal, and B continuation without exporting private keys.
- The exact local candidate loads A and B in separate Chromium processes from a
  random localhost origin, denies every HTTP request before Genesis, closes A's
  process after handoff, and lets B commit sequence 2 for the same organism.
- Full `npm test` passed in 3,162.5 seconds. The async security inventory remains
  `21 direct / 119 auto-discovered`; portable adversarial replay remains
  `10000/10000` rejected.
- Honest HOLD: same-host processes do not prove physical independence, arbitrary
  NAT/firewall reachability, peer-distributed application bootstrap, participant
  resource leases, or a circulating multi-peer memory/compute fabric.

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
