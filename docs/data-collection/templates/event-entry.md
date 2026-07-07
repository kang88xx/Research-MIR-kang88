# 이벤트 입력 양식 (1건)

> 수기 입력용. 어드민 입력 UI를 만들 때 이 필드 구성을 그대로 폼으로 옮기면 됩니다.
> 필드 정의·허용값은 `event-schema.json` 참조.

---

**ID**: `{YYYY-MM-DD}-{티커소문자}-{서브카테고리}`  예: `2026-07-24-wld-unlock`

| 필드 | 값 | 안내 |
|---|---|---|
| 카테고리 | crypto / stock / macro / event | UI 상단 탭 |
| 서브카테고리 | | unlock, listing, delisting, exchange, partnership, project, conference / earnings, ipo, index, regulation, product / indicator, rate, policy, geopolitics / sports, misc |
| 티커 | | 예: WLD, AAPL, 005930, FED, KR |
| 종목/주체명 (한글) | | 예: 월드코인 |
| 제목 (한국어, 80자 이내) | | 캘린더 셀에 표시. 예: "월드코인(WLD) 언락 비율 43% 감소" |
| 제목 (영어, 선택) | | |
| 상세 설명 (2~3문장) | | 클릭 시 표시. 왜 중요한지 포함 |
| 날짜 (KST) | YYYY-MM-DD | TBA면 월 1일로 적고 정밀도를 month로 |
| 시각 (선택) | HH:MM | 원 소스 시간대 → KST 변환 메모 남기기 |
| 날짜 정밀도 | time / day / range / month | range면 종료일도 기입 |
| 날짜 상태 | confirmed / estimated / tba | 공식 원문 확인 전엔 confirmed 금지 |
| 색상(성격) | important(파랑) / good(초록) / bad(빨강) / neutral | UI 범례 |
| 중요도 | 1 / 2 / 3 | 3=시장 전체, 2=섹터·종목 중대, 1=참고 |

**출처** (전부 기록 — T3 발견 건은 공식 원문 포함 최소 2개):

| # | 소스명 | URL | 티어 | 공식 원문? |
|---|---|---|---|---|
| 1 | | | 1/2/3 | Y/N |
| 2 | | | | |

**검수 상태**:
- 상태: draft / pending_review / published
- 다음 재확인일: ____ (규칙: 언락·실적·규제 = D-7과 D-1 / 그 외 = D-1)
- 내부 메모:

---

## 발행 전 셀프 체크
- [ ] 날짜를 공식/1차 소스에서 직접 확인했다 (X 이미지만 보고 입력하지 않았다)
- [ ] 시간대 변환(ET/UTC → KST)을 확인했다 — 미국 이벤트는 KST로 날짜가 하루 밀릴 수 있음
- [ ] 동일 이벤트가 이미 캘린더에 있는지 검색했다 (중복 방지)
- [ ] 색상/중요도가 이벤트 성격과 맞다 (언락 대량 해제=bad, 상장=good 등 일관성)
- [ ] TBA/estimated 이벤트를 confirmed로 잘못 표시하지 않았다
