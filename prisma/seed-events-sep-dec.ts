import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 2026 9~12월 이벤트 보강 — 9월 이후 커버리지 절벽(10월 3건·11월 1건·12월 1건) 해소.
// 검증일 2026-08-19, 출처 tier 기준은 docs/data-collection/event-schema.json.
// - 매크로 지표: BLS 공식 발표 일정 (tier 1, confirmed)
// - BOJ: 일본은행 공식 2026 회의 일정 (tier 1, confirmed) — 발표일(2일차) 기준
// - KBW·테스트넷: 공식·보도 (confirmed) / 실적·언락: 통상 일정 기반 추정 (estimated)
// 실행: npx tsx prisma/seed-events-sep-dec.ts (동일 날짜+티커+제목 존재 시 건너뜀 — 멱등)

const BLS_CPI = "https://www.bls.gov/schedule/news_release/cpi.htm";
const BLS_EMPSIT = "https://www.bls.gov/schedule/news_release/empsit.htm";
const BOJ_URL = "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm";

type Seed = {
  date: string; // UTC 자정 셀 날짜 (KST 발표일)
  ticker: string;
  title: string;
  description: string;
  category: "important" | "good" | "bad" | "neutral";
  groupMain: "주식" | "크립토" | "매크로" | "이벤트";
  groupSub: string;
  dateStatus: "confirmed" | "estimated";
  importance: 1 | 2 | 3;
  sourceName: string;
  sourceUrl: string;
  tier: 1 | 2 | 3;
  isOfficial: boolean;
};

