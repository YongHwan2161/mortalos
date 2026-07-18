# MortalOS North Star and pre-deadline implementation roadmap

상태: **P0/H3A/H3B/R1-A/R1-B/GPT/guided path merged; exact-source Pages and Devpost submission accepted; custom-domain convergence in progress**

기준 시각: **2026-07-19 KST**

제출 마감: **2026-07-22 09:00 KST** (`2026-07-22 00:00 UTC`)
변경 동결 목표: **2026-07-21 18:00 KST**

이 문서는 제출 직전의 단일 실행 계획(SSOT)이다. 과거 계획, 프로젝트 상태
스냅샷, 제출 체크리스트, 영상 대본은 Git 이력으로 보존하고 현재 트리에서는
중복 관리하지 않는다.

## 1. North Star

> 브라우저, CLI, 서버, 전송 계층, 저장소, 단일 관리자 어느 것도 진실의
> 근원이 되지 않는 상태에서, 인증된 증거와 참여 자원만으로 정체성·상태·승계·
> 죽음이 결정되는 endpoint-neutral digital life를 구현한다.

제품 관점의 한 문장:

> 개발자가 장기 실행 에이전트의 “같은 존재인가, 정당하게 이어졌는가, 갈라졌는가,
> 정말 죽었다고 말할 수 있는가”를 프로덕션 전에 공격하고 재현하는 검증 Lab.

현재 커널은 정체성, 권한 승계, replay/fork, 제한된 mortality 판정을 강하게
검증한다. 그러나 아직 결정론적 실행 상태를 가진 genome, 상태 가용성/복구,
독립 참여자 간 embodiment가 없다. 따라서 가장 근본적인 개선은 UI 장식이나
모델 기능 추가가 아니라 **Lab 전체가 R1 canonical wire를 소비하게 한 뒤,
가장 작은 결정론적 state transition을 두 런타임에서 동일 바이트로 증명하는 것**이다.

전체 순서는 변경하지 않는다:

`independent-verifier registration → R1-A JavaScript wire/golden → R1-B Python differential → R1-C Lab wire consumption → R2 deterministic state → R3 availability → R4 network embodiment`

## 2. 대회 점수에 대한 우선순위 판단

| 우선순위 | 개선 | 심사 기준 효과 | 위험 | 결정 |
| --- | --- | --- | --- | --- |
| P0 | `mortal-os.com` 단일 진입 URL과 Devpost/README 정렬 | Design, 완성도, judge friction | 중간 | API 502 해소 전 HOLD |
| P0 | 문서 SSOT 통합과 허위 human gate 제거 | Technological Implementation, 신뢰 | 낮음 | 즉시 완료 |
| P1 | R1-C guided-path vertical slice | 기술 완성도, 아이디어의 일관성 | 중간 | 동결 전 통과 가능할 때만 구현 |
| P1 | R2 state-bearing canary | North Star의 핵심 진전, novelty | 높음 | R1-C가 조기 통과한 경우만 |
| P2 | 영상/Devpost의 domain 및 최신 증거 정렬 | Design, 전달력 | 중간 | 기존 영상 교체 이득이 명확할 때만 |
| HOLD | WebRTC/libp2p, 분산 추론, 토큰, 대규모 UI 재설계 | 범위는 커지나 증거 약화 | 매우 높음 | 제출 후 |

## 3. 전역 release 원칙

Every publishable SHA must still pass:

1. license, specification, link, governance, conformance, property, Lab, R1,
   build, portable, singleton, and lifecycle gates through `npm test`;
2. exact-head GitHub Verify and trusted-base PR policy;
3. an immutable review whose recorded head equals the merged candidate;
4. expected-head merge to `main` and post-merge Verify;
5. exact-main Cloudflare deployment and public manifest readback; and
6. Devpost, README, public URL, and video claims that do not contradict the release.

Committed, Node, isolated browser-target, and actual Chromium results must be
byte-identical for the portable corpus. Exactly 10,000 cases replay from seed
`1297044052`. Any cross-runtime mismatch reopens the earliest portable gate and
places every later stage on `HOLD`.

추가 불변식:

- GPT-5.6은 공격을 제안하고 가설을 설명할 수 있지만 키, 서명, accepted
  context, recognized head, completeness, validity verdict를 제공하지 않는다.
- 공개 페이지가 성공해도 exact source/asset manifest가 다르면 배포는 실패다.
- 과거 green run은 새 SHA를 보증하지 않는다(an old green run does not cover a new SHA).
- one-browser logical quorum is presented as ownerless distribution라는 주장은
  금지한다.
- 개인 참가가 허용되므로 사람 세 명 또는 first-time tester 세 명을 release
  gate로 만들지 않는다. 인간을 가장한 자동화나 허위 증거도 만들지 않는다.

