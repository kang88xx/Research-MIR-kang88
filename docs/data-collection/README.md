# coinom 크립토 캘린더 — 자료 수집 구조 & 운영 가이드

> 대상: https://coinom.kang88.io/ 크립토 캘린더
> 목적: 트위터 단일 큐레이터 의존 → 소스별 자동/수동 수집 + 주기적 검수 체계로 전환
> 구성 파일:
> - `README.md` — 이 문서 (전체 구조 + 운영 루틴 + 검증 규칙)
> - `sources.yaml` — 소스 레지스트리 (수집기 자동화 시 그대로 설정파일로 사용)
> - `event-schema.json` — 이벤트 데이터 표준 스키마 (JSON Schema)
> - `templates/weekly-research.md` — 주간 리서치 시트 양식
> - `templates/event-entry.md` — 이벤트 1건 수기 입력 양식

---

## 0. 운영 결정 (2026-07-07)

1. **월 $20 이상 유료 소스는 전부 보류** — CoinMarketCal(~$50), X API 종량제(~$30), FMP Starter(~$29), Telemetr API($25~) 등. CryptoRank Basic($19)만 유료 전환 후보로 유지.
2. **상장·상폐 1차 소스 = 연동 텔레그램 채널(강프로 찻방)** — `lib/telegram.ts`가 t.me 공개 프리뷰를 15분 주기로 폴링해 상장·상폐 후보를 자동 포착, 검수 큐(pending_review)에 기입한다. 거래소 공지 4종(Binance WS/Upbit/Bithumb/Coinbase) 수집기는 **보류** (다른 소스 불필요 — 운영자 결정).
3. **이벤트 수기 입력·검수는 어드민 `/admin/events`** — event-entry 양식이 폼으로 구현되어 있음. T3 발견 건은 공식 원문 확인 후 "발행" 버튼으로 승격.
4. 연 1회 정적 일정(FOMC·금통위)은 `prisma/seed-macro-2026h2.ts` 방식으로 기입 (2026 하반기분 완료).

---

## 1. 전체 구조

```
[소스]                          [수집 방법]      [주기]      [신뢰 티어]
─────────────────────────────────────────────────────────────────────
CryptoRank API                  API             일 1회       T2
거래소 공지 (Binance/Upbit/     API·RSS         일 2회~      T1
  Bithumb/Coinbase)
FMP (실적·IPO·경제지표)          API             일 1회       T1
OpenDART (국내 공시)             API             일 1회       T1
FOMC/한은 연간 일정              정적 페이지      연 1회       T1
GitHub 릴리즈/프로젝트 블로그     RSS             일 1회       T2
X 큐레이터 리스트                수동(X List)     주 1회+      T3
        │
        ▼
[정규화] event-schema.json 형식으로 통일
        ▼
[중복제거] entity + date + subcategory 매칭 (출처는 전부 보존)
        ▼
[발행 게이트]
  T1 → 자동 발행
  T2 → 자동 발행 + 주간 샘플 검수
  T3 → 검수 큐 (2개 이상 소스 교차확인 후 발행)
        ▼
[coinom 캘린더 DB]
        ▼
[사후 검증] D-7 / D-1 재확인 cron + TBA 승격 체크 (§4)
```

---

## 2. 카테고리 ↔ 소스 매핑

coinom UI 카테고리 체계 기준. `subcategory` 코드는 `event-schema.json`과 일치.

### 크립토 (crypto)

| 서브카테고리 | 코드 | 1차 소스 (날짜 확보) | 검증 소스 (교차확인) |
|---|---|---|---|
| 언락 | `unlock` | **무료 단계**: CryptoRank 무료 Sandbox + Coindar 무료 API + DefiLlama 언락 페이지(수동 대조) → 유료 전환 시 CryptoRank Basic | @Tokenomist_ai 주간 다이제스트, @spotonchain (온체인 실제 이동 확인) |
| TGE·상장 | `listing` | 거래소 공지 4종 (Binance WS / Upbit / Bithumb / Coinbase 블로그) | @Tree_of_Alpha (발생 속보), CryptoRank TGE |
| 상폐·리스크 | `delisting` | 거래소 공지 4종 | @WuBlockchain |
| 거래소 | `exchange` | 거래소 공지 + 공식 블로그 | @coinness_kr |
| 파트너십 | `partnership` | X 큐레이터 (T3, 검수 필수) | 프로젝트 공식 발표 원문 필수 |
| 프로젝트 (메인넷·업그레이드) | `project` | GitHub releases.atom + 프로젝트 블로그 RSS (상위 ~30개) | @WuBlockchain, 거버넌스 포럼 |
| 컨퍼런스 | `conference` | 연 1회 수동 큐레이션 (Token2049, KBW 등) | 공식 사이트 |