const EVENTS: Seed[] = [
  // ── 매크로 · 경제지표 (BLS 공식 일정 — tier 1) ──
  {
    date: "2026-10-02", ticker: "US", title: "미국 고용보고서 (9월 비농업 고용)",
    description: "미 노동통계국(BLS)이 9월 고용보고서(비농업 고용·실업률)를 발표한다. 발표는 한국시간 2일 밤 9시 30분. (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS 고용보고서 일정", sourceUrl: BLS_EMPSIT, tier: 1, isOfficial: true,
  },
  {
    date: "2026-10-14", ticker: "US", title: "미국 소비자물가지수(CPI) (9월분)",
    description: "미 노동통계국(BLS)이 9월 소비자물가지수를 발표한다. 발표는 한국시간 14일 밤 9시 30분. (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS CPI 발표 일정", sourceUrl: BLS_CPI, tier: 1, isOfficial: true,
  },
  {
    date: "2026-11-06", ticker: "US", title: "미국 고용보고서 (10월 비농업 고용)",
    description: "미 노동통계국(BLS)이 10월 고용보고서(비농업 고용·실업률)를 발표한다. 발표는 한국시간 6일 밤 10시 30분(서머타임 해제). (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS 고용보고서 일정", sourceUrl: BLS_EMPSIT, tier: 1, isOfficial: true,
  },
  {
    date: "2026-11-10", ticker: "US", title: "미국 소비자물가지수(CPI) (10월분)",
    description: "미 노동통계국(BLS)이 10월 소비자물가지수를 발표한다. 발표는 한국시간 10일 밤 10시 30분(서머타임 해제). (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS CPI 발표 일정", sourceUrl: BLS_CPI, tier: 1, isOfficial: true,
  },
  {
    date: "2026-12-04", ticker: "US", title: "미국 고용보고서 (11월 비농업 고용)",
    description: "미 노동통계국(BLS)이 11월 고용보고서(비농업 고용·실업률)를 발표한다. 12월 FOMC(8~9일) 직전 마지막 고용 지표. (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS 고용보고서 일정", sourceUrl: BLS_EMPSIT, tier: 1, isOfficial: true,
  },
  {
    date: "2026-12-10", ticker: "US", title: "미국 소비자물가지수(CPI) (11월분)",
    description: "미 노동통계국(BLS)이 11월 소비자물가지수를 발표한다. 같은 날 새벽 FOMC 결과 발표와 겹치는 고변동성 날. (출처: BLS 공식 발표 일정)",
    category: "important", groupMain: "매크로", groupSub: "경제지표", dateStatus: "confirmed", importance: 3,
    sourceName: "BLS CPI 발표 일정", sourceUrl: BLS_CPI, tier: 1, isOfficial: true,
  },
  // ── 매크로 · 금리결정 (BOJ 공식 2026 일정 — 회의 2일차 발표일 기준) ──
  {
    date: "2026-10-30", ticker: "JP", title: "일본은행(BOJ) 금리 결정",
    description: "일본은행이 10월 금융정책결정회의(29~30일)를 열고 기준금리를 결정한다. 결과는 30일 정오께 발표. 엔 캐리 자금 흐름과 위험자산 전반에 영향. (출처: 일본은행 2026년 회의 일정)",
    category: "important", groupMain: "매크로", groupSub: "금리결정", dateStatus: "confirmed", importance: 3,
    sourceName: "일본은행 회의 일정", sourceUrl: BOJ_URL, tier: 1, isOfficial: true,
  },
  {
    date: "2026-12-18", ticker: "JP", title: "일본은행(BOJ) 금리 결정",
    description: "일본은행이 2026년 마지막 금융정책결정회의(17~18일)를 열고 기준금리를 결정한다. 결과는 18일 정오께 발표. (출처: 일본은행 2026년 회의 일정)",
    category: "important", groupMain: "매크로", groupSub: "금리결정", dateStatus: "confirmed", importance: 3,
    sourceName: "일본은행 회의 일정", sourceUrl: BOJ_URL, tier: 1, isOfficial: true,
  },
  // ── 크립토 · 컨퍼런스 ──
  {
    date: "2026-09-29", ticker: "KBW", title: "코리아 블록체인 위크 2026 서울 (9/29~10/1)",
    description: "KBW 2026이 서울 워커힐에서 열린다. 업비트가 메인 스폰서로 참여하며 29일 기관 포럼으로 시작한다. 국내 상장·파트너십 발표가 몰리는 주간. (출처: KBW 공식)",
    category: "good", groupMain: "크립토", groupSub: "컨퍼런스", dateStatus: "confirmed", importance: 2,
    sourceName: "KBW 2026 공식", sourceUrl: "https://www.koreablockchainweek.com/", tier: 1, isOfficial: true,
  },
  // ── 크립토 · 프로젝트 ──
  {
    date: "2026-08-20", ticker: "ETH", title: "글램스터담 공개 테스트넷 '플로타베르게트' 하드포크",
    description: "이더리움 차기 업그레이드 글램스터담 전용 공개 테스트넷 Platåberget이 하드포크로 메인넷 전환 과정을 시연한다. 메인넷 활성화는 4분기 목표로 연기된 상태. (출처: 코인마켓캡 아카데미)",
    category: "neutral", groupMain: "크립토", groupSub: "프로젝트", dateStatus: "confirmed", importance: 1,
    sourceName: "CoinMarketCap Academy", sourceUrl: "https://coinmarketcap.com/academy/article/ethereum-glamsterdam-upgrade-pushed-q3", tier: 2, isOfficial: false,
  },
  // ── 크립토 · 거래소 (Deribit 월말 옵션 만기 — 규칙 기반) ──
  {
    date: "2026-09-25", ticker: "BTC", title: "BTC·ETH 분기 옵션 만기",
    description: "데리비트 등 주요 거래소의 3분기 옵션이 만기된다(매월 마지막 금요일, 분기물은 미결제약정 규모가 커 변동성 확대 요인). (출처: 데리비트)",
    category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "confirmed", importance: 2,
    sourceName: "Deribit", sourceUrl: "https://www.deribit.com/", tier: 2, isOfficial: true,
  },
  {
    date: "2026-10-30", ticker: "BTC", title: "BTC·ETH 월물 옵션 만기",
    description: "데리비트 등 주요 거래소의 10월물 옵션이 만기된다(매월 마지막 금요일). (출처: 데리비트)",
    category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "confirmed", importance: 1,
    sourceName: "Deribit", sourceUrl: "https://www.deribit.com/", tier: 2, isOfficial: true,
  },
  {
    date: "2026-11-27", ticker: "BTC", title: "BTC·ETH 월물 옵션 만기",
    description: "데리비트 등 주요 거래소의 11월물 옵션이 만기된다(매월 마지막 금요일). (출처: 데리비트)",
    category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "confirmed", importance: 1,
    sourceName: "Deribit", sourceUrl: "https://www.deribit.com/", tier: 2, isOfficial: true,
  },
  {
    date: "2026-12-25", ticker: "BTC", title: "BTC·ETH 분기 옵션 만기",
    description: "데리비트 등 주요 거래소의 연말 분기 옵션이 만기된다(매월 마지막 금요일, 연중 미결제약정 최대 규모의 만기). (출처: 데리비트)",
    category: "neutral", groupMain: "크립토", groupSub: "거래소", dateStatus: "confirmed", importance: 2,
    sourceName: "Deribit", sourceUrl: "https://www.deribit.com/", tier: 2, isOfficial: true,
  },
  // ── 크립토 · 언락 (통상 월간 스케줄 기반 추정) ──
  {
    date: "2026-10-11", ticker: "APT", title: "앱토스(APT) 월간 언락",
    description: "앱토스 재단·투자자 물량 월간 언락이 예정돼 있다(매월 11일 전후, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 1,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/aptos", tier: 2, isOfficial: false,
  },
  {
    date: "2026-11-11", ticker: "APT", title: "앱토스(APT) 월간 언락",
    description: "앱토스 재단·투자자 물량 월간 언락이 예정돼 있다(매월 11일 전후, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 1,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/aptos", tier: 2, isOfficial: false,
  },
  {
    date: "2026-12-11", ticker: "APT", title: "앱토스(APT) 월간 언락",
    description: "앱토스 재단·투자자 물량 월간 언락이 예정돼 있다(매월 11일 전후, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 1,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/aptos", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-16", ticker: "ARB", title: "아비트럼(ARB) 월간 언락",
    description: "아비트럼 팀·투자자 물량 월간 언락이 예정돼 있다(매월 16일, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 2,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/arbitrum", tier: 2, isOfficial: false,
  },
  {
    date: "2026-11-16", ticker: "ARB", title: "아비트럼(ARB) 월간 언락",
    description: "아비트럼 팀·투자자 물량 월간 언락이 예정돼 있다(매월 16일, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 2,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/arbitrum", tier: 2, isOfficial: false,
  },
  {
    date: "2026-12-16", ticker: "ARB", title: "아비트럼(ARB) 월간 언락",
    description: "아비트럼 팀·투자자 물량 월간 언락이 예정돼 있다(매월 16일, 통상 일정 기반 추정). (출처: Tokenomist)",
    category: "bad", groupMain: "크립토", groupSub: "언락", dateStatus: "estimated", importance: 2,
    sourceName: "Tokenomist", sourceUrl: "https://tokenomist.ai/arbitrum", tier: 2, isOfficial: false,
  },
  // ── 주식 · 실적 (3분기 실적 시즌 — 통상 일정 기반 추정, 확정 공시 시 갱신) ──
  {
    date: "2026-10-08", ticker: "SAMSUNG", title: "삼성전자 3분기 잠정실적 발표",
    description: "삼성전자가 3분기 잠정실적(매출·영업이익)을 발표할 것으로 보인다(통상 10월 초, 추정). HBM·메모리 업황의 가늠자. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance 005930.KS", sourceUrl: "https://finance.yahoo.com/quote/005930.KS/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-21", ticker: "TSLA", title: "테슬라 3분기 실적 발표",
    description: "테슬라가 3분기 실적을 발표할 것으로 보인다(통상 10월 셋째 주, 추정). (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance TSLA", sourceUrl: "https://finance.yahoo.com/quote/TSLA/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-27", ticker: "MSFT", title: "마이크로소프트 실적 발표",
    description: "마이크로소프트가 FY27 1분기 실적을 발표할 것으로 보인다(통상 10월 말, 추정). AI 캐펙스 가이던스 주목. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance MSFT", sourceUrl: "https://finance.yahoo.com/quote/MSFT/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-27", ticker: "MSTR", title: "스트래티지(MSTR) 실적 발표",
    description: "스트래티지(구 마이크로스트래티지)가 3분기 실적을 발표할 것으로 보인다(통상 10월 말, 추정). BTC 트레저리 평가손익·추가 매수 계획 주목. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance MSTR", sourceUrl: "https://finance.yahoo.com/quote/MSTR/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-29", ticker: "AAPL", title: "애플 실적 발표",
    description: "애플이 FY26 4분기 실적을 발표할 것으로 보인다(통상 10월 말, 추정). 아이폰 18 첫 판매 지표 주목. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance AAPL", sourceUrl: "https://finance.yahoo.com/quote/AAPL/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-10-29", ticker: "COIN", title: "코인베이스 실적 발표",
    description: "코인베이스가 3분기 실적을 발표할 것으로 보인다(통상 10월 말, 추정). 거래대금·수수료 매출로 크립토 리테일 수급 확인. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 2,
    sourceName: "Yahoo Finance COIN", sourceUrl: "https://finance.yahoo.com/quote/COIN/", tier: 2, isOfficial: false,
  },
  {
    date: "2026-11-18", ticker: "NVDA", title: "엔비디아 실적 발표",
    description: "엔비디아가 FY27 3분기 실적을 발표할 것으로 보인다(통상 11월 셋째 주, 추정). AI 수요·데이터센터 매출로 위험자산 전반의 방향을 좌우하는 이벤트. (출처: Yahoo Finance)",
    category: "important", groupMain: "주식", groupSub: "실적·발표", dateStatus: "estimated", importance: 3,
    sourceName: "Yahoo Finance NVDA", sourceUrl: "https://finance.yahoo.com/quote/NVDA/", tier: 2, isOfficial: false,
  },
];