## 4. 단계별 계획과 엄격한 통과 기준

### S0 — custom domain과 judge path 수렴 (P0, 즉시)

목표: `https://mortal-os.com/`을 유일한 canonical judge URL로 만들고 기존
`pages.dev` 호스트는 장애 복구용 fallback으로 유지한다.

구현:

- Cloudflare Pages 프로젝트에 apex custom domain을 연결한다.
- HKG upstream 502를 피하기 위한 Function targeted placement를 exact-main에
  배포하고 기존 `pages.dev` judge path를 동시에 보존한다.
- workflow, README, release evidence, Devpost 비공개 judge instructions를 새
  URL로 통일한다.
- 브라우저 runtime 바이트는 변경하지 않는다. 문서-only merge가 동일 asset
  digest를 유지하도록 한다.

PASS:

- Cloudflare dashboard가 domain status `Active`를 표시한다.
- DNS가 Cloudflare를 가리키고 HTTPS `GET /`이 `200`이다.
- `asset-manifest.json.source_commit`이 배포된 exact `main` SHA이고 모든 자산,
  MIME, 보안 헤더, API, 세 clean Chromium context가 원격 검증을 통과한다.
- Devpost custom answer 27949/27951과 README가 `mortal-os.com`을 우선한다.

HOLD/rollback:

- TLS, 502/522/525, manifest mismatch가 지속되면 Devpost는 검증된 `pages.dev`
  URL을 유지한다. DNS record를 수동으로 덧대거나 검증되지 않은 redirect를
  만들지 않는다.

### S1 — 문서 및 제출 증거 SSOT (P0, S0과 병행)

목표: 심사자가 90초 안에 제품, 검증, 정직한 한계, 실행 방법을 찾게 한다.

구현:

- `docs/README.md`, 이 roadmap, `BUILD_WEEK_EVIDENCE.md`를 current operational
  SSOT로 유지한다.
- normative 문서(PROTOCOL, THREAT_MODEL, REJECTION_CODES, TRACEABILITY,
  incubator, access architecture)는 런타임 계약과 일치할 때만 수정한다.
- 중복된 plan/status/checklist/demo-script 문서를 제거하고 링크/verifier를 갱신한다.

PASS:

- 모든 상대 Markdown 링크가 존재하고 `npm run verify:links`가 통과한다.
- `npm run verify:spec`가 규범 문서, 현재 roadmap, release evidence를 동시에
  검증한다.
- 저장소 전역 검색에서 “not submitted”, 과거 영상 URL, 의무가 아닌 three-human
  gate, 과거 canonical judge URL이 current claim으로 남지 않는다.
- README는 public URL, 90-second path, local run, Codex/GPT-5.6 contribution,
  honest non-claims, 문서 index를 한 화면 흐름으로 제공한다.

### S2 — R1-C guided-path vertical slice (P1, 최대 10시간)

목표: Lab의 대표 경로 하나가 JS 객체 그래프를 직접 호출하지 않고 R1
operation bytes → kernel → canonical result bytes만 소비하게 한다.

최소 범위:

- baseline 또는 replay 중 한 vertical slice를 선택한다.
- UI adapter는 versioned canonical operation bytes를 만들고 public R1 entrypoint만
  호출한다.
- 표시 상태는 parsed canonical result에서만 파생한다.
- 기존 H3A 결과와 동일한 digest/verdict를 golden으로 고정한다.

PASS:

- 기존 Lab unit/Chromium 결과에 회귀가 없다.
- 같은 operation에 대해 committed golden, Node, isolated browser-target,
  Chromium 결과 바이트가 완전히 같다.
- wire/result byte tamper가 stable rejection으로 실패한다.
- adapter가 private validator/context를 import하지 않는다는 정적 검사가 있다.
- 변경 head의 full `npm test`, coverage, audit, exact-head CI가 통과한다.

STOP:

- **2026-07-20 18:00 KST**까지 focused test가 green이 아니면 branch를 제출
  release에 포함하지 않는다. 기존 제출을 깨며 “부분 구현”을 main에 넣지 않는다.

### S3 — R2 deterministic state canary (P1 조건부, 최대 12시간)

진입 조건: S2가 **2026-07-20 12:00 KST 이전** 리뷰 가능한 상태로 통과했을 때만.

목표: “생명주기 증거만 있는 커널”에서 “결정론적 상태를 가진 최소 genome”으로
한 단계 전진한다.

최소 범위:

- 단 하나의 pure transition ABI: `state_bytes + input_bytes → next_state_bytes + receipt`.
- 고정 genesis state, 정수 overflow/size/step ceiling, canonical receipt.
- JS reference와 독립 Python verifier가 정상/거부 vector를 byte-identical하게 재생한다.
- lifecycle Pulse는 next-state digest를 payload sidecar에 bind하되 v0 권한 판정
  의미를 변경하지 않는다.

