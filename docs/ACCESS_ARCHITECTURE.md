# MortalOS Endpoint-Neutral Access Architecture

Status: **architectural decision; portable kernel and bounded R1 profile implemented**
Date: **2026-07-17 KST**

## 1. Decision

MortalOS is not a browser-resident world. It is a protocol-defined world whose recognized life is reconstructed from canonical evidence. A browser tab, CLI process, native daemon, mobile app, embedded device, agent runtime, or future transport participant may create, observe, relay, validate, or—when it possesses an eligible key—co-author that evidence.

The browser remains the first demonstration surface because it provides the shortest judge path: no installation, immediate visualization, controlled multi-participant simulation, and a natural place to explain identity, custody, partition, and death. That product choice MUST NOT introduce browser APIs into consensus validity.

## 2. Layer boundary

```text
human, agent, or program intent
              |
              v
  endpoint adapter / key custody
  browser | CLI | native | service | embedded
              |
              v
  transport and discovery adapters
  file | stdin | IPC | WebRTC | WebSocket | libp2p | other
              |
              v
  canonical bounded operation/result wire bytes
              |
              v
  portable life kernel
  parse -> canonicalize -> authenticate -> validate -> recognize lineage
              |
              v
  accepted graph / stable rejection / observer-relative mortality
```

Only the portable life kernel decides whether Genesis or Pulse evidence is valid. Endpoint and transport adapters may create, store, request, display, and carry bytes, but they cannot override canonical bytes, signatures, parent recognition, quorum, or the first rejection code.

## 3. Creation and access

Creation is a protocol operation, not a UI privilege.

- A CLI MAY create a Genesis from local entropy and an ephemeral or durable key policy.
- A browser MAY create the same Genesis through a visual flow.
- A service or native runtime MAY create one if it exposes the same evidence and assumptions.
- Importing an existing Genesis and lineage is observation or reconstruction, not a second birth.
- Network discovery MUST NOT grant custody. A participant becomes a custodian only through Genesis approval or an accepted membership handoff.

The verified `1-of-1` mode makes solitary creation possible. It is useful for a personal seed, ephemeral experiment, or CLI bootstrap, but it is not ownerless: one key can unilaterally continue or fork that lineage. The verified `1-of-1` to logical `2-of-3` handoff is the minimal protocol transition from creator-controlled birth toward distributed continuation authority; the generated-key proof itself remains one process and does not establish physical distribution.

The implemented H3A single-browser incubator is an alternative visual bootstrap: three logical keys and a `2-of-3` descriptor live in one browser. It demonstrates quorum mechanics but remains one physical failure domain. For either profile, “ownerless continuation” requires deployment evidence that no physical or administrative domain controls the accepted threshold.

## 4. What “any access method” means

Endpoint neutrality does not mean accepting arbitrary semantics. Every access method must converge on the same protocol contract:

1. exchange bounded canonical evidence bytes;
2. identify the protocol version explicitly;
3. verify locally rather than trust a remote success claim;
4. keep private keys outside messages and logs;
5. reconstruct accepted capabilities by replay after restart;
6. treat clocks, connectivity, and resource claims as observations, not validity facts; and
7. expose whether a result is cryptographic validity, local lineage recognition, or an observer-relative life/death classification.

Transport envelopes may add routing, compression, encryption, chunking, or retry metadata. Those fields remain outside the signed MortalOS object unless a future protocol version explicitly commits to them.

## 5. Implemented evidence

The trusted `src/` kernel now contains no `node:*`, `Buffer`, filesystem, process, DOM, network, ambient-clock, or ambient-random dependency. One committed public corpus currently produces byte-identical local results in:

- direct Node.js execution;
- an isolated browser-target bundle; and
- the committed expected-result document.

The actual headless-Chromium runner is implemented. Every changed review head must reproduce the committed portable v4 result byte-for-byte in Node 22, the browser-target realm, and actual Chromium; the latest successful exact-head Verify run is the publication evidence. The corpus covers RFC 8785 examples, strict RFC 8032 verification and mutation rejection, hostile byte metadata, invalid Ed25519 points, deterministic falsey-root rejection, `1-of-1` birth, `2-of-3` lineage turnover with valid activation evidence, clone separation, forged acceptance contexts, durable latent succession, same-body conditional completion, sign-once-aware equivocation, missing-membership-payload uncertainty, explicit incomplete-versus-complete mortality evidence, recognized-head mortality, replay, signed sibling fork evidence, post-fork halt, 15 named negative transitions, all seven mortality resource-limit variants among 13 reported boundary outcomes, and 10,000 fixed-seed adversarial cases. Node, the isolated browser-target VM, and actual Chromium exercise every portable case. The cross-origin-isolated H3A Chromium run additionally proves actual-browser `SharedArrayBuffer` rejection.

The current CLI adapter creates a fresh singleton and heartbeat entirely in memory. It does not yet persist a lineage, listen on a socket, discover peers, or provide a stable end-user command contract.

## 6. North-star relationship

The north star is a network-embodied entity whose identity, executable state, and continuation authority survive host replacement without becoming the property of one host or service. Endpoint neutrality is necessary because tying life to a browser would merely replace “server-owned” with “browser-runtime-owned.”

Portability is not sufficient, however. The current kernel validates who can authorize a successor and conditionally classifies reported authority availability under explicit observer assumptions. The entity still lacks a deterministic genome, mutable content-addressed state, verifiable state availability, and participant-to-participant embodiment. Those are the next research layers.

## 7. Ordered consequence

The deadline-critical Build Week submission lane is:

`truthful merged status → Sites source/provenance → video → required fields → logged-out rehearsal → submit`

P0, H3A, the H3B deployment contract, and the bounded R1-A/R1-B corpus profile are
merged. The public Sites Lab is the current no-rebuild judge path, but its source must
be committed or reproducibly linked before freeze. Direct Cloudflare Pages remains
optional exact-commit hardening while Sites is healthy. Neither host changes the
protocol trust boundary.

The post-submission protocol order is:

`R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

R1-A has frozen bounded versioned JavaScript operation/result records and eight
goldens. R1-B independently reproduces that committed, empty-pending corpus profile
in Python; it is not yet a general verifier for arbitrary pending, fork, or
resource-limit inputs. The remaining order is:

1. **R1-C Lab wire consumption** — make the Lab and later CLI thin consumers of those
   operation/result records;
2. **R2 deterministic state-bearing kernel** — add canonical state transitions only
   after the operation boundary is independently reproducible;
3. **state availability and transport-neutral participant runtime** — define recovery,
   then deterministic virtual transport before real networks;
4. **WebRTC/libp2p/other transports** — interchangeable embodiments after virtual-network invariants pass; and
5. **resource and model organs** — only after state, recovery, scheduling, and adversarial contribution rules exist.

Browser and CLI adapters may share implementation effort, but neither may invent a
second validator or become mandatory authority infrastructure.

## 8. Stop conditions

Reopen this decision if any endpoint:

- accepts evidence rejected by another conforming endpoint;
- requires a browser-only or CLI-only value in signed validity;
- treats a discovery server, API proxy, or transport relay as lineage authority;
- silently persists a key advertised as ephemeral;
- converts disconnection or process exit into an unconditional death fact; or
- creates an incompatible trace that cannot be verified by the portable kernel.