async function main() {
  let created = 0;
  for (const e of EVENTS) {
    const date = new Date(`${e.date}T00:00:00Z`);
    const exists = await prisma.calendarEvent.findFirst({
      where: { date, ticker: e.ticker, title: e.title },
      select: { id: true },
    });
    if (exists) {
      console.log(`skip (이미 존재): ${e.date} ${e.ticker} ${e.title}`);
      continue;
    }
    await prisma.calendarEvent.create({
      data: {
        date,
        isTba: false,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        category: e.category,
        groupMain: e.groupMain,
        groupSub: e.groupSub,
        sourceUrl: e.sourceUrl,
        dateStatus: e.dateStatus,
        importance: e.importance,
        sources: [{ name: e.sourceName, url: e.sourceUrl, tier: e.tier, isOfficial: e.isOfficial }],
        reviewStatus: "published",
        // 추정 일정은 D-7 재확인 (docs/data-collection README — 실적·언락 루틴)
        nextCheck: e.dateStatus === "estimated" ? new Date(date.getTime() - 7 * 86400_000) : null,
      },
    });
    created++;
    console.log(`created: ${e.date} ${e.ticker} ${e.title}`);
  }

  // ── 기존 데이터 정정 ──
  // 1) ETH 글램스터담 (8/1 TBA로 과거에 박제) → 4분기 목표로 연기 반영
  const glam = await prisma.calendarEvent.findFirst({
    where: { ticker: "ETH", title: { contains: "글램스터담" }, dateStatus: "tba" },
  });
  if (glam) {
    await prisma.calendarEvent.update({
      where: { id: glam.id },
      data: {
        date: new Date("2026-12-01T00:00:00Z"),
        isTba: true,
        title: "이더리움 글램스터담 업그레이드 (4분기 목표)",
        description:
          "이더리움 차기 메인넷 업그레이드 글램스터담이 당초 상반기 목표에서 2026년 4분기로 연기됐다. 8/20 전용 공개 테스트넷(Platåberget) 하드포크 이후 클라이언트 테스트 경과에 따라 확정된다. (출처: ethereum.org 로드맵)",
        dateStatus: "tba",
        sourceUrl: "https://ethereum.org/roadmap/glamsterdam/",
        sources: [
          { name: "ethereum.org 글램스터담 로드맵", url: "https://ethereum.org/roadmap/glamsterdam/", tier: 1, isOfficial: true },
          { name: "블루밍비트 — 4분기 연기 보도", url: "https://en.bloomingbit.io/feed/news/118497", tier: 3, isOfficial: false },
        ],
        nextCheck: new Date("2026-11-01T00:00:00Z"),
      },
    });
    console.log(`updated: #${glam.id} 글램스터담 8/1 TBA → 12/1 (4분기 목표)`);
  }

  // 2) #38 ENA 체인 종료 (6/20 과거 · 출처 0건 · needs_recheck) — ether.fi(6/30) 건과 혼동 의심 → 보관
  const ena = await prisma.calendarEvent.findFirst({
    where: { ticker: "ENA", reviewStatus: "needs_recheck", sourceUrl: null },
  });
  if (ena) {
    await prisma.calendarEvent.update({ where: { id: ena.id }, data: { reviewStatus: "archived" } });
    console.log(`archived: #${ena.id} ${ena.title} (출처 없음·검증 불가)`);
  }

  console.log(`완료 — 신규 ${created}건 / 후보 ${EVENTS.length}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
