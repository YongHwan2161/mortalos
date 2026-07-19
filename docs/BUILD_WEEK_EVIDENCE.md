# Build Week release evidence

Last synchronized: **2026-07-19 KST**

This is the external-release record. It separates the last accepted production
deployment from the unmerged local candidate. A local PASS, preview URL, or old green
run never substitutes for an exact-main public readback.

## Scoreboard

| Surface | State | Evidence |
| --- | --- | --- |
| Last accepted production | PASS | `main` `8930992e5483c6b645af197348d5725a8648bd09`; Verify run `29662790686`; Deploy run `29662790723`; canonical host exact-source readback passed. |
| Current source candidate | FULL LOCAL PASS / NOT PROMOTED | S0–S11 implementation, full ordered tests, actual Chromium, coverage, audit, package, secret, and reproducible-build gates pass on the committed task branch; independent review/release gates remain. |
| Canonical domain | PASS for accepted production | <https://mortal-os.com/> is canonical; `pages.dev` is incident fallback. |
| Korean route | LOCAL PASS / NOT YET PUBLICLY ACCEPTED | `/ko/` static first paint, catalog parity, locale switch, and browser journey pass locally. |
| Relay | LOCAL PASS / NOT DEPLOYED | Durable Object runtime/restart/TTL tests and dry-run pass; `relay.mortal-os.com` awaits exact-main deploy and public acceptance. |
| GPT-5.6 | OPTIONAL / DISABLED UNTIL ANTI-ABUSE IS CONFIGURED | Main journey makes zero model calls. Server code has atomic D1 caps, circuit breaker, Turnstile verification, and curated fallback. |
| Public video | PASS for current submission | <https://youtu.be/kR-TPuwoNaI> is public, narrated, 2:37, and attached. Keep it until a truthful L2 production replacement exists. |
| Devpost | PASS | Submission `1080076` remains `Submitted`; `submitted_at` is `2026-07-18T10:25:36.990-04:00`. |
| Entrant | PASS | `Individual`, `Korea Republic of`; the official rules do not require a team. |
| `/feedback` | PASS / PRIVATE | The user-provided value is saved and exact-read back in the official submission field. The value is intentionally not duplicated in repository or runtime artifacts. |

There is no three-developer or three-first-time-tester submission requirement. Actual
browser profiles are automated protocol evidence, not fabricated humans.

## Last accepted production baseline

- Repository: <https://github.com/YongHwan2161/mortalos>
- Source commit: `8930992e5483c6b645af197348d5725a8648bd09`
- Merge PR: <https://github.com/YongHwan2161/mortalos/pull/22>
- Post-merge Verify: <https://github.com/YongHwan2161/mortalos/actions/runs/29662790686>
- Exact-main deploy: <https://github.com/YongHwan2161/mortalos/actions/runs/29662790723>
- Canonical URL: <https://mortal-os.com/>
- Incident fallback: <https://mortalos-lab-yonghwan2161.pages.dev/>
- Accepted aggregate asset digest:
  `sha256:HYNcJotcdxxFCItMhI7_RP6_3oqpwTFsqcbS83xMD3A`

The accepted production UI is the earlier L0/GPT guided proof. It passed exact
manifest/source equality, six static assets, MIME/security headers, bounded scenario
API, and three clean Chromium contexts. It does **not** prove the unmerged candidate's
bilingual, state-bearing, remote succession, or quorum-resilience claims.

## Current local candidate evidence

Base: accepted `origin/main`
`8930992e5483c6b645af197348d5725a8648bd09`.

Implemented and focused-PASS:

- **R1-C:** representative Lab validation/replay paths consume canonical public R1
  operation/result bytes; direct private validator/context imports are rejected.
- **State:** `mortalos-state/1` binds Genesis genome/state and deterministic Nurture
  transitions; JavaScript and independent Python reproduce identical corpus records;
  10,000 repeat transitions and atomic tamper/limit/crash recovery pass.
- **Import/replay:** a clean endpoint reconstructs identity, head, sequence, state,
  and validity from public evidence while remaining read-only.
- **Durable Participant:** consent precedes IndexedDB; one non-extractable key survives
  reload; authority removal preserves public history; corrupt pending state fails
  closed.
- **Transport:** seeded duplicate/reorder/drop/partition/reconnect/fork schedules
  converge or surface a fork in Node and Chromium.
- **Relay:** Durable Object SQLite, hibernating WebSocket, presence, bounded catch-up,
  strict CORS/schema/size limits, and restart persistence pass locally. Duplicate
  publish, range/presence reads, presence writes, and connect share one 300/min room
  ceiling; the 301st duplicate returns canonical `429`. The browser cadence budget
  is 204/min for two active endpoints and 252/min including an explicit 48-operation
  burst allowance. Presence-only and
  connect-only rooms schedule and execute complete TTL cleanup.
