# Handoff and shared-path intent

This is the current advisory conflict-avoidance ledger. Historical declarations are
preserved in Git history and `WORKLOG.md`; they are not active locks.

## Active intent

### ACTIVE — Reject unsupported Pages deployment configuration

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `7d0b5d272b5e4ab5819ab89d6a628af9e82baec2`
- Work branch: `agent/codex-protocol-kernel--pages-config-validation`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--pages-config-validation`
- Exact shared paths: `wrangler.jsonc` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: exact-main Deploy `29697373574/2` passed exact-source verification and
  deployed the relay/Durable Object, then failed closed before Pages upload because
  Wrangler 4.111 rejects the Workers-only root `observability` key in a Pages
  project configuration. The public Pages artifact and acceptance remained old.
- Intended change: remove only the unsupported Pages `observability` block, retain
  relay observability in `relay/wrangler.jsonc`, and freeze the Pages/Worker config
  boundary with a regression assertion. Wrangler exposes no Pages-deploy dry-run,
  so the source regression must explicitly reject the unsupported key.
- Required gates: focused Lab/config tests, spec/diff/secret checks, exact-head
  Verify and policy, immutable review, expected-head merge, natural exact-main
  Deploy, public manifest/relay/EN-KO acceptance, and Devpost reconciliation.

### HISTORICAL — Isolate public-verification environment from source tests

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `e47e438db0e751e5d1d9f01a90933095fbd67906`
- Work branch: `agent/codex-protocol-kernel--deploy-env-scope`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--deploy-env-scope`
- Exact shared paths: `.github/workflows/deploy-lab.yml` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: corrected Deploy `29696536158/1` installed Chromium first, then failed
  closed in pre-deploy `verify:ux` because job-level `MORTALOS_LAB_URL` redirected
  source tests to the older accepted public site. No Cloudflare mutation occurred.
- Intended change: retain exact source binding at job scope, but expose the public
  URL, expected commit, and retry controls only to the final post-deploy release
  verifier. Add a regression contract for this environment boundary.
- Required gates: focused/unit/spec/diff/secret checks, exact-head Verify and policy,
  immutable review, expected-head merge, exact-main Deploy, public readback, and
  Devpost reconciliation. No rerun or manual deployment bypass before correction.

### HISTORICAL — Repair production deploy Chromium ordering

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `d20e66083cd79084667beab8bc8269fbac447828`
- Work branch: `agent/codex-protocol-kernel--deploy-chromium-order`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--deploy-chromium-order`
- Exact shared paths: `.github/workflows/deploy-lab.yml` and `test/lab.test.mjs`.
- Exact agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`, and
  `WORKLOG.md`.
- Incident: post-merge Deploy `29695521487/1` failed at `npm test` before any
  Cloudflare mutation because Playwright Chromium was installed only after the test.
- Intended change: install Chromium immediately after locked dependencies and before
  exact-source verification; remove the later duplicate install step. Deployment
  order remains verify → relay → Pages → exact public acceptance.
- Required gates: workflow structure/unit assertions, spec/diff/secret checks,
  exact-head Verify and Agent PR Policy, independent immutable review, expected-head
  merge, then exact-main Deploy and public readback. No manual deployment bypass.
- Rollback: no production mutation occurred in the failed run; current accepted
  deployment remains live until the corrected exact-main workflow passes.

### HISTORICAL — Implement and release S0–S12 multi-browser digital-life candidate

- From / to: `codex-protocol-kernel` / `reviewer-merge-gate`
- Base: `8930992e5483c6b645af197348d5725a8648bd09`
- Work branch: `agent/codex-protocol-kernel--multi-browser-bilingual-plan`
- Worktree: `C:/Users/ant71/Documents/Codex/2026-07-17/yonghwan2161-mortalos-git-https-github-com/work/mortalos-worktrees/codex-protocol-kernel--multi-browser-bilingual-plan`
- Exact intended shared areas: root/package/license notices; `.github/workflows/verify.yml`
  and `deploy-lab.yml`; `docs/` current/normative set; `functions/api/scenarios.js`;
  `lab/` UI, i18n, participant, storage, transport, evidence, endpoint, header, and
  license files; `relay/`; `r1/javascript/` and `r1/python/`; `schemas/`; `scripts/`
  build/deploy/spec/state/transport/quorum/UX/Lab verifiers; `src/` kernel/state/
  transport; and matching `test/` suites/vectors.
- Exact intended agent paths: `agents/codex-protocol-kernel/HANDOFF.md`, `MEMORY.md`,
  and `WORKLOG.md`.
- Contract affected: the site moves from an L0 single-browser/GPT-centered proof to
  one bilingual state-bearing organism whose custody moves A→B without private-key
  transfer; A loss after handoff permits B continuation, while premature loss stalls.
  A/B/C `2-of-3` evidence covers every one-endpoint loss and repair. R1/state remain
  local authority; relay, UI, Cloudflare, order, and optional GPT remain untrusted.
- Cost boundary: production GPT is disabled and its secrets are not injected until a
  confirmed Turnstile widget/secret exists. The deterministic main journey remains
  fully available.
- Required local evidence: license/spec/link/governance/conformance/property/i18n/
  state/transport/relay/multi-browser/Lab/R1/build/UX/portable/singleton/H2 through
  `npm test`; actual Chromium portable and Lab gates; coverage, audit, package,
  secret, diff, and clean-clone checks.
- Required release evidence: immutable independent review bound to the exact head,
  expected-head merge, post-merge Verify, exact relay and Pages deployment, manifest
  equality, English/Korean public A→B and quorum/negative acceptance, rollback
  record, and Devpost/video readback.
- Expected handoff: one immutable candidate PR from current `main`. The author does
  not self-review, merge, or push directly to `main`.
- Reviewer FAIL remediation (PR #23 snapshot `da3d691…`): remove the false
  clean-diff evidence, make every valid relay request subject to the per-room
  admission ceiling (including duplicates, range/presence reads and connect), bind
  room/presence TTL to actual alarms, add flood and idle-room runtime tests, add the
  exact 20-run two-persistent-profile Chromium gate, and remove pre-validation
  “verified” UI wording. The intended shared paths remain within the declaration
  above; the remediated head requires a completely fresh reviewer snapshot.
- Second reviewer FAIL (snapshot `a5f56c6…`): exact production cadence was about
  399/min for A+B against the 120/min room ceiling, while the local acceptance mock
  had no rate counter. The new remediation makes `src/transport/relay-policy.mjs`
  authoritative for Worker/browser/mock, budgets 204 scheduled + 48 burst operations
  below a 300/min ceiling, tests the 300th/301st boundary, measures a real 12-second
  two-profile window, and fails on any local `429`. This changed head again requires
  a fully fresh immutable reviewer snapshot; neither earlier review may authorize it.

## Closed intents

All earlier Build Week runtime, D1, MIME, canonical-root, R1-A/R1-B, custom-domain,
release-evidence, and submission intents are closed. Their immutable SHAs, review
decisions, failures, and verification evidence remain in `WORKLOG.md` and Git history.

## HISTORICAL-AUDIT-ONLY: two-phase trusted-policy migration

This is a closed audit marker, not an active workflow or review exception. PR #3
established the split trust boundary at
`e6dce59fb314266acdd855748a9b1fb996864e81`; PR #5 retired the migration marker and
exception at `012bfc3cc1eabf3326e601f8a7e66f6de44d1920`. The sole current policy workflow
remains `.github/workflows/trusted-pr-policy.yml`.