PASS:

- 같은 input은 모든 gated runtime에서 같은 next-state/receipt bytes를 생성한다.
- state/input/receipt 한 바이트 변조가 검출된다.
- step/byte ceiling 초과는 stable fail-closed result이며 부분 상태를 commit하지 않는다.
- restart 후 canonical evidence와 state bytes만으로 동일 head/state를 재구성한다.
- 새로운 threat/traceability 항목과 최소 1개 property family가 있다.

STOP:

- **2026-07-21 06:00 KST**까지 full suite가 green이 아니면 S3 전체를 제출 후로
  미룬다. R2를 UI mock 또는 prose claim으로 대체하지 않는다.

### S4 — Devpost와 영상 최적화 (P1/P2, 최대 6시간)

목표: 기술 깊이를 줄이지 않고 judge가 문제→실험→불일치→증거의 의미를 한 번에
이해하게 한다.

Devpost PASS:

- 설명 첫 부분에 canonical live URL이 있다.
- validation은 최종 PR/main/run을 가리키며 과거 PR #15만을 최종 release처럼
  서술하지 않는다.
- category는 `Developer Tools`, submitter는 `Individual`, country는
  `Korea Republic of`, Session ID는 사용자 제공 값과 exact match다.
- `submitted_at`이 non-null이고 status가 `Submitted`이다.

영상 판단:

- 현재 2:37 영상은 public, 3분 미만, voiceover로 제품/Codex/GPT-5.6을 설명하므로
  제출 요건을 충족한다.
- **R1-C 또는 R2가 실제 main에 merge/deploy되지 않는다면 교체하지 않는다.**
  domain만 바뀐 경우 description/pinned comment/thumbnail에 URL을 보강하는 편이
  source-sync 위험이 작다.
- 새 영상이 필요한 경우 0:00–0:10 problem/domain, 0:10–1:20 four-action proof,
  1:20–1:50 GPT prediction 0/25 vs kernel boundary, 1:50–2:25 exact-byte replay 및
  source manifest, 2:25–2:50 honest scope/next step 순서로 구성한다.

영상 교체 PASS:

- public YouTube, `< 03:00`, audible narration, 자막, 360p에서 읽히는 UI;
- 실제 canonical domain과 배포 SHA/manifest를 보여 준다;
- Codex와 GPT-5.6 역할을 서로 구분한다;
- logged-out 재생과 Devpost attachment readback이 통과한다.

### S5 — 최종 freeze와 제출 재검증 (P0, 2026-07-21 18:00 KST)

목표: 기능 추가를 멈추고 judge가 보게 될 exact 상태를 고정한다.

PASS:

- branch clean, focused checks와 full `npm test` 통과;
- dependency audit 0 moderate-or-higher vulnerabilities, package dry run, secret scan 통과;
- exact-head Verify/policy/immutable review, expected-head merge, post-merge Verify/deploy 통과;
- canonical domain에서 manifest source commit, asset digest, six assets, MIME, security
  headers, API, 세 clean Chromium context 통과;
- Devpost project, custom answers, video, repository, `submitted_at` 최종 readback 통과;
- rollback 가능한 마지막 accepted deployment와 fallback URL이 기록돼 있다.

FAIL 시:

- 새 기능은 제거하고 마지막 accepted release로 되돌린다.
- Devpost를 Draft로 바꾸거나 제출을 취소하지 않는다. 검증된 기존 URL/영상/설명을
  유지하고 claim만 축소한다.

## 5. 현재 검증 기초선

| 증거 | 현재 요구 |
| --- | --- |
| Node/browser agreement | Required per review head |
| CLI bootstrap proof | Verified proof only |
| Property corpus | 10,000 cases, seed `1297044052` |
| H3A MortalOS Lab | Three non-extractable Worker keys, logical `2-of-3`, one physical failure domain |
| Additional H3B exact-deployment criteria | source SHA, aggregate/file digests, MIME, headers, API, clean Chromium |
| R1 | eight JS/Python byte-identical golden records |
| GPT | proposal only; kernel is authority; offline replay exact |

## 6. 최종 우선순위 결론

1. custom domain + documentation/Devpost convergence;
2. R1-C 한 개의 완전한 vertical slice;
3. 시간이 남고 S2가 조기 통과할 때만 R2 state canary;
4. 실제 기능이 바뀐 경우에만 영상 교체;
5. 2026-07-21 18:00 KST부터 freeze와 exact-source 검증.

R3 availability와 R4 network embodiment는 North Star에 중요하지만 제출 전 구현
대상이 아니다. 이번 대회에서 이기는 길은 기능 수가 아니라 **강한 한 가지 주장,
직접 실행 가능한 경험, 모델과 authority의 명확한 경계, 재현 가능한 증거**를
일치시키는 것이다.