- **Two-browser L2:** English and Korean actual-Chromium runs create in A, join in B,
  accept one custody handoff, close A, and advance the same identity in B from
  sequence 1 to 2. Public relay data contains neither private-key material nor a
  verdict field.
- **Persistent-profile L2 repetition:** two distinct persistent Chromium user-data
  directories completed 20/20 consecutive A→B handoffs. Each run closed profile A's
  browser process after acceptance; profile B continued the same `organism_id` at
  sequence 2 without A's key. Pending EN/KO proposal text did not claim verification
  before B's local accept path ran.
- **Premature-loss negative:** A closes before accepted handoff; B remains read-only
  and `stalled`, with no authority or death claim.
- **Three-endpoint L3:** all three complementary loss pairs continue; B+C repair A
  with new D; a second loss continues with B+D; one endpoint cannot advance;
  out-of-order evidence converges and siblings remain visibly forked.
- **Actual Chromium quorum repetition:** ten fresh isolated contexts passed with loss
  sequence A/B/C/A/B/C/A/B/C/A and trace digest
  `sha256:oCaFctzCFMgqRExG26PlZLvVh4nuosXpk65ghKxvSKU`.
- **Bilingual UX:** one protagonist, one enabled primary CTA, English `/`, Korean
  `/ko/`, localized first paint, catalog/placeholder parity, no locale-dependent
  protocol bytes, QR generated locally, and advanced evidence collapsed.
- **UX/performance:** the latest full-suite three-run cold-cache gate produced median
  LCP **322.7 ms**, CLS **0**, TBT proxy **29.0 ms**, and DOM interactive **214.5 ms**.
  Stable screenshot
  hashes cover EN/KO idle, joining, alive, stalled, and forked states.

The latest complete ordered `npm test` passed in **1,591.2 seconds**. It included all
stage gates, portable 10,000/10,000 serialized adversarial rejection, four
byte-identical JavaScript/Python state records, eleven R1 differential records,
singleton, and the exact H2 trace.

The first immutable reviewer snapshot correctly returned `FAIL`: it found false
clean-diff evidence, relay admission/TTL gaps, an unexecuted persistent-profile
criterion, and pre-validation “verified” wording. The current candidate removes the
whitespace, adds executable flood/idle-room and 20-profile gates, and labels the
proposal as received/pending until local acceptance.

The second immutable snapshot at `a5f56c6…` also correctly returned `FAIL` even though
exact-head Verify and policy were green. It measured the actual A+B cadence at 80
operations/12s (about 399/min) against a 120/min room ceiling and showed that the
rate-less local relay mock hid the production failure. The remediation now imports
one policy in Worker, browser, and mock; slows non-authoritative polling to a bounded
204/min two-endpoint schedule; reserves 48 interaction operations; enforces a
300/min ceiling and canonical 301st-operation `429`; measures an actual two-profile
12-second window (39 operations in the remediated run); and requires zero mock
rejections. A completely new immutable review snapshot is still mandatory.

Candidate promotion still requires an immutable commit and clean-clone gate,
independent review, expected-head merge, post-merge CI, exact-main relay and Pages
deployment, public EN/KO multi-browser acceptance, and Devpost/video reconciliation.

Final local release-gate readout:

| Gate | Result |
| --- | --- |
| Ordered `npm test` | PASS on the final remediation tree, 1,591.2s |
| Actual Chromium portable corpus | PASS, Chrome 149, byte-identical, 10,000/10,000 rejected |
| Actual Chromium Lab | PASS, 375.7s, EN/KO/import/durable/A→B/a11y/responsive plus 20/20 two-persistent-profile handoffs and 39 operations/12s with zero local 429s |
| Transport differential | PASS, 10,000 schedules / 30,000 recoveries, digest `sha256:TdZsm_fWivLD5SCYfBvMs_ytghOgYxeDGet_y6mrgdM` |
| Trusted-core coverage | PASS, line 94.70%, branch 92.31%, function 95.22% |
| Governance coverage | PASS, 30/30; line 92.68%, branch 84.39%, function 93.75% |
| Dependency audit | PASS, zero vulnerabilities at `moderate` threshold |
| Package dry run | PASS, 138 files, 346,964-byte archive, 1,368,844 bytes unpacked |
| Build reproducibility | PASS, two clean output directories, seven exact assets, digest `sha256:BXGfiKgl2rK_tpXyOZWr_9baW1xqK2UomjGOq4fd3ME` |
| High-confidence secret scan | PASS, zero matches; private feedback value absent from repository |

The clean-clone gate is performed from the immutable candidate commit immediately
before PR publication. Its exact head and result belong in the PR validation record;
writing a self-referential result into this file would create a different, untested
commit.

## GPT-5.6 and cost boundary

The main continuity proof is deterministic and performs zero OpenAI calls. The
advanced GPT action accepts only an allowlisted scenario through strict Structured
Outputs; a deterministic compiler and the MortalOS kernel remain authoritative.

