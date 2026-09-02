# MortalOS North Star 우선순위 실행 로드맵

상태: **R0 PASS · R1 PASS · R2-A 로컬 계약/실브라우저 PASS · 원격 승격 HOLD**

감사 기준:

- 원격 `main`: `9ede05cb8f7c120a24ac3ce645fe85caa61bb6e9`
- Git 트리: `9329129836d5d89e9a76f9fa4b4e2d81b0d57c54`
- 기준 시각: 2026-09-02 KST
- R2-A 기준 base: 위 `main`

이 문서는 [North Star 구현 SSOT](IMPLEMENTATION_PLAN.md)를 대체하지 않는
실행 보조 문서다. 단계 정의와 주장 승격의 최종 권한은 구현 SSOT에 있다.
각 단계는 시작 직전에 source, tree, 계획, 관측, CI, 리뷰, 배포 상태를 다시
고정해야 한다.

## 1. 현재 도달 지점

| 계층 | 현재 판정 | 증명하지 못한 경계 |
| --- | --- | --- |
| R0 릴리스 경로 | PASS | 이후 후보의 자동 승격을 보장하지 않음 |
| R1 제한형 ICE 구성 | PASS | 실제 NAT/STUN/TURN 성공이나 독립 운영은 아님 |
| R2-A 측정 계약 | 로컬 PASS | exact-head CI, 리뷰, 병합, 배포는 미수행 |
| R2-B 실제 도달성 | HOLD | 네 프로필의 80개 새 제품 경로가 아직 없음 |
| R3 독립 운영 | HOLD | 별도 관리자·credential·host·network 증거가 없음 |
| R4 회복력 | HOLD | 사전 등록 100회 장애 시험과 7일 burn-in이 없음 |
| R5 S7 승격 | HOLD | 정확한 S7 영수증과 governed promotion이 없음 |

핵심 구분은 다음과 같다.

> ICE 경로가 연결됐다는 사실, 제품 수직 경로가 끝까지 성공했다는 사실,
> 운영·장애 도메인이 독립이라는 사실은 서로 다른 증거다.

## 2. R1 종결 증거

R1 판정: **PASS**

