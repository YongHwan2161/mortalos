# MortalOS North Star 우선순위 실행 로드맵

상태: **R0 PASS · R1 구현 후보 LOCAL/BROWSER PASS · exact-head CI HOLD**

감사 기준:

- `main`: `9b418ee35559c488528bc55ad433708ce94499d8`
- Git 트리: `6ffae88f8b1f7892cefbce3df3d4ca2482c2855b`
- 기준 시각: 2026-08-31 KST
- R1 후보: [PR #65](https://github.com/YongHwan2161/mortalos/pull/65) / `13e44b74eca2f3a485f9f8f54de1ae9b668023f9`

이 문서는 [North Star 구현 SSOT](IMPLEMENTATION_PLAN.md)를 대체하지 않는
실행 보조 문서다. 단계 정의, 주장 승격, 순서의 최종 권한은 구현 SSOT에
있다. 이 문서는 현재 증거를 더 작은 실행 게이트로 나누며, 각 게이트를
실행하기 직전에 소스, 이슈, 체크, 영수증, 배포 상태를 다시 확인해야 한다.

## 1. 현재 도달 지점

| 증거 계층 | 현재 확인된 지점 | 남은 경계 |
| --- | --- | --- |
| 제품 수직 경로 | 실제 제한형 파일을 A에서 B로 이전하고, A 종료 후 2-of-3 복구와 동일 계보의 다음 전이를 수행하는 경로가 배포됨 | 독립 호스트, 임의 NAT, 독립 관리자 증거는 아님 |
| R0 릴리스 | 정확한 `main` Verify, 릴리스 후보, 자동 Deploy, 공개 자산 대조가 모두 PASS | 완료. 이후 런타임 후보는 이 지점을 기준으로 시작 |
| WebRTC 도달성 | R1 후보가 offer/answer 공통의 불변·소유·제한형 ICE 구성, 빈 목록/`all` 기본값, 명시적 STUN/TURN 및 `all`/`relay` 정책을 구현했고 실제 Chromium 회귀가 PASS | 후보는 아직 미병합이며 exact-head CI 진행 중. 실제 STUN/TURN 서비스, 강제 TURN 경로, 임의 NAT는 미증명 |
| 승인·관측 경로 | 정책 고정 signer, membership-bound plan, 전체 roster 활성화, observer attestation, public-chain replay가 구현됨 | 실행 증거는 동일 PC/loopback. 키·인증서·프로세스 분리는 관리·물리 독립 증거가 아님 |
| 단계 영수증 | S1~S4 파일만 존재 | S5~S8 영수증 부재. 이슈 #33~#37은 모두 OPEN |
| 브라우저 키 보관 | Chromium/Firefox 전체 경로와 WebKit verifier-only 탐지가 구현됨 | 동일 origin 코드의 직접 sign 호출 가능성, WebKit 전체 signing, 격리 signer/counter는 HOLD |

가장 중요한 구분은 다음과 같다.

> 네트워크가 연결될 수 있다는 사실과 독립적으로 운영된다는 사실은 서로
> 다른 증거다.

동일 관리자가 수행한 STUN/TURN 성공은 도달성만 증명한다. 별도 provider,
관리자, 자격증명, 호스트, 네트워크, 전원 또는 물리 장애 도메인을 승격하지
않는다.

## 2. R0 완료 증거

R0 판정: **PASS**

### 2.1 정확한 `main` Verify

- 실행: [Verify 33350808561/1](https://github.com/YongHwan2161/mortalos/actions/runs/33350808561)
- event/head: `push` / `9b418ee35559c488528bc55ad433708ce94499d8`
- `browser-parity`: PASS
- `protocol`: PASS
- `Promote exact release candidate`: PASS
- 세 job의 annotation: 모두 0건

### 2.2 릴리스 후보

- artifact ID: `9745399911`
- 이름: `mortalos-release-candidate-9b418ee35559c488528bc55ad433708ce94499d8`
- GitHub artifact digest:
  `sha256:c810f7ce85484bdd5fc839755e613f5166de7e9788ab989c9372bbc923bf2b58`
- 후보 digest:
  `sha256:bgmKayCul-jE0pQgaJQa_wYgtnF_RoWWiv98PI9Zwg0`
- 저장소 검증기: PASS
- 결합 source/tree:
  `9b418ee35559c488528bc55ad433708ce94499d8` /
  `6ffae88f8b1f7892cefbce3df3d4ca2482c2855b`

### 2.3 자동 Deploy와 공개 대조

- 실행: [Deploy 33356877108/1](https://github.com/YongHwan2161/mortalos/actions/runs/33356877108)
- event/head: `workflow_run` /
  `9b418ee35559c488528bc55ad433708ce94499d8`
- 로그에 원본 Verify run ID `33350808561`과 artifact ID `9745399911`이
  고정됨
- Deploy job annotation: 0건
- 공개 `asset-manifest.json`: 1,266바이트, 두 차례 no-cache 읽기
  바이트 일치
- manifest SHA-256:
  `sha256:N8jfhh1B56dvyHOZrdcNF7vGyz0XtW3f8owpgiJfZnU`
- source commit: `9b418ee35559c488528bc55ad433708ce94499d8`
- 공개 asset-set digest:
  `sha256:EPCDV6PCFMjMIfpMdLU2Q9zmR_5ptz9wpsl35YvykCE`
- 공개 자산: 9개, 합계 1,346,187바이트, 각 SHA-256 전부 일치

R0 완료는 이 정확한 릴리스만 승격한다. STUN/TURN, 독립 토폴로지, S7,
강한 키 보관을 승격하지 않는다.

## 3. 재점검한 남은 단계

```text
R0 정확한 main 릴리스 종결                 PASS
  -> R1 제한형 ICE 구성 계약               LOCAL/BROWSER PASS · CI HOLD
  -> R2 NAT/TURN 도달성 파일럿             NEXT (R1 CI/병합 전 HOLD)
  -> R3 별도 관리 주체의 승인된 토폴로지   HOLD
  -> R4 100회 장애 시험 + 7일 burn-in      HOLD
  -> R5 정확한 S7 영수증과 주장 승격       HOLD

R4 안정화 이후:
  S5/S6 영수증 정리
  -> 격리 signer/counter 보관
  -> S4/S8 재승격
  -> 기여 UX, 용량/SLA, 인센티브, 확장 discovery
```

현재 최단 임계 경로는 R1의 exact-head 종결부터 R5까지다. 문서·영수증 준비는 이 경로를 지연시키거나
주장을 바꾸지 않는 범위에서만 병렬로 수행한다.

2026-08-31 재점검 결과 이슈 #33~#37은 모두 OPEN이며, 저장소의 단계
영수증은 S1~S4 네 개뿐이다. R2 비식별 측정 schema, R3 독립 운영 계약,
R4 사전 등록 matrix, S7 영수증은 아직 없다. 따라서 우선순위는 다음처럼
유지한다.

| 우선순위 | 다음 관문 | 현재 blocker / 종료 신호 |
| --- | --- | --- |
| P0-A | R1 exact-head 종결 | PR #65 protocol/browser-parity 완료·성공 |
| P0-B | R2 schema 동결과 네 프로필 측정 | R1 종결 전 live credential·네트워크 실행 금지; 이후 프로필별 20/20 |
| P0-C | R3 독립 운영 토폴로지 | 서로 다른 관리자·credential·host·network 증거 부재; 공개 sidecar 전체 재생 |
| P0-D | R4 100회 matrix와 7일 burn-in | R3 후보·시험 정의 미동결; 중복 effect 0, 증거 공백 0 |
| P0-E | R5 S7 승격 | 정확한 S7 영수증·독립 리뷰·병합·배포 readback 부재 |
| P1 | S5/S6와 이슈 상태 정리 | P0 임계 경로를 지연시키지 않는 별도 exact-head 수명주기 |

## 4. P0 구현 게이트 — R1 제한형 ICE 구성 계약

현재 판정: **구현·로컬·실브라우저 PASS / exact-head 원격 CI HOLD**

불변 후보:

- PR: [#65](https://github.com/YongHwan2161/mortalos/pull/65)
- base: `9b418ee35559c488528bc55ad433708ce94499d8`
- head: `13e44b74eca2f3a485f9f8f54de1ae9b668023f9`
- 변경량: 10개 파일, +404/-25
- Agent PR Policy: `33361909517/1` PASS
- Verify: `33361909417/1` 진행 중; 완료 전에는 R1 PASS로 승격하지 않음

목표: STUN, TURN, signaling, relay를 유효성 권한으로 만들지 않으면서 실제
네트워크 도달성을 구성 가능하게 만든다.

최소 구현 범위:

- 프로덕션의 두 `iceServers: []` 고정 생성을 하나의 불변·소유·제한형
  RTC 구성 capability로 대체한다.
- 기존 direct/동일 호스트 동작을 보존하도록 빈 서버 목록을 기본값으로
  유지한다.
- 네이티브 `all` 또는 `relay`만 명시적으로 선택할 수 있게 하여 강제 TURN
  증거가 direct 후보로 조용히 후퇴하지 못하게 한다.
- 허용한 STUN/TURN URL과 credential 형태에만 정확한 개수·바이트 상한을
  적용하고 malformed/max+1을 fail-closed 처리한다.
- TURN credential은 런타임 로컬에만 두고 정규 프로토콜 증거, 공개 영수증,
  진단, URL, 커밋 fixture에 포함하지 않는다.
- 수동 신호 정규화, transcript 예산, send-before-commit 원자성, 종료
  정리의 멱등성, transport 비권한 경계를 그대로 보존한다.
- Node와 실제 브라우저에서 기본 direct, 구성 모드, 호출자 변이,
  malformed/oversized, credential 비노출을 검증한다.

현재 구현 결과:

- offer와 answer 모두 첫 suspension 전에 설정 레코드와 중첩 배열을 복사·동결한다.
- 서버 최대 8개, 서버당 URL 최대 8개, URL당 UTF-8 2,048바이트,
  TURN username/credential 각 512바이트, 전체 문자열 16,384바이트를 적용한다.
- STUN/TURN 혼합, URL 내 credential, 알 수 없는 필드, accessor, max+1을
  `WEBRTC_ICE_CONFIGURATION`으로 fail-closed 처리한다.
- credential은 네이티브 `RTCPeerConnection` 생성자에만 전달하며 정규 신호,
  presence, transport 상태에 보관하지 않는다.
- focused WebRTC `17/17`, 실제 Chromium P2P, async security `26/26`
  (`22` direct / `145` discovered), Lab/API `23/23`, governance `30/30`,
  spec, links, protocol profile, ruleset, Lab build, diff check가 PASS했다.

PASS 조건:

- focused transport/security/Lab 테스트와 전체 exact-head suite가 모두
  통과한다.
- 현재 경계가 약화되지 않는다.
- 이 단계의 결과는 안전한 adapter 구현으로만 기록한다. NAT 통과나
  독립성을 주장하지 않는다.

남은 R1 종결 조건은 현재 불변 head의 protocol과 browser-parity가 모두
완료·성공하는 것이다. 이후 immutable review와 병합은 별도 승인 수명주기이며,
R1 소스 종결과 R2의 실제 네트워크 증거를 서로 대체하지 않는다.

## 5. P0 증거 게이트 — R2 NAT/TURN 도달성 파일럿

목표: 독립 운영 burn-in 비용을 투입하기 전에 정확한 제품 경로가 대표
네트워크 조건을 통과하는지 확인한다.

첫 실행 전에 다음 네 프로필을 동결한다.

1. 동일 LAN direct 기준선
2. 서로 다른 NAT의 STUN server-reflexive 경로
3. direct 후보를 비활성화한 강제 TURN relay
4. 연결 손실 뒤 한 번의 제한형 reconnect/fallback

각 프로필에서 런타임 파일로 20회의 새로운 A→B 경로를 연속 실행한다.
저장 가능한 관측값은 경로 등급(`host`, `srflx`, `relay`), 시간,
제한형 실패 코드, source/resource/head digest, 결과뿐이다. candidate 문자열,
IP 주소, TURN credential, 파일 평문은 저장하지 않는다.

PASS 조건:

- 프로필별 20/20 완료
- A 종료 후에만 B가 복구와 후속 commit 수행
- resource 바이트, organism ID, lineage head, Capsule 결합 전부 일치
- 손상 copy는 거부하고 below-quorum은 fail-closed
- signaling, HTTP relay, TURN 로그, 공개 증거에 파일 평문이나 전체
  인코딩 파일이 없음
- reconnect/fallback 중 provider 또는 Continuity 중복 effect 0건

결과 라벨은 반드시 **단일 운영 도메인의 도달성 증거**로 남긴다. S7을
충족하지 않는다.

## 6. P0 운영 게이트 — R3 별도 관리 주체의 승인된 토폴로지

목표: 구현된 admission/observer ceremony를 한 운영자 밖의 보관·토폴로지
사실과 결합한다.

필수 조건:

- 독립으로 계산할 모든 참여자의 provider, host, administrator,
  credential 도메인이 서로 다름
- 독립 관리되는 counter/provider replica 최소 3개와 선택된 membership
  epoch이 요구하는 전체 observer roster
- issuer, subject, observer, TLS, possession credential을 각 호스트에만
  보관하고 coordinator로 이동하지 않음
- 네트워크·장애 도메인은 외부 감사 가능한 provider/관리자 증거로
  확인하며 프로세스 ID, 브라우저 프로필, 선언 라벨, 키, 인증서, socket
  주소만으로 추론하지 않음
- 하나의 동결된 ceremony, plan, 전체 acceptance, activation, membership
  binding, observation journal, attestation set, compact view, public chain,
  role-source aggregate, source verdict, all-role-key closure

PASS 조건:

- 새로운 verifier 프로세스가 모든 공개 sidecar를 재생한다.
- 누락, 추가, 대체, 충돌, 잘못된 순서의 증거가 fail-closed 처리된다.
- 직접 관측하지 못한 모든 차원은 `unproven`으로 남는다.

## 7. P0 회복력 게이트 — R4 장애 시험과 burn-in

목표: 로컬 replica나 짧은 파일럿에서 추론하지 않고 S7의 production-only
조건을 실제로 충족한다.

첫 시험 전에 최소 다음 항목을 포함한 100회 matrix를 등록한다.

- 결과 게시 전후 provider/process 종료
- observer, signer 손실과 network partition/heal
- counter replica 손실, 재시작, repair, 경쟁 coordinator
- 전송 연결 후 TURN 또는 signaling 손실
- handoff 전, handoff 후, B 복구 중 A 손실
- 손상 shard/copy, below-quorum, stale/fork 증거
- 기반 capability가 없는 상태에서 정확한 durable result 복구

이후 변경하지 않은 후보를 7일 연속 운영하고 append-only,
content-addressed 증거를 남긴다. 구성, credential, binary, manifest, 시험
정의는 1회차 전에 동결한다. 하나라도 바뀌면 새 후보로 다시 시작한다.

PASS 조건:

- 사전 등록 100회가 예상한 결정적 PASS 또는 fail-closed 결과를 생성
- 복구 바이트 일치와 유일한 후속 lineage
- below quorum 진행 0건
- provider, counter allocation, accounting, Continuity 중복 effect 0건
- 7일 증거 체인에 공백, 교체, 가변 덮어쓰기 없음
- 독립 reviewer가 secret 없는 공개 증거로 aggregate 재현 가능

## 8. P0 승격 게이트 — R5 S7 영수증

목표: R3/R4 후보를 보고서가 아닌 governed claim으로 전환한다.

필수 순서:

1. 정확한 후보와 운영 증거에서
   `evidence/stages/s7-failure-domains.json` 생성
2. 하나의 불변 SHA에서 locked install, focused gate, full suite, inventory,
   영수증 검증 수행
3. 논리 reviewer receipt, GitHub App exact-head attestation, native
   latest-head approval을 서로 대체 불가능한 세 게이트로 확보
4. expected-head merge
5. 정확한 새 `main`, candidate artifact, 자동 Deploy, 공개 readback 확인

다섯 단계가 모두 끝날 때까지 이슈
[#36](https://github.com/YongHwan2161/mortalos/issues/36)은 OPEN이고
물리·관리 독립성은 HOLD다.

## 9. P1 영수증·배포 메타데이터 부채

R4가 안정화되어 임계 경로를 방해하지 않을 때 시작한다.

- S5: `evidence/stages/s5-sdk-cli.json` 생성. 공개 package registry
  게시 여부는 별도 결정한다. 영수증이 게시를 의미하지 않고 게시도
  영수증을 의미하지 않는다.
- S6: 정확한 통합 제품 경로와 R3/R4 토폴로지 증거에 대해
  `evidence/stages/s6-continuity-capsule.json` 생성
- S4: signer/counter가 별도 origin/service 또는 hardware authorization
  경계를 충족하기 전에는 `s4-confidentiality.json`을 재발급하지 않음
- S8: 아래 강한 보관 경계가 해결된 뒤
  `evidence/stages/s8-adversarial-custody.json` 생성. WebKit
  verifier-only는 정직한 profile로 유지
- 이슈 #33~#37의 `a6cfb657…`/“#63 candidate” 상태 문구는 정확한
  `9b418ee…` R0 사실에 맞춰 별도 coordination-only 변경으로 동기화

각 영수증은 독립된 exact-head review, merge, readback 수명주기를 갖는다.
과거 영수증 바이트는 다시 쓰지 않는다.

## 10. P2 키 보관·브라우저 강화

목표: 독립 운영 증명 이후 가장 큰 잔여 key-use 공백을 제거한다.

- signing key와 counter state를 함께 별도 origin/service 또는 hardware
  authorization 도메인으로 이동
- 일반 sign 기능 대신 명시적 제한형 요청만 허용
- 제품 origin 침해, 재시작, 동시성, below-quorum에서 sign-once와 counter
  allocation 검증
- Chromium/Firefox 전체군과 WebKit capability detection 재실행
- WebKit은 native 구현이 전체 정규 envelope와 S2/S4군을 private material
  노출 없이 통과할 때만 signing 승격

WebKit을 통과시키기 위해 key containment를 약화하는 fallback은 금지한다.

## 11. P3 제품·네트워크 확장

R5와 키 보관 게이트 이후에만 진행한다.

- 공개 기여 UX와 provider onboarding
- 관측된 독립 도메인에 근거한 capacity/SLA weight
- 추적 가능한 metering에 근거한 incentive, penalty, settlement
- 확장 rendezvous, anti-entropy, discovery
- 측정된 실패 분포에서 도출한 availability 목표

discovery, relay, UI, GPT, Cloudflare는 계속 교체 가능한 carrier다. membership,
validity, mortality, repair 권한이 되지 않는다.

## 12. 연구 비주장과 중단 목록

R0~R5의 릴리스 blocker로 만들거나 그 증거에서 추론하지 않는다.

- 절대적 Sybil 저항성
- 전역 hidden-artifact 발견 또는 global currentness
- 객관적 global death
- 선언된 저장 경계를 넘는 hostile-disk 또는 sudden-power-loss 증명
- 승인된 custody/journal 모델 밖의 copied-key 탐지
- 정확한 증거 없는 “decentralized”, “ownerless”, “immortal”,
  arbitrary-Internet 주장

R3를 흉내 내기 위해 동일 PC transport, coordinator, receipt wrapper, signed
declaration을 하나 더 추가하지 않는다. 다음 유효한 구현은 R1이고, 다음
의미 있는 North Star 승격은 R5다.

## 13. 즉시 실행 순서

1. **R1 종결**: PR #65 exact-head protocol/browser-parity 결과 확인; 실패 시
   동일 head를 성공으로 간주하거나 R2로 우회하지 않음
2. **R2 준비**: R1 종결 후, 첫 네트워크 실행 전에 네 프로필과 비식별 증거
   schema 및 TURN credential 취급 경계 동결
3. **R3 준비**: live authority나 ceremony 생성 전에 독립 관리 도메인 확보
4. **R4 준비**: 첫 시험 전에 100회 matrix 등록
5. **R5 준비**: burn-in 중에는 영수증 schema만 검토하고 주장 승격은 금지

모든 단계는 `PASS` 또는 `HOLD`, 불변 source/evidence 식별자, 그리고
증명하지 못한 정확한 경계를 함께 보고한다.