The candidate server boundary includes:

- explicit `GPT_SCENARIOS_ENABLED` fail-closed enablement;
- Turnstile action and hostname verification before model access;
- one atomic D1 transaction covering actor-minute, global-minute, and global-day
  counters;
- missing/invalid cap configuration and D1 failure denial;
- bounded request/output, `store: false`, timeout, and HMAC-derived privacy IDs; and
- a curated local attack when GPT is unavailable.

No OpenAI key is bundled or sent to a browser. Without a confirmed Turnstile widget
and deployment secret, production GPT stays disabled; this does not reduce the main
proof.

## Devpost readback and update boundary

Current accepted submission:

- public project: <https://devpost.com/software/mortalos>;
- category: `Developer Tools`;
- submitter: `Individual`;
- country: `Korea Republic of`;
- repository: <https://github.com/YongHwan2161/mortalos>;
- canonical Try it out URL: <https://mortal-os.com/>;
- video: <https://youtu.be/kR-TPuwoNaI>;
- submission ID: `1080076`;
- status: `Submitted`; and
- `submitted_at`: `2026-07-18T10:25:36.990-04:00`.

Do not update the public story to L2/L3/L4 until the exact production candidate has
passed public acceptance. After acceptance, update the existing project in place and
read back the public page plus the private finalization fields. Never create a second
submission or return the project to Draft.

### Post-deploy Devpost copy package

**Tagline**

> Create once. Continue elsewhere—cryptographically verified digital life across
> browser loss.

**Opening paragraph**

> MortalOS lets you create one state-bearing digital resource in Browser A, transfer
> its continuation authority to a fresh key in Browser B, close A, and advance the
> same identity and state in B. Every endpoint verifies canonical evidence locally;
> the Cloudflare relay and optional GPT-5.6 attacker are never authorities.

**Judge instructions**

1. Open `https://mortal-os.com/` in Browser A and create the organism.
2. Open its QR/link in a clean Browser B profile.
3. Complete the two-signature custody handoff.
4. Close A and continue in B; compare the unchanged identity and advanced sequence.
5. Expand Advanced evidence only if you want state, import, quorum, GPT, and exact-
   source diagnostics. Use `/ko/` for the equivalent Korean flow.

**Honest scope sentence**

> Isolated browser profiles prove distinct endpoint keys and failure behavior, not
> independent people or a globally complete death oracle.

## Video decision and 2:30 replacement script

The existing 2:37 video remains the accepted attachment until the new L2 production
commit exists. A replacement must be recorded only from that deployed SHA and pass
logged-out playback before Devpost is changed.

| Time | Picture | Audible narration / caption intent |
| --- | --- | --- |
| 0:00–0:12 | `mortal-os.com`, one Life Card | Long-running software can move, fork, or disappear; uptime cannot prove authorized continuity. |
| 0:12–0:38 | A creates; identity and state appear | Browser A creates one state-bearing organism and keeps its non-extractable key local. |
| 0:38–1:05 | B opens QR/link and creates key | B receives public evidence, makes a different key, and requests custody; no private key is transferred. |
| 1:05–1:28 | A approves, B accepts, both show sequence 1 | Both local kernels accept the same canonical handoff bytes. The relay only carries messages. |
| 1:28–1:48 | A closes; B continues to sequence 2 | The original browser is gone, but B advances the same identity and deterministic state. |
| 1:48–2:02 | Quick A/B/C pair-loss and repair evidence | `2-of-3` continues after one endpoint loss and stalls honestly below quorum. |
| 2:02–2:17 | Advanced GPT panel and kernel mismatch | GPT-5.6 may propose an attack; it cannot sign or decide the verdict, and the main path needs no API call. |
| 2:17–2:30 | manifest/source SHA and limitations | Exact public bytes map to reviewed source. Browser profiles are not people, and finite evidence is not global immortality. |

Replacement PASS requires public or rules-permitted unlisted YouTube playback,
duration below 03:00, audible English narration, accurate English captions, Korean
subtitles, 360p-readable identity/sequence, exact deployed manifest/SHA, and logged-
out Devpost attachment readback.

## Commands and release HOLD

```bash
npm ci
npm test
npm run test:coverage
npm run test:chromium
npm run verify:lab
npm audit --audit-level=moderate
npm pack --dry-run
```

Production acceptance:

```bash
MORTALOS_LAB_URL=https://mortal-os.com \
MORTALOS_EXPECTED_COMMIT=<exact-main-sha> \
npm run verify:release
```

Promotion stays on `HOLD` if independent review, exact-head/full-suite success,
post-merge relay/Pages deploy, manifest equality, asset/MIME/header/route/Chromium
acceptance, public video, required private-field readback, or non-null `submitted_at`
is absent. Preserve the last accepted release while investigating; never patch
production bytes or relabel an older manifest.