### 주식 (stock)

| 서브카테고리 | 코드 | 1차 소스 | 검증 소스 |
|---|---|---|---|
| 실적·발표 (미국) | `earnings` | FMP earnings calendar (confirmed) | @eWhispers 주간 그리드, Nasdaq 비공식 JSON |
| 실적·발표 (국내) | `earnings` | OpenDART 공시목록 API | 회사 IR 페이지 |
| IPO·상장 | `ipo` | FMP IPO calendar / KRX·data.go.kr | 뉴스 확인 |
| 지수 (리밸런싱) | `index` | S&P/MSCI/FTSE/KRX 연간 일정 (연 1회 정적) | @KobeissiLetter |
| 규제·소송 | `regulation` | X 큐레이터 + 뉴스 (T3, 검수 필수) | 법원/기관 공식 일정 원문 |
| 제품·출시/서비스 | `product` | X 큐레이터 + 기업 이벤트 페이지 (T3) | 기업 공식 발표 |

### 매크로 (macro)

| 서브카테고리 | 코드 | 1차 소스 | 검증 소스 |
|---|---|---|---|
| 금리결정 | `rate` | FOMC 연간 일정 (연준 정적 페이지, 연 1회) / 한은 금통위 (매년 10월경 차년도 보도자료) | @unusual_whales |
| 경제지표 | `indicator` | FMP economic calendar | @KobeissiLetter 주간 리스트 |
| 정치·정책 | `policy` | X 큐레이터 (T3, 검수 필수) | 기관 공식 일정 |
| 지정학 | `geopolitics` | X 큐레이터 (T3, 검수 필수) | 뉴스 2곳 이상 |

### 이벤트 (event)

| 서브카테고리 | 코드 | 소스 |
|---|---|---|
| 스포츠 | `sports` | 공식 일정 (연 1회 정적 — 월드컵 등) |
| 행사 | `misc` | 수동 큐레이션 |

---

## 3. X 큐레이터 리스트 (T3 — 발견·검증 채널)

> 운영 방법: X에서 비공개 List "coinom-sources" 생성 → 아래 계정 전부 추가 → 주간 루틴에서 훑기.
> 원칙: X에서 발견한 이벤트는 **반드시 원문(공식 발표) 링크를 찾아서 소스로 기록** 후 발행.

**Tier 1급 큐레이터 (매주 정기 포맷)**
- @layerggofficial — 월간 비주얼 캘린더 (기준점, 현재 주 소스)
- @pnxgrp — (직접 추가하신 계정)
- @Tokenomist_ai — 주간 토큰 언락 다이제스트
- @eWhispers — 주간 실적발표 그리드 (토요일)
- @CryptoDiffer — 월간 주요 이벤트 리스트
- @RootDataCrypto — 주간 이벤트 캘린더
- @nehalzzzz1 — THIS WEEK IN CRYPTO (언락+매크로 통합)

**Tier 2 — 매크로/실적 보강**
- @KobeissiLetter — 일요일 "Key Events This Week"
- @unusual_whales — 주간 경제+실적 캘린더 그래픽
- @tedtalksmacro — 크립토 관점 week ahead
- (보조) @misterrcrypto, @DustyBC, @cryptoamanclub

**Tier 3 — 검증/속보 (날짜 소싱 X, 발생 확인용)**
- @WuBlockchain — 업그레이드·규제 사전 보도
- @spotonchain — 언락 물량 온체인 이동 확인
- @Tree_of_Alpha / @DeItaone — 상장·FOMC 결과 실시간
- @CertiKCommunity — Smart Calendar

**Tier 4 — 한국어 검증**
- @coinness_kr — coinness.com/market/schedule "오늘의 일정"
- @bloomingbit_io — 주간 경제·크립토 일정 기사

**제외**: @OlympTrade, @exolix_com 등 거래소/브로커 마케팅 계정.

---

## 4. 운영 루틴 (수동 → 자동 전환 전까지의 기준 워크플로)

