# Durable memory

Last reconciled: 2026-07-20 KST

Branch: `agent/codex-protocol-kernel--canonical-locale-route`

Base: `44771ae83e2d7450ff9cad654e7a0fae6d144c9e`

## Verified merged/public state

- Repository `main` is `44771ae…` after independently reviewed PR #26. Official
  Deploy `29698934167/1` passed source, relay/Durable Object, and Pages upload. The
  public seven-asset manifest is exact at main with digest
  `sha256:BXGfiKgl2rK_tpXyOZWr_9baW1xqK2UomjGOq4fd3ME`, but final acceptance failed on
  a verifier false-negative: Cloudflare redirects `ko/index.html` to canonical
  `/ko/`, while the verifier rejected the non-canonical request before comparing the
  exact localized bytes.
- Post-merge Verify `29662790686` and deploy `29662790723` passed.
- Canonical judge URL is `https://mortal-os.com/`; `pages.dev` is incident fallback.
- Public accepted claim remains the earlier L0 single-browser/GPT guided proof until
  the current candidate passes review, merge, relay/Pages deploy, and public readback.
- Devpost submission `1080076` remains `Submitted`, Individual, Korea Republic of,
  with non-null `submitted_at` and the public 2:37 video. The required private
  feedback field has been exact-read back; its value is not stored in repository
  artifacts.

## Merged candidate awaiting corrected deployment

- S0–S10 are implemented and focused-local PASS: optional GPT cost safety, English
  `/` and Korean `/ko/`, R1 wire-only Lab paths, evidence import/replay,
  deterministic JS/Python state, consent-gated durable participant, transport and
  Durable Object relay, two-browser succession, three-endpoint quorum repair, and
  one-protagonist UX.
- Actual Chromium proves EN/KO A→B handoff, A close, same-ID B continuation, and ten
  isolated three-endpoint loss/repair runs. Isolated profiles are not proof of three
  people or physical/administrative domains.
- GPT is non-authoritative and no longer part of the main journey. Production config
  is disabled until an explicitly confirmed Turnstile widget/secret exists; deployment
  does not inject OpenAI/Turnstile secrets while disabled.
- Relay code and Durable Object migration are deployed at exact main, but complete
  production acceptance remains open until the remote multi-browser gate passes.
- The first PR #23 review snapshot failed closed. Its four findings are remediated in
  the current unmerged tree: clean diff evidence; every-operation room admission and
  presence/connect-only TTL alarms; an executable 20-run two-persistent-profile
  Chromium gate; and pending/unverified wording before local handoff acceptance.
- The new persistent gate passed 20/20 twice locally, closing A's browser process in
  each run and requiring B to continue the same identity at sequence 2. This is still
  candidate evidence and does not replace exact-head CI, a fresh review, or public
  remote acceptance.
- The second PR #23 review snapshot at `a5f56c6…` failed closed on a new P1: normal
  A+B browser cadence measured about 399/min against the 120/min room cap, and the
  rate-less local mock did not expose it. The current unmerged tree has one shared
  300/min policy, a 204/min two-endpoint schedule plus 48-operation burst allowance,
  a rate-aware mock, exact 300th/301st boundary coverage, and actual two-profile
  cadence acceptance at 39 operations/12s with zero local 429. It needs a new commit,
  exact-head CI, and fresh review.
- The final remediated local tree passed the complete ordered `npm test` in 1,591.2
  seconds and `verify:lab` in 375.7 seconds; the latter repeated all 20 persistent
  handoffs and the 39/12s zero-429 measurement.
- S11 documents are reconciled. S12 full candidate tests, immutable review,
  expected-head merge, post-merge CI, exact relay/Pages deploy, public bilingual
  readback, and Devpost/video reconciliation remain.
- PR #23 passed immutable review at head `3aec0a6…` and squash-merged as
  `d20e660…`. Post-merge Deploy `29695521487/1` failed before relay/Pages mutation:
  `npm test` needed Chromium, but the workflow installed it only after that step.
- The focused correction moves the sole Chromium install before `npm test` and adds
  a test that freezes install → source verify → relay → Pages → public verify order.
  Manual deployment remains forbidden.
- PR #24 passed independent review and squash-merged as `e47e438…`. Its Deploy
  `29696536158/1` proved Chromium ordering was fixed, then failed closed before any
  Cloudflare mutation because job-level `MORTALOS_LAB_URL` made pre-deploy
  `verify:ux` inspect the older public site instead of the just-built local Lab.
- The current correction keeps only `MORTALOS_SOURCE_COMMIT` at job scope. Public
  URL, expected commit, and retry controls are confined to the final post-deploy
  release verifier, preventing source verification from depending on old production.
- PR #25 passed exact-head policy/Verify and immutable review, then merged as
  `7d0b5d2…`. Its natural Deploy proved the environment correction and the repaired
  Cloudflare token permissions: exact-source and relay/Durable Object deployment
  passed. Pages then failed closed because root `wrangler.jsonc` contained the
  unsupported Workers-only `observability` key. The current minimal candidate removes
  that key only from Pages and freezes the Pages/relay observability boundary in a
  focused regression.
- PR #26 passed policy `29698402179/1`, Verify `29698363683/1`, immutable review,
  and expected-head merge as `44771ae…`. Its official Deploy proved the Pages config
  repair and published the exact artifact. The current candidate maps both root and
  nested manifest index files to Cloudflare's canonical directory routes while
  preserving strict byte/header/MIME/digest comparison and redirect rejection.

## Stable decisions

1. Creation is a protocol operation, not a browser privilege.
2. UI, storage, relay, Cloudflare, event order, and GPT never decide validity.
3. Importing evidence gives observation, not signing authority.
4. Each endpoint generates its own non-extractable key; private keys never cross the
   relay or join link.
5. Silence, process exit, key loss, and browser closure are not global death.
6. A valid sibling race is visible as a fork; last-write-wins is forbidden.
7. Every source SHA needs its own immutable review, full Verify, exact-main deploy,
   and public readback; an old green run does not cover a new SHA.
8. The author does not self-review, merge, or push directly to `main`.

## Current priority

1. Publish and independently review the canonical localized-index verifier repair.
2. Merge only its expected head and require official exact-main Deploy success.
3. Verify relay, Pages manifest/source, and public EN/KO multi-browser acceptance.
4. Promote the Devpost story or video only after public acceptance.
5. Keep the last accepted deployment and existing compliant video as rollback.

## Memory maintenance

- Store merged facts or explicitly labeled candidate evidence only.
- Never store credentials, private submission-field values, generated dependencies,
  disposable logs, or hidden reasoning.