- [PR #65](https://github.com/YongHwan2161/mortalos/pull/65)
- base/head:
  `9b418ee35559c488528bc55ad433708ce94499d8` /
  `13e44b74eca2f3a485f9f8f54de1ae9b668023f9`
- squash merge:
  `9ede05cb8f7c120a24ac3ce645fe85caa61bb6e9`
- exact-main [Verify 33403682605/1](https://github.com/YongHwan2161/mortalos/actions/runs/33403682605):
  `push`, exact head, completed/success
- linked [Deploy 33419081003/1](https://github.com/YongHwan2161/mortalos/actions/runs/33419081003):
  `workflow_run`, exact head, completed/success
- 승격 후보와 공개 manifest의 9개 자산 대조: 불일치 0

R1은 offer/answer 양쪽의 불변·소유·제한형 ICE 설정, 안전한 빈 기본값,
명시적 `all`/`relay`, 제한형 STUN/TURN 형태와 credential 비공개 경계를
승격했다. 임의 NAT 도달성과 물리·관리 독립성은 승격하지 않았다.

## 3. R2-A 구현 결과

R2-A 목표는 live 네트워크를 실행하는 것이 아니라, 실행 전에 측정 계약을
내용주소화하고 결과를 사후 변경할 수 없게 만드는 것이다.

### 3.1 선택된 ICE 경로의 비식별 관측

- `RTCPeerConnection.getStats()`를 transport 생성 시 캡처한다.
- DataChannel이 열린 뒤 선택된 candidate pair 하나만 허용한다.
- stats 레코드는 최대 512개다.
- `host`, `srflx`, `relay`만 노출하며 native `prflx`는 `srflx`로 정규화한다.
- 결과에는 `non_authority: true`가 고정된다.
- IP, port, protocol, SDP, candidate 문자열, STUN/TURN URL, username,
  credential, 원본 stats는 반환하거나 저장하지 않는다.
- 누락, 다중 selected pair, accessor, max+1은 fail-closed 처리한다.

### 3.2 실행 전 pilot plan

`mortalos-webrtc-reachability-plan/1`은 다음 항목을 canonical JSON과
SHA-256 `plan_id`로 고정한다.

- exact source commit/tree
- 재사용 방지용 공개 256-bit campaign nonce
- resource digest/bytes, organism ID, Capsule ID, 시작 lineage head
- canonical order의 네 프로필
- 프로필별 정확히 20회, 합계 80회
- `lan-direct`: `host`
- `nat-stun`: `srflx`
- `forced-turn`: `relay`
- `reconnect-fallback`: `host` 또는 `srflx`에서 `relay`로 한 번 전환

프로필 순서, 기대 경로, 횟수, source/resource/lineage가 바뀌면 다른
`plan_id`가 된다. 실패한 계획을 수정하거나 채우지 않고 새 successor
계획으로 시작한다.

### 3.3 내용주소형 observation

`mortalos-webrtc-reachability-observation/1`은 최대 16 KiB이며 다음을
`observation_id`에 결합한다.

- exact `plan_id`, profile, attempt 1..20, 시작/완료 시각
- 양 끝점의 비식별 route class와 reconnect 순서
- source/resource/organism/Capsule/lineage 결합
- 제한형 outcome과 allowlisted failure code
- PASS일 때 A 종료 후 B의 동일 바이트·organism·Capsule 복구
- 시작 head와 다른 정확한 successor lineage head
- corrupt copy 거부, below-quorum fail-closed
- provider/Continuity 중복 effect 각각 0

관측은 대응 plan과 다시 검증해야 한다. 다른 계획으로 이동하거나 실행 후
기대 경로를 바꾸면 검증이 실패한다. 이 레코드는 유효성 authority나 S7
영수증이 아니다.

### 3.4 현재 검증 범위

- Node 계약/transport focused suite: PASS
- 실제 연결된 Chromium: `host/host`, 민감 candidate metadata 0, PASS
- 전체 Chromium P2P placement/repair 수직 경로: PASS
- async security inventory와 함수·모듈 digest 고정: PASS
- 실제 Chromium 결과는 같은 호스트의 LAN 기준선 한 건이다. R2-B의
  `20/20`이나 NAT/TURN 경로로 계산하지 않는다.

## 4. 재설계한 우선순위 로드맵

```text
R0 정확한 릴리스                           PASS
  -> R1 제한형 ICE 구성                    PASS
  -> R2-A plan/observation 계약            LOCAL PASS · REMOTE HOLD
  -> R2-B 4프로필 x 20회 live 제품 경로   HOLD
  -> R3 별도 관리 주체 토폴로지            HOLD
  -> R4 100회 장애 시험 + 7일 burn-in      HOLD
  -> R5 정확한 S7 영수증/주장 승격         HOLD
```

| 우선순위 | 관문 | 종료 조건 |
| --- | --- | --- |
| P0-A | R2-A 거버넌스 종결 | exact-head CI, 불변 리뷰, 승인, expected-head 병합, exact-main Verify/Deploy/readback |
| P0-B | R2-B 실행 harness와 80경로 | 고정 plan 아래 네 프로필 각각 20/20, 모든 제품 수직 불변식 PASS |
| P0-C | R3 독립 운영 | 서로 다른 관리자·credential·host·network, 전체 공개 sidecar 독립 재생 |
| P0-D | R4 회복력 | 사전 등록 100회 결정적 결과, 동일 후보 7일, 중복 effect·증거 공백 0 |
| P0-E | R5 S7 승격 | exact S7 영수증, 독립 리뷰, 병합, 배포, 공개 readback |
| P1 | S5/S6와 상태 부채 | P0를 지연시키지 않는 별도 exact-head 수명주기 |
| P2 | signer/counter·브라우저 custody | 별도 origin/service 또는 hardware authorization, Chromium/Firefox/WebKit 재검증 |

이슈 #33~#37은 2026-09-02 재확인 기준 모두 OPEN이다. 단계 영수증은
S1~S4만 존재하므로 이슈 상태나 문서만으로 S5~S8을 승격하지 않는다.

## 5. 바로 다음 단계 — R2-A 원격 종결

1. 현재 후보를 하나의 exact head로 고정한다.
2. focused R2, security, spec, links, governance와 전체 Verify를 실행한다.
3. 전체 diff, plan/observation schema, 민감정보 비노출 경계를 불변
   스냅샷으로 리뷰한다.
4. 필요한 서로 대체 불가능한 승인과 expected-head 병합을 수행한다.
5. exact-main Verify와 workflow-run Deploy를 추적하고 공개 자산을 대조한다.

이 단계가 끝나기 전에 live credential을 만들거나 R2-B 관측을 시작하지
않는다. 계획의 `source_commit/source_tree`는 배포된 exact main을 가리켜야
하기 때문이다.

## 6. R2-B 실제 도달성 파일럿

R2-A 종결 뒤 필요한 운영 자원은 다음과 같다.

- 실제 브라우저를 실행할 두 endpoint와 서로 다른 NAT 조건
- 선택된 STUN/TURN 서비스
- TURN secret을 source, argument, log, observation, receipt 밖에 두는 전달 경계
- 정확한 제품 수직 경로를 실행하고 plan/observation을 append-only로
  보관하는 제한형 harness

한 candidate plan에서 네 프로필 각각 20개의 새 A→B 경로를 실행한다.
실패 observation도 원본 그대로 보존하고 같은 attempt를 재시도하거나
backfill하지 않는다. 구성, credential, source, resource, matrix가 바뀌면
새 plan으로 다시 시작한다.

R2-B PASS 조건은 80/80 observation이 계획과 일치하고, 매회 A 종료 뒤
B가 동일 바이트를 복구해 유일한 후속 lineage를 만들며, corrupt copy와
below quorum은 거부되고 중복 effect는 0인 것이다. 결과 라벨은 오직
**단일 운영자의 제품 도달성 증거**다.

## 7. R3~R5 승격 경로

### R3 — 별도 관리 주체

- provider, host, administrator, credential, network를 실제로 분리한다.
- coordinator로 issuer/subject/observer/TLS/possession credential을 모으지
  않는다.
- 새로운 verifier가 ceremony, plan, acceptance, activation, observation,
  attestation, public chain과 role-source closure를 전부 재생한다.
- 직접 관측하지 않은 차원은 `unproven`으로 남긴다.

### R4 — 장애 matrix와 burn-in

- 첫 실행 전에 최소 100회 장애 matrix를 고정한다.
- provider/process, observer/signer, network partition/heal, counter,
  TURN/signaling, handoff 전후, corrupt/below-quorum/stale/fork를 포함한다.
- 같은 candidate를 7일 연속 운영한다.
- 구성·binary·credential·manifest·시험 정의 변경은 새 후보를 요구한다.
- 복구 바이트 불일치, below-quorum 진행, 중복 effect, 증거 공백은 모두 0이다.

### R5 — S7 영수증

1. exact 후보와 R3/R4 증거에서
   `evidence/stages/s7-failure-domains.json`을 만든다.
2. 하나의 불변 SHA에서 전체 검증과 inventory를 수행한다.
3. 논리 reviewer receipt, GitHub App exact-head attestation, native
   latest-head approval을 각각 확보한다.
4. expected-head merge 후 exact-main Verify/Deploy/readback을 확인한다.

완료 전까지 [이슈 #36](https://github.com/YongHwan2161/mortalos/issues/36)은
OPEN이고 물리·관리 독립성은 HOLD다.

## 8. 후순위와 명시적 비주장

R4 안정화 뒤 S5/S6 영수증을 정리하고, 이후 signer/counter 격리와 S4/S8
재승격을 검토한다. 공개 기여 UX, capacity/SLA, incentive, discovery 확장은
R5와 custody 게이트 이후다.

다음 항목은 현재 주장하지 않는다.

- arbitrary-Internet 도달성
- 별도 관리자·account·host·network·전원·물리 장애 도메인
- 절대적 Sybil 저항성이나 global currentness/death
- hostile-disk 또는 sudden-power-loss 내구성
- 승인된 모델 밖의 copied-key 탐지
- `decentralized`, `ownerless`, `immortal`의 무조건적 주장

모든 단계 보고에는 `PASS` 또는 `HOLD`, exact source/evidence 식별자,
mutation 수, 그리고 증명하지 못한 경계를 함께 적는다.