### 연 1회 (매년 10~12월, 다음 해 준비)
- [ ] FOMC 연간 일정 입력 (federalreserve.gov)
- [ ] 한은 금통위 연간 일정 입력 (bok.or.kr 보도자료)
- [ ] 지수 리밸런싱 일정 (S&P/MSCI/FTSE/KRX)
- [ ] 대형 스포츠·컨퍼런스 (월드컵, Token2049, KBW 등)

### 월 1회 (매월 25일경, ~1시간)
- [ ] CryptoRank에서 다음 달 언락 전체 조회 → 입력
- [ ] @CryptoDiffer 월간 리스트 대조 → 누락 보충
- [ ] 다음 달 실적 시즌 일정 (FMP + OpenDART) 확인
- [ ] TBA 목록 전수 재확인 → 날짜 확정된 것 승격

### 주 1회 (일요일 저녁 또는 월요일 아침, ~30분) → `templates/weekly-research.md` 사용
- [ ] X List 훑기 (Tokenomist·eWhispers·Kobeissi·RootData·nehalzzzz1 주간 포스트)
- [ ] FMP 경제 캘린더 주간 조회
- [ ] 이번 주 기존 등록 이벤트 전건 D-7 재확인 (날짜 변경 감지)
- [ ] 신규 발견 이벤트 → 원문 확인 → 입력

### 매일 (아침, ~10분)
- [ ] 거래소 공지 4종 확인 (상장/상폐/점검)
- [ ] 오늘·내일 이벤트 D-1 재확인 (특히 언락·실적)
- [ ] 어제 이벤트 발생 여부 확인 (@Tree_of_Alpha, 뉴스) → 미발생/연기 시 상태 갱신

---

## 5. 검증 규칙 (검수 기준)

| 규칙 | 내용 |
|---|---|
| **2소스 원칙** | T3(X·뉴스) 발견 이벤트는 공식 원문 또는 독립 소스 1개 이상 추가 확보 전 발행 금지 |
| **D-7 재확인** | 언락·실적·규제 이벤트는 7일 전 원 소스 재조회. 날짜 변경 시 `date_status: revised` + 변경 이력 기록 |
| **D-1 재확인** | 전 카테고리. TBA·estimated 상태로 D-1 도달 시 캘린더에서 숨김 또는 "미확정" 표기 |
| **사후 확인** | 이벤트 다음 날 실제 발생 확인. 연기 시 새 날짜로 이동 + `postponed` 기록 |
| **소스 보존** | 이벤트당 수집된 모든 소스 URL 보존 (UI의 "개별 출처" 표시용) |
| **중요도/색상** | `sentiment`: good(초록)/bad(빨강)/neutral, `importance`: 1~3 — 범례(Importants/Good/Bad)와 매핑 |

---

## 6. 자동화 로드맵 — 무료 우선 (유료는 전부 후순위)

### 무료 단계 (현재)

| 단계 | 내용 | 비용 |
|---|---|---|
| 1 | FMP 무료 티어 + OpenDART + 연간 정적 일정 수집기 | 무료 |
| 2 | 거래소 공지 4종 수집기 (Binance WS, Bithumb 공식 API, Upbit 비공식 JSON, Coinbase RSS) | 무료 |
| 3 | 언락: CryptoRank 무료 Sandbox(언락 엔드포인트 포함 여부 확인) + Coindar 무료 API, DefiLlama 언락 페이지는 주간 수동 대조 | 무료 |
| 4 | 어드민 검수 큐 + 수기 입력 UI (templates/event-entry.md 양식 그대로) | — |
| 5 | GitHub/블로그 RSS → LLM 추출 → 검수 큐 | LLM 비용 소액 |

### 유료 전환 시 (수익화 이후)

| 항목 | 효과 | 비용 |
|---|---|---|
| CryptoRank Basic | 언락 데이터 정확도·커버리지 (크라우드소싱 의존 탈피) | $19/월 |
| X API 종량제 증분 폴링 15~20계정 | T3 수동 스윕 자동화 | ~$30/월 |
| FMP Starter | 콜 한도 확대 (무료 250콜/일 초과 시에만) | ~$29/월 |

> 무료 단계의 트레이드오프: 언락 데이터가 크라우드소싱(Coindar)+수동 대조 의존이 되므로,
> **언락 이벤트는 T3 취급(2소스 교차 후 발행)**하고 주간 리서치에서 @Tokenomist_ai 다이제스트 대조를 건너뛰지 말 것.
